import { useState, useEffect } from 'react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from '../context/LocationContext';
import { ShoppingBag, MapPin, Clock, Package, ChevronRight, X, Store } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { regions } from '../data/regions';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton, ShopListSkeleton } from './skeletons';

interface Product {
  id: number;
  /** Filial katalog UUID */
  productUuid?: string;
  name: string;
  price: number;
  image: string;
  categoryId: string;
  catalogId: string;
  rating: number;
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

export default function Market() {
  const { theme, accentColor } = useTheme();
  const { selectedRegion, selectedDistrict } = useLocation();
  const isDark = theme === 'dark';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branchProducts, setBranchProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'branches'>('products');

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0) {
      loadProducts();
    }
  }, [selectedRegion, selectedDistrict, branches.length]);

  const loadBranches = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const formattedBranches: Branch[] = data.branches.map((b: any) => ({
          id: b.id,
          branchName: b.name || b.branchName,
          login: b.login,
          regionId: b.regionId || '',
          districtId: b.districtId || '',
          phone: b.phone || '',
          managerName: b.managerName || '',
          coordinates: b.coordinates || { lat: 0, lng: 0 },
          createdAt: b.createdAt || '',
        }));
        setBranches(formattedBranches);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Filiallar yuklanmadi');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!selectedRegion || !selectedDistrict || branches.length === 0) {
      setProducts([]);
      setIsLoadingProducts(false);
      return;
    }

    const localBranches = branches.filter(
      b => b.regionId === selectedRegion && b.districtId === selectedDistrict
    );

    if (localBranches.length === 0) {
      setProducts([]);
      setIsLoadingProducts(false);
      return;
    }

    try {
      setIsLoadingProducts(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products?includeSold=false`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const allBranchProducts = data.products || [];
        
        const localBranchIds = localBranches.map(b => b.id);
        const filteredProducts = allBranchProducts.filter((p: any) => 
          localBranchIds.includes(p.branchId)
        );

        const stringToNumber = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return Math.abs(hash);
        };

        const displayProducts: Product[] = filteredProducts.map((bp: any) => {
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
            variants: bp.variants.map((v: any) => ({ 
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

        setProducts(displayProducts);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const loadBranchProducts = async (branch: Branch) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branch-products?includeSold=false`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const filtered = data.products.filter((p: any) => p.branchId === branch.id);
        
        const stringToNumber = (str: string): number => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return Math.abs(hash);
        };

        const displayProducts: Product[] = filtered.map((bp: any) => {
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
            specs: firstVariant.attributes || [],
            variants: bp.variants,
            branchName: branch.branchName,
            branchId: branch.id
          };
        });

        setBranchProducts(displayProducts);
      }
    } catch (error) {
      console.error('Error loading branch products:', error);
    }
  };

  useVisibilityRefetch(() => {
    void loadBranches();
  });

  const getLocationName = (regionId: string, districtId?: string) => {
    const region = regions.find(r => r.id === regionId);
    if (!region) return regionId;
    
    if (districtId) {
      const district = region.districts.find(d => d.id === districtId);
      return district ? `${region.name}, ${district.name}` : region.name;
    }
    
    return region.name;
  };

  const filteredBranches = branches.filter(branch => {
    if (!selectedRegion) return true;
    if (branch.regionId !== selectedRegion) return false;
    if (selectedDistrict && branch.districtId !== selectedDistrict) return false;
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: isDark ? '#0a0a0a' : '#f5f5f5' }}>
      {/* Header Banner */}
      <div className="relative h-64 overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br"
          style={{ 
            backgroundImage: 'url(https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
        </div>
        <div className="relative h-full flex items-end p-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Market - Oziq-ovqat</h1>
            <p className="text-white/80">Yangi va sifatli mahsulotlar</p>
          </div>
        </div>
      </div>

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
            <ShoppingBag className="w-5 h-5" />
            Mahsulotlar
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all"
            style={{
              background: activeTab === 'branches' ? accentColor.color : isDark ? '#1a1a1a' : '#ffffff',
              color: activeTab === 'branches' ? '#ffffff' : isDark ? '#ffffff' : '#000000',
            }}
          >
            <Store className="w-5 h-5" />
            Filiallar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-24">
        {activeTab === 'products' ? (
          /* Products Tab */
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Barcha mahsulotlar</h2>
                {selectedRegion && (
                  <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    {getLocationName(selectedRegion, selectedDistrict)}
                  </p>
                )}
              </div>
              <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                {products.length} ta
              </span>
            </div>

            {isLoading || isLoadingProducts ? (
              <ProductGridSkeleton
                isDark={isDark}
                count={10}
                gridClassName="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
              />
            ) : products.length === 0 ? (
              <div 
                className="p-12 rounded-3xl text-center"
                style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
              >
                <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                <h3 className="text-lg font-bold mb-2 text-foreground">Mahsulotlar yo'q</h3>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {selectedRegion 
                    ? `${getLocationName(selectedRegion, selectedDistrict)} hududida mahsulotlar topilmadi`
                    : 'Hududingizni tanlang'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={() => {}}
                    onProductClick={() => {}}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Branches Tab */
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Filiallar</h2>
                {selectedRegion && (
                  <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    {getLocationName(selectedRegion, selectedDistrict)}
                  </p>
                )}
              </div>
              <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                {filteredBranches.length} ta
              </span>
            </div>

            {isLoading ? (
              <ShopListSkeleton isDark={isDark} rows={6} />
            ) : filteredBranches.length === 0 ? (
              <div 
                className="p-12 rounded-3xl text-center"
                style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
              >
                <Store className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                <h3 className="text-lg font-bold mb-2 text-foreground">Filiallar yo'q</h3>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {selectedRegion 
                    ? `${getLocationName(selectedRegion, selectedDistrict)} hududida filiallar topilmadi`
                    : 'Hududingizni tanlang'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBranches.map((branch) => (
                  <div
                    key={branch.id}
                    onClick={() => {
                      setSelectedBranch(branch);
                      loadBranchProducts(branch);
                    }}
                    className="rounded-3xl overflow-hidden cursor-pointer transition-all active:scale-98 p-4"
                    style={{
                      background: isDark ? '#1a1a1a' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-2 text-foreground">{branch.branchName}</h3>
                        
                        {branch.regionId && branch.districtId && (
                          <div className="flex items-center gap-2 text-sm mb-2">
                            <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                            <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                              {getLocationName(branch.regionId, branch.districtId)}
                            </span>
                          </div>
                        )}

                        {branch.managerName && (
                          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Menejer: {branch.managerName}
                          </p>
                        )}
                      </div>
                      
                      <ChevronRight className="w-6 h-6 flex-shrink-0" style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Branch Detail Modal */}
      {selectedBranch && (
        <div 
          className="fixed inset-0 z-50"
          style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}
        >
          <div className="h-full overflow-y-auto pb-6">
            <button
              onClick={() => setSelectedBranch(null)}
              className="fixed top-3 right-3 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
              style={{ 
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="px-6 py-6">
              <h2 className="text-3xl font-bold mb-4 text-foreground">{selectedBranch.branchName}</h2>
              
              {selectedBranch.regionId && selectedBranch.districtId && (
                <div className="flex items-center gap-2 text-base mb-4">
                  <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
                  <span>{getLocationName(selectedBranch.regionId, selectedBranch.districtId)}</span>
                </div>
              )}

              <h3 className="text-xl font-bold mb-6 mt-8 text-foreground">Mahsulotlar</h3>
              
              {branchProducts.length === 0 ? (
                <div 
                  className="p-12 rounded-2xl text-center"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
                >
                  <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Hozircha mahsulotlar yo'q
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {branchProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={() => {}}
                      onProductClick={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}