import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL, DEV_API_BASE_URL } from '../../../utils/supabase/info';
import { getStoredCourierToken } from '../utils/requestAuth';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import CourierLiveMap, { type CourierMapRoutePreview } from '../components/courier/CourierLiveMap';
import { COURIER_MAP_ROUTE_STORAGE_KEY } from '../utils/courierMapRouteSession';

const readPayload = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
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

/**
 * Kuryer jonli xaritasi — alohida sahifa; dashboardda ko‘rinmaydi.
 */
export default function CourierMapPage() {
  const navigate = useNavigate();
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ffffff' : '#111827';
  const muted = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(17,24,39,0.7)';

  const [profile, setProfile] = useState<any>(null);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [routePreview, setRoutePreview] = useState<CourierMapRoutePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const loadRouteFromStorage = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(COURIER_MAP_ROUTE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CourierMapRoutePreview;
      if (
        parsed &&
        Array.isArray(parsed.start) &&
        Array.isArray(parsed.end) &&
        parsed.start.length === 2 &&
        parsed.end.length === 2
      ) {
        setRoutePreview(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const clearRoute = useCallback(() => {
    setRoutePreview(null);
    try {
      sessionStorage.removeItem(COURIER_MAP_ROUTE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const pushLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const courierToken = getStoredCourierToken();
          if (!courierToken) return;
          const tokenQuery = `?token=${encodeURIComponent(courierToken)}`;
          const baseUrl =
            typeof window !== 'undefined' && window.location.hostname === 'localhost'
              ? DEV_API_BASE_URL
              : API_BASE_URL;
          const form = new URLSearchParams();
          form.set('latitude', String(position.coords.latitude));
          form.set('longitude', String(position.coords.longitude));
          await fetch(`${baseUrl}/courier/location${tokenQuery}`, {
            method: 'POST',
            headers: { 'X-Courier-Token': courierToken },
            body: form,
          });
        } catch (e) {
          console.warn('courier location:', e);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    );
  }, []);

  const loadData = useCallback(
    async (silent = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!silent) setLoading(true);

      const courierToken = getStoredCourierToken();
      if (!courierToken) {
        localStorage.removeItem('courierSession');
        navigate('/kuryer');
        inFlightRef.current = false;
        if (!silent) setLoading(false);
        return;
      }

      const tokenQuery = `?token=${encodeURIComponent(courierToken)}`;
      const baseUrl =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? DEV_API_BASE_URL
          : API_BASE_URL;

      try {
        const [meResult, avResult, acResult] = await Promise.allSettled([
          fetchWithRetry(`${baseUrl}/courier/me${tokenQuery}`, {}),
          fetchWithRetry(`${baseUrl}/courier/orders/available${tokenQuery}`, {}),
          fetchWithRetry(`${baseUrl}/courier/orders/active${tokenQuery}`, {}),
        ]);

        const meRes = meResult.status === 'fulfilled' ? meResult.value : null;
        if (meRes && (meRes.status === 401 || meRes.status === 403)) {
          localStorage.removeItem('courierSession');
          toast.error('Sessiya tugagan');
          navigate('/kuryer');
          return;
        }

        const meData = meRes ? await readPayload(meRes) : null;
        if (meRes?.ok && meData?.success) {
          setProfile(meData.courier || null);
        }

        const avRes = avResult.status === 'fulfilled' ? avResult.value : null;
        const avData = avRes ? await readPayload(avRes) : null;
        if (avRes?.ok && avData?.success) {
          setAvailableOrders(Array.isArray(avData.orders) ? avData.orders : []);
        }

        const acRes = acResult.status === 'fulfilled' ? acResult.value : null;
        const acData = acRes ? await readPayload(acRes) : null;
        if (acRes?.ok && acData?.success) {
          const nextList = Array.isArray(acData.orders)
            ? acData.orders
            : acData.order
              ? [acData.order]
              : [];
          setActiveOrders(nextList);
        }
      } catch (e) {
        console.error('Courier map load:', e);
        if (!silent) toast.error('Xarita ma’lumotlari yuklanmadi');
      } finally {
        inFlightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [navigate],
  );

  useVisibilityRefetch(() => {
    void loadData(true);
  });

  useEffect(() => {
    const rawSession = localStorage.getItem('courierSession');
    if (!rawSession) {
      navigate('/kuryer');
      return;
    }
    loadRouteFromStorage();
    void loadData(false);
    pushLocation();

    const t1 = window.setInterval(() => void loadData(true), 12000);
    const t2 = window.setInterval(() => pushLocation(), 15000);
    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, [loadData, loadRouteFromStorage, navigate, pushLocation]);

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden p-3 md:p-6"
      style={{ background: isDark ? '#000000' : '#f3f4f6', color: textColor }}
    >
      <header
        className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 md:mb-4"
        style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/kuryer/dashboard')}
            className="flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition active:scale-[0.98]"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: textColor,
            }}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Panel
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold md:text-xl">Kuryer xaritasi</h1>
            <p className="truncate text-xs md:text-sm" style={{ color: muted }}>
              Jonli buyurtmalar va lokatsiya
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            pushLocation();
            void loadData(true);
          }}
          className="flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
            color: accentColor.color,
          }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
        <CourierLiveMap
          isDark={isDark}
          accentColor={accentColor}
          currentLocation={profile?.currentLocation}
          availableOrders={availableOrders}
          activeOrders={activeOrders}
          routePreview={routePreview}
          onClearRoute={clearRoute}
          layout="desktop"
          pageMode
        />
      </div>
    </div>
  );
}
