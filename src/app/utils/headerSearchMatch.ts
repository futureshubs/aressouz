/** Bo'sh bo'lmagan so'zlar barchasi matnda (katta-kichik farqsiz) uchraydimi */
export function normalizeHeaderSearch(q: string): string {
  return String(q || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function matchesHeaderSearch(
  query: string,
  parts: Array<string | number | undefined | null | false>,
): boolean {
  const n = normalizeHeaderSearch(query);
  if (!n) return true;
  const blob = parts
    .filter((x) => x != null && x !== false && String(x).trim() !== '')
    .map((x) => String(x).toLowerCase())
    .join(' \u0001 ');
  const words = n.split(' ').filter(Boolean);
  return words.every((w) => blob.includes(w));
}
