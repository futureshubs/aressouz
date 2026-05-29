/**
 * Buyurtma bekor qilinishi — taom (1 kun / ish boshlanishigacha) va do‘kon (qo‘lda ombor).
 */
import * as kv from "./kv_store.tsx";
import * as businessHours from "./businessHours.ts";
import { timeZoneFromMerchantRecord } from "./merchantRegionTimeZone.ts";

const COOLDOWN_PREFIX = "branch_line_cooldown_v1:";

export function computeDishStopUntilIso(
  merchant: Record<string, unknown> | null | undefined,
  ref = new Date(),
): string {
  const strings = businessHours.collectHourStringsFromRecord(merchant);
  const tz = timeZoneFromMerchantRecord(merchant);
  const range = businessHours.firstParseableRange(strings);
  if (!range || range.startMin === range.endMin) {
    return new Date(ref.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
  const ev = businessHours.evaluateHourStrings(strings, ref, tz);
  const { h, m, s } = businessHours.getWallClockHMS(tz, ref);
  const nowSec = h * 3600 + m * 60 + s;
  if (ev.allowed) {
    const startSec = range.startMin * 60;
    const waitUntilTomorrowOpen = 86400 - nowSec + startSec;
    return new Date(ref.getTime() + waitUntilTomorrowOpen * 1000).toISOString();
  }
  const wait = businessHours.secondsUntilOpenAfterClose(range, nowSec);
  return new Date(ref.getTime() + Math.max(wait, 60) * 1000).toISOString();
}

export async function isLineOnCooldown(
  branchId: string,
  orderType: string,
  lineKey: string,
): Promise<boolean> {
  const bid = String(branchId || "").trim();
  const key = String(lineKey || "").trim();
  if (!bid || !key) return false;
  const ot = String(orderType || "food").toLowerCase().trim();
  const safeKey = key.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 200);
  const row = await kv.get(`${COOLDOWN_PREFIX}${bid}:${ot}:${safeKey}`);
  if (!row?.until) return false;
  return new Date(String(row.until)).getTime() > Date.now();
}

async function writeLineCooldown(
  branchId: string,
  orderType: string,
  lineKey: string,
  untilIso: string,
  sourceOrderId: string,
) {
  const bid = String(branchId || "").trim();
  const key = String(lineKey || "").trim();
  if (!bid || !key) return;
  const ot = String(orderType || "food").toLowerCase().trim();
  const safeKey = key.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 200);
  await kv.set(`${COOLDOWN_PREFIX}${bid}:${ot}:${safeKey}`, {
    until: untilIso,
    createdAt: new Date().toISOString(),
    sourceOrderId: String(sourceOrderId || ""),
  });
}

function foodLineKeyAliases(dishId: string): string[] {
  const raw = String(dishId || "").trim();
  if (!raw) return [];
  const set = new Set<string>();
  set.add(raw);
  if (!raw.startsWith("dish:")) set.add(`dish:${raw}`);
  const bare = raw.replace(/^dish:/, "").trim();
  if (bare) set.add(bare);
  return [...set];
}

/** Filial cooldown (bekor qilish) — qo‘lda «Qayta yoqish» yoki muddat tugaganda tozalanadi. */
export async function clearFoodLineCooldowns(branchId: string, dishId: string): Promise<void> {
  const bid = String(branchId || "").trim();
  if (!bid || !dishId) return;
  for (const alias of foodLineKeyAliases(dishId)) {
    const safeKey = alias.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 200);
    await kv.del(`${COOLDOWN_PREFIX}${bid}:food:${safeKey}`);
  }
}

async function resolveBranchIdForDish(dish: Record<string, unknown>): Promise<string> {
  const direct = String(dish?.branchId || "").trim();
  if (direct) return direct;
  const rid = String(dish?.restaurantId || "").trim();
  if (!rid) return "";
  const rKey = rid.startsWith("restaurant:") ? rid : `restaurant:${rid}`;
  const restaurant = await kv.get(rKey);
  return String(restaurant?.branchId || "").trim();
}

/** Taomni to‘liq sotuvga qaytarish — STOP belgilari + filial cooldown. */
export async function resumeDishSaleFully(
  dish: Record<string, unknown>,
  dishKvKey?: string,
): Promise<Record<string, unknown>> {
  const key = String(dishKvKey || dish?.id || "").trim();
  const nowIso = new Date().toISOString();
  const updated: Record<string, unknown> = {
    ...dish,
    isActive: true,
    autoResumeAt: null,
    stopReason: null,
    stopLabel: null,
    cancelSourceOrderId: null,
    updatedAt: nowIso,
  };
  if (key) await kv.set(key, updated);
  const bid = await resolveBranchIdForDish(dish);
  if (bid) {
    await clearFoodLineCooldowns(bid, String(dish.id || key));
  }
  return updated;
}

function dishKeysFromLine(line: Record<string, unknown>): string[] {
  const details = line.dishDetails as Record<string, unknown> | undefined;
  const idLike = String(line.id ?? "").trim();
  const ids = [
    line.dishId,
    details?.dishId,
    idLike.startsWith("dish:") ? idLike : "",
    line.productId,
  ]
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length >= 2);
  return [...new Set(ids)];
}

async function resolveDishRecord(dishId: string): Promise<{ key: string; dish: any } | null> {
  const raw = String(dishId || "").trim();
  if (!raw) return null;
  const candidates = raw.startsWith("dish:") ? [raw] : [`dish:${raw}`, raw];
  for (const key of candidates) {
    const dish = await kv.get(key);
    if (dish && typeof dish === "object") return { key, dish };
  }
  const bySuffix = await kv.getByPrefix(`dish:`);
  for (const d of bySuffix) {
    if (String(d?.id || "") === raw || String(d?.id || "").endsWith(`:${raw}`)) {
      return { key: String(d.id), dish: d };
    }
  }
  return null;
}

/** Taom paneli bekor qilganda — taom STOP, ertaga ish boshlanishigacha (yoki yopiq bo‘lsa keyingi ochilish). */
export async function applyRestaurantCancelDishStop(
  order: any,
  restaurant?: Record<string, unknown> | null,
): Promise<{ stoppedDishIds: string[]; untilIso: string }> {
  const stoppedDishIds: string[] = [];
  const untilIso = computeDishStopUntilIso(restaurant || null);
  const bid = String(order?.branchId || "").trim();
  const items = Array.isArray(order?.items) ? order.items : [];
  const nowIso = new Date().toISOString();

  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const line = it as Record<string, unknown>;
    for (const dishId of dishKeysFromLine(line)) {
      const resolved = await resolveDishRecord(dishId);
      if (!resolved) continue;
      const updated = {
        ...resolved.dish,
        isActive: false,
        autoResumeAt: untilIso,
        stopReason: "order_cancel",
        stopLabel: "Tugadi",
        cancelSourceOrderId: String(order?.id || order?.orderId || ""),
        updatedAt: nowIso,
      };
      await kv.set(resolved.key, updated);
      stoppedDishIds.push(String(resolved.dish.id || dishId));
      if (bid) {
        await writeLineCooldown(bid, "food", dishId, untilIso, String(order?.id || ""));
      }
    }
  }
  return { stoppedDishIds: [...new Set(stoppedDishIds)], untilIso };
}

/** Ro‘yxatda vaqt o‘tgan STOP taomlarni qayta yoqish; faol bo‘lib qolgan «Tugadi» qoldiqlarini ham tozalaydi. */
export async function resumeExpiredDishStops(dishes: any[]): Promise<any[]> {
  const now = Date.now();
  const out: any[] = [];
  for (const d of dishes) {
    if (!d || typeof d !== "object") {
      out.push(d);
      continue;
    }
    const key = String(d.id || "");
    const resumeAt = String(d.autoResumeAt || "").trim();
    const inactive = d.isActive === false;
    const hasCancelStop =
      resumeAt ||
      String(d.stopReason || "").trim() === "order_cancel" ||
      String(d.cancelSourceOrderId || "").trim();

    if (!inactive && hasCancelStop) {
      out.push(await resumeDishSaleFully(d as Record<string, unknown>, key));
      continue;
    }

    if (inactive && resumeAt) {
      const t = new Date(resumeAt).getTime();
      if (Number.isFinite(t) && t <= now) {
        out.push(await resumeDishSaleFully(d as Record<string, unknown>, key));
        continue;
      }
    }
    out.push(d);
  }
  return out;
}

/** `index.ts` bilan bir xil — checkout `id: shop_product-...` formatini taniydi. */
function shopProductLinePid(line: any): string {
  return String(line?.id ?? line?.productId ?? line?.shopProductId ?? "").trim();
}

function isShopProductCartLine(line: any): boolean {
  if (String(line?.source || "").toLowerCase().trim() === "shop") return true;
  const pid = shopProductLinePid(line);
  if (!pid) return false;
  if (pid.startsWith("shop_product:")) return true;
  return pid.startsWith("shop_product-");
}

function isShopOrderLine(line: any, order: any): boolean {
  if (isShopProductCartLine(line)) return true;
  const ot = String(order?.orderType || order?.type || "").toLowerCase().trim();
  if (ot !== "shop") return false;
  return Boolean(String(order?.shopId || "").trim() && shopProductLinePid(line));
}

function orderLineVariantKey(line: any): string {
  const vidRaw = line?.selectedVariantId ?? line?.variantId ?? line?.variant_id;
  return vidRaw != null && String(vidRaw).trim() !== ""
    ? String(vidRaw).trim()
    : "__first__";
}

function resolveShopProductVariantForOrder(product: any, variantKey: string): any | null {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const vk = String(variantKey || "").trim();
  if (!vk || vk === "__first__") return variants[0] || null;
  const byId = variants.find((v: any) => String(v?.id) === vk);
  if (byId) return byId;
  const idx = Number(vk);
  if (Number.isInteger(idx) && idx >= 0 && idx < variants.length) return variants[idx] || null;
  return variants[0] || null;
}

/** Turli id formatlarida `shop_product:*` KV kalitini topish. */
async function resolveShopProductKeyFromLine(line: any): Promise<string | null> {
  const raw = shopProductLinePid(line);
  if (!raw) return null;
  const keysToTry = new Set<string>();
  keysToTry.add(raw.startsWith("shop_product:") ? raw : `shop_product:${raw}`);
  if (!raw.startsWith("shop_product:") && raw.includes("shop_product-")) {
    keysToTry.add(`shop_product:${raw}`);
  }
  const rawBare = raw.replace(/^shop_product:/, "").trim();
  if (rawBare) keysToTry.add(`shop_product:${rawBare}`);

  for (const key of keysToTry) {
    if (key.replace("shop_product:", "").length < 2) continue;
    const product = await kv.get(key);
    if (product && !product.deleted) return key;
  }

  /** Checkout / eski buyurtmalar: id formati farq qilsa — `product.id` bo‘yicha qidiruv */
  try {
    const all = await kv.getByPrefix("shop_product:");
    for (const p of all) {
      if (!p || p.deleted) continue;
      const pid = String(p.id || "").trim();
      if (!pid) continue;
      if (
        pid === raw ||
        pid === rawBare ||
        `shop_product:${pid}` === raw ||
        raw === pid ||
        rawBare === pid
      ) {
        return pid.startsWith("shop_product:") ? pid : `shop_product:${pid}`;
      }
    }
  } catch {
    /* ignore scan errors */
  }
  return null;
}

function markVariantOutOfStock(variant: any, order: any) {
  variant.stock = 0;
  variant.stockQuantity = 0;
  variant.stockCount = 0;
  variant.outOfStockUntilRestock = true;
  variant.outOfStockReason = "order_cancelled";
  variant.outOfStockOrderId = String(order.id || order.orderId || "");
}

/**
 * Do‘kon (/seller) bekor — ombor qaytarilmaydi; 0 qoldiriladi, qo‘lda to‘ldirilguncha sotilmaydi.
 */
export async function markSellerProductsOutOfStockUntilRestock(order: any): Promise<number> {
  if (!order) return 0;
  /** Idempotent: ombor allaqachon 0 qilingan (inventoryMarkedOutOnCancel — faqat siyosat belgisi, blok emas). */
  if (order.sellerStockZeroedOnCancel === true) return 0;

  const items = Array.isArray(order.items) ? order.items : [];
  let touched = 0;
  const nowIso = new Date().toISOString();

  for (const line of items) {
    if (!line || typeof line !== "object") continue;
    if (!isShopOrderLine(line, order)) continue;

    const productKey = await resolveShopProductKeyFromLine(line);
    if (!productKey) {
      console.warn(
        "[seller cancel stock] mahsulot topilmadi:",
        shopProductLinePid(line),
        "order=",
        String(order.id || ""),
      );
      continue;
    }

    const product = await kv.get(productKey);
    if (!product || product.deleted) continue;

    const vk = orderLineVariantKey(line);
    const variants = Array.isArray(product.variants) ? [...product.variants] : [];

    if (variants.length > 0) {
      let idx = -1;
      if (vk && vk !== "__first__") {
        idx = variants.findIndex((v: any) => String(v?.id) === vk);
        if (idx < 0) {
          const n = Number(vk);
          if (Number.isInteger(n) && n >= 0 && n < variants.length) idx = n;
        }
      }
      if (idx < 0 && line?.variantName) {
        const vn = String(line.variantName).trim().toLowerCase();
        idx = variants.findIndex(
          (v: any) => String(v?.name || "").trim().toLowerCase() === vn,
        );
      }
      if (idx < 0 && variants.length === 1) idx = 0;
      if (idx < 0) {
        const resolved = resolveShopProductVariantForOrder({ variants }, vk);
        if (resolved) {
          idx = variants.findIndex(
            (v: any) => String(v?.id) === String(resolved?.id),
          );
        }
      }
      if (idx < 0) {
        console.warn(
          "[seller cancel stock] variant topilmadi:",
          vk,
          "product=",
          productKey,
        );
        continue;
      }
      markVariantOutOfStock(variants[idx], order);
      product.variants = variants;
    } else {
      product.stock = 0;
      product.stockQuantity = 0;
      product.stockCount = 0;
      product.outOfStockUntilRestock = true;
      product.outOfStockReason = "order_cancelled";
      product.outOfStockOrderId = String(order.id || order.orderId || "");
    }

    product.updatedAt = nowIso;
    product.hasOutOfStockVariants = Array.isArray(product.variants)
      ? product.variants.some((v: any) => Boolean(v?.outOfStockUntilRestock))
      : Boolean(product.outOfStockUntilRestock);
    await kv.set(productKey, product);
    touched += 1;
  }

  return touched;
}

/** Sotuvchi omborga qo‘shganda — «tugagan» belgisini olib tashlash. */
export function clearOutOfStockFlagsOnRestock(product: any): any {
  if (!product || typeof product !== "object") return product;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  let anyOut = false;
  const nextVariants = variants.map((v: any) => {
    const stock = Math.max(0, Math.floor(Number(v?.stock ?? v?.stockQuantity ?? 0)));
    if (stock > 0 && v?.outOfStockUntilRestock) {
      const { outOfStockUntilRestock, outOfStockReason, outOfStockOrderId, ...rest } = v;
      return { ...rest, stock, stockQuantity: stock };
    }
    if (v?.outOfStockUntilRestock) anyOut = true;
    return v;
  });
  return {
    ...product,
    variants: nextVariants,
    hasOutOfStockVariants: nextVariants.some((v: any) => Boolean(v?.outOfStockUntilRestock)),
  };
}

/** Filial / tizim bekor — taom: ish vaqtigacha stop; boshqa: 24s KV cooldown. */
export async function applyOrderCancelOneDayLineCooldown(order: any) {
  try {
    const ot = String(order?.orderType || order?.type || "").toLowerCase();
    const isFoodish = ot === "food" || ot === "restaurant";
    if (isFoodish) {
      let restaurant: Record<string, unknown> | null = null;
      const rid = String(order?.restaurantId || "").trim();
      if (rid) {
        const key = rid.startsWith("restaurant:") ? rid : `restaurant:${rid}`;
        const rec = await kv.get(key);
        if (rec && typeof rec === "object") restaurant = rec as Record<string, unknown>;
      }
      await applyRestaurantCancelDishStop(order, restaurant);
      return;
    }
    const bid = String(order?.branchId || "").trim();
    if (!bid || !Array.isArray(order?.items)) return;
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (const it of order.items) {
      if (!it || typeof it !== "object") continue;
      const line = it as Record<string, unknown>;
      let lineKey = "";
      if (ot === "market") {
        lineKey = String(line.productUuid || line.productId || line.id || "").trim();
      } else if (ot === "shop") {
        lineKey = String(line.id || line.productId || line.shopProductId || "").trim();
      }
      if (!lineKey) continue;
      await writeLineCooldown(bid, ot || "x", lineKey, until, String(order.id || ""));
    }
  } catch (e) {
    console.warn("[cooldown] applyOrderCancelOneDayLineCooldown:", e);
  }
}
