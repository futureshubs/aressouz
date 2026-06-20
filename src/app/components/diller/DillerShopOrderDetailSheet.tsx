import type { ReactNode } from 'react';
import {
  Calendar,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Store,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerShopOrder, DillerShopOrderStatus } from '../../utils/dillerData';
import { findStoresByPhone, formatMoney } from '../../utils/dillerData';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';

const statusLabel: Record<DillerShopOrderStatus, string> = {
  pending: 'Kutilmoqda',
  accepted: 'Qabul qilindi',
  rejected: 'Rad etildi',
  done: 'Bajarildi',
};

const statusColor: Record<DillerShopOrderStatus, string> = {
  pending: '#f59e0b',
  accepted: '#3b82f6',
  rejected: '#ef4444',
  done: '#10b981',
};

type Props = {
  open: boolean;
  order: DillerShopOrder | null;
  data: DillerData;
  onClose: () => void;
  onSetStatus: (order: DillerShopOrder, status: DillerShopOrderStatus) => void;
  onCompleteOrder?: (order: DillerShopOrder) => void;
};

function Section({
  title,
  icon,
  children,
  isDark,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  isDark: boolean;
}) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wide opacity-50">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-white/5 last:border-0">
      <span className="text-[10px] uppercase tracking-wide opacity-45">{label}</span>
      {href ? (
        <a href={href} className="font-semibold text-sm text-emerald-500 break-all">
          {value}
        </a>
      ) : (
        <span className="font-semibold text-sm break-words">{value || '—'}</span>
      )}
    </div>
  );
}

export function DillerShopOrderDetailSheet({
  open,
  order,
  data,
  onClose,
  onSetStatus,
  onCompleteOrder,
}: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  if (!open || !order) return null;

  const storeMatches = findStoresByPhone(data, order.customerPhone);
  const store =
    (order.storeId ? data.stores.find((s) => s.id === order.storeId) : null) ??
    (order.storeName ? storeMatches.find((s) => s.name === order.storeName) : null) ??
    storeMatches[0] ??
    null;
  const displayStore = store ?? (order.storeName
    ? {
        name: order.storeName,
        address: order.customerAddress ?? '',
        contactName: '',
        phone: order.customerPhone,
      }
    : null);

  const totalQty = order.items.reduce((s, it) => s + it.qty, 0);
  const created = new Date(order.createdAt);
  const orderNo = order.id.replace(/^ord_/, '').slice(0, 12).toUpperCase();

  return (
    <div className={dillerSheetShellClass} style={{ background: isDark ? '#000' : '#f4f4f5' }}>
      <div
        className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <div className="min-w-0">
          <h2 className="font-black text-base truncate">Buyurtma batafsil</h2>
          <p className="text-[10px] opacity-50 font-mono">#{orderNo}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center opacity-70 active:opacity-100"
          style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
          aria-label="Yopish"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-4 max-w-lg mx-auto w-full pb-8`}>
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{
              background: `${statusColor[order.status]}22`,
              color: statusColor[order.status],
            }}
          >
            {statusLabel[order.status]}
          </span>
          <div className="text-right">
            <div className="text-xl font-black text-emerald-500">{formatMoney(order.total)}</div>
            <div className="text-[10px] opacity-50">
              {totalQty} ta · {order.items.length} tur
            </div>
          </div>
        </div>

        <Section title="Mijoz" icon={<User className="w-3.5 h-3.5" />} isDark={isDark}>
          <InfoRow label="Ism / do‘kon" value={order.customerName} />
          <InfoRow
            label="Telefon"
            value={order.customerPhone}
            href={`tel:${order.customerPhone.replace(/\s/g, '')}`}
          />
        </Section>

        {displayStore ? (
          <Section title="Do‘kon" icon={<Store className="w-3.5 h-3.5" />} isDark={isDark}>
            <InfoRow label="Do‘kon nomi" value={displayStore.name} />
            {(displayStore.address || order.customerAddress) ? (
              <div className="py-2">
                <span className="text-[10px] uppercase tracking-wide opacity-45 block mb-1">Manzil</span>
                <div className="flex items-start gap-2 text-sm font-medium opacity-85 leading-snug">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  {displayStore.address || order.customerAddress}
                </div>
              </div>
            ) : null}
            {displayStore.contactName ? (
              <InfoRow label="Mas‘ul shaxs" value={displayStore.contactName} />
            ) : null}
            {store && !order.storeName ? (
              <p className="text-[10px] text-emerald-500/80 mt-1">Do‘konlar bazasidan topildi</p>
            ) : order.storeName ? (
              <p className="text-[10px] text-emerald-500/80 mt-1">QR buyurtmada tasdiqlangan</p>
            ) : null}
          </Section>
        ) : (
          <Section title="Do‘kon" icon={<Store className="w-3.5 h-3.5" />} isDark={isDark}>
            <p className="text-sm opacity-55">Do‘konlar ro‘yxatida topilmadi</p>
            {order.customerAddress ? (
              <div className="mt-2 flex items-start gap-2 text-sm opacity-75">
                <MapPin className="w-4 h-4 shrink-0" />
                {order.customerAddress}
              </div>
            ) : null}
          </Section>
        )}

        <Section title="Mahsulotlar" icon={<Package className="w-3.5 h-3.5" />} isDark={isDark}>
          <ul className="space-y-2">
            {order.items.map((it) => (
              <li
                key={`${order.id}-${it.productId}`}
                className="rounded-xl p-3"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}
              >
                <div className="font-bold text-sm mb-1">{it.productName}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs opacity-70">
                  <span>
                    Miqdor: {it.qty} {it.unit ?? 'dona'}
                  </span>
                  <span className="text-right">Narx: {formatMoney(it.unitPrice)}</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] opacity-50">Qator jami</span>
                  <span className="font-bold text-emerald-500">{formatMoney(it.lineTotal)}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/10">
            <span className="font-bold">Umumiy summa</span>
            <span className="text-lg font-black text-emerald-500">{formatMoney(order.total)}</span>
          </div>
        </Section>

        {order.note?.trim() ? (
          <Section title="Izoh" icon={<MessageSquare className="w-3.5 h-3.5" />} isDark={isDark}>
            <p className="text-sm opacity-80 leading-relaxed whitespace-pre-wrap">{order.note}</p>
          </Section>
        ) : null}

        {order.status === 'done' && order.saleIds?.length ? (
          <Section title="Sotuv" icon={<CheckCircle2 className="w-3.5 h-3.5" />} isDark={isDark}>
            <p className="text-sm text-emerald-500 font-semibold">
              {order.saleIds.length} ta sotuv tasdiqlangan
            </p>
            <p className="text-[10px] opacity-50 mt-1">
              Qarz, naqd va statistikada ko‘rinadi
            </p>
          </Section>
        ) : null}

        {order.status === 'accepted' && order.warehouseReserved ? (
          <p className="text-[10px] text-blue-400/80 px-1">
            Ombordan ayirilgan — yetkazgandan so‘ng sotuvni tasdiqlang
          </p>
        ) : null}

        <Section title="Vaqt" icon={<Calendar className="w-3.5 h-3.5" />} isDark={isDark}>
          <InfoRow
            label="Buyurtma vaqti"
            value={created.toLocaleString('uz-UZ', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          />
          <InfoRow label="Buyurtma ID" value={order.id} />
        </Section>
      </div>

      <div
        className="shrink-0 px-4 pt-3 pb-[max(12px,var(--app-safe-bottom))] border-t space-y-2 max-w-lg mx-auto w-full"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          background: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {order.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSetStatus(order, 'accepted')}
              className="flex-1 min-h-[48px] py-3 rounded-2xl text-sm font-bold bg-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Qabul qilish
            </button>
            <button
              type="button"
              onClick={() => onSetStatus(order, 'rejected')}
              className="flex-1 min-h-[48px] py-3 rounded-2xl text-sm font-bold bg-red-500/15 text-red-400 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <XCircle className="w-4 h-4" />
              Rad etish
            </button>
          </div>
        ) : order.status === 'accepted' ? (
          <button
            type="button"
            onClick={() => (onCompleteOrder ? onCompleteOrder(order) : onSetStatus(order, 'done'))}
            className="w-full min-h-[48px] py-3 rounded-2xl text-sm font-bold text-slate-900 active:scale-[0.98]"
            style={{ background: accentColor.gradient }}
          >
            Sotuvni tasdiqlash (bajarildi)
          </button>
        ) : null}
        <a
          href={`tel:${order.customerPhone.replace(/\s/g, '')}`}
          className="w-full min-h-[44px] py-2.5 rounded-2xl text-sm font-bold border flex items-center justify-center gap-2 opacity-80 active:opacity-100"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
        >
          <Phone className="w-4 h-4" />
          Qo‘ng‘iroq qilish
        </a>
      </div>
    </div>
  );
}
