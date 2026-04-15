import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
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
  deliveredAt: string | null;
  paymentMethod?: string;
  finalTotal: number;
  deliveryFee: number;
  /** Ijara qaytarilgach yaratilgan naqd topshiruv */
  handoffKind?: 'market' | 'rental';
};

type Props = { branchId: string };

export function CashierCashReceiveTab({ branchId }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;
  const tick = useVisibilityTick();
  const [pending, setPending] = useState<CourierCashHandoffRow[]>([]);
  const [history, setHistory] = useState<CourierCashHandoffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
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
      if (token) {
        qPending.set('branchToken', token);
        qHistory.set('branchToken', token);
      }
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
      String(row.customerName || '').toLowerCase().includes(q)
    );
  };

  const pendingFiltered = useMemo(() => pending.filter(filterRow), [pending, q]);
  const historyFiltered = useMemo(() => history.filter(filterRow), [history, q]);

  const confirmReceive = async (orderId: string) => {
    const token = getStoredBranchToken();
    if (!token) {
      toast.error('Filial sessiyasi yo‘q');
      return;
    }
    setConfirmingId(orderId);
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
      toast.success('Naqd kassaga qabul qilindi');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Qabul qilishda xatolik');
    } finally {
      setConfirmingId(null);
    }
  };

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border p-4"
        style={{ background: cardBg, borderColor: border }}
      >
        <p className="text-sm mb-3" style={{ color: muted }}>
          Kuryer mijozdan naqd olgach, <strong>mahsulot pulini</strong> kassaga topshiradi. Yetkazib berish haqi
          kuryerda qoladi. <strong>Ijara</strong> buyurtmalarida ham xuddi shu: kuryer «qaytarib oldim» tugmasidan
          keyin kutilayotgan summa shu ro‘yxatga tushadi.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-45" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buyurtma raqami, ID yoki telefon bo‘yicha qidirish..."
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
        </div>
      ) : null}

      <section>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <Banknote className="w-5 h-5" style={{ color: accentColor.color }} />
          Qabul qilish (kutilmoqda)
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${accentColor.color}22`, color: accentColor.color }}
          >
            {pendingFiltered.length}
          </span>
        </h3>
        {pendingFiltered.length === 0 ? (
          <p className="text-sm" style={{ color: muted }}>
            Hozircha kutilayotgan naqd topshiruv yo‘q.
          </p>
        ) : (
          <ul className="space-y-3">
            {pendingFiltered.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                style={{ background: cardBg, borderColor: border }}
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
                  <p className="font-bold text-lg tabular-nums" style={{ color: accentColor.color }}>
                    Olish kerak: {row.courierCashHandoffExpectedUzs.toLocaleString('uz-UZ')} so‘m
                  </p>
                  <p className="text-xs" style={{ color: muted }}>
                    Jami: {row.finalTotal.toLocaleString('uz-UZ')} · Yetkazish (kuryerda):{' '}
                    {row.deliveryFee.toLocaleString('uz-UZ')}
                  </p>
                  <p className="font-semibold">{formatOrderNumber(row.orderNumber, row.id)}</p>
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
                  disabled={confirmingId !== null}
                  onClick={() => void confirmReceive(row.id)}
                  className="shrink-0 px-5 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: accentColor.gradient }}
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
                style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', borderColor: border }}
              >
                <span className="font-medium">{formatOrderNumber(row.orderNumber, row.id)}</span>
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
