import type { Context, Hono } from "npm:hono";
import * as kv from "../kv_store.tsx";
import {
  buildPaycomCheckoutLink,
  cancelReceipt as paymeCancelReceipt,
  checkReceipt as paymeCheckReceipt,
  createReceipt as paymeCreateReceipt,
  getReceipt as paymeGetReceipt,
  isPaymeConfiguredForMode,
  parsePaycomHttpsBackUrl,
  resolvePaycomUseTestForPayme,
  sendReceipt as paymeSendReceipt,
  sumItemsTiyinForPaycom,
  type PaymeReceiptItem,
} from "../payme.tsx";
import {
  clearPaycomOrderPending,
  resolvePaycomCreateIdempotency,
  savePaycomOrderPending,
} from "../paycom-idempotency.ts";
import {
  logPaymeHttp,
  paycomCallOptsForReceiptIdWithKv,
  paymeCheckoutOrderKvKey,
} from "../lib/paycom-receipt-helpers.ts";
import { markKvOrderPaidFromGateway } from "../services/order-kv-lookup.ts";

export type PaymeReceiptRoutesOpts = {
  /** Default: `/make-server-27d0d16c/payme`. `payment-webhooks`: `/payme`. */
  routeBase?: string;
};

export function registerPaymeReceiptRoutes(app: Hono, opts?: PaymeReceiptRoutesOpts): void {
  const base = (opts?.routeBase ?? "/make-server-27d0d16c/payme").replace(/\/$/, "");

  const paymeCreateReceiptHandler = async (c: Context) => {
    try {
      const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== "object") {
        return c.json({ error: "JSON body majburiy" }, 400);
      }
      logPaymeHttp("POST /payme/create-receipt", body);

      const { amount, orderId, items, phone, returnUrl } = body as {
        amount?: unknown;
        orderId?: unknown;
        items?: unknown;
        phone?: unknown;
        returnUrl?: unknown;
      };

      console.log("💳 Creating Payme receipt:", {
        amount,
        orderId,
        itemsCount: Array.isArray(items) ? items.length : 0,
        phone,
      });

      if (!amount || !orderId) {
        return c.json({ error: "Amount va orderId majburiy" }, 400);
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return c.json({ error: "Items (mahsulotlar ro'yxati) majburiy" }, 400);
      }

      const itemsTiyin = sumItemsTiyinForPaycom(items as PaymeReceiptItem[]);
      const clientTiyin = Math.round(Number(amount) * 100);
      if (!Number.isFinite(clientTiyin) || clientTiyin <= 0) {
        return c.json({ error: "Noto‘g‘ri amount" }, 400);
      }
      if (!Number.isFinite(itemsTiyin) || itemsTiyin <= 0) {
        return c.json({ error: "Mahsulotlar summasi 0 yoki noto‘g‘ri" }, 400);
      }
      if (Math.abs(itemsTiyin - clientTiyin) > 2) {
        return c.json(
          {
            error:
              "So‘m va savat qatorlari yig‘indisi mos emas. Sahifani yangilab qayta urinib ko‘ring (Paycom checkout «чек не найден» sababi bo‘lishi mumkin).",
            code: "PAYCOM_AMOUNT_LINES_MISMATCH",
            clientTiyin,
            itemsTiyin,
          },
          400,
        );
      }

      await kv.set(paymeCheckoutOrderKvKey(String(orderId)), {
        state: "pending_receipt",
        orderId: String(orderId),
        amountTiyin: itemsTiyin,
        updatedAt: new Date().toISOString(),
      });

      const paymeConfig = await kv.get("payment_method:payme");
      const resolvedTest = resolvePaycomUseTestForPayme(paymeConfig);
      const checkoutBackUrl = parsePaycomHttpsBackUrl(returnUrl);

      console.log(
        "💳 Paycom create-receipt:",
        resolvedTest ? "TEST (checkout.test.paycom.uz)" : "PROD (checkout.paycom.uz)",
      );

      if (!isPaymeConfiguredForMode(resolvedTest, null)) {
        return c.json(
          {
            error: resolvedTest
              ? "Paycom TEST: Supabase Secrets — PAYCOM_REGISTER_ID va PAYCOM_SECRET_TEST."
              : "Paycom PROD: Supabase Secrets — PAYCOM_REGISTER_ID va PAYCOM_SECRET_PROD.",
            code: "PAYCOM_ENV_MISSING",
          },
          503,
        );
      }

      const paycomCallOpts = {
        useTest: resolvedTest,
      };
      const idem = await resolvePaycomCreateIdempotency(String(orderId), items, paycomCallOpts);
      if (idem.action === "already_paid") {
        await kv.set(paymeCheckoutOrderKvKey(String(orderId)), {
          state: "paid",
          orderId: String(orderId),
          receiptId: idem.receiptId,
          updatedAt: new Date().toISOString(),
        });
        return c.json(
          {
            error:
              "Bu buyurtma (orderId) bo‘yicha chek allaqachon to‘langan. Yangi chek ochilmaydi.",
            code: "PAYCOM_ORDER_ALREADY_PAID",
            receiptId: idem.receiptId,
          },
          409,
        );
      }
      if (idem.action === "reuse") {
        const r = idem.record;
        const freshCheckoutUrl = buildPaycomCheckoutLink(r.receiptId, resolvedTest, {
          useTest: resolvedTest,
          checkoutBackUrl,
        });
        await kv.set(`paycom_receipt:${r.receiptId}`, {
          orderId: String(orderId),
          useTest: resolvedTest,
        });
        await savePaycomOrderPending({
          ...r,
          checkoutUrl: freshCheckoutUrl,
        });
        await kv.set(paymeCheckoutOrderKvKey(String(orderId)), {
          state: "receipt_created",
          orderId: String(orderId),
          receiptId: r.receiptId,
          amountTiyin: itemsTiyin,
          paycomEnvironment: resolvedTest ? "test" : "prod",
          idempotentReused: true,
          updatedAt: new Date().toISOString(),
        });
        console.log("[paycom] idempotent reuse", { orderId, receiptId: r.receiptId });
        return c.json({
          success: true,
          receiptId: r.receiptId,
          checkoutUrl: freshCheckoutUrl,
          paycomEnvironment: resolvedTest ? "test" : "prod",
          idempotentReused: true,
        });
      }

      const result = await paymeCreateReceipt(amount, orderId, items, phone, undefined, {
        useTest: resolvedTest,
        checkoutBackUrl,
      });

      if (!result.success) {
        return c.json({ error: result.error || "Chek yaratishda xatolik" }, 400);
      }

      if (result.receiptId) {
        await kv.set(`paycom_receipt:${result.receiptId}`, {
          orderId: String(orderId),
          useTest: resolvedTest,
        });
        const amountTiyin = sumItemsTiyinForPaycom(items);
        await savePaycomOrderPending({
          receiptId: result.receiptId,
          checkoutUrl: result.checkoutUrl,
          amountTiyin,
          useTest: resolvedTest,
          createdAt: new Date().toISOString(),
          orderId: String(orderId),
        });
        await kv.set(paymeCheckoutOrderKvKey(String(orderId)), {
          state: "receipt_created",
          orderId: String(orderId),
          receiptId: result.receiptId,
          amountTiyin,
          paycomEnvironment: resolvedTest ? "test" : "prod",
          updatedAt: new Date().toISOString(),
        });
      }

      const rec = result.receipt as { state?: number } | undefined;
      console.log("RECEIPT_CREATE:", {
        receiptId: result.receiptId,
        accountOrderId: String(orderId),
        paycomEnvironment: resolvedTest ? "test" : "prod",
        receiptState: typeof rec?.state === "number" ? rec.state : undefined,
      });
      console.log("CHECKOUT_URL:", result.checkoutUrl);
      return c.json({
        success: true,
        receiptId: result.receiptId,
        checkoutUrl: result.checkoutUrl,
        paycomEnvironment: resolvedTest ? "test" : "prod",
        receiptState: typeof rec?.state === "number" ? rec.state : undefined,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Create receipt error:", error);
      return c.json({ error: `Chek yaratishda xatolik: ${msg}` }, 500);
    }
  };

  app.post(`${base}/create-receipt`, paymeCreateReceiptHandler);
  app.post(`${base}/create_receipt`, paymeCreateReceiptHandler);

  app.post(`${base}/check-receipt`, async (c) => {
    try {
      let body: { receiptId?: unknown };
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "So‘rov tanasi JSON emas" }, 400);
      }
      const receiptIdRaw = body?.receiptId;
      const receiptId = receiptIdRaw != null ? String(receiptIdRaw).trim() : "";

      console.log("💳 Checking Payme receipt:", receiptId);

      if (!receiptId) {
        return c.json({ error: "ReceiptId majburiy" }, 400);
      }

      const paycomOpts = await paycomCallOptsForReceiptIdWithKv(receiptId);
      const result = await paymeCheckReceipt(receiptId, paycomOpts);

      if (!result.success) {
        return c.json({ error: result.error || "Chek tekshirishda xatolik" }, 400);
      }

      const applyPaidOrCancelledKv = async (kind: "paid" | "cancelled") => {
        try {
          const meta = (await kv.get(`paycom_receipt:${receiptId}`)) as
            | { orderId?: string }
            | null;
          if (!meta?.orderId) return;
          const oid = String(meta.orderId);
          await clearPaycomOrderPending(oid);
          await kv.set(paymeCheckoutOrderKvKey(oid), {
            state: kind,
            orderId: oid,
            receiptId,
            updatedAt: new Date().toISOString(),
          });
        } catch (kvErr: unknown) {
          console.error(`[payme/check-receipt] KV (${kind}) yangilanmadi:`, kvErr);
        }
      };

      if (result.isPaid) {
        await applyPaidOrCancelledKv("paid");
        try {
          const paidMeta = (await kv.get(`paycom_receipt:${receiptId}`)) as
            | { orderId?: string }
            | null;
          if (paidMeta?.orderId) {
            await markKvOrderPaidFromGateway(String(paidMeta.orderId), {
              paymeReceiptId: receiptId,
            });
          }
        } catch (paidKvErr: unknown) {
          console.error("[payme/check-receipt] buyurtma to‘langan deb yangilanmadi:", paidKvErr);
        }
      }
      if (result.isCancelled) {
        await applyPaidOrCancelledKv("cancelled");
      }

      console.log("[payme/http] POST /payme/check-receipt", {
        receiptIdTail: receiptId.slice(-8),
        isPaid: result.isPaid,
        state: result.state,
      });

      return c.json({
        success: true,
        isPaid: result.isPaid,
        isCancelled: result.isCancelled,
        state: result.state,
        receipt: result.receipt,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Check receipt error:", error);
      return c.json({ error: `Chek tekshirishda xatolik: ${msg}` }, 500);
    }
  });

  app.post(`${base}/get-receipt`, async (c) => {
    try {
      const { receiptId } = await c.req.json();

      if (!receiptId) {
        return c.json({ error: "ReceiptId majburiy" }, 400);
      }

      const paycomOpts = await paycomCallOptsForReceiptIdWithKv(String(receiptId));
      const result = await paymeGetReceipt(receiptId, paycomOpts);

      if (!result.success) {
        return c.json({ error: result.error || "Chek olishda xatolik" }, 400);
      }

      return c.json({
        success: true,
        receipt: result.receipt,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Get receipt error:", error);
      return c.json({ error: `Chek olishda xatolik: ${msg}` }, 500);
    }
  });

  app.post(`${base}/cancel-receipt`, async (c) => {
    try {
      const { receiptId } = await c.req.json();

      if (!receiptId) {
        return c.json({ error: "ReceiptId majburiy" }, 400);
      }

      const paycomOpts = await paycomCallOptsForReceiptIdWithKv(String(receiptId));
      const result = await paymeCancelReceipt(receiptId, paycomOpts);

      if (!result.success) {
        return c.json({ error: result.error || "Chek bekor qilishda xatolik" }, 400);
      }

      return c.json({
        success: true,
        message: "Chek bekor qilindi",
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Cancel receipt error:", error);
      return c.json({ error: `Chek bekor qilishda xatolik: ${msg}` }, 500);
    }
  });

  app.post(`${base}/send-receipt`, async (c) => {
    try {
      const { receiptId, phone } = await c.req.json();

      if (!receiptId || !phone) {
        return c.json({ error: "receiptId va phone majburiy" }, 400);
      }

      const paycomOpts = await paycomCallOptsForReceiptIdWithKv(String(receiptId));
      if (!isPaymeConfiguredForMode(paycomOpts.useTest, null)) {
        return c.json(
          { error: "Paycom sozlanmagan (shu chek uchun kerak bo‘lgan muhit kaliti)" },
          503,
        );
      }

      const result = await paymeSendReceipt(String(receiptId), String(phone), paycomOpts);

      if (!result.success) {
        return c.json({ error: result.error || "SMS yuborilmadi" }, 400);
      }

      return c.json({ success: true, sent: result.sent !== false });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Send receipt error:", error);
      return c.json({ error: `SMS yuborishda xatolik: ${msg}` }, 500);
    }
  });
}
