# Notification Test Plan + Status Matrix

**Updated:** 2026-05-30 02:00 UTC
**Audit window:** Last 48 hours, Joy Demo therapist (`2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`)

---

## Quick reference

**Project:** `rmnqfrljoknmellbnpiy`
**Therapist:** Joy Therapist (Healing Hands) : `2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`
**Slug:** `healinghands`
**Test clients:**
- Joy Client (`ce205279-3800-4335-b1c7-0b5ad1092a14`) : HAS Stripe customer (card on file)
- Lapse Test (`7e571e57-7e57-4090-9000-000000000090`) : NO Stripe customer (good for no-card flows)

Both share email `bodymap0n@gmail.com` (deliberate bad-email test).

**Joy's cancellation policy:**
- 24h+ before: 10% fee
- 2-24h before: 50% fee
- under 2h: 100% fee
- no-show: 100% fee

---

## Audit query (rerun after EVERY test)

```sql
select sent_at, audience, channel, notification_type, status,
  recipient, left(error_message, 200) as error
from notification_log
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sent_at > now() - interval '5 minutes'
order by sent_at desc;
```

---

## Status matrix (last 48h reality)

```
WORKING (verified in last 48h):
  Client:    C1, C3, C4, C6, C9, C13                  (6 of 16)
  Therapist: T1, T2, T3, T4, T5, T6, T7, T11          (8 of 16)

SHOULD WORK post-consolidation 8cb45aa3 (awaiting verify):
  Client:    C2, C5, C7, C8, C10, C11, C12            (7 of 16)

NEEDS FIRST-EVER TEST:
  Client:    C14, C15, C16                             (3 of 16)
  Therapist: T8, T9, T9b, T9c, T10, T12, T14           (7 of 16)

SHOULD RARELY FIRE (don't seek to test):
  Therapist: T13 (system_failure)                      (1 of 16)
```

---

# PART 1: "SHOULD WORK" tests (7 client emails)

These should all work after commit `8cb45aa3`. Walking through Part 1 takes ~20 minutes if you do them in order. The IDs below are pulled from current DB state.

---

## TEST 1: C2 : Booking confirmation (returning client)

**Trigger:** book a session for a client who has prior bookings.

**Steps:**
1. Open the app, go to Dashboard → Clients
2. Tap **Joy Client** (she has 50+ prior bookings, definitely returning)
3. Tap **Book next**
4. Pick any future date and time, save
5. Run the audit query

**Expected log row:**
```
notification_type = 'booking_confirmation_returning'
audience = 'client', channel = 'email', status = 'sent'
```

**Plus also expected:**
- `new_booking` (therapist email + app_alert)

---

## TEST 2: C12 : Therapist-cancel apology + T5 : Booking cancelled (therapist alert)

**Trigger:** therapist cancels a future booking.

**Use this existing booking:**
```
ID:    78cc0b97-a32a-47ed-a0ae-097bf0e5db07
Joy Client, June 1 at 10:00 AM, confirmed
(~2 days out, well within future)
```

**Steps:**
1. Dashboard → Schedule
2. Find Joy Client's booking on June 1 at 10am
3. Tap to open the detail panel
4. Tap **Cancel session**
5. Choose **"I'm cancelling"** / therapist-initiated path
6. Confirm
7. Run the audit query

**Expected log rows:**
```
notification_type = 'therapist_cancelled'  audience='client'  status='sent'    (C12)
notification_type = 'booking_cancelled'    audience='therapist' channels=all   (T5)
```

---

## TEST 3: C7 : Free-cancel confirmation (client-initiated, within free window)

**Trigger:** client cancels a future booking via the manage page when fee = 0.

**The trick:** Joy's policy charges 10% fee even 24h+ out, so to test C7 (zero-fee path) you need to either (a) temporarily disable the policy, or (b) cancel using the inline-undo flow that bypasses fees. I'll provide (a) since it's cleaner.

**SQL setup (temporarily disable policy):**
```sql
update therapists
  set cancellation_policy_enabled = false
where id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf';
```

**Use this existing booking:**
```
ID:    b999cc5a-7bf0-4f45-959d-dc462582bab0
Joy Client, June 2 at 10:00 AM, confirmed
```

**Steps:**
1. Open this URL in a browser: `https://mybodymap.app/book/healinghands/manage?b=b999cc5a-7bf0-4f45-959d-dc462582bab0`
2. The BookingManage page loads showing the booking
3. Tap **Cancel this booking**
4. Confirm
5. Run audit

**Expected log rows:**
```
notification_type = 'client_cancelled_within_policy'  audience='client'  status='sent'  (C7)
notification_type = 'booking_cancelled'                audience='therapist' channels=all (T5)
```

**SQL after-test (restore policy):**
```sql
update therapists
  set cancellation_policy_enabled = true
where id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf';
```

---

## TEST 4: C8 : Late-cancel itemized + T12 : Cancellation fee charged

**Trigger:** client cancels via manage page when fee > 0.

**Prerequisite:** policy must be ON (the restore SQL from Test 3 handles this).

**Use this existing booking:**
```
ID:    0d38dcb5-b37f-4bcb-b48d-a7aada58abdd
Joy Client, June 2 at 14:00, confirmed
(With policy ON, cancelling 3 days out = 10% fee = $10 for a $100 service)
```

**Steps:**
1. Open: `https://mybodymap.app/book/healinghands/manage?b=0d38dcb5-b37f-4bcb-b48d-a7aada58abdd`
2. Tap **Cancel this booking**
3. Policy modal appears with fee preview, confirm
4. Stripe charges Joy's card on file ($10ish)
5. Run audit

**Expected log rows:**
```
notification_type = 'client_cancelled_late'         audience='client'   status='sent'  (C8)
notification_type = 'booking_cancelled'             audience='therapist' channels=all  (T5)
notification_type = 'cancellation_fee_charged'      audience='therapist' channels=all  (T12)
```

---

## TEST 5: C10 : No-show notice (charged) + T7 : No-show recorded + T12

**Trigger:** therapist records a no-show on a past booking, client has card-on-file, charge fee.

**Need a past confirmed booking for Joy Client.** Most past ones are already completed or no-show'd. Use SQL to create a fresh fixture:

**SQL setup : create a past confirmed Joy Client booking:**
```sql
insert into bookings (
  id, therapist_id, client_id, client_name, client_email,
  service_id, location_id, booking_date, start_time, end_time,
  status, deposit_required_cents, deposit_paid_cents
)
values (
  gen_random_uuid(),
  '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
  'ce205279-3800-4335-b1c7-0b5ad1092a14',
  'Joy Client',
  'bodymap0n@gmail.com',
  '288de41e-3256-4248-95b4-6989cf8103c6',  -- Deep Tissue $100
  (select id from therapist_locations
   where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf' limit 1),
  current_date - 1,
  '14:00:00',
  '15:00:00',
  'confirmed',
  0, 0
)
returning id;
```

Save the returned UUID. That's your test booking.

**Steps:**
1. Dashboard → Sessions
2. Find yesterday's booking at 14:00 for Joy Client
3. Tap to open
4. Tap **Mark no-show**
5. Choose **"Charge fee"** ($100 since 100% no-show fee per policy)
6. Confirm
7. Run audit

**Expected log rows:**
```
notification_type = 'no_show_charged'             audience='client'    status='sent'   (C10)
notification_type = 'no_show_recorded'            audience='therapist' channels=all    (T7)
notification_type = 'cancellation_fee_charged'    audience='therapist' channels=all    (T12)
```

---

## TEST 6: C11 : No-show payment request (no card)

**Trigger:** therapist records no-show on Lapse Test (no card), system creates Stripe payment link.

**SQL setup : past confirmed booking for Lapse Test:**
```sql
insert into bookings (
  id, therapist_id, client_id, client_name, client_email,
  service_id, location_id, booking_date, start_time, end_time,
  status, deposit_required_cents, deposit_paid_cents
)
values (
  gen_random_uuid(),
  '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf',
  '7e571e57-7e57-4090-9000-000000000090',
  'Lapse Test [C15-90d]',
  'bodymap0n@gmail.com',
  '288de41e-3256-4248-95b4-6989cf8103c6',  -- Deep Tissue $100
  (select id from therapist_locations
   where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf' limit 1),
  current_date - 1,
  '15:00:00',
  '16:00:00',
  'confirmed',
  0, 0
)
returning id;
```

**Steps:**
1. Dashboard → Sessions
2. Find yesterday's booking at 15:00 for Lapse Test
3. Tap **Mark no-show**
4. Choose **"Send payment link"** (only option since no card)
5. Confirm
6. Run audit

**Expected log rows:**
```
notification_type = 'no_show_payment_request'   audience='client'    status='sent'  (C11)
notification_type = 'no_show_recorded'          audience='therapist' channels=all   (T7)
```

The client email should include a **"Pay $100 now"** button linking to a Stripe payment page.

---

## TEST 7: C5 : Same-day text (first-timers only)

**This is SMS only, not email.** Cron-driven, fires 2h before booking for first-time clients.

**Skip in the morning round.** Test when you have a first-time client booking later same day OR manually invoke the cron function. Lower priority since it's narrow scope (first-timers only).

---

# PART 2: "NEEDS TEST" notifications

## TEST 8: T8 : Practice agreement signed

**Trigger:** client signs the practice agreement.

**Steps:**
1. Dashboard → Clients → Joy Client
2. Look for **Send agreement** action (in status strip or actions menu)
3. Tap to send. Email goes to client.
4. Open the agreement email in your inbox
5. Tap the **sign here** link, opens `/s/<code>` page
6. Type signature, tap Submit
7. Run audit

**Expected log row:**
```
notification_type = 'agreement_signed'  audience='therapist'  channels=email+app_alert+push  status='sent'
```

---

## TEST 9: T9 : Gift certificate purchased

**Trigger:** someone purchases a gift certificate via the public gift page.

**Steps:**
1. Open: `https://mybodymap.app/book/healinghands/gift` (if this is the URL; check Settings → Gift cards)
2. Fill out the purchase form: recipient name, amount, your card
3. Complete Stripe checkout
4. Run audit

**Expected log row:**
```
notification_type = 'gift_purchased'  audience='therapist'  channels=email+app_alert+push  status='sent'
```

---

## TEST 10: T9b : New membership signup

**Trigger:** client purchases a membership plan.

**Prerequisite:** check that Joy has at least one active membership plan in Settings → Memberships.

**Steps:**
1. Open: `https://mybodymap.app/book/healinghands/membership` (or wherever the membership page is)
2. Pick a plan, complete Stripe checkout
3. Run audit

**Expected log row:**
```
notification_type = 'new_membership_signup'  audience='therapist'  status='sent'
```

---

## TEST 11: T9c : Membership renewing in 7 days

**Trigger:** cron-driven. Fires for any membership whose `next_renewal_at` is within 7 days.

**Manual trigger:**
```sql
-- Find any membership renewal due
select id, member_subscription_id, scheduled_at, status
from member_subscription_renewals
where scheduled_at < now() + interval '7 days'
  and status = 'scheduled'
limit 3;

-- If none exist, you need to first complete a membership signup (Test 10),
-- which schedules a renewal. The renewal-due email fires when scheduled_at
-- comes within the 7-day window per cron.
```

**Or invoke the cron function directly:**
```sql
select net.http_post(
  url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-renewal-due',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      select substring(command from 'Bearer ([A-Za-z0-9._-]+)')
      from cron.job
      where command like '%send-renewal-due%'
      limit 1
    )
  ),
  body := jsonb_build_object('therapist_id', '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf')
);
```

**Expected log row:**
```
notification_type = 'membership_renewal_due'  audience='therapist'  status='sent'
```

---

## TEST 12: T10 : Lapse signal + C14/C15 : Lapse nudges to client

**Trigger:** cron-driven daily. Fires for clients who haven't booked in 45d (C14) or 90d (C15).

**Lapse Test client is pre-seeded for this:** her last completed session was `2026-02-25` (94 days ago at time of writing). She is in C15 territory (90d+).

**Manual invocation:**
```sql
-- Pull the signed JWT from any of the existing lapse cron jobs
select jobname, schedule, substring(command from 1 for 200) as command_preview
from cron.job
where jobname ilike '%lapse%';
```

Use the JWT from that command to invoke:
```sql
select net.http_post(
  url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-lapse-final-nudge',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <PASTE_JWT_FROM_CRON>'
  ),
  body := jsonb_build_object('therapist_id', '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf')
);
```

For C14 (45-day), invoke `send-lapse-nudge` instead.
For T10 (therapist alert), invoke `send-lapse-signal`.

**Expected log rows:**
```
notification_type = 'lapse_final_nudge'  audience='client'     status='sent'  (C15)
notification_type = 'lapse_nudge'        audience='client'     status='sent'  (C14)
notification_type = 'lapse_signal'       audience='therapist'  status='sent'  (T10)
```

---

## TEST 13: C16 + T14 : Refund issued

**Trigger:** therapist issues a refund on a previously paid session.

**Use this existing payment:**
```
session_payment_id: e2e08327-c79f-44ff-a372-190ba5f61f18
booking_id:         cfe844be-2791-4a47-beac-4460535730f3
$1.00 paid via Stripe card on file, status = 'succeeded'
```

**Steps:**
1. Dashboard → Clients → Joy Client → Sessions tab
2. Find the May 29 session at 00:02 (Test Service, $1)
3. Tap to open
4. In billing actions, tap **Refund**
5. Confirm (full refund or partial)
6. Run audit

**Expected log rows:**
```
notification_type = 'refund_issued'  audience='client'     status='sent'  (C16)
notification_type = 'refund_issued'  audience='therapist'  status='sent'  (T14)
```

---

# Sequence (most efficient walking order)

Do this in ~25 minutes if you have a browser + the app open:

1. **Test 1** (C2 returning) : 2 min, just book one
2. **Test 5** (C10 no-show charged) : 3 min, run SQL setup then mark no-show
3. **Test 6** (C11 no-show no-card) : 3 min, same pattern with Lapse client
4. **Test 13** (C16 + T14 refund) : 2 min, use existing payment
5. **Test 8** (T8 agreement) : 4 min, send + sign flow
6. **Test 12** (lapse) : 3 min, SQL invocation
7. **Test 2** (C12 therapist cancel) : 2 min
8. **Test 3** (C7 free cancel) : 3 min, requires SQL toggle
9. **Test 4** (C8 late cancel + fee) : 3 min
10. **Test 9** (gift cert) : varies, depends on UI

After each, run the audit query and screenshot it. If anything shows `failed` with an error other than the `bodymap0n@gmail.com` Resend bounce, ping me.

---

# Notes

- All emails go to `bodymap0n@gmail.com` which is the deliberate bad-email test. Resend will return delivery failures for all of them. The `status = 'sent'` row in notification_log means **MyBodyMap successfully handed it to Resend**, not that Gmail accepted it. That's the right test boundary for our purposes.
- If you want to see emails actually land, temporarily change the test client emails to your real inbox:
  ```sql
  update clients set email = 'your+test@gmail.com'
  where id in (
    'ce205279-3800-4335-b1c7-0b5ad1092a14',
    '7e571e57-7e57-4090-9000-000000000090'
  );
  ```
  Run tests, then revert to `bodymap0n@gmail.com` for ongoing failure-path testing.
