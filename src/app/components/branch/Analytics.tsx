import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../context/ThemeContext';
import {
  BarChart3,
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Percent,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface DailyStats {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
}

interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
}

interface CategoryStats {
  category: string;
  revenue: number;
  orders: number;
  percentage: number;
}

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  revenueGrowth: number;
  ordersGrowth: number;
  customersGrowth: number;
  topProducts: TopProduct[];
  dailyStats: DailyStats[];
  categoryStats: CategoryStats[];
  /** KV ijara: yakunlangan buyurtmalar, tanlangan davr */
  rentalCompletedRevenue: number;
  rentalPlatformCommission: number;
  rentalBranchNet: number;
  rentalCompletedCount: number;
  rentalPlatformCommissionGrowth: number;
}

interface AnalyticsCategoryOption {
  id: string;
  label: string;
}

interface AnalyticsProps {
  branchId: string;
  /** Filial analytics: `food` — faqat taom/restoran buyurtmalari (KV `orderType: food`) */
  orderType?: 'all' | 'food' | 'market' | 'shop' | 'rental';
}

function branchApiBase(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return DEV_API_BASE_URL;
  }
  return API_BASE_URL;
}

export default function Analytics({ branchId, orderType = 'all' }: AnalyticsProps) {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<AnalyticsCategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const visibilityRefetchTick = useVisibilityTick();

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setAnalyticsData(null);
      const params = new URLSearchParams({
        dateRange,
        category: selectedCategory,
      });
      if (orderType && orderType !== 'all') {
        params.set('orderType', orderType);
      }

      const response = await fetch(`${branchApiBase()}/analytics?${params}`, {
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
        throw new Error(errorText || 'Analitika ma\'lumotlarini yuklab bo\'lmadi');
      }

      const data = await response.json();
      if (data.success) {
        setAnalyticsData({
          totalRevenue: Number(data.data?.totalRevenue || 0),
          totalOrders: Number(data.data?.totalOrders || 0),
          totalCustomers: Number(data.data?.totalCustomers || 0),
          totalProducts: Number(data.data?.totalProducts || 0),
          revenueGrowth: Number(data.data?.revenueGrowth || 0),
          ordersGrowth: Number(data.data?.ordersGrowth || 0),
          customersGrowth: Number(data.data?.customersGrowth || 0),
          topProducts: Array.isArray(data.data?.topProducts) ? data.data.topProducts : [],
          dailyStats: Array.isArray(data.data?.dailyStats) ? data.data.dailyStats : [],
          categoryStats: Array.isArray(data.data?.categoryStats) ? data.data.categoryStats : [],
          rentalCompletedRevenue: Number(data.data?.rentalCompletedRevenue || 0),
          rentalPlatformCommission: Number(data.data?.rentalPlatformCommission || 0),
          rentalBranchNet: Number(data.data?.rentalBranchNet || 0),
          rentalCompletedCount: Number(data.data?.rentalCompletedCount || 0),
          rentalPlatformCommissionGrowth: Number(data.data?.rentalPlatformCommissionGrowth || 0),
        });
        setCategoryOptions(Array.isArray(data.categories) ? data.categories : []);
      } else {
        throw new Error(data.error || 'Analitika ma\'lumotlari olinmadi');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setCategoryOptions([]);
      setAnalyticsData(null);
      toast.error('Analitika ma\'lumotlarini yuklab bo\'lmadi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [branchId, dateRange, selectedCategory, orderType, visibilityRefetchTick]);

  useEffect(() => {
    if (selectedCategory === 'all') return;
    const hasSelectedCategory = categoryOptions.some((option) => option.id === selectedCategory);
    if (!hasSelectedCategory) setSelectedCategory('all');
  }, [categoryOptions, selectedCategory]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const surfaceStyle = {
    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
  };

  const StatCard = ({
    title,
    value,
    change,
    icon: Icon,
  }: {
    title: string;
    value: string | number;
    change?: number;
    icon: LucideIcon;
  }) => (
    <div className="p-6 rounded-2xl border transition-all hover:shadow-lg" style={surfaceStyle}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{title}</p>
          <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
          {change !== undefined && (
            <div
              className="flex items-center mt-2 text-sm"
              style={{ color: change >= 0 ? accentColor.color : '#ef4444' }}
            >
              {change >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <div className="p-3 rounded-xl" style={{ background: `${accentColor.color}20` }}>
          <Icon className="w-6 h-6" style={{ color: accentColor.color }} />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: accentColor.color }} />
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Analitika yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.6 }} />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Ma&apos;lumot topilmadi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {orderType === 'food' ? 'Taomlar — data analitika' : 'Data analitika'}
          </h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {orderType === 'food'
              ? 'Faqat taom buyurtmalari — tanlangan davr va qatorlar bo‘yicha (filial sessiyasi)'
              : 'Savdo va buyurtmalar — tanlangan davr va kategoriya bo‘yicha (serverdagi filial ma’lumotlari)'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="7days">Oxirgi 7 kun</option>
            <option value="30days">Oxirgi 30 kun</option>
            <option value="90days">Oxirgi 90 kun</option>
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">Barcha kategoriyalar</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Jami daromad"
          value={formatCurrency(analyticsData.totalRevenue)}
          change={analyticsData.revenueGrowth}
          icon={DollarSign}
        />
        <StatCard
          title="Jami buyurtmalar"
          value={analyticsData.totalOrders.toLocaleString()}
          change={analyticsData.ordersGrowth}
          icon={ShoppingCart}
        />
        <StatCard
          title="Jami mijozlar (nozik)"
          value={analyticsData.totalCustomers.toLocaleString()}
          change={analyticsData.customersGrowth}
          icon={Users}
        />
        <StatCard title="Mahsulotlar (katalog)" value={analyticsData.totalProducts.toLocaleString()} icon={Package} />
      </div>

      <div className="p-6 rounded-2xl border space-y-4" style={surfaceStyle}>
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Ijara bo‘limi (yakunlangan)
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Tanlangan davrda qaytarilgan ijaralar — mahsulotda kiritilgan platforma foizi bo‘yicha ulush
            hisoblanadi. Yakunlangan: {analyticsData.rentalCompletedCount} ta.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Ijara aylanmasi"
            value={formatCurrency(analyticsData.rentalCompletedRevenue)}
            icon={Building2}
          />
          <StatCard
            title="Platforma ulushi (foyda)"
            value={formatCurrency(analyticsData.rentalPlatformCommission)}
            change={analyticsData.rentalPlatformCommissionGrowth}
            icon={Percent}
          />
          <StatCard
            title="Filial qoldig‘i"
            value={formatCurrency(analyticsData.rentalBranchNet)}
            icon={DollarSign}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border" style={surfaceStyle}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Kunlik daromad</h3>
          {analyticsData.dailyStats.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Tanlangan davrda yozuvlar yo‘q</p>
          ) : (
            <div className="space-y-3">
              {analyticsData.dailyStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.date}</span>
                  <div className="flex items-center space-x-4">
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(stat.revenue)}
                    </span>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {stat.orders} buyurtma
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl border" style={surfaceStyle}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Kategoriyalar bo‘yicha
          </h3>
          {analyticsData.categoryStats.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Kategoriya bo‘yicha ma’lumot yo‘q</p>
          ) : (
            <div className="space-y-3">
              {analyticsData.categoryStats.map((stat, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.category}</span>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.percentage}%</span>
                  </div>
                  <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.min(stat.percentage, 100)}%`, background: accentColor.gradient }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{formatCurrency(stat.revenue)}</span>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{stat.orders} buyurtma</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 rounded-2xl border" style={surfaceStyle}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Eng ko‘p sotiladigan mahsulotlar
        </h3>
        {analyticsData.topProducts.length === 0 ? (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Pozitsiyalar bo‘yicha ma’lumot yo‘q</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`text-left py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Mahsulot</th>
                  <th className={`text-right py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Soni</th>
                  <th className={`text-right py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Daromad</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.topProducts.map((product, index) => (
                  <tr key={index} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.name}</td>
                    <td className={`py-3 px-4 text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {product.sales}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
