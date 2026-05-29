/** Asosiy Aresso logotipi: kun (qora) va tun (oq) */
export const ARESSO_MAIN_LOGO = {
  day: '/branding/aresso-logo-day.png',
  night: '/branding/aresso-logo-night.png',
} as const;

export const ARESSO_MAIN_ICON = {
  day: '/icons/icon-192-day.png',
  night: '/icons/icon-192-night.png',
} as const;

const PANEL_ONLY_VARIANTS = new Set(['kuryer', 'avtokuryer', 'tayyorlovchi']);

export function isAressoMainBrandVariant(variant: string): boolean {
  return !PANEL_ONLY_VARIANTS.has(variant);
}

/** Kun rejimida qora logo, tun rejimida oq logo */
export function aressoMainLogoSrc(isDark: boolean): string {
  return isDark ? ARESSO_MAIN_LOGO.night : ARESSO_MAIN_LOGO.day;
}

export function aressoMainIconSrc(isDark: boolean): string {
  return isDark ? ARESSO_MAIN_ICON.night : ARESSO_MAIN_ICON.day;
}
