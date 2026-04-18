/**
 * Telegram Web App: viewport, safe area — oddiy brauzerda no-op.
 * https://core.telegram.org/bots/webapps
 */

type Inset = { top?: number; bottom?: number; left?: number; right?: number };

function px(n: number) {
  return `${Math.max(0, Math.round(n))}px`;
}

export function initTelegramMiniAppViewport(): void {
  if (typeof window === 'undefined') return;

  const tg = (window as unknown as { Telegram?: { WebApp?: Record<string, unknown> } }).Telegram?.WebApp;
  if (!tg || typeof tg !== 'object') return;

  try {
    (tg as { ready?: () => void }).ready?.();
    (tg as { expand?: () => void }).expand?.();
  } catch {
    /* ignore */
  }

  const apply = () => {
    const si = (tg.safeAreaInset as Inset) || {};
    const ci = (tg.contentSafeAreaInset as Inset) || {};
    const mergedTop = Math.max(Number(si.top) || 0, 0) + Math.max(Number(ci.top) || 0, 0);
    /**
     * Telegram yuqori «Yopish / Закрыть» qatori WebView ustida — Web ichidagi X bilan ustma-ust tushmasin.
     * Inset 0 bo‘lsa ham minimal ~56px.
     */
    const top = Math.max(mergedTop, 56);
    const bottom = Math.max(Number(si.bottom) || 0, 0) + Math.max(Number(ci.bottom) || 0, 0);
    const left = Math.max(Number(si.left) || 0, 0) + Math.max(Number(ci.left) || 0, 0);
    const right = Math.max(Number(si.right) || 0, 0) + Math.max(Number(ci.right) || 0, 0);

    const root = document.documentElement;
    root.classList.add('telegram-mini-app');

    root.style.setProperty('--app-safe-top', px(top));
    if (bottom > 0) root.style.setProperty('--app-safe-bottom', px(Math.max(bottom, 8)));
    if (left > 0) root.style.setProperty('--app-safe-left', px(left));
    if (right > 0) root.style.setProperty('--app-safe-right', px(right));
  };

  apply();

  const handler = () => apply();
  const onEvent = (tg as { onEvent?: (ev: string, cb: () => void) => void }).onEvent;
  if (typeof onEvent === 'function') {
    try {
      onEvent('safeAreaChanged', handler);
      onEvent('contentSafeAreaChanged', handler);
      onEvent('viewportChanged', handler);
    } catch {
      window.addEventListener('resize', handler);
    }
  } else {
    window.addEventListener('resize', handler);
  }
}
