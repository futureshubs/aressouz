/**
 * Advanced personalization: taste vectors, session intent, multi-signal similarity,
 * collaborative hooks, MMR diversity, freshness, purchase propensity (linear model),
 * explain tags. Designed for Edge (Deno) — pure + small Supabase RPC calls.
 */

import * as M from "./reco-marketplace-intent.ts";

export type RecoEvent = {
  ts: number;
  type: string;
  productId?: string;
  categoryKey?: string;
  shopId?: string;
  price?: number;
  query?: string;
  title?: string;
  dwellMs?: number;
};

export type RankedRecoItem = {
  product: Record<string, unknown>;
  score: number;
  /** CTR/CVR proxy — tavsiya ustuvorligi */
  rankScore: number;
  reasons: string[];
  /** purchase ehtimoli (0..1) — linear model, kalibrlanmagan */
  purchasePropensity: number;
};

const GAMING = /\b(gaming|gamer|rgb|mechanical\s*keyboard|mouse\s*pad|headset|rtx|geforce|playstation|xbox|steam)\b/i;
const SPORT = /\b(sport|fitness|gym|running|yoga|nike|adidas|krossovka|futbol|basketbol)\b/i;
const LUXURY = /\b(luxury|premium|gold|designer|vip|exclusive|limited)\b/i;
const MINIMAL = /\b(minimal|minimalist|scandi|simple|clean)\b/i;
const BUDGET = /\b(arvon|arzon|chegirma|discount|ekonom|budget|tejang)\b/i;

function textOf(p: Record<string, unknown>): string {
  return `${String(p.name ?? "")} ${String(p.description ?? "")} ${String(p.title ?? "")}`.toLowerCase();
}

/** Mahsulotdan `reco` uchun xususiyatlar — KV `attrs` / `tags` / `specs` bo‘lsa ishlatiladi */
export function extractProductSignals(p: Record<string, unknown>): {
  price: number;
  categoryKey: string;
  shopId: string;
  tokens: Set<string>;
  premiumHint: number;
  budgetHint: number;
  sport: number;
  gaming: number;
  luxury: number;
  minimal: number;
  darkHint: number;
  colorfulHint: number;
} {
  const raw = textOf(p);
  const attrs = (p.attrs ?? p.attributes ?? p.tags ?? {}) as Record<string, unknown>;
  const attrStr = typeof attrs === "object" && attrs
    ? JSON.stringify(attrs).toLowerCase()
    : "";
  const blob = `${raw} ${attrStr}`;
  const price = Math.max(0, Number(p.price) || 0);
  const categoryKey = String(p.categoryId ?? p.category ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
  const shopId = String(p.shopId ?? p.brandId ?? "").trim();
  const tokens = new Set(
    blob
      .replace(/[^a-z0-9\u0400-\u04ff\s]/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 80),
  );
  return {
    price,
    categoryKey,
    shopId,
    tokens,
    premiumHint: LUXURY.test(blob) || /premium|pro max|ultra/i.test(blob) ? 1 : 0,
    budgetHint: BUDGET.test(blob) || (price > 0 && price < 80_000) ? 0.6 : 0,
    sport: SPORT.test(blob) ? 1 : 0,
    gaming: GAMING.test(blob) ? 1 : 0,
    luxury: LUXURY.test(blob) ? 1 : 0,
    minimal: MINIMAL.test(blob) ? 1 : 0,
    darkHint: /\b(qora|black|temnyj|dark\s*mode|matte\s*black)\b/i.test(blob) ? 1 : 0,
    colorfulHint: /\b(rgb|rangli|colorful|pastel|yashil|qizil|ko‘k|gul)\b/i.test(blob) ? 0.8 : 0,
  };
}

export function neutralTaste(): UserTasteVector {
  return {
    premium: 0,
    budget: 0,
    sport: 0,
    gaming: 0,
    luxury: 0,
    minimal: 0,
    dark: 0,
    colorful: 0,
    priceMedian: 0,
    spendHabit: 0.45,
  };
}

export type UserTasteVector = {
  premium: number;
  budget: number;
  sport: number;
  gaming: number;
  luxury: number;
  minimal: number;
  dark: number;
  colorful: number;
  /** median viewed/cart price */
  priceMedian: number;
  /** 0..1 cheap habit vs expensive */
  spendHabit: number;
};

function eventWeight(type: string, dwellMs?: number): number {
  switch (type) {
    case "purchase":
      return 10;
    case "cart_add":
      return 5;
    case "favorite_add":
      return 4;
    case "click":
      return 2;
    case "view":
      return 1;
    case "dwell": {
      const m = Math.max(0, Number(dwellMs) || 0);
      return m < 2500 ? 0 : Math.min(3, Math.log1p(m / 8000) * 1.6);
    }
    case "search":
      return 1.2;
    default:
      return 0.35;
  }
}

export function buildUserTaste(events: RecoEvent[], catalogById: Map<string, Record<string, unknown>>): UserTasteVector {
  const now = Date.now();
  let premium = 0,
    budget = 0,
    sport = 0,
    gaming = 0,
    luxury = 0,
    minimalKw = 0,
    dark = 0,
    colorful = 0;
  const prices: number[] = [];
  for (const e of events) {
    const ageDays = Math.max(0, (now - e.ts) / 86_400_000);
    const decay = Math.exp(-0.075 * ageDays);
    const w = decay * eventWeight(e.type, e.dwellMs);
    const pid = e.productId;
    if (!pid) continue;
    const p = catalogById.get(pid);
    if (!p) continue;
    const s = extractProductSignals(p);
    if (s.price > 0) prices.push(s.price);
    premium += w * (s.premiumHint + (s.price > 500_000 ? 0.4 : 0));
    budget += w * (s.budgetHint + (s.price > 0 && s.price < 100_000 ? 0.35 : 0));
    sport += w * s.sport;
    gaming += w * s.gaming;
    luxury += w * s.luxury;
    minimalKw += w * s.minimal;
    dark += w * s.darkHint;
    colorful += w * s.colorfulHint;
  }
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const spendHabit =
    sorted.length && mid > 0
      ? Math.min(1, Math.max(0, Math.log1p(mid / 50_000) / Math.log1p(200)))
      : 0.45;
  const norm = (x: number) => x / (1 + Math.abs(x) * 0.08);
  return {
    premium: norm(premium),
    budget: norm(budget),
    sport: norm(sport),
    gaming: norm(gaming),
    luxury: norm(luxury),
    minimal: norm(minimalKw),
    dark: norm(dark),
    colorful: norm(colorful),
    priceMedian: mid,
    spendHabit,
  };
}

/** Oxirgi ketma-katlikdan "gaming setup" kabi intent */
export function detectSessionIntent(
  recentProductIds: string[],
  catalogById: Map<string, Record<string, unknown>>,
): { tag: string; boostKeywords: RegExp; labelUz: string } | null {
  const last = recentProductIds.slice(-4);
  if (last.length < 2) return null;
  let g = 0,
    s = 0;
  for (const id of last) {
    const p = catalogById.get(id);
    if (!p) continue;
    const sig = extractProductSignals(p);
    g += sig.gaming;
    s += sig.sport;
  }
  if (g >= 1.5) {
    return {
      tag: "gaming_setup",
      boostKeywords: GAMING,
      labelUz: "O‘yin / texnika qiziqishi",
    };
  }
  if (s >= 1.2) {
    return {
      tag: "sport",
      boostKeywords: SPORT,
      labelUz: "Sport va aktiv hayot",
    };
  }
  return null;
}

function semanticTitleOverlap(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const ta = extractProductSignals(a).tokens;
  const tb = extractProductSignals(b).tokens;
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) {
    if (t.length > 3 && tb.has(t)) hit += 1;
  }
  return Math.min(1.2, hit * 0.18);
}

export function multiSignalSimilarity(
  candidate: Record<string, unknown>,
  seeds: Record<string, unknown>[],
  taste: UserTasteVector,
): number {
  if (!seeds.length) return 0;
  let best = 0;
  const c = extractProductSignals(candidate);
  for (const seed of seeds) {
    const s = extractProductSignals(seed);
    let x = 0;
    if (c.categoryKey && c.categoryKey === s.categoryKey) x += 2.4;
    if (c.shopId && s.shopId && c.shopId === s.shopId) x += 1.1;
    if (c.price > 0 && s.price > 0) {
      const rel = Math.abs(c.price - s.price) / Math.max(s.price, 1);
      x += Math.max(0, 1.35 - Math.min(1.35, rel));
    }
    x += semanticTitleOverlap(candidate, seed);
    x += taste.gaming * (c.gaming + s.gaming) * 0.55;
    x += taste.sport * (c.sport + s.sport) * 0.55;
    x += taste.luxury * (c.luxury + s.luxury) * 0.45;
    x += taste.minimal * (c.minimal + s.minimal) * 0.35;
    x += taste.dark * (c.darkHint + s.darkHint) * 0.25;
    x += taste.colorful * (c.colorfulHint + s.colorfulHint) * 0.2;
    if (taste.premium > 0.3) x += (c.premiumHint + s.premiumHint) * 0.25 * taste.premium;
    if (taste.budget > 0.3) x += (c.budgetHint + s.budgetHint) * 0.2 * taste.budget;
    best = Math.max(best, x);
  }
  return best;
}

function purchasePropensityLinear(p: Record<string, unknown>, taste: UserTasteVector, trending: Map<string, number>): number {
  const c = extractProductSignals(p);
  const rt = Number(p.rating) || 0;
  const rc = Number(p.reviewCount) || 0;
  const tr = trending.get(String(p.id)) || 0;
  const priceFit =
    taste.priceMedian > 0 && c.price > 0
      ? 1 - Math.min(1, Math.abs(c.price - taste.priceMedian) / taste.priceMedian)
      : 0.35;
  let z =
    0.12 +
    priceFit * 0.22 +
    Math.min(0.25, (rt / 5) * Math.log1p(rc) * 0.06) +
    Math.min(0.2, Math.log1p(tr) * 0.04) +
    taste.gaming * c.gaming * 0.08 +
    taste.sport * c.sport * 0.08 +
    taste.luxury * c.luxury * 0.06;
  if (Number(p.stockQuantity) <= 0) z *= 0.2;
  return Math.min(0.97, Math.max(0.02, z));
}

function freshnessBoost(p: Record<string, unknown>): number {
  const isNew = Boolean(p.isNew);
  const created = p.createdAt ? new Date(String(p.createdAt)).getTime() : 0;
  const ageDays = created ? Math.max(0, (Date.now() - created) / 86_400_000) : 99;
  const stalePenalty = Math.min(0.35, ageDays / 400);
  return (isNew ? 0.35 : 0) + Math.max(0, 0.25 - stalePenalty);
}

function explainFor(
  p: Record<string, unknown>,
  ctx: {
    taste: UserTasteVector;
    intent: ReturnType<typeof detectSessionIntent>;
    searchTokens: Set<string>;
    collaborative: Map<string, number>;
    trending: Map<string, number>;
    seedTitles: string[];
    searchModel?: M.SearchIntentModel;
    viewCounts?: Map<string, number>;
    complementAnchors?: Record<string, unknown>[];
    searchHit?: boolean;
    complementHit?: boolean;
  },
): string[] {
  const reasons: string[] = [];
  const blob = textOf(p);
  const pid = String(p.id ?? "");
  if (ctx.searchModel && ctx.viewCounts) {
    const extra = M.explainSearchAndView(
      p,
      ctx.searchModel,
      ctx.viewCounts,
      ctx.complementAnchors ?? [],
      Boolean(ctx.searchHit),
      Boolean(ctx.complementHit),
    );
    reasons.push(...extra);
  }
  if (ctx.collaborative.has(pid)) reasons.push("Sizga o‘xshash foydalanuvchilar ham ko‘rdi");
  if (ctx.trending.has(pid)) reasons.push("Bugun trendda");
  if (!reasons.includes("Siz qidirgansiz")) {
    for (const t of ctx.searchTokens) {
      if (t.length > 2 && blob.includes(t)) {
        reasons.push("Siz qidirgansiz");
        break;
      }
    }
  }
  if (ctx.intent?.boostKeywords.test(blob)) reasons.push(ctx.intent.labelUz);
  const s = extractProductSignals(p);
  if (ctx.taste.gaming > 0.4 && s.gaming) reasons.push("O‘yin uslubi");
  if (ctx.taste.sport > 0.4 && s.sport) reasons.push("Sport uslubi");
  if (ctx.seedTitles.some((ttl) => ttl.length > 4 && blob.includes(ttl.slice(0, 20).toLowerCase()))) {
    reasons.push("Shu mahsulotga o‘xshash");
  }
  if (reasons.length === 0) reasons.push("Sizga mos");
  return [...new Set(reasons)].slice(0, 4);
}

/** Mahsulot sahifasidagi "o‘xshashlar" — multi-signal, taste ixtiyoriy */
export function rankSimilarProductsAdvanced(
  seed: Record<string, unknown> | null,
  catalog: Record<string, unknown>[],
  taste: UserTasteVector,
  limit: number,
  excludeId?: string,
): Array<{ product: Record<string, unknown>; score: number; reasons: string[] }> {
  const ex = String(excludeId || seed?.id || "").trim();
  const seeds = seed ? [seed] : [];
  const pool = catalog.filter((p) => String(p.id) !== ex && Number(p.stockQuantity ?? 0) > 0);
  const scored = pool
    .map((p) => {
      const pr = p as Record<string, unknown>;
      const sim = seeds.length ? multiSignalSimilarity(pr, seeds as Record<string, unknown>[], taste) : 0;
      const rt = Number(pr.rating) || 0;
      const rc = Number(pr.reviewCount) || 0;
      const s = sim + (seeds.length ? 0 : rt * Math.log1p(rc) * 0.05);
      const reasons: string[] = [];
      if (
        seeds.length &&
        extractProductSignals(pr).categoryKey &&
        extractProductSignals(pr).categoryKey === extractProductSignals(seed as Record<string, unknown>).categoryKey
      ) {
        reasons.push("Bir xil toifa");
      }
      if (semanticTitleOverlap(pr, seed as Record<string, unknown>) > 0.2) reasons.push("Nom va tavsif o‘xshashligi");
      if (extractProductSignals(pr).gaming && extractProductSignals(seed as Record<string, unknown>).gaming) {
        reasons.push("O‘yin segmenti");
      }
      if (!reasons.length) reasons.push("Mahsulot o‘xshashligi");
      return { product: pr, score: s, reasons: [...new Set(reasons)].slice(0, 2) };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export async function fetchCollaborativeScores(
  sb: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> } | null,
  anchorProductId: string | null,
): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (!sb || !anchorProductId) return m;
  const { data, error } = await sb.rpc("reco_also_interacted", {
    p_product: anchorProductId,
    p_days: 21,
    p_limit: 80,
  });
  if (error || !Array.isArray(data)) return m;
  for (const row of data as { other_id?: string; co_score?: number }[]) {
    const id = String(row?.other_id || "").trim();
    const s = Number(row?.co_score);
    if (id) m.set(id, Number.isFinite(s) ? s : 0);
  }
  return m;
}

export function mmrDiversify(
  candidates: RankedRecoItem[],
  k: number,
  lambda: number,
): RankedRecoItem[] {
  const selected: RankedRecoItem[] = [];
  const pool = [...candidates].sort((a, b) => b.rankScore - a.rankScore);
  const catCount = new Map<string, number>();
  const shopCount = new Map<string, number>();
  while (selected.length < k && pool.length) {
    let bestIdx = 0;
    let bestMm = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      const ck = extractProductSignals(c.product).categoryKey || "_";
      const sid = extractProductSignals(c.product).shopId || "_";
      const div =
        ((catCount.get(ck) || 0) > 2 ? 0.45 : 0) +
        ((shopCount.get(sid) || 0) > 3 ? 0.55 : 0) +
        selected.some((s) => String(s.product.id) === String(c.product.id))
          ? 5
          : 0;
      const mmr = lambda * c.rankScore - (1 - lambda) * div;
      if (mmr > bestMm) {
        bestMm = mmr;
        bestIdx = i;
      }
    }
    const pick = pool.splice(bestIdx, 1)[0];
    const ck = extractProductSignals(pick.product).categoryKey || "_";
    const sid = extractProductSignals(pick.product).shopId || "_";
    catCount.set(ck, (catCount.get(ck) || 0) + 1);
    shopCount.set(sid, (shopCount.get(sid) || 0) + 1);
    selected.push(pick);
  }
  return selected;
}

export async function rankPersonalizedV2(opts: {
  events: RecoEvent[];
  catalog: Record<string, unknown>[];
  trending: Map<string, number>;
  collaborative: Map<string, number>;
  excludeId?: string;
  limit: number;
}): Promise<RankedRecoItem[]> {
  const { events, catalog, trending, collaborative, excludeId, limit } = opts;
  const now = Date.now();
  const byId = new Map<string, Record<string, unknown>>(catalog.map((p) => [String(p.id), p as Record<string, unknown>]));
  const taste = buildUserTaste(events, byId);
  const coldBoost = events.length < 4 ? 1.45 : 1;

  const searchModel = M.buildSearchIntentFromEvents(events as M.RecoEv[], now);
  const viewCounts = M.countProductViews(events as M.RecoEv[], now);
  const sessionIds = M.sessionViewedIds(events as M.RecoEv[], now);

  const recentViewIds: string[] = [];
  for (let i = events.length - 1; i >= 0 && recentViewIds.length < 10; i--) {
    const e = events[i];
    if (e.type === "view" && e.productId) recentViewIds.unshift(String(e.productId));
  }
  const recentClickIds: string[] = [];
  for (let i = events.length - 1; i >= 0 && recentClickIds.length < 6; i--) {
    const e = events[i];
    if (e.type === "click" && e.productId && M.orphanClickFactor(events as M.RecoEv[], e.productId, now) > 0.42) {
      recentClickIds.unshift(String(e.productId));
    }
  }
  const recentIds = [...new Set([...recentViewIds.slice(-5), ...recentClickIds.slice(-2)])];
  const intent = detectSessionIntent(recentIds, byId);
  const seeds = recentIds
    .map((id) => byId.get(id))
    .filter((x): x is Record<string, unknown> => Boolean(x))
    .slice(-4);
  const complementAnchors = seeds.slice(-3);

  const searchTokens = new Set<string>();
  for (const e of events) {
    if (e.type !== "search" || !e.query) continue;
    for (const t of e.query.toLowerCase().split(/\s+/).filter((x) => x.length > 2)) searchTokens.add(t.slice(0, 40));
  }
  for (const [tok] of searchModel.weights) {
    if (tok.length > 2) searchTokens.add(tok);
  }

  const ex = String(excludeId || "").trim();
  const pool = catalog.filter((p) => {
    if (ex && String(p.id) === ex) return false;
    return Number(p.stockQuantity ?? 0) > 0;
  });

  const ctxForExplain = {
    taste,
    intent,
    searchTokens,
    collaborative,
    trending,
    seedTitles: seeds.map((s) => String(s.name ?? "").toLowerCase()),
    searchModel,
    viewCounts,
    complementAnchors,
  };

  const scored: RankedRecoItem[] = pool.map((p) => {
    const pr = p as Record<string, unknown>;
    const pid = String(pr.id ?? "");
    const pBlob = textOf(pr);
    const collab = collaborative.get(pid) || 0;
    const trend = trending.get(pid) || 0;
    const sim = multiSignalSimilarity(pr, seeds, taste);
    let intentBoost = 0;
    if (intent?.boostKeywords.test(textOf(pr))) intentBoost = 1.35;

    const searchPart = M.searchIntentMatchScore(pBlob, searchModel) * 3.45;
    const searchHit = searchPart > 0.55;
    const comp = M.complementScore(complementAnchors, pr);
    const complementHit = comp > 0.85;

    const viewBoost =
      (viewCounts.get(pid) || 0) * 0.62 +
      M.repeatedViewBonus(viewCounts, pid) +
      (sessionIds.has(pid) ? 1.15 : 0);

    const tasteDot =
      taste.premium * extractProductSignals(pr).premiumHint * 0.4 +
      taste.budget * extractProductSignals(pr).budgetHint * 0.35 +
      taste.gaming * extractProductSignals(pr).gaming * 0.9 +
      taste.sport * extractProductSignals(pr).sport * 0.9 +
      taste.luxury * extractProductSignals(pr).luxury * 0.5 +
      taste.minimal * extractProductSignals(pr).minimal * 0.35;

    const fresh = freshnessBoost(pr);
    const prop = purchasePropensityLinear(pr, taste, trending);

    const rankScore =
      searchPart +
      sim * 1.05 +
      tasteDot * 0.78 +
      viewBoost * 0.95 +
      comp * 1.25 +
      Math.log1p(collab) * 0.38 +
      Math.log1p(trend + 1) * 0.26 * coldBoost +
      intentBoost +
      fresh * 0.5 +
      prop * 1.05 +
      (Number(pr.rating) || 0) * 0.055 * Math.log1p(Number(pr.reviewCount) || 0) * 0.038;

    const reasons = explainFor(pr, {
      ...ctxForExplain,
      searchHit,
      complementHit,
    });

    return {
      product: pr,
      score: sim + tasteDot + searchPart * 0.3,
      rankScore,
      reasons,
      purchasePropensity: prop,
    };
  });

  scored.sort((a, b) => b.rankScore - a.rankScore);
  const topN = scored.slice(0, Math.min(120, Math.max(limit * 6, 48)));
  return mmrDiversify(topN, limit, 0.72);
}

/** Feed: “Siz qidirgan narsalar” */
export function sectionFromSearch(
  catalog: Record<string, unknown>[],
  searchModel: M.SearchIntentModel,
  excludeId: string,
  limit: number,
): Record<string, unknown>[] {
  const ex = String(excludeId || "").trim();
  const scored = catalog
    .filter((p) => String(p.id) !== ex && Number(p.stockQuantity ?? 0) > 0)
    .map((p) => ({
      p,
      s: M.searchIntentMatchScore(textOf(p as Record<string, unknown>), searchModel),
    }))
    .filter((x) => x.s > 0.35)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => ({
    ...x.p,
    recoReasons: ["Siz qidirgansiz"],
  })) as Record<string, unknown>[];
}

/** Feed: “Shu mahsulot bilan olinadi” */
export function sectionComplements(
  catalog: Record<string, unknown>[],
  anchors: Record<string, unknown>[],
  excludeId: string,
  limit: number,
): Record<string, unknown>[] {
  if (!anchors.length) return [];
  const ex = new Set<string>(anchors.map((a) => String(a.id ?? "")).filter(Boolean));
  const x = String(excludeId || "").trim();
  if (x) ex.add(x);
  const scored = catalog
    .filter((p) => !ex.has(String(p.id)) && Number(p.stockQuantity ?? 0) > 0)
    .map((p) => ({ p, s: M.complementScore(anchors, p as Record<string, unknown>) }))
    .filter((x) => x.s > 0.4)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => ({
    ...x.p,
    recoReasons: ["Shu mahsulot bilan olinadi"],
  })) as Record<string, unknown>[];
}

/** Feed: “Sizga mos top variantlar” */
export function sectionBestPicks(
  catalog: Record<string, unknown>[],
  priceMedian: number,
  trending: Map<string, number>,
  excludeId: string,
  limit: number,
): Record<string, unknown>[] {
  const ex = String(excludeId || "").trim();
  const scored = catalog
    .filter((p) => String(p.id) !== ex && Number(p.stockQuantity ?? 0) > 0)
    .map((p) => ({
      p,
      s: M.bestPickScore(p as Record<string, unknown>, priceMedian, trending),
    }))
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => ({
    ...x.p,
    recoReasons: ["Sizga mos top variantlar"],
  })) as Record<string, unknown>[];
}
