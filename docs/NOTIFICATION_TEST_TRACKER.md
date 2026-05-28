# Notification verification tracker

Started May 28 2026 (~11am CT). HK tests live, 5 at a time. Claude keeps score and checks notification_log via read-only connector after each test.

Status key: UNTESTED, PASS (HK saw it land + log confirms), FAIL (did not land), FIXED-UNVERIFIED (Claude fixed a bug, awaiting HK retest).

Recent code fixes that should have un-broken many of these:
- 49ff5ccd notify-booking-event bad columns (price_cents, start_at)
- d68359e7 12 senders start_date/service_name/duration_min/location_address
- a9052ac7 10 senders clients.unsubscribed_at -> outreach_unsubscribed_at
- 5771c82a therapist_locations.address compose (reschedule + 48h)
- 37d332d2 default-on prefs (email + app_alert), package payment fires payment_received
- 82db6f55 bulk summary email

## Therapist-facing (T-series)

| ID | Event | What triggers it | Status | Notes |
|----|-------|------------------|--------|-------|
| T1 | new_booking | Client books a session (or bulk summary) | PASS | Log shows sent, confirmed working |
| T2 | new_client_signup | New client signs up / first books | PASS | Log shows sent |
| T3 | intake_filled | Client submits intake form | UNTESTED | |
| T4 | payment_received | Any payment succeeds (deposit, package, at-session) | PASS | Log shows sent (package + session) |
| T5 | booking_cancelled | Booking cancelled (therapist alert) | PASS | Log shows all 4 channels sent on May 28 cancel test |
| T6 | booking_rescheduled | Booking rescheduled (therapist alert) | UNTESTED | |
| T7 | no_show_recorded | Therapist marks no-show | UNTESTED | |
| T8 | agreement_signed | Client signs practice agreement | UNTESTED | |
| T9 | gift_purchased | Someone buys a gift certificate | UNTESTED | |
| T10 | lapse_signal | Regular client goes quiet | UNTESTED | cron |
| T11 | daily_pulse | Daily evening digest | UNTESTED | cron |
| T12 | cancellation_fee_charged | Cancellation fee charged | UNTESTED | |
| T13 | system_failure | System failure | UNTESTED | edge case |
| T14 | refund_issued | Refund issued (therapist) | UNTESTED | |

## Client-facing (C-series)

| ID | Event | What triggers it | Status | Notes |
|----|-------|------------------|--------|-------|
| C1 | booking_confirmation | New client books | PASS | Log shows sent |
| C2 | booking_confirmation | Returning client books | PASS | Log shows sent |
| C3 | intake_reminder | 48h+ before, intake not filled | FIXED-UNVERIFIED | unsubscribed_at fixed |
| C4 | reminder_48h | 48h before session | FIXED-UNVERIFIED | start_date + unsubscribed_at + location fixed |
| C5 | reminder_2h | 2h before (first-timers, SMS) | BLOCKED | SMS not in prod |
| C6 | post_session | After session ends | UNTESTED | |
| C7 | client_cancelled_within_policy | Client cancels, no fee | FIXED-UNVERIFIED | unsubscribed_at fixed |
| C8 | client_cancelled_late | Client cancels late, fee | FIXED-UNVERIFIED | unsubscribed_at fixed |
| C9 | no_show_notice_no_fee | No-show, no fee | UNTESTED | |
| C10 | no_show_charged | No-show, charged | FIXED-UNVERIFIED | unsubscribed_at fixed |
| C11 | no_show_payment_request | No-show, no card, payment link | FIXED-UNVERIFIED | unsubscribed_at fixed |
| C12 | therapist_cancelled | Therapist cancels (client apology) | FIXED-UNVERIFIED | THE May 28 miss, unsubscribed_at fixed |
| C13 | reschedule_confirmation | Booking rescheduled (client) | FIXED-UNVERIFIED | start_date + unsubscribed_at + location fixed |
| C14 | lapse_nudge | 45-day check-in | FIXED-UNVERIFIED | cron, unsubscribed_at fixed |
| C15 | lapse_final_nudge | Final goodbye | FIXED-UNVERIFIED | cron, unsubscribed_at fixed |
| C16 | refund_issued | Refund receipt (client) | UNTESTED | |

## Test batches

Batch 1 (in progress): C12, C13, C7, C8, C4 (the just-fixed cancel/reschedule/reminder family, highest value, easiest to trigger from Schedule)
