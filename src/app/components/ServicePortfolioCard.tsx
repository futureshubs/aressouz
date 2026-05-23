import React from 'react';
import { MapPin, Eye, MessageSquare, Briefcase } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ServicePortfolio {
  id: string;
  branchId?: string;
  userId?: string;
  userName?: string;
  title?: string;
  description?: string;
  profession?: string;
  category?: string;
  price?: number | null;
  priceAmount?: number;
  priceType?: string;
  images?: string[];
  videos?: string[];
  media?: Array<{ url: string; type?: string }>;
  phone?: string;
  userPhone?: string;
  whatsapp?: string;
  telegram?: string;
  region: string;
  district: string;
  address?: string;
  status?: 'active' | 'inactive';
  views?: number;
  createdAt?: string;
  updatedAt?: string;
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

const PRICE_UNIT_LABELS: Record<string, string> = {
  soat: 'soat',
  kun: 'kun',
  oy: 'oy',
  ish: 'ish',
  kv: 'm²',
  m2: 'm',
};

function resolvePortfolioName(portfolio: ServicePortfolio): string {
  const name = String(portfolio.userName || portfolio.title || '').trim();
  return name || 'Usta';
}

function resolveWorkStyle(portfolio: ServicePortfolio, categoryName: string): string {
  const profession = String(portfolio.profession || '').trim();
  if (profession) return profession;
  if (categoryName && categoryName !== portfolio.category) return categoryName;
  return String(portfolio.category || '').trim() || 'Xizmat';
}

function resolveFirstImage(portfolio: ServicePortfolio): string | null {
  if (portfolio.images?.length) return portfolio.images[0] || null;
  const mediaUrl = portfolio.media?.find((m) => m?.url)?.url;
  return mediaUrl || null;
}

// Category names
const CATEGORY_NAMES: Record<string, string> = {
  web: 'Web Dasturlash',
  mobile: 'Mobile Dasturlash',
  design: 'Dizayn',
  photo: 'Foto/Video',
  marketing: 'Marketing',
  education: "Ta'lim",
  repair: "Ta'mirlash",
  construction: 'Qurilish',
  beauty: "Go'zallik",
  health: "Sog'liqni saqlash",
  transport: 'Transport',
  cleaning: 'Tozalash',
  other: 'Boshqa',
};

export const ServicePortfolioCard = React.memo(function ServicePortfolioCard({
  portfolio,
  onClick,
}: ServicePortfolioCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const categoryKey = String(portfolio.category || '').trim();
  const categoryName = CATEGORY_NAMES[categoryKey] || categoryKey || resolveWorkStyle(portfolio, '');
  const categoryEmoji = CATEGORY_EMOJIS[categoryKey] || '👷';
  const displayName = resolvePortfolioName(portfolio);
  const workStyle = resolveWorkStyle(portfolio, categoryName);
  const firstImage = resolveFirstImage(portfolio);
  const mediaCount =
    (portfolio.images?.length || 0) +
    (portfolio.videos?.length || 0) +
    (portfolio.media?.length || 0);

  const getPriceText = () => {
    const amount = Number(portfolio.priceAmount ?? portfolio.price ?? 0);
    const priceType = String(portfolio.priceType || '').trim();

    if (PRICE_UNIT_LABELS[priceType]) {
      if (amount > 0) {
        return `${amount.toLocaleString('uz-UZ')} so'm/${PRICE_UNIT_LABELS[priceType]}`;
      }
      return 'Narx kelishiladi';
    }

    if (!amount) {
      return priceType === 'contact' ? "Bog'lanish" : 'Narx kelishiladi';
    }
    const basePrice = `${amount.toLocaleString('uz-UZ')} so'm`;
    if (priceType === 'negotiable') {
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
            alt={displayName}
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
          <span className="truncate max-w-[8rem] sm:max-w-[10rem]">{workStyle}</span>
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
        {(mediaCount > 1) && (
          <div
            className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-lg text-xs font-bold backdrop-blur-xl"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#ffffff',
            }}
          >
            📸 {mediaCount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        <h3
          className="text-sm sm:text-base font-bold mb-1 line-clamp-1"
          style={{ color: isDark ? '#ffffff' : '#111827' }}
        >
          {displayName}
        </h3>

        <div
          className="flex items-center gap-1.5 text-xs sm:text-sm mb-2 min-w-0"
          style={{ color: accentColor.color }}
        >
          <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate font-semibold">{workStyle}</span>
        </div>

        {portfolio.description && (
          <p
            className="text-xs sm:text-sm mb-2 line-clamp-2"
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
          className="text-sm sm:text-base font-bold mb-3"
          style={{ color: accentColor.color }}
        >
          {getPriceText()}
        </div>

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