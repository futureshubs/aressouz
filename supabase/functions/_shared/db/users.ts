import { getAdminDb } from "./client.ts";
import * as kv from "../../make-server-27d0d16c/kv_store.tsx";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResolvedUserIdentity {
  id: string;
  auth_user_id: string | null;
  legacy_kv_key: string | null;
  role: string;
  status: string;
}

interface ResolveUserArgs {
  userId?: string | null;
  authUserId?: string | null;
}

export const resolveUserIdentity = async (
  args: ResolveUserArgs,
): Promise<ResolvedUserIdentity> => {
  const db = getAdminDb();
  const userId = args.userId?.trim();
  const authUserId = args.authUserId?.trim();

  if (!userId && !authUserId) {
    throw new Error("A legacy user id or auth user id is required");
  }

  if (userId) {
    const legacyKey = userId.startsWith("user:") ? userId : `user:${userId}`;
    const { data, error } = await db
      .from("users")
      .select("id, auth_user_id, legacy_kv_key, role, status")
      .eq("legacy_kv_key", legacyKey)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve legacy user: ${error.message}`);
    }

    if (data) {
      return data as ResolvedUserIdentity;
    }
  }

  if (authUserId) {
    const { data, error } = await db
      .from("users")
      .select("id, auth_user_id, legacy_kv_key, role, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve auth user: ${error.message}`);
    }

    if (data) {
      return data as ResolvedUserIdentity;
    }
  }

  throw new Error("User does not exist in the relational marketplace schema");
};

/** Sync KV `user:{id}` profile into relational `users` (+ `user_profiles`) for marketplace /v2 APIs */
export const ensureRelationalUserFromLegacyKv = async (
  bareUserId: string,
): Promise<ResolvedUserIdentity> => {
  const normalized = String(bareUserId || "").replace(/^user:/, "").trim();
  if (!normalized) {
    throw new Error("User does not exist in the relational marketplace schema");
  }

  try {
    return await resolveUserIdentity({
      userId: normalized,
    });
  } catch {
    /* not in DB yet */
  }

  if (UUID_RE.test(normalized)) {
    try {
      return await resolveUserIdentity({
        authUserId: normalized,
      });
    } catch {
      /* continue */
    }
  }

  const legacyKey = normalized.startsWith("user:") ? normalized : `user:${normalized}`;
  const profile = await kv.get(legacyKey);
  if (!profile || !profile.id) {
    throw new Error("User does not exist in the relational marketplace schema");
  }

  const db = getAdminDb();
  const authUuid = UUID_RE.test(String(profile.id)) ? String(profile.id) : null;
  const phone = profile.phone ? String(profile.phone).trim() : null;
  let email = profile.email ? String(profile.email).trim() : null;
  const firstName = profile.firstName || profile.name || null;
  const lastName = profile.lastName || null;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(profile.name || "").trim() ||
    phone ||
    "Mijoz";

  const insertRow: Record<string, unknown> = {
    auth_user_id: authUuid,
    legacy_kv_key: legacyKey,
    phone,
    email,
    first_name: firstName,
    last_name: lastName,
    display_name: displayName,
    role: "buyer",
    status: "active",
  };

  const tryInsert = async (row: Record<string, unknown>) => {
    const { data, error } = await db
      .from("users")
      .insert(row)
      .select("id, auth_user_id, legacy_kv_key, role, status")
      .single();

    if (error) {
      return { data: null as ResolvedUserIdentity | null, error };
    }
    if (data) {
      await db.from("user_profiles").insert({ user_id: data.id }).then(
        () => {},
        () => {},
      );
    }
    return { data: data as ResolvedUserIdentity | null, error: null as null };
  };

  let { data: inserted, error: insErr } = await tryInsert(insertRow);

  if (insErr && email) {
    ({ data: inserted, error: insErr } = await tryInsert({ ...insertRow, email: null }));
  }

  if (!insErr && inserted) {
    return inserted;
  }

  try {
    return await resolveUserIdentity({
      userId: normalized,
      authUserId: authUuid || undefined,
    });
  } catch {
    throw new Error(
      insErr?.message || "User does not exist in the relational marketplace schema",
    );
  }
};
