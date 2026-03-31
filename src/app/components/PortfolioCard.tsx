import React from 'react';
import { MapPin, Star, Clock, MessageSquare, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Portfolio {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  profession: string;
  region: string;
  district: string;
  skills: string[];
  description: string;
  experience: number;
  priceAmount: number;
  priceType: string; // soat, kun, oy, ish, kv, m2
  media: Array<{ url: string; type: 'image' | 'video' }>;
  rating?: number;
  reviewsCount?: number;
  createdAt: string;
  minRate?: number;
  maxRate?: number;
  verified?: boolean;
}

interface PortfolioCardProps {
  portfolio: Portfolio;
  onClick: () => void;
}

export const PortfolioCard = React.memo(function PortfolioCard({ portfolio, onClick }: PortfolioCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  // Calculate price with safe fallbacks
  const priceAmount = portfolio.priceAmount || 0;
  const priceType = portfolio.priceType || 'soat';
  
  // Map price type to display text
  const priceTypeText = {
    'soat': 'soat',
    'kun': 'kun',
    'oy': 'oy',
    'ish': 'ish',
    'kv': 'm²',
    'm2': 'm'
  }[priceType] || 'soat';

  return (
    <div
      onClick={onClick}
      className="rounded-2xl sm:rounded-3xl overflow-hidden group cursor-pointer transition-transform active:scale-98"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))'
          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
        boxShadow: isDark
          ? '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
          : '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}`,
      }}
    >
      {/* Image/Video Preview */}
      <div className="relative aspect-square overflow-hidden">
        {portfolio.media.length > 0 ? (
          portfolio.media[0].type === 'image' ? (
            <img
              src={portfolio.media[0].url}
              alt={portfolio.profession}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={portfolio.media[0].url}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
            />
          )
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              backgroundImage: accentColor.gradient,
            }}
          >
            <span className="text-5xl">👷</span>
          </div>
        )}

        {/* Rating Badge */}
        <div
          className="absolute top-2 sm:top-3 left-2 sm:left-3 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold backdrop-blur-xl"
          style={{
            background: isDark
              ? 'rgba(0, 0, 0, 0.85)'
              : 'rgba(0, 0, 0, 0.75)',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-yellow-400 text-yellow-400" />
          <span>{(portfolio.rating || 5.0).toFixed(1)}</span>
        </div>

        {/* Verified Badge */}
        {portfolio.verified !== false && (
          <div
            className="absolute top-2 sm:top-3 right-2 sm:right-3 p-1.5 sm:p-2 rounded-lg sm:rounded-full backdrop-blur-xl"
            style={{
              backgroundColor: accentColor.color,
              boxShadow: `0 4px 12px ${accentColor.color}66`,
            }}
          >
            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 md:p-5">
        {/* Name */}
        <h3
          className="text-sm sm:text-base md:text-lg font-bold mb-0.5 sm:mb-1 truncate"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {portfolio.userName}
        </h3>

        {/* Profession */}
        <p
          className="font-bold mb-2 sm:mb-3 text-xs sm:text-sm md:text-base truncate"
          style={{ color: accentColor.color }}
        >
          {portfolio.profession}
        </p>

        {/* Experience */}
        <div
          className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm mb-1.5 sm:mb-2"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
        >
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" strokeWidth={2.5} />
          <span className="font-medium truncate">{portfolio.experience} yil tajriba</span>
        </div>

        {/* Location */}
        <div
          className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm mb-2 sm:mb-3"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
        >
          <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" strokeWidth={2.5} />
          <span className="truncate font-medium">{portfolio.region}, {portfolio.district}</span>
        </div>

        {/* Price Range */}
        <div
          className="text-sm sm:text-base md:text-lg font-bold mb-1.5 sm:mb-2 truncate"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {priceAmount.toLocaleString()} so'm/{priceTypeText}
        </div>

        {/* Reviews Count */}
        <div
          className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
        >
          <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" strokeWidth={2.5} />
          <span className="font-medium">{portfolio.reviewsCount || 0} ta sharh</span>
        </div>

        {/* Contact Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="w-full py-2.5 sm:py-3 md:py-3.5 rounded-xl sm:rounded-2xl font-bold text-white transition-all active:scale-95 text-sm sm:text-base"
          style={{
            backgroundColor: accentColor.color,
            boxShadow: `0 4px 16px ${accentColor.color}66, 0 6px 20px ${accentColor.color}4d`,
          }}
        >
          Bog'lanish
        </button>
      </div>
    </div>
  );
});