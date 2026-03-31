import { projectId } from '../../../utils/supabase/info';
import { buildUserHeaders } from './requestAuth';

const isUuid = (value: unknown): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value ?? '').trim(),
  );

const firstUuid = (...candidates: unknown[]): string | null => {
  for (const c of candidates) {
    if (isUuid(c)) return String(c).trim();
  }
  return null;
};

/** order_items: exactly one of listing_id | product_variant_id; product_id optional; server can resolve variant from product_id */
const buildV2LineItem = (
  it: any,
  vertical: string,
  currencyCode: string,
  fallbackBranchId: string | null,
) => {
  const qty = Number(it?.quantity || 1);
  const unit =
    vertical === 'food'
      ? Number(it?.price || it?.variantDetails?.price || 0)
      : Number(it?.price || 0);
  const lineTotal = qty * unit;

  const listingId = firstUuid(it?.listingId, it?.listing_id);
  const variantId = firstUuid(
    it?.variantId,
    it?.selectedVariantId,
    it?.productVariantId,
    it?.product_variant_id,
  );
  let productId = firstUuid(it?.productUuid, it?.productId);
  if (!productId && typeof it?.id === 'string' && isUuid(it.id)) {
    productId = String(it.id).trim();
  }
  if (!productId && vertical === 'food') {
    productId = firstUuid(it?.dishId, it?.dishDetails?.dishId);
  }

  const row: Record<string, unknown> = {
    vertical_type: vertical,
    product_name:
      vertical === 'food'
        ? String(it?.name || it?.dishDetails?.restaurantName || 'Taom')
        : String(it?.name || it?.title || 'Mahsulot'),
    variant_name: String(
      it?.variantName ||
        it?.selectedVariant ||
        it?.variantDetails?.name ||
        '',
    ),
    quantity: qty,
    unit_price: unit,
    total_amount: lineTotal,
    currency_code: currencyCode,
  };

  if (listingId) {
    row.listing_id = listingId;
    if (productId) row.product_id = productId;
  } else if (variantId) {
    row.product_variant_id = variantId;
    if (productId) row.product_id = productId;
  } else if (productId) {
    row.product_id = productId;
  }

  const b = it?.branchId || it?.shopBranchId || fallbackBranchId;
  if (isUuid(b)) row.branch_id = b;
  return row;
};

const edgeBase = () =>
  `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

export type CheckoutOrderType = 'market' | 'shop' | 'food' | 'rental';

export interface MarketplaceV2SyncInput {
  orderType: CheckoutOrderType;
  customerName: string;
  customerPhone: string;
  cartItems: any[];
  finalTotal: number;
  deliveryPrice: number;
  paymentMethod: string;
  promoCode: string | null;
  bonusUsed: number;
  computedAddressText: string;
  customerLat: number | null;
  customerLng: number | null;
  branchId: string | null;
  deliveryZoneId: string | null;
  /** KV/legacy order id — idempotency for payments row */
  legacyOrderId: string;
}

const mapVerticalType = (orderType: CheckoutOrderType): string => {
  if (orderType === 'shop') return 'shop';
  if (orderType === 'food') return 'food';
  if (orderType === 'rental') return 'rental';
  return 'market';
};

const buildPaymentPayload = (paymentMethod: string, finalTotal: number, legacyOrderId: string) => {
  const pm = String(paymentMethod || '').toLowerCase();
  const base = {
    amount: finalTotal,
    currency_code: 'UZS',
    idempotency_key: `legacy_${String(legacyOrderId).slice(0, 120)}_${pm}`,
    merchant_order_ref: String(legacyOrderId).slice(0, 120),
  };

  if (pm === 'cash') {
    return {
      ...base,
      provider: 'cash',
      method_type: 'cash_on_delivery',
      status: 'pending',
    };
  }
  if (pm === 'qr' || pm === 'qrcode') {
    return {
      ...base,
      provider: 'bank_transfer',
      method_type: 'bank_transfer',
      status: 'pending',
    };
  }
  if (pm === 'click' || pm === 'click_card') {
    return {
      ...base,
      provider: 'click',
      method_type: 'online',
      status: 'paid',
    };
  }
  if (pm === 'payme') {
    return {
      ...base,
      provider: 'payme',
      method_type: 'online',
      status: 'paid',
    };
  }
  if (pm === 'atmos') {
    return {
      ...base,
      provider: 'atmos',
      method_type: 'online',
      status: 'paid',
    };
  }

  return {
    ...base,
    provider: 'cash',
    method_type: 'cash_on_delivery',
    status: 'pending',
  };
};

/** `create_checkout_order` har bir qator uchun listing_id yoki product_variant_id yoki (product_id + DB da variant) talab qiladi */
export const marketplaceV2LinesAreRelationalReady = (input: MarketplaceV2SyncInput): boolean => {
  const vertical = mapVerticalType(input.orderType);
  const branchId = isUuid(input.branchId) ? input.branchId : null;
  const items = (input.cartItems || []).map((it: any) => buildV2LineItem(it, vertical, 'UZS', branchId));
  if (items.length === 0) return false;
  return items.every((row) =>
    Boolean(row.listing_id || row.product_variant_id || row.product_id),
  );
};

/** Postgres `create_checkout_order` uchun JSON; noto‘g‘ri UUID maydonlar yuborilmaydi */
export const buildMarketplaceV2OrderBody = (input: MarketplaceV2SyncInput) => {
  const vertical = mapVerticalType(input.orderType);
  const zoneId = isUuid(input.deliveryZoneId) ? input.deliveryZoneId : null;
  const branchId = isUuid(input.branchId) ? input.branchId : null;

  const items = (input.cartItems || []).map((it: any) =>
    buildV2LineItem(it, vertical, 'UZS', branchId),
  );

  return {
    currency_code: 'UZS',
    source_channel: 'web',
    promo_code: input.promoCode || null,
    bonus_used_amount: input.bonusUsed || 0,
    buyer_note: null,
    payment_requires_verification: ['qr', 'qrcode'].includes(
      String(input.paymentMethod || '').toLowerCase(),
    ),
    shipping_address: {
      type: 'shipping',
      recipient_name: input.customerName,
      recipient_phone: input.customerPhone,
      country_code: 'UZ',
      address_line1: String(input.computedAddressText || 'Manzil').slice(0, 500),
      latitude: input.customerLat,
      longitude: input.customerLng,
      ...(zoneId ? { delivery_zone_id: zoneId } : {}),
    },
    groups: [
      {
        vertical_type: vertical,
        fulfillment_type: 'delivery',
        currency_code: 'UZS',
        ...(branchId ? { branch_id: branchId } : {}),
        ...(zoneId ? { delivery_zone_id: zoneId } : {}),
        items,
      },
    ],
    payment: buildPaymentPayload(input.paymentMethod, input.finalTotal, input.legacyOrderId),
  };
};

/**
 * KV buyurtmasi yaratilgandan keyin relational jadvalga axurat qo'shish (UI bloklanmaydi).
 */
export const syncMarketplaceV2Order = async (input: MarketplaceV2SyncInput): Promise<void> => {
  if (!input.legacyOrderId) return;

  // Do‘kon: mahsulotlar KV (`shop_product`) da, Postgres `products` / `product_variants` da emas.
  // `create_checkout_order` faqat relational katalog bo‘yicha ishlaydi — shop uchun 400 chiqaradi.
  if (input.orderType === 'shop') return;

  if (!marketplaceV2LinesAreRelationalReady(input)) {
    if (import.meta.env.DEV) {
      console.info(
        '[marketplace v2 sync] skip: no listing_id / product_variant_id / product_id on lines (KV-only cart)',
        { legacyOrderId: input.legacyOrderId },
      );
    }
    return;
  }

  const body = buildMarketplaceV2OrderBody(input);
  const endpoint = `${edgeBase()}/v2/orders`;
  const headers = buildUserHeaders({ 'Content-Type': 'application/json' });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    console.warn('[marketplace v2 sync]', res.status, data?.error ?? data, {
      legacyOrderId: input.legacyOrderId,
    });

    // Some deployed RPC variants are strict with optional fields.
    // Retry once with a minimal, schema-safe payload to avoid noisy 400s.
    if (res.status === 400) {
      const fallbackBody = {
        currency_code: body.currency_code,
        source_channel: body.source_channel,
        promo_code: body.promo_code,
        bonus_used_amount: body.bonus_used_amount,
        payment_requires_verification: body.payment_requires_verification,
        shipping_address: body.shipping_address,
        groups: Array.isArray(body.groups)
          ? body.groups.map((g: any) => ({
              vertical_type: g?.vertical_type,
              fulfillment_type: g?.fulfillment_type,
              currency_code: g?.currency_code,
              ...(g?.branch_id ? { branch_id: g.branch_id } : {}),
              ...(g?.delivery_zone_id ? { delivery_zone_id: g.delivery_zone_id } : {}),
              items: Array.isArray(g?.items)
                ? g.items.map((it: any) => ({
                    vertical_type: it?.vertical_type,
                    ...(it?.product_id ? { product_id: it.product_id } : {}),
                    ...(it?.product_variant_id ? { product_variant_id: it.product_variant_id } : {}),
                    ...(it?.listing_id ? { listing_id: it.listing_id } : {}),
                    ...(it?.branch_id ? { branch_id: it.branch_id } : {}),
                    product_name: it?.product_name,
                    variant_name: it?.variant_name,
                    quantity: it?.quantity,
                    unit_price: it?.unit_price,
                    total_amount: it?.total_amount,
                    currency_code: it?.currency_code || 'UZS',
                  }))
                : [],
            }))
          : [],
        payment: body.payment,
      };

      const retryRes = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(fallbackBody),
      });
      const retryData = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok || !retryData?.success) {
        console.warn('[marketplace v2 sync retry]', retryRes.status, retryData?.error ?? retryData, {
          legacyOrderId: input.legacyOrderId,
        });
      }
    }
  }
};
