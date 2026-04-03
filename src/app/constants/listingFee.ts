import type { Language } from '../context/ThemeContext';

/**
 * Server bilan bir xil: `supabase/functions/make-server-27d0d16c/index.ts` → LISTING_FEE_UZS
 * Summani o‘zgartirsangiz, ikkala joyni ham yangilang.
 */
export const LISTING_FEE_UZS = 1_000;

/** Profil / modalda ko‘rinadigan qator (tilga qarab). */
export function formatListingFeeDisplay(lang: Language): string {
  const n = LISTING_FEE_UZS;
  if (lang === 'ru') {
    return `${n.toLocaleString('ru-RU')} сум`;
  }
  if (lang === 'en') {
    return `${n.toLocaleString('en-US')} UZS`;
  }
  return `${n.toLocaleString('uz-UZ')} so'm`;
}
