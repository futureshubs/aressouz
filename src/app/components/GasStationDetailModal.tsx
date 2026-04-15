import { memo } from 'react';
import { X, Star, MapPin, Phone, Clock, Fuel, Check } from 'lucide-react';
import { GasStation } from '../data/gasStations';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { openExternalUrlSync } from '../utils/openExternalUrl';

interface GasStationDetailModalProps {
  station: GasStation;
  platform: Platform;
  isOpen: boolean;
  onClose: () => void;
}

export const GasStationDetailModal = memo(function GasStationDetailModal({ 
  station, 
  platform, 
  isOpen, 
  onClose 
}: GasStationDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  if (!isOpen) return null;

  const handleCall = () => {
    window.location.href = `tel:${station.phone}`;
  };

  const handleOpenMap = () => {
    const [lat, lng] = station.coordinates;
    openExternalUrlSync(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`);
  };

  if (isIOS) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 app-safe-pad backdrop-blur-xl z-50 transition-all duration-300"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)',
          }}
          onClick={onClose}
        />

        {/* Modal */}
        <div className="fixed inset-x-0 bottom-0 top-20 z-50 overflow-hidden">
          <div 
            className="h-full mx-auto max-w-2xl relative overflow-y-auto"
            style={{
              background: isDark ? '#0a0a0a' : '#f5f5f5',
              animation: 'slideUp 0.4s cubic-bezier(0.36, 0, 0.66, -0.56) reverse',
            }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full transition-all active:scale-90"
              style={{
                background: isDark ? 'rgba(26, 26, 26, 0.9)' : 'rgba(240, 240, 240, 0.9)',
                backdropFilter: 'blur(10px)',
                boxShadow: isDark
                  ? '4px 4px 8px #000000, -4px -4px 8px #141414'
                  : '4px 4px 8px #d1d1d1, -4px -4px 8px #ffffff',
              }}
            >
              <X className="size-5" style={{ color: accentColor.color }} strokeWidth={3} />
            </button>

            {/* Image */}
            <div className="relative h-80 sm:h-96">
              <img
                src={station.image}
                alt={station.name}
                className="w-full h-full object-cover"
              />
              
              {/* Gradient Overlay */}
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.7))',
                }}
              />

              {/* Status & Brand Badges */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <div 
                  className="px-4 py-2 rounded-full backdrop-blur-md"
                  style={{
                    background: 'rgba(0, 0, 0, 0.6)',
                  }}
                >
                  <span className="text-sm font-black text-white">{station.brand}</span>
                </div>

                <div 
                  className="px-4 py-2 rounded-full backdrop-blur-md"
                  style={{
                    background: station.isOpen ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                  }}
                >
                  <span className="text-sm font-black text-white">
                    {station.isOpen ? '● OCHIQ' : '● YOPIQ'}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Header */}
              <div>
                <h2 
                  className="text-2xl sm:text-3xl font-black mb-3"
                  style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
                >
                  {station.name}
                </h2>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Star className="size-4 fill-yellow-400 text-yellow-400" strokeWidth={2.5} />
                    <span 
                      className="text-sm font-bold"
                      style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
                    >
                      {station.rating}
                    </span>
                    <span 
                      className="text-sm"
                      style={{ color: isDark ? '#888888' : '#666666' }}
                    >
                      ({station.reviews} ta sharh)
                    </span>
                  </div>
                </div>
              </div>

              {/* Fuel Types & Prices */}
              <div>
                <h3 
                  className="text-sm font-bold uppercase mb-3 flex items-center gap-2"
                  style={{ color: isDark ? '#888888' : '#999999' }}
                >
                  <Fuel className="size-4" style={{ color: accentColor.color }} strokeWidth={2.5} />
                  Yoqilg'i turlari va narxlar
                </h3>
                <div className="space-y-2">
                  {station.fuelTypes.map((fuel, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-xl"
                      style={{
                        background: fuel.available 
                          ? (isDark ? '#1a1a1a' : '#f0f0f0')
                          : (isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)'),
                        boxShadow: fuel.available
                          ? (isDark
                            ? '4px 4px 8px #0d0d0d, -4px -4px 8px #272727'
                            : '4px 4px 8px #d1d1d1, -4px -4px 8px #ffffff')
                          : 'none',
                        opacity: fuel.available ? 1 : 0.5,
                      }}
                    >
                      <div>
                        <p 
                          className="text-base font-black mb-1"
                          style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
                        >
                          {fuel.name}
                        </p>
                        <p 
                          className="text-xs font-semibold"
                          style={{ 
                            color: fuel.available 
                              ? (isDark ? '#22c55e' : '#16a34a')
                              : (isDark ? '#ef4444' : '#dc2626')
                          }}
                        >
                          {fuel.available ? '● Mavjud' : '● Mavjud emas'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p 
                          className="text-xl font-black"
                          style={{ color: accentColor.color }}
                        >
                          {fuel.price.toLocaleString('uz-UZ')}
                        </p>
                        <p 
                          className="text-xs font-semibold"
                          style={{ color: isDark ? '#888888' : '#999999' }}
                        >
                          so'm/litr
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                {/* Address */}
                <div 
                  className="flex items-start gap-3 p-4 rounded-xl"
                  style={{
                    background: isDark ? '#1a1a1a' : '#f0f0f0',
                    boxShadow: isDark
                      ? '4px 4px 8px #0d0d0d, -4px -4px 8px #272727'
                      : '4px 4px 8px #d1d1d1, -4px -4px 8px #ffffff',
                  }}
                >
                  <MapPin className="size-5 flex-shrink-0 mt-0.5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold mb-1" style={{ color: isDark ? '#888888' : '#999999' }}>
                      Manzil
                    </p>
                    <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}>
                      {station.address}
                    </p>
                    <p className="text-xs font-semibold mt-1" style={{ color: accentColor.color }}>
                      📍 {station.distance}
                    </p>
                  </div>
                </div>

                {/* Phone */}
                <div 
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{
                    background: isDark ? '#1a1a1a' : '#f0f0f0',
                    boxShadow: isDark
                      ? '4px 4px 8px #0d0d0d, -4px -4px 8px #272727'
                      : '4px 4px 8px #d1d1d1, -4px -4px 8px #ffffff',
                  }}
                >
                  <Phone className="size-5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold mb-1" style={{ color: isDark ? '#888888' : '#999999' }}>
                      Telefon
                    </p>
                    <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}>
                      {station.phone}
                    </p>
                  </div>
                </div>

                {/* Opening Hours */}
                <div 
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{
                    background: isDark ? '#1a1a1a' : '#f0f0f0',
                    boxShadow: isDark
                      ? '4px 4px 8px #0d0d0d, -4px -4px 8px #272727'
                      : '4px 4px 8px #d1d1d1, -4px -4px 8px #ffffff',
                  }}
                >
                  <Clock className="size-5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold mb-1" style={{ color: isDark ? '#888888' : '#999999' }}>
                      Ish vaqti
                    </p>
                    <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}>
                      {station.openingHours}
                    </p>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div>
                <h3 
                  className="text-sm font-bold uppercase mb-3"
                  style={{ color: isDark ? '#888888' : '#999999' }}
                >
                  Xizmatlar
                </h3>
                <div className="flex flex-wrap gap-2">
                  {station.services.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{
                        background: isDark ? '#1a1a1a' : '#f0f0f0',
                        boxShadow: isDark
                          ? 'inset 2px 2px 4px #0d0d0d, inset -2px -2px 4px #272727'
                          : 'inset 2px 2px 4px #d1d1d1, inset -2px -2px 4px #ffffff',
                      }}
                    >
                      <Check className="size-3" style={{ color: accentColor.color }} strokeWidth={3} />
                      <span 
                        className="text-xs font-semibold"
                        style={{ color: isDark ? '#cccccc' : '#666666' }}
                      >
                        {service}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCall}
                  className="py-4 rounded-2xl font-black text-base transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                    boxShadow: `0 8px 20px ${accentColor.color}60`,
                  }}
                >
                  <Phone className="size-5" strokeWidth={2.5} />
                  Qo'ng'iroq
                </button>

                <button
                  onClick={handleOpenMap}
                  className="py-4 rounded-2xl font-black text-base transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: isDark ? '#1a1a1a' : '#f0f0f0',
                    color: accentColor.color,
                    boxShadow: isDark
                      ? '6px 6px 12px #0d0d0d, -6px -6px 12px #272727'
                      : '6px 6px 12px #d1d1d1, -6px -6px 12px #ffffff',
                  }}
                >
                  <MapPin className="size-5" strokeWidth={2.5} />
                  Xarita
                </button>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </>
    );
  }

  // Android Material Design Modal
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 app-safe-pad bg-black/80 z-50 transition-all duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 top-20 z-50 overflow-hidden">
        <div 
          className="h-full mx-auto max-w-2xl relative overflow-y-auto bg-[#121212]"
          style={{
            animation: 'slideUpMaterial 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white"
            >
              <X className="size-6" />
            </button>
            
            <img src={station.image} alt={station.name} className="w-full h-80 object-cover rounded-2xl mb-6" />
            
            <h2 className="text-3xl font-bold text-white mb-4">{station.name}</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCall}
                className="py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
                style={{
                  background: accentColor.color,
                  color: '#ffffff',
                }}
              >
                <Phone className="size-5" />
                Qo'ng'iroq
              </button>

              <button
                onClick={handleOpenMap}
                className="py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-white/10 text-white"
              >
                <MapPin className="size-5" />
                Xarita
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUpMaterial {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
});
