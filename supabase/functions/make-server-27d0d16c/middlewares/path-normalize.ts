import type { Hono } from "npm:hono";

/**
 * Supabase ba'zan yo‘lni `/functions/v1/...` yoki qisqa shaklda yuboradi.
 * Barcha ichki route'lar `/make-server-27d0d16c/...` ostida — bu middleware tartibini o‘zgartirmaydi.
 */
export function registerPathNormalizeMiddleware(app: Hono): void {
  app.use("*", async (c, next) => {
    const p = c.req.path;
    if (c.req.method === "OPTIONS") {
      await next();
      return;
    }
    const marker = "/make-server-27d0d16c";
    let normalized = p;
    if (p.startsWith(marker)) {
      normalized = p;
    } else {
      const idx = p.indexOf(marker);
      if (idx !== -1) {
        normalized = p.slice(idx);
      } else {
        normalized = p === "/" ? marker : `${marker}${p}`;
      }
    }
    if (normalized !== p) {
      const u = new URL(c.req.url);
      u.pathname = normalized;
      return app.fetch(new Request(u.toString(), c.req.raw));
    }
    try {
      await next();
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Auth gate next() error:", error);
      return c.json(
        { success: false, code: "NEXT_ERROR", error: err?.message || String(error) },
        500,
      );
    }
  });
}
