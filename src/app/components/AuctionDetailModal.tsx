import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  Gavel,
  Users,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

/** Auksion ishtirok to‘lovi — har bir auksion alohida, tanlangan usul checkoutga uzatiladi */
export type AuctionParticipationPayMethod = 'payme' | 'click' | 'card' | 'atmos';

interface Auction {
  id: string;
  branchId: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  startPrice: number;
  maxPrice: number;
  currentPrice: number;
  participationFee: number;
  bidIncrementPercent: number;
  durationDays: number;
  endDate: string;
  status: string;
  totalBids: number;
  totalParticipants: number;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  condition?: string;
}

interface AuctionDetailModalProps {
  auction: Auction;
  onClose: () => void;
  onPlaceBid: (amount: string) => Promise<void>;
  /** Rozidan keyin: kichik haq — paymentMethodsiz; ≥1000 so‘m — paymentMethod majburiy */
  onParticipate: (opts?: { paymentMethod?: AuctionParticipationPayMethod }) => Promise<void>;
  getTimeRemaining: (endDate: string) => string;
  calculateMinimumBid: (auction: Auction) => number;
  /** Ishtirok / to‘lov oqimi ketmoqda */
  participateSubmitting?: boolean;
}

export function AuctionDetailModal({
  auction,
  onClose,
  onPlaceBid,
  onParticipate,
  getTimeRemaining,
  calculateMinimumBid,
  participateSubmitting = false,
}: AuctionDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  /** Ishtirok: shartlar → to‘lov usuli → API */
  const [participateStep, setParticipateStep] = useState<'cta' | 'terms' | 'pay'>('cta');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] =
    useState<AuctionParticipationPayMethod | null>(null);

  const participationFeeSoum = Math.max(0, Math.floor(Number(auction.participationFee) || 0));
  const needsOnlineParticipationPayment = participationFeeSoum >= 1000;

  useEffect(() => {
    setParticipateStep('cta');
    setTermsAccepted(false);
    setSelectedPayMethod(null);
  }, [auction.id]);

  // Real-time timer - har sekundda yangilanadi
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmitBid = async () => {
    try {
      setSubmitting(true);
      await onPlaceBid(bidAmount);
      setBidAmount('');
    } catch (error) {
      // Error handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
      style={{
        background: isDark ? '#0a0a0a' : '#ffffff',
      }}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[70] p-3 rounded-full backdrop-blur-xl transition-all active:scale-95 shadow-2xl"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
        }}
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Image Gallery - FIXED TOP */}
      <div className="relative w-full h-[40vh] md:h-[50vh] flex-shrink-0">
        <img
          src={auction.images[selectedImageIndex]}
          alt={auction.name}
          className="w-full h-full object-cover"
        />

        {/* Gradient Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.8) 100%)',
          }}
        />

        {/* Navigation Arrows */}
        {auction.images.length > 1 && (
          <>
            <button
              onClick={() =>
                setSelectedImageIndex((prev) =>
                  prev === 0 ? auction.images.length - 1 : prev - 1
                )
              }
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full backdrop-blur-xl transition-all active:scale-95"
              style={{ background: 'rgba(0, 0, 0, 0.6)' }}
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() =>
                setSelectedImageIndex((prev) =>
                  prev === auction.images.length - 1 ? 0 : prev + 1
                )
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full backdrop-blur-xl transition-all active:scale-95"
              style={{ background: 'rgba(0, 0, 0, 0.6)' }}
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>

            {/* Image Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {auction.images.map((_, index) => (
                <div
                  key={index}
                  className="transition-all rounded-full"
                  style={{
                    width: index === selectedImageIndex ? '24px' : '6px',
                    height: '6px',
                    background: index === selectedImageIndex
                      ? '#ffffff'
                      : 'rgba(255, 255, 255, 0.4)',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content - SCROLLABLE */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
        }}
      >
        <div className="p-4 md:p-6 pb-32 max-w-2xl mx-auto">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{auction.name}</h1>

          {/* Seller */}
          {/* <p className="text-sm mb-6" style={{ color: accentColor.color }}>
            Sotuvchi: <span className="font-medium">@{auction.branchId || 'GameZone_uz'}</span>
          </p> */}

          {/* Price & Time Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-5">
            {/* Current Price */}
            <div
              className="p-3 sm:p-3.5 rounded-xl border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))' 
                  : 'linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.02))',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                boxShadow: `0 4px 16px ${accentColor.color}10`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div 
                  className="p-1 rounded-lg"
                  style={{ 
                    background: `${accentColor.color}20`,
                  }}
                >
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: accentColor.color }} />
                </div>
                <span className="text-[10px] sm:text-xs font-medium" style={{ color: accentColor.color }}>
                  Joriy narx
                </span>
              </div>
              <p className="text-lg sm:text-xl font-semibold mb-0.5 tracking-tight">
                {(auction.currentPrice / 1000).toFixed(3).replace('.', ',')}
              </p>
              <p className="text-[10px] sm:text-xs font-normal opacity-60">so'm</p>
            </div>

            {/* Time Remaining */}
            <div
              className="p-3 sm:p-3.5 rounded-xl border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))' 
                  : 'linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.02))',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                boxShadow: `0 4px 16px ${accentColor.color}10`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div 
                  className="p-1 rounded-lg"
                  style={{ 
                    background: `${accentColor.color}20`,
                  }}
                >
                  <Clock className="w-3.5 h-3.5 animate-pulse" style={{ color: accentColor.color }} />
                </div>
                <span className="text-[10px] sm:text-xs font-medium" style={{ color: accentColor.color }}>
                  Qolgan vaqt
                </span>
              </div>
              <p className="text-lg sm:text-xl font-semibold tracking-tight leading-tight">
                {getTimeRemaining(auction.endDate)}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-2">Ta'rif</h3>
            <p className="text-sm leading-relaxed opacity-80">
              {auction.description}
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center p-3 rounded-xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' }}>
              <Gavel className="w-5 h-5 mx-auto mb-1" style={{ color: accentColor.color }} />
              <p className="text-lg font-bold">{auction.totalBids}</p>
              <p className="text-xs opacity-60">Takliflar</p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' }}>
              <Users className="w-5 h-5 mx-auto mb-1" style={{ color: accentColor.color }} />
              <p className="text-lg font-bold">{auction.totalParticipants}</p>
              <p className="text-xs opacity-60">Ishtirokchilar</p>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)' }}>
              <DollarSign className="w-5 h-5 mx-auto mb-1" style={{ color: accentColor.color }} />
              <p className="text-lg font-bold">{auction.bidIncrementPercent}%</p>
              <p className="text-xs opacity-60">Oshish</p>
            </div>
          </div>

          {/* Bidding Section */}
          {user && auction.participants.includes(user.id) ? (
            <div className="space-y-4">
              {/* Info Alert */}
              <div
                className="p-4 rounded-2xl flex items-start gap-3"
                style={{
                  background: `${accentColor.color}15`,
                  borderWidth: '1px',
                  borderColor: `${accentColor.color}30`,
                }}
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: accentColor.color }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: accentColor.color }}>
                    Minimal oshirish: {(calculateMinimumBid(auction) - auction.currentPrice).toLocaleString()} so'm
                  </p>
                  <p className="text-xs mt-1 opacity-80">
                    Yangi taklifingiz kamida {calculateMinimumBid(auction).toLocaleString()} so'm bo'lishi kerak
                  </p>
                </div>
              </div>

              {/* Quick Bid Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[100000, 200000, 500000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBidAmount(String(auction.currentPrice + amount))}
                    className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      borderWidth: '1px',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    +{(amount / 1000).toFixed(0)} ming
                  </button>
                ))}
              </div>

              {/* Bid Input */}
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`Taklifingiz (min: ${calculateMinimumBid(auction).toLocaleString()})`}
                className="w-full px-4 py-4 rounded-xl border outline-none text-base font-medium"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#000000',
                }}
              />

              {/* Submit Bid Button */}
              <button
                onClick={handleSubmitBid}
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                  color: '#ffffff',
                  boxShadow: `0 8px 24px ${accentColor.color}40`,
                }}
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Yuklanmoqda...</span>
                  </>
                ) : (
                  <>
                    <Gavel className="w-5 h-5" />
                    <span>Taklif Berish</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {participateStep === 'cta' && (
                <>
                  <div
                    className="p-4 rounded-2xl flex items-start gap-3"
                    style={{
                      background: `${accentColor.color}15`,
                      borderWidth: '1px',
                      borderColor: `${accentColor.color}30`,
                    }}
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: accentColor.color }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: accentColor.color }}>
                        Ishtirok haqi: {participationFeeSoum.toLocaleString('uz-UZ')} so'm
                      </p>
                      <p className="text-xs mt-1 opacity-80">
                        Bu auksion uchun alohida — har bir auksion o‘z ishtirok narxiga ega. Takliflar
                        joyida to‘lanmaydi; yutganingizdan keyin alohida to‘laysiz (naqd, karta, Payme,
                        Click va hokazo).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!user || participateSubmitting}
                    onClick={() => setParticipateStep('terms')}
                    className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                      color: '#ffffff',
                      boxShadow: `0 8px 24px ${accentColor.color}40`,
                    }}
                  >
                    <Award className="w-5 h-5" />
                    <span>Ishtirok Etish</span>
                  </button>

                  {!user && (
                    <p className="text-xs text-center opacity-60">
                      Ishtirok etish uchun tizimga kiring
                    </p>
                  )}
                </>
              )}

              {participateStep === 'terms' && (
                <div className="space-y-4">
                  <div
                    className="p-4 rounded-2xl flex items-start gap-3"
                    style={{
                      background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                      borderWidth: '1px',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                    }}
                  >
                    <ShieldAlert className="w-6 h-6 flex-shrink-0 text-red-500 mt-0.5" />
                    <div className="space-y-2 text-sm" style={{ color: isDark ? '#fecaca' : '#7f1d1d' }}>
                      <p className="font-bold text-base" style={{ color: isDark ? '#fff' : '#991b1b' }}>
                        Muhim shartlar
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 opacity-95">
                        <li>
                          <strong>Ishtirok to‘lovi qaytarilmaydi</strong> — auksion tugamagan yoki
                          yutmagan bo‘lsangiz ham pul qaytarilmaydi.
                        </li>
                        <li>
                          To‘lov <strong>faqat shu auksion</strong> uchun — boshqa auksionlar uchun qayta
                          to‘laysiz.
                        </li>
                        <li>
                          Taklif qilgan summalaringiz hozir kartadan yechilmaydi;{' '}
                          <strong>yutganingizdan keyin</strong> kelishilgan usulda to‘laysiz.
                        </li>
                      </ul>
                      <p className="text-xs pt-1 opacity-90">
                        Ishtirok haqi:{' '}
                        <strong>{participationFeeSoum.toLocaleString('uz-UZ')} so'm</strong>
                        {needsOnlineParticipationPayment
                          ? ' — keyingi qadamda to‘lov usulini tanlaysiz (Payme, Click, karta, Atmos).'
                          : ' — bu summada onlayn to‘lov talab qilinmaydi.'}
                      </p>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-400"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    <span className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : '#374151' }}>
                      Men yuqoridagi shartlarni o‘qib chiqdim va roziman (ishtirok to‘lovi qaytarilmaydi).
                    </span>
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setParticipateStep('cta');
                        setTermsAccepted(false);
                      }}
                      className="flex-1 py-3.5 rounded-2xl font-semibold border transition-all active:scale-[0.98]"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                        color: isDark ? '#fff' : '#111',
                      }}
                    >
                      Orqaga
                    </button>
                    <button
                      type="button"
                      disabled={!termsAccepted || participateSubmitting}
                      onClick={() => {
                        if (!needsOnlineParticipationPayment) {
                          void onParticipate({});
                          return;
                        }
                        setParticipateStep('pay');
                      }}
                      className="flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                        color: '#fff',
                        boxShadow: `0 6px 20px ${accentColor.color}35`,
                      }}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Roziman
                    </button>
                  </div>
                </div>
              )}

              {participateStep === 'pay' && needsOnlineParticipationPayment && (
                <div className="space-y-4">
                  <p className="text-sm font-medium" style={{ color: isDark ? '#fff' : '#111' }}>
                    To‘lov usulini tanlang
                  </p>
                  <p className="text-xs opacity-70">
                    {participationFeeSoum.toLocaleString('uz-UZ')} so'm — shu auksion uchun bir martalik
                    ishtirok to‘lovi.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'payme' as const, label: 'Payme', sub: 'Payme ilova' },
                        { id: 'click' as const, label: 'Click', sub: 'Click / Uzcard' },
                        { id: 'card' as const, label: 'Bank kartasi', sub: 'Karta (checkout)' },
                        { id: 'atmos' as const, label: 'Atmos', sub: 'Atmos' },
                      ] as const
                    ).map((m) => {
                      const active = selectedPayMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedPayMethod(m.id)}
                          className="p-3 rounded-2xl border text-left transition-all active:scale-[0.98]"
                          style={{
                            borderColor: active ? accentColor.color : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                            background: active ? `${accentColor.color}18` : isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                            boxShadow: active ? `0 0 0 2px ${accentColor.color}55` : 'none',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <CreditCard className="w-4 h-4" style={{ color: accentColor.color }} />
                            <span className="font-bold text-sm">{m.label}</span>
                          </div>
                          <span className="text-[11px] opacity-65">{m.sub}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setParticipateStep('terms')}
                      className="flex-1 py-3.5 rounded-2xl font-semibold border"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                        color: isDark ? '#fff' : '#111',
                      }}
                    >
                      Orqaga
                    </button>
                    <button
                      type="button"
                      disabled={!selectedPayMethod || participateSubmitting}
                      onClick={() => {
                        if (selectedPayMethod) void onParticipate({ paymentMethod: selectedPayMethod });
                      }}
                      className="flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                        color: '#fff',
                        boxShadow: `0 6px 20px ${accentColor.color}35`,
                      }}
                    >
                      {participateSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>To‘lov…</span>
                        </>
                      ) : (
                        <>
                          <Award className="w-5 h-5" />
                          <span>To‘lovni boshlash</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}