export type RentalProviderSession = {
  token: string;
  branchId: string;
  providerId?: string;
  displayName?: string;
  login?: string;
  shopName?: string;
  workTime?: string;
};

export function readRentalProviderSession(): RentalProviderSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('rentalProviderSession');
    if (!raw) return null;
    const p = JSON.parse(raw) as RentalProviderSession;
    if (!p?.token?.trim() || !p?.branchId?.trim()) return null;
    return p;
  } catch {
    return null;
  }
}

export function writeRentalProviderSession(session: RentalProviderSession) {
  localStorage.setItem('rentalProviderSession', JSON.stringify(session));
}

export function clearRentalProviderSession() {
  localStorage.removeItem('rentalProviderSession');
}
