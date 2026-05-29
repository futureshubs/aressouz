import { Hono } from "npm:hono";
import webpush from "npm:web-push@3.6.7";
import * as kv from "./kv_store.tsx";

const VAPID_PUBLIC = String(Deno.env.get("VAPID_PUBLIC_KEY") || "").trim();
const VAPID_PRIVATE = String(Deno.env.get("VAPID_PRIVATE_KEY") || "").trim();
const VAPID_SUBJECT = String(Deno.env.get("VAPID_SUBJECT") || "mailto:support@aresso.app").trim();

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return VAPID_PUBLIC.length > 0 && VAPID_PRIVATE.length > 0;
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
    return true;
  }
  return false;
}

function subKey(panel: string, scopeId: string) {
  return `panel_push_sub:${panel}:${scopeId}`;
}

type PushSub = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  updatedAt?: string;
};

type PanelPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPanelPush(
  panel: string,
  scopeId: string,
  payload: PanelPushPayload,
): Promise<number> {
  if (!ensureVapid()) return 0;
  const sid = String(scopeId || "").trim();
  if (!sid) return 0;

  const raw = await kv.get(subKey(panel, sid));
  const list: PushSub[] = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return 0;

  const body = JSON.stringify({
    title: String(payload.title || "ARESSO").slice(0, 64),
    body: String(payload.body || "").slice(0, 200),
    url: String(payload.url || "/").slice(0, 256),
    tag: String(payload.tag || `panel-${panel}`).slice(0, 64),
  });

  let sent = 0;
  const kept: PushSub[] = [];

  for (const sub of list) {
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) continue;
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        } as webpush.PushSubscription,
        body,
      );
      sent++;
      kept.push(sub);
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) continue;
      kept.push(sub);
    }
  }

  if (kept.length !== list.length) {
    await kv.set(subKey(panel, sid), kept);
  }

  return sent;
}

/** Bir nechta scope (masalan filial + kassa bir branchId) */
export async function sendPanelPushMany(
  targets: Array<{ panel: string; scopeId: string }>,
  payload: PanelPushPayload,
): Promise<void> {
  const seen = new Set<string>();
  for (const t of targets) {
    const k = `${t.panel}:${t.scopeId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    await sendPanelPush(t.panel, t.scopeId, payload);
  }
}

export async function notifyNewOrderPanels(order: Record<string, unknown>): Promise<void> {
  const orderNumber = String(order.orderNumber || order.id || "").trim();
  const orderType = String(order.orderType || order.type || "").toLowerCase();
  const body = orderNumber
    ? `Buyurtma #${orderNumber}${orderType ? ` (${orderType})` : ""}`
    : "Yangi buyurtma";

  const targets: Array<{ panel: string; scopeId: string }> = [];
  const branchId = String(order.branchId || "").trim();
  const shopId = String(order.shopId || "").trim();
  const restaurantId = String(order.restaurantId || "").trim();

  if (branchId) {
    targets.push({ panel: "filial", scopeId: branchId });
    targets.push({ panel: "kassa", scopeId: branchId });
  }
  if (shopId) targets.push({ panel: "seller", scopeId: shopId });
  if (restaurantId) targets.push({ panel: "taom", scopeId: restaurantId });

  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const isCash =
    String(order.paymentMethod || "").toLowerCase().includes("cash") ||
    String(order.paymentMethod || "").toLowerCase().includes("naqd");

  if (branchId && (orderType === "market" || orderType === "shop") && paymentStatus === "paid" && !isCash) {
    targets.push({ panel: "tayyorlovchi", scopeId: branchId });
  }

  const panelUrl: Record<string, string> = {
    filial: "/filyal/dashboard",
    kassa: "/kassa/dashboard",
    seller: "/seller/dashboard",
    taom: "/restaurant/panel",
    tayyorlovchi: "/tayyorlovchi",
  };

  for (const t of targets) {
    await sendPanelPush(t.panel, t.scopeId, {
      title: "Yangi buyurtma",
      body,
      url: panelUrl[t.panel] || "/",
      tag: `order-${order.id || orderNumber}`,
    });
  }
}

export async function notifyPreparerBranch(branchId: string, body: string): Promise<void> {
  const bid = String(branchId || "").trim();
  if (!bid) return;
  await sendPanelPush("tayyorlovchi", bid, {
    title: "Tayyorlovchi — yangi buyurtma",
    body: body.slice(0, 200),
    url: "/tayyorlovchi",
    tag: `prep-${Date.now()}`,
  });
}

export async function notifyCourierBranch(branchId: string, body: string): Promise<void> {
  const bid = String(branchId || "").trim();
  if (!bid) return;
  await sendPanelPush("kuryer", bid, {
    title: "Kuryer — yangi buyurtma",
    body: body.slice(0, 200),
    url: "/kuryer/dashboard",
    tag: `courier-${Date.now()}`,
  });
}

const panelPush = new Hono();

panelPush.get("/vapid-public-key", (c) => {
  return c.json({
    success: true,
    publicKey: VAPID_PUBLIC || null,
    enabled: Boolean(VAPID_PUBLIC && VAPID_PRIVATE),
  });
});

panelPush.post("/subscribe", async (c) => {
  try {
    const data = await c.req.json();
    const panel = String(data?.panel || "").trim();
    const scopeId = String(data?.scopeId || "").trim();
    const sub = data?.subscription;
    if (!panel || !scopeId || !sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return c.json({ success: false, error: "panel, scopeId va subscription kerak" }, 400);
    }

    const key = subKey(panel, scopeId);
    const raw = await kv.get(key);
    const list: PushSub[] = Array.isArray(raw) ? raw : [];
    const entry: PushSub = {
      endpoint: String(sub.endpoint),
      keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
      updatedAt: new Date().toISOString(),
    };
    const next = [entry, ...list.filter((x) => x.endpoint !== entry.endpoint)].slice(0, 12);
    await kv.set(key, next);

    const branchId = String(data?.branchId || "").trim();
    if (branchId && branchId !== scopeId) {
      await kv.set(subKey(panel, branchId), next);
    }

    return c.json({ success: true, count: next.length });
  } catch (e) {
    return c.json({ success: false, error: String((e as Error)?.message || e) }, 500);
  }
});

panelPush.post("/unsubscribe", async (c) => {
  try {
    const data = await c.req.json();
    const panel = String(data?.panel || "").trim();
    const scopeId = String(data?.scopeId || "").trim();
    const endpoint = String(data?.endpoint || data?.subscription?.endpoint || "").trim();
    if (!panel || !scopeId) return c.json({ success: false, error: "panel va scopeId kerak" }, 400);

    const key = subKey(panel, scopeId);
    const raw = await kv.get(key);
    const list: PushSub[] = Array.isArray(raw) ? raw : [];
    const next = endpoint ? list.filter((x) => x.endpoint !== endpoint) : [];
    await kv.set(key, next);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, error: String((e as Error)?.message || e) }, 500);
  }
});

export default panelPush;

export function registerPanelPushRoutes(app: Hono) {
  app.route("/make-server-27d0d16c/push", panelPush);
}
