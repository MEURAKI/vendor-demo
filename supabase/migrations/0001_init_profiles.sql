-- ------------------------------------------------------------
-- 1) Status enum for approval/onboarding state
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type user_status as enum (
      'pending_admin_approval',
      'approved',
      'active',
      'rejected',
      'suspended'
    );
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) Add status + onboarding flags to profiles
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists status user_status not null default 'pending_admin_approval',
  add column if not exists onboarding_completed boolean not null default false;

-- Optional: keep updated_at fresh
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'moddatetime') then
    create extension if not exists moddatetime;
  end if;
exception
  when others then
    -- moddatetime extension might not be available; ignore
    null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'profiles_updated_at'
  ) then
    create trigger profiles_updated_at
    before update on public.profiles
    for each row execute procedure moddatetime('updated_at');
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) Onboarding data table (optional but recommended)
-- ------------------------------------------------------------
create table if not exists public.onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  step int not null default 1,
  data jsonb not null default '{}'::jsonb,
  completed_at timestamptz
);

alter table public.onboarding enable row level security;

-- Users can see / upsert their own onboarding
drop policy if exists "read own onboarding" on public.onboarding;
create policy "read own onboarding"
on public.onboarding for select
using (auth.uid() = user_id);

drop policy if exists "insert own onboarding" on public.onboarding;
create policy "insert own onboarding"
on public.onboarding for insert
with check (auth.uid() = user_id);

drop policy if exists "update own onboarding" on public.onboarding;
create policy "update own onboarding"
on public.onboarding for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4) Admin helpers (you already have role='admin' on profiles)
-- ------------------------------------------------------------
-- Keep your existing is_admin(); here’s a compatible version:
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Allow admins to read/update everyone
drop policy if exists "Admins read all" on public.profiles;
create policy "Admins read all"
on public.profiles for select using (public.is_admin());

drop policy if exists "Admins update all" on public.profiles;
create policy "Admins update all"
on public.profiles for update using (public.is_admin());

-- Optional: let admins read onboarding for support
drop policy if exists "admins read onboarding" on public.onboarding;
create policy "admins read onboarding"
on public.onboarding for select
using (public.is_admin());
