import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  CreditCard,
  Search,
  Check,
  X,
  Clock,
  DollarSign,
  History,
  Wallet,
  Save,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '../../../../utils/supabase/info';
import { buildAdminHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

const PAYMENT_METHODS_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/payment-methods`;
const ORDERS_ALL_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/all`;

interface Payment {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  method: string;
  /** To‘lov holati (to‘langan / kutilmoqda / …) */
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  orderId: string;
  createdAt: string;
  transactionId?: string;
  branchId?: string;
  orderType?: string;
  /** Buyurtma jarayoni (yangi, tayyorlanmoqda, …) — KV `status` */
  orderWorkflowStatus: string;
}

function formatPaymentMethodShort(raw: string | null | undefined): string {
  const m = String(raw || '').toLowerCase().trim();
  const map: Record<string, string> = {
    cash: 'Naqd',
    naqd: 'Naqd',
    click: 'Click',
    payme: 'Payme',
    uzum: 'Uzum',
    humo: 'Humo',
    atmos: 'Atmos',
    qr: 'QR',
    qrcode: 'QR',
    card: 'Karta',
    transfer: "O'tkazma",
    cod: 'Naqd (yetkazishda)',
  };
  return map[m] || raw?.trim() || '—';
}

function orderRowToPayment(o: Record<string, unknown>): Payment | null {
  const id = String(o.id ?? o.orderId ?? '').trim();
  if (!id) return null;

  const payNested = o.payment && typeof o.payment === 'object' ? (o.payment as any) : null;
  const ps = String(
    o.paymentStatus ?? o.payment_status ?? (o as any).paymentState ?? payNested?.status ?? '',
  )
    .toLowerCase()
    .trim();
  let status: Payment['status'] = 'pending';
  if (
    ['paid', 'completed', 'complete', 'success', 'succeeded', 'successful', 'captured', 'settled', 'paid_out'].includes(
      ps,
    )
  ) {
    status = 'completed';
  } else if (['failed', 'error', 'declined', 'rejected', 'expired'].includes(ps)) status = 'failed';
  else if (['refunded', 'partially_refunded', 'partial_refund'].includes(ps)) status = 'refunded';

  const amount = Number(o.totalAmount ?? o.finalTotal ?? o.totalPrice ?? o.total ?? 0) || 0;
  const pm = String(o.paymentMethod ?? o.payment_method ?? o.paymentProvider ?? '');
  const pmNorm = pm.toLowerCase().trim();
  const onlinePrepaid = [
    'click',
    'click_card',
    'payme',
    'atmos',
    'uzum',
    'humo',
    'online',
  ].includes(pmNorm);
  const orderSt = String(o.status ?? '').toLowerCase().trim();
  const released = Boolean((o as { releasedToPreparerAt?: string }).releasedToPreparerAt);
  /** Eski KV: to‘lov `pending` qolgan, lekin onlayn va buyurtma allaqachon ishlangan */
  if (
    status === 'pending' &&
    onlinePrepaid &&
    !['cash', 'naqd', 'cod'].includes(pmNorm) &&
    (released ||
      ['preparing', 'ready', 'delivering', 'delivered', 'confirmed'].includes(orderSt))
  ) {
    status = 'completed';
  }

  const createdRaw = o.createdAt ?? o.created_at;
  const createdAt =
    createdRaw && Number.isFinite(new Date(String(createdRaw)).getTime())
      ? new Date(String(createdRaw)).toISOString()
      : new Date().toISOString();

  return {
    id: `hist_${id}`,
    userId: String(o.userId ?? o.customerId ?? ''),
    userName: String(o.customerName ?? o.name ?? 'Mijoz'),
    amount,
    method: formatPaymentMethodShort(pm),
    status,
    orderId: String(o.orderId ?? o.order_number ?? o.orderNumber ?? id).replace(/^order:/, ''),
    createdAt,
    transactionId: o.paymentTransactionId ? String(o.paymentTransactionId) : undefined,
    branchId: o.branchId ? String(o.branchId) : undefined,
    orderType: o.orderType ? String(o.orderType) : o.type ? String(o.type) : undefined,
    orderWorkflowStatus: String(o.status ?? 'pending'),
  };
}

interface PaymentsViewProps {
  onStatsUpdate?: () => void;
}

export default function PaymentsView({ onStatsUpdate }: PaymentsViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  /** Parent `loadStats` har renderda yangi referens — bog‘lasak useEffect cheksiz ishlaydi */
  const onStatsUpdateRef = useRef(onStatsUpdate);
  onStatsUpdateRef.current = onStatsUpdate;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed' | 'refunded'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const visibilityRefetchTick = useVisibilityTick();

  const [paymeEnabled, setPaymeEnabled] = useState(false);
  const [loadingPayme, setLoadingPayme] = useState(true);
  const [savingPayme, setSavingPayme] = useState(false);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(ORDERS_ALL_URL, {
        headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Buyurtmalar (to‘lovlar tarixi) yuklanmadi');
        setPayments([]);
        return;
      }
      const rows: Payment[] = [];
      for (const o of data.orders || []) {
        const p = orderRowToPayment(o as Record<string, unknown>);
        if (p) rows.push(p);
      }
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPayments(rows);
      onStatsUpdateRef.current?.();
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('To‘lovlarni yuklashda xatolik');
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPaymeConfig = useCallback(async () => {
    setLoadingPayme(true);
    try {
      const res = await fetch(PAYMENT_METHODS_URL, {
        headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          toast.error(data?.error || 'Admin huquqi yetarli emas (Payme sozlamalarini ko‘rish)');
        } else {
          toast.error(data?.error || 'Payme sozlamalarini yuklashda xatolik');
        }
        return;
      }
      const payme = Array.isArray(data.methods) ? data.methods.find((m: { type?: string }) => m.type === 'payme') : null;
      if (payme) {
        setPaymeEnabled(Boolean(payme.enabled));
      } else {
        setPaymeEnabled(false);
      }
    } catch (e) {
      console.error(e);
      toast.error('Payme sozlamalarini yuklashda tarmoq xatosi');
    } finally {
      setLoadingPayme(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
    void loadPaymeConfig();
  }, [loadPayments, loadPaymeConfig, visibilityRefetchTick]);

  const savePayme = async () => {
    setSavingPayme(true);
    try {
      const res = await fetch(PAYMENT_METHODS_URL, {
        method: 'POST',
        headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          type: 'payme',
          enabled: paymeEnabled,
          isTestMode: false,
          config: {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Saqlashda xatolik');
        return;
      }
      toast.success('Payme sozlamalari saqlandi');
      await loadPaymeConfig();
    } catch (e) {
      console.error(e);
      toast.error('Saqlashda tarmoq xatosi');
    } finally {
      setSavingPayme(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      payment.userName.toLowerCase().includes(q) ||
      payment.orderId.toLowerCase().includes(q) ||
      (payment.branchId && payment.branchId.toLowerCase().includes(q)) ||
      (payment.orderType && payment.orderType.toLowerCase().includes(q));

    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <X className="w-4 h-4" />;
      case 'refunded':
        return <History className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
      case 'pending':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
      case 'failed':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
      case 'refunded':
        return { bg: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' };
    }
  };

  const getPaymentStatusLabel = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'To‘langan';
      case 'pending':
        return 'Kutilmoqda';
      case 'failed':
        return 'Xatolik';
      case 'refunded':
        return 'Qaytarilgan';
    }
  };

  const getOrderWorkflowText = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    switch (s) {
      case 'new':
        return 'Yangi';
      case 'pending':
        return 'Yangi';
      case 'confirmed':
        return 'Tasdiqlandi';
      case 'preparing':
        return 'Tayyorlanmoqda';
      case 'ready':
        return 'Tayyor';
      case 'delivering':
        return 'Yetkazilmoqda';
      case 'delivered':
        return 'Yetkazildi';
      case 'awaiting_receipt':
        return 'Mijoz tasdig‘i';
      case 'cancelled':
      case 'canceled':
        return 'Bekor';
      default:
        return status || '—';
    }
  };

  const getOrderWorkflowStyle = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'delivered') return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
    if (s === 'cancelled' || s === 'canceled') return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    if (['preparing', 'ready', 'delivering', 'confirmed'].includes(s)) {
      return { bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' };
    }
    return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' };
  };

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  const surface = {
    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-7 h-7" style={{ color: '#00AACB' }} />
          <h2 className="text-2xl font-bold">Payme (Paycom Subscribe)</h2>
        </div>
        <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}>
          Payme{' '}
          <a
            href="https://developer.help.paycom.uz/metody-subscribe-api/"
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: accentColor.color }}
          >
            Subscribe API
          </a>{' '}
          kalitlari faqat <strong>Supabase</strong> da:{' '}
          <code className="text-xs opacity-80">PAYCOM_REGISTER_ID</code>,{' '}
          <code className="text-xs opacity-80">PAYCOM_SECRET_PROD</code> /{' '}
          <code className="text-xs opacity-80">PAYCOM_SECRET_TEST</code>,{' '}
          <code className="text-xs opacity-80">PAYCOM_USE_TEST</code>. Checkout uchun{' '}
          <code className="text-xs opacity-80">PAYME_CHECKOUT_BACK_URL</code> yoki frontend{' '}
          <code className="text-xs opacity-80">VITE_PAYME_RETURN_URL</code> (https).
        </p>

        {loadingPayme ? (
          <div className="flex items-center gap-2 py-8 opacity-70">
            <Loader2 className="w-5 h-5 animate-spin" />
            Yuklanmoqda...
          </div>
        ) : (
          <div className="p-6 rounded-3xl border space-y-5" style={surface}>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="font-medium">Payme faol (checkoutda ko‘rinadi)</span>
              <input
                type="checkbox"
                checked={paymeEnabled}
                onChange={(e) => setPaymeEnabled(e.target.checked)}
                className="w-5 h-5 rounded"
              />
            </label>

            <button
              type="button"
              onClick={() => void savePayme()}
              disabled={savingPayme}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00AACB 0%, #008BA3 100%)' }}
            >
              {savingPayme ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Saqlash
            </button>

            <div className="flex items-start gap-2 text-xs opacity-75">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Faqat «faol» holati KV da. Payme kalitlari bu yerda saqlanmaydi — Supabase Dashboard → Project Settings →
                Edge Functions → Secrets.
              </span>
            </div>
          </div>
        )}
      </section>

      <hr style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <History className="w-6 h-6" style={{ color: accentColor.color }} />
            To&apos;lovlar tarixi
          </h2>
          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}>
            <strong>Buyurtma holati</strong> — yetkazib berish jarayoni (yangi, tayyorlanmoqda, yetkazildi…).{' '}
            <strong>To‘lov holati</strong> — pul tushgani yoki kutilayotgani (Payme/Click oldindan to‘lovda «To‘langan»). Ma’lumot:{' '}
            <code className="text-xs">orders/all</code> (KV).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Qidirish..."
              className="w-full pl-12 pr-4 py-2.5 rounded-2xl border outline-none"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                color: isDark ? '#ffffff' : '#111827',
              }}
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | 'completed' | 'pending' | 'failed' | 'refunded')
            }
            className="px-4 py-2.5 rounded-2xl border outline-none"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              color: isDark ? '#ffffff' : '#111827',
            }}
          >
            <option value="all">Barchasi</option>
            <option value="completed">To‘langan</option>
            <option value="pending">Kutilmoqda</option>
            <option value="failed">Xatolik</option>
            <option value="refunded">Qaytarilgan</option>
          </select>
        </div>

        <div
          className="p-6 rounded-3xl border"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(20, 184, 166, 0.1), rgba(20, 184, 166, 0.05))'
              : 'linear-gradient(145deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.08))',
            borderColor: `${accentColor.color}33`,
            boxShadow: `0 10px 30px ${accentColor.color}20`,
          }}
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl" style={{ background: `${accentColor.color}30` }}>
              <DollarSign className="w-8 h-8" style={{ color: accentColor.color }} />
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                Jami summa (filtr bo‘yicha)
              </p>
              <p className="text-2xl sm:text-3xl font-bold break-all">
                {totalAmount.toLocaleString('uz-UZ')} so&apos;m
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center py-8 opacity-70">Yuklanmoqda...</p>
        ) : filteredPayments.length === 0 ? (
          <div
            className="text-center py-12 rounded-3xl border"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <CreditCard
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
            />
            <p className="text-lg font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              To&apos;lovlar topilmadi
            </p>
          </div>
        ) : (
          <div
            className="rounded-3xl border overflow-hidden"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    <th className="text-left px-6 py-4 text-sm font-semibold">Buyurtma ID</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Filial</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Tur</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Foydalanuvchi</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Summa</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">To&apos;lov turi</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Buyurtma holati</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">To&apos;lov holati</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold">Sana</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => {
                    const statusColor = getStatusColor(payment.status);
                    return (
                      <tr
                        key={payment.id}
                        className="border-b last:border-b-0 hover:bg-opacity-50 transition-colors"
                        style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono font-semibold">{payment.orderId}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono max-w-[140px] truncate" title={payment.branchId}>
                          {payment.branchId || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm">{payment.orderType || '—'}</td>
                        <td className="px-6 py-4">{payment.userName}</td>
                        <td className="px-6 py-4 font-semibold">{payment.amount.toLocaleString()} so&apos;m</td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                              color: isDark ? '#ffffff' : '#111827',
                            }}
                          >
                            {payment.method}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: getOrderWorkflowStyle(payment.orderWorkflowStatus).bg,
                              color: getOrderWorkflowStyle(payment.orderWorkflowStatus).color,
                            }}
                          >
                            {getOrderWorkflowText(payment.orderWorkflowStatus)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: statusColor.bg,
                              color: statusColor.color,
                            }}
                          >
                            {getStatusIcon(payment.status)}
                            {getPaymentStatusLabel(payment.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {new Date(payment.createdAt).toLocaleString('uz-UZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
