import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useRentalCart } from '../context/RentalCartContext';
import { RentalItem } from '../data/rentals';
import {
  X,
  MapPin,
  Star,
  Calendar,
  User,
  Shield,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { notifyRentalCartAdded } from '../utils/appToast';
import { useVisibilityTick } from '../utils/visibilityRefetch';

interface RentalItemDetailModalProps {
  item: RentalItem;
  isOpen: boolean;
  onClose: () => void;
}

export function RentalItemDetailModal({ item, isOpen, onClose }: RentalItemDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const { addToCart } = useRentalCart();
  const isDark = theme === 'dark';
  
  // Image gallery state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const allImages = item.images && item.images.length > 0 ? item.images : [item.image];
  
  // Get default period from available durations
  const getDefaultPeriod = (): 'hourly' | 'daily' | 'weekly' | 'monthly' => {
    // @ts-ignore - item may have durations property from backend
    const durations = item.durations || {};
    if (durations.hourly?.enabled) return 'hourly';
    if (durations.daily?.enabled) return 'daily';
    if (durations.weekly?.enabled) return 'weekly';
    if (durations.monthly?.enabled) return 'monthly';
    return 'daily';
  };
  
  const [rentalPeriod, setRentalPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>(getDefaultPeriod());
  const [rentalDuration, setRentalDuration] = useState(1);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const visibilityRefetchTick = useVisibilityTick();

  // Load ratings when modal opens
  useEffect(() => {
    if (isOpen && item.id) {
      loadRatings();
      setCurrentImageIndex(0); // Reset image index when modal opens
    }
  }, [isOpen, item.id, visibilityRefetchTick]);

  const loadRatings = async () => {
    try {
      setLoadingRatings(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/ratings/${item.id}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setRatings(data.ratings || []);
      }
    } catch (error) {
      console.error('Error loading ratings:', error);
      toast.error('Ratingsni yuklashda xatolik yuz berdi!');
    } finally {
      setLoadingRatings(false);
    }
  };

  if (!isOpen) return null;

  const getPriceForPeriod = () => {
    // @ts-ignore - item may have durations property from backend
    const durations = item.durations || {};
    
    switch(rentalPeriod) {
      case 'hourly': return durations.hourly?.price ? parseInt(durations.hourly.price) : (item.price || 0);
      case 'daily': return durations.daily?.price ? parseInt(durations.daily.price) : (item.dailyPrice || item.price || 0);
      case 'weekly': return durations.weekly?.price ? parseInt(durations.weekly.price) : (item.weeklyPrice || 0);
      case 'monthly': return durations.monthly?.price ? parseInt(durations.monthly.price) : (item.monthlyPrice || 0);
    }
  };

  const totalPrice = getPriceForPeriod() * rentalDuration;

  const getPeriodLabel = () => {
    switch(rentalPeriod) {
      case 'hourly': return 'soat';
      case 'daily': return 'kun';
      case 'weekly': return 'hafta';
      case 'monthly': return 'oy';
    }
  };

  const handleRentNow = () => {
    try {
      if (
        item.available === false ||
        (typeof item.available === 'number' && item.available <= 0)
      ) {
        toast.error('Mahsulot tugagan');
        return;
      }
      if (!(item as { branchId?: string }).branchId) {
        toast.error('Bu e’lon filialga bog‘lanmagan. Filial ijara mahsulotini qayta saqlang.');
        return;
      }
      // Add to cart
      const pricePerPeriod = getPriceForPeriod();
      addToCart(item, rentalPeriod, rentalDuration, pricePerPeriod);
      
      notifyRentalCartAdded(item.name);
      
      console.log('✅ Added to rental cart:', {
        item: item.name,
        period: rentalPeriod,
        duration: rentalDuration,
        price: totalPrice
      });
      
      // Close modal after success
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error: any) {
      console.error('❌ Error adding to cart:', error);
      toast.error(`Xatolik: ${error.message || 'Savatga qo\'shishda muammo yuz berdi'}`);
    }
  };

  const panelBg = isDark ? '#111111' : '#ffffff';
  const footerBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Orqa fon — to‘liq ekran (notch ostida ham) */}
      <button
        type="button"
        aria-label="Yopish"
        className="pointer-events-auto fixed inset-0 z-0 cursor-pointer border-0 backdrop-blur-md"
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.82)' : 'rgba(0, 0, 0, 0.55)',
        }}
        onClick={onClose}
      />

      {/* Kontent — xavfsiz zona ichida to‘liq balandlik; pastki CTA scroll dan tashqari */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rental-detail-title"
        className="pointer-events-auto fixed left-0 right-0 z-[1] flex flex-col sm:items-center sm:justify-center sm:p-4 sm:px-5"
        style={{
          top: 'var(--app-safe-top)',
          bottom: 'var(--app-safe-bottom)',
          paddingLeft: 'var(--app-safe-left, 0px)',
          paddingRight: 'var(--app-safe-right, 0px)',
        }}
      >
        <div
          className="relative flex h-full w-full min-h-0 max-w-2xl flex-col overflow-hidden sm:h-auto sm:max-h-[min(92dvh,calc(100dvh-var(--app-safe-top)-var(--app-safe-bottom)-2rem))] sm:rounded-3xl sm:shadow-2xl"
          style={{
            background: panelBg,
            boxShadow: isDark ? '0 25px 50px rgba(0,0,0,0.5)' : '0 25px 50px rgba(0,0,0,0.12)',
          }}
        >
        {/* Image — 6:5 (600×500 ga mos), to‘liq ko‘rinish (contain), ramka nisbatga mos */}
        <div
          className="relative mx-auto w-full max-w-[600px] shrink-0 overflow-hidden sm:rounded-t-3xl"
          style={{
            aspectRatio: '6 / 5',
            maxHeight: 'min(500px, 48dvh)',
            background: isDark ? '#0c0c0c' : '#ececee',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="absolute z-20 flex size-10 items-center justify-center rounded-full backdrop-blur-xl transition-all active:scale-90"
            style={{
              background: 'rgba(0, 0, 0, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              top: '0.75rem',
              right: 'max(0.75rem, var(--app-safe-right, env(safe-area-inset-right, 0px)))',
            }}
          >
            <X className="size-5 text-white" strokeWidth={2.5} />
          </button>
          <div className="absolute inset-0 flex min-h-[min(180px,35dvh)] items-center justify-center p-2 sm:p-3">
            <img
              src={allImages[currentImageIndex]}
              alt={item.name}
              className="max-h-full max-w-full object-contain object-center"
              decoding="async"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)'} 0%, transparent 55%)`,
            }}
          />

          {/* Rating Badge */}
          <div
            className="absolute bottom-4 z-10 flex items-center gap-2 rounded-xl border px-3 py-1.5 backdrop-blur-xl"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              left: 'max(1rem, var(--app-safe-left, env(safe-area-inset-left, 0px)))',
            }}
          >
            <Star className="size-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium text-white">{item.rating}</span>
            <span className="text-xs text-white/70">({item.reviews} sharh)</span>
          </div>

          {/* Image Navigation */}
          {allImages.length > 1 && (
            <>
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1))}
                  className="pointer-events-auto rounded-full p-2 backdrop-blur-xl transition-all active:scale-90"
                  style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <ChevronLeft className="size-6 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0))}
                  className="pointer-events-auto rounded-full p-2 backdrop-blur-xl transition-all active:scale-90"
                  style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <ChevronRight className="size-6 text-white" />
                </button>
              </div>
              
              {/* Thumbnail Preview */}
              <div className="absolute bottom-4 right-4 gap-2 max-w-[50%] overflow-x-auto hidden">
                {allImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all"
                    style={{
                      border: `2px solid ${index === currentImageIndex ? accentColor.color : 'rgba(255, 255, 255, 0.3)'}`,
                      opacity: index === currentImageIndex ? 1 : 0.6,
                    }}
                  >
                    <img 
                      src={img} 
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
              
              {/* Image Counter */}
              <div
                className="absolute top-4 z-10 px-3 py-1.5 rounded-xl border backdrop-blur-xl"
                style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  left: 'max(1rem, var(--app-safe-left, env(safe-area-inset-left, 0px)))',
                }}
              >
                <span className="text-sm text-white font-medium">
                  {currentImageIndex + 1} / {allImages.length}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Scroll: batafsil; pastki savat — alohida, scroll bo‘lmaydi */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 sm:px-6 sm:py-5 [-webkit-overflow-scrolling:touch]">
          {/* Title & Location */}
          <div className="mb-6">
            <h2 
              id="rental-detail-title"
              className="text-2xl font-bold mb-3"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              {item.name}
            </h2>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="size-4" style={{ color: accentColor.color }} />
              <span 
                className="text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
              >
                {item.location}
              </span>
            </div>
            {item.owner && (
              <div className="flex items-center gap-2">
                <User className="size-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                <span 
                  className="text-sm"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  {item.owner}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 
              className="text-lg font-semibold mb-2"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Ta'rif
            </h3>
            <p 
              className="text-sm leading-relaxed"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {item.description}
            </p>
          </div>

          {/* Features */}
          {item.features && item.features.length > 0 && (
            <div className="mb-6">
              <h3 
                className="text-lg font-semibold mb-3"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                Xususiyatlar
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {item.features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div 
                      className="size-2 rounded-full flex-shrink-0"
                      style={{ background: accentColor.color }}
                    />
                    <span 
                      className="text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                    >
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Info */}
          {(item.deposit || item.minRentalPeriod) && (
            <div className="mb-6 p-4 rounded-2xl" style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            }}>
              {item.deposit && (
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="size-4" style={{ color: accentColor.color }} />
                  <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                    Garov:{' '}
                    <strong>
                      {(() => {
                        const raw = String(item.deposit).trim();
                        const compact = raw.replace(/\s/g, '').replace(/,/g, '');
                        if (/^\d+(\.\d+)?$/.test(compact)) {
                          const n = Number(compact);
                          return `${n.toLocaleString()} so'm`;
                        }
                        return raw;
                      })()}
                    </strong>
                  </span>
                </div>
              )}
              {item.minRentalPeriod && (
                <div className="flex items-center gap-2">
                  <Clock className="size-4" style={{ color: accentColor.color }} />
                  <span className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                    Minimal muddat: <strong>{item.minRentalPeriod}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Rental Period Selection */}
          <div className="mb-6">
            <h3 
              className="text-lg font-semibold mb-3 flex items-center gap-2"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              <Calendar className="size-5" style={{ color: accentColor.color }} />
              Ijara muddatini tanlang
            </h3>
            
            {/* Period Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {(() => {
                // @ts-ignore - item may have durations property from backend
                const durations = item.durations || {};
                const periods = [
                  { key: 'hourly' as const, label: 'Soatlik', data: durations.hourly },
                  { key: 'daily' as const, label: 'Kunlik', data: durations.daily },
                  { key: 'weekly' as const, label: 'Haftalik', data: durations.weekly },
                  { key: 'monthly' as const, label: 'Oylik', data: durations.monthly },
                ];
                
                return periods.filter(p => p.data?.enabled).map((period) => (
                  <button
                    key={period.key}
                    onClick={() => setRentalPeriod(period.key)}
                    className="p-3 rounded-xl transition-all"
                    style={{
                      background: rentalPeriod === period.key 
                        ? `${accentColor.color}20` 
                        : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `2px solid ${rentalPeriod === period.key ? accentColor.color : 'transparent'}`,
                    }}
                  >
                    <div 
                      className="text-xs mb-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      {period.label}
                    </div>
                    <div 
                      className="text-sm font-bold"
                      style={{ color: rentalPeriod === period.key ? accentColor.color : (isDark ? '#ffffff' : '#111827') }}
                    >
                      {(Number(period.data?.price) || 0).toLocaleString('uz-UZ')}
                    </div>
                  </button>
                ));
              })()}
            </div>

            {/* Duration Selector */}
            <div className="flex items-center gap-4">
              <span 
                className="text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
              >
                Qancha {getPeriodLabel()}?
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRentalDuration(Math.max(1, rentalDuration - 1))}
                  className="size-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <span style={{ color: isDark ? '#ffffff' : '#111827' }}>−</span>
                </button>
                <span 
                  className="text-lg font-bold min-w-[3ch] text-center"
                  style={{ color: accentColor.color }}
                >
                  {rentalDuration}
                </span>
                <button
                  onClick={() => setRentalDuration(rentalDuration + 1)}
                  className="size-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <span style={{ color: isDark ? '#ffffff' : '#111827' }}>+</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          {ratings.length > 0 && (
            <div className="mb-6">
              <h3 
                className="text-lg font-semibold mb-3 flex items-center gap-2"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                <Star className="size-5" style={{ color: accentColor.color }} />
                Sharhlar ({ratings.length})
              </h3>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {ratings.slice(0, 5).map((review: any) => (
                  <div
                    key={review.id}
                    className="p-4 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                          {review.customerName || 'Anonim'}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                          {new Date(review.createdAt).toLocaleDateString('uz-UZ', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className="size-3.5"
                            style={{ 
                              color: i < review.rating ? '#FCD34D' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', 
                              fill: i < review.rating ? '#FCD34D' : 'none', 
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p 
                        className="text-sm leading-relaxed"
                        style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}
                      >
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              
              {ratings.length > 5 && (
                <div 
                  className="text-center mt-3 text-sm"
                  style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
                >
                  va yana {ratings.length - 5} ta sharh...
                </div>
              )}
            </div>
          )}
          </div>

          {/* Pastki panel: har doim ko‘rinadi, scroll emas */}
          <div
            className="shrink-0 border-t px-5 pb-4 pt-3 sm:px-6"
            style={{
              borderColor: footerBorder,
              background: panelBg,
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <span
                className="text-sm font-medium"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)' }}
              >
                Jami narx
              </span>
              <div className="text-right">
                <div className="text-xl font-bold sm:text-2xl" style={{ color: accentColor.color }}>
                  {totalPrice.toLocaleString('uz-UZ')} so'm
                </div>
                <div
                  className="text-xs"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}
                >
                  {rentalDuration} {getPeriodLabel()} uchun
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRentNow}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:py-4"
              style={{
                background: accentColor.color,
                color: '#ffffff',
                boxShadow: `0 8px 24px ${accentColor.color}66`,
              }}
            >
              <ShoppingCart className="size-5 shrink-0" strokeWidth={2.5} />
              Savatga qo&apos;shish
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}