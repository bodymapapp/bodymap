-- =========================================================
-- BodyMap RLS Audit & Hardening
-- Run this in Supabase SQL Editor. Read the results carefully.
-- =========================================================

-- ─── PART 1: AUDIT ────────────────────────────────────────
-- See which tables have RLS enabled and which have policies.
-- Anything public-facing (clients, sessions, bookings, etc.) MUST have RLS on.
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (SELECT count(*) FROM pg_policies p WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename) AS num_policies
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY rls_enabled ASC, tablename;

-- See every existing policy on every table
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =========================================================
-- ─── PART 2: HARDEN THERAPIST-SCOPED TABLES ───────────────
-- Every table that has a therapist_id column should restrict
-- reads/writes to rows where therapist_id = auth.uid().
-- Run each ENABLE + CREATE POLICY block one at a time;
-- if a policy already exists, the CREATE POLICY will error —
-- that's fine, the RLS is already in place.
-- =========================================================

-- therapists (self only)
ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "therapists_self_all" ON therapists;
CREATE POLICY "therapists_self_all" ON therapists
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_therapist_all" ON clients;
CREATE POLICY "clients_therapist_all" ON clients
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_therapist_all" ON sessions;
CREATE POLICY "sessions_therapist_all" ON sessions
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookings_therapist_all" ON bookings;
CREATE POLICY "bookings_therapist_all" ON bookings
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- gift_certificates
ALTER TABLE gift_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gift_certs_therapist_all" ON gift_certificates;
CREATE POLICY "gift_certs_therapist_all" ON gift_certificates
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_therapist_all" ON services;
CREATE POLICY "services_therapist_all" ON services
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- blocked_days
ALTER TABLE blocked_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_days_therapist_all" ON blocked_days;
CREATE POLICY "blocked_days_therapist_all" ON blocked_days
  FOR ALL USING (therapist_id = auth.uid()) WITH CHECK (therapist_id = auth.uid());

-- push_subscriptions (already has RLS from earlier migration — this is idempotent)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- signup_attempts: service-role only, no user access
ALTER TABLE signup_attempts ENABLE ROW LEVEL SECURITY;
-- (no policies = default deny for anon/authenticated)

-- =========================================================
-- ─── PART 3: PUBLIC READ EXCEPTIONS ───────────────────────
-- Some tables need SELECT by anon for the public booking page
-- to work: a client visiting mybodymap.app/book/SLUG needs to
-- read the therapist's services, business_name, and availability
-- WITHOUT being logged in. We allow narrow, read-only anon access.
-- =========================================================

-- Public can read therapist public profile by custom_url only (not email/phone/etc.)
DROP POLICY IF EXISTS "therapists_public_read_by_url" ON therapists;
CREATE POLICY "therapists_public_read_by_url" ON therapists
  FOR SELECT
  USING (custom_url IS NOT NULL);
-- ↑ NOTE: This allows anon SELECT of ALL columns on any therapist with a custom_url.
-- If you want to hide email/phone from the booking page, restrict columns at the
-- application layer (select specific columns only when fetching as anon).

-- Public can read services of any therapist (needed for booking page)
DROP POLICY IF EXISTS "services_public_read" ON services;
CREATE POLICY "services_public_read" ON services
  FOR SELECT USING (true);

-- =========================================================
-- ─── PART 4: VERIFY ───────────────────────────────────────
-- Re-run this after the above to confirm every relevant table has RLS on.
-- =========================================================

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('therapists','clients','sessions','bookings','gift_certificates','services','blocked_days','push_subscriptions','signup_attempts')
ORDER BY tablename;
-- Every row should show rowsecurity = true.
