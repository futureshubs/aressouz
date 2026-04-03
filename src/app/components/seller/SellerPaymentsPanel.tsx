import { useMemo, useState } from 'react';
import {
  CreditCard,
  RefreshCw,
  Search,
  Image as ImageIcon,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  HelpCircle,
} from 'lucide-react';
import {
  sellerOrderPaymentStatusNorm,
  sellerOrderReceiptImageUrl,
  sellerOrderPaymentMethodLabel,
  sellerOrderNeedsCashierVerification,
  sellerOrderTotal,
  type SellerPaymentNorm,
} from './sellerOrderPaymentUtils';

type PayFilter = 'all' | SellerPaymentNorm | 'verify';

function paymentBadge(norm: SellerPaymentNorm, needsVerify: boolean, isPaid: boolean) {
  if (isPaid) {
    return {
      label: "To'langan",
      Icon: CheckCircle2,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.15)',
    };
  }
  if (needsVerify && (norm === 'pending' || norm === 'unknown')) {
    return {
      label: "Kassa tasdig'i kutilmoqda",
      Icon: Clock,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.15)',
    };
  }
  if (norm === 'failed') {
    return { label: 'Muvaffaqiyatsiz', Icon: AlertCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  }
  if (norm === 'refunded') {
    return { label: 'Qaytarilgan', Icon: Ban, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
  }
  if (norm === 'pending') {
    return { label: 'Kutilmoqda', Icon: Clock, color: '#eab308', bg: 'rgba(234,179,8,0.12)' };
  }
  return { label: 'Nomaʼlum', Icon: HelpCircle, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' };
}

type Props = {
  orders: any[];
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  loading: boolean;
  onReload: () => void;
  orderCustomerName: (o: any) => string;
  orderCustomerPhone: (o: any) => string;
  orderLabel: (o: any) => string;
};

export default function SellerPaymentsPanel({
  orders,
  isDark,
  accentColor,
  loading,
  onReload,
  orderCustomerName,
  orderCustomerPhone,
  orderLabel,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PayFilter>('all');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const rows = useMemo(() => {
    return orders.map((o) => {
      const norm = sellerOrderPaymentStatusNorm(o);
      const receipt = sellerOrderReceiptImageUrl(o);
      const needsVerify = sellerOrderNeedsCashierVerification(o);
      const isPaid = norm === 'paid';
      return { o, norm, receipt, needsVerify, isPaid, total: sellerOrderTotal(o) };
    });
  }, [orders]);

  const summary = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let verify = 0;
    let sumPaid = 0;
    for (const r of rows) {
      if (r.isPaid) {
        paid++;
        sumPaid += r.total;
      } else if (r.norm === 'pending' || r.norm === 'unknown') {
        pending++;
        if (r.needsVerify) verify++;
      }
    }
    return { paid, pending, verify, sumPaid };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'paid' && !r.isPaid) return false;
      if (filter === 'pending' && (r.isPaid || r.norm === 'failed' || r.norm === 'refunded')) return false;
      if (filter === 'failed' && r.norm !== 'failed') return false;
      if (filter === 'refunded' && r.norm !== 'refunded') return false;
      if (
        filter === 'verify' &&
        !(r.needsVerify && !r.isPaid && (r.norm === 'pending' || r.norm === 'unknown'))
      )
        return false;
      if (!q) return true;
      const id = String(r.o?.id || '');
      const num = String(r.o?.orderNumber || '');
      const name = orderCustomerName(r.o).toLowerCase();
      const phone = orderCustomerPhone(r.o).toLowerCase();
      return id.toLowerCase().includes(q) || num.toLowerCase().includes(q) || name.includes(q) || phone.includes(q);
    });
  }, [rows, filter, query, orderCustomerName, orderCustomerPhone]);

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
  } as const;

  const chips: { id: PayFilter; label: string }[] = [
    { id: 'all', label: 'Barchasi' },
    { id: 'paid', label: "To'langan" },
    { id: 'pending', label: 'Kutilmoqda' },
    { id: 'verify', label: 'Kassa tekshiruvi' },
    { id: 'failed', label: 'Xato' },
    { id: 'refunded', label: 'Qaytarilgan' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm" style={{ opacity: 0.65 }}>
          Buyurtmalar bo‘yicha to‘lovlar — kassa cheki rasmi (kasprinter) mavjud bo‘lsa ko‘rinadi
        </p>
        <button
          type="button"
          onClick={() => void onReload()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition active:scale-95 disabled:opacity-50"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "To'langan buyurtmalar",
            value: summary.paid,
            sub: `${summary.sumPaid.toLocaleString('uz-UZ')} so‘m`,
            color: '#22c55e',
          },
          { label: 'Kutilmoqda', value: summary.pending, sub: 'to‘lov yoki tasdiq', color: '#eab308' },
          { label: 'Kassa tekshiruvi', value: summary.verify, sub: 'chek kutilmoqda', color: '#f59e0b' },
          { label: 'Jami qatorlar', value: orders.length, sub: 'barcha buyurtmalar', color: accentColor.color },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-2xl border" style={cardStyle}>
            <p className="text-xs font-medium mb-1" style={{ opacity: 0.6 }}>
              {s.label}
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs mt-1" style={{ opacity: 0.5 }}>
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      <div
        className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between p-4 rounded-2xl border"
        style={cardStyle}
      >
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ opacity: 0.45 }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buyurtma raqami, ID, mijoz..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm"
            style={{
              background: isDark ? '#111' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              color: isDark ? '#fff' : '#111',
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const on = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                className="px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  background: on ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  color: on ? '#fff' : undefined,
                  borderColor: on ? 'transparent' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-12 rounded-3xl border text-center" style={cardStyle}>
          <CreditCard className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h3 className="text-lg font-bold mb-2">To‘lovlar bo‘sh</h3>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Hozircha buyurtmalar yo‘q — mijozlar buyurtma bergach shu yerda to‘lov holati va chek rasmi ko‘rinadi
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ o, norm, receipt, needsVerify, isPaid, total }) => {
            const badge = paymentBadge(norm, needsVerify, isPaid);
            const Icon = badge.Icon;
            const method = sellerOrderPaymentMethodLabel(o);
            const paymeId = String((o as any)?.paymeReceiptId || (o as any)?.payme_receipt_id || '').trim();
            const completedAt = (o as any)?.paymentCompletedAt || (o as any)?.payment_completed_at;
            return (
              <div
                key={String(o?.id || orderLabel(o))}
                className="rounded-2xl border overflow-hidden"
                style={cardStyle}
              >
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-lg">#{orderLabel(o)}</span>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {badge.label}
                      </span>
                      {String((o as any)?.sellerOrderSource || '') === 'legacy_shop_order' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md opacity-60 border">
                          eski format
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm opacity-70">
                      {(o as any)?.createdAt
                        ? new Date((o as any).createdAt).toLocaleString('uz-UZ')
                        : '—'}
                    </p>
                    <p className="text-sm">
                      <span className="opacity-60">Mijoz:</span> {orderCustomerName(o)} ·{' '}
                      {orderCustomerPhone(o)}
                    </p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span>
                        <span className="opacity-60">Usul:</span>{' '}
                        <span className="font-semibold">{method}</span>
                      </span>
                      <span>
                        <span className="opacity-60">Jami:</span>{' '}
                        <span className="font-bold tabular-nums" style={{ color: accentColor.color }}>
                          {total.toLocaleString('uz-UZ')} so‘m
                        </span>
                      </span>
                      {paymeId ? (
                        <span className="font-mono text-xs opacity-70">Payme: {paymeId.slice(0, 24)}…</span>
                      ) : null}
                    </div>
                    {completedAt && isPaid ? (
                      <p className="text-xs opacity-55">
                        To‘lov vaqti: {new Date(completedAt).toLocaleString('uz-UZ')}
                      </p>
                    ) : null}
                  </div>

                  <div className="lg:w-56 shrink-0 flex flex-col items-stretch gap-2">
                    <p className="text-xs font-semibold opacity-60">Kassa cheki / skan</p>
                    {receipt ? (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(receipt)}
                        className="relative rounded-xl border overflow-hidden group w-full aspect-[3/4] max-h-48"
                        style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
                      >
                        <img
                          src={receipt}
                          alt="Chek"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <span className="text-white text-xs font-bold">Kattalashtirish</span>
                        </div>
                      </button>
                    ) : (
                      <div
                        className="rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 py-8 px-3"
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                          opacity: 0.65,
                        }}
                      >
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-xs text-center">
                          {needsVerify && !isPaid
                            ? 'Kassir chekni yuklagach shu yerda paydo bo‘ladi'
                            : 'Chek rasmi yo‘q'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <p className="text-center text-sm opacity-60 py-8">Filtr bo‘yicha natija yo‘q</p>
          ) : null}
        </div>
      )}

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          role="dialog"
          aria-modal
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Yopish"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="To‘lov cheki"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
