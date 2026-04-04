import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  CreditCard, 
  LogOut,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  BarChart3,
  LineChart,
  Shield,
  Loader2,
} from 'lucide-react';
import BranchesView from '../components/admin/BranchesView';
import UsersView from '../components/admin/UsersView';
import PaymentsView from '../components/admin/PaymentsView';
import OrdersManagement from '../components/admin/OrdersManagement';
import AdminBranchStatistics from '../components/admin/AdminBranchStatistics';
import AdminBranchAnalytics from '../components/admin/AdminBranchAnalytics';
import AdminSecurityView from '../components/admin/AdminSecurityView';
import { projectId } from '../../../utils/supabase/info';
import { buildAdminHeaders } from '../utils/requestAuth';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

const safeNum = (n: unknown): number => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

type RecentActivityRow = {
  id: string;
  orderId: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  totalAmount: number;
  orderType?: string;
};

const formatSumUz = (n: number) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(safeNum(n));

const paymentStatusLabelUz = (ps: string) => {
  const p = String(ps || '').toLowerCase();
  if (p === 'paid') return "To'langan";
  if (p === 'failed') return 'Xatolik';
  if (p === 'refunded') return 'Qaytarilgan';
  return 'Kutilmoqda';
};

const formatDashboardRevenue = (amount: number) => {
  const n = safeNum(amount);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M so'm`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K so'm`;
  return `${formatSumUz(n)} so'm`;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    totalBranches: 0,
    totalUsers: 0,
    totalPayments: 0,
    totalRevenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivityRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setStatsLoading(true);
    try {
      const [branchesResponse, usersResponse, ordersStatsResponse] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches`, {
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/admin/users`, {
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/stats`, {
          headers: buildAdminHeaders({
            'Content-Type': 'application/json',
          }),
        }),
      ]);

      const branches = branchesResponse.ok ? (await branchesResponse.json()).branches : [];
      const users = usersResponse.ok ? (await usersResponse.json()).users : [];

      const ordersStatsPayload = ordersStatsResponse.ok
        ? await ordersStatsResponse.json().catch(() => ({}))
        : {};
      const st = ordersStatsPayload?.success && ordersStatsPayload?.stats ? ordersStatsPayload.stats : null;

      const paidOrderCount = st ? safeNum(st.paidOrderCount ?? st.paymentByStatus?.paid) : 0;
      const revenueFromPaid = st ? safeNum(st.revenue?.paid) : 0;
      const recent = st && Array.isArray(st.recentActivity) ? (st.recentActivity as RecentActivityRow[]) : [];

      setStats({
        totalBranches: Array.isArray(branches) ? branches.length : 0,
        totalUsers: Array.isArray(users) ? users.length : 0,
        totalPayments: paidOrderCount,
        totalRevenue: revenueFromPaid,
      });
      setRecentActivity(recent);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      if (!opts?.soft) setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('adminSession');
    if (!session) {
      navigate('/admin');
      return;
    }
    try {
      const s = JSON.parse(session) as { sessionToken?: string; role?: string };
      if (s?.role !== 'admin' || !s?.sessionToken) {
        localStorage.removeItem('adminSession');
        navigate('/admin');
        return;
      }
    } catch {
      localStorage.removeItem('adminSession');
      navigate('/admin');
      return;
    }
    void loadStats();
  }, [navigate, loadStats]);

  useVisibilityRefetch(() => {
    void loadStats({ soft: true });
  });

  const handleLogout = () => {
    localStorage.removeItem('adminSession');
    navigate('/admin');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'branches', label: 'Filiallar', icon: Building2 },
    { id: 'statistics', label: 'Statistika', icon: BarChart3 },
    { id: 'analytics', label: 'Analitika', icon: LineChart },
    { id: 'users', label: 'Foydalanuvchilar', icon: Users },
    { id: 'payments', label: 'To\'lovlar', icon: CreditCard },
    { id: 'orders', label: 'Buyurtmalar', icon: Package },
    { id: 'security', label: 'Xavfsizlik', icon: Shield },
  ];

  const statsCards = [
    {
      title: 'Jami Filiallar',
      value: stats.totalBranches,
      icon: Building2,
      color: '#14b8a6',
      trend: '',
      isPositive: true,
    },
    {
      title: 'Foydalanuvchilar',
      value: stats.totalUsers,
      icon: Users,
      color: '#3b82f6',
      trend: '',
      isPositive: true,
    },
    {
      title: 'To\'lovlar',
      value: stats.totalPayments,
      icon: ShoppingCart,
      color: '#f59e0b',
      trend: '',
      isPositive: true,
    },
    {
      title: 'Jami Daromad',
      value: `${(safeNum(stats.totalRevenue) / 1_000_000).toFixed(1)}M so'm`,
      icon: DollarSign,
      color: '#10b981',
      trend: '',
      isPositive: true,
    },
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
        className="hidden lg:block fixed left-0 top-0 h-full w-64 border-r"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div 
              className="p-2.5 rounded-2xl"
              style={{ background: `${accentColor.color}20` }}
            >
              <LayoutDashboard className="w-6 h-6" style={{ color: accentColor.color }} />
            </div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
                  style={{
                    background: isActive 
                      ? accentColor.gradient
                      : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    color: isActive ? '#ffffff' : (isDark ? '#ffffff' : '#111827'),
                  }}
                >
                  <Icon className="w-5 h-5" />
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
            className="absolute left-0 top-0 h-full w-64 border-r"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2.5 rounded-2xl"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <LayoutDashboard className="w-6 h-6" style={{ color: accentColor.color }} />
                  </div>
                  <h1 className="text-xl font-bold">Admin Panel</h1>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-xl"
                  style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-2">
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
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
                      style={{
                        background: isActive 
                          ? accentColor.gradient
                          : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        color: isActive ? '#ffffff' : (isDark ? '#ffffff' : '#111827'),
                      }}
                    >
                      <Icon className="w-5 h-5" />
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
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-xl lg:text-2xl font-bold">
                  {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h2>
                <p 
                  className="text-sm"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  {new Date().toLocaleDateString('uz-UZ', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
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
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {statsLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={`st-sk-${index}`}
                        className="p-6 rounded-3xl border animate-pulse"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="h-12 w-12 rounded-2xl bg-white/10" />
                          <div className="h-6 w-14 rounded-lg bg-white/10" />
                        </div>
                        <div className="h-4 w-24 rounded bg-white/10 mb-2" />
                        <div className="h-8 w-32 rounded-lg bg-white/10" />
                      </div>
                    ))
                  : statsCards.map((stat, index) => {
                      const Icon = stat.icon;
                      const TrendIcon = stat.isPositive ? TrendingUp : TrendingDown;
                      return (
                        <div
                          key={index}
                          className="p-6 rounded-3xl border"
                          style={{
                            background: isDark
                              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                              : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            boxShadow: isDark
                              ? '0 10px 30px rgba(0, 0, 0, 0.3)'
                              : '0 10px 30px rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div
                              className="p-3 rounded-2xl"
                              style={{ background: `${stat.color}20` }}
                            >
                              <Icon className="w-6 h-6" style={{ color: stat.color }} />
                            </div>
                            <div
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                              style={{
                                background: stat.isPositive
                                  ? 'rgba(16, 185, 129, 0.1)'
                                  : 'rgba(239, 68, 68, 0.1)',
                                color: stat.isPositive ? '#10b981' : '#ef4444',
                              }}
                            >
                              <TrendIcon className="w-3 h-3" />
                              {stat.trend}
                            </div>
                          </div>
                          <p
                            className="text-sm mb-1"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                          >
                            {stat.title}
                          </p>
                          <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                      );
                    })}
              </div>

              {/* Recent Activity */}
              <div
                className="p-6 rounded-3xl border"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark ? '0 10px 30px rgba(0, 0, 0, 0.3)' : '0 10px 30px rgba(0, 0, 0, 0.05)',
                }}
              >
                <h3 className="text-lg font-bold mb-4">So'nggi buyurtmalar (KV)</h3>
                <div className="space-y-3">
                  {statsLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
                      <p className="text-sm" style={{ opacity: 0.6 }}>
                        Yuklanmoqda…
                      </p>
                    </div>
                  ) : recentActivity.length === 0 ? (
                    <p className="text-sm" style={{ opacity: 0.6 }}>
                      Hozircha yozuvlar yo'q yoki buyurtmalar boshqa saqlanmagan bo'lishi mumkin.
                    </p>
                  ) : (
                    recentActivity.map((row) => {
                      const t = new Date(row.createdAt).getTime();
                      const dateStr = Number.isFinite(t)
                        ? new Date(row.createdAt).toLocaleString('uz-UZ', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';
                      return (
                        <div key={String(row.id)} className="flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <span className="font-semibold block truncate">
                              {row.orderId || row.id}
                              {row.orderType ? (
                                <span style={{ opacity: 0.55 }}> · {row.orderType}</span>
                              ) : null}
                            </span>
                            <span style={{ opacity: 0.7 }} className="block truncate">
                              {row.customerName?.trim() || 'Mijoz'} · {paymentStatusLabelUz(row.paymentStatus)} ·{' '}
                              {formatSumUz(row.totalAmount)} so'm
                            </span>
                          </div>
                          <span className="shrink-0" style={{ opacity: 0.55 }}>
                            {dateStr}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'branches' && (
            <BranchesView onStatsUpdate={() => void loadStats({ soft: true })} />
          )}
          {activeTab === 'statistics' && <AdminBranchStatistics />}
          {activeTab === 'analytics' && <AdminBranchAnalytics />}
          {activeTab === 'orders' && <OrdersManagement />}
          {activeTab === 'users' && (
            <UsersView onStatsUpdate={() => void loadStats({ soft: true })} />
          )}
          {activeTab === 'payments' && (
            <PaymentsView onStatsUpdate={() => void loadStats({ soft: true })} />
          )}
          {activeTab === 'security' && <AdminSecurityView />}
        </div>
      </main>
    </div>
  );
}