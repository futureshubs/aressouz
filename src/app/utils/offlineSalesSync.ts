import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import {
  offlineSalesListPending,
  offlineSalesMarkFailed,
  offlineSalesMarkSynced,
  type OfflineSale,
} from './offlineSalesDb';

export type SyncResult = {
  synced: number;
  failed: number;
};

async function postSaleToServer(token: string, sale: OfflineSale): Promise<void> {
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pos/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
      'X-Seller-Token': token,
    },
    body: JSON.stringify(sale),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(String(data?.error || `HTTP ${res.status}`));
  }
}

export async function syncPendingOfflineSales(opts: {
  token: string;
  shopId: string;
  limit?: number;
}): Promise<SyncResult> {
  const pending = await offlineSalesListPending(opts.shopId, opts.limit ?? 50);
  let synced = 0;
  let failed = 0;
  for (const sale of pending) {
    try {
      await postSaleToServer(opts.token, sale);
      await offlineSalesMarkSynced(sale.saleId);
      synced += 1;
    } catch (e) {
      failed += 1;
      await offlineSalesMarkFailed(sale.saleId, e instanceof Error ? e.message : 'Xatolik');
    }
  }
  return { synced, failed };
}

let syncTimer: number | null = null;
let running = false;

export function startOfflineSalesSyncWorker(opts: {
  token: string;
  shopId: string;
  intervalMs?: number;
  onStatus?: (s: { running: boolean; last?: SyncResult; error?: string }) => void;
}) {
  const intervalMs = Math.max(5000, Math.floor(Number(opts.intervalMs) || 15000));
  const runOnce = async () => {
    if (running) return;
    running = true;
    opts.onStatus?.({ running: true });
    try {
      const last = await syncPendingOfflineSales({ token: opts.token, shopId: opts.shopId, limit: 50 });
      opts.onStatus?.({ running: false, last });
    } catch (e) {
      opts.onStatus?.({ running: false, error: e instanceof Error ? e.message : 'Sync xatosi' });
    } finally {
      running = false;
    }
  };

  const onlineHandler = () => void runOnce();
  window.addEventListener('online', onlineHandler);

  if (syncTimer !== null) window.clearInterval(syncTimer);
  syncTimer = window.setInterval(() => void runOnce(), intervalMs);

  // first attempt
  void runOnce();

  return () => {
    window.removeEventListener('online', onlineHandler);
    if (syncTimer !== null) window.clearInterval(syncTimer);
    syncTimer = null;
  };
}

