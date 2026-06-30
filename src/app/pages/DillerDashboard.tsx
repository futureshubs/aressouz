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
  mergeDillerData,
  mergeShopOrders,
  saveDillerData,
  type DillerData,
} from '../utils/dillerData';
import { clearDillerCloudCreds } from '../utils/dillerSyncMeta';
import { runDillerSync, flushDillerToCloud, type DillerSyncStatus } from '../utils/dillerSync';
import { readDillerSyncMeta, touchLocalModified } from '../utils/dillerSyncMeta';
import {
  dillerMainScrollClass,
  dillerPageShellClass,
  DILLER_NAV_BOTTOM_PADDING,
} from '../components/diller/dillerMobileLayout';

const NAV_BOTTOM = DILLER_NAV_BOTTOM_PADDING;
/** Bulutga avtomatik yuborish — har 2 daqiqa (faqat /diller) */
const CLOUD_AUTO_SYNC_MS = 2 * 60 * 1000;

export default function DillerDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [session, setSession] = useState(readDillerSession());
  const [activeTab, setActiveTab] = useState<DillerTabId>('sotuv');
  const [data, setData] = useState<DillerData>(() => loadDillerData() || createEmptyDillerData());
  const [booting, setBooting] = useState(true);
  const [syncState, setSyncState] = useState<DillerSyncStatus>('loading');
  const pendingDataRef = useRef<DillerData | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const applySync = useCallback((opts?: { silent?: boolean; forcePull?: boolean; preferLocal?: boolean }) => {
    setSyncState((s) => (s === 'loading' ? s : 'saving'));
    return runDillerSync({
      silent: opts?.silent,
      forcePull: opts?.forcePull,
      preferLocal: opts?.preferLocal,
    }).then((outcome) => {
      const pending = pendingDataRef.current;
      const disk = loadDillerData();
      const base = pending ?? disk;
      const merged = mergeDillerData(base, outcome.data);

      if (pending) {
        const ordersUpdated = mergeShopOrders(pending, outcome.data.shopOrders ?? []);
        pendingDataRef.current = ordersUpdated;
        saveDillerData(mergeDillerData(ordersUpdated, outcome.data));
        setData(ordersUpdated);
      } else {
        pendingDataRef.current = null;
        saveDillerData(merged);
        setData(merged);
      }

      setSyncState(outcome.status);
      setSession(readDillerSession());
      if (outcome.message && !opts?.silent) {
        if (outcome.status === 'offline') {
          toast.warning(outcome.message);
        } else {
          toast.success(outcome.message);
        }
      }
      return { ...outcome, data: pending ? pendingDataRef.current! : merged };
    });
  }, []);

  useEffect(() => {
    if (!readDillerSession()) {
      navigate('/diller', { replace: true });
      return;
    }
    setSession(readDillerSession());
    setData(loadDillerData() || createEmptyDillerData());
    setBooting(false);

    void applySync({
      silent: false,
      forcePull: true,
    });
  }, [navigate, applySync]);

  useEffect(() => {
    const onOnline = () => {
      void applySync({ silent: true });
    };
    window.addEventListener('online', onOnline);

    const interval = window.setInterval(() => {
      void applySync({ silent: true });
    }, CLOUD_AUTO_SYNC_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(interval);
    };
  }, [applySync]);

  const handleTabChange = useCallback((tab: DillerTabId) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0 });
    });
  }, []);

  const persist = useCallback((next: DillerData) => {
    pendingDataRef.current = next;
    setData(next);
    saveDillerData(next);
    if (hasDillerDataContent(next)) {
      touchLocalModified();
    }
    setSyncState((s) => (s === 'loading' || s === 'saving' ? s : 'offline'));
  }, []);

  const logout = async () => {
    if (pendingDataRef.current) {
      saveDillerData(pendingDataRef.current);
      touchLocalModified();
    }
    await flushDillerToCloud();
    clearDillerCloudCreds();
    clearDillerSession();
    toast.success('Chiqildi');
    navigate('/diller', { replace: true });
  };

  const reload = () => {
    setSyncState('loading');
    void applySync({ silent: false, forcePull: true });
  };

  const openDebtCount = useMemo(
    () => data.sales.filter((s) => (s.debtAmount ?? 0) > 0).length,
    [data.sales],
  );

  const pendingOrderCount = useMemo(
    () => (data.shopOrders ?? []).filter((o) => o.status === 'pending').length,
    [data.shopOrders],
  );

  const dataIsEmpty = useMemo(() => !hasDillerDataContent(data), [data]);

  const syncLabel = useMemo(() => {
    const meta = readDillerSyncMeta();
    switch (syncState) {
      case 'loading':
        return 'Yuklanmoqda…';
      case 'saving':
        return 'Bulutga yuborilmoqda…';
      case 'synced':
        return 'Bulutda saqlangan';
      case 'offline':
        return meta.pendingPush ? 'Mahalliy saqlangan' : 'Oflayn · mahalliy';
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
      className={dillerPageShellClass}
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
          Internet qaytganida yoki har 2 daqiqada bulutga yuboriladi
        </div>
      ) : null}

      {dataIsEmpty && syncState !== 'loading' ? (
        <div
          className="mx-4 mt-2 px-3 py-2.5 rounded-xl text-[11px] text-center max-w-lg w-full self-center"
          style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)' }}
        >
          Ma’lumot topilmadi. Yuqoridagi{' '}
          <span className="font-semibold">Yangilash</span> tugmasini bosing yoki qayta kiring (
          /diller).
          {syncState === 'offline' ? ' Serverga ulanish yo‘q.' : null}
        </div>
      ) : null}

      {pendingOrderCount > 0 ? (
        <div
          className="mx-4 mt-2 px-3 py-2 rounded-xl text-[10px] text-center max-w-lg w-full self-center flex items-center justify-center gap-1.5"
          style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.1)' }}
        >
          <span className="font-bold text-red-400">{pendingOrderCount} ta yangi QR buyurtma</span>
          <span className="opacity-60">— Qarz → Buyurtma</span>
        </div>
      ) : null}

      <main
        ref={mainScrollRef}
        className={`${dillerMainScrollClass} px-4 py-4 max-w-lg mx-auto w-full`}
        style={{ paddingBottom: NAV_BOTTOM }}
      >
        <DillerPanelContent tab={activeTab} data={data} onDataChange={persist} />
      </main>

      <DillerBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        openDebtCount={openDebtCount}
        pendingOrderCount={pendingOrderCount}
      />
    </div>
  );
}
