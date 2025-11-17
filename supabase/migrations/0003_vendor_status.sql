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

  alter table public.profiles
add column country_code text default '+65';

alter table public.profiles
add column first_name text;


alter table public.profiles
add column last_name text ;
-- Add the columns the settings form expects
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists phone      text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default now();

-- (optional) touch updated_at automatically on update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- (optional) RLS policy so users can update only their own row
-- (leave RLS enabled)
create policy if not exists "users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());


-- Table
create table if not exists public.vendor_business (
  id uuid primary key references auth.users(id) on delete cascade,
  brand_logo_url text,
  brand_name text,
  company_name text,
  uen text,
  incorporation_year text,
  instagram text,
  facebook text,
  tiktok text,
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.vendor_business enable row level security;

-- Policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vendor_business' and policyname = 'Vendor can select own business'
  ) then
    create policy "Vendor can select own business"
      on public.vendor_business for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'vendor_business' and policyname = 'Vendor can upsert own business'
  ) then
    create policy "Vendor can upsert own business"
      on public.vendor_business for insert
      with check (auth.uid() = id);

    create policy "Vendor can update own business"
      on public.vendor_business for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

create table if not exists public.vendor_brand (
  id uuid primary key references public.profiles(id) on delete cascade,
  short_story text,
  dimensions text[] default '{}',
  offerings  text[] default '{}',
  platforms  text[] default '{}',
  motivations text[] default '{}',
  interests text[] default '{}',
  updated_at timestamptz default now()
);

alter table public.vendor_brand enable row level security;

-- RLS: owners can read/write their own row
create policy "brand_select_own"
on public.vendor_brand
for select
using (auth.uid() = id);

create policy "brand_upsert_own"
on public.vendor_brand
for insert with check (auth.uid() = id)
to authenticated;

create policy "brand_update_own"
on public.vendor_brand
for update using (auth.uid() = id)
to authenticated;


drop policy if exists "vendors can manage own files" on storage.objects;

create policy "vendors can manage own files" on storage.objects
for all
using (
  bucket_id = 'vendor-docs'
  and auth.uid()::text = split_part(name, '/', 1)  -- ✅ first segment is vendorId
)
with check (
  bucket_id = 'vendor-docs'
  and auth.uid()::text = split_part(name, '/', 1)
);


-- Types (idempotent)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'vendor_doc_type') then
    create type vendor_doc_type as enum (
      'vendor_agreement',
      'uen_acra',
      'product_certificate',
      'service_certificate',
      'business_policy'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'doc_review_status') then
    create type doc_review_status as enum ('pending','approved','rejected');
  end if;
end $$;


create table if not exists public.vendor_docs (
  id               uuid primary key default gen_random_uuid(),
  vendor_id        uuid not null
                    references public.profiles(id) on delete cascade,
  kind             vendor_doc_type not null,
  -- Storage object key (e.g. '<userId>/<kind>/<filename>')
  storage_key      text not null,
  file_name        text not null,
  mime_type        text,
  size_bytes       bigint,
  status           doc_review_status not null default 'pending',
  rejection_reason text,

  uploaded_by      uuid references auth.users(id),
  reviewed_by      uuid references auth.users(id),

  uploaded_at      timestamptz not null default now(),
  reviewed_at      timestamptz
);

-- helpful indexes
create index if not exists vendor_docs_vendor_id_idx on public.vendor_docs (vendor_id);
create index if not exists vendor_docs_kind_idx      on public.vendor_docs (kind);
create index if not exists vendor_docs_status_idx    on public.vendor_docs (status);


-- Add policy_url column to vendor_business table
alter table public.vendor_business
add column if not exists policy_url text;

-- Optional: track last update time for all editable fields
alter table public.vendor_business
add column if not exists updated_at timestamptz default now();

-- Update trigger to auto-refresh timestamp (if you want)
create or replace function public.update_vendor_business_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_vendor_business_timestamp on public.vendor_business;
create trigger update_vendor_business_timestamp
before update on public.vendor_business
for each row execute function public.update_vendor_business_timestamp();

-- =============================================================================
-- PATCH: Add General + Fulfilment & Delivery fields to public.vendor_business
-- Idempotent (checks for each column). No table creation here.
-- =============================================================================

-- Helpful type for commission, if you plan to store it here too
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_type') THEN
    CREATE TYPE commission_type AS ENUM ('package','percentage','flat');
  END IF;
END$$;

-- General fields
DO $$
BEGIN
  -- Shop toggles + identity
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='shop_status') THEN
    ALTER TABLE public.vendor_business ADD COLUMN shop_status boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='shop_name') THEN
    ALTER TABLE public.vendor_business ADD COLUMN shop_name text;
  END IF;

  -- Slug (unique); use CITEXT for case-insensitive uniqueness
  CREATE EXTENSION IF NOT EXISTS citext;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='shop_slug') THEN
    ALTER TABLE public.vendor_business ADD COLUMN shop_slug citext;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='vendor_business_shop_slug_key') THEN
    ALTER TABLE public.vendor_business
      ADD CONSTRAINT vendor_business_shop_slug_key UNIQUE (shop_slug);
  END IF;

  -- Category / bio
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='business_category') THEN
    ALTER TABLE public.vendor_business ADD COLUMN business_category text;  -- e.g. CSV or free text
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='shop_bio') THEN
    ALTER TABLE public.vendor_business ADD COLUMN shop_bio text;
  END IF;

  -- Public contact
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='contact_email') THEN
    ALTER TABLE public.vendor_business ADD COLUMN contact_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='phone_country_code') THEN
    ALTER TABLE public.vendor_business ADD COLUMN phone_country_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='phone_number') THEN
    ALTER TABLE public.vendor_business ADD COLUMN phone_number text;
  END IF;

  -- Media / policy link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='logo_url') THEN
    ALTER TABLE public.vendor_business ADD COLUMN logo_url text;  -- keep existing brand_logo_url if you have it
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='refund_policy_url') THEN
    ALTER TABLE public.vendor_business ADD COLUMN refund_policy_url text;
  END IF;

  -- Package / commission (optional but matches UI)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='frame_id') THEN
    ALTER TABLE public.vendor_business ADD COLUMN frame_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='commission_type') THEN
    ALTER TABLE public.vendor_business ADD COLUMN commission_type commission_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='commission_rate') THEN
    ALTER TABLE public.vendor_business ADD COLUMN commission_rate numeric(8,2);
  END IF;

  -- Timestamps (in case they’re missing)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='created_at') THEN
    ALTER TABLE public.vendor_business ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='updated_at') THEN
    ALTER TABLE public.vendor_business ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END$$;

-- Fulfilment & Delivery fields
DO $$
BEGIN
  -- Method toggles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='fulfilment_delivery') THEN
    ALTER TABLE public.vendor_business ADD COLUMN fulfilment_delivery boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='fulfilment_pickup') THEN
    ALTER TABLE public.vendor_business ADD COLUMN fulfilment_pickup boolean DEFAULT false;
  END IF;

  -- Standard delivery
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='delivery_days_standard') THEN
    ALTER TABLE public.vendor_business ADD COLUMN delivery_days_standard integer;  -- e.g. 3–5 days -> store upper or avg
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='delivery_rate_standard') THEN
    ALTER TABLE public.vendor_business ADD COLUMN delivery_rate_standard numeric(10,2);
  END IF;

  -- Express delivery
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='delivery_days_express') THEN
    ALTER TABLE public.vendor_business ADD COLUMN delivery_days_express integer;  -- e.g. 1
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='delivery_rate_express') THEN
    ALTER TABLE public.vendor_business ADD COLUMN delivery_rate_express numeric(10,2);
  END IF;

  -- Same-day / time-window (free text like "5:00pm–9:00pm")
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='same_day_window') THEN
    ALTER TABLE public.vendor_business ADD COLUMN same_day_window text;
  END IF;

  -- Pickup address
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='pickup_address') THEN
    ALTER TABLE public.vendor_business ADD COLUMN pickup_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='pickup_postal_code') THEN
    ALTER TABLE public.vendor_business ADD COLUMN pickup_postal_code text;
  END IF;

  -- Delivery days note (free text like "Mon–Fri, 9am–5pm")
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendor_business' AND column_name='delivery_days_note') THEN
    ALTER TABLE public.vendor_business ADD COLUMN delivery_days_note text;
  END IF;
END$$;

-- Keep updated_at fresh on change (safe to re-create)
CREATE OR REPLACE FUNCTION public.update_vendor_business_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS update_vendor_business_timestamp ON public.vendor_business;
CREATE TRIGGER update_vendor_business_timestamp
BEFORE UPDATE ON public.vendor_business
FOR EACH ROW EXECUTE FUNCTION public.update_vendor_business_timestamp();


create table public.vendor_payout (
  vendor_id uuid primary key references auth.users(id),
  stripe_account_id text,
  bank_holder_name text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

alter table public.vendor_payout
  rename column bank_holder_name to account_holder_name;

  -- Step 1: Add the column (nullable first if you already have data)
ALTER TABLE public.products
ADD COLUMN vendor_id uuid;

-- Step 2: (Optional but recommended)
-- If your "vendor" is stored in profiles.id, create a FK:
ALTER TABLE public.products
ADD CONSTRAINT products_vendor_id_fkey
FOREIGN KEY (vendor_id) REFERENCES public.profiles (id);

-- Step 3: Once you’ve backfilled vendor_id for existing rows,
-- you can enforce NOT NULL if you want:
-- ALTER TABLE public.products
-- ALTER COLUMN vendor_id SET NOT NULL;