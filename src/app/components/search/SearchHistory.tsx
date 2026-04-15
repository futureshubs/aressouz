import { useState, useEffect, useCallback } from 'react';
import { Clock, Bookmark, Search, X, Bell, Calendar, Filter, TrendingUp, Users, Trash2, Edit, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';

export interface SearchHistoryItem {
  id: string;
  userId: string;
  query: string;
  filters: Record<string, any>;
  resultsCount: number;
  timestamp: Date;
  sessionId: string;
  clickedResults: string[];
  duration: number;
  device: string;
  location?: string;
  converted: boolean;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  alertEnabled: boolean;
  alertFrequency: 'instant' | 'daily' | 'weekly';
  lastAlertSent?: Date;
  newResultsCount: number;
  totalResultsCount: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  category?: string;
  description?: string;
}

export interface SearchAlert {
  id: string;
  savedSearchId: string;
  userId: string;
  newProducts: Array<{
    id: string;
    title: string;
    price: number;
    image: string;
    postedDate: Date;
  }>;
  totalNew: number;
  sentAt: Date;
  read: boolean;
}

export interface SearchStats {
  totalSearches: number;
  uniqueQueries: number;
  averageResults: number;
  mostSearchedQueries: Array<{
    query: string;
    count: number;
    lastSearched: Date;
  }>;
  searchFrequency: Array<{
    date: string;
    searches: number;
  }>;
  topFilters: Array<{
    filter: string;
    value: string;
    count: number;
  }>;
}

const mockSearchHistory: SearchHistoryItem[] = [
  {
    id: 'history_1',
    userId: 'user_1',
    query: 'Samsung Galaxy',
    filters: { category: 'electronics', priceMax: 20000000 },
    resultsCount: 45,
    timestamp: new Date('2025-03-19T10:30:00'),
    sessionId: 'session_1',
    clickedResults: ['product_1', 'product_2'],
    duration: 180000,
    device: 'mobile',
    location: 'Toshkent',
    converted: true
  },
  {
    id: 'history_2',
    userId: 'user_1',
    query: 'iPhone 15',
    filters: { category: 'electronics', rating: 4.5 },
    resultsCount: 23,
    timestamp: new Date('2025-03-19T09:15:00'),
    sessionId: 'session_1',
    clickedResults: ['product_3'],
    duration: 120000,
    device: 'desktop',
    location: 'Toshkent',
    converted: false
  },
  {
    id: 'history_3',
    userId: 'user_1',
    query: 'Laptop',
    filters: { priceMin: 5000000, priceMax: 15000000 },
    resultsCount: 67,
    timestamp: new Date('2025-03-18T14:20:00'),
    sessionId: 'session_2',
    clickedResults: ['product_4', 'product_5', 'product_6'],
    duration: 300000,
    device: 'tablet',
    location: 'Samarqand',
    converted: true
  }
];

const mockSavedSearches: SavedSearch[] = [
  {
    id: 'saved_1',
    userId: 'user_1',
    name: 'Samsung telefonlar',
    query: 'Samsung',
    filters: { category: 'electronics', brand: 'Samsung', priceMax: 25000000 },
    alertEnabled: true,
    alertFrequency: 'daily',
    newResultsCount: 3,
    totalResultsCount: 45,
    createdAt: new Date('2025-03-10'),
    updatedAt: new Date('2025-03-19'),
    isActive: true,
    category: 'Elektronika',
    description: 'Yangi Samsung telefonlar uchun qidiruv'
  },
  {
    id: 'saved_2',
    userId: 'user_1',
    name: 'Arzon noutbuklar',
    query: 'Laptop',
    filters: { category: 'electronics', subcategory: 'laptops', priceMax: 10000000 },
    alertEnabled: true,
    alertFrequency: 'instant',
    newResultsCount: 7,
    totalResultsCount: 34,
    createdAt: new Date('2025-03-12'),
    updatedAt: new Date('2025-03-19'),
    isActive: true,
    category: 'Elektronika',
    description: '1 million so\'mdan arzon noutbuklar'
  },
  {
    id: 'saved_3',
    userId: 'user_1',
    name: 'Toshkentdagi uylar',
    query: 'Uy',
    filters: { category: 'real_estate', location: 'Toshkent', type: 'apartment' },
    alertEnabled: false,
    alertFrequency: 'weekly',
    newResultsCount: 0,
    totalResultsCount: 156,
    createdAt: new Date('2025-03-05'),
    updatedAt: new Date('2025-03-15'),
    isActive: true,
    category: 'Ko\'chmas mulk',
    description: 'Toshkent shahrida sotiladigan uylar'
  }
];

const mockSearchAlerts: SearchAlert[] = [
  {
    id: 'alert_1',
    savedSearchId: 'saved_1',
    userId: 'user_1',
    newProducts: [
      {
        id: 'product_7',
        title: 'Samsung Galaxy A55',
        price: 8900000,
        image: '/images/galaxy-a55.jpg',
        postedDate: new Date('2025-03-19')
      },
      {
        id: 'product_8',
        title: 'Samsung Galaxy Tab S9',
        price: 12300000,
        image: '/images/tab-s9.jpg',
        postedDate: new Date('2025-03-19')
      }
    ],
    totalNew: 2,
    sentAt: new Date('2025-03-19T08:00:00'),
    read: false
  },
  {
    id: 'alert_2',
    savedSearchId: 'saved_2',
    userId: 'user_1',
    newProducts: [
      {
        id: 'product_9',
        title: 'Lenovo IdeaPad 3',
        price: 7800000,
        image: '/images/ideapad-3.jpg',
        postedDate: new Date('2025-03-19')
      }
    ],
    totalNew: 1,
    sentAt: new Date('2025-03-19T09:30:00'),
    read: true
  }
];

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(mockSearchHistory);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(mockSavedSearches);
  const [searchAlerts, setSearchAlerts] = useState<SearchAlert[]>(mockSearchAlerts);
  const [searchStats, setSearchStats] = useState<SearchStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Add search to history
  const addToHistory = useCallback((searchData: Omit<SearchHistoryItem, 'id' | 'timestamp'>) => {
    const newHistoryItem: SearchHistoryItem = {
      ...searchData,
      id: `history_${Date.now()}`,
      timestamp: new Date()
    };

    setSearchHistory(prev => [newHistoryItem, ...prev.slice(0, 99)]); // Keep last 100
  }, []);

  // Remove from history
  const removeFromHistory = useCallback((id: string) => {
    setSearchHistory(prev => prev.filter(item => item.id !== id));
    toast.success('Qidiruv tarixidan o\'chirildi');
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    toast.success('Qidiruv tarixi tozalandi');
  }, []);

  // Save search
  const saveSearch = useCallback((searchData: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt' | 'newResultsCount' | 'totalResultsCount'>) => {
    const newSavedSearch: SavedSearch = {
      ...searchData,
      id: `saved_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      newResultsCount: 0,
      totalResultsCount: 0
    };

    setSavedSearches(prev => [...prev, newSavedSearch]);
    toast.success('Qidiruv saqlandi');
    return newSavedSearch;
  }, []);

  // Update saved search
  const updateSavedSearch = useCallback((id: string, updates: Partial<SavedSearch>) => {
    setSavedSearches(prev => prev.map(search => 
      search.id === id 
        ? { ...search, ...updates, updatedAt: new Date() }
        : search
    ));
    toast.success('Saqlangan qidiruv yangilandi');
  }, []);

  // Delete saved search
  const deleteSavedSearch = useCallback((id: string) => {
    setSavedSearches(prev => prev.filter(search => search.id !== id));
    setSearchAlerts(prev => prev.filter(alert => alert.savedSearchId !== id));
    toast.success('Saqlangan qidiruv o\'chirildi');
  }, []);

  // Toggle alert for saved search
  const toggleAlert = useCallback((id: string) => {
    setSavedSearches(prev => prev.map(search => {
      if (search.id === id) {
        const newAlertEnabled = !search.alertEnabled;
        toast.success(newAlertEnabled ? 'Bildirishmalar yoqildi' : 'Bildirishmalar o\'chirildi');
        return { ...search, alertEnabled: newAlertEnabled, updatedAt: new Date() };
      }
      return search;
    }));
  }, []);

  // Mark alert as read
  const markAlertAsRead = useCallback((id: string) => {
    setSearchAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, read: true } : alert
    ));
  }, []);

  // Delete alert
  const deleteAlert = useCallback((id: string) => {
    setSearchAlerts(prev => prev.filter(alert => alert.id !== id));
    toast.success('Bildirishma o\'chirildi');
  }, []);

  // Get search statistics
  const getSearchStats = useCallback(() => {
    const totalSearches = searchHistory.length;
    const uniqueQueries = new Set(searchHistory.map(item => item.query.toLowerCase())).size;
    const averageResults = searchHistory.reduce((sum, item) => sum + item.resultsCount, 0) / totalSearches;

    // Most searched queries
    const queryStats = searchHistory.reduce((acc, item) => {
      const query = item.query.toLowerCase();
      if (!acc[query]) {
        acc[query] = { count: 0, lastSearched: item.timestamp };
      }
      acc[query].count++;
      if (item.timestamp > acc[query].lastSearched) {
        acc[query].lastSearched = item.timestamp;
      }
      return acc;
    }, {} as Record<string, { count: number; lastSearched: Date }>);

    const mostSearchedQueries = Object.entries(queryStats)
      .map(([query, stats]) => ({ query, count: stats.count, lastSearched: stats.lastSearched }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Search frequency
    const searchFrequency = searchHistory.reduce((acc, item) => {
      const date = item.timestamp.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const frequencyData = Object.entries(searchFrequency)
      .map(([date, searches]) => ({ date, searches }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top filters
    const filterStats = searchHistory.reduce((acc, item) => {
      Object.entries(item.filters).forEach(([key, value]) => {
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

    const stats: SearchStats = {
      totalSearches,
      uniqueQueries,
      averageResults,
      mostSearchedQueries,
      searchFrequency: frequencyData,
      topFilters
    };

    setSearchStats(stats);
    return stats;
  }, [searchHistory]);

  // Export search history
  const exportHistory = useCallback(async (format: 'csv' | 'json') => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`Qidiruv tarixi ${format.toUpperCase()} formatida eksport qilindi`);
    } catch (error) {
      toast.error('Eksport qilishda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search in history
  const searchInHistory = useCallback((query: string) => {
    const searchTerm = query.toLowerCase();
    return searchHistory.filter(item => 
      item.query.toLowerCase().includes(searchTerm) ||
      Object.values(item.filters).some(value => 
        String(value).toLowerCase().includes(searchTerm)
      )
    );
  }, [searchHistory]);

  // Get recent searches
  const getRecentSearches = useCallback((limit: number = 10) => {
    return searchHistory.slice(0, limit);
  }, [searchHistory]);

  // Get popular searches from history
  const getPopularSearches = useCallback((limit: number = 10) => {
    const queryCounts = searchHistory.reduce((acc, item) => {
      acc[item.query] = (acc[item.query] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(queryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }, [searchHistory]);

  useEffect(() => {
    getSearchStats();
  }, [getSearchStats]);

  return {
    searchHistory,
    savedSearches,
    searchAlerts,
    searchStats,
    isLoading,
    addToHistory,
    removeFromHistory,
    clearHistory,
    saveSearch,
    updateSavedSearch,
    deleteSavedSearch,
    toggleAlert,
    markAlertAsRead,
    deleteAlert,
    getSearchStats,
    exportHistory,
    searchInHistory,
    getRecentSearches,
    getPopularSearches
  };
}

export default function SearchHistoryManager({ userId }: { userId: string }) {
  const {
    searchHistory,
    savedSearches,
    searchAlerts,
    searchStats,
    isLoading,
    removeFromHistory,
    clearHistory,
    saveSearch,
    updateSavedSearch,
    deleteSavedSearch,
    toggleAlert,
    markAlertAsRead,
    deleteAlert,
    exportHistory,
    getRecentSearches,
    getPopularSearches
  } = useSearchHistory();

  const [activeTab, setActiveTab] = useState<'history' | 'saved' | 'alerts' | 'stats'>('history');
  const [editingSearch, setEditingSearch] = useState<string | null>(null);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours} soat ${minutes % 60} daqiqa`;
    if (minutes > 0) return `${minutes} daqiqa ${seconds % 60} sekund`;
    return `${seconds} sekund`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('uz-UZ', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatFilters = (filters: Record<string, any>) => {
    return Object.entries(filters)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  // Render Search History Tab
  const renderHistoryTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Qidiruv tarixi
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => exportHistory('csv')}
            disabled={isLoading}
            className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Eksport
          </button>
          <button
            onClick={clearHistory}
            className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Tozalash
          </button>
        </div>
      </div>

      {searchHistory.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Hali hech qanday qidiruv tarixi yo'q
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {getRecentSearches(20).map((item) => (
            <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Search className="w-4 h-4 text-gray-500" />
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {item.query}
                    </h4>
                    {item.converted && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Konvertatsiya
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {item.resultsCount} ta natija • {formatDuration(item.duration)}
                  </div>
                  
                  {Object.keys(item.filters).length > 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-500 mb-2">
                      Filtrlar: {formatFilters(item.filters)}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500">
                    <span>{formatDate(item.timestamp)}</span>
                    <span>{item.device}</span>
                    {item.location && <span>{item.location}</span>}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => saveSearch({
                      userId,
                      name: item.query,
                      query: item.query,
                      filters: item.filters,
                      alertEnabled: false,
                      alertFrequency: 'daily',
                      isActive: true
                    })}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    title="Saqlash"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFromHistory(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Saved Searches Tab
  const renderSavedTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Saqlangan qidiruvlar
        </h3>
        <button
          onClick={() => saveSearch({
            userId,
            name: 'Yangi qidiruv',
            query: '',
            filters: {},
            alertEnabled: false,
            alertFrequency: 'daily',
            isActive: true
          })}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Yangi qidiruv
        </button>
      </div>

      {savedSearches.length === 0 ? (
        <div className="text-center py-12">
          <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Hali hech qanday saqlangan qidiruv yo'q
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedSearches.map((search) => (
            <div key={search.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {editingSearch === search.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    defaultValue={search.name}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Nomi"
                  />
                  <textarea
                    defaultValue={search.description}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Tavsif"
                    rows={2}
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        // Save changes
                        setEditingSearch(null);
                      }}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Saqlash
                    </button>
                    <button
                      onClick={() => setEditingSearch(null)}
                      className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Bekor qilish
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {search.name}
                      </h4>
                      {search.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {search.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingSearch(search.id)}
                        className="p-2 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteSavedSearch(search.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Qidiruv:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {search.query || 'Barcha mahsulotlar'}
                      </span>
                    </div>
                    
                    {Object.keys(search.filters).length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Filtrlar:</span>
                        <span className="text-gray-900 dark:text-white">
                          {formatFilters(search.filters)}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Natijalar:</span>
                      <span className="text-gray-900 dark:text-white">
                        {search.totalResultsCount} ta
                        {search.newResultsCount > 0 && (
                          <span className="text-green-600 ml-1">
                            (+{search.newResultsCount} yangi)
                          </span>
                        )}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Bildirishmalar:</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleAlert(search.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            search.alertEnabled ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              search.alertEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {search.alertFrequency}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Yaratilgan:</span>
                      <span className="text-gray-900 dark:text-white">
                        {formatDate(search.createdAt)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Alerts Tab
  const renderAlertsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Bildirishmalar
          {searchAlerts.some(alert => !alert.read) && (
            <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
              {searchAlerts.filter(alert => !alert.read).length}
            </span>
          )}
        </h3>
        <button
          onClick={() => {
            searchAlerts.forEach(alert => !alert.read && markAlertAsRead(alert.id));
          }}
          className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Barchasini o'qildi deb belgilash
        </button>
      </div>

      {searchAlerts.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Hali hech qanday bildirishma yo'q
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {searchAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border ${
                alert.read 
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600' 
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Bell className={`w-5 h-5 ${alert.read ? 'text-gray-500' : 'text-blue-500'}`} />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {alert.totalNew} ta yangi mahsulot
                  </span>
                  {!alert.read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(alert.sentAt)}
                  </span>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                {alert.newProducts.map((product, index) => (
                  <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <img
                      src={product.image || '/placeholder.jpg'}
                      alt={product.title}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        {product.title}
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {product.price.toLocaleString('uz-UZ')} so'm
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Stats Tab
  const renderStatsTab = () => {
    if (!searchStats) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400"></p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Qidiruv statistikasi
        </h3>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {searchStats.totalSearches}
            </div>
            <p className="text-blue-700 dark:text-blue-300">Jami qidiruvlar</p>
          </div>
          
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {searchStats.uniqueQueries}
            </div>
            <p className="text-green-700 dark:text-green-300">Unikal so'rovlar</p>
          </div>
          
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {searchStats.averageResults.toFixed(0)}
            </div>
            <p className="text-purple-700 dark:text-purple-300">O\'rtacha natijalar</p>
          </div>
        </div>

        {/* Most Searched Queries */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Eng ko'p qidirilgan so'rovlar
          </h4>
          <div className="space-y-2">
            {searchStats.mostSearchedQueries.slice(0, 10).map((query, index) => (
              <div key={query.query} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex items-center space-x-3">
                  <span className="text-gray-500 w-6">#{index + 1}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {query.query}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {query.count} marta
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(query.lastSearched)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Filters */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Eng ko'p ishlatilgan filtrlar
          </h4>
          <div className="space-y-2">
            {searchStats.topFilters.slice(0, 10).map((filter, index) => (
              <div key={`${filter.filter}-${filter.value}`} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex items-center space-x-3">
                  <span className="text-gray-500 w-6">#{index + 1}</span>
                  <span className="text-gray-900 dark:text-white">
                    {filter.filter}: {filter.value}
                  </span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {filter.count} marta
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Tabs */}
      <div className="flex items-center space-x-1 mb-6 border-b border-gray-200 dark:border-gray-600">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Tarix
        </button>
        
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'saved'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Bookmark className="w-4 h-4 inline mr-2" />
          Saqlangan
        </button>
        
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'alerts'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4 inline mr-2" />
          Bildirishmalar
          {searchAlerts.some(alert => !alert.read) && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Statistika
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'saved' && renderSavedTab()}
        {activeTab === 'alerts' && renderAlertsTab()}
        {activeTab === 'stats' && renderStatsTab()}
      </div>
    </div>
  );
}
