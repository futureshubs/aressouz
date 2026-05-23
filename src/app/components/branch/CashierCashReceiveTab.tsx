import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { edgeFunctionBaseUrl } from '../../utils/edgeFunctionBaseUrl';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { formatOrderNumber } from '../../utils/orderNumber';
import { Banknote, CheckCircle2, Loader2, Phone, Search, User } from 'lucide-react';
import { toast } from 'sonner';

export type CourierCashHandoffRow = {
  id: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  courierCashHandoffExpectedUzs: number;
  courierCashHandoffStatus: string;
  courierCashHandedToCashierAt: string | null;
  assignedCourierId: string | null;
  courierName?: string;
  courierPhone?: string;
  deliveredAt: string | null;
  paymentMethod?: string;
  finalTotal: number;
  deliveryFee: number;
  handoffKind?: 'market' | 'rental';
};

type Props = { branchId: string };

type CourierGroup = {
  courierId: string;
  courierName: string;
  courierPhone: string;
  rows: CourierCashHandoffRow[];
  totalUzs: number;
};

export function CashierCashReceiveTab({ branchId }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl = edgeFunctionBaseUrl();
  const tick = useVisibilityTick();
  const [pending, setPending] = useState<CourierCashHandoffRow[]>([]);
  const [history, setHistory] = useState<CourierCashHandoffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [batchCourierId, setBatchCourierId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const token = getStoredBranchToken();
    if (!token) {
      setPending([]);
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const h = buildBranchHeaders({ 'Content-Type': 'application/json' });
      const qPending = new URLSearchParams({ scope: 'pending' });
      const qHistory = new URLSearchParams({ scope: 'history' });
      qPending.set('branchToken', token);
      qHistory.set('branchToken', token);
      const [r1, r2] = await Promise.all([
        fetch(`${apiBaseUrl}/branch/courier-cash-handoffs?${qPending}`, { headers: h }),
        fetch(`${apiBaseUrl}/branch/courier-cash-handoffs?${qHistory}`, { headers: h }),
      ]);
      const d1 = await r1.json().catch(() => ({}));
      const d2 = await r2.json().catch(() => ({}));
      if (r1.ok && d1.success && Array.isArray(d1.handoffs)) setPending(d1.handoffs);
      else setPending([]);
      if (r2.ok && d2.success && Array.isArray(d2.handoffs)) setHistory(d2.handoffs.slice(0, 80));
      else setHistory([]);
    } catch (e) {
      console.error(e);
      toast.error('Ro‘yxatni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load, tick, branchId]);

  const q = search.trim().toLowerCase();
  const filterRow = (row: CourierCashHandoffRow) => {
    if (!q) return true;
    return (
      String(row.id).toLowerCase().includes(q) ||
      String(row.orderNumber || '').toLowerCase().includes(q) ||
      String(row.customerPhone || '').toLowerCase().includes(q) ||
      String(row.customerName || '').toLowerCase().includes(q) ||
      String(row.courierName || '').toLowerCase().includes(q)
    );
  };

  const pendingFiltered = useMemo(() => pending.filter(filterRow), [pending, q]);
  const historyFiltered = useMemo(() => history.filter(filterRow), [history, q]);

  const courierGroups = useMemo((): CourierGroup[] => {
    const map = new Map<string, CourierGroup>();
    for (const row of pendingFiltered) {
      const cid = String(row.assignedCourierId || 'unknown').trim() || 'unknown';
      const prev = map.get(cid);
      const uzs = Number(row.courierCashHandoffExpectedUzs || 0) || 0;
      if (!prev) {
        map.set(cid, {
          courierId: cid,
          courierName: row.courierName || 'Kuryer',
          courierPhone: row.courierPhone || '',
          rows: [row],
          totalUzs: uzs,
        });
      } else {
        prev.rows.push(row);
        prev.totalUzs += uzs;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalUzs - a.totalUzs);
  }, [pendingFiltered]);

  const confirmReceive = async (orderId: string, opts?: { silent?: boolean }) => {
    const token = getStoredBranchToken();
    if (!token) {
      toast.error('Filial sessiyasi yo‘q');
      return false;
    }
    if (!opts?.silent) setConfirmingId(orderId);
    try {
      const qs = `?branchToken=${encodeURIComponent(token)}`;
      const res = await fetch(
        `${apiBaseUrl}/branch/courier-cash-handoffs/${encodeURIComponent(orderId)}/confirm${qs}`,
        {
          method: 'POST',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Xatolik');
      }
      if (!opts?.silent) {
        toast.success('Naqd kassaga qabul qilindi');
        await load();
      }
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Qabul qilishda xatolik';
      toast.error(msg);
      return false;
    } finally {
      if (!opts?.silent) setConfirmingId(null);
    }
  };

  const confirmAllForCourier = async (group: CourierGroup) => {
    if (batchCourierId || confirmingId) return;
    setBatchCourierId(group.courierId);
    try {
      let ok = 0;
      for (const row of group.rows) {
        const success = await confirmReceive(row.id, { silent: true });
        if (success) ok += 1;
      }
      if (ok > 0) {
        toast.success(`${group.courierName}: ${ok} ta topshiruv qabul qilindi`);
        await load();
      }
    } finally {
      setBatchCourierId(null);
    }
  };

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border p-4" style={{ background: cardBg, borderColor: border }}>
        <p className="text-sm mb-3" style={{ color: muted }}>
          Kuryer mijozdan olgan <strong>barcha naqdni</strong> filial kassasiga topshiradi. Har bir
          kuryer bo‘yicha jami summa alohida ko‘rsatiladi — «Barchasini qabul qildim» yoki alohida
          buyurtma bo‘yicha tasdiqlang.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-45" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kuryer, buyurtma raqami yoki telefon..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none text-sm"
            style={{
              background: isDark ? 'rgba(0,0,0,0.25)' : '#f9fafb',
              borderColor: border,
              color: isDark ? '#fff' : '#111',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: muted }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Yuklanmoqda...
        </div>
      ) : null}

      <section>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <Banknote className="w-5 h-5" style={{ color: accentColor.color }} />
          Kuryerlar bo‘yicha (kutilmoqda)
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${accentColor.color}22`, color: accentColor.color }}
          >
            {pendingFiltered.length}
          </span>
        </h3>
        {courierGroups.length === 0 ? (
          <p className="text-sm" style={{ color: muted }}>
            Hozircha kutilayotgan naqd topshiruv yo‘q.
          </p>
        ) : (
          <ul className="space-y-4">
            {courierGroups.map((group) => (
              <li
                key={group.courierId}
                className="rounded-2xl border overflow-hidden"
                style={{ background: cardBg, borderColor: border }}
              >
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b"
                  style={{ borderColor: border, background: `${accentColor.color}0a` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{group.courierName}</p>
                    {group.courierPhone ? (
                      <p className="text-xs" style={{ color: muted }}>
                        {group.courierPhone}
                      </p>
                    ) : null}
                    <p className="text-lg font-bold tabular-nums mt-1" style={{ color: accentColor.color }}>
                      Jami: {group.totalUzs.toLocaleString('uz-UZ')} so‘m · {group.rows.length} ta
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={batchCourierId !== null || confirmingId !== null}
                    onClick={() => void confirmAllForCourier(group)}
                    className="shrink-0 px-4 py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
                    style={{ background: accentColor.gradient }}
                  >
                    {batchCourierId === group.courierId ? (
                      <Loader2 className="w-4 h-4 animate-spin inline" />
                    ) : (
                      'Barchasini qabul qildim'
                    )}
                  </button>
                </div>
                <ul className="divide-y" style={{ borderColor: border }}>
                  {group.rows.map((row) => (
                    <li
                      key={row.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        {row.handoffKind === 'rental' ? (
                          <span
                            className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md mb-1"
                            style={{ background: `${accentColor.color}22`, color: accentColor.color }}
                          >
                            Ijara
                          </span>
                        ) : null}
                        <p className="font-semibold tabular-nums">
                          {row.courierCashHandoffExpectedUzs.toLocaleString('uz-UZ')} so‘m
                        </p>
                        <p className="font-medium">{formatOrderNumber(row.orderNumber, row.id)}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: muted }}>
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> {row.customerName || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> {row.customerPhone || '—'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={confirmingId !== null || batchCourierId !== null}
                        onClick={() => void confirmReceive(row.id)}
                        className="shrink-0 px-4 py-2 rounded-xl font-semibold text-white flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                        style={{ background: isDark ? '#16a34a' : '#22c55e' }}
                      >
                        {confirmingId === row.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Qabul qildim
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-base font-bold mb-3" style={{ color: muted }}>
          Tarix (kassaga topshirilgan)
        </h3>
        {historyFiltered.length === 0 ? (
          <p className="text-sm" style={{ color: muted }}>
            Tarix bo‘sh.
          </p>
        ) : (
          <ul className="space-y-2">
            {historyFiltered.map((row) => (
              <li
                key={row.id + (row.courierCashHandedToCashierAt || '')}
                className="rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                  borderColor: border,
                }}
              >
                <span className="font-medium">
                  {row.courierName ? `${row.courierName} · ` : ''}
                  {formatOrderNumber(row.orderNumber, row.id)}
                </span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                  {row.courierCashHandoffExpectedUzs.toLocaleString('uz-UZ')} so‘m
                </span>
                <span style={{ color: muted }} className="text-xs">
                  {row.courierCashHandedToCashierAt
                    ? new Date(row.courierCashHandedToCashierAt).toLocaleString('uz-UZ')
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
