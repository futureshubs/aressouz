-- Optional mahsulot grafi (keyin admin/ETL to‘ldiradi): similar / accessory / upgrade / narx alternativlari.
-- Hozircha engine asosan heuristic; bu jadval keyin `JOIN` bilan kuchaytiriladi.

create table if not exists public.reco_product_relations (
  source_product_id text not null,
  target_product_id text not null,
  rel_type text not null check (rel_type in ('similar', 'accessory', 'upgrade', 'cheaper', 'premium')),
  score numeric not null default 1.0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (source_product_id, target_product_id, rel_type)
);

create index if not exists idx_reco_rel_source on public.reco_product_relations (source_product_id);
create index if not exists idx_reco_rel_target on public.reco_product_relations (target_product_id);

alter table public.reco_product_relations enable row level security;

comment on table public.reco_product_relations is 'Mahsulotlar o‘rtasida manual yoki batch bog‘lanishlar (reco graph).';
