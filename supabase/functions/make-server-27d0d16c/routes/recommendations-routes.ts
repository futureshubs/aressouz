import type { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "../kv_store.tsx";
import {
  buildUserTaste,
  detectSessionIntent,
  fetchCollaborativeScores,
  neutralTaste,
  rankPersonalizedV2,
  rankSimilarProductsAdvanced,
  sectionBestPicks,
  sectionComplements,
  sectionFromSearch,
  type RecoEvent,
} from "./reco-advanced-engine.ts";
import * as RecoMarket from "./reco-marketplace-intent.ts";

const RECO_LOG_PREFIX = "reco_log:v1:";
const MAX_EVENTS = 220;
const MAX_EVENTS_PER_POST = 25;
/** Daqiqada identity bo‘yicha maksimal hodisalar (spam / fake click) */
const RATE_LIMIT_EVENTS_PER_MIN = 160;
const RATE_WINDOW_MS = 60_000;
const VIEW_DEDUPE_MS = 28_000;
/** Bir worker ichida katalogni qisqa muddat keshlash (1M+ uchun to‘liq yechim emas — Redis/worker keyingi bosqich) */
const CATALOG_MEM_TTL_MS = 48_000;
let _catalogMem: { at: number; region: string | null; district: string | null; data: any[] } | null = null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STOP = new Set([
  "va",
  "yoki",
  "uchun",
  "bu",
  "bir",
  "the",
  "and",
  "for",
  "with",
]);

type RecoStoredEvent = {
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

let _recoSb: ReturnType<typeof createClient> | null = null;
function recoSupabase(): ReturnType<typeof createClient> | null {
  if (_recoSb) return _recoSb;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _recoSb = createClient(url, key);
  return _recoSb;
}

async function resolveUserIdFromAccessHeader(c: {
  req: { header: (n: string) => string | undefined };
}): Promise<string | null> {
  const raw =
    c.req.header("X-Access-Token") ||
    c.req.header("x-access-token") ||
    "";
  const token = String(raw || "").trim();
  if (!token) return null;
  const data = await kv.get(`access_token:${token}`);
  if (!data || typeof data !== "object") return null;
  const exp = Number((data as { expiresAt?: unknown }).expiresAt);
  if (Number.isFinite(exp) && Date.now() > exp) return null;
  const uid = String((data as { userId?: unknown }).userId || "").trim();
  return uid || null;
}

function recoIdentityKey(userId: string | null, anonymousId: string | null): string | null {
  if (userId) return `${RECO_LOG_PREFIX}u:${userId}`;
  if (anonymousId && UUID_RE.test(anonymousId)) return `${RECO_LOG_PREFIX}a:${anonymousId.toLowerCase()}`;
  return null;
}

function identityKeyForPg(recoKey: string): string {
  return recoKey.replace(RECO_LOG_PREFIX, "");
}

function normalizeCategoryKey(p: Record<string, unknown>): string {
  const a = String(p.categoryId ?? p.category ?? "").trim().toLowerCase();
  if (a) return a.slice(0, 120);
  const b = String(p.category ?? "").trim().toLowerCase();
  return b.slice(0, 120);
}

/** Do‘kon mahsuloti: variant zaxirasi yig‘indisi */
function normalizeShopProductForPublicResponse(product: any): { base: any; totalStock: number } {
  const rawVars = Array.isArray(product?.variants) ? product.variants : [];
  if (rawVars.length === 0) {
    const t = Math.max(
      0,
      Math.floor(Number(product?.stock ?? product?.stockQuantity ?? product?.stockCount ?? 0)),
    );
    return { base: { ...product }, totalStock: Number.isFinite(t) ? t : 0 };
  }
  const normalizedVariants = rawVars.map((v: any) => {
    const st = Math.max(
      0,
      Math.floor(Number(v?.stock ?? v?.stockQuantity ?? v?.stockCount ?? 0)),
    );
    const n = Number.isFinite(st) ? st : 0;
    return { ...v, stock: n, stockQuantity: n };
  });
  const totalStock = normalizedVariants.reduce((s: number, v: any) => s + (Number(v.stock) || 0), 0);
  return { base: { ...product, variants: normalizedVariants }, totalStock };
}

async function loadFormattedCatalogUncached(region: string | null, district: string | null): Promise<any[]> {
  const marketProducts = await kv.getByPrefix("product:");
  const shopProducts = await kv.getByPrefix("shop_product:");

  const formattedMarketProducts = marketProducts
    .filter((product: any) => {
      if (region && product.region && product.region !== region) return false;
      if (district && product.district && product.district !== district) return false;
      return true;
    })
    .map((product: any) => ({
      ...product,
      source: "market",
      price: product.price || 0,
      oldPrice: product.oldPrice || null,
      image: product.image || product.images?.[0] || null,
      stockQuantity: product.stock || 0,
      category: product.category || "Market",
      rating: Number(product.rating || 0),
      reviewCount: Number(product.reviewCount || 0),
      isNew:
        product.createdAt &&
        new Date(product.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      isBestseller: product.isBestseller || false,
    }));

  const formattedShopProducts = shopProducts
    .filter((p: any) => {
      if (!p || p.deleted) return false;
      if (region && p.region && p.region !== region) return false;
      if (district && p.district && p.district !== district) return false;
      return true;
    })
    .map((product: any) => {
      const { base, totalStock } = normalizeShopProductForPublicResponse(product);
      const firstVariant = base.variants?.[0];
      return {
        ...base,
        source: "shop",
        price: firstVariant?.price || 0,
        oldPrice: firstVariant?.oldPrice || null,
        image: firstVariant?.images?.[0] || null,
        stockQuantity: totalStock,
        variantsCount: base.variants?.length || 0,
        category: base.category || "Do'kon",
        shopName: base.shopName || null,
        rating: Number(base.rating || 0),
        reviewCount: Number(base.reviewCount || 0),
        isNew:
          base.createdAt &&
          new Date(base.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        isBestseller: false,
      };
    });

  return [...formattedMarketProducts, ...formattedShopProducts];
}

async function loadFormattedCatalog(region: string | null, district: string | null): Promise<any[]> {
  const now = Date.now();
  if (
    _catalogMem &&
    now - _catalogMem.at < CATALOG_MEM_TTL_MS &&
    _catalogMem.region === region &&
    _catalogMem.district === district
  ) {
    return _catalogMem.data;
  }
  const data = await loadFormattedCatalogUncached(region, district);
  _catalogMem = { at: now, region, district, data };
  return data;
}

function tokenizeQuery(q: string): string[] {
  const s = String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff\s-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
  return [...new Set(s)].slice(0, 24);
}

function baseWeight(type: string): number {
  switch (type) {
    case "purchase":
      return 10;
    case "cart_add":
      return 5;
    case "favorite_add":
      return 4;
    case "favorite_remove":
      return -2;
    case "search":
      return 1.6;
    case "click":
      return 2;
    case "view":
      return 1;
    case "category_view":
      return 0.35;
    case "dwell":
      return 0;
    default:
      return 0.45;
  }
}

function dwellWeight(ms: number | undefined): number {
  const m = Math.max(0, Number(ms) || 0);
  if (m < 2500) return 0;
  return Math.min(3.2, Math.log1p(m / 7000) * 1.85);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

async function checkRecoRateLimit(
  identityKey: string,
  addCount = 1,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const k = `reco_rl:v1:${identityKey}`;
  const now = Date.now();
  const prev = (await kv.get(k)) as { ts?: number[] } | null;
  const base = (Array.isArray(prev?.ts) ? prev!.ts! : []).filter((t) => now - t < RATE_WINDOW_MS);
  const n = Math.min(40, Math.max(1, Math.floor(addCount) || 1));
  for (let i = 0; i < n; i++) base.push(now);
  if (base.length > RATE_LIMIT_EVENTS_PER_MIN) {
    return { ok: false, error: "Juda tez-so‘rov (rate limit)" };
  }
  await kv.set(k, { ts: base });
  return { ok: true };
}

/** Rage click / refresh spam: bir mahsulotga qisqa vaqt ichida juda ko‘p click */
async function shouldDropRageClick(identityKey: string, e: RecoStoredEvent): Promise<boolean> {
  if (e.type !== "click" || !e.productId) return false;
  const k = `reco_rage:v1:${identityKey}:${e.productId}`;
  const now = Date.now();
  const windowMs = 6500;
  const maxClicks = 14;
  const prev = (await kv.get(k)) as { ts?: number[] } | null;
  const arr = [...(Array.isArray(prev?.ts) ? prev!.ts! : []), now].filter((t) => now - t < windowMs);
  await kv.set(k, { ts: arr });
  return arr.length > maxClicks;
}

function recentDuplicateView(merged: RecoStoredEvent[], incoming: RecoStoredEvent): boolean {
  if (incoming.type !== "view" || !incoming.productId) return false;
  const now = incoming.ts;
  for (let i = merged.length - 1; i >= 0; i--) {
    const e = merged[i];
    if (now - e.ts > VIEW_DEDUPE_MS) break;
    if (e.type === "view" && e.productId === incoming.productId) return true;
  }
  return false;
}

async function persistToPostgres(
  identityKey: string,
  authUserId: string | null,
  events: RecoStoredEvent[],
): Promise<void> {
  const sb = recoSupabase();
  if (!sb || events.length === 0) return;
  const pgId = identityKeyForPg(identityKey);
  const uid = authUserId && UUID_RE.test(authUserId) ? authUserId : null;
  const rows = events.map((e) => ({
    identity_key: pgId,
    auth_user_id: uid,
    event_type: e.type,
    product_id: e.productId ?? null,
    category_key: e.categoryKey ?? null,
    shop_id: e.shopId ?? null,
    price: e.price ?? null,
    query: e.query ?? null,
    dwell_ms: e.dwellMs ?? null,
    metadata: { title: e.title ?? null },
  }));
  const { error } = await sb.from("reco_user_activity").insert(rows);
  if (error) {
    console.error("[reco] reco_user_activity insert:", error.message);
    return;
  }
  for (const e of events) {
    if (e.type !== "search" || !e.query) continue;
    const norm = e.query.trim().toLowerCase().slice(0, 240);
    if (!norm) continue;
    const { error: e2 } = await sb.from("reco_search_history").insert({
      identity_key: pgId,
      auth_user_id: uid,
      query_raw: e.query.slice(0, 400),
      query_norm: norm,
    });
    if (e2) console.error("[reco] reco_search_history insert:", e2.message);
  }
}

async function fetchTrendingProductScores(
  hours: number,
): Promise<Map<string, number>> {
  const sb = recoSupabase();
  const m = new Map<string, number>();
  if (!sb) return m;
  const { data, error } = await sb.rpc("reco_trending_product_ids", {
    p_hours: Math.max(1, Math.min(168, hours)),
    p_limit: 120,
  });
  if (error || !Array.isArray(data)) return m;
  for (const row of data as { product_id?: string; score?: number }[]) {
    const id = String(row?.product_id || "").trim();
    const s = Number(row?.score);
    if (id) m.set(id, Number.isFinite(s) ? s : 0);
  }
  return m;
}

async function validateRecoAdminSession(c: {
  req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined };
}): Promise<boolean> {
  const sessionTok =
    c.req.header("X-Admin-Session") ||
    c.req.header("x-admin-session") ||
    String(c.req.query("adminSession") || "");
  const tok = String(sessionTok).trim();
  if (!tok) return false;
  const srow = await kv.get(`admin_session:${tok}`);
  const exp = srow?.expiresAt ? new Date(srow.expiresAt).getTime() : 0;
  return exp > Date.now();
}

function scoreFromEvents(
  events: RecoStoredEvent[],
  catalog: any[],
  opts: {
    excludeId?: string;
    limit: number;
    trending?: Map<string, number>;
    boostProductIds?: Set<string>;
  },
): any[] {
  const now = Date.now();
  const catW = new Map<string, number>();
  const tokW = new Map<string, number>();
  const shopW = new Map<string, number>();
  const priceSamples: number[] = [];
  const prodW = new Map<string, number>();

  for (const e of events) {
    const ageDays = Math.max(0, (now - e.ts) / 86_400_000);
    const decay = Math.exp(-0.068 * ageDays);
    let w = decay * baseWeight(e.type);
    if (e.type === "dwell") w = decay * dwellWeight(e.dwellMs);
    if (e.categoryKey) {
      catW.set(e.categoryKey, (catW.get(e.categoryKey) || 0) + w);
    }
    if (e.shopId) {
      shopW.set(e.shopId, (shopW.get(e.shopId) || 0) + w * 0.45);
    }
    if (e.query) {
      for (const t of tokenizeQuery(e.query)) {
        tokW.set(t, (tokW.get(t) || 0) + w);
      }
    }
    if (typeof e.price === "number" && Number.isFinite(e.price) && e.price > 0) {
      priceSamples.push(e.price);
    }
    if (e.productId) {
      prodW.set(e.productId, (prodW.get(e.productId) || 0) + w);
    }
  }

  const catalogById = new Map<string, any>(catalog.map((p) => [String(p.id), p]));
  for (const [pid, w] of prodW) {
    const p0 = catalogById.get(pid);
    if (!p0) continue;
    const ck = normalizeCategoryKey(p0);
    catW.set(ck, (catW.get(ck) || 0) + w * 0.75);
    const sid = String(p0.shopId || "");
    if (sid) shopW.set(sid, (shopW.get(sid) || 0) + w * 0.35);
  }

  const med = median(priceSamples);
  const cold = events.length < 4 || [...catW.values()].reduce((a, b) => a + b, 0) < 0.35;

  const exclude = String(opts.excludeId || "").trim();
  const candidates = catalog.filter((p) => {
    if (exclude && String(p.id) === exclude) return false;
    const stock = Number(p.stockQuantity ?? 0);
    return Number.isFinite(stock) && stock > 0;
  });

  function tokenOverlapScore(p: Record<string, unknown>): number {
    if (tokW.size === 0) return 0;
    const blob = `${String(p.name || "")} ${String(p.description || "")}`.toLowerCase();
    let s = 0;
    for (const [t, wv] of tokW) {
      if (t.length >= 2 && blob.includes(t)) s += wv * 0.85;
    }
    return s;
  }

  function rankOne(p: any): number {
    const ck = normalizeCategoryKey(p);
    let s = (catW.get(ck) || 0) * 2.35;
    const sid = String(p.shopId || "");
    if (sid) s += shopW.get(sid) || 0;
    s += tokenOverlapScore(p);
    const rep = String(p.id);
    s += (prodW.get(rep) || 0) * 1.1;
    if (opts.boostProductIds?.has(rep)) s += 2.4;
    if (med > 0) {
      const pr = Number(p.price) || 0;
      if (pr > 0) {
        const rel = Math.abs(pr - med) / med;
        s += Math.max(0, 1.15 - Math.min(1.15, rel));
      }
    }
    if (opts.trending?.has(rep)) s += 0.42 + Math.min(1.5, Math.log1p(opts.trending.get(rep) || 0) * 0.12);
    if (p.isBestseller) s += 0.4;
    const rc = Number(p.reviewCount) || 0;
    const rt = Number(p.rating) || 0;
    if (rc > 0 && rt > 0) s += Math.min(0.6, (rt / 5) * Math.log1p(rc) * 0.12);
    const id = String(p.id ?? "");
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
    s += ((h >>> 0) % 1000) * 1e-6;
    return s;
  }

  if (cold) {
    return [...candidates]
      .sort((a, b) => {
        const tb = (opts.trending?.get(String(b.id)) || 0) * 2 + (Number(b.reviewCount) || 0) * (Number(b.rating) || 0);
        const ta = (opts.trending?.get(String(a.id)) || 0) * 2 + (Number(a.reviewCount) || 0) * (Number(a.rating) || 0);
        if (tb !== ta) return tb - ta;
        return String(a.id).localeCompare(String(b.id));
      })
      .slice(0, opts.limit);
  }

  const scored = candidates
    .map((p) => ({ p, s: rankOne(p) }))
    .sort((a, b) => b.s - a.s);

  const out: any[] = [];
  const shopCount = new Map<string, number>();
  for (const { p } of scored) {
    if (out.length >= opts.limit) break;
    const sid2 = String(p.shopId || "");
    if (sid2) {
      const c = shopCount.get(sid2) || 0;
      if (c >= 4) continue;
      shopCount.set(sid2, c + 1);
    }
    out.push(p);
  }

  if (out.length < Math.min(opts.limit, 8)) {
    for (const { p } of scored) {
      if (out.length >= opts.limit) break;
      if (out.some((x) => String(x.id) === String(p.id))) continue;
      out.push(p);
    }
  }

  return out.slice(0, opts.limit);
}

function pickLastViewedProductId(events: RecoStoredEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if ((e.type === "view" || e.type === "click") && e.productId) return e.productId;
  }
  return null;
}

function topCategoryFromEvents(events: RecoStoredEvent[], catalog: any[]): string | null {
  const now = Date.now();
  const w = new Map<string, number>();
  const byId = new Map(catalog.map((p) => [String(p.id), p]));
  for (const e of events) {
    const ageDays = Math.max(0, (now - e.ts) / 86_400_000);
    const decay = Math.exp(-0.068 * ageDays);
    let w0 = decay * baseWeight(e.type);
    if (e.type === "dwell") w0 = decay * dwellWeight(e.dwellMs);
    if (e.categoryKey) w.set(e.categoryKey, (w.get(e.categoryKey) || 0) + w0);
    if (e.productId) {
      const p = byId.get(e.productId);
      if (p) {
        const ck = normalizeCategoryKey(p);
        w.set(ck, (w.get(ck) || 0) + w0 * 0.9);
      }
    }
  }
  let best: string | null = null;
  let bestV = 0;
  for (const [k, v] of w) {
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return best;
}

function similarFromCatalog(seed: any | null, catalog: any[], limit: number, excludeId?: string): any[] {
  if (!seed) {
    return catalog
      .filter((p) => Number(p.stockQuantity) > 0)
      .sort((a, b) => (Number(b.rating) || 0) * Math.log1p(Number(b.reviewCount) || 0) - (Number(a.rating) || 0) * Math.log1p(Number(a.reviewCount) || 0))
      .slice(0, limit);
  }
  const ex = String(excludeId || seed.id || "");
  const ck = normalizeCategoryKey(seed);
  const price = Number(seed.price) || 0;
  const brand = String(seed.shopId || seed.brandId || "");
  const scored = catalog
    .filter((p) => String(p.id) !== ex && Number(p.stockQuantity) > 0)
    .map((p) => {
      let s = 0;
      if (normalizeCategoryKey(p) === ck) s += 3;
      const pr = Number(p.price) || 0;
      if (price > 0 && pr > 0) {
        const rel = Math.abs(pr - price) / price;
        s += Math.max(0, 1.2 - Math.min(1.2, rel));
      }
      if (brand && String(p.shopId || "") === brand) s += 0.85;
      const rt = Number(p.rating) || 0;
      const rc = Number(p.reviewCount) || 0;
      s += Math.min(0.9, (rt / 5) * Math.log1p(rc) * 0.14);
      return { p, s };
    })
    .sort((a, b) => b.s - a.s);
  return scored.map((x) => x.p).slice(0, limit);
}

function buyAgainFromEvents(events: RecoStoredEvent[], catalog: any[], limit: number): any[] {
  const ids = new Set<string>();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "purchase" && e.productId) ids.add(e.productId);
  }
  const byId = new Map(catalog.map((p) => [String(p.id), p]));
  const out: any[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p && Number(p.stockQuantity) > 0) out.push(p);
    if (out.length >= limit) return out;
  }
  return out;
}

function sanitizeIncomingEvent(raw: Record<string, unknown>): RecoStoredEvent | null {
  const type = String(raw.type || "").trim().toLowerCase();
  const allowed = new Set([
    "view",
    "click",
    "search",
    "favorite_add",
    "favorite_remove",
    "cart_add",
    "purchase",
    "category_view",
    "dwell",
  ]);
  if (!allowed.has(type)) return null;
  const ts = Number(raw.ts);
  const t = Number.isFinite(ts) && ts > 0 ? Math.min(Date.now(), ts) : Date.now();
  const productId = String(raw.productId || raw.pid || "").trim().slice(0, 80) || undefined;
  const categoryKey = String(raw.categoryId || raw.categoryKey || raw.cat || "")
    .trim()
    .toLowerCase()
    .slice(0, 120) || undefined;
  const shopId = String(raw.shopId || raw.sid || "").trim().slice(0, 80) || undefined;
  const priceN = Number(raw.price);
  const price = Number.isFinite(priceN) && priceN > 0 ? Math.min(priceN, 9_999_999_999) : undefined;
  const query = String(raw.query || raw.q || "").trim().slice(0, 200) || undefined;
  const title = String(raw.title || raw.ttl || "").trim().slice(0, 200) || undefined;
  const dm = Number(raw.dwellMs ?? raw.dwell_ms);
  const dwellMs = type === "dwell" && Number.isFinite(dm) && dm >= 0 ? Math.min(Math.floor(dm), 3_600_000) : undefined;
  return { ts: t, type, productId, categoryKey, shopId, price, query, title, dwellMs };
}

export function registerRecommendationRoutes(app: Hono): void {
  app.post("/make-server-27d0d16c/recommendations/track-action", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const anonymousId = String(body?.anonymousId || "").trim();
      const userId = await resolveUserIdFromAccessHeader(c);
      const key = recoIdentityKey(userId, anonymousId || null);
      if (!key) {
        return c.json(
          { success: false, error: "anonymousId (UUID) yoki tizimga kirish (X-Access-Token) kerak" },
          400,
        );
      }
      const rl = await checkRecoRateLimit(key, 1);
      if (!rl.ok) return c.json({ success: false, error: rl.error }, 429);

      const raw = typeof body?.action === "object" && body.action ? body.action : body;
      const e = sanitizeIncomingEvent(raw as Record<string, unknown>);
      if (!e) return c.json({ success: false, error: "Noto‘g‘ri action" }, 400);
      if (await shouldDropRageClick(key, e)) {
        return c.json({ success: true, saved: 0, skipped: true, reason: "rage_click" });
      }

      const prev = (await kv.get(key)) as { events?: RecoStoredEvent[] } | null;
      const mergedBase = [...(Array.isArray(prev?.events) ? prev!.events! : [])];
      let skip = false;
      if (e.type === "view" && recentDuplicateView(mergedBase, e)) skip = true;
      const merged = skip
        ? mergedBase
        : [...mergedBase, e].sort((a, b) => a.ts - b.ts).slice(-MAX_EVENTS);

      if (!skip) await kv.set(key, { events: merged, updatedAt: new Date().toISOString() });
      await persistToPostgres(key, userId && UUID_RE.test(userId) ? userId : null, skip ? [] : [e]);

      return c.json({ success: true, saved: skip ? 0 : 1, skipped: skip });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Xatolik";
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.post("/make-server-27d0d16c/recommendations/events", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const anonymousId = String(body?.anonymousId || "").trim();
      const userId = await resolveUserIdFromAccessHeader(c);
      const key = recoIdentityKey(userId, anonymousId || null);
      if (!key) {
        return c.json(
          {
            success: false,
            error: "anonymousId (UUID) yoki tizimga kirish (X-Access-Token) kerak",
          },
          400,
        );
      }

      const rawList = Array.isArray(body?.events) ? body.events : [];
      if (rawList.length === 0) {
        return c.json({ success: true, saved: 0 });
      }
      if (rawList.length > MAX_EVENTS_PER_POST) {
        return c.json({ success: false, error: "Juda ko‘p hodisa" }, 400);
      }

      const preIncoming: RecoStoredEvent[] = [];
      for (const r of rawList) {
        if (typeof r !== "object" || !r) continue;
        const e = sanitizeIncomingEvent(r as Record<string, unknown>);
        if (e) preIncoming.push(e);
      }
      if (preIncoming.length === 0) {
        return c.json({ success: true, saved: 0 });
      }

      const rl = await checkRecoRateLimit(key, preIncoming.length);
      if (!rl.ok) return c.json({ success: false, error: rl.error }, 429);

      const incoming = preIncoming;

      const prev = (await kv.get(key)) as { events?: RecoStoredEvent[] } | null;
      let merged = [...(Array.isArray(prev?.events) ? prev!.events! : [])];
      const toSave: RecoStoredEvent[] = [];
      for (const e of incoming) {
        if (e.type === "view" && recentDuplicateView(merged, e)) continue;
        if (await shouldDropRageClick(key, e)) continue;
        merged.push(e);
        toSave.push(e);
      }
      merged = merged.sort((a, b) => a.ts - b.ts).slice(-MAX_EVENTS);

      await kv.set(key, { events: merged, updatedAt: new Date().toISOString() });
      await persistToPostgres(key, userId && UUID_RE.test(userId) ? userId : null, toSave);

      return c.json({ success: true, saved: toSave.length, total: merged.length });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Xatolik";
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.get("/make-server-27d0d16c/recommendations/admin/metrics", async (c) => {
    try {
      if (!(await validateRecoAdminSession(c))) {
        return c.json({ success: false, error: "Admin sessiyasi kerak (X-Admin-Session)" }, 403);
      }
      const days = Math.min(90, Math.max(1, Math.floor(Number(c.req.query("days") || "7") || 7)));
      const limit = Math.min(100, Math.max(5, Math.floor(Number(c.req.query("limit") || "20") || 20)));
      const sb = recoSupabase();
      if (!sb) {
        return c.json({ success: false, error: "PostgreSQL sozlanmagan", metrics: null }, 503);
      }
      const [clicks, views, heat] = await Promise.all([
        sb.rpc("reco_top_products", { p_days: days, p_event: "click", p_limit: limit }),
        sb.rpc("reco_top_products", { p_days: days, p_event: "view", p_limit: limit }),
        sb.rpc("reco_category_heatmap", { p_days: days, p_limit: limit }),
      ]);
      return c.json({
        success: true,
        days,
        topClickedProducts: clicks.data ?? [],
        topViewedProducts: views.data ?? [],
        categoryHeatmap: heat.data ?? [],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Xatolik";
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.get("/make-server-27d0d16c/recommendations/similar/:productId", async (c) => {
    try {
      const productId = String(c.req.param("productId") || "").trim();
      const region = c.req.query("region") || null;
      const district = c.req.query("district") || null;
      const limit = Math.min(36, Math.max(4, Math.floor(Number(c.req.query("limit") || "16") || 16)));
      const catalog = await loadFormattedCatalog(region, district);
      const seed = catalog.find((p) => String(p.id) === productId) || null;
      const anonymousId = String(c.req.query("anonymousId") || "").trim();
      const userId = await resolveUserIdFromAccessHeader(c);
      const recoKey = recoIdentityKey(userId, anonymousId || null);
      let taste = neutralTaste();
      if (recoKey) {
        const pack = (await kv.get(recoKey)) as { events?: RecoStoredEvent[] } | null;
        const ev = Array.isArray(pack?.events) ? pack!.events! : [];
        const byId = new Map<string, Record<string, unknown>>(catalog.map((p) => [String(p.id), p as Record<string, unknown>]));
        taste = buildUserTaste(ev as RecoEvent[], byId);
      }
      const ranked = rankSimilarProductsAdvanced(
        seed as Record<string, unknown> | null,
        catalog as Record<string, unknown>[],
        taste,
        limit,
        productId,
      );
      const products = ranked.map((r) => ({ ...r.product, recoReasons: r.reasons }));
      return c.json({ success: true, count: products.length, products, seedId: productId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Xatolik";
      return c.json({ success: false, error: msg, products: [] }, 500);
    }
  });

  app.get("/make-server-27d0d16c/recommendations/feed", async (c) => {
    try {
      const anonymousId = String(c.req.query("anonymousId") || "").trim();
      const userId = await resolveUserIdFromAccessHeader(c);
      const key = recoIdentityKey(userId, anonymousId || null);
      if (!key) {
        return c.json(
          { success: false, error: "anonymousId yoki X-Access-Token kerak", sections: {} },
          400,
        );
      }
      const region = c.req.query("region") || null;
      const district = c.req.query("district") || null;
      const perSection = Math.min(24, Math.max(4, Math.floor(Number(c.req.query("perSection") || "12") || 12)));
      const rawSections = String(c.req.query("sections") || "").trim();
      const want = rawSections
        ? rawSections.split(",").map((s) => s.trim()).filter(Boolean)
        : ["from_search", "similar_recent", "goes_well", "best_picks", "trending_today", "for_you"];

      const pack = (await kv.get(key)) as { events?: RecoStoredEvent[] } | null;
      const events = Array.isArray(pack?.events) ? pack!.events! : [];
      const catalog = await loadFormattedCatalog(region, district);
      const trending = await fetchTrendingProductScores(24);
      const purchaseIds = new Set<string>();
      for (const e of events) {
        if (e.type === "purchase" && e.productId) purchaseIds.add(e.productId);
      }

      const now = Date.now();
      const searchModel = RecoMarket.buildSearchIntentFromEvents(events as RecoMarket.RecoEv[], now);
      const byId = new Map<string, Record<string, unknown>>(catalog.map((p) => [String(p.id), p as Record<string, unknown>]));
      const taste = buildUserTaste(events as RecoEvent[], byId);

      const sections: Record<string, unknown> = {};
      const cold = events.length < 4;

      const trendingList = (() => {
        const scored = catalog
          .filter((p) => Number(p.stockQuantity) > 0)
          .map((p) => ({
            p,
            s: (trending.get(String(p.id)) || 0) * 1.2 +
              (Number(p.rating) || 0) * Math.log1p(Number(p.reviewCount) || 0) * 0.08,
          }))
          .sort((a, b) => b.s - a.s);
        return scored.map((x) => x.p).slice(0, perSection);
      })();

      if (want.includes("from_search") || want.includes("your_searches")) {
        let fs = sectionFromSearch(catalog as Record<string, unknown>[], searchModel, "", perSection);
        if (fs.length < 4) {
          fs = trendingList.slice(0, perSection).map((p) => ({
            ...p,
            recoReasons: ["Bugun trendda"],
          })) as Record<string, unknown>[];
        }
        sections.from_search = fs;
      }

      if (want.includes("similar_recent") || want.includes("similar")) {
        const pid = pickLastViewedProductId(events);
        const seed = pid ? (catalog.find((p) => String(p.id) === pid) as Record<string, unknown> | null) : null;
        const ranked = rankSimilarProductsAdvanced(seed, catalog as Record<string, unknown>[], taste, perSection, pid || "");
        sections.similar_recent = ranked.map((r) => ({
          ...r.product,
          recoReasons: r.reasons.length ? r.reasons : ["Oxirgi ko‘rganingizga o‘xshash"],
        }));
        sections.similar_to_last_viewed = sections.similar_recent;
      }

      if (want.includes("goes_well") || want.includes("complements")) {
        const anchorIds: string[] = [];
        for (let i = events.length - 1; i >= 0 && anchorIds.length < 3; i--) {
          const e = events[i];
          if (e.type === "view" && e.productId) anchorIds.push(String(e.productId));
        }
        const anchors = anchorIds
          .map((id) => byId.get(id))
          .filter((x): x is Record<string, unknown> => Boolean(x));
        sections.goes_well = sectionComplements(
          catalog as Record<string, unknown>[],
          anchors,
          "",
          perSection,
        );
      }

      if (want.includes("best_picks") || want.includes("top_variants")) {
        sections.best_picks = sectionBestPicks(
          catalog as Record<string, unknown>[],
          taste.priceMedian,
          trending,
          "",
          perSection,
        );
      }

      if (want.includes("for_you")) {
        sections.for_you = scoreFromEvents(events, catalog, {
          limit: perSection,
          trending,
          boostProductIds: purchaseIds,
        });
      }
      if (want.includes("top_category")) {
        const tc = topCategoryFromEvents(events, catalog);
        const pool = tc
          ? catalog.filter((p) => normalizeCategoryKey(p) === tc && Number(p.stockQuantity) > 0)
          : catalog.filter((p) => Number(p.stockQuantity) > 0);
        sections.top_category = [...pool]
          .sort(
            (a, b) =>
              (Number(b.rating) || 0) * Math.log1p(Number(b.reviewCount) || 0) -
              (Number(a.rating) || 0) * Math.log1p(Number(a.reviewCount) || 0),
          )
          .slice(0, perSection);
      }
      if (want.includes("trending") || want.includes("trending_today")) {
        sections.trending_today = trendingList;
      }
      if (want.includes("buy_again")) {
        sections.buy_again = buyAgainFromEvents(events, catalog, perSection);
      }

      return c.json({ success: true, cold, sections, searchIntentSummary: searchModel.recentQueries.slice(0, 5) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Xatolik";
      return c.json({ success: false, error: msg, sections: {} }, 500);
    }
  });

  app.get("/make-server-27d0d16c/recommendations/v2", async (c) => {
    try {
      const anonymousId = String(c.req.query("anonymousId") || "").trim();
      const userId = await resolveUserIdFromAccessHeader(c);
      const key = recoIdentityKey(userId, anonymousId || null);
      if (!key) {
        return c.json(
          { success: false, error: "anonymousId yoki X-Access-Token kerak", items: [] },
          400,
        );
      }
      const limit = Math.min(36, Math.max(4, Math.floor(Number(c.req.query("limit") || "16") || 16)));
      const region = c.req.query("region") || null;
      const district = c.req.query("district") || null;
      const excludeId = String(c.req.query("excludeId") || "").trim();
      const pack = (await kv.get(key)) as { events?: RecoStoredEvent[] } | null;
      const events = (Array.isArray(pack?.events) ? pack!.events! : []) as RecoEvent[];
      const catalog = await loadFormattedCatalog(region, district);
      const trending = await fetchTrendingProductScores(24);
      const anchor = pickLastViewedProductId(events as RecoStoredEvent[]);
      const collaborative = await fetchCollaborativeScores(recoSupabase(), anchor);
      const items = await rankPersonalizedV2({
        events,
        catalog: catalog as Record<string, unknown>[],
        trending,
        collaborative,
        excludeId,
        limit,
      });
      const byId = new Map<string, Record<string, unknown>>(catalog.map((p) => [String(p.id), p as Record<string, unknown>]));
      const tasteSummary = buildUserTaste(events, byId);
      const recentIds: string[] = [];
      for (let i = events.length - 1; i >= 0 && recentIds.length < 6; i--) {
        const e = events[i] as RecoStoredEvent;
        if (e.productId && (e.type === "view" || e.type === "click")) recentIds.unshift(e.productId);
      }
      const sessionIntent = detectSessionIntent(recentIds, byId);
      return c.json({
        success: true,
        cold: events.length < 4,
        count: items.length,
        items: items.map((it) => ({
          product: it.product,
          rankScore: it.rankScore,
          purchasePropensity: it.purchasePropensity,
          reasons: it.reasons,
        })),
        tasteSummary,
        sessionIntent: sessionIntent
          ? { tag: sessionIntent.tag, labelUz: sessionIntent.labelUz }
          : null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Xatolik";
      return c.json({ success: false, error: msg, items: [] }, 500);
    }
  });

  app.get("/make-server-27d0d16c/recommendations", async (c) => {
    try {
      const anonymousId = String(c.req.query("anonymousId") || "").trim();
      const userId = await resolveUserIdFromAccessHeader(c);
      const key = recoIdentityKey(userId, anonymousId || null);
      if (!key) {
        return c.json(
          { success: false, error: "anonymousId yoki X-Access-Token kerak", products: [] },
          400,
        );
      }

      const limit = Math.min(40, Math.max(4, Math.floor(Number(c.req.query("limit") || "16") || 16)));
      const region = c.req.query("region") || null;
      const district = c.req.query("district") || null;
      const excludeId = String(c.req.query("excludeId") || "").trim();

      const pack = (await kv.get(key)) as { events?: RecoStoredEvent[] } | null;
      const events = Array.isArray(pack?.events) ? pack!.events! : [];

      const catalog = await loadFormattedCatalog(region, district);
      const trending = await fetchTrendingProductScores(24);
      const purchaseIds = new Set<string>();
      for (const e of events) {
        if (e.type === "purchase" && e.productId) purchaseIds.add(e.productId);
      }
      const products = scoreFromEvents(events, catalog, {
        excludeId,
        limit,
        trending,
        boostProductIds: purchaseIds,
      });

      return c.json({
        success: true,
        cold: events.length < 4,
        count: products.length,
        products,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Xatolik";
      return c.json({ success: false, error: msg, products: [] }, 500);
    }
  });
}
