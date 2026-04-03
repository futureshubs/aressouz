import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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

const typeLabelUz = (t: string) => {
  const x = String(t || '').toLowerCase();
  if (x === 'food' || x === 'restaurant') return 'Restoran';
  if (x === 'market') return 'Market';
  if (x === 'auction') return 'Auksion';
  return t || '—';
};

export default function AdminBranchAnalytics() {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const tick = isDark ? '#9ca3af' : '#6b7280';
  const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

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
    return branches.find((b) => branchSelectValue(b) === selectedId) || globalM;
  }, [globalM, branches, selectedId]);

  const lineData = useMemo(() => {
    if (!selectedMetrics?.series14d?.length) return [];
    return selectedMetrics.series14d.map((p) => ({
      ...p,
      dateShort: p.date.slice(5),
    }));
  }, [selectedMetrics]);

  const barData = useMemo(() => {
    if (!selectedMetrics) return [];
    return Object.entries(selectedMetrics.byOrderType)
      .map(([type, count]) => ({
        type: typeLabelUz(type),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [selectedMetrics]);

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
            So‘nggi 14 kun: buyurtmalar va to‘langan daromad (KV).
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
            <option value="__all__">Barcha filiallar</option>
            {branches.map((b) => (
              <option key={branchSelectValue(b)} value={branchSelectValue(b)}>
                {b.branchName}
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

      {selectedMetrics && lineData.length > 0 ? (
        <>
          <div className="p-4 lg:p-6 rounded-3xl border" style={cardStyle}>
            <h3 className="font-bold mb-1">Vaqt qatori (14 kun)</h3>
            <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
              Kunlik buyurtmalar va to‘langan tushum
            </p>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="dateShort" tick={{ fill: tick, fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fill: tick, fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: tick, fontSize: 11 }}
                    tickFormatter={(v) => (safeNum(v) >= 1000 ? `${(safeNum(v) / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      background: isDark ? '#1a1a1a' : '#fff',
                      border: `1px solid ${cardStyle.borderColor}`,
                      borderRadius: 12,
                    }}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { date?: string } | undefined;
                      return p?.date || '';
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'revenuePaid') return [`${formatSumUz(value)} so'm`, "To'langan"];
                      return [value, 'Buyurtmalar'];
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    name="Buyurtmalar"
                    stroke={accentColor.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenuePaid"
                    name="To'langan (so'm)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-4 lg:p-6 rounded-3xl border" style={cardStyle}>
            <h3 className="font-bold mb-1">Buyurtma turlari</h3>
            <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
              Tanlangan filial yoki jami
            </p>
            {barData.length === 0 ? (
              <p className="text-sm" style={{ opacity: 0.55 }}>
                Maʼlumot yo‘q
              </p>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                    <XAxis dataKey="type" tick={{ fill: tick, fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={48} />
                    <YAxis tick={{ fill: tick, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: isDark ? '#1a1a1a' : '#fff',
                        border: `1px solid ${cardStyle.borderColor}`,
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="count" name="Soni" fill={accentColor.color} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      ) : null}

      {!loading && globalM && lineData.length === 0 && !error ? (
        <p className="text-sm" style={{ opacity: 0.6 }}>
          Grafik uchun kunlik maʼlumot hozircha yo‘q.
        </p>
      ) : null}
    </div>
  );
}
