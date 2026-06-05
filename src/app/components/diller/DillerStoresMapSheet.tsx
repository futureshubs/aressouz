import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, Store, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import type { DillerData, DillerStore } from '../../utils/dillerData';
import { formatMoney } from '../../utils/dillerData';
import { getStoreStats } from '../../utils/dillerStoreStats';
import { addAppMapTileLayer, distanceKm } from '../../utils/leafletMapTiles';
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

function createStoreMarkerIcon(color: string, hasDebt: boolean) {
  const bg = hasDebt ? '#f59e0b' : color;
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
      ">🏪</div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  });
}

function createUserLocationIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:48px;height:48px;pointer-events:none;">
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

export function DillerStoresMapSheet({ open, data, onClose, onStoreClick }: Props) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const storeMarkersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const initialFitRef = useRef(false);
  const userFitOnceRef = useRef(false);
  const followMeRef = useRef(false);

  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
  const [followMe, setFollowMe] = useState(false);

  const mappedStores = useMemo(
    () => data.stores.filter(hasStoreCoords),
    [data.stores],
  );

  const missingCoordsCount = data.stores.length - mappedStores.length;

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

  useEffect(() => {
    if (!open) {
      setUserLoc(null);
      setLocStatus('idle');
      setFollowMe(false);
      followMeRef.current = false;
      initialFitRef.current = false;
      userFitOnceRef.current = false;
      return;
    }

    if (!navigator.geolocation) {
      setLocStatus('denied');
      return;
    }

    setLocStatus('loading');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.max(8, pos.coords.accuracy || 25),
        });
        setLocStatus('ok');
      },
      () => {
        setLocStatus('denied');
        toast.error('Joylashuv ruxsati yo‘q — sozlamalardan yoqing');
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [open]);

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
      map.remove();
      mapRef.current = null;
    };
  }, [open, isDark, fitAllPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!open || !map) return;

    storeMarkersRef.current.forEach((m) => m.remove());
    storeMarkersRef.current = [];

    for (const store of mappedStores) {
      const lat = store.lat!;
      const lng = store.lng!;
      const stats = getStoreStats(data, store.id);
      const hasDebt = stats.openDebt > 0;

      const distLine =
        userLoc != null
          ? `<div style="font-size:11px;margin-top:4px;color:#4285F4">Sizdan: ${distanceKm(userLoc.lat, userLoc.lng, lat, lng).toFixed(1)} km</div>`
          : '';

      const marker = L.marker([lat, lng], {
        icon: createStoreMarkerIcon(accentColor.color, hasDebt),
        zIndexOffset: 200,
      });

      const lines = [
        `<strong style="font-size:14px">${escapeHtml(store.name)}</strong>`,
        store.address
          ? `<div style="font-size:12px;color:#666;margin-top:4px">${escapeHtml(store.address)}</div>`
          : '',
        distLine,
        `<div style="font-size:12px;margin-top:6px">${escapeHtml(store.phone)} · ${escapeHtml(store.contactName)}</div>`,
        stats.saleCount > 0
          ? `<div style="font-size:11px;margin-top:4px;color:${accentColor.color}">${stats.saleCount} sotuv · ${formatMoney(stats.totalRevenue)}</div>`
          : '',
        hasDebt
          ? `<div style="font-size:11px;margin-top:2px;color:#f59e0b">Qarz: ${formatMoney(stats.openDebt)}</div>`
          : '',
        onStoreClick
          ? `<div style="font-size:11px;margin-top:8px;color:#3b82f6;font-weight:600">Batafsil →</div>`
          : '',
      ]
        .filter(Boolean)
        .join('');

      marker.bindPopup(`<div style="min-width:190px;cursor:pointer">${lines}</div>`, {
        maxWidth: 280,
        className: 'diller-store-popup',
      });

      if (onStoreClick) {
        marker.on('click', () => {
          onStoreClick(store);
          onClose();
        });
      }

      marker.addTo(map);
      storeMarkersRef.current.push(marker);
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [open, mappedStores, data, accentColor.color, onStoreClick, onClose, userLoc, fitAllPoints]);

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

    if (!userMarkerRef.current) {
      const m = L.marker(latLng, {
        icon: createUserLocationIcon(),
        zIndexOffset: 1000,
      });
      m.bindPopup(
        `<div style="min-width:160px"><strong>Siz</strong><div style="font-size:11px;color:#666;margin-top:4px">Joriy joylashuv</div></div>`,
      );
      m.addTo(map);
      userMarkerRef.current = m;
    } else {
      userMarkerRef.current.setLatLng(latLng);
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

    if (followMeRef.current) {
      map.panTo(latLng, { animate: true, duration: 0.35 });
    }

    if (userLoc && mappedStores.length > 0 && !userFitOnceRef.current) {
      fitAllPoints(map, userLoc);
      userFitOnceRef.current = true;
    }
  }, [open, userLoc, mappedStores.length, fitAllPoints]);

  const centerOnMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLoc) {
      toast.error('Joylashuv aniqlanmadi');
      return;
    }
    followMeRef.current = true;
    setFollowMe(true);
    map.flyTo([userLoc.lat, userLoc.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  };

  const showAll = () => {
    const map = mapRef.current;
    if (!map) return;
    followMeRef.current = false;
    setFollowMe(false);
    fitAllPoints(map, userLoc);
  };

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
          <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base">Do‘konlar xaritasi</h2>
          <p className="text-[10px] opacity-50 truncate">
            {mappedStores.length} do‘kon
            {userLoc ? ' · siz ko‘rinasiz' : locStatus === 'loading' ? ' · joylashuv…' : ''}
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
            title="Mening joylashuvim"
          >
            <Crosshair className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={showAll}
            className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center border active:scale-95 text-xs font-bold"
            style={{
              background: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.95)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              color: accentColor.color,
            }}
            aria-label="Hammasini ko‘rish"
            title="Hammasini ko‘rish"
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

      <div
        className="shrink-0 px-4 py-2.5 border-t flex flex-wrap gap-x-4 gap-y-1 text-[10px] opacity-75"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#4285F4] border border-white shadow-sm" />
          Siz
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: accentColor.color }} />
          Do‘kon
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500" />
          Qarz
        </span>
        <span>Marker → batafsil</span>
      </div>
    </div>
  );
}
