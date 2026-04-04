import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Warehouse, 
  CreditCard, 
  LogOut, 
  Menu as MenuIcon,
  X,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  Upload,
  Image as ImageIcon,
  Video,
  Save,
  Loader2,
  XCircle,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import AddProductModal from '../components/seller/AddProductModal';
import EditProductModal from '../components/seller/EditProductModal';
import SellerWarehousePanel, {
  type SellerInventoryLine,
  type SellerInventorySummary,
} from '../components/seller/SellerWarehousePanel';
import { deriveInventoryLinesFromProducts } from '../components/seller/sellerInventoryDerive';
import SellerPaymentsPanel from '../components/seller/SellerPaymentsPanel';
import {
  sellerOrderPaymentStatusNorm,
  sellerOrderTotal,
} from '../components/seller/sellerOrderPaymentUtils';

export default function SellerDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [inventoryLines, setInventoryLines] = useState<SellerInventoryLine[]>([]);
  const [inventorySummary, setInventorySummary] = useState<SellerInventorySummary | null>(null);
  const [inventoryLoadError, setInventoryLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderActionId, setOrderActionId] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'done' | 'cancelled'>('all');

  useEffect(() => {
    checkSession();
  }, [navigate]);

  useEffect(() => {
    if (sellerInfo) {
      loadData();
    }
  }, [activeTab, sellerInfo]);

  const checkSession = () => {
    const session = localStorage.getItem('sellerSession');
    if (!session) {
      navigate('/seller');
      return;
    }

    const sessionData = JSON.parse(session);
    console.log('🔐 Checking seller session:', sessionData);
    console.log('🔑 Token format:', sessionData.token ? sessionData.token.substring(0, 30) + '...' : 'MISSING');
    
    // Validate token format - NEW format: seller-{timestamp}-{random}
    // OLD format was: seller-shop-{shopId}-{timestamp}-{random}
    // Reject old format tokens (contains 'seller-shop-')
    if (!sessionData.token || !sessionData.token.startsWith('seller-') || sessionData.token.includes('seller-shop-')) {
      console.error('❌ Invalid or outdated token format, logging out');
      toast.error('Session muddati tugagan. Qaytadan kiring.');
      localStorage.removeItem('sellerSession');
      navigate('/seller');
      return;
    }
    
    // Additional validation: new tokens should have format seller-{number}-{string}
    const tokenParts = sessionData.token.split('-');
    if (tokenParts.length < 3 || tokenParts[0] !== 'seller') {
      console.error('❌ Invalid token structure, logging out');
      toast.error('Session noto\'g\'ri. Qaytadan kiring.');
      localStorage.removeItem('sellerSession');
      navigate('/seller');
      return;
    }
    
    console.log('✅ Token validation passed');
    setSellerInfo(sessionData);
  };

  const applyInventoryPayload = (data: any, productsFallback?: any[]) => {
    const items = data?.items;
    if (Array.isArray(items)) {
      setInventoryLines(items as SellerInventoryLine[]);
      setInventorySummary((data?.summary as SellerInventorySummary) ?? null);
      return;
    }
    const inv = data?.inventory;
    if (Array.isArray(inv) && inv.length > 0) {
      setInventoryLines(
        inv.map((row: any) => ({
          productId: String(row.id || ''),
          productName: String(row.name || 'Mahsulot'),
          variantId: '',
          variantIndex: 0,
          variantLabel: 'Asosiy',
          stock: Math.max(0, Math.floor(Number(row.stock) || 0)),
          price: Number(row.price) || 0,
          image: row.image || null,
          barcode: '',
        })),
      );
      const totalUnits = inv.reduce(
        (s: number, r: any) => s + Math.max(0, Math.floor(Number(r.stock) || 0)),
        0,
      );
      setInventorySummary({
        totalLines: inv.length,
        totalUnits,
        lowStockLines: inv.filter((r: any) => {
          const st = Math.max(0, Math.floor(Number(r.stock) || 0));
          return st > 0 && st <= 5;
        }).length,
        outOfStockLines: inv.filter((r: any) => Math.max(0, Math.floor(Number(r.stock) || 0)) <= 0)
          .length,
        lowStockThreshold: 5,
      });
      return;
    }
    if (productsFallback && productsFallback.length > 0) {
      const d = deriveInventoryLinesFromProducts(productsFallback);
      if (d.items.length > 0) {
        setInventoryLines(d.items);
        setInventorySummary(d.summary);
        return;
      }
    }
    setInventoryLines([]);
    setInventorySummary((data?.summary as SellerInventorySummary) ?? null);
  };

  const fetchSellerOrders = async (token: string) => {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/orders?token=${encodeURIComponent(token)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Seller-Token': token,
        },
      },
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.orders) ? data.orders : [];
  };

  const loadData = async () => {
    if (!sellerInfo) return;

    setIsLoading(true);
    try {
      const token = sellerInfo.token;
      const sellerHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
        'X-Seller-Token': token,
      } as const;

      if (activeTab === 'dashboard') {
        const ordersUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/orders?token=${encodeURIComponent(token)}`;
        const productsUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products?token=${encodeURIComponent(token)}`;
        const invUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/inventory?token=${encodeURIComponent(token)}`;
        const [rOrders, rProducts, rInv] = await Promise.all([
          fetch(ordersUrl, { headers: sellerHeaders }),
          fetch(productsUrl, { headers: sellerHeaders }),
          fetch(invUrl, { headers: sellerHeaders }),
        ]);
        if (rOrders.ok) {
          const d = await rOrders.json().catch(() => ({}));
          setOrders(Array.isArray(d.orders) ? d.orders : []);
        } else {
          setOrders([]);
        }
        let prodList: any[] = [];
        if (rProducts.ok) {
          const d = await rProducts.json().catch(() => ({}));
          prodList = Array.isArray(d.products) ? d.products : [];
          setProducts(prodList);
        }
        const dInv = await rInv.json().catch(() => ({}));
        if (rInv.ok) {
          setInventoryLoadError(null);
          applyInventoryPayload(dInv, prodList);
        } else {
          const msg = dInv.error || `Ombor: HTTP ${rInv.status}`;
          toast.error(msg);
          setInventoryLoadError(msg);
          applyInventoryPayload({}, prodList);
        }
        return;
      }

      if (activeTab === 'orders' || activeTab === 'payments') {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/orders?token=${encodeURIComponent(token)}`,
          { headers: sellerHeaders },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || `Buyurtmalar: HTTP ${res.status}`);
          setOrders([]);
          return;
        }
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        return;
      }

      if (activeTab === 'products') {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products?token=${encodeURIComponent(token)}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-Seller-Token': token,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
        }
      } else if (activeTab === 'inventory') {
        const invUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/inventory?token=${encodeURIComponent(token)}`;
        const prodUrl = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products?token=${encodeURIComponent(token)}`;
        const [rInv, rProd] = await Promise.all([
          fetch(invUrl, { headers: sellerHeaders }),
          fetch(prodUrl, { headers: sellerHeaders }),
        ]);
        let prodList = products;
        if (rProd.ok) {
          const dp = await rProd.json().catch(() => ({}));
          prodList = Array.isArray(dp.products) ? dp.products : products;
          setProducts(prodList);
        }
        const data = await rInv.json().catch(() => ({}));
        if (rInv.ok) {
          setInventoryLoadError(null);
          applyInventoryPayload(data, prodList);
        } else {
          const msg = data.error || `Ombor: HTTP ${rInv.status}`;
          toast.error(msg);
          setInventoryLoadError(msg);
          if (rInv.status === 401) {
            setInventoryLines([]);
            setInventorySummary(null);
          } else {
            applyInventoryPayload({}, prodList);
          }
        }
      } else if (activeTab === 'statistics') {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/statistics?token=${encodeURIComponent(token)}`,
          {
            headers: sellerHeaders,
          }
        );

        if (response.ok) {
          const data = await response.json();
          setStatistics(data.statistics || null);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Ma\'lumotlar yuklanmadi');
    } finally {
      setIsLoading(false);
    }
  };

  useVisibilityRefetch(() => {
    if (sellerInfo) void loadData();
  });

  const handleLogout = () => {
    localStorage.removeItem('sellerSession');
    navigate('/seller');
  };

  const orderCustomerName = (o: any) => String(o?.customerName || o?.customer?.name || 'Mijoz');
  const orderCustomerPhone = (o: any) => String(o?.customerPhone || o?.customer?.phone || '—');
  const orderAddress = (o: any) =>
    String(
      o?.addressText ||
        o?.customerAddress ||
        o?.customer?.address ||
        (typeof o?.address === 'object' && o?.address
          ? [o.address.street, o.address.building, o.address.apartment, o.address.note]
              .filter(Boolean)
              .join(', ')
          : o?.address) ||
        '—',
    );
  const orderItems = (o: any) => (Array.isArray(o?.items) ? o.items : []);
  const orderTotal = (o: any) =>
    Number(o?.finalTotal ?? o?.totalAmount ?? o?.totalPrice ?? 0) || 0;
  const orderLabel = (o: any) => String(o?.orderNumber || o?.id || '—');

  /** Seller ro‘yxatida holat — texnik `status` o‘rniga tushunarli o‘zbekcha matn */
  const sellerOrderStatusLabelUz = (raw: string) => {
    const s = String(raw || 'pending').toLowerCase().trim();
    if (s === 'pending' || s === 'new' || s === 'awaiting_payment') return 'Yangi';
    if (s === 'confirmed' || s === 'accepted') return 'Qabul qilindi';
    if (s === 'preparing') return 'Tayyorlanmoqda';
    if (s === 'ready') return 'Tayyor';
    if (s === 'delivering' || s === 'with_courier') return 'Yetkazilmoqda';
    if (s === 'delivered' || s === 'completed') return 'Yakunlangan';
    if (s === 'cancelled' || s === 'canceled') return 'Bekor qilingan';
    if (s === 'processing') return 'Jarayonda';
    return raw || '—';
  };

  const sellerOrderNormStatus = (o: any) => String(o?.status || 'pending').toLowerCase().trim();
  const isSellerOrderCancelled = (o: any) => {
    const s = sellerOrderNormStatus(o);
    return s === 'cancelled' || s === 'canceled';
  };
  const isSellerOrderDone = (o: any) => {
    const s = sellerOrderNormStatus(o);
    return s === 'delivered' || s === 'completed';
  };
  const isSellerOrderActive = (o: any) => !isSellerOrderCancelled(o) && !isSellerOrderDone(o);

  const sellerOrderCounts = useMemo(
    () => ({
      all: orders.length,
      active: orders.filter(isSellerOrderActive).length,
      done: orders.filter(isSellerOrderDone).length,
      cancelled: orders.filter(isSellerOrderCancelled).length,
    }),
    [orders],
  );

  const filteredSellerOrders = useMemo(() => {
    if (orderStatusFilter === 'all') return orders;
    if (orderStatusFilter === 'active') return orders.filter(isSellerOrderActive);
    if (orderStatusFilter === 'done') return orders.filter(isSellerOrderDone);
    return orders.filter(isSellerOrderCancelled);
  }, [orders, orderStatusFilter]);

  const handleSellerOrderStatus = async (orderId: string, status: string) => {
    if (!sellerInfo?.token) return;
    setOrderActionId(orderId);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
            'X-Seller-Token': sellerInfo.token,
          },
          body: JSON.stringify({ status }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Holatni yangilab bo‘lmadi');
        return;
      }
      toast.success('Buyurtma yangilandi');
      const list = await fetchSellerOrders(sellerInfo.token);
      setOrders(list);
    } catch (e) {
      console.error(e);
      toast.error('Xatolik');
    } finally {
      setOrderActionId(null);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Bu mahsulotni o\'chirishni tasdiqlaysizmi?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/seller/products/${productId}?token=${sellerInfo.token}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Seller-Token': sellerInfo.token,
          },
        }
      );

      if (response.ok) {
        toast.success('Mahsulot o\'chirildi');
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Mahsulotni o\'chirishda xatolik');
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Buyurtmalar', icon: ShoppingCart },
    { id: 'products', label: 'Mahsulotlar', icon: Package },
    { id: 'inventory', label: 'Ombor', icon: Warehouse },
    { id: 'payments', label: 'To\'lovlar', icon: CreditCard },
    { id: 'statistics', label: 'Statistika', icon: BarChart3 },
  ];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const ordersToday = orders.filter((o: any) => {
    const t = new Date(o?.createdAt || 0).getTime();
    return Number.isFinite(t) && t >= startOfToday.getTime();
  }).length;

  const todayPaidRevenue = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    let sum = 0;
    for (const o of orders) {
      const t = new Date((o as any)?.createdAt || 0).getTime();
      if (!Number.isFinite(t) || t < startMs) continue;
      if (sellerOrderPaymentStatusNorm(o) !== 'paid') continue;
      sum += sellerOrderTotal(o);
    }
    return sum;
  }, [orders]);

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827'
      }}
    >
      {/* Sidebar - Desktop */}
      <aside 
        className="hidden lg:block fixed left-0 top-0 h-full w-64 border-r overflow-y-auto"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="p-6">
          {/* Shop Info */}
          <div className="mb-8">
            <div 
              className="p-4 rounded-2xl mb-3"
              style={{ background: `${accentColor.color}20` }}
            >
              <h1 className="text-lg font-bold text-center mb-2" style={{ color: accentColor.color }}>
                {sellerInfo?.shopName || 'Do\'kon'}
              </h1>
              <p 
                className="text-xs text-center"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
              >
                Seller Panel
              </p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm"
                  style={{
                    background: isActive 
                      ? accentColor.gradient
                      : 'transparent',
                    color: isActive ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.8)' : '#111827'),
                  }}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSidebarOpen(false)}
        >
          <aside 
            className="absolute left-0 top-0 h-full w-64 border-r overflow-y-auto"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div 
                  className="p-2 rounded-xl"
                  style={{ background: `${accentColor.color}20` }}
                >
                  <h1 className="text-sm font-bold" style={{ color: accentColor.color }}>
                    {sellerInfo?.shopName}
                  </h1>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1.5">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm"
                      style={{
                        background: isActive 
                          ? accentColor.gradient
                          : 'transparent',
                        color: isActive ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.8)' : '#111827'),
                      }}
                    >
                      <Icon className="w-4.5 h-4.5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Chiqish</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:ml-64">
        {/* Header */}
        <header 
          className="border-b sticky top-0 z-40"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center justify-between p-4 lg:p-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              >
                <MenuIcon className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-xl lg:text-2xl font-bold">
                  {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h2>
                <p 
                  className="text-sm"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  {sellerInfo?.shopName}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl border transition-all active:scale-95"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">Chiqish</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" 
                style={{ borderColor: `${accentColor.color}40`, borderTopColor: 'transparent' }}
              />
            </div>
          ) : (
            <RouteErrorBoundary resetKeys={[activeTab]} embedded>
            <>
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Welcome */}
                  <div
                    className="p-8 rounded-3xl border"
                    style={{
                      background: isDark 
                        ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
                        : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
                      borderColor: `${accentColor.color}33`,
                    }}
                  >
                    <h3 className="text-2xl font-bold mb-2">
                      Xush kelibsiz! 👋
                    </h3>
                    <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      {sellerInfo?.shopName} seller paneliga muvaffaqiyatli kirdingiz
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {[
                      { label: 'Bugungi buyurtmalar', value: String(ordersToday), icon: ShoppingCart, color: '#14b8a6' },
                      { label: 'Bekor buyurtmalar', value: String(sellerOrderCounts.cancelled), icon: XCircle, color: '#ef4444' },
                      { label: 'Jami mahsulotlar', value: products.length.toString(), icon: Package, color: '#3b82f6' },
                      {
                        label: 'Ombordagi jami dona',
                        value: inventorySummary ? String(inventorySummary.totalUnits) : '0',
                        icon: Warehouse,
                        color: '#f59e0b',
                      },
                      {
                        label: "Bugungi to'langan (taxminiy)",
                        value: `${todayPaidRevenue.toLocaleString('uz-UZ')} so'm`,
                        icon: CreditCard,
                        color: '#10b981',
                      },
                    ].map((stat, index) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={index}
                          className="p-6 rounded-3xl border"
                          style={{
                            background: isDark 
                              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <div 
                            className="p-3 rounded-2xl inline-flex mb-4"
                            style={{ background: `${stat.color}20` }}
                          >
                            <Icon className="w-6 h-6" style={{ color: stat.color }} />
                          </div>
                          <p 
                            className="text-sm mb-1"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                          >
                            {stat.label}
                          </p>
                          <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Products Tab */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  {/* Add Product Button */}
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Mahsulotlar</h3>
                    <button
                      onClick={() => setIsProductModalOpen(true)}
                      className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all active:scale-95"
                      style={{ background: accentColor.gradient, color: '#ffffff' }}
                    >
                      <Plus className="w-5 h-5" />
                      Mahsulot qo'shish
                    </button>
                  </div>

                  {products.length === 0 ? (
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
                      <p className="mb-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Birinchi mahsulotingizni qo'shing
                      </p>
                      <button
                        onClick={() => setIsProductModalOpen(true)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all active:scale-95"
                        style={{ background: accentColor.gradient, color: '#ffffff' }}
                      >
                        <Plus className="w-5 h-5" />
                        Mahsulot qo'shish
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {products.map((product: any) => {
                        // Get first variant for display
                        const firstVariant = product.variants?.[0];
                        const displayImage = firstVariant?.images?.[0] || product.image;
                        const displayPrice = firstVariant?.price || product.price;
                        const variantsList = Array.isArray(product.variants) ? product.variants : [];
                        const variantStockRows = variantsList.map((v: any, i: number) => {
                          const n = Math.floor(
                            Number(v?.stock ?? v?.stockQuantity ?? v?.stockCount ?? 0),
                          );
                          const st = Number.isFinite(n) ? Math.max(0, n) : 0;
                          const label = String(v?.name || `Variant ${i + 1}`).trim() || `Variant ${i + 1}`;
                          return { st, label };
                        });
                        const totalStock =
                          variantStockRows.length > 0
                            ? variantStockRows.reduce((sum, row) => sum + row.st, 0)
                            : (() => {
                                const raw = Math.floor(
                                  Number(
                                    product?.stock ?? product?.stockQuantity ?? product?.stockCount ?? 0,
                                  ),
                                );
                                return Number.isFinite(raw) ? Math.max(0, raw) : 0;
                              })();
                        const outOfStockLabels = variantStockRows.filter((r) => r.st === 0).map((r) => r.label);
                        const outOfStockVariantCount = outOfStockLabels.length;
                        const hasPartialOutOfStock = totalStock > 0 && outOfStockVariantCount > 0;
                        const allVariantsOut = variantStockRows.length > 0 && outOfStockVariantCount === variantStockRows.length;
                        
                        return (
                          <div
                            key={product.id}
                            className="p-5 rounded-2xl border"
                            style={{
                              background: isDark 
                                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            }}
                          >
                            {/* Product Image */}
                            {displayImage && (
                              <div className="relative mb-4">
                                <img 
                                  src={displayImage} 
                                  alt={product.name}
                                  className="w-full h-48 object-cover rounded-xl"
                                />
                                {(totalStock === 0 || hasPartialOutOfStock) && (
                                  <div
                                    className="absolute top-2 right-2 max-w-[min(100%,14rem)] px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold leading-tight text-right"
                                    style={{
                                      background:
                                        totalStock === 0 || allVariantsOut
                                          ? 'rgba(239, 68, 68, 0.92)'
                                          : 'rgba(245, 158, 11, 0.92)',
                                      color: '#ffffff',
                                    }}
                                  >
                                    {totalStock === 0 || allVariantsOut ? (
                                      'Tugagan'
                                    ) : outOfStockVariantCount === 1 ? (
                                      <>
                                        Qisman: «{outOfStockLabels[0]}» tugagan
                                      </>
                                    ) : (
                                      <>
                                        Qisman: {outOfStockVariantCount} ta variant tugagan
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Product Info */}
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-bold text-lg mb-1 line-clamp-1">{product.name}</h4>
                                {product.description && (
                                  <p className="text-sm line-clamp-2 mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                    {product.description}
                                  </p>
                                )}
                              </div>

                              {/* Price */}
                              <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold" style={{ color: accentColor.color }}>
                                  {displayPrice?.toLocaleString()} so'm
                                </span>
                                {firstVariant?.oldPrice > 0 && (
                                  <span className="text-sm line-through" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                                    {firstVariant.oldPrice.toLocaleString()} so'm
                                  </span>
                                )}
                              </div>

                              {/* Stats */}
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                                <div>
                                  <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                    Variantlar
                                  </p>
                                  <p className="text-sm font-bold">{product.variants?.length || 0} ta</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                                    Ombor
                                  </p>
                                  <p className="text-sm font-bold">{totalStock} dona (jami)</p>
                                  {hasPartialOutOfStock && (
                                    <p
                                      className="text-[10px] sm:text-xs font-semibold mt-1 leading-snug line-clamp-2"
                                      style={{ color: '#f87171' }}
                                      title={outOfStockLabels.join(', ')}
                                    >
                                      {outOfStockVariantCount === 1
                                        ? `«${outOfStockLabels[0]}» — 0 (tugagan)`
                                        : `${outOfStockVariantCount} ta variant: 0 (tugagan)`}
                                    </p>
                                  )}
                                  {totalStock === 0 && variantStockRows.length > 0 && !hasPartialOutOfStock && (
                                    <p className="text-[10px] sm:text-xs font-semibold mt-1" style={{ color: '#f87171' }}>
                                      Barcha variantlar tugagan
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Date */}
                              {product.createdAt && (
                                <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                                  {new Date(product.createdAt).toLocaleDateString('uz-UZ', { 
                                    day: 'numeric', 
                                    month: 'short', 
                                    year: 'numeric' 
                                  })}
                                </p>
                              )}

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
                                  style={{ background: `${accentColor.color}20`, color: accentColor.color }}
                                >
                                  <Edit className="w-4 h-4" />
                                  Tahrirlash
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
                                  style={{ background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  O'chirish
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Orders Tab — mijozlar ilovadan bergan do‘kon buyurtmalari + eski shop_order */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'all' as const, label: 'Barchasi' },
                        { id: 'active' as const, label: 'Faol' },
                        { id: 'done' as const, label: 'Yakunlangan' },
                        { id: 'cancelled' as const, label: 'Bekor' },
                      ] as const
                    ).map((chip) => {
                      const count =
                        chip.id === 'all'
                          ? sellerOrderCounts.all
                          : chip.id === 'active'
                            ? sellerOrderCounts.active
                            : chip.id === 'done'
                              ? sellerOrderCounts.done
                              : sellerOrderCounts.cancelled;
                      const selected = orderStatusFilter === chip.id;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => setOrderStatusFilter(chip.id)}
                          className="px-4 py-2 rounded-2xl text-sm font-semibold border transition-all"
                          style={{
                            background: selected ? accentColor.gradient : isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                            color: selected ? '#ffffff' : undefined,
                            borderColor: selected ? 'transparent' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          }}
                        >
                          {chip.label}
                          <span className="opacity-80 ml-1">({count})</span>
                        </button>
                      );
                    })}
                  </div>

                  {orders.length === 0 ? (
                    <div
                      className="p-12 rounded-3xl border text-center"
                      style={{
                        background: isDark
                          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <ShoppingCart className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color, opacity: 0.5 }} />
                      <h3 className="text-lg font-bold mb-2">Hozircha buyurtma yo‘q</h3>
                      <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Mijozlar ilovadan buyurtma berganda shu yerda ko‘rinadi
                      </p>
                    </div>
                  ) : filteredSellerOrders.length === 0 ? (
                    <div
                      className="p-10 rounded-3xl border text-center"
                      style={{
                        background: isDark
                          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <p className="font-semibold">Bu filtr bo‘yicha buyurtmalar yo‘q</p>
                      <p className="text-sm mt-2 opacity-70">Boshqa holatni tanlang yoki &quot;Barchasi&quot;ni oching</p>
                    </div>
                  ) : (
                    filteredSellerOrders.map((o: any) => {
                      const oid = String(o.id || '').trim();
                      const st = String(o.status || 'pending').toLowerCase();
                      const items = orderItems(o);
                      return (
                        <div
                          key={oid || orderLabel(o)}
                          className="p-5 rounded-2xl border"
                          style={{
                            background: isDark
                              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="font-bold text-lg">{orderLabel(o)}</p>
                              <p className="text-sm opacity-70">
                                {o.createdAt
                                  ? new Date(o.createdAt).toLocaleString('uz-UZ')
                                  : '—'}
                              </p>
                            </div>
                            <span
                              className="px-3 py-1 rounded-xl text-sm font-semibold"
                              style={{
                                background: `${accentColor.color}22`,
                                color: accentColor.color,
                              }}
                            >
                              {sellerOrderStatusLabelUz(st)}
                            </span>
                          </div>
                          <div className="text-sm space-y-1 mb-3 opacity-90">
                            <p>
                              <span className="opacity-60">Mijoz:</span> {orderCustomerName(o)} ·{' '}
                              {orderCustomerPhone(o)}
                            </p>
                            <p>
                              <span className="opacity-60">Manzil:</span> {orderAddress(o)}
                            </p>
                            <p className="font-semibold pt-1" style={{ color: accentColor.color }}>
                              Jami: {orderTotal(o).toLocaleString('uz-UZ')} so‘m
                            </p>
                          </div>
                          {items.length > 0 && (
                            <ul className="text-sm space-y-1 mb-4 pl-4 list-disc opacity-85">
                              {items.map((it: any, idx: number) => (
                                <li key={idx}>
                                  {it.name || it.title || it.dishName || 'Mahsulot'} ×{' '}
                                  {Number(it.quantity || 1)} —{' '}
                                  {Number(it.price || 0).toLocaleString('uz-UZ')} so‘m
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {(st === 'pending' || st === 'new') && (
                              <button
                                type="button"
                                disabled={!!orderActionId}
                                onClick={() => oid && handleSellerOrderStatus(oid, 'confirmed')}
                                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                              >
                                {orderActionId === oid ? (
                                  <Loader2 className="w-4 h-4 animate-spin inline" />
                                ) : (
                                  'Qabul qilish'
                                )}
                              </button>
                            )}
                            {(st === 'confirmed' || st === 'accepted' || st === 'preparing') && (
                              <button
                                type="button"
                                disabled={!!orderActionId}
                                onClick={() => oid && handleSellerOrderStatus(oid, 'ready')}
                                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
                              >
                                Tayyor
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Inventory Tab */}
              {activeTab === 'inventory' && sellerInfo?.token ? (
                <SellerWarehousePanel
                  token={sellerInfo.token}
                  isDark={isDark}
                  accentColor={accentColor}
                  lines={inventoryLines}
                  summary={inventorySummary}
                  loading={isLoading}
                  onReload={() => void loadData()}
                  loadError={inventoryLoadError}
                />
              ) : null}

              {/* Payments Tab */}
              {activeTab === 'payments' && sellerInfo?.token ? (
                <SellerPaymentsPanel
                  orders={orders}
                  isDark={isDark}
                  accentColor={accentColor}
                  loading={isLoading}
                  onReload={() => void loadData()}
                  orderCustomerName={orderCustomerName}
                  orderCustomerPhone={orderCustomerPhone}
                  orderLabel={orderLabel}
                />
              ) : null}

              {/* Statistics Tab */}
              {activeTab === 'statistics' && statistics && (
                <div className="space-y-6">
                  {/* Title */}
                  <div
                    className="p-6 rounded-3xl border"
                    style={{
                      background: isDark 
                        ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
                        : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
                      borderColor: `${accentColor.color}33`,
                    }}
                  >
                    <h3 className="text-2xl font-bold mb-2">
                      Kamisya Statistikasi 📊
                    </h3>
                    <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      Do'koningizning batafsil moliyaviy hisoboti
                    </p>
                  </div>

                  {/* Main Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { 
                        label: 'Jami Sotuvlar', 
                        value: `${statistics.totalRevenue.toLocaleString()} so'm`, 
                        icon: CreditCard, 
                        color: '#3b82f6',
                        desc: 'Umumiy savdo hajmi'
                      },
                      { 
                        label: 'Platforma Kamisyasi', 
                        value: `${statistics.totalCommission.toLocaleString()} so'm`, 
                        icon: BarChart3, 
                        color: '#ef4444',
                        desc: `O'rtacha ${statistics.averageCommissionRate}%`
                      },
                      { 
                        label: 'Sizning Daromadingiz', 
                        value: `${statistics.totalEarnings.toLocaleString()} so'm`, 
                        icon: CreditCard, 
                        color: '#10b981',
                        desc: 'Sof foyda'
                      },
                      { 
                        label: 'Jami Buyurtmalar', 
                        value: statistics.totalOrders.toString(), 
                        icon: ShoppingCart, 
                        color: '#14b8a6',
                        desc: `${statistics.completedOrders} ta bajarilgan`
                      },
                    ].map((stat, index) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={index}
                          className="p-6 rounded-3xl border"
                          style={{
                            background: isDark 
                              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <div 
                            className="p-3 rounded-2xl inline-flex mb-4"
                            style={{ background: `${stat.color}20` }}
                          >
                            <Icon className="w-6 h-6" style={{ color: stat.color }} />
                          </div>
                          <p 
                            className="text-xs mb-1"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                          >
                            {stat.label}
                          </p>
                          <p className="text-xl lg:text-2xl font-bold mb-1">{stat.value}</p>
                          <p 
                            className="text-xs"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                          >
                            {stat.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Additional Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { 
                        label: 'Kutilmoqda', 
                        value: statistics.pendingOrders.toString(), 
                        icon: ShoppingCart, 
                        color: '#f59e0b'
                      },
                      { 
                        label: 'Jami Mahsulotlar', 
                        value: statistics.totalProducts.toString(), 
                        icon: Package, 
                        color: '#3b82f6'
                      },
                      { 
                        label: 'Omborda', 
                        value: statistics.totalStock.toString(), 
                        icon: Warehouse, 
                        color: '#8b5cf6'
                      },
                    ].map((stat, index) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={index}
                          className="p-5 rounded-2xl border"
                          style={{
                            background: isDark 
                              ? 'rgba(255, 255, 255, 0.03)'
                              : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="p-2.5 rounded-xl"
                              style={{ background: `${stat.color}20` }}
                            >
                              <Icon className="w-5 h-5" style={{ color: stat.color }} />
                            </div>
                            <div>
                              <p 
                                className="text-xs mb-0.5"
                                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                              >
                                {stat.label}
                              </p>
                              <p className="text-xl font-bold">{stat.value}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Commission Explanation */}
                  <div
                    className="p-6 rounded-3xl border"
                    style={{
                      background: isDark 
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                      💡 Kamisya Tizimi Haqida
                    </h4>
                    <div className="space-y-2 text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      <p>
                        <strong>Kamisya:</strong> Har bir mahsulot sotilganda platformaga to'lanadigan foiz. 
                        Masalan, agar siz 100,000 so'mlik mahsulot 15% kamisya bilan sotgan bo'lsangiz:
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Jami sotish: <strong>100,000 so'm</strong></li>
                        <li>Platforma kamisyasi (15%): <strong>15,000 so'm</strong></li>
                        <li>Sizning daromadingiz: <strong>85,000 so'm</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
            </RouteErrorBoundary>
          )}
        </div>
      </main>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
        token={sellerInfo?.token || ''}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
        token={sellerInfo?.token || ''}
        product={editingProduct}
      />
    </div>
  );
}