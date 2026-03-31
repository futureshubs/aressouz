export type CourierOrderMapInput = {
  customerLocation?: { lat?: unknown; lng?: unknown } | null;
  customerAddress?: string;
};

/** Manzil qatoridagi "40.12, 69.28" / "3 (40.73, 72.04)" kabi juftliklardan nuqta. */
export const parseCoordsFromAddressText = (text: string): { lat: number; lng: number } | null => {
  const t = String(text || '').trim();
  const m = t.match(/(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

export const getOrderMapPoint = (order: CourierOrderMapInput): { lat: number; lng: number } | null => {
  const cl = order.customerLocation;
  if (cl && typeof cl === 'object') {
    const lat = Number(cl.lat);
    const lng = Number(cl.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return parseCoordsFromAddressText(order.customerAddress || '');
};

/** Serverdagi calculateCourierDistance bilan bir xil yumaloq (km, 0.1). */
export const haversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

/** Joriy kuryer joyi + buyurtma nuqtasi (GPS yoki manzildan parse) bo‘yicha masofa; bo‘lmasa null. */
export const courierOrderDistanceKm = (
  order: CourierOrderMapInput,
  courier: { latitude?: number; longitude?: number } | null | undefined,
): number | null => {
  const lat = Number(courier?.latitude);
  const lng = Number(courier?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const pt = getOrderMapPoint(order);
  if (!pt) return null;
  return haversineDistanceKm(lat, lng, pt.lat, pt.lng);
};

/** UI: avvalo brauzerdagi joy + xarita nuqtasi; bo‘lmasa server distanceKm. */
export const distanceKmForCourierUi = (
  order: CourierOrderMapInput & { distanceKm?: number | null },
  courier: { latitude?: number; longitude?: number } | null | undefined,
): number => {
  const live = courierOrderDistanceKm(order, courier);
  if (live != null && Number.isFinite(live)) return live;
  const api = order.distanceKm;
  if (api != null && Number.isFinite(api)) return api;
  return 0;
};
