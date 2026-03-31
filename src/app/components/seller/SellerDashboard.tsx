import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Store, Package, Plus, Edit2, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface Shop {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  banner?: string;
  phone?: string;
  address?: string;
  region: string;
  district: string;
  workingHours?: string;
  delivery: boolean;
  deliveryTime?: string;
  minOrder?: number;
  services?: string[];
  createdAt: string;
}

interface Product {
  id: string;
  shopId: string;
  name: string;
  description?: string;
  price: number;
  oldPrice?: number;
  image?: string;
  video?: string;
  category?: string;
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
}

export default function SellerDashboard() {
  const { theme, accentColor } = useTheme();
  const { accessToken } = useAuth();
  const isDark = theme === 'dark';

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'shop' | 'products'>('shop');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    if (accessToken) {
      loadShop();
    }
  }, [accessToken, visibilityRefetchTick]);

  const loadShop = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/shop`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setShop(data.shop);
        if (data.shop) {
          loadProducts(data.shop.id);
        }
      }
    } catch (error) {
      console.error('Error loading shop:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async (shopId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const toggleProductStatus = async (productId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products/${productId}/toggle`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isActive: !currentStatus }),
        }
      );

      if (response.ok) {
        setProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, isActive: !currentStatus } : p
        ));
        toast.success(!currentStatus ? 'Mahsulot faollashtirildi' : 'Mahsulot o\'chirildi');
      } else {
        toast.error('Xatolik yuz berdi');
      }
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Mahsulotni o\'chirmoqchimisiz?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products/${productId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        setProducts(prev => prev.filter(p => p.id !== productId));
        toast.success('Mahsulot o\'chirildi');
      } else {
        toast.error('Xatolik yuz berdi');
      }
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" 
          style={{ borderColor: `${accentColor.color}40`, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div 
          className="max-w-md w-full p-12 rounded-3xl text-center"
          style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
        >
          <Store className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
          <h2 className="text-2xl font-bold mb-4">Do'kon yo'q</h2>
          <p className="mb-6" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
            Sizda hali do'kon yo'q. Admin orqali do'kon ochishingiz kerak.
          </p>
          <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
            Admin bilan bog'laning: Ali / Ali / 0099
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: isDark ? '#0a0a0a' : '#f5f5f5' }}>
      {/* Header */}
      <div className="px-6 py-6">
        <h1 className="text-3xl font-bold mb-2">Mening do'konim</h1>
        <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
          {shop.name}
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('shop')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all"
            style={{
              background: activeTab === 'shop' ? accentColor.color : isDark ? '#1a1a1a' : '#ffffff',
              color: activeTab === 'shop' ? '#ffffff' : isDark ? '#ffffff' : '#000000',
            }}
          >
            <Store className="w-5 h-5" />
            Do'kon
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all"
            style={{
              background: activeTab === 'products' ? accentColor.color : isDark ? '#1a1a1a' : '#ffffff',
              color: activeTab === 'products' ? '#ffffff' : isDark ? '#ffffff' : '#000000',
            }}
          >
            <Package className="w-5 h-5" />
            Mahsulotlar ({products.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-24">
        {activeTab === 'shop' ? (
          /* Shop Info */
          <div 
            className="p-6 rounded-3xl"
            style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
          >
            {shop.banner && (
              <img 
                src={shop.banner} 
                alt={shop.name}
                className="w-full h-48 object-cover rounded-2xl mb-6"
              />
            )}

            {shop.logo && (
              <div className="flex justify-center mb-6">
                <img 
                  src={shop.logo} 
                  alt={shop.name}
                  className="w-32 h-32 object-cover rounded-2xl"
                />
              </div>
            )}

            <h2 className="text-2xl font-bold mb-4">{shop.name}</h2>

            {shop.description && (
              <p className="mb-6" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                {shop.description}
              </p>
            )}

            <div className="space-y-3">
              {shop.phone && (
                <div>
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    Telefon
                  </p>
                  <p className="font-medium">{shop.phone}</p>
                </div>
              )}

              {shop.address && (
                <div>
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    Manzil
                  </p>
                  <p className="font-medium">{shop.address}</p>
                </div>
              )}

              {shop.workingHours && (
                <div>
                  <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    Ish vaqti
                  </p>
                  <p className="font-medium">{shop.workingHours}</p>
                </div>
              )}

              <div>
                <p className="text-sm mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Yetkazib berish
                </p>
                <p className="font-medium">{shop.delivery ? 'Bor' : 'Yo\'q'}</p>
              </div>
            </div>
          </div>
        ) : (
          /* Products */
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Mahsulotlar</h2>
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all active:scale-95"
                style={{ background: accentColor.color, color: '#ffffff' }}
              >
                <Plus className="w-5 h-5" />
                Qo'shish
              </button>
            </div>

            {products.length === 0 ? (
              <div 
                className="p-12 rounded-3xl text-center"
                style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
              >
                <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                <h3 className="text-lg font-bold mb-2">Mahsulotlar yo'q</h3>
                <p className="mb-6" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Birinchi mahsulotingizni qo'shing
                </p>
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="px-6 py-3 rounded-2xl font-medium"
                  style={{ background: accentColor.color, color: '#ffffff' }}
                >
                  Mahsulot qo'shish
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="p-4 rounded-2xl"
                    style={{
                      background: isDark ? '#1a1a1a' : '#ffffff',
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <div className="flex gap-4">
                      {product.image && (
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-24 h-24 object-cover rounded-xl"
                        />
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-lg">{product.name}</h3>
                            <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                              Omborda: {product.stockQuantity} ta
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleProductStatus(product.id, product.isActive)}
                              className="p-2 rounded-xl transition-all active:scale-90"
                              style={{ 
                                background: product.isActive ? `${accentColor.color}20` : 'rgba(255, 0, 0, 0.1)',
                                color: product.isActive ? accentColor.color : '#ef4444'
                              }}
                            >
                              {product.isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="p-2 rounded-xl transition-all active:scale-90"
                              style={{ background: 'rgba(255, 0, 0, 0.1)', color: '#ef4444' }}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold" style={{ color: accentColor.color }}>
                            {product.price.toLocaleString()} so'm
                          </span>
                          {product.oldPrice && (
                            <span className="text-sm line-through" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                              {product.oldPrice.toLocaleString()} so'm
                            </span>
                          )}
                        </div>

                        {!product.isActive && (
                          <div 
                            className="mt-2 px-3 py-1 rounded-lg text-xs font-medium inline-block"
                            style={{ background: 'rgba(255, 0, 0, 0.1)', color: '#ef4444' }}
                          >
                            O'chirilgan
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0, 0, 0, 0.7)' }}>
          <div 
            className="w-full max-w-lg p-6 rounded-3xl"
            style={{ background: isDark ? '#1a1a1a' : '#ffffff' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Mahsulot qo'shish</h2>
              <button
                onClick={() => setShowAddProduct(false)}
                className="p-2 rounded-xl"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Mahsulot qo'shish funksiyasi tez orada qo'shiladi
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
