# Notification verification queries

HK May 29 2026: when HK finishes a test pass, Claude runs the queries below
via the Supabase MCP and reports findings. **Do not ask HK for a CSV.**

## 1. What fired in the last 4 hours for Joy Demo

```sql
select
  sent_at,
  audience,
  channel,
  notification_type,
  status,
  recipient,
  subject,
  case when error_message is null then null
       else left(error_message, 200) end as error_excerpt,
  booking_id
from notification_log
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sent_at > now() - interval '4 hours'
order by sent_at desc
limit 100;
```

## 2. Same, but grouped by booking so we see per-test outcomes

```sql
select
  b.id as booking_id,
  b.status as booking_status,
  b.client_name,
  b.booking_date::text || ' ' || b.start_time::text as when_local,
  b.notes,
  count(n.id) filter (where n.audience='therapist' and n.channel='email') as therapist_emails,
  count(n.id) filter (where n.audience='client'   and n.channel='email') as client_emails,
  count(n.id) filter (where n.status='failed') as failed_count,
  string_agg(distinct n.notification_type, ', ' order by n.notification_type) as types,
  string_agg(distinct n.error_message, ' | ' order by n.error_message) filter (where n.error_message is not null) as errors
from bookings b
left join notification_log n on n.booking_id = b.id
where b.therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and (b.notes like 'Joy Test %' or b.notes like '%C0%' or b.notes like '%C1%' or b.notes like '%C7%' or b.notes like '%C8%' or b.notes like '%C9%' or b.notes like '%C10%' or b.notes like '%C11%' or b.notes like '%C12%' or b.notes like '%C13%' or b.notes like '%C16%')
group by b.id, b.status, b.client_name, b.booking_date, b.start_time, b.notes
order by b.notes;
```

## 3. Double-fire detector (same booking, same type, same audience, >1 row in 60s)

```sql
select
  booking_id,
  notification_type,
  audience,
  count(*) as fire_count,
  min(sent_at) as first_fire,
  max(sent_at) as last_fire,
  extract(epoch from (max(sent_at) - min(sent_at))) as seconds_between
from notification_log
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sent_at > now() - interval '4 hours'
group by booking_id, notification_type, audience
having count(*) > 1
order by fire_count desc, last_fire desc;
```

## 4. Booking-state sanity (do statuses match what we expect?)

```sql
select
  notes,
  status,
  cancellation_charge_status,
  cancellation_charge_amount,
  cancellation_charge_fired_at::text,
  previous_booking_date::text,
  previous_start_time::text,
  rescheduled_at::text
from bookings
where therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and notes like 'Joy Test %'
order by notes;
```

## 5. Refund and payment receipt audit

```sql
select
  sp.id,
  sp.created_at,
  sp.amount_cents,
  sp.tip_cents,
  sp.refunded_cents,
  sp.refunded_at::text,
  sp.payment_method,
  sp.payment_method_detail,
  sp.status,
  b.notes as booking_notes,
  b.status as booking_status
from session_payments sp
left join bookings b on b.id = sp.booking_id
where sp.therapist_id = '2a2886c3-00f2-4c6f-aaec-4b8150c61fcf'
  and sp.created_at > now() - interval '4 hours'
order by sp.created_at desc;
```

## Reading the output

- **Pass:** booking has exactly the expected notifications (1 therapist email + 1 client email for cancel; 1 therapist + 1 client receipt for refund; 1 therapist + 1 client for reschedule).
- **Double-fire:** Query 3 returns rows. Fail.
- **Failed status:** any row in Query 1 with `status='failed'`, report the error_excerpt.
- **Missing trace:** Query 4 shows the trace columns. Reschedule must have `previous_booking_date` set; cancellation with fee must have `cancellation_charge_status='succeeded'` and amount.

---

# Calendar surfaces to verify (HK May 29 2026)

Every date picker and calendar view on the platform. Walk through each surface and confirm the listed expectations. Authoritative UX spec for date pickers: `docs/CALENDAR_UX_SPEC.md`.

## Therapist-facing pickers (Schedule)

### 1. Create Booking modal (single date)

**Path:** Schedule, top-right, Book appointment, Create booking.

Verify:
- Month grid renders, single month visible with `‹ Month Year ›` chevron nav at top
- Sunday cells (or whichever day-of-week the therapist is off) render cream-beige with strikethrough on the number; tapping does nothing while toggle is OFF
- "Include my off days" toggle pill visible above the month grid; flipping it ON removes the strikethrough and makes off-days tappable
- Existing bookings show as sage dots (up to 3, then "+N") on cells with bookings
- Full-day blocked dates render amber-striped, disabled
- Today's cell has a sage ring (when not selected)
- Tapping a date sets it; tapping another date replaces the selection
- Scrolling inside the modal does NOT scroll the Schedule page behind it (overscroll-behavior fix)
- Closing the modal restores normal page scroll on the Schedule page

### 2. Create Booking modal, Book a series mode

**Path:** Same modal, tap "Book a series" button.

Verify:
- "Repeat every N week(s)" stepper and "How many sessions" stepper appear
- Calendar enters multi-select mode; auto-seeded dates show forest fill with a small white series-index badge (1, 2, 3, ...) top-right
- Manually tapping a non-selected available date adds it to the series (badge appears)
- Manually tapping a selected date removes it from the series
- The "Include my off days" toggle works the same way in series mode

### 3. Reschedule from booking detail

**Path:** Schedule, tap an existing booking, Reschedule.

Verify:
- Same modal opens in single-date mode pre-filled with the current date
- Past dates are disabled
- Selecting a new date and confirming updates `booking_date` AND populates `previous_booking_date`, `previous_start_time`, `rescheduled_at` on the booking row

### 4. Manage your calendar and time off (CalendarGrid)

**Path:** Schedule, "Manage your calendar and time off" hero card.

Verify:
- Green cells (US holidays) tapping NOW opens the inline detail panel with the holiday name + a "Block this day" button (May 29 2026 fix; previously the green cell silently blocked without naming the holiday)
- Orange/gold cells (growth opportunities) tap shows the growth-moment card in the same detail panel
- Recurring-rule-blocked days tap shows "Blocked by recurring rule" with an unblock-just-this-day button
- One-off taps on regular cells toggle the block/unblock without opening a panel
- Drag selection across cells (click + drag) bulk-toggles blocks
- "Block US holidays" button opens checklist modal

### 5. Bulk Session Scheduler

**Path:** Add a package purchase that schedules all N sessions on one page (or from a package row's Schedule action).

Verify:
- N mini date-picker rows render, each with its own MonthCalendar
- Cap at 6 visible rows; 7+ packages still create bookings but show a different "use bulk" pattern
- Same off-day, blocked, today behavior as Create Booking modal
- Each row's picker is independent (selecting a date in row 2 does not affect row 1)

## Client-facing picker (Public BookingPage)

### 6. Public client booking page

**Path:** open the therapist's custom URL (e.g. `/healinghands`) in incognito or as a logged-out user.

Verify:
- MonthCalendar renders, single month with chevron nav
- Off-days (day-of-week the therapist does not work) struck through + disabled
- "Include my off days" toggle is NOT visible (clients can never pick off-days; the toggle is therapist-only via `allowOverrideOffDay`)
- Past dates, full-day blocks, partial blocks honor the same disabled rules
- If the service has per-service availability, "Service is offered on X only" helper text shows below the grid
- Picking a date loads time slots filtered by the service duration + the therapist's working hours + any partial blocks

## Read-only calendar views

### 7. Schedule MonthlyView (read-only calendar)

**Path:** Schedule, top-right view toggle, Month view.

Verify:
- All days for the month render
- Days with bookings show booking chips
- Tapping a day filters the list below to that day's bookings
- This is NOT a picker; tap behavior just navigates

### 8. YearlyPlanner

**Path:** Schedule, Year view.

Verify:
- 12 mini-months render
- Booking density renders as color intensity per day
- Tap any month to jump into that month's MonthlyView

### 9. TimelineView (day view)

**Path:** Schedule, Day view (default).

Verify:
- Vertical time axis from morning to evening
- Existing bookings render as blocks at their start time, sized to duration
- Tapping an empty slot opens Create Booking pre-filled to that date+time

## Email + calendar attachment verification

Several therapist + client emails (booking confirmations, reschedules) include a calendar `.ics` attachment. As part of email verification tonight, also confirm:

- Booking confirmation email (therapist + client both) includes a working `.ics` attachment that opens in Apple Calendar / Google Calendar / Outlook
- Reschedule email's `.ics` reflects the NEW date+time, not the old
- Cancellation email does NOT carry an `.ics` (or carries a CANCEL action if we ever wire that)

## Pass criteria

The full calendar pass is green when:
1. Every surface above behaves as listed
2. No surface produces a console error (open browser devtools, watch for red)
3. The "Include my off days" toggle works in both single and multi (series) modes
4. Holiday green cells now name the holiday before any block action commits
