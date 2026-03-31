-- Relational Marketplace Rebuild
-- Replaces KV-centric commerce storage with normalized PostgreSQL tables.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";
create extension if not exists "btree_gin";
create extension if not exists "postgis";

create type user_role as enum ('admin', 'moderator', 'seller', 'buyer', 'branch_staff', 'courier', 'support');
create type account_status as enum ('pending', 'active', 'inactive', 'suspended', 'archived');
create type vertical_type as enum ('market', 'shop', 'food', 'service', 'rental', 'property', 'vehicle', 'place');
create type seller_type as enum ('individual', 'business', 'branch_network', 'restaurant');
create type product_status as enum ('draft', 'active', 'out_of_stock', 'archived', 'blocked');
create type listing_status as enum ('draft', 'pending_review', 'active', 'paused', 'archived', 'rejected');
create type cart_status as enum ('active', 'converted', 'abandoned', 'expired');
create type order_status as enum ('created', 'awaiting_payment', 'confirmed', 'split', 'processing', 'fulfilled', 'cancelled', 'refunded', 'partially_refunded');
create type order_group_status as enum ('pending', 'accepted', 'preparing', 'ready_for_dispatch', 'in_transit', 'delivered', 'cancelled', 'returned');
create type fulfillment_status as enum ('pending', 'picking', 'packed', 'handed_over', 'out_for_delivery', 'delivered', 'failed', 'returned');
create type payment_status as enum ('initiated', 'pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded');
create type payment_provider as enum ('click', 'payme', 'aresso', 'atmos', 'cash', 'bank_transfer', 'wallet');
create type payment_method_type as enum ('online', 'cash_on_delivery', 'bank_transfer', 'wallet', 'installment');
create type address_type as enum ('home', 'work', 'pickup', 'seller_store', 'warehouse', 'billing', 'shipping');
create type order_address_role as enum ('shipping', 'billing');
create type review_target_type as enum ('product', 'listing', 'seller_store', 'service_profile', 'place');
create type inventory_movement_type as enum ('stock_in', 'stock_out', 'reserve', 'release', 'sale', 'return', 'adjustment');
create type fulfillment_type as enum ('delivery', 'pickup', 'on_site', 'digital');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists regions (
  id text primary key,
  name text not null,
  name_uz text,
  name_ru text,
  name_en text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists districts (
  id text primary key,
  region_id text not null references regions(id) on delete cascade,
  name text not null,
  name_uz text,
  name_ru text,
  name_en text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  legacy_kv_key text unique,
  phone text unique,
  email citext unique,
  role user_role not null default 'buyer',
  status account_status not null default 'pending',
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  preferred_language text not null default 'uz',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  birth_date date,
  gender text,
  bonus_balance numeric(14, 2) not null default 0,
  notifications_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  marketing_opt_in boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type address_type not null default 'shipping',
  label text,
  recipient_name text not null,
  recipient_phone text not null,
  country_code char(2) not null default 'UZ',
  region_id text references regions(id) on delete set null,
  district_id text references districts(id) on delete set null,
  postal_code text,
  address_line1 text not null,
  address_line2 text,
  landmark text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location geometry(Point, 4326),
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists seller_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  seller_type seller_type not null,
  legal_name text not null,
  brand_name text,
  tax_id text,
  registration_number text,
  status account_status not null default 'pending',
  verified_at timestamptz,
  commission_plan_code text,
  payout_method text,
  payout_account_masked text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists seller_stores (
  id uuid primary key default gen_random_uuid(),
  seller_account_id uuid not null references seller_accounts(id) on delete cascade,
  legacy_kv_key text unique,
  name text not null,
  slug citext unique,
  description text,
  phone text,
  support_phone text,
  email citext,
  logo_url text,
  banner_url text,
  region_id text references regions(id) on delete set null,
  district_id text references districts(id) on delete set null,
  address_line1 text,
  address_line2 text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location geometry(Point, 4326),
  is_delivery_enabled boolean not null default false,
  min_order_amount numeric(14, 2) not null default 0,
  default_delivery_eta_min_minutes integer,
  default_delivery_eta_max_minutes integer,
  status listing_status not null default 'pending_review',
  moderation_note text,
  telegram_chat_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  seller_store_id uuid not null references seller_stores(id) on delete cascade,
  legacy_kv_key text unique,
  manager_user_id uuid references users(id) on delete set null,
  name text not null,
  code text unique,
  phone text,
  region_id text references regions(id) on delete set null,
  district_id text references districts(id) on delete set null,
  address_line1 text,
  address_line2 text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location geometry(Point, 4326),
  is_fulfillment_node boolean not null default true,
  opens_at time,
  closes_at time,
  timezone_name text not null default 'Asia/Tashkent',
  status account_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists catalogs (
  id uuid primary key default gen_random_uuid(),
  parent_catalog_id uuid references catalogs(id) on delete set null,
  vertical_type vertical_type not null,
  code citext unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid references catalogs(id) on delete set null,
  parent_id uuid references categories(id) on delete set null,
  vertical_type vertical_type not null,
  legacy_external_id text unique,
  slug citext unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  attributes_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  legacy_kv_key text unique,
  seller_store_id uuid not null references seller_stores(id) on delete restrict,
  branch_id uuid references branches(id) on delete set null,
  category_id uuid not null references categories(id) on delete restrict,
  vertical_type vertical_type not null,
  status product_status not null default 'draft',
  sku text unique,
  slug citext unique,
  name text not null,
  short_description text,
  description text,
  brand text,
  country_of_origin text,
  unit_name text not null default 'item',
  tax_code text,
  rating_average numeric(3, 2) not null default 0,
  review_count integer not null default 0,
  favorite_count integer not null default 0,
  view_count bigint not null default 0,
  is_featured boolean not null default false,
  is_delivery_available boolean not null default true,
  min_delivery_eta_minutes integer,
  max_delivery_eta_minutes integer,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  deleted_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(short_description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'D')
  ) stored
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  legacy_external_id text,
  variant_code text,
  sku text unique,
  barcode text unique,
  name text not null,
  attribute_values jsonb not null default '{}'::jsonb,
  price_amount numeric(14, 2) not null,
  compare_at_price numeric(14, 2),
  cost_amount numeric(14, 2),
  currency_code char(3) not null default 'UZS',
  weight_grams integer,
  stock_tracking boolean not null default true,
  status product_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, variant_code)
);

create table if not exists product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video', 'document')),
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references product_variants(id) on delete cascade,
  seller_store_id uuid not null references seller_stores(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  available_quantity integer not null default 0 check (available_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  incoming_quantity integer not null default 0 check (incoming_quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_variant_id, branch_id)
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type inventory_movement_type not null,
  quantity integer not null,
  reference_type text,
  reference_id uuid,
  note text,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  legacy_kv_key text unique,
  user_id uuid references users(id) on delete set null,
  seller_store_id uuid references seller_stores(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  category_id uuid not null references categories(id) on delete restrict,
  vertical_type vertical_type not null,
  status listing_status not null default 'draft',
  title text not null,
  description text,
  price_from numeric(14, 2),
  price_to numeric(14, 2),
  currency_code char(3) not null default 'UZS',
  condition_label text,
  region_id text references regions(id) on delete set null,
  district_id text references districts(id) on delete set null,
  address_line1 text,
  address_line2 text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location geometry(Point, 4326),
  contact_name text,
  contact_phone text,
  contact_email citext,
  rating_average numeric(3, 2) not null default 0,
  review_count integer not null default 0,
  favorite_count integer not null default 0,
  view_count bigint not null default 0,
  is_featured boolean not null default false,
  verified boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(contact_name, '')), 'C')
  ) stored
);

create table if not exists listing_attributes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  attribute_key text not null,
  attribute_text text,
  attribute_number numeric(14, 2),
  attribute_boolean boolean,
  unit text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (listing_id, attribute_key)
);

create table if not exists listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video', 'document', 'panorama')),
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists vehicle_specs (
  listing_id uuid primary key references listings(id) on delete cascade,
  brand text,
  model text,
  model_year integer,
  mileage_km integer,
  fuel_type text,
  transmission_type text,
  engine_volume_cc integer,
  drivetrain text,
  color text,
  vin text,
  plates_region text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists property_specs (
  listing_id uuid primary key references listings(id) on delete cascade,
  property_type text,
  total_area_m2 numeric(12, 2),
  land_area_m2 numeric(12, 2),
  room_count integer,
  bathroom_count integer,
  floor_number integer,
  total_floors integer,
  build_year integer,
  parking_slots integer,
  is_mortgage_allowed boolean not null default false,
  is_halal_installment boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists rental_terms (
  product_id uuid primary key references products(id) on delete cascade,
  deposit_amount numeric(14, 2) not null default 0,
  daily_rate numeric(14, 2),
  weekly_rate numeric(14, 2),
  monthly_rate numeric(14, 2),
  min_rental_days integer,
  max_rental_days integer,
  late_fee_per_day numeric(14, 2),
  requires_contract boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists service_profiles (
  listing_id uuid primary key references listings(id) on delete cascade,
  pricing_model text,
  phone text,
  whatsapp text,
  telegram text,
  response_time_minutes integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists place_details (
  listing_id uuid primary key references listings(id) on delete cascade,
  place_type text,
  opening_hours text,
  website_url text,
  google_maps_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists food_product_details (
  product_id uuid primary key references products(id) on delete cascade,
  restaurant_branch_id uuid references branches(id) on delete set null,
  preparation_time_minutes integer,
  calories integer,
  spice_level integer,
  is_halal boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint favorites_one_target check (num_nonnulls(product_id, listing_id) = 1),
  unique (user_id, product_id),
  unique (user_id, listing_id)
);

create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status cart_status not null default 'active',
  currency_code char(3) not null default 'UZS',
  locked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  seller_store_id uuid references seller_stores(id) on delete set null,
  vertical_type vertical_type not null,
  product_id uuid references products(id) on delete cascade,
  product_variant_id uuid references product_variants(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null,
  currency_code char(3) not null default 'UZS',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cart_items_one_target check (num_nonnulls(product_variant_id, listing_id) = 1)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  legacy_kv_key text unique,
  user_id uuid not null references users(id) on delete restrict,
  order_number text not null unique,
  status order_status not null default 'created',
  payment_status payment_status not null default 'initiated',
  currency_code char(3) not null default 'UZS',
  subtotal_amount numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  shipping_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  item_count integer not null default 0,
  promo_code text,
  bonus_used_amount numeric(14, 2) not null default 0,
  payment_requires_verification boolean not null default false,
  source_channel text not null default 'web',
  buyer_note text,
  checkout_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  cancelled_at timestamptz,
  completed_at timestamptz
);

create table if not exists order_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  role order_address_role not null,
  type address_type not null default 'shipping',
  recipient_name text not null,
  recipient_phone text not null,
  country_code char(2) not null default 'UZ',
  region_id text references regions(id) on delete set null,
  district_id text references districts(id) on delete set null,
  postal_code text,
  address_line1 text not null,
  address_line2 text,
  landmark text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  location geometry(Point, 4326),
  delivery_zone_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  unique (order_id, role)
);

create table if not exists delivery_zones (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  legacy_kv_key text unique,
  name text not null,
  region_id text references regions(id) on delete set null,
  district_id text references districts(id) on delete set null,
  service_area geometry(Polygon, 4326),
  delivery_fee_amount numeric(14, 2) not null default 0,
  min_order_amount numeric(14, 2) not null default 0,
  eta_min_minutes integer,
  eta_max_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists order_groups (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  seller_store_id uuid references seller_stores(id) on delete restrict,
  branch_id uuid references branches(id) on delete set null,
  vertical_type vertical_type not null,
  status order_group_status not null default 'pending',
  fulfillment_type fulfillment_type not null default 'delivery',
  currency_code char(3) not null default 'UZS',
  subtotal_amount numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  shipping_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  item_count integer not null default 0,
  delivery_zone_id uuid references delivery_zones(id) on delete set null,
  promised_from_at timestamptz,
  promised_to_at timestamptz,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  order_group_id uuid not null references order_groups(id) on delete cascade,
  seller_store_id uuid references seller_stores(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  vertical_type vertical_type not null,
  product_id uuid references products(id) on delete set null,
  product_variant_id uuid references product_variants(id) on delete set null,
  listing_id uuid references listings(id) on delete set null,
  product_name text not null,
  variant_name text,
  sku text,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(14, 2) not null,
  compare_at_price numeric(14, 2),
  discount_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null,
  currency_code char(3) not null default 'UZS',
  requires_confirmation boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint order_items_one_target check (num_nonnulls(product_variant_id, listing_id) = 1)
);

create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  order_group_id uuid references order_groups(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  actor_user_id uuid references users(id) on delete set null,
  actor_type text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint order_status_history_scope check (num_nonnulls(order_id, order_group_id) >= 1)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider payment_provider not null,
  method_type payment_method_type not null,
  status payment_status not null default 'initiated',
  amount numeric(14, 2) not null,
  currency_code char(3) not null default 'UZS',
  idempotency_key text not null unique,
  merchant_order_ref text,
  provider_payment_ref text unique,
  provider_checkout_url text,
  failure_code text,
  failure_reason text,
  is_test boolean not null default false,
  requested_at timestamptz not null default timezone('utc', now()),
  authorized_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  transaction_type text not null,
  provider_event_id text,
  provider_status text,
  amount numeric(14, 2),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_group_id uuid not null references order_groups(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  delivery_zone_id uuid references delivery_zones(id) on delete set null,
  assigned_user_id uuid references users(id) on delete set null,
  status fulfillment_status not null default 'pending',
  tracking_number text,
  tracking_url text,
  handoff_code text,
  picked_at timestamptz,
  packed_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  order_item_id uuid references order_items(id) on delete set null,
  target_type review_target_type not null,
  product_id uuid references products(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  seller_store_id uuid references seller_stores(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  is_verified_purchase boolean not null default false,
  is_published boolean not null default false,
  helpful_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reviews_target_scope check (num_nonnulls(product_id, listing_id, seller_store_id) = 1)
);

create table if not exists review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  is_helpful boolean not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (review_id, user_id)
);

create table if not exists legacy_kv_map (
  entity_type text not null,
  legacy_key text not null,
  new_table text not null,
  new_id uuid not null,
  payload_hash text,
  migrated_at timestamptz not null default timezone('utc', now()),
  primary key (entity_type, legacy_key)
);

alter table order_addresses
  add constraint fk_order_addresses_delivery_zone
  foreign key (delivery_zone_id) references delivery_zones(id) on delete set null;

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
        nullif(v_item->>'product_id', '')::uuid,
        nullif(v_item->>'product_variant_id', '')::uuid,
        nullif(v_item->>'listing_id', '')::uuid,
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

create index if not exists idx_districts_region_id on districts(region_id);
create index if not exists idx_users_auth_user_id on users(auth_user_id);
create index if not exists idx_users_role_status on users(role, status);
create index if not exists idx_users_created_at on users(created_at desc);
create index if not exists idx_user_profiles_bonus_balance on user_profiles(bonus_balance);
create index if not exists idx_addresses_user_id on addresses(user_id);
create index if not exists idx_addresses_region_district on addresses(region_id, district_id);
create index if not exists idx_addresses_location on addresses using gist(location);
create unique index if not exists idx_addresses_default_per_user on addresses(user_id) where is_default = true;

create index if not exists idx_seller_accounts_user_id on seller_accounts(user_id);
create index if not exists idx_seller_accounts_status on seller_accounts(status);
create index if not exists idx_seller_stores_account_id on seller_stores(seller_account_id);
create index if not exists idx_seller_stores_status on seller_stores(status);
create index if not exists idx_seller_stores_region_district on seller_stores(region_id, district_id);
create index if not exists idx_seller_stores_location on seller_stores using gist(location);
create index if not exists idx_branches_store_id on branches(seller_store_id);
create index if not exists idx_branches_manager_user_id on branches(manager_user_id);
create index if not exists idx_branches_region_district on branches(region_id, district_id);
create index if not exists idx_branches_location on branches using gist(location);

create index if not exists idx_catalogs_vertical_active on catalogs(vertical_type, is_active);
create index if not exists idx_categories_catalog_id on categories(catalog_id);
create index if not exists idx_categories_parent_id on categories(parent_id);
create index if not exists idx_categories_vertical_active on categories(vertical_type, is_active);
create index if not exists idx_categories_name_trgm on categories using gin(name gin_trgm_ops);

create index if not exists idx_products_store_status on products(seller_store_id, status);
create index if not exists idx_products_branch_status on products(branch_id, status);
create index if not exists idx_products_category_status on products(category_id, status);
create index if not exists idx_products_vertical_status on products(vertical_type, status);
create index if not exists idx_products_published_at on products(published_at desc);
create index if not exists idx_products_featured_active on products(is_featured, status) where is_featured = true and status = 'active';
create index if not exists idx_products_search_vector on products using gin(search_vector);
create index if not exists idx_product_variants_product_id on product_variants(product_id);
create index if not exists idx_product_variants_status on product_variants(status);
create index if not exists idx_product_media_product_id on product_media(product_id);
create index if not exists idx_inventory_items_variant_branch on inventory_items(product_variant_id, branch_id);
create index if not exists idx_inventory_items_store_id on inventory_items(seller_store_id);
create index if not exists idx_inventory_movements_inventory_item_id on inventory_movements(inventory_item_id, created_at desc);
create index if not exists idx_inventory_movements_reference on inventory_movements(reference_type, reference_id);

create index if not exists idx_listings_user_id on listings(user_id);
create index if not exists idx_listings_store_id on listings(seller_store_id);
create index if not exists idx_listings_branch_id on listings(branch_id);
create index if not exists idx_listings_category_status on listings(category_id, status);
create index if not exists idx_listings_vertical_status on listings(vertical_type, status);
create index if not exists idx_listings_region_district on listings(region_id, district_id);
create index if not exists idx_listings_location on listings using gist(location);
create index if not exists idx_listings_search_vector on listings using gin(search_vector);
create index if not exists idx_listing_attributes_listing_id on listing_attributes(listing_id);
create index if not exists idx_listing_media_listing_id on listing_media(listing_id);

create index if not exists idx_favorites_user_id on favorites(user_id, created_at desc);
create index if not exists idx_favorites_product_id on favorites(product_id) where product_id is not null;
create index if not exists idx_favorites_listing_id on favorites(listing_id) where listing_id is not null;
create unique index if not exists idx_carts_active_user on carts(user_id) where status = 'active';
create index if not exists idx_cart_items_cart_id on cart_items(cart_id);
create index if not exists idx_cart_items_store_id on cart_items(seller_store_id);
create index if not exists idx_cart_items_variant_id on cart_items(product_variant_id) where product_variant_id is not null;
create index if not exists idx_cart_items_listing_id on cart_items(listing_id) where listing_id is not null;

create index if not exists idx_orders_user_id_created_at on orders(user_id, created_at desc);
create index if not exists idx_orders_status_created_at on orders(status, created_at desc);
create index if not exists idx_orders_payment_status on orders(payment_status, created_at desc);
create index if not exists idx_orders_checkout_token on orders(checkout_token);
create index if not exists idx_order_addresses_order_id on order_addresses(order_id);
create index if not exists idx_delivery_zones_branch_id on delivery_zones(branch_id);
create index if not exists idx_delivery_zones_active on delivery_zones(branch_id, is_active);
create index if not exists idx_delivery_zones_area on delivery_zones using gist(service_area);
create index if not exists idx_order_groups_order_id on order_groups(order_id);
create index if not exists idx_order_groups_store_status on order_groups(seller_store_id, status, created_at desc);
create index if not exists idx_order_groups_branch_status on order_groups(branch_id, status, created_at desc);
create index if not exists idx_order_groups_delivery_zone on order_groups(delivery_zone_id);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_order_items_group_id on order_items(order_group_id);
create index if not exists idx_order_items_variant_id on order_items(product_variant_id) where product_variant_id is not null;
create index if not exists idx_order_items_listing_id on order_items(listing_id) where listing_id is not null;
create index if not exists idx_order_status_history_order_id on order_status_history(order_id, created_at desc);
create index if not exists idx_order_status_history_group_id on order_status_history(order_group_id, created_at desc);

create index if not exists idx_payments_order_id on payments(order_id, created_at desc);
create index if not exists idx_payments_status_provider on payments(status, provider, created_at desc);
create index if not exists idx_payments_provider_payment_ref on payments(provider_payment_ref);
create index if not exists idx_payment_transactions_payment_id on payment_transactions(payment_id, created_at desc);
create index if not exists idx_payment_transactions_provider_event_id on payment_transactions(provider_event_id);

create index if not exists idx_fulfillments_group_id on fulfillments(order_group_id);
create index if not exists idx_fulfillments_branch_status on fulfillments(branch_id, status, created_at desc);
create index if not exists idx_fulfillments_assigned_user on fulfillments(assigned_user_id, status);

create index if not exists idx_reviews_target on reviews(target_type, created_at desc);
create index if not exists idx_reviews_product_id on reviews(product_id) where product_id is not null;
create index if not exists idx_reviews_listing_id on reviews(listing_id) where listing_id is not null;
create index if not exists idx_reviews_store_id on reviews(seller_store_id) where seller_store_id is not null;
create unique index if not exists idx_reviews_verified_purchase_unique on reviews(user_id, order_item_id) where order_item_id is not null;
create index if not exists idx_review_votes_review_id on review_votes(review_id);

create index if not exists idx_legacy_kv_map_new_table on legacy_kv_map(new_table, migrated_at desc);

create trigger trg_regions_updated_at before update on regions for each row execute function set_updated_at();
create trigger trg_districts_updated_at before update on districts for each row execute function set_updated_at();
create trigger trg_users_updated_at before update on users for each row execute function set_updated_at();
create trigger trg_user_profiles_updated_at before update on user_profiles for each row execute function set_updated_at();
create trigger trg_addresses_updated_at before update on addresses for each row execute function set_updated_at();
create trigger trg_seller_accounts_updated_at before update on seller_accounts for each row execute function set_updated_at();
create trigger trg_seller_stores_updated_at before update on seller_stores for each row execute function set_updated_at();
create trigger trg_branches_updated_at before update on branches for each row execute function set_updated_at();
create trigger trg_catalogs_updated_at before update on catalogs for each row execute function set_updated_at();
create trigger trg_categories_updated_at before update on categories for each row execute function set_updated_at();
create trigger trg_products_updated_at before update on products for each row execute function set_updated_at();
create trigger trg_product_variants_updated_at before update on product_variants for each row execute function set_updated_at();
create trigger trg_inventory_items_updated_at before update on inventory_items for each row execute function set_updated_at();
create trigger trg_listings_updated_at before update on listings for each row execute function set_updated_at();
create trigger trg_vehicle_specs_updated_at before update on vehicle_specs for each row execute function set_updated_at();
create trigger trg_property_specs_updated_at before update on property_specs for each row execute function set_updated_at();
create trigger trg_rental_terms_updated_at before update on rental_terms for each row execute function set_updated_at();
create trigger trg_service_profiles_updated_at before update on service_profiles for each row execute function set_updated_at();
create trigger trg_place_details_updated_at before update on place_details for each row execute function set_updated_at();
create trigger trg_food_product_details_updated_at before update on food_product_details for each row execute function set_updated_at();
create trigger trg_carts_updated_at before update on carts for each row execute function set_updated_at();
create trigger trg_orders_updated_at before update on orders for each row execute function set_updated_at();
create trigger trg_delivery_zones_updated_at before update on delivery_zones for each row execute function set_updated_at();
create trigger trg_order_groups_updated_at before update on order_groups for each row execute function set_updated_at();
create trigger trg_payments_updated_at before update on payments for each row execute function set_updated_at();
create trigger trg_fulfillments_updated_at before update on fulfillments for each row execute function set_updated_at();
create trigger trg_reviews_updated_at before update on reviews for each row execute function set_updated_at();
