/**
 * Checkout POST uchun orderType — Cart / AppContent bilan bir xil mantiq.
 */
export function deriveCheckoutOrderType(
  cartItems: any[],
  rentalLineCount: number,
): 'market' | 'shop' | 'food' | 'rental' {
  const hasFood = cartItems.some((item: any) => {
    return Boolean(
      item?.restaurantId ||
        item?.dishDetails ||
        item?.catalogId === 'foods' ||
        item?.categoryId === 'taomlar' ||
        item?.dishDetails?.restaurantName ||
        item?.dishId,
    );
  });

  if (hasFood) return 'food';

  const hasShopItems = cartItems.some((item: any) => {
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
  });

  if (hasShopItems) return 'shop';

  if (cartItems.length > 0) return 'market';

  if (rentalLineCount > 0) return 'rental';

  return 'market';
}
