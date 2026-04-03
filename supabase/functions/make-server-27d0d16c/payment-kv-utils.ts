/**
 * Admin KV `payment_method:*` dan keladigan isTestMode — boolean, string, number.
 * Barcha to‘lov integratsiyalari (Payme, Click, …) uchun bir xil.
 */
export function coerceKvTestMode(raw: unknown): boolean | null {
  if (raw === undefined || raw === null) return null;
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw === 'string') {
    const s = raw.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off', ''].includes(s)) return false;
  }
  return null;
}

/** Saqlash: faqat aniq test=true bo‘lsa true, aks holda prod. */
export function normalizeKvTestModeForSave(isTestMode: unknown): boolean {
  return coerceKvTestMode(isTestMode) === true;
}

/** Supabase secret: aniq test rejimi (my.click o‘rniga test.click). */
export function clickEnvWantsTestMode(): boolean {
  const raw = (Deno.env.get("CLICK_TEST_MODE") || Deno.env.get("CLICK_USE_TEST") || "")
    .toLowerCase()
    .trim();
  return raw === "true";
}

/**
 * Haqiqiy to‘lov: KV dagi test bayrog‘ini ham e’tiborsiz qiladi.
 * Edge Functions → Secrets ga qo‘shing, agar test.click NXDOMAIN bo‘lsa.
 */
export function clickForceProduction(): boolean {
  const v = (Deno.env.get("CLICK_FORCE_PRODUCTION") || "").toLowerCase().trim();
  return ["true", "1", "yes", "on"].includes(v);
}

/**
 * Invoice pay URL uchun test yoki prod.
 * - Secretlar (CLICK_*) orqali: faqat CLICK_USE_TEST/CLICK_TEST_MODE yoki CLICK_FORCE_PRODUCTION;
 *   KV dagi isTestMode e’tiborsiz (aks holda eski admin test bayrog‘i my.click ni bloklaydi).
 * - To‘liq KV kredensiallar: admin `isTestMode` ham hisoblanadi.
 */
export function resolveClickIsTestForInvoice(opts: {
  clickKv: { isTestMode?: unknown } | null | undefined;
  credentialsFromKv: boolean;
}): boolean {
  if (clickForceProduction()) return false;
  if (clickEnvWantsTestMode()) return true;
  if (!opts.credentialsFromKv) return false;
  return coerceKvTestMode(opts.clickKv?.isTestMode) === true;
}
