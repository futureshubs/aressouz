-- Advanced reco: collaborative "also interacted" + index helpers (service_role RPC).

create index if not exists idx_reco_act_identity_product_created
  on public.reco_user_activity (identity_key, product_id, created_at desc)
  where product_id is not null and length(trim(product_id)) > 0;

-- Users who interacted with p_product also interacted with other_id (weighted; last N days).
create or replace function public.reco_also_interacted(p_product text, p_days integer, p_limit integer)
returns table (other_id text, co_score numeric)
language sql
stable
as $$
  select r2.product_id::text,
         sum(
           case r2.event_type
             when 'purchase' then 10.0
             when 'cart_add' then 5.0
             when 'favorite_add' then 3.5
             when 'click' then 2.0
             when 'view' then 0.6
             when 'dwell' then 0.8
             else 0.25
           end
         )::numeric as co_score
  from public.reco_user_activity r1
  inner join public.reco_user_activity r2
    on r1.identity_key = r2.identity_key
   and r2.product_id is not null
   and r2.product_id <> r1.product_id
   and r2.created_at >= timezone('utc', now()) - make_interval(days => greatest(1, least(p_days, 45)))
  where r1.product_id = p_product
    and r1.created_at >= timezone('utc', now()) - make_interval(days => greatest(1, least(p_days, 45)))
    and r1.event_type in ('view', 'click', 'cart_add', 'purchase', 'favorite_add', 'dwell')
    and r2.event_type in ('view', 'click', 'cart_add', 'purchase', 'favorite_add', 'dwell')
  group by r2.product_id
  order by co_score desc, r2.product_id asc
  limit greatest(1, least(p_limit, 120));
$$;

grant execute on function public.reco_also_interacted(text, integer, integer) to service_role;

comment on function public.reco_also_interacted is 'Co-occurrence style collaborative signal from reco_user_activity (same identity_key).';
