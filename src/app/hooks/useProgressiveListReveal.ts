import { useMemo, useRef, useState, useLayoutEffect, useEffect, type RefObject } from 'react';

export type ProgressiveRevealOptions = {
  batchSize?: number;
  initialCount?: number;
  /** Bo‘sh qoldirilsa, sentinel elementdan yuqoriga qarab eng yaqin scroll ota topiladi (mobil ichki scroll uchun). */
  root?: Element | null;
  rootMargin?: string;
};

export type ProgressiveRevealResult<T> = {
  visibleItems: T[];
  sentinelRef: RefObject<HTMLDivElement | null>;
};

function getNearestScrollRoot(el: HTMLElement | null): Element | null {
  if (el == null || typeof window === 'undefined') return null;
  let n: HTMLElement | null = el.parentElement;
  while (n) {
    const st = window.getComputedStyle(n);
    const oy = st.overflowY;
    const ox = st.overflowX;
    if (/(auto|scroll|overlay)/.test(oy) || /(auto|scroll|overlay)/.test(ox)) {
      return n;
    }
    if (n === document.documentElement) break;
    n = n.parentElement;
  }
  return null;
}

/**
 * Ro‘yxatni bosqichma-bosqich ko‘rsatadi: avval `initialCount` ta, keyin sentinel viewport /
 * scroll konteyneriga yaqinlashganda `batchSize` qo‘shiladi.
 */
export function useProgressiveListReveal<T>(
  items: readonly T[],
  resetKey: string | number,
  options: ProgressiveRevealOptions = {},
): ProgressiveRevealResult<T> {
  const batchSize = options.batchSize ?? 10;
  const initialCount = options.initialCount ?? 16;
  const rootOption = options.root ?? null;
  const rootMargin = options.rootMargin ?? '0px 0px 140px 0px';

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const batchSizeRef = useRef(batchSize);
  batchSizeRef.current = batchSize;
  const itemsLenRef = useRef(items.length);
  itemsLenRef.current = items.length;

  const [visibleCount, setVisibleCount] = useState(() => Math.min(initialCount, items.length));

  useLayoutEffect(() => {
    setVisibleCount(Math.min(initialCount, items.length));
  }, [resetKey, initialCount, items.length]);

  const visibleItems = useMemo(() => Array.from(items).slice(0, visibleCount), [items, visibleCount]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= items.length) return;

    const scrollRoot = rootOption ?? getNearestScrollRoot(el);
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        obs.unobserve(el);
        const len = itemsLenRef.current;
        const step = batchSizeRef.current;
        setVisibleCount((c) => Math.min(c + step, len));
      },
      { root: scrollRoot, rootMargin, threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, items.length, resetKey, rootOption, rootMargin]);

  return { visibleItems, sentinelRef };
}
