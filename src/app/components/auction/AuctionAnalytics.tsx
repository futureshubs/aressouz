import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { BarChart3, TrendingUp, DollarSign, Users, Gavel, Award } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface AuctionAnalyticsProps {
  branchId: string;
}

export function AuctionAnalytics({ branchId }: AuctionAnalyticsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadAnalytics();
  }, [branchId, visibilityRefetchTick]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/stats/summary?branchId=${branchId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        toast.error(data.error || 'Statistikani yuklashda xatolik');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Data analitikani yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-6 rounded-3xl border animate-pulse"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                : 'linear-gradient(145deg, #ffffff, #f9fafb)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <div
              className="h-6 rounded-lg mb-3"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                width: '60%',
              }}
            />
            <div
              className="h-10 rounded-lg"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                width: '80%',
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div
        className="text-center py-20 rounded-3xl border"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
            : 'linear-gradient(145deg, #ffffff, #f9fafb)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor.color }} />
        <h3 className="text-xl font-bold mb-2">Ma'lumotlar topilmadi</h3>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Jami Auksionlar',
      value: stats.totalAuctions,
      icon: Gavel,
      color: '#14b8a6',
    },
    {
      label: 'Faol Auksionlar',
      value: stats.activeAuctions,
      icon: TrendingUp,
      color: '#10b981',
    },
    {
      label: 'Yakunlangan',
      value: stats.endedAuctions,
      icon: Award,
      color: '#f59e0b',
    },
    {
      label: 'Jami Takliflar',
      value: stats.totalBids,
      icon: Gavel,
      color: '#8b5cf6',
    },
    {
      label: 'Ishtirokchilar',
      value: stats.totalParticipants,
      icon: Users,
      color: '#3b82f6',
    },
    {
      label: 'Jami Daromad',
      value: `${stats.totalRevenue.toLocaleString()} so'm`,
      icon: DollarSign,
      color: '#14b8a6',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="p-6 rounded-3xl border"
        style={{
          background: isDark
            ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
            : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
          borderColor: `${accentColor.color}33`,
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-6 h-6" style={{ color: accentColor.color }} />
          <h2 className="text-2xl font-bold">Data Analitika</h2>
        </div>
        <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          Auksion tizimi statistikasi va analitikasi
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="p-6 rounded-3xl border"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="p-3 rounded-2xl"
                  style={{ background: `${metric.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: metric.color }} />
                </div>
              </div>
              <p
                className="text-sm mb-1"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                {metric.label}
              </p>
              <p className="text-3xl font-bold">{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div
        className="p-6 rounded-3xl border"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
            : 'linear-gradient(145deg, #ffffff, #f9fafb)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 className="text-lg font-bold mb-4">Umumiy Ko'rsatkichlar</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              O'rtacha Ishtirokchilar:
            </span>
            <span className="font-bold">
              {stats.totalAuctions > 0
                ? Math.round(stats.totalParticipants / stats.totalAuctions)
                : 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              O'rtacha Takliflar:
            </span>
            <span className="font-bold">
              {stats.totalAuctions > 0 ? Math.round(stats.totalBids / stats.totalAuctions) : 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              O'rtacha Sotuv:
            </span>
            <span className="font-bold">
              {stats.endedAuctions > 0
                ? `${Math.round(stats.totalSales / stats.endedAuctions).toLocaleString()} so'm`
                : '0 so\'m'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
