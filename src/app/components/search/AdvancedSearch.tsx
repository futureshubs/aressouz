import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, SortAsc, SortDesc, X, ChevronDown, Star, MapPin, DollarSign, Calendar, Tag } from 'lucide-react';
import { toast } from 'sonner';

export interface SearchFilters {
  query: string;
  category?: string;
  subcategory?: string;
  priceMin?: number;
  priceMax?: number;
  location?: string;
  rating?: number;
  condition?: 'new' | 'used' | 'refurbished';
  sellerType?: 'individual' | 'business' | 'verified';
  features?: string[];
  tags?: string[];
  datePosted?: 'today' | 'week' | 'month' | 'any';
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'date' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  subcategory: string;
  location: string;
  rating: number;
  reviews: number;
  images: string[];
  seller: {
    id: string;
    name: string;
    type: 'individual' | 'business' | 'verified';
    rating: number;
    verified: boolean;
  };
  condition: 'new' | 'used' | 'refurbished';
  features: string[];
  tags: string[];
  postedDate: Date;
  views: number;
  likes: number;
  relevanceScore?: number;
  highlightedFields?: string[];
}

export interface SearchSuggestion {
  text: string;
  type: 'product' | 'category' | 'brand' | 'location' | 'query';
  count?: number;
  image?: string;
}

export interface SearchAnalytics {
  query: string;
  filters: SearchFilters;
  resultsCount: number;
  clickedResults: string[];
  sessionDuration: number;
  timestamp: Date;
  userId?: string;
}

const mockProducts: SearchResult[] = [
  {
    id: '1',
    title: 'Samsung Galaxy S24 Ultra 256GB',
    description: 'Yangi Samsung Galaxy S24 Ultra, 256GB xotira, Titan Black rang',
    price: 18990000,
    currency: 'UZS',
    category: 'electronics',
    subcategory: 'smartphones',
    location: 'Toshkent',
    rating: 4.8,
    reviews: 234,
    images: ['/images/samsung-s24.jpg'],
    seller: {
      id: 'seller1',
      name: 'TechStore',
      type: 'business',
      rating: 4.9,
      verified: true
    },
    condition: 'new',
    features: ['5G', '5000mAh', '200MP kamera', 'S Pen'],
    tags: ['samsung', 'galaxy', 'smartphone', 'premium'],
    postedDate: new Date('2025-03-15'),
    views: 1250,
    likes: 89,
    relevanceScore: 0.95,
    highlightedFields: ['title', 'category']
  },
  {
    id: '2',
    title: 'iPhone 15 Pro Max 256GB',
    description: 'Apple iPhone 15 Pro Max, 256GB, Natural Titanium',
    price: 22450000,
    currency: 'UZS',
    category: 'electronics',
    subcategory: 'smartphones',
    location: 'Toshkent',
    rating: 4.9,
    reviews: 456,
    images: ['/images/iphone15.jpg'],
    seller: {
      id: 'seller2',
      name: 'iStore Uzbekistan',
      type: 'verified',
      rating: 4.8,
      verified: true
    },
    condition: 'new',
    features: ['A17 Pro', '5x zoom', 'USB-C', 'Titanium'],
    tags: ['apple', 'iphone', 'premium', 'pro'],
    postedDate: new Date('2025-03-10'),
    views: 2340,
    likes: 167,
    relevanceScore: 0.92,
    highlightedFields: ['title']
  },
  {
    id: '3',
    title: 'MacBook Air M2 13"',
    description: 'Apple MacBook Air 13" M2 chip, 8GB RAM, 256GB SSD',
    price: 15670000,
    currency: 'UZS',
    category: 'electronics',
    subcategory: 'laptops',
    location: 'Toshkent',
    rating: 4.7,
    reviews: 123,
    images: ['/images/macbook-air.jpg'],
    seller: {
      id: 'seller3',
      name: 'Apple Premium Reseller',
      type: 'verified',
      rating: 4.9,
      verified: true
    },
    condition: 'new',
    features: ['M2 chip', '18-hour battery', 'Liquid Retina', 'MagSafe'],
    tags: ['apple', 'macbook', 'laptop', 'm2'],
    postedDate: new Date('2025-03-12'),
    views: 890,
    likes: 67,
    relevanceScore: 0.88,
    highlightedFields: ['title', 'category']
  }
];

const mockSuggestions: SearchSuggestion[] = [
  { text: 'Samsung Galaxy', type: 'product', count: 45 },
  { text: 'iPhone', type: 'product', count: 67 },
  { text: 'Elektronika', type: 'category', count: 1234 },
  { text: 'Toshkent', type: 'location', count: 890 },
  { text: 'Laptop', type: 'query', count: 234 }
];

export function useAdvancedSearch() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>(mockSuggestions);
  const [analytics, setAnalytics] = useState<SearchAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  // Search function
  const search = useCallback(async (filters: SearchFilters) => {
    setIsLoading(true);
    
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      let filteredResults = [...mockProducts];
      
      // Apply text search
      if (filters.query) {
        const query = filters.query.toLowerCase();
        filteredResults = filteredResults.filter(product => 
          product.title.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }
      
      // Apply category filter
      if (filters.category) {
        filteredResults = filteredResults.filter(product => 
          product.category === filters.category
        );
      }
      
      // Apply price range
      if (filters.priceMin !== undefined) {
        filteredResults = filteredResults.filter(product => 
          product.price >= filters.priceMin!
        );
      }
      if (filters.priceMax !== undefined) {
        filteredResults = filteredResults.filter(product => 
          product.price <= filters.priceMax!
        );
      }
      
      // Apply location filter
      if (filters.location) {
        filteredResults = filteredResults.filter(product => 
          product.location.toLowerCase().includes(filters.location!.toLowerCase())
        );
      }
      
      // Apply rating filter
      if (filters.rating !== undefined) {
        filteredResults = filteredResults.filter(product => 
          product.rating >= filters.rating!
        );
      }
      
      // Apply condition filter
      if (filters.condition) {
        filteredResults = filteredResults.filter(product => 
          product.condition === filters.condition
        );
      }
      
      // Apply seller type filter
      if (filters.sellerType) {
        filteredResults = filteredResults.filter(product => 
          product.seller.type === filters.sellerType
        );
      }
      
      // Apply date filter
      if (filters.datePosted && filters.datePosted !== 'any') {
        const now = new Date();
        const cutoffDate = new Date();
        
        switch (filters.datePosted) {
          case 'today':
            cutoffDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            cutoffDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
        }
        
        filteredResults = filteredResults.filter(product => 
          product.postedDate >= cutoffDate
        );
      }
      
      // Apply sorting
      if (filters.sortBy) {
        filteredResults.sort((a, b) => {
          let comparison = 0;
          
          switch (filters.sortBy) {
            case 'price_low':
              comparison = a.price - b.price;
              break;
            case 'price_high':
              comparison = b.price - a.price;
              break;
            case 'rating':
              comparison = b.rating - a.rating;
              break;
            case 'date':
              comparison = b.postedDate.getTime() - a.postedDate.getTime();
              break;
            case 'popularity':
              comparison = b.views - a.views;
              break;
            case 'relevance':
            default:
              comparison = (b.relevanceScore || 0) - (a.relevanceScore || 0);
              break;
          }
          
          return filters.sortOrder === 'desc' ? -comparison : comparison;
        });
      }
      
      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const startIndex = (page - 1) * limit;
      const paginatedResults = filteredResults.slice(startIndex, startIndex + limit);
      
      setSearchResults(paginatedResults);
      setTotalResults(filteredResults.length);
      
      // Track analytics
      const searchAnalytics: SearchAnalytics = {
        query: filters.query,
        filters,
        resultsCount: filteredResults.length,
        clickedResults: [],
        sessionDuration: 0,
        timestamp: new Date()
      };
      
      setAnalytics(prev => [...prev, searchAnalytics]);
      
    } catch (error) {
      toast.error('Qidiruvda xatolik yuz berdi');
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get suggestions
  const getSuggestions = useCallback(async (query: string) => {
    if (!query) {
      setSuggestions([]);
      return;
    }
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const filteredSuggestions = mockSuggestions.filter(suggestion =>
        suggestion.text.toLowerCase().includes(query.toLowerCase())
      );
      
      setSuggestions(filteredSuggestions);
    } catch (error) {
      console.error('Suggestions error:', error);
    }
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setTotalResults(0);
    setSuggestions([]);
  }, []);

  return {
    searchResults,
    suggestions,
    analytics,
    isLoading,
    totalResults,
    search,
    getSuggestions,
    clearSearch
  };
}

export default function AdvancedSearch() {
  const { search, searchResults, suggestions, getSuggestions, isLoading, totalResults } = useAdvancedSearch();
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    sortBy: 'relevance',
    sortOrder: 'desc',
    page: 1,
    limit: 20
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.query || filters.category || filters.priceMin || filters.priceMax) {
        search(filters);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, search]);

  // Handle query change
  const handleQueryChange = (value: string) => {
    setFilters(prev => ({ ...prev, query: value, page: 1 }));
    getSuggestions(value);
    setShowSuggestions(true);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setFilters(prev => ({ 
      ...prev, 
      query: suggestion.text, 
      page: 1 
    }));
    setShowSuggestions(false);
  };

  // Handle filter change
  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      query: '',
      sortBy: 'relevance',
      sortOrder: 'desc',
      page: 1,
      limit: 20
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Search Header */}
      <div className="mb-6">
        <div className="relative">
          <div className="flex items-center space-x-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={filters.query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Mahsulotlarni qidirish..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-gray-900 dark:text-white">{suggestion.text}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {suggestion.type}
                        </span>
                      </div>
                      {suggestion.count && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {suggestion.count} natija
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-lg border transition-colors ${
                showFilters 
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>

            {/* Sort */}
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                handleFilterChange('sortBy', sortBy);
                handleFilterChange('sortOrder', sortOrder);
              }}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="relevance-desc">Muvofiqlik</option>
              <option value="price_low-asc">Narxi: Past → Yuqori</option>
              <option value="price_high-desc">Narxi: Yuqori → Past</option>
              <option value="rating-desc">Reyting</option>
              <option value="date-desc">Yangi</option>
              <option value="popularity-desc">Ommabop</option>
            </select>
          </div>
        </div>

        {/* Active Filters */}
        {(filters.category || filters.priceMin || filters.priceMax || filters.location || filters.rating) && (
          <div className="flex items-center space-x-2 mt-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">Faol filtrlar:</span>
            {filters.category && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Kategoriya: {filters.category}
              </span>
            )}
            {filters.priceMin && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                Min: {formatCurrency(filters.priceMin)}
              </span>
            )}
            {filters.priceMax && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                Max: {formatCurrency(filters.priceMax)}
              </span>
            )}
            {filters.location && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                {filters.location}
              </span>
            )}
            {filters.rating && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                {filters.rating}+ yulduz
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="text-sm text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Filters Panel */}
        {showFilters && (
          <div className="w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Filtrlar</h3>
            
            {/* Category Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kategoriya
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Barchasi</option>
                <option value="electronics">Elektronika</option>
                <option value="clothing">Kiyim-kechak</option>
                <option value="home">Uy-ro\'zg\'or</option>
                <option value="vehicles">Transport</option>
                <option value="real_estate">Ko\'chmas mulk</option>
              </select>
            </div>

            {/* Price Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Narx oralig'i
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder="Minimum"
                  value={filters.priceMin || ''}
                  onChange={(e) => handleFilterChange('priceMin', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  placeholder="Maximum"
                  value={filters.priceMax || ''}
                  onChange={(e) => handleFilterChange('priceMax', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Location */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Manzil
              </label>
              <input
                type="text"
                placeholder="Shahar yoki viloyat"
                value={filters.location || ''}
                onChange={(e) => handleFilterChange('location', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            {/* Rating */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimal reyting
              </label>
              <select
                value={filters.rating || ''}
                onChange={(e) => handleFilterChange('rating', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Barchasi</option>
                <option value="4">4+ yulduz</option>
                <option value="4.5">4.5+ yulduz</option>
                <option value="5">5 yulduz</option>
              </select>
            </div>

            {/* Condition */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Holati
              </label>
              <select
                value={filters.condition || ''}
                onChange={(e) => handleFilterChange('condition', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Barchasi</option>
                <option value="new">Yangi</option>
                <option value="used">Ishlatilgan</option>
                <option value="refurbished">Qayta tiklangan</option>
              </select>
            </div>

            {/* Date Posted */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                E'langan sanasi
              </label>
              <select
                value={filters.datePosted || 'any'}
                onChange={(e) => handleFilterChange('datePosted', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="any">Qachon bo'lsa</option>
                <option value="today">Bugun</option>
                <option value="week">Oxirgi 7 kun</option>
                <option value="month">Oxirgi 30 kun</option>
              </select>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Qidiruv natijalari
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {totalResults} ta mahsulot topildi
              </p>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Qidiruv amalga oshirilmoqda...</p>
            </div>
          )}

          {/* Results Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((product) => (
                <div key={product.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-w-16 aspect-h-12 bg-gray-200 dark:bg-gray-700">
                    <img
                      src={product.images[0] || '/placeholder.jpg'}
                      alt={product.title}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                      {product.title}
                    </h3>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {product.description}
                    </p>
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(product.price)}
                      </span>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {product.rating}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-500">
                          ({product.reviews})
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{product.location}</span>
                      </div>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {product.condition === 'new' ? 'Yangi' : 
                         product.condition === 'used' ? 'Ishlatilgan' : 'Qayta tiklangan'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isLoading && searchResults.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Hech narsa topilmadi
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Qidiruv shartlarini o'zgartirib ko'ring
              </p>
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Filtrlarni tozalash
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
