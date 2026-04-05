import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import {
  X,
  Zap,
  TrendingUp,
  Gift,
  ShoppingBag,
  Home,
  BarChart3,
  Users,
  Wallet,
  Copy,
  Check,
  Share2,
  Medal,
  Link2,
} from 'lucide-react';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import {
  BONUS_PENDING_REF_KEY,
  normalizeReferralCodeInput,
} from '../utils/bonusReferralDeepLink';
import { SkeletonBox } from '../components/skeletons';

interface TapAnimation {
  id: number;
  x: number;
  y: number;
}

interface BonusProps {
  onClose?: () => void;
}

type BonusTab = 'home' | 'stats' | 'referral' | 'balance';

const BONUS_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/bonus`;

function bonusHeaders(accessToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${publicAnonKey}`,
    apikey: publicAnonKey,
    'X-Access-Token': accessToken,
  };
}

function historyLabel(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t === 'tap') return 'Tap — balansga qo‘shildi';
  if (t === 'used') return 'Buyurtmada ishlatilgan';
  if (t === 'referral_reward') return 'Referal mukofoti';
  if (t === 'bonus_taps_added') return 'Bonus taplar qo‘shildi';
  if (t === 'purchase_reward') return 'Xarid uchun bonus tap';
  return t || 'Operatsiya';
}

function historyKindBadge(type: string): { label: string; fg: string; bg: string } {
  const t = String(type || '').toLowerCase();
  if (t === 'used') return { label: 'Buyurtma', fg: '#ef4444', bg: 'rgba(239,68,68,0.14)' };
  if (t === 'referral_reward') return { label: 'Referal', fg: '#22c55e', bg: 'rgba(34,197,94,0.14)' };
  if (t === 'tap') return { label: 'Tap', fg: '#ca8a04', bg: 'rgba(234,179,8,0.16)' };
  if (t === 'purchase_reward' || t === 'bonus_taps_added')
    return { label: 'Yig‘ish', fg: '#2563eb', bg: 'rgba(37,99,235,0.12)' };
  return { label: 'Boshqa', fg: '#64748b', bg: 'rgba(100,116,139,0.12)' };
}

function leaderboardInitials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const one = parts[0] || '?';
  return one.slice(0, 2).toUpperCase();
}

export default function Bonus({ onClose }: BonusProps) {
  const { theme, accentColor } = useTheme();
  const { user, accessToken } = useAuth();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState<BonusTab>('home');
  const [balance, setBalance] = useState(0);
  const [dailyTaps, setDailyTaps] = useState(0);
  const [bonusTaps, setBonusTaps] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [tapAnimations, setTapAnimations] = useState<TapAnimation[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const [loading, setLoading] = useState(true);
  const pendingTapCountRef = useRef(0);
  const flushInFlightRef = useRef(false);
  const rollbackSnapshotRef = useRef<{
    balance: number;
    dailyTaps: number;
    bonusTaps: number;
    totalEarned: number;
  } | null>(null);

  const [leaderboard, setLeaderboard] = useState<
    Array<{
      userId: string;
      balance: number;
      totalEarned: number;
      displayName: string;
      phoneMasked: string;
    }>
  >([]);
  const [leaderboardMe, setLeaderboardMe] = useState<{
    rank: number;
    balance: number;
    totalEarned: number;
  } | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState({ invited: 0, rewarded: 0, earnedUzs: 0 });
  const [referralFriends, setReferralFriends] = useState<
    Array<{ maskedName: string; rewardPaid: boolean; appliedAt?: string }>
  >([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referrerLinked, setReferrerLinked] = useState(false);
  const [appliedFriendCode, setAppliedFriendCode] = useState<string | null>(null);
  const [rewardPerFriendUzs, setRewardPerFriendUzs] = useState(500);
  const [applyCodeInput, setApplyCodeInput] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const pendingAutoApplyRef = useRef<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const DAILY_LIMIT = 1000;
  const TAP_VALUE = 1;

  const loadBonusData = async () => {
    if (!user || !accessToken) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(BONUS_BASE, { headers: bonusHeaders(accessToken) });
      const data = await response.json();
      if (data.success && data.bonus) {
        setBalance(data.bonus.balance || 0);
        setDailyTaps(data.bonus.dailyTaps || 0);
        setBonusTaps(data.bonus.bonusTaps || 0);
        setTotalEarned(data.bonus.totalEarned || 0);
      } else if (!response.ok) {
        toast.error(data.error || 'Bonus yuklashda xatolik');
      }
    } catch {
      toast.error('Bonus maʼlumotlarini yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBonusData();
  }, [user, accessToken]);

  useVisibilityRefetch(() => {
    if (user && accessToken) void loadBonusData();
  });

  const loadLeaderboard = async () => {
    if (!accessToken) return;
    setLeaderboardLoading(true);
    try {
      const response = await fetch(`${BONUS_BASE}/leaderboard`, { headers: bonusHeaders(accessToken) });
      const data = await response.json();
      if (data.success && Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard);
        setLeaderboardMe(
          data.me && typeof data.me.rank === 'number'
            ? {
                rank: data.me.rank,
                balance: Number(data.me.balance) || 0,
                totalEarned: Number(data.me.totalEarned) || 0,
              }
            : null,
        );
      } else if (data.success && data.bonus && !Array.isArray(data.leaderboard)) {
        setLeaderboard([]);
        setLeaderboardMe(null);
        console.warn('[bonus] leaderboard: noto‘g‘ri javob (eski marshrut?)');
      } else {
        toast.error(data.error || 'Reyting yuklanmadi');
      }
    } catch {
      toast.error('Reyting yuklanmadi');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const loadReferral = useCallback(async () => {
    if (!accessToken) return;
    setReferralLoading(true);
    try {
      const response = await fetch(`${BONUS_BASE}/referral`, { headers: bonusHeaders(accessToken) });
      const data = await response.json();
      if (data.success) {
        const c = normalizeReferralCodeInput(String(data.code || ''));
        setReferralCode(c);
        setReferrerLinked(Boolean(data.referrerLinked));
        setAppliedFriendCode(
          data.appliedReferralCode ? normalizeReferralCodeInput(String(data.appliedReferralCode)) : null,
        );
        setRewardPerFriendUzs(Number(data.rewardPerFriendUzs) || 500);
        setReferralStats(data.stats || { invited: 0, rewarded: 0, earnedUzs: 0 });
        setReferralFriends(Array.isArray(data.referees) ? data.referees : []);
      } else {
        toast.error(data.error || 'Referal yuklanmadi');
      }
    } catch {
      toast.error('Referal yuklanmadi');
    } finally {
      setReferralLoading(false);
    }
  }, [accessToken]);

  useLayoutEffect(() => {
    if (!user || !accessToken) {
      setReferrerLinked(false);
      setAppliedFriendCode(null);
      setReferralCode('');
      pendingAutoApplyRef.current = null;
      return;
    }
    void loadReferral();
  }, [user, accessToken, loadReferral]);

  useEffect(() => {
    if (!user || !accessToken) return;
    if (referralLoading) return;
    if (referrerLinked) return;

    const raw = sessionStorage.getItem(BONUS_PENDING_REF_KEY);
    const code = normalizeReferralCodeInput(raw);
    if (code.length < 8) return;
    if (pendingAutoApplyRef.current === code) return;
    pendingAutoApplyRef.current = code;
    sessionStorage.removeItem(BONUS_PENDING_REF_KEY);

    (async () => {
      try {
        const response = await fetch(`${BONUS_BASE}/referral/apply`, {
          method: 'POST',
          headers: bonusHeaders(accessToken),
          body: JSON.stringify({ code }),
        });
        const data = await response.json();
        if (data.success) {
          toast.success(data.message || 'Do‘st kodi havola orqali ulandi!');
          await loadReferral();
        } else {
          const err = String(data.error || '');
          if (err.includes('allaqachon')) {
            await loadReferral();
          } else if (err.includes('yig‘magan') || err.includes('yig‘ilgan') || err.toLowerCase().includes('tap')) {
            toast.error(err);
          } else {
            toast.error(err || 'Kod ulanmadi');
          }
        }
      } catch {
        sessionStorage.setItem(BONUS_PENDING_REF_KEY, code);
        pendingAutoApplyRef.current = null;
        toast.error('Tarmoq xatosi — havola keyinroq qayta ishlaydi');
      }
    })();
  }, [user, accessToken, referralLoading, referrerLinked, loadReferral]);

  const loadHistory = async () => {
    if (!accessToken) return;
    setHistoryLoading(true);
    try {
      const response = await fetch(`${BONUS_BASE}/history`, { headers: bonusHeaders(accessToken) });
      const data = await response.json();
      if (data.success) {
        setHistory(Array.isArray(data.history) ? data.history : []);
      } else {
        toast.error(data.error || 'Tarix yuklanmadi');
      }
    } catch {
      toast.error('Tarix yuklanmadi');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !accessToken) return;
    if (tab === 'stats') void loadLeaderboard();
    if (tab === 'referral') void loadReferral();
    if (tab === 'balance') void loadHistory();
  }, [tab, user, accessToken]);

  const flushPendingTaps = useCallback(async () => {
    if (!user || !accessToken) return;
    if (flushInFlightRef.current) return;
    const count = pendingTapCountRef.current;
    if (count <= 0) return;

    flushInFlightRef.current = true;
    pendingTapCountRef.current = 0;
    try {
      const response = await fetch(`${BONUS_BASE}/tap`, {
        method: 'POST',
        headers: bonusHeaders(accessToken),
        body: JSON.stringify({ count }),
      });
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
        toast.error(data.error || 'Tap sinxronlashda xatolik');
      }
    } catch {
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
  }, [user, accessToken]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void flushPendingTaps();
    }, 250);
    return () => {
      window.clearInterval(timer);
      void flushPendingTaps();
    };
  }, [flushPendingTaps]);

  const handleTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!user) {
      toast.error('Bonus olish uchun tizimga kiring');
      return;
    }

    const availableTaps = DAILY_LIMIT - dailyTaps + bonusTaps;
    if (availableTaps <= 0) {
      toast.error('Kunlik limit tugadi! Marketdan xarid qiling 🛒');
      return;
    }

    let clientX: number;
    let clientY: number;
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

    const newAnimation: TapAnimation = {
      id: Date.now() + Math.random(),
      x: clientX,
      y: clientY,
    };
    setTapAnimations((prev) => [...prev, newAnimation]);
    setTimeout(() => {
      setTapAnimations((prev) => prev.filter((a) => a.id !== newAnimation.id));
    }, 1000);

    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 100);
    pendingTapCountRef.current += 1;
  };

  const buildInviteUrl = () => {
    if (typeof window === 'undefined' || !referralCode) return '';
    const path = window.location.pathname || '/';
    return `${window.location.origin}${path.split('?')[0]}?ref=${encodeURIComponent(referralCode)}`;
  };

  const copyReferralCode = async () => {
    if (!referralCode) {
      toast.info('Kod yuklanmoqda…');
      void loadReferral();
      return;
    }
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      toast.success('Kod nusxalandi');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Nusxalab bo‘lmadi');
    }
  };

  const copyInviteLink = async () => {
    const url = buildInviteUrl();
    if (!url) {
      toast.error('Avval referal yuklanishini kuting');
      void loadReferral();
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteLink(true);
      toast.success('Taklif havolasi nusxalandi');
      setTimeout(() => setCopiedInviteLink(false), 2000);
    } catch {
      toast.error('Nusxalab bo‘lmadi');
    }
  };

  const shareReferral = async () => {
    const url = buildInviteUrl();
    const text = `ARESS ilovasiga qo‘shil! Ro‘yxatdan o‘t, mening referal kodimni kiriting (yoki havolani och) va birinchi marta «tap» qil — do‘stingizga bonus tushadi.\n\nKod: ${referralCode || '—'}${url ? `\n\nHavola:\n${url}` : ''}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Bonus — referal',
          text,
          url: url || undefined,
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Matn nusxalandi');
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    const code = normalizeReferralCodeInput(applyCodeInput);
    if (code.length < 8) {
      toast.error('8 belgili kodni kiriting');
      return;
    }
    setApplyLoading(true);
    try {
      const response = await fetch(`${BONUS_BASE}/referral/apply`, {
        method: 'POST',
        headers: bonusHeaders(accessToken),
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message || 'Kod qabul qilindi');
        setApplyCodeInput('');
        void loadReferral();
      } else {
        toast.error(data.error || 'Xatolik');
      }
    } catch {
      toast.error('So‘rov yuborilmadi');
    } finally {
      setApplyLoading(false);
    }
  };

  const balanceHistoryStats = useMemo(() => {
    let spentOrders = 0;
    let referral = 0;
    let tapAndExtras = 0;
    for (const h of history) {
      const t = String(h?.type || '').toLowerCase();
      const a = Math.abs(Number(h?.amount) || 0);
      if (t === 'used') spentOrders += a;
      else if (t === 'referral_reward') referral += a;
      else if (t === 'tap' || t === 'purchase_reward' || t === 'bonus_taps_added') tapAndExtras += a;
    }
    return { spentOrders, referral, tapAndExtras };
  }, [history]);

  const remainingTaps = DAILY_LIMIT - dailyTaps + bonusTaps;
  const dailyProgress = Math.min(100, (dailyTaps / DAILY_LIMIT) * 100).toFixed(1);

  const tabBtn = (id: BonusTab, label: string, Icon: typeof Home) => {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className="flex flex-1 flex-col items-center gap-1 py-2 px-1 transition-all active:scale-95"
        style={{
          color: active ? accentColor.color : isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
        }}
      >
        <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
        <span className="text-[10px] font-bold leading-none sm:text-[11px]">{label}</span>
      </button>
    );
  };

  const balanceChip = (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
      style={{
        background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
      }}
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-60">Balans</p>
        <p className="text-2xl font-black tabular-nums" style={{ color: accentColor.color }}>
          {balance.toLocaleString()} <span className="text-sm font-bold opacity-70">soʻm</span>
        </p>
      </div>
      <TrendingUp className="size-8 shrink-0 opacity-80" style={{ color: accentColor.color }} />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden app-safe-pad"
      style={{
        background: isDark
          ? 'linear-gradient(165deg, #0a0a0a 0%, #141414 45%, #0a0a0a 100%)'
          : 'linear-gradient(165deg, #ffffff 0%, #f4f4f5 50%, #ffffff 100%)',
      }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <h1 className="text-lg font-black tracking-tight" style={{ color: isDark ? '#fff' : '#111' }}>
          Bonus
        </h1>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full transition-all active:scale-95"
          style={{
            background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          }}
        >
          <X className="size-6" style={{ color: isDark ? '#fff' : '#111' }} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && (
          <div className="mx-auto flex max-w-lg flex-col gap-3 p-4" role="status">
            <SkeletonBox isDark={isDark} className="h-20 w-full rounded-2xl" />
            <SkeletonBox isDark={isDark} className="h-48 w-full rounded-3xl" />
            <SkeletonBox isDark={isDark} className="h-24 w-full rounded-2xl" />
          </div>
        )}

        {!loading && !user && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 inline-flex rounded-3xl p-6" style={{ background: `${accentColor.color}22` }}>
              <Gift className="size-14" style={{ color: accentColor.color }} />
            </div>
            <h2 className="mb-2 text-2xl font-black" style={{ color: isDark ? '#fff' : '#111' }}>
              Tizimga kiring
            </h2>
            <p className="mb-6 text-sm opacity-70">Bonus va referallar uchun akkaunt kerak</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-8 py-3 font-bold text-white"
              style={{ background: accentColor.gradient }}
            >
              Yopish
            </button>
          </div>
        )}

        {!loading && user && tab === 'home' && (
          <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-28">
            {balanceChip}

            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                  boxShadow: isDark ? 'none' : '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                <Zap className="mb-2 size-5" style={{ color: accentColor.color }} />
                <p className="text-xl font-black tabular-nums" style={{ color: isDark ? '#fff' : '#111' }}>
                  {dailyTaps}/{DAILY_LIMIT}
                </p>
                <p className="text-[11px] font-semibold opacity-55">Kunlik taplar</p>
              </div>
              <div
                className="rounded-2xl p-4"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                  boxShadow: isDark ? 'none' : '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                <Gift className="mb-2 size-5" style={{ color: accentColor.color }} />
                <p className="text-xl font-black tabular-nums" style={{ color: isDark ? '#fff' : '#111' }}>
                  {bonusTaps.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold opacity-55">Bonus taplar</p>
              </div>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold opacity-70">Bugungi progress</span>
                <span className="text-xs font-black" style={{ color: accentColor.color }}>
                  {dailyProgress}%
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full"
                style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${dailyProgress}%`,
                    background: accentColor.gradient,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center py-4">
              <div
                role="button"
                tabIndex={0}
                onMouseDown={handleTap}
                onTouchStart={handleTap}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleTap(e as any);
                }}
                className="relative cursor-pointer select-none touch-manipulation"
                style={{
                  transform: isPressed ? 'scale(0.96)' : 'scale(1)',
                  transition: 'transform 0.1s ease-out',
                }}
              >
                <div
                  className="absolute inset-0 scale-150 rounded-full blur-3xl"
                  style={{
                    background: `radial-gradient(circle, ${accentColor.color}45 0%, transparent 65%)`,
                  }}
                />
                <div
                  className="relative flex size-56 items-center justify-center rounded-full sm:size-60"
                  style={{
                    background: accentColor.gradient,
                    boxShadow: `0 20px 50px ${accentColor.color}66, inset 0 2px 0 rgba(255,255,255,0.25)`,
                  }}
                >
                  <div className="text-center text-white">
                    <p className="text-6xl font-black leading-none">+{TAP_VALUE}</p>
                    <p className="mt-1 text-lg font-bold opacity-95">TAP</p>
                  </div>
                </div>
              </div>

              {tapAnimations.map((anim) => (
                <div
                  key={anim.id}
                  className="pointer-events-none fixed z-[60] text-3xl font-black"
                  style={{
                    left: anim.x,
                    top: anim.y,
                    color: accentColor.color,
                    animation: 'bonusFloatUp 0.95s ease-out forwards',
                  }}
                >
                  +{TAP_VALUE}
                </div>
              ))}
            </div>

            <div
              className="flex items-center gap-3 rounded-2xl p-4"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <ShoppingBag className="size-6 shrink-0" style={{ color: accentColor.color }} />
              <div>
                <p className="text-sm font-bold" style={{ color: isDark ? '#fff' : '#111' }}>
                  Qolgan taplar: {remainingTaps.toLocaleString()}
                </p>
                <p className="text-xs opacity-60">Marketdan xarid — qo‘shimcha bonus taplar 💰</p>
              </div>
            </div>
          </div>
        )}

        {!loading && user && tab === 'stats' && (
          <div className="relative mx-auto max-w-lg space-y-5 p-4 pb-28">
            <div
              className="pointer-events-none absolute inset-x-0 -top-4 h-56 opacity-50"
              style={{
                background:
                  'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(245, 197, 66, 0.22), transparent 65%)',
              }}
            />

            {leaderboardMe && (
              <div
                className="relative overflow-hidden rounded-3xl p-4 sm:p-5"
                style={{
                  background: isDark
                    ? 'linear-gradient(145deg, rgba(245,197,66,0.12) 0%, rgba(20,20,20,0.95) 55%)'
                    : 'linear-gradient(145deg, rgba(245,197,66,0.2) 0%, #ffffff 50%)',
                  border: isDark ? '1px solid rgba(245,197,66,0.35)' : '1px solid rgba(245,197,66,0.45)',
                  boxShadow: isDark
                    ? '0 0 40px rgba(245,197,66,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
                    : '0 12px 40px rgba(245,197,66,0.15)',
                  animation: 'bonusLeaderPulse 3s ease-in-out infinite',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/90">
                      Sizning o‘rningiz
                    </p>
                    <p className="mt-1 text-4xl font-black leading-none tabular-nums text-amber-400 drop-shadow-sm">
                      #{leaderboardMe.rank}
                    </p>
                  </div>
                  <Medal className="size-10 shrink-0 text-amber-400 opacity-90" strokeWidth={2} />
                </div>
                <p className="mt-3 text-sm font-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.88)' : '#111' }}>
                  <span className="tabular-nums font-black text-amber-500">
                    {leaderboardMe.balance.toLocaleString()}
                  </span>{' '}
                  soʻm balans
                  <span className="mx-2 opacity-35">·</span>
                  <span className="text-xs opacity-70">
                    jami yig‘ilgan {leaderboardMe.totalEarned.toLocaleString()}
                  </span>
                </p>
              </div>
            )}

            <div className="relative">
              <h2
                className="flex items-center gap-2 text-lg font-black tracking-tight"
                style={{ color: isDark ? '#fff' : '#111' }}
              >
                <Zap className="size-6 text-amber-400" fill="currentColor" strokeWidth={1.5} />
                Reyting
              </h2>
              <p className="mt-1 text-xs leading-relaxed opacity-55">
                Bonus tizimidagi foydalanuvchilar — balans bo‘yicha (Notcoin uslubida jonli jadval)
              </p>
            </div>

            {leaderboardLoading && (
              <div className="relative space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonBox key={i} isDark={isDark} className="h-[4.5rem] w-full rounded-2xl" />
                ))}
              </div>
            )}

            {!leaderboardLoading && leaderboard.length > 0 && (
              <div className="relative space-y-4">
                {(() => {
                  const second = leaderboard[1];
                  const first = leaderboard[0];
                  const third = leaderboard[2];
                  const podiumBg = (tone: 'gold' | 'silver' | 'bronze') => {
                    if (tone === 'gold')
                      return isDark
                        ? 'linear-gradient(180deg, rgba(255,224,102,0.2) 0%, rgba(212,160,10,0.08) 100%)'
                        : 'linear-gradient(180deg, #fff8e1 0%, #ffe082 35%, #ffc107 100%)';
                    if (tone === 'silver')
                      return isDark
                        ? 'linear-gradient(180deg, rgba(200,212,224,0.18) 0%, rgba(100,116,139,0.08) 100%)'
                        : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)';
                    return isDark
                      ? 'linear-gradient(180deg, rgba(205,127,50,0.2) 0%, rgba(120,53,15,0.1) 100%)'
                      : 'linear-gradient(180deg, #fde6d3 0%, #cd7f32 55%)';
                  };
                  const podiumBorder = (tone: 'gold' | 'silver' | 'bronze') => {
                    if (tone === 'gold') return isDark ? 'rgba(255,214,102,0.45)' : 'rgba(255,193,7,0.65)';
                    if (tone === 'silver') return isDark ? 'rgba(200,212,224,0.4)' : 'rgba(148,163,184,0.55)';
                    return isDark ? 'rgba(205,127,50,0.45)' : 'rgba(180,83,9,0.45)';
                  };
                  const slot = (
                    row: (typeof leaderboard)[0] | undefined,
                    rank: number,
                    minH: string,
                    tone: 'gold' | 'silver' | 'bronze',
                  ) => {
                    if (!row) {
                      return (
                        <div className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ maxWidth: 120 }} />
                      );
                    }
                    const isMe = user?.id === row.userId;
                    return (
                      <div
                        className="flex min-w-0 flex-1 flex-col items-center gap-2"
                        style={{ maxWidth: 120 }}
                      >
                        <div
                          className="flex w-full flex-col items-center justify-end rounded-2xl px-2 pb-3 pt-6 text-center"
                          style={{
                            minHeight: minH,
                            background: podiumBg(tone),
                            border: `1px solid ${podiumBorder(tone)}`,
                            boxShadow: isMe
                              ? `0 0 0 2px ${accentColor.color}, 0 8px 24px rgba(0,0,0,0.12)`
                              : '0 8px 24px rgba(0,0,0,0.08)',
                          }}
                        >
                          <div
                            className="flex size-11 items-center justify-center rounded-full text-sm font-black text-white shadow-lg sm:size-12 sm:text-base"
                            style={{
                              background:
                                tone === 'gold'
                                  ? 'linear-gradient(145deg, #ffe066, #d4a00a)'
                                  : tone === 'silver'
                                    ? 'linear-gradient(145deg, #e2e8f0, #64748b)'
                                    : 'linear-gradient(145deg, #f59e0b, #9a3412)',
                            }}
                          >
                            {leaderboardInitials(row.displayName)}
                          </div>
                          <p
                            className="mt-2 w-full truncate px-0.5 text-[11px] font-bold leading-tight sm:text-xs"
                            style={{ color: isDark ? '#fff' : '#111' }}
                          >
                            {row.displayName}
                          </p>
                          <p className="mt-0.5 font-mono text-xs font-black tabular-nums text-amber-600 dark:text-amber-300 sm:text-sm">
                            {row.balance.toLocaleString()}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wide opacity-45">soʻm</p>
                        </div>
                        <span
                          className="text-sm font-black tabular-nums opacity-80"
                          style={{ color: isDark ? '#fff' : '#111' }}
                        >
                          #{rank}
                        </span>
                      </div>
                    );
                  };
                  return (
                    <div className="flex items-end justify-center gap-1.5 sm:gap-3">
                      {slot(second, 2, '7.5rem', 'silver')}
                      {slot(first, 1, '9.5rem', 'gold')}
                      {slot(third, 3, '6.5rem', 'bronze')}
                    </div>
                  );
                })()}

                {leaderboard.slice(3).map((row, i) => {
                  const rank = i + 4;
                  const isMe = user?.id === row.userId;
                  return (
                    <div
                      key={row.userId}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 sm:px-4"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.92)',
                        border: isMe
                          ? `1px solid ${accentColor.color}`
                          : isDark
                            ? '1px solid rgba(255,255,255,0.07)'
                            : '1px solid rgba(0,0,0,0.06)',
                        boxShadow: isMe ? `0 0 20px ${accentColor.color}22` : undefined,
                      }}
                    >
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-black tabular-nums sm:size-10"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                          color: isDark ? 'rgba(255,255,255,0.75)' : '#111',
                        }}
                      >
                        {rank}
                      </div>
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                        style={{
                          background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}99)`,
                        }}
                      >
                        {leaderboardInitials(row.displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold" style={{ color: isDark ? '#fff' : '#111' }}>
                          {row.displayName}
                          {isMe ? (
                            <span className="ml-1.5 text-[10px] font-black uppercase text-amber-500">siz</span>
                          ) : null}
                        </p>
                        <p className="text-[11px] opacity-45">{row.phoneMasked}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-base font-black tabular-nums text-amber-500 sm:text-lg">
                          {row.balance.toLocaleString()}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wide opacity-40">soʻm</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!leaderboardLoading && leaderboard.length === 0 && (
              <div
                className="relative rounded-3xl border px-4 py-10 text-center"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                }}
              >
                <BarChart3 className="mx-auto mb-3 size-10 opacity-30" />
                <p className="text-sm font-bold opacity-70">Hozircha reyting bo‘sh</p>
                <p className="mx-auto mt-2 max-w-xs text-xs opacity-50">
                  Birinchi bo‘lib tap qiling — ro‘yxat shu yerga tushadi. Do‘stlaringizni taklif qiling.
                </p>
              </div>
            )}
          </div>
        )}

        {!loading && user && tab === 'referral' && (
          <div className="mx-auto max-w-lg space-y-4 p-4 pb-28">
            <div
              className="rounded-2xl p-5 text-center"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                boxShadow: isDark ? 'none' : '0 8px 30px rgba(0,0,0,0.06)',
              }}
            >
              <Users className="mx-auto mb-2 size-10" style={{ color: accentColor.color }} />
              <p className="text-sm font-bold opacity-70">Sizning referal kodingiz</p>
              <p className="mt-1 text-[11px] opacity-50">Serverda avtomatik yaratiladi — har bir akkaunt uchun bitta kod</p>
              {referralLoading ? (
                <SkeletonBox isDark={isDark} className="mx-auto mt-3 h-12 w-full max-w-xs rounded-xl" />
              ) : (
                <p
                  className="mt-2 font-mono text-3xl font-black tracking-[0.2em] sm:text-4xl"
                  style={{ color: accentColor.color }}
                >
                  {referralCode || (
                    <span className="text-lg font-bold opacity-45">Yuklanmoqda…</span>
                  )}
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyReferralCode()}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
                  style={{ background: accentColor.gradient }}
                >
                  {copiedCode ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copiedCode ? 'Nusxalandi' : 'Kodni nusxalash'}
                </button>
                <button
                  type="button"
                  onClick={() => void copyInviteLink()}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                    color: isDark ? '#fff' : '#111',
                  }}
                >
                  {copiedInviteLink ? <Check className="size-4" /> : <Link2 className="size-4" />}
                  {copiedInviteLink ? 'Havola nusxalandi' : 'Havolani nusxalash'}
                </button>
                <button
                  type="button"
                  onClick={() => void shareReferral()}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                    color: isDark ? '#fff' : '#111',
                  }}
                >
                  <Share2 className="size-4" />
                  Ulashish
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { v: referralStats.invited, l: 'Taklif' },
                { v: referralStats.rewarded, l: 'To‘langan' },
                { v: referralStats.earnedUzs, l: 'So‘m' },
              ].map((x) => (
                <div
                  key={x.l}
                  className="rounded-xl py-3"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  }}
                >
                  <p className="text-lg font-black" style={{ color: accentColor.color }}>
                    {typeof x.v === 'number' ? x.v.toLocaleString() : x.v}
                  </p>
                  <p className="text-[10px] font-bold uppercase opacity-55">{x.l}</p>
                </div>
              ))}
            </div>

            <p className="text-xs leading-relaxed opacity-70">
              Do‘stingiz ro‘yxatdan o‘tib, <strong>sizning kodingizni</strong> kiritsa yoki <strong>taklif havolangizni</strong>{' '}
              ochsa (avtomatik ulanadi) va <strong>birinchi marta tap</strong> qilgach, sizga{' '}
              <strong>{rewardPerFriendUzs.toLocaleString()} soʻm</strong> bonus tushadi (har bir do‘st uchun bir marta).
            </p>

            {referrerLinked ? (
              <div
                className="rounded-2xl border px-4 py-4"
                style={{
                  background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.1)',
                  borderColor: isDark ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.4)',
                }}
              >
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Do‘st kodi bilan ulangan siz</p>
                <p className="mt-1 font-mono text-lg font-black tracking-wider" style={{ color: isDark ? '#fff' : '#111' }}>
                  {appliedFriendCode || '—'}
                </p>
                <p className="mt-2 text-xs opacity-70">
                  Birinchi tap qilgach taklif qiluvchiga {rewardPerFriendUzs.toLocaleString()} soʻm tushadi (serverda haqiqiy).
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleApplyReferral}
                className="space-y-3 rounded-2xl p-4"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <p className="text-sm font-bold" style={{ color: isDark ? '#fff' : '#111' }}>
                  Do‘stingiz kodi
                </p>
                <p className="text-[11px] leading-snug opacity-55">
                  Havola orqali kirgan bo‘lsangiz, kod odatda avtomatik ulanadi. Faqat hali «tap» dan pul yig‘magan akkauntlar
                  ulana oladi.
                </p>
                <input
                  value={applyCodeInput}
                  onChange={(e) => setApplyCodeInput(e.target.value.toUpperCase())}
                  placeholder="8 belgili kod"
                  className="w-full rounded-xl border px-4 py-3 font-mono text-lg font-bold outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                    color: isDark ? '#fff' : '#111',
                  }}
                />
                <button
                  type="submit"
                  disabled={applyLoading}
                  className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
                  style={{ background: accentColor.gradient }}
                >
                  {applyLoading ? '...' : 'Kodni ulash'}
                </button>
              </form>
            )}

            {referralFriends.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold opacity-80">Taklif qilganlaringiz</p>
                <ul className="space-y-2">
                  {referralFriends.map((f, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-xl px-3 py-2 text-sm"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      <span className="font-medium">{f.maskedName}</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: f.rewardPaid ? '#22c55e' : '#f59e0b' }}
                      >
                        {f.rewardPaid ? `+${rewardPerFriendUzs.toLocaleString()} soʻm` : 'Kutilmoqda'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!loading && user && tab === 'balance' && (
          <div className="mx-auto max-w-lg space-y-4 p-4 pb-28">
            {balanceChip}

            <div
              className="space-y-3 rounded-2xl p-4"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-start gap-3">
                <ShoppingBag className="mt-0.5 size-5 shrink-0" style={{ color: accentColor.color }} />
                <div>
                  <p className="font-bold" style={{ color: isDark ? '#fff' : '#111' }}>
                    Chegirma faqat checkoutda
                  </p>
                  <p className="mt-1 text-xs leading-relaxed opacity-65">
                    Bonusni shu ekrandan yechib bo‘lmaydi. To‘lov sahifasida «Bonus ballar»ni yoqib buyurtma berganingizda
                    balansdan avtomatik yechiladi. Pastdagi tarixda buyurtmada ishlatilganlar, referal mukofotlari va tap
                    yozuvlari alohida ko‘rinadi.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div
                className="rounded-xl px-2 py-3 text-center"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <p className="text-[9px] font-bold uppercase leading-tight opacity-55">Buyurtmada</p>
                <p className="mt-1 text-sm font-black tabular-nums text-red-500">
                  {balanceHistoryStats.spentOrders.toLocaleString()}
                </p>
                <p className="text-[9px] opacity-45">soʻm</p>
              </div>
              <div
                className="rounded-xl px-2 py-3 text-center"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <p className="text-[9px] font-bold uppercase leading-tight opacity-55">Referal</p>
                <p className="mt-1 text-sm font-black tabular-nums text-emerald-500">
                  {balanceHistoryStats.referral.toLocaleString()}
                </p>
                <p className="text-[9px] opacity-45">soʻm</p>
              </div>
              <div
                className="rounded-xl px-2 py-3 text-center"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <p className="text-[9px] font-bold uppercase leading-tight opacity-55">Tap va boshqalar</p>
                <p
                  className="mt-1 text-sm font-black tabular-nums"
                  style={{ color: isDark ? '#fff' : '#111' }}
                >
                  {balanceHistoryStats.tapAndExtras.toLocaleString()}
                </p>
                <p className="text-[9px] opacity-45">soʻm</p>
              </div>
            </div>

            <h3 className="flex items-center gap-2 text-sm font-black" style={{ color: isDark ? '#fff' : '#111' }}>
              <Medal className="size-4 opacity-70" />
              Operatsiyalar tarixi
            </h3>

            {historyLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <SkeletonBox key={i} isDark={isDark} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            )}

            {!historyLoading && history.length === 0 && (
              <p className="py-6 text-center text-sm opacity-55">Hozircha operatsiyalar yo‘q</p>
            )}

            {!historyLoading &&
              history.map((h, i) => {
                const amt = Number(h.amount) || 0;
                const isDebit = amt < 0;
                const badge = historyKindBadge(h.type);
                return (
                  <div
                    key={i}
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                      border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
                            style={{ color: badge.fg, background: badge.bg }}
                          >
                            {badge.label}
                          </span>
                          <p className="text-sm font-bold" style={{ color: isDark ? '#fff' : '#111' }}>
                            {historyLabel(h.type)}
                          </p>
                        </div>
                        {h.description && (
                          <p className="mt-0.5 text-xs opacity-55">{String(h.description)}</p>
                        )}
                        <p className="mt-1 text-[10px] opacity-40">
                          {h.timestamp ? new Date(h.timestamp).toLocaleString('uz-UZ') : ''}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-sm font-black tabular-nums"
                        style={{ color: isDebit ? '#ef4444' : '#22c55e' }}
                      >
                        {amt >= 0 ? '+' : ''}
                        {amt.toLocaleString()} soʻm
                      </span>
                    </div>
                    {h.balanceAfter != null && (
                      <p className="mt-2 text-[10px] opacity-45">Balans keyin: {Number(h.balanceAfter).toLocaleString()}</p>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {!loading && user && (
        <nav
          className="shrink-0 border-t px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            background: isDark ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="mx-auto flex max-w-lg">
            {tabBtn('home', 'Asosiy', Home)}
            {tabBtn('stats', 'Statistika', BarChart3)}
            {tabBtn('referral', 'Referal', Users)}
            {tabBtn('balance', 'Balans', Wallet)}
          </div>
        </nav>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bonusFloatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-88px) scale(1.25); }
        }
        @keyframes bonusLeaderPulse {
          0%, 100% { box-shadow: 0 0 28px rgba(245, 197, 66, 0.15), inset 0 1px 0 rgba(255,255,255,0.06); }
          50% { box-shadow: 0 0 40px rgba(245, 197, 66, 0.28), inset 0 1px 0 rgba(255,255,255,0.08); }
        }
      `,
        }}
      />
    </div>
  );
}
