function lineIsFood(item: any): boolean {
  return Boolean(
    item?.restaurantId ||
      item?.dishDetails ||
      item?.catalogId === 'foods' ||
      item?.categoryId === 'taomlar' ||
      item?.dishDetails?.restaurantName ||
      item?.dishId,
  );
}

function lineIsShop(item: any): boolean {
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

/**
 * Checkout UI uchun orderType. Aralash savatda `mixed` — serverga har tur alohida buyurtma ketadi.
 */
export function deriveCheckoutOrderType(
  cartItems: any[],
  rentalLineCount: number,
): 'market' | 'shop' | 'food' | 'rental' | 'mixed' {
  const hasFood = cartItems.some(lineIsFood);
  const hasShop = cartItems.some(lineIsShop);
  const hasMarket = cartItems.some((item: any) => !lineIsFood(item) && !lineIsShop(item));

  const typeCount = [hasFood, hasShop, hasMarket].filter(Boolean).length;
  if (typeCount > 1) return 'mixed';

  if (hasFood) return 'food';
  if (hasShop) return 'shop';
  if (cartItems.length > 0) return 'market';
  if (rentalLineCount > 0) return 'rental';

  return 'market';
}
