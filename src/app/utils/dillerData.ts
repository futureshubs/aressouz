import { getPublicSiteOrigin } from '../config/site';

export type DillerFirm = {
  id: string;
  /** Firma nomi */
  name: string;
  /** Ega / mas‘ul shaxs */
  ownerName: string;
  address: string;
  /** Firma qanday mahsulot beradi */
  productName: string;
  phone: string;
  createdAt: string;
};

export type DillerProductUnit = 'dona' | 'kg' | 'quti';

export type DillerProduct = {
  id: string;
  name: string;
  firmName: string;
  firmId?: string;
  sku: string;
  /** Sotish narxi (do‘konga) */
  unitPrice: number;
  /** Firmadan olish narxi */
  buyPrice: number;
  unit: DillerProductUnit | string;
  /** Faqat /qrcode buyurtma sahifasida ko‘rinadi */
  qrcodeImageUrl?: string;
  createdAt: string;
};

export type DillerStore = {
  id: string;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  lat?: number;
  lng?: number;
  createdAt: string;
};

export type DillerPaymentType = 'naqd' | 'qarz';

/** Xarajat to‘lov usuli */
export type DillerExpensePayment = 'naqd' | 'karta';

export type DillerExpense = {
  id: string;
  /** Nima uchun (maqsad) */
  purpose: string;
  amount: number;
  paymentMethod: DillerExpensePayment;
  note: string;
  createdAt: string;
};

/** Balans — qo‘lda kiritilgan kirim / chiqim */
export type DillerBalanceKind = 'kirim' | 'chiqim';
export type DillerBalanceChannel = 'naqd' | 'karta';

export type DillerBalanceEntry = {
  id: string;
  kind: DillerBalanceKind;
  channel: DillerBalanceChannel;
  amount: number;
  purpose: string;
  note: string;
  createdAt: string;
};

export type DillerDebtPayment = {
  amount: number;
  at: string;
};

export type DillerSale = {
  id: string;
  storeId: string;
  productId: string;
  qty: number;
  /** Mahsulot ro‘yxat narxi (chegirmasiz) */
  listUnitPrice: number;
  /** Chegirmadan keyin birlik narxi */
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  paymentType: DillerPaymentType;
  /** Oldindan olingan summa */
  paidAmount: number;
  /** Qarz qoldig‘i */
  debtAmount: number;
  /** Sotuv paytida ochilgan qarz (keyin o‘zgarmaydi) */
  initialDebtAmount?: number;
  /** Keyinchalik olingan qarz to‘lovlari */
  debtPayments?: DillerDebtPayment[];
  /** Qarz qaytarish sanasi (ISO date yoki bo‘sh) */
  debtDueDate: string;
  note: string;
  createdAt: string;
  /** QR buyurtmadan kelgan sotuv */
  shopOrderId?: string;
  /** Bekor qilingan sotuv */
  cancelled?: boolean;
  cancelledAt?: string;
};

export type DillerWarehouseRow = {
  productId: string;
  qty: number;
};

export type DillerProfile = {
  companyName: string;
  directorName: string;
  phone: string;
  region: string;
  note: string;
  /** Buyurtma QR havolasi tokeni */
  orderToken?: string;
  /** Buyurtma uchun aloqa */
  orderPhone?: string;
  telegram?: string;
  instagram?: string;
};

/** Mijozga ko‘rinadigan brend nomi — «Aresso Diller MChJ» emas, faqat Aresso */
export function getDillerBrandLabel(companyName?: string | null): string {
  const raw = (companyName ?? '').trim();
  if (!raw) return 'Aresso';
  if (/aresso/i.test(raw) && (/\bdiller\b/i.test(raw) || /\bmchj\b/i.test(raw) || /\bmchk\b/i.test(raw))) {
    return 'Aresso';
  }
  const cleaned = raw
    .replace(/\bdiller\s+mchj\b/gi, '')
    .replace(/\bmchj\b/gi, '')
    .replace(/\bdiller\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /^aresso$/i.test(cleaned)) return 'Aresso';
  return cleaned;
}

function normalizeProfileCompanyName(companyName: unknown): string {
  return getDillerBrandLabel(String(companyName ?? ''));
}

export type DillerShopOrderItem = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  unit?: string;
};

export type DillerShopOrderStatus = 'pending' | 'accepted' | 'rejected' | 'done';

export type DillerShopOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: DillerShopOrderItem[];
  total: number;
  note: string;
  status: DillerShopOrderStatus;
  createdAt: string;
  storeId?: string;
  storeName?: string;
  customerAddress?: string;
  /** Qabul qilinganda ombordan ayirilgan */
  warehouseReserved?: boolean;
  /** Sotuv tasdiqlanganda yaratilgan sotuvlar */
  saleIds?: string[];
  completedAt?: string;
};

export type DillerData = {
  profile: DillerProfile;
  firms: DillerFirm[];
  products: DillerProduct[];
  stores: DillerStore[];
  warehouse: DillerWarehouseRow[];
  sales: DillerSale[];
  expenses: DillerExpense[];
  balanceEntries: DillerBalanceEntry[];
  shopOrders: DillerShopOrder[];
};

const DATA_KEY_PREFIX = 'aresso:diller:data:v5:';

export function getDillerDataStorageKey(dealerId?: string): string {
  if (dealerId) return `${DATA_KEY_PREFIX}${dealerId}`;
  try {
    const raw = localStorage.getItem('dillerSession');
    if (raw) {
      const sess = JSON.parse(raw) as { dealerId?: string };
      if (sess?.dealerId) return `${DATA_KEY_PREFIX}${sess.dealerId}`;
    }
  } catch {
    /* ignore */
  }
  return `${DATA_KEY_PREFIX}anon`;
}

/** Eski umumiy kalitlarni tozalash */
export function clearLegacyDillerLocalData(): void {
  if (typeof localStorage === 'undefined') return;
  const legacy = [
    'aresso:diller:data:v1',
    'aresso:diller:data:v2',
    'aresso:diller:data:v3',
    'aresso:diller:data:v4',
    'aresso:diller:meta:v1',
    'dillerData',
  ];
  for (const k of legacy) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

export const DILLER_PRODUCT_UNITS: { value: DillerProductUnit; label: string }[] = [
  { value: 'dona', label: 'Dona' },
  { value: 'kg', label: 'Kilogramm (kg)' },
  { value: 'quti', label: 'Quti' },
];

function normalizeUnit(unit: unknown): DillerProductUnit | string {
  const u = String(unit ?? 'dona').trim().toLowerCase();
  if (u === 'kg' || u === 'kilogramm') return 'kg';
  if (u === 'quti' || u === 'qadoq') return 'quti';
  return 'dona';
}

function normalizeDebtPayments(raw: unknown): DillerDebtPayment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const amount = Math.max(0, Math.round(Number((row as DillerDebtPayment)?.amount) || 0));
      const at = String((row as DillerDebtPayment)?.at ?? '').trim();
      if (amount <= 0 || !at) return null;
      return { amount, at };
    })
    .filter((row): row is DillerDebtPayment => row != null);
}

function normalizeSale(s: Partial<DillerSale> & { id: string }): DillerSale {
  const qty = Math.max(1, Math.floor(Number(s.qty) || 1));
  const listUnitPrice = Number(s.listUnitPrice) || Number(s.unitPrice) || 0;
  const unitPrice = Number(s.unitPrice) || listUnitPrice;
  const subtotal = Number(s.subtotal) || listUnitPrice * qty;
  const discountAmount = Math.min(subtotal, Math.max(0, Number(s.discountAmount) || 0));
  const discountPercent =
    Number(s.discountPercent) ||
    (subtotal > 0 ? Math.round((discountAmount / subtotal) * 1000) / 10 : 0);
  const total = Number(s.total) || Math.max(0, subtotal - discountAmount);
  const paymentType: DillerPaymentType = s.paymentType === 'qarz' ? 'qarz' : 'naqd';
  const paidAmount = Math.max(0, Number(s.paidAmount) ?? (paymentType === 'naqd' ? total : 0));
  const debtAmount = Math.max(0, Number(s.debtAmount) ?? Math.max(0, total - paidAmount));
  const debtPayments = normalizeDebtPayments(s.debtPayments);
  const paidLater = debtPayments.reduce((sum, row) => sum + row.amount, 0);
  const initialDebtAmount =
    paymentType === 'qarz'
      ? Math.max(
          0,
          Number(s.initialDebtAmount) ||
            Math.max(0, (debtAmount ?? 0) + paidLater) ||
            Math.max(0, total - paidAmount),
        )
      : 0;
  return {
    id: s.id,
    storeId: String(s.storeId ?? ''),
    productId: String(s.productId ?? ''),
    qty,
    listUnitPrice,
    unitPrice: qty > 0 ? Math.round(total / qty) : unitPrice,
    discountPercent,
    discountAmount,
    subtotal,
    total,
    paymentType,
    paidAmount: paymentType === 'naqd' ? total : paidAmount,
    debtAmount: paymentType === 'naqd' ? 0 : debtAmount,
    initialDebtAmount: paymentType === 'qarz' ? initialDebtAmount : undefined,
    debtPayments: debtPayments.length > 0 ? debtPayments : undefined,
    debtDueDate: String(s.debtDueDate ?? '').trim(),
    note: String(s.note ?? '').trim(),
    createdAt: s.createdAt ?? new Date().toISOString(),
    shopOrderId: s.shopOrderId ? String(s.shopOrderId) : undefined,
    cancelled: Boolean(s.cancelled),
    cancelledAt: s.cancelledAt ? String(s.cancelledAt) : undefined,
  };
}

function normalizeStore(s: Partial<DillerStore> & { id: string }): DillerStore {
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  return {
    id: s.id,
    name: String(s.name ?? '').trim(),
    address: String(s.address ?? '').trim(),
    phone: String(s.phone ?? '').trim(),
    contactName: String(s.contactName ?? '').trim(),
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    createdAt: s.createdAt ?? new Date().toISOString(),
  };
}

/** «Do‘kon (2)» kabi qo‘shimchani olib tashlaydi */
export function stripStoreNameSuffix(name: string): string {
  return name.trim().replace(/\s*\(\d+\)\s*$/, '').trim();
}

export function normalizeStoreNameKey(name: string): string {
  return stripStoreNameSuffix(name).toLowerCase();
}

/** Bir xil nom bo‘lsa avtomatik (1), (2) … qo‘shadi */
export function ensureUniqueStoreName(
  rawName: string,
  stores: DillerStore[],
  excludeStoreId?: string,
): string {
  const base = stripStoreNameSuffix(rawName.trim());
  if (!base) return rawName.trim();

  const others = stores.filter((s) => s.id !== excludeStoreId);
  const baseKey = base.toLowerCase();
  const conflicting = others.filter(
    (s) => stripStoreNameSuffix(s.name).toLowerCase() === baseKey,
  );

  if (conflicting.length === 0) return base;

  const baseTaken = conflicting.some((s) => s.name.trim().toLowerCase() === baseKey);
  if (!baseTaken) return base;

  const used = new Set<number>();
  for (const s of conflicting) {
    const match = s.name.trim().match(/\(\s*(\d+)\s*\)\s*$/);
    if (match) used.add(Number(match[1]));
  }

  let n = 1;
  while (used.has(n)) n += 1;
  return `${base} (${n})`;
}

function reconcileStoreNames(stores: DillerStore[]): DillerStore[] {
  const result: DillerStore[] = [];
  for (const store of stores) {
    const uniqueName = ensureUniqueStoreName(store.name, result);
    result.push(normalizeStore({ ...store, name: uniqueName }));
  }
  return result;
}

function normalizeExpense(e: Partial<DillerExpense> & { id: string }): DillerExpense {
  const method = String(e.paymentMethod ?? 'naqd').toLowerCase();
  return {
    id: e.id,
    purpose: String(e.purpose ?? '').trim(),
    amount: Math.max(0, Math.round(Number(e.amount) || 0)),
    paymentMethod: method === 'karta' ? 'karta' : 'naqd',
    note: String(e.note ?? '').trim(),
    createdAt: e.createdAt ?? new Date().toISOString(),
  };
}

function normalizeBalanceEntry(e: Partial<DillerBalanceEntry> & { id: string }): DillerBalanceEntry {
  const kind = e.kind === 'chiqim' ? 'chiqim' : 'kirim';
  const channel = e.channel === 'karta' ? 'karta' : 'naqd';
  return {
    id: e.id,
    kind,
    channel,
    amount: Math.max(0, Math.round(Number(e.amount) || 0)),
    purpose: String(e.purpose ?? '').trim(),
    note: String(e.note ?? '').trim(),
    createdAt: e.createdAt ?? new Date().toISOString(),
  };
}

function normalizeShopOrder(o: Partial<DillerShopOrder> & { id: string }): DillerShopOrder {
  const items = Array.isArray(o.items)
    ? o.items.map((it) => ({
        productId: String(it.productId ?? ''),
        productName: String(it.productName ?? ''),
        qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
        unitPrice: Math.max(0, Math.round(Number(it.unitPrice) || 0)),
        lineTotal: Math.max(0, Math.round(Number(it.lineTotal) || 0)),
        unit: String(it.unit ?? 'dona'),
      }))
    : [];
  const total =
    Math.max(0, Math.round(Number(o.total) || 0)) ||
    items.reduce((s, it) => s + it.lineTotal, 0);
  const status = o.status;
  const validStatus: DillerShopOrderStatus =
    status === 'accepted' || status === 'rejected' || status === 'done' ? status : 'pending';
  return {
    id: o.id,
    customerName: String(o.customerName ?? '').trim(),
    customerPhone: String(o.customerPhone ?? '').trim(),
    items,
    total,
    note: String(o.note ?? '').trim(),
    status: validStatus,
    createdAt: o.createdAt ?? new Date().toISOString(),
    storeId: o.storeId ? String(o.storeId) : undefined,
    storeName: o.storeName ? String(o.storeName).trim() : undefined,
    customerAddress: o.customerAddress ? String(o.customerAddress).trim() : undefined,
    warehouseReserved: Boolean(o.warehouseReserved),
    saleIds: Array.isArray(o.saleIds) ? o.saleIds.map(String) : undefined,
    completedAt: o.completedAt ? String(o.completedAt) : undefined,
  };
}

function normalizeProduct(p: Partial<DillerProduct> & { id: string }): DillerProduct {
  const sell = Number(p.unitPrice) || 0;
  const buy = typeof p.buyPrice === 'number' ? p.buyPrice : Math.round(sell * 0.85);
  return {
    id: p.id,
    name: String(p.name ?? '').trim(),
    firmName: String(p.firmName ?? '').trim(),
    firmId: p.firmId,
    sku: String(p.sku ?? '').trim() || '—',
    unitPrice: sell,
    buyPrice: buy,
    unit: normalizeUnit(p.unit),
    qrcodeImageUrl: p.qrcodeImageUrl ? String(p.qrcodeImageUrl).trim() : undefined,
    createdAt: p.createdAt ?? new Date().toISOString(),
  };
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function seedFirms(): DillerFirm[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'firm_demo_1',
      name: 'Sarbon Oqsuv',
      ownerName: 'Karimov Alisher',
      address: 'Toshkent, Sergeli tumani',
      productName: 'Suv 0.5L (24 dona)',
      phone: '+998901234567',
      createdAt: now,
    },
    {
      id: 'firm_demo_2',
      name: 'Beauty Line',
      ownerName: 'Rahimova Dilnoza',
      address: 'Toshkent, Yunusobod',
      productName: 'Shampun 400ml',
      phone: '+998903334455',
      createdAt: now,
    },
  ];
}

function seedData(): DillerData {
  const firms = seedFirms();
  const p1: DillerProduct = normalizeProduct({
    id: 'prd_demo_1',
    name: 'Suv 0.5L (24 dona)',
    firmName: firms[0].name,
    firmId: firms[0].id,
    sku: 'SB-500-24',
    unitPrice: 48000,
    buyPrice: 41000,
    unit: 'quti',
    createdAt: new Date().toISOString(),
  });
  const p2: DillerProduct = normalizeProduct({
    id: 'prd_demo_2',
    name: 'Shampun 400ml',
    firmName: firms[1].name,
    firmId: firms[1].id,
    sku: 'BL-SH-400',
    unitPrice: 22000,
    buyPrice: 18500,
    unit: 'dona',
    createdAt: new Date().toISOString(),
  });
  const s1: DillerStore = normalizeStore({
    id: 'store_demo_1',
    name: 'Mini market «Oqtepa»',
    address: 'Toshkent, Chilonzor',
    phone: '+998901112233',
    contactName: 'Jasur',
    lat: 41.2856,
    lng: 69.2034,
    createdAt: new Date().toISOString(),
  });
  const s2: DillerStore = normalizeStore({
    id: 'store_demo_2',
    name: 'Do‘kon «Baraka»',
    address: 'Toshkent, Yunusobod',
    phone: '+998903334455',
    contactName: 'Dilnoza',
    lat: 41.3473,
    lng: 69.2877,
    createdAt: new Date().toISOString(),
  });
  return {
    profile: {
      companyName: 'Aresso',
      directorName: 'Admin',
      phone: '+998900000000',
      region: 'Toshkent shahri',
      note: 'Firmalardan mahsulot olib do‘konlarga tarqatish.',
    },
    firms,
    products: [p1, p2],
    stores: [s1, s2],
    warehouse: [
      { productId: p1.id, qty: 120 },
      { productId: p2.id, qty: 85 },
    ],
    sales: [],
    shopOrders: [],
  };
}

function firmsFromLegacyProducts(products: DillerProduct[]): DillerFirm[] {
  const seen = new Map<string, DillerFirm>();
  for (const p of products) {
    const key = (p.firmName || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.set(key, {
      id: uid('firm'),
      name: p.firmName.trim(),
      ownerName: '',
      address: '',
      productName: p.name,
      phone: '',
      createdAt: new Date().toISOString(),
    });
  }
  return [...seen.values()];
}

/** Bo‘sh ish maydoni (demo seedsiz) */
export function createEmptyDillerData(): DillerData {
  return {
    profile: {
      companyName: '',
      directorName: '',
      phone: '',
      region: '',
      note: '',
    },
    firms: [],
    products: [],
    stores: [],
    warehouse: [],
    sales: [],
    expenses: [],
    balanceEntries: [],
    shopOrders: [],
  };
}

export function hasDillerDataContent(data: DillerData): boolean {
  return (
    data.firms.length > 0 ||
    data.products.length > 0 ||
    data.stores.length > 0 ||
    data.sales.length > 0 ||
    data.expenses.length > 0 ||
    (data.balanceEntries?.length ?? 0) > 0 ||
    (data.shopOrders?.length ?? 0) > 0 ||
    Boolean(data.profile.orderToken?.trim()) ||
    data.warehouse.some((w) => (w.qty ?? 0) > 0)
  );
}

export function normalizeDillerData(raw: Partial<DillerData> | null): DillerData {
  const base = createEmptyDillerData();
  if (!raw) return base;

  const products = (Array.isArray(raw.products) ? raw.products : base.products).map((p) =>
    normalizeProduct(p as DillerProduct),
  );
  let firms = Array.isArray(raw.firms) ? raw.firms : [];
  if (firms.length === 0 && products.length > 0) {
    firms = firmsFromLegacyProducts(products);
  }

  return {
    profile: {
      ...base.profile,
      ...(raw.profile ?? {}),
      companyName: normalizeProfileCompanyName(
        (raw.profile as DillerProfile | undefined)?.companyName ?? base.profile.companyName,
      ),
    },
    firms,
    products,
    stores: reconcileStoreNames(
      (Array.isArray(raw.stores) ? raw.stores : base.stores).map((s) =>
        normalizeStore(s as DillerStore),
      ),
    ),
    warehouse: Array.isArray(raw.warehouse) ? raw.warehouse : base.warehouse,
    sales: (Array.isArray(raw.sales) ? raw.sales : []).map((s) => normalizeSale(s as DillerSale)),
    expenses: (Array.isArray(raw.expenses) ? raw.expenses : []).map((e) =>
      normalizeExpense(e as DillerExpense),
    ),
    balanceEntries: (Array.isArray(raw.balanceEntries) ? raw.balanceEntries : []).map((e) =>
      normalizeBalanceEntry(e as DillerBalanceEntry),
    ),
    shopOrders: (Array.isArray(raw.shopOrders) ? raw.shopOrders : []).map((o) =>
      normalizeShopOrder(o as DillerShopOrder),
    ),
  };
}

/** Barcha mahalliy kalitlardan (v1–v4 va boshqalar) ma’lumotni birlashtirib tiklash */
export function recoverDillerDataFromAllLocalSnapshots(): DillerData {
  let merged = createEmptyDillerData();
  if (typeof localStorage === 'undefined') return merged;

  const keys = new Set<string>([getDillerDataStorageKey()]);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith('aresso:diller:') || k === 'dillerData' || k.startsWith('diller_')) {
      keys.add(k);
    }
  }

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw?.trim()) continue;
      const parsed = JSON.parse(raw) as Partial<DillerData> | { data?: Partial<DillerData> };
      const candidate =
        parsed &&
        typeof parsed === 'object' &&
        'data' in parsed &&
        parsed.data &&
        typeof parsed.data === 'object'
          ? normalizeDillerData(parsed.data as Partial<DillerData>)
          : normalizeDillerData(parsed as Partial<DillerData>);
      if (hasDillerDataContent(candidate)) {
        merged = mergeDillerData(merged, candidate);
      }
    } catch {
      /* ignore */
    }
  }

  return merged;
}

/** Mahalliy kesh — faqat joriy diller kaliti */
export function loadDillerData(): DillerData {
  try {
    const raw = localStorage.getItem(getDillerDataStorageKey());
    if (!raw?.trim()) return createEmptyDillerData();
    return normalizeDillerData(JSON.parse(raw) as Partial<DillerData>);
  } catch {
    return createEmptyDillerData();
  }
}

export function saveDillerData(data: DillerData): void {
  try {
    localStorage.setItem(getDillerDataStorageKey(), JSON.stringify(normalizeDillerData(data)));
  } catch (e) {
    console.error('Diller ma’lumot saqlanmadi:', e);
  }
}

export function createFirm(
  data: DillerData,
  input: Omit<DillerFirm, 'id' | 'createdAt'>,
): DillerData {
  const firm: DillerFirm = {
    ...input,
    name: input.name.trim(),
    ownerName: input.ownerName.trim(),
    address: input.address.trim(),
    productName: input.productName.trim(),
    phone: input.phone.trim(),
    id: uid('firm'),
    createdAt: new Date().toISOString(),
  };
  return { ...data, firms: [firm, ...data.firms] };
}

export function deleteFirm(data: DillerData, firmId: string): DillerData {
  const firm = data.firms.find((f) => f.id === firmId);
  return {
    ...data,
    firms: data.firms.filter((f) => f.id !== firmId),
    products: data.products.filter((p) => p.firmId !== firmId && p.firmName !== firm?.name),
  };
}

export function updateFirm(
  data: DillerData,
  firmId: string,
  patch: Partial<Omit<DillerFirm, 'id' | 'createdAt'>>,
): DillerData {
  const firm = data.firms.find((f) => f.id === firmId);
  if (!firm) return data;
  const nextName = patch.name != null ? String(patch.name).trim() : firm.name;
  const updated: DillerFirm = {
    ...firm,
    name: nextName,
    ownerName: patch.ownerName != null ? String(patch.ownerName).trim() : firm.ownerName,
    address: patch.address != null ? String(patch.address).trim() : firm.address,
    productName: patch.productName != null ? String(patch.productName).trim() : firm.productName,
    phone: patch.phone != null ? String(patch.phone).trim() : firm.phone,
  };
  return {
    ...data,
    firms: data.firms.map((f) => (f.id === firmId ? updated : f)),
    products: data.products.map((p) => {
      if (p.firmId === firmId || p.firmName === firm.name) {
        return { ...p, firmId, firmName: nextName };
      }
      return p;
    }),
  };
}

/** Sotuvni bekor qilish — omborga qaytaradi */
export function cancelSale(
  data: DillerData,
  saleId: string,
): { data: DillerData; error?: string } {
  const sale = data.sales.find((s) => s.id === saleId);
  if (!sale) return { data, error: 'Sotuv topilmadi' };
  if (sale.cancelled) return { data, error: 'Bu sotuv allaqachon bekor qilingan' };

  let next: DillerData = {
    ...data,
    sales: data.sales.map((s) =>
      s.id === saleId
        ? normalizeSale({
            ...s,
            cancelled: true,
            cancelledAt: new Date().toISOString(),
            debtAmount: 0,
            debtDueDate: '',
          })
        : s,
    ),
  };
  // QR buyurtmadan kelgan sotuvda ombor allaqachon rezervdan chiqarilgan bo‘lishi mumkin —
  // oddiy sotuvlarda omborga qaytaramiz
  if (!sale.shopOrderId || sale.productId) {
    next = adjustWarehouseQty(next, sale.productId, sale.qty);
  }
  return { data: next };
}

export function isActiveSale(sale: DillerSale): boolean {
  return !sale.cancelled;
}

export function getActiveSales(data: DillerData): DillerSale[] {
  return data.sales.filter(isActiveSale);
}

export function getWarehouseQty(data: DillerData, productId: string): number {
  return data.warehouse.find((w) => w.productId === productId)?.qty ?? 0;
}

export function setWarehouseQty(data: DillerData, productId: string, qty: number): DillerData {
  const next = Math.max(0, Math.floor(qty));
  const rows = data.warehouse.filter((w) => w.productId !== productId);
  if (next > 0) rows.push({ productId, qty: next });
  return { ...data, warehouse: rows };
}

export function adjustWarehouseQty(data: DillerData, productId: string, delta: number): DillerData {
  const current = getWarehouseQty(data, productId);
  return setWarehouseQty(data, productId, current + delta);
}

export function findProductBySku(data: DillerData, sku: string): DillerProduct | undefined {
  const key = sku.trim().toLowerCase();
  if (!key || key === '—') return undefined;
  return data.products.find((p) => p.sku.trim().toLowerCase() === key);
}

export function createProduct(
  data: DillerData,
  input: Omit<DillerProduct, 'id' | 'createdAt'>,
  initialStock = 0,
): { data: DillerData; error?: string } {
  const sku = input.sku.trim() || '—';
  if (sku !== '—' && findProductBySku(data, sku)) {
    return { data, error: 'Bu SKU allaqachon mavjud' };
  }
  const product: DillerProduct = normalizeProduct({
    ...input,
    sku,
    id: uid('prd'),
    createdAt: new Date().toISOString(),
  });
  let next: DillerData = { ...data, products: [...data.products, product] };
  if (initialStock > 0) {
    next = setWarehouseQty(next, product.id, initialStock);
  }
  return { data: next };
}

export function updateProduct(
  data: DillerData,
  productId: string,
  input: {
    name?: string;
    firmId?: string;
    firmName?: string;
    sku?: string;
    unitPrice?: number;
    buyPrice?: number;
    unit?: DillerProductUnit | string;
    qrcodeImageUrl?: string;
  },
  stock?: number,
): { data: DillerData; error?: string } {
  const idx = data.products.findIndex((p) => p.id === productId);
  if (idx < 0) return { data, error: 'Mahsulot topilmadi' };

  const existing = data.products[idx];
  const sku = (input.sku ?? existing.sku).trim() || '—';
  if (sku !== '—') {
    const dup = findProductBySku(data, sku);
    if (dup && dup.id !== productId) {
      return { data, error: 'Bu SKU allaqachon mavjud' };
    }
  }

  const firm =
    (input.firmId ? data.firms.find((f) => f.id === input.firmId) : undefined) ??
    data.firms.find((f) => f.id === existing.firmId);
  const firmName = (input.firmName ?? firm?.name ?? existing.firmName).trim();
  const firmId = input.firmId ?? existing.firmId ?? firm?.id;

  const product = normalizeProduct({
    ...existing,
    name: input.name ?? existing.name,
    firmName,
    firmId,
    sku,
    unitPrice: input.unitPrice ?? existing.unitPrice,
    buyPrice: input.buyPrice ?? existing.buyPrice,
    unit: input.unit ?? existing.unit,
    qrcodeImageUrl:
      input.qrcodeImageUrl !== undefined
        ? input.qrcodeImageUrl.trim() || undefined
        : existing.qrcodeImageUrl,
    id: productId,
    createdAt: existing.createdAt,
  });

  const products = [...data.products];
  products[idx] = product;
  let next: DillerData = { ...data, products };
  if (typeof stock === 'number') {
    next = setWarehouseQty(next, productId, stock);
  }
  return { data: next };
}

export function createExpense(
  data: DillerData,
  input: {
    purpose: string;
    amount: number;
    paymentMethod: DillerExpensePayment;
    note?: string;
    createdAt?: string;
  },
): { data: DillerData; error?: string } {
  const purpose = input.purpose.trim();
  if (!purpose) return { data, error: 'Nima uchun ishlatilganini yozing' };
  const amount = Math.round(Number(input.amount) || 0);
  if (amount <= 0) return { data, error: 'Summa 0 dan katta bo‘lishi kerak' };

  const expense = normalizeExpense({
    id: uid('exp'),
    purpose,
    amount,
    paymentMethod: input.paymentMethod,
    note: input.note ?? '',
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
  return { data: { ...data, expenses: [expense, ...data.expenses] } };
}

export function updateExpense(
  data: DillerData,
  expenseId: string,
  input: {
    purpose?: string;
    amount?: number;
    paymentMethod?: DillerExpensePayment;
    note?: string;
    createdAt?: string;
  },
): { data: DillerData; error?: string } {
  const idx = data.expenses.findIndex((e) => e.id === expenseId);
  if (idx < 0) return { data, error: 'Xarajat topilmadi' };

  const existing = data.expenses[idx];
  const purpose = (input.purpose ?? existing.purpose).trim();
  if (!purpose) return { data, error: 'Nima uchun ishlatilganini yozing' };
  const amount = Math.round(Number(input.amount ?? existing.amount) || 0);
  if (amount <= 0) return { data, error: 'Summa 0 dan katta bo‘lishi kerak' };

  const expense = normalizeExpense({
    ...existing,
    purpose,
    amount,
    paymentMethod: input.paymentMethod ?? existing.paymentMethod,
    note: input.note ?? existing.note,
    createdAt: input.createdAt ?? existing.createdAt,
    id: expenseId,
  });
  const expenses = [...data.expenses];
  expenses[idx] = expense;
  return { data: { ...data, expenses } };
}

export function deleteExpense(data: DillerData, expenseId: string): DillerData {
  return { ...data, expenses: data.expenses.filter((e) => e.id !== expenseId) };
}

export function createBalanceEntry(
  data: DillerData,
  input: {
    kind: DillerBalanceKind;
    channel: DillerBalanceChannel;
    purpose: string;
    amount: number;
    note?: string;
    createdAt?: string;
  },
): { data: DillerData; error?: string } {
  const purpose = input.purpose.trim();
  if (!purpose) return { data, error: 'Maqsadni yozing' };
  const amount = Math.round(Number(input.amount) || 0);
  if (amount <= 0) return { data, error: 'Summa 0 dan katta bo‘lishi kerak' };

  const entry = normalizeBalanceEntry({
    id: uid('bal'),
    kind: input.kind,
    channel: input.channel,
    purpose,
    amount,
    note: input.note ?? '',
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
  return { data: { ...data, balanceEntries: [entry, ...(data.balanceEntries ?? [])] } };
}

export function deleteBalanceEntry(data: DillerData, entryId: string): DillerData {
  return {
    ...data,
    balanceEntries: (data.balanceEntries ?? []).filter((e) => e.id !== entryId),
  };
}

export function updateBalanceEntry(
  data: DillerData,
  entryId: string,
  input: {
    kind?: DillerBalanceKind;
    channel?: DillerBalanceChannel;
    purpose?: string;
    amount?: number;
    note?: string;
    createdAt?: string;
  },
): { data: DillerData; error?: string } {
  const idx = (data.balanceEntries ?? []).findIndex((e) => e.id === entryId);
  if (idx < 0) return { data, error: 'Yozuv topilmadi' };

  const existing = data.balanceEntries[idx];
  const purpose = (input.purpose ?? existing.purpose).trim();
  if (!purpose) return { data, error: 'Maqsadni yozing' };
  const amount = Math.round(Number(input.amount ?? existing.amount) || 0);
  if (amount <= 0) return { data, error: 'Summa 0 dan katta bo‘lishi kerak' };

  const entry = normalizeBalanceEntry({
    ...existing,
    kind: input.kind ?? existing.kind,
    channel: input.channel ?? existing.channel,
    purpose,
    amount,
    note: input.note ?? existing.note,
    createdAt: input.createdAt ?? existing.createdAt,
    id: entryId,
  });
  const balanceEntries = [...(data.balanceEntries ?? [])];
  balanceEntries[idx] = entry;
  return { data: { ...data, balanceEntries } };
}

export function deleteProduct(data: DillerData, productId: string): DillerData {
  return {
    ...data,
    products: data.products.filter((p) => p.id !== productId),
    warehouse: data.warehouse.filter((w) => w.productId !== productId),
    sales: data.sales.filter((s) => s.productId !== productId),
  };
}

export function createStore(
  data: DillerData,
  input: Omit<DillerStore, 'id' | 'createdAt'>,
): { data: DillerData; error?: string } {
  if (!input.name.trim()) return { data, error: 'Do‘kon nomi kerak' };
  if (!input.phone.trim()) return { data, error: 'Telefon raqam kerak' };
  if (!input.contactName.trim()) return { data, error: 'Mas‘ul ism kerak' };

  const uniqueName = ensureUniqueStoreName(input.name.trim(), data.stores);

  const store = normalizeStore({
    ...input,
    name: uniqueName,
    address: input.address.trim(),
    phone: input.phone.trim(),
    contactName: input.contactName.trim(),
    id: uid('store'),
    createdAt: new Date().toISOString(),
  });
  return { data: { ...data, stores: [store, ...data.stores] } };
}

export function updateStore(
  data: DillerData,
  storeId: string,
  input: Partial<Omit<DillerStore, 'id' | 'createdAt'>>,
): { data: DillerData; error?: string } {
  const idx = data.stores.findIndex((s) => s.id === storeId);
  if (idx < 0) return { data, error: 'Do‘kon topilmadi' };

  const existing = data.stores[idx];
  const nameRaw = (input.name ?? existing.name).trim();
  const phoneRaw = (input.phone ?? existing.phone).trim();
  const contactRaw = (input.contactName ?? existing.contactName).trim();

  if (!nameRaw) return { data, error: 'Do‘kon nomi kerak' };
  if (!phoneRaw) return { data, error: 'Telefon raqam kerak' };
  if (!contactRaw) return { data, error: 'Mas‘ul ism kerak' };

  const uniqueName = ensureUniqueStoreName(nameRaw, data.stores, storeId);
  const store = normalizeStore({
    ...existing,
    ...input,
    name: uniqueName,
    address: (input.address ?? existing.address).trim(),
    phone: phoneRaw,
    contactName: contactRaw,
    id: storeId,
  });

  const stores = [...data.stores];
  stores[idx] = store;
  return { data: { ...data, stores } };
}

export function deleteStore(data: DillerData, storeId: string): DillerData {
  return {
    ...data,
    stores: data.stores.filter((s) => s.id !== storeId),
    sales: data.sales.filter((s) => s.storeId !== storeId),
  };
}

export function formatStoreCoords(store: DillerStore): string | null {
  if (store.lat == null || store.lng == null) return null;
  return `${store.lat.toFixed(5)}, ${store.lng.toFixed(5)}`;
}

export type CreateSaleInput = {
  storeId: string;
  productId: string;
  qty: number;
  note?: string;
  /** 0–100 foiz chegirma */
  discountPercent?: number;
  /** So‘mda chegirma (foizdan ustun) */
  discountAmount?: number;
  paymentType: DillerPaymentType;
  /** Qarzda oldindan olingan summa */
  paidAmount?: number;
  debtDueDate?: string;
  /** Buyurtma narxi (mahsulot ro‘yxat narxidan farq qilishi mumkin) */
  listUnitPriceOverride?: number;
  /** Qator jami (chegirmasiz) */
  fixedLineTotal?: number;
  /** Ombor allaqachon buyurtma qabulida kamaytirilgan */
  skipWarehouseDeduction?: boolean;
  shopOrderId?: string;
};

export function calcSaleTotals(
  listUnitPrice: number,
  qty: number,
  opts?: { discountPercent?: number; discountAmount?: number },
): { subtotal: number; discountAmount: number; discountPercent: number; total: number; unitPrice: number } {
  const q = Math.max(1, Math.floor(qty));
  const subtotal = listUnitPrice * q;
  let discountAmount = Math.max(0, Number(opts?.discountAmount) || 0);
  const pct = Math.min(100, Math.max(0, Number(opts?.discountPercent) || 0));
  if (pct > 0 && discountAmount <= 0) {
    discountAmount = Math.round((subtotal * pct) / 100);
  }
  discountAmount = Math.min(subtotal, Math.round(discountAmount));
  const total = Math.max(0, subtotal - discountAmount);
  const discountPercent = subtotal > 0 ? Math.round((discountAmount / subtotal) * 1000) / 10 : pct;
  return {
    subtotal,
    discountAmount,
    discountPercent,
    total,
    unitPrice: q > 0 ? Math.round(total / q) : listUnitPrice,
  };
}

export function createSale(data: DillerData, input: CreateSaleInput): { data: DillerData; sale?: DillerSale; error?: string } {
  const qty = Math.max(1, Math.floor(input.qty));
  const product = data.products.find((p) => p.id === input.productId);
  if (!product) return { data, error: 'Mahsulot topilmadi' };
  const store = data.stores.find((s) => s.id === input.storeId);
  if (!store) return { data, error: 'Do‘kon topilmadi' };
  const stock = getWarehouseQty(data, product.id);
  if (!input.skipWarehouseDeduction && stock < qty) {
    return { data, error: `Omborda yetarli emas (${stock} ${product.unit})` };
  }

  const listPrice = input.listUnitPriceOverride ?? product.unitPrice;
  const totals = input.fixedLineTotal != null
    ? {
        subtotal: input.fixedLineTotal,
        discountAmount: 0,
        discountPercent: 0,
        total: input.fixedLineTotal,
        unitPrice: qty > 0 ? Math.round(input.fixedLineTotal / qty) : listPrice,
      }
    : calcSaleTotals(listPrice, qty, {
        discountPercent: input.discountPercent,
        discountAmount: input.discountAmount,
      });

  const paymentType: DillerPaymentType = input.paymentType === 'qarz' ? 'qarz' : 'naqd';
  let paidAmount = Math.max(0, Math.round(Number(input.paidAmount) || 0));
  let debtAmount = 0;
  let debtDueDate = '';

  if (paymentType === 'naqd') {
    paidAmount = totals.total;
    debtAmount = 0;
  } else {
    if (paidAmount > totals.total) {
      return { data, error: 'Oldindan to‘lov jami summadan oshmasligi kerak' };
    }
    debtAmount = totals.total - paidAmount;
    debtDueDate = String(input.debtDueDate ?? '').trim();
    if (debtAmount > 0 && !debtDueDate) {
      return { data, error: 'Qarz uchun qaytarish sanasini kiriting' };
    }
  }

  const sale: DillerSale = normalizeSale({
    id: uid('sale'),
    storeId: store.id,
    productId: product.id,
    qty,
    listUnitPrice: listPrice,
    unitPrice: totals.unitPrice,
    discountPercent: totals.discountPercent,
    discountAmount: totals.discountAmount,
    subtotal: totals.subtotal,
    total: totals.total,
    paymentType,
    paidAmount,
    debtAmount,
    initialDebtAmount: paymentType === 'qarz' ? debtAmount : undefined,
    debtPayments: [],
    debtDueDate,
    note: input.note?.trim() || '',
    createdAt: new Date().toISOString(),
    shopOrderId: input.shopOrderId,
  });

  let next = { ...data, sales: [sale, ...data.sales] };
  if (!input.skipWarehouseDeduction) {
    next = setWarehouseQty(next, product.id, stock - qty);
  }
  return { data: next, sale };
}

export function formatMoney(n: number): string {
  return `${Math.round(n).toLocaleString('uz-UZ')} so‘m`;
}

export function updateSaleInData(data: DillerData, saleId: string, patch: Partial<DillerSale>): DillerData {
  return {
    ...data,
    sales: data.sales.map((s) => (s.id === saleId ? normalizeSale({ ...s, ...patch, id: s.id }) : s)),
  };
}

/** Qarzga qisman yoki to‘liq to‘lov qayd etish */
export function recordDebtPayment(
  data: DillerData,
  saleId: string,
  amount: number,
): {
  data: DillerData;
  sale?: DillerSale;
  paidAmount?: number;
  remainingDebt?: number;
  error?: string;
} {
  const sale = data.sales.find((s) => s.id === saleId);
  if (!sale) return { data, error: 'Sotuv topilmadi' };
  const debt = sale.debtAmount ?? 0;
  if (debt <= 0) return { data, error: 'Bu sotuvda ochiq qarz yo‘q' };

  const pay = Math.min(debt, Math.max(0, Math.round(amount)));
  if (pay <= 0) return { data, error: 'To‘lov summasi kiriting' };

  const nextDebt = debt - pay;
  const debtPayments = [...(sale.debtPayments ?? []), { amount: pay, at: new Date().toISOString() }];
  const next = updateSaleInData(data, saleId, {
    paidAmount: (sale.paidAmount ?? 0) + pay,
    debtAmount: nextDebt,
    debtDueDate: nextDebt <= 0 ? '' : sale.debtDueDate,
    initialDebtAmount: sale.initialDebtAmount ?? debt,
    debtPayments,
  });
  const nextSale = next.sales.find((s) => s.id === saleId);
  return {
    data: next,
    sale: nextSale,
    paidAmount: pay,
    remainingDebt: nextDebt,
  };
}

export function settleDebtFully(
  data: DillerData,
  saleId: string,
): {
  data: DillerData;
  sale?: DillerSale;
  paidAmount?: number;
  remainingDebt?: number;
  error?: string;
} {
  const sale = data.sales.find((s) => s.id === saleId);
  if (!sale) return { data, error: 'Sotuv topilmadi' };
  return recordDebtPayment(data, saleId, sale.debtAmount ?? 0);
}

export function ensureOrderToken(data: DillerData): DillerData {
  if (data.profile.orderToken?.trim()) return data;
  return {
    ...data,
    profile: {
      ...data.profile,
      orderToken: `qr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    },
  };
}

export function updateDillerProfile(
  data: DillerData,
  patch: Partial<DillerProfile>,
): DillerData {
  const nextPatch = { ...patch };
  if ('companyName' in nextPatch) {
    nextPatch.companyName = normalizeProfileCompanyName(nextPatch.companyName);
  }
  return {
    ...data,
    profile: { ...data.profile, ...nextPatch },
  };
}

export function mergeShopOrders(data: DillerData, incoming: DillerShopOrder[]): DillerData {
  const rank: Record<DillerShopOrderStatus, number> = {
    pending: 1,
    rejected: 2,
    accepted: 3,
    done: 4,
  };
  const map = new Map<string, DillerShopOrder>();
  for (const o of data.shopOrders ?? []) map.set(o.id, o);
  for (const o of incoming) {
    const existing = map.get(o.id);
    const normalized = normalizeShopOrder(o);
    if (!existing) {
      map.set(o.id, normalized);
      continue;
    }
    const status =
      rank[normalized.status] > rank[existing.status] ? normalized.status : existing.status;
    map.set(
      o.id,
      normalizeShopOrder({
        ...normalized,
        ...existing,
        status,
        warehouseReserved: existing.warehouseReserved || normalized.warehouseReserved,
        saleIds: existing.saleIds?.length ? existing.saleIds : normalized.saleIds,
        completedAt: existing.completedAt ?? normalized.completedAt,
        storeId: existing.storeId ?? normalized.storeId,
        storeName: existing.storeName ?? normalized.storeName,
        items: existing.items.length ? existing.items : normalized.items,
      }),
    );
  }
  const shopOrders = [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return { ...data, shopOrders };
}

/** Mahalliy va server ma’lumotini birlashtirish — sotuvlar yo‘qolmasin */
export function mergeDillerData(local: DillerData, remote: DillerData): DillerData {
  const saleMap = new Map<string, DillerSale>();
  for (const s of remote.sales) saleMap.set(s.id, normalizeSale(s));
  for (const s of local.sales) saleMap.set(s.id, normalizeSale(s));

  const sales = [...saleMap.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const remoteSaleIds = new Set(remote.sales.map((s) => s.id));
  const localHasExtraSales = local.sales.some((s) => !remoteSaleIds.has(s.id));

  const expenseMap = new Map<string, DillerExpense>();
  for (const e of remote.expenses) expenseMap.set(e.id, normalizeExpense(e));
  for (const e of local.expenses) expenseMap.set(e.id, normalizeExpense(e));
  const expenses = [...expenseMap.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const balanceMap = new Map<string, DillerBalanceEntry>();
  for (const e of remote.balanceEntries) balanceMap.set(e.id, normalizeBalanceEntry(e));
  for (const e of local.balanceEntries) balanceMap.set(e.id, normalizeBalanceEntry(e));
  const balanceEntries = [...balanceMap.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const shopOrders = mergeShopOrders(
    { ...remote, shopOrders: remote.shopOrders ?? [] },
    local.shopOrders ?? [],
  ).shopOrders;

  const productMap = new Map<string, DillerProduct>();
  for (const p of remote.products) productMap.set(p.id, normalizeProduct(p));
  for (const p of local.products) productMap.set(p.id, normalizeProduct(p));

  const storeMap = new Map<string, DillerStore>();
  for (const s of remote.stores) storeMap.set(s.id, normalizeStore(s));
  for (const s of local.stores) storeMap.set(s.id, normalizeStore(s));

  const whMap = new Map<string, DillerWarehouseRow>();
  for (const w of remote.warehouse) whMap.set(w.productId, w);
  const localHasReservedOrders = (local.shopOrders ?? []).some((o) => o.warehouseReserved);
  if (localHasExtraSales || localHasReservedOrders) {
    for (const w of local.warehouse) whMap.set(w.productId, w);
  } else {
    for (const w of local.warehouse) {
      if (!whMap.has(w.productId)) whMap.set(w.productId, w);
    }
  }

  const firmMap = new Map<string, DillerFirm>();
  for (const f of remote.firms) firmMap.set(f.id, f);
  for (const f of local.firms) firmMap.set(f.id, f);

  return normalizeDillerData({
    profile: {
      ...remote.profile,
      ...local.profile,
      orderToken: local.profile.orderToken?.trim() || remote.profile.orderToken,
    },
    firms: [...firmMap.values()],
    products: [...productMap.values()],
    stores: reconcileStoreNames([...storeMap.values()]),
    warehouse: [...whMap.values()],
    sales,
    expenses,
    balanceEntries,
    shopOrders,
  });
}

function patchShopOrder(
  data: DillerData,
  orderId: string,
  patch: Partial<DillerShopOrder>,
): { data: DillerData; order?: DillerShopOrder; error?: string } {
  const idx = (data.shopOrders ?? []).findIndex((o) => o.id === orderId);
  if (idx < 0) return { data, error: 'Buyurtma topilmadi' };
  const order = normalizeShopOrder({ ...data.shopOrders[idx], ...patch, id: orderId });
  const shopOrders = [...data.shopOrders];
  shopOrders[idx] = order;
  return { data: { ...data, shopOrders }, order };
}

function deductShopOrderWarehouse(
  data: DillerData,
  order: DillerShopOrder,
): { data: DillerData; error?: string } {
  let next = data;
  for (const it of order.items) {
    const stock = getWarehouseQty(next, it.productId);
    if (stock < it.qty) {
      const name = it.productName || it.productId;
      return { data, error: `Omborda yetarli emas: ${name} (${stock} / ${it.qty})` };
    }
  }
  for (const it of order.items) {
    const stock = getWarehouseQty(next, it.productId);
    next = setWarehouseQty(next, it.productId, stock - it.qty);
  }
  return { data: next };
}

function restoreShopOrderWarehouse(
  data: DillerData,
  order: DillerShopOrder,
): DillerData {
  let next = data;
  for (const it of order.items) {
    const stock = getWarehouseQty(next, it.productId);
    next = setWarehouseQty(next, it.productId, stock + it.qty);
  }
  return next;
}

export function acceptShopOrder(data: DillerData, orderId: string): { data: DillerData; error?: string } {
  const order = (data.shopOrders ?? []).find((o) => o.id === orderId);
  if (!order) return { data, error: 'Buyurtma topilmadi' };
  if (order.status === 'done') return { data, error: 'Buyurtma allaqachon bajarilgan' };
  if (order.status === 'rejected') return { data, error: 'Rad etilgan buyurtmani qabul qilib bo‘lmaydi' };
  if (order.status === 'accepted' && order.warehouseReserved) return { data };

  let next = data;
  if (!order.warehouseReserved) {
    const wh = deductShopOrderWarehouse(next, order);
    if (wh.error) return wh;
    next = wh.data;
  }

  const patched = patchShopOrder(next, orderId, {
    status: 'accepted',
    warehouseReserved: true,
  });
  if (patched.error || !patched.order) return { data, error: patched.error };
  return { data: patched.data };
}

export function rejectShopOrder(data: DillerData, orderId: string): { data: DillerData; error?: string } {
  const order = (data.shopOrders ?? []).find((o) => o.id === orderId);
  if (!order) return { data, error: 'Buyurtma topilmadi' };
  if (order.status === 'done') return { data, error: 'Bajarilgan buyurtmani rad qilib bo‘lmaydi' };
  if (order.status === 'rejected') return { data };

  let next = data;
  if (order.warehouseReserved) {
    next = restoreShopOrderWarehouse(next, order);
  }

  const patched = patchShopOrder(next, orderId, {
    status: 'rejected',
    warehouseReserved: false,
  });
  if (patched.error || !patched.order) return { data, error: patched.error };
  return { data: patched.data };
}

export type ConfirmShopOrderSaleInput = {
  paymentType: DillerPaymentType;
  paidAmount?: number;
  debtDueDate?: string;
  note?: string;
  /** 0–100 foiz chegirma (butun buyurtmaga) */
  discountPercent?: number;
  /** So‘mda chegirma (foizdan ustun) */
  discountAmount?: number;
};

/** Buyurtma qatoridagi mahsulot katalogda bo‘lmasa — QR id bilan qo‘shiladi */
function ensureProductFromOrderItem(data: DillerData, item: DillerShopOrderItem): DillerData {
  if (data.products.some((p) => p.id === item.productId)) return data;
  const product = normalizeProduct({
    id: item.productId,
    name: item.productName?.trim() || 'Mahsulot',
    firmName: '',
    sku: '—',
    unitPrice: item.unitPrice,
    buyPrice: 0,
    unit: item.unit ?? 'dona',
    createdAt: new Date().toISOString(),
  });
  return { ...data, products: [...data.products, product] };
}

/** Do‘kon topilmasa — buyurtmadan avtomatik yaratiladi */
function ensureStoreForShopOrder(
  data: DillerData,
  order: DillerShopOrder,
): { data: DillerData; storeId: string; error?: string } {
  if (order.storeId) {
    const byId = data.stores.find((s) => s.id === order.storeId);
    if (byId) return { data, storeId: byId.id };
    const name = order.storeName?.trim() || order.customerName?.trim() || 'Do‘kon';
    const store = normalizeStore({
      id: order.storeId,
      name,
      address: order.customerAddress?.trim() ?? '',
      phone: order.customerPhone.trim(),
      contactName: order.customerName?.trim() || name,
      createdAt: new Date().toISOString(),
    });
    return { data: { ...data, stores: [store, ...data.stores] }, storeId: store.id };
  }

  const matches = findStoresByPhone(data, order.customerPhone);
  if (matches.length === 1) return { data, storeId: matches[0].id };
  if (matches.length > 1) {
    if (order.storeName) {
      const byName = matches.find((s) => s.name === order.storeName);
      if (byName) return { data, storeId: byName.id };
    }
    return { data, storeId: matches[0].id };
  }

  const name = order.storeName?.trim() || order.customerName?.trim() || 'Do‘kon';
  if (!order.customerPhone.trim()) {
    return { data, error: 'Do‘kon topilmadi — telefon raqam yo‘q' };
  }
  const store = normalizeStore({
    id: uid('store'),
    name,
    address: order.customerAddress?.trim() ?? '',
    phone: order.customerPhone.trim(),
    contactName: order.customerName?.trim() || name,
    createdAt: new Date().toISOString(),
  });
  return { data: { ...data, stores: [store, ...data.stores] }, storeId: store.id };
}

export function confirmShopOrderSale(
  data: DillerData,
  orderId: string,
  input: ConfirmShopOrderSaleInput,
): { data: DillerData; error?: string } {
  const order = (data.shopOrders ?? []).find((o) => o.id === orderId);
  if (!order) return { data, error: 'Buyurtma topilmadi' };
  if (order.status !== 'accepted') {
    return { data, error: 'Avval buyurtmani qabul qiling' };
  }
  if (order.saleIds?.length) return { data, error: 'Sotuv allaqachon tasdiqlangan' };

  let next = data;
  for (const it of order.items) {
    next = ensureProductFromOrderItem(next, it);
  }

  const storeResolved = ensureStoreForShopOrder(next, order);
  if (storeResolved.error) return { data, error: storeResolved.error };
  next = storeResolved.data;
  const storeId = storeResolved.storeId;

  const paymentType: DillerPaymentType = input.paymentType === 'qarz' ? 'qarz' : 'naqd';
  const subtotal = order.items.reduce(
    (s, it) => s + (it.lineTotal || it.unitPrice * it.qty),
    0,
  );
  let discountAmount = Math.max(0, Math.round(Number(input.discountAmount) || 0));
  const discountPct = Math.min(100, Math.max(0, Number(input.discountPercent) || 0));
  if (discountPct > 0 && discountAmount <= 0) {
    discountAmount = Math.round((subtotal * discountPct) / 100);
  }
  discountAmount = Math.min(subtotal, discountAmount);
  const orderTotal = Math.max(0, subtotal - discountAmount);
  let paidTotal = Math.max(0, Math.round(Number(input.paidAmount) || 0));
  const debtDueDate = String(input.debtDueDate ?? '').trim();
  const noteBase = input.note?.trim() || order.note?.trim() || '';
  const orderNote = noteBase
    ? `${noteBase} · QR #${order.id.replace(/^ord_/, '').slice(0, 8)}`
    : `QR buyurtma #${order.id.replace(/^ord_/, '').slice(0, 8)}`;

  if (paymentType === 'naqd') {
    paidTotal = orderTotal;
  } else if (paidTotal > orderTotal) {
    return { data: next, error: 'Oldindan to‘lov jami summadan oshmasligi kerak' };
  } else if (orderTotal - paidTotal > 0 && !debtDueDate) {
    return { data: next, error: 'Qarz uchun qaytarish sanasini kiriting' };
  }

  const saleIds: string[] = [];
  let remainingPaid = paidTotal;
  let remainingDiscount = discountAmount;

  for (let i = 0; i < order.items.length; i++) {
    const it = order.items[i];
    const lineSubtotal = it.lineTotal || it.unitPrice * it.qty;
    let lineDiscount = 0;
    if (discountAmount > 0 && subtotal > 0) {
      if (i === order.items.length - 1) {
        lineDiscount = remainingDiscount;
      } else {
        lineDiscount = Math.round((discountAmount * lineSubtotal) / subtotal);
        remainingDiscount -= lineDiscount;
      }
    }
    const lineTotal = Math.max(0, lineSubtotal - lineDiscount);
    let linePaid = 0;
    if (paymentType === 'naqd') {
      linePaid = lineTotal;
    } else if (i === order.items.length - 1) {
      linePaid = remainingPaid;
    } else {
      linePaid = orderTotal > 0 ? Math.round((paidTotal * lineTotal) / orderTotal) : 0;
      remainingPaid -= linePaid;
    }

    const result = createSale(next, {
      storeId,
      productId: it.productId,
      qty: it.qty,
      listUnitPriceOverride: it.unitPrice,
      discountAmount: lineDiscount,
      paymentType,
      paidAmount: linePaid,
      debtDueDate: paymentType === 'qarz' ? debtDueDate : undefined,
      note: orderNote,
      skipWarehouseDeduction: true,
      shopOrderId: order.id,
    });
    if (result.error) return { data: next, error: result.error };
    next = result.data;
    const created = next.sales[0];
    if (created) saleIds.push(created.id);
  }

  const patched = patchShopOrder(next, orderId, {
    status: 'done',
    saleIds,
    completedAt: new Date().toISOString(),
  });
  if (patched.error || !patched.order) return { data, error: patched.error };
  return { data: patched.data };
}

export function updateShopOrderStatus(
  data: DillerData,
  orderId: string,
  status: DillerShopOrderStatus,
): DillerData {
  return {
    ...data,
    shopOrders: (data.shopOrders ?? []).map((o) =>
      o.id === orderId ? { ...o, status } : o,
    ),
  };
}

export function normalizePhoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9);
}

export function findStoreByPhone(data: DillerData, phone: string): DillerStore | undefined {
  return findStoresByPhone(data, phone)[0];
}

export function findStoresByPhone(data: DillerData, phone: string): DillerStore[] {
  const key = normalizePhoneKey(phone);
  if (key.length < 9) return [];
  return data.stores.filter((s) => normalizePhoneKey(s.phone) === key);
}

export function getQrcodeOrderUrl(token: string): string {
  return `${getPublicSiteOrigin()}/qrcode/${encodeURIComponent(token)}`;
}
