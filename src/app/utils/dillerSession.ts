export type DillerSession = {
  token: string;
  login: string;
  displayName: string;
  loggedInAt: string;
};

const SESSION_KEY = 'dillerSession';

export const DILLER_DEMO_LOGIN = 'Admin';
export const DILLER_DEMO_PASSWORD = 'Admin123';

export function validateDillerCredentials(login: string, password: string): boolean {
  return (
    login.trim().toLowerCase() === DILLER_DEMO_LOGIN.toLowerCase() &&
    password === DILLER_DEMO_PASSWORD
  );
}

export function saveDillerSession(session: DillerSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readDillerSession(): DillerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DillerSession;
    if (!parsed?.token || !parsed?.login) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDillerSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** Chiqish — sessiya tozalanadi, mahalliy ma’lumot qoladi */
export function clearDillerSessionKeepData(): void {
  clearDillerSession();
}
