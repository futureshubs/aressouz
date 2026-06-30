/** Kuryer paneli GPS — kesh + interval orqali brauzer geolocation chaqiruvlarini kamaytirish. */

import {
  readBrowserGeo,
  readBrowserGeoPreferAccurate,
  type BrowserGeoPosition,
} from './browserGeolocation';

export type CourierGeoPosition = BrowserGeoPosition;

let geoReadInFlight = false;
let lastSuccessfulReadAt = 0;
let lastCached: CourierGeoPosition | null = null;

const canUseGeo = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

/**
 * Fon yangilash (dashboard/xarita interval).
 */
export function readCourierGeoCached(
  maximumAgeMs = 180_000,
): Promise<CourierGeoPosition | null> {
  if (!canUseGeo()) return Promise.resolve(lastCached);
  if (geoReadInFlight) {
    return Promise.resolve(lastCached);
  }

  geoReadInFlight = true;
  return readBrowserGeo({ maximumAgeMs, timeoutMs: 12_000 }).then((pos) => {
    geoReadInFlight = false;
    if (pos) {
      lastSuccessfulReadAt = Date.now();
      lastCached = pos;
    }
    return pos ?? lastCached;
  });
}

/** «Yetib keldim» va xaritada «meni top». */
export function readCourierGeoAccurate(): Promise<CourierGeoPosition | null> {
  if (!canUseGeo()) return Promise.resolve(lastCached);

  return readBrowserGeoPreferAccurate({ timeoutMs: 15_000, maximumAgeMs: 60_000 }).then(
    (pos) => {
      if (pos) {
        lastCached = pos;
        lastSuccessfulReadAt = Date.now();
      }
      return pos ?? lastCached;
    },
  );
}

/** Interval orqali chaqiruvlar orasida minimal tanaffus (ms). */
export function shouldPushCourierGeoNow(minGapMs = 90_000): boolean {
  return Date.now() - lastSuccessfulReadAt >= minGapMs;
}
