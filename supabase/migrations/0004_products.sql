-- 2025XXXXXX_create_products_and_variants.sql

begin;

-- ---------- ENUMS ----------

create type product_status as enum ('draft', 'published');

create type option_group_kind as enum ('size','volume','weight','color','custom');

-- ---------- PRODUCTS ----------

create table products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,
  description   text,
  base_sku      text not null,
  is_variant    boolean not null default false,

  -- Single-product pricing (ignored if is_variant = true)
  price_cents        integer,
  discount_type      text check (discount_type in ('fixed', 'percent')),
  discount_value     numeric,
  discount_start_at  timestamptz,
  discount_end_at    timestamptz,
  discount_all_variants boolean default false,
  inventory_qty      integer,

  status        product_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index products_status_idx on products (status);
create index products_slug_idx   on products (slug);

-- ---------- WELLNESS / CATEGORIES / TAGS ----------

create table wellness_dimensions (
  id   serial primary key,
  name text unique not null
);

create table product_wellness_dimensions (
  product_id   uuid references products(id) on delete cascade,
  dimension_id int  references wellness_dimensions(id),
  primary key (product_id, dimension_id)
);

create index pwd_product_idx   on product_wellness_dimensions (product_id);
create index pwd_dimension_idx on product_wellness_dimensions (dimension_id);

create table categories (
  id   serial primary key,
  name text unique not null
);

create table product_categories (
  product_id  uuid references products(id) on delete cascade,
  category_id int  references categories(id),
  primary key (product_id, category_id)
);

create index pc_product_idx   on product_categories (product_id);
create index pc_category_idx  on product_categories (category_id);

create table tags (
  id   serial primary key,
  name text unique not null
);

create table product_tags (
  product_id uuid references products(id) on delete cascade,
  tag_id     int  references tags(id),
  primary key (product_id, tag_id)
);

create index pt_product_idx on product_tags (product_id);
create index pt_tag_idx     on product_tags (tag_id);

-- ---------- DESCRIPTION SECTIONS ----------

create table product_description_sections (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  sort_order  int not null,
  title       text not null,
  body        text not null
);

create index pds_product_idx on product_description_sections (product_id, sort_order);

-- ---------- VARIANT OPTION GROUPS ----------

create table product_option_groups (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  name        text not null,
  kind        option_group_kind not null default 'custom',
  position    int not null
);

create index pog_product_idx on product_option_groups (product_id, position);

create table product_option_values (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references product_option_groups(id) on delete cascade,
  label       text not null,
  color_hex   text,
  position    int not null
);

create index pov_group_idx on product_option_values (group_id, position);

-- ---------- VARIANTS ----------

create table product_variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references products(id) on delete cascade,

  sku           text not null unique,
  price_cents   integer not null,
  inventory_qty integer not null default 0,
  image_url     text,
  position      int not null default 0,
  is_active     boolean not null default true,

  options_json  jsonb not null
);

create index pv_product_idx on product_variants (product_id, position);

create table variant_option_values (
  variant_id uuid references product_variants(id) on delete cascade,
  value_id   uuid references product_option_values(id),
  primary key (variant_id, value_id)
);

create index vov_variant_idx on variant_option_values (variant_id);
create index vov_value_idx   on variant_option_values (value_id);

commit;

-- Allow users to read their own profile
create policy "Users can read own profile"
on profiles
for select
using ( auth.uid() = id );

-- Allow users to create their own profile row
create policy "Users can insert own profile"
on profiles
for insert
with check ( auth.uid() = id );

-- Allow users to update their own profile
create policy "Users can update own profile"
on profiles
for update
using ( auth.uid() = id );

drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;


-- Allow authenticated users to upload files into the avatars bucket
create policy "Authenticated users can upload avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
);

-- Allow everyone to read from the avatars bucket (if you want public avatars)
create policy "Anyone can read avatars"
on storage.objects
for select
using (
  bucket_id = 'avatars'
);