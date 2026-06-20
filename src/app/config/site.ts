/**
 * Aloqa va ijtimoiy havolalar. Productionda `.env` orqali boshqaring:
 * VITE_SUPPORT_EMAIL, VITE_SOCIAL_INSTAGRAM, VITE_SOCIAL_TELEGRAM, VITE_SOCIAL_FACEBOOK
 * VITE_PUBLIC_SITE_URL — QR kod va tashqi havolalar uchun prod domen
 */
export const siteSupportEmail =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || 'support@aresso.app';

export const siteSocial = {
  instagram:
    (import.meta.env.VITE_SOCIAL_INSTAGRAM as string | undefined)?.trim() || 'https://www.instagram.com/',
  telegram: (import.meta.env.VITE_SOCIAL_TELEGRAM as string | undefined)?.trim() || 'https://t.me/',
  facebook:
    (import.meta.env.VITE_SOCIAL_FACEBOOK as string | undefined)?.trim() || 'https://www.facebook.com/',
} as const;

const DEFAULT_PUBLIC_ORIGIN = 'https://aresso.app';

/** QR poster va chop etiladigan havolalar — localhost da ham prod domen */
export function getPublicSiteOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.replace(/^www\./, '');
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      host === '0.0.0.0'
    ) {
      return DEFAULT_PUBLIC_ORIGIN;
    }
    return window.location.origin;
  }
  return DEFAULT_PUBLIC_ORIGIN;
}
