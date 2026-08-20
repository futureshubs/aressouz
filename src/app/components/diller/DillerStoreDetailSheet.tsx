import { useMemo, useState, type ReactNode } from 'react';
import {
  Calendar,
  ClipboardList,
  ExternalLink,
  MapPin,
  Pencil,
  Phone,
  QrCode,
  Receipt,
  ShoppingCart,
  Store,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale, DillerStore } from '../../utils/dillerData';
import {
  formatMoney,
  formatStoreCoords,
  getStoreOrderRows,
  getStoreOrdersSummary,
  type StoreOrderRow,
} from '../../utils/dillerData';
import {
  formatDillerDate,
  formatDillerDateTime,
  getStoreMapLinks,
  getStoreSales,
  getStoreStats,
  getStoreTelHref,
} from '../../utils/dillerStoreStats';
import { openExternalUrlSync } from '../../utils/openExternalUrl';
import { resolveDillerImage } from '../../utils/dillerMedia';
import { DillerSaleCard } from './DillerSaleCard';
import { DillerSaleReceiptModal } from './DillerSaleReceiptModal';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';
import { iosAccentFillStyle, iosGlassBarStyle, iosGlassCardStyle, iosGlassPageStyle } from './dillerIosGlass';

type Props = {
  open: boolean;
  store: DillerStore | null;
  data: DillerData;
  onClose: () => void;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onStartSale: () => void;
  onStartOrder: () => void;
};

export function DillerStoreDetailSheet({
  open,
  store,
  data,
  onClose,
  onEdit,
  onDeleteRequest,
  onStartSale,
  onStartOrder,
}: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [receiptSale, setReceiptSale] = useState<DillerSale | null>(null);

  const stats = useMemo(() => (store ? getStoreStats(data, store.id) : null), [data, store]);
  const sales = useMemo(() => (store ? getStoreSales(data, store.id) : []), [data, store]);
  const orderRows = useMemo(() => (store ? getStoreOrderRows(data, store.id) : []), [data, store]);
  const orderSummary = useMemo(
    () => (store ? getStoreOrdersSummary(data, store.id) : null),
    [data, store],
  );
  const mapLinks = useMemo(() => (store ? getStoreMapLinks(store) : null), [store]);

  if (!open || !store) return null;

  const coords = formatStoreCoords(store);
  const telHref = getStoreTelHref(store);
  const hasPhone = Boolean(store.phone?.trim());
  const storeImg = resolveDillerImage(store.imageUrl);

  return (
    <>
      <div
        className={`${dillerSheetShellClass} animate-in fade-in slide-in-from-right-8 duration-300`}
        style={{ ...iosGlassPageStyle(isDark), zIndex: 115 }}
      >
        <header className="shrink-0 px-4 pt-2 pb-3" style={{ ...iosGlassBarStyle(isDark), borderTop: 'none' }}>
          <div className="flex justify-center pb-2">
            <span className="w-10 h-1 rounded-full bg-white/25" />
          </div>
          <div className="flex items-center gap-3">
            <div
              className="shrink-0 w-12 h-12 rounded-[16px] overflow-hidden flex items-center justify-center"
              style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
            >
              {storeImg ? <img src={storeImg} alt="" className="w-full h-full object-cover" /> : <Store className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] font-black truncate tracking-tight">{store.name}</h2>
              <p className="text-[11px] opacity-55 truncate">{store.address || 'Manzil kiritilmagan'}</p>
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center active:scale-95"
              style={iosGlassCardStyle(isDark)}
              aria-label="Tahrirlash"
            >
              <Pencil className="w-4 h-4" style={{ color: accentColor.color }} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center active:scale-95"
              style={iosGlassCardStyle(isDark)}
              aria-label="Yopish"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-3 max-w-lg mx-auto w-full`}>
          {(stats?.openDebt ?? 0) > 0 ? (
            <div
              className="rounded-[22px] px-4 py-3.5 flex items-center justify-between"
              style={{
                background: isDark ? 'rgba(245,158,11,0.16)' : 'rgba(245,158,11,0.12)',
                border: '0.5px solid rgba(245,158,11,0.28)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
            >
              <div>
                <div className="text-[11px] font-semibold text-amber-500/80">Qolgan qarz</div>
                <div className="text-[22px] font-black text-amber-400 tabular-nums leading-tight">
                  {formatMoney(stats?.openDebt ?? 0)}
                </div>
              </div>
              <Wallet className="w-8 h-8 text-amber-400/70" />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <StatBox isDark={isDark} label="Jami sotuv" value={String(stats?.saleCount ?? 0)} sub="marta berilgan" accent={accentColor.color} />
            <StatBox isDark={isDark} label="Jami summa" value={formatMoney(stats?.totalRevenue ?? 0)} sub="chegirmadan keyin" />
            <StatBox isDark={isDark} label="Olingan" value={formatMoney(stats?.totalPaid ?? 0)} sub="naqd + qisman" />
            <StatBox
              isDark={isDark}
              label="Buyurtmalar"
              value={String(orderSummary?.total ?? 0)}
              sub={(orderSummary?.openCount ?? 0) > 0 ? `${orderSummary?.openCount} ochiq` : 'barchasi yopilgan'}
              accent={accentColor.color}
            />
          </div>

          <Section isDark={isDark} title="Ma’lumotlar">
            <InfoRow isDark={isDark} icon={<Calendar className="w-4 h-4" />} label="Do‘kon qo‘shilgan" value={formatDillerDate(store.createdAt)} />
            <InfoRow isDark={isDark} icon={<Receipt className="w-4 h-4" />} label="Birinchi sotuv" value={formatDillerDateTime(stats?.firstSaleAt)} />
            <InfoRow isDark={isDark} icon={<Receipt className="w-4 h-4" />} label="Oxirgi sotuv" value={formatDillerDateTime(stats?.lastSaleAt)} />
            <InfoRow isDark={isDark} icon={<User className="w-4 h-4" />} label="Mas‘ul" value={store.contactName || '—'} />
            {store.address ? (
              <InfoRow isDark={isDark} icon={<MapPin className="w-4 h-4" />} label="Manzil" value={store.address} />
            ) : null}
            {coords ? (
              <InfoRow isDark={isDark} icon={<MapPin className="w-4 h-4" />} label="Koordinata" value={coords} mono />
            ) : null}
            {hasPhone ? (
              <InfoRow isDark={isDark} icon={<Phone className="w-4 h-4" />} label="Telefon" value={store.phone} />
            ) : null}
          </Section>

          {mapLinks ? (
            <Section isDark={isDark} title="Xarita">
              <p className="text-xs opacity-55 mb-2.5">Tashqi ilovada ochiladi</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openExternalUrlSync(mapLinks.google)}
                  className="py-3 px-3 rounded-[16px] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97]"
                  style={iosGlassCardStyle(isDark)}
                >
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => openExternalUrlSync(mapLinks.yandex)}
                  className="py-3 px-3 rounded-[16px] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97]"
                  style={iosGlassCardStyle(isDark)}
                >
                  <ExternalLink className="w-4 h-4 text-red-400" />
                  Yandex
                </button>
              </div>
            </Section>
          ) : (
            <div className="rounded-[22px] p-3.5 text-xs opacity-60 text-center" style={iosGlassCardStyle(isDark)}>
              Xarita uchun manzil yoki GPS koordinata qo‘shing
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 px-1 mb-2">
              <h3 className="text-[12px] font-bold uppercase tracking-wide opacity-45">
                Buyurtmalar ({orderSummary?.total ?? 0})
              </h3>
              {(orderSummary?.openCount ?? 0) > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/18 text-amber-400">
                  {orderSummary?.openCount} ochiq
                </span>
              ) : null}
            </div>
            {orderRows.length === 0 ? (
              <div className="rounded-[22px] py-7 text-center" style={iosGlassCardStyle(isDark)}>
                <p className="text-sm opacity-55">Bu do‘konga buyurtma yo‘q</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {orderRows.map((row) => (
                  <StoreOrderCard
                    key={`${row.kind}-${row.order.id}`}
                    row={row}
                    isDark={isDark}
                    accentColor={accentColor.color}
                  />
                ))}
              </ul>
            )}
          </div>

          {stats && stats.products.length > 0 ? (
            <div>
              <h3 className="px-1 mb-2 text-[12px] font-bold uppercase tracking-wide opacity-45">
                Berilgan mahsulotlar
              </h3>
              <ul className="space-y-2">
                {stats.products.map((row) => (
                  <li
                    key={row.productId}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-[18px] text-sm"
                    style={iosGlassCardStyle(isDark)}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{row.productName}</div>
                      <div className="text-[10px] opacity-55">
                        {row.saleCount} sotuv · {row.qty} dona
                      </div>
                    </div>
                    <div className="font-black shrink-0 tabular-nums" style={{ color: accentColor.color }}>
                      {formatMoney(row.total)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="px-1 mb-2 text-[12px] font-bold uppercase tracking-wide opacity-45">
              Sotuvlar tarixi ({sales.length})
            </h3>
            {sales.length === 0 ? (
              <div className="rounded-[22px] py-8 text-center" style={iosGlassCardStyle(isDark)}>
                <p className="text-sm opacity-55">Hali bu do‘konga sotuv yo‘q</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {sales.map((sale) => (
                  <li key={sale.id}>
                    <DillerSaleCard sale={sale} data={data} isDark={isDark} onOpenChek={() => setReceiptSale(sale)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              type="button"
              onClick={onEdit}
              className="py-3 rounded-[16px] font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{ ...iosGlassCardStyle(isDark), color: accentColor.color }}
            >
              <Pencil className="w-4 h-4" />
              Tahrirlash
            </button>
            <button
              type="button"
              onClick={onDeleteRequest}
              className="py-3 rounded-[16px] font-bold flex items-center justify-center gap-2 text-red-400 active:scale-[0.98]"
              style={{
                background: isDark ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.08)',
                border: '0.5px solid rgba(239,68,68,0.28)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <Trash2 className="w-4 h-4" />
              O‘chirish
            </button>
          </div>
        </div>

        <div
          className={`shrink-0 px-4 py-3 max-w-lg mx-auto w-full grid ${hasPhone ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}
          style={{ ...iosGlassBarStyle(isDark), borderBottom: 'none' }}
        >
          <button
            type="button"
            onClick={onStartSale}
            className="rounded-[18px] py-3.5 px-2 font-bold text-white flex flex-col items-center justify-center gap-1 active:scale-[0.97]"
            style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="text-[11px]">Sotuv</span>
          </button>
          <button
            type="button"
            onClick={onStartOrder}
            className="rounded-[18px] py-3.5 px-2 font-bold flex flex-col items-center justify-center gap-1 active:scale-[0.97]"
            style={{ ...iosGlassCardStyle(isDark), color: accentColor.color }}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-[11px]">Buyurtma</span>
          </button>
          {hasPhone ? (
            <a
              href={telHref}
              className="rounded-[18px] py-3.5 px-2 font-bold flex flex-col items-center justify-center gap-1 active:scale-[0.97]"
              style={{ ...iosGlassCardStyle(isDark), color: accentColor.color }}
            >
              <Phone className="w-5 h-5" />
              <span className="text-[11px]">Qo‘ng‘iroq</span>
            </a>
          ) : null}
        </div>
      </div>

      <DillerSaleReceiptModal open={receiptSale != null} onClose={() => setReceiptSale(null)} sale={receiptSale} data={data} />
    </>
  );
}

function StoreOrderCard({
  row,
  isDark,
  accentColor,
}: {
  row: StoreOrderRow;
  isDark: boolean;
  accentColor: string;
}) {
  const isQr = row.kind === 'qr';
  const order = row.order;
  const preview = order.items
    .slice(0, 2)
    .map((it) => `${it.productName} ×${it.qty}`)
    .join(', ');
  const status = isQr
    ? order.status === 'pending'
      ? { label: 'Yangi QR', color: '#f59e0b' }
      : order.status === 'accepted'
        ? { label: 'Qabul qilindi', color: '#8b5cf6' }
        : order.status === 'done'
          ? { label: 'Bajarildi', color: '#10b981' }
          : { label: 'Rad etildi', color: '#ef4444' }
    : order.status === 'open'
      ? { label: 'Ochiq', color: '#f59e0b' }
      : order.status === 'done'
        ? { label: 'Topshirildi', color: '#10b981' }
        : { label: 'Bekor', color: '#ef4444' };

  return (
    <li className="rounded-[18px] px-3.5 py-3" style={iosGlassCardStyle(isDark)}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isQr ? (
              <QrCode className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            ) : (
              <ClipboardList className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
            )}
            <span className="text-[11px] font-bold opacity-70">{isQr ? 'QR buyurtma' : 'Do‘kon buyurtmasi'}</span>
          </div>
          <div className="text-[11px] opacity-50 mt-1 truncate">
            {preview}
            {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
          </div>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
          style={{ background: `${status.color}22`, color: status.color }}
        >
          {status.label}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="opacity-45">{formatDillerDateTime(order.createdAt)}</span>
        <span className="font-black text-emerald-500">{formatMoney(order.total)}</span>
      </div>
    </li>
  );
}

function StatBox({
  isDark,
  label,
  value,
  sub,
  accent,
  warn,
}: {
  isDark: boolean;
  label: string;
  value: string;
  sub: string;
  accent?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-[18px] p-3" style={iosGlassCardStyle(isDark)}>
      <div className="text-[10px] opacity-60">{label}</div>
      <div className={`text-sm font-black mt-0.5 truncate ${warn ? 'text-amber-500' : ''}`} style={accent && !warn ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="text-[10px] opacity-45 mt-0.5">{sub}</div>
    </div>
  );
}

function Section({ isDark, title, children }: { isDark: boolean; title: string; children: ReactNode }) {
  return (
    <div className="rounded-[22px] p-4" style={iosGlassCardStyle(isDark)}>
      <h3 className="font-bold text-sm mb-3 tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({
  isDark,
  icon,
  label,
  value,
  mono,
}: {
  isDark: boolean;
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3 py-2 border-b last:border-0" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
      <div className="opacity-50 shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] opacity-50">{label}</div>
        <div className={`text-sm font-medium ${mono ? 'font-mono text-xs text-emerald-500/90' : ''}`}>{value}</div>
      </div>
    </div>
  );
}
