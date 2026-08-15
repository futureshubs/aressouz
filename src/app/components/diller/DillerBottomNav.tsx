import {
  BarChart3,
  ClipboardList,
  History,
  LayoutGrid,
  LineChart,
  Map,
  Package,
  Receipt,
  Store,
  UserCircle,
  ShoppingCart,
  Wallet,
  Warehouse,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { floatingNavShellStyle } from '../../utils/floatingNavShellStyle';

export type DillerPrimaryTabId = 'sotuv' | 'xarita' | 'dokonlar' | 'qarz';
export type DillerMenuPageId =
  | 'balans'
  | 'mahsulot'
  | 'ombor'
  | 'statistika'
  | 'analitika'
  | 'profil'
  | 'buyurtma'
  | 'tarix'
  | 'xarajat';
export type DillerTabId = DillerPrimaryTabId | DillerMenuPageId;

type NavItem = {
  id: DillerTabId;
  short: string;
  label: string;
  icon: LucideIcon;
};

export const DILLER_PRIMARY_TABS: NavItem[] = [
  { id: 'sotuv', short: 'Sotuv', label: 'Sotuv', icon: ShoppingCart },
  { id: 'xarita', short: 'Xarita', label: 'Xarita', icon: Map },
  { id: 'dokonlar', short: 'Do‘kon', label: 'Do‘konlar', icon: Store },
  { id: 'qarz', short: 'Qarz', label: 'Qarz', icon: Wallet },
];

export const DILLER_MENU_PAGES: NavItem[] = [
  { id: 'balans', short: 'Balans', label: 'Balans', icon: Landmark },
  { id: 'mahsulot', short: 'Mahsulot', label: 'Mahsulotlar', icon: Package },
  { id: 'ombor', short: 'Ombor', label: 'Ombor', icon: Warehouse },
  { id: 'statistika', short: 'Statistika', label: 'Statistika', icon: BarChart3 },
  { id: 'analitika', short: 'Analitika', label: 'Analitika', icon: LineChart },
  { id: 'profil', short: 'Profil', label: 'Profil', icon: UserCircle },
  { id: 'buyurtma', short: 'Buyurtma', label: 'Buyurtma', icon: ClipboardList },
  { id: 'tarix', short: 'Tarix', label: 'Tarix', icon: History },
  { id: 'xarajat', short: 'Xarajat', label: 'Xarajat', icon: Receipt },
];

export const DILLER_MENU_PAGE_IDS = new Set<DillerTabId>(
  DILLER_MENU_PAGES.map((p) => p.id),
);

type Props = {
  activeTab: DillerTabId;
  onTabChange: (tab: DillerTabId) => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  openDebtCount?: number;
  pendingOrderCount?: number;
};

function NavIconButton({
  item,
  active,
  isDark,
  accentColor,
  badgeCount,
  badgeColor,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  isDark: boolean;
  accentColor: { color: string };
  badgeCount?: number;
  badgeColor?: string;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-[18px] py-1.5 px-0.5 active:scale-[0.94] touch-manipulation"
    >
      {active ? (
        <span
          className="absolute inset-x-0.5 inset-y-0 rounded-[20px]"
          style={{ background: isDark ? `${accentColor.color}24` : `${accentColor.color}18` }}
        />
      ) : null}
      <span className="relative">
        <Icon
          className="w-[18px] h-[18px] sm:w-5 sm:h-5"
          style={{
            color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
            strokeWidth: active ? 2.5 : 2,
          }}
        />
        {badgeCount && badgeCount > 0 ? (
          <span
            className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
            style={{ background: badgeColor || '#ef4444' }}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </span>
      <span
        className="relative text-[7px] font-semibold truncate max-w-full leading-tight sm:text-[8px]"
        style={{ color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a' }}
      >
        {item.short}
      </span>
    </button>
  );
}

export default function DillerBottomNav({
  activeTab,
  onTabChange,
  menuOpen,
  onMenuOpenChange,
  openDebtCount = 0,
  pendingOrderCount = 0,
}: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const menuPageActive = DILLER_MENU_PAGE_IDS.has(activeTab);
  const menuHighlight = menuOpen || menuPageActive;
  const debtBadge = pendingOrderCount > 0 ? pendingOrderCount : openDebtCount;
  const badgeColor = pendingOrderCount > 0 ? '#ef4444' : '#f59e0b';

  const goPrimary = (id: DillerPrimaryTabId) => {
    onMenuOpenChange(false);
    onTabChange(id);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-[max(0.5rem,var(--app-safe-bottom,0px))] pt-2 pointer-events-none"
      aria-label="Diller navigatsiya"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-2 pointer-events-auto">
        {menuOpen ? (
          <nav
            className="overflow-hidden px-1.5 py-2"
            style={floatingNavShellStyle(isDark)}
            aria-label="Diller menyu"
          >
            <div className="grid grid-cols-3 gap-0.5">
              {DILLER_MENU_PAGES.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className="relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] py-2 px-1 active:scale-[0.96] touch-manipulation"
                  >
                    {active ? (
                      <span
                        className="absolute inset-1 rounded-[16px]"
                        style={{
                          background: isDark ? `${accentColor.color}24` : `${accentColor.color}18`,
                        }}
                      />
                    ) : null}
                    <span className="relative">
                      <Icon
                        className="w-5 h-5"
                        style={{
                          color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
                          strokeWidth: active ? 2.5 : 2,
                        }}
                      />
                    </span>
                    <span
                      className="relative text-[9px] font-semibold truncate max-w-full"
                      style={{
                        color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
                      }}
                    >
                      {item.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}

        <nav className="flex items-stretch gap-0 rounded-[28px] px-0.5 py-1" style={floatingNavShellStyle(isDark)}>
          <NavIconButton
            item={DILLER_PRIMARY_TABS[0]}
            active={activeTab === 'sotuv' && !menuOpen}
            isDark={isDark}
            accentColor={accentColor}
            onClick={() => goPrimary('sotuv')}
          />
          <NavIconButton
            item={DILLER_PRIMARY_TABS[1]}
            active={activeTab === 'xarita' && !menuOpen}
            isDark={isDark}
            accentColor={accentColor}
            onClick={() => goPrimary('xarita')}
          />

          <button
            type="button"
            onClick={() => {
              if (menuOpen) {
                onMenuOpenChange(false);
                if (!menuPageActive) return;
              } else {
                onMenuOpenChange(true);
              }
            }}
            className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-[18px] py-1.5 px-0.5 active:scale-[0.94] touch-manipulation"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuHighlight ? (
              <span
                className="absolute inset-x-0.5 inset-y-0 rounded-[20px]"
                style={{
                  background: menuOpen
                    ? isDark
                      ? `${accentColor.color}32`
                      : `${accentColor.color}22`
                    : isDark
                      ? `${accentColor.color}24`
                      : `${accentColor.color}18`,
                }}
              />
            ) : null}
            <span className="relative">
              <LayoutGrid
                className="w-[18px] h-[18px] sm:w-5 sm:h-5"
                style={{
                  color: menuHighlight ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
                  strokeWidth: menuHighlight ? 2.5 : 2,
                }}
              />
            </span>
            <span
              className="relative text-[7px] font-semibold truncate max-w-full leading-tight sm:text-[8px]"
              style={{
                color: menuHighlight ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
              }}
            >
              Menu
            </span>
          </button>

          <NavIconButton
            item={DILLER_PRIMARY_TABS[2]}
            active={activeTab === 'dokonlar' && !menuOpen}
            isDark={isDark}
            accentColor={accentColor}
            onClick={() => goPrimary('dokonlar')}
          />
          <NavIconButton
            item={DILLER_PRIMARY_TABS[3]}
            active={activeTab === 'qarz' && !menuOpen}
            isDark={isDark}
            accentColor={accentColor}
            badgeCount={debtBadge}
            badgeColor={badgeColor}
            onClick={() => goPrimary('qarz')}
          />
        </nav>
      </div>
    </div>
  );
}

export function dillerTabTitle(tab: DillerTabId): string {
  return getDillerTabMeta(tab).label;
}

export function getDillerTabMeta(tab: DillerTabId): NavItem {
  return (
    DILLER_PRIMARY_TABS.find((t) => t.id === tab) ||
    DILLER_MENU_PAGES.find((t) => t.id === tab) ||
    DILLER_PRIMARY_TABS[0]
  );
}
