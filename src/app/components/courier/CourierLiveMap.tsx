import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2, Navigation, X } from 'lucide-react';
import { formatOrderNumber } from '../../utils/orderNumber';
import { distanceKmForCourierUi, getOrderMapPoint } from '../../utils/courierOrderGeo';
import { useVisibilityTick } from '../../utils/visibilityRefetch';

type MapOrder = {
  id: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  distanceKm?: number | null;
  customerLocation?: { lat?: unknown; lng?: unknown } | null;
  branchCoordinates?: { lat?: unknown; lng?: unknown } | null;
  branchName?: string;
  branchAddress?: string;
  orderType?: string;
  merchantName?: string;
};

export type CourierMapRoutePreview = {
  start: [number, number];
  end: [number, number];
  label?: string;
};

interface CourierLiveMapProps {
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
  availableOrders: MapOrder[];
  /** Kuryer qabul qilib yetkazayotgan barcha buyurtmalar (cheklanmagan). */
  activeOrders?: MapOrder[];
  /** Kuryer → nuqta yo‘li (aktiv buyurtmada "Mijoz" / "Filial" tugmasi). */
  routePreview?: CourierMapRoutePreview | null;
  onClearRoute?: () => void;
  /** Mobil yetkazib berish ilovalariga o‘xshash balandlik va teginish. */
  layout?: 'mobile' | 'desktop';
}

async function fetchOsrmDrivingRoute(
  start: [number, number],
  end: [number, number],
  signal: AbortSignal,
): Promise<[number, number][]> {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;
  const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson&steps=false`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error('osrm');
    const data = (await r.json()) as {
      routes?: Array<{ geometry?: { coordinates?: number[][] } }>;
    };
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) throw new Error('no route');
    return coords.map((c) => [c[1], c[0]] as [number, number]);
  } catch {
    return [start, end];
  }
}

const createCourierIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">🚴</div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });

const EARTH_METERS_PER_DEG_LAT = 111320;

const distanceMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371000;
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δφ = ((bLat - aLat) * Math.PI) / 180;
  const Δλ = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

/** Bir xil nuqta: siljitmaymiz — buyurtma z-index bilan kuryerning ustida. Juda yaqin (GPS shovqin): kichik surish. */
const displayLatLngForOrderNearCourier = (
  courier: { latitude: number; longitude: number } | null | undefined,
  orderLat: number,
  orderLng: number,
  spreadIndex: number,
  distanceKmHint?: number,
): { lat: number; lng: number; nudged: boolean } => {
  const backendSaysVeryClose =
    distanceKmHint != null && Number.isFinite(distanceKmHint) && distanceKmHint < 0.08;

  const applyOffset = (fromLat: number, fromLng: number, offsetM: number) => {
    const angle = ((spreadIndex * 67 + 23) * Math.PI) / 180;
    const dLat = (offsetM * Math.cos(angle)) / EARTH_METERS_PER_DEG_LAT;
    const dLng =
      (offsetM * Math.sin(angle)) /
      (EARTH_METERS_PER_DEG_LAT * Math.max(Math.cos((fromLat * Math.PI) / 180), 1e-6));
    return { lat: fromLat + dLat, lng: fromLng + dLng, nudged: true as const };
  };

  const cLat = Number(courier?.latitude);
  const cLng = Number(courier?.longitude);
  if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) {
    if (backendSaysVeryClose) {
      return applyOffset(orderLat, orderLng, 26);
    }
    return { lat: orderLat, lng: orderLng, nudged: false };
  }

  const d = distanceMeters(cLat, cLng, orderLat, orderLng);
  const sameCoords = Math.abs(cLat - orderLat) < 1e-7 && Math.abs(cLng - orderLng) < 1e-7;

  if (sameCoords) {
    return { lat: orderLat, lng: orderLng, nudged: false };
  }

  const shouldNudge = d < 22 || (backendSaysVeryClose && d < 45);
  if (!shouldNudge) {
    return { lat: orderLat, lng: orderLng, nudged: false };
  }

  const offsetM = Math.min(34, 12 + d * 0.55);
  return applyOffset(orderLat, orderLng, offsetM);
};

const createOrderIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid white;
        box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        line-height: 1;
      ">📍</div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });

const getBranchMapPoint = (order: MapOrder): { lat: number; lng: number } | null => {
  const b = order.branchCoordinates;
  if (!b || typeof b !== 'object') return null;
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

/** Buyurtma turiga qarab olish (filial) belgisi — rang va emoji. */
const pickupVisualForOrderType = (orderType?: string): { emoji: string; bg: string; kindUz: string } => {
  const x = String(orderType || '').toLowerCase().trim();
  if (x === 'food' || x === 'restaurant') return { emoji: '🍴', bg: '#ea580c', kindUz: 'Taom olish' };
  if (x === 'shop') return { emoji: '🛍️', bg: '#7c3aed', kindUz: "Do'kon" };
  if (x === 'market') return { emoji: '🛒', bg: '#059669', kindUz: 'Market' };
  if (x === 'rental') return { emoji: '🔑', bg: '#64748b', kindUz: 'Ijara' };
  return { emoji: '📦', bg: '#4f46e5', kindUz: 'Olish nuqtasi' };
};

const createPickupIcon = (bg: string, emoji: string) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width: 38px;
        height: 38px;
        border-radius: 11px;
        background: ${bg};
        border: 3px solid white;
        box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        line-height: 1;
      ">${emoji}</div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });

const safeInvalidateMap = (map: L.Map | null) => {
  if (!map) return;
  try {
    const el = map.getContainer();
    if (!el?.isConnected) return;
    map.invalidateSize({ animate: false });
  } catch {
    /* xarita olib tashlangan */
  }
};

export default function CourierLiveMap({
  isDark,
  accentColor,
  currentLocation,
  availableOrders,
  activeOrders = [],
  routePreview = null,
  onClearRoute,
  layout = 'desktop',
}: CourierLiveMapProps) {
  const isMobileLayout = layout === 'mobile';
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const orderMarkersRef = useRef<L.Marker[]>([]);
  const pickupMarkersRef = useRef<L.Marker[]>([]);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const hasAutoFittedRef = useRef(false);
  const ordersFitSignatureRef = useRef('');
  const [mapExpanded, setMapExpanded] = useState(false);
  const mobileFullscreen = isMobileLayout && mapExpanded;
  const visibilityRefetchTick = useVisibilityTick();

  useEffect(() => {
    if (!mobileFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileFullscreen]);

  const focusOnCourier = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const fly = (lat: number, lng: number) => {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.55 });
      window.setTimeout(() => courierMarkerRef.current?.openPopup(), 400);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fly(pos.coords.latitude, pos.coords.longitude),
        () => {
          if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
            fly(currentLocation.latitude, currentLocation.longitude);
          }
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 },
      );
    } else if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
      fly(currentLocation.latitude, currentLocation.longitude);
    }
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  // Lokatsiya keyinroq kelganda ham xarita yaratiladi ([] bo‘lsa ref bog‘lanmasdan effekt “o‘tib ketardi”).
  useEffect(() => {
    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      return;
    }
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const defaultCenter: [number, number] = [
      currentLocation.latitude,
      currentLocation.longitude,
    ];

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(defaultCenter, 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    mapRef.current = map;

    const el = mapContainerRef.current;
    const bumpSize = () => {
      if (mapRef.current !== map) return;
      safeInvalidateMap(map);
    };
    bumpSize();
    requestAnimationFrame(bumpSize);
    const t1 = window.setTimeout(bumpSize, 80);
    const t2 = window.setTimeout(bumpSize, 350);
    const t3 = window.setTimeout(bumpSize, 900);

    const ro =
      typeof ResizeObserver !== 'undefined' && el
        ? new ResizeObserver(() => bumpSize())
        : null;
    if (el && ro) ro.observe(el);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      ro?.disconnect();
      routePolylineRef.current?.remove();
      routePolylineRef.current = null;
      courierMarkerRef.current?.remove();
      courierMarkerRef.current = null;
      orderMarkersRef.current.forEach((marker) => marker.remove());
      orderMarkersRef.current = [];
      pickupMarkersRef.current.forEach((marker) => marker.remove());
      pickupMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  useEffect(() => {
    if (!mapRef.current) return;
    const bump = () => safeInvalidateMap(mapRef.current);
    bump();
    const t1 = window.setTimeout(bump, 200);
    const t2 = window.setTimeout(bump, 450);
    const t3 = window.setTimeout(bump, 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [mapExpanded, mobileFullscreen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routePolylineRef.current?.remove();
    routePolylineRef.current = null;

    if (!routePreview) return;

    const ac = new AbortController();
    const { start, end } = routePreview;

    (async () => {
      const pts = await fetchOsrmDrivingRoute(start, end, ac.signal);
      if (ac.signal.aborted || !mapRef.current) return;
      const line = L.polyline(pts, {
        color: accentColor.color,
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
      }).addTo(mapRef.current);
      routePolylineRef.current = line;
      const b = L.latLngBounds(pts);
      map.fitBounds(b, { padding: [64, 64], maxZoom: 17, animate: true });
    })();

    return () => ac.abort();
  }, [
    routePreview,
    accentColor.color,
    currentLocation?.latitude,
    currentLocation?.longitude,
    visibilityRefetchTick,
  ]);

  useEffect(() => {
    if (!mapRef.current || !currentLocation?.latitude || !currentLocation?.longitude) {
      return;
    }

    const courierLatLng: [number, number] = [
      currentLocation.latitude,
      currentLocation.longitude,
    ];

    if (!courierMarkerRef.current) {
      const courierMarker = L.marker(courierLatLng, {
        icon: createCourierIcon(accentColor.color),
        zIndexOffset: 80,
      });

      courierMarker.addTo(mapRef.current);
      courierMarkerRef.current = courierMarker;
    } else {
      courierMarkerRef.current.setLatLng(courierLatLng);
      courierMarkerRef.current.setIcon(createCourierIcon(accentColor.color));
      courierMarkerRef.current.setZIndexOffset(150);
    }

    courierMarkerRef.current.bindPopup(`
      <div style="min-width: 180px;">
        <p style="font-weight: 700; margin: 0 0 6px 0;">Sizning joylashuvingiz</p>
        <p style="margin: 0; font-size: 12px; color: #666;">${currentLocation.address || `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`}</p>
      </div>
    `);
  }, [accentColor.color, currentLocation]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const branchKey = (o: MapOrder) => {
      const p = getBranchMapPoint(o);
      return p ? `${p.lat.toFixed(5)}_${p.lng.toFixed(5)}` : '';
    };
    const fitSig = [
      ...availableOrders.map((o) => `${o.id}|${branchKey(o)}`),
      ...activeOrders.map((o) => `${o.id}|${branchKey(o)}`),
      currentLocation?.latitude?.toFixed(5),
      currentLocation?.longitude?.toFixed(5),
    ].join('|');
    if (fitSig !== ordersFitSignatureRef.current) {
      ordersFitSignatureRef.current = fitSig;
      hasAutoFittedRef.current = false;
    }

    orderMarkersRef.current.forEach((marker) => marker.remove());
    orderMarkersRef.current = [];
    pickupMarkersRef.current.forEach((marker) => marker.remove());
    pickupMarkersRef.current = [];

    const bounds: L.LatLngExpression[] = [];
    if (currentLocation?.latitude && currentLocation?.longitude) {
      bounds.push([currentLocation.latitude, currentLocation.longitude]);
    }

    const courierPos =
      currentLocation?.latitude != null && currentLocation?.longitude != null
        ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
        : null;

    availableOrders.forEach((order, index) => {
      const pt = getOrderMapPoint(order);
      if (!pt) {
        return;
      }

      const trueLat = pt.lat;
      const trueLng = pt.lng;
      const distKmUi = distanceKmForCourierUi(order, currentLocation);
      const { lat: dispLat, lng: dispLng, nudged } = displayLatLngForOrderNearCourier(
        courierPos,
        trueLat,
        trueLng,
        index,
        distKmUi,
      );

      const marker = L.marker([dispLat, dispLng], {
        icon: createOrderIcon('#14b8a6'),
        zIndexOffset: 950,
      });

      const nudgeNote = nudged
        ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">Belgi faqat xaritada biroz surilgan (ikonkalar ustma-ust tushmasin); masofa yuqoridagi raqam bo‘yicha.</p>`
        : '';

      marker.bindPopup(`
        <div style="min-width: 210px;">
          <p style="font-weight: 700; margin: 0 0 6px 0;">${formatOrderNumber(order.orderNumber, order.id)}</p>
          <p style="margin: 0 0 4px 0; font-size: 12px;">${order.customerName}</p>
          <p style="margin: 0 0 4px 0; font-size: 12px;">${order.customerPhone}</p>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">${order.customerAddress || 'Manzil kiritilmagan'}</p>
          <p style="margin: 0; font-size: 12px; color: ${accentColor.color}; font-weight: 700;">${distKmUi.toFixed(1)} km</p>
          ${nudgeNote}
        </div>
      `);

      marker.on('click', () => {
        mapRef.current?.setView([dispLat, dispLng], Math.max(mapRef.current!.getZoom(), 15));
      });

      marker.addTo(mapRef.current!);
      orderMarkersRef.current.push(marker);
      bounds.push([dispLat, dispLng]);
      bounds.push([trueLat, trueLng]);

      const branchPt = getBranchMapPoint(order);
      if (branchPt) {
        const pv = pickupVisualForOrderType(order.orderType);
        const { lat: pDispLat, lng: pDispLng, nudged: pNudged } = displayLatLngForOrderNearCourier(
          courierPos,
          branchPt.lat,
          branchPt.lng,
          200 + index,
          undefined,
        );
        const pMarker = L.marker([pDispLat, pDispLng], {
          icon: createPickupIcon(pv.bg, pv.emoji),
          zIndexOffset: 880,
        });
        const pNudgeNote = pNudged
          ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">Belgi yaqin nuqtalardan biroz surilgan.</p>`
          : '';
        pMarker.bindPopup(`
          <div style="min-width: 200px;">
            <p style="font-weight: 700; margin: 0 0 4px 0; color: ${pv.bg};">${pv.kindUz}</p>
            <p style="margin: 0 0 4px 0; font-size: 12px;">${formatOrderNumber(order.orderNumber, order.id)}</p>
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600;">${order.branchName || 'Filial'}</p>
            <p style="margin: 0; font-size: 12px; color: #666;">${order.branchAddress || 'Manzil kiritilmagan'}</p>
            ${order.merchantName ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #666;">${order.merchantName}</p>` : ''}
            ${pNudgeNote}
          </div>
        `);
        pMarker.on('click', () => {
          mapRef.current?.setView([pDispLat, pDispLng], Math.max(mapRef.current!.getZoom(), 15));
        });
        pMarker.addTo(mapRef.current!);
        pickupMarkersRef.current.push(pMarker);
        bounds.push([pDispLat, pDispLng]);
        bounds.push([branchPt.lat, branchPt.lng]);
      }
    });

    activeOrders.forEach((activeOrder, aIdx) => {
      const activePt = getOrderMapPoint(activeOrder);
      if (!activePt) {
        return;
      }

      const aLat = activePt.lat;
      const aLng = activePt.lng;
      const activeDistKm = distanceKmForCourierUi(activeOrder, currentLocation);
      const { lat: dispLat, lng: dispLng, nudged } = displayLatLngForOrderNearCourier(
        courierPos,
        aLat,
        aLng,
        availableOrders.length + 7 + aIdx,
        activeDistKm,
      );

      const marker = L.marker([dispLat, dispLng], {
        icon: createOrderIcon('#f59e0b'),
        zIndexOffset: 1000 + aIdx,
      });

      const nudgeNote = nudged
        ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">Belgi faqat xaritada biroz surilgan (ikonkalar ustma-ust tushmasin); masofa ro‘yxatdagi qiymat bilan mos.</p>`
        : '';

      marker.bindPopup(`
        <div style="min-width: 210px;">
          <p style="font-weight: 700; margin: 0 0 6px 0;">Aktiv · ${formatOrderNumber(activeOrder.orderNumber, activeOrder.id)}</p>
          <p style="margin: 0 0 4px 0; font-size: 12px;">${activeOrder.customerName}</p>
          <p style="margin: 0; font-size: 12px; color: #666;">${activeOrder.customerAddress || 'Manzil kiritilmagan'}</p>
          ${nudgeNote}
        </div>
      `);

      marker.on('click', () => {
        mapRef.current?.setView([dispLat, dispLng], Math.max(mapRef.current!.getZoom(), 15));
      });

      marker.addTo(mapRef.current!);
      orderMarkersRef.current.push(marker);
      bounds.push([dispLat, dispLng]);
      bounds.push([aLat, aLng]);

      const activeBranch = getBranchMapPoint(activeOrder);
      if (activeBranch) {
        const pv = pickupVisualForOrderType(activeOrder.orderType);
        const { lat: pDispLat, lng: pDispLng, nudged: pNudged } = displayLatLngForOrderNearCourier(
          courierPos,
          activeBranch.lat,
          activeBranch.lng,
          320 + aIdx,
          undefined,
        );
        const pMarker = L.marker([pDispLat, pDispLng], {
          icon: createPickupIcon(pv.bg, pv.emoji),
          zIndexOffset: 970 + aIdx,
        });
        const pNudgeNote = pNudged
          ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">Belgi yaqin nuqtalardan biroz surilgan.</p>`
          : '';
        pMarker.bindPopup(`
          <div style="min-width: 200px;">
            <p style="font-weight: 700; margin: 0 0 4px 0; color: ${pv.bg};">Aktiv · ${pv.kindUz}</p>
            <p style="margin: 0 0 4px 0; font-size: 12px;">${formatOrderNumber(activeOrder.orderNumber, activeOrder.id)}</p>
            <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600;">${activeOrder.branchName || 'Filial'}</p>
            <p style="margin: 0; font-size: 12px; color: #666;">${activeOrder.branchAddress || 'Manzil kiritilmagan'}</p>
            ${activeOrder.merchantName ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #666;">${activeOrder.merchantName}</p>` : ''}
            ${pNudgeNote}
          </div>
        `);
        pMarker.on('click', () => {
          mapRef.current?.setView([pDispLat, pDispLng], Math.max(mapRef.current!.getZoom(), 15));
        });
        pMarker.addTo(mapRef.current!);
        pickupMarkersRef.current.push(pMarker);
        bounds.push([pDispLat, pDispLng]);
        bounds.push([activeBranch.lat, activeBranch.lng]);
      }
    });

    const map = mapRef.current;
    if (!hasAutoFittedRef.current && bounds.length > 1) {
      const b = L.latLngBounds(bounds as L.LatLngExpression[]);
      if (b.getNorthEast().distanceTo(b.getSouthWest()) < 3) {
        map.setView(b.getCenter(), 16);
      } else {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      }
      hasAutoFittedRef.current = true;
    } else if (!hasAutoFittedRef.current && bounds.length === 1) {
      map.setView(bounds[0] as [number, number], 15);
      hasAutoFittedRef.current = true;
    }
  }, [accentColor.color, activeOrders, availableOrders, currentLocation]);

  return (
    <div
      className={[
        'courier-live-map-shell border',
        mobileFullscreen
          ? 'fixed inset-0 z-[260] m-0 flex max-h-[100dvh] h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0'
          : `overflow-hidden ${isMobileLayout ? 'rounded-2xl' : 'rounded-3xl'}`,
      ].join(' ')}
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        colorScheme: 'light',
        ...(mobileFullscreen
          ? {
              paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
              paddingLeft: 'env(safe-area-inset-left, 0px)',
              paddingRight: 'env(safe-area-inset-right, 0px)',
            }
          : {}),
      }}
    >
      <div
        className={
          mobileFullscreen
            ? 'relative z-[5000] flex shrink-0 items-center justify-center border-b px-3 py-2.5 shadow-md'
            : `flex shrink-0 flex-wrap items-start justify-between gap-3 border-b ${
                isMobileLayout ? 'p-3' : 'p-4 sm:p-5'
              }`
        }
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          ...(mobileFullscreen
            ? {
                backgroundColor: isDark ? '#0f0f10' : '#ffffff',
              }
            : {}),
        }}
      >
        <div className={`min-w-0 ${mobileFullscreen ? 'text-center' : 'flex-1'}`}>
          <h2
            className={`font-bold ${mobileFullscreen ? 'text-base' : 'text-lg'}`}
            style={mobileFullscreen ? { color: isDark ? '#f3f4f6' : '#111827' } : undefined}
          >
            Kuryer xaritasi
          </h2>
          {!mobileFullscreen ? (
            <p style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(17,24,39,0.7)' }}>
              O'zingiz turgan joy va atrofingizdagi buyurtmalar
            </p>
          ) : null}
        </div>
        <div
          className={
            mobileFullscreen
              ? 'absolute right-2 top-1/2 flex -translate-y-1/2 flex-wrap items-center justify-end gap-2'
              : 'flex flex-wrap items-center justify-end gap-2 shrink-0'
          }
        >
          {routePreview && onClearRoute ? (
            <button
              type="button"
              onClick={onClearRoute}
              className="flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:opacity-90 active:scale-[0.98]"
              style={{
                background: isDark ? 'rgba(26,26,26,0.85)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                color: isDark ? 'rgba(255,255,255,0.85)' : '#374151',
              }}
            >
              <X className="w-3.5 h-3.5" />
              Yo‘lni yopish
            </button>
          ) : null}
          {!mobileFullscreen ? (
            <button
              type="button"
              onClick={() => setMapExpanded((v) => !v)}
              className="flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:opacity-90 active:scale-[0.98]"
              style={{
                background: isDark ? 'rgba(26,26,26,0.85)' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                color: accentColor.color,
              }}
            >
              {mapExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  Kichraytirish
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  Kattalashtirish
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {!currentLocation?.latitude || !currentLocation?.longitude ? (
        <div className="p-10 text-center">
          <p className="font-semibold mb-2">Lokatsiya hali aniqlanmadi</p>
          <p style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(17,24,39,0.7)' }}>
            Xarita chiqishi uchun brauzerda location ruxsatini yoqing.
          </p>
        </div>
      ) : (
        <div
          className={`relative min-h-0 ${mobileFullscreen ? 'z-[1] flex min-h-0 flex-1 flex-col' : 'z-0'}`}
          style={{ touchAction: 'manipulation' }}
        >
          {mobileFullscreen ? (
            <button
              type="button"
              aria-label="To‘liq ekrandan chiqish"
              onClick={() => setMapExpanded(false)}
              className="pointer-events-auto absolute z-[6000] flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-xl"
              style={{
                top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
                right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
                background: isDark ? 'rgba(15,15,16,0.92)' : 'rgba(255,255,255,0.96)',
                borderColor: isDark ? 'rgba(248,113,113,0.85)' : 'rgba(220,38,38,0.35)',
                color: '#dc2626',
                boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              }}
            >
              <X className="h-6 w-6 shrink-0" strokeWidth={2.5} />
            </button>
          ) : null}
          <div
            ref={mapContainerRef}
            className={`w-full touch-manipulation ${
              mobileFullscreen
                ? 'min-h-0 flex-1'
                : mapExpanded && !isMobileLayout
                  ? ''
                  : isMobileLayout
                    ? ''
                    : 'min-h-[320px] h-[420px]'
            }`}
            style={{
              width: '100%',
              ...(mobileFullscreen
                ? { flex: '1 1 0%', minHeight: 0, height: '100%' }
                : mapExpanded && !isMobileLayout
                  ? { height: 'min(78vh, 820px)', minHeight: 480 }
                  : isMobileLayout
                    ? {
                        height: 'clamp(260px, 42dvh, 420px)',
                        minHeight: 260,
                      }
                    : {}),
              transition: mobileFullscreen ? undefined : 'height 0.25s ease, min-height 0.25s ease',
            }}
          />
          <button
            type="button"
            onClick={focusOnCourier}
            className="absolute z-[1000] flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-lg transition hover:opacity-95 active:scale-[0.98]"
            style={{
              background: isDark ? 'rgba(26,26,26,0.92)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              color: accentColor.color,
              right: mobileFullscreen ? 'max(1rem, env(safe-area-inset-right, 0px))' : '1rem',
              bottom: mobileFullscreen
                ? 'max(1rem, env(safe-area-inset-bottom, 0px))'
                : '1rem',
            }}
            title="Joriy GPS bo‘yicha xaritani sizga yo‘naltiradi"
          >
            <Navigation className="w-4 h-4 shrink-0" />
            Mening joyim
          </button>
        </div>
      )}
    </div>
  );
}
