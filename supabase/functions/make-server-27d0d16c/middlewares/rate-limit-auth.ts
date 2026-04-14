import type { Hono } from "npm:hono";

/**
 * Faqat `EDGE_RATE_LIMIT_AUTH=1` bo‘lsa yoqiladi — default o‘chiq (xatti-harakat o‘zgarmaydi).
 * `/make-server-27d0d16c/auth/` ostidagi so‘rovlar: IP bo‘yicha daqiqada cheklangan (xotira, per-instance).
 */
export function registerOptionalAuthRateLimit(app: Hono): void {
  if (Deno.env.get("EDGE_RATE_LIMIT_AUTH") !== "1") return;

  const windowMs = 60_000;
  const maxPerWindow = Number(Deno.env.get("EDGE_RATE_LIMIT_AUTH_MAX") || "120");
  const hits = new Map<string, number[]>();

  app.use("*", async (c, next) => {
    const path = c.req.path;
    if (!path.includes("/make-server-27d0d16c/auth/")) {
      await next();
      return;
    }
    const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = fwd || c.req.header("cf-connecting-ip") || "unknown";
    const now = Date.now();
    const arr = hits.get(ip) || [];
    const recent = arr.filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    if (recent.length > maxPerWindow) {
      return c.json(
        { success: false, error: "Too many requests", code: "RATE_LIMIT" },
        429,
      );
    }
    await next();
  });
}
