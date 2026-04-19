/** Restoran manzili / telefon uchun xarita va qo‘ng‘iroq havolalari */

export function parseMerchantCoordinates(raw: unknown): { lat: number; lng: number } | null {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.length >= 2) {
    const lat = Number(raw[0]);
    const lng = Number(raw[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const lat = Number(o.lat ?? o.latitude);
    const lng = Number(o.lng ?? o.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

export function googleMapsUrlForCoordinates(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

/** Yandex: pt va ll — longitude, latitude tartibi */
export function yandexMapsUrlForCoordinates(lat: number, lng: number): string {
  const ll = `${lng},${lat}`;
  const pt = `${lng},${lat}`;
  return `https://yandex.com/maps/?ll=${encodeURIComponent(ll)}&z=16&pt=${encodeURIComponent(pt)},pm2rdm`;
}

export function googleMapsUrlForAddressQuery(address: string): string {
  const q = String(address || '').trim();
  if (!q) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Mijoz brauzerida qo‘ng‘iroq ilovasiga o‘tish */
export function phoneToTelHref(phone: string): string {
  let s = String(phone || '').trim();
  if (!s) return '#';
  s = s.replace(/[\s\-–—().]/g, '');
  if (!s) return '#';
  if (s.startsWith('+')) return `tel:${s}`;
  if (s.startsWith('998')) return `tel:+${s}`;
  if (/^\d{9}$/.test(s)) return `tel:+998${s}`;
  return `tel:${s}`;
}
