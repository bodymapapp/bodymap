-- supabase/migrations/membership_package_visibility.sql
--
-- HK May 18 2026: Candice asked "is there a way, like you did with
-- the sessions, to make those memberships private so other clients
-- can only see the current plans and prices?"
--
-- Context: she has 3 existing members on legacy pricing. She raised
-- her prices since they started. Members are locked in at the old
-- price as long as they continue. She wants to:
--   1. Keep their legacy membership records intact for billing
--      continuity (2 of 3 renew on MyBodyMap in 2 months, 1 is
--      paid through July)
--   2. Hide those grandfathered memberships from the public booking
--      page so new clients only see current public pricing
--
-- Same visibility pattern as services.visibility ('public' | 'private'):
--   public  -> shown on public booking page + therapist book-on-behalf
--   private -> therapist assigns manually only, hidden from public
--
-- Packages get the same column for parity (a therapist might
-- grandfather a package the same way).

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));

-- Backward compat: every existing row defaults to 'public', matching
-- the behavior before this migration ran (everything was visible to
-- everyone). Therapist can flip individual rows to 'private' in the
-- Settings UI.

CREATE INDEX IF NOT EXISTS memberships_public_idx
  ON memberships(therapist_id, active)
  WHERE visibility = 'public';

CREATE INDEX IF NOT EXISTS packages_public_idx
  ON packages(therapist_id, active)
  WHERE visibility = 'public';
