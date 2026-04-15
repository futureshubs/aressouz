import { useMemo, useRef, type RefObject } from 'react';

export type ProgressiveRevealOptions = {
  batchSize?: number;
  initialCount?: number;
  root?: Element | null;
  rootMargin?: string;
};

export type ProgressiveRevealResult<T> = {
  visibleItems: T[];
  sentinelRef: RefObject<HTMLDivElement | null>;
};

/** Ro‘yxatni to‘liq qaytaradi (ichki scroll + sentinel ishonchsizligi sababli progressive olib tashlangan). */
export function useProgressiveListReveal<T>(
  items: readonly T[],
  _resetKey: string | number,
  _options: ProgressiveRevealOptions = {},
): ProgressiveRevealResult<T> {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const visibleItems = useMemo(() => Array.from(items), [items]);
  return { visibleItems, sentinelRef };
}
