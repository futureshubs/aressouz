import { useEffect, useState } from 'react';
import {
  fetchPersonalizedProducts,
  fetchRecommendationFeed,
} from '../utils/recommendationsClient';
import { catalogItemId } from '../utils/catalogFeedRanking';

function extractProductId(p: unknown): string {
  return catalogItemId((p ?? {}) as Record<string, unknown>);
}

/** API «Sizga mos» va «Bugun trendda» IDlari — asosiy grid reytingini kuchaytirish uchun */
export function useCatalogFeedBoosts(
  accessToken: string | null | undefined,
  region: string | null | undefined,
  district: string | null | undefined,
  enabled = true,
): { forYouIds: string[]; trendingIds: string[] } {
  const [forYouIds, setForYouIds] = useState<string[]>([]);
  const [trendingIds, setTrendingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled || !region || !district) {
      setForYouIds([]);
      setTrendingIds([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      fetchPersonalizedProducts(accessToken, { region, district, limit: 48 }),
      fetchRecommendationFeed(accessToken, {
        region,
        district,
        sections: ['trending'],
        perSection: 48,
      }),
    ])
      .then(([personalized, feed]) => {
        if (cancelled) return;
        setForYouIds(
          (personalized as unknown[])
            .map(extractProductId)
            .filter(Boolean),
        );
        const trendingSection =
          feed.sections.trending_today ?? feed.sections.trending ?? [];
        setTrendingIds(
          (Array.isArray(trendingSection) ? trendingSection : [])
            .map(extractProductId)
            .filter(Boolean),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setForYouIds([]);
          setTrendingIds([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, region, district, enabled]);

  return { forYouIds, trendingIds };
}
