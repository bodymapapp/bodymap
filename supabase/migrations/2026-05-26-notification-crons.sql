-- supabase/migrations/2026-05-26-notification-crons.sql
--
-- Cron schedules for the 4 new TIME-DRIVEN email touchpoints from
-- the May 26 2026 notification expansion (chunks 1-3 of HK's Tier
-- 1+2+3 batch). The 9 EVENT-DRIVEN touchpoints fire from inline
-- code in notify-booking-event and other action handlers; they
-- don't need cron entries.
--
-- HK to run this manually in Supabase SQL editor on project
-- rmnqfrljoknmellbnpiy.
--
-- Pattern: each cron is a pg_cron schedule that POSTs to the
-- function URL with a hardcoded service_role JWT header (per
-- FOUNDER_RUNBOOK Procedure 11). The JWT below is the current
-- platform service_role key; if Anthropic ever rotates it, all
-- four crons need their tokens updated.
--
-- Cron timing chosen so the lapse chain fires in sequence:
--   09:00 UTC -> T14 renewal-due daily check
--   10:00 UTC -> C14 lapse-nudge
--   10:30 UTC -> C15 lapse-final-nudge (only fires if C14 was sent)
--   10:45 UTC -> T10 lapse-signal (references C14 fires from that morning)
--
-- And:
--   hourly :05 -> C3 intake-reminder (catches new bookings as
--                 they age past 24h)
--   hourly :15 -> C4 reminder-48h (window-driven, hourly catches everyone)

-- Replace this token with the current platform service_role JWT if
-- it has been rotated. The default token is the one in active use
-- as of May 26 2026.
-- BEFORE RUNNING: set this to your current service_role JWT.
DO $$
DECLARE
  service_role_jwt TEXT := 'PASTE_SERVICE_ROLE_JWT_HERE';
  supabase_url TEXT := 'https://rmnqfrljoknmellbnpiy.supabase.co';
BEGIN
  -- Drop any existing entries first so re-running this is idempotent
  PERFORM cron.unschedule('send-intake-reminder-hourly');
  PERFORM cron.unschedule('send-reminder-48h-hourly');
  PERFORM cron.unschedule('send-renewal-due-daily');
  PERFORM cron.unschedule('send-lapse-nudge-daily');
  PERFORM cron.unschedule('send-lapse-final-nudge-daily');
  PERFORM cron.unschedule('send-lapse-signal-daily');
EXCEPTION WHEN OTHERS THEN
  -- swallow: unschedule errors are fine if entries did not exist
  NULL;
END $$;

-- C3: hourly at :05
SELECT cron.schedule(
  'send-intake-reminder-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-intake-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE_SERVICE_ROLE_JWT_HERE',
      'apikey', 'PASTE_SERVICE_ROLE_JWT_HERE'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- C4: hourly at :15
SELECT cron.schedule(
  'send-reminder-48h-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-reminder-48h',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE_SERVICE_ROLE_JWT_HERE',
      'apikey', 'PASTE_SERVICE_ROLE_JWT_HERE'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- T14: daily at 09:00 UTC
SELECT cron.schedule(
  'send-renewal-due-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-renewal-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE_SERVICE_ROLE_JWT_HERE',
      'apikey', 'PASTE_SERVICE_ROLE_JWT_HERE'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- C14: daily at 10:00 UTC
SELECT cron.schedule(
  'send-lapse-nudge-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-lapse-nudge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE_SERVICE_ROLE_JWT_HERE',
      'apikey', 'PASTE_SERVICE_ROLE_JWT_HERE'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- C15: daily at 10:30 UTC
SELECT cron.schedule(
  'send-lapse-final-nudge-daily',
  '30 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-lapse-final-nudge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE_SERVICE_ROLE_JWT_HERE',
      'apikey', 'PASTE_SERVICE_ROLE_JWT_HERE'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- T10: daily at 10:45 UTC
SELECT cron.schedule(
  'send-lapse-signal-daily',
  '45 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-lapse-signal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE_SERVICE_ROLE_JWT_HERE',
      'apikey', 'PASTE_SERVICE_ROLE_JWT_HERE'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Verify all 6 are registered. Should return 6 rows.
SELECT jobname, schedule, active FROM cron.job
WHERE jobname IN (
  'send-intake-reminder-hourly',
  'send-reminder-48h-hourly',
  'send-renewal-due-daily',
  'send-lapse-nudge-daily',
  'send-lapse-final-nudge-daily',
  'send-lapse-signal-daily'
)
ORDER BY jobname;
