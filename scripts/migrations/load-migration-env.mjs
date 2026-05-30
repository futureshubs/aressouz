import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, "../..");

const DEFAULT_PROJECT_REF = "wnondmqmuvjugbomyolz";

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
  return true;
}

/** `.env` / `.env.local` dan SUPABASE_URL va service_role ni yuklaydi */
export function loadMigrationEnv() {
  loadDotEnvFile(join(REPO_ROOT, ".env"));
  loadDotEnvFile(join(REPO_ROOT, ".env.local"));

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY;
  if (serviceKey) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  }

  if (!process.env.SUPABASE_URL?.trim()) {
    const ref = (
      process.env.SUPABASE_PROJECT_REF ||
      process.env.VITE_SUPABASE_PROJECT_ID ||
      DEFAULT_PROJECT_REF
    ).trim();
    process.env.SUPABASE_URL = `https://${ref}.supabase.co`;
  }

  return {
    supabaseUrl: process.env.SUPABASE_URL?.trim() || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
  };
}

export function migrationEnvHelp() {
  return `
KV → Postgres migratsiya uchun loyiha ildizida .env.local yarating:

  SUPABASE_URL=https://wnondmqmuvjugbomyolz.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<Dashboard → Settings → API → service_role>

service_role maxfiy kalit — Git ga commit qilmang (.env.local .gitignore da).

Keyin:
  npm run migrate:kv-to-relational:dry
  npm run migrate:kv-to-relational
`.trim();
}
