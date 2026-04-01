import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ViewToggle } from './components/ViewToggle';
import { ProductCard } from './components/ProductCard';
import { BottomNav } from './components/BottomNav';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CatalogList } from './components/CatalogList';
import { CategoryList } from './components/CategoryList';
import { Cart } from './components/Cart';
import ProfileView from './components/ProfileView';
import { MarketOrdersPreview } from './components/MarketOrdersPreview';
import { ShopView } from './components/ShopView';
import OnlineShops from './components/OnlineShops';
import Market from './components/Market';
import FoodsView from './components/FoodsView';
import { AroundView } from './components/AroundView';
import { CarsView } from './components/CarsView';
import { RentalsView } from './components/RentalsView';
import { ServicesView } from './components/ServicesView';
import { PropertiesView } from './components/PropertiesView';
import { HousesView } from './components/HousesView';
import { CommunityView } from './components/CommunityView';
import { SMSAuthModal } from './components/SMSAuthModal';
import { AuctionView } from './components/AuctionView';
import { BannerCarousel } from './components/BannerCarousel';
import { catalogs } from './data/categories';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';
import { useLocation } from './context/LocationContext';
import { useRentalCart } from './context/RentalCartContext';
import { CheckoutFlowProvider } from './context/CheckoutFlowContext';
import Bonus from './pages/Bonus';
import CarPage from './pages/Car';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { canAddQuantity, canSetQuantity, getRegularCartStockIssues, getRentalCartStockIssues } from './utils/cartStock';
import { deriveCheckoutOrderType } from './utils/checkoutOrderType';
import { isBranchProductStorageId } from './utils/submitRegularCartOrderQuick';
import { useVisibilityRefetch } from './utils/visibilityRefetch';
import { TestBackend } from './test-backend';
import ProductionApiService from '../services/productionApi';
import { SupportChatWidget } from './components/SupportChatWidget';
import Checkout from './components/Checkout';
import { RentalTermsConsentModal } from './components/RentalTermsConsentModal';
import { useMarketplaceNativeCartBadge } from './hooks/useMarketplaceNativeCartBadge';
import {
  ProductGridSkeleton,
  SectionHeaderSkeleton,
} from './components/skeletons';

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
  /** Filial katalogidagi mahsulot UUID (order_items / v2 sync) */
  productUuid?: string;
  /** Mashina / boshqa bo'limlar: false bo'lsa buyurtma berilmaydi */
  available?: boolean;
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

export default function AppContent() {
  const { theme, accentColor } = useTheme();
  const { isAuthenticated, smsSignin, user, accessToken, isAuthOpen, setIsAuthOpen } = useAuth();
  const { selectedRegion, selectedDistrict } = useLocation();
  const { cartItems: rentalLineItems, clearCart: clearRentalCart } = useRentalCart();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [flowCheckoutOpen, setFlowCheckoutOpen] = useState(false);
  const [flowRentalTermsOpen, setFlowRentalTermsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('market');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileOrderCategoryPreset, setProfileOrderCategoryPreset] = useState<
    undefined | 'all' | 'market' | 'shop' | 'rent' | 'food' | 'auction'
  >(undefined);
  const [isBonusOpen, setIsBonusOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Debug location selection
  useEffect(() => {
    console.log('📍 AppContent Location:', { selectedRegion, selectedDistrict });
  }, [selectedRegion, selectedDistrict]);

  // Debug activeTab changes
  useEffect(() => {
    console.log('🔴 AppContent: activeTab changed to:', activeTab);
  }, [activeTab]);

  // Platform detection
  const platform = 'ios'; // iOS uslubidagi dizayn
  
  // Yangi state'lar
  const [activeView, setActiveView] = useState<'products' | 'catalog'>('products');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Branch products state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchProducts, setBranchProducts] = useState<Product[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh trigger
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useVisibilityRefetch(() => setRefreshKey((k) => k + 1));

  const parseMoneyValue = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const digitsOnly = String(value ?? '').replace(/[^\d-]/g, '');
    if (!digitsOnly || digitsOnly === '-' || digitsOnly === '--') return 0;
    const parsed = Number(digitsOnly);
    return Number.isFinite(parsed) ? parsed : 0;
  };

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

  /** Savatda productUuid yo‘q bo‘lsa (eski saqlangan savat), yuklangan katalogdan to‘ldiramiz */
  useEffect(() => {
    if (!branchProducts.length) return;
    setCartItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (isBranchProductStorageId(item.productUuid)) return item;
        const match = branchProducts.find(
          (bp) =>
            Number(bp.id) === Number(item.id) &&
            (!item.branchId || String(bp.branchId || '') === String(item.branchId || '')),
        );
        if (match?.productUuid) {
          changed = true;
          return {
            ...item,
            productUuid: match.productUuid,
            branchId: match.branchId || item.branchId,
          };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [branchProducts]);

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
      try {
        setIsLoadingBranches(true);
        console.log('📡 Fetching branches from Production API...');
        
        const response = await ProductionApiService.getBranches();
        
        if (response.success && response.data) {
          console.log('✅ Branches loaded from Production API:', response.data.branches.length);
          
          setBranches(response.data.branches);
          
          // Also save to localStorage as cache
          localStorage.setItem('branches', JSON.stringify(response.data.branches));
        } else {
          throw new Error(response.error || 'Failed to load branches');
        }
      } catch (error) {
        console.error('❌ Error loading branches:', error);
        toast.error('Filiallar yuklanmadi');
        
        // Fallback to localStorage
        const storedBranches = localStorage.getItem('branches');
        if (storedBranches) {
          setBranches(JSON.parse(storedBranches));
          console.log('⚠️ Using cached branches from localStorage');
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
      // console.log('🔍 Loading products for:', { selectedRegion, selectedDistrict, branchCount: branches.length });
      
      if (!selectedRegion || !selectedDistrict || branches.length === 0) {
        // console.log('⚠️ No region/district selected or no branches loaded');
        setBranchProducts([]);
        setIsLoadingProducts(false);
        return;
      }

      // Get branches in user's location
      const localBranches = branches.filter(
        b => b.regionId === selectedRegion && b.districtId === selectedDistrict
      );

      console.log('🏢 Local branches:', localBranches.length);

      if (localBranches.length === 0) {
        // console.log('⚠️ No branches in this location');
        setBranchProducts([]);
        setIsLoadingProducts(false);
        return;
      }

      try {
        setIsLoadingProducts(true);
        // console.log('📡 Fetching products from Supabase...');
        // console.log('🔗 URL:', `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products`);
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products?includeSold=false`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('📊 Response status:', response.status);
        console.log('📊 Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Server error:', errorText);
          throw new Error(`Failed to load products: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('📦 Response data:', data);
        const allBranchProducts: BranchProduct[] = data.products || [];
        console.log('📦 Total products from Supabase:', allBranchProducts.length);
        
        // Filter products by local branches
        const localBranchIds = localBranches.map(b => b.id);
        const filteredProducts = allBranchProducts.filter(p => 
          localBranchIds.includes(p.branchId)
        );

        console.log(' Filtered products for local branches:', filteredProducts.length);

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
        const displayProducts: Product[] = filteredProducts.map(bp => {
          // Use first variant as default display values
          const firstVariant = bp.variants[0];
          
          return {
            id: stringToNumber(bp.id), // Convert UUID string to number
            productUuid: bp.id,
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
          };
        });

        console.log('🎯 Final display products:', displayProducts.length);
        console.log('📋 Sample product with variants:', displayProducts[0]);
        setBranchProducts(displayProducts);
        
        // Cache to localStorage
        localStorage.setItem('products', JSON.stringify(allBranchProducts));
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
        
        // Fallback to localStorage
        const storedProducts = localStorage.getItem('products');
        if (storedProducts) {
          console.log('⚠️ Using cached products from localStorage');
          const allBranchProducts: BranchProduct[] = JSON.parse(storedProducts);
          const localBranchIds = localBranches.map(b => b.id);
          const filteredProducts = allBranchProducts.filter(p => 
            localBranchIds.includes(p.branchId)
          );
          
          const displayProducts: Product[] = filteredProducts.map(bp => {
            const firstVariant = bp.variants[0];
            return {
              id: stringToNumber(bp.id),
              productUuid: bp.id,
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
            };
          });
          
          setBranchProducts(displayProducts);
        } else {
          console.log('⚠️ No cached products available, showing empty state');
          setBranchProducts([]);
        }
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadProducts();
  }, [selectedRegion, selectedDistrict, branches.length, refreshKey]); // Use branches.length instead of branches array

  // Use only real branch products - removed test/random products
  const allProducts = branchProducts;

  // Filterlangan mahsulotlar
  const filteredProducts = selectedCategoryId && selectedCatalogId
    ? allProducts.filter(p => p.categoryId === selectedCategoryId && p.catalogId === selectedCatalogId)
    : allProducts;

  const handleAddToCart = (product: Product, quantity: number = 1, variantId?: string, variantName?: string) => {
    const cartKey = variantId ? `${product.id}_${variantId}` : `${product.id}_default`;
    const existing = cartItems.find((item) => {
      const itemKey = item.selectedVariantId
        ? `${item.id}_${item.selectedVariantId}`
        : `${item.id}_default`;
      return itemKey === cartKey;
    });
    const currentQty = existing ? existing.quantity : 0;
    const check = canAddQuantity(product, variantId, currentQty, quantity);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }

    setCartItems((prev) => {
      const ex = prev.find((item) => {
        const itemKey = item.selectedVariantId
          ? `${item.id}_${item.selectedVariantId}`
          : `${item.id}_default`;
        return itemKey === cartKey;
      });

      if (ex) {
        return prev.map((item) => {
          const itemKey = item.selectedVariantId
            ? `${item.id}_${item.selectedVariantId}`
            : `${item.id}_default`;
          return itemKey === cartKey
            ? { ...item, quantity: item.quantity + quantity }
            : item;
        });
      }

      return [
        ...prev,
        {
          ...product,
          quantity,
          selectedVariantId: variantId,
          selectedVariantName: variantName,
        },
      ];
    });
  };

  const handleUpdateQuantity = (id: number, quantity: number, variantId?: string) => {
    console.log('🔄 handleUpdateQuantity called:', { id, quantity, variantId });
    console.log('📋 Current cart items:', cartItems);

    const target = cartItems.find((item) =>
      variantId
        ? item.id === id && item.selectedVariantId === variantId
        : item.id === id && !item.selectedVariantId,
    );
    if (target && quantity > 0) {
      const check = canSetQuantity(target, quantity);
      if (!check.ok) {
        toast.error(check.message);
        return;
      }
    }

    setCartItems((prev) => {
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

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const headerCartBadge = cartCount + rentalLineItems.length;
  useMarketplaceNativeCartBadge(headerCartBadge);

  const checkoutFlowCartSubtotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => {
        const basePrice = Number(item.variantDetails?.price) || Number(item.price) || 0;
        const addonsTotal =
          item.addons?.reduce((addonSum, addon) => {
            return addonSum + (Number(addon.price) || 0) * (Number(addon.quantity) || 1);
          }, 0) || 0;
        const perUnitPrice = basePrice + addonsTotal;
        return sum + perUnitPrice * (Number(item.quantity) || 0);
      }, 0),
    [cartItems],
  );

  const checkoutOrderTypeDerived = useMemo(
    () => deriveCheckoutOrderType(cartItems, rentalLineItems.length),
    [cartItems, rentalLineItems.length],
  );

  const openCheckoutFlow = useCallback(() => {
    if (cartItems.length === 0 && rentalLineItems.length === 0) {
      toast.error('Savat bo‘sh', { description: 'Avval mahsulot yoki ijara qo‘shing' });
      return;
    }

    const regIssues =
      cartItems.length > 0 ? getRegularCartStockIssues(cartItems as any[]) : [];
    const rentIssues =
      rentalLineItems.length > 0 ? getRentalCartStockIssues(rentalLineItems as any[]) : [];
    const allIssues =
      cartItems.length > 0 && rentalLineItems.length > 0
        ? [...regIssues, ...rentIssues]
        : cartItems.length > 0
          ? regIssues
          : rentIssues;
    if (allIssues.length > 0) {
      toast.error('Buyurtma berib bo‘lmaydi', {
        description: allIssues.slice(0, 4).join('\n'),
        duration: 6000,
      });
      return;
    }

    /** Ijara bo‘limidan savatda ijara bo‘lsa — avval «IJARA SHARTLARI», keyin «Roziman» → checkout */
    if (rentalLineItems.length > 0) {
      setFlowRentalTermsOpen(true);
      return;
    }

    if (!user) {
      toast.error('Avval tizimga kiring', {
        description: 'Buyurtma rasmiylashtirish uchun profilingizga kiring',
        duration: 4000,
      });
      setIsCartOpen(false);
      setIsAuthOpen(true);
      return;
    }

    setIsCartOpen(false);
    setFlowCheckoutOpen(true);
  }, [user, cartItems, rentalLineItems, setIsAuthOpen]);

  const isCommunityFullscreen = activeTab === 'community' && !isProfileOpen;
  
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#000000' : '#f9fafb';
  const textColor = isDark ? '#ffffff' : '#111827';

  const marketProductsLoading =
    activeTab === 'market' &&
    activeView === 'products' &&
    !!selectedRegion &&
    !!selectedDistrict &&
    (isLoadingBranches || isLoadingProducts);

  return (
    <CheckoutFlowProvider value={{ openCheckoutFlow }}>
    <div 
      className={
        isCommunityFullscreen
          ? 'h-dvh min-h-dvh overflow-hidden'
          : 'min-h-dvh pb-24 sm:pb-32 max-[639px]:pb-[max(6rem,calc(6rem+env(safe-area-inset-bottom,0px)))]'
      }
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Backend health test - runs on mount */}
      <TestBackend />
      
      {/* Max-width container for desktop */}
      <div className={isCommunityFullscreen ? 'h-full' : 'mx-auto max-w-[1600px]'}>
        {!isCommunityFullscreen && (
          <Header
            cartCount={headerCartBadge}
            onCommunityClick={() => setActiveTab('community')}
            onCartClick={() => setIsCartOpen(true)}
            onProfileClick={() => {
              setProfileOrderCategoryPreset(undefined);
              setIsProfileOpen(true);
            }}
            onAuthClick={!isAuthenticated ? () => setIsAuthOpen(true) : undefined}
          />
        )}

        {activeTab === 'market' && !isProfileOpen && !isCommunityFullscreen && (
          <div className="px-4 sm:px-6 pt-1">
            <MarketOrdersPreview
              onViewAll={() => {
                setProfileOrderCategoryPreset('market');
                setIsProfileOpen(true);
              }}
            />
          </div>
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
                    {marketProductsLoading ? (
                      <SectionHeaderSkeleton isDark={isDark} />
                    ) : (
                      <>
                        <h2
                          className="text-lg sm:text-xl md:text-2xl font-semibold"
                          style={{ color: isDark ? '#ffffff' : '#111827' }}
                        >
                          {selectedCategory
                            ? `${selectedCatalog?.name} - ${selectedCategory.name}`
                            : 'Barcha mahsulotlar'}
                        </h2>
                        <span
                          className="text-xs sm:text-sm"
                          style={{
                            color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          {filteredProducts.length} ta
                        </span>
                      </>
                    )}
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

                  {/* No branches in location (yuklash tugagach — dastlabki yuklashda skelet ko‘rinadi) */}
                  {selectedRegion &&
                    selectedDistrict &&
                    !isLoadingBranches &&
                    !isLoadingProducts &&
                    branches.filter(
                      (b) => b.regionId === selectedRegion && b.districtId === selectedDistrict,
                    ).length === 0 &&
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

                  {marketProductsLoading && (
                    <ProductGridSkeleton isDark={isDark} count={10} />
                  )}

                  {/* Products Grid - Only show if there are products */}
                  {!marketProductsLoading && filteredProducts.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-5 md:gap-6 lg:gap-7 xl:gap-8">
                      {filteredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
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
            <ProfileView
              initialOrderCategory={profileOrderCategoryPreset}
              onOpenBonus={() => {
                setIsProfileOpen(false);
                setProfileOrderCategoryPreset(undefined);
                setActiveTab('bonus');
              }}
            />
            <button
              onClick={() => {
                setIsProfileOpen(false);
                setProfileOrderCategoryPreset(undefined);
              }}
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
          <OnlineShops 
            initialTab="products"
            catalogRefreshKey={refreshKey}
            onAddToCart={(product, quantity, variantId, variantName) => {
              handleAddToCart(
                { ...product, source: 'shop' },
                quantity,
                variantId,
                variantName,
              );
              // Open cart automatically after adding
              setTimeout(() => {
                setIsCartOpen(true);
              }, 300);
            }} 
          />
        )}

        {/* Market Tab - Oziq-ovqat mahsulotlari */}
        {activeTab === 'market-oziq' && !isProfileOpen && (
          <Market />
        )}

        {/* Taomlar Tab */}
        {activeTab === 'taomlar' && !isProfileOpen && (
          <FoodsView 
            platform={platform}
            onAddToCart={(dish, quantity, variant, additionalProducts) => {
              // Calculate prices - ENSURE NUMBERS, NOT STRINGS!
              const addonsTotalPrice = additionalProducts.reduce((sum: number, addon: any) => {
                const addonPrice = parseMoneyValue(addon.price);
                const addonQty = Number(addon.quantity) || 1;
                return sum + (addonPrice * addonQty);
              }, 0);
              const variantPrice = parseMoneyValue(variant.price);
              const totalItemPrice = variantPrice + addonsTotalPrice; // Price per unit
              
              console.log('💰 Price Calculation Debug:', {
                variantPrice,
                addonsTotalPrice,
                quantity,
                totalItemPrice,
                variant,
                additionalProducts
              });
              
              const restaurantName = dish.restaurantName || dish.restaurantId;
              
              // Create a rich cart item with full details
              const vStock = (variant as any)?.stockQuantity ?? (variant as any)?.stockCount;
              const dStock = (dish as any)?.stockQuantity ?? (dish as any)?.stockCount;
              const dishAsProduct = {
                id: Date.now() + Math.random(), // Unique ID
                name: dish.name,
                price: totalItemPrice, // Total price per unit (dish + addons)
                image: variant.image || dish.images[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
                categoryId: 'taomlar',
                catalogId: 'foods',
                rating: 5,
                restaurantId: dish.restaurantId,
                restaurantBranchId: dish.restaurantBranchId || null,
                restaurantRegion: dish.restaurantRegion || null,
                restaurantDistrict: dish.restaurantDistrict || null,
                ...(typeof (dish as any)?.available === 'boolean'
                  ? { available: (dish as any).available }
                  : {}),
                ...(Number.isFinite(Number(vStock))
                  ? { stockQuantity: Math.floor(Number(vStock)) }
                  : Number.isFinite(Number(dStock))
                    ? { stockQuantity: Math.floor(Number(dStock)) }
                    : {}),
                // Food-specific details
                dishDetails: {
                  restaurantName,
                  prepTime: variant.prepTime,
                  weight: dish.weight,
                  kcal: dish.kcal,
                },
                variantDetails: {
                  name: variant.name,
                  price: parseMoneyValue(variant.price),
                  prepTime: variant.prepTime,
                },
                addons: additionalProducts.map((addon: any) => ({
                  name: addon.name,
                  price: parseMoneyValue(addon.price),
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
        )}

        {/* Atrof Tab */}
        {activeTab === 'atrof' && !isProfileOpen && (
          <AroundView platform={platform} />
        )}

        {/* Mashinalar Tab */}
        {activeTab === 'mashinalar' && !isProfileOpen && (
          <CarsView 
            platform={platform}
            onAddToCart={(car) => {
              const carAsProduct = {
                id: parseInt(car.id.replace('car-', '')) + 30000,
                name: car.name,
                price: car.price,
                image: car.image,
                categoryId: car.categoryId,
                catalogId: 'cars',
                rating: car.rating,
                available: car.available,
              };
              handleAddToCart(carAsProduct);
            }}
          />
        )}

        {/* Ijara Tab */}
        {activeTab === 'ijara' && !isProfileOpen && (
          <RentalsView platform={platform} />
        )}

        {/* Xizmatlar Tab */}
        {activeTab === 'xizmatlar' && !isProfileOpen && (
          <ServicesView />
        )}

        {/* Xonalar Tab */}
        {activeTab === 'xonalar' && !isProfileOpen && (
          <PropertiesView />
        )}

        {/* Mening Uy Tab */}
        {activeTab === 'mening-uyim' && !isProfileOpen && (
          <HousesView />
        )}

        {/* Bonus Tab - Full Screen */}
        {activeTab === 'bonus' && !isProfileOpen && (
          <Bonus onClose={() => setActiveTab('market')} />
        )}

        {activeTab === 'community' && !isProfileOpen && (
          <CommunityView onBack={() => setActiveTab('market')} />
        )}

        {/* Auction Tab - Full Screen */}
        {activeTab === 'auksion' && !isProfileOpen && (
          <AuctionView 
            onClose={() => setActiveTab('market')}
            cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
            onCartClick={() => setIsCartOpen(true)}
            onProfileClick={() => {
              setProfileOrderCategoryPreset(undefined);
              setIsProfileOpen(true);
            }}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}

        {/* Moshina Tab - Full Screen */}
        {activeTab === 'moshina' && !isProfileOpen && (
          <CarPage onClose={() => setActiveTab('market')} />
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
          items={cartItems}
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={() => setCartItems([])}
          onSuccessfulOrder={() => setRefreshKey((k) => k + 1)}
        />

        {/* Bottom Navigation - Always visible, responsive positioning */}
        {!isCommunityFullscreen && (
          <BottomNav 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
          />
        )}

        <SupportChatWidget activeTab={activeTab} isProfileOpen={isProfileOpen} />

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

      <RentalTermsConsentModal
        open={flowRentalTermsOpen}
        onClose={() => setFlowRentalTermsOpen(false)}
        onConfirm={async () => {
          if (!isAuthenticated || !accessToken) {
            toast.error('Buyurtma uchun avval tizimga kiring');
            setIsAuthOpen(true);
            return;
          }
          const customerName = user?.name || user?.firstName || '';
          let customerPhone = user?.phone || '';
          if (customerPhone) {
            customerPhone = customerPhone.replace(/[\s+]/g, '');
            if (customerPhone.startsWith('998')) {
              customerPhone = `+${customerPhone}`;
            } else if (!customerPhone.startsWith('+998')) {
              customerPhone = `+998${customerPhone}`;
            }
          }
          if (!customerName.trim() || !customerPhone.trim()) {
            toast.error('Profilda ism va telefonni to‘ldiring', {
              description: 'Buyurtma uchun ma’lumot kerak',
            });
            return;
          }

          setFlowRentalTermsOpen(false);
          setIsCartOpen(false);
          setFlowCheckoutOpen(true);
        }}
        isDark={isDark}
        accentColor={accentColor}
      />

      {flowCheckoutOpen && (
        <Checkout
          cartItems={cartItems as any[]}
          totalAmount={checkoutFlowCartSubtotal}
          orderType={checkoutOrderTypeDerived}
          rentalLineItems={rentalLineItems.length > 0 ? rentalLineItems : undefined}
          rentalTermsPreAccepted={rentalLineItems.length > 0}
          onClose={() => setFlowCheckoutOpen(false)}
          onOrderSuccess={() => {
            setCartItems([]);
            setRefreshKey((k) => k + 1);
          }}
          onRentalSuccess={() => {
            clearRentalCart();
          }}
        />
      )}
    </div>
    </CheckoutFlowProvider>
  );
}