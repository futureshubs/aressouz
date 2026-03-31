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
  X
} from 'lucide-react';

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
  onParticipate: () => Promise<void>;
  getTimeRemaining: (endDate: string) => string;
  calculateMinimumBid: (auction: Auction) => number;
}

export function AuctionDetailModal({
  auction,
  onClose,
  onPlaceBid,
  onParticipate,
  getTimeRemaining,
  calculateMinimumBid
}: AuctionDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

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
                    Ishtirok to'lovi: {(auction.participationFee / 1000).toFixed(3).replace('.', ',')} so'm
                  </p>
                  <p className="text-xs mt-1 opacity-80">
                    Taklif qilish uchun avval ishtirok to'lovini amalga oshiring
                  </p>
                </div>
              </div>

              {/* Participate Button */}
              <button
                onClick={onParticipate}
                className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}