import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { toast } from 'sonner';
import { CreditCard, DollarSign, RefreshCw, Wallet } from 'lucide-react';

type PayoutRow = {
  id: string;
  courierId: string;
  branchId: string;
  courierName: string;
  courierPhone: string;
  courierCardNumber?: string | null;
  amountUzs: number;
  requestedMethod: 'cash' | 'card';
  status: 'pending' | 'paid' | 'rejected';
  createdAt: string;
  decidedAt?: string | null;
  paidMethod?: 'cash' | 'card' | null;
  note?: string | null;
};

export function CourierSalaryTab({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost' ? DEV_API_BASE_URL : API_BASE_URL;

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [payBusyId, setPayBusyId] = useState<string | null>(null);

  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const surface = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.92)';
  const muted = isDark ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.55)';

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const params = new URLSearchParams({ branchId });
        const branchToken = getStoredBranchToken();
        if (branchToken) params.set('branchToken', branchToken);
        const res = await fetch(`${apiBaseUrl}/branch/courier-payout-requests?${params}`, {
          cache: 'no-store',
          headers: {
            ...buildBranchHeaders({ 'Content-Type': 'application/json' }),
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; requests?: PayoutRow[]; error?: string };
        if (!res.ok || !data.success) {
          if (!silent) toast.error(data.error || 'Oylik arizalarini olishda xatolik');
          return;
        }
        setRows(Array.isArray(data.requests) ? data.requests : []);
      } catch (e) {
        if (!silent) toast.error('Oylik arizalarini yuklashda xatolik');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [apiBaseUrl, branchId],
  );

  useEffect(() => {
    void load(false);
    const t = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(t);
  }, [load]);

  const pending = useMemo(() => rows.filter((r) => r.status === 'pending'), [rows]);
  const paid = useMemo(() => rows.filter((r) => r.status === 'paid'), [rows]);

  const pay = async (row: PayoutRow, method: 'cash' | 'card') => {
    if (payBusyId) return;
    setPayBusyId(row.id);
    try {
      const params = new URLSearchParams({ branchId });
      const branchToken = getStoredBranchToken();
      if (branchToken) params.set('branchToken', branchToken);
      const body = { method };
      const res = await fetch(`${apiBaseUrl}/branch/courier-payout-requests/${encodeURIComponent(row.id)}/pay?${params}`, {
        method: 'POST',
        headers: {
          ...buildBranchHeaders({ 'Content-Type': 'application/json' }),
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        toast.error(data.error || 'To‘lashda xatolik');
        return;
      }
      toast.success("To'landi");
      await load(true);
    } catch {
      toast.error('To‘lashda xatolik');
    } finally {
      setPayBusyId(null);
    }
  };

  const money = (n: number) => `${Math.round(Number(n || 0)).toLocaleString('uz-UZ')} so'm`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold">Oylik (kuryer arizalari)</div>
          <div className="text-sm" style={{ color: muted }}>
            Kuryer balansidan pul yechish uchun ariza yuboradi. Bu yerda naqd/karta qilib to‘lanadi.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          className="px-3 py-2 rounded-2xl border text-sm font-semibold inline-flex items-center gap-2"
          style={{ borderColor: border, background: surface }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-3xl border overflow-hidden" style={{ borderColor: border, background: surface }}>
          <div className="px-4 py-3 border-b font-bold" style={{ borderColor: border }}>
            Kutilayotgan ({pending.length})
          </div>
          {pending.length === 0 ? (
            <div className="p-6 text-sm" style={{ color: muted }}>
              Hozircha ariza yo‘q.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: border }}>
              {pending.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">
                        {r.courierName} <span className="text-xs" style={{ color: muted }}>({r.courierPhone})</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: muted }}>
                        Ariza: {new Date(r.createdAt).toLocaleString('uz-UZ')}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ background: `${accentColor.color}22`, color: accentColor.color }}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        {money(r.amountUzs)}
                      </div>
                      <div className="mt-2 text-xs" style={{ color: muted }}>
                        So‘rov: {r.requestedMethod === 'card' ? 'Karta' : 'Naqd'}
                        {r.requestedMethod === 'card' && r.courierCardNumber ? ` · ${r.courierCardNumber}` : ''}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => void pay(r, 'cash')}
                        disabled={payBusyId !== null}
                        className="px-3 py-2 rounded-2xl text-sm font-semibold text-white inline-flex items-center gap-2"
                        style={{ background: isDark ? '#16a34a' : '#22c55e' }}
                      >
                        <DollarSign className="w-4 h-4" />
                        Naqd berish
                      </button>
                      <button
                        type="button"
                        onClick={() => void pay(r, 'card')}
                        disabled={payBusyId !== null}
                        className="px-3 py-2 rounded-2xl text-sm font-semibold text-white inline-flex items-center gap-2"
                        style={{ background: isDark ? '#2563eb' : '#3b82f6' }}
                      >
                        <CreditCard className="w-4 h-4" />
                        Karta berish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border overflow-hidden" style={{ borderColor: border, background: surface }}>
          <div className="px-4 py-3 border-b font-bold" style={{ borderColor: border }}>
            To‘langan ({paid.length})
          </div>
          {paid.length === 0 ? (
            <div className="p-6 text-sm" style={{ color: muted }}>
              Hozircha to‘langan ariza yo‘q.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: border }}>
              {paid.slice(0, 30).map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">
                        {r.courierName}{' '}
                        <span className="text-xs" style={{ color: muted }}>
                          ({r.courierPhone})
                        </span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: muted }}>
                        To‘langan: {r.decidedAt ? new Date(r.decidedAt).toLocaleString('uz-UZ') : '—'}
                      </div>
                      <div className="mt-2 text-sm font-semibold">{money(r.amountUzs)}</div>
                      <div className="text-xs mt-1" style={{ color: muted }}>
                        Usul: {r.paidMethod === 'card' ? 'Karta' : 'Naqd'}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs px-3 py-1 rounded-full"
                      style={{ background: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.12)', color: '#10b981' }}
                    >
                      Paid
                    </div>
                  </div>
                </div>
              ))}
              {paid.length > 30 ? (
                <div className="p-4 text-xs" style={{ color: muted }}>
                  Oxirgi 30 ta ko‘rsatildi
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

