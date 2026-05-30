/**
 * KV dan E2E tokenlarni topib .env.local ga yozadi (mavjud kalitlarni saqlab qoladi).
 * Ishga tushirish: node scripts/e2e/fetch-e2e-tokens.mjs
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadMigrationEnv, REPO_ROOT } from "../migrations/load-migration-env.mjs";

const envPath = join(REPO_ROOT, ".env.local");

function parseEnvFile(text) {
  const map = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      map.set(`__line_${map.size}`, rawLine);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return map;
}

function writeEnvFile(updates) {
  let lines = [];
  if (existsSync(envPath)) {
    const existing = parseEnvFile(readFileSync(envPath, "utf8"));
    const keys = new Set([...existing.keys()].filter((k) => !k.startsWith("__line_")));
    for (const [k, v] of Object.entries(updates)) {
      existing.set(k, v);
      keys.add(k);
    }
    const ordered = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "E2E_USER_ACCESS_TOKEN",
      "E2E_BRANCH_TOKEN",
      "E2E_STAFF_BRANCH_TOKEN",
      "PLAYWRIGHT_BASE_URL",
      "PLAYWRIGHT_API_BASE_URL",
    ];
    const written = new Set();
    for (const k of ordered) {
      if (existing.has(k)) {
        lines.push(`${k}=${existing.get(k)}`);
        written.add(k);
      }
    }
    for (const k of keys) {
      if (!written.has(k)) lines.push(`${k}=${existing.get(k)}`);
    }
  } else {
    lines = Object.entries(updates).map(([k, v]) => `${k}=${v}`);
  }
  if (!lines.some((l) => l.startsWith("PLAYWRIGHT_BASE_URL="))) {
    lines.push("PLAYWRIGHT_BASE_URL=https://aresso.app");
  }
  writeFileSync(envPath, lines.join("\n") + "\n", "utf8");
}

async function fetchKvPrefix(db, prefix, limit = 200) {
  const { data, error } = await db
    .from("kv_store_27d0d16c")
    .select("key, value")
    .like("key", `${prefix}%`)
    .order("key", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

function pickUserAccessToken(rows) {
  const now = Date.now();
  for (const row of rows) {
    if (!row.key?.startsWith("access_token:")) continue;
    const token = row.key.slice("access_token:".length);
    const v = row.value;
    if (!token || !v?.userId) continue;
    const exp = Number(v.expiresAt || 0);
    if (exp && exp < now) continue;
    return { token, userId: v.userId, phone: v.phone };
  }
  return null;
}

function pickBranchToken(rows, preferSupport = true) {
  const now = Date.now();
  const candidates = [];
  for (const row of rows) {
    const key = String(row.key || "");
    let token = "";
    if (key.startsWith("branch_session:")) {
      token = key.slice("branch_session:".length);
    } else if (key.startsWith("staff_session:")) {
      token = key.slice("staff_session:".length);
    } else continue;
    const v = row.value || {};
    const exp = v.expiresAt ? new Date(v.expiresAt).getTime() : 0;
    if (exp && exp < now) continue;
    if (!token) continue;
    candidates.push({
      token,
      role: String(v.role || "").toLowerCase(),
      branchId: v.branchId || v.branch_id,
    });
  }
  if (preferSupport) {
    const support = candidates.find((c) => c.role === "support" || c.role === "operator");
    if (support) return support;
  }
  return candidates[0] || null;
}

async function main() {
  const { supabaseUrl, serviceRoleKey } = loadMigrationEnv();
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY kerak (.env.local)");
    process.exit(1);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const accessRows = await fetchKvPrefix(db, "access_token:");
  const sessionRows = [
    ...(await fetchKvPrefix(db, "branch_session:")),
    ...(await fetchKvPrefix(db, "staff_session:")),
  ];

  const user = pickUserAccessToken(accessRows);
  const branch = pickBranchToken(sessionRows, true);

  if (!user) {
    console.warn("KV da yaroqli access_token topilmadi — SMS orqali yangi token yaratishga uriniladi...");
    const phoneRow = await db
      .from("kv_store_27d0d16c")
      .select("key, value")
      .like("key", "user:%")
      .limit(5);
    const firstUser = phoneRow.data?.find((r) => r.value?.phone);
    if (firstUser?.value?.phone) {
      console.log("Test telefon:", firstUser.value.phone, "(qo‘lda SMS signin qiling)");
    }
  }

  const updates = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    PLAYWRIGHT_BASE_URL: "https://aresso.app",
    PLAYWRIGHT_API_BASE_URL:
      "https://wnondmqmuvjugbomyolz.supabase.co/functions/v1/make-server-27d0d16c",
  };

  if (user) {
    updates.E2E_USER_ACCESS_TOKEN = user.token;
    console.log("E2E_USER_ACCESS_TOKEN:", user.token.slice(0, 24) + "...", "userId:", user.userId);
  }
  if (branch) {
    updates.E2E_BRANCH_TOKEN = branch.token;
    updates.E2E_STAFF_BRANCH_TOKEN = branch.token;
    console.log("E2E_BRANCH_TOKEN:", branch.token.slice(0, 24) + "...", "role:", branch.role);
  } else {
    console.warn("branch_session / staff_session topilmadi — support panelda login qiling");
  }

  writeEnvFile(updates);
  console.log("Yozildi:", envPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
