-- 1) Enum for space status
create type space_status as enum ('draft', 'active', 'unavailable');

-- 2) Main spaces table
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.profiles(id) on delete set null,

  name text not null,
  description text,

  status space_status not null default 'draft',

  -- location / type
  space_type text check (space_type in ('in_person','online','hybrid')) default 'in_person',
  address text,
  postal_code text,
  map_link text,
  google_business_place_id text,

  -- contact
  whatsapp_country_code text default '+65',
  whatsapp_number text,

  -- taxonomy
  wellness_dimensions text[] default '{}',
  categories text[] default '{}',
  tags text[] default '{}',

  -- images
  cover_image_url text,              -- main image
  total_images int default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Secondary images
create table public.space_images (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  image_url text not null,
  position int not null default 0,
  alt text,

  created_at timestamptz not null default now()
);

create index space_images_space_id_idx on public.space_images(space_id);
create index spaces_vendor_id_idx on public.spaces(vendor_id);

-- 4) Simple updated_at trigger
create or replace function public.set_spaces_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger spaces_set_updated_at
before update on public.spaces
for each row
execute function public.set_spaces_updated_at();