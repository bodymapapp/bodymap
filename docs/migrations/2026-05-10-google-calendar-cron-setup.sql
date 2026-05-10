-- 2026-05-10-google-calendar-cron-setup.sql
--
-- Lindsey #10 follow-up: schedule the reverse-sync edge function
-- to run every 15 minutes via pg_cron. Run this AFTER the main
-- google-calendar-sync.sql migration AND after the edge function
-- is deployed.
--
-- Requires pg_cron extension (Supabase has it available; project
-- owner needs to enable it once via Database > Extensions).
--
-- The cron job hits the google-calendar-sync edge function with
-- an empty body, which triggers a sweep across all connected
-- therapists.

-- Enable pg_cron if not already (idempotent).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any prior schedule so re-running this script does not
-- create duplicates.
do $$
begin
  perform cron.unschedule('google-calendar-sync-15min');
exception when others then
  null;
end $$;

-- Schedule: every 15 min, hit the sync function.
-- Replace SUPABASE_PROJECT_REF and the service-role key in the
-- Authorization header. The service role key here is read from
-- the database vault, not pasted in source.
--
-- IMPORTANT: this requires the supabase Vault to have the service
-- role key stored under name 'service_role_key'. If not, see
-- the Supabase docs on vault.create_secret.

select cron.schedule(
  'google-calendar-sync-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select 'https://' || current_setting('app.supabase_project_ref', true) || '.supabase.co/functions/v1/google-calendar-sync'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
