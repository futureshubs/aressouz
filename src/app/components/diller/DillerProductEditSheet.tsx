import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Package, Save, ScanLine, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerProduct, DillerProductUnit } from '../../utils/dillerData';
import {
  DILLER_PRODUCT_UNITS,
  findProductBySku,
  formatMoney,
  getWarehouseQty,
  updateProduct,
} from '../../utils/dillerData';
import { DillerSkuScanner } from './DillerSkuScanner';
import { DillerQrcodeImageField } from './DillerQrcodeImageField';
import { dillerSheetScrollClass, dillerSheetShellClass } from './dillerMobileLayout';

type Props = {
  open: boolean;
  product: DillerProduct | null;
  data: DillerData;
  onClose: () => void;
  onSave: (next: DillerData) => void;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

export function DillerProductEditSheet({ open, product, data, onClose, onSave }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [firmId, setFirmId] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [unit, setUnit] = useState<DillerProductUnit>('dona');
  const [stock, setStock] = useState('');
  const [qrcodeImageUrl, setQrcodeImageUrl] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setFirmId(product.firmId ?? data.firms.find((f) => f.name === product.firmName)?.id ?? data.firms[0]?.id ?? '');
    setName(product.name);
    setSku(product.sku === '—' ? '' : product.sku);
    setSellPrice(String(product.unitPrice));
    setBuyPrice(String(product.buyPrice ?? 0));
    setUnit((product.unit as DillerProductUnit) || 'dona');
    setStock(String(getWarehouseQty(data, product.id)));
    setQrcodeImageUrl(product.qrcodeImageUrl ?? '');
  }, [open, product, data]);

  if (!open || !product) return null;

  const selectedFirm = data.firms.find((f) => f.id === firmId);
  const margin =
    Number(sellPrice) > 0 && Number(buyPrice) >= 0
      ? Number(sellPrice) - Number(buyPrice)
      : 0;

  const onSkuScanned = (code: string) => {
    const trimmed = code.trim();
    setSku(trimmed);
    const existing = findProductBySku(data, trimmed);
    if (existing && existing.id !== product.id) {
      toast.info(`SKU boshqa mahsulotda: ${existing.name}`);
    } else {
      toast.success('Kod yozildi');
    }
  };

  const save = () => {
    if (!selectedFirm) {
      toast.error('Firmani tanlang');
      return;
    }
    if (!name.trim()) {
      toast.error('Mahsulot nomi kerak');
      return;
    }
    const sell = Number(sellPrice);
    const buy = Number(buyPrice);
    if (!sell || sell < 0) {
      toast.error('Sotish narxi kiriting');
      return;
    }
    if (buy < 0 || Number.isNaN(buy)) {
      toast.error('Firmadan olish narxi noto‘g‘ri');
      return;
    }
    const stockNum = Math.max(0, Math.floor(Number(stock) || 0));

    const result = updateProduct(
      data,
      product.id,
      {
        name: name.trim(),
        firmId: selectedFirm.id,
        firmName: selectedFirm.name,
        sku: sku.trim() || '—',
        unitPrice: sell,
        buyPrice: buy,
        unit,
        qrcodeImageUrl: qrcodeImageUrl.trim() || undefined,
      },
      stockNum,
    );
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onSave(result.data);
    toast.success('Mahsulot yangilandi');
    onClose();
  };

  return (
    <>
    <div
      className={dillerSheetShellClass}
      style={{ background: isDark ? '#0a0a0a' : '#f1f5f9', zIndex: 115 }}
    >
        <header
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accentColor.color}22` }}
          >
            <Package className="w-5 h-5" style={{ color: accentColor.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate">Mahsulotni tahrirlash</h2>
            <p className="text-[10px] opacity-50 truncate">{product.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl opacity-70 hover:opacity-100"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className={`${dillerSheetScrollClass} px-4 py-4 space-y-3 max-w-lg mx-auto w-full pb-6`}>
          {data.firms.length === 0 ? (
            <p className="text-xs text-amber-500 font-medium">Avval «Diller» tabida firma qo‘shing.</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium opacity-80 mb-1">Firma</label>
                <select
                  value={firmId}
                  onChange={(e) => setFirmId(e.target.value)}
                  className={inputCls(isDark)}
                >
                  {data.firms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium opacity-80 mb-1">Mahsulot nomi</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls(isDark)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium opacity-80 mb-1">SKU / shtrix-kod</label>
                <div className="flex gap-2">
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={`${inputCls(isDark)} font-mono text-xs`}
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="shrink-0 px-3 rounded-xl border flex items-center gap-1.5 text-sm font-semibold"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                      color: accentColor.color,
                    }}
                  >
                    <ScanLine className="w-4 h-4" />
                    Scan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium opacity-80 mb-1">Firmadan olish</label>
                  <input
                    type="number"
                    min={0}
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    className={inputCls(isDark)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium opacity-80 mb-1">Sotish narxi</label>
                  <input
                    type="number"
                    min={0}
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className={inputCls(isDark)}
                  />
                </div>
              </div>
              {margin > 0 ? (
                <p className="text-[10px] text-emerald-500/90 -mt-1">
                  Foyda: {formatMoney(margin)} / {unitLabel(unit)}
                </p>
              ) : null}

              <div>
                <label className="block text-xs font-medium opacity-80 mb-2">O‘lchov birligi</label>
                <div className="flex gap-2">
                  {DILLER_PRODUCT_UNITS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUnit(opt.value)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        unit === opt.value
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : isDark
                            ? 'border-white/10 opacity-70'
                            : 'border-gray-200 opacity-80'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium opacity-80 mb-1">Ombordagi miqdor</label>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={inputCls(isDark)}
                />
              </div>

              <DillerQrcodeImageField
                imageUrl={qrcodeImageUrl}
                onChange={setQrcodeImageUrl}
                isDark={isDark}
                accentColor={accentColor.color}
              />
            </>
          )}
        </div>

        <div
          className="shrink-0 px-4 py-3 border-t app-safe-pad max-w-lg mx-auto w-full"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
        >
          <button
            type="button"
            onClick={save}
            disabled={data.firms.length === 0}
            className="w-full py-3.5 rounded-xl font-bold text-slate-900 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: accentColor.gradient }}
          >
            <Save className="w-4 h-4" />
            Saqlash
          </button>
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
