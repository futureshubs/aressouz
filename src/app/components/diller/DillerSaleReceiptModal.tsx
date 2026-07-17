import { useRef } from 'react';
import { Printer, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerSale } from '../../utils/dillerData';
import {
  cancelSale,
  DILLER_PRODUCT_UNITS,
  formatMoney,
  getDillerBrandLabel,
} from '../../utils/dillerData';
import { dillerSheetScrollClass } from './dillerMobileLayout';

type Props = {
  open: boolean;
  onClose: () => void;
  sale: DillerSale | null;
  data: DillerData;
  onDataChange?: (next: DillerData) => void;
};

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

function chekNumber(saleId: string): string {
  const tail = saleId.replace(/^sale_/, '').slice(-8).toUpperCase();
  return `CHK-${tail}`;
}

export function DillerSaleReceiptModal({ open, onClose, sale, data, onDataChange }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const printRef = useRef<HTMLDivElement>(null);

  if (!open || !sale) return null;

  const store = data.stores.find((s) => s.id === sale.storeId);
  const product = data.products.find((p) => p.id === sale.productId);
  const profile = data.profile;
  const isDebt = sale.paymentType === 'qarz';
  const hasDiscount = (sale.discountAmount ?? 0) > 0;
  const dt = new Date(sale.createdAt);
  const isCancelled = Boolean(sale.cancelled);

  const handleCancelSale = () => {
    if (!onDataChange) return;
    if (isCancelled) {
      toast.error('Bu sotuv allaqachon bekor qilingan');
      return;
    }
    if (
      !window.confirm(
        'Sotuvni bekor qilasizmi? Miqdor omborga qaytariladi va qarz yopiladi.',
      )
    ) {
      return;
    }
    const result = cancelSale(data, sale.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onDataChange(result.data);
    toast.success('Sotuv bekor qilindi — ombor yangilandi');
    onClose();
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank', 'width=400,height=720');
    if (!w) {
      window.print();
      return;
    }
    w.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Chek</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 16px; max-width: 320px; margin: 0 auto; color: #111; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        .muted { color: #666; font-size: 11px; }
        .row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
        .total { font-size: 18px; font-weight: bold; margin-top: 12px; border-top: 2px dashed #ccc; padding-top: 8px; }
        hr { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
      </style></head><body>${el.innerHTML}</body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 app-safe-pad"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[min(92dvh,100%)] min-h-0 overflow-hidden flex flex-col rounded-t-3xl sm:rounded-3xl"
        style={{ background: isDark ? '#111' : '#fff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="shrink-0 flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: border }}
        >
          <h2 className="font-bold text-lg">Sotuv cheki</h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2.5 rounded-xl"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}
              aria-label="Chop etish"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={`${dillerSheetScrollClass} p-4 pb-6`}>
          <div ref={printRef}>
            <div className="text-center mb-4 pb-4 border-b border-dashed" style={{ borderColor: border }}>
              {isCancelled ? (
                <div className="mb-2 inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                  BEKOR QILINGAN
                </div>
              ) : null}
              <div className="text-xs font-bold tracking-widest opacity-60">ARESSO</div>
              <h3 className="font-bold text-base mt-1">{getDillerBrandLabel(profile.companyName)}</h3>
              {profile.phone ? <div className="text-xs opacity-60 mt-0.5">{profile.phone}</div> : null}
              <div className="mt-3 inline-block px-3 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/15 text-emerald-500">
                {chekNumber(sale.id)}
              </div>
              <div className="text-xs opacity-60 mt-2">
                {dt.toLocaleDateString('uz-UZ', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <div className="text-xs opacity-60">
                {dt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>

            <section className="mb-4">
              <div className="text-[10px] font-bold uppercase opacity-50 mb-1.5">Do‘kon</div>
              <div className="font-semibold">{store?.name ?? '—'}</div>
              {store?.address ? <div className="text-xs opacity-70 mt-0.5">{store.address}</div> : null}
              <div className="text-xs opacity-70 mt-1">
                {store?.contactName}
                {store?.phone ? ` · ${store.phone}` : ''}
              </div>
            </section>

            <section className="mb-4">
              <div className="text-[10px] font-bold uppercase opacity-50 mb-1.5">Mahsulot</div>
              <div className="font-semibold">{product?.name ?? '—'}</div>
              {product?.firmName ? <div className="text-xs opacity-70">{product.firmName}</div> : null}
              {product?.sku && product.sku !== '—' ? (
                <div className="text-[10px] font-mono opacity-50 mt-0.5">SKU: {product.sku}</div>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="opacity-50">Miqdor</span>
                  <div className="font-bold">
                    {sale.qty} {product ? unitLabel(String(product.unit)) : ''}
                  </div>
                </div>
                <div>
                  <span className="opacity-50">Birlik narxi</span>
                  <div className="font-bold">{formatMoney(sale.unitPrice)}</div>
                </div>
              </div>
            </section>

            <section
              className="rounded-xl p-3 space-y-2 text-sm mb-4"
              style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }}
            >
              <div className="flex justify-between opacity-80">
                <span>Jami (chegirmasiz)</span>
                <span>{formatMoney(sale.subtotal ?? sale.unitPrice * sale.qty)}</span>
              </div>
              {hasDiscount ? (
                <div className="flex justify-between text-amber-500">
                  <span>Chegirma ({sale.discountPercent}%)</span>
                  <span>−{formatMoney(sale.discountAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-dashed" style={{ borderColor: border }}>
                <span>TO‘LANDI</span>
                <span style={{ color: accentColor.color }}>{formatMoney(sale.total)}</span>
              </div>
            </section>

            <section className="mb-4">
              <div className="text-[10px] font-bold uppercase opacity-50 mb-1.5">To‘lov</div>
              <div
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                  isDebt ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'
                }`}
              >
                {isDebt ? 'Qarzga' : 'Naqd / to‘liq'}
              </div>
              {isDebt ? (
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="opacity-60">Oldindan</span>
                    <span className="font-semibold text-emerald-500">{formatMoney(sale.paidAmount)}</span>
                  </div>
                  {(sale.debtAmount ?? 0) > 0 ? (
                    <div className="flex justify-between">
                      <span className="opacity-60">Qarz qoldig‘i</span>
                      <span className="font-semibold text-amber-500">{formatMoney(sale.debtAmount)}</span>
                    </div>
                  ) : null}
                  {sale.debtDueDate ? (
                    <div className="opacity-70">
                      Qaytarish: {new Date(sale.debtDueDate).toLocaleDateString('uz-UZ')}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            {sale.note ? (
              <section className="mb-4">
                <div className="text-[10px] font-bold uppercase opacity-50 mb-1">Izoh</div>
                <div className="text-sm opacity-80">{sale.note}</div>
              </section>
            ) : null}

            <p className="text-center text-[10px] opacity-40 pt-2 border-t border-dashed" style={{ borderColor: border }}>
              Rahmat! · Aresso
            </p>
          </div>
        </div>

        <div className="shrink-0 p-4 border-t safe-area-pb space-y-2" style={{ borderColor: border }}>
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-3 rounded-xl font-bold text-slate-900 flex items-center justify-center gap-2"
            style={{ background: accentColor.gradient }}
          >
            <Printer className="w-5 h-5" />
            Chekni chop etish
          </button>
          {onDataChange && !isCancelled ? (
            <button
              type="button"
              onClick={handleCancelSale}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-red-400"
              style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)' }}
            >
              <Trash2 className="w-4 h-4" />
              Sotuvni bekor qilish
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
