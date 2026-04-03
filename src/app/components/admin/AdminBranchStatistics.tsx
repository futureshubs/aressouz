import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import {
  fetchAdminBranchInsights,
  type BranchInsightRow,
  type InsightMetricsCore,
} from './adminBranchInsightsApi';
import { RefreshCw } from 'lucide-react';

const branchSelectValue = (b: BranchInsightRow) => b.branchId || '__nobranch__';

const safeNum = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

const formatSumUz = (n: number) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(safeNum(n));

const paymentLabelUz = (ps: string) => {
  const p = String(ps || '').toLowerCase();
  if (p === 'paid') return "To'langan";
  if (p === 'failed') return 'Xatolik';
  if (p === 'refunded') return 'Qaytarilgan';
  return 'Kutilmoqda';
};

const statusLabelUz = (s: string) => {
  const x = String(s || '').toLowerCase();
  const map: Record<string, string> = {
    pending: 'Kutilmoqda',
    confirmed: 'Tasdiqlangan',
    preparing: 'Tayyorlanmoqda',
    ready: 'Tayyor',
    delivering: 'Yetkazilmoqda',
    delivered: 'Yetkazilgan',
    cancelled: 'Bekor qilingan',
    canceled: 'Bekor qilingan',
  };
  return map[x] || s;
};

const typeLabelUz = (t: string) => {
  const x = String(t || '').toLowerCase();
  if (x === 'food' || x === 'restaurant') return 'Restoran';
  if (x === 'market') return 'Market';
  if (x === 'auction') return 'Auksion';
  return t || '—';
};

function BreakdownTable({
  title,
  entries,
  isDark,
  labelFn,
}: {
  title: string;
  entries: [string, number][];
  isDark: boolean;
  labelFn: (k: string) => string;
}) {
  if (entries.length === 0) return null;
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
      }}
    >
      <h4 className="font-semibold mb-3 text-sm">{title}</h4>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 text-sm">
            <span style={{ opacity: 0.85 }}>{labelFn(k)}</span>
            <span className="font-medium tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminBranchStatistics() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalM, setGlobalM] = useState<InsightMetricsCore | null>(null);
  const [branches, setBranches] = useState<BranchInsightRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('__all__');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminBranchInsights();
      if (!data.success) {
        setError(data.error || 'Maʼlumot olinmadi');
        setGlobalM(null);
        setBranches([]);
        return;
      }
      setGlobalM(data.global);
      setBranches(Array.isArray(data.branches) ? data.branches : []);
      setGeneratedAt(data.generatedAt || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibilityRefetch(() => {
    void load();
  });

  const selectedMetrics = useMemo(() => {
    if (!globalM) return null;
    if (selectedId === '__all__') return globalM;
    const row = branches.find((b) => branchSelectValue(b) === selectedId);
    return row || globalM;
  }, [globalM, branches, selectedId]);

  const sortedEntries = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]);

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
    boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.05)',
  } as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm" style={{ opacity: 0.65 }}>
            Buyurtmalar KV dan — har bir filial alohida yig‘indi.
          </p>
          {generatedAt ? (
            <p className="text-xs mt-1" style={{ opacity: 0.5 }}>
              Yangilangan: {new Date(generatedAt).toLocaleString('uz-UZ')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm min-w-[200px]"
            style={{
              background: isDark ? '#111' : '#fff',
              borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
              color: isDark ? '#fff' : '#111',
            }}
          >
            <option value="__all__">Barcha filiallar (jami)</option>
            {branches.map((b) => (
              <option key={branchSelectValue(b)} value={branchSelectValue(b)}>
                {b.branchName}
                {b.branchId ? ` (${b.branchId.slice(0, 8)}…)` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
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
      </div>

      {error ? (
        <div
          className="rounded-2xl border p-4 text-sm"
          style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}
        >
          {error}
        </div>
      ) : null}

      {loading && !globalM ? (
        <p className="text-sm" style={{ opacity: 0.6 }}>
          Yuklanmoqda…
        </p>
      ) : null}

      {globalM && selectedMetrics ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { t: 'Buyurtmalar', v: selectedMetrics.orderCount },
              { t: "To'langan daromad", v: `${formatSumUz(selectedMetrics.revenuePaid)} so'm` },
              { t: 'Jami summa (barcha)', v: `${formatSumUz(selectedMetrics.revenueAll)} so'm` },
              { t: 'Bekor qilingan', v: selectedMetrics.cancelledCount },
            ].map((c) => (
              <div key={c.t} className="p-5 rounded-3xl border" style={cardStyle}>
                <p className="text-sm mb-1" style={{ opacity: 0.65 }}>
                  {c.t}
                </p>
                <p className="text-2xl font-bold tabular-nums">{c.v}</p>
              </div>
            ))}
          </div>

          {selectedId === '__all__' ? (
            <div className="rounded-3xl border overflow-hidden" style={cardStyle}>
              <div className="p-4 border-b" style={{ borderColor: cardStyle.borderColor }}>
                <h3 className="font-bold">Filiallar bo‘yicha</h3>
                <p className="text-xs mt-1" style={{ opacity: 0.55 }}>
                  Buyurtma soni bo‘yicha saralangan
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                      <th className="text-left p-3 font-semibold">Filial</th>
                      <th className="text-right p-3 font-semibold">Buyurtmalar</th>
                      <th className="text-right p-3 font-semibold">To‘langan</th>
                      <th className="text-right p-3 font-semibold">Bekor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b) => (
                      <tr
                        key={branchSelectValue(b)}
                        className="border-t"
                        style={{ borderColor: cardStyle.borderColor }}
                      >
                        <td className="p-3">
                          <div className="font-medium">{b.branchName}</div>
                          <div className="text-xs opacity-50 font-mono">{b.branchId || '—'}</div>
                        </td>
                        <td className="p-3 text-right tabular-nums">{b.orderCount}</td>
                        <td className="p-3 text-right tabular-nums">
                          {formatSumUz(b.revenuePaid)} so'm
                        </td>
                        <td className="p-3 text-right tabular-nums">{b.cancelledCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BreakdownTable
              title="Holat bo‘yicha"
              entries={sortedEntries(selectedMetrics.byStatus)}
              isDark={isDark}
              labelFn={statusLabelUz}
            />
            <BreakdownTable
              title="To‘lov holati"
              entries={sortedEntries(selectedMetrics.byPaymentStatus)}
              isDark={isDark}
              labelFn={paymentLabelUz}
            />
            <BreakdownTable
              title="Buyurtma turi"
              entries={sortedEntries(selectedMetrics.byOrderType)}
              isDark={isDark}
              labelFn={typeLabelUz}
            />
          </div>
        </>
      ) : null}

      {!loading && !globalM && !error ? (
        <p className="text-sm" style={{ opacity: 0.6 }}>
          Maʼlumot yo‘q.
        </p>
      ) : null}
    </div>
  );
}
