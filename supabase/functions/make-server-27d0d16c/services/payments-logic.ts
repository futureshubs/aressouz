export const normalizeBranchId = (raw: unknown) =>
  String(raw || "").trim().replace(/^branch:/, "");

export const mapMethodToUI = (raw: unknown): string => {
  const m = String(raw || "").toLowerCase().trim();
  if (m === "cash") return "cash";
  if (m === "card") return "card";
  if (m === "qr" || m === "qrcode") return "qr";
  if (m === "click") return "click";
  if (m === "payme") return "payme";
  if (m === "uzum") return "uzum";
  if (m === "apelsin") return "apelsin";
  if (m === "atmos") return "card";
  return "cash";
};

export const mapOrderToPaymentUIStatus = (order: any): string => {
  const paymentRaw = String(order?.paymentStatus || "").toLowerCase().trim();
  const orderRaw = resolveOrderOperationalStatus(order);

  if (paymentRaw === "failed" || paymentRaw === "error") return "failed";
  if (paymentRaw === "refunded" || paymentRaw === "returned") return "refunded";
  if (paymentRaw === "cancelled" || paymentRaw === "canceled") return "cancelled";

  if (
    paymentRaw === "paid" ||
    paymentRaw === "completed" ||
    paymentRaw === "success" ||
    orderRaw === "delivered" ||
    orderRaw === "completed"
  ) {
    return "completed";
  }

  if (["preparing", "with_courier", "delivering", "ready"].includes(orderRaw)) return "processing";
  // Restaurant accepted the order (taom panel) — must NOT stay "pending" in cashier payment UI.
  if (orderRaw === "accepted" || orderRaw === "confirmed") return "processing";
  if (
    orderRaw &&
    orderRaw !== "pending" &&
    orderRaw !== "new" &&
    (orderRaw.includes("accept") || orderRaw.includes("confirm") || orderRaw.includes("qabul"))
  ) {
    return "processing";
  }
  if (["cancelled", "canceled"].includes(orderRaw)) return "cancelled";
  return "pending";
};

const pickStatusLoose = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .trim();

/** Higher = later in fulfillment; cancelled/rejected terminal. */
const rankOperationalStatus = (raw: string): number => {
  const s = pickStatusLoose(raw);
  if (!s) return 0;
  if (s === "cancelled" || s === "canceled" || s === "rejected") return 1000;
  if (s === "pending" || s === "new") return 10;
  if (s === "accepted" || s === "confirmed") return 20;
  if (s === "preparing") return 30;
  if (s === "ready") return 40;
  if (s === "with_courier" || s === "delivering") return 50;
  if (s === "delivered" || s === "completed") return 60;
  if (s.includes("accept") || s.includes("confirm") || s.includes("qabul")) return 20;
  return 15;
};

/** Prefer the more advanced status; on tie keep `a` (caller should pass top-level first). */
const mergeOperationalPick = (a: string, b: string): string => {
  const pa = pickStatusLoose(a);
  const pb = pickStatusLoose(b);
  if (!pa) return pb;
  if (!pb) return pa;
  const ra = rankOperationalStatus(pa);
  const rb = rankOperationalStatus(pb);
  if (rb > ra) return pb;
  if (ra > rb) return pa;
  return a;
};

export const resolveOrderOperationalStatus = (order: any): string => {
  const topFields = [
    order?.status,
    order?.orderStatus,
    order?.currentStatus,
    order?.order?.status,
    order?.payload?.status,
    order?.order_state,
    order?.state,
  ]
    .map((v) => pickStatusLoose(v))
    .filter(Boolean);

  let topLevel = "";
  for (const t of topFields) {
    topLevel = topLevel ? mergeOperationalPick(topLevel, t) : t;
  }

  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  let fromHistory = "";
  if (history.length > 0) {
    const parsed = history.map((e: any, idx: number) => ({
      status: pickStatusLoose(e?.status),
      ts: (() => {
        const t = e?.timestamp ?? e?.createdAt ?? e?.at;
        if (!t) return NaN;
        const n = new Date(t).getTime();
        return Number.isFinite(n) ? n : NaN;
      })(),
      idx,
    })).filter((x) => x.status);

    if (parsed.length === 0) {
      fromHistory = "";
    } else {
      const hasAnyTs = parsed.some((x) => Number.isFinite(x.ts));
      if (hasAnyTs) {
        parsed.sort((a, b) => {
          const ta = Number.isFinite(a.ts) ? a.ts : 0;
          const tb = Number.isFinite(b.ts) ? b.ts : 0;
          if (ta !== tb) return ta - tb;
          return a.idx - b.idx;
        });
        fromHistory = parsed[parsed.length - 1].status;
      } else {
        // No timestamps: merge all entries by rank (wrong append order / duplicates).
        fromHistory = parsed.slice(1).reduce(
          (acc, cur) => mergeOperationalPick(acc, cur.status),
          parsed[0].status,
        );
      }
    }
  }

  return mergeOperationalPick(topLevel, fromHistory);
};

export const pickQrImage = (entity: any): string =>
  String(
    entity?.paymentQrImage ||
      entity?.paymentQRImage ||
      entity?.payment_qr_image ||
      entity?.paymentQr ||
      entity?.payment_qr ||
      entity?.qrImageUrl ||
      entity?.qrCode ||
      entity?.qr_code ||
      entity?.payment?.qrImage ||
      entity?.payment?.qrImageUrl ||
      entity?.payment?.qr ||
      entity?.paymentDetails?.qrImageUrl ||
      ""
  ).trim();

export const parseMoneyLoose = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const normalized = s.replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

export const resolveCreatedTimestamp = (order: any): { createdAt: string; createdTs: number } => {
  let createdAt = String(order?.createdAt || order?.updatedAt || "");
  let createdTs = createdAt ? new Date(createdAt).getTime() : 0;
  if (!createdTs) {
    const rawId = String(order?.id || "");
    const m = rawId.match(/:(\d{10,})$/);
    if (m?.[1]) {
      const fromId = Number(m[1]);
      if (Number.isFinite(fromId) && fromId > 0) {
        createdTs = fromId;
        createdAt = new Date(fromId).toISOString();
      }
    }
  }
  return { createdAt, createdTs };
};

export const computeCashierAmount = (order: any, metadataItems: Array<{ price: number; quantity: number }>) => {
  const deliveryFee = Number(order?.deliveryPrice || order?.deliveryFee || 0) || 0;
  const serviceFee = Number(order?.serviceFee || 0) || 0;
  const discount = Number(order?.discount || order?.promoDiscount || 0) || 0;
  const tax = Number(order?.tax || 0) || 0;

  const amountFromOrder =
    parseMoneyLoose(order?.finalTotal) ||
    parseMoneyLoose(order?.totalAmount) ||
    parseMoneyLoose(order?.total) ||
    parseMoneyLoose(order?.grandTotal) ||
    parseMoneyLoose(order?.totalPrice) ||
    parseMoneyLoose(order?.total_price) ||
    0;

  const itemsSubtotal = metadataItems.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );

  const computedTotal = Math.max(0, itemsSubtotal + serviceFee + tax - discount);
  const amount = Math.max(0, amountFromOrder || computedTotal);
  return { amount, deliveryFee, serviceFee, discount, tax };
};

export const extractRestaurantIdFromOrder = (order: any): string => {
  let candidateRestaurantId = String(order?.restaurantId || "").trim();
  if (candidateRestaurantId) return candidateRestaurantId;

  const rawId = String(order?.id || "");
  const byId =
    rawId.match(/^order:restaurant:restaurant:(\d{6,}):\d+$/)?.[1] ||
    rawId.match(/^order:restaurant:(.+):\d+$/)?.[1] ||
    "";
  if (byId) return String(byId).trim();

  if (Array.isArray(order?.items) && order.items.length > 0) {
    const firstItem = order.items[0];
    const fromItem = String(
      firstItem?.restaurantId ||
        firstItem?.restaurant_id ||
        firstItem?.dishDetails?.restaurantId ||
        ""
    ).trim();
    if (fromItem) return fromItem;
  }

  return "";
};

