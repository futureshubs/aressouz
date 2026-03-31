import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { Gavel, TrendingUp, Users, DollarSign, Trophy, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

interface AuctionStatisticsProps {
  branchId: string;
}

export function AuctionStatistics({ branchId }: AuctionStatisticsProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadStatistics();
  }, [branchId, visibilityRefetchTick]);

  const loadStatistics = async () => {
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
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      toast.error('Statistikani yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Jami auksionlar',
      value: stats?.totalAuctions || 0,
      icon: Gavel,
      color: '#14b8a6',
      suffix: 'ta',
    },
    {
      label: 'Faol auksionlar',
      value: stats?.activeAuctions || 0,
      icon: TrendingUp,
      color: '#10b981',
      suffix: 'ta',
    },
    {
      label: 'Tugagan auksionlar',
      value: stats?.endedAuctions || 0,
      icon: Package,
      color: '#f59e0b',
      suffix: 'ta',
    },
    {
      label: 'Jami ishtirokchilar',
      value: stats?.totalParticipants || 0,
      icon: Users,
      color: '#3b82f6',
      suffix: 'kishi',
    },
    {
      label: 'Jami takliflar',
      value: stats?.totalBids || 0,
      icon: Trophy,
      color: '#8b5cf6',
      suffix: 'ta',
    },
    {
      label: 'Jami daromad',
      value: stats?.totalRevenue || 0,
      icon: DollarSign,
      color: '#ec4899',
      suffix: 'so\'m',
      format: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-3xl border p-6"
        style={{
          background: isDark
            ? `linear-gradient(145deg, ${accentColor.color}15, ${accentColor.color}08)`
            : `linear-gradient(145deg, ${accentColor.color}20, ${accentColor.color}10)`,
          borderColor: `${accentColor.color}33`,
        }}
      >
        <h2 className="text-2xl font-bold mb-2" style={{ color: accentColor.color }}>
          Auksion Statistikasi
        </h2>
        <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
          Umumiy ko'rsatkichlar va natijalar
        </p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-3xl border p-6 animate-pulse"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl mb-4"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              />
              <div
                className="h-4 rounded-lg mb-2"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              />
              <div
                className="h-8 rounded-lg w-2/3"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={index}
                className="rounded-3xl border p-6 transition-all hover:scale-105"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                    : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div
                  className="p-3 rounded-2xl inline-flex mb-4"
                  style={{ background: `${card.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: card.color }} />
                </div>
                <p
                  className="text-sm mb-2"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  {card.label}
                </p>
                <p className="text-2xl font-bold">
                  {card.format
                    ? card.value.toLocaleString()
                    : card.value}{' '}
                  <span className="text-base font-medium">{card.suffix}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Additional Stats */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total Sales */}
          <div
            className="rounded-3xl border p-6"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.08))'
                : 'linear-gradient(145deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))',
              borderColor: 'rgba(34, 197, 94, 0.3)',
            }}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: '#10b981' }}>
              Jami savdo hajmi
            </h3>
            <p className="text-3xl font-bold" style={{ color: '#10b981' }}>
              {stats.totalSales.toLocaleString()} so'm
            </p>
            <p
              className="text-sm mt-2"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              Tugagan auksionlardan
            </p>
          </div>

          {/* Average Participation */}
          <div
            className="rounded-3xl border p-6"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08))'
                : 'linear-gradient(145deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))',
              borderColor: 'rgba(59, 130, 246, 0.3)',
            }}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: '#3b82f6' }}>
              O'rtacha ishtirok
            </h3>
            <p className="text-3xl font-bold" style={{ color: '#3b82f6' }}>
              {stats.totalAuctions > 0
                ? Math.round(stats.totalParticipants / stats.totalAuctions)
                : 0}{' '}
              kishi
            </p>
            <p
              className="text-sm mt-2"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              Har bir auksionda
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
