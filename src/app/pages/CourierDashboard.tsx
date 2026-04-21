import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart3,
  Bell,
  Bike,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  DollarSign,
  ChevronRight,
  CheckCircle2,
  Clock3,
  CircleHelp,
  History,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Moon,
  Navigation,
  Package,
  Phone,
  QrCode,
  RefreshCw,
  Route,
  Settings,
  Shield,
  Star,
  Store,
  Sun,
  User,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, DEV_API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { getStoredCourierToken } from '../utils/requestAuth';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { formatOrderNumber } from '../utils/orderNumber';
import { distanceKmForCourierUi, getOrderMapPoint } from '../utils/courierOrderGeo';
import { COURIER_MAP_ROUTE_STORAGE_KEY } from '../utils/courierMapRouteSession';
import { compressImageIfNeeded, uploadFormDataWithProgress } from '../utils/uploadWithProgress';
import { openExternalUrlSync } from '../utils/openExternalUrl';
import { RentalLiveCountdown } from '../components/rental/RentalLiveCountdown';
import { normalizeRentalProductImageUrl } from '../utils/rentalProductImage';
import { computeMarketCourierHandoffUzs, computeRentalCourierHandoffUzs } from '../utils/rentalCashHandoff';
import { sortOrdersNewestFirst } from '../utils/sortOrdersNewestFirst';
import {
  RentalCourierDeliveryJobCard,
  RentalCourierDepositBlock,
} from '../components/rental/RentalCourierDeliveryJobCard';

type CourierBag = {
  id: string;
  bagNumber: string;
  bagCode: string;
  status: string;
  orderNumber?: string;
};

type CourierProfile = {
  id: string;
  name: string;
  phone: string;
  status: 'active' | 'inactive' | 'busy' | 'offline';
  login?: string;
  branchId: string;
  branchName?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  activeOrderId?: string | null;
  activeOrderIds?: string[];
  serviceRadiusKm?: number;
  totalDeliveries?: number;
  completedDeliveries?: number;
  rating?: number;
  averageDeliveryTime?: number;
  totalEarnings?: number;
  balance?: number;
  lastDeliveryEarning?: number;
  bags?: CourierBag[];
  emptyBags?: CourierBag[];
  occupiedBags?: CourierBag[];
  /** Kuryer so‘mkalari: jami slot / band / bo‘sh (capacity_level bo‘yicha). */
  bagSlots?: { total: number; used: number; free: number };
};

type CourierOrder = {
  id: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  finalTotal?: number;
  deliveryPrice?: number;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string;
  status: string;
  courierWorkflowStatus?: string;
  distanceKm?: number | null;
  branchName?: string;
  branchAddress?: string;
  branchCoordinates?: { lat: number; lng: number } | null;
  /** Do'kon/restoran olib ketish (matn) */
  pickupAddress?: string;
  customerLocation?: { lat: number; lng: number } | null;
  courierAssignedAt?: string;
  assignedBagId?: string | null;
  assignedBagNumber?: string | null;
  assignedBagCode?: string | null;
  preparedBagId?: string | null;
  preparedBagNumber?: string | null;
  preparedBagCode?: string | null;
  pickupRackId?: string | null;
  pickupRackName?: string | null;
  pickupRackNumber?: string | null;
  orderType?: string;
  paymentMethod?: string;
  payment_method?: string;
  paymentStatus?: string;
  payment_status?: string;
  notes?: string;
  items?: Array<{
    name?: string;
    quantity?: number;
    price?: number;
    dishName?: string;
    productName?: string;
    variantName?: string;
    additionalProducts?: Array<{ name?: string; price?: number; quantity?: number }>;
    addons?: Array<{ name?: string; price?: number; quantity?: number }>;
  }>;
  restaurantName?: string;
  shopName?: string;
  merchantName?: string;
  deliveryZone?: string;
  /** Naqd: kassaga topshiriladigan summa (yetkazish kuryerda). */
  courierCashHandoffExpectedUzs?: number;
  courierCashHandoffStatus?: string;
  courierCashHandedToCashierAt?: string | null;
};

const getAddressLine = (order: CourierOrder) =>
  order.customerAddress || 'Mijoz manzili kiritilmagan';

/** KV turli nomlar bilan saqlashi mumkin — kuryer UI uchun bir xil raqamlar. */
const getOrderDeliveryFee = (order: CourierOrder) =>
  Number(order.deliveryPrice ?? (order as { deliveryFee?: number }).deliveryFee ?? 0) || 0;

const getOrderGrandTotal = (order: CourierOrder) =>
  Number(
    order.finalTotal ??
      (order as { totalPrice?: number }).totalPrice ??
      (order as { totalAmount?: number }).totalAmount ??
      (order as { total?: number }).total ??
      0,
  ) || 0;

const getCourierPaymentMethodRaw = (order: CourierOrder) =>
  String(order.paymentMethod ?? order.payment_method ?? '').trim();

/** Naqd / COD / QR kabi — mijozdan pul olinadi (oddiy kuryer UI). */
const isCourierCashLike = (o: CourierOrder) => {
  const pm = getCourierPaymentMethodRaw(o).toLowerCase();
  const c = pm.replace(/\s+/g, '');
  if (c === 'cash' || c === 'naqd' || c === 'naqdpul' || c === 'cod') return true;
  if (pm.includes('naqd') || pm.includes('naqt') || pm.includes('cash')) return true;
  if (c === 'qr' || c === 'qrcode' || pm.includes('qr')) return true;
  return false;
};

const formatCourierPaymentMethodUz = (raw: string) => {
  const m = raw.toLowerCase().trim();
  if (!m) return "Ko'rsatilmagan";
  const compact = m.replace(/\s+/g, '');
  const map: Record<string, string> = {
    cash: "Naqd pul",
    naqd: "Naqd pul",
    click: 'Click',
    payme: 'Payme',
    uzum: 'Uzum',
    humo: 'Humo',
    atmos: 'Atmos',
    qr: 'QR',
    qrcode: 'QR',
    card: 'Bank kartasi',
    transfer: "O'tkazma",
  };
  if (map[m]) return map[m];
  if (map[compact]) return map[compact];
  if (m.includes('naqd') || m.includes('naqt')) return 'Naqd pul';
  if (m.includes('cash')) return 'Naqd pul';
  return raw;
};

const getCourierPaymentStatusText = (order: CourierOrder) => {
  const ps = String(order.paymentStatus ?? order.payment_status ?? '')
    .toLowerCase()
    .trim();
  if (ps === 'paid' || ps === 'completed' || ps === 'success') return "To'langan";
  if (ps === 'pending') return 'Kutilmoqda';
  if (ps === 'failed') return 'Muvaffaqiyatsiz';
  if (ps === 'refunded') return 'Qaytarilgan';
  return ps || '—';
};

const isCourierPaymentDone = (order: CourierOrder) => {
  const ps = String(order.paymentStatus ?? order.payment_status ?? '').toLowerCase().trim();
  return ps === 'paid' || ps === 'completed' || ps === 'success';
};

const courierMarketCashBreakdown = (o: CourierOrder) =>
  computeMarketCourierHandoffUzs(getOrderGrandTotal(o), getOrderDeliveryFee(o), isCourierCashLike(o));

/** Naqd/COD/QR va hali to‘lanmagan — mijozdan olinadigan summa va kassaga ulush ko‘rsatiladi. */
const shouldShowCourierCashCollectionHint = (o: CourierOrder) =>
  isCourierCashLike(o) && !isCourierPaymentDone(o);

const formatCustomerCoords = (order: CourierOrder) => {
  const cl = order.customerLocation;
  if (!cl) return '';
  const lat = Number(cl.lat);
  const lng = Number(cl.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

/** Mobil / desktop alohida layoutda faqat bitta Leaflet xaritasi bo‘lishi uchun. */
function useMediaQueryMdUp(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    setMatches(mq.matches);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return matches;
}

const getOrderStatusText = (status?: string) => {
  const s = String(status || '').toLowerCase().trim();
  const map: Record<string, string> = {
    pending: 'Yangi',
    new: 'Yangi',
    accepted: 'Qabul qilingan',
    confirmed: 'Tasdiqlangan',
    preparing: 'Tayyorlanmoqda',
    ready: 'Tayyor',
    delivering: 'Yo‘lda',
    with_courier: 'Kuryerda',
    delivered: 'Yetkazildi',
    awaiting_receipt: 'Mijoz tasdig‘i kutilmoqda',
    completed: 'Yakunlangan',
    cancelled: 'Bekor qilingan',
    canceled: 'Bekor qilingan',
    rejected: 'Rad etilgan',
  };
  return map[s] || (status ? String(status) : '—');
};

const isCourierOrderCancelled = (o: CourierOrder) => {
  const s = String(o.status || '').toLowerCase();
  const w = String(o.courierWorkflowStatus || '').toLowerCase();
  return s === 'cancelled' || s === 'canceled' || w === 'cancelled' || w === 'canceled';
};

const getOrderTypeText = (orderType?: string) => {
  const x = String(orderType || '').toLowerCase().trim();
  if (x === 'food' || x === 'restaurant') return 'Taom';
  if (x === 'shop') return "Do'kon";
  if (x === 'market') return 'Market';
  if (x === 'rental') return 'Ijara';
  return "Buyurtma";
};

const courierOrderActionPath = (
  orderId: string,
  action: 'accept' | 'pickup' | 'arrived' | 'delivered',
) => `/courier/orders/${encodeURIComponent(orderId)}/${action}`;

/** «Yetib keldim» uchun serverdagi masofa tekshiruvi — profildan emas, hozirgi GPS. */
async function courierArrivedRequestBody(): Promise<Record<string, unknown>> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return {};
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

const buildProfileSignature = (profile: CourierProfile | null) =>
  JSON.stringify({
    id: profile?.id || null,
    name: profile?.name || '',
    phone: profile?.phone || '',
    status: profile?.status || '',
    branchId: profile?.branchId || '',
    branchName: profile?.branchName || '',
    activeOrderId: profile?.activeOrderId || null,
    activeOrderIds: Array.isArray(profile?.activeOrderIds) ? profile.activeOrderIds : [],
    bagSlots: profile?.bagSlots
      ? `${profile.bagSlots.total}|${profile.bagSlots.used}|${profile.bagSlots.free}`
      : '',
    serviceRadiusKm: profile?.serviceRadiusKm || 0,
    completedDeliveries: profile?.completedDeliveries || 0,
    totalEarnings: Number(profile?.totalEarnings || 0).toFixed(2),
    balance: Number(profile?.balance || 0).toFixed(2),
    lastDeliveryEarning: Number(profile?.lastDeliveryEarning || 0).toFixed(2),
    bags: (profile?.bags || []).map((bag) => ({
      id: bag.id,
      bagNumber: bag.bagNumber,
      bagCode: bag.bagCode,
      status: bag.status,
    })),
    currentLocation: profile?.currentLocation
      ? {
          latitude: Number(profile.currentLocation.latitude || 0).toFixed(5),
          longitude: Number(profile.currentLocation.longitude || 0).toFixed(5),
          address: profile.currentLocation.address || '',
        }
      : null,
  });

const buildOrdersSignature = (orders: CourierOrder[]) =>
  JSON.stringify(
    [...orders]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber || '',
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress || '',
      distanceKm: Number(order.distanceKm || 0).toFixed(2),
      assignedBagNumber: order.assignedBagNumber || '',
      customerLocation: order.customerLocation
        ? {
            lat: Number(order.customerLocation.lat || 0).toFixed(5),
            lng: Number(order.customerLocation.lng || 0).toFixed(5),
          }
        : null,
    }))
  );

const buildActiveOrdersSignature = (orders: CourierOrder[]) =>
  JSON.stringify(
    [...orders]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber || '',
        status: order.status,
        courierWorkflowStatus: order.courierWorkflowStatus || '',
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress || '',
        customerLocation: order.customerLocation
          ? {
              lat: Number(order.customerLocation.lat || 0).toFixed(5),
              lng: Number(order.customerLocation.lng || 0).toFixed(5),
            }
          : null,
        branchCoordinates: order.branchCoordinates
          ? {
              lat: Number(order.branchCoordinates.lat || 0).toFixed(5),
              lng: Number(order.branchCoordinates.lng || 0).toFixed(5),
            }
          : null,
        assignedBagNumber: order.assignedBagNumber || '',
      })),
  );

const readPayload = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retries = 2,
): Promise<Response> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchWithTimeout(url, options, 15000 + attempt * 5000);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed');
};

function CourierActionPendingLabel() {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
      <span>Yuborilmoqda...</span>
    </span>
  );
}

type SwipeActionProps = {
  label: string;
  disabled?: boolean;
  isDark: boolean;
  gradient: string;
  onComplete: () => void;
};

function SwipeAction({ label, disabled = false, isDark, gradient, onComplete }: SwipeActionProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startDragX, setStartDragX] = useState(0);
  const knobSize = 42;

  const getMax = () => {
    const width = trackRef.current?.clientWidth || 0;
    return Math.max(0, width - knobSize - 6);
  };

  const beginDrag = (clientX: number) => {
    if (disabled) return;
    setDragging(true);
    setStartX(clientX);
    setStartDragX(dragX);
  };

  const moveDrag = (clientX: number) => {
    if (!dragging || disabled) return;
    const next = Math.max(0, Math.min(getMax(), startDragX + (clientX - startX)));
    setDragX(next);
  };

  const endDrag = () => {
    if (!dragging) return;
    const max = getMax();
    const completed = max > 0 && dragX >= max * 0.82;
    setDragging(false);
    if (completed) {
      setDragX(max);
      onComplete();
      window.setTimeout(() => setDragX(0), 450);
      return;
    }
    setDragX(0);
  };

  return (
    <div
      ref={trackRef}
      className="relative h-12 rounded-2xl overflow-hidden select-none"
      style={{
        background: disabled
          ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
          : gradient,
        touchAction: 'pan-y',
      }}
      onPointerMove={(e) => moveDrag(e.clientX)}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-semibold text-white">{label}</span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => beginDrag(e.clientX)}
        className="absolute top-[3px] left-[3px] w-[42px] h-[42px] rounded-xl flex items-center justify-center border"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 180ms ease',
          background: 'rgba(255,255,255,0.92)',
          borderColor: 'rgba(0,0,0,0.08)',
          touchAction: 'none',
        }}
        aria-label={label}
      >
        <CheckCircle2 className="w-5 h-5" style={{ color: '#2563eb' }} />
      </button>
    </div>
  );
}

type CourierPayoutRequestRow = {
  id: string;
  amountUzs: number;
  requestedMethod: 'cash' | 'card';
  status: 'pending' | 'paid' | 'rejected';
  createdAt: string;
  decidedAt?: string | null;
  paidMethod?: 'cash' | 'card' | null;
};

export default function CourierDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor, notifications, soundEnabled, toggleNotifications, toggleSound, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const edgeBaseUrl = useMemo(
    () =>
      typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? DEV_API_BASE_URL
        : API_BASE_URL,
    [],
  );
  const textColor = isDark ? '#ffffff' : '#111827';
  const mutedTextColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(17, 24, 39, 0.7)';

  const [profile, setProfile] = useState<CourierProfile | null>(null);
  const [availableOrders, setAvailableOrders] = useState<CourierOrder[]>([]);
  const [activeOrders, setActiveOrders] = useState<CourierOrder[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<CourierOrder[]>([]);
  const [courierRentalOrders, setCourierRentalOrders] = useState<any[]>([]);
  const [courierRentalDeliveryJobs, setCourierRentalDeliveryJobs] = useState<any[]>([]);
  const [rentalPickupBusyId, setRentalPickupBusyId] = useState<string | null>(null);
  const [rentalDeliverToCustomerBusyId, setRentalDeliverToCustomerBusyId] = useState<string | null>(null);
  const [rentalDepositUploadBusyId, setRentalDepositUploadBusyId] = useState<string | null>(null);
  const rentalPickupToastedRef = useRef<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const lastProfileSignatureRef = useRef('');
  const lastAvailableOrdersSignatureRef = useRef('');
  const lastActiveOrderSignatureRef = useRef('');
  const dashboardRequestInFlightRef = useRef(false);
  const actionLoadingRef = useRef<string | null>(null);
  const [selectedBagId, setSelectedBagId] = useState('');
  const [bagQrOpen, setBagQrOpen] = useState(false);

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'cash' | 'card'>('cash');
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<CourierPayoutRequestRow[]>([]);
  const [payoutListLoading, setPayoutListLoading] = useState(false);
  const [courierCardNumberDraft, setCourierCardNumberDraft] = useState('');
  const [courierTelegramChatIdDraft, setCourierTelegramChatIdDraft] = useState('');
  const bagQrScannerRef = useRef<any>(null);
  const [mobileSection, setMobileSection] = useState<'orders' | 'history' | 'stats' | 'profile'>('orders');
  const [mobileOrderTab, setMobileOrderTab] = useState<'new' | 'delivering' | 'delivered' | 'cancelled'>('new');
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploadPct, setAvatarUploadPct] = useState<number | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const isMdUp = useMediaQueryMdUp();

  const renderCourierCashCollectionHint = (order: CourierOrder, size: 'normal' | 'compact' = 'normal') => {
    if (!shouldShowCourierCashCollectionHint(order)) return null;
    const { totalUzs, deliveryKeptUzs, toCashierUzs } = courierMarketCashBreakdown(order);
    const isCompact = size === 'compact';
    return (
      <div
        className={isCompact ? 'mt-2 p-2.5 rounded-xl border' : 'mt-3 p-3 rounded-xl border'}
        style={{
          borderColor: isDark ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.45)',
          background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
        }}
      >
        <p
          className={
            isCompact
              ? 'text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-1'
              : 'text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2'
          }
        >
          Mijozdan naqd olishingiz kerak
        </p>
        <p
          className={isCompact ? 'text-lg font-bold tabular-nums' : 'text-xl font-bold tabular-nums'}
          style={{ color: accentColor.color }}
        >
          {totalUzs.toLocaleString('uz-UZ')} so'm
        </p>
        <div
          className={isCompact ? 'mt-1.5 text-[11px] space-y-0.5 leading-snug' : 'mt-2 text-xs space-y-1'}
          style={{ color: mutedTextColor }}
        >
          {deliveryKeptUzs > 0 ? (
            <p>
              Yetkazish (sizda qoladi):{' '}
              <span className="font-semibold tabular-nums">{deliveryKeptUzs.toLocaleString('uz-UZ')} so'm</span>
            </p>
          ) : null}
          {toCashierUzs > 0 ? (
            <p>
              Filial kassasiga:{' '}
              <span className="font-semibold tabular-nums text-amber-800 dark:text-amber-200">
                {toCashierUzs.toLocaleString('uz-UZ')} so'm
              </span>
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  const loadDashboard = useCallback(async (silent = false) => {
    if (dashboardRequestInFlightRef.current) {
      return;
    }

    dashboardRequestInFlightRef.current = true;
    if (!silent) {
      setIsLoading(true);
    }

    const courierToken = getStoredCourierToken();
    if (!courierToken) {
      localStorage.removeItem('courierSession');
      if (!silent) {
        toast.error('Sessiya topilmadi, qaytadan kiring');
      }
      navigate('/kuryer');
      dashboardRequestInFlightRef.current = false;
      if (!silent) setIsLoading(false);
      return;
    }
    const tokenQuery = courierToken ? `?token=${encodeURIComponent(courierToken)}` : '';
    const baseUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
      ? DEV_API_BASE_URL
      : API_BASE_URL;

    try {
      const [meResult, availableResult, activeResult, historyResult, rentalIjaraResult, rentalDeliveryJobsResult] =
        await Promise.allSettled([
        fetchWithRetry(
          `${baseUrl}/courier/me${tokenQuery}`,
          {},
        ),
        fetchWithRetry(
          `${baseUrl}/courier/orders/available${tokenQuery}`,
          {},
        ),
        fetchWithRetry(
          `${baseUrl}/courier/orders/active${tokenQuery}`,
          {},
        ),
        fetchWithRetry(
          `${baseUrl}/courier/orders/history?limit=200${
            tokenQuery ? `&token=${encodeURIComponent(courierToken)}` : ''
          }`,
          {},
        ),
        fetchWithRetry(
          `${baseUrl}/rentals/courier/active-rentals${tokenQuery}`,
          {
            headers: {
              'X-Courier-Token': courierToken,
              apikey: publicAnonKey,
              Authorization: `Bearer ${publicAnonKey}`,
            },
          },
        ),
        fetchWithRetry(
          `${baseUrl}/rentals/courier/rental-delivery-jobs${tokenQuery}`,
          {
            headers: {
              'X-Courier-Token': courierToken,
              apikey: publicAnonKey,
              Authorization: `Bearer ${publicAnonKey}`,
            },
          },
        ),
      ]);

      const meResponse = meResult.status === 'fulfilled' ? meResult.value : null;
      const availableResponse = availableResult.status === 'fulfilled' ? availableResult.value : null;
      const activeResponse = activeResult.status === 'fulfilled' ? activeResult.value : null;
      const historyResponse = historyResult.status === 'fulfilled' ? historyResult.value : null;
      const rentalIjaraResponse =
        rentalIjaraResult.status === 'fulfilled' ? rentalIjaraResult.value : null;
      const rentalDeliveryJobsResponse =
        rentalDeliveryJobsResult.status === 'fulfilled' ? rentalDeliveryJobsResult.value : null;

      if (meResponse && (meResponse.status === 401 || meResponse.status === 403)) {
        localStorage.removeItem('courierSession');
        toast.error('Sessiya tugagan, qaytadan kiring');
        navigate('/kuryer');
        return;
      }

      const meData = meResponse ? await readPayload(meResponse) : null;
      const availableData = availableResponse ? await readPayload(availableResponse) : null;
      const activeData = activeResponse ? await readPayload(activeResponse) : null;
      const historyData = historyResponse ? await readPayload(historyResponse) : null;
      const rentalIjaraData = rentalIjaraResponse ? await readPayload(rentalIjaraResponse) : null;
      const rentalDeliveryJobsData = rentalDeliveryJobsResponse
        ? await readPayload(rentalDeliveryJobsResponse)
        : null;

      if (meResponse?.ok && meData?.success) {
        const nextProfile = meData.courier || null;
        const nextProfileSignature = buildProfileSignature(nextProfile);
        if (nextProfileSignature !== lastProfileSignatureRef.current) {
          lastProfileSignatureRef.current = nextProfileSignature;
          setProfile(nextProfile);
        }
      }
      if (availableResponse?.ok && availableData?.success) {
        const nextOrders = sortOrdersNewestFirst(availableData.orders || []);
        const nextOrdersSignature = buildOrdersSignature(nextOrders);
        if (nextOrdersSignature !== lastAvailableOrdersSignatureRef.current) {
          lastAvailableOrdersSignatureRef.current = nextOrdersSignature;
          setAvailableOrders(nextOrders);
        }
      }
      if (activeResponse?.ok && activeData?.success) {
        const nextList: CourierOrder[] = sortOrdersNewestFirst(
          Array.isArray(activeData.orders)
            ? activeData.orders
            : activeData.order
              ? [activeData.order]
              : [],
        );
        const nextSig = buildActiveOrdersSignature(nextList);
        if (nextSig !== lastActiveOrderSignatureRef.current) {
          lastActiveOrderSignatureRef.current = nextSig;
          setActiveOrders(nextList);
        }
      }
      if (historyResponse?.ok && historyData?.success) {
        setDeliveredOrders(
          sortOrdersNewestFirst(Array.isArray(historyData.orders) ? historyData.orders : []),
        );
      }
      if (rentalIjaraResponse?.ok && rentalIjaraData?.success && Array.isArray(rentalIjaraData.orders)) {
        setCourierRentalOrders(sortOrdersNewestFirst(rentalIjaraData.orders));
      } else {
        setCourierRentalOrders([]);
      }
      if (
        rentalDeliveryJobsResponse?.ok &&
        rentalDeliveryJobsData?.success &&
        Array.isArray(rentalDeliveryJobsData.orders)
      ) {
        setCourierRentalDeliveryJobs(sortOrdersNewestFirst(rentalDeliveryJobsData.orders));
      } else {
        setCourierRentalDeliveryJobs([]);
      }

      // FIXED: Update courier status based on active orders
      if (activeResponse?.ok && activeData?.success) {
        const activeOrdersList = Array.isArray(activeData.order) ? [activeData.order] : [];
        const hasActiveOrders = activeOrdersList.length > 0;
        
        // FORCE UPDATE: Always update status based on active orders
        setProfile(prev => prev ? {
          ...prev,
          status: hasActiveOrders ? 'busy' : 'active'
        } : null);
      }

      if (!silent) {
        const hardFailure =
          (meResult.status === 'rejected') ||
          (availableResult.status === 'rejected' && activeResult.status === 'rejected') ||
          (meResponse && !meResponse.ok && meResponse.status >= 500);

        if (hardFailure) {
          toast.error('Kuryer paneli server bilan bog\'lana olmadi');
        }
      }
    } catch (error) {
      console.error('Courier dashboard error:', error);
      if (!silent) {
        toast.error('Kuryer panelini yuklashda xatolik');
      }
    } finally {
      dashboardRequestInFlightRef.current = false;
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [navigate]);

  const loadPayoutRequests = useCallback(
    async (silent = true) => {
      try {
        if (!silent) setPayoutListLoading(true);
        const courierToken = getStoredCourierToken();
        if (!courierToken) return;
        const tokenQuery = `?token=${encodeURIComponent(courierToken)}`;
        const baseUrl =
          typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? DEV_API_BASE_URL
            : API_BASE_URL;
        const res = await fetchWithRetry(`${baseUrl}/courier/payout-requests${tokenQuery}`, { cache: 'no-store' as any });
        const data = await readPayload(res);
        if (res.ok && data?.success) {
          setPayoutRequests(Array.isArray(data.requests) ? data.requests : []);
        }
      } catch {
        // silent
      } finally {
        if (!silent) setPayoutListLoading(false);
      }
    },
    [],
  );

  const loadDashboardLight = useCallback(
    async (silent = true) => {
      if (dashboardRequestInFlightRef.current) {
        return;
      }
      dashboardRequestInFlightRef.current = true;
      if (!silent) {
        setIsLoading(true);
      }

      const courierToken = getStoredCourierToken();
      if (!courierToken) {
        localStorage.removeItem('courierSession');
        if (!silent) {
          toast.error('Sessiya topilmadi, qaytadan kiring');
        }
        navigate('/kuryer');
        dashboardRequestInFlightRef.current = false;
        if (!silent) setIsLoading(false);
        return;
      }

      const tokenQuery = courierToken ? `?token=${encodeURIComponent(courierToken)}` : '';
      const baseUrl =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? DEV_API_BASE_URL
          : API_BASE_URL;

      try {
        const [meResult, availableResult, activeResult] = await Promise.allSettled([
          fetchWithRetry(`${baseUrl}/courier/me${tokenQuery}`, {}),
          fetchWithRetry(`${baseUrl}/courier/orders/available${tokenQuery}`, {}),
          fetchWithRetry(`${baseUrl}/courier/orders/active${tokenQuery}`, {}),
        ]);

        const meResponse = meResult.status === 'fulfilled' ? meResult.value : null;
        const availableResponse = availableResult.status === 'fulfilled' ? availableResult.value : null;
        const activeResponse = activeResult.status === 'fulfilled' ? activeResult.value : null;

        if (meResponse && (meResponse.status === 401 || meResponse.status === 403)) {
          localStorage.removeItem('courierSession');
          toast.error('Sessiya tugagan, qaytadan kiring');
          navigate('/kuryer');
          return;
        }

        const meData = meResponse ? await readPayload(meResponse) : null;
        const availableData = availableResponse ? await readPayload(availableResponse) : null;
        const activeData = activeResponse ? await readPayload(activeResponse) : null;

        if (meResponse?.ok && meData?.success) {
          const nextProfile = meData.courier || null;
          const nextProfileSignature = buildProfileSignature(nextProfile);
          if (nextProfileSignature !== lastProfileSignatureRef.current) {
            lastProfileSignatureRef.current = nextProfileSignature;
            setProfile(nextProfile);
          }
        }

        if (availableResponse?.ok && availableData?.success) {
          const nextOrders = sortOrdersNewestFirst(availableData.orders || []);
          const nextOrdersSignature = buildOrdersSignature(nextOrders);
          if (nextOrdersSignature !== lastAvailableOrdersSignatureRef.current) {
            lastAvailableOrdersSignatureRef.current = nextOrdersSignature;
            setAvailableOrders(nextOrders);
          }
        }

        if (activeResponse?.ok && activeData?.success) {
          const nextList: CourierOrder[] = sortOrdersNewestFirst(
            Array.isArray(activeData.orders)
              ? activeData.orders
              : activeData.order
                ? [activeData.order]
                : [],
          );
          const nextSig = buildActiveOrdersSignature(nextList);
          if (nextSig !== lastActiveOrderSignatureRef.current) {
            lastActiveOrderSignatureRef.current = nextSig;
            setActiveOrders(nextList);
          }
        }
      } finally {
        dashboardRequestInFlightRef.current = false;
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [navigate],
  );

  useEffect(() => {
    for (const o of courierRentalOrders) {
      const oid = String(o?.id || '');
      if (!oid || o.pickupAlert !== 'overdue') continue;
      if (rentalPickupToastedRef.current.has(oid)) continue;
      rentalPickupToastedRef.current.add(oid);
      toast.error(
        `Ijara muddati tugadi — «${String(o.productName || 'Mahsulot')}» ni mijozdan qaytarib oling`,
        { duration: 12_000 },
      );
    }
  }, [courierRentalOrders]);

  useEffect(() => {
    if (courierRentalOrders.length === 0) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void loadDashboard(true);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [courierRentalOrders.length, loadDashboard]);

  const confirmRentalPickupReturn = useCallback(
    async (order: any) => {
      const courierToken = getStoredCourierToken();
      if (!courierToken) return;
      const baseUrl =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? DEV_API_BASE_URL
          : API_BASE_URL;
      const oid = String(order?.id || '');
      if (!oid || !order?.branchId) {
        toast.error('Buyurtma ma’lumoti to‘liq emas');
        return;
      }
      setRentalPickupBusyId(oid);
      try {
        const res = await fetch(`${baseUrl}/rentals/orders/${encodeURIComponent(oid)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Courier-Token': courierToken,
            apikey: publicAnonKey,
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            branchId: order.branchId,
            confirmPickupReturn: true,
          }),
        });
        const data = await readPayload(res);
        if (res.ok && data?.success) {
          const ord = data?.order as { courierCashHandoffExpectedUzs?: number; courierCashHandoffStatus?: string } | undefined;
          const exp = Number(ord?.courierCashHandoffExpectedUzs) || 0;
          const st = String(ord?.courierCashHandoffStatus || '');
          if (st === 'pending_cashier' && exp > 0) {
            toast.success(
              `Qaytarish qayd etildi. Filial kassasiga topshiring: ${exp.toLocaleString('uz-UZ')} so‘m`,
            );
          } else {
            toast.success('Qaytarish qayd etildi');
          }
          rentalPickupToastedRef.current.delete(oid);
          await loadDashboard(true);
        } else {
          toast.error(data?.error || 'Qaytarishda xatolik');
        }
      } catch {
        toast.error('Tarmoq xatosi');
      } finally {
        setRentalPickupBusyId(null);
      }
    },
    [loadDashboard],
  );

  const confirmRentalDeliveredToCustomer = useCallback(
    async (order: any) => {
      const courierToken = getStoredCourierToken();
      if (!courierToken) return;
      const baseUrl =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? DEV_API_BASE_URL
          : API_BASE_URL;
      const oid = String(order?.id || '');
      if (!oid || !order?.branchId) {
        toast.error('Buyurtma ma’lumoti to‘liq emas');
        return;
      }
      setRentalDeliverToCustomerBusyId(oid);
      try {
        const res = await fetch(`${baseUrl}/rentals/orders/${encodeURIComponent(oid)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Courier-Token': courierToken,
            apikey: publicAnonKey,
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            branchId: order.branchId,
            courierMarkDeliveredToCustomer: true,
          }),
        });
        const data = await readPayload(res);
        if (res.ok && data?.success) {
          toast.success('Mijozga yetkazildi — ijara muddati boshlandi');
          await loadDashboard(true);
        } else {
          toast.error(data?.error || 'Tasdiqlashda xatolik');
        }
      } catch {
        toast.error('Tarmoq xatosi');
      } finally {
        setRentalDeliverToCustomerBusyId(null);
      }
    },
    [loadDashboard],
  );

  const uploadRentalDepositPhoto = useCallback(
    async (order: any, file: File) => {
      const courierToken = getStoredCourierToken();
      if (!courierToken) return;
      const baseUrl =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? DEV_API_BASE_URL
          : API_BASE_URL;
      const oid = String(order?.id || '');
      if (!oid || !order?.branchId) {
        toast.error('Buyurtma ma’lumoti to‘liq emas');
        return;
      }
      setRentalDepositUploadBusyId(oid);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => reject(new Error('read'));
          r.readAsDataURL(file);
        });
        if (!dataUrl.startsWith('data:image/')) {
          toast.error('Faqat rasm fayli tanlang');
          return;
        }
        const res = await fetch(`${baseUrl}/rentals/orders/${encodeURIComponent(oid)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Courier-Token': courierToken,
            apikey: publicAnonKey,
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            branchId: order.branchId,
            courierUploadDepositPhoto: true,
            depositPhotoDataUrl: dataUrl,
          }),
        });
        const data = await readPayload(res);
        if (res.ok && data?.success) {
          toast.success('Garov rasmi saqlandi');
          await loadDashboard(true);
        } else {
          toast.error(data?.error || 'Yuklashda xatolik');
        }
      } catch {
        toast.error('Rasm o‘qilmadi yoki tarmoq xatosi');
      } finally {
        setRentalDepositUploadBusyId(null);
      }
    },
    [loadDashboard],
  );

  useVisibilityRefetch(() => {
    void loadDashboard(true);
  });

  const pushLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const courierToken = getStoredCourierToken();
          if (!courierToken) {
            return;
          }
          const tokenQuery = courierToken ? `?token=${encodeURIComponent(courierToken)}` : '';
          const baseUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
            ? DEV_API_BASE_URL
            : API_BASE_URL;

          const form = new URLSearchParams();
          form.set('latitude', String(position.coords.latitude));
          form.set('longitude', String(position.coords.longitude));

          await fetch(
            `${baseUrl}/courier/location${tokenQuery}`,
            {
              method: 'POST',
              headers: {
                'X-Courier-Token': courierToken,
              },
              body: form,
            },
          );
        } catch (error) {
          console.error('Courier location update error:', error);
        }
      },
      () => {
        // Ignore silent geolocation failures.
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10000,
      }
    );
  }, [loadDashboard]);

  useEffect(() => {
    const rawSession = localStorage.getItem('courierSession');
    if (!rawSession) {
      navigate('/kuryer');
      return;
    }

    loadDashboard();
    pushLocation();

    const refreshInterval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      if (actionLoadingRef.current) {
        return;
      }
      void loadDashboardLight(true);
    }, 3000);

    const locationInterval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      if (actionLoadingRef.current) {
        return;
      }
      void pushLocation();
    }, 15000);

    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(locationInterval);
    };
  }, [loadDashboard, loadDashboardLight, navigate, pushLocation]);

  useEffect(() => {
    setCourierCardNumberDraft(String((profile as any)?.cardNumber || ''));
    setCourierTelegramChatIdDraft(String((profile as any)?.telegramChatId || ''));
  }, [profile]);

  useEffect(() => {
    void loadPayoutRequests(true);
    const t = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadPayoutRequests(true);
    }, 12000);
    return () => window.clearInterval(t);
  }, [loadPayoutRequests]);

  const executeCourierPost = useCallback(
    async (
      endpoint: string,
      body?: Record<string, unknown>,
    ): Promise<{ ok: boolean; status: number; error?: string }> => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort('request_timeout'), 30000);
      try {
        const courierToken = getStoredCourierToken();
        const tokenQuery = courierToken ? `?token=${encodeURIComponent(courierToken)}` : '';
        const baseUrl =
          typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? DEV_API_BASE_URL
            : API_BASE_URL;

        const form = new URLSearchParams();
        if (body) {
          for (const [k, v] of Object.entries(body)) {
            if (v === undefined || v === null) continue;
            form.set(k, typeof v === 'string' ? v : String(v));
          }
        }

        const response = await fetch(`${baseUrl}${endpoint}${tokenQuery}`, {
          method: 'POST',
          body: body ? form : undefined,
          signal: controller.signal,
        });

        const result = await readPayload(response);
        const ok = response.ok && Boolean(result?.success);
        if (!ok && (response.status === 409 || response.status === 404 || response.status === 400)) {
          await loadDashboard(true);
        }
        return {
          ok,
          status: response.status,
          error: typeof result?.error === 'string' ? result.error : !ok ? 'Amal bajarilmadi' : undefined,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          await loadDashboard(true);
          return { ok: false, status: 0, error: 'Server juda sekin javob berdi, holatni tekshirib qayta urinib ko‘ring' };
        }
        console.error('Courier post error:', error);
        return { ok: false, status: 0, error: 'Amalni bajarishda xatolik' };
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [loadDashboard],
  );

  const handleOrderAction = async (endpoint: string, body?: Record<string, unknown>) => {
    setActionLoading(endpoint);
    actionLoadingRef.current = endpoint;
    try {
      const res = await executeCourierPost(endpoint, body);
      if (!res.ok) {
        toast.error(res.error || 'Amal bajarilmadi');
        return;
      }
      await loadDashboard(true);
      if (endpoint.endsWith('/delivered')) {
        toast.info(
          'Buyurtma mijozga topshirildi. Mijoz ilovada «Qabul qildim» yoki «Bekor qilish»ni tanlaydi.',
          { duration: 5500 },
        );
      }
    } finally {
      setActionLoading(null);
      actionLoadingRef.current = null;
    }
  };

  const acceptBodyForOrder = (order: CourierOrder) =>
    order.preparedBagId
      ? { bagId: order.preparedBagId }
      : selectedBagId
        ? { bagId: selectedBagId }
        : undefined;

  const acceptAndPickupOrder = async (order: CourierOrder) => {
    const key = `accept-pickup:${order.id}`;
    setActionLoading(key);
    actionLoadingRef.current = key;
    try {
      const r1 = await executeCourierPost(courierOrderActionPath(order.id, 'accept'), acceptBodyForOrder(order));
      if (!r1.ok) {
        toast.error(r1.error || 'Buyurtma qabul qilinmadi');
        return;
      }
      const r2 = await executeCourierPost(courierOrderActionPath(order.id, 'pickup'), undefined);
      if (!r2.ok) {
        toast.error(
          r2.error ||
            'Buyurtma qabul qilindi, lekin filialdan olishda xato. Filialni tekshiring yoki keyinroq qayta urinib ko‘ring.',
        );
        await loadDashboard(true);
        return;
      }
      await loadDashboard(true);
      toast.success('Buyurtma qabul qilindi — yo‘ldasiz');
    } finally {
      setActionLoading(null);
      actionLoadingRef.current = null;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('courierSession');
    navigate('/kuryer');
  };

  const handleAvatarButtonClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm faylini tanlang');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    void (async () => {
      try {
        setIsUploadingAvatar(true);
        setAvatarUploadPct(0);

        const compressed = await compressImageIfNeeded(file);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('type', 'courier');

        const { data, status } = await uploadFormDataWithProgress<{ url?: string; error?: string; message?: string }>({
          url: `${API_BASE_URL}/upload-image`,
          formData,
          onProgress: (pct) => setAvatarUploadPct(pct),
        });

        if (status < 200 || status >= 300 || !data?.url) {
          throw new Error(data?.error || data?.message || `Upload xatolik (${status})`);
        }

        setProfile((prev) => (prev ? { ...prev, avatarUrl: String(data.url) } : prev));
        setAvatarUploadPct(100);
      } catch (err: any) {
        toast.error(err?.message || 'Rasm yuklashda xatolik');
      } finally {
        setIsUploadingAvatar(false);
        setTimeout(() => setAvatarUploadPct(null), 900);
      }
    })();

    event.target.value = '';
  };

  const openPhoneDialer = () => {
    if (!profile?.phone) {
      toast.error('Telefon raqam mavjud emas');
      return;
    }
    window.open(`tel:${profile.phone.replace(/\s+/g, '')}`, '_self');
  };

  const openEmailComposer = () => {
    const email = `${(profile?.login || 'courier').replace(/\s+/g, '').toLowerCase()}@courier.uz`;
    window.open(`mailto:${email}`, '_self');
  };

  const openProfileEditModal = () => {
    setEditName(profile?.name || '');
    setEditPhone(profile?.phone || '');
    setProfileEditOpen(true);
  };

  const saveProfileEdit = () => {
    const nextName = editName.trim();
    const nextPhone = editPhone.trim();
    if (!nextName) {
      toast.error('Ism bo‘sh bo‘lmasligi kerak');
      return;
    }
    if (!nextPhone) {
      toast.error('Telefon bo‘sh bo‘lmasligi kerak');
      return;
    }
    setProfile((prev) => (prev ? { ...prev, name: nextName, phone: nextPhone } : prev));
    setProfileEditOpen(false);
  };

  const openHelpChat = () => {
    openExternalUrlSync('https://t.me');
  };

  const openMap = (type: 'pickup' | 'customer', order: CourierOrder) => {
    const cur = profile?.currentLocation;
    if (cur?.latitude == null || cur?.longitude == null) {
      toast.error('Yo‘l chizig‘i uchun joriy lokatsiya kerak — brauzerda joy ruxsatini yoqing.');
      return;
    }
    const start: [number, number] = [Number(cur.latitude), Number(cur.longitude)];

    let end: [number, number] | null = null;
    if (type === 'pickup') {
      const b = order.branchCoordinates;
      const lat = Number(b?.lat);
      const lng = Number(b?.lng);
      if (!b || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        toast.error('Olib ketish nuqtasi (GPS) topilmadi — do‘kon/restoran koordinatalari yoki filial lokatsiyasi sozlangansini tekshiring.');
        return;
      }
      end = [lat, lng];
    } else {
      const pt = getOrderMapPoint(order);
      if (!pt) {
        toast.error('Mijoz lokatsiyasi topilmadi (GPS yoki manzildagi koordinatalar)');
        return;
      }
      end = [pt.lat, pt.lng];
    }

    try {
      sessionStorage.setItem(
        COURIER_MAP_ROUTE_STORAGE_KEY,
        JSON.stringify({
          start,
          end,
          label:
            type === 'pickup'
              ? order.pickupAddress || order.shopName || order.restaurantName || order.branchName || 'Olib ketish'
              : order.customerName || 'Mijoz',
        }),
      );
    } catch {
      /* ignore */
    }
    navigate('/kuryer/xarita');
  };

  const statusBadge = useMemo(() => {
    const currentStatus = profile?.status || 'inactive';
    const statusMap: Record<string, string> = {
      active: '#10b981',
      busy: '#f59e0b',
      inactive: '#6b7280',
      offline: '#ef4444',
    };

    return statusMap[currentStatus] || '#6b7280';
  }, [profile?.status]);

  const courierWorkflow = (o: CourierOrder) => o.courierWorkflowStatus || o.status || '';
  const workflowNorm = (o: CourierOrder) => String(courierWorkflow(o)).toLowerCase().trim();

  /** Yo‘lda: mijozgacha — yetib keldim */
  const canPressYetibKeldim = (o: CourierOrder) => {
    const w = workflowNorm(o);
    return ['accepted', 'picked_up', 'delivering', 'with_courier'].includes(w);
  };

  /** Yetib kelgach avtomatik yakunlash: to‘langan + naqd emas */
  const shouldAutoCompleteAfterArrived = (o: CourierOrder) => {
    if (isCourierCashLike(o)) return false;
    const ps = String(o.paymentStatus ?? o.payment_status ?? '').toLowerCase().trim();
    return ['paid', 'completed', 'success'].includes(ps);
  };

  const activeOrdersOnTheWay = useMemo(
    () => activeOrders.filter((o) => canPressYetibKeldim(o)),
    [activeOrders],
  );

  /** Yetib kelgan, lekin kuryer «Pulni oldim» bilan yakunlashi kerak (naqd yoki hali to‘lanmagan onlayn). */
  const activeOrdersManualComplete = useMemo(
    () => activeOrders.filter((o) => workflowNorm(o) === 'arrived' && !shouldAutoCompleteAfterArrived(o)),
    [activeOrders],
  );

  const submitCourierArrivedWithAutoDeliver = async (order: CourierOrder) => {
    const key = `arrived-chain:${order.id}`;
    setActionLoading(key);
    actionLoadingRef.current = key;
    try {
      const body = await courierArrivedRequestBody();
      const r1 = await executeCourierPost(
        courierOrderActionPath(order.id, 'arrived'),
        Object.keys(body).length ? body : undefined,
      );
      if (!r1.ok) {
        toast.error(r1.error || '«Yetib keldim» bajarilmadi');
        return;
      }
      if (shouldAutoCompleteAfterArrived(order)) {
        const r2 = await executeCourierPost(courierOrderActionPath(order.id, 'delivered'), undefined);
        if (!r2.ok) {
          toast.error(r2.error || 'Yetib keldingiz, lekin yakunlashda xatolik');
          await loadDashboard(true);
          return;
        }
        await loadDashboard(true);
        toast.info(
          'Buyurtma mijozga topshirildi. Mijoz ilovada «Qabul qildim» yoki «Bekor qilish»ni tanlaydi.',
          { duration: 5500 },
        );
      } else {
        await loadDashboard(true);
        setMobileOrderTab('delivered');
        toast.message(
          isCourierCashLike(order)
            ? 'Mijozdan pulni oling, keyin «Pulni oldim» bosing'
            : 'Buyurtmani topshirgach «Pulni oldim» bilan yakunlang',
        );
      }
    } finally {
      setActionLoading(null);
      actionLoadingRef.current = null;
    }
  };

  const emptyBags = profile?.emptyBags || [];
  const assignedBags = profile?.bags || [];
  /** Tayyorlangan so‘mka (filial) bo‘lmasa va biriktirilgan so‘mkalarda bo‘sh slot qolmagan. */
  const noBagSlotForNewOrder = (order: CourierOrder) =>
    !order.preparedBagId &&
    (profile?.bagSlots?.total ?? 0) > 0 &&
    (profile?.bagSlots?.free ?? 0) < 1;

  const courierHistoryDone = useMemo(
    () => deliveredOrders.filter((o) => !isCourierOrderCancelled(o)),
    [deliveredOrders],
  );
  const courierHistoryCancelled = useMemo(
    () => deliveredOrders.filter((o) => isCourierOrderCancelled(o)),
    [deliveredOrders],
  );

  const mobileVisibleOrders = useMemo(() => {
    if (mobileOrderTab === 'new') return availableOrders;
    if (mobileOrderTab === 'delivering') return activeOrdersOnTheWay;
    if (mobileOrderTab === 'delivered') return courierHistoryDone;
    if (mobileOrderTab === 'cancelled') return courierHistoryCancelled;
    return [];
  }, [
    mobileOrderTab,
    availableOrders,
    activeOrdersOnTheWay,
    courierHistoryDone,
    courierHistoryCancelled,
  ]);

  const mobileOrdersSectionEmpty = useMemo(() => {
    if (mobileOrderTab === 'delivered') {
      return activeOrdersManualComplete.length === 0 && courierHistoryDone.length === 0;
    }
    return mobileVisibleOrders.length === 0;
  }, [
    mobileOrderTab,
    activeOrdersManualComplete.length,
    courierHistoryDone.length,
    mobileVisibleOrders.length,
  ]);

  useEffect(() => {
    if (!selectedBagId) {
      return;
    }

    const stillExists = emptyBags.some((bag) => bag.id === selectedBagId);
    if (!stillExists) {
      setSelectedBagId('');
    }
  }, [emptyBags, selectedBagId]);

  useEffect(() => {
    if (!bagQrOpen) {
      bagQrScannerRef.current?.clear().catch(() => {});
      bagQrScannerRef.current = null;
      return;
    }

    let cancelled = false;
    let scanner: any = null;

    (async () => {
      try {
        const mod = await import('html5-qrcode');
        if (cancelled) return;
        const Html5QrcodeScanner = (mod as any).Html5QrcodeScanner;
        scanner = new Html5QrcodeScanner(
          'courier-dash-bag-qr-reader',
          { fps: 8, qrbox: { width: 240, height: 240 } },
          false,
        );
        bagQrScannerRef.current = scanner;

        scanner.render(
          async (decodedText: string) => {
            try {
              await scanner.clear();
            } catch {
              /* ignore */
            }
            bagQrScannerRef.current = null;
            setBagQrOpen(false);
            try {
              const courierToken = getStoredCourierToken();
              const tokenQuery = courierToken ? `?token=${encodeURIComponent(courierToken)}` : '';
              const baseUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
                ? DEV_API_BASE_URL
                : API_BASE_URL;
              const form = new URLSearchParams();
              form.set('scan', decodedText);

              const response = await fetch(
                `${baseUrl}/courier/bags/verify-scan${tokenQuery}`,
                {
                  method: 'POST',
                  body: form,
                },
              );
              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(data.error || 'So‘mka topilmadi');
              }
              setSelectedBagId(data.bag.id);
              await loadDashboard(true);
            } catch (error) {
              console.error('Courier bag QR error:', error);
              toast.error(error instanceof Error ? error.message : 'QR tekshiruvi xato');
            }
          },
          () => {},
        );
      } catch (error) {
        console.error('QR scanner load error:', error);
        toast.error('QR skanerni yuklashda xatolik');
        setBagQrOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      scanner?.clear?.().catch?.(() => {});
      bagQrScannerRef.current = null;
    };
  }, [bagQrOpen, loadDashboard]);

  const summaryCards = [
    {
      id: 'balance',
      label: 'Balans',
      value: `${Number(profile?.balance || 0).toLocaleString('uz-UZ')} so'm`,
      note: 'Yechib olinadigan mablag\'',
      icon: Wallet,
      color: '#10b981',
    },
    {
      id: 'earnings',
      label: 'Jami topgan',
      value: `${Number(profile?.totalEarnings || 0).toLocaleString('uz-UZ')} so'm`,
      note: `Oxirgi zakaz: ${Number(profile?.lastDeliveryEarning || 0).toLocaleString('uz-UZ')} so'm`,
      icon: Route,
      color: accentColor.color,
    },
    {
      id: 'deliveries',
      label: 'Yetkazilgan',
      value: `${Number(profile?.completedDeliveries || 0)} ta`,
      note: `O'rtacha vaqt: ${Number(profile?.averageDeliveryTime || 0)} daqiqa`,
      icon: CheckCircle2,
      color: '#f59e0b',
    },
  ];

  const historyDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('uz-UZ', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const historyTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('uz-UZ', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  const deliveredTodayStats = useMemo(() => {
    const today = new Date();
    const key = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const todayOrders = courierHistoryDone.filter((order) => {
      const d = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
      const dk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      return dk === key;
    });
    const earnings = todayOrders.reduce((sum, order) => sum + getOrderDeliveryFee(order), 0);
    return { count: todayOrders.length, earnings };
  }, [courierHistoryDone]);

  const deliveredHistoryGroups = useMemo(() => {
    const groups: Array<{ label: string; dateKey: string; orders: CourierOrder[] }> = [];
    const map = new Map<string, CourierOrder[]>();
    courierHistoryDone.forEach((order) => {
      const d = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(order);
    });
    Array.from(map.keys())
      .sort((a, b) => (a < b ? 1 : -1))
      .forEach((dateKey) => {
        const date = new Date(`${dateKey}T00:00:00`);
        groups.push({
          dateKey,
          label: historyDateFormatter.format(date),
          orders: (map.get(dateKey) || []).sort(
            (a, b) =>
              new Date(b.deliveredAt || b.updatedAt || b.createdAt).getTime() -
              new Date(a.deliveredAt || a.updatedAt || a.createdAt).getTime(),
          ),
        });
      });
    return groups;
  }, [courierHistoryDone, historyDateFormatter]);

  const cancelledHistoryGroups = useMemo(() => {
    const groups: Array<{ label: string; dateKey: string; orders: CourierOrder[] }> = [];
    const map = new Map<string, CourierOrder[]>();
    courierHistoryCancelled.forEach((order) => {
      const d = new Date(order.updatedAt || order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(order);
    });
    Array.from(map.keys())
      .sort((a, b) => (a < b ? 1 : -1))
      .forEach((dateKey) => {
        const date = new Date(`${dateKey}T00:00:00`);
        groups.push({
          dateKey,
          label: historyDateFormatter.format(date),
          orders: (map.get(dateKey) || []).sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
          ),
        });
      });
    return groups;
  }, [courierHistoryCancelled, historyDateFormatter]);

  const mobileStatsData = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - 6);

    const weekOrders = courierHistoryDone.filter((order) => {
      const d = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
      return d >= weekStart;
    });

    const weekRevenue = weekOrders.reduce((sum, o) => sum + getOrderDeliveryFee(o), 0);
    const avgMinutes =
      weekOrders.length > 0
        ? Math.max(1, Math.round(weekOrders.reduce((sum, o) => sum + Math.max(1, Math.round((o.distanceKm || 0) * 6)), 0) / weekOrders.length))
        : 0;

    const bars = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + idx);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const count = weekOrders.filter((o) => {
        const od = new Date(o.deliveredAt || o.updatedAt || o.createdAt);
        const ok = `${od.getFullYear()}-${od.getMonth()}-${od.getDate()}`;
        return ok === key;
      }).length;
      return { day: ['Du', 'Se', 'Chor', 'Pay', 'Juma', 'Shan', 'Yak'][idx], count };
    });
    const maxBar = Math.max(1, ...bars.map((b) => b.count));

    const catMap = new Map<string, number>();
    weekOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const name = String(item?.name || 'Boshqa').trim() || 'Boshqa';
        catMap.set(name, (catMap.get(name) || 0) + Number(item?.quantity || 1));
      });
    });
    const categories = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count], idx) => ({ name, count, color: ['#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6'][idx] }));
    const totalCat = Math.max(1, categories.reduce((s, c) => s + c.count, 0));
    const donut = categories.length
      ? `conic-gradient(${categories
          .map((c, idx) => {
            const prev = categories.slice(0, idx).reduce((s, x) => s + (x.count / totalCat) * 100, 0);
            const next = prev + (c.count / totalCat) * 100;
            return `${c.color} ${prev}% ${next}%`;
          })
          .join(', ')})`
      : 'conic-gradient(#94a3b8 0% 100%)';

    return {
      weekOrdersCount: weekOrders.length,
      weekRevenue,
      avgMinutes,
      successRate: weekOrders.length > 0 ? 98 : 0,
      bars,
      maxBar,
      categories,
      donut,
      totalCat,
    };
  }, [courierHistoryDone]);

  const mobileProfileData = useMemo(() => {
    const totalOrders = Number(profile?.totalDeliveries || profile?.completedDeliveries || 0);
    const rating = Number(profile?.rating || 4.9);
    return { totalOrders, rating };
  }, [profile?.totalDeliveries, profile?.completedDeliveries, profile?.rating]);

  if (isLoading) {
    return (
      <div
        className="app-panel-viewport app-safe-pad flex items-center justify-center"
        style={{ background: isDark ? '#000000' : '#f9fafb', color: textColor }}
      >
        <div className="text-center">
          <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin" style={{ color: accentColor.color }} />
          <p></p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="app-panel-viewport app-safe-pad overflow-hidden"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: textColor,
      }}
    >
      <div className="app-panel-main-scroll min-h-0 p-4 md:p-6">
      {actionLoading ? (
        <div
          className="fixed top-0 left-0 right-0 z-[250] h-[3px] overflow-hidden pointer-events-none"
          style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }}
          role="progressbar"
          aria-busy="true"
          aria-valuetext="So‘rov yuborilmoqda"
        >
          <div
            className="h-full w-[34%] rounded-full opacity-95"
            style={{
              background: accentColor.gradient,
              animation: 'courierActionBarSlide 0.9s ease-in-out infinite',
            }}
          />
        </div>
      ) : null}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="md:hidden">
          <div
            className="rounded-[28px] border p-4 pb-24"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            {mobileSection === 'orders' && (
              <>
                <div className="mb-4">
                  <h2 className="text-4xl font-bold" style={{ color: accentColor.color }}>Buyurtmalar</h2>
                  <p style={{ color: mutedTextColor }}>Bugungi buyurtmalaringizni boshqaring</p>
                </div>

                <div
                  className="rounded-2xl border p-1 grid grid-cols-2 sm:grid-cols-4 gap-1 mb-4"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#e5e7eb',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  {[
                    { id: 'new', label: 'Yangi', count: availableOrders.length },
                    { id: 'delivering', label: 'Yo‘lda', count: activeOrdersOnTheWay.length },
                    {
                      id: 'delivered',
                      label: 'Yetkazildi',
                      count: courierHistoryDone.length + activeOrdersManualComplete.length,
                    },
                    { id: 'cancelled', label: 'Bekor', count: courierHistoryCancelled.length },
                  ].map((tab) => {
                    const selected = mobileOrderTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() =>
                          setMobileOrderTab(tab.id as 'new' | 'delivering' | 'delivered' | 'cancelled')
                        }
                        className="px-2 py-2 rounded-xl text-sm font-semibold"
                        style={{
                          background: selected ? accentColor.gradient : 'transparent',
                          color: selected ? '#ffffff' : textColor,
                        }}
                      >
                        {tab.label} {tab.count > 0 ? ` ${tab.count}` : ''}
                      </button>
                    );
                  })}
                </div>

                <div
                  className="rounded-2xl border p-3 mb-4"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">So‘mka ma’lumotlari</p>
                    <span className="text-xs" style={{ color: mutedTextColor }}>
                      {assignedBags.length} ta biriktirilgan
                    </span>
                  </div>
                  {profile?.bagSlots && profile.bagSlots.total > 0 ? (
                    <p className="text-xs mb-2" style={{ color: mutedTextColor }}>
                      Bo‘sh slotlar: <span className="font-semibold" style={{ color: accentColor.color }}>{profile.bagSlots.free}</span>
                      {' / '}
                      {profile.bagSlots.total} (band: {profile.bagSlots.used})
                    </p>
                  ) : null}
                  {assignedBags.length === 0 ? (
                    <p className="text-sm" style={{ color: mutedTextColor }}>
                      Sizga hali so‘mka biriktirilmagan
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {assignedBags.map((bag) => {
                        const bagColor = bag.status === 'occupied' ? '#f59e0b' : bag.status === 'assigned_empty' ? '#10b981' : '#6b7280';
                        return (
                          <div key={bag.id} className="rounded-xl p-2.5 flex items-center justify-between" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6' }}>
                            <div className="flex items-center gap-2">
                              <BriefcaseBusiness className="w-4 h-4" style={{ color: bagColor }} />
                              <div>
                                <p className="text-sm font-semibold">#{bag.bagNumber} {bag.bagCode ? `(${bag.bagCode})` : ''}</p>
                                <p className="text-xs" style={{ color: mutedTextColor }}>{bag.orderNumber ? formatOrderNumber(bag.orderNumber) : 'Aktiv order yo‘q'}</p>
                              </div>
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: `${bagColor}20`, color: bagColor }}>
                              {bag.status === 'assigned_empty' ? 'Bo‘sh' : bag.status === 'occupied' ? 'Band' : bag.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {mobileSection === 'orders' && courierRentalDeliveryJobs.length > 0 && (
              <div
                className="rounded-2xl border p-3 mb-4 space-y-3"
                style={{
                  background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
                  borderColor: isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.28)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold" style={{ color: '#d97706' }}>
                    Ijara — mijozga yetkazish
                  </p>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#b45309' }}
                  >
                    {courierRentalDeliveryJobs.length}
                  </span>
                </div>
                <p className="text-xs" style={{ color: mutedTextColor }}>
                  Ijara beruvchidan olib mijoz manziliga yetkazing. «Mijozga yetkazildi» — ijara muddati shundan boshlanadi.
                </p>
                {courierRentalDeliveryJobs.map((job: any) => (
                  <RentalCourierDeliveryJobCard
                    key={job.id}
                    job={job}
                    isDark={isDark}
                    mutedTextColor={mutedTextColor}
                    deliverBusyId={rentalDeliverToCustomerBusyId}
                    depositBusyId={rentalDepositUploadBusyId}
                    onDelivered={confirmRentalDeliveredToCustomer}
                    onDepositPhoto={uploadRentalDepositPhoto}
                  />
                ))}
              </div>
            )}

            {mobileSection === 'orders' && courierRentalOrders.length > 0 && (
              <div
                className="rounded-2xl border p-3 mb-4 space-y-3"
                style={{
                  background: isDark ? 'rgba(20,184,166,0.1)' : 'rgba(20,184,166,0.08)',
                  borderColor: isDark ? 'rgba(20,184,166,0.35)' : 'rgba(20,184,166,0.28)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold" style={{ color: accentColor.color }}>
                    Ijara (siz yetkazgansiz)
                  </p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${accentColor.color}22`, color: accentColor.color }}>
                    {courierRentalOrders.length}
                  </span>
                </div>
                {courierRentalOrders.map((ro: any) => {
                  const endMs = ro.rentalPeriodEndsAt ? new Date(ro.rentalPeriodEndsAt).getTime() : NaN;
                  const endOk = !Number.isNaN(endMs);
                  const rentImg = normalizeRentalProductImageUrl(String(ro.productImage || '').trim(), edgeBaseUrl);
                  const rentMoney = computeRentalCourierHandoffUzs(ro);
                  return (
                    <div
                      key={ro.id}
                      className="rounded-xl border p-3 space-y-2"
                      style={{
                        background: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                        borderColor: ro.pickupAlert === 'overdue' ? 'rgba(239,68,68,0.5)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <div className="flex gap-3 items-start">
                        <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-black/10">
                          {rentImg &&
                          (rentImg.startsWith('http') ||
                            rentImg.startsWith('//') ||
                            rentImg.startsWith('/') ||
                            rentImg.startsWith('data:')) ? (
                            <img src={rentImg} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-7 h-7 opacity-40" style={{ color: mutedTextColor }} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-semibold leading-snug">{ro.productName || 'Ijara'}</p>
                          <p className="text-xs" style={{ color: mutedTextColor }}>
                            Mijoz: {ro.customerName} · {ro.customerPhone}
                          </p>
                        </div>
                      </div>
                      {ro.pickupAddress ? (
                        <p className="text-xs flex gap-1 font-medium" style={{ color: '#0d9488' }}>
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>Olib ketilgan joy: {ro.pickupAddress}</span>
                        </p>
                      ) : null}
                      {ro.deliveryAddress || ro.address ? (
                        <p className="text-xs flex gap-1" style={{ color: mutedTextColor }}>
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>Mijoz: {ro.deliveryAddress || ro.address}</span>
                        </p>
                      ) : null}
                      <RentalCourierDepositBlock
                        job={ro}
                        isDark={isDark}
                        mutedTextColor={mutedTextColor}
                        depositBusyId={rentalDepositUploadBusyId}
                        onDepositPhoto={uploadRentalDepositPhoto}
                      />
                      {endOk && ro.rentalPeriodEndsAt ? (
                        <div className="space-y-1">
                          <RentalLiveCountdown
                            rentalPeriodEndsAt={ro.rentalPeriodEndsAt}
                            isDark={isDark}
                            accentColor={accentColor.color}
                            prominent
                          />
                          <p className="text-[11px]" style={{ color: mutedTextColor }}>
                            Tugash (mahalliy): {new Date(ro.rentalPeriodEndsAt).toLocaleString('uz-UZ')}
                          </p>
                        </div>
                      ) : null}
                      {ro.pickupAlert === 'overdue' ? (
                        <p className="text-sm font-bold text-red-600">Qaytarib olish vaqti keldi</p>
                      ) : ro.pickupAlert === 'due_soon' ? (
                        <p className="text-xs font-semibold text-amber-600">24 soat ichida tugaydi</p>
                      ) : null}
                      {rentMoney.totalUzs > 0 ? (
                        <div
                          className="rounded-xl border p-3 space-y-1"
                          style={{
                            background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                            borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.3)',
                          }}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            Pul (haqiqiy shartnoma)
                          </p>
                          <p className="text-xs" style={{ color: mutedTextColor }}>
                            Jami:{' '}
                            <span className="font-bold tabular-nums" style={{ color: textColor }}>
                              {rentMoney.totalUzs.toLocaleString('uz-UZ')}
                            </span>{' '}
                            so‘m
                            {rentMoney.deliveryKeptUzs > 0 ? (
                              <>
                                {' '}
                                · Yetkazish (sizda):{' '}
                                <span className="font-semibold tabular-nums">
                                  {rentMoney.deliveryKeptUzs.toLocaleString('uz-UZ')}
                                </span>{' '}
                                so‘m
                              </>
                            ) : null}
                          </p>
                          {rentMoney.isCashLike && rentMoney.toCashierUzs > 0 ? (
                            <p className="text-lg font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">
                              Kassaga topshirish: {rentMoney.toCashierUzs.toLocaleString('uz-UZ')} so‘m
                            </p>
                          ) : (
                            <p className="text-sm font-semibold" style={{ color: mutedTextColor }}>
                              Onlayn/karta — kassaga naqd topshiruv yo‘q
                            </p>
                          )}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={rentalPickupBusyId === ro.id}
                        onClick={() => confirmRentalPickupReturn(ro)}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                        style={{
                          background: ro.pickupAlert === 'overdue' ? '#dc2626' : accentColor.color,
                        }}
                      >
                        {rentalPickupBusyId === ro.id
                          ? 'Yuborilmoqda...'
                          : 'Buyurtmani qaytarib oldim (keyin kassaga pul)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {mobileSection === 'orders' && (
              <div className="space-y-3">
                {mobileOrdersSectionEmpty ? (
                  <div className="rounded-2xl p-6 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff' }}>
                    <p className="font-semibold">
                      {mobileOrderTab === 'delivered'
                        ? 'Hozircha yakunlangan buyurtmalar yo‘q'
                        : mobileOrderTab === 'cancelled'
                          ? 'Bekor qilingan buyurtmalar yo‘q'
                          : 'Hozircha buyurtma yo‘q'}
                    </p>
                  </div>
                ) : (
                  <>
                    {mobileOrderTab === 'delivered' &&
                      activeOrdersManualComplete.map((order) => (
                        <div
                          key={`cash-${order.id}`}
                          className="rounded-2xl overflow-hidden border"
                          style={{
                            background: isDark ? '#111214' : '#ffffff',
                            borderColor: isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.45)',
                          }}
                        >
                          <div
                            className="p-3"
                            style={{
                              background: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.12)',
                            }}
                          >
                            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                              {isCourierCashLike(order) ? 'Mijoz yonida — pulni oling' : 'Mijoz yonida — yakunlash'}
                            </p>
                            <p className="text-xs font-semibold opacity-90">{formatOrderNumber(order.orderNumber, order.id)}</p>
                            <p className="font-bold text-lg leading-tight">{order.customerName}</p>
                          </div>
                          <div className="p-3 space-y-3">
                            <div
                              className="rounded-xl p-4 text-center"
                              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                            >
                              <p className="text-xs mb-1" style={{ color: mutedTextColor }}>
                                Siz olishingiz kerak bo‘lgan so‘m
                              </p>
                              <p className="text-2xl font-bold tabular-nums" style={{ color: accentColor.color }}>
                                {getOrderGrandTotal(order).toLocaleString('uz-UZ')} so'm
                              </p>
                              {isCourierCashLike(order) ? (
                                <p className="text-[11px] mt-2 leading-snug" style={{ color: mutedTextColor }}>
                                  {(() => {
                                    const b = courierMarketCashBreakdown(order);
                                    return (
                                      <>
                                        Yetkazish sizda qoladi:{' '}
                                        <span className="font-semibold">
                                          {b.deliveryKeptUzs.toLocaleString('uz-UZ')} so'm
                                        </span>
                                        <br />
                                        Kassaga topshirasiz:{' '}
                                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                                          {b.toCashierUzs.toLocaleString('uz-UZ')} so'm
                                        </span>
                                      </>
                                    );
                                  })()}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleOrderAction(courierOrderActionPath(order.id, 'delivered'))}
                              disabled={actionLoading !== null}
                              className="w-full py-3 rounded-2xl font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ background: accentColor.gradient }}
                            >
                              {actionLoading === courierOrderActionPath(order.id, 'delivered') ? (
                                <CourierActionPendingLabel />
                              ) : (
                                'Pulni oldim'
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    {mobileVisibleOrders.map((order) => (
                    <div key={order.id} className="rounded-2xl overflow-hidden border" style={{ background: isDark ? '#111214' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                      <div
                        style={{ background: `linear-gradient(120deg, ${accentColor.color}33, ${accentColor.color}11)` }}
                        className="min-h-[7rem] p-3 flex flex-col justify-end gap-2"
                      >
                        <p className="text-xs font-semibold opacity-90">{formatOrderNumber(order.orderNumber, order.id)}</p>
                        <div className="flex items-end justify-between gap-2">
                          <p className="font-bold text-lg leading-tight">{order.customerName}</p>
                          <div className="text-right text-[11px] leading-tight shrink-0 px-2 py-1 rounded-full" style={{ background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.85)' }}>
                            <div className="font-bold">{getOrderGrandTotal(order).toLocaleString('uz-UZ')} so'm</div>
                            <div style={{ color: mutedTextColor }}>yetkazish {getOrderDeliveryFee(order).toLocaleString('uz-UZ')}</div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs mb-2" style={{ color: mutedTextColor }}>
                          <span>{getOrderTypeText(order.orderType)}</span>
                          <span>·</span>
                          <span>{getOrderStatusText(order.status)}</span>
                          {order.merchantName ? (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[200px]">{order.merchantName}</span>
                            </>
                          ) : null}
                        </div>
                        {(order.pickupRackNumber || order.pickupRackName) ? (
                          <div
                            className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
                            style={{
                              background: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
                              color: '#10b981',
                            }}
                          >
                            <span>Rasta</span>
                            <span>
                              #{order.pickupRackNumber || '—'}
                              {order.pickupRackName ? ` (${order.pickupRackName})` : ''}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <MapPin className="w-4 h-4 shrink-0" style={{ color: accentColor.color }} />
                          <span className="leading-snug">{getAddressLine(order)}</span>
                        </div>
                        {formatCustomerCoords(order) ? (
                          <div className="text-xs mb-2" style={{ color: mutedTextColor }}>
                            GPS: {formatCustomerCoords(order)}
                          </div>
                        ) : null}
                        {Array.isArray(order.items) && order.items.length > 0 && (
                          <div className="text-xs mb-2 p-2 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                            <p className="font-semibold mb-1" style={{ color: accentColor.color }}>Tarkib</p>
                            {order.items.slice(0, 4).map((item, idx) => (
                              <div key={idx} className="flex justify-between gap-2 py-0.5">
                                <span className="truncate">
                                  {item?.name || item?.dishName || item?.productName || 'Mahsulot'} ×{Number(item?.quantity || 1)}
                                </span>
                                <span className="shrink-0">{Number(item?.price || 0).toLocaleString('uz-UZ')}</span>
                              </div>
                            ))}
                            {order.items.length > 4 ? (
                              <p className="text-[11px] mt-1" style={{ color: mutedTextColor }}>+ yana {order.items.length - 4} ta</p>
                            ) : null}
                          </div>
                        )}
                        <div className="flex items-start gap-2 text-xs mb-2 p-2 rounded-xl" style={{ background: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)' }}>
                          <Wallet className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                          <span className="leading-snug">
                            <span className="font-semibold" style={{ color: textColor }}>To‘lov usuli: </span>
                            {formatCourierPaymentMethodUz(getCourierPaymentMethodRaw(order))}
                            <span className="opacity-50 mx-1">·</span>
                            <span className="font-semibold" style={{ color: textColor }}>Holat: </span>
                            {getCourierPaymentStatusText(order)}
                          </span>
                        </div>
                        {renderCourierCashCollectionHint(order, 'compact')}
                        <div className="flex items-center justify-between text-sm mb-3" style={{ color: mutedTextColor }}>
                          <span>
                            {(mobileOrderTab === 'delivered'
                              ? Number(order.distanceKm || 0)
                              : distanceKmForCourierUi(order, profile?.currentLocation)
                            ).toFixed(1)}{' '}
                            km
                          </span>
                          <span>{new Date(order.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                          <button type="button" onClick={() => window.open(`tel:${order.customerPhone}`, '_self')} style={{ color: accentColor.color }}>Qo‘ng‘iroq</button>
                        </div>
                        {mobileOrderTab === 'new' ? (
                          <SwipeAction
                            label={
                              noBagSlotForNewOrder(order)
                                ? 'So‘mka to‘liq — avval topshiring'
                                : 'Surib qabul qiling'
                            }
                            disabled={noBagSlotForNewOrder(order) || actionLoading !== null}
                            isDark={isDark}
                            gradient={accentColor.gradient}
                            onComplete={() => void acceptAndPickupOrder(order)}
                          />
                        ) : mobileOrderTab === 'delivering' ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => openMap('pickup', order)}
                                className="py-2.5 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center text-xs font-semibold leading-tight min-h-[3.25rem]"
                                style={{
                                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                  color: textColor,
                                }}
                              >
                                <Navigation className="w-4 h-4 shrink-0" />
                                Olish nuqtasi
                              </button>
                              <button
                                type="button"
                                onClick={() => openMap('customer', order)}
                                className="py-2.5 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center text-xs font-semibold leading-tight min-h-[3.25rem]"
                                style={{
                                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                  color: textColor,
                                }}
                              >
                                <MapPin className="w-4 h-4 shrink-0" />
                                Mijoz joyi
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => void submitCourierArrivedWithAutoDeliver(order)}
                              disabled={actionLoading !== null}
                              className="w-full py-3 rounded-2xl border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                                borderColor: accentColor.color,
                                color: textColor,
                              }}
                            >
                              {actionLoading === `arrived-chain:${order.id}` ? (
                                <CourierActionPendingLabel />
                              ) : (
                                'Yetib keldim'
                              )}
                            </button>
                          </div>
                        ) : mobileOrderTab === 'delivered' ? (
                          <div className="space-y-2 w-full">
                            <div
                              className="w-full py-3 rounded-2xl font-semibold text-center"
                              style={{
                                background: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.14)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                              }}
                            >
                              Topshirilgan
                            </div>
                            {isCourierCashLike(order) &&
                            String(order.courierCashHandoffStatus || '') === 'pending_cashier' ? (
                              <div
                                className="w-full py-2.5 px-3 rounded-xl text-center text-xs font-semibold"
                                style={{
                                  background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.12)',
                                  color: '#b45309',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                }}
                              >
                                Kassaga topshirish:{' '}
                                {Number(
                                  order.courierCashHandoffExpectedUzs ??
                                    courierMarketCashBreakdown(order).toCashierUzs,
                                ).toLocaleString('uz-UZ')}{' '}
                                so'm
                              </div>
                            ) : null}
                            {isCourierCashLike(order) &&
                            String(order.courierCashHandoffStatus || '') === 'cashier_received' ? (
                              <p className="text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                Kassaga topshirildi
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div
                            className="w-full py-3 rounded-2xl font-semibold text-center"
                            style={{
                              background: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                            }}
                          >
                            Bekor qilingan
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
            )}

            {mobileSection === 'history' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-4xl font-bold" style={{ color: accentColor.color }}>Tarix</h2>
                  <p style={{ color: mutedTextColor }}>Yakunlangan va bekor buyurtmalar</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: accentColor.gradient,
                      color: '#ffffff',
                      boxShadow: `0 10px 28px ${accentColor.color}33`,
                    }}
                  >
                    <p className="text-sm font-semibold mb-2">Bugun</p>
                    <p className="text-3xl font-bold leading-none">{deliveredTodayStats.count}</p>
                    <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.9)' }}>Yetkazildi</p>
                  </div>
                  <div
                    className="rounded-2xl p-4"
                    style={{
                      background: isDark ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #10b981, #34d399)',
                      color: '#ffffff',
                      boxShadow: isDark ? '0 10px 28px rgba(16,185,129,0.28)' : '0 10px 28px rgba(16,185,129,0.22)',
                    }}
                  >
                    <p className="text-sm font-semibold mb-2">Daromad</p>
                    <p className="text-3xl font-bold leading-none">{Math.round(deliveredTodayStats.earnings / 1000)}k</p>
                    <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.9)' }}>so'm</p>
                  </div>
                </div>

                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
                    borderColor: isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.2)',
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                    Bekor qilingan (jami):{' '}
                    <span className="text-2xl font-bold tabular-nums">{courierHistoryCancelled.length}</span>
                  </p>
                </div>

                {deliveredHistoryGroups.length === 0 && cancelledHistoryGroups.length === 0 ? (
                  <div className="rounded-2xl p-6 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff' }}>
                    <p className="font-semibold">Hali tarixda buyurtmalar yo‘q</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deliveredHistoryGroups.map((group) => (
                      <div key={group.dateKey} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold"
                            style={{
                              background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                            }}
                          >
                            <CalendarDays className="w-4 h-4" style={{ color: accentColor.color }} />
                            {group.label}
                          </span>
                          <div className="h-px flex-1" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />
                        </div>

                        {group.orders.map((order) => {
                          const paid = String(order.paymentStatus || '').toLowerCase() === 'paid';
                          const when = new Date(order.deliveredAt || order.updatedAt || order.createdAt);
                          return (
                            <div
                              key={order.id}
                              className="rounded-2xl border p-3"
                              style={{
                                background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                                boxShadow: isDark ? '0 8px 20px rgba(0,0,0,0.28)' : '0 8px 20px rgba(0,0,0,0.08)',
                              }}
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                  <p className="font-bold text-xl leading-tight">{order.customerName || 'Mijoz'}</p>
                                  <div className="text-sm flex items-center gap-2" style={{ color: mutedTextColor }}>
                                    <Clock3 className="w-3.5 h-3.5" />
                                    <span>{historyTimeFormatter.format(when)}</span>
                                    <span>•</span>
                                    <span>{Math.max(1, Math.round((order.distanceKm || 0) * 6))} min</span>
                                  </div>
                                  <div className="text-sm flex items-center gap-2 mt-1" style={{ color: mutedTextColor }}>
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span>{getAddressLine(order)}</span>
                                  </div>
                                  <div className="text-xs flex items-center gap-1.5 mt-1.5" style={{ color: mutedTextColor }}>
                                    <Wallet className="w-3.5 h-3.5 shrink-0" style={{ color: '#10b981' }} />
                                    <span>
                                      <span className="font-semibold" style={{ color: textColor }}>To‘lov: </span>
                                      {formatCourierPaymentMethodUz(getCourierPaymentMethodRaw(order))}
                                      <span className="opacity-50 mx-1">·</span>
                                      {getCourierPaymentStatusText(order)}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className="px-2 py-1 rounded-full text-xs font-semibold"
                                  style={{
                                    background: paid ? 'rgba(16,185,129,0.16)' : 'rgba(245,158,11,0.18)',
                                    color: paid ? '#10b981' : '#f59e0b',
                                  }}
                                >
                                  {paid ? 'To‘landi' : 'To‘lovda'}
                                </span>
                              </div>

                              <div className="flex items-end justify-between gap-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {(order.items || []).slice(0, 3).map((item, idx) => (
                                    <span
                                      key={`${order.id}-item-${idx}`}
                                      className="px-2 py-1 rounded-full text-xs"
                                      style={{
                                        background: isDark ? 'rgba(255,255,255,0.08)' : '#eef2f7',
                                        color: mutedTextColor,
                                      }}
                                    >
                                      {item?.name || item?.dishName || item?.productName || 'Mahsulot'}
                                      {item?.quantity ? ` x${item.quantity}` : ''}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-2xl font-bold" style={{ color: '#10b981' }}>
                                  {getOrderDeliveryFee(order).toLocaleString('uz-UZ')} so'm
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {cancelledHistoryGroups.length > 0 ? (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: '#ef4444' }}>
                            Bekor qilingan
                          </span>
                          <div className="h-px flex-1" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />
                        </div>
                        {cancelledHistoryGroups.map((group) => (
                          <div key={`cx-${group.dateKey}`} className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold"
                                style={{
                                  background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                                  border: isDark ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(239,68,68,0.2)',
                                }}
                              >
                                <CalendarDays className="w-4 h-4" style={{ color: '#ef4444' }} />
                                {group.label}
                              </span>
                              <div className="h-px flex-1" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />
                            </div>
                            {group.orders.map((order) => {
                              const when = new Date(order.updatedAt || order.createdAt);
                              return (
                                <div
                                  key={order.id}
                                  className="rounded-2xl border p-3"
                                  style={{
                                    background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.05)',
                                    borderColor: isDark ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.18)',
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div>
                                      <p className="font-bold text-lg leading-tight">{order.customerName || 'Mijoz'}</p>
                                      <p className="text-xs font-mono opacity-80">{formatOrderNumber(order.orderNumber, order.id)}</p>
                                      <div className="text-sm flex items-center gap-2 mt-1" style={{ color: mutedTextColor }}>
                                        <Clock3 className="w-3.5 h-3.5" />
                                        <span>{historyTimeFormatter.format(when)}</span>
                                      </div>
                                      <div className="text-sm flex items-center gap-2 mt-1" style={{ color: mutedTextColor }}>
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span>{getAddressLine(order)}</span>
                                      </div>
                                    </div>
                                    <span
                                      className="px-2 py-1 rounded-full text-xs font-semibold shrink-0"
                                      style={{ background: 'rgba(239,68,68,0.18)', color: '#ef4444' }}
                                    >
                                      Bekor
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {mobileSection === 'stats' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-4xl font-bold" style={{ color: accentColor.color }}>Statistika</h2>
                  <p style={{ color: mutedTextColor }}>Haftalik natijalaringiz</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff' }}>
                    <p className="text-sm font-semibold">Buyurtmalar</p>
                    <p className="text-4xl font-bold leading-none mt-2">{mobileStatsData.weekOrdersCount}</p>
                    <p className="text-xs mt-2 opacity-90">haftalik</p>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff' }}>
                    <p className="text-sm font-semibold">Daromad</p>
                    <p className="text-4xl font-bold leading-none mt-2">{(mobileStatsData.weekRevenue / 1_000_000).toFixed(1)}M</p>
                    <p className="text-xs mt-2 opacity-90">so'm</p>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #ea580c, #f97316)', color: '#fff' }}>
                    <p className="text-sm font-semibold">O‘rtacha vaqt</p>
                    <p className="text-4xl font-bold leading-none mt-2">{mobileStatsData.avgMinutes}</p>
                    <p className="text-xs mt-2 opacity-90">daqiqa</p>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: accentColor.gradient, color: '#fff' }}>
                    <p className="text-sm font-semibold">Bajarildi</p>
                    <p className="text-4xl font-bold leading-none mt-2">{mobileStatsData.successRate}%</p>
                    <p className="text-xs mt-2 opacity-90">muvaffaqiyat</p>
                  </div>
                </div>

                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                    borderColor: isDark ? 'rgba(239,68,68,0.28)' : 'rgba(239,68,68,0.22)',
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                    Bekor qilingan buyurtmalar (jami)
                  </p>
                  <p className="text-4xl font-bold leading-none mt-2 tabular-nums" style={{ color: '#ef4444' }}>
                    {courierHistoryCancelled.length}
                  </p>
                </div>

                <div className="rounded-2xl border p-4" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                  <p className="font-bold text-xl mb-3">Haftalik buyurtmalar</p>
                  <div className="h-40 grid grid-cols-7 gap-2 items-end">
                    {mobileStatsData.bars.map((bar) => (
                      <div key={bar.day} className="flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-lg" style={{ height: `${(bar.count / mobileStatsData.maxBar) * 100}%`, minHeight: bar.count ? 14 : 6, background: accentColor.gradient }} />
                        <span className="text-xs" style={{ color: mutedTextColor }}>{bar.day}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border p-4" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                  <p className="font-bold text-xl mb-3">Kategoriya bo‘yicha</p>
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-28 rounded-full" style={{ background: mobileStatsData.donut }} />
                    <div className="flex-1 space-y-2">
                      {mobileStatsData.categories.length === 0 ? (
                        <p style={{ color: mutedTextColor }}>Ma'lumot yo‘q</p>
                      ) : (
                        mobileStatsData.categories.map((cat) => (
                          <div key={cat.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} />
                              <span>{cat.name}</span>
                            </div>
                            <span style={{ color: mutedTextColor }}>{Math.round((cat.count / mobileStatsData.totalCat) * 100)}%</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mobileSection === 'profile' && (
              <div className="space-y-4">
                <div
                  className="rounded-3xl border overflow-hidden"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div
                    className="h-36 relative"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor.color}66, ${accentColor.color}22), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 50%)`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleAvatarButtonClick}
                      className="absolute right-3 top-3 w-9 h-9 rounded-full border flex items-center justify-center"
                      style={{
                        background: 'rgba(255,255,255,0.16)',
                        borderColor: 'rgba(255,255,255,0.3)',
                        color: '#ffffff',
                      }}
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />

                    {avatarUploadPct !== null && (
                      <div className="absolute left-3 right-3 bottom-3 rounded-2xl border px-3 py-2"
                        style={{
                          background: 'rgba(0,0,0,0.28)',
                          borderColor: 'rgba(255,255,255,0.18)',
                        }}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span style={{ color: 'rgba(255,255,255,0.80)' }}>
                            {isUploadingAvatar ? '' : 'Tayyor'}
                          </span>
                          <span style={{ color: '#fff' }}>{avatarUploadPct}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${avatarUploadPct}%`, background: accentColor.gradient }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-4 pb-4">
                    <div className="-mt-10 mb-3 flex items-end gap-3">
                      <div
                        className="w-20 h-20 rounded-full border-4 flex items-center justify-center"
                        style={{
                          borderColor: isDark ? '#101214' : '#ffffff',
                          background: `linear-gradient(145deg, ${accentColor.color}55, ${accentColor.color}22)`,
                        }}
                      >
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-8 h-8" style={{ color: '#ffffff' }} />
                        )}
                      </div>
                      <div className="mb-1">
                        <p className="text-3xl font-bold leading-tight">{profile?.name || 'Kuryer'}</p>
                        <div className="inline-flex px-2 py-1 rounded-full text-xs font-semibold mt-1" style={{ background: accentColor.gradient, color: '#fff' }}>
                          Premium
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm mb-4" style={{ color: mutedTextColor }}>
                      <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {profile?.branchName || 'Filial'}</div>
                      <div className="flex items-center gap-2"><Star className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} /> {mobileProfileData.rating.toFixed(1)} ({mobileProfileData.totalOrders} buyurtma)</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Buyurtmalar', value: mobileProfileData.totalOrders, icon: Package },
                        { label: 'Reyting', value: mobileProfileData.rating.toFixed(1), icon: Star },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} className="rounded-2xl border p-3 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                            <div className="w-8 h-8 mx-auto mb-1 rounded-full flex items-center justify-center" style={{ background: `${accentColor.color}22` }}>
                              <Icon className="w-4 h-4" style={{ color: accentColor.color }} />
                            </div>
                            <p className="text-2xl font-bold leading-none">{item.value}</p>
                            <p className="text-[11px] mt-1" style={{ color: mutedTextColor }}>{item.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-4 space-y-3" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                  <p className="font-bold text-xl">Aloqa ma'lumotlari</p>
                  <button type="button" className="w-full text-left flex items-center gap-3" onClick={openPhoneDialer}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${accentColor.color}22` }}><Phone className="w-4 h-4" style={{ color: accentColor.color }} /></div>
                    <div>
                      <p className="text-xs" style={{ color: mutedTextColor }}>Telefon</p>
                      <p className="font-semibold">{profile?.phone || '+998 -- --- -- --'}</p>
                    </div>
                  </button>
                  <button type="button" className="w-full text-left flex items-center gap-3" onClick={openEmailComposer}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${accentColor.color}22` }}><Mail className="w-4 h-4" style={{ color: accentColor.color }} /></div>
                    <div>
                      <p className="text-xs" style={{ color: mutedTextColor }}>Email</p>
                      <p className="font-semibold">{(profile?.login || 'courier').replace(/\s+/g, '').toLowerCase()}@courier.uz</p>
                    </div>
                  </button>
                </div>

                <div className="rounded-2xl border overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                  {[
                    { label: 'Profilni tahrirlash', icon: User, onClick: openProfileEditModal },
                    { label: 'Bildirishnomalar', icon: Bell, onClick: () => { toggleNotifications(); } },
                    { label: 'Xavfsizlik', icon: Shield, onClick: () => setSecurityOpen(true) },
                    { label: 'Sozlamalar', icon: Settings, onClick: () => setSettingsOpen(true) },
                    { label: 'Yordam', icon: CircleHelp, onClick: () => setHelpOpen(true) },
                  ].map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        className="w-full px-4 py-4 flex items-center justify-between"
                        style={{
                          borderTop: idx === 0 ? 'none' : (isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'),
                        }}
                      >
                        <span className="flex items-center gap-3 font-medium">
                          <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#eef2f7' }}>
                            <Icon className="w-4 h-4" style={{ color: accentColor.color }} />
                          </span>
                          {item.label}
                        </span>
                        <ChevronRight className="w-4 h-4" style={{ color: mutedTextColor }} />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3 rounded-2xl border font-semibold flex items-center justify-center gap-2"
                  style={{
                    borderColor: 'rgba(239,68,68,0.55)',
                    color: '#ef4444',
                    background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Chiqish
                </button>
              </div>
            )}

            <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-[calc(100%-12px)] max-w-[430px] rounded-2xl border p-1 grid grid-cols-5 gap-0.5 z-40"
              style={{ background: isDark ? 'rgba(22,22,24,0.96)' : 'rgba(255,255,255,0.96)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}>
              {[
                { id: 'orders', label: 'Buyurtmalar', icon: Package, nav: 'section' as const },
                { id: 'map', label: 'Xarita', icon: MapPin, nav: 'route' as const },
                { id: 'history', label: 'Tarix', icon: History, nav: 'section' as const },
                { id: 'stats', label: 'Statistika', icon: BarChart3, nav: 'section' as const },
                { id: 'profile', label: 'Profil', icon: User, nav: 'section' as const },
              ].map((item) => {
                const selected = item.nav === 'section' && mobileSection === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.nav === 'route') {
                        navigate('/kuryer/xarita');
                        return;
                      }
                      setMobileSection(item.id as 'orders' | 'history' | 'stats' | 'profile');
                    }}
                    className="rounded-xl py-2 text-[10px] sm:text-[11px] font-semibold flex flex-col items-center gap-1 min-w-0"
                    style={{ background: selected ? accentColor.gradient : 'transparent', color: selected ? '#ffffff' : mutedTextColor }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-full leading-tight text-center px-0.5">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="hidden md:block space-y-6">
        <div
          className="rounded-3xl border p-5 md:p-6"
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-3xl" style={{ background: `${accentColor.color}20` }}>
                <Bike className="w-10 h-10" style={{ color: accentColor.color }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{profile?.name || 'Kuryer paneli'}</h1>
                <p style={{ color: mutedTextColor }}>
                  {profile?.branchName || 'Filial biriktirilmagan'} • {profile?.phone || 'Telefon yo‘q'}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={{ background: `${statusBadge}20`, color: statusBadge }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: statusBadge }} />
                  {profile?.status === 'busy' ? 'Band' : profile?.status === 'active' ? 'Faol' : profile?.status === 'offline' ? 'Oflayn' : 'Nofaol'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  pushLocation();
                  loadDashboard(true);
                }}
                className="px-4 py-2 rounded-2xl border flex items-center gap-2"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  color: textColor,
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Yangilash
              </button>
              <button
                type="button"
                onClick={() => navigate('/kuryer/xarita')}
                className="px-4 py-2 rounded-2xl border flex items-center gap-2 font-semibold"
                style={{
                  background: `${accentColor.color}18`,
                  borderColor: `${accentColor.color}44`,
                  color: accentColor.color,
                }}
              >
                <MapPin className="w-4 h-4" />
                Xarita
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-2xl border flex items-center gap-2"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  color: textColor,
                }}
              >
                <LogOut className="w-4 h-4" />
                Chiqish
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {summaryCards.map((card) => (
            <div
              key={card.id}
              className="rounded-3xl border p-5"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: mutedTextColor }}>
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold mb-1">{card.value}</p>
                  <p className="text-sm" style={{ color: mutedTextColor }}>
                    {card.note}
                  </p>
                  {card.id === 'balance' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutOpen(true);
                          void loadPayoutRequests(true);
                        }}
                        className="px-3 py-2 rounded-2xl text-sm font-semibold text-white"
                        style={{ background: accentColor.gradient }}
                      >
                        Pul olish
                      </button>
                    </div>
                  ) : null}
                </div>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${card.color}20` }}
                >
                  <card.icon className="w-6 h-6" style={{ color: card.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {payoutOpen ? (
          <div
            className="fixed inset-0 z-[260] app-safe-pad flex items-center justify-center p-4"
            style={{ background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(17,24,39,0.55)' }}
            role="dialog"
            aria-modal="true"
            onClick={() => setPayoutOpen(false)}
          >
            <div
              className="w-full max-w-xl rounded-3xl border overflow-hidden"
              style={{
                background: isDark ? '#0f1012' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="p-4 border-b flex items-center justify-between gap-3"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
              >
                <div className="font-bold text-lg">Pul olish (oylik arizasi)</div>
                <button
                  type="button"
                  onClick={() => setPayoutOpen(false)}
                  className="h-10 w-10 rounded-full border flex items-center justify-center"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }}
                  aria-label="Yopish"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="text-sm" style={{ color: mutedTextColor }}>
                  Balans: <span className="font-bold">{Number(profile?.balance || 0).toLocaleString('uz-UZ')} so'm</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold" style={{ color: mutedTextColor }}>
                      Karta raqami (karta bilan olish uchun)
                    </label>
                    <input
                      value={courierCardNumberDraft}
                      onChange={(e) => setCourierCardNumberDraft(e.target.value)}
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                        color: textColor,
                      }}
                      placeholder="8600 ...."
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={{ color: mutedTextColor }}>
                      Telegram Chat ID (ixtiyoriy)
                    </label>
                    <input
                      value={courierTelegramChatIdDraft}
                      onChange={(e) => setCourierTelegramChatIdDraft(e.target.value)}
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                        color: textColor,
                      }}
                      placeholder="123456789"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={payoutSaving}
                    onClick={async () => {
                      if (payoutSaving) return;
                      setPayoutSaving(true);
                      try {
                        const courierToken = getStoredCourierToken();
                        if (!courierToken) return;
                        const tokenQuery = `?token=${encodeURIComponent(courierToken)}`;
                        const baseUrl =
                          typeof window !== 'undefined' && window.location.hostname === 'localhost'
                            ? DEV_API_BASE_URL
                            : API_BASE_URL;
                        const res = await fetch(`${baseUrl}/courier/me/update${tokenQuery}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            cardNumber: courierCardNumberDraft.trim(),
                            telegramChatId: courierTelegramChatIdDraft.trim(),
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || !data.success) {
                          toast.error(data.error || 'Saqlashda xatolik');
                          return;
                        }
                        toast.success('Saqlandi');
                        await loadDashboard(true);
                      } finally {
                        setPayoutSaving(false);
                      }
                    }}
                    className="px-4 py-3 rounded-2xl border text-sm font-semibold"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                      color: textColor,
                    }}
                  >
                    Ma’lumotlarni saqlash
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold" style={{ color: mutedTextColor }}>
                      Summa (so'm)
                    </label>
                    <input
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                        color: textColor,
                      }}
                      placeholder="100000"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={{ color: mutedTextColor }}>
                      Qanday olasiz?
                    </label>
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value === 'card' ? 'card' : 'cash')}
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                        color: textColor,
                      }}
                    >
                      <option value="cash">Naqd</option>
                      <option value="card">Karta</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={payoutSaving}
                  onClick={async () => {
                    if (payoutSaving) return;
                    const amt = Number(String(payoutAmount || '').replace(/[^\d.]/g, ''));
                    if (!Number.isFinite(amt) || amt <= 0) {
                      toast.error("Summa noto‘g‘ri");
                      return;
                    }
                    setPayoutSaving(true);
                    try {
                      const courierToken = getStoredCourierToken();
                      if (!courierToken) return;
                      const tokenQuery = `?token=${encodeURIComponent(courierToken)}`;
                      const baseUrl =
                        typeof window !== 'undefined' && window.location.hostname === 'localhost'
                          ? DEV_API_BASE_URL
                          : API_BASE_URL;
                      const res = await fetch(`${baseUrl}/courier/payout-requests${tokenQuery}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amountUzs: amt, method: payoutMethod }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok || !data.success) {
                        toast.error(data.error || 'Ariza yuborilmadi');
                        return;
                      }
                      toast.success('Ariza yuborildi');
                      setPayoutAmount('');
                      await loadPayoutRequests(true);
                    } finally {
                      setPayoutSaving(false);
                    }
                  }}
                  className="w-full py-3 rounded-2xl font-semibold text-white"
                  style={{ background: accentColor.gradient }}
                >
                  Ariza yuborish
                </button>

                <div className="pt-2">
                  <div className="text-sm font-semibold mb-2">Arizalar</div>
                  {payoutListLoading ? (
                    <div className="text-sm" style={{ color: mutedTextColor }}>
                      Yuklanmoqda...
                    </div>
                  ) : payoutRequests.length === 0 ? (
                    <div className="text-sm" style={{ color: mutedTextColor }}>
                      Hozircha ariza yo‘q.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payoutRequests.slice(0, 12).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-2xl border px-4 py-3 text-sm flex items-center justify-between gap-3"
                          style={{
                            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                          }}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold">
                              {Math.round(Number(r.amountUzs || 0)).toLocaleString('uz-UZ')} so'm · {r.requestedMethod === 'card' ? 'Karta' : 'Naqd'}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: mutedTextColor }}>
                              {new Date(r.createdAt).toLocaleString('uz-UZ')}
                            </div>
                          </div>
                          <div
                            className="shrink-0 text-xs px-3 py-1 rounded-full"
                            style={{
                              background:
                                r.status === 'paid'
                                  ? isDark
                                    ? 'rgba(16,185,129,0.14)'
                                    : 'rgba(16,185,129,0.12)'
                                  : r.status === 'pending'
                                    ? isDark
                                      ? 'rgba(245,158,11,0.14)'
                                      : 'rgba(245,158,11,0.12)'
                                    : isDark
                                      ? 'rgba(239,68,68,0.16)'
                                      : 'rgba(239,68,68,0.12)',
                              color: r.status === 'paid' ? '#10b981' : r.status === 'pending' ? '#f59e0b' : '#ef4444',
                            }}
                          >
                            {r.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {courierRentalDeliveryJobs.length > 0 ? (
          <div
            className="rounded-3xl border p-5 md:p-6 mb-4"
            style={{
              background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.07)',
              borderColor: isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.25)',
            }}
          >
            <h2 className="text-xl font-bold mb-1" style={{ color: '#d97706' }}>
              Ijara — mijozga yetkazish
            </h2>
            <p className="text-sm mb-4" style={{ color: mutedTextColor }}>
              Ijara beruvchidan olib mijoz manziliga yetkazing. «Mijozga yetkazildi» bosilgach ijara muddati boshlanadi.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {courierRentalDeliveryJobs.map((job: any) => (
                <RentalCourierDeliveryJobCard
                  key={job.id}
                  job={job}
                  isDark={isDark}
                  mutedTextColor={mutedTextColor}
                  deliverBusyId={rentalDeliverToCustomerBusyId}
                  depositBusyId={rentalDepositUploadBusyId}
                  onDelivered={confirmRentalDeliveredToCustomer}
                  onDepositPhoto={uploadRentalDepositPhoto}
                />
              ))}
            </div>
          </div>
        ) : null}

        {courierRentalOrders.length > 0 ? (
          <div
            className="rounded-3xl border p-5 md:p-6"
            style={{
              background: isDark ? 'rgba(20,184,166,0.1)' : 'rgba(20,184,166,0.07)',
              borderColor: isDark ? 'rgba(20,184,166,0.35)' : 'rgba(20,184,166,0.25)',
            }}
          >
            <h2 className="text-xl font-bold mb-1" style={{ color: accentColor.color }}>
              Ijara buyurtmalari (siz yetkazgansiz)
            </h2>
            <p className="text-sm mb-4" style={{ color: mutedTextColor }}>
              Tugash vaqtidan keyin mijozdan qaytarib oling va tugmani bosing.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {courierRentalOrders.map((ro: any) => {
                const endMs = ro.rentalPeriodEndsAt ? new Date(ro.rentalPeriodEndsAt).getTime() : NaN;
                const endOk = !Number.isNaN(endMs);
                const rentImg = normalizeRentalProductImageUrl(String(ro.productImage || '').trim(), edgeBaseUrl);
                const rentMoney = computeRentalCourierHandoffUzs(ro);
                return (
                  <div
                    key={ro.id}
                    className="rounded-2xl border p-4 space-y-2"
                    style={{
                      background: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                      borderColor:
                        ro.pickupAlert === 'overdue'
                          ? 'rgba(239,68,68,0.45)'
                          : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    <div className="flex gap-4 items-start">
                      <div className="shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-black/10">
                        {rentImg &&
                        (rentImg.startsWith('http') ||
                          rentImg.startsWith('//') ||
                          rentImg.startsWith('/') ||
                          rentImg.startsWith('data:')) ? (
                          <img src={rentImg} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-9 h-9 opacity-40" style={{ color: mutedTextColor }} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-lg leading-snug">{ro.productName || 'Ijara'}</p>
                        <p className="text-sm" style={{ color: mutedTextColor }}>
                          Mijoz: {ro.customerName} · {ro.customerPhone}
                        </p>
                      </div>
                    </div>
                    {ro.pickupAddress ? (
                      <p className="text-sm flex gap-2 font-medium" style={{ color: '#0d9488' }}>
                        <MapPin className="w-4 h-4 shrink-0" />
                        Olib ketilgan joy: {ro.pickupAddress}
                      </p>
                    ) : null}
                    {ro.deliveryAddress || ro.address ? (
                      <p className="text-sm flex gap-2" style={{ color: mutedTextColor }}>
                        <MapPin className="w-4 h-4 shrink-0" />
                        Mijoz: {ro.deliveryAddress || ro.address}
                      </p>
                    ) : null}
                    <RentalCourierDepositBlock
                      job={ro}
                      isDark={isDark}
                      mutedTextColor={mutedTextColor}
                      depositBusyId={rentalDepositUploadBusyId}
                      onDepositPhoto={uploadRentalDepositPhoto}
                    />
                    {endOk && ro.rentalPeriodEndsAt ? (
                      <div className="space-y-1">
                        <RentalLiveCountdown
                          rentalPeriodEndsAt={ro.rentalPeriodEndsAt}
                          isDark={isDark}
                          accentColor={accentColor.color}
                          prominent
                        />
                        <p className="text-xs" style={{ color: mutedTextColor }}>
                          Ijara tugashi (mahalliy): {new Date(ro.rentalPeriodEndsAt).toLocaleString('uz-UZ')}
                        </p>
                      </div>
                    ) : null}
                    {ro.pickupAlert === 'overdue' ? (
                      <p className="text-sm font-bold text-red-600">Qaytarib olish vaqti keldi</p>
                    ) : ro.pickupAlert === 'due_soon' ? (
                      <p className="text-sm font-semibold text-amber-600">24 soat ichida tugaydi</p>
                    ) : null}
                    {rentMoney.totalUzs > 0 ? (
                      <div
                        className="rounded-xl border p-3 space-y-1"
                        style={{
                          background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                          borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.3)',
                        }}
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Pul (haqiqiy shartnoma)
                        </p>
                        <p className="text-sm" style={{ color: mutedTextColor }}>
                          Jami:{' '}
                          <span className="font-bold tabular-nums" style={{ color: textColor }}>
                            {rentMoney.totalUzs.toLocaleString('uz-UZ')}
                          </span>{' '}
                          so‘m
                          {rentMoney.deliveryKeptUzs > 0 ? (
                            <>
                              {' '}
                              · Yetkazish (sizda):{' '}
                              <span className="font-semibold tabular-nums">
                                {rentMoney.deliveryKeptUzs.toLocaleString('uz-UZ')}
                              </span>{' '}
                              so‘m
                            </>
                          ) : null}
                        </p>
                        {rentMoney.isCashLike && rentMoney.toCashierUzs > 0 ? (
                          <p className="text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">
                            Kassaga topshirish: {rentMoney.toCashierUzs.toLocaleString('uz-UZ')} so‘m
                          </p>
                        ) : (
                          <p className="text-sm font-semibold" style={{ color: mutedTextColor }}>
                            Onlayn/karta — kassaga naqd topshiruv yo‘q
                          </p>
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={rentalPickupBusyId === ro.id}
                      onClick={() => confirmRentalPickupReturn(ro)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{
                        background: ro.pickupAlert === 'overdue' ? '#dc2626' : accentColor.color,
                      }}
                    >
                      {rentalPickupBusyId === ro.id
                        ? 'Yuborilmoqda...'
                        : 'Buyurtmani qaytarib oldim (keyin kassaga pul)'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          className="rounded-3xl border p-5 md:p-6"
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold">Mening so‘mkalarim</h2>
              <p style={{ color: mutedTextColor }}>
                Buyurtmani olish uchun kamida bitta bo‘sh biriktirilgan so‘mka bo‘lishi kerak.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {emptyBags.length > 1 && (
                <button
                  type="button"
                  onClick={() => setBagQrOpen(true)}
                  className="px-4 py-2 rounded-2xl border text-sm font-semibold flex items-center gap-2"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <QrCode className="w-4 h-4" />
                  QR bilan tanlash
                </button>
              )}
              <div className="text-sm font-semibold px-3 py-2 rounded-2xl" style={{ color: '#10b981' }}>
                {'Filial so‘mkasi bilan ishlaydi'}
              </div>
            </div>
          </div>

          {!profile?.bags || profile.bags.length === 0 ? (
            <div className="rounded-2xl p-6 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
              <BriefcaseBusiness className="w-10 h-10 mx-auto mb-3" style={{ color: accentColor.color }} />
              <p className="font-semibold mb-1">Hali so‘mka biriktirilmagan</p>
              <p style={{ color: mutedTextColor }}>Filial sizga kamida bitta bo‘sh so‘mka biriktirishi kerak</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {profile.bags.map((bag) => {
                const bagColor = bag.status === 'occupied' ? '#f59e0b' : bag.status === 'assigned_empty' ? '#10b981' : '#6b7280';
                return (
                  <div
                    key={bag.id}
                    className="rounded-2xl border p-4"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${bagColor}20` }}>
                          <BriefcaseBusiness className="w-5 h-5" style={{ color: bagColor }} />
                        </div>
                        <div>
                          <p className="font-semibold">So‘mka #{bag.bagNumber}</p>
                          <p className="text-sm" style={{ color: mutedTextColor }}>{bag.bagCode}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold" style={{ color: bagColor }}>
                          {bag.status === 'assigned_empty' ? 'Bo‘sh' : bag.status === 'occupied' ? 'Band' : bag.status}
                        </p>
                        <p className="text-xs" style={{ color: mutedTextColor }}>
                          {bag.orderNumber ? formatOrderNumber(bag.orderNumber) : 'Aktiv order yo‘q'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {activeOrders.length > 0 && (
          <div className="space-y-5">
            {activeOrders.map((activeOrder) => (
          <div
            key={activeOrder.id}
            className="rounded-3xl border p-5 md:p-6"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              borderColor: `${accentColor.color}33`,
            }}
          >
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-sm font-medium" style={{ color: accentColor.color }}>
                  {workflowNorm(activeOrder) === 'arrived' && !shouldAutoCompleteAfterArrived(activeOrder)
                    ? isCourierCashLike(activeOrder)
                      ? 'Mijoz yonida — naqd'
                      : 'Mijoz yonida — yakunlash'
                    : canPressYetibKeldim(activeOrder)
                      ? 'Yo‘lda'
                      : 'Aktiv buyurtma'}
                </p>
                <h2 className="text-xl font-bold">{activeOrder.orderNumber || activeOrder.id}</h2>
                <p style={{ color: mutedTextColor }}>{getAddressLine(activeOrder)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm" style={{ color: mutedTextColor }}>Holat</p>
                <p className="font-semibold">{getOrderStatusText(activeOrder.courierWorkflowStatus || activeOrder.status)}</p>
                <p className="text-xs mt-1" style={{ color: mutedTextColor }}>
                  {formatOrderNumber(activeOrder.orderNumber, activeOrder.id)}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-5">
              <div className="rounded-2xl p-4" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span className="font-semibold">{activeOrder.customerName}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span>{activeOrder.customerPhone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span>{getAddressLine(activeOrder)}</span>
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span className="font-semibold">{activeOrder.branchName || 'Filial'}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Route className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span>Yetkazish: {getOrderDeliveryFee(activeOrder).toLocaleString('uz-UZ')} so'm</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span>{new Date(activeOrder.createdAt).toLocaleString('uz-UZ')}</span>
                </div>
                {activeOrder.branchAddress ? (
                  <div className="flex items-start gap-2 mt-2">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accentColor.color }} />
                    <span className="text-sm">Filial manzili: {activeOrder.branchAddress}</span>
                  </div>
                ) : null}
                {activeOrder.merchantName ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Store className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span>Do‘kon / restoran: {activeOrder.merchantName}</span>
                  </div>
                ) : null}
                {formatCustomerCoords(activeOrder) ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Navigation className="w-4 h-4" style={{ color: accentColor.color }} />
                    <span className="text-sm">Mijoz GPS: {formatCustomerCoords(activeOrder)}</span>
                  </div>
                ) : null}
                {activeOrder.deliveryZone ? (
                  <div className="flex items-center gap-2 mt-2 text-sm" style={{ color: mutedTextColor }}>
                    <span>Yetkazish zonasi ID: {activeOrder.deliveryZone}</span>
                  </div>
                ) : null}
                {(activeOrder.assignedBagNumber || activeOrder.assignedBagCode) && (
                  <div className="flex items-center gap-2 mt-2">
                    <BriefcaseBusiness className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    <span>
                      So‘mka: #{activeOrder.assignedBagNumber || '-'} {activeOrder.assignedBagCode ? `(${activeOrder.assignedBagCode})` : ''}
                    </span>
                  </div>
                )}
                {(activeOrder.pickupRackNumber || activeOrder.pickupRackName) && (
                  <div className="flex items-center gap-2 mt-2">
                    <MapPin className="w-4 h-4" style={{ color: '#10b981' }} />
                    <span>
                      Olib ketish rastasi: #{activeOrder.pickupRackNumber || '-'} {activeOrder.pickupRackName ? `(${activeOrder.pickupRackName})` : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Package className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span>Turi: {getOrderTypeText(activeOrder.orderType)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Clock3 className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span>Buyurtma holati: {getOrderStatusText(activeOrder.status)}</span>
                </div>
                <div className="flex items-start gap-2 mt-2 p-3 rounded-xl" style={{ background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.1)' }}>
                  <Wallet className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                  <span className="text-sm leading-snug">
                    <span className="font-semibold">To‘lov usuli: </span>
                    {formatCourierPaymentMethodUz(getCourierPaymentMethodRaw(activeOrder))}
                    <span className="opacity-50 mx-1">·</span>
                    <span className="font-semibold">Holat: </span>
                    {getCourierPaymentStatusText(activeOrder)}
                  </span>
                </div>
                {renderCourierCashCollectionHint(activeOrder, 'normal')}
                {activeOrder.notes ? (
                  <div className="mt-2 p-2 rounded-xl text-sm" style={{ background: isDark ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.1)' }}>
                    Izoh: {activeOrder.notes}
                  </div>
                ) : null}
                <div className="flex items-center gap-2 mt-2">
                  <DollarSign className="w-4 h-4" style={{ color: '#f59e0b' }} />
                  <span>Buyurtma summasi: {getOrderGrandTotal(activeOrder).toLocaleString('uz-UZ')} so'm</span>
                </div>
              </div>
            </div>

            {Array.isArray(activeOrder.items) && activeOrder.items.length > 0 && (
              <div className="rounded-2xl p-4 mb-5" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                <p className="font-semibold mb-2">Buyurtma tarkibi ({activeOrder.items.length} pozitsiya)</p>
                <div className="space-y-2">
                  {activeOrder.items.map((item, idx) => {
                    const addons = [...(item?.additionalProducts || []), ...(item?.addons || [])];
                    return (
                      <div key={idx} className="rounded-xl p-2.5 text-sm" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <span>
                            {item?.name || item?.dishName || item?.productName || 'Mahsulot'}
                            {item?.variantName ? ` (${item.variantName})` : ''} ×{Number(item?.quantity || 1)}
                          </span>
                          <span className="font-semibold shrink-0">{Number(item?.price || 0).toLocaleString('uz-UZ')} so'm</span>
                        </div>
                        {addons.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 text-xs pl-3" style={{ color: mutedTextColor }}>
                            {addons.map((a, j) => (
                              <li key={j}>
                                + {a?.name || 'Qo‘shimcha'} ×{Number(a?.quantity || 1)}
                                {Number(a?.price) ? ` — ${Number(a.price).toLocaleString('uz-UZ')} so'm` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {workflowNorm(activeOrder) === 'arrived' && !shouldAutoCompleteAfterArrived(activeOrder) ? (
              <div
                className="rounded-2xl p-5 mb-5 text-center border"
                style={{
                  borderColor: isDark ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.45)',
                  background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
                }}
              >
                <p className="text-sm mb-1" style={{ color: mutedTextColor }}>
                  {isCourierCashLike(activeOrder)
                    ? 'Siz olishingiz kerak bo‘lgan so‘m'
                    : 'Buyurtma summasi (yakunlash)'}
                </p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: accentColor.color }}>
                  {getOrderGrandTotal(activeOrder).toLocaleString('uz-UZ')} so'm
                </p>
                {isCourierCashLike(activeOrder) ? (
                  <p className="text-xs mt-3 leading-relaxed" style={{ color: mutedTextColor }}>
                    {(() => {
                      const b = courierMarketCashBreakdown(activeOrder);
                      return (
                        <>
                          Yetkazish sizda qoladi:{' '}
                          <span className="font-semibold">
                            {b.deliveryKeptUzs.toLocaleString('uz-UZ')} so'm
                          </span>
                          {' · '}
                          Kassaga topshirasiz:{' '}
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {b.toCashierUzs.toLocaleString('uz-UZ')} so'm
                          </span>
                        </>
                      );
                    })()}
                  </p>
                ) : null}
              </div>
            ) : null}

            {String(activeOrder.courierCashHandoffStatus || '') === 'pending_cashier' &&
            isCourierCashLike(activeOrder) &&
            workflowNorm(activeOrder) === 'delivered' ? (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-sm font-semibold text-center"
                style={{
                  background: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.1)',
                  color: '#b45309',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                }}
              >
                Kassaga topshirish kerak:{' '}
                {Number(
                  activeOrder.courierCashHandoffExpectedUzs ?? courierMarketCashBreakdown(activeOrder).toCashierUzs,
                ).toLocaleString('uz-UZ')}{' '}
                so'm
              </div>
            ) : null}
            {String(activeOrder.courierCashHandoffStatus || '') === 'cashier_received' &&
            isCourierCashLike(activeOrder) ? (
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-4">
                Naqd kassaga topshirildi
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={() => openMap('pickup', activeOrder)}
                className="px-4 py-3 rounded-2xl border flex items-center gap-2"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <Navigation className="w-4 h-4" />
                Olish nuqtasini ochish
              </button>
              <button
                type="button"
                onClick={() => openMap('customer', activeOrder)}
                className="px-4 py-3 rounded-2xl border flex items-center gap-2"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <MapPin className="w-4 h-4" />
                Mijoz lokatsiyasi
              </button>
              {workflowNorm(activeOrder) === 'arrived' && !shouldAutoCompleteAfterArrived(activeOrder) ? (
                <button
                  type="button"
                  onClick={() => void handleOrderAction(courierOrderActionPath(activeOrder.id, 'delivered'))}
                  disabled={actionLoading !== null}
                  className="px-4 py-3 rounded-2xl font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: accentColor.gradient }}
                >
                  {actionLoading === courierOrderActionPath(activeOrder.id, 'delivered') ? (
                    <CourierActionPendingLabel />
                  ) : (
                    'Pulni oldim'
                  )}
                </button>
              ) : canPressYetibKeldim(activeOrder) ? (
                <button
                  type="button"
                  onClick={() => void submitCourierArrivedWithAutoDeliver(activeOrder)}
                  disabled={actionLoading !== null}
                  className="px-4 py-3 rounded-2xl border font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    borderColor: accentColor.color,
                    color: textColor,
                  }}
                >
                  {actionLoading === `arrived-chain:${activeOrder.id}` ? (
                    <CourierActionPendingLabel />
                  ) : (
                    'Yetib keldim'
                  )}
                </button>
              ) : (
                <div className="px-4 py-3 rounded-2xl text-sm font-medium" style={{ color: mutedTextColor }}>
                  {getOrderStatusText(activeOrder.courierWorkflowStatus || activeOrder.status)}
                </div>
              )}
            </div>
          </div>
            ))}
          </div>
        )}

        <div
          className="rounded-3xl border p-5 md:p-6"
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold">Menga yaqin buyurtmalar</h2>
              <p style={{ color: mutedTextColor }}>
                Faqat sizning zona/IP ga mos va hali olinmagan buyurtmalar ko‘rinadi
              </p>
            </div>
            <div className="text-sm font-semibold" style={{ color: accentColor.color }}>
              {availableOrders.length} ta buyurtma
            </div>
          </div>

          {availableOrders.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
              <Package className="w-10 h-10 mx-auto mb-3" style={{ color: accentColor.color }} />
              <p className="font-semibold mb-1">Hozircha yaqin buyurtma yo‘q</p>
              <p style={{ color: mutedTextColor }}>
                {'Joylashuvingiz yangilanib turganiga ishonch hosil qiling'}
              </p>
            </div>
          ) : (
            <div className="grid xl:grid-cols-2 gap-4">
              {availableOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border p-4"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-bold">{formatOrderNumber(order.orderNumber, order.id)}</p>
                      <p className="text-sm" style={{ color: mutedTextColor }}>{order.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {distanceKmForCourierUi(order, profile?.currentLocation).toFixed(1)} km
                      </p>
                      <p className="text-xs" style={{ color: mutedTextColor }}>sizdan</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span>Turi: {getOrderTypeText(order.orderType)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock3 className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span>Holat: {getOrderStatusText(order.status)}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <User className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accentColor.color }} />
                      <span>
                        Filial: {order.branchName || '—'}
                        {order.branchAddress ? <span className="block text-xs mt-0.5" style={{ color: mutedTextColor }}>{order.branchAddress}</span> : null}
                      </span>
                    </div>
                    {order.merchantName ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Store className="w-4 h-4 shrink-0" style={{ color: accentColor.color }} />
                        <span>Do‘kon / restoran: {order.merchantName}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span>{order.customerPhone}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accentColor.color }} />
                      <span>{getAddressLine(order)}</span>
                    </div>
                    {formatCustomerCoords(order) ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Navigation className="w-4 h-4 shrink-0" style={{ color: accentColor.color }} />
                        <span>Mijoz GPS: {formatCustomerCoords(order)}</span>
                      </div>
                    ) : null}
                    {order.deliveryZone ? (
                      <div className="text-xs px-2 py-1.5 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: mutedTextColor }}>
                        Yetkazish zonasi: {order.deliveryZone}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 text-sm">
                      <Clock3 className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span>Vaqt: {new Date(order.createdAt).toLocaleString('uz-UZ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Route className="w-4 h-4" style={{ color: '#10b981' }} />
                      <span>Yetkazish: {getOrderDeliveryFee(order).toLocaleString('uz-UZ')} so'm</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4" style={{ color: '#f59e0b' }} />
                      <span>Buyurtma summasi: {getOrderGrandTotal(order).toLocaleString('uz-UZ')} so'm</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm p-3 rounded-xl" style={{ background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.1)' }}>
                      <Wallet className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                      <span className="leading-snug">
                        <span className="font-semibold">To‘lov usuli: </span>
                        {formatCourierPaymentMethodUz(getCourierPaymentMethodRaw(order))}
                        <span className="opacity-50 mx-1">·</span>
                        <span className="font-semibold">Holat: </span>
                        {getCourierPaymentStatusText(order)}
                      </span>
                    </div>
                    {renderCourierCashCollectionHint(order, 'normal')}
                    {order.notes && (
                      <div className="text-sm p-2 rounded-xl" style={{ background: isDark ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.1)' }}>
                        Izoh: {order.notes}
                      </div>
                    )}
                    {Array.isArray(order.items) && order.items.length > 0 && (
                      <div className="p-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: mutedTextColor }}>Tarkib ({order.items.length}):</p>
                        <div className="space-y-2">
                          {order.items.map((item, idx) => {
                            const addons = [...(item?.additionalProducts || []), ...(item?.addons || [])];
                            return (
                              <div key={idx} className="text-xs rounded-lg p-2" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                                <div className="flex items-start justify-between gap-2">
                                  <span>
                                    {item?.name || item?.dishName || item?.productName || 'Mahsulot'}
                                    {item?.variantName ? ` (${item.variantName})` : ''} ×{Number(item?.quantity || 1)}
                                  </span>
                                  <span className="font-semibold shrink-0">{Number(item?.price || 0).toLocaleString('uz-UZ')} so'm</span>
                                </div>
                                {addons.length > 0 && (
                                  <ul className="mt-1 space-y-0.5 pl-2" style={{ color: mutedTextColor }}>
                                    {addons.map((a, j) => (
                                      <li key={j}>
                                        + {a?.name || 'Qo‘shimcha'} ×{Number(a?.quantity || 1)}
                                        {Number(a?.price) ? ` — ${Number(a.price).toLocaleString('uz-UZ')} so'm` : ''}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {(order.preparedBagCode || order.preparedBagNumber) && (
                      <div
                        className="flex items-center gap-2 text-sm p-2 rounded-xl mt-1"
                        style={{
                          background: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                        }}
                      >
                        <BriefcaseBusiness className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                        <span>
                          Tayyorlovchi so‘mkasi: #{order.preparedBagNumber || '—'}
                          {order.preparedBagCode ? ` (${order.preparedBagCode})` : ''}
                        </span>
                      </div>
                    )}
                    {(order.pickupRackNumber || order.pickupRackName) && (
                      <div className="mt-2 px-3 py-2 rounded-xl text-sm" style={{ background: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                        Olib ketish rastasi: #{order.pickupRackNumber || '—'} {order.pickupRackName ? `(${order.pickupRackName})` : ''}
                      </div>
                    )}
                  </div>

                  {emptyBags.length > 1 && !order.preparedBagId && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2" style={{ color: mutedTextColor }}>
                        Buyurtma uchun so‘mka tanlang
                      </label>
                      <select
                        value={selectedBagId}
                        onChange={(event) => setSelectedBagId(event.target.value)}
                        className="w-full py-3 px-4 rounded-2xl border outline-none"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                          color: textColor,
                        }}
                      >
                        <option value="">So‘mka tanlang</option>
                        {emptyBags.map((bag) => (
                          <option key={bag.id} value={bag.id}>
                            So‘mka #{bag.bagNumber} ({bag.bagCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={() => void acceptAndPickupOrder(order)}
                    disabled={
                      noBagSlotForNewOrder(order) ||
                      actionLoading !== null ||
                      (emptyBags.length > 1 && !selectedBagId && !order.preparedBagId)
                    }
                    className="w-full py-3 rounded-2xl font-semibold"
                    style={{
                      background:
                        noBagSlotForNewOrder(order) ||
                        (emptyBags.length > 1 && !selectedBagId && !order.preparedBagId)
                          ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)')
                          : accentColor.gradient,
                      color:
                        noBagSlotForNewOrder(order) ||
                        (emptyBags.length > 1 && !selectedBagId && !order.preparedBagId)
                          ? (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)')
                          : '#ffffff',
                    }}
                  >
                    {actionLoading === `accept-pickup:${order.id}` ? (
                      <CourierActionPendingLabel />
                    ) : noBagSlotForNewOrder(order) ? (
                      'So‘mka to‘liq'
                    ) : emptyBags.length > 1 && !selectedBagId && !order.preparedBagId ? (
                      'So‘mka tanlang'
                    ) : (
                      'Buyurtmani olish'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {profile?.currentLocation && (
          <div
            className="rounded-3xl border p-5"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5" style={{ color: accentColor.color }} />
              <div>
                <p className="font-semibold">Joriy lokatsiya yangilanmoqda</p>
                <p style={{ color: mutedTextColor }}>
                  {profile.currentLocation.address || `${profile.currentLocation.latitude}, ${profile.currentLocation.longitude}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {(courierHistoryDone.length > 0 || courierHistoryCancelled.length > 0) && (
          <div
            className="rounded-3xl border p-5 md:p-6 space-y-5"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Buyurtmalar tarixi</h2>
                <p style={{ color: mutedTextColor }}>Yakunlangan va bekor buyurtmalar (oxirgilari)</p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm font-semibold">
                <span style={{ color: '#10b981' }}>Yakunlangan: {courierHistoryDone.length}</span>
                <span style={{ color: '#ef4444' }}>Bekor: {courierHistoryCancelled.length}</span>
              </div>
            </div>
            <div className="grid xl:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-bold mb-3" style={{ color: '#10b981' }}>
                  Yakunlangan
                </p>
                <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
                  {courierHistoryDone.slice(0, 12).map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border p-3 text-sm"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{formatOrderNumber(order.orderNumber, order.id)}</span>
                        <span style={{ color: mutedTextColor }}>
                          {new Date(order.deliveredAt || order.updatedAt || order.createdAt).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                      <p className="truncate mt-1" style={{ color: mutedTextColor }}>
                        {order.customerName} · {getAddressLine(order)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold mb-3" style={{ color: '#ef4444' }}>
                  Bekor qilingan
                </p>
                <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
                  {courierHistoryCancelled.slice(0, 12).map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border p-3 text-sm"
                      style={{
                        background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)',
                        borderColor: isDark ? 'rgba(239,68,68,0.22)' : 'rgba(239,68,68,0.18)',
                      }}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{formatOrderNumber(order.orderNumber, order.id)}</span>
                        <span style={{ color: mutedTextColor }}>
                          {new Date(order.updatedAt || order.createdAt).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                      <p className="truncate mt-1" style={{ color: mutedTextColor }}>
                        {order.customerName} · {getAddressLine(order)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

        {profileEditOpen && (
          <div
            className="fixed inset-0 app-safe-pad z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setProfileEditOpen(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-3xl border p-5"
              style={{
                background: isDark ? 'rgba(20,20,22,0.98)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Profilni tahrirlash"
            >
              <p className="font-bold text-lg mb-4">Profilni tahrirlash</p>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm" style={{ color: mutedTextColor }}>Ism</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)', color: textColor }}
                  />
                </label>
                <label className="block">
                  <span className="text-sm" style={{ color: mutedTextColor }}>Telefon</span>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)', color: textColor }}
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center gap-2 justify-end">
                <button type="button" onClick={() => setProfileEditOpen(false)} className="px-4 py-2 rounded-xl border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)' }}>Bekor qilish</button>
                <button type="button" onClick={saveProfileEdit} className="px-4 py-2 rounded-xl font-semibold text-white" style={{ background: accentColor.gradient }}>Saqlash</button>
              </div>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div
            className="fixed inset-0 app-safe-pad z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setSettingsOpen(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-3xl border p-5 space-y-3"
              style={{
                background: isDark ? 'rgba(20,20,22,0.98)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Sozlamalar"
            >
              <p className="font-bold text-lg">Sozlamalar</p>
              <button type="button" onClick={toggleTheme} className="w-full rounded-2xl border px-4 py-3 flex items-center justify-between" style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}>
                <span className="flex items-center gap-2 font-medium">{isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Mavzu</span>
                <span style={{ color: mutedTextColor }}>{isDark ? 'Dark' : 'Light'}</span>
              </button>
              <button type="button" onClick={toggleNotifications} className="w-full rounded-2xl border px-4 py-3 flex items-center justify-between" style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}>
                <span className="flex items-center gap-2 font-medium"><Bell className="w-4 h-4" /> Bildirishnomalar</span>
                <span style={{ color: mutedTextColor }}>{notifications ? 'Yoqilgan' : 'O‘chiq'}</span>
              </button>
              <button type="button" onClick={toggleSound} className="w-full rounded-2xl border px-4 py-3 flex items-center justify-between" style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}>
                <span className="flex items-center gap-2 font-medium">{soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />} Ovoz</span>
                <span style={{ color: mutedTextColor }}>{soundEnabled ? 'Yoqilgan' : 'O‘chiq'}</span>
              </button>
              <button type="button" onClick={() => setSettingsOpen(false)} className="w-full mt-1 py-2 rounded-xl font-semibold text-white" style={{ background: accentColor.gradient }}>Yopish</button>
            </div>
          </div>
        )}

        {securityOpen && (
          <div
            className="fixed inset-0 app-safe-pad z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setSecurityOpen(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-3xl border p-5"
              style={{
                background: isDark ? 'rgba(20,20,22,0.98)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Xavfsizlik"
            >
              <p className="font-bold text-lg mb-2">Xavfsizlik</p>
              <p className="text-sm mb-4" style={{ color: mutedTextColor }}>Shubhali holatda tez chiqish qiling va qayta login bo‘ling.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSecurityOpen(false)} className="py-2 rounded-xl border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)' }}>Tekshirish</button>
                <button type="button" onClick={handleLogout} className="py-2 rounded-xl font-semibold text-white" style={{ background: '#ef4444' }}>Chiqish</button>
              </div>
            </div>
          </div>
        )}

        {helpOpen && (
          <div
            className="fixed inset-0 app-safe-pad z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setHelpOpen(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-3xl border p-5"
              style={{
                background: isDark ? 'rgba(20,20,22,0.98)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Yordam"
            >
              <p className="font-bold text-lg mb-2">Yordam</p>
              <p className="text-sm mb-4" style={{ color: mutedTextColor }}>Muammo bo‘lsa quyidagi yo‘llardan foydalaning.</p>
              <div className="space-y-2">
                <button type="button" onClick={openPhoneDialer} className="w-full py-2 rounded-xl border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)' }}>Operatorga qo‘ng‘iroq</button>
                <button type="button" onClick={openHelpChat} className="w-full py-2 rounded-xl border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)' }}>Telegram yordam</button>
                <button type="button" onClick={openEmailComposer} className="w-full py-2 rounded-xl border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)' }}>Email yozish</button>
              </div>
            </div>
          </div>
        )}

        {bagQrOpen && (
          <div
            className="fixed inset-0 app-safe-pad z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setBagQrOpen(false)}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-3xl border p-5"
              style={{
                background: isDark ? 'rgba(20,20,22,0.98)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                color: textColor,
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="So‘mka QR"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="font-bold text-lg">Bo‘sh so‘mka QR</p>
                <button
                  type="button"
                  onClick={() => setBagQrOpen(false)}
                  className="p-2 rounded-xl border"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  }}
                  aria-label="Yopish"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div id="courier-dash-bag-qr-reader" className="rounded-2xl overflow-hidden" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
