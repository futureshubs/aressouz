import { useMemo, useState, type ReactNode } from 'react';
import {
  Calendar,
  ExternalLink,
  MapPin,
  Phone,
  Receipt,
  Store,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale, DillerStore } from '../../utils/dillerData';
import { formatMoney, formatStoreCoords } from '../../utils/dillerData';
import {
  formatDillerDate,
  formatDillerDateTime,
  getStoreMapLinks,
  getStoreSales,
  getStoreStats,
  getStoreTelHref,
} from '../../utils/dillerStoreStats';
import { openExternalUrlSync } from '../../utils/openExternalUrl';
import { DillerSaleCard } from './DillerSaleCard';
import { DillerSaleReceiptModal } from './DillerSaleReceiptModal';

type Props = {
  open: boolean;
  store: DillerStore | null;
  data: DillerData;
  onClose: () => void;
  onDelete: (storeId: string) => void;
};

export function DillerStoreDetailSheet({ open, store, data, onClose, onDelete }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [receiptSale, setReceiptSale] = useState<DillerSale | null>(null);

  const stats = useMemo(
    () => (store ? getStoreStats(data, store.id) : null),
    [data, store],
  );
  const sales = useMemo(
    () => (store ? getStoreSales(data, store.id) : []),
    [data, store],
  );
  const mapLinks = useMemo(() => (store ? getStoreMapLinks(store) : null), [store]);

  if (!open || !store) return null;

  const coords = formatStoreCoords(store);
  const telHref = getStoreTelHref(store);

  const handleDelete = () => {
    if (!window.confirm(`«${store.name}» do‘konini o‘chirasizmi? Bog‘liq sotuvlar ham yo‘qoladi.`)) return;
    onDelete(store.id);
    onClose();
  };

  const openMap = (url: string) => {
    openExternalUrlSync(url);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[115] flex flex-col app-safe-pad"
        style={{ background: isDark ? '#0a0a0a' : '#f1f5f9' }}
      >
        <header
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
        >
          <div
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: accentColor.gradient, color: '#0f172a' }}
          >
            <Store className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: isDark ? '#fff' : '#111' }}>
              {store.name}
            </h2>
            <p className="text-xs opacity-60 truncate">{store.address || 'Manzil kiritilmagan'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl shrink-0"
            style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            aria-label="Yopish"
          >
            <X className="w-5 h-5" style={{ color: isDark ? '#fff' : '#333' }} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 space-y-4 max-w-lg mx-auto w-full">
          <div className="grid grid-cols-2 gap-2">
            <StatBox
              isDark={isDark}
              label="Jami sotuv"
              value={String(stats?.saleCount ?? 0)}
              sub="marta berilgan"
              accent={accentColor.color}
            />
            <StatBox
              isDark={isDark}
              label="Jami summa"
              value={formatMoney(stats?.totalRevenue ?? 0)}
              sub="chegirmadan keyin"
            />
            <StatBox
              isDark={isDark}
              label="Olingan"
              value={formatMoney(stats?.totalPaid ?? 0)}
              sub="naqd + qisman"
            />
            <StatBox
              isDark={isDark}
              label="Ochiq qarz"
              value={formatMoney(stats?.openDebt ?? 0)}
              sub={(stats?.openDebt ?? 0) > 0 ? 'to‘lanmagan' : 'yo‘q'}
              warn={(stats?.openDebt ?? 0) > 0}
            />
          </div>

          <Section isDark={isDark} title="Ma’lumotlar">
            <InfoRow
              isDark={isDark}
              icon={<Calendar className="w-4 h-4" />}
              label="Do‘kon qo‘shilgan"
              value={formatDillerDate(store.createdAt)}
            />
            <InfoRow
              isDark={isDark}
              icon={<Receipt className="w-4 h-4" />}
              label="Birinchi sotuv"
              value={formatDillerDateTime(stats?.firstSaleAt)}
            />
            <InfoRow
              isDark={isDark}
              icon={<Receipt className="w-4 h-4" />}
              label="Oxirgi sotuv"
              value={formatDillerDateTime(stats?.lastSaleAt)}
            />
            <InfoRow
              isDark={isDark}
              icon={<User className="w-4 h-4" />}
              label="Mas‘ul"
              value={store.contactName || '—'}
            />
            {store.address ? (
              <InfoRow
                isDark={isDark}
                icon={<MapPin className="w-4 h-4" />}
                label="Manzil"
                value={store.address}
              />
            ) : null}
            {coords ? (
              <InfoRow
                isDark={isDark}
                icon={<MapPin className="w-4 h-4" />}
                label="Koordinata"
                value={coords}
                mono
              />
            ) : null}
            <div className="pt-2">
              <a
                href={telHref}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-slate-900"
                style={{ background: accentColor.gradient }}
              >
                <Phone className="w-5 h-5" />
                {store.phone}
              </a>
            </div>
          </Section>

          {mapLinks ? (
            <Section isDark={isDark} title="Xarita">
              <p className="text-xs opacity-60 mb-2">Tashqi ilovada ochiladi</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openMap(mapLinks.google)}
                  className="py-3 px-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
                >
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                  Google Maps
                </button>
                <button
                  type="button"
                  onClick={() => openMap(mapLinks.yandex)}
                  className="py-3 px-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
                >
                  <ExternalLink className="w-4 h-4 text-red-500" />
                  Yandex Xarita
                </button>
              </div>
            </Section>
          ) : (
            <div
              className="rounded-xl p-3 text-xs opacity-60 text-center"
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}
            >
              Xarita uchun manzil yoki GPS koordinata qo‘shing
            </div>
          )}

          {stats && stats.products.length > 0 ? (
            <Section isDark={isDark} title="Berilgan mahsulotlar (jami)">
              <ul className="space-y-2">
                {stats.products.map((row) => (
                  <li
                    key={row.productId}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl text-sm"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{row.productName}</div>
                      <div className="text-[10px] opacity-60">
                        {row.saleCount} sotuv · {row.qty} dona/jami
                      </div>
                    </div>
                    <div className="font-bold shrink-0" style={{ color: accentColor.color }}>
                      {formatMoney(row.total)}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section isDark={isDark} title={`Sotuvlar tarixi (${sales.length})`}>
            {sales.length === 0 ? (
              <p className="text-sm opacity-60 text-center py-6">Hali bu do‘konga sotuv yo‘q</p>
            ) : (
              <ul className="space-y-3">
                {sales.map((sale) => (
                  <li key={sale.id}>
                    <DillerSaleCard
                      sale={sale}
                      data={data}
                      isDark={isDark}
                      onOpenChek={() => setReceiptSale(sale)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-3 rounded-xl border border-red-500/40 text-red-400 font-bold flex items-center justify-center gap-2 mb-6"
          >
            <Trash2 className="w-4 h-4" />
            Do‘konni o‘chirish
          </button>
        </div>
      </div>

      <DillerSaleReceiptModal
        open={receiptSale != null}
        onClose={() => setReceiptSale(null)}
        sale={receiptSale}
        data={data}
      />
    </>
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
    <div
      className="rounded-xl p-3"
      style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}
    >
      <div className="text-[10px] opacity-60">{label}</div>
      <div
        className={`text-sm font-black mt-0.5 truncate ${warn ? 'text-amber-500' : ''}`}
        style={accent && !warn ? { color: accent } : undefined}
      >
        {value}
      </div>
      <div className="text-[10px] opacity-45 mt-0.5">{sub}</div>
    </div>
  );
}

function Section({
  isDark,
  title,
  children,
}: {
  isDark: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      <h3 className="font-bold text-sm mb-3">{title}</h3>
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
    <div
      className="flex gap-3 py-2 border-b last:border-0"
      style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
    >
      <div className="opacity-50 shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] opacity-50">{label}</div>
        <div className={`text-sm font-medium ${mono ? 'font-mono text-xs text-emerald-500/90' : ''}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
