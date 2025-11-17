-- 1. Create enum for user status
CREATE TYPE user_status AS ENUM (
  'incomplete_registration',
  'under_review',
  'agreement_pending',
  'active',
  'inactive',
  'draft',
  'suspended',
  'approved'
);

-- 2. Profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  status user_status DEFAULT 'incomplete_registration' NOT NULL,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 3. Onboarding table
CREATE TABLE onboarding (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  step integer DEFAULT 1,
  data jsonb,
  status user_status DEFAULT 'incomplete_registration',
  onboarding_completed boolean DEFAULT false,
  inserted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding"
  ON onboarding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update own onboarding"
  ON onboarding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding"
  ON onboarding FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Optional triggers to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER onboarding_set_updated_at
BEFORE UPDATE ON onboarding
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- profiles: add the columns your app expects
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name  text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS role       text NOT NULL DEFAULT 'vendor';

-- make sure email exists & is unique (create if missing, then unique index)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- create a unique index for email if it's missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'profiles_email_key'
  )
  THEN
    -- use a unique index instead of constraint for idempotency
    CREATE UNIQUE INDEX profiles_email_key ON public.profiles (email);
  END IF;
END$$;

-- optional: case-insensitive lookup helper
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'profiles_email_lower_idx'
  )
  THEN
    CREATE INDEX profiles_email_lower_idx
      ON public.profiles (LOWER(email));
  END IF;
END$$;

-- auto-insert profile rows on new auth.users (if you were using this before)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- backfill: ensure existing users have profile rows
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;


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


ALTER TABLE profiles
ADD COLUMN email_verified boolean NOT NULL DEFAULT false;