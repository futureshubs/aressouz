/**
 * Butun qator bo‘yicha almashtirish (uzun kalitlar birinchi).
 * Foydalanuvchi xato yozsa ham canonical shaklga yaqinlashadi.
 */
const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bayfon\b/gi, 'iphone'],
  [/\bayphone\b/gi, 'iphone'],
  [/\biphone\b/gi, 'iphone'],
  [/\baipods\b/gi, 'airpods'],
  [/\bairpods\b/gi, 'airpods'],
  [/\beyrpods\b/gi, 'airpods'],
  [/\bairpod\b/gi, 'airpods'],
  [/\btws\b/gi, 'airpods'],
  [/\bkrasofka\b/gi, 'krossovka'],
  [/\bkrasovka\b/gi, 'krossovka'],
  [/\bkrasovkalar\b/gi, 'krossovka'],
  [/\bkrossovka\b/gi, 'krossovka'],
  [/\bkrossovkalar\b/gi, 'krossovka'],
  [/\bnoutbuk\b/gi, 'laptop'],
  [/\bnout\b/gi, 'laptop'],
  [/\blaptop\b/gi, 'laptop'],
  [/\bkompyuter\b/gi, 'computer'],
  [/\bkomputer\b/gi, 'computer'],
  [/\bsumsung\b/gi, 'samsung'],
  [/\bsamnsung\b/gi, 'samsung'],
  [/\baple\b/gi, 'apple'],
  [/\bepple\b/gi, 'apple'],
  [/\bmacbook\b/gi, 'macbook'],
  [/\bmause\b/gi, 'mouse'],
  [/\bmish\b/gi, 'mouse'],
  [/\bmouse\b/gi, 'mouse'],
  [/\bgaming\b/gi, 'gaming'],
  [/\bklaviatura\b/gi, 'keyboard'],
  [/\bkeyboard\b/gi, 'keyboard'],
  [/\bquloqchin\b/gi, 'quloqchin'],
  [/\bquloqchinlar\b/gi, 'quloqchin'],
  [/\bijarasi\b/gi, 'ijara'],
  [/\bijara\b/gi, 'ijara'],
  [/\bsotiladi\b/gi, 'sotuv'],
  [/\bsotuv\b/gi, 'sotuv'],
];

/** Token → qo‘shimcha sinonim so‘zlar (qidiruvda parallel tekshiriladi) */
export const TOKEN_ALIASES: Record<string, string[]> = {
  ayfon: ['iphone'],
  ayphone: ['iphone'],
  aipods: ['airpods'],
  eyrpods: ['airpods'],
  tws: ['airpods', 'bluetooth', 'quloqchin'],
  krasofka: ['krossovka', 'snikers', 'sneakers'],
  krasovka: ['krossovka'],
  noutbuk: ['laptop', 'notebook'],
  nout: ['laptop'],
  mause: ['mouse'],
  mish: ['mouse'],
  sumsung: ['samsung'],
  samnsung: ['samsung'],
  aple: ['apple'],
  epple: ['apple'],
  klaviatura: ['keyboard'],
  ijarasi: ['ijara'],
};

export function applyPhraseSynonyms(normalizedLower: string): string {
  let s = ` ${normalizedLower} `;
  for (const [re, to] of PHRASE_REPLACEMENTS) {
    s = s.replace(re, ` ${to} `);
  }
  return s.replace(/\s+/g, ' ').trim();
}

export function expandTokenAliases(token: string): string[] {
  const t = token.toLowerCase();
  const set = new Set<string>([t]);
  const extra = TOKEN_ALIASES[t];
  if (extra) for (const e of extra) set.add(e.toLowerCase());
  return [...set];
}
