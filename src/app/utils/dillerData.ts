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
};

export type DillerData = {
  profile: DillerProfile;
  firms: DillerFirm[];
  products: DillerProduct[];
  stores: DillerStore[];
  warehouse: DillerWarehouseRow[];
  sales: DillerSale[];
};

const DATA_KEY = 'aresso:diller:data:v3';
const LEGACY_KEYS = ['aresso:diller:data:v2', 'aresso:diller:data:v1'];

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

function normalizeData(raw: Partial<DillerData> | null): DillerData {
  const base = seedData();
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
    stores: (Array.isArray(raw.stores) ? raw.stores : base.stores).map((s) =>
      normalizeStore(s as DillerStore),
    ),
    warehouse: Array.isArray(raw.warehouse) ? raw.warehouse : base.warehouse,
    sales: (Array.isArray(raw.sales) ? raw.sales : []).map((s) => normalizeSale(s as DillerSale)),
  };
}

export function loadDillerData(): DillerData {
  try {
    const rawCurrent = localStorage.getItem(DATA_KEY);
    if (rawCurrent) {
      return normalizeData(JSON.parse(rawCurrent) as DillerData);
    }

    for (const legacyKey of LEGACY_KEYS) {
      const rawLegacy = localStorage.getItem(legacyKey);
      if (rawLegacy) {
        const migrated = normalizeData(JSON.parse(rawLegacy) as DillerData);
        saveDillerData(migrated);
        return migrated;
      }
    }

    const seed = seedData();
    saveDillerData(seed);
    return seed;
  } catch {
    const seed = seedData();
    saveDillerData(seed);
    return seed;
  }
}

export function saveDillerData(data: DillerData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
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

  const store = normalizeStore({
    ...input,
    name: input.name.trim(),
    address: input.address.trim(),
    phone: input.phone.trim(),
    contactName: input.contactName.trim(),
    id: uid('store'),
    createdAt: new Date().toISOString(),
  });
  return { data: { ...data, stores: [store, ...data.stores] } };
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
