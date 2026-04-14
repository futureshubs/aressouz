import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { Store, MapPin, Clock, Phone, Package, Truck, ShoppingCart, Star, Heart, X, ChevronRight, Filter, Trash2, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { buildAdminHeaders, getStoredAdminSessionToken } from '../utils/requestAuth';
import { toast } from 'sonner';
import { regions } from '../data/regions';
import { ProductDetailModal } from './ProductModals';
import { ProductVariantModal } from './ProductVariantModal';
import { BannerCarousel } from './BannerCarousel';
import { matchesSelectedLocation } from '../utils/locationMatching';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { getEffectiveProductStockQuantity } from '../utils/cartStock';
import { ProductGridSkeleton, ShopListSkeleton } from './skeletons';
import { useHeaderSearchOptional } from '../context/HeaderSearchContext';
import { matchesHeaderSearch, normalizeHeaderSearch } from '../utils/headerSearchMatch';

/** API: `GET /shops` — `rating`, `reviewCount` (barcha mahsulot sharhlari yig‘indisi) */
function shopRatingFromApi(shop: { rating?: unknown; reviewCount?: unknown } | null | undefined): {
  rating: number;
  reviewCount: number;
} {
  if (!shop) return { rating: 0, reviewCount: 0 };
  const r = Number(shop.rating);
  const c = Math.max(0, Math.floor(Number(shop.reviewCount) || 0));
  const rating = Number.isFinite(r) && r > 0 ? Math.min(5, Math.round(r * 10) / 10) : 0;
  return { rating, reviewCount: c };
}

/** Modal: ro‘yxatdagi shop bo‘sh bo‘lsa, yuklangan mahsulotlardan yig‘ma */
function shopRatingFromProducts(products: Array<{ rating?: unknown; reviewCount?: unknown }>): {
  rating: number;
  reviewCount: number;
} {
  let tw = 0;
  let tc = 0;
  for (const p of products) {
    const c = Math.max(0, Math.floor(Number(p.reviewCount) || 0));
    const r = Number(p.rating) || 0;
    if (c > 0 && r > 0) {
      tw += r * c;
      tc += c;
    }
  }
  if (tc === 0) return { rating: 0, reviewCount: 0 };
  return { rating: Math.min(5, Math.round((tw / tc) * 10) / 10), reviewCount: tc };
}

export default function OnlineShops({
  onAddToCart,
  initialTab = 'shops',
  catalogRefreshKey = 0,
}: {
  onAddToCart?: (product: any, quantity: number, variantId?: string, variantName?: string) => void;
  initialTab?: 'products' | 'shops';
  /** Buyurtmadan keyin mahsulot zaxirasini qayta yuklash */
  catalogRefreshKey?: number;
}) {
  const { theme, accentColor } = useTheme();
  const { selectedRegion, selectedDistrict, setLocation } = useLocation();
  const { query: headerSearch } = useHeaderSearchOptional();
  const isDark = theme === 'dark';

  const [shops, setShops] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'shops'>(initialTab);
  
  // Products state
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Variant selection menu state
  const [variantMenuProduct, setVariantMenuProduct] = useState<any>(null);
  
  // Local state for filter dropdowns
  const [filterRegion, setFilterRegion] = useState(selectedRegion);
  const [filterDistrict, setFilterDistrict] = useState(selectedDistrict);

  // 🔐 Delete functionality states
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pressingProductId, setPressingProductId] = useState<string | null>(null);

  // 🔐 Delete functionality states for shops
  const [pressShopTimer, setPressShopTimer] = useState<NodeJS.Timeout | null>(null);
  const [deleteShop, setDeleteShop] = useState<any>(null);
  const [showDeleteShopModal, setShowDeleteShopModal] = useState(false);
  const [pressingShopId, setPressingShopId] = useState<string | null>(null);
  const [deleteProductBusy, setDeleteProductBusy] = useState(false);
  const [deleteShopBusy, setDeleteShopBusy] = useState(false);

  // Convert region ID to name for banners
  const selectedRegionData = regions.find(r => r.id === selectedRegion);
  const selectedRegionName = selectedRegionData?.name || '';
  const selectedDistrictData = selectedRegionData?.districts.find(d => d.id === selectedDistrict);
  const selectedDistrictName = selectedDistrictData?.name || '';

  useEffect(() => {
    loadShops();
    loadAllProducts();
  }, [selectedRegion, selectedDistrict, catalogRefreshKey]);

  // Sync with LocationContext
  useEffect(() => {
    setFilterRegion(selectedRegion);
    setFilterDistrict(selectedDistrict);
  }, [selectedRegion, selectedDistrict]);

  // Reset to initialTab when initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadShops = async () => {
    setIsLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (selectedRegion) params.append('region', selectedRegion);
      if (selectedDistrict) params.append('district', selectedDistrict);
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        setShops(data.shops || []);
      } else {
        console.error('❌ Shops response not OK:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading shops:', error);
      toast.error('Do\'konlar yuklanmadi');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllProducts = async () => {
    setIsLoadingProducts(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (selectedRegion) params.append('region', selectedRegion);
      if (selectedDistrict) params.append('district', selectedDistrict);
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/products${params.toString() ? `?${params.toString()}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        const raw = data.products || [];
        setAllProducts(
          raw.map((p: any) => ({
            ...p,
            stockQuantity: getEffectiveProductStockQuantity(p),
          })),
        );
      } else {
        console.error('❌ Products response not OK:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading products:', error);
      toast.error('Mahsulotlar yuklanmadi');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useVisibilityRefetch(() => {
    void loadShops();
    void loadAllProducts();
  });

  // Handle filter change
  const handleRegionChange = (regionId: string) => {
    setFilterRegion(regionId);
    setFilterDistrict('');
    setLocation(regionId, '');
  };

  const handleDistrictChange = (districtId: string) => {
    setFilterDistrict(districtId);
    setLocation(filterRegion, districtId);
  };

  const locationSelection = {
    selectedRegionId: selectedRegion,
    selectedDistrictId: selectedDistrict,
  };

  const filteredShops = shops.filter(shop =>
    matchesSelectedLocation(shop, locationSelection)
  );

  const filteredShopIds = new Set(filteredShops.map(shop => shop.id));
  const filteredProducts = allProducts.filter(product =>
    filteredShopIds.has(product.shopId) ||
    matchesSelectedLocation(product, locationSelection)
  );

  const shopNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shops) {
      if (s?.id != null) m.set(String(s.id), String(s.name ?? s.shopName ?? ''));
    }
    return m;
  }, [shops]);

  const searchFilteredShops = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return filteredShops;
    return filteredShops.filter((s: Record<string, unknown>) =>
      matchesHeaderSearch(headerSearch, [
        s.name,
        s.shopName,
        s.description,
        s.address,
        s.region,
        s.district,
        s.phone,
      ]),
    );
  }, [filteredShops, headerSearch]);

  const searchFilteredProducts = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return filteredProducts;
    return filteredProducts.filter((p: Record<string, unknown>) => {
      const sid = p.shopId != null ? String(p.shopId) : '';
      const shopName = sid ? shopNameById.get(sid) : '';
      return matchesHeaderSearch(headerSearch, [
        p.name,
        p.description,
        p.sku,
        p.barcode,
        shopName,
        ...(Array.isArray(p.variants)
          ? (p.variants as { name?: string }[]).flatMap((v) => [v.name])
          : []),
      ]);
    });
  }, [filteredProducts, headerSearch, shopNameById]);

  useEffect(() => {
    if (selectedShop && !filteredShopIds.has(selectedShop.id)) {
      setSelectedShop(null);
    }
  }, [selectedShop, filteredShopIds]);

  // Get product count for a shop
  const getShopProductCount = (shopId: string) => {
    return searchFilteredProducts.filter((product) => product.shopId === shopId).length;
  };

  // Get region and district names for display
  const getLocationName = (regionId: string, districtId?: string) => {
    const region = regions.find(r => r.id === regionId);
    if (!region) return regionId;
    
    if (districtId) {
      const district = region.districts.find(d => d.id === districtId);
      return district ? `${region.name}, ${district.name}` : region.name;
    }
    
    return region.name;
  };

  // Handle variant menu open - fetch full product with variants
  const handleOpenVariantMenu = async (product: any) => {
    // If product already has variants, use it directly
    if (product.variants && product.variants.length > 0) {
      setVariantMenuProduct(product);
      return;
    }

    // If no variants, create a default variant from the main product data
    const productWithDefaultVariant = {
      ...product,
      variants: [{
        id: 'default',
        name: 'Standart',
        price: product.price,
        oldPrice: product.oldPrice,
        images: product.image ? [product.image] : [],
        stock: product.stockQuantity || 0
      }]
    };
    
    setVariantMenuProduct(productWithDefaultVariant);
  };

  // 🔐 Long press handlers for delete functionality
  const handlePressStart = (product: any) => {
    setPressingProductId(product.id);
    const timer = setTimeout(() => {
      setDeleteProduct(product);
      setShowDeleteModal(true);
      setPressingProductId(null);
    }, 3000); // 3 seconds
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    setPressingProductId(null);
  };

  // 🔐 Delete product function
  const handleDeleteProduct = async () => {
    if (!getStoredAdminSessionToken()) {
      toast.error('Admin panelda tizimga kiring (sessiya kerak).');
      return;
    }

    setDeleteProductBusy(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/products/${deleteProduct.id}`,
        {
          method: 'DELETE',
          headers: buildAdminHeaders(),
        }
      );

      if (response.ok) {
        toast.success('Mahsulot o\'chirildi');
        setAllProducts(prev => prev.filter(p => p.id !== deleteProduct.id));
        setShowDeleteModal(false);
        setDeleteProduct(null);
      } else {
        toast.error('Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setDeleteProductBusy(false);
    }
  };

  // 🔐 Long press handlers for shop delete functionality
  const handleShopPressStart = (shop: any) => {
    setPressingShopId(shop.id);
    const timer = setTimeout(() => {
      setDeleteShop(shop);
      setShowDeleteShopModal(true);
      setPressingShopId(null);
    }, 3000); // 3 seconds
    setPressShopTimer(timer);
  };

  const handleShopPressEnd = () => {
    if (pressShopTimer) {
      clearTimeout(pressShopTimer);
      setPressShopTimer(null);
    }
    setPressingShopId(null);
  };

  // 🔐 Delete shop function
  const handleDeleteShop = async () => {
    if (!getStoredAdminSessionToken()) {
      toast.error('Admin panelda tizimga kiring (sessiya kerak).');
      return;
    }

    setDeleteShopBusy(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops/${deleteShop.id}`,
        {
          method: 'DELETE',
          headers: buildAdminHeaders(),
        }
      );

      if (response.ok) {
        toast.success('Do\'kon o\'chirildi');
        setShops(prev => prev.filter(s => s.id !== deleteShop.id));
        setShowDeleteShopModal(false);
        setDeleteShop(null);
      } else {
        toast.error('Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Delete shop error:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setDeleteShopBusy(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: isDark ? '#0a0a0a' : '#f5f5f5' }}>
      {/* Shop Banners - Only show if location selected */}
      {selectedRegionName && selectedDistrictName && (
        <div className="px-4 pt-4 pb-2">
          <BannerCarousel 
            category="shop" 
            region={selectedRegionName} 
            district={selectedDistrictName}
          />
        </div>
      )}

      {/* Tab Buttons */}
      <div className="px-4 py-4">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('products')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all"
            style={{
              background: activeTab === 'products' ? accentColor.color : isDark ? '#1a1a1a' : '#ffffff',
              color: activeTab === 'products' ? '#ffffff' : isDark ? '#ffffff' : '#000000',
            }}
          >
            <ShoppingCart className="w-5 h-5" />
            E'lonlar
          </button>
          <button
            onClick={() => setActiveTab('shops')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all"
            style={{
              background: activeTab === 'shops' ? accentColor.color : isDark ? '#1a1a1a' : '#ffffff',
              color: activeTab === 'shops' ? '#ffffff' : isDark ? '#ffffff' : '#000000',
            }}
          >
            <Store className="w-5 h-5" />
            Do'konlar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-24">
        {activeTab === 'shops' ? (
          /* Shops Tab */
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Mahalliy do'konlar</h2>
                {selectedRegion && (
                  <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    {getLocationName(selectedRegion, selectedDistrict)}
                  </p>
                )}
              </div>
              <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                {searchFilteredShops.length} ta
              </span>
            </div>

            {isLoading ? (
              <ShopListSkeleton isDark={isDark} rows={6} />
            ) : searchFilteredShops.length === 0 ? (
              <div 
                className="p-12 rounded-3xl text-center"
                style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
              >
                <Store className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                <h3 className="text-lg font-bold mb-2">Do'konlar yo'q</h3>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {selectedRegion 
                    ? `${getLocationName(selectedRegion, selectedDistrict)} hududida do'konlar topilmadi`
                    : 'Hozircha do\'konlar qo\'shilmagan'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchFilteredShops.map((shop: any) => (
                  <div
                    key={shop.id}
                    onClick={() => setSelectedShop(shop)}
                    onMouseDown={() => handleShopPressStart(shop)}
                    onMouseUp={handleShopPressEnd}
                    onMouseLeave={handleShopPressEnd}
                    onTouchStart={() => handleShopPressStart(shop)}
                    onTouchEnd={handleShopPressEnd}
                    onTouchCancel={handleShopPressEnd}
                    className="rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer transition-all active:scale-98 sm:hover:scale-[1.02]"
                    style={{
                      background: isDark ? '#1a1a1a' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      boxShadow: pressingShopId === shop.id 
                        ? `0 0 0 3px ${accentColor.color}40`
                        : isDark 
                          ? '0 6px 24px rgba(0, 0, 0, 0.25)' 
                          : '0 6px 24px rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    <div className="flex gap-3.5 p-3.5 sm:p-5">
                      {/* Shop Logo */}
                      <div 
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden relative group"
                        style={{ 
                          background: `linear-gradient(135deg, ${accentColor.color}30, ${accentColor.color}10)`,
                          border: `2px solid ${accentColor.color}20`
                        }}
                      >
                        {shop.logo ? (
                          <img 
                            src={shop.logo} 
                            alt={shop.name} 
                            className="w-full h-full object-cover transition-transform sm:group-hover:scale-110" 
                          />
                        ) : (
                          <Store className="w-9 h-9 sm:w-11 sm:h-11 transition-transform sm:group-hover:scale-110" style={{ color: accentColor.color }} />
                        )}
                        
                        {/* Rating Badge on Logo — API dan haqiqiy */}
                        <div 
                          className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md backdrop-blur-md flex items-center gap-0.5"
                          style={{ background: 'rgba(0, 0, 0, 0.6)' }}
                        >
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-white text-xs font-bold">
                            {(() => {
                              const { rating, reviewCount } = shopRatingFromApi(shop);
                              return reviewCount > 0 ? rating.toFixed(1) : '—';
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Shop Info */}
                      <div className="flex-1 min-w-0">
                        {/* Name & Product Count */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <h3 className="font-bold text-lg sm:text-xl flex-1 line-clamp-1">{shop.name}</h3>
                          <div 
                            className="px-2.5 py-1 rounded-lg text-xs sm:text-xs font-bold whitespace-nowrap"
                            style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                          >
                            {getShopProductCount(shop.id)}
                          </div>
                        </div>

                        {/* Info List - Compact */}
                        <div className="space-y-2">
                          {/* Working Hours */}
                          {shop.workingHours && (
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 flex-shrink-0" style={{ color: accentColor.color }} />
                              <span className="line-clamp-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                                {shop.workingHours}
                              </span>
                            </div>
                          )}

                          {/* Address */}
                          {shop.address && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: accentColor.color }} />
                              <span 
                                className="line-clamp-1"
                                style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                              >
                                {shop.address}
                              </span>
                            </div>
                          )}

                          {/* Delivery Time */}
                          {shop.delivery && (
                            <div className="flex items-center gap-2 text-sm">
                              <Truck className="w-4 h-4 flex-shrink-0" style={{ color: accentColor.color }} />
                              <span className="line-clamp-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                                {shop.deliveryTime === '60' ? '1 soat' : `${shop.deliveryTime || '30'} daq`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight 
                        className="w-5 h-5 flex-shrink-0 self-center" 
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Products Tab */
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Barcha mahsulotlar</h2>
              <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                {searchFilteredProducts.length} ta
              </span>
            </div>

            {isLoadingProducts ? (
              <ProductGridSkeleton
                isDark={isDark}
                count={10}
                gridClassName="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6"
              />
            ) : searchFilteredProducts.length === 0 ? (
              <div 
                className="p-12 rounded-3xl text-center"
                style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
              >
                <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                <h3 className="text-lg font-bold mb-2">Mahsulotlar yo'q</h3>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Tanlangan hudud uchun mahsulotlar topilmadi
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
                {searchFilteredProducts.map((product: any) => (
                  <div
                    key={product.id}
                    className="rounded-xl md:rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95 group cursor-pointer relative"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                      boxShadow: pressingProductId === product.id 
                        ? `0 0 0 3px ${accentColor.color}40` 
                        : '0 2px 8px rgba(0, 0, 0, 0.04)',
                    }}
                    onClick={() => setSelectedProduct(product)}
                    onMouseDown={() => handlePressStart(product)}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={() => handlePressStart(product)}
                    onTouchEnd={handlePressEnd}
                    onTouchCancel={handlePressEnd}
                  >
                    {/* Image Container with Badges */}
                    <div className="relative">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-32 sm:h-40 md:h-48 object-cover"
                        />
                      ) : (
                        <div 
                          className="w-full h-32 sm:h-40 md:h-48 flex items-center justify-center"
                          style={{ 
                            background: `linear-gradient(135deg, ${accentColor.color}20, ${accentColor.color}10)`,
                          }}
                        >
                          <Package className="w-12 h-12 sm:w-16 sm:h-16" style={{ color: accentColor.color, opacity: 0.3 }} />
                        </div>
                      )}
                      
                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {/* Source Badge (Market or Shop) - Hidden */}
                        {/* <div 
                          className="px-2 py-1 rounded-lg text-xs font-bold backdrop-blur-md"
                          style={{ 
                            background: product.source === 'market' ? 'rgba(59, 130, 246, 0.9)' : 'rgba(168, 85, 247, 0.9)', 
                            color: '#ffffff' 
                          }}
                        >
                          {product.source === 'market' ? '🏬 Market' : '🏪 Do\'kon'}
                        </div> */}
                        
                        {product.oldPrice && product.oldPrice > product.price && (
                          <div 
                            className="px-2 py-1 rounded-lg text-xs font-bold"
                            style={{ background: '#ef4444', color: '#ffffff' }}
                          >
                            -{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
                          </div>
                        )}
                        {product.isNew && (
                          <div 
                            className="px-2 py-1 rounded-lg text-xs font-bold"
                            style={{ background: '#10b981', color: '#ffffff' }}
                          >
                            Yangi
                          </div>
                        )}
                        {product.isBestseller && (
                          <div 
                            className="px-2 py-1 rounded-lg text-xs font-bold"
                            style={{ background: '#f59e0b', color: '#ffffff' }}
                          >
                            TOP
                          </div>
                        )}
                      </div>

                      {/* Stock Badge */}
                      {product.stockQuantity !== undefined && (
                        <div 
                          className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-md"
                          style={{ 
                            background: product.stockQuantity > 10 
                              ? 'rgba(16, 185, 129, 0.9)' 
                              : product.stockQuantity > 0 
                                ? 'rgba(245, 158, 11, 0.9)' 
                                : 'rgba(239, 68, 68, 0.9)',
                            color: '#ffffff'
                          }}
                        >
                          {product.stockQuantity > 0 ? `${product.stockQuantity} ta` : 'Tugadi'}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-2.5 sm:p-3 md:p-4">
                      {/* Category/Shop Name */}
                      {(product.category || product.shopName) && (
                        <p 
                          className="text-xs mb-1 line-clamp-1"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                        >
                          {product.shopName || product.category}
                        </p>
                      )}

                      {/* Product Name */}
                      <h4 
                        className="font-bold text-sm sm:text-base md:text-lg mb-1 md:mb-2 line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        {product.name}
                      </h4>

                      {/* Bo'lib to'lash */}
                      <div 
                        className="px-2 py-1.5 rounded-lg mb-2"
                        style={{ background: `${accentColor.color}15` }}
                      >
                        <p 
                          className="text-xs font-medium text-center"
                          style={{ color: accentColor.color }}
                        >
                          {Math.ceil(product.price / 12).toLocaleString()} so'm × 12 oy
                        </p>
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-1 mb-2">
                        {product.rating && product.rating > 0 ? (
                          <>
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <svg
                                  key={i}
                                  className="w-3 h-3 sm:w-4 sm:h-4"
                                  fill={i < Math.floor(product.rating) ? '#fbbf24' : 'none'}
                                  stroke="#fbbf24"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              ))}
                            </div>
                            <span 
                              className="text-xs font-medium"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                            >
                              {product.rating.toFixed(1)}
                            </span>
                            {product.reviewCount && product.reviewCount > 0 && (
                              <span 
                                className="text-xs"
                                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                              >
                                ({product.reviewCount})
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            <span 
                              className="text-xs font-medium"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                            >
                              Hali baholanmagan
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Variants Count */}
                      {product.variantsCount && product.variantsCount > 1 && (
                        <div 
                          className="text-xs mb-2 px-2 py-1 rounded-lg inline-block"
                          style={{ 
                            background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                            color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                            display: 'none'
                          }}
                        >
                          {product.variantsCount} xil variant
                        </div>
                      )}

                      {/* Price Section */}
                      <div className="mb-3">
                        <div className="flex items-baseline gap-2">
                          <p 
                            className="text-base sm:text-lg md:text-xl font-bold"
                            style={{ color: accentColor.color }}
                          >
                            {product.price?.toLocaleString()} so'm
                          </p>
                        </div>
                        {product.oldPrice && product.oldPrice > product.price && (
                          <p 
                            className="text-xs sm:text-sm line-through"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                          >
                            {product.oldPrice.toLocaleString()} so'm
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (product.stockQuantity > 0) {
                            handleOpenVariantMenu(product);
                          }
                        }}
                        className="w-full py-2 md:py-3 rounded-lg md:rounded-xl text-xs sm:text-sm md:text-base font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
                        style={{ 
                          background: product.stockQuantity > 0 ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          color: product.stockQuantity > 0 ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                          cursor: product.stockQuantity > 0 ? 'pointer' : 'not-allowed'
                        }}
                        disabled={product.stockQuantity === 0}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        {product.stockQuantity > 0 ? 'Savatga' : 'Tugagan'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Shop Detail Modal */}
      {selectedShop && (
        <ShopDetailModal
          shop={selectedShop}
          onClose={() => setSelectedShop(null)}
          onAddToCart={onAddToCart}
        />
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(product, quantity, variantId, variantName) => {
            onAddToCart?.(product, quantity, variantId, variantName);
            setSelectedProduct(null);
          }}
          source="shop"
        />
      )}

      {/* Variant Selection Modal */}
      {variantMenuProduct && (
        <ProductVariantModal
          product={variantMenuProduct}
          onClose={() => setVariantMenuProduct(null)}
          onAddToCart={(product, quantity, variantId, variantName) => {
            onAddToCart?.(product, quantity, variantId, variantName);
            setVariantMenuProduct(null);
          }}
          source="shop"
        />
      )}

      {/* 🔐 Delete Confirmation Modal */}
      {showDeleteModal && deleteProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)' }}
        >
          <div 
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
            style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
          >
            {/* Icon */}
            <div 
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: '#ef444420' }}
            >
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-center mb-2">
              Mahsulotni o'chirish
            </h3>

            {/* Product Name */}
            <p 
              className="text-center mb-4"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              <span className="font-medium">{deleteProduct.name}</span> ni o'chirmoqchimisiz?
            </p>

            <p
              className="text-center text-sm mb-6"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}
            >
              Admin panel sessiyasi bilan tasdiqlanadi. Avval /admin orqali kiring.
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteProduct(null);
                }}
                disabled={deleteProductBusy}
                className="flex-1 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              >
                Bekor qilish
              </button>
              <button
                onClick={() => void handleDeleteProduct()}
                disabled={deleteProductBusy}
                className="flex-1 py-3 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                }}
              >
                {deleteProductBusy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔐 Delete Shop Confirmation Modal */}
      {showDeleteShopModal && deleteShop && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)' }}
        >
          <div 
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
            style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
          >
            {/* Icon */}
            <div 
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: '#ef444420' }}
            >
              <Store className="w-8 h-8 text-red-500" />
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-center mb-2">
              Do'konni o'chirish
            </h3>

            {/* Shop Name */}
            <p 
              className="text-center mb-4"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              <span className="font-medium">{deleteShop.name}</span> do'konini o'chirmoqchimisiz?
            </p>

            <p
              className="text-center text-sm mb-6"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}
            >
              Admin panel sessiyasi bilan tasdiqlanadi. Avval /admin orqali kiring.
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteShopModal(false);
                  setDeleteShop(null);
                }}
                disabled={deleteShopBusy}
                className="flex-1 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              >
                Bekor qilish
              </button>
              <button
                onClick={() => void handleDeleteShop()}
                disabled={deleteShopBusy}
                className="flex-1 py-3 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                }}
              >
                {deleteShopBusy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Store className="w-5 h-5" />
                )}
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Shop Detail Modal
function ShopDetailModal({
  shop,
  onClose,
  onAddToCart,
}: {
  shop: any;
  onClose: () => void;
  onAddToCart?: (product: any, quantity: number, variantId?: string, variantName?: string) => void;
}) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'info'>('products');
  
  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Variant selection menu state
  const [variantMenuProduct, setVariantMenuProduct] = useState<any>(null);

  const loadProducts = useCallback(async () => {
    const sid = shop?.id;
    if (!sid) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops/${encodeURIComponent(sid)}/products`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [shop?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const modalShopRating = useMemo(() => {
    const fromApi = shopRatingFromApi(shop);
    if (fromApi.reviewCount > 0 && fromApi.rating > 0) return fromApi;
    return shopRatingFromProducts(products);
  }, [shop, products]);

  // Get region and district names for display
  const getLocationName = (regionId: string, districtId?: string) => {
    const region = regions.find(r => r.id === regionId);
    if (!region) return regionId;
    
    if (districtId) {
      const district = region.districts.find(d => d.id === districtId);
      return district ? `${region.name}, ${district.name}` : region.name;
    }
    
    return region.name;
  };

  const handleOpenVariantMenu = async (product: any) => {
    if (product.variants && product.variants.length > 0) {
      setVariantMenuProduct(product);
      return;
    }
    const productWithDefaultVariant = {
      ...product,
      variants: [
        {
          id: 'default',
          name: 'Standart',
          price: product.price,
          oldPrice: product.oldPrice,
          images: product.image ? [product.image] : [],
          stock: product.stockQuantity || 0,
        },
      ],
    };
    setVariantMenuProduct(productWithDefaultVariant);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col min-h-0 h-dvh max-h-dvh overflow-hidden"
      style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y pb-6 [-webkit-overflow-scrolling:touch]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="fixed top-3 right-3 md:top-4 md:right-4 z-10 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-lg"
          style={{ 
            background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <X className="w-4 h-4 md:w-5 md:h-5" />
        </button>

        {/* Header with Banner/Logo - Responsive Heights */}
        {shop.banner ? (
          <div className="relative">
            <img 
              src={shop.banner} 
              alt={shop.name}
              className="w-full h-48 sm:h-56 md:h-64 lg:h-80 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {shop.logo && (
              <div 
                className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 md:bottom-6 md:left-6 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl md:rounded-3xl border-2 md:border-4 overflow-hidden"
                style={{ borderColor: isDark ? '#0a0a0a' : '#ffffff' }}
              >
                <img 
                  src={shop.logo} 
                  alt={shop.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        ) : shop.logo ? (
          <img 
            src={shop.logo} 
            alt={shop.name}
            className="w-full h-48 sm:h-56 md:h-64 lg:h-80 object-cover"
          />
        ) : (
          <div 
            className="w-full h-48 sm:h-56 md:h-64 lg:h-80 flex items-center justify-center"
            style={{ background: `${accentColor.color}20` }}
          >
            <Store className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32" style={{ color: accentColor.color }} />
          </div>
        )}

        {/* Content - Responsive Padding */}
        <div className="px-4 sm:px-5 md:px-6 py-4 md:py-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 md:mb-3">{shop.name}</h2>
          
          {/* Rating & Status - Responsive (KV sharhlardan) */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-3 md:mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Star className="w-4 h-4 md:w-5 md:h-5 fill-yellow-500 text-yellow-500" />
              {modalShopRating.reviewCount > 0 ? (
                <>
                  <span className="text-base md:text-lg font-medium">{modalShopRating.rating.toFixed(1)}</span>
                  <span
                    className="text-sm md:text-base"
                    style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}
                  >
                    ({modalShopRating.reviewCount})
                  </span>
                </>
              ) : (
                <span
                  className="text-sm md:text-base font-medium"
                  style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}
                >
                  Hali baholanmagan
                </span>
              )}
            </div>
            <div 
              className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium"
              style={{ background: '#10b981', color: '#ffffff' }}
            >
              Ochiq
            </div>
          </div>

          {shop.description && (
            <p 
              className="mb-4 md:mb-6 text-base md:text-lg leading-relaxed"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {shop.description}
            </p>
          )}

          {/* Tab Buttons - Responsive */}
          <div 
            className="inline-flex gap-1.5 md:gap-2 p-1.5 md:p-2 rounded-xl md:rounded-2xl mb-4 md:mb-6 w-full sm:w-auto"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
          >
            <button
              onClick={() => setActiveTab('products')}
              className="flex-1 sm:flex-none px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 rounded-lg md:rounded-xl text-sm md:text-base font-medium transition-all flex items-center justify-center gap-2"
              style={{
                background: activeTab === 'products' ? accentColor.color : 'transparent',
                color: activeTab === 'products' ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
              }}
            >
              <Package className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden xs:inline">Mahsulotlar</span>
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className="flex-1 sm:flex-none px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 rounded-lg md:rounded-xl text-sm md:text-base font-medium transition-all flex items-center justify-center gap-2"
              style={{
                background: activeTab === 'info' ? accentColor.color : 'transparent',
                color: activeTab === 'info' ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
              }}
            >
              <Store className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden xs:inline">Ma'lumotlar</span>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'products' ? (
            /* Products Tab */
            <div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 md:mb-6">Mahsulotlar</h3>
              
              {isLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 py-2 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)' }}>
                    <Loader2 className="w-5 h-5 shrink-0 animate-spin" style={{ color: accentColor.color }} />
                    Mahsulotlar yuklanmoqda…
                  </div>
                  <ProductGridSkeleton
                    isDark={isDark}
                    count={8}
                    gridClassName="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6"
                  />
                </div>
              ) : products.length === 0 ? (
                <div 
                  className="p-8 md:p-12 rounded-2xl text-center"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                >
                  <Package className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                  <p className="text-base md:text-lg" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Hozircha mahsulotlar yo'q
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
                  {products.map((product: any) => {
                    return (
                    <div
                      key={product.id}
                      className="rounded-xl md:rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95 group cursor-pointer"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                      }}
                      onClick={() => setSelectedProduct(product)}
                    >
                      {/* Image Container with Badges */}
                      <div className="relative">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-32 sm:h-40 md:h-48 object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div 
                            className="w-full h-32 sm:h-40 md:h-48 flex items-center justify-center"
                            style={{ 
                              background: `linear-gradient(135deg, ${accentColor.color}20, ${accentColor.color}10)`,
                            }}
                          >
                            <Package className="w-12 h-12 sm:w-16 sm:h-16" style={{ color: accentColor.color, opacity: 0.3 }} />
                          </div>
                        )}
                        
                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {/* Source Badge (Market or Shop) - Hidden */}
                          {/* <div 
                            className="px-2 py-1 rounded-lg text-xs font-bold backdrop-blur-md"
                            style={{ 
                              background: product.source === 'market' ? 'rgba(59, 130, 246, 0.9)' : 'rgba(168, 85, 247, 0.9)', 
                              color: '#ffffff' 
                            }}
                          >
                            {product.source === 'market' ? '🏬 Market' : '🏪 Do\'kon'}
                          </div> */}
                          
                          {product.oldPrice && product.oldPrice > product.price && (
                            <div 
                              className="px-2 py-1 rounded-lg text-xs font-bold"
                              style={{ background: '#ef4444', color: '#ffffff' }}
                            >
                              -{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
                            </div>
                          )}
                          {product.isNew && (
                            <div 
                              className="px-2 py-1 rounded-lg text-xs font-bold"
                              style={{ background: '#10b981', color: '#ffffff' }}
                            >
                              Yangi
                            </div>
                          )}
                          {product.isBestseller && (
                            <div 
                              className="px-2 py-1 rounded-lg text-xs font-bold"
                              style={{ background: '#f59e0b', color: '#ffffff' }}
                            >
                              TOP
                            </div>
                          )}
                        </div>

                        {/* Stock Badge */}
                        {product.stockQuantity !== undefined && (
                          <div 
                            className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-md"
                            style={{ 
                              background: product.stockQuantity > 10 
                                ? 'rgba(16, 185, 129, 0.9)' 
                                : product.stockQuantity > 0 
                                  ? 'rgba(245, 158, 11, 0.9)' 
                                  : 'rgba(239, 68, 68, 0.9)',
                              color: '#ffffff'
                            }}
                          >
                            {product.stockQuantity > 0 ? `${product.stockQuantity} ta` : 'Tugadi'}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-2.5 sm:p-3 md:p-4">
                        {/* Category/Shop Name */}
                        {(product.category || product.shopName) && (
                          <p 
                            className="text-xs mb-1 line-clamp-1"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                          >
                            {product.shopName || product.category}
                          </p>
                        )}

                        {/* Product Name */}
                        <h4 
                          className="font-bold text-sm sm:text-base md:text-lg mb-1 md:mb-2 line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]"
                          style={{ color: isDark ? '#ffffff' : '#111827' }}
                        >
                          {product.name}
                        </h4>

                        {/* Bo'lib to'lash */}
                        <div 
                          className="px-2 py-1.5 rounded-lg mb-2"
                          style={{ background: `${accentColor.color}15` }}
                        >
                          <p 
                            className="text-xs font-medium text-center"
                            style={{ color: accentColor.color }}
                          >
                            {Math.ceil(product.price / 12).toLocaleString()} so'm × 12 oy
                          </p>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-1 mb-2">
                          {product.rating && product.rating > 0 ? (
                            <>
                              <div className="flex items-center gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className="w-3 h-3 sm:w-4 sm:h-4"
                                    fill={i < Math.floor(product.rating) ? '#fbbf24' : 'none'}
                                    stroke="#fbbf24"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                ))}
                              </div>
                              <span 
                                className="text-xs font-medium"
                                style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                              >
                                {product.rating.toFixed(1)}
                              </span>
                              {product.reviewCount && product.reviewCount > 0 && (
                                <span 
                                  className="text-xs"
                                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                                >
                                  ({product.reviewCount})
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              <span 
                                className="text-xs font-medium"
                                style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                              >
                                Hali baholanmagan
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Variants Count */}
                        {product.variantsCount && product.variantsCount > 1 && (
                          <div 
                            className="text-xs mb-2 px-2 py-1 rounded-lg inline-block"
                            style={{ 
                              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                              color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
                            }}
                          >
                            {product.variantsCount} xil variant
                          </div>
                        )}

                        {/* Price Section */}
                        <div className="mb-3">
                          <div className="flex items-baseline gap-2">
                            <p 
                              className="text-base sm:text-lg md:text-xl font-bold"
                              style={{ color: accentColor.color }}
                            >
                              {product.price?.toLocaleString()} so'm
                            </p>
                          </div>
                          {product.oldPrice && product.oldPrice > product.price && (
                            <p 
                              className="text-xs sm:text-sm line-through"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                            >
                              {product.oldPrice.toLocaleString()} so'm
                            </p>
                          )}
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (product.stockQuantity > 0) {
                              handleOpenVariantMenu(product);
                            }
                          }}
                          className="w-full py-2 md:py-3 rounded-lg md:rounded-xl text-xs sm:text-sm md:text-base font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
                          style={{ 
                            background: product.stockQuantity > 0 ? accentColor.color : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: product.stockQuantity > 0 ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                            cursor: product.stockQuantity > 0 ? 'pointer' : 'not-allowed'
                          }}
                          disabled={product.stockQuantity === 0}
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                          {product.stockQuantity > 0 ? 'Savatga' : 'Tugagan'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          ) : (
            /* Info Tab */
            <div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 md:mb-6">Do'kon ma'lumotlari</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {shop.phone && (
                  <div 
                    className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-98"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${accentColor.color}20` }}
                      >
                        <Phone className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor.color }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Telefon
                      </p>
                    </div>
                    <p className="font-bold text-lg sm:text-xl">{shop.phone}</p>
                  </div>
                )}

                {shop.address && (
                  <div 
                    className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-98"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${accentColor.color}20` }}
                      >
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor.color }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Manzil
                      </p>
                    </div>
                    <p className="font-bold text-base sm:text-lg leading-relaxed">{shop.address}</p>
                  </div>
                )}

                {shop.region && shop.district && (
                  <div 
                    className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-98"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${accentColor.color}20` }}
                      >
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor.color }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Hudud
                      </p>
                    </div>
                    <p className="font-bold text-lg sm:text-xl">{getLocationName(shop.region, shop.district)}</p>
                  </div>
                )}

                {shop.workingHours && (
                  <div 
                    className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-98"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${accentColor.color}20` }}
                      >
                        <Clock className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor.color }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Ish vaqti
                      </p>
                    </div>
                    <p className="font-bold text-lg sm:text-xl">{shop.workingHours}</p>
                  </div>
                )}

                {shop.delivery && (
                  <div 
                    className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-98"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${accentColor.color}20` }}
                      >
                        <Truck className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor.color }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Yetkazib berish
                      </p>
                    </div>
                    <p className="font-bold text-lg sm:text-xl">
                      {shop.deliveryTime === '60' ? '1 soat' : `${shop.deliveryTime || '30'} daqiqa`}
                    </p>
                  </div>
                )}

                {shop.minOrder > 0 && (
                  <div 
                    className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-98"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${accentColor.color}20` }}
                      >
                        <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor.color }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Minimal buyurtma
                      </p>
                    </div>
                    <p className="font-bold text-lg sm:text-xl">{shop.minOrder?.toLocaleString()} so'm</p>
                  </div>
                )}

                {/* Bo'lib to'lash - Full width card */}
                <div 
                  className="p-4 sm:p-5 rounded-2xl border sm:col-span-2"
                  style={{ 
                    background: `${accentColor.color}10`,
                    border: `1px solid ${accentColor.color}30`,
                    boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${accentColor.color}20` }}
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        To'lov rejasi
                      </p>
                      <p className="font-bold text-lg sm:text-xl" style={{ color: accentColor.color }}>
                        3/6/12 oyga bo'lib to'lash
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rating - Full width card */}
                <div 
                  className="p-4 sm:p-5 rounded-2xl border sm:col-span-2"
                  style={{ 
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center"
                        style={{ background: '#fbbf2420' }}
                      >
                        <Star className="w-5 h-5 sm:w-6 sm:h-6 fill-yellow-400 text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          Baholash
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className="w-4 h-4 sm:w-5 sm:h-5"
                                fill={
                                  modalShopRating.reviewCount > 0 &&
                                  i < Math.floor(modalShopRating.rating)
                                    ? '#fbbf24'
                                    : 'none'
                                }
                                stroke="#fbbf24"
                                strokeWidth={2}
                              />
                            ))}
                          </div>
                          {modalShopRating.reviewCount > 0 ? (
                            <>
                              <span className="font-bold text-lg sm:text-xl">
                                {modalShopRating.rating.toFixed(1)}
                              </span>
                              <span
                                className="text-sm sm:text-base"
                                style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}
                              >
                                ({modalShopRating.reviewCount} sharh)
                              </span>
                            </>
                          ) : (
                            <span
                              className="text-sm font-medium"
                              style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                            >
                              Hali baholanmagan
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services */}
              {shop.services && shop.services.length > 0 && (
                <div className="mt-4 md:mt-6">
                  <h4 className="text-base md:text-lg font-bold mb-3 md:mb-4">Xizmatlar</h4>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {shop.services.map((service: string, index: number) => (
                      <div 
                        key={index}
                        className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium"
                        style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                      >
                        {service}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(product, quantity, variantId, variantName) => {
            onAddToCart?.(product, quantity, variantId, variantName);
            setSelectedProduct(null);
          }}
          source="shop"
        />
      )}

      {/* Variant Selection Modal */}
      {variantMenuProduct && (
        <ProductVariantModal
          product={variantMenuProduct}
          onClose={() => setVariantMenuProduct(null)}
          onAddToCart={(product, quantity, variantId, variantName) => {
            onAddToCart?.(product, quantity, variantId, variantName);
            setVariantMenuProduct(null);
          }}
          source="shop"
        />
      )}
    </div>
  );
}