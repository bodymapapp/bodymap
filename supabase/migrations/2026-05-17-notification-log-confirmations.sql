-- 2026-05-17-notification-log-confirmations.sql
-- Phase 11.2: Notification Compliance Dashboard support
--
-- HK May 17 2026 ~5:50am: 'Can we build a simple dashboard in
-- founder tab to have all the possibilities in first column and
-- all the communication mechanisms in subsequent columns and
-- turn them red, yellow, green based on what we have checked?'
--
-- The dashboard needs TWO signals per cell:
--   1. "Code fired" — already captured in notification_log.status
--   2. "Human confirmed" — NEW. Set when HK ticks a checkbox saying
--      "yes I received this on my Google Voice / my inbox / the bell."
--
-- These columns track signal #2. Each row in notification_log can be
-- independently confirmed. NULL means not yet confirmed.

alter table notification_log
  add column if not exists confirmed_at timestamptz;

alter table notification_log
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null;

comment on column notification_log.confirmed_at is
  'Set by founder dashboard when HK ticks a checkbox confirming this notification was actually received by the human (not just attempted by the engine). Separate signal from .status, which only reflects whether the upstream service (Resend, Twilio, in_app_notifications insert) accepted the send.';

comment on column notification_log.confirmed_by is
  'auth.users.id of the person who confirmed receipt. Usually HK during testing.';

-- Index for the dashboard query pattern: latest log row per
-- (therapist, audience, channel, notification_type) tuple.
create index if not exists idx_notification_log_dashboard
  on notification_log (therapist_id, notification_type, audience, channel, created_at desc);
