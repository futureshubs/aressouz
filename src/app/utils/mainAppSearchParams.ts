/** Asosiy ilova (/) URL kalitlari — Android/PWA orqaga tugmasi uchun tarix. */

export const MAIN_APP_QUERY = {
  tab: 'tab',
  cart: 'cart',
  profile: 'profile',
  checkout: 'checkout',
  auth: 'auth',
  product: 'product',
  rterms: 'rterms',
  view: 'view',
  cat: 'cat',
  subcat: 'subcat',
} as const;

export const MAIN_VALID_TABS = new Set([
  'market',
  'dokon',
  'market-oziq',
  'taomlar',
  'atrof',
  'mashinalar',
  'ijara',
  'xizmatlar',
  'xonalar',
  'mening-uyim',
  'bonus',
  'community',
  'auksion',
  'moshina',
  'profil',
]);

export function isValidMainTab(tab: string | null | undefined): tab is string {
  return !!tab && MAIN_VALID_TABS.has(tab);
}

export type MainAppParsedSearch = {
  tab: string;
  cart: boolean;
  profile: boolean;
  checkout: boolean;
  auth: boolean;
  productKey: string | null;
  rterms: boolean;
  view: 'products' | 'catalog';
  catalogId: string | null;
  categoryId: string | null;
};

export function parseMainAppSearch(sp: URLSearchParams): MainAppParsedSearch {
  const tabRaw = sp.get(MAIN_APP_QUERY.tab);
  const tab = isValidMainTab(tabRaw) ? tabRaw : 'market';
  const v = sp.get(MAIN_APP_QUERY.view);
  const view: 'products' | 'catalog' = v === 'catalog' ? 'catalog' : 'products';
  /** Eski ulashish havolalari: ?productId=… — asosiy kalit `product` */
  const productKey =
    sp.get(MAIN_APP_QUERY.product)?.trim() ||
    sp.get('productId')?.trim() ||
    null;
  /** Eski: ?catalogId=… — asosiy `cat` */
  const catalogId =
    sp.get(MAIN_APP_QUERY.cat)?.trim() || sp.get('catalogId')?.trim() || null;
  return {
    tab,
    cart: sp.get(MAIN_APP_QUERY.cart) === '1',
    profile: sp.get(MAIN_APP_QUERY.profile) === '1',
    checkout: sp.get(MAIN_APP_QUERY.checkout) === '1',
    auth: sp.get(MAIN_APP_QUERY.auth) === '1',
    productKey,
    rterms: sp.get(MAIN_APP_QUERY.rterms) === '1',
    view,
    catalogId,
    categoryId: sp.get(MAIN_APP_QUERY.subcat)?.trim() || null,
  };
}

/** Mavjud qidiruvdan nusxa; null/undefined bo‘sh kalit sifatida olib tashlanadi. */
export function patchSearchParams(
  current: URLSearchParams,
  patch: Record<string, string | null | undefined>,
): URLSearchParams {
  const p = new URLSearchParams(current);
  for (const [key, val] of Object.entries(patch)) {
    if (val === null || val === undefined || val === '') p.delete(key);
    else p.set(key, val);
  }
  return p;
}

export function searchParamsToString(p: URLSearchParams): string {
  const s = p.toString();
  return s ? `?${s}` : '';
}
