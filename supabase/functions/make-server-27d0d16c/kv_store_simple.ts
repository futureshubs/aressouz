// Simple KV Store for Supabase Edge Functions
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const supabase = () => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

// Set stores a key-value pair in the database.
export const set = async (key: string, value: any): Promise<void> => {
  const { error } = await supabase().from("kv_store_27d0d16c").upsert({
    key,
    value
  });
  if (error) {
    throw new Error(error.message);
  }
};

// Get retrieves a key-value pair from the database.
export const get = async (key: string): Promise<any> => {
  const { data, error } = await supabase().from("kv_store_27d0d16c").select("value").eq("key", key).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data?.value;
};

// Delete deletes a key-value pair from the database.
export const del = async (key: string): Promise<void> => {
  const { error } = await supabase().from("kv_store_27d0d16c").delete().eq("key", key);
  if (error) {
    throw new Error(error.message);
  }
};

// Sets multiple key-value pairs in the database.
export const mset = async (keys: string[], values: any[]): Promise<void> => {
  const { error } = await supabase().from("kv_store_27d0d16c").upsert(keys.map((k, i) => ({ key: k, value: values[i] })));
  if (error) {
    throw new Error(error.message);
  }
};

// Gets multiple key-value pairs from the database.
export const mget = async (keys: string[]): Promise<any[]> => {
  const { data, error } = await supabase().from("kv_store_27d0d16c").select("value").in("key", keys);
  if (error) {
    throw new Error(error.message);
  }
  return data?.map((d) => d.value) ?? [];
};

// Deletes multiple key-value pairs from the database.
export const mdel = async (keys: string[]): Promise<void> => {
  const { error } = await supabase().from("kv_store_27d0d16c").delete().in("key", keys);
  if (error) {
    throw new Error(error.message);
  }
};

const KV_PREFIX_PAGE_SIZE = 1000;

// Search for key-value pairs by prefix (sahifalab — default 1000 qator limiti).
export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const likePattern = `${prefix}%`;
  const values: any[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase()
      .from("kv_store_27d0d16c")
      .select("key, value")
      .like("key", likePattern)
      .order("key", { ascending: true })
      .range(offset, offset + KV_PREFIX_PAGE_SIZE - 1);
    if (error) {
      throw new Error(error.message);
    }
    const batch = data ?? [];
    for (const d of batch) {
      values.push(d.value);
    }
    if (batch.length < KV_PREFIX_PAGE_SIZE) break;
    offset += KV_PREFIX_PAGE_SIZE;
  }
  return values;
};
