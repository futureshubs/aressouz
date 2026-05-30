import * as kv from "./kv_store.tsx";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUYER_REL_SELECT =
  "id, auth_user_id, legacy_kv_key, phone, email, role, deleted_at";

export type ResolvedBuyerAdminIdentity = {
  kvBareId: string | null;
  authUserId: string | null;
  relationalUserId: string | null;
  phone: string | null;
  email: string | null;
  profile: Record<string, unknown> | null;
};

export async function touchBuyerLastLogin(
  bareUserId: string,
  profile?: Record<string, unknown> | null,
): Promise<void> {
  const id = String(bareUserId || "").trim();
  if (!id) return;
  const now = new Date().toISOString();
  const existing =
    profile && typeof profile === "object"
      ? profile
      : ((await kv.get(`user:${id}`)) as Record<string, unknown> | null);
  if (!existing || typeof existing !== "object") {
    await kv.set(`user:${id}`, {
      id,
      lastLoginAt: now,
      createdAt: now,
    });
    return;
  }
  await kv.set(`user:${id}`, {
    ...existing,
    id: existing.id || id,
    lastLoginAt: now,
    updatedAt: now,
  });
}

export async function getBuyerLastLoginIso(
  bareUserId: string,
  profile?: Record<string, unknown> | null,
): Promise<string | null> {
  const id = String(bareUserId || "").trim();
  if (!id) return null;

  const prof =
    profile && typeof profile === "object"
      ? profile
      : ((await kv.get(`user:${id}`)) as Record<string, unknown> | null);
  const fromProfile = prof?.lastLoginAt ?? prof?.last_login_at;
  if (fromProfile) return String(fromProfile);

  let best = 0;
  const tokenRows = await kv.getByPrefixWithKeys("access_token:");
  for (const { value } of tokenRows) {
    if (String(value?.userId || "") !== id) continue;
    const t = new Date(String(value?.createdAt || 0)).getTime();
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best > 0 ? new Date(best).toISOString() : null;
}

function applyRelRow(
  rel: Record<string, unknown>,
  state: {
    relationalUserId: string | null;
    authUserId: string | null;
    phone: string | null;
    email: string | null;
    kvBareId: string | null;
  },
) {
  state.relationalUserId = String(rel.id || "");
  if (rel.auth_user_id) {
    state.authUserId = String(rel.auth_user_id);
  }
  state.phone = state.phone || (rel.phone ? String(rel.phone) : null);
  state.email = state.email || (rel.email ? String(rel.email) : null);
  const lk = rel.legacy_kv_key ? String(rel.legacy_kv_key).trim() : "";
  if (lk.startsWith("user:")) {
    const bare = lk.slice("user:".length);
    if (bare) state.kvBareId = state.kvBareId || bare;
  }
}

export async function resolveBuyerAdminIdentity(
  userIdParam: string,
  supabase: any,
  authAdmin?: { getUserById: (id: string) => Promise<{ data: { user: any } | null; error: any }> },
): Promise<ResolvedBuyerAdminIdentity | null> {
  const param = String(userIdParam || "").trim();
  if (!param) return null;

  let kvBareId: string | null = null;
  let profile: Record<string, unknown> | null = null;
  let relationalUserId: string | null = null;
  let authUserId: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;

  const loadKv = async (bare: string) => {
    const p = (await kv.get(`user:${bare}`)) as Record<string, unknown> | null;
    if (p && typeof p === "object") {
      kvBareId = bare;
      profile = p;
      phone = phone || (p.phone ? String(p.phone) : null);
      email = email || (p.email ? String(p.email) : null);
      const pid = p.id ? String(p.id) : bare;
      if (UUID_RE.test(pid)) {
        authUserId = authUserId || pid;
      }
    }
  };

  const state = {
    relationalUserId,
    authUserId,
    phone,
    email,
    kvBareId,
  };

  const pickRel = (rel: any) => {
    if (!rel || String(rel.role || "") !== "buyer") return;
    if (rel.deleted_at) return;
    applyRelRow(rel as Record<string, unknown>, state);
  };

  if (UUID_RE.test(param)) {
    const { data: byId } = await supabase
      .from("users")
      .select(BUYER_REL_SELECT)
      .eq("id", param)
      .maybeSingle();
    pickRel(byId);

    if (!state.relationalUserId) {
      const { data: byAuth } = await supabase
        .from("users")
        .select(BUYER_REL_SELECT)
        .eq("auth_user_id", param)
        .maybeSingle();
      pickRel(byAuth);
    }

    await loadKv(param);
    if (state.kvBareId && state.kvBareId !== param) {
      await loadKv(state.kvBareId);
    }

    if (!state.authUserId && authAdmin) {
      const { data: authData, error: authErr } = await authAdmin.getUserById(param);
      if (!authErr && authData?.user) {
        state.authUserId = param;
        const meta = (authData.user.user_metadata || {}) as Record<string, unknown>;
        state.phone = state.phone || (meta.phone ? String(meta.phone) : null);
        state.email = state.email || (authData.user.email ? String(authData.user.email) : null);
        if (!kvBareId) {
          await loadKv(param);
        }
      }
    }
  } else {
    await loadKv(param);
    const legacyKey = `user:${param}`;
    const { data: rel } = await supabase
      .from("users")
      .select(BUYER_REL_SELECT)
      .eq("legacy_kv_key", legacyKey)
      .maybeSingle();
    pickRel(rel);
  }

  relationalUserId = state.relationalUserId;
  authUserId = state.authUserId;
  phone = state.phone;
  email = state.email;
  kvBareId = state.kvBareId;

  if (!phone) {
    const phoneRow = await kv.get(`user_phone:${param}`);
    if (phoneRow?.phone) phone = String(phoneRow.phone);
  }

  if (!kvBareId && !relationalUserId && !authUserId) {
    return null;
  }

  return {
    kvBareId,
    authUserId,
    relationalUserId,
    phone,
    email,
    profile,
  };
}

async function deleteKvKeysByPrefix(prefix: string): Promise<number> {
  const rows = await kv.getByPrefixWithKeys(prefix);
  if (!rows.length) return 0;
  await kv.mdel(rows.map((r) => r.key));
  return rows.length;
}

async function purgeBuyerKvData(identity: ResolvedBuyerAdminIdentity): Promise<void> {
  const ids = new Set<string>();
  if (identity.kvBareId) ids.add(identity.kvBareId);
  if (identity.authUserId) ids.add(identity.authUserId);

  for (const bare of ids) {
    await deleteKvKeysByPrefix(`user:${bare}:`);
    await kv.del(`user:${bare}`);
    await deleteKvKeysByPrefix(`bonus:${bare}`);
    await deleteKvKeysByPrefix(`bonus_history:${bare}:`);
    await kv.del(`bonus_referral:${bare}`);
    await kv.del(`bonus_referee:${bare}`);

    for (const prefix of ["listing:", "house:", "car:"]) {
      const rows = await kv.getByPrefixWithKeys(prefix);
      const toDel = rows
        .filter((r) => {
          const parts = r.key.split(":");
          return parts.length >= 3 && parts[1] === bare;
        })
        .map((r) => r.key);
      if (toDel.length) await kv.mdel(toDel);
    }
  }

  const tokenRows = await kv.getByPrefixWithKeys("access_token:");
  const tokenKeys = tokenRows
    .filter((r) => {
      const uid = String(r.value?.userId || "");
      return ids.has(uid);
    })
    .map((r) => r.key);
  if (tokenKeys.length) await kv.mdel(tokenKeys);

  if (identity.phone) {
    await kv.del(`user_phone:${identity.phone}`);
    await kv.del(`sms_code:${identity.phone}`);
  }

  const allPhoneRows = await kv.getByPrefixWithKeys("user_phone:");
  for (const { key, value } of allPhoneRows) {
    const uid = String(value?.userId || "");
    if (ids.has(uid)) {
      await kv.del(key);
      const ph = value?.phone ? String(value.phone) : key.replace("user_phone:", "");
      if (ph) await kv.del(`sms_code:${ph}`);
    }
  }

  const refRows = await kv.getByPrefixWithKeys("bonus_referee:");
  const refKeys = refRows
    .filter((r) => ids.has(String(r.value?.referrerUserId || "")))
    .map((r) => r.key);
  if (refKeys.length) await kv.mdel(refKeys);

  const lookupRows = await kv.getByPrefixWithKeys("bonus_referral_lookup:");
  const lookupKeys = lookupRows
    .filter((r) => ids.has(String(r.value?.userId || "")))
    .map((r) => r.key);
  if (lookupKeys.length) await kv.mdel(lookupKeys);
}

async function purgeBuyerRelationalData(
  relationalUserId: string,
  supabase: any,
): Promise<void> {
  const { error: ordErr } = await supabase
    .from("orders")
    .delete()
    .eq("user_id", relationalUserId);
  if (ordErr) {
    console.error("purge buyer: orders delete", ordErr);
    throw new Error(ordErr.message || "Buyurtmalarni o'chirib bo'lmadi");
  }

  const { error: userErr } = await supabase
    .from("users")
    .delete()
    .eq("id", relationalUserId);
  if (userErr) {
    console.error("purge buyer: users delete", userErr);
    throw new Error(userErr.message || "Relational foydalanuvchini o'chirib bo'lmadi");
  }
}

export async function purgeBuyerUserCompletely(
  userIdParam: string,
  supabase: any,
  authAdmin: {
    deleteUser: (id: string) => Promise<{ error: any }>;
    getUserById: (id: string) => Promise<{ data: { user: any } | null; error: any }>;
  },
): Promise<{ deleted: boolean; summary: Record<string, unknown> }> {
  const identity = await resolveBuyerAdminIdentity(
    userIdParam,
    supabase,
    authAdmin,
  );
  if (!identity) {
    throw new Error("Foydalanuvchi topilmadi");
  }

  let kvPurged = false;
  if (identity.kvBareId || identity.authUserId || identity.profile) {
    await purgeBuyerKvData(identity);
    kvPurged = true;
  }

  let relationalPurged = false;
  if (identity.relationalUserId) {
    await purgeBuyerRelationalData(identity.relationalUserId, supabase);
    relationalPurged = true;
  }

  let authDeleted = false;
  const authId = identity.authUserId;
  if (authId && UUID_RE.test(authId)) {
    const { error } = await authAdmin.deleteUser(authId);
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      const notFound =
        msg.includes("not found") ||
        msg.includes("not_found") ||
        msg.includes("topilmadi");
      if (!notFound) {
        console.error("purge buyer: auth delete", error);
        throw new Error(
          error.message || "Supabase Auth foydalanuvchisini o'chirib bo'lmadi",
        );
      }
    } else {
      authDeleted = true;
    }
  }

  if (!kvPurged && !relationalPurged && !authDeleted) {
    throw new Error("Foydalanuvchi topilmadi");
  }

  return {
    deleted: true,
    summary: {
      kvBareId: identity.kvBareId,
      relationalUserId: identity.relationalUserId,
      authUserId: authId,
      phone: identity.phone,
      kvPurged,
      relationalPurged,
      authDeleted,
    },
  };
}
