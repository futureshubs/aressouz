import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Eye, Heart, ShoppingCart, Clock, Calendar, BarChart3, Users, Zap, Award, Star } from 'lucide-react';
import { toast } from 'sonner';

export interface TrendingProduct {
  id: string;
  productId: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  subcategory: string;
  brand: string;
  location: string;
  rating: number;
  reviews: number;
  images: string[];
  seller: {
    id: string;
    name: string;
    rating: number;
    type: string;
  };
  
  // Trending metrics
  trendScore: number;
  trendDirection: 'up' | 'down' | 'stable';
  trendPercentage: number;
  
  // Popularity metrics
  views: number;
  viewsChange: number;
  likes: number;
  likesChange: number;
  sales: number;
  salesChange: number;
  searches: number;
  searchesChange: number;
  
  // Time-based data
  hourlyViews: number[];
  dailyViews: number[];
  weeklyViews: number[];
  monthlyViews: number[];
  
  // Engagement metrics
  clickThroughRate: number;
  conversionRate: number;
  averageViewTime: number;
  bounceRate: number;
  
  // Social metrics
  shares: number;
  comments: number;
  mentions: number;
  
  // Metadata
  postedDate: Date;
  lastUpdated: Date;
  tags: string[];
  features: string[];
}

export interface TrendingCategory {
  category: string;
  productCount: number;
  totalViews: number;
  totalSales: number;
  averageRating: number;
  trendDirection: 'up' | 'down' | 'stable';
  topProducts: string[];
}

export interface TrendingLocation {
  location: string;
  productCount: number;
  totalViews: number;
  totalSales: number;
  trendingProducts: string[];
  trendDirection: 'up' | 'down' | 'stable';
}

export interface TrendingPeriod {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  data: Array<{
    timestamp: Date;
    views: number;
    sales: number;
    searches: number;
    uniqueUsers: number;
  }>;
}

const mockTrendingProducts: TrendingProduct[] = [
  {
    id: 'trend_1',
    productId: '1',
    title: 'Samsung Galaxy S24 Ultra',
    price: 18990000,
    currency: 'UZS',
    category: 'electronics',
    subcategory: 'smartphones',
    brand: 'Samsung',
    location: 'Toshkent',
    rating: 4.8,
    reviews: 234,
    images: ['/images/samsung-s24.jpg'],
    seller: {
      id: 'seller1',
      name: 'TechStore',
      rating: 4.9,
      type: 'business'
    },
    trendScore: 0.95,
    trendDirection: 'up',
    trendPercentage: 45.2,
    views: 1250,
    viewsChange: 450,
    likes: 89,
    likesChange: 32,
    sales: 45,
    salesChange: 18,
    searches: 890,
    searchesChange: 340,
    hourlyViews: [120, 145, 167, 189, 201, 178, 156, 134, 145, 167, 189, 201],
    dailyViews: [1200, 1350, 1450, 1250],
    weeklyViews: [8500, 9200, 8900, 9500],
    monthlyViews: [35000, 38000, 36000, 39000],
    clickThroughRate: 8.5,
    conversionRate: 3.6,
    averageViewTime: 45000,
    bounceRate: 25.3,
    shares: 67,
    comments: 23,
    mentions: 145,
    postedDate: new Date('2025-03-15'),
    lastUpdated: new Date('2025-03-19'),
    tags: ['smartphone', 'premium', '5g', 'camera', 'samsung'],
    features: ['5G', '200MP camera', '5000mAh', 'S Pen']
  },
  {
    id: 'trend_2',
    productId: '2',
    title: 'iPhone 15 Pro Max',
    price: 22450000,
    currency: 'UZS',
    category: 'electronics',
    subcategory: 'smartphones',
    brand: 'Apple',
    location: 'Toshkent',
    rating: 4.9,
    reviews: 456,
    images: ['/images/iphone15.jpg'],
    seller: {
      id: 'seller2',
      name: 'iStore',
      rating: 4.8,
      type: 'verified'
    },
    trendScore: 0.92,
    trendDirection: 'up',
    trendPercentage: 38.7,
    views: 2340,
    viewsChange: 680,
    likes: 167,
    likesChange: 45,
    sales: 78,
    salesChange: 23,
    searches: 1560,
    searchesChange: 520,
    hourlyViews: [198, 234, 267, 289, 301, 278, 256, 234, 245, 267, 289, 301],
    dailyViews: [2100, 2350, 2450, 2340],
    weeklyViews: [16500, 17200, 16900, 17500],
    monthlyViews: [75000, 78000, 76000, 79000],
    clickThroughRate: 9.2,
    conversionRate: 3.3,
    averageViewTime: 48000,
    bounceRate: 22.1,
    shares: 89,
    comments: 34,
    mentions: 203,
    postedDate: new Date('2025-03-10'),
    lastUpdated: new Date('2025-03-19'),
    tags: ['smartphone', 'apple', 'premium', 'pro', 'iphone'],
    features: ['A17 Pro', '5x zoom', 'USB-C', 'Titanium']
  },
  {
    id: 'trend_3',
    productId: '3',
    title: 'MacBook Air M2',
    price: 15670000,
    currency: 'UZS',
    category: 'electronics',
    subcategory: 'laptops',
    brand: 'Apple',
    location: 'Toshkent',
    rating: 4.7,
    reviews: 123,
    images: ['/images/macbook-air.jpg'],
    seller: {
      id: 'seller3',
      name: 'Apple Premium Reseller',
      rating: 4.9,
      type: 'verified'
    },
    trendScore: 0.88,
    trendDirection: 'up',
    trendPercentage: 28.3,
    views: 890,
    viewsChange: 220,
    likes: 67,
    likesChange: 18,
    sales: 34,
    salesChange: 12,
    searches: 560,
    searchesChange: 180,
    hourlyViews: [78, 89, 97, 108, 115, 98, 87, 78, 89, 97, 108, 115],
    dailyViews: [820, 890, 910, 890],
    weeklyViews: [6200, 6500, 6300, 6400],
    monthlyViews: [28000, 29000, 28500, 29500],
    clickThroughRate: 7.8,
    conversionRate: 3.8,
    averageViewTime: 52000,
    bounceRate: 28.5,
    shares: 45,
    comments: 19,
    mentions: 89,
    postedDate: new Date('2025-03-12'),
    lastUpdated: new Date('2025-03-19'),
    tags: ['laptop', 'apple', 'm2', 'macbook', 'premium'],
    features: ['M2 chip', '18-hour battery', 'Liquid Retina', 'MagSafe']
  }
];

const mockTrendingCategories: TrendingCategory[] = [
  {
    category: 'electronics',
    productCount: 1234,
    totalViews: 45670,
    totalSales: 890,
    averageRating: 4.6,
    trendDirection: 'up',
    topProducts: ['1', '2', '3']
  },
  {
    category: 'clothing',
    productCount: 3456,
    totalViews: 23450,
    totalSales: 567,
    averageRating: 4.3,
    trendDirection: 'stable',
    topProducts: ['4', '5', '6']
  },
  {
    category: 'home',
    productCount: 890,
    totalViews: 12340,
    totalSales: 234,
    averageRating: 4.4,
    trendDirection: 'down',
    topProducts: ['7', '8', '9']
  }
];

const mockTrendingLocations: TrendingLocation[] = [
  {
    location: 'Toshkent',
    productCount: 5678,
    totalViews: 89000,
    totalSales: 1234,
    trendingProducts: ['1', '2', '3'],
    trendDirection: 'up'
  },
  {
    location: 'Samarqand',
    productCount: 2345,
    totalViews: 34500,
    totalSales: 567,
    trendingProducts: ['4', '5', '6'],
    trendDirection: 'up'
  },
  {
    location: 'Buxoro',
    productCount: 1234,
    totalViews: 15600,
    totalSales: 234,
    trendingProducts: ['7', '8', '9'],
    trendDirection: 'stable'
  }
];

export function useTrendingProducts() {
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>(mockTrendingProducts);
  const [trendingCategories, setTrendingCategories] = useState<TrendingCategory[]>(mockTrendingCategories);
  const [trendingLocations, setTrendingLocations] = useState<TrendingLocation[]>(mockTrendingLocations);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Calculate trend score
  const calculateTrendScore = useCallback((product: TrendingProduct): number => {
    const viewsWeight = 0.3;
    const salesWeight = 0.25;
    const searchesWeight = 0.2;
    const engagementWeight = 0.15;
    const socialWeight = 0.1;

    const normalizedViews = Math.min(product.views / 10000, 1);
    const normalizedSales = Math.min(product.sales / 100, 1);
    const normalizedSearches = Math.min(product.searches / 1000, 1);
    const normalizedEngagement = (product.clickThroughRate / 10) * (product.conversionRate / 5);
    const normalizedSocial = Math.min(product.shares / 100, 1);

    return (
      normalizedViews * viewsWeight +
      normalizedSales * salesWeight +
      normalizedSearches * searchesWeight +
      normalizedEngagement * engagementWeight +
      normalizedSocial * socialWeight
    );
  }, []);

  // Update trending data
  const updateTrendingData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Mock API call to update trending data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate data updates with random changes
      const updatedProducts = trendingProducts.map(product => ({
        ...product,
        views: product.views + Math.floor(Math.random() * 50) - 25,
        likes: product.likes + Math.floor(Math.random() * 10) - 5,
        sales: product.sales + Math.floor(Math.random() * 5) - 2,
        searches: product.searches + Math.floor(Math.random() * 30) - 15,
        trendScore: calculateTrendScore(product)
      }));

      setTrendingProducts(updatedProducts);
      
      // Sort by trend score
      const sortedProducts = [...updatedProducts].sort((a, b) => b.trendScore - a.trendScore);
      setTrendingProducts(sortedProducts);
      
    } catch (error) {
      toast.error('Trend ma\'lumotlarini yangilashda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, [trendingProducts, calculateTrendScore]);

  // Get trending products by category
  const getTrendingByCategory = useCallback((category: string, limit: number = 10) => {
    return trendingProducts
      .filter(product => product.category === category)
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);
  }, [trendingProducts]);

  // Get trending products by location
  const getTrendingByLocation = useCallback((location: string, limit: number = 10) => {
    return trendingProducts
      .filter(product => product.location === location)
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);
  }, [trendingProducts]);

  // Get top trending products
  const getTopTrending = useCallback((limit: number = 10) => {
    return trendingProducts
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);
  }, [trendingProducts]);

  // Get rising trends (products with highest growth)
  const getRisingTrends = useCallback((limit: number = 10) => {
    return trendingProducts
      .filter(product => product.trendDirection === 'up')
      .sort((a, b) => b.trendPercentage - a.trendPercentage)
      .slice(0, limit);
  }, [trendingProducts]);

  // Get falling trends
  const getFallingTrends = useCallback((limit: number = 10) => {
    return trendingProducts
      .filter(product => product.trendDirection === 'down')
      .sort((a, b) => a.trendPercentage - b.trendPercentage)
      .slice(0, limit);
  }, [trendingProducts]);

  // Export trending data
  const exportTrendingData = useCallback(async (format: 'csv' | 'excel' | 'json') => {
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success(`Trend ma\'lumotlari ${format.toUpperCase()} formatida eksport qilindi`);
    } catch (error) {
      toast.error('Eksport qilishda xatolik');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    updateTrendingData();
    
    // Auto-update every 5 minutes
    const interval = setInterval(updateTrendingData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [updateTrendingData]);

  return {
    trendingProducts,
    trendingCategories,
    trendingLocations,
    isLoading,
    timeRange,
    setTimeRange,
    updateTrendingData,
    getTrendingByCategory,
    getTrendingByLocation,
    getTopTrending,
    getRisingTrends,
    getFallingTrends,
    exportTrendingData
  };
}

export default function TrendingProductsDashboard() {
  const {
    trendingProducts,
    trendingCategories,
    trendingLocations,
    isLoading,
    timeRange,
    setTimeRange,
    getTopTrending,
    getRisingTrends,
    getFallingTrends,
    exportTrendingData
  } = useTrendingProducts();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'stable': return <Minus className="w-4 h-4 text-yellow-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTrendColor = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      case 'stable': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const topTrending = getTopTrending(10);
  const risingTrends = getRisingTrends(5);
  const fallingTrends = getFallingTrends(5);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Trend mahsulotlar
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="1h">Oxirgi 1 soat</option>
            <option value="24h">Oxirgi 24 soat</option>
            <option value="7d">Oxirgi 7 kun</option>
            <option value="30d">Oxirgi 30 kun</option>
          </select>
          
          {/* Export Button */}
          <button
            onClick={() => exportTrendingData('csv')}
            disabled={isLoading}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            Eksport
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="p-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-8 h-8 text-orange-500" />
            <span className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {trendingProducts.length}
            </span>
          </div>
          <p className="text-orange-700 dark:text-orange-300">Trend mahsulotlar</p>
        </div>

        <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-bold text-green-900 dark:text-green-100">
              {risingTrends.length}
            </span>
          </div>
          <p className="text-green-700 dark:text-green-300">O'sayotgan trendlar</p>
        </div>

        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-8 h-8 text-red-500" />
            <span className="text-2xl font-bold text-red-900 dark:text-red-100">
              {fallingTrends.length}
            </span>
          </div>
          <p className="text-red-700 dark:text-red-300">Kamayotgan trendlar</p>
        </div>

        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-500" />
            <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {trendingProducts.reduce((sum, p) => sum + p.views, 0).toLocaleString()}
            </span>
          </div>
          <p className="text-blue-700 dark:text-blue-300">Jami ko'rishlar</p>
        </div>
      </div>

      {/* Top Trending Products */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Eng ko'p trend mahsulotlar
        </h3>
        <div className="space-y-4">
          {topTrending.map((product, index) => (
            <div key={product.id} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600 dark:text-orange-400 font-bold">
                    {index + 1}
                  </span>
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {product.title}
                  </h4>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(product.trendDirection)}
                    <span className={`font-medium ${getTrendColor(product.trendDirection)}`}>
                      {product.trendPercentage > 0 ? '+' : ''}{product.trendPercentage}%
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center space-x-1">
                    <Eye className="w-4 h-4" />
                    <span>{product.views.toLocaleString()}</span>
                    <span className="text-green-600">(+{product.viewsChange})</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Heart className="w-4 h-4" />
                    <span>{product.likes}</span>
                    <span className="text-green-600">(+{product.likesChange})</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <ShoppingCart className="w-4 h-4" />
                    <span>{product.sales}</span>
                    <span className="text-green-600">(+{product.salesChange})</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Zap className="w-4 h-4" />
                    <span>{product.searches}</span>
                    <span className="text-green-600">(+{product.searchesChange})</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-bold text-blue-600">
                  {formatCurrency(product.price)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Trend Score: {(product.trendScore * 100).toFixed(1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rising and Falling Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Rising Trends */}
        <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span>O'sayotgan trendlar</span>
          </h3>
          <div className="space-y-3">
            {risingTrends.map((product, index) => (
              <div key={product.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-green-600 font-medium">#{index + 1}</span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {product.title}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {product.category}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-600 font-bold">
                    +{product.trendPercentage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {product.views} ko'rilgan
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Falling Trends */}
        <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            <span>Kamayotgan trendlar</span>
          </h3>
          <div className="space-y-3">
            {fallingTrends.map((product, index) => (
              <div key={product.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-red-600 font-medium">#{index + 1}</span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {product.title}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {product.category}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-red-600 font-bold">
                    {product.trendPercentage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {product.views} ko'rilgan
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trending Categories */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Trend kategoriyalar
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trendingCategories.map((category, index) => (
            <div key={category.category} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                  {category.category}
                </h4>
                {getTrendIcon(category.trendDirection)}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Mahsulotlar:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.productCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Ko'rishlar:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.totalViews.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Sotuvlar:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.totalSales.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Reyting:</span>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {category.averageRating}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trending Locations */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Trend shaharlar
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trendingLocations.map((location, index) => (
            <div key={location.location} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {location.location}
                </h4>
                {getTrendIcon(location.trendDirection)}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Mahsulotlar:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {location.productCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Ko'rishlar:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {location.totalViews.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Sotuvlar:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {location.totalSales.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
