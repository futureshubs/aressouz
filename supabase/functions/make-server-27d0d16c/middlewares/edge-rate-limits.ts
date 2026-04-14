import type { Hono } from "npm:hono";

function clientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || c.req.header("cf-connecting-ip") || "unknown";
}

/** `console.*` o‘chirilgan bo‘lsa ham stderr orqali xavfsizlik hodisalari (429). */
function securityLog(event: Record<string, unknown>): void {
  if (Deno.env.get("EDGE_SECURITY_LOG") !== "1") return;
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n";
    Deno.stderr.writeSync(new TextEncoder().encode(line));
  } catch {
    /* ignore */
  }
}

function skipGlobalRateLimit(path: string, method: string): boolean {
  if (method === "OPTIONS") return true;
  const p = path;
  if (p.includes("/health") || p.includes("/test-deployment")) return true;
  if (p.includes("/make-server-27d0d16c/click")) return true;
  if (p.includes("/make-server-27d0d16c/payme")) return true;
  if (p.includes("/make-server-27d0d16c/atmos")) return true;
  return false;
}

function pruneHits(map: Map<string, number[]>, windowMs: number, now: number): void {
  if (map.size < 8000) return;
  for (const [k, arr] of map) {
    const recent = arr.filter((t) => now - t < windowMs);
    if (recent.length === 0) map.delete(k);
    else map.set(k, recent);
  }
}

/**
 * Ixtiyoriy: `EDGE_GLOBAL_RATE_LIMIT=1` — barcha marshrutlar (tashqi to‘lov webhooklari va health istisno).
 * In-memory, per-instance; CDN/WAF bilan birga ishlatish tavsiya etiladi.
 */
export function registerOptionalGlobalEdgeRateLimit(app: Hono): void {
  if (Deno.env.get("EDGE_GLOBAL_RATE_LIMIT") !== "1") return;

  const windowMs = 60_000;
  const maxPerWindow = Number(Deno.env.get("EDGE_GLOBAL_RATE_LIMIT_MAX") || "2000");
  const hits = new Map<string, number[]>();

  app.use("*", async (c, next) => {
    const path = c.req.path;
    const method = c.req.method;
    if (skipGlobalRateLimit(path, method)) {
      await next();
      return;
    }
    const ip = clientIp(c);
    const now = Date.now();
    pruneHits(hits, windowMs, now);
    const arr = hits.get(ip) || [];
    const recent = arr.filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    if (recent.length > maxPerWindow) {
      securityLog({
        type: "rate_limit",
        scope: "global",
        path: path.slice(0, 200),
        ipPrefix: ip.slice(0, 24),
      });
      return c.json(
        { success: false, error: "Too many requests", code: "RATE_LIMIT" },
        429,
      );
    }
    await next();
  });
}

function isSensitiveAdminOrAuthPath(path: string): boolean {
  return (
    path.includes("/make-server-27d0d16c/auth/") ||
    path.includes("/make-server-27d0d16c/admin")
  );
}

/**
 * Ixtiyoriy: `EDGE_SENSITIVE_RATE_LIMIT=1` — login/SMS/admin ostidagi so‘rovlar (alohida chegara).
 */
export function registerOptionalSensitiveRouteRateLimit(app: Hono): void {
  if (Deno.env.get("EDGE_SENSITIVE_RATE_LIMIT") !== "1") return;

  const windowMs = 60_000;
  const maxPerWindow = Number(Deno.env.get("EDGE_SENSITIVE_RATE_LIMIT_MAX") || "90");
  const hits = new Map<string, number[]>();

  app.use("*", async (c, next) => {
    const path = c.req.path;
    if (!isSensitiveAdminOrAuthPath(path) || c.req.method === "OPTIONS") {
      await next();
      return;
    }
    const ip = clientIp(c);
    const now = Date.now();
    pruneHits(hits, windowMs, now);
    const arr = hits.get(ip) || [];
    const recent = arr.filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    if (recent.length > maxPerWindow) {
      securityLog({
        type: "rate_limit",
        scope: "sensitive",
        path: path.slice(0, 200),
        ipPrefix: ip.slice(0, 24),
      });
      return c.json(
        { success: false, error: "Too many requests", code: "RATE_LIMIT" },
        429,
      );
    }
    await next();
  });
}
