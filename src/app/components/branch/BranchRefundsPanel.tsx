import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Loader2,
  RotateCcw,
  User,
  Phone,
  Banknote,
  Package,
  Mail,
  MapPin,
  Calendar,
  Hash,
  CheckCircle2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { PendingOrderLineCard } from './PendingCashMarketBranchPanel';
import { toast } from 'sonner';

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

const orderTypeBadge = (orderType: string) => {
  const t = String(orderType || '').toLowerCase();
  if (t === 'shop') return 'Do‘kon';
  if (t === 'food') return 'Taom';
  return 'Market';
};

function formatWhen(iso: string | undefined | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return String(iso);
  return new Date(iso).toLocaleString('uz-UZ');
}

const metaRow = (
  Icon: LucideIcon,
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

export type BranchRefundsPanelProps = {
  /** `cashier` — kassa: to‘liq ma’lumot + «qaytarildi» tasdiq */
  variant?: 'branch' | 'cashier';
};

/**
 * Filial / kassa: onlayn to‘lov qaytarish navbati (bekor + refundPending).
 */
export function BranchRefundsPanel({ variant = 'branch' }: BranchRefundsPanelProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isCashier = variant === 'cashier';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  useVisibilityRefetch(() => setTick((t) => t + 1));

  const load = useCallback(async () => {
    const token = getStoredBranchToken();
    if (!token) {
      setRows([]);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ refundQueue: '1' });
      params.set('branchToken', token);
      const res = await fetch(`${apiBaseUrl}/orders/branch?${params}`, {
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.orders)) {
        setRows([]);
        return;
      }
      setRows(data.orders);
    } catch (e) {
      console.error('branch refunds:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  useEffect(() => {
    const token = getStoredBranchToken();
    if (!token) return;
    const t = window.setInterval(() => load(), 30000);
    return () => window.clearInterval(t);
  }, [load]);

  const confirmRefund = async (orderId: string) => {
    if (
      !window.confirm(
        "Mijozga to‘lov provayder (Click / Payme / …) orqali qaytarilganini tasdiqlaysizmi? Buyurtma navbatdan yopiladi.",
      )
    ) {
      return;
    }
    const note = window.prompt('Izoh (ixtiyoriy), masalan: tranzaksiya raqami') || '';
    setConfirmingId(orderId);
    try {
      const res = await fetch(
        `${apiBaseUrl}/orders/${encodeURIComponent(orderId)}/confirm-refund-by-cashier`,
        {
          method: 'POST',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ note: note.trim() || undefined }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Xatolik');
      }
      toast.success('Qaytarish tasdiqlandi');
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Xatolik';
      toast.error(msg);
    } finally {
      setConfirmingId(null);
    }
  };

  const token = getStoredBranchToken();
  if (!token) return null;

  const surface = isDark ? 'rgba(15, 15, 18, 0.92)' : '#ffffff';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const borderSubtle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const headerTitle = isCashier ? 'Mijozga to‘lov qaytarish' : 'Qaytarish to‘lovlari';
  const headerHint = isCashier
    ? 'Oldindan onlayn to‘lagan va buyurtmasi bekor qilingan mijozlar. Pastda barcha ma’lumotlar. Provayder kabinetida summani qaytarib, keyin «To‘lov qaytarildi» ni bosing — mijoz profilida ham yangilanadi.'
    : 'Onlayn to‘langan va bekor qilingan buyurtmalar. Mijozga profilda «qaytarish kutilmoqda» ko‘rinadi. Kassa panelida provayder orqali qaytarib, «To‘lov qaytarildi» bilan yoping.';

  return (
    <section
      className="rounded-2xl sm:rounded-3xl overflow-hidden border shadow-lg sm:shadow-xl"
      style={{
        background: surface,
        borderColor: isDark ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.35)',
        boxShadow: isDark
          ? '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(239,68,68,0.1) inset'
          : '0 12px 40px rgba(239, 68, 68, 0.1), 0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="px-4 py-3 sm:px-5 sm:py-4 flex items-start gap-3"
        style={{
          background: isDark
            ? 'linear-gradient(105deg, rgba(239, 68, 68, 0.14) 0%, rgba(255,255,255,0.02) 55%)'
            : 'linear-gradient(105deg, rgba(254, 226, 226, 0.85) 0%, rgba(255,255,255,0.5) 100%)',
          borderBottom: `1px solid ${borderSubtle}`,
        }}
      >
        <div
          className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
          }}
        >
          <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base sm:text-lg font-bold leading-tight tracking-tight">{headerTitle}</h3>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin shrink-0 mt-0.5" style={{ color: accentColor.color }} />
            ) : null}
          </div>
          <p className="text-xs sm:text-sm mt-1 leading-relaxed" style={{ color: muted }}>
            {headerHint}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3 max-h-[min(70vh,640px)] overflow-y-auto pr-1 -mr-1">
        {!loading && rows.length === 0 ? (
          <div
            className="rounded-xl px-4 py-8 text-center text-sm"
            style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              color: muted,
              border: `1px dashed ${borderSubtle}`,
            }}
          >
            Hozir qaytarish navbati bo‘sh
          </div>
        ) : null}
        {rows.map((ord) => {
          const total = Number(ord.finalTotal ?? ord.totalAmount ?? 0);
          const email =
            ord.customerEmail ??
            ord.customer_email ??
            ord.email ??
            (ord.customerInfo && typeof ord.customerInfo === 'object'
              ? (ord.customerInfo as { email?: string }).email
              : '') ??
            '';
          const addr =
            ord.customerAddress ??
            ord.addressText ??
            (typeof ord.address === 'string' ? ord.address : '') ??
            '';
          const userId = ord.userId ?? ord.user_id ?? '';
          const paymeId = ord.paymeReceiptId ?? ord.payme_receipt_id ?? '';
          const clickId = ord.clickTransId ?? ord.click_trans_id ?? '';
          const refundReq = ord.refundRequestedAt ?? ord.refund_requested_at ?? '';
          const cancelledAt = ord.cancelledByBranchAt ?? ord.cancelled_at ?? ord.updatedAt ?? '';

          return (
            <article
              key={ord.id}
              className="rounded-2xl border overflow-hidden"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
                borderColor: borderSubtle,
              }}
            >
              <div
                className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-2"
                style={{
                  background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(254,226,226,0.35)',
                  borderBottom: `1px solid ${borderSubtle}`,
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold">{ord.orderNumber || ord.id}</span>
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                    style={{
                      background: 'rgba(239,68,68,0.2)',
                      color: '#dc2626',
                    }}
                  >
                    {orderTypeBadge(ord.orderType)}
                  </span>
                </div>
                <span className="text-base font-extrabold tabular-nums text-red-600 dark:text-red-400">
                  {total.toLocaleString('uz-UZ')} so‘m
                </span>
              </div>
              <div className="p-3 sm:p-4 space-y-3">
                <div
                  className={`grid grid-cols-1 gap-3 ${isCashier ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}
                >
                  {metaRow(User, 'Mijoz ismi', ord.customerName || '—', isDark)}
                  {metaRow(Phone, 'Telefon', ord.customerPhone || '—', isDark)}
                  {metaRow(
                    Banknote,
                    'To‘lov usuli',
                    paymentMethodLabel(ord.paymentMethod ?? ord.payment_method),
                    isDark,
                  )}
                  {isCashier ? metaRow(Mail, 'Email', String(email || '—'), isDark) : null}
                  {isCashier ? metaRow(MapPin, 'Manzil', String(addr || '—'), isDark) : null}
                  {isCashier ? metaRow(Hash, 'Buyurtma ID', String(ord.id || '—'), isDark) : null}
                  {isCashier && userId
                    ? metaRow(Hash, 'Foydalanuvchi ID', String(userId), isDark)
                    : null}
                  {isCashier ? metaRow(Calendar, 'Buyurtma vaqti', formatWhen(ord.createdAt), isDark) : null}
                  {isCashier ? metaRow(Calendar, 'Bekor / so‘rov', formatWhen(refundReq || cancelledAt), isDark) : null}
                  {isCashier && paymeId
                    ? metaRow(Hash, 'Payme chek / ID', String(paymeId), isDark)
                    : null}
                  {isCashier && clickId
                    ? metaRow(Hash, 'Click tranzaksiya', String(clickId), isDark)
                    : null}
                </div>
                <p
                  className="text-xs font-semibold rounded-lg px-3 py-2"
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(254,226,226,0.6)',
                    color: '#b91c1c',
                  }}
                >
                  {isCashier
                    ? 'Avval Click / Payme / boshqa provayder kabinetida qaytarishni amalga oshiring, keyin pastdagi tugmani bosing.'
                    : 'Qaytarish kutilmoqda — kassa provayderda qaytarib, tasdiqlaydi.'}
                </p>
                {isCashier ? (
                  <button
                    type="button"
                    disabled={confirmingId !== null}
                    onClick={() => void confirmRefund(String(ord.id))}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: accentColor.gradient }}
                  >
                    {confirmingId === ord.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    To‘lov qaytarildi (tasdiqlash)
                  </button>
                ) : null}
                <div className="text-xs space-y-2 pt-2 border-t" style={{ borderColor: borderSubtle, color: muted }}>
                  <p className="font-semibold text-[11px] uppercase tracking-wide opacity-70 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    Mahsulotlar ({Array.isArray(ord.items) ? ord.items.length : 0} ta)
                  </p>
                  <div className="space-y-2">
                    {(Array.isArray(ord.items) ? ord.items : []).map((raw: unknown, idx: number) => {
                      const it = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
                      return (
                        <PendingOrderLineCard
                          key={`${ord.id}-${idx}`}
                          it={it}
                          isDark={isDark}
                          borderSubtle={borderSubtle}
                          muted={muted}
                          accentHex={accentColor.color}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
