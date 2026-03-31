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

export const getStoredAdminCode = () => {
  const session = safeParse<{ code?: string; role?: string }>(localStorage.getItem('adminSession'));
  if (session?.code?.trim()) {
    return session.code.trim();
  }

  // Backward compatibility for older admin sessions saved before `code` was persisted.
  if (session?.role === 'admin') {
    return '0099';
  }

  return '';
};

export const getStoredAccessToken = () => {
  const session = safeParse<{ access_token?: string }>(localStorage.getItem('sms_session'));
  return session?.access_token?.trim() || '';
};

export const buildPublicHeaders = (headers: HeaderMap = {}): HeaderMap => ({
  apikey: publicAnonKey,
  Authorization: `Bearer ${publicAnonKey}`,
  ...headers,
});

export const buildAdminHeaders = (headers: HeaderMap = {}): HeaderMap => {
  const adminCode = getStoredAdminCode();

  return {
    apikey: publicAnonKey,
    Authorization: `Bearer ${publicAnonKey}`,
    ...(adminCode ? { 'X-Admin-Code': adminCode } : {}),
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
