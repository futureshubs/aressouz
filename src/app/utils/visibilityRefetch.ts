import { useEffect, useRef, useState } from 'react';

/**
 * Tab uzoq vaqt yopiq bo‘lib qaytganda yuboriladi — sahifani qayta yuklamasdan
 * backend ma’lumotini yangilash uchun butun loyiha tinglaydi.
 */
export const VISIBILITY_REFETCH_EVENT = 'aresso:visibility-refetch';

const DEFAULT_MIN_HIDDEN_MS = 12_000;

/** Brauzer tabi ochiq bo‘lganda backenddan ma’lumotni avtomatik yangilash oralig‘i */
export const DEFAULT_GLOBAL_BACKEND_POLL_MS = 3000;

/** `silent: true` — fon yangilanishi (spinner / to‘liq loading yo‘q) */
export type VisibilityRefetchDetail = { silent?: boolean };

export function dispatchVisibilityRefetch(detail?: VisibilityRefetchDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<VisibilityRefetchDetail>(VISIBILITY_REFETCH_EVENT, {
      detail: detail ?? {},
    }),
  );
}

/**
 * Ixtiyoriy: butun ilova uchun global poll. `App.tsx` da **ulanmaydi** — har 3s
 * `setState` butun daraxtni qayta chizadi (loading bo‘lmasa ham “titrash”).
 * Kerak bo‘lsa faqat alohida panel (masalan, kassa) ichida chaqiring.
 */
export function installGlobalBackendPoll(
  intervalMs: number = DEFAULT_GLOBAL_BACKEND_POLL_MS,
): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    if (timer != null) return;
    timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      dispatchVisibilityRefetch({ silent: true });
    }, intervalMs);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      start();
    } else {
      stop();
    }
  };

  if (document.visibilityState === 'visible') {
    start();
  }
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
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
 * `detail.silent === true` — global poll; UI loading ko‘rsatmaslik uchun ishlating.
 */
export function useVisibilityRefetch(onRefetch: (detail: VisibilityRefetchDetail) => void): void {
  const ref = useRef(onRefetch);
  ref.current = onRefetch;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (ev: Event) => {
      try {
        const d = (ev as CustomEvent<VisibilityRefetchDetail>).detail ?? {};
        ref.current(d);
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
