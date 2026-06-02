import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import AressoPanelBrand from '../components/brand/AressoPanelBrand';
import DillerBottomNav, { dillerTabTitle, type DillerTabId } from '../components/diller/DillerBottomNav';
import { DillerPanelContent } from '../components/diller/DillerPanelTabs';
import { clearDillerSession, readDillerSession } from '../utils/dillerSession';
import { loadDillerData, saveDillerData, type DillerData } from '../utils/dillerData';

const NAV_BOTTOM = 'calc(5.5rem + var(--app-safe-bottom, 0px))';

export default function DillerDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [session, setSession] = useState(readDillerSession());
  const [activeTab, setActiveTab] = useState<DillerTabId>('sotuv');
  const [data, setData] = useState<DillerData>(() => loadDillerData());

  useEffect(() => {
    const s = readDillerSession();
    if (!s) {
      navigate('/diller', { replace: true });
      return;
    }
    setSession(s);
  }, [navigate]);

  const persist = useCallback((next: DillerData) => {
    setData(next);
    saveDillerData(next);
  }, []);

  const logout = () => {
    clearDillerSession();
    toast.success('Chiqildi');
    navigate('/diller', { replace: true });
  };

  const reload = () => {
    setData(loadDillerData());
    toast.success('Ma’lumot yangilandi');
  };

  const openDebtCount = useMemo(
    () => data.sales.filter((s) => (s.debtAmount ?? 0) > 0).length,
    [data.sales],
  );

  if (!session) {
    return null;
  }

  return (
    <div
      className="flex flex-col min-h-[var(--app-viewport-height,100dvh)]"
      style={{
        background: isDark ? '#000' : '#f4f4f5',
        color: isDark ? '#fff' : '#111',
        paddingTop: 'var(--app-safe-top, 0px)',
      }}
    >
      <header
        className="shrink-0 sticky top-0 z-30 border-b px-4 py-3 flex items-center justify-between gap-3"
        style={{
          background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="min-w-0 flex-1">
          <AressoPanelBrand variant="seller" size="sm" showPanelLabel={false} isDark={isDark} accentColor={accentColor.color} />
          <p className="text-xs font-bold truncate mt-0.5" style={{ color: accentColor.color }}>
            {dillerTabTitle(activeTab)}
          </p>
          <p className="text-[10px] opacity-60 truncate">{session.displayName} · Diller</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={reload}
            className="p-2 rounded-xl active:scale-95"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            aria-label="Yangilash"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl text-red-400 active:scale-95"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            aria-label="Chiqish"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main
        className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 max-w-lg mx-auto w-full"
        style={{ paddingBottom: NAV_BOTTOM }}
      >
        <DillerPanelContent tab={activeTab} data={data} onDataChange={persist} />
      </main>

      <DillerBottomNav activeTab={activeTab} onTabChange={setActiveTab} openDebtCount={openDebtCount} />
    </div>
  );
}
