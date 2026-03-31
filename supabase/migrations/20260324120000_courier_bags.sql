-- Courier delivery bags (so'mkalar): relational storage for edge function (service role).

create table if not exists public.courier_bags (
  id text primary key,
  branch_id text not null,
  bag_number text not null,
  bag_code text not null default '',
  qr_code text not null default '',
  bag_type text not null default 'standard',
  capacity_level text not null default 'single_order',
  status text not null default 'available_in_branch',
  notes text not null default '',
  current_courier_id text,
  current_order_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted boolean not null default false
);

create unique index if not exists courier_bags_branch_bag_number_active_uq
  on public.courier_bags (branch_id, lower(trim(bag_number)))
  where deleted = false;

create index if not exists courier_bags_branch_id_idx on public.courier_bags (branch_id) where deleted = false;
create index if not exists courier_bags_courier_idx on public.courier_bags (current_courier_id) where deleted = false;
create index if not exists courier_bags_order_idx on public.courier_bags (current_order_id) where deleted = false;

create table if not exists public.courier_bag_assignments (
  id text primary key,
  bag_id text not null references public.courier_bags (id) on delete cascade,
  branch_id text not null,
  courier_id text not null,
  assigned_at timestamptz not null,
  released_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists courier_bag_assignments_bag_active_idx
  on public.courier_bag_assignments (bag_id) where is_active = true;
create index if not exists courier_bag_assignments_courier_active_idx
  on public.courier_bag_assignments (courier_id) where is_active = true;

create table if not exists public.courier_bag_order_links (
  id text primary key,
  bag_id text not null references public.courier_bags (id) on delete cascade,
  order_id text not null,
  courier_id text not null,
  attached_at timestamptz not null,
  detached_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists courier_bag_order_links_order_active_idx
  on public.courier_bag_order_links (order_id) where is_active = true;
create index if not exists courier_bag_order_links_bag_active_idx
  on public.courier_bag_order_links (bag_id) where is_active = true;

create table if not exists public.courier_bag_history (
  id text primary key,
  bag_id text not null,
  branch_id text,
  courier_id text,
  order_id text,
  actor_type text not null,
  actor_id text,
  from_status text,
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists courier_bag_history_bag_idx on public.courier_bag_history (bag_id);

alter table public.courier_bags enable row level security;
alter table public.courier_bag_assignments enable row level security;
alter table public.courier_bag_order_links enable row level security;
alter table public.courier_bag_history enable row level security;

-- Edge function uses service role (bypasses RLS). Block direct anon/authenticated API access.
drop policy if exists "courier_bags_service_only" on public.courier_bags;
drop policy if exists "courier_bag_assignments_service_only" on public.courier_bag_assignments;
drop policy if exists "courier_bag_order_links_service_only" on public.courier_bag_order_links;
drop policy if exists "courier_bag_history_service_only" on public.courier_bag_history;

create policy "courier_bags_service_only" on public.courier_bags for all using (false);
create policy "courier_bag_assignments_service_only" on public.courier_bag_assignments for all using (false);
create policy "courier_bag_order_links_service_only" on public.courier_bag_order_links for all using (false);
create policy "courier_bag_history_service_only" on public.courier_bag_history for all using (false);
