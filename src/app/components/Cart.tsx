import { X, Minus, Plus, Trash2, ShoppingBag, CreditCard, Wallet, Banknote, Tag, Package, ShoppingCart } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useRentalCart } from '../context/RentalCartContext';
import { RentalCartSection } from './RentalCartSection';
import { useState, useEffect } from 'react';
import { ReceiptModal } from './ReceiptModal';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useCheckoutFlow } from '../context/CheckoutFlowContext';

// Cart Component with ARESSO Payment Integration
// Updated: 2025-01-12
interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  cartLineKey?: string;
  productUuid?: string;
  selectedVariantId?: string; // Variant tracking
  selectedVariantName?: string; // For display
  variants?: {
    id: string;
    price: number;
    image: string;
    oldPrice?: number;
    stockQuantity?: number;
  }[];
  oldPrice?: number;
  stockCount?: number;
  // Food-specific fields
  dishDetails?: {
    restaurantName?: string;
    prepTime?: string;
    weight?: string;
    kcal?: number;
    diningRoomName?: string | null;
  };
  variantDetails?: {
    name: string;
    price: number;
    prepTime?: string;
  };
  addons?: {
    name: string;
    price: number;
    quantity: number;
  }[];
}

interface CartProps {
  items: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateQuantity: (id: number, quantity: number, variantId?: string) => void;
  onRemoveItem: (id: number, variantId?: string) => void;
  onClearCart: () => void;
  /** Buyurtma muvaffaqiyatli tugagach — mahsulot zaxirasini serverdan qayta yuklash (eski stock bilan savat/checkout xatosini oldini olish) */
  onSuccessfulOrder?: () => void;
}

export function Cart({ items, isOpen, onClose, onUpdateQuantity, onRemoveItem, onClearCart, onSuccessfulOrder }: CartProps) {
  // Get rental cart
  const {
    cartItems: rentalItems,
    removeFromCart: removeRentalItem,
    updateQuantity: updateRentalQuantity,
    getTotalPrice: getRentalTotal,
    clearCart: clearRentalCart,
  } = useRentalCart();
  
  // Calculate total correctly - use variantDetails and addons if available - ENSURE NUMBERS!
  const total = items.reduce((sum, item) => {
    const basePrice = Number(item.variantDetails?.price) || Number(item.price) || 0;
    const addonsTotal = item.addons?.reduce((addonSum, addon) => {
      return addonSum + (Number(addon.price) || 0) * (Number(addon.quantity) || 1);
    }, 0) || 0;
    const perUnitPrice = basePrice + addonsTotal;
    return sum + (perUnitPrice * (Number(item.quantity) || 0));
  }, 0);

  const combinedTotal = total + getRentalTotal();
  
  const { theme, accentColor } = useTheme();
  const { openCheckoutFlow } = useCheckoutFlow();
  const isDark = theme === 'dark';
  
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleCheckoutClick = () => {
    openCheckoutFlow();
  };

  const bgGradient = isDark 
    ? 'linear-gradient(to bottom, #18181b, #000000)'
    : 'linear-gradient(to bottom, #ffffff, #f4f4f5)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 app-safe-pad backdrop-blur-sm z-50 transition-opacity ${isDark ? 'bg-black/70' : 'bg-black/50'}`}
        onClick={onClose}
      />

      {/* Cart Panel - Full screen on mobile */}
      <div 
        className="fixed right-0 top-[var(--app-safe-top)] bottom-[var(--app-safe-bottom)] left-0 sm:left-auto w-full sm:max-w-md border-l z-50 shadow-2xl flex flex-col min-h-0 max-h-[100dvh]"
        style={{
          background: bgGradient,
          borderColor: borderColor,
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 sm:p-6 border-b"
          style={{ borderColor: borderColor }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-xl border"
              style={{
                background: `${accentColor.color}1a`,
                borderColor: `${accentColor.color}33`,
              }}
            >
              <ShoppingBag className="size-5" style={{ color: accentColor.color }} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl" style={{ color: textPrimary }}>Savat</h2>
              <p className="text-sm" style={{ color: textSecondary }}>
                {items.length} mahsulot{rentalItems.length > 0 && ` • ${rentalItems.length} ijara`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl transition-all active:scale-90"
            style={{
              color: textSecondary,
              background: cardBg,
            }}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y p-4 sm:p-6 space-y-3 sm:space-y-4 [-webkit-overflow-scrolling:touch]">
          {items.length === 0 && rentalItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div 
                className="p-6 rounded-2xl border mb-4"
                style={{
                  background: cardBg,
                  borderColor: borderColor,
                }}
              >
                <ShoppingBag className="size-16" style={{ color: textSecondary }} />
              </div>
              <p className="text-lg" style={{ color: textSecondary }}>Savat bo'sh</p>
              <p className="text-sm mt-2" style={{ color: `${textSecondary}80` }}>Mahsulotlarni qo'shish uchun tugmani bosing</p>
            </div>
          ) : (
            <>
              {/* Regular Products */}
              {items.map((item) => {
                const itemKey =
                  item.cartLineKey ||
                  `${String(item.productUuid || '')}_${item.id}_${String(item.selectedVariantId ?? 'default')}`;
                
                // Get selected variant data if available
                const selectedVariant = item.selectedVariantId && item.variants
                  ? item.variants.find(
                      (v) => String(v.id) === String(item.selectedVariantId),
                    )
                  : null;
                
                // Use variant data or fallback to item data (taom: `variants` bo‘lmasa ham `item.image` — variant rasmi)
                const displayPrice = selectedVariant?.price ?? item.price;
                const displayImage =
                  String(selectedVariant?.image || '').trim() ||
                  String(item.image || '').trim();
                const displayOldPrice = selectedVariant?.oldPrice ?? item.oldPrice;
                const stockCount = selectedVariant?.stockQuantity ?? item.stockCount ?? 999999;
                
                // Check if we can add more
                const canAddMore = item.quantity < stockCount;
                
                return (
                  <div
                    key={itemKey}
                    className="relative flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all hover:shadow-lg"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.8)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
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
                        src={displayImage}
                        alt={item.name}
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
                        {item.name}
                      </h3>
                      
                      {/* Variant Badge - Show variantDetails OR selectedVariantName (not both) */}
                      {(item.variantDetails || item.selectedVariantName) && (
                        <div className="mb-2">
                          <span 
                            className="text-xs sm:text-sm px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-bold shadow-md"
                            style={{ 
                              color: '#ffffff',
                              background: accentColor.gradient,
                              border: `2px solid ${accentColor.color}`,
                              boxShadow: `0 4px 12px ${accentColor.color}40`,
                            }}
                          >
                            <Tag className="size-3.5 sm:size-4" strokeWidth={2.5} />
                            {item.variantDetails?.name || item.selectedVariantName}
                          </span>
                        </div>
                      )}
                      
                      {/* Addons Display */}
                      {item.addons && item.addons.length > 0 && (
                        <div 
                          className="mb-2 p-2 rounded-lg space-y-1"
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
                          }}
                        >
                          <p className="text-[10px] font-semibold mb-1" style={{ color: textSecondary }}>
                            Qo'shimchalar:
                          </p>
                          {item.addons.map((addon, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-center justify-between text-[10px] sm:text-xs"
                            >
                              <span style={{ color: textSecondary }}>
                                + {addon.name} × {addon.quantity}
                              </span>
                              <span className="font-bold" style={{ color: accentColor.color }}>
                                {(addon.price * addon.quantity).toLocaleString('uz-UZ')} so'm
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Dish Details (Restaurant info) */}
                      {item.dishDetails && (
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {item.dishDetails.prepTime && (
                            <span 
                              className="text-[10px] px-2 py-1 rounded-md inline-flex items-center gap-1"
                              style={{ 
                                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                color: textSecondary
                              }}
                            >
                              ⏱️ {item.dishDetails.prepTime}
                            </span>
                          )}
                          {item.dishDetails.weight && (
                            <span 
                              className="text-[10px] px-2 py-1 rounded-md inline-flex items-center gap-1"
                              style={{ 
                                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                color: textSecondary
                              }}
                            >
                              ⚖️ {item.dishDetails.weight}
                            </span>
                          )}
                          {item.dishDetails.kcal && (
                            <span 
                              className="text-[10px] px-2 py-1 rounded-md inline-flex items-center gap-1"
                              style={{ 
                                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                color: textSecondary
                              }}
                            >
                              🔥 {item.dishDetails.kcal} kcal
                            </span>
                          )}
                          {item.dishDetails.diningRoomName ? (
                            <span
                              className="text-[10px] px-2 py-1 rounded-md inline-flex items-center gap-1 font-semibold"
                              style={{
                                background: `${accentColor.color}18`,
                                color: accentColor.color,
                              }}
                            >
                              🪑 {item.dishDetails.diningRoomName}
                            </span>
                          ) : null}
                        </div>
                      )}
                      
                      {/* Stock Warning - if low stock */}
                      {item.quantity >= stockCount && stockCount < 999999 && (
                        <div 
                          className="mb-2 px-2 py-1 rounded text-xs font-semibold"
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          ⚠️ Omborda faqat {stockCount} dona
                        </div>
                      )}
                      
                      {/* Price Info - CORRECTED CALCULATION */}
                      <div className="flex flex-col gap-1 mb-3">
                        {/* Base Variant Price */}
                        {item.variantDetails ? (
                          <div className="flex items-baseline gap-2">
                            <p className="text-[10px]" style={{ color: textSecondary }}>
                              {item.dishDetails ? 'Taom narxi:' : 'Variant narxi:'}
                            </p>
                            <p 
                              className="text-sm font-bold"
                              style={{ color: textPrimary }}
                            >
                              {item.variantDetails.price.toLocaleString('uz-UZ')} so'm
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-2">
                            <p 
                              className="text-sm sm:text-base font-bold"
                              style={{ color: accentColor.color }}
                            >
                              {displayPrice.toLocaleString('uz-UZ')} so'm
                            </p>
                            {displayOldPrice && displayOldPrice > displayPrice && (
                              <p 
                                className="text-xs line-through"
                                style={{ color: textSecondary }}
                              >
                                {displayOldPrice.toLocaleString('uz-UZ')}
                              </p>
                            )}
                            <p 
                              className="text-xs"
                              style={{ color: textSecondary }}
                            >
                              × {item.quantity}
                            </p>
                          </div>
                        )}
                        
                        {/* Total Addons Price (if exists) */}
                        {item.addons && item.addons.length > 0 && (
                          <div className="flex items-baseline gap-2">
                            <p className="text-[10px]" style={{ color: textSecondary }}>
                              Qo'shimchalar:
                            </p>
                            <p 
                              className="text-sm font-bold"
                              style={{ color: textPrimary }}
                            >
                              +{item.addons.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0).toLocaleString('uz-UZ')} so'm
                            </p>
                          </div>
                        )}
                        
                        {/* Per Unit Total (if has variant/addons) */}
                        {(item.variantDetails || (item.addons && item.addons.length > 0)) && (
                          <div className="flex items-baseline gap-2 pt-1 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                            <p className="text-[10px]" style={{ color: textSecondary }}>
                              Bitta narxi:
                            </p>
                            <p 
                              className="text-sm font-bold"
                              style={{ color: accentColor.color }}
                            >
                              {(() => {
                                const basePrice = Number(item.variantDetails?.price) || Number(displayPrice) || 0;
                                const addonsTotal = item.addons?.reduce((sum, addon) => {
                                  return sum + (Number(addon.price) || 0) * (Number(addon.quantity) || 1);
                                }, 0) || 0;
                                return (basePrice + addonsTotal).toLocaleString('uz-UZ');
                              })()} so'm × {item.quantity}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Quantity Controls + Subtotal */}
                      <div className="flex items-center justify-between gap-3 mt-auto">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              console.log('➖ Cart decrement:', { id: item.id, quantity: item.quantity, variantId: item.selectedVariantId });
                              if (item.quantity === 1) {
                                // Remove from cart if only 1 left
                                onRemoveItem(item.id, item.selectedVariantId);
                              } else {
                                onUpdateQuantity(item.id, item.quantity - 1, item.selectedVariantId);
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
                            {item.quantity}
                          </span>
                          
                          <button
                            onClick={() => {
                              console.log('➕ Cart increment:', { id: item.id, quantity: item.quantity, variantId: item.selectedVariantId, canAddMore, stockCount });
                              if (canAddMore) {
                                onUpdateQuantity(item.id, item.quantity + 1, item.selectedVariantId);
                              }
                            }}
                            disabled={!canAddMore}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              background: canAddMore ? accentColor.color : (isDark ? '#333333' : '#d1d5db'),
                              boxShadow: canAddMore ? `0 4px 12px ${accentColor.color}30` : 'none',
                            }}
                          >
                            <Plus className="size-3.5 sm:size-4 text-white" strokeWidth={2.5} />
                          </button>
                        </div>

                        {/* Subtotal - CORRECTED */}
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
                            {(() => {
                              // Calculate correct total - ENSURE NUMBERS!
                              const basePrice = Number(item.variantDetails?.price) || Number(displayPrice) || 0;
                              const addonsTotal = item.addons?.reduce((sum, addon) => {
                                return sum + (Number(addon.price) || 0) * (Number(addon.quantity) || 1);
                              }, 0) || 0;
                              const perUnitPrice = basePrice + addonsTotal;
                              const total = perUnitPrice * (Number(item.quantity) || 1);
                              return total.toLocaleString('uz-UZ');
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Delete Button - Top Right */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🗑️ Cart remove button clicked!');
                        console.log('🗑️ Item to remove:', { id: item.id, name: item.name, variantId: item.selectedVariantId });
                        onRemoveItem(item.id, item.selectedVariantId);
                      }}
                      className="absolute top-2 right-2 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 cursor-pointer z-10"
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <Trash2 className="size-3.5 sm:size-4 text-red-500 pointer-events-none" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
              
              {/* Rental Products Section */}
              <RentalCartSection 
                items={rentalItems}
                onRemove={removeRentalItem}
                onUpdateQuantity={updateRentalQuantity}
              />
            </>
          )}
        </div>

        {/* Footer */}
        {(items.length > 0 || rentalItems.length > 0) && (
          <div 
            className="p-4 sm:p-6 border-t space-y-3 sm:space-y-4"
            style={{
              borderColor: borderColor,
              background: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.02)',
            }}
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Items Count */}
              <div 
                className="p-3 rounded-xl border"
                style={{ 
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.5)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Package className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                  <p className="text-xs" style={{ color: textSecondary }}>Pozitsiyalar:</p>
                </div>
                <p className="text-base font-bold" style={{ color: textPrimary }}>{items.length + rentalItems.length} ta</p>
              </div>

              {/* Total Quantity */}
              <div 
                className="p-3 rounded-xl border"
                style={{ 
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.5)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="size-4" style={{ color: accentColor.color }} strokeWidth={2} />
                  <p className="text-xs" style={{ color: textSecondary }}>Jami dona / muddat:</p>
                </div>
                <p className="text-base font-bold" style={{ color: textPrimary }}>
                  {items.reduce((sum, item) => sum + item.quantity, 0) +
                    rentalItems.reduce((s, r) => s + (r.rentalDuration || 0), 0)}{' '}
                  <span className="text-xs font-normal" style={{ color: textSecondary }}>birlik</span>
                </p>
              </div>
            </div>

            {/* Total Price - Highlighted */}
            <div 
              className="p-4 rounded-xl border-2"
              style={{ 
                background: `${accentColor.color}10`,
                borderColor: `${accentColor.color}40`,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm mb-1" style={{ color: textSecondary }}>Umumiy summa:</p>
                  <p className="text-2xl sm:text-3xl font-bold" style={{ color: accentColor.color }}>
                    {combinedTotal.toLocaleString('uz-UZ')}
                  </p>
                  <p className="text-xs" style={{ color: textSecondary }}>so'm</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: textSecondary }}>Bo'lib to'lash:</p>
                  <p className="text-sm font-bold" style={{ color: accentColor.color }}>
                    {Math.round(combinedTotal / 12).toLocaleString('uz-UZ')}
                  </p>
                  <p className="text-xs" style={{ color: textSecondary }}>so'm/oy</p>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <button
              type="button"
              onClick={handleCheckoutClick}
              className="w-full py-5 rounded-2xl text-white transition-all active:scale-95 font-bold text-lg shadow-2xl disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ 
                background: accentColor.gradient,
                boxShadow: `0 10px 40px ${accentColor.color}50`,
              }}
            >
              <div className="flex items-center justify-center gap-3">
                <ShoppingCart className="size-6" strokeWidth={2.5} />
                <span>Buyurtma rasmiylashtirish</span>
              </div>
            </button>
          </div>
        )}
      </div>
      
      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={receiptData}
      />

    </>
  );
}