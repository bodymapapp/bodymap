-- ─────────────────────────────────────────────────────────────────
-- Allow null client_email on bookings (Lindsey-adjacent fix May 9)
-- ─────────────────────────────────────────────────────────────────
--
-- WHY
--
-- Imported appointments often have phone-only or name-only clients
-- because spa POS systems pre-2015 frequently captured no email.
-- Jiny's data has many such rows. The current NOT NULL constraint
-- rejects 30-40% of typical legacy imports.
--
-- The constraint also doesn't add safety: every code path that
-- reads client_email already null-checks it (defensive coding
-- present throughout). The constraint just blocks legitimate
-- imports.
--
-- The public booking flow always supplies an email (form-required),
-- so this change does not weaken anything new-booking-related.
-- It only unblocks imports of historical data and walk-in bookings
-- created later via the dashboard for phone-only clients.
--
-- WHAT
--
-- ALTER TABLE bookings ALTER COLUMN client_email DROP NOT NULL.
-- Idempotent (DROP NOT NULL is a no-op if already nullable).

ALTER TABLE bookings ALTER COLUMN client_email DROP NOT NULL;

-- Sanity check: confirm column is now nullable
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name = 'client_email';
