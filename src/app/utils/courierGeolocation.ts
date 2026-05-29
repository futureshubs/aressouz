/** Kuryer paneli GPS — brauzer Google «network location» 403 spamini kamaytirish uchun kesh + interval. */

export type CourierGeoPosition = {
  latitude: number;
  longitude: number;
};

let geoReadInFlight = false;
let lastSuccessfulReadAt = 0;
let lastCached: CourierGeoPosition | null = null;

const canUseGeo = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

/**
 * Fon yangilash (dashboard/xarita interval).
 * `enableHighAccuracy: false` + katta `maximumAge` — tarmoq provayderga kamroq murojaat.
 */
export function readCourierGeoCached(
  maximumAgeMs = 180_000,
): Promise<CourierGeoPosition | null> {
  if (!canUseGeo()) return Promise.resolve(null);
  if (geoReadInFlight) {
    return Promise.resolve(lastCached);
  }

  geoReadInFlight = true;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoReadInFlight = false;
        lastSuccessfulReadAt = Date.now();
        lastCached = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        resolve(lastCached);
      },
      () => {
        geoReadInFlight = false;
        resolve(lastCached);
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: maximumAgeMs,
      },
    );
  });
}

/** «Yetib keldim» va xaritada «meni top» — aniqroq GPS. */
export function readCourierGeoAccurate(): Promise<CourierGeoPosition | null> {
  if (!canUseGeo()) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        lastCached = p;
        lastSuccessfulReadAt = Date.now();
        resolve(p);
      },
      () => resolve(lastCached),
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
      },
    );
  });
}

/** Interval orqali chaqiruvlar orasida minimal tanaffus (ms). */
export function shouldPushCourierGeoNow(minGapMs = 90_000): boolean {
  return Date.now() - lastSuccessfulReadAt >= minGapMs;
}
