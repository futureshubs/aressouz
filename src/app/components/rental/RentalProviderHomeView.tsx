import { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  Package,
  Clock,
  DollarSign,
  TrendingUp,
  MapPin,
  Store,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { projectId } from '../../../../utils/supabase/info';
import { buildRentalPanelHeaders } from '../../utils/requestAuth';
import { edgeFunctionBaseUrl } from '../../utils/edgeFunctionBaseUrl';
import { toast } from 'sonner';

type Props = {
  branchId: string;
};

export function RentalProviderHomeView({ branchId }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBase = edgeFunctionBaseUrl();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [hours, setHours] = useState<{ open?: boolean; label?: string | null } | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [meRes, statsRes] = await Promise.all([
          fetch(`${apiBase}/rentals/provider/me`, { headers: buildRentalPanelHeaders() }),
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/statistics/${encodeURIComponent(branchId)}`,
            { headers: buildRentalPanelHeaders() },
          ),
        ]);
        const meData = await meRes.json().catch(() => ({}));
        const statsData = await statsRes.json().catch(() => ({}));
        if (cancelled) return;
        if (meRes.ok && meData.success) {
          setProfile(meData.provider);
          setHours(meData.hours || null);
        }
        if (statsRes.ok && statsData.success) {
          setStatistics(statsData.statistics);
        }
      } catch {
        if (!cancelled) toast.error('Dashboard yuklanmadi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, apiBase]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: accentColor.color }} />
      </div>
    );
  }

  const openNow = hours?.open !== false;
  const cards = [
    {
      icon: Package,
      label: 'Mahsulotlar',
      value: statistics?.totalProducts ?? '—',
      sub: `${statistics?.activeProducts ?? 0} faol`,
    },
    {
      icon: Clock,
      label: 'Faol ijaralar',
      value: statistics?.activeRentals ?? '—',
      sub: `${statistics?.totalOrders ?? 0} jami buyurtma`,
    },
    {
      icon: DollarSign,
      label: 'Daromad (tugallangan)',
      value:
        statistics?.totalRevenue != null
          ? `${Number(statistics.totalRevenue).toLocaleString('uz-UZ')} so‘m`
          : '—',
      sub: 'Platforma komissiyasidan keyin',
    },
    {
      icon: TrendingUp,
      label: 'Tugallangan',
      value: statistics?.completedRentals ?? '—',
      sub: `${statistics?.cancelledRentals ?? 0} bekor`,
    },
  ];

  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm mt-1 opacity-60">Ijara beruvchi paneli — qisqa ko‘rinish</p>
      </div>

      {profile ? (
        <div
          className="rounded-2xl p-5 border space-y-3"
          style={{ borderColor: border, background: cardBg }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold flex items-center gap-2">
                <Store className="w-5 h-5" style={{ color: accentColor.color }} />
                {profile.shopName || profile.displayName}
              </p>
              <p className="text-sm opacity-60 mt-0.5">
                {profile.firstName} {profile.lastName} · @{profile.login}
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: openNow ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                color: openNow ? '#22c55e' : '#ef4444',
              }}
            >
              {openNow ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {openNow ? 'Ochiq' : 'Yopiq'}
            </span>
          </div>
          {profile.workTime ? (
            <p className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 opacity-50" />
              Ochilish vaqti: <strong>{profile.workTime}</strong>
            </p>
          ) : null}
          {profile.latitude != null && profile.longitude != null ? (
            <p className="text-sm flex items-center gap-2 opacity-70">
              <MapPin className="w-4 h-4" />
              {Number(profile.latitude).toFixed(5)}, {Number(profile.longitude).toFixed(5)}
            </p>
          ) : null}
          {!openNow && hours?.label ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Ish vaqtidan tashqarida mijoz buyurtma bera olmaydi.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-2xl p-5 border"
              style={{ borderColor: border, background: cardBg }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: `${accentColor.color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color: accentColor.color }} />
                </div>
                <span className="text-sm font-medium opacity-70">{c.label}</span>
              </div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs mt-1 opacity-50">{c.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
