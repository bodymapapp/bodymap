-- demo-data/complete-fix.sql
--
-- ONE script that fixes everything for the demo data. Replaces:
--   - backfill-client-ids.sql
--   - seed-sessions-and-future.sql (re-runs with no LIMIT)
--
-- What it does in order:
--   1. Backfill bookings.client_id from clients.email match.
--      Existing bookings imported with NULL client_id get linked.
--   2. Backfill sessions.client_id via the booking_id chain.
--      Existing session rows get linked.
--   3. Ensure EVERY past completed booking has a session row
--      (no LIMIT this time; previously LIMIT 80 left some clients
--      with zero sessions by random sampling).
--      Mix of states:
--        60% completed SOAP with realistic S/O/A/P content
--        30% intake complete, SOAP pending
--        10% no session row (no-show / skipped intake)
--   4. Print row counts so HK can see what was fixed.
--
-- Affects only the demo therapist (bodymapdemo@gmail.com).
-- Idempotent: re-running won't duplicate. Existing session rows
-- are preserved; new ones are only inserted for bookings that
-- don't already have a session.

DO $$
DECLARE
  v_therapist_id uuid;
  v_bookings_fixed int := 0;
  v_sessions_relinked int := 0;
  v_sessions_created int := 0;
  v_booking_record record;
  v_random_seed float;
BEGIN
  SELECT id INTO v_therapist_id FROM therapists
  WHERE email = 'bodymapdemo@gmail.com' LIMIT 1;

  IF v_therapist_id IS NULL THEN
    RAISE EXCEPTION 'Therapist not found.';
  END IF;

  -- ─── Pass 1: Backfill bookings.client_id ───
  UPDATE bookings b
  SET client_id = c.id
  FROM clients c
  WHERE b.therapist_id = v_therapist_id
    AND c.therapist_id = v_therapist_id
    AND b.client_id IS NULL
    AND b.client_email IS NOT NULL
    AND LOWER(b.client_email) = LOWER(c.email);
  GET DIAGNOSTICS v_bookings_fixed = ROW_COUNT;

  -- ─── Pass 2: Backfill sessions.client_id via bookings ───
  UPDATE sessions s
  SET client_id = b.client_id
  FROM bookings b
  WHERE s.therapist_id = v_therapist_id
    AND b.therapist_id = v_therapist_id
    AND s.booking_id = b.id
    AND s.client_id IS NULL
    AND b.client_id IS NOT NULL;
  GET DIAGNOSTICS v_sessions_relinked = ROW_COUNT;

  -- ─── Pass 3: Generate session rows for any past completed
  -- booking that doesn't already have one. No LIMIT, so every
  -- demo client gets representation. ───
  FOR v_booking_record IN
    SELECT b.id AS booking_id, b.client_id, b.booking_date, b.client_email
    FROM bookings b
    LEFT JOIN sessions s ON s.booking_id = b.id
    WHERE b.therapist_id = v_therapist_id
      AND b.client_email LIKE '%@example.com'
      AND b.booking_date < CURRENT_DATE
      AND b.status = 'completed'
      AND b.client_id IS NOT NULL  -- skip any that didn't backfill
      AND s.id IS NULL              -- no session yet for this booking
    ORDER BY b.booking_date DESC
  LOOP
    v_random_seed := random();

    IF v_random_seed < 0.6 THEN
      -- 60%: completed SOAP with realistic content
      INSERT INTO sessions (
        therapist_id, client_id, booking_id,
        completed, completed_at, created_at,
        pressure, goal,
        table_temp, room_temp, music, lighting, conversation, draping, oil_pref,
        front_focus, back_focus, front_avoid, back_avoid,
        therapist_notes
      ) VALUES (
        v_therapist_id,
        v_booking_record.client_id,
        v_booking_record.booking_id,
        true,
        (v_booking_record.booking_date + interval '1 hour')::timestamptz,
        (v_booking_record.booking_date)::timestamptz,
        3 + floor(random() * 3)::int,
        (ARRAY['relax', 'pain_relief', 'recovery', 'performance'])[1 + floor(random() * 4)::int],
        'warm', 'comfortable', 'soft', 'dim', 'quiet', 'standard', 'medium',
        (CASE floor(random() * 3)::int
           WHEN 0 THEN '["neck","shoulders"]'::jsonb
           WHEN 1 THEN '["neck"]'::jsonb
           ELSE '["shoulders","chest"]'::jsonb
         END),
        (CASE floor(random() * 4)::int
           WHEN 0 THEN '["lowerBack","upperBack"]'::jsonb
           WHEN 1 THEN '["lowerBack"]'::jsonb
           WHEN 2 THEN '["upperBack","midBack"]'::jsonb
           ELSE '["glutes","hamstrings"]'::jsonb
         END),
        '[]'::jsonb,
        '[]'::jsonb,
        jsonb_build_object(
          '__soap', true,
          'S', 'Client reported tension in upper back and shoulders. Sleep has been disrupted from work stress.',
          'O', 'Hypertonicity bilateral upper trapezius. Restricted range cervical rotation right.',
          'A', 'Stress-related muscular tension, no contraindications observed.',
          'P', 'Deep tissue focus on upper back. Recommend stretching exercises sent via email.'
        )::text
      );
      v_sessions_created := v_sessions_created + 1;
    ELSIF v_random_seed < 0.9 THEN
      -- 30%: intake complete, SOAP pending
      INSERT INTO sessions (
        therapist_id, client_id, booking_id,
        completed, created_at,
        pressure, goal,
        table_temp, room_temp, music, lighting, conversation, draping, oil_pref,
        front_focus, back_focus, front_avoid, back_avoid
      ) VALUES (
        v_therapist_id,
        v_booking_record.client_id,
        v_booking_record.booking_id,
        false,
        (v_booking_record.booking_date - interval '1 day')::timestamptz,
        3 + floor(random() * 3)::int,
        (ARRAY['relax', 'pain_relief', 'recovery'])[1 + floor(random() * 3)::int],
        'warm', 'comfortable', 'soft', 'dim', 'quiet', 'standard', 'medium',
        '["neck"]'::jsonb,
        '["lowerBack"]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb
      );
      v_sessions_created := v_sessions_created + 1;
    END IF;
    -- 10%: no session row (booking without intake)
  END LOOP;

  RAISE NOTICE '─────────────────────────────────────';
  RAISE NOTICE 'Bookings linked to clients: %', v_bookings_fixed;
  RAISE NOTICE 'Sessions linked via booking_id: %', v_sessions_relinked;
  RAISE NOTICE 'New SOAP session rows created: %', v_sessions_created;
  RAISE NOTICE '─────────────────────────────────────';
  RAISE NOTICE 'Refresh any demo client profile to see real session rows.';
END $$;
