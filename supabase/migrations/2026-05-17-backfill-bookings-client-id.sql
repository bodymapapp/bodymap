-- supabase/migrations/2026-05-17-backfill-bookings-client-id.sql
--
-- Phase 13.3 (HK May 17 2026): every booking should have client_id set.
-- This migration backfills bookings.client_id for all existing rows
-- where it is NULL but client_email exists.
--
-- Architecture rationale (from HK):
--   "A client should be created at that time and then everything
--    connects to that client ID in client lifetime."
--
-- After this migration:
--   - Every booking with a non-null client_email has a non-null client_id
--   - Every client_id points to a real clients row
--   - Bookings with no email retain NULL client_id (rare admin/external
--     cases; the column stays nullable to allow this)
--
-- Idempotency:
--   This migration is safe to re-run. The find-or-create logic only
--   creates clients rows that don't already exist. Bookings already
--   updated keep their client_id (we filter WHERE client_id IS NULL).

DO $$
DECLARE
  v_booking RECORD;
  v_client_id UUID;
  v_normalized_email TEXT;
  v_normalized_name TEXT;
  v_normalized_phone TEXT;
  v_bookings_updated INT := 0;
  v_clients_created INT := 0;
  v_bookings_skipped_no_email INT := 0;
  v_total_to_process INT;
BEGIN
  -- Make sure bookings.client_id exists (no-op if it already does).
  -- The column was selected in app code already, so this is defensive.
  BEGIN
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;

  -- Count how many bookings need processing for the final report.
  SELECT COUNT(*) INTO v_total_to_process
  FROM bookings
  WHERE client_id IS NULL;

  RAISE NOTICE 'Phase 13.3 backfill starting. Bookings needing client_id: %', v_total_to_process;

  -- Loop through every booking missing client_id. We use a FOR loop
  -- rather than a single UPDATE/INSERT because we need find-or-create
  -- per-row, and we want clean per-row reporting on failure.
  FOR v_booking IN
    SELECT id, therapist_id, client_email, client_name, client_phone
    FROM bookings
    WHERE client_id IS NULL
    ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    -- Skip bookings with no email; nothing to dedup on.
    IF v_booking.client_email IS NULL OR length(trim(v_booking.client_email)) = 0 THEN
      v_bookings_skipped_no_email := v_bookings_skipped_no_email + 1;
      CONTINUE;
    END IF;

    -- Normalize. Lowercase + trim email so case differences across
    -- legacy data still match. Name and phone passed through as-is
    -- but trimmed.
    v_normalized_email := lower(trim(v_booking.client_email));
    v_normalized_name  := COALESCE(NULLIF(trim(v_booking.client_name), ''), 'Client');
    v_normalized_phone := NULLIF(trim(v_booking.client_phone), '');

    -- Step 1: find existing clients row for this (therapist_id, email).
    -- Pick the OLDEST matching row when duplicates exist. Older = the
    -- canonical row in any future merge process. ILIKE for case
    -- insensitivity against any legacy mixed-case clients rows.
    SELECT id INTO v_client_id
    FROM clients
    WHERE therapist_id = v_booking.therapist_id
      AND lower(trim(email)) = v_normalized_email
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    -- Step 2: if no match, create a new clients row.
    IF v_client_id IS NULL THEN
      INSERT INTO clients (therapist_id, name, email, phone)
      VALUES (v_booking.therapist_id, v_normalized_name, v_normalized_email, v_normalized_phone)
      RETURNING id INTO v_client_id;
      v_clients_created := v_clients_created + 1;
    END IF;

    -- Step 3: link the booking to the client.
    UPDATE bookings
    SET client_id = v_client_id
    WHERE id = v_booking.id;

    v_bookings_updated := v_bookings_updated + 1;
  END LOOP;

  -- Final report. Visible in Supabase SQL Editor output panel.
  RAISE NOTICE '---';
  RAISE NOTICE 'Phase 13.3 backfill complete.';
  RAISE NOTICE '  Bookings updated with client_id: %', v_bookings_updated;
  RAISE NOTICE '  New clients rows created: %', v_clients_created;
  RAISE NOTICE '  Bookings skipped (no email): %', v_bookings_skipped_no_email;
  RAISE NOTICE '  Total bookings processed: %', v_total_to_process;
END;
$$;

-- Verification queries.
-- Run these manually after the DO block completes to confirm.

-- 1. How many bookings still have NULL client_id?
--    Expected: only the ones with NULL client_email.
-- SELECT
--   COUNT(*) AS total_null_client_id,
--   COUNT(*) FILTER (WHERE client_email IS NOT NULL AND length(trim(client_email)) > 0) AS unexpected_null,
--   COUNT(*) FILTER (WHERE client_email IS NULL OR length(trim(client_email)) = 0) AS expected_null_no_email
-- FROM bookings
-- WHERE client_id IS NULL;

-- 2. Spot-check: Joy Client booking should now have client_id set.
-- SELECT id, client_name, client_email, client_id
-- FROM bookings
-- WHERE client_email = 'bodymap01@gmail.com'
-- ORDER BY booking_date DESC, start_time DESC;

-- 3. Confirm no orphan client_id references (FK should prevent this anyway).
-- SELECT b.id AS booking_id, b.client_id
-- FROM bookings b
-- LEFT JOIN clients c ON c.id = b.client_id
-- WHERE b.client_id IS NOT NULL AND c.id IS NULL;
-- Expected: 0 rows.
