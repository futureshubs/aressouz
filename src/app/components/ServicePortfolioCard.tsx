import React from 'react';
import { MapPin, Eye, Phone, MessageSquare } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ServicePortfolio {
  id: string;
  branchId: string;
  title: string;
  description: string;
  category: string;
  price: number | null;
  priceType: 'fixed' | 'negotiable' | 'contact';
  images: string[];
  videos: string[];
  phone: string;
  whatsapp: string;
  telegram: string;
  region: string;
  district: string;
  address: string;
  status: 'active' | 'inactive';
  views: number;
  createdAt: string;
  updatedAt: string;
}

interface ServicePortfolioCardProps {
  portfolio: ServicePortfolio;
  onClick: () => void;
}

// Category to emoji mapping
const CATEGORY_EMOJIS: Record<string, string> = {
  'web': '💻',
  'mobile': '📱',
  'design': '🎨',
  'photo': '📸',
  'marketing': '📊',
  'education': '📚',
  'repair': '🔧',
  'construction': '🏗️',
  'beauty': '💄',
  'health': '⚕️',
  'transport': '🚗',
  'cleaning': '🧹',
  'other': '📦',
};

// Category names
const CATEGORY_NAMES: Record<string, string> = {
  'web': 'Web Dasturlash',
  'mobile': 'Mobile Dasturlash',
  'design': 'Dizayn',
  'photo': 'Foto/Video',
  'marketing': 'Marketing',
  'education': 'Ta\'lim',
  'repair': 'Ta\'mirlash',
  'construction': 'Qurilish',
  'beauty': 'Go\'zallik',
  'health': 'Sog\'liqni saqlash',
  'transport': 'Transport',
  'cleaning': 'Tozalash',
  'other': 'Boshqa',
};

export const ServicePortfolioCard = React.memo(function ServicePortfolioCard({ 
  portfolio, 
  onClick 
}: ServicePortfolioCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const categoryName = CATEGORY_NAMES[portfolio.category] || portfolio.category;
  const categoryEmoji = CATEGORY_EMOJIS[portfolio.category] || '📦';
  const firstImage = portfolio.images && portfolio.images.length > 0 ? portfolio.images[0] : null;

  // Price display
  const getPriceText = () => {
    if (!portfolio.price) {
      return portfolio.priceType === 'contact' ? 'Bog\'lanish' : 'Narx kelishiladi';
    }
    const basePrice = `${portfolio.price.toLocaleString()} so'm`;
    if (portfolio.priceType === 'negotiable') {
      return `${basePrice} (kelishiladi)`;
    }
    return basePrice;
  };

  return (
    <div
      onClick={onClick}
      className="rounded-2xl sm:rounded-3xl overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
        boxShadow: isDark
          ? '0 8px 32px rgba(0, 0, 0, 0.5)'
          : '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
      }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {firstImage ? (
          <img
            src={firstImage}
            alt={portfolio.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `${accentColor.color}20`,
            }}
          >
            <span className="text-5xl sm:text-6xl">{categoryEmoji}</span>
          </div>
        )}

        {/* Category Badge */}
        <div
          className="absolute top-2 left-2 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold backdrop-blur-xl"
          style={{
            background: `${accentColor.color}dd`,
            color: '#ffffff',
          }}
        >
          <span>{categoryEmoji}</span>
          <span>{categoryName}</span>
        </div>

        {/* Views Counter */}
        <div
          className="absolute top-2 right-2 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-medium backdrop-blur-xl"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
            color: isDark ? '#ffffff' : '#111827',
          }}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{portfolio.views || 0}</span>
        </div>

        {/* Media Count */}
        {(portfolio.images && portfolio.images.length > 1 || portfolio.videos && portfolio.videos.length > 0) && (
          <div
            className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-lg text-xs font-bold backdrop-blur-xl"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#ffffff',
            }}
          >
            📸 {(portfolio.images?.length || 0) + (portfolio.videos?.length || 0)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        {/* Title */}
        <h3
          className="text-sm sm:text-base font-bold mb-2 line-clamp-2"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {portfolio.title}
        </h3>

        {/* Description */}
        {portfolio.description && (
          <p
            className="text-xs sm:text-sm mb-3 line-clamp-2"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
          >
            {portfolio.description}
          </p>
        )}

        {/* Location */}
        <div
          className="flex items-center gap-1.5 text-xs sm:text-sm mb-2"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
        >
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate font-medium">
            {portfolio.district}, {portfolio.region}
          </span>
        </div>

        {/* Price */}
        <div
          className="text-base sm:text-lg font-bold mb-3"
          style={{ color: accentColor.color }}
        >
          {getPriceText()}
        </div>

        {/* Contact Info */}
        {portfolio.phone && (
          <div
            className="flex items-center gap-1.5 text-xs mb-3"
            style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="font-medium">{portfolio.phone}</span>
          </div>
        )}

        {/* Contact Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="w-full py-2.5 sm:py-3 rounded-xl font-bold text-white transition-all active:scale-95 text-sm"
          style={{
            background: accentColor.gradient,
            boxShadow: `0 4px 16px ${accentColor.color}66`,
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span>Bog'lanish</span>
          </div>
        </button>
      </div>
    </div>
  );
});