import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ShoppingCart, 
  DollarSign, 
  Package, 
  Calendar,
  Download,
  RefreshCw,
  Filter,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
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
}

interface AnalyticsCategoryOption {
  id: string;
  label: string;
}

interface AnalyticsProps {
  branchId: string;
}

export default function Analytics({ branchId }: AnalyticsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<AnalyticsCategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days'); // 7days, 30days, 90days
  const [selectedCategory, setSelectedCategory] = useState('all');
  const visibilityRefetchTick = useVisibilityTick();

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setAnalyticsData(null);
      console.log('📊 Loading analytics for branch:', branchId);

      const params = new URLSearchParams({
        branchId,
        dateRange,
        category: selectedCategory
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/analytics?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

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
        });
        setCategoryOptions(Array.isArray(data.categories) ? data.categories : []);
        console.log('✅ Analytics loaded from API');
      } else {
        throw new Error(data.error || 'Analitika ma\'lumotlari olinmadi');
      }
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      setCategoryOptions([]);
      setAnalyticsData(null);
      toast.error('Analitika ma\'lumotlarini yuklab bo\'lmadi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [branchId, dateRange, selectedCategory, visibilityRefetchTick]);

  useEffect(() => {
    if (selectedCategory === 'all') {
      return;
    }

    const hasSelectedCategory = categoryOptions.some((option) => option.id === selectedCategory);
    if (!hasSelectedCategory) {
      setSelectedCategory('all');
    }
  }, [categoryOptions, selectedCategory]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const surfaceStyle = {
    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
  };

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon
  }: { 
    title: string; 
    value: string | number; 
    change?: number; 
    icon: any;
  }) => (
    <div
      className="p-6 rounded-2xl border transition-all hover:shadow-lg"
      style={surfaceStyle}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{title}</p>
          <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {value}
          </p>
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
        <div
          className="p-3 rounded-xl"
          style={{ background: `${accentColor.color}20` }}
        >
          <Icon className="w-6 h-6" style={{ color: accentColor.color }} />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: accentColor.color }} />
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Analitika ma\'lumotlari yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.6 }} />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Analitika ma\'lumotlari topilmadi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Analitika
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Filialning ish statistikasi
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              isDark 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="7days">Oxirgi 7 kun</option>
            <option value="30days">Oxirgi 30 kun</option>
            <option value="90days">Oxirgi 90 kun</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              isDark 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">Barcha kategoriyalar</option>
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Export Button */}
          <button
            className="px-4 py-2 rounded-xl flex items-center space-x-2 text-white transition-all"
            style={{ background: accentColor.gradient }}
          >
            <Download className="w-4 h-4" />
            <span>Eksport</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
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
          title="Jami mijozlar"
          value={analyticsData.totalCustomers.toLocaleString()}
          change={analyticsData.customersGrowth}
          icon={Users}
        />
        <StatCard
          title="Mahsulotlar"
          value={analyticsData.totalProducts.toLocaleString()}
          icon={Package}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Chart */}
        <div className="p-6 rounded-2xl border" style={surfaceStyle}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Kunlik daromad
          </h3>
          <div className="space-y-3">
            {analyticsData.dailyStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {stat.date}
                </span>
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
        </div>

        {/* Category Stats */}
        <div className="p-6 rounded-2xl border" style={surfaceStyle}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Kategoriyalar bo'yicha
          </h3>
          <div className="space-y-3">
            {analyticsData.categoryStats.map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {stat.category}
                  </span>
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stat.percentage}%
                  </span>
                </div>
                <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div 
                    className="h-2 rounded-full"
                    style={{ width: `${stat.percentage}%`, background: accentColor.gradient }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    {formatCurrency(stat.revenue)}
                  </span>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    {stat.orders} buyurtma
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="p-6 rounded-2xl border" style={surfaceStyle}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Eng ko'p sotiladigan mahsulotlar
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <th className={`text-left py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Mahsulot nomi
                </th>
                <th className={`text-right py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Sotuvlar soni
                </th>
                <th className={`text-right py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Daromad
                </th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topProducts.map((product, index) => (
                <tr 
                  key={index} 
                  className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                >
                  <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {product.name}
                  </td>
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
      </div>
    </div>
  );
}
