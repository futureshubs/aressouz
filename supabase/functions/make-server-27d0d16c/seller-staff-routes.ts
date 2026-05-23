import type { Hono } from "npm:hono";

export type ShopStaffPayType = "monthly" | "commission";

export type ShopStaffRecord = {
  id: string;
  shopId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  gender: "male" | "female";
  payType: ShopStaffPayType;
  monthlySalary?: number;
  commissionPercent?: number;
  startDate?: string;
  login: string;
  password: string;
  active: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SellerAuthResult =
  | {
      success: true;
      shopId: string;
      branchId: string;
      shopName?: string;
      role: "owner" | "cashier";
      staffId?: string;
      staffName?: string;
      permissions: string[];
    }
  | { success: false; error: string };

export const buildShopStaffKey = (staffId: string) => `shop_staff:${staffId}`;

export function sanitizeShopStaffForClient(staff: ShopStaffRecord) {
  const { password, ...rest } = staff;
  return rest;
}

export function sellerIsOwner(auth: SellerAuthResult): boolean {
  return auth.success === true && auth.role === "owner";
}

export function sellerHasPermission(auth: SellerAuthResult, perm: string): boolean {
  if (!auth.success) return false;
  if (auth.role === "owner") return true;
  return auth.permissions.includes(perm);
}

export function sellerOwnerOnlyResponse(auth: SellerAuthResult) {
  if (!auth.success) return { denied: true as const, status: 401, error: auth.error };
  if (auth.role !== "owner") {
    return { denied: true as const, status: 403, error: "Faqat do'kon egasi uchun" };
  }
  return { denied: false as const };
}

async function findShopStaffLoginConflict(
  kv: { getByPrefix: (prefix: string) => Promise<any[]> },
  shopId: string,
  login: string,
  excludeId?: string,
) {
  const normalized = String(login || "").trim().toLowerCase();
  if (!normalized) return null;
  const all = await kv.getByPrefix("shop_staff:");
  return (
    all.find(
      (s: ShopStaffRecord) =>
        s &&
        !s.deleted &&
        sellerShopIdsMatch(s.shopId, shopId) &&
        String(s.login || "").trim().toLowerCase() === normalized &&
        (!excludeId || s.id !== excludeId),
    ) || null
  );
}

function sellerShopIdsMatch(a: unknown, b: unknown): boolean {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const strip = (v: string) => v.replace(/^shop[_:]/, "").replace(/^shop_product[_:]/, "");
  return strip(left) === strip(right);
}

async function computeStaffSalesStats(
  kv: { getByPrefix: (prefix: string) => Promise<any[]> },
  shopId: string,
  staffId: string,
) {
  const prefix = `pos:sale:${shopId}:`;
  const sales = await kv.getByPrefix(prefix);
  let saleCount = 0;
  let totalUzs = 0;
  let todayCount = 0;
  let todayUzs = 0;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  for (const sale of Array.isArray(sales) ? sales : []) {
    if (!sale || String(sale.staffId || "") !== staffId) continue;
    const total = Math.max(0, Math.floor(Number(sale?.totals?.totalUzs) || 0));
    saleCount += 1;
    totalUzs += total;
    const createdMs = new Date(String(sale.createdAt || sale.syncedAt || 0)).getTime();
    if (Number.isFinite(createdMs) && createdMs >= todayMs) {
      todayCount += 1;
      todayUzs += total;
    }
  }

  return { saleCount, totalUzs, todayCount, todayUzs };
}

export function registerSellerStaffRoutes(
  app: Hono,
  deps: {
    kv: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
      del: (key: string) => Promise<void>;
      getByPrefix: (prefix: string) => Promise<any[]>;
    };
    validateSellerSession: (c: any) => Promise<SellerAuthResult>;
    sellerShopIdsMatchFn?: (a: unknown, b: unknown) => boolean;
  },
) {
  const { kv, validateSellerSession } = deps;
  const matchShop = deps.sellerShopIdsMatchFn || sellerShopIdsMatch;

  app.get("/make-server-27d0d16c/seller/staff", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const rows = await kv.getByPrefix("shop_staff:");
      const staffList = (Array.isArray(rows) ? rows : [])
        .filter(
          (s: ShopStaffRecord) =>
            s && !s.deleted && matchShop(s.shopId, auth.shopId),
        )
        .sort(
          (a: ShopStaffRecord, b: ShopStaffRecord) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        );

      const staff = await Promise.all(
        staffList.map(async (s: ShopStaffRecord) => {
          const stats = await computeStaffSalesStats(kv, auth.shopId, s.id);
          const commissionEarned =
            s.payType === "commission" && s.commissionPercent
              ? Math.round((stats.totalUzs * s.commissionPercent) / 100)
              : 0;
          return {
            ...sanitizeShopStaffForClient(s),
            stats: {
              ...stats,
              commissionEarned,
            },
          };
        }),
      );

      const summary = {
        total: staff.length,
        active: staff.filter((s) => s.active !== false).length,
        monthly: staff.filter((s) => s.payType === "monthly").length,
        commission: staff.filter((s) => s.payType === "commission").length,
        todaySalesUzs: staff.reduce((sum, s) => sum + (s.stats?.todayUzs || 0), 0),
      };

      return c.json({ success: true, staff, summary });
    } catch (error: any) {
      console.error("[seller/staff] list error", error);
      return c.json({ error: "Ishchilarni olishda xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/seller/staff", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const body = await c.req.json().catch(() => ({}));
      const firstName = String(body?.firstName || "").trim();
      const lastName = String(body?.lastName || "").trim();
      const phone = String(body?.phone || "").trim();
      const login = String(body?.login || "").trim();
      const password = String(body?.password || "").trim();
      const gender = body?.gender === "female" ? "female" : "male";
      const age = Math.max(0, Math.floor(Number(body?.age) || 0));
      const payType: ShopStaffPayType = body?.payType === "commission" ? "commission" : "monthly";
      const startDate = String(body?.startDate || "").trim() || undefined;
      const monthlySalary =
        payType === "monthly"
          ? Math.max(0, Math.floor(Number(body?.monthlySalary) || 0))
          : undefined;
      const commissionPercent =
        payType === "commission"
          ? Math.min(100, Math.max(0, Math.floor(Number(body?.commissionPercent) || 0)))
          : undefined;

      if (!firstName || !lastName || !phone || !login || !password) {
        return c.json({ error: "Ism, familiya, telefon, login va parol majburiy" }, 400);
      }
      if (age <= 0) {
        return c.json({ error: "Yosh to'g'ri kiriting" }, 400);
      }
      if (payType === "monthly" && (!monthlySalary || monthlySalary <= 0)) {
        return c.json({ error: "Oylik maosh kiriting" }, 400);
      }
      if (payType === "commission" && (!commissionPercent || commissionPercent <= 0)) {
        return c.json({ error: "Savdodan foiz kiriting" }, 400);
      }
      if (payType === "monthly" && !startDate) {
        return c.json({ error: "Ish boshlangan sana majburiy" }, 400);
      }

      const conflict = await findShopStaffLoginConflict(kv, auth.shopId, login);
      if (conflict) {
        return c.json({ error: "Bu login allaqachon band" }, 409);
      }

      const staffId = `shop_staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const record: ShopStaffRecord = {
        id: staffId,
        shopId: auth.shopId,
        branchId: auth.branchId,
        firstName,
        lastName,
        phone,
        age,
        gender,
        payType,
        monthlySalary,
        commissionPercent,
        startDate,
        login,
        password,
        active: true,
        deleted: false,
        createdAt: now,
        updatedAt: now,
      };

      await kv.set(buildShopStaffKey(staffId), record);
      const stats = await computeStaffSalesStats(kv, auth.shopId, staffId);
      return c.json({
        success: true,
        staff: { ...sanitizeShopStaffForClient(record), stats: { ...stats, commissionEarned: 0 } },
        message: "Ishchi qo'shildi",
      });
    } catch (error: any) {
      console.error("[seller/staff] create error", error);
      return c.json({ error: "Ishchi qo'shishda xatolik" }, 500);
    }
  });

  app.put("/make-server-27d0d16c/seller/staff/:id", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const staffId = String(c.req.param("id") || "").trim();
      if (!staffId) return c.json({ error: "Ishchi ID kerak" }, 400);

      const existing = (await kv.get(buildShopStaffKey(staffId))) as ShopStaffRecord | null;
      if (!existing || existing.deleted || !matchShop(existing.shopId, auth.shopId)) {
        return c.json({ error: "Ishchi topilmadi" }, 404);
      }

      const body = await c.req.json().catch(() => ({}));
      const firstName = String(body?.firstName ?? existing.firstName).trim();
      const lastName = String(body?.lastName ?? existing.lastName).trim();
      const phone = String(body?.phone ?? existing.phone).trim();
      const login = String(body?.login ?? existing.login).trim();
      const gender = body?.gender === "female" ? "female" : body?.gender === "male" ? "male" : existing.gender;
      const age = Math.max(0, Math.floor(Number(body?.age ?? existing.age) || 0));
      const payType: ShopStaffPayType =
        body?.payType === "commission" ? "commission" : body?.payType === "monthly" ? "monthly" : existing.payType;
      const startDate =
        body?.startDate !== undefined ? String(body.startDate || "").trim() || undefined : existing.startDate;
      const monthlySalary =
        payType === "monthly"
          ? Math.max(0, Math.floor(Number(body?.monthlySalary ?? existing.monthlySalary) || 0))
          : undefined;
      const commissionPercent =
        payType === "commission"
          ? Math.min(
              100,
              Math.max(0, Math.floor(Number(body?.commissionPercent ?? existing.commissionPercent) || 0)),
            )
          : undefined;
      const newPassword = String(body?.password || body?.newPassword || "").trim();
      const active = body?.active !== undefined ? Boolean(body.active) : existing.active;

      if (!firstName || !lastName || !phone || !login) {
        return c.json({ error: "Ism, familiya, telefon va login majburiy" }, 400);
      }
      if (age <= 0) return c.json({ error: "Yosh to'g'ri kiriting" }, 400);

      const conflict = await findShopStaffLoginConflict(kv, auth.shopId, login, staffId);
      if (conflict) return c.json({ error: "Bu login allaqachon band" }, 409);

      const updated: ShopStaffRecord = {
        ...existing,
        firstName,
        lastName,
        phone,
        login,
        gender,
        age,
        payType,
        monthlySalary,
        commissionPercent,
        startDate,
        active,
        password: newPassword || existing.password,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(buildShopStaffKey(staffId), updated);
      const stats = await computeStaffSalesStats(kv, auth.shopId, staffId);
      const commissionEarned =
        updated.payType === "commission" && updated.commissionPercent
          ? Math.round((stats.totalUzs * updated.commissionPercent) / 100)
          : 0;
      return c.json({
        success: true,
        staff: { ...sanitizeShopStaffForClient(updated), stats: { ...stats, commissionEarned } },
        message: "Ishchi yangilandi",
      });
    } catch (error: any) {
      console.error("[seller/staff] update error", error);
      return c.json({ error: "Ishchini yangilashda xatolik" }, 500);
    }
  });

  app.delete("/make-server-27d0d16c/seller/staff/:id", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const staffId = String(c.req.param("id") || "").trim();
      if (!staffId) return c.json({ error: "Ishchi ID kerak" }, 400);

      const existing = (await kv.get(buildShopStaffKey(staffId))) as ShopStaffRecord | null;
      if (!existing || existing.deleted || !matchShop(existing.shopId, auth.shopId)) {
        return c.json({ error: "Ishchi topilmadi" }, 404);
      }

      await kv.set(buildShopStaffKey(staffId), {
        ...existing,
        deleted: true,
        active: false,
        updatedAt: new Date().toISOString(),
      });
      return c.json({ success: true, message: "Ishchi o'chirildi" });
    } catch (error: any) {
      console.error("[seller/staff] delete error", error);
      return c.json({ error: "Ishchini o'chirishda xatolik" }, 500);
    }
  });
}

export async function authenticateShopStaffLogin(
  kv: { getByPrefix: (prefix: string) => Promise<any[]>; get: (key: string) => Promise<any> },
  login: string,
  password: string,
  sellerShopIdsMatchFn: (a: unknown, b: unknown) => boolean,
) {
  const normalizedLogin = String(login || "").trim();
  const normalizedPassword = String(password || "").trim();
  if (!normalizedLogin || !normalizedPassword) return null;

  const allStaff = await kv.getByPrefix("shop_staff:");
  const staff = (Array.isArray(allStaff) ? allStaff : []).find(
    (s: ShopStaffRecord) =>
      s &&
      !s.deleted &&
      s.active !== false &&
      String(s.login || "").trim() === normalizedLogin &&
      String(s.password || "") === normalizedPassword,
  ) as ShopStaffRecord | undefined;

  if (!staff) return null;

  let shop: any = null;
  const shopKey = staff.shopId.startsWith("shop:") ? staff.shopId : `shop:${staff.shopId}`;
  shop = await kv.get(shopKey);
  if (!shop) {
    const shops = await kv.getByPrefix("shop:");
    shop = shops.find((s: any) => sellerShopIdsMatchFn(s?.id, staff.shopId) && !s.deleted);
  }
  if (!shop || shop.deleted) return null;

  return { staff, shop };
}
