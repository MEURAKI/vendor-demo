-- Quest Product Links: vendors link their products/services to quest result ranges
create table if not exists quest_product_links (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references profiles(id) on delete cascade,
  quest_id      uuid not null references quests(id) on delete cascade,
  range_label   text not null,            -- e.g. "Low", "Moderate", "High"
  product_id    uuid references products(id) on delete cascade,
  service_id    uuid references services(id) on delete cascade,
  display_type  text not null default 'card' check (display_type in ('card','link','cta_button')),
  cta_text      text default 'Book a Session',
  clicks        int not null default 0,
  conversions   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint product_or_service check (product_id is not null or service_id is not null)
);

-- RLS
alter table quest_product_links enable row level security;

create policy "Vendors manage own links"
  on quest_product_links for all
  using (vendor_id = auth.uid());

-- Index
create index idx_qpl_vendor on quest_product_links(vendor_id);
create index idx_qpl_quest  on quest_product_links(quest_id);
