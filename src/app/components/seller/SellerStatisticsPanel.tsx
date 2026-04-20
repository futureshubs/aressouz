import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, FileSpreadsheet, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type RangePreset = 'today' | 'week' | 'month' | 'year' | 'custom';

type PosStats = {
  range: { from: string; to: string };
  online: { totalUzs: number; count: number; platformCommissionUzs: number; sellerNetUzs: number; costUzs: number; grossProfitUzs: number };
  offline: { totalUzs: number; count: number; platformCommissionUzs: number; sellerNetUzs: number; costUzs: number; grossProfitUzs: number };
  combined: { totalUzs: number; count: number; avgCheckUzs: number; platformCommissionUzs: number; sellerNetUzs: number; costUzs: number; grossProfitUzs: number };
};

type Props = {
  token: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
};

type SaleDetailsRow = {
  id: string;
  kind: 'online' | 'offline';
  createdAt?: string;
  paymentMethod?: string;
  items?: Array<{
    name?: string;
    variantLabel?: string;
    qty?: number;
    priceUzs?: number;
    totalUzs?: number;
    costUzs?: number;
    image?: string;
  }>;
  totals?: {
    subtotalUzs?: number;
    discountUzs?: number;
    totalUzs?: number;
    platformCommissionUzs?: number;
    sellerNetUzs?: number;
    costUzs?: number;
    grossProfitUzs?: number;
  };
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeForPreset(preset: Exclude<RangePreset, 'custom'>): { from: Date; to: Date } {
  const now = new Date();
  const to = now;
  if (preset === 'today') return { from: startOfDay(now), to };
  if (preset === 'week') return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to };
  if (preset === 'month') return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to };
  return { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), to };
}

const safeNum = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

const formatSumUz = (n: unknown) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(safeNum(n));

const shortDateUz = (d: Date) =>
  d.toLocaleDateString('uz-UZ', { month: '2-digit', day: '2-digit' }).replace(/\./g, '-');

const PIE_COLORS = ['#22c55e', '#60a5fa', '#f59e0b', '#ef4444', '#a78bfa', '#14b8a6', '#f472b6', '#94a3b8'];

export default function SellerStatisticsPanel({ token, isDark, accentColor }: Props) {
  const [preset, setPreset] = useState<RangePreset>('today');
  const [customFrom, setCustomFrom] = useState(() => isoDateInputValue(new Date()));
  const [customTo, setCustomTo] = useState(() => isoDateInputValue(new Date()));
  const [loading, setLoading] = useState(false);
  const [posStats, setPosStats] = useState<PosStats | null>(null);
  const [detailsKind, setDetailsKind] = useState<'all' | 'online' | 'offline'>('all');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsRows, setDetailsRows] = useState<any[]>([]);
  const [detailsPage, setDetailsPage] = useState(1);
  const [detailsHasMore, setDetailsHasMore] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRows, setAnalyticsRows] = useState<SaleDetailsRow[] | null>(null);

  const effectiveRange = useMemo(() => {
    if (preset !== 'custom') return rangeForPreset(preset);
    const f = new Date(`${customFrom}T00:00:00`);
    const t = new Date(`${customTo}T23:59:59`);
    return { from: f, to: t };
  }, [preset, customFrom, customTo]);

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark
      ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))'
      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
  } as const;

  const fetchStats = async () => {
    setLoading(true);
    try {
      const from = effectiveRange.from.toISOString();
      const to = effectiveRange.to.toISOString();
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pos/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Seller-Token': token,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || `HTTP ${res.status}`));
      }
      setPosStats(data as PosStats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Statistika yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (opts?: { reset?: boolean }) => {
    const reset = Boolean(opts?.reset);
    const nextPage = reset ? 1 : detailsPage + 1;
    setDetailsLoading(true);
    try {
      const from = effectiveRange.from.toISOString();
      const to = effectiveRange.to.toISOString();
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pos/stats/details?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&kind=${encodeURIComponent(detailsKind)}&page=${nextPage}&limit=20`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Seller-Token': token,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || `HTTP ${res.status}`));
      }
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setDetailsPage(nextPage);
      setDetailsHasMore(Boolean(data?.hasMore));
      setDetailsRows((prev) => (reset ? rows : [...prev, ...rows]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sotuvlar ro‘yxati yuklanmadi');
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchAllDetailsForExport = async (opts?: { kind?: 'all' | 'online' | 'offline'; capRows?: number }) => {
    const capRows = Math.max(50, Math.min(5000, Number(opts?.capRows ?? 2000)));
    const kind = opts?.kind ?? detailsKind;
    const from = effectiveRange.from.toISOString();
    const to = effectiveRange.to.toISOString();

    const out: SaleDetailsRow[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && out.length < capRows) {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pos/stats/details?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&kind=${encodeURIComponent(kind)}&page=${page}&limit=100`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Seller-Token': token,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(String(data?.error || `HTTP ${res.status}`));
      const rows = (Array.isArray(data?.rows) ? data.rows : []) as SaleDetailsRow[];
      out.push(...rows);
      hasMore = Boolean(data?.hasMore) && rows.length > 0;
      page += 1;
      if (rows.length === 0) break;
    }
    return out.slice(0, capRows);
  };

  useEffect(() => {
    if (!token) return;
    void fetchStats();
    void fetchDetails({ reset: true });
    setAnalyticsRows(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, preset, customFrom, customTo, detailsKind]);

  const exportPdf = async () => {
    if (!posStats) {
      toast.error('Avval statistikani yuklang');
      return;
    }
    try {
      setExporting('pdf');
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text('Savdo statistikasi (Online / Offline)', 40, 48);
      doc.setFontSize(10);
      doc.text(`Oraliq: ${posStats.range.from} — ${posStats.range.to}`, 40, 68);

      const rows = [
        ['Online (tushum)', String(posStats.online.count), String(posStats.online.totalUzs.toLocaleString('uz-UZ'))],
        ['Online (platforma %)', '-', String(posStats.online.platformCommissionUzs.toLocaleString('uz-UZ'))],
        ['Online (seller net)', '-', String(posStats.online.sellerNetUzs.toLocaleString('uz-UZ'))],
        ['Online (tannarx)', '-', String(posStats.online.costUzs.toLocaleString('uz-UZ'))],
        ['Online (sof foyda)', '-', String(posStats.online.grossProfitUzs.toLocaleString('uz-UZ'))],
        ['Offline POS (tushum)', String(posStats.offline.count), String(posStats.offline.totalUzs.toLocaleString('uz-UZ'))],
        ['Offline POS (platforma %)', '-', String(posStats.offline.platformCommissionUzs.toLocaleString('uz-UZ'))],
        ['Offline POS (seller net)', '-', String(posStats.offline.sellerNetUzs.toLocaleString('uz-UZ'))],
        ['Offline POS (tannarx)', '-', String(posStats.offline.costUzs.toLocaleString('uz-UZ'))],
        ['Offline POS (sof foyda)', '-', String(posStats.offline.grossProfitUzs.toLocaleString('uz-UZ'))],
        ['Jami (tushum)', String(posStats.combined.count), String(posStats.combined.totalUzs.toLocaleString('uz-UZ'))],
        ['Jami (platforma %)', '-', String(posStats.combined.platformCommissionUzs.toLocaleString('uz-UZ'))],
        ['Jami (seller net)', '-', String(posStats.combined.sellerNetUzs.toLocaleString('uz-UZ'))],
        ['Jami (tannarx)', '-', String(posStats.combined.costUzs.toLocaleString('uz-UZ'))],
        ['Jami (sof foyda)', '-', String(posStats.combined.grossProfitUzs.toLocaleString('uz-UZ'))],
        ['O‘rtacha chek', '-', String(posStats.combined.avgCheckUzs.toLocaleString('uz-UZ'))],
      ];
      autoTable(doc, {
        startY: 92,
        head: [['Turi', 'Soni', 'Summa (so‘m)']],
        body: rows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [30, 30, 30] },
      });

      const details = await fetchAllDetailsForExport({ kind: 'all', capRows: 800 });
      const detailsBody = details.map((r) => [
        r.kind === 'online' ? 'Online' : 'Offline',
        String(r.id ?? '').slice(-14),
        r.createdAt ? new Date(r.createdAt).toLocaleString('uz-UZ') : '',
        String(r.paymentMethod ?? ''),
        String(Number(r?.totals?.totalUzs ?? 0).toLocaleString('uz-UZ')),
        String(Number(r?.totals?.platformCommissionUzs ?? 0).toLocaleString('uz-UZ')),
        String(Number(r?.totals?.sellerNetUzs ?? 0).toLocaleString('uz-UZ')),
        String(Number(r?.totals?.costUzs ?? 0).toLocaleString('uz-UZ')),
        String(Number(r?.totals?.grossProfitUzs ?? 0).toLocaleString('uz-UZ')),
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : 420,
        head: [['Turi', 'Chek', 'Vaqt', 'To‘lov', 'Jami', 'Platforma', 'Seller net', 'Tannarx', 'Sof foyda']],
        body: detailsBody,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 30, 30] },
      });

      doc.save(`savdo-statistika-${Date.now()}.pdf`);
      toast.success('PDF yuklab olindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF xatosi');
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    if (!posStats) {
      toast.error('Avval statistikani yuklang');
      return;
    }
    try {
      setExporting('excel');
      const [xlsx, details] = await Promise.all([import('xlsx'), fetchAllDetailsForExport({ kind: 'all', capRows: 2000 })]);
      const XLSX = (xlsx as any).default ?? (xlsx as any);

      const header = [
        ['Oraliq', `${posStats.range.from} — ${posStats.range.to}`],
        ['Online tushum', posStats.online.totalUzs],
        ['Online soni', posStats.online.count],
        ['Online platforma', posStats.online.platformCommissionUzs],
        ['Online seller net', posStats.online.sellerNetUzs],
        ['Online tannarx', posStats.online.costUzs],
        ['Online sof foyda', posStats.online.grossProfitUzs],
        ['Offline tushum', posStats.offline.totalUzs],
        ['Offline soni', posStats.offline.count],
        ['Offline platforma', posStats.offline.platformCommissionUzs],
        ['Offline seller net', posStats.offline.sellerNetUzs],
        ['Offline tannarx', posStats.offline.costUzs],
        ['Offline sof foyda', posStats.offline.grossProfitUzs],
      ];

      const sheetSummary = XLSX.utils.aoa_to_sheet(header);

      const detailRows = details.flatMap((sale) => {
        const saleId = String(sale.id ?? '');
        const createdAt = sale.createdAt ? new Date(sale.createdAt).toISOString() : '';
        const kind = sale.kind;
        const payment = String(sale.paymentMethod ?? '');
        const subtotalUzs = Number(sale?.totals?.subtotalUzs ?? 0);
        const discountUzs = Number(sale?.totals?.discountUzs ?? 0);
        const totalUzs = Number(sale?.totals?.totalUzs ?? 0);
        const platformCommissionUzs = Number(sale?.totals?.platformCommissionUzs ?? 0);
        const sellerNetUzs = Number(sale?.totals?.sellerNetUzs ?? 0);
        const costUzs = Number(sale?.totals?.costUzs ?? 0);
        const grossProfitUzs = Number(sale?.totals?.grossProfitUzs ?? 0);

        const items = Array.isArray(sale.items) ? sale.items : [];
        if (items.length === 0) {
          return [
            {
              kind,
              saleId,
              createdAt,
              paymentMethod: payment,
              subtotalUzs,
              discountUzs,
              totalUzs,
              platformCommissionUzs,
              sellerNetUzs,
              costUzs,
              grossProfitUzs,
              itemName: '',
              variant: '',
              qty: 0,
              itemPriceUzs: 0,
              itemTotalUzs: 0,
              itemCostUzs: 0,
            },
          ];
        }

        return items.map((it) => ({
          kind,
          saleId,
          createdAt,
          paymentMethod: payment,
          subtotalUzs,
          discountUzs,
          totalUzs,
          platformCommissionUzs,
          sellerNetUzs,
          costUzs,
          grossProfitUzs,
          itemName: String(it?.name ?? ''),
          variant: String(it?.variantLabel ?? ''),
          qty: Number(it?.qty ?? 0),
          itemPriceUzs: Number(it?.priceUzs ?? 0),
          itemTotalUzs: Number(it?.totalUzs ?? 0),
          itemCostUzs: Number(it?.costUzs ?? 0),
        }));
      });

      const sheetDetails = XLSX.utils.json_to_sheet(detailRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheetSummary, 'Summary');
      XLSX.utils.book_append_sheet(wb, sheetDetails, 'Sales');
      XLSX.writeFile(wb, `savdo-statistika-${Date.now()}.xlsx`);
      toast.success('Excel yuklab olindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Excel xatosi');
    } finally {
      setExporting(null);
    }
  };

  const loadAnalytics = async () => {
    if (!token) return;
    setAnalyticsLoading(true);
    try {
      const rows = await fetchAllDetailsForExport({ kind: detailsKind, capRows: 5000 });
      setAnalyticsRows(rows);
      toast.success('Analitika yuklandi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analitika yuklanmadi');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const rowsForAnalytics = analyticsRows ?? (detailsRows as SaleDetailsRow[]);

  const seriesByDay = useMemo(() => {
    const list = Array.isArray(rowsForAnalytics) ? rowsForAnalytics : [];
    if (list.length === 0) return [];
    const byKey = new Map<
      string,
      {
        day: string;
        onlineTotal: number;
        offlineTotal: number;
        onlineCommission: number;
        offlineCommission: number;
        onlineProfit: number;
        offlineProfit: number;
        countOnline: number;
        countOffline: number;
      }
    >();

    for (const r of list) {
      const t = new Date(String(r.createdAt || '')).getTime();
      if (!Number.isFinite(t)) continue;
      const d = new Date(t);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const cur =
        byKey.get(key) ??
        ({
          day: shortDateUz(d),
          onlineTotal: 0,
          offlineTotal: 0,
          onlineCommission: 0,
          offlineCommission: 0,
          onlineProfit: 0,
          offlineProfit: 0,
          countOnline: 0,
          countOffline: 0,
        } as const);

      const total = safeNum(r?.totals?.totalUzs);
      const commission = safeNum(r?.totals?.platformCommissionUzs);
      const profit = safeNum(r?.totals?.grossProfitUzs);

      if (r.kind === 'online') {
        (cur as any).onlineTotal += total;
        (cur as any).onlineCommission += commission;
        (cur as any).onlineProfit += profit;
        (cur as any).countOnline += 1;
      } else {
        (cur as any).offlineTotal += total;
        (cur as any).offlineCommission += commission;
        (cur as any).offlineProfit += profit;
        (cur as any).countOffline += 1;
      }
      byKey.set(key, cur as any);
    }

    return Array.from(byKey.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({
        ...v,
        total: v.onlineTotal + v.offlineTotal,
        commission: v.onlineCommission + v.offlineCommission,
        profit: v.onlineProfit + v.offlineProfit,
        count: v.countOnline + v.countOffline,
      }));
  }, [rowsForAnalytics]);

  const topProducts = useMemo(() => {
    const list = Array.isArray(rowsForAnalytics) ? rowsForAnalytics : [];
    const byName = new Map<
      string,
      { name: string; qty: number; revenue: number; profit: number; commission: number; image?: string }
    >();
    for (const sale of list) {
      const items = Array.isArray(sale.items) ? sale.items : [];
      for (const it of items) {
        const name = String(it?.name || '').trim() || 'Mahsulot';
        const cur = byName.get(name) ?? { name, qty: 0, revenue: 0, profit: 0, commission: 0, image: undefined };
        cur.qty += Math.max(0, Math.floor(safeNum(it?.qty)));
        cur.revenue += safeNum(it?.totalUzs);
        cur.profit += safeNum(it?.totalUzs) - safeNum(it?.costUzs);
        cur.commission += 0; // commission is sale-level; keep product-level profit simple
        if (!cur.image && String((it as any)?.image || '').trim()) cur.image = String((it as any).image);
        byName.set(name, cur);
      }
    }
    return Array.from(byName.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 12);
  }, [rowsForAnalytics]);

  const paymentPieData = useMemo(() => {
    const list = Array.isArray(rowsForAnalytics) ? rowsForAnalytics : [];
    const byPay = new Map<string, number>();
    for (const r of list) {
      const p = String(r.paymentMethod || '').trim().toLowerCase() || 'unknown';
      byPay.set(p, (byPay.get(p) ?? 0) + safeNum(r?.totals?.totalUzs));
    }
    return Array.from(byPay.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [rowsForAnalytics]);

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div
        className="p-6 rounded-3xl border"
        style={{
          background: isDark
            ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
            : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
          borderColor: `${accentColor.color}33`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              Statistika (Online / Offline)
            </h3>
            <p style={{ opacity: 0.75 }}>Kunlik/haftalik/oylik/yillik yoki o‘zingiz belgilagan oraliq.</p>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportPdf}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-white transition active:scale-95 disabled:opacity-60"
              style={{ background: accentColor.gradient, boxShadow: `0 10px 24px ${accentColor.color}55` }}
            >
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF
            </button>
            <button
              type="button"
              onClick={exportExcel}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold border transition active:scale-95 disabled:opacity-60"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
                color: isDark ? '#fff' : '#111',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
              }}
            >
              {exporting === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Excel
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border p-4 space-y-3" style={cardStyle}>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'today', label: 'Bugun' },
              { id: 'week', label: 'Hafta' },
              { id: 'month', label: 'Oy' },
              { id: 'year', label: 'Yil' },
              { id: 'custom', label: 'Tanlash' },
            ] as const
          ).map((p) => {
            const on = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className="px-3 py-2 rounded-2xl text-xs font-bold border transition active:scale-95"
                style={{
                  background: on ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  color: on ? '#fff' : undefined,
                  borderColor: on ? 'transparent' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {preset === 'custom' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4" style={{ color: accentColor.color }} />
              <span>Boshlanish</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="ml-auto rounded-xl border px-3 py-2 text-sm"
                style={{
                  background: isDark ? '#111' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
              />
            </label>
            <label className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4" style={{ color: accentColor.color }} />
              <span>Tugash</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="ml-auto rounded-xl border px-3 py-2 text-sm"
                style={{
                  background: isDark ? '#111' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                }}
              />
            </label>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void fetchStats();
              void fetchDetails({ reset: true });
              setAnalyticsRows(null);
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-white transition active:scale-95 disabled:opacity-55"
            style={{ background: accentColor.gradient }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Yuklash
          </button>
          {posStats ? (
            <span className="text-xs" style={{ opacity: 0.7 }}>
              {posStats.range.from} — {posStats.range.to}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={analyticsLoading || !token}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold border transition active:scale-95 disabled:opacity-55"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
            }}
          >
            {analyticsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Analitika
          </button>
        </div>
      </div>

      {posStats ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-5 rounded-3xl border space-y-3" style={cardStyle}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Online savdo
                </p>
                <p className="text-2xl font-extrabold">{posStats.online.totalUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Buyurtma
                </p>
                <p className="text-lg font-bold tabular-nums">{posStats.online.count}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Platforma
                </p>
                <p className="font-bold tabular-nums">{posStats.online.platformCommissionUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Seller net
                </p>
                <p className="font-bold tabular-nums">{posStats.online.sellerNetUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Tannarx
                </p>
                <p className="font-bold tabular-nums">{posStats.online.costUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Sof foyda
                </p>
                <p className="font-bold tabular-nums">{posStats.online.grossProfitUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-3xl border space-y-3" style={cardStyle}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Offline savdo (POS)
                </p>
                <p className="text-2xl font-extrabold">{posStats.offline.totalUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Chek
                </p>
                <p className="text-lg font-bold tabular-nums">{posStats.offline.count}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Platforma
                </p>
                <p className="font-bold tabular-nums">{posStats.offline.platformCommissionUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Seller net
                </p>
                <p className="font-bold tabular-nums">{posStats.offline.sellerNetUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Tannarx
                </p>
                <p className="font-bold tabular-nums">{posStats.offline.costUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
              <div>
                <p className="text-xs" style={{ opacity: 0.65 }}>
                  Sof foyda
                </p>
                <p className="font-bold tabular-nums">{posStats.offline.grossProfitUzs.toLocaleString('uz-UZ')} so‘m</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-3xl border lg:col-span-2" style={cardStyle}>
            <p className="text-xs" style={{ opacity: 0.65 }}>
              Jami
            </p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <p className="text-2xl font-extrabold">{posStats.combined.totalUzs.toLocaleString('uz-UZ')} so‘m</p>
              <p className="text-sm font-bold tabular-nums" style={{ opacity: 0.8 }}>
                O‘rtacha chek: {posStats.combined.avgCheckUzs.toLocaleString('uz-UZ')} so‘m
              </p>
            </div>
            <p className="text-xs mt-1" style={{ opacity: 0.65 }}>
              Sof foyda: {posStats.combined.grossProfitUzs.toLocaleString('uz-UZ')} so‘m
            </p>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-3xl border text-center" style={cardStyle}>
          <p className="text-sm" style={{ opacity: 0.7 }}>
            Online/Offline statistikani ko‘rish uchun “Yuklash”ni bosing.
          </p>
        </div>
      )}

      {/* Analytics charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-3xl border p-4 lg:col-span-2" style={cardStyle}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold">Trend</p>
              <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
                Kunlar bo‘yicha tushum (Online/Offline) va platforma.
              </p>
            </div>
            <div className="text-xs" style={{ opacity: 0.7 }}>
              {analyticsRows ? 'Analitika: kengaytirilgan' : 'Analitika: joriy ro‘yxat'}
            </div>
          </div>

          {seriesByDay.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ opacity: 0.7 }}>
              Grafik uchun sotuvlar yo‘q. Pastdan “Yana yuklash” qiling yoki “Analitika”ni bosing.
            </div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={seriesByDay} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
                  <XAxis dataKey="day" tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }} tickFormatter={(v) => formatSumUz(v)} />
                  <Tooltip formatter={(v: any) => `${formatSumUz(v)} so‘m`} />
                  <Legend />
                  <Line type="monotone" dataKey="onlineTotal" name="Online tushum" stroke={accentColor.color} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="offlineTotal" name="Offline tushum" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="commission" name="Platforma" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-3xl border p-4" style={cardStyle}>
          <p className="font-bold">To‘lovlar taqsimoti</p>
          <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
            Summa bo‘yicha (cash/card/payme...).
          </p>
          {paymentPieData.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ opacity: 0.7 }}>
              Ma’lumot yo‘q.
            </div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v: any) => `${formatSumUz(v)} so‘m`} />
                  <Pie data={paymentPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {paymentPieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-3xl border p-4 lg:col-span-2" style={cardStyle}>
          <p className="font-bold">Sof foyda / Tannarx</p>
          <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
            Kunlar bo‘yicha sof foyda va tannarx (detal ro‘yxatdan).
          </p>
          {seriesByDay.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ opacity: 0.7 }}>
              Ma’lumot yo‘q.
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seriesByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
                  <XAxis dataKey="day" tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }} tickFormatter={(v) => formatSumUz(v)} />
                  <Tooltip formatter={(v: any) => `${formatSumUz(v)} so‘m`} />
                  <Legend />
                  <Bar dataKey="profit" name="Sof foyda" fill={accentColor.color} radius={[10, 10, 0, 0]} />
                  <Bar dataKey="commission" name="Platforma" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-3xl border p-4" style={cardStyle}>
          <p className="font-bold">Top mahsulotlar</p>
          <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
            Tushum bo‘yicha (detal sotuvlardan).
          </p>
          {topProducts.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ opacity: 0.7 }}>
              Ma’lumot yo‘q. “Analitika”ni bosing yoki sotuvlar ro‘yxatini ko‘proq yuklang.
            </div>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-3 rounded-2xl border p-3 max-w-full overflow-x-hidden"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl border overflow-hidden shrink-0"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }}
                  >
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate">{p.name}</div>
                    <div className="text-xs mt-0.5 tabular-nums" style={{ opacity: 0.75 }}>
                      {p.qty} ta · {formatSumUz(p.revenue)} so‘m
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs" style={{ opacity: 0.7 }}>
                      Profit
                    </div>
                    <div className="text-sm font-extrabold tabular-nums" style={{ color: accentColor.color }}>
                      {formatSumUz(p.profit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sold products / sales details */}
      <div className="rounded-3xl border p-4 space-y-3" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold">Sotuvlar ro‘yxati</p>
            <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
              Har bir sotuv: vaqt, to‘lov, chek summasi, tannarx, platforma %, sof foyda, mahsulotlar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {([
              { id: 'all', label: 'Hammasi' },
              { id: 'online', label: 'Online' },
              { id: 'offline', label: 'Offline' },
            ] as const).map((k) => {
              const on = detailsKind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setDetailsKind(k.id);
                    setDetailsRows([]);
                    setDetailsPage(1);
                    setDetailsHasMore(false);
                  }}
                  className="px-3 py-2 rounded-2xl text-xs font-bold border transition active:scale-95"
                  style={{
                    background: on ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                    color: on ? '#fff' : undefined,
                    borderColor: on ? 'transparent' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
        </div>

        {detailsRows.length === 0 && detailsLoading ? (
          <div className="py-8 text-center text-sm" style={{ opacity: 0.75 }}>
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
            Yuklanmoqda...
          </div>
        ) : detailsRows.length === 0 ? (
          <div className="py-6 text-center text-sm" style={{ opacity: 0.75 }}>
            Bu oraliqda sotuv topilmadi.
          </div>
        ) : (
          <div className="space-y-3">
            {detailsRows.map((r: any) => (
              <div
                key={`${r.kind}-${r.id}-${r.createdAt}`}
                className="rounded-2xl border p-3 max-w-full overflow-x-hidden"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">
                      {r.kind === 'online' ? 'Online' : 'Offline'} · #{String(r.id || '').slice(-10)}
                    </div>
                    <div className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleString('uz-UZ') : ''}
                      {r.paymentMethod ? ` · To‘lov: ${r.paymentMethod}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold tabular-nums" style={{ color: accentColor.color }}>
                      {Number(r?.totals?.totalUzs ?? 0).toLocaleString('uz-UZ')} so‘m
                    </div>
                    <div className="text-[11px]" style={{ opacity: 0.7 }}>
                      Sof foyda: {Number(r?.totals?.grossProfitUzs ?? 0).toLocaleString('uz-UZ')} · Platforma:{' '}
                      {Number(r?.totals?.platformCommissionUzs ?? 0).toLocaleString('uz-UZ')}
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="min-w-0">
                    <div style={{ opacity: 0.7 }}>Seller net</div>
                    <div className="font-bold tabular-nums truncate">{Number(r?.totals?.sellerNetUzs ?? 0).toLocaleString('uz-UZ')}</div>
                  </div>
                  <div className="min-w-0">
                    <div style={{ opacity: 0.7 }}>Tannarx</div>
                    <div className="font-bold tabular-nums truncate">{Number(r?.totals?.costUzs ?? 0).toLocaleString('uz-UZ')}</div>
                  </div>
                  <div className="min-w-0">
                    <div style={{ opacity: 0.7 }}>Chegirma</div>
                    <div className="font-bold tabular-nums truncate">{Number(r?.totals?.discountUzs ?? 0).toLocaleString('uz-UZ')}</div>
                  </div>
                  <div className="min-w-0">
                    <div style={{ opacity: 0.7 }}>Subtotal</div>
                    <div className="font-bold tabular-nums truncate">{Number(r?.totals?.subtotalUzs ?? 0).toLocaleString('uz-UZ')}</div>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  {(Array.isArray(r.items) ? r.items : []).slice(0, 6).map((it: any, idx: number) => (
                    <div key={`${r.id}-it-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold truncate block max-w-full">
                          {String(it?.name || 'Mahsulot')}
                          {it?.variantLabel ? ` (${String(it.variantLabel)})` : ''}
                        </span>
                        <span style={{ opacity: 0.7 }}> · {Number(it?.qty ?? 0)} ta</span>
                      </div>
                      <div className="tabular-nums" style={{ opacity: 0.85 }}>
                        {Number(it?.totalUzs ?? 0).toLocaleString('uz-UZ')}
                      </div>
                    </div>
                  ))}
                  {Array.isArray(r.items) && r.items.length > 6 ? (
                    <div className="text-xs" style={{ opacity: 0.7 }}>
                      +{r.items.length - 6} ta yana...
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-center pt-2">
              {detailsHasMore ? (
                <button
                  type="button"
                  onClick={() => void fetchDetails({ reset: false })}
                  disabled={detailsLoading}
                  className="px-5 py-3 rounded-2xl font-bold text-white transition active:scale-95 disabled:opacity-55"
                  style={{ background: accentColor.gradient }}
                >
                  {detailsLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
                    </span>
                  ) : (
                    'Yana yuklash'
                  )}
                </button>
              ) : (
                <span className="text-xs" style={{ opacity: 0.7 }}>
                  Hammasi yuklandi
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

