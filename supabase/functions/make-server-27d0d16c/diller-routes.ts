import type { Hono } from "npm:hono";

const DILLER_LOGIN = (Deno.env.get("DILLER_PANEL_LOGIN") || "Admin").trim();
const DILLER_PASSWORD = String(Deno.env.get("DILLER_PANEL_PASSWORD") || "Admin123");
const WORKSPACE_KEY = "diller_workspace:v1";
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

type Kv = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
};

type DillerSession = {
  token: string;
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

function credentialsOk(login: string, password: string): boolean {
  return login.trim().toLowerCase() === DILLER_LOGIN.toLowerCase() && password === DILLER_PASSWORD;
}

async function resolveDillerSession(c: {
  req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined };
}, kv: Kv): Promise<DillerSession | null> {
  const token = readDillerToken(c);
  if (!token) return null;
  const raw = (await kv.get(dillerSessionKey(token))) as DillerSession | null;
  if (!raw?.token || !raw.expiresAt || raw.expiresAt < Date.now()) {
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

async function readWorkspace(kv: Kv): Promise<Record<string, unknown> | null> {
  const stored = (await kv.get(WORKSPACE_KEY)) as Record<string, unknown> | null;
  if (!stored) return null;
  const data = { ...stored };
  delete data._updatedAt;
  return data;
}

function qrcodeTokenKey(token: string): string {
  return `diller_qrcode_token:${token}`;
}

async function registerQrcodeToken(kv: Kv, token: string): Promise<void> {
  const t = token.trim();
  if (!t) return;
  await kv.set(qrcodeTokenKey(t), WORKSPACE_KEY);
}

async function resolveQrcodeWorkspace(
  kv: Kv,
  urlToken: string,
): Promise<{ workspace: Record<string, unknown> | null; ok: boolean }> {
  const token = urlToken.trim();
  if (!token) return { workspace: null, ok: false };

  const workspace = await readWorkspace(kv);
  if (!workspace) return { workspace: null, ok: false };

  const profile = { ...((workspace.profile ?? {}) as Record<string, unknown>) };
  const profileToken = String(profile.orderToken ?? "").trim();

  if (profileToken === token) {
    return { workspace, ok: true };
  }

  const registered = await kv.get(qrcodeTokenKey(token));
  if (registered === WORKSPACE_KEY) {
    profile.orderToken = token;
    const healed = { ...workspace, profile };
    await kv.set(WORKSPACE_KEY, { ...healed, _updatedAt: new Date().toISOString() });
    return { workspace: healed, ok: true };
  }

  return { workspace, ok: false };
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

  return profile;
}

function getWarehouseQty(warehouse: unknown[], productId: string): number {
  if (!Array.isArray(warehouse)) return 0;
  const row = warehouse.find((w) => w && typeof w === "object" && (w as { productId?: string }).productId === productId);
  return Math.max(0, Math.floor(Number((row as { qty?: number })?.qty) || 0));
}

export function registerDillerRoutes(app: Hono, deps: { kv: Kv }) {
  const { kv } = deps;

  app.post("/make-server-27d0d16c/diller/login", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const loginRaw = String(body.login ?? "").trim();
      const password = String(body.password ?? "");
      if (!loginRaw || !password) {
        return c.json({ success: false, error: "Login va parol majburiy" }, 400);
      }
      if (!credentialsOk(loginRaw, password)) {
        return c.json({ success: false, error: "Login yoki parol noto‘g‘ri" }, 401);
      }

      const token = `diller_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      const session: DillerSession = {
        token,
        login: DILLER_LOGIN,
        displayName: loginRaw || DILLER_LOGIN,
        expiresAt: Date.now() + SESSION_TTL_MS,
        createdAt: new Date().toISOString(),
      };
      await kv.set(dillerSessionKey(token), session);

      return c.json({
        success: true,
        token,
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
      const stored = (await kv.get(WORKSPACE_KEY)) as Record<string, unknown> | null;
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
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/data GET]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });

  app.put("/make-server-27d0d16c/diller/data", async (c) => {
    try {
      const sess = await resolveDillerSession(c, kv);
      if (!sess) {
        return c.json({ success: false, error: "Avval tizimga kiring" }, 401);
      }
      const body = await c.req.json().catch(() => ({}));
      const data = body?.data;
      if (!data || typeof data !== "object") {
        return c.json({ success: false, error: "data majburiy" }, 400);
      }
      const existing = await readWorkspace(kv);
      const payload = { ...(data as Record<string, unknown>) };
      payload.profile = ensureProfileOrderToken(payload, existing);
      const updatedAt = new Date().toISOString();
      await kv.set(WORKSPACE_KEY, { ...payload, _updatedAt: updatedAt });
      const orderToken = String((payload.profile as Record<string, unknown>).orderToken ?? "").trim();
      if (orderToken) {
        await registerQrcodeToken(kv, orderToken);
      }
      return c.json({ success: true, updatedAt, orderToken: orderToken || null });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/data PUT]", msg);
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
        };
      }).filter((p) => p.id && p.name && p.stock > 0);

      return c.json({
        success: true,
        companyName: String(profile.companyName ?? ""),
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
      const itemsRaw = Array.isArray(body.items) ? body.items : [];

      if (!customerName) return c.json({ success: false, error: "Ism kiriting" }, 400);
      if (customerPhone.replace(/\D/g, "").length < 9) {
        return c.json({ success: false, error: "Telefon raqam noto‘g‘ri" }, 400);
      }
      if (itemsRaw.length === 0) return c.json({ success: false, error: "Mahsulot tanlang" }, 400);

      const products = Array.isArray(workspace.products) ? workspace.products : [];
      const warehouse = Array.isArray(workspace.warehouse) ? workspace.warehouse : [];

      const items: ShopOrderItem[] = [];
      for (const raw of itemsRaw) {
        const productId = String(raw?.productId ?? "");
        const qty = Math.max(1, Math.floor(Number(raw?.qty) || 1));
        const product = products.find((p) => (p as { id?: string }).id === productId) as Record<string, unknown> | undefined;
        if (!product) continue;
        const stock = getWarehouseQty(warehouse, productId);
        if (stock <= 0) continue;
        const unitPrice = Math.round(Number(product.unitPrice) || 0);
        items.push({
          productId,
          productName: String(product.name ?? ""),
          qty: Math.min(qty, stock),
          unitPrice,
          lineTotal: unitPrice * Math.min(qty, stock),
        });
      }

      if (items.length === 0) {
        return c.json({ success: false, error: "Tanlangan mahsulotlar omborda yo‘q" }, 400);
      }

      const order: ShopOrder = {
        id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        customerName,
        customerPhone,
        items,
        total: items.reduce((s, it) => s + it.lineTotal, 0),
        note,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      const key = shopOrdersKey(token);
      const existing = (await kv.get(key)) as ShopOrder[] | null;
      const list = Array.isArray(existing) ? existing : [];
      list.unshift(order);
      await kv.set(key, list.slice(0, 500));

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

      const workspace = await readWorkspace(kv);
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

      const workspace = await readWorkspace(kv);
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
}
