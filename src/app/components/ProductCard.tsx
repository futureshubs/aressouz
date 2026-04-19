import { ShoppingCart, Star, TrendingUp, Package, Heart, Calendar, Tag } from 'lucide-react';
import { useState, memo, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useFavorites } from '../context/FavoritesContext';
import { ProductVariantModal } from './ProductVariantModal';
import { CardImageScroll } from './CardImageScroll';
import { collectProductGalleryImages } from '../utils/cardGalleryImages';

interface Product {
  id: number;
  productUuid?: string;
  name: string;
  price: number;
  image: string;
  /** Bir nechta rasm (market / API) */
  images?: string[];
  categoryId: string;
  catalogId: string;
  rating: number;
  variants?: {
    id: string;
    name: string;
    price: number;
    oldPrice: number;
    images: string[];
  }[];
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity?: number, variantId?: string, variantName?: string) => void;
  onAddVariantLinesBatch?: (
    product: Product,
    lines: { variantId: string; variantName: string; quantity: number }[],
  ) => void;
  onProductClick?: (product: Product) => void;
  source?: 'market' | 'shop';
}

export const ProductCard = memo(function ProductCard({
  product,
  onAddToCart,
  onAddVariantLinesBatch,
  onProductClick,
  source = 'market',
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const skipCardOpenRef = useRef(false);
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const { isFavorite, toggleFavorite } = useFavorites();

  // Handle variants - if product has variants, use first variant's data
  const hasVariants = product.variants && product.variants.length > 0;
  const firstVariant = hasVariants ? product.variants[0] : null;
  const galleryImages = collectProductGalleryImages(product);
  const displayImage = hasVariants ? (firstVariant?.images?.[0] || product.image) : product.image;
  const imageStrip =
    galleryImages.length > 0 ? galleryImages : displayImage ? [displayImage] : [];
  const displayPrice = hasVariants ? (firstVariant?.price || product.price) : product.price;
  const displayOldPrice = hasVariants && firstVariant?.oldPrice > 0 ? firstVariant.oldPrice : null;
  
  // Calculate discount
  const discount = displayOldPrice ? Math.round((1 - displayPrice / displayOldPrice) * 100) : 15;
  const oldPrice = displayOldPrice || Math.round(displayPrice / (1 - discount / 100));

  // Android Material Design Card - Modern Premium Version
  return (
    <>
      <div
        className="group relative transition-all duration-500"
        style={{
          transform:
            source === 'shop'
              ? isHovered
                ? 'translateY(-4px) scale(1.02)'
                : 'translateY(0) scale(1)'
              : isHovered
                ? 'translateY(-12px) scale(1.03)'
                : 'translateY(0) scale(1)',
          transformStyle: 'preserve-3d',
          perspective: '1000px',
        }}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        {/* Multiple 3D Shadow Layers */}
        <div 
          className="absolute inset-0 rounded-2xl transition-all duration-500"
          style={{
            background: `linear-gradient(145deg, ${accentColor.color}66, ${accentColor.color}4d)`,
            filter: isDark ? 'blur(25px)' : 'blur(10px)',
            opacity: isHovered ? (isDark ? 0.9 : 0.4) : (isDark ? 0.5 : 0.2),
            transform: 'translateZ(-15px) scale(0.92)',
          }}
        />
        
        <div 
          className="absolute inset-0 rounded-2xl"
          style={{
            boxShadow: isDark
              ? (isHovered
                ? `0 35px 70px rgba(0, 0, 0, 0.9), 0 20px 40px rgba(0, 0, 0, 0.7), 0 10px 20px rgba(0, 0, 0, 0.5), 0 0 0 1px ${accentColor.color}66`
                : '0 20px 40px rgba(0, 0, 0, 0.7), 0 10px 20px rgba(0, 0, 0, 0.5), 0 5px 10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)')
              : (isHovered
                ? `0 16px 32px rgba(0, 0, 0, 0.18), 0 8px 16px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px ${accentColor.color}33`
                : '0 8px 20px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.08)'),
            transition: 'all 0.5s ease',
          }}
        />

        {/* Main Card with Glass Effect */}
        <div 
          onClick={() => {
            if (skipCardOpenRef.current) return;
            onProductClick?.(product);
          }}
          className="relative rounded-2xl overflow-hidden cursor-pointer"
          style={{
            background: isDark 
              ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.95), rgba(10, 10, 10, 0.98))'
              : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
            backdropFilter: isDark ? 'blur(20px)' : 'blur(10px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: isDark 
              ? 'inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.5)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
          }}
        >
          {/* Animated Shine Effect */}
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, transparent 30%, rgba(20, 184, 166, 0.2) 50%, transparent 70%)',
              transform: 'translateX(-100%)',
              animation: isHovered ? 'shine 2s ease-in-out' : 'none',
            }}
          />

          {/* Glow effect on hover */}
          {isHovered && (
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.25), transparent 70%)',
              }}
            />
          )}

          {/* Image — kvadrat (1:1), rasm to‘liq ko‘rinsin (contain) */}
          <div className="relative aspect-square w-full max-w-[500px] mx-auto overflow-hidden bg-gradient-to-br from-zinc-900 to-black">
            {imageStrip.length > 1 ? (
              <CardImageScroll
                images={imageStrip}
                alt={product.name}
                dotColor={accentColor.color}
                onUserInteracted={() => {
                  skipCardOpenRef.current = true;
                  window.setTimeout(() => {
                    skipCardOpenRef.current = false;
                  }, 400);
                }}
                imgClassName="h-full w-full object-contain"
              />
            ) : (
              <img
                src={displayImage}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain transition-all duration-500"
                style={{
                  transform:
                    source === 'shop'
                      ? isHovered
                        ? 'scale(1.06) rotate(1deg)'
                        : 'scale(1) rotate(0deg)'
                      : isHovered
                        ? 'scale(1.15) rotate(3deg)'
                        : 'scale(1) rotate(0deg)',
                }}
              />
            )}
            
            {/* Multiple Gradient Overlays for Depth */}
            <div 
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"
              style={{
                opacity: isHovered ? 0.8 : 0.6,
                transition: 'opacity 0.3s',
              }}
            />
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(20, 184, 166, 0.2), transparent 60%)',
              }}
            />

            {/* Top Badges Row */}
            <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1.5 z-10">
              <div className="flex items-start gap-1.5">
                {/* Source Badge (Shop/Market) - 3D */}
                <div 
                  className="px-2 py-1 rounded-lg backdrop-blur-xl font-bold text-[10px] transition-all duration-300"
                  style={{
                    background: source === 'shop' 
                      ? 'linear-gradient(145deg, #8b5cf6, #7c3aed)'
                      : `linear-gradient(145deg, ${accentColor.color}, ${accentColor.color}dd)`,
                    boxShadow: isHovered 
                      ? (source === 'shop'
                        ? '0 8px 20px rgba(139, 92, 246, 0.7), 0 4px 12px rgba(139, 92, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
                        : `0 8px 20px ${accentColor.color}b3, 0 4px 12px ${accentColor.color}80, inset 0 1px 0 rgba(255, 255, 255, 0.4)`)
                      : (source === 'shop'
                        ? '0 4px 12px rgba(139, 92, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                        : `0 4px 12px ${accentColor.color}80, inset 0 1px 0 rgba(255, 255, 255, 0.3)`),
                    transform: isHovered ? 'translateY(-3px) translateZ(10px)' : 'translateY(0)',
                  }}
                >
                  <span className="text-white drop-shadow-lg">
                    {source === 'shop' ? 'Do\'kon' : 'Market'}
                  </span>
                </div>
                
                {/* Discount Badge - 3D */}
                {discount > 0 && (
                  <div 
                    className="px-2 py-1 rounded-lg backdrop-blur-xl font-bold text-[10px] transition-all duration-300"
                    style={{
                      background: 'linear-gradient(145deg, #ef4444, #dc2626)',
                      boxShadow: isHovered 
                        ? '0 8px 20px rgba(239, 68, 68, 0.7), 0 4px 12px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
                        : '0 4px 12px rgba(239, 68, 68, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                      transform: isHovered ? 'translateY(-3px) translateZ(10px)' : 'translateY(0)',
                    }}
                  >
                    <span className="text-white drop-shadow-lg">-{discount}%</span>
                  </div>
                )}
              </div>

              {/* Like Button - 3D Glass */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(product);
                }}
                className="ml-auto p-1.5 rounded-lg backdrop-blur-xl transition-all active:scale-90 duration-300"
                style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: isHovered
                    ? '0 8px 16px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                    : '0 4px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transform: isHovered ? 'translateY(-3px) translateZ(10px)' : 'translateY(0)',
                }}
              >
                <Heart
                  className="size-4"
                  fill={isFavorite(product.id) ? '#ef4444' : 'none'}
                  stroke={isFavorite(product.id) ? '#ef4444' : 'white'}
                  strokeWidth={2.5}
                  style={{
                    filter: isFavorite(product.id) ? 'drop-shadow(0 0 10px rgba(239, 68, 68, 1))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))',
                  }}
                />
              </button>
            </div>

            {/* Rating Badge - 3D Glass */}
            <div 
              className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-xl transition-all duration-300"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: isHovered
                  ? '0 8px 16px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  : '0 4px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                transform: isHovered ? 'translateY(-3px) translateZ(10px)' : 'translateY(0)',
              }}
            >
              <svg className="size-3.5 text-yellow-400 drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-[10px] text-white font-bold drop-shadow-lg">{product.rating}.0</span>
            </div>
          </div>

          {/* Content Section - 3D Layer */}
          <div 
            className="relative p-2.5 sm:p-3"
            style={{
              background: isDark 
                ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6))'
                : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.92), rgba(250, 250, 250, 0.95))',
              boxShadow: isDark 
                ? 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                : 'inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.03)',
            }}
          >
            {/* Title */}
            <h3 
              className="text-xs sm:text-sm mb-2 line-clamp-2 h-8 sm:h-9 leading-4 font-medium drop-shadow-md"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              {product.name}
            </h3>

            {/* Price Section */}
            <div className="flex items-end justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                {/* Old Price */}
                {discount > 0 && (
                  <p 
                    className="text-[10px] sm:text-xs line-through mb-0.5 drop-shadow"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.35)' }}
                  >
                    {oldPrice.toLocaleString('uz-UZ')} so'm
                  </p>
                )}
                
                {/* Current Price */}
                <div className="flex items-baseline gap-1 mb-1.5">
                  <p 
                    className="text-base sm:text-lg font-bold truncate drop-shadow-lg"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {displayPrice.toLocaleString('uz-UZ')}
                  </p>
                  <p 
                    className="text-[10px] sm:text-xs flex-shrink-0"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                  >
                    so'm
                  </p>
                </div>

                {/* Installment Badge - 3D Glass */}
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg backdrop-blur-sm transition-all duration-300"
                  style={{
                    background: isDark
                      ? `linear-gradient(135deg, ${accentColor.color}33, ${accentColor.color}1a)`
                      : `linear-gradient(135deg, ${accentColor.color}26, ${accentColor.color}13)`,
                    border: isDark 
                      ? `1px solid ${accentColor.color}66`
                      : `1px solid ${accentColor.color}4d`,
                    boxShadow: isDark 
                      ? `0 2px 8px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.1)`
                      : `0 2px 6px ${accentColor.color}33, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                  }}
                >
                  <Calendar className="size-3 drop-shadow-lg" style={{ color: accentColor.color }} strokeWidth={2.5} />
                  <span className="text-[10px] sm:text-xs font-bold drop-shadow-lg" style={{ color: accentColor.color }}>
                    {Math.round(displayPrice / 12).toLocaleString('uz-UZ')} x 12
                  </span>
                </div>
              </div>

              {/* Add to Cart Button - 3D Premium */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all active:scale-90 flex-shrink-0 duration-300"
                style={{
                  backgroundImage: accentColor.gradient,
                  boxShadow: isHovered 
                    ? (isDark
                      ? `0 12px 28px ${accentColor.color}b3, 0 6px 14px ${accentColor.color}80, 0 0 0 2px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.3)`
                      : `0 8px 20px ${accentColor.color}80, 0 4px 10px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.6)`)
                    : (isDark
                      ? `0 6px 16px ${accentColor.color}80, 0 3px 8px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                      : `0 4px 12px ${accentColor.color}66, 0 2px 6px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.5)`),
                  transform: isHovered ? 'translateY(-2px) translateZ(5px)' : 'translateY(0)',
                }}
              >
                <ShoppingCart 
                  className="size-4 sm:size-5 text-white" 
                  strokeWidth={2.5}
                  style={{
                    filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))',
                  }}
                />
              </button>
            </div>

            {/* Bottom Info Bar - 3D */}
            <div 
              className="flex items-center justify-between pt-2 border-t transition-colors duration-300"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              }}
            >
              <div className="flex items-center gap-1">
                <Tag className="size-3 drop-shadow-lg" style={{ color: accentColor.color }} strokeWidth={2.5} />
                <span 
                  className="text-[10px] sm:text-xs font-medium drop-shadow"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Tez yetkazish
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-semibold drop-shadow-lg" style={{ color: accentColor.color }}>15 minut</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal */}
      {isModalOpen && (
        <ProductVariantModal
          product={product}
          onClose={() => setIsModalOpen(false)}
          onAddToCart={(prod, quantity, variantId, variantName) => {
            onAddToCart(prod, quantity, variantId, variantName);
          }}
          onAddMultipleLines={onAddVariantLinesBatch}
          source={source}
        />
      )}
    </>
  );
});