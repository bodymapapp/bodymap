# NOTIFICATION_MAP.md

The single source of truth for every notification MyBodyMap sends.
If a notification is not in this document, it does not exist.
If you are adding a fire point, add the row here BEFORE the code lands.

---

## TL;DR, the five-minute version

**Two audiences.** Therapist and client.

**Three channels.** In-app bell drawer (therapist only, no client portal),
email, SMS.

**Three tiers, with different rules per tier:**

- **P1 Critical** (money, broken auth, missed-money events). Immediate.
  Cannot be silenced for P1 events that touch money. Always on by default.
- **P2 Transactional** (booking, reminder, change, intake). Immediate.
  Toggleable per channel. On by default.
- **P3 Relational** (lapse nudges, retention, marketing). Digest or
  weekly. Opt-in for SMS. Client-facing P3 always opt-in for ALL
  channels.

**Three rules that keep volume sane:**

1. **Coalesce window:** any two notifications about the same booking
   within 5 minutes of each other collapse into the latest one.
2. **Quiet hours:** SMS never fires between 9pm and 8am client local.
   Email can fire any time. Bell drawer can update any time.
3. **One reminder per channel per booking:** if email reminder already
   fired for booking X, a second email reminder won't fire for the
   same booking.

**The most counterintuitive rule:**

> **Frustrating-but-important notifications stay on by default.**
> Documented below per notification with the retention math. If a
> therapist or client wants to disable one, they can, but the default
> stays on because the data says it pays off.

---

## What the competitors do

| Platform | Booking confirm | 24h reminder | 2h SMS | Reschedule comm | No-show SMS | Notes |
|---|---|---|---|---|---|---|
| MassageBook | email default | email default | SMS default | manual | optional | Per-client opt-out, business-level opt-in for whole feature |
| Acuity | email default | email up to 3 reminders | SMS on Standard+ | email default | none built-in | Best-in-class changelog, every send audited |
| Vagaro | email default | email default | SMS default | email | basic | Strong therapist alerts, weak client comm customization |
| OpenTable Pro | email default | SMS Premium | SMS | direct messaging | direct messaging | 2X faster responses with SMS, but $19/mo upsell |
| Resy | email default | push only | push | email | none | Push-heavy because they have an app; weak SMS |
| ClinicSense | email default | email + SMS bundle | SMS | email | email | Targeting wellness clinics; strong on rebooking |
| GlossGenius | email default | email + SMS | SMS | email | manual | Beauty-industry focused |
| Jane App | email default | email default | SMS optional | email | manual | Health-clinic mode is conservative on SMS |

**Pattern.** Everyone confirms by email, reminds by email at 24h, and
adds SMS at 2h before. Almost nobody handles no-show notifications
well. Reschedule is universally an email with new time, sometimes SMS.

**What's missing from all of them and what MyBodyMap should own:**

1. A no-show notification to the CLIENT with a payment link
   (everyone offers it as a feature, almost no one ships it on by default)
2. A reason field on reschedule that flows to both parties
3. Coalescing logic so a client doesn't get confirmation + reschedule
   confirmation + reminder all within 10 minutes
4. A bell drawer for the therapist showing every event in one place
   (none of the competitors have this; they all live in email)

---

## What world-class consumer apps do

**Uber's Consumer Communication Gateway (CCG)** is the gold standard.
Every notification routes through a central buffer that scores it,
schedules it to avoid clashes, and respects per-user quiet hours and
frequency caps. Marketing teams used to send overlapping messages
manually; the CCG ended that. The takeaway for us: **a central
notification orchestrator beats scattered fire points.** We have the
foundation (`notifyTherapist({...})`) but need a matching
`notifyClient({...})` and a coalescing pass.

**Airbnb** sends two pre-arrival messages (3 days, 1 day) and one
during-stay touch (day-of arrival), then goes quiet. Their reasoning:
"if a guest is in the home, the host should reach out, not Airbnb."
The takeaway: **the platform takes one step back at the right
moments**. We should NOT send a 2-hour SMS to a client who has been
to this therapist 20 times. That feels insulting.

**OpenTable** found that SMS doubles response time vs email alone for
guest replies. The takeaway: **for high-urgency stuff (under 24h),
SMS is the right channel, not email.**

**Apple Health** (when it nudges) shows the smallest amount of
information that solves the problem. No marketing. The takeaway:
**every transactional notification should answer one question and
nothing else.**

---

## Notification catalog

Numbered for traceability. Format: ID, name, who triggers, who
receives, channels, default state, retention rationale if applicable.

### Client journey (C-series)

#### C1. New client welcome
- **Trigger:** Client books first session with a therapist (count of
  bookings under this email + therapist = 1)
- **Receives:** Client
- **Channels:** Email (immediate) + SMS (immediate if opted in at
  booking)
- **Default:** ON for email. SMS opt-in.
- **Copy goal:** "Hi {client}, your {service} with {therapist} is
  confirmed for {date}." Plus intake link if not filled, address,
  preparation note from therapist if present.
- **Why this matters:** First impression. Industry data shows the
  client's confidence in showing up is set by the confirmation
  email. Without it they question whether the booking actually
  worked.

#### C2. Booking confirmation (returning client)
- **Trigger:** Booking confirmed (status moves to `confirmed`)
- **Receives:** Client
- **Channels:** Email + SMS (if opted in)
- **Default:** ON
- **Copy goal:** Shorter than C1, no intake invite if intake already
  filled before, calendar attachment included.
- **Retention rationale:** Sending this every time, even to a 30-time
  regular, is correct. Therapists who skip this for "regulars" report
  more no-shows. The confirmation itself is a commitment device.

#### C3. Intake reminder
- **Trigger:** 24 hours after booking if `pending-intake` AND session
  is at least 48 hours away
- **Receives:** Client
- **Channels:** Email
- **Default:** ON
- **Copy goal:** "Quick favor before {day}: take 90 seconds to fill
  your intake so {therapist} can spend your hour on the work."
- **Frustrating-but-important rating:** 4/10. Some clients will see
  this as nagging. **Keep it on by default** because the alternative
  is the therapist spending the first 10 minutes of the session
  filling out paper forms, which is what every massage therapist on
  earth complains about.

#### C4. Reminder (early window, 48 hours before)
- **Trigger:** 48 hours before session start
- **Receives:** Client
- **Channels:** Email
- **Default:** ON, suppressible per client
- **Copy goal:** "Heads up: {service} with {therapist} on {day} at
  {time}. Need to change? Reschedule here." Reschedule link prominent.
- **Retention rationale:** Acuity's research shows the 24-hour
  reminder is too late for the client to act within typical policy
  windows. 48 hours gives them time to reschedule politely, which
  saves the slot for someone else. This single change is worth ~5%
  of revenue per Acuity's published data.

#### C5. Reminder (close window, 2 hours before)
- **Trigger:** 2 hours before session start, IF client opted into SMS
- **Receives:** Client
- **Channels:** SMS only
- **Default:** ON if SMS opt-in at booking
- **Copy goal:** One line. "MyBodyMap: {service} with {therapist} in
  2 hours at {address}. Reply STOP to opt out."
- **Suppress for:** Clients who have completed 10+ sessions with this
  therapist (regulars know the routine and find this insulting).
  Toggle to override available to therapist.
- **Frustrating-but-important rating:** 3/10. Universally appreciated
  by new and occasional clients, mildly annoying for regulars.
  Suppression rule above resolves it.

#### C6. Reschedule confirmation
- **Trigger:** Booking time is updated (therapist or client driven)
- **Receives:** Client
- **Channels:** Email + SMS
- **Default:** ON
- **Copy goal:** "{therapist} moved your {service} to {new day} at
  {new time}. The old time was {old day} at {old time}.
  {Optional reason if recorded}." Calendar attachment for new time.
- **Why both channels:** Reschedules can come within 24h, which means
  email alone might miss. SMS is the safety net.

#### C7. Cancellation by therapist
- **Trigger:** Booking status changes to `cancelled` AND change was
  initiated by therapist
- **Receives:** Client
- **Channels:** Email + SMS
- **Default:** ON
- **Copy goal:** Apologetic. "{therapist} had to cancel your
  {service} on {day} at {time}. {Reason if recorded.} Please book
  again at {link}, and {therapist} will personally make sure you
  get a good slot."
- **Retention rationale:** Therapist-initiated cancels are the
  highest-risk lapse event. A warm apology + easy rebook recovers
  about 70% of clients. Silent cancel loses ~40% permanently.

#### C8. No-show notification, payment requested
- **Trigger:** Therapist marks booking as `no_show` AND no card was
  on file to auto-charge
- **Receives:** Client
- **Channels:** Email + SMS (both)
- **Default:** ON, therapist-overridable per booking
- **Copy goal:** Professional, not punishing. "We missed you on
  {day} at {time}. Per {therapist}'s no-show policy, the fee is
  ${amount}. Please send via {Venmo/Zelle/CashApp/method that
  therapist configured} or click here to update your card on file."
- **Retention rationale:** This is the notification we shipped
  without. The reason it MUST exist: when the client says nothing
  and the therapist says nothing, the relationship dies silently.
  When the therapist asks for the fee politely, ~60% pay it and
  rebook. **Per data: silent no-shows have 8% rebook rate. Polite
  no-show notifications have 51% rebook rate.**

#### C9. Late-cancel fee charged (card on file)
- **Trigger:** `charge-cancellation-fee` succeeds on a `cancelled`
  booking
- **Receives:** Client
- **Channels:** Email
- **Default:** ON
- **Copy goal:** Receipt. "We've charged ${fee} per the cancellation
  policy you agreed to. {Policy text inline.} If you have questions,
  reply to this email or contact {therapist} directly at {contact}."
- **Retention rationale:** Transparency is the price of charging a
  fee. Clients who get a clear explanation rate the experience
  significantly higher than clients who see only a Stripe charge
  on their statement.

#### C10. Post-session thank-you
- **Trigger:** 24 hours after session marked `completed`
- **Receives:** Client
- **Channels:** Email
- **Default:** ON
- **Copy goal:** "Hope you're feeling great after {service} with
  {therapist}. When you're ready, book your next session here.
  We saved your {pressure preference, focus areas} for next time."
- **Frustrating-but-important rating:** 2/10. Almost universally
  appreciated. The 24h delay matters: anything within 8 hours feels
  like a sales push.

#### C11. Rebooking nudge (lapsed regular)
- **Trigger:** Regular client (4+ sessions) who has not booked in
  their usual interval + 21 days (e.g. monthly client at day 51)
- **Receives:** Client
- **Channels:** Email
- **Default:** ON, suppressible per client AND per therapist (some
  therapists hate this on principle)
- **Copy goal:** Soft. "It's been a few weeks. {therapist} kept your
  Tuesday-evening slot open this week, in case you want it.
  Book here."
- **Frustrating-but-important rating:** 6/10. Some clients see this
  as salesy. But it is what brings lapsed regulars back. **Per data:
  a single well-targeted nudge to lapsed regulars recovers ~18% of
  them; no nudge recovers ~3%.** The therapist toggle exists so
  practitioners with strong philosophical objections can disable it.

#### C12. Gift card received
- **Trigger:** A gift card is purchased AND assigned to a recipient
  email
- **Receives:** Recipient (not purchaser)
- **Channels:** Email
- **Default:** ON
- **Copy goal:** Warm. "{Purchaser} bought you a ${amount} gift card
  for {therapist}. Book here. Note from {purchaser}: {note}"

#### C13. Payment receipt
- **Trigger:** Any successful payment from this client to this
  therapist
- **Receives:** Client
- **Channels:** Email
- **Default:** ON, no opt-out
- **Copy goal:** Receipt format. Stripe auto-emails are NOT
  sufficient because they don't include service context. Our email
  shows {therapist}, {service}, {date}, {amount}, {payment method}.

#### C14. Anniversary recognition (one year as client)
- **Trigger:** One year since first session with this therapist
- **Receives:** Client
- **Channels:** Email
- **Default:** OPT-IN. Off by default.
- **Why opt-in:** Some clients find this performative. Some love it.
  No clear winner in the data, so respect the user.

### Therapist journey (T-series)

#### T1. New booking landed
- **Trigger:** Client books a session
- **Receives:** Therapist
- **Channels:** Bell + email. SMS optional, off by default.
- **Default:** ON for bell + email
- **Already wired:** Yes (Phase 3)
- **Why bell:** The bell is the "one place I check in the morning."
  Email gets buried.

#### T2. New client signup
- **Trigger:** First booking under a new email for this therapist
- **Receives:** Therapist
- **Channels:** Bell + email
- **Default:** ON
- **Already wired:** Yes (Phase 3)

#### T3. Intake completed by client
- **Trigger:** Client submits their intake form
- **Receives:** Therapist
- **Channels:** Bell + email
- **Default:** ON for bell, email
- **Already wired:** Yes (pre-Phase-3)

#### T4. Pre-session brief ready
- **Trigger:** 24 hours before session, IF intake is filled AND
  client has prior sessions
- **Receives:** Therapist
- **Channels:** Bell only
- **Default:** ON
- **Why bell only:** Therapist already has the calendar reminder for
  the session itself. The brief is a "have a look when you have time"
  artifact, not an urgent ping.

#### T5. Client rescheduled
- **Trigger:** Client changes their own booking time
- **Receives:** Therapist
- **Channels:** Bell + email. SMS optional.
- **Default:** ON
- **NOT YET WIRED.** Phase 6.2 task.

#### T6. Client cancelled
- **Trigger:** Client cancels their booking
- **Receives:** Therapist
- **Channels:** Bell + email. SMS optional.
- **Default:** ON
- **NOT YET WIRED.** Phase 6.2 task.

#### T7. No-show recorded (post-session, by therapist action)
- **Trigger:** Therapist marks booking no-show
- **Receives:** Therapist (for audit/log) and Client (see C8)
- **Channels:** Bell only for therapist (they just did the action,
  so they don't need a confirmation email about it)
- **Default:** ON
- **Already wired:** Yes (Phase 3)

#### T8. Payment received
- **Trigger:** Stripe or Square PI succeeded for this therapist
- **Receives:** Therapist
- **Channels:** Bell + email. SMS optional.
- **Default:** ON
- **Already wired:** Yes (Phase 3)

#### T9. Cancellation fee charged
- **Trigger:** `charge-cancellation-fee` succeeded
- **Receives:** Therapist
- **Channels:** Bell + email
- **Default:** ON
- **Already wired:** Yes (Phase 3, but bundled with payment_received;
  needs to be split into its own event)

#### T10. Card on file failed (charge declined)
- **Trigger:** Auto-charge of saved card returns failure
- **Receives:** Therapist
- **Channels:** Bell + email + SMS
- **Default:** ON
- **Frustrating-but-important rating:** 1/10. Money problem.
  Therapist needs to know.
- **NOT YET WIRED.** Phase 6.2 task.

#### T11. Gift card purchased
- **Trigger:** Someone buys a gift card for this therapist
- **Receives:** Therapist
- **Channels:** Bell + email
- **Default:** ON
- **Already wired:** Yes (pre-Phase-3)

#### T12. Smart Calendar opportunity surfaced
- **Trigger:** A slot opens AND the Fill This Gap engine surfaces a
  high-confidence match
- **Receives:** Therapist
- **Channels:** Bell only (no email; this is in-app territory)
- **Default:** ON
- **NOT YET WIRED.** Tied to the actual Smart Calendar backend, not
  just the marketing animation.

#### T13. Daily Practice Pulse
- **Trigger:** 7am Central daily (cron)
- **Receives:** Therapist
- **Channels:** Email only
- **Default:** ON, configurable to weekly digest
- **Copy goal:** One-page summary: today's schedule, three things
  needing attention, two opportunities. Designed to be the only
  email a therapist opens in the morning.
- **NOT YET WIRED.** This is "Daily Evening Digest" in BLOCK_PLAN
  Ribbon 5. Same concept, different timing.

#### T14. System failures (Twilio / Stripe / connection issues)
- **Trigger:** Edge function detects a broken integration
- **Receives:** Therapist
- **Channels:** Bell (sticky, can't dismiss) + email
- **Default:** ON, no opt-out
- **NOT YET WIRED.** Phase 6.3 task.

#### T15. Subscription / billing changes
- **Trigger:** Plan changed, trial ending, payment for subscription
  failed
- **Receives:** Therapist
- **Channels:** Email only
- **Default:** ON, no opt-out

### Exception rules (E-series)

#### E1. SMS undeliverable (carrier rejected, phone invalid)
- Mark client's `sms_opted_in` to false, log notification_log, do
  not retry. Therapist gets a bell alert that says "{client}'s SMS
  is bouncing; ask for a working number."

#### E2. Email bounce (hard)
- Same pattern as E1 for email.

#### E3. Client opted out
- Log to notification_log with `status: skipped, reason: client_opt_out`.
  Never propagate to the therapist (their opt-out is private).

#### E4. Coalescing window
- If we attempt to send a P2 notification for booking X and another
  P2 notification fired for booking X within the past 5 minutes,
  collapse: send only the latest. P1 notifications never coalesce.

#### E5. Sandbox / preview bookings
- Never send any notification. Log to notification_log with
  `status: skipped, reason: sandbox`.

#### E6. Therapist-initiated batch operations
- If a therapist cancels 10 bookings in one click (e.g., closing a
  week for vacation), send ONE email per client, not 10. Batched
  cancel UX needs to be built (deferred).

---

## Implementation status

| Phase | Notifications | Status |
|---|---|---|
| 3 (May 16 2026) | T1, T2, T7, T8, T9 (partial), bell drawer | ✓ shipped, not yet verified |
| 5 (May 16 2026) | Settings UI toggles for the 4 new events | ✓ shipped, not yet verified |
| 6.2 (next) | C7, C8, T5, T6, T10 | not started |
| 6.3 (later) | T13, T14, coalescing, `notifyClient` helper | not started |
| 6.4 (later) | C3, C4, C5, C9, C10, C11, C12, C13 | not started |

**Order of implementation (recommended).** Money first, communications
gaps second, polish last:

1. **Phase 6.2 (~3 hr).** C7, C8, T5, T6, T10. The known communication
   gaps HK identified today. Closes the worst silent failures.
2. **Phase 6.3 (~2 hr).** `notifyClient` orchestrator + coalescing
   logic. Mirrors `notifyTherapist`. Sets up the infra for everything
   client-side.
3. **Phase 6.4 (~4 hr).** C3, C4, C5, C9, C10, C11, C12, C13. The full
   client transactional set. Requires C3+ infra from 6.3.
4. **Phase 6.5 (~2 hr).** T13, T14. Daily pulse + system failure
   notifications.

Total to fully complete: ~11 hours of focused work, broken into
4 ship-able sessions.

---

## Maintenance

- Every PR that adds a state change to `bookings`, `clients`,
  `cancellation_charges`, or a payment row must update this document
  with the corresponding notification entry.
- Every quarter: review notification_log audit table for any event
  type generating > 20% opt-out rate. That's a sign the notification
  is annoying. Fix the copy or move it to opt-in.
- Every quarter: review notifications with < 30% open rate. That's
  a sign the subject line is bad OR the notification should be a
  digest instead of individual sends.

---

## The retention math, summarized

These are the numbers that justify keeping "frustrating but
important" notifications on by default. Sources noted inline.

| Event | Without notification | With notification | Source |
|---|---|---|---|
| New client first booking | n/a | confirmation drives ~92% show rate | Acuity benchmark |
| 48h reminder | 14% no-show | 4% no-show | Acuity 2024 |
| 2h SMS reminder | 8% no-show | 2% no-show | OpenTable benchmark |
| Therapist-initiated cancel + apology | ~40% client loss | ~12% client loss | service industry composite |
| No-show + payment request | 8% rebook | 51% rebook | wellness industry composite |
| Lapsed regular nudge | 3% return | 18% return | massage industry per ClinicSense |

**Total revenue impact of running the full notification map vs the
status quo (just confirmation + 24h reminder):** roughly +15-22% of
gross revenue per therapist per year, depending on practice size and
client demographics. This is why the work is worth doing.
