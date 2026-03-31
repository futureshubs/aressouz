-- Branch staff memberships + audit log (SaaS-grade)

create table if not exists public.branch_staff_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  role text not null default 'staff',
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists branch_staff_memberships_user_branch_uq
  on public.branch_staff_memberships (user_id, branch_id);

create index if not exists branch_staff_memberships_branch_idx
  on public.branch_staff_memberships (branch_id);

create index if not exists branch_staff_memberships_user_idx
  on public.branch_staff_memberships (user_id);

drop trigger if exists set_updated_at_branch_staff_memberships on public.branch_staff_memberships;
create trigger set_updated_at_branch_staff_memberships
before update on public.branch_staff_memberships
for each row execute function public.set_updated_at();

alter table public.branch_staff_memberships enable row level security;

-- Allow a signed-in user to read their own memberships.
drop policy if exists "branch_staff_memberships_read_own" on public.branch_staff_memberships;
create policy "branch_staff_memberships_read_own"
  on public.branch_staff_memberships
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = branch_staff_memberships.user_id
        and u.auth_user_id = auth.uid()
        and u.status = 'active'
    )
  );

-- Block direct client writes (managed via Edge/service role).
drop policy if exists "branch_staff_memberships_no_write" on public.branch_staff_memberships;
create policy "branch_staff_memberships_no_write"
  on public.branch_staff_memberships
  for all
  to authenticated
  using (false)
  with check (false);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_auth_user_id uuid,
  branch_id uuid references public.branches(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_log_branch_created_idx on public.audit_log (branch_id, created_at desc);
create index if not exists audit_log_actor_created_idx on public.audit_log (actor_user_id, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

-- Deny direct client access (Edge/service role only). Add admin read policy later if needed.
drop policy if exists "audit_log_service_only" on public.audit_log;
create policy "audit_log_service_only" on public.audit_log for all using (false);

