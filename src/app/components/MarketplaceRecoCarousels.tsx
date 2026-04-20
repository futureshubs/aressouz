import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Clock, Loader2, Package, Star, Truck } from 'lucide-react';
import { fetchPersonalizedProducts, fetchRecommendationFeed, postRecoEvents, productToRecoPayload } from '../utils/recommendationsClient';
import { getEffectiveProductStockQuantity } from '../utils/cartStock';
import { CardImageScroll } from './CardImageScroll';
import { collectProductGalleryImages } from '../utils/cardGalleryImages';

function productKey(p: unknown): string {
  const o = p as Record<string, unknown>;
  return String(o?.productUuid ?? o?.id ?? '').trim();
}

function withStock<T extends Record<string, unknown>>(p: T): T & { stockQuantity?: number } {
  return {
    ...p,
    stockQuantity: getEffectiveProductStockQuantity(p),
  };
}

function uniqByKey<T extends Record<string, unknown>>(items: T[], limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of items) {
    const k = productKey(p);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Bo‘lim katalogidan «Sizga mos» uchun yordamchi tanlov */
function fallbackForYouFromCatalog(catalog: Record<string, unknown>[], exclude: Set<string>, limit: number) {
  const scored = [...catalog]
    .filter((p) => {
      const k = productKey(p);
      return k && !exclude.has(k);
    })
    .sort((a, b) => {
      const ra = (Number(a.rating) || 0) * Math.log1p(Number(a.reviewCount) || 0);
      const rb = (Number(b.rating) || 0) * Math.log1p(Number(b.reviewCount) || 0);
      return rb - ra;
    });
  return scored.slice(0, limit).map((p) => withStock(p));
}

/** Trend uchun — zaxira va reyting */
function fallbackTrendingFromCatalog(catalog: Record<string, unknown>[], exclude: Set<string>, limit: number) {
  const scored = [...catalog]
    .filter((p) => {
      const k = productKey(p);
      return k && !exclude.has(k);
    })
    .sort((a, b) => {
      const sa = (Number(a.stockCount) || Number((a as { stockQuantity?: number }).stockQuantity) || 0) + (Number(a.rating) || 0) * 2;
      const sb = (Number(b.stockCount) || Number((b as { stockQuantity?: number }).stockQuantity) || 0) + (Number(b.rating) || 0) * 2;
      return sb - sa;
    });
  return scored.slice(0, limit).map((p) => withStock(p));
}

export type MarketplaceRecoCarouselsProps = {
  catalogProducts: Record<string, unknown>[];
  selectedRegion: string | null | undefined;
  selectedDistrict: string | null | undefined;
  accessToken: string | null | undefined;
  accentColor: { color: string };
  isDark: boolean;
  /** Mahsulot kartochkasi bosilganda (detail / variant) */
  onProductOpen: (product: Record<string, unknown>) => void;
  /** Reco ro‘yxatini yangilash (masalan, klikdan keyin) */
  onRecoBump?: () => void;
  refreshKey?: number;
  labels?: { forYou?: string; trending?: string };
  /** Do‘kon: ish vaqti tashqarisida rasm ustida «Yopiq» (mas. OnlineShops) */
  shopClosedContent?: (product: Record<string, unknown>) => { title: string; subtitle?: string | null } | null;
};

/**
 * Do‘kon bo‘limidagi kabi «Sizga mos» va «Bugun trendda» gorizontal lentalar.
 * API natijalari faqat `catalogProducts` ichidagi mahsulotlarga qisqartiriladi (bo‘lim mosligi).
 */
export function MarketplaceRecoCarousels({
  catalogProducts,
  selectedRegion,
  selectedDistrict,
  accessToken,
  accentColor,
  isDark,
  onProductOpen,
  onRecoBump,
  refreshKey = 0,
  labels,
  shopClosedContent,
}: MarketplaceRecoCarouselsProps) {
  const forYouLabel = labels?.forYou ?? 'Sizga mos';
  const trendingLabel = labels?.trending ?? 'Bugun trendda';

  const allowedIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of catalogProducts) {
      const k = productKey(p);
      if (k) s.add(k);
    }
    return s;
  }, [catalogProducts]);

  const [recoProducts, setRecoProducts] = useState<Record<string, unknown>[]>([]);
  const [recoLoading, setRecoLoading] = useState(false);
  const [feedTrending, setFeedTrending] = useState<Record<string, unknown>[]>([]);
  const [feedTrendingLoading, setFeedTrendingLoading] = useState(false);

  useEffect(() => {
    if (!selectedRegion || !selectedDistrict || allowedIds.size === 0) {
      setRecoProducts([]);
      setFeedTrending([]);
      return;
    }
    let cancelled = false;
    setRecoLoading(true);
    void fetchPersonalizedProducts(accessToken, {
      region: selectedRegion,
      district: selectedDistrict,
      limit: 24,
    })
      .then((list) => {
        if (cancelled) return;
        const mapped = (list as Record<string, unknown>[]).map((p) => withStock(p));
        const inSection = mapped.filter((p) => allowedIds.has(productKey(p)));
        const exclude = new Set(inSection.map(productKey));
        const need = Math.max(0, 12 - inSection.length);
        const fill = need > 0 ? fallbackForYouFromCatalog(catalogProducts as Record<string, unknown>[], exclude, need) : [];
        setRecoProducts(uniqByKey([...inSection, ...fill], 18));
      })
      .finally(() => {
        if (!cancelled) setRecoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedRegion,
    selectedDistrict,
    accessToken,
    refreshKey,
    allowedIds,
    catalogProducts,
  ]);

  useEffect(() => {
    if (!selectedRegion || !selectedDistrict || allowedIds.size === 0) {
      setFeedTrending([]);
      return;
    }
    let cancelled = false;
    setFeedTrendingLoading(true);
    void fetchRecommendationFeed(accessToken, {
      region: selectedRegion,
      district: selectedDistrict,
      sections: ['trending'],
      perSection: 16,
    })
      .then(({ sections }) => {
        if (cancelled) return;
        const t = sections.trending_today;
        const arr = Array.isArray(t) ? (t as Record<string, unknown>[]) : [];
        const mapped = arr.map((p) => withStock(p));
        const inSection = mapped.filter((p) => allowedIds.has(productKey(p)));
        const exclude = new Set(inSection.map(productKey));
        const need = Math.max(0, 12 - inSection.length);
        const fill = need > 0 ? fallbackTrendingFromCatalog(catalogProducts as Record<string, unknown>[], exclude, need) : [];
        setFeedTrending(uniqByKey([...inSection, ...fill], 18));
      })
      .finally(() => {
        if (!cancelled) setFeedTrendingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    selectedRegion,
    selectedDistrict,
    accessToken,
    refreshKey,
    allowedIds,
    catalogProducts,
  ]);

  const skipAfterGalleryRef = useRef<Set<string>>(new Set());
  const tileKey = useCallback((p: Record<string, unknown>) => `${String(p?.shopId ?? '')}-${productKey(p)}`, []);

  const openUnlessGallery = useCallback(
    (product: Record<string, unknown>) => {
      if (skipAfterGalleryRef.current.has(tileKey(product))) return;
      void postRecoEvents([{ ...productToRecoPayload(product), type: 'click' }], accessToken).finally(() => onRecoBump?.());
      onProductOpen(product);
    },
    [accessToken, onProductOpen, onRecoBump, tileKey],
  );

  const onGallerySwipe = useCallback(
    (product: Record<string, unknown>) => {
      const k = tileKey(product);
      skipAfterGalleryRef.current.add(k);
      window.setTimeout(() => skipAfterGalleryRef.current.delete(k), 450);
    },
    [tileKey],
  );

  if (!selectedRegion || !selectedDistrict || allowedIds.size === 0) return null;

  const renderRow = (items: Record<string, unknown>[], prefix: string) =>
    items.map((product) => {
      const closedInfo = shopClosedContent?.(product) ?? null;
      return (
      <button
        key={`${prefix}-${productKey(product)}`}
        type="button"
        onClick={() => openUnlessGallery(product)}
        className="snap-start shrink-0 w-[140px] sm:w-[160px] rounded-2xl overflow-hidden text-left transition-transform active:scale-[0.98]"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          opacity: closedInfo ? 0.93 : 1,
        }}
      >
        <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-900/40 overflow-hidden">
          {(() => {
            const imgs = collectProductGalleryImages(product);
            const list = imgs.length > 0 ? imgs : product.image ? [String(product.image)] : [];
            if (list.length === 0) {
              return (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-10 h-10" style={{ color: accentColor.color, opacity: 0.35 }} />
                </div>
              );
            }
            if (list.length === 1) {
              return (
                <img
                  src={list[0]}
                  alt={String(product.name ?? '')}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain"
                />
              );
            }
            return (
              <CardImageScroll
                images={list}
                alt={String(product.name ?? '')}
                dotColor={accentColor.color}
                onUserInteracted={() => onGallerySwipe(product)}
                imgClassName="h-full w-full object-contain"
              />
            );
          })()}
          {closedInfo ? (
            <div
              className="pointer-events-none absolute inset-0 z-[8] flex flex-col items-center justify-center gap-0.5 bg-black/45 px-1 text-center"
              aria-hidden
            >
              <Clock className="h-5 w-5 shrink-0 text-white" strokeWidth={2} />
              <span className="max-w-full text-[9px] font-bold leading-tight text-white">{closedInfo.title}</span>
              {closedInfo.subtitle ? (
                <span className="max-w-full text-[8px] leading-tight text-white/90">{closedInfo.subtitle}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="p-2.5">
          <p className="text-[11px] line-clamp-1 mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
            {String((product as { shopName?: string }).shopName ?? (product as { category?: string }).category ?? '')}
          </p>
          <p
            className="text-xs font-semibold line-clamp-2 leading-snug mb-1.5 min-h-[2.25rem]"
            style={{ color: isDark ? '#fff' : '#111827' }}
          >
            {String(product.name ?? '')}
          </p>
          <p className="text-xs font-bold" style={{ color: accentColor.color }}>
            {Number((product as { price?: number }).price || 0).toLocaleString('uz-UZ')} so'm
          </p>
        </div>
      </button>
      );
    });

  return (
    <>
      {(recoLoading || recoProducts.length > 0) && (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Star className="w-5 h-5 shrink-0" style={{ color: accentColor.color }} />
              <h2 className="text-lg font-bold truncate">{forYouLabel}</h2>
            </div>
            {recoLoading ? <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: accentColor.color }} /> : null}
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-1 -mx-0.5 px-0.5 snap-x snap-mandatory"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {renderRow(recoProducts, 'reco')}
          </div>
        </div>
      )}

      {(feedTrendingLoading || feedTrending.length > 0) && (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Truck className="w-5 h-5 shrink-0" style={{ color: accentColor.color }} />
              <h2 className="text-lg font-bold truncate">{trendingLabel}</h2>
            </div>
            {feedTrendingLoading ? (
              <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: accentColor.color }} />
            ) : null}
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-1 -mx-0.5 px-0.5 snap-x snap-mandatory"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {renderRow(feedTrending, 'trend')}
          </div>
        </div>
      )}
    </>
  );
}
