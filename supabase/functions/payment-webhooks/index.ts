/**
 * Click uchun alohida Edge kirish (verify_jwt = false).
 * URL: /functions/v1/payment-webhooks/click/prepare|complete|...
 * Hozircha asosiy `make-server-27d0d16c` dagi Click ham ishlaydi — kabinetni yangilash ixtiyoriy.
 */
import { Hono } from "npm:hono";
import clickRoutes from "../make-server-27d0d16c/click.tsx";
import { registerAtmosPaymentRoutes } from "../make-server-27d0d16c/routes/atmos-public-routes.ts";
import { registerPaymeReceiptRoutes } from "../make-server-27d0d16c/routes/payme-receipt-routes.ts";

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "payment-webhooks",
    click: "/click/*",
    atmos: "/atmos/*",
    payme: "/payme/*",
  }),
);

app.options("*", (c) => c.body(null, 204));

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
});

app.route("/click", clickRoutes);
registerAtmosPaymentRoutes(app, { routeBase: "/atmos" });
registerPaymeReceiptRoutes(app, { routeBase: "/payme" });

Deno.serve(app.fetch);
