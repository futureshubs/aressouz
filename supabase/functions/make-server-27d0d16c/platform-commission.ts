/** 2026-06-01 dan keyin do‘kon/taom uchun min 1% — max 15% majburiy (grace: ixtiyoriy 0%). */
export const PLATFORM_COMMISSION_GRACE_END_MS = Date.UTC(2026, 5, 1, 0, 0, 0, 0);

export function isPlatformCommissionRequired(): boolean {
  return Date.now() >= PLATFORM_COMMISSION_GRACE_END_MS;
}

export function clampPlatformCommissionPercent(n: unknown): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(15, x);
}

export function validateVariantCommissionsForSave(
  variants: unknown,
  label: string,
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(variants) || variants.length === 0) return { ok: true };
  const required = isPlatformCommissionRequired();
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i] as Record<string, unknown>;
    const raw = v?.commission ?? v?.platformCommissionPercent;
    const pct = clampPlatformCommissionPercent(raw);
    if (required) {
      if (pct < 1 || pct > 15) {
        return {
          ok: false,
          error: `${label}: variant ${i + 1} — platformaga berish % 1–15 orasida majburiy (2026-06-01 dan keyin).`,
        };
      }
    } else {
      const rawNum = Number(raw);
      if (Number.isFinite(rawNum) && rawNum > 15) {
        return { ok: false, error: `${label}: variant ${i + 1} — maksimal 15%` };
      }
    }
  }
  return { ok: true };
}
