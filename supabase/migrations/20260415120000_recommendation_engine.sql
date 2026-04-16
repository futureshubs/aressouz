-- Recommendation engine: durable event log + admin aggregates (Edge Function uses service_role).

create table if not exists public.reco_user_activity (
  id bigint generated always as identity primary key,
  identity_key text not null,
  auth_user_id uuid,
  event_type text not null,
  product_id text,
  category_key text,
  shop_id text,
  price numeric(14, 2),
  query text,
  dwell_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_reco_act_identity_created
  on public.reco_user_activity (identity_key, created_at desc);

create index if not exists idx_reco_act_created
  on public.reco_user_activity (created_at desc);

create index if not exists idx_reco_act_product
  on public.reco_user_activity (product_id, created_at desc)
  where product_id is not null;

create index if not exists idx_reco_act_type_created
  on public.reco_user_activity (event_type, created_at desc);

create table if not exists public.reco_search_history (
  id bigint generated always as identity primary key,
  identity_key text not null,
  auth_user_id uuid,
  query_raw text not null,
  query_norm text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_reco_sh_identity_created
  on public.reco_search_history (identity_key, created_at desc);

-- Admin / trending helpers (stable aggregates; Edge calls via .rpc)
create or replace function public.reco_top_products(p_days integer, p_event text, p_limit integer)
returns table (product_id text, event_count bigint)
language sql
stable
as $$
  select r.product_id, count(*)::bigint as event_count
  from public.reco_user_activity r
  where r.created_at >= timezone('utc', now()) - make_interval(days => greatest(1, least(p_days, 90)))
    and r.event_type = p_event
    and r.product_id is not null
    and length(trim(r.product_id)) > 0
  group by r.product_id
  order by event_count desc, r.product_id asc
  limit greatest(1, least(p_limit, 200));
$$;

create or replace function public.reco_category_heatmap(p_days integer, p_limit integer)
returns table (category_key text, event_count bigint)
language sql
stable
as $$
  select coalesce(nullif(trim(lower(r.category_key)), ''), '(none)') as category_key,
         count(*)::bigint as event_count
  from public.reco_user_activity r
  where r.created_at >= timezone('utc', now()) - make_interval(days => greatest(1, least(p_days, 90)))
    and r.category_key is not null
    and length(trim(r.category_key)) > 0
  group by 1
  order by event_count desc
  limit greatest(1, least(p_limit, 200));
$$;

create or replace function public.reco_trending_product_ids(p_hours integer, p_limit integer)
returns table (product_id text, score numeric)
language sql
stable
as $$
  select r.product_id,
         sum(
           case r.event_type
             when 'view' then 1.0
             when 'click' then 2.0
             when 'cart_add' then 5.0
             when 'purchase' then 10.0
             when 'favorite_add' then 3.0
             else 0.5
           end
         )::numeric as score
  from public.reco_user_activity r
  where r.created_at >= timezone('utc', now()) - make_interval(hours => greatest(1, least(p_hours, 168)))
    and r.product_id is not null
    and length(trim(r.product_id)) > 0
  group by r.product_id
  order by score desc, r.product_id asc
  limit greatest(1, least(p_limit, 500));
$$;

grant execute on function public.reco_top_products(integer, text, integer) to service_role;
grant execute on function public.reco_category_heatmap(integer, integer) to service_role;
grant execute on function public.reco_trending_product_ids(integer, integer) to service_role;

alter table public.reco_user_activity enable row level security;
alter table public.reco_search_history enable row level security;

-- No policies: anon/authenticated cannot read/write; Edge Function uses service_role (bypasses RLS).

comment on table public.reco_user_activity is 'Recommendation / personalization events (append-only).';
comment on table public.reco_search_history is 'Search queries for reco analytics.';
