-- BUNDLES
create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  base_sku text not null,
  price_cents integer not null default 0,
  discount_type text check (discount_type in ('fixed','percent')) null,
  discount_value integer null,
  discount_start timestamptz null,
  discount_end timestamptz null,
  status text not null default 'draft', -- 'draft' | 'active' | 'out_of_stock'
  image_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bundles_status_idx on public.bundles (status);

create or replace function public.set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bundles_set_timestamp on public.bundles;

create trigger bundles_set_timestamp
before update on public.bundles
for each row
execute function public.set_timestamp();


-- BUNDLE ITEMS
create table public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,

  -- link to either a product OR a variant
  product_id uuid references public.products(id) on delete cascade,
  product_variant_id uuid references public.product_variants(id) on delete cascade,

  -- snapshot of details at time of bundle creation
  item_name text not null,
  item_price_cents integer not null default 0,
  quantity integer not null default 1,

  created_at timestamptz not null default now()
);

-- exactly one of product_id / product_variant_id must be set
alter table public.bundle_items
  add constraint bundle_items_product_check
  check (
    (product_id is not null and product_variant_id is null) or
    (product_id is null and product_variant_id is not null)
  );

create index bundle_items_bundle_id_idx on public.bundle_items (bundle_id);
create index bundle_items_product_variant_id_idx on public.bundle_items (product_variant_id);

alter table public.bundles
  add column discount_start_at timestamptz,
  add column discount_end_at   timestamptz;



-- 1) Add the column (nullable first if you already have rows)
alter table public.bundles
  add column vendor_id uuid;

-- 2) (Optional) backfill existing rows here if needed
-- update public.bundles set vendor_id = '<some uuid>' where vendor_id is null;

-- 3) Make it NOT NULL and add FK to profiles (or vendors) table
alter table public.bundles
  alter column vendor_id set not null;

alter table public.bundles
  add constraint bundles_vendor_id_fkey
  foreign key (vendor_id) references public.profiles (id) on delete cascade;