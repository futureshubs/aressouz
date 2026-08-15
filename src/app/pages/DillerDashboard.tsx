import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Cloud, CloudOff, Download, Loader2, LogOut, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import DillerBottomNav, {
  getDillerTabMeta,
  type DillerTabId,
} from '../components/diller/DillerBottomNav';
import { resolveAressoPanelLogoSrc } from '../components/brand/AressoPanelBrand';
import { DillerPanelContent } from '../components/diller/DillerPanelTabs';
import { clearDillerSession, readDillerSession } from '../utils/dillerSession';
import {
  createEmptyDillerData,
  hasDillerDataContent,
  loadDillerData,
  saveDillerData,
  type DillerData,
} from '../utils/dillerData';
import { clearDillerCloudCreds, readDillerSyncMeta, touchLocalModified } from '../utils/dillerSyncMeta';
import {
  downloadDillerFromCloud,
  uploadDillerToCloud,
  type DillerSyncStatus,
} from '../utils/dillerSync';
import {
  dillerMainScrollClass,
  dillerPageShellClass,
  DILLER_NAV_BOTTOM_PADDING,
  DILLER_NAV_BOTTOM_PADDING_MENU_OPEN,
} from '../components/diller/dillerMobileLayout';
import {
  iosAccentFillStyle,
  iosGlassBarStyle,
  iosGlassCardStyle,
  iosGlassPageSurface,
  iosGlassTintStyle,
} from '../components/diller/dillerIosGlass';

const NAV_BOTTOM_CLOSED = DILLER_NAV_BOTTOM_PADDING;
const NAV_BOTTOM_OPEN = DILLER_NAV_BOTTOM_PADDING_MENU_OPEN;

function formatSyncTime(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t <= 0) return '';
  return new Intl.DateTimeFormat('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(t));
}

export default function DillerDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [session, setSession] = useState(readDillerSession());
  const [activeTab, setActiveTab] = useState<DillerTabId>('sotuv');
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<DillerData>(() => loadDillerData() || createEmptyDillerData());
  const [booting, setBooting] = useState(true);
  const [syncState, setSyncState] = useState<DillerSyncStatus>('offline');
  const [busyAction, setBusyAction] = useState<'upload' | 'download' | null>(null);
  const pendingDataRef = useRef<DillerData | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!readDillerSession()) {
      navigate('/diller', { replace: true });
      return;
    }
    setSession(readDillerSession());
    const local = loadDillerData() || createEmptyDillerData();
    setData(local);
    const meta = readDillerSyncMeta();
    setSyncState(meta.pendingPush ? 'offline' : meta.lastSyncedAt ? 'synced' : 'offline');
    setBooting(false);
  }, [navigate]);

  const handleTabChange = useCallback((tab: DillerTabId) => {
    setActiveTab(tab);
    setMenuOpen(false);
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
      setSyncState('offline');
    }
  }, []);

  const applyOutcome = useCallback((outcome: Awaited<ReturnType<typeof uploadDillerToCloud>>) => {
    pendingDataRef.current = null;
    saveDillerData(outcome.data);
    setData(outcome.data);
    setSyncState(outcome.status);
    setSession(readDillerSession());
    if (outcome.message) {
      if (outcome.status === 'offline') toast.warning(outcome.message);
      else toast.success(outcome.message);
    }
  }, []);

  /** Mahalliy → Supabase */
  const handleUpload = async () => {
    if (busyAction) return;
    if (pendingDataRef.current) {
      saveDillerData(pendingDataRef.current);
      touchLocalModified();
    }
    setBusyAction('upload');
    setSyncState('saving');
    try {
      const outcome = await uploadDillerToCloud();
      applyOutcome(outcome);
    } finally {
      setBusyAction(null);
    }
  };

  /** Supabase → mahalliy (oxirgi yuborilgan) */
  const handleDownload = async () => {
    if (busyAction) return;
    if (pendingDataRef.current) {
      saveDillerData(pendingDataRef.current);
    }
    const metaNow = readDillerSyncMeta();
    if (metaNow.pendingPush && hasDillerDataContent(loadDillerData())) {
      const ok = window.confirm(
        'Telefonda hali yuborilmagan o‘zgarishlar bor.\n\n' +
          'Yuklashdan oldin «Yuborish»ni bosing — aks holda ba’zi mahalliy yozuvlar chalkashishi mumkin.\n\n' +
          'Baribir yuklaysizmi?',
      );
      if (!ok) return;
    }
    setBusyAction('download');
    setSyncState('loading');
    try {
      const outcome = await downloadDillerFromCloud();
      applyOutcome(outcome);
    } finally {
      setBusyAction(null);
    }
  };

  const logout = async () => {
    if (pendingDataRef.current) {
      saveDillerData(pendingDataRef.current);
      touchLocalModified();
    }
    clearDillerCloudCreds();
    clearDillerSession();
    toast.success('Chiqildi — ma’lumot telefonda qoldi. Kerak bo‘lsa Yuborishni bosing');
    navigate('/diller', { replace: true });
  };

  const openDebtCount = useMemo(
    () => data.sales.filter((s) => !s.cancelled && (s.debtAmount ?? 0) > 0).length,
    [data.sales],
  );

  const pendingOrderCount = useMemo(
    () => (data.shopOrders ?? []).filter((o) => o.status === 'pending').length,
    [data.shopOrders],
  );

  const dataIsEmpty = useMemo(() => !hasDillerDataContent(data), [data]);

  const meta = readDillerSyncMeta();
  const lastSyncLabel = formatSyncTime(meta.lastSyncedAt);

  const syncLabel = useMemo(() => {
    if (busyAction === 'upload') return 'Yuborilmoqda…';
    if (busyAction === 'download') return 'Yuklanmoqda…';
    if (meta.pendingPush) return 'Mahalliy o‘zgarishlar bor';
    if (syncState === 'synced' && lastSyncLabel) return `Oxirgi: ${lastSyncLabel}`;
    if (syncState === 'synced') return 'Bulut bilan bir xil';
    return 'Faqat telefonda';
  }, [busyAction, meta.pendingPush, syncState, lastSyncLabel]);

  if (!session || booting) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 min-h-[var(--app-viewport-height,100dvh)]"
        style={iosGlassPageSurface(isDark)}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor.color }} />
        <p className="text-sm opacity-60">Ma’lumot yuklanmoqda…</p>
      </div>
    );
  }

  const tabMeta = getDillerTabMeta(activeTab);
  const TabIcon = tabMeta.icon;
  const logoSrc = resolveAressoPanelLogoSrc('seller', isDark);
  const SyncIcon = meta.pendingPush || syncState === 'offline' ? CloudOff : Cloud;
  const busy = Boolean(busyAction);
  const isMapTab = activeTab === 'xarita';
  const showTopBar = activeTab === 'sotuv';
  const navBottom = menuOpen ? NAV_BOTTOM_OPEN : NAV_BOTTOM_CLOSED;

  const btnBase =
    'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold active:scale-[0.97] disabled:opacity-40 min-h-[32px]';

  return (
    <div
      className={dillerPageShellClass}
      style={{
        ...iosGlassPageSurface(isDark),
        paddingTop: isMapTab ? 0 : 'var(--app-safe-top, 0px)',
      }}
    >
      {showTopBar ? (
      <header
        className="shrink-0 sticky top-0 z-30 px-4 py-3"
        style={iosGlassBarStyle(isDark)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  ...iosGlassCardStyle(isDark),
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
                    className={`w-3 h-3 shrink-0 ${busy ? 'animate-pulse' : ''}`}
                    style={{
                      color: meta.pendingPush
                        ? '#f59e0b'
                        : syncState === 'synced'
                          ? '#10b981'
                          : undefined,
                    }}
                  />
                  {session.displayName} · {syncLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="rounded-2xl p-1.5" style={iosGlassCardStyle(isDark)}>
              <img
                src={logoSrc}
                alt="Aresso"
                width={36}
                height={36}
                className="object-contain block"
                decoding="async"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={busy}
                className={btnBase}
                style={iosAccentFillStyle(accentColor.gradient, accentColor.color)}
                aria-label="Yuborish"
                title="Mahalliy ma’lumotlarni Supabase’ga yuborish"
              >
                {busyAction === 'upload' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Yuborish
              </button>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={busy}
                className={btnBase}
                style={{
                  ...iosGlassCardStyle(isDark),
                  color: isDark ? '#fff' : '#0f172a',
                }}
                aria-label="Yuklash"
                title="Oxirgi yuborilgan ma’lumotni bulutdan yuklash"
              >
                {busyAction === 'download' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Yuklash
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="p-2 rounded-xl text-red-400 active:scale-95"
                style={iosGlassCardStyle(isDark)}
                aria-label="Chiqish"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>
      ) : null}

      {showTopBar && meta.pendingPush && !busy ? (
        <div
          className="mx-4 mt-2 px-3 py-2 rounded-xl text-[10px] text-center max-w-lg w-full self-center"
          style={iosGlassTintStyle(isDark, '#f59e0b')}
        >
          O‘zgarishlar telefonda. Net bo‘lganda <span className="font-semibold">Yuborish</span> ni
          bosing — Supabase’ga saqlanadi
        </div>
      ) : null}

      {showTopBar && dataIsEmpty && !busy ? (
        <div
          className="mx-4 mt-2 px-3 py-2.5 rounded-xl text-[11px] text-center max-w-lg w-full self-center"
          style={iosGlassTintStyle(isDark, '#3b82f6')}
        >
          Mahalliy ma’lumot bo‘sh. Boshqa telefon yuborgan bo‘lsa{' '}
          <span className="font-semibold">Yuklash</span> ni bosing. Yoki shu yerda yangi savdo
          boshlang.
        </div>
      ) : null}

      {showTopBar && pendingOrderCount > 0 ? (
        <div
          className="mx-4 mt-2 px-3 py-2 rounded-xl text-[10px] text-center max-w-lg w-full self-center flex items-center justify-center gap-1.5"
          style={iosGlassTintStyle(isDark, '#ef4444')}
        >
          <span className="font-bold text-red-400">{pendingOrderCount} ta yangi QR buyurtma</span>
          <span className="opacity-60">— Qarz → Buyurtma</span>
        </div>
      ) : null}

      <main
        ref={mainScrollRef}
        className={
          isMapTab
            ? 'relative flex-1 min-h-0 overflow-hidden w-full'
            : `${dillerMainScrollClass} px-4 py-4 max-w-lg mx-auto w-full min-w-0`
        }
        style={{ paddingBottom: isMapTab ? 0 : navBottom }}
      >
        <DillerPanelContent
          tab={activeTab}
          data={data}
          onDataChange={persist}
          onGoHome={() => handleTabChange('sotuv')}
        />
      </main>

      <DillerBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        openDebtCount={openDebtCount}
        pendingOrderCount={pendingOrderCount}
      />
    </div>
  );
}
