-- demo-data/backfill-client-ids.sql
--
-- ONE-TIME backfill to fix existing demo data where booking and
-- session records have a NULL client_id. The original importer set
-- client_email but never set client_id, so:
--
--   - bookings imported via CSV: all have client_id = NULL
--   - sessions seeded against those bookings: also NULL client_id
--   - SessionList queries by client_id, finds nothing, shows "No
--     sessions yet" even though 7+ session rows exist for that client
--
-- This script fixes both tables in two passes:
--   1. UPDATE bookings.client_id by matching client_email to
--      clients.email (lowercased compare for case safety).
--   2. UPDATE sessions.client_id by joining through booking_id to
--      the now-fixed bookings.client_id.
--
-- After running this once, the importer is also patched to set
-- client_id directly so this backfill will not be needed for new
-- imports. Safe to re-run.
--
-- Affects only the demo therapist's data, identified by email match.
-- Real client data on other accounts is untouched.

DO $$
DECLARE
  v_therapist_id uuid;
  v_bookings_fixed int;
  v_sessions_fixed int;
BEGIN
  SELECT id INTO v_therapist_id FROM therapists
  WHERE email = 'bodymapdemo@gmail.com' LIMIT 1;

  IF v_therapist_id IS NULL THEN
    RAISE EXCEPTION 'Therapist not found.';
  END IF;

  -- Step 1: backfill bookings.client_id from clients.email match.
  -- The case-insensitive compare handles any email-case drift between
  -- the import and the clients row.
  UPDATE bookings b
  SET client_id = c.id
  FROM clients c
  WHERE b.therapist_id = v_therapist_id
    AND c.therapist_id = v_therapist_id
    AND b.client_id IS NULL
    AND b.client_email IS NOT NULL
    AND LOWER(b.client_email) = LOWER(c.email);

  GET DIAGNOSTICS v_bookings_fixed = ROW_COUNT;
  RAISE NOTICE 'Backfilled client_id on % bookings.', v_bookings_fixed;

  -- Step 2: backfill sessions.client_id from sessions.booking_id ->
  -- bookings.client_id (now that bookings are fixed).
  UPDATE sessions s
  SET client_id = b.client_id
  FROM bookings b
  WHERE s.therapist_id = v_therapist_id
    AND b.therapist_id = v_therapist_id
    AND s.booking_id = b.id
    AND s.client_id IS NULL
    AND b.client_id IS NOT NULL;

  GET DIAGNOSTICS v_sessions_fixed = ROW_COUNT;
  RAISE NOTICE 'Backfilled client_id on % sessions.', v_sessions_fixed;
  RAISE NOTICE 'Refresh /dashboard/clients/[any client] and the Sessions and SOAP notes section will now show real rows.';
END $$;
