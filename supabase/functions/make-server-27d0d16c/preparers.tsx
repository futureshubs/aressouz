// Tayyorlovchilar boshqaruvi: Market, Ijara va Do‘kon (filial naqd qabulidan keyin) buyurtmalari

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import { createCourierBagStore } from './courier-bags-db.ts';

const preparers = new Hono();

const supabaseBags = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);
const courierBagDb = createCourierBagStore(supabaseBags);

const buildCourierKey = (courierId: string) => `courier:${courierId}`;

// Retry helper function for database operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`⚠️ Retry attempt ${i + 1}/${maxRetries} after error:`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

const PREPARER_ALLOWED_ORDER_TYPES = new Set(['market', 'rental', 'shop']);

const isFoodLikeOrder = (order: any) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  // If cart items contain restaurant/dish markers, treat as food and exclude from preparer.
  return items.some((it: any) => {
    return Boolean(
      it?.restaurantId ||
        it?.dishDetails ||
        it?.dishId ||
        it?.catalogId === 'foods' ||
        it?.categoryId === 'taomlar' ||
        it?.dishDetails?.restaurantName
    );
  });
};

const isCashLikePayment = (raw: unknown) => {
  const s = String(raw ?? '').toLowerCase().trim();
  if (!s) return false;
  const c = s.replace(/\s+/g, '');
  if (c === 'cash' || c === 'naqd' || c === 'naqdpul') return true;
  if (s.includes('naqd') || s.includes('naqt')) return true;
  if (s.includes('cash')) return true;
  return false;
};

/**
 * Market yoki do‘kon + naqd: filial `release-to-preparer` qilmaguncha tayyorlovchida ko‘rinmasin.
 * - `order:market:` kalitidan kelgan yozuvlarda `orderType` bo‘lmasa ham market hisoblanadi.
 * - `payment_method` / "Naqd pul" kabi qiymatlar qo‘llab-quvvatlanadi.
 */
const isMarketCashPendingBranchRelease = (
  order: any,
  ctx?: { marketIdSet?: Set<string>; kvKey?: string },
) => {
  const id = String(order?.id || '');
  const fromKey = ctx?.kvKey ? String(ctx.kvKey).startsWith('order:market:') : false;
  const fromSet = ctx?.marketIdSet ? ctx.marketIdSet.has(id) : false;
  const t = String(order?.orderType || order?.type || '').toLowerCase();
  const fromFieldMarket = t === 'market';
  const fromFieldShop = t === 'shop';
  if (!fromKey && !fromSet && !fromFieldMarket && !fromFieldShop) return false;

  const pm = order?.paymentMethod ?? order?.payment_method;
  if (!isCashLikePayment(pm)) return false;
  if (order?.releasedToPreparerAt) return false;
  return true;
};

const isPreparerMarketOrRental = (order: any, marketIdSet: Set<string>) => {
  const id = String(order?.id || '');
  const t = String(order.orderType || order.type || '').toLowerCase();
  if (t === 'shop') return true;
  if (t === 'rental' || t === 'property' || t === 'place') return true;
  if (t === 'market') return true;
  if (marketIdSet.has(id)) return true;
  return false;
};

/** Bitta buyurtma uchun: KV kaliti `order:market:` bo‘lsa, `orderType` bo‘lmasa ham market. */
const orderIsMarketOrRentalForAuth = (order: any, kvKey: string) => {
  const t = String(order.orderType || order.type || '').toLowerCase();
  if (PREPARER_ALLOWED_ORDER_TYPES.has(t)) return true;
  if (String(kvKey).startsWith('order:market:')) return true;
  return false;
};

const getPreparerOrderById = async (orderId: string): Promise<{ order: any; key: string } | null> => {
  const marketOrder = await retryOperation(
    () => kv.get(`order:market:${orderId}`),
    3,
    500,
  );
  if (marketOrder) {
    return { order: marketOrder, key: `order:market:${orderId}` };
  }
  const normalOrder = await retryOperation(
    () => kv.get(`order:${orderId}`),
    3,
    500,
  );
  if (normalOrder) {
    return { order: normalOrder, key: `order:${orderId}` };
  }
  return null;
};

// ==================== PREPARER AUTH ====================

// Preparer Login
preparers.post('/login', async (c) => {
  try {
    const { login, password } = await c.req.json();

    console.log('🔐 Preparer login attempt:', login);

    if (!login || !password) {
      return c.json({ error: 'Login va parol majburiy' }, 400);
    }

    // Get all preparers
    const preparersData = await kv.getByPrefix('preparer:');
    
    if (!preparersData || preparersData.length === 0) {
      console.log('❌ No preparers found in database');
      return c.json({ error: 'Login yoki parol noto\'g\'ri' }, 401);
    }

    console.log(`📦 Found ${preparersData.length} preparers in database`);

    // Find preparer by login (getByPrefix returns values directly)
    const preparer = preparersData.find((p: any) => 
      p?.login === login && p?.password === password
    );

    if (!preparer) {
      console.log('❌ Preparer not found or wrong password');
      return c.json({ error: 'Login yoki parol noto\'g\'ri' }, 401);
    }

    console.log('✅ Preparer authenticated:', preparer.name);

    // Generate session token
    const sessionToken = `preparer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session (expires in 7 days)
    await kv.set(`preparer_session:${sessionToken}`, {
      preparerId: preparer.id,
      login: preparer.login,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
      createdAt: new Date().toISOString(),
    });

    return c.json({
      success: true,
      token: sessionToken,
      preparer: {
        id: preparer.id,
        name: preparer.name,
        phone: preparer.phone,
        zones: preparer.zones,
        region: preparer.region,
        district: preparer.district,
        workTime: preparer.workTime,
      }
    });
  } catch (error: any) {
    console.error('❌ Preparer login error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Validate Preparer Session
preparers.post('/validate', async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return c.json({ error: 'Token majburiy' }, 400);
    }

    const session = await kv.get(`preparer_session:${token}`);

    if (!session) {
      return c.json({ error: 'Session topilmadi' }, 401);
    }

    if (Date.now() > session.expiresAt) {
      await kv.del(`preparer_session:${token}`);
      return c.json({ error: 'Session muddati tugagan' }, 401);
    }

    // Get preparer data
    const preparer = await kv.get(`preparer:${session.preparerId}`);

    if (!preparer) {
      return c.json({ error: 'Tayyorlovchi topilmadi' }, 404);
    }

    return c.json({
      success: true,
      preparer: {
        id: preparer.id,
        name: preparer.name,
        phone: preparer.phone,
        zones: preparer.zones,
        region: preparer.region,
        district: preparer.district,
        workTime: preparer.workTime,
      }
    });
  } catch (error: any) {
    console.error('❌ Session validation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== PREPARER MANAGEMENT ====================

// Get all preparers (admin only)
preparers.get('/', async (c) => {
  try {
    console.log('📋 Fetching all preparers...');

    const preparersData = await kv.getByPrefix('preparer:');
    
    console.log('📦 Raw preparers data count:', preparersData.length);
    console.log('📦 First item sample:', preparersData[0]);
    
    // getByPrefix returns array of values directly, not {key, value} objects
    const preparersList = preparersData
      .filter((item: any) => item && item.id) // Filter out invalid items
      .map((item: any) => ({
        ...item,
        // Don't expose password
        password: undefined,
      }))
      .sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    console.log(`✅ Found ${preparersList.length} preparers`);

    return c.json({
      success: true,
      preparers: preparersList,
      total: preparersList.length,
    });
  } catch (error: any) {
    console.error('❌ Get preparers error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get single preparer by ID
preparers.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log('🔍 Fetching preparer:', id);

    const preparer = await kv.get(`preparer:${id}`);

    if (!preparer) {
      return c.json({ error: 'Tayyorlovchi topilmadi' }, 404);
    }

    return c.json({
      success: true,
      preparer: {
        ...preparer,
        password: undefined, // Don't expose password
      }
    });
  } catch (error: any) {
    console.error('❌ Get preparer error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Create new preparer
preparers.post('/', async (c) => {
  try {
    const data = await c.req.json();

    console.log('➕ Creating new preparer:', data.name);

    // Validation
    if (!data.name || !data.phone || !data.login || !data.password) {
      return c.json({ 
        error: 'Ism, telefon, login va parol majburiy' 
      }, 400);
    }

    // Check if login already exists (getByPrefix returns values directly)
    const existingPreparers = await kv.getByPrefix('preparer:');
    const loginExists = existingPreparers.some((p: any) => 
      p?.login === data.login
    );

    if (loginExists) {
      return c.json({ error: 'Bu login band' }, 400);
    }

    // Generate ID
    const id = `prep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const preparer = {
      id,
      name: data.name,
      phone: data.phone,
      address: data.address || '',
      zones: data.zones || [], // Array of zone IDs
      region: data.region || '',
      district: data.district || '',
      workTime: data.workTime || '09:00-18:00',
      salary: data.salary || 0,
      login: data.login,
      password: data.password, // In production, hash this!
      image: data.image || null,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`preparer:${id}`, preparer);

    console.log('✅ Preparer created:', id);

    return c.json({
      success: true,
      preparer: {
        ...preparer,
        password: undefined, // Don't expose password
      }
    });
  } catch (error: any) {
    console.error('❌ Create preparer error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update preparer
preparers.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();

    console.log('✏️ Updating preparer:', id);

    const existing = await kv.get(`preparer:${id}`);

    if (!existing) {
      return c.json({ error: 'Tayyorlovchi topilmadi' }, 404);
    }

    // Check if login is being changed and if it's already taken (getByPrefix returns values directly)
    if (data.login && data.login !== existing.login) {
      const allPreparers = await kv.getByPrefix('preparer:');
      const loginExists = allPreparers.some((p: any) => 
        p?.id !== id && p?.login === data.login
      );

      if (loginExists) {
        return c.json({ error: 'Bu login band' }, 400);
      }
    }

    const updated = {
      ...existing,
      ...data,
      id, // Keep original ID
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`preparer:${id}`, updated);

    console.log('✅ Preparer updated:', id);

    return c.json({
      success: true,
      preparer: {
        ...updated,
        password: undefined,
      }
    });
  } catch (error: any) {
    console.error('❌ Update preparer error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete preparer
preparers.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    console.log('🗑️ Deleting preparer:', id);

    const existing = await kv.get(`preparer:${id}`);

    if (!existing) {
      return c.json({ error: 'Tayyorlovchi topilmadi' }, 404);
    }

    await kv.del(`preparer:${id}`);

    // Delete all sessions for this preparer (getByPrefix returns values directly)
    const sessions = await kv.getByPrefix('preparer_session:');
    const sessionKeys: string[] = [];
    
    // We need to get sessions with their keys
    const supabase = (await import('jsr:@supabase/supabase-js@2.49.8')).createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );
    
    const { data: sessionData } = await supabase
      .from('kv_store_27d0d16c')
      .select('key, value')
      .like('key', 'preparer_session:%');
    
    if (sessionData) {
      for (const item of sessionData) {
        if (item.value?.preparerId === id) {
          await kv.del(item.key);
        }
      }
    }

    console.log('✅ Preparer deleted:', id);

    return c.json({
      success: true,
      message: 'Tayyorlovchi o\'chirildi'
    });
  } catch (error: any) {
    console.error('❌ Delete preparer error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ==================== PREPARER ORDERS ====================

// Get orders for preparer (by zones)
preparers.get('/:id/orders', async (c) => {
  try {
    const id = c.req.param('id');
    const status = c.req.query('status'); // Filter by status

    console.log('📦 Fetching orders for preparer:', id);

    // Get preparer data with retry
    const preparer = await retryOperation(
      () => kv.get(`preparer:${id}`),
      3,
      500
    );

    if (!preparer) {
      console.log('❌ Preparer not found:', id);
      return c.json({ error: 'Tayyorlovchi topilmadi' }, 404);
    }

    console.log('✅ Preparer found:', preparer.name);
    console.log('📍 Preparer zones:', preparer.zones);

    // Market + ijara + do‘kon (filial naqd qabulidan keyin) buyurtmalari
    const [marketOrders, generalOrders] = await Promise.all([
      retryOperation(
        () => kv.getByPrefix('order:market:'),
        3,
        500,
      ),
      retryOperation(
        () => kv.getByPrefix('order:'),
        3,
        500,
      ),
    ]);
    const dedupedOrdersMap = new Map<string, any>();
    [...marketOrders, ...generalOrders].forEach((order: any) => {
      if (!order?.id) return;
      dedupedOrdersMap.set(order.id, order);
    });
    const allOrders = Array.from(dedupedOrdersMap.values());

    const marketIdSet = new Set<string>();
    for (const o of marketOrders) {
      if (o?.id) marketIdSet.add(String(o.id));
    }
    
    console.log(`📦 Total candidate orders found: ${allOrders.length}`);
    
    // Filter orders by preparer's zones
    let filteredOrders = allOrders.filter((order: any) => {
      if (!isPreparerMarketOrRental(order, marketIdSet)) return false;

      if (isMarketCashPendingBranchRelease(order, { marketIdSet })) {
        return false;
      }

      // Extra safety: never show food-like orders in preparer panel
      if (isFoodLikeOrder(order)) return false;
      
      // Check if order's zone matches preparer's zones
      const orderZoneId = order.deliveryZone;
      if (!orderZoneId) return false;
      
      return preparer.zones && preparer.zones.includes(orderZoneId);
    });

    console.log(`📦 Filtered orders by zones: ${filteredOrders.length}`);

    // Filter by status if provided
    if (status) {
      filteredOrders = filteredOrders.filter((order: any) => 
        order.status === status
      );
      console.log(`📦 Filtered orders by status '${status}': ${filteredOrders.length}`);
    }

    const orders = filteredOrders
      .sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    console.log(`✅ Found ${orders.length} orders for preparer`);

    return c.json({
      success: true,
      orders,
      total: orders.length,
    });
  } catch (error: any) {
    console.error('❌ Get preparer orders error:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ 
      error: 'Buyurtmalarni yuklashda xatolik. Iltimos, qayta urinib ko\'ring.',
      details: error.message 
    }, 500);
  }
});

// Filialdagi bo'sh olib ketish rastalari — tayyorlovchi buyurtma tayyor bo'lganda rastani tanlaydi
preparers.get('/:id/orders/:orderId/pickup-racks', async (c) => {
  try {
    const preparerId = c.req.param('id');
    const orderId = c.req.param('orderId');

    const orderRecord = await getPreparerOrderById(orderId);
    const order = orderRecord?.order;

    if (!order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    if (!orderIsMarketOrRentalForAuth(order, orderRecord.key)) {
      return c.json({ error: 'Faqat Market, Ijara va Do‘kon buyurtmalari uchun ruxsat bor' }, 403);
    }
    if (isMarketCashPendingBranchRelease(order, { kvKey: orderRecord.key })) {
      return c.json(
        { error: "Bu buyurtma filial qabul qilinmaguncha rasta tanlanmaydi" },
        409,
      );
    }

    const preparer = await retryOperation(
      () => kv.get(`preparer:${preparerId}`),
      3,
      500,
    );

    if (!preparer || !preparer.zones || !preparer.zones.includes(order.deliveryZone)) {
      return c.json({ error: 'Bu buyurtmaga ruxsat yo\'q' }, 403);
    }

    const branchId = String(order.branchId || '').trim();
    if (!branchId) {
      return c.json({ error: 'Buyurtmada filial (branchId) yo\'q — buyurtma ma\'lumotini tekshiring' }, 400);
    }

    const racks = await retryOperation(() => kv.getByPrefix('pickup_rack:'), 3, 500);
    const branchRacks = racks.filter((rack: any) => rack && !rack.deleted && rack.branchId === branchId);
    const nonRackStatuses = new Set(['with_courier', 'delivering', 'delivered', 'cancelled']);
    const healedRacks: any[] = [];
    for (const rack of branchRacks) {
      let nextRack = rack;
      const linkedOrderId = String(rack.currentOrderId || '').trim();
      if (linkedOrderId) {
        const linkedOrderRecord = await getPreparerOrderById(linkedOrderId);
        const linkedOrderStatus = String(linkedOrderRecord?.order?.status || '').trim();
        const shouldFree = !linkedOrderRecord?.order || nonRackStatuses.has(linkedOrderStatus);
        if (shouldFree) {
          nextRack = {
            ...rack,
            status: 'available',
            currentOrderId: null,
            updatedAt: new Date().toISOString(),
          };
          await retryOperation(
            () => kv.set(`pickup_rack:${branchId}:${rack.id}`, nextRack),
            3,
            300,
          );
        }
      }
      healedRacks.push(nextRack);
    }

    const candidates = healedRacks.filter((rack: any) =>
      rack.status === 'available' && !rack.currentOrderId
    );

    return c.json({
      success: true,
      racks: candidates,
      branchId,
    });
  } catch (error: any) {
    console.error('❌ Preparer pickup-racks error:', error);
    return c.json({ error: error.message || 'Rastalarni yuklashda xatolik' }, 500);
  }
});

// Update order status (by preparer)
preparers.post('/:id/orders/:orderId/status', async (c) => {
  try {
    const preparerId = c.req.param('id');
    const orderId = c.req.param('orderId');
    const body = await c.req.json();
    const { status, rackId } = body;

    console.log(`📋 Preparer ${preparerId} updating order ${orderId} to status: ${status}`);

    // Validate status
    const validStatuses = ['new', 'preparing', 'ready', 'with_courier', 'delivering', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return c.json({ error: 'Noto\'g\'ri status' }, 400);
    }

    // Get order with retry
    const orderRecord = await getPreparerOrderById(orderId);
    const order = orderRecord?.order;

    if (!order) {
      return c.json({ error: 'Buyurtma topilmadi' }, 404);
    }
    if (!orderIsMarketOrRentalForAuth(order, orderRecord.key)) {
      return c.json({ error: 'Faqat Market, Ijara va Do‘kon buyurtmalari uchun ruxsat bor' }, 403);
    }
    if (isMarketCashPendingBranchRelease(order, { kvKey: orderRecord.key })) {
      return c.json(
        { error: "Bu buyurtma filial qabul qilmaguncha tayyorlovchi o'zgartira olmaydi" },
        409,
      );
    }

    // Verify preparer has access to this order with retry
    const preparer = await retryOperation(
      () => kv.get(`preparer:${preparerId}`),
      3,
      500
    );
    
    if (!preparer || !preparer.zones || !preparer.zones.includes(order.deliveryZone)) {
      return c.json({ error: 'Bu buyurtmaga ruxsat yo\'q' }, 403);
    }

    const branchId = String(order.branchId || '').trim();
    let rackSnapshot: { id: string; name: string; number: string } | null = null;

    if (status === 'ready') {
      const chosenRackId = String(rackId || '').trim();
      if (!chosenRackId) {
        return c.json({ error: 'Tayyor deb belgilash uchun olib ketish rastasini tanlang' }, 400);
      }
      if (!branchId) {
        return c.json({ error: 'Buyurtmada filial ID yo\'q' }, 400);
      }

      const rackKey = `pickup_rack:${branchId}:${chosenRackId}`;
      const rack = await retryOperation(() => kv.get(rackKey), 3, 500);
      if (!rack || rack.deleted) {
        return c.json({ error: 'Rasta topilmadi' }, 404);
      }
      if (rack.status !== 'available' || rack.currentOrderId) {
        return c.json({ error: 'Faqat bo\'sh rasta tanlanadi' }, 400);
      }

      const nowRack = new Date().toISOString();
      const updatedRack = {
        ...rack,
        status: 'occupied',
        currentOrderId: orderId,
        updatedAt: nowRack,
      };
      await kv.set(rackKey, updatedRack);
      rackSnapshot = { id: rack.id, name: rack.name, number: rack.number };
    }

    // Update order
    const updated = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
      ...(rackSnapshot
        ? {
            pickupRackId: rackSnapshot.id,
            pickupRackName: rackSnapshot.name,
            pickupRackNumber: rackSnapshot.number,
          }
        : {}),
      // Add status history
      statusHistory: [
        ...(order.statusHistory || []),
        {
          status,
          timestamp: new Date().toISOString(),
          updatedBy: preparerId,
          ...(rackSnapshot ? { pickupRackId: rackSnapshot.id, pickupRackNumber: rackSnapshot.number } : {}),
        }
      ]
    };

    const orderKey = orderRecord?.key || (String(order.orderType || '').toLowerCase() === 'market'
      ? `order:market:${orderId}`
      : `order:${orderId}`);
    await retryOperation(
      () => kv.set(orderKey, updated),
      3,
      500
    );

    console.log('✅ Order status updated');

    return c.json({
      success: true,
      order: updated,
    });
  } catch (error: any) {
    console.error('❌ Update order status error:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ 
      error: 'Status o\'zgartirishda xatolik. Iltimos, qayta urinib ko\'ring.',
      details: error.message 
    }, 500);
  }
});

export default preparers;