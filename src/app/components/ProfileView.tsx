import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  User,
  Settings,
  Package,
  Heart,
  Grid3x3,
  Calendar,
  Edit,
  Home,
  Car,
  Plus,
  X,
  Upload,
  DollarSign,
  Gift,
  ChevronRight,
  MessageSquare,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SettingsModal } from './SettingsModal';
import { SMSAuthModal } from './SMSAuthModal';
import { ProfileEditModal } from './ProfileEditModal';
import { CreatePortfolioModal } from './CreatePortfolioModal';
import { AddListingModal } from './AddListingModal';
import { EditListingModal } from './EditListingModal';
import { PortfolioCard } from './PortfolioCard';
import { ListingCard } from './ListingCard';
import { PortfolioDetailModal } from './PortfolioDetailModal';
import { ListingPreviewModal } from './ListingPreviewModal';
import { devLog } from '../utils/devLog';
import { useTheme, type Language } from '../context/ThemeContext';
import {
  profileOrderBadgeLabel,
  profilePaymentStatus,
  profileCategoryLabel,
  useUserPanelT,
  userPanelFormatDateTime,
  userPanelLocale,
} from '../i18n/userPanel';
import { formatListingFeeDisplay } from '../constants/listingFee';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { publicAnonKey, API_BASE_URL, DEV_API_BASE_URL } from '/utils/supabase/info';
import { OrderReviewModal } from './OrderReviewModal';
import type { FavoriteOrderEntry } from '../context/FavoritesContext';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { ProfileActiveRentalCard, type ProfileActiveRentalOrder } from './rental/ProfileActiveRentalCard';
import { tryResolveImageFromBranchCatalog } from '../utils/branchCatalogProductImage';

/** Normalize Postgres marketplace `vertical_type` → profil buyurtma filtrlari */
function mapRelationalVerticalToCategory(
  v: string
): 'market' | 'shop' | 'rent' | 'food' | 'auction' {
  const x = (v || '').toLowerCase();
  if (x === 'shop') return 'shop';
  if (x === 'food') return 'food';
  if (x === 'rental' || x === 'property' || x === 'place') return 'rent';
  if (x === 'vehicle' || x === 'auction') return 'auction';
  return 'market';
}

/** Server `rentals.tsx` `normalizePhoneDigits` bilan mos — KV indeks kaliti bir xil bo‘lsin */
function normalizePhoneForRentalsApi(phone: string): string {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9) return `998${d}`;
  if (d.startsWith('998')) return d;
  return d;
}

function mapRelationalOrderStatus(s: string): 'active' | 'completed' | 'cancelled' {
  const x = (s || '').toLowerCase();
  if (['cancelled', 'refunded', 'partially_refunded', 'rejected'].includes(x)) return 'cancelled';
  if (['fulfilled', 'confirmed', 'split'].includes(x)) return 'completed';
  return 'active';
}

type ProfileOrderLinePreview = {
  imageUrl: string | null;
  title: string;
  subtitle?: string;
  quantity: number;
  lineTotal: number;
  unitPrice?: number;
  /** Filial katalogi (localStorage) / enrichment */
  productId?: string;
  productVariantId?: string;
};

function mergePreviewLinesWithKv(
  relLines: ProfileOrderLinePreview[],
  kvLines: ProfileOrderLinePreview[],
): ProfileOrderLinePreview[] {
  if (!Array.isArray(relLines) || relLines.length === 0) return relLines;
  if (!Array.isArray(kvLines) || kvLines.length === 0) return relLines;
  return relLines.map((line, i) => {
    if (line.imageUrl) return line;
    const byIdx = kvLines[i];
    if (byIdx?.imageUrl) return { ...line, imageUrl: byIdx.imageUrl };
    const byTitle = kvLines.find(
      (k) =>
        k.title === line.title ||
        (Boolean(line.subtitle) && Boolean(k.subtitle) && k.subtitle === line.subtitle),
    );
    if (byTitle?.imageUrl) return { ...line, imageUrl: byTitle.imageUrl };
    return line;
  });
}

/** Bir xil `id`: relational ma’lumot + KV qatorlaridagi rasmlar */
function mergeRelationalAndKvOrder(rel: Record<string, unknown>, kv: Record<string, unknown>) {
  const relLines = Array.isArray(rel.previewLines)
    ? (rel.previewLines as ProfileOrderLinePreview[])
    : [];
  const kvLines = Array.isArray(kv.previewLines)
    ? (kv.previewLines as ProfileOrderLinePreview[])
    : [];
  const previewLines = mergePreviewLinesWithKv(relLines, kvLines);
  return { ...kv, ...rel, previewLines };
}

function enrichOrderPreviewLineImages(order: Record<string, unknown>): Record<string, unknown> {
  if (!order || !Array.isArray(order.previewLines)) return order;
  const previewLines = (order.previewLines as ProfileOrderLinePreview[]).map((line) => {
    if (line.imageUrl) return line;
    const img = tryResolveImageFromBranchCatalog({
      productId: line.productId,
      variantId: line.productVariantId,
      productName: line.title,
      variantName: line.subtitle,
    });
    return img ? { ...line, imageUrl: img } : line;
  });
  return { ...order, previewLines };
}

function formatMoneyProfile(amount: number, currency: string, lang: Language): string {
  if (!Number.isFinite(amount)) return '—';
  const cur = String(currency || 'UZS').toUpperCase();
  try {
    return new Intl.NumberFormat(userPanelLocale(lang), {
      style: 'currency',
      currency: cur.length === 3 ? cur : 'UZS',
      maximumFractionDigits: cur === 'UZS' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${cur}`;
  }
}

function mapKvOrderTypeToCategory(
  orderType: string,
): 'market' | 'shop' | 'rent' | 'food' | 'auction' {
  const x = String(orderType || '').toLowerCase().trim();
  if (x === 'shop') return 'shop';
  if (x === 'food' || x === 'restaurant') return 'food';
  if (x === 'rental') return 'rent';
  return 'market';
}

function pickItemImageFromKvLine(it: Record<string, unknown>): string | null {
  const u = (v: unknown) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (s.startsWith('http') || s.startsWith('//') || s.startsWith('data:') || s.startsWith('/')) return s;
    return '';
  };
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);
  const product = obj(it.product);
  const variant = obj(it.variant);
  const dish = obj(it.dishDetails);
  return (
    u(it.image) ||
    u(it.imageUrl) ||
    u(it.thumbnail) ||
    u(it.productImage) ||
    u(it.photo) ||
    u(product?.image) ||
    u(variant?.image) ||
    u(it.selectedVariantImage) ||
    u(obj(it.variantDetails)?.image) ||
    u(dish?.image) ||
    null
  );
}

function kvItemsToPreviewLines(items: unknown): ProfileOrderLinePreview[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 5).map((raw) => {
    const it = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const qty = Math.max(1, Number(it.quantity || 1));
    const vd = it.variantDetails as Record<string, unknown> | undefined;
    const vr = it.variant as Record<string, unknown> | undefined;
    const unit = Number(it.price ?? it.unitPrice ?? vd?.price ?? vr?.price ?? 0);
    const lineTotal = Number(
      it.total ?? it.lineTotal ?? it.subtotal ?? (Number.isFinite(unit) ? unit * qty : 0),
    );
    const pr = it.product as Record<string, unknown> | undefined;
    const title =
      String(it.name ?? it.title ?? it.dishName ?? pr?.name ?? 'Mahsulot').trim() || 'Mahsulot';
    const subtitle = String(
      it.variantName ?? it.selectedVariantName ?? vd?.name ?? vr?.name ?? '',
    ).trim();
    const productUuid =
      it.productUuid != null && String(it.productUuid).trim()
        ? String(it.productUuid).trim()
        : it.productId != null && String(it.productId).trim()
          ? String(it.productId).trim()
          : pr?.id != null && String(pr.id).trim()
            ? String(pr.id).trim()
            : undefined;
    const productVariantId =
      it.selectedVariantId != null && String(it.selectedVariantId).trim()
        ? String(it.selectedVariantId).trim()
        : undefined;
    let imageUrl = pickItemImageFromKvLine(it);
    if (!imageUrl && (productUuid || title)) {
      imageUrl = tryResolveImageFromBranchCatalog({
        productId: productUuid,
        variantId: productVariantId,
        productName: title,
        variantName: subtitle,
      });
    }
    return {
      imageUrl,
      title,
      subtitle: subtitle || undefined,
      quantity: qty,
      lineTotal: Number.isFinite(lineTotal) ? lineTotal : 0,
      unitPrice: Number.isFinite(unit) ? unit : undefined,
      productId: productUuid,
      productVariantId,
    };
  });
}

function pickPrimaryProductMediaUrl(
  product: { media?: Array<Record<string, unknown>> } | null | undefined,
  variantId: string | null,
): string | null {
  const rows = Array.isArray(product?.media) ? product!.media! : [];
  const images = rows.filter((m) => {
    const type = String(m.media_type || 'image').toLowerCase();
    const url = String(m.media_url || '').trim();
    return (type === 'image' || !m.media_type) && url.length > 0;
  });
  if (images.length === 0) return null;
  if (variantId) {
    const vMatch = images.find((m) => m.variant_id && String(m.variant_id) === variantId);
    const u = vMatch && String(vMatch.media_url || '').trim();
    if (u) return u;
  }
  const primary = images.find((m) => m.is_primary === true);
  if (primary && String(primary.media_url || '').trim()) return String(primary.media_url).trim();
  const sorted = [...images].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
  );
  return String(sorted[0]?.media_url || '').trim() || null;
}

function relationalItemsToPreviewLines(
  groups: Array<Record<string, unknown>> | undefined,
): ProfileOrderLinePreview[] {
  const g0 = Array.isArray(groups) && groups[0] ? groups[0] : null;
  const items = (g0?.items as Array<Record<string, unknown>> | undefined) || [];
  if (!Array.isArray(items)) return [];
  return items.slice(0, 5).map((it) => {
    const qty = Math.max(1, Number(it.quantity || 1));
    const unit = Number(it.unit_price || 0);
    const total = Number(it.total_amount ?? unit * qty);
    const rawProduct = it.product;
    const product = Array.isArray(rawProduct)
      ? (rawProduct[0] as { media?: Array<Record<string, unknown>> } | undefined)
      : (rawProduct as { media?: Array<Record<string, unknown>> } | undefined);
    const vid = it.product_variant_id ? String(it.product_variant_id) : null;
    let imageUrl = product ? pickPrimaryProductMediaUrl(product, vid) : null;
    const title = String(it.product_name || 'Mahsulot').trim() || 'Mahsulot';
    const subtitle = String(it.variant_name || '').trim();
    const productId = it.product_id != null ? String(it.product_id) : undefined;
    if (!imageUrl) {
      imageUrl = tryResolveImageFromBranchCatalog({
        productId,
        variantId: vid,
        productName: title,
        variantName: subtitle,
      });
    }
    return {
      imageUrl,
      title,
      subtitle: subtitle || undefined,
      quantity: qty,
      lineTotal: Number.isFinite(total) ? total : 0,
      unitPrice: Number.isFinite(unit) ? unit : undefined,
      productId,
      productVariantId: vid || undefined,
    };
  });
}

function getProfileOrderPreviewLines(order: Record<string, unknown>): ProfileOrderLinePreview[] {
  if (Array.isArray(order.previewLines) && order.previewLines.length > 0) {
    return order.previewLines as ProfileOrderLinePreview[];
  }
  return kvItemsToPreviewLines(order.items);
}

function getProfileOrderCardMeta(order: Record<string, unknown>, lang: Language) {
  const currency = String(order.currency_code || 'UZS');
  const isRel = order.relational === true;
  const totalRaw = isRel ? order.total : order.finalTotal ?? order.totalAmount ?? order.total;
  const total = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw);
  const shippingRaw = order.shippingAmount ?? order.deliveryPrice;
  const shipping =
    typeof shippingRaw === 'number' ? shippingRaw : Number(shippingRaw || 0);
  const lines = getProfileOrderPreviewLines(order);
  const itemCount =
    typeof order.item_count === 'number'
      ? order.item_count
      : Array.isArray(order.items)
        ? order.items.length
        : lines.reduce((s, l) => s + l.quantity, 0);
  const categoryKey = String(order.category || 'market');
  const rawPay = String(order.payment_status || order.paymentStatus || '').toLowerCase();
  return {
    currency,
    total: Number.isFinite(total) ? total : null,
    shipping: Number.isFinite(shipping) && shipping > 0 ? shipping : null,
    itemCount: itemCount || lines.length,
    lines,
    paymentLabel: profilePaymentStatus(lang, rawPay),
    categoryLabel: profileCategoryLabel(lang, categoryKey),
  };
}

/** KV buyurtma: filtrlash va mijoz tekshiruvi uchun qisqa maydonlar */
function normalizeKvOrderForProfile(o: any) {
  if (!o || o.relational) return o;
  const s = String(o.status || '').toLowerCase().trim();
  let orderStatus: 'active' | 'completed' | 'cancelled' = 'active';
  if (s === 'cancelled' || s === 'canceled' || s === 'rejected') orderStatus = 'cancelled';
  else if (s === 'delivered' || s === 'completed') orderStatus = 'completed';
  const refundWait = o.refundPending === true && (s === 'cancelled' || s === 'canceled');
  const statusLabel =
    s === 'awaiting_receipt'
      ? 'Kuryer topshirdi — tekshiring'
      : s === 'delivered'
        ? 'Yetkazildi'
        : refundWait
          ? 'Bekor qilingan — to‘lov qaytarish kutilmoqda'
          : s === 'cancelled' || s === 'canceled' || s === 'rejected'
            ? 'Bekor qilingan'
            : typeof o.status === 'string' && o.status.trim()
              ? o.status
              : 'Jarayonda';
  return {
    ...o,
    orderStatus,
    status: statusLabel,
    awaitingCustomerReceipt: s === 'awaiting_receipt',
    category: mapKvOrderTypeToCategory(String(o.orderType || '')),
    previewLines: kvItemsToPreviewLines(o.items),
    shippingAmount: Number(o.deliveryPrice) || 0,
    lineRowCount: Array.isArray(o.items) ? o.items.length : 0,
  };
}

/** `/v2/orders` javobidan profil kartochkasi uchun umumlashtirilgan obyekt */
function relationalOrderToUi(row: Record<string, unknown>) {
  const groups = row.groups as Array<Record<string, unknown>> | undefined;
  const g0 = Array.isArray(groups) && groups[0] ? groups[0] : null;
  const vertical = String(g0?.vertical_type || 'market');
  const uiStatus = mapRelationalOrderStatus(String(row.status || ''));
  const statusLabel =
    uiStatus === 'completed' ? 'Yakunlangan' : uiStatus === 'cancelled' ? 'Bekor qilingan' : 'Faol';
  const previewLines = relationalItemsToPreviewLines(groups);
  const lineRowCount = Array.isArray(g0?.items) ? g0.items.length : 0;
  return {
    id: row.id,
    orderNumber: row.order_number,
    orderStatus: uiStatus,
    status: statusLabel,
    category: mapRelationalVerticalToCategory(vertical),
    total: row.total_amount,
    subtotal: row.subtotal_amount,
    shippingAmount: row.shipping_amount,
    createdAt: row.created_at,
    currency_code: row.currency_code,
    item_count: row.item_count,
    payment_status: row.payment_status,
    paymentStatus: row.payment_status,
    relational: true as const,
    previewLines,
    lineRowCount,
  };
}

function mapRentalKvStatusToProfile(s: string): 'active' | 'completed' | 'cancelled' {
  const x = String(s || '').toLowerCase();
  if (x === 'cancelled') return 'cancelled';
  if (x === 'returned') return 'completed';
  return 'active';
}

function rentalKvStatusLabel(raw: string): string {
  const x = String(raw || '').toLowerCase();
  if (x === 'returned') return 'Yakunlangan';
  if (x === 'cancelled') return 'Bekor qilingan';
  if (x === 'extended') return 'Muddati cho‘zilgan';
  return 'Faol';
}

/** KV ijara buyurtmasi → profil «Buyurtmalar» kartochkasi (category rent) */
function rentalKvOrderToProfileCard(r: Record<string, unknown>) {
  const orderStatus = mapRentalKvStatusToProfile(String(r.status || ''));
  const name = String(r.productName || 'Ijara').trim() || 'Ijara';
  const displayName = name.length > 28 ? `${name.slice(0, 28)}…` : name;
  const imgRaw = String(r.productImage || r.image || '').trim();
  const lineTotal = Number(r.totalPrice ?? r.pricePerPeriod ?? 0) || 0;
  return {
    id: r.id,
    orderNumber: displayName,
    orderStatus,
    status: rentalKvStatusLabel(String(r.status || '')),
    category: 'rent' as const,
    createdAt: r.createdAt,
    total: r.totalPrice ?? r.pricePerPeriod,
    currency_code: 'UZS',
    rentalKv: true as const,
    relational: false as const,
    awaitingCustomerReceipt: false,
    previewLines: [
      {
        imageUrl: imgRaw && (imgRaw.startsWith('http') || imgRaw.startsWith('/') || imgRaw.startsWith('data:'))
          ? imgRaw
          : null,
        title: displayName,
        quantity: 1,
        lineTotal,
      },
    ] satisfies ProfileOrderLinePreview[],
    paymentStatus: 'paid',
    lineRowCount: 1,
  };
}

interface ProfileViewProps {
  onOpenBonus?: () => void;
  /** Masalan market bo‘limidan «Barchasi» — Buyurtmalar tabida shu kategoriya tanlanadi */
  initialOrderCategory?: 'all' | 'market' | 'shop' | 'rent' | 'food' | 'auction';
}

export function ProfileView({ onOpenBonus, initialOrderCategory }: ProfileViewProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isCreatePortfolioOpen, setIsCreatePortfolioOpen] = useState(false);
  const [isAddListingOpen, setIsAddListingOpen] = useState(false);
  const [isEditListingOpen, setIsEditListingOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | 'orders'
    | 'favorites'
    | 'portfolio'
    | 'ads'
  >('orders');
  const [orderCategory, setOrderCategory] = useState<'all' | 'market' | 'shop' | 'rent' | 'food' | 'auction'>('all');
  const [orderStatus, setOrderStatus] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [favoriteCategory, setFavoriteCategory] = useState<'all' | 'market' | 'shop' | 'rent' | 'food' | 'auction'>('all');
  
  // Ads state
  const [listingCategory, setListingCategory] = useState<'home' | 'car'>('home');
  const [myListings, setMyListings] = useState<any[]>([]);
  const [selectedListing, setSelectedListing] = useState<any>(null); // For editing
  
  // Portfolio state
  const [myPortfolios, setMyPortfolios] = useState<any[]>([]);
  const [portfolioDetail, setPortfolioDetail] = useState<any | null>(null);
  const [listingPreview, setListingPreview] = useState<any | null>(null);

  const { theme, accentColor, language } = useTheme();
  const t = useUserPanelT();
  const { isAuthenticated, user, session, signout, smsSignin } = useAuth();
  const {
    favorites: localFavorites,
    favoriteOrders,
    toggleFavoriteOrder,
    isFavoriteOrder,
    removeFavoriteOrder,
  } = useFavorites();
  const isDark = theme === 'dark';

  const apiBaseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? DEV_API_BASE_URL
      : API_BASE_URL;
  
  const [userData, setUserData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  /** Buyurtmalar ro‘yxati alohida yuklanadi — profil boshlig‘i bilan aralashmasin */
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [reviewModalOrder, setReviewModalOrder] = useState<any | null>(null);
  const [deleteListingId, setDeleteListingId] = useState<string | null>(null);
  const [deleteListingBusy, setDeleteListingBusy] = useState(false);
  const [receiptActionOrderId, setReceiptActionOrderId] = useState<string | null>(null);
  const [myRentals, setMyRentals] = useState<any[]>([]);
  const [myRentalsLoading, setMyRentalsLoading] = useState(false);
  const [profileVisibilityTick, setProfileVisibilityTick] = useState(0);
  useVisibilityRefetch(() => setProfileVisibilityTick((t) => t + 1));

  // Get access token
  const accessToken = session?.access_token || '';

  // (Removed extra profile sections per request)

  // Check token format validity
  const [showTokenWarning, setShowTokenWarning] = useState(false);
  
  useEffect(() => {
    if (accessToken) {
      const tokenParts = accessToken.split('-');
      // Valid token should have at least 7 parts (UUID has 5 dashes + timestamp + random)
      if (tokenParts.length < 7) {
        console.warn('⚠️ Invalid token format detected in ProfileView!');
        console.warn('⚠️ Token parts:', tokenParts.length, '(expected: 7+)');
        console.warn('⚠️ Token:', accessToken);
        console.warn('⚠️ This token appears to be just a userId, clearing localStorage...');
        
        // Automatically clear localStorage and session
        localStorage.removeItem('sms_user');
        localStorage.removeItem('sms_session');
        
        setShowTokenWarning(true);
        
        // Auto logout after 2 seconds
        setTimeout(() => {
          signout();
          alert(t('profile.tokenInvalid'));
        }, 2000);
      } else {
        setShowTokenWarning(false);
      }
    }
  }, [accessToken, signout]);

  useEffect(() => {
    if (!initialOrderCategory) return;
    setActiveTab('orders');
    setOrderCategory(initialOrderCategory);
  }, [initialOrderCategory]);

  /** Birinchi paint dan oldin: buyurtmalar yuklanishini ko‘rsatish (bo‘sh ro‘yxat «chaqnashi» bo‘lmasin) */
  useLayoutEffect(() => {
    if (!isAuthenticated) {
      setOrdersLoading(false);
      return;
    }
    if (user?.id && accessToken) {
      setOrdersLoading(true);
    }
  }, [isAuthenticated, user?.id, accessToken]);

  // Log session and token for debugging
  useEffect(() => {
    devLog('\n📊 ===== PROFILE VIEW SESSION STATE =====');
    devLog('🔐 isAuthenticated:', isAuthenticated);
    devLog('👤 user:', user ? {
      id: user.id,
      phone: user.phone,
      email: user.email
    } : 'NULL');
    devLog('🎫 session object:', session);
    devLog('🎫 session:', session ? {
      hasAccessToken: !!session.access_token,
      accessTokenFull: session.access_token || 'MISSING',
      accessTokenPreview: session.access_token ? `${session.access_token.substring(0, 30)}... (length: ${session.access_token.length})` : 'MISSING',
      expires_at: session.expires_at
    } : 'NULL');
    devLog('🔑 accessToken variable (from session?.access_token):', accessToken ? `${accessToken.substring(0, 30)}... (length: ${accessToken.length})` : 'EMPTY/MISSING');
    
    // Check localStorage directly
    const storedSession = localStorage.getItem('sms_session');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        devLog('💾 localStorage session (full):', parsed);
        devLog('💾 localStorage session:', {
          hasAccessToken: !!parsed.access_token,
          tokenFull: parsed.access_token || 'MISSING',
          tokenPreview: parsed.access_token ? `${parsed.access_token.substring(0, 30)}...` : 'MISSING'
        });
      } catch (e) {
        console.error('❌ Failed to parse localStorage session');
      }
    } else {
      devLog('💾 localStorage session: NULL');
    }
    
    devLog('📊 ===================================\n');
  }, [isAuthenticated, user, session, accessToken]);

  useEffect(() => {
    // Check if user is authenticated before fetching data
    if (!isAuthenticated) {
      devLog('🔐 User not authenticated, showing login modal');
      setIsAuthOpen(true);
      setLoading(false);
      setOrdersLoading(false);
      return;
    }

    if (isAuthenticated && user && accessToken) {
      fetchUserData();
      fetchOrders();
      fetchFavorites();
      fetchPortfolios();
      fetchMyListings();
    } else {
      devLog('⚠️ User authenticated but missing token/session');
      setLoading(false);
      setOrdersLoading(false);
    }
  }, [isAuthenticated, user, accessToken, userData?.phone, profileVisibilityTick]);

  const fetchUserData = async () => {
    try {
      // Fetch profile from backend (single source of truth)
      const response = await fetch(`${apiBaseUrl}/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
          'X-Access-Token': accessToken,
        },
      });

      if (response.ok) {
        const data = await response.json();
        devLog('✅ Profile loaded from backend:', data);
        setUserData(data);
      } else {
        console.error('Failed to fetch user profile:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get token with fallback
  const getValidToken = () => {
    try {
      devLog('🔍 ===== TOKEN DEBUGGING =====');
      devLog('📱 Session object:', session);
      devLog('🔑 Session token:', session?.access_token);
      
      // Try session first
      if (session?.access_token) {
        devLog('✅ Using session token:', session.access_token.substring(0, 20) + '...');
        return session.access_token;
      }
      
      // Try localStorage
      const storedSession = localStorage.getItem('sms_session');
      devLog('💾 localStorage session:', storedSession ? 'EXISTS' : 'NULL');
      
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        devLog('🔓 Parsed session token:', parsed.access_token ? 'EXISTS' : 'NULL');
        if (parsed.access_token) {
          devLog('✅ Using localStorage token:', parsed.access_token.substring(0, 20) + '...');
          return parsed.access_token;
        }
      }
      
      devLog('❌ NO TOKEN FOUND!');
      devLog('🔍 ===== TOKEN DEBUGGING END =====');
      return null;
    } catch (error) {
      console.error('❌ Error getting token:', error);
      return null;
    }
  };

  // Helper function to handle 401 errors
  const handleAuthError = () => {
    devLog('🔄 Authentication error detected, clearing session...');
    localStorage.removeItem('sms_user');
    localStorage.removeItem('sms_session');
    setIsAuthOpen(true);
    toast.error(t('profile.sessionExpired'));
  };

  const fetchOrders = async () => {
    const token = getValidToken();

    if (!token) {
      setOrdersLoading(false);
      handleAuthError();
      return;
    }

    setOrdersLoading(true);
    devLog('🔑 Fetching orders (parallel KV + v2 + ijara):', token.substring(0, 20) + '...');

    const headers = {
      Authorization: `Bearer ${publicAnonKey}`,
      apikey: publicAnonKey,
      'X-Access-Token': token,
      'Content-Type': 'application/json',
    };

    const rawPhone =
      userData?.phone ||
      user?.phone ||
      (user as { user_metadata?: { phone?: string } })?.user_metadata?.phone;
    const phonePk = normalizePhoneForRentalsApi(String(rawPhone || ''));
    const rentalsMinimalHeaders = {
      Authorization: `Bearer ${publicAnonKey}`,
      apikey: publicAnonKey,
    };

    try {
      const parallel: Promise<Response>[] = [
        fetch(`${apiBaseUrl}/orders`, { headers }),
        fetch(`${apiBaseUrl}/v2/orders?limit=50`, { headers }),
      ];
      if (phonePk.length >= 9) {
        setMyRentalsLoading(true);
        parallel.push(
          fetch(
            `${apiBaseUrl}/rentals/my-rentals?phone=${encodeURIComponent(phonePk)}`,
            { headers: rentalsMinimalHeaders },
          ),
        );
      } else {
        setMyRentalsLoading(false);
        setMyRentals([]);
      }

      const results = await Promise.all(parallel);
      const ordersRes = results[0];
      const v2res = results[1];
      const rentalsRes = phonePk.length >= 9 ? results[2] : null;

      let list: any[] = [];

      const kvById = new Map<string, any>();

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        for (const row of data.orders || []) {
          const o = normalizeKvOrderForProfile(row);
          kvById.set(String(o.id), o);
        }
      } else {
        console.error('❌ Orders fetch failed:', ordersRes.status, ordersRes.statusText);
        if (ordersRes.status === 401) handleAuthError();
      }

      if (v2res.ok) {
        const v2json = await v2res.json();
        const v2Raw = Array.isArray(v2json.items) ? v2json.items : [];
        const fromV2: any[] = [];
        for (const r of v2Raw) {
          const ui = relationalOrderToUi(r as Record<string, unknown>);
          const id = String(ui.id);
          const kv = kvById.get(id);
          if (kv) {
            kvById.delete(id);
            fromV2.push(mergeRelationalAndKvOrder(ui as Record<string, unknown>, kv));
          } else {
            fromV2.push(ui);
          }
        }
        list = [...fromV2, ...kvById.values()];
      } else {
        list = [...kvById.values()];
        if (v2res.status === 401) handleAuthError();
      }

      if (rentalsRes) {
        try {
          const rj = await rentalsRes.json().catch(() => ({}));
          if (rentalsRes.ok && rj.success && Array.isArray(rj.orders)) {
            list = list.filter((o: any) => !o.rentalKv);
            const seenIds = new Set(list.map((o: any) => String(o.id)));
            for (const r of rj.orders) {
              const card = rentalKvOrderToProfileCard(r as Record<string, unknown>);
              if (!seenIds.has(String(card.id))) {
                seenIds.add(String(card.id));
                list.push(card);
              }
            }
            const activeForBanner = rj.orders.filter((o: { status?: string }) => {
              const s = String(o?.status || '').toLowerCase();
              return s === 'active' || s === 'extended';
            });
            setMyRentals(activeForBanner);
          } else {
            setMyRentals([]);
          }
        } catch {
          setMyRentals([]);
        } finally {
          setMyRentalsLoading(false);
        }
      }

      list = list.map((o) => enrichOrderPreviewLineImages(o as Record<string, unknown>));

      list.sort(
        (a: any, b: any) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
      setOrders(list);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const postOrderActionHeaders = (token: string) => ({
    Authorization: `Bearer ${publicAnonKey}`,
    apikey: publicAnonKey,
    'X-Access-Token': token,
    'Content-Type': 'application/json',
  });

  const confirmOrderDelivery = async (order: { id: string }) => {
    const token = getValidToken();
    if (!token) {
      handleAuthError();
      return;
    }
    const oid = String(order.id);
    setReceiptActionOrderId(oid);
    try {
      const res = await fetch(
        `${apiBaseUrl}/orders/${encodeURIComponent(oid)}/confirm-delivery`,
        {
          method: 'POST',
          headers: postOrderActionHeaders(token),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || t('profile.confirmNotVerified'));
        return;
      }
      toast.success(t('profile.orderAccepted'));
      await fetchOrders();
    } catch (e) {
      console.error(e);
      toast.error(t('profile.confirmError'));
    } finally {
      setReceiptActionOrderId(null);
    }
  };

  const cancelAwaitingReceiptOrder = async (order: { id: string }) => {
    const ok = window.confirm(t('profile.cancelOrderConfirm'));
    if (!ok) return;
    const token = getValidToken();
    if (!token) {
      handleAuthError();
      return;
    }
    const oid = String(order.id);
    setReceiptActionOrderId(oid);
    try {
      const res = await fetch(`${apiBaseUrl}/orders/cancel`, {
        method: 'POST',
        headers: postOrderActionHeaders(token),
        body: JSON.stringify({ orderId: oid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error(data.error || t('profile.cancelNotDone'));
        return;
      }
      toast.success(t('profile.orderCancelled'));
      await fetchOrders();
    } catch (e) {
      console.error(e);
      toast.error(t('profile.cancelError'));
    } finally {
      setReceiptActionOrderId(null);
    }
  };

  const fetchFavorites = async () => {
    try {
      const token = getValidToken();
      
      if (!token) {
        handleAuthError();
        return;
      }
      
      devLog('🔑 Fetching favorites with token:', token.substring(0, 20) + '...');
      
      const response = await fetch(
        `${API_BASE_URL}/favorites`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey,
            'X-Access-Token': token,
            'Content-Type': 'application/json',
          },
        }
      );

      devLog('📦 Favorites response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites || []);
      } else {
        console.error('❌ Favorites fetch failed:', response.status, response.statusText);
        if (response.status === 401) {
          handleAuthError();
        }
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const fetchPortfolios = async () => {
    try {
      const currentAccessToken = getValidToken();
      
      if (!currentAccessToken) {
        handleAuthError();
        return;
      }

      devLog('🔑 Fetching portfolios with token:', currentAccessToken.substring(0, 20) + '...');

      const response = await fetch(`${API_BASE_URL}/services/my-portfolios`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
          'X-Access-Token': currentAccessToken,
        },
      });

      devLog('📊 Portfolios response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        devLog('✅ My portfolios loaded:', data);
        setMyPortfolios(data.portfolios || []);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch my portfolios:', response.status, errorText);
        if (response.status === 401) {
          handleAuthError();
        }
      }
    } catch (error) {
      console.error('Error fetching my portfolios:', error);
    }
  };

  const fetchMyListings = async () => {
    try {
      devLog('📋 ===== FETCHING MY LISTINGS =====');
      
      const currentAccessToken = getValidToken();
      
      if (!currentAccessToken) {
        handleAuthError();
        return;
      }

      devLog('🔑 Using token:', currentAccessToken.substring(0, 30) + '...');

      const response = await fetch(`${API_BASE_URL}/listings/my`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
          'X-Access-Token': currentAccessToken,
        },
      });

      devLog('📡 Listings response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        devLog('✅ My listings loaded - FULL DATA:', JSON.stringify(data, null, 2));
        devLog('✅ Listings array:', data.listings);
        devLog('✅ Listings count:', data.listings?.length || 0);
        
        if (data.listings && data.listings.length > 0) {
          devLog('✅ First listing sample:', data.listings[0]);
        }
        
        setMyListings(data.listings || []);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch my listings:', response.status, errorText);
        if (response.status === 401) {
          handleAuthError();
        }
      }
    } catch (error) {
      console.error('❌ Error fetching my listings:', error);
    }
  };

  const requestDeleteListing = (listingId: string) => {
    setDeleteListingId(listingId);
  };

  const closeDeleteListingModal = () => {
    if (deleteListingBusy) return;
    setDeleteListingId(null);
  };

  const confirmDeleteListing = async () => {
    const listingId = deleteListingId;
    if (!listingId?.trim()) return;

    setDeleteListingBusy(true);
    try {
      devLog('🗑️ ===== DELETE LISTING =====');
      devLog('🔑 Listing ID:', listingId);
      devLog('🔑 Access Token:', accessToken?.substring(0, 30) + '...');

      const response = await fetch(`${apiBaseUrl}/listing/${encodeURIComponent(listingId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'X-Access-Token': accessToken,
        },
      });

      devLog('📡 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        devLog('✅ Listing deleted successfully:', data);
        toast.success(t('profile.listingDeleted'));
        setDeleteListingId(null);
        fetchMyListings();
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to delete listing:', response.status, errorText);
        toast.error(`${t('profile.listingDeleteError')}: ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error deleting listing:', error);
      toast.error(t('profile.listingDeleteError'));
    } finally {
      setDeleteListingBusy(false);
    }
  };

  const handleEditListing = (listing: any) => {
    // Open edit modal with listing data
    devLog('✏️ Edit listing:', listing);
    setSelectedListing(listing);
    setIsEditListingOpen(true);
  };

  const handleSignOut = () => {
    devLog('🚪 ===== SIGNING OUT =====');
    devLog('Clearing localStorage and session...');
    
    // Clear localStorage first
    localStorage.removeItem('sms_user');
    localStorage.removeItem('sms_session');
    devLog('✅ localStorage cleared');
    
    // Then sign out from context
    signout();
    
    // Clear local state
    setUserData(null);
    setOrders([]);
    setOrdersLoading(false);
    setMyRentals([]);
    setFavorites([]);
    
    devLog('✅ Sign out complete');
    devLog('🚪 ===== END SIGN OUT =====');
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const categoryMatch = orderCategory === 'all' || order.category === orderCategory;
    const statusMatch = orderStatus === 'all' || order.orderStatus === orderStatus;
    return categoryMatch && statusMatch;
  });

  const buildListKey = (
    prefix: string,
    item: Record<string, unknown>,
    index: number,
    candidateFields: string[]
  ) => {
    const keyParts = candidateFields
      .map(field => item[field])
      .filter((value): value is string | number => value !== undefined && value !== null && value !== '');

    return keyParts.length > 0 ? `${prefix}-${keyParts.join('-')}` : `${prefix}-${index}`;
  };

  // Filter favorites
  const filteredFavorites = favorites.filter(fav => {
    return favoriteCategory === 'all' || fav.itemData?.category === favoriteCategory;
  });

  // Stats
  const stats = {
    orders: orders.length,
    favorites: localFavorites.length + favoriteOrders.length,
    portfolio: myPortfolios.length,
  };

  const toFavoriteOrderEntry = (order: any): FavoriteOrderEntry => ({
    orderId: String(order.id),
    orderNumber: order.orderNumber != null ? String(order.orderNumber) : undefined,
    statusLabel: profileOrderBadgeLabel(language, order),
    createdAt: order.createdAt,
    category: order.category,
  });

  // Agar tizimga kirmagan bo'lsa
  if (!isAuthenticated) {
    return (
      <>
        <div
          className={`min-h-[100dvh] w-full max-w-full min-w-0 box-border ${isDark ? 'bg-black' : 'bg-background'}`}
          style={{ paddingBottom: 'max(0.75rem, var(--app-safe-bottom))' }}
        >
          {/* Settings Button */}
          <div
            className="relative pb-6 px-3 sm:px-4"
            style={{ paddingTop: 'max(0.75rem, var(--app-safe-top))' }}
          >
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="absolute top-2 right-2 sm:top-3 sm:right-3 p-2.5 rounded-xl transition-all active:scale-90"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
                backdropFilter: 'blur(20px)',
                boxShadow: isDark 
                  ? '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                  : '0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                border: isDark ? '0.5px solid rgba(255, 255, 255, 0.2)' : '0.5px solid rgba(0, 0, 0, 0.1)',
              }}
            >
              <Settings className="size-5" strokeWidth={2} style={{ color: isDark ? '#ffffff' : '#374151' }} />
            </button>
          </div>

          {/* Center Content */}
          <div
            className="flex flex-col items-center justify-center px-3 sm:px-4"
            style={{ minHeight: 'min(72dvh, calc(100dvh - 14rem))' }}
          >
            <div className="w-full max-w-md">
              <div className="flex justify-center mb-6">
                <div 
                  className="relative w-24 h-24 rounded-full flex items-center justify-center"
                  style={{
                    backgroundImage: accentColor.gradient,
                    boxShadow: isDark 
                      ? `0 12px 40px ${accentColor.color}80, 0 6px 20px rgba(0, 0, 0, 0.5)`
                      : `0 8px 32px ${accentColor.color}4d`,
                  }}
                >
                  <User className="size-12 text-white" strokeWidth={1.5} />
                </div>
              </div>

              <h2 
                className="text-2xl font-bold text-center mb-2" 
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {t('profile.loginTitle')}
              </h2>
              <p 
                className="text-center mb-8 text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                {t('profile.loginSubtitle')}
              </p>

              <button
                onClick={() => setIsAuthOpen(true)}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl transition-all active:scale-98 mb-4"
                style={{
                  backgroundImage: accentColor.gradient,
                  boxShadow: isDark 
                    ? `0 8px 24px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.25)`
                    : `0 6px 20px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                }}
              >
                <User className="size-5 text-white" strokeWidth={2.5} />
                <span className="font-bold text-white text-lg">
                  {t('profile.signIn')}
                </span>
              </button>
            </div>
          </div>
        </div>

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          platform="ios"
        />

        <SMSAuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={(user, session) => {
            smsSignin(user, session);
            setIsAuthOpen(false);
          }}
        />
      </>
    );
  }

  const rawPhoneForRentals =
    userData?.phone ||
    user?.phone ||
    (user as { user_metadata?: { phone?: string } })?.user_metadata?.phone;
  const rentalPhonePk = normalizePhoneForRentalsApi(String(rawPhoneForRentals || ''));

  // To'liq profil - iOS dizayn
  return (
    <>
      {/* Main Scrollable Container — min-w-0: kichik ekran / Telegram ichida overflow oldini oladi */}
      <div
        className={`min-h-0 w-full max-w-full min-w-0 overflow-x-hidden ${isDark ? 'bg-black' : 'bg-background'}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? 'rgba(20, 184, 166, 0.4) transparent' : 'rgba(20, 184, 166, 0.3) transparent',
          paddingBottom: 'max(0.75rem, var(--app-safe-bottom))',
        }}
      >
        {/* Profile Header - Sticky */}
        <div 
          className="sticky top-0 z-30 pb-6 sm:pb-8 px-3 sm:px-4 pt-2 sm:pt-4"
          style={{
            backgroundColor: isDark ? '#000000' : '#fafafa',
            backgroundImage: isDark
              ? 'linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.97))'
              : 'linear-gradient(to bottom, #fafafa, rgba(250, 250, 250, 0.98))',
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          }}
        >
          {/* Settings Button */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 p-2.5 rounded-xl transition-all active:scale-90 z-10"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
                : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
              backdropFilter: 'blur(20px)',
              boxShadow: isDark 
                ? '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              border: isDark ? '0.5px solid rgba(255, 255, 255, 0.2)' : '0.5px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <Settings className="size-5" strokeWidth={2} style={{ color: isDark ? '#ffffff' : '#374151' }} />
          </button>

          {/* Profile Avatar */}
          <div className="flex flex-col items-center w-full min-w-0 px-1">
            <div 
              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full mb-3 sm:mb-4 group shrink-0"
              style={{
                backgroundImage: accentColor.gradient,
                boxShadow: isDark 
                  ? `0 12px 40px ${accentColor.color}80, 0 6px 20px rgba(0, 0, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3)`
                  : `0 8px 32px ${accentColor.color}4d, 0 4px 16px ${accentColor.color}33, inset 0 2px 0 rgba(255, 255, 255, 0.5)`,
                border: `3px solid ${accentColor.color}4d`,
              }}
            >
              {userData?.profileImage ? (
                <img 
                  src={userData.profileImage} 
                  alt="Profile"
                  className="absolute inset-0 w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 rounded-full flex items-center justify-center">
                  <User className="size-16 text-white" strokeWidth={1.5} />
                </div>
              )}
              
              {/* Edit Button */}
              <button
                onClick={() => setIsProfileEditOpen(true)}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{
                  backgroundImage: accentColor.gradient,
                  boxShadow: isDark 
                    ? `0 4px 16px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.25)`
                    : `0 3px 12px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                  border: `2px solid ${isDark ? '#000' : '#fff'}`,
                }}
              >
                <Edit className="size-4 text-white" strokeWidth={2.5} />
              </button>
            </div>

            {/* User Info */}
            {loading ? (
              <div className="animate-pulse space-y-2 flex flex-col items-center">
                <div className="h-6 w-32 rounded" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                <div className="h-4 w-24 rounded" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                <div className="h-4 w-28 rounded" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
              </div>
            ) : (
              <>
                <h1 
                  className="text-xl sm:text-2xl font-bold mb-1 text-center max-w-full px-1 break-words" 
                  style={{ 
                    color: isDark ? '#ffffff' : '#111827',
                    textShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.5)' : 'none' 
                  }}
                >
                  {userData?.fullName || userData?.firstName || t('profile.userFallback')}
                </h1>
                <p 
                  className="text-xs sm:text-sm mb-1 text-center max-w-full truncate px-1"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  {userData?.phone || user?.phone || user?.user_metadata?.phone || ''}
                </p>
                
                {/* Additional User Details */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4 max-w-full">
                  {userData?.birthDate && (
                    <div 
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                        border: isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <Calendar className="size-3.5" />
                      <span>
                        {new Date(userData.birthDate).toLocaleDateString(userPanelLocale(language), {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  
                  {userData?.gender && (
                    <div 
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                        border: isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <User className="size-3.5" />
                      <span>
                        {userData.gender === 'male'
                          ? t('profile.genderMale')
                          : userData.gender === 'female'
                            ? t('profile.genderFemale')
                            : ''}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Stats */}
            <div className="flex items-stretch justify-center gap-3 sm:gap-5 md:gap-6 max-w-full min-w-0">
              <div className="flex flex-col items-center min-w-0 flex-1 max-w-[33%]">
                <span 
                  className="text-lg sm:text-2xl font-bold mb-0.5 tabular-nums"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {stats.orders}
                </span>
                <span 
                  className="text-[10px] sm:text-xs text-center leading-tight px-0.5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  {t('profile.statOrders')}
                </span>
              </div>
              <div 
                className="w-px shrink-0 self-stretch min-h-[2.25rem]"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              />
              <div className="flex flex-col items-center min-w-0 flex-1 max-w-[33%]">
                <span 
                  className="text-lg sm:text-2xl font-bold mb-0.5 tabular-nums"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {stats.favorites}
                </span>
                <span 
                  className="text-[10px] sm:text-xs text-center leading-tight px-0.5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  {t('profile.statFavorites')}
                </span>
              </div>
              <div 
                className="w-px shrink-0 self-stretch min-h-[2.25rem]"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              />
              <div className="flex flex-col items-center min-w-0 flex-1 max-w-[33%]">
                <span 
                  className="text-lg sm:text-2xl font-bold mb-0.5 tabular-nums"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {stats.portfolio}
                </span>
                <span 
                  className="text-[10px] sm:text-xs text-center leading-tight px-0.5"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  {t('profile.statPortfolio')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {onOpenBonus && (
          <div className="px-3 sm:px-4 mb-4">
            <button
              onClick={onOpenBonus}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl transition-all active:scale-[0.99]"
              style={{
                background: isDark
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.05))'
                  : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96))',
                border: `0.5px solid ${accentColor.color}33`,
                boxShadow: isDark
                  ? `0 10px 28px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)`
                  : `0 10px 28px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)`,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="size-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundImage: accentColor.gradient,
                    boxShadow: `0 8px 18px ${accentColor.color}33`,
                  }}
                >
                  <Gift className="size-6 text-white" strokeWidth={2.4} />
                </div>
                <div className="text-left min-w-0">
                  <p
                    className="font-bold text-sm sm:text-base"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {t('profile.bonusTitle')}
                  </p>
                  <p
                    className="text-xs sm:text-sm truncate"
                    style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}
                  >
                    {t('profile.bonusSubtitle')}
                  </p>
                </div>
              </div>
              <ChevronRight
                className="size-5 flex-shrink-0"
                style={{ color: accentColor.color }}
                strokeWidth={2.5}
              />
            </button>
          </div>
        )}

        {(myRentalsLoading || myRentals.length > 0) && (
          <div className="px-3 sm:px-4 mb-4 space-y-2">
            <p className="text-sm font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
              {t('profile.activeRentals')}
            </p>
            {myRentalsLoading ? (
              <div
                className="rounded-2xl border p-4 flex items-center gap-3"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <Loader2 className="size-5 animate-spin shrink-0" style={{ color: accentColor.color }} />
                <span className="text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>
                  {t('profile.rentalsLoading')}
                </span>
              </div>
            ) : null}
            <div className="space-y-2">
              {!myRentalsLoading &&
                myRentals.map((r) => (
                  <ProfileActiveRentalCard
                    key={r.id}
                    order={r as ProfileActiveRentalOrder}
                    isDark={isDark}
                    accentColor={accentColor.color}
                    phonePk={rentalPhonePk}
                    apiBaseUrl={apiBaseUrl}
                    onExtended={(updated) => {
                      if (updated && typeof updated === 'object' && (updated as { id?: string }).id != null) {
                        const id = String((updated as { id: string }).id);
                        setMyRentals((prev) =>
                          prev.map((r) => (String(r?.id) === id ? { ...r, ...updated } : r)),
                        );
                      }
                      void fetchOrders();
                    }}
                  />
                ))}
            </div>
          </div>
        )}

        {/* iOS Tabs */}
        <div className="px-3 sm:px-4 mb-4 min-w-0">
          <div
            className="w-full max-w-full min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 sm:p-1.5 rounded-2xl overflow-hidden"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                : 'linear-gradient(145deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.02))',
              backdropFilter: 'blur(20px)',
              boxShadow: isDark
                ? 'inset 0 1px 3px rgba(0, 0, 0, 0.3)'
                : 'inset 0 1px 2px rgba(0, 0, 0, 0.08)',
              border: isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <button
              onClick={() => setActiveTab('orders')}
              className="w-full min-h-[3rem] sm:min-h-0 flex flex-col min-[400px]:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-4 rounded-xl transition-all"
              style={{
                background: activeTab === 'orders'
                  ? `linear-gradient(135deg, ${accentColor.color}4d, ${accentColor.color}33)`
                  : 'transparent',
                boxShadow:
                  activeTab === 'orders'
                    ? isDark
                      ? `0 4px 12px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                      : `0 3px 10px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.6)`
                    : 'none',
                border: activeTab === 'orders' ? `0.5px solid ${accentColor.color}4d` : '0.5px solid transparent',
              }}
            >
              <Package
                className="size-4 flex-shrink-0"
                strokeWidth={2.5}
                style={{ color: activeTab === 'orders' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              />
              <span
                className="text-[10px] min-[400px]:text-[11px] sm:text-xs font-semibold text-center leading-tight max-w-full px-0.5 line-clamp-2 min-[400px]:truncate"
                style={{ color: activeTab === 'orders' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              >
                {t('profile.tabOrders')}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className="w-full min-h-[3rem] sm:min-h-0 flex flex-col min-[400px]:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-4 rounded-xl transition-all"
              style={{
                background: activeTab === 'favorites'
                  ? `linear-gradient(135deg, ${accentColor.color}4d, ${accentColor.color}33)`
                  : 'transparent',
                boxShadow:
                  activeTab === 'favorites'
                    ? isDark
                      ? `0 4px 12px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                      : `0 3px 10px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.6)`
                    : 'none',
                border: activeTab === 'favorites' ? `0.5px solid ${accentColor.color}4d` : '0.5px solid transparent',
              }}
            >
              <Heart
                className="size-4 flex-shrink-0"
                strokeWidth={2.5}
                style={{ color: activeTab === 'favorites' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              />
              <span
                className="text-[10px] min-[400px]:text-[11px] sm:text-xs font-semibold text-center leading-tight max-w-full px-0.5 line-clamp-2 min-[400px]:truncate"
                style={{ color: activeTab === 'favorites' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              >
                {t('profile.tabFavorites')}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className="w-full min-h-[3rem] sm:min-h-0 flex flex-col min-[400px]:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-4 rounded-xl transition-all"
              style={{
                background: activeTab === 'portfolio'
                  ? `linear-gradient(135deg, ${accentColor.color}4d, ${accentColor.color}33)`
                  : 'transparent',
                boxShadow:
                  activeTab === 'portfolio'
                    ? isDark
                      ? `0 4px 12px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                      : `0 3px 10px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.6)`
                    : 'none',
                border: activeTab === 'portfolio' ? `0.5px solid ${accentColor.color}4d` : '0.5px solid transparent',
              }}
            >
              <Grid3x3
                className="size-4 flex-shrink-0"
                strokeWidth={2.5}
                style={{ color: activeTab === 'portfolio' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              />
              <span
                className="text-[10px] min-[400px]:text-[11px] sm:text-xs font-semibold text-center leading-tight max-w-full px-0.5 line-clamp-2 min-[400px]:truncate"
                style={{ color: activeTab === 'portfolio' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              >
                {t('profile.tabPortfolio')}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('ads')}
              className="w-full min-h-[3rem] sm:min-h-0 flex flex-col min-[400px]:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-4 rounded-xl transition-all"
              style={{
                background: activeTab === 'ads'
                  ? `linear-gradient(135deg, ${accentColor.color}4d, ${accentColor.color}33)`
                  : 'transparent',
                boxShadow:
                  activeTab === 'ads'
                    ? isDark
                      ? `0 4px 12px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                      : `0 3px 10px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.6)`
                    : 'none',
                border: activeTab === 'ads' ? `0.5px solid ${accentColor.color}4d` : '0.5px solid transparent',
              }}
            >
              <DollarSign
                className="size-4 flex-shrink-0"
                strokeWidth={2.5}
                style={{ color: activeTab === 'ads' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              />
              <span
                className="text-[10px] min-[400px]:text-[11px] sm:text-xs font-semibold text-center leading-tight max-w-full px-0.5 line-clamp-2 min-[400px]:truncate"
                style={{ color: activeTab === 'ads' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              >
                {t('profile.tabAds')}
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-3 sm:px-4 space-y-3 mb-6 min-w-0 max-w-full">
          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <>
              <div
                className="p-2 rounded-2xl min-w-0"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                }}
              >
                <div
                  className="overflow-x-auto overflow-y-hidden -mx-0.5 px-0.5 pb-0.5 scrollbar-hide overscroll-x-contain"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="flex w-max min-w-full flex-nowrap gap-2 sm:flex-wrap sm:w-auto">
                  {[
                    { id: 'all', label: t('profile.filterAll') },
                    { id: 'market', label: t('profile.catMarket') },
                    { id: 'shop', label: t('profile.catShop') },
                    { id: 'food', label: t('profile.catFood') },
                    { id: 'rent', label: t('profile.catRent') },
                    { id: 'auction', label: t('profile.catAuction') },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setOrderCategory(c.id as any)}
                      className="shrink-0 px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all active:scale-95"
                      style={{
                        background:
                          orderCategory === c.id
                            ? accentColor.gradient
                            : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.04)',
                        color: orderCategory === c.id ? '#fff' : isDark ? '#fff' : '#111827',
                        border:
                          orderCategory === c.id
                            ? 'none'
                            : isDark
                              ? '0.5px solid rgba(255,255,255,0.10)'
                              : '0.5px solid rgba(0,0,0,0.08)',
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                  </div>
                </div>
              </div>

              <div
                className="p-2 rounded-2xl mt-2 min-w-0"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide mb-2 px-1"
                  style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                >
                  {t('profile.statusSection')}
                </p>
                <div
                  className="overflow-x-auto overflow-y-hidden -mx-0.5 px-0.5 scrollbar-hide overscroll-x-contain"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="flex w-max min-w-full flex-nowrap gap-2 sm:flex-wrap sm:w-auto">
                  {(
                    [
                      { id: 'all' as const, label: t('profile.filterAll') },
                      { id: 'active' as const, label: t('profile.statusActive') },
                      { id: 'completed' as const, label: t('profile.statusCompleted') },
                      { id: 'cancelled' as const, label: t('profile.statusCancelled') },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setOrderStatus(c.id)}
                      className="shrink-0 px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all active:scale-95"
                      style={{
                        background:
                          orderStatus === c.id
                            ? accentColor.gradient
                            : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.04)',
                        color: orderStatus === c.id ? '#fff' : isDark ? '#fff' : '#111827',
                        border:
                          orderStatus === c.id
                            ? 'none'
                            : isDark
                              ? '0.5px solid rgba(255,255,255,0.10)'
                              : '0.5px solid rgba(0,0,0,0.08)',
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                  </div>
                </div>
              </div>

              {ordersLoading && orders.length > 0 ? (
                <div
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold mb-1"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.07)' : `${accentColor.color}14`,
                    color: isDark ? 'rgba(255,255,255,0.88)' : '#374151',
                    border: isDark ? '0.5px solid rgba(255,255,255,0.1)' : `0.5px solid ${accentColor.color}33`,
                  }}
                >
                  <Loader2 className="size-4 animate-spin shrink-0" style={{ color: accentColor.color }} />
                  {t('profile.ordersRefreshing')}
                </div>
              ) : null}

              {ordersLoading && orders.length === 0 ? (
                <div className="space-y-3 py-2">
                  <div
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <Loader2 className="size-8 animate-spin" style={{ color: accentColor.color }} strokeWidth={2.5} />
                    <p className="text-sm font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
                      {t('profile.ordersLoading')}
                    </p>
                    <p className="text-xs px-4 text-center" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                      {t('profile.ordersLoadingHint')}
                    </p>
                  </div>
                  {[0, 1, 2].map((sk) => (
                    <div
                      key={`order-skel-${sk}`}
                      className="p-4 rounded-2xl animate-pulse"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                      }}
                    >
                      <div className="flex gap-3 mb-3">
                        <div
                          className="size-14 sm:size-16 rounded-xl shrink-0"
                          style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
                        />
                        <div className="flex-1 space-y-2 min-w-0">
                          <div
                            className="h-4 rounded-lg w-4/5 max-w-xs"
                            style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
                          />
                          <div
                            className="h-3 rounded-lg w-2/5"
                            style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}
                          />
                          <div
                            className="h-3 rounded-lg w-3/5"
                            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
                          />
                        </div>
                      </div>
                      <div
                        className="h-10 rounded-xl w-full"
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                      />
                    </div>
                  ))}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Package
                    className="size-16 mx-auto mb-4"
                    strokeWidth={1.5}
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                  />
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    {orders.length > 0 ? t('profile.ordersEmptyFilter') : t('profile.ordersEmpty')}
                  </p>
                </div>
              ) : (
                filteredOrders.map((order, index) => {
                  const orec = order as Record<string, unknown>;
                  const meta = getProfileOrderCardMeta(orec, language);
                  const rowTotal =
                    typeof orec.lineRowCount === 'number'
                      ? orec.lineRowCount
                      : Array.isArray((order as { items?: unknown[] }).items)
                        ? (order as { items: unknown[] }).items.length
                        : meta.lines.length;
                  const moreCount = Math.max(0, rowTotal - meta.lines.length);
                  return (
                  <div
                    key={buildListKey('order', order, index, ['id', 'orderNumber', 'createdAt'])}
                    className="p-4 rounded-2xl"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))'
                        : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                      border: isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            #{order.orderNumber}
                          </span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                              color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
                            }}
                          >
                            {meta.categoryLabel}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.5)' }}>
                            <Clock className="inline size-3.5 mr-1 align-text-bottom opacity-70" />
                            {order.createdAt &&
                              userPanelFormatDateTime(language, new Date(order.createdAt))}
                          </span>
                          {order.branchName ? (
                            <span
                              className="truncate max-w-[200px]"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.5)' }}
                            >
                              {String(order.branchName)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span 
                          className="text-xs px-2 py-1 rounded-lg font-semibold whitespace-nowrap"
                          style={{
                            background: order.awaitingCustomerReceipt
                              ? '#f59e0b33'
                              : order.orderStatus === 'active'
                                ? '#10b98133'
                                : order.orderStatus === 'completed'
                                  ? '#22c55e33'
                                  : '#ef444433',
                            color: order.awaitingCustomerReceipt
                              ? '#f59e0b'
                              : order.orderStatus === 'active'
                                ? '#10b981'
                                : order.orderStatus === 'completed'
                                  ? '#22c55e'
                                  : '#ef4444',
                          }}
                        >
                          {profileOrderBadgeLabel(language, order)}
                        </span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                          style={{
                            background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)',
                            color: isDark ? '#c7d2fe' : '#4338ca',
                          }}
                        >
                          {meta.paymentLabel}
                        </span>
                      </div>
                    </div>

                    {meta.lines.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {meta.lines.map((line, li) => (
                          <div
                            key={`${String(order.id)}-line-${li}`}
                            className="flex gap-3 items-center rounded-xl p-2 -mx-1"
                            style={{
                              background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                            }}
                          >
                            <div
                              className="w-[4.75rem] h-[4.75rem] sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                                border: isDark ? '0.5px solid rgba(255,255,255,0.1)' : '0.5px solid rgba(0,0,0,0.06)',
                              }}
                            >
                              {line.imageUrl ? (
                                <img
                                  src={line.imageUrl}
                                  alt=""
                                  className="size-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <Package
                                  className="size-8 sm:size-9 opacity-35"
                                  strokeWidth={1.5}
                                  style={{ color: isDark ? '#fff' : '#111' }}
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className="font-semibold text-sm leading-snug line-clamp-2"
                                style={{ color: isDark ? '#fff' : '#111827' }}
                              >
                                {line.title}
                              </p>
                              {line.subtitle ? (
                                <p
                                  className="text-xs mt-0.5 line-clamp-1"
                                  style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                                >
                                  {line.subtitle}
                                </p>
                              ) : null}
                              <p
                                className="text-xs mt-1 font-medium"
                                style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                              >
                                ×{line.quantity}
                                {line.unitPrice != null && Number.isFinite(line.unitPrice) ? (
                                  <span>
                                    {' '}
                                    · {formatMoneyProfile(line.unitPrice, meta.currency, language)} /{' '}
                                    {t('profile.unitEach')}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <div
                              className="text-sm font-bold tabular-nums shrink-0"
                              style={{ color: isDark ? '#e5e7eb' : '#111827' }}
                            >
                              {formatMoneyProfile(line.lineTotal, meta.currency, language)}
                            </div>
                          </div>
                        ))}
                        {moreCount > 0 ? (
                          <p
                            className="text-xs font-medium px-2"
                            style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                          >
                            +{moreCount} {t('profile.moreLines')}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div
                      className="flex flex-wrap items-end justify-between gap-2 mb-1 pt-1 border-t"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      }}
                    >
                      <div className="text-xs space-y-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                        {meta.shipping != null && meta.shipping > 0 ? (
                          <p>
                            {t('profile.shipping')}{' '}
                            <span className="font-semibold" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                              {formatMoneyProfile(meta.shipping, meta.currency, language)}
                            </span>
                          </p>
                        ) : null}
                        <p>
                          {meta.itemCount} {t('profile.itemsCount')}
                        </p>
                      </div>
                      {meta.total != null && meta.total > 0 ? (
                        <div className="text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
                            {t('profile.total')}
                          </p>
                          <p
                            className="text-lg font-extrabold tabular-nums"
                            style={{ color: accentColor.color }}
                          >
                            {formatMoneyProfile(meta.total, meta.currency, language)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {order.awaitingCustomerReceipt && !order.relational ? (
                      <div
                        className="mt-3 p-3 rounded-xl space-y-2"
                        style={{
                          background: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                          border: isDark
                            ? '1px solid rgba(245, 158, 11, 0.35)'
                            : '1px solid rgba(245, 158, 11, 0.28)',
                        }}
                      >
                        <p
                          className="text-xs leading-relaxed font-medium"
                          style={{ color: isDark ? '#fde68a' : '#92400e' }}
                        >
                          {t('profile.receiptHint')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={receiptActionOrderId === String(order.id)}
                            onClick={() => void confirmOrderDelivery(order)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                            style={{
                              background: accentColor.gradient,
                              color: '#fff',
                              minWidth: '8.5rem',
                            }}
                          >
                            {receiptActionOrderId === String(order.id) ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3.5" />
                            )}
                            {t('profile.received')}
                          </button>
                          <button
                            type="button"
                            disabled={receiptActionOrderId === String(order.id)}
                            onClick={() => void cancelAwaitingReceiptOrder(order)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                            style={{
                              borderColor: '#ef4444aa',
                              color: '#ef4444',
                              background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                            }}
                          >
                            <X className="size-3.5" />
                            {t('profile.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewModalOrder(order)}
                        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95"
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                          color: isDark ? '#fff' : '#111827',
                          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                        }}
                      >
                        <MessageSquare className="size-3.5" />
                        {t('profile.review')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const was = isFavoriteOrder(String(order.id));
                          toggleFavoriteOrder(toFavoriteOrderEntry(order));
                          toast.success(was ? t('profile.favRemove') : t('profile.favAdd'));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95"
                        style={{
                          borderColor: isFavoriteOrder(String(order.id))
                            ? accentColor.color
                            : isDark
                              ? 'rgba(255,255,255,0.12)'
                              : 'rgba(0,0,0,0.1)',
                          color: isFavoriteOrder(String(order.id)) ? accentColor.color : isDark ? '#fff' : '#111827',
                          background: isFavoriteOrder(String(order.id))
                            ? `${accentColor.color}18`
                            : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.03)',
                        }}
                      >
                        <Heart
                          className="size-3.5"
                          fill={isFavoriteOrder(String(order.id)) ? accentColor.color : 'transparent'}
                        />
                        {t('profile.favoritesLabel')}
                      </button>
                    </div>
                  </div>
                );
                })
              )}
            </>
          )}

          {/* Favorites Tab */}
          {activeTab === 'favorites' && (
            <>
              {localFavorites.length === 0 && favoriteOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Heart 
                    className="size-16 mx-auto mb-4" 
                    strokeWidth={1.5}
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                  />
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    {t('profile.favoritesEmpty')}
                  </p>
                </div>
              ) : (
                <>
                  {favoriteOrders.length > 0 && (
                    <div className="mb-6 space-y-2">
                      <p
                        className="text-sm font-bold"
                        style={{ color: isDark ? '#fff' : '#111827' }}
                      >
                        {t('profile.favOrdersTitle')}
                      </p>
                      <div className="space-y-2">
                        {favoriteOrders.map((fo) => (
                          <div
                            key={`fav-order-${fo.orderId}`}
                            className="flex items-center justify-between gap-2 rounded-2xl border p-3"
                            style={{
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
                            }}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-sm" style={{ color: isDark ? '#fff' : '#111827' }}>
                                #{fo.orderNumber || fo.orderId}
                              </p>
                              {fo.statusLabel ? (
                                <p className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                                  {fo.statusLabel}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                removeFavoriteOrder(fo.orderId);
                                toast.success(t('profile.removed'));
                              }}
                              className="shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold"
                              style={{
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                              }}
                            >
                              {t('profile.delete')}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {localFavorites.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {localFavorites.map((product, index) => (
                    <div
                      key={buildListKey('favorite', product, index, ['id', 'catalogId', 'sku', 'name'])}
                      className="relative overflow-hidden rounded-xl sm:rounded-2xl cursor-pointer group min-w-0"
                      style={{
                        background: isDark 
                          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))'
                          : 'linear-gradient(145deg, rgba(248, 248, 248, 1), rgba(248, 248, 248, 0.98))',
                        border: isDark ? '0.5px solid rgba(255, 255, 255, 0.15)' : '0.5px solid rgba(0, 0, 0, 0.1)',
                        boxShadow: isDark 
                          ? '0 8px 24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                          : '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = isDark 
                          ? `0 12px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px ${accentColor.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                          : `0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px ${accentColor.color}30, inset 0 1px 0 rgba(255, 255, 255, 1)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = isDark 
                          ? '0 8px 24px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                          : '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
                      }}
                    >
                      {/* Image */}
                      <div className="relative aspect-square overflow-hidden rounded-t-xl sm:rounded-t-2xl">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          style={{
                            filter: isDark ? 'brightness(0.95)' : 'brightness(1)',
                          }}
                        />
                        
                        {/* Gradient Overlay */}
                        <div 
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{
                            background: `linear-gradient(to top, ${accentColor.color}40, transparent 50%)`,
                          }}
                        />
                        
                        {/* Stock Badge */}
                        {product.stockCount !== undefined && (
                          <div 
                            className="absolute top-1 right-1 sm:top-2 sm:right-2 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold backdrop-blur-xl"
                            style={{
                              background: product.stockCount > 0 
                                ? 'rgba(34, 197, 94, 0.9)' 
                                : 'rgba(239, 68, 68, 0.9)',
                              color: '#ffffff',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            }}
                          >
                            {product.stockCount > 0
                              ? `${product.stockCount} ${t('profile.stockUnits')}`
                              : t('profile.outOfStock')}
                          </div>
                        )}
                        
                        {/* Rating */}
                        {product.rating && product.rating > 0 ? (
                          <div 
                            className="absolute top-1 left-1 sm:top-2 sm:left-2 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold backdrop-blur-xl flex items-center gap-0.5 sm:gap-1"
                            style={{
                              background: 'rgba(0, 0, 0, 0.7)',
                              color: '#fbbf24',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            }}
                          >
                            ⭐ {product.rating.toFixed(1)}
                          </div>
                        ) : (
                          <div 
                            className="absolute top-1 left-1 sm:top-2 sm:left-2 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium backdrop-blur-xl flex items-center gap-0.5 sm:gap-1 max-w-[calc(100%-0.5rem)] truncate"
                            style={{
                              background: 'rgba(0, 0, 0, 0.6)',
                              color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.7)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            }}
                          >
                            ⭐ {t('profile.unrated')}
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="p-2 sm:p-3">
                        {/* Product Name */}
                        <h3 
                          className="text-xs sm:text-sm font-semibold mb-1 sm:mb-2 line-clamp-2 leading-snug sm:leading-tight" 
                          style={{ 
                            color: isDark ? '#ffffff' : '#111827',
                          }}
                        >
                          {product.name}
                        </h3>
                        
                        {/* Price Section */}
                        <div className="mb-1 sm:mb-2">
                          {product.oldPrice && (
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                              <span 
                                className="text-[10px] sm:text-xs line-through truncate max-w-full"
                                style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                              >
                                {product.oldPrice.toLocaleString(userPanelLocale(language))}{' '}
                                {t('profile.currency')}
                              </span>
                              <span 
                                className="text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded shrink-0"
                                style={{
                                  background: '#ef444420',
                                  color: '#ef4444',
                                }}
                              >
                                -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                              </span>
                            </div>
                          )}
                          <p 
                            className="text-sm sm:text-base font-bold tabular-nums"
                            style={{ color: accentColor.color }}
                          >
                            {product.price.toLocaleString(userPanelLocale(language))}{' '}
                            {t('profile.currency')}
                          </p>
                        </div>
                        
                        {/* Branch Name */}
                        {product.branchName && (
                          <div 
                            className="flex items-center gap-1 sm:gap-1.5 mt-1.5 sm:mt-2 pt-1.5 sm:pt-2"
                            style={{
                              borderTop: isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.08)',
                            }}
                          >
                            <span className="text-[10px] sm:text-xs shrink-0">📍</span>
                            <p 
                              className="text-[10px] sm:text-xs font-medium truncate min-w-0"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                            >
                              {product.branchName}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Hover Effect Border */}
                      <div 
                        className="absolute inset-0 rounded-xl sm:rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${accentColor.color}20, transparent 50%, ${accentColor.color}10)`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <>
              {/* Add Portfolio Button */}
              <button
                onClick={() => setIsCreatePortfolioOpen(true)}
                className="w-full p-4 rounded-2xl mb-4 transition-all active:scale-98"
                style={{
                  backgroundImage: accentColor.gradient,
                  boxShadow: isDark 
                    ? `0 8px 24px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.25)`
                    : `0 6px 20px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                }}
              >
                <div className="flex items-center justify-center gap-3">
                  <Plus className="size-5 text-white" strokeWidth={2.5} />
                  <span className="font-bold text-white text-base">
                    {t('profile.portfolioAdd')}
                  </span>
                </div>
              </button>

              {myPortfolios.length === 0 ? (
                <div className="text-center py-12">
                  <Grid3x3 
                    className="size-16 mx-auto mb-4" 
                    strokeWidth={1.5}
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                  />
                  <p className="mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    {t('profile.portfolioEmpty')}
                  </p>
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                    {t('profile.portfolioHint')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                  {myPortfolios.map((portfolio, index) => (
                    <PortfolioCard
                      key={buildListKey('portfolio', portfolio, index, ['id', 'userId', 'createdAt', 'profession'])}
                      portfolio={portfolio}
                      onClick={() => setPortfolioDetail(portfolio)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Ads Tab */}
          {activeTab === 'ads' && (
            <>
              {/* Add Listing Button */}
              <button
                onClick={() => {
                  if (!isAuthenticated || !accessToken) {
                    devLog('⚠️ User not authenticated, opening auth modal');
                    setIsAuthOpen(true);
                  } else {
                    devLog('✅ User authenticated, opening listing modal');
                    setIsAddListingOpen(true);
                  }
                }}
                className="w-full p-4 rounded-2xl mb-4 transition-all active:scale-98"
                style={{
                  backgroundImage: accentColor.gradient,
                  boxShadow: isDark 
                    ? `0 8px 24px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.25)`
                    : `0 6px 20px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                }}
              >
                <div className="flex items-center justify-center gap-3">
                  <Plus className="size-5 text-white" strokeWidth={2.5} />
                  <span className="font-bold text-white text-base">
                    {t('profile.listingPost')}
                  </span>
                </div>
              </button>

              {/* Payment Info */}
              <div
                className="p-4 rounded-2xl mb-4"
                style={{
                  background: isDark 
                    ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))'
                    : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                  border: isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="size-5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                  <h3 className="font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    {t('profile.paymentTerms')}
                  </h3>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    ✅ {t('profile.firstListingFree')}{' '}
                    <span className="font-semibold" style={{ color: accentColor.color }}>
                      {t('profile.free')}
                    </span>
                  </p>
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    💵 {t('profile.nextListings')}{' '}
                    <span className="font-semibold" style={{ color: accentColor.color }}>
                      {formatListingFeeDisplay(language)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setListingCategory('home')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl transition-all"
                  style={{
                    background: listingCategory === 'home' 
                      ? `linear-gradient(135deg, ${accentColor.color}4d, ${accentColor.color}33)` 
                      : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    boxShadow: listingCategory === 'home' 
                      ? (isDark 
                        ? `0 4px 12px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                        : `0 3px 10px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.6)`)
                      : 'none',
                    border: listingCategory === 'home' ? `0.5px solid ${accentColor.color}4d` : `0.5px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                  }}
                >
                  <Home className="size-4" strokeWidth={2.5} style={{ color: listingCategory === 'home' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }} />
                  <span className="text-sm font-semibold" style={{ color: listingCategory === 'home' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}>
                    {t('profile.catHome')}
                  </span>
                </button>
                <button
                  onClick={() => setListingCategory('car')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl transition-all"
                  style={{
                    background: listingCategory === 'car' 
                      ? `linear-gradient(135deg, ${accentColor.color}4d, ${accentColor.color}33)` 
                      : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    boxShadow: listingCategory === 'car' 
                      ? (isDark 
                        ? `0 4px 12px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                        : `0 3px 10px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.6)`)
                      : 'none',
                    border: listingCategory === 'car' ? `0.5px solid ${accentColor.color}4d` : `0.5px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                  }}
                >
                  <Car className="size-4" strokeWidth={2.5} style={{ color: listingCategory === 'car' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }} />
                  <span className="text-sm font-semibold" style={{ color: listingCategory === 'car' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}>
                    {t('profile.catCar')}
                  </span>
                </button>
              </div>

              {myListings.length === 0 ? (
                <div className="text-center py-12">
                  {listingCategory === 'home' ? (
                    <Home 
                      className="size-16 mx-auto mb-4" 
                      strokeWidth={1.5}
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                    />
                  ) : (
                    <Car 
                      className="size-16 mx-auto mb-4" 
                      strokeWidth={1.5}
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                    />
                  )}
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    {listingCategory === 'home' ? t('profile.listingsEmptyHome') : t('profile.listingsEmptyCar')}
                  </p>
                </div>
              ) : (
                <div className="listings-grid-container mt-2 grid w-full grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3">
                  {myListings.filter(l => l.type === (listingCategory === 'home' ? 'house' : 'car')).map((listing, index) => (
                    <ListingCard
                      key={buildListKey('listing', listing, index, ['id', 'listingId', 'createdAt', 'title'])}
                      listing={listing}
                      compact
                      onClick={() => setListingPreview(listing)}
                      onDelete={() => requestDeleteListing(listing.id)}
                      onEdit={() => handleEditListing(listing)}
                      showActions={true}
                    />
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        platform="ios"
      />

      <ProfileEditModal
        isOpen={isProfileEditOpen}
        onClose={() => setIsProfileEditOpen(false)}
        userData={userData}
        accessToken={session?.access_token || ''}
        onSuccess={fetchUserData}
        accentColor={accentColor}
        isDark={isDark}
      />

      <CreatePortfolioModal
        isOpen={isCreatePortfolioOpen}
        onClose={() => setIsCreatePortfolioOpen(false)}
        userData={userData}
        accessToken={session?.access_token || ''}
        onSuccess={() => {
          fetchPortfolios();
          setIsCreatePortfolioOpen(false);
        }}
        accentColor={accentColor}
        isDark={isDark}
      />

      <AddListingModal
        isOpen={isAddListingOpen}
        onClose={() => setIsAddListingOpen(false)}
        userId={user?.id || ''}
        userName={userData?.fullName || userData?.firstName || t('profile.userFallback')}
        userPhone={userData?.phone || user?.phone || ''}
        accessToken={accessToken}
        defaultType={listingCategory === 'home' ? 'house' : 'car'}
        onSuccess={() => {
          // Fetch listings after successful submission
          fetchMyListings();
          setIsAddListingOpen(false);
        }}
      />

      <EditListingModal
        isOpen={isEditListingOpen}
        onClose={() => setIsEditListingOpen(false)}
        listing={selectedListing}
        accessToken={session?.access_token || ''}
        onSuccess={() => {
          // Fetch listings after successful submission
          fetchMyListings();
          setIsEditListingOpen(false);
        }}
      />

      <SMSAuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user, session) => {
          smsSignin(user, session);
          setIsAuthOpen(false);
        }}
      />

      <PortfolioDetailModal
        portfolio={portfolioDetail}
        isOpen={!!portfolioDetail}
        onClose={() => setPortfolioDetail(null)}
      />

      <ListingPreviewModal
        listing={listingPreview}
        isOpen={!!listingPreview}
        onClose={() => setListingPreview(null)}
        onEdit={() => {
          if (listingPreview) {
            setSelectedListing(listingPreview);
            setIsEditListingOpen(true);
          }
        }}
      />

      {deleteListingId !== null && (
        <div
          className="fixed inset-0 z-[520] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          role="presentation"
          onClick={closeDeleteListingModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-listing-modal-title"
            className="w-full max-w-sm rounded-2xl p-5 shadow-xl"
            style={{
              background: isDark ? 'rgba(28,28,32,0.98)' : '#ffffff',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delete-listing-modal-title"
              className="text-lg font-semibold"
              style={{ color: isDark ? '#fff' : '#111827' }}
            >
              {t('profile.deleteListingModalTitle')}
            </h3>
            <p className="mt-2 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }}>
              {t('profile.deleteListingConfirm')}
            </p>
            <p className="mt-1 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
              {t('profile.deleteListingModalHint')}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleteListingBusy}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  color: isDark ? '#fff' : '#374151',
                }}
                onClick={closeDeleteListingModal}
              >
                {t('profile.cancel')}
              </button>
              <button
                type="button"
                disabled={deleteListingBusy}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{
                  background: deleteListingBusy ? 'rgba(220,38,38,0.5)' : '#dc2626',
                }}
                onClick={() => void confirmDeleteListing()}
              >
                {deleteListingBusy ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                  </span>
                ) : (
                  t('profile.delete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <OrderReviewModal
        isOpen={!!reviewModalOrder}
        onClose={() => setReviewModalOrder(null)}
        order={
          reviewModalOrder
            ? {
                id: String(reviewModalOrder.id),
                orderNumber: reviewModalOrder.orderNumber,
                status: reviewModalOrder.status,
                orderStatus: reviewModalOrder.orderStatus,
                relational: reviewModalOrder.relational,
              }
            : null
        }
        accessToken={getValidToken() || accessToken || ''}
        apiBaseUrl={apiBaseUrl}
        isDark={isDark}
        accentHex={accentColor.color}
      />
    </>
  );
}

export default ProfileView;