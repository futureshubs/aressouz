import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  Loader2,
  ReceiptText,
  RefreshCw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

type RangePreset = 'lastHour' | 'today' | 'week' | 'month' | 'year' | 'custom';
type Kind = 'offline' | 'online';

type PosStats = {
  range: { from: string; to: string };
  online: { totalUzs: number; count: number; platformCommissionUzs: number; sellerNetUzs: number; costUzs: number; grossProfitUzs: number };
  offline: { totalUzs: number; count: number; platformCommissionUzs: number; sellerNetUzs: number; costUzs: number; grossProfitUzs: number };
  combined: { totalUzs: number; count: number; avgCheckUzs: number; platformCommissionUzs: number; sellerNetUzs: number; costUzs: number; grossProfitUzs: number };
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

type Props = {
  token: string;
  shopId: string;
  shopName: string;
  isDark: boolean;
  accentColor: { color: string; gradient: string };
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
  if (preset === 'lastHour') return { from: new Date(now.getTime() - 60 * 60 * 1000), to };
  if (preset === 'today') return { from: startOfDay(now), to };
  if (preset === 'week') return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to };
  if (preset === 'month') return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to };
  return { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), to };
}

function money(n: unknown): number {
  const x = Math.round(Number(n) || 0);
  return Number.isFinite(x) ? x : 0;
}

export default function SellerHistoryPanel({ token, shopId, shopName, isDark, accentColor }: Props) {
  const [kind, setKind] = useState<Kind>('offline');
  const [preset, setPreset] = useState<RangePreset>('today');
  const [customFrom, setCustomFrom] = useState(() => isoDateInputValue(new Date()));
  const [customTo, setCustomTo] = useState(() => isoDateInputValue(new Date()));
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PosStats | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [rows, setRows] = useState<SaleDetailsRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<SaleDetailsRow | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'receipt' | null>(null);

  const effectiveRange = useMemo(() => {
    if (preset !== 'custom') return rangeForPreset(preset);
    const f = new Date(`${customFrom}T00:00:00`);
    const t = new Date(`${customTo}T23:59:59`);
    return { from: f, to: t };
  }, [preset, customFrom, customTo]);

  const cardStyle = {
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    background: isDark ? 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' : 'linear-gradient(145deg, #ffffff, #f9fafb)',
  } as const;

  const fetchStats = async () => {
    setLoading(true);
    try {
      const from = effectiveRange.from.toISOString();
      const to = effectiveRange.to.toISOString();
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pos/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Seller-Token': token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(String(data?.error || `HTTP ${res.status}`));
      setStats(data as PosStats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Tarix statistikasi yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (opts?: { reset?: boolean }) => {
    const reset = Boolean(opts?.reset);
    const nextPage = reset ? 1 : page + 1;
    setDetailsLoading(true);
    try {
      const from = effectiveRange.from.toISOString();
      const to = effectiveRange.to.toISOString();
      const k = kind === 'offline' ? 'offline' : 'online';
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pos/stats/details?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&kind=${encodeURIComponent(k)}&page=${nextPage}&limit=20`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Seller-Token': token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(String(data?.error || `HTTP ${res.status}`));
      const nextRows = (Array.isArray(data?.rows) ? data.rows : []) as SaleDetailsRow[];
      setPage(nextPage);
      setHasMore(Boolean(data?.hasMore));
      setRows((prev) => (reset ? nextRows : [...prev, ...nextRows]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Tarix ro‘yxati yuklanmadi');
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchAllDetailsForExport = async (capRows: number) => {
    const cap = Math.max(100, Math.min(10000, Math.floor(capRows)));
    const out: SaleDetailsRow[] = [];
    let p = 1;
    let more = true;
    while (more && out.length < cap) {
      const from = effectiveRange.from.toISOString();
      const to = effectiveRange.to.toISOString();
      const k = kind === 'offline' ? 'offline' : 'online';
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/pos/stats/details?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&kind=${encodeURIComponent(k)}&page=${p}&limit=100`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Seller-Token': token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(String(data?.error || `HTTP ${res.status}`));
      const batch = (Array.isArray(data?.rows) ? data.rows : []) as SaleDetailsRow[];
      out.push(...batch);
      more = Boolean(data?.hasMore) && batch.length > 0;
      p += 1;
      if (batch.length === 0) break;
    }
    return out.slice(0, cap);
  };

  useEffect(() => {
    if (!token || !shopId) return;
    void fetchStats();
    void fetchDetails({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, shopId, kind, preset, customFrom, customTo]);

  const exportPdf = async () => {
    if (!stats) {
      toast.error('Avval yuklang');
      return;
    }
    try {
      setExporting('pdf');
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text(`Tarix: ${kind === 'offline' ? 'Offline sotuv' : 'Online sotuv'} — ${shopName}`, 40, 48);
      doc.setFontSize(10);
      doc.text(`Oraliq: ${stats.range.from} — ${stats.range.to}`, 40, 68);

      const s = kind === 'offline' ? stats.offline : stats.online;
      const summaryRows =
        kind === 'online'
          ? [
              ['Sotuvlar soni', String(s.count)],
              ['Platforma foydasi (komissiya)', String(s.platformCommissionUzs.toLocaleString('uz-UZ'))],
            ]
          : [
              ['Sotuvlar soni', String(s.count)],
              ['Tushum', String(s.totalUzs.toLocaleString('uz-UZ'))],
              ['Tannarx', String(s.costUzs.toLocaleString('uz-UZ'))],
              ['Sof foyda', String(s.grossProfitUzs.toLocaleString('uz-UZ'))],
            ];

      autoTable(doc, {
        startY: 88,
        head: [['Ko‘rsatkich', 'Qiymat']],
        body: summaryRows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [30, 30, 30] },
      });

      const details = await fetchAllDetailsForExport(800);
      const body = details.map((r) => [
        String(r.id ?? '').slice(-14),
        r.createdAt ? new Date(r.createdAt).toLocaleString('uz-UZ') : '',
        String(r.paymentMethod ?? ''),
        String(money(r?.totals?.totalUzs).toLocaleString('uz-UZ')),
        String(money(r?.totals?.platformCommissionUzs).toLocaleString('uz-UZ')),
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 18 : 240,
        head: [['Chek', 'Vaqt', 'To‘lov', 'Jami', 'Platforma']],
        body,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 30, 30] },
      });

      doc.save(`tarix-${kind}-${Date.now()}.pdf`);
      toast.success('PDF yuklab olindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF xatosi');
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    if (!stats) {
      toast.error('Avval yuklang');
      return;
    }
    try {
      setExporting('excel');
      const [xlsx, details] = await Promise.all([import('xlsx'), fetchAllDetailsForExport(2000)]);
      const XLSX = (xlsx as any).default ?? (xlsx as any);

      const s = kind === 'offline' ? stats.offline : stats.online;
      const summary = [
        ['Do‘kon', shopName],
        ['Turi', kind === 'offline' ? 'Offline sotuv' : 'Online sotuv'],
        ['Oraliq', `${stats.range.from} — ${stats.range.to}`],
        ['Soni', s.count],
        ['Tushum', kind === 'offline' ? s.totalUzs : ''],
        ['Platforma foydasi', s.platformCommissionUzs],
        ['Tannarx', kind === 'offline' ? s.costUzs : ''],
        ['Sof foyda', kind === 'offline' ? s.grossProfitUzs : ''],
      ];
      const sheetSummary = XLSX.utils.aoa_to_sheet(summary);

      const detailRows = details.flatMap((sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        const base = {
          saleId: String(sale.id ?? ''),
          createdAt: sale.createdAt ? new Date(sale.createdAt).toISOString() : '',
          paymentMethod: String(sale.paymentMethod ?? ''),
          totalUzs: money(sale?.totals?.totalUzs),
          platformCommissionUzs: money(sale?.totals?.platformCommissionUzs),
          sellerNetUzs: money(sale?.totals?.sellerNetUzs),
          costUzs: money(sale?.totals?.costUzs),
          grossProfitUzs: money(sale?.totals?.grossProfitUzs),
        };
        if (items.length === 0) return [{ ...base, itemName: '', variant: '', qty: 0, itemTotalUzs: 0 }];
        return items.map((it) => ({
          ...base,
          itemName: String(it?.name ?? ''),
          variant: String(it?.variantLabel ?? ''),
          qty: Math.floor(Number(it?.qty ?? 0)) || 0,
          itemTotalUzs: money(it?.totalUzs),
        }));
      });
      const sheetDetails = XLSX.utils.json_to_sheet(detailRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheetSummary, 'Summary');
      XLSX.utils.book_append_sheet(wb, sheetDetails, 'Sales');
      XLSX.writeFile(wb, `tarix-${kind}-${Date.now()}.xlsx`);
      toast.success('Excel yuklab olindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Excel xatosi');
    } finally {
      setExporting(null);
    }
  };

  const downloadReceiptPdf = async (sale: SaleDetailsRow) => {
    try {
      setExporting('receipt');
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const autoTable = (autoTableMod as any).default ?? (autoTableMod as any);
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      doc.setFontSize(14);
      doc.text(`${shopName} — Chek`, 40, 48);
      doc.setFontSize(10);
      doc.text(`ID: ${String(sale.id ?? '')}`, 40, 66);
      doc.text(`Vaqt: ${sale.createdAt ? new Date(sale.createdAt).toLocaleString('uz-UZ') : ''}`, 40, 82);
      doc.text(`To‘lov: ${String(sale.paymentMethod ?? '')}`, 40, 98);
      doc.text(`Turi: ${sale.kind === 'online' ? 'Online' : 'Offline'}`, 40, 114);

      const items = Array.isArray(sale.items) ? sale.items : [];
      const body = items.map((it) => [
        String(it?.name ?? ''),
        it?.variantLabel ? String(it.variantLabel) : '',
        String(Math.floor(Number(it?.qty ?? 0)) || 0),
        String(money(it?.totalUzs).toLocaleString('uz-UZ')),
      ]);

      autoTable(doc, {
        startY: 136,
        head: [['Mahsulot', 'Variant', 'Soni', 'Summa']],
        body,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 30, 30] },
      });

      const t = sale.totals || {};
      const y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 16 : 520;
      doc.setFontSize(11);
      doc.text(`Jami: ${money(t.totalUzs).toLocaleString('uz-UZ')} so‘m`, 40, y);
      doc.setFontSize(10);
      doc.text(`Chegirma: ${money(t.discountUzs).toLocaleString('uz-UZ')}`, 40, y + 16);
      doc.text(`Platforma: ${money(t.platformCommissionUzs).toLocaleString('uz-UZ')}`, 40, y + 32);
      doc.text(`Sof foyda: ${money(t.grossProfitUzs).toLocaleString('uz-UZ')}`, 40, y + 48);

      doc.save(`chek-${String(sale.id ?? '').slice(-14)}.pdf`);
      toast.success('Chek yuklab olindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chek xatosi');
    } finally {
      setExporting(null);
    }
  };

  const metricCard = useMemo(() => {
    if (!stats) return null;
    const s = kind === 'offline' ? stats.offline : stats.online;
    if (kind === 'online') {
      return (
        <div className="p-5 rounded-3xl border space-y-3" style={cardStyle}>
          <p className="text-xs font-semibold" style={{ opacity: 0.65 }}>
            Online sotuv (platforma foydasi)
          </p>
          <p className="text-2xl font-extrabold tabular-nums">{s.platformCommissionUzs.toLocaleString('uz-UZ')} so‘m</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs" style={{ opacity: 0.65 }}>
                Buyurtma
              </p>
              <p className="font-bold tabular-nums">{s.count}</p>
            </div>
            <div>
              <p className="text-xs" style={{ opacity: 0.65 }}>
                Tushum (informativ)
              </p>
              <p className="font-bold tabular-nums">{s.totalUzs.toLocaleString('uz-UZ')}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="p-5 rounded-3xl border space-y-3" style={cardStyle}>
        <p className="text-xs font-semibold" style={{ opacity: 0.65 }}>
          Offline sotuv (POS)
        </p>
        <p className="text-2xl font-extrabold tabular-nums">{s.totalUzs.toLocaleString('uz-UZ')} so‘m</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs" style={{ opacity: 0.65 }}>
              Chek
            </p>
            <p className="font-bold tabular-nums">{s.count}</p>
          </div>
          <div>
            <p className="text-xs" style={{ opacity: 0.65 }}>
              Platforma
            </p>
            <p className="font-bold tabular-nums">{s.platformCommissionUzs.toLocaleString('uz-UZ')}</p>
          </div>
          <div>
            <p className="text-xs" style={{ opacity: 0.65 }}>
              Tannarx
            </p>
            <p className="font-bold tabular-nums">{s.costUzs.toLocaleString('uz-UZ')}</p>
          </div>
          <div>
            <p className="text-xs" style={{ opacity: 0.65 }}>
              Sof foyda
            </p>
            <p className="font-bold tabular-nums">{s.grossProfitUzs.toLocaleString('uz-UZ')}</p>
          </div>
        </div>
      </div>
    );
  }, [stats, kind, cardStyle]);

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div
        className="p-6 rounded-3xl border"
        style={{
          background: isDark ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)` : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
          borderColor: `${accentColor.color}33`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <ReceiptText className="w-6 h-6" />
              Tarix
            </h3>
            <p style={{ opacity: 0.75 }}>Offline/Online sotuvlar tarixi. Sotuv ustiga bosing — to‘liq ma’lumot ochiladi.</p>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {([
              { id: 'offline', label: 'Offline sotuv' },
              { id: 'online', label: 'Online sotuv' },
            ] as const).map((k) => {
              const on = kind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setKind(k.id);
                    setRows([]);
                    setPage(1);
                    setHasMore(false);
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
          <button
            type="button"
            onClick={() => {
              void fetchStats();
              void fetchDetails({ reset: true });
            }}
            disabled={loading || detailsLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-white transition active:scale-95 disabled:opacity-55"
            style={{ background: accentColor.gradient }}
          >
            {loading || detailsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Yangilash
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'lastHour', label: 'Soat' },
              { id: 'today', label: 'Kun' },
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
      </div>

      {metricCard}

      <div className="rounded-3xl border p-4 space-y-3" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold">Sotuvlar tarixi</p>
            <p className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
              Har bir sotuv: vaqt, to‘lov, chek summasi, mahsulotlar. Bosganda to‘liq ochiladi.
            </p>
          </div>
        </div>

        {rows.length === 0 && detailsLoading ? (
          <div className="py-8 text-center text-sm" style={{ opacity: 0.75 }}>
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
            Yuklanmoqda...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm" style={{ opacity: 0.75 }}>
            Bu oraliqda sotuv topilmadi.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <button
                key={`${r.kind}-${r.id}-${r.createdAt}`}
                type="button"
                onClick={() => setSelected(r)}
                className="w-full text-left rounded-3xl border p-3 max-w-full overflow-x-hidden transition active:scale-[0.99]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl border overflow-hidden shrink-0"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    }}
                  >
                    {String((Array.isArray(r.items) ? r.items[0]?.image : '') || '').trim() ? (
                      <img
                        src={String((r.items as any)?.[0]?.image)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ opacity: 0.55 }}>
                        {kind === 'offline' ? 'POS' : 'ON'}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold truncate">
                          #{String(r.id || '').slice(-10)}
                        </div>
                        <div className="text-xs mt-0.5" style={{ opacity: 0.7 }}>
                          {r.createdAt ? new Date(r.createdAt).toLocaleString('uz-UZ') : ''}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                              opacity: 0.95,
                            }}
                          >
                            {r.paymentMethod ? `To‘lov: ${r.paymentMethod}` : 'To‘lov: —'}
                          </span>
                          <span
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                            style={{ background: `${accentColor.color}22`, color: accentColor.color }}
                          >
                            Platforma: {money(r?.totals?.platformCommissionUzs).toLocaleString('uz-UZ')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold tabular-nums" style={{ color: accentColor.color }}>
                          {money(r?.totals?.totalUzs).toLocaleString('uz-UZ')} so‘m
                        </div>
                        {kind === 'offline' ? (
                          <div className="text-[11px]" style={{ opacity: 0.7 }}>
                            Sof foyda: {money(r?.totals?.grossProfitUzs).toLocaleString('uz-UZ')}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="truncate">
                        <span style={{ opacity: 0.7 }}>Mahsulot:</span>{' '}
                        <span className="font-semibold">
                          {String((Array.isArray(r.items) ? r.items[0]?.name : '') || '—')}
                        </span>
                      </div>
                      <div className="tabular-nums">
                        <span style={{ opacity: 0.7 }}>Pozitsiya:</span>{' '}
                        <span className="font-semibold">{Array.isArray(r.items) ? r.items.length : 0}</span>
                      </div>
                      <div className="tabular-nums">
                        <span style={{ opacity: 0.7 }}>Chegirma:</span>{' '}
                        <span className="font-semibold">{money(r?.totals?.discountUzs).toLocaleString('uz-UZ')}</span>
                      </div>
                      <div className="tabular-nums">
                        <span style={{ opacity: 0.7 }}>Seller net:</span>{' '}
                        <span className="font-semibold">{money(r?.totals?.sellerNetUzs).toLocaleString('uz-UZ')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  {(Array.isArray(r.items) ? r.items : []).slice(0, 3).map((it, idx) => (
                    <div key={`${r.id}-it-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold truncate block max-w-full">
                          {String(it?.name || 'Mahsulot')}
                          {it?.variantLabel ? ` (${String(it.variantLabel)})` : ''}
                        </span>
                        <span style={{ opacity: 0.7 }}> · {Math.floor(Number(it?.qty ?? 0)) || 0} ta</span>
                      </div>
                      <div className="tabular-nums" style={{ opacity: 0.85 }}>
                        {money(it?.totalUzs).toLocaleString('uz-UZ')}
                      </div>
                    </div>
                  ))}
                  {Array.isArray(r.items) && r.items.length > 3 ? (
                    <div className="text-xs" style={{ opacity: 0.7 }}>
                      +{r.items.length - 3} ta yana...
                    </div>
                  ) : null}
                </div>
              </button>
            ))}

            <div className="flex items-center justify-center pt-2">
              {hasMore ? (
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

      {selected ? (
        <div className="fixed inset-0 app-safe-pad z-[120] flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0"
            style={{
              background: isDark ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.50)',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            }}
            onClick={() => setSelected(null)}
          />
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-4 sm:p-5"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
              background: isDark ? '#0b0b0b' : '#ffffff',
              boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.75)' : '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-extrabold truncate">Chek · #{String(selected.id || '').slice(-14)}</div>
                <div className="text-xs mt-1" style={{ opacity: 0.75 }}>
                  {selected.createdAt ? new Date(selected.createdAt).toLocaleString('uz-UZ') : ''} · To‘lov: {String(selected.paymentMethod ?? '')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-xl border transition active:scale-95"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { label: 'Subtotal', value: money(selected?.totals?.subtotalUzs).toLocaleString('uz-UZ') },
                { label: 'Chegirma', value: money(selected?.totals?.discountUzs).toLocaleString('uz-UZ') },
                { label: 'Jami', value: money(selected?.totals?.totalUzs).toLocaleString('uz-UZ') },
                { label: 'Platforma', value: money(selected?.totals?.platformCommissionUzs).toLocaleString('uz-UZ') },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ opacity: 0.7 }}>{m.label}</div>
                  <div className="font-extrabold tabular-nums truncate">{m.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border overflow-hidden" style={{ borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }}>
              <div className="px-4 py-3 font-bold" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                Sotilgan mahsulotlar
              </div>
              <div className="p-3 space-y-2">
                {(Array.isArray(selected.items) ? selected.items : []).map((it, idx) => (
                  <div key={`${selected.id}-full-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                    <div
                      className="w-12 h-12 rounded-xl border overflow-hidden shrink-0"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      }}
                    >
                      {String(it?.image || '').trim() ? (
                        <img src={String(it.image)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">
                        {String(it?.name || 'Mahsulot')}
                        {it?.variantLabel ? ` (${String(it.variantLabel)})` : ''}
                      </div>
                      <div className="text-xs mt-0.5" style={{ opacity: 0.75 }}>
                        {Math.floor(Number(it?.qty ?? 0)) || 0} ta · Narx: {money(it?.priceUzs).toLocaleString('uz-UZ')}
                      </div>
                    </div>
                    <div className="shrink-0 font-extrabold tabular-nums" style={{ color: accentColor.color }}>
                      {money(it?.totalUzs).toLocaleString('uz-UZ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void downloadReceiptPdf(selected)}
                disabled={exporting !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-white transition active:scale-95 disabled:opacity-60"
                style={{ background: accentColor.gradient }}
              >
                {exporting === 'receipt' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Chek (PDF)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

