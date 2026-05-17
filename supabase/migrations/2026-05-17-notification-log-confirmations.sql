-- 2026-05-17-notification-log-confirmations.sql
-- Phase 11.2 (revised May 17 ~7am): Notification Compliance Dashboard support
--
-- HK May 17 2026: SQL error 'column created_at does not exist'
-- revealed the actual schema:
--   - timestamp column is sent_at, NOT created_at (set by Phase 3
--     in supabase/migrations/notification_preferences.sql)
--   - subject and body_snippet columns are ABSENT, yet the
--     existing fan-out code writes both fields on every insert.
--     The errors were silently swallowed by the try/catch in
--     logNotification. Confirmed by inspecting that helper.
--
-- This migration is the corrected version of what I should have
-- written in Phase 11.2:
--   1. Add the confirmation columns (already in spec)
--   2. Add the missing subject column
--   3. Add the missing body_snippet column
--   4. Add the dashboard index keyed on sent_at (the real timestamp)
--
-- Safe to re-run.

alter table notification_log
  add column if not exists confirmed_at timestamptz;

alter table notification_log
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null;

alter table notification_log
  add column if not exists subject text;

alter table notification_log
  add column if not exists body_snippet text;

comment on column notification_log.confirmed_at is
  'Set by founder dashboard when HK ticks a checkbox confirming this notification was actually received by the human (not just attempted by the engine). Separate signal from .status, which only reflects whether the upstream service accepted the send.';

comment on column notification_log.confirmed_by is
  'auth.users.id of the person who confirmed receipt.';

comment on column notification_log.subject is
  'Email subject line for email-channel sends. Null for SMS/bell/push.';

comment on column notification_log.body_snippet is
  'First 200 chars of the message body or subject. Used by the founder Notification Compliance dashboard side panel to show what was actually sent without joining to source data.';

-- Index for the dashboard query pattern: latest log row per
-- (therapist, audience, channel, notification_type) tuple,
-- ordered by sent_at desc.
create index if not exists idx_notification_log_dashboard
  on notification_log (therapist_id, notification_type, audience, channel, sent_at desc);
