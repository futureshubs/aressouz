import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { edgeFunctionBaseUrl } from '../../utils/edgeFunctionBaseUrl';
import { buildBranchHeaders, getStoredBranchToken } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  BarChart3,
  Loader2,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

type CashierStats = {
  receivePending: number;
  receivePendingUzs: number;
  receiveTodayCount: number;
  receiveTodayUzs: number;
  receiveTotalCount: number;
  receiveTotalUzs: number;
  sendPending: number;
  sendPendingUzs: number;
  sendTodayCount: number;
  sendTodayUzs: number;
  sendTotalCount: number;
  sendTotalUzs: number;
  collectPending: number;
  collectPendingUzs: number;
  collectTodayCount: number;
  collectTodayUzs: number;
  collectTotalCount: number;
  collectTotalUzs: number;
  salaryPending: number;
  salaryPendingUzs: number;
  salaryPaidTodayCount: number;
  salaryPaidTodayUzs: number;
  salaryPaidTotalCount: number;
  salaryPaidTotalUzs: number;
  todayInflowUzs: number;
  todayOutflowUzs: number;
  todayNetUzs: number;
};

type Props = { branchId: string };

type StatRow = { label: string; count: number; amount: number };

function StatBlock({
  rows,
  color,
  border,
  muted,
}: {
  rows: StatRow[];
  color: string;
  border: string;
  muted: string;
}) {
  const money = (n: number) => `${Math.round(Number(n || 0)).toLocaleString('uz-UZ')} so‘m`;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
          style={{ background: `${color}0c` }}
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold" style={{ color: muted }}>
              {row.label}
            </div>
            <div className="text-sm font-bold tabular-nums truncate" style={{ color }}>
              {money(row.amount)}
            </div>
          </div>
          <span
            className="shrink-0 text-xs font-bold px-2 py-1 rounded-full tabular-nums"
            style={{ background: `${color}18`, color }}
          >
            {row.count} ta
          </span>
        </div>
      ))}
    </div>
  );
}

export function CashierStatisticsPanel({ branchId }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl = edgeFunctionBaseUrl();
  const tick = useVisibilityTick();

  const [stats, setStats] = useState<CashierStats | null>(null);
  const [loading, setLoading] = useState(true);

  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const surface = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const muted = isDark ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.55)';

  const load = useCallback(async () => {
    const token = getStoredBranchToken();
    if (!token) {
      setStats(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ branchToken: token });
      const res = await fetch(`${apiBaseUrl}/branch/cashier/stats?${params}`, {
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Statistikani olishda xatolik');
      }
      setStats(data.stats as CashierStats);
    } catch (e) {
      console.error(e);
      toast.error('Statistikani yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load, tick, branchId]);

  const money = (n: number) => `${Math.round(Number(n || 0)).toLocaleString('uz-UZ')} so‘m`;
  const s = stats;

  const sections = [
    {
      icon: ArrowDownToLine,
      label: 'Qabul qilish',
      hint: 'Kuryerdan naqd topshiruv',
      color: '#22c55e',
      rows: [
        { label: 'Kutilmoqda', count: s?.receivePending ?? 0, amount: s?.receivePendingUzs ?? 0 },
        { label: 'Bugun qabul qilindi', count: s?.receiveTodayCount ?? 0, amount: s?.receiveTodayUzs ?? 0 },
        { label: 'Jami qabul qilindi', count: s?.receiveTotalCount ?? 0, amount: s?.receiveTotalUzs ?? 0 },
      ],
    },
    {
      icon: ArrowUpFromLine,
      label: 'Yuborish',
      hint: 'Do‘kon / taomga to‘lov',
      color: accentColor.color,
      rows: [
        { label: 'Kutilmoqda', count: s?.sendPending ?? 0, amount: s?.sendPendingUzs ?? 0 },
        { label: 'Bugun yuborildi', count: s?.sendTodayCount ?? 0, amount: s?.sendTodayUzs ?? 0 },
        { label: 'Jami yuborildi', count: s?.sendTotalCount ?? 0, amount: s?.sendTotalUzs ?? 0 },
      ],
    },
    {
      icon: RotateCcw,
      label: 'Olish kerak',
      hint: 'Bekor — tadbirkordan qaytarish',
      color: '#f59e0b',
      rows: [
        { label: 'Kutilmoqda', count: s?.collectPending ?? 0, amount: s?.collectPendingUzs ?? 0 },
        { label: 'Bugun olindi', count: s?.collectTodayCount ?? 0, amount: s?.collectTodayUzs ?? 0 },
        { label: 'Jami olindi', count: s?.collectTotalCount ?? 0, amount: s?.collectTotalUzs ?? 0 },
      ],
    },
    {
      icon: Wallet,
      label: 'Oylik',
      hint: 'Kuryer pul arizalari',
      color: '#3b82f6',
      rows: [
        { label: 'Kutilmoqda', count: s?.salaryPending ?? 0, amount: s?.salaryPendingUzs ?? 0 },
        { label: 'Bugun to‘landi', count: s?.salaryPaidTodayCount ?? 0, amount: s?.salaryPaidTodayUzs ?? 0 },
        { label: 'Jami to‘landi', count: s?.salaryPaidTotalCount ?? 0, amount: s?.salaryPaidTotalUzs ?? 0 },
      ],
    },
  ];

  const summaryCards = [
    {
      icon: ArrowDownLeft,
      label: 'Bugun kirim',
      sub: 'Qabul + qaytarib olish',
      amount: s?.todayInflowUzs ?? 0,
      color: '#22c55e',
    },
    {
      icon: ArrowUpRight,
      label: 'Bugun chiqim',
      sub: 'Yuborish + oylik',
      amount: s?.todayOutflowUzs ?? 0,
      color: '#ef4444',
    },
    {
      icon: TrendingUp,
      label: 'Bugun farq',
      sub: 'Kirim − chiqim',
      amount: s?.todayNetUzs ?? 0,
      color: (s?.todayNetUzs ?? 0) >= 0 ? accentColor.color : '#ef4444',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: accentColor.color }} />
            Statistika va analitika
          </div>
          <p className="text-sm mt-1" style={{ color: muted }}>
            Kutilmoqda, bugun va jami — barcha bo‘limlar
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-3 py-2 rounded-2xl border text-sm font-semibold inline-flex items-center gap-2"
          style={{ borderColor: border, background: surface }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </div>

      {loading && !stats ? (
        <div className="flex items-center gap-2 text-sm py-8" style={{ color: muted }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Yuklanmoqda...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {summaryCards.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: border, background: surface }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="p-2 rounded-xl"
                      style={{ background: `${c.color}18`, color: c.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{c.label}</div>
                      <div className="text-[11px]" style={{ color: muted }}>
                        {c.sub}
                      </div>
                    </div>
                  </div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: c.color }}>
                    {money(c.amount)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sections.map((sec) => {
              const Icon = sec.icon;
              return (
                <div
                  key={sec.label}
                  className="rounded-3xl border p-5 space-y-4"
                  style={{ borderColor: border, background: surface }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2.5 rounded-2xl shrink-0"
                      style={{ background: `${sec.color}18`, color: sec.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-base">{sec.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: muted }}>
                        {sec.hint}
                      </div>
                    </div>
                  </div>
                  <StatBlock rows={sec.rows} color={sec.color} border={border} muted={muted} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
