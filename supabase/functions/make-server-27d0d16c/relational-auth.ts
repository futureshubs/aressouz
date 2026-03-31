import * as kv from "./kv_store.tsx";
import { ensureRelationalUserFromLegacyKv } from "../_shared/db/users.ts";

export const extractAccessTokenFromRequest = (req: Request): string | null => {
  const custom =
    req.headers.get("X-Access-Token") || req.headers.get("x-access-token");
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  let bearer: string | null = null;
  if (auth?.startsWith("Bearer ")) {
    bearer = auth.slice(7).trim();
  } else if (auth?.trim()) {
    bearer = auth.trim();
  }
  // Prefer explicit app session token over anon JWT in Authorization
  const raw = (custom || bearer || "").trim();
  return raw || null;
};

/** Resolves legacy/custom KV session and ensures a row exists in relational `users`. */
export const getLegacyUserIdFromAccessToken = async (
  req: Request,
): Promise<string | null> => {
  const accessToken = extractAccessTokenFromRequest(req);
  if (!accessToken) return null;

  const row = await kv.get(`access_token:${accessToken}`);
  if (!row?.userId) return null;
  if (typeof row.expiresAt === "number" && Date.now() > row.expiresAt) {
    return null;
  }
  return String(row.userId);
};

/**
 * Identity for `_shared/db` helpers (`userId` = KV/legacy id, `authUserId` = Supabase Auth UUID).
 * Supports explicit headers (ops / tools) or app `X-Access-Token`.
 */
export const resolveV2IdentityFromRequest = async (req: Request) => {
  const headerLegacy =
    req.headers.get("X-Legacy-User-Id") || req.headers.get("x-legacy-user-id");
  const headerAuth =
    req.headers.get("X-Auth-User-Id") || req.headers.get("x-auth-user-id");

  if (headerLegacy?.trim() || headerAuth?.trim()) {
    const userId = headerLegacy?.trim() || null;
    const authUserId = headerAuth?.trim() || null;
    if (userId) {
      await ensureRelationalUserFromLegacyKv(userId.replace(/^user:/, ""));
    } else if (authUserId) {
      await ensureRelationalUserFromLegacyKv(authUserId);
    }
    return { userId, authUserId };
  }

  const legacyId = await getLegacyUserIdFromAccessToken(req);
  if (!legacyId) {
    throw new Error("Unauthorized");
  }
  await ensureRelationalUserFromLegacyKv(legacyId);
  return { userId: legacyId, authUserId: null as string | null };
};
