export type DillerSession = {
  token: string;
  dealerId: string;
  login: string;
  displayName: string;
  loggedInAt: string;
};

const SESSION_KEY = 'dillerSession';

export function saveDillerSession(session: DillerSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readDillerSession(): DillerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DillerSession;
    if (!parsed?.token || !parsed?.login || !parsed?.dealerId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDillerSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function clearDillerSessionKeepData(): void {
  clearDillerSession();
}
