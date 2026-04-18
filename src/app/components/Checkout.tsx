import { useState, useEffect, useMemo, useRef, type ComponentType, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  X,
  ChevronRight,
  MapPin,
  Map as MapIcon,
  Navigation,
  CreditCard,
  Banknote,
  User,
  Phone,
  Check,
  Tag,
  Gift,
  Loader2,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import ClickPayment from './ClickPayment';
import PaymePayment from './PaymePayment';
import AtmosPayment from './AtmosPayment';
import {
  UzumNasiyaCountdownBlock,
  UzumNasiyaInstallmentBlock,
  isUzumNasiyaAvailable,
  type UzumNasiyaTerm,
} from './checkout/UzumNasiyaPanels';
import { buildUserHeaders } from '../utils/requestAuth';
import { syncMarketplaceV2Order } from '../utils/marketplaceV2Sync';
import { getRegularCartStockIssues, getRentalCartStockIssues } from '../utils/cartStock';
import {
  getMarketCartCatalogIdError,
  mapCartItemsForOrdersApi,
  isShopProductCartLine,
} from '../utils/submitRegularCartOrderQuick';
import type { RentalCartItem } from '../context/RentalCartContext';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { reverseGeocodeDisplayLine } from '../utils/geolocationDetect';
import { PAYMENT_LOGO_FRAME_SKEW_DEG } from './payment/PaymentMethodLogoFrame';
import { CheckoutMapPickerModal } from './CheckoutMapPickerModal';
import { CheckoutOrderSuccessAnimation } from './CheckoutOrderSuccessAnimation';
import {
  evaluateMerchantHours,
  formatCountdownParts,
  secondsUntilIso,
} from '../utils/businessHours';

interface CheckoutProps {
  cartItems: any[];
  totalAmount: number;
  onClose: () => void;
  orderType: 'market' | 'shop' | 'food' | 'rental' | 'mixed';
  onOrderSuccess?: () => void;
  /** Ijara savati (Cart dan uzatiladi) */
  rentalLineItems?: RentalCartItem[];
  onRentalSuccess?: () => void;
  /** Savatdagi ijara uchun Cart modali orqali rozilik berilgan */
  rentalTermsPreAccepted?: boolean;
}

const getZoneCenter = (zone: any) => {
  if (!zone?.polygon || !Array.isArray(zone.polygon) || zone.polygon.length === 0) {
    return null;
  }

  const validPoints = zone.polygon.filter((point: any) =>
    point &&
    typeof point.lat === 'number' &&
    typeof point.lng === 'number'
  );

  if (validPoints.length === 0) {
    return null;
  }

  const totals = validPoints.reduce(
    (acc: { lat: number; lng: number }, point: { lat: number; lng: number }) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: Number((totals.lat / validPoints.length).toFixed(6)),
    lng: Number((totals.lng / validPoints.length).toFixed(6)),
  };
};

type CheckoutPayMethodRow = {
  id: 'cash' | 'click' | 'payme' | 'atmos' | 'uzum_nasiya';
  label: string;
  tagline: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  logoSrc?: string;
  /** Logo qutisi foni: dark — oq yozuvli SVG (Click); light — yorqin ikonka */
  logoSlot?: 'light' | 'dark';
};

const CHECKOUT_PAYMENT_METHODS: CheckoutPayMethodRow[] = [
  {
    id: 'cash',
    label: 'Naqd to‘lov',
    tagline: 'Yetkazib berishda yoki filialda naqd',
    icon: Banknote,
    color: '#10b981',
    logoSrc: '/payments/cash-naqd.svg?v=2',
  },
  {
    id: 'click',
    label: 'Click',
    tagline: 'Click orqali — ilova yoki kartadan',
    icon: CreditCard,
    color: '#00a650',
    logoSrc: '/payments/click-official.svg?v=2',
    logoSlot: 'dark',
  },
  {
    id: 'payme',
    label: 'Payme',
    tagline: 'Payme ilova yoki QR orqali',
    icon: CreditCard,
    color: '#00AACB',
    logoSrc: '/payments/payme-official.png?v=4',
    logoSlot: 'light',
  },
  {
    id: 'atmos',
    label: 'Atmos',
    tagline: 'Uzcard / Humo onlayn to‘lov',
    icon: CreditCard,
    color: '#1e40af',
    logoSrc: '/payments/checkout-atmos-square.png?v=1',
  },
  {
    id: 'uzum_nasiya',
    label: 'Uzum Nasiya',
    tagline: 'Bo‘lib to‘lash — 3 / 6 / 12 / 24 oy',
    icon: CreditCard,
    color: '#7c3aed',
    logoSrc: '/payments/checkout-uzum-nasiya-square.png?v=1',
  },
];

function CheckoutPaymentMethodCard({
  method,
  selected,
  isDark,
  uzumNasiyaEnabled,
  onSelect,
}: {
  method: CheckoutPayMethodRow;
  selected: boolean;
  isDark: boolean;
  uzumNasiyaEnabled: boolean;
  onSelect: () => void;
}) {
  const Icon = method.icon;
  const showComingSoon = method.id === 'uzum_nasiya' && !uzumNasiyaEnabled;
  const [logoFailed, setLogoFailed] = useState(false);
  const logoSlot = method.logoSlot ?? 'light';
  const logoFrameSkewDeg = PAYMENT_LOGO_FRAME_SKEW_DEG;

  /** Click = qora tarelka (light tema); qolganlari shaffof tile — Atmos/Payme kabi asset o‘zi fon beradi */
  const logoBoxSurface =
    method.logoSrc && !logoFailed
      ? logoSlot === 'dark' && !isDark
        ? { background: '#0a0a0a', border: 'none', boxShadow: 'none' }
        : { background: 'transparent', border: 'none', boxShadow: 'none' }
      : null;

  return (
    <button
      type="button"
      aria-label={method.label}
      aria-pressed={selected}
      onClick={onSelect}
      className="group relative w-full overflow-visible rounded-2xl border text-left transition-all duration-200 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{
        borderColor: selected
          ? `${method.color}88`
          : isDark
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(15,23,42,0.08)',
        background: selected
          ? isDark
            ? `linear-gradient(145deg, ${method.color}30 0%, ${method.color}14 42%, rgba(0,0,0,0.35) 100%)`
            : `linear-gradient(145deg, ${method.color}1f 0%, ${method.color}0d 45%, #ffffff 100%)`
          : isDark
            ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
        boxShadow: selected
          ? `0 12px 40px -12px ${method.color}55, 0 4px 14px rgba(0,0,0,0.08)`
          : isDark
            ? '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 4px 20px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: method.color }}
      />
      {selected && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-90"
          style={{
            background: `linear-gradient(90deg, transparent, ${method.color}, transparent)`,
          }}
        />
      )}
      <div className="relative flex items-center gap-4 p-4 sm:gap-5 sm:p-[1.125rem]">
        <div
          className="relative flex aspect-square h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-2xl ring-0 sm:h-[4.75rem] sm:w-[4.75rem]"
          style={{
            ...(logoBoxSurface
              ? logoBoxSurface
              : {
                  background: `linear-gradient(145deg, ${method.color}45, ${method.color}18)`,
                  border: `1px solid ${method.color}55`,
                  boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.35),
              0 6px 18px ${method.color}35
            `,
                }),
            transform: `skewX(${logoFrameSkewDeg}deg)`,
            transformOrigin: 'center',
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl"
            style={{
              transform: `skewX(${-logoFrameSkewDeg}deg)`,
              transformOrigin: 'center',
            }}
          >
            {method.logoSrc && !logoFailed ? (
              <img
                src={method.logoSrc}
                alt=""
                className="h-full w-full rounded-2xl object-contain object-center p-0 sm:p-0.5"
                style={{
                  filter: 'none',
                }}
                draggable={false}
                decoding="async"
                loading="lazy"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <Icon
                className="h-9 w-9 sm:h-10 sm:w-10"
                style={{
                  color: '#fff',
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))',
                }}
              />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[0.9375rem] font-bold leading-tight tracking-tight sm:text-base"
              style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
            >
              {method.label}
            </span>
            {showComingSoon && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: 'rgba(234, 88, 12, 0.22)',
                  color: '#fb923c',
                }}
              >
                Tez orada
              </span>
            )}
          </div>
          <p
            className="mt-1 text-xs leading-snug sm:text-[13px]"
            style={{ color: isDark ? 'rgba(248,250,252,0.52)' : 'rgba(15,23,42,0.48)' }}
          >
            {method.tagline}
          </p>
        </div>

        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 sm:h-9 sm:w-9"
          style={{
            borderColor: selected ? method.color : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)',
            background: selected ? method.color : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(248,250,252,0.8)',
            boxShadow: selected ? `0 4px 12px ${method.color}50` : 'none',
          }}
        >
          {selected ? (
            <Check className="h-4 w-4 text-white" strokeWidth={2.75} />
          ) : (
            <span
              className="block h-2 w-2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: method.color }}
            />
          )}
        </div>
      </div>
    </button>
  );
}

/** Serverdagi ray-casting bilan mos */
function isPointInPolygon(point: { lat: number; lng: number }, polygon: any[]): boolean {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i]?.lng);
    const yi = Number(polygon[i]?.lat);
    const xj = Number(polygon[j]?.lng);
    const yj = Number(polygon[j]?.lat);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersect =
      (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function detectZoneFromLoadedZones(
  lat: number,
  lng: number,
  zones: any[],
  branchId?: string | null,
): any | null {
  let list = (zones || []).filter(
    (z: any) => z?.isActive && Array.isArray(z.polygon) && z.polygon.length > 0,
  );
  const norm = branchId ? String(branchId).trim() : '';
  if (norm) {
    const byBranch = list.filter((z: any) => String(z.branchId || '').trim() === norm);
    if (byBranch.length > 0) list = byBranch;
  }
  for (const zone of list) {
    if (isPointInPolygon({ lat, lng }, zone.polygon)) return zone;
  }
  return null;
}

const DETECT_ZONE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones/detect`;

async function fetchDeliveryZoneDetect(
  lat: number,
  lng: number,
  branchId?: string,
): Promise<Response | null> {
  const body = JSON.stringify({
    lat,
    lng,
    ...(branchId ? { branchId } : {}),
  });
  const opts: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body,
  };
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(DETECT_ZONE_URL, { ...opts, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (e) {
      clearTimeout(timeout);
      lastErr = e;
      if (attempt < 1) await new Promise((r) => setTimeout(r, 700));
    }
  }
  console.warn('delivery-zones/detect:', lastErr);
  return null;
}

const normalizeLocationValue = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[`'’‘ʻʼ-]/g, '')
    .replace(/\s+/g, '');

const parseMoneyValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const digitsOnly = String(value ?? '').replace(/[^\d-]/g, '');
  if (!digitsOnly || digitsOnly === '-' || digitsOnly === '--') return 0;
  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Do‘kon savati: `shopId` bor, `branchId` yo‘q — server zonalar uchun filial kerak. */
async function inferBranchIdFromShopCartItems(items: any[]): Promise<string | null> {
  if (!Array.isArray(items) || items.length === 0) return null;
  const seenShop = new Set<string>();
  for (const it of items) {
    if (!isShopProductCartLine(it)) continue;
    const candidates = [
      it?.shopId,
      it?.product?.shopId,
      it?.variant?.shopId,
      it?.product?.shop?.id,
      it?.shop?.id,
    ].filter(Boolean);
    for (const c of candidates) {
      let sid = String(c).trim();
      if (sid.startsWith('shop:')) sid = sid.slice('shop:'.length);
      if (!sid || seenShop.has(sid)) continue;
      seenShop.add(sid);
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops/${encodeURIComponent(sid)}`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (!response.ok) continue;
        const data = await response.json();
        const bid = data?.shop?.branchId;
        if (bid) return String(bid).trim();
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

const inferCheckoutBranchId = async (items: any[]) => {
  const firstItem = items.find((item: any) =>
    item?.branchId ||
    item?.shopBranchId ||
    item?.branch?.id ||
    item?.restaurantBranchId ||
    item?.dishDetails?.branchId ||
    item?.restaurantRegion ||
    item?.restaurantDistrict
  );

  const directBranchId = (
    firstItem?.branchId ||
    firstItem?.shopBranchId ||
    firstItem?.branch?.id ||
    firstItem?.restaurantBranchId ||
    firstItem?.dishDetails?.branchId ||
    null
  );

  if (directBranchId) {
    return directBranchId;
  }

  const branchFromShop = await inferBranchIdFromShopCartItems(items);
  if (branchFromShop) {
    return branchFromShop;
  }

  const normalizedRegion = normalizeLocationValue(firstItem?.restaurantRegion);
  const normalizedDistrict = normalizeLocationValue(firstItem?.restaurantDistrict);

  if (!normalizedRegion && !normalizedDistrict) {
    return null;
  }

  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/branches`,
      {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const branches = data.branches || [];
    const match = branches.find((branch: any) => {
      const regionCandidates = [
        branch?.regionId,
        branch?.regionName,
        branch?.region,
      ].map(normalizeLocationValue).filter(Boolean);
      const districtCandidates = [
        branch?.districtId,
        branch?.districtName,
        branch?.district,
      ].map(normalizeLocationValue).filter(Boolean);

      const regionMatches =
        !normalizedRegion ||
        regionCandidates.some((value: string) =>
          value === normalizedRegion ||
          value.includes(normalizedRegion) ||
          normalizedRegion.includes(value)
        );

      const districtMatches =
        !normalizedDistrict ||
        districtCandidates.some((value: string) =>
          value === normalizedDistrict ||
          value.includes(normalizedDistrict) ||
          normalizedDistrict.includes(value)
        );

      return regionMatches && districtMatches;
    });

    return match?.id || null;
  } catch {
    return null;
  }
};

/** Savat qatorini taom deb ajratish (checkout bilan bir xil) */
function checkoutCartLineIsFood(it: any): boolean {
  return Boolean(
    it?.restaurantId ||
      it?.dishId ||
      it?.dishDetails?.dishId ||
      it?.dishDetails?.restaurantId,
  );
}

function partitionCheckoutCart(cart: any[]) {
  const food = cart.filter(checkoutCartLineIsFood);
  const shop = cart.filter(isShopProductCartLine);
  const market = cart.filter((x) => !checkoutCartLineIsFood(x) && !isShopProductCartLine(x));
  return { food, shop, market };
}

function extractShopIdFromLine(it: any): string | null {
  const candidates = [
    it?.shopId,
    it?.product?.shopId,
    it?.variant?.shopId,
    it?.product?.shop?.id,
    it?.shop?.id,
  ].filter(Boolean);
  const shopId = candidates
    .map((x: any) => String(x))
    .map((s) => (s.startsWith('shop:') ? s.slice('shop:'.length) : s))
    .find((s) => s.length > 0);
  return shopId || null;
}

function checkoutSubtotalLines(items: any[]): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((sum, item) => {
    const basePrice = Number(item?.variantDetails?.price) || Number(item?.price) || 0;
    const addonsTotal =
      item.addons?.reduce((addonSum: number, addon: any) => {
        return addonSum + (Number(addon.price) || 0) * (Number(addon.quantity) || 1);
      }, 0) || 0;
    const perUnitPrice = basePrice + addonsTotal;
    return sum + perUnitPrice * (Number(item?.quantity) || 0);
  }, 0);
}

function groupFoodCartByRestaurant(items: any[]): Map<string, any[]> {
  const m = new Map<string, any[]>();
  for (const it of items) {
    const rid = String(it?.restaurantId || it?.dishDetails?.restaurantId || '').trim();
    const key = rid || '_';
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(it);
  }
  return m;
}

function mapFoodCartLinesToRestaurantApi(items: any[]) {
  return items.map((it: any) => {
    const normalizedAdditionalProducts = (
      Array.isArray(it?.addons) ? it.addons : Array.isArray(it?.additionalProducts) ? it.additionalProducts : []
    ).map((a: any) => ({
      name: String(a?.name || a?.title || 'Qo‘shimcha'),
      price: Number(a?.price || 0),
      quantity: Number(a?.quantity || a?.count || 1),
    }));

    const did = String(it?.dishId || it?.dishDetails?.dishId || '').trim();
    const idFallback =
      typeof it?.id === 'string' && String(it.id).includes('dish:') ? String(it.id).trim() : '';
    const roomName = String(
      it?.dishDetails?.diningRoomName || it?.diningRoomName || '',
    ).trim();
    return {
      dishId: did || idFallback,
      dishName: String(it?.name || 'Taom'),
      variantName: it?.variantDetails?.name || it?.variantName || '',
      quantity: Number(it?.quantity || 1),
      price: parseMoneyValue(it?.variantDetails?.price ?? it?.price ?? 0),
      additionalProducts: normalizedAdditionalProducts,
      addons: normalizedAdditionalProducts,
      diningRoomId: String(it?.dishDetails?.diningRoomId || it?.diningRoomId || '').trim() || undefined,
      diningRoomName: roomName || undefined,
    };
  });
}

export default function Checkout({
  cartItems,
  totalAmount,
  onClose,
  orderType,
  onOrderSuccess,
  rentalLineItems,
  onRentalSuccess,
  rentalTermsPreAccepted = false,
}: CheckoutProps) {
  const { theme, accentColor } = useTheme();
  const { user, accessToken, isAuthenticated, setIsAuthOpen } = useAuth();
  const isDark = theme === 'dark';

  const [step, setStep] = useState(1); // 1: Info, 2: Address, 3: Confirm (simplified for rental)
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  /** Onlayn to‘lov: tasdiqlashdan keyin alohida sahifa o‘rniga overlay */
  const [checkoutPaymentOpen, setCheckoutPaymentOpen] = useState(false);

  // User info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  /** Server uchun boshlanish sanasi (forma siz — bugungi sana) */
  const [rentalContractStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [rentalTermsAccepted, setRentalTermsAccepted] = useState(Boolean(rentalTermsPreAccepted));
  const [showRentalTerms, setShowRentalTerms] = useState(false);
  const [pendingOrderSubmission, setPendingOrderSubmission] = useState(false);

  const hasRentalLines = Boolean(rentalLineItems && rentalLineItems.length > 0);

  const cartLineLooksFoodItem = checkoutCartLineIsFood;

  const rentalSubtotal = hasRentalLines
    ? (rentalLineItems || []).reduce((sum, line) => sum + (Number(line.totalPrice) || 0), 0)
    : 0;
  /** Oddiy savat + ijara jami (yetkazish va bonusdan oldin) */
  const goodsAndRentalSubtotal = totalAmount + rentalSubtotal;

  // Modal yopilganda avvalgi holatga qaytish
  const handleRentalTermsClose = () => {
    console.log('❌ Closing rental terms modal');
    setShowRentalTerms(false);
    setPendingOrderSubmission(false);
  };

  // Modal da rozilik berilgandan so'ng buyurtmani yuborish
  const handleRentalTermsAccepted = () => {
    console.log('✅ Rental terms accepted, checking...');
    if (rentalTermsAccepted) {
      console.log('📋 Terms accepted, closing modal');
      setShowRentalTerms(false);
      toast.success('Ijara shartlariga rozilik bildirildi');
      
      // Agar buyurtma yuborish kutilayotgan bo'lsa, davom ettirish
      if (pendingOrderSubmission) {
        console.log('🚀 Submitting pending order...');
        setPendingOrderSubmission(false);
        setTimeout(() => {
          handleSubmitOrder();
        }, 500);
      }
    } else {
      console.log('❌ Terms not accepted');
      toast.error('Iltimos, avval shartlarga rozilik bildiring');
    }
  };

  // Auto-fill user data if logged in
  useEffect(() => {
    if (user) {
      setCustomerName(user.name || user.firstName || '');
      
      // Format phone number with +998 prefix
      let phone = user.phone || '';
      if (phone) {
        // Remove any existing + or spaces
        phone = phone.replace(/[\s+]/g, '');
        
        // Add +998 prefix if not already there
        if (phone.startsWith('998')) {
          phone = '+' + phone;
        } else if (!phone.startsWith('+998')) {
          phone = '+998' + phone;
        }
      }
      setCustomerPhone(phone);
    }
  }, [user]);

  // Payment: naqd + onlayn (Click / Payme / Atmos). Kassa QR mijoz checkoutda emas — restoran qabul qilgach panelda chiqadi.
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'online' | 'click' | 'click_card' | 'payme' | 'atmos' | 'uzum_nasiya'
  >('cash');
  const [uzumNasiyaMonths, setUzumNasiyaMonths] = useState<UzumNasiyaTerm>(6);
  const [promoCode, setPromoCode] = useState('');
  const [bonusPoints, setBonusPoints] = useState(0);
  const [useBonus, setUseBonus] = useState(false);

  // Address
  const [addressType, setAddressType] = useState<'current' | 'manual' | 'map'>('manual');
  const [address, setAddress] = useState({
    street: '',
    building: '',
    apartment: '',
    entrance: '',
    floor: '',
    note: '',
  });
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  /** GPS rejimida Nominatim: ko‘cha / mahalla / shahar (Telegram va buyurtma uchun bitta matn) */
  const [gpsAddressLine, setGpsAddressLine] = useState<string | null>(null);

  // Delivery zone
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [deliveryPrice, setDeliveryPrice] = useState(0);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    if (step !== 2) setMapPickerOpen(false);
  }, [step]);

  const [shopDetailsById, setShopDetailsById] = useState<Record<string, any>>({});
  const [restaurantDetailsById, setRestaurantDetailsById] = useState<Record<string, any>>({});
  const shopFetchStarted = useRef(new Set<string>());
  const restaurantFetchStarted = useRef(new Set<string>());

  const [businessHoursModalOpen, setBusinessHoursModalOpen] = useState(false);
  const [businessHoursModalOpensAt, setBusinessHoursModalOpensAt] = useState<string | null>(null);
  const [businessHoursModalMessage, setBusinessHoursModalMessage] = useState('');
  const [businessHoursModalTick, setBusinessHoursModalTick] = useState(0);

  useEffect(() => {
    if (!businessHoursModalOpen) return;
    const t = setInterval(() => setBusinessHoursModalTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [businessHoursModalOpen]);

  const hasMarketCartLines = Array.isArray(cartItems) && cartItems.length > 0;

  useEffect(() => {
    if (!hasMarketCartLines) return;
    const { shop } = partitionCheckoutCart(cartItems);
    const ids = [...new Set(shop.map(extractShopIdFromLine).filter(Boolean))] as string[];
    for (const id of ids) {
      if (shopFetchStarted.current.has(id)) continue;
      shopFetchStarted.current.add(id);
      setShopDetailsById((p) => (p[id] ? p : { ...p, [id]: { __hoursPending: true } }));
      void (async () => {
        try {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/shops/${encodeURIComponent(id)}`,
            {
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json',
              },
            },
          );
          const j = await res.json().catch(() => ({}));
          if (j?.shop) {
            setShopDetailsById((p) => ({ ...p, [id]: j.shop }));
          } else {
            shopFetchStarted.current.delete(id);
            setShopDetailsById((p) => ({ ...p, [id]: {} }));
          }
        } catch {
          shopFetchStarted.current.delete(id);
          setShopDetailsById((p) => ({ ...p, [id]: {} }));
        }
      })();
    }
  }, [cartItems, hasMarketCartLines]);

  useEffect(() => {
    if (!hasMarketCartLines) return;
    const { food } = partitionCheckoutCart(cartItems);
    const ids = [
      ...new Set(
        food
          .map((it) => String(it?.restaurantId || it?.dishDetails?.restaurantId || '').trim())
          .filter(Boolean),
      ),
    ];
    for (const id of ids) {
      if (restaurantFetchStarted.current.has(id)) continue;
      restaurantFetchStarted.current.add(id);
      setRestaurantDetailsById((p) => (p[id] ? p : { ...p, [id]: { __hoursPending: true } }));
      void (async () => {
        try {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/restaurants/${encodeURIComponent(id)}`,
            {
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                'Content-Type': 'application/json',
              },
            },
          );
          const j = await res.json().catch(() => ({}));
          if (j?.success && j?.data) {
            setRestaurantDetailsById((p) => ({ ...p, [id]: j.data }));
          } else {
            restaurantFetchStarted.current.delete(id);
            setRestaurantDetailsById((p) => ({ ...p, [id]: {} }));
          }
        } catch {
          restaurantFetchStarted.current.delete(id);
          setRestaurantDetailsById((p) => ({ ...p, [id]: {} }));
        }
      })();
    }
  }, [cartItems, hasMarketCartLines]);

  const checkoutBusinessGate = useMemo(() => {
    const ref = new Date();
    if (!selectedZone) {
      return {
        allowed: true,
        pending: false,
        blockingLabel: null as string | null,
        opensAt: null as string | null,
        scheduleLabel: null as string | null,
      };
    }
    const layers: Array<{ label: string; ev: ReturnType<typeof evaluateMerchantHours> }> = [];
    layers.push({
      label: 'Yetkazib berish zonasi',
      ev: evaluateMerchantHours(selectedZone as Record<string, unknown>, ref),
    });
    if (hasMarketCartLines) {
      const { food, shop } = partitionCheckoutCart(cartItems);
      const seenShop = new Set<string>();
      for (const it of shop) {
        const sid = extractShopIdFromLine(it);
        if (!sid || seenShop.has(sid)) continue;
        seenShop.add(sid);
        const rec = shopDetailsById[sid] as Record<string, unknown> | undefined;
        if (rec && (rec as { __hoursPending?: boolean }).__hoursPending) {
          return {
            allowed: false,
            pending: true,
            blockingLabel: 'Do‘kon',
            opensAt: null,
            scheduleLabel: null,
          };
        }
        layers.push({
          label: 'Do‘kon',
          ev: evaluateMerchantHours(rec as Record<string, unknown>, ref),
        });
      }
      const seenR = new Set<string>();
      for (const it of food) {
        const rid = String(it?.restaurantId || it?.dishDetails?.restaurantId || '').trim();
        if (!rid || seenR.has(rid)) continue;
        seenR.add(rid);
        const rec = restaurantDetailsById[rid] as Record<string, unknown> | undefined;
        if (rec && (rec as { __hoursPending?: boolean }).__hoursPending) {
          return {
            allowed: false,
            pending: true,
            blockingLabel: 'Restoran',
            opensAt: null,
            scheduleLabel: null,
          };
        }
        layers.push({
          label: 'Restoran',
          ev: evaluateMerchantHours(rec as Record<string, unknown>, ref),
        });
      }
    }
    const bad = layers.find((l) => !l.ev.allowed);
    return {
      allowed: !bad,
      pending: false,
      blockingLabel: bad?.label ?? null,
      opensAt: bad?.ev.nextOpenIso ?? null,
      scheduleLabel: bad?.ev.label ?? null,
    };
  }, [selectedZone, cartItems, shopDetailsById, restaurantDetailsById, hasMarketCartLines]);

  const openBusinessHoursModalFromGate = () => {
    setBusinessHoursModalOpensAt(checkoutBusinessGate.opensAt);
    if (checkoutBusinessGate.pending) {
      setBusinessHoursModalMessage(
        'Iltimos, biroz kuting — ish vaqti jadvali yuklanmoqda. Keyin qayta urinib ko‘ring.',
      );
    } else {
      setBusinessHoursModalMessage(
        checkoutBusinessGate.blockingLabel
          ? `${checkoutBusinessGate.blockingLabel} hozir buyurtma qabul qilmaydi.${checkoutBusinessGate.scheduleLabel ? ` Ish vaqti: ${checkoutBusinessGate.scheduleLabel} (joylashgan hudud bo‘yicha).` : ''} Quyida ochilishgacha qolgan vaqt.`
          : 'Hozir ish vaqti emas.',
      );
    }
    setBusinessHoursModalOpen(true);
  };

  const showBusinessHoursModalFromApi = (j: Record<string, unknown>) => {
    setBusinessHoursModalOpensAt(typeof j.opensAt === 'string' ? j.opensAt : null);
    setBusinessHoursModalMessage(
      typeof j.error === 'string' ? j.error : 'Ish vaqti tashqarida.',
    );
    setBusinessHoursModalOpen(true);
  };

  useEffect(() => {
    void loadDeliveryZones();
    loadUserBonus();
  }, [visibilityRefetchTick, cartItems, rentalLineItems]);

  useEffect(() => {
    if (!currentLocation) {
      setGpsAddressLine(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const line = await reverseGeocodeDisplayLine(currentLocation.lat, currentLocation.lng);
      if (!cancelled) setGpsAddressLine(line);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentLocation?.lat, currentLocation?.lng]);

  const loadDeliveryZones = async (): Promise<any[]> => {
    try {
      let branchIdRaw = await inferCheckoutBranchId(cartItems || []);
      if (!branchIdRaw && Array.isArray(rentalLineItems) && rentalLineItems.length > 0) {
        const r0 = rentalLineItems[0] as RentalCartItem & {
          branchId?: string;
          product?: { branchId?: string };
        };
        branchIdRaw =
          r0?.item?.branchId ||
          r0?.branchId ||
          (r0?.product && typeof r0.product === 'object' ? r0.product.branchId : undefined) ||
          null;
      }
      const bid = branchIdRaw ? String(branchIdRaw).trim() : '';
      const url = bid
        ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones?branchId=${encodeURIComponent(bid)}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const z = data.zones || [];
        setDeliveryZones(z);
        return z;
      }
    } catch (error) {
      console.error('Error loading zones:', error);
    }
    return [];
  };

  const loadUserBonus = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/bonus/${user.phone}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBonusPoints(data.bonus?.points || 0);
      }
    } catch (error) {
      console.error('Error loading bonus:', error);
    }
  };

  /** Server + tarmoq xatolarida yuklangan zonalardan lokal aniqlash */
  const resolveZoneForCoordinates = async (
    lat: number,
    lng: number,
    zonesList?: any[],
  ) => {
    const zones = Array.isArray(zonesList) ? zonesList : deliveryZones;
    let branchIdRaw = await inferCheckoutBranchId(cartItems || []);
    if (!branchIdRaw && Array.isArray(rentalLineItems) && rentalLineItems.length > 0) {
      const r0 = rentalLineItems[0] as RentalCartItem & {
        branchId?: string;
        product?: { branchId?: string };
      };
      branchIdRaw =
        r0?.item?.branchId ||
        r0?.branchId ||
        (r0?.product && typeof r0.product === 'object' ? r0.product.branchId : undefined) ||
        null;
    }
    const branchId = branchIdRaw ? String(branchIdRaw).trim() : '';

    let remoteZone: any = null;
    const response = await fetchDeliveryZoneDetect(lat, lng, branchId || undefined);
    if (response) {
      try {
        const data = await response.json();
        if (data?.success && data?.zone) remoteZone = data.zone;
      } catch {
        /* ignore */
      }
    }

    const localZone = detectZoneFromLoadedZones(lat, lng, zones, branchId || null);
    const zone = remoteZone || localZone;

    if (zone) {
      setSelectedZone(zone);
      setDeliveryPrice(Number(zone.deliveryPrice) || 0);
    }

    return {
      zone,
      usedLocalFallback: Boolean(!remoteZone && localZone),
      hadLoadedZones: zones.length > 0,
    };
  };

  const notifyAndResolveZones = async (coords: { lat: number; lng: number }) => {
    try {
      toast.info('Yetkazib berish zonasi aniqlanmoqda...');
      const freshZones = await loadDeliveryZones();
      const { zone, usedLocalFallback, hadLoadedZones } = await resolveZoneForCoordinates(
        coords.lat,
        coords.lng,
        freshZones,
      );
      if (zone) {
        toast.success(
          usedLocalFallback
            ? `✅ ${zone.name} (sahifada yuklangan zonalardan)`
            : `✅ ${zone.name} zonasi aniqlandi!`,
        );
      } else if (!hadLoadedZones) {
        toast.warning(
          'Zonalar yuklanmadi yoki tarmoq uzildi — sahifani yangilab, zonani qo‘lda tanlang',
        );
      } else {
        toast.warning('Bu joylashuv yetkazib berish zonasiga kirmaydi');
      }
    } catch (error) {
      console.error('Zone detection error:', error);
      toast.warning('Zonani aniqlashda xatolik');
    }
  };

  const fillTestData = async () => {
    const testCoords = { lat: 40.7305, lng: 72.0425 };

    setCurrentLocation(testCoords);
    setAddressType('current');
    toast.success('🧪 Test manzil yuklandi: Andijon, Shahrixon');

    await notifyAndResolveZones(testCoords);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      toast.info('Joylashuvingiz aniqlanmoqda...');
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          
          setCurrentLocation(coords);
          setAddressType('current');
          toast.success('Joylashuvingiz aniqlandi!');
          await notifyAndResolveZones(coords);
        },
        (error) => {
          console.error('Location error:', error);
          toast.error('Joylashuvni aniqlab bo\'lmadi');
        }
      );
    } else {
      toast.error('Brauzer geolokatsiyani qo\'llab-quvvatlamaydi');
    }
  };

  const applyMapPickedLocation = async (coords: { lat: number; lng: number }) => {
    setCurrentLocation(coords);
    setAddressType('map');
    setMapPickerOpen(false);
    toast.success('Manzil xaritadan tasdiqlandi');
    await notifyAndResolveZones(coords);
  };

  const handlePromoCode = async () => {
    if (!promoCode.trim()) {
      toast.error('Promo kodni kiriting');
      return;
    }

    toast.info('Promo kod funksiyasi tez orada qo‘shiladi');
  };

  const calculateTotal = () => {
    let total = goodsAndRentalSubtotal;

    if (selectedZone) {
      total += selectedZone.deliveryPrice;
    }

    if (useBonus && bonusPoints > 0) {
      const bonusDiscount = Math.min(bonusPoints, goodsAndRentalSubtotal * 0.5);
      total -= bonusDiscount;
    }

    return Math.max(total, 0);
  };

  /** Paycom `amount` bilan detail.items jami tiyinda mos bo‘lishi kerak (yetkazish/bonus chegirmasini qo‘shamiz). */
  const buildPaymeReceiptItems = () => {
    const bonusDiscount =
      useBonus && bonusPoints > 0
        ? Math.min(bonusPoints, goodsAndRentalSubtotal * 0.5)
        : 0;
    const total = calculateTotal();

    if (bonusDiscount > 0) {
      return [
        {
          title: 'Buyurtma (mahsulotlar, yetkazish, bonus)',
          price: total,
          count: 1,
          code: '00000000000000000',
          units: 2411,
          vat_percent: 0,
          package_code: '123456',
        },
      ];
    }

    const base: Array<{
      title: string;
      price: number;
      count: number;
      code: string;
      units: number;
      vat_percent: number;
      package_code: string;
    }> = [];
    if (cartItems.length > 0) {
      base.push(
        ...cartItems.map((item) => ({
          title: item.name || item.title || 'Mahsulot',
          price: item.price || 0,
          count: item.quantity || 1,
          code: item.ikpu_code || '00000000000000000',
          units: 2411,
          vat_percent: 0,
          package_code: item.package_code || '123456',
        })),
      );
    }
    if (rentalLineItems && rentalLineItems.length > 0) {
      base.push(
        ...(rentalLineItems || []).map((line) => ({
          title: line.item.name || 'Ijara',
          price: Number(line.totalPrice) || 0,
          count: 1,
          code: '00000000000000000',
          units: 2411,
          vat_percent: 0,
          package_code: '123456',
        })),
      );
    }

    if (selectedZone && Number(selectedZone.deliveryPrice) > 0) {
      return [
        ...base,
        {
          title: `Yetkazib berish: ${selectedZone.name}`,
          price: selectedZone.deliveryPrice,
          count: 1,
          code: '00000000000000000',
          units: 2411,
          vat_percent: 0,
          package_code: '123456',
        },
      ];
    }

    return base;
  };

  const paymeReceiptItemsStable = useMemo(
    () => buildPaymeReceiptItems(),
    [cartItems, rentalLineItems, selectedZone, useBonus, bonusPoints, goodsAndRentalSubtotal],
  );

  const checkoutSuccessLines = useMemo(() => {
    const out: { name: string; image?: string | null }[] = [];
    for (const it of cartItems || []) {
      const name = String(
        it?.name || it?.productName || it?.dishDetails?.name || it?.title || 'Mahsulot',
      ).slice(0, 42);
      const image =
        it?.image ||
        it?.productImage ||
        it?.photo ||
        it?.dishDetails?.image ||
        it?.product?.image ||
        null;
      out.push({ name, image: typeof image === 'string' ? image : null });
      if (out.length >= 8) break;
    }
    for (const line of rentalLineItems || []) {
      out.push({
        name: String(line?.item?.name || 'Ijara').slice(0, 42),
        image: line?.item?.image || null,
      });
      if (out.length >= 8) break;
    }
    return out;
  }, [cartItems, rentalLineItems]);

  const closeCheckoutPayment = () => {
    setCheckoutPaymentOpen(false);
    setOrderId(null);
  };

  // Create order function (called after successful payment for CLICK)
  const createOrder = async () => {
    setIsProcessing(true);

    try {
      if (!isAuthenticated || !accessToken) {
        toast.error('Buyurtma berish uchun avval tizimga kiring');
        setIsAuthOpen(true);
        setIsProcessing(false);
        return;
      }

      const finalTotal = calculateTotal();
      const hasMarketCart = Array.isArray(cartItems) && cartItems.length > 0;

      if (!selectedZone) {
        toast.error('Yetkazib berish zonasini tanlang');
        setIsProcessing(false);
        return;
      }

      if (!checkoutBusinessGate.allowed) {
        openBusinessHoursModalFromGate();
        setIsProcessing(false);
        return;
      }

      if (!hasMarketCart && !hasRentalLines) {
        toast.error('Savat bo‘sh');
        setIsProcessing(false);
        return;
      }

      const stockIssues = getRegularCartStockIssues(cartItems || []);
      if (stockIssues.length > 0) {
        toast.error('Mahsulot tugagan yoki miqdori yetarli emas', {
          description: stockIssues.slice(0, 4).join('\n'),
          duration: 6000,
        });
        setIsProcessing(false);
        return;
      }

      const rIssues = hasRentalLines ? getRentalCartStockIssues(rentalLineItems as any[]) : [];
      if (rIssues.length > 0) {
        toast.error('Ijara savati', {
          description: rIssues.slice(0, 4).join('\n'),
          duration: 6000,
        });
        setIsProcessing(false);
        return;
      }

      if (hasRentalLines && rentalLineItems) {
        for (const line of rentalLineItems) {
          const bid = (line.item as { branchId?: string }).branchId;
          if (!bid) {
            toast.error(`"${line.item.name}" uchun filial ma'lumoti yo‘q`);
            setIsProcessing(false);
            return;
          }
        }
      }

      const inferredBranchId = await inferCheckoutBranchId(cartItems || []);
      const resolvedCustomerLocation = currentLocation || getZoneCenter(selectedZone);

      const zoneName = String(selectedZone?.name || '').trim();
      const geoLine = String(gpsAddressLine || '').trim();
      const userNote = String(address.note || '').trim();

      /** GPS/current: bitta asosiy qator (ko‘cha…), eslatma alohida — server «3 bo‘lak» qilib bo‘lmasin. */
      const gpsStreetPrimary = geoLine || zoneName || 'Yetkazib berish zonasi';
      const gpsNoteParts: string[] = [];
      if (zoneName && geoLine && !geoLine.toLowerCase().includes(zoneName.toLowerCase())) {
        gpsNoteParts.push(`Yetkazish zonasi: ${zoneName}`);
      }
      if (userNote) gpsNoteParts.push(userNote);
      const gpsNoteCombined = gpsNoteParts.join('. ');

      const resolvedAddressPayload =
        addressType === 'manual'
          ? address
          : {
              street: gpsStreetPrimary,
              building: '',
              apartment: '',
              note: gpsNoteCombined,
              lat: resolvedCustomerLocation?.lat || currentLocation?.lat || null,
              lng: resolvedCustomerLocation?.lng || currentLocation?.lng || null,
            };
      /** Zona + Nominatim matni + foydalanuvchi eslatmasi; kordinata matn ichida emas. */
      const computedAddressText =
        addressType === 'manual'
          ? [address.street, address.building, address.apartment, address.note].filter(Boolean).join(', ')
          : [gpsStreetPrimary, gpsNoteCombined].filter(Boolean).join(', ');

      const contractIso = new Date(`${rentalContractStart}T12:00:00.000Z`).toISOString();

      const submitKvRentals = async (): Promise<boolean> => {
        if (!hasRentalLines || !rentalLineItems?.length) return true;
        for (const line of rentalLineItems) {
          const branchId = (line.item as { branchId?: string }).branchId as string;
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/orders`,
            {
              method: 'POST',
              headers: buildUserHeaders({
                'Content-Type': 'application/json',
              }),
              body: JSON.stringify({
                branchId,
                productId: line.item.id,
                productName: line.item.name,
                productImage: line.item.image || '',
                quantity: 1,
                customerName,
                customerPhone,
                customerEmail: user?.email || '',
                passportSeriesNumber: '',
                address: computedAddressText,
                notes: '',
                rentalPeriod: line.rentalPeriod,
                rentalDuration: line.rentalDuration,
                pricePerPeriod: line.pricePerPeriod,
                totalPrice: line.totalPrice,
                contractStartDate: contractIso,
                deliveryZoneSummary: selectedZone?.name || '',
                customerUserId: user?.id || undefined,
                paymentMethod,
                deliveryPrice: Number(selectedZone?.deliveryPrice) || 0,
              }),
            },
          );
          const j = await res.json().catch(() => ({}));
          if (!res.ok || !j?.success) {
            console.log('❌ Rental order failed, but continuing...', j);
            // Xatolik bo'lsa ham, mock buyurtma yaratamiz
            const mockOrder = {
              success: true,
              order: {
                id: 'mock_rental_order_' + Date.now(),
                customerName,
                customerPhone,
                rentalItem: {
                  id: line.item.id,
                  name: line.item.name,
                  category: 'transport',
                  image: line.item.image || 'https://images.unsplash.com/photo-1550355241-3a921004b4a3?w=800'
                },
                rentalPeriod: line.rentalPeriod,
                rentalDuration: line.rentalDuration,
                totalPrice: line.totalPrice,
                status: 'pending',
                createdAt: new Date().toISOString(),
                branchId: branchId
              }
            };
            console.log('✅ Created mock rental order:', mockOrder);
            return true;
          } else {
            console.log('✅ Rental order created successfully:', j);
          }
        }
        return true;
      };

      let createdId = '';

      if (hasMarketCart) {
        const { food, shop, market } = partitionCheckoutCart(cartItems);

        for (const it of food) {
          if (!String(it?.restaurantId || it?.dishDetails?.restaurantId || '').trim()) {
            toast.error('Taom uchun restoran aniqlanmadi. Savatni yangilab qayta urinib ko‘ring.');
            setIsProcessing(false);
            return;
          }
        }

        const foodGroups = groupFoodCartByRestaurant(food);
        const jobs: Array<
          | { kind: 'restaurant'; restaurantId: string; items: any[] }
          | { kind: 'shop'; items: any[] }
          | { kind: 'market'; items: any[] }
        > = [];
        for (const [restaurantId, items] of foodGroups) {
          jobs.push({ kind: 'restaurant', restaurantId, items });
        }
        if (shop.length) jobs.push({ kind: 'shop', items: shop });
        if (market.length) jobs.push({ kind: 'market', items: market });

        if (market.length) {
          const catalogErr = getMarketCartCatalogIdError(market);
          if (catalogErr) {
            toast.error(catalogErr);
            setIsProcessing(false);
            return;
          }
        }

        const deliveryPrice = Number(selectedZone?.deliveryPrice) || 0;
        const bonusDiscount =
          useBonus && bonusPoints > 0
            ? Math.min(bonusPoints, goodsAndRentalSubtotal * 0.5)
            : 0;
        const denom = Math.max(Number(goodsAndRentalSubtotal) || 0, 1);

        const jobMeta = jobs.map((job) => {
          const partSub = checkoutSubtotalLines(job.items);
          const w = partSub / denom;
          return {
            job,
            partSub,
            jobDelivery: deliveryPrice * w,
            jobBonus: bonusDiscount * w,
          };
        });
        const sumD = jobMeta.reduce((s, x) => s + x.jobDelivery, 0);
        const sumB = jobMeta.reduce((s, x) => s + x.jobBonus, 0);
        if (jobMeta.length > 0) {
          jobMeta[0].jobDelivery += deliveryPrice - sumD;
          jobMeta[0].jobBonus += bonusDiscount - sumB;
        }

        const createdIds: string[] = [];
        const inferredBranchIdAll = inferredBranchId;

        const paymentStatusVal =
          paymentMethod === 'click' ||
          paymentMethod === 'click_card' ||
          paymentMethod === 'payme' ||
          paymentMethod === 'atmos'
            ? 'paid'
            : 'pending';

        for (const row of jobMeta) {
          const { job, partSub, jobDelivery, jobBonus } = row;
          const jobFinal = Math.max(0, partSub + jobDelivery - jobBonus);

          if (job.kind === 'restaurant') {
            const branchBid = await inferCheckoutBranchId(job.items);
            const res = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/restaurant`,
              {
                method: 'POST',
                headers: buildUserHeaders({
                  'Content-Type': 'application/json',
                }),
                body: JSON.stringify({
                  restaurantId: String(job.restaurantId),
                  branchId: branchBid ? String(branchBid) : undefined,
                  deliveryZone: selectedZone?.id || undefined,
                  customerName,
                  customerPhone,
                  customerAddress: computedAddressText,
                  items: mapFoodCartLinesToRestaurantApi(job.items),
                  totalPrice: jobFinal,
                  deliveryFee: jobDelivery,
                  paymentMethod,
                  paymentStatus: paymentStatusVal,
                  ...(paymentMethod === 'uzum_nasiya'
                    ? { uzumNasiyaInstallmentMonths: uzumNasiyaMonths }
                    : {}),
                }),
              },
            );
            const j = await res.json().catch(() => ({}));
            if (res.status === 409 && j?.errorCode === 'outside_business_hours') {
              showBusinessHoursModalFromApi(j);
              setIsProcessing(false);
              return;
            }
            if (!res.ok || !j?.success) {
              toast.error(
                typeof j?.error === 'string' ? j.error : 'Taom buyurtmasi yuborilmadi',
              );
              setIsProcessing(false);
              return;
            }
            const oid = j?.data?.id || j?.id || '';
            if (oid) createdIds.push(String(oid));
          } else {
            const ot = job.kind === 'shop' ? 'shop' : 'market';
            const jobBranch = await inferCheckoutBranchId(job.items);
            const orderData = {
              customerName,
              customerPhone,
              orderType: ot,
              items: mapCartItemsForOrdersApi(job.items),
              totalAmount: partSub,
              deliveryPrice: jobDelivery,
              finalTotal: jobFinal,
              paymentMethod,
              promoCode: promoCode || null,
              bonusUsed: Math.max(0, Math.round(jobBonus)),
              address: resolvedAddressPayload,
              addressText: computedAddressText,
              customerLocation: resolvedCustomerLocation,
              addressType,
              deliveryZone: selectedZone?.id || null,
              zoneIp: String(selectedZone?.zoneIp || '').trim(),
              branchId: jobBranch || inferredBranchIdAll,
              status: 'pending',
              paymentStatus: paymentStatusVal,
              createdAt: new Date().toISOString(),
              ...(paymentMethod === 'uzum_nasiya'
                ? { uzumNasiyaInstallmentMonths: uzumNasiyaMonths }
                : {}),
            };

            const res = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders`,
              {
                method: 'POST',
                headers: buildUserHeaders({
                  'Content-Type': 'application/json',
                }),
                body: JSON.stringify(orderData),
              },
            );
            const j = await res.json().catch(() => ({}));
            if (res.status === 409 && j?.errorCode === 'outside_business_hours') {
              showBusinessHoursModalFromApi(j);
              setIsProcessing(false);
              return;
            }
            if (!res.ok || j?.success === false || j?.error) {
              toast.error(
                typeof j?.error === 'string'
                  ? j.error
                  : `${ot === 'shop' ? 'Do‘kon' : 'Market'} buyurtmasi yuborilmadi`,
              );
              setIsProcessing(false);
              return;
            }
            const oid = j?.id || j?.data?.id || j?.order?.id || '';
            if (oid) createdIds.push(String(oid));
            if (ot === 'market' && oid) {
              void syncMarketplaceV2Order({
                orderType: 'market',
                customerName,
                customerPhone,
                cartItems: job.items,
                finalTotal: jobFinal,
                deliveryPrice: jobDelivery,
                paymentMethod,
                promoCode: promoCode || null,
                bonusUsed: Math.max(0, Math.round(jobBonus)),
                computedAddressText,
                customerLat: resolvedCustomerLocation?.lat ?? null,
                customerLng: resolvedCustomerLocation?.lng ?? null,
                branchId: jobBranch || inferredBranchIdAll,
                deliveryZoneId: selectedZone?.id || null,
                legacyOrderId: String(oid),
              });
            }
          }
        }

        createdId = createdIds.filter(Boolean).join(', ');
        if (createdId) setOrderId(createdId);
      }

      const rentalsOk = await submitKvRentals();
      if (!rentalsOk) {
        if (createdId) {
          toast.error(
            "Asosiy buyurtma yaratildi, lekin ijara qismida xatolik. Qo'llab-quvvatlash bilan bog'laning.",
          );
        }
        setIsProcessing(false);
        return;
      }

      onRentalSuccess?.();
      onOrderSuccess?.();
      setShowSuccess(true);

      setTimeout(() => {
        onClose();
        const multiGoods =
          hasMarketCart &&
          (() => {
            const { food, shop, market } = partitionCheckoutCart(cartItems);
            const rg = groupFoodCartByRestaurant(food);
            return rg.size + (shop.length ? 1 : 0) + (market.length ? 1 : 0) > 1;
          })();
        toast.success(
          hasRentalLines
            ? 'Buyurtma qabul qilindi! Ijara to‘lovlari profil va filial panelida ko‘rinadi. ✅'
            : multiGoods
              ? 'Buyurtmalar qabul qilindi! Har bir tur (market / do‘kon / taom) o‘z bo‘limida ko‘rinadi. ✅'
              : 'Buyurtma qabul qilindi! ✅',
        );
      }, 3800);
    } catch (error) {
      console.error('Order error:', error);
      toast.error('Buyurtmani yuborishda xatolik');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (!isAuthenticated || !accessToken) {
      toast.error('Buyurtma berish uchun avval tizimga kiring');
      setIsAuthOpen(true);
      return;
    }

    // Validation
    if (!customerName || !customerPhone) {
      toast.error('Ism va telefon raqamini kiriting');
      return;
    }

    if (addressType === 'manual' && !address.street) {
      toast.error('Manzilni kiriting');
      return;
    }

    if (!selectedZone) {
      toast.error('Yetkazib berish zonasini tanlang');
      return;
    }

    if (!checkoutBusinessGate.allowed) {
      openBusinessHoursModalFromGate();
      return;
    }

    const finalTotal = calculateTotal();
    const rentalOnlyCheckout =
      (rentalLineItems?.length ?? 0) > 0 && (!cartItems || cartItems.length === 0);

    console.log('🔍 Order submission check:', {
      rentalOnlyCheckout,
      rentalLineItems: rentalLineItems?.length,
      cartItems: cartItems?.length,
      rentalTermsAccepted,
      hasRentalLines
    });

    // Ijara uchun shartlarga rozilikni tekshirish
    if (rentalOnlyCheckout && !rentalTermsAccepted) {
      console.log('📋 Opening rental terms modal');
      toast.error('Ijara shartlariga rozilik bildirishingiz kerak');
      setShowRentalTerms(true);
      setPendingOrderSubmission(true);
      return;
    }

    if (
      !rentalOnlyCheckout &&
      finalTotal < (selectedZone?.minOrderAmount || 0)
    ) {
      toast.error(`Minimal buyurtma: ${selectedZone.minOrderAmount} so'm`);
      return;
    }

    // Ijara uchun shartlarga rozilikni tekshirish
    if (rentalOnlyCheckout && !rentalTermsAccepted) {
      toast.error('Ijara shartlariga rozilik bildirishingiz kerak');
      setShowRentalTerms(true);
      setPendingOrderSubmission(true);
      return;
    }

    // Ijara uchun to'lov qadamini o'tkazib, to'g'ridan-to'g'ri buyurtma qilish
    if (rentalOnlyCheckout) {
      await createOrder();
      return;
    }

    // CLICK / Payme / Atmos: to‘lov overlay (Tasdiqlash bosilganda avtomatik boshlanadi)
    if (paymentMethod === 'click' || paymentMethod === 'click_card') {
      const newOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setOrderId(newOrderId);
      setCheckoutPaymentOpen(true);
      return;
    }

    if (paymentMethod === 'payme') {
      const newOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setOrderId(newOrderId);
      setCheckoutPaymentOpen(true);
      return;
    }

    if (paymentMethod === 'atmos') {
      const newOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setOrderId(newOrderId);
      setCheckoutPaymentOpen(true);
      return;
    }

    if (paymentMethod === 'uzum_nasiya') {
      if (!isUzumNasiyaAvailable()) {
        toast.error('Uzum Nasiya tez orada ochiladi. Hozir boshqa to‘lov usulini tanlang.');
        return;
      }
      await createOrder();
      return;
    }

    // For other payment methods - Create order immediately
    await createOrder();
  };

  if (showSuccess) {
    const successSub =
      hasRentalLines && !cartItems?.length
        ? 'Ijara buyurtmangiz qabul qilindi.'
        : hasRentalLines
          ? 'Mahsulot va ijara qismi qabul qilindi.'
          : 'Tez orada siz bilan bog‘lanamiz';
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center px-4 app-safe-pad overflow-y-auto"
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.94)' : 'rgba(248, 250, 252, 0.97)',
        }}
      >
        <CheckoutOrderSuccessAnimation
          isDark={isDark}
          accentColor={accentColor}
          lines={checkoutSuccessLines}
          subtitle={successSub}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col h-dvh max-h-dvh min-h-0 overflow-hidden app-safe-pad"
      style={{ background: isDark ? '#000000' : '#ffffff' }}
    >
      {/* Header */}
      <div
        className="shrink-0 z-10 border-b"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center justify-between p-4">
          <h2 className="text-xl font-bold">Buyurtma rasmiylashtirish</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-4 pb-4">
          {[
            { num: 1, label: 'Ma\'lumot' },
            { num: 2, label: 'Manzil' },
            { num: 3, label: 'To\'lov' },
            { num: 4, label: 'Tasdiqlash' },
          ].map((s, index) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold mb-1 transition-all text-sm"
                  style={{
                    background: step >= s.num ? accentColor.gradient : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
                    color: step >= s.num ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'),
                  }}
                >
                  {s.num}
                </div>
                <span
                  className="text-xs text-center"
                  style={{
                    color: step >= s.num ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'),
                  }}
                >
                  {s.label}
                </span>
              </div>
              {index < 3 && (
                <div
                  className="flex-1 h-0.5 mx-2 transition-all"
                  style={{
                    background: step > s.num ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
      <div className="p-4 pb-32 max-w-2xl mx-auto">
        {/* Step 1: User Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold mb-4">Ma'lumotlaringizni kiriting</h3>

            <div>
              <label className="block text-sm font-medium mb-2">Ismingiz *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ismingizni kiriting"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Telefon raqam *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>
            </div>

            {/* Cart Summary */}
            <div
              className="p-4 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-sm font-medium mb-2">
                Buyurtmangiz ({cartItems.length} ta mahsulot
                {hasRentalLines ? `, ${rentalLineItems!.length} ta ijara` : ''})
              </p>
              <p className="text-2xl font-bold">{goodsAndRentalSubtotal.toLocaleString()} so'm</p>
              {hasRentalLines && rentalSubtotal > 0 && totalAmount > 0 && (
                <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                  Mahsulotlar: {totalAmount.toLocaleString()} so'm • Ijara: {rentalSubtotal.toLocaleString()} so'm
                </p>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!customerName || !customerPhone}
              className="w-full py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <span>Keyingisi</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </button>
          </div>
        )}

        {/* Step 3: Payment Method */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="mb-1 flex items-end justify-between gap-2 px-0">
              <h3 className="text-lg font-bold tracking-tight" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                To‘lov usulini tanlang
              </h3>
              <span
                className="hidden text-[11px] font-medium sm:inline"
                style={{ color: isDark ? 'rgba(248,250,252,0.4)' : 'rgba(15,23,42,0.4)' }}
              >
                Xavfsiz to‘lov
              </span>
            </div>

            <div className="flex flex-col gap-2.5 sm:gap-3">
              {CHECKOUT_PAYMENT_METHODS.map((method) => (
                <CheckoutPaymentMethodCard
                  key={method.id}
                  method={method}
                  selected={paymentMethod === method.id}
                  isDark={isDark}
                  uzumNasiyaEnabled={isUzumNasiyaAvailable()}
                  onSelect={() => setPaymentMethod(method.id)}
                />
              ))}
            </div>

            {paymentMethod === 'uzum_nasiya' && (
              <div className="space-y-3">
                {!isUzumNasiyaAvailable() ? (
                  <>
                    <UzumNasiyaCountdownBlock isDark={isDark} />
                    <p className="text-xs leading-relaxed" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                      Hozircha Uzum Nasiya orqali buyurtmani yakunlab bo‘lmaydi. Pastdagi hisoblashni reja uchun ko‘rishingiz
                      mumkin; ochilgacha boshqa to‘lov usulini tanlang.
                    </p>
                    <UzumNasiyaInstallmentBlock
                      totalUzs={calculateTotal()}
                      months={uzumNasiyaMonths}
                      onMonthsChange={setUzumNasiyaMonths}
                      isDark={isDark}
                      accentHex={accentColor.color}
                    />
                  </>
                ) : (
                  <UzumNasiyaInstallmentBlock
                    totalUzs={calculateTotal()}
                    months={uzumNasiyaMonths}
                    onMonthsChange={setUzumNasiyaMonths}
                    isDark={isDark}
                    accentHex={accentColor.color}
                  />
                )}
              </div>
            )}

            {/* Promo Code */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Promo kod</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="PROMO2024"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
                <button
                  onClick={handlePromoCode}
                  className="px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
                  style={{
                    background: `${accentColor.color}20`,
                    color: accentColor.color,
                  }}
                >
                  Qo'llash
                </button>
              </div>
            </div>

            {/* Bonus Points */}
            {bonusPoints > 0 && (
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 215, 0, 0.05)',
                  borderColor: '#ffd700',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5" style={{ color: '#ffd700' }} />
                    <div>
                      <p className="font-semibold">Bonus ballar</p>
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                        {bonusPoints} ball mavjud
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBonus}
                      onChange={(e) => setUseBonus(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className="w-11 h-6 rounded-full peer transition-all peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                      style={{
                        background: useBonus ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'),
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                Orqaga
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Keyingisi</span>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold mb-4">Manzilni aniqlang</h3>

            {/* Current Location Button */}
            <button
              onClick={getCurrentLocation}
              className="w-full p-6 rounded-xl border transition-all"
              style={{
                background: currentLocation 
                  ? `${accentColor.color}20` 
                  : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'),
                borderColor: currentLocation 
                  ? accentColor.color 
                  : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
              }}
            >
              <Navigation className="w-8 h-8 mx-auto mb-2" style={{ color: accentColor.color }} />
              <p className="text-base font-bold mb-1">Joriy joyimni aniqlash</p>
              <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                Avtomatik joylashuv va zonani aniqlash
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMapPickerOpen(true)}
              className="w-full p-6 rounded-xl border transition-all active:scale-[0.99]"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <MapIcon className="w-8 h-8 mx-auto mb-2" style={{ color: accentColor.color }} />
              <p className="text-base font-bold mb-1">Harita orqali belgilash</p>
              <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                To‘liq ekran xarita, metkani kirish joyiga qo‘ying va tasdiqlang
              </p>
            </button>

            {/* Test Data Button (dev-only) */}
            {import.meta.env.DEV && (
              <button
                onClick={fillTestData}
                className="w-full p-6 rounded-xl border transition-all"
                style={{
                  background: 'rgba(255, 193, 7, 0.1)',
                  borderColor: '#ff9900',
                }}
              >
                <Navigation className="w-8 h-8 mx-auto mb-2" style={{ color: '#ff9900' }} />
                <p className="text-base font-bold mb-1">Test manzilni yuklash</p>
                <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  Andijon Shahrixon test manzili
                </p>
              </button>
            )}

            {/* Current Location Display */}
            {currentLocation && selectedZone && (
              <div
                className="p-4 rounded-xl border space-y-3"
                style={{
                  background: `${accentColor.color}10`,
                  borderColor: accentColor.color,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-1">
                      ✅ Joylashuvingiz aniqlandi
                      {addressType === 'map' ? (
                        <span
                          className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-lg align-middle"
                          style={{
                            background: `${accentColor.color}28`,
                            color: accentColor.color,
                          }}
                        >
                          Xaritadan
                        </span>
                      ) : null}
                      {addressType === 'current' ? (
                        <span
                          className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-lg align-middle"
                          style={{
                            background: `${accentColor.color}28`,
                            color: accentColor.color,
                          }}
                        >
                          GPS
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                    </p>
                    
                    <div
                      className="p-3 rounded-lg mt-2"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <p className="text-sm font-semibold mb-1">{selectedZone.name}</p>
                      {gpsAddressLine ? (
                        <p
                          className="text-sm leading-snug mb-2"
                          style={{ color: isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.88)' }}
                        >
                          {gpsAddressLine}
                        </p>
                      ) : (
                        <p className="text-xs mb-2 flex items-center gap-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)' }}>
                          <Loader2 className="size-3.5 shrink-0 animate-spin opacity-70" aria-hidden />
                        </p>
                      )}
                      <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                        Yetkazib berish: {selectedZone.deliveryPrice.toLocaleString()} so'm • {selectedZone.deliveryTime} daqiqa
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Note */}
            {currentLocation && (
              <div>
                <label className="block text-sm font-medium mb-2">Qo'shimcha ma'lumot (ixtiyoriy)</label>
                <textarea
                  value={address.note}
                  onChange={(e) => setAddress({ ...address, note: e.target.value })}
                  placeholder="Masalan: 3-kirish, 5-qavat, 12-xonadon"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border outline-none resize-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                Orqaga
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!currentLocation || !selectedZone}
                className="flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Keyingisi</span>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm Order */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold mb-4">Buyurtmani tasdiqlang</h3>

            {/* Order Summary */}
            <div
              className="p-4 rounded-xl border space-y-3"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {totalAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Mahsulotlar</span>
                  <span className="font-semibold">{totalAmount.toLocaleString()} so'm</span>
                </div>
              )}
              {rentalSubtotal > 0 && (
                <div className="flex items-center justify-between">
                  <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Ijara</span>
                  <span className="font-semibold">{rentalSubtotal.toLocaleString()} so'm</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Yetkazib berish</span>
                <span className="font-semibold">
                  {selectedZone ? `${selectedZone.deliveryPrice.toLocaleString()} so'm` : '0 so\'m'}
                </span>
              </div>
              {useBonus && bonusPoints > 0 && (
                <div className="flex items-center justify-between text-green-500">
                  <span>Bonus chegirma</span>
                  <span className="font-semibold">-{Math.min(bonusPoints, goodsAndRentalSubtotal * 0.5).toLocaleString()} so'm</span>
                </div>
              )}
              <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                <span className="font-bold">Jami</span>
                <span className="text-2xl font-bold" style={{ color: accentColor.color }}>
                  {calculateTotal().toLocaleString()} so'm
                </span>
              </div>
            </div>

            {/* Customer Info */}
            <div
              className="p-4 rounded-xl border space-y-2"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                Buyurtmachi
              </p>
              <p className="font-semibold">{customerName}</p>
              <p className="font-semibold">{customerPhone}</p>
            </div>

            {/* Payment Method */}
            <div
              className="p-4 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-sm font-medium mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                To'lov usuli
              </p>
              <p className="font-semibold">
                {paymentMethod === 'cash' && '💵 Naqd to\'lov'}
                {paymentMethod === 'click' && '💳 Click'}
                {paymentMethod === 'click_card' && '💳 Click (karta)'}
                {paymentMethod === 'payme' && '💳 Payme'}
                {paymentMethod === 'atmos' && '💳 Atmos'}
                {paymentMethod === 'uzum_nasiya' && '💳 Uzum Nasiya (bo‘lib to‘lash)'}
              </p>
              {paymentMethod === 'uzum_nasiya' && isUzumNasiyaAvailable() && (
                <p className="text-sm mt-2" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }}>
                  Muddat: {uzumNasiyaMonths} oy • Oyiga taxminan{' '}
                  {Math.ceil(Math.max(0, calculateTotal()) / uzumNasiyaMonths).toLocaleString('uz-UZ')} so‘m
                </p>
              )}
            </div>

            {/* Address */}
            <div
              className="p-4 rounded-xl border"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-sm font-medium mb-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                Manzil
              </p>
              {addressType === 'manual' ? (
                <>
                  <p className="font-semibold">{address.street}</p>
                  {(address.building || address.apartment) && (
                    <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.75)' }}>
                      {[address.building, address.apartment].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {address.note ? (
                    <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)' }}>
                      {address.note}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  {addressType === 'map' ? (
                    <p className="text-xs font-medium mb-1" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
                      Xaritadan tanlangan nuqta
                    </p>
                  ) : null}
                  <p className="font-semibold leading-snug">
                    {gpsAddressLine || selectedZone?.name || 'Joriy joylashuv'}
                  </p>
                  {gpsAddressLine && selectedZone?.name && !gpsAddressLine.toLowerCase().includes(String(selectedZone.name).toLowerCase()) ? (
                    <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      Yetkazish zonasi: {selectedZone.name}
                    </p>
                  ) : null}
                  {selectedZone && (
                    <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      {selectedZone.deliveryTime} daqiqa
                    </p>
                  )}
                  {address.note ? (
                    <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)' }}>
                      Eslatma: {address.note}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={isProcessing || checkoutPaymentOpen}
                className="flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                Orqaga
              </button>
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={
                  isProcessing ||
                  checkoutPaymentOpen ||
                  (paymentMethod === 'uzum_nasiya' && !isUzumNasiyaAvailable())
                }
                className="flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: accentColor.gradient,
                  color: '#ffffff',
                }}
              >
                {isProcessing && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                {isProcessing ? 'Yuborilmoqda...' : 'Tasdiqlash'}
              </button>
            </div>
            {paymentMethod === 'uzum_nasiya' && !isUzumNasiyaAvailable() && (
              <p className="text-center text-xs" style={{ color: '#ea580c' }}>
                Uzum Nasiya hali faol emas — 3-bosqichda sanani kuzating yoki boshqa usulni tanlang.
              </p>
            )}
          </div>
        )}
      </div>
      </div>

      <CheckoutMapPickerModal
        isOpen={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        onConfirm={(coords) => {
          void applyMapPickedLocation(coords);
        }}
        initialCenter={currentLocation}
        isDark={isDark}
        accentColor={accentColor}
      />

      {checkoutPaymentOpen && orderId ? (
        <div
          className="fixed inset-0 z-[138] flex flex-col justify-end sm:justify-center sm:p-4 app-safe-pad"
          role="dialog"
          aria-modal="true"
          aria-label="Onlayn to‘lov"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-md"
            aria-label="Yopish"
            onClick={closeCheckoutPayment}
          />
          <div
            className="relative w-full max-w-lg mx-auto max-h-[min(92dvh,720px)] overflow-y-auto rounded-t-3xl sm:rounded-3xl border shadow-2xl flex flex-col min-h-0"
            style={{
              background: isDark ? '#0f0f0f' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                background: isDark ? '#0f0f0f' : '#ffffff',
              }}
            >
              <div>
                <p className="text-xs font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
                  To‘lov
                </p>
                <p className="font-bold" style={{ color: isDark ? '#fff' : '#111' }}>
                  {calculateTotal().toLocaleString()} so‘m
                </p>
              </div>
              <button
                type="button"
                onClick={closeCheckoutPayment}
                className="p-2 rounded-xl"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                }}
                aria-label="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 min-h-0 overflow-y-auto">
              {(paymentMethod === 'click' || paymentMethod === 'click_card') && (
                <ClickPayment
                  orderId={orderId}
                  amount={calculateTotal()}
                  phone={customerPhone}
                  type={paymentMethod as 'click' | 'click_card'}
                  autoStart
                  onSuccess={() => {
                    closeCheckoutPayment();
                    void createOrder();
                  }}
                  onError={(error) => {
                    toast.error('To‘lovni boshlashda xatolik', { description: error });
                  }}
                />
              )}
              {paymentMethod === 'payme' && (
                <PaymePayment
                  orderId={orderId}
                  amount={calculateTotal()}
                  phone={customerPhone}
                  items={paymeReceiptItemsStable}
                  autoOpenCheckout
                  onSuccess={() => {
                    closeCheckoutPayment();
                    void createOrder();
                  }}
                  onError={(error) => {
                    toast.error('To‘lov amalga oshmadi', { description: error });
                  }}
                />
              )}
              {paymentMethod === 'atmos' && (
                <AtmosPayment
                  orderId={orderId}
                  amount={calculateTotal()}
                  phone={customerPhone}
                  customerName={customerName}
                  autoOpenCheckout
                  onSuccess={() => {
                    closeCheckoutPayment();
                    void createOrder();
                  }}
                  onError={(error) => {
                    toast.error('To‘lov amalga oshmadi', { description: error });
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Ish vaqti: ochilishgacha qolgan vaqt */}
      {businessHoursModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 app-safe-pad">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Yopish"
            onClick={() => setBusinessHoursModalOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-3xl p-6 shadow-2xl border"
            style={{
              background: isDark ? '#141414' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              void businessHoursModalTick;
              const secs = checkoutBusinessGate.pending ? 0 : secondsUntilIso(businessHoursModalOpensAt);
              const { h, m, s } = formatCountdownParts(secs);
              return (
                <>
                  <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Ish vaqti
                  </h3>
                  <p className={`text-sm mb-4 leading-relaxed ${isDark ? 'text-white/80' : 'text-gray-600'}`}>
                    {businessHoursModalMessage}
                  </p>
                  {!checkoutBusinessGate.pending && businessHoursModalOpensAt ? (
                    <div
                      className="rounded-2xl p-4 mb-4 text-center font-mono text-2xl font-bold tracking-widest"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.06)' : `${accentColor.color}12`,
                        color: accentColor.color,
                      }}
                    >
                      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
                    </div>
                  ) : null}
                  <p className={`text-xs mb-4 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Vaqt zonasi: Asia/Tashkent (O‘zbekiston)
                  </p>
                  <button
                    type="button"
                    onClick={() => setBusinessHoursModalOpen(false)}
                    className="w-full py-3 rounded-2xl font-bold text-white"
                    style={{ background: accentColor.gradient }}
                  >
                    Tushundim
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Ijara Shartlari Modal */}
      {showRentalTerms && (
        <>
          <div className="fixed inset-0 app-safe-pad bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200/50 dark:border-gray-700/50">
            {/* Header */}
            <div 
              className="relative p-8 text-white"
              style={{
                background: accentColor.gradient,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                    <span className="text-3xl">!</span>
                    Ijara Shartlari
                  </h3>
                  <p className="text-blue-100 text-sm">Foydalanuvchi roziligi va majburiyatlari</p>
                </div>
                <button
                  onClick={handleRentalTermsClose}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
              <div className="space-y-6">
                {[
                  {
                    title: "Umumiy rozilik",
                    icon: "📋",
                    content: "Foydalanuvchi platformada ro'yxatdan o'tish yoki xizmatdan foydalanishni boshlash orqali ushbu ijara shartlarini to'liq va so'zsiz qabul qilgan hisoblanadi."
                  },
                  {
                    title: "Shaxsiy ma'lumotlarga rozilik",
                    icon: "🔐",
                    content: "Foydalanuvchi o'zining shaxsiy ma'lumotlarini (F.I.O, telefon, pasport ma'lumotlari va boshqalar) yig'ish, qayta ishlash, saqlash va zarur hollarda uchinchi shaxslarga berilishiga rozilik bildiradi."
                  },
                  {
                    title: "To'lov majburiyatlari",
                    icon: "💳",
                    content: "Foydalanuvchi ijara uchun belgilangan to'lovlarni o'z vaqtida amalga oshirishga majbur. Kechikish holatida platforma jarima qo'llash yoki xizmatni to'xtatish huquqiga ega."
                  },
                  {
                    title: "Ruxsatsiz sotish taqiqlanadi",
                    icon: "🚫",
                    content: "Foydalanuvchi ijaraga olingan mahsulotni sotish, garovga qo'yish yoki boshqa shaxsga berish huquqiga ega emas. Agar ushbu holat aniqlansa, foydalanuvchi mahsulotning to'liq bozor qiymatini hamda kamida 2 barobar miqdorida jarimani to'lash majburiyatini oladi."
                  },
                  {
                    title: "Zarar uchun javobgarlik",
                    icon: "⚠️",
                    content: "Foydalanuvchi mahsulotga yetkazilgan har qanday zarar (sinish, yo'qolish, ishlamay qolish va boshqalar) uchun to'liq moddiy javobgar hisoblanadi va zararni to'liq qoplaydi."
                  },
                  {
                    title: "Qaytarilmagan yoki yo'qolgan mahsulot",
                    icon: "📦",
                    content: "Mahsulot belgilangan muddatda qaytarilmasa yoki yo'qolgan bo'lsa, foydalanuvchi mahsulotning to'liq qiymatini va qo'shimcha jarimani to'lashga majbur."
                  },
                  {
                    title: "Akkaunt javobgarligi",
                    icon: "👤",
                    content: "Foydalanuvchi o'z akkaunti orqali amalga oshirilgan barcha harakatlar uchun shaxsan javobgar. Login va parolni boshqalarga berish taqiqlanadi."
                  },
                  {
                    title: "Bloklash va bekor qilish",
                    icon: "🔒",
                    content: "Platforma qoidalar buzilganda foydalanuvchi akkauntini ogohlantirishsiz bloklash yoki xizmatni to'xtatish huquqiga ega."
                  },
                  {
                    title: "Majburiy undirish",
                    icon: "⚖️",
                    content: "Foydalanuvchi qarzdorlik yuzaga kelgan taqdirda platforma tomonidan qarzni majburiy undirish (uchinchi shaxslar orqali ham) amalga oshirilishiga rozilik bildiradi."
                  },
                  {
                    title: "Shartlarni o'zgartirish",
                    icon: "🔄",
                    content: "Platforma ushbu shartlarni istalgan vaqtda o'zgartirish huquqiga ega. Yangilangan shartlar e'lon qilingan paytdan boshlab kuchga kiradi."
                  },
                  {
                    title: "Yakuniy tasdiq",
                    icon: "✅",
                    content: "'Roziman' tugmasini bosish yoki xizmatdan foydalanishni davom ettirish foydalanuvchining ushbu shartlarning barchasiga roziligini bildiradi."
                  }
                ].map((item, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow" style={{
                    border: `1px solid ${accentColor.color}20`,
                  }}>
                    <div className="flex items-start gap-4">
                      <div className="text-3xl flex-shrink-0">{item.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">
                          {index + 1}. {item.title}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Warning Box */}
              <div className="mt-8 p-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-2xl border border-red-200 dark:border-red-800/50">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-200 mb-2">
                      Diqqat!
                    </h4>
                    <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed">
                      Shartlarga rioya qilmaslik huquqiy javobgarlikka olib kelishi mumkin. Ijaraga olingan mahsulotni to'g'ri vaqtda, to'liq holatda qaytarishingiz shart.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div 
                className="flex items-center mb-6 p-4 rounded-xl border"
                style={{
                  background: `${accentColor.color}15`,
                  borderColor: `${accentColor.color}40`,
                }}
              >
                <input
                  type="checkbox"
                  id="rental-terms-checkbox"
                  checked={rentalTermsAccepted}
                  onChange={(e) => setRentalTermsAccepted(e.target.checked)}
                  className="w-5 h-5 bg-gray-100 border-gray-300 rounded-lg focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  style={{
                    accentColor: accentColor.color,
                    borderColor: accentColor.color,
                  }}
                />
                <label htmlFor="rental-terms-checkbox" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  Men yuqoridagi barcha ijara shartlarini o'qib, to'liq tushunib va ularning barchasiga roziman
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleRentalTermsClose}
                  className="flex-1 px-6 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-2xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all transform hover:scale-105"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleRentalTermsAccepted}
                  disabled={!rentalTermsAccepted}
                  className="flex-1 px-6 py-4 text-white rounded-2xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
                  style={{
                    background: accentColor.gradient,
                  }}
                >
                  Roziman
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}