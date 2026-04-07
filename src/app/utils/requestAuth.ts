import { publicAnonKey } from '../../../utils/supabase/info';

type HeaderMap = Record<string, string>;

const safeParse = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

/** Brauzer «qurilma» identifikatori — admin kirish blokirovkasi uchun server bilan */
export function getOrCreateAdminDeviceId(): string {
  if (typeof localStorage === 'undefined') return '';
  let id = localStorage.getItem('adminDeviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('adminDeviceId', id);
  }
  return id;
}

export const getStoredAdminSessionToken = () => {
  const session = safeParse<{ sessionToken?: string; role?: string }>(localStorage.getItem('adminSession'));
  if (session?.sessionToken?.trim()) {
    return session.sessionToken.trim();
  }
  return '';
};

export const buildPublicHeaders = (headers: HeaderMap = {}): HeaderMap => ({
  apikey: publicAnonKey,
  Authorization: `Bearer ${publicAnonKey}`,
  ...headers,
});

/** Kirishdan oldin: device id (admin /admin/auth) */
export const buildAdminLoginHeaders = (headers: HeaderMap = {}): HeaderMap => {
  const deviceId = getOrCreateAdminDeviceId();
  return {
    ...buildPublicHeaders(headers),
    ...(deviceId ? { 'X-Admin-Device-Id': deviceId } : {}),
  };
};

export const buildAdminHeaders = (headers: HeaderMap = {}): HeaderMap => {
  const sessionToken = getStoredAdminSessionToken();
  const deviceId = getOrCreateAdminDeviceId();

  return {
    apikey: publicAnonKey,
    Authorization: `Bearer ${publicAnonKey}`,
    ...(sessionToken ? { 'X-Admin-Session': sessionToken } : {}),
    ...(deviceId ? { 'X-Admin-Device-Id': deviceId } : {}),
    ...headers,
  };
};

export const buildUserHeaders = (headers: HeaderMap = {}): HeaderMap => {
  const accessToken = getStoredAccessToken();

  return {
    Authorization: `Bearer ${publicAnonKey}`,
    ...(accessToken ? { 'X-Access-Token': accessToken } : {}),
    ...headers,
  };
};

export const getStoredAccessToken = () => {
  const session = safeParse<{ access_token?: string }>(localStorage.getItem('sms_session'));
  return session?.access_token?.trim() || '';
};

export const getStoredCourierToken = () => {
  const session = safeParse<any>(localStorage.getItem('courierSession'));
  const token = String(
    session?.token ||
      session?.session?.token ||
      session?.data?.token ||
      session?.courier?.token ||
      '',
  ).trim();
  return token;
};

export const buildCourierHeaders = (headers: HeaderMap = {}): HeaderMap => {
  const courierToken = getStoredCourierToken();

  return {
    apikey: publicAnonKey,
    ...(courierToken ? { 'X-Courier-Token': courierToken } : {}),
    ...headers,
  };
};

export const getStoredBranchToken = () => {
  const session = safeParse<{ token?: string; branchToken?: string; branch_token?: string }>(
    localStorage.getItem('branchSession'),
  );
  return (
    session?.token?.trim() ||
    session?.branchToken?.trim() ||
    session?.branch_token?.trim() ||
    ''
  );
};

export const getStoredBranchJwt = () => {
  const session = safeParse<{ jwt?: string }>(localStorage.getItem('branchSession'));
  return session?.jwt?.trim() || '';
};

export const buildBranchHeaders = (headers: HeaderMap = {}): HeaderMap => {
  const branchToken = getStoredBranchToken();
  const branchJwt = getStoredBranchJwt();

  // Edge Functions (verify_jwt) expect Authorization: Bearer <anon JWT>. Filial Supabase
  // sessiyasi alohida headerda — server validateBranchSession o‘qiydi.
  return {
    apikey: publicAnonKey,
    Authorization: `Bearer ${publicAnonKey}`,
    ...(branchToken ? { 'X-Branch-Token': branchToken } : {}),
    ...(branchJwt ? { 'X-Branch-Supabase-Jwt': branchJwt } : {}),
    ...headers,
  };
};

/** Ijara paneli: `rentalProviderSession` bo‘lsa — X-Rental-Provider-Token; aks holda filial sessiyasi */
export const buildRentalPanelHeaders = (headers: HeaderMap = {}): HeaderMap => {
  const parsed = safeParse<{ token?: string }>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('rentalProviderSession') : null,
  );
  const t = parsed?.token?.trim();
  if (t) {
    return {
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      'X-Rental-Provider-Token': t,
      ...headers,
    };
  }
  return buildBranchHeaders(headers);
};
