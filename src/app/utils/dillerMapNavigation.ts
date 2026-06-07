import type { DillerStore } from './dillerData';
import { distanceKm } from './leafletMapTiles';

export type LatLng = { lat: number; lng: number };

export type OsrmManeuver = {
  type: string;
  modifier?: string;
  location: [number, number];
  bearing_before?: number;
  bearing_after?: number;
};

export type OsrmStep = {
  distance: number;
  duration: number;
  name: string;
  maneuver: OsrmManeuver;
};

export type OsrmRouteResult = {
  distanceM: number;
  durationS: number;
  line: [number, number][];
  steps: OsrmStep[];
};

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return distanceKm(lat1, lng1, lat2, lng2) * 1000;
}

export function formatNavDistance(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatNavDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sek`;
  const min = Math.round(s / 60);
  if (min < 60) return `~${min} daqiqa`;
  const h = Math.floor(min / 60);
  const rm = min % 60;
  return rm > 0 ? `~${h} soat ${rm} daq` : `~${h} soat`;
}

export function bearingDegrees(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function normalizeAngleDiff(a: number): number {
  let d = a % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function turnHintFromBearing(
  userHeading: number | null,
  from: LatLng,
  to: LatLng,
): string {
  const target = bearingDegrees(from, to);
  if (userHeading == null || !Number.isFinite(userHeading)) {
    return 'Manzilga yo‘naltiring';
  }
  const diff = normalizeAngleDiff(target - userHeading);
  if (Math.abs(diff) < 20) return 'To‘g‘ri boring';
  if (diff > 0) return 'O‘ngga buriling';
  return 'Chapga buriling';
}

export function maneuverTextUz(step: OsrmStep): string {
  const { type, modifier } = step.maneuver;
  const mod = modifier ?? '';

  if (type === 'arrive') return 'Manzilga yetdingiz';
  if (type === 'depart') {
    if (mod === 'right') return 'O‘ng tomonga yo‘lga chiqing';
    if (mod === 'left') return 'Chap tomonga yo‘lga chiqing';
    return 'Yo‘lga chiqing';
  }
  if (type === 'roundabout' || type === 'rotary') return 'Aylana harakat — chiqishni tanlang';
  if (type === 'merge') return mod.includes('left') ? 'Chapga qo‘shiling' : 'Yo‘lga qo‘shiling';
  if (type === 'fork') {
    if (mod.includes('left')) return 'Chap yo‘lni tanlang';
    if (mod.includes('right')) return 'O‘ng yo‘lni tanlang';
    return 'Yo‘lni tanlang';
  }
  if (type === 'end of road' || type === 'continue') {
    if (mod.includes('left')) return 'Chapga davom eting';
    if (mod.includes('right')) return 'O‘ngga davom eting';
    return 'Davom eting';
  }

  if (mod.includes('uturn') || mod === 'uturn') return 'U-turn qiling';
  if (mod.includes('sharp') && mod.includes('left')) return 'Keskin chapga buriling';
  if (mod.includes('sharp') && mod.includes('right')) return 'Keskin o‘ngga buriling';
  if (mod.includes('slight') && mod.includes('left')) return 'Sal chapga buriling';
  if (mod.includes('slight') && mod.includes('right')) return 'Sal o‘ngga buriling';
  if (mod === 'left' || mod.includes('left')) return 'Chapga buriling';
  if (mod === 'right' || mod.includes('right')) return 'O‘ngga buriling';
  if (mod === 'straight' || type === 'new name') return 'To‘g‘ri boring';

  const street = step.name?.trim();
  return street ? `${street} bo‘ylab boring` : 'Davom eting';
}

export function maneuverIconKind(step: OsrmStep): 'left' | 'right' | 'straight' | 'uturn' | 'arrive' | 'depart' {
  const { type, modifier } = step.maneuver;
  const mod = modifier ?? '';
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (mod.includes('uturn')) return 'uturn';
  if (mod.includes('left')) return 'left';
  if (mod.includes('right')) return 'right';
  return 'straight';
}

export async function fetchOsrmDrivingRoute(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<OsrmRouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true&annotations=false`;

  try {
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error('osrm');
    const data = (await r.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: number[][] };
        legs?: Array<{ steps?: Array<{
          distance?: number;
          duration?: number;
          name?: string;
          maneuver?: OsrmManeuver;
        }> }>;
      }>;
    };

    const route = data.routes?.[0];
    if (!route) throw new Error('no route');

    const coords = route.geometry?.coordinates;
    const line: [number, number][] =
      Array.isArray(coords) && coords.length >= 2
        ? coords.map((c) => [c[1], c[0]] as [number, number])
        : [
            [from.lat, from.lng],
            [to.lat, to.lng],
          ];

    const rawSteps = route.legs?.[0]?.steps ?? [];
    const steps: OsrmStep[] = rawSteps
      .filter((s) => s.maneuver?.location)
      .map((s) => ({
        distance: s.distance ?? 0,
        duration: s.duration ?? 0,
        name: s.name ?? '',
        maneuver: s.maneuver as OsrmManeuver,
      }));

    return {
      distanceM: route.distance ?? distanceMeters(from.lat, from.lng, to.lat, to.lng),
      durationS: route.duration ?? 0,
      line,
      steps: steps.length > 0 ? steps : fallbackSteps(from, to, line),
    };
  } catch {
    return fallbackRoute(from, to);
  }
}

function fallbackSteps(from: LatLng, to: LatLng, line: [number, number][]): OsrmStep[] {
  const dist = distanceMeters(from.lat, from.lng, to.lat, to.lng);
  return [
    {
      distance: dist * 0.05,
      duration: 0,
      name: '',
      maneuver: { type: 'depart', modifier: 'straight', location: [from.lng, from.lat] },
    },
    {
      distance: dist * 0.9,
      duration: 0,
      name: '',
      maneuver: {
        type: 'turn',
        modifier: 'straight',
        location: line[Math.floor(line.length / 2)] ? [line[Math.floor(line.length / 2)][1], line[Math.floor(line.length / 2)][0]] : [to.lng, to.lat],
      },
    },
    {
      distance: dist * 0.05,
      duration: 0,
      name: '',
      maneuver: { type: 'arrive', modifier: 'straight', location: [to.lng, to.lat] },
    },
  ];
}

function fallbackRoute(from: LatLng, to: LatLng): OsrmRouteResult {
  const line: [number, number][] = [
    [from.lat, from.lng],
    [to.lat, to.lng],
  ];
  const dist = distanceMeters(from.lat, from.lng, to.lat, to.lng);
  return {
    distanceM: dist,
    durationS: (dist / 1000 / 40) * 3600,
    line,
    steps: fallbackSteps(from, to, line),
  };
}

export function pickActiveStepIndex(user: LatLng, steps: OsrmStep[]): number {
  if (steps.length === 0) return 0;

  let idx = 0;
  for (let i = 0; i < steps.length; i++) {
    const loc = steps[i].maneuver.location;
    const d = distanceMeters(user.lat, user.lng, loc[1], loc[0]);
    if (d > 35) {
      idx = i;
      break;
    }
    idx = Math.min(i + 1, steps.length - 1);
  }

  if (steps[idx]?.maneuver.type === 'arrive' && idx > 0) return idx;
  return idx;
}

export function remainingRouteMetrics(
  user: LatLng,
  steps: OsrmStep[],
  activeIdx: number,
  totalDistanceM: number,
  totalDurationS: number,
): { distanceM: number; durationS: number } {
  if (steps.length === 0) {
    return { distanceM: totalDistanceM, durationS: totalDurationS };
  }

  const active = steps[activeIdx];
  if (!active) {
    return { distanceM: totalDistanceM, durationS: totalDurationS };
  }

  const loc = active.maneuver.location;
  let distanceM = distanceMeters(user.lat, user.lng, loc[1], loc[0]);

  for (let i = activeIdx; i < steps.length; i++) {
    distanceM += steps[i].distance;
  }

  const ratio = totalDistanceM > 0 ? Math.min(1, distanceM / totalDistanceM) : 1;
  const durationS = totalDurationS * ratio;

  return {
    distanceM: Math.min(distanceM, totalDistanceM),
    durationS,
  };
}

export function orderStoresNearestFirst(user: LatLng, stores: DillerStore[]): DillerStore[] {
  const withCoords = stores.filter(
    (s) => s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng),
  );
  const remaining = [...withCoords];
  const ordered: DillerStore[] = [];
  let cursor = user;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const d = distanceMeters(cursor.lat, cursor.lng, s.lat!, s.lng!);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    cursor = { lat: next.lat!, lng: next.lng! };
  }

  return ordered;
}

export function yandexMapsDirectionsUrl(from: LatLng, to: LatLng): string {
  return `https://yandex.com/maps/?rtext=${from.lat},${from.lng}~${to.lat},${to.lng}&rtt=auto`;
}

export function googleMapsDirectionsUrl(from: LatLng, to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}
