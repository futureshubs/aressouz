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
  hasDillerDataContent,
  loadDillerData,
  normalizeDillerData,
  saveDillerData,
  type DillerData,
} from '../utils/dillerData';
import {
  dillerApiFetchData,
  dillerApiPushData,
  isOfflineDillerToken,
} from '../utils/dillerApi';

const NAV_BOTTOM = 'calc(5.5rem + var(--app-safe-bottom, 0px))';
const SAVE_DEBOUNCE_MS = 700;

type SyncState = 'loading' | 'synced' | 'saving' | 'offline' | 'error';

export default function DillerDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [session, setSession] = useState(readDillerSession());
  const [activeTab, setActiveTab] = useState<DillerTabId>('sotuv');
  const [data, setData] = useState<DillerData>(createEmptyDillerData);
  const [booting, setBooting] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>('loading');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydrateFromServer = useCallback(async (token: string) => {
    setSyncState('loading');
    const local = loadDillerData();

    if (isOfflineDillerToken(token)) {
      setData(local);
      setSyncState('offline');
      return;
    }

    const remote = await dillerApiFetchData(token);

    if (!remote.ok) {
      if (remote.unauthorized) {
        clearDillerSession();
        navigate('/diller', { replace: true });
        return;
      }
      if (hasDillerDataContent(local)) {
        setData(local);
        setSyncState('offline');
        toast.error('Serverga ulanilmadi — mahalliy nusxa ishlatilmoqda');
      } else {
        setData(local);
        setSyncState('offline');
      }
      return;
    }

    const serverRaw = remote.data;
    const serverHas = serverRaw && hasDillerDataContent(normalizeDillerData(serverRaw));
    const localHas = hasDillerDataContent(local);

    if (serverHas && serverRaw) {
      const normalized = normalizeDillerData(serverRaw);
      setData(normalized);
      saveDillerData(normalized);
      setSyncState('synced');
      return;
    }

    if (localHas) {
      setData(local);
      saveDillerData(local);
      const push = await dillerApiPushData(token, local);
      if (push.ok) {
        setSyncState('synced');
        toast.success('Mahalliy ma’lumot serverga ko‘chirildi');
      } else {
        setSyncState(push.unauthorized ? 'error' : 'offline');
        if (!push.unauthorized) toast.error(push.error);
      }
      return;
    }

    const empty = normalizeDillerData(null);
    setData(empty);
    saveDillerData(empty);
    setSyncState('synced');
  }, [navigate]);

  useEffect(() => {
    const s = readDillerSession();
    if (!s?.token) {
      navigate('/diller', { replace: true });
      return;
    }
    setSession(s);
    void (async () => {
      await hydrateFromServer(s.token);
      setBooting(false);
    })();
  }, [navigate, hydrateFromServer]);

  const flushSave = useCallback(async (token: string, payload: DillerData) => {
    setSyncState('saving');
    saveDillerData(payload);
    if (isOfflineDillerToken(token)) {
      setSyncState('offline');
      return;
    }
    const result = await dillerApiPushData(token, payload);
    if (result.ok) {
      setSyncState('synced');
      return;
    }
    if (result.unauthorized) {
      clearDillerSession();
      toast.error('Sessiya tugadi — qayta kiring');
      navigate('/diller', { replace: true });
      return;
    }
    setSyncState('offline');
    toast.error(result.error || 'Serverga saqlanmadi');
  }, [navigate]);

  const persist = useCallback(
    (next: DillerData) => {
      setData(next);
      saveDillerData(next);
      const token = readDillerSession()?.token;
      if (!token) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void flushSave(token, next);
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const logout = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    clearDillerSession();
    toast.success('Chiqildi');
    navigate('/diller', { replace: true });
  };

  const reload = async () => {
    const s = readDillerSession();
    if (!s?.token) return;
    setBooting(true);
    await hydrateFromServer(s.token);
    setBooting(false);
    toast.success('Serverdan yangilandi');
  };

  const openDebtCount = useMemo(
    () => data.sales.filter((s) => (s.debtAmount ?? 0) > 0).length,
    [data.sales],
  );

  const syncLabel = useMemo(() => {
    switch (syncState) {
      case 'loading':
        return 'Yuklanmoqda…';
      case 'saving':
        return 'Saqlanmoqda…';
      case 'synced':
        return 'Bulutda saqlangan';
      case 'offline':
        return 'Oflayn rejim';
      case 'error':
        return 'Xatolik';
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
  const SyncIcon = syncState === 'offline' || syncState === 'error' ? CloudOff : Cloud;

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
                    className={`w-3 h-3 shrink-0 ${syncState === 'saving' ? 'animate-pulse' : ''}`}
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
                onClick={() => void reload()}
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
