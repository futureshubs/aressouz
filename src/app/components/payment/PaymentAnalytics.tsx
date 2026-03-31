import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, ArrowUpRight, ArrowDownRight, Calendar, Filter, BarChart3, PieChart, Activity } from 'lucide-react';
import { toast } from 'sonner';

export interface PaymentMetrics {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  conversionRate: number;
  refundRate: number;
  successRate: number;
  failedTransactions: number;
  pendingAmount: number;
}

export interface PaymentMethodStats {
  method: string;
  count: number;
  amount: number;
  percentage: number;
  successRate: number;
  icon: string;
}

export interface DailyPaymentData {
  date: string;
  revenue: number;
  transactions: number;
  successRate: number;
  averageValue: number;
}

export interface TopProduct {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  growth: number;
}

export interface PaymentAnalytics {
  metrics: PaymentMetrics;
  paymentMethods: PaymentMethodStats[];
  dailyData: DailyPaymentData[];
  topProducts: TopProduct[];
  currencyBreakdown: Record<string, number>;
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    transactions: number;
  }>;
}

const mockAnalytics: PaymentAnalytics = {
  metrics: {
    totalRevenue: 456780000,
    totalTransactions: 12450,
    averageOrderValue: 36680,
    conversionRate: 3.2,
    refundRate: 2.1,
    successRate: 94.5,
    failedTransactions: 685,
    pendingAmount: 12500000
  },
  paymentMethods: [
    {
      method: 'Click',
      count: 5234,
      amount: 189450000,
      percentage: 41.5,
      successRate: 95.2,
      icon: '💳'
    },
    {
      method: 'Payme',
      count: 4123,
      amount: 156780000,
      percentage: 34.3,
      successRate: 93.8,
      icon: '💳'
    },
    {
      method: 'Uzcard',
      count: 2156,
      amount: 78900000,
      percentage: 17.3,
      successRate: 96.1,
      icon: '💳'
    },
    {
      method: 'Humo',
      count: 937,
      amount: 31610000,
      percentage: 6.9,
      successRate: 94.7,
      icon: '💳'
    }
  ],
  dailyData: [
    { date: '2025-03-13', revenue: 34500000, transactions: 945, successRate: 94.1, averageValue: 36500 },
    { date: '2025-03-14', revenue: 38900000, transactions: 1087, successRate: 95.3, averageValue: 35770 },
    { date: '2025-03-15', revenue: 41200000, transactions: 1123, successRate: 93.8, averageValue: 36690 },
    { date: '2025-03-16', revenue: 37800000, transactions: 1034, successRate: 95.7, averageValue: 36550 },
    { date: '2025-03-17', revenue: 42300000, transactions: 1156, successRate: 94.2, averageValue: 36610 },
    { date: '2025-03-18', revenue: 39800000, transactions: 1089, successRate: 95.1, averageValue: 36540 },
    { date: '2025-03-19', revenue: 42400000, transactions: 1166, successRate: 94.8, averageValue: 36360 }
  ],
  topProducts: [
    { id: '1', name: 'Samsung Galaxy S24', revenue: 45670000, orders: 234, growth: 15.3 },
    { id: '2', name: 'iPhone 15 Pro', revenue: 38900000, orders: 156, growth: 8.7 },
    { id: '3', name: 'MacBook Air M2', revenue: 34560000, orders: 89, growth: 22.1 },
    { id: '4', name: 'iPad Pro 12.9"', revenue: 28900000, orders: 123, growth: -5.2 },
    { id: '5', name: 'AirPods Pro', revenue: 23450000, orders: 456, growth: 12.8 }
  ],
  currencyBreakdown: {
    'UZS': 345670000,
    'USD': 78900000,
    'EUR': 23400000,
    'RUB': 9200000
  },
  monthlyTrend: [
    { month: 'Yanvar', revenue: 123450000, transactions: 3456 },
    { month: 'Fevral', revenue: 156780000, transactions: 4234 },
    { month: 'Mart', revenue: 176550000, transactions: 4760 }
  ]
};

export function usePaymentAnalytics() {
  const [analytics, setAnalytics] = useState<PaymentAnalytics>(mockAnalytics);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState('7days');
  const [selectedCurrency, setSelectedCurrency] = useState('all');

  // Load analytics data
  const loadAnalytics = async (range: string, currency: string) => {
    setIsLoading(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In real implementation, this would call actual analytics API
      const updatedAnalytics = { ...mockAnalytics };
      
      // Adjust data based on date range (mock)
      if (range === '30days') {
        updatedAnalytics.metrics.totalRevenue *= 4.3;
        updatedAnalytics.metrics.totalTransactions *= 4.3;
      } else if (range === '90days') {
        updatedAnalytics.metrics.totalRevenue *= 13;
        updatedAnalytics.metrics.totalTransactions *= 13;
      }
      
      setAnalytics(updatedAnalytics);
      toast.success('Analitika ma\'lumotlari yangilandi');
    } catch (error) {
      toast.error('Analitikani yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  // Export analytics
  const exportAnalytics = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success(`Analitika ${format.toUpperCase()} formatida eksport qilindi`);
    } catch (error) {
      toast.error('Eksport qilishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics(dateRange, selectedCurrency);
  }, [dateRange, selectedCurrency]);

  return {
    analytics,
    isLoading,
    dateRange,
    setDateRange,
    selectedCurrency,
    setSelectedCurrency,
    loadAnalytics,
    exportAnalytics
  };
}

export default function PaymentAnalyticsDashboard() {
  const { analytics, isLoading, dateRange, setDateRange, exportAnalytics } = usePaymentAnalytics();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color,
    format = 'currency'
  }: { 
    title: string; 
    value: number; 
    change?: number; 
    icon: any; 
    color: string;
    format?: 'currency' | 'number' | 'percentage';
  }) => {
    const formattedValue = format === 'currency' ? formatCurrency(value) : 
                         format === 'percentage' ? `${value}%` : 
                         value.toLocaleString('uz-UZ');

    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formattedValue}
            </p>
            {change !== undefined && (
              <div className={`flex items-center mt-2 text-sm ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {change >= 0 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                {Math.abs(change)}%
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            To\'lov analitikasi
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="7days">Oxirgi 7 kun</option>
            <option value="30days">Oxirgi 30 kun</option>
            <option value="90days">Oxirgi 90 kun</option>
          </select>
          
          {/* Export Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportAnalytics('csv')}
              disabled={isLoading}
              className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              CSV
            </button>
            <button
              onClick={() => exportAnalytics('excel')}
              disabled={isLoading}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              Excel
            </button>
            <button
              onClick={() => exportAnalytics('pdf')}
              disabled={isLoading}
              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Jami daromad"
          value={analytics.metrics.totalRevenue}
          change={15.3}
          icon={DollarSign}
          color="bg-green-500"
        />
        <MetricCard
          title="Tranzaksiyalar soni"
          value={analytics.metrics.totalTransactions}
          change={8.7}
          icon={CreditCard}
          color="bg-blue-500"
          format="number"
        />
        <MetricCard
          title="O\'rtacha buyurtma"
          value={analytics.metrics.averageOrderValue}
          change={2.1}
          icon={Wallet}
          color="bg-purple-500"
        />
        <MetricCard
          title="Muvaffaqiyat foizi"
          value={analytics.metrics.successRate}
          change={1.2}
          icon={Activity}
          color="bg-orange-500"
          format="percentage"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Chart */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Kunlik daromad
          </h3>
          <div className="space-y-3">
            {analytics.dailyData.map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(day.date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })}
                </span>
                <div className="flex items-center space-x-4">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(day.revenue)}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {day.transactions} tranzaksiya
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            To\'lov usullari
          </h3>
          <div className="space-y-3">
            {analytics.paymentMethods.map((method, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{method.icon}</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {method.method}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {method.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${method.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{formatCurrency(method.amount)}</span>
                  <span>{method.count} tranzaksiya</span>
                  <span>{method.successRate}% muvaffaqiyat</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Eng ko'p sotiladigan mahsulotlar
          </h3>
          <div className="space-y-3">
            {analytics.topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {product.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {product.orders} buyurtma
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(product.revenue)}
                  </div>
                  <div className={`text-sm ${
                    product.growth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {product.growth >= 0 ? '+' : ''}{product.growth}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Currency Breakdown */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Valyuta bo'yicha
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.currencyBreakdown).map(([currency, amount]) => (
              <div key={currency} className="flex justify-between">
                <span className="font-medium text-gray-900 dark:text-white">
                  {currency}
                </span>
                <span className="text-gray-900 dark:text-white">
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Oylik trend
          </h3>
          <div className="space-y-3">
            {analytics.monthlyTrend.map((month, index) => (
              <div key={index} className="flex justify-between">
                <span className="font-medium text-gray-900 dark:text-white">
                  {month.month}
                </span>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(month.revenue)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {month.transactions} tranzaksiya
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
