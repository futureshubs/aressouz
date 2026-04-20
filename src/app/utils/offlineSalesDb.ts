export type OfflineSaleItem = {
  productId: string;
  variantId?: string;
  variantLabel?: string;
  qty: number;
  priceUzs: number;
  /** Asl narx (tannarx) — ixtiyoriy; statistikada sof foyda uchun */
  costUzs?: number;
};

export type OfflineSale = {
  saleId: string;
  shopId: string;
  createdAt: string; // ISO
  items: OfflineSaleItem[];
  totals: {
    subtotalUzs: number;
    discountUzs: number;
    totalUzs: number;
  };
  payment: {
    method: 'cash' | 'card' | 'mixed';
    paidUzs?: number;
  };
  source: 'offline';
  status: 'pending_sync' | 'synced' | 'failed';
  lastError?: string;
  syncedAt?: string;
};

const DB_NAME = 'aresso_pos';
const DB_VERSION = 1;
const STORE = 'offline_sales';

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB mavjud emas'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'saleId' });
        store.createIndex('byStatus', 'status', { unique: false });
        store.createIndex('byCreatedAt', 'createdAt', { unique: false });
        store.createIndex('byShopStatus', ['shopId', 'status'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open error'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx error'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB tx abort'));
  });
}

export async function offlineSalesAdd(sale: OfflineSale): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(sale);
  await txDone(tx);
  db.close();
}

export async function offlineSalesListPending(shopId: string, limit = 50): Promise<OfflineSale[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const idx = tx.objectStore(STORE).index('byShopStatus');
  const range = IDBKeyRange.only([shopId, 'pending_sync']);
  const out: OfflineSale[] = [];

  await new Promise<void>((resolve, reject) => {
    const req = idx.openCursor(range, 'next');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) return resolve();
      out.push(cursor.value as OfflineSale);
      cursor.continue();
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB cursor error'));
  });

  await txDone(tx);
  db.close();
  return out;
}

export async function offlineSalesMarkSynced(saleId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const existing = await new Promise<OfflineSale | null>((resolve, reject) => {
    const req = store.get(saleId);
    req.onsuccess = () => resolve((req.result as OfflineSale) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get error'));
  });
  if (existing) {
    store.put({
      ...existing,
      status: 'synced',
      lastError: undefined,
      syncedAt: new Date().toISOString(),
    });
  }
  await txDone(tx);
  db.close();
}

export async function offlineSalesMarkFailed(saleId: string, error: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const existing = await new Promise<OfflineSale | null>((resolve, reject) => {
    const req = store.get(saleId);
    req.onsuccess = () => resolve((req.result as OfflineSale) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get error'));
  });
  if (existing) {
    store.put({
      ...existing,
      status: 'failed',
      lastError: String(error || 'Xatolik'),
    });
  }
  await txDone(tx);
  db.close();
}

