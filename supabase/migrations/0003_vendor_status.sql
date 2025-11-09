-- 0003_vendor_status.sql

-- 1) enum for clean constraints
do $$ begin
  create type vendor_status as enum (
    'incomplete_registration',
    'under_review',
    'agreement_pending',
    'active',
    'inactive',
    'draft',
    'suspended'
  );
exception when duplicate_object then null;
end $$;

-- 2) profiles columns (kept near user)
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists status vendor_status not null default 'incomplete_registration';

-- (optional) keep a last-step marker in onboarding table too
alter table public.onboarding
  add column if not exists status vendor_status,
  add column if not exists onboarding_completed boolean;
