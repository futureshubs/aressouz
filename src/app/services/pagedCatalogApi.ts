import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export type PageResult<T> = {
  success: boolean;
  products: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

function buildUrl(path: string, params: Record<string, string | number | undefined | null>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const s = String(v);
    if (!s) continue;
    usp.set(k, s);
  }
  const qs = usp.toString();
  return `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c${path}${qs ? `?${qs}` : ''}`;
}

export async function fetchPagedProducts<T>(opts: {
  region?: string;
  district?: string;
  q?: string;
  source?: 'all' | 'market' | 'shop';
  category?: string;
  priceMin?: number;
  priceMax?: number;
  ratingMin?: number;
  sortBy?: string;
  page: number;
  limit: number;
  signal?: AbortSignal;
}): Promise<PageResult<T>> {
  const url = buildUrl('/products', {
    region: opts.region,
    district: opts.district,
    q: opts.q,
    source: opts.source,
    category: opts.category,
    priceMin: opts.priceMin,
    priceMax: opts.priceMax,
    ratingMin: opts.ratingMin,
    sortBy: opts.sortBy,
    page: opts.page,
    limit: opts.limit,
  });
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    signal: opts.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(String(data?.error || `HTTP ${res.status}`));
  }
  return data as PageResult<T>;
}

export async function fetchPagedShopProducts<T>(opts: {
  shopId: string;
  region?: string;
  district?: string;
  q?: string;
  page: number;
  limit: number;
  signal?: AbortSignal;
}): Promise<PageResult<T>> {
  const url = buildUrl(`/shops/${encodeURIComponent(opts.shopId)}/products`, {
    region: opts.region,
    district: opts.district,
    q: opts.q,
    page: opts.page,
    limit: opts.limit,
  });
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    signal: opts.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(String(data?.error || `HTTP ${res.status}`));
  }
  return data as PageResult<T>;
}

export async function fetchPagedBranchProducts<T>(opts: {
  branchId?: string;
  regionId?: string;
  districtId?: string;
  includeSold?: boolean;
  q?: string;
  page: number;
  limit: number;
  signal?: AbortSignal;
}): Promise<PageResult<T>> {
  const url = buildUrl('/branch-products', {
    branchId: opts.branchId,
    regionId: opts.regionId,
    districtId: opts.districtId,
    includeSold: opts.includeSold ? 'true' : 'false',
    q: opts.q,
    page: opts.page,
    limit: opts.limit,
  });
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    signal: opts.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(String(data?.error || `HTTP ${res.status}`));
  }
  return data as PageResult<T>;
}

export async function fetchPagedRentalProducts<T>(opts: {
  region?: string;
  district?: string;
  q?: string;
  catalog?: string;
  category?: string;
  page: number;
  limit: number;
  signal?: AbortSignal;
}): Promise<PageResult<T>> {
  const url = buildUrl('/rentals/products', {
    region: opts.region,
    district: opts.district,
    q: opts.q,
    catalog: opts.catalog,
    category: opts.category,
    page: opts.page,
    limit: opts.limit,
  });
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    signal: opts.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(String(data?.error || `HTTP ${res.status}`));
  }
  return data as PageResult<T>;
}

