import type { Hono } from "npm:hono";
import { sendDillerQrcodeOrderNotification } from "./telegram.tsx";
import {
  dillerWorkspaceKey,
  dillerWorkspaceBackupPrefix,
  findDillerByLogin,
  registerDillerAdminRoutes,
  verifyDillerPasswordAsync,
} from "./diller-accounts.ts";
import * as eskiz from "./eskiz-sms.tsx";
import {
  buildSmsFromTemplateAndVars,
  normalizeUzSmsPhone,
} from "./diller-purchase-sms.ts";

const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

type Kv = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
  getByPrefixWithKeys?: (prefix: string) => Promise<Array<{ key: string; value: unknown }>>;
};

const WORKSPACE_BACKUP_PREFIX = "diller_workspace_backup:";

type DillerSession = {
  token: string;
  dealerId: string;
  login: string;
  displayName: string;
  expiresAt: number;
  createdAt: string;
};

type ShopOrderItem = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  unit: string;
};

type ShopOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: ShopOrderItem[];
  total: number;
  note: string;
  status: "pending" | "accepted" | "rejected" | "done";
  createdAt: string;
  storeId?: string;
  storeName?: string;
  customerAddress?: string;
};

function dillerSessionKey(token: string): string {
  return `diller_session:${token}`;
}

function shopOrdersKey(orderToken: string): string {
  return `diller_shop_orders:${orderToken}`;
}

function readDillerToken(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } }): string {
  return String(
    c.req.header("X-Diller-Token") ||
      c.req.header("x-diller-token") ||
      c.req.query("token") ||
      "",
  ).trim();
}

async function readWorkspace(kv: Kv, dealerId: string): Promise<Record<string, unknown> | null> {
  const stored = (await kv.get(dillerWorkspaceKey(dealerId))) as Record<string, unknown> | null;
  if (!stored) return null;
  const data = { ...stored };
  delete data._updatedAt;
  return data;
}

async function resolveDillerSession(c: {
  req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined };
}, kv: Kv): Promise<DillerSession | null> {
  const token = readDillerToken(c);
  if (!token) return null;
  const raw = (await kv.get(dillerSessionKey(token))) as DillerSession | null;
  if (!raw?.token || !raw.dealerId || !raw.expiresAt || raw.expiresAt < Date.now()) {
    if (token) {
      try {
        await kv.del(dillerSessionKey(token));
      } catch {
        /* ignore */
      }
    }
    return null;
  }
  return raw;
}

function workspaceHasContent(raw: Record<string, unknown> | null): boolean {
  if (!raw) return false;
  const arrays = ["firms", "products", "stores", "sales", "expenses", "balanceEntries", "shopOrders"] as const;
  for (const key of arrays) {
    if (Array.isArray(raw[key]) && (raw[key] as unknown[]).length > 0) return true;
  }
  const wh = raw.warehouse;
  if (Array.isArray(wh) && wh.some((w) => Number((w as { qty?: number })?.qty || 0) > 0)) {
    return true;
  }
  const profile = raw.profile as Record<string, unknown> | undefined;
  if (profile && String(profile.orderToken ?? "").trim()) return true;
  return false;
}

/** Sotuv/do‘kon/mahsulot yo‘qolganini aniqlash (faqat QR buyurtmalar qolgan holat) */
function workspaceNeedsBusinessRestore(raw: Record<string, unknown> | null): boolean {
  if (!raw) return true;
  const core = ["firms", "products", "stores", "sales", "expenses", "balanceEntries"] as const;
  for (const key of core) {
    if (Array.isArray(raw[key]) && (raw[key] as unknown[]).length > 0) return false;
  }
  const wh = raw.warehouse;
  if (Array.isArray(wh) && wh.some((w) => Number((w as { qty?: number })?.qty || 0) > 0)) {
    return false;
  }
  return true;
}

async function backupWorkspaceIfNeeded(
  kv: Kv,
  dealerId: string,
  existing: Record<string, unknown> | null,
): Promise<void> {
  if (!workspaceHasContent(existing)) return;
  const updatedAt =
    typeof existing?._updatedAt === "string"
      ? existing._updatedAt
      : new Date().toISOString();
  const prefix = dillerWorkspaceBackupPrefix(dealerId);
  await kv.set(`${prefix}${Date.now()}`, {
    ...existing,
    _updatedAt: updatedAt,
    _backupAt: new Date().toISOString(),
  });
}

async function restoreWorkspaceFromBackups(kv: Kv, dealerId: string): Promise<{
  data: Record<string, unknown> | null;
  updatedAt: string | null;
  sourceKey?: string;
}> {
  if (!kv.getByPrefixWithKeys) return { data: null, updatedAt: null };
  const prefix = dillerWorkspaceBackupPrefix(dealerId);
  const rows = await kv.getByPrefixWithKeys(prefix);
  rows.sort((a, b) => {
    const ta = Number(a.key.slice(prefix.length)) || 0;
    const tb = Number(b.key.slice(prefix.length)) || 0;
    return tb - ta;
  });
  const wsKey = dillerWorkspaceKey(dealerId);
  for (const row of rows) {
    const raw = (row.value || {}) as Record<string, unknown>;
    const clean = { ...raw };
    delete clean._updatedAt;
    delete clean._backupAt;
    if (!workspaceHasContent(clean)) continue;
    const updatedAt = new Date().toISOString();
    await kv.set(wsKey, { ...clean, _updatedAt: updatedAt });
    return { data: clean, updatedAt, sourceKey: row.key };
  }
  return { data: null, updatedAt: null };
}

function extractWorkspaceCandidate(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    Array.isArray(v.sales) ||
    Array.isArray(v.products) ||
    Array.isArray(v.stores) ||
    Array.isArray(v.firms)
  ) {
    return v;
  }
  if (v.data && typeof v.data === "object") {
    return extractWorkspaceCandidate(v.data);
  }
  return null;
}

function workspaceScore(raw: Record<string, unknown>): number {
  let score = 0;
  const sales = Array.isArray(raw.sales) ? raw.sales : [];
  const products = Array.isArray(raw.products) ? raw.products : [];
  const stores = Array.isArray(raw.stores) ? raw.stores : [];
  const firms = Array.isArray(raw.firms) ? raw.firms : [];
  const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];
  score += sales.length * 100;
  score += products.length * 25;
  score += stores.length * 25;
  score += firms.length * 10;
  score += expenses.length * 5;
  const ts = String(raw._updatedAt || raw._backupAt || "");
  const t = Date.parse(ts);
  if (Number.isFinite(t)) score += t / 1e10;
  return score;
}

async function scanDillerWorkspaceCandidates(
  kv: Kv,
  dealerId: string,
): Promise<Array<{ key: string; score: number; sales: number; products: number; stores: number; firms: number }>> {
  const wsKey = dillerWorkspaceKey(dealerId);
  const prefix = dillerWorkspaceBackupPrefix(dealerId);
  const out: Array<{
    key: string;
    score: number;
    sales: number;
    products: number;
    stores: number;
    firms: number;
  }> = [];
  const ws = await kv.get(wsKey);
  const candidate = extractWorkspaceCandidate(ws);
  if (candidate && workspaceHasContent(candidate)) {
    out.push({
      key: wsKey,
      score: workspaceScore(candidate),
      sales: Array.isArray(candidate.sales) ? candidate.sales.length : 0,
      products: Array.isArray(candidate.products) ? candidate.products.length : 0,
      stores: Array.isArray(candidate.stores) ? candidate.stores.length : 0,
      firms: Array.isArray(candidate.firms) ? candidate.firms.length : 0,
    });
  }
  if (kv.getByPrefixWithKeys) {
    const rows = await kv.getByPrefixWithKeys(prefix);
    for (const row of rows) {
      const c = extractWorkspaceCandidate(row.value);
      if (!c || !workspaceHasContent(c)) continue;
      out.push({
        key: row.key,
        score: workspaceScore(c),
        sales: Array.isArray(c.sales) ? c.sales.length : 0,
        products: Array.isArray(c.products) ? c.products.length : 0,
        stores: Array.isArray(c.stores) ? c.stores.length : 0,
        firms: Array.isArray(c.firms) ? c.firms.length : 0,
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

async function restoreBestDillerWorkspace(kv: Kv, dealerId: string): Promise<{
  restored: boolean;
  sourceKey: string | null;
  stats: { sales: number; products: number; stores: number; firms: number };
  candidates: Array<{ key: string; score: number; sales: number; products: number; stores: number; firms: number }>;
}> {
  const wsKey = dillerWorkspaceKey(dealerId);
  const candidates = await scanDillerWorkspaceCandidates(kv, dealerId);
  const current = await readWorkspace(kv, dealerId);
  const currentScore = current && !workspaceNeedsBusinessRestore(current) ? workspaceScore(current) : 0;

  let bestKey: string | null = null;
  let bestData: Record<string, unknown> | null = null;
  let bestStats = { sales: 0, products: 0, stores: 0, firms: 0 };

  for (const c of candidates) {
    if (c.key === wsKey && c.score <= currentScore) continue;
    if (c.score <= currentScore) continue;
    const raw = await kv.get(c.key);
    const candidate = extractWorkspaceCandidate(raw);
    if (!candidate || !workspaceHasContent(candidate)) continue;
    bestKey = c.key;
    bestData = candidate;
    bestStats = { sales: c.sales, products: c.products, stores: c.stores, firms: c.firms };
    break;
  }

  if (!bestData || !bestKey) {
    const fromBackup = await restoreWorkspaceFromBackups(kv, dealerId);
    if (fromBackup.data) {
      const s = fromBackup.data;
      return {
        restored: true,
        sourceKey: fromBackup.sourceKey || dillerWorkspaceBackupPrefix(dealerId),
        stats: {
          sales: Array.isArray(s.sales) ? s.sales.length : 0,
          products: Array.isArray(s.products) ? s.products.length : 0,
          stores: Array.isArray(s.stores) ? s.stores.length : 0,
          firms: Array.isArray(s.firms) ? s.firms.length : 0,
        },
        candidates,
      };
    }
    return { restored: false, sourceKey: null, stats: bestStats, candidates };
  }

  const currentWs = await readWorkspace(kv, dealerId);
  const merged = { ...bestData };
  if (currentWs) {
    const curOrders = Array.isArray(currentWs.shopOrders) ? currentWs.shopOrders : [];
    const bestOrders = Array.isArray(merged.shopOrders) ? merged.shopOrders : [];
    const orderMap = new Map<string, unknown>();
    for (const o of bestOrders) {
      const id = String((o as { id?: string })?.id || "");
      if (id) orderMap.set(id, o);
    }
    for (const o of curOrders) {
      const id = String((o as { id?: string })?.id || "");
      if (id) orderMap.set(id, o);
    }
    merged.shopOrders = [...orderMap.values()];
    const curProfile = (currentWs.profile ?? {}) as Record<string, unknown>;
    const bestProfile = (merged.profile ?? {}) as Record<string, unknown>;
    merged.profile = {
      ...bestProfile,
      ...curProfile,
      orderToken: String(curProfile.orderToken || bestProfile.orderToken || ""),
    };
  }

  const updatedAt = new Date().toISOString();
  await backupWorkspaceIfNeeded(kv, dealerId, currentWs);
  await kv.set(wsKey, { ...merged, _updatedAt: updatedAt });

  return {
    restored: true,
    sourceKey: bestKey,
    stats: {
      sales: Array.isArray(merged.sales) ? merged.sales.length : 0,
      products: Array.isArray(merged.products) ? merged.products.length : 0,
      stores: Array.isArray(merged.stores) ? merged.stores.length : 0,
      firms: Array.isArray(merged.firms) ? merged.firms.length : 0,
    },
    candidates,
  };
}

function workspaceStats(raw: Record<string, unknown>) {
  return {
    sales: Array.isArray(raw.sales) ? raw.sales.length : 0,
    products: Array.isArray(raw.products) ? raw.products.length : 0,
    stores: Array.isArray(raw.stores) ? raw.stores.length : 0,
    firms: Array.isArray(raw.firms) ? raw.firms.length : 0,
    shopOrders: Array.isArray(raw.shopOrders) ? raw.shopOrders.length : 0,
    expenses: Array.isArray(raw.expenses) ? raw.expenses.length : 0,
  };
}

function parseIsoMs(iso: unknown): number | null {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? t : null;
}

function inDateRangeUz(iso: unknown, day: string): boolean {
  const t = parseIsoMs(iso);
  if (t == null) return false;
  const start = Date.parse(`${day}T00:00:00+05:00`);
  const end = Date.parse(`${day}T23:59:59.999+05:00`);
  return t >= start && t <= end;
}

async function scanDillerHistory(kv: Kv, targetDay = "2026-06-28", dealerId?: string) {
  if (!kv.getByPrefixWithKeys) {
    return { targetDay, keys: [], backups: [], matchesOnDay: [], bestOnDay: null };
  }
  const prefix = dealerId ? `diller_workspace_backup:${dealerId}:` : "diller_workspace_backup:";
  const wsPrefix = dealerId ? `diller_workspace:${dealerId}` : "diller_workspace:";
  const rows = dealerId
    ? [
        ...(await kv.getByPrefixWithKeys(`diller_workspace_backup:${dealerId}:`)),
        { key: dillerWorkspaceKey(dealerId), value: await kv.get(dillerWorkspaceKey(dealerId)) },
      ]
    : await kv.getByPrefixWithKeys("diller_");
  const backups: Array<Record<string, unknown>> = [];
  const keys: Array<Record<string, unknown>> = [];
  const matchesOnDay: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const raw = (row.value || {}) as Record<string, unknown>;
    const candidate = extractWorkspaceCandidate(row.value);
    const stats = candidate ? workspaceStats(candidate) : null;
    const updatedAt = String(raw._updatedAt || (candidate?._updatedAt ?? "") || "");
    const backupAt = String(raw._backupAt || "");
    const keyTs = row.key.startsWith(prefix)
      ? Number(row.key.slice(prefix.length)) || null
      : null;
    const keyDate = keyTs ? new Date(keyTs).toISOString() : null;
    const entry = {
      key: row.key,
      stats,
      updatedAt: updatedAt || null,
      backupAt: backupAt || null,
      keyCreatedAt: keyDate,
      onTargetDay: Boolean(
        inDateRangeUz(updatedAt, targetDay) ||
          inDateRangeUz(backupAt, targetDay) ||
          (keyTs != null && inDateRangeUz(new Date(keyTs).toISOString(), targetDay)),
      ),
    };
    keys.push(entry);
    if (row.key.startsWith(prefix) || row.key === wsPrefix) backups.push(entry);
    if (entry.onTargetDay && stats && (stats.sales > 0 || stats.products > 0 || stats.stores > 0 || stats.firms > 0)) {
      matchesOnDay.push({ ...entry, score: candidate ? workspaceScore(candidate) : 0 });
    }
  }

  backups.sort((a, b) => {
    const ta = Number(String(a.key).slice(prefix.length)) || 0;
    const tb = Number(String(b.key).slice(prefix.length)) || 0;
    return tb - ta;
  });
  keys.sort((a, b) => String(b.keyCreatedAt || b.updatedAt || "").localeCompare(String(a.keyCreatedAt || a.updatedAt || "")));

  const bestOnDay = matchesOnDay.sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || null;
  return { targetDay, totalKeys: rows.length, backups, keys: keys.slice(0, 50), matchesOnDay, bestOnDay };
}

/** QR buyurtmalardan do‘kon, mahsulot va bajarilgan sotuvlarni qayta tiklash */
function reconstructWorkspaceFromShopOrders(
  workspace: Record<string, unknown>,
): Record<string, unknown> {
  const shopOrders = Array.isArray(workspace.shopOrders) ? workspace.shopOrders : [];
  const orderToken = String(
    ((workspace.profile ?? {}) as Record<string, unknown>).orderToken ?? "",
  ).trim();

  const storeMap = new Map<string, Record<string, unknown>>();
  const productMap = new Map<string, Record<string, unknown>>();
  const sales: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  const ingestOrder = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const o = raw as Record<string, unknown>;
    const storeId = String(o.storeId || "").trim();
    if (storeId) {
      const prev = storeMap.get(storeId);
      storeMap.set(storeId, {
        id: storeId,
        name: String(o.storeName || prev?.name || "Do‘kon"),
        phone: String(o.customerPhone || prev?.phone || ""),
        address: String(o.customerAddress || prev?.address || ""),
        contactName: String(o.customerName || o.storeName || prev?.contactName || ""),
        createdAt: String(prev?.createdAt || o.createdAt || now),
      });
    }
    const items = Array.isArray(o.items) ? o.items : [];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const row = it as Record<string, unknown>;
      const pid = String(row.productId || "").trim();
      if (!pid) continue;
      productMap.set(pid, {
        id: pid,
        name: String(row.productName || "Mahsulot"),
        firmName: "",
        sku: `SKU-${pid.slice(-6)}`,
        unitPrice: Number(row.unitPrice || 0) || 0,
        buyPrice: Math.max(0, Math.round((Number(row.unitPrice || 0) || 0) * 0.85)),
        unit: String(row.unit || "dona"),
        createdAt: now,
      });
    }
    if (String(o.status || "").toLowerCase() === "done" && items.length > 0) {
      const first = items[0] as Record<string, unknown>;
      const pid = String(first.productId || "").trim();
      const sid = storeId || `store_rec_${String(o.id || "")}`;
      if (!storeId && o.storeName) {
        storeMap.set(sid, {
          id: sid,
          name: String(o.storeName || "Do‘kon"),
          phone: String(o.customerPhone || ""),
          address: String(o.customerAddress || ""),
          contactName: String(o.customerName || o.storeName || ""),
          createdAt: String(o.createdAt || now),
        });
      }
      sales.push({
        id: `sale_rec_${String(o.id || Date.now())}`,
        storeId: sid,
        storeName: String(o.storeName || storeMap.get(sid)?.name || ""),
        productId: pid,
        productName: String(first.productName || ""),
        qty: Number(first.qty || 1) || 1,
        unitPrice: Number(first.unitPrice || 0) || 0,
        total: Number(o.total || first.lineTotal || 0) || 0,
        paymentType: "naqd",
        debtAmount: 0,
        debtDueDate: "",
        createdAt: String(o.createdAt || now),
        note: "QR buyurtmadan avtomatik tiklandi",
      });
    }
  };

  for (const o of shopOrders) ingestOrder(o);

  const existingStores = Array.isArray(workspace.stores) ? workspace.stores : [];
  const existingProducts = Array.isArray(workspace.products) ? workspace.products : [];
  const existingSales = Array.isArray(workspace.sales) ? workspace.sales : [];

  const mergeById = <T extends { id?: string }>(a: T[], b: T[]) => {
    const m = new Map<string, T>();
    for (const x of a) if (x?.id) m.set(String(x.id), x);
    for (const x of b) if (x?.id) m.set(String(x.id), x);
    return [...m.values()];
  };

  const stores = mergeById(
    existingStores as { id?: string }[],
    [...storeMap.values()] as { id?: string }[],
  );
  const products = mergeById(
    existingProducts as { id?: string }[],
    [...productMap.values()] as { id?: string }[],
  );
  const saleMap = new Map<string, Record<string, unknown>>();
  for (const s of existingSales as Record<string, unknown>[]) {
    if (s?.id) saleMap.set(String(s.id), s);
  }
  for (const s of sales) saleMap.set(String(s.id), s);

  const warehouse = products.map((p) => ({
    productId: String((p as { id?: string }).id || ""),
    qty: 0,
  }));

  return {
    ...workspace,
    profile: workspace.profile ?? { companyName: "Aresso" },
    stores,
    products,
    sales: [...saleMap.values()],
    warehouse,
    shopOrders,
    _reconstructedFromOrdersAt: now,
    _reconstructedOrderToken: orderToken || null,
  };
}

function qrcodeTokenKey(token: string): string {
  return `diller_qrcode_token:${token}`;
}

async function registerQrcodeToken(kv: Kv, token: string, dealerId: string): Promise<void> {
  const t = token.trim();
  if (!t) return;
  await kv.set(qrcodeTokenKey(t), dillerWorkspaceKey(dealerId));
}

async function resolveQrcodeWorkspace(
  kv: Kv,
  urlToken: string,
): Promise<{ workspace: Record<string, unknown> | null; ok: boolean; workspaceKey?: string }> {
  const token = urlToken.trim();
  if (!token) return { workspace: null, ok: false };

  const registered = await kv.get(qrcodeTokenKey(token));
  let wsKey = typeof registered === "string" ? registered.trim() : "";

  if (!wsKey && kv.getByPrefixWithKeys) {
    const rows = await kv.getByPrefixWithKeys("diller_workspace:");
    for (const row of rows) {
      const raw = (row.value || {}) as Record<string, unknown>;
      const profile = (raw.profile ?? {}) as Record<string, unknown>;
      if (String(profile.orderToken ?? "").trim() === token) {
        wsKey = row.key;
        await kv.set(qrcodeTokenKey(token), wsKey);
        break;
      }
    }
  }

  if (!wsKey) return { workspace: null, ok: false };

  const stored = (await kv.get(wsKey)) as Record<string, unknown> | null;
  if (!stored) return { workspace: null, ok: false };

  const workspace = { ...stored };
  delete workspace._updatedAt;
  const profile = { ...((workspace.profile ?? {}) as Record<string, unknown>) };
  if (String(profile.orderToken ?? "").trim() !== token) {
    profile.orderToken = token;
    const healed = { ...workspace, profile };
    await kv.set(wsKey, { ...healed, _updatedAt: new Date().toISOString() });
    return { workspace: healed, ok: true, workspaceKey: wsKey };
  }

  return { workspace, ok: true, workspaceKey: wsKey };
}

function getDillerBrandLabel(companyName: string): string {
  const raw = companyName.trim();
  if (!raw) return "Aresso";
  if (/aresso/i.test(raw) && (/\bdiller\b/i.test(raw) || /\bmchj\b/i.test(raw))) return "Aresso";
  const cleaned = raw
    .replace(/\bdiller\s+mchj\b/gi, "")
    .replace(/\bmchj\b/gi, "")
    .replace(/\bdiller\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^aresso$/i.test(cleaned)) return "Aresso";
  return cleaned;
}

function ensureProfileOrderToken(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  const profile = { ...((incoming.profile ?? {}) as Record<string, unknown>) };
  const incomingToken = String(profile.orderToken ?? "").trim();
  const existingProfile = (existing?.profile ?? {}) as Record<string, unknown>;
  const existingToken = String(existingProfile.orderToken ?? "").trim();

  if (incomingToken) {
    profile.orderToken = incomingToken;
  } else if (existingToken) {
    profile.orderToken = existingToken;
  } else {
    profile.orderToken = `qr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  profile.companyName = getDillerBrandLabel(String(profile.companyName ?? ""));

  return profile;
}

function getWarehouseQty(warehouse: unknown[], productId: string): number {
  if (!Array.isArray(warehouse)) return 0;
  const row = warehouse.find((w) => w && typeof w === "object" && (w as { productId?: string }).productId === productId);
  return Math.max(0, Math.floor(Number((row as { qty?: number })?.qty) || 0));
}

function normalizePhoneKey(phone: string): string {
  return phone.replace(/\D/g, "").slice(-9);
}

function findStoresByPhone(stores: unknown[], phone: string): Record<string, unknown>[] {
  const key = normalizePhoneKey(phone);
  if (key.length < 9) return [];
  if (!Array.isArray(stores)) return [];
  return stores.filter((s) => {
    const row = s as Record<string, unknown>;
    return normalizePhoneKey(String(row.phone ?? "")) === key;
  }) as Record<string, unknown>[];
}

function mapStoreRow(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    address: String(row.address ?? ""),
    contactName: String(row.contactName ?? ""),
    phone: String(row.phone ?? ""),
  };
}

export function registerDillerRoutes(
  app: Hono,
  deps: {
    kv: Kv;
    validateAdminAccess: (c: unknown) => Promise<{ success: boolean; error?: string }>;
  },
) {
  const { kv, validateAdminAccess } = deps;
  registerDillerAdminRoutes(app, { kv, validateAdminAccess });

  app.post("/make-server-27d0d16c/diller/login", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const loginRaw = String(body.login ?? "").trim();
      const password = String(body.password ?? "");
      if (!loginRaw || !password) {
        return c.json({ success: false, error: "Login va parol majburiy" }, 400);
      }

      const account = await findDillerByLogin(kv, loginRaw);
      if (!account || !(await verifyDillerPasswordAsync(account, password))) {
        return c.json({ success: false, error: "Login yoki parol noto‘g‘ri" }, 401);
      }

      const token = `diller_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      const session: DillerSession = {
        token,
        dealerId: account.id,
        login: account.login,
        displayName: account.fullName,
        expiresAt: Date.now() + SESSION_TTL_MS,
        createdAt: new Date().toISOString(),
      };
      await kv.set(dillerSessionKey(token), session);

      return c.json({
        success: true,
        token,
        dealerId: account.id,
        login: session.login,
        displayName: session.displayName,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/login]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  app.get("/make-server-27d0d16c/diller/session", async (c) => {
    const sess = await resolveDillerSession(c, kv);
    if (!sess) {
      return c.json({ success: false, error: "Sessiya tugagan yoki noto‘g‘ri" }, 401);
    }
    return c.json({
      success: true,
      dealerId: sess.dealerId,
      login: sess.login,
      displayName: sess.displayName,
    });
  });

  app.get("/make-server-27d0d16c/diller/data", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) {
        return c.json({ success: false, error: "Avval tizimga kiring" }, 401);
      }
      const dealerId = sess.dealerId;
      const wsKey = dillerWorkspaceKey(dealerId);
      let stored = (await kv.get(wsKey)) as Record<string, unknown> | null;
      let restoredFromBackup = false;
      let restoredSourceKey: string | null = null;
      if (workspaceNeedsBusinessRestore(stored)) {
        const restored = await restoreWorkspaceFromBackups(kv, dealerId);
        if (restored.data) {
          stored = { ...restored.data, _updatedAt: restored.updatedAt };
          restoredFromBackup = true;
          restoredSourceKey = restored.sourceKey || null;
        } else {
          const best = await restoreBestDillerWorkspace(kv, dealerId);
          if (best.restored) {
            stored = (await kv.get(wsKey)) as Record<string, unknown> | null;
            restoredFromBackup = true;
            restoredSourceKey = best.sourceKey;
          }
        }
        if (stored && workspaceNeedsBusinessRestore(stored)) {
          const profile = (stored.profile ?? {}) as Record<string, unknown>;
          const orderToken = String(profile.orderToken ?? "").trim();
          const shopOrders = Array.isArray(stored.shopOrders) ? stored.shopOrders : [];
          let kvOrders: unknown[] = [];
          if (orderToken) {
            const list = (await kv.get(shopOrdersKey(orderToken))) as unknown[] | null;
            kvOrders = Array.isArray(list) ? list : [];
          }
          if (shopOrders.length > 0 || kvOrders.length > 0) {
            const mergedOrders = new Map<string, unknown>();
            for (const o of shopOrders) {
              const id = String((o as { id?: string })?.id || "");
              if (id) mergedOrders.set(id, o);
            }
            for (const o of kvOrders) {
              const id = String((o as { id?: string })?.id || "");
              if (id) mergedOrders.set(id, o);
            }
            stored = reconstructWorkspaceFromShopOrders({
              ...stored,
              shopOrders: [...mergedOrders.values()],
            });
            const updatedAt = new Date().toISOString();
            await kv.set(wsKey, { ...stored, _updatedAt: updatedAt });
            restoredFromBackup = true;
            restoredSourceKey = "shop_orders_reconstruct";
          }
        }
      }
      const updatedAt = stored && typeof stored._updatedAt === "string"
        ? stored._updatedAt
        : null;
      const data = stored ? { ...stored } : null;
      if (data && "_updatedAt" in data) {
        delete data._updatedAt;
      }
      return c.json({
        success: true,
        data,
        updatedAt,
        dealerId,
        restoredFromBackup,
        restoredSourceKey,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/data GET]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/diller/reconstruct-from-orders", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) {
        return c.json({ success: false, error: "Avval tizimga kiring" }, 401);
      }
      const dealerId = sess.dealerId;
      const wsKey = dillerWorkspaceKey(dealerId);
      const current = (await kv.get(wsKey)) as Record<string, unknown> | null;
      const base = current ? { ...current } : {};
      const profile = (base.profile ?? {}) as Record<string, unknown>;
      const orderToken = String(profile.orderToken ?? "").trim();
      if (orderToken) {
        const kvOrders = (await kv.get(shopOrdersKey(orderToken))) as unknown[] | null;
        if (Array.isArray(kvOrders) && kvOrders.length > 0) {
          const mergedOrders = new Map<string, unknown>();
          for (const o of Array.isArray(base.shopOrders) ? base.shopOrders : []) {
            const id = String((o as { id?: string })?.id || "");
            if (id) mergedOrders.set(id, o);
          }
          for (const o of kvOrders) {
            const id = String((o as { id?: string })?.id || "");
            if (id) mergedOrders.set(id, o);
          }
          base.shopOrders = [...mergedOrders.values()];
        }
      }
      const reconstructed = reconstructWorkspaceFromShopOrders(base);
      const updatedAt = new Date().toISOString();
      await backupWorkspaceIfNeeded(kv, dealerId, current);
      await kv.set(wsKey, { ...reconstructed, _updatedAt: updatedAt });
      const stats = {
        sales: Array.isArray(reconstructed.sales) ? reconstructed.sales.length : 0,
        products: Array.isArray(reconstructed.products) ? reconstructed.products.length : 0,
        stores: Array.isArray(reconstructed.stores) ? reconstructed.stores.length : 0,
        shopOrders: Array.isArray(reconstructed.shopOrders) ? reconstructed.shopOrders.length : 0,
      };
      return c.json({ success: true, stats, workspace: reconstructed });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/reconstruct-from-orders]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/diller/restore-best", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) {
        return c.json({ success: false, error: "Avval tizimga kiring" }, 401);
      }
      const dealerId = sess.dealerId;
      const result = await restoreBestDillerWorkspace(kv, dealerId);
      const workspace = await readWorkspace(kv, dealerId);
      return c.json({
        success: true,
        restored: result.restored,
        sourceKey: result.sourceKey,
        stats: result.stats,
        candidates: result.candidates.slice(0, 20),
        workspace,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/restore-best]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  app.post("/make-server-27d0d16c/diller/scan-history", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) {
        return c.json({ success: false, error: "Avval tizimga kiring" }, 401);
      }
      const body = await c.req.json().catch(() => ({}));
      const day = String(body?.day || "2026-06-28").trim();
      const scan = await scanDillerHistory(kv, day, sess.dealerId);
      return c.json({ success: true, ...scan });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/scan-history]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  app.put("/make-server-27d0d16c/diller/data", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) {
        return c.json({ success: false, error: "Avval tizimga kiring" }, 401);
      }
      const dealerId = sess.dealerId;
      const wsKey = dillerWorkspaceKey(dealerId);
      const body = await c.req.json().catch(() => ({}));
      const data = body?.data;
      if (!data || typeof data !== "object") {
        return c.json({ success: false, error: "data majburiy" }, 400);
      }
      const existing = await readWorkspace(kv, dealerId);
      await backupWorkspaceIfNeeded(kv, dealerId, existing);
      const payload = { ...(data as Record<string, unknown>) };
      if (workspaceHasContent(existing) && !workspaceHasContent(payload)) {
        return c.json({
          success: false,
          error: "Bo‘sh ma’lumot mavjud bulut ustiga yozilmaydi",
        }, 409);
      }
      payload.profile = ensureProfileOrderToken(payload, existing);
      const updatedAt = new Date().toISOString();
      await kv.set(wsKey, { ...payload, _updatedAt: updatedAt });
      const orderToken = String((payload.profile as Record<string, unknown>).orderToken ?? "").trim();
      if (orderToken) {
        await registerQrcodeToken(kv, orderToken, dealerId);
      }
      return c.json({ success: true, updatedAt, orderToken: orderToken || null });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/data PUT]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  /** Public — telefon bo‘yicha do‘kon qidirish */
  app.get("/make-server-27d0d16c/public/qrcode/:token/store", async (c) => {
    try {
      const token = String(c.req.param("token") ?? "").trim();
      const phone = String(c.req.query("phone") ?? "").trim();
      if (!token) return c.json({ success: false, error: "Token yo‘q" }, 400);
      if (phone.replace(/\D/g, "").length < 9) {
        return c.json({ success: true, store: null, stores: [] });
      }

      const resolved = await resolveQrcodeWorkspace(kv, token);
      if (!resolved.ok || !resolved.workspace) {
        return c.json({ success: false, error: "Buyurtma havolasi topilmadi" }, 404);
      }

      const stores = Array.isArray(resolved.workspace.stores) ? resolved.workspace.stores : [];
      const rows = findStoresByPhone(stores, phone);
      if (rows.length === 0) return c.json({ success: true, store: null, stores: [] });

      const mapped = rows.map(mapStoreRow);
      return c.json({
        success: true,
        store: mapped[0],
        stores: mapped,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  /** Public — QR buyurtma katalogi */
  app.get("/make-server-27d0d16c/public/qrcode/:token", async (c) => {
    try {
      const token = String(c.req.param("token") ?? "").trim();
      if (!token) return c.json({ success: false, error: "Token yo‘q" }, 400);

      const resolved = await resolveQrcodeWorkspace(kv, token);
      if (!resolved.ok || !resolved.workspace) {
        return c.json({ success: false, error: "Buyurtma havolasi topilmadi" }, 404);
      }
      const workspace = resolved.workspace;
      const profile = (workspace.profile ?? {}) as Record<string, unknown>;

      const products = Array.isArray(workspace.products) ? workspace.products : [];
      const warehouse = Array.isArray(workspace?.warehouse) ? workspace.warehouse : [];

      const catalog = products.map((p) => {
        const row = p as Record<string, unknown>;
        const id = String(row.id ?? "");
        const stock = getWarehouseQty(warehouse, id);
        return {
          id,
          name: String(row.name ?? ""),
          unitPrice: Math.round(Number(row.unitPrice) || 0),
          unit: String(row.unit ?? "dona"),
          stock,
          imageUrl: row.qrcodeImageUrl ? String(row.qrcodeImageUrl).trim() : undefined,
        };
      }).filter((p) => p.id && p.name && p.stock > 0);

      return c.json({
        success: true,
        companyName: getDillerBrandLabel(String(profile.companyName ?? "")),
        phone: String(profile.orderPhone ?? profile.phone ?? ""),
        telegram: String(profile.telegram ?? ""),
        instagram: String(profile.instagram ?? ""),
        products: catalog,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[public/qrcode GET]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  /** Public — buyurtma yuborish */
  app.post("/make-server-27d0d16c/public/qrcode/:token/orders", async (c) => {
    try {
      const token = String(c.req.param("token") ?? "").trim();
      if (!token) return c.json({ success: false, error: "Token yo‘q" }, 400);

      const resolved = await resolveQrcodeWorkspace(kv, token);
      if (!resolved.ok || !resolved.workspace) {
        return c.json({ success: false, error: "Buyurtma havolasi topilmadi" }, 404);
      }
      const workspace = resolved.workspace;
      const profile = (workspace.profile ?? {}) as Record<string, unknown>;

      const body = await c.req.json().catch(() => ({}));
      const customerName = String(body.customerName ?? "").trim();
      const customerPhone = String(body.customerPhone ?? "").trim();
      const note = String(body.note ?? "").trim();
      const storeId = String(body.storeId ?? "").trim();
      const itemsRaw = Array.isArray(body.items) ? body.items : [];

      if (!customerName) return c.json({ success: false, error: "Ism kiriting" }, 400);
      if (customerPhone.replace(/\D/g, "").length < 9) {
        return c.json({ success: false, error: "Telefon raqam noto‘g‘ri" }, 400);
      }
      if (itemsRaw.length === 0) return c.json({ success: false, error: "Mahsulot tanlang" }, 400);

      const products = Array.isArray(workspace.products) ? workspace.products : [];
      const warehouse = Array.isArray(workspace.warehouse) ? workspace.warehouse : [];
      const stores = Array.isArray(workspace.stores) ? workspace.stores : [];

      const items: ShopOrderItem[] = [];
      for (const raw of itemsRaw) {
        const productId = String(raw?.productId ?? "");
        const qty = Math.max(1, Math.floor(Number(raw?.qty) || 1));
        const product = products.find((p) => (p as { id?: string }).id === productId) as Record<string, unknown> | undefined;
        if (!product) continue;
        const stock = getWarehouseQty(warehouse, productId);
        if (stock <= 0) continue;
        const unitPrice = Math.round(Number(product.unitPrice) || 0);
        const finalQty = Math.min(qty, stock);
        items.push({
          productId,
          productName: String(product.name ?? ""),
          qty: finalQty,
          unitPrice,
          lineTotal: unitPrice * finalQty,
          unit: String(product.unit ?? "dona"),
        });
      }

      if (items.length === 0) {
        return c.json({ success: false, error: "Tanlangan mahsulotlar omborda yo‘q" }, 400);
      }

      let finalName = customerName;
      let storeName: string | undefined;
      let customerAddress: string | undefined;
      let linkedStoreId: string | undefined;

      if (storeId) {
        const store = stores.find((s) => (s as { id?: string }).id === storeId) as Record<string, unknown> | undefined;
        if (store) {
          linkedStoreId = storeId;
          storeName = String(store.name ?? "").trim();
          customerAddress = String(store.address ?? "").trim();
          if (storeName) finalName = storeName;
        }
      }

      const order: ShopOrder = {
        id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        customerName: finalName,
        customerPhone,
        items,
        total: items.reduce((s, it) => s + it.lineTotal, 0),
        note,
        status: "pending",
        createdAt: new Date().toISOString(),
        storeId: linkedStoreId,
        storeName,
        customerAddress,
      };

      const key = shopOrdersKey(token);
      const existing = (await kv.get(key)) as ShopOrder[] | null;
      const list = Array.isArray(existing) ? existing : [];
      list.unshift(order);
      await kv.set(key, list.slice(0, 500));

      void sendDillerQrcodeOrderNotification({
        companyName: getDillerBrandLabel(String(profile.companyName ?? "")),
        orderId: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        storeName: order.storeName,
        items: order.items,
        total: order.total,
        note: order.note,
        createdAt: order.createdAt,
      }).catch((err) => {
        console.error("[diller/qrcode telegram]", err);
      });

      return c.json({ success: true, order });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[public/qrcode POST]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  /** Diller — buyurtmalar ro‘yxati */
  app.get("/make-server-27d0d16c/diller/orders", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) return c.json({ success: false, error: "Avval tizimga kiring" }, 401);

      const workspace = await readWorkspace(kv, sess.dealerId);
      const profile = (workspace?.profile ?? {}) as Record<string, unknown>;
      const orderToken = String(profile.orderToken ?? "").trim();
      if (!orderToken) {
        return c.json({ success: true, orders: [] });
      }

      const list = (await kv.get(shopOrdersKey(orderToken))) as ShopOrder[] | null;
      return c.json({
        success: true,
        orders: Array.isArray(list) ? list : [],
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  /** Diller — buyurtma holati */
  app.patch("/make-server-27d0d16c/diller/orders/:orderId", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) return c.json({ success: false, error: "Avval tizimga kiring" }, 401);

      const orderId = String(c.req.param("orderId") ?? "").trim();
      const body = await c.req.json().catch(() => ({}));
      const status = String(body.status ?? "").trim();
      if (!["pending", "accepted", "rejected", "done"].includes(status)) {
        return c.json({ success: false, error: "Holat noto‘g‘ri" }, 400);
      }

      const workspace = await readWorkspace(kv, sess.dealerId);
      const profile = (workspace?.profile ?? {}) as Record<string, unknown>;
      const orderToken = String(profile.orderToken ?? "").trim();
      if (!orderToken) return c.json({ success: false, error: "Token yo‘q" }, 404);

      const key = shopOrdersKey(orderToken);
      const list = (await kv.get(key)) as ShopOrder[] | null;
      if (!Array.isArray(list)) return c.json({ success: false, error: "Buyurtma topilmadi" }, 404);

      const idx = list.findIndex((o) => o.id === orderId);
      if (idx < 0) return c.json({ success: false, error: "Buyurtma topilmadi" }, 404);

      list[idx] = { ...list[idx], status: status as ShopOrder["status"] };
      await kv.set(key, list);

      return c.json({ success: true, order: list[idx] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  /**
   * Diller — xarid informatsion SMS (Eskiz shablon: purchase_info).
   * Faqat tranzaksion matn; reklama iboralari yuborilmasin.
   */
  app.post("/make-server-27d0d16c/diller/sms/purchase", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) return c.json({ success: false, error: "Avval tizimga kiring" }, 401);

      if (!eskiz.isEskizConfigured()) {
        return c.json({ success: false, error: "SMS xizmati sozlanmagan" }, 503);
      }

      const body = await c.req.json().catch(() => ({}));
      const phoneRaw = String(body.phone ?? "").trim();
      const phone = normalizeUzSmsPhone(phoneRaw);
      if (!phone) {
        return c.json(
          { success: false, error: "Telefon raqam noto‘g‘ri (masalan: 998901234567)" },
          400,
        );
      }

      let message = String(body.message ?? "").trim();
      if (!message && body.vars && typeof body.vars === "object") {
        const tmpl = String(body.template || "purchase_info").trim() || "purchase_info";
        message = buildSmsFromTemplateAndVars(tmpl, body.vars as Record<string, unknown>);
      }
      if (!message) {
        return c.json({ success: false, error: "SMS matni kerak" }, 400);
      }
      if (message.length > 700) {
        return c.json({ success: false, error: "SMS matni juda uzun" }, 400);
      }

      const lower = message.toLowerCase();
      const banned = ["aksiya", "yana xarid", "yana buyurtma", "eng yaxshi narx"];
      if (banned.some((w) => lower.includes(w))) {
        return c.json(
          { success: false, error: "SMS matnida reklama iboralari bo‘lishi mumkin emas" },
          400,
        );
      }

      const res = await eskiz.sendCustomSMS(phone, message);
      if (!res.success) {
        return c.json(
          {
            success: false,
            error:
              res.error ||
              "SMS yuborilmadi. Eskiz’da tegishli shablonni (purchase_info / debt_*) tasdiqlatganingizni tekshiring.",
          },
          502,
        );
      }

      return c.json({
        success: true,
        messageId: res.messageId,
        phone,
        template: String(body.template || "purchase_info").trim() || "purchase_info",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/sms/purchase]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });
}
