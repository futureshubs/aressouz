import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import * as r2 from './r2-storage.tsx';
import * as businessHours from './businessHours.ts';
import {
  clampPlatformCommissionPercent,
  validateVariantCommissionsForSave,
} from './platform-commission.ts';
import * as telegram from './telegram.tsx';
import { getOrderKeys } from './services/order-kv-lookup.ts';

const app = new Hono();

/** Kuryer «olib ketish joyi» — {lat,lng}, [lat,lng] yoki latitude/longitude */
function normalizeMerchantCoords(body: Record<string, unknown> | null | undefined): { lat: number; lng: number } | null {
  if (!body) return null;
  const c = body.coordinates;
  if (Array.isArray(c) && c.length >= 2) {
    const lat = Number(c[0]);
    const lng = Number(c[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    const lat = Number(o.lat ?? o.latitude);
    const lng = Number(o.lng ?? o.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  const la = Number(body.latitude ?? body.lat);
  const ln = Number(body.longitude ?? body.lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
    return { lat: la, lng: ln };
  }
  return null;
}

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

/** Filial `branch_123` yoki `branch:branch_123` ko'rinishida saqlangan bo'lishi mumkin */
function normalizeBranchIdForCompare(raw: unknown): string {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  try {
    s = decodeURIComponent(s);
  } catch {
    /* query ba'zan allaqachon dekodlangan */
  }
  while (s.startsWith('branch:')) {
    s = s.slice('branch:'.length).trim();
  }
  return s;
}

function restaurantMatchesBranchFilter(restaurantBranchId: unknown, queryBranchId: string): boolean {
  const q = normalizeBranchIdForCompare(queryBranchId);
  if (!q) return true;
  const r = normalizeBranchIdForCompare(restaurantBranchId);
  return r !== '' && r === q;
}

function normalizeLocToken(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[`'’‘ʻʼ-]/g, '')
    .replace(/\s+/g, '');
}

function collectRestLocFields(r: any, keys: string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const v = r?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') out.push(String(v));
  }
  return out;
}

/** branchId bo'sh restoran — filial hududi (viloyat+tuman) bilan FoodsView ga yaqin moslik */
function restaurantMatchesLocationHints(
  r: any,
  regionHints: string[],
  districtHints: string[],
): boolean {
  if (regionHints.length === 0 || districtHints.length === 0) return false;
  const rf = collectRestLocFields(r, ['region', 'regionId', 'region_id']).map(normalizeLocToken).filter(Boolean);
  const df = collectRestLocFields(r, ['district', 'districtId', 'district_id']).map(normalizeLocToken).filter(Boolean);
  if (rf.length === 0 || df.length === 0) return false;
  const regionOk = rf.some((v) =>
    regionHints.some((h) => v === h || (h && (v.includes(h) || h.includes(v))))
  );
  const districtOk = df.some((v) =>
    districtHints.some((h) => v === h || (h && (v.includes(h) || h.includes(v))))
  );
  return regionOk && districtOk;
}

function restaurantLegacyId(canonicalRestaurantId: string): string {
  return canonicalRestaurantId.startsWith('restaurant:')
    ? canonicalRestaurantId.slice('restaurant:'.length)
    : canonicalRestaurantId;
}

async function listDishesForRestaurant(canonicalRestaurantId: string): Promise<any[]> {
  const primary = await kv.getByPrefix(`dish:${canonicalRestaurantId}:`);
  const legacy = restaurantLegacyId(canonicalRestaurantId);
  const secondary =
    legacy && legacy !== canonicalRestaurantId
      ? await kv.getByPrefix(`dish:${legacy}:`)
      : [];
  const byId = new Map<string, any>();
  for (const d of [...primary, ...secondary]) {
    if (d?.id) byId.set(String(d.id), d);
  }
  return Array.from(byId.values());
}

async function listDiningRoomsForRestaurant(canonicalRestaurantId: string): Promise<any[]> {
  const primary = await kv.getByPrefix(`dining_room:${canonicalRestaurantId}:`);
  const legacy = restaurantLegacyId(canonicalRestaurantId);
  const secondary =
    legacy && legacy !== canonicalRestaurantId
      ? await kv.getByPrefix(`dining_room:${legacy}:`)
      : [];
  const byId = new Map<string, any>();
  for (const d of [...primary, ...secondary]) {
    if (d?.id) byId.set(String(d.id), d);
  }
  return Array.from(byId.values());
}

async function listTableBookingsForRestaurant(canonicalRestaurantId: string): Promise<any[]> {
  const primary = await kv.getByPrefix(`table_booking:${canonicalRestaurantId}:`);
  const legacy = restaurantLegacyId(canonicalRestaurantId);
  const secondary =
    legacy && legacy !== canonicalRestaurantId
      ? await kv.getByPrefix(`table_booking:${legacy}:`)
      : [];
  const byId = new Map<string, any>();
  for (const d of [...primary, ...secondary]) {
    if (d?.id) byId.set(String(d.id), d);
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
}

function normalizeBookingTimeSlot(t: unknown): string {
  const s = String(t ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s.slice(0, 8);
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Mijoz bron qila olmaydigan vaqt oralig‘i (masalan tushlik 10:00–13:00), [from, to) daqiqada from < to */
function sanitizeBookingUnavailableRanges(raw: unknown): { from: string; to: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { from: string; to: string }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const from = normalizeBookingTimeSlot((row as { from?: unknown }).from);
    const to = normalizeBookingTimeSlot((row as { to?: unknown }).to);
    if (!from || !to) continue;
    const fa =
      parseInt(from.slice(0, 2), 10) * 60 +
      parseInt(from.slice(3, 5), 10);
    const ta = parseInt(to.slice(0, 2), 10) * 60 + parseInt(to.slice(3, 5), 10);
    if (!Number.isFinite(fa) || !Number.isFinite(ta) || fa >= ta) continue;
    out.push({ from, to });
  }
  return out.slice(0, 8);
}

const LEGACY_BOOKING_MINUTES = 30;

function bookingMinutesFromSlot(t: unknown): number {
  const s = normalizeBookingTimeSlot(t);
  if (!s) return -1;
  const fa = parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(3, 5), 10);
  return Number.isFinite(fa) ? fa : -1;
}

function bookingIntervalFromRecord(b: any): { start: number; end: number } | null {
  const start = bookingMinutesFromSlot(b?.bookingTime);
  if (start < 0) return null;
  let end: number;
  if (b?.bookingEndTime) {
    const em = bookingMinutesFromSlot(b.bookingEndTime);
    end = em <= start ? start + LEGACY_BOOKING_MINUTES : em;
  } else {
    end = start + LEGACY_BOOKING_MINUTES;
  }
  end = Math.min(24 * 60, end);
  if (end <= start) return null;
  return { start, end };
}

function intervalsOverlapHalfOpenMinutes(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
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

function isPaidLikeRestaurant(ps: unknown): boolean {
  const s = String(ps || '').toLowerCase().trim();
  return s === 'paid' || s === 'completed' || s === 'success';
}

/** Click/Payme: `paymentStatus` hali pending, lekin chek id yoki payment obyekti paid */
function orderAppearsPaidForRestaurantCancel(order: any): boolean {
  if (isPaidLikeRestaurant(order?.paymentStatus)) return true;
  const payObj = order?.payment && typeof order.payment === 'object' ? order.payment : null;
  if (isPaidLikeRestaurant(payObj?.status)) return true;
  const ps = String(order?.paymentStatus || '').toLowerCase().trim();
  if (ps === 'refunded' || ps === 'failed') return false;
  if (order?.paidAt || order?.paymentCompletedAt || order?.paymentVerifiedAt) return true;
  const pm = String(order?.paymentMethod || '').toLowerCase();
  const online =
    pm.includes('click') ||
    pm.includes('payme') ||
    pm.includes('atmos') ||
    pm.includes('uzum') ||
    pm.includes('humo') ||
    pm === 'qr' ||
    pm === 'qrcode' ||
    pm === 'online';
  if (
    online &&
    (order?.paymeReceiptId ||
      order?.clickTransId ||
      order?.payme_receipt_id ||
      order?.click_trans_id ||
      order?.transactionId)
  ) {
    return true;
  }
  return false;
}

/** Taom buyurtmasi: barcha mos KV kalitlarida bir xil yozuv (kassa / filial ro‘yxati) */
async function persistRestaurantOrderWrite(order: any, matchedKey: string): Promise<void> {
  const keys = new Set<string>();
  if (matchedKey) keys.add(matchedKey);
  const oid = String(order?.id || '').trim();
  if (oid) {
    for (const k of getOrderKeys(oid)) {
      if (k) keys.add(k);
    }
    keys.add(oid);
  }
  const mk = order?.foodOrderMirrorKey;
  if (typeof mk === 'string' && mk.trim()) keys.add(mk.trim());

  for (const k of keys) {
    if (!k) continue;
    await kv.set(k, order);
  }
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
  const merged = mergeOrdersLists([primary, secondary]);
  // Avval naqd + filial qabuli bo‘lmaguncha yashirilgan — restoran Telegram oladi, lekin panel bo‘sh qolardi.
  return merged
    .filter((o: any) => !o?.deleted)
    // Cash > 100k: filial qabuligacha restorandan yashiramiz
    .filter((o: any) => !(o?.branchCashHold === true && !o?.releasedToRestaurantAt));
}

const DISH_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** So‘nggi 7 kunda taom pozitsiyasi (dona) — bekor/rad buyurtmalar hisobga olinmaydi */
function aggregateWeeklyDishUnitSales(dishes: any[], orders: any[]): Map<string, number> {
  const counts = new Map<string, number>();
  const now = Date.now();
  const nameToId = new Map<string, string>();
  for (const d of dishes) {
    const id = String(d?.id || '').trim();
    const nm = String(d?.name || '').trim().toLowerCase();
    if (id && nm) nameToId.set(nm, id);
  }
  for (const o of orders) {
    const ct = new Date(o?.createdAt || 0).getTime();
    if (!Number.isFinite(ct) || now - ct > DISH_WEEK_MS) continue;
    const st = String(o?.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'rejected') continue;
    const items = Array.isArray(o?.items) ? o.items : [];
    for (const it of items) {
      let did = String(it?.dishId || '').trim();
      if (!did) {
        const key = String(it?.dishName || '').trim().toLowerCase();
        did = nameToId.get(key) || '';
      }
      if (!did) continue;
      const qty = Math.max(0, Math.floor(Number(it?.quantity) || 0));
      const add = qty > 0 ? qty : 1;
      counts.set(did, (counts.get(did) || 0) + add);
    }
  }
  return counts;
}

function attachWeeklyStatsToDishes(dishes: any[], orders: any[]): any[] {
  const counts = aggregateWeeklyDishUnitSales(dishes, orders);
  let maxC = 0;
  for (const d of dishes) {
    const c = counts.get(String(d.id)) || 0;
    if (c > maxC) maxC = c;
  }
  return dishes.map((d) => {
    const wc = counts.get(String(d.id)) || 0;
    const rel = maxC > 0 ? Math.min(100, Math.round((wc / maxC) * 100)) : wc > 0 ? 100 : 0;
    const rawManual = d?.likesPercent ?? d?.likeRating;
    const manualNum = Number(rawManual);
    const hasManual = Number.isFinite(manualNum) && manualNum >= 0 && manualNum <= 100;
    return {
      ...d,
      weeklyOrderCount: wc,
      weeklyPopularityScore: rel,
      likesPercent: hasManual ? Math.round(manualNum) : rel,
      likesPercentDerived: !hasManual,
    };
  });
}

// ==================== RESTORANLAR ====================

// Barcha restoranlarni olish
// ?branchId= — shu filialga bog'langanlar
// &forBranchPanel=1 — qo'shimcha: branchId bo'sh, lekin viloyat/tuman filial bilan mos restoranlar (mijoz ilovasida ko'rinadigan "yetimlar")
app.get('/restaurants', async (c) => {
  try {
    let restaurants = await kv.getByPrefix('restaurant:');
    const branchQ = c.req.query('branchId');
    if (branchQ != null && String(branchQ).trim() !== '') {
      const want = String(branchQ).trim();
      const forPanel = String(c.req.query('forBranchPanel') ?? '').trim() === '1';
      const regionHints = [
        c.req.query('regionId'),
        c.req.query('region'),
        c.req.query('regionName'),
      ]
        .map((x) => normalizeLocToken(String(x ?? '')))
        .filter(Boolean);
      const districtHints = [
        c.req.query('districtId'),
        c.req.query('district'),
        c.req.query('districtName'),
      ]
        .map((x) => normalizeLocToken(String(x ?? '')))
        .filter(Boolean);
      const uniq = (a: string[]) => [...new Set(a)];
      const rh = uniq(regionHints);
      const dh = uniq(districtHints);
      const allowOrphans = forPanel && rh.length > 0 && dh.length > 0;

      restaurants = (restaurants || []).filter((r: any) => {
        if (restaurantMatchesBranchFilter(r?.branchId, want)) return true;
        if (!allowOrphans) return false;
        if (normalizeBranchIdForCompare(r?.branchId) !== '') return false;
        return restaurantMatchesLocationHints(r, rh, dh);
      });
    }
    return c.json({ success: true, data: restaurants });
  } catch (error) {
    console.error('Restoranlarni olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Bitta restoran (mijoz: ish vaqti; login/parol qaytarilmaydi)
app.get('/restaurants/:id', async (c) => {
  try {
    const raw = c.req.param('id');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }
    const { id, record } = resolved;
    const { password: _p, login: _l, ...safe } = record;
    return c.json({ success: true, data: { ...safe, id } });
  } catch (error) {
    console.error('Restoran (bitta) olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Restoran qo'shish
app.post('/restaurants', async (c) => {
  try {
    const body = await c.req.json();
    const restaurantId = `restaurant:${Date.now()}`;
    const bodyRec = body as Record<string, unknown>;
    
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
      coordinates: normalizeMerchantCoords(bodyRec),
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

    const resolved = await resolveRestaurantRecord(id);
    const key = resolved?.id ?? decodeURIComponent(String(id).trim());
    const existing = resolved?.record ?? (await kv.get(key));
    if (!existing || typeof existing !== 'object') {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }

    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    await purgeRemovedRestaurantR2Media(existing, updated);
    await kv.set(key, updated);

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Restoranni tahrirlashda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Restoran o'chirish (barcha taomlar — canonical va legacy kalit prefikslari bilan)
app.delete('/restaurants/:id', async (c) => {
  try {
    const rawParam = c.req.param('id');
    const resolved = await resolveRestaurantRecord(rawParam);
    const canonicalId = resolved?.id ?? decodeURIComponent(String(rawParam).trim());
    const existing = resolved?.record ?? (await kv.get(canonicalId));

    const dishes = await listDishesForRestaurant(canonicalId);
    for (const dish of dishes) {
      await purgeAllRestaurantR2Media(dish);
      await kv.del(dish.id);
    }

    const diningRooms = await listDiningRoomsForRestaurant(canonicalId);
    for (const room of diningRooms) {
      await kv.del(room.id);
    }
    const tableBookings = await listTableBookingsForRestaurant(canonicalId);
    for (const b of tableBookings) {
      await kv.del(b.id);
    }

    if (existing) await purgeAllRestaurantR2Media(existing);
    await kv.del(canonicalId);

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
    const raw = c.req.param('restaurantId');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: true, data: [] });
    }
    const dishes = await listDishesForRestaurant(resolved.id);
    const orders = await listRestaurantOrders(resolved.id);
    const enriched = attachWeeklyStatsToDishes(dishes, orders);
    return c.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Taomlarni olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Taom qo'shish
app.post('/restaurants/:restaurantId/dishes', async (c) => {
  try {
    const raw = c.req.param('restaurantId');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }
    const restaurantId = resolved.id;
    const body = await c.req.json();
    const vchk = validateVariantCommissionsForSave(body.variants, 'Taom');
    if (!vchk.ok) {
      return c.json({ success: false, error: vchk.error }, 400);
    }
    const variantsNorm = Array.isArray(body.variants)
      ? body.variants.map((v: any) => ({
          ...v,
          commission: clampPlatformCommissionPercent(v?.commission ?? v?.platformCommissionPercent),
        }))
      : [];
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
      variants: variantsNorm, // [{ name, image, price, prepTime, commission }]
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

    const mergedVariants = body.variants ?? existing.variants;
    const vchk = validateVariantCommissionsForSave(mergedVariants, 'Taom');
    if (!vchk.ok) {
      return c.json({ success: false, error: vchk.error }, 400);
    }
    const nextBody = { ...body };
    if (Array.isArray(nextBody.variants)) {
      nextBody.variants = nextBody.variants.map((v: any) => ({
        ...v,
        commission: clampPlatformCommissionPercent(v?.commission ?? v?.platformCommissionPercent),
      }));
    }

    const updated = { ...existing, ...nextBody, updatedAt: new Date().toISOString() };
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
    const prevSt = String(order.status || '').toLowerCase().trim();
    const wasTerminal = prevSt === 'cancelled' || prevSt === 'canceled' || prevSt === 'rejected';
    const terminalNow = nextStatus === 'cancelled' || nextStatus === 'rejected';
    const paidCancel =
      terminalNow && !wasTerminal && orderAppearsPaidForRestaurantCancel(order);
    const updated = {
      ...order,
      status: nextStatus,
      updatedAt: nowIso,
      ...(paidCancel ? { refundPending: true, refundRequestedAt: nowIso } : {}),
      statusHistory: [
        ...(Array.isArray(order.statusHistory) ? order.statusHistory : []),
        {
          status: nextStatus,
          timestamp: nowIso,
          note: 'Restoran tomonidan yangilandi',
        },
      ],
    };

    await persistRestaurantOrderWrite(updated, matchedKey);
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

    const deliveryZoneId = String(
      body.deliveryZone ?? body.deliveryZoneId ?? body.zoneId ?? '',
    ).trim();
    if (deliveryZoneId) {
      const zone = await kv.get(`delivery-zone:${deliveryZoneId}`);
      const evZ = businessHours.evaluateMerchantHours(zone as Record<string, unknown>, new Date());
      if (!evZ.allowed) {
        return c.json(
          {
            success: false,
            error: `Yetkazib berish zonasi hozir ochiq emas${evZ.label ? ` (ish vaqti: ${evZ.label})` : ''}.`,
            errorCode: 'outside_business_hours',
            opensAt: evZ.nextOpenIso,
          },
          409,
        );
      }
    }

    const evR = businessHours.evaluateMerchantHours(restaurant as Record<string, unknown>, new Date());
    if (!evR.allowed) {
      return c.json(
        {
          success: false,
          error: `Restoran hozir buyurtma qabul qilmaydi${evR.label ? ` (ish vaqti: ${evR.label})` : ''}.`,
          errorCode: 'outside_business_hours',
          opensAt: evR.nextOpenIso,
        },
        409,
      );
    }

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

    const pm = String(body.paymentMethod || 'cash').toLowerCase().trim();
    const bodyPaid = String(body.paymentStatus || '').toLowerCase().trim() === 'paid';
    const paymentStatus: 'pending' | 'paid' = bodyPaid ? 'paid' : 'pending';
    const wantsQr = pm === 'qr' || pm === 'qrcode';
    const paymentRequiresVerification = paymentStatus !== 'paid' && wantsQr;

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
      paymentStatus,
      paymentMethod: pm,
      paymentRequiresVerification,
      merchantPaymentQrUrl: merchantPaymentQrUrl || null,
      createdAt: new Date().toISOString(),
    };

    await kv.set(orderId, order);

    // Telegram: restoran chat + kanallarga broadcast (kuryer/tayyorlovchi).
    // Eslatma: Telegram HTML parse_mode xatolarini oldini olish uchun shared telegram helperlar escape qiladi.
    try {
      const restChat = restaurant?.telegramChatId != null ? String(restaurant.telegramChatId).trim() : '';
      if (restChat) {
        const totalPrice = Number(body.totalPrice || 0) || 0;
        const deliveryFee = Number(body.deliveryFee || 0) || 0;
        const total = Math.max(0, totalPrice + deliveryFee);

        const itemsForTelegram = (Array.isArray(body.items) ? body.items : []).map((item: any) => ({
          name: String(item?.dishName || item?.name || item?.title || 'Taom'),
          variantName: String(item?.variantName || item?.size || 'Standart'),
          quantity: Math.max(1, Number(item?.quantity || 1)),
          price: Number(item?.price || 0),
          additionalProducts: (
            Array.isArray(item?.additionalProducts)
              ? item.additionalProducts
              : Array.isArray(item?.addons)
                ? item.addons
                : Array.isArray(item?.extras)
                  ? item.extras
                  : []
          ).map((addon: any) => ({
            name: String(addon?.name || "Qo'shimcha"),
            price: Number(addon?.price || 0),
            quantity: Number(addon?.quantity || 1),
          })),
        }));

        await telegram.sendOrderNotification({
          type: 'restaurant',
          shopName: String(restaurant?.name || restaurant?.title || 'Restoran'),
          shopChatId: restChat,
          orderNumber: String(orderId.slice(-6)),
          customerName: String(body.customerName || 'Mijoz'),
          customerPhone: String(body.customerPhone || '—'),
          customerAddress: String(body.customerAddress || ''),
          items: itemsForTelegram,
          totalAmount: total,
          deliveryMethod: 'Yetkazib berish',
          paymentMethod: pm || 'cash',
          orderDate: new Date().toLocaleString('uz-UZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      } else {
        console.warn(`⚠️ Restoran ${restaurantCanonicalId} uchun telegramChatId bo‘sh — restoran chatiga yuborilmadi`);
      }
    } catch (e) {
      console.warn('[orders/restaurant] restoran telegram:', e);
    }

    // Broadcast: kuryer kanali (ARESSO buyurtma) va tayyorlovchi kanali (ARESSO tayyorlovchi)
    try {
      const totalPrice = Number(body.totalPrice || 0) || 0;
      const deliveryFee = Number(body.deliveryFee || 0) || 0;
      const total = Math.max(0, totalPrice + deliveryFee);
      const merchantName = String(restaurant?.name || restaurant?.title || 'Restoran');
      const customerAddress = String(body.customerAddress || '');

      void telegram.sendOrderBroadcastToChannel({
        audience: 'courier',
        orderType: 'food',
        orderNumber: String(orderId.slice(-6)),
        merchantName,
        customerAddress,
        totalAmount: total,
        paymentMethod: pm || 'cash',
      });
      void telegram.sendOrderBroadcastToChannel({
        audience: 'preparer',
        orderType: 'food',
        orderNumber: String(orderId.slice(-6)),
        merchantName,
        customerAddress,
        totalAmount: total,
        paymentMethod: pm || 'cash',
      });
    } catch (e) {
      console.warn('[orders/restaurant] broadcast:', e);
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

// ==================== XONALAR / JOY BRON ====================

app.get('/restaurants/:restaurantId/rooms', async (c) => {
  try {
    const raw = c.req.param('restaurantId');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: true, data: [] });
    }
    const rooms = await listDiningRoomsForRestaurant(resolved.id);
    const publicOnly = String(c.req.query('public') ?? '').trim() === '1';
    const data = publicOnly ? rooms.filter((r: any) => r?.isActive !== false) : rooms;
    /** `false` bo‘lsa mijoz ilovasida «Joy bron qilish» yashirinadi (default: yoqilgan) */
    const publicTableBookingEnabled = resolved.record?.publicTableBookingEnabled !== false;
    return c.json(
      publicOnly
        ? { success: true, data, publicTableBookingEnabled }
        : { success: true, data },
    );
  } catch (error) {
    console.error('Xonalarni olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

function sanitizeDiningRoomImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? '').trim();
    if (!/^https?:\/\//i.test(s)) continue;
    if (out.length >= 4) break;
    out.push(s);
  }
  return out;
}

app.post('/restaurants/:restaurantId/rooms', async (c) => {
  try {
    const raw = c.req.param('restaurantId');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }
    const restaurantId = resolved.id;
    const body = await c.req.json();
    const name = String(body?.name ?? '').trim();
    if (!name) {
      return c.json({ success: false, error: 'Xona nomi majburiy' }, 400);
    }
    const capacityMax = Math.min(
      200,
      Math.max(1, Math.floor(Number(body?.capacityMax ?? body?.capacity) || 4)),
    );
    const capacityMin = Math.min(
      capacityMax,
      Math.max(1, Math.floor(Number(body?.capacityMin) || 1)),
    );
    const images = sanitizeDiningRoomImages(body?.images);
    if (images.length < 2 || images.length > 4) {
      return c.json({ success: false, error: '2 dan 4 tagacha rasm URL majburiy' }, 400);
    }
    const isPaidRoom = Boolean(body?.isPaidRoom);
    const priceUzs = isPaidRoom ? Math.max(0, Math.floor(Number(body?.priceUzs) || 0)) : 0;
    if (isPaidRoom && priceUzs <= 0) {
      return c.json({ success: false, error: 'Pulik xona uchun narx (so‘m) kiriting' }, 400);
    }
    const roomId = `dining_room:${restaurantId}:${Date.now()}`;
    const bookingUnavailableRanges = sanitizeBookingUnavailableRanges(body?.bookingUnavailableRanges);
    const room = {
      id: roomId,
      restaurantId,
      name,
      description: String(body?.description ?? '').trim(),
      capacity: capacityMax,
      capacityMin,
      capacityMax,
      images,
      isPaidRoom,
      priceUzs,
      sortOrder: Math.floor(Number(body?.sortOrder) || 0),
      isActive: body?.isActive !== false,
      ...(bookingUnavailableRanges.length > 0 ? { bookingUnavailableRanges } : {}),
      createdAt: new Date().toISOString(),
    };
    await kv.set(roomId, room);
    return c.json({ success: true, data: room });
  } catch (error) {
    console.error('Xona qo‘shishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/dining-rooms/:id', async (c) => {
  try {
    const id = decodeURIComponent(String(c.req.param('id') ?? '').trim());
    const existing = await kv.get(id);
    if (!existing || String(existing.id || '') !== id || !String(id).startsWith('dining_room:')) {
      return c.json({ success: false, error: 'Xona topilmadi' }, 404);
    }
    const body = await c.req.json();
    const name = body?.name != null ? String(body.name).trim() : existing.name;
    if (!name) {
      return c.json({ success: false, error: 'Xona nomi bo‘sh bo‘lmasligi kerak' }, 400);
    }
    const exMax = Math.min(
      200,
      Math.max(1, Math.floor(Number((existing as any).capacityMax ?? (existing as any).capacity) || 4)),
    );
    const exMin = Math.min(exMax, Math.max(1, Math.floor(Number((existing as any).capacityMin) || 1)));
    const capacityMax =
      body?.capacity != null || body?.capacityMax != null
        ? Math.min(200, Math.max(1, Math.floor(Number(body.capacityMax ?? body.capacity) || exMax)))
        : exMax;
    const capacityMin =
      body?.capacityMin != null
        ? Math.min(capacityMax, Math.max(1, Math.floor(Number(body.capacityMin) || exMin)))
        : Math.min(capacityMax, exMin);
    let images: string[];
    if (body?.images != null) {
      images = sanitizeDiningRoomImages(body.images);
      if (images.length < 2 || images.length > 4) {
        return c.json({ success: false, error: '2 dan 4 tagacha rasm URL majburiy' }, 400);
      }
    } else {
      images = sanitizeDiningRoomImages((existing as any).images);
    }
    const isPaidRoom =
      body?.isPaidRoom !== undefined ? Boolean(body.isPaidRoom) : Boolean((existing as any).isPaidRoom);
    const priceUzs =
      body?.priceUzs != null
        ? Math.max(0, Math.floor(Number(body.priceUzs) || 0))
        : Math.max(0, Math.floor(Number((existing as any).priceUzs) || 0));
    if (isPaidRoom && priceUzs <= 0) {
      return c.json({ success: false, error: 'Pulik xona uchun narx (so‘m) kiriting' }, 400);
    }
    let bookingUnavailableRanges = (existing as any).bookingUnavailableRanges as unknown;
    if (body?.bookingUnavailableRanges !== undefined) {
      const sanitized = sanitizeBookingUnavailableRanges(body.bookingUnavailableRanges);
      bookingUnavailableRanges = sanitized.length > 0 ? sanitized : [];
    }
    const updated = {
      ...existing,
      name,
      description: body?.description != null ? String(body.description).trim() : existing.description,
      capacity: capacityMax,
      capacityMin,
      capacityMax,
      images,
      isPaidRoom,
      priceUzs: isPaidRoom ? priceUzs : 0,
      sortOrder:
        body?.sortOrder != null ? Math.floor(Number(body.sortOrder) || 0) : existing.sortOrder ?? 0,
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : existing.isActive !== false,
      ...(Array.isArray(bookingUnavailableRanges) && bookingUnavailableRanges.length > 0
        ? { bookingUnavailableRanges }
        : body?.bookingUnavailableRanges !== undefined
          ? { bookingUnavailableRanges: [] }
          : {}),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(id, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Xonani tahrirlashda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/dining-rooms/:id', async (c) => {
  try {
    const id = decodeURIComponent(String(c.req.param('id') ?? '').trim());
    const existing = await kv.get(id);
    if (!existing || String(existing.id || '') !== id) {
      return c.json({ success: false, error: 'Xona topilmadi' }, 404);
    }
    await kv.del(id);
    return c.json({ success: true });
  } catch (error) {
    console.error('Xonani o‘chirishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/restaurants/:restaurantId/table-bookings', async (c) => {
  try {
    const raw = c.req.param('restaurantId');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: true, data: [] });
    }
    const list = await listTableBookingsForRestaurant(resolved.id);
    const pub =
      c.req.query('public') === '1' ||
      String(c.req.query('public') || '').toLowerCase() === 'true';
    if (pub) {
      const data = list.map((b: any) => {
        const st = String(b?.status || 'pending').toLowerCase();
        return {
          id: String(b?.id || ''),
          roomId: String(b?.roomId || ''),
          roomName: String(b?.roomName || ''),
          bookingDate: String(b?.bookingDate || ''),
          bookingTime: normalizeBookingTimeSlot(b?.bookingTime),
          bookingEndTime: b?.bookingEndTime ? normalizeBookingTimeSlot(b.bookingEndTime) : '',
          partySize: Math.max(1, Math.floor(Number(b?.partySize) || 1)),
          status: st,
        };
      });
      return c.json({ success: true, data });
    }
    return c.json({ success: true, data: list });
  } catch (error) {
    console.error('Bronlarni olishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/restaurants/:restaurantId/table-bookings', async (c) => {
  try {
    const raw = c.req.param('restaurantId');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }
    const restaurantCanonicalId = resolved.id;
    const restaurant = resolved.record;
    if (restaurant?.publicTableBookingEnabled === false) {
      return c.json(
        { success: false, error: 'Bu restoran hozircha onlayn joy bron qabul qilmaydi.' },
        403,
      );
    }
    const body = await c.req.json();
    const roomId = String(body?.roomId ?? '').trim();
    if (!roomId) {
      return c.json({ success: false, error: 'Xona tanlang' }, 400);
    }
    const room = await kv.get(roomId);
    if (!room || String(room.restaurantId) !== String(restaurantCanonicalId)) {
      return c.json({ success: false, error: 'Xona topilmadi yoki bu restoranga tegishli emas' }, 404);
    }
    if (room.isActive === false) {
      return c.json({ success: false, error: 'Bu xona hozir bron qabul qilmaydi' }, 400);
    }
    const customerName = String(body?.customerName ?? '').trim();
    const customerPhone = String(body?.customerPhone ?? '').trim();
    if (!customerName || !customerPhone) {
      return c.json({ success: false, error: 'Ism va telefon majburiy' }, 400);
    }
    const bookingDate = String(body?.bookingDate ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return c.json({ success: false, error: 'Sana formati YYYY-MM-DD bo‘lishi kerak' }, 400);
    }
    const bookingTime = normalizeBookingTimeSlot(body?.bookingTime ?? '');
    if (!bookingTime) {
      return c.json({ success: false, error: 'Vaqt kiriting' }, 400);
    }
    const startMin = bookingMinutesFromSlot(bookingTime);
    if (startMin < 0) {
      return c.json({ success: false, error: 'Boshlanish vaqti noto‘g‘ri' }, 400);
    }
    let bookingEndTimeNorm = normalizeBookingTimeSlot(body?.bookingEndTime ?? '');
    let endMin: number;
    if (!bookingEndTimeNorm) {
      endMin = startMin + LEGACY_BOOKING_MINUTES;
      bookingEndTimeNorm = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    } else {
      endMin = bookingMinutesFromSlot(bookingEndTimeNorm);
    }
    if (endMin < 0) {
      return c.json({ success: false, error: 'Tugash vaqti noto‘g‘ri' }, 400);
    }
    if (endMin <= startMin) {
      return c.json({ success: false, error: 'Tugash vaqti boshlanishdan keyin bo‘lishi kerak' }, 400);
    }
    const MIN_BOOKING_SPAN = 30;
    if (endMin - startMin < MIN_BOOKING_SPAN) {
      return c.json(
        { success: false, error: `Bron kamida ${MIN_BOOKING_SPAN} daqiqa bo‘lishi kerak` },
        400,
      );
    }
    if (endMin > 24 * 60) {
      return c.json({ success: false, error: 'Noto‘g‘ri tugash vaqti' }, 400);
    }
    const roomRanges = sanitizeBookingUnavailableRanges((room as any).bookingUnavailableRanges);
    for (const r of roomRanges) {
      const ra = bookingMinutesFromSlot(r.from);
      const rb = bookingMinutesFromSlot(r.to);
      if (ra < 0 || rb < 0 || ra >= rb) continue;
      if (startMin < rb && ra < endMin) {
        return c.json(
          { success: false, error: 'Tanlangan vaqt oralig‘i restoran tomonidan yopiq' },
          400,
        );
      }
    }
    const partySize = Math.min(200, Math.max(1, Math.floor(Number(body?.partySize) || 1)));
    const notes = String(body?.notes ?? '').trim().slice(0, 500);

    const capMax = Math.min(
      200,
      Math.max(1, Math.floor(Number((room as any).capacityMax ?? (room as any).capacity) || 200)),
    );
    const capMin = Math.min(capMax, Math.max(1, Math.floor(Number((room as any).capacityMin) || 1)));
    if (partySize < capMin || partySize > capMax) {
      return c.json(
        { success: false, error: `Odamlar soni ${capMin} dan ${capMax} gacha bo‘lishi kerak` },
        400,
      );
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    if (bookingDate < todayStr) {
      return c.json({ success: false, error: 'O‘tgan kunga bron qilib bo‘lmaydi' }, 400);
    }

    const existingBookings = await listTableBookingsForRestaurant(restaurantCanonicalId);
    const slotBusy = existingBookings.some((b: any) => {
      const st = String(b?.status || 'pending').toLowerCase();
      if (st === 'cancelled' || st === 'rejected' || st === 'canceled') return false;
      if (String(b?.roomId) !== roomId || String(b?.bookingDate) !== bookingDate) return false;
      const ex = bookingIntervalFromRecord(b);
      if (!ex) return false;
      return intervalsOverlapHalfOpenMinutes(startMin, endMin, ex.start, ex.end);
    });
    if (slotBusy) {
      return c.json(
        { success: false, error: 'Bu vaqtda ushbu joy allaqachon band. Boshqa vaqt tanlang.' },
        409,
      );
    }

    const bookingId = `table_booking:${restaurantCanonicalId}:${Date.now()}`;
    const booking = {
      id: bookingId,
      restaurantId: restaurantCanonicalId,
      roomId,
      roomName: String(room.name || 'Xona'),
      customerName,
      customerPhone,
      bookingDate,
      bookingTime,
      bookingEndTime: bookingEndTimeNorm,
      partySize,
      notes,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await kv.set(bookingId, booking);

    const chatIdRaw = restaurant?.telegramChatId;
    const chatId = chatIdRaw != null ? String(chatIdRaw).trim() : '';
    const shortId = bookingId.split(':').pop() || bookingId.slice(-8);
    const roomImageUrls = Array.isArray((room as any).images)
      ? ((room as any).images as unknown[])
          .map((u) => String(u ?? '').trim())
          .filter((u) => /^https?:\/\//i.test(u))
          .slice(0, 4)
      : [];
    if (chatId) {
      await telegram.sendRestaurantTableBookingNotification({
        restaurantName: String(restaurant?.name || 'Restoran'),
        chatId,
        bookingIdShort: shortId,
        roomName: String(room.name || 'Xona'),
        customerName,
        customerPhone,
        bookingDate,
        bookingTime,
        bookingEndTime: bookingEndTimeNorm,
        partySize,
        notes,
        roomImageUrls: roomImageUrls.length ? roomImageUrls : undefined,
      });
    } else {
      console.warn(`⚠️ Restoran ${restaurantCanonicalId} — telegramChatId bo‘sh, joy bron Telegramga yuborilmadi`);
    }

    return c.json({ success: true, data: booking });
  } catch (error) {
    console.error('Joy bron yaratishda xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.patch('/table-bookings/:id/status', async (c) => {
  try {
    const id = decodeURIComponent(String(c.req.param('id') ?? '').trim());
    const { status } = await c.req.json().catch(() => ({}));
    const next = String(status || '').trim().toLowerCase();
    const allowed = new Set(['pending', 'confirmed', 'cancelled', 'rejected', 'completed']);
    if (!allowed.has(next)) {
      return c.json({ success: false, error: 'Noto‘g‘ri status' }, 400);
    }
    const existing = await kv.get(id);
    if (!existing || !String(id).startsWith('table_booking:')) {
      return c.json({ success: false, error: 'Bron topilmadi' }, 404);
    }
    const updated = {
      ...existing,
      status: next,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(id, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Bron statusida xato:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

/** Mijoz sharhlari — KV kalit: `restreviews:<canonicalRestaurantId>:<uuid>` */
function restaurantReviewKeyPrefix(canonicalRestaurantId: string): string {
  return `restreviews:${canonicalRestaurantId}:`;
}

// Restoran sharhlari (o‘qish)
app.get('/restaurants/:id/reviews', async (c) => {
  try {
    const raw = c.req.param('id');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }
    const { id } = resolved;
    const prefix = restaurantReviewKeyPrefix(id);
    const allReviews = await kv.getByPrefix(prefix);
    const sorted = (Array.isArray(allReviews) ? allReviews : []).sort(
      (a: any, b: any) =>
        new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime(),
    );
    const reviewCount = sorted.length;
    const averageRating = reviewCount
      ? Number(
          (sorted.reduce((sum: number, r: any) => sum + Number(r?.rating || 0), 0) / reviewCount).toFixed(1),
        )
      : 0;
    return c.json({ success: true, reviews: sorted, reviewCount, averageRating });
  } catch (error) {
    console.error('Restoran sharhlari:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Restoran sharhi qo‘shish (yulduzcha + matn)
app.post('/restaurants/:id/reviews', async (c) => {
  try {
    const raw = c.req.param('id');
    const resolved = await resolveRestaurantRecord(raw);
    if (!resolved) {
      return c.json({ success: false, error: 'Restoran topilmadi' }, 404);
    }
    const { id: restKey, record: restaurant } = resolved;
    const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const rating = Number(data.rating);
    const comment = String(data.comment ?? '').trim();
    const userId = String(data.userId ?? '').trim();
    const userName = String(data.userName ?? '').trim();

    if (!userId || !userName) {
      return c.json({ success: false, error: 'Sharh uchun tizimga kiring' }, 401);
    }
    if (!comment) {
      return c.json({ success: false, error: 'Sharh matnini yozing' }, 400);
    }
    if (comment.length > 500) {
      return c.json({ success: false, error: 'Sharh 500 belgidan oshmasligi kerak' }, 400);
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return c.json({ success: false, error: 'Baho 1 dan 5 gacha bo‘lishi kerak' }, 400);
    }

    const reviewId = crypto.randomUUID();
    const review = {
      id: reviewId,
      restaurantId: restKey,
      userId,
      userName,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`${restaurantReviewKeyPrefix(restKey)}${reviewId}`, review);

    const allReviews = await kv.getByPrefix(restaurantReviewKeyPrefix(restKey));
    const arr = Array.isArray(allReviews) ? allReviews : [];
    const totalRating = arr.reduce((sum: number, r: any) => sum + Number(r?.rating || 0), 0);
    const avg = arr.length ? Number((totalRating / arr.length).toFixed(1)) : 0;

    const updated = {
      ...restaurant,
      rating: avg,
      reviews: arr.length,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(restKey, updated);

    return c.json({
      success: true,
      review,
      restaurant: updated,
      message: 'Sharh qo‘shildi',
    });
  } catch (error) {
    console.error('Restoran sharhi saqlash:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;