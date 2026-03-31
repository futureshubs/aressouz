import { useState, useEffect, useCallback } from 'react';
import { Brain, TrendingUp, Star, Users, ShoppingCart, Eye, Heart, Zap, Target } from 'lucide-react';
import { toast } from 'sonner';

export interface UserProfile {
  id: string;
  userId: string;
  preferences: {
    categories: string[];
    priceRange: { min: number; max: number };
    brands: string[];
    locations: string[];
    conditions: string[];
  };
  behavior: {
    viewHistory: Array<{
      productId: string;
      timestamp: Date;
      duration: number;
      category: string;
      price: number;
    }>;
    searchHistory: Array<{
      query: string;
      timestamp: Date;
      resultsCount: number;
      clickedProducts: string[];
    }>;
    purchaseHistory: Array<{
      productId: string;
      timestamp: Date;
      price: number;
      category: string;
      rating?: number;
    }>;
    favorites: string[];
    cart: string[];
  };
  demographics: {
    age?: number;
    gender?: string;
    location?: string;
    device?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  subcategory: string;
  brand: string;
  location: string;
  rating: number;
  reviews: number;
  images: string[];
  tags: string[];
  features: string[];
  condition: string;
  seller: {
    id: string;
    name: string;
    rating: number;
    type: string;
  };
  views: number;
  likes: number;
  sales: number;
  postedDate: Date;
  popularity: number;
}

export interface Recommendation {
  id: string;
  productId: string;
  userId: string;
  type: 'collaborative' | 'content_based' | 'hybrid' | 'popular' | 'trending' | 'personalized';
  score: number;
  reason: string;
  algorithm: string;
  metadata: {
    similarUsers?: string[];
    similarProducts?: string[];
    factors?: Record<string, number>;
    confidence: number;
  };
  createdAt: Date;
  expiresAt: Date;
  shown: boolean;
  clicked: boolean;
  converted: boolean;
}

const mockProducts: Product[] = [
  {
    id: '1',
    title: 'Samsung Galaxy S24 Ultra',
    description: 'Premium smartphone with advanced features',
    price: 18990000,
    currency: 'UZS',
    category: 'electronics',
    subcategory: 'smartphones',
    brand: 'Samsung',
    location: 'Toshkent',
    rating: 4.8,
    reviews: 234,
    images: ['/images/samsung-s24.jpg'],
    tags: ['smartphone', 'premium', '5g', 'camera'],
    features: ['5G', '200MP camera', '5000mAh', 'S Pen'],
    condition: 'new',
    seller: {
      id: 'seller1',
      name: 'TechStore',
      rating: 4.9,
      type: 'business'
    },
    views: 1250,
    likes: 89,
    sales: 45,
    postedDate: new Date('2025-03-15'),
    popularity: 0.95
  },
  {
    id: '2',
    title: 'iPhone 15 Pro Max',
    description: 'Apple flagship smartphone',
    price: 22450000,
    currency: 'UZS',
    category: 'electronics',
    subcategory: 'smartphones',
    brand: 'Apple',
    location: 'Toshkent',
    rating: 4.9,
    reviews: 456,
    images: ['/images/iphone15.jpg'],
    tags: ['smartphone', 'apple', 'premium', 'pro'],
    features: ['A17 Pro', '5x zoom', 'USB-C', 'Titanium'],
    condition: 'new',
    seller: {
      id: 'seller2',
      name: 'iStore',
      rating: 4.8,
      type: 'verified'
    },
    views: 2340,
    likes: 167,
    sales: 78,
    postedDate: new Date('2025-03-10'),
    popularity: 0.92
  }
];

export function useRecommendationEngine() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create or update user profile
  const updateProfile = useCallback((userId: string, behavior: Partial<UserProfile['behavior']>) => {
    setUserProfile(prev => {
      if (prev) {
        return {
          ...prev,
          behavior: {
            ...prev.behavior,
            ...behavior
          },
          updatedAt: new Date()
        };
      }

      // Create new profile
      return {
        id: `profile_${userId}`,
        userId,
        preferences: {
          categories: [],
          priceRange: { min: 0, max: 100000000 },
          brands: [],
          locations: [],
          conditions: []
        },
        behavior: {
          viewHistory: [],
          searchHistory: [],
          purchaseHistory: [],
          favorites: [],
          cart: [],
          ...behavior
        },
        demographics: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
  }, []);

  // Track user behavior
  const trackView = useCallback((userId: string, productId: string, duration: number) => {
    const product = mockProducts.find(p => p.id === productId);
    if (!product) return;

    updateProfile(userId, {
      viewHistory: [{
        productId,
        timestamp: new Date(),
        duration,
        category: product.category,
        price: product.price
      }]
    });
  }, [updateProfile]);

  // Track search
  const trackSearch = useCallback((userId: string, query: string, resultsCount: number, clickedProducts: string[] = []) => {
    updateProfile(userId, {
      searchHistory: [{
        query,
        timestamp: new Date(),
        resultsCount,
        clickedProducts
      }]
    });
  }, [updateProfile]);

  // Track purchase
  const trackPurchase = useCallback((userId: string, productId: string, price: number, category: string, rating?: number) => {
    updateProfile(userId, {
      purchaseHistory: [{
        productId,
        timestamp: new Date(),
        price,
        category,
        rating
      }]
    });
  }, [updateProfile]);

  // Calculate similarity between users
  const calculateUserSimilarity = useCallback((user1: UserProfile, user2: UserProfile): number => {
    let similarity = 0;
    let factors = 0;

    // Category similarity
    const commonCategories = user1.preferences.categories.filter(cat => 
      user2.preferences.categories.includes(cat)
    );
    if (user1.preferences.categories.length > 0 && user2.preferences.categories.length > 0) {
      similarity += commonCategories.length / Math.max(user1.preferences.categories.length, user2.preferences.categories.length);
      factors++;
    }

    // Brand similarity
    const commonBrands = user1.preferences.brands.filter(brand => 
      user2.preferences.brands.includes(brand)
    );
    if (user1.preferences.brands.length > 0 && user2.preferences.brands.length > 0) {
      similarity += commonBrands.length / Math.max(user1.preferences.brands.length, user2.preferences.brands.length);
      factors++;
    }

    // Price range similarity
    const priceOverlap = Math.min(user1.preferences.priceRange.max, user2.preferences.priceRange.max) - 
                        Math.max(user1.preferences.priceRange.min, user2.preferences.priceRange.min);
    const priceRange1 = user1.preferences.priceRange.max - user1.preferences.priceRange.min;
    const priceRange2 = user2.preferences.priceRange.max - user2.preferences.priceRange.min;
    if (priceOverlap > 0 && priceRange1 > 0 && priceRange2 > 0) {
      similarity += priceOverlap / Math.max(priceRange1, priceRange2);
      factors++;
    }

    return factors > 0 ? similarity / factors : 0;
  }, []);

  // Calculate content similarity
  const calculateContentSimilarity = useCallback((product1: Product, product2: Product): number => {
    let similarity = 0;
    let factors = 0;

    // Category similarity
    if (product1.category === product2.category) {
      similarity += 1;
      factors++;
    }

    // Brand similarity
    if (product1.brand === product2.brand) {
      similarity += 0.8;
      factors++;
    }

    // Price similarity
    const priceDiff = Math.abs(product1.price - product2.price);
    const avgPrice = (product1.price + product2.price) / 2;
    if (avgPrice > 0) {
      const priceSimilarity = 1 - (priceDiff / avgPrice);
      similarity += priceSimilarity * 0.5;
      factors++;
    }

    // Tag similarity
    const commonTags = product1.tags.filter(tag => product2.tags.includes(tag));
    if (product1.tags.length > 0 && product2.tags.length > 0) {
      similarity += commonTags.length / Math.max(product1.tags.length, product2.tags.length);
      factors++;
    }

    return factors > 0 ? similarity / factors : 0;
  }, []);

  // Generate collaborative filtering recommendations
  const generateCollaborativeRecommendations = useCallback(async (userId: string): Promise<Recommendation[]> => {
    if (!userProfile) return [];

    // Find similar users (mock implementation)
    const similarUsers = ['user_2', 'user_3', 'user_4']; // In real app, this would be calculated

    // Get products liked by similar users
    const recommendedProducts: Recommendation[] = mockProducts
      .filter(product => !userProfile.behavior.viewHistory.some(view => view.productId === product.id))
      .slice(0, 5)
      .map((product, index) => ({
        id: `rec_collab_${Date.now()}_${index}`,
        productId: product.id,
        userId,
        type: 'collaborative' as const,
        score: 0.8 - (index * 0.1),
        reason: `Sizga o'xshash foydalanuvchilar bu mahsulotni yoqtirishgan`,
        algorithm: 'collaborative_filtering',
        metadata: {
          similarUsers,
          confidence: 0.85
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        shown: false,
        clicked: false,
        converted: false
      }));

    return recommendedProducts;
  }, [userProfile]);

  // Generate content-based recommendations
  const generateContentBasedRecommendations = useCallback(async (userId: string): Promise<Recommendation[]> => {
    if (!userProfile) return [];

    // Get user's viewed products
    const viewedProducts = userProfile.behavior.viewHistory.map(view => 
      mockProducts.find(p => p.id === view.productId)
    ).filter(Boolean) as Product[];

    if (viewedProducts.length === 0) return [];

    // Find similar products
    const recommendations: Recommendation[] = [];
    
    viewedProducts.forEach(viewedProduct => {
      const similarProducts = mockProducts
        .filter(product => 
          product.id !== viewedProduct.id &&
          !userProfile.behavior.viewHistory.some(view => view.productId === product.id)
        )
        .map(product => ({
          product,
          similarity: calculateContentSimilarity(viewedProduct, product)
        }))
        .filter(item => item.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);

      similarProducts.forEach((item, index) => {
        recommendations.push({
          id: `rec_content_${Date.now()}_${item.product.id}`,
          productId: item.product.id,
          userId,
          type: 'content_based' as const,
          score: item.similarity,
          reason: `"${viewedProduct.title}" mahsulotiga o'xshash`,
          algorithm: 'content_based_filtering',
          metadata: {
            similarProducts: [viewedProduct.id],
            factors: { contentSimilarity: item.similarity },
            confidence: item.similarity
          },
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          shown: false,
          clicked: false,
          converted: false
        });
      });
    });

    return recommendations.slice(0, 10);
  }, [userProfile, calculateContentSimilarity]);

  // Generate popular recommendations
  const generatePopularRecommendations = useCallback(async (userId: string): Promise<Recommendation[]> => {
    const popularProducts = mockProducts
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);

    return popularProducts.map((product, index) => ({
      id: `rec_popular_${Date.now()}_${index}`,
      productId: product.id,
      userId,
      type: 'popular' as const,
      score: product.popularity,
      reason: 'Hozircha eng mashhur mahsulotlar',
      algorithm: 'popularity_based',
      metadata: {
        confidence: product.popularity
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      shown: false,
      clicked: false,
      converted: false
    }));
  }, []);

  // Generate hybrid recommendations
  const generateHybridRecommendations = useCallback(async (userId: string): Promise<Recommendation[]> => {
    const [collaborative, contentBased, popular] = await Promise.all([
      generateCollaborativeRecommendations(userId),
      generateContentBasedRecommendations(userId),
      generatePopularRecommendations(userId)
    ]);

    // Combine and weight different recommendation types
    const hybridRecommendations: Recommendation[] = [
      ...collaborative.map(rec => ({ ...rec, type: 'hybrid' as const, score: rec.score * 0.5 })),
      ...contentBased.map(rec => ({ ...rec, type: 'hybrid' as const, score: rec.score * 0.3 })),
      ...popular.map(rec => ({ ...rec, type: 'hybrid' as const, score: rec.score * 0.2 }))
    ];

    // Sort by score and remove duplicates
    const uniqueRecommendations = hybridRecommendations
      .sort((a, b) => b.score - a.score)
      .filter((rec, index, arr) => arr.findIndex(r => r.productId === rec.productId) === index)
      .slice(0, 10);

    return uniqueRecommendations;
  }, [generateCollaborativeRecommendations, generateContentBasedRecommendations, generatePopularRecommendations]);

  // Get recommendations for user
  const getRecommendations = useCallback(async (userId: string, type: 'all' | 'collaborative' | 'content_based' | 'popular' | 'hybrid' = 'all') => {
    setIsLoading(true);
    
    try {
      let recs: Recommendation[] = [];

      switch (type) {
        case 'collaborative':
          recs = await generateCollaborativeRecommendations(userId);
          break;
        case 'content_based':
          recs = await generateContentBasedRecommendations(userId);
          break;
        case 'popular':
          recs = await generatePopularRecommendations(userId);
          break;
        case 'hybrid':
          recs = await generateHybridRecommendations(userId);
          break;
        case 'all':
        default:
          recs = await generateHybridRecommendations(userId);
          break;
      }

      setRecommendations(recs);
      return recs;
    } catch (error) {
      toast.error('Tavsiyalarni yuklashda xatolik');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [generateCollaborativeRecommendations, generateContentBasedRecommendations, generatePopularRecommendations, generateHybridRecommendations]);

  // Track recommendation interaction
  const trackRecommendationInteraction = useCallback((recommendationId: string, interaction: 'shown' | 'clicked' | 'converted') => {
    setRecommendations(prev => prev.map(rec => 
      rec.id === recommendationId 
        ? { ...rec, [interaction]: true }
        : rec
    ));
  }, []);

  return {
    recommendations,
    userProfile,
    isLoading,
    updateProfile,
    trackView,
    trackSearch,
    trackPurchase,
    getRecommendations,
    trackRecommendationInteraction,
    calculateUserSimilarity,
    calculateContentSimilarity
  };
}

export default function RecommendationEngine({ userId }: { userId: string }) {
  const { 
    recommendations, 
    isLoading, 
    getRecommendations, 
    trackRecommendationInteraction 
  } = useRecommendationEngine();

  const [selectedType, setSelectedType] = useState<'all' | 'collaborative' | 'content_based' | 'popular' | 'hybrid'>('hybrid');

  useEffect(() => {
    if (userId) {
      getRecommendations(userId, selectedType);
    }
  }, [userId, selectedType, getRecommendations]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRecommendationIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'collaborative': return <Users className="w-4 h-4 text-blue-500" />;
      case 'content_based': return <Target className="w-4 h-4 text-green-500" />;
      case 'popular': return <TrendingUp className="w-4 h-4 text-purple-500" />;
      case 'hybrid': return <Brain className="w-4 h-4 text-orange-500" />;
      default: return <Star className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRecommendationTypeLabel = (type: Recommendation['type']) => {
    switch (type) {
      case 'collaborative': return 'Kollaborativ';
      case 'content_based': return 'Kontent asosida';
      case 'popular': return 'Mashhur';
      case 'hybrid': return 'Gibrid';
      default: return 'Tavsiya';
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Brain className="w-6 h-6 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Siz uchun tavsiyalar
          </h3>
        </div>
        
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="hybrid">Gibrid tavsiyalar</option>
          <option value="collaborative">Kollaborativ</option>
          <option value="content_based">Kontent asosida</option>
          <option value="popular">Mashhur mahsulotlar</option>
        </select>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <Brain className="w-12 h-12 text-purple-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-400">
            AI tavsiyalarni hisoblayapmiz...
          </p>
        </div>
      )}

      {/* Recommendations Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((recommendation) => {
            const product = mockProducts.find(p => p.id === recommendation.productId);
            if (!product) return null;

            return (
              <div
                key={recommendation.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                onClick={() => trackRecommendationInteraction(recommendation.id, 'clicked')}
              >
                <div className="aspect-w-16 aspect-h-12 bg-gray-200 dark:bg-gray-700">
                  <img
                    src={product.images[0] || '/placeholder.jpg'}
                    alt={product.title}
                    className="w-full h-48 object-cover"
                  />
                </div>
                
                <div className="p-4">
                  {/* Recommendation Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getRecommendationIcon(recommendation.type)}
                      <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                        {getRecommendationTypeLabel(recommendation.type)}
                      </span>
                    </div>
                    <div className="text-xs text-purple-600 font-medium">
                      {(recommendation.score * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Product Info */}
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
                    </div>
                  </div>

                  {/* Recommendation Reason */}
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Zap className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                        Nima uchun tavsiya etiladi:
                      </span>
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      {recommendation.reason}
                    </p>
                  </div>

                  {/* Product Details */}
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Eye className="w-4 h-4" />
                      <span>{product.views} ko'rilgan</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ShoppingCart className="w-4 h-4" />
                      <span>{product.sales} sotilgan</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No Recommendations */}
      {!isLoading && recommendations.length === 0 && (
        <div className="text-center py-12">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Hali tavsiyalar yo'q
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Ko'proq mahsulotlarni ko'rib chiqing va biz sizga shaxsiy tavsiyalar beramiz
          </p>
          <button
            onClick={() => getRecommendations(userId, 'popular')}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Mashhur mahsulotlarni ko'rish
          </button>
        </div>
      )}
    </div>
  );
}
