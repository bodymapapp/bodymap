-- supabase/migrations/therapist_locations.sql
--
-- HK May 18 2026: multi-location support for therapists. Driven by
-- Jackie's inbound asking "i practice bodywork in two locations and
-- would ideally want to communicate that when people book."
--
-- Design (locked with HK before build):
--   1. Therapists can add multiple physical locations to their practice
--   2. Structured address fields (street1, street2, city, state, postal,
--      country) so we can do maps / SMS rich previews later
--   3. When 0 or 1 location exists, no location UI shows anywhere
--      (status quo, fully backward compatible)
--   4. When 2+ locations exist, services get a per-service location
--      checkbox group (which locations this service is offered at)
--   5. Booking page shows a location picker as step 1 when 2+ locations
--   6. Booking row stores which location was selected
--
-- Schema:
--   therapist_locations: one row per location per therapist
--   bookings.location_id: which location this booking is at
--   services.location_ids: which locations offer this service
--      (UUID array; NULL or empty = offered at all locations,
--       which is also the implicit default when therapist has only
--       one location)

CREATE TABLE IF NOT EXISTS therapist_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  -- Display label, what the therapist calls this place.
  -- e.g. "Downtown studio", "North side wellness center", "Mobile / in-home"
  name TEXT NOT NULL,
  -- Structured address. All optional so a "mobile" location can leave
  -- everything blank or fill just notes.
  street1 TEXT,
  street2 TEXT,
  city TEXT,
  state TEXT,                    -- 2-letter US state code, or whatever fits
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  -- Free-form supplementary info: "parking behind building", "studio B",
  -- "buzz suite 200", etc. Shows on the booking confirmation under
  -- the address.
  notes TEXT,
  -- One location can be marked primary. Used as the default in the
  -- booking modal location dropdown and as the implicit choice when
  -- only one location exists.
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  -- Display order in lists. Lower comes first. Primary location gets
  -- sort_order=0 by convention.
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Soft archive instead of hard delete so historical bookings still
  -- have a location to point at.
  active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS therapist_locations_therapist_id_idx
  ON therapist_locations(therapist_id)
  WHERE active = TRUE;

-- Only one primary location per therapist. Partial unique index so
-- archived/inactive locations don't block.
CREATE UNIQUE INDEX IF NOT EXISTS therapist_locations_one_primary_idx
  ON therapist_locations(therapist_id)
  WHERE is_primary = TRUE AND active = TRUE;

-- Bookings get a location reference. NULL means "the therapist's
-- single location" or "no location specified yet" (existing bookings
-- pre-migration are NULL, which the booking page reads as "show
-- the therapist's primary location" if they later add multiple).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES therapist_locations(id);

CREATE INDEX IF NOT EXISTS bookings_location_id_idx
  ON bookings(location_id)
  WHERE location_id IS NOT NULL;

-- Services get an optional list of location IDs they're offered at.
-- NULL or empty array means "offered at all locations" (the default
-- when a service is created before multi-location is set up, or when
-- a therapist explicitly chooses 'all locations').
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS location_ids UUID[];

-- No index on services.location_ids since we always filter by
-- therapist_id first and then iterate in JS. Therapists have ~5-15
-- services typically; a sequential check is fine.

-- RLS: same model as the rest of the per-therapist tables. The
-- therapist owns their locations; public can read for the booking page.
-- therapists.id IS the auth.uid() in this schema (no separate
-- auth_user_id column). Matches the pattern used by service_addons,
-- packages, memberships, etc.
ALTER TABLE therapist_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "therapist_locations_select_own" ON therapist_locations;
CREATE POLICY "therapist_locations_select_own"
  ON therapist_locations FOR SELECT
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "therapist_locations_insert_own" ON therapist_locations;
CREATE POLICY "therapist_locations_insert_own"
  ON therapist_locations FOR INSERT
  WITH CHECK (therapist_id = auth.uid());

DROP POLICY IF EXISTS "therapist_locations_update_own" ON therapist_locations;
CREATE POLICY "therapist_locations_update_own"
  ON therapist_locations FOR UPDATE
  USING (therapist_id = auth.uid());

DROP POLICY IF EXISTS "therapist_locations_delete_own" ON therapist_locations;
CREATE POLICY "therapist_locations_delete_own"
  ON therapist_locations FOR DELETE
  USING (therapist_id = auth.uid());

-- Public read for the booking page. Anyone landing on /<custom_url>
-- needs to see the therapist's locations to pick one. Same model as
-- services and availability.
DROP POLICY IF EXISTS "therapist_locations_public_read" ON therapist_locations;
CREATE POLICY "therapist_locations_public_read"
  ON therapist_locations FOR SELECT
  TO anon
  USING (active = TRUE);
