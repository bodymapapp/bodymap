-- ============================================================
-- Service descriptions for client-facing booking page.
--
-- Leela use case: she runs a women-only practice and her menu reads
-- "Women's Signature Massage" not "Swedish Massage." Without a
-- description, clients can't tell which service suits them.
--
-- service_addons already has a description column from the
-- addons_packages_memberships_events migration. This adds the
-- matching column to services.
-- ============================================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN services.description IS
  'Optional 1-2 sentence description shown on the booking page next to the service name. Helps clients pick the right service when names alone are not self-explanatory.';
