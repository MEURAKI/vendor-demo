-- main providers table
create table if not exists providers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles (id) on delete cascade,

  name text not null,
  specialisation_areas text,            -- long text area
  description text,

  -- contact
  whatsapp_country_code text,
  whatsapp_number text,

  -- taxonomy
  wellness_dimensions text[] default '{}',
  categories text[] default '{}',
  tags text[] default '{}',

  -- images
  cover_image_url text,
  total_images integer default 0,

  status text not null default 'draft' check (status in ('draft', 'active', 'unavailable')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists providers_vendor_id_idx on providers (vendor_id);

-- gallery images (like space_images)
create table if not exists provider_images (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  image_url text not null,
  position integer not null default 0
);

create index if not exists provider_images_provider_idx on provider_images (provider_id);

-- RLS (vendor owns their providers)
alter table providers enable row level security;
alter table provider_images enable row level security;

create policy "providers_select_own"
  on providers for select
  using (auth.uid() = vendor_id);

create policy "providers_insert_own"
  on providers for insert
  with check (auth.uid() = vendor_id);

create policy "providers_update_own"
  on providers for update
  using (auth.uid() = vendor_id);

create policy "providers_delete_own"
  on providers for delete
  using (auth.uid() = vendor_id);

create policy "provider_images_select_own"
  on provider_images for select
  using (
    exists (
      select 1 from providers p
      where p.id = provider_id
      and p.vendor_id = auth.uid()
    )
  );

create policy "provider_images_mutate_own"
  on provider_images for all
  using (
    exists (
      select 1 from providers p
      where p.id = provider_id
      and p.vendor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from providers p
      where p.id = provider_id
      and p.vendor_id = auth.uid()
    )
  );


  -- Allow authenticated users to upload into the `provider-images` bucket
create policy "Authenticated users can upload to provider-images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'provider-images'
  and auth.role() = 'authenticated'
);

-- Allow everyone to read files from `provider-images` (optional but common)
create policy "Public can read from provider-images"
on storage.objects
for select
to public
using (
  bucket_id = 'provider-images'
);