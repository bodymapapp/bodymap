-- docs/migrations/dedupe-bodymap01-clients-phase2.sql
--
-- HK May 14 2026 confirmed all 5 client rows for bodymap01@gmail.com on
-- the demo therapist account are the same person (different phone
-- formats, different test booking attempts, accumulated over a week of
-- testing). Merging all 5 into one.
--
-- KEEP row picked by hand, not formula:
--   d38ce2b4-09d5-40cd-9959-0f31b652301c
--   Why: 13 bookings (most history), both Stripe and Square card data,
--   card_last4 6383, card_brand visa, phone format '(979) 739-6185'.
--
-- DELETE rows (4):
--   26c5a5cc-83cb-4b42-bf9d-bf588353f7d6  (0 bookings, 0 sessions, stripe only, May 11)
--   63a43dd6-7e63-476c-8019-b92dfe456304  (3 bookings, 0 sessions, both, May 10)
--   59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71  (0 bookings, 0 sessions, stripe only, May 8)
--   8d3a5293-a097-41c7-8bd5-40bb54d0611d  (0 bookings, 1 session, no cards, May 11)
--
-- After merge: keep row has 16 bookings (13 + 3 + 0 + 0 + 0) and 1
-- session (0 + 0 + 0 + 0 + 1), plus best card data rolled forward.
--
-- ─────────────────────────────────────────────────────────────────────
-- Run this whole block as one transaction. Review the SELECT at the
-- bottom; if numbers look right, the merge worked.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Pull forward any non-null card data from siblings onto keep row,
--    so anything good on the duplicates does not get lost when they
--    are deleted. COALESCE preserves the keep row's value when it
--    already has one.
WITH best AS (
  SELECT
    (SELECT square_card_id     FROM clients WHERE id IN (
      '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
      '63a43dd6-7e63-476c-8019-b92dfe456304',
      '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
      'd38ce2b4-09d5-40cd-9959-0f31b652301c',
      '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
    ) AND square_card_id     IS NOT NULL ORDER BY card_saved_at DESC NULLS LAST LIMIT 1) AS square_card_id,
    (SELECT square_customer_id FROM clients WHERE id IN (
      '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
      '63a43dd6-7e63-476c-8019-b92dfe456304',
      '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
      'd38ce2b4-09d5-40cd-9959-0f31b652301c',
      '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
    ) AND square_customer_id IS NOT NULL ORDER BY card_saved_at DESC NULLS LAST LIMIT 1) AS square_customer_id,
    (SELECT card_last4         FROM clients WHERE id IN (
      '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
      '63a43dd6-7e63-476c-8019-b92dfe456304',
      '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
      'd38ce2b4-09d5-40cd-9959-0f31b652301c',
      '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
    ) AND card_last4         IS NOT NULL ORDER BY card_saved_at DESC NULLS LAST LIMIT 1) AS card_last4,
    (SELECT card_brand         FROM clients WHERE id IN (
      '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
      '63a43dd6-7e63-476c-8019-b92dfe456304',
      '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
      'd38ce2b4-09d5-40cd-9959-0f31b652301c',
      '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
    ) AND card_brand         IS NOT NULL ORDER BY card_saved_at DESC NULLS LAST LIMIT 1) AS card_brand,
    (SELECT payment_method_id  FROM clients WHERE id IN (
      '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
      '63a43dd6-7e63-476c-8019-b92dfe456304',
      '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
      'd38ce2b4-09d5-40cd-9959-0f31b652301c',
      '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
    ) AND payment_method_id  IS NOT NULL ORDER BY card_saved_at DESC NULLS LAST LIMIT 1) AS payment_method_id,
    (SELECT stripe_customer_id FROM clients WHERE id IN (
      '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
      '63a43dd6-7e63-476c-8019-b92dfe456304',
      '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
      'd38ce2b4-09d5-40cd-9959-0f31b652301c',
      '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
    ) AND stripe_customer_id IS NOT NULL ORDER BY card_saved_at DESC NULLS LAST LIMIT 1) AS stripe_customer_id
)
UPDATE clients SET
  square_card_id     = COALESCE(clients.square_card_id,     best.square_card_id),
  square_customer_id = COALESCE(clients.square_customer_id, best.square_customer_id),
  card_last4         = COALESCE(clients.card_last4,         best.card_last4),
  card_brand         = COALESCE(clients.card_brand,         best.card_brand),
  payment_method_id  = COALESCE(clients.payment_method_id,  best.payment_method_id),
  stripe_customer_id = COALESCE(clients.stripe_customer_id, best.stripe_customer_id),
  -- Normalize phone to the clean format on the keep row.
  phone = '(979) 739-6185'
FROM best
WHERE clients.id = 'd38ce2b4-09d5-40cd-9959-0f31b652301c';

-- 2. Reparent all bookings from duplicates onto keep row
UPDATE bookings SET client_id = 'd38ce2b4-09d5-40cd-9959-0f31b652301c'
WHERE client_id IN (
  '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
  '63a43dd6-7e63-476c-8019-b92dfe456304',
  '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
  '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
);

-- 3. Reparent all sessions from duplicates onto keep row
UPDATE sessions SET client_id = 'd38ce2b4-09d5-40cd-9959-0f31b652301c'
WHERE client_id IN (
  '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
  '63a43dd6-7e63-476c-8019-b92dfe456304',
  '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
  '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
);

-- 4. Reparent anything else that might reference these client rows.
--    feedback table has a session_id, not a client_id, so it follows
--    sessions automatically. intake_edits references session_id too.
--    package_purchases and member_subscriptions reference client_id
--    directly, so include them defensively. If a table does not exist
--    or has no rows, the UPDATE is a no-op.
UPDATE package_purchases SET client_id = 'd38ce2b4-09d5-40cd-9959-0f31b652301c'
WHERE client_id IN (
  '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
  '63a43dd6-7e63-476c-8019-b92dfe456304',
  '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
  '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
);

UPDATE member_subscriptions SET client_id = 'd38ce2b4-09d5-40cd-9959-0f31b652301c'
WHERE client_id IN (
  '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
  '63a43dd6-7e63-476c-8019-b92dfe456304',
  '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
  '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
);

-- 5. Delete the 4 duplicate rows
DELETE FROM clients WHERE id IN (
  '26c5a5cc-83cb-4b42-bf9d-bf588353f7d6',
  '63a43dd6-7e63-476c-8019-b92dfe456304',
  '59ab0a92-08f3-49ab-a9fd-70cb5b9bbe71',
  '8d3a5293-a097-41c7-8bd5-40bb54d0611d'
);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Verify: should return exactly 1 row, with 16 bookings and 1 session
-- ─────────────────────────────────────────────────────────────────────

SELECT
  c.id,
  c.name,
  c.email,
  c.phone,
  c.card_last4,
  c.card_brand,
  c.payment_method_id IS NOT NULL AS has_stripe_pm,
  c.square_card_id IS NOT NULL    AS has_square_card,
  (SELECT count(*) FROM bookings b WHERE b.client_id = c.id) AS booking_count,
  (SELECT count(*) FROM sessions s WHERE s.client_id = c.id) AS session_count
FROM clients c
WHERE c.therapist_id = (SELECT id FROM therapists WHERE LOWER(email) = LOWER('bodymapdemo@gmail.com'))
  AND LOWER(c.email) = LOWER('bodymap01@gmail.com');
