import { getOrCreateRecoAnonymousId } from './recommendationsClient';

export type CatalogVertical =
  | 'shop'
  | 'market'
  | 'food'
  | 'rental'
  | 'service'
  | 'around'
  | 'auction'
  | 'car'
  | 'house'
  | 'property';

const ENGAGEMENT_STORAGE = 'aresso:catalog_engagement:v1';
const MAX_ENGAGEMENT_ENTRIES = 600;

interface EngagementEntry {
  v: number;
  c: number;
  t: number;
}

export interface CatalogItemSignals {
  id: string;
  categoryKey?: string;
  shopId?: string;
  rating?: number;
  reviewCount?: number;
  viewCount?: number;
  stock?: number;
  price?: number;
  createdAt?: string | number;
  totalBids?: number;
  totalParticipants?: number;
}

function engagementKey(vertical: CatalogVertical, id: string): string {
  return `${vertical}:${id}`;
}

function readEngagementStore(): Record<string, EngagementEntry> {
  try {
    const raw = localStorage.getItem(ENGAGEMENT_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, EngagementEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeEngagementStore(store: Record<string, EngagementEntry>): void {
  try {
    const keys = Object.keys(store);
    if (keys.length > MAX_ENGAGEMENT_ENTRIES) {
      keys.sort((a, b) => (store[a]?.t ?? 0) - (store[b]?.t ?? 0));
      for (let i = 0; i < keys.length - MAX_ENGAGEMENT_ENTRIES; i += 1) {
        delete store[keys[i]];
      }
    }
    localStorage.setItem(ENGAGEMENT_STORAGE, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode */
  }
}

export function recordCatalogEngagement(
  vertical: CatalogVertical,
  id: string,
  type: 'view' | 'click',
): void {
  const trimmed = String(id ?? '').trim();
  if (!trimmed) return;
  const store = readEngagementStore();
  const k = engagementKey(vertical, trimmed);
  const cur = store[k] ?? { v: 0, c: 0, t: 0 };
  if (type === 'view') cur.v += 1;
  else cur.c += 1;
  cur.t = Date.now();
  store[k] = cur;
  writeEngagementStore(store);
}

function getEngagement(vertical: CatalogVertical, id: string): EngagementEntry {
  const store = readEngagementStore();
  return store[engagementKey(vertical, id)] ?? { v: 0, c: 0, t: 0 };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dailySessionSeed(vertical: CatalogVertical): number {
  const day = new Date().toISOString().slice(0, 10);
  const anon = getOrCreateRecoAnonymousId();
  return hashSeed(`${vertical}:${day}:${anon}`);
}

export function catalogItemId(item: Record<string, unknown>): string {
  return String(item.productUuid ?? item.id ?? item.uuid ?? '').trim();
}

export function catalogShopKey(item: Record<string, unknown>): string {
  const sid =
    item.shopId ??
    item.shop_id ??
    item.branchId ??
    item.branch_id ??
    item.restaurantId;
  if (sid != null && String(sid).trim()) return String(sid).trim();
  const name = String(item.shopName ?? item.shop_name ?? '').trim();
  return name || 'unknown';
}

export function extractCatalogSignals(item: Record<string, unknown>): CatalogItemSignals {
  return {
    id: catalogItemId(item),
    categoryKey: String(item.categoryId ?? item.category ?? item.catalogId ?? 'other')
      .trim()
      .toLowerCase(),
    shopId: catalogShopKey(item),
    rating:
      Number(
        item.rating ??
          (item.likesPercent != null ? Number(item.likesPercent) / 20 : undefined),
      ) || 0,
    reviewCount:
      Number(item.reviewCount ?? item.reviews ?? item.weeklyPopularityScore ?? item.totalOrders) || 0,
    viewCount: Number(item.viewCount ?? item.views ?? item.weeklyOrderCount) || 0,
    stock: Number(item.stockQuantity ?? item.stockCount ?? item.stock) || 0,
    price: Number(item.price ?? item.currentPrice) || 0,
    createdAt: (item.createdAt ?? item.created_at) as string | number | undefined,
    totalBids: Number(item.totalBids) || 0,
    totalParticipants:
      Number(item.totalParticipants) ||
      (Array.isArray(item.participants) ? item.participants.length : 0) ||
      0,
  };
}

export function foodDishSignals(dish: {
  id?: string;
  restaurantId?: string;
  likesPercent?: number;
  weeklyPopularityScore?: number;
  weeklyOrderCount?: number;
}): CatalogItemSignals {
  return {
    id: String(dish.id ?? ''),
    shopId: dish.restaurantId,
    categoryKey: 'dish',
    rating: (Number(dish.likesPercent) || 0) / 20,
    reviewCount: Number(dish.weeklyPopularityScore) || 0,
    viewCount: Number(dish.weeklyOrderCount) || 0,
  };
}

export function auctionItemSignals(auction: {
  id?: string;
  category?: string;
  totalBids?: number;
  totalParticipants?: number;
  participants?: string[];
  currentPrice?: number;
  createdAt?: string;
}): CatalogItemSignals {
  return {
    id: String(auction.id ?? ''),
    categoryKey: String(auction.category ?? 'auction'),
    totalBids: Number(auction.totalBids) || 0,
    totalParticipants:
      Number(auction.totalParticipants) ||
      (Array.isArray(auction.participants) ? auction.participants.length : 0),
    price: Number(auction.currentPrice) || 0,
    createdAt: auction.createdAt,
  };
}

export function placeItemSignals(place: {
  id?: string;
  categoryId?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
}): CatalogItemSignals {
  return {
    id: String(place.id ?? ''),
    categoryKey: String(place.categoryId ?? place.category ?? 'place'),
    rating: Number(place.rating) || 0,
    reviewCount: Number(place.reviewCount) || 0,
  };
}

export function listingItemSignals(item: {
  id?: string;
  categoryId?: string;
  category_id?: string;
  rating?: number;
  reviews?: number;
  price?: number;
  createdAt?: string;
  year?: number;
}): CatalogItemSignals {
  return {
    id: String(item.id ?? ''),
    categoryKey: String(item.categoryId ?? item.category_id ?? 'listing'),
    rating: Number(item.rating) || 0,
    reviewCount: Number(item.reviews) || 0,
    price: Number(item.price) || 0,
    createdAt: item.createdAt,
    viewCount: Number(item.year) || 0,
  };
}

function scoreCatalogItem(
  signals: CatalogItemSignals,
  vertical: CatalogVertical,
  opts: {
    sessionSeed: number;
    recoBoost?: number;
    trendingBoost?: number;
  },
): number {
  const eng = getEngagement(vertical, signals.id);

  let score = Math.log1p(eng.v) * 14 + Math.log1p(eng.c) * 32;
  score += Math.log1p(signals.reviewCount ?? 0) * 9;
  score += (signals.rating ?? 0) * 7;
  score += Math.log1p(signals.viewCount ?? 0) * 11;
  score += Math.log1p(signals.totalBids ?? 0) * 16;
  score += Math.log1p(signals.totalParticipants ?? 0) * 9;

  if (signals.stock === 0) score -= 90;
  else if (signals.stock != null && signals.stock > 0 && signals.stock < 4) score += 3;

  const idHash = hashSeed(signals.id || 'x');
  const variety = ((idHash ^ opts.sessionSeed) % 1000) / 1000;
  score += variety * 28;

  if (signals.createdAt != null) {
    const ageMs = Date.now() - new Date(signals.createdAt).getTime();
    if (Number.isFinite(ageMs)) {
      const ageDays = ageMs / 86_400_000;
      if (ageDays < 1.5) score -= 8;
      else if (ageDays < 14) score += 4;
      else if (ageDays < 90) score += 7;
    }
  }

  score += (opts.recoBoost ?? 0) * 55;
  score += (opts.trendingBoost ?? 0) * 40;

  return score;
}

type ScoredRow<T> = {
  item: T;
  score: number;
  category: string;
  shop: string;
};

/** Do‘kon/filial bo‘yicha round-robin — bir do‘kondan ketma-ket blok bo‘lmasin */
export function interleaveCatalogByShop<T>(
  items: T[],
  getShopKey?: (item: T) => string,
): T[] {
  if (items.length <= 1) return items;
  const shopOf =
    getShopKey ??
    ((item: T) => catalogShopKey(item as Record<string, unknown>));

  const buckets = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = shopOf(item) || 'unknown';
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }
  if (order.length <= 1) return items;

  const result: T[] = [];
  let round = 0;
  while (result.length < items.length) {
    let added = false;
    for (const key of order) {
      const list = buckets.get(key);
      if (!list || round >= list.length) continue;
      result.push(list[round]);
      added = true;
      if (result.length >= items.length) break;
    }
    if (!added) break;
    round += 1;
  }
  return result;
}

function diversifyCatalogFeed<T>(scored: ScoredRow<T>[], mode: 'shop' | 'category_shop'): T[] {
  const buckets = new Map<string, ScoredRow<T>[]>();
  for (const row of scored) {
    const key = mode === 'shop' ? row.shop : `${row.category}::${row.shop}`;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const bucketKeys = [...buckets.keys()].sort(
    (a, b) => (buckets.get(b)?.[0]?.score ?? 0) - (buckets.get(a)?.[0]?.score ?? 0),
  );

  const result: T[] = [];
  let round = 0;
  while (result.length < scored.length) {
    let added = false;
    for (const key of bucketKeys) {
      const list = buckets.get(key);
      if (!list || round >= list.length) continue;
      result.push(list[round].item);
      added = true;
      if (result.length >= scored.length) break;
    }
    if (!added) break;
    round += 1;
  }
  return result;
}

export function rankCatalogFeed<T>(
  items: T[],
  vertical: CatalogVertical,
  options?: {
    getSignals?: (item: T) => CatalogItemSignals;
    recoBoostIds?: Set<string>;
    trendingBoostIds?: Set<string>;
    diversify?: boolean;
    diversifyMode?: 'shop' | 'category_shop';
  },
): T[] {
  if (items.length <= 1) return items;

  const getSignals =
    options?.getSignals ??
    ((item: T) => extractCatalogSignals(item as Record<string, unknown>));
  const sessionSeed = dailySessionSeed(vertical);
  const recoSet = options?.recoBoostIds;
  const trendSet = options?.trendingBoostIds;
  const diversifyMode =
    options?.diversifyMode ??
    (vertical === 'shop' || vertical === 'market' ? 'shop' : 'category_shop');

  const scored: ScoredRow<T>[] = items.map((item, index) => {
    const sig = getSignals(item);
    const id = sig.id || String(index);
    const recoBoost = recoSet?.has(id) ? 1 : 0;
    const trendingBoost = trendSet?.has(id) ? 1 : 0;
    const score = scoreCatalogItem(sig, vertical, { sessionSeed, recoBoost, trendingBoost });
    return {
      item,
      score,
      category: sig.categoryKey || 'other',
      shop: sig.shopId || 'unknown',
    };
  });

  scored.sort((a, b) => b.score - a.score);

  if (options?.diversify === false) return scored.map((s) => s.item);
  return diversifyCatalogFeed(scored, diversifyMode);
}

export function topCatalogFromList<T extends Record<string, unknown>>(
  catalog: T[],
  vertical: CatalogVertical,
  exclude: Set<string>,
  limit: number,
): T[] {
  const filtered = catalog.filter((p) => {
    const k = catalogItemId(p);
    return k && !exclude.has(k);
  });
  return rankCatalogFeed(filtered, vertical).slice(0, limit);
}
