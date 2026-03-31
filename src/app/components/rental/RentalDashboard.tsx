import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Package, Warehouse, Clock, BarChart3, TrendingUp, FileText } from 'lucide-react';
import { RentalProductsView } from './RentalProductsView';
import { RentalWarehouseView } from './RentalWarehouseView';
import { RentalOrdersView } from './RentalOrdersView';
import { RentalStatisticsView } from './RentalStatisticsView';
import { RentalAnalyticsView } from './RentalAnalyticsView';
import { RentalApplicationsView } from './RentalApplicationsView';

export function RentalDashboard({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'products' | 'warehouse' | 'orders' | 'statistics' | 'analytics' | 'applications'>('products');

  const tabs = [
    { id: 'products', label: 'Mahsulotlar', icon: Package },
    { id: 'warehouse', label: 'Ombor', icon: Warehouse },
    { id: 'orders', label: 'Ijarada', icon: Clock },
    { id: 'statistics', label: 'Statistika', icon: BarChart3 },
    { id: 'analytics', label: 'Data Analitika', icon: TrendingUp },
    { id: 'applications', label: 'Arizalar', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="px-4 py-3 rounded-2xl font-medium whitespace-nowrap transition-all flex items-center gap-2"
              style={{
                background: activeTab === tab.id 
                  ? accentColor.color 
                  : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                color: activeTab === tab.id ? '#ffffff' : undefined,
              }}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'products' && <RentalProductsView branchId={branchId} />}
        {activeTab === 'warehouse' && <RentalWarehouseView branchId={branchId} />}
        {activeTab === 'orders' && <RentalOrdersView branchId={branchId} />}
        {activeTab === 'statistics' && <RentalStatisticsView branchId={branchId} />}
        {activeTab === 'analytics' && <RentalAnalyticsView branchId={branchId} />}
        {activeTab === 'applications' && <RentalApplicationsView branchId={branchId} />}
      </div>
    </div>
  );
}
