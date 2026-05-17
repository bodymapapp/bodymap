# Notifications: Live Audit, May 17 2026 ~5am

## Test accounts reference

This is the verified setup for end-to-end notification testing.
**No secrets recorded here**, just identifiers and reference data.

### Therapist account

- **Login email:** `bodymapdemo@gmail.com` (NOT `mybodymapdemo`, common typo, caught May 17 ~5am)
- **Therapist id:** `2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`
- **Display name:** Joy Demo
- **Business name:** Healing Hands
- **Custom URL:** `healinghands`
- **Public booking page:** `https://mybodymap.app/book/healinghands`
- **Therapist dashboard:** `https://mybodymap.app/dashboard`
- **Twilio sender number:** `+15136133033` (verified in Twilio, paid number)
- **Twilio credentials live in the `therapists` row** (`twilio_account_sid`, `twilio_auth_token`, `twilio_phone_number`), NOT in Supabase secrets. Multi-tenant design: each therapist brings their own Twilio account.
- **Notification prefs:** seeded May 17 ~5am with all channels ON for: new_booking, booking_cancelled, no_show_recorded, payment_received, new_client_signup, plus client-side booking_confirmation/reminder_24h/post_session

### Client account

### Phone numbers in play

| Number | What it is | Role |
|---|---|---|
| `+15136133033` | Twilio platform number | THE SENDER. Founder outreach to therapists in production. Doubles as Joy Therapist's simulated BYO Twilio in testing. |
| `(513) 909-9004` | Google Voice (HK MacBook) | A receiving number HK controls from MacBook Messages app. Convenient for testing because messages land on the dev machine. |
| `(346) 242-6904` | Google Fi (physical phone) | A receiving number on a real phone. Higher delivery reliability for testing if Google Voice drops messages. |

**On Google Voice and A2P 10DLC:** Twilio sending to Google Voice numbers usually works, but Google Voice silently drops roughly 5% of messages from A2P 10DLC-registered Twilio numbers. For tests where MacBook visibility matters, use Google Voice and verify via `notification_log`. For high-stakes tests where every message must land, use Google Fi.

### Client account

- **Login email:** `bodymap01@gmail.com`
- **Canonical client row (after May 17 cleanup):**
  - `id` = `ce205279-3800-4335-b1c7-0b5ad1092a14`
  - `name` = `Joy Client`
  - `phone` = `+15139099004` (Google Voice on HK MacBook)
- **Older duplicate row (DELETED May 17):** id `d38ce2b4-09d5-40cd-9959-0f31b652301c`, name was "Mybodymap Demo", phone was incorrectly set to the Twilio sender number `5136133033`. Removed because sending to the Twilio sender from itself would fail with "From and To cannot match." Reference for forensics only.
- Linked to therapist_id `2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`.

### Seed SQL for notification_prefs

If notification_prefs needs to be reseeded for testing:

```sql
update therapists
set notification_prefs = jsonb_build_object(
  'client', jsonb_build_object(
    'booking_confirmation', jsonb_build_object('email', true, 'sms', true),
    'reminder_24h',         jsonb_build_object('email', true, 'sms', true),
    'post_session',         jsonb_build_object('email', true, 'sms', true),
    'rebooking_nudge',      jsonb_build_object('email', false, 'sms', false)
  ),
  'therapist', jsonb_build_object(
    'new_booking',        jsonb_build_object('email', true, 'app_alert', true, 'sms', true),
    'payment_received',   jsonb_build_object('email', true, 'app_alert', true, 'sms', true),
    'new_client_signup',  jsonb_build_object('email', true, 'app_alert', true, 'sms', true),
    'booking_cancelled',  jsonb_build_object('email', true, 'app_alert', true, 'sms', true),
    'no_show_recorded',   jsonb_build_object('email', true, 'app_alert', true, 'sms', true),
    'intake_filled',      jsonb_build_object('email', true, 'app_alert', true, 'sms', false),
    'gift_purchased',     jsonb_build_object('email', true, 'app_alert', true, 'sms', false),
    'daily_pulse',        jsonb_build_object('email', true)
  )
)
where id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf';
```

---

## TL;DR

We have **most of the engine already built**. The Notifications Architecture
playbook I wrote yesterday described a system that already exists in 80%
shipped form. What's missing is mostly the **client side** of the fan-out
and **SMS-first defaults** on some touchpoints.

This document captures what's wired today, what's wired but maybe not running,
and what's the highest-impact next fill.

---

## ✅ What IS wired (engine pieces in place)

### Shared notification engine

- **`supabase/functions/_shared/notifications.ts`** is the fan-out hub.
- **`notifyTherapist({ supabase, therapist, eventType, title, body, icon, linkUrl, emailSubject, emailHtml, smsText, payload, bookingId, clientId, sessionId })`** is the one-call fan-out for therapist-side events. Hits three channels:
  - **Bell drawer** (in-app): inserts into `in_app_notifications` table
  - **Email**: via Resend
  - **SMS**: via `sendSmsViaTwilio` using therapist's stored Twilio creds
- Each channel is **gated by `therapist.notification_prefs[audience][type][channel]`**
- Each attempt **logged to `notification_log`** with status + error
- Defensive: failures don't throw, every channel returns ok/skipped/failed independently

### Channel adapters

- **`sendSmsViaTwilio(therapist, toPhone, message)`**, Twilio REST API, E.164 normalization, returns structured ok/error
- **Resend**, used by `send-booking-confirmation`, `send-welcome`, `send-post-session`, `send-reminders` (email body), `send-drip`
- **Bell drawer (`in_app_notifications` table)**, Postgres table, no external service
- **Push (`send-push` edge function)**, VAPID push, separate from the bell drawer, fires to PWA-installed devices

### Therapist bell drawer (in-app channel)

- **`NotificationsBell.jsx`** mounted in Dashboard header (top-right, next to plan badge)
- Polls unread count every 60 seconds while drawer is closed
- On open, fetches last 20
- Tap-to-mark-read; mark-all-read link
- Empty state, loading state, link-following on row tap
- Rose/cream palette, Facebook-style interaction model already
- **Improvements queued for B-phase:** realtime subscription instead of 60s polling, badge pulse animation on count increment

### Audit log

- **`notification_log`** table records every send attempt with: event_type, channel, recipient, status (sent/failed/skipped), error_message, timestamps
- Lets us debug "Maria didn't get her reminder" by querying recipient

---

## ✅ What IS firing today (specific touchpoints)

### Booking confirmation (client + therapist)

- **`send-booking-confirmation` edge function**
- Fires via:
  - DB trigger `booking_confirmation_trigger.sql` on `bookings INSERT/UPDATE` to confirmed status
  - Direct invoke from `BookingPage.js` after successful booking (belt-and-suspenders)
- Client gets email (Resend). SMS NOT yet wired here.
- Therapist gets bell + email + SMS (via `notifyTherapist`)

### Welcome email (new client signed up)

- **`send-welcome` edge function**
- Fires on new therapist signup. New client? Less clear; this needs verification with the test accounts.

### 24-48h pre-session reminders

- **`send-reminders` edge function**
- Runs on cron (assumed; need to verify the cron is scheduled in Supabase)
- Looks for bookings 24-48h out with `reminder_sent_at IS NULL`
- Sends client SMS via `sendSmsViaTwilio`. Email NOT yet wired here.
- Marks `reminder_sent_at` to prevent re-firing

### Post-session thank-you (+24h after session)

- **`send-post-session` edge function**
- Runs on cron (assumed; verify)
- Sends client SMS

### Drip campaigns (lapsed clients, new client nurture)

- **`send-drip` edge function**
- Existed per memory; need to confirm what triggers exist today

### Booking events (cancel, reschedule, no-show)

- **`notify-booking-event` edge function**
- Generic event handler. Fans out to therapist via `notifyTherapist`.
- Client-side notification on these events is the GAP (see below).

### Agreement signed (waiver)

- **`notify-agreement-signed`** fires when a client signs the practice agreement
- Therapist gets notification

### Payment received, card on file capture

- **`capture-saved-card`** and **`charge-cancellation-fee`** both invoke `notifyTherapist`

---

## ⚠️ What might be wired but unclear (needs test verification)

The audit can't tell from code alone whether these fire reliably:

1. **Cron schedules in Supabase Dashboard.** `send-reminders` and `send-post-session` are written for cron. Are they actually scheduled? HK needs to check Supabase Dashboard > Database > Cron Jobs.
2. **Twilio credentials per therapist.** `sendSmsViaTwilio` requires `therapist.twilio_account_sid + twilio_auth_token + twilio_phone_number`. Does the test therapist `mybodymapdemo@gmail` have these set? If not, every SMS will return `skipped: 'twilio_not_configured'`.
3. **Notification prefs defaults.** Does the test therapist have all three channels enabled in `notification_prefs` for the events we want to test? If a default is false, the channel is skipped silently.
4. **Client phone number on file.** SMS to client requires `bookings.client_phone` or similar. Verify it's captured during the booking flow.

---

## ❌ What is NOT yet wired (the gaps)

### Gap 1: No `notifyClient` fan-out helper

- Therapist-side has `notifyTherapist` as a clean one-call fan-out.
- Client-side has nothing equivalent. Each function that wants to message a client does it ad-hoc (Resend directly, or `sendSmsViaTwilio` directly).
- **Impact:** no consistent suppression rules for clients (quiet hours, unsubscribes), no client-side audit log easily queryable per client, no easy way to add a new client touchpoint without copy-pasting boilerplate.

### Gap 2: SMS-first defaults missing on key touchpoints

Per the Journey playbook revision, these should be SMS-first:

- **Booking confirmation to client.** Today: email only. Should be: SMS first (one-line confirmation), email backup with calendar invite.
- **Intake reminder.** Today: email only. Should be: SMS first ("Quick 90 sec intake link"), email next morning if not filled.
- **48-hour pre-session reminder.** Today: SMS only via `send-reminders`. Should be: SMS + email (calendar invite in email). Email backup is missing.
- **Streamlined confirmations (sessions 2+).** Today: email only via `send-booking-confirmation`. Should be: SMS only after session 10, SMS + email earlier.

### Gap 3: Client-side off-ramps from Money playbook

These exist as therapist notifications but not as client notifications:

- **Client cancellation confirmation** (email + SMS with refund breakdown, policy attached), partial; the cancellation function may send something but the warmth/policy-attachment isn't verified.
- **Polite no-show notice with payment request**, biggest single missing piece. The Money playbook's highest-impact retention touchpoint. Today: NOT wired.
- **Therapist-cancel apology to client**, the choice-screen pattern in the Money playbook says therapist taps once and a warm apology + rebook link goes out. Today: NOT wired.

### Gap 4: Lapse signal client side

- Therapist gets a bell ping when a regular goes quiet (per memory).
- The client "Your Tuesday is open" SMS win-back from the Journey playbook is NOT yet wired. This is the touchpoint HK specifically flagged as SMS-only.

### Gap 5: Daily Evening Digest (therapist)

- One daily email summarizing the day. Per memory.
- Edge function may not exist; verify and fill if needed.

---

## Highest-impact gap to fill tonight (Phase B target)

**Polite no-show notice with payment request to client (Journey off-ramp).**

Why this one:

1. **Biggest revenue swing.** Per the Journey playbook math, this single notification swings the no-show rebook rate from ~8% (silence) to ~51% (polite payment request). 6.4X.
2. **Solves the awkward-text problem.** This is the message therapists explicitly avoid sending themselves. The platform sending it on their behalf is the moat.
3. **Therapist already has the choice screen** (per Money playbook). The notification is the missing tail of an existing flow.
4. **Tonight's two test accounts can validate end-to-end:** book a session as client, fast-forward time, mark no-show as therapist, watch the SMS + email land on the client phone.

What we need to wire:

1. A `send-no-show-notice` edge function (or extend `notify-booking-event` with a 'no_show' branch that fans out to BOTH therapist AND client)
2. SMS template: "We missed you on Tuesday. Per the no-show policy, $90 was charged to your card ending 4242. Hope everything is okay. Tap here to rebook: [link]"
3. Email template: longer warm version with policy attached
4. When no card on file: payment request with multiple-method links (save-a-card vs Venmo/Zelle/CashApp)
5. The therapist's `Mark as No-Show` button in `ScheduleDashboard` already exists; we connect it to call the new edge function
6. Test with both test accounts; verify SMS lands on bodymap01@gmail's phone, bell ping on mybodymapdemo@gmail

---

## Verification against the Notifications Architecture playbook

The playbook described:

- **Events table:** we have it (event_type field on each notification function call). Could be more formal but works.
- **Templates table:** NOT YET. Templates are still hardcoded strings in each edge function. This is the biggest architectural gap. Until this exists, content changes require code changes.
- **Renderer:** NOT YET as a shared library. Each function does its own string interpolation.
- **Channel adapters:** ✓ done (sendSmsViaTwilio, Resend, in_app_notifications).
- **Events log:** ✓ done (notification_log).
- **Suppression rules:** PARTIAL. Per-channel pref check exists. Quiet hours, rate limits, hard-bounce blocks NOT yet.

The right next architectural improvement (when we're not at 5am) is the **templates table** and shared **renderer**. That converts adding a notification from "copy the boilerplate edge function" to "INSERT INTO templates."

But not tonight.

---

## Tonight's order

1. **(15 min) Verify test accounts**, confirm both signed up, both have phone numbers, therapist has Twilio creds, therapist has notification_prefs enabled.
2. **(45 min) Trigger every existing touchpoint** with the test accounts and document what actually fires. Mark each above as ✓ verified or ⚠ broken.
3. **(15 min) Update this audit** with verified state.
4. **(60-90 min) Wire the polite no-show notice** (Phase B target above) and test end-to-end.
5. **(15 min) Check what we built against the playbook architecture** and write the post-mortem.

Total: ~2.5 hours, finishing with one real touchpoint live + verified audit map.
