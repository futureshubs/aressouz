import { useEffect, useState } from 'react';
import {
  Armchair,
  BarChart3,
  ChefHat,
  ChevronDown,
  ChevronUp,
  DollarSign,
  HandCoins,
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { floatingNavShellStyle } from '../../utils/floatingNavShellStyle';

export type RestaurantNavTabId =
  | 'dashboard'
  | 'orders'
  | 'dishes'
  | 'rooms'
  | 'stats'
  | 'analytics'
  | 'payment'
  | 'debts'
  | 'sms';

type NavItem = {
  id: RestaurantNavTabId;
  label: string;
  short: string;
  icon: LucideIcon;
};

/** Seller kabi: 2 ta chap, markazda «Yana», 2 ta o‘ng */
const PRIMARY_BEFORE: NavItem[] = [
  { id: 'orders', label: 'Buyurtmalar', short: 'Buyurtma', icon: ShoppingCart },
  { id: 'dishes', label: 'Taomlar', short: 'Taomlar', icon: ChefHat },
];

const PRIMARY_AFTER: NavItem[] = [
  { id: 'dashboard', label: 'Bosh sahifa', short: 'Bosh', icon: LayoutDashboard },
  { id: 'rooms', label: 'Xonalar / bron', short: 'Xonalar', icon: Armchair },
];

const MORE_NAV: NavItem[] = [
  { id: 'debts', label: 'Qarz', short: 'Qarz', icon: HandCoins },
  { id: 'sms', label: 'SMS statistikasi', short: 'SMS', icon: MessageSquare },
  { id: 'stats', label: 'Statistika', short: 'Stat', icon: BarChart3 },
  { id: 'analytics', label: 'Analitika', short: 'Analit', icon: TrendingUp },
  { id: 'payment', label: "To'lov", short: "To'lov", icon: DollarSign },
];

const MORE_GROUP = new Set<RestaurantNavTabId>(MORE_NAV.map((t) => t.id));

type Props = {
  activeTab: RestaurantNavTabId;
  onTabChange: (tab: RestaurantNavTabId) => void;
  pendingOrders?: number;
};

function NavTabButton({
  tab,
  active,
  highlight,
  badge,
  isDark,
  accentColor,
  onClick,
}: {
  tab: NavItem;
  active: boolean;
  highlight?: boolean;
  badge?: number;
  isDark: boolean;
  accentColor: { color: string; gradient?: string };
  onClick: () => void;
}) {
  const Icon = tab.icon;
  const on = active || highlight;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] py-1.5 transition-all duration-200 active:scale-[0.94] touch-manipulation"
    >
      {on ? (
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
            color: on ? accentColor.color : isDark ? '#a1a1aa' : '#71717a',
            strokeWidth: on ? 2.5 : 2,
          }}
        />
        {badge != null && badge > 0 ? (
          <span
            className="absolute -top-0.5 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: '#ef4444', boxShadow: '0 0 0 2px rgba(0,0,0,0.15)' }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span
        className="relative text-[8px] font-semibold truncate max-w-full px-0.5 sm:text-[9px]"
        style={{ color: on ? accentColor.color : isDark ? '#a1a1aa' : '#71717a' }}
      >
        {tab.short}
      </span>
    </button>
  );
}

export default function RestaurantBottomNav({ activeTab, onTabChange, pendingOrders = 0 }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [moreOpen, setMoreOpen] = useState(false);
  const shellStyle = floatingNavShellStyle(isDark);
  const moreGroupActive = MORE_GROUP.has(activeTab);

  useEffect(() => {
    if (MORE_GROUP.has(activeTab)) setMoreOpen(true);
  }, [activeTab]);

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{
        paddingBottom: 'max(10px, calc(6px + var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))))',
      }}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-lg flex-col gap-2 px-2 pointer-events-auto sm:max-w-xl sm:px-3">
        {moreOpen ? (
          <nav className="relative overflow-hidden px-1 py-1.5" style={shellStyle} aria-label="Qo‘shimcha bo‘limlar">
            <div className="grid grid-cols-5 gap-0.5">
              {MORE_NAV.map((tab) => (
                <NavTabButton
                  key={tab.id}
                  tab={tab}
                  active={activeTab === tab.id}
                  isDark={isDark}
                  accentColor={accentColor}
                  onClick={() => {
                    onTabChange(tab.id);
                    setMoreOpen(true);
                  }}
                />
              ))}
            </div>
          </nav>
        ) : null}

        <nav className="relative overflow-hidden px-1 py-1.5" style={shellStyle} aria-label="Taom panel navigatsiya">
          <div
            className="pointer-events-none absolute inset-x-6 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor.color}55, transparent)`,
            }}
          />
          <div className="flex w-full min-w-0 max-w-full items-center justify-between gap-0.5">
            {PRIMARY_BEFORE.map((tab) => (
              <NavTabButton
                key={tab.id}
                tab={tab}
                active={activeTab === tab.id}
                badge={tab.id === 'orders' ? pendingOrders : undefined}
                isDark={isDark}
                accentColor={accentColor}
                onClick={() => {
                  onTabChange(tab.id);
                  setMoreOpen(false);
                }}
              />
            ))}

            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label={moreOpen ? 'Qo‘shimcha menyuni yopish' : 'Qo‘shimcha menyuni ochish'}
              aria-expanded={moreOpen}
              className="relative flex shrink-0 flex-col items-center justify-center rounded-[20px] py-1.5 px-1 active:scale-[0.94] touch-manipulation"
              style={{ width: 40 }}
            >
              <span
                className="absolute inset-0 rounded-[20px]"
                style={
                  moreOpen || moreGroupActive
                    ? {
                        background: accentColor.gradient,
                        boxShadow: `0 4px 14px ${accentColor.color}44`,
                      }
                    : {
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      }
                }
              />
              <span className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
                {moreOpen ? (
                  <ChevronDown className="w-5 h-5" style={{ color: '#fff', strokeWidth: 2.5 }} />
                ) : (
                  <ChevronUp
                    className="w-5 h-5"
                    style={{
                      color: moreGroupActive ? '#fff' : accentColor.color,
                      strokeWidth: 2.5,
                    }}
                  />
                )}
              </span>
            </button>

            {PRIMARY_AFTER.map((tab) => (
              <NavTabButton
                key={tab.id}
                tab={tab}
                active={activeTab === tab.id}
                isDark={isDark}
                accentColor={accentColor}
                onClick={() => {
                  onTabChange(tab.id);
                  setMoreOpen(false);
                }}
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
