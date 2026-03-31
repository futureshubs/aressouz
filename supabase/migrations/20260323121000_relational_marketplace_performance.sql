-- Performance support objects for the relational marketplace schema.

create materialized view if not exists seller_daily_metrics as
select
  og.seller_store_id,
  (date_trunc('day', o.created_at at time zone 'Asia/Tashkent'))::date as metric_date,
  count(distinct og.id) as order_group_count,
  count(distinct o.user_id) as unique_buyers,
  sum(og.item_count) as item_count,
  sum(og.subtotal_amount) as subtotal_amount,
  sum(og.shipping_amount) as shipping_amount,
  sum(og.total_amount) as gross_revenue,
  sum(case when o.payment_status = 'paid' then og.total_amount else 0 end) as paid_revenue
from order_groups og
join orders o on o.id = og.order_id
group by og.seller_store_id, (date_trunc('day', o.created_at at time zone 'Asia/Tashkent'))::date;

create unique index if not exists idx_seller_daily_metrics_store_date
  on seller_daily_metrics(seller_store_id, metric_date);

create index if not exists idx_seller_daily_metrics_metric_date
  on seller_daily_metrics(metric_date desc);

create materialized view if not exists product_inventory_snapshot as
select
  p.id as product_id,
  pv.id as product_variant_id,
  p.seller_store_id,
  ii.branch_id,
  sum(ii.available_quantity) as available_quantity,
  sum(ii.reserved_quantity) as reserved_quantity,
  sum(ii.incoming_quantity) as incoming_quantity,
  max(ii.updated_at) as last_inventory_update_at
from products p
join product_variants pv on pv.product_id = p.id
left join inventory_items ii on ii.product_variant_id = pv.id
group by p.id, pv.id, p.seller_store_id, ii.branch_id;

create unique index if not exists idx_product_inventory_snapshot_variant_branch
  on product_inventory_snapshot(product_variant_id, branch_id);

create index if not exists idx_product_inventory_snapshot_store
  on product_inventory_snapshot(seller_store_id, last_inventory_update_at desc);

create or replace function refresh_marketplace_materialized_views()
returns void
language plpgsql
as $$
begin
  refresh materialized view seller_daily_metrics;
  refresh materialized view product_inventory_snapshot;
end;
$$;
