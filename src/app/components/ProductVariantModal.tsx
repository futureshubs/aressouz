import { X, Plus, Minus, ShoppingCart, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { notifyCartAdded } from '../utils/appToast';
import { getVariantStockQuantity } from '../utils/cartStock';
import { evaluateMerchantHours } from '../utils/businessHoursClient';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  categoryId: string;
  catalogId: string;
  rating: number;
  // Real data from branch products
  stockCount?: number;
  oldPrice?: number;
  description?: string;
  recommendation?: string;
  barcode?: string;
  sku?: string;
  video?: string;
  specs?: { name: string; value: string }[];
  variants?: {
    id: string;
    name: string;
    image?: string;
    price: number;
    oldPrice?: number;
    stockCount?: number;
  }[];
  branchName?: string;
  branchId?: string;
}

interface ProductVariant {
  id: string;
  weight: string;
  price: number;
  oldPrice: number;
  discount: number;
  stockCount: number;
}

interface ProductVariantModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, variantId?: string, variantName?: string) => void;
  /** Bo‘lsa — barcha variantlar bitta setState bilan qo‘shiladi (alohida qatorlar) */
  onAddMultipleLines?: (
    product: Product,
    lines: { variantId: string; variantName: string; quantity: number }[],
  ) => void;
  source?: 'market' | 'shop';
  /** Market: yetkazib berish zonasi yozuvi (`workingHours`); do‘kon: do‘kon KV */
  merchantHoursRecord?: Record<string, unknown> | null;
}

export const ProductVariantModal = memo(function ProductVariantModal({ 
  product, 
  onClose, 
  onAddToCart,
  onAddMultipleLines,
  source = 'market',
  merchantHoursRecord = null,
}: ProductVariantModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [hoursUiTick, setHoursUiTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setHoursUiTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);
  const hoursEv = useMemo(
    () => evaluateMerchantHours(merchantHoursRecord ?? undefined),
    [merchantHoursRecord, hoursUiTick],
  );

  // Product images gallery - use real variant images
  // Shop products: variants have `images` array and `stock` property
  // Market products: variants have `image` string and `stockCount` property
  const productImages = product.variants && product.variants.length > 0
    ? product.variants
        .map(v => {
          // Support both shop format (images array) and market format (single image)
          if (Array.isArray((v as any).images)) {
            return (v as any).images[0]; // First image from array
          }
          return v.image; // Single image
        })
        .filter((img): img is string => !!img) // Only images that exist
    : [product.image]; // Fallback to main image if no variants

  // If no variant images but have main image, use it
  const finalImages = productImages.length > 0 ? productImages : [product.image];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Use real variants from product, or create default variant
  // Support both shop and market formats
  const variants: ProductVariant[] = product.variants && product.variants.length > 0
    ? product.variants.map(v => {
        const price = v.price || product.price;
        const oldPrice = v.oldPrice || product.oldPrice || Math.round(price * 1.15);
        const discount =
          oldPrice > 0 && oldPrice > price
            ? Math.round(((oldPrice - price) / oldPrice) * 100)
            : 0;
        const stockCount = getVariantStockQuantity(v, product);

        return {
          id: v.id,
          weight: v.name,
          price,
          oldPrice,
          discount,
          stockCount,
        };
      })
    : [{
        id: 'default',
        weight: 'Standart',
        price: product.price,
        oldPrice: product.oldPrice || Math.round(product.price * 1.15),
        discount:
          product.oldPrice && product.oldPrice > product.price
            ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
            : 0,
        stockCount: getVariantStockQuantity(null, product),
      }];

  const totalVariantStock = variants.reduce((s, v) => s + Math.max(0, v.stockCount || 0), 0);
  /** Do‘kon: do‘kon jadvali; market: `merchantHoursRecord` (mas. yetkazish zonasi) berilganda zona jadvali */
  const shopClosedByHours =
    totalVariantStock > 0 &&
    !hoursEv.allowed &&
    (source === 'shop' || merchantHoursRecord != null);

  const [selectedVariant, setSelectedVariant] = useState<string>(variants[0].id);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleImageScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = container.offsetWidth;
    
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setCurrentImageIndex(Math.max(0, currentImageIndex - 1));
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setCurrentImageIndex(Math.min(finalImages.length - 1, currentImageIndex + 1));
    }
  };

  const handleQuantityChange = (variantId: string, delta: number) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;
    
    const currentQty = quantities[variantId] || 0;
    const newQty = currentQty + delta;
    
    // Prevent exceeding stock count
    if (newQty > variant.stockCount) return;
    
    setQuantities(prev => ({
      ...prev,
      [variantId]: Math.max(0, newQty)
    }));
  };

  const handleAddVariantToCart = (variantId: string) => {
    if (shopClosedByHours) {
      const isZone = source === 'market' && merchantHoursRecord != null;
      toast.error(
        hoursEv.label
          ? isZone
            ? `Yetkazib berish zonasi yopiq (${hoursEv.label})`
            : `Do'kon yopiq (${hoursEv.label})`
          : isZone
            ? 'Yetkazib berish zonasi hozir yopiq'
            : "Do'kon hozir yopiq",
      );
      return;
    }
    const variant = variants.find(v => v.id === variantId);
    if (!variant || variant.stockCount === 0) return;
    
    const currentQty = quantities[variantId] || 0;
    
    // Prevent exceeding stock count
    if (currentQty >= variant.stockCount) return;
    
    setQuantities(prev => ({
      ...prev,
      [variantId]: (prev[variantId] || 0) + 1
    }));
  };

  const totalItems = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = Object.entries(quantities).reduce((sum, [variantId, qty]) => {
    const variant = variants.find(v => v.id === variantId);
    return sum + (variant?.price || 0) * qty;
  }, 0);

  const handleFinalAddToCart = () => {
    if (shopClosedByHours) {
      const isZone = source === 'market' && merchantHoursRecord != null;
      toast.error(
        hoursEv.label
          ? isZone
            ? `Yetkazib berish zonasi yopiq (${hoursEv.label})`
            : `Do'kon yopiq (${hoursEv.label})`
          : isZone
            ? 'Yetkazib berish zonasi hozir yopiq'
            : "Do'kon hozir yopiq",
      );
      return;
    }
    const lines = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([variantId, qty]) => {
        const variant = variants.find((v) => v.id === variantId);
        if (!variant) return null;
        return { variantId, variantName: variant.weight, quantity: qty };
      })
      .filter((l): l is { variantId: string; variantName: string; quantity: number } => l != null);

    const totalAdded = lines.reduce((s, l) => s + l.quantity, 0);
    if (totalAdded <= 0) return;

    if (onAddMultipleLines) {
      onAddMultipleLines(product, lines);
    } else {
      lines.forEach((l) => {
        onAddToCart(product, l.quantity, l.variantId, l.variantName);
      });
    }

    notifyCartAdded(totalAdded, { name: product.name });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 app-safe-pad bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(20, 20, 20, 0.98), rgba(10, 10, 10, 0.95))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(20px)',
          maxHeight: '90vh',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div 
            className="w-12 h-1.5 rounded-full"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
          />
        </div>

        {/* Content */}
        <div className="pb-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 60px)' }}>
          {/* Image Gallery with Horizontal Scroll */}
          <div className="relative mb-6">
            <div 
              ref={scrollContainerRef}
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4"
              style={{ 
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {finalImages.map((img, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 snap-center relative"
                  style={{ width: 'calc(100% - 2rem)' }}
                >
                  <img 
                    src={img} 
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-64 object-cover rounded-2xl"
                  />
                  {/* Hit savdo badge on first image */}
                  {index === 0 && (
                    <div 
                      className="absolute top-3 left-3 px-3 py-1.5 rounded-xl text-xs font-bold"
                      style={{
                        background: accentColor.gradient,
                        color: '#ffffff',
                        boxShadow: `0 4px 12px ${accentColor.color}66`,
                      }}
                    >
                      Xit savdo
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            {currentImageIndex > 0 && (
              <button
                onClick={() => handleImageScroll('left')}
                className="absolute left-6 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-md transition-all active:scale-90"
                style={{
                  background: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.9)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                }}
              >
                <ChevronLeft className="size-5" style={{ color: isDark ? '#ffffff' : '#111827' }} />
              </button>
            )}
            
            {currentImageIndex < finalImages.length - 1 && (
              <button
                onClick={() => handleImageScroll('right')}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-md transition-all active:scale-90"
                style={{
                  background: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.9)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                }}
              >
                <ChevronRight className="size-5" style={{ color: isDark ? '#ffffff' : '#111827' }} />
              </button>
            )}

            {/* Image Indicators */}
            <div className="flex justify-center gap-1.5 mt-3">
              {finalImages.map((_, index) => (
                <div
                  key={index}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: index === currentImageIndex ? '24px' : '6px',
                    background: index === currentImageIndex 
                      ? accentColor.color 
                      : isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Product Info Header */}
          <div className="flex gap-4 mb-6 px-4">
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h3 
                  className="font-bold text-xl flex-1"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {product.name}
                </h3>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl transition-all active:scale-90"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <X className="size-5" style={{ color: isDark ? '#ffffff' : '#111827' }} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {product.rating && product.rating > 0 ? (
                  <>
                    <div className="flex items-center gap-1">
                      <svg className="size-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span 
                        className="font-bold text-sm"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        {product.rating.toFixed(1)}
                      </span>
                    </div>
                    {product.reviewCount && product.reviewCount > 0 && (
                      <span 
                        className="text-sm"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        ({product.reviewCount} ta sharh)
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                    <svg className="size-4" fill="none" stroke={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'} viewBox="0 0 20 20">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                    >
                      Hali baholanmagan
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* O'lchamni tanlang */}
          <div className="px-4">
            {shopClosedByHours && hoursEv.label ? (
              <p
                className="text-xs text-center mb-3"
                style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}
              >
                Yopiq — ish vaqti: {hoursEv.label}
              </p>
            ) : null}
            <h4 
              className="font-bold text-lg mb-4"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              O'lchamni tanlang
            </h4>

            {/* Variants List */}
            <div className="space-y-3 mb-6">
              {variants.map((variant, index) => {
                const quantity = quantities[variant.id] || 0;
                const isFirst = index === 0;
                const stockCount = variant.stockCount;
                const isOutOfStock = stockCount === 0;
                const isMaxQuantity = quantity >= stockCount;
                const rowHoursClosed = shopClosedByHours && !isOutOfStock;
                
                return (
                  <div
                    key={variant.id}
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
                      opacity: isOutOfStock ? 0.6 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      {/* Left side - Weight and Price */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 
                            className="font-bold text-sm"
                            style={{ color: isDark ? '#ffffff' : '#111827' }}
                          >
                            {variant.weight}
                          </h5>
                          {/* Stock badge */}
                          <div 
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                            style={{
                              background: isOutOfStock 
                                ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                                : (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'),
                              color: isOutOfStock ? '#ef4444' : '#10b981',
                            }}
                          >
                            {isOutOfStock ? 'Yo\'q' : `${stockCount} dona`}
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span 
                            className="text-lg font-bold"
                            style={{ color: accentColor.color }}
                          >
                            {variant.price.toLocaleString('uz-UZ')} so'm
                          </span>
                          <span 
                            className="text-xs line-through"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
                          >
                            {variant.oldPrice.toLocaleString('uz-UZ')}
                          </span>
                          <span 
                            className="text-xs font-bold"
                            style={{ color: '#ef4444' }}
                          >
                            -{variant.discount}%
                          </span>
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
                            onClick={() => handleQuantityChange(variant.id, -1)}
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
                            onClick={() => handleQuantityChange(variant.id, 1)}
                            disabled={isMaxQuantity || shopClosedByHours}
                            className="p-1 rounded-lg transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              backgroundImage: isMaxQuantity ? 'none' : accentColor.gradient,
                              background: isMaxQuantity ? (isDark ? '#333333' : '#d1d5db') : undefined,
                            }}
                          >
                            <Plus 
                              className="size-4" 
                              style={{ color: isMaxQuantity ? (isDark ? '#666666' : '#9ca3af') : '#ffffff' }} 
                              strokeWidth={2.5} 
                            />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddVariantToCart(variant.id)}
                          disabled={isOutOfStock || rowHoursClosed}
                          className="px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2 justify-center min-w-[7rem] disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            backgroundImage: isOutOfStock || rowHoursClosed ? 'none' : accentColor.gradient,
                            background:
                              isOutOfStock || rowHoursClosed
                                ? isDark
                                  ? '#666666'
                                  : '#9ca3af'
                                : undefined,
                            color: '#ffffff',
                            boxShadow:
                              isOutOfStock || rowHoursClosed ? 'none' : `0 4px 12px ${accentColor.color}66`,
                          }}
                        >
                          {isOutOfStock ? (
                            <>
                              <ShoppingCart className="size-4" strokeWidth={2.5} />
                              <span>Tugadi</span>
                            </>
                          ) : rowHoursClosed ? (
                            <Clock className="size-4" strokeWidth={2.5} aria-label="Yopiq" />
                          ) : (
                            <>
                              <ShoppingCart className="size-4" strokeWidth={2.5} />
                              <span>Savatga</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    
                    {/* Stock warning when max reached */}
                    {quantity > 0 && isMaxQuantity && stockCount > 0 && (
                      <div 
                        className="mt-2 pt-2 border-t"
                        style={{
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <p 
                          className="text-[10px] font-semibold text-center"
                          style={{ color: '#ef4444' }}
                        >
                          ⚠️ Omborda faqat {stockCount} dona mavjud
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Section - Total and Add to Cart */}
            {totalItems > 0 && (
              <div className="space-y-3">
                {/* Total */}
                <div className="flex items-center justify-between">
                  <p 
                    className="text-sm"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Jami {totalItems} ta mahsulot
                  </p>
                  <p 
                    className="text-2xl font-bold"
                    style={{ color: accentColor.color }}
                  >
                    {totalPrice.toLocaleString('uz-UZ')} so'm
                  </p>
                </div>

                {/* Add to Cart Button */}
                <button
                  type="button"
                  onClick={handleFinalAddToCart}
                  disabled={shopClosedByHours}
                  className="w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundImage: shopClosedByHours ? 'none' : accentColor.gradient,
                    background: shopClosedByHours ? (isDark ? '#666666' : '#9ca3af') : undefined,
                    color: '#ffffff',
                    boxShadow: shopClosedByHours ? 'none' : `0 8px 24px ${accentColor.color}80`,
                  }}
                >
                  {shopClosedByHours ? (
                    <Clock className="size-6" strokeWidth={2.5} aria-label="Yopiq" />
                  ) : (
                    <>
                      <ShoppingCart className="size-6" strokeWidth={2.5} />
                      <span>Savatga qo'shish ({totalItems})</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Empty state hint */}
            {totalItems === 0 && (
              <p 
                className="text-center text-sm py-4"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
              >
                O'lchamni tanlang va savatga qo'shing
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
});