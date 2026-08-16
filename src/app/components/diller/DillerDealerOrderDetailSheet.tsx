import { useState } from 'react';
import { Calendar, CheckCircle2, Package, Pencil, Store, Trash2, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerDealerOrder } from '../../utils/dillerData';
import { DILLER_PRODUCT_UNITS, formatMoney } from '../../utils/dillerData';
import { formatDillerDateTime } from '../../utils/dillerTime';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassBarStyle,
  iosGlassCardStyle,
  iosGlassPageStyle,
} from './dillerIosGlass';

type Props = {
  open: boolean;
  order: DillerDealerOrder | null;
  data: DillerData;
  onClose: () => void;
  onEdit: (order: DillerDealerOrder) => void;
  onCancel: (order: DillerDealerOrder) => void;
  onDeliver: (order: DillerDealerOrder) => void;
};

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

export function DillerDealerOrderDetailSheet({
  open,
  order,
  data,
  onClose,
  onEdit,
  onCancel,
  onDeliver,
}: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!open || !order) return null;

  const store = data.stores.find((s) => s.id === order.storeId);
  const openOrder = order.status === 'open';
  const totalQty = order.items.reduce((s, it) => s + it.qty, 0);
  const status =
    order.status === 'done'
      ? { label: 'Topshirildi', color: '#10b981' }
      : order.status === 'cancelled'
        ? { label: 'Bekor qilingan', color: '#ef4444' }
        : { label: 'Ochiq', color: '#f59e0b' };

  return (
    <div
      className={`${dillerSheetShellClass} animate-in fade-in slide-in-from-right-8 duration-300`}
      style={{ ...iosGlassPageStyle(isDark), zIndex: 118 }}
    >
      <header
        className="shrink-0 px-4 pt-2 pb-3"
        style={{ ...iosGlassBarStyle(isDark), borderTop: 'none' }}
      >
        <div className="flex justify-center pb-2">
          <span className="w-10 h-1 rounded-full bg-white/25" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-black text-[17px] truncate tracking-tight">
              {store?.name ?? 'Do‘kon'}
            </h2>
            <p className="text-[11px] opacity-50 mt-0.5">
              {totalQty} dona · {order.items.length} tur
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmCancel(false);
              onClose();
            }}
            className="p-2.5 rounded-xl shrink-0"
            style={iosGlassCardStyle(isDark)}
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className={`${dillerSheetScrollClass} px-4 py-3 space-y-3 pb-6 max-w-lg mx-auto w-full`}>
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${status.color}22`, color: status.color }}
          >
            {status.label}
          </span>
          <span className="text-[20px] font-black tabular-nums" style={{ color: accentColor.color }}>
            {formatMoney(order.total)}
          </span>
        </div>

        <section className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wide opacity-50">
            <Store className="w-3.5 h-3.5" />
            Do‘kon
          </div>
          <div className="font-semibold">{store?.name ?? '—'}</div>
          {store?.address ? <div className="text-xs opacity-60 mt-0.5">{store.address}</div> : null}
          {store?.phone ? <div className="text-xs opacity-55 mt-1">{store.phone}</div> : null}
        </section>

        <section className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wide opacity-50">
            <Package className="w-3.5 h-3.5" />
            Mahsulotlar
          </div>
          <ul className="divide-y divide-white/5">
            {order.items.map((it, i) => (
              <li key={`${it.productId}-${i}`} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{it.productName}</div>
                  <div className="text-[11px] opacity-50 mt-0.5">
                    {it.qty} {unitLabel(String(it.unit ?? 'dona'))} · {formatMoney(it.unitPrice)}
                  </div>
                </div>
                <div className="font-bold text-sm tabular-nums shrink-0">{formatMoney(it.lineTotal)}</div>
              </li>
            ))}
          </ul>
        </section>

        {order.note ? (
          <section className="rounded-[22px] p-4 text-sm" style={iosGlassCardStyle(isDark)}>
            <div className="text-[10px] uppercase tracking-wide opacity-45 mb-1">Izoh</div>
            {order.note}
          </section>
        ) : null}

        <section className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
          <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wide opacity-50">
            <Calendar className="w-3.5 h-3.5" />
            Vaqt
          </div>
          <div className="text-sm">Yaratildi: {formatDillerDateTime(order.createdAt)}</div>
          {order.completedAt ? (
            <div className="text-sm mt-1">Topshirildi: {formatDillerDateTime(order.completedAt)}</div>
          ) : null}
          {order.cancelledAt ? (
            <div className="text-sm mt-1 text-rose-400">
              Bekor: {formatDillerDateTime(order.cancelledAt)}
            </div>
          ) : null}
        </section>
      </div>

      {openOrder ? (
        <div
          className="shrink-0 px-4 py-3 max-w-lg mx-auto w-full space-y-2"
          style={{ ...iosGlassBarStyle(isDark), borderBottom: 'none' }}
        >
          {confirmCancel ? (
            <div className="rounded-[16px] px-3 py-3 text-sm" style={iosGlassCardStyle(isDark)}>
              <p className="font-semibold mb-2">Buyurtmani bekor qilasizmi?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="py-3 rounded-xl font-bold"
                  style={iosGlassCardStyle(isDark)}
                >
                  Yo‘q
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCancel(order);
                    setConfirmCancel(false);
                  }}
                  className="py-3 rounded-xl font-bold text-white bg-rose-500/90"
                >
                  Ha, bekor
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(order)}
                  className="py-3.5 rounded-[16px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  style={iosGlassCardStyle(isDark)}
                >
                  <Pencil className="w-4 h-4" />
                  Tahrirlash
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="py-3.5 rounded-[16px] font-bold text-rose-400 flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  style={iosGlassCardStyle(isDark)}
                >
                  <Trash2 className="w-4 h-4" />
                  Bekor qilish
                </button>
              </div>
              <button
                type="button"
                onClick={() => onDeliver(order)}
                className="w-full py-3.5 rounded-[16px] font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98]"
                style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
              >
                <CheckCircle2 className="w-4 h-4" />
                Topshirdim — {formatMoney(order.total)}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
