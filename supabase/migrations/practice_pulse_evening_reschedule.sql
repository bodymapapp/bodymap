-- HK Jun 3 2026: Practice Pulse is an end-of-day digest. It was scheduled
-- at 18:00 UTC, which is 1pm Central (a timezone mistake: whoever set it
-- meant 6pm local). Move it to 01:00 UTC, which is 8pm Central in summer
-- and 7pm in winter. The practice-pulse edge function now computes "today"
-- and "tomorrow" in America/Chicago, so an evening send (which crosses
-- midnight UTC) still summarizes the correct calendar day.
--
-- Idempotent: looks up the existing job by name and alters only its
-- schedule, preserving the command (the authenticated net.http_post call).
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'practice-pulse-daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.alter_job(jid, schedule => '0 1 * * *');
  END IF;
END $$;
