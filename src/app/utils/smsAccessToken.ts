/**
 * SMS KV sessiya tokeni: server `userId-Date.now()-random` (JWT emas).
 * UUID bilan tire soni ≥7; qisqa userId da kamida `...-<timestamp>-...` (timestamp ≥10 raqam).
 */
export function isValidSmsOrJwtAccessToken(accessToken: unknown): boolean {
  const s = typeof accessToken === 'string' ? accessToken.trim() : '';
  if (!s) return false;
  if (s.split('.').length === 3) return true;
  const parts = s.split('-');
  if (parts.length >= 7) return true;
  for (let i = 1; i < parts.length - 1; i++) {
    if (/^\d{10,}$/.test(parts[i])) return true;
  }
  return false;
}
