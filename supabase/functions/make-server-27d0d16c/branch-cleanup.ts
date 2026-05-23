import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as r2 from "./r2-storage.tsx";
import { normalizeBranchId } from "./services/payments-logic.ts";
import {
  normalizeRentalProviderLogin,
  rentalProviderLoginLookupKey,
  rentalProviderSessionPrefix,
} from "./rental_provider_kv.ts";
import { createCourierBagStore } from "./courier-bags-db.ts";

export const BRANCH_CLEANUP_TARGET_IDS = [
  "market-orders",
  "shop-orders",
  "food-orders",
  "rental-orders",
  "market",
  "shop",
  "foods",
  "rentals",
  "rental-providers",
  "auction",
  "banner",
  "services",
  "nearby",
  "house",
  "car",
  "bank",
  "couriers",
  "auto-couriers",
  "courier-bags",
  "pickup-racks",
  "preparers",
  "delivery-zones",
  "chat",
  "payments",
  "refunds",
  "employees",
  "reports",
  "all",
] as const;

export type BranchCleanupTargetId = (typeof BRANCH_CLEANUP_TARGET_IDS)[number];

const TARGET_SET = new Set<string>(BRANCH_CLEANUP_TARGET_IDS);

export function isValidCleanupTarget(id: string): id is BranchCleanupTargetId {
  return TARGET_SET.has(id);
}

function kvBranchMatches(recordBranchId: unknown, branchId: string): boolean {
  const t = normalizeBranchId(branchId);
  if (!t) return false;
  return normalizeBranchId(recordBranchId) === t;
}

function orderTypeOf(o: any): string {
  return String(o?.orderType || o?.type || "").toLowerCase().trim();
}

function isFoodOrder(o: any): boolean {
  const ot = orderTypeOf(o);
  if (ot === "food" || ot === "restaurant") return true;
  const items = Array.isArray(o?.items) ? o.items : [];
  return items.some((it: any) =>
    Boolean(
      it?.restaurantId ||
        it?.dishDetails ||
        it?.dishId ||
        it?.catalogId === "foods" ||
        it?.categoryId === "taomlar",
    )
  );
}

function isShopOrder(o: any): boolean {
  return orderTypeOf(o) === "shop";
}

function isMarketOrder(o: any, kvKey?: string): boolean {
  const ot = orderTypeOf(o);
  if (ot === "market") return true;
  if (kvKey && String(kvKey).startsWith("order:market:")) return true;
  return false;
}

async function purgeAllManagedR2UrlsInRecord(obj: unknown) {
  const urls = new Set<string>();
  const walk = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string" && /^https?:\/\//i.test(v)) urls.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") Object.values(v as object).forEach(walk);
  };
  walk(obj);
  for (const url of urls) await r2.deleteManagedR2UrlIfKnown(url);
}

type BumpFn = (key: string, n?: number) => void;

type CleanupCtx = {
  bid: string;
  branch: Record<string, unknown> | null;
  bump: BumpFn;
  supabase: SupabaseClient;
};

async function getBranchShopIds(bid: string): Promise<string[]> {
  const allShops = await kv.getByPrefix("shop:");
  return allShops
    .filter((s: any) => s && kvBranchMatches(s.branchId, bid))
    .map((s: any) => String(s.id || "").trim())
    .filter(Boolean);
}

async function deleteBranchOrdersWhere(
  ctx: CleanupCtx,
  predicate: (order: any, kvKey: string) => boolean,
) {
  const rows = await kv.getByPrefixWithKeys("order:");
  for (const { key, value: o } of rows) {
    if (!o || !kvBranchMatches(o.branchId, ctx.bid)) continue;
    if (!predicate(o, key)) continue;
    await purgeAllManagedR2UrlsInRecord(o);
    await kv.del(key);
    ctx.bump("orders");
    const oid = String(o.id || "").trim();
    if (oid) {
      try {
        await kv.del(`payment_order:${oid}`);
        ctx.bump("paymentRefs");
      } catch {
        /* ignore */
      }
    }
  }
}

async function cleanupMarketOrders(ctx: CleanupCtx) {
  await deleteBranchOrdersWhere(ctx, (o, key) => isMarketOrder(o, key));
}

async function cleanupShopOrders(ctx: CleanupCtx) {
  const shopIds = new Set(await getBranchShopIds(ctx.bid));
  await deleteBranchOrdersWhere(ctx, (o) => isShopOrder(o));

  const shopOrderRows = await kv.getByPrefixWithKeys("shop_order:");
  for (const { key, value: o } of shopOrderRows) {
    if (!o) continue;
    const sid = String(o.shopId || "").trim();
    if (!shopIds.has(sid) && !kvBranchMatches(o.branchId, ctx.bid)) continue;
    await purgeAllManagedR2UrlsInRecord(o);
    await kv.del(key);
    ctx.bump("shopOrders");
  }
}

async function cleanupFoodOrders(ctx: CleanupCtx) {
  await deleteBranchOrdersWhere(ctx, (o) => isFoodOrder(o));
}

function rentalPhoneDigitsForCustomerIndex(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 9) return `998${d}`;
  if (d.startsWith("998")) return d;
  return d;
}

async function cleanupRentalOrders(ctx: CleanupCtx) {
  const prefix = `rental_order_${ctx.bid}_`;
  const rows = await kv.getByPrefixWithKeys(prefix);
  for (const { key, value: o } of rows) {
    const oid = String(o?.id || "").trim();
    if (oid) {
      try {
        await kv.del(`rental_rating_${oid}`);
        ctx.bump("rentalRatings");
      } catch {
        /* ignore */
      }
      const pk = rentalPhoneDigitsForCustomerIndex(String(o?.customerPhone || ""));
      if (pk) {
        try {
          await kv.del(`rental_customer_${pk}_${oid}`);
          ctx.bump("rentalCustomerRefs");
        } catch {
          /* ignore */
        }
      }
      const cid = String(o?.deliveryCourierId || "").trim();
      if (cid) {
        try {
          await kv.del(`rental_courier_active_${cid}_${oid}`);
          ctx.bump("rentalCourierActive");
        } catch {
          /* ignore */
        }
      }
    }
    await purgeAllManagedR2UrlsInRecord(o);
    await kv.del(key);
    ctx.bump("rentalOrders");
  }
}

async function cleanupMarketProducts(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("branchproduct:");
  for (const { key, value: p } of rows) {
    if (!p || !kvBranchMatches(p.branchId, ctx.bid)) continue;
    await purgeAllManagedR2UrlsInRecord(p);
    await kv.del(key);
    ctx.bump("marketProducts");
  }

  const saleRows = await kv.getByPrefixWithKeys("sale:");
  for (const { key, value: s } of saleRows) {
    if (s && kvBranchMatches(s.branchId, ctx.bid)) {
      await kv.del(key);
      ctx.bump("sales");
    }
  }

  const invRows = await kv.getByPrefixWithKeys("inventory_history:");
  for (const { key, value: h } of invRows) {
    if (h && kvBranchMatches(h.branchId, ctx.bid)) {
      await kv.del(key);
      ctx.bump("inventoryHistory");
    }
  }
}

async function cleanupShopData(ctx: CleanupCtx) {
  const shopIds = await getBranchShopIds(ctx.bid);

  for (const shopId of shopIds) {
    const productRows = await kv.getByPrefixWithKeys("shop_product:");
    for (const { key, value: p } of productRows) {
      if (!p || String(p.shopId || "") !== shopId) continue;
      await purgeAllManagedR2UrlsInRecord(p);
      await kv.del(key);
      ctx.bump("shopProducts");
    }

    const orderRows = await kv.getByPrefixWithKeys("shop_order:");
    for (const { key, value: o } of orderRows) {
      if (!o || String(o.shopId || "") !== shopId) continue;
      await purgeAllManagedR2UrlsInRecord(o);
      await kv.del(key);
      ctx.bump("shopOrders");
    }

    const shop = await kv.get(`shop:${shopId}`);
    if (shop) {
      await purgeAllManagedR2UrlsInRecord(shop);
      await kv.del(`shop:${shopId}`);
      ctx.bump("shops");
    }
  }
}

async function cleanupFoods(ctx: CleanupCtx) {
  const restRows = await kv.getByPrefixWithKeys("restaurant:");
  for (const { key, value: r } of restRows) {
    if (!r || !kvBranchMatches(r.branchId, ctx.bid)) continue;
    const rid = String(r.id || "").trim();
    if (rid) {
      const dishRows = await kv.getByPrefixWithKeys(`dish:${rid}:`);
      for (const dr of dishRows) {
        await purgeAllManagedR2UrlsInRecord(dr.value);
        await kv.del(dr.key);
        ctx.bump("restaurantDishes");
      }
    }
    await purgeAllManagedR2UrlsInRecord(r);
    await kv.del(key);
    ctx.bump("restaurants");
  }
}

async function cleanupRentals(ctx: CleanupCtx) {
  const prefixes = [
    `rental_product_${ctx.bid}_`,
    `rental_warehouse_${ctx.bid}_`,
    `rental_application_${ctx.bid}_`,
  ];
  for (const prefix of prefixes) {
    const rows = await kv.getByPrefixWithKeys(prefix);
    for (const { key, value: row } of rows) {
      await purgeAllManagedR2UrlsInRecord(row);
      await kv.del(key);
      if (prefix.includes("product")) ctx.bump("rentalProducts");
      else if (prefix.includes("warehouse")) ctx.bump("rentalWarehouse");
      else ctx.bump("rentalApplications");
    }
  }
}

async function cleanupRentalProviders(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys(`rental_provider_${ctx.bid}_`);
  for (const { key, value: pr } of rows) {
    const loginNorm = normalizeRentalProviderLogin(String(pr?.login || ""));
    if (loginNorm) {
      try {
        await kv.del(rentalProviderLoginLookupKey(loginNorm));
      } catch {
        /* ignore */
      }
    }
    await kv.del(key);
    ctx.bump("rentalProviders");
  }

  const sessRows = await kv.getByPrefixWithKeys(rentalProviderSessionPrefix);
  for (const { key, value: rs } of sessRows) {
    if (rs && kvBranchMatches(rs.branchId, ctx.bid)) {
      await kv.del(key);
      ctx.bump("rentalProviderSessions");
    }
  }
}

async function cleanupAuction(ctx: CleanupCtx) {
  const aucRows = await kv.getByPrefixWithKeys("auction:");
  for (const { key, value: a } of aucRows) {
    if (!a || !kvBranchMatches(a.branchId, ctx.bid)) continue;
    const aid = String(a.id || a.auctionId || "").trim();
    if (aid) {
      const bids = await kv.getByPrefixWithKeys(`auction_bid:${aid}:`);
      for (const b of bids) {
        await kv.del(b.key);
        ctx.bump("auctionBids");
      }
      const parts = await kv.getByPrefixWithKeys(`auction_participant:${aid}:`);
      for (const p of parts) {
        await kv.del(p.key);
        ctx.bump("auctionParticipants");
      }
    }
    await purgeAllManagedR2UrlsInRecord(a);
    await kv.del(key);
    ctx.bump("auctions");
  }

  const reqRows = await kv.getByPrefixWithKeys("auction_request:");
  for (const { key, value: req } of reqRows) {
    if (req && kvBranchMatches(req.branchId, ctx.bid)) {
      await kv.del(key);
      ctx.bump("auctionRequests");
    }
  }
}

async function cleanupBanner(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("banner:");
  for (const { key, value: bn } of rows) {
    if (bn && kvBranchMatches(bn.branchId, ctx.bid)) {
      await purgeAllManagedR2UrlsInRecord(bn);
      await kv.del(key);
      ctx.bump("banners");
    }
  }
}

async function cleanupServices(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("portfolio:");
  for (const { key, value: p } of rows) {
    if (!p || !kvBranchMatches(p.branchId, ctx.bid)) continue;
    const pid = String(p.id || "").trim();
    if (pid) {
      const projects = await kv.getByPrefixWithKeys(`project:${pid}:`);
      for (const pr of projects) {
        await purgeAllManagedR2UrlsInRecord(pr.value);
        await kv.del(pr.key);
        ctx.bump("portfolioProjects");
      }
    }
    await purgeAllManagedR2UrlsInRecord(p);
    await kv.del(key);
    ctx.bump("portfolios");
  }
}

async function cleanupNearby(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("place:");
  for (const { key, value: p } of rows) {
    if (p && kvBranchMatches(p.branchId, ctx.bid)) {
      await purgeAllManagedR2UrlsInRecord(p);
      await kv.del(key);
      ctx.bump("places");
    }
  }
}

async function cleanupHouse(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("property:");
  for (const { key, value: p } of rows) {
    if (p && kvBranchMatches(p.branchId, ctx.bid)) {
      await purgeAllManagedR2UrlsInRecord(p);
      await kv.del(key);
      ctx.bump("properties");
    }
  }
}

async function cleanupCar(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("vehicle:");
  for (const { key, value: v } of rows) {
    if (v && kvBranchMatches(v.branchId, ctx.bid)) {
      await purgeAllManagedR2UrlsInRecord(v);
      await kv.del(key);
      ctx.bump("vehicles");
    }
  }
}

async function cleanupBank(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("bank:");
  for (const { key, value: b } of rows) {
    if (b && kvBranchMatches(b.branchId, ctx.bid)) {
      await purgeAllManagedR2UrlsInRecord(b);
      await kv.del(key);
      ctx.bump("banks");
    }
  }
}

async function cleanupCouriers(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("courier:");
  for (const { key, value: co } of rows) {
    if (co && kvBranchMatches(co.branchId, ctx.bid)) {
      await purgeAllManagedR2UrlsInRecord(co);
      await kv.del(key);
      ctx.bump("couriers");
    }
  }

  const sessRows = await kv.getByPrefixWithKeys("courier_session:");
  for (const { key, value: sess } of sessRows) {
    const cid = String(sess?.courierId || "").trim();
    const cour = cid ? await kv.get(`courier:${cid}`) : null;
    if (!cour || kvBranchMatches(cour.branchId, ctx.bid)) {
      await kv.del(key);
      ctx.bump("courierSessions");
    }
  }
}

async function cleanupAutoCouriers(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("auto_courier:");
  for (const { key, value: row } of rows) {
    if (row && kvBranchMatches(row.branchId, ctx.bid)) {
      await kv.del(key);
      ctx.bump("autoCouriers");
    }
  }
  const sess = await kv.getByPrefixWithKeys("auto_courier_session:");
  for (const { key, value: s } of sess) {
    if (s && kvBranchMatches(s.branchId, ctx.bid)) {
      await kv.del(key);
      ctx.bump("autoCourierSessions");
    }
  }
}

async function cleanupCourierBags(ctx: CleanupCtx) {
  const store = createCourierBagStore(ctx.supabase);
  const bags = await store.listBags();
  const branchBags = bags.filter((b) => kvBranchMatches(b.branchId, ctx.bid));
  for (const bag of branchBags) {
    await ctx.supabase.from("courier_bags").delete().eq("id", bag.id);
    ctx.bump("courierBags");
  }
  const { data: assignments } = await ctx.supabase
    .from("courier_bag_assignments")
    .select("id")
    .eq("branch_id", ctx.bid);
  for (const row of assignments || []) {
    await ctx.supabase.from("courier_bag_assignments").delete().eq("id", row.id);
    ctx.bump("courierBagAssignments");
  }
}

async function cleanupPickupRacks(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys(`pickup_rack:${ctx.bid}:`);
  for (const { key } of rows) {
    await kv.del(key);
    ctx.bump("pickupRacks");
  }
}

async function cleanupPreparers(ctx: CleanupCtx) {
  const branchRegion = String(ctx.branch?.region || "").trim();
  const branchDistrict = String(ctx.branch?.district || "").trim();
  const rows = await kv.getByPrefixWithKeys("preparer:");
  for (const { key, value: p } of rows) {
    if (!p) continue;
    const matchRegion = !branchRegion || String(p.region || "").trim() === branchRegion;
    const matchDistrict = !branchDistrict || String(p.district || "").trim() === branchDistrict;
    if (!matchRegion || !matchDistrict) continue;
    await purgeAllManagedR2UrlsInRecord(p);
    await kv.del(key);
    ctx.bump("preparers");
    const pid = String(p.id || "").trim();
    if (pid) {
      const sessions = await kv.getByPrefixWithKeys("preparer_session:");
      for (const { key: sk, value: s } of sessions) {
        if (String(s?.preparerId || "") === pid) {
          await kv.del(sk);
          ctx.bump("preparerSessions");
        }
      }
    }
  }
}

async function cleanupDeliveryZones(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("delivery-zone:");
  for (const { key, value: z } of rows) {
    if (z && kvBranchMatches(z.branchId, ctx.bid)) {
      await kv.del(key);
      ctx.bump("deliveryZones");
    }
  }
}

async function cleanupChat(ctx: CleanupCtx) {
  const chatRows = await kv.getByPrefixWithKeys("chat:");
  for (const { key, value: chat } of chatRows) {
    if (!chat || !kvBranchMatches(chat.branchId, ctx.bid)) continue;
    const chatId = String(chat.id || key.replace(/^chat:/, "")).trim();
    if (chatId) {
      const msgRows = await kv.getByPrefixWithKeys(`chat_message:${chatId}:`);
      for (const m of msgRows) {
        await kv.del(m.key);
        ctx.bump("chatMessages");
      }
    }
    await kv.del(key);
    ctx.bump("chats");
  }
}

async function cleanupPayments(ctx: CleanupCtx) {
  const branchOrderIds = new Set<string>();
  const orderRows = await kv.getByPrefixWithKeys("order:");
  for (const { value: o } of orderRows) {
    if (o && kvBranchMatches(o.branchId, ctx.bid) && o.id) {
      branchOrderIds.add(String(o.id));
    }
  }

  const payRows = await kv.getByPrefixWithKeys("payment:");
  for (const { key, value: p } of payRows) {
    const oid = String(p?.orderId || "").trim();
    if (!oid || !branchOrderIds.has(oid)) continue;
    await kv.del(key);
    ctx.bump("payments");
  }

  for (const oid of branchOrderIds) {
    try {
      await kv.del(`payment_order:${oid}`);
      ctx.bump("paymentRefs");
    } catch {
      /* ignore */
    }
  }
}

async function cleanupRefunds(ctx: CleanupCtx) {
  await deleteBranchOrdersWhere(ctx, (o) => {
    const st = String(o?.status || "").toLowerCase();
    const ps = String(o?.paymentStatus || "").toLowerCase();
    return Boolean(o?.refundPending) || st === "refunded" || ps === "refunded";
  });
}

async function cleanupEmployees(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys("staff:");
  for (const { key, value: st } of rows) {
    if (st && kvBranchMatches(st.branchId, ctx.bid)) {
      await purgeAllManagedR2UrlsInRecord(st);
      await kv.del(key);
      ctx.bump("staff");
    }
  }

  try {
    const { error } = await ctx.supabase
      .from("branch_staff_memberships")
      .delete()
      .eq("branch_kv_id", ctx.bid);
    if (!error) ctx.bump("staffMemberships");
  } catch {
    /* ignore */
  }
}

async function cleanupReports(ctx: CleanupCtx) {
  const rows = await kv.getByPrefixWithKeys(`report:${ctx.bid}:`);
  for (const { key } of rows) {
    await kv.del(key);
    ctx.bump("reports");
  }
}

const HANDLERS: Record<
  Exclude<BranchCleanupTargetId, "all">,
  (ctx: CleanupCtx) => Promise<void>
> = {
  "market-orders": cleanupMarketOrders,
  "shop-orders": cleanupShopOrders,
  "food-orders": cleanupFoodOrders,
  "rental-orders": cleanupRentalOrders,
  market: cleanupMarketProducts,
  shop: cleanupShopData,
  foods: cleanupFoods,
  rentals: cleanupRentals,
  "rental-providers": cleanupRentalProviders,
  auction: cleanupAuction,
  banner: cleanupBanner,
  services: cleanupServices,
  nearby: cleanupNearby,
  house: cleanupHouse,
  car: cleanupCar,
  bank: cleanupBank,
  couriers: cleanupCouriers,
  "auto-couriers": cleanupAutoCouriers,
  "courier-bags": cleanupCourierBags,
  "pickup-racks": cleanupPickupRacks,
  preparers: cleanupPreparers,
  "delivery-zones": cleanupDeliveryZones,
  chat: cleanupChat,
  payments: cleanupPayments,
  refunds: cleanupRefunds,
  employees: cleanupEmployees,
  reports: cleanupReports,
};

export async function runBranchCleanup(
  branchId: string,
  targets: BranchCleanupTargetId[],
  options: { supabase: SupabaseClient },
): Promise<{ counts: Record<string, number>; byTarget: Record<string, Record<string, number>> }> {
  const bid = normalizeBranchId(branchId);
  if (!bid) throw new Error("Filial ID noto‘g‘ri");

  const branch = (await kv.get(`branch:${bid}`)) as Record<string, unknown> | null;
  const expanded = new Set<Exclude<BranchCleanupTargetId, "all">>();

  for (const t of targets) {
    if (t === "all") {
      for (const id of BRANCH_CLEANUP_TARGET_IDS) {
        if (id !== "all") expanded.add(id);
      }
    } else {
      expanded.add(t);
    }
  }

  const byTarget: Record<string, Record<string, number>> = {};
  const totalCounts: Record<string, number> = {};

  for (const target of expanded) {
    const counts: Record<string, number> = {};
    const bump: BumpFn = (key, n = 1) => {
      counts[key] = (counts[key] || 0) + n;
      totalCounts[key] = (totalCounts[key] || 0) + n;
    };
    const ctx: CleanupCtx = { bid, branch, bump, supabase: options.supabase };
    const handler = HANDLERS[target];
    if (handler) await handler(ctx);
    byTarget[target] = counts;
  }

  return { counts: totalCounts, byTarget };
}
