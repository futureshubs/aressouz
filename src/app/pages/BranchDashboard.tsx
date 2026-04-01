import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, 
  BarChart3, 
  TrendingUp, 
  ShoppingCart, 
  UtensilsCrossed, 
  Home as HomeIcon, 
  LogOut, 
  Menu as MenuIcon,
  X,
  Store,
  Package,
  ShoppingBag,
  Image,
  Settings,
  MapPin,
  User,
  Car,
  Bike,
  ChefHat,
  Map,
  MessageSquare,
  Shield,
  CreditCard,
  Users,
  FileBarChart,
  Building,
  BriefcaseBusiness,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import MarketView from '../components/branch/MarketView';
import ShopView from '../components/branch/ShopView';
import { RestaurantManagement } from './RestaurantManagement';
import { RentalDashboard } from '../components/rental/RentalDashboard';
import { RentalOrdersView } from '../components/rental/RentalOrdersView';
import { AuctionDashboard } from '../components/auction/AuctionDashboard';
import { BannerManagement } from '../components/BannerManagement';
import ServicesManagement from '../components/branch/ServicesManagement';
import PlacesManagement from '../components/branch/PlacesManagement';
import PropertiesManagement from '../components/branch/PropertiesManagement';
import VehiclesManagement from '../components/branch/VehiclesManagement';
import { BankManagement } from '../components/branch/BankManagement';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import DeliveryZones from '../components/branch/DeliveryZones';
import OrdersManagement from '../components/admin/OrdersManagement';
import PrepareManager from '../components/PrepareManager';
import TwoFactorAuth from '../components/TwoFactorAuth';
// Import new components
import Analytics from '../components/branch/Analytics';
import { Statistics } from '../components/branch/Statistics';
import { Profile } from '../components/branch/Profile';
import { Chat } from '../components/branch/Chat';
import { Payments } from '../components/branch/Payments';
import { StaffManagement } from '../components/branch/StaffManagement';
import { Reports } from '../components/branch/Reports';
import { Couriers } from '../components/branch/Couriers';
import { CourierBagsPanel } from '../components/branch/CourierBagsPanel';
import { PickupRacksPanel } from '../components/branch/PickupRacksPanel';
import { buildBranchHeaders } from '../utils/requestAuth';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../utils/supabase/info';

export default function BranchDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    (typeof window !== 'undefined' && window.location.hostname === 'localhost')
      ? DEV_API_BASE_URL
      : API_BASE_URL;

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [isLoadingBranch, setIsLoadingBranch] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<null | {
    todayOrders: number;
    totalProducts: number;
    activeUsersToday: number;
    revenueToday: number;
  }>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [branchCourierOptions, setBranchCourierOptions] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [visibilityReloadTick, setVisibilityReloadTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityReloadTick((t) => t + 1));

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const loadBranchInfo = async () => {
      // Get current user ID from localStorage
      const storedUser = localStorage.getItem('sms_user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setCurrentUserId(userData.id || null);
          console.log('👤 Current user ID:', userData.id);
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      
      // Check branch session
      const session = localStorage.getItem('branchSession');
      if (!session) {
        navigate('/filyal');
        return;
      }

      const sessionData = JSON.parse(session);
      if (!sessionData?.jwt && !sessionData?.token) {
        // SaaS auth requires either Supabase JWT (preferred) or legacy branch token for older sessions.
        localStorage.removeItem('branchSession');
        toast.error('Filial sessiyasi yangilanishi kerak. Qayta kiring.');
        navigate('/filyal');
        return;
      }
      const branchId = sessionData.id;

      try {
        console.log('📦 Loading branch info from Supabase:', branchId);
        
        // Load latest branch data from Supabase
        const response = await fetch(
          `${apiBaseUrl}/branches`,
          {
            headers: {
              apikey: publicAnonKey,
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load branches');
        }

        const data = await response.json();
        const currentBranch = data.branches.find((b: any) => b.id === branchId);

        if (currentBranch) {
          const prevToken = sessionData.token;
          const prevJwt = sessionData.jwt;
          // Update with latest data from Supabase (preserve session tokens)
          const updatedInfo = {
            id: currentBranch.id,
            branchName: currentBranch.name || currentBranch.branchName,
            login: currentBranch.login,
            region: currentBranch.regionName || currentBranch.region || '',
            district: currentBranch.districtName || currentBranch.district || '',
            regionId: currentBranch.regionId || '',  // ID for filtering
            districtId: currentBranch.districtId || '',  // ID for filtering
            phone: currentBranch.phone || '',
            managerName: currentBranch.managerName || 'Manager',
            coordinates: currentBranch.coordinates || { lat: 0, lng: 0 },
            openDate: currentBranch.openDate || currentBranch.createdAt || '',
            ...(prevToken ? { token: prevToken } : {}),
            ...(prevJwt ? { jwt: prevJwt } : {}),
          };

          console.log('✅ Branch info updated:', updatedInfo);
          setBranchInfo(updatedInfo);
          
          // Update localStorage session with fresh data
          localStorage.setItem('branchSession', JSON.stringify(updatedInfo));
        } else {
          // Branch not found, use session data
          console.log('⚠️ Branch not found in Supabase, using session data');
          setBranchInfo(sessionData);
        }
      } catch (error) {
        console.error('❌ Error loading branch info:', error);
        // Fallback to session data
        toast.error('Ma\'lumotlar yuklanmadi, sessiya ma\'lumotlari ishlatilmoqda');
        setBranchInfo(sessionData);
      } finally {
        setIsLoadingBranch(false);
      }
    };

    loadBranchInfo();
  }, [navigate, visibilityReloadTick]);

  useEffect(() => {
    const loadStats = async () => {
      if (!branchInfo?.id) {
        setDashboardStats(null);
        return;
      }

      try {
        setIsLoadingStats(true);
        const params = new URLSearchParams({ branchId: branchInfo.id });
        const res = await fetch(
          `${apiBaseUrl}/branch/dashboard/stats?${params.toString()}`,
          { headers: buildBranchHeaders({ 'Content-Type': 'application/json' }) },
        );

        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('branchSession');
          toast.error('Sessiya tugadi. Qayta kiring.');
          navigate('/filyal');
          return;
        }

        const data = await res.json();
        if (!res.ok || !data?.success || !data?.stats) {
          setDashboardStats(null);
          return;
        }
        setDashboardStats(data.stats);
      } catch {
        setDashboardStats(null);
      } finally {
        setIsLoadingStats(false);
      }
    };

    void loadStats();
  }, [branchInfo?.id, navigate, visibilityReloadTick]);

  useEffect(() => {
    const loadCourierOptions = async () => {
      if (!branchInfo?.id) {
        setBranchCourierOptions([]);
        return;
      }

      try {
        const params = new URLSearchParams({ branchId: branchInfo.id });
        const response = await fetch(
          `${apiBaseUrl}/couriers?${params.toString()}`,
          {
            headers: buildBranchHeaders({
              'Content-Type': 'application/json',
            }),
          }
        );

        if (!response.ok) {
          setBranchCourierOptions([]);
          return;
        }

        const data = await response.json();
        if (!data?.success || !Array.isArray(data.couriers)) {
          setBranchCourierOptions([]);
          return;
        }

        setBranchCourierOptions(
          data.couriers.map((courier: any) => ({
            id: courier.id,
            name: courier.name || courier.login || courier.phone || courier.id,
            status: courier.status || 'inactive',
          }))
        );
      } catch {
        setBranchCourierOptions([]);
      }
    };

    loadCourierOptions();
  }, [branchInfo?.id, visibilityReloadTick]);

  const handleLogout = () => {
    localStorage.removeItem('branchSession');
    navigate('/filyal');
  };

  const menuItems = [
    // Asosiy
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Data Analitika', icon: BarChart3 },
    { id: 'statistics', label: 'Statistika', icon: TrendingUp },
    
    // Buyurtmalar (do‘kon buyurtmalari sotuvchi /seller panelida)
    { id: 'market-orders', label: 'Market Buyurtmalar', icon: ShoppingBag },
    { id: 'food-orders', label: 'Taom Buyurtmalar', icon: UtensilsCrossed },
    { id: 'rental-orders', label: 'Ijara Buyurtmalar', icon: HomeIcon },
    
    // Mahsulotlar/Xizmatlar
    { id: 'market', label: 'Market', icon: ShoppingCart },
    { id: 'shop', label: 'Do\'kon', icon: Package },
    { id: 'foods', label: 'Taomlar', icon: ChefHat },
    { id: 'rentals', label: 'Ijara', icon: Car },
    { id: 'auction', label: 'Auksion', icon: TrendingUp },
    { id: 'banner', label: 'Banner', icon: Image },
    { id: 'services', label: 'Xizmatlar', icon: Settings },
    { id: 'nearby', label: 'Atrof', icon: MapPin },
    
    // Mening
    { id: 'profile', label: 'Mening', icon: User },
    { id: 'house', label: 'Uy', icon: HomeIcon },
    { id: 'car', label: 'Moshina', icon: Car },
    { id: 'bank', label: 'Bank', icon: Building },
    
    // Hodimlar
    { id: 'couriers', label: 'Kuryer', icon: Bike },
    { id: 'courier-bags', label: 'So\'mkalar', icon: BriefcaseBusiness },
    { id: 'pickup-racks', label: 'Olib ketish rastasi', icon: MapPin },
    { id: 'preparers', label: 'Tayyorlovchi', icon: ChefHat },
    
    // Tizim
    { id: 'delivery-zones', label: 'Yetkazib berish zonasi', icon: Map },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: '2fa', label: '2FA', icon: Shield },
    { id: 'payments', label: 'To\'lovlar tarixi', icon: CreditCard },
    
    // Hisobotlar
    { id: 'employees', label: 'Ishchilar', icon: Users },
    { id: 'reports', label: 'Hisobboti', icon: FileBarChart },
  ];

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
        className="hidden lg:block fixed left-0 top-0 h-full w-64 border-r overflow-y-auto pb-28"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="p-6">
          {/* Branch Info */}
          <div className="mb-8">
            <div 
              className="p-4 rounded-2xl mb-3"
              style={{ background: `${accentColor.color}20` }}
            >
              {isLoadingBranch ? (
                <>
                  <div 
                    className="h-6 rounded-lg mb-2 animate-pulse mx-auto"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      width: '60%'
                    }}
                  />
                  <div className="space-y-1.5">
                    <div 
                      className="h-4 rounded-lg animate-pulse mx-auto"
                      style={{ 
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        width: '80%'
                      }}
                    />
                    <div 
                      className="h-4 rounded-lg animate-pulse mx-auto"
                      style={{ 
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        width: '70%'
                      }}
                    />
                    <div 
                      className="h-4 rounded-lg animate-pulse mx-auto"
                      style={{ 
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        width: '65%'
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-lg font-bold text-center mb-2" style={{ color: accentColor.color }}>
                    {branchInfo?.branchName || 'Filial'}
                  </h1>
                  <div className="space-y-1.5">
                    <p 
                      className="text-xs text-center"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      📍 {branchInfo?.region || 'Viloyat'}, {branchInfo?.district || 'Tuman'}
                    </p>
                    <p 
                      className="text-xs text-center font-medium"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      📞 {branchInfo?.phone || '+998 90 123 45 67'}
                    </p>
                    <p 
                      className="text-xs text-center"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      👤 {branchInfo?.managerName || 'Menejer'}
                    </p>
                  </div>
                </>
              )}
            </div>
            <p 
              className="text-xs text-center"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            >
              @{branchInfo?.login}
            </p>
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
                      : isDark ? 'transparent' : 'transparent',
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

        <div className="fixed bottom-0 left-0 w-64 p-6" style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}>
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
            className="absolute left-0 top-0 h-full w-64 border-r overflow-y-auto pb-28"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                {isLoadingBranch ? (
                  <div 
                    className="h-8 rounded-xl animate-pulse"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      width: '120px'
                    }}
                  />
                ) : (
                  <div 
                    className="p-2 rounded-xl"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <h1 className="text-sm font-bold" style={{ color: accentColor.color }}>
                      {branchInfo?.branchName || 'Filial'}
                    </h1>
                  </div>
                )}
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

            <div className="fixed bottom-0 left-0 w-64 p-6" style={{ background: isDark ? '#0a0a0a' : '#ffffff' }}>
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
      <main className="lg:ml-64 min-w-0 overflow-x-hidden">
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
                  {branchInfo?.branchName}
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
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Welcome Card */}
              <div
                className="p-8 rounded-3xl border"
                style={{
                  background: isDark 
                    ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
                    : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
                  borderColor: `${accentColor.color}33`,
                  boxShadow: `0 20px 60px ${accentColor.color}20`,
                }}
              >
                <h3 className="text-2xl font-bold mb-2">
                  Xush kelibsiz, {branchInfo?.branchName}! 👋
                </h3>
                <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  Filial panelga muvaffaqiyatli kirdingiz
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {[
                  {
                    label: 'Bugungi buyurtmalar',
                    getValue: () => String(dashboardStats?.todayOrders ?? 0),
                    icon: ShoppingCart,
                    color: '#14b8a6',
                  },
                  {
                    label: 'Jami mahsulotlar',
                    getValue: () => String(dashboardStats?.totalProducts ?? 0),
                    icon: Store,
                    color: '#3b82f6',
                  },
                  {
                    label: 'Faol foydalanuvchilar',
                    getValue: () => String(dashboardStats?.activeUsersToday ?? 0),
                    icon: TrendingUp,
                    color: '#f59e0b',
                  },
                  {
                    label: 'Bugungi daromad',
                    getValue: () =>
                      `${Number(dashboardStats?.revenueToday ?? 0).toLocaleString()} so'm`,
                    icon: BarChart3,
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
                      <p className="text-2xl font-bold min-h-8 flex items-center">
                        {isLoadingStats ? (
                          <Loader2
                            className="w-7 h-7 animate-spin"
                            style={{ color: stat.color }}
                            aria-label="Yuklanmoqda"
                          />
                        ) : (
                          stat.getValue()
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                {[
                  { id: 'orders', label: 'Buyurtmalar', desc: 'Qabul qilish, status, kuryer biriktirish', icon: Package, color: '#14b8a6' },
                  { id: 'market', label: 'Market', desc: 'Mahsulotlar, kategoriya, zaxira', icon: Store, color: '#3b82f6' },
                  { id: 'payments', label: 'To‘lovlar', desc: 'Pending/paid, cheklar, hisob-kitob', icon: CreditCard, color: '#f59e0b' },
                  { id: 'couriers', label: 'Kuryerlar', desc: 'Kuryerlar ro‘yxati va holati', icon: Bike, color: '#10b981' },
                  { id: 'chat', label: 'Chat', desc: 'Mijozlar bilan suhbat', icon: MessageSquare, color: '#a855f7' },
                  { id: 'reports', label: 'Hisobotlar', desc: 'Kunlik/oylik ko‘rsatkichlar', icon: FileBarChart, color: '#ef4444' },
                ].map((x) => {
                  const Icon = x.icon;
                  return (
                    <button
                      key={x.id}
                      onClick={() => setActiveTab(x.id)}
                      className="text-left p-6 rounded-3xl border transition-all active:scale-[0.99]"
                      style={{
                        background: isDark
                          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-2xl" style={{ background: `${x.color}20` }}>
                          <Icon className="w-6 h-6" style={{ color: x.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-lg mb-1">{x.label}</p>
                          <p
                            className="text-sm"
                            style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}
                          >
                            {x.desc}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other Tabs - Coming Soon */}
          {activeTab === 'market' && branchInfo && (
            <MarketView branchId={branchInfo.id} />
          )}

          {activeTab === 'shop' && branchInfo && (
            <ShopView branchId={branchInfo.id} />
          )}

          {activeTab === 'foods' && branchInfo && (
            <RestaurantManagement branchId={branchInfo.id} />
          )}

          {activeTab === 'rentals' && branchInfo && (
            <RentalDashboard branchId={branchInfo.id} />
          )}

          {activeTab === 'auction' && branchInfo && (
            <AuctionDashboard branchId={branchInfo.id} />
          )}

          {activeTab === 'banner' && branchInfo && (
            <BannerManagement branchId={branchInfo.id} />
          )}

          {activeTab === 'services' && branchInfo && (
            <ServicesManagement 
              branchId={branchInfo.id} 
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'nearby' && branchInfo && (
            <PlacesManagement 
              branchId={branchInfo.id} 
              branchInfo={{
                region: branchInfo.regionId || branchInfo.region,
                district: branchInfo.districtId || branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'house' && branchInfo && (
            <PropertiesManagement 
              branchId={branchInfo.id}
              userId={currentUserId || undefined}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'bank' && branchInfo && (
            <BankManagement 
              branchId={branchInfo.id} 
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'car' && branchInfo && (
            <VehiclesManagement 
              branchId={branchInfo.id} 
              userId={branchInfo.userId}
              branchInfo={branchInfo}
            />
          )}

          {activeTab === 'delivery-zones' && branchInfo && (
            <div 
              className="flex items-center justify-center min-h-[60vh] rounded-3xl border"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <DeliveryZones 
                isDark={isDark}
                accentColor={accentColor}
                branchInfo={branchInfo}
              />
            </div>
          )}

          {activeTab === 'preparers' && (
            <PrepareManager />
          )}

          {activeTab === 'market-orders' && branchInfo && (
            <OrdersManagement 
              branchId={branchInfo.id} 
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
              type="market"
              authMode="branch"
            />
          )}

          {activeTab === 'food-orders' && branchInfo && (
            <OrdersManagement 
              branchId={branchInfo.id} 
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
              type="food"
              authMode="branch"
              onPaymentRequired={() => setActiveTab('payments')}
            />
          )}

          {activeTab === 'rental-orders' && branchInfo && (
            <RentalOrdersView branchId={branchInfo.id} />
          )}

          {activeTab === '2fa' && branchInfo && (
            <TwoFactorAuth 
              branchId={branchInfo.id}
              branchName={branchInfo.branchName}
              isDark={isDark}
              accentColor={accentColor}
            />
          )}

          {/* New Components */}
          {activeTab === 'analytics' && branchInfo && (
            <Analytics 
              branchId={branchInfo.id}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'statistics' && branchInfo && (
            <Statistics 
              branchId={branchInfo.id}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'profile' && branchInfo && (
            <Profile 
              branchId={branchInfo.id}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'couriers' && branchInfo && (
            <Couriers 
              branchId={branchInfo.id}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'courier-bags' && branchInfo && (
            <CourierBagsPanel
              branchId={branchInfo.id}
              couriers={branchCourierOptions}
              mode="createOnly"
            />
          )}

          {activeTab === 'pickup-racks' && branchInfo && (
            <PickupRacksPanel branchId={branchInfo.id} />
          )}

          {activeTab === 'chat' && branchInfo && (
            <Chat 
              branchId={branchInfo.id}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'payments' && branchInfo && (
            <Payments 
              branchId={branchInfo.id}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab === 'employees' && branchInfo && (
            <StaffManagement
              branchId={branchInfo.id}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone,
              }}
            />
          )}

          {activeTab === 'reports' && branchInfo && (
            <Reports 
              branchId={branchInfo.id}
              branchInfo={{
                region: branchInfo.region,
                district: branchInfo.district,
                phone: branchInfo.phone
              }}
            />
          )}

          {activeTab !== 'dashboard' &&
            activeTab !== 'market' &&
            activeTab !== 'shop' &&
            activeTab !== 'foods' &&
            activeTab !== 'rentals' &&
            activeTab !== 'auction' &&
            activeTab !== 'banner' &&
            activeTab !== 'services' &&
            activeTab !== 'nearby' &&
            activeTab !== 'house' &&
            activeTab !== 'car' &&
            activeTab !== 'bank' &&
            activeTab !== 'delivery-zones' &&
            activeTab !== 'market-orders' &&
            activeTab !== 'food-orders' &&
            activeTab !== 'rental-orders' &&
            activeTab !== 'preparers' &&
            activeTab !== '2fa' &&
            activeTab !== 'analytics' &&
            activeTab !== 'statistics' &&
            activeTab !== 'profile' &&
            activeTab !== 'couriers' &&
            activeTab !== 'courier-bags' &&
            activeTab !== 'pickup-racks' &&
            activeTab !== 'chat' &&
            activeTab !== 'payments' &&
            activeTab !== 'employees' &&
            activeTab !== 'reports' && (
              <div
                className="flex items-center justify-center min-h-[60vh] rounded-3xl border p-6"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="text-center max-w-lg">
                  <div
                    className="inline-flex p-6 rounded-3xl mb-4"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <div className="text-4xl">⚠️</div>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Bo‘lim topilmadi</h3>
                  <p
                    style={{
                      color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    Menyudan bo‘lim tanlang.
                  </p>
                </div>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}