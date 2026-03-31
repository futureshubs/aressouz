-- Allow branch staff memberships to reference legacy KV branch ids (text) while relational branches are being migrated.

alter table public.branch_staff_memberships
  add column if not exists branch_kv_id text;

-- Make relational branch_id optional (some deployments still use KV branches).
alter table public.branch_staff_memberships
  alter column branch_id drop not null;

create index if not exists branch_staff_memberships_branch_kv_idx
  on public.branch_staff_memberships (branch_kv_id);

-- Optional integrity: ensure at least one branch identifier is provided.
alter table public.branch_staff_memberships
  drop constraint if exists branch_staff_memberships_branch_ref_chk;
alter table public.branch_staff_memberships
  add constraint branch_staff_memberships_branch_ref_chk
  check (
    (branch_id is not null) or (branch_kv_id is not null and length(trim(branch_kv_id)) > 0)
  );

