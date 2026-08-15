import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Barcode, ScanLine, Trash2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerProduct, DillerProductUnit } from '../../utils/dillerData';
import {
  createProduct,
  deleteProduct,
  DILLER_PRODUCT_UNITS,
  findProductBySku,
  formatMoney,
  getWarehouseQty,
  updateProduct,
} from '../../utils/dillerData';
import { DillerSkuScanner } from './DillerSkuScanner';
import { DillerLocalImageField } from './DillerLocalImageField';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassCardStyle,
  iosGlassInputStyle,
  iosGlassPageSurface,
} from './dillerIosGlass';

type Props = {
  open: boolean;
  data: DillerData;
  onClose: () => void;
  onSave: (next: DillerData) => void;
  initialSku?: string;
  product?: DillerProduct | null;
};

const inputCls = (isDark: boolean) =>
  `w-full min-w-0 px-3.5 py-3 rounded-[16px] text-sm outline-none ${
    isDark ? 'text-white placeholder:text-white/35' : 'text-gray-900 placeholder:text-gray-400'
  }`;

export function DillerProductAddSheet({
  open,
  data,
  onClose,
  onSave,
  initialSku = '',
  product = null,
}: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isEdit = product != null;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [unit, setUnit] = useState<DillerProductUnit>('dona');
  const [stock, setStock] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setSku(product.sku === '—' ? '' : product.sku);
      setSellPrice(String(product.unitPrice || ''));
      setBuyPrice(product.buyPrice ? String(product.buyPrice) : '');
      setUnit((product.unit as DillerProductUnit) || 'dona');
      setStock(String(getWarehouseQty(data, product.id)));
      setImageUrl(product.imageUrl ?? '');
      return;
    }
    setName('');
    setSku(initialSku.trim());
    setSellPrice('');
    setBuyPrice('');
    setUnit('dona');
    setStock('');
    setImageUrl('');
  }, [open, initialSku, product, data]);

  if (!open) return null;

  const sell = Number(sellPrice);
  const buy = Number(buyPrice) || 0;
  const margin = sell > 0 && buy >= 0 ? sell - buy : 0;

  const onSkuScanned = (code: string) => {
    const trimmed = code.trim();
    setSku(trimmed);
    const existing = findProductBySku(data, trimmed);
    if (existing && existing.id !== product?.id) {
      toast.info(`SKU topildi: ${existing.name}`);
    } else {
      toast.success('Kod yozildi');
    }
  };

  const save = () => {
    if (!name.trim()) {
      toast.error('Mahsulot nomi kerak');
      return;
    }
    if (!sell || sell < 0) {
      toast.error('Sotuv narxi kiriting');
      return;
    }
    if (buy < 0 || Number.isNaN(Number(buyPrice || 0))) {
      toast.error('Olish narxi noto‘g‘ri');
      return;
    }
    const stockNum = Math.max(0, Math.floor(Number(stock) || 0));
    const payload = {
      name: name.trim(),
      firmName: '',
      sku: sku.trim() || '—',
      unitPrice: sell,
      buyPrice: buy,
      unit,
      imageUrl: imageUrl.trim() || undefined,
    };

    const result = isEdit
      ? updateProduct(data, product.id, { ...payload, qrcodeImageUrl: product.qrcodeImageUrl }, stockNum)
      : createProduct(data, payload, stockNum);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    onSave(result.data);
    onClose();
    toast.success(isEdit ? 'Mahsulot yangilandi' : 'Mahsulot qo‘shildi');
  };

  return (
    <>
      <div
        className={dillerSheetShellClass}
        style={{ ...iosGlassPageSurface(isDark), zIndex: 115 }}
      >
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 max-w-lg mx-auto w-full">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 shrink-0"
            style={iosGlassCardStyle(isDark)}
            aria-label="Orqaga"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-[17px] tracking-tight truncate">
              {isEdit ? 'Mahsulotni tahrirlash' : 'Mahsulot qo‘shish'}
            </h2>
            <p className="text-[11px] opacity-45 truncate">
              {isEdit ? product.name : 'Rasm, narx, shtrix-kod, miqdor'}
            </p>
          </div>
        </header>

        <div className={`${dillerSheetScrollClass} px-4 pb-3 max-w-lg mx-auto w-full`}>
          <div className="rounded-[24px] p-4 space-y-3.5" style={iosGlassCardStyle(isDark)}>
            <DillerLocalImageField
              imageUrl={imageUrl}
              onChange={setImageUrl}
              isDark={isDark}
              accentColor={accentColor.color}
              variant="hero"
            />

            <div>
              <label className="block text-[11px] font-semibold opacity-55 mb-1.5">
                Mahsulot nomi *
              </label>
              <input
                placeholder="Muz 500 Kg"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold opacity-55 mb-1.5">Sotuv narxi *</label>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="4 000"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className={inputCls(isDark)}
                  style={iosGlassInputStyle(isDark)}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-[11px] font-semibold opacity-55 mb-1.5">Olish narxi</label>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="3 200"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  className={inputCls(isDark)}
                  style={iosGlassInputStyle(isDark)}
                />
              </div>
            </div>
            {margin > 0 ? (
              <p className="text-[11px] text-emerald-500 -mt-1.5">
                Foyda: {formatMoney(margin)}
              </p>
            ) : null}

            <div>
              <label className="block text-[11px] font-semibold opacity-55 mb-1.5">Shtrix kod</label>
              <div className="flex gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-35 pointer-events-none" />
                  <input
                    placeholder="8690123456789"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={`${inputCls(isDark)} pl-9 font-mono text-[13px]`}
                    style={iosGlassInputStyle(isDark)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="shrink-0 w-12 h-12 rounded-[16px] flex items-center justify-center active:scale-95"
                  style={{ ...iosGlassCardStyle(isDark), color: accentColor.color }}
                  aria-label="Skaner"
                >
                  <ScanLine className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold opacity-55 mb-1.5">Miqdor</label>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="100"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className={inputCls(isDark)}
                style={iosGlassInputStyle(isDark)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold opacity-55 mb-1.5">Birlik</label>
              <div className="grid grid-cols-3 gap-1.5">
                {DILLER_PRODUCT_UNITS.map((opt) => {
                  const on = unit === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUnit(opt.value)}
                      className="py-2.5 rounded-[14px] text-[13px] font-bold active:scale-[0.97]"
                      style={
                        on
                          ? iosAccentFillStyle(accentColor.gradient, accentColor.color)
                          : iosGlassInputStyle(isDark)
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-2 pb-[max(0.75rem,calc(var(--kb-inset,0px)+0.5rem))] max-w-lg mx-auto w-full space-y-2">
          <button
            type="button"
            onClick={save}
            className="w-full py-3.5 rounded-[18px] font-bold text-white active:scale-[0.98]"
            style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
          >
            {isEdit ? 'Saqlash' : 'Mahsulot qo‘shish'}
          </button>
          {isEdit ? (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`«${product.name}» o‘chirilsinmi?`)) return;
                onSave(deleteProduct(data, product.id));
                toast.success('O‘chirildi');
                onClose();
              }}
              className="w-full py-2.5 rounded-[16px] font-semibold text-sm text-red-400 flex items-center justify-center gap-1.5 active:opacity-70"
            >
              <Trash2 className="w-4 h-4" />
              O‘chirish
            </button>
          ) : null}
        </div>
      </div>

      <DillerSkuScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={onSkuScanned}
        isDark={isDark}
      />
    </>
  );
}
