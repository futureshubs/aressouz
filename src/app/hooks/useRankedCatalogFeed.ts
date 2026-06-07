import { useMemo } from 'react';
import {
  rankCatalogFeed,
  type CatalogItemSignals,
  type CatalogVertical,
} from '../utils/catalogFeedRanking';

export function useRankedCatalogFeed<T>(
  items: T[],
  vertical: CatalogVertical,
  isSearchActive: boolean,
  options?: {
    getSignals?: (item: T) => CatalogItemSignals;
    recoBoostIds?: readonly string[];
    trendingBoostIds?: readonly string[];
  },
): T[] {
  const recoKey = options?.recoBoostIds?.join('\0') ?? '';
  const trendKey = options?.trendingBoostIds?.join('\0') ?? '';
  const getSignals = options?.getSignals;

  return useMemo(() => {
    if (isSearchActive || items.length <= 1) return items;
    return rankCatalogFeed(items, vertical, {
      getSignals,
      recoBoostIds: options?.recoBoostIds?.length ? new Set(options.recoBoostIds) : undefined,
      trendingBoostIds: options?.trendingBoostIds?.length ? new Set(options.trendingBoostIds) : undefined,
    });
  }, [items, vertical, isSearchActive, recoKey, trendKey, getSignals]);
}
