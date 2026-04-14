import type { Hono } from "npm:hono";
import clickRoutes from "../click.tsx";

/**
 * Click to‘lov marshrutlari (`click.tsx` sub-app).
 * `EDGE_DISABLE_CLICK_ON_MAIN=1` — faqat `payment-webhooks` funksiyasida Click qoldirilganda (kabinet URL yangilangan bo‘lsa).
 */
export function registerClickPaymentRoutes(app: Hono): void {
  if (Deno.env.get("EDGE_DISABLE_CLICK_ON_MAIN") === "1") {
    return;
  }
  app.route("/make-server-27d0d16c/click", clickRoutes);
}
