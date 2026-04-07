import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  Store,
  Phone,
  X,
  Plus,
  Package,
  Trash2,
  Image,
  Send,
  Pencil,
  Warehouse,
  BarChart3,
  RefreshCw,
  Search,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { regions } from '../../data/regions';
import { buildAdminHeaders, buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { getVariantStockQuantity, getEffectiveProductStockQuantity } from '../../utils/cartStock';
import { branchIdsEqual } from '../../utils/branchIdNormalize';

interface ShopViewProps {
  branchId: string;
}

type ShopOrderRow = {
  id: string;
  orderId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  shopId?: string;
  shopName?: string;
  paymentStatus: string;
};

const LOW_STOCK_THRESHOLD = 5;

const coerceMoney = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const mapRawShopOrder = (raw: any): ShopOrderRow => {
  const orderId = String(raw?.orderId ?? raw?.orderNumber ?? raw?.order_number ?? raw?.id ?? '').replace(
    /^order:/,
    '',
  );
  return {
    id: String(raw?.id ?? raw?.order_id ?? orderId),
    orderId: orderId || String(raw?.id ?? ''),
    status: String(raw?.status ?? 'pending').toLowerCase(),
    totalAmount: coerceMoney(raw?.totalAmount ?? raw?.finalTotal ?? raw?.totalPrice ?? raw?.total),
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? ''),
    shopId: raw?.shopId != null ? String(raw.shopId) : raw?.shop_id != null ? String(raw.shop_id) : undefined,
    shopName: String(raw?.shopName ?? raw?.shop_name ?? '').trim() || undefined,
    paymentStatus: String(raw?.paymentStatus ?? raw?.payment_status ?? 'pending').toLowerCase(),
  };
};

function mergeBranchShopOrders(kvList: any[], v2List: any[]): ShopOrderRow[] {
  const byId = new Map<string, ShopOrderRow>();
  for (const raw of v2List) {
    const o = mapRawShopOrder(raw);
    const key = String(o.id || '').trim();
    if (key) byId.set(key, o);
  }
  for (const raw of kvList) {
    const o = mapRawShopOrder(raw);
    const key = String(o.id || '').trim();
    if (!key) continue;
    const prev = byId.get(key);
    if (!prev) {
      byId.set(key, o);
      continue;
    }
    const merged = { ...prev, ...o };
    if (prev.paymentStatus === 'paid' || o.paymentStatus === 'paid') merged.paymentStatus = 'paid';
    else if (o.paymentStatus === 'failed' || prev.paymentStatus === 'failed') merged.paymentStatus = 'failed';
    else merged.paymentStatus = o.paymentStatus !== 'pending' ? o.paymentStatus : prev.paymentStatus;
    byId.set(key, merged);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
}

export default function ShopView({ branchId }: ShopViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeTab, setActiveTab] = useState('products');
  const [shops, setShops] = useState<any[]>([]);
  const [shopProducts, setShopProducts] = useState<any[]>([]);
  const [shopOrders, setShopOrders] = useState<ShopOrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<any | null>(null);
  const [deliveryTimeOptions, setDeliveryTimeOptions] = useState<any[]>([]);
  const [isLoadingDeliveryOptions, setIsLoadingDeliveryOptions] = useState(true);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryShopFilter, setInventoryShopFilter] = useState<string>('all');

  const tabs = [
    { id: 'products', label: 'Mahsulotlar', icon: Package },
    { id: 'shops', label: 'Do\'konlar', icon: Store },
    { id: 'inventory', label: 'Ombor', icon: Warehouse },
    { id: 'statistics', label: 'Statistika', icon: BarChart3 },
  ];

  useEffect(() => {
    void loadDeliveryOptions();
  }, []);

  const fetchBranchShops = useCallback(async () => {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops`,
      {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      },
    );
    if (!response.ok) throw new Error('Do‘konlar ro‘yxati yuklanmadi');
    const data = await response.json();
    const branchShops = (data.shops || []).filter((s: any) =>
      branchIdsEqual(s?.branchId, branchId),
    );
    return branchShops;
  }, [branchId]);

  const fetchAllBranchShopProducts = useCallback(
    async (branchShops: any[]) => {
      const allProducts: any[] = [];
      for (const shop of branchShops) {
        const productsResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops/${shop.id}/products`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        if (!productsResponse.ok) continue;
        const productsData = await productsResponse.json();
        const list = productsData.products || [];
        for (const p of list) {
          allProducts.push({
            ...p,
            shopId: shop.id,
            shopName: shop.name,
            shopLogo: shop.logo,
          });
        }
      }
      return allProducts;
    },
    [],
  );

  const loadShopOrders = useCallback(async () => {
    const b = encodeURIComponent(branchId);
    const branchHeaders = buildBranchHeaders({ 'Content-Type': 'application/json' });
    const [kvRes, v2Res] = await Promise.all([
      fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/branch?branchId=${b}&type=shop`,
        { headers: branchHeaders },
      ),
      fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/v2/branch/orders?branchId=${b}&type=shop&limit=200`,
        { headers: branchHeaders },
      ),
    ]);
    const kvData = await kvRes.json().catch(() => ({}));
    const v2Data = await v2Res.json().catch(() => ({}));
    const kvList = kvData?.success && Array.isArray(kvData.orders) ? kvData.orders : [];
    const v2List = v2Data?.success && Array.isArray(v2Data.orders) ? v2Data.orders : [];
    let merged = mergeBranchShopOrders(kvList, v2List);
    merged = merged.filter((o) => String(o.id || o.orderId).trim() !== '');
    return merged;
  }, [branchId]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const needsCatalog = ['shops', 'products', 'inventory', 'statistics'].includes(activeTab);
      const needsProducts = ['products', 'inventory'].includes(activeTab);

      if (needsCatalog) {
        const branchShops = await fetchBranchShops();
        setShops(branchShops);

        if (needsProducts) {
          const allProducts = await fetchAllBranchShopProducts(branchShops);
          setShopProducts(allProducts);
        } else {
          setShopProducts([]);
        }
      }

      if (activeTab === 'statistics') {
        try {
          const orders = await loadShopOrders();
          setShopOrders(orders);
        } catch (e) {
          console.error(e);
          setShopOrders([]);
          toast.error('Do‘kon buyurtma statistikasi yuklanmadi (filial sessiyasini tekshiring)');
        }
      } else {
        setShopOrders([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Ma\'lumotlar yuklanmadi');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, fetchBranchShops, fetchAllBranchShopProducts, loadShopOrders]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadDeliveryOptions = async () => {
    try {
      setIsLoadingDeliveryOptions(true);
      console.log('⏰ Loading delivery options...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-options`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Yetkazib berish vaqtlarini yuklab bo\'lmadi');
      }

      const data = await response.json();
      if (data.success) {
        setDeliveryTimeOptions(Array.isArray(data.data) ? data.data : []);
        console.log('✅ Delivery options loaded from API');
      } else {
        throw new Error(data.error || 'Yetkazib berish vaqtlari olinmadi');
      }
    } catch (error) {
      console.error('❌ Error loading delivery options:', error);
      setDeliveryTimeOptions([]);
      toast.error('Yetkazib berish vaqtlarini yuklab bo\'lmadi');
    } finally {
      setIsLoadingDeliveryOptions(false);
    }
  };

  useVisibilityRefetch(() => {
    void loadData();
    void loadDeliveryOptions();
  });

  type InvRow = {
    key: string;
    shopId: string;
    shopName: string;
    productId: string;
    productName: string;
    variantLabel: string;
    stock: number;
    price: number;
    thumb?: string;
  };

  const inventoryRows = useMemo((): InvRow[] => {
    const rows: InvRow[] = [];
    for (const p of shopProducts) {
      const variants = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : null;
      if (variants) {
        for (const v of variants) {
          const stock = getVariantStockQuantity(v, p);
          rows.push({
            key: `${p.id}-${String((v as Record<string, unknown>).id ?? (v as Record<string, unknown>).sku ?? 'v')}`,
            shopId: String(p.shopId ?? ''),
            shopName: String(p.shopName ?? '—'),
            productId: String(p.id),
            productName: String(p.name ?? 'Mahsulot'),
            variantLabel: String((v as Record<string, unknown>).name ?? 'Variant'),
            stock,
            price: Number((v as Record<string, unknown>).price ?? p.price ?? 0) || 0,
            thumb:
              (Array.isArray((v as { images?: unknown }).images) ? String((v as { images: string[] }).images[0] || '') : '') ||
              (typeof p.image === 'string' ? p.image : ''),
          });
        }
      } else {
        rows.push({
          key: `${p.id}-default`,
          shopId: String(p.shopId ?? ''),
          shopName: String(p.shopName ?? '—'),
          productId: String(p.id),
          productName: String(p.name ?? 'Mahsulot'),
          variantLabel: 'Asosiy',
          stock: getEffectiveProductStockQuantity(p),
          price: Number(p.price ?? 0) || 0,
          thumb: p.image,
        });
      }
    }
    return rows;
  }, [shopProducts]);

  const filteredInventoryRows = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    return inventoryRows.filter((r) => {
      if (inventoryShopFilter !== 'all' && r.shopId !== inventoryShopFilter) return false;
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        r.variantLabel.toLowerCase().includes(q) ||
        r.shopName.toLowerCase().includes(q)
      );
    });
  }, [inventoryRows, inventorySearch, inventoryShopFilter]);

  const inventorySummary = useMemo(() => {
    let totalUnits = 0;
    let lowStock = 0;
    let skuCount = inventoryRows.length;
    for (const r of inventoryRows) {
      totalUnits += Math.max(0, r.stock);
      if (r.stock > 0 && r.stock <= LOW_STOCK_THRESHOLD) lowStock++;
    }
    return { totalUnits, lowStock, skuCount, productCount: shopProducts.length };
  }, [inventoryRows, shopProducts.length]);

  const orderStats = useMemo(() => {
    const list = shopOrders;
    const isCancelled = (s: string) => s === 'cancelled' || s === 'canceled';
    const activeStatuses = new Set(['confirmed', 'preparing', 'ready', 'delivering']);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = Date.now() - 7 * 86400000;
    let today = 0;
    let week = 0;
    let pending = 0;
    let delivered = 0;
    let cancelled = 0;
    let activeCount = 0;
    let revenue = 0;
    for (const o of list) {
      const t = new Date(o.createdAt).getTime();
      if (Number.isFinite(t) && t >= startOfToday.getTime()) today++;
      if (Number.isFinite(t) && t >= weekAgo) week++;
      if (o.status === 'new' || o.status === 'pending') pending++;
      if (activeStatuses.has(o.status)) activeCount++;
      if (o.status === 'delivered') {
        delivered++;
        revenue += o.totalAmount;
      }
      if (isCancelled(o.status)) cancelled++;
    }
    return {
      total: list.length,
      today,
      week,
      pending,
      active: activeCount,
      delivered,
      cancelled,
      revenue,
    };
  }, [shopOrders]);

  const shopDeliveredBreakdown = useMemo(() => {
    const m = new Map<string, { orders: number; revenue: number }>();
    for (const o of shopOrders) {
      if (o.status !== 'delivered') continue;
      const label = o.shopName?.trim() || "Do'kon";
      const cur = m.get(label) || { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += o.totalAmount;
      m.set(label, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [shopOrders]);

  const statusUz = (s: string) => {
    const x = String(s || '').toLowerCase();
    const map: Record<string, string> = {
      new: 'Yangi',
      pending: 'Yangi',
      confirmed: 'Tasdiqlandi',
      preparing: 'Tayyorlanmoqda',
      ready: 'Tayyor',
      delivering: 'Yetkazilmoqda',
      delivered: 'Yetkazildi',
      cancelled: 'Bekor',
      canceled: 'Bekor',
    };
    return map[x] || s || '—';
  };

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Bu do\'konni o\'chirishni tasdiqlaysizmi?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops/${shopId}`,
        {
          method: 'DELETE',
          headers: buildAdminHeaders(),
        }
      );

      if (response.ok) {
        toast.success('Do\'kon o\'chirildi');
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error deleting shop:', error);
      toast.error('Do\'konni o\'chirishda xatolik');
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6">
        <div 
          className="inline-flex gap-2 p-2 rounded-2xl"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2"
                style={{
                  background: isActive ? accentColor.color : 'transparent',
                  color: isActive ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" 
            style={{ borderColor: `${accentColor.color}40`, borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <>
          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {shopProducts.length === 0 ? (
                <div 
                  className="p-12 rounded-3xl border text-center"
                  style={{
                    background: isDark 
                      ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Package className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                  <h3 className="text-lg font-bold mb-2">Mahsulotlar yo'q</h3>
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Do'konlar mahsulot qo'shganlarida bu yerda ko'rinadi
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {shopProducts.map((product: any) => (
                    <div
                      key={product.id}
                      className="rounded-2xl border overflow-hidden"
                      style={{
                        background: isDark 
                          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      {/* Product Image from first variant */}
                      {product.variants?.[0]?.images?.[0] && (
                        <img 
                          src={product.variants[0].images[0]} 
                          alt={product.name}
                          className="w-full h-48 object-cover"
                        />
                      )}
                      
                      <div className="p-4">
                        {/* Shop Info */}
                        <div className="flex items-center gap-2 mb-3">
                          {product.shopLogo && (
                            <img 
                              src={product.shopLogo} 
                              alt={product.shopName}
                              className="w-6 h-6 rounded-lg object-cover"
                            />
                          )}
                          <span className="text-xs font-medium" style={{ color: accentColor.color }}>
                            {product.shopName}
                          </span>
                        </div>

                        <h4 className="font-bold text-lg mb-2">{product.name}</h4>
                        
                        {product.description && (
                          <p 
                            className="text-sm mb-3 line-clamp-2" 
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                          >
                            {product.description}
                          </p>
                        )}

                        {/* Variants */}
                        {product.variants && product.variants.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                              Variantlar ({product.variants.length})
                            </p>
                            {product.variants.slice(0, 2).map((variant: any, index: number) => (
                              <div 
                                key={variant.id}
                                className="p-3 rounded-xl"
                                style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)' }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">{variant.name}</span>
                                  <div className="flex items-center gap-2">
                                    {variant.oldPrice > 0 && (
                                      <span 
                                        className="text-xs line-through"
                                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                                      >
                                        {variant.oldPrice.toLocaleString()} so'm
                                      </span>
                                    )}
                                    <span className="text-sm font-bold" style={{ color: accentColor.color }}>
                                      {variant.price.toLocaleString()} so'm
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                    Omborda: {getVariantStockQuantity(variant, product)} ta
                                  </span>
                                  {variant.discount > 0 && (
                                    <span 
                                      className="px-2 py-0.5 rounded-lg font-medium"
                                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                                    >
                                      -{variant.discount}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {product.variants.length > 2 && (
                              <p className="text-xs text-center" style={{ color: accentColor.color }}>
                                +{product.variants.length - 2} variantlar
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shops Tab */}
          {activeTab === 'shops' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Do'konlar ro'yxati</h3>
                <button
                  onClick={() => {
                    setEditingShop(null);
                    setShopModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl font-medium flex items-center gap-2"
                  style={{ background: accentColor.color, color: '#ffffff' }}
                >
                  <Plus className="w-4 h-4" />
                  Do'kon qo'shish
                </button>
              </div>

              {shops.length === 0 ? (
                <div 
                  className="p-12 rounded-3xl border text-center"
                  style={{
                    background: isDark 
                      ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Store className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                  <h3 className="text-lg font-bold mb-2">Do'konlar yo'q</h3>
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Yangi do'kon qo'shish uchun yuqoridagi tugmani bosing
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {shops.map((shop: any) => (
                    <div
                      key={shop.id}
                      className="rounded-2xl border overflow-hidden"
                      style={{
                        background: isDark 
                          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      {/* Banner/Logo */}
                      {shop.banner ? (
                        <div className="relative">
                          <img 
                            src={shop.banner} 
                            alt={shop.name}
                            className="w-full h-32 object-cover"
                          />
                          {shop.logo && (
                            <div 
                              className="absolute bottom-2 left-2 w-16 h-16 rounded-xl border-4 overflow-hidden"
                              style={{ borderColor: isDark ? '#1a1a1a' : '#ffffff' }}
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
                          className="w-full h-32 object-cover"
                        />
                      ) : (
                        <div 
                          className="w-full h-32 flex items-center justify-center"
                          style={{ background: `${accentColor.color}20` }}
                        >
                          <Store className="w-12 h-12" style={{ color: accentColor.color }} />
                        </div>
                      )}

                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h4 className="font-bold text-lg mb-1">{shop.name}</h4>
                            {shop.description && (
                              <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                {shop.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          {shop.phone && (
                            <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                              📞 {shop.phone}
                            </p>
                          )}
                          {shop.address && (
                            <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                              📍 {shop.address}
                            </p>
                          )}
                          {shop.workingHours && (
                            <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                              🕐 {shop.workingHours}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 pt-4 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                          <div className="flex-1 text-center">
                            <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                              Mahsulotlar
                            </p>
                            <p className="font-bold" style={{ color: accentColor.color }}>
                              {shop.productsCount || 0}
                            </p>
                          </div>
                          <div className="flex-1 text-center">
                            <p className="text-xs mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                              Xizmatlar
                            </p>
                            <p className="font-bold" style={{ color: accentColor.color }}>
                              {shop.servicesCount || 0}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingShop(shop);
                              setShopModalOpen(true);
                            }}
                            className="flex-1 px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                            style={{
                              background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)',
                              color: '#3b82f6',
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                            Tahrirlash
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShop(shop.id)}
                            className="flex-1 px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                            style={{ background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                          >
                            <Trash2 className="w-4 h-4" />
                            O'chirish
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inventory Tab — barcha do‘konlar variantlari bo‘yicha real zaxira */}
          {activeTab === 'inventory' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">Ombor ko‘rinishi</h3>
                  <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                    Sotuvchi panelidagi zaxira bilan sinxron (API orqali)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shrink-0"
                  style={{
                    background: accentColor.gradient,
                    color: '#fff',
                    boxShadow: `0 8px 24px ${accentColor.color}44`,
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Yangilash
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  {
                    label: 'Mahsulotlar',
                    value: inventorySummary.productCount,
                    icon: Package,
                    sub: 'pozitsiya',
                  },
                  {
                    label: 'SKU (variant)',
                    value: inventorySummary.skuCount,
                    icon: ShoppingBag,
                    sub: 'qator',
                  },
                  {
                    label: 'Jami dona',
                    value: inventorySummary.totalUnits,
                    icon: Warehouse,
                    sub: 'omborda',
                  },
                  {
                    label: 'Kam qoldiq',
                    value: inventorySummary.lowStock,
                    icon: AlertTriangle,
                    sub: `≤ ${LOW_STOCK_THRESHOLD} ta`,
                    warn: inventorySummary.lowStock > 0,
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="p-4 sm:p-5 rounded-2xl border transition-transform sm:hover:scale-[1.02]"
                      style={{
                        background: isDark
                          ? 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
                          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                        borderColor: card.warn
                          ? 'rgba(245, 158, 11, 0.45)'
                          : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon
                          className="w-7 h-7"
                          style={{ color: card.warn ? '#f59e0b' : accentColor.color }}
                        />
                      </div>
                      <p className="text-2xl font-bold tabular-nums">{card.value.toLocaleString()}</p>
                      <p className="text-sm font-semibold mt-0.5">{card.label}</p>
                      <p className="text-xs mt-0.5" style={{ opacity: 0.6 }}>
                        {card.sub}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}
                  />
                  <input
                    type="search"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Mahsulot, variant yoki do‘kon bo‘yicha qidiruv..."
                    className="w-full pl-11 pr-4 py-3 rounded-xl border outline-none text-sm"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                      color: isDark ? '#fff' : '#111',
                    }}
                  />
                </div>
                <select
                  value={inventoryShopFilter}
                  onChange={(e) => setInventoryShopFilter(e.target.value)}
                  className="lg:w-56 px-4 py-3 rounded-xl border outline-none text-sm font-medium"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                    color: isDark ? '#fff' : '#111',
                  }}
                >
                  <option value="all">Barcha do‘konlar</option>
                  {shops.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.id}
                    </option>
                  ))}
                </select>
              </div>

              {filteredInventoryRows.length === 0 ? (
                <div
                  className="p-12 rounded-3xl border text-center"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Warehouse className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                  <h3 className="text-lg font-bold mb-2">Ombor bo‘sh yoki filtr mos emas</h3>
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Do‘konlarda mahsulot va variantlar paydo bo‘lganda shu yerda jadval ko‘rinadi
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                  }}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          }}
                        >
                          <th className="text-left p-3 font-bold">Mahsulot</th>
                          <th className="text-left p-3 font-bold">Variant</th>
                          <th className="text-left p-3 font-bold">Do‘kon</th>
                          <th className="text-right p-3 font-bold">Narx</th>
                          <th className="text-right p-3 font-bold">Zaxira</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventoryRows.map((r) => (
                          <tr
                            key={r.key}
                            className="border-t"
                            style={{
                              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            }}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {r.thumb ? (
                                  <img
                                    src={r.thumb}
                                    alt=""
                                    className="w-11 h-11 rounded-lg object-cover shrink-0 bg-black/5"
                                  />
                                ) : (
                                  <div
                                    className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center"
                                    style={{ background: `${accentColor.color}18` }}
                                  >
                                    <Package className="w-5 h-5" style={{ color: accentColor.color }} />
                                  </div>
                                )}
                                <span className="font-semibold truncate">{r.productName}</span>
                              </div>
                            </td>
                            <td className="p-3" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#111' }}>
                              {r.variantLabel}
                            </td>
                            <td className="p-3">
                              <span
                                className="inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold"
                                style={{
                                  background: `${accentColor.color}22`,
                                  color: accentColor.color,
                                }}
                              >
                                {r.shopName}
                              </span>
                            </td>
                            <td className="p-3 text-right font-medium tabular-nums">
                              {r.price.toLocaleString()} so‘m
                            </td>
                            <td className="p-3 text-right">
                              <span
                                className="inline-flex min-w-[3rem] justify-end font-bold tabular-nums px-2 py-1 rounded-lg"
                                style={{
                                  background:
                                    r.stock <= LOW_STOCK_THRESHOLD
                                      ? isDark
                                        ? 'rgba(245, 158, 11, 0.2)'
                                        : 'rgba(245, 158, 11, 0.15)'
                                      : isDark
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : 'rgba(16, 185, 129, 0.12)',
                                  color:
                                    r.stock <= LOW_STOCK_THRESHOLD
                                      ? isDark
                                        ? '#fcd34d'
                                        : '#b45309'
                                      : '#10b981',
                                }}
                              >
                                {r.stock} ta
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Statistics — filial do‘kon buyurtmalari (KV + v2) */}
          {activeTab === 'statistics' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">Do‘kon buyurtmalari statistikasi</h3>
                  <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                    Filial sessiyasi bilan `/orders/branch` va `v2/branch/orders` (type=shop) — real ma’lumot
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shrink-0"
                  style={{
                    background: accentColor.gradient,
                    color: '#fff',
                    boxShadow: `0 8px 24px ${accentColor.color}44`,
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Yangilash
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: 'Jami buyurtma', value: orderStats.total, icon: ShoppingBag },
                  { label: 'Bugun', value: orderStats.today, icon: TrendingUp },
                  { label: '7 kun', value: orderStats.week, icon: BarChart3 },
                  { label: 'Yetkazildi', value: orderStats.delivered, icon: Package },
                  { label: 'Jarayonda', value: orderStats.active, icon: Warehouse },
                  { label: 'Yangi', value: orderStats.pending, icon: AlertTriangle },
                  { label: 'Bekor', value: orderStats.cancelled, icon: XCircle },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="p-4 sm:p-5 rounded-2xl border"
                      style={{
                        background: isDark
                          ? 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
                          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <Icon className="w-6 h-6 mb-2" style={{ color: accentColor.color }} />
                      <p className="font-bold tabular-nums text-2xl">{card.value.toLocaleString()}</p>
                      <p className="text-sm font-semibold mt-1" style={{ opacity: 0.85 }}>
                        {card.label}
                      </p>
                    </div>
                  );
                })}
                <div
                  className="col-span-full p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor.color}18, ${accentColor.color}08)`,
                    borderColor: `${accentColor.color}40`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-8 h-8 shrink-0" style={{ color: accentColor.color }} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Tushum (faqat yetkazilgan)</p>
                      <p className="text-xl sm:text-2xl font-bold tabular-nums">
                        {Math.round(orderStats.revenue).toLocaleString()} so‘m
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {shopDeliveredBreakdown.length > 0 && (
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <Store className="w-5 h-5" style={{ color: accentColor.color }} />
                    Do‘kon bo‘yicha yetkazilgan (tushum)
                  </h4>
                  <ul className="space-y-2">
                    {shopDeliveredBreakdown.slice(0, 8).map(([name, { orders, revenue }]) => (
                      <li
                        key={name}
                        className="flex items-center justify-between gap-3 text-sm py-2 border-b last:border-0"
                        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                      >
                        <span className="font-medium truncate">{name}</span>
                        <span className="shrink-0 tabular-nums" style={{ opacity: 0.8 }}>
                          {orders} ta · {Math.round(revenue).toLocaleString()} so‘m
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div
                className="rounded-2xl border overflow-hidden"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                }}
              >
                <div className="px-4 py-3 font-bold border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  So‘nggi buyurtmalar (20)
                </div>
                {shopOrders.length === 0 ? (
                  <div className="p-10 text-center text-sm" style={{ opacity: 0.65 }}>
                    Hozircha do‘kon buyurtmalari yo‘q yoki filial token bilan yuklanmadi. «Do‘kon buyurtmalar» bo‘limini
                    ham tekshiring.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                          <th className="text-left p-3 font-bold">№</th>
                          <th className="text-left p-3 font-bold">Sana</th>
                          <th className="text-left p-3 font-bold">Holat</th>
                          <th className="text-left p-3 font-bold">To‘lov</th>
                          <th className="text-right p-3 font-bold">Summa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopOrders.slice(0, 20).map((o, idx) => (
                          <tr
                            key={`${o.id}-${o.orderId}-${idx}`}
                            className="border-t"
                            style={{
                              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            }}
                          >
                            <td className="p-3 font-semibold">#{o.orderId || o.id}</td>
                            <td className="p-3 tabular-nums" style={{ opacity: 0.85 }}>
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleString('uz-UZ', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </td>
                            <td className="p-3">{statusUz(o.status)}</td>
                            <td className="p-3 capitalize" style={{ opacity: 0.85 }}>
                              {o.paymentStatus || '—'}
                            </td>
                            <td className="p-3 text-right font-semibold tabular-nums">
                              {Math.round(o.totalAmount).toLocaleString()} so‘m
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {shopModalOpen && (
        <AddShopModal
          key={editingShop?.id ?? 'new-shop'}
          branchId={branchId}
          editingShop={editingShop}
          deliveryTimeOptions={deliveryTimeOptions}
          isLoadingDeliveryOptions={isLoadingDeliveryOptions}
          onClose={() => {
            setShopModalOpen(false);
            setEditingShop(null);
          }}
          onSuccess={() => {
            setShopModalOpen(false);
            setEditingShop(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Add Shop Modal Component
function AddShopModal({
  branchId,
  editingShop,
  deliveryTimeOptions,
  isLoadingDeliveryOptions,
  onClose,
  onSuccess,
}: {
  branchId: string;
  editingShop?: any | null;
  deliveryTimeOptions: Array<{ value: string; label: string }>;
  isLoadingDeliveryOptions: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isEdit = Boolean(editingShop?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    workingHours: '',
    region: '',
    district: '',
    services: [] as string[],
    delivery: false,
    deliveryTime: '30', // in minutes
    minOrder: 0,
    login: '',
    password: '',
    logo: '',
    banner: '',
    // Do'kon uchun to'lov QR rasm (kassa tasdiqlashda ishlatiladi)
    paymentQrImage: '',
    telegramChatId: '', // Telegram chat ID for order notifications
  });

  const [serviceInput, setServiceInput] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingPaymentQr, setUploadingPaymentQr] = useState(false);

  useEffect(() => {
    if (editingShop?.id) {
      setFormData({
        name: editingShop.name || '',
        description: editingShop.description || '',
        phone: editingShop.phone || '',
        address: editingShop.address || '',
        workingHours: editingShop.workingHours || '',
        region: editingShop.region || '',
        district: editingShop.district || '',
        services: Array.isArray(editingShop.services) ? [...editingShop.services] : [],
        delivery: Boolean(editingShop.delivery),
        deliveryTime: String(editingShop.deliveryTime ?? '30'),
        minOrder: Number(editingShop.minOrder ?? 0),
        login: editingShop.login || '',
        password: '',
        logo: editingShop.logo || '',
        banner: editingShop.banner || '',
        paymentQrImage: editingShop.paymentQrImage || '',
        telegramChatId: String(editingShop.telegramChatId ?? '').trim(),
      });
    }
    setServiceInput('');
  }, [editingShop]);

  const handleImageUpload = async (file: File, type: 'logo' | 'banner') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayllarini yuklash mumkin');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Rasm hajmi 10MB dan oshmasligi kerak');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const setLoading = type === 'logo' ? setUploadingLogo : setUploadingBanner;
    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, [type]: data.url }));
        toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} yuklandi!`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Yuklashda xatolik');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Rasmni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentQrUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayllarini yuklash mumkin');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Rasm hajmi 10MB dan oshmasligi kerak');
      return;
    }

    setUploadingPaymentQr(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/public/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: uploadFormData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, paymentQrImage: data.url }));
        toast.success('To\'lov QR yuklandi!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Yuklashda xatolik');
      }
    } catch (error) {
      console.error('Payment QR upload error:', error);
      toast.error('QR ni yuklashda xatolik');
    } finally {
      setUploadingPaymentQr(false);
    }
  };

  const handleAddService = () => {
    if (serviceInput.trim()) {
      setFormData(prev => ({
        ...prev,
        services: [...prev.services, serviceInput.trim()]
      }));
      setServiceInput('');
    }
  };

  const handleRemoveService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim() || !formData.login?.trim()) {
      toast.error('Do\'kon nomi va login majburiy!');
      return;
    }
    if (!isEdit && !formData.password?.trim()) {
      toast.error('Yangi do\'kon uchun parol majburiy!');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEdit && editingShop?.id) {
        const updateBody: Record<string, unknown> = {
          name: formData.name.trim(),
          description: formData.description || '',
          phone: formData.phone || '',
          address: formData.address || '',
          workingHours: formData.workingHours || '',
          region: formData.region || '',
          district: formData.district || '',
          services: formData.services,
          delivery: formData.delivery,
          deliveryTime: formData.deliveryTime,
          minOrder: formData.minOrder,
          login: formData.login.trim(),
          logo: formData.logo || '',
          banner: formData.banner || '',
          paymentQrImage: formData.paymentQrImage || '',
          telegramChatId: String(formData.telegramChatId ?? '').trim(),
        };
        if (formData.password.trim()) {
          updateBody.password = formData.password;
        }

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops/${encodeURIComponent(editingShop.id)}`,
          {
            method: 'PUT',
            headers: buildAdminHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(updateBody),
          }
        );

        if (response.ok) {
          toast.success('Do\'kon yangilandi!');
          onSuccess();
        } else {
          const error = await response.json();
          toast.error(error.error || 'Xatolik yuz berdi');
        }
      } else {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops`,
          {
            method: 'POST',
            headers: buildAdminHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
              ...formData,
              branchId,
            }),
          }
        );

        if (response.ok) {
          toast.success('Do\'kon qo\'shildi!');
          onSuccess();
        } else {
          const error = await response.json();
          toast.error(error.error || 'Xatolik yuz berdi');
        }
      }
    } catch (error) {
      console.error('Shop save error:', error);
      toast.error(isEdit ? 'Do\'konni saqlashda xatolik' : 'Do\'kon qo\'shishda xatolik');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0, 0, 0, 0.7)' }}>
      <div 
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6"
        style={{
          background: isDark ? '#1a1a1a' : '#ffffff',
        }}
      >
        <h2 className="text-2xl font-bold mb-6">
          {isEdit ? 'Do\'konni tahrirlash' : 'Yangi do\'kon qo\'shish'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Do'kon nomi *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Tavsif</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
              rows={3}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-2">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
              placeholder="+998 90 123 45 67"
            />
          </div>

          {/* Telegram Chat ID */}
          <div>
            <label className="block text-sm font-medium mb-2">
              📱 Telegram Chat ID
              <span className="text-xs ml-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                (Buyurtma bildirishnomalari uchun)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.telegramChatId}
                onChange={(e) => setFormData(prev => ({ ...prev, telegramChatId: e.target.value }))}
                className="flex-1 px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                placeholder="1234567890"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!formData.telegramChatId) {
                    toast.error('Chat ID kiriting!');
                    return;
                  }
                  
                  try {
                    const response = await fetch(
                      `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/test-telegram`,
                      {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${publicAnonKey}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ chatId: formData.telegramChatId }),
                      }
                    );

                    if (response.ok) {
                      toast.success('Test xabari yuborildi! Telegramni tekshiring.');
                    } else {
                      const error = await response.json();
                      toast.error(error.error || 'Xatolik yuz berdi');
                    }
                  } catch (error) {
                    console.error('Test error:', error);
                    toast.error('Test xatosi');
                  }
                }}
                className="px-4 py-3 rounded-xl font-medium flex items-center gap-2 whitespace-nowrap"
                style={{ background: `${accentColor.color}20`, color: accentColor.color }}
              >
                <Send className="w-4 h-4" />
                Test
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
              💡 Chat ID olish: @userinfobot ga /start yuboring
            </p>
          </div>

          {/* Address & Working Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Manzil</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Ish vaqti</label>
              <input
                type="text"
                value={formData.workingHours}
                onChange={(e) => setFormData(prev => ({ ...prev, workingHours: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                placeholder="9:00 - 18:00"
              />
            </div>
          </div>

          {/* Region & District */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Viloyat *</label>
              <select
                value={formData.region}
                onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value, district: '' }))}
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                required
              >
                <option value="">Viloyatni tanlang</option>
                {regions.map(region => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tuman *</label>
              <select
                value={formData.district}
                onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                disabled={!formData.region}
                required
              >
                <option value="">Tumanni tanlang</option>
                {formData.region && regions.find(r => r.id === formData.region)?.districts.map(district => (
                  <option key={district.id} value={district.id}>{district.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Services */}
          <div>
            <label className="block text-sm font-medium mb-2">Xizmatlar</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddService())}
                className="flex-1 px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                placeholder="Xizmat nomini kiriting"
              />
              <button
                type="button"
                onClick={handleAddService}
                className="px-4 py-3 rounded-xl font-medium"
                style={{ background: accentColor.color, color: '#ffffff' }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {formData.services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.services.map((service, index) => (
                  <div 
                    key={index}
                    className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm"
                    style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                  >
                    {service}
                    <button
                      type="button"
                      onClick={() => handleRemoveService(index)}
                      className="hover:opacity-70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery & Min Order */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.delivery}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery: e.target.checked }))}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm font-medium">Yetkazib berish</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Minimal buyurtma</label>
              <input
                type="number"
                value={formData.minOrder}
                onChange={(e) => setFormData(prev => ({ ...prev, minOrder: Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                min="0"
              />
            </div>
          </div>

          {/* Delivery Time */}
          {formData.delivery && (
            <div>
              <label className="block text-sm font-medium mb-2">Yetkazib berish vaqti *</label>
              <select
                value={formData.deliveryTime}
                onChange={(e) => setFormData(prev => ({ ...prev, deliveryTime: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                required
              >
                {isLoadingDeliveryOptions && (
                  <option value="">Yuklanmoqda...</option>
                )}
                {!isLoadingDeliveryOptions && deliveryTimeOptions.length === 0 && (
                  <option value="">Variantlar topilmadi</option>
                )}
                {deliveryTimeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Login & Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Login *</label>
              <input
                type="text"
                value={formData.login}
                onChange={(e) => setFormData(prev => ({ ...prev, login: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Parol {isEdit ? '(yangilamasangiz bo\'sh qoldiring)' : '*'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
                required={!isEdit}
                autoComplete="new-password"
                placeholder={isEdit ? 'Yangi parol (ixtiyoriy)' : undefined}
              />
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Logo</label>
            <div 
              className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:opacity-80 transition-all"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              onClick={() => document.getElementById('logo-upload')?.click()}
            >
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, 'logo');
                }}
              />
              {uploadingLogo ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-4 border-t-transparent" 
                    style={{ borderColor: `${accentColor.color}40`, borderTopColor: 'transparent' }}
                  />
                  <span>Yuklanmoqda...</span>
                </div>
              ) : formData.logo ? (
                <div className="space-y-3">
                  <img 
                    src={formData.logo} 
                    alt="Logo" 
                    className="w-32 h-32 object-cover rounded-xl mx-auto"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, logo: '' }));
                    }}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                  >
                    O'chirish
                  </button>
                </div>
              ) : (
                <div>
                  <Image className="w-12 h-12 mx-auto mb-2" style={{ color: accentColor.color, opacity: 0.5 }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Logo rasmini yuklang
                  </p>
                  <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                    PNG, JPG (Max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Banner Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Banner</label>
            <div 
              className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:opacity-80 transition-all"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              onClick={() => document.getElementById('banner-upload')?.click()}
            >
              <input
                id="banner-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, 'banner');
                }}
              />
              {uploadingBanner ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-4 border-t-transparent" 
                    style={{ borderColor: `${accentColor.color}40`, borderTopColor: 'transparent' }}
                  />
                  <span>Yuklanmoqda...</span>
                </div>
              ) : formData.banner ? (
                <div className="space-y-3">
                  <img 
                    src={formData.banner} 
                    alt="Banner" 
                    className="w-full h-32 object-cover rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, banner: '' }));
                    }}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                  >
                    O'chirish
                  </button>
                </div>
              ) : (
                <div>
                  <Image className="w-12 h-12 mx-auto mb-2" style={{ color: accentColor.color, opacity: 0.5 }} />
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Banner rasmini yuklang
                  </p>
                  <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                    PNG, JPG (Max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment QR Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">To'lov QR kodi</label>
            <div
              className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:opacity-80 transition-all"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
              onClick={() => document.getElementById('payment-qr-upload')?.click()}
            >
              <input
                id="payment-qr-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePaymentQrUpload(file);
                }}
              />
              {uploadingPaymentQr ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-4 border-t-transparent"
                    style={{ borderColor: `${accentColor.color}40`, borderTopColor: 'transparent' }}
                  />
                  <span>Yuklanmoqda...</span>
                </div>
              ) : formData.paymentQrImage ? (
                <div className="space-y-3">
                  <img
                    src={formData.paymentQrImage}
                    alt="Payment QR"
                    className="w-32 h-32 object-contain rounded-xl mx-auto bg-white/5"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((prev) => ({ ...prev, paymentQrImage: '' }));
                    }}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                  >
                    O'chirish
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    To'lov QR rasmni yuklang
                  </p>
                  <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                    PNG, JPG (Max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 rounded-xl font-medium"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 rounded-xl font-medium"
              style={{ background: accentColor.color, color: '#ffffff' }}
            >
              {isSubmitting ? 'Yuklanmoqda...' : 'Qo\'shish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}