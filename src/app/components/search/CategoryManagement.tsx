import { useState, useEffect, useCallback } from 'react';
import { Folder, FolderOpen, Plus, Edit, Trash2, Search, Filter, BarChart3, TrendingUp, Users, Package, Eye, ChevronRight, ChevronDown, Move, Copy, Star } from 'lucide-react';
import { toast } from 'sonner';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  parentId?: string;
  level: number;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  
  // Product counts
  totalProducts: number;
  activeProducts: number;
  
  // Analytics
  views: number;
  searches: number;
  clicks: number;
  conversions: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  
  // Children (for tree structure)
  children?: Category[];
}

export interface CategoryStats {
  totalCategories: number;
  activeCategories: number;
  featuredCategories: number;
  maxDepth: number;
  totalProducts: number;
  averageProductsPerCategory: number;
  topCategories: Array<{
    id: string;
    name: string;
    products: number;
    views: number;
    conversionRate: number;
  }>;
  categoryGrowth: Array<{
    categoryId: string;
    categoryName: string;
    currentProducts: number;
    previousProducts: number;
    growth: number;
  }>;
}

export interface CategoryFilter {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  featured?: 'all' | 'featured' | 'not_featured';
  parentId?: string;
  level?: number;
  hasProducts?: boolean;
  sortBy?: 'name' | 'products' | 'views' | 'created' | 'order';
  sortOrder?: 'asc' | 'desc';
}

const mockCategories: Category[] = [
  {
    id: 'cat_1',
    name: 'Elektronika',
    slug: 'elektronika',
    description: 'Elektronika mahsulotlari va aksessuarlar',
    icon: 'devices',
    image: '/images/categories/electronics.jpg',
    level: 0,
    order: 1,
    isActive: true,
    isFeatured: true,
    seoTitle: 'Elektronika mahsulotlari | Online Do\'kon',
    seoDescription: 'Eng so\'nggi elektronika mahsulotlari: telefonlar, noutbuklar, planshetlar',
    seoKeywords: ['elektronika', 'telefon', 'noutbuk', 'planshet', 'gadget'],
    totalProducts: 1234,
    activeProducts: 1156,
    views: 45670,
    searches: 8900,
    clicks: 2340,
    conversions: 156,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'admin',
    updatedBy: 'admin',
    children: [
      {
        id: 'cat_1_1',
        name: 'Smartfonlar',
        slug: 'smartfonlar',
        description: 'Mobil telefonlar va aksessuarlar',
        icon: 'smartphone',
        level: 1,
        order: 1,
        isActive: true,
        isFeatured: true,
        parentId: 'cat_1',
        totalProducts: 567,
        activeProducts: 543,
        views: 23400,
        searches: 4500,
        clicks: 1234,
        conversions: 89,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-03-19'),
        createdBy: 'admin',
        updatedBy: 'admin'
      },
      {
        id: 'cat_1_2',
        name: 'Noutbuklar',
        slug: 'noutbuklar',
        description: 'Noutbuklar va kompyuter aksessuarlari',
        icon: 'laptop',
        level: 1,
        order: 2,
        isActive: true,
        isFeatured: false,
        parentId: 'cat_1',
        totalProducts: 234,
        activeProducts: 223,
        views: 12300,
        searches: 2300,
        clicks: 678,
        conversions: 45,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-03-19'),
        createdBy: 'admin',
        updatedBy: 'admin'
      }
    ]
  },
  {
    id: 'cat_2',
    name: 'Kiyim-kechak',
    slug: 'kiyim-kechak',
    description: 'Erkaklar, ayollar va bolalar kiyimlari',
    icon: 'shirt',
    image: '/images/categories/clothing.jpg',
    level: 0,
    order: 2,
    isActive: true,
    isFeatured: true,
    totalProducts: 3456,
    activeProducts: 3234,
    views: 67890,
    searches: 12300,
    clicks: 3456,
    conversions: 234,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'admin',
    updatedBy: 'admin',
    children: [
      {
        id: 'cat_2_1',
        name: 'Erkaklar kiyimi',
        slug: 'erkaklar-kiyimi',
        description: 'Erkaklar uchun kiyimlar',
        icon: 'male',
        level: 1,
        order: 1,
        isActive: true,
        isFeatured: false,
        parentId: 'cat_2',
        totalProducts: 1234,
        activeProducts: 1189,
        views: 23400,
        searches: 4500,
        clicks: 1234,
        conversions: 89,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-03-19'),
        createdBy: 'admin',
        updatedBy: 'admin'
      }
    ]
  },
  {
    id: 'cat_3',
    name: 'Uy-ro\'zg\'or',
    slug: 'uy-rog\'or',
    description: 'Uy va bog\' uchun mahsulotlar',
    icon: 'home',
    level: 0,
    order: 3,
    isActive: true,
    isFeatured: false,
    totalProducts: 890,
    activeProducts: 845,
    views: 23400,
    searches: 4500,
        clicks: 1234,
    conversions: 67,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'admin',
    updatedBy: 'admin'
  }
];

export function useCategoryManagement() {
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Build category tree
  const buildCategoryTree = useCallback((flatCategories: Category[]): Category[] => {
    const categoryMap = new Map<string, Category>();
    const rootCategories: Category[] = [];

    // Create map of all categories
    flatCategories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Build tree structure
    flatCategories.forEach(category => {
      const categoryNode = categoryMap.get(category.id)!;
      
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(categoryNode);
        }
      } else {
        rootCategories.push(categoryNode);
      }
    });

    return rootCategories;
  }, []);

  // Flatten category tree
  const flattenCategoryTree = useCallback((tree: Category[]): Category[] => {
    const result: Category[] = [];
    
    const flatten = (categories: Category[]) => {
      categories.forEach(category => {
        result.push(category);
        if (category.children && category.children.length > 0) {
          flatten(category.children);
        }
      });
    };
    
    flatten(tree);
    return result;
  }, []);

  // Get all categories as flat list
  const getAllCategories = useCallback((): Category[] => {
    return flattenCategoryTree(categories);
  }, [categories, flattenCategoryTree]);

  // Get category by ID
  const getCategoryById = useCallback((id: string): Category | undefined => {
    const allCategories = getAllCategories();
    return allCategories.find(cat => cat.id === id);
  }, [getAllCategories]);

  // Get root categories
  const getRootCategories = useCallback((): Category[] => {
    return categories.filter(cat => !cat.parentId);
  }, [categories]);

  // Get child categories
  const getChildCategories = useCallback((parentId: string): Category[] => {
    return getAllCategories().filter(cat => cat.parentId === parentId);
  }, [getAllCategories]);

  // Get category path
  const getCategoryPath = useCallback((categoryId: string): Category[] => {
    const path: Category[] = [];
    let currentCategory = getCategoryById(categoryId);
    
    while (currentCategory) {
      path.unshift(currentCategory);
      currentCategory = currentCategory.parentId ? getCategoryById(currentCategory.parentId) : undefined;
    }
    
    return path;
  }, [getCategoryById]);

  // Create new category
  const createCategory = useCallback(async (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'totalProducts' | 'activeProducts' | 'views' | 'searches' | 'clicks' | 'conversions'>) => {
    setIsLoading(true);
    
    try {
      const newCategory: Category = {
        ...categoryData,
        id: `cat_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalProducts: 0,
        activeProducts: 0,
        views: 0,
        searches: 0,
        clicks: 0,
        conversions: 0
      };

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCategories(prev => {
        const allCategories = [...prev, newCategory];
        return buildCategoryTree(allCategories);
      });
      
      toast.success('Kategoriya yaratildi');
      return newCategory;
    } catch (error) {
      toast.error('Kategoriyani yaratishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [buildCategoryTree]);

  // Update category
  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCategories(prev => {
        const allCategories = prev.map(cat => 
          cat.id === id 
            ? { ...cat, ...updates, updatedAt: new Date() }
            : cat
        );
        return buildCategoryTree(allCategories);
      });
      
      toast.success('Kategoriya yangilandi');
    } catch (error) {
      toast.error('Kategoriyani yangilashda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [buildCategoryTree]);

  // Delete category
  const deleteCategory = useCallback(async (id: string) => {
    setIsLoading(true);
    
    try {
      // Check if category has children
      const hasChildren = getChildCategories(id).length > 0;
      if (hasChildren) {
        throw new Error('Kategoriyada bolalari bor, avval ularni o\'chiring');
      }

      // Check if category has products
      const category = getCategoryById(id);
      if (category && category.totalProducts > 0) {
        throw new Error('Kategoriyada mahsulotlar bor, avval ularni ko\'chiring');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCategories(prev => {
        const allCategories = prev.filter(cat => cat.id !== id);
        return buildCategoryTree(allCategories);
      });
      
      toast.success('Kategoriya o\'chirildi');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kategoriyani o\'chirishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getChildCategories, getCategoryById, buildCategoryTree]);

  // Move category
  const moveCategory = useCallback(async (categoryId: string, newParentId?: string) => {
    setIsLoading(true);
    
    try {
      // Check for circular reference
      let currentParent = newParentId ? getCategoryById(newParentId) : undefined;
      while (currentParent) {
        if (currentParent.id === categoryId) {
          throw new Error('Kategoriyani o\'ziga ko\'chirib bo\'lmaydi');
        }
        currentParent = currentParent.parentId ? getCategoryById(currentParent.parentId) : undefined;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update level
      const newLevel = newParentId ? (getCategoryById(newParentId)?.level || 0) + 1 : 0;
      
      setCategories(prev => {
        const allCategories = prev.map(cat => 
          cat.id === categoryId 
            ? { ...cat, parentId: newParentId, level: newLevel, updatedAt: new Date() }
            : cat
        );
        return buildCategoryTree(allCategories);
      });
      
      toast.success('Kategoriya ko\'chirildi');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kategoriyani ko\'chirishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getCategoryById, buildCategoryTree]);

  // Toggle category status
  const toggleCategoryStatus = useCallback(async (id: string) => {
    const category = getCategoryById(id);
    if (!category) return;

    await updateCategory(id, { isActive: !category.isActive });
  }, [getCategoryById, updateCategory]);

  // Toggle featured status
  const toggleFeaturedStatus = useCallback(async (id: string) => {
    const category = getCategoryById(id);
    if (!category) return;

    await updateCategory(id, { isFeatured: !category.isFeatured });
  }, [getCategoryById, updateCategory]);

  // Filter categories
  const filterCategories = useCallback((filter: CategoryFilter): Category[] => {
    let filtered = getAllCategories();

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(searchTerm) ||
        cat.description?.toLowerCase().includes(searchTerm) ||
        cat.slug.toLowerCase().includes(searchTerm)
      );
    }

    if (filter.status && filter.status !== 'all') {
      filtered = filtered.filter(cat => 
        filter.status === 'active' ? cat.isActive : !cat.isActive
      );
    }

    if (filter.featured && filter.featured !== 'all') {
      filtered = filtered.filter(cat => 
        filter.featured === 'featured' ? cat.isFeatured : !cat.isFeatured
      );
    }

    if (filter.parentId !== undefined) {
      filtered = filtered.filter(cat => cat.parentId === filter.parentId);
    }

    if (filter.level !== undefined) {
      filtered = filtered.filter(cat => cat.level === filter.level);
    }

    if (filter.hasProducts !== undefined) {
      filtered = filtered.filter(cat => 
        filter.hasProducts ? cat.totalProducts > 0 : cat.totalProducts === 0
      );
    }

    // Sort
    if (filter.sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (filter.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'products':
            comparison = a.totalProducts - b.totalProducts;
            break;
          case 'views':
            comparison = a.views - b.views;
            break;
          case 'created':
            comparison = a.createdAt.getTime() - b.createdAt.getTime();
            break;
          case 'order':
            comparison = a.order - b.order;
            break;
        }
        
        return filter.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [getAllCategories]);

  // Calculate category statistics
  const calculateStats = useCallback(() => {
    const allCategories = getAllCategories();
    
    const totalCategories = allCategories.length;
    const activeCategories = allCategories.filter(cat => cat.isActive).length;
    const featuredCategories = allCategories.filter(cat => cat.isFeatured).length;
    const maxDepth = Math.max(...allCategories.map(cat => cat.level));
    const totalProducts = allCategories.reduce((sum, cat) => sum + cat.totalProducts, 0);
    const averageProductsPerCategory = totalCategories > 0 ? totalProducts / totalCategories : 0;

    // Top categories
    const topCategories = allCategories
      .filter(cat => cat.totalProducts > 0)
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        products: cat.totalProducts,
        views: cat.views,
        conversionRate: cat.clicks > 0 ? (cat.conversions / cat.clicks) * 100 : 0
      }))
      .sort((a, b) => b.products - a.products)
      .slice(0, 10);

    // Category growth (mock data)
    const categoryGrowth = allCategories.slice(0, 5).map(cat => ({
      categoryId: cat.id,
      categoryName: cat.name,
      currentProducts: cat.totalProducts,
      previousProducts: Math.floor(cat.totalProducts * 0.8), // Mock previous data
      growth: ((cat.totalProducts - Math.floor(cat.totalProducts * 0.8)) / Math.floor(cat.totalProducts * 0.8)) * 100
    }));

    const stats: CategoryStats = {
      totalCategories,
      activeCategories,
      featuredCategories,
      maxDepth,
      totalProducts,
      averageProductsPerCategory,
      topCategories,
      categoryGrowth
    };

    setCategoryStats(stats);
    return stats;
  }, [getAllCategories]);

  // Toggle category expansion
  const toggleCategoryExpansion = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // Expand all categories
  const expandAllCategories = useCallback(() => {
    const allIds = getAllCategories().map(cat => cat.id);
    setExpandedCategories(new Set(allIds));
  }, [getAllCategories]);

  // Collapse all categories
  const collapseAllCategories = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  return {
    categories,
    categoryStats,
    isLoading,
    expandedCategories,
    getAllCategories,
    getRootCategories,
    getChildCategories,
    getCategoryById,
    getCategoryPath,
    createCategory,
    updateCategory,
    deleteCategory,
    moveCategory,
    toggleCategoryStatus,
    toggleFeaturedStatus,
    filterCategories,
    calculateStats,
    toggleCategoryExpansion,
    expandAllCategories,
    collapseAllCategories
  };
}

export default function CategoryManagement() {
  const {
    categories,
    categoryStats,
    isLoading,
    expandedCategories,
    getRootCategories,
    getChildCategories,
    getCategoryById,
    getCategoryPath,
    createCategory,
    updateCategory,
    deleteCategory,
    moveCategory,
    toggleCategoryStatus,
    toggleFeaturedStatus,
    filterCategories,
    toggleCategoryExpansion,
    expandAllCategories,
    collapseAllCategories
  } = useCategoryManagement();

  const [filter, setFilter] = useState<CategoryFilter>({
    sortBy: 'order',
    sortOrder: 'asc'
  });
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const filteredCategories = filterCategories(filter);

  const renderCategoryTree = (categories: Category[], level = 0) => {
    return categories.map(category => {
      const isExpanded = expandedCategories.has(category.id);
      const hasChildren = category.children && category.children.length > 0;
      const paddingLeft = level * 24;

      return (
        <div key={category.id} style={{ paddingLeft: `${paddingLeft}px` }}>
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg mb-2">
            <div className="flex items-center space-x-3">
              {/* Expand/Collapse Button */}
              {hasChildren && (
                <button
                  onClick={() => toggleCategoryExpansion(category.id)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              )}

              {/* Category Icon */}
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                {category.icon ? (
                  <span className="text-blue-600 dark:text-blue-400">{category.icon}</span>
                ) : (
                  <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>

              {/* Category Info */}
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </h4>
                  {!category.isActive && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      Nofaol
                    </span>
                  )}
                  {category.isFeatured && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                      Tavsiya etilgan
                    </span>
                  )}
                </div>
                
                {category.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {category.description}
                  </p>
                )}

                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{category.totalProducts} mahsulot</span>
                  <span>{category.views} ko'rilgan</span>
                  <span>{category.clicks} click</span>
                  <span>{category.conversions} konversiya</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setEditingCategory(category)}
                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                title="Tahrirlash"
              >
                <Edit className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => toggleCategoryStatus(category.id)}
                className={`p-2 rounded-lg ${
                  category.isActive 
                    ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                    : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}
                title={category.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
              >
                {category.isActive ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
              
              <button
                onClick={() => toggleFeaturedStatus(category.id)}
                className={`p-2 rounded-lg ${
                  category.isFeatured 
                    ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    : 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title={category.isFeatured ? 'Tavsiyani olib tashlash' : 'Tavsiya qilish'}
              >
                <Star className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setSelectedCategory(category)}
                className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                title="Ko'rish"
              >
                <Eye className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => deleteCategory(category.id)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                title="O'chirish"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="ml-4">
              {renderCategoryTree(category.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Folder className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Kategoriyalar boshqaruvi
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi kategoriya</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      {categoryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {categoryStats.totalCategories}
            </div>
            <p className="text-blue-700 dark:text-blue-300">Jami kategoriyalar</p>
          </div>
          
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {categoryStats.activeCategories}
            </div>
            <p className="text-green-700 dark:text-green-300">Faol kategoriyalar</p>
          </div>
          
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {categoryStats.totalProducts.toLocaleString()}
            </div>
            <p className="text-purple-700 dark:text-purple-300">Jami mahsulotlar</p>
          </div>
          
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {categoryStats.maxDepth + 1}
            </div>
            <p className="text-orange-700 dark:text-orange-300">Max chuqurlik</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Kategoriyalarni qidirish..."
            value={filter.search || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        
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
          value={filter.featured || 'all'}
          onChange={(e) => setFilter(prev => ({ ...prev, featured: e.target.value as any }))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">Barchasi</option>
          <option value="featured">Tavsiya etilgan</option>
          <option value="not_featured">Tavsiya etilmagan</option>
        </select>
        
        <select
          value={`${filter.sortBy}-${filter.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('-');
            setFilter(prev => ({ ...prev, sortBy: sortBy as any, sortOrder: sortOrder as any }));
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="order-asc">Tartib (A-Z)</option>
          <option value="order-desc">Tartib (Z-A)</option>
          <option value="name-asc">Nomi (A-Z)</option>
          <option value="name-desc">Nomi (Z-A)</option>
          <option value="products-desc">Mahsulotlar (ko\'p)</option>
          <option value="products-asc">Mahsulotlar (kam)</option>
          <option value="views-desc">Ko\'rilgan (ko\'p)</option>
          <option value="views-asc">Ko\'rilgan (kam)</option>
        </select>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={expandAllCategories}
            className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Barchasini yoyish
          </button>
          <button
            onClick={collapseAllCategories}
            className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Barchasini yopish
          </button>
        </div>
      </div>

      {/* Category Tree */}
      <div className="space-y-2">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Kategoriyalar topilmadi
            </p>
          </div>
        ) : (
          renderCategoryTree(filteredCategories.filter(cat => !cat.parentId))
        )}
      </div>
    </div>
  );
}
