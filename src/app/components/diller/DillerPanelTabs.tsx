import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Barcode, Package, Pencil, Plus, ScanLine, Search } from 'lucide-react';
import { DillerProductAddSheet } from './DillerProductAddSheet';
import { DillerOmborTab } from './DillerOmborTab';
import { DillerDokonlarTab } from './DillerDokonlarTab';
import { DillerProfilTab } from './DillerFirmTab';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerProduct } from '../../utils/dillerData';
import {
  DILLER_PRODUCT_UNITS,
  findProductBySku,
  formatMoney,
  getWarehouseQty,
} from '../../utils/dillerData';
import { DillerSkuScanner } from './DillerSkuScanner';
import { DillerQarzTab } from './DillerQarzTab';
import { DillerSotuvTab } from './DillerSotuvTab';
export { DillerSotuvTab };
import type { DillerTabId } from './DillerBottomNav';
import { dillerTabContentClass } from './dillerMobileLayout';
import { DillerStoresMapSheet } from './DillerStoresMapSheet';
import { DillerBalansSection } from './DillerBalansSection';
import { iosAccentFillStyle, iosGlassCardStyle, iosGlassInputStyle } from './dillerIosGlass';
import { resolveDillerImage } from '../../utils/dillerMedia';

type Props = {
  tab: DillerTabId;
  data: DillerData;
  onDataChange: (next: DillerData) => void;
  onGoHome?: () => void;
};

const LOW_STOCK = 5;

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

function stockDot(qty: number) {
  if (qty <= 0) return '#ef4444';
  if (qty <= LOW_STOCK) return '#f59e0b';
  return '#22c55e';
}

export function DillerMahsulotTab({
  data,
  onDataChange,
}: Omit<Props, 'tab'>) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSku, setAddSku] = useState('');
  const [editProduct, setEditProduct] = useState<DillerProduct | null>(null);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...data.products];
    if (q) {
      list = list.filter((p) => {
        const hay = `${p.name} ${p.sku}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [data.products, search]);

  const onSkuScanned = (code: string) => {
    const trimmed = code.trim();
    setSearch(trimmed);
    const existing = findProductBySku(data, trimmed);
    if (existing) {
      toast.success(`Topildi: ${existing.name}`);
      setAddOpen(false);
      setAddSku('');
      setEditProduct(existing);
      return;
    }
    toast.info('Yangi mahsulot — kod yozildi');
    setEditProduct(null);
    setAddSku(trimmed);
    setAddOpen(true);
  };

  const openAdd = () => {
    setEditProduct(null);
    setAddSku('');
    setAddOpen(true);
  };

  return (
    <div className={`${dillerTabContentClass} min-w-0`}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-black tracking-tight leading-none">Mahsulotlar</h1>
        <p className="text-[13px] opacity-45 mt-1.5">Jami: {data.products.length}</p>
      </div>

      <button
        type="button"
        onClick={openAdd}
        className="w-full py-3.5 rounded-[18px] font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98]"
        style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
        Mahsulot qo‘shish
      </button>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 rounded-[18px] px-3.5 py-2.5" style={iosGlassInputStyle(isDark)}>
          <Search className="w-4 h-4 opacity-35 shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mahsulot, shtrix kod..."
            className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:opacity-40"
          />
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="shrink-0 w-[46px] h-[46px] rounded-[16px] flex items-center justify-center active:scale-95"
          style={{ ...iosGlassCardStyle(isDark), color: accentColor.color }}
          aria-label="Skaner"
        >
          <ScanLine className="w-5 h-5" />
        </button>
      </div>

      {data.products.length === 0 ? (
        <div className="rounded-[24px] px-5 py-12 text-center" style={iosGlassCardStyle(isDark)}>
          <Package className="w-8 h-8 mx-auto mb-3 opacity-40" style={{ color: accentColor.color }} />
          <p className="font-bold text-sm">Hali mahsulot yo‘q</p>
          <p className="text-xs opacity-55 mt-1">«Mahsulot qo‘shish» ni bosing</p>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-[24px] px-5 py-10 text-center" style={iosGlassCardStyle(isDark)}>
          <p className="font-bold text-sm">Mos mahsulot topilmadi</p>
          <p className="text-xs opacity-55 mt-1">Qidiruvni o‘zgartiring yoki yangi qo‘shing</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {products.map((p) => {
            const qty = getWarehouseQty(data, p.id);
            const img = resolveDillerImage(p.imageUrl);
            const sku = p.sku && p.sku !== '—' ? p.sku : '';
            const ring = isDark ? 'rgba(22,22,24,0.95)' : '#ffffff';
            return (
              <li key={p.id} className="rounded-[22px] px-3 py-3 flex items-center gap-2.5 min-w-0" style={iosGlassCardStyle(isDark)}>
                <button
                  type="button"
                  onClick={() => setEditProduct(p)}
                  className="flex-1 min-w-0 flex items-center gap-2.5 text-left active:opacity-80"
                >
                  <div className="relative shrink-0">
                    <div
                      className="w-12 h-12 rounded-[16px] overflow-hidden flex items-center justify-center"
                      style={{ background: `${accentColor.color}18`, color: accentColor.color }}
                    >
                      {img ? (
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5" strokeWidth={2.1} />
                      )}
                    </div>
                    <span
                      className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                      style={{
                        background: stockDot(qty),
                        boxShadow: `0 0 0 2px ${ring}`,
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="font-bold text-[15px] leading-tight truncate">{p.name}</div>
                    {sku ? (
                      <div className="flex items-center gap-1 mt-0.5 min-w-0">
                        <Barcode className="w-3 h-3 opacity-35 shrink-0" />
                        <span className="text-[11px] font-mono opacity-45 truncate">{sku}</span>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1 min-w-0">
                      <span className="font-bold text-[14px]" style={{ color: accentColor.color }}>
                        {formatMoney(p.unitPrice)}
                      </span>
                      <span className="text-[12px] opacity-45">
                        Qoldiq: {qty} {unitLabel(String(p.unit)).toLowerCase()}
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setEditProduct(p)}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-95"
                  style={{ background: `${accentColor.color}14`, color: accentColor.color }}
                  aria-label="Tahrirlash"
                >
                  <Pencil className="w-4 h-4" strokeWidth={2.2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <DillerSkuScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={onSkuScanned}
        isDark={isDark}
      />

      <DillerProductAddSheet
        open={addOpen || !!editProduct}
        data={data}
        product={editProduct}
        initialSku={addSku}
        onClose={() => {
          setAddOpen(false);
          setAddSku('');
          setEditProduct(null);
        }}
        onSave={onDataChange}
      />
    </div>
  );
}

export function DillerXaritaTab({ data }: { data: DillerData }) {
  return (
    <div className="absolute inset-0">
      <DillerStoresMapSheet open variant="page" data={data} onClose={() => {}} />
    </div>
  );
}

export function DillerBalansTab({ data, onDataChange }: Omit<Props, 'tab' | 'onGoHome'>) {
  const { theme } = useTheme();
  return (
    <div className={dillerTabContentClass}>
      <DillerBalansSection data={data} onDataChange={onDataChange} isDark={theme === 'dark'} />
    </div>
  );
}

export function DillerPanelContent({ tab, data, onDataChange, onGoHome }: Props) {
  switch (tab) {
    case 'sotuv':
      return <DillerSotuvTab data={data} onDataChange={onDataChange} />;
    case 'xarita':
      return <DillerXaritaTab data={data} />;
    case 'mahsulot':
      return <DillerMahsulotTab data={data} onDataChange={onDataChange} onGoHome={onGoHome} />;
    case 'qarz':
      return <DillerQarzTab data={data} onDataChange={onDataChange} />;
    case 'profil':
      return <DillerProfilTab data={data} onDataChange={onDataChange} />;
    case 'ombor':
      return <DillerOmborTab data={data} onDataChange={onDataChange} />;
    case 'dokonlar':
      return <DillerDokonlarTab data={data} onDataChange={onDataChange} />;
    case 'balans':
      return <DillerBalansTab data={data} onDataChange={onDataChange} />;
    case 'statistika':
      return <DillerQarzTab data={data} onDataChange={onDataChange} forcedSection="statistika" onGoHome={onGoHome} />;
    case 'analitika':
      return <DillerQarzTab data={data} onDataChange={onDataChange} forcedSection="analitika" onGoHome={onGoHome} />;
    case 'buyurtma':
      return <DillerQarzTab data={data} onDataChange={onDataChange} forcedSection="buyurtma" />;
    case 'tarix':
      return <DillerQarzTab data={data} onDataChange={onDataChange} forcedSection="tarix" />;
    case 'xarajat':
      return <DillerQarzTab data={data} onDataChange={onDataChange} forcedSection="xarajat" />;
    default:
      return null;
  }
}
