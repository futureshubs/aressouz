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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import {
  fetchAdminBranchInsights,
  type BranchInsightRow,
  type BranchInsightsMeta,
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

const paymentLabelUz = (ps: string) => {
  const p = String(ps || '').toLowerCase();
  if (p === 'paid') return "To'langan";
  if (p === 'failed') return 'Xatolik';
  if (p === 'refunded') return 'Qaytarilgan';
  return 'Kutilmoqda';
};

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#94a3b8', '#ec4899', '#14b8a6'];

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
  const [meta, setMeta] = useState<BranchInsightsMeta | null>(null);
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
        setMeta(null);
        return;
      }
      setGlobalM(data.global);
      setBranches(Array.isArray(data.branches) ? data.branches : []);
      setGeneratedAt(data.generatedAt || null);
      setMeta(data.meta ?? null);
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

  const paymentPieData = useMemo(() => {
    if (!selectedMetrics) return [];
    return Object.entries(selectedMetrics.byPaymentStatus)
      .map(([key, value]) => ({
        name: paymentLabelUz(key),
        value: safeNum(value),
      }))
      .filter((d) => d.value > 0);
  }, [selectedMetrics]);

  const hourlyBarData = useMemo(() => {
    if (!selectedMetrics?.hourly24?.length) return [];
    return selectedMetrics.hourly24.map((count, hour) => ({
      hour: `${hour}:00`,
      hourNum: hour,
      count: safeNum(count),
    }));
  }, [selectedMetrics]);

  const weekCompareBarData = useMemo(() => {
    if (!selectedMetrics?.compareWeeks) return [];
    const w = selectedMetrics.compareWeeks;
    return [
      { period: 'Oldingi 7 kun', buyurtmalar: w.ordersPrev7, tushum: w.revenuePaidPrev7 },
      { period: 'So‘nggi 7 kun', buyurtmalar: w.ordersLast7, tushum: w.revenuePaidLast7 },
    ];
  }, [selectedMetrics]);

  const revenueByTypeData = useMemo(() => {
    if (!selectedMetrics) return [];
    return Object.entries(selectedMetrics.byOrderTypeRevenuePaid)
      .map(([type, sum]) => ({
        type: typeLabelUz(type),
        sum: safeNum(sum),
      }))
      .sort((a, b) => b.sum - a.sum);
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
          {meta && selectedId === '__all__' ? (
            <p className="text-xs mt-1 font-mono" style={{ opacity: 0.45 }}>
              Buyurtmalar (dedup): {meta.dedupedOrders ?? '—'}
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
          
        </p>
      ) : null}

      {selectedMetrics ? (
        <div className="space-y-6">
          <div className="p-4 lg:p-6 rounded-3xl border" style={cardStyle}>
            <h3 className="font-bold mb-1">Vaqt qatori (14 kun)</h3>
            <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
              Kunlik buyurtmalar va to‘langan tushum
            </p>
            {lineData.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ opacity: 0.55 }}>
                Kunlik qator bo‘sh (yoki sana mos kelmaydi).
              </p>
            ) : (
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
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="p-4 lg:p-6 rounded-3xl border" style={cardStyle}>
              <h3 className="font-bold mb-1">To‘lov holati</h3>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
                Buyurtmalar soni bo‘yicha taqsimot
              </p>
              {paymentPieData.length === 0 ? (
                <p className="text-sm py-12 text-center" style={{ opacity: 0.55 }}>
                  Maʼlumot yo‘q
                </p>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {paymentPieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: isDark ? '#1a1a1a' : '#fff',
                          border: `1px solid ${cardStyle.borderColor}`,
                          borderRadius: 12,
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="p-4 lg:p-6 rounded-3xl border" style={cardStyle}>
              <h3 className="font-bold mb-1">Haftalar taqqosi</h3>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
                Oldingi 7 kun va so‘nggi 7 kun
              </p>
              {weekCompareBarData.length === 0 ? (
                <p className="text-sm py-12 text-center" style={{ opacity: 0.55 }}>
                  Maʼlumot yo‘q
                </p>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekCompareBarData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                      <XAxis dataKey="period" tick={{ fill: tick, fontSize: 11 }} />
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
                        formatter={(value: number, name: string) => {
                          if (name === 'tushum') return [`${formatSumUz(value)} so'm`, 'To‘langan'];
                          return [value, 'Buyurtmalar'];
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="buyurtmalar"
                        name="Buyurtmalar"
                        fill={accentColor.color}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="tushum"
                        name="To‘langan (so'm)"
                        fill="#f59e0b"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 lg:p-6 rounded-3xl border" style={cardStyle}>
            <h3 className="font-bold mb-1">Soat bo‘yicha (UTC)</h3>
            <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
              Barcha vaqt oralig‘idagi buyurtmalar — yaratilgan vaqt UTC bo‘yicha
            </p>
            {hourlyBarData.every((d) => d.count === 0) ? (
              <p className="text-sm py-8 text-center" style={{ opacity: 0.55 }}>
                Maʼlumot yo‘q
              </p>
            ) : (
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyBarData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                    <XAxis dataKey="hour" tick={{ fill: tick, fontSize: 9 }} interval={2} />
                    <YAxis tick={{ fill: tick, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: isDark ? '#1a1a1a' : '#fff',
                        border: `1px solid ${cardStyle.borderColor}`,
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="count" name="Buyurtmalar" fill={accentColor.color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="p-4 lg:p-6 rounded-3xl border" style={cardStyle}>
              <h3 className="font-bold mb-1">Buyurtma turlari (soni)</h3>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
                Tanlangan filial yoki jami
              </p>
              {barData.length === 0 ? (
                <p className="text-sm py-12 text-center" style={{ opacity: 0.55 }}>
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

            <div className="p-4 lg:p-6 rounded-3xl border" style={cardStyle}>
              <h3 className="font-bold mb-1">Tur bo‘yicha tushum (to‘langan)</h3>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
                Faqat to‘langan buyurtmalar summasi
              </p>
              {revenueByTypeData.length === 0 ? (
                <p className="text-sm py-12 text-center" style={{ opacity: 0.55 }}>
                  Maʼlumot yo‘q
                </p>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByTypeData} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                      <XAxis dataKey="type" tick={{ fill: tick, fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={48} />
                      <YAxis
                        tick={{ fill: tick, fontSize: 11 }}
                        tickFormatter={(v) => (safeNum(v) >= 1000 ? `${(safeNum(v) / 1000).toFixed(0)}k` : String(v))}
                      />
                      <Tooltip
                        contentStyle={{
                          background: isDark ? '#1a1a1a' : '#fff',
                          border: `1px solid ${cardStyle.borderColor}`,
                          borderRadius: 12,
                        }}
                        formatter={(v: number) => [`${formatSumUz(v)} so'm`, 'Tushum']}
                      />
                      <Bar dataKey="sum" name="So'm" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !globalM && !error ? (
        <p className="text-sm" style={{ opacity: 0.6 }}>
          Maʼlumot yo‘q.
        </p>
      ) : null}
    </div>
  );
}
