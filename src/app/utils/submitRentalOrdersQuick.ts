import { projectId } from '../../../utils/supabase/info';
import { buildUserHeaders } from './requestAuth';
import type { RentalCartItem } from '../context/RentalCartContext';

function formatProfilePhone(phone: string): string {
  let p = phone.replace(/[\s+]/g, '');
  if (p.startsWith('998')) {
    p = `+${p}`;
  } else if (p && !p.startsWith('+998')) {
    p = `+998${p}`;
  }
  return p;
}

/**
 * Ijara buyurtmalarini profil ma’lumotlari bilan yuborish (alohida checkout oynasisiz).
 */
export async function submitRentalOrdersQuick(params: {
  rentalLineItems: RentalCartItem[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  /** Kirgan foydalanuvchi ID — ijara to‘lovi pushlari uchun */
  customerUserId?: string;
  paymentMethod?: string;
  deliveryPrice?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    rentalLineItems,
    customerName,
    customerPhone,
    customerEmail = '',
    customerUserId,
    paymentMethod = 'cash',
    deliveryPrice = 0,
  } = params;
  const name = customerName.trim();
  const phone = formatProfilePhone(String(customerPhone || '').trim());

  if (!rentalLineItems.length) {
    return { ok: false, error: 'Ijara savati bo‘sh' };
  }
  if (!name) {
    return { ok: false, error: 'Profilda ism ko‘rsatilmagan' };
  }
  if (!phone) {
    return { ok: false, error: 'Profilda telefon ko‘rsatilmagan' };
  }

  const contractIso = new Date().toISOString();

  for (const line of rentalLineItems) {
    const branchId = String((line.item as { branchId?: string }).branchId || '').trim();
    if (!branchId) {
      return { ok: false, error: 'Mahsulot filiali aniqlanmadi' };
    }

    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/rentals/orders`,
      {
        method: 'POST',
        headers: buildUserHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          branchId,
          productId: line.item.id,
          productName: line.item.name,
          productImage: (line.item as { image?: string }).image || '',
          quantity: 1,
          customerName: name,
          customerPhone: phone,
          customerEmail,
          passportSeriesNumber: '',
          address: '',
          notes: '',
          rentalPeriod: line.rentalPeriod,
          rentalDuration: line.rentalDuration,
          pricePerPeriod: line.pricePerPeriod,
          totalPrice: line.totalPrice,
          contractStartDate: contractIso,
          deliveryZoneSummary: '',
          ...(customerUserId ? { customerUserId } : {}),
          paymentMethod,
          deliveryPrice: Math.max(0, Math.round(Number(deliveryPrice) || 0)),
        }),
      },
    );

    const j = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (!res.ok || !j?.success) {
      return {
        ok: false,
        error: typeof (j as { error?: string }).error === 'string'
          ? (j as { error: string }).error
          : 'Buyurtmani yuborib bo‘lmadi',
      };
    }
  }

  return { ok: true };
}
