import { regions } from '../../data/regions';
import { applyPhraseSynonyms, expandTokenAliases } from './synonyms';
import { normalizeSearchText } from './textNormalize';
import type { ParsedMarketplaceQuery } from './types';

const STOP = new Set([
  'va',
  'yoki',
  'uchun',
  'bilan',
  'dan',
  'ga',
  'ni',
  'bo',
  'bu',
  'shu',
  'bir',
  'the',
  'and',
  'or',
  'for',
  'with',
  'narxi',
  'narx',
  'chegirma',
  'yangi',
]);

/** Barcha tuman/viloyat nomlari (normalize) */
function buildLocationLexicon(): string[] {
  const out = new Set<string>();
  for (const r of regions) {
    out.add(normalizeSearchText(r.name));
    for (const d of r.districts) {
      out.add(normalizeSearchText(d.name));
      out.add(normalizeSearchText(d.id.replace(/-/g, ' ')));
    }
  }
  return [...out].filter((x) => x.length >= 3);
}

let _lex: string[] | null = null;
function locationLexicon(): string[] {
  if (!_lex) _lex = buildLocationLexicon().sort((a, b) => b.length - a.length);
  return _lex;
}

function extractLocations(norm: string): string[] {
  const found: string[] = [];
  let rest = norm;
  for (const loc of locationLexicon()) {
    if (!loc || loc.length < 3) continue;
    if (rest.includes(loc)) {
      found.push(loc);
      rest = rest.split(loc).join(' ');
    }
  }
  return found;
}

function extractNumericAttrs(norm: string): { cleaned: string; hints: string[]; roomCount: number | null } {
  const hints: string[] = [];
  let s = norm;
  let roomCount: number | null = null;

  const room = s.match(/\b(\d+)\s*(?:xona|xonali|room)\b/i);
  if (room) {
    roomCount = Number(room[1]);
    hints.push(`${room[1]} xona`);
    s = s.replace(room[0], ' ');
  }

  s = s.replace(/\b(i[3579]|m[123]|ryzen\s*\d+)\b/gi, (m) => {
    hints.push(m.toLowerCase().replace(/\s+/g, ''));
    return ' ';
  });

  s = s.replace(/\b(\d+)\s*(gb|гб|g)\b/gi, (_, n) => {
    hints.push(`${n}gb`);
    return ' ';
  });

  s = s.replace(/\b(\d+)\s*(tb|тб)\b/gi, (_, n) => {
    hints.push(`${n}tb`);
    return ' ';
  });

  s = s.replace(/\b(\d+)\s*(?:gb|гб)?\s*(?:ram|озу)\b/gi, (m) => {
    hints.push(m.toLowerCase().replace(/\s+/g, ''));
    return ' ';
  });

  const colors = ['oq', 'qora', 'qizil', 'ko\'k', 'kuk', 'sariq', 'kulrang', 'jigarrang', 'black', 'white', 'red', 'blue'];
  for (const c of colors) {
    const re = new RegExp(`\\b${c}\\b`, 'gi');
    if (re.test(s)) {
      hints.push(c);
      s = s.replace(re, ' ');
    }
  }

  s = s.replace(/\s+/g, ' ').trim();
  return { cleaned: s, hints, roomCount };
}

function extractPrices(norm: string): { cleaned: string; min: number | null; max: number | null } {
  let s = norm;
  let priceMin: number | null = null;
  let priceMax: number | null = null;

  const range = s.match(/\b(\d{2,})\s*[-–]\s*(\d{2,})\b/);
  if (range) {
    priceMin = Number(range[1]);
    priceMax = Number(range[2]);
    s = s.replace(range[0], ' ');
  }

  s = s.replace(/\b(?:dan|от)\s*(\d{2,})\b/gi, (_, n) => {
    priceMin = Number(n);
    return ' ';
  });

  s = s.replace(/\b(?:gacha|до)\s*(\d{2,})\b/gi, (_, n) => {
    priceMax = Number(n);
    return ' ';
  });

  s = s.replace(/\s+/g, ' ').trim();
  return { cleaned: s, min: priceMin, max: priceMax };
}

export function parseMarketplaceQuery(raw: string): ParsedMarketplaceQuery {
  const n0 = normalizeSearchText(raw);
  const withSyn = applyPhraseSynonyms(n0);
  const rentIntent = /\bijara\b/.test(withSyn);
  const saleIntent = /\b(sotuv|sotiladi|narxi)\b/.test(withSyn);

  const locs = extractLocations(withSyn);
  let rest = ` ${withSyn} `;
  for (const l of locs) {
    rest = rest.replace(new RegExp(`\\b${escapeRe(l)}\\b`, 'g'), ' ');
  }

  const price = extractPrices(rest);
  rest = price.cleaned;

  const attrs = extractNumericAttrs(rest);
  rest = attrs.cleaned;

  const tokens = rest
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOP.has(t));

  const headTokens = tokens.filter((t) => t.length >= 2);

  return {
    raw,
    normalized: withSyn,
    phraseForMatch: rest.replace(/\s+/g, ' ').trim(),
    tokens,
    locations: locs,
    roomCount: attrs.roomCount,
    attributeHints: attrs.hints,
    priceMin: price.min,
    priceMax: price.max,
    rentIntent,
    saleIntent,
    headTokens,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Har bir head token uchun barcha aliaslar */
export function expandedHeadTokens(parsed: ParsedMarketplaceQuery): string[][] {
  return parsed.headTokens.map((t) => expandTokenAliases(t));
}
