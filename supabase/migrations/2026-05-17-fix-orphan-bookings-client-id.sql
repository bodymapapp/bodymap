-- supabase/migrations/2026-05-17-fix-orphan-bookings-client-id.sql
--
-- Phase 13.3.1 (HK May 17 2026): post-backfill repair.
--
-- Background:
--   The Phase 13.3 backfill (2026-05-17-backfill-bookings-client-id.sql)
--   ran cleanly but revealed a pre-existing data integrity issue:
--   bookings.client_id did not have a FK constraint, so some bookings
--   pointed at clients rows that had been deleted elsewhere (e.g. via
--   Supabase Table Editor, which does not enforce referential integrity
--   when no FK exists). Result: 17 of 24 Joy Client bookings pointed
--   at clients.id = 'd38ce2b4-...' which no longer existed.
--
-- This migration does two things:
--   1. Re-resolves every orphan bookings.client_id by finding-or-creating
--      a real clients row for the booking's email.
--   2. Adds the FK constraint bookings_client_id_fkey so this class of
--      orphan can never happen again. ON DELETE SET NULL preserves the
--      booking row when a clients row is intentionally deleted.
--
-- Idempotent: re-running is safe. The orphan-detection LEFT JOIN finds
-- nothing on a clean DB, and the FK creation is guarded by IF NOT EXISTS.

DO $$
DECLARE
  v_orphans_fixed INT := 0;
  v_orphans_unresolvable INT := 0;
  v_orphan RECORD;
  v_resolved_client_id UUID;
BEGIN
  FOR v_orphan IN
    SELECT b.id, b.therapist_id, b.client_email, b.client_name, b.client_phone
    FROM bookings b
    LEFT JOIN clients c ON c.id = b.client_id
    WHERE b.client_id IS NOT NULL AND c.id IS NULL
  LOOP
    IF v_orphan.client_email IS NOT NULL AND length(trim(v_orphan.client_email)) > 0 THEN
      -- Try find existing clients row by email for this therapist.
      SELECT id INTO v_resolved_client_id
      FROM clients
      WHERE therapist_id = v_orphan.therapist_id
        AND lower(trim(email)) = lower(trim(v_orphan.client_email))
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT 1;

      IF v_resolved_client_id IS NOT NULL THEN
        UPDATE bookings SET client_id = v_resolved_client_id WHERE id = v_orphan.id;
        v_orphans_fixed := v_orphans_fixed + 1;
        v_resolved_client_id := NULL;
        CONTINUE;
      END IF;

      -- No matching clients row at all. Create one.
      INSERT INTO clients (therapist_id, name, email, phone)
      VALUES (
        v_orphan.therapist_id,
        COALESCE(NULLIF(trim(v_orphan.client_name), ''), 'Client'),
        lower(trim(v_orphan.client_email)),
        NULLIF(trim(v_orphan.client_phone), '')
      )
      RETURNING id INTO v_resolved_client_id;
      UPDATE bookings SET client_id = v_resolved_client_id WHERE id = v_orphan.id;
      v_orphans_fixed := v_orphans_fixed + 1;
      v_resolved_client_id := NULL;
    ELSE
      -- No email, no way to resolve. Drop the bad reference.
      UPDATE bookings SET client_id = NULL WHERE id = v_orphan.id;
      v_orphans_unresolvable := v_orphans_unresolvable + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Orphan repair complete.';
  RAISE NOTICE '  Orphans re-pointed to real clients: %', v_orphans_fixed;
  RAISE NOTICE '  Orphans set to NULL (no email): %', v_orphans_unresolvable;

  -- Add the FK constraint if missing.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'bookings'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%client_id%'
      AND pg_get_constraintdef(oid) LIKE '%clients%'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added FK constraint bookings_client_id_fkey.';
  ELSE
    RAISE NOTICE 'FK constraint already exists, no change.';
  END IF;
END;
$$;

-- Verification queries.

-- 1. Confirm zero orphan references.
--    Expected: 0 rows.
-- SELECT b.id, b.client_id, b.client_email
-- FROM bookings b
-- LEFT JOIN clients c ON c.id = b.client_id
-- WHERE b.client_id IS NOT NULL AND c.id IS NULL;

-- 2. Confirm FK constraint exists.
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'bookings'::regclass AND contype = 'f';
