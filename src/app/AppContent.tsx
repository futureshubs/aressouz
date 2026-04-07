import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { Header } from './components/Header';
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
import { CommunityBackgroundNotifier } from './components/CommunityBackgroundNotifier';
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
import { SiteFooter } from './components/SiteFooter';
import Checkout from './components/Checkout';
import { RentalTermsConsentModal } from './components/RentalTermsConsentModal';
import { useMarketplaceNativeCartBadge } from './hooks/useMarketplaceNativeCartBadge';
import { useMainAppNavigation } from './hooks/useMainAppNavigation';
import { MAIN_APP_QUERY, patchSearchParams } from './utils/mainAppSearchParams';
import {
  ProductGridSkeleton,
  SectionHeaderSkeleton,
} from './components/skeletons';
import { devLog } from './utils/devLog';
import { captureReferralFromUrlToSession } from './utils/bonusReferralDeepLink';

const MAIN_ACTIVE_TAB_KEY = 'aresso:mainActiveTab';

function readStoredMainActiveTab(): string {
  if (typeof sessionStorage === 'undefined') return 'market';
  try {
    const v = sessionStorage.getItem(MAIN_ACTIVE_TAB_KEY)?.trim();
    if (!v || v.length > 64) return 'market';
    if (!/^[\w-]+$/.test(v)) return 'market';
    return v;
  } catch {
    return 'market';
  }
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
  /** Filial katalogidagi mahsulot UUID (order_items / v2 sync) */
  productUuid?: string;
  /** Mashina / boshqa bo'limlar: false bo'lsa buyurtma berilmaydi */
  available?: boolean;
}

interface CartItem extends Product {
  quantity: number;
  /** Savat qatorini birlashtirish kaliti (market: productUuid + variant) */
  cartLineKey?: string;
  selectedVariantId?: string; // Add variant tracking
  selectedVariantName?: string; // For display
  /** Taom KV kaliti (checkout — hech qachon vaqtinchalik savat id ishlatilmasin) */
  dishId?: string;
  // Food-specific fields
  dishDetails?: {
    dishId?: string;
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

/**
 * Taom: bir xil taom + variant + qo'shimcha = bitta qator (miqdor qo'shiladi);
 * boshqa variant / qo'shimcha = alohida qator. Savat `id` checkout uchun emas — `dishId` alohida.
 */
function stableFoodCartLineNumericId(
  dishId: string,
  variantLabel: string,
  addons: { name?: string; quantity?: number }[],
): number {
  const addonSig = addons
    .map((a) =>
      `${String(a.name ?? '').trim()}:${Math.max(1, Math.floor(Number(a.quantity) || 1))}`,
    )
    .sort()
    .join('|');
  const s = `${String(dishId).trim()}\u0000${String(variantLabel).trim()}\u0000${addonSig}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const n = h % 2000000000;
  return n > 0 ? n : 1;
}

/** Bir xil mahsulot + variant = bitta qator; boshqa variant = alohida qator */
function regularCartLineKey(product: Product, variantId: string | undefined): string {
  const pu = String((product as Product & { productUuid?: string }).productUuid ?? '').trim();
  const base = pu || `id_${product.id}`;
  const v =
    variantId != null && String(variantId).trim() !== '' && String(variantId).trim() !== '0'
      ? String(variantId).trim()
      : 'default';
  return `${base}::${v}`;
}

function regularCartLineKeyFromItem(item: CartItem): string {
  if (item.cartLineKey) return item.cartLineKey;
  const pu = String(item.productUuid ?? '').trim();
  const base = pu || `id_${item.id}`;
  const v =
    item.selectedVariantId != null &&
    String(item.selectedVariantId).trim() !== '' &&
    String(item.selectedVariantId).trim() !== '0'
      ? String(item.selectedVariantId).trim()
      : 'default';
  return `${base}::${v}`;
}

/** Bozor/do‘kon: tanlangan variant narxi + `variantDetails` — savat/checkout `item.price` faqat birinchi variant bo‘lib qolmasin */
function buildCartLinePricing(
  product: Product,
  variantId?: string,
  variantName?: string,
): {
  unitPrice: number;
  oldPrice?: number;
  variantDetails?: CartItem['variantDetails'];
  selectedVariantName?: string;
} {
  const asCart = product as CartItem;
  const prebuiltVd = asCart.variantDetails;
  const isFoodLine =
    Boolean(asCart.dishDetails) ||
    asCart.catalogId === 'foods' ||
    asCart.categoryId === 'taomlar' ||
    Boolean((asCart as { dishId?: string }).dishId);

  if (isFoodLine && prebuiltVd) {
    return {
      unitPrice: Number(product.price) || 0,
      variantDetails: prebuiltVd,
      selectedVariantName: asCart.selectedVariantName,
    };
  }

  const vid = variantId != null ? String(variantId).trim() : '';
  if (!vid || vid === '0') {
    return {
      unitPrice: Number(product.price) || 0,
      oldPrice: product.oldPrice,
    };
  }

  const v = product.variants?.find((x) => String(x.id) === vid);
  if (!v) {
    return {
      unitPrice: Number(product.price) || 0,
      oldPrice: product.oldPrice,
    };
  }

  const p = Number(v.price) || 0;
  const label =
    (variantName && String(variantName).trim()) || v.name || 'Variant';
  return {
    unitPrice: p,
    oldPrice: v.oldPrice ?? product.oldPrice,
    variantDetails: { name: label, price: p },
    selectedVariantName: label,
  };
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
  const { parsed, goTab, pushPatch, replacePatch, goBack, searchParams, replaceSearch } =
    useMainAppNavigation();
  const { selectedRegion, selectedDistrict } = useLocation();
  const { cartItems: rentalLineItems, clearCart: clearRentalCart } = useRentalCart();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [profileOrderCategoryPreset, setProfileOrderCategoryPreset] = useState<
    undefined | 'all' | 'market' | 'shop' | 'rent' | 'food' | 'auction'
  >(undefined);

  const activeTab = parsed.tab;
  const isCartOpen = parsed.cart;
  const isProfileOpen = parsed.profile;
  const flowCheckoutOpen = parsed.checkout;
  const flowRentalTermsOpen = parsed.rterms;
  const activeView = parsed.view;
  const selectedCatalogId = parsed.catalogId;
  const selectedCategoryId = parsed.categoryId;

  const mainNavBoot = useRef(false);
  const menuCloseRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (mainNavBoot.current) return;
    mainNavBoot.current = true;
    if (!searchParams.has(MAIN_APP_QUERY.tab)) {
      const stored = readStoredMainActiveTab();
      replaceSearch(patchSearchParams(searchParams, { tab: stored }));
    }
  }, [searchParams, replaceSearch]);

  useLayoutEffect(() => {
    captureReferralFromUrlToSession();
  }, []);

  const authInUrl = searchParams.get(MAIN_APP_QUERY.auth) === '1';
  useEffect(() => {
    setIsAuthOpen(authInUrl);
  }, [authInUrl, setIsAuthOpen]);

  useEffect(() => {
    if (!isAuthOpen) return;
    if (searchParams.get(MAIN_APP_QUERY.auth) === '1') return;
    pushPatch({ auth: '1' });
  }, [isAuthOpen, searchParams, pushPatch]);
  
  // Debug location selection
  useEffect(() => {
    devLog('📍 AppContent Location:', { selectedRegion, selectedDistrict });
  }, [selectedRegion, selectedDistrict]);

  useEffect(() => {
    try {
      sessionStorage.setItem(MAIN_ACTIVE_TAB_KEY, activeTab);
    } catch {
      /* private mode / quota */
    }
  }, [activeTab]);

  // Platform detection
  const platform = 'ios'; // iOS uslubidagi dizayn
  
  // Branch products state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchProducts, setBranchProducts] = useState<Product[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh trigger
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  /** Faqat bozor / do‘kon — filial mahsulotlari shu yerda; boshqa tablarda visibility qaytganda qayta yuklamaymiz */
  useVisibilityRefetch(() => {
    const t = activeTabRef.current;
    if (t !== 'market' && t !== 'dokon') return;
    setRefreshKey((k) => k + 1);
  });

  useEffect(() => {
    if (!isProfileOpen) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [isProfileOpen]);

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
    document.documentElement.style.setProperty('--accent-color', accentColor.color);
    document.documentElement.style.setProperty('--accent-gradient', accentColor.gradient);
  }, [accentColor]);

  // Initialize test shops - DISABLED (use admin panel to create shops)
  // Users should create shops via branch panel instead of auto-loading test data
  
  // Load branches from Supabase
  useEffect(() => {
    const loadBranches = async () => {
      try {
        setIsLoadingBranches(true);
        devLog('📡 Fetching branches from Production API...');
        
        const response = await ProductionApiService.getBranches();
        
        if (response.success && response.data) {
          devLog('✅ Branches loaded from Production API:', response.data.branches.length);
          
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
          devLog('⚠️ Using cached branches from localStorage');
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
      // devLog('🔍 Loading products for:', { selectedRegion, selectedDistrict, branchCount: branches.length });
      
      if (!selectedRegion || !selectedDistrict || branches.length === 0) {
        // devLog('⚠️ No region/district selected or no branches loaded');
        setBranchProducts([]);
        setIsLoadingProducts(false);
        return;
      }

      // Get branches in user's location
      const localBranches = branches.filter(
        b => b.regionId === selectedRegion && b.districtId === selectedDistrict
      );

      devLog('🏢 Local branches:', localBranches.length);

      if (localBranches.length === 0) {
        // devLog('⚠️ No branches in this location');
        setBranchProducts([]);
        setIsLoadingProducts(false);
        return;
      }

      try {
        setIsLoadingProducts(true);
        // devLog('📡 Fetching products from Supabase...');
        // devLog('🔗 URL:', `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products`);
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products?includeSold=false`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        devLog('📊 Response status:', response.status);
        devLog('📊 Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Server error:', errorText);
          throw new Error(`Failed to load products: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        devLog('📦 Response data:', data);
        const allBranchProducts: BranchProduct[] = data.products || [];
        devLog('📦 Total products from Supabase:', allBranchProducts.length);
        
        // Filter products by local branches
        const localBranchIds = localBranches.map(b => b.id);
        const filteredProducts = allBranchProducts.filter(p => 
          localBranchIds.includes(p.branchId)
        );

        devLog(' Filtered products for local branches:', filteredProducts.length);

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

        devLog('🎯 Final display products:', displayProducts.length);
        devLog('📋 Sample product with variants:', displayProducts[0]);
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
          devLog('⚠️ Using cached products from localStorage');
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
          devLog('⚠️ No cached products available, showing empty state');
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

  const selectedProduct = useMemo((): Product | null => {
    const key = parsed.productKey;
    if (!key) return null;
    const byUuid = allProducts.find((p) => String(p.productUuid ?? '').trim() === key);
    if (byUuid) return byUuid;
    return allProducts.find((p) => String(p.id) === key) ?? null;
  }, [parsed.productKey, allProducts]);

  // Filterlangan mahsulotlar
  const filteredProducts = selectedCategoryId && selectedCatalogId
    ? allProducts.filter(p => p.categoryId === selectedCategoryId && p.catalogId === selectedCatalogId)
    : allProducts;

  const handleAddToCart = (product: Product, quantity: number = 1, variantId?: string, variantName?: string) => {
    let vid = variantId != null ? String(variantId).trim() : '';
    if (
      (!vid || vid === '0') &&
      Array.isArray(product.variants) &&
      product.variants.length === 1
    ) {
      const only = product.variants[0];
      if (only?.id != null && String(only.id).trim() !== '') {
        vid = String(only.id);
      }
    }
    const cartKey = regularCartLineKey(product, vid || undefined);
    const existing = cartItems.find((item) => regularCartLineKeyFromItem(item) === cartKey);
    const currentQty = existing ? existing.quantity : 0;
    const check = canAddQuantity(product, vid || variantId, currentQty, quantity);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }

    setCartItems((prev) => {
      const ex = prev.find((item) => regularCartLineKeyFromItem(item) === cartKey);

      if (ex) {
        return prev.map((item) =>
          regularCartLineKeyFromItem(item) === cartKey
            ? {
                ...item,
                quantity: item.quantity + quantity,
                cartLineKey: item.cartLineKey ?? cartKey,
              }
            : item,
        );
      }

      const line = buildCartLinePricing(product, vid || variantId, variantName);
      const selVid = vid || (variantId != null ? String(variantId).trim() : '');
      return [
        ...prev,
        {
          ...product,
          price: line.unitPrice,
          oldPrice: line.oldPrice ?? product.oldPrice,
          quantity,
          cartLineKey: cartKey,
          selectedVariantId: selVid || undefined,
          selectedVariantName: line.selectedVariantName ?? variantName,
          variantDetails: line.variantDetails,
        },
      ];
    });
  };

  /** Bir nechta variantni bitta setState bilan qo‘shish (ketma-ket chaqiriqlarda birlasib ketmasin) */
  const handleAddMarketVariantLines = (
    product: Product,
    lines: { variantId: string; variantName: string; quantity: number }[],
  ) => {
    const cleaned = lines.filter((l) => l.quantity > 0);
    if (cleaned.length === 0) return;

    setCartItems((prev) => {
      let next = [...prev];
      for (const { variantId: rawVid, variantName, quantity: qty } of cleaned) {
        let vid = String(rawVid ?? '').trim();
        if (
          (!vid || vid === '0') &&
          Array.isArray(product.variants) &&
          product.variants.length === 1
        ) {
          const only = product.variants[0];
          if (only?.id != null && String(only.id).trim() !== '') vid = String(only.id);
        }
        const cartKey = regularCartLineKey(product, vid || undefined);
        const ex = next.find((item) => regularCartLineKeyFromItem(item) === cartKey);
        const currentQty = ex ? ex.quantity : 0;
        const check = canAddQuantity(product, vid, currentQty, qty);
        if (!check.ok) {
          toast.error(check.message);
          continue;
        }
        if (ex) {
          next = next.map((item) =>
            regularCartLineKeyFromItem(item) === cartKey
              ? {
                  ...item,
                  quantity: item.quantity + qty,
                  cartLineKey: item.cartLineKey ?? cartKey,
                }
              : item,
          );
        } else {
          const line = buildCartLinePricing(product, vid, variantName);
          const selVid = vid || undefined;
          next.push({
            ...product,
            price: line.unitPrice,
            oldPrice: line.oldPrice ?? product.oldPrice,
            quantity: qty,
            cartLineKey: cartKey,
            selectedVariantId: selVid,
            selectedVariantName: line.selectedVariantName ?? variantName,
            variantDetails: line.variantDetails,
          });
        }
      }
      return next;
    });
  };

  const handleUpdateQuantity = (id: number, quantity: number, variantId?: string) => {
    devLog('🔄 handleUpdateQuantity called:', { id, quantity, variantId });
    devLog('📋 Current cart items:', cartItems);

    const vNorm = variantId != null ? String(variantId).trim() : '';
    const target = cartItems.find((item) =>
      vNorm
        ? item.id === id && String(item.selectedVariantId ?? '').trim() === vNorm
        : item.id === id && !String(item.selectedVariantId ?? '').trim(),
    );
    if (target && quantity > 0) {
      const check = canSetQuantity(target, quantity);
      if (!check.ok) {
        toast.error(check.message);
        return;
      }
    }

    setCartItems((prev) => {
      const vN = variantId != null ? String(variantId).trim() : '';
      const updated = prev.map(item => {
        const matches = vN
          ? item.id === id && String(item.selectedVariantId ?? '').trim() === vN
          : item.id === id && !String(item.selectedVariantId ?? '').trim();
        
        if (matches) {
          devLog('✅ Found matching item:', item, '-> new quantity:', quantity);
        }
        
        return matches ? { ...item, quantity } : item;
      });
      
      devLog('📦 Updated cart items:', updated);
      return updated;
    });
  };

  const handleRemoveItem = (id: number, variantId?: string) => {
    devLog('🗑️ handleRemoveItem called:', { id, variantId });
    devLog('📋 Current cart before remove:', cartItems);
    
    setCartItems(prev => {
      const vN = variantId != null ? String(variantId).trim() : '';
      const filtered = prev.filter(item => {
        const matches = vN
          ? item.id === id && String(item.selectedVariantId ?? '').trim() === vN
          : item.id === id && !String(item.selectedVariantId ?? '').trim();
        
        if (matches) {
          devLog('❌ Removing item:', item);
        }
        
        return !matches;
      });
      
      devLog('📦 Cart after remove:', filtered);
      return filtered;
    });
  };

  const handleCatalogSelect = (catalogId: string) => {
    replacePatch({
      [MAIN_APP_QUERY.cat]: catalogId,
      [MAIN_APP_QUERY.subcat]: null,
      [MAIN_APP_QUERY.view]: 'catalog',
    });
  };

  const handleCategorySelect = (categoryId: string) => {
    replacePatch({
      [MAIN_APP_QUERY.subcat]: categoryId,
      [MAIN_APP_QUERY.view]: 'products',
    });
  };

  const handleBackToCatalogs = () => {
    replacePatch({
      [MAIN_APP_QUERY.cat]: null,
      [MAIN_APP_QUERY.subcat]: null,
      [MAIN_APP_QUERY.view]: 'catalog',
    });
  };

  const handleMainViewChange = (view: 'products' | 'catalog') => {
    if (view === 'products') {
      replacePatch({
        [MAIN_APP_QUERY.view]: 'products',
        [MAIN_APP_QUERY.cat]: null,
        [MAIN_APP_QUERY.subcat]: null,
      });
    } else {
      replacePatch({
        [MAIN_APP_QUERY.view]: 'catalog',
        [MAIN_APP_QUERY.cat]: null,
        [MAIN_APP_QUERY.subcat]: null,
      });
    }
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
      pushPatch({ rterms: '1' });
      return;
    }

    if (!user) {
      toast.error('Avval tizimga kiring', {
        description: 'Buyurtma rasmiylashtirish uchun profilingizga kiring',
        duration: 4000,
      });
      pushPatch({ auth: '1', cart: null });
      return;
    }

    replacePatch({ cart: null, checkout: '1' });
  }, [user, cartItems, rentalLineItems, pushPatch, replacePatch]);

  const openProductDetail = useCallback(
    (product: Product) => {
      const key = String(product.productUuid ?? '').trim() || String(product.id);
      pushPatch({ product: key });
    },
    [pushPatch],
  );

  const closeAuthModal = useCallback(() => {
    if (searchParams.get(MAIN_APP_QUERY.auth) === '1') goBack();
    else setIsAuthOpen(false);
  }, [goBack, searchParams, setIsAuthOpen]);

  const isCommunityFullscreen = activeTab === 'community' && !isProfileOpen;
  
  const isDark = theme === 'dark';

  const marketProductsLoading =
    activeTab === 'market' &&
    activeView === 'products' &&
    !!selectedRegion &&
    !!selectedDistrict &&
    (isLoadingBranches || isLoadingProducts);

  /** Mobil (<sm): bitta ichki scroll — iOS/Android WebView da body scroll ishonchsiz bo‘lishi mumkin */
  const mainAppMobileScroll = !isCommunityFullscreen && !isProfileOpen;
  const appScrollShellClass = mainAppMobileScroll
    ? 'max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto max-sm:overflow-x-hidden max-sm:overscroll-y-contain max-sm:touch-pan-y max-sm:[-webkit-overflow-scrolling:touch] max-sm:pb-[max(6rem,calc(6rem+var(--app-safe-bottom)))] sm:contents'
    : isCommunityFullscreen
      ? 'h-full min-h-0 flex flex-col overflow-hidden'
      : 'contents';
  const appInnerColumnClass = isCommunityFullscreen ? 'h-full min-h-0' : 'mx-auto max-w-[1600px]';

  return (
    <CheckoutFlowProvider value={{ openCheckoutFlow }}>
    <div
      className={`${
        isCommunityFullscreen
          ? 'h-dvh min-h-dvh overflow-hidden'
          : isProfileOpen
            ? 'h-dvh min-h-dvh overflow-hidden'
            : [
                'min-h-dvh pb-24 sm:pb-32 max-[639px]:pb-[max(6rem,calc(6rem+var(--app-safe-bottom)))]',
                'max-sm:flex max-sm:flex-col max-sm:h-dvh max-sm:max-h-dvh max-sm:overflow-hidden max-sm:pb-0',
              ].join(' ')
      } bg-background text-foreground`}
    >
      {import.meta.env.DEV ? <TestBackend /> : null}
      <CommunityBackgroundNotifier activeTab={activeTab} />
      
      <div className={appScrollShellClass}>
      {/* Max-width container for desktop; mobil: scroll qobig‘i ichida */}
      <div className={appInnerColumnClass}>
        {!isCommunityFullscreen && (
          <Header
            cartCount={headerCartBadge}
            onCommunityClick={() => goTab('community')}
            onCartClick={() => pushPatch({ cart: '1' })}
            onProfileClick={() => {
              setProfileOrderCategoryPreset(undefined);
              pushPatch({ profile: '1' });
            }}
            menuCloseRef={menuCloseRef}
          />
        )}

        {activeTab === 'market' && !isProfileOpen && !isCommunityFullscreen && (
          <div className="px-4 sm:px-6 pt-1">
            <MarketOrdersPreview
              onViewAll={() => {
                setProfileOrderCategoryPreset('market');
                pushPatch({ profile: '1' });
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
            <ViewToggle activeView={activeView} onViewChange={handleMainViewChange} />

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
                          key={product.productUuid || product.id}
                          product={product}
                          onAddToCart={handleAddToCart}
                          onAddVariantLinesBatch={handleAddMarketVariantLines}
                          onProductClick={openProductDetail}
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

        {/* Profil Modal — yuqori qator scroll tashqarisida: kontent pt orqasiga chiqib ketmasin */}
        {isProfileOpen && (
          <div
            className={`fixed inset-0 z-[100] flex flex-col overflow-hidden overscroll-none ${isDark ? 'bg-black' : 'bg-background'}`}
            style={{
              paddingRight: 'var(--app-safe-right)',
              paddingBottom: 'var(--app-safe-bottom)',
              paddingLeft: 'var(--app-safe-left)',
            }}
          >
            <div
              className={`shrink-0 z-[110] flex items-center ${isDark ? 'bg-black' : 'bg-background'}`}
              style={{
                paddingTop: 'max(0.75rem, var(--app-safe-top))',
                paddingLeft: 'max(0.75rem, var(--app-safe-left))',
                paddingRight: 'max(0.75rem, var(--app-safe-right))',
                paddingBottom: '0.75rem',
                borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setProfileOrderCategoryPreset(undefined);
                  goBack();
                }}
                className="p-2.5 rounded-2xl transition-all active:scale-90"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.9))',
                  backdropFilter: 'blur(20px)',
                  boxShadow: isDark
                    ? '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                    : '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                  border: isDark ? '0.5px solid rgba(255, 255, 255, 0.2)' : '0.5px solid rgba(0, 0, 0, 0.1)',
                }}
                aria-label="Yopish"
              >
                <X className={`size-5 ${isDark ? 'text-white' : 'text-gray-900'}`} strokeWidth={2.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y min-w-0 [-webkit-overflow-scrolling:touch]">
              <ProfileView
                initialOrderCategory={profileOrderCategoryPreset}
                onOpenBonus={() => {
                  setProfileOrderCategoryPreset(undefined);
                  pushPatch({ tab: 'bonus', profile: null });
                }}
              />
            </div>
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
                pushPatch({ cart: '1' });
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
              
              devLog('💰 Price Calculation Debug:', {
                variantPrice,
                addonsTotalPrice,
                quantity,
                totalItemPrice,
                variant,
                additionalProducts
              });
              
              const restaurantName = dish.restaurantName || dish.restaurantId;

              const variantLabel =
                String(variant?.name ?? '').trim() ||
                `n${parseMoneyValue(variant.price)}_${String(variant?.prepTime ?? '').trim()}`;
              const addonRows = additionalProducts.map((addon: any) => ({
                name: addon.name,
                quantity: Number(addon.quantity) || 1,
              }));
              const lineId = stableFoodCartLineNumericId(String(dish.id), variantLabel, addonRows);

              const variantImg = String((variant as any)?.image ?? '').trim();
              const firstDishImg =
                Array.isArray(dish.images) && dish.images[0]
                  ? String(dish.images[0]).trim()
                  : '';
              const lineImage =
                variantImg ||
                firstDishImg ||
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';

              const vStock = (variant as any)?.stockQuantity ?? (variant as any)?.stockCount;
              const dStock = (dish as any)?.stockQuantity ?? (dish as any)?.stockCount;
              const dishIdStr = String(dish.id);
              const dishAsProduct = {
                id: lineId,
                dishId: dishIdStr,
                name: dish.name,
                price: totalItemPrice,
                image: lineImage,
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
                dishDetails: {
                  dishId: dishIdStr,
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
                  quantity: Number(addon.quantity) || 1,
                })),
              };

              handleAddToCart(dishAsProduct, quantity);
              
              // Open cart automatically
              setTimeout(() => {
                pushPatch({ cart: '1' });
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
          <Bonus onClose={() => goBack()} />
        )}

        {activeTab === 'community' && !isProfileOpen && (
          <CommunityView onBack={() => goBack()} />
        )}

        {/* Auction Tab - Full Screen */}
        {activeTab === 'auksion' && !isProfileOpen && (
          <AuctionView 
            onClose={() => goBack()}
            cartCount={cartItems.reduce((sum, item) => sum + item.quantity, 0)}
            onCartClick={() => pushPatch({ cart: '1' })}
            onProfileClick={() => {
              setProfileOrderCategoryPreset(undefined);
              pushPatch({ profile: '1' });
            }}
            activeTab={activeTab}
            onTabChange={goTab}
          />
        )}

        {/* Moshina Tab - Full Screen */}
        {activeTab === 'moshina' && !isProfileOpen && (
          <CarPage onClose={() => goBack()} />
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
          onClose={() => goBack()}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={() => setCartItems([])}
          onSuccessfulOrder={() => setRefreshKey((k) => k + 1)}
        />

        {/* Bottom Navigation - Always visible, responsive positioning */}
        {!isCommunityFullscreen && !isProfileOpen && (
          <BottomNav
            activeTab={activeTab}
            onTabChange={goTab}
            menuCloseRef={menuCloseRef}
          />
        )}

        <SupportChatWidget activeTab={activeTab} isProfileOpen={isProfileOpen} />

        {/* Product Detail Modal */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            isOpen={!!selectedProduct}
            onClose={() => goBack()}
            onAddToCart={(product, quantity, variantId, variantName) => {
              handleAddToCart(product, quantity, variantId, variantName);
              replacePatch({ product: null, cart: '1' });
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
          onClose={closeAuthModal}
          onSuccess={(user, session) => {
            smsSignin(user, session);
          }}
        />

        {!isCommunityFullscreen && !isProfileOpen && (
          <div className="hidden md:block">
            <SiteFooter onNavigateTab={goTab} />
          </div>
        )}
      </div>
      </div>

      <RentalTermsConsentModal
        open={flowRentalTermsOpen}
        onClose={() => goBack()}
        onConfirm={async () => {
          if (!isAuthenticated || !accessToken) {
            toast.error('Buyurtma uchun avval tizimga kiring');
            pushPatch({ auth: '1' });
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

          replacePatch({ rterms: null, cart: null, checkout: '1' });
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
          onClose={() => goBack()}
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