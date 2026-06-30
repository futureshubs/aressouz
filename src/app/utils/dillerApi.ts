import {
  publicAnonKey,
} from '../../../utils/supabase/info';
import { edgeFunctionBaseUrl } from './edgeFunctionBaseUrl';
import type { DillerData, DillerShopOrder, DillerShopOrderStatus } from './dillerData';
import { getDillerBrandLabel } from './dillerData';

/** Vercel prod: same-origin `/functions/v1/...` (kassa bilan bir xil). */
export function getDillerApiBase(): string {
  return edgeFunctionBaseUrl();
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${publicAnonKey}`,
    'Content-Type': 'application/json',
    'X-Diller-Token': token,
  };
}

export type DillerLoginResult =
  | { ok: true; token: string; dealerId: string; login: string; displayName: string }
  | { ok: false; error: string };

export function createOfflineDillerToken(): string {
  return `diller_local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isOfflineDillerToken(token: string): boolean {
  return token.startsWith('diller_local_');
}

/** Server mavjudligi — `/health` (konsolda 400 login xatosi chiqmasin) */
export async function dillerApiPing(): Promise<boolean> {
  try {
    const res = await fetch(`${getDillerApiBase()}/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data?.status === 'ok' || res.ok;
  } catch {
    return false;
  }
}

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
        dealerId: String(data.dealerId || ''),
        login: String(data.login || login),
        displayName: String(data.displayName || login),
      };
    }
    if (res.status === 404) {
      return { ok: false, error: 'SERVER_NOT_DEPLOYED' };
    }
    return { ok: false, error: String(data.error || 'Kirishda xatolik') };
  } catch {
    return { ok: false, error: 'NETWORK_ERROR' };
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

export type QrcodeCatalogProduct = {
  id: string;
  name: string;
  unitPrice: number;
  unit: string;
  stock: number;
  imageUrl?: string;
};

export type QrcodeCatalog = {
  companyName: string;
  phone: string;
  telegram: string;
  instagram: string;
  products: QrcodeCatalogProduct[];
};

export type QrcodeMatchedStore = {
  id: string;
  name: string;
  address: string;
  contactName: string;
  phone: string;
};

export async function dillerApiLookupQrcodeStore(
  orderToken: string,
  phone: string,
): Promise<{ ok: true; stores: QrcodeMatchedStore[] } | { ok: false; error: string }> {
  try {
    const q = encodeURIComponent(phone.trim());
    const res = await fetch(
      `${getDillerApiBase()}/public/qrcode/${encodeURIComponent(orderToken)}/store?phone=${q}`,
      {
        headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey },
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Do‘kon qidirilmadi') };
    }
    const stores: QrcodeMatchedStore[] = Array.isArray(body.stores)
      ? body.stores.map((s: QrcodeMatchedStore) => ({
          id: String(s.id ?? ''),
          name: String(s.name ?? ''),
          address: String(s.address ?? ''),
          contactName: String(s.contactName ?? ''),
          phone: String(s.phone ?? ''),
        }))
      : body.store
        ? [
            {
              id: String(body.store.id ?? ''),
              name: String(body.store.name ?? ''),
              address: String(body.store.address ?? ''),
              contactName: String(body.store.contactName ?? ''),
              phone: String(body.store.phone ?? ''),
            },
          ]
        : [];
    return { ok: true, stores };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}

export async function dillerApiFetchQrcodeCatalog(
  orderToken: string,
): Promise<{ ok: true; catalog: QrcodeCatalog } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${getDillerApiBase()}/public/qrcode/${encodeURIComponent(orderToken)}`,
      {
        headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey },
      },
    );
    const body = await res.json().catch(() => ({}));
    if (res.status === 404 && !body?.success && !body?.error) {
      return {
        ok: false,
        error: 'Server yangilanmagan — diller API deploy qiling (public/qrcode)',
      };
    }
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Katalog topilmadi') };
    }
    return {
      ok: true,
      catalog: {
        companyName: getDillerBrandLabel(String(body.companyName ?? '')),
        phone: String(body.phone ?? ''),
        telegram: String(body.telegram ?? ''),
        instagram: String(body.instagram ?? ''),
        products: Array.isArray(body.products)
          ? body.products.map((p: QrcodeCatalogProduct) => ({
              id: String(p.id ?? ''),
              name: String(p.name ?? ''),
              unitPrice: Math.round(Number(p.unitPrice) || 0),
              unit: String(p.unit ?? 'dona'),
              stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
              imageUrl: p.imageUrl ? String(p.imageUrl).trim() : undefined,
            }))
          : [],
      },
    };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}

export async function dillerApiSubmitQrcodeOrder(
  orderToken: string,
  payload: {
    customerName: string;
    customerPhone: string;
    note?: string;
    storeId?: string;
    items: { productId: string; qty: number }[];
  },
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${getDillerApiBase()}/public/qrcode/${encodeURIComponent(orderToken)}/orders`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Buyurtma yuborilmadi') };
    }
    return { ok: true, orderId: String(body.order?.id ?? '') };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}

export async function dillerApiReconstructFromOrders(
  token: string,
): Promise<
  | { ok: true; stats: { sales: number; products: number; stores: number; shopOrders: number } }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${getDillerApiBase()}/diller/reconstruct-from-orders`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Tiklashda xatolik') };
    }
    const stats = body.stats || {};
    return {
      ok: true,
      stats: {
        sales: Number(stats.sales || 0),
        products: Number(stats.products || 0),
        stores: Number(stats.stores || 0),
        shopOrders: Number(stats.shopOrders || 0),
      },
    };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}

export async function dillerApiRestoreBestWorkspace(
  token: string,
): Promise<
  | {
      ok: true;
      restored: boolean;
      sourceKey: string | null;
      stats: { sales: number; products: number; stores: number; firms: number };
      candidates: Array<{ key: string; score: number; sales: number; products: number; stores: number; firms: number }>;
    }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${getDillerApiBase()}/diller/restore-best`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Tiklashda xatolik') };
    }
    return {
      ok: true,
      restored: Boolean(body.restored),
      sourceKey: body.sourceKey ? String(body.sourceKey) : null,
      stats: body.stats || { sales: 0, products: 0, stores: 0, firms: 0 },
      candidates: Array.isArray(body.candidates) ? body.candidates : [],
    };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}

export async function dillerApiFetchShopOrders(
  token: string,
): Promise<{ ok: true; orders: DillerShopOrder[] } | { ok: false; error: string }> {
  if (isOfflineDillerToken(token)) {
    return { ok: true, orders: [] };
  }
  try {
    const res = await fetch(`${getDillerApiBase()}/diller/orders`, {
      headers: authHeaders(token),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Buyurtmalar yuklanmadi') };
    }
    return { ok: true, orders: Array.isArray(body.orders) ? body.orders : [] };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}

export async function dillerApiPatchShopOrderStatus(
  token: string,
  orderId: string,
  status: DillerShopOrderStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isOfflineDillerToken(token)) {
    return { ok: false, error: 'Oflayn rejimda server bilan ishlamaydi' };
  }
  try {
    const res = await fetch(`${getDillerApiBase()}/diller/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ status }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) {
      return { ok: false, error: String(body.error || 'Yangilanmadi') };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Serverga ulanishda xatolik' };
  }
}
