import {
  API_BASE_URL,
  DEV_API_BASE_URL,
  publicAnonKey,
} from '../../../utils/supabase/info';
import type { DillerData } from './dillerData';

export function getDillerApiBase(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return DEV_API_BASE_URL;
  }
  return API_BASE_URL;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${publicAnonKey}`,
    'Content-Type': 'application/json',
    'X-Diller-Token': token,
  };
}

export type DillerLoginResult =
  | { ok: true; token: string; login: string; displayName: string }
  | { ok: false; error: string };

export async function dillerApiLogin(login: string, password: string): Promise<DillerLoginResult> {
  try {
    const res = await fetch(`${getDillerApiBase()}/diller/login`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ login: login.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.token) {
      return {
        ok: true,
        token: String(data.token),
        login: String(data.login || login),
        displayName: String(data.displayName || login),
      };
    }
    return { ok: false, error: String(data.error || 'Kirishda xatolik') };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}

export async function dillerApiValidateSession(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${getDillerApiBase()}/diller/session`, {
      headers: authHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.success === true;
  } catch {
    return false;
  }
}

export type DillerFetchResult =
  | { ok: true; data: DillerData | null; updatedAt: string | null }
  | { ok: false; error: string; unauthorized?: boolean };

export async function dillerApiFetchData(token: string): Promise<DillerFetchResult> {
  try {
    const res = await fetch(`${getDillerApiBase()}/diller/data`, {
      headers: authHeaders(token),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      return { ok: false, error: 'Sessiya tugagan', unauthorized: true };
    }
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Ma’lumot yuklanmadi') };
    }
    return {
      ok: true,
      data: (body.data as DillerData | null) ?? null,
      updatedAt: body.updatedAt ? String(body.updatedAt) : null,
    };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}

export type DillerPushResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string; unauthorized?: boolean };

export async function dillerApiPushData(token: string, data: DillerData): Promise<DillerPushResult> {
  try {
    const res = await fetch(`${getDillerApiBase()}/diller/data`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ data }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      return { ok: false, error: 'Sessiya tugagan', unauthorized: true };
    }
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Saqlashda xatolik') };
    }
    return {
      ok: true,
      updatedAt: String(body.updatedAt || new Date().toISOString()),
    };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}
