/** Auth (SMS/email) sessiyasi o‘zgaganda — ThemeProvider kabi ust komponentlar tinglaydi */
export const AUTH_SESSION_CHANGED_EVENT = 'aresso:auth-session';

export function dispatchAuthSessionChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}
