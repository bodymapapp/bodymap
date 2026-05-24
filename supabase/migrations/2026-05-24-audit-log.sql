-- 2026-05-24-audit-log.sql
--
-- Purpose: append-only audit log of every write to key tables.
-- Captures full before/after row state with timestamp so any change
-- can be traced or reconstructed.
--
-- Why this exists:
--   On the night of May 23 2026, a comprehensive wipe ran against the
--   wrong therapist_id (Candice instead of Jacquie). 256 clients, 395
--   bookings, 25 services, plus notification_log, session_payments,
--   activation_events, and more were deleted. Recovery took 5+ hours
--   and depended on the Supabase Pro daily backup happening to exist.
--
--   Without an audit log we had no record of what was deleted, when,
--   or by which session. We reconstructed by diffing the backup against
--   live. An audit log would have given us the deletes as a tail
--   immediately, no diff required.
--
-- What this migration does:
--   1. Creates audit_log table (append-only, jsonb before/after).
--   2. Defines audit_trigger() function that writes to audit_log
--      on every INSERT/UPDATE/DELETE.
--   3. Attaches the trigger to the five highest-value tables:
--      bookings, clients, services, sessions, session_payments.
--
-- Storage cost: very small. jsonb compresses well. Even at 100x current
-- write volume this is < 100 MB / month.
--
-- How to query later:
--   -- Everything that changed for a therapist in the last 24h:
--   SELECT occurred_at, table_name, operation,
--          COALESCE(new_data->>'id', old_data->>'id') AS row_id
--   FROM audit_log
--   WHERE COALESCE(new_data->>'therapist_id', old_data->>'therapist_id') = '58799af0-...'
--     AND occurred_at > NOW() - INTERVAL '24 hours'
--   ORDER BY occurred_at DESC;
--
--   -- All DELETEs in the last hour (catches incidents like May 23):
--   SELECT * FROM audit_log
--   WHERE operation = 'DELETE'
--     AND occurred_at > NOW() - INTERVAL '1 hour'
--   ORDER BY occurred_at DESC;
--
-- Safe to re-run.

BEGIN;

-- =========================================================================
-- 1. Table
-- =========================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id              bigserial PRIMARY KEY,
  table_name      text        NOT NULL,
  operation       text        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id          uuid,
  old_data        jsonb,
  new_data        jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT NOW(),
  session_user    text                 DEFAULT session_user,
  application_name text                DEFAULT current_setting('application_name', true)
);

-- Indexes for the query patterns we expect.
-- 1) "What changed for therapist X recently" - by therapist_id (lives in jsonb)
CREATE INDEX IF NOT EXISTS idx_audit_log_therapist_recent
  ON audit_log ((COALESCE(new_data->>'therapist_id', old_data->>'therapist_id')), occurred_at DESC);

-- 2) "What changed in the last hour across all tables" - by time
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at
  ON audit_log (occurred_at DESC);

-- 3) "All DELETEs recently" - by operation + time
CREATE INDEX IF NOT EXISTS idx_audit_log_operation_time
  ON audit_log (operation, occurred_at DESC);

-- 4) "Everything that ever happened to row X"
CREATE INDEX IF NOT EXISTS idx_audit_log_row_id
  ON audit_log (row_id, occurred_at DESC);

COMMENT ON TABLE audit_log IS
  'Append-only log of every INSERT/UPDATE/DELETE on key tables (bookings, clients, services, sessions, session_payments). Created May 24 2026 after the Candice incident. Storage cost is small. Do not write to this table directly; the triggers handle it.';

-- =========================================================================
-- 2. Trigger function
-- =========================================================================
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS trigger AS $$
DECLARE
  v_row_id uuid;
BEGIN
  -- Pull the row id from whichever record is non-null
  IF TG_OP = 'DELETE' THEN
    v_row_id := OLD.id;
  ELSE
    v_row_id := NEW.id;
  END IF;

  INSERT INTO audit_log (
    table_name,
    operation,
    row_id,
    old_data,
    new_data
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_row_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- If audit logging itself fails, do NOT block the underlying write.
  -- Better to lose a log row than to break the app. This is a tradeoff:
  -- audit is best-effort, not transactional. If you want strict, remove
  -- the EXCEPTION block.
  RAISE WARNING 'audit_trigger failed for % on %: %', TG_OP, TG_TABLE_NAME, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger() IS
  'Writes a row to audit_log for every INSERT/UPDATE/DELETE on tables it is attached to. Best-effort: a failed audit insert does not block the underlying write.';

-- =========================================================================
-- 3. Attach trigger to the five highest-value tables.
-- =========================================================================
-- Drop and recreate so this migration is idempotent.

DROP TRIGGER IF EXISTS trg_audit_bookings ON bookings;
CREATE TRIGGER trg_audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_clients ON clients;
CREATE TRIGGER trg_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_services ON services;
CREATE TRIGGER trg_audit_services
  AFTER INSERT OR UPDATE OR DELETE ON services
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_sessions ON sessions;
CREATE TRIGGER trg_audit_sessions
  AFTER INSERT OR UPDATE OR DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_session_payments ON session_payments;
CREATE TRIGGER trg_audit_session_payments
  AFTER INSERT OR UPDATE OR DELETE ON session_payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- =========================================================================
-- Verification: run after COMMIT to confirm triggers are attached.
-- =========================================================================
--   SELECT event_object_table, trigger_name, action_timing, event_manipulation
--   FROM information_schema.triggers
--   WHERE trigger_name LIKE 'trg_audit_%'
--   ORDER BY event_object_table, event_manipulation;
--
-- Expected: 15 rows (5 tables x 3 event types). Each row shows
-- AFTER timing.

COMMIT;
