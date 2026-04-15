import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useFavorites } from '../context/FavoritesContext';
import { X, Heart, Share2, Star, ChevronLeft, ChevronRight, ShoppingCart, Package, Clock, RotateCcw, Settings, MapPin, ChevronRight as ChevronRightIcon, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { notifyCartAdded } from '../utils/appToast';
import { shareTitleTextUrl } from '../utils/marketplaceNativeBridge';
import { getVariantStockQuantity } from '../utils/cartStock';

// Full Screen Product Detail Modal (Ozon/Wildberries style)
export function ProductDetailModal({ 
  product, 
  onClose, 
  onAddToCart,
  source = 'market' // Add source prop
}: { 
  product: any; 
  onClose: () => void; 
  onAddToCart: (product: any, quantity: number, variantId?: string, variantName?: string) => void;
  source?: 'market' | 'shop'; // Add source type
}) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const { isFavorite: isProductFavorite, toggleFavorite } = useFavorites();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(0); // Add variant state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews'>('description'); // Add tabs state
  const [quantity, setQuantity] = useState(0); // Add quantity state - start at 0
  const [selectedInstallmentMonth, setSelectedInstallmentMonth] = useState(3); // Nasiya oyi - default 3 oy

  const readVariantSoldTotal = (v: Record<string, unknown> | null | undefined): number => {
    const raw = v
      ? (v as { soldCount?: unknown; soldThisWeek?: unknown }).soldCount ??
        (v as { soldThisWeek?: unknown }).soldThisWeek
      : (product.soldCount ?? product.soldThisWeek);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };
  
  // Variants - use real variants if available
  const variants = product.variants && product.variants.length > 0
    ? product.variants.map((v: any, idx: number) => ({
        id: idx,
        label: v.name,
        image: v.image || v.images?.[0] || product.image,
        images: v.images || [v.image || product.image],
        price: v.price,
        stockQuantity: getVariantStockQuantity(v, product),
        oldPrice: v.oldPrice ?? product.oldPrice,
        variantId: v.id,
        soldTotal: readVariantSoldTotal(v),
      }))
    : [{ 
        id: 0, 
        label: 'Standart', 
        image: product.image,
        images: [product.image],
        price: product.price, 
        stockQuantity: getVariantStockQuantity(null, product),
        oldPrice: product.oldPrice,
        variantId: '0',
        soldTotal: readVariantSoldTotal(null),
      }];

  // Get current variant
  const currentVariant = variants[selectedVariant] || variants[0];
  const currentImages = currentVariant.images || [currentVariant.image];
  const currentPrice = currentVariant.price;
  const currentOldPrice = currentVariant.oldPrice; // Faqat real oldPrice ishlatiladi
  const currentStockQuantity = currentVariant.stockQuantity;

  const images = currentImages.filter(
    (u: unknown) => typeof u === 'string' && String(u).trim().length > 0,
  );

  // Reset image index when variant changes
  useEffect(() => {
    console.log('🔄 Variant o\'zgartirildi:', {
      variantIndex: selectedVariant,
      variantLabel: currentVariant.label,
      price: currentPrice,
      oldPrice: currentOldPrice,
      stock: currentStockQuantity,
      images: images.length,
      soldTotal: currentVariant.soldTotal
    });
    setCurrentImageIndex(0);
    setQuantity(0); // Reset quantity to 0 when variant changes
  }, [selectedVariant]);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const nextImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const buildProductShareUrl = () => {
    const base = `${window.location.origin}${window.location.pathname || '/'}`;
    const q = new URLSearchParams();
    q.set('productId', String(product.id));
    if (product.catalogId) q.set('catalogId', String(product.catalogId));
    const qs = q.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  };

  const handleShareProduct = async () => {
    const url = buildProductShareUrl();
    const text = `${product.name} — ${Number(product.price || 0).toLocaleString('uz-UZ')} so'm`;
    await shareTitleTextUrl({
      title: product.name,
      text,
      url,
      toast,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    // For shop products with multiple images - cycle through images
    if (source === 'shop' && currentImages.length > 1) {
      if (isLeftSwipe) {
        nextImage();
      }
      if (isRightSwipe) {
        prevImage();
      }
    } else {
      // For market products or single images - switch variants
      if (isLeftSwipe && selectedVariant < variants.length - 1) {
        setSelectedVariant(selectedVariant + 1);
        setCurrentImageIndex(0);
      }
      if (isRightSwipe && selectedVariant > 0) {
        setSelectedVariant(selectedVariant - 1);
        setCurrentImageIndex(0);
      }
    }
  };

  /** Orqa sahifa scroll bilan ikki marta scroll bo‘lmasin */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 app-safe-pad z-[100] flex flex-col min-h-0 h-dvh max-h-dvh overflow-hidden"
      style={{ background: isDark ? '#000000' : '#ffffff' }}
    >
      {/* Header */}
      <div 
        className="shrink-0 z-20 px-4 py-3 flex items-center justify-between backdrop-blur-xl"
        style={{
          paddingTop: 'max(0.75rem, var(--app-safe-top, 0px))',
          background: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const pid = Number(product.id);
              const was = isProductFavorite(pid);
              toggleFavorite({
                id: pid,
                name: String(product.name || ''),
                price: Number(product.price || 0),
                image: String(product.image || ''),
                categoryId: String(product.categoryId || ''),
                catalogId: String(product.catalogId || ''),
                rating: Number(product.rating || 0),
                stockCount: product.stockCount,
                oldPrice: product.oldPrice,
                description: product.description,
                branchName: product.branchName,
                branchId: product.branchId,
              });
              toast.success(was ? 'Sevimlilardan olib tashlandi' : 'Sevimlilarga qo‘shildi');
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
            aria-label={isProductFavorite(Number(product.id)) ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga qo‘shish'}
          >
            <Heart 
              className="w-5 h-5" 
              fill={isProductFavorite(Number(product.id)) ? '#ef4444' : 'none'}
              stroke={isProductFavorite(Number(product.id)) ? '#ef4444' : 'currentColor'}
            />
          </button>
          <button
            type="button"
            onClick={() => void handleShareProduct()}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
            aria-label="Ulashish"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
      {/* Image Gallery — kattaroq, konteynerni to‘ldirib ko‘rsatish */}
      <div
        className="relative w-full max-w-2xl mx-auto min-h-[min(42dvh,380px)] max-h-[min(52dvh,480px)] sm:min-h-[min(44dvh,400px)] sm:max-h-[min(50dvh,520px)] aspect-[4/3] sm:aspect-[16/10] bg-black/40 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {images.length > 0 ? (
          <>
            <img 
              src={images[Math.min(currentImageIndex, images.length - 1)]} 
              alt={product.name}
              className="w-full h-full object-cover object-center"
            />
            
            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl transition-all active:scale-90"
                  style={{ background: 'rgba(0, 0, 0, 0.5)' }}
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl transition-all active:scale-90"
                  style={{ background: 'rgba(0, 0, 0, 0.5)' }}
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              </>
            )}

            {/* Image Indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, index) => (
                  <div
                    key={index}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background: currentImageIndex === index 
                        ? accentColor.color 
                        : 'rgba(255, 255, 255, 0.5)',
                      width: currentImageIndex === index ? '24px' : '8px'
                    }}
                  />
                ))}
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {currentOldPrice && currentOldPrice > currentPrice && (
                <div 
                  className="px-3 py-1.5 rounded-lg text-sm font-bold backdrop-blur-xl"
                  style={{ background: 'rgba(239, 68, 68, 0.95)', color: '#ffffff' }}
                >
                  -{Math.round(((currentOldPrice - currentPrice) / currentOldPrice) * 100)}%
                </div>
              )}
              {product.isNew && (
                <div 
                  className="px-3 py-1.5 rounded-lg text-sm font-bold backdrop-blur-xl"
                  style={{ background: 'rgba(16, 185, 129, 0.95)', color: '#ffffff' }}
                >
                  Yangi
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="w-full h-full min-h-[inherit] flex items-center justify-center px-4 py-6">
            <div className="text-center">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-full flex items-center justify-center"
                style={{ background: `${accentColor.color}10` }}
              >
                <Package className="w-10 h-10 sm:w-12 sm:h-12" style={{ color: accentColor.color, opacity: 0.35 }} />
              </div>
              <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>
                Rasm mavjud emas
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6 pb-4">
        {/* Variant Thumbnails - only if multiple variants */}
        {variants.length > 1 && (
          <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
            {variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => {
                  setSelectedVariant(variant.id);
                  setCurrentImageIndex(0);
                }}
                className="relative flex-shrink-0 w-[5.5rem] h-[5.5rem] sm:w-28 sm:h-28 rounded-2xl overflow-hidden transition-all snap-start"
                style={{
                  background: isDark ? '#1a1a1a' : '#f9fafb',
                  border: selectedVariant === variant.id 
                    ? `2px solid ${accentColor.color}` 
                    : 'none',
                }}
              >
                <img 
                  src={variant.image} 
                  alt={variant.label}
                  className="w-full h-full object-cover"
                />
                <div 
                  className="absolute bottom-0.5 left-0.5 right-0.5 text-center py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold truncate px-1"
                  style={{
                    background: selectedVariant === variant.id 
                      ? accentColor.color 
                      : (isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)'),
                    color: '#ffffff',
                  }}
                >
                  {variant.label}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Title & Rating */}
        <div>
          <h1 className="text-2xl font-bold mb-3">{product.name}</h1>
          <div className="flex items-center gap-3">
            {product.rating && product.rating > 0 ? (
              <>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4"
                      fill={i < Math.floor(product.rating) ? '#fbbf24' : 'none'}
                      stroke="#fbbf24"
                    />
                  ))}
                </div>
                <span className="font-medium">{product.rating.toFixed(1)}</span>
                {product.reviewCount && product.reviewCount > 0 && (
                  <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    ({product.reviewCount} sharh)
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4" fill="none" stroke={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'} />
                <span 
                  className="font-medium text-sm"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                >
                  Hali baholanmagan
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Price */}
        <div 
          className="p-4 sm:p-5 rounded-2xl"
          style={{ 
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
          }}
        >
          {/* Price Row */}
          <div className="flex flex-wrap items-end gap-2 sm:gap-3 mb-3">
            <h2 className="text-3xl sm:text-4xl font-bold leading-none break-words max-w-full" style={{ color: accentColor.color }}>
              {currentPrice.toLocaleString()}
              <span className="text-base sm:text-lg ml-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>so'm</span>
            </h2>
            {currentOldPrice && currentOldPrice > currentPrice && (
              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1 flex-shrink-0">
                <p 
                  className="text-sm sm:text-base line-through leading-none whitespace-nowrap"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                >
                  {currentOldPrice.toLocaleString()}
                </p>
                <div 
                  className="px-1.5 sm:px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap"
                  style={{ background: '#ef4444', color: '#ffffff' }}
                >
                  -{Math.round(((currentOldPrice - currentPrice) / currentOldPrice) * 100)}%
                </div>
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="space-y-1.5 sm:space-y-2">
            {currentOldPrice && currentOldPrice > currentPrice && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${accentColor.color}20` }}
                >
                  <span className="text-xs" style={{ color: accentColor.color }}>✓</span>
                </div>
                <p className="text-xs sm:text-sm font-medium break-words" style={{ color: accentColor.color }}>
                  {(currentOldPrice - currentPrice).toLocaleString()} so'm tejash
                </p>
              </div>
            )}
            
            {currentPrice >= 200000 && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${accentColor.color}20` }}
                >
                  <span className="text-xs" style={{ color: accentColor.color }}>✓</span>
                </div>
                <p className="text-xs sm:text-sm break-words" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                  Bepul yetkazib berish
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${accentColor.color}20` }}
              >
                <span className="text-xs" style={{ color: accentColor.color }}>✓</span>
              </div>
              <p className="text-xs sm:text-sm break-words" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                Bo'lib-bo'lib to'lash imkoniyati
              </p>
            </div>
          </div>
        </div>

        {/* Uzum Nasiya - Installment Plan */}
        <div 
          className="p-4 rounded-2xl"
          style={{ 
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor.color}20` }}
              >
                <Clock className="w-5 h-5" style={{ color: accentColor.color }} />
              </div>
              <div>
                <h3 className="font-bold text-base">Nasiyaga oling</h3>
                <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Ustama to'lovsiz
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold" style={{ color: accentColor.color }}>
                {Math.ceil(currentPrice / selectedInstallmentMonth).toLocaleString()} so'm
              </p>
              <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                oyiga
              </p>
            </div>
          </div>

          {/* Month Selection Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[3, 6, 9, 12, 24].map((months) => {
              const monthlyPayment = Math.ceil(currentPrice / months);
              const isSelected = selectedInstallmentMonth === months;
              
              return (
                <button
                  key={months}
                  onClick={() => setSelectedInstallmentMonth(months)}
                  className="flex-1 px-2 py-2.5 rounded-xl transition-all active:scale-95"
                  style={{
                    background: isSelected 
                      ? accentColor.color
                      : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    border: isSelected 
                      ? `2px solid ${accentColor.color}`
                      : 'none',
                    boxShadow: isSelected 
                      ? `0 4px 12px ${accentColor.color}40`
                      : 'none',
                  }}
                >
                  <div className="text-center">
                    <p 
                      className="text-[9px] font-medium mb-0.5 whitespace-nowrap"
                      style={{ 
                        color: isSelected 
                          ? '#ffffff' 
                          : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'
                      }}
                    >
                      {months} oy
                    </p>
                    <p 
                      className="text-[11px] font-bold whitespace-nowrap"
                      style={{ 
                        color: isSelected 
                          ? '#ffffff' 
                          : isDark ? '#ffffff' : '#000000'
                      }}
                    >
                      {monthlyPayment.toLocaleString()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Plan Details */}
          <div 
            className="mt-4 p-3 rounded-xl"
            style={{ 
              background: `${accentColor.color}10`,
              border: `1px solid ${accentColor.color}30`
            }}
          >
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                {selectedInstallmentMonth} oyga
              </span>
              <span className="font-bold" style={{ color: accentColor.color }}>
                {Math.ceil(currentPrice / selectedInstallmentMonth).toLocaleString()} so'm × {selectedInstallmentMonth}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2 pt-2" style={{ borderTop: `1px solid ${accentColor.color}20` }}>
              <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                Jami:
              </span>
              <span className="font-bold" style={{ color: accentColor.color }}>
                {currentPrice.toLocaleString()} so'm
              </span>
            </div>
          </div>
        </div>

        {/* Stock Status and Sold This Week - Side by Side */}
        <div className="grid grid-cols-2 gap-2">
          {/* Stock Status */}
          {currentStockQuantity !== undefined && (
            <div 
              className="px-3 py-2 rounded-xl flex items-center gap-2"
              style={{ 
                background: currentStockQuantity > 0 
                  ? isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                  : isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)'
              }}
            >
              <div 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ 
                  background: currentStockQuantity > 10 
                    ? '#10b981' 
                    : currentStockQuantity > 0 
                      ? '#f59e0b' 
                      : '#ef4444'
                }}
              />
              <p className="text-xs font-medium truncate">
                {currentStockQuantity > 10 
                  ? `Omborda: ${currentStockQuantity}` 
                  : currentStockQuantity > 0 
                    ? `Qoldi: ${currentStockQuantity}` 
                    : 'Tugagan'}
              </p>
            </div>
          )}

          {/* Jami sotilgan (server: variant.soldCount) */}
          <div 
            className="px-3 py-2 rounded-xl flex items-center gap-2"
            style={{ 
              background: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            }}
          >
            <div 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: '#3b82f6' }}
            />
            <p className="text-xs font-medium truncate" style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
              Sotilgan: {currentVariant.soldTotal}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('description')}
            className="px-4 py-2 rounded-lg font-bold transition-all"
            style={{
              background: activeTab === 'description' ? accentColor.color : 'transparent',
              color: activeTab === 'description' ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'
            }}
          >
            Tavsif
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className="px-4 py-2 rounded-lg font-bold transition-all"
            style={{
              background: activeTab === 'specs' ? accentColor.color : 'transparent',
              color: activeTab === 'specs' ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'
            }}
          >
            Xususiyatlari
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className="px-4 py-2 rounded-lg font-bold transition-all"
            style={{
              background: activeTab === 'reviews' ? accentColor.color : 'transparent',
              color: activeTab === 'reviews' ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'
            }}
          >
            Sharhlar
          </button>
        </div>

        {/* Description */}
        {activeTab === 'description' && (
          <div>
            <h3 className="font-bold text-lg mb-2">Tavsif</h3>
            <p 
              className="leading-relaxed"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              {product.description || 'Bu mahsulot yuqori sifatli materiallardan tayyorlangan va uzoq muddatli foydalanish uchun mo\'ljallangan. Zamonaviy dizayn va qulay foydalanish.'}
            </p>
          </div>
        )}

        {/* Characteristics */}
        {activeTab === 'specs' && (
          <div>
            <h3 className="font-bold text-lg mb-3">Xususiyatlari</h3>
            
            {/* Product Features List */}
            {product.features && Array.isArray(product.features) && product.features.length > 0 && (
              <div className="mb-4 space-y-2">
                {product.features.map((feature: string, index: number) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-3 rounded-xl"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div 
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: accentColor.color }}
                    />
                    <span className="text-sm leading-relaxed" style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            <div 
              className="rounded-2xl overflow-hidden"
              style={{ 
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
              }}
            >
              {/* Removed - not needed */}
            </div>
          </div>
        )}

        {/* Reviews */}
        {activeTab === 'reviews' && (
          <div>
            <h3 className="font-bold text-lg mb-3">Sharhlar</h3>
            <div className="space-y-4">
              {product.reviews && product.reviews.length > 0 ? (
                product.reviews.map((review: any, index: number) => (
                  <div key={index} className="p-4 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <Star className="w-5 h-5" fill="#fbbf24" />
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className="w-4 h-4"
                            fill={i < Math.floor(review.rating || 5) ? '#fbbf24' : 'none'}
                            stroke="#fbbf24"
                          />
                        ))}
                      </div>
                      <span className="font-medium">{(review.rating || 5).toFixed(1)}</span>
                      <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        ({review.reviewCount || 128} sharh)
                      </span>
                    </div>
                    <p className="mt-2 leading-relaxed" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      {review.comment || 'Bu mahsulot juda yaxshi bo\'ldi!'}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-2xl" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }}>
                  <p className="text-center" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    Hali sharhlar yo\'q
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shop Info */}
        {product.shopName && (
          <div 
            className="p-4 rounded-2xl"
            style={{ 
              background: `${accentColor.color}10`,
              border: `1px solid ${accentColor.color}30`
            }}
          >
            <h3 className="font-bold mb-2">Do'kon</h3>
            <p className="font-medium" style={{ color: accentColor.color }}>{product.shopName}</p>
          </div>
        )}

      </div>
      </div>

      {/* Pastki panel — flex ichida, alohida scroll yo‘q */}
      <div 
        className="shrink-0 px-4 pt-4 space-y-3 border-t backdrop-blur-xl z-10 pb-[max(1rem,var(--app-safe-bottom,0px))]"
        style={{ 
          background: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Stock Badge - Hidden */}
        {false && currentStockQuantity !== undefined && currentStockQuantity > 0 && (
          <div 
            className="px-3 py-1.5 rounded-xl flex items-center justify-between text-sm font-medium"
            style={{ 
              background: currentStockQuantity > 10 
                ? (isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)')
                : (isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)'),
              color: currentStockQuantity > 10 ? '#10b981' : '#f59e0b'
            }}
          >
            <span>Omborda: {currentStockQuantity} dona</span>
            {quantity > 0 && (
              <span style={{ color: accentColor.color }}>
                Jami: {(currentPrice * quantity).toLocaleString()} so'm
              </span>
            )}
          </div>
        )}

        {/* Product Action */}
        <div 
          className="rounded-2xl p-4 transition-all"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))'
              : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
            border: quantity > 0
              ? `1.5px solid ${accentColor.color}`
              : (isDark 
                  ? '1px solid rgba(255, 255, 255, 0.1)' 
                  : '1px solid rgba(0, 0, 0, 0.1)'),
            boxShadow: quantity > 0
              ? `0 4px 16px ${accentColor.color}40`
              : '0 2px 8px rgba(0, 0, 0, 0.1)',
            opacity: currentStockQuantity === 0 ? 0.6 : 1,
          }}
        >
          <div className="flex items-center justify-between">
            {/* Left side - Name and Price */}
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <span 
                  className="text-lg font-bold"
                  style={{ color: accentColor.color }}
                >
                  {currentPrice.toLocaleString('uz-UZ')} so'm
                </span>
                {currentOldPrice && currentOldPrice > currentPrice && (
                  <span 
                    className="text-xs line-through"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
                  >
                    {currentOldPrice.toLocaleString('uz-UZ')}
                  </span>
                )}
              </div>
            </div>

            {/* Right side - Quantity or Add Button */}
            {quantity > 0 ? (
              <div 
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: isDark 
                    ? 'rgba(0, 0, 0, 0.3)'
                    : 'rgba(0, 0, 0, 0.05)',
                  border: isDark 
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(0, 0, 0, 0.1)',
                }}
              >
                <button
                  onClick={() => {
                    const newQuantity = Math.max(0, quantity - 1);
                    setQuantity(newQuantity);
                    if (newQuantity === 0) {
                      toast.info(`${product.name} savatdan olib tashlandi`);
                    }
                  }}
                  className="p-1 rounded-lg transition-all active:scale-90"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <Minus className="size-4" style={{ color: isDark ? '#ffffff' : '#111827' }} strokeWidth={2.5} />
                </button>
                
                <span 
                  className="text-lg font-bold w-8 text-center"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {quantity}
                </span>
                
                <button
                  onClick={() => {
                    if (quantity < currentStockQuantity) {
                      setQuantity(quantity + 1);
                    } else {
                      toast.error(`Omborda faqat ${currentStockQuantity} dona mavjud`);
                    }
                  }}
                  disabled={quantity >= currentStockQuantity}
                  className="p-1 rounded-lg transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundImage: quantity >= currentStockQuantity ? 'none' : accentColor.gradient,
                    background: quantity >= currentStockQuantity ? (isDark ? '#333333' : '#d1d5db') : undefined,
                  }}
                >
                  <Plus 
                    className="size-4" 
                    style={{ color: quantity >= currentStockQuantity ? (isDark ? '#666666' : '#9ca3af') : '#ffffff' }} 
                    strokeWidth={2.5} 
                  />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (currentStockQuantity > 0) {
                    setQuantity(1);
                  }
                }}
                disabled={currentStockQuantity === 0}
                className="px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundImage: currentStockQuantity === 0 ? 'none' : accentColor.gradient,
                  background: currentStockQuantity === 0 ? (isDark ? '#666666' : '#9ca3af') : undefined,
                  color: '#ffffff',
                  boxShadow: currentStockQuantity === 0 ? 'none' : `0 4px 12px ${accentColor.color}66`,
                }}
              >
                <ShoppingCart className="size-4" strokeWidth={2.5} />
                <span>{currentStockQuantity === 0 ? 'Tugagan' : 'Savatga'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Final Add to Cart Button - only show when quantity > 0 */}
        {quantity > 0 && (
          <button
            onClick={() => {
              console.log('🛒 Savatga qo\'shish bosildi:', {
                product: product.name,
                quantity,
                variantId: currentVariant.variantId,
                variantLabel: currentVariant.label,
                price: currentPrice
              });
              
              if (quantity > 0) {
                onAddToCart(product, quantity, currentVariant.variantId, currentVariant.label);
                notifyCartAdded(quantity, {
                  name: `${product.name} · ${currentVariant.label}`,
                });
                console.log('✅ Savatga qo\'shildi!');
                setQuantity(0); // Reset quantity after adding to cart
                onClose(); // Close modal
              } else {
                toast.error('Miqdorni tanlang!', { duration: 2000 });
                console.log('❌ Quantity = 0, qo\'shilmadi');
              }
            }}
            disabled={quantity === 0}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              background: quantity > 0 ? accentColor.color : '#666666',
              color: '#ffffff',
              boxShadow: quantity > 0 ? `0 6px 20px ${accentColor.color}66` : 'none'
            }}
          >
            <ShoppingCart className="w-6 h-6" />
            <span>
              {quantity === 0 
                ? 'Miqdorni tanlang' 
                : `Savatga qo'shish - ${(currentPrice * quantity).toLocaleString()} so'm`
              }
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// Variant Selection Menu (Bottom Sheet)
export function VariantSelectionMenu({ 
  product, 
  onClose 
}: { 
  product: any; 
  onClose: () => void;
}) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  
  const [selectedColor, setSelectedColor] = useState('Qora');
  const [selectedSize, setSelectedSize] = useState('M');
  const [quantity, setQuantity] = useState(1);

  const colors = ['Qora', 'Oq', 'Ko\'k', 'Qizil', 'Yashil'];
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const handleAddToCart = () => {
    notifyCartAdded(quantity, { name: `${product.name} · ${selectedColor}, ${selectedSize}` });
    onClose();
  };

  const totalPrice = product.price * quantity;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 app-safe-pad bg-black/60 backdrop-blur-sm z-[110] animate-fadeIn"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[111] rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slideUp"
        style={{ 
          background: isDark ? '#1a1a1a' : '#ffffff',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div 
            className="w-12 h-1.5 rounded-full"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
          />
        </div>

        <div className="px-4 pb-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6 pb-6" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
            {product.image && (
              <img 
                src={product.image} 
                alt={product.name}
                className="w-20 h-20 rounded-xl object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">{product.name}</h3>
              <p className="text-2xl font-bold" style={{ color: accentColor.color }}>
                {totalPrice.toLocaleString()} so'm
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold">Rang</h4>
              <span style={{ color: accentColor.color }}>{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className="px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95"
                  style={{
                    background: selectedColor === color 
                      ? accentColor.color 
                      : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: selectedColor === color 
                      ? '#ffffff' 
                      : isDark ? '#ffffff' : '#000000'
                  }}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold">O'lcham</h4>
              <span style={{ color: accentColor.color }}>{selectedSize}</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className="aspect-square rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center"
                  style={{
                    background: selectedSize === size 
                      ? accentColor.color 
                      : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: selectedSize === size 
                      ? '#ffffff' 
                      : isDark ? '#ffffff' : '#000000'
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity Selection */}
          <div className="mb-6">
            <h4 className="font-bold mb-3">Miqdor</h4>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                disabled={quantity <= 1}
                className="w-14 h-14 rounded-xl flex items-center justify-center transition-all active:scale-95"
                style={{ 
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  opacity: quantity <= 1 ? 0.5 : 1
                }}
              >
                <Minus className="w-6 h-6" />
              </button>
              <div 
                className="flex-1 h-14 rounded-xl flex items-center justify-center font-bold text-2xl"
                style={{ 
                  background: `${accentColor.color}15`,
                  color: accentColor.color
                }}
              >
                {quantity}
              </div>
              <button
                onClick={() => setQuantity(prev => Math.min(product.stockQuantity || 99, prev + 1))}
                disabled={quantity >= (product.stockQuantity || 99)}
                className="w-14 h-14 rounded-xl flex items-center justify-center transition-all active:scale-95"
                style={{ 
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  opacity: quantity >= (product.stockQuantity || 99) ? 0.5 : 1
                }}
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-3"
            style={{ 
              background: accentColor.color,
              color: '#ffffff'
            }}
          >
            <ShoppingCart className="w-6 h-6" />
            Savatga qo'shish - {totalPrice.toLocaleString()} so'm
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
}