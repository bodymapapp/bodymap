-- ============================================================
-- Migration: clients_address_fields
-- Add address, city, state, zip, country to clients table
-- ============================================================
-- HK May 21 2026 evening: Jackie's CSV from MassageBook has full
-- contact addresses for each client. The current clients table
-- has no place to store this data. After this migration, both
-- the import flow AND the client profile UI can store and
-- display home addresses.
--
-- Use cases:
--   - Holiday card mail merge
--   - Service area analytics (which zip codes are my clients in)
--   - In-home practice geography (some LMTs travel to clients)
--   - Insurance / W-9 work where client address is required
--
-- All fields nullable. No client is required to have an address.
-- Existing rows untouched; new columns default to NULL.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- No index on these fields by default. If service-area analytics
-- becomes a feature, add btree index on (therapist_id, zip) then.
