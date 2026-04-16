const KEY = 'aresso:headerSearch:v1';
const MAX_LEN = 240;

export function readHeaderSearchFromSession(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    const v = localStorage.getItem(KEY);
    if (v == null) return '';
    const t = String(v).trim();
    return t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t;
  } catch {
    return '';
  }
}

export function writeHeaderSearchToSession(query: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const t = String(query).trim().slice(0, MAX_LEN);
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
