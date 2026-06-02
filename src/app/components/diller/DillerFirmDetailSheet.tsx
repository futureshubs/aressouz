import { useMemo, useState, type ReactNode } from 'react';
import {
  Building2,
  Calendar,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  Receipt,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerFirm, DillerSale } from '../../utils/dillerData';
import {
  DILLER_PRODUCT_UNITS,
  formatMoney,
  getWarehouseQty,
} from '../../utils/dillerData';
import {
  formatDillerDate,
  formatDillerDateTime,
  getFirmMapUrl,
  getFirmSales,
  getFirmStats,
  getFirmTelHref,
} from '../../utils/dillerFirmStats';
import { openExternalUrlSync } from '../../utils/openExternalUrl';
import { DillerSaleCard } from './DillerSaleCard';
import { DillerSaleReceiptModal } from './DillerSaleReceiptModal';

type Props = {
  open: boolean;
  firm: DillerFirm | null;
  data: DillerData;
  onClose: () => void;
  onDelete: (firmId: string) => void;
};

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

export function DillerFirmDetailSheet({ open, firm, data, onClose, onDelete }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [receiptSale, setReceiptSale] = useState<DillerSale | null>(null);

  const stats = useMemo(() => (firm ? getFirmStats(data, firm.id) : null), [data, firm]);
  const sales = useMemo(() => (firm ? getFirmSales(data, firm) : []), [data, firm]);
  const mapUrl = useMemo(() => (firm ? getFirmMapUrl(firm) : null), [firm]);

  if (!open || !firm) return null;

  const telHref = getFirmTelHref(firm);

  const handleDelete = () => {
    if (
      !window.confirm(
        `«${firm.name}» firmasini o‘chirasizmi? Bog‘liq mahsulotlar va ularning sotuvlari ham yo‘qoladi.`,
      )
    ) {
      return;
    }
    onDelete(firm.id);
    onClose();
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
            <Building2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: isDark ? '#fff' : '#111' }}>
              {firm.name}
            </h2>
            <p className="text-xs opacity-60 truncate">{firm.productName}</p>
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
            <StatBox isDark={isDark} label="Mahsulotlar" value={String(stats?.productCount ?? 0)} sub="ro‘yxatda" accent={accentColor.color} />
            <StatBox isDark={isDark} label="Omborda" value={String(stats?.warehouseQty ?? 0)} sub="jami qoldiq" />
            <StatBox isDark={isDark} label="Sotuvlar" value={String(stats?.saleCount ?? 0)} sub="do‘konlarga" />
            <StatBox
              isDark={isDark}
              label="Aylanma"
              value={formatMoney(stats?.totalRevenue ?? 0)}
              sub="jami summa"
            />
          </div>

          <Section isDark={isDark} title="Firma ma’lumotlari">
            <InfoRow isDark={isDark} icon={<User className="w-4 h-4" />} label="Ega / mas‘ul" value={firm.ownerName} />
            <InfoRow
              isDark={isDark}
              icon={<Package className="w-4 h-4" />}
              label="Beradigan mahsulot (asosiy)"
              value={firm.productName}
            />
            <InfoRow isDark={isDark} icon={<MapPin className="w-4 h-4" />} label="Manzil" value={firm.address} />
            <InfoRow
              isDark={isDark}
              icon={<Calendar className="w-4 h-4" />}
              label="Qo‘shilgan"
              value={formatDillerDate(firm.createdAt)}
            />
            <InfoRow
              isDark={isDark}
              icon={<Receipt className="w-4 h-4" />}
              label="Oxirgi sotuv"
              value={formatDillerDateTime(stats?.lastSaleAt)}
            />
            <div className="pt-2 space-y-2">
              <a
                href={telHref}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-slate-900"
                style={{ background: accentColor.gradient }}
              >
                <Phone className="w-5 h-5" />
                {firm.phone}
              </a>
              {mapUrl ? (
                <button
                  type="button"
                  onClick={() => openExternalUrlSync(mapUrl)}
                  className="w-full py-2.5 rounded-xl border font-bold text-sm flex items-center justify-center gap-2"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
                >
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                  Manzilni xaritada ochish
                </button>
              ) : null}
            </div>
          </Section>

          <Section isDark={isDark} title={`Mahsulotlar katalogi (${stats?.products.length ?? 0})`}>
            {!stats || stats.products.length === 0 ? (
              <p className="text-sm opacity-60 text-center py-4">
                «Mahsulot» tabida ushbu firma uchun mahsulot qo‘shing
              </p>
            ) : (
              <ul className="space-y-2">
                {stats.products.map((row) => {
                  const p = row.product;
                  const margin = p.unitPrice - (p.buyPrice ?? 0);
                  const qty = getWarehouseQty(data, p.id);
                  return (
                    <li
                      key={p.id}
                      className="p-3 rounded-xl"
                      style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}
                    >
                      <div className="font-semibold text-sm">{p.name}</div>
                      {p.sku && p.sku !== '—' ? (
                        <div className="text-[10px] font-mono opacity-45">{p.sku}</div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                        <div>
                          <span className="opacity-50">Olish</span>
                          <div className="font-semibold">{formatMoney(p.buyPrice ?? 0)}</div>
                        </div>
                        <div className="text-right">
                          <span className="opacity-50">Sotuv</span>
                          <div className="font-semibold text-emerald-500/90">{formatMoney(p.unitPrice)}</div>
                        </div>
                        <div>
                          <span className="opacity-50">Foyda / dona</span>
                          <div className={`font-semibold ${margin >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {formatMoney(margin)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="opacity-50">Ombor</span>
                          <div className="font-bold" style={{ color: accentColor.color }}>
                            {qty} {unitLabel(String(p.unit))}
                          </div>
                        </div>
                      </div>
                      {row.saleCount > 0 ? (
                        <div className="text-[10px] opacity-55 mt-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                          Sotilgan: {row.soldQty} · {row.saleCount} marta · {formatMoney(row.revenue)}
                        </div>
                      ) : (
                        <div className="text-[10px] opacity-40 mt-2">Hali sotilmagan</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section isDark={isDark} title={`Sotuvlar tarixi (${sales.length})`}>
            {sales.length === 0 ? (
              <p className="text-sm opacity-60 text-center py-4">Bu firma mahsulotlari hali sotilmagan</p>
            ) : (
              <ul className="space-y-3">
                {sales.slice(0, 30).map((sale) => (
                  <li key={sale.id}>
                    <DillerSaleCard
                      sale={sale}
                      data={data}
                      isDark={isDark}
                      onOpenChek={() => setReceiptSale(sale)}
                    />
                  </li>
                ))}
                {sales.length > 30 ? (
                  <p className="text-center text-xs opacity-50">+ yana {sales.length - 30} ta sotuv</p>
                ) : null}
              </ul>
            )}
          </Section>

          <button
            type="button"
            onClick={handleDelete}
            className="w-full py-3 rounded-xl border border-red-500/40 text-red-400 font-bold flex items-center justify-center gap-2 mb-6"
          >
            <Trash2 className="w-4 h-4" />
            Firmni o‘chirish
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
}: {
  isDark: boolean;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="text-[10px] opacity-60">{label}</div>
      <div className="text-sm font-black mt-0.5 truncate" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="text-[10px] opacity-45 mt-0.5">{sub}</div>
    </div>
  );
}

function Section({ isDark, title, children }: { isDark: boolean; title: string; children: ReactNode }) {
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
}: {
  isDark: boolean;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex gap-3 py-2 border-b last:border-0"
      style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
    >
      <div className="opacity-50 shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] opacity-50">{label}</div>
        <div className="text-sm font-medium">{value || '—'}</div>
      </div>
    </div>
  );
}
