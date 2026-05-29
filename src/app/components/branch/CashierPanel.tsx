import { useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { floatingNavShellStyle } from '../../utils/floatingNavShellStyle';
import { Payments } from './Payments';
import { CashierCashReceiveTab } from './CashierCashReceiveTab';
import { CashierCollectBackTab } from './CashierCollectBackTab';
import { CashierStatisticsPanel } from './CashierStatisticsPanel';
import { CourierSalaryTab } from './CourierSalaryTab';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  LogOut,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import AressoPanelBrand from '../brand/AressoPanelBrand';
import PanelPushSetup from '../brand/PanelPushSetup';
import { buildBranchHeaders, getStoredBranchToken, getStoredStaffToken } from '../../utils/requestAuth';

type CashierPanelProps = {
  branchId?: string;
  branchInfo?: {
    region: string;
    district: string;
    phone: string;
  };
  branchName?: string;
  staffName?: string;
  onLogout?: () => void;
};

type CashierTab = 'receive' | 'send' | 'collect' | 'salary' | 'stats';

const TAB_IDS: CashierTab[] = ['receive', 'send', 'collect', 'salary', 'stats'];

export function CashierPanel({
  branchId,
  branchInfo,
  branchName,
  staffName,
  onLogout,
}: CashierPanelProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState<CashierTab>('receive');

  const surface = useMemo(
    () => (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.92)'),
    [isDark],
  );
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const muted = isDark ? 'rgba(255,255,255,0.68)' : 'rgba(0,0,0,0.58)';
  const shellStyle = floatingNavShellStyle(isDark);

  const hasAuth = Boolean(
    String(getStoredBranchToken() || '').trim() || String(getStoredStaffToken() || '').trim(),
  );

  if (!branchId) {
    return (
      <div
        className="app-panel-viewport app-safe-pad"
        style={{
          background: isDark ? '#000000' : '#f9fafb',
          color: isDark ? '#ffffff' : '#111827',
        }}
      >
        <div className="app-panel-main-scroll p-4 min-h-0">
          <div
            className="p-10 rounded-3xl border text-center m-4"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>Filial tanlanmagan</div>
            <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>
              Avval filial paneliga kiring yoki operator orqali filialni tanlang.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAuth) {
    return (
      <div
        className="app-panel-viewport app-safe-pad"
        style={{
          background: isDark ? '#000000' : '#f9fafb',
          color: isDark ? '#ffffff' : '#111827',
        }}
      >
        <div className="app-panel-main-scroll p-4 min-h-0 flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto">
          <p className="font-semibold">Kassa sessiyasi tugagan</p>
          <p className="text-sm opacity-70">Qayta kiring — login va parol bilan yangi sessiya ochiladi.</p>
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-xl font-bold text-white"
              style={{ background: accentColor.gradient }}
            >
              Login sahifasiga
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const tabs: {
    id: CashierTab;
    label: string;
    short: string;
    hint: string;
    icon: typeof ArrowDownToLine;
  }[] = [
    {
      id: 'receive',
      label: 'Qabul qilish',
      short: 'Qabul',
      hint: 'Kuryer mijozdan olgan naqdni topshiradi',
      icon: ArrowDownToLine,
    },
    {
      id: 'send',
      label: 'Yuborish',
      short: 'Yuborish',
      hint: 'Do‘kon / taom — tadbirkorga to‘lov',
      icon: ArrowUpFromLine,
    },
    {
      id: 'collect',
      label: 'Olish kerak',
      short: 'Olish',
      hint: 'Bekor buyurtma — pulni qaytarib olish',
      icon: RotateCcw,
    },
    {
      id: 'salary',
      label: 'Oylik',
      short: 'Oylik',
      hint: 'Kuryer arizalari — to‘lash',
      icon: Wallet,
    },
    {
      id: 'stats',
      label: 'Statistika',
      short: 'Stat',
      hint: 'Analitika va ko‘rsatkichlar',
      icon: BarChart3,
    },
  ];

  const activeMeta = tabs.find((t) => t.id === tab)!;

  return (
    <div
      className="app-panel-viewport app-safe-pad flex flex-col min-h-0"
      style={{
        background: isDark ? '#000000' : '#f4f6f9',
        color: isDark ? '#ffffff' : '#111827',
      }}
    >
      <header className="shrink-0 px-4 pt-4 lg:px-8 lg:pt-6 pb-3 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between gap-3">
          <AressoPanelBrand
            variant="kassa"
            size="md"
            layout="row"
            align="left"
            title={staffName || 'Kassa'}
            subtitle={branchName || 'Filial'}
            isDark={isDark}
            accentColor={accentColor.color}
          />
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="shrink-0 px-3 py-2 rounded-xl font-semibold text-sm inline-flex items-center gap-1.5"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
          ) : null}
        </div>
      </header>

      <div
        className="app-panel-main-scroll flex-1 min-h-0 p-4 lg:p-8 max-w-6xl mx-auto w-full"
        style={{
          paddingBottom: 'max(96px, calc(80px + var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))))',
        }}
      >
        <PanelPushSetup
          className="mb-4"
          scope={{ panel: 'kassa', scopeId: branchId, branchId }}
          headers={buildBranchHeaders({ 'Content-Type': 'application/json' })}
        />

        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: muted }}>
            {activeMeta.label}
          </p>
          <p className="text-sm">{activeMeta.hint}</p>
        </div>

        <div
          className="rounded-3xl border overflow-hidden shadow-sm min-h-[320px]"
          style={{ background: surface, borderColor: border }}
        >
          {tab === 'receive' ? (
            <div className="p-5 sm:p-6">
              <CashierCashReceiveTab branchId={branchId} />
            </div>
          ) : tab === 'send' ? (
            <div className="p-5 sm:p-6 space-y-4">
              <p className="text-sm" style={{ color: muted }}>
                Sotuvchi yoki restoran buyurtmani qabul qilgach, shu yerda to‘lov kutiladi. QR yoki
                chek yuborib tadbirkorga to‘lang.
              </p>
              <Payments variant="cashier" branchId={branchId} branchInfo={branchInfo} />
            </div>
          ) : tab === 'collect' ? (
            <div className="p-5 sm:p-6">
              <CashierCollectBackTab branchId={branchId} />
            </div>
          ) : tab === 'salary' ? (
            <div className="p-5 sm:p-6">
              <CourierSalaryTab branchId={branchId} />
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <CashierStatisticsPanel branchId={branchId} />
            </div>
          )}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        style={{
          paddingBottom:
            'max(12px, calc(8px + var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))))',
        }}
      >
        <div className="mx-auto flex w-full max-w-lg flex-col px-4 pointer-events-auto sm:max-w-xl lg:max-w-3xl">
          <nav
            className="relative overflow-hidden px-1.5 py-1.5"
            style={shellStyle}
            role="tablist"
            aria-label="Kassa navigatsiya"
          >
            <div
              className="pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentColor.color}55, transparent)`,
              }}
            />

            <div className="flex items-center justify-between gap-0.5">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] py-1.5 transition-all duration-200 active:scale-[0.94] touch-manipulation"
                  >
                    {active ? (
                      <span
                        className="absolute inset-x-0.5 inset-y-0 rounded-[20px]"
                        style={{
                          background: isDark
                            ? `${accentColor.color}24`
                            : `${accentColor.color}18`,
                          boxShadow: `inset 0 0.5px 0 rgba(255,255,255,${isDark ? '0.12' : '0.6'})`,
                        }}
                      />
                    ) : null}

                    <span
                      className="relative flex items-center justify-center"
                      style={{ width: 36, height: 36, borderRadius: 14 }}
                    >
                      <Icon
                        style={{
                          width: 22,
                          height: 22,
                          color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
                          strokeWidth: active ? 2.5 : 2,
                          transition: 'color 0.22s ease',
                        }}
                      />
                    </span>

                    <span
                      className="relative text-[9px] font-semibold truncate max-w-full px-0.5 sm:text-[10px]"
                      style={{
                        color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
                      }}
                    >
                      {t.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

export { TAB_IDS };
export type { CashierTab };
