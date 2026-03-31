/** API / KV dan kelgan isTestMode — boolean yoki "true" qator */
export function coerceUiPaymentTestMode(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw === 'string') {
    const s = raw.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off', ''].includes(s)) return false;
  }
  return false;
}
