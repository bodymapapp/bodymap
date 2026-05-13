-- demo-data/seed-packages-memberships.sql
--
-- Tiny seed for packages, memberships, and gift cards on demo data.
-- Sessions and earnings are populated by uploading demo-clients.csv
-- through the existing Import Clients UI (now that the importer
-- properly writes session_date, service_id, and price).
--
-- This script is run-and-forget. It auto-finds your therapist UUID
-- via auth.uid(), checks for existing seeded records (idempotent on
-- re-run), and creates exactly:
--   - 1 package (5-pack Swedish 60 @ $540)
--   - 1 membership (Monthly Member @ $95/mo)
--   - 3 active package_purchases (Sarah, Tom, Christina)
--   - 2 active member_subscriptions (Linda, Patrick)
--   - 4 gift cards in mixed states
--
-- Prerequisites:
--   1. You must be signed in to MyBodyMap so auth.uid() returns
--      your user id.
--   2. You must have uploaded demo-clients.csv first (this script
--      looks up clients by their @example.com emails).
--
-- To run: Supabase Dashboard > SQL Editor > New query > paste this
-- entire file > Run. Safe to re-run, won't duplicate.

DO $$
DECLARE
  v_therapist_id uuid;
  v_package_id uuid;
  v_membership_id uuid;
  v_service_id uuid;
  v_sarah_id uuid;
  v_tom_id uuid;
  v_christina_id uuid;
  v_linda_id uuid;
  v_patrick_id uuid;
BEGIN
  -- Find the signed-in therapist
  SELECT id INTO v_therapist_id
  FROM therapists
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1;

  IF v_therapist_id IS NULL THEN
    RAISE EXCEPTION 'Could not find therapist for current auth user. Make sure you are signed in to MyBodyMap.';
  END IF;

  -- ─────────── Package ───────────
  SELECT id INTO v_package_id
  FROM packages
  WHERE therapist_id = v_therapist_id AND name = '5-pack Swedish 60'
  LIMIT 1;

  IF v_package_id IS NULL THEN
    INSERT INTO packages (therapist_id, name, description, session_count, price, is_active)
    VALUES (
      v_therapist_id,
      '5-pack Swedish 60',
      'Five 60-minute Swedish massages, save $60.',
      5, 540, true
    )
    RETURNING id INTO v_package_id;
  END IF;

  -- ─────────── Membership ───────────
  SELECT id INTO v_membership_id
  FROM memberships
  WHERE therapist_id = v_therapist_id AND name = 'Monthly Member'
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    INSERT INTO memberships (
      therapist_id, name, description,
      monthly_price, monthly_session_credits, addon_discount_percent, is_active
    )
    VALUES (
      v_therapist_id,
      'Monthly Member',
      'One 60-minute session every month plus 10% off add-ons.',
      95, 1, 10, true
    )
    RETURNING id INTO v_membership_id;
  END IF;

  -- ─────────── Package purchases ───────────
  -- Three top demo clients get an active 5-pack with different
  -- remaining counts so the Active Balance card shows varied states.
  SELECT id INTO v_sarah_id FROM clients
    WHERE therapist_id = v_therapist_id AND email = 'sarah.mitchell@example.com' LIMIT 1;
  SELECT id INTO v_tom_id FROM clients
    WHERE therapist_id = v_therapist_id AND email = 'tom.reyes@example.com' LIMIT 1;
  SELECT id INTO v_christina_id FROM clients
    WHERE therapist_id = v_therapist_id AND email = 'christina.diaz@example.com' LIMIT 1;

  IF v_sarah_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM package_purchases WHERE client_id = v_sarah_id AND status = 'active'
  ) THEN
    INSERT INTO package_purchases (
      therapist_id, package_id, client_id, client_email, client_name,
      sessions_purchased, sessions_remaining, price_paid, status,
      expires_at, purchased_at
    ) VALUES (
      v_therapist_id, v_package_id, v_sarah_id, 'sarah.mitchell@example.com', 'Sarah Mitchell',
      5, 5, 540, 'active',
      CURRENT_DATE + 180, NOW() - interval '3 days'
    );
  END IF;

  IF v_tom_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM package_purchases WHERE client_id = v_tom_id AND status = 'active'
  ) THEN
    INSERT INTO package_purchases (
      therapist_id, package_id, client_id, client_email, client_name,
      sessions_purchased, sessions_remaining, price_paid, status,
      expires_at, purchased_at
    ) VALUES (
      v_therapist_id, v_package_id, v_tom_id, 'tom.reyes@example.com', 'Tom Reyes',
      5, 3, 540, 'active',
      CURRENT_DATE + 120, NOW() - interval '21 days'
    );
  END IF;

  IF v_christina_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM package_purchases WHERE client_id = v_christina_id AND status = 'active'
  ) THEN
    INSERT INTO package_purchases (
      therapist_id, package_id, client_id, client_email, client_name,
      sessions_purchased, sessions_remaining, price_paid, status,
      expires_at, purchased_at
    ) VALUES (
      v_therapist_id, v_package_id, v_christina_id, 'christina.diaz@example.com', 'Christina Diaz',
      5, 1, 540, 'active',
      CURRENT_DATE + 90, NOW() - interval '60 days'
    );
  END IF;

  -- ─────────── Memberships ───────────
  SELECT id INTO v_linda_id FROM clients
    WHERE therapist_id = v_therapist_id AND email = 'linda.park@example.com' LIMIT 1;
  SELECT id INTO v_patrick_id FROM clients
    WHERE therapist_id = v_therapist_id AND email = 'patrick.murphy@example.com' LIMIT 1;

  IF v_linda_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM member_subscriptions WHERE client_id = v_linda_id AND status = 'active'
  ) THEN
    INSERT INTO member_subscriptions (
      therapist_id, membership_id, client_id, client_email, client_name,
      status, current_period_start, current_period_end
    ) VALUES (
      v_therapist_id, v_membership_id, v_linda_id, 'linda.park@example.com', 'Linda Park',
      'active', NOW() - interval '18 days', NOW() + interval '12 days'
    );
  END IF;

  IF v_patrick_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM member_subscriptions WHERE client_id = v_patrick_id AND status = 'active'
  ) THEN
    INSERT INTO member_subscriptions (
      therapist_id, membership_id, client_id, client_email, client_name,
      status, current_period_start, current_period_end
    ) VALUES (
      v_therapist_id, v_membership_id, v_patrick_id, 'patrick.murphy@example.com', 'Patrick Murphy',
      'active', NOW() - interval '5 days', NOW() + interval '25 days'
    );
  END IF;

  -- ─────────── Gift cards ───────────
  -- Four cards in varied states so /dashboard/gifts is not empty.
  IF NOT EXISTS (
    SELECT 1 FROM gift_certificates
    WHERE therapist_id = v_therapist_id AND recipient_name = 'Mom (demo)'
  ) THEN
    INSERT INTO gift_certificates (
      therapist_id, code, amount, remaining,
      recipient_name, recipient_email, purchaser_name, message,
      status, design_template, theme, created_at
    ) VALUES
      (v_therapist_id, 'DEMO-MOM-' || substr(md5(random()::text), 1, 6),
       150, 150, 'Mom (demo)', 'mom.demo@example.com', 'Emma',
       'Happy Mother''s Day, you deserve every minute of this.',
       'active', 'just-because', 'rose', NOW() - interval '2 days'),
      (v_therapist_id, 'DEMO-ANN-' || substr(md5(random()::text), 1, 6),
       200, 0, 'Tom (anniversary, demo)', 'tom.anniv.demo@example.com', 'Rebecca',
       'Five years and still counting on these hands.',
       'redeemed', 'anniversary', 'sage', NOW() - interval '40 days'),
      (v_therapist_id, 'DEMO-BD-' || substr(md5(random()::text), 1, 6),
       120, 120, 'Lisa (birthday, demo)', 'lisa.bday.demo@example.com', 'Marcus',
       'Happy birthday. Time to be cared for instead of caring for everyone else.',
       'active', 'birthday', 'lavender', NOW() - interval '5 days'),
      (v_therapist_id, 'DEMO-TY-' || substr(md5(random()::text), 1, 6),
       85, 85, 'Carol (thank you, demo)', 'carol.ty.demo@example.com', 'David',
       'For everything you did during Mom''s last month. Thank you.',
       'active', 'thank-you', 'forest', NOW() - interval '14 days');
  END IF;

  RAISE NOTICE 'Demo packages, memberships, and gift cards seeded. Refresh dashboard.';
END $$;
