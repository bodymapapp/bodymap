# Notification Test Plan + Status Matrix

**Updated:** 2026-05-30 01:30 UTC (after consolidation commit `8cb45aa3` + cleanup `b9a04c9e`)
**Audit window:** Last 48 hours, Joy Demo therapist (`2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`)

## Status legend

- **WORKING**: Confirmed `status=sent` in last 48h
- **SHOULD WORK**: Code path fixed by the inline-consolidation rebuild but not yet verified by a real test
- **NEEDS TEST**: Code path looks intact but no recent attempt; never broken, just untested in the audit window
- **NOT BUILT**: Touchpoint defined in spec but no edge function exists yet
- **CHECK CONFIG**: Recent activity but with `failed` rows mixed in (likely bad-email test or other data issue)

---

## Audit query (use after EVERY test below to confirm what fired)

Run this against Joy Demo therapist in project `rmnqfrljoknmellbnpiy`:

```sql
select sent_at, audience, channel, notification_type, status, recipient,
  left(error_message, 250) as error
from notification_log
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sent_at > now() - interval '5 minutes'
order by sent_at desc;
```

---

## CLIENT EMAILS (16 spec'd touchpoints)

| ID | Title | Last seen | Status | How to test |
|---|---|---|---|---|
| **C1** | New booking confirmation | May 30 01:17 ✓ | **WORKING** | Just verified. |
| **C2** | Booking confirmation (returning client) | May 17 | **SHOULD WORK** | Book a 2nd session for an EXISTING client (Joy Client works). Different copy than C1. |
| **C3** | Intake reminder | May 29 21:05 ✓ | **WORKING** | Fires from cron daily at noon. Verified. |
| **C4** | Early reminder (24h) | May 29 09:00 ✓ | **WORKING** | Fires from cron 24h before booking. Verified. |
| **C5** | Same-day text (first-timers) | Never | **SHOULD WORK** (SMS only) | Wait for a same-day booking by a first-time client; fires from cron at booking-time minus 2h. |
| **C6** | Post-session warmth | May 25 ✓ | **WORKING** | Fires from cron after session marked complete. Verified. |
| **C7** | Free-cancel confirmation (`client_cancelled_within_policy`) | May 17 | **SHOULD WORK** (fixed today) | Open `/book/healinghands/manage?b=<booking_id>` (use a future booking), tap Cancel. Within-policy = no fee. |
| **C8** | Itemized late-cancel (`client_cancelled_late`) | May 17 | **SHOULD WORK** (fixed today) | Same as C7 but for a booking inside the cancellation policy window. Should charge fee + send receipt. |
| **C9** | Polite no-show notice (no fee) | May 29 03:44 ✓ | **WORKING** | From Sessions tab, mark a past booking as No-show. Choose "Skip fee". Verified. |
| **C10** | Polite no-show notice (charged) (`no_show_charged`) | May 17 | **SHOULD WORK** (fixed today) | From Sessions, No-show on a booking with card-on-file. Choose "Charge fee". |
| **C11** | Polite payment request (`no_show_payment_request`) | May 17 | **SHOULD WORK** (fixed today) | No-show on a booking WITHOUT card-on-file. Should send pay-now link. |
| **C12** | Therapist-cancel apology (`therapist_cancelled`) | May 17 | **SHOULD WORK** (fixed today) | From Schedule, open a future booking, Cancel. Choose "I'm cancelling" (therapist-initiated). |
| **C13** | Reschedule confirmation | May 30 01:18 ✓ | **WORKING** | Verified after the inline-consolidation fix. |
| **C14** | Warm 45-day check-in (`lapse_nudge`) | May 17 | **NEEDS TEST** | Cron-driven. Triggers when a client hasn't booked in 45d. To test, manually invoke `send-lapse-nudge` for client `7e571e57-...090` (Lapse Test client, designed for this). |
| **C15** | Respectful final goodbye (`lapse_final_nudge`) | May 17 | **NEEDS TEST** | Cron-driven, fires at 90 days. Same client as C14. |
| **C16** | Refund issued (client receipt) | Never | **NEEDS TEST** | From a paid session, issue a refund via SOAP/billing. |

## THERAPIST NOTIFICATIONS (16 spec'd touchpoints, all channels)

| ID | Title | Last seen | Status | How to test |
|---|---|---|---|---|
| **T1** | New booking | May 30 01:17 ✓ | **WORKING** | Any new booking via BookingPage or BookingModal. 7 failed mixed in over 48h, see Open Questions. |
| **T2** | New client signed up | May 25 17:20 ✓ | **WORKING** | Have a new client complete intake. |
| **T3** | Intake submitted | May 29 03:54 ✓ | **WORKING** | Client fills out intake form. Verified. |
| **T4** | Payment received | May 29 03:58 ✓ | **WORKING** | Charge a session via Mark-as-paid or Stripe. |
| **T5** | Booking cancelled | May 29 03:38 ✓ | **WORKING** | Any cancellation. |
| **T6** | Booking rescheduled | May 30 01:18 ✓ | **WORKING** | Verified. |
| **T7** | No-show recorded | May 29 03:44 ✓ | **WORKING** | Any No-show. |
| **T8** | Practice agreement signed | May 17 | **NEEDS TEST** | Send agreement to client, have them sign at `/s/<code>`. |
| **T9** | Gift certificate purchased | May 17 | **NEEDS TEST** | Buy a gift cert via public gift page. |
| **T9b** | New membership signup | Never | **NEEDS TEST** | Client purchases a membership. |
| **T9c** | Membership renewing in 7 days | Never | **NEEDS TEST** | Cron-driven. Manually invoke `send-renewal-due` for a membership 7d out. |
| **T10** | Regular client going quiet (`lapse_signal`) | May 17 | **NEEDS TEST** | Cron-driven. Same lapse test client. |
| **T11** | Daily evening digest (`practice_pulse`) | May 29 18:00 ✓ | **WORKING** | Fires from cron daily. Verified. |
| **T12** | Cancellation fee charged | May 17 | **NEEDS TEST** | Fires when C8 or C10 succeeds. Test alongside those. |
| **T13** | System failure | May 17 | **NOT TESTABLE NORMALLY** | Fires when something throws an error in a critical edge function. Should rarely fire; presence in log is bad news. |
| **T14** | Refund issued | Never | **NEEDS TEST** | Test alongside C16. |

---

## Test script (concrete, ordered)

Walk these 10 actions in order against Joy Demo. After each, run the audit query above. Note which new log rows appear.

### Setup
Use Joy Client (`ce205279-3800-4335-b1c7-0b5ad1092a14`) for the working tests. Use Lapse Test client (`7e571e57-7e57-4090-9000-000000000090`) for lapse tests. Both have `bodymap0n@gmail.com` (intentional bad-email test).

### Action 1: Returning-client booking (→ C2 + T1)
1. On Schedule, open Joy Client's profile.
2. Tap "Book next".
3. Pick any future slot, save.
4. **Expected log rows:** `booking_confirmation_returning` (client email), `new_booking` (therapist email + app_alert + sms + push).

### Action 2: Therapist-initiated cancel (→ C12 + T5)
1. On Schedule, open a future booking.
2. Tap Cancel.
3. Choose "I'm cancelling" / therapist-initiated.
4. **Expected:** `therapist_cancelled` (client), `booking_cancelled` (therapist all channels).

### Action 3: Client-initiated cancel within policy (→ C7 + T5)
1. From a therapist booking confirmation email in your inbox, click "View or cancel this booking".
2. On `/book/healinghands/manage?b=...`, tap Cancel.
3. Use a booking >24h in future (within free-cancel window).
4. **Expected:** `client_cancelled_within_policy` (client), `booking_cancelled` (therapist).

### Action 4: Client-initiated late cancel (→ C8 + T5 + T12)
1. Same as Action 3, but use a booking <24h in future.
2. Should charge cancellation fee.
3. **Expected:** `client_cancelled_late` (client receipt), `booking_cancelled` (therapist), `cancellation_fee_charged` (therapist).

### Action 5: No-show with card-on-file (→ C10 + T7 + T12)
1. Mark a past booking with card-on-file as No-show.
2. Choose "Charge fee".
3. **Expected:** `no_show_charged` (client), `no_show_recorded` (therapist), `cancellation_fee_charged` (therapist).

### Action 6: No-show without card (→ C11 + T7)
1. Mark a past booking with NO card-on-file as No-show.
2. Should generate Stripe payment link.
3. **Expected:** `no_show_payment_request` (client with pay link), `no_show_recorded` (therapist).

### Action 7: Practice agreement signed (→ T8)
1. From client profile, send agreement.
2. Open the agreement link, sign.
3. **Expected:** `agreement_signed` (therapist all channels).

### Action 8: Gift certificate purchase (→ T9)
1. Public gift page or test buy flow.
2. Complete purchase via Stripe.
3. **Expected:** `gift_purchased` (therapist).

### Action 9: Lapse nudges (→ C14, C15, T10)
Use the Lapse Test client (intentionally seeded as 90d+ inactive).

To manually trigger (because waiting for cron is slow), invoke directly:
```sql
-- Project: rmnqfrljoknmellbnpiy
select net.http_post(
  url := 'https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/send-lapse-nudge',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <PASTE_SIGNED_JWT_FROM_CRON>'
  ),
  body := jsonb_build_object('therapist_id', '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf')
);
```
(The signed JWT is in the cron job config: `select jobname, command from cron.job where jobname like '%lapse%'`)
**Expected:** `lapse_nudge` (C14) or `lapse_final_nudge` (C15), plus `lapse_signal` (T10) on the therapist side.

### Action 10: Refund (→ C16 + T14)
1. From a paid session record, tap Refund.
2. Complete via Stripe.
3. **Expected:** `refund_issued` rows for both audiences.

---

## Open questions / known data issues

### `booking_confirmation` had 4 `failed` in 48h
Recipient is `bodymap0n@gmail.com` (deliberate bad-email test for the Lapse Test client). Expected. Not a code bug.

### `new_booking` had 7 `failed` in 48h
Same root cause: the Lapse Test client's email is intentionally broken. Resend returns "invalid recipient". Not a code bug.

### Stale `fan_out_send-reschedule-confirmation http_401` row at 00:54 UTC
That row is from BEFORE the consolidation commit `8cb45aa3` deployed. After consolidation, no more fan_out_* rows are created. Old row is historical artifact only.

### SMS channels
All 5 SMS rows in last 48h show `skipped` not `sent`. Two reasons:
1. Some clients have null phone numbers.
2. `notifyClient` respects quiet hours (21:00-08:00). Several test times fell in that window.

To force-send an SMS for testing, override quiet hours by running tests during 08:00-21:00 local. Or pass `respectQuietHours: false` in a one-off invocation.

### Push channels
All `skipped` per design (client portal not built, no subscriptions). Therapist push works.

---

## Updated quick matrix (TL;DR)

```
Working in last 48h (confirmed):
  Client emails:  C1, C3, C4, C6, C9, C13           (6 of 16)
  Therapist:      T1, T2, T3, T4, T5, T6, T7, T11   (8 of 16)

Should work post-consolidation (untested):
  Client emails:  C2, C5, C7, C8, C10, C11, C12     (7 of 16)

Needs first-ever test:
  Client emails:  C14, C15, C16                     (3 of 16)
  Therapist:      T8, T9, T9b, T9c, T10, T12, T14   (7 of 16)

Should rarely fire (don't seek to test):
  Therapist:      T13                                (1 of 16)
```

Run Actions 1-10 above end-to-end and rerun the audit query. Everything in "Should work" should flip to "Working". Anything that stays unfired or fires with `failed`/`skipped` reasons we don't expect: file a focused bug.
