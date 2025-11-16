-- Enable uuid if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Services (global info)
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id uuid NOT NULL,
  sku text,                        -- optional global SKU
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',  -- 'draft' | 'active' | 'unavailable'
  service_types text[] DEFAULT '{}',     -- e.g. ['1-1','group_class']
  location_types text[] DEFAULT '{}',    -- e.g. ['online','in_person']
  wellness_dimensions text[] DEFAULT '{}',
  categories text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  cover_image_url text,
  total_images integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX services_vendor_id_idx ON services(vendor_id);

-- 2) Description tabs
CREATE TABLE service_description_tabs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  position integer NOT NULL DEFAULT 0
);

CREATE INDEX service_description_tabs_service_id_idx
  ON service_description_tabs(service_id);

-- 3) Images (cover + gallery)
CREATE TABLE service_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false
);

CREATE INDEX service_images_service_id_idx ON service_images(service_id);

-- 4) Join tables for providers & spaces
CREATE TABLE service_providers (
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL, -- FK to your providers table
  PRIMARY KEY (service_id, provider_id)
);

CREATE TABLE service_spaces (
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  space_id uuid NOT NULL, -- FK to spaces table
  PRIMARY KEY (service_id, space_id)
);

-- 5) Per-location settings (online / in_person)
CREATE TABLE service_location_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  location_type text NOT NULL,           -- 'online' | 'in_person'
  sku text,                              -- e.g. SVC-LEAD-001-1
  max_participants integer,
  price_cents integer NOT NULL DEFAULT 0,
  discount_type text,                    -- 'fixed' | 'percent'
  discount_value numeric(10,2),
  discount_cap integer,                  -- e.g. PPL 10
  has_fixed_schedule boolean NOT NULL DEFAULT false,
  expiry_type text DEFAULT 'anytime',    -- 'anytime' | 'duration'
  expiry_duration_unit text,            -- 'days' | 'weeks' | 'months'
  expiry_duration_value integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_location_settings_service_id_idx
  ON service_location_settings(service_id);

-- 6) Session packages per location (only for anytime expiry)
CREATE TABLE service_session_packages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  location_settings_id uuid NOT NULL
    REFERENCES service_location_settings(id) ON DELETE CASCADE,
  label text NOT NULL,                   -- e.g. '3 Sessions'
  sessions_count integer,
  price_cents integer NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE INDEX service_session_packages_loc_idx
  ON service_session_packages(location_settings_id);

-- 7) Time slots for fixed schedule
CREATE TABLE service_time_slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  location_settings_id uuid NOT NULL
    REFERENCES service_location_settings(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL
);

CREATE INDEX service_time_slots_loc_idx
  ON service_time_slots(location_settings_id);