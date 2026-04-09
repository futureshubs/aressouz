export type StoredSellerSession = {
  token: string;
  shopId: string;
  shopName: string;
  branchId: string;
};

/**
 * localStorage `sellerSession` — token formati server bilan mos (seller-..., eski seller-shop- emas).
 * Noto‘g‘ri bo‘lsa kalitni o‘chirib null qaytaradi.
 */
export function readValidSellerSession(): StoredSellerSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('sellerSession');
  if (!raw) return null;
  try {
    const sessionData = JSON.parse(raw) as Partial<StoredSellerSession>;
    const tok = String(sessionData?.token || '');
    if (!tok.startsWith('seller-') || tok.includes('seller-shop-')) {
      localStorage.removeItem('sellerSession');
      return null;
    }
    const tokenParts = tok.split('-');
    if (tokenParts.length < 3 || tokenParts[0] !== 'seller') {
      localStorage.removeItem('sellerSession');
      return null;
    }
    if (!sessionData.shopId) {
      localStorage.removeItem('sellerSession');
      return null;
    }
    return {
      token: tok,
      shopId: String(sessionData.shopId),
      shopName: String(sessionData.shopName || ''),
      branchId: String(sessionData.branchId || ''),
    };
  } catch {
    localStorage.removeItem('sellerSession');
    return null;
  }
}
