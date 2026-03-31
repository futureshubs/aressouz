import { Suspense, lazy, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { ViewToggle } from './components/ViewToggle';
import { ProductCard } from './components/ProductCard';
import { BottomNav } from './components/BottomNav';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CatalogList } from './components/CatalogList';
import { CategoryList } from './components/CategoryList';
import { Cart } from './components/Cart';
import { SMSAuthModal } from './components/SMSAuthModal';
import { BannerCarousel } from './components/BannerCarousel';
import { catalogs } from './data/categories';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { useLocation } from './context/LocationContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { TestBackend } from './test-backend';
import ProductionApiService from '../services/productionApi';

const ProfileView = lazy(() => import('./components/ProfileView'));
const OnlineShops = lazy(() => import('./components/OnlineShops'));
const Market = lazy(() => import('./components/Market'));
const FoodsView = lazy(() => import('./components/FoodsView'));
const AroundView = lazy(() => import('./components/AroundView').then(module => ({ default: module.AroundView })));
const CarsView = lazy(() => import('./components/CarsView').then(module => ({ default: module.CarsView })));
const RentalsView = lazy(() => import('./components/RentalsView').then(module => ({ default: module.RentalsView })));
const ServicesView = lazy(() => import('./components/ServicesView').then(module => ({ default: module.ServicesView })));
const PropertiesView = lazy(() => import('./components/PropertiesView').then(module => ({ default: module.PropertiesView })));
const HousesView = lazy(() => import('./components/HousesView').then(module => ({ default: module.HousesView })));
const CommunityView = lazy(() => import('./components/CommunityView').then(module => ({ default: module.CommunityView })));
const AuctionView = lazy(() => import('./components/AuctionView').then(module => ({ default: module.AuctionView })));
const Bonus = lazy(() => import('./pages/Bonus'));
const CarPage = lazy(() => import('./pages/Car'));

function SectionSkeleton({
  isDark,
  accentColor,
  title = 'Yuklanmoqda...',
  description = 'Maʼlumotlar tayyorlanyapti',
  cardCount = 8,
}: {
  isDark: boolean;
  accentColor: { color: string };
  title?: string;
  description?: string;
  cardCount?: number;
}) {
  return (
    <div className="px-5 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-8">
      <div className="max-w-[1600px] mx-auto animate-pulse">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div
              className="h-8 w-48 rounded-2xl"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
            />
            <div
              className="mt-3 h-4 w-64 rounded-xl"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }}
            />
          </div>
          <div
            className="h-8 w-24 rounded-full"
            style={{ background: `${accentColor.color}18` }}
          />
        </div>
        <div className="mb-6 rounded-3xl border px-4 py-3" style={{
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.75)',
        }}>
          <div className="text-sm font-medium" style={{ color: isDark ? '#fff' : '#111827' }}>{title}</div>
          <div className="mt-1 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#6b7280' }}>{description}</div>
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: cardCount }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[28px] border"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
              }}
            >
              <div style={{ aspectRatio: '1 / 1', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)' }} />
              <div className="space-y-3 p-4">
                <div className="h-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }} />
                <div className="h-4 w-2/3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }} />
                <div className="h-10 rounded-2xl" style={{ background: `${accentColor.color}16` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LazySection({
  children,
  isDark,
  accentColor,
  title,
  description,
  cardCount,
}: {
  children: ReactNode;
  isDark: boolean;
  accentColor: { color: string };
  title?: string;
  description?: string;
  cardCount?: number;
}) {
  return (
    <Suspense fallback={
      <SectionSkeleton
        isDark={isDark}
        accentColor={accentColor}
        title={title}
        description={description}
        cardCount={cardCount}
      />
    }
    >
      {children}
    </Suspense>
  );
}

// Main App Component
interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  categoryId: string;
  catalogId: string;
  rating: number;
  // Real data from branch products
  stockCount?: number;
  oldPrice?: number;
  description?: string;
  recommendation?: string;
  barcode?: string;
  sku?: string;
  video?: string;
  specs?: { name: string; value: string }[];
  variants?: {
    id: string;
    name: string;
    image?: string;
    price: number;
    stockQuantity?: number;
    oldPrice?: number;
    barcode?: string;
    sku?: string;
    video?: string;
    attributes?: { name: string; value: string }[];
  }[];
  branchName?: string;
  branchId?: string;
}

interface CartItem extends Product {
  quantity: number;
  selectedVariantId?: string; // Add variant tracking
  selectedVariantName?: string; // For display
  // Food-specific fields
  dishDetails?: {
    restaurantName?: string;
    prepTime?: string;
    weight?: string;
    kcal?: number;
  };
  variantDetails?: {
    name: string;
    price: number;
    prepTime?: string;
  };
  addons?: {
    name: string;
    price: number;
    quantity: number;
  }[];
}

// Branch product interface
interface BranchProduct {
  id: string;
  name: string;
  catalogId: string;
  categoryId: string;
  description: string;
  recommendation?: string;
  variants: {
    id: string;
    name: string;
    image?: string;
    video?: string;
    price: number;
    oldPrice?: number;
    profitPrice?: number;
    stockQuantity: number;
    barcode?: string;
    sku?: string;
    attributes: { name: string; value: string }[];
  }[];
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

interface Branch {
  id: string;
  branchName: string;
  login: string;
  regionId: string;
  districtId: string;
  phone: string;
  managerName: string;
  coordinates?: { lat: number; lng: number };
  createdAt: string;
}

interface AppContentProps {
  initialTab?: string;
  initialProfileOpen?: boolean;
  initialProfileTab?: 'orders' | 'favorites' | 'portfolio' | 'ads';
}

export default function AppContent({
  initialTab = 'market',
  initialProfileOpen = false,
  initialProfileTab = 'orders',
}: AppContentProps) {
  const { theme, accentColor } = useTheme();
  const { isAuthenticated, smsSignin } = useAuth();
  const { selectedRegion, selectedDistrict } = useLocation();
  const [cartItems, setCartItems] = useState<CartItem[]>([]); 
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isProfileOpen, setIsProfileOpen] = useState(initialProfileOpen);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  // Platform detection
  const platform = 'ios'; // iOS uslubidagi dizayn
  
  // Yangi state'lar
  const [activeView, setActiveView] = useState<'products' | 'catalog'>('products');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Branch products state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchProducts, setBranchProducts] = useState<Product[]>([]);
  const [refreshKey] = useState(0); // Force refresh trigger
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const productsCacheKey = useMemo(
    () => (selectedRegion && selectedDistrict ? `products:${selectedRegion}:${selectedDistrict}` : ''),
    [selectedDistrict, selectedRegion]
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setIsProfileOpen(initialProfileOpen);
  }, [initialProfileOpen]);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('mainCart');
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('❌ Error restoring main cart:', error);
      localStorage.removeItem('mainCart');
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('mainCart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('❌ Error saving main cart:', error);
    }
  }, [cartItems]);

  useEffect(() => {
    // Set CSS variables for theme
    document.documentElement.style.setProperty('--accent-color', accentColor.color);
    document.documentElement.style.setProperty('--accent-gradient', accentColor.gradient);
    document.body.style.backgroundColor = theme === 'dark' ? '#000000' : '#f9fafb';
    document.body.style.color = theme === 'dark' ? '#ffffff' : '#111827';
  }, [theme, accentColor]);

  // Initialize test shops - DISABLED (use admin panel to create shops)
  // Users should create shops via branch panel instead of auto-loading test data
  
  // Load branches from Supabase
  useEffect(() => {
    const loadBranches = async () => {
      const storedBranches = localStorage.getItem('branches');
      if (storedBranches) {
        try {
          setBranches(JSON.parse(storedBranches));
          setIsLoadingBranches(false);
        } catch {
          localStorage.removeItem('branches');
        }
      }

      try {
        setIsLoadingBranches(true);
        const response = await ProductionApiService.getBranches();
        
        if (response.success && response.data) {
          setBranches(response.data.branches);
          localStorage.setItem('branches', JSON.stringify(response.data.branches));
        } else {
          throw new Error(response.error || 'Failed to load branches');
        }
      } catch (error) {
        console.error('❌ Error loading branches:', error);
        if (!storedBranches) {
          toast.error('Filiallar yuklanmadi');
        }
      } finally {
        setIsLoadingBranches(false);
      }
    };

    loadBranches();
  }, [refreshKey]); // Reload when refreshKey changes

  // Load products from Supabase by user location
  useEffect(() => {
    const loadProducts = async () => {
      if (!selectedRegion || !selectedDistrict || branches.length === 0) {
        setBranchProducts([]);
        setIsLoadingProducts(false);
        return;
      }

      // Get branches in user's location
      const localBranches = branches.filter(
        b => b.regionId === selectedRegion && b.districtId === selectedDistrict
      );

      if (localBranches.length === 0) {
        setBranchProducts([]);
        setIsLoadingProducts(false);
        return;
      }

      if (productsCacheKey) {
        const cachedProducts = localStorage.getItem(productsCacheKey);
        if (cachedProducts) {
          try {
            setBranchProducts(JSON.parse(cachedProducts));
            setIsLoadingProducts(false);
          } catch {
            localStorage.removeItem(productsCacheKey);
          }
        }
      }

      try {
        setIsLoadingProducts(true);
        const params = new URLSearchParams({
          regionId: selectedRegion,
          districtId: selectedDistrict,
          limit: '160',
          includeSold: 'false',
        });
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Server error:', errorText);
          throw new Error(`Failed to load products: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const allBranchProducts: BranchProduct[] = data.products || [];
        
        // Keep branch-level safety even though backend already filters by location
        const localBranchIds = localBranches.map(b => b.id);
        const filteredProducts = allBranchProducts.filter(p => localBranchIds.includes(p.branchId));

        // Helper function to convert string ID to number
        const stringToNumber = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return Math.abs(hash);
        };

        // Convert branch products to Product format for display
        const displayProducts: Product[] = filteredProducts.flatMap(bp => {
          // Use first variant as default display values
          const firstVariant = bp.variants[0];
          if (!firstVariant) {
            return [];
          }
          
          return [{
            id: stringToNumber(bp.id), // Convert UUID string to number
            name: bp.name, // Use product name, not variant name
            price: firstVariant.price, // Default to first variant price
            image: firstVariant.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
            categoryId: bp.categoryId,
            catalogId: bp.catalogId,
            rating: 5,
            // Add real data from branch products
            stockCount: firstVariant.stockQuantity,
            oldPrice: firstVariant.oldPrice,
            description: bp.description,
            recommendation: bp.recommendation,
            barcode: firstVariant.barcode,
            sku: firstVariant.sku,
            video: firstVariant.video,
            specs: firstVariant.attributes || [],
            // FULL VARIANTS DATA - All variants with complete information
            variants: bp.variants.map(v => ({ 
              id: v.id, 
              name: v.name, 
              image: v.image, 
              price: v.price,
              stockQuantity: v.stockQuantity,
              oldPrice: v.oldPrice,
              barcode: v.barcode,
              sku: v.sku,
              video: v.video,
              attributes: v.attributes || []
            })),
            branchName: localBranches.find(b => b.id === bp.branchId)?.branchName,
            branchId: bp.branchId
          }];
        });

        setBranchProducts(displayProducts);
        localStorage.setItem('products', JSON.stringify(allBranchProducts));
        if (productsCacheKey) {
          localStorage.setItem(productsCacheKey, JSON.stringify(displayProducts));
        }
      } catch (error) {
        console.error('❌ Error loading products:', error);
        
        // Helper function to convert string ID to number (for fallback)
        const stringToNumber = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return Math.abs(hash);
        };
        
        const storedProducts = localStorage.getItem('products');
        if (storedProducts) {
          const allBranchProducts: BranchProduct[] = JSON.parse(storedProducts);
          const localBranchIds = localBranches.map(b => b.id);
          const filteredProducts = allBranchProducts.filter(p => 
            localBranchIds.includes(p.branchId)
          );
          
          const displayProducts: Product[] = filteredProducts.flatMap(bp => {
            const firstVariant = bp.variants[0];
            if (!firstVariant) {
              return [];
            }
            return [{
              id: stringToNumber(bp.id),
              name: bp.name,
              price: firstVariant.price,
              image: firstVariant.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
              categoryId: bp.categoryId,
              catalogId: bp.catalogId,
              rating: 5,
              stockCount: firstVariant.stockQuantity,
              oldPrice: firstVariant.oldPrice,
              description: bp.description,
              recommendation: bp.recommendation,
              barcode: firstVariant.barcode,
              sku: firstVariant.sku,
              video: firstVariant.video,
              specs: firstVariant.attributes || [],
              variants: bp.variants.map(v => ({ 
                id: v.id, 
                name: v.name, 
                image: v.image, 
                price: v.price,
                stockQuantity: v.stockQuantity,
                oldPrice: v.oldPrice,
                barcode: v.barcode,
                sku: v.sku,
                video: v.video,
                attributes: v.attributes || []
              })),
              branchName: localBranches.find(b => b.id === bp.branchId)?.branchName,
              branchId: bp.branchId
            }];
          });
          
          setBranchProducts(displayProducts);
        } else {
          setBranchProducts([]);
        }
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadProducts();
  }, [productsCacheKey, selectedRegion, selectedDistrict, branches.length, refreshKey]); // Use branches.length instead of branches array

  // Use only real branch products - removed test/random products
  const allProducts = branchProducts;

  // Filterlangan mahsulotlar
  const filteredProducts = selectedCategoryId && selectedCatalogId
    ? allProducts.filter(p => p.categoryId === selectedCategoryId && p.catalogId === selectedCatalogId)
    : allProducts;

  const handleAddToCart = (product: Product, quantity: number = 1, variantId?: string, variantName?: string) => {
    setCartItems(prev => {
      // Create unique cart key: productId + variantId
      const cartKey = variantId ? `${product.id}_${variantId}` : `${product.id}_default`;
      
      const existing = prev.find(item => {
        const itemKey = item.selectedVariantId ? `${item.id}_${item.selectedVariantId}` : `${item.id}_default`;
        return itemKey === cartKey;
      });
      
      if (existing) {
        return prev.map(item => {
          const itemKey = item.selectedVariantId ? `${item.id}_${item.selectedVariantId}` : `${item.id}_default`;
          return itemKey === cartKey
            ? { ...item, quantity: item.quantity + quantity }
            : item;
        });
      }
      
      // Add new cart item with variant info
      return [...prev, { 
        ...product, 
        quantity: quantity,
        selectedVariantId: variantId,
        selectedVariantName: variantName
      }];
    });
  };

  const handleUpdateQuantity = (id: number, quantity: number, variantId?: string) => {
    console.log('🔄 handleUpdateQuantity called:', { id, quantity, variantId });
    console.log('📋 Current cart items:', cartItems);
    
    setCartItems(prev => {
      const updated = prev.map(item => {
        // Match both id and variantId
        const matches = variantId 
          ? (item.id === id && item.selectedVariantId === variantId)
          : (item.id === id && !item.selectedVariantId);
        
        if (matches) {
          console.log('✅ Found matching item:', item, '-> new quantity:', quantity);
        }
        
        return matches ? { ...item, quantity } : item;
      });
      
      console.log('📦 Updated cart items:', updated);
      return updated;
    });
  };

  const handleRemoveItem = (id: number, variantId?: string) => {
    console.log('🗑️ handleRemoveItem called:', { id, variantId });
    console.log('📋 Current cart before remove:', cartItems);
    
    setCartItems(prev => {
      const filtered = prev.filter(item => {
        // Remove only if both id and variantId match
        const matches = variantId 
          ? (item.id === id && item.selectedVariantId === variantId)
          : (item.id === id && !item.selectedVariantId);
        
        if (matches) {
          console.log('❌ Removing item:', item);
        }
        
        return !matches;
      });
      
      console.log('📦 Cart after remove:', filtered);
      return filtered;
    });
  };

  const handleCatalogSelect = (catalogId: string) => {
    setSelectedCatalogId(catalogId);
    setSelectedCategoryId(null);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setActiveView('products');
  };

  const handleBackToCatalogs = () => {
    setSelectedCatalogId(null);
    setSelectedCategoryId(null);
  };

  const selectedCatalog = catalogs.find(c => c.id === selectedCatalogId);
  const selectedCategory = selectedCatalog?.categories.find(c => c.id === selectedCategoryId);
  const localBranchCount = selectedRegion && selectedDistrict
    ? branches.filter(b => b.regionId === selectedRegion && b.districtId === selectedDistrict).length
    : 0;
  const hasCachedMarketContent = branchProducts.length > 0;
  const shouldShowMarketSkeleton =
    activeTab === 'market' &&
    activeView === 'products' &&
    selectedRegion &&
    selectedDistrict &&
    (isLoadingBranches || isLoadingProducts) &&
    !hasCachedMarketContent;

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const isCommunityFullscreen = activeTab === 'community' && !isProfileOpen;
  
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#000000' : '#f9fafb';
  const textColor = isDark ? '#ffffff' : '#111827';

  return (
    <div 
      className={isCommunityFullscreen ? 'h-screen overflow-hidden' : 'min-h-screen pb-24 sm:pb-32'}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Backend health test - runs on mount */}
      {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? <TestBackend /> : null}
      
      {/* Max-width container for desktop */}
      <div className={isCommunityFullscreen ? 'h-full' : 'mx-auto max-w-[1600px]'}>
        {!isCommunityFullscreen && (
          <Header
            cartCount={cartCount}
            onCommunityClick={() => setActiveTab('community')}
            onCartClick={() => setIsCartOpen(true)}
            onProfileClick={() => setIsProfileOpen(true)}
            onAuthClick={!isAuthenticated ? () => setIsAuthOpen(true) : undefined}
          />
        )}
        
        {/* Content based on active tab */}
        {activeTab === 'market' && !isProfileOpen && (
          <main className="pb-8">
            
            {/* Market Banners - Only show if location selected */}
            {selectedRegion && selectedDistrict && (
              <div className="px-1 sm:px-2 md:px-3 lg:px-4 mt-1">
                <BannerCarousel 
                  category="market" 
                  region={selectedRegion} 
                  district={selectedDistrict}
                />
              </div>
            )}
            
            {/* View Toggle */}
            <ViewToggle activeView={activeView} onViewChange={setActiveView} />

            {/* Products View */}
            {activeView === 'products' && (
              <div className="px-5 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-8">
                <div className="max-w-[1600px] mx-auto">
                  <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <h2 
                      className="text-lg sm:text-xl md:text-2xl font-semibold"
                      style={{ color: isDark ? '#ffffff' : '#111827' }}
                    >
                      {selectedCategory 
                        ? `${selectedCatalog?.name} - ${selectedCategory.name}`
                        : 'Barcha mahsulotlar'
                      }
                    </h2>
                    <span 
                      className="text-xs sm:text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      {(isLoadingProducts && hasCachedMarketContent) ? 'Yangilanmoqda...' : `${filteredProducts.length} ta`}
                    </span>
                  </div>

                  {/* Debug info - location and branch count */}
                  {selectedRegion && selectedDistrict && (
                    <div 
                      className="mb-4 p-3 rounded-xl text-xs"
                      style={{
                        background: isDark ? 'rgba(20, 184, 166, 0.1)' : 'rgba(20, 184, 166, 0.08)',
                        border: '1px solid rgba(20, 184, 166, 0.2)',
                        color: '#14b8a6',
                        display: 'none'
                      }}
                    >
                      📍 <strong>{selectedDistrict}, {selectedRegion}</strong> - 
                      {branches.filter(b => b.regionId === selectedRegion && b.districtId === selectedDistrict).length} ta filial, 
                      {branchProducts.length} ta mahsulot
                    </div>
                  )}

                  {/* No location selected */}
                  {!selectedRegion && !selectedDistrict && (
                    <div 
                      className="text-center py-16"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderRadius: '16px',
                      }}
                    >
                      <div className="text-4xl mb-4">📍</div>
                      <h3 
                        className="text-xl mb-2"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        Hududingizni tanlang
                      </h3>
                      <p 
                        className="text-sm mb-4"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      >
                        Mahsulotlarni ko'rish uchun yuqoridagi hudud tugmasini bosing
                      </p>
                    </div>
                  )}

                  {/* No branches in location */}
                  {selectedRegion && selectedDistrict && 
                   localBranchCount === 0 &&
                   filteredProducts.length === 0 && (
                    <div 
                      className="text-center py-16"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        borderRadius: '16px',
                      }}
                    >
                      <div className="text-4xl mb-4">🏢</div>
                      <h3 
                        className="text-xl mb-2"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        Bu hududda filiallar yo'q
                      </h3>
                      <p 
                        className="text-sm"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      >
                        <strong>{selectedDistrict}, {selectedRegion}</strong> hududida hozircha filiallarimiz mavjud emas
                      </p>
                    </div>
                  )}

                  {shouldShowMarketSkeleton && (
                    <SectionSkeleton
                      isDark={isDark}
                      accentColor={accentColor}
                      title="Mahsulotlar tayyorlanyapti..."
                      description="Hududingizdagi filiallar va mahsulotlar fonda yuklanyapti"
                      cardCount={10}
                    />
                  )}

                  {isLoadingProducts && hasCachedMarketContent && (
                    <div
                      className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                        color: accentColor.color,
                        boxShadow: isDark ? 'none' : '0 6px 18px rgba(15,23,42,0.08)',
                      }}
                    >
                      <span
                        className="h-2 w-2 animate-pulse rounded-full"
                        style={{ background: accentColor.color }}
                      />
                      Mahsulotlar yangilanmoqda
                    </div>
                  )}

                  {/* Products Grid - Only show if there are products */}
                  {filteredProducts.length > 0 && !shouldShowMarketSkeleton && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-5 md:gap-6 lg:gap-7 xl:gap-8">
                      {filteredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product as any}
                          onAddToCart={handleAddToCart}
                          onProductClick={setSelectedProduct}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Catalog View */}
            {activeView === 'catalog' && !selectedCatalogId && (
              <CatalogList 
                catalogs={catalogs} 
                onCatalogSelect={handleCatalogSelect}
              />
            )}

            {/* Category View */}
            {activeView === 'catalog' && selectedCatalogId && selectedCatalog && (
              <CategoryList
                catalogName={selectedCatalog.name}
                categories={selectedCatalog.categories}
                onCategorySelect={handleCategorySelect}
                onBack={handleBackToCatalogs}
              />
            )}
          </main>
        )}

        {/* Profil Modal - Full Screen */}
        {isProfileOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black">
            <LazySection
              isDark={true}
              accentColor={accentColor}
              title="Profil ochilyapti..."
              description="Sizning profilingiz tayyorlanyapti"
              cardCount={4}
            >
              <ProfileView
                initialTab={initialProfileTab}
                onOpenBonus={() => {
                  setIsProfileOpen(false);
                  setActiveTab('bonus');
                }}
              />
            </LazySection>
            <button
              onClick={() => setIsProfileOpen(false)}
              className="fixed top-6 left-4 z-50 p-2.5 rounded-2xl transition-all active:scale-90"
              style={{
                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                border: '0.5px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <svg className="size-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Do'kon Tab */}
        {activeTab === 'dokon' && !isProfileOpen && (
          <LazySection
            isDark={isDark}
            accentColor={accentColor}
            title="Do'konlar ochilyapti..."
            description="Do'konlar va mahsulotlar fonda tayyorlanyapti"
            cardCount={8}
          >
            <OnlineShops 
              initialTab="products"
              onAddToCart={(product, quantity, variantId, variantName) => {
                handleAddToCart(product, quantity, variantId, variantName);
                setTimeout(() => {
                  setIsCartOpen(true);
                }, 300);
              }} 
            />
          </LazySection>
        )}

        {/* Market Tab - Oziq-ovqat mahsulotlari */}
        {activeTab === 'market-oziq' && !isProfileOpen && (
          <LazySection
            isDark={isDark}
            accentColor={accentColor}
            title="Oziq-ovqat bo'limi ochilyapti..."
            description="Mahsulotlar tayyorlanyapti"
            cardCount={8}
          >
            <Market />
          </LazySection>
        )}

        {/* Taomlar Tab */}
        {activeTab === 'taomlar' && !isProfileOpen && (
          <LazySection
            isDark={isDark}
            accentColor={accentColor}
            title="Taomlar bo'limi ochilyapti..."
            description="Restoranlar va taomlar fonda yuklanyapti"
            cardCount={10}
          >
            <FoodsView 
              platform={platform}
              onAddToCart={(dish, quantity, variant, additionalProducts) => {
              // Calculate prices - ENSURE NUMBERS, NOT STRINGS!
              const addonsTotalPrice = additionalProducts.reduce((sum: number, addon: any) => {
                const addonPrice = Number(addon.price) || 0;
                const addonQty = Number(addon.quantity) || 1;
                return sum + (addonPrice * addonQty);
              }, 0);
              const variantPrice = Number(variant.price) || 0;
              const totalItemPrice = variantPrice + (addonsTotalPrice / quantity); // Price per unit
              
              console.log('💰 Price Calculation Debug:', {
                variantPrice,
                addonsTotalPrice,
                quantity,
                totalItemPrice,
                variant,
                additionalProducts
              });
              
              // Find restaurant
              const restaurant = dish.restaurantId; // This will be resolved in component
              
              // Create a rich cart item with full details
              const dishAsProduct = {
                id: Date.now() + Math.random(), // Unique ID
                name: dish.name,
                price: totalItemPrice, // Total price per unit (dish + addons)
                image: variant.image || dish.images[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
                categoryId: 'taomlar',
                catalogId: 'foods',
                rating: 5,
                // Food-specific details
                dishDetails: {
                  restaurantName: restaurant,
                  prepTime: variant.prepTime,
                  weight: dish.weight,
                  kcal: dish.kcal,
                },
                variantDetails: {
                  name: variant.name,
                  price: Number(variant.price) || 0, // Ensure number!
                  prepTime: variant.prepTime,
                },
                addons: additionalProducts.map((addon: any) => ({
                  name: addon.name,
                  price: Number(addon.price) || 0, // Ensure number!
                  quantity: Number(addon.quantity) || 1, // Ensure number!
                })),
              };
              
              handleAddToCart(dishAsProduct, quantity);
              
              // Open cart automatically
              setTimeout(() => {
                setIsCartOpen(true);
              }, 300);
              }}
            />
          </LazySection>
        )}

        {/* Atrof Tab */}
        {activeTab === 'atrof' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Atrof bo'limi ochilyapti..." description="Yaqin joylar tayyorlanyapti" cardCount={6}>
            <AroundView platform={platform} />
          </LazySection>
        )}

        {/* Mashinalar Tab */}
        {activeTab === 'mashinalar' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Mashinalar bo'limi ochilyapti..." description="Avtomobillar tayyorlanyapti" cardCount={8}>
            <CarsView 
              platform={platform}
              onAddToCart={(car) => {
              const carAsProduct = {
                id: parseInt(car.id.replace('car-', '')) + 30000,
                name: car.name,
                price: car.price,
                image: car.image,
                categoryId: car.category_id || 'cars',
                catalogId: 'cars',
                rating: car.rating
              };
              handleAddToCart(carAsProduct);
              }}
            />
          </LazySection>
        )}

        {/* Ijara Tab */}
        {activeTab === 'ijara' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Ijara bo'limi ochilyapti..." description="Ijara e'lonlari tayyorlanyapti" cardCount={8}>
            <RentalsView platform={platform} />
          </LazySection>
        )}

        {/* Xizmatlar Tab */}
        {activeTab === 'xizmatlar' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Xizmatlar bo'limi ochilyapti..." description="Xizmatlar fonda yuklanyapti" cardCount={8}>
            <ServicesView />
          </LazySection>
        )}

        {/* Xonalar Tab */}
        {activeTab === 'xonalar' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Ko'chmas mulk bo'limi ochilyapti..." description="E'lonlar tayyorlanyapti" cardCount={8}>
            <PropertiesView platform={platform as any} />
          </LazySection>
        )}

        {/* Mening Uy Tab */}
        {activeTab === 'mening-uyim' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Mening uy bo'limi ochilyapti..." description="Uy e'lonlari tayyorlanyapti" cardCount={8}>
            <HousesView />
          </LazySection>
        )}

        {/* Bonus Tab - Full Screen */}
        {activeTab === 'bonus' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Bonuslar bo'limi ochilyapti..." description="Bonus ma'lumotlari tayyorlanyapti" cardCount={4}>
            <Bonus onClose={() => setActiveTab('market')} />
          </LazySection>
        )}

        {activeTab === 'community' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Community ochilyapti..." description="Chat xonalari tayyorlanyapti" cardCount={5}>
            <CommunityView onBack={() => setActiveTab('market')} />
          </LazySection>
        )}

        {/* Auction Tab - Full Screen */}
        {activeTab === 'auksion' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Auksion bo'limi ochilyapti..." description="Auksion ma'lumotlari tayyorlanyapti" cardCount={6}>
            <AuctionView 
              onClose={() => setActiveTab('market')}
              cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
              onCartClick={() => setIsCartOpen(true)}
              onProfileClick={() => setIsProfileOpen(true)}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </LazySection>
        )}

        {/* Moshina Tab - Full Screen */}
        {activeTab === 'moshina' && !isProfileOpen && (
          <LazySection isDark={isDark} accentColor={accentColor} title="Moshina sahifasi ochilyapti..." description="Avtomobil sahifasi tayyorlanyapti" cardCount={5}>
            <CarPage onClose={() => setActiveTab('market')} />
          </LazySection>
        )}

        {/* Other tabs - Coming Soon */}
        {activeTab !== 'market' && 
         activeTab !== 'dokon' && 
         activeTab !== 'market-oziq' && 
         activeTab !== 'taomlar' && 
         activeTab !== 'atrof' && 
         activeTab !== 'mashinalar' && 
         activeTab !== 'ijara' && 
         activeTab !== 'xizmatlar' && 
         activeTab !== 'xonalar' && 
         activeTab !== 'mening-uyim' &&
         activeTab !== 'profil' && 
         activeTab !== 'bonus' && 
         activeTab !== 'community' &&
         activeTab !== 'auksion' && 
         activeTab !== 'moshina' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4">
            <div className="text-center">
              <div 
                className="inline-flex p-6 rounded-2xl border mb-6"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div 
                  className="size-16 rounded-xl border flex items-center justify-center"
                  style={{
                    background: `${accentColor.color}1a`,
                    borderColor: `${accentColor.color}33`,
                  }}
                >
                  <span className="text-3xl">🚀</span>
                </div>
              </div>
              <h2 
                className="text-2xl mb-3 capitalize"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {activeTab}
              </h2>
              <p 
                className="mb-6"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Bu bo'lim tez orada ochiladi
              </p>
              <div 
                className="inline-flex px-6 py-2.5 rounded-xl border"
                style={{
                  background: `${accentColor.color}1a`,
                  borderColor: `${accentColor.color}33`,
                }}
              >
                <span className="text-sm" style={{ color: accentColor.color }}>Soon</span>
              </div>
            </div>
          </div>
        )}

        <Cart
          items={cartItems as any}
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={() => setCartItems([])}
        />

        {/* Bottom Navigation - Always visible, responsive positioning */}
        {!isCommunityFullscreen && (
          <BottomNav 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
          />
        )}

        {/* Product Detail Modal */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            isOpen={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={(product, quantity, variantId, variantName) => {
              // Only add once when button is clicked
              handleAddToCart(product, quantity, variantId, variantName);
              // Close modal
              setSelectedProduct(null);
              // Open cart automatically after adding
              setTimeout(() => {
                setIsCartOpen(true);
              }, 300); // Small delay for smooth transition
            }}
            cartItems={cartItems.map(item => ({
              id: item.id,
              selectedVariantId: item.selectedVariantId,
              quantity: item.quantity
            }))}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
          />
        )}

        {/* SMS Auth Modal - For phone number authentication */}
        <SMSAuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={(user, session) => {
            smsSignin(user, session);
          }}
        />

        {/* Footer - Only show on desktop */}
        {!isCommunityFullscreen && (
          <footer 
            className="hidden sm:block mt-12 sm:mt-20 border-t"
            style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              background: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.02)',
            }}
          >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              <div className="col-span-2 lg:col-span-1">
                <h3 
                  className="text-lg sm:text-xl mb-3 sm:mb-4"
                  style={{ color: textColor }}
                >
                  TechStore
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Eng yaxshi texnologiyalar bir joyda
                </p>
              </div>
              <div>
                <h4 
                  className="mb-3 sm:mb-4 text-sm"
                  style={{ color: textColor }}
                >
                  Yordam
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Yetkazib berish
                    </a>
                  </li>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Qaytarish
                    </a>
                  </li>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Kafolat
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 
                  className="mb-3 sm:mb-4 text-sm"
                  style={{ color: textColor }}
                >
                  Kompaniya
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Biz haqimizda
                    </a>
                  </li>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Kontaktlar
                    </a>
                  </li>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Vakansiyalar
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 
                  className="mb-3 sm:mb-4 text-sm"
                  style={{ color: textColor }}
                >
                  Ijtimoiy
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Instagram
                    </a>
                  </li>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Telegram
                    </a>
                  </li>
                  <li>
                    <a 
                      href="#" 
                      className="transition-colors"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = accentColor.color}
                      onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'}
                    >
                      Facebook
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div 
              className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t text-center text-xs sm:text-sm"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
              }}
            >
              © 2026 TechStore. Barcha huquqlar himoyalangan.
            </div>
          </div>
          </footer>
        )}
      </div>
    </div>
  );
}