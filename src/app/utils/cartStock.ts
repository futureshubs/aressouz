/**
 * Client-side stock checks so users cannot checkout when items are out of stock
 * or when cart quantity exceeds available stock (market / shop / food / rental flags).
 */

function tryNonNegativeInt(...raw: unknown[]): number | null {
  for (const x of raw) {
    if (x === null || x === undefined || x === '') continue;
    const n = typeof x === 'number' ? x : Number(x);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

/**
 * Bitta variant uchun qoldiq (market: `stockQuantity`, do‘kon: `stock` / `stockCount`).
 * Bir nechta variant bo‘lsa **mahsulot** darajasidagi `stockCount` / `stockQuantity` ishlatilmasin —
 * aks holda barcha qatorlar birinchi variant zaxirasiga yopishib, bittasi tugasa hammasi «Tugadi» bo‘ladi.
 */
export function getVariantStockQuantity(variant: unknown, product: unknown): number {
  const p = product as Record<string, unknown> | undefined;
  const variantList = Array.isArray(p?.variants) ? p!.variants : [];
  const multiVariant = variantList.length > 1;

  if (variant == null) {
    return tryNonNegativeInt(p?.stockQuantity, p?.stockCount, p?.stock) ?? 0;
  }

  const v = variant as Record<string, unknown>;
  const fromVariant = tryNonNegativeInt(v.stock, v.stockQuantity, v.stockCount);
  if (fromVariant !== null) return fromVariant;

  if (!multiVariant) {
    return tryNonNegativeInt(p?.stockQuantity, p?.stockCount, p?.stock) ?? 0;
  }

  return 0;
}

/**
 * API ba'zan mahsulot darajasida `stockQuantity` bermaydi yoki 0 qaytaradi, lekin
 * variantlarda `stock` / `stockQuantity` bo‘ladi — ro‘yxat va tugmalar uchun jami qoldiq.
 */
export function getEffectiveProductStockQuantity(product: any): number {
  if (!product) return 0;
  const level = Number(product.stockQuantity ?? product.stockCount ?? product.stock);
  if (Number.isFinite(level) && level > 0) {
    return Math.max(0, Math.floor(level));
  }
  const variants = Array.isArray(product.variants) ? product.variants : [];
  let sum = 0;
  for (const v of variants) {
    const n = Number(v?.stock ?? v?.stockQuantity ?? v?.stockCount);
    if (Number.isFinite(n) && n > 0) sum += Math.floor(n);
  }
  return sum;
}

export function isFoodCartItem(item: any): boolean {
  return Boolean(
    item?.restaurantId ||
      item?.dishDetails ||
      item?.catalogId === 'foods' ||
      item?.categoryId === 'taomlar' ||
      item?.dishId,
  );
}

/**
 * Max units allowed for this line. null = no numeric cap (legacy / API without stock).
 * 0 = nothing left to sell.
 */
export function getMaxOrderableUnits(item: any): number | null {
  if (!item) return null;

  if (item.available === false || item.inStock === false || item.isAvailable === false) {
    return 0;
  }

  if (isFoodCartItem(item)) {
    const sq = Number(
      item.stockQuantity ?? item.stockCount ?? item.dishDetails?.stockQuantity ?? NaN,
    );
    if (Number.isFinite(sq) && sq >= 0) return Math.floor(sq);
    return null;
  }

  const vid = item.selectedVariantId;
  const variants = Array.isArray(item.variants) ? item.variants : [];
  const v = vid
    ? variants.find((x: any) => String(x?.id) === String(vid))
    : null;
  const fromVariant =
    v != null ? Number(v?.stockQuantity ?? v?.stockCount ?? v?.stock ?? NaN) : NaN;
  if (Number.isFinite(fromVariant) && fromVariant >= 0) return Math.floor(fromVariant);

  const itemStock = Number(item.stockQuantity ?? item.stockCount ?? item.stock ?? NaN);
  if (Number.isFinite(itemStock) && itemStock >= 0) return Math.floor(itemStock);

  return null;
}

export function getRegularCartStockIssues(items: any[]): string[] {
  const issues: string[] = [];
  for (const item of items) {
    const name = String(item?.name || 'Mahsulot');
    const qty = Number(item?.quantity) || 0;
    if (qty <= 0) continue;

    const max = getMaxOrderableUnits(item);
    if (max === null) continue;
    if (max <= 0) issues.push(`${name}: Mahsulot tugagan`);
    else if (qty > max) issues.push(`${name}: Omborda faqat ${max} ta qoldi`);
  }
  return issues;
}

export type RentalCartLine = { item: { name?: string; available?: boolean } };

export function getRentalCartStockIssues(rentalItems: RentalCartLine[]): string[] {
  const issues: string[] = [];
  for (const line of rentalItems) {
    const name = String(line?.item?.name || 'Ijara');
    if (line?.item?.available === false) {
      issues.push(`${name}: Mahsulot tugagan`);
    }
    if (typeof line?.item?.available === 'number' && line.item.available <= 0) {
      issues.push(`${name}: Mahsulot mavjud emas`);
    }
  }
  return issues;
}

export function canAddQuantity(
  product: any,
  variantId: string | undefined,
  currentCartQty: number,
  addQty: number,
): { ok: true } | { ok: false; message: string } {
  const probe = { ...product, selectedVariantId: variantId, quantity: 1 };
  const max = getMaxOrderableUnits(probe);
  if (max === null) return { ok: true };
  if (max <= 0) return { ok: false, message: 'Mahsulot tugagan' };
  const next = currentCartQty + addQty;
  if (next > max) return { ok: false, message: `Omborda faqat ${max} ta qoldi` };
  return { ok: true };
}

export function canSetQuantity(
  item: any,
  newQuantity: number,
): { ok: true } | { ok: false; message: string } {
  const probe = { ...item, quantity: newQuantity };
  const max = getMaxOrderableUnits(probe);
  if (max === null) return { ok: true };
  if (newQuantity <= 0) return { ok: true };
  if (max <= 0) return { ok: false, message: 'Mahsulot tugagan' };
  if (newQuantity > max) return { ok: false, message: `Omborda faqat ${max} ta qoldi` };
  return { ok: true };
}
