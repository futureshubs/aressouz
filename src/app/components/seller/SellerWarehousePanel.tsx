import { useMemo, useState, useCallback } from 'react';
import {
  Warehouse,
  RefreshCw,
  Search,
  Save,
  Minus,
  Plus,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

export type SellerInventoryLine = {
  productId: string;
  productName: string;
  variantId: string;
  variantIndex: number;
  variantLabel: string;
  stock: number;
  price: number;
  image: string | null;
  barcode: string;
};

export type SellerInventorySummary = {
  totalLines: number;
  totalUnits: number;
  lowStockLines: number;
  outOfStockLines: number;
  lowStockThreshold: number;
};

function rowKey(line: SellerInventoryLine) {
  return `${line.productId}::${line.variantId || `i${line.variantIndex}`}`;
}

type Props = {
  token: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  lines: SellerInventoryLine[];
  summary: SellerInventorySummary | null;
  loading: boolean;
  onReload: () => void;
  /** API xatosi; mahsulotlar ro‘yxatidan fallback ko‘rsatilganda ham ogohlantirish */
  loadError?: string | null;
};

export default function SellerWarehousePanel({
  token,
  isDark,
  accentColor,
  lines,
  summary,
  loading,
  onReload,
  loadError,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'out' | 'low'>('all');
  const [pending, setPending] = useState<Record<string, number>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const threshold = summary?.lowStockThreshold ?? 5;

  const displayStock = useCallback(
    (line: SellerInventoryLine) => {
      const k = rowKey(line);
      if (pending[k] !== undefined) return pending[k];
      return line.stock;
    },
    [pending],
  );

  const setLineStock = (line: SellerInventoryLine, value: number) => {
    const k = rowKey(line);
    const n = Math.max(0, Math.floor(Number(value)));
    setPending((p) => ({ ...p, [k]: Number.isFinite(n) ? n : 0 }));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((line) => {
      const st = displayStock(line);
      if (filter === 'out' && st > 0) return false;
      if (filter === 'low' && !(st > 0 && st <= threshold)) return false;
      if (!q) return true;
      const hay = `${line.productName} ${line.variantLabel} ${line.barcode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [lines, query, filter, threshold, pending, displayStock]);

  const saveLine = async (line: SellerInventoryLine) => {
    const k = rowKey(line);
    const stock = displayStock(line);
    setSavingKey(k);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/inventory/${encodeURIComponent(line.productId)}?token=${encodeURIComponent(token)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
            'X-Seller-Token': token,
          },
          body: JSON.stringify({
            stock,
            ...(line.variantId ? { variantId: line.variantId } : {}),
            variantIndex: line.variantIndex,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Saqlab bo‘lmadi');
        return;
      }
      toast.success('Ombor yangilandi');
      setPending((p) => {
        const next = { ...p };
        delete next[k];
        return next;
      });
      onReload();
    } catch {
      toast.error('Tarmoq xatosi');
    } finally {
      setSavingKey(null);
    }
  };

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
  } as const;

  const chips: { id: typeof filter; label: string }[] = [
    { id: 'all', label: 'Barchasi' },
    { id: 'out', label: 'Tugagan' },
    { id: 'low', label: `Kam (≤${threshold})` },
  ];

  return (
    <div className="space-y-6">
      {loadError ? (
        <div
          className="rounded-2xl border p-4 text-sm"
          style={{
            borderColor: 'rgba(245,158,11,0.45)',
            background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
          }}
        >
          <p className="font-semibold" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
            Ombor API
          </p>
          <p className="mt-1 opacity-90">{loadError}</p>
          <p className="text-xs mt-2 opacity-70">
            Agar mahsulotlar ko‘rinayotgan bo‘lsa, ular brauzerda mahsulotlar ro‘yxatidan hisoblangan (server javobi
            kelmaguncha). Yangilash yoki funksiyani deploy qiling.
          </p>
        </div>
      ) : null}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm" style={{ opacity: 0.65 }}>
            Variantlar bo‘yicha real ombor — KV bilan sinxron
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onReload()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition active:scale-95 disabled:opacity-50"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Pozitsiyalar (SKU)', value: summary.totalLines, icon: Package, color: accentColor.color },
            { label: 'Jami dona', value: summary.totalUnits, icon: Warehouse, color: '#f59e0b' },
            { label: 'Tugagan qatorlar', value: summary.outOfStockLines, icon: AlertTriangle, color: '#ef4444' },
            { label: 'Kam qoldiq', value: summary.lowStockLines, icon: AlertTriangle, color: '#eab308' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="p-4 rounded-2xl border" style={cardStyle}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                  <span className="text-xs font-medium" style={{ opacity: 0.65 }}>
                    {s.label}
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      <div
        className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between p-4 rounded-2xl border"
        style={cardStyle}
      >
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ opacity: 0.45 }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mahsulot, variant, shtrix-kod..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm"
            style={{
              background: isDark ? '#111' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              color: isDark ? '#fff' : '#111',
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const on = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                className="px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  background: on ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  color: on ? '#fff' : undefined,
                  borderColor: on ? 'transparent' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="p-12 rounded-3xl border text-center" style={cardStyle}>
          <Warehouse className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h3 className="text-lg font-bold mb-2">Ombor bo‘sh</h3>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            Avval «Mahsulotlar» bo‘limidan mahsulot qo‘shing — ombor shu yerdan boshqariladi
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                  <th className="text-left p-3 font-semibold w-16"> </th>
                  <th className="text-left p-3 font-semibold">Mahsulot</th>
                  <th className="text-left p-3 font-semibold">Variant</th>
                  <th className="text-right p-3 font-semibold">Narx</th>
                  <th className="text-right p-3 font-semibold">Omborda</th>
                  <th className="text-right p-3 font-semibold w-44"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((line) => {
                  const k = rowKey(line);
                  const st = displayStock(line);
                  const dirty = pending[k] !== undefined && pending[k] !== line.stock;
                  const low = st > 0 && st <= threshold;
                  const out = st <= 0;
                  return (
                    <tr
                      key={k}
                      className="border-t"
                      style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                    >
                      <td className="p-3 align-middle">
                        {line.image ? (
                          <img
                            src={line.image}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-xs"
                            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
                          >
                            <Package className="w-5 h-5 opacity-40" />
                          </div>
                        )}
                      </td>
                      <td className="p-3 align-middle">
                        <div className="font-semibold line-clamp-2">{line.productName}</div>
                        {line.barcode ? (
                          <div className="text-xs opacity-50 font-mono mt-0.5">{line.barcode}</div>
                        ) : null}
                      </td>
                      <td className="p-3 align-middle">
                        <span>{line.variantLabel}</span>
                        {out ? (
                          <span className="ml-2 text-xs font-bold text-red-500">Tugagan</span>
                        ) : low ? (
                          <span className="ml-2 text-xs font-bold text-amber-500">Kam</span>
                        ) : null}
                      </td>
                      <td className="p-3 text-right tabular-nums align-middle">
                        {Number(line.price || 0).toLocaleString('uz-UZ')} so‘m
                      </td>
                      <td className="p-3 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="p-2 rounded-lg border transition active:scale-95"
                            style={{
                              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                            }}
                            onClick={() => setLineStock(line, st - 1)}
                            aria-label="Ayirish"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={st}
                            onChange={(e) => setLineStock(line, Number(e.target.value))}
                            className="w-16 text-center tabular-nums py-2 rounded-lg border text-sm font-bold"
                            style={{
                              background: isDark ? '#111' : '#fff',
                              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                              color: isDark ? '#fff' : '#111',
                            }}
                          />
                          <button
                            type="button"
                            className="p-2 rounded-lg border transition active:scale-95"
                            style={{
                              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                            }}
                            onClick={() => setLineStock(line, st + 1)}
                            aria-label="Qo‘shish"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-right align-middle">
                        <button
                          type="button"
                          disabled={!dirty || savingKey === k}
                          onClick={() => void saveLine(line)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition active:scale-95"
                          style={{ background: accentColor.gradient }}
                        >
                          {savingKey === k ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Saqlash
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && lines.length > 0 ? (
            <p className="p-6 text-center text-sm opacity-60">Filtr bo‘yicha natija yo‘q</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
