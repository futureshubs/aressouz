import { fuzzyTokenInText, levenshtein } from './fuzzy';
import { expandedHeadTokens, parseMarketplaceQuery } from './queryIntel';
import { normalizeSearchText } from './textNormalize';
import type { DocumentMatchResult, MarketplaceSearchOptions, MatchTier, ParsedMarketplaceQuery } from './types';
import type { SearchRankVertical } from './types';

const QUERY_PARSE_CACHE = new Map<string, ParsedMarketplaceQuery>();
const MAX_CACHE = 80;

function getParsedQuery(raw: string): ParsedMarketplaceQuery {
  const key = raw;
  const hit = QUERY_PARSE_CACHE.get(key);
  if (hit) return hit;
  const p = parseMarketplaceQuery(raw);
  if (QUERY_PARSE_CACHE.size > MAX_CACHE) QUERY_PARSE_CACHE.clear();
  QUERY_PARSE_CACHE.set(key, p);
  return p;
}

function normParts(
  parts: Array<string | number | undefined | false | null | undefined>,
): string[] {
  return parts
    .filter((x) => x != null && x !== false && String(x).trim() !== '')
    .map((x) => normalizeSearchText(String(x)));
}

/** Javob satrida barcha aliaslardan kamida bittasi uchraydimi */
function aliasHit(hay: string, aliases: string[]): boolean {
  for (const a of aliases) {
    if (!a) continue;
    if (hay.includes(a)) return true;
    if (fuzzyTokenInText(hay, a)) return true;
  }
  return false;
}

/** Barcha head tokenlar uchun mos (sinonim+fuzzy) */
/** Joy nomi: to‘liq substring yoki yaqin so‘z (1 xato) */
function blobContainsLocationNorm(blob: string, loc: string): boolean {
  if (!loc || loc.length < 2) return false;
  if (blob.includes(loc)) return true;
  if (loc.length < 5) return false;
  const re = /\b[a-z0-9а-яёії]{3,}\b/gi;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    const w = m[0].toLowerCase();
    if (Math.abs(w.length - loc.length) > 2) continue;
    if (levenshtein(w, loc) <= 1) return true;
  }
  return false;
}

function headTokensMatch(
  parsed: ParsedMarketplaceQuery,
  haystack: string,
  vertical: SearchRankVertical,
): boolean {
  const groups = expandedHeadTokens(parsed);
  if (groups.length === 0) {
    if (vertical === 'rental' && parsed.locations.length > 0) {
      return parsed.locations.some((l) => blobContainsLocationNorm(haystack, l));
    }
    if (parsed.attributeHints.length > 0) {
      return parsed.attributeHints.some((h) => {
        const hn = normalizeSearchText(h).replace(/\s+/g, '');
        return hn.length > 0 && (haystack.includes(hn) || haystack.includes(normalizeSearchText(h)));
      });
    }
    const compact = parsed.normalized.replace(/\s+/g, ' ').trim();
    if (compact.length >= 2 && haystack.includes(compact)) return true;
    return false;
  }
  for (const aliases of groups) {
    if (!aliasHit(haystack, aliases)) return false;
  }
  return true;
}

function headTermsInTitle(title: string, parsed: ParsedMarketplaceQuery): number {
  const groups = expandedHeadTokens(parsed);
  let n = 0;
  for (const aliases of groups) {
    if (aliasHit(title, aliases)) n++;
  }
  return n;
}

/** So‘rov tipiga zid mahsulot (mouse so‘ralganda faqat klaviatura) */
function accessoryPenalty(title: string, blob: string, parsed: ParsedMarketplaceQuery): number {
  let pen = 0;
  const t = title;
  const b = blob;

  const wantMouse =
    parsed.normalized.includes('mouse') ||
    parsed.normalized.includes('mish') ||
    (parsed.normalized.includes('gaming') && parsed.normalized.includes('mouse'));
  if (wantMouse || parsed.tokens.includes('mouse')) {
    const hasMouse = t.includes('mouse') || t.includes('mish');
    if (!hasMouse && (t.includes('keyboard') || t.includes('klaviatura') || /\bpad\b/.test(t)))
      pen += 520;
    if (!hasMouse && (b.includes('keyboard') || b.includes('klaviatura')) && !b.includes('mouse')) pen += 180;
  }

  const wantAir =
    parsed.normalized.includes('airpods') ||
    parsed.normalized.includes('tws') ||
    parsed.tokens.includes('airpods');
  if (wantAir) {
    const has = t.includes('airpods') || t.includes('quloqchin') || t.includes('bluetooth');
    if (!has && (t.includes('charger') || t.includes('zaryad') || /\bkabel\b/.test(t))) pen += 400;
  }

  const wantShoe =
    /\b(nike|adidas|krossovka|krossovk|sneakers)\b/.test(parsed.normalized) &&
    /\b(krossovka|krossovk|sneakers|snikers|nike|adidas)\b/.test(parsed.normalized);
  if (wantShoe) {
    if (!/\b(krossovka|krossovk|sneakers|snikers|nike|adidas|boot|poyafzal)\b/.test(t) && /\b(futbolka|short|kepka)\b/.test(t))
      pen += 450;
  }

  return pen;
}

function locationScore(parsed: ParsedMarketplaceQuery, locationBlob: string, vertical: SearchRankVertical): number {
  if (!parsed.locations.length) return 0;
  let s = 0;
  for (const loc of parsed.locations) {
    if (!blobContainsLocationNorm(locationBlob, loc)) continue;
    if (vertical === 'rental') s += 980;
    else if (vertical === 'property') s += 520;
    else if (vertical === 'place') s += 480;
    else s += 420;
  }
  return s;
}

function attributeScore(parsed: ParsedMarketplaceQuery, blob: string): number {
  let s = 0;
  for (const h of parsed.attributeHints) {
    const hn = normalizeSearchText(h).replace(/\s+/g, '');
    if (!hn) continue;
    if (blob.includes(hn) || blob.includes(normalizeSearchText(h))) s += 360;
    const bits = normalizeSearchText(h)
      .split(' ')
      .map((x) => x.trim())
      .filter(Boolean);
    if (bits.length >= 2 && bits.every((b) => blob.includes(b))) s += 280;
  }
  return s;
}

function priceScore(
  parsed: ParsedMarketplaceQuery,
  price: number | null | undefined,
  vertical: SearchRankVertical,
): number {
  if (price == null || !Number.isFinite(price) || price <= 0) return 0;
  if (parsed.priceMin != null && price < parsed.priceMin) return -200;
  if (parsed.priceMax != null && price > parsed.priceMax) return -200;
  if (vertical === 'rental' && parsed.priceMax != null && price <= parsed.priceMax) return 120;
  return 40;
}

function freshnessScore(isoOrMs: string | number | undefined): number {
  if (isoOrMs == null) return 0;
  const t = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(String(isoOrMs));
  if (!Number.isFinite(t)) return 0;
  const days = (Date.now() - t) / 86400000;
  if (days < 3) return 120;
  if (days < 14) return 80;
  if (days < 45) return 40;
  return 0;
}

function tierFromSignals(
  title: string,
  phrase: string,
  headInTitle: number,
  headTotal: number,
  exactPhraseTitle: boolean,
): MatchTier {
  if (exactPhraseTitle) return 'exact';
  if (headTotal > 0 && headInTitle === headTotal) return 'strong';
  if (headInTitle >= Math.max(1, Math.ceil(headTotal * 0.51))) return 'related';
  return 'weak';
}

const TIER_ORDER: Record<MatchTier, number> = {
  exact: 4,
  strong: 3,
  related: 2,
  weak: 1,
};

export type RankableItemMeta = {
  price?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  stock?: number | null;
  publishedAt?: string | number | null;
  createdAt?: string | number | null;
};

export function scoreMarketplaceDocument(
  rawQuery: string,
  parts: Array<string | number | undefined | false | null | undefined>,
  options?: MarketplaceSearchOptions & { meta?: RankableItemMeta },
): DocumentMatchResult {
  const vertical: SearchRankVertical = options?.vertical ?? 'general';
  const parsed = getParsedQuery(rawQuery);
  const strings = normParts(parts);
  if (!strings.length) return { matches: false, score: 0, tier: 'weak' };

  const title = strings[0] || '';
  const blob = strings.join(' \u0001 ');
  /** Joy nomi istalgan maydonda bo‘lishi mumkin — faqat dastlabki qatorlarga cheklanmasin */
  const locationBlob = blob;

  const headGroups = expandedHeadTokens(parsed);
  const headTotal = headGroups.length;

  const blobOk = headTokensMatch(parsed, blob, vertical);
  if (!blobOk) return { matches: false, score: 0, tier: 'weak' };

  if (vertical === 'rental' && parsed.locations.length > 0) {
    if (!parsed.locations.some((l) => blobContainsLocationNorm(blob, l))) {
      return { matches: false, score: 0, tier: 'weak' };
    }
  }

  const phrase = normalizeSearchText(parsed.phraseForMatch || parsed.normalized);
  const exactPhraseTitle = phrase.length >= 2 && title.includes(phrase);
  const exactPhraseBlob = phrase.length >= 2 && blob.includes(phrase);

  const headInTitle = headTermsInTitle(title, parsed);
  let tier = tierFromSignals(title, phrase, headInTitle, headTotal || parsed.locations.length || 1, exactPhraseTitle);

  let score = 200 + headInTitle * 220 + (exactPhraseTitle ? 2400 : 0) + (exactPhraseBlob && !exactPhraseTitle ? 600 : 0);

  if (title.startsWith(phrase) && phrase.length >= 3) score += 900;
  if (phrase.length >= 3 && title.includes(phrase)) score += 500;

  for (const g of headGroups) {
    for (const a of g) {
      if (!a) continue;
      const ix = title.indexOf(a);
      if (ix === 0) score += 380;
      else if (ix > 0) score += 220;
    }
  }

  score += locationScore(parsed, locationBlob, vertical);
  score += attributeScore(parsed, blob);

  score -= accessoryPenalty(title, blob, parsed);

  const meta = options?.meta;
  if (meta) {
    score += priceScore(parsed, meta.price ?? null, vertical);
    const r = Number(meta.rating);
    if (r > 0) score += Math.min(180, r * 55);
    const rc = Number(meta.reviewCount);
    if (rc > 0) score += Math.min(120, Math.log1p(rc) * 22);
    const st = Number(meta.stock);
    if (vertical === 'product' && st > 0) score += Math.min(90, Math.log1p(st) * 18);
    score += freshnessScore(meta.publishedAt ?? meta.createdAt ?? undefined);
  } else {
    score += priceScore(parsed, null, vertical);
  }

  /** blob bo‘yicha mos kelgan bo‘lsa, chiqarishdan chiqarib yubormaymiz — tartibni skor hal qiladi */
  return { matches: true, score, tier };
}

export function compareMarketplaceRank(a: DocumentMatchResult, b: DocumentMatchResult): number {
  const da = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
  if (da !== 0) return da;
  return b.score - a.score;
}

/** Public: legacy parts[] massivi bilan skor */
export function scoreMarketplaceSearchLegacy(
  rawQuery: string,
  parts: Array<string | number | undefined | false | null | undefined>,
  options?: MarketplaceSearchOptions & { meta?: RankableItemMeta },
): DocumentMatchResult {
  return scoreMarketplaceDocument(rawQuery, parts, options);
}

export { getParsedQuery };
