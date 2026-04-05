/** Server bilan bir xil: 2026-06-01 dan keyin min 1% majburiy */
export const PLATFORM_COMMISSION_GRACE_END_MS = Date.UTC(2026, 5, 1, 0, 0, 0, 0);

export function isPlatformCommissionRequiredClient(): boolean {
  return Date.now() >= PLATFORM_COMMISSION_GRACE_END_MS;
}

export function clampPlatformCommissionPercentClient(n: unknown): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(15, x);
}

export function platformCommissionHintUz(): string {
  if (isPlatformCommissionRequiredClient()) {
    return "Platformaga berish % — har bir variant uchun 1–15% majburiy (mijoz to‘lagan summadan platforma ulushi).";
  }
  return "Ixtiyoriy: platformaga berish % (0–15). 2026-yil 1-iyundan min 1%, max 15% majburiy bo‘ladi.";
}

export function validateVariantCommissionsClient(
  variants: Array<{ commission?: number }>,
  label: string,
): string | null {
  if (!variants?.length) return null;
  const required = isPlatformCommissionRequiredClient();
  for (let i = 0; i < variants.length; i++) {
    const pct = clampPlatformCommissionPercentClient(variants[i]?.commission);
    if (required && (pct < 1 || pct > 15)) {
      return `${label}: variant ${i + 1} — 1% dan 15% gacha kiriting`;
    }
    const raw = variants[i]?.commission;
    if (!required && raw != null && raw !== "" && Number(raw) > 15) {
      return `${label}: variant ${i + 1} — maksimal 15%`;
    }
  }
  return null;
}
