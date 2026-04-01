import { useCallback, useEffect, useState } from 'react';
import {
  ShoppingCart,
  XCircle,
  Loader2,
  ChevronRight,
  Banknote,
  MapPin,
  Package,
  User,
  Phone,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { projectId } from '../../../../utils/supabase/info';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';

type Props = {
  onOrdersChanged?: () => void | Promise<void>;
  readOnly?: boolean;
};

const paymentMethodLabel = (m: string) => {
  const x = String(m || '').toLowerCase();
  const map: Record<string, string> = {
    cash: 'Naqd pul',
    naqd: 'Naqd pul',
    click: 'Click',
    payme: 'Payme',
    uzum: 'Uzum',
    humo: 'Humo',
    atmos: 'Atmos',
    qr: 'QR',
    card: 'Karta',
    transfer: "O'tkazma",
  };
  return map[x] || m || "Noma'lum";
};

const metaRow = (
  Icon: typeof User,
  label: string,
  value: string,
  isDark: boolean,
) => (
  <div className="flex items-start gap-2 text-sm min-w-0">
    <Icon
      className="w-4 h-4 shrink-0 mt-0.5 opacity-50"
      style={{ color: isDark ? '#fff' : '#111' }}
    />
    <div className="min-w-0">
      <span className="text-[11px] uppercase tracking-wide opacity-45 block">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  </div>
);

/**
 * Filial: onlayn market naqd buyurtmalarini qabul qilish.
 */
export function PendingCashMarketBranchPanel({ onOrdersChanged, readOnly = false }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [pendingCashMarketOrders, setPendingCashMarketOrders] = useState<any[]>([]);
  const [cancelledCashMarketOrders, setCancelledCashMarketOrders] = useState<any[]>([]);
  const [loadingCashPending, setLoadingCashPending] = useState(false);
  const [releasingOrderId, setReleasingOrderId] = useState<string | null>(null);
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  const loadPendingCashMarketOrders = useCallback(async () => {
    const token = getStoredBranchToken();
    if (!token) {
      setPendingCashMarketOrders([]);
      setCancelledCashMarketOrders([]);
      return;
    }
    try {
      setLoadingCashPending(true);
      const params = new URLSearchParams({ type: 'market' });
      params.set('branchToken', token);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/branch?${params}`,
        { headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) },
      );
      const data = await res.json();
      if (!data.success || !Array.isArray(data.orders)) {
        setPendingCashMarketOrders([]);
        setCancelledCashMarketOrders([]);
        return;
      }
      const isCashMarketPayment = (o: any) => {
        const pm = String(o.paymentMethod ?? o.payment_method ?? '')
          .toLowerCase()
          .trim();
        return pm === 'cash' || pm === 'naqd';
      };
      const list = data.orders.filter((o: any) => {
        if (!isCashMarketPayment(o)) return false;
        if (o.releasedToPreparerAt) return false;
        const st = String(o.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'canceled') return false;
        return true;
      });
      setPendingCashMarketOrders(list);
      const cancelledList = data.orders.filter((o: any) => {
        if (!isCashMarketPayment(o)) return false;
        const st = String(o.status || '').toLowerCase();
        if (st !== 'cancelled' && st !== 'canceled') return false;
        return true;
      });
      setCancelledCashMarketOrders(cancelledList.slice(0, 50));
    } catch (e) {
      console.error('pending cash market orders:', e);
      setPendingCashMarketOrders([]);
      setCancelledCashMarketOrders([]);
    } finally {
      setLoadingCashPending(false);
    }
  }, []);

  const handleReleaseMarketCashToPreparer = async (orderId: string) => {
    try {
      setReleasingOrderId(orderId);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/${encodeURIComponent(orderId)}/release-to-preparer`,
        { method: 'POST', headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Yuborishda xatolik');
        return;
      }
      toast.success('Buyurtma tayyorlovchiga yuborildi');
      await loadPendingCashMarketOrders();
      await onOrdersChanged?.();
    } catch (e) {
      console.error(e);
      toast.error('Yuborishda xatolik');
    } finally {
      setReleasingOrderId(null);
    }
  };

  useEffect(() => {
    void loadPendingCashMarketOrders();
  }, [loadPendingCashMarketOrders, visibilityTick]);

  useEffect(() => {
    const token = getStoredBranchToken();
    if (!token) return;
    const t = window.setInterval(() => loadPendingCashMarketOrders(), 25000);
    return () => window.clearInterval(t);
  }, [loadPendingCashMarketOrders]);

  const branchToken = getStoredBranchToken();
  const shouldShow =
    !!branchToken &&
    (loadingCashPending ||
      pendingCashMarketOrders.length > 0 ||
      cancelledCashMarketOrders.length > 0);

  if (!shouldShow) return null;

  const surface = isDark ? 'rgba(15, 15, 18, 0.92)' : '#ffffff';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const borderSubtle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <section
      className="rounded-2xl sm:rounded-3xl overflow-hidden border shadow-lg sm:shadow-xl"
      style={{
        background: surface,
        borderColor: isDark ? 'rgba(251, 191, 36, 0.22)' : 'rgba(251, 191, 36, 0.35)',
        boxShadow: isDark
          ? '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(251,191,36,0.08) inset'
          : '0 12px 40px rgba(251, 191, 36, 0.12), 0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Sarlavha — ixcham */}
      <div
        className="px-4 py-3 sm:px-5 sm:py-4 flex items-start gap-3"
        style={{
          background: isDark
            ? 'linear-gradient(105deg, rgba(251, 191, 36, 0.14) 0%, rgba(255,255,255,0.02) 55%)'
            : 'linear-gradient(105deg, rgba(254, 243, 199, 0.9) 0%, rgba(255,255,255,0.5) 100%)',
          borderBottom: `1px solid ${borderSubtle}`,
        }}
      >
        <div
          className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: isDark ? 'rgba(251, 191, 36, 0.18)' : 'rgba(251, 191, 36, 0.25)',
            color: isDark ? '#fcd34d' : '#b45309',
          }}
        >
          <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base sm:text-lg font-bold leading-tight tracking-tight">
              Naqd to‘lov — filial qabuli
            </h3>
            {loadingCashPending ? (
              <Loader2 className="w-5 h-5 animate-spin shrink-0 mt-0.5" style={{ color: accentColor.color }} />
            ) : null}
          </div>
          <p className="text-xs sm:text-sm mt-1 leading-relaxed" style={{ color: muted }}>
            Mijoz naqd tanlasa, buyurtmani qabul qilib tayyorlovchiga yuboring.
          </p>
          <details className="mt-2 group">
            <summary
              className="list-none cursor-pointer flex items-center gap-1.5 text-xs font-semibold select-none [&::-webkit-details-marker]:hidden"
              style={{ color: accentColor.color }}
            >
              <Info className="w-3.5 h-3.5 shrink-0" />
              Qanday ishlaydi?
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
            </summary>
            <p
              className="text-xs sm:text-sm mt-2 pl-5 border-l-2 leading-relaxed"
              style={{ borderColor: `${accentColor.color}55`, color: muted }}
            >
              Naqd buyurtmalar avval shu yerda turadi — «Qabul qilish»dan keyin tayyorlovchi paneliga
              o‘tadi. Click, Payme va boshqa onlayn to‘lovlar odatda avval to‘langan bo‘lgani uchun bevosita
              tayyorlovchiga yo‘naltiriladi.
            </p>
          </details>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
        {/* Hisoblagichlar */}
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold"
            style={{
              background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(251, 191, 36, 0.2)',
              color: isDark ? '#fcd34d' : '#92400e',
              border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(217,119,6,0.2)'}`,
            }}
          >
            <span className="opacity-80 font-semibold text-xs uppercase tracking-wide">Kutilmoqda</span>
            {pendingCashMarketOrders.length}
          </span>
          {cancelledCashMarketOrders.length > 0 ? (
            <span
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 226, 226, 0.8)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <XCircle className="w-4 h-4 shrink-0" />
              Bekor: {cancelledCashMarketOrders.length}
            </span>
          ) : null}
        </div>

        {/* Kutilayotgan ro‘yxat */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="h-6 w-1 rounded-full shrink-0"
              style={{ backgroundColor: accentColor.color }}
            />
            <h4 className="text-sm sm:text-base font-bold" style={{ color: isDark ? '#e5e5e5' : '#111827' }}>
              Qabul kutilayotgan buyurtmalar
            </h4>
          </div>

          {!loadingCashPending && pendingCashMarketOrders.length === 0 ? (
            <div
              className="rounded-xl px-4 py-6 text-center text-sm"
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                color: muted,
                border: `1px dashed ${borderSubtle}`,
              }}
            >
              <Package className="w-8 h-8 mx-auto mb-2 opacity-35" />
              Hozir kutilayotgan naqd buyurtma yo‘q
            </div>
          ) : null}

          {pendingCashMarketOrders.length > 0 ? (
            <div
              className="space-y-3 max-h-[min(55vh,420px)] overflow-y-auto pr-1 -mr-1 sm:max-h-[min(60vh,520px)]"
              style={{ scrollbarGutter: 'stable' }}
            >
              {pendingCashMarketOrders.map((ord) => {
                const total = Number(ord.finalTotal ?? ord.totalAmount ?? 0);
                return (
                  <article
                    key={ord.id}
                    className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-md"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
                      borderColor: borderSubtle,
                    }}
                  >
                    <div
                      className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-2"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(251, 191, 36, 0.08)',
                        borderBottom: `1px solid ${borderSubtle}`,
                      }}
                    >
                      <span
                        className="font-mono text-xs sm:text-sm font-bold tracking-tight px-2 py-1 rounded-lg"
                        style={{
                          background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.9)',
                          color: isDark ? '#fbbf24' : '#92400e',
                        }}
                      >
                        {ord.orderNumber || ord.id}
                      </span>
                      <span className="text-lg sm:text-xl font-extrabold tabular-nums" style={{ color: accentColor.color }}>
                        {total.toLocaleString('uz-UZ')}{' '}
                        <span className="text-xs sm:text-sm font-semibold opacity-80">so‘m</span>
                      </span>
                    </div>

                    <div className="p-3 sm:p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {metaRow(User, 'Mijoz', ord.customerName || '—', isDark)}
                        {metaRow(Phone, 'Telefon', ord.customerPhone || '—', isDark)}
                        {metaRow(
                          Banknote,
                          'To‘lov',
                          paymentMethodLabel(ord.paymentMethod ?? ord.payment_method),
                          isDark,
                        )}
                        {ord.deliveryZone
                          ? metaRow(Package, 'Zona', String(ord.deliveryZone), isDark)
                          : null}
                      </div>
                      {ord.addressText ? metaRow(MapPin, 'Manzil', ord.addressText, isDark) : null}
                      {ord.notes ? (
                        <p className="text-xs sm:text-sm rounded-lg px-3 py-2" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', color: muted }}>
                          <span className="font-semibold text-[11px] uppercase opacity-60">Izoh · </span>
                          {ord.notes}
                        </p>
                      ) : null}

                      {!readOnly && ord.id ? (
                        <button
                          type="button"
                          onClick={() => handleReleaseMarketCashToPreparer(String(ord.id))}
                          disabled={releasingOrderId === ord.id}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white text-sm sm:text-base transition active:scale-[0.98] disabled:opacity-55 disabled:cursor-not-allowed"
                          style={{
                            background: accentColor.gradient,
                            boxShadow: `0 6px 20px ${accentColor.color}40`,
                          }}
                        >
                          {releasingOrderId === ord.id ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Yuborilmoqda…
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5 shrink-0" />
                              Qabul qilish — tayyorlovchiga
                            </>
                          )}
                        </button>
                      ) : null}

                      <div
                        className="text-xs space-y-1.5 pt-3 border-t"
                        style={{ borderColor: borderSubtle, color: muted }}
                      >
                        <p className="font-semibold text-[11px] uppercase tracking-wide opacity-70 mb-1">
                          Mahsulotlar
                        </p>
                        {(Array.isArray(ord.items) ? ord.items : []).slice(0, 12).map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between gap-3 py-1 border-b last:border-0" style={{ borderColor: borderSubtle }}>
                            <span className="truncate min-w-0">
                              {it.name || it.title || 'Mahsulot'}
                              {it.variantName || it.size ? ` · ${it.variantName || it.size}` : ''}{' '}
                              <span className="opacity-70">×{Number(it.quantity || 1)}</span>
                            </span>
                            <span className="shrink-0 tabular-nums font-medium">
                              {(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString('uz-UZ')}
                            </span>
                          </div>
                        ))}
                        {Array.isArray(ord.items) && ord.items.length > 12 ? (
                          <p className="italic text-[11px] pt-1">+ yana {ord.items.length - 12} pozitsiya</p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Bekor — yig‘ilgan, ochiladigan */}
        {cancelledCashMarketOrders.length > 0 ? (
          <details className="rounded-2xl border overflow-hidden group" style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}>
            <summary
              className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(254, 226, 226, 0.5)',
              }}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-red-500">
                <XCircle className="w-4 h-4 shrink-0" />
                Bekor qilingan ({cancelledCashMarketOrders.length})
              </span>
              <ChevronRight className="w-4 h-4 text-red-400 transition-transform group-open:rotate-90 shrink-0" />
            </summary>
            <p className="text-[11px] px-4 pb-2" style={{ color: muted }}>
              Oxirgi 50 ta, faqat naqd to‘lov
            </p>
            <div className="px-3 pb-3 space-y-2 max-h-[min(40vh,320px)] overflow-y-auto">
              {cancelledCashMarketOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-xl border p-3 text-sm"
                  style={{
                    background: isDark ? 'rgba(239, 68, 68, 0.06)' : 'rgba(255,255,255,0.8)',
                    borderColor: 'rgba(239, 68, 68, 0.15)',
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <span className="font-semibold font-mono text-xs">{ord.orderNumber || ord.id}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-red-500/15 text-red-500">
                      Bekor
                    </span>
                  </div>
                  <p className="text-xs opacity-80">
                    {ord.customerName || 'Mijoz'} · {ord.customerPhone || '—'}
                  </p>
                  <p className="text-xs mt-1 tabular-nums font-semibold" style={{ color: muted }}>
                    {Number(ord.finalTotal ?? ord.totalAmount ?? 0).toLocaleString('uz-UZ')} so‘m
                  </p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
