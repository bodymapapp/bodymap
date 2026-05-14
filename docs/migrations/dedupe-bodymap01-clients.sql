-- docs/migrations/dedupe-bodymap01-clients.sql
--
-- HK May 14 2026: bodymap01@gmail.com on the demo therapist account has
-- accumulated 4 duplicate client rows because earlier returning-customer
-- lookups used maybeSingle() which returns null on >1 match, then the
-- create branch inserted a new row. Code is now fixed (BookingPage,
-- init-card-setup, save-card-on-booking all dedupe + warn). This SQL
-- consolidates the existing duplicates so the test account is clean.
--
-- Run in two phases. Phase 1 is READ-ONLY: shows what would be merged.
-- Phase 2 is DESTRUCTIVE: actually merges. Review Phase 1 output before
-- running Phase 2.
--
-- ─────────────────────────────────────────────────────────────────────
-- PHASE 1: Inspect (read-only)
-- ─────────────────────────────────────────────────────────────────────

-- Which therapist_id is the demo account
WITH demo AS (
  SELECT id AS therapist_id FROM therapists
  WHERE LOWER(email) = LOWER('bodymapdemo@gmail.com')
  LIMIT 1
)
-- All client rows for the duplicate-prone email on the demo account
SELECT
  c.id,
  c.name,
  c.email,
  c.phone,
  c.card_saved_at,
  c.created_at,
  c.payment_method_id IS NOT NULL AS has_stripe_pm,
  c.square_card_id IS NOT NULL AS has_square_card,
  c.card_last4,
  c.card_brand,
  (SELECT count(*) FROM bookings b WHERE b.client_id = c.id) AS booking_count,
  (SELECT count(*) FROM sessions s WHERE s.client_id = c.id) AS session_count
FROM clients c, demo
WHERE c.therapist_id = demo.therapist_id
  AND LOWER(c.email) = LOWER('bodymap01@gmail.com')
ORDER BY c.card_saved_at DESC NULLS LAST, c.created_at DESC;

-- ─────────────────────────────────────────────────────────────────────
-- PHASE 2: Merge (only run after reviewing Phase 1 output)
-- ─────────────────────────────────────────────────────────────────────
--
-- Pick the "keep" row: most recent card_saved_at, falling back to most
-- recent created_at. That row's id replaces all duplicates' ids on
-- bookings and sessions, then the duplicates are deleted.
--
-- The card data (square_card_id, card_last4, card_brand, etc.) from the
-- best row is copied into the keep row first, so if the keep row has
-- only Stripe data but a sibling row has Square data + card_last4, the
-- merged keep row gets both. payment_method_id wins by recency on the
-- keep row itself; non-null Square fields get pulled forward.
--
-- Uncomment to run. Wrap in a transaction. Test on a non-production
-- environment first if you can.

/*
BEGIN;

WITH demo AS (
  SELECT id AS therapist_id FROM therapists
  WHERE LOWER(email) = LOWER('bodymapdemo@gmail.com')
  LIMIT 1
),
ranked AS (
  SELECT
    c.*,
    ROW_NUMBER() OVER (
      ORDER BY c.card_saved_at DESC NULLS LAST, c.created_at DESC
    ) AS rn
  FROM clients c, demo
  WHERE c.therapist_id = demo.therapist_id
    AND LOWER(c.email) = LOWER('bodymap01@gmail.com')
),
keep_row AS (
  SELECT id FROM ranked WHERE rn = 1
),
merge_data AS (
  SELECT
    -- Pull forward best non-null values across all duplicates so the
    -- keep row ends up with everything good.
    (SELECT square_card_id     FROM ranked WHERE square_card_id     IS NOT NULL ORDER BY rn LIMIT 1) AS square_card_id,
    (SELECT square_customer_id FROM ranked WHERE square_customer_id IS NOT NULL ORDER BY rn LIMIT 1) AS square_customer_id,
    (SELECT card_last4         FROM ranked WHERE card_last4         IS NOT NULL ORDER BY rn LIMIT 1) AS card_last4,
    (SELECT card_brand         FROM ranked WHERE card_brand         IS NOT NULL ORDER BY rn LIMIT 1) AS card_brand,
    (SELECT payment_method_id  FROM ranked WHERE payment_method_id  IS NOT NULL ORDER BY rn LIMIT 1) AS payment_method_id,
    (SELECT stripe_customer_id FROM ranked WHERE stripe_customer_id IS NOT NULL ORDER BY rn LIMIT 1) AS stripe_customer_id
)
UPDATE clients SET
  square_card_id     = COALESCE(clients.square_card_id,     merge_data.square_card_id),
  square_customer_id = COALESCE(clients.square_customer_id, merge_data.square_customer_id),
  card_last4         = COALESCE(clients.card_last4,         merge_data.card_last4),
  card_brand         = COALESCE(clients.card_brand,         merge_data.card_brand),
  payment_method_id  = COALESCE(clients.payment_method_id,  merge_data.payment_method_id),
  stripe_customer_id = COALESCE(clients.stripe_customer_id, merge_data.stripe_customer_id)
FROM merge_data, keep_row
WHERE clients.id = keep_row.id;

-- Reparent bookings from duplicates to the keep row
UPDATE bookings SET client_id = (SELECT id FROM keep_row)
WHERE client_id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Reparent sessions from duplicates to the keep row
UPDATE sessions SET client_id = (SELECT id FROM keep_row)
WHERE client_id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Delete the duplicate rows (Phase 1 output should confirm the count)
DELETE FROM clients WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

COMMIT;
*/

-- ─────────────────────────────────────────────────────────────────────
-- After Phase 2: verify
-- ─────────────────────────────────────────────────────────────────────
-- Re-run Phase 1. Should return exactly one row with combined card
-- data. booking_count and session_count should reflect totals from
-- previously-fragmented bookings/sessions across all duplicates.
