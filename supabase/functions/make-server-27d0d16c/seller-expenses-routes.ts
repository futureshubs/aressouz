import type { Hono } from "npm:hono";
import {
  sellerOwnerOnlyResponse,
  type SellerAuthResult,
} from "./seller-staff-routes.ts";

export type ShopExpenseCategory = {
  id: string;
  shopId: string;
  branchId: string;
  name: string;
  color: string;
  description?: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShopExpenseRecord = {
  id: string;
  shopId: string;
  branchId: string;
  categoryId: string;
  categoryName: string;
  title: string;
  amount: number;
  note?: string;
  expenseDate: string;
  paymentMethod: "cash" | "card" | "transfer" | "other";
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export const buildExpenseCategoryKey = (id: string) => `shop_expense_category:${id}`;
export const buildExpenseKey = (id: string) => `shop_expense:${id}`;

const CATEGORY_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

function sellerShopIdsMatch(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => String(v ?? "").trim().replace(/^shop:/i, "");
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right && left === right);
}

function parsePageLimit(c: any, defaults?: { page?: number; limit?: number; maxLimit?: number }) {
  const page = Math.max(1, Math.floor(Number(c.req.query("page")) || defaults?.page || 1));
  const maxLimit = defaults?.maxLimit ?? 100;
  const limit = Math.min(
    maxLimit,
    Math.max(1, Math.floor(Number(c.req.query("limit")) || defaults?.limit || 20)),
  );
  return { page, limit, offset: (page - 1) * limit };
}

function toIsoMs(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function monthStartEnd(queryMonth?: string) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth)) {
    const [yy, mm] = queryMonth.split("-").map(Number);
    y = yy;
    m = mm - 1;
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime(), monthKey: `${y}-${String(m + 1).padStart(2, "0")}` };
}

function computeExpenseSummary(expenses: ShopExpenseRecord[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const weekStart = new Date(startOfToday);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekMs = weekStart.getTime();
  const month = monthStartEnd();

  let totalAll = 0;
  let todayTotal = 0;
  let weekTotal = 0;
  let monthTotal = 0;
  let count = 0;

  for (const e of expenses) {
    if (!e || e.deleted) continue;
    const amount = Math.max(0, Math.floor(Number(e.amount) || 0));
    const ms = toIsoMs(e.expenseDate) ?? toIsoMs(e.createdAt) ?? 0;
    totalAll += amount;
    count += 1;
    if (ms >= todayMs) todayTotal += amount;
    if (ms >= weekMs) weekTotal += amount;
    if (ms >= month.startMs && ms <= month.endMs) monthTotal += amount;
  }

  return { totalAll, todayTotal, weekTotal, monthTotal, count, monthKey: month.monthKey };
}

function categoryTotals(expenses: ShopExpenseRecord[], categories: ShopExpenseCategory[]) {
  const map = new Map<string, number>();
  for (const c of categories) map.set(c.id, 0);
  for (const e of expenses) {
    if (!e || e.deleted) continue;
    const amount = Math.max(0, Math.floor(Number(e.amount) || 0));
    map.set(e.categoryId, (map.get(e.categoryId) || 0) + amount);
  }
  return map;
}

export function registerSellerExpenseRoutes(
  app: Hono,
  deps: {
    kv: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
      getByPrefix: (prefix: string) => Promise<any[]>;
    };
    validateSellerSession: (c: any) => Promise<SellerAuthResult>;
    sellerShopIdsMatchFn?: (a: unknown, b: unknown) => boolean;
  },
) {
  const { kv, validateSellerSession } = deps;
  const matchShop = deps.sellerShopIdsMatchFn || sellerShopIdsMatch;

  async function loadShopCategories(shopId: string) {
    const rows = await kv.getByPrefix("shop_expense_category:");
    return (Array.isArray(rows) ? rows : [])
      .filter((c: ShopExpenseCategory) => c && !c.deleted && matchShop(c.shopId, shopId))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "uz"));
  }

  async function loadShopExpenses(shopId: string) {
    const rows = await kv.getByPrefix("shop_expense:");
    return (Array.isArray(rows) ? rows : [])
      .filter((e: ShopExpenseRecord) => e && !e.deleted && matchShop(e.shopId, shopId))
      .sort(
        (a, b) =>
          (toIsoMs(b.expenseDate) ?? toIsoMs(b.createdAt) ?? 0) -
          (toIsoMs(a.expenseDate) ?? toIsoMs(a.createdAt) ?? 0),
      );
  }

  app.get("/make-server-27d0d16c/seller/expense-categories", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const categories = await loadShopCategories(auth.shopId);
      const expenses = await loadShopExpenses(auth.shopId);
      const totals = categoryTotals(expenses, categories);
      const month = monthStartEnd(String(c.req.query("month") || ""));

      const enriched = categories.map((cat) => {
        const monthSum = expenses
          .filter((e) => e.categoryId === cat.id)
          .filter((e) => {
            const ms = toIsoMs(e.expenseDate) ?? toIsoMs(e.createdAt) ?? 0;
            return ms >= month.startMs && ms <= month.endMs;
          })
          .reduce((s, e) => s + Math.max(0, Math.floor(Number(e.amount) || 0)), 0);
        return {
          ...cat,
          totalUzs: totals.get(cat.id) || 0,
          monthUzs: monthSum,
        };
      });

      return c.json({ success: true, categories: enriched });
    } catch (error: any) {
      console.error("[seller/expense-categories] list error", error);
      return c.json({ error: "Kategoriyalarni olishda xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/seller/expense-categories", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const body = await c.req.json().catch(() => ({}));
      const name = String(body?.name || "").trim();
      const description = String(body?.description || "").trim() || undefined;
      const color = String(body?.color || CATEGORY_COLORS[0]).trim();

      if (!name) return c.json({ error: "Kategoriya nomi majburiy" }, 400);

      const existing = await loadShopCategories(auth.shopId);
      if (existing.some((c) => String(c.name).trim().toLowerCase() === name.toLowerCase())) {
        return c.json({ error: "Bu kategoriya allaqachon mavjud" }, 409);
      }

      const id = `shop_exp_cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const record: ShopExpenseCategory = {
        id,
        shopId: auth.shopId,
        branchId: auth.branchId,
        name,
        color: CATEGORY_COLORS.includes(color) ? color : CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length],
        description,
        deleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await kv.set(buildExpenseCategoryKey(id), record);
      return c.json({ success: true, category: record, message: "Kategoriya qo'shildi" });
    } catch (error: any) {
      console.error("[seller/expense-categories] create error", error);
      return c.json({ error: "Kategoriya qo'shishda xatolik" }, 500);
    }
  });

  app.put("/make-server-27d0d16c/seller/expense-categories/:id", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const id = String(c.req.param("id") || "").trim();
      const existing = (await kv.get(buildExpenseCategoryKey(id))) as ShopExpenseCategory | null;
      if (!existing || existing.deleted || !matchShop(existing.shopId, auth.shopId)) {
        return c.json({ error: "Kategoriya topilmadi" }, 404);
      }

      const body = await c.req.json().catch(() => ({}));
      const name = String(body?.name ?? existing.name).trim();
      const description =
        body?.description !== undefined ? String(body.description || "").trim() || undefined : existing.description;
      const color = String(body?.color ?? existing.color).trim() || existing.color;

      if (!name) return c.json({ error: "Kategoriya nomi majburiy" }, 400);

      const others = (await loadShopCategories(auth.shopId)).filter((c) => c.id !== id);
      if (others.some((c) => String(c.name).trim().toLowerCase() === name.toLowerCase())) {
        return c.json({ error: "Bu kategoriya nomi band" }, 409);
      }

      const updated: ShopExpenseCategory = {
        ...existing,
        name,
        description,
        color,
        updatedAt: new Date().toISOString(),
      };
      await kv.set(buildExpenseCategoryKey(id), updated);

      if (name !== existing.name) {
        const expenses = await loadShopExpenses(auth.shopId);
        for (const exp of expenses) {
          if (exp.categoryId !== id) continue;
          await kv.set(buildExpenseKey(exp.id), {
            ...exp,
            categoryName: name,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return c.json({ success: true, category: updated, message: "Kategoriya yangilandi" });
    } catch (error: any) {
      console.error("[seller/expense-categories] update error", error);
      return c.json({ error: "Kategoriyani yangilashda xatolik" }, 500);
    }
  });

  app.delete("/make-server-27d0d16c/seller/expense-categories/:id", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const id = String(c.req.param("id") || "").trim();
      const existing = (await kv.get(buildExpenseCategoryKey(id))) as ShopExpenseCategory | null;
      if (!existing || existing.deleted || !matchShop(existing.shopId, auth.shopId)) {
        return c.json({ error: "Kategoriya topilmadi" }, 404);
      }

      const hasExpenses = (await loadShopExpenses(auth.shopId)).some((e) => e.categoryId === id);
      if (hasExpenses) {
        return c.json({ error: "Bu kategoriyada harajatlar bor — avval harajatlarni o'chiring yoki boshqa kategoriyaga o'tkazing" }, 409);
      }

      await kv.set(buildExpenseCategoryKey(id), {
        ...existing,
        deleted: true,
        updatedAt: new Date().toISOString(),
      });
      return c.json({ success: true, message: "Kategoriya o'chirildi" });
    } catch (error: any) {
      console.error("[seller/expense-categories] delete error", error);
      return c.json({ error: "Kategoriyani o'chirishda xatolik" }, 500);
    }
  });

  app.get("/make-server-27d0d16c/seller/expenses", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const categoryId = String(c.req.query("categoryId") || "").trim();
      const q = String(c.req.query("q") || "").trim().toLowerCase();
      const month = String(c.req.query("month") || "").trim();
      const { page, limit, offset } = parsePageLimit(c, { page: 1, limit: 20, maxLimit: 100 });

      let list = await loadShopExpenses(auth.shopId);
      const categories = await loadShopCategories(auth.shopId);

      if (categoryId) {
        list = list.filter((e) => e.categoryId === categoryId);
      }
      if (month) {
        const range = monthStartEnd(month);
        list = list.filter((e) => {
          const ms = toIsoMs(e.expenseDate) ?? toIsoMs(e.createdAt) ?? 0;
          return ms >= range.startMs && ms <= range.endMs;
        });
      }
      if (q) {
        list = list.filter((e) => {
          const hay = `${e.title} ${e.categoryName} ${e.note || ""}`.toLowerCase();
          return hay.includes(q);
        });
      }

      const summary = computeExpenseSummary(await loadShopExpenses(auth.shopId));
      const total = list.length;
      const expenses = list.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      const byCategory = categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        totalUzs: list.filter((e) => e.categoryId === cat.id).reduce((s, e) => s + Math.max(0, Math.floor(Number(e.amount) || 0)), 0),
      }));

      return c.json({
        success: true,
        expenses,
        summary,
        byCategory,
        categories,
        page,
        limit,
        total,
        hasMore,
      });
    } catch (error: any) {
      console.error("[seller/expenses] list error", error);
      return c.json({ error: "Harajatlarni olishda xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/seller/expenses", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const body = await c.req.json().catch(() => ({}));
      const categoryId = String(body?.categoryId || "").trim();
      const title = String(body?.title || "").trim();
      const amount = Math.max(0, Math.floor(Number(body?.amount) || 0));
      const note = String(body?.note || "").trim() || undefined;
      const expenseDate = String(body?.expenseDate || "").trim() || new Date().toISOString().slice(0, 10);
      const paymentMethodRaw = String(body?.paymentMethod || "cash").trim();
      const paymentMethod = ["cash", "card", "transfer", "other"].includes(paymentMethodRaw)
        ? paymentMethodRaw as ShopExpenseRecord["paymentMethod"]
        : "cash";

      if (!categoryId) return c.json({ error: "Kategoriya tanlang" }, 400);
      if (!title) return c.json({ error: "Harajat nomi majburiy" }, 400);
      if (amount <= 0) return c.json({ error: "Summa 0 dan katta bo'lishi kerak" }, 400);

      const category = (await kv.get(buildExpenseCategoryKey(categoryId))) as ShopExpenseCategory | null;
      if (!category || category.deleted || !matchShop(category.shopId, auth.shopId)) {
        return c.json({ error: "Kategoriya topilmadi" }, 404);
      }

      const id = `shop_exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const record: ShopExpenseRecord = {
        id,
        shopId: auth.shopId,
        branchId: auth.branchId,
        categoryId,
        categoryName: category.name,
        title,
        amount,
        note,
        expenseDate,
        paymentMethod,
        deleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await kv.set(buildExpenseKey(id), record);
      return c.json({ success: true, expense: record, message: "Harajat qo'shildi" });
    } catch (error: any) {
      console.error("[seller/expenses] create error", error);
      return c.json({ error: "Harajat qo'shishda xatolik" }, 500);
    }
  });

  app.put("/make-server-27d0d16c/seller/expenses/:id", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const id = String(c.req.param("id") || "").trim();
      const existing = (await kv.get(buildExpenseKey(id))) as ShopExpenseRecord | null;
      if (!existing || existing.deleted || !matchShop(existing.shopId, auth.shopId)) {
        return c.json({ error: "Harajat topilmadi" }, 404);
      }

      const body = await c.req.json().catch(() => ({}));
      const categoryId = String(body?.categoryId ?? existing.categoryId).trim();
      const title = String(body?.title ?? existing.title).trim();
      const amount = Math.max(0, Math.floor(Number(body?.amount ?? existing.amount) || 0));
      const note = body?.note !== undefined ? String(body.note || "").trim() || undefined : existing.note;
      const expenseDate = String(body?.expenseDate ?? existing.expenseDate).trim();
      const paymentMethodRaw = String(body?.paymentMethod ?? existing.paymentMethod).trim();
      const paymentMethod = ["cash", "card", "transfer", "other"].includes(paymentMethodRaw)
        ? paymentMethodRaw as ShopExpenseRecord["paymentMethod"]
        : existing.paymentMethod;

      if (!title) return c.json({ error: "Harajat nomi majburiy" }, 400);
      if (amount <= 0) return c.json({ error: "Summa 0 dan katta bo'lishi kerak" }, 400);

      const category = (await kv.get(buildExpenseCategoryKey(categoryId))) as ShopExpenseCategory | null;
      if (!category || category.deleted || !matchShop(category.shopId, auth.shopId)) {
        return c.json({ error: "Kategoriya topilmadi" }, 404);
      }

      const updated: ShopExpenseRecord = {
        ...existing,
        categoryId,
        categoryName: category.name,
        title,
        amount,
        note,
        expenseDate,
        paymentMethod,
        updatedAt: new Date().toISOString(),
      };
      await kv.set(buildExpenseKey(id), updated);
      return c.json({ success: true, expense: updated, message: "Harajat yangilandi" });
    } catch (error: any) {
      console.error("[seller/expenses] update error", error);
      return c.json({ error: "Harajatni yangilashda xatolik" }, 500);
    }
  });

  app.delete("/make-server-27d0d16c/seller/expenses/:id", async (c) => {
    try {
      const auth = await validateSellerSession(c);
      const ownerCheck = sellerOwnerOnlyResponse(auth);
      if (ownerCheck.denied) {
        return c.json({ error: ownerCheck.error }, ownerCheck.status as 401 | 403);
      }

      const id = String(c.req.param("id") || "").trim();
      const existing = (await kv.get(buildExpenseKey(id))) as ShopExpenseRecord | null;
      if (!existing || existing.deleted || !matchShop(existing.shopId, auth.shopId)) {
        return c.json({ error: "Harajat topilmadi" }, 404);
      }

      await kv.set(buildExpenseKey(id), {
        ...existing,
        deleted: true,
        updatedAt: new Date().toISOString(),
      });
      return c.json({ success: true, message: "Harajat o'chirildi" });
    } catch (error: any) {
      console.error("[seller/expenses] delete error", error);
      return c.json({ error: "Harajatni o'chirishda xatolik" }, 500);
    }
  });
}
