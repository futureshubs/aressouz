import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Crosshair,
  Flag,
  Loader2,
  MapPin,
  Navigation,
  RotateCcw,
  Play,
  SkipForward,
  Store,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerStore } from '../../utils/dillerData';
import { formatMoney } from '../../utils/dillerData';
import { getStoreStats } from '../../utils/dillerStoreStats';
import { addAppMapTileLayer, distanceKm } from '../../utils/leafletMapTiles';
import {
  fetchOsrmDrivingRoute,
  formatNavDistance,
  formatNavDuration,
  googleMapsDirectionsUrl,
  maneuverIconKind,
  maneuverTextUz,
  orderStoresNearestFirst,
  pickActiveStepIndex,
  remainingRouteMetrics,
  turnHintFromBearing,
  yandexMapsDirectionsUrl,
  type OsrmRouteResult,
} from '../../utils/dillerMapNavigation';
import { openExternalUrlSync } from '../../utils/openExternalUrl';
import { CHECKOUT_MAP_DEFAULT_CENTER } from '../CheckoutMapPickerModal';
import { dillerSheetShellClass } from './dillerMobileLayout';

type Props = {
  open: boolean;
  data: DillerData;
  onClose: () => void;
  onStoreClick?: (store: DillerStore) => void;
};

type UserLocation = {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
};

const DEFAULT_CENTER: [number, number] = [
  CHECKOUT_MAP_DEFAULT_CENTER.lat,
  CHECKOUT_MAP_DEFAULT_CENTER.lng,
];

function hasStoreCoords(store: DillerStore): boolean {
  const lat = store.lat;
  const lng = store.lng;
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createStoreMarkerIcon(color: string, hasDebt: boolean, label?: string) {
  const bg = hasDebt ? '#f59e0b' : color;
  const inner = label
    ? `<span style="font-size:13px;font-weight:800;color:#0f172a">${label}</span>`
    : '🏪';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: ${bg};
        border: 3px solid white;
        box-shadow: 0 6px 18px rgba(0,0,0,0.38);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      ">${inner}</div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  });
}

function createUserLocationIcon(heading: number | null) {
  const rot = heading != null && Number.isFinite(heading) ? heading : 0;
  const cone =
    heading != null
      ? `<div style="
          position:absolute;left:50%;top:50%;
          width:0;height:0;
          border-left:7px solid transparent;
          border-right:7px solid transparent;
          border-bottom:16px solid rgba(66,133,244,0.55);
          transform:translate(-50%,-85%) rotate(${rot}deg);
          transform-origin:50% 100%;
        "></div>`
      : '';
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:48px;height:48px;pointer-events:none;">
        ${cone}
        <div style="
          position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
          width:36px;height:36px;border-radius:50%;
          background:rgba(66,133,244,0.22);
        "></div>
        <div style="
          position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
          width:18px;height:18px;border-radius:50%;
          background:#4285F4;border:3px solid white;
          box-shadow:0 2px 10px rgba(0,0,0,0.4);
        "></div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -20],
  });
}

function ManeuverIcon({ kind, className = 'w-8 h-8' }: { kind: ReturnType<typeof maneuverIconKind>; className?: string }) {
  if (kind === 'left') return <ArrowLeft className={className} strokeWidth={2.5} />;
  if (kind === 'right') return <ArrowRight className={className} strokeWidth={2.5} />;
  if (kind === 'uturn') return <RotateCcw className={className} strokeWidth={2.5} />;
  if (kind === 'arrive') return <Flag className={className} strokeWidth={2.5} />;
  if (kind === 'depart') return <Navigation className={className} strokeWidth={2.5} />;
  return <ArrowUp className={className} strokeWidth={2.5} />;
}

export function DillerStoresMapSheet({ open, data, onClose, onStoreClick }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const storeMarkersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeFetchRef = useRef<AbortController | null>(null);
  const initialFitRef = useRef(false);
  const userFitOnceRef = useRef(false);
  const followMeRef = useRef(false);

  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
  const [followMe, setFollowMe] = useState(true);
  const [navStarted, setNavStarted] = useState(false);
  const [navTarget, setNavTarget] = useState<DillerStore | null>(null);
  const [route, setRoute] = useState<OsrmRouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const mappedStores = useMemo(
    () => data.stores.filter(hasStoreCoords),
    [data.stores],
  );

  const tourOrder = useMemo(() => {
    if (!navStarted || !userLoc) return mappedStores;
    return orderStoresNearestFirst(userLoc, mappedStores);
  }, [mappedStores, userLoc, navStarted]);

  const tourIndex = navTarget ? tourOrder.findIndex((s) => s.id === navTarget.id) : -1;
  const nextTourStore =
    tourIndex >= 0 && tourIndex < tourOrder.length - 1 ? tourOrder[tourIndex + 1] : null;

  const missingCoordsCount = data.stores.length - mappedStores.length;

  const activeStepIdx = useMemo(() => {
    if (!userLoc || !route?.steps.length) return 0;
    return pickActiveStepIndex(userLoc, route.steps);
  }, [userLoc, route?.steps]);

  const activeStep = route?.steps[activeStepIdx] ?? null;
  const nextStep = route?.steps[activeStepIdx + 1] ?? null;

  const remaining = useMemo(() => {
    if (!userLoc || !route) return null;
    return remainingRouteMetrics(
      userLoc,
      route.steps,
      activeStepIdx,
      route.distanceM,
      route.durationS,
    );
  }, [userLoc, route, activeStepIdx]);

  const fitAllPoints = useCallback(
    (map: L.Map, user?: UserLocation | null) => {
      const bounds = L.latLngBounds([]);
      let has = false;
      for (const s of mappedStores) {
        bounds.extend([s.lat!, s.lng!]);
        has = true;
      }
      if (user) {
        bounds.extend([user.lat, user.lng]);
        has = true;
      }
      if (!has) {
        map.setView(DEFAULT_CENTER, 11, { animate: false });
        return;
      }
      if (mappedStores.length === 1 && !user) {
        const s = mappedStores[0];
        map.setView([s.lat!, s.lng!], 15, { animate: false });
        return;
      }
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16, animate: false });
    },
    [mappedStores],
  );

  const startNavigation = useCallback((store: DillerStore) => {
    setNavTarget(store);
    followMeRef.current = true;
    setFollowMe(true);
  }, []);

  const handleStartTour = useCallback(() => {
    if (mappedStores.length === 0) return;
    if (!userLoc) {
      toast.error('Joylashuv aniqlanmadi — GPS yoqing');
      return;
    }
    setNavStarted(true);
    const nearest = orderStoresNearestFirst(userLoc, mappedStores)[0];
    if (nearest) startNavigation(nearest);
  }, [mappedStores, userLoc, startNavigation]);

  const stopNavigation = useCallback(() => {
    setNavStarted(false);
    setNavTarget(null);
    setRoute(null);
    followMeRef.current = false;
    setFollowMe(false);
    routeFetchRef.current?.abort();
    routeFetchRef.current = null;
    const map = mapRef.current;
    if (map) fitAllPoints(map, userLoc);
  }, [fitAllPoints, userLoc]);

  useEffect(() => {
    if (!open) {
      setUserLoc(null);
      setLocStatus('idle');
      setFollowMe(true);
      followMeRef.current = true;
      setNavStarted(false);
      setNavTarget(null);
      setRoute(null);
      setRouteLoading(false);
      initialFitRef.current = false;
      userFitOnceRef.current = false;
      routeFetchRef.current?.abort();
      routeFetchRef.current = null;
      return;
    }

    if (!navigator.geolocation) {
      setLocStatus('denied');
      return;
    }

    setLocStatus('loading');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const heading =
          typeof pos.coords.heading === 'number' && Number.isFinite(pos.coords.heading)
            ? pos.coords.heading
            : null;
        setUserLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.max(8, pos.coords.accuracy || 25),
          heading,
        });
        setLocStatus('ok');
      },
      () => {
        setLocStatus('denied');
        toast.error('Joylashuv ruxsati yo‘q — sozlamalardan yoqing');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [open]);

  useEffect(() => {
    if (!open || !navStarted || !navTarget || !userLoc) {
      setRoute(null);
      return;
    }

    routeFetchRef.current?.abort();
    const ac = new AbortController();
    routeFetchRef.current = ac;
    setRouteLoading(true);

    fetchOsrmDrivingRoute(userLoc, { lat: navTarget.lat!, lng: navTarget.lng! }, ac.signal)
      .then((result) => {
        if (!ac.signal.aborted) setRoute(result);
      })
      .finally(() => {
        if (!ac.signal.aborted) setRouteLoading(false);
      });

    return () => ac.abort();
  }, [open, navStarted, navTarget?.id, userLoc?.lat, userLoc?.lng]);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const el = containerRef.current;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, 11);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    addAppMapTileLayer(map, isDark);

    map.on('dragstart', () => {
      followMeRef.current = false;
      setFollowMe(false);
    });

    mapRef.current = map;

    const resize = () => map.invalidateSize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(resize);
    const t = window.setTimeout(() => {
      map.invalidateSize();
      if (!initialFitRef.current) {
        fitAllPoints(map, null);
        initialFitRef.current = true;
      }
    }, 180);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', resize);
      storeMarkersRef.current.forEach((m) => m.remove());
      storeMarkersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      accuracyCircleRef.current?.remove();
      accuracyCircleRef.current = null;
      routePolylineRef.current?.remove();
      routePolylineRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [open, isDark, fitAllPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!open || !map) return;

    routePolylineRef.current?.remove();
    routePolylineRef.current = null;

    if (route?.line && route.line.length >= 2 && navStarted) {
      routePolylineRef.current = L.polyline(route.line, {
        color: '#4285F4',
        weight: 7,
        opacity: 0.88,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);

      if (navTarget && userLoc) {
        const bounds = routePolylineRef.current.getBounds();
        bounds.extend([userLoc.lat, userLoc.lng]);
        bounds.extend([navTarget.lat!, navTarget.lng!]);
        map.fitBounds(bounds, { padding: [100, 48], maxZoom: 17, animate: true });
      }
    }
  }, [open, route, navTarget, userLoc]);

  useEffect(() => {
    const map = mapRef.current;
    if (!open || !map) return;

    storeMarkersRef.current.forEach((m) => m.remove());
    storeMarkersRef.current = [];

    for (let i = 0; i < mappedStores.length; i++) {
      const store = mappedStores[i];
      const lat = store.lat!;
      const lng = store.lng!;
      const stats = getStoreStats(data, store.id);
      const hasDebt = stats.openDebt > 0;
      const tourNum = navStarted ? tourOrder.findIndex((s) => s.id === store.id) : -1;
      const orderLabel = tourNum >= 0 ? String(tourNum + 1) : undefined;
      const isTarget = navStarted && navTarget?.id === store.id;

      const distLine =
        userLoc != null
          ? `<div style="font-size:11px;margin-top:4px;color:#4285F4">Sizdan: ${distanceKm(userLoc.lat, userLoc.lng, lat, lng).toFixed(1)} km</div>`
          : '';

      const marker = L.marker([lat, lng], {
        icon: createStoreMarkerIcon(
          isTarget ? '#4285F4' : accentColor.color,
          hasDebt,
          orderLabel,
        ),
        zIndexOffset: isTarget ? 400 : 200,
      });

      const lines = [
        `<strong style="font-size:14px">${escapeHtml(store.name)}</strong>`,
        navStarted && tourNum >= 0
          ? `<div style="font-size:11px;color:#4285F4;margin-top:2px">Marshrut: ${tourNum + 1}-do‘kon</div>`
          : '',
        store.address
          ? `<div style="font-size:12px;color:#666;margin-top:4px">${escapeHtml(store.address)}</div>`
          : '<div style="font-size:12px;color:#999;margin-top:4px">Manzil kiritilmagan</div>',
        distLine,
        `<div style="font-size:12px;margin-top:6px">${escapeHtml(store.phone)} · ${escapeHtml(store.contactName)}</div>`,
        stats.saleCount > 0
          ? `<div style="font-size:11px;margin-top:4px;color:${accentColor.color}">${stats.saleCount} sotuv · ${formatMoney(stats.totalRevenue)}</div>`
          : '',
        hasDebt
          ? `<div style="font-size:11px;margin-top:2px;color:#f59e0b">Qarz: ${formatMoney(stats.openDebt)}</div>`
          : '',
        navStarted
          ? `<div style="font-size:11px;margin-top:8px;color:#3b82f6;font-weight:600">Yo‘nalish →</div>`
          : `<div style="font-size:11px;margin-top:8px;color:#64748b">Boshlash tugmasini bosing</div>`,
      ]
        .filter(Boolean)
        .join('');

      marker.bindPopup(`<div style="min-width:190px">${lines}</div>`, {
        maxWidth: 280,
        className: 'diller-store-popup',
      });

      marker.on('click', () => {
        if (navStarted) {
          startNavigation(store);
        } else {
          marker.openPopup();
        }
      });
      marker.addTo(map);
      storeMarkersRef.current.push(marker);
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [open, mappedStores, data, accentColor.color, userLoc, navTarget, navStarted, tourOrder, startNavigation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!open || !map || !userLoc) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      accuracyCircleRef.current?.remove();
      accuracyCircleRef.current = null;
      return;
    }

    const latLng: [number, number] = [userLoc.lat, userLoc.lng];
    const icon = createUserLocationIcon(userLoc.heading);

    if (!userMarkerRef.current) {
      const m = L.marker(latLng, { icon, zIndexOffset: 1000 });
      m.addTo(map);
      userMarkerRef.current = m;
    } else {
      userMarkerRef.current.setLatLng(latLng);
      userMarkerRef.current.setIcon(icon);
    }

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(latLng, {
        radius: userLoc.accuracy,
        color: '#4285F4',
        weight: 1,
        fillColor: '#4285F4',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng(latLng);
      accuracyCircleRef.current.setRadius(userLoc.accuracy);
    }

    if (followMeRef.current && navStarted && navTarget) {
      map.panTo(latLng, { animate: true, duration: 0.35 });
    }

    if (userLoc && mappedStores.length > 0 && !userFitOnceRef.current && !navStarted) {
      fitAllPoints(map, userLoc);
      userFitOnceRef.current = true;
    }
  }, [open, userLoc, mappedStores.length, fitAllPoints, navStarted, navTarget]);

  const centerOnMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLoc) {
      toast.error('Joylashuv aniqlanmadi');
      return;
    }
    followMeRef.current = true;
    setFollowMe(true);
    map.flyTo([userLoc.lat, userLoc.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
  };

  const showAll = () => {
    const map = mapRef.current;
    if (!map) return;
    followMeRef.current = false;
    setFollowMe(false);
    fitAllPoints(map, userLoc);
  };

  const goNextStore = () => {
    if (!nextTourStore) {
      toast.info('Marshrutdagi oxirgi do‘kon');
      return;
    }
    startNavigation(nextTourStore);
  };

  const openYandex = () => {
    if (!userLoc || !navTarget?.lat || !navTarget?.lng) {
      toast.error('Joylashuv yoki manzil yo‘q');
      return;
    }
    openExternalUrlSync(
      yandexMapsDirectionsUrl(userLoc, { lat: navTarget.lat, lng: navTarget.lng }),
    );
  };

  const instructionText = activeStep
    ? maneuverTextUz(activeStep)
    : navTarget && userLoc
      ? turnHintFromBearing(userLoc.heading, userLoc, {
          lat: navTarget.lat!,
          lng: navTarget.lng!,
        })
      : 'Do‘konni tanlang';

  const instructionKind = activeStep ? maneuverIconKind(activeStep) : 'straight';
  const stepDistance = activeStep?.distance ?? remaining?.distanceM ?? 0;

  if (!open) return null;

  return (
    <div
      className={dillerSheetShellClass}
      style={{ background: isDark ? '#0a0a0a' : '#f1f5f9', zIndex: 114 }}
    >
      <header
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor.color}22` }}
        >
          <Navigation className="w-5 h-5" style={{ color: accentColor.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base">Navigatsiya</h2>
          <p className="text-[10px] opacity-50 truncate">
            {mappedStores.length} do‘kon
            {navStarted && tourOrder.length > 1 ? ` · ${tourOrder.length} nuqtali marshrut` : !navStarted ? ' · belgi ustiga bosing' : ''}
            {missingCoordsCount > 0 ? ` · ${missingCoordsCount} GPS yo‘q` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl shrink-0 opacity-70"
          aria-label="Yopish"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
          <button
            type="button"
            onClick={centerOnMe}
            className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center border active:scale-95 transition-transform ${
              followMe ? 'ring-2 ring-blue-400' : ''
            }`}
            style={{
              background: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.95)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              color: '#4285F4',
            }}
            aria-label="Mening joylashuvim"
          >
            <Crosshair className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={showAll}
            className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center border active:scale-95"
            style={{
              background: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.95)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              color: accentColor.color,
            }}
            aria-label="Hammasini ko‘rish"
          >
            <Store className="w-5 h-5" />
          </button>
        </div>

        {mappedStores.length === 0 ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center pointer-events-none"
            style={{ background: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)' }}
          >
            <Store className="w-12 h-12 opacity-40 mb-3" />
            <p className="text-sm font-semibold">Do‘konlar uchun GPS kerak</p>
            <p className="text-xs opacity-60 mt-1 max-w-xs">
              Do‘kon qo‘shishda «GPS» yoki «Xarita» orqali joy belgilang
            </p>
          </div>
        ) : null}
      </div>

      {navStarted && navTarget ? (
        <div
          className="shrink-0 border-t shadow-[0_-8px_32px_rgba(0,0,0,0.18)]"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            background: isDark ? 'rgba(12,12,12,0.98)' : 'rgba(255,255,255,0.98)',
          }}
        >
          <div className="px-4 pt-3 pb-2 flex items-start gap-3">
            <div
              className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-[#4285F4]"
              style={{ background: isDark ? 'rgba(66,133,244,0.15)' : 'rgba(66,133,244,0.12)' }}
            >
              {routeLoading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <ManeuverIcon kind={instructionKind} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-black leading-tight">{instructionText}</div>
              <div className="text-xs opacity-60 mt-0.5 flex flex-wrap gap-x-2">
                {activeStep?.name ? <span>{activeStep.name}</span> : null}
                {stepDistance > 0 ? (
                  <span className="text-[#4285F4] font-bold">{formatNavDistance(stepDistance)}</span>
                ) : null}
              </div>
              {nextStep && nextStep.maneuver.type !== 'arrive' ? (
                <div className="text-[10px] opacity-45 mt-1 truncate">
                  Keyin: {maneuverTextUz(nextStep)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="px-4 pb-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{navTarget.name}</div>
                <div className="text-[10px] opacity-50 truncate">
                  {tourIndex >= 0 ? `${tourIndex + 1}/${tourOrder.length} · ` : ''}
                  {navTarget.address || 'Manzil'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-black text-[#4285F4]">
                  {remaining ? formatNavDistance(remaining.distanceM) : '—'}
                </div>
                <div className="text-[10px] opacity-50">
                  {remaining ? formatNavDuration(remaining.durationS) : ''}
                </div>
              </div>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0' }}
            >
              <div
                className="h-full rounded-full bg-[#4285F4] transition-all duration-500"
                style={{
                  width: route
                    ? `${Math.max(4, 100 - ((remaining?.distanceM ?? route.distanceM) / route.distanceM) * 100)}%`
                    : '8%',
                }}
              />
            </div>
            {nextTourStore ? (
              <button
                type="button"
                onClick={goNextStore}
                className="mt-2 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }}
              >
                <span className="opacity-60">Keyingi do‘kon</span>
                <span className="font-bold truncate flex items-center gap-1">
                  {nextTourStore.name}
                  <span className="text-[#4285F4] font-mono">
                    {userLoc
                      ? formatNavDistance(
                          distanceKm(userLoc.lat, userLoc.lng, nextTourStore.lat!, nextTourStore.lng!) *
                            1000,
                        )
                      : ''}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </span>
              </button>
            ) : null}
          </div>

          <div className="px-4 pb-3 flex gap-2">
            <button
              type="button"
              onClick={stopNavigation}
              className="py-2.5 px-3 rounded-xl text-xs font-bold border"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
            >
              To‘xtat
            </button>
            <button
              type="button"
              onClick={goNextStore}
              disabled={!nextTourStore}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color: accentColor.color,
              }}
            >
              <SkipForward className="w-4 h-4" />
              Keyingi
            </button>
            <button
              type="button"
              onClick={openYandex}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FC3F1D] flex items-center justify-center gap-1.5"
            >
              <MapPin className="w-4 h-4" />
              Yandex
            </button>
            {onStoreClick ? (
              <button
                type="button"
                onClick={() => {
                  onStoreClick(navTarget);
                  onClose();
                }}
                className="py-2.5 px-3 rounded-xl text-xs font-bold border"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
              >
                Batafsil
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className="shrink-0 px-4 py-3 border-t"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
        >
          <p className="text-xs opacity-60 text-center mb-3">
            {locStatus === 'loading'
              ? 'Joylashuv aniqlanmoqda…'
              : 'Belgi ustiga bosing — manzil va ma’lumot ko‘rinadi'}
          </p>
          <button
            type="button"
            onClick={handleStartTour}
            disabled={locStatus !== 'ok' || mappedStores.length === 0}
            className="w-full py-3.5 rounded-xl font-bold text-slate-900 flex items-center justify-center gap-2 disabled:opacity-45 active:scale-[0.98]"
            style={{ background: accentColor.gradient }}
          >
            {locStatus === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
            Boshlash
          </button>
          <p className="text-[10px] opacity-45 text-center mt-2">
            Eng yaqin do‘kon avtomatik tanlanadi
          </p>
        </div>
      )}
    </div>
  );
}
