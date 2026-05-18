-- supabase/migrations/notification_prefs_renewal_due.sql
--
-- HK May 18 2026, Phase 19.4: add the 'renewal_due' notification type
-- to the therapist's default prefs so the daily-renewal-creation cron
-- can fire email + app_alert when a membership renewal is due in 1 day
-- or less.
--
-- Same pattern as the earlier in_app_notifications.sql migration: merge
-- the new key into existing prefs without disturbing therapist choices.
-- Default values: email=true, app_alert=true, sms=false (matches the
-- other therapist-side reminders).

-- Backfill: for existing therapists whose prefs already exist but lack
-- the renewal_due key, merge it in.
UPDATE therapists
SET notification_prefs = jsonb_set(
  notification_prefs,
  '{therapist}',
  COALESCE(notification_prefs->'therapist', '{}'::jsonb) || '{
    "renewal_due": {"email": true, "app_alert": true, "sms": false}
  }'::jsonb,
  true
)
WHERE notification_prefs IS NOT NULL
  AND NOT (notification_prefs->'therapist' ? 'renewal_due');
