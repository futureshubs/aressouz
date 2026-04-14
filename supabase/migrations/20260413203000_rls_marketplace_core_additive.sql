-- Additive: Row Level Security on relational marketplace + KV mirror table.
-- Edge Functions use service_role — RLS ni bypass qiladi; mavjud API o‘zgarmaydi.
-- PostgREST orqali `anon`/`authenticated` to‘g‘ridan-to‘g‘ri jadvalga kirish (siyosat yo‘q) — rad etiladi.

alter table if exists public.regions enable row level security;
alter table if exists public.districts enable row level security;
alter table if exists public.users enable row level security;
alter table if exists public.user_profiles enable row level security;
alter table if exists public.addresses enable row level security;
alter table if exists public.seller_accounts enable row level security;
alter table if exists public.seller_stores enable row level security;
alter table if exists public.branches enable row level security;
alter table if exists public.catalogs enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.product_variants enable row level security;
alter table if exists public.product_media enable row level security;
alter table if exists public.inventory_items enable row level security;
alter table if exists public.inventory_movements enable row level security;
alter table if exists public.listings enable row level security;
alter table if exists public.listing_attributes enable row level security;
alter table if exists public.listing_media enable row level security;
alter table if exists public.vehicle_specs enable row level security;
alter table if exists public.property_specs enable row level security;
alter table if exists public.rental_terms enable row level security;
alter table if exists public.service_profiles enable row level security;
alter table if exists public.place_details enable row level security;
alter table if exists public.food_product_details enable row level security;
alter table if exists public.favorites enable row level security;
alter table if exists public.carts enable row level security;
alter table if exists public.cart_items enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_addresses enable row level security;
alter table if exists public.delivery_zones enable row level security;
alter table if exists public.order_groups enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.order_status_history enable row level security;
alter table if exists public.payments enable row level security;
alter table if exists public.payment_transactions enable row level security;
alter table if exists public.fulfillments enable row level security;
alter table if exists public.reviews enable row level security;
alter table if exists public.review_votes enable row level security;
alter table if exists public.legacy_kv_map enable row level security;
alter table if exists public.kv_store_27d0d16c enable row level security;
