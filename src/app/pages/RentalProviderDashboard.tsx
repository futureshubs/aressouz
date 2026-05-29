import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import {
  LogOut,
  Loader2,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import AressoPanelBrand from '../components/brand/AressoPanelBrand';
import { toast } from 'sonner';
import { publicAnonKey } from '../../../utils/supabase/info';
import { edgeFunctionBaseUrl } from '../utils/edgeFunctionBaseUrl';
import { RentalDashboard } from '../components/rental/RentalDashboard';
import RentalProviderBottomNav, {
  type RentalProviderNavTabId,
} from '../components/rental/RentalProviderBottomNav';
import {
  clearRentalProviderSession,
  readRentalProviderSession,
  type RentalProviderSession,
} from '../utils/rentalProviderSession';
import { buildRentalPanelHeaders } from '../utils/requestAuth';
import { useTabVisible } from '../hooks/useTabVisible';
import PanelPushSetup from '../components/brand/PanelPushSetup';

const SIDEBAR_TABS: { id: RentalProviderNavTabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Ijara buyurtmalar', icon: ShoppingCart },
  { id: 'products', label: 'Mahsulotlar', icon: Package },
  { id: 'warehouse', label: 'Ombor', icon: Warehouse },
  { id: 'statistics', label: 'Statistika', icon: BarChart3 },
  { id: 'analytics', label: 'Data analitika', icon: TrendingUp },
];

export default function RentalProviderDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBase = edgeFunctionBaseUrl();
  const tabVisible = useTabVisible();

  const [session, setSession] = useState<RentalProviderSession | null>(null);
  const [activeTab, setActiveTab] = useState<RentalProviderNavTabId>('dashboard');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [profileShop, setProfileShop] = useState('');

  useEffect(() => {
    const p = readRentalProviderSession();
    if (!p?.token || !p?.branchId) {
      navigate('/ijara-panel');
      return;
    }
    if (!p.providerId?.trim()) {
      clearRentalProviderSession();
      toast.error('Sessiya eskirgan — qayta kiring');
      navigate('/ijara-panel');
      return;
    }
    setSession(p);
    setProfileShop(p.shopName || p.displayName || p.login || 'Ijara');
  }, [navigate]);

  const refreshPending = useCallback(async () => {
    const s = readRentalProviderSession();
    if (!s?.branchId) return;
    try {
      const res = await fetch(
        `${apiBase}/rentals/orders/${encodeURIComponent(s.branchId)}`,
        { headers: buildRentalPanelHeaders() },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !Array.isArray(data.orders)) return;
      const n = data.orders.filter((o: any) => {
        const st = String(o.status || '').toLowerCase();
        return st === 'active' && !o.branchAcceptedAt;
      }).length;
      setPendingOrders(n);
    } catch {
      /* ignore */
    }
  }, [apiBase]);

  useEffect(() => {
    void refreshPending();
    if (!tabVisible) return;
    const id = window.setInterval(() => void refreshPending(), 4000);
    return () => window.clearInterval(id);
  }, [refreshPending, tabVisible, activeTab]);

  useEffect(() => {
    if (!session?.token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/rentals/provider/me`, {
          headers: buildRentalPanelHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok || !data.success) return;
        const pr = data.provider;
        if (pr?.shopName) setProfileShop(pr.shopName);
        else if (pr?.displayName) setProfileShop(pr.displayName);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.token, apiBase]);

  const mobileNavLabel = useMemo(() => {
    const m: Record<string, string> = {
      dashboard: 'Dashboard',
      orders: 'Buyurtmalar',
      products: 'Mahsulotlar',
      warehouse: 'Ombor',
      statistics: 'Statistika',
      analytics: 'Analitika',
    };
    return m[activeTab] || 'Dashboard';
  }, [activeTab]);

  const logout = async () => {
    setLogoutBusy(true);
    try {
      const tok = session?.token;
      if (tok) {
        try {
          await fetch(`${apiBase}/rentals/provider/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              'X-Rental-Provider-Token': tok,
            },
          });
        } catch {
          /* ignore */
        }
      }
      clearRentalProviderSession();
      toast.success('Chiqildi');
    } finally {
      setLogoutBusy(false);
    }
    navigate('/ijara-panel');
  };

  if (!session) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 app-safe-pt"
        style={{ background: isDark ? '#000' : '#f9fafb' }}
      >
        <AressoPanelBrand
          variant="ijara"
          size="lg"
          align="center"
          showPanelLabel={false}
          isDark={isDark}
          accentColor={accentColor.color}
        />
        <Loader2 className="w-10 h-10 animate-spin shrink-0" style={{ color: accentColor.color }} />
      </div>
    );
  }

  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <div
      className="app-panel-viewport app-safe-pad flex flex-col min-h-[100dvh]"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827',
      }}
    >
      <aside
        className="hidden lg:flex lg:flex-col fixed left-0 top-0 z-30 h-[100dvh] max-h-[100dvh] w-64 min-w-[16rem] border-r overflow-hidden app-safe-pl"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: border,
          paddingTop: 'var(--app-safe-top)',
        }}
      >
        <div className="app-panel-sidebar-scroll flex flex-col flex-1 p-5">
          <AressoPanelBrand
            variant="ijara"
            size="sm"
            layout="row"
            align="left"
            title={profileShop}
            subtitle={session.login || session.branchId}
            className="mb-6"
            isDark={isDark}
            accentColor={accentColor.color}
          />
          <nav className="flex-1 space-y-1">
            {SIDEBAR_TABS.map((tab) => {
              const Icon = tab.icon;
              const on = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: on ? `${accentColor.color}22` : 'transparent',
                    color: on ? accentColor.color : isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)',
                  }}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {tab.label}
                  {tab.id === 'orders' && pendingOrders > 0 ? (
                    <span
                      className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: '#ef4444' }}
                    >
                      {pendingOrders}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={logoutBusy}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{
              background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
              color: '#ef4444',
            }}
          >
            {logoutBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Chiqish
          </button>
        </div>
      </aside>

      <header
        className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b app-safe-pt shrink-0"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: border,
        }}
      >
        <AressoPanelBrand
          variant="ijara"
          size="xs"
          layout="row"
          align="left"
          showPanelLabel={false}
          title={profileShop}
          subtitle={mobileNavLabel}
          isDark={isDark}
          accentColor={accentColor.color}
        />
        <button
          type="button"
          onClick={() => void logout()}
          disabled={logoutBusy}
          className="p-2 rounded-xl disabled:opacity-50"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
          aria-label="Chiqish"
        >
          {logoutBusy ? (
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#ef4444' }} />
          ) : (
            <LogOut className="w-5 h-5" style={{ color: '#ef4444' }} />
          )}
        </button>
      </header>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
        <div className="app-panel-main-scroll p-4 lg:p-6 flex-1 min-h-0 overflow-y-auto max-lg:pb-[calc(6.5rem+var(--app-safe-bottom,0px))]">
          <PanelPushSetup
            className="mb-4"
            scope={{ panel: 'ijara', scopeId: session.providerId }}
            headers={buildRentalPanelHeaders()}
          />
          <RentalDashboard
            branchId={session.branchId}
            variant="provider"
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      </main>

      <RentalProviderBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingOrders={pendingOrders}
      />
    </div>
  );
}
