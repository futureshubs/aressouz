import { ChevronRight, Receipt } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale } from '../../utils/dillerData';
import { formatMoney } from '../../utils/dillerData';

type Props = {
  sale: DillerSale;
  data: DillerData;
  isDark: boolean;
  onOpenChek: () => void;
};

export function DillerSaleCard({ sale, data, isDark, onOpenChek }: Props) {
  const { accentColor } = useTheme();
  const store = data.stores.find((s) => s.id === sale.storeId);
  const product = data.products.find((p) => p.id === sale.productId);
  const hasDiscount = (sale.discountAmount ?? 0) > 0;
  const isDebt = sale.paymentType === 'qarz';
  const debtOpen = (sale.debtAmount ?? 0) > 0;
  const dt = new Date(sale.createdAt);

  const payBadge = isDebt
    ? debtOpen
      ? { label: 'Qarz', cls: 'bg-amber-500/20 text-amber-500' }
      : { label: 'Qarz yopildi', cls: 'bg-blue-500/20 text-blue-400' }
    : { label: 'Naqd', cls: 'bg-emerald-500/20 text-emerald-500' };

  return (
    <button
      type="button"
      onClick={onOpenChek}
      className="w-full text-left rounded-2xl border overflow-hidden transition-all active:scale-[0.99] group"
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      <div
        className="h-1"
        style={{
          background: isDebt
            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
            : accentColor.gradient,
        }}
      />
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}
          >
            <Receipt className="w-5 h-5 opacity-70" style={{ color: accentColor.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payBadge.cls}`}>
                {payBadge.label}
              </span>
              {hasDiscount ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400">
                  −{formatMoney(sale.discountAmount)}
                </span>
              ) : null}
            </div>
            <div className="font-bold text-sm mt-1.5 truncate">{store?.name ?? 'Do‘kon'}</div>
            <div className="text-xs opacity-70 truncate mt-0.5">
              {product?.name} · {sale.qty} dona
            </div>
          </div>
          <div className="shrink-0 text-right flex flex-col items-end gap-1">
            <div className="font-black text-base" style={{ color: accentColor.color }}>
              {formatMoney(sale.total)}
            </div>
            <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-60" />
          </div>
        </div>

        <div
          className="mt-3 pt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] border-t"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
        >
          <div className="opacity-50">Sana</div>
          <div className="text-right font-medium opacity-80">
            {dt.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div className="opacity-50">Vaqt</div>
          <div className="text-right font-medium opacity-80">
            {dt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {isDebt && debtOpen ? (
            <>
              <div className="opacity-50">Qarz</div>
              <div className="text-right font-bold text-amber-500">{formatMoney(sale.debtAmount)}</div>
            </>
          ) : null}
        </div>

        <div className="mt-2 text-[10px] opacity-40 text-center">Chekni ko‘rish · bosing</div>
      </div>
    </button>
  );
}
