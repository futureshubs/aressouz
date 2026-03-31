import React, { useState, useEffect } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { publicAnonKey, API_BASE_URL, DEV_API_BASE_URL } from '/utils/supabase/info';
import { OrderReviewModal } from './OrderReviewModal';
import type { FavoriteOrderEntry } from '../context/FavoritesContext';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { RentalNextPaymentInfo } from './rental/RentalNextPaymentInfo';

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

/** KV buyurtma: filtrlash va mijoz tekshiruvi uchun qisqa maydonlar */
function normalizeKvOrderForProfile(o: any) {
  if (!o || o.relational) return o;
  const s = String(o.status || '').toLowerCase().trim();
  let orderStatus: 'active' | 'completed' | 'cancelled' = 'active';
  if (s === 'cancelled' || s === 'canceled' || s === 'rejected') orderStatus = 'cancelled';
  else if (s === 'delivered' || s === 'completed') orderStatus = 'completed';
  const statusLabel =
    s === 'awaiting_receipt'
      ? 'Kuryer topshirdi — tekshiring'
      : s === 'delivered'
        ? 'Yetkazildi'
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
  return {
    id: row.id,
    orderNumber: row.order_number,
    orderStatus: uiStatus,
    status: statusLabel,
    category: mapRelationalVerticalToCategory(vertical),
    total: row.total_amount,
    createdAt: row.created_at,
    currency_code: row.currency_code,
    item_count: row.item_count,
    relational: true as const,
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
  return {
    id: r.id,
    orderNumber: name.length > 28 ? `${name.slice(0, 28)}…` : name,
    orderStatus,
    status: rentalKvStatusLabel(String(r.status || '')),
    category: 'rent' as const,
    createdAt: r.createdAt,
    total: r.totalPrice ?? r.pricePerPeriod,
    currency_code: "UZS",
    rentalKv: true as const,
    relational: false as const,
    awaitingCustomerReceipt: false,
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

  const { theme, accentColor } = useTheme();
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
  const [reviewModalOrder, setReviewModalOrder] = useState<any | null>(null);
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
          alert('⚠️ Token formati noto\'g\'ri edi. Iltimos, qayta login qiling.');
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

  // Log session and token for debugging
  useEffect(() => {
    console.log('\n📊 ===== PROFILE VIEW SESSION STATE =====');
    console.log('🔐 isAuthenticated:', isAuthenticated);
    console.log('👤 user:', user ? {
      id: user.id,
      phone: user.phone,
      email: user.email
    } : 'NULL');
    console.log('🎫 session object:', session);
    console.log('🎫 session:', session ? {
      hasAccessToken: !!session.access_token,
      accessTokenFull: session.access_token || 'MISSING',
      accessTokenPreview: session.access_token ? `${session.access_token.substring(0, 30)}... (length: ${session.access_token.length})` : 'MISSING',
      expires_at: session.expires_at
    } : 'NULL');
    console.log('🔑 accessToken variable (from session?.access_token):', accessToken ? `${accessToken.substring(0, 30)}... (length: ${accessToken.length})` : 'EMPTY/MISSING');
    
    // Check localStorage directly
    const storedSession = localStorage.getItem('sms_session');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        console.log('💾 localStorage session (full):', parsed);
        console.log('💾 localStorage session:', {
          hasAccessToken: !!parsed.access_token,
          tokenFull: parsed.access_token || 'MISSING',
          tokenPreview: parsed.access_token ? `${parsed.access_token.substring(0, 30)}...` : 'MISSING'
        });
      } catch (e) {
        console.error('❌ Failed to parse localStorage session');
      }
    } else {
      console.log('💾 localStorage session: NULL');
    }
    
    console.log('📊 ===================================\n');
  }, [isAuthenticated, user, session, accessToken]);

  useEffect(() => {
    // Check if user is authenticated before fetching data
    if (!isAuthenticated) {
      console.log('🔐 User not authenticated, showing login modal');
      setIsAuthOpen(true);
      setLoading(false);
      return;
    }

    if (isAuthenticated && user && accessToken) {
      fetchUserData();
      fetchOrders();
      fetchFavorites();
      fetchPortfolios();
      fetchMyListings();
    } else {
      console.log('⚠️ User authenticated but missing token/session');
      setLoading(false);
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
        console.log('✅ Profile loaded from backend:', data);
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
      console.log('🔍 ===== TOKEN DEBUGGING =====');
      console.log('📱 Session object:', session);
      console.log('🔑 Session token:', session?.access_token);
      
      // Try session first
      if (session?.access_token) {
        console.log('✅ Using session token:', session.access_token.substring(0, 20) + '...');
        return session.access_token;
      }
      
      // Try localStorage
      const storedSession = localStorage.getItem('sms_session');
      console.log('💾 localStorage session:', storedSession ? 'EXISTS' : 'NULL');
      
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        console.log('🔓 Parsed session token:', parsed.access_token ? 'EXISTS' : 'NULL');
        if (parsed.access_token) {
          console.log('✅ Using localStorage token:', parsed.access_token.substring(0, 20) + '...');
          return parsed.access_token;
        }
      }
      
      console.log('❌ NO TOKEN FOUND!');
      console.log('🔍 ===== TOKEN DEBUGGING END =====');
      return null;
    } catch (error) {
      console.error('❌ Error getting token:', error);
      return null;
    }
  };

  // Helper function to handle 401 errors
  const handleAuthError = () => {
    console.log('🔄 Authentication error detected, clearing session...');
    localStorage.removeItem('sms_user');
    localStorage.removeItem('sms_session');
    setIsAuthOpen(true);
    toast.error('Sessiya muddati tugagan. Iltimos, qayta kiring.');
  };

  const fetchOrders = async () => {
    try {
      const token = getValidToken();
      
      if (!token) {
        handleAuthError();
        return;
      }
      
      console.log('🔑 Fetching orders with token:', token.substring(0, 20) + '...');
      
      const response = await fetch(
        `${apiBaseUrl}/orders`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey,
            'X-Access-Token': token,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📦 Orders response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        let list: any[] = (data.orders || []).map((row: any) => normalizeKvOrderForProfile(row));
        try {
          const v2res = await fetch(`${apiBaseUrl}/v2/orders?limit=50`, {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              apikey: publicAnonKey,
              'X-Access-Token': token,
              'Content-Type': 'application/json',
            },
          });
          if (v2res.ok) {
            const v2json = await v2res.json();
            const v2items = Array.isArray(v2json.items)
              ? v2json.items.map((r: Record<string, unknown>) => relationalOrderToUi(r))
              : [];
            const ids = new Set(list.map((o: any) => String(o.id)));
            const merged = [...list];
            for (const o of v2items) {
              if (!ids.has(String(o.id))) merged.unshift(o);
            }
            list = merged;
          }
        } catch {
          /* v2 ixtiyoriy — KV buyurtmalar saqlanadi */
        }

        const rawPhone =
          userData?.phone ||
          user?.phone ||
          (user as { user_metadata?: { phone?: string } })?.user_metadata?.phone;
        const phonePk = normalizePhoneForRentalsApi(String(rawPhone || ''));
        setMyRentalsLoading(true);
        try {
          if (phonePk.length >= 9) {
            const rres = await fetch(
              `${apiBaseUrl}/rentals/my-rentals?phone=${encodeURIComponent(phonePk)}`,
              { headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey } },
            );
            const rj = await rres.json().catch(() => ({}));
            if (rres.ok && rj.success && Array.isArray(rj.orders)) {
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
          } else {
            setMyRentals([]);
          }
        } catch {
          setMyRentals([]);
        } finally {
          setMyRentalsLoading(false);
        }

        list.sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        );
        setOrders(list);
      } else {
        console.error('❌ Orders fetch failed:', response.status, response.statusText);
        if (response.status === 401) {
          handleAuthError();
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
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
        toast.error(data.error || 'Tasdiqlanmadi');
        return;
      }
      toast.success('Buyurtma qabul qilindi. Rahmat!');
      await fetchOrders();
    } catch (e) {
      console.error(e);
      toast.error('Tasdiqlashda xatolik');
    } finally {
      setReceiptActionOrderId(null);
    }
  };

  const cancelAwaitingReceiptOrder = async (order: { id: string }) => {
    const ok = window.confirm(
      "Buyurtmani bekor qilasizmi? Mahsulot zaxiraga qaytariladi (agar buyurtma hali yakunlanmagan bo‘lsa).",
    );
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
        toast.error(data.error || 'Bekor qilinmadi');
        return;
      }
      toast.success('Buyurtma bekor qilindi');
      await fetchOrders();
    } catch (e) {
      console.error(e);
      toast.error('Bekor qilishda xatolik');
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
      
      console.log('🔑 Fetching favorites with token:', token.substring(0, 20) + '...');
      
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

      console.log('📦 Favorites response status:', response.status);

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

      console.log('🔑 Fetching portfolios with token:', currentAccessToken.substring(0, 20) + '...');

      const response = await fetch(`${API_BASE_URL}/services/my-portfolios`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
          'X-Access-Token': currentAccessToken,
        },
      });

      console.log('📊 Portfolios response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ My portfolios loaded:', data);
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
      console.log('📋 ===== FETCHING MY LISTINGS =====');
      
      const currentAccessToken = getValidToken();
      
      if (!currentAccessToken) {
        handleAuthError();
        return;
      }

      console.log('🔑 Using token:', currentAccessToken.substring(0, 30) + '...');

      const response = await fetch(`${API_BASE_URL}/listings/my`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
          'X-Access-Token': currentAccessToken,
        },
      });

      console.log('📡 Listings response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ My listings loaded - FULL DATA:', JSON.stringify(data, null, 2));
        console.log('✅ Listings array:', data.listings);
        console.log('✅ Listings count:', data.listings?.length || 0);
        
        if (data.listings && data.listings.length > 0) {
          console.log('✅ First listing sample:', data.listings[0]);
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

  const handleDeleteListing = async (listingId: string) => {
    // Confirmation dialog
    const confirmDelete = window.confirm('E\'lonni o\'chirmoqchimisiz?');
    if (!confirmDelete) return;

    try {
      console.log('🗑️ ===== DELETE LISTING =====');
      console.log('🔑 Listing ID:', listingId);
      console.log('🔑 Access Token:', accessToken?.substring(0, 30) + '...');
      
      // ✅ FIXED: Use /listing/:id endpoint which deletes from both places
      const response = await fetch(`${API_BASE_URL}/listing/${listingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey,
          'X-Access-Token': accessToken,
        },
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Listing deleted successfully:', data);
        alert('E\'lon muvaffaqiyatli o\'chirildi!');
        // Refresh listings
        fetchMyListings();
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to delete listing:', response.status, errorText);
        alert(`E'lonni o'chirishda xatolik: ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error deleting listing:', error);
      alert('E\'lonni o\'chirishda xatolik yuz berdi');
    }
  };

  const handleEditListing = (listing: any) => {
    // Open edit modal with listing data
    console.log('✏️ Edit listing:', listing);
    setSelectedListing(listing);
    setIsEditListingOpen(true);
  };

  const handleSignOut = () => {
    console.log('🚪 ===== SIGNING OUT =====');
    console.log('Clearing localStorage and session...');
    
    // Clear localStorage first
    localStorage.removeItem('sms_user');
    localStorage.removeItem('sms_session');
    console.log('✅ localStorage cleared');
    
    // Then sign out from context
    signout();
    
    // Clear local state
    setUserData(null);
    setOrders([]);
    setMyRentals([]);
    setFavorites([]);
    
    console.log('✅ Sign out complete');
    console.log('🚪 ===== END SIGN OUT =====');
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
    statusLabel: typeof order.status === 'string' ? order.status : undefined,
    createdAt: order.createdAt,
    category: order.category,
  });

  // Agar tizimga kirmagan bo'lsa
  if (!isAuthenticated) {
    return (
      <>
        <div className="min-h-screen" style={{ background: isDark ? '#000' : '#f5f5f5' }}>
          {/* Settings Button */}
          <div className="relative pt-6 pb-8 px-4">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="absolute top-6 right-4 p-2.5 rounded-xl transition-all active:scale-90"
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
          <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 250px)' }}>
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
                Profilga kirish
              </h2>
              <p 
                className="text-center mb-8 text-sm"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
              >
                Profilingizni ko'rish uchun tizimga kiring
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
                  Tizimga kirish
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

  // To'liq profil - iOS dizayn
  return (
    <>
      {/* Main Scrollable Container */}
      <div 
        className="min-h-screen"
        style={{ 
          background: isDark ? '#000' : '#f5f5f5',
          // iOS-style smooth scrolling
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? 'rgba(20, 184, 166, 0.4) transparent' : 'rgba(20, 184, 166, 0.3) transparent',
        }}
      >
        {/* Profile Header - Sticky */}
        <div 
          className="sticky top-0 z-20 pt-6 pb-8 px-4"
          style={{
            background: isDark 
              ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.98), rgba(0, 0, 0, 0.95))'
              : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          }}
        >
          {/* Settings Button */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="absolute top-6 right-4 p-2.5 rounded-xl transition-all active:scale-90"
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
          <div className="flex flex-col items-center">
            <div 
              className="relative w-28 h-28 rounded-full mb-4 group"
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
                  className="text-2xl font-bold mb-1" 
                  style={{ 
                    color: isDark ? '#ffffff' : '#111827',
                    textShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.5)' : 'none' 
                  }}
                >
                  {userData?.fullName || userData?.firstName || 'Foydalanuvchi'}
                </h1>
                <p 
                  className="text-sm mb-1"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  {userData?.phone || user?.phone || user?.user_metadata?.phone || ''}
                </p>
                
                {/* Additional User Details */}
                <div className="flex items-center gap-3 mb-4">
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
                      <span>{new Date(userData.birthDate).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
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
                      <span>{userData.gender === 'male' ? 'Erkak' : userData.gender === 'female' ? 'Ayol' : ''}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center">
                <span 
                  className="text-2xl font-bold mb-0.5"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {stats.orders}
                </span>
                <span 
                  className="text-xs"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  Buyurtmalar
                </span>
              </div>
              <div 
                className="w-px h-10"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              />
              <div className="flex flex-col items-center">
                <span 
                  className="text-2xl font-bold mb-0.5"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {stats.favorites}
                </span>
                <span 
                  className="text-xs"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  Sevimlilar
                </span>
              </div>
              <div 
                className="w-px h-10"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
              />
              <div className="flex flex-col items-center">
                <span 
                  className="text-2xl font-bold mb-0.5"
                  style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                  {stats.portfolio}
                </span>
                <span 
                  className="text-xs"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  Portfolio
                </span>
              </div>
            </div>
          </div>
        </div>

        {onOpenBonus && (
          <div className="px-4 mb-4">
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
                    Bonuslar
                  </p>
                  <p
                    className="text-xs sm:text-sm truncate"
                    style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)' }}
                  >
                    Bonus pagega tez o‘tish
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
          <div className="px-4 mb-4 space-y-2">
            <p className="text-sm font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
              Faol ijaralar
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
                  Ijaralar yuklanmoqda...
                </span>
              </div>
            ) : null}
            <div className="space-y-2">
              {!myRentalsLoading &&
              myRentals.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border p-3 flex gap-3 items-start"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div
                    className="p-2 rounded-xl shrink-0"
                    style={{ background: `${accentColor.color}22` }}
                  >
                    <Clock className="size-5" style={{ color: accentColor.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{r.productName || 'Ijara'}</p>
                    <p className="text-xs mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                      Reja:{' '}
                      {r.paymentSchedule === 'weekly'
                        ? 'Har hafta'
                        : r.paymentSchedule === 'monthly'
                          ? 'Har oy'
                          : 'Bir martalik / muddatlik'}
                    </p>
                    <RentalNextPaymentInfo
                      compact
                      isDark={isDark}
                      accentColor={accentColor.color}
                      paymentSchedule={r.paymentSchedule}
                      nextPaymentDue={r.nextPaymentDue}
                      pricePerPeriod={r.pricePerPeriod}
                      quantity={r.quantity}
                      contractStartDate={r.contractStartDate}
                      rentalPeriodStartedAt={r.rentalPeriodStartedAt}
                      rentalPeriodEndsAt={r.rentalPeriodEndsAt}
                      rentalPeriod={r.rentalPeriod}
                      awaitingCourierDelivery={r.awaitingCourierDelivery === true}
                    />
                    {r.paymentAlert === 'overdue' && (
                      <p className="text-xs text-red-500 font-semibold mt-1">To‘lov muddati o‘tgan — filial bilan bog‘laning</p>
                    )}
                    {r.paymentAlert === 'due_soon' && (
                      <p className="text-xs text-amber-500 font-medium mt-1">To‘lov muddati yaqin (3 kun ichida)</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* iOS Tabs */}
        <div className="px-4 mb-4">
          <div
            className="w-full max-w-full grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-2xl overflow-hidden"
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
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl transition-all"
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
                className="text-[11px] sm:text-xs font-semibold truncate"
                style={{ color: activeTab === 'orders' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              >
                Buyurtmalar
              </span>
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl transition-all"
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
                className="text-[11px] sm:text-xs font-semibold truncate"
                style={{ color: activeTab === 'favorites' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              >
                Sevimlilar
              </span>
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl transition-all"
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
                className="text-[11px] sm:text-xs font-semibold truncate"
                style={{ color: activeTab === 'portfolio' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              >
                Portfolio
              </span>
            </button>
            <button
              onClick={() => setActiveTab('ads')}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl transition-all"
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
                className="text-[11px] sm:text-xs font-semibold truncate"
                style={{ color: activeTab === 'ads' ? accentColor.color : (isDark ? '#ffffff' : '#374151') }}
              >
                Uy/Moshina
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 space-y-3 mb-6">
          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <>
              <div
                className="p-2 rounded-2xl"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                }}
              >
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'Barchasi' },
                    { id: 'market', label: 'Market' },
                    { id: 'shop', label: "Do'kon" },
                    { id: 'food', label: 'Restoran' },
                    { id: 'rent', label: 'Ijara' },
                    { id: 'auction', label: 'Auktsion' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setOrderCategory(c.id as any)}
                      className="px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all active:scale-95"
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

              <div
                className="p-2 rounded-2xl mt-2"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: isDark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide mb-2 px-1"
                  style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                >
                  Holat
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'all' as const, label: 'Barchasi' },
                      { id: 'active' as const, label: 'Faol' },
                      { id: 'completed' as const, label: 'Yakunlangan' },
                      { id: 'cancelled' as const, label: 'Bekor qilingan' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setOrderStatus(c.id)}
                      className="px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all active:scale-95"
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

              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Package 
                    className="size-16 mx-auto mb-4" 
                    strokeWidth={1.5}
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)' }}
                  />
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                    Hozircha buyurtmalar yo'q
                  </p>
                </div>
              ) : (
                filteredOrders.map((order, index) => (
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        #{order.orderNumber}
                      </span>
                      <span 
                        className="text-xs px-2 py-1 rounded-lg"
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
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      {order.createdAt && new Date(order.createdAt).toLocaleDateString('uz-UZ')}
                    </p>
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
                          Mahsulotni tekshiring. Hammasi joyida bo‘lsa «Qabul qildim» ni bosing; yoqmasa «Bekor
                          qilish».
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
                            Qabul qildim
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
                            Bekor qilish
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
                        Sharx
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const was = isFavoriteOrder(String(order.id));
                          toggleFavoriteOrder(toFavoriteOrderEntry(order));
                          toast.success(
                            was
                              ? 'Buyurtma sevimlilardan olib tashlandi'
                              : 'Buyurtma sevimlilarga qo‘shildi',
                          );
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
                        Sevimlilar
                      </button>
                    </div>
                  </div>
                ))
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
                    Sevimlilar bo'sh
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
                        Sevimli buyurtmalar
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
                                toast.success('Olib tashlandi');
                              }}
                              className="shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold"
                              style={{
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                              }}
                            >
                              O‘chirish
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
                            {product.stockCount > 0 ? `${product.stockCount} ta` : 'Tugagan'}
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
                            ⭐ Baholanmagan
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
                                {product.oldPrice.toLocaleString('uz-UZ')} so'm
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
                            {product.price.toLocaleString('uz-UZ')} so'm
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
                    Portfolio qo'shish
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
                    Portfolio bo'sh
                  </p>
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                    O'z ustalarlik ko'nikmalaringizni namoyish qiling
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                  {myPortfolios.map((portfolio, index) => (
                    <PortfolioCard
                      key={buildListKey('portfolio', portfolio, index, ['id', 'userId', 'createdAt', 'profession'])}
                      portfolio={portfolio}
                      onClick={() => {
                        // TODO: Open portfolio detail modal
                        console.log('Open portfolio:', portfolio);
                      }}
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
                    console.log('⚠️ User not authenticated, opening auth modal');
                    setIsAuthOpen(true);
                  } else {
                    console.log('✅ User authenticated, opening listing modal');
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
                    E'lon joylash
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
                    To'lov shartlari
                  </h3>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    ✅ 1-chi e'lon: <span className="font-semibold" style={{ color: accentColor.color }}>BEPUL</span>
                  </p>
                  <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    💵 Keyingi e'lonlar: <span className="font-semibold" style={{ color: accentColor.color }}>5000 so'm</span>
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
                    Uy
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
                    Moshina
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
                    {listingCategory === 'home' ? 'Uy e\'lonlari yo\'q' : 'Moshina e\'lonlari yo\'q'}
                  </p>
                </div>
              ) : (
                <div 
                  className="listings-grid-container"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    width: '100%',
                    padding: '0',
                    marginTop: '8px',
                  }}
                >
                  {myListings.filter(l => l.type === (listingCategory === 'home' ? 'house' : 'car')).map((listing, index) => (
                    <ListingCard
                      key={buildListKey('listing', listing, index, ['id', 'listingId', 'createdAt', 'title'])}
                      listing={listing}
                      onClick={() => {
                        // TODO: Open listing detail modal
                        console.log('Open listing:', listing);
                      }}
                      onDelete={() => handleDeleteListing(listing.id)}
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
        userName={userData?.fullName || userData?.firstName || 'Foydalanuvchi'}
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