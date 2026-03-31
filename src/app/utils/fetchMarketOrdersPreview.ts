import { publicAnonKey, API_BASE_URL, DEV_API_BASE_URL } from '../../../utils/supabase/info';

function apiBaseUrl(): string {
  if (typeof window === 'undefined') return API_BASE_URL;
  return window.location.hostname === 'localhost' ? DEV_API_BASE_URL : API_BASE_URL;
}

function mapRelationalVerticalToCategory(
  v: string,
): 'market' | 'shop' | 'rent' | 'food' | 'auction' {
  const x = (v || '').toLowerCase();
  if (x === 'shop') return 'shop';
  if (x === 'food') return 'food';
  if (x === 'rental' || x === 'property' || x === 'place') return 'rent';
  if (x === 'vehicle' || x === 'auction') return 'auction';
  return 'market';
}

function mapRelationalOrderStatus(s: string): 'active' | 'completed' | 'cancelled' {
  const x = (s || '').toLowerCase();
  if (['cancelled', 'refunded', 'partially_refunded', 'rejected'].includes(x)) return 'cancelled';
  if (['fulfilled', 'confirmed', 'split'].includes(x)) return 'completed';
  return 'active';
}

function normalizeKvOrderForProfile(o: any) {
  if (!o || o.relational) return o;
  const s = String(o.status || '').toLowerCase().trim();
  let orderStatus: 'active' | 'completed' | 'cancelled' = 'active';
  if (s === 'cancelled' || s === 'canceled' || s === 'rejected') orderStatus = 'cancelled';
  else if (s === 'delivered' || s === 'completed') orderStatus = 'completed';
  const statusLabel =
    s === 'awaiting_receipt'
      ? 'Kuryer topshirdi — tekshiring'
      : s === 'delivered'
        ? 'Yetkazildi'
        : s === 'cancelled' || s === 'canceled' || s === 'rejected'
          ? 'Bekor qilingan'
          : typeof o.status === 'string' && o.status.trim()
            ? o.status
            : 'Jarayonda';
  return {
    ...o,
    orderStatus,
    status: statusLabel,
    awaitingCustomerReceipt: s === 'awaiting_receipt',
  };
}

function relationalOrderToUi(row: Record<string, unknown>) {
  const groups = row.groups as Array<Record<string, unknown>> | undefined;
  const g0 = Array.isArray(groups) && groups[0] ? groups[0] : null;
  const vertical = String(g0?.vertical_type || 'market');
  const uiStatus = mapRelationalOrderStatus(String(row.status || ''));
  const statusLabel =
    uiStatus === 'completed' ? 'Yakunlangan' : uiStatus === 'cancelled' ? 'Bekor qilingan' : 'Faol';
  return {
    id: row.id,
    orderNumber: row.order_number,
    orderStatus: uiStatus,
    status: statusLabel,
    category: mapRelationalVerticalToCategory(vertical),
    total: row.total_amount,
    createdAt: row.created_at,
    currency_code: row.currency_code,
    item_count: row.item_count,
    relational: true as const,
  };
}

export function isMarketOrderRow(o: any): boolean {
  if (!o || o.rentalKv) return false;
  if (o.relational) return o.category === 'market';
  const t = String(o.orderType || '').toLowerCase();
  return t === 'market';
}

/** Market header ostidagi carousel: faqat jarayondagi (yangi / yo‘lda); yetkazilgan va bekor qilingan emas */
export function isMarketOrderActiveForPreviewStrip(o: any): boolean {
  if (!o) return false;
  if (o.orderStatus === 'completed' || o.orderStatus === 'cancelled') return false;
  return true;
}

/** Profil bilan bir xil KV + v2 birlashtirish, faqat market buyurtmalar */
export async function fetchMarketOrdersForPreview(accessToken: string): Promise<any[]> {
  if (!accessToken) return [];
  const base = apiBaseUrl();
  const headers = {
    Authorization: `Bearer ${publicAnonKey}`,
    apikey: publicAnonKey,
    'X-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${base}/orders`, { headers });
  if (!response.ok) return [];

  const data = await response.json().catch(() => ({}));
  let list: any[] = (data.orders || []).map((row: any) => normalizeKvOrderForProfile(row));

  try {
    const v2res = await fetch(`${base}/v2/orders?limit=50`, { headers });
    if (v2res.ok) {
      const v2json = await v2res.json();
      const v2items = Array.isArray(v2json.items)
        ? v2json.items.map((r: Record<string, unknown>) => relationalOrderToUi(r))
        : [];
      const ids = new Set(list.map((o: any) => String(o.id)));
      for (const o of v2items) {
        if (!ids.has(String(o.id))) {
          ids.add(String(o.id));
          list.unshift(o);
        }
      }
    }
  } catch {
    /* ignore */
  }

  list = list.filter(isMarketOrderRow);
  list = list.filter(isMarketOrderActiveForPreviewStrip);
  list.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
  return list.slice(0, 12);
}

export function formatOrderTimeAgoUz(iso: string | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'hozirgina';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} kun oldin`;
  return new Date(iso).toLocaleDateString('uz-UZ');
}
