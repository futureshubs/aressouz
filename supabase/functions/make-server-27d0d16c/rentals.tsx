import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import * as r2 from "./r2-storage.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  escapeTelegramHtml,
  isValidTelegramTarget,
  sendHtmlTelegramWithToken,
  sendHtmlTelegramWithTokenDetailed,
} from "./telegram.tsx";
import {
  normalizeRentalProviderLogin,
  rentalProviderLoginLookupKey,
  rentalProviderRecordKey,
  rentalProviderSessionKey,
} from "./rental_provider_kv.ts";

function parsePageLimit(req: any, defaults?: { page?: number; limit?: number; maxLimit?: number }) {
  const pageRaw = req.query?.("page");
  const limitRaw = req.query?.("limit");
  const page0 = Math.floor(Number(pageRaw ?? defaults?.page ?? 1));
  const limit0 = Math.floor(Number(limitRaw ?? defaults?.limit ?? 20));
  const maxLimit = Math.max(1, Math.floor(Number(defaults?.maxLimit ?? 60)));
  const page = Number.isFinite(page0) && page0 > 0 ? page0 : 1;
  const limit =
    Number.isFinite(limit0) && limit0 > 0 ? Math.min(maxLimit, limit0) : Math.min(maxLimit, 20);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function applyTextSearch(list: any[], q: string) {
  const query = String(q || "").trim().toLowerCase();
  if (!query) return list;
  return (Array.isArray(list) ? list : []).filter((p: any) => {
    const hay = `${p?.name ?? ""} ${p?.description ?? ""} ${p?.catalog ?? ""} ${p?.category ?? ""} ${p?.region ?? ""} ${p?.district ?? ""}`.toLowerCase();
    return hay.includes(query);
  });
}

function normalizeLoc(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[`'’‘ʻʼ-]/g, "")
    .replace(/\s+/g, "");
}

function locMatches(a: unknown, b: string): boolean {
  const aa = normalizeLoc(a);
  const bb = normalizeLoc(b);
  if (!bb) return true;
  if (!aa) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function telegramRentalBotToken(): string {
  return (
    String(Deno.env.get("TELEGRAM_RENTAL_BOT_TOKEN") || "").trim() ||
    String(Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim()
  );
}

function telegramAutoCourierBotToken(): string {
  return (
    String(Deno.env.get("TELEGRAM_AUTO_COURIER_BOT_TOKEN") || "").trim() ||
    String(Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim()
  );
}

function formatRentalDepositTelegramLine(order: any): string {
  const desc = String(order.depositDescription || "").trim();
  const amt = Math.max(0, Math.round(Number(order.depositAmountUzs) || 0));
  const parts: string[] = [];
  if (desc) parts.push(desc);
  if (amt > 0) parts.push(`${amt.toLocaleString("uz-UZ")} so'm`);
  return parts.length ? parts.join(" · ") : "—";
}

/** Filial «Qabul qilish» dan keyin ijara beruvchi / filial chatiga */
function buildRentalBranchAcceptedNotifyHtml(order: any): string {
  const pickup = String(order.pickupAddress || "").trim();
  const delivery = String(order.deliveryAddress || order.address || "").trim();
  const garov = formatRentalDepositTelegramLine(order);
  return [
    `<b>✅ Filial buyurtmani qabul qildi</b>`,
    `<i>Ijara — tayyorlang va topshirish</i>`,
    ``,
    `Buyurtma tasdiqlandi. Mahsulotni tayyorlab, kuryer olib ketishiga topshiring.`,
    ``,
    `<b>Mahsulot:</b> ${escapeTelegramHtml(String(order.productName || ""))}`,
    `<b>Mijoz:</b> ${escapeTelegramHtml(String(order.customerName || ""))}`,
    `<b>Tel:</b> ${escapeTelegramHtml(String(order.customerPhone || ""))}`,
    `<b>Olib ketish (ijara beruvchi):</b> ${escapeTelegramHtml(pickup || "—")}`,
    delivery ? `<b>Mijozga yetkazish:</b> ${escapeTelegramHtml(delivery)}` : "",
    `<b>Garov:</b> ${escapeTelegramHtml(garov)}`,
    `<b>Summa:</b> ${escapeTelegramHtml(String(order.totalPrice ?? ""))} so'm`,
    `<b>Buyurtma ID:</b> <code>${escapeTelegramHtml(String(order.id || ""))}</code>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Mijoz ijara bo‘limidan buyurtma berganda — filial / ijara beruvchi chatiga */
function buildRentalNewOrderNotifyHtml(order: any): string {
  const pickup = String(order.pickupAddress || "").trim();
  const delivery = String(order.deliveryAddress || order.address || "").trim();
  const garov = formatRentalDepositTelegramLine(order);
  return [
    `<b>🆕 Yangi ijara buyurtmasi</b>`,
    `Filial yoki ijara panelida «Qabul qilish» ni bosing.`,
    ``,
    `<b>Mahsulot:</b> ${escapeTelegramHtml(String(order.productName || ""))}`,
    `<b>Mijoz:</b> ${escapeTelegramHtml(String(order.customerName || ""))}`,
    `<b>Tel:</b> ${escapeTelegramHtml(String(order.customerPhone || ""))}`,
    `<b>Olib ketish (ijara beruvchi):</b> ${escapeTelegramHtml(pickup || "—")}`,
    delivery ? `<b>Mijozga yetkazish:</b> ${escapeTelegramHtml(delivery)}` : "",
    `<b>Garov:</b> ${escapeTelegramHtml(garov)}`,
    `<b>Summa:</b> ${escapeTelegramHtml(String(order.totalPrice ?? ""))} so'm`,
    `<b>Buyurtma ID:</b> <code>${escapeTelegramHtml(String(order.id || ""))}</code>`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function readBranchRentalTelegramChatId(branchId: string): Promise<string> {
  try {
    const br = await kv.get(`branch:${branchId}`);
    if (!br || typeof br !== "object") return "";
    const o = br as Record<string, unknown>;
    return String(o.rentalTelegramChatId || o.ijaraTelegramChatId || "").trim();
  } catch {
    return "";
  }
}

/** Filialda og‘ir ijara uchun avto-kuryer (Telegram + navbat). Default: yoqilgan */
async function readBranchAutoCourierRentalsEnabled(branchId: string): Promise<boolean> {
  try {
    const br = await kv.get(`branch:${branchId}`);
    if (!br || typeof br !== "object") return true;
    return (br as Record<string, unknown>).autoCourierRentalsEnabled !== false;
  } catch {
    return true;
  }
}

async function sendRentalOrderTelegrams(order: any, product: any, branchId: string) {
  try {
    const prepChat = String(
      product?.telegramChatId || order.prepTelegramChatId || "",
    ).trim();
    const branchChat = await readBranchRentalTelegramChatId(branchId);
    const rentalBot = telegramRentalBotToken();

    if (rentalBot) {
      const html = buildRentalBranchAcceptedNotifyHtml(order);
      const sent = new Set<string>();
      for (const cid of [prepChat, branchChat]) {
        if (!cid || !isValidTelegramTarget(cid) || sent.has(cid)) continue;
        sent.add(cid);
        await sendHtmlTelegramWithToken(rentalBot, cid, html);
      }
      if (sent.size === 0) {
        console.warn(
          "sendRentalOrderTelegrams: ijara buyurtmasi uchun Telegram chat yo‘q (mahsulot/filial sozlamalari)",
        );
      }
    }

    if (order.requiresAutoCourier === true) {
      const acBot = telegramAutoCourierBotToken();
      if (acBot) {
        const all = (await kv.getByPrefix("auto_courier:")) || [];
        const couriers = all.filter(
          (x: any) =>
            x &&
            !x.deleted &&
            String(x.branchId) === branchId &&
            String(x.status) === "active",
        );
        const w = order.productWeightKg != null
          ? String(order.productWeightKg)
          : "—";
        const pickup = String(order.pickupAddress || "").trim();
        const delivery = String(order.deliveryAddress || order.address || "").trim();
        const garov = formatRentalDepositTelegramLine(order);
        const html = [
          `<b>Ijara: katta yuk / avto-kuryer</b>`,
          `Filial buyurtmani qabul qildi — panelda «Olish».`,
          ``,
          `Mahsulot: ${escapeTelegramHtml(order.productName)}`,
          `Og'irlik: ${escapeTelegramHtml(w)} kg`,
          `Mijoz: ${escapeTelegramHtml(order.customerName)}`,
          `Tel: ${escapeTelegramHtml(order.customerPhone)}`,
          pickup ? `Olib ketish: ${escapeTelegramHtml(pickup)}` : "",
          delivery ? `Mijozga: ${escapeTelegramHtml(delivery)}` : "",
          `Garov: ${escapeTelegramHtml(garov)}`,
          `ID: ${escapeTelegramHtml(order.id)}`,
        ]
          .filter(Boolean)
          .join("\n");
        for (const c of couriers) {
          const cid = String(c.telegramChatId || "").trim();
          if (cid && isValidTelegramTarget(cid)) {
            await sendHtmlTelegramWithToken(acBot, cid, html);
          }
        }
      }
    }
  } catch (e) {
    console.error("sendRentalOrderTelegrams:", e);
  }
}

/** Buyurtma yaratilishi bilan — mahsulot chat + filial ijara Telegram (avto-kuryer yo‘q) */
async function sendRentalNewOrderTelegrams(order: any, product: any, branchId: string) {
  try {
    const prepChat = String(
      product?.telegramChatId || order.prepTelegramChatId || "",
    ).trim();
    const branchChat = await readBranchRentalTelegramChatId(branchId);
    const rentalBot = telegramRentalBotToken();
    if (!rentalBot) {
      console.warn(
        "sendRentalNewOrderTelegrams: bot token yo‘q (TELEGRAM_RENTAL_BOT_TOKEN yoki TELEGRAM_BOT_TOKEN)",
      );
      return;
    }
    const html = buildRentalNewOrderNotifyHtml(order);
    const sent = new Set<string>();
    for (const cid of [prepChat, branchChat]) {
      if (!cid || !isValidTelegramTarget(cid) || sent.has(cid)) continue;
      sent.add(cid);
      await sendHtmlTelegramWithToken(rentalBot, cid, html);
    }
    if (sent.size === 0) {
      console.warn(
        "sendRentalNewOrderTelegrams: Telegram chat yo‘q — filialda «Ijara Telegram» yoki mahsulotda chat ID qo‘ying",
      );
    }
  } catch (e) {
    console.error("sendRentalNewOrderTelegrams:", e);
  }
}

const app = new Hono();

function collectRentalProductHttpUrls(p: Record<string, unknown> | null | undefined): Set<string> {
  const urls = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://"))) urls.add(v.trim());
  };
  if (!p) return urls;
  add(p.image);
  add(p.photo);
  add(p.coverImage);
  if (Array.isArray(p.images)) for (const x of p.images) add(x);
  return urls;
}

async function purgeRentalProductR2Diff(before: unknown, after: unknown) {
  const oldU = collectRentalProductHttpUrls(before as Record<string, unknown>);
  const newU = collectRentalProductHttpUrls(after as Record<string, unknown>);
  for (const url of oldU) {
    if (!newU.has(url)) await r2.deleteManagedR2UrlIfKnown(url);
  }
}

async function purgeAllRentalProductR2(p: unknown) {
  for (const url of collectRentalProductHttpUrls(p as Record<string, unknown>)) {
    await r2.deleteManagedR2UrlIfKnown(url);
  }
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function normalizePhoneDigits(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 9) return `998${d}`;
  if (d.startsWith("998")) return d;
  if (d.length === 12 && d.startsWith("998")) return d;
  return d;
}

function addPaymentInterval(iso: string, schedule: "weekly" | "monthly"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  if (schedule === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function computeInitialNextDue(
  contractStartIso: string,
  schedule: "upfront" | "weekly" | "monthly",
): string | null {
  if (schedule === "upfront") return null;
  return addPaymentInterval(contractStartIso, schedule);
}

/** Kuryer yetkazgandan keyin — ijara tugash vaqti */
function computeRentalPeriodEndIso(
  startIso: string,
  rentalPeriod: string,
  rentalDuration: number,
): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  const n = Math.max(1, Number(rentalDuration) || 1);
  const p = String(rentalPeriod || "daily").toLowerCase();
  if (p === "hourly") d.setHours(d.getHours() + n);
  else if (p === "daily") d.setDate(d.getDate() + n);
  else if (p === "weekly") d.setDate(d.getDate() + n * 7);
  else if (p === "monthly") d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n);
  return d.toISOString();
}

/** Mijoz/filial muddat uzaytirish: `anchor` dan boshlab N ta davr qo‘shadi */
function addRentalUnitsFromAnchor(
  anchorMs: number,
  rentalPeriod: string,
  units: number,
): string {
  const d = new Date(anchorMs);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  const n = Math.max(1, Math.floor(units) || 1);
  const p = String(rentalPeriod || "daily").toLowerCase();
  if (p === "hourly") d.setHours(d.getHours() + n);
  else if (p === "daily") d.setDate(d.getDate() + n);
  else if (p === "weekly") d.setDate(d.getDate() + n * 7);
  else if (p === "monthly") d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n);
  return d.toISOString();
}

function maxCustomerExtendUnits(rentalPeriod: string): number {
  const p = String(rentalPeriod || "").toLowerCase();
  if (p === "hourly") return 168;
  if (p === "daily") return 60;
  if (p === "weekly") return 24;
  if (p === "monthly") return 12;
  return 60;
}

function parseOptionalPlatformCommissionPercent(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function parseOptionalLatitude(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  if (!Number.isFinite(n) || n < -90 || n > 90) return null;
  return n;
}

function parseOptionalLongitude(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  if (!Number.isFinite(n) || n < -180 || n > 180) return null;
  return n;
}

function rentalCourierActiveKey(courierId: string, orderId: string) {
  return `rental_courier_active_${courierId}_${orderId}`;
}

function rentalCourierDeliveryPendingKey(courierId: string, orderId: string) {
  return `rental_courier_delivery_pending_${courierId}_${orderId}`;
}

async function removeRentalCourierIndex(order: any) {
  const cid = String(order?.deliveryCourierId || "").trim();
  const oid = String(order?.id || "").trim();
  if (cid && oid) {
    try {
      await kv.del(rentalCourierActiveKey(cid, oid));
    } catch (_) { /* ignore */ }
    try {
      await kv.del(rentalCourierDeliveryPendingKey(cid, oid));
    } catch (_) { /* ignore */ }
  }
}

async function attachRentalProductImageIfNeeded(row: any): Promise<void> {
  if (!row || row.productImage || !row.productId || !row.branchId) return;
  try {
    const prod = await kv.get(`rental_product_${row.branchId}_${row.productId}`);
    const img = prod?.image || prod?.coverImage;
    if (typeof img === "string" && img.trim()) row.productImage = img.trim();
  } catch (_) { /* ignore */ }
}

/** Yangi buyurtmalar: null = filial hali qabul qilmagan. Eski yozuvlarda maydon bo‘lmasa — avtomatik qabul qilingan hisoblanadi */
function rentalBranchEffectivelyAccepted(order: any): boolean {
  return !Object.prototype.hasOwnProperty.call(order, "branchAcceptedAt") ||
    order.branchAcceptedAt != null;
}

async function resolveAutoCourierSession(
  c: any,
): Promise<{ courierId: string; branchId: string } | null> {
  const token =
    c.req.header("X-Auto-Courier-Token") ||
    c.req.header("x-auto-courier-token") ||
    c.req.query("token") ||
    "";
  const tok = String(token || "").trim();
  if (!tok) return null;
  const s = await kv.get(`auto_courier_session:${tok}`);
  if (!s || Date.now() > Number(s.expiresAt || 0)) return null;
  const courierId = String(s.courierId || "").trim();
  if (!courierId) return null;
  const row = await kv.get(`auto_courier:${courierId}`);
  if (!row || row.deleted || String(row.status) !== "active") return null;
  const branchId = String(s.branchId || row.branchId || "").trim();
  if (!branchId) return null;
  return { courierId, branchId };
}

async function resolveRentalDeliveryActorSession(
  c: any,
): Promise<{ courierId: string; branchId?: string } | null> {
  const reg = await resolveCourierSession(c);
  if (reg) return reg;
  return await resolveAutoCourierSession(c);
}

async function finalizeRentalDeliveryToCustomer(
  order: any,
  orderKey: string,
  orderId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const courierId = String(order.deliveryCourierId || "").trim();
  order.rentalPeriodStartedAt = nowIso;
  order.rentalPeriodEndsAt = computeRentalPeriodEndIso(
    nowIso,
    order.rentalPeriod,
    order.rentalDuration,
  );
  order.deliveryConfirmedAt = nowIso;
  order.contractStartDate = nowIso;
  order.deliveryPending = false;
  const sched = order.paymentSchedule === "weekly" || order.paymentSchedule === "monthly"
    ? order.paymentSchedule
    : "upfront";
  order.nextPaymentDue = computeInitialNextDue(nowIso, sched);
  order.updatedAt = nowIso;
  if (courierId) {
    try {
      await kv.del(rentalCourierDeliveryPendingKey(courierId, orderId));
    } catch (_) { /* ignore */ }
    await kv.set(rentalCourierActiveKey(courierId, orderId), {
      branchId: order.branchId,
      orderId,
    });
  }
  await kv.set(orderKey, order);
}

/** Naqd bo‘lsa kuryer kassaga topshiradi (market buyurtma qoidasi: jami − yetkazish haqi). */
function rentalPaymentIsCashLike(paymentMethod: unknown): boolean {
  const raw = String(paymentMethod || "").toLowerCase().trim();
  if (raw === "cash") return true;
  if (raw.includes("naqd") || raw.includes("naqt") || raw.includes("cash")) return true;
  if (!raw) return true;
  return false;
}

function computeRentalCourierHandoffUzs(order: {
  totalPrice?: unknown;
  deliveryPrice?: unknown;
  deliveryFee?: unknown;
  paymentMethod?: unknown;
}): { expectedUzs: number; isCashLike: boolean } {
  const isCashLike = rentalPaymentIsCashLike(order.paymentMethod);
  if (!isCashLike) return { expectedUzs: 0, isCashLike: false };
  const totalNum = Math.max(0, Math.round(Number(order.totalPrice) || 0));
  const deliveryFeeNum = Math.max(
    0,
    Math.round(Number(order.deliveryPrice ?? order.deliveryFee ?? 0) || 0),
  );
  return { expectedUzs: Math.max(0, totalNum - deliveryFeeNum), isCashLike: true };
}

async function resolveCourierSession(
  c: any,
): Promise<{ courierId: string; branchId?: string } | null> {
  const token =
    c.req.header("X-Courier-Token") ||
    c.req.header("x-courier-token") ||
    c.req.query("token");
  if (!token) return null;
  const session = await kv.get(`courier_session:${token}`);
  if (!session || Date.now() > Number(session.expiresAt || 0)) return null;
  const courierId = String(session.courierId || "").trim();
  if (!courierId) return null;
  const courier = await kv.get(`courier:${courierId}`);
  if (!courier || courier.deleted) return null;
  const branchId = String(courier.branchId || "").trim();
  return { courierId, branchId: branchId || undefined };
}

function enrichRentalOrderForClient(order: any) {
  const now = Date.now();
  const due = order.nextPaymentDue ? new Date(order.nextPaymentDue).getTime() : null;
  let paymentAlert: "none" | "due_soon" | "overdue" = "none";
  if (order.paymentSchedule === "weekly" || order.paymentSchedule === "monthly") {
    if (due != null && !Number.isNaN(due)) {
      if (due < now) paymentAlert = "overdue";
      else if (due < now + 3 * 24 * 60 * 60 * 1000) paymentAlert = "due_soon";
    }
  }
  let pickupAlert: "none" | "due_soon" | "overdue" = "none";
  const endT = order.rentalPeriodEndsAt ? new Date(order.rentalPeriodEndsAt).getTime() : null;
  if (
    order.status === "active" &&
    order.rentalPeriodStartedAt &&
    endT != null &&
    !Number.isNaN(endT)
  ) {
    if (now > endT) pickupAlert = "overdue";
    else if (now > endT - 24 * 60 * 60 * 1000) pickupAlert = "due_soon";
  }
  const st = String(order.status || "").toLowerCase();
  const active = st === "active";
  const branchOk = rentalBranchEffectivelyAccepted(order);
  const courierIdSet = Boolean(String(order.deliveryCourierId || "").trim());
  /** Filial «qabul qilish» kutilmoqda (yangi buyurtmalar) */
  const needsBranchAcceptance = active && order.deliveryPending === true && !branchOk;
  /** Filial qabul qilingan, lekin kuryer hali tayinlanmagan / avto-kuryer kutilyapti */
  const awaitingCourierAssignment =
    active && branchOk && order.deliveryPending === true && !courierIdSet;
  /** Kuryer tayinlangan, mijoz yoki kuryer «yetkazildi» tasdig‘i kutilmoqda — shundan keyin muddat boshlanadi */
  const awaitingDeliveryConfirmation =
    active && branchOk && courierIdSet && !order.rentalPeriodStartedAt;
  /** Yetkazish bosqichida (ijara muddati hali boshlanmagan) — keng ma’noda */
  const awaitingCourierDelivery = active && !order.rentalPeriodStartedAt;
  const handoff = computeRentalCourierHandoffUzs(order);
  return {
    ...order,
    paymentAlert,
    pickupAlert,
    needsBranchAcceptance,
    awaitingCourierAssignment,
    awaitingDeliveryConfirmation,
    awaitingCourierDelivery,
    rentalCourierToCashierPreviewUzs: handoff.expectedUzs,
    rentalPaymentIsCashLike: handoff.isCashLike,
  };
}

// Validate user
async function validateUser(c: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    console.log('❌ No Authorization header');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    console.log('❌ Invalid token:', error);
    return null;
  }
  
  return user;
}

async function legacyBranchIdFromHeaders(c: any): Promise<string | null> {
  const t = String(
    c.req.header("X-Branch-Token") ||
      c.req.header("x-branch-token") ||
      "",
  ).trim();
  if (!t) return null;
  const session = await kv.get(`branch_session:${t}`);
  if (!session || Date.now() > Number(session.expiresAt || 0)) return null;
  return String(session.branchId || "").trim() || null;
}

/** Filial SaaS: X-Branch-Supabase-Jwt yoki Bearer (anon emas) → membership → KV filial id */
async function resolveJwtStaffBranchId(c: any): Promise<string | null> {
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const jwtHdr = String(
    c.req.header("X-Branch-Supabase-Jwt") ||
      c.req.header("x-branch-supabase-jwt") ||
      "",
  ).trim();
  const authHeader = String(c.req.header("Authorization") || "").trim();
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader;
  const token = jwtHdr || (bearer && bearer !== anonKey ? bearer : "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const relationalUserId = existingUser?.id as string | undefined;
  if (!relationalUserId) return null;
  const { data: membership } = await supabase
    .from("branch_staff_memberships")
    .select("branch_kv_id, branch_id")
    .eq("user_id", relationalUserId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;
  const kvId = String(membership.branch_kv_id || "").trim();
  const relId = String(membership.branch_id || "").trim();
  return kvId || relId || null;
}

/**
 * Ijara paneli (filial token/JWT yoki ijara beruvchi sessiyasi).
 * Anon kalit yoliga ruxsat bermaydi.
 */
async function assertRentalBranchPanelAccess(
  c: any,
  branchId: string,
): Promise<Response | null> {
  const bid = String(branchId || "").trim();
  if (!bid) {
    return c.json({ success: false, error: "branchId majburiy" }, 400);
  }

  const rpTok = String(
    c.req.header("X-Rental-Provider-Token") ||
      c.req.header("x-rental-provider-token") ||
      "",
  ).trim();

  if (rpTok) {
    const session = await kv.get(rentalProviderSessionKey(rpTok));
    if (!session || Date.now() > Number(session.expiresAt || 0)) {
      return c.json({ success: false, error: "Ijara beruvchi sessiyasi tugagan" }, 401);
    }
    if (String(session.branchId || "") !== bid) {
      return c.json({ success: false, error: "Ruxsat yo‘q" }, 403);
    }
    return null;
  }

  if ((await legacyBranchIdFromHeaders(c)) === bid) return null;
  if ((await resolveJwtStaffBranchId(c)) === bid) return null;

  return c.json({
    success: false,
    error:
      "Filial (X-Branch-Token / JWT) yoki ijara beruvchi (X-Rental-Provider-Token) talab qilinadi",
  }, 403);
}

async function assertRentalApplicationWrite(
  c: any,
  branchId: string,
): Promise<Response | null> {
  const bid = String(branchId || "").trim();
  const user = await validateUser(c);
  if (user) return null;
  return await assertRentalBranchPanelAccess(c, bid);
}

// ==================== IJARA BERUVCHI AUTH ====================

app.post("/provider/login", async (c) => {
  try {
    const body = await c.req.json();
    const loginRaw = String(body.login || "").trim();
    const password = String(body.password || "");
    if (!loginRaw || !password) {
      return c.json({ success: false, error: "Login va parol majburiy" }, 400);
    }
    const norm = normalizeRentalProviderLogin(loginRaw);
    if (!norm) {
      return c.json({ success: false, error: "Login noto‘g‘ri" }, 400);
    }
    const ref = await kv.get(rentalProviderLoginLookupKey(norm)) as
      | { branchId?: string; providerId?: string }
      | null;
    if (!ref?.branchId || !ref?.providerId) {
      return c.json({ success: false, error: "Login yoki parol noto‘g‘ri" }, 401);
    }
    const rec = await kv.get(
      rentalProviderRecordKey(String(ref.branchId), String(ref.providerId)),
    ) as Record<string, unknown> | null;
    if (
      !rec ||
      rec.deleted === true ||
      String(rec.password || "") !== password
    ) {
      return c.json({ success: false, error: "Login yoki parol noto‘g‘ri" }, 401);
    }
    const token = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await kv.set(rentalProviderSessionKey(token), {
      branchId: String(ref.branchId),
      providerId: String(ref.providerId),
      login: String(rec.login || loginRaw),
      displayName: String(rec.displayName || rec.name || loginRaw),
      expiresAt,
      createdAt: new Date().toISOString(),
    });
    return c.json({
      success: true,
      token,
      branchId: String(ref.branchId),
      provider: {
        id: String(ref.providerId),
        displayName: String(rec.displayName || rec.name || loginRaw),
        login: String(rec.login || loginRaw),
      },
    });
  } catch (e: any) {
    console.error("rental provider login:", e);
    return c.json({ success: false, error: e?.message || "Xatolik" }, 500);
  }
});

app.post("/provider/logout", async (c) => {
  try {
    const tok = String(
      c.req.header("X-Rental-Provider-Token") ||
        c.req.header("x-rental-provider-token") ||
        "",
    ).trim();
    if (tok) await kv.del(rentalProviderSessionKey(tok));
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || "Xatolik" }, 500);
  }
});

// ==================== RENTAL PRODUCTS ====================

/** Filial paneli: tayyorlovchi chat ID ni sinash (buyurtmadan oldin) */
app.post("/telegram/test-prep", async (c) => {
  try {
    const body = await c.req.json();
    const branchId = String(body.branchId || "").trim();
    const denied = await assertRentalBranchPanelAccess(c, branchId);
    if (denied) return denied;
    const telegramChatId = String(body.telegramChatId || "").trim();
    if (!branchId) {
      return c.json({ success: false, error: "branchId majburiy" }, 400);
    }
    if (!telegramChatId) {
      return c.json({ success: false, error: "Telegram chat ID kiriting" }, 400);
    }
    const rentalBot = telegramRentalBotToken();
    if (!rentalBot) {
      return c.json({
        success: false,
        error:
          "Serverda ijara bot tokeni yo‘q: TELEGRAM_RENTAL_BOT_TOKEN yoki TELEGRAM_BOT_TOKEN",
      }, 503);
    }
    const html = [
      `<b>Ijara bot — sinov xabari</b>`,
      `Filial panelidan yuborildi.`,
      ``,
      `Agar buni ko‘ryapsiz — chat ID to‘g‘ri va bot ushbu chatga xabar yubora oladi.`,
      `Haqiqiy buyurtmada shu yerga «Sizdan buyurtma qilindi» xabari keladi.`,
      ``,
      `Filial: <code>${escapeTelegramHtml(branchId)}</code>`,
    ].join("\n");
    const result = await sendHtmlTelegramWithTokenDetailed(
      rentalBot,
      telegramChatId,
      html,
    );
    if (!result.ok) {
      return c.json({ success: false, error: result.message }, 400);
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error("telegram/test-prep:", error);
    return c.json(
      { success: false, error: error?.message || "Xatolik" },
      500,
    );
  }
});

/** Filial bo‘yicha barcha ijara buyurtmalari uchun Telegram (mahsulotda chat bo‘lmasa ham) */
app.get("/branch/rental-notify-settings/:branchId", async (c) => {
  try {
    const branchId = String(c.req.param("branchId") || "").trim();
    const denied = await assertRentalBranchPanelAccess(c, branchId);
    if (denied) return denied;
    const chat = await readBranchRentalTelegramChatId(branchId);
    const autoOn = await readBranchAutoCourierRentalsEnabled(branchId);
    return c.json({
      success: true,
      rentalTelegramChatId: chat,
      autoCourierRentalsEnabled: autoOn,
    });
  } catch (error: any) {
    console.error("branch/rental-notify-settings get:", error);
    return c.json(
      { success: false, error: error?.message || "Xatolik" },
      500,
    );
  }
});

app.put("/branch/rental-notify-settings", async (c) => {
  try {
    const body = await c.req.json();
    const branchId = String(body.branchId || "").trim();
    const denied = await assertRentalBranchPanelAccess(c, branchId);
    if (denied) return denied;
    const existing = await kv.get(`branch:${branchId}`);
    if (!existing || typeof existing !== "object") {
      return c.json({ success: false, error: "Filial topilmadi" }, 404);
    }
    const prev = existing as Record<string, unknown>;
    let nextChat: string | undefined;
    if (body.rentalTelegramChatId !== undefined && body.rentalTelegramChatId !== null) {
      const s = String(body.rentalTelegramChatId).trim();
      if (s) {
        if (!isValidTelegramTarget(s)) {
          return c.json(
            { success: false, error: "Telegram chat ID noto‘g‘ri" },
            400,
          );
        }
        nextChat = s;
      } else {
        nextChat = "";
      }
    }
    let nextAuto: boolean | undefined;
    if (typeof body.autoCourierRentalsEnabled === "boolean") {
      nextAuto = body.autoCourierRentalsEnabled;
    }
    if (nextChat === undefined && nextAuto === undefined) {
      return c.json(
        { success: false, error: "rentalTelegramChatId yoki autoCourierRentalsEnabled yuboring" },
        400,
      );
    }
    const merged: Record<string, unknown> = {
      ...prev,
      updatedAt: new Date().toISOString(),
    };
    if (nextChat !== undefined) merged.rentalTelegramChatId = nextChat;
    if (nextAuto !== undefined) merged.autoCourierRentalsEnabled = nextAuto;
    await kv.set(`branch:${branchId}`, merged);
    const chatOut =
      nextChat !== undefined ? nextChat : await readBranchRentalTelegramChatId(branchId);
    const autoOut =
      nextAuto !== undefined ? nextAuto : await readBranchAutoCourierRentalsEnabled(branchId);
    return c.json({
      success: true,
      rentalTelegramChatId: chatOut,
      autoCourierRentalsEnabled: autoOut,
    });
  } catch (error: any) {
    console.error("branch/rental-notify-settings put:", error);
    return c.json(
      { success: false, error: error?.message || "Xatolik" },
      500,
    );
  }
});

// Get all rental products for a branch
app.get('/products/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const q = String(c.req.query("q") || "").trim();
    const { page, limit, offset } = parsePageLimit(c.req, { page: 1, limit: 20, maxLimit: 60 });
    /** Do‘kon / katalog: ochiq o‘qish; tahrirlash POST/PUT/DELETE da himoyalangan */
    console.log('📦 ===== GET RENTAL PRODUCTS =====');
    console.log('📦 Getting rental products for branch:', branchId);
    
    let products = await kv.getByPrefix(`rental_product_${branchId}_`);
    products = applyTextSearch(products || [], q);
    const total = products.length;
    const pageItems = products.slice(offset, offset + limit);
    const hasMore = offset + limit < total;
    console.log(`📦 Found ${products?.length || 0} products for branch ${branchId}`);
    
    return c.json({ 
      success: true, 
      products: pageItems || [],
      page,
      limit,
      total,
      hasMore,
    });
  } catch (error: any) {
    console.error('❌ ===== ERROR GETTING RENTAL PRODUCTS =====');
    console.error('❌ Error details:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    return c.json({ 
      success: false, 
      error: error.message,
      products: []
    }, 500);
  }
});

// Get rental products (paged) across branches (public)
app.get("/products", async (c) => {
  try {
    const region = String(c.req.query("region") || "").trim();
    const district = String(c.req.query("district") || "").trim();
    const q = String(c.req.query("q") || "").trim();
    const catalog = String(c.req.query("catalog") || "").trim();
    const category = String(c.req.query("category") || "").trim();
    const { page, limit, offset } = parsePageLimit(c.req, { page: 1, limit: 20, maxLimit: 60 });

    const allBranches = await kv.getByPrefix("branch:");
    const branches = (Array.isArray(allBranches) ? allBranches : []).filter((b: any) => {
      if (!b || b.deleted) return false;
      if (region && !locMatches(b.region ?? b.regionId, region)) return false;
      if (district && !locMatches(b.district ?? b.districtId, district)) return false;
      return true;
    });

    const all: any[] = [];
    for (const b of branches) {
      const bid = String(b.id || "").trim();
      if (!bid) continue;
      const rows = await kv.getByPrefix(`rental_product_${bid}_`);
      if (Array.isArray(rows) && rows.length) all.push(...rows);
    }

    let filtered = applyTextSearch(all, q);
    if (catalog) filtered = filtered.filter((p: any) => String(p?.catalog || "").trim() === catalog);
    if (category) filtered = filtered.filter((p: any) => String(p?.category || "").trim() === category);

    // newest first
    filtered.sort((a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());

    const total = filtered.length;
    const pageItems = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < total;
    return c.json({ success: true, products: pageItems, page, limit, total, hasMore });
  } catch (e: any) {
    console.error("[rentals/products] error", e);
    return c.json({ success: false, error: "Ijara mahsulotlarini olishda xatolik", products: [] }, 500);
  }
});

// Get single rental product
app.get('/product/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const product = await kv.get(`rental_product_${id}`);
    
    if (!product) {
      return c.json({ success: false, error: 'Product not found' }, 404);
    }
    
    return c.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Error getting rental product:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create rental product
app.post('/products', async (c) => {
  try {
    const body = await c.req.json();
    const denied = await assertRentalBranchPanelAccess(c, String(body.branchId || ""));
    if (denied) return denied;
    console.log('📝 Creating rental product:', JSON.stringify(body, null, 2));
    
    if (!body.branchId || !body.name || !body.category || !body.region) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields: branchId, name, category, region' 
      }, 400);
    }
    
    const productId = `${body.branchId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const rawChat = String(body.telegramChatId || "").trim();
    const weightKg = Math.max(0, Number(body.weightKg) || 0);
    const requiresAutoCourier =
      Boolean(body.requiresAutoCourier) || weightKg > 10;

    const platformCommissionPercent = parseOptionalPlatformCommissionPercent(
      body.platformCommissionPercent,
    );
    const latitude = parseOptionalLatitude(body.latitude);
    const longitude = parseOptionalLongitude(body.longitude);

    const product = {
      id: productId,
      ...body,
      telegramChatId: isValidTelegramTarget(rawChat) ? rawChat : "",
      weightKg,
      requiresAutoCourier,
      platformCommissionPercent,
      latitude,
      longitude,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      totalQuantity: body.quantity || 0,
      availableQuantity: body.quantity || 0,
      inRent: 0
    };
    
    console.log('💾 Saving product with key:', `rental_product_${body.branchId}_${productId}`);
    await kv.set(`rental_product_${body.branchId}_${productId}`, product);
    
    // Also create warehouse entry
    const warehouseEntry = {
      productId,
      branchId: body.branchId,
      total: body.quantity || 0,
      available: body.quantity || 0,
      inRent: 0,
      lastUpdated: new Date().toISOString()
    };
    
    await kv.set(`rental_warehouse_${body.branchId}_${productId}`, warehouseEntry);
    
    console.log('✅ Rental product created successfully:', productId);
    return c.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Error creating rental product:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update rental product
app.put('/products/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const denied = await assertRentalBranchPanelAccess(c, String(body.branchId || ""));
    if (denied) return denied;
    
    console.log('📝 Updating rental product:', id, 'with data:', JSON.stringify(body, null, 2));
    
    if (!body.branchId) {
      return c.json({ success: false, error: 'branchId is required' }, 400);
    }
    
    const existingProduct = await kv.get(`rental_product_${body.branchId}_${id}`);
    
    if (!existingProduct) {
      console.log('❌ Product not found:', `rental_product_${body.branchId}_${id}`);
      return c.json({ success: false, error: 'Product not found' }, 404);
    }
    
    const rawChat =
      body.telegramChatId !== undefined
        ? String(body.telegramChatId || "").trim()
        : String(existingProduct.telegramChatId || "").trim();
    const weightKg =
      body.weightKg !== undefined
        ? Math.max(0, Number(body.weightKg) || 0)
        : Math.max(0, Number(existingProduct.weightKg) || 0);
    const requiresAutoCourier =
      body.requiresAutoCourier !== undefined
        ? Boolean(body.requiresAutoCourier) || weightKg > 10
        : Boolean(existingProduct.requiresAutoCourier) || weightKg > 10;

    const ex = existingProduct as Record<string, unknown>;
    const platformCommissionPercent =
      body.platformCommissionPercent !== undefined
        ? parseOptionalPlatformCommissionPercent(body.platformCommissionPercent)
        : (ex.platformCommissionPercent as number | null | undefined) ?? null;
    const latitude =
      body.latitude !== undefined
        ? parseOptionalLatitude(body.latitude)
        : parseOptionalLatitude(ex.latitude);
    const longitude =
      body.longitude !== undefined
        ? parseOptionalLongitude(body.longitude)
        : parseOptionalLongitude(ex.longitude);

    const updatedProduct = {
      ...existingProduct,
      ...body,
      id: existingProduct.id,
      telegramChatId: isValidTelegramTarget(rawChat) ? rawChat : "",
      weightKg,
      requiresAutoCourier,
      platformCommissionPercent,
      latitude,
      longitude,
      updatedAt: new Date().toISOString()
    };
    
    await purgeRentalProductR2Diff(existingProduct, updatedProduct);
    await kv.set(`rental_product_${body.branchId}_${id}`, updatedProduct);
    
    console.log('✅ Rental product updated successfully:', id);
    return c.json({ success: true, product: updatedProduct });
  } catch (error: any) {
    console.error('❌ Error updating rental product:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete rental product
app.delete('/products/:branchId/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const branchId = c.req.param('branchId');
    const denied = await assertRentalBranchPanelAccess(c, branchId);
    if (denied) return denied;
    
    console.log('🗑️ Deleting rental product:', branchId, id);
    
    const existing = await kv.get(`rental_product_${branchId}_${id}`);
    if (existing) await purgeAllRentalProductR2(existing);

    await kv.del(`rental_product_${branchId}_${id}`);
    await kv.del(`rental_warehouse_${branchId}_${id}`);
    
    console.log('✅ Rental product deleted successfully');
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error deleting rental product:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== WAREHOUSE ====================

// Get warehouse for branch
app.get('/warehouse/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const denied = await assertRentalBranchPanelAccess(c, branchId);
    if (denied) return denied;
    const warehouse = await kv.getByPrefix(`rental_warehouse_${branchId}_`);
    
    return c.json({ success: true, warehouse: warehouse || [] });
  } catch (error: any) {
    console.error('❌ Error getting warehouse:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== RENTAL ORDERS ====================

// Get all rental orders for a branch
app.get('/orders/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const denied = await assertRentalBranchPanelAccess(c, branchId);
    if (denied) return denied;
    const orders = await kv.getByPrefix(`rental_order_${branchId}_`);
    const list = (orders || []).map((o: any) => enrichRentalOrderForClient(o));
    return c.json({ success: true, orders: list });
  } catch (error: any) {
    console.error('❌ Error getting rental orders:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/** Mijoz telefon bo‘yicha faol ijaralar (indeks orqali) */
app.get('/my-rentals', async (c) => {
  try {
    const phone = c.req.query('phone') || '';
    const pk = normalizePhoneDigits(phone);
    if (!pk || pk.length < 9) {
      return c.json({ success: false, error: 'phone query required' }, 400);
    }
    const refs = await kv.getByPrefix(`rental_customer_${pk}_`);
    const orders: any[] = [];
    for (const ref of refs || []) {
      const branchId = ref?.branchId;
      const orderId = ref?.orderId;
      if (!branchId || !orderId) continue;
      const order = await kv.get(`rental_order_${branchId}_${orderId}`);
      // Profil: barcha ijaralar (tarix + filtrlash frontendda); bekor qilinganlar chiqmasin
      if (!order || String(order.status || "").toLowerCase() === "cancelled") continue;
      const row = { ...order };
      if (!row.productImage && row.productId && row.branchId) {
        try {
          const prod = await kv.get(`rental_product_${row.branchId}_${row.productId}`);
          const img = prod?.image || prod?.coverImage;
          if (typeof img === "string" && img.trim()) row.productImage = img.trim();
        } catch (_) { /* ignore */ }
      }
      orders.push(enrichRentalOrderForClient(row));
    }
    orders.sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
    return c.json({ success: true, orders });
  } catch (error: any) {
    console.error('❌ Error getting my rentals:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/** Mijoz: telefon tasdiqlangan holda ijara tugash vaqtini uzaytirish */
app.post("/my-rentals/extend", async (c) => {
  try {
    const body = await c.req.json();
    const pk = normalizePhoneDigits(String(body.phone || ""));
    const branchId = String(body.branchId || "").trim();
    const orderId = String(body.orderId || body.id || "").trim();
    let units = Math.max(1, Math.floor(Number(body.units) || 1));

    if (pk.length < 9 || !branchId || !orderId) {
      return c.json({ success: false, error: "phone, branchId, orderId majburiy" }, 400);
    }

    const orderKey = `rental_order_${branchId}_${orderId}`;
    const raw = await kv.get(orderKey);
    if (!raw) {
      return c.json({ success: false, error: "Buyurtma topilmadi" }, 404);
    }

    const orderPhone = normalizePhoneDigits(String(raw.customerPhone || ""));
    if (orderPhone !== pk) {
      return c.json({ success: false, error: "Telefon mos kelmaydi" }, 403);
    }

    const st = String(raw.status || "").toLowerCase();
    if (st !== "active" && st !== "extended") {
      return c.json({ success: false, error: "Buyurtma aktiv emas" }, 400);
    }

    if (!raw.rentalPeriodStartedAt) {
      return c.json({ success: false, error: "Ijara muddati hali boshlanmagan" }, 400);
    }

    if (raw.deliveryPending === true) {
      return c.json({ success: false, error: "Avval kuryer yetkazishini kuting" }, 400);
    }

    const endMs = raw.rentalPeriodEndsAt
      ? new Date(raw.rentalPeriodEndsAt).getTime()
      : NaN;
    if (Number.isNaN(endMs)) {
      return c.json({ success: false, error: "Tugash vaqti aniqlanmagan" }, 400);
    }

    const cap = maxCustomerExtendUnits(String(raw.rentalPeriod || ""));
    units = Math.min(units, cap);

    const now = Date.now();
    const anchor = Math.max(now, endMs);
    const newEndIso = addRentalUnitsFromAnchor(anchor, String(raw.rentalPeriod || "daily"), units);

    const price = Number(raw.pricePerPeriod) || 0;
    const qty = Math.max(1, Number(raw.quantity) || 1);
    const addTotal = Math.round(price * qty * units);

    const order = { ...raw };
    order.rentalPeriodEndsAt = newEndIso;
    order.rentalDuration = (Number(order.rentalDuration) || 1) + units;
    order.extendedUntil = newEndIso;
    order.totalPrice = (Number(order.totalPrice) || 0) + addTotal;
    order.customerExtensionLog = [
      ...(Array.isArray(order.customerExtensionLog) ? order.customerExtensionLog : []),
      { at: new Date().toISOString(), units, addedAmount: addTotal },
    ];
    order.updatedAt = new Date().toISOString();

    await kv.set(orderKey, order);
    return c.json({ success: true, order: enrichRentalOrderForClient(order) });
  } catch (error: any) {
    console.error("❌ my-rentals/extend:", error);
    return c.json({ success: false, error: error.message || "Xatolik" }, 500);
  }
});

/** Mijoz: mahsulot yetkazilganini tasdiqlash — shu paytdan ijara muddati boshlanadi */
app.post("/my-rentals/confirm-received", async (c) => {
  try {
    const body = await c.req.json();
    const pk = normalizePhoneDigits(String(body.phone || ""));
    const branchId = String(body.branchId || "").trim();
    const orderId = String(body.orderId || body.id || "").trim();
    if (pk.length < 9 || !branchId || !orderId) {
      return c.json({ success: false, error: "phone, branchId, orderId majburiy" }, 400);
    }
    const orderKey = `rental_order_${branchId}_${orderId}`;
    const raw = await kv.get(orderKey);
    if (!raw) {
      return c.json({ success: false, error: "Buyurtma topilmadi" }, 404);
    }
    const orderPhone = normalizePhoneDigits(String(raw.customerPhone || ""));
    if (orderPhone !== pk) {
      return c.json({ success: false, error: "Telefon mos kelmaydi" }, 403);
    }
    if (String(raw.status || "").toLowerCase() !== "active") {
      return c.json({ success: false, error: "Buyurtma aktiv emas" }, 400);
    }
    if (!rentalBranchEffectivelyAccepted(raw)) {
      return c.json({ success: false, error: "Filial buyurtmani hali qabul qilmagan" }, 400);
    }
    if (!String(raw.deliveryCourierId || "").trim()) {
      return c.json({ success: false, error: "Kuryer hali tayinlanmagan" }, 400);
    }
    if (raw.rentalPeriodStartedAt) {
      return c.json({ success: false, error: "Yetkazish allaqachon tasdiqlangan" }, 400);
    }
    await finalizeRentalDeliveryToCustomer(raw, orderKey, orderId);
    const updated = await kv.get(orderKey);
    return c.json({ success: true, order: enrichRentalOrderForClient(updated || raw) });
  } catch (error: any) {
    console.error("❌ my-rentals/confirm-received:", error);
    return c.json({ success: false, error: error.message || "Xatolik" }, 500);
  }
});

/** Kuryer / avto-kuryer: ijara beruvchidan olib mijozga yetkazish (muddat hali boshlanmagan) */
app.get("/courier/rental-delivery-jobs", async (c) => {
  try {
    const auth = await resolveRentalDeliveryActorSession(c);
    if (!auth) {
      return c.json({ success: false, error: "Sessiya topilmadi" }, 401);
    }
    const prefix = `rental_courier_delivery_pending_${auth.courierId}_`;
    const refs = await kv.getByPrefix(prefix);
    const orders: any[] = [];
    const seenIds = new Set<string>();
    for (const ref of refs || []) {
      const bid = ref?.branchId;
      const oid = ref?.orderId;
      if (!bid || !oid) continue;
      const row = await kv.get(`rental_order_${bid}_${oid}`);
      if (
        row &&
        row.status === "active" &&
        !row.rentalPeriodStartedAt &&
        String(row.deliveryCourierId || "") === auth.courierId
      ) {
        await attachRentalProductImageIfNeeded(row);
        orders.push(enrichRentalOrderForClient(row));
        seenIds.add(String(row.id || oid));
      }
    }
    const scanBranch = String(auth.branchId || "").trim();
    if (scanBranch) {
      const allBranch = (await kv.getByPrefix(`rental_order_${scanBranch}_`)) || [];
      for (const row of allBranch) {
        if (!row || row.status !== "active" || row.rentalPeriodStartedAt) continue;
        if (String(row.deliveryCourierId || "") !== auth.courierId) continue;
        if (row.deliveryPending !== true) continue;
        const oid = String(row.id || "").trim();
        if (!oid || seenIds.has(oid)) continue;
        seenIds.add(oid);
        const copy = { ...row };
        await attachRentalProductImageIfNeeded(copy);
        orders.push(enrichRentalOrderForClient(copy));
      }
    }
    orders.sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
    return c.json({ success: true, orders });
  } catch (error: any) {
    console.error("❌ courier rental-delivery-jobs:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/** Kuryer yoki avto-kuryer: o‘zi yetkazgan faol ijaralar (qaytarib olish uchun) */
app.get('/courier/active-rentals', async (c) => {
  try {
    const auth = await resolveRentalDeliveryActorSession(c);
    if (!auth) {
      return c.json({ success: false, error: "Kuryer sessiyasi topilmadi" }, 401);
    }
    const refs = await kv.getByPrefix(`rental_courier_active_${auth.courierId}_`);
    const orders: any[] = [];
    const seenActive = new Set<string>();
    for (const ref of refs || []) {
      const branchId = ref?.branchId;
      const orderId = ref?.orderId;
      if (!branchId || !orderId) continue;
      const order = await kv.get(`rental_order_${branchId}_${orderId}`);
      if (order && order.status === "active") {
        const row = { ...order };
        await attachRentalProductImageIfNeeded(row);
        orders.push(enrichRentalOrderForClient(row));
        seenActive.add(String(row.id || orderId));
      }
    }
    const scanBranchActive = String(auth.branchId || "").trim();
    if (scanBranchActive) {
      const allBranch = (await kv.getByPrefix(`rental_order_${scanBranchActive}_`)) || [];
      for (const raw of allBranch) {
        if (!raw || raw.status !== "active" || !raw.rentalPeriodStartedAt) continue;
        if (String(raw.deliveryCourierId || "") !== auth.courierId) continue;
        const oid = String(raw.id || "").trim();
        if (!oid || seenActive.has(oid)) continue;
        seenActive.add(oid);
        const row = { ...raw };
        await attachRentalProductImageIfNeeded(row);
        orders.push(enrichRentalOrderForClient(row));
      }
    }
    orders.sort((a, b) =>
      String(a.rentalPeriodEndsAt || "").localeCompare(String(b.rentalPeriodEndsAt || ""))
    );
    return c.json({ success: true, orders });
  } catch (error: any) {
    console.error("❌ courier active-rentals:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create rental order
app.post('/orders', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Creating rental order:', body);

    if (!body.branchId || !body.productId) {
      return c.json({ success: false, error: 'branchId va productId majburiy' }, 400);
    }
    if (!body.customerName || !body.customerPhone) {
      return c.json({ success: false, error: 'Mijoz ismi va telefon majburiy' }, 400);
    }

    const prodKey = `rental_product_${body.branchId}_${body.productId}`;
    const productRow = await kv.get(prodKey);
    const weightKg = Math.max(
      0,
      Number(
        productRow?.weightKg ?? body.productWeightKg ?? body.weightKg ?? 0,
      ) || 0,
    );
    const branchAutoCourierOn = await readBranchAutoCourierRentalsEnabled(body.branchId);
    const requiresAutoCourier =
      branchAutoCourierOn &&
      (Boolean(productRow?.requiresAutoCourier) || weightKg > 10);
    const prepTelegramChatId = String(productRow?.telegramChatId || "").trim();

    const orderId = `${body.branchId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const qty = Math.max(1, Number(body.quantity) || 1);
    const contractStartDate =
      body.contractStartDate || new Date().toISOString();
    const rentalPeriod = body.rentalPeriod || 'daily';
    let paymentSchedule: 'upfront' | 'weekly' | 'monthly' = body.paymentSchedule || 'upfront';
    if (rentalPeriod === 'weekly' || rentalPeriod === 'monthly') {
      paymentSchedule = rentalPeriod === 'weekly' ? 'weekly' : 'monthly';
    } else {
      paymentSchedule = 'upfront';
    }
    const pricePerPeriod = Number(body.pricePerPeriod) || 0;
    const totalPrice = Number(body.totalPrice) || pricePerPeriod * qty * (Number(body.rentalDuration) || 1);

    const periodLabel =
      rentalPeriod === 'hourly'
        ? 'soat'
        : rentalPeriod === 'daily'
          ? 'kun'
          : rentalPeriod === 'weekly'
            ? 'hafta'
            : 'oy';
    const durationLabel = `${Number(body.rentalDuration) || 1} ${periodLabel}`;

    const deferPeriodicUntilDelivery =
      rentalPeriod === "weekly" || rentalPeriod === "monthly";
    const nextPaymentDue = deferPeriodicUntilDelivery
      ? null
      : computeInitialNextDue(contractStartDate, paymentSchedule);

    const addr = String(body.address || "").trim();
    const pickupAddr = String(
      body.pickupAddress ?? productRow?.pickupAddress ?? "",
    ).trim();
    const depositDesc = String(
      body.depositDescription ?? productRow?.deposit ?? "",
    ).trim();
    const depositAmt = Math.max(
      0,
      Math.round(
        Number(
          body.depositAmountUzs ??
            productRow?.depositAmountUzs ??
            productRow?.depositAmount ??
            0,
        ) || 0,
      ),
    );

    const order = {
      id: orderId,
      branchId: body.branchId,
      productId: body.productId,
      productName: body.productName || '',
      productImage: String(body.productImage || body.image || "").trim(),
      quantity: qty,
      customerName: String(body.customerName || ''),
      customerPhone: String(body.customerPhone || ''),
      customerEmail: String(body.customerEmail || ''),
      passportSeriesNumber: String(body.passportSeriesNumber || body.passportOrId || ''),
      /** Mijoz manzili (yetkazish) */
      deliveryAddress: String(body.deliveryAddress || addr).trim(),
      /** Ijara beruvchidan olish joyi */
      pickupAddress: pickupAddr,
      address: addr,
      notes: String(body.notes || body.additionalNotes || ''),
      rentalPeriod,
      rentalDuration: Number(body.rentalDuration) || 1,
      duration: durationLabel,
      pricePerPeriod,
      totalPrice,
      contractStartDate,
      paymentSchedule,
      nextPaymentDue,
      rentalPeriodStartedAt: null,
      rentalPeriodEndsAt: null,
      deliveryCourierId: null,
      deliveryConfirmedAt: null,
      pickupReminderSentAt: null,
      pickupCompletedAt: null,
      installmentsPaid: 0,
      paymentHistory: [] as Array<{ at: string; amount: number; label?: string }>,
      deliveryZoneSummary: body.deliveryZoneSummary || null,
      /** Ilova foydalanuvchisi bo‘lsa push eslatmalari uchun (ixtiyoriy) */
      customerUserId: body.customerUserId ? String(body.customerUserId).trim() : '',
      paymentMethod: String(body.paymentMethod || "cash").trim() || "cash",
      deliveryPrice: Math.max(0, Math.round(Number(body.deliveryPrice ?? body.deliveryFee ?? 0) || 0)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      /** Kuryer tasdiqlaguncha (confirmDelivery) */
      deliveryPending: true,
      prepTelegramChatId,
      productWeightKg: weightKg,
      requiresAutoCourier,
      assignedAutoCourierId: null,
      assignedAutoCourierAt: null,
      /** Filial «Qabul qilish» dan keyin Telegram va kuryer navbati ochiladi */
      branchAcceptedAt: null,
      /** Garov (matn + ixtiyoriy summa); kuryer rasmlarni `depositPhotoUrls` ga qo‘shadi */
      depositDescription: depositDesc,
      depositAmountUzs: depositAmt,
      depositPhotoUrls: [] as string[],
      depositPhotoUploadedAt: null as string | null,
    };

    await kv.set(`rental_order_${body.branchId}_${orderId}`, order);

    const pk = normalizePhoneDigits(order.customerPhone);
    if (pk) {
      await kv.set(`rental_customer_${pk}_${orderId}`, {
        branchId: body.branchId,
        orderId,
        productId: body.productId,
      });
    }

    // Update warehouse
    const warehouseKey = `rental_warehouse_${body.branchId}_${body.productId}`;
    const warehouse = await kv.get(warehouseKey);

    if (warehouse) {
      warehouse.available = Math.max(0, (warehouse.available || 0) - qty);
      warehouse.inRent = (warehouse.inRent || 0) + qty;
      warehouse.lastUpdated = new Date().toISOString();
      await kv.set(warehouseKey, warehouse);
    }

    await sendRentalNewOrderTelegrams(order, productRow, body.branchId);

    return c.json({ success: true, order: enrichRentalOrderForClient(order) });
  } catch (error: any) {
    console.error('❌ Error creating rental order:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update rental order status
app.put('/orders/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const branchIdParam = String(body.branchId || "").trim();
    if (!branchIdParam) {
      return c.json({ success: false, error: "branchId majburiy" }, 400);
    }

    const orderKey = `rental_order_${branchIdParam}_${id}`;
    const order = await kv.get(orderKey);

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const oldStatus = order.status;

    if (body.confirmPickupReturn === true) {
      const auth = await resolveRentalDeliveryActorSession(c);
      if (!auth) {
        return c.json({ success: false, error: "Kuryer sessiyasi topilmadi" }, 401);
      }
      if (String(order.deliveryCourierId || "") !== auth.courierId) {
        return c.json({ success: false, error: "Bu buyurtma sizga biriktirilmagan" }, 403);
      }
      if (order.status !== "active") {
        return c.json({ success: false, error: "Buyurtma aktiv emas" }, 400);
      }
      const bid = String(order.branchId || body.branchId);
      order.status = "returned";
      order.pickupCompletedAt = new Date().toISOString();
      order.returnDate = order.pickupCompletedAt;
      order.updatedAt = order.pickupCompletedAt;
      const { expectedUzs, isCashLike } = computeRentalCourierHandoffUzs(order);
      order.courierCashHandoffExpectedUzs = expectedUzs;
      order.courierCashHandoffStatus =
        isCashLike && expectedUzs > 0 ? "pending_cashier" : "not_applicable";
      order.courierCashHandedToCashierAt = null;
      await removeRentalCourierIndex(order);
      await kv.set(`rental_order_${bid}_${id}`, order);
      if (oldStatus === "active") {
        const warehouseKey = `rental_warehouse_${bid}_${order.productId}`;
        const warehouse = await kv.get(warehouseKey);
        if (warehouse) {
          warehouse.available += order.quantity;
          warehouse.inRent -= order.quantity;
          warehouse.lastUpdated = new Date().toISOString();
          await kv.set(warehouseKey, warehouse);
        }
      }
      return c.json({ success: true, order: enrichRentalOrderForClient(order) });
    }

    if (body.courierMarkDeliveredToCustomer === true) {
      const auth = await resolveRentalDeliveryActorSession(c);
      if (!auth) {
        return c.json({ success: false, error: "Sessiya topilmadi" }, 401);
      }
      if (order.status !== "active") {
        return c.json({ success: false, error: "Buyurtma aktiv emas" }, 400);
      }
      if (order.rentalPeriodStartedAt) {
        return c.json({ success: false, error: "Yetkazish allaqachon tasdiqlangan" }, 400);
      }
      if (String(order.deliveryCourierId || "") !== auth.courierId) {
        return c.json({ success: false, error: "Bu buyurtma sizga biriktirilmagan" }, 403);
      }
      if (!rentalBranchEffectivelyAccepted(order)) {
        return c.json({ success: false, error: "Filial buyurtmani hali qabul qilmagan" }, 400);
      }
      await finalizeRentalDeliveryToCustomer(order, orderKey, id);
      const updated = await kv.get(orderKey);
      return c.json({ success: true, order: enrichRentalOrderForClient(updated || order) });
    }

    if (body.courierUploadDepositPhoto === true) {
      const auth = await resolveRentalDeliveryActorSession(c);
      if (!auth) {
        return c.json({ success: false, error: "Sessiya topilmadi" }, 401);
      }
      if (String(order.deliveryCourierId || "") !== auth.courierId) {
        return c.json({ success: false, error: "Bu buyurtma sizga biriktirilmagan" }, 403);
      }
      if (order.status !== "active") {
        return c.json({ success: false, error: "Buyurtma aktiv emas" }, 400);
      }
      const dataUrl = String(body.depositPhotoDataUrl || "").trim();
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(dataUrl)) {
        return c.json(
          { success: false, error: "Rasm data:image (png/jpeg/webp) formatida yuborilishi kerak" },
          400,
        );
      }
      const urls = Array.isArray(order.depositPhotoUrls) ? [...order.depositPhotoUrls] : [];
      if (urls.length >= 8) {
        return c.json({ success: false, error: "Garov rasmlari limiti (8) to‘lgan" }, 400);
      }
      try {
        const publicUrl = await r2.uploadImage(
          dataUrl,
          `rental-deposit-${id}-${Date.now()}`,
        );
        urls.push(publicUrl);
        order.depositPhotoUrls = urls;
        order.depositPhotoUploadedAt = new Date().toISOString();
        order.updatedAt = order.depositPhotoUploadedAt;
        await kv.set(orderKey, order);
        return c.json({ success: true, order: enrichRentalOrderForClient(order) });
      } catch (e: any) {
        return c.json(
          { success: false, error: e?.message || "Rasm yuklanmadi" },
          500,
        );
      }
    }

    const panelDenied = await assertRentalBranchPanelAccess(c, branchIdParam);
    if (panelDenied) return panelDenied;

    if (body.acceptByBranch === true) {
      if (!Object.prototype.hasOwnProperty.call(order, "branchAcceptedAt")) {
        return c.json({ success: true, order: enrichRentalOrderForClient(order) });
      }
      if (order.branchAcceptedAt) {
        return c.json({ success: true, order: enrichRentalOrderForClient(order) });
      }
      const nowIso = new Date().toISOString();
      order.branchAcceptedAt = nowIso;
      order.updatedAt = nowIso;
      await kv.set(orderKey, order);
      const prodKey = `rental_product_${order.branchId}_${order.productId}`;
      const productRow = await kv.get(prodKey);
      await sendRentalOrderTelegrams(order, productRow, order.branchId);
      const fresh = await kv.get(orderKey);
      return c.json({ success: true, order: enrichRentalOrderForClient(fresh || order) });
    }

    if (body.assignDeliveryCourier === true || body.confirmDelivery === true) {
      if (order.rentalPeriodStartedAt) {
        return c.json({ success: false, error: "Ijara muddati allaqachon boshlangan" }, 400);
      }
      const courierId = String(body.deliveryCourierId || body.courierId || "").trim();
      if (!courierId) {
        return c.json({ success: false, error: "deliveryCourierId (kuryer) majburiy" }, 400);
      }
      const assignedAc = String(order.assignedAutoCourierId || "").trim();
      if (assignedAc && assignedAc !== courierId) {
        return c.json({
          success: false,
          error: "Bu buyurtma boshqa avto-kuryerga biriktirilgan",
        }, 400);
      }
      if (!rentalBranchEffectivelyAccepted(order)) {
        return c.json({ success: false, error: "Avval filial buyurtmani qabul qilishi kerak" }, 400);
      }
      const oid = String(order.id || id);
      const prev = String(order.deliveryCourierId || "").trim();
      if (prev && prev !== courierId) {
        try {
          await kv.del(rentalCourierDeliveryPendingKey(prev, oid));
        } catch (_) { /* ignore */ }
      }
      const nowIso = new Date().toISOString();
      order.deliveryCourierId = courierId;
      order.courierAssignedForDeliveryAt = nowIso;
      order.updatedAt = nowIso;
      await kv.set(rentalCourierDeliveryPendingKey(courierId, oid), {
        branchId: order.branchId,
        orderId: oid,
      });
      await kv.set(orderKey, order);
      return c.json({ success: true, order: enrichRentalOrderForClient(order) });
    }

    if (body.recordPayment === true) {
      const schedule = order.paymentSchedule;
      const amount =
        Number(body.paymentAmount) ||
        Number(order.pricePerPeriod) * (Number(order.quantity) || 1);
      order.paymentHistory = [
        ...(Array.isArray(order.paymentHistory) ? order.paymentHistory : []),
        {
          at: new Date().toISOString(),
          amount,
          label: body.paymentLabel || "To‘lov qabul qilindi",
        },
      ];
      order.installmentsPaid = (Number(order.installmentsPaid) || 0) + 1;
      if (schedule === "weekly" || schedule === "monthly") {
        const base =
          order.nextPaymentDue ||
          order.contractStartDate ||
          new Date().toISOString();
        order.nextPaymentDue = addPaymentInterval(base, schedule);
      }
      order.updatedAt = new Date().toISOString();
      await kv.set(orderKey, order);
      return c.json({ success: true, order: enrichRentalOrderForClient(order) });
    }

    if (body.status !== undefined && body.status !== null) {
      order.status = body.status;
    }
    order.updatedAt = new Date().toISOString();
    
    if (body.returnDate) order.returnDate = body.returnDate;
    if (body.extendedUntil) order.extendedUntil = body.extendedUntil;
    
    await kv.set(orderKey, order);
    
    // Update warehouse if status changed to returned or cancelled
    if ((body.status === 'returned' || body.status === 'cancelled') && oldStatus === 'active') {
      await removeRentalCourierIndex(order);
      const warehouseKey = `rental_warehouse_${body.branchId}_${order.productId}`;
      const warehouse = await kv.get(warehouseKey);
      
      if (warehouse) {
        warehouse.available += order.quantity;
        warehouse.inRent -= order.quantity;
        warehouse.lastUpdated = new Date().toISOString();
        await kv.set(warehouseKey, warehouse);
      }
    }
    
    return c.json({ success: true, order: enrichRentalOrderForClient(order) });
  } catch (error: any) {
    console.error('❌ Error updating rental order:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== APPLICATIONS ====================

// Get all rental applications
app.get('/applications/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const denied = await assertRentalBranchPanelAccess(c, branchId);
    if (denied) return denied;
    const applications = await kv.getByPrefix(`rental_application_${branchId}_`);
    
    return c.json({ success: true, applications: applications || [] });
  } catch (error: any) {
    console.error('❌ Error getting rental applications:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create rental application (from public)
app.post('/applications', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Creating rental application:', body);
    
    const applicationId = `${body.branchId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const application = {
      id: applicationId,
      ...body,
      createdAt: new Date().toISOString(),
      status: 'pending' // pending, approved, rejected
    };
    
    await kv.set(`rental_application_${body.branchId}_${applicationId}`, application);
    
    return c.json({ success: true, application });
  } catch (error: any) {
    console.error('❌ Error creating rental application:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update application status
app.put('/applications/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const appBranch = String(body.branchId || "").trim();
    const authDenied = await assertRentalApplicationWrite(c, appBranch);
    if (authDenied) return authDenied;

    const applicationKey = `rental_application_${body.branchId}_${id}`;
    const application = await kv.get(applicationKey);
    
    if (!application) {
      return c.json({ success: false, error: 'Application not found' }, 404);
    }
    
    application.status = body.status;
    application.updatedAt = new Date().toISOString();
    if (body.notes) application.notes = body.notes;
    
    await kv.set(applicationKey, application);
    
    return c.json({ success: true, application });
  } catch (error: any) {
    console.error('❌ Error updating rental application:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== STATISTICS ====================

// Get rental statistics for branch
app.get('/statistics/:branchId', async (c) => {
  try {
    const branchId = c.req.param('branchId');
    const denied = await assertRentalBranchPanelAccess(c, branchId);
    if (denied) return denied;
    
    const products = await kv.getByPrefix(`rental_product_${branchId}_`) || [];
    const orders = await kv.getByPrefix(`rental_order_${branchId}_`) || [];
    const applications = await kv.getByPrefix(`rental_application_${branchId}_`) || [];
    
    const activeOrders = orders.filter((o: any) => o.status === 'active');
    const completedOrders = orders.filter((o: any) => o.status === 'returned');
    const cancelledOrders = orders.filter((o: any) => o.status === 'cancelled');
    
    const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);

    const pctByProduct = new Map<string, number>();
    for (const p of products as any[]) {
      const id = String(p?.id || "").trim();
      if (!id) continue;
      const parsed = parseOptionalPlatformCommissionPercent(p.platformCommissionPercent);
      pctByProduct.set(id, parsed === null ? 0 : parsed);
    }
    let totalPlatformCommission = 0;
    for (const o of completedOrders) {
      const price = Math.max(0, Math.round(Number(o.totalPrice) || 0));
      const pct = pctByProduct.get(String(o.productId || "")) ?? 0;
      totalPlatformCommission += Math.round((price * pct) / 100);
    }
    const totalBranchRentalNet = Math.max(0, Math.round(totalRevenue - totalPlatformCommission));
    
    const pendingApplications = applications.filter((a: any) => a.status === 'pending');
    
    const statistics = {
      totalProducts: products.length,
      activeProducts: products.filter((p: any) => p.status === 'active').length,
      totalOrders: orders.length,
      activeRentals: activeOrders.length,
      completedRentals: completedOrders.length,
      cancelledRentals: cancelledOrders.length,
      totalRevenue,
      totalPlatformCommission,
      totalBranchRentalNet,
      pendingApplications: pendingApplications.length,
      totalApplications: applications.length
    };
    
    return c.json({ success: true, statistics });
  } catch (error: any) {
    console.error('❌ Error getting rental statistics:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==================== RATINGS ====================

// Submit rating for a product (requires completed rental order)
app.post('/rating', async (c) => {
  try {
    const body = await c.req.json();
    console.log('⭐ Submitting rating:', body);
    
    const { productId, orderId, rating, comment } = body;
    
    if (!productId || !orderId || !rating) {
      return c.json({ 
        success: false, 
        message: 'productId, orderId va rating majburiy' 
      }, 400);
    }
    
    if (rating < 1 || rating > 5) {
      return c.json({ 
        success: false, 
        message: 'Rating 1 dan 5 gacha bo\'lishi kerak' 
      }, 400);
    }
    
    // Check if order exists and is completed
    const orders = await kv.getByPrefix(`rental_order_`);
    const order = orders.find((o: any) => o.id === orderId);
    
    if (!order) {
      return c.json({ 
        success: false, 
        message: 'Buyurtma topilmadi' 
      }, 404);
    }
    
    if (order.status !== 'returned') {
      return c.json({ 
        success: false, 
        message: 'Faqat tugallangan ijaralarni baholash mumkin' 
      }, 400);
    }
    
    // Check if already rated
    const existingRating = await kv.get(`rental_rating_${orderId}`);
    if (existingRating) {
      return c.json({ 
        success: false, 
        message: 'Siz allaqachon baholagansiz' 
      }, 400);
    }
    
    // Create rating
    const ratingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ratingData = {
      id: ratingId,
      productId,
      orderId,
      rating,
      comment: comment || '',
      createdAt: new Date().toISOString(),
      customerName: order.customerName || 'Anonim',
      customerPhone: order.customerPhone || ''
    };
    
    await kv.set(`rental_rating_${orderId}`, ratingData);
    
    // Update product rating
    await updateProductRating(productId);
    
    console.log('✅ Rating submitted successfully:', ratingId);
    return c.json({ success: true, rating: ratingData });
  } catch (error: any) {
    console.error('❌ Error submitting rating:', error);
    return c.json({ 
      success: false, 
      message: 'Reytingni yuborishda xatolik: ' + error.message 
    }, 500);
  }
});

// Get ratings for a product
app.get('/ratings/:productId', async (c) => {
  try {
    const productId = c.req.param('productId');
    
    const allRatings = await kv.getByPrefix(`rental_rating_`);
    const productRatings = allRatings.filter((r: any) => r.productId === productId);
    
    return c.json({ 
      success: true, 
      ratings: productRatings || [] 
    });
  } catch (error: any) {
    console.error('❌ Error getting ratings:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Helper function to update product rating
async function updateProductRating(productId: string) {
  try {
    // Get all ratings for this product
    const allRatings = await kv.getByPrefix(`rental_rating_`);
    const productRatings = allRatings.filter((r: any) => r.productId === productId);
    
    if (productRatings.length === 0) return;
    
    // Calculate average
    const totalRating = productRatings.reduce((sum: number, r: any) => sum + r.rating, 0);
    const averageRating = totalRating / productRatings.length;
    
    // Find and update the product
    const allProducts = await kv.getByPrefix(`rental_product_`);
    const product = allProducts.find((p: any) => p.id === productId);
    
    if (product) {
      product.rating = parseFloat(averageRating.toFixed(1));
      product.reviewCount = productRatings.length;
      
      // Find the correct key
      const productKeys = await kv.getByPrefix(`rental_product_`);
      for (const p of productKeys) {
        if (p.id === productId) {
          // Extract branchId from the existing product
          const branchId = p.branchId;
          await kv.set(`rental_product_${branchId}_${productId}`, product);
          console.log(`✅ Updated product rating: ${productId} -> ${averageRating.toFixed(1)} (${productRatings.length} reviews)`);
          break;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error updating product rating:', error);
  }
}

export default app;