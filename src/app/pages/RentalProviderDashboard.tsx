import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../context/ThemeContext';
import { KeyRound, LogOut } from 'lucide-react';
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
    navigate('/ijara-panel');
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center app-safe-pt" style={{ background: isDark ? '#000' : '#f9fafb' }}>
        <p className="text-sm opacity-60">Yuklanmoqda…</p>
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
          <div className="p-4 rounded-2xl mb-6" style={{ background: `${accentColor.color}20` }}>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-5 h-5" style={{ color: accentColor.color }} />
              <span className="font-bold text-sm">Ijara paneli</span>
            </div>
            <p className="text-xs opacity-70 truncate">{session.displayName || session.login}</p>
            <p className="text-[10px] opacity-50 font-mono truncate mt-1">{session.branchId}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
            style={{
              background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
              color: '#ef4444',
            }}
          >
            <LogOut className="w-4 h-4" />
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
        <span className="font-semibold truncate pr-2">Ijara</span>
        <button
          type="button"
          onClick={() => void logout()}
          className="p-2 rounded-xl"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
          aria-label="Chiqish"
        >
          <LogOut className="w-5 h-5" style={{ color: '#ef4444' }} />
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
