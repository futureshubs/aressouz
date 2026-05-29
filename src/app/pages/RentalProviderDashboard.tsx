import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Loader2 } from 'lucide-react';
import AressoPanelBrand from '../components/brand/AressoPanelBrand';
import { toast } from 'sonner';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { RentalDashboard } from '../components/rental/RentalDashboard';
export default function RentalProviderDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;
  const [session, setSession] = useState<{
    token: string;
    branchId: string;
    displayName?: string;
    login?: string;
  } | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('rentalProviderSession');
    if (!raw) {
      navigate('/ijara-panel');
      return;
    }
    try {
      const p = JSON.parse(raw);
      if (!p?.token || !p?.branchId) {
        localStorage.removeItem('rentalProviderSession');
        navigate('/ijara-panel');
        return;
      }
      setSession(p);
    } catch {
      navigate('/ijara-panel');
    }
  }, [navigate]);

  const logout = async () => {
    setLogoutBusy(true);
    try {
      const tok = session?.token;
      if (tok) {
        try {
          await fetch(
            `${apiBaseUrl}/rentals/provider/logout`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                'X-Rental-Provider-Token': tok,
              },
            },
          );
        } catch {
          /* ignore */
        }
      }
      localStorage.removeItem('rentalProviderSession');
      toast.success('Chiqildi');
    } finally {
      setLogoutBusy(false);
    }
    navigate('/ijara-panel');
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 app-safe-pt" style={{ background: isDark ? '#000' : '#f9fafb' }}>
        <AressoPanelBrand variant="ijara" size="lg" align="center" showPanelLabel={false} isDark={isDark} accentColor={accentColor.color} />
        <Loader2 className="w-10 h-10 animate-spin shrink-0" style={{ color: accentColor.color }} aria-hidden />
      </div>
    );
  }

  return (
    <div
      className="app-panel-viewport app-safe-pad"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: isDark ? '#ffffff' : '#111827',
      }}
    >
      <aside
        className="hidden lg:flex lg:flex-col fixed left-0 top-0 z-30 h-[100dvh] max-h-[100dvh] w-64 min-w-[16rem] border-r overflow-hidden app-safe-pl"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          paddingTop: 'var(--app-safe-top)',
        }}
      >
        <div className="app-panel-sidebar-scroll p-6 pb-4">
          <AressoPanelBrand
            variant="ijara"
            size="sm"
            layout="row"
            align="left"
            title={session.displayName || session.login || 'Ijara'}
            subtitle={session.branchId}
            className="mb-6"
            isDark={isDark}
            accentColor={accentColor.color}
          />
          <button
            type="button"
            onClick={() => void logout()}
            disabled={logoutBusy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
              color: '#ef4444',
            }}
          >
            {logoutBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <LogOut className="w-4 h-4 shrink-0" />}
            Chiqish
          </button>
        </div>
      </aside>

      <header
        className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b app-safe-pt"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <AressoPanelBrand
          variant="ijara"
          size="xs"
          layout="row"
          align="left"
          showPanelLabel={false}
          title={session.displayName || 'Ijara'}
          isDark={isDark}
          accentColor={accentColor.color}
        />
        <button
          type="button"
          onClick={() => void logout()}
          disabled={logoutBusy}
          className="p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
          aria-label="Chiqish"
        >
          {logoutBusy ? (
            <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: '#ef4444' }} />
          ) : (
            <LogOut className="w-5 h-5" style={{ color: '#ef4444' }} />
          )}
        </button>
      </header>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
        <div className="app-panel-main-scroll p-4 lg:p-6 flex-1 min-h-0 overflow-y-auto">
          <RentalDashboard branchId={session.branchId} />
        </div>
      </main>
    </div>
  );
}
