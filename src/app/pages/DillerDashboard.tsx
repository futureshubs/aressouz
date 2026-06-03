import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Cloud, CloudOff, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import DillerBottomNav, { getDillerTabMeta, type DillerTabId } from '../components/diller/DillerBottomNav';
import { resolveAressoPanelLogoSrc } from '../components/brand/AressoPanelBrand';
import { DillerPanelContent } from '../components/diller/DillerPanelTabs';
import { clearDillerSession, readDillerSession } from '../utils/dillerSession';
import {
  createEmptyDillerData,
  loadDillerData,
  saveDillerData,
  type DillerData,
} from '../utils/dillerData';
import { clearDillerCloudCreds } from '../utils/dillerSyncMeta';
import { pushDillerLocalNow, runDillerSync, type DillerSyncStatus } from '../utils/dillerSync';
import { readDillerSyncMeta, touchLocalModified } from '../utils/dillerSyncMeta';

const NAV_BOTTOM = 'calc(5.5rem + var(--app-safe-bottom, 0px))';
const SAVE_DEBOUNCE_MS = 600;
const AUTO_SYNC_INTERVAL_MS = 25_000;

export default function DillerDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [session, setSession] = useState(readDillerSession());
  const [activeTab, setActiveTab] = useState<DillerTabId>('sotuv');
  const [data, setData] = useState<DillerData>(() => loadDillerData() || createEmptyDillerData());
  const [booting, setBooting] = useState(true);
  const [syncState, setSyncState] = useState<DillerSyncStatus>('loading');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef(false);

  const applySync = useCallback((silent: boolean) => {
    if (syncInFlightRef.current) return Promise.resolve();
    syncInFlightRef.current = true;
    return runDillerSync({ silent })
      .then((outcome) => {
        setData(outcome.data);
        setSyncState(outcome.status);
        setSession(readDillerSession());
        if (outcome.message && !silent) {
          toast.success(outcome.message);
        }
        return outcome;
      })
      .finally(() => {
        syncInFlightRef.current = false;
      });
  }, []);

  useEffect(() => {
    if (!readDillerSession()) {
      navigate('/diller', { replace: true });
      return;
    }
    setSession(readDillerSession());
    setData(loadDillerData());
    setBooting(false);

    void applySync(false);
  }, [navigate, applySync]);

  useEffect(() => {
    const onOnline = () => {
      void applySync(false);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void applySync(true);
      }
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    const interval = window.setInterval(() => {
      const meta = readDillerSyncMeta();
      if (meta.pendingPush || syncState === 'offline') {
        void applySync(true);
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [applySync, syncState]);

  const persist = useCallback(
    (next: DillerData) => {
      setData(next);
      saveDillerData(next);
      touchLocalModified();
      setSyncState((s) => (s === 'loading' ? s : 'saving'));

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void pushDillerLocalNow().then((outcome) => {
          setData(outcome.data);
          setSyncState(outcome.status);
          if (outcome.status === 'offline' && readDillerSyncMeta().pendingPush) {
            /* keyingi online/sync interval yuboradi */
          }
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const logout = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    clearDillerCloudCreds();
    clearDillerSession();
    toast.success('Chiqildi');
    navigate('/diller', { replace: true });
  };

  const reload = () => {
    setSyncState('loading');
    void applySync(false);
  };

  const openDebtCount = useMemo(
    () => data.sales.filter((s) => (s.debtAmount ?? 0) > 0).length,
    [data.sales],
  );

  const syncLabel = useMemo(() => {
    const meta = readDillerSyncMeta();
    switch (syncState) {
      case 'loading':
        return 'Yuklanmoqda…';
      case 'saving':
        return 'Saqlanmoqda…';
      case 'synced':
        return 'Bulutda saqlangan';
      case 'offline':
        return meta.pendingPush ? 'Oflayn · navbatda' : 'Oflayn · mahalliy';
      default:
        return '';
    }
  }, [syncState]);

  if (!session || booting) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 min-h-[var(--app-viewport-height,100dvh)]"
        style={{ background: isDark ? '#000' : '#f4f4f5', color: isDark ? '#fff' : '#111' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        <p className="text-sm opacity-60">Ma’lumot yuklanmoqda…</p>
      </div>
    );
  }

  const tabMeta = getDillerTabMeta(activeTab);
  const TabIcon = tabMeta.icon;
  const logoSrc = resolveAressoPanelLogoSrc('seller', isDark);
  const SyncIcon = syncState === 'offline' ? CloudOff : Cloud;
  const meta = readDillerSyncMeta();

  return (
    <div
      className="flex flex-col h-[var(--app-viewport-height,100dvh)] max-h-[var(--app-viewport-height,100dvh)] min-h-0 overflow-hidden"
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
                <p className="text-[10px] opacity-55 truncate mt-0.5 flex items-center gap-1">
                  <SyncIcon
                    className={`w-3 h-3 shrink-0 ${syncState === 'saving' || syncState === 'loading' ? 'animate-pulse' : ''}`}
                    style={{
                      color:
                        syncState === 'synced'
                          ? '#10b981'
                          : syncState === 'offline'
                            ? '#f59e0b'
                            : undefined,
                    }}
                  />
                  {session.displayName} · {syncLabel}
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
                disabled={syncState === 'loading' || syncState === 'saving'}
                className="p-2 rounded-xl active:scale-95 disabled:opacity-40"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                aria-label="Yangilash"
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncState === 'loading' ? 'animate-spin' : ''}`}
                />
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

      {syncState === 'offline' && meta.pendingPush ? (
        <div
          className="mx-4 mt-2 px-3 py-2 rounded-xl text-[10px] text-center max-w-lg w-full self-center"
          style={{ background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.15)' }}
        >
          Internet qaytganida avtomatik Supabase ga yuboriladi
        </div>
      ) : null}

      <main
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 max-w-lg mx-auto w-full [-webkit-overflow-scrolling:touch]"
        style={{ paddingBottom: NAV_BOTTOM, touchAction: 'pan-y' }}
      >
        <DillerPanelContent tab={activeTab} data={data} onDataChange={persist} />
      </main>

      <DillerBottomNav activeTab={activeTab} onTabChange={setActiveTab} openDebtCount={openDebtCount} />
    </div>
  );
}
