/**
 * Aloqa va ijtimoiy havolalar. Productionda `.env` orqali boshqaring:
 * VITE_SUPPORT_EMAIL, VITE_SOCIAL_INSTAGRAM, VITE_SOCIAL_TELEGRAM, VITE_SOCIAL_FACEBOOK
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
