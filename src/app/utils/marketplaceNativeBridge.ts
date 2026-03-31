/**
 * Expo / React Native WebView qobig‘i bilan bog‘lanish.
 * Mobil ilovada `postMessage` orqali native Share, haptic, badge va hokazo.
 */

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __MARKETPLACE_NATIVE__?: { version: string; platform: string };
  }
}

export function isMarketplaceNativeApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.ReactNativeWebView?.postMessage === 'function'
  );
}

export type NativeToHostPayload =
  | { type: 'share'; title?: string; message?: string; url: string }
  | { type: 'haptic'; style?: 'light' | 'medium' | 'heavy' }
  | { type: 'setBadge'; count: number }
  | { type: 'openUrl'; url: string };

export function postToMarketplaceNative(payload: NativeToHostPayload): void {
  if (!isMarketplaceNativeApp()) return;
  try {
    window.ReactNativeWebView!.postMessage(JSON.stringify(payload));
  } catch {
    /* */
  }
}

function copyTextDomFallback(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type ToastLike = {
  success: (msg: string) => void;
  info: (msg: string, opts?: { duration?: number; description?: string }) => void;
};

/**
 * Mahsulot / taom / ilova havolasi: avvalo native Share, keyin Web Share API, keyin clipboard.
 */
export async function shareTitleTextUrl(params: {
  title: string;
  text: string;
  url: string;
  toast: ToastLike;
  /** false bo‘lsa muvaffaqiyatli ulashishda toast chiqmaydi */
  shareSuccessToast?: string | false;
  clipboardSuccessMessage?: string;
}): Promise<void> {
  const {
    title,
    text,
    url,
    toast,
    shareSuccessToast = 'Ulashish paneli ochildi',
    clipboardSuccessMessage = 'Havola nusxalandi',
  } = params;

  if (isMarketplaceNativeApp()) {
    postToMarketplaceNative({ type: 'share', title, message: text, url });
    if (shareSuccessToast !== false) toast.success(shareSuccessToast);
    return;
  }

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text, url });
      if (shareSuccessToast !== false) toast.success(shareSuccessToast);
      return;
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return;
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success(clipboardSuccessMessage);
      return;
    }
  } catch {
    /* */
  }

  if (copyTextDomFallback(`${text}\n${url}`)) {
    toast.success(clipboardSuccessMessage);
  } else {
    toast.info('Havolani qo‘lda nusxalang', { duration: 5000, description: url });
  }
}

export function marketplaceNativeHaptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  postToMarketplaceNative({ type: 'haptic', style });
}

export function marketplaceNativeSetBadge(count: number): void {
  postToMarketplaceNative({ type: 'setBadge', count: Math.max(0, Math.floor(count)) });
}

export function marketplaceNativeOpenUrl(url: string): void {
  postToMarketplaceNative({ type: 'openUrl', url });
}
