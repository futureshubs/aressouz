import { useTheme } from '../../context/ThemeContext';
import { Package, Warehouse, Clock, BarChart3, TrendingUp, FileText, LayoutDashboard } from 'lucide-react';
import { RentalProductsView } from './RentalProductsView';
import { RentalWarehouseView } from './RentalWarehouseView';
import { RentalOrdersView } from './RentalOrdersView';
import { RentalStatisticsView } from './RentalStatisticsView';
import { RentalAnalyticsView } from './RentalAnalyticsView';
import { RentalApplicationsView } from './RentalApplicationsView';
import { RentalBranchTelegramSettings } from './RentalBranchTelegramSettings';
import { RentalProviderHomeView } from './RentalProviderHomeView';
import type { RentalProviderNavTabId } from './RentalProviderBottomNav';

type BranchTabId =
  | 'products'
  | 'warehouse'
  | 'orders'
  | 'statistics'
  | 'analytics'
  | 'applications';

type Props = {
  branchId: string;
  variant?: 'branch' | 'provider';
  activeTab?: RentalProviderNavTabId | BranchTabId;
  onTabChange?: (tab: RentalProviderNavTabId | BranchTabId) => void;
};

export function RentalDashboard({
  branchId,
  variant = 'branch',
  activeTab: controlledTab,
  onTabChange,
}: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isProvider = variant === 'provider';

  const branchTabs = [
    { id: 'products' as const, label: 'Mahsulotlar', icon: Package },
    { id: 'warehouse' as const, label: 'Ombor', icon: Warehouse },
    { id: 'orders' as const, label: 'Ijarada', icon: Clock },
    { id: 'statistics' as const, label: 'Statistika', icon: BarChart3 },
    { id: 'analytics' as const, label: 'Data Analitika', icon: TrendingUp },
    { id: 'applications' as const, label: 'Arizalar', icon: FileText },
  ];

  const providerTabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders' as const, label: 'Ijara buyurtmalar', icon: Clock },
    { id: 'products' as const, label: 'Mahsulotlar', icon: Package },
    { id: 'warehouse' as const, label: 'Ombor', icon: Warehouse },
    { id: 'statistics' as const, label: 'Statistika', icon: BarChart3 },
    { id: 'analytics' as const, label: 'Data Analitika', icon: TrendingUp },
  ];

  const tabs = isProvider ? providerTabs : branchTabs;
  const activeTab = controlledTab ?? (isProvider ? 'dashboard' : 'products');

  const showDesktopTabs = !isProvider;

  return (
    <div className={`space-y-6 ${isProvider ? 'pb-24 lg:pb-6' : ''}`}>
      {!isProvider ? <RentalBranchTelegramSettings branchId={branchId} /> : null}

      {showDesktopTabs ? (
        <div className="hidden lg:flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className="px-4 py-3 rounded-2xl font-medium whitespace-nowrap transition-all flex items-center gap-2"
                style={{
                  background:
                    activeTab === tab.id
                      ? accentColor.color
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.05)',
                  color: activeTab === tab.id ? '#ffffff' : undefined,
                }}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div>
        {activeTab === 'dashboard' && isProvider ? (
          <RentalProviderHomeView branchId={branchId} />
        ) : null}
        {activeTab === 'products' ? <RentalProductsView branchId={branchId} /> : null}
        {activeTab === 'warehouse' ? <RentalWarehouseView branchId={branchId} /> : null}
        {activeTab === 'orders' ? <RentalOrdersView branchId={branchId} /> : null}
        {activeTab === 'statistics' ? <RentalStatisticsView branchId={branchId} /> : null}
        {activeTab === 'analytics' ? <RentalAnalyticsView branchId={branchId} /> : null}
        {activeTab === 'applications' && !isProvider ? (
          <RentalApplicationsView branchId={branchId} />
        ) : null}
      </div>
    </div>
  );
}
