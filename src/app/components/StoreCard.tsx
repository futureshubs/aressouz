import { MapPin, Star, Clock, Phone, ArrowRight, CheckCircle } from 'lucide-react';
import { memo } from 'react';
import { Store } from '../data/stores';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface StoreCardProps {
  store: Store;
  onStoreClick: (store: Store) => void;
  platform: Platform;
}

export const StoreCard = memo(function StoreCard({ store, onStoreClick, platform }: StoreCardProps) {
  const { theme, accentColor } = useTheme();
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  if (isIOS) {
    // iOS Style - Horizontal Premium Card
    return (
      <div
        onClick={() => onStoreClick(store)}
        className="group cursor-pointer"
      >
        <div
          className="relative overflow-hidden transition-all duration-300"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.7), rgba(20, 20, 20, 0.9))'
              : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
            backdropFilter: 'blur(30px)',
            border: isDark 
              ? '0.5px solid rgba(255, 255, 255, 0.12)' 
              : '0.5px solid rgba(0, 0, 0, 0.1)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
            borderRadius: '24px',
            transform: 'translateY(0) scale(1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.01)';
            e.currentTarget.style.boxShadow = isDark
              ? `0 12px 48px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.08)`
              : `0 12px 48px ${accentColor.color}30, inset 0 1px 0 rgba(255, 255, 255, 1)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
          }}
        >
          {/* Horizontal Layout */}
          <div className="flex items-center gap-4 p-5">
            {/* Left: Store Logo with Background Image */}
            <div className="relative flex-shrink-0">
              <div 
                className="w-24 h-24 rounded-2xl overflow-hidden relative"
                style={{
                  border: `2px solid ${accentColor.color}33`,
                  boxShadow: `0 8px 24px ${accentColor.color}26, inset 0 2px 8px rgba(0, 0, 0, 0.1)`,
                }}
              >
                {/* Background Image */}
                <img 
                  src={store.image} 
                  alt={store.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay */}
                <div 
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))',
                  }}
                />
                
                {/* Logo Badge */}
                <div 
                  className="absolute bottom-2 right-2 w-10 h-10 rounded-xl overflow-hidden"
                  style={{
                    border: '2px solid rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <img 
                    src={store.logo} 
                    alt={store.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Status Badge */}
                <div 
                  className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1"
                  style={{
                    background: store.isOpen 
                      ? 'rgba(34, 197, 94, 0.95)'
                      : 'rgba(239, 68, 68, 0.95)',
                    backdropFilter: 'blur(10px)',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {store.isOpen && <CheckCircle className="size-3" strokeWidth={3} />}
                  {store.isOpen ? 'OCHIQ' : 'YOPIQ'}
                </div>
              </div>
            </div>

            {/* Right: Store Info */}
            <div className="flex-1 min-w-0">
              {/* Store Name & Arrow */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 
                  className="font-bold text-base leading-tight"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {store.name}
                </h3>
                <div 
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                  style={{
                    backgroundImage: accentColor.gradient,
                    boxShadow: `0 4px 12px ${accentColor.color}66`,
                  }}
                >
                  <ArrowRight className="size-4 text-white" strokeWidth={2.5} />
                </div>
              </div>

              {/* Category Badge */}
              <div className="mb-2">
                <span
                  className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: `${accentColor.color}1a`,
                    color: accentColor.color,
                    border: `1px solid ${accentColor.color}33`,
                  }}
                >
                  {store.category}
                </span>
              </div>

              {/* Rating & Reviews */}
              <div className="flex items-center gap-3 mb-2.5">
                <div className="flex items-center gap-1">
                  <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                  <span 
                    className="text-sm font-bold"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {store.rating}
                  </span>
                  <span 
                    className="text-[10px]"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                  >
                    ({store.reviews})
                  </span>
                </div>

                <div 
                  className="w-px h-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  }}
                />

                <div className="flex items-center gap-1">
                  <Clock className="size-3.5" style={{ color: accentColor.color }} />
                  <span 
                    className="text-xs font-medium"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                  >
                    {store.deliveryTime}
                  </span>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-1.5 mb-2">
                <MapPin 
                  className="size-3.5 mt-0.5 flex-shrink-0" 
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} 
                />
                <p 
                  className="text-xs leading-snug line-clamp-1"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  {store.address}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {store.tags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                    style={{
                      background: isDark 
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                      color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android Style - Horizontal Modern Card
  return (
    <div
      onClick={() => onStoreClick(store)}
      className="group cursor-pointer"
    >
      <div
        className="relative overflow-hidden transition-all duration-200"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #1e1e1e, #141414)'
            : 'linear-gradient(135deg, #ffffff, #fafafa)',
          border: isDark 
            ? '1px solid rgba(255, 255, 255, 0.08)' 
            : '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: isDark
            ? '0 4px 16px rgba(0, 0, 0, 0.4)'
            : '0 4px 16px rgba(0, 0, 0, 0.08)',
          borderRadius: '16px',
        }}
      >
        {/* Horizontal Layout */}
        <div className="flex items-center gap-4 p-4">
          {/* Left: Store Visual */}
          <div className="relative flex-shrink-0">
            <div 
              className="w-28 h-28 rounded-2xl overflow-hidden relative"
              style={{
                border: `2px solid ${accentColor.color}4d`,
                boxShadow: `0 8px 24px ${accentColor.color}33`,
              }}
            >
              {/* Background Image */}
              <img 
                src={store.image} 
                alt={store.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              
              {/* Overlay */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.5))',
                }}
              />
              
              {/* Logo Badge */}
              <div 
                className="absolute bottom-2 right-2 w-11 h-11 rounded-lg overflow-hidden"
                style={{
                  border: '2.5px solid rgba(255, 255, 255, 1)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
                }}
              >
                <img 
                  src={store.logo} 
                  alt={store.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Status Badge */}
              <div 
                className="absolute top-2 left-2 px-2 py-1 rounded-md text-[9px] font-black flex items-center gap-1 uppercase tracking-wider"
                style={{
                  background: store.isOpen 
                    ? '#22c55e'
                    : '#ef4444',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                }}
              >
                {store.isOpen && <CheckCircle className="size-3" strokeWidth={3} />}
                {store.isOpen ? 'OCHIQ' : 'YOPIQ'}
              </div>
            </div>
          </div>

          {/* Right: Store Info */}
          <div className="flex-1 min-w-0">
            {/* Store Name */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 
                className="font-black text-base leading-tight tracking-tight"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {store.name}
              </h3>
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{
                  background: `${accentColor.color}26`,
                  border: `2px solid ${accentColor.color}66`,
                }}
              >
                <ArrowRight className="size-4" style={{ color: accentColor.color }} strokeWidth={3} />
              </div>
            </div>

            {/* Category Badge */}
            <div className="mb-2">
              <span
                className="inline-flex px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider"
                style={{
                  background: `${accentColor.color}33`,
                  color: accentColor.color,
                  border: `1px solid ${accentColor.color}66`,
                }}
              >
                {store.category}
              </span>
            </div>

            {/* Rating & Delivery */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-1">
                <Star className="size-4 fill-yellow-500 text-yellow-500" />
                <span 
                  className="text-sm font-black"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {store.rating}
                </span>
                <span 
                  className="text-[10px] font-bold"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  ({store.reviews})
                </span>
              </div>

              <div 
                className="w-px h-4"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                }}
              />

              <div className="flex items-center gap-1">
                <Clock className="size-4" style={{ color: accentColor.color }} />
                <span 
                  className="text-xs font-bold"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}
                >
                  {store.deliveryTime}
                </span>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-1.5 mb-2">
              <MapPin 
                className="size-4 mt-0.5 flex-shrink-0" 
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} 
              />
              <p 
                className="text-xs font-medium leading-snug line-clamp-1"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                {store.address}
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {store.tags.slice(0, 2).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
                  style={{
                    background: isDark 
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.06)',
                    color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
