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

export type RentalProviderRecord = {
  id: string;
  branchId: string;
  login: string;
  password?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: string;
  shopName?: string;
  workTime?: string;
  latitude?: number | null;
  longitude?: number | null;
  region?: string;
  district?: string;
  timeZone?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
};

export function rentalProviderDisplayName(rec: RentalProviderRecord | null | undefined): string {
  if (!rec) return "";
  const fn = String(rec.firstName || "").trim();
  const ln = String(rec.lastName || "").trim();
  const full = `${fn} ${ln}`.trim();
  return full || String(rec.displayName || rec.shopName || rec.login || "").trim();
}

/** API javobi — parol qaytmaydi */
export function rentalProviderPublicProfile(rec: RentalProviderRecord | null | undefined) {
  if (!rec || rec.deleted) return null;
  return {
    id: rec.id,
    branchId: rec.branchId,
    login: rec.login,
    displayName: rentalProviderDisplayName(rec),
    firstName: rec.firstName || "",
    lastName: rec.lastName || "",
    birthDate: rec.birthDate || "",
    gender: rec.gender || "",
    shopName: rec.shopName || "",
    workTime: rec.workTime || "",
    latitude: rec.latitude ?? null,
    longitude: rec.longitude ?? null,
    region: rec.region || "",
    district: rec.district || "",
    timeZone: rec.timeZone || "",
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}
