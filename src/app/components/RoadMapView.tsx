import { memo, useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Search,
  ThumbsUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { addAppMapTileLayer } from '../utils/leafletMapTiles';
import {
  fetchOsrmDrivingRoute,
  formatNavDistance,
  formatNavDuration,
  type OsrmRouteResult,
} from '../utils/dillerMapNavigation';
import { reverseGeocodeDisplayLine } from '../utils/geolocationDetect';
import {
  ROAD_ALERT_META,
  ROAD_ALERT_TYPES,
  type RoadAlert,
  type RoadAlertType,
} from '../data/roadAlerts';
import {
  confirmRoadAlert,
  createRoadAlert,
  fetchRoadAlerts,
} from '../utils/roadAlertsApi';

const DEFAULT_CENTER: [number, number] = [41.311151, 69.279737];
const NOMINATIM_HEADERS = { 'User-Agent': 'AresSouz/1.0 (road-map)' } as const;

type UserLocation = {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
};

type SearchHit = { lat: string; lon: string; display_name: string };

type LatLng = { lat: number; lng: number };

interface RoadMapViewProps {
  onClose: () => void;
  platform: Platform;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createUserIcon(heading: number | null): L.DivIcon {
  const rot = heading != null && Number.isFinite(heading) ? `rotate(${heading}deg)` : '';
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#4285F4;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);transform:${rot}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function createAlertIcon(type: RoadAlertType): L.DivIcon {
  const meta = ROAD_ALERT_META[type];
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${meta.color};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:16px">${meta.emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function createDestIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#ef4444;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,.35)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

async function nominatimSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=json` +
    `&q=${encodeURIComponent(q)}&limit=6&countrycodes=uz&accept-language=uz,ru,en`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  const data = (await res.json()) as SearchHit[];
  return Array.isArray(data) ? data : [];
}

function timeAgoUz(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daq oldin`;
  const h = Math.floor(min / 60);
  return `${h} soat oldin`;
}

export const RoadMapView = memo(function RoadMapView({ onClose, platform }: RoadMapViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const alertMarkersRef = useRef<L.Marker[]>([]);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routeFetchRef = useRef<AbortController | null>(null);
  const followMeRef = useRef(true);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [destLabel, setDestLabel] = useState('');
  const [route, setRoute] = useState<OsrmRouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addingType, setAddingType] = useState<RoadAlertType | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);

  const loadAlerts = useCallback(async (lat: number, lng: number, silent = false) => {
    if (!silent) setAlertsLoading(true);
    try {
      const list = await fetchRoadAlerts(lat, lng, 80);
      setAlerts(list);
    } catch {
      if (!silent) toast.error('Belgilar yuklanmadi');
    } finally {
      if (!silent) setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
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
        toast.error('Joylashuv ruxsati yo‘q');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!userLoc) return;
    void loadAlerts(userLoc.lat, userLoc.lng, true);
    const t = window.setInterval(() => {
      void loadAlerts(userLoc.lat, userLoc.lng, true);
    }, 45_000);
    return () => window.clearInterval(t);
  }, [userLoc?.lat, userLoc?.lng, loadAlerts]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, 12);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    addAppMapTileLayer(map, isDark);

    map.on('click', (e) => {
      if (showAddSheet) return;
      const { lat, lng } = e.latlng;
      setDestination({ lat, lng });
      void reverseGeocodeDisplayLine(lat, lng).then((line) => {
        if (line) setDestLabel(line);
        else setDestLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      });
    });

    map.on('dragstart', () => {
      followMeRef.current = false;
    });

    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isDark, showAddSheet]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLoc) return;

    const latLng: L.LatLngExpression = [userLoc.lat, userLoc.lng];
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(latLng, {
        icon: createUserIcon(userLoc.heading),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(latLng);
      userMarkerRef.current.setIcon(createUserIcon(userLoc.heading));
    }

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(latLng, {
        radius: userLoc.accuracy,
        color: '#4285F4',
        weight: 1,
        fillColor: '#4285F4',
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng(latLng);
      accuracyCircleRef.current.setRadius(userLoc.accuracy);
    }

    if (followMeRef.current) {
      map.panTo(latLng, { animate: true, duration: 0.35 });
    }
  }, [userLoc]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    destMarkerRef.current?.remove();
    destMarkerRef.current = null;

    if (destination) {
      destMarkerRef.current = L.marker([destination.lat, destination.lng], {
        icon: createDestIcon(),
        zIndexOffset: 900,
      }).addTo(map);
    }
  }, [destination]);

  useEffect(() => {
    if (!destination || !userLoc) {
      setRoute(null);
      return;
    }

    routeFetchRef.current?.abort();
    const ac = new AbortController();
    routeFetchRef.current = ac;
    setRouteLoading(true);

    fetchOsrmDrivingRoute(userLoc, destination, ac.signal)
      .then((result) => {
        if (!ac.signal.aborted) setRoute(result);
      })
      .finally(() => {
        if (!ac.signal.aborted) setRouteLoading(false);
      });

    return () => ac.abort();
  }, [destination?.lat, destination?.lng, userLoc?.lat, userLoc?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routePolylineRef.current?.remove();
    routePolylineRef.current = null;

    if (route?.line && route.line.length >= 2) {
      routePolylineRef.current = L.polyline(route.line, {
        color: '#4285F4',
        weight: 7,
        opacity: 0.88,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);

      if (destination && userLoc) {
        const bounds = routePolylineRef.current.getBounds();
        bounds.extend([userLoc.lat, userLoc.lng]);
        bounds.extend([destination.lat, destination.lng]);
        map.fitBounds(bounds, { padding: [80, 40], maxZoom: 16, animate: true });
        followMeRef.current = false;
      }
    }
  }, [route, destination, userLoc]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    alertMarkersRef.current.forEach((m) => m.remove());
    alertMarkersRef.current = [];

    for (const alert of alerts) {
      const meta = ROAD_ALERT_META[alert.type];
      const marker = L.marker([alert.lat, alert.lng], {
        icon: createAlertIcon(alert.type),
        zIndexOffset: 500,
      });

      const popup = [
        `<strong style="font-size:14px">${meta.emoji} ${escapeHtml(meta.label)}</strong>`,
        alert.note ? `<div style="font-size:12px;margin-top:4px;color:#666">${escapeHtml(alert.note)}</div>` : '',
        `<div style="font-size:11px;margin-top:6px;color:#888">${timeAgoUz(alert.createdAt)} · ${alert.reports} ta tasdiq</div>`,
        `<button type="button" data-confirm="${escapeHtml(alert.id)}" style="margin-top:8px;width:100%;padding:6px 10px;border:none;border-radius:8px;background:${meta.color};color:#fff;font-weight:600;font-size:12px;cursor:pointer">👍 Tasdiqlash</button>`,
      ]
        .filter(Boolean)
        .join('');

      marker.bindPopup(`<div style="min-width:180px">${popup}</div>`, { maxWidth: 260 });

      marker.on('popupopen', () => {
        const el = marker.getPopup()?.getElement();
        const btn = el?.querySelector('[data-confirm]') as HTMLButtonElement | null;
        if (!btn) return;
        btn.onclick = async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            await confirmRoadAlert(alert.id);
            toast.success('Tasdiqlandi');
            if (userLoc) void loadAlerts(userLoc.lat, userLoc.lng, true);
            marker.closePopup();
          } catch {
            toast.error('Tasdiqlashda xatolik');
          }
        };
      });

      marker.addTo(map);
      alertMarkersRef.current.push(marker);
    }
  }, [alerts, userLoc, loadAlerts]);

  useEffect(() => {
    if (!searchOpen || searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchBusy(true);
      try {
        setSearchHits(await nominatimSearch(searchQ));
      } catch {
        setSearchHits([]);
      } finally {
        setSearchBusy(false);
      }
    }, 450);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQ, searchOpen]);

  const centerOnMe = () => {
    const map = mapRef.current;
    if (!map || !userLoc) {
      toast.error('Joylashuv aniqlanmadi');
      return;
    }
    followMeRef.current = true;
    map.flyTo([userLoc.lat, userLoc.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
  };

  const flyToHit = (hit: SearchHit) => {
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setDestination({ lat, lng });
    setDestLabel(hit.display_name);
    mapRef.current?.flyTo([lat, lng], 16, { animate: true });
    setSearchOpen(false);
    followMeRef.current = false;
  };

  const openYandex = () => {
    if (!destination) return;
    const from = userLoc ? `${userLoc.lat},${userLoc.lng}` : '';
    const to = `${destination.lat},${destination.lng}`;
    const url = from
      ? `https://yandex.com/maps/?rtext=${from}~${to}&rtt=auto`
      : `https://yandex.com/maps/?pt=${destination.lng},${destination.lat}&z=16`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const submitAlert = async (type: RoadAlertType) => {
    const map = mapRef.current;
    if (!map) return;
    setAddingType(type);
    const center = map.getCenter();
    try {
      const created = await createRoadAlert({ type, lat: center.lat, lng: center.lng });
      toast.success(`${ROAD_ALERT_META[type].label} belgisi qo‘yildi`);
      setAlerts((prev) => {
        const filtered = prev.filter((a) => a.id !== created.id);
        return [created, ...filtered];
      });
      setShowAddSheet(false);
      if (userLoc) void loadAlerts(userLoc.lat, userLoc.lng, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Belgi qo‘yilmadi');
    } finally {
      setAddingType(null);
    }
  };

  const clearDestination = () => {
    setDestination(null);
    setDestLabel('');
    setRoute(null);
    routePolylineRef.current?.remove();
    routePolylineRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 app-safe-pad z-[260] flex flex-col"
      style={{ background: isDark ? '#0a0a0a' : '#f5f5f5' }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-3 pt-3 pb-2 flex items-center gap-2 z-[500]"
        style={{
          background: isDark ? 'rgba(12,12,12,0.95)' : 'rgba(255,255,255,0.95)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-2 rounded-full active:scale-90"
          style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
        >
          <X className="w-5 h-5" style={{ color: accentColor.color }} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold truncate" style={{ color: isDark ? '#fff' : '#111' }}>
            Yo‘l xaritasi
          </h2>
          <p className="text-[10px] opacity-55 truncate">
            {locStatus === 'loading'
              ? 'Joylashuv aniqlanmoqda…'
              : alertsLoading
                ? 'Belgilar yuklanmoqda…'
                : `${alerts.length} ta jamoaviy belgi`}
          </p>
        </div>
        <button
          type="button"
          onClick={centerOnMe}
          className="shrink-0 p-2 rounded-full active:scale-90"
          style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
        >
          <Crosshair className="w-5 h-5" style={{ color: accentColor.color }} />
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 py-2 z-[500] relative">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <Search className="w-4 h-4 shrink-0 opacity-50" />
          <input
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Manzil qidiring yoki xaritada bosing"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none"
            style={{ color: isDark ? '#fff' : '#111' }}
          />
          {searchBusy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : null}
        </div>
        {searchOpen && searchHits.length > 0 ? (
          <div
            className="absolute left-3 right-3 top-full mt-1 rounded-xl overflow-hidden shadow-xl z-[600] max-h-48 overflow-y-auto"
            style={{
              background: isDark ? '#1a1a1a' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            {searchHits.map((hit, i) => (
              <button
                key={`${hit.lat}-${hit.lon}-${i}`}
                type="button"
                onClick={() => flyToHit(hit)}
                className="w-full text-left px-3 py-2.5 text-xs border-b last:border-0 active:opacity-70"
                style={{
                  color: isDark ? '#eee' : '#222',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}
              >
                {hit.display_name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {showAddSheet ? (
          <div className="absolute inset-0 pointer-events-none z-[400] flex items-center justify-center">
            <div
              className="w-8 h-8 rounded-full border-4 border-white shadow-lg"
              style={{ background: accentColor.color, boxShadow: '0 0 0 2px rgba(0,0,0,0.2)' }}
            />
            <div className="absolute top-1/2 left-1/2 w-0.5 h-10 -mt-14 bg-white/80 rounded" />
          </div>
        ) : null}

        {/* Add FAB */}
        <button
          type="button"
          onClick={() => setShowAddSheet((v) => !v)}
          className="absolute right-3 bottom-28 z-[450] w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95"
          style={{
            background: showAddSheet ? '#64748b' : accentColor.gradient,
            boxShadow: `0 6px 20px ${accentColor.color}55`,
          }}
        >
          {showAddSheet ? <X className="w-6 h-6" /> : <Plus className="w-7 h-7" strokeWidth={2.5} />}
        </button>
      </div>

      {/* Add alert sheet */}
      {showAddSheet ? (
        <div
          className="shrink-0 px-3 py-3 z-[500] border-t"
          style={{
            background: isDark ? 'rgba(12,12,12,0.98)' : 'rgba(255,255,255,0.98)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <p className="text-xs text-center opacity-60 mb-3">
            Xaritani siljiting — belgi markazga qo‘yiladi
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ROAD_ALERT_TYPES.map((type) => {
              const meta = ROAD_ALERT_META[type];
              const busy = addingType === type;
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!!addingType}
                  onClick={() => void submitAlert(type)}
                  className="flex items-center gap-2 px-3 py-3 rounded-xl text-left active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: `2px solid ${meta.color}44`,
                  }}
                >
                  <span className="text-xl">{meta.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold" style={{ color: meta.color }}>
                      {meta.label}
                    </div>
                    <div className="text-[10px] opacity-55 truncate">{meta.description}</div>
                  </div>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin ml-auto" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Route panel */
        <div
          className="shrink-0 px-4 py-3 z-[500] border-t"
          style={{
            background: isDark ? 'rgba(12,12,12,0.98)' : 'rgba(255,255,255,0.98)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            paddingBottom: isIOS ? 'max(12px, env(safe-area-inset-bottom))' : undefined,
          }}
        >
          {destination ? (
            <>
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: isDark ? 'rgba(66,133,244,0.15)' : 'rgba(66,133,244,0.12)' }}
                >
                  {routeLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#4285F4]" />
                  ) : (
                    <Navigation className="w-6 h-6 text-[#4285F4]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold leading-tight line-clamp-2">
                    {destLabel || 'Tanlangan manzil'}
                  </div>
                  {route ? (
                    <div className="text-xs opacity-60 mt-1 flex gap-3">
                      <span>{formatNavDistance(route.distanceM)}</span>
                      <span>{formatNavDuration(route.durationS)}</span>
                    </div>
                  ) : routeLoading ? (
                    <div className="text-xs opacity-50 mt-1">Marshrut hisoblanmoqda…</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={clearDestination}
                  className="shrink-0 p-1.5 rounded-lg opacity-60"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openYandex}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FC3F1D] flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-4 h-4" />
                  Yandex
                </button>
                <button
                  type="button"
                  onClick={centerOnMe}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold border"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                    color: accentColor.color,
                  }}
                >
                  Mening joyim
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-center opacity-55 py-1">
              Manzil tanlang — masofa va vaqt avtomatik hisoblanadi. <Plus className="inline w-3 h-3" /> bilan
              GAI, radar va boshqa belgilar qo‘ying.
            </p>
          )}
        </div>
      )}
    </div>
  );
});
