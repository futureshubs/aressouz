import { useState, useEffect, useMemo } from 'react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { Platform } from '../utils/platform';
import { rentalCatalogs, rentalCategories, rentalBanners, RentalItem } from '../data/rentals';
import { RentalCategoryCard } from './RentalCategoryCard';
import { RentalItemDetailModal } from './RentalItemDetailModal';
import { LayoutGrid, Package, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { regions as allRegions } from '../data/regions';
import { BannerCarousel } from './BannerCarousel';
import { matchesSelectedLocation } from '../utils/locationMatching';
import { ProductGridSkeleton } from './skeletons';
import { useHeaderSearchOptional } from '../context/HeaderSearchContext';
import { matchesHeaderSearch, normalizeHeaderSearch } from '../utils/headerSearchMatch';

interface RentalsViewProps {
  platform: Platform;
}

export function RentalsView({ platform }: RentalsViewProps) {
  const { theme, accentColor } = useTheme();
  const { selectedRegion: selectedRegionId, selectedDistrict: selectedDistrictId } = useLocation();
  const { query: headerSearch } = useHeaderSearchOptional();
  const isDark = theme === 'dark';
  
  const [activeView, setActiveView] = useState<'products' | 'catalog'>('products');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);
  const [currentBanner, setCurrentBanner] = useState(0);
  
  // Backend state
  const [backendProducts, setBackendProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load all rental products from backend
  useEffect(() => {
    loadAllRentalProducts();
  }, []);

  const loadAllRentalProducts = async () => {
    try {
      setLoading(true);
      
      // Get all branches first
      const branchesRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (!branchesRes.ok) {
        console.error('Failed to fetch branches:', branchesRes.status);
        return;
      }
      
      const branchesData = await branchesRes.json();
      console.log('📦 Branches loaded:', branchesData);
      
      if (branchesData.branches && Array.isArray(branchesData.branches)) {
        // Load products from all branches
        const allProducts: any[] = [];
        
        for (const branch of branchesData.branches) {
          try {
            console.log(`🔄 Loading rental products for branch: ${branch.id}`);
            const productsRes = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/products/${branch.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`
                }
              }
            );
            
            if (!productsRes.ok) {
              console.error(`❌ Failed to fetch products for branch ${branch.id}:`, productsRes.status);
              continue;
            }
            
            const productsData = await productsRes.json();
            console.log(`✅ Products loaded for branch ${branch.id}:`, productsData);
            
            if (productsData.success && productsData.products) {
              allProducts.push(...productsData.products);
            }
          } catch (error) {
            console.error(`❌ Error loading rental products for branch ${branch.id}:`, error);
            // Continue with other branches
          }
        }
        
        console.log('📦 Total rental products loaded:', allProducts.length);
        setBackendProducts(allProducts);
      }
    } catch (error) {
      console.error('❌ Error loading rental products:', error);
      // Don't show error toast, just log it
    } finally {
      setLoading(false);
    }
  };

  useVisibilityRefetch(() => {
    void loadAllRentalProducts();
  });

  // Auto-scroll banner
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % rentalBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const selectedCatalog = rentalCatalogs.find(c => c.id === selectedCatalogId);
  const selectedCategory = rentalCategories.find(c => c.id === selectedCategoryId);
  
  const filteredCategories = selectedCatalogId
    ? rentalCategories.filter(c => c.catalogId === selectedCatalogId)
    : rentalCategories;
  
  // Filter BACKEND products by catalog and category
  const catalogFilteredProducts = selectedCategoryId
    ? backendProducts.filter(item => item.category === selectedCategoryId)
    : selectedCatalogId
    ? backendProducts.filter(item => item.catalog === selectedCatalogId)
    : backendProducts;

  const handleBack = () => {
    if (selectedCategoryId) {
      setSelectedCategoryId(null);
    } else if (selectedCatalogId) {
      setSelectedCatalogId(null);
    }
  };

  const handleCatalogSelect = (catalogId: string) => {
    setSelectedCatalogId(catalogId);
    setSelectedCategoryId(null);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
  };

  const handleViewChange = (view: 'products' | 'catalog') => {
    setActiveView(view);
    setSelectedCatalogId(null);
    setSelectedCategoryId(null);
  };

  // Convert region ID to name
  const selectedRegionData = allRegions.find(r => r.id === selectedRegionId);
  const selectedRegion = selectedRegionData?.name || '';
  
  // Convert district ID to name
  const selectedDistrictData = selectedRegionData?.districts.find(d => d.id === selectedDistrictId);
  const selectedDistrict = selectedDistrictData?.name || '';

  const locationSelection = {
    selectedRegionId,
    selectedDistrictId,
  };

  const isInSelectedLocation = (product: Record<string, unknown>) =>
    matchesSelectedLocation(product, locationSelection);

  const finalCatalogProducts = catalogFilteredProducts.filter(product =>
    isInSelectedLocation(product)
  );

  const filteredBackendProducts = backendProducts.filter(product =>
    isInSelectedLocation(product)
  );

  const searchFilteredCategories = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return filteredCategories;
    return filteredCategories.filter((c) =>
      matchesHeaderSearch(headerSearch, [c.name, selectedCatalog?.name]),
    );
  }, [filteredCategories, headerSearch, selectedCatalog]);

  const searchFinalCatalogProducts = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return finalCatalogProducts;
    return finalCatalogProducts.filter((product: Record<string, unknown>) =>
      matchesHeaderSearch(headerSearch, [
        product.name,
        product.description,
        product.location,
        product.region,
        product.district,
        ...(Array.isArray(product.features) ? product.features : []).map(String),
      ]),
    );
  }, [finalCatalogProducts, headerSearch]);

  const searchFilteredBackendProducts = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return filteredBackendProducts;
    return filteredBackendProducts.filter((product: Record<string, unknown>) =>
      matchesHeaderSearch(headerSearch, [
        product.name,
        product.description,
        product.location,
        product.region,
        product.district,
        ...(Array.isArray(product.features) ? product.features : []).map(String),
      ]),
    );
  }, [filteredBackendProducts, headerSearch]);

  const visibleRentalCatalogs = useMemo(() => {
    if (!normalizeHeaderSearch(headerSearch)) return rentalCatalogs;
    return rentalCatalogs.filter((c) =>
      matchesHeaderSearch(headerSearch, [
        c.name,
        ...rentalCategories.filter((cat) => cat.catalogId === c.id).map((cat) => cat.name),
      ]),
    );
  }, [headerSearch]);

  return (
    <div className="min-h-screen pb-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))]">
      {/* Banner - Only show on main view */}
      {!selectedCatalogId && !selectedCategoryId && selectedRegion && selectedDistrict && (
        <div className="px-4 pt-6 pb-2">
          <BannerCarousel
            category="rentals"
            region={selectedRegion}
            district={selectedDistrict}
          />
        </div>
      )}

      {/* View Toggle - Only show on main view */}
      {!selectedCatalogId && !selectedCategoryId && (
        <div className="px-4 py-3">
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={() => handleViewChange('products')}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2"
              style={{
                background:
                  activeView === 'products'
                    ? accentColor.color
                    : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : '#ffffff',
                color:
                  activeView === 'products'
                    ? '#ffffff'
                    : isDark
                      ? 'rgba(255,255,255,0.65)'
                      : 'rgba(0,0,0,0.55)',
                boxShadow:
                  activeView === 'products' ? `0 4px 20px ${accentColor.color}44` : undefined,
                border: activeView === 'products' ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <Package className="size-5 shrink-0" />
              Mahsulotlar
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('catalog')}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2"
              style={{
                background:
                  activeView === 'catalog'
                    ? accentColor.color
                    : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : '#ffffff',
                color:
                  activeView === 'catalog'
                    ? '#ffffff'
                    : isDark
                      ? 'rgba(255,255,255,0.65)'
                      : 'rgba(0,0,0,0.55)',
                boxShadow:
                  activeView === 'catalog' ? `0 4px 20px ${accentColor.color}44` : undefined,
                border: activeView === 'catalog' ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <LayoutGrid className="size-5 shrink-0" />
              Katalog
            </button>
          </div>
        </div>
      )}

      {/* Products View */}
      {activeView === 'products' && !selectedCatalogId && !selectedCategoryId && (
        <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 
              className="text-lg font-semibold"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Barcha mahsulotlar
            </h2>
            
            <div className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              {loading ? (
                <>
                  <Loader2 className="size-4 shrink-0 animate-spin" style={{ color: accentColor.color }} />
                  Yuklanmoqda…
                </>
              ) : (
                <>{searchFilteredBackendProducts.length} ta mahsulot</>
              )}
            </div>
          </div>
          
          {/* Loading state */}
          {loading ? (
            <ProductGridSkeleton
              isDark={isDark}
              count={12}
              gridClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4"
              imageClassName="aspect-[4/3]"
            />
          ) : searchFilteredBackendProducts.length > 0 ? (
            /* Backend products */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
              {searchFilteredBackendProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    // Create RentalItem from backend product
                    const rentalItem = {
                      id: product.id,
                      branchId: product.branchId,
                      name: product.name,
                      category: product.category,
                      image: product.images && product.images.length > 0 ? product.images[0] : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
                      price: product.durations?.daily?.price || product.durations?.hourly?.price || product.durations?.weekly?.price || product.durations?.monthly?.price || '0',
                      rating: product.rating || 0,
                      reviews: product.reviewCount || 0,
                      available: product.availableQuantity ?? 0,
                      total: product.totalQuantity || 0,
                      location: `${product.district || ''}, ${product.region}`,
                      images: product.images || [],
                      features: product.features || [],
                      description: product.description || '',
                      deposit: product.deposit || '',
                      minRental: product.minDuration || '1 kun',
                      categoryId: product.category,
                      catalogId: 'rentals',
                      durations: product.durations || {}
                    };
                    setSelectedItem(rentalItem);
                  }}
                  className="group cursor-pointer w-full"
                >
                  <div 
                    className="rounded-2xl sm:rounded-3xl overflow-hidden border transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: isDark ? 'rgba(0, 0, 0, 0.8)' : '#1a1a1a',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {/* Image with Overlay */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img 
                        src={product.images && product.images.length > 0 ? product.images[0] : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      
                      {/* Top Badges */}
                      <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 right-1.5 sm:right-2 flex items-center justify-between gap-1.5">
                        {/* Rating */}
                        {product.rating > 0 ? (
                          <div 
                            className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full backdrop-blur-md"
                            style={{
                              background: 'rgba(0, 0, 0, 0.6)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <span className="text-yellow-400 text-xs sm:text-sm">★</span>
                            <span className="text-white text-[10px] sm:text-xs font-semibold">{product.rating.toFixed(1)}</span>
                            <span className="text-white/70 text-[9px] sm:text-xs">({product.reviewCount || 0})</span>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full backdrop-blur-md"
                            style={{
                              background: 'rgba(0, 0, 0, 0.6)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <span className="text-white/50 text-[10px] sm:text-xs">Yangi</span>
                          </div>
                        )}
                        
                        {/* Availability Badge */}
                        {product.availableQuantity > 0 && (
                          <div 
                            className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium backdrop-blur-md whitespace-nowrap"
                            style={{ 
                              background: 'rgba(20, 184, 166, 0.2)',
                              border: '1px solid rgba(20, 184, 166, 0.4)',
                              color: '#14b8a6'
                            }}
                          >
                            Mavjud
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Info Section - Below Image */}
                    <div className="p-2 sm:p-3">
                      {/* Product Name */}
                      <h3 className="text-sm sm:text-base font-bold mb-1 line-clamp-1" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        {product.name}
                      </h3>
                      
                      {/* Location */}
                      <div className="flex items-center gap-1 mb-2">
                        <svg className="size-2.5 sm:size-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[10px] sm:text-xs line-clamp-1" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                          {product.district ? `${product.district}, ${product.region}` : product.region}
                        </span>
                      </div>
                      
                      {/* Price */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {product.durations?.daily?.enabled && (
                            <>
                              <div className="text-base sm:text-lg md:text-xl font-bold truncate" style={{ color: accentColor.color }}>
                                {parseInt(product.durations.daily.price).toLocaleString()} <span className="text-[10px] sm:text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)' }}>so'm</span>
                              </div>
                              <div className="text-[10px] sm:text-xs mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)' }}>
                                kunlik
                              </div>
                            </>
                          )}
                          {!product.durations?.daily?.enabled && product.durations?.hourly?.enabled && (
                            <>
                              <div className="text-base sm:text-lg md:text-xl font-bold truncate" style={{ color: accentColor.color }}>
                                {parseInt(product.durations.hourly.price).toLocaleString()} <span className="text-[10px] sm:text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)' }}>so'm</span>
                              </div>
                              <div className="text-[10px] sm:text-xs mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)' }}>
                                soatlik
                              </div>
                            </>
                          )}
                          {!product.durations?.daily?.enabled && !product.durations?.hourly?.enabled && product.durations?.weekly?.enabled && (
                            <>
                              <div className="text-base sm:text-lg md:text-xl font-bold truncate" style={{ color: accentColor.color }}>
                                {parseInt(product.durations.weekly.price).toLocaleString()} <span className="text-[10px] sm:text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)' }}>so'm</span>
                              </div>
                              <div className="text-[10px] sm:text-xs mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.6)' }}>
                                haftalik
                              </div>
                            </>
                          )}
                        </div>
                        
                        {/* Arrow Button */}
                        <button
                          className="size-7 sm:size-8 md:size-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                          style={{
                            background: accentColor.color,
                            boxShadow: `0 4px 12px ${accentColor.color}66`,
                          }}
                        >
                          <svg className="size-3 sm:size-3.5 md:size-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 17L17 7M17 7H7M17 7V17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div 
              className="text-center py-12 rounded-3xl border"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
              <h3 className="text-xl font-bold mb-2">Ijara mahsulotlari yo'q</h3>
              <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                Hozircha ijara uchun mahsulotlar mavjud emas
              </p>
            </div>
          )}
        </div>
      )}

      {/* Catalog View - Catalogs List */}
      {activeView === 'catalog' && !selectedCatalogId && (
        <div className="px-4 py-6">
          <h2 
            className="text-lg mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Kataloglar
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleRentalCatalogs.map((catalog) => (
              <button
                key={catalog.id}
                onClick={() => handleCatalogSelect(catalog.id)}
                className="group relative overflow-hidden rounded-2xl sm:rounded-3xl transition-all duration-300 active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 1)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                  boxShadow: isDark 
                    ? '0 4px 16px rgba(0, 0, 0, 0.3)' 
                    : '0 4px 16px rgba(0, 0, 0, 0.08)',
                }}
              >
                <div className="relative h-36 sm:h-44 md:h-48 overflow-hidden">
                  <img 
                    src={catalog.image} 
                    alt={catalog.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.7)'}, transparent)`,
                    }}
                  />
                  
                  <div className="absolute top-2 sm:top-3 left-2 sm:left-3">
                    <div 
                      className="size-10 sm:size-12 rounded-xl flex items-center justify-center backdrop-blur-xl border"
                      style={{
                        background: `${accentColor.color}33`,
                        borderColor: `${accentColor.color}66`,
                      }}
                    >
                      <span className="text-xl sm:text-2xl">{catalog.icon}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 md:p-4">
                  <h3 
                    className="text-sm sm:text-base font-semibold mb-1 text-left line-clamp-1"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {catalog.name}
                  </h3>
                  <p 
                    className="text-xs sm:text-sm mb-1.5 sm:mb-2 text-left line-clamp-2"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    {catalog.description}
                  </p>
                  <p 
                    className="text-xs text-left font-medium"
                    style={{ color: accentColor.color }}
                  >
                    {catalog.categoryCount} ta kategoriya
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Catalog View - Categories List */}
      {selectedCatalogId && !selectedCategoryId && (
        <div className="px-4 py-6">
          {/* Back Button and Breadcrumb */}
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 transition-all hover:scale-105 active:scale-95"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: accentColor.color }} />
              <span className="font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Ortga
              </span>
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setSelectedCatalogId(null)}
                className="hover:underline"
                style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
              >
                Kataloglar
              </button>
              <ChevronRight className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }} />
              <span className="font-medium" style={{ color: accentColor.color }}>
                {selectedCatalog?.icon} {selectedCatalog?.name}
              </span>
            </div>
          </div>

          <h2 
            className="text-lg mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Kategoriyalar
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {searchFilteredCategories.map((category) => (
              <RentalCategoryCard
                key={category.id}
                category={category}
                onClick={() => handleCategorySelect(category.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Catalog View - Items in Category */}
      {selectedCategoryId && (
        <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          {/* Back Button and Breadcrumb */}
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 transition-all hover:scale-105 active:scale-95"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: accentColor.color }} />
              <span className="font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Ortga
              </span>
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <button
                onClick={() => {
                  setSelectedCatalogId(null);
                  setSelectedCategoryId(null);
                }}
                className="hover:underline"
                style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
              >
                Kataloglar
              </button>
              <ChevronRight className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }} />
              <button
                onClick={() => setSelectedCategoryId(null)}
                className="hover:underline"
                style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
              >
                {selectedCatalog?.icon} {selectedCatalog?.name}
              </button>
              <ChevronRight className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }} />
              <span className="font-medium" style={{ color: accentColor.color }}>
                {selectedCategory?.icon} {selectedCategory?.name}
              </span>
            </div>
          </div>

          <h2 
            className="text-lg font-semibold mb-3 sm:mb-4"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            Mahsulotlar ({searchFinalCatalogProducts.length})
          </h2>
          
          {loading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 py-2 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}>
                <Loader2 className="size-5 shrink-0 animate-spin" style={{ color: accentColor.color }} />
                Yuklanmoqda…
              </div>
              <ProductGridSkeleton
                isDark={isDark}
                count={12}
                gridClassName="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3 md:gap-4"
                imageClassName="aspect-square"
              />
            </div>
          ) : searchFinalCatalogProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3 md:gap-4">
              {searchFinalCatalogProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => {
                    // Create RentalItem from backend product
                    const rentalItem = {
                      id: product.id,
                      branchId: product.branchId,
                      name: product.name,
                      category: product.category,
                      image: product.images && product.images.length > 0 ? product.images[0] : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
                      price: product.durations?.daily?.price || product.durations?.hourly?.price || product.durations?.weekly?.price || product.durations?.monthly?.price || '0',
                      rating: 5,
                      reviews: 0,
                      available: product.availableQuantity ?? 0,
                      total: product.totalQuantity || 0,
                      location: `${product.district || ''}, ${product.region}`,
                      images: product.images || [],
                      features: product.features || [],
                      description: product.description || '',
                      deposit: product.deposit || '',
                      minRental: product.minDuration || '1 kun',
                      categoryId: product.category,
                      catalogId: 'rentals',
                      durations: product.durations || {}
                    };
                    setSelectedItem(rentalItem);
                  }}
                  className="group cursor-pointer"
                >
                  <div 
                    className="rounded-2xl sm:rounded-3xl overflow-hidden border transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                      boxShadow: isDark 
                        ? '0 4px 16px rgba(0, 0, 0, 0.3)' 
                        : '0 4px 16px rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    {/* Image */}
                    <div className="relative aspect-square overflow-hidden">
                      <img 
                        src={product.images && product.images.length > 0 ? product.images[0] : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      {product.availableQuantity > 0 && (
                        <div 
                          className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium"
                          style={{ background: accentColor.color, color: '#ffffff' }}
                        >
                          {product.availableQuantity}/{product.totalQuantity}
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="p-2.5 sm:p-3">
                      <h3 
                        className="text-sm sm:text-base font-semibold mb-1 line-clamp-1"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        {product.name}
                      </h3>
                      <p 
                        className="text-xs mb-2 line-clamp-1"
                        style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
                      >
                        {product.category}
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          {product.durations?.daily?.enabled && (
                            <p className="text-xs font-semibold" style={{ color: accentColor.color }}>
                              {parseInt(product.durations.daily.price).toLocaleString()} so'm/kun
                            </p>
                          )}
                          {!product.durations?.daily?.enabled && product.durations?.hourly?.enabled && (
                            <p className="text-xs font-semibold" style={{ color: accentColor.color }}>
                              {parseInt(product.durations.hourly.price).toLocaleString()} so'm/soat
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div 
              className="text-center py-12 rounded-3xl border"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
              <h3 className="text-xl font-bold mb-2">Bu kategoriyada mahsulot yo'q</h3>
              <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                Hozircha bu kategoriyada ijara uchun mahsulotlar mavjud emas
              </p>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <RentalItemDetailModal
          item={selectedItem}
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}