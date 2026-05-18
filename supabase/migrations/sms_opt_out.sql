-- supabase/migrations/sms_opt_out.sql
--
-- HK May 18 2026: SMS opt-out compliance for FCC/CTIA and Twilio
-- A2P 10DLC campaign approval. Macro #12 in BLOCK_PLAN.md.
--
-- We need to track when a client has opted out of SMS so we don't
-- waste Twilio API calls trying to message them after they texted
-- STOP. Twilio's network handles the STOP keyword automatically
-- (a STOP from a client suppresses future sends to that number at
-- Twilio's level), but our backend doesn't know about it, so we
-- still attempt sends, get rejected, and accumulate failed log rows.
--
-- This column lets the backend skip the send attempt entirely once
-- opt-out is recorded, which:
--   1. Stops the failed-send noise in notification_log
--   2. Lets the compliance dashboard show 'skipped, opted out'
--      cleanly instead of red failures
--   3. Is required documentation for A2P campaign approval that we
--      respect opt-out at the application layer
--
-- The actual opt-out write comes from sms-inbound edge function
-- when a client texts STOP to a therapist's Twilio number. Twilio
-- POSTs the inbound message to a webhook we configure in their
-- Console; the edge function matches the From number to a client
-- and stamps this column.
--
-- HELP keyword is also a CTIA requirement. Twilio's default HELP
-- response is the brand name + opt-out instruction, which is
-- compliant; we don't need a separate column for HELP unless we
-- ever want to customize per-therapist.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sms_opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_opted_out_via text;

-- sms_opted_out_via tracks how the opt-out happened so we can
-- distinguish carrier/Twilio-level STOP from a manual unsubscribe
-- a therapist might do on the client's behalf. Values used:
--   'keyword_stop'    -- client texted STOP (or variant) to therapist
--   'manual'          -- therapist marked client as opted out
--   'bounce'          -- carrier returned hard bounce N times

CREATE INDEX IF NOT EXISTS clients_sms_opted_out_at_idx
  ON clients(sms_opted_out_at)
  WHERE sms_opted_out_at IS NOT NULL;
