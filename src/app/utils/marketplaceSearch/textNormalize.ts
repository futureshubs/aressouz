/** Qatorni qidiruv uchun yagona shaklga keltirish */
export function normalizeSearchText(input: string): string {
  let s = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  s = s
    .replace(/['ʼ`´]/g, '')
    .replace(/ё/g, 'е')
    .replace(/қ/g, 'q')
    .replace(/ғ/g, 'g')
    .replace(/ҳ/g, 'h')
    .replace(/ў/g, 'o');

  s = s.replace(/[^a-z0-9а-яёії\s\u0400-\u04FF]/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Eski API bilan mos */
export function normalizeHeaderSearch(q: string): string {
  return normalizeSearchText(q);
}
