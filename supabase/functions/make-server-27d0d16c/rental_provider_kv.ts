/** Ijara beruvchi akkauntlari — rentals.tsx va index.ts bilan bir xil kalitlar */

export function rentalProviderRecordKey(branchId: string, providerId: string): string {
  return `rental_provider_${String(branchId).trim()}_${String(providerId).trim()}`;
}

export function rentalProviderLoginLookupKey(loginNormalized: string): string {
  return `rental_provider_login_${loginNormalized}`;
}

export function normalizeRentalProviderLogin(login: string): string {
  return String(login || "").trim().toLowerCase();
}

export const rentalProviderSessionPrefix = "rental_provider_session:";

export function rentalProviderSessionKey(token: string): string {
  return `${rentalProviderSessionPrefix}${String(token).trim()}`;
}
