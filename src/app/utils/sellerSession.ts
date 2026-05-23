export type SellerRole = 'owner' | 'cashier';

export type StoredSellerSession = {
  token: string;
  shopId: string;
  shopName: string;
  branchId: string;
  role?: SellerRole;
  staffId?: string;
  staffName?: string;
  permissions?: string[];
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
    const role: SellerRole = sessionData.role === 'cashier' ? 'cashier' : 'owner';
    return {
      token: tok,
      shopId: String(sessionData.shopId),
      shopName: String(sessionData.shopName || ''),
      branchId: String(sessionData.branchId || ''),
      role,
      staffId: sessionData.staffId ? String(sessionData.staffId) : undefined,
      staffName: sessionData.staffName ? String(sessionData.staffName) : undefined,
      permissions: Array.isArray(sessionData.permissions) ? sessionData.permissions : undefined,
    };
  } catch {
    localStorage.removeItem('sellerSession');
    return null;
  }
}

export function isSellerCashier(session: StoredSellerSession | null | undefined): boolean {
  return session?.role === 'cashier';
}

export function isSellerOwner(session: StoredSellerSession | null | undefined): boolean {
  return !session || session.role !== 'cashier';
}
