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
