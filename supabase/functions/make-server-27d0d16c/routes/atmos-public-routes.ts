import type { Hono } from "npm:hono";
import * as atmos from "../atmos.tsx";
import * as kv from "../kv_store.tsx";

export type AtmosRoutesOpts = {
  /** Default: `/make-server-27d0d16c/atmos`. `payment-webhooks` funksiyasida: `/atmos`. */
  routeBase?: string;
};

/** Atmos to‘lov API — `atmos.tsx` + KV `payment_method:atmos`. */
export function registerAtmosPaymentRoutes(app: Hono, opts?: AtmosRoutesOpts): void {
  const base = (opts?.routeBase ?? "/make-server-27d0d16c/atmos").replace(/\/$/, "");

  app.post(`${base}/create-transaction`, async (c) => {
    try {
      let body: Record<string, unknown>;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "JSON body kutilmoqda", code: "BAD_BODY" }, 400);
      }

      const amountRaw = body.amount;
      const orderId = body.orderId;
      const customerPhone = body.customerPhone;
      const customerName = body.customerName;

      const amountNum = Number(amountRaw);
      const oid = String(orderId ?? "").trim();
      const phone = String(customerPhone ?? "").trim();

      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return c.json(
          { error: `Noto‘g‘ri summa: ${String(amountRaw)}`, code: "INVALID_AMOUNT" },
          400,
        );
      }
      if (!oid) {
        return c.json({ error: "orderId majburiy", code: "INVALID_ORDER" }, 400);
      }
      if (!phone) {
        return c.json({ error: "Telefon (customerPhone) majburiy", code: "INVALID_PHONE" }, 400);
      }

      const atmosRow = await kv.get("payment_method:atmos");
      if (atmosRow && atmosRow.enabled === false) {
        return c.json({ error: "Atmos to'lov usuli faol emas", code: "ATMOS_DISABLED" }, 400);
      }

      if (!atmos.isAtmosConfigured(atmosRow ?? null)) {
        return c.json(
          {
            error:
              "Atmos sozlanmagan: Supabase Secrets (ATMOS_STORE_ID, ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET) yoki admin → Atmos maydonlari",
            code: "ATMOS_NOT_CONFIGURED",
          },
          503,
        );
      }

      const result = await atmos.createTransaction(
        amountNum,
        oid,
        phone,
        typeof customerName === "string" ? customerName : undefined,
        atmosRow ?? null,
      );

      if (!result.success) {
        return c.json(
          {
            error: result.error || "Tranzaksiya yaratishda xatolik",
            code: "ATMOS_UPSTREAM",
          },
          400,
        );
      }

      return c.json({
        success: true,
        transactionId: result.transactionId,
        redirectUrl: result.redirectUrl,
        status: result.status,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: `Tranzaksiya yaratishda xatolik: ${msg}` }, 500);
    }
  });

  app.post(`${base}/check-transaction`, async (c) => {
    try {
      const { transactionId } = await c.req.json();

      if (!transactionId) {
        return c.json({ error: "TransactionId majburiy" }, 400);
      }

      const atmosRow = await kv.get("payment_method:atmos");
      const result = await atmos.checkTransaction(transactionId, atmosRow ?? null);

      if (!result.success) {
        return c.json({ error: result.error || "Tranzaksiya holatini olishda xatolik" }, 400);
      }

      return c.json({
        success: true,
        transaction: result.transaction,
        status: result.status,
        isPaid: result.isPaid,
        isApproved: result.isApproved,
        isRejected: result.isRejected,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: `Tranzaksiya holatini olishda xatolik: ${msg}` }, 500);
    }
  });

  app.post(`${base}/cancel-transaction`, async (c) => {
    try {
      const { transactionId } = await c.req.json();

      if (!transactionId) {
        return c.json({ error: "TransactionId majburiy" }, 400);
      }

      const atmosRow = await kv.get("payment_method:atmos");
      const result = await atmos.cancelTransaction(transactionId, atmosRow ?? null);

      if (!result.success) {
        return c.json({ error: result.error || "Tranzaksiyani bekor qilishda xatolik" }, 400);
      }

      return c.json({
        success: true,
        message: "Tranzaksiya bekor qilindi",
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ error: `Tranzaksiyani bekor qilishda xatolik: ${msg}` }, 500);
    }
  });
}
