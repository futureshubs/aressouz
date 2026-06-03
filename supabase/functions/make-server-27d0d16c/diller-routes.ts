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

function dillerSessionKey(token: string): string {
  return `diller_session:${token}`;
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
      const updatedAt = new Date().toISOString();
      await kv.set(WORKSPACE_KEY, { ...data, _updatedAt: updatedAt });
      return c.json({ success: true, updatedAt });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[diller/data PUT]", msg);
      return c.json({ success: false, error: msg || "Xatolik" }, 500);
    }
  });
}
