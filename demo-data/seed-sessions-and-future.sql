-- demo-data/seed-sessions-and-future.sql
--
-- Adds two pieces of demo data that weren't in the original seed:
--
--   1. UPCOMING bookings spread across today + this week + next 30
--      days + next 3 months. So the 'Next visit' tile in the new
--      client profile lights up, and the dashboard Schedule view
--      has real future appointments.
--
--   2. SOAP-note SESSION records for ~60% of past completed bookings.
--      Mix of states:
--        - intake_complete: client filled intake, therapist hasn't
--          written SOAP yet (the day-of bottleneck case)
--        - completed: full SOAP saved
--      This gives the therapist real session rows to click into
--      and edit, which exercises the SOAP editor workflow.
--
-- Prerequisites:
--   You must have already uploaded demo-clients.csv (the 30 clients
--   with @example.com emails). This script looks up those clients
--   to attach sessions and future bookings.
--
-- Idempotent: re-running won't duplicate. Wrapped in DO $$ so any
-- mid-run failure rolls back cleanly.
--
-- To run: paste into Supabase SQL Editor, hit Run.

DO $$
DECLARE
  v_therapist_id uuid;
  v_swedish_id uuid;
  v_deep_id uuid;
  v_client_record record;
  v_booking_record record;
  v_session_id uuid;
  v_future_date date;
  v_offset int;
  v_random_seed float;
BEGIN
  SELECT id INTO v_therapist_id FROM therapists
  WHERE email = 'bodymapdemo@gmail.com' LIMIT 1;

  IF v_therapist_id IS NULL THEN
    RAISE EXCEPTION 'Therapist not found. Edit the email in this script if your demo account uses a different one.';
  END IF;

  -- Get any active service for upcoming bookings. Fall back to the
  -- first service we find on this therapist if 'Swedish' isn't named.
  SELECT id INTO v_swedish_id FROM services
    WHERE therapist_id = v_therapist_id
      AND active = true
      AND name ILIKE '%swedish%'
    LIMIT 1;
  IF v_swedish_id IS NULL THEN
    SELECT id INTO v_swedish_id FROM services
      WHERE therapist_id = v_therapist_id AND active = true
      LIMIT 1;
  END IF;

  SELECT id INTO v_deep_id FROM services
    WHERE therapist_id = v_therapist_id
      AND active = true
      AND name ILIKE '%deep%'
    LIMIT 1;
  IF v_deep_id IS NULL THEN v_deep_id := v_swedish_id; END IF;

  -- ─────────── PART 1: Upcoming bookings ───────────
  -- Skip if we already have 10+ upcoming bookings (don't duplicate
  -- on re-run).
  IF (SELECT COUNT(*) FROM bookings
      WHERE therapist_id = v_therapist_id
        AND booking_date >= CURRENT_DATE
        AND client_email LIKE '%@example.com') < 10 THEN

    -- Spread upcoming bookings:
    --   3 today (different times)
    --   4 in the next 7 days
    --   8 in days 8-30
    --   12 in days 31-90
    -- Pick clients in a round-robin from the demo set so it doesn't
    -- pile up on the same person.
    FOR v_client_record IN
      SELECT c.id AS client_id, c.email, c.name, c.phone,
             ROW_NUMBER() OVER (ORDER BY c.name) AS rn,
             COALESCE(c.visit_count, 5) AS visit_count
      FROM clients c
      WHERE c.therapist_id = v_therapist_id
        AND c.email LIKE '%@example.com'
      ORDER BY c.name
    LOOP
      -- Higher-visit clients get more upcoming bookings (they rebook more).
      DECLARE
        v_n_future int := LEAST(GREATEST(v_client_record.visit_count / 6, 1), 3);
      BEGIN
        FOR i IN 1..v_n_future LOOP
          -- Distribute across today/this week/this month/next 3 months
          v_offset := CASE
            WHEN i = 1 AND v_client_record.rn % 5 = 0 THEN 0  -- today, every 5th
            WHEN i = 1 AND v_client_record.rn % 4 = 0 THEN floor(random() * 6)::int + 1  -- this week
            WHEN i = 1 THEN floor(random() * 23)::int + 7  -- this month (8-30 days out)
            WHEN i = 2 THEN floor(random() * 30)::int + 30  -- next month
            ELSE floor(random() * 60)::int + 30  -- spread out
          END;
          v_future_date := CURRENT_DATE + v_offset;

          INSERT INTO bookings (
            therapist_id, service_id, client_id,
            client_email, client_name, client_phone,
            booking_date, start_time, end_time,
            status, notes,
            deposit_required, deposit_amount, deposit_paid
          ) VALUES (
            v_therapist_id,
            CASE WHEN v_client_record.rn % 2 = 0 THEN v_deep_id ELSE v_swedish_id END,
            v_client_record.client_id,
            v_client_record.email,
            v_client_record.name,
            v_client_record.phone,
            v_future_date,
            (('09:00:00'::time) + (floor(random() * 9)::int || ' hours')::interval)::time,
            (('10:00:00'::time) + (floor(random() * 9)::int || ' hours')::interval)::time,
            'confirmed',
            'Auto-seeded upcoming booking for demo.',
            false, 0, false
          );
        END LOOP;
      END;
    END LOOP;

    RAISE NOTICE 'Seeded upcoming bookings across today, this week, and next 90 days.';
  ELSE
    RAISE NOTICE 'Upcoming bookings already exist for demo clients, skipping seed.';
  END IF;

  -- ─────────── PART 2: SOAP-note sessions for past bookings ───────────
  -- For each past completed booking that does not yet have a session
  -- record, create one. Mix of states so the therapist sees:
  --
  --   60% completed SOAP   (completed=true, completed_at set, notes filled)
  --   30% intake complete  (completed=false, no completed_at, body-map
  --                        fields filled by 'client')
  --   10% nothing          (booking happened but no intake submitted)
  --
  -- This populates the Sessions and SOAP notes section on every demo
  -- client profile so HK can click in and see the editor.

  FOR v_booking_record IN
    SELECT b.id AS booking_id, b.client_id, b.booking_date, b.client_email
    FROM bookings b
    LEFT JOIN sessions s ON s.booking_id = b.id
    WHERE b.therapist_id = v_therapist_id
      AND b.client_email LIKE '%@example.com'
      AND b.booking_date < CURRENT_DATE
      AND b.status = 'completed'
      AND s.id IS NULL  -- no session row yet
    ORDER BY b.booking_date DESC
    LIMIT 80  -- cap to avoid massive insert
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
        3 + floor(random() * 3)::int,  -- 3, 4, or 5
        (ARRAY['relax', 'pain_relief', 'recovery', 'performance'])[1 + floor(random() * 4)::int],
        'warm', 'comfortable', 'soft', 'dim', 'quiet', 'standard', 'medium',
        ARRAY['neck', 'shoulders']::jsonb,
        ARRAY['lowerBack', 'upperBack']::jsonb,
        ARRAY[]::jsonb,
        ARRAY[]::jsonb,
        jsonb_build_object(
          '__soap', true,
          'S', 'Client reported tension in upper back and shoulders. Sleep has been disrupted from work stress.',
          'O', 'Hypertonicity bilateral upper trapezius. Restricted range cervical rotation right.',
          'A', 'Stress-related muscular tension, no contraindications observed.',
          'P', 'Deep tissue focus on upper back. Recommend stretching exercises sent via email.'
        )::text
      );
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
        ARRAY['neck']::jsonb,
        ARRAY['lowerBack']::jsonb,
        ARRAY[]::jsonb,
        ARRAY[]::jsonb
      );
    END IF;
    -- 10%: do nothing (booking without session, like a no-show or
    -- a client who skipped intake)
  END LOOP;

  RAISE NOTICE 'Seeded SOAP-note session records for past completed bookings.';
  RAISE NOTICE 'Refresh /dashboard/clients to see the populated profiles.';
END $$;
