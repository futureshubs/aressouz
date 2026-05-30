import { createHash } from "node:crypto";
import { getAdminDb } from "./client.ts";

export type LegacyEntityType =
  | "user"
  | "branch"
  | "shop"
  | "product"
  | "listing"
  | "order"
  | "payment";

const hashPayload = (payload: unknown) =>
  createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");

export const upsertLegacyKvMap = async (args: {
  entityType: LegacyEntityType;
  legacyKey: string;
  newTable: string;
  newId: string;
  payload?: unknown;
}): Promise<void> => {
  const legacyKey = String(args.legacyKey || "").trim();
  const newId = String(args.newId || "").trim();
  if (!legacyKey || !newId) return;

  const db = getAdminDb();
  const { error } = await db.from("legacy_kv_map").upsert(
    {
      entity_type: args.entityType,
      legacy_key: legacyKey,
      new_table: args.newTable,
      new_id: newId,
      payload_hash: hashPayload(args.payload),
      migrated_at: new Date().toISOString(),
    },
    { onConflict: "entity_type,legacy_key" },
  );

  if (error) {
    console.warn("[legacy_kv_map] upsert failed:", error.message, {
      entityType: args.entityType,
      legacyKey,
    });
  }
};

export const resolveRelationalIdFromLegacyKvMap = async (args: {
  entityType: LegacyEntityType;
  legacyKey: string;
  newTable?: string;
}): Promise<string | null> => {
  const legacyKey = String(args.legacyKey || "").trim();
  if (!legacyKey) return null;

  const db = getAdminDb();
  let query = db
    .from("legacy_kv_map")
    .select("new_id")
    .eq("entity_type", args.entityType)
    .eq("legacy_key", legacyKey);

  if (args.newTable) {
    query = query.eq("new_table", args.newTable);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn("[legacy_kv_map] resolve failed:", error.message);
    return null;
  }
  return data?.new_id ? String(data.new_id) : null;
};

/** Buyurtma uchun barcha mumkin bo‘lgan KV kalitlari */
export function legacyOrderKeyCandidates(legacyOrderId: string): string[] {
  const raw = String(legacyOrderId || "").trim();
  if (!raw) return [];

  const keys = new Set<string>();

  if (raw.startsWith("order:market:")) {
    const stripped = raw.slice("order:market:".length);
    keys.add(raw);
    keys.add(`order:${stripped}`);
    keys.add(stripped);
  } else if (raw.startsWith("order:")) {
    const stripped = raw.slice("order:".length);
    keys.add(raw);
    keys.add(`order:market:${stripped}`);
    keys.add(stripped);
  } else if (raw.startsWith("shop_order:")) {
    keys.add(raw);
    keys.add(raw.replace(/^shop_order:/, "order:"));
  } else if (raw.startsWith("rental_order_")) {
    keys.add(raw);
  } else {
    keys.add(`order:${raw}`);
    keys.add(`order:market:${raw}`);
    keys.add(`shop_order:${raw}`);
  }

  return Array.from(keys).filter(Boolean);
}

export const merchantOrderRefCandidates = (legacyOrderId: string): string[] => {
  const raw = String(legacyOrderId || "").trim();
  if (!raw) return [];
  const refs = new Set<string>();
  refs.add(raw.slice(0, 120));
  for (const k of legacyOrderKeyCandidates(raw)) {
    const stripped = k.replace(/^order:market:/, "").replace(/^order:/, "").replace(
      /^shop_order:/,
      "",
    );
    if (stripped) refs.add(stripped.slice(0, 120));
    refs.add(k.slice(0, 120));
  }
  return Array.from(refs).filter(Boolean);
};
