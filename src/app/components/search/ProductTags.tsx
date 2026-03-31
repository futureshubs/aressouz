import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, X, Edit, Trash2, Search, Filter, TrendingUp, Hash, Package, BarChart3, Users, Eye, Star } from 'lucide-react';
import { toast } from 'sonner';

export interface ProductTag {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  
  // Usage statistics
  usageCount: number;
  productCount: number;
  searchCount: number;
  clickCount: number;
  
  // Metadata
  isActive: boolean;
  isFeatured: boolean;
  isSystem: boolean;
  
  // Category/Type
  category: 'feature' | 'brand' | 'style' | 'material' | 'condition' | 'price_range' | 'target_audience' | 'occasion' | 'custom';
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  
  // Related tags
  relatedTags: string[];
  
  // Analytics
  trending: boolean;
  trendScore: number;
  lastUsed?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface TagUsage {
  tagId: string;
  tagName: string;
  productId: string;
  productName: string;
  productCategory: string;
  usageDate: Date;
  context: 'title' | 'description' | 'features' | 'custom';
  weight: number; // Tag importance for this product
}

export interface TagStats {
  totalTags: number;
  activeTags: number;
  featuredTags: number;
  systemTags: number;
  customTags: number;
  totalUsage: number;
  averageUsagePerTag: number;
  topTags: Array<{
    id: string;
    name: string;
    usageCount: number;
    productCount: number;
    category: string;
    trendScore: number;
  }>;
  categoryStats: Record<string, {
    count: number;
    usage: number;
    topTags: string[];
  }>;
  trendingTags: Array<{
    id: string;
    name: string;
    trendScore: number;
    growth: number;
  }>;
}

export interface TagFilter {
  search?: string;
  category?: string;
  status?: 'all' | 'active' | 'inactive';
  featured?: 'all' | 'featured' | 'not_featured';
  system?: 'all' | 'system' | 'custom';
  hasUsage?: boolean;
  minUsage?: number;
  maxUsage?: number;
  sortBy?: 'name' | 'usage' | 'products' | 'trending' | 'created';
  sortOrder?: 'asc' | 'desc';
}

const mockTags: ProductTag[] = [
  {
    id: 'tag_1',
    name: 'premium',
    slug: 'premium',
    description: 'Yuqori sifatli va qimmatbaho mahsulotlar',
    color: '#FFD700',
    category: 'price_range',
    usageCount: 456,
    productCount: 234,
    searchCount: 1234,
    clickCount: 567,
    isActive: true,
    isFeatured: true,
    isSystem: false,
    seoTitle: 'Premium mahsulotlar',
    seoDescription: 'Eng yuqori sifatli premium mahsulotlar',
    seoKeywords: ['premium', 'luxury', 'high-quality', 'premium'],
    relatedTags: ['luxury', 'high-quality', 'exclusive'],
    trending: true,
    trendScore: 0.85,
    lastUsed: new Date('2025-03-19'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'admin',
    updatedBy: 'admin'
  },
  {
    id: 'tag_2',
    name: 'eco-friendly',
    slug: 'eco-friendly',
    description: 'Atrof-muhitga do\'st mahsulotlar',
    color: '#10B981',
    category: 'feature',
    usageCount: 345,
    productCount: 189,
    searchCount: 890,
    clickCount: 432,
    isActive: true,
    isFeatured: true,
    isSystem: false,
    seoTitle: 'Eco-friendly mahsulotlar',
    seoDescription: 'Atrof-muhitni himoya qiluvchi mahsulotlar',
    seoKeywords: ['eco-friendly', 'green', 'sustainable', 'environmental'],
    relatedTags: ['sustainable', 'green', 'organic'],
    trending: true,
    trendScore: 0.78,
    lastUsed: new Date('2025-03-18'),
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-03-18'),
    createdBy: 'admin',
    updatedBy: 'admin'
  },
  {
    id: 'tag_3',
    name: '5g',
    slug: '5g',
    description: '5G texnologiyasini qo\'llab-quvvatlaydigan qurilmalar',
    color: '#3B82F6',
    category: 'feature',
    usageCount: 234,
    productCount: 123,
    searchCount: 567,
    clickCount: 289,
    isActive: true,
    isFeatured: false,
    isSystem: true,
    seoTitle: '5G qurilmalar',
    seoDescription: '5G texnologiyasini qo\'llab-quvvatlaydigan qurilmalar',
    seoKeywords: ['5g', 'network', 'technology', 'mobile'],
    relatedTags: ['network', 'technology', 'mobile'],
    trending: true,
    trendScore: 0.72,
    lastUsed: new Date('2025-03-19'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'system',
    updatedBy: 'admin'
  },
  {
    id: 'tag_4',
    name: 'new-arrival',
    slug: 'new-arrival',
    description: 'Yangi kelgan mahsulotlar',
    color: '#EF4444',
    category: 'condition',
    usageCount: 678,
    productCount: 345,
    searchCount: 2345,
    clickCount: 1234,
    isActive: true,
    isFeatured: true,
    isSystem: true,
    seoTitle: 'Yangi mahsulotlar',
    seoDescription: 'Do\'konga yangi kelgan mahsulotlar',
    seoKeywords: ['new', 'arrival', 'latest', 'fresh'],
    relatedTags: ['latest', 'fresh', 'just-in'],
    trending: false,
    trendScore: 0.65,
    lastUsed: new Date('2025-03-19'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'system',
    updatedBy: 'admin'
  },
  {
    id: 'tag_5',
    name: 'handmade',
    slug: 'handmade',
    description: 'Qo\'lda ishlangan mahsulotlar',
    color: '#8B5CF6',
    category: 'style',
    usageCount: 123,
    productCount: 67,
    searchCount: 345,
    clickCount: 178,
    isActive: true,
    isFeatured: false,
    isSystem: false,
    seoTitle: 'Qo\'lda ishlangan mahsulotlar',
    seoDescription: 'Qo\'lda ishlangan noyob mahsulotlar',
    seoKeywords: ['handmade', 'craft', 'art', 'custom'],
    relatedTags: ['craft', 'art', 'custom', 'unique'],
    trending: false,
    trendScore: 0.45,
    lastUsed: new Date('2025-03-17'),
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-03-17'),
    createdBy: 'user_1',
    updatedBy: 'user_1'
  }
];

const mockTagUsages: TagUsage[] = [
  {
    tagId: 'tag_1',
    tagName: 'premium',
    productId: 'product_1',
    productName: 'Samsung Galaxy S24 Ultra',
    productCategory: 'electronics',
    usageDate: new Date('2025-03-19'),
    context: 'features',
    weight: 0.9
  },
  {
    tagId: 'tag_2',
    tagName: 'eco-friendly',
    productId: 'product_2',
    productName: 'Organik Cotton T-shirt',
    productCategory: 'clothing',
    usageDate: new Date('2025-03-18'),
    context: 'description',
    weight: 0.8
  }
];

export function useProductTags() {
  const [tags, setTags] = useState<ProductTag[]>(mockTags);
  const [tagUsages, setTagUsages] = useState<TagUsage[]>(mockTagUsages);
  const [tagStats, setTagStats] = useState<TagStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create new tag
  const createTag = useCallback(async (tagData: Omit<ProductTag, 'id' | 'usageCount' | 'productCount' | 'searchCount' | 'clickCount' | 'trending' | 'trendScore' | 'createdAt' | 'updatedAt'>) => {
    setIsLoading(true);
    
    try {
      const newTag: ProductTag = {
        ...tagData,
        id: `tag_${Date.now()}`,
        usageCount: 0,
        productCount: 0,
        searchCount: 0,
        clickCount: 0,
        trending: false,
        trendScore: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTags(prev => [...prev, newTag]);
      toast.success('Tag yaratildi');
      return newTag;
    } catch (error) {
      toast.error('Tag yaratishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update tag
  const updateTag = useCallback(async (id: string, updates: Partial<ProductTag>) => {
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTags(prev => prev.map(tag => 
        tag.id === id 
          ? { ...tag, ...updates, updatedAt: new Date() }
          : tag
      ));
      
      toast.success('Tag yangilandi');
    } catch (error) {
      toast.error('Tag yangilashda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete tag
  const deleteTag = useCallback(async (id: string) => {
    setIsLoading(true);
    
    try {
      // Check if tag is in use
      const tag = tags.find(t => t.id === id);
      if (tag && tag.usageCount > 0) {
        throw new Error('Tag ishlatilmoqda, o\'chirib bo\'lmaydi');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTags(prev => prev.filter(tag => tag.id !== id));
      setTagUsages(prev => prev.filter(usage => usage.tagId !== id));
      
      toast.success('Tag o\'chirildi');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tag o\'chirishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [tags]);

  // Toggle tag status
  const toggleTagStatus = useCallback(async (id: string) => {
    const tag = tags.find(t => t.id === id);
    if (!tag) return;

    await updateTag(id, { isActive: !tag.isActive });
  }, [tags, updateTag]);

  // Toggle featured status
  const toggleFeaturedStatus = useCallback(async (id: string) => {
    const tag = tags.find(t => t.id === id);
    if (!tag) return;

    await updateTag(id, { isFeatured: !tag.isFeatured });
  }, [tags, updateTag]);

  // Get tag by ID
  const getTagById = useCallback((id: string): ProductTag | undefined => {
    return tags.find(tag => tag.id === id);
  }, [tags]);

  // Get tags by category
  const getTagsByCategory = useCallback((category: string): ProductTag[] => {
    return tags.filter(tag => tag.category === category && tag.isActive);
  }, [tags]);

  // Get featured tags
  const getFeaturedTags = useCallback((limit?: number): ProductTag[] => {
    const featured = tags.filter(tag => tag.isFeatured && tag.isActive);
    return limit ? featured.slice(0, limit) : featured;
  }, [tags]);

  // Get trending tags
  const getTrendingTags = useCallback((limit?: number): ProductTag[] => {
    const trending = tags.filter(tag => tag.trending && tag.isActive);
    return limit ? trending.slice(0, limit) : trending;
  }, [tags]);

  // Search tags
  const searchTags = useCallback((query: string): ProductTag[] => {
    const searchTerm = query.toLowerCase();
    return tags.filter(tag => 
      tag.isActive && (
        tag.name.toLowerCase().includes(searchTerm) ||
        tag.description?.toLowerCase().includes(searchTerm) ||
        tag.slug.toLowerCase().includes(searchTerm)
      )
    );
  }, [tags]);

  // Filter tags
  const filterTags = useCallback((filter: TagFilter): ProductTag[] => {
    let filtered = tags;

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filtered = filtered.filter(tag => 
        tag.name.toLowerCase().includes(searchTerm) ||
        tag.description?.toLowerCase().includes(searchTerm)
      );
    }

    if (filter.category) {
      filtered = filtered.filter(tag => tag.category === filter.category);
    }

    if (filter.status && filter.status !== 'all') {
      filtered = filtered.filter(tag => 
        filter.status === 'active' ? tag.isActive : !tag.isActive
      );
    }

    if (filter.featured && filter.featured !== 'all') {
      filtered = filtered.filter(tag => 
        filter.featured === 'featured' ? tag.isFeatured : !tag.isFeatured
      );
    }

    if (filter.system && filter.system !== 'all') {
      filtered = filtered.filter(tag => 
        filter.system === 'system' ? tag.isSystem : !tag.isSystem
      );
    }

    if (filter.hasUsage !== undefined) {
      filtered = filtered.filter(tag => 
        filter.hasUsage ? tag.usageCount > 0 : tag.usageCount === 0
      );
    }

    if (filter.minUsage !== undefined) {
      filtered = filtered.filter(tag => tag.usageCount >= filter.minUsage!);
    }

    if (filter.maxUsage !== undefined) {
      filtered = filtered.filter(tag => tag.usageCount <= filter.maxUsage!);
    }

    // Sort
    if (filter.sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (filter.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'usage':
            comparison = a.usageCount - b.usageCount;
            break;
          case 'products':
            comparison = a.productCount - b.productCount;
            break;
          case 'trending':
            comparison = b.trendScore - a.trendScore;
            break;
          case 'created':
            comparison = a.createdAt.getTime() - b.createdAt.getTime();
            break;
        }
        
        return filter.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [tags]);

  // Add tag usage
  const addTagUsage = useCallback((usage: Omit<TagUsage, 'usageDate'>) => {
    const newUsage: TagUsage = {
      ...usage,
      usageDate: new Date()
    };

    setTagUsages(prev => [...prev, newUsage]);

    // Update tag statistics
    setTags(prev => prev.map(tag => {
      if (tag.id === usage.tagId) {
        return {
          ...tag,
          usageCount: tag.usageCount + 1,
          productCount: tag.productCount + (tag.productCount === 0 ? 1 : 0),
          lastUsed: new Date()
        };
      }
      return tag;
    }));
  }, []);

  // Calculate tag statistics
  const calculateStats = useCallback(() => {
    const totalTags = tags.length;
    const activeTags = tags.filter(tag => tag.isActive).length;
    const featuredTags = tags.filter(tag => tag.isFeatured).length;
    const systemTags = tags.filter(tag => tag.isSystem).length;
    const customTags = tags.filter(tag => !tag.isSystem).length;
    const totalUsage = tags.reduce((sum, tag) => sum + tag.usageCount, 0);
    const averageUsagePerTag = totalTags > 0 ? totalUsage / totalTags : 0;

    // Top tags
    const topTags = tags
      .filter(tag => tag.usageCount > 0)
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        usageCount: tag.usageCount,
        productCount: tag.productCount,
        category: tag.category,
        trendScore: tag.trendScore
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    // Category statistics
    const categoryStats = tags.reduce((acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = {
          count: 0,
          usage: 0,
          topTags: []
        };
      }
      acc[tag.category].count++;
      acc[tag.category].usage += tag.usageCount;
      return acc;
    }, {} as Record<string, { count: number; usage: number; topTags: string[] }>);

    // Add top tags for each category
    Object.keys(categoryStats).forEach(category => {
      const categoryTags = tags.filter(tag => tag.category === category);
      categoryStats[category].topTags = categoryTags
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 3)
        .map(tag => tag.name);
    });

    // Trending tags
    const trendingTags = tags
      .filter(tag => tag.trending)
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        trendScore: tag.trendScore,
        growth: Math.random() * 100 - 50 // Mock growth percentage
      }))
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 10);

    const stats: TagStats = {
      totalTags,
      activeTags,
      featuredTags,
      systemTags,
      customTags,
      totalUsage,
      averageUsagePerTag,
      topTags,
      categoryStats,
      trendingTags
    };

    setTagStats(stats);
    return stats;
  }, [tags]);

  // Get tag suggestions
  const getTagSuggestions = useCallback((query: string, limit: number = 10): ProductTag[] => {
    const searchTerm = query.toLowerCase();
    return tags
      .filter(tag => 
        tag.isActive && 
        tag.name.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }, [tags]);

  // Get related tags
  const getRelatedTags = useCallback((tagId: string, limit: number = 5): ProductTag[] => {
    const tag = getTagById(tagId);
    if (!tag) return [];

    return tags
      .filter(t => 
        t.isActive && 
        t.id !== tagId && 
        (tag.relatedTags.includes(t.id) || t.relatedTags.includes(tag.id))
      )
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }, [tags, getTagById]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  return {
    tags,
    tagUsages,
    tagStats,
    isLoading,
    createTag,
    updateTag,
    deleteTag,
    toggleTagStatus,
    toggleFeaturedStatus,
    getTagById,
    getTagsByCategory,
    getFeaturedTags,
    getTrendingTags,
    searchTags,
    filterTags,
    addTagUsage,
    calculateStats,
    getTagSuggestions,
    getRelatedTags
  };
}

export default function ProductTagsManager() {
  const {
    tags,
    tagStats,
    isLoading,
    createTag,
    updateTag,
    deleteTag,
    toggleTagStatus,
    toggleFeaturedStatus,
    getFeaturedTags,
    getTrendingTags,
    filterTags,
    calculateStats
  } = useProductTags();

  const [filter, setFilter] = useState<TagFilter>({
    sortBy: 'usage',
    sortOrder: 'desc'
  });
  const [selectedTag, setSelectedTag] = useState<ProductTag | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<ProductTag | null>(null);

  const filteredTags = filterTags(filter);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      feature: 'bg-blue-100 text-blue-800',
      brand: 'bg-purple-100 text-purple-800',
      style: 'bg-green-100 text-green-800',
      material: 'bg-yellow-100 text-yellow-800',
      condition: 'bg-red-100 text-red-800',
      price_range: 'bg-orange-100 text-orange-800',
      target_audience: 'bg-pink-100 text-pink-800',
      occasion: 'bg-indigo-100 text-indigo-800',
      custom: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.custom;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      feature: 'Xususiyat',
      brand: 'Brend',
      style: 'Uslub',
      material: 'Material',
      condition: 'Holat',
      price_range: 'Narx oralig\'i',
      target_audience: 'Mijozlar',
      occasion: 'Imkoniyat',
      custom: 'Boshqa'
    };
    return labels[category] || category;
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Tag className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Mahsulot teglari
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi tag</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      {tagStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {tagStats.totalTags}
            </div>
            <p className="text-purple-700 dark:text-purple-300">Jami teglar</p>
          </div>
          
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {tagStats.activeTags}
            </div>
            <p className="text-green-700 dark:text-green-300">Faol teglar</p>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {tagStats.totalUsage.toLocaleString()}
            </div>
            <p className="text-blue-700 dark:text-blue-300">Jami foydalanish</p>
          </div>
          
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {tagStats.trendingTags.length}
            </div>
            <p className="text-orange-700 dark:text-orange-300">Trend teglar</p>
          </div>
        </div>
      )}

      {/* Featured and Trending Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Featured Tags */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <span>Tavsiya etilgan teglar</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {getFeaturedTags(10).map(tag => (
              <div
                key={tag.id}
                className="px-3 py-1 bg-white dark:bg-gray-800 border border-yellow-300 dark:border-yellow-700 rounded-full text-sm font-medium text-yellow-800 dark:text-yellow-200"
              >
                {tag.name}
              </div>
            ))}
          </div>
        </div>

        {/* Trending Tags */}
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span>Trend teglar</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {getTrendingTags(10).map(tag => (
              <div
                key={tag.id}
                className="px-3 py-1 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded-full text-sm font-medium text-green-800 dark:text-green-200"
              >
                {tag.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Teglarni qidirish..."
            value={filter.search || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        
        <select
          value={filter.category || ''}
          onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value || undefined }))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">Barcha kategoriyalar</option>
          <option value="feature">Xususiyat</option>
          <option value="brand">Brend</option>
          <option value="style">Uslub</option>
          <option value="material">Material</option>
          <option value="condition">Holat</option>
          <option value="price_range">Narx oralig'i</option>
          <option value="target_audience">Mijozlar</option>
          <option value="occasion">Imkoniyat</option>
          <option value="custom">Boshqa</option>
        </select>
        
        <select
          value={filter.status || 'all'}
          onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value as any }))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">Barchasi</option>
          <option value="active">Faol</option>
          <option value="inactive">Nofaol</option>
        </select>
        
        <select
          value={`${filter.sortBy}-${filter.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('-');
            setFilter(prev => ({ ...prev, sortBy: sortBy as any, sortOrder: sortOrder as any }));
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="usage-desc">Foydalanish (ko\'p)</option>
          <option value="usage-asc">Foydalanish (kam)</option>
          <option value="name-asc">Nomi (A-Z)</option>
          <option value="name-desc">Nomi (Z-A)</option>
          <option value="trending-desc">Trend (yuqori)</option>
          <option value="created-desc">Yaratilgan (yangi)</option>
        </select>
      </div>

      {/* Tags List */}
      <div className="space-y-4">
        {filteredTags.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Teglar topilmadi
            </p>
          </div>
        ) : (
          filteredTags.map(tag => (
            <div key={tag.id} className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Tag Color */}
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: tag.color || '#6B7280' }}
                  >
                    {tag.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Tag Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {tag.name}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(tag.category)}`}>
                        {getCategoryLabel(tag.category)}
                      </span>
                      {!tag.isActive && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          Nofaol
                        </span>
                      )}
                      {tag.isFeatured && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Tavsiya etilgan
                        </span>
                      )}
                      {tag.trending && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Trend
                        </span>
                      )}
                      {tag.isSystem && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Sistema
                        </span>
                      )}
                    </div>
                    
                    {tag.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {tag.description}
                      </p>
                    )}

                    <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
                      <span>{tag.usageCount} foydalanish</span>
                      <span>{tag.productCount} mahsulot</span>
                      <span>{tag.searchCount} qidiruv</span>
                      <span>{tag.clickCount} click</span>
                      {tag.lastUsed && (
                        <span>Oxirgi: {tag.lastUsed.toLocaleDateString('uz-UZ')}</span>
                      )}
                    </div>

                    {/* Related Tags */}
                    {tag.relatedTags.length > 0 && (
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Bog\'liq:</span>
                        <div className="flex flex-wrap gap-1">
                          {tag.relatedTags.slice(0, 3).map(relatedTagId => {
                            const relatedTag = tags.find(t => t.id === relatedTagId);
                            return relatedTag ? (
                              <span key={relatedTagId} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-700 dark:text-gray-300">
                                {relatedTag.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingTag(tag)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    title="Tahrirlash"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => toggleTagStatus(tag.id)}
                    className={`p-2 rounded-lg ${
                      tag.isActive 
                        ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                        : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                    title={tag.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
                  >
                    {tag.isActive ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => toggleFeaturedStatus(tag.id)}
                    className={`p-2 rounded-lg ${
                      tag.isFeatured 
                        ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                        : 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    title={tag.isFeatured ? 'Tavsiyani olib tashlash' : 'Tavsiya qilish'}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => setSelectedTag(tag)}
                    className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                    title="Ko'rish"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
