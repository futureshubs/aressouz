import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { edgeFunctionBaseUrl } from '../../utils/edgeFunctionBaseUrl';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { formatOrderNumber } from '../../utils/orderNumber';
import { CheckCircle2, Loader2, RotateCcw, Search, Store, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';

export type MerchantCollectRow = {
  id: string;
  orderNumber?: string;
  orderType: string;
  merchantName: string;
  customerName: string;
  customerPhone: string;
  amountUzs: number;
  paymentConfirmedAt: string | null;
  cancelledAt: string | null;
  merchantCollectRequestedAt: string | null;
  merchantCollectResolvedAt: string | null;
  receiptUrl: string | null;
};

type Props = { branchId: string };

const typeLabel = (t: string) => {
  const x = String(t || '').toLowerCase();
  if (x === 'shop') return 'Do‘kon';
  if (x === 'food' || x === 'restaurant') return 'Taom';
  return 'Buyurtma';
};

export function CashierCollectBackTab({ branchId }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl = edgeFunctionBaseUrl();
  const tick = useVisibilityTick();

  const [pending, setPending] = useState<MerchantCollectRow[]>([]);
  const [history, setHistory] = useState<MerchantCollectRow[]>([]);
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
      const qPending = new URLSearchParams({ scope: 'pending', branchToken: token });
      const qHistory = new URLSearchParams({ scope: 'history', branchToken: token });
      const [r1, r2] = await Promise.all([
        fetch(`${apiBaseUrl}/branch/cashier/merchant-collect?${qPending}`, { headers: h }),
        fetch(`${apiBaseUrl}/branch/cashier/merchant-collect?${qHistory}`, { headers: h }),
      ]);
      const d1 = await r1.json().catch(() => ({}));
      const d2 = await r2.json().catch(() => ({}));
      if (r1.ok && d1.success && Array.isArray(d1.items)) setPending(d1.items);
      else setPending([]);
      if (r2.ok && d2.success && Array.isArray(d2.items)) setHistory(d2.items.slice(0, 80));
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
  const filterRow = (row: MerchantCollectRow) => {
    if (!q) return true;
    return (
      String(row.id).toLowerCase().includes(q) ||
      String(row.orderNumber || '').toLowerCase().includes(q) ||
      String(row.merchantName || '').toLowerCase().includes(q) ||
      String(row.customerPhone || '').toLowerCase().includes(q)
    );
  };

  const pendingFiltered = useMemo(() => pending.filter(filterRow), [pending, q]);
  const historyFiltered = useMemo(() => history.filter(filterRow), [history, q]);
  const pendingTotal = useMemo(
    () => pendingFiltered.reduce((s, r) => s + (Number(r.amountUzs) || 0), 0),
    [pendingFiltered],
  );

  const confirmCollect = async (orderId: string) => {
    const token = getStoredBranchToken();
    if (!token) {
      toast.error('Filial sessiyasi yo‘q');
      return;
    }
    setConfirmingId(orderId);
    try {
      const qs = `?branchToken=${encodeURIComponent(token)}`;
      const res = await fetch(
        `${apiBaseUrl}/branch/cashier/merchant-collect/${encodeURIComponent(orderId)}/confirm${qs}`,
        {
          method: 'POST',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Xatolik');
      }
      toast.success('Pul qaytarib olindi');
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Tasdiqlashda xatolik';
      toast.error(msg);
    } finally {
      setConfirmingId(null);
    }
  };

  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border p-4" style={{ background: cardBg, borderColor: border }}>
        <p className="text-sm mb-3" style={{ color: muted }}>
          Agar kassa do‘kon yoki taomga to‘lov yuborgan bo‘lsa, lekin buyurtma bekor bo‘lsa — pulni
          tadbirkordan qaytarib olish kerak. Tasdiqlangandan keyin ro‘yxatdan chiqadi.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          <div
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: `${accentColor.color}18`, color: accentColor.color }}
          >
            Kutilmoqda: {pendingFiltered.length} ta · {pendingTotal.toLocaleString('uz-UZ')} so‘m
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-45" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buyurtma, do‘kon yoki telefon..."
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
          <RotateCcw className="w-5 h-5" style={{ color: accentColor.color }} />
          Olish kerak
        </h3>
        {pendingFiltered.length === 0 ? (
          <p className="text-sm" style={{ color: muted }}>
            Hozircha qaytarib olish kerak bo‘lgan to‘lov yo‘q.
          </p>
        ) : (
          <ul className="space-y-3">
            {pendingFiltered.map((row) => {
              const isFood = ['food', 'restaurant'].includes(String(row.orderType).toLowerCase());
              const TypeIcon = isFood ? UtensilsCrossed : Store;
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  style={{ background: cardBg, borderColor: border }}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                        style={{ background: `${accentColor.color}22`, color: accentColor.color }}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {typeLabel(row.orderType)}
                      </span>
                      {row.merchantName ? (
                        <span className="text-xs font-semibold" style={{ color: muted }}>
                          {row.merchantName}
                        </span>
                      ) : null}
                    </div>
                    <p className="font-bold text-lg tabular-nums" style={{ color: accentColor.color }}>
                      {row.amountUzs.toLocaleString('uz-UZ')} so‘m
                    </p>
                    <p className="font-semibold">{formatOrderNumber(row.orderNumber, row.id)}</p>
                    <p className="text-sm" style={{ color: muted }}>
                      Mijoz: {row.customerName || '—'} · {row.customerPhone || '—'}
                    </p>
                    {row.paymentConfirmedAt ? (
                      <p className="text-xs" style={{ color: muted }}>
                        Kassadan yuborilgan: {new Date(row.paymentConfirmedAt).toLocaleString('uz-UZ')}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={confirmingId !== null}
                    onClick={() => void confirmCollect(row.id)}
                    className="shrink-0 px-5 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: accentColor.gradient }}
                  >
                    {confirmingId === row.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Oldim
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-base font-bold mb-3" style={{ color: muted }}>
          Tarix (qaytarib olingan)
        </h3>
        {historyFiltered.length === 0 ? (
          <p className="text-sm" style={{ color: muted }}>
            Tarix bo‘sh.
          </p>
        ) : (
          <ul className="space-y-2">
            {historyFiltered.map((row) => (
              <li
                key={row.id + (row.merchantCollectResolvedAt || '')}
                className="rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm"
                style={{
                  background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                  borderColor: border,
                }}
              >
                <span className="font-medium">{formatOrderNumber(row.orderNumber, row.id)}</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                  {row.amountUzs.toLocaleString('uz-UZ')} so‘m
                </span>
                <span style={{ color: muted }} className="text-xs">
                  {row.merchantCollectResolvedAt
                    ? new Date(row.merchantCollectResolvedAt).toLocaleString('uz-UZ')
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
