import { useEffect, useState } from 'react';
import {
  ReceiptText,
  ShoppingCart,
  HandCoins,
  Package,
  Warehouse,
  Wallet,
  BarChart3,
  MessageSquare,
  CreditCard,
  Users,
  ChevronUp,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { floatingNavShellStyle } from '../../utils/floatingNavShellStyle';

export type SellerNavTabId =
  | 'sales'
  | 'orders'
  | 'debts'
  | 'products'
  | 'inventory'
  | 'expenses'
  | 'statistics'
  | 'sms'
  | 'payments'
  | 'workers'
  | 'dashboard'
  | 'history';

type NavItem = {
  id: SellerNavTabId;
  label: string;
  short?: string;
  icon: LucideIcon;
};

const OWNER_BEFORE_EXPAND: NavItem[] = [
  { id: 'sales', label: 'Savdo', icon: ReceiptText },
  { id: 'orders', label: 'Buyurtmalar', short: 'Buyurtma', icon: ShoppingCart },
  { id: 'debts', label: 'Qarz', icon: HandCoins },
];

const OWNER_AFTER_EXPAND: NavItem[] = [
  { id: 'products', label: 'Mahsulotlar', short: 'Mahsulot', icon: Package },
  { id: 'inventory', label: 'Ombor', icon: Warehouse },
  { id: 'expenses', label: 'Harajatlar', short: 'Harajat', icon: Wallet },
];

const DEBTS_SUBMENU: NavItem[] = [
  { id: 'statistics', label: 'Statistika', icon: BarChart3 },
  { id: 'sms', label: 'SMS statistikasi', short: 'SMS', icon: MessageSquare },
  { id: 'payments', label: "To'lovlar", short: "To'lov", icon: CreditCard },
  { id: 'workers', label: 'Ishchilar', short: 'Ishchi', icon: Users },
];

const DEBTS_GROUP = new Set<SellerNavTabId>(['debts', 'statistics', 'sms', 'payments', 'workers']);

type Props = {
  activeTab: SellerNavTabId;
  onTabChange: (tab: SellerNavTabId) => void;
  isCashier: boolean;
};

function NavTabButton({
  tab,
  active,
  highlight,
  isDark,
  accentColor,
  onClick,
}: {
  tab: NavItem;
  active: boolean;
  highlight?: boolean;
  isDark: boolean;
  accentColor: { color: string };
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
      </span>
      <span
        className="relative text-[8px] font-semibold truncate max-w-full px-0.5 sm:text-[9px]"
        style={{ color: on ? accentColor.color : isDark ? '#a1a1aa' : '#71717a' }}
      >
        {tab.short || tab.label}
      </span>
    </button>
  );
}

export default function SellerBottomNav({ activeTab, onTabChange, isCashier }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const shellStyle = floatingNavShellStyle(isDark);

  const debtsGroupActive = DEBTS_GROUP.has(activeTab);

  useEffect(() => {
    if (
      activeTab === 'statistics' ||
      activeTab === 'sms' ||
      activeTab === 'payments' ||
      activeTab === 'workers'
    ) {
      setSubmenuOpen(true);
    }
  }, [activeTab]);

  const toggleSubmenu = () => setSubmenuOpen((v) => !v);

  const cashierTabs = OWNER_BEFORE_EXPAND.filter((t) => t.id === 'sales' || t.id === 'orders');

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{
        paddingBottom: 'max(10px, calc(6px + var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))))',
      }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2 px-3 pointer-events-auto sm:max-w-xl">
        {!isCashier && submenuOpen ? (
          <nav className="relative overflow-hidden px-1 py-1.5" style={shellStyle}>
            <div className="grid grid-cols-4 gap-0.5">
              {DEBTS_SUBMENU.map((tab) => (
                <NavTabButton
                  key={tab.id}
                  tab={tab}
                  active={activeTab === tab.id}
                  isDark={isDark}
                  accentColor={accentColor}
                  onClick={() => {
                    onTabChange(tab.id);
                    setSubmenuOpen(true);
                  }}
                />
              ))}
            </div>
          </nav>
        ) : null}

        <nav className="relative overflow-hidden px-1 py-1.5" style={shellStyle} aria-label="Seller navigatsiya">
          <div
            className="pointer-events-none absolute inset-x-6 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor.color}55, transparent)`,
            }}
          />
          <div className="flex items-center justify-between gap-0.5">
            {isCashier ? (
              cashierTabs.map((tab) => (
                <NavTabButton
                  key={tab.id}
                  tab={tab}
                  active={activeTab === tab.id}
                  isDark={isDark}
                  accentColor={accentColor}
                  onClick={() => onTabChange(tab.id)}
                />
              ))
            ) : (
              <>
                {OWNER_BEFORE_EXPAND.map((tab) => (
                  <NavTabButton
                    key={tab.id}
                    tab={tab}
                    active={activeTab === tab.id || (tab.id === 'debts' && debtsGroupActive && activeTab !== tab.id)}
                    highlight={tab.id === 'debts' && submenuOpen}
                    isDark={isDark}
                    accentColor={accentColor}
                    onClick={() => {
                      onTabChange(tab.id);
                      if (tab.id !== 'debts') setSubmenuOpen(false);
                    }}
                  />
                ))}

                <button
                  type="button"
                  onClick={toggleSubmenu}
                  aria-label={submenuOpen ? 'Menyuni yopish' : 'Menyuni ochish'}
                  aria-expanded={submenuOpen}
                  className="relative flex shrink-0 flex-col items-center justify-center rounded-[20px] py-1.5 px-1 active:scale-[0.94] touch-manipulation"
                  style={{ width: 40 }}
                >
                  <span
                    className="absolute inset-0 rounded-[20px]"
                    style={
                      submenuOpen
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
                    {submenuOpen ? (
                      <ChevronDown
                        className="w-5 h-5"
                        style={{ color: '#fff', strokeWidth: 2.5 }}
                      />
                    ) : (
                      <ChevronUp
                        className="w-5 h-5"
                        style={{ color: accentColor.color, strokeWidth: 2.5 }}
                      />
                    )}
                  </span>
                </button>

                {OWNER_AFTER_EXPAND.map((tab) => (
                  <NavTabButton
                    key={tab.id}
                    tab={tab}
                    active={activeTab === tab.id}
                    isDark={isDark}
                    accentColor={accentColor}
                    onClick={() => {
                      onTabChange(tab.id);
                      setSubmenuOpen(false);
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
