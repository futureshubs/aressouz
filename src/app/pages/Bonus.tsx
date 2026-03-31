import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { X, Zap, TrendingUp, Gift, ShoppingBag } from 'lucide-react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { SkeletonBox } from '../components/skeletons';

interface TapAnimation {
  id: number;
  x: number;
  y: number;
}

interface BonusProps {
  onClose?: () => void;
}

export default function Bonus({ onClose }: BonusProps) {
  const { theme, accentColor } = useTheme();
  const { user, accessToken } = useAuth();
  const isDark = theme === 'dark';

  const [balance, setBalance] = useState(0);
  const [dailyTaps, setDailyTaps] = useState(0);
  const [bonusTaps, setBonusTaps] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [tapAnimations, setTapAnimations] = useState<TapAnimation[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const [loading, setLoading] = useState(true);
  const pendingTapCountRef = useRef(0);
  const flushInFlightRef = useRef(false);
  const rollbackSnapshotRef = useRef<{ balance: number; dailyTaps: number; bonusTaps: number; totalEarned: number } | null>(null);

  const DAILY_LIMIT = 1000;
  const TAP_VALUE = 1;

  // Load bonus data from backend
  useEffect(() => {
    loadBonusData();
  }, [user, accessToken]);

  const loadBonusData = async () => {
    if (!user || !accessToken) {
      console.log('⚠️ Bonus: No user or token');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 ===== BONUS LOAD START =====');
      console.log('👤 User ID:', user.id);
      console.log('🔑 Access Token (first 50):', accessToken.substring(0, 50) + '...');
      console.log('🔑 Token length:', accessToken.length);
      console.log('🔑 Token type:', accessToken.split('.').length === 3 ? 'JWT' : 'Custom');
      
      if (!projectId || !publicAnonKey) {
        console.error('❌ Bonus: projectId or publicAnonKey missing');
        toast.error('Konfiguratsiya xatosi');
        setLoading(false);
        return;
      }
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/bonus`;
      console.log('📡 Request URL:', url);
      
      // Use Authorization with publicAnonKey + X-Access-Token with custom token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Access-Token': accessToken,
      };
      
      console.log('📡 Request headers (publicAnonKey + custom token)');
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      const responseText = await response.text();
      console.log('📥 Response text:', responseText);

      if (!response.ok) {
        console.error('❌ Bonus: Server error (status ' + response.status + '):', responseText);
        toast.error('Bonus yuklashda xatolik: ' + responseText);
        setLoading(false);
        return;
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('✅ Parsed data:', data);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        toast.error('Server xatosi');
        setLoading(false);
        return;
      }

      if (data.success && data.bonus) {
        setBalance(data.bonus.balance || 0);
        setDailyTaps(data.bonus.dailyTaps || 0);
        setBonusTaps(data.bonus.bonusTaps || 0);
        setTotalEarned(data.bonus.totalEarned || 0);
        console.log('✅ Bonus data loaded successfully');
      } else {
        console.error('❌ Bonus: Invalid response:', data);
        toast.error(data.error || 'Bonus yuklashda xatolik');
      }
      console.log('🔄 ===== BONUS LOAD END =====');
    } catch (error: any) {
      console.error('❌ Bonus: Load error:', error.message);
      toast.error('Bonus ma\'lumotlarini yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useVisibilityRefetch(() => {
    if (user && accessToken) void loadBonusData();
  });

  const flushPendingTaps = useCallback(async () => {
    if (!user || !accessToken) return;
    if (flushInFlightRef.current) return;
    const count = pendingTapCountRef.current;
    if (count <= 0) return;

    flushInFlightRef.current = true;
    pendingTapCountRef.current = 0;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/bonus/tap`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey,
            'X-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ count }),
        }
      );
      const data = await response.json();
      if (data.success && data.bonus) {
        setBalance(data.bonus.balance);
        setDailyTaps(data.bonus.dailyTaps);
        setBonusTaps(data.bonus.bonusTaps);
        setTotalEarned(data.bonus.totalEarned);
        rollbackSnapshotRef.current = null;
      } else {
        if (rollbackSnapshotRef.current) {
          setBalance(rollbackSnapshotRef.current.balance);
          setDailyTaps(rollbackSnapshotRef.current.dailyTaps);
          setBonusTaps(rollbackSnapshotRef.current.bonusTaps);
          setTotalEarned(rollbackSnapshotRef.current.totalEarned);
          rollbackSnapshotRef.current = null;
        }
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error flushing taps:', error);
      if (rollbackSnapshotRef.current) {
        setBalance(rollbackSnapshotRef.current.balance);
        setDailyTaps(rollbackSnapshotRef.current.dailyTaps);
        setBonusTaps(rollbackSnapshotRef.current.bonusTaps);
        setTotalEarned(rollbackSnapshotRef.current.totalEarned);
        rollbackSnapshotRef.current = null;
      }
    } finally {
      flushInFlightRef.current = false;
    }
  }, [user, accessToken, balance, dailyTaps, bonusTaps, totalEarned]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void flushPendingTaps();
    }, 250);
    return () => {
      window.clearInterval(timer);
      void flushPendingTaps();
    };
  }, [flushPendingTaps]);

  const handleTap = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!user) {
      toast.error('Bonus olish uchun tizimga kiring');
      return;
    }

    const availableTaps = DAILY_LIMIT - dailyTaps + bonusTaps;
    
    if (availableTaps <= 0) {
      toast.error('Kunlik limit tugadi! Market\'dan xarid qiling 🛒');
      return;
    }

    // Get tap position
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    if (!rollbackSnapshotRef.current) {
      rollbackSnapshotRef.current = { balance, dailyTaps, bonusTaps, totalEarned };
    }

    // Optimistic update
    const newBalance = balance + TAP_VALUE;
    let newDailyTaps = dailyTaps;
    let newBonusTaps = bonusTaps;

    if (bonusTaps > 0) {
      newBonusTaps = bonusTaps - 1;
    } else {
      newDailyTaps = dailyTaps + 1;
    }

    setBalance(newBalance);
    setDailyTaps(newDailyTaps);
    setBonusTaps(newBonusTaps);
    setTotalEarned(totalEarned + TAP_VALUE);

    // Add tap animation
    const newAnimation: TapAnimation = {
      id: Date.now() + Math.random(),
      x: clientX,
      y: clientY,
    };
    setTapAnimations(prev => [...prev, newAnimation]);

    setTimeout(() => {
      setTapAnimations(prev => prev.filter(a => a.id !== newAnimation.id));
    }, 1000);

    // Press animation
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 100);

    pendingTapCountRef.current += 1;
  };

  const remainingTaps = DAILY_LIMIT - dailyTaps + bonusTaps;
  const dailyProgress = ((dailyTaps / DAILY_LIMIT) * 100).toFixed(1);

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 50%, #ffffff 100%)',
      }}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 size-12 rounded-full flex items-center justify-center backdrop-blur-xl transition-all duration-300 active:scale-95 z-10"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: isDark 
            ? '0 4px 16px rgba(0, 0, 0, 0.3)' 
            : '0 4px 16px rgba(0, 0, 0, 0.1)',
        }}
      >
        <X className="size-6" style={{ color: isDark ? '#ffffff' : '#000000' }} />
      </button>

      {/* Loading State — Uzum-style skelet */}
      {loading && (
        <div
          className="h-full flex flex-col items-center justify-center px-6 py-12 w-full max-w-md mx-auto gap-4"
          role="status"
          aria-label="Yuklanmoqda"
        >
          <SkeletonBox isDark={isDark} className="h-36 w-full rounded-3xl" />
          <SkeletonBox isDark={isDark} className="h-20 w-full rounded-2xl" />
          <SkeletonBox isDark={isDark} className="h-14 w-3/4 rounded-2xl" />
          <span className="sr-only">Yuklanmoqda</span>
        </div>
      )}

      {/* Not Logged In */}
      {!loading && !user && (
        <div className="h-full flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div 
              className="inline-flex p-6 rounded-3xl mb-6"
              style={{ background: `${accentColor.color}20` }}
            >
              <Gift className="size-16" style={{ color: accentColor.color }} />
            </div>
            <h2 className="text-3xl font-black mb-3" style={{ color: isDark ? '#ffffff' : '#000000' }}>
              Tizimga kiring
            </h2>
            <p className="text-lg mb-6" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
              Bonus olish uchun tizimga kirishingiz kerak
            </p>
            <button
              onClick={onClose}
              className="px-8 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                color: '#ffffff',
                boxShadow: `0 8px 24px ${accentColor.color}40`,
              }}
            >
              Yopish
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && user && (
        <div className="h-full flex flex-col items-center justify-between py-8 px-6">
          {/* Top Section - Stats */}
          <div className="w-full max-w-md space-y-4">
            {/* Balance */}
            <div 
              className="p-6 rounded-3xl backdrop-blur-xl"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: isDark
                  ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  : '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                  Jami balans
                </span>
                <TrendingUp className="size-5" style={{ color: accentColor.color }} />
              </div>
              <div className="flex items-baseline gap-2">
                <span 
                  className="text-5xl font-black"
                  style={{ color: accentColor.color }}
                >
                  {balance.toLocaleString()}
                </span>
                <span className="text-2xl font-bold" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
                  so'm
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Daily Taps */}
              <div 
                className="p-4 rounded-2xl backdrop-blur-xl"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                    : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark
                    ? '0 4px 16px rgba(0, 0, 0, 0.3)'
                    : '0 4px 16px rgba(0, 0, 0, 0.06)',
                }}
              >
                <Zap className="size-5 mb-2" style={{ color: accentColor.color }} />
                <div className="text-2xl font-black mb-1" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  {dailyTaps}/{DAILY_LIMIT}
                </div>
                <div className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                  Kunlik taplar
                </div>
              </div>

              {/* Bonus Taps */}
              <div 
                className="p-4 rounded-2xl backdrop-blur-xl"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                    : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: isDark
                    ? '0 4px 16px rgba(0, 0, 0, 0.3)'
                    : '0 4px 16px rgba(0, 0, 0, 0.06)',
                }}
              >
                <Gift className="size-5 mb-2" style={{ color: accentColor.color }} />
                <div className="text-2xl font-black mb-1" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  {bonusTaps.toLocaleString()}
                </div>
                <div className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                  Bonus taplar
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div 
              className="p-4 rounded-2xl backdrop-blur-xl"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                  Bugungi progress
                </span>
                <span className="text-sm font-black" style={{ color: accentColor.color }}>
                  {dailyProgress}%
                </span>
              </div>
              <div 
                className="h-3 rounded-full overflow-hidden"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div 
                  className="h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${dailyProgress}%`,
                    background: `linear-gradient(90deg, ${accentColor.color}, ${accentColor.color}dd)`,
                    boxShadow: `0 0 12px ${accentColor.color}80`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Middle Section - Tap Button */}
          <div className="flex-1 flex items-center justify-center">
            <div
              onMouseDown={handleTap}
              onTouchStart={handleTap}
              className="relative cursor-pointer select-none touch-none"
              style={{
                transform: isPressed ? 'scale(0.95)' : 'scale(1)',
                transition: 'transform 0.1s ease-out',
              }}
            >
              {/* Glow Effect */}
              <div 
                className="absolute inset-0 rounded-full blur-3xl animate-pulse"
                style={{
                  background: `radial-gradient(circle, ${accentColor.color}40 0%, transparent 70%)`,
                  transform: 'scale(1.5)',
                }}
              />

              {/* Main Circle */}
              <div 
                className="relative size-64 rounded-full flex items-center justify-center"
                style={{
                  background: isDark
                    ? `linear-gradient(145deg, ${accentColor.color}dd, ${accentColor.color})`
                    : `linear-gradient(145deg, ${accentColor.color}, ${accentColor.color}dd)`,
                  boxShadow: isDark
                    ? `0 20px 60px ${accentColor.color}80, inset 0 2px 0 rgba(255, 255, 255, 0.3), inset 0 -2px 0 rgba(0, 0, 0, 0.3)`
                    : `0 20px 60px ${accentColor.color}60, inset 0 2px 0 rgba(255, 255, 255, 0.8), inset 0 -2px 0 rgba(0, 0, 0, 0.1)`,
                }}
              >
                <div className="text-center">
                  <div className="text-7xl font-black text-white mb-2">
                    +{TAP_VALUE}
                  </div>
                  <div className="text-lg font-bold text-white opacity-90">
                    TAP
                  </div>
                </div>
              </div>

              {/* Inner Circle */}
              <div 
                className="absolute inset-8 rounded-full"
                style={{
                  background: isDark
                    ? `linear-gradient(145deg, ${accentColor.color}, ${accentColor.color}aa)`
                    : `linear-gradient(145deg, ${accentColor.color}cc, ${accentColor.color})`,
                  boxShadow: `inset 0 4px 8px rgba(0, 0, 0, 0.2)`,
                }}
              />
            </div>

            {/* Tap Animations */}
            {tapAnimations.map((anim) => (
              <div
                key={anim.id}
                className="fixed pointer-events-none text-3xl font-black animate-float-up z-50"
                style={{
                  left: anim.x,
                  top: anim.y,
                  color: accentColor.color,
                  textShadow: `0 0 10px ${accentColor.color}80`,
                  animation: 'floatUp 1s ease-out forwards',
                }}
              >
                +{TAP_VALUE}
              </div>
            ))}
          </div>

          {/* Bottom Section - Info */}
          <div className="w-full max-w-md">
            <div 
              className="p-4 rounded-2xl backdrop-blur-xl flex items-center gap-3"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
              }}
            >
              <ShoppingBag className="size-6 flex-shrink-0" style={{ color: accentColor.color }} />
              <div className="flex-1">
                <div className="text-sm font-bold mb-1" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                  Qolgan taplar: {remainingTaps.toLocaleString()}
                </div>
                <div className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                  Market'dan xarid qilsangiz bonus tap olasiz! 💰
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(1.5);
          }
        }
        .animate-float-up {
          animation: floatUp 1s ease-out forwards;
        }
      ` }} />
    </div>
  );
}