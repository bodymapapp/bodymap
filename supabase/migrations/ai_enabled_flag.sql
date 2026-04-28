-- supabase/migrations/ai_enabled_flag.sql
--
-- Adds the ai_enabled flag on the therapists table to let solo therapists
-- turn off AI-powered features in their dashboard while keeping every
-- non-AI tool (booking, intake, SOAP, billing, reminders, schedule).
--
-- Triggered by Erica Pearre's question on the Badass Bodyworkers FB community
-- (April 2026): "Are you able to turn off AI?" -- HK confirmed: yes, build it.
--
-- Defaults to TRUE for all existing therapists. New signups inherit the
-- default so AI surfaces are visible until the therapist opts out.

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT TRUE;

-- Backfill any NULL values (paranoid: should already be TRUE from default)
UPDATE therapists SET ai_enabled = TRUE WHERE ai_enabled IS NULL;

COMMENT ON COLUMN therapists.ai_enabled IS
  'When false, hides AI features (MyBodyMap AI chat, pre-session briefs, Practice Pulse digest) from the therapist dashboard. Set via Settings page. Does not delete data — flipping back to true restores all AI surfaces.';
