-- supabase/migrations/gift_certificates_email_sent_at.sql
--
-- Adds an email_sent_at timestamp column to gift_certificates so the
-- send-gift-certificate edge function can check whether the recipient
-- email has already been delivered. This makes re-sends idempotent
-- without external state.
--
-- Why this matters:
-- The edge function can be called multiple times (on insert, on resend
-- request, on retry). Without this column we'd risk spamming a
-- recipient with the same gift card email if the create() function
-- fired twice. With this column, the function returns early with
-- {skipped: true, reason: 'already_sent'} on duplicate calls.
--
-- The column is nullable so existing rows (created before this
-- migration) are not retroactively marked as sent.

alter table gift_certificates
  add column if not exists email_sent_at timestamptz;

-- Index supports filter queries like "find unsent gift certs in the
-- last 7 days for this therapist" if we ever need a manual resend
-- dashboard. Cheap to add now.
create index if not exists gift_certificates_email_sent_at_idx
  on gift_certificates(email_sent_at);
