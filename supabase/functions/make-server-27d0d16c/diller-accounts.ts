import type { Hono } from "npm:hono";

export type DillerGender = "male" | "female";

export type DillerAccount = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  passportSeries: string;
  gender: DillerGender;
  birthDate: string;
  startDate: string;
  login: string;
  password: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DillerAccountPublic = Omit<DillerAccount, "password">;

export type DillerWorkspaceStats = {
  sales: number;
  products: number;
  stores: number;
  firms: number;
  shopOrders: number;
  expenses: number;
  totalSalesAmount: number;
  totalDebtAmount: number;
  totalPaidAmount: number;
  warehouseQty: number;
};

type Kv = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
  getByPrefixWithKeys?: (prefix: string) => Promise<Array<{ key: string; value: unknown }>>;
};

const ACCOUNTS_INDEX_KEY = "diller_accounts:index";
const LEGACY_WORKSPACE_KEY = "diller_workspace:v1";
const LEGACY_BACKUP_PREFIX = "diller_workspace_backup:";

export function dillerAccountKey(id: string) {
  return `diller_account:${id}`;
}

export function dillerLoginKey(login: string) {
  return `diller_login:${login.trim().toLowerCase()}`;
}

export function dillerWorkspaceKey(dealerId: string) {
  return `diller_workspace:${dealerId}`;
}

export function dillerWorkspaceBackupPrefix(dealerId: string) {
  return `diller_workspace_backup:${dealerId}:`;
}

function newDealerId() {
  return `dlr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function stripPassword(account: DillerAccount): DillerAccountPublic {
  const { password: _p, ...rest } = account;
  return rest;
}

export async function readAccountsIndex(kv: Kv): Promise<string[]> {
  const raw = (await kv.get(ACCOUNTS_INDEX_KEY)) as string[] | null;
  return Array.isArray(raw) ? raw.filter((id) => typeof id === "string" && id.trim()) : [];
}

async function writeAccountsIndex(kv: Kv, ids: string[]) {
  await kv.set(ACCOUNTS_INDEX_KEY, [...new Set(ids)]);
}

export async function readDillerAccount(kv: Kv, id: string): Promise<DillerAccount | null> {
  const raw = (await kv.get(dillerAccountKey(id))) as DillerAccount | null;
  if (!raw?.id || !raw.login) return null;
  return raw;
}

export async function findDillerByLogin(kv: Kv, login: string): Promise<DillerAccount | null> {
  const key = dillerLoginKey(login);
  const dealerId = String((await kv.get(key)) ?? "").trim();
  if (!dealerId) return null;
  const account = await readDillerAccount(kv, dealerId);
  if (!account || !account.active) return null;
  return account;
}

export function verifyDillerPassword(account: DillerAccount, password: string): boolean {
  const stored = String(account.password || "");
  const incoming = String(password || "");
  if (!stored || !incoming) return false;
  // Legacy plaintext
  if (stored === incoming) return true;
  // SHA-256 hex (async hash compared via sync helper filled at login)
  return false;
}

export async function hashDillerPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(String(password));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyDillerPasswordAsync(
  account: DillerAccount,
  password: string,
): Promise<boolean> {
  const stored = String(account.password || "");
  const incoming = String(password || "");
  if (!stored || !incoming) return false;
  if (stored === incoming) return true; // legacy plaintext
  const hashed = await hashDillerPassword(incoming);
  return hashed === stored;
}

export function computeWorkspaceStats(workspace: Record<string, unknown> | null): DillerWorkspaceStats {
  const sales = Array.isArray(workspace?.sales) ? workspace!.sales as Record<string, unknown>[] : [];
  const products = Array.isArray(workspace?.products) ? workspace!.products : [];
  const stores = Array.isArray(workspace?.stores) ? workspace!.stores : [];
  const firms = Array.isArray(workspace?.firms) ? workspace!.firms : [];
  const shopOrders = Array.isArray(workspace?.shopOrders) ? workspace!.shopOrders : [];
  const expenses = Array.isArray(workspace?.expenses) ? workspace!.expenses : [];
  const warehouse = Array.isArray(workspace?.warehouse) ? workspace!.warehouse : [];

  let totalSalesAmount = 0;
  let totalDebtAmount = 0;
  let totalPaidAmount = 0;
  for (const s of sales) {
    totalSalesAmount += Number(s.total || 0) || 0;
    totalPaidAmount += Number(s.paidAmount || 0) || 0;
    totalDebtAmount += Number(s.debtAmount || 0) || 0;
  }

  const warehouseQty = warehouse.reduce(
    (sum, row) => sum + Math.max(0, Number((row as { qty?: number })?.qty || 0)),
    0,
  );

  return {
    sales: sales.length,
    products: products.length,
    stores: stores.length,
    firms: firms.length,
    shopOrders: shopOrders.length,
    expenses: expenses.length,
    totalSalesAmount: Math.round(totalSalesAmount),
    totalDebtAmount: Math.round(totalDebtAmount),
    totalPaidAmount: Math.round(totalPaidAmount),
    warehouseQty: Math.round(warehouseQty),
  };
}

export async function createEmptyWorkspace(kv: Kv, dealerId: string, account: DillerAccount) {
  const profile = {
    companyName: account.fullName,
    directorName: account.fullName,
    phone: account.phone,
    region: "",
    note: account.address,
    orderToken: `qr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  };
  const workspace = {
    profile,
    firms: [],
    products: [],
    stores: [],
    warehouse: [],
    sales: [],
    expenses: [],
    balanceEntries: [],
    shopOrders: [],
    _updatedAt: new Date().toISOString(),
  };
  await kv.set(dillerWorkspaceKey(dealerId), workspace);
  const orderToken = String(profile.orderToken || "").trim();
  if (orderToken) {
    await kv.set(`diller_qrcode_token:${orderToken}`, dillerWorkspaceKey(dealerId));
  }
}

export async function createDillerAccount(
  kv: Kv,
  input: {
    fullName: string;
    phone: string;
    address: string;
    passportSeries: string;
    gender: DillerGender;
    birthDate: string;
    startDate: string;
    login: string;
    password: string;
  },
): Promise<{ ok: true; account: DillerAccountPublic } | { ok: false; error: string }> {
  const login = String(input.login || "").trim();
  const password = String(input.password || "").trim();
  const fullName = String(input.fullName || "").trim();

  if (!fullName || !login || password.length < 4) {
    return { ok: false, error: "Ism, login va parol (kamida 4 belgi) majburiy" };
  }

  const existingLogin = await kv.get(dillerLoginKey(login));
  if (existingLogin) {
    return { ok: false, error: "Bu login band" };
  }

  const id = newDealerId();
  const now = new Date().toISOString();
  const passwordHash = await hashDillerPassword(password);
  const account: DillerAccount = {
    id,
    fullName,
    phone: String(input.phone || "").trim(),
    address: String(input.address || "").trim(),
    passportSeries: String(input.passportSeries || "").trim(),
    gender: input.gender === "female" ? "female" : "male",
    birthDate: String(input.birthDate || "").trim(),
    startDate: String(input.startDate || "").trim(),
    login,
    password: passwordHash,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(dillerAccountKey(id), account);
  await kv.set(dillerLoginKey(login), id);
  const ids = await readAccountsIndex(kv);
  ids.push(id);
  await writeAccountsIndex(kv, ids);
  await createEmptyWorkspace(kv, id, account);

  return { ok: true, account: stripPassword(account) };
}

export async function purgeLegacyDillerData(kv: Kv): Promise<{ removed: number }> {
  let removed = 0;
  try {
    await kv.del(LEGACY_WORKSPACE_KEY);
    removed += 1;
  } catch {
    /* ignore */
  }
  if (!kv.getByPrefixWithKeys) return { removed };
  const rows = await kv.getByPrefixWithKeys(LEGACY_BACKUP_PREFIX);
  for (const row of rows) {
    const suffix = row.key.slice(LEGACY_BACKUP_PREFIX.length);
    if (!suffix.includes(":")) {
      try {
        await kv.del(row.key);
        removed += 1;
      } catch {
        /* ignore */
      }
    }
  }
  return { removed };
}

type AdminValidator = (c: unknown) => Promise<{ success: boolean; error?: string }>;

export function registerDillerAdminRoutes(
  app: Hono,
  deps: { kv: Kv; validateAdminAccess: AdminValidator },
) {
  const { kv, validateAdminAccess } = deps;

  app.get("/make-server-27d0d16c/admin/dillers", async (c) => {
    try {
      const admin = await validateAdminAccess(c);
      if (!admin.success) return c.json({ success: false, error: admin.error || "Ruxsat yo'q" }, 403);

      await purgeLegacyDillerData(kv);

      const ids = await readAccountsIndex(kv);
      const dealers: Array<DillerAccountPublic & { stats: DillerWorkspaceStats }> = [];
      let totals = {
        sales: 0,
        products: 0,
        stores: 0,
        firms: 0,
        totalSalesAmount: 0,
        totalDebtAmount: 0,
      };

      for (const id of ids) {
        const account = await readDillerAccount(kv, id);
        if (!account) continue;
        const ws = (await kv.get(dillerWorkspaceKey(id))) as Record<string, unknown> | null;
        const stats = computeWorkspaceStats(ws);
        dealers.push({ ...stripPassword(account), stats });
        totals.sales += stats.sales;
        totals.products += stats.products;
        totals.stores += stats.stores;
        totals.firms += stats.firms;
        totals.totalSalesAmount += stats.totalSalesAmount;
        totals.totalDebtAmount += stats.totalDebtAmount;
      }

      dealers.sort((a, b) => b.stats.totalSalesAmount - a.stats.totalSalesAmount);

      return c.json({ success: true, dealers, totals, count: dealers.length });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.post("/make-server-27d0d16c/admin/dillers", async (c) => {
    try {
      const admin = await validateAdminAccess(c);
      if (!admin.success) return c.json({ success: false, error: admin.error || "Ruxsat yo'q" }, 403);

      const body = await c.req.json().catch(() => ({}));
      const created = await createDillerAccount(kv, {
        fullName: String(body.fullName || ""),
        phone: String(body.phone || ""),
        address: String(body.address || ""),
        passportSeries: String(body.passportSeries || ""),
        gender: body.gender === "female" ? "female" : "male",
        birthDate: String(body.birthDate || ""),
        startDate: String(body.startDate || ""),
        login: String(body.login || ""),
        password: String(body.password || ""),
      });
      if (!created.ok) return c.json({ success: false, error: created.error }, 400);
      return c.json({ success: true, dealer: created.account });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.get("/make-server-27d0d16c/admin/dillers/:id", async (c) => {
    try {
      const admin = await validateAdminAccess(c);
      if (!admin.success) return c.json({ success: false, error: admin.error || "Ruxsat yo'q" }, 403);

      const id = String(c.req.param("id") || "").trim();
      const account = await readDillerAccount(kv, id);
      if (!account) return c.json({ success: false, error: "Diller topilmadi" }, 404);

      const ws = (await kv.get(dillerWorkspaceKey(id))) as Record<string, unknown> | null;
      const stats = computeWorkspaceStats(ws);
      const sales = Array.isArray(ws?.sales) ? ws!.sales : [];
      const recentSales = [...sales]
        .sort((a, b) =>
          String((b as { createdAt?: string }).createdAt || "").localeCompare(
            String((a as { createdAt?: string }).createdAt || ""),
          )
        )
        .slice(0, 20);

      return c.json({
        success: true,
        dealer: stripPassword(account),
        stats,
        recentSales,
        workspaceUpdatedAt: typeof ws?._updatedAt === "string" ? ws._updatedAt : null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  app.patch("/make-server-27d0d16c/admin/dillers/:id", async (c) => {
    try {
      const admin = await validateAdminAccess(c);
      if (!admin.success) return c.json({ success: false, error: admin.error || "Ruxsat yo'q" }, 403);

      const id = String(c.req.param("id") || "").trim();
      const existing = await readDillerAccount(kv, id);
      if (!existing) return c.json({ success: false, error: "Diller topilmadi" }, 404);

      const body = await c.req.json().catch(() => ({}));
      const newLogin = body.login != null ? String(body.login).trim() : existing.login;
      if (newLogin.toLowerCase() !== existing.login.toLowerCase()) {
        const taken = await kv.get(dillerLoginKey(newLogin));
        if (taken && String(taken) !== id) {
          return c.json({ success: false, error: "Bu login band" }, 400);
        }
        await kv.del(dillerLoginKey(existing.login));
        await kv.set(dillerLoginKey(newLogin), id);
      }

      const newPassword =
        body.password != null && String(body.password).trim()
          ? await hashDillerPassword(String(body.password).trim())
          : existing.password;

      const updated: DillerAccount = {
        ...existing,
        fullName: body.fullName != null ? String(body.fullName).trim() : existing.fullName,
        phone: body.phone != null ? String(body.phone).trim() : existing.phone,
        address: body.address != null ? String(body.address).trim() : existing.address,
        passportSeries:
          body.passportSeries != null
            ? String(body.passportSeries).trim()
            : existing.passportSeries,
        gender: body.gender === "female" ? "female" : body.gender === "male" ? "male" : existing.gender,
        birthDate: body.birthDate != null ? String(body.birthDate).trim() : existing.birthDate,
        startDate: body.startDate != null ? String(body.startDate).trim() : existing.startDate,
        login: newLogin,
        password: newPassword,
        active: body.active != null ? Boolean(body.active) : existing.active,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(dillerAccountKey(id), updated);
      return c.json({ success: true, dealer: stripPassword(updated) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
