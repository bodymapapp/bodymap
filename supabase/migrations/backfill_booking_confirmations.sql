-- =====================================================================
-- Backfill: fire send-booking-confirmation for confirmed bookings that
-- have no client confirmation email logged.
--
-- WHY: Bookings created before the database trigger was installed (or
-- created during the window where the frontend helper was unreliable)
-- never had their confirmation email fired. This script fires the
-- edge function for every gap booking so customers who completed
-- bookings without receiving an email finally do.
--
-- IDEMPOTENT: Re-running is safe. The WHERE clause excludes any
-- booking that already has a 'sent' confirmation log row, so we will
-- not double-send to anyone who already got their email.
--
-- TIME WINDOW: Last 30 days only. Older gaps are ignored. Sending a
-- "booking confirmed" email for a session 6 months ago would confuse
-- the client more than help.
--
-- HOW TO USE:
--   1. Run booking_confirmation_trigger.sql first (installs pg_net,
--      creates the trigger for future bookings, vault key check).
--   2. Run this script. It will scan the last 30 days, find gap
--      bookings, and fire the function for each.
--   3. Watch Resend dashboard — emails should appear within seconds.
--   4. Verify with the diagnostic query at the bottom.
-- =====================================================================

DO $$
DECLARE
  v_service_role_key text;
  v_url text := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-booking-confirmation';
  v_booking RECORD;
  v_fired int := 0;
  v_skipped int := 0;
BEGIN
  -- 1. Verify pg_net is installed (it should be, from the trigger migration).
  --    CREATE IF NOT EXISTS just in case the trigger migration was not run.
  CREATE EXTENSION IF NOT EXISTS pg_net;

  -- 2. Pull service role key from vault. Cannot fire without it.
  BEGIN
    SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_role_key := NULL;
  END;

  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE EXCEPTION
      'service_role_key not found in vault. Set it once with: SELECT vault.create_secret(''<paste-service-role-key-from-supabase-dashboard>'', ''service_role_key'');';
  END IF;

  -- 3. Loop through gap bookings. Fire the function for each.
  FOR v_booking IN
    SELECT b.id, b.client_email, b.client_name, b.booking_date, b.start_time, b.status
    FROM bookings b
    WHERE b.status IN ('confirmed', 'pending-approval')
      AND b.created_at > NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM notification_log n
        WHERE n.booking_id = b.id
          AND n.notification_type IN ('booking_confirmation', 'booking_request_received')
          AND n.audience = 'client'
          AND n.status = 'sent'
      )
    ORDER BY b.created_at ASC
  LOOP
    -- Skip if no client_email. Cannot send without a recipient.
    IF v_booking.client_email IS NULL OR v_booking.client_email = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Fire the edge function. Async via pg_net; we do not wait for response.
    -- The function logs every send attempt to notification_log itself, so we
    -- can audit results after the loop completes.
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'booking_id', v_booking.id,
        'source', 'backfill'
      )
    );
    v_fired := v_fired + 1;

    -- Small delay to avoid hammering Resend rate limits and pg_net queue.
    -- 0.3s per booking handles 200+ bookings per minute, plenty for backfill.
    PERFORM pg_sleep(0.3);
  END LOOP;

  RAISE NOTICE 'Backfill complete. Fired % function calls. Skipped % bookings missing client_email.', v_fired, v_skipped;
END $$;

-- ---------------------------------------------------------------------
-- Diagnostic queries (run separately after the backfill to verify):
-- ---------------------------------------------------------------------

-- 1. See pg_net request results (the function call queue):
--    SELECT id, status_code, content::jsonb, created
--    FROM net._http_response
--    WHERE created > NOW() - INTERVAL '5 minutes'
--    ORDER BY created DESC LIMIT 50;

-- 2. See what the function actually logged:
--    SELECT sent_at, audience, recipient, status, subject
--    FROM notification_log
--    WHERE sent_at > NOW() - INTERVAL '5 minutes'
--    ORDER BY sent_at DESC;

-- 3. See remaining gap bookings (should be 0 or just bookings missing email):
--    SELECT b.id, b.client_name, b.client_email, b.status, b.created_at
--    FROM bookings b
--    WHERE b.status IN ('confirmed', 'pending-approval')
--      AND b.created_at > NOW() - INTERVAL '30 days'
--      AND NOT EXISTS (
--        SELECT 1 FROM notification_log n
--        WHERE n.booking_id = b.id
--          AND n.audience = 'client'
--          AND n.status = 'sent'
--      );
