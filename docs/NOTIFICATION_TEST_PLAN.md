# Notification Test Plan

**Updated:** 2026-05-30 02:30 UTC
**Therapist:** Joy Therapist / Healing Hands / `2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`

---

## Step 0: Setup fixtures (run once)

This SQL block creates 6 labeled test clients with their bookings. All emails go to `bodymap0n@gmail.com` (your test inbox). Run this once in the SQL editor.

```sql
-- Project: rmnqfrljoknmellbnpiy
-- Setup test clients and bookings for Joy Therapist notification testing
-- Cleanup later via: delete from clients where name like 'Joy Test [%]';

-- ============================================================
-- CLIENTS (6 dedicated, marked by [test-id] in name)
-- ============================================================

insert into clients (id, therapist_id, name, email, phone, stripe_customer_id, created_at)
values
  ('7e571e57-c700-0007-0000-000000000007',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   'Joy Test [C7-free-cancel]', 'bodymap0n@gmail.com', '+15555550007', null, now()),
  ('7e571e57-c800-0008-0000-000000000008',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   'Joy Test [C8-late-cancel]', 'bodymap0n@gmail.com', '+15555550008',
   'cus_UWoz3g5eIIDER9', now()),
  ('7e571e57-cc10-0010-0000-000000000010',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   'Joy Test [C10-no-show-charged]', 'bodymap0n@gmail.com', '+15555550010',
   'cus_UWoz3g5eIIDER9', now()),
  ('7e571e57-cc11-0011-0000-000000000011',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   'Joy Test [C11-no-show-nocard]', 'bodymap0n@gmail.com', '+15555550011', null, now()),
  ('7e571e57-cc12-0012-0000-000000000012',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   'Joy Test [C12-therapist-cancel]', 'bodymap0n@gmail.com', '+15555550012', null, now()),
  ('7e571e57-cc16-0016-0000-000000000016',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   'Joy Test [C16-refund]', 'bodymap0n@gmail.com', '+15555550016', null, now())
on conflict (id) do nothing;

-- ============================================================
-- BOOKINGS (one per test that needs a booking)
-- Using Deep Tissue ($100, 60min), Joy's primary location
-- ============================================================

with loc as (
  select id from therapist_locations
  where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf' limit 1
)
insert into bookings (
  id, therapist_id, client_id, client_name, client_email,
  service_id, location_id, booking_date, start_time, end_time,
  status, tip_cents, pay_in_full
)
values
  -- C7 free cancel: 7 days out, no card on client
  ('7e571e57-c700-0007-bbbb-000000000007',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   '7e571e57-c700-0007-0000-000000000007',
   'Joy Test [C7-free-cancel]', 'bodymap0n@gmail.com',
   '288de41e-3256-4248-95b4-6989cf8103c6',
   (select id from loc),
   current_date + 7, '10:00:00', '11:00:00', 'confirmed', 0, false),

  -- C8 late cancel: TODAY at 23:00, card on file. Within 24h = 50% fee
  ('7e571e57-c800-0008-bbbb-000000000008',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   '7e571e57-c800-0008-0000-000000000008',
   'Joy Test [C8-late-cancel]', 'bodymap0n@gmail.com',
   '288de41e-3256-4248-95b4-6989cf8103c6',
   (select id from loc),
   current_date, '23:00:00', '23:59:00', 'confirmed', 0, false),

  -- C10 no-show charged: yesterday, card on file
  ('7e571e57-cc10-0010-bbbb-000000000010',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   '7e571e57-cc10-0010-0000-000000000010',
   'Joy Test [C10-no-show-charged]', 'bodymap0n@gmail.com',
   '288de41e-3256-4248-95b4-6989cf8103c6',
   (select id from loc),
   current_date - 1, '14:00:00', '15:00:00', 'confirmed', 0, false),

  -- C11 no-show no card: yesterday, no card
  ('7e571e57-cc11-0011-bbbb-000000000011',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   '7e571e57-cc11-0011-0000-000000000011',
   'Joy Test [C11-no-show-nocard]', 'bodymap0n@gmail.com',
   '288de41e-3256-4248-95b4-6989cf8103c6',
   (select id from loc),
   current_date - 1, '15:00:00', '16:00:00', 'confirmed', 0, false),

  -- C12 therapist cancel: 5 days out
  ('7e571e57-cc12-0012-bbbb-000000000012',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   '7e571e57-cc12-0012-0000-000000000012',
   'Joy Test [C12-therapist-cancel]', 'bodymap0n@gmail.com',
   '288de41e-3256-4248-95b4-6989cf8103c6',
   (select id from loc),
   current_date + 5, '10:00:00', '11:00:00', 'confirmed', 0, false),

  -- C16 refund: 3 days ago, complete
  ('7e571e57-cc16-0016-bbbb-000000000016',
   '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
   '7e571e57-cc16-0016-0000-000000000016',
   'Joy Test [C16-refund]', 'bodymap0n@gmail.com',
   '288de41e-3256-4248-95b4-6989cf8103c6',
   (select id from loc),
   current_date - 3, '14:00:00', '15:00:00', 'complete', 0, false)
on conflict (id) do nothing;

-- ============================================================
-- PAYMENTS (only for C16 refund: cash $100 succeeded)
-- ============================================================

insert into session_payments (
  id, booking_id, therapist_id, client_id,
  amount_cents, payment_method, status, paid_at,
  created_by_therapist_id, created_at
) values (
  '7e571e57-cc16-0016-pppp-000000000016',
  '7e571e57-cc16-0016-bbbb-000000000016',
  '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
  '7e571e57-cc16-0016-0000-000000000016',
  10000, 'cash', 'succeeded', current_date - 3,
  '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf', now()
) on conflict (id) do nothing;
```

---

## Audit query (rerun after every test)

```sql
select sent_at, audience, channel, notification_type, status,
  recipient, left(error_message, 200) as error
from notification_log
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sent_at > now() - interval '5 minutes'
order by sent_at desc;
```

---

# Tests (in efficient walking order)

---

### Test 1 :: C2 booking confirmation (returning client)

Booking: use existing **Joy Client** (already has 60+ past bookings, system treats as returning)

Action:
1. Dashboard :: Clients :: Joy Client
2. Tap **Book next**
3. Pick any future date and time, save

Expected:
* Toast: booking saved
* Therapist email: T1 new booking
* Client email: C2 booking_confirmation_returning (NOT C1)

Tick rows: T1, C2

---

### Test 2 :: C16 + T14 refund

Booking: **Joy Test [C16-refund]** (3 days ago, $100 Deep Tissue, paid cash, status complete)

Action:
1. Dashboard :: Clients :: search "Joy Test [C16-refund]"
2. Open her Sessions tab, find the 3-day-old session
3. Tap to open the session
4. In the billing area, tap **Refund** ($100 cash refund button)
5. Confirm

Expected:
* Toast: refund issued
* Therapist email: T14 refund_issued
* Client email: C16 refund_issued

Tick rows: T14, C16

---

### Test 3 :: C10 + T7 + T12 no-show charged

Booking: **Joy Test [C10-no-show-charged]** (yesterday at 14:00, card on file via cloned customer)

Action:
1. Dashboard :: Sessions tab
2. Find yesterday's 14:00 booking for "Joy Test [C10-no-show-charged]"
3. Tap to open
4. Tap **Mark no-show**
5. Choose **Charge fee** (will charge 100% no-show fee = $100 via Stripe card on file)
6. Confirm

Expected:
* Toast: no-show recorded, fee charged
* Therapist alerts: T7 no_show_recorded (Bell + email + SMS + push)
* Client email: C10 no_show_charged with receipt
* Therapist email: T12 cancellation_fee_charged (the actual charge alert)

Tick rows: T7, T12, C10

---

### Test 4 :: C11 + T7 no-show no card

Booking: **Joy Test [C11-no-show-nocard]** (yesterday at 15:00, no card on client)

Action:
1. Dashboard :: Sessions tab
2. Find yesterday's 15:00 booking for "Joy Test [C11-no-show-nocard]"
3. Tap to open
4. Tap **Mark no-show**
5. Choose **Send payment link** (only option since no card)
6. Confirm

Expected:
* Toast: payment link sent
* Therapist alerts: T7 no_show_recorded
* Client email: C11 no_show_payment_request with Stripe payment link button

Tick rows: T7, C11

---

### Test 5 :: C12 + T5 therapist cancel

Booking: **Joy Test [C12-therapist-cancel]** (5 days out, 10:00)

Action:
1. Dashboard :: Schedule, find the booking 5 days out at 10:00 for "Joy Test [C12-therapist-cancel]"
2. Tap to open the booking detail panel
3. Tap **Cancel session**
4. Choose **I'm cancelling** (therapist-initiated)
5. Optionally add a reason like "Sick today"
6. Confirm

Expected:
* Toast: session cancelled
* Therapist alerts: T5 booking_cancelled (all channels)
* Client email: C12 therapist_cancelled with apology + rebook CTA

Tick rows: T5, C12

---

### Test 6 :: C7 + T5 free cancel (client-initiated)

Booking: **Joy Test [C7-free-cancel]** (7 days out, no card)

Pre-action SQL (turn off policy so fee = 0):
```sql
update therapists set cancellation_policy_enabled = false
where id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf';
```

Action:
1. Open URL in browser: `https://mybodymap.app/book/healinghands/manage?b=7e571e57-c700-0007-bbbb-000000000007`
2. BookingManage page loads, shows the session 7 days out
3. Tap **Cancel this booking**
4. Confirm

Expected:
* Toast on manage page: cancellation confirmed
* Therapist alerts: T5 booking_cancelled
* Client email: C7 client_cancelled_within_policy (sage tone, no fee mentioned)

Tick rows: T5, C7

Post-action SQL (restore policy):
```sql
update therapists set cancellation_policy_enabled = true
where id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf';
```

---

### Test 7 :: C8 + T5 + T12 late cancel with fee

Booking: **Joy Test [C8-late-cancel]** (today at 23:00, card on file, within 24h = 50% fee window)

Prerequisite: policy enabled (restored after Test 6).

Action:
1. Open URL in browser: `https://mybodymap.app/book/healinghands/manage?b=7e571e57-c800-0008-bbbb-000000000008`
2. BookingManage page shows the session today 23:00
3. Tap **Cancel this booking**
4. Policy modal appears showing 50% fee = $50
5. Confirm
6. Stripe charges $50 to Joy Client's card on file (real charge in live mode)

Expected:
* Toast: cancellation confirmed, $50 fee charged
* Therapist alerts: T5 booking_cancelled, T12 cancellation_fee_charged
* Client email: C8 client_cancelled_late with receipt showing $50 fee

Tick rows: T5, T12, C8

---

### Test 8 :: T8 practice agreement signed

No booking needed. Uses Joy Client (existing).

Action:
1. Dashboard :: Clients :: Joy Client
2. Find **Send agreement** action (in status strip or actions menu)
3. Tap **Send via email**
4. Switch to your inbox (bodymap0n@gmail.com), open the agreement email
5. Tap **Sign agreement** link, opens `/s/<code>` page
6. Type signature, tap **Submit**

Expected:
* On signing page: confirmation that agreement was saved
* Therapist alerts: T8 agreement_signed (Bell + email + push)

Tick rows: T8

---

### Test 9 :: C14 + T10 lapse 45-day nudge

Client: **Lapse Test [C14-45d]** (pre-seeded, last session 45 days ago, no card)

Action (manual cron invocation via SQL):
```sql
-- Get the signed JWT from any existing lapse cron job
select substring(command, 'Authorization": "Bearer ([^"]+)') as jwt
from cron.job
where jobname ilike '%lapse%'
limit 1;
```
Copy the JWT. Then:
```sql
select net.http_post(
  url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-lapse-nudge',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <PASTE_JWT_HERE>'
  ),
  body := jsonb_build_object('therapist_id', '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf')
);
```

Expected:
* Client email: C14 lapse_nudge (warm 45-day check-in)
* Therapist alert: T10 lapse_signal

Tick rows: T10, C14

---

### Test 10 :: C15 + T10 lapse 90-day final goodbye

Client: **Lapse Test [C15-90d]** (pre-seeded, last session 94 days ago)

Action (manual cron invocation):
```sql
select net.http_post(
  url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-lapse-final-nudge',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <SAME_JWT_AS_TEST_9>'
  ),
  body := jsonb_build_object('therapist_id', '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf')
);
```

Expected:
* Client email: C15 lapse_final_nudge (respectful final goodbye)

Tick rows: C15

---

### Test 11 :: T9 gift certificate purchased

No fixture: use the public gift page.

Action:
1. Open URL: `https://mybodymap.app/book/healinghands/gift` (or whatever Joy's gift URL is in Settings :: Gift cards)
2. Fill out: recipient name = "Test Recipient", amount = $50, your name + email
3. Use Stripe test card or pay via your real card (will be a real $50 charge)
4. Complete checkout

Expected:
* Stripe success page
* Therapist alerts: T9 gift_purchased (Bell + email + push)

Tick rows: T9

---

### Test 12 :: T9b new membership signup

Prerequisite: Joy needs an active membership plan. Check Dashboard :: Settings :: Memberships. If none exist, skip this test.

If a plan exists:
1. Open the membership purchase URL (per Joy's plan setup, usually `https://mybodymap.app/book/healinghands/membership`)
2. Pick a plan, complete Stripe checkout

Expected:
* Stripe success page
* Therapist alert: T9b new_membership_signup

Tick rows: T9b

---

### Test 13 :: T9c renewal due (cron-invoked)

Prerequisite: at least one member_subscription with a scheduled renewal in the next 7 days. If you ran Test 12, that should set one up.

Action (manual cron invocation):
```sql
-- Check if any renewals are due
select id, scheduled_at, status from member_subscription_renewals
where scheduled_at < now() + interval '7 days' and status = 'scheduled'
limit 3;

-- If yes, invoke send-renewal-due
select net.http_post(
  url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-renewal-due',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <SAME_JWT_AS_TEST_9>'
  ),
  body := jsonb_build_object('therapist_id', '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf')
);
```

Expected:
* Therapist alert: T9c membership_renewal_due

Tick rows: T9c

---

# Cleanup (after testing)

When done with all tests, remove the test fixtures:

```sql
-- Remove fixtures (cascades to bookings + session_payments via FK)
delete from session_payments where id = '7e571e57-cc16-0016-pppp-000000000016';

delete from bookings where id in (
  '7e571e57-c700-0007-bbbb-000000000007',
  '7e571e57-c800-0008-bbbb-000000000008',
  '7e571e57-cc10-0010-bbbb-000000000010',
  '7e571e57-cc11-0011-bbbb-000000000011',
  '7e571e57-cc12-0012-bbbb-000000000012',
  '7e571e57-cc16-0016-bbbb-000000000016'
);

delete from clients where id in (
  '7e571e57-c700-0007-0000-000000000007',
  '7e571e57-c800-0008-0000-000000000008',
  '7e571e57-cc10-0010-0000-000000000010',
  '7e571e57-cc11-0011-0000-000000000011',
  '7e571e57-cc12-0012-0000-000000000012',
  '7e571e57-cc16-0016-0000-000000000016'
);

-- Confirm policy is back on (in case Test 6 SQL was rolled back partially)
update therapists set cancellation_policy_enabled = true
where id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf';
```

---

# Status matrix (last 48h)

```
WORKING (verified):
  Client:    C1, C3, C4, C6, C9, C13                  (6 of 16)
  Therapist: T1, T2, T3, T4, T5, T6, T7, T11          (8 of 16)

SHOULD WORK post-consolidation 8cb45aa3:
  Client:    C2, C5, C7, C8, C10, C11, C12            (7 of 16)

NEEDS FIRST-EVER TEST:
  Client:    C14, C15, C16                             (3 of 16)
  Therapist: T8, T9, T9b, T9c, T10, T12, T14           (7 of 16)

SHOULD RARELY FIRE (don't seek to test):
  Therapist: T13 (system_failure)                      (1 of 16)
```

Tests 1-7 cover all 7 SHOULD-WORK rows. Tests 2-13 plus the lapse tests cover all 10 NEEDS-TEST rows. Total ~30 minutes if you run the SQL setup once at the top and work through tests in order.
