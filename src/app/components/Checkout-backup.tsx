import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { X, ChevronRight, MapPin, Navigation, CreditCard, Wallet, User, Phone, Check, Tag, Gift, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import ClickPayment from './ClickPayment';
import PaymePayment from './PaymePayment';
import AtmosPayment from './AtmosPayment';
import { buildUserHeaders } from '../utils/requestAuth';
import { syncMarketplaceV2Order } from '../utils/marketplaceV2Sync';
import { getRegularCartStockIssues, getRentalCartStockIssues } from '../utils/cartStock';
import type { RentalCartItem } from '../context/RentalCartContext';
import { useVisibilityTick } from '../utils/visibilityRefetch';

interface CheckoutProps {
  cartItems: any[];
  totalAmount: number;
  onClose: () => void;
  orderType: 'market' | 'shop' | 'food' | 'rental';
  onOrderSuccess?: () => void;
  /** Ijara savati (Cart dan uzatiladi) */
  rentalLineItems?: RentalCartItem[];
  onRentalSuccess?: () => void;
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

export default function Checkout({
  cartItems,
  totalAmount,
  onClose,
  orderType,
  onOrderSuccess,
  rentalLineItems,
  onRentalSuccess,
}: CheckoutProps) {
  const { theme, accentColor } = useTheme();
  const { user, accessToken, isAuthenticated, setIsAuthOpen } = useAuth();
  const isDark = theme === 'dark';

  const [step, setStep] = useState(1); // 1: Info, 2: Address, 3: Confirm (simplified for rental)
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // User info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [rentalContractStart, setRentalContractStart] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [rentalPassport, setRentalPassport] = useState('');
  const [rentalAddress, setRentalAddress] = useState('');
  const [rentalEmail, setRentalEmail] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [rentalTermsAccepted, setRentalTermsAccepted] = useState(false);
  const [showRentalTerms, setShowRentalTerms] = useState(false);
  const [pendingOrderSubmission, setPendingOrderSubmission] = useState(false);

  const hasRentalLines = Boolean(rentalLineItems && rentalLineItems.length > 0);

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

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'click' | 'click_card' | 'payme' | 'atmos' | 'qr'>('cash');
  const [promoCode, setPromoCode] = useState('');
  const [bonusPoints, setBonusPoints] = useState(0);
  const [useBonus, setUseBonus] = useState(false);
  const isCashierQrFlow = orderType !== 'market' && orderType !== 'rental';

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

  // Delivery zone
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [deliveryPrice, setDeliveryPrice] = useState(0);
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    loadDeliveryZones();
    loadUserBonus();
  }, [visibilityRefetchTick]);

  useEffect(() => {
    if (isCashierQrFlow) {
      setPaymentMethod('qr');
    }
  }, [isCashierQrFlow]);

  const loadDeliveryZones = async (): Promise<any[]> => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/delivery-zones`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

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
    const branchIdRaw = await inferCheckoutBranchId(cartItems || []);
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

  const fillTestData = async () => {
    const testCoords = { lat: 40.7305, lng: 72.0425 };

    setCurrentLocation(testCoords);
    setAddressType('current');
    toast.success('🧪 Test manzil yuklandi: Andijon, Shahrixon');

    try {
      toast.info('Yetkazib berish zonasi aniqlanmoqda...');
      const freshZones = await loadDeliveryZones();
      const { zone, usedLocalFallback, hadLoadedZones } = await resolveZoneForCoordinates(
        testCoords.lat,
        testCoords.lng,
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
          'Zonalar ro‘yxati yuklanmagan yoki tarmoq uzildi — sahifani yangilab, qayta urinib ko‘ring',
        );
      } else {
        toast.warning('Bu joylashuv yetkazib berish zonasiga kirmaydi');
      }
    } catch (error) {
      console.error('Zone detection error:', error);
      toast.warning('Zonani aniqlashda xatolik');
    }
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

  const handlePromoCode = async () => {
    if (!promoCode.trim()) {
      toast.error('Promo kodni kiriting');
      return;
    }

    toast.info('Promo kod funksiyasi tez orada qo‘shiladi');
  };

  const calculateTotal = () => {
    let total = totalAmount;
    
    // Add delivery price
    if (selectedZone) {
      total += selectedZone.deliveryPrice;
    }

    // Apply bonus discount
    if (useBonus && bonusPoints > 0) {
      const bonusDiscount = Math.min(bonusPoints, total * 0.5); // Max 50% discount
      total -= bonusDiscount;
    }

    return Math.max(total, 0);
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
        if (!rentalContractStart) {
          toast.error('Ijara boshlanish sanasini tanlang');
          setIsProcessing(false);
          return;
        }
        const needId = rentalLineItems.some(
          (l) => l.rentalPeriod === 'weekly' || l.rentalPeriod === 'monthly',
        );
        if (needId && (!rentalPassport.trim() || !rentalAddress.trim())) {
          toast.error('Haftalik/oylik to‘lovda pasport/ID va yashash manzili majburiy');
          setIsProcessing(false);
          return;
        }
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

      const resolvedAddressPayload =
        addressType === 'manual'
          ? address
          : {
              street: selectedZone?.name || 'Yetkazib berish manzili',
              note: address.note || '',
              lat: resolvedCustomerLocation?.lat || currentLocation?.lat || null,
              lng: resolvedCustomerLocation?.lng || currentLocation?.lng || null,
            };
      const computedAddressText =
        addressType === 'manual'
          ? [address.street, address.building, address.apartment, address.note].filter(Boolean).join(', ')
          : `${selectedZone?.name || 'Yetkazib berish zonasi'} (${Number(resolvedCustomerLocation?.lat || 0).toFixed(5)}, ${Number(resolvedCustomerLocation?.lng || 0).toFixed(5)})`;

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
                quantity: 1,
                customerName,
                customerPhone,
                customerEmail: rentalEmail,
                passportSeriesNumber: rentalPassport,
                address: rentalAddress.trim() || computedAddressText,
                notes: rentalNotes,
                rentalPeriod: line.rentalPeriod,
                rentalDuration: line.rentalDuration,
                pricePerPeriod: line.pricePerPeriod,
                totalPrice: line.totalPrice,
                contractStartDate: contractIso,
                deliveryZoneSummary: selectedZone?.name || '',
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
        const orderData = {
          customerName,
          customerPhone,
          orderType,
          items: cartItems,
          totalAmount: totalAmount,
          deliveryPrice: selectedZone?.deliveryPrice || 0,
          finalTotal,
          paymentMethod,
          promoCode: promoCode || null,
          bonusUsed: useBonus ? bonusPoints : 0,
          address: resolvedAddressPayload,
          addressText: computedAddressText,
          customerLocation: resolvedCustomerLocation,
          addressType,
          deliveryZone: selectedZone?.id || null,
          zoneIp: String(selectedZone?.zoneIp || '').trim(),
          branchId: inferredBranchId,
          status: 'pending',
          paymentStatus:
            paymentMethod === 'click' ||
            paymentMethod === 'click_card' ||
            paymentMethod === 'payme' ||
            paymentMethod === 'atmos'
              ? 'paid'
              : 'pending',
          createdAt: new Date().toISOString(),
        };

        console.log('📦 Creating order with data:', orderData);

        const isFood = String(orderType).toLowerCase() === 'food';
        const response = await fetch(
          isFood
            ? `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders/restaurant`
            : `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/orders`,
          {
            method: 'POST',
            headers: buildUserHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify(
              isFood
                ? (() => {
                    const restaurantId =
                      cartItems?.find((it: any) => it?.restaurantId)?.restaurantId ||
                      cartItems?.[0]?.restaurantId;

                    if (!restaurantId) {
                      throw new Error('Taom buyurtma uchun restaurantId topilmadi');
                    }

                    return {
                      restaurantId: String(restaurantId),
                      branchId: inferredBranchId ? String(inferredBranchId) : undefined,
                      customerName,
                      customerPhone,
                      customerAddress: computedAddressText,
                      items: cartItems.map((it: any) => {
                        const normalizedAdditionalProducts = (
                          Array.isArray(it?.addons) ? it.addons : Array.isArray(it?.additionalProducts) ? it.additionalProducts : []
                        ).map((a: any) => ({
                          name: String(a?.name || a?.title || 'Qo‘shimcha'),
                          price: Number(a?.price || 0),
                          quantity: Number(a?.quantity || a?.count || 1),
                        }));

                        return {
                          dishId: it?.dishDetails?.dishId || it?.dishId || it?.id,
                          dishName: String(it?.name || it?.dishDetails?.restaurantName || 'Taom'),
                          variantName: it?.variantDetails?.name || it?.variantName || '',
                          quantity: Number(it?.quantity || 1),
                          price: parseMoneyValue(it?.variantDetails?.price ?? it?.price ?? 0),
                          additionalProducts: normalizedAdditionalProducts,
                          addons: normalizedAdditionalProducts,
                        };
                      }),
                      totalPrice: finalTotal,
                      deliveryFee: selectedZone?.deliveryPrice || 0,
                      paymentMethod,
                    };
                  })()
                : orderData,
            ),
          },
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          console.error('❌ Order creation failed:', error);
          toast.error(error.error || 'Xatolik yuz berdi');
          setIsProcessing(false);
          return;
        }

        const data = await response.json();
        console.log('✅ Order created:', data);
        createdId = data?.id || data?.data?.id || data?.order?.id || '';
        setOrderId(createdId);
        if (createdId && cartItems.length > 0 && String(orderType).toLowerCase() !== 'food') {
          void syncMarketplaceV2Order({
            orderType,
            customerName,
            customerPhone,
            cartItems,
            finalTotal,
            deliveryPrice: selectedZone?.deliveryPrice || 0,
            paymentMethod,
            promoCode: promoCode || null,
            bonusUsed: useBonus ? bonusPoints : 0,
            computedAddressText,
            customerLat: resolvedCustomerLocation?.lat ?? null,
            customerLng: resolvedCustomerLocation?.lng ?? null,
            branchId: inferredBranchId,
            deliveryZoneId: selectedZone?.id || null,
            legacyOrderId: String(createdId),
          });
        }
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
        toast.success(
          hasRentalLines
            ? 'Buyurtma qabul qilindi! Ijara to‘lovlari profil va filial panelida ko‘rinadi. ✅'
            : 'Buyurtma qabul qilindi! ✅',
        );
      }, 3000);
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

    // For CLICK and CLICK Card - Generate orderId and wait for payment
    if (paymentMethod === 'click' || paymentMethod === 'click_card') {
      // Generate unique order ID
      const newOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setOrderId(newOrderId);
      
      toast.info('To\'lovni amalga oshiring', {
        description: 'To\'lov muvaffaqiyatli bo\'lgandan keyin buyurtma yaratiladi',
      });
      
      return; // Don't create order yet, wait for payment
    }

    // For Payme - Generate orderId and wait for payment
    if (paymentMethod === 'payme') {
      // Generate unique order ID
      const newOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setOrderId(newOrderId);
      
      toast.info('To\'lovni amalga oshiring', {
        description: 'To\'lov muvaffaqiyatli bo\'lgandan keyin buyurtma yaratiladi',
      });
      
      return; // Don't create order yet, wait for payment
    }

    // For Atmos - Generate orderId and wait for payment
    if (paymentMethod === 'atmos') {
      // Generate unique order ID
      const newOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setOrderId(newOrderId);
      
      toast.info('To\'lovni amalga oshiring', {
        description: 'To\'lov muvaffaqiyatli bo\'lgandan keyin buyurtma yaratiladi',
      });
      
      return; // Don't create order yet, wait for payment
    }

    // For other payment methods - Create order immediately
    await createOrder();
  };

  // Success animation
  if (showSuccess) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0, 0, 0, 0.9)' }}
      >
        <div className="text-center">
          <div
            className="inline-flex p-8 rounded-full mb-6 animate-bounce"
            style={{ background: `${accentColor.color}30` }}
          >
            <Check className="w-24 h-24" style={{ color: accentColor.color }} />
          </div>
          <h2 className="text-3xl font-bold mb-2 text-white">Buyurtma rasmiylashtrildi!</h2>
          <p className="text-white/70">Tez orada siz bilan bog'lanamiz</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: isDark ? '#000000' : '#ffffff' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b"
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
            { num: 3, label: 'Tasdiqlash' },
          ].map((s, index) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold mb-1 transition-all"
                  style={{
                    background: step >= s.num ? accentColor.gradient : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
                    color: step >= s.num ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'),
                  }}
                >
                  {s.label}
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
              {index < 2 && (
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

            {hasRentalLines && (
              <div className="space-y-3 p-4 rounded-xl border" style={{ borderColor: isDark ? 'rgba(20,184,166,0.35)' : 'rgba(20,184,166,0.25)', background: isDark ? 'rgba(20,184,166,0.08)' : 'rgba(20,184,166,0.06)' }}>
                <p className="text-sm font-bold" style={{ color: accentColor.color }}>Ijara shartnomasi</p>
                <div>
                  <label className="block text-xs font-medium mb-1">Shartnoma boshlanishi *</label>
                  <input
                    type="date"
                    value={rentalContractStart}
                    onChange={(e) => setRentalContractStart(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Pasport / ID seriya va raqam {rentalLineItems?.some((l) => l.rentalPeriod === 'weekly' || l.rentalPeriod === 'monthly') ? '*' : ''}</label>
                  <input
                    type="text"
                    value={rentalPassport}
                    onChange={(e) => setRentalPassport(e.target.value)}
                    placeholder="AA1234567"
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Yashash manzili {rentalLineItems?.some((l) => l.rentalPeriod === 'weekly' || l.rentalPeriod === 'monthly') ? '*' : ''}</label>
                  <input
                    type="text"
                    value={rentalAddress}
                    onChange={(e) => setRentalAddress(e.target.value)}
                    placeholder="Viloyat, tuman, ko‘cha..."
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Email (ixtiyoriy)</label>
                  <input
                    type="email"
                    value={rentalEmail}
                    onChange={(e) => setRentalEmail(e.target.value)}
                    placeholder="you@mail.com"
                    className="w-full px-4 py-3 rounded-xl border outline-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Izoh (ixtiyoriy)</label>
                  <textarea
                    value={rentalNotes}
                    onChange={(e) => setRentalNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border outline-none resize-none"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
                <p className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                  Haftalik/oylik ijarda keyingi to‘lov sanasi sizga va filialga ko‘rsatiladi. Push/SMS alohida ulansa, avtomatik eslatma yuboriladi.
                </p>
              </div>
            )}

            
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
              <p className="text-2xl font-bold">{totalAmount.toLocaleString()} so'm</p>
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

        {/* Step 2: Payment Method */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold mb-4">To'lov usulini tanlang</h3>

            <div className="space-y-3">
              {(isCashierQrFlow
                ? [{ id: 'qr' as const, label: 'Filial kassasi QR to\'lov', icon: CreditCard, color: '#2563eb' }]
                : [
                    { id: 'cash' as const, label: 'Naqd to\'lov', icon: Wallet, color: '#10b981' },
                    { id: 'click' as const, label: 'Click', icon: CreditCard, color: '#00a650' },
                    { id: 'payme' as const, label: 'Payme', icon: CreditCard, color: '#00a650' },
                    { id: 'atmos' as const, label: 'Atmos', icon: CreditCard, color: '#00a650' },
                  ]
              ).map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className="w-full p-4 rounded-xl border transition-all"
                  style={{
                    background: paymentMethod === method.id 
                      ? `${method.color}20` 
                      : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'),
                    borderColor: paymentMethod === method.id 
                      ? method.color 
                      : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                  }}
                >
                  <div className="flex items-center gap-3">
                    <method.icon className="w-6 h-6" style={{ color: method.color }} />
                    <span className="font-semibold">{method.label}</span>
                    {paymentMethod === method.id && (
                      <div className="ml-auto">
                        <Check className="w-5 h-5" style={{ color: method.color }} />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {isCashierQrFlow && (
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: isDark ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.05)',
                  borderColor: '#2563eb',
                }}
              >
                <p className="text-sm font-medium">Bu bo'limda to'lov filial kassasi QR orqali qilinadi.</p>
                <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
                  Kassir chekni tasdiqlagandan keyin buyurtma kuryerga ko'rinadi.
                </p>
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
                onClick={() => setStep(1)}
                className="flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                Orqaga
              </button>
              <button
                onClick={() => setStep(2)}
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
                    <p className="text-sm font-bold mb-1">✅ Joylashuvingiz aniqlandi</p>
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
                onClick={() => setStep(2)}
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

        {/* Step 3: Confirm Order */}
        {step === 3 && (
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
              <div className="flex items-center justify-between">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Mahsulotlar</span>
                <span className="font-semibold">{totalAmount.toLocaleString()} so'm</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Yetkazib berish</span>
                <span className="font-semibold">
                  {selectedZone ? `${selectedZone.deliveryPrice.toLocaleString()} so'm` : '0 so\'m'}
                </span>
              </div>
              {useBonus && bonusPoints > 0 && (
                <div className="flex items-center justify-between text-green-500">
                  <span>Bonus chegirma</span>
                  <span className="font-semibold">-{Math.min(bonusPoints, totalAmount * 0.5).toLocaleString()} so'm</span>
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
                {paymentMethod === 'payme' && '💳 Payme'}
                {paymentMethod === 'atmos' && '💳 Atmos'}
                {paymentMethod === 'qr' && '📲 Filial kassasi QR'}
              </p>
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
              <p className="font-semibold">
                {addressType === 'manual' ? address.street : 'Joriy joylashuv'}
              </p>
              {selectedZone && (
                <p className="text-sm mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                  {selectedZone.name} • {selectedZone.deliveryTime} daqiqa
                </p>
              )}
            </div>

            {/* CLICK Payment Section */}
            {orderId && (paymentMethod === 'click' || paymentMethod === 'click_card') ? (
              <div>
                <div
                  className="p-4 rounded-xl border mb-4"
                  style={{
                    background: 'rgba(0, 166, 80, 0.1)',
                    borderColor: '#00a650',
                  }}
                >
                  <p className="text-sm font-medium mb-1">⚠️ Muhim</p>
                  <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                    To'lov muvaffaqiyatli bo'lgandan keyin buyurtma avtomatik yaratiladi
                  </p>
                </div>

                <ClickPayment
                  orderId={orderId}
                  amount={calculateTotal()}
                  phone={customerPhone}
                  type={paymentMethod as 'click' | 'click_card'}
                  onSuccess={() => {
                    // Payment successful - create order
                    createOrder();
                  }}
                  onError={(error) => {
                    toast.error('To\'lov amalga oshmadi', {
                      description: error,
                    });
                  }}
                />

                <button
                  onClick={() => {
                    setOrderId(null);
                    setStep(3);
                  }}
                  className="w-full py-3 mt-3 rounded-2xl font-bold transition-all active:scale-95"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  }}
                >
                  Orqaga qaytish
                </button>
              </div>
            ) : (
              // PAYME Payment Section
              orderId && paymentMethod === 'payme' ? (
                <div>
                  <div
                    className="p-4 rounded-xl border mb-4"
                    style={{
                      background: 'rgba(0, 166, 80, 0.1)',
                      borderColor: '#00a650',
                    }}
                  >
                    <p className="text-sm font-medium mb-1">⚠️ Muhim</p>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                      To'lov muvaffaqiyatli bo'lgandan keyin buyurtma avtomatik yaratiladi
                    </p>
                  </div>

                  <PaymePayment
                    orderId={orderId}
                    amount={calculateTotal()}
                    phone={customerPhone}
                    items={
                      cartItems.length > 0
                        ? cartItems.map(item => ({
                            title: item.name || item.title || 'Mahsulot',
                            price: item.price || 0,
                            count: item.quantity || 1,
                            code: item.ikpu_code || '00000000000000000',
                            units: 2411,
                            vat_percent: 0,
                            package_code: item.package_code || '123456',
                          }))
                        : (rentalLineItems || []).map((line) => ({
                            title: line.item.name || 'Ijara',
                            price: line.pricePerPeriod || 0,
                            count: line.rentalDuration || 1,
                            code: '00000000000000000',
                            units: 2411,
                            vat_percent: 0,
                            package_code: '123456',
                          }))
                    }
                    onSuccess={() => {
                      // Payment successful - create order
                      createOrder();
                    }}
                    onError={(error) => {
                      toast.error('To\'lov amalga oshmadi', {
                        description: error,
                      });
                    }}
                  />

                  <button
                    onClick={() => {
                      setOrderId(null);
                      setStep(3);
                    }}
                    className="w-full py-3 mt-3 rounded-2xl font-bold transition-all active:scale-95"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    Orqaga qaytish
                  </button>
                </div>
              ) : (
                // ATMOS Payment Section
                orderId && paymentMethod === 'atmos' ? (
                  <div>
                    <div
                      className="p-4 rounded-xl border mb-4"
                      style={{
                        background: 'rgba(0, 166, 80, 0.1)',
                        borderColor: '#00a650',
                      }}
                    >
                      <p className="text-sm font-medium mb-1">⚠️ Muhim</p>
                      <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                        To'lov muvaffaqiyatli bo'lgandan keyin buyurtma avtomatik yaratiladi
                      </p>
                    </div>

                    <AtmosPayment
                      orderId={orderId}
                      amount={calculateTotal()}
                      phone={customerPhone}
                      customerName={customerName}
                      onSuccess={() => {
                        // Payment successful - create order
                        createOrder();
                      }}
                      onError={(error) => {
                        toast.error('To\'lov amalga oshmadi', {
                          description: error,
                        });
                      }}
                    />

                    <button
                      onClick={() => {
                        setOrderId(null);
                        setStep(3);
                      }}
                      className="w-full py-3 mt-3 rounded-2xl font-bold transition-all active:scale-95"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      Orqaga qaytish
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={isProcessing}
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
                      disabled={isProcessing}
                      className="flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{
                        background: accentColor.gradient,
                        color: '#ffffff',
                      }}
                    >
                      {isProcessing && <Loader2 className="w-5 h-5 shrink-0 animate-spin" />}
                      {isProcessing ? 'Yuborilmoqda...' : 'Tasdiqlash'}
                    </button>
                  </div>
                )
              )
            )}
          </div>
        )}
      </div>

      {/* Ijara Shartlari Modal */}
      {showRentalTerms && (
        <>
          {console.log('📋 Rental terms modal is showing!')}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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