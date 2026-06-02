import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import DillerBottomNav, { getDillerTabMeta, type DillerTabId } from '../components/diller/DillerBottomNav';
import { resolveAressoPanelLogoSrc } from '../components/brand/AressoPanelBrand';
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

  const tabMeta = getDillerTabMeta(activeTab);
  const TabIcon = tabMeta.icon;
  const logoSrc = resolveAressoPanelLogoSrc('seller', isDark);

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
        className="shrink-0 sticky top-0 z-30 border-b px-4 py-3"
        style={{
          background: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: accentColor.color,
                }}
              >
                <TabIcon className="w-5 h-5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h1
                  className="text-lg font-black leading-tight truncate"
                  style={{ color: accentColor.color }}
                >
                  {tabMeta.label}
                </h1>
                <p className="text-[10px] opacity-55 truncate mt-0.5">
                  {session.displayName} · Diller panel
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2">
            <div
              className="rounded-2xl p-1.5"
              style={{
                background: isDark
                  ? `linear-gradient(145deg, ${accentColor.color}22, rgba(255,255,255,0.04))`
                  : `linear-gradient(145deg, ${accentColor.color}14, #fff)`,
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                boxShadow: isDark ? `0 4px 16px ${accentColor.color}18` : `0 4px 14px ${accentColor.color}12`,
              }}
            >
              <img
                src={logoSrc}
                alt="Aresso"
                width={36}
                height={36}
                className="object-contain block"
                decoding="async"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reload}
                className="p-2 rounded-xl active:scale-95"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                aria-label="Yangilash"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-xl text-red-400 active:scale-95"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                aria-label="Chiqish"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
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
