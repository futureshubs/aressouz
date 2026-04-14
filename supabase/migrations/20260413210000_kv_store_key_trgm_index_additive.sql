-- Additive: KV kalit bo‘yicha qidiruvlarni tezlashtirish uchun GIN (trgm).
-- `kv_store.tsx` `match` + regex prefiks — rejali indeks yordamida rejalashtirish yaxshilanishi mumkin.

create extension if not exists pg_trgm;

create index if not exists idx_kv_store_27d0d16c_key_gin_trgm
  on public.kv_store_27d0d16c
  using gin (key gin_trgm_ops);
