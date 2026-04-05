/** Do‘st havolasi: ?ref=CODE — login qilguncha saqlanadi, Bonus ochilganda avtomatik ulanadi */

export const BONUS_PENDING_REF_KEY = 'aresso:bonus_pending_ref';

export function normalizeReferralCodeInput(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** URL dan ref o‘qiydi, sessionStorage ga yozadi va query dan olib tashlaydi */
export function captureReferralFromUrlToSession(): void {
  if (typeof window === 'undefined') return;
  try {
    const p = new URLSearchParams(window.location.search);
    const paramKeys = ['ref', 'bonusRef', 'referral'] as const;
    let found = '';
    for (const k of paramKeys) {
      const n = normalizeReferralCodeInput(p.get(k));
      if (n.length >= 8) {
        found = n.slice(0, 32);
        break;
      }
    }
    if (!found) return;
    sessionStorage.setItem(BONUS_PENDING_REF_KEY, found);
    for (const k of paramKeys) p.delete(k);
    const qs = p.toString();
    const path = window.location.pathname;
    const hash = window.location.hash || '';
    window.history.replaceState({}, '', `${path}${qs ? `?${qs}` : ''}${hash}`);
  } catch {
    /* ignore */
  }
}
