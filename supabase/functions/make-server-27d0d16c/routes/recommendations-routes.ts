import type { Hono } from "npm:hono";
import * as kv from "../kv_store.tsx";

const RECO_LOG_PREFIX = "reco_log:v1:";
const MAX_EVENTS = 160;
const MAX_EVENTS_PER_POST = 25;

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
};

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

async function loadFormattedCatalog(region: string | null, district: string | null): Promise<any[]> {
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
      return 5.5;
    case "favorite_add":
      return 4.2;
    case "favorite_remove":
      return -2;
    case "search":
      return 1.6;
    case "view":
      return 1.15;
    default:
      return 0.5;
  }
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function scoreFromEvents(
  events: RecoStoredEvent[],
  catalog: any[],
  opts: { excludeId?: string; limit: number },
): any[] {
  const now = Date.now();
  const catW = new Map<string, number>();
  const tokW = new Map<string, number>();
  const shopW = new Map<string, number>();
  const priceSamples: number[] = [];

  for (const e of events) {
    const ageDays = Math.max(0, (now - e.ts) / 86_400_000);
    const decay = Math.exp(-0.068 * ageDays);
    const w = decay * baseWeight(e.type);
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
    if (med > 0) {
      const pr = Number(p.price) || 0;
      if (pr > 0) {
        const rel = Math.abs(pr - med) / med;
        s += Math.max(0, 1.15 - Math.min(1.15, rel));
      }
    }
    if (p.isBestseller) s += 0.4;
    const rc = Number(p.reviewCount) || 0;
    const rt = Number(p.rating) || 0;
    if (rc > 0 && rt > 0) s += Math.min(0.6, (rt / 5) * Math.log1p(rc) * 0.12);
    s += Math.random() * 0.14;
    return s;
  }

  if (cold) {
    return [...candidates]
      .sort((a, b) => {
        const rb = (Number(b.reviewCount) || 0) * (Number(b.rating) || 0);
        const ra = (Number(a.reviewCount) || 0) * (Number(a.rating) || 0);
        if (rb !== ra) return rb - ra;
        return Math.random() - 0.5;
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
    const sid = String(p.shopId || "");
    if (sid) {
      const c = shopCount.get(sid) || 0;
      if (c >= 4) continue;
      shopCount.set(sid, c + 1);
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

function sanitizeIncomingEvent(raw: Record<string, unknown>): RecoStoredEvent | null {
  const type = String(raw.type || "").trim().toLowerCase();
  const allowed = new Set([
    "view",
    "search",
    "favorite_add",
    "favorite_remove",
    "cart_add",
    "purchase",
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
  return { ts: t, type, productId, categoryKey, shopId, price, query, title };
}

export function registerRecommendationRoutes(app: Hono): void {
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

      const incoming: RecoStoredEvent[] = [];
      for (const r of rawList) {
        if (typeof r !== "object" || !r) continue;
        const e = sanitizeIncomingEvent(r as Record<string, unknown>);
        if (e) incoming.push(e);
      }
      if (incoming.length === 0) {
        return c.json({ success: true, saved: 0 });
      }

      const prev = (await kv.get(key)) as { events?: RecoStoredEvent[] } | null;
      const merged = [...(Array.isArray(prev?.events) ? prev!.events! : []), ...incoming]
        .sort((a, b) => a.ts - b.ts)
        .slice(-MAX_EVENTS);

      await kv.set(key, { events: merged, updatedAt: new Date().toISOString() });
      return c.json({ success: true, saved: incoming.length, total: merged.length });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Xatolik";
      return c.json({ success: false, error: msg }, 500);
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
      const products = scoreFromEvents(events, catalog, { excludeId, limit });

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
