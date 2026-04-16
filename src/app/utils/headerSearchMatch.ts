import {
  compareMarketplaceRank,
  normalizeHeaderSearch as normalizeHeaderSearchImpl,
  scoreMarketplaceSearchLegacy,
  type MarketplaceSearchOptions,
  type RankableItemMeta,
} from './marketplaceSearch';

export type HeaderSearchSortOptions = MarketplaceSearchOptions & {
  /** Rejting, zaxira, narx — mavjud bo‘lsa skorga qo‘shiladi */
  getMeta?: (item: unknown) => RankableItemMeta | undefined;
};

export function normalizeHeaderSearch(q: string): string {
  return normalizeHeaderSearchImpl(q);
}

export function matchesHeaderSearch(
  query: string,
  parts: Array<string | number | undefined | false | null>,
  opts?: MarketplaceSearchOptions,
): boolean {
  const n = normalizeHeaderSearchImpl(query);
  if (!n) return true;
  return scoreMarketplaceSearchLegacy(query, parts, opts).matches;
}

/** @deprecated Yangi kodda scoreMarketplaceSearchLegacy ishlating */
export function headerSearchRelevanceScore(
  query: string,
  parts: Array<string | number | undefined | false | null | undefined>,
  opts?: MarketplaceSearchOptions & { meta?: RankableItemMeta },
): number {
  return scoreMarketplaceSearchLegacy(query, parts, opts).score;
}

export function sortByHeaderSearchRelevance<T>(
  items: readonly T[],
  query: string,
  getParts: (item: T) => Array<string | number | undefined | false | null | undefined>,
  opts?: HeaderSearchSortOptions,
): T[] {
  const n = normalizeHeaderSearchImpl(query);
  if (!n) return [...items];
  return [...items].sort((a, b) => {
    const ra = scoreMarketplaceSearchLegacy(query, getParts(a), {
      vertical: opts?.vertical,
      meta: opts?.getMeta?.(a),
    });
    const rb = scoreMarketplaceSearchLegacy(query, getParts(b), {
      vertical: opts?.vertical,
      meta: opts?.getMeta?.(b),
    });
    const c = compareMarketplaceRank(ra, rb);
    if (c !== 0) return c;
    const ida = String((a as { id?: unknown }).id ?? '');
    const idb = String((b as { id?: unknown }).id ?? '');
    return ida.localeCompare(idb);
  });
}

/**
 * Ro‘yxatni qisqartirmaydi: mos kelganlar va yuqori skorliqlar tepada,
 * mos kelmayotganlar pastda (do‘kon / katta katalog ro‘yxatlari uchun).
 */
export function sortAllByHeaderSearchRelevance<T>(
  items: readonly T[],
  query: string,
  getParts: (item: T) => Array<string | number | undefined | false | null | undefined>,
  opts?: HeaderSearchSortOptions,
): T[] {
  const n = normalizeHeaderSearchImpl(query);
  if (!n) return [...items];
  const scoreFor = (item: T) =>
    scoreMarketplaceSearchLegacy(query, getParts(item), {
      vertical: opts?.vertical,
      meta: opts?.getMeta?.(item),
    });
  return [...items].sort((a, b) => {
    const ra = scoreFor(a);
    const rb = scoreFor(b);
    if (ra.matches !== rb.matches) return ra.matches ? -1 : 1;
    if (!ra.matches && !rb.matches) {
      const ida = String((a as { id?: unknown }).id ?? '');
      const idb = String((b as { id?: unknown }).id ?? '');
      return ida.localeCompare(idb);
    }
    const c = compareMarketplaceRank(ra, rb);
    if (c !== 0) return c;
    const ida = String((a as { id?: unknown }).id ?? '');
    const idb = String((b as { id?: unknown }).id ?? '');
    return ida.localeCompare(idb);
  });
}
