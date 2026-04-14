import type { Hono } from "npm:hono";

/**
 * Himoya qatlami: maxsus headerlardan biri bo‘lmasa 401 (ochiq marshrutlar istisno).
 * Mantiq va `publicPrefixes` ro‘yxati `index.ts`dagi bilan bir xil saqlanadi.
 */
export function registerAuthGateMiddleware(app: Hono): void {
  app.use("*", async (c, next) => {
    const path = c.req.path;
    const method = c.req.method;

    if (method === "OPTIONS") {
      await next();
      return;
    }

    const publicPrefixes = [
      "/health",
      "/test-deployment",
      "/make-server-27d0d16c/health",
      "/make-server-27d0d16c/test-deployment",
      "/make-server-27d0d16c/public/",
      "/make-server-27d0d16c/payment-methods",
      "/make-server-27d0d16c/auth/",
      "/make-server-27d0d16c/branch/session",
      "/make-server-27d0d16c/courier/login",
      "/make-server-27d0d16c/click",
      "/make-server-27d0d16c/payme",
      "/make-server-27d0d16c/atmos",
    ];

    const matchesPublicPrefix = (path: string, p: string) => {
      if (path === p) return true;
      if (p.endsWith("/")) return path.startsWith(p);
      return path.startsWith(`${p}/`);
    };
    const isPublic = publicPrefixes.some((p) => matchesPublicPrefix(path, p));
    if (isPublic) {
      await next();
      return;
    }

    const hasAnyAuthHeader = Boolean(
      c.req.header("Authorization") ||
        c.req.header("authorization") ||
        c.req.header("X-Access-Token") ||
        c.req.header("x-access-token") ||
        c.req.header("X-Branch-Token") ||
        c.req.header("x-branch-token") ||
        c.req.header("X-Admin-Code") ||
        c.req.header("x-admin-code") ||
        c.req.header("X-Courier-Token") ||
        c.req.header("x-courier-token") ||
        c.req.header("X-Auto-Courier-Token") ||
        c.req.header("x-auto-courier-token") ||
        c.req.header("X-Seller-Token") ||
        c.req.header("x-seller-token") ||
        c.req.header("X-Accountant-Token") ||
        c.req.header("x-accountant-token") ||
        c.req.header("X-Rental-Provider-Token") ||
        c.req.header("x-rental-provider-token"),
    );

    if (!hasAnyAuthHeader) {
      const isCourierPath = path.includes("/courier/");
      const isAutoCourierPath = path.includes("/auto-courier/");
      const queryToken = c.req.query("token");
      if ((isCourierPath || isAutoCourierPath) && queryToken) {
        await next();
        return;
      }

      return c.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        401,
      );
    }

    await next();
  });
}
