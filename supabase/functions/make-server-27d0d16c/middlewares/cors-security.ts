import type { Hono } from "npm:hono";

/** Bulutdagi loyiha (`*.supabase.co`, mahalliy emas). */
export function isHostedSupabaseProject(): boolean {
  const u = (Deno.env.get("SUPABASE_URL") || "").trim().toLowerCase();
  if (!u.includes(".supabase.co")) return false;
  if (u.includes("127.0.0.1") || u.includes("localhost")) return false;
  return true;
}

/** Bir marta `EDGE_PRODUCTION_CORS=1` — hosted loyihada wildcard CORSni o‘chirish (`ALLOWED_ORIGINS` majbur). */
export function edgeProductionCorsEnabled(): boolean {
  const p = Deno.env.get("EDGE_PRODUCTION_CORS")?.trim().toLowerCase();
  return p === "1" || p === "true" || p === "yes";
}

/** Prod’da `ALLOWED_ORIGINS` majburiy: `ALLOWED_ORIGINS_REQUIRED` yoki hosted + `EDGE_PRODUCTION_CORS`. */
export function allowedOriginsRequired(): boolean {
  const v = Deno.env.get("ALLOWED_ORIGINS_REQUIRED")?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (edgeProductionCorsEnabled() && isHostedSupabaseProject()) return true;
  return false;
}

/** CORS qat’iy rejim: ro‘yxat berilgan yoki majburiy rejim yoqilgan. */
export function isCorsRestricted(): boolean {
  return Boolean(Deno.env.get("ALLOWED_ORIGINS")?.trim()) || allowedOriginsRequired();
}

/** API marshrutlar ro‘yxatini ochiq beradigan test endpoint — faqat ENABLE_PUBLIC_TEST_ENDPOINT=1 da. */
export function publicTestEndpointDetailed(): boolean {
  const v = Deno.env.get("ENABLE_PUBLIC_TEST_ENDPOINT")?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Vergul bilan ajratilgan originlar. Bo‘sh bo‘lsa `*` (majburiy rejimda bo‘sh ro‘yxat → hech qanday origin ruxsat etilmaydi). */
export function resolveCorsAllowOrigin(req: Request): string {
  const raw = Deno.env.get("ALLOWED_ORIGINS")?.trim();
  const origin = req.headers.get("Origin")?.trim() ?? "";
  // Hosted + strict CORS mode: if env isn't configured yet, still allow localhost for development.
  if (allowedOriginsRequired() && !raw) {
    const o = origin.toLowerCase();
    if (
      o.startsWith("http://localhost:") ||
      o.startsWith("http://127.0.0.1:") ||
      o.startsWith("http://0.0.0.0:") ||
      o.startsWith("http://[::1]:")
    ) {
      return origin;
    }
    return "";
  }
  if (!raw) return "*";
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return allowedOriginsRequired() ? "" : "*";
  if (origin && allowed.includes(origin)) return origin;
  return "";
}

export function redactHeaderValue(key: string, value: string): string {
  const lk = key.toLowerCase();
  const secret =
    lk === "authorization" ||
    lk === "cookie" ||
    lk === "x-access-token" ||
    lk === "x-branch-token" ||
    lk === "x-courier-token" ||
    lk === "x-seller-token" ||
    lk === "x-admin-code" ||
    lk === "x-admin-session" ||
    lk === "x-admin-login-token" ||
    lk === "x-accountant-token" ||
    lk === "x-rental-provider-token" ||
    lk === "x-auto-courier-token" ||
    lk === "x-branch-supabase-jwt" ||
    lk === "apikey";
  if (!secret) return value.length > 300 ? value.slice(0, 300) + "…" : value;
  return value.length > 16 ? `${value.slice(0, 6)}…[redacted]` : "[redacted]";
}

export const CORS_ALLOW_HEADERS =
  "Content-Type, Authorization, X-Access-Token, x-access-token, X-Seller-Token, x-seller-token, X-Courier-Token, x-courier-token, X-Auto-Courier-Token, x-auto-courier-token, X-Admin-Code, x-admin-code, X-Admin-Session, x-admin-session, X-Admin-Login-Token, x-admin-login-token, X-Admin-Device-Id, x-admin-device-id, X-Request-ID, x-request-id, X-Branch-Token, x-branch-token, X-Branch-Supabase-Jwt, x-branch-supabase-jwt, X-Accountant-Token, x-accountant-token, X-Rental-Provider-Token, x-rental-provider-token, apikey";

/** CORS javob sarlavhalari + xavfsizlik sarlavhalari (oldingi `index.ts` tartibi bilan bir xil). */
export function registerCorsAndSecurityHeaders(app: Hono): void {
  app.use("/*", async (c, next) => {
    const corsRestricted = isCorsRestricted();
    const acao = resolveCorsAllowOrigin(c.req.raw);
    if (corsRestricted && !acao && c.req.method === "OPTIONS") {
      return c.text("Forbidden", 403);
    }
    await next();
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set(
      "Permissions-Policy",
      "accelerometer=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    );
    if (acao) {
      c.res.headers.set("Access-Control-Allow-Origin", acao);
      if (acao !== "*") c.res.headers.append("Vary", "Origin");
    }
    c.res.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    c.res.headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
    c.res.headers.set(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Type, X-Request-ID",
    );
    c.res.headers.set("Access-Control-Max-Age", "600");
  });
}

export function registerHttpRedactedLogging(
  app: Hono,
  opts: { DEBUG_HTTP: boolean; VERBOSE_SERVER_LOG: boolean },
): void {
  const { DEBUG_HTTP, VERBOSE_SERVER_LOG } = opts;
  app.use("*", async (c, next) => {
    if (VERBOSE_SERVER_LOG) {
      console.log(`[http] ${c.req.method} ${c.req.path}`);
    }
    if (DEBUG_HTTP && (c.req.method === "OPTIONS" || c.req.method === "POST")) {
      const hdrs: Record<string, string> = {};
      c.req.raw.headers.forEach((value: string, key: string) => {
        hdrs[key] = redactHeaderValue(key, value);
      });
      console.log("[http] headers (redacted):", JSON.stringify(hdrs, null, 2));
    }
    await next();
  });
}

export function registerOptionsHandler(app: Hono, opts: { DEBUG_HTTP: boolean }): void {
  const { DEBUG_HTTP } = opts;
  app.options("*", (c) => {
    const corsRestricted = isCorsRestricted();
    const acao = resolveCorsAllowOrigin(c.req.raw);
    if (corsRestricted && !acao) {
      return c.text("Forbidden", 403);
    }
    if (DEBUG_HTTP) console.log("[http] OPTIONS", c.req.path);
    const originHeader = acao || "*";
    return c.text("OK", 200, {
      "Access-Control-Allow-Origin": originHeader,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
      "Access-Control-Expose-Headers": "Content-Length, Content-Type, X-Request-ID",
      "Access-Control-Max-Age": "600",
    });
  });
}
