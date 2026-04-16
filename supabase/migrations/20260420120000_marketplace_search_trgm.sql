-- Qidiruv tezligi: trigram indekslar (pg_trgm allaqachon yoqilgan deb hisoblanadi).
-- Asosiy jadval allaqachon `search_vector` + GIN: idx_products_search_vector, idx_listings_search_vector

create index if not exists idx_products_name_trgm
  on public.products using gin (lower(name) gin_trgm_ops);

create index if not exists idx_products_brand_trgm
  on public.products using gin (lower(coalesce(brand, '')) gin_trgm_ops);

create index if not exists idx_listings_title_trgm
  on public.listings using gin (lower(title) gin_trgm_ops);

create index if not exists idx_seller_stores_name_trgm
  on public.seller_stores using gin (lower(name) gin_trgm_ops);

comment on index public.idx_products_name_trgm is
  'Typo-tolerant prefix/substring server-side search. Client ranking + tsvector ikkalasi bilan juftlashadi.';
