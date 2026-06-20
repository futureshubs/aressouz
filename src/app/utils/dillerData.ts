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
  /** Qarz qaytarish sanasi (ISO date yoki bo‘sh) */
  debtDueDate: string;
  note: string;
  createdAt: string;
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

export type DillerShopOrderItem = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
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

const DATA_KEY = 'aresso:diller:data:v3';
const LEGACY_KEYS = [
  'aresso:diller:data:v4',
  'aresso:diller:data:v2',
  'aresso:diller:data:v1',
];

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
    debtDueDate: String(s.debtDueDate ?? '').trim(),
    note: String(s.note ?? '').trim(),
    createdAt: s.createdAt ?? new Date().toISOString(),
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
      companyName: 'Aresso Diller MChJ',
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
    profile: { ...base.profile, ...(raw.profile ?? {}) },
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

/** Brauzer keshi — oflayn/zaxira */
export function loadDillerData(): DillerData {
  try {
    const rawV3 = localStorage.getItem(DATA_KEY);
    const rawV4 = localStorage.getItem('aresso:diller:data:v4');

    if (rawV3) {
      const v3 = normalizeDillerData(JSON.parse(rawV3) as DillerData);
      if (hasDillerDataContent(v3)) {
        saveDillerData(v3);
        if (rawV4) {
          try {
            localStorage.removeItem('aresso:diller:data:v4');
          } catch {
            /* ignore */
          }
        }
        return v3;
      }
    }

    if (rawV4) {
      const downgraded = normalizeDillerData(JSON.parse(rawV4) as DillerData);
      saveDillerData(downgraded);
      try {
        localStorage.removeItem('aresso:diller:data:v4');
      } catch {
        /* ignore */
      }
      return downgraded;
    }

    if (rawV3) {
      return normalizeDillerData(JSON.parse(rawV3) as DillerData);
    }

    for (const legacyKey of LEGACY_KEYS) {
      if (legacyKey === 'aresso:diller:data:v4') continue;
      const rawLegacy = localStorage.getItem(legacyKey);
      if (rawLegacy) {
        const migrated = normalizeDillerData(JSON.parse(rawLegacy) as DillerData);
        saveDillerData(migrated);
        return migrated;
      }
    }

    return createEmptyDillerData();
  } catch {
    return createEmptyDillerData();
  }
}

export function saveDillerData(data: DillerData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(normalizeDillerData(data)));
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

export function createSale(data: DillerData, input: CreateSaleInput): { data: DillerData; error?: string } {
  const qty = Math.max(1, Math.floor(input.qty));
  const product = data.products.find((p) => p.id === input.productId);
  if (!product) return { data, error: 'Mahsulot topilmadi' };
  const store = data.stores.find((s) => s.id === input.storeId);
  if (!store) return { data, error: 'Do‘kon topilmadi' };
  const stock = getWarehouseQty(data, product.id);
  if (stock < qty) return { data, error: `Omborda yetarli emas (${stock} ${product.unit})` };

  const totals = calcSaleTotals(product.unitPrice, qty, {
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
    listUnitPrice: product.unitPrice,
    unitPrice: totals.unitPrice,
    discountPercent: totals.discountPercent,
    discountAmount: totals.discountAmount,
    subtotal: totals.subtotal,
    total: totals.total,
    paymentType,
    paidAmount,
    debtAmount,
    debtDueDate,
    note: input.note?.trim() || '',
    createdAt: new Date().toISOString(),
  });

  let next = { ...data, sales: [sale, ...data.sales] };
  next = setWarehouseQty(next, product.id, stock - qty);
  return { data: next };
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
): { data: DillerData; error?: string } {
  const sale = data.sales.find((s) => s.id === saleId);
  if (!sale) return { data, error: 'Sotuv topilmadi' };
  const debt = sale.debtAmount ?? 0;
  if (debt <= 0) return { data, error: 'Bu sotuvda ochiq qarz yo‘q' };

  const pay = Math.min(debt, Math.max(0, Math.round(amount)));
  if (pay <= 0) return { data, error: 'To‘lov summasi kiriting' };

  const nextDebt = debt - pay;
  const next = updateSaleInData(data, saleId, {
    paidAmount: (sale.paidAmount ?? 0) + pay,
    debtAmount: nextDebt,
    debtDueDate: nextDebt <= 0 ? '' : sale.debtDueDate,
  });
  return { data: next };
}

export function settleDebtFully(data: DillerData, saleId: string): { data: DillerData; error?: string } {
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
  return {
    ...data,
    profile: { ...data.profile, ...patch },
  };
}

export function mergeShopOrders(data: DillerData, incoming: DillerShopOrder[]): DillerData {
  const map = new Map<string, DillerShopOrder>();
  for (const o of data.shopOrders ?? []) map.set(o.id, o);
  for (const o of incoming) map.set(o.id, normalizeShopOrder(o));
  const shopOrders = [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return { ...data, shopOrders };
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
  const key = normalizePhoneKey(phone);
  if (key.length < 9) return undefined;
  return data.stores.find((s) => normalizePhoneKey(s.phone) === key);
}

export function getQrcodeOrderUrl(token: string): string {
  return `${getPublicSiteOrigin()}/qrcode/${encodeURIComponent(token)}`;
}
