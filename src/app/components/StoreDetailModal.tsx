import { X, Star, MapPin, Phone, Clock, Truck, Package, ChevronLeft, Plus } from 'lucide-react';
import { memo } from 'react';
import { Store } from '../data/stores';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface StoreDetailModalProps {
  store: Store;
  onClose: () => void;
  platform: Platform;
}

export const StoreDetailModal = memo(function StoreDetailModal({ store, onClose, platform }: StoreDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50 overflow-hidden"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
      }}
    >
      {/* Header with Image */}
      <div className="relative h-64 overflow-hidden">
        <img 
          src={store.image} 
          alt={store.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

        {/* Back Button */}
        <button
          onClick={onClose}
          className="absolute top-6 left-4 z-10 p-2.5 rounded-2xl transition-all active:scale-90"
          style={{
            background: isIOS
              ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
              : 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
            border: isIOS ? '0.5px solid rgba(255, 255, 255, 0.2)' : 'none',
          }}
        >
          {isIOS ? (
            <ChevronLeft className="size-5 text-white" strokeWidth={2.5} />
          ) : (
            <X className="size-5 text-white" strokeWidth={2.5} />
          )}
        </button>

        {/* Store Logo & Name */}
        <div className="absolute bottom-6 left-4 right-4 flex items-end gap-4">
          <div 
            className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0"
            style={{
              border: '3px solid rgba(255, 255, 255, 0.95)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            }}
          >
            <img 
              src={store.logo} 
              alt={store.name}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex-1 pb-2">
            <h1 
              className="text-2xl font-bold text-white mb-1"
              style={{
                textShadow: '0 2px 12px rgba(0, 0, 0, 0.5)',
              }}
            >
              {store.name}
            </h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-bold text-white">
                  {store.rating}
                </span>
                <span className="text-xs text-white/80">
                  ({store.reviews} sharh)
                </span>
              </div>
              <div 
                className="px-2 py-0.5 rounded-md text-xs font-bold"
                style={{
                  background: store.isOpen 
                    ? 'rgba(34, 197, 94, 0.9)'
                    : 'rgba(239, 68, 68, 0.9)',
                  color: '#ffffff',
                }}
              >
                {store.isOpen ? 'Ochiq' : 'Yopiq'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto" style={{ height: 'calc(100vh - 256px)' }}>
        <div className="px-4 py-6 space-y-6">
          {/* Description */}
          <div>
            <p 
              className="text-sm leading-relaxed"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
            >
              {store.description}
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Delivery Time */}
            <div 
              className="p-4 rounded-xl"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
                  : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                backdropFilter: isIOS ? 'blur(20px)' : undefined,
                border: isDark 
                  ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)')
                  : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'),
                boxShadow: isDark
                  ? 'none'
                  : (isIOS ? '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 2px 8px rgba(0, 0, 0, 0.04)'),
              }}
            >
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                style={{
                  background: `${accentColor.color}1a`,
                  border: `1px solid ${accentColor.color}33`,
                }}
              >
                <Truck className="size-5" style={{ color: accentColor.color }} />
              </div>
              <p 
                className="text-xs mb-1"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Yetkazib berish
              </p>
              <p 
                className="text-sm font-bold"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {store.deliveryTime}
              </p>
            </div>

            {/* Min Order */}
            <div 
              className="p-4 rounded-xl"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
                  : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                backdropFilter: isIOS ? 'blur(20px)' : undefined,
                border: isDark 
                  ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)')
                  : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'),
                boxShadow: isDark
                  ? 'none'
                  : (isIOS ? '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 2px 8px rgba(0, 0, 0, 0.04)'),
              }}
            >
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                style={{
                  background: `${accentColor.color}1a`,
                  border: `1px solid ${accentColor.color}33`,
                }}
              >
                <Package className="size-5" style={{ color: accentColor.color }} />
              </div>
              <p 
                className="text-xs mb-1"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                Min buyurtma
              </p>
              <p 
                className="text-sm font-bold"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {store.minOrder.toLocaleString('uz-UZ')} so'm
              </p>
            </div>
          </div>

          {/* Contact Info */}
          <div 
            className="p-4 rounded-xl space-y-3"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
                : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
              backdropFilter: isIOS ? 'blur(20px)' : undefined,
              border: isDark 
                ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)')
                : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'),
              boxShadow: isDark
                ? 'none'
                : (isIOS ? '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 2px 8px rgba(0, 0, 0, 0.04)'),
            }}
          >
            <h3 
              className="font-bold mb-3"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Aloqa ma'lumotlari
            </h3>

            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${accentColor.color}1a`,
                }}
              >
                <MapPin className="size-5" style={{ color: accentColor.color }} />
              </div>
              <div className="flex-1">
                <p 
                  className="text-xs mb-0.5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Manzil
                </p>
                <p 
                  className="text-sm font-medium"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {store.address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${accentColor.color}1a`,
                }}
              >
                <Phone className="size-5" style={{ color: accentColor.color }} />
              </div>
              <div className="flex-1">
                <p 
                  className="text-xs mb-0.5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Telefon
                </p>
                <p 
                  className="text-sm font-medium"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {store.phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${accentColor.color}1a`,
                }}
              >
                <Clock className="size-5" style={{ color: accentColor.color }} />
              </div>
              <div className="flex-1">
                <p 
                  className="text-xs mb-0.5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Ish vaqti
                </p>
                <p 
                  className="text-sm font-medium"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {store.workingHours}
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 
              className="font-bold mb-3"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Xizmatlar
            </h3>
            <div className="flex flex-wrap gap-2">
              {store.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: isDark 
                      ? `${accentColor.color}1a`
                      : `${accentColor.color}15`,
                    color: accentColor.color,
                    border: `1px solid ${accentColor.color}33`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 
              className="font-bold mb-4"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Mahsulotlar ({store.products.length})
            </h3>
            <div className="space-y-3">
              {store.products.map((product) => (
                <div 
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: isDark 
                      ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.4), rgba(20, 20, 20, 0.6))'
                      : 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(250, 250, 250, 0.9))',
                    border: isDark 
                      ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.03)')
                      : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)'),
                  }}
                >
                  <div 
                    className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
                    style={{
                      border: isDark 
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 
                      className="font-semibold text-sm mb-0.5 truncate"
                      style={{ color: isDark ? '#ffffff' : '#111827' }}
                    >
                      {product.name}
                    </h4>
                    <p 
                      className="text-xs mb-1 truncate"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      {product.description}
                    </p>
                    <p 
                      className="text-sm font-bold"
                      style={{ color: accentColor.color }}
                    >
                      {product.price.toLocaleString('uz-UZ')} so'm
                    </p>
                  </div>

                  <button
                    disabled={!product.inStock}
                    className="p-2 rounded-lg flex-shrink-0 transition-all active:scale-90"
                    style={{
                      backgroundImage: product.inStock ? accentColor.gradient : 'none',
                      backgroundColor: product.inStock ? undefined : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                      opacity: product.inStock ? 1 : 0.5,
                      boxShadow: product.inStock ? `0 4px 12px ${accentColor.color}66` : 'none',
                    }}
                  >
                    <Plus className="size-5 text-white" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Padding */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
});
