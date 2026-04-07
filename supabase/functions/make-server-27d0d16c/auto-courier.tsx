import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { isValidTelegramTarget } from "./telegram.tsx";

const app = new Hono();

function key(id: string) {
  return `auto_courier:${id}`;
}

function sessionKey(token: string) {
  return `auto_courier_session:${token}`;
}

async function resolveSession(c: any): Promise<{ courierId: string; branchId: string } | null> {
  const token =
    c.req.header("X-Auto-Courier-Token") ||
    c.req.header("x-auto-courier-token") ||
    c.req.query("token") ||
    "";
  if (!token) return null;
  const s = await kv.get(sessionKey(String(token).trim()));
  if (!s || Date.now() > Number(s.expiresAt || 0)) return null;
  const courierId = String(s.courierId || "").trim();
  const branchId = String(s.branchId || "").trim();
  if (!courierId || !branchId) return null;
  const row = await kv.get(key(courierId));
  if (!row || row.deleted || String(row.status) !== "active") return null;
  return { courierId, branchId };
}

/** Filial: avto-kuryerlar ro‘yxati */
app.get("/auto-couriers", async (c) => {
  try {
    const branchId = String(c.req.query("branchId") || "").trim();
    if (!branchId) return c.json({ success: false, error: "branchId kerak" }, 400);
    const all = (await kv.getByPrefix("auto_courier:")) || [];
    const list = all
      .filter((x: any) => x && !x.deleted && String(x.branchId) === branchId)
      .map((x: any) => ({
        ...x,
        password: undefined,
      }));
    list.sort(
      (a: any, b: any) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
    return c.json({ success: true, couriers: list });
  } catch (e: any) {
    console.error("auto-couriers GET", e);
    return c.json({ success: false, error: e?.message || "xato" }, 500);
  }
});

app.post("/auto-couriers", async (c) => {
  try {
    const body = await c.req.json();
    const branchId = String(body.branchId || "").trim();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const phone = String(body.phone || "").trim();
    const login = String(body.login || "").trim();
    const password = String(body.password || "").trim();
    const vehiclePlate = String(body.vehiclePlate || "").trim();
    const vehicleBrand = String(body.vehicleBrand || "").trim();

    if (!branchId || !firstName || !phone || !login || !password || !vehiclePlate) {
      return c.json(
        {
          success: false,
          error:
            "branchId, firstName, phone, login, password, vehiclePlate majburiy",
        },
        400,
      );
    }

    const dup = (await kv.getByPrefix("auto_courier:")) || [];
    if (dup.some((x: any) => x && !x.deleted && String(x.login) === login)) {
      return c.json({ success: false, error: "Bu login band" }, 400);
    }

    const id = `ac_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const telegramChatId = String(body.telegramChatId || "").trim();
    const row = {
      id,
      branchId,
      firstName,
      lastName,
      birthDate: String(body.birthDate || "").trim(),
      gender: String(body.gender || "").trim(),
      phone,
      vehiclePlate,
      vehicleBrand,
      vehicleWidthM: Math.max(0, Number(body.vehicleWidthM) || 0),
      login,
      password,
      telegramChatId: isValidTelegramTarget(telegramChatId) ? telegramChatId : "",
      status: "active",
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };
    await kv.set(key(id), row);
    return c.json({
      success: true,
      courier: { ...row, password: undefined },
    });
  } catch (e: any) {
    console.error("auto-couriers POST", e);
    return c.json({ success: false, error: e?.message || "xato" }, 500);
  }
});

app.put("/auto-couriers/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(key(id));
    if (!existing || existing.deleted) {
      return c.json({ success: false, error: "Topilmadi" }, 404);
    }
    if (body.branchId && String(body.branchId) !== String(existing.branchId)) {
      return c.json({ success: false, error: "Filial mos emas" }, 403);
    }
    if (body.login && String(body.login) !== String(existing.login)) {
      const dup = (await kv.getByPrefix("auto_courier:")) || [];
      if (dup.some((x: any) => x && !x.deleted && x.id !== id && String(x.login) === String(body.login))) {
        return c.json({ success: false, error: "Bu login band" }, 400);
      }
    }
    const telegramChatId =
      body.telegramChatId !== undefined
        ? String(body.telegramChatId || "").trim()
        : String(existing.telegramChatId || "").trim();
    const next = {
      ...existing,
      ...body,
      id,
      branchId: existing.branchId,
      telegramChatId: isValidTelegramTarget(telegramChatId) ? telegramChatId : "",
      password: body.password !== undefined && body.password !== ""
        ? String(body.password)
        : existing.password,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(key(id), next);
    return c.json({ success: true, courier: { ...next, password: undefined } });
  } catch (e: any) {
    console.error("auto-couriers PUT", e);
    return c.json({ success: false, error: e?.message || "xato" }, 500);
  }
});

app.delete("/auto-couriers/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const branchId = String(c.req.query("branchId") || "").trim();
    const existing = await kv.get(key(id));
    if (!existing || existing.deleted) {
      return c.json({ success: false, error: "Topilmadi" }, 404);
    }
    if (branchId && String(existing.branchId) !== branchId) {
      return c.json({ success: false, error: "Ruxsat yo‘q" }, 403);
    }
    await kv.set(key(id), {
      ...existing,
      deleted: true,
      status: "inactive",
      updatedAt: new Date().toISOString(),
    });
    return c.json({ success: true });
  } catch (e: any) {
    console.error("auto-couriers DELETE", e);
    return c.json({ success: false, error: e?.message || "xato" }, 500);
  }
});

app.post("/auto-courier/login", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const login = String(body.login || "").trim();
    const password = String(body.password || "").trim();
    if (!login || !password) {
      return c.json({ success: false, error: "Login va parol majburiy" }, 400);
    }
    const all = (await kv.getByPrefix("auto_courier:")) || [];
    const row = all.find(
      (x: any) => x && !x.deleted && String(x.login) === login && String(x.password) === password,
    );
    if (!row) {
      return c.json({ success: false, error: "Login yoki parol noto‘g‘ri" }, 401);
    }
    const token = `ac_sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
    await kv.set(sessionKey(token), {
      courierId: row.id,
      branchId: row.branchId,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
    return c.json({
      success: true,
      token,
      expiresAt,
      courier: {
        id: row.id,
        branchId: row.branchId,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        vehiclePlate: row.vehiclePlate,
        vehicleBrand: row.vehicleBrand,
      },
    });
  } catch (e: any) {
    console.error("auto-courier login", e);
    return c.json({ success: false, error: e?.message || "xato" }, 500);
  }
});

/** Avto-kuryer: katta / og‘ir ijara buyurtmalari (tayyorlanishi kutilmoqda) */
app.get("/auto-courier/rental-queue", async (c) => {
  try {
    const auth = await resolveSession(c);
    if (!auth) return c.json({ success: false, error: "Sessiya yo‘q" }, 401);
    const prefix = `rental_order_${auth.branchId}_`;
    const rows = (await kv.getByPrefix(prefix)) || [];
    const list = rows
      .filter((o: any) => {
        if (
          !o ||
          o.requiresAutoCourier !== true ||
          o.deliveryPending !== true ||
          o.assignedAutoCourierId
        ) {
          return false;
        }
        const branchOk =
          o.branchAcceptedAt != null ||
          !Object.prototype.hasOwnProperty.call(o, "branchAcceptedAt");
        return branchOk;
      })
      .map((o: any) => ({
        id: o.id,
        productName: o.productName,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        address: o.address,
        totalPrice: o.totalPrice,
        productWeightKg: o.productWeightKg,
        createdAt: o.createdAt,
      }))
      .sort((a: any, b: any) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
    return c.json({ success: true, orders: list });
  } catch (e: any) {
    console.error("auto-courier rental-queue", e);
    return c.json({ success: false, error: e?.message || "xato" }, 500);
  }
});

/** Buyurtmani o‘ziga olish (boshqa avto-kuryer ko‘rmasin) */
app.post("/auto-courier/claim-rental", async (c) => {
  try {
    const auth = await resolveSession(c);
    if (!auth) return c.json({ success: false, error: "Sessiya yo‘q" }, 401);
    const body = await c.req.json();
    const orderId = String(body.orderId || "").trim();
    if (!orderId) return c.json({ success: false, error: "orderId kerak" }, 400);
    const k = `rental_order_${auth.branchId}_${orderId}`;
    const order = await kv.get(k);
    if (!order) return c.json({ success: false, error: "Buyurtma topilmadi" }, 404);
    if (!order.requiresAutoCourier || !order.deliveryPending) {
      return c.json({ success: false, error: "Bu buyurtma navbatda emas" }, 400);
    }
    if (order.assignedAutoCourierId) {
      return c.json({ success: false, error: "Allaqachon biriktirilgan" }, 409);
    }
    const branchOk =
      order.branchAcceptedAt != null ||
      !Object.prototype.hasOwnProperty.call(order, "branchAcceptedAt");
    if (!branchOk) {
      return c.json({ success: false, error: "Filial hali buyurtmani qabul qilmagan" }, 400);
    }
    const nowIso = new Date().toISOString();
    order.assignedAutoCourierId = auth.courierId;
    order.assignedAutoCourierAt = nowIso;
    order.deliveryCourierId = auth.courierId;
    order.courierAssignedForDeliveryAt = nowIso;
    order.updatedAt = nowIso;
    await kv.set(
      `rental_courier_delivery_pending_${auth.courierId}_${orderId}`,
      { branchId: auth.branchId, orderId },
    );
    await kv.set(k, order);
    return c.json({
      success: true,
      order: {
        id: order.id,
        assignedAutoCourierId: auth.courierId,
        deliveryCourierId: auth.courierId,
      },
    });
  } catch (e: any) {
    console.error("auto-courier claim-rental", e);
    return c.json({ success: false, error: e?.message || "xato" }, 500);
  }
});

export default app;
