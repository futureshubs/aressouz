/**
 * Kelajakda Supabase Realtime bilan pollingni almashtirish uchun flag.
 * Hozircha `false` — mavjud yangilanishlar o‘zgarishsiz.
 */
export const SUPABASE_REALTIME_PREPARED =
  String(
    (import.meta as ImportMeta & { env?: { VITE_SUPABASE_REALTIME?: string } }).env
      ?.VITE_SUPABASE_REALTIME || "",
  ).trim() === "1";
