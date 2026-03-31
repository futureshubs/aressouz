import { Minus, Plus, Trash2, Calendar } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { RentalCartItem } from '../context/RentalCartContext';

interface RentalCartSectionProps {
  items: RentalCartItem[];
  onRemove: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, newDuration: number) => void;
}

export function RentalCartSection({ items, onRemove, onUpdateQuantity }: RentalCartSectionProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  
  const getPeriodLabel = (period: string) => {
    switch(period) {
      case 'hourly': return 'soat';
      case 'daily': return 'kun';
      case 'weekly': return 'hafta';
      case 'monthly': return 'oy';
      default: return period;
    }
  };
  
  if (items.length === 0) return null;
  
  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div 
        className="flex items-center gap-2 px-3 py-2 rounded-xl border"
        style={{
          background: `${accentColor.color}10`,
          borderColor: `${accentColor.color}30`,
        }}
      >
        <Calendar className="size-4" style={{ color: accentColor.color }} />
        <span className="text-sm font-bold" style={{ color: accentColor.color }}>
          🏠 Ijara mahsulotlari ({items.length})
        </span>
      </div>
      
      {/* Rental Items */}
      {items.map((cartItem) => (
        <div
          key={cartItem.item.id}
          className="relative flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all hover:shadow-lg"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: `${accentColor.color}40`,
          }}
        >
          {/* Image */}
          <div 
            className="size-20 sm:size-24 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 shadow-md"
            style={{
              background: isDark ? '#27272a' : '#f4f4f5',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
            }}
          >
            <img
              src={cartItem.item.image}
              alt={cartItem.item.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Product Name */}
            <h3 
              className="text-sm sm:text-base font-semibold line-clamp-2 mb-1"
              style={{ color: textPrimary }}
            >
              {cartItem.item.name}
            </h3>
            
            {/* Rental Period Badge */}
            <div className="mb-2">
              <span 
                className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1 font-semibold"
                style={{ 
                  background: `${accentColor.color}20`,
                  color: accentColor.color,
                  border: `1px solid ${accentColor.color}40`,
                }}
              >
                <Calendar className="size-3" />
                {cartItem.rentalDuration} {getPeriodLabel(cartItem.rentalPeriod)}
              </span>
            </div>
            
            {/* Price Info */}
            <div className="flex flex-col gap-1 mb-3">
              <div className="flex items-baseline gap-2">
                <p className="text-[10px]" style={{ color: textSecondary }}>
                  {getPeriodLabel(cartItem.rentalPeriod)} narxi:
                </p>
                <p 
                  className="text-sm font-bold"
                  style={{ color: textPrimary }}
                >
                  {cartItem.pricePerPeriod.toLocaleString('uz-UZ')} so'm
                </p>
              </div>
            </div>

            {/* Bottom Row: Duration Controls + Total */}
            <div className="flex items-center justify-between gap-3 mt-auto">
              {/* Duration Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (cartItem.rentalDuration === 1) {
                      onRemove(cartItem.item.id);
                    } else {
                      onUpdateQuantity(cartItem.item.id, cartItem.rentalDuration - 1);
                    }
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all active:scale-90"
                  style={{
                    background: isDark ? '#1a1a1a' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: textPrimary,
                  }}
                >
                  <Minus className="size-3.5 sm:size-4" strokeWidth={2.5} />
                </button>
                
                <span 
                  className="text-sm sm:text-base font-bold min-w-[2rem] text-center px-2"
                  style={{ color: textPrimary }}
                >
                  {cartItem.rentalDuration}
                </span>
                
                <button
                  onClick={() => onUpdateQuantity(cartItem.item.id, cartItem.rentalDuration + 1)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all active:scale-90"
                  style={{
                    background: accentColor.color,
                    boxShadow: `0 4px 12px ${accentColor.color}30`,
                  }}
                >
                  <Plus className="size-3.5 sm:size-4 text-white" strokeWidth={2.5} />
                </button>
              </div>

              {/* Total Price */}
              <div className="text-right">
                <p 
                  className="text-xs"
                  style={{ color: textSecondary }}
                >
                  Jami:
                </p>
                <p 
                  className="text-base sm:text-lg font-bold"
                  style={{ color: accentColor.color }}
                >
                  {cartItem.totalPrice.toLocaleString('uz-UZ')}
                </p>
              </div>
            </div>
          </div>

          {/* Delete Button - Top Right */}
          <button
            onClick={() => onRemove(cartItem.item.id)}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <Trash2 className="size-3.5 sm:size-4 text-red-500" strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
