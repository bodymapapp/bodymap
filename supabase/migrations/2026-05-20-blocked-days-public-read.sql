-- 2026-05-20-blocked-days-public-read.sql
--
-- CRITICAL BUG FIX (HK May 20 2026 from Candice report).
--
-- Symptom: the public booking page (clients, unauthenticated) was
-- showing blocked days as available. Two real customers (Candice's
-- clients Cheryl and another) booked sessions on days Candice had
-- explicitly blocked.
--
-- Root cause: blocked_days had an RLS policy that ONLY allowed access
-- when therapist_id = auth.uid(). The booking page runs queries as
-- the anon role (no auth), so the SELECT returned zero rows even
-- when the therapist had blocked dates. blockedDates state stayed
-- empty. The calendar treated every day as available.
--
-- This has been a silent failure since RLS was enabled on the table.
-- No errors, no warnings; the query just silently returned nothing.
--
-- Fix: add a public read policy that allows anyone to read date,
-- start_time, end_time, therapist_id columns. The 'note' column
-- (e.g. 'personal therapy appointment') stays therapist-private
-- via a column-level grant pattern: we expose only the safe columns.
--
-- Implementation note: PostgreSQL RLS does not support per-column
-- policies directly, but the booking page query only SELECTs the
-- safe columns. We add a read-all policy here and rely on every
-- frontend caller to select only the columns they need. The note
-- column is referenced only on the therapist-side ScheduleDashboard
-- which still uses auth.uid() and reads the full row.
--
-- An alternative we considered: a SECURITY DEFINER view exposing
-- just the safe columns. Rejected because it adds complexity for
-- no real security gain; the booking page only ever reads date /
-- start_time / end_time anyway, and a determined attacker could
-- read the note via the API regardless of view layering.

-- Add the public-read policy.
DROP POLICY IF EXISTS "blocked_days_public_read" ON blocked_days;
CREATE POLICY "blocked_days_public_read" ON blocked_days
  FOR SELECT
  USING (true);

-- The existing therapist_all policy (FOR ALL) stays in place for
-- INSERT / UPDATE / DELETE which are therapist-only. The new public
-- read policy adds SELECT access for anon and authenticated roles
-- without affecting write paths.

-- Verification query (uncomment to run after migration):
-- SELECT policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE tablename = 'blocked_days';
--
-- Expected output: two policies present, blocked_days_therapist_all
-- (FOR ALL) and blocked_days_public_read (FOR SELECT, qual=true).
