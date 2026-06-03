import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Minus, Package, Plus, Search, Warehouse } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerProduct } from '../../utils/dillerData';
import {
  adjustWarehouseQty,
  DILLER_PRODUCT_UNITS,
  formatMoney,
  getWarehouseQty,
  setWarehouseQty,
} from '../../utils/dillerData';
import { dillerTabContentClass } from './dillerMobileLayout';

type Props = {
  data: DillerData;
  onDataChange: (next: DillerData) => void;
};

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

function unitLabel(u: string) {
  return DILLER_PRODUCT_UNITS.find((x) => x.value === u)?.label ?? u;
}

const LOW_STOCK = 20;
const CRITICAL_STOCK = 5;

export function DillerOmborTab({ data, onDataChange }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [search, setSearch] = useState('');

  const summary = useMemo(() => {
    let totalUnits = 0;
    let lowCount = 0;
    let outCount = 0;
    let stockValue = 0;
    for (const p of data.products) {
      const q = getWarehouseQty(data, p.id);
      totalUnits += q;
      stockValue += q * (p.buyPrice ?? 0);
      if (q === 0) outCount += 1;
      else if (q < LOW_STOCK) lowCount += 1;
    }
    return {
      totalUnits,
      productCount: data.products.length,
      lowCount,
      outCount,
      stockValue,
    };
  }, [data]);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...data.products];
    if (q) {
      list = list.filter((p) => {
        const hay = `${p.name} ${p.firmName} ${p.sku}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list.sort((a, b) => {
      const qa = getWarehouseQty(data, a.id);
      const qb = getWarehouseQty(data, b.id);
      if (qa === 0 && qb !== 0) return -1;
      if (qb === 0 && qa !== 0) return 1;
      if (qa < LOW_STOCK && qb >= LOW_STOCK) return -1;
      if (qb < LOW_STOCK && qa >= LOW_STOCK) return 1;
      return a.name.localeCompare(b.name, 'uz');
    });
  }, [data.products, data.warehouse, search, data]);

  const setQty = (productId: string, qty: number) => {
    onDataChange(setWarehouseQty(data, productId, qty));
  };

  const bump = (productId: string, delta: number) => {
    onDataChange(adjustWarehouseQty(data, productId, delta));
  };

  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/40 ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder:text-white/40'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

  return (
    <div className={dillerTabContentClass}>
      <Card isDark={isDark}>
        <div className="flex items-center gap-2 mb-3">
          <Warehouse className="w-5 h-5" style={{ color: accentColor.color }} />
          <h3 className="font-bold text-base">Ombor</h3>
        </div>
        <p className="text-xs opacity-70 mb-3">
          + / − bilan qoldiqni o‘zgartiring. Sotuvda avtomatik kamayadi.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl p-3"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
          >
            <div className="text-[10px] opacity-60">Jami qoldiq</div>
            <div className="text-lg font-black" style={{ color: accentColor.color }}>
              {summary.totalUnits.toLocaleString('uz-UZ')}
            </div>
            <div className="text-[10px] opacity-50">{summary.productCount} tur mahsulot</div>
          </div>
          <div
            className="rounded-xl p-3"
            style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}
          >
            <div className="text-[10px] opacity-60">Ombor qiymati</div>
            <div className="text-sm font-bold text-emerald-500">{formatMoney(summary.stockValue)}</div>
            <div className="text-[10px] opacity-50">olib kelish narxi bo‘yicha</div>
          </div>
          {(summary.lowCount > 0 || summary.outCount > 0) && (
            <div
              className="col-span-2 rounded-xl p-2.5 flex items-center gap-2 text-xs"
              style={{ background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.15)' }}
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                {summary.outCount > 0 && <strong>{summary.outCount} tugagan</strong>}
                {summary.outCount > 0 && summary.lowCount > 0 ? ' · ' : ''}
                {summary.lowCount > 0 && <strong>{summary.lowCount} kam qoldiq</strong>}
              </span>
            </div>
          )}
        </div>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Mahsulot, firma yoki SKU qidirish..."
          className={`${inputCls} pl-9`}
        />
      </div>

      {data.products.length === 0 ? (
        <Card isDark={isDark}>
          <p className="text-sm opacity-60 text-center py-6">
            Mahsulot yo‘q — «Mahsulot» tabida qo‘shing
          </p>
        </Card>
      ) : products.length === 0 ? (
        <Card isDark={isDark}>
          <p className="text-sm opacity-60 text-center py-6">Qidiruv bo‘yicha topilmadi</p>
        </Card>
      ) : (
        <ul className="space-y-3 pb-4">
          {products.map((p: DillerProduct) => (
            <WarehouseProductCard
              key={p.id}
              product={p}
              qty={getWarehouseQty(data, p.id)}
              isDark={isDark}
              accentColor={accentColor}
              onBump={bump}
              onSetQty={setQty}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function WarehouseProductCard({
  product,
  qty,
  isDark,
  accentColor,
  onBump,
  onSetQty,
}: {
  product: DillerProduct;
  qty: number;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  onBump: (id: string, delta: number) => void;
  onSetQty: (id: string, qty: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(qty));

  const out = qty === 0;
  const low = qty > 0 && qty < LOW_STOCK;
  const critical = qty > 0 && qty < CRITICAL_STOCK;
  const stockValue = qty * (product.buyPrice ?? 0);

  const status = out
    ? { label: 'Tugagan', cls: 'bg-red-500/20 text-red-400', bar: '#ef4444' }
    : critical
      ? { label: 'Juda kam', cls: 'bg-red-500/15 text-red-400', bar: '#f59e0b' }
      : low
        ? { label: 'Kam', cls: 'bg-amber-500/20 text-amber-500', bar: '#f59e0b' }
        : { label: 'Normal', cls: 'bg-emerald-500/15 text-emerald-500', bar: accentColor.color };

  const applyDraft = () => {
    const n = Math.max(0, Math.floor(Number(draft) || 0));
    onSetQty(product.id, n);
    setDraft(String(n));
    setEditing(false);
    toast.success('Saqlandi');
  };

  return (
    <li>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="h-1" style={{ background: status.bar }} />
        <div className="p-3.5">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}
            >
              <Package className="w-5 h-5 opacity-60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>
                  {status.label}
                </span>
              </div>
              <div className="font-bold text-sm mt-1 truncate">{product.name}</div>
              <div className="text-xs opacity-70 truncate">{product.firmName}</div>
              {product.sku && product.sku !== '—' ? (
                <div className="text-[10px] font-mono opacity-45 mt-0.5">{product.sku}</div>
              ) : null}
            </div>
          </div>

          <div
            className="mt-3 pt-3 grid grid-cols-2 gap-2 text-[10px] border-t"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
          >
            <div>
              <span className="opacity-50">Sotuv</span>
              <div className="font-semibold text-emerald-500/90">{formatMoney(product.unitPrice)}</div>
            </div>
            <div className="text-right">
              <span className="opacity-50">Ombor qiymati</span>
              <div className="font-semibold">{formatMoney(stockValue)}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onBump(product.id, -1)}
              disabled={qty <= 0}
              className="w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-30 active:scale-95"
              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}
              aria-label="Kamaytirish"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="flex-1 text-center min-w-0">
              {editing ? (
                <div className="flex gap-1 items-center justify-center">
                  <input
                    type="number"
                    min={0}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className={`w-20 px-2 py-1.5 rounded-lg border text-center text-lg font-black ${
                      isDark ? 'bg-white/10 border-white/15 text-white' : 'border-gray-200'
                    }`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyDraft();
                      if (e.key === 'Escape') {
                        setDraft(String(qty));
                        setEditing(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={applyDraft}
                    className="px-2 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-900"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(String(qty));
                    setEditing(true);
                  }}
                  className="block w-full"
                >
                  <div className="text-3xl font-black tabular-nums leading-none">{qty}</div>
                  <div className="text-xs opacity-60 mt-0.5">{unitLabel(String(product.unit))}</div>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onBump(product.id, 1)}
              className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95"
              style={{ background: accentColor.gradient, color: '#0f172a' }}
              aria-label="Qo‘shish"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-2 flex gap-1.5">
            {[5, 10, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onBump(product.id, n)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold opacity-70 hover:opacity-100 border"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
              >
                +{n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}
