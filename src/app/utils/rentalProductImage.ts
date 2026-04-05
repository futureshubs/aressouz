/** Ijara mahsulot rasmi: to‘liq URL yoki nisbiy yo‘l — img src uchun */
export function normalizeRentalProductImageUrl(raw: string, apiBaseUrl: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (low.startsWith('http://') || low.startsWith('https://') || low.startsWith('//') || low.startsWith('data:')) {
    return s;
  }
  if (s.startsWith('/')) return s;
  const base = String(apiBaseUrl || '').replace(/\/$/, '');
  if (!base) return s;
  return `${base}/${s.replace(/^\//, '')}`;
}
