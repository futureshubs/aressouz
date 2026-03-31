-- Branch/market carts often send product_id only; variants may exist but not be `active`.
-- Prefer active variants, then fall back to any variant so create_checkout_order does not 400.

create or replace function create_checkout_order(
  p_user_id uuid,
  p_currency_code char(3),
  p_source_channel text,
  p_promo_code text,
  p_bonus_used_amount numeric,
  p_buyer_note text,
  p_payment_requires_verification boolean,
  p_shipping_address jsonb,
  p_billing_address jsonb default null,
  p_groups jsonb default '[]'::jsonb,
  p_payment jsonb default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text := 'ORD-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(replace(v_order_id::text, '-', ''), 1, 8);
  v_group jsonb;
  v_item jsonb;
  v_group_id uuid;
  v_order_subtotal numeric(14, 2) := 0;
  v_order_discount numeric(14, 2) := 0;
  v_order_tax numeric(14, 2) := 0;
  v_order_shipping numeric(14, 2) := 0;
  v_order_total numeric(14, 2) := 0;
  v_order_items integer := 0;
  v_group_subtotal numeric(14, 2);
  v_group_discount numeric(14, 2);
  v_group_tax numeric(14, 2);
  v_group_shipping numeric(14, 2);
  v_group_total numeric(14, 2);
  v_group_items integer;
  v_ins_pid uuid;
  v_ins_pvid uuid;
  v_ins_lid uuid;
begin
  insert into orders (
    id,
    user_id,
    order_number,
    status,
    payment_status,
    currency_code,
    promo_code,
    bonus_used_amount,
    payment_requires_verification,
    source_channel,
    buyer_note
  ) values (
    v_order_id,
    p_user_id,
    v_order_number,
    case
      when p_payment is null then 'confirmed'::order_status
      when coalesce(p_payment->>'status', 'initiated') in ('paid', 'authorized') then 'confirmed'::order_status
      else 'awaiting_payment'::order_status
    end,
    coalesce((p_payment->>'status')::payment_status, 'initiated'::payment_status),
    coalesce(p_currency_code, 'UZS'),
    p_promo_code,
    coalesce(p_bonus_used_amount, 0),
    coalesce(p_payment_requires_verification, false),
    coalesce(p_source_channel, 'web'),
    p_buyer_note
  );

  if p_shipping_address is not null then
    insert into order_addresses (
      order_id,
      role,
      type,
      recipient_name,
      recipient_phone,
      country_code,
      region_id,
      district_id,
      postal_code,
      address_line1,
      address_line2,
      landmark,
      latitude,
      longitude,
      delivery_zone_id
    ) values (
      v_order_id,
      'shipping',
      coalesce((p_shipping_address->>'type')::address_type, 'shipping'::address_type),
      coalesce(p_shipping_address->>'recipient_name', 'Customer'),
      coalesce(p_shipping_address->>'recipient_phone', ''),
      coalesce(p_shipping_address->>'country_code', 'UZ'),
      nullif(p_shipping_address->>'region_id', ''),
      nullif(p_shipping_address->>'district_id', ''),
      nullif(p_shipping_address->>'postal_code', ''),
      coalesce(p_shipping_address->>'address_line1', 'Unknown address'),
      nullif(p_shipping_address->>'address_line2', ''),
      nullif(p_shipping_address->>'landmark', ''),
      nullif(p_shipping_address->>'latitude', '')::numeric,
      nullif(p_shipping_address->>'longitude', '')::numeric,
      nullif(p_shipping_address->>'delivery_zone_id', '')::uuid
    );
  end if;

  if p_billing_address is not null then
    insert into order_addresses (
      order_id,
      role,
      type,
      recipient_name,
      recipient_phone,
      country_code,
      region_id,
      district_id,
      postal_code,
      address_line1,
      address_line2,
      landmark,
      latitude,
      longitude,
      delivery_zone_id
    ) values (
      v_order_id,
      'billing',
      coalesce((p_billing_address->>'type')::address_type, 'billing'::address_type),
      coalesce(p_billing_address->>'recipient_name', 'Customer'),
      coalesce(p_billing_address->>'recipient_phone', ''),
      coalesce(p_billing_address->>'country_code', 'UZ'),
      nullif(p_billing_address->>'region_id', ''),
      nullif(p_billing_address->>'district_id', ''),
      nullif(p_billing_address->>'postal_code', ''),
      coalesce(p_billing_address->>'address_line1', 'Unknown address'),
      nullif(p_billing_address->>'address_line2', ''),
      nullif(p_billing_address->>'landmark', ''),
      nullif(p_billing_address->>'latitude', '')::numeric,
      nullif(p_billing_address->>'longitude', '')::numeric,
      nullif(p_billing_address->>'delivery_zone_id', '')::uuid
    );
  end if;

  for v_group in
    select value from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb))
  loop
    v_group_id := gen_random_uuid();
    v_group_subtotal := 0;
    v_group_discount := 0;
    v_group_tax := 0;
    v_group_shipping := coalesce(nullif(v_group->>'shipping_amount', '')::numeric, 0);
    v_group_total := 0;
    v_group_items := 0;

    insert into order_groups (
      id,
      order_id,
      seller_store_id,
      branch_id,
      vertical_type,
      status,
      fulfillment_type,
      currency_code,
      delivery_zone_id,
      promised_from_at,
      promised_to_at,
      note
    ) values (
      v_group_id,
      v_order_id,
      nullif(v_group->>'seller_store_id', '')::uuid,
      nullif(v_group->>'branch_id', '')::uuid,
      coalesce((v_group->>'vertical_type')::vertical_type, 'market'::vertical_type),
      'pending',
      coalesce((v_group->>'fulfillment_type')::fulfillment_type, 'delivery'::fulfillment_type),
      coalesce(v_group->>'currency_code', p_currency_code, 'UZS'),
      nullif(v_group->>'delivery_zone_id', '')::uuid,
      nullif(v_group->>'promised_from_at', '')::timestamptz,
      nullif(v_group->>'promised_to_at', '')::timestamptz,
      nullif(v_group->>'note', '')
    );

    for v_item in
      select value from jsonb_array_elements(coalesce(v_group->'items', '[]'::jsonb))
    loop
      v_group_subtotal := v_group_subtotal + coalesce(nullif(v_item->>'total_amount', '')::numeric, 0);
      v_group_discount := v_group_discount + coalesce(nullif(v_item->>'discount_amount', '')::numeric, 0);
      v_group_tax := v_group_tax + coalesce(nullif(v_item->>'tax_amount', '')::numeric, 0);
      v_group_total := v_group_total + coalesce(nullif(v_item->>'total_amount', '')::numeric, 0);
      v_group_items := v_group_items + 1;

      v_ins_pid := nullif(v_item->>'product_id', '')::uuid;
      v_ins_pvid := nullif(v_item->>'product_variant_id', '')::uuid;
      v_ins_lid := nullif(v_item->>'listing_id', '')::uuid;

      if v_ins_pvid is null and v_ins_lid is null and v_ins_pid is not null then
        select pv.id into v_ins_pvid
        from product_variants pv
        where pv.product_id = v_ins_pid
        order by case when pv.status = 'active'::product_status then 0 else 1 end, pv.created_at asc
        limit 1;
      end if;

      if v_ins_pvid is not null and v_ins_lid is not null then
        raise exception 'order_items: send only one of listing_id or product_variant_id';
      end if;

      if v_ins_pvid is null and v_ins_lid is null then
        raise exception 'order_items: need listing_id, product_variant_id, or product_id that has a variant in the catalog';
      end if;

      insert into order_items (
        order_id,
        order_group_id,
        seller_store_id,
        branch_id,
        vertical_type,
        product_id,
        product_variant_id,
        listing_id,
        product_name,
        variant_name,
        sku,
        quantity,
        unit_price,
        compare_at_price,
        discount_amount,
        tax_amount,
        total_amount,
        currency_code,
        requires_confirmation
      ) values (
        v_order_id,
        v_group_id,
        nullif(v_item->>'seller_store_id', '')::uuid,
        nullif(v_item->>'branch_id', '')::uuid,
        coalesce((v_item->>'vertical_type')::vertical_type, (v_group->>'vertical_type')::vertical_type, 'market'::vertical_type),
        v_ins_pid,
        v_ins_pvid,
        v_ins_lid,
        coalesce(v_item->>'product_name', 'Item'),
        nullif(v_item->>'variant_name', ''),
        nullif(v_item->>'sku', ''),
        coalesce(nullif(v_item->>'quantity', '')::numeric, 1),
        coalesce(nullif(v_item->>'unit_price', '')::numeric, 0),
        nullif(v_item->>'compare_at_price', '')::numeric,
        coalesce(nullif(v_item->>'discount_amount', '')::numeric, 0),
        coalesce(nullif(v_item->>'tax_amount', '')::numeric, 0),
        coalesce(nullif(v_item->>'total_amount', '')::numeric, 0),
        coalesce(v_item->>'currency_code', p_currency_code, 'UZS'),
        coalesce(nullif(v_item->>'requires_confirmation', '')::boolean, false)
      );
    end loop;

    update order_groups
    set
      subtotal_amount = v_group_subtotal,
      discount_amount = v_group_discount,
      tax_amount = v_group_tax,
      shipping_amount = v_group_shipping,
      total_amount = v_group_total + v_group_shipping,
      item_count = v_group_items
    where id = v_group_id;

    v_order_subtotal := v_order_subtotal + v_group_subtotal;
    v_order_discount := v_order_discount + v_group_discount;
    v_order_tax := v_order_tax + v_group_tax;
    v_order_shipping := v_order_shipping + v_group_shipping;
    v_order_total := v_order_total + v_group_total + v_group_shipping;
    v_order_items := v_order_items + v_group_items;
  end loop;

  update orders
  set
    subtotal_amount = v_order_subtotal,
    discount_amount = v_order_discount,
    tax_amount = v_order_tax,
    shipping_amount = v_order_shipping,
    total_amount = v_order_total,
    item_count = v_order_items
  where id = v_order_id;

  if p_payment is not null then
    insert into payments (
      order_id,
      provider,
      method_type,
      status,
      amount,
      currency_code,
      idempotency_key,
      merchant_order_ref,
      provider_payment_ref,
      provider_checkout_url,
      is_test
    ) values (
      v_order_id,
      coalesce((p_payment->>'provider')::payment_provider, 'cash'::payment_provider),
      coalesce((p_payment->>'method_type')::payment_method_type, 'cash_on_delivery'::payment_method_type),
      coalesce((p_payment->>'status')::payment_status, 'initiated'::payment_status),
      coalesce(nullif(p_payment->>'amount', '')::numeric, v_order_total),
      coalesce(p_payment->>'currency_code', p_currency_code, 'UZS'),
      coalesce(p_payment->>'idempotency_key', gen_random_uuid()::text),
      nullif(p_payment->>'merchant_order_ref', ''),
      nullif(p_payment->>'provider_payment_ref', ''),
      nullif(p_payment->>'provider_checkout_url', ''),
      coalesce(nullif(p_payment->>'is_test', '')::boolean, false)
    );
  end if;

  insert into order_status_history (
    order_id,
    from_status,
    to_status,
    note,
    actor_type
  ) values (
    v_order_id,
    null,
    (select status::text from orders where id = v_order_id),
    'Order created through relational checkout pipeline',
    'system'
  );

  return v_order_id;
end;
$$;
