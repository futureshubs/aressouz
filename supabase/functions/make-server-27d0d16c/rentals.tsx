import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import * as r2 from "./r2-storage.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

function collectRentalProductHttpUrls(p: Record<string, unknown> | null | undefined): Set<string> {
  const urls = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://"))) urls.add(v.trim());
  };
  if (!p) return urls;
  add(p.image);
  add(p.photo);
  add(p.coverImage);
  if (Array.isArray(p.images)) for (const x of p.images) add(x);
  return urls;
}

async function purgeRentalProductR2Diff(before: unknown, after: unknown) {
  const oldU = collectRentalProductHttpUrls(before as Record<string, unknown>);
  const newU = collectRentalProductHttpUrls(after as Record<string, unknown>);
  for (const url of oldU) {
    if (!newU.has(url)) await r2.deleteManagedR2UrlIfKnown(url);
  }
}

async function purgeAllRentalProductR2(p: unknown) {
  for (const url of collectRentalProductHttpUrls(p as Record<string, unknown>)) {
    await r2.deleteManagedR2UrlIfKnown(url);
  }
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function normalizePhoneDigits(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 9) return `998${d}`;
  if (d.startsWith("998")) return d;
  if (d.length === 12 && d.startsWith("998")) return d;
  return d;
}

function addPaymentInterval(iso: string, schedule: "weekly" | "monthly"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  if (schedule === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function computeInitialNextDue(
  contractStartIso: string,
  schedule: "upfront" | "weekly" | "monthly",
): string | null {
  if (schedule === "upfront") return null;
  return addPaymentInterval(contractStartIso, schedule);
}

/** Kuryer yetkazgandan keyin — ijara tugash vaqti */
function computeRentalPeriodEndIso(
  startIso: string,
  rentalPeriod: string,
  rentalDuration: number,
): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  const n = Math.max(1, Number(rentalDuration) || 1);
  const p = String(rentalPeriod || "daily").toLowerCase();
  if (p === "hourly") d.setHours(d.getHours() + n);
  else if (p === "daily") d.setDate(d.getDate() + n);
  else if (p === "weekly") d.setDate(d.getDate() + n * 7);
  else if (p === "monthly") d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n);
  return d.toISOString();
}

/** Mijoz/filial muddat uzaytirish: `anchor` dan boshlab N ta davr qo‘shadi */
function addRentalUnitsFromAnchor(
  anchorMs: number,
  rentalPeriod: string,
  units: number,
): string {
  const d = new Date(anchorMs);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  const n = Math.max(1, Math.floor(units) || 1);
  const p = String(rentalPeriod || "daily").toLowerCase();
  if (p === "hourly") d.setHours(d.getHours() + n);
  else if (p === "daily") d.setDate(d.getDate() + n);
  else if (p === "weekly") d.setDate(d.getDate() + n * 7);
  else if (p === "monthly") d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n);
  return d.toISOString();
}

function maxCustomerExtendUnits(rentalPeriod: string): number {
  const p = String(rentalPeriod || "").toLowerCase();
  if (p === "hourly") return 168;
  if (p === "daily") return 60;
  if (p === "weekly") return 24;
  if (p === "monthly") return 12;
  return 60;
}

function rentalCourierActiveKey(courierId: string, orderId: string) {
  return `rental_courier_active_${courierId}_${orderId}`;
}

async function removeRentalCourierIndex(order: any) {
  const cid = String(order?.deliveryCourierId || "").trim();
  const oid = String(order?.id || "").trim();
  if (cid && oid) {
    try {
      await kv.del(rentalCourierActiveKey(cid, oid));
    } catch (_) { /* ignore */ }
  }
}

/** Naqd bo‘lsa kuryer kassaga topshiradi (market buyurtma qoidasi: jami − yetkazish haqi). */
function rentalPaymentIsCashLike(paymentMethod: unknown): boolean {
  const raw = String(paymentMethod || "").toLowerCase().trim();
  if (raw === "cash") return true;
  if (raw.includes("naqd") || raw.includes("naqt") || raw.includes("cash")) return true;
  if (!raw) return true;
  return false;
}

function computeRentalCourierHandoffUzs(order: {
  totalPrice?: unknown;
  deliveryPrice?: unknown;
  deliveryFee?: unknown;
  paymentMethod?: unknown;
}): { expectedUzs: number; isCashLike: boolean } {
  const isCashLike = rentalPaymentIsCashLike(order.paymentMethod);
  if (!isCashLike) return { expectedUzs: 0, isCashLike: false };
  const totalNum = Math.max(0, Math.round(Number(order.totalPrice) || 0));
  const deliveryFeeNum = Math.max(
    0,
    Math.round(Number(order.deliveryPrice ?? order.deliveryFee ?? 0) || 0),
  );
  return { expectedUzs: Math.max(0, totalNum - deliveryFeeNum), isCashLike: true };
}

async function resolveCourierSession(c: any): Promise<{ courierId: string } | null> {
  const token =
    c.req.header("X-Courier-Token") ||
    c.req.header("x-courier-token") ||
    c.req.query("token");
  if (!token) return null;
  const session = await kv.get(`courier_session:${token}`);
  if (!session || Date.now() > Number(session.expiresAt || 0)) return null;
  const courierId = String(session.courierId || "").trim();
  if (!courierId) return null;
  const courier = await kv.get(`courier:${courierId}`);
  if (!courier || courier.deleted) return null;
  return { courierId };
}

function enrichRentalOrderForClient(order: any) {
  const now = Date.now();
  const due = order.nextPaymentDue ? new Date(order.nextPaymentDue).getTime() : null;
  let paymentAlert: "none" | "due_soon" | "overdue" = "none";
  if (order.paymentSchedule === "weekly" || order.paymentSchedule === "monthly") {
    if (due != null && !Number.isNaN(due)) {
      if (due < now) paymentAlert = "overdue";
      else if (due < now + 3 * 24 * 60 * 60 * 1000) paymentAlert = "due_soon";
    }
  }
  let pickupAlert: "none" | "due_soon" | "overdue" = "none";
  const endT = order.rentalPeriodEndsAt ? new Date(order.rentalPeriodEndsAt).getTime() : null;
  if (
    order.status === "active" &&
    order.rentalPeriodStartedAt &&
    endT != null &&
    !Number.isNaN(endT)
  ) {
    if (now > endT) pickupAlert = "overdue";
    else if (now > endT - 24 * 60 * 60 * 1000) pickupAlert = "due_soon";
  }
  /** Kuryer «yetkazildi» qilguncha ijara vaqti boshlanmagan — profil va mijoz UI */
  const awaitingCourierDelivery =
    String(order.status || "").toLowerCase() === "active" && !order.rentalPeriodStartedAt;
  const handoff = computeRentalCourierHandoffUzs(order);
  return {
    ...order,
    paymentAlert,
    pickupAlert,
    awaitingCourierDelivery,
    rentalCourierToCashierPreviewUzs: handoff.expectedUzs,
    rentalPaymentIsCashLike: handoff.isCashLike,
  };
}

// Validate user
async function validateUser(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    console.log('❌ No Authorization header');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    console.log('❌ Invalid token:', error);
    return null;
  }
  
  return user;
}

// ==================== RENTAL PRODUCTS ====================

// Get all rental products for a branch
app.get('/products/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    console.log('📦 ===== GET RENTAL PRODUCTS =====');
    console.log('📦 Getting rental products for branch:', branchId);
    
    const products = await kv.getByPrefix(`rental_product_${branchId}_`);
    console.log(`📦 Found ${products?.length || 0} products for branch ${branchId}`);
    
    return c.json({ 
      success: true, 
      products: products || []
    });
  } catch (error: any) {
    console.error('❌ ===== ERROR GETTING RENTAL PRODUCTS =====');
    console.error('❌ Error details:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return c.json({ 
      success: false, 
      error: error.message,
      products: []
    }, 500);
  }
});

// Get single rental product
app.get('/product/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const product = await kv.get(`rental_product_${id}`);
    
    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }
    
    return c.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Error getting rental product:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create rental product
app.post('/products', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Creating rental product:', JSON.stringify(body, null, 2));
    
    if (!body.branchId || !body.name || !body.category || !body.region) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields: branchId, name, category, region' 
      }, 400);
    }
    
    const productId = `${body.branchId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const product = {
      id: productId,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      totalQuantity: body.quantity || 0,
      availableQuantity: body.quantity || 0,
      inRent: 0
    };
    
    console.log('💾 Saving product with key:', `rental_product_${body.branchId}_${productId}`);
    await kv.set(`rental_product_${body.branchId}_${productId}`, product);
    
    // Also create warehouse entry
    const warehouseEntry = {
      productId,
      branchId: body.branchId,
      total: body.quantity || 0,
      available: body.quantity || 0,
      inRent: 0,
      lastUpdated: new Date().toISOString()
    };
    
    await kv.set(`rental_warehouse_${body.branchId}_${productId}`, warehouseEntry);
    
    console.log('✅ Rental product created successfully:', productId);
    return c.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Error creating rental product:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update rental product
app.put('/products/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    console.log('📝 Updating rental product:', id, 'with data:', JSON.stringify(body, null, 2));
    
    if (!body.branchId) {
      return c.json({ success: false, error: 'branchId is required' }, 400);
    }
    
    const existingProduct = await kv.get(`rental_product_${body.branchId}_${id}`);
    
    if (!existingProduct) {
      console.log('❌ Product not found:', `rental_product_${body.branchId}_${id}`);
      return c.json({ success: false, error: 'Product not found' }, 404);
    }
    
    const updatedProduct = {
      ...existingProduct,
      ...body,
      id: existingProduct.id,
      updatedAt: new Date().toISOString()
    };
    
    await purgeRentalProductR2Diff(existingProduct, updatedProduct);
    await kv.set(`rental_product_${body.branchId}_${id}`, updatedProduct);
    
    console.log('✅ Rental product updated successfully:', id);
    return c.json({ success: true, product: updatedProduct });
  } catch (error: any) {
    console.error('❌ Error updating rental product:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete rental product
app.delete('/products/:branchId/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const branchId = c.req.param('branchId');
    
    console.log('🗑️ Deleting rental product:', branchId, id);
    
    const existing = await kv.get(`rental_product_${branchId}_${id}`);
    if (existing) await purgeAllRentalProductR2(existing);

    await kv.del(`rental_product_${branchId}_${id}`);
    await kv.del(`rental_warehouse_${branchId}_${id}`);
    
    console.log('✅ Rental product deleted successfully');
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error deleting rental product:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== WAREHOUSE ====================

// Get warehouse for branch
app.get('/warehouse/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const warehouse = await kv.getByPrefix(`rental_warehouse_${branchId}_`);
    
    return c.json({ success: true, warehouse: warehouse || [] });
  } catch (error: any) {
    console.error('❌ Error getting warehouse:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== RENTAL ORDERS ====================

// Get all rental orders for a branch
app.get('/orders/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const orders = await kv.getByPrefix(`rental_order_${branchId}_`);
    const list = (orders || []).map((o: any) => enrichRentalOrderForClient(o));
    return c.json({ success: true, orders: list });
  } catch (error: any) {
    console.error('❌ Error getting rental orders:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/** Mijoz telefon bo‘yicha faol ijaralar (indeks orqali) */
app.get('/my-rentals', async (c) => {
  try {
    const phone = c.req.query('phone') || '';
    const pk = normalizePhoneDigits(phone);
    if (!pk || pk.length < 9) {
      return c.json({ success: false, error: 'phone query required' }, 400);
    }
    const refs = await kv.getByPrefix(`rental_customer_${pk}_`);
    const orders: any[] = [];
    for (const ref of refs || []) {
      const branchId = ref?.branchId;
      const orderId = ref?.orderId;
      if (!branchId || !orderId) continue;
      const order = await kv.get(`rental_order_${branchId}_${orderId}`);
      // Profil: barcha ijaralar (tarix + filtrlash frontendda); bekor qilinganlar chiqmasin
      if (!order || String(order.status || "").toLowerCase() === "cancelled") continue;
      const row = { ...order };
      if (!row.productImage && row.productId && row.branchId) {
        try {
          const prod = await kv.get(`rental_product_${row.branchId}_${row.productId}`);
          const img = prod?.image || prod?.coverImage;
          if (typeof img === "string" && img.trim()) row.productImage = img.trim();
        } catch (_) { /* ignore */ }
      }
      orders.push(enrichRentalOrderForClient(row));
    }
    orders.sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
    return c.json({ success: true, orders });
  } catch (error: any) {
    console.error('❌ Error getting my rentals:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/** Mijoz: telefon tasdiqlangan holda ijara tugash vaqtini uzaytirish */
app.post("/my-rentals/extend", async (c) => {
  try {
    const body = await c.req.json();
    const pk = normalizePhoneDigits(String(body.phone || ""));
    const branchId = String(body.branchId || "").trim();
    const orderId = String(body.orderId || body.id || "").trim();
    let units = Math.max(1, Math.floor(Number(body.units) || 1));

    if (pk.length < 9 || !branchId || !orderId) {
      return c.json({ success: false, error: "phone, branchId, orderId majburiy" }, 400);
    }

    const orderKey = `rental_order_${branchId}_${orderId}`;
    const raw = await kv.get(orderKey);
    if (!raw) {
      return c.json({ success: false, error: "Buyurtma topilmadi" }, 404);
    }

    const orderPhone = normalizePhoneDigits(String(raw.customerPhone || ""));
    if (orderPhone !== pk) {
      return c.json({ success: false, error: "Telefon mos kelmaydi" }, 403);
    }

    const st = String(raw.status || "").toLowerCase();
    if (st !== "active" && st !== "extended") {
      return c.json({ success: false, error: "Buyurtma aktiv emas" }, 400);
    }

    if (!raw.rentalPeriodStartedAt) {
      return c.json({ success: false, error: "Ijara muddati hali boshlanmagan" }, 400);
    }

    if (raw.deliveryPending === true) {
      return c.json({ success: false, error: "Avval kuryer yetkazishini kuting" }, 400);
    }

    const endMs = raw.rentalPeriodEndsAt
      ? new Date(raw.rentalPeriodEndsAt).getTime()
      : NaN;
    if (Number.isNaN(endMs)) {
      return c.json({ success: false, error: "Tugash vaqti aniqlanmagan" }, 400);
    }

    const cap = maxCustomerExtendUnits(String(raw.rentalPeriod || ""));
    units = Math.min(units, cap);

    const now = Date.now();
    const anchor = Math.max(now, endMs);
    const newEndIso = addRentalUnitsFromAnchor(anchor, String(raw.rentalPeriod || "daily"), units);

    const price = Number(raw.pricePerPeriod) || 0;
    const qty = Math.max(1, Number(raw.quantity) || 1);
    const addTotal = Math.round(price * qty * units);

    const order = { ...raw };
    order.rentalPeriodEndsAt = newEndIso;
    order.rentalDuration = (Number(order.rentalDuration) || 1) + units;
    order.extendedUntil = newEndIso;
    order.totalPrice = (Number(order.totalPrice) || 0) + addTotal;
    order.customerExtensionLog = [
      ...(Array.isArray(order.customerExtensionLog) ? order.customerExtensionLog : []),
      { at: new Date().toISOString(), units, addedAmount: addTotal },
    ];
    order.updatedAt = new Date().toISOString();

    await kv.set(orderKey, order);
    return c.json({ success: true, order: enrichRentalOrderForClient(order) });
  } catch (error: any) {
    console.error("❌ my-rentals/extend:", error);
    return c.json({ success: false, error: error.message || "Xatolik" }, 500);
  }
});

/** Kuryer: o‘zi yetkazgan faol ijaralar (qaytarib olish uchun) */
app.get('/courier/active-rentals', async (c) => {
  try {
    const auth = await resolveCourierSession(c);
    if (!auth) {
      return c.json({ success: false, error: "Kuryer sessiyasi topilmadi" }, 401);
    }
    const refs = await kv.getByPrefix(`rental_courier_active_${auth.courierId}_`);
    const orders: any[] = [];
    for (const ref of refs || []) {
      const branchId = ref?.branchId;
      const orderId = ref?.orderId;
      if (!branchId || !orderId) continue;
      const order = await kv.get(`rental_order_${branchId}_${orderId}`);
      if (order && order.status === "active") {
        const row = { ...order };
        if (!row.productImage && row.productId && row.branchId) {
          try {
            const prod = await kv.get(`rental_product_${row.branchId}_${row.productId}`);
            const img = prod?.image || prod?.coverImage;
            if (typeof img === "string" && img.trim()) row.productImage = img.trim();
          } catch (_) { /* ignore */ }
        }
        orders.push(enrichRentalOrderForClient(row));
      }
    }
    orders.sort((a, b) =>
      String(a.rentalPeriodEndsAt || "").localeCompare(String(b.rentalPeriodEndsAt || ""))
    );
    return c.json({ success: true, orders });
  } catch (error: any) {
    console.error("❌ courier active-rentals:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create rental order
app.post('/orders', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Creating rental order:', body);

    if (!body.branchId || !body.productId) {
      return c.json({ success: false, error: 'branchId va productId majburiy' }, 400);
    }
    if (!body.customerName || !body.customerPhone) {
      return c.json({ success: false, error: 'Mijoz ismi va telefon majburiy' }, 400);
    }

    const orderId = `${body.branchId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const qty = Math.max(1, Number(body.quantity) || 1);
    const contractStartDate =
      body.contractStartDate || new Date().toISOString();
    const rentalPeriod = body.rentalPeriod || 'daily';
    let paymentSchedule: 'upfront' | 'weekly' | 'monthly' = body.paymentSchedule || 'upfront';
    if (rentalPeriod === 'weekly' || rentalPeriod === 'monthly') {
      paymentSchedule = rentalPeriod === 'weekly' ? 'weekly' : 'monthly';
    } else {
      paymentSchedule = 'upfront';
    }
    const pricePerPeriod = Number(body.pricePerPeriod) || 0;
    const totalPrice = Number(body.totalPrice) || pricePerPeriod * qty * (Number(body.rentalDuration) || 1);

    const periodLabel =
      rentalPeriod === 'hourly'
        ? 'soat'
        : rentalPeriod === 'daily'
          ? 'kun'
          : rentalPeriod === 'weekly'
            ? 'hafta'
            : 'oy';
    const durationLabel = `${Number(body.rentalDuration) || 1} ${periodLabel}`;

    const deferPeriodicUntilDelivery =
      rentalPeriod === "weekly" || rentalPeriod === "monthly";
    const nextPaymentDue = deferPeriodicUntilDelivery
      ? null
      : computeInitialNextDue(contractStartDate, paymentSchedule);

    const order = {
      id: orderId,
      branchId: body.branchId,
      productId: body.productId,
      productName: body.productName || '',
      productImage: String(body.productImage || body.image || "").trim(),
      quantity: qty,
      customerName: String(body.customerName || ''),
      customerPhone: String(body.customerPhone || ''),
      customerEmail: String(body.customerEmail || ''),
      passportSeriesNumber: String(body.passportSeriesNumber || body.passportOrId || ''),
      address: String(body.address || ''),
      notes: String(body.notes || body.additionalNotes || ''),
      rentalPeriod,
      rentalDuration: Number(body.rentalDuration) || 1,
      duration: durationLabel,
      pricePerPeriod,
      totalPrice,
      contractStartDate,
      paymentSchedule,
      nextPaymentDue,
      rentalPeriodStartedAt: null,
      rentalPeriodEndsAt: null,
      deliveryCourierId: null,
      deliveryConfirmedAt: null,
      pickupReminderSentAt: null,
      pickupCompletedAt: null,
      installmentsPaid: 0,
      paymentHistory: [] as Array<{ at: string; amount: number; label?: string }>,
      deliveryZoneSummary: body.deliveryZoneSummary || null,
      /** Ilova foydalanuvchisi bo‘lsa push eslatmalari uchun (ixtiyoriy) */
      customerUserId: body.customerUserId ? String(body.customerUserId).trim() : '',
      paymentMethod: String(body.paymentMethod || "cash").trim() || "cash",
      deliveryPrice: Math.max(0, Math.round(Number(body.deliveryPrice ?? body.deliveryFee ?? 0) || 0)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      /** Kuryer tasdiqlaguncha (confirmDelivery) */
      deliveryPending: true,
    };

    await kv.set(`rental_order_${body.branchId}_${orderId}`, order);

    const pk = normalizePhoneDigits(order.customerPhone);
    if (pk) {
      await kv.set(`rental_customer_${pk}_${orderId}`, {
        branchId: body.branchId,
        orderId,
        productId: body.productId,
      });
    }

    // Update warehouse
    const warehouseKey = `rental_warehouse_${body.branchId}_${body.productId}`;
    const warehouse = await kv.get(warehouseKey);

    if (warehouse) {
      warehouse.available = Math.max(0, (warehouse.available || 0) - qty);
      warehouse.inRent = (warehouse.inRent || 0) + qty;
      warehouse.lastUpdated = new Date().toISOString();
      await kv.set(warehouseKey, warehouse);
    }

    return c.json({ success: true, order: enrichRentalOrderForClient(order) });
  } catch (error: any) {
    console.error('❌ Error creating rental order:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update rental order status
app.put('/orders/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const orderKey = `rental_order_${body.branchId}_${id}`;
    const order = await kv.get(orderKey);
    
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    
    const oldStatus = order.status;

    if (body.confirmPickupReturn === true) {
      const auth = await resolveCourierSession(c);
      if (!auth) {
        return c.json({ success: false, error: "Kuryer sessiyasi topilmadi" }, 401);
      }
      if (String(order.deliveryCourierId || "") !== auth.courierId) {
        return c.json({ success: false, error: "Bu buyurtma sizga biriktirilmagan" }, 403);
      }
      if (order.status !== "active") {
        return c.json({ success: false, error: "Buyurtma aktiv emas" }, 400);
      }
      const bid = String(order.branchId || body.branchId);
      order.status = "returned";
      order.pickupCompletedAt = new Date().toISOString();
      order.returnDate = order.pickupCompletedAt;
      order.updatedAt = order.pickupCompletedAt;
      const { expectedUzs, isCashLike } = computeRentalCourierHandoffUzs(order);
      order.courierCashHandoffExpectedUzs = expectedUzs;
      order.courierCashHandoffStatus =
        isCashLike && expectedUzs > 0 ? "pending_cashier" : "not_applicable";
      order.courierCashHandedToCashierAt = null;
      await removeRentalCourierIndex(order);
      await kv.set(`rental_order_${bid}_${id}`, order);
      if (oldStatus === "active") {
        const warehouseKey = `rental_warehouse_${bid}_${order.productId}`;
        const warehouse = await kv.get(warehouseKey);
        if (warehouse) {
          warehouse.available += order.quantity;
          warehouse.inRent -= order.quantity;
          warehouse.lastUpdated = new Date().toISOString();
          await kv.set(warehouseKey, warehouse);
        }
      }
      return c.json({ success: true, order: enrichRentalOrderForClient(order) });
    }

    if (body.confirmDelivery === true) {
      if (order.rentalPeriodStartedAt) {
        return c.json({ success: false, error: "Yetkazish allaqachon tasdiqlangan" }, 400);
      }
      const courierId = String(body.deliveryCourierId || body.courierId || "").trim();
      if (!courierId) {
        return c.json({ success: false, error: "deliveryCourierId (kuryer) majburiy" }, 400);
      }
      const nowIso = new Date().toISOString();
      order.rentalPeriodStartedAt = nowIso;
      order.rentalPeriodEndsAt = computeRentalPeriodEndIso(
        nowIso,
        order.rentalPeriod,
        order.rentalDuration,
      );
      order.deliveryCourierId = courierId;
      order.deliveryConfirmedAt = nowIso;
      order.contractStartDate = nowIso;
      order.deliveryPending = false;
      const sched = order.paymentSchedule === "weekly" || order.paymentSchedule === "monthly"
        ? order.paymentSchedule
        : "upfront";
      order.nextPaymentDue = computeInitialNextDue(nowIso, sched);
      order.updatedAt = nowIso;
      await kv.set(orderKey, order);
      await kv.set(rentalCourierActiveKey(courierId, id), {
        branchId: order.branchId,
        orderId: id,
      });
      return c.json({ success: true, order: enrichRentalOrderForClient(order) });
    }

    if (body.recordPayment === true) {
      const schedule = order.paymentSchedule;
      const amount =
        Number(body.paymentAmount) ||
        Number(order.pricePerPeriod) * (Number(order.quantity) || 1);
      order.paymentHistory = [
        ...(Array.isArray(order.paymentHistory) ? order.paymentHistory : []),
        {
          at: new Date().toISOString(),
          amount,
          label: body.paymentLabel || "To‘lov qabul qilindi",
        },
      ];
      order.installmentsPaid = (Number(order.installmentsPaid) || 0) + 1;
      if (schedule === "weekly" || schedule === "monthly") {
        const base =
          order.nextPaymentDue ||
          order.contractStartDate ||
          new Date().toISOString();
        order.nextPaymentDue = addPaymentInterval(base, schedule);
      }
      order.updatedAt = new Date().toISOString();
      await kv.set(orderKey, order);
      return c.json({ success: true, order: enrichRentalOrderForClient(order) });
    }

    if (body.status !== undefined && body.status !== null) {
      order.status = body.status;
    }
    order.updatedAt = new Date().toISOString();
    
    if (body.returnDate) order.returnDate = body.returnDate;
    if (body.extendedUntil) order.extendedUntil = body.extendedUntil;
    
    await kv.set(orderKey, order);
    
    // Update warehouse if status changed to returned or cancelled
    if ((body.status === 'returned' || body.status === 'cancelled') && oldStatus === 'active') {
      await removeRentalCourierIndex(order);
      const warehouseKey = `rental_warehouse_${body.branchId}_${order.productId}`;
      const warehouse = await kv.get(warehouseKey);
      
      if (warehouse) {
        warehouse.available += order.quantity;
        warehouse.inRent -= order.quantity;
        warehouse.lastUpdated = new Date().toISOString();
        await kv.set(warehouseKey, warehouse);
      }
    }
    
    return c.json({ success: true, order: enrichRentalOrderForClient(order) });
  } catch (error: any) {
    console.error('❌ Error updating rental order:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== APPLICATIONS ====================

// Get all rental applications
app.get('/applications/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const applications = await kv.getByPrefix(`rental_application_${branchId}_`);
    
    return c.json({ success: true, applications: applications || [] });
  } catch (error: any) {
    console.error('❌ Error getting rental applications:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create rental application (from public)
app.post('/applications', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Creating rental application:', body);
    
    const applicationId = `${body.branchId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const application = {
      id: applicationId,
      ...body,
      createdAt: new Date().toISOString(),
      status: 'pending' // pending, approved, rejected
    };
    
    await kv.set(`rental_application_${body.branchId}_${applicationId}`, application);
    
    return c.json({ success: true, application });
  } catch (error: any) {
    console.error('❌ Error creating rental application:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update application status
app.put('/applications/:id', async (c) => {
  try {
    const user = await validateUser(c);
    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    
    const applicationKey = `rental_application_${body.branchId}_${id}`;
    const application = await kv.get(applicationKey);
    
    if (!application) {
      return c.json({ success: false, error: 'Application not found' }, 404);
    }
    
    application.status = body.status;
    application.updatedAt = new Date().toISOString();
    if (body.notes) application.notes = body.notes;
    
    await kv.set(applicationKey, application);
    
    return c.json({ success: true, application });
  } catch (error: any) {
    console.error('❌ Error updating rental application:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== STATISTICS ====================

// Get rental statistics for branch
app.get('/statistics/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    
    const products = await kv.getByPrefix(`rental_product_${branchId}_`) || [];
    const orders = await kv.getByPrefix(`rental_order_${branchId}_`) || [];
    const applications = await kv.getByPrefix(`rental_application_${branchId}_`) || [];
    
    const activeOrders = orders.filter((o: any) => o.status === 'active');
    const completedOrders = orders.filter((o: any) => o.status === 'returned');
    const cancelledOrders = orders.filter((o: any) => o.status === 'cancelled');
    
    const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);
    
    const pendingApplications = applications.filter((a: any) => a.status === 'pending');
    
    const statistics = {
      totalProducts: products.length,
      activeProducts: products.filter((p: any) => p.status === 'active').length,
      totalOrders: orders.length,
      activeRentals: activeOrders.length,
      completedRentals: completedOrders.length,
      cancelledRentals: cancelledOrders.length,
      totalRevenue,
      pendingApplications: pendingApplications.length,
      totalApplications: applications.length
    };
    
    return c.json({ success: true, statistics });
  } catch (error: any) {
    console.error('❌ Error getting rental statistics:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== RATINGS ====================

// Submit rating for a product (requires completed rental order)
app.post('/rating', async (c) => {
  try {
    const body = await c.req.json();
    console.log('⭐ Submitting rating:', body);
    
    const { productId, orderId, rating, comment } = body;
    
    if (!productId || !orderId || !rating) {
      return c.json({ 
        success: false, 
        message: 'productId, orderId va rating majburiy' 
      }, 400);
    }
    
    if (rating < 1 || rating > 5) {
      return c.json({ 
        success: false, 
        message: 'Rating 1 dan 5 gacha bo\'lishi kerak' 
      }, 400);
    }
    
    // Check if order exists and is completed
    const orders = await kv.getByPrefix(`rental_order_`);
    const order = orders.find((o: any) => o.id === orderId);
    
    if (!order) {
      return c.json({ 
        success: false, 
        message: 'Buyurtma topilmadi' 
      }, 404);
    }
    
    if (order.status !== 'returned') {
      return c.json({ 
        success: false, 
        message: 'Faqat tugallangan ijaralarni baholash mumkin' 
      }, 400);
    }
    
    // Check if already rated
    const existingRating = await kv.get(`rental_rating_${orderId}`);
    if (existingRating) {
      return c.json({ 
        success: false, 
        message: 'Siz allaqachon baholagansiz' 
      }, 400);
    }
    
    // Create rating
    const ratingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ratingData = {
      id: ratingId,
      productId,
      orderId,
      rating,
      comment: comment || '',
      createdAt: new Date().toISOString(),
      customerName: order.customerName || 'Anonim',
      customerPhone: order.customerPhone || ''
    };
    
    await kv.set(`rental_rating_${orderId}`, ratingData);
    
    // Update product rating
    await updateProductRating(productId);
    
    console.log('✅ Rating submitted successfully:', ratingId);
    return c.json({ success: true, rating: ratingData });
  } catch (error: any) {
    console.error('❌ Error submitting rating:', error);
    return c.json({ 
      success: false, 
      message: 'Reytingni yuborishda xatolik: ' + error.message 
    }, 500);
  }
});

// Get ratings for a product
app.get('/ratings/:productId', async (c) => {
  try {
    const productId = c.req.param('productId');
    
    const allRatings = await kv.getByPrefix(`rental_rating_`);
    const productRatings = allRatings.filter((r: any) => r.productId === productId);
    
    return c.json({ 
      success: true, 
      ratings: productRatings || [] 
    });
  } catch (error: any) {
    console.error('❌ Error getting ratings:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Helper function to update product rating
async function updateProductRating(productId: string) {
  try {
    // Get all ratings for this product
    const allRatings = await kv.getByPrefix(`rental_rating_`);
    const productRatings = allRatings.filter((r: any) => r.productId === productId);
    
    if (productRatings.length === 0) return;
    
    // Calculate average
    const totalRating = productRatings.reduce((sum: number, r: any) => sum + r.rating, 0);
    const averageRating = totalRating / productRatings.length;
    
    // Find and update the product
    const allProducts = await kv.getByPrefix(`rental_product_`);
    const product = allProducts.find((p: any) => p.id === productId);
    
    if (product) {
      product.rating = parseFloat(averageRating.toFixed(1));
      product.reviewCount = productRatings.length;
      
      // Find the correct key
      const productKeys = await kv.getByPrefix(`rental_product_`);
      for (const p of productKeys) {
        if (p.id === productId) {
          // Extract branchId from the existing product
          const branchId = p.branchId;
          await kv.set(`rental_product_${branchId}_${productId}`, product);
          console.log(`✅ Updated product rating: ${productId} -> ${averageRating.toFixed(1)} (${productRatings.length} reviews)`);
          break;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error updating product rating:', error);
  }
}

export default app;