import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { TrendingUp, Package, Clock, DollarSign, CheckCircle, XCircle, Percent, Wallet, Loader2 } from 'lucide-react';
import { projectId } from '../../../../utils/supabase/info';
import { buildRentalPanelHeaders } from '../../utils/requestAuth';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../../utils/visibilityRefetch';

export function RentalStatisticsView({ branchId }: { branchId: string }) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [visibilityTick, setVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setVisibilityTick((t) => t + 1));

  useEffect(() => {
    loadStatistics();
  }, [branchId, visibilityTick]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/statistics/${branchId}`,
        {
          headers: buildRentalPanelHeaders(),
        }
      );

      const data = await response.json();
      if (data.success) {
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      toast.error('Statistikani yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: accentColor.color }} />
          <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
            
          </p>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="text-center py-12">
        <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          Ma'lumot topilmadi
        </p>
      </div>
    );
  }

  const branchNetIjar =
    statistics.totalBranchRentalNet != null
      ? Number(statistics.totalBranchRentalNet)
      : Math.max(
          0,
          (Number(statistics.totalRevenue) || 0) -
            (Number(statistics.totalPlatformCommission) || 0),
        );

  const stats = [
    {
      icon: Package,
      label: 'Jami mahsulotlar',
      value: statistics.totalProducts,
      subtext: `${statistics.activeProducts} ta faol`,
      color: accentColor.color
    },
    {
      icon: Clock,
      label: 'Faol ijaralar',
      value: statistics.activeRentals,
      subtext: `${statistics.totalOrders} ta jami`,
      color: '#f59e0b'
    },
    {
      icon: CheckCircle,
      label: 'Yakunlangan',
      value: statistics.completedRentals,
      subtext: 'Muvaffaqiyatli',
      color: '#10b981'
    },
    {
      icon: XCircle,
      label: 'Bekor qilingan',
      value: statistics.cancelledRentals,
      subtext: 'Rad etilgan',
      color: '#ef4444'
    },
    {
      icon: DollarSign,
      label: 'Jami daromad',
      value: `${parseInt(statistics.totalRevenue || 0).toLocaleString()}`,
      subtext: 'so\'m (yakunlangan ijara)',
      color: accentColor.color
    },
    {
      icon: Percent,
      label: 'Platforma ulushi',
      value: `${parseInt(statistics.totalPlatformCommission ?? 0).toLocaleString()}`,
      subtext: 'so\'m — mahsulotdagi % bo\'yicha',
      color: '#8b5cf6'
    },
    {
      icon: Wallet,
      label: 'Filial ulushi (ijara)',
      value: `${Math.round(branchNetIjar).toLocaleString()}`,
      subtext: 'so\'m — daromad − platforma',
      color: '#10b981'
    },
    {
      icon: TrendingUp,
      label: 'Kutilmoqda',
      value: statistics.pendingApplications,
      subtext: 'ta ariza',
      color: '#f59e0b'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Statistika</h2>
        <p style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
          Ijara bo'limi umumiy ko'rsatkichlari
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="rounded-3xl p-6 border transition-all hover:scale-[1.02]"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="p-3 rounded-2xl"
                  style={{ background: `${stat.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
              </div>

              <div>
                <h3 className="text-3xl font-bold mb-2">{stat.value}</h3>
                <p className="text-sm mb-1 font-medium">{stat.label}</p>
                <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                  {stat.subtext}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Card */}
      <div 
        className="rounded-3xl p-8 border"
        style={{
          background: isDark 
            ? `linear-gradient(135deg, ${accentColor.color}20, rgba(255, 255, 255, 0.05))`
            : `linear-gradient(135deg, ${accentColor.color}20, #ffffff)`,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <h3 className="text-xl font-bold mb-4">Umumiy ma'lumotlar</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              Muvaffaqiyat darajasi
            </p>
            <p className="text-2xl font-bold">
              {statistics.totalOrders > 0 
                ? Math.round((statistics.completedRentals / statistics.totalOrders) * 100)
                : 0}%
            </p>
          </div>

          <div>
            <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              Bekor qilish foizi
            </p>
            <p className="text-2xl font-bold">
              {statistics.totalOrders > 0 
                ? Math.round((statistics.cancelledRentals / statistics.totalOrders) * 100)
                : 0}%
            </p>
          </div>

          <div>
            <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              O'rtacha daromad
            </p>
            <p className="text-2xl font-bold">
              {statistics.completedRentals > 0 
                ? Math.round(statistics.totalRevenue / statistics.completedRentals).toLocaleString()
                : 0} so'm
            </p>
          </div>

          <div>
            <p className="text-sm mb-2" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              Mahsulot band
            </p>
            <p className="text-2xl font-bold">
              {statistics.activeProducts > 0 
                ? Math.round((statistics.activeRentals / statistics.activeProducts) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
