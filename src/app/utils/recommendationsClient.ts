import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const RECO_ANON_STORAGE = 'reco_anonymous_id_v1';

const apiBase = () =>
  `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

export type RecoEventType =
  | 'view'
  | 'search'
  | 'favorite_add'
  | 'favorite_remove'
  | 'cart_add'
  | 'purchase';

export interface RecoEventInput {
  type: RecoEventType;
  productId?: string;
  categoryId?: string;
  shopId?: string;
  title?: string;
  price?: number;
  query?: string;
  source?: string;
  ts?: number;
}

export function getOrCreateRecoAnonymousId(): string {
  try {
    const existing = localStorage.getItem(RECO_ANON_STORAGE);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    localStorage.setItem(RECO_ANON_STORAGE, id);
    return id;
  } catch {
    return '00000000-0000-4000-8000-000000000001';
  }
}

function recoAuthHeaders(accessToken: string | null | undefined): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${publicAnonKey}`,
  };
  const t = accessToken != null ? String(accessToken).trim() : '';
  if (t.length > 8) {
    h['X-Access-Token'] = t;
  }
  return h;
}

/** Foydalanuvchi qiziqishi — serverda KV `reco_log:v1:` */
export async function postRecoEvents(
  events: RecoEventInput[],
  accessToken: string | null | undefined,
): Promise<void> {
  if (!events.length) return;
  const anonymousId = getOrCreateRecoAnonymousId();
  try {
    await fetch(`${apiBase()}/recommendations/events`, {
      method: 'POST',
      headers: {
        ...recoAuthHeaders(accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ anonymousId, events }),
    });
  } catch {
    /* tarmoq xatosi — sessiyani buzmaymiz */
  }
}

export function productToRecoPayload(product: Record<string, unknown>): RecoEventInput {
  const cat = String(product.categoryId ?? product.category ?? '')
    .trim()
    .toLowerCase();
  return {
    type: 'view',
    productId: String(product.id ?? ''),
    categoryId: cat || undefined,
    shopId: product.shopId != null ? String(product.shopId) : undefined,
    price: Number(product.price) > 0 ? Number(product.price) : undefined,
    title: String(product.name ?? '').slice(0, 200),
    source: String(product.source ?? ''),
  };
}

export function cartRecoPayload(product: Record<string, unknown>): RecoEventInput {
  return { ...productToRecoPayload(product), type: 'cart_add' };
}

export async function fetchPersonalizedProducts(
  accessToken: string | null | undefined,
  opts: { region?: string; district?: string; limit?: number; excludeId?: string },
): Promise<unknown[]> {
  const anonymousId = getOrCreateRecoAnonymousId();
  const params = new URLSearchParams();
  params.set('anonymousId', anonymousId);
  if (opts.region) params.set('region', opts.region);
  if (opts.district) params.set('district', opts.district);
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.excludeId) params.set('excludeId', opts.excludeId);
  try {
    const res = await fetch(`${apiBase()}/recommendations?${params}`, {
      method: 'GET',
      headers: recoAuthHeaders(accessToken),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: unknown[] };
    return Array.isArray(data.products) ? data.products : [];
  } catch {
    return [];
  }
}
