import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  BarChart3,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { floatingNavShellStyle } from '../../utils/floatingNavShellStyle';

export type RentalProviderNavTabId =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'warehouse'
  | 'statistics'
  | 'analytics';

type NavItem = {
  id: RentalProviderNavTabId;
  label: string;
  short: string;
  icon: LucideIcon;
};

const TABS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'Dash', icon: LayoutDashboard },
  { id: 'orders', label: 'Ijara buyurtmalar', short: 'Buyurtma', icon: ShoppingCart },
  { id: 'products', label: 'Mahsulotlar', short: 'Mahsulot', icon: Package },
  { id: 'warehouse', label: 'Ombor', short: 'Ombor', icon: Warehouse },
  { id: 'statistics', label: 'Statistika', short: 'Stat', icon: BarChart3 },
  { id: 'analytics', label: 'Data analitika', short: 'Analit', icon: TrendingUp },
];

type Props = {
  activeTab: RentalProviderNavTabId;
  onTabChange: (tab: RentalProviderNavTabId) => void;
  pendingOrders?: number;
};

function NavTabButton({
  tab,
  active,
  badge,
  isDark,
  accentColor,
  onClick,
}: {
  tab: NavItem;
  active: boolean;
  badge?: number;
  isDark: boolean;
  accentColor: { color: string };
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] py-1.5 transition-all duration-200 active:scale-[0.94] touch-manipulation"
    >
      {active ? (
        <span
          className="absolute inset-x-0.5 inset-y-0 rounded-[20px]"
          style={{
            background: isDark ? `${accentColor.color}24` : `${accentColor.color}18`,
          }}
        />
      ) : null}
      <span className="relative flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 12 }}>
        <Icon
          style={{
            width: 20,
            height: 20,
            color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
            strokeWidth: active ? 2.5 : 2,
          }}
        />
        {badge && badge > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: '#ef4444' }}
          >
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      <span
        className="relative text-[8px] font-semibold truncate max-w-full px-0.5 sm:text-[9px]"
        style={{ color: active ? accentColor.color : isDark ? '#a1a1aa' : '#71717a' }}
      >
        {tab.short}
      </span>
    </button>
  );
}

export default function RentalProviderBottomNav({ activeTab, onTabChange, pendingOrders = 0 }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const shellStyle = floatingNavShellStyle(isDark);

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{
        paddingBottom: 'max(10px, calc(6px + var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))))',
      }}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-lg flex-col px-2 pointer-events-auto sm:max-w-xl sm:px-3">
        <nav className="relative overflow-hidden px-1 py-1.5" style={shellStyle} aria-label="Ijara navigatsiya">
          <div
            className="pointer-events-none absolute inset-x-6 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor.color}55, transparent)`,
            }}
          />
          <div className="flex w-full min-w-0 items-center justify-between gap-0.5">
            {TABS.map((tab) => (
              <NavTabButton
                key={tab.id}
                tab={tab}
                active={activeTab === tab.id}
                badge={tab.id === 'orders' ? pendingOrders : undefined}
                isDark={isDark}
                accentColor={accentColor}
                onClick={() => onTabChange(tab.id)}
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
