import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Bike,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Phone,
  QrCode,
  RefreshCw,
  Route,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { projectId } from '../../../utils/supabase/info';
import { buildCourierHeaders } from '../utils/requestAuth';
import CourierLiveMap from '../components/courier/CourierLiveMap';

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
  serviceRadiusKm?: number;
  completedDeliveries?: number;
  averageDeliveryTime?: number;
  totalEarnings?: number;
  balance?: number;
  lastDeliveryEarning?: number;
  bags?: CourierBag[];
  emptyBags?: CourierBag[];
  occupiedBags?: CourierBag[];
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
  status: string;
  courierWorkflowStatus?: string;
  distanceKm?: number;
  branchName?: string;
  branchAddress?: string;
  branchCoordinates?: { lat: number; lng: number } | null;
  customerLocation?: { lat: number; lng: number } | null;
  courierAssignedAt?: string;
  assignedBagId?: string | null;
  assignedBagNumber?: string | null;
  assignedBagCode?: string | null;
  preparedBagId?: string | null;
  preparedBagNumber?: string | null;
  preparedBagCode?: string | null;
};

const getAddressLine = (order: CourierOrder) =>
  order.customerAddress || 'Mijoz manzili kiritilmagan';

const buildProfileSignature = (profile: CourierProfile | null) =>
  JSON.stringify({
    id: profile?.id || null,
    name: profile?.name || '',
    phone: profile?.phone || '',
    status: profile?.status || '',
    branchId: profile?.branchId || '',
    branchName: profile?.branchName || '',
    activeOrderId: profile?.activeOrderId || null,
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
    orders.map((order) => ({
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

const buildActiveOrderSignature = (order: CourierOrder | null) =>
  order
    ? JSON.stringify({
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
      })
    : 'null';

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

export default function CourierDashboard() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827';
  const mutedTextColor = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(17, 24, 39, 0.7)';

  const [profile, setProfile] = useState<CourierProfile | null>(null);
  const [availableOrders, setAvailableOrders] = useState<CourierOrder[]>([]);
  const [activeOrder, setActiveOrder] = useState<CourierOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const lastProfileSignatureRef = useRef('');
  const lastAvailableOrdersSignatureRef = useRef('');
  const lastActiveOrderSignatureRef = useRef('');
  const dashboardRequestInFlightRef = useRef(false);
  const actionLoadingRef = useRef<string | null>(null);
  const [selectedBagId, setSelectedBagId] = useState('');
  const [bagQrOpen, setBagQrOpen] = useState(false);
  const bagQrScannerRef = useRef<Html5QrcodeScanner | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (dashboardRequestInFlightRef.current) {
      return;
    }

    dashboardRequestInFlightRef.current = true;
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const [meResult, availableResult, activeResult] = await Promise.allSettled([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier/me`, {
          headers: buildCourierHeaders(),
        }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier/orders/available`, {
          headers: buildCourierHeaders(),
        }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier/orders/active`, {
          headers: buildCourierHeaders(),
        }),
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
        const nextOrders = availableData.orders || [];
        const nextOrdersSignature = buildOrdersSignature(nextOrders);
        if (nextOrdersSignature !== lastAvailableOrdersSignatureRef.current) {
          lastAvailableOrdersSignatureRef.current = nextOrdersSignature;
          setAvailableOrders(nextOrders);
        }
      }
      if (activeResponse?.ok && activeData?.success) {
        const nextActiveOrder = activeData.order || null;
        const nextActiveOrderSignature = buildActiveOrderSignature(nextActiveOrder);
        if (nextActiveOrderSignature !== lastActiveOrderSignatureRef.current) {
          lastActiveOrderSignatureRef.current = nextActiveOrderSignature;
          setActiveOrder(nextActiveOrder);
        }
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

  const pushLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier/location`, {
            method: 'POST',
            headers: buildCourierHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
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
      if (actionLoadingRef.current) {
        return;
      }
      loadDashboard(true);
    }, 12000);

    const locationInterval = window.setInterval(() => {
      if (actionLoadingRef.current) {
        return;
      }
      pushLocation();
    }, 15000);

    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(locationInterval);
    };
  }, [loadDashboard, navigate, pushLocation]);

  const handleOrderAction = async (endpoint: string, successMessage: string, body?: Record<string, unknown>) => {
    setActionLoading(endpoint);
    actionLoadingRef.current = endpoint;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort('request_timeout'), 30000);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c${endpoint}`,
        {
          method: 'POST',
          headers: buildCourierHeaders({
            'Content-Type': 'application/json',
          }),
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        }
      );

      const result = await readPayload(response);
      if (!response.ok || !result.success) {
        if (response.status === 409 || response.status === 404 || response.status === 400) {
          await loadDashboard(true);
        }
        toast.error(result.error || 'Amal bajarilmadi');
        return;
      }

      toast.success(successMessage);
      await loadDashboard(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Server juda sekin javob berdi, buyurtma holatini tekshirib yana urinib ko\'ring');
        await loadDashboard(true);
      } else {
        console.error('Courier action error:', error);
        toast.error('Amalni bajarishda xatolik');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setActionLoading(null);
      actionLoadingRef.current = null;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('courierSession');
    navigate('/kuryer');
  };

  const openMap = (type: 'pickup' | 'customer') => {
    const location =
      type === 'pickup'
        ? activeOrder?.branchCoordinates
        : activeOrder?.customerLocation;

    if (!location) {
      toast.error('Lokatsiya topilmadi');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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

  const workflowStatus = activeOrder?.courierWorkflowStatus || activeOrder?.status || '';
  const canPickupOrder = Boolean(activeOrder) && !['picked_up', 'arrived', 'delivered'].includes(workflowStatus);
  const canMarkArrived = Boolean(activeOrder) && ['picked_up', 'arrived', 'delivering'].includes(workflowStatus);
  const canMarkDelivered = Boolean(activeOrder) && ['picked_up', 'arrived', 'delivering'].includes(workflowStatus);
  const emptyBags = profile?.emptyBags || [];
  const canAcceptOrders = emptyBags.length > 0;

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

    const scanner = new Html5QrcodeScanner(
      'courier-dash-bag-qr-reader',
      { fps: 8, qrbox: { width: 240, height: 240 } },
      false,
    );
    bagQrScannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        try {
          await scanner.clear();
        } catch {
          /* ignore */
        }
        bagQrScannerRef.current = null;
        setBagQrOpen(false);
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/courier/bags/verify-scan`,
            {
              method: 'POST',
              headers: buildCourierHeaders({
                'Content-Type': 'application/json',
              }),
              body: JSON.stringify({ scan: decodedText }),
            },
          );
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'So‘mka topilmadi');
          }
          setSelectedBagId(data.bag.id);
          toast.success(`So‘mka tanlandi: #${data.bag.bagNumber}`);
          await loadDashboard(true);
        } catch (error) {
          console.error('Courier bag QR error:', error);
          toast.error(error instanceof Error ? error.message : 'QR tekshiruvi xato');
        }
      },
      () => {},
    );

    return () => {
      scanner.clear().catch(() => {});
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? '#000000' : '#f9fafb', color: textColor }}>
        <div className="text-center">
          <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin" style={{ color: accentColor.color }} />
          <p>Kuryer panel yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{
        background: isDark ? '#000000' : '#f9fafb',
        color: textColor,
      }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
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
              <div className="text-sm font-semibold px-3 py-2 rounded-2xl" style={{ color: canAcceptOrders ? '#10b981' : '#ef4444' }}>
                {canAcceptOrders ? `${emptyBags.length} ta bo‘sh` : 'Bo‘sh so‘mka yo‘q'}
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
                          {bag.orderNumber || 'Aktiv order yo‘q'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <CourierLiveMap
          isDark={isDark}
          accentColor={accentColor}
          currentLocation={profile?.currentLocation}
          availableOrders={availableOrders}
          activeOrder={activeOrder}
        />

        {activeOrder && (
          <div
            className="rounded-3xl border p-5 md:p-6"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              borderColor: `${accentColor.color}33`,
            }}
          >
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-sm font-medium" style={{ color: accentColor.color }}>Mening aktiv buyurtmam</p>
                <h2 className="text-xl font-bold">{activeOrder.orderNumber || activeOrder.id}</h2>
                <p style={{ color: mutedTextColor }}>{getAddressLine(activeOrder)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm" style={{ color: mutedTextColor }}>Holat</p>
                <p className="font-semibold">{activeOrder.courierWorkflowStatus || activeOrder.status}</p>
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
                  <span>Yetkazish haqi: {(activeOrder.deliveryPrice || 0).toLocaleString('uz-UZ')} so'm</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4" style={{ color: accentColor.color }} />
                  <span>{new Date(activeOrder.createdAt).toLocaleString('uz-UZ')}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Wallet className="w-4 h-4" style={{ color: '#10b981' }} />
                  <span>Kuryer haqi: {Number(activeOrder.deliveryPrice || 0).toLocaleString('uz-UZ')} so'm</span>
                </div>
                {(activeOrder.assignedBagNumber || activeOrder.assignedBagCode) && (
                  <div className="flex items-center gap-2 mt-2">
                    <BriefcaseBusiness className="w-4 h-4" style={{ color: '#f59e0b' }} />
                    <span>
                      So‘mka: #{activeOrder.assignedBagNumber || '-'} {activeOrder.assignedBagCode ? `(${activeOrder.assignedBagCode})` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openMap('pickup')}
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
                onClick={() => openMap('customer')}
                className="px-4 py-3 rounded-2xl border flex items-center gap-2"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                }}
              >
                <MapPin className="w-4 h-4" />
                Mijoz lokatsiyasi
              </button>
              <button
                type="button"
                onClick={() => handleOrderAction(`/courier/orders/${activeOrder.id}/pickup`, 'Buyurtma kuryer tomonidan olindi')}
                disabled={!canPickupOrder || actionLoading === `/courier/orders/${activeOrder.id}/pickup`}
                className="px-4 py-3 rounded-2xl font-semibold disabled:cursor-not-allowed"
                style={{
                  background: canPickupOrder ? accentColor.gradient : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                  color: canPickupOrder ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'),
                }}
              >
                {actionLoading === `/courier/orders/${activeOrder.id}/pickup` ? 'Kutilmoqda...' : 'Buyurtmani oldim'}
              </button>
              <button
                type="button"
                onClick={() => handleOrderAction(`/courier/orders/${activeOrder.id}/arrived`, 'Mijoz manziliga yetib borildi')}
                disabled={!canMarkArrived || actionLoading === `/courier/orders/${activeOrder.id}/arrived`}
                className="px-4 py-3 rounded-2xl border disabled:cursor-not-allowed"
                style={{
                  background: canMarkArrived ? (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff') : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'),
                  borderColor: canMarkArrived ? accentColor.color : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                  color: canMarkArrived ? textColor : mutedTextColor,
                }}
              >
                {actionLoading === `/courier/orders/${activeOrder.id}/arrived`
                  ? 'Kutilmoqda...'
                  : canMarkArrived
                  ? 'Yetib keldim'
                  : 'Avval buyurtmani oling'}
              </button>
              <button
                type="button"
                onClick={() => handleOrderAction(`/courier/orders/${activeOrder.id}/delivered`, 'Buyurtma topshirildi')}
                disabled={!canMarkDelivered || actionLoading === `/courier/orders/${activeOrder.id}/delivered`}
                className="px-4 py-3 rounded-2xl border disabled:cursor-not-allowed"
                style={{
                  background: canMarkDelivered ? (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff') : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'),
                  borderColor: canMarkDelivered ? '#10b981' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
                  color: canMarkDelivered ? textColor : mutedTextColor,
                }}
              >
                {actionLoading === `/courier/orders/${activeOrder.id}/delivered`
                  ? 'Kutilmoqda...'
                  : canMarkDelivered
                  ? 'Topshirdim'
                  : 'Avval yetib boring'}
              </button>
            </div>
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
                Faqat 5 km ichidagi va hali olinmagan buyurtmalar ko‘rinadi
              </p>
            </div>
            <div className="text-sm font-semibold" style={{ color: accentColor.color }}>
              {availableOrders.length} ta buyurtma
            </div>
          </div>

          {availableOrders.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
              <Package className="w-10 h-10 mx-auto mb-3" style={{ color: accentColor.color }} />
              <p className="font-semibold mb-1">{canAcceptOrders ? 'Hozircha yaqin buyurtma yo‘q' : 'Bo‘sh so‘mka bo‘lmasa buyurtma ko‘rinmaydi'}</p>
              <p style={{ color: mutedTextColor }}>
                {canAcceptOrders ? 'Joylashuvingiz yangilanib turganiga ishonch hosil qiling' : 'Filial sizga bo‘sh so‘mka biriktirgandan keyin buyurtma ola olasiz'}
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
                      <p className="font-bold">{order.orderNumber || order.id}</p>
                      <p className="text-sm" style={{ color: mutedTextColor }}>{order.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{(order.distanceKm || 0).toFixed(1)} km</p>
                      <p className="text-xs" style={{ color: mutedTextColor }}>sizdan</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span>{order.customerPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span>{getAddressLine(order)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock3 className="w-4 h-4" style={{ color: accentColor.color }} />
                      <span>{new Date(order.createdAt).toLocaleString('uz-UZ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Wallet className="w-4 h-4" style={{ color: '#10b981' }} />
                      <span>Kuryer haqi: {Number(order.deliveryPrice || 0).toLocaleString('uz-UZ')} so'm</span>
                    </div>
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
                    onClick={() =>
                      handleOrderAction(
                        `/courier/orders/${order.id}/accept`,
                        'Buyurtma sizga biriktirildi',
                        order.preparedBagId
                          ? { bagId: order.preparedBagId }
                          : selectedBagId
                            ? { bagId: selectedBagId }
                            : undefined
                      )
                    }
                    disabled={
                      Boolean(activeOrder) ||
                      actionLoading !== null ||
                      !canAcceptOrders ||
                      (emptyBags.length > 1 && !selectedBagId && !order.preparedBagId)
                    }
                    className="w-full py-3 rounded-2xl font-semibold"
                    style={{
                      background:
                        Boolean(activeOrder) ||
                        !canAcceptOrders ||
                        (emptyBags.length > 1 && !selectedBagId && !order.preparedBagId)
                          ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)')
                          : accentColor.gradient,
                      color:
                        Boolean(activeOrder) ||
                        !canAcceptOrders ||
                        (emptyBags.length > 1 && !selectedBagId && !order.preparedBagId)
                          ? (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)')
                          : '#ffffff',
                    }}
                  >
                    {actionLoading === `/courier/orders/${order.id}/accept`
                      ? 'Kutilmoqda...'
                      : activeOrder
                      ? 'Avval aktiv buyurtmani yakunlang'
                      : !canAcceptOrders
                      ? 'Avval bo‘sh so‘mka kerak'
                      : emptyBags.length > 1 && !selectedBagId && !order.preparedBagId
                      ? 'So‘mka tanlang'
                      : 'Buyurtmani olish'}
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

        {bagQrOpen && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
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
