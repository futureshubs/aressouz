export type CourierOrderLocationFields = {
  orderType?: string;
  pickupAddress?: string;
  pickupRackNumber?: string | null;
  pickupRackName?: string | null;
  shopName?: string;
  restaurantName?: string;
  merchantName?: string;
  branchName?: string;
  branchAddress?: string;
  branchCoordinates?: { lat: number; lng: number } | null;
  customerAddress?: string;
  customerLocation?: { lat: number; lng: number } | null;
  deliveryZone?: string;
  productName?: string;
};

export type LocationLine = { label: string; value: string };

export type PickupSummary = {
  badge: string;
  title: string;
  subtitle: string;
};

const fmtCoords = (pt?: { lat: number; lng: number } | null) => {
  if (!pt) return '';
  const lat = Number(pt.lat);
  const lng = Number(pt.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const clean = (s?: string | null) => String(s || '').trim();

export function getCourierPickupSummary(order: CourierOrderLocationFields): PickupSummary {
  const ot = clean(order.orderType).toLowerCase();

  if (ot === 'shop') {
    const name = clean(order.shopName) || clean(order.merchantName) || "Do'kon";
    const sub =
      clean(order.pickupAddress) ||
      clean(order.branchAddress) ||
      clean(order.branchName) ||
      'Manzil kiritilmagan';
    return { badge: "Do'kon", title: name, subtitle: sub };
  }

  if (ot === 'food' || ot === 'restaurant') {
    const name = clean(order.restaurantName) || clean(order.merchantName) || 'Restoran';
    const sub =
      clean(order.pickupAddress) ||
      clean(order.branchAddress) ||
      clean(order.branchName) ||
      'Manzil kiritilmagan';
    return { badge: 'Taom', title: name, subtitle: sub };
  }

  if (ot === 'market') {
    const branch = clean(order.branchName) || 'Filial';
    const rackNum = clean(order.pickupRackNumber);
    const rackName = clean(order.pickupRackName);
    const rack = rackNum
      ? `Rasta #${rackNum}${rackName ? ` (${rackName})` : ''}`
      : rackName || '';
    const sub =
      clean(order.pickupAddress) ||
      clean(order.branchAddress) ||
      branch ||
      'Manzil kiritilmagan';
    return { badge: 'Market', title: rack || branch, subtitle: sub };
  }

  if (ot === 'rental') {
    const name = clean(order.productName) || 'Ijara buyurtmasi';
    const sub = clean(order.pickupAddress) || 'Olib ketish manzili kiritilmagan';
    return { badge: 'Ijara', title: name, subtitle: sub };
  }

  const branch = clean(order.branchName) || 'Filial';
  const sub =
    clean(order.pickupAddress) ||
    clean(order.branchAddress) ||
    'Manzil kiritilmagan';
  return { badge: 'Filial', title: branch, subtitle: sub };
}

export function getCourierPickupDetailLines(order: CourierOrderLocationFields): LocationLine[] {
  const ot = clean(order.orderType).toLowerCase();
  const lines: LocationLine[] = [];

  if (ot === 'shop') {
    lines.push({ label: "Do'kon", value: clean(order.shopName) || clean(order.merchantName) || '—' });
  } else if (ot === 'food' || ot === 'restaurant') {
    lines.push({
      label: 'Restoran',
      value: clean(order.restaurantName) || clean(order.merchantName) || '—',
    });
  } else if (ot === 'market') {
    lines.push({ label: 'Filial', value: clean(order.branchName) || '—' });
    if (clean(order.pickupRackNumber) || clean(order.pickupRackName)) {
      lines.push({
        label: 'Rasta',
        value: `#${clean(order.pickupRackNumber) || '—'}${clean(order.pickupRackName) ? ` (${order.pickupRackName})` : ''}`,
      });
    }
  } else if (ot === 'rental') {
    lines.push({ label: 'Mahsulot', value: clean(order.productName) || '—' });
  }

  if (clean(order.branchName) && ot !== 'market') {
    lines.push({ label: 'Filial', value: clean(order.branchName) });
  }
  if (clean(order.branchAddress)) {
    lines.push({ label: 'Filial manzili', value: clean(order.branchAddress) });
  }
  if (clean(order.pickupAddress)) {
    lines.push({ label: 'Olish manzili', value: clean(order.pickupAddress) });
  }
  const pickupGps = fmtCoords(order.branchCoordinates);
  if (pickupGps) {
    lines.push({ label: 'Olish GPS', value: pickupGps });
  }

  return lines.filter((l) => l.value && l.value !== '—');
}

export function getCourierCustomerDetailLines(order: CourierOrderLocationFields): LocationLine[] {
  const lines: LocationLine[] = [];
  const addr = clean(order.customerAddress);
  if (addr) lines.push({ label: 'Manzil', value: addr });
  if (clean(order.deliveryZone)) {
    lines.push({ label: 'Yetkazish zonasi', value: clean(order.deliveryZone) });
  }
  const gps = fmtCoords(order.customerLocation);
  if (gps) lines.push({ label: 'Mijoz GPS', value: gps });
  return lines;
}

export function getCourierCustomerShortLine(order: CourierOrderLocationFields): string {
  return clean(order.customerAddress) || 'Mijoz manzili kiritilmagan';
}
