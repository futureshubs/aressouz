import type { Hono } from "npm:hono";
import { validatePromoCode } from "../promo-codes.ts";

export function registerPromoRoutes(app: Hono): void {
  const handler = async (c: any) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const code = String(body?.code || body?.promoCode || "").trim();
      const orderSubtotal = Number(
        body?.orderSubtotal ?? body?.orderTotal ?? body?.subtotal ?? 0,
      );
      if (!code) return c.json({ success: false, error: "Promo kod kerak" }, 400);
      const result = await validatePromoCode(code, orderSubtotal);
      if (!result.success) return c.json(result, 400);
      return c.json(result);
    } catch (error: any) {
      console.error("Promo validate error:", error);
      return c.json({ success: false, error: "Promo tekshirishda xatolik" }, 500);
    }
  };

  app.post("/make-server-27d0d16c/promo/validate", handler);
  app.post("/promo/validate", handler);
}
