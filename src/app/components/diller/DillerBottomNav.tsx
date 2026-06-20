import {
  ShoppingCart,
  Package,
  UserCircle,
  Warehouse,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { floatingNavShellStyle } from '../../utils/floatingNavShellStyle';

export type DillerTabId = 'sotuv' | 'mahsulot' | 'qarz' | 'diller' | 'ombor' | 'dokonlar';

const TABS: { id: DillerTabId; short: string; label: string; icon: LucideIcon }[] = [
  { id: 'sotuv', short: 'Sotuv', label: 'Sotuv', icon: ShoppingCart },
  { id: 'mahsulot', short: 'Mahsulot', label: 'Mahsulot', icon: Package },
  { id: 'qarz', short: 'Qarz', label: 'Qarz', icon: Wallet },
  { id: 'ombor', short: 'Ombor', label: 'Ombor', icon: Warehouse },
  { id: 'dokonlar', short: 'Do‘kon', label: 'Do‘konlar', icon: Store },
  { id: 'diller', short: 'Diller', label: 'Diller', icon: UserCircle },
];

type Props = {
  activeTab: DillerTabId;
  onTabChange: (tab: DillerTabId) => void;
  /** Ochiq qarzli sotuvlar soni (badge) */
  openDebtCount?: number;
  /** Kutilayotgan QR buyurtmalar */
  pendingOrderCount?: number;
};

export default function DillerBottomNav({
  activeTab,
  onTabChange,
  openDebtCount = 0,
  pendingOrderCount = 0,
}: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-[max(0.5rem,var(--app-safe-bottom,0px))] pt-2"
      aria-label="Diller navigatsiya"
    >
      <div
        className="mx-auto flex max-w-lg items-stretch gap-0 rounded-[28px] px-0.5 py-1"
        style={floatingNavShellStyle(isDark, accentColor.color)}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          const badgeCount =
            tab.id === 'qarz'
              ? pendingOrderCount > 0
                ? pendingOrderCount
                : openDebtCount
              : 0;
          const badgeColor = pendingOrderCount > 0 && tab.id === 'qarz' ? '#ef4444' : '#f59e0b';
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
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
                {tab.id === 'qarz' && badgeCount > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center text-slate-900"
                    style={{ background: badgeColor }}
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                ) : null}
              </span>
              <span
                className="relative text-[7px] font-semibold truncate max-w-full leading-tight sm:text-[8px]"
                style={{ color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a' }}
              >
                {tab.short}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function dillerTabTitle(tab: DillerTabId): string {
  return TABS.find((t) => t.id === tab)?.label ?? 'Diller';
}

export function getDillerTabMeta(tab: DillerTabId) {
  return TABS.find((t) => t.id === tab) ?? TABS[0];
}
