-- Engine: additive index for branch + vertical + status filters (catalog / shop views).
-- Does not alter tables or drop anything; IF NOT EXISTS is safe on re-apply.

create index if not exists idx_products_branch_vertical_status
  on public.products (branch_id, vertical_type, status)
  where deleted_at is null;
