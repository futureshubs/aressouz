import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Search, Eye, MousePointer, Clock, Calendar, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';

export interface SearchEvent {
  id: string;
  sessionId: string;
  userId?: string;
  query: string;
  timestamp: Date;
  filters: Record<string, any>;
  resultsCount: number;
  clickedResults: string[];
  converted: boolean;
  sessionDuration: number;
  device: string;
  location?: string;
  referrer?: string;
}

export interface SearchMetrics {
  totalSearches: number;
  uniqueQueries: number;
  averageResults: number;
  clickThroughRate: number;
  conversionRate: number;
  averageSessionDuration: number;
  topQueries: Array<{
    query: string;
    count: number;
    ctr: number;
    conversionRate: number;
  }>;
  topFilters: Array<{
    filter: string;
    value: string;
    count: number;
  }>;
  noResultQueries: Array<{
    query: string;
    count: number;
    suggestions: string[];
  }>;
  searchTrends: Array<{
    date: string;
    searches: number;
    uniqueQueries: number;
    ctr: number;
  }>;
  deviceBreakdown: Record<string, number>;
  locationBreakdown: Record<string, number>;
}

export interface SearchFunnel {
  step: 'search' | 'results' | 'click' | 'conversion';
  count: number;
  percentage: number;
  dropOffReasons?: string[];
}

const mockSearchEvents: SearchEvent[] = [
  {
    id: '1',
    sessionId: 'session_1',
    userId: 'user_1',
    query: 'Samsung Galaxy',
    timestamp: new Date('2025-03-19T10:30:00'),
    filters: { category: 'electronics', priceMax: 20000000 },
    resultsCount: 45,
    clickedResults: ['product_1', 'product_2'],
    converted: true,
    sessionDuration: 180000,
    device: 'mobile',
    location: 'Toshkent'
  },
  {
    id: '2',
    sessionId: 'session_2',
    query: 'iPhone 15',
    timestamp: new Date('2025-03-19T11:15:00'),
    filters: { category: 'electronics', rating: 4.5 },
    resultsCount: 23,
    clickedResults: ['product_3'],
    converted: false,
    sessionDuration: 120000,
    device: 'desktop',
    location: 'Toshkent'
  },
  {
    id: '3',
    sessionId: 'session_3',
    userId: 'user_2',
    query: 'Laptop',
    timestamp: new Date('2025-03-19T14:20:00'),
    filters: { priceMin: 5000000, priceMax: 15000000 },
    resultsCount: 67,
    clickedResults: ['product_4', 'product_5', 'product_6'],
    converted: true,
    sessionDuration: 300000,
    device: 'tablet',
    location: 'Samarqand'
  }
];

export function useSearchAnalytics() {
  const [events, setEvents] = useState<SearchEvent[]>(mockSearchEvents);
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);
  const [funnel, setFunnel] = useState<SearchFunnel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState('7days');

  // Track search event
  const trackSearch = (eventData: Omit<SearchEvent, 'id' | 'timestamp'>) => {
    const newEvent: SearchEvent = {
      ...eventData,
      id: `search_${Date.now()}`,
      timestamp: new Date()
    };

    setEvents(prev => [...prev, newEvent]);
  };

  // Track result click
  const trackClick = (sessionId: string, productId: string) => {
    setEvents(prev => prev.map(event => {
      if (event.sessionId === sessionId) {
        return {
          ...event,
          clickedResults: [...event.clickedResults, productId]
        };
      }
      return event;
    }));
  };

  // Track conversion
  const trackConversion = (sessionId: string) => {
    setEvents(prev => prev.map(event => {
      if (event.sessionId === sessionId) {
        return {
          ...event,
          converted: true
        };
      }
      return event;
    }));
  };

  // Calculate metrics
  const calculateMetrics = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const totalSearches = events.length;
      const uniqueQueries = new Set(events.map(e => e.query.toLowerCase())).size;
      const averageResults = events.reduce((sum, e) => sum + e.resultsCount, 0) / totalSearches;
      const clickThroughRate = events.filter(e => e.clickedResults.length > 0).length / totalSearches * 100;
      const conversionRate = events.filter(e => e.converted).length / totalSearches * 100;
      const averageSessionDuration = events.reduce((sum, e) => sum + e.sessionDuration, 0) / totalSearches;

      // Top queries
      const queryStats = events.reduce((acc, event) => {
        const query = event.query.toLowerCase();
        if (!acc[query]) {
          acc[query] = {
            count: 0,
            clicks: 0,
            conversions: 0
          };
        }
        acc[query].count++;
        if (event.clickedResults.length > 0) acc[query].clicks++;
        if (event.converted) acc[query].conversions++;
        return acc;
      }, {} as Record<string, { count: number; clicks: number; conversions: number }>);

      const topQueries = Object.entries(queryStats)
        .map(([query, stats]) => ({
          query,
          count: stats.count,
          ctr: (stats.clicks / stats.count) * 100,
          conversionRate: (stats.conversions / stats.count) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top filters
      const filterStats = events.reduce((acc, event) => {
        Object.entries(event.filters).forEach(([key, value]) => {
          const filterKey = `${key}:${value}`;
          acc[filterKey] = (acc[filterKey] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

      const topFilters = Object.entries(filterStats)
        .map(([filter, count]) => {
          const [key, value] = filter.split(':');
          return { filter: key, value, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // No result queries
      const noResultQueries = events
        .filter(e => e.resultsCount === 0)
        .reduce((acc, event) => {
          const query = event.query.toLowerCase();
          if (!acc[query]) {
            acc[query] = { count: 0, suggestions: [] };
          }
          acc[query].count++;
          return acc;
        }, {} as Record<string, { count: number; suggestions: string[] }>);

      // Search trends
      const trends = events.reduce((acc, event) => {
        const date = event.timestamp.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { searches: 0, uniqueQueries: new Set(), clicks: 0 };
        }
        acc[date].searches++;
        acc[date].uniqueQueries.add(event.query.toLowerCase());
        if (event.clickedResults.length > 0) acc[date].clicks++;
        return acc;
      }, {} as Record<string, { searches: number; uniqueQueries: Set<string>; clicks: number }>);

      const searchTrends = Object.entries(trends)
        .map(([date, data]) => ({
          date,
          searches: data.searches,
          uniqueQueries: data.uniqueQueries.size,
          ctr: (data.clicks / data.searches) * 100
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Device breakdown
      const deviceBreakdown = events.reduce((acc, event) => {
        acc[event.device] = (acc[event.device] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Location breakdown
      const locationBreakdown = events.reduce((acc, event) => {
        if (event.location) {
          acc[event.location] = (acc[event.location] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Funnel analysis
      const funnelData: SearchFunnel[] = [
        {
          step: 'search',
          count: totalSearches,
          percentage: 100
        },
        {
          step: 'results',
          count: events.filter(e => e.resultsCount > 0).length,
          percentage: (events.filter(e => e.resultsCount > 0).length / totalSearches) * 100,
          dropOffReasons: ['No results found', 'Technical issues']
        },
        {
          step: 'click',
          count: events.filter(e => e.clickedResults.length > 0).length,
          percentage: clickThroughRate,
          dropOffReasons: ['Irrelevant results', 'Poor UI', 'Slow loading']
        },
        {
          step: 'conversion',
          count: events.filter(e => e.converted).length,
          percentage: conversionRate,
          dropOffReasons: ['Price too high', 'Better alternative', 'Just browsing']
        }
      ];

      setMetrics({
        totalSearches,
        uniqueQueries,
        averageResults,
        clickThroughRate,
        conversionRate,
        averageSessionDuration,
        topQueries,
        topFilters,
        noResultQueries: Object.entries(noResultQueries).map(([query, data]) => ({
          query,
          count: data.count,
          suggestions: data.suggestions
        })),
        searchTrends,
        deviceBreakdown,
        locationBreakdown
      });

      setFunnel(funnelData);

    } catch (error) {
      toast.error('Analitikani hisoblashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  // Export analytics
  const exportAnalytics = async (format: 'csv' | 'excel' | 'json') => {
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
    calculateMetrics();
  }, [dateRange]);

  return {
    events,
    metrics,
    funnel,
    isLoading,
    dateRange,
    setDateRange,
    trackSearch,
    trackClick,
    trackConversion,
    calculateMetrics,
    exportAnalytics
  };
}

export default function SearchAnalyticsDashboard() {
  const { metrics, funnel, isLoading, dateRange, setDateRange, exportAnalytics } = useSearchAnalytics();

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours} soat ${minutes % 60} daqiqa`;
    if (minutes > 0) return `${minutes} daqiqa ${seconds % 60} sekund`;
    return `${seconds} sekund`;
  };

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-400">Analitika yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Qidiruv analitikasi
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="today">Bugun</option>
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
              onClick={() => exportAnalytics('json')}
              disabled={isLoading}
              className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Search className="w-8 h-8 text-blue-500" />
            <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {metrics.totalSearches.toLocaleString()}
            </span>
          </div>
          <p className="text-blue-700 dark:text-blue-300">Jami qidiruvlar</p>
        </div>

        <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-bold text-green-900 dark:text-green-100">
              {metrics.uniqueQueries.toLocaleString()}
            </span>
          </div>
          <p className="text-green-700 dark:text-green-300">Unikal so'rovlar</p>
        </div>

        <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <MousePointer className="w-8 h-8 text-purple-500" />
            <span className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {metrics.clickThroughRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-purple-700 dark:text-purple-300">CTR</p>
        </div>

        <div className="p-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-orange-500" />
            <span className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {metrics.conversionRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-orange-700 dark:text-orange-300">Konversiya</p>
        </div>
      </div>

      {/* Funnel Analysis */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Qidiruv konvertatsiya voronkasi
        </h3>
        <div className="flex items-center space-x-4 overflow-x-auto">
          {funnel.map((step, index) => (
            <div key={step.step} className="flex flex-col items-center min-w-[150px]">
              <div className={`w-full p-4 rounded-lg text-center ${
                step.step === 'search' ? 'bg-blue-500 text-white' :
                step.step === 'results' ? 'bg-green-500 text-white' :
                step.step === 'click' ? 'bg-purple-500 text-white' :
                'bg-orange-500 text-white'
              }`}>
                <div className="text-2xl font-bold">{step.count.toLocaleString()}</div>
                <div className="text-sm">{step.percentage.toFixed(1)}%</div>
              </div>
              <div className="mt-2 text-center">
                <div className="font-medium text-gray-900 dark:text-white capitalize">
                  {step.step === 'search' && 'Qidiruv'}
                  {step.step === 'results' && 'Natijalar'}
                  {step.step === 'click' && 'Click'}
                  {step.step === 'conversion' && 'Konversiya'}
                </div>
                {step.dropOffReasons && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {step.dropOffReasons.join(', ')}
                  </div>
                )}
              </div>
              {index < funnel.length - 1 && (
                <div className="hidden md:block text-gray-400 mt-2">↓</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Eng ko'p qidirilgan so'rovlar
          </h3>
          <div className="space-y-3">
            {metrics.topQueries.slice(0, 5).map((query, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {query.query}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {query.count} marta qidirildi
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-purple-600">
                    CTR: {query.ctr.toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-600">
                    Konversiya: {query.conversionRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Filters */}
        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Eng ko'p ishlatiladigan filtrlar
          </h3>
          <div className="space-y-3">
            {metrics.topFilters.slice(0, 5).map((filter, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white capitalize">
                    {filter.filter}: {filter.value}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {filter.count} marta
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Device and Location Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Qurilmalar bo'yicha
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics.deviceBreakdown).map(([device, count]) => (
              <div key={device} className="flex items-center justify-between">
                <span className="capitalize text-gray-900 dark:text-white">
                  {device === 'mobile' && 'Mobil'}
                  {device === 'desktop' && 'Desktop'}
                  {device === 'tablet' && 'Planshet'}
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(count / metrics.totalSearches) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Shaharlar bo'yicha
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics.locationBreakdown)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([location, count]) => (
                <div key={location} className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-white">
                    {location}
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(count / metrics.totalSearches) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Eye className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-gray-900 dark:text-white">
              O'rtacha natijalar soni
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.averageResults.toFixed(0)}
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-5 h-5 text-green-500" />
            <span className="font-medium text-gray-900 dark:text-white">
              O'rtacha sessiya davomiyligi
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatDuration(metrics.averageSessionDuration)}
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Filter className="w-5 h-5 text-purple-500" />
            <span className="font-medium text-gray-900 dark:text-white">
            Natijasiz qidiruvlar
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.noResultQueries.length}
          </div>
        </div>
      </div>
    </div>
  );
}
