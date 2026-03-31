import { useState, memo, useEffect } from 'react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { ShoppingBag, Store as StoreIcon } from 'lucide-react';
import { stores, Store } from '../data/stores';
import { StoreCard } from './StoreCard';
import { StoreDetailModal } from './StoreDetailModal';
import { ProductCard } from './ProductCard';
import { ProductDetailModal } from './ProductDetailModal';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { getEffectiveProductStockQuantity } from '../utils/cartStock';
import { ProductGridSkeleton } from './skeletons';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  categoryId: string;
  catalogId: string;
  rating: number;
}

interface ShopViewProps {
  platform: Platform;
  onAddToCart: (product: Product) => void;
  shopProducts: Product[];
}

export const ShopView = memo(function ShopView({ platform, onAddToCart, shopProducts }: ShopViewProps) {
  const { theme, accentColor } = useTheme();
  const [activeTab, setActiveTab] = useState<'products' | 'stores'>('products');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [onlineShopProducts, setOnlineShopProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  // Load online shop products
  useEffect(() => {
    if (activeTab === 'products') {
      loadOnlineShopProducts();
    }
  }, [activeTab]);

  const loadOnlineShopProducts = async () => {
    setIsLoadingProducts(true);
    try {
      // First get all shops
      const shopsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (shopsResponse.ok) {
        const shopsData = await shopsResponse.json();
        const allProducts: any[] = [];

        // Then get products from each shop
        for (const shop of shopsData.shops) {
          const productsResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops/${shop.id}/products`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          );

          if (productsResponse.ok) {
            const productsData = await productsResponse.json();
            if (productsData.products && productsData.products.length > 0) {
              // Add shop info to each product
              const productsWithShop = productsData.products.map((p: any) => ({
                ...p,
                shopName: shop.name,
                shopLogo: shop.logo,
                stockQuantity: getEffectiveProductStockQuantity(p),
              }));
              allProducts.push(...productsWithShop);
            }
          }
        }

        setOnlineShopProducts(allProducts);
      }
    } catch (error) {
      console.error('Error loading online shop products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useVisibilityRefetch(() => {
    void loadOnlineShopProducts();
  });

  // Shop advertisements data
  const shopAds = [
    {
      title: 'Mega Chegirma!',
      subtitle: 'Barcha mahsulotlarga 40% gacha chegirma',
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80',
    },
    {
      title: 'Yangi Kolleksiya',
      subtitle: 'Eng so\'nggi trendlar - hozir do\'konlarda',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80',
    },
    {
      title: 'Premium Sifat',
      subtitle: 'Yuqori sifatli mahsulotlar - arzon narxlarda',
      image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&q=80',
    },
    {
      title: 'Tez Yetkazib Berish',
      subtitle: '24 soat ichida - bepul yetkazib berish',
      image: 'https://images.unsplash.com/photo-1573855619003-97b4799dcd8b?w=1200&q=80',
    },
    {
      title: 'VIP Mijozlar',
      subtitle: 'Maxsus chegirmalar va sovg\'alar',
      image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80',
    },
  ];

  // Auto-rotate slides every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % shopAds.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [shopAds.length]);

  return (
    <>
      <div className="pb-8">
        {/* Banner */}
        <div className="relative px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto">
            <div 
              className="relative overflow-hidden rounded-2xl sm:rounded-3xl mb-4 sm:mb-5"
              style={{
                height: 'min(120px, 28vw)',
                maxHeight: '132px',
                boxShadow: `0 8px 28px ${accentColor.color}28`,
              }}
            >
              {/* Slides */}
              {shopAds.map((ad, index) => (
                <div
                  key={index}
                  className="absolute inset-0 transition-all duration-700 ease-in-out"
                  style={{
                    opacity: currentSlide === index ? 1 : 0,
                    transform: currentSlide === index 
                      ? 'translateX(0)' 
                      : index < currentSlide 
                        ? 'translateX(-100%)' 
                        : 'translateX(100%)',
                  }}
                >
                  {/* Background Image */}
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${ad.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />

                  {/* Dark Gradient at Bottom */}
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
                    }}
                  />

                  {/* Content */}
                  <div className="relative z-10 h-full flex flex-col justify-end p-4 sm:p-6">
                    <div>
                      <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white mb-1 drop-shadow-2xl">
                        {ad.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-white/95 font-medium drop-shadow-lg">
                        {ad.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Navigation Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2">
                {shopAds.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className="transition-all duration-300"
                    style={{
                      width: currentSlide === index ? '24px' : '8px',
                      height: '8px',
                      borderRadius: '999px',
                      background: currentSlide === index 
                        ? '#ffffff' 
                        : 'rgba(255, 255, 255, 0.4)',
                      boxShadow: currentSlide === index 
                        ? '0 2px 8px rgba(0, 0, 0, 0.3)' 
                        : 'none',
                    }}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 sm:px-6 md:px-8 lg:px-12 mb-6">
          <div className="max-w-7xl mx-auto">
            <div 
              className="inline-flex p-1 rounded-2xl"
              style={{
                background: isDark 
                  ? (isIOS ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))' : 'linear-gradient(135deg, #1a1a1a, #141414)')
                  : (isIOS ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))' : 'linear-gradient(135deg, #ffffff, #fafafa)'),
                backdropFilter: isIOS ? 'blur(20px)' : undefined,
                border: isDark 
                  ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.08)')
                  : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)'),
                boxShadow: isDark
                  ? 'none'
                  : (isIOS ? '0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 4px 12px rgba(0, 0, 0, 0.08)'),
              }}
            >
              <button
                onClick={() => setActiveTab('products')}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all"
                style={{
                  backgroundImage: activeTab === 'products' ? accentColor.gradient : 'none',
                  color: activeTab === 'products' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                  boxShadow: activeTab === 'products' ? `0 4px 12px ${accentColor.color}66` : 'none',
                }}
              >
                <ShoppingBag className="size-4" strokeWidth={2.5} />
                Mahsulotlar
              </button>
              
              <button
                onClick={() => setActiveTab('stores')}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all"
                style={{
                  backgroundImage: activeTab === 'stores' ? accentColor.gradient : 'none',
                  color: activeTab === 'stores' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                  boxShadow: activeTab === 'stores' ? `0 4px 12px ${accentColor.color}66` : 'none',
                }}
              >
                <StoreIcon className="size-4" strokeWidth={2.5} />
                Do'konlar
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 sm:px-6 md:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 
                    className="text-lg sm:text-xl md:text-2xl font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    Do'kon mahsulotlari
                  </h2>
                  <span 
                    className="text-xs sm:text-sm"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                  >
                    {isLoadingProducts ? 'Yuklanmoqda...' : onlineShopProducts.length} ta
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-4">
                  {isLoadingProducts ? (
                    <div className="col-span-full">
                      <ProductGridSkeleton
                        isDark={isDark}
                        count={10}
                        gridClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-4"
                      />
                    </div>
                  ) : (
                    onlineShopProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={onAddToCart}
                        platform={platform}
                        onProductClick={setSelectedProduct}
                        source="shop"
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Stores Tab */}
            {activeTab === 'stores' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 
                    className="text-lg sm:text-xl md:text-2xl font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    Mahalliy do'konlar
                  </h2>
                  <span 
                    className="text-xs sm:text-sm"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                  >
                    {stores.length} ta
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                  {stores.map((store) => (
                    <StoreCard
                      key={store.id}
                      store={store}
                      onStoreClick={setSelectedStore}
                      platform={platform}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Store Detail Modal */}
      {selectedStore && (
        <StoreDetailModal
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
          platform={platform}
        />
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isOpen={true}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(product, quantity) => {
            onAddToCart(product);
          }}
          source="shop"
          storeName="TechMart Elektronika"
        />
      )}
    </>
  );
});