-- supabase/migrations/therapist_timezone.sql
--
-- HK Jun 5 2026: store each therapist's IANA timezone (e.g.
-- 'America/Chicago') so notification emails can render real-instant
-- timestamps (like "Rescheduled at") in the therapist's local time
-- instead of the edge runtime's UTC.
--
-- Captured automatically from the browser on dashboard load (AuthContext)
-- when missing. Nullable; email code falls back to UTC if not yet set.
-- Note: appointment times (booking_date + start_time) are naive local
-- wall-clock and are NOT shifted by this; only true instants use it.

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS timezone TEXT;
