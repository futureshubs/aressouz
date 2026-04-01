import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../context/ThemeContext';
import {
  TrendingUp,
  BarChart3,
  Activity,
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  Clock,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  Target,
  Zap,
  Award,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface StatisticsData {
  overview: {
    totalRevenue: number;
    totalOrders: number;
    totalCustomers?: number;
    averageOrderValue: number;
    conversionRate: number;
    customerRetention: number;
    operatingCosts: number;
    netProfit: number;
    profitMargin: number;
  };
  changes: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    conversionRate: number;
    customerRetention: number;
    operatingCosts: number;
    netProfit: number;
    profitMargin: number;
  };
  trends: {
    revenue: Array<{ date: string; value: number; change: number }>;
    orders: Array<{ date: string; value: number; change: number }>;
    customers: Array<{ date: string; value: number; change: number }>;
  };
  performance: {
    topProducts: Array<{ name: string; revenue: number; orders: number; rating: number }>;
    peakHours: Array<{ hour: number; orders: number; revenue: number }>;
    deliveryTimes: Array<{ period: string; avgTime: number; target: number }>;
    customerSatisfaction: Array<{ metric: string; score: number; target: number }>;
  };
  comparisons: {
    lastMonth: { revenue: number; orders: number; customers: number };
    lastQuarter: { revenue: number; orders: number; customers: number };
    lastYear: { revenue: number; orders: number; customers: number };
  };
}

interface StatisticsProps {
  branchId: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

function branchApiBase(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return DEV_API_BASE_URL;
  }
  return API_BASE_URL;
}

const createFallbackStatisticsData = (): StatisticsData => ({
  overview: {
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    customerRetention: 0,
    operatingCosts: 0,
    netProfit: 0,
    profitMargin: 0,
  },
  changes: {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    customerRetention: 0,
    operatingCosts: 0,
    netProfit: 0,
    profitMargin: 0,
  },
  trends: {
    revenue: [],
    orders: [],
    customers: [],
  },
  performance: {
    topProducts: [],
    peakHours: [],
    deliveryTimes: [],
    customerSatisfaction: [],
  },
  comparisons: {
    lastMonth: { revenue: 0, orders: 0, customers: 0 },
    lastQuarter: { revenue: 0, orders: 0, customers: 0 },
    lastYear: { revenue: 0, orders: 0, customers: 0 },
  },
});

const normalizeTrendItems = (items: any[] | undefined) =>
  Array.isArray(items)
    ? items.map((item) => ({
        date: item?.date || '',
        value: Number(item?.value) || 0,
        change: Number(item?.change) || 0,
      }))
    : [];

const normalizeStatisticsData = (raw: any): StatisticsData => {
  const fallback = createFallbackStatisticsData();
  const overview = raw?.overview || {};
  const changes = raw?.changes || {};
  const performance = raw?.performance || {};
  const comparisons = raw?.comparisons || {};

  const totalRevenue = Number(overview.totalRevenue) || 0;
  const totalOrders = Number(overview.totalOrders) || 0;
  const totalCustomers =
    Number(overview.totalCustomers) ||
    normalizeTrendItems(raw?.trends?.customers).slice(-1)[0]?.value ||
    0;
  const averageOrderValue =
    Number(overview.averageOrderValue) ||
    Number(overview.avgOrderValue) ||
    (totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0);
  const customerRetention =
    Number(overview.customerRetention) ||
    Number(performance.customerRetention) ||
    0;
  const operatingCosts = Number(overview.operatingCosts) || 0;
  const netProfit = Number(overview.netProfit) || Math.max(totalRevenue - operatingCosts, 0);
  const profitMargin =
    Number(overview.profitMargin) ||
    (totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0);

  return {
    overview: {
      totalRevenue,
      totalOrders,
      totalCustomers,
      averageOrderValue,
      conversionRate: Number(overview.conversionRate) || Number(performance.conversionRate) || 0,
      customerRetention,
      operatingCosts,
      netProfit,
      profitMargin,
    },
    changes: {
      totalRevenue: Number(changes.totalRevenue) || 0,
      totalOrders: Number(changes.totalOrders) || 0,
      averageOrderValue: Number(changes.averageOrderValue) || 0,
      conversionRate: Number(changes.conversionRate) || 0,
      customerRetention: Number(changes.customerRetention) || 0,
      operatingCosts: Number(changes.operatingCosts) || 0,
      netProfit: Number(changes.netProfit) || 0,
      profitMargin: Number(changes.profitMargin) || 0,
    },
    trends: {
      revenue: normalizeTrendItems(raw?.trends?.revenue),
      orders: normalizeTrendItems(raw?.trends?.orders),
      customers: normalizeTrendItems(raw?.trends?.customers),
    },
    performance: {
      topProducts: Array.isArray(performance.topProducts) ? performance.topProducts : fallback.performance.topProducts,
      peakHours: Array.isArray(performance.peakHours) ? performance.peakHours : fallback.performance.peakHours,
      deliveryTimes: Array.isArray(performance.deliveryTimes) ? performance.deliveryTimes : fallback.performance.deliveryTimes,
      customerSatisfaction: Array.isArray(performance.customerSatisfaction)
        ? performance.customerSatisfaction
        : fallback.performance.customerSatisfaction,
    },
    comparisons: {
      lastMonth: comparisons.lastMonth || fallback.comparisons.lastMonth,
      lastQuarter: comparisons.lastQuarter || fallback.comparisons.lastQuarter,
      lastYear: comparisons.lastYear || fallback.comparisons.lastYear,
    },
  };
};

export function Statistics({ branchId, branchInfo }: StatisticsProps) {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [statisticsData, setStatisticsData] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const visibilityRefetchTick = useVisibilityTick();

  const loadStatistics = async () => {
    try {
      setIsLoading(true);
      setStatisticsData(null);

      const params = new URLSearchParams({ period });

      const response = await fetch(`${branchApiBase()}/statistics?${params}`, {
        headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('branchSession');
        toast.error('Sessiya tugadi. Qayta kiring.');
        navigate('/filyal');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Statistika ma\'lumotlarini yuklab bo\'lmadi');
      }

      const data = await response.json();
      if (data.success) {
        setStatisticsData(normalizeStatisticsData(data.data));
      } else {
        throw new Error(data.error || 'Statistika ma\'lumotlari olinmadi');
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      setStatisticsData(null);
      toast.error('Statistika ma\'lumotlarini yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatistics();
  }, [branchId, period, visibilityRefetchTick]);

  const peakMaxOrders = useMemo(() => {
    if (!statisticsData?.performance.peakHours.length) return 1;
    return Math.max(...statisticsData.performance.peakHours.map((h) => h.orders), 1);
  }, [statisticsData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (minutes: number) => {
    return `${minutes} daqiqa`;
  };

  const surfaceStyle = {
    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
  };

  const MetricCard = ({
    title,
    value,
    subtitle,
    change,
    icon: Icon,
    format = 'number',
  }: {
    title: string;
    value: number;
    subtitle?: string;
    change?: number;
    icon: LucideIcon;
    format?: 'number' | 'currency' | 'percentage' | 'time';
  }) => {
    let formattedValue: string;
    switch (format) {
      case 'currency':
        formattedValue = formatCurrency(value);
        break;
      case 'percentage':
        formattedValue = `${value}%`;
        break;
      case 'time':
        formattedValue = formatTime(value);
        break;
      default:
        formattedValue = value.toLocaleString();
    }

    return (
      <div 
        className="p-6 rounded-2xl border transition-all hover:shadow-lg"
        style={surfaceStyle}
      >
        <div className="flex items-center justify-between mb-4">
          <div 
            className="p-3 rounded-xl"
            style={{ background: `${accentColor.color}20` }}
          >
            <Icon className="w-6 h-6" style={{ color: accentColor.color }} />
          </div>
          {change !== undefined && (
            <div
              className="flex items-center gap-1 text-sm font-medium"
              style={{ color: change > 0 ? accentColor.color : change < 0 ? '#ef4444' : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)') }}
            >
              {change > 0 ? <ArrowUp className="w-4 h-4" /> : change < 0 ? <ArrowDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <h3 className="text-sm font-medium mb-1" style={{ 
          color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' 
        }}>
          {title}
        </h3>
        <p className="text-2xl font-bold">{formattedValue}</p>
        {subtitle && (
          <p className="text-sm mt-1" style={{ 
            color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' 
          }}>
            {subtitle}
          </p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: accentColor.color }} />
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Statistika ma\'lumotlari yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  if (!statisticsData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor.color }} />
          <h3 className="text-xl font-bold mb-2">Statistika ma\'lumotlari yo\'q</h3>
          <button
            onClick={loadStatistics}
            className="px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              background: accentColor.gradient,
              color: '#ffffff'
            }}
          >
            Qayta yuklash
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Statistika</h1>
          <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Umumiy ko‘rsatkichlar, soatlar bo‘yicha yuklama va taqqoslash
            {branchInfo?.region ? ` — ${branchInfo.region}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 rounded-xl border outline-none"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <option value="week">Oxirgi hafta</option>
            <option value="month">Oxirgi oy</option>
            <option value="quarter">Oxirgi chorak</option>
            <option value="year">Oxirgi yil</option>
          </select>
          <button
            onClick={loadStatistics}
            className="p-2 rounded-xl border transition-all hover:shadow-lg"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-6 h-6" style={{ color: accentColor.color }} />
          Umumiy ko'rsatkichlar
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Jami daromad"
            value={statisticsData.overview.totalRevenue}
            change={statisticsData.changes.totalRevenue}
            icon={DollarSign}
            format="currency"
          />
          <MetricCard
            title="Jami buyurtmalar"
            value={statisticsData.overview.totalOrders}
            change={statisticsData.changes.totalOrders}
            icon={ShoppingCart}
          />
          <MetricCard
            title="O'rtacha buyurtma qiymati"
            value={statisticsData.overview.averageOrderValue}
            change={statisticsData.changes.averageOrderValue}
            icon={Target}
            format="currency"
          />
          <MetricCard
            title="Konversiya darajasi"
            value={statisticsData.overview.conversionRate}
            change={statisticsData.changes.conversionRate}
            icon={TrendingUp}
            format="percentage"
          />
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Award className="w-6 h-6" style={{ color: accentColor.color }} />
          Samaradorlik ko'rsatkichlari
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Mijozlar saqlanishi"
            value={statisticsData.overview.customerRetention}
            change={statisticsData.changes.customerRetention}
            icon={Users}
            format="percentage"
          />
          <MetricCard
            title="Toza foyda"
            value={statisticsData.overview.netProfit}
            change={statisticsData.changes.netProfit}
            icon={Zap}
            format="currency"
          />
          <MetricCard
            title="Foyda marjasi"
            value={statisticsData.overview.profitMargin}
            change={statisticsData.changes.profitMargin}
            icon={TrendingUp}
            format="percentage"
          />
          <MetricCard
            title="Operatsion xarajatlar"
            value={statisticsData.overview.operatingCosts}
            change={statisticsData.changes.operatingCosts}
            icon={Package}
            format="currency"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border" style={surfaceStyle}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" style={{ color: accentColor.color }} />
            Eng gavjim soatlar
          </h3>
          {statisticsData.performance.peakHours.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Ma’lumot yo‘q</p>
          ) : (
            <div className="space-y-3">
              {statisticsData.performance.peakHours.map((hour, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                    >
                      {hour.hour}:00
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{hour.orders} buyurtma</p>
                      <p
                        className="text-sm truncate"
                        style={{
                          color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                        }}
                      >
                        {formatCurrency(hour.revenue)}
                      </p>
                    </div>
                  </div>
                  <div className="w-20 h-2 rounded-full overflow-hidden shrink-0 ml-2"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(hour.orders / peakMaxOrders) * 100}%`,
                        background: accentColor.gradient,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl border" style={surfaceStyle}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" style={{ color: accentColor.color }} />
            Yetkazib berish vaqti (o‘rtacha)
          </h3>
          {statisticsData.performance.deliveryTimes.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Yakunlangan buyurtmalar bo‘yicha vaqt hisobi yo‘q
            </p>
          ) : (
            <div className="space-y-3">
              {statisticsData.performance.deliveryTimes.map((row, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <span className="font-medium">{row.period}</span>
                  <span className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>
                    {formatTime(row.avgTime)}
                    {row.target != null && row.target !== row.avgTime ? (
                      <span className="opacity-70"> · oldingi: {formatTime(row.target)}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 rounded-2xl border" style={surfaceStyle}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5" style={{ color: accentColor.color }} />
          Mijozlar qoniqishi (hisoblangan ko‘rsatkichlar)
        </h3>
        {statisticsData.performance.customerSatisfaction.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Reyting va takroriy buyurtmalar bo‘yicha ma’lumot yetarli emas
          </p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statisticsData.performance.customerSatisfaction.map((metric, index) => (
            <div key={index} className="text-center p-4 rounded-xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              }}
            >
              <p className="font-medium mb-2">{metric.metric}</p>
              <p className="text-2xl font-bold mb-1" style={{ color: accentColor.color }}>
                {metric.score}
              </p>
              <div className="flex items-center justify-center gap-1 text-sm">
                <span>Nishon:</span>
                <span style={{ color: accentColor.color }}>{metric.target}</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden mt-2"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div 
                  className="h-full rounded-full"
                  style={{
                    width: `${(metric.score / 5) * 100}%`,
                    background: metric.score >= metric.target ? accentColor.gradient : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Comparisons */}
      <div 
        className="p-6 rounded-2xl border"
        style={surfaceStyle}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" style={{ color: accentColor.color }} />
          Taqqoslash
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="font-medium mb-3">O'tgan oy</p>
            <div className="space-y-2">
              <p className="text-sm">{formatCurrency(statisticsData.comparisons.lastMonth.revenue)}</p>
              <p className="text-sm">{statisticsData.comparisons.lastMonth.orders} buyurtma</p>
              <p className="text-sm">{statisticsData.comparisons.lastMonth.customers} mijoz</p>
            </div>
          </div>
          <div className="text-center">
            <p className="font-medium mb-3">O'tgan chorak</p>
            <div className="space-y-2">
              <p className="text-sm">{formatCurrency(statisticsData.comparisons.lastQuarter.revenue)}</p>
              <p className="text-sm">{statisticsData.comparisons.lastQuarter.orders} buyurtma</p>
              <p className="text-sm">{statisticsData.comparisons.lastQuarter.customers} mijoz</p>
            </div>
          </div>
          <div className="text-center">
            <p className="font-medium mb-3">O'tgan yil</p>
            <div className="space-y-2">
              <p className="text-sm">{formatCurrency(statisticsData.comparisons.lastYear.revenue)}</p>
              <p className="text-sm">{statisticsData.comparisons.lastYear.orders} buyurtma</p>
              <p className="text-sm">{statisticsData.comparisons.lastYear.customers} mijoz</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
