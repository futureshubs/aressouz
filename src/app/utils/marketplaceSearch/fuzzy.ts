/** Levenshtein (kichik qatorlar uchun) */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}

const WORD_RE = /[a-z0-9а-яёії]+/gi;

function maxEditDist(tokenLen: number): number {
  if (tokenLen <= 3) return 0;
  if (tokenLen <= 6) return 1;
  if (tokenLen <= 10) return 2;
  return 2;
}

/** So‘z sifatida (butun so‘z mosligi) fuzzy: matnda token ga yaqin so‘z bormi */
export function fuzzyTokenInText(haystackNorm: string, tokenNorm: string): boolean {
  if (!tokenNorm) return true;
  if (haystackNorm.includes(tokenNorm)) return true;
  const maxD = maxEditDist(tokenNorm.length);
  if (maxD === 0) return false;
  const hay = haystackNorm;
  let m: RegExpExecArray | null;
  const re = new RegExp(WORD_RE);
  re.lastIndex = 0;
  while ((m = re.exec(hay)) !== null) {
    const w = m[0].toLowerCase();
    if (Math.abs(w.length - tokenNorm.length) > maxD + 1) continue;
    if (levenshtein(w, tokenNorm) <= maxD) return true;
  }
  return false;
}
