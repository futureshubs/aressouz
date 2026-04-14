import type { Hono } from "npm:hono";

/**
 * Har javobga `X-Request-ID` (kiruvchi sarlavha yoki yangi UUID).
 * CORS `Access-Control-Expose-Headers` allaqachon `X-Request-ID` ni ochadi — UI o‘zgarmaydi.
 */
function pickRequestId(incoming: string | undefined): string {
  const s = (incoming ?? "").trim();
  if (s.length >= 8 && s.length <= 128 && /^[A-Za-z0-9._-]+$/.test(s)) {
    return s;
  }
  return crypto.randomUUID();
}

export function registerRequestIdMiddleware(app: Hono): void {
  app.use("*", async (c, next) => {
    const id = pickRequestId(
      c.req.header("X-Request-ID") || c.req.header("x-request-id") || undefined,
    );
    await next();
    c.header("X-Request-ID", id);
  });
}
