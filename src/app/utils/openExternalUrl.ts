/**
 * Tashqi HTTPS havolalar ilova WebView / PWA ichida emas, tizim brauzerida ochiladi.
 * - Web: `window.open` + fallback `<a target="_blank">`
 * - Capacitor (native): `@capacitor/browser` — alohicha brauzer / Chrome Custom Tab
 * - `tel:`, `mailto:`, `sms:` — tizim ilovasi (location.href)
 */

function openWithAnchorFallback(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  requestAnimationFrame(() => {
    try {
      document.body.removeChild(a);
    } catch {
      /* noop */
    }
  });
}

export async function openExternalUrl(url: string): Promise<void> {
  const raw = String(url || '').trim();
  if (!raw || typeof window === 'undefined') return;

  const low = raw.toLowerCase();
  if (low.startsWith('tel:') || low.startsWith('mailto:') || low.startsWith('sms:')) {
    window.location.href = raw;
    return;
  }

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: raw, presentationStyle: 'fullscreen' });
      return;
    }
  } catch {
    /* Capacitor yo‘q yoki web build */
  }

  const opened = window.open(raw, '_blank', 'noopener,noreferrer');
  if (opened) return;

  openWithAnchorFallback(raw);
}

/** Fire-and-forget — callback kerak bo‘lmagan joylar uchun */
export function openExternalUrlSync(url: string): void {
  void openExternalUrl(url);
}

/**
 * Barcha tashqi origin `<a href="https://...">` bosilishini ushlab, brauzerda ochadi.
 * Ichki route lar (bir xil origin, nisbiy yo‘l) o‘zgarmaydi.
 * Maxsus holat: `<a data-in-app-link="true" href="...">` — hech narsa qilmaymiz.
 */
export function installGlobalExternalLinkCapture(): () => void {
  const handler = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const t = e.target as Element | null;
    if (!t?.closest) return;
    const anchor = t.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    if (anchor.hasAttribute('download')) return;
    if (anchor.getAttribute('data-in-app-link') === 'true') return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    let u: URL;
    try {
      u = new URL(href, window.location.origin);
    } catch {
      return;
    }

    if (u.protocol === 'tel:' || u.protocol === 'mailto:' || u.protocol === 'sms:') {
      return;
    }
    if (!/^https?:$/i.test(u.protocol)) {
      return;
    }
    if (u.origin === window.location.origin) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    void openExternalUrl(u.href);
  };

  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}
