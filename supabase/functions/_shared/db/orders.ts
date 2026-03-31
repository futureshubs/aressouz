import { getAdminDb } from "./client.ts";
import { resolveUserIdentity } from "./users.ts";

export interface OrderAddressInput {
  type?: "home" | "work" | "pickup" | "seller_store" | "warehouse" | "billing" | "shipping";
  recipient_name: string;
  recipient_phone: string;
  country_code?: string;
  region_id?: string | null;
  district_id?: string | null;
  postal_code?: string | null;
  address_line1: string;
  address_line2?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  delivery_zone_id?: string | null;
}

export interface OrderGroupItemInput {
  seller_store_id?: string | null;
  branch_id?: string | null;
  vertical_type: "market" | "shop" | "food" | "service" | "rental" | "property" | "vehicle" | "place";
  product_id?: string | null;
  product_variant_id?: string | null;
  listing_id?: string | null;
  product_name: string;
  variant_name?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  compare_at_price?: number | null;
  discount_amount?: number | null;
  tax_amount?: number | null;
  total_amount: number;
  currency_code?: string;
  requires_confirmation?: boolean;
}

export interface OrderGroupInput {
  seller_store_id?: string | null;
  branch_id?: string | null;
  vertical_type: "market" | "shop" | "food" | "service" | "rental" | "property" | "vehicle" | "place";
  fulfillment_type?: "delivery" | "pickup" | "on_site" | "digital";
  currency_code?: string;
  delivery_zone_id?: string | null;
  promised_from_at?: string | null;
  promised_to_at?: string | null;
  note?: string | null;
  items: OrderGroupItemInput[];
}

export interface PaymentInput {
  provider: "click" | "payme" | "aresso" | "atmos" | "cash" | "bank_transfer" | "wallet";
  method_type: "online" | "cash_on_delivery" | "bank_transfer" | "wallet" | "installment";
  status?: "initiated" | "pending" | "authorized" | "paid" | "failed" | "cancelled" | "refunded" | "partially_refunded";
  amount: number;
  currency_code?: string;
  idempotency_key: string;
  merchant_order_ref?: string | null;
  provider_payment_ref?: string | null;
  provider_checkout_url?: string | null;
  is_test?: boolean;
}

export interface CreateOrderInput {
  userId?: string | null;
  authUserId?: string | null;
  currency_code?: string;
  source_channel?: string;
  promo_code?: string | null;
  bonus_used_amount?: number;
  buyer_note?: string | null;
  payment_requires_verification?: boolean;
  shipping_address: OrderAddressInput;
  billing_address?: OrderAddressInput | null;
  groups: OrderGroupInput[];
  payment?: PaymentInput | null;
}

const mapKvOrderStatusToV2 = (raw: string): any => {
  const s = String(raw || '').toLowerCase().trim();
  if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['delivered', 'completed'].includes(s)) return 'fulfilled';
  if (['awaiting_receipt', 'awaiting receipt', 'awaiting_customer_confirm'].includes(s)) return 'processing';
  if (['pending', 'awaiting_payment', 'awaiting payment'].includes(s)) return 'awaiting_payment';
  if (['confirmed'].includes(s)) return 'confirmed';
  if (['processing'].includes(s)) return 'processing';
  if (
    ['split', 'preparing', 'with_courier', 'delivering', 'ready_for_dispatch', 'arrived'].includes(s)
  ) {
    return 'processing';
  }
  // Fallback to confirmed so UI doesn't stall on unknown states
  return 'confirmed';
};

const mapKvPaymentStatusToV2 = (raw: string): any => {
  const s = String(raw || '').toLowerCase().trim();
  if (['paid', 'completed', 'success'].includes(s)) return 'paid';
  if (['failed', 'error'].includes(s)) return 'failed';
  if (['refunded', 'returned'].includes(s)) return 'refunded';
  if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['partially_refunded'].includes(s)) return 'partially_refunded';
  // default / pending
  return s === 'authorized' ? 'authorized' : 'pending';
};

const buildLegacyMerchantRef = (legacyOrderId: string) =>
  String(legacyOrderId || '').slice(0, 120);

export const createMarketplaceOrder = async (input: CreateOrderInput) => {
  const db = getAdminDb();
  const user = await resolveUserIdentity({ userId: input.userId, authUserId: input.authUserId });

  const { data, error } = await db.rpc("create_checkout_order", {
    p_user_id: user.id,
    p_currency_code: input.currency_code || "UZS",
    p_source_channel: input.source_channel || "web",
    p_promo_code: input.promo_code || null,
    p_bonus_used_amount: input.bonus_used_amount ?? 0,
    p_buyer_note: input.buyer_note || null,
    p_payment_requires_verification: input.payment_requires_verification ?? false,
    p_shipping_address: input.shipping_address,
    p_billing_address: input.billing_address || null,
    p_groups: input.groups,
    p_payment: input.payment || null,
  });

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  return data;
};

export const getBuyerOrders = async (args: {
  userId?: string | null;
  authUserId?: string | null;
  limit?: number;
  offset?: number;
}) => {
  const db = getAdminDb();
  const user = await resolveUserIdentity(args);
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const offset = Math.max(args.offset ?? 0, 0);

  const { data, error, count } = await db
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      payment_status,
      currency_code,
      subtotal_amount,
      discount_amount,
      tax_amount,
      shipping_amount,
      total_amount,
      item_count,
      promo_code,
      bonus_used_amount,
      created_at,
      updated_at,
      groups:order_groups (
        id,
        seller_store_id,
        branch_id,
        vertical_type,
        status,
        fulfillment_type,
        subtotal_amount,
        shipping_amount,
        total_amount,
        items:order_items (
          id,
          product_id,
          product_variant_id,
          listing_id,
          product_name,
          variant_name,
          quantity,
          unit_price,
          total_amount,
          currency_code
        )
      ),
      payments (
        id,
        provider,
        method_type,
        status,
        amount,
        currency_code,
        provider_payment_ref,
        created_at
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to load buyer orders: ${error.message}`);
  }

  return {
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  };
};

export const getSellerOrderQueue = async (args: {
  sellerStoreId: string;
  status?: string | null;
  limit?: number;
  offset?: number;
}) => {
  const db = getAdminDb();
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const offset = Math.max(args.offset ?? 0, 0);

  let query = db
    .from("order_groups")
    .select(`
      id,
      order_id,
      seller_store_id,
      branch_id,
      vertical_type,
      status,
      fulfillment_type,
      subtotal_amount,
      shipping_amount,
      total_amount,
      item_count,
      note,
      created_at,
      updated_at,
      order:order_id (
        id,
        order_number,
        user_id,
        status,
        payment_status,
        total_amount,
        created_at
      ),
      items:order_items (
        id,
        product_name,
        variant_name,
        quantity,
        unit_price,
        total_amount,
        currency_code
      ),
      fulfillments (
        id,
        status,
        tracking_number,
        dispatched_at,
        delivered_at
      )
    `, { count: "exact" })
    .eq("seller_store_id", args.sellerStoreId);

  if (args.status) {
    query = query.eq("status", args.status);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to load seller order queue: ${error.message}`);
  }

  return {
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  };
};

export const syncRelationalOrderFromLegacy = async (args: {
  legacyOrderId: string;
  kvStatus?: string | null;
  kvPaymentStatus?: string | null;
  paymentRequiresVerification?: boolean | null;
}): Promise<void> => {
  try {
    const db = getAdminDb();
    const legacyMerchantRef = buildLegacyMerchantRef(args.legacyOrderId);
    if (!legacyMerchantRef) return;

    const payment = await db
      .from('payments')
      .select('order_id, status')
      .eq('merchant_order_ref', legacyMerchantRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payment.data?.order_id) {
      console.warn('[v2 sync] payments row not found for legacy order:', {
        legacyOrderId: args.legacyOrderId,
      });
      return;
    }

    const orderId = payment.data.order_id as string;
    const v2Status = mapKvOrderStatusToV2(args.kvStatus || 'confirmed');
    const v2PaymentStatus = mapKvPaymentStatusToV2(args.kvPaymentStatus || 'pending');
    const nextPaymentRequiresVerification =
      typeof args.paymentRequiresVerification === 'boolean'
        ? args.paymentRequiresVerification
        : false;

    // Update orders (status/payment requirements)
    await db
      .from('orders')
      .update({
        status: v2Status,
        payment_status: v2PaymentStatus,
        payment_requires_verification: nextPaymentRequiresVerification,
      })
      .eq('id', orderId);

    // Update payments status too (so payment_history UI becomes correct)
    await db
      .from('payments')
      .update({ status: v2PaymentStatus })
      .eq('order_id', orderId)
      .eq('merchant_order_ref', legacyMerchantRef);
  } catch (e: any) {
    // Never block UX due to sync problems
    console.warn('[v2 sync] failed:', e?.message || e);
  }
};
