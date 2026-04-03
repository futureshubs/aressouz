/**
 * Aralash savat: market / do‘kon / taom — har biri alohida buyurtma (kuryer bittada hammasini olmasin).
 */

export type FulfillmentKind = 'market' | 'shop' | 'food';

export type CheckoutFulfillmentGroup = {
  kind: FulfillmentKind;
  items: any[];
};

export function isFoodCartItem(item: any): boolean {
  return Boolean(
    item?.restaurantId ||
      item?.dishDetails ||
      item?.catalogId === 'foods' ||
      item?.categoryId === 'taomlar' ||
      item?.dishDetails?.restaurantName ||
      item?.dishId,
  );
}

export function isShopCartItem(item: any): boolean {
  if (isFoodCartItem(item)) return false;
  const source = String(item?.source || '').toLowerCase().trim();
  const rawId = String(item?.id ?? item?.productId ?? '').trim();
  const looksLikeShopProduct =
    rawId.startsWith('shop_product-') || rawId.startsWith('shop_product:');
  return Boolean(
    looksLikeShopProduct ||
      item?.shopId ||
      item?.product?.shopId ||
      item?.shop?.id ||
      source === 'shop',
  );
}

export function splitCartIntoFulfillmentGroups(cartItems: any[]): CheckoutFulfillmentGroup[] {
  const food: any[] = [];
  const shop: any[] = [];
  const market: any[] = [];
  for (const item of cartItems || []) {
    if (isFoodCartItem(item)) food.push(item);
    else if (isShopCartItem(item)) shop.push(item);
    else market.push(item);
  }
  const out: CheckoutFulfillmentGroup[] = [];
  if (market.length) out.push({ kind: 'market', items: market });
  if (shop.length) out.push({ kind: 'shop', items: shop });
  if (food.length) out.push({ kind: 'food', items: food });
  return out;
}

/** Checkout.tsx bilan bir xil qator narxi */
export function cartLineSubtotal(item: any): number {
  const basePrice = Number(item?.variantDetails?.price) || Number(item?.price) || 0;
  const addonsTotal =
    (Array.isArray(item?.addons)
      ? item.addons.reduce(
          (s: number, a: any) => s + (Number(a?.price) || 0) * (Number(a?.quantity) || 1),
          0,
        )
      : 0) +
    (Array.isArray(item?.additionalProducts)
      ? item.additionalProducts.reduce(
          (s: number, a: any) => s + (Number(a?.price) || 0) * (Number(a?.quantity || a?.count) || 1),
          0,
        )
      : 0);
  const perUnit = basePrice + addonsTotal;
  return perUnit * (Number(item?.quantity) || 0);
}

export function sumGroupSubtotal(items: any[]): number {
  return (items || []).reduce((s, it) => s + cartLineSubtotal(it), 0);
}
