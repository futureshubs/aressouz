import { projectId } from '../../../utils/supabase/info';
import { buildUserHeaders } from './requestAuth';

export type QuickOrderType = 'market' | 'shop' | 'food' | 'rental';

function formatProfilePhone(phone: string): string {
  let p = phone.replace(/[\s+]/g, '');
  if (p.startsWith('998')) {
    p = `+${p}`;
  } else if (p && !p.startsWith('+998')) {
    p = `+998${p}`;
  }
  return p;
}

function lineUnitPrice(item: any): number {
  const basePrice = Number(item?.variantDetails?.price) || Number(item?.price) || 0;
  const addonsTotal =
    item?.addons?.reduce((sum: number, addon: any) => {
      return sum + (Number(addon.price) || 0) * (Number(addon.quantity) || 1);
    }, 0) || 0;
  return basePrice + addonsTotal;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** KV `branchproduct:${id}` — UUID yoki `prod_<timestamp>` va shu kabi kalitlar */
export function isBranchProductStorageId(value: unknown): boolean {
  const t = String(value ?? '').trim();
  if (t.length < 4 || t.length > 160) return false;
  if (UUID_RE.test(t)) return true;
  if (/^prod_\d+$/i.test(t)) return true;
  return /^[a-zA-Z][a-zA-Z0-9_-]{3,120}$/.test(t);
}

/**
 * Server `resolveMarketCartBranchProductStorageId` — filial mahsuloti uchun UUID.
 */
export function isShopProductCartLine(item: any): boolean {
  if (String(item?.source || '').toLowerCase().trim() === 'shop') return true;
  const pid = String(item?.id ?? item?.productId ?? '').trim();
  if (!pid) return false;
  if (pid.startsWith('shop_product:')) return true;
  return pid.startsWith('shop_product-');
}

/** AppContent `stringToNumber(bp.id)` bilan bir xil — katalog UUID ni qayta topish uchun */
function hashStringToPositiveInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Savatda `productUuid` bo‘lmasa ham (eski savat / JSON), `localStorage.products`
 * dagi filial mahsulotidan hash(id) + branchId bo‘yicha UUID tiklanadi.
 */
function resolveBranchProductUuid(item: any): string {
  const direct = String(item?.productUuid ?? item?.product?.productUuid ?? '').trim();
  if (direct && isBranchProductStorageId(direct)) return direct;
  if (isShopProductCartLine(item)) return '';

  try {
    if (typeof localStorage === 'undefined') return '';
    const raw = localStorage.getItem('products');
    if (!raw) return '';
    const arr = JSON.parse(raw) as { id?: string; branchId?: string }[];
    if (!Array.isArray(arr)) return '';
    const idNum = Number(item?.id);
    if (!Number.isFinite(idNum)) return '';
    const bid = item?.branchId ? String(item.branchId).trim() : '';

    for (const bp of arr) {
      if (!bp?.id) continue;
      const bidBp = String(bp.branchId ?? '').trim();
      if (bid && bidBp && bid !== bidBp) continue;
      const hid = hashStringToPositiveInt(String(bp.id));
      if (hid !== idNum) continue;
      const u = String(bp.id).trim();
      return isBranchProductStorageId(u) ? u : '';
    }
  } catch {
    /* ignore */
  }
  return '';
}

/** Checkout va tezkor buyurtma uchun serverga mos qatorlar */
export function mapCartItemsForOrdersApi(cartItems: any[]): Record<string, unknown>[] {
  return cartItems.map((item: any) => buildOrderLine(item));
}

/** Bozor qatorlarida katalog ID (UUID / prod_*) bo‘lmasa — xabar */
export function getMarketCartCatalogIdError(cartItems: any[]): string | null {
  const lines = mapCartItemsForOrdersApi(cartItems);
  for (let i = 0; i < cartItems.length; i++) {
    if (isShopProductCartLine(cartItems[i])) continue;
    const row = lines[i] as { productUuid?: string };
    const u = String(row?.productUuid ?? '').trim();
    if (!isBranchProductStorageId(u)) {
      return (
        'Mahsulot katalog ID topilmadi. Asosiy sahifaga kirib mahsulotlarni yangilang yoki savatni tozalab qayta qo‘shing.'
      );
    }
  }
  return null;
}

function buildOrderLine(item: any): Record<string, unknown> {
  const unit = lineUnitPrice(item);
  const uuid = resolveBranchProductUuid(item);
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  const variantSel = item?.selectedVariantId != null ? String(item.selectedVariantId) : '';
  const vMatch = variantSel
    ? variants.find((x: { id?: string }) => String(x?.id ?? '') === variantSel)
    : null;
  const vm = vMatch as { image?: string; images?: string[] } | undefined;
  const fromVariant =
    String(vm?.image || '').trim() || String(vm?.images?.[0] || '').trim();
  const lineImage = String(item?.image || '').trim() || fromVariant;
  const line: Record<string, unknown> = {
    id: item.id,
    productId: uuid || item.id,
    quantity: item.quantity || 1,
    price: unit,
    selectedVariantId: item.selectedVariantId,
    name: item.name,
  };
  if (lineImage) {
    line.image = lineImage;
  }
  if (uuid) {
    line.productUuid = uuid;
  }
  if (item.branchId) line.branchId = item.branchId;
  const src = String(item?.source ?? '').trim();
  if (src) line.source = src;
  const shopIdStr = String(item.shopId ?? item.product?.shopId ?? item.product?.shop_id ?? '').trim();
  if (shopIdStr) line.shopId = shopIdStr;
  if (item.restaurantId) line.restaurantId = item.restaurantId;
  if (item.dishId) line.dishId = item.dishId;
  if (item.dishDetails) line.dishDetails = item.dishDetails;
  if (item.variantDetails) line.variantDetails = item.variantDetails;
  if (item.addons) line.addons = item.addons;
  return line;
}

/**
 * Checkout modali siz — oddiy savat buyurtmasi (market / shop / food).
 */
export async function submitRegularCartOrderQuick(params: {
  cartItems: any[];
  totalAmount: number;
  orderType: QuickOrderType;
  customerName: string;
  customerPhone: string;
}): Promise<{ ok: true; orderId?: string } | { ok: false; error: string }> {
  const { cartItems, totalAmount, orderType, customerName, customerPhone } = params;
  const name = String(customerName || '').trim();
  const phone = formatProfilePhone(String(customerPhone || '').trim());

  if (!cartItems.length) {
    return { ok: false, error: 'Savat bo‘sh' };
  }
  if (!name) {
    return { ok: false, error: 'Profilda ism ko‘rsatilmagan' };
  }
  if (!phone) {
    return { ok: false, error: 'Profilda telefon ko‘rsatilmagan' };
  }

  const items = mapCartItemsForOrdersApi(cartItems);

  const deliveryPrice = 0;
  const finalTotal = totalAmount + deliveryPrice;

  const branchIdFromCart = cartItems.find((i: any) => i?.branchId)?.branchId as string | undefined;

  /** Server `index.ts` `data.address` va `finalTotal` ishlatadi (deliveryAddress emas). */
  const orderData: Record<string, unknown> = {
    customerName: name,
    customerPhone: phone,
    items,
    address: {
      street: 'Telefon orqali aniqlanadi',
      building: '—',
      apartment: '',
      note: 'Mobil ilova: manzil operator bilan kelishiladi',
    },
    addressType: 'manual',
    paymentMethod: 'cash',
    useBonus: false,
    totalAmount,
    deliveryPrice,
    finalTotal,
    orderType,
  };

  if (branchIdFromCart) {
    orderData.branchId = branchIdFromCart;
  }

  if (orderType === 'market') {
    const catalogErr = getMarketCartCatalogIdError(cartItems);
    if (catalogErr) return { ok: false, error: catalogErr };
  }

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders`,
    {
      method: 'POST',
      headers: buildUserHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(orderData),
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    id?: string;
    orderId?: string;
    error?: string;
  };

  if (!res.ok || !data.success) {
    return {
      ok: false,
      error: typeof data.error === 'string' ? data.error : 'Buyurtmani yuborib bo‘lmadi',
    };
  }

  const orderId = data.orderId || data.id;
  return { ok: true, orderId };
}
