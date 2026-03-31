import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';
import { 
  Gavel, 
  Plus, 
  TrendingUp, 
  Trophy, 
  Users, 
  BarChart3,
  FileText
} from 'lucide-react';
import { ActiveAuctions } from './ActiveAuctions';
import { AddAuction } from './AddAuction';
import { AuctionStatistics } from './AuctionStatistics';
import { AuctionWins } from './AuctionWins';
import { AuctionParticipants } from './AuctionParticipants';
import { AuctionAnalytics } from './AuctionAnalytics';
import { AuctionRequests } from './AuctionRequests';

interface AuctionDashboardProps {
  branchId: string;
}

export function AuctionDashboard({ branchId }: AuctionDashboardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeView, setActiveView] = useState<'list' | 'add' | 'stats' | 'wins' | 'participants' | 'analytics' | 'requests'>('list');
  const [refreshKey, setRefreshKey] = useState(0);
  const [newAuction, setNewAuction] = useState<any>(null);

  useVisibilityRefetch(() => setRefreshKey((k) => k + 1));

  const handleAuctionCreated = (auction?: any) => {
    console.log('✅ Auction created successfully, refreshing list...');
    console.log('📦 Created auction:', auction);
    setNewAuction(auction); // Store the new auction
    setActiveView('list');
    // Add a small delay to allow database to sync
    setTimeout(() => {
      setRefreshKey(prev => prev + 1);
    }, 500);
  };

  const views = [
    { id: 'list' as const, label: 'Faol Auksionlar', icon: Gavel },
    { id: 'add' as const, label: 'Auksion Qo\'shish', icon: Plus },
    { id: 'stats' as const, label: 'Statistika', icon: TrendingUp },
    { id: 'wins' as const, label: 'Yutib Olganlar', icon: Trophy },
    { id: 'participants' as const, label: 'Ishtirokchilar', icon: Users },
    { id: 'analytics' as const, label: 'Data Analitika', icon: BarChart3 },
    { id: 'requests' as const, label: 'Arizalar', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
        {views.map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          
          return (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all whitespace-nowrap"
              style={{
                background: isActive 
                  ? accentColor.gradient
                  : isDark 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(0, 0, 0, 0.03)',
                color: isActive 
                  ? '#ffffff' 
                  : isDark 
                    ? 'rgba(255, 255, 255, 0.8)' 
                    : '#111827',
                borderWidth: '1px',
                borderColor: isActive 
                  ? accentColor.color 
                  : 'transparent',
              }}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium text-sm">{view.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeView === 'list' && <ActiveAuctions key={refreshKey} branchId={branchId} />}
        {activeView === 'add' && <AddAuction branchId={branchId} onSuccess={handleAuctionCreated} />}
        {activeView === 'stats' && <AuctionStatistics branchId={branchId} />}
        {activeView === 'wins' && <AuctionWins branchId={branchId} />}
        {activeView === 'participants' && <AuctionParticipants branchId={branchId} />}
        {activeView === 'analytics' && <AuctionAnalytics branchId={branchId} />}
        {activeView === 'requests' && <AuctionRequests branchId={branchId} />}
      </div>
    </div>
  );
}