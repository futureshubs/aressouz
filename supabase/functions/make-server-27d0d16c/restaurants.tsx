import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import * as r2 from './r2-storage.tsx';

const app = new Hono();

function collectDishLikeHttpUrls(obj: unknown): Set<string> {
  const urls = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://"))) urls.add(v.trim());
  };
  if (!obj || typeof obj !== "object") return urls;
  const o = obj as Record<string, unknown>;
  add(o.image);
  add(o.logo);
  add(o.coverImage);
  if (Array.isArray(o.images)) for (const x of o.images) add(x);
  if (Array.isArray(o.variants)) {
    for (const v of o.variants) {
      if (v && typeof v === "object") add((v as Record<string, unknown>).image);
    }
  }
  return urls;
}

async function purgeRemovedRestaurantR2Media(before: unknown, after: unknown) {
  const oldU = collectDishLikeHttpUrls(before);
  const newU = collectDishLikeHttpUrls(after);
  for (const url of oldU) {
    if (!newU.has(url)) await r2.deleteManagedR2UrlIfKnown(url);
  }
}

async function purgeAllRestaurantR2Media(obj: unknown) {
  for (const url of collectDishLikeHttpUrls(obj)) {
    await r2.deleteManagedR2UrlIfKnown(url);
  }
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/** Cart / URL ba'zan `restaurant:ts` va ba'zan `ts` yuborishi mumkin — KV kalitlar bilan moslashtirish */
async function resolveRestaurantRecord(rawId: unknown): Promise<{ id: string; record: any } | null> {
  const trimmed = decodeURIComponent(String(rawId ?? '').trim());
  if (!trimmed) return null;

  let record = await kv.get(trimmed);
  if (record && typeof record === 'object' && record.id) {
    return { id: String(record.id), record };
  }
  if (!trimmed.startsWith('restaurant:')) {
    const prefixed = `restaurant:${trimmed}`;
    record = await kv.get(prefixed);
    if (record && typeof record === 'object' && record.id) {
      return { id: String(record.id), record };
    }
  }
  return null;
}

function mergeOrdersLists(lists: any[][]): any[] {
  const byId = new Map<string, any>();
  for (const list of lists) {
    for (const o of list) {
      if (o?.id) byId.set(String(o.id), o);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

async function listRestaurantOrders(canonicalRestaurantId: string): Promise<any[]> {
  const primary = await kv.getByPrefix(`order:restaurant:${canonicalRestaurantId}:`);
  const legacyKey = canonicalRestaurantId.startsWith('restaurant:')
    ? canonicalRestaurantId.slice('restaurant:'.length)
    : canonicalRestaurantId;
  const secondary =
    legacyKey && legacyKey !== canonicalRestaurantId
      ? await kv.getByPrefix(`order:restaurant:${legacyKey}:`)
      : [];
  return mergeOrdersLists([primary, secondary]);
}

// ==================== RESTORANLAR ====================

// Barcha restoranlarni olish
app.get('/restaurants', async (c) => {
  try {
    const restaurants = await kv.getByPrefix('restaurant:');
    return c.json({ success: true, data: restaurants });
  } catch (error) {
    console.error('Restoranlarni olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Restoran qo'shish
app.post('/restaurants', async (c) => {
  try {
    const body = await c.req.json();
    const restaurantId = `restaurant:${Date.now()}`;
    
    const restaurant = {
      id: restaurantId,
      name: body.name,
      logo: body.logo,
      banner: body.banner,
      type: body.type, // Milliy, Fast food, Italia, etc.
      workTime: body.workTime,
      contact: {
        address: body.contact.address,
        phone: body.contact.phone,
        workHours: body.contact.workHours
      },
      branchId: body.branchId || '',
      // Restoran uchun to'lov QR rasm (kassa tasdiqlashda ishlatiladi)
      paymentQrImage: body.paymentQrImage || '',
      minOrderPrice: body.minOrderPrice || 0,
      deliveryTime: body.deliveryTime || '30-40 daqiqa',
      description: body.description,
      region: body.region, // Viloyat
      district: body.district, // Tuman
      telegramBotToken: body.telegramBotToken || '',
      telegramChatId: body.telegramChatId || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      // Login credentials
      login: body.login,
      password: body.password,
      // Statistics
      totalOrders: 0,
      totalRevenue: 0,
      pendingBalance: 0,
      paidBalance: 0
    };

    await kv.set(restaurantId, restaurant);
    
    // Telegram bot test message - using RESTAURANT bot token
    if (body.telegramChatId) {
      const botToken = Deno.env.get('TELEGRAM_RESTAURANT_BOT_TOKEN');
      if (botToken) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: body.telegramChatId,
              text: `✅ <b>${body.name} restorani muvaffaqiyatli qo'shildi!</b>

🔔 Taom buyurtmalari haqida bildirishnomalar shu yerga keladi.

⚡ <b>BUYURTMALARNI BOSHQARISH:</b>
Buyurtmani qabul qilish yoki bekor qilish uchun /taom ga kiring.

🤖 Bot: Restoran Bot`,
              parse_mode: 'HTML'
            })
          });
        } catch (err) {
          console.log('Telegram xabar yuborishda xato:', err);
        }
      }
    }

    return c.json({ success: true, data: restaurant });
  } catch (error) {
    console.error('Restoran qo\'shishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Restoran login
app.post('/restaurants/login', async (c) => {
  try {
    const { login, password } = await c.req.json();
    const restaurants = await kv.getByPrefix('restaurant:');
    
    const restaurant = restaurants.find((r: any) => 
      r.login === login && r.password === password
    );

    if (!restaurant) {
      return c.json({ success: false, error: 'Login yoki parol xato!' }, 401);
    }

    return c.json({ success: true, data: restaurant });
  } catch (error) {
    console.error('Login xatosi:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Restoran tahrirlash
app.put('/restaurants/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }

    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await purgeRemovedRestaurantR2Media(existing, updated);
    await kv.set(id, updated);

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Restoranni tahrirlashda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Restoran o'chirish
app.delete('/restaurants/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await kv.get(id);
    
    // Delete all dishes for this restaurant
    const dishes = await kv.getByPrefix(`dish:${id}:`);
    for (const dish of dishes) {
      await purgeAllRestaurantR2Media(dish);
      await kv.del(dish.id);
    }

    if (existing) await purgeAllRestaurantR2Media(existing);
    await kv.del(id);

    return c.json({ success: true });
  } catch (error) {
    console.error('Restoranni o\'chirishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== TAOMLAR ====================

// Restoran taomlarini olish
app.get('/restaurants/:restaurantId/dishes', async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId');
    const dishes = await kv.getByPrefix(`dish:${restaurantId}:`);
    return c.json({ success: true, data: dishes });
  } catch (error) {
    console.error('Taomlarni olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Taom qo'shish
app.post('/restaurants/:restaurantId/dishes', async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId');
    const body = await c.req.json();
    const dishId = `dish:${restaurantId}:${Date.now()}`;
    
    const dish = {
      id: dishId,
      restaurantId,
      name: body.name,
      image: body.image || (body.images && body.images[0]) || '', // Single image for compatibility
      images: body.images || (body.image ? [body.image] : []), // Array of images
      kcal: body.kcal || 0,
      calories: body.calories || 0,
      description: body.description,
      ingredients: body.ingredients || [],
      weight: body.weight,
      additionalProducts: body.additionalProducts || [], // [{ name, price }]
      variants: body.variants || [], // [{ name, image, price, prepTime }]
      isPopular: body.isPopular || false,
      isNatural: body.isNatural || false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await kv.set(dishId, dish);
    return c.json({ success: true, data: dish });
  } catch (error) {
    console.error('Taom qo\'shishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Taom tahrirlash
app.put('/dishes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) {
      return c.json({ success: false, error: 'Taom topilmadi' }, 404);
    }

    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await purgeRemovedRestaurantR2Media(existing, updated);
    await kv.set(id, updated);

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Taomni tahrirlashda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Taom o'chirish
app.delete('/dishes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await kv.get(id);
    if (existing) await purgeAllRestaurantR2Media(existing);
    await kv.del(id);
    return c.json({ success: true });
  } catch (error) {
    console.error('Taomni o\'chirishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Taom holatini o'zgartirish (Active/Stop)
app.patch('/dishes/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const { isActive } = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) {
      return c.json({ success: false, error: 'Taom topilmadi' }, 404);
    }

    const updated = { ...existing, isActive, updatedAt: new Date().toISOString() };
    await kv.set(id, updated);

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Taom holatini o\'zgartirishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== BUYURTMALAR ====================

// Restoran buyurtmalarini olish
app.get('/restaurants/:restaurantId/orders', async (c) => {
  try {
    const param = c.req.param('restaurantId');
    const resolved = await resolveRestaurantRecord(param);
    const canonicalId = resolved?.id ?? decodeURIComponent(String(param).trim());
    const orders = await listRestaurantOrders(canonicalId);
    return c.json({ success: true, data: orders });
  } catch (error) {
    console.error('Buyurtmalarni olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Restoran order statusini yangilash (restoran paneldan)
app.patch('/restaurants/:restaurantId/orders/:orderId/status', async (c) => {
  try {
    const restaurantParam = c.req.param('restaurantId');
    const orderParam = c.req.param('orderId');
    const { status } = await c.req.json().catch(() => ({}));

    const nextStatus = String(status || '').trim().toLowerCase();
    const allowed = new Set(['accepted', 'confirmed', 'preparing', 'ready', 'cancelled', 'rejected']);
    if (!allowed.has(nextStatus)) {
      return c.json({ success: false, error: 'Noto‘g‘ri status' }, 400);
    }

    const resolved = await resolveRestaurantRecord(restaurantParam);
    if (!resolved) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }
    const canonicalRestaurantId = resolved.id;
    const legacyRestaurantId = canonicalRestaurantId.startsWith('restaurant:')
      ? canonicalRestaurantId.slice('restaurant:'.length)
      : canonicalRestaurantId;

    const orderIdDecoded = decodeURIComponent(String(orderParam || '').trim());
    const candidateKeys = Array.from(
      new Set([
        orderIdDecoded,
        orderIdDecoded.startsWith('order:') ? '' : `order:${orderIdDecoded}`,
      ].filter(Boolean))
    );

    let matchedKey = '';
    let order: any = null;
    for (const key of candidateKeys) {
      const row = await kv.get(key);
      if (row) {
        matchedKey = key;
        order = row;
        break;
      }
    }

    if (!order || !matchedKey) {
      return c.json({ success: false, error: 'Buyurtma topilmadi' }, 404);
    }

    const orderRestaurantId = String(order.restaurantId || '').trim();
    const restaurantMatch =
      orderRestaurantId === canonicalRestaurantId ||
      orderRestaurantId === legacyRestaurantId ||
      matchedKey.includes(`order:restaurant:${canonicalRestaurantId}:`) ||
      (legacyRestaurantId && matchedKey.includes(`order:restaurant:${legacyRestaurantId}:`));

    if (!restaurantMatch) {
      return c.json({ success: false, error: 'Bu buyurtma ushbu restoranga tegishli emas' }, 403);
    }

    const nowIso = new Date().toISOString();
    const updated = {
      ...order,
      status: nextStatus,
      updatedAt: nowIso,
      statusHistory: [
        ...(Array.isArray(order.statusHistory) ? order.statusHistory : []),
        {
          status: nextStatus,
          timestamp: nowIso,
          note: 'Restoran tomonidan yangilandi',
        },
      ],
    };

    await kv.set(matchedKey, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Restoran order status yangilashda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Buyurtma yaratish (foydalanuvchi tomonidan)
app.post('/orders/restaurant', async (c) => {
  try {
    const body = await c.req.json();
    const pickQrImage = (entity: any): string => String(
      entity?.paymentQrImage ||
      entity?.paymentQRImage ||
      entity?.payment_qr_image ||
      entity?.paymentQr ||
      entity?.payment_qr ||
      entity?.qrImageUrl ||
      entity?.qrCode ||
      entity?.qr_code ||
      entity?.payment?.qrImage ||
      entity?.payment?.qrImageUrl ||
      entity?.payment?.qr ||
      entity?.paymentDetails?.qrImageUrl ||
      ''
    ).trim();
    const resolved = await resolveRestaurantRecord(body.restaurantId);
    if (!resolved) {
      return c.json(
        { success: false, error: 'Restoran topilmadi. ID noto‘g‘ri yoki o‘chirilgan.' },
        404
      );
    }
    const restaurantCanonicalId = resolved.id;
    const restaurant = resolved.record;
    const resolvedBranchId = String(
      body?.branchId ||
      body?.branchID ||
      body?.branch_id ||
      body?.branch?.id ||
      body?.restaurantBranchId ||
      restaurant?.branchId ||
      restaurant?.branchID ||
      restaurant?.branch_id ||
      restaurant?.branch?.id ||
      ''
    ).trim();
    const branchRecord = resolvedBranchId
      ? await kv.get(resolvedBranchId.startsWith('branch:') ? resolvedBranchId : `branch:${resolvedBranchId}`)
      : null;
    const merchantPaymentQrUrl = pickQrImage(restaurant) || pickQrImage(branchRecord);

    const orderId = `order:restaurant:${restaurantCanonicalId}:${Date.now()}`;

    const order = {
      id: orderId,
      orderType: 'food',
      restaurantId: restaurantCanonicalId,
      branchId: resolvedBranchId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerAddress: body.customerAddress,
      items: body.items, // [{ dishId, dishName, variantName, quantity, price, additionalProducts }]
      totalPrice: body.totalPrice,
      deliveryFee: body.deliveryFee || 0,
      status: 'pending', // pending, accepted, preparing, delivering, delivered, cancelled
      paymentStatus: 'pending', // pending, paid
      paymentMethod: body.paymentMethod, // cash, card, online
      paymentRequiresVerification: true,
      merchantPaymentQrUrl: merchantPaymentQrUrl || null,
      createdAt: new Date().toISOString(),
    };

    await kv.set(orderId, order);

    // Telegram notification using RESTAURANT bot token
    const chatIdRaw = restaurant?.telegramChatId;
    const chatId = chatIdRaw != null ? String(chatIdRaw).trim() : '';
    const botToken = Deno.env.get('TELEGRAM_RESTAURANT_BOT_TOKEN');

    if (!botToken) {
      console.warn('⚠️ TELEGRAM_RESTAURANT_BOT_TOKEN sozlanmagan — taom buyurtmasi Telegramga yuborilmaydi');
    } else if (!chatId) {
      console.warn(
        `⚠️ Restoran ${restaurantCanonicalId} uchun telegramChatId bo‘sh — bildirishnoma yuborilmaydi`
      );
    } else {
      const itemsText = (Array.isArray(body.items) ? body.items : [])
        .map((item: any) => {
          const addons = Array.isArray(item?.additionalProducts)
            ? item.additionalProducts
            : (Array.isArray(item?.addons)
              ? item.addons
              : (Array.isArray(item?.extras) ? item.extras : []));
          const addonsText = addons.length
            ? `\n  Qo'shimchalar:\n${addons
                .map((addon: any) => {
                  const addonQty = Number(addon?.quantity || 1);
                  const addonPrice = Number(addon?.price || 0);
                  return `  - ${addon?.name || 'Qo\'shimcha'} × ${addonQty} (${addonPrice.toLocaleString()} so'm)`;
                })
                .join('\n')}`
            : '';

          return `• ${item.dishName} ${item.variantName ? `(${item.variantName})` : ''} x${item.quantity} - ${Number(item.price || 0).toLocaleString()} so'm${addonsText}`;
        })
        .join('\n');

      const message = `🍕 <b>YANGI TAOM BUYURTMASI!</b>

📦 <b>Buyurtma #${orderId.slice(-6)}</b>
🏪 <b>Restoran:</b> ${restaurant.name}

━━━━━━━━━━━━━━━━━━

👤 <b>MIJOZ MA'LUMOTLARI:</b>

👨‍💼 <b>Ismi:</b> ${body.customerName}
📞 <b>Telefon:</b> ${body.customerPhone}
📍 <b>Manzil:</b> ${body.customerAddress}

━━━━━━━━━━━━━━━━━━

🍕 <b>TAOMLAR:</b>

${itemsText}

━━━━━━━━━━━━━━━━━━

💰 <b>JAMI SUMMA:</b> ${Number(body.totalPrice || 0).toLocaleString()} so'm
🚚 <b>Yetkazish:</b> ${Number(body.deliveryFee || 0).toLocaleString()} so'm
💳 <b>To'lov usuli:</b> ${
        String(body.paymentMethod || '').toLowerCase() === 'cash'
          ? 'Naqd pul'
          : String(body.paymentMethod || '').toLowerCase() === 'qr'
            ? 'Filial/Restoran QR'
            : 'Karta'
      }

━━━━━━━━━━━━━━━━━━

⚡ <b>DIQQAT!</b>
Buyurtmani qabul qilish yoki bekor qilish uchun iltimos /taom ga kiring va buyurtmani boshqaring.

✅ Qabul qilish - Buyurtmani tasdiqlash
❌ Bekor qilish - Buyurtmani rad etish`;

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          }),
        });
        const tgJson = await tgRes.json().catch(() => ({}));
        if (!tgRes.ok) {
          console.error('❌ Restoran bot Telegram API:', tgRes.status, JSON.stringify(tgJson));
        } else {
          console.log('✅ Restoran bot: Telegram xabar yuborildi!', tgJson?.result?.message_id);
        }
      } catch (err) {
        console.error('❌ Restoran bot: Telegram xabar yuborishda xato:', err);
      }
    }

    return c.json({ success: true, data: order });
  } catch (error) {
    console.error('Buyurtma yaratishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Buyurtma holatini o'zgartirish
app.patch('/orders/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const { status } = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) {
      return c.json({ success: false, error: 'Buyurtma topilmadi' }, 404);
    }

    const updated = { ...existing, status, updatedAt: new Date().toISOString() };
    await kv.set(id, updated);

    // Update restaurant stats if order is completed
    if (status === 'delivered' && existing.paymentStatus === 'paid') {
      const restaurant = await kv.get(existing.restaurantId);
      if (restaurant) {
        restaurant.totalOrders = (restaurant.totalOrders || 0) + 1;
        restaurant.totalRevenue = (restaurant.totalRevenue || 0) + existing.totalPrice;
        restaurant.pendingBalance = (restaurant.pendingBalance || 0) + existing.totalPrice;
        await kv.set(existing.restaurantId, restaurant);
      }
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Buyurtma holatini o\'zgartirishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Buyurtma to'lov holatini o'zgartirish
app.patch('/orders/:id/payment', async (c) => {
  try {
    const id = c.req.param('id');
    const { paymentStatus } = await c.req.json();
    
    const existing = await kv.get(id);
    if (!existing) {
      return c.json({ success: false, error: 'Buyurtma topilmadi' }, 404);
    }

    const updated = { ...existing, paymentStatus, updatedAt: new Date().toISOString() };
    await kv.set(id, updated);

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('To\'lov holatini o\'zgartirishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==================== STATISTIKA ====================

// Restoran statistikasi
app.get('/restaurants/:restaurantId/stats', async (c) => {
  try {
    const param = c.req.param('restaurantId');
    const resolved = await resolveRestaurantRecord(param);
    const restaurantId = resolved?.id ?? decodeURIComponent(String(param).trim());
    const restaurant = resolved?.record ?? (await kv.get(restaurantId));
    const orders = await listRestaurantOrders(restaurantId);
    const dishes = await kv.getByPrefix(`dish:${restaurantId}:`);
    
    // Today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate basic stats
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
    const completedOrders = orders.filter((o: any) => o.status === 'delivered').length;
    const rejectedOrders = orders.filter((o: any) => o.status === 'rejected').length;
    
    const todayOrders = orders.filter((o: any) => o.createdAt?.startsWith(today)).length;
    const todayRevenue = orders
      .filter((o: any) => o.createdAt?.startsWith(today) && o.status === 'delivered')
      .reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);
    
    const totalRevenue = orders
      .filter((o: any) => o.status === 'delivered')
      .reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);
    
    // Weekly revenue data for charts
    const weeklyRevenue = [];
    const weeklyOrders = [];
    const daysOfWeek = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayOrders = orders.filter((o: any) => o.createdAt?.startsWith(dateStr));
      const dayRevenue = dayOrders
        .filter((o: any) => o.status === 'delivered')
        .reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);
      
      weeklyRevenue.push({
        day: daysOfWeek[date.getDay()],
        revenue: dayRevenue
      });
      
      weeklyOrders.push({
        day: daysOfWeek[date.getDay()],
        orders: dayOrders.length
      });
    }
    
    // Top dishes
    const dishOrders: any = {};
    orders.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        if (!dishOrders[item.dishName]) {
          dishOrders[item.dishName] = 0;
        }
        dishOrders[item.dishName] += item.quantity;
      });
    });
    
    const topDishes = Object.entries(dishOrders)
      .map(([name, orders]) => ({ name, orders }))
      .sort((a: any, b: any) => b.orders - a.orders)
      .slice(0, 5);
    
    // Payment history
    const paymentHistory = restaurant?.paymentHistory || [];
    
    const stats = {
      totalOrders,
      pendingOrders,
      completedOrders,
      rejectedOrders,
      todayOrders,
      todayRevenue,
      totalRevenue,
      pendingBalance: restaurant?.pendingBalance || 0,
      paidBalance: restaurant?.paidBalance || 0,
      weeklyRevenue,
      weeklyOrders,
      topDishes,
      paymentHistory,
      lastPaymentRequest: restaurant?.lastPaymentRequest || null
    };

    return c.json({ success: true, data: stats });
  } catch (error) {
    console.error('Statistikani olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// To'lov so'rovi yuborish
app.post('/restaurants/:restaurantId/payment-request', async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId');
    const body = await c.req.json();
    const restaurant = await kv.get(restaurantId);
    
    if (!restaurant) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }
    
    // Check 24 hour limit
    const lastRequest = restaurant.lastPaymentRequest;
    if (lastRequest) {
      const hoursSinceLastRequest = (Date.now() - new Date(lastRequest).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRequest < 24) {
        return c.json({ 
          success: false, 
          error: `Keyingi to'lov so'rovini ${Math.ceil(24 - hoursSinceLastRequest)} soatdan keyin yuborishingiz mumkin.` 
        }, 400);
      }
    }
    
    // Add to payment history
    const paymentRequest = {
      amount: body.amount,
      date: new Date().toISOString(),
      status: 'pending'
    };
    
    const updatedRestaurant = {
      ...restaurant,
      lastPaymentRequest: new Date().toISOString(),
      paymentHistory: [...(restaurant.paymentHistory || []), paymentRequest]
    };
    
    await kv.set(restaurantId, updatedRestaurant);
    
    // TODO: Send notification to admin via Telegram
    
    return c.json({ success: true, message: 'To\'lov so\'rovi yuborildi!' });
  } catch (error) {
    console.error('To\'lov so\'rovida xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;