import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

let adminClient: SupabaseClient | null = null;

const requireEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
};

export const getAdminDb = () => {
  if (!adminClient) {
    adminClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return adminClient;
};
