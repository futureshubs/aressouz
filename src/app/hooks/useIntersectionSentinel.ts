import { useEffect, useRef } from 'react';

function findScrollableParent(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el?.parentElement ?? null;
  while (cur) {
    const style = window.getComputedStyle(cur);
    const oy = style.overflowY;
    const ox = style.overflowX;
    const canScrollY = (oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight + 1;
    const canScrollX = (ox === 'auto' || ox === 'scroll') && cur.scrollWidth > cur.clientWidth + 1;
    if (canScrollY || canScrollX) return cur;
    cur = cur.parentElement;
  }
  return null;
}

export function useIntersectionSentinel(opts: {
  enabled: boolean;
  onIntersect: () => void;
  rootMargin?: string;
  threshold?: number;
  /** If omitted, hook will auto-detect nearest scrollable parent. */
  root?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!opts.enabled) return;
    const el = ref.current;
    if (!el) return;
    const root = opts.root ?? findScrollableParent(el);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            opts.onIntersect();
            break;
          }
        }
      },
      { root, rootMargin: opts.rootMargin ?? '800px 0px', threshold: opts.threshold ?? 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [opts.enabled, opts.onIntersect, opts.rootMargin, opts.threshold, opts.root]);
  return ref;
}

