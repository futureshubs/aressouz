import { edgeFunctionBaseUrl } from '../utils/edgeFunctionBaseUrl';
import { buildAdminHeaders } from './requestAuth';

export type DillerWorkspaceStats = {
  sales: number;
  products: number;
  stores: number;
  firms: number;
  shopOrders: number;
  expenses: number;
  totalSalesAmount: number;
  totalDebtAmount: number;
  totalPaidAmount: number;
  warehouseQty: number;
};

export type AdminDillerRow = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  passportSeries: string;
  gender: 'male' | 'female';
  birthDate: string;
  startDate: string;
  login: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  stats: DillerWorkspaceStats;
};

export type AdminDillersListResponse = {
  success: boolean;
  dealers: AdminDillerRow[];
  totals: {
    sales: number;
    products: number;
    stores: number;
    firms: number;
    totalSalesAmount: number;
    totalDebtAmount: number;
  };
  count: number;
  error?: string;
};

export type CreateDillerInput = {
  fullName: string;
  phone: string;
  address: string;
  passportSeries: string;
  gender: 'male' | 'female';
  birthDate: string;
  startDate: string;
  login: string;
  password: string;
};

const base = () => edgeFunctionBaseUrl();

export async function fetchAdminDillers(): Promise<AdminDillersListResponse> {
  const res = await fetch(`${base()}/admin/dillers`, {
    headers: buildAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return {
      success: false,
      dealers: [],
      totals: {
        sales: 0,
        products: 0,
        stores: 0,
        firms: 0,
        totalSalesAmount: 0,
        totalDebtAmount: 0,
      },
      count: 0,
      error: String(data.error || 'Yuklashda xatolik'),
    };
  }
  return data as AdminDillersListResponse;
}

export async function createAdminDiller(
  input: CreateDillerInput,
): Promise<{ ok: true; dealer: AdminDillerRow } | { ok: false; error: string }> {
  const res = await fetch(`${base()}/admin/dillers`, {
    method: 'POST',
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { ok: false, error: String(data.error || 'Saqlashda xatolik') };
  }
  return { ok: true, dealer: data.dealer as AdminDillerRow };
}

export async function fetchAdminDillerDetail(id: string) {
  const res = await fetch(`${base()}/admin/dillers/${encodeURIComponent(id)}`, {
    headers: buildAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { ok: false as const, error: String(data.error || 'Topilmadi') };
  }
  return { ok: true as const, ...data };
}

export type PatchDillerInput = Partial<CreateDillerInput> & {
  active?: boolean;
};

export async function patchAdminDiller(
  id: string,
  input: PatchDillerInput,
): Promise<{ ok: true; dealer: AdminDillerRow } | { ok: false; error: string }> {
  const res = await fetch(`${base()}/admin/dillers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { ok: false, error: String(data.error || 'Yangilashda xatolik') };
  }
  return { ok: true, dealer: data.dealer as AdminDillerRow };
}
