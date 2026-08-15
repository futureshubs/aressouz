import { Banknote, ChevronRight, Clock3, CreditCard, Receipt, Store, Wallet } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale } from '../../utils/dillerData';
import { formatMoney } from '../../utils/dillerData';
import { iosGlassCardStyle } from './dillerIosGlass';

type Props = {
  sale: DillerSale;
  data: DillerData;
  isDark: boolean;
  onOpenChek: () => void;
};

function formatSaleWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  const date = d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
  return `${date} · ${time}`;
}

export function DillerSaleCard({ sale, data, isDark, onOpenChek }: Props) {
  const { accentColor } = useTheme();
  const store = data.stores.find((s) => s.id === sale.storeId);
  const product = data.products.find((p) => p.id === sale.productId);
  const hasDiscount = (sale.discountAmount ?? 0) > 0;
  const isDebt = sale.paymentType === 'qarz';
  const debtOpen = (sale.debtAmount ?? 0) > 0;
  const cost = (product?.buyPrice ?? 0) * sale.qty;
  const profit = sale.total - cost;

  const pay = isDebt
    ? debtOpen
      ? { label: 'Qarz', color: '#f59e0b', Icon: Wallet }
      : { label: 'Yopildi', color: '#60a5fa', Icon: Wallet }
    : sale.paymentType === 'karta'
      ? { label: 'Karta', color: '#818cf8', Icon: CreditCard }
      : { label: 'Naqd', color: '#34d399', Icon: Banknote };

  return (
    <button
      type="button"
      onClick={onOpenChek}
      className="w-full text-left rounded-[22px] overflow-hidden active:scale-[0.985] transition-transform touch-manipulation"
      style={iosGlassCardStyle(isDark)}
    >
      <div className="flex items-stretch">
        <div
          className="w-[3px] shrink-0"
          style={{
            background: isDebt
              ? 'linear-gradient(180deg, #fbbf24, #d97706)'
              : sale.paymentType === 'karta'
                ? 'linear-gradient(180deg, #818cf8, #6366f1)'
                : accentColor.gradient,
          }}
        />
        <div className="flex-1 min-w-0 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-[42px] h-[42px] rounded-[14px] flex items-center justify-center"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
                boxShadow: isDark
                  ? 'inset 0 0.5px 0 rgba(255,255,255,0.14)'
                  : 'inset 0 0.5px 0 rgba(255,255,255,0.95)',
              }}
            >
              <Receipt className="w-[18px] h-[18px]" style={{ color: pay.color }} strokeWidth={2.2} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Store className="w-3 h-3 opacity-40 shrink-0" />
                    <div className="font-semibold text-[15px] leading-tight truncate tracking-tight">
                      {store?.name ?? 'Do‘kon'}
                    </div>
                  </div>
                  <div className="text-[12px] opacity-60 truncate mt-0.5">
                    {product?.name ?? 'Mahsulot'}
                    <span className="opacity-40"> · </span>
                    {sale.qty} {product?.unit ?? 'dona'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[16px] font-bold tabular-nums leading-none tracking-tight">
                    {formatMoney(sale.total)}
                  </div>
                  {profit > 0 ? (
                    <div className="text-[10px] font-semibold text-emerald-400 mt-1 tabular-nums">
                      +{formatMoney(profit)}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full"
                    style={{
                      background: `${pay.color}22`,
                      color: pay.color,
                    }}
                  >
                    <pay.Icon className="w-3 h-3" />
                    {pay.label}
                  </span>
                  {hasDiscount ? (
                    <span className="text-[10px] font-semibold px-2 py-[3px] rounded-full bg-rose-500/15 text-rose-400">
                      Chegirma {formatMoney(sale.discountAmount)}
                    </span>
                  ) : null}
                  {sale.shopOrderId ? (
                    <span className="text-[10px] font-bold px-2 py-[3px] rounded-full bg-sky-500/15 text-sky-400">
                      QR
                    </span>
                  ) : null}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] opacity-45 shrink-0">
                  <Clock3 className="w-3 h-3" />
                  {formatSaleWhen(sale.createdAt)}
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </span>
              </div>

              {isDebt && debtOpen ? (
                <div
                  className="mt-2 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold flex items-center justify-between"
                  style={{
                    background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
                    color: '#f59e0b',
                  }}
                >
                  <span>Qarz qoldig‘i</span>
                  <span className="tabular-nums">{formatMoney(sale.debtAmount)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
