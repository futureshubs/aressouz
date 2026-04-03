import { publicAnonKey, API_BASE_URL, DEV_API_BASE_URL } from '../../../utils/supabase/info';
import { tryResolveImageFromBranchCatalog } from './branchCatalogProductImage';

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

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

/** Profil / carousel uchun KV qatoridan rasm URL */
function pickItemImageFromKvLine(it: Record<string, unknown>): string | null {
  const u = (v: unknown) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (
      s.startsWith('http') ||
      s.startsWith('//') ||
      s.startsWith('data:') ||
      s.startsWith('/')
    ) {
      return s;
    }
    return '';
  };
  const product = obj(it.product);
  const variant = obj(it.variant);
  const dish = obj(it.dishDetails);
  return (
    u(it.image) ||
    u(it.thumbnail) ||
    u(it.productImage) ||
    u(it.photo) ||
    u(it.imageUrl) ||
    u(product?.image) ||
    u(variant?.image) ||
    u(it.selectedVariantImage) ||
    u(obj(it.variantDetails)?.image) ||
    u((it.variantDetails as { imageUrl?: string })?.imageUrl) ||
    u(dish?.image) ||
    null
  );
}

function kvLineCatalogImage(it: Record<string, unknown>): string | null {
  const vd = obj(it.variantDetails);
  const variantName = String(
    it.variantName || it.selectedVariantName || vd?.name || '',
  ).trim();
  const productName = String(it.name || it.title || obj(it.product)?.name || '').trim();
  const productId = String(
    it.productUuid || it.productId || obj(it.product)?.id || '',
  ).trim();
  const variantId = String(it.selectedVariantId || '').trim();
  return tryResolveImageFromBranchCatalog({
    productId: productId || null,
    variantId: variantId || null,
    productName,
    variantName,
  });
}

function pickPrimaryProductMediaUrl(
  product: { media?: Array<Record<string, unknown>> } | null | undefined,
  variantId: string | null,
): string | null {
  const rows = Array.isArray(product?.media) ? product!.media! : [];
  const images = rows.filter((m) => {
    const type = String(m.media_type || 'image').toLowerCase();
    const url = String(m.media_url || '').trim();
    return (type === 'image' || !m.media_type) && url.length > 0;
  });
  if (images.length === 0) return null;
  if (variantId) {
    const vMatch = images.find((m) => m.variant_id && String(m.variant_id) === variantId);
    const u = vMatch && String(vMatch.media_url || '').trim();
    if (u) return u;
  }
  const primary = images.find((m) => m.is_primary === true);
  if (primary && String(primary.media_url || '').trim()) return String(primary.media_url).trim();
  const sorted = [...images].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
  );
  return String(sorted[0]?.media_url || '').trim() || null;
}

/** v2 buyurtma: birinchi guruhdagi mahsulotlardan 2 ta rasm */
function relationalOrderPreviewImageUrls(row: Record<string, unknown>): string[] {
  const groups = row.groups as Array<Record<string, unknown>> | undefined;
  const g0 = Array.isArray(groups) && groups[0] ? groups[0] : null;
  const items = (g0?.items as Array<Record<string, unknown>> | undefined) || [];
  const urls: string[] = [];
  for (const it of items.slice(0, 4)) {
    if (urls.length >= 2) break;
    const rawProduct = it.product;
    const product = Array.isArray(rawProduct)
      ? (rawProduct[0] as { media?: Array<Record<string, unknown>> } | undefined)
      : (rawProduct as { media?: Array<Record<string, unknown>> } | undefined);
    const vid = it.product_variant_id ? String(it.product_variant_id) : null;
    const fromMedia = product ? pickPrimaryProductMediaUrl(product, vid) : null;
    if (fromMedia) {
      urls.push(fromMedia);
      continue;
    }
    const fallback = pickItemImageFromKvLine(it);
    if (fallback) {
      urls.push(fallback);
      continue;
    }
    const cat = tryResolveImageFromBranchCatalog({
      productId: it.product_id != null ? String(it.product_id) : null,
      variantId: vid,
      productName: String(it.product_name || ''),
      variantName: String(it.variant_name || ''),
    });
    if (cat) urls.push(cat);
  }
  return urls;
}

function kvOrderPreviewImageUrls(o: any): string[] {
  const items = Array.isArray(o?.items) ? o.items : [];
  const urls: string[] = [];
  for (const raw of items.slice(0, 6)) {
    if (urls.length >= 2) break;
    const it = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const u = pickItemImageFromKvLine(it) || kvLineCatalogImage(it);
    if (u && !urls.includes(u)) urls.push(u);
  }
  return urls;
}

function uniquePreviewUrls(urls: string[], max = 2): string[] {
  const out: string[] = [];
  for (const u of urls) {
    const s = String(u || '').trim();
    if (!s || out.includes(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** v2 slim obyekt + xom qatorlar: katalogdan to‘ldirish */
function enrichRelationalPreviewFromRaw(
  raw: Record<string, unknown>,
  ui: Record<string, unknown>,
): Record<string, unknown> {
  let urls = uniquePreviewUrls([...(Array.isArray(ui.previewImageUrls) ? ui.previewImageUrls : [])]);
  if (urls.length >= 2) return { ...ui, previewImageUrls: urls };
  const groups = raw.groups as Array<Record<string, unknown>> | undefined;
  const g0 = Array.isArray(groups) && groups[0] ? groups[0] : null;
  const items = (g0?.items as Array<Record<string, unknown>> | undefined) || [];
  for (const it of items) {
    if (urls.length >= 2) break;
    const vid = it.product_variant_id ? String(it.product_variant_id) : null;
    const cat = tryResolveImageFromBranchCatalog({
      productId: it.product_id != null ? String(it.product_id) : null,
      variantId: vid,
      productName: String(it.product_name || ''),
      variantName: String(it.variant_name || ''),
    });
    if (cat) urls = uniquePreviewUrls([...urls, cat]);
  }
  return { ...ui, previewImageUrls: urls };
}

function mergeKvRelMarketPreview(kv: any, relUi: Record<string, unknown>): any {
  const a = uniquePreviewUrls([
    ...(Array.isArray(relUi.previewImageUrls) ? relUi.previewImageUrls : []),
    ...(Array.isArray(kv.previewImageUrls) ? kv.previewImageUrls : []),
  ]);
  let previewImageUrls = a;
  if (previewImageUrls.length < 2 && Array.isArray(kv.items)) {
    for (const raw of kv.items) {
      if (previewImageUrls.length >= 2) break;
      const it = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const u = pickItemImageFromKvLine(it) || kvLineCatalogImage(it);
      if (u) previewImageUrls = uniquePreviewUrls([...previewImageUrls, u]);
    }
  }
  return {
    ...kv,
    ...relUi,
    previewImageUrls,
    items: kv.items ?? relUi.items,
  };
}

function relationalOrderToUi(row: Record<string, unknown>) {
  const groups = row.groups as Array<Record<string, unknown>> | undefined;
  const g0 = Array.isArray(groups) && groups[0] ? groups[0] : null;
  const vertical = String(g0?.vertical_type || 'market');
  const uiStatus = mapRelationalOrderStatus(String(row.status || ''));
  const statusLabel =
    uiStatus === 'completed' ? 'Yakunlangan' : uiStatus === 'cancelled' ? 'Bekor qilingan' : 'Faol';
  const previewImageUrls = relationalOrderPreviewImageUrls(row);
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
    previewImageUrls,
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
  const kvById = new Map<string, any>();
  for (const row of data.orders || []) {
    const o = normalizeKvOrderForProfile(row);
    kvById.set(String(o.id), {
      ...o,
      previewImageUrls: kvOrderPreviewImageUrls(o),
    });
  }

  let list: any[] = [];

  try {
    const v2res = await fetch(`${base}/v2/orders?limit=50`, { headers });
    if (v2res.ok) {
      const v2json = await v2res.json();
      const v2raw = Array.isArray(v2json.items) ? v2json.items : [];
      for (const r of v2raw) {
        const row = r as Record<string, unknown>;
        let ui = relationalOrderToUi(row) as Record<string, unknown>;
        ui = enrichRelationalPreviewFromRaw(row, ui);
        const id = String(ui.id);
        const kv = kvById.get(id);
        if (kv) {
          kvById.delete(id);
          list.push(mergeKvRelMarketPreview(kv, ui));
        } else {
          list.push(ui);
        }
      }
    }
  } catch {
    /* ignore */
  }

  for (const kv of kvById.values()) {
    list.push(kv);
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
