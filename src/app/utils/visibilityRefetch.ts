import { useEffect, useRef, useState } from 'react';

/**
 * Tab uzoq vaqt yopiq bo‘lib qaytganda yuboriladi — sahifani qayta yuklamasdan
 * backend ma’lumotini yangilash uchun butun loyiha tinglaydi.
 */
export const VISIBILITY_REFETCH_EVENT = 'aresso:visibility-refetch';

const DEFAULT_MIN_HIDDEN_MS = 12_000;

export function dispatchVisibilityRefetch(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(VISIBILITY_REFETCH_EVENT));
}

/**
 * App.tsx da bir marta chaqiring. Sahifa kamida `minHiddenMs` yashiringan bo‘lsa,
 * fokus qaytishi bilan global voqea yuboriladi.
 */
export function installVisibilityRefetchBroadcast(minHiddenMs = DEFAULT_MIN_HIDDEN_MS): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  let hiddenAt: number | null = null;
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt == null) return;
    const away = Date.now() - hiddenAt;
    hiddenAt = null;
    if (away < minHiddenMs) return;
    dispatchVisibilityRefetch();
  };

  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}

/**
 * {@link VISIBILITY_REFETCH_EVENT} bo‘lganda `onRefetch` ni chaqiradi.
 */
export function useVisibilityRefetch(onRefetch: () => void): void {
  const ref = useRef(onRefetch);
  ref.current = onRefetch;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      try {
        ref.current();
      } catch {
        /* komponent xatosi butun ilovani sindirmasin */
      }
    };
    window.addEventListener(VISIBILITY_REFETCH_EVENT, handler);
    return () => window.removeEventListener(VISIBILITY_REFETCH_EVENT, handler);
  }, []);
}

/**
 * Tabga qaytganda o‘zgaradigan raqam — ma’lumot yuklovchi `useEffect` dependency sifatida qo‘shing.
 */
export function useVisibilityTick(): number {
  const [tick, setTick] = useState(0);
  useVisibilityRefetch(() => setTick((t) => t + 1));
  return tick;
}
