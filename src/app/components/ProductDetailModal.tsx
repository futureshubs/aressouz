import { X, Plus, Minus, Star, ShoppingCart, Clock, Truck, Shield, Heart, Share2, Calendar, Check, Package, CreditCard, Store, MessageCircle, Gift, RotateCcw, Box, ThumbsUp, ThumbsDown, Send, Image as ImageIcon, User, Wallet, Banknote, Loader2 } from 'lucide-react';
import { useState, memo, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useFavorites } from '../context/FavoritesContext';
import { toast } from 'sonner';
import { notifyCartAdded } from '../utils/appToast';
import { projectId } from '/utils/supabase/info';
import { buildUserHeaders, buildAdminHeaders, getStoredAdminSessionToken } from '../utils/requestAuth';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { shareTitleTextUrl } from '../utils/marketplaceNativeBridge';
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
    images?: string[]; // Multiple images for shop products
    price: number;
    stockQuantity?: number;
    oldPrice?: number;
    barcode?: string;
    sku?: string;
    video?: string;
    attributes?: { name: string; value: string }[];
  }[];
  branchName?: string;
  branchId?: string;
  /** Filial mahsuloti KV kaliti: UUID yoki `prod_<timestamp>` */
  productUuid?: string;
}

interface ProductDetailModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, variantId?: string, variantName?: string) => void;
  source?: 'market' | 'shop';
  storeName?: string;
  /** Do‘kon mahsuloti: API `shop` yozuvi — ish vaqti (workingHours, workTime, …) */
  merchantHoursRecord?: Record<string, unknown> | null;
  cartItems?: { id: number; selectedVariantId?: string; quantity: number }[]; // Cart tracking
  onUpdateQuantity?: (id: number, quantity: number, variantId?: string) => void;
  onRemoveItem?: (id: number, variantId?: string) => void;
}

interface ProductReview {
  id: number;
  productId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  text: string;
  date: string;
  likes: number;
  dislikes: number;
  replies: any[];
  userLiked?: boolean;
  userDisliked?: boolean;
  hidden?: boolean;
}

export const ProductDetailModal = memo(function ProductDetailModal({ 
  product, 
  isOpen, 
  onClose, 
  onAddToCart,
  source = 'market',
  storeName,
  merchantHoursRecord = null,
  cartItems,
  onUpdateQuantity,
  onRemoveItem
}: ProductDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [hoursUiTick, setHoursUiTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setHoursUiTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);
  const [isAdmin, setIsAdmin] = useState(false);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    // Admin code faqat adminSession mavjud bo'lsa yoqiladi.
    // Bu UI faqat ma'lumot uchun; backend ham qayta tekshiradi.
    setIsAdmin(Boolean(getStoredAdminSessionToken()));
  }, []);

  const [quantity, setQuantity] = useState(0); // Start at 0 like Market section
  const [isInCart, setIsInCart] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews'>('description');
  const { isFavorite, toggleFavorite } = useFavorites();
  
  // Touch/swipe state for image gallery
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // For cycling through images in shop products
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Reviews state
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [moderatingReviewId, setModeratingReviewId] = useState<number | null>(null);
  const averageRating =
    reviews.length > 0
      ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1))
      : Number(product.rating || 0);
  const totalReviews = reviews.length;

  // Reset image index and quantity when variant changes (Market section style)
  useEffect(() => {
    setCurrentImageIndex(0);
    setQuantity(0); // Reset quantity to 0 when variant changes
  }, [selectedVariant]);

  // Sync cart state with cartItems prop
  useEffect(() => {
    if (!cartItems || !product) return;

    // Get current variant ID
    const currentVariantId = product.variants?.[selectedVariant]?.id || '0';
    
    // Find cart item with matching product ID and variant ID
    const cartItem = cartItems.find(item => 
      item.id === product.id && 
      (item.selectedVariantId === currentVariantId || (!item.selectedVariantId && currentVariantId === '0'))
    );

    if (cartItem) {
      setIsInCart(true);
      setQuantity(cartItem.quantity);
    } else {
      setIsInCart(false);
      // Keep user-selected quantity while modal is open; otherwise + click collapses quantity UI.
      setQuantity((prev) => (prev > 0 ? prev : 0));
    }
  }, [cartItems, product, selectedVariant]);

  // Load reviews from API
  useEffect(() => {
    const loadReviews = async () => {
      setReviewsLoading(true);
      try {
        const includeHidden = isAdmin ? '?includeHidden=1' : '';
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/products/${encodeURIComponent(String(product.id))}/reviews${includeHidden}`,
          { headers: isAdmin ? buildAdminHeaders() : buildUserHeaders() }
        );
        const result = await response.json();
        if (response.ok && result?.success) {
          setReviews(Array.isArray(result.reviews) ? result.reviews : []);
        }
      } catch (error) {
        console.error('Failed to load reviews from API:', error);
      } finally {
        setReviewsLoading(false);
      }
    };
    loadReviews();
  }, [product.id, isAdmin, visibilityRefetchTick]);

  // Review handlers
  const handleSubmitReview = async () => {
    if (!newReviewText.trim()) return;
    setReviewSubmitting(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/products/${encodeURIComponent(String(product.id))}/reviews`,
        {
          method: 'POST',
          headers: buildUserHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            rating: newReviewRating,
            text: newReviewText.trim(),
          }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result?.success) {
        toast.error(result?.error || 'Sharh yuborilmadi');
        return;
      }

      setReviews((prev) => [result.review, ...prev]);
      setNewReviewText('');
      setNewReviewRating(5);
      toast.success('Sharh yuborildi');
    } catch (error) {
      console.error('Submit review error:', error);
      toast.error('Sharh yuborishda xatolik');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleLikeReview = (reviewId: number) => {
    setReviews(reviews.map(review => {
      if (review.id === reviewId) {
        if (review.userLiked) {
          return { ...review, likes: review.likes - 1, userLiked: false };
        } else if (review.userDisliked) {
          return { ...review, likes: review.likes + 1, dislikes: review.dislikes - 1, userLiked: true, userDisliked: false };
        } else {
          return { ...review, likes: review.likes + 1, userLiked: true };
        }
      }
      return review;
    }));
  };

  const handleDislikeReview = (reviewId: number) => {
    setReviews(reviews.map(review => {
      if (review.id === reviewId) {
        if (review.userDisliked) {
          return { ...review, dislikes: review.dislikes - 1, userDisliked: false };
        } else if (review.userLiked) {
          return { ...review, dislikes: review.dislikes + 1, likes: review.likes - 1, userDisliked: true, userLiked: false };
        } else {
          return { ...review, dislikes: review.dislikes + 1, userDisliked: true };
        }
      }
      return review;
    }));
  };

  const handleModerateReview = async (reviewId: number, action: 'hide' | 'restore' | 'delete') => {
    if (!isAdmin) return;

    if (action === 'delete') {
      const ok = window.confirm('Sharhni o‘chirmoqchimisiz? Bu qaytarilmaydi.');
      if (!ok) return;
    }

    setModeratingReviewId(reviewId);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/products/${encodeURIComponent(
          String(product.id)
        )}/reviews/${encodeURIComponent(String(reviewId))}/moderate`,
        {
          method: 'PATCH',
          headers: buildAdminHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ action }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result?.success) {
        toast.error(result?.error || 'Moderatsiya bajarilmadi');
        return;
      }

      // Refresh reviews list (admin uchun hidden ham ko'rinadi)
      setReviewsLoading(true);
      try {
        const response2 = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/products/${encodeURIComponent(
            String(product.id)
          )}/reviews?includeHidden=1`,
          { headers: buildAdminHeaders() }
        );
        const result2 = await response2.json();
        if (response2.ok && result2?.success) {
          setReviews(Array.isArray(result2.reviews) ? result2.reviews : []);
        }
      } finally {
        setReviewsLoading(false);
      }
    } catch (error) {
      console.error('Moderate review error:', error);
      toast.error('Moderatsiya xatolik yuz berdi');
    } finally {
      setModeratingReviewId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  if (!isOpen) return null;

  const readVariantStock = (v: any): number => {
    return getVariantStockQuantity(v ?? null, product);
  };

  const readVariantSoldTotal = (v: any | null): number => {
    const raw =
      v != null
        ? (v.soldCount ?? v.soldThisWeek)
        : (product as { soldCount?: unknown; soldThisWeek?: unknown }).soldCount ??
          (product as { soldThisWeek?: unknown }).soldThisWeek;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  // Variants - use real variants if available (do‘kon: variant.stock; market: stockQuantity/stockCount)
  const variants = product.variants && product.variants.length > 0
    ? product.variants.map((v, idx) => ({
        id: idx,
        label: v.name,
        image: v.image || v.images?.[0] || product.image, // First image as thumbnail
        images: v.images || [v.image || product.image], // Multiple images for shop products
        price: v.price,
        stockQuantity: readVariantStock(v),
        soldTotal: readVariantSoldTotal(v),
        oldPrice: v.oldPrice ?? product.oldPrice,
        barcode: v.barcode ?? product.barcode,
        sku: v.sku ?? product.sku,
        video: v.video ?? product.video,
        attributes: v.attributes ?? [],
        variantId: v.id
      }))
    : [{ 
        id: 0, 
        label: 'Standart', 
        image: product.image,
        images: [product.image], // Single image wrapped in array
        price: product.price, 
        stockQuantity: readVariantStock(null),
        soldTotal: readVariantSoldTotal(null),
        oldPrice: product.oldPrice,
        barcode: product.barcode,
        sku: product.sku,
        video: product.video,
        attributes: [],
        variantId: '0' 
      }];

  // DEBUG: Log variant data
  console.log('📦 Product Variants:', product.variants);
  console.log('🎨 Processed Variants:', variants);
  console.log('🔢 Selected Variant Index:', selectedVariant);

  // Get current variant - ALL data from selected variant
  const currentVariant = variants[selectedVariant] || variants[0];
  const currentPrice = currentVariant.price;
  const currentImages = currentVariant.images || [currentVariant.image]; // Images array
  const currentImage = currentImages[currentImageIndex] || currentImages[0]; // Current image based on index
  const currentStockCount = currentVariant.stockQuantity;
  const currentOldPrice = currentVariant.oldPrice || Math.round(currentPrice * 1.15);
  const currentBarcode = currentVariant.barcode;
  const currentSku = currentVariant.sku;
  const currentVideo = currentVariant.video;
  const currentAttributes = currentVariant.attributes;

  console.log('✨ Current Variant:', currentVariant);
  console.log('💰 Current Price:', currentPrice, 'Old Price:', currentOldPrice);
  console.log('📦 Current Stock:', currentStockCount);
  console.log('🖼️ Current Images:', currentImages, 'Index:', currentImageIndex);

  // Calculate prices - use variant's oldPrice if available
  const oldPrice = currentOldPrice;
  const totalPrice = currentPrice * quantity;
  const monthlyPayment = Math.round(totalPrice / 12);

  // Stock info - use variant's stockQuantity
  const stockCount = currentStockCount;
  const soldTotal = (currentVariant as { soldTotal?: number }).soldTotal ?? 0;

  const hoursEv = useMemo(
    () => evaluateMerchantHours(merchantHoursRecord ?? undefined),
    [merchantHoursRecord, hoursUiTick],
  );
  const shopClosedByHours = source === 'shop' && stockCount > 0 && !hoursEv.allowed;

  // Specs - use variant attributes if available, otherwise product specs
  const displaySpecs = currentAttributes.length > 0 ? currentAttributes : (product.specs || []);

  // Features
  const features = [
    { icon: Truck, label: 'Yetkazib berish', value: "5000 so'mdan" },
    { icon: Shield, label: 'Kafolat', value: '1 kun' },
    { icon: RotateCcw, label: 'Qaytarish', value: '10 minut' },
    { icon: Gift, label: 'O\'rash', value: 'Bepul' },
  ];

  // Swipe handlers for image gallery
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    // Get current images array
    const currentImages = currentVariant.images || [currentVariant.image];
    
    // For shop products with multiple images - cycle through images
    if (source === 'shop' && currentImages.length > 1) {
      if (isLeftSwipe) {
        // Next image
        setCurrentImageIndex((prev) => (prev + 1) % currentImages.length);
      }
      if (isRightSwipe) {
        // Previous image
        setCurrentImageIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
      }
    } else {
      // For market products or single images - switch variants
      if (isLeftSwipe && selectedVariant < variants.length - 1) {
        setSelectedVariant(selectedVariant + 1);
      }
      if (isRightSwipe && selectedVariant > 0) {
        setSelectedVariant(selectedVariant - 1);
      }
    }
  };

  const handleAddToCart = () => {
    if (shopClosedByHours) {
      toast.error(hoursEv.label ? `Do‘kon yopiq. Ish vaqti: ${hoursEv.label}` : 'Do‘kon hozir buyurtma qabul qilmaydi');
      return;
    }
    // If quantity is 0, set it to 1 (keyingi bosishda pastdagi tugma bilan savatga)
    if (quantity === 0) {
      setQuantity(1);
      toast.success(`1 ta tanlandi — pastdagi «Savatga qo'shish» tugmasini bosing`);
      console.log('🛒 First click - setting quantity to 1');
      return;
    }
    // Otherwise add to cart with current quantity
    console.log('🛒 Adding to cart:', { product, quantity, variantId: currentVariant.variantId, variantName: currentVariant.label });
    onAddToCart(product, quantity, currentVariant.variantId, currentVariant.label);
  };

  const handleIncrement = () => {
    console.log('➕ Increment clicked:', { quantity, stockCount, hasUpdateFn: !!onUpdateQuantity });
    if (quantity >= stockCount) {
      toast.error(`Omborda faqat ${stockCount} dona mavjud`);
      console.warn('⚠️ Cannot increment - stock limit reached');
      return;
    }
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    console.log('✅ Incremented quantity:', { newQuantity });
    if (onUpdateQuantity) {
      onUpdateQuantity(product.id, newQuantity, currentVariant.variantId);
    }
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
    const text = `${product.name} — ${currentPrice.toLocaleString('uz-UZ')} so'm`;
    await shareTitleTextUrl({
      title: product.name,
      text,
      url,
      toast,
    });
  };

  const handleDecrement = () => {
    console.log('➖ Decrement clicked:', { quantity, hasUpdateFn: !!onUpdateQuantity, hasRemoveFn: !!onRemoveItem });
    if (quantity > 1) {
      const newQuantity = quantity - 1;
      setQuantity(newQuantity);
      console.log('✅ Decremented quantity:', { newQuantity });
      if (onUpdateQuantity) {
        onUpdateQuantity(product.id, newQuantity, currentVariant.variantId);
      }
    } else if (quantity === 1) {
      // Set to 0 instead of removing (Market section behavior)
      setQuantity(0);
      toast.info(`${product.name} savatdan olib tashlandi`);
      console.log('🔄 Quantity set to 0');
      if (onRemoveItem) {
        onRemoveItem(product.id, currentVariant.variantId);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-[100] flex items-end sm:items-center justify-center overflow-hidden"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <div 
        className="relative w-full sm:max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto flex flex-col h-[95dvh] max-h-[calc(100dvh-var(--app-safe-top)-var(--app-safe-bottom))] sm:h-auto sm:max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl min-h-0"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="shrink-0 z-20 flex items-center justify-between p-3 sm:p-4"
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
          }}
        >
          <button
            onClick={onClose}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{
              background: isDark ? '#1a1a1a' : '#f3f4f6',
            }}
          >
            <X className="size-5 sm:size-6" style={{ color: isDark ? '#ffffff' : '#111827' }} strokeWidth={2} />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                const was = isFavorite(product.id);
                toggleFavorite(product);
                toast.success(
                  was ? 'Sevimlilardan olib tashlandi' : 'Sevimlilarga qo‘shildi',
                );
              }}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{
                background: isDark ? '#1a1a1a' : '#f3f4f6',
              }}
              aria-label={isFavorite(product.id) ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga qo‘shish'}
            >
              <Heart
                className="size-4 sm:size-5"
                fill={isFavorite(product.id) ? '#ef4444' : 'none'}
                stroke={isFavorite(product.id) ? '#ef4444' : (isDark ? '#ffffff' : '#111827')}
                strokeWidth={2}
              />
            </button>
            <button
              type="button"
              onClick={() => void handleShareProduct()}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{
                background: isDark ? '#1a1a1a' : '#f3f4f6',
              }}
              aria-label="Ulashish"
            >
              <Share2 className="size-4 sm:size-5" style={{ color: isDark ? '#ffffff' : '#111827' }} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
        {/* Content */}
        <div className="px-3 sm:px-4 md:px-6 pb-4 sm:pb-6">
          {/* Store Badge - New */}
          {source === 'shop' && storeName && (
            <div 
              className="mb-3 sm:mb-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2"
              style={{
                borderColor: '#8b5cf6',
                background: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full sm:rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(145deg, #8b5cf6, #7c3aed)',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                  }}
                >
                  <Store className="size-5 sm:size-6 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p 
                    className="text-[10px] sm:text-xs font-semibold mb-0.5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Do'kon:
                  </p>
                  <p 
                    className="text-sm sm:text-base font-bold"
                    style={{ color: '#8b5cf6' }}
                  >
                    {storeName}
                  </p>
                </div>
                <div 
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg backdrop-blur-xl font-bold text-[10px] sm:text-xs"
                  style={{
                    background: 'linear-gradient(145deg, #8b5cf6, #7c3aed)',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                  }}
                >
                  <span className="text-white drop-shadow-lg">Do'kon</span>
                </div>
              </div>
            </div>
          )}

          {/* Main Image — 500×500 kvadrat, rasm to‘liq */}
          <div 
            className="relative w-full max-w-[500px] aspect-square rounded-xl sm:rounded-2xl overflow-hidden mb-3 sm:mb-4 mx-auto"
            style={{
              background: isDark ? '#1a1a1a' : '#f9fafb',
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img 
              src={currentImage} 
              alt={product.name}
              className="w-full h-full object-contain object-center"
            />
            
            {/* Image Indicators (Dots) - only for shop products with multiple images */}
            {source === 'shop' && currentImages.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2">
                {currentImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className="transition-all active:scale-90"
                    style={{
                      width: currentImageIndex === index ? '24px' : '8px',
                      height: '8px',
                      borderRadius: '4px',
                      background: currentImageIndex === index 
                        ? accentColor.color 
                        : 'rgba(255, 255, 255, 0.5)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Variant Thumbnails */}
          <div className="flex items-center gap-2 sm:gap-2.5 mb-4 sm:mb-6 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide overscroll-x-contain">
            {variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariant(variant.id)}
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
                  className="w-full h-full object-contain"
                />
                <div 
                  className="absolute bottom-0.5 sm:bottom-1 left-0.5 sm:left-1 right-0.5 sm:right-1 text-center py-0.5 rounded-md sm:rounded-lg text-[8px] sm:text-[10px] font-bold"
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

          {/* Product Title */}
          <h1 
            className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 sm:mb-3 leading-tight"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            {product.name}
          </h1>

          {/* Rating & Reviews */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
            <div className="flex items-center gap-0.5 sm:gap-1">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className="size-3.5 sm:size-4" 
                  fill={i < Math.floor(averageRating) ? accentColor.color : 'none'}
                  stroke={accentColor.color}
                  strokeWidth={2}
                />
              ))}
            </div>
            <span 
              className="text-xs sm:text-sm font-bold"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              {averageRating}
            </span>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <MessageCircle 
                className="size-3.5 sm:size-4" 
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} 
                strokeWidth={2}
              />
              <span 
                className="text-xs sm:text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
              >
                {totalReviews} ta sharh
              </span>
            </div>
          </div>

          {/* Stock & Sales Badges */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div 
              className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl border-2"
              style={{
                borderColor: stockCount > 0 ? '#10b981' : '#ef4444',
                background: stockCount > 0 
                  ? (isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)')
                  : (isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)'),
              }}
            >
              <Package className="size-4 sm:size-5 mb-1 sm:mb-1.5" style={{ color: stockCount > 0 ? '#10b981' : '#ef4444' }} strokeWidth={2} />
              <p className="text-[10px] sm:text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                {stockCount > 0 ? 'Omborda mavjud' : 'Omborda yo\'q'}
              </p>
              <p className="text-sm sm:text-base font-bold" style={{ color: stockCount > 0 ? '#10b981' : '#ef4444' }}>
                {stockCount} dona
              </p>
            </div>

            <div 
              className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl border-2"
              style={{
                borderColor: accentColor.color,
                background: isDark ? `${accentColor.color}15` : `${accentColor.color}08`,
              }}
            >
              <Clock className="size-4 sm:size-5 mb-1 sm:mb-1.5" style={{ color: accentColor.color }} strokeWidth={2} />
              <p className="text-[10px] sm:text-xs font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                Jami sotilgan
              </p>
              <p className="text-sm sm:text-base font-bold" style={{ color: accentColor.color }}>
                {soldTotal} ta
              </p>
            </div>
          </div>

          {/* Price Card */}
          <div 
            className="p-4 sm:p-5 rounded-xl sm:rounded-2xl mb-4 sm:mb-6"
            style={{
              background: isDark ? '#111111' : '#f9fafb',
              border: isDark ? '1px solid #1f1f1f' : '1px solid #e5e7eb',
            }}
          >
            <div className="flex items-baseline gap-2 sm:gap-3 mb-2 flex-wrap">
              <p 
                className="text-2xl sm:text-3xl md:text-4xl font-bold"
                style={{ color: accentColor.color }}
              >
                {currentPrice.toLocaleString('uz-UZ')} so'm
              </p>
              <p 
                className="text-base sm:text-lg line-through"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }}
              >
                {oldPrice.toLocaleString('uz-UZ')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <CreditCard className="size-4 sm:size-5" style={{ color: accentColor.color }} strokeWidth={2} />
              <p className="text-xs sm:text-sm font-semibold" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                Bo'lib to'lash:
              </p>
              <p className="text-sm sm:text-base font-bold" style={{ color: accentColor.color }}>
                {monthlyPayment.toLocaleString('uz-UZ')} so'm/oy
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mb-4 sm:mb-6">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="flex flex-col items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl"
                style={{
                  background: isDark ? '#111111' : '#f9fafb',
                }}
              >
                <feature.icon 
                  className="size-5 sm:size-6" 
                  style={{ color: accentColor.color }} 
                  strokeWidth={2} 
                />
                <p 
                  className="text-[9px] sm:text-[10px] font-bold text-center leading-tight"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                >
                  {feature.label}
                </p>
                <p 
                  className="text-[8px] sm:text-[9px] text-center"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  {feature.value}
                </p>
              </div>
            ))}
          </div>

          {/* Payment Methods */}
          <div className="mb-4 sm:mb-6">
            <h3 
              className="text-sm sm:text-base font-bold mb-3"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              To'lov usullari
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {[
                { 
                  id: 'cash', 
                  label: 'Naqd', 
                  icon: Banknote, 
                  imageUrl: null,
                  gradient: 'linear-gradient(145deg, #10b981, #059669)',
                  color: '#10b981'
                },
                { 
                  id: 'card', 
                  label: 'Karta', 
                  icon: CreditCard, 
                  imageUrl: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Icon%20App/payment-uzcard-humo.png',
                  gradient: 'linear-gradient(145deg, #3b82f6, #2563eb)',
                  color: '#3b82f6'
                },
                { 
                  id: 'click', 
                  label: 'Click', 
                  icon: Wallet, 
                  imageUrl: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Icon%20App/click-01.png',
                  gradient: 'linear-gradient(145deg, #0ea5e9, #0284c7)',
                  color: '#0ea5e9'
                },
                { 
                  id: 'payme', 
                  label: 'Payme', 
                  icon: CreditCard, 
                  imageUrl: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Icon%20App/Untitled_design__2_-removebg-preview.png',
                  gradient: 'linear-gradient(145deg, #22c55e, #16a34a)',
                  color: '#22c55e'
                },
                { 
                  id: 'uzum', 
                  label: 'Uzum', 
                  icon: Wallet, 
                  imageUrl: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Icon%20App/Untitled_design__1_-removebg-preview.png',
                  gradient: 'linear-gradient(145deg, #8b5cf6, #7c3aed)',
                  color: '#8b5cf6'
                },
                { 
                  id: 'oson', 
                  label: 'Oson', 
                  icon: CreditCard, 
                  imageUrl: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Icon%20App/6033458.png',
                  gradient: 'linear-gradient(145deg, #eab308, #ca8a04)',
                  color: '#eab308'
                },
                { 
                  id: 'openmudat', 
                  label: 'OpenMudat', 
                  icon: Wallet, 
                  imageUrl: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Icon%20App/Untitled_design__3_-removebg-preview.png',
                  gradient: 'linear-gradient(145deg, #ec4899, #db2777)',
                  color: '#ec4899'
                },
              ].map((method) => (
                <button
                  key={method.id}
                  className="flex flex-col items-center gap-1.5 p-2 sm:p-2.5 transition-all active:scale-95 overflow-hidden relative group backdrop-blur-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                    borderRadius: '12px',
                  }}
                >
                  {/* Image or Icon with glass border */}
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center transition-all group-hover:scale-110 overflow-hidden backdrop-blur-sm"
                    style={{
                      border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}`,
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.5)',
                    }}
                  >
                    {method.imageUrl ? (
                      <img 
                        src={method.imageUrl} 
                        alt={method.label}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <method.icon className="size-5 sm:size-6" style={{ color: method.color }} strokeWidth={2.5} />
                    )}
                  </div>
                  
                  {/* Label */}
                  <p 
                    className="text-[8px] sm:text-[9px] font-bold text-center"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                  >
                    {method.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-3 sm:mb-4">
            <div 
              className="flex items-center gap-4 sm:gap-6 border-b overflow-x-auto"
              style={{
                borderColor: isDark ? '#1f1f1f' : '#e5e7eb',
              }}
            >
              {[
                { id: 'description', label: 'Tavsif' },
                { id: 'specs', label: 'Xususiyatlar' },
                { id: 'reviews', label: `Sharhlar (${totalReviews})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="pb-2 sm:pb-3 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap"
                  style={{
                    color: activeTab === tab.id 
                      ? accentColor.color 
                      : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'),
                  }}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div 
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: accentColor.color }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="mb-4 sm:mb-6">
            {activeTab === 'description' && (
              <div>
                <p 
                  className="text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                >
                  {product.description || 'Mahsulot haqida ma\'lumot mavjud emas.'}
                </p>

                {product.recommendation && (
                  <div 
                    className="p-3 sm:p-4 rounded-lg sm:rounded-xl border-l-4"
                    style={{
                      background: isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.05)',
                      borderColor: '#eab308',
                    }}
                  >
                    <div className="flex gap-2 sm:gap-3">
                      <div className="text-xl sm:text-2xl">💡</div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold mb-1" style={{ color: '#eab308' }}>
                          Maslahat:
                        </p>
                        <p 
                          className="text-xs sm:text-sm"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                        >
                          {product.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Branch info if available */}
                {product.branchName && (
                  <div 
                    className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg sm:rounded-xl border"
                    style={{
                      background: isDark ? 'rgba(20, 184, 166, 0.1)' : 'rgba(20, 184, 166, 0.05)',
                      borderColor: '#14b8a6',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Store className="size-4 sm:size-5" style={{ color: '#14b8a6' }} strokeWidth={2} />
                      <p className="text-xs sm:text-sm font-semibold" style={{ color: '#14b8a6' }}>
                        Filial: {product.branchName}
                      </p>
                    </div>
                    {currentBarcode && (
                      <p 
                        className="text-[10px] sm:text-xs mt-1"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        Barcode: {currentBarcode}
                      </p>
                    )}
                    {currentSku && (
                      <p 
                        className="text-[10px] sm:text-xs"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        SKU: {currentSku}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'specs' && (
              <div>
                {displaySpecs.length > 0 ? (
                  <div className="space-y-2 sm:space-y-3">
                    {displaySpecs.map((spec, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between py-2 border-b"
                        style={{
                          borderColor: isDark ? '#1f1f1f' : '#e5e7eb',
                        }}
                      >
                        <span 
                          className="text-xs sm:text-sm"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                        >
                          {spec.name}
                        </span>
                        <span 
                          className="text-xs sm:text-sm font-semibold"
                          style={{ color: isDark ? '#ffffff' : '#111827' }}
                        >
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <Box 
                      className="size-10 sm:size-12 mx-auto mb-2 sm:mb-3" 
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} 
                      strokeWidth={1.5}
                    />
                    <p 
                      className="text-xs sm:text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Xususiyatlar ma'lumotlari mavjud emas
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                {/* New Review Form */}
                <div 
                  className="p-3 sm:p-4 rounded-xl sm:rounded-2xl mb-4 sm:mb-6"
                  style={{
                    background: isDark ? '#111111' : '#f9fafb',
                    border: isDark ? '1px solid #1f1f1f' : '1px solid #e5e7eb',
                  }}
                >
                  <h4 
                    className="text-sm sm:text-base font-bold mb-3"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    Sharh qoldiring
                  </h4>

                  {/* Rating Selection */}
                  <div className="mb-3">
                    <p 
                      className="text-xs sm:text-sm mb-2 font-semibold"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      Baholang:
                    </p>
                    <div className="flex items-center gap-1 sm:gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setNewReviewRating(star)}
                          className="transition-all active:scale-90"
                        >
                          <Star 
                            className="size-7 sm:size-8" 
                            fill={star <= newReviewRating ? accentColor.color : 'none'}
                            stroke={star <= newReviewRating ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)')}
                            strokeWidth={2}
                          />
                        </button>
                      ))}
                      <span 
                        className="ml-2 text-sm sm:text-base font-bold"
                        style={{ color: accentColor.color }}
                      >
                        {newReviewRating}/5
                      </span>
                    </div>
                  </div>

                  {/* Review Text */}
                  <textarea
                    value={newReviewText}
                    onChange={(e) => setNewReviewText(e.target.value)}
                    placeholder="Mahsulot haqida fikringizni yozing..."
                    rows={3}
                    className="w-full p-3 sm:p-4 rounded-lg sm:rounded-xl text-xs sm:text-sm resize-none outline-none transition-all"
                    style={{
                      background: isDark ? '#0a0a0a' : '#ffffff',
                      border: `2px solid ${isDark ? '#1f1f1f' : '#e5e7eb'}`,
                      color: isDark ? '#ffffff' : '#111827',
                    }}
                  />

                  {/* Submit Button */}
                  <button
                    onClick={() => void handleSubmitReview()}
                    disabled={!newReviewText.trim() || reviewSubmitting}
                    className="mt-3 w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: !newReviewText.trim() ? (isDark ? '#666666' : '#9ca3af') : accentColor.color,
                      boxShadow: !newReviewText.trim() ? 'none' : `0 8px 24px ${accentColor.color}40`,
                    }}
                  >
                    {reviewSubmitting ? (
                      <Loader2 className="size-4 sm:size-5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Send className="size-4 sm:size-5" strokeWidth={2} />
                    )}
                    <span className="text-sm sm:text-base">{reviewSubmitting ? 'Yuborilmoqda…' : 'Yuborish'}</span>
                  </button>
                </div>

                {/* Reviews List */}
                {reviewsLoading ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-6 sm:py-8">
                    <Loader2 className="size-6 animate-spin shrink-0" style={{ color: accentColor.color }} />
                    <p 
                      className="text-xs sm:text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      
                    </p>
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="p-3 sm:p-4 rounded-xl sm:rounded-2xl"
                        style={{
                          background: isDark ? '#111111' : '#f9fafb',
                          border: isDark ? '1px solid #1f1f1f' : '1px solid #e5e7eb',
                        }}
                      >
                        {/* Review Header */}
                        <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                          {/* Avatar */}
                          <div 
                            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
                            style={{
                              background: isDark ? '#1a1a1a' : '#ffffff',
                              border: `2px solid ${isDark ? '#2a2a2a' : '#e5e7eb'}`,
                            }}
                          >
                            {review.userAvatar}
                          </div>

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <p 
                              className="text-xs sm:text-sm font-bold truncate"
                              style={{ color: isDark ? '#ffffff' : '#111827' }}
                            >
                              {review.userName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex items-center gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className="size-2.5 sm:size-3" 
                                    fill={i < review.rating ? accentColor.color : 'none'}
                                    stroke={accentColor.color}
                                    strokeWidth={2}
                                  />
                                ))}
                              </div>
                              <span 
                                className="text-[10px] sm:text-xs"
                                style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                              >
                                {review.date}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Review Text */}
                        <p 
                          className="text-xs sm:text-sm leading-relaxed mb-3"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                        >
                          {review.text}
                        </p>

                        {/* Like/Dislike Buttons */}
                        <div className="flex items-center gap-3 sm:gap-4">
                          <button
                            onClick={() => handleLikeReview(review.id)}
                            className="flex items-center gap-1.5 transition-all active:scale-90"
                          >
                            <div 
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
                              style={{
                                background: review.userLiked ? `${accentColor.color}20` : (isDark ? '#1a1a1a' : '#ffffff'),
                                border: review.userLiked ? `1px solid ${accentColor.color}` : `1px solid ${isDark ? '#2a2a2a' : '#e5e7eb'}`,
                              }}
                            >
                              <ThumbsUp 
                                className="size-3.5 sm:size-4" 
                                fill={review.userLiked ? accentColor.color : 'none'}
                                stroke={review.userLiked ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)')}
                                strokeWidth={2}
                              />
                            </div>
                            <span 
                              className="text-xs sm:text-sm font-semibold"
                              style={{ color: review.userLiked ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') }}
                            >
                              {review.likes}
                            </span>
                          </button>

                          <button
                            onClick={() => handleDislikeReview(review.id)}
                            className="flex items-center gap-1.5 transition-all active:scale-90"
                          >
                            <div 
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
                              style={{
                                background: review.userDisliked ? 'rgba(239, 68, 68, 0.2)' : (isDark ? '#1a1a1a' : '#ffffff'),
                                border: review.userDisliked ? '1px solid #ef4444' : `1px solid ${isDark ? '#2a2a2a' : '#e5e7eb'}`,
                              }}
                            >
                              <ThumbsDown 
                                className="size-3.5 sm:size-4" 
                                fill={review.userDisliked ? '#ef4444' : 'none'}
                                stroke={review.userDisliked ? '#ef4444' : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)')}
                                strokeWidth={2}
                              />
                            </div>
                            <span 
                              className="text-xs sm:text-sm font-semibold"
                              style={{ color: review.userDisliked ? '#ef4444' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') }}
                            >
                              {review.dislikes}
                            </span>
                          </button>
                        </div>

                        {/* Admin moderation actions */}
                        {isAdmin && (
                          <div className="flex items-center gap-2 mt-3">
                            {review.hidden ? (
                              <button
                                onClick={() => void handleModerateReview(review.id, 'restore')}
                                disabled={moderatingReviewId !== null}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs sm:text-sm disabled:opacity-50"
                                style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}
                              >
                                {moderatingReviewId === review.id ? (
                                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                                ) : null}
                                Qayta ko‘rsatish
                              </button>
                            ) : (
                              <button
                                onClick={() => void handleModerateReview(review.id, 'hide')}
                                disabled={moderatingReviewId !== null}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs sm:text-sm disabled:opacity-50"
                                style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
                              >
                                {moderatingReviewId === review.id ? (
                                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                                ) : null}
                                Yashirish
                              </button>
                            )}
                            <button
                              onClick={() => void handleModerateReview(review.id, 'delete')}
                              disabled={moderatingReviewId !== null}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs sm:text-sm disabled:opacity-50"
                              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                            >
                              {moderatingReviewId === review.id ? (
                                <Loader2 className="size-3.5 animate-spin shrink-0" />
                              ) : null}
                              O‘chirish
                            </button>
                          </div>
                        )}

                        {/* Replies */}
                        {review.replies && review.replies.length > 0 && (
                          <div className="mt-3 sm:mt-4 ml-3 sm:ml-4 space-y-2 sm:space-y-3">
                            {review.replies.map((reply) => (
                              <div
                                key={reply.id}
                                className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl"
                                style={{
                                  background: isDark ? '#0a0a0a' : '#ffffff',
                                  border: `1px solid ${isDark ? '#2a2a2a' : '#e5e7eb'}`,
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div 
                                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm sm:text-base flex-shrink-0"
                                    style={{
                                      background: isDark ? '#1a1a1a' : '#f9fafb',
                                    }}
                                  >
                                    {reply.userAvatar}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p 
                                      className="text-[10px] sm:text-xs font-bold mb-0.5"
                                      style={{ color: accentColor.color }}
                                    >
                                      {reply.userName}
                                    </p>
                                    <p 
                                      className="text-[10px] sm:text-xs leading-relaxed"
                                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                                    >
                                      {reply.text}
                                    </p>
                                    <span 
                                      className="text-[9px] sm:text-[10px] mt-1 inline-block"
                                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                                    >
                                      {reply.date}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <MessageCircle 
                      className="size-10 sm:size-12 mx-auto mb-2 sm:mb-3" 
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} 
                      strokeWidth={1.5}
                    />
                    <p 
                      className="text-xs sm:text-sm"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Hozircha sharhlar yo'q
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Bottom bar — flex ichida, alohida scroll yo‘q */}
        <div 
          className="shrink-0 p-3 sm:p-4 border-t pb-[max(0.75rem,var(--app-safe-bottom,0px))]"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: isDark ? '#0a0a0a' : '#ffffff',
            borderColor: isDark ? '#1f1f1f' : '#e5e7eb',
          }}
        >
          <div className="max-w-lg mx-auto">
            {/* Stock warning - show if out of stock */}
            {stockCount === 0 && (
              <div 
                className="mb-3 p-2 sm:p-2.5 rounded-lg text-center"
                style={{
                  background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >
                <p 
                  className="text-[10px] sm:text-xs font-semibold"
                  style={{ color: '#ef4444' }}
                >
                  ❌ Omborda mahsulot qolmagan
                </p>
              </div>
            )}

            {/* Stock Badge - Market section style */}
            {stockCount > 0 && quantity > 0 && (
              <div 
                className="mb-3 px-3 py-1.5 rounded-xl flex items-center justify-between text-sm font-medium"
                style={{ 
                  background: stockCount > 10 
                    ? (isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.1)')
                    : (isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)'),
                  color: stockCount > 10 ? '#10b981' : '#f59e0b'
                }}
              >
                <span>Omborda: {stockCount} dona</span>
                <span style={{ color: accentColor.color }}>
                  Jami: {totalPrice.toLocaleString('uz-UZ')} so'm
                </span>
              </div>
            )}

            {quantity === 0 ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p 
                    className="text-[10px] sm:text-xs font-semibold mb-0.5 sm:mb-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Narx:
                  </p>
                  <p 
                    className="text-lg sm:text-2xl font-bold"
                    style={{ color: accentColor.color }}
                  >
                    {currentVariant.price.toLocaleString('uz-UZ')} so'm
                  </p>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={stockCount === 0 || shopClosedByHours}
                  className="px-5 sm:px-8 py-3 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-white transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      stockCount === 0 || shopClosedByHours
                        ? isDark
                          ? '#666666'
                          : '#9ca3af'
                        : accentColor.color,
                    boxShadow:
                      stockCount === 0 || shopClosedByHours ? 'none' : `0 8px 24px ${accentColor.color}40`,
                  }}
                >
                  <ShoppingCart className="size-4 sm:size-5" strokeWidth={2} />
                  <span className="text-sm sm:text-base">Savatga</span>
                </button>
              </div>
            ) : (
              <>
                {/* Maksimal qoldiq tanlangan (1 ta qolganda ham xato ko‘rinmasin) */}
                {quantity === stockCount && stockCount > 0 && (
                  <div 
                    className="mb-2 sm:mb-3 p-2 sm:p-2.5 rounded-lg text-center"
                    style={{
                      background: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <p 
                      className="text-[10px] sm:text-xs font-semibold"
                      style={{ color: '#10b981' }}
                    >
                      Omborda {stockCount} ta — barchasini tanladingiz
                    </p>
                  </div>
                )}
                {quantity > stockCount && stockCount >= 0 && (
                  <div 
                    className="mb-2 sm:mb-3 p-2 sm:p-2.5 rounded-lg text-center"
                    style={{
                      background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    <p 
                      className="text-[10px] sm:text-xs font-semibold"
                      style={{ color: '#ef4444' }}
                    >
                      Miqdor ombordan oshib ketdi (max. {stockCount} ta)
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p 
                      className="text-[10px] sm:text-xs font-semibold mb-0.5 sm:mb-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                    >
                      Jami:
                    </p>
                    <p 
                      className="text-lg sm:text-2xl font-bold"
                      style={{ color: accentColor.color }}
                    >
                      {totalPrice.toLocaleString('uz-UZ')} so'm
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={handleDecrement}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all active:scale-90"
                      style={{
                        background: isDark ? '#1a1a1a' : '#f3f4f6',
                      }}
                    >
                      <Minus className="size-5 sm:size-6" style={{ color: isDark ? '#ffffff' : '#111827' }} strokeWidth={2.5} />
                    </button>

                    <div 
                      className="min-w-[60px] sm:min-w-[70px] px-4 py-3 sm:py-3.5 rounded-xl flex items-center justify-center"
                      style={{
                        background: isDark ? '#111111' : '#f9fafb',
                        border: isDark ? '1px solid #1f1f1f' : '1px solid #e5e7eb',
                      }}
                    >
                      <span 
                        className="text-lg sm:text-xl font-bold"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                      >
                        {quantity}
                      </span>
                    </div>

                    <button
                      onClick={handleIncrement}
                      disabled={quantity >= stockCount}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: quantity >= stockCount 
                          ? (isDark ? '#333333' : '#d1d5db')
                          : accentColor.color,
                        boxShadow: quantity >= stockCount 
                          ? 'none'
                          : `0 8px 24px ${accentColor.color}40`,
                      }}
                    >
                      <Plus className="size-5 sm:size-6" style={{ color: quantity >= stockCount ? (isDark ? '#666666' : '#9ca3af') : '#ffffff' }} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Final Add to Cart Button - Market section style */}
                <button
                  onClick={() => {
                    if (shopClosedByHours) {
                      toast.error(
                        hoursEv.label
                          ? `Do‘kon yopiq. Ish vaqti: ${hoursEv.label}`
                          : 'Do‘kon hozir buyurtma qabul qilmaydi',
                      );
                      return;
                    }
                    console.log('🛒 Final add to cart clicked:', { product, quantity, variantId: currentVariant.variantId, variantName: currentVariant.label });
                    onAddToCart(product, quantity, currentVariant.variantId, currentVariant.label);
                    notifyCartAdded(quantity, { name: product.name });
                    setQuantity(0); // Reset quantity after adding to cart
                    onClose();
                  }}
                  disabled={shopClosedByHours}
                  className="w-full mt-3 sm:mt-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: shopClosedByHours ? (isDark ? '#555' : '#9ca3af') : accentColor.color,
                    boxShadow: shopClosedByHours ? 'none' : `0 8px 24px ${accentColor.color}40`,
                  }}
                >
                  <ShoppingCart className="size-5 sm:size-6" strokeWidth={2} />
                  <span className="text-sm sm:text-base">Savatga qo'shish - {totalPrice.toLocaleString('uz-UZ')} so'm</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});