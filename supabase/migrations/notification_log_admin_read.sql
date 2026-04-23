-- ============================================================
-- Allow admin emails to read ALL notification_log rows
-- ============================================================
-- The default policy (notif_log_therapist_read) only lets each
-- therapist see their own rows via therapist_id = auth.uid().
-- This breaks the /founder dashboard's comms log grid, which
-- needs to see every therapist's history so the operator can
-- spot over-emailing.
--
-- This migration adds a second policy that grants SELECT to
-- known admin emails. Both policies are OR'd together by
-- Postgres, so therapists still see only their own rows.
-- ============================================================

DROP POLICY IF EXISTS "notif_log_admin_read" ON notification_log;

CREATE POLICY "notif_log_admin_read" ON notification_log
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN (
      'bodymap01@gmail.com',
      'bodymapdemo@gmail.com',
      'harshk.mba@gmail.com'
    )
  );
