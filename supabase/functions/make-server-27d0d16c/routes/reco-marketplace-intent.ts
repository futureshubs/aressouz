/**
 * Uzum / Wildberries / Amazon uslubi: qidiruv intenti, takroriy ko‘rish,
 * 15 daqiqalik sessiya, aksessuar-grafigi (heuristic), zaif click shovqinini kamaytirish.
 */

export type RecoEv = {
  ts: number;
  type: string;
  productId?: string;
  query?: string;
};

const SESSION_MS = 15 * 60 * 1000;
const REPEAT_VIEW_MS = 14 * 24 * 60 * 60 * 1000;

const STOP = new Set([
  "va", "yoki", "uchun", "bu", "bir", "the", "and", "for", "with", "dan", "ga", "uchun",
]);

function blob(p: Record<string, unknown>): string {
  return `${String(p.name ?? "")} ${String(p.description ?? "")}`.toLowerCase();
}

function tokenize(q: string): string[] {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff\s-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Qidiruvdan kengaytirilgan “intent” — mahsulot matni bilan moslashadi */
const INTENT_RULES: Array<{
  re: RegExp;
  tokens: string[];
  w: number;
}> = [
  {
    re: /\b(airpods|air\s*pods|эйрпод|tws|besprovod|bluetooth|quloqchin|naushnik|headphone)\b/i,
    tokens: [
      "bluetooth",
      "tws",
      "quloqchin",
      "naushnik",
      "case",
      "chexol",
      "gilof",
      "g'ilof",
      "zaryad",
      "charger",
      "sim",
      "kabel",
      "charge",
      "airpod",
    ],
    w: 1.15,
  },
  {
    re: /\b(krossovka|krossovk|sneaker|sport\s*oynak|boot|oynak)\b/i,
    tokens: ["krossovka", "sport", "paypoq", "sock", "short", "mayka", "sumka", "gym", "futbol", "tishrt"],
    w: 1.1,
  },
  {
    re: /\b(telefon|smartfon|iphone|android|мобил|mobil)\b/i,
    tokens: [
      "g'ilof",
      "gilof",
      "chexol",
      "case",
      "ekran",
      "glass",
      "himoya",
      "zaryad",
      "charger",
      "kabel",
      "powerbank",
      "sim",
    ],
    w: 1.12,
  },
  {
    re: /\b(g'ilof|gilof|chexol|case|ekran\s*himoya)\b/i,
    tokens: ["glass", "himoya", "zaryad", "charger", "kabel", "chexol", "case", "gilof"],
    w: 1.05,
  },
  {
    re: /\b(gaming|gamer|mouse|мышь|mish|rgb)\b/i,
    tokens: ["keyboard", "klaviatura", "pad", "mousepad", "headset", "rgb", "gaming", "kreslo", "stol"],
    w: 1.1,
  },
];

/** “Shu mahsulot bilan olinadi” — anchor matndan aksessuar signal */
const COMPLEMENT_FROM_ANCHOR: Array<{ anchor: RegExp; boost: RegExp[]; label: string }> = [
  {
    anchor: /\b(telefon|smartfon|iphone|android)\b/i,
    boost: [
      /g'ilof|gilof|chexol|case|ekran|glass|himoya|zaryad|charger|kabel|powerbank/i,
    ],
    label: "telefon_aksesuar",
  },
  {
    anchor: /\b(gaming|mouse|gamer)\b/i,
    boost: [/keyboard|klaviatura|pad|mousepad|headset|rgb|kreslo/i],
    label: "gaming_setup",
  },
  {
    anchor: /\b(krossovka|sneaker|sport)\b/i,
    boost: [/paypoq|sock|short|mayka|sumka|gym|sport/i],
    label: "sport_komplekt",
  },
  {
    anchor: /\b(airpods|quloqchin|tws|bluetooth|naushnik)\b/i,
    boost: [/case|chexol|zaryad|charger|quloqchin|bluetooth/i],
    label: "audio_aksesuar",
  },
];

export type SearchIntentModel = {
  /** token (normalized) -> vazn */
  weights: Map<string, number>;
  /** tushuntirish uchun */
  recentQueries: string[];
};

function mergeWeights(m: Map<string, number>, key: string, add: number): void {
  const k = key.toLowerCase().slice(0, 48);
  if (k.length < 2) return;
  m.set(k, (m.get(k) || 0) + add);
}

export function expandQueryToIntent(query: string): Map<string, number> {
  const m = new Map<string, number>();
  const q = String(query || "").trim();
  if (!q) return m;
  for (const t of tokenize(q)) mergeWeights(m, t, 1.4);
  for (const rule of INTENT_RULES) {
    if (rule.re.test(q)) {
      for (const tok of rule.tokens) mergeWeights(m, tok, rule.w);
    }
  }
  return m;
}

export function buildSearchIntentFromEvents(events: RecoEv[], now = Date.now()): SearchIntentModel {
  const weights = new Map<string, number>();
  const recentQueries: string[] = [];
  for (let i = events.length - 1; i >= 0 && recentQueries.length < 8; i--) {
    const e = events[i];
    if (e.type === "search" && e.query) recentQueries.push(String(e.query).slice(0, 200));
  }
  for (const e of events) {
    if (e.type !== "search" || !e.query) continue;
    const q = String(e.query).trim();
    if (!q) continue;
    const ageMs = Math.max(0, now - e.ts);
    const inSession = ageMs <= SESSION_MS ? 2.35 : 1;
    const dayDecay = Math.exp(-ageMs / (4.5 * 24 * 60 * 60 * 1000));
    const w0 = inSession * dayDecay;
    const part = expandQueryToIntent(q);
    for (const [tok, wv] of part) {
      mergeWeights(weights, tok, wv * w0 * 1.1);
    }
  }
  return { weights, recentQueries };
}

/** Mahsulotga qanchalik mos (qidiruv — eng katta signal) */
export function searchIntentMatchScore(productBlob: string, model: SearchIntentModel): number {
  if (model.weights.size === 0) return 0;
  let s = 0;
  for (const [tok, wv] of model.weights) {
    if (tok.length < 2) continue;
    if (productBlob.includes(tok)) s += wv * 1.15;
  }
  return Math.min(18, s);
}

export function countProductViews(events: RecoEv[], now = Date.now()): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "view" || !e.productId) continue;
    if (now - e.ts > REPEAT_VIEW_MS) continue;
    const id = String(e.productId);
    m.set(id, (m.get(id) || 0) + 1);
  }
  return m;
}

/** Takroriy qiziqish: 2+ marta ko‘rilgan mahsulot */
export function repeatedViewBonus(viewCounts: Map<string, number>, productId: string): number {
  const c = viewCounts.get(productId) || 0;
  if (c >= 3) return 2.1;
  if (c >= 2) return 1.25;
  return 0;
}

/** Sessiya ichida (15m) ko‘rilgan mahsulotlar */
export function sessionViewedIds(events: RecoEv[], now = Date.now()): Set<string> {
  const s = new Set<string>();
  for (const e of events) {
    if (e.type !== "view" || !e.productId) continue;
    if (now - e.ts <= SESSION_MS) s.add(String(e.productId));
  }
  return s;
}

/**
 * Tasodifiy bitta click: yaqinida view/dwell/cart bo‘lmasa, click og‘irligini pasaytirish
 * (barcha clicklarga emas — faqat “yetim” mahsulot clickiga).
 */
export function orphanClickFactor(events: RecoEv[], productId: string, now = Date.now()): number {
  const WINDOW = 36 * 60 * 60 * 1000;
  const clicks = events.filter(
    (e) =>
      e.type === "click" &&
      e.productId === productId &&
      now - e.ts < WINDOW,
  ).length;
  if (clicks === 0) return 1;
  const supported = events.some(
    (e) =>
      e.productId === productId &&
      (e.type === "view" || e.type === "dwell" || e.type === "cart_add" || e.type === "purchase") &&
      now - e.ts < WINDOW,
  );
  if (clicks === 1 && !supported) return 0.32;
  if (clicks <= 2 && !supported) return 0.55;
  return 1;
}

export function complementScore(anchorProducts: Record<string, unknown>[], candidate: Record<string, unknown>): number {
  const b = blob(candidate);
  let best = 0;
  for (const a of anchorProducts) {
    const ab = blob(a);
    for (const rule of COMPLEMENT_FROM_ANCHOR) {
      if (!rule.anchor.test(ab)) continue;
      let hit = 0;
      for (const rx of rule.boost) {
        if (rx.test(b)) hit += 1;
      }
      if (hit > 0) best = Math.max(best, 1.2 + hit * 0.45);
    }
  }
  return best;
}

export function explainSearchAndView(
  product: Record<string, unknown>,
  model: SearchIntentModel,
  viewCounts: Map<string, number>,
  complementAnchors: Record<string, unknown>[],
  searchHit: boolean,
  complementHit: boolean,
): string[] {
  const reasons: string[] = [];
  const pid = String(product.id ?? "");
  if (searchHit) reasons.push("Siz qidirgansiz");
  const vc = viewCounts.get(pid) || 0;
  if (vc >= 2) reasons.push("Ko‘p ko‘rgansiz");
  if (complementHit) reasons.push("Shu mahsulot bilan olinadi");
  if (complementAnchors.length && complementScore(complementAnchors, product) > 0.5 && !complementHit) {
    reasons.push("Oxirgi ko‘rganingizga mos aksessuar");
  }
  return [...new Set(reasons)].slice(0, 3);
}

/** “Top variantlar” — qiziqgan narx oralig‘iga yaqin + reyting */
export function bestPickScore(
  p: Record<string, unknown>,
  priceMedian: number,
  trending: Map<string, number>,
): number {
  const pr = Math.max(0, Number(p.price) || 0);
  const rt = Number(p.rating) || 0;
  const rc = Number(p.reviewCount) || 0;
  let band = 0.5;
  if (priceMedian > 0 && pr > 0) {
    const rel = Math.abs(pr - priceMedian) / priceMedian;
    band = Math.max(0, 1.1 - Math.min(1.1, rel));
  }
  const tr = Math.log1p(trending.get(String(p.id)) || 0) * 0.08;
  return band * 1.4 + Math.min(0.9, (rt / 5) * Math.log1p(rc) * 0.12) + tr;
}
