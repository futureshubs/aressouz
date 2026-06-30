/**
 * Brauzer GPS — Chrome «Network location provider … googleapis … 403» spamini kamaytirish.
 * `enableHighAccuracy: true` + `maximumAge: 0` Google WiFi/cell provayderini tez-tez chaqiradi.
 */

export type BrowserGeoPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type BrowserGeoOptions = {
  /** Aniqroq GPS kerak bo‘lsa — avval past aniqlik, keyin (zarur bo‘lsa) yuqori. */
  preferAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
};

const canUseGeo = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

function readOnce(
  options: PositionOptions,
): Promise<BrowserGeoPosition | null> {
  if (!canUseGeo()) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      options,
    );
  });
}

/**
 * Standart o‘qish — tarmoq provayderga kamroq murojaat (kuryer fon, viloyat aniqlash).
 */
export async function readBrowserGeo(
  opts: BrowserGeoOptions = {},
): Promise<BrowserGeoPosition | null> {
  const timeout = opts.timeoutMs ?? 12_000;
  const maximumAge = opts.maximumAgeMs ?? 120_000;

  return readOnce({
    enableHighAccuracy: false,
    timeout,
    maximumAge,
  });
}

/**
 * «Yetib keldim» / xaritada fokus — avval kesh/past aniqlik, keyin GPS.
 */
export async function readBrowserGeoPreferAccurate(
  opts: BrowserGeoOptions = {},
): Promise<BrowserGeoPosition | null> {
  const timeout = opts.timeoutMs ?? 15_000;
  const maximumAge = opts.maximumAgeMs ?? 60_000;

  const low = await readOnce({
    enableHighAccuracy: false,
    timeout: Math.min(timeout, 10_000),
    maximumAge,
  });
  if (low && (low.accuracy == null || low.accuracy <= 120)) {
    return low;
  }

  const high = await readOnce({
    enableHighAccuracy: true,
    timeout,
    maximumAge: 30_000,
  });
  return high ?? low;
}
