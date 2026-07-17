import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Save, ScanLine, ShoppingCart, Trash2 } from 'lucide-react';
import { DillerProductEditSheet } from './DillerProductEditSheet';
import { DillerQrcodeImageField } from './DillerQrcodeImageField';
import { DillerOmborTab } from './DillerOmborTab';
import { DillerDokonlarTab } from './DillerDokonlarTab';
import { DillerProfilTab } from './DillerFirmTab';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerProduct, DillerProductUnit } from '../../utils/dillerData';
import {
  createProduct,
  deleteProduct,
  DILLER_PRODUCT_UNITS,
  findProductBySku,
  formatMoney,
  getWarehouseQty,
  setWarehouseQty,
} from '../../utils/dillerData';
import { DillerSkuScanner } from './DillerSkuScanner';
import { DillerSaleSheet } from './DillerSaleSheet';
import { DillerSaleCard } from './DillerSaleCard';
import { DillerSaleReceiptModal } from './DillerSaleReceiptModal';
import { DillerQarzTab } from './DillerQarzTab';
import type { DillerSale } from '../../utils/dillerData';
import type { DillerTabId } from './DillerBottomNav';
import { dillerListClass, dillerTabContentClass } from './dillerMobileLayout';

type Props = {
  tab: DillerTabId;
  data: DillerData;
  onDataChange: (next: DillerData) => void;
};

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

function Card({
  children,
  isDark,
  className = '',
}: {
  children: ReactNode;
  isDark: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${className}`.trim()}
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      {children}
    </div>
  );
}

export function DillerSotuvTab({ data, onDataChange }: Omit<Props, 'tab'>) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [saleOpen, setSaleOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<DillerSale | null>(null);

  return (
    <div className={dillerTabContentClass}>
      <button
        type="button"
        onClick={() => setSaleOpen(true)}
        className="w-full py-4 rounded-2xl font-bold text-slate-900 flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-transform"
        style={{ background: accentColor.gradient }}
      >
        <ShoppingCart className="w-6 h-6" />
        Yangi sotuv
      </button>

      <p className="text-xs opacity-60 px-1">
        Sotuvda ombor avtomatik kamayadi. Chegirma va qarz to‘liq saqlanadi.
      </p>

      <DillerSaleSheet
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        data={data}
        onComplete={onDataChange}
      />

      <DillerSaleReceiptModal
        open={!!receiptSale}
        onClose={() => setReceiptSale(null)}
        sale={receiptSale}
        data={data}
        onDataChange={onDataChange}
      />

      <Card isDark={isDark}>
        <h3 className="font-bold text-sm mb-1">So‘nggi sotuvlar</h3>
        <p className="text-[10px] opacity-50 mb-3">Kartani bosing — to‘liq chek ochiladi</p>
        {data.sales.filter((s) => !s.cancelled).length === 0 ? (
          <p className="text-sm opacity-60">Hali sotuv yo‘q — «Yangi sotuv» tugmasini bosing</p>
        ) : (
          <ul className={dillerListClass}>
            {data.sales
              .filter((s) => !s.cancelled)
              .slice(0, 40)
              .map((sale) => (
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
      </Card>
    </div>
  );
}

export function DillerMahsulotTab({ data, onDataChange }: Omit<Props, 'tab'>) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [firmId, setFirmId] = useState(data.firms[0]?.id ?? '');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [unit, setUnit] = useState<DillerProductUnit>('dona');
  const [stock, setStock] = useState('');
  const [qrcodeImageUrl, setQrcodeImageUrl] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<DillerProduct | null>(null);

  useEffect(() => {
    if (!firmId && data.firms[0]?.id) setFirmId(data.firms[0].id);
  }, [data.firms, firmId]);

  const selectedFirm = data.firms.find((f) => f.id === firmId);

  const onSkuScanned = (code: string) => {
    const trimmed = code.trim();
    setSku(trimmed);
    const existing = findProductBySku(data, trimmed);
    if (existing) {
      toast.info(`SKU topildi: ${existing.name}`);
      setName(existing.name);
      setFirmId(existing.firmId ?? firmId);
      setSellPrice(String(existing.unitPrice));
      setBuyPrice(String(existing.buyPrice));
      setUnit((existing.unit as DillerProductUnit) || 'dona');
      setStock(String(getWarehouseQty(data, existing.id)));
    } else {
      toast.success('Kod yozildi');
    }
  };

  const resetForm = () => {
    setName('');
    setSku('');
    setSellPrice('');
    setBuyPrice('');
    setStock('');
    setUnit('dona');
    setQrcodeImageUrl('');
  };

  const add = () => {
    if (!selectedFirm) {
      toast.error('Avval «Diller» bo‘limida firma qo‘shing');
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

    const result = createProduct(
      data,
      {
        name: name.trim(),
        firmName: selectedFirm.name,
        firmId: selectedFirm.id,
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
    onDataChange(result.data);
    resetForm();
    toast.success('Mahsulot saqlandi');
  };

  const remove = (id: string) => {
    onDataChange(deleteProduct(data, id));
    toast.success('O‘chirildi');
  };

  const unitLabel = (u: string) => DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;

  return (
    <div className={dillerTabContentClass}>
      <Card isDark={isDark}>
        <h3 className="font-bold text-base mb-1" style={{ color: isDark ? '#fff' : '#111' }}>
          Mahsulot qo‘shish
        </h3>
        <p className="text-xs opacity-70 mb-4">
          Firma, narxlar, o‘lchov va ombor — barchasi shu yerda saqlanadi.
        </p>

        {data.firms.length === 0 ? (
          <p className="text-xs text-amber-500 font-medium py-2">Avval «Diller» tabida firma qo‘shing.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium opacity-80 mb-1">Qaysi firmaga tegishli</label>
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
              {selectedFirm ? (
                <p className="text-[10px] opacity-50 mt-1 truncate">
                  {selectedFirm.address || 'Manzil kiritilmagan'} · {selectedFirm.phone}
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-medium opacity-80 mb-1">Mahsulot nomi</label>
              <input
                placeholder="Masalan: Suv 0.5L (24 dona)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls(isDark)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium opacity-80 mb-1">SKU / shtrix-kod (ixtiyoriy)</label>
              <div className="flex gap-2">
                <input
                  placeholder="SKU yoki skaner"
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
                  aria-label="Skaner"
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
                  placeholder="so‘m"
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
                  placeholder="so‘m"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className={inputCls(isDark)}
                />
              </div>
            </div>
            {sellPrice && buyPrice && Number(sellPrice) > Number(buyPrice) ? (
              <p className="text-[10px] text-emerald-500/90 -mt-1">
                Foyda: {formatMoney(Number(sellPrice) - Number(buyPrice))} / {unitLabel(unit)}
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
                placeholder={`0 ${unitLabel(unit)}`}
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

            <button
              type="button"
              onClick={add}
              disabled={!firmId}
              className="w-full py-3 rounded-xl font-bold text-slate-900 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: accentColor.gradient }}
            >
              <Save className="w-4 h-4" />
              Mahsulotni saqlash
            </button>
          </div>
        )}
      </Card>

      <DillerSkuScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={onSkuScanned}
        isDark={isDark}
      />

      <DillerProductEditSheet
        open={!!editProduct}
        product={editProduct}
        data={data}
        onClose={() => setEditProduct(null)}
        onSave={onDataChange}
      />

      <Card isDark={isDark}>
        <h3 className="font-bold text-sm mb-2">Ro‘yxat ({data.products.length})</h3>
        {data.products.length === 0 ? (
          <p className="text-sm opacity-60">Hali mahsulot yo‘q</p>
        ) : (
          <ul className="space-y-2">
            {data.products.map((p: DillerProduct) => {
              const qty = getWarehouseQty(data, p.id);
              const margin = p.unitPrice - (p.buyPrice ?? 0);
              return (
                <li
                  key={p.id}
                  className="flex gap-2 p-3 rounded-xl"
                  style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
                >
                  <button
                    type="button"
                    onClick={() => setEditProduct(p)}
                    className="flex-1 min-w-0 text-left active:opacity-80"
                  >
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-xs opacity-70 mt-0.5">{p.firmName}</div>
                    {p.sku && p.sku !== '—' ? (
                      <div className="text-[10px] font-mono opacity-50 mt-0.5">SKU: {p.sku}</div>
                    ) : null}
                    <div className="text-xs mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span className="text-emerald-400 font-bold">{formatMoney(p.unitPrice)}</span>
                      <span className="opacity-50">← {formatMoney(p.buyPrice ?? 0)}</span>
                      {margin > 0 ? (
                        <span className="text-[10px] opacity-60">+{formatMoney(margin)}</span>
                      ) : null}
                    </div>
                    <div className="text-xs opacity-60 mt-1">
                      Ombor: <span className="font-semibold">{qty}</span> {unitLabel(String(p.unit))}
                    </div>
                    <span className="text-[10px] opacity-40 mt-1 inline-block">Tahrirlash uchun bosing</span>
                  </button>
                  <div className="flex flex-col gap-1 shrink-0 self-start">
                    <button
                      type="button"
                      onClick={() => setEditProduct(p)}
                      className="p-2 rounded-lg opacity-70 hover:opacity-100"
                      style={{ color: accentColor.color }}
                      aria-label="Tahrirlash"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`«${p.name}» o‘chirilsinmi?`)) remove(p.id);
                      }}
                      className="p-2 text-red-400 rounded-lg"
                      aria-label="O‘chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function DillerPanelContent({ tab, data, onDataChange }: Props) {
  switch (tab) {
    case 'sotuv':
      return <DillerSotuvTab data={data} onDataChange={onDataChange} />;
    case 'mahsulot':
      return <DillerMahsulotTab data={data} onDataChange={onDataChange} />;
    case 'qarz':
      return <DillerQarzTab data={data} onDataChange={onDataChange} />;
    case 'diller':
      return <DillerProfilTab data={data} onDataChange={onDataChange} />;
    case 'ombor':
      return <DillerOmborTab data={data} onDataChange={onDataChange} />;
    case 'dokonlar':
      return <DillerDokonlarTab data={data} onDataChange={onDataChange} />;
    default:
      return null;
  }
}
