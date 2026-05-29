# Calendar UX Spec

**Status:** authoritative. Every date picker in the platform follows this spec.
**Owner:** `src/components/MonthCalendar.jsx`. Do not fork.

---

## Why this doc exists

There is exactly ONE date-picker component on the platform: `MonthCalendar.jsx`. Every place a therapist or client picks a date uses it. This doc codifies what each visual state means, what tapping does, and how the same component serves different audiences (clients vs therapist) without behavior drift.

A new feature that needs a date picker imports `MonthCalendar`. It does NOT build its own grid. If `MonthCalendar` is missing a capability the new feature needs, the right move is to add the capability to `MonthCalendar` behind a prop, not fork the component.

---

## The 9 visual states a day cell can be in

Every cell is in exactly one state at any moment. Combinations like "selected + today" use the SELECTED visual; selection always wins.

| State | When | Visual | Tap behavior |
|-------|------|--------|--------------|
| **Past** | `cellDate < today` | Faded 55% opacity, default text | Disabled, no tap. Cursor `not-allowed`. |
| **Off-day (recurring)** | `day_of_week` not in therapist's availability | Cream-beige fill, struck-through number (when toggle off), gray text. Cream-beige fill, normal number (when toggle on). | Client audience: disabled, no tap. Therapist audience: toggle OFF means disabled; toggle ON means tappable like a normal day. See "Override-off-day pattern" below. |
| **Full-day block** | iso in `blockedDates` set (no start_time) | Amber striped background | Disabled. Block off-times are PTO/closed; never selectable here. To override, therapist must un-block in Schedule first. |
| **Beyond horizon** | `> maxDate` (e.g. booking horizon) | Faded, default | Disabled. "Bookings open within X days" helper. |
| **Before minimum** | `< minDate` (e.g. lead time) | Faded, default | Disabled. "Bookings need X hours lead" helper. |
| **Available, free** | none of the above | White, default text | Tappable. Selects. |
| **Available, has bookings** | iso has 1+ bookings in `bookingsByDate` | White with up to 3 sage dots at bottom (chip if >3) | Tappable. Selects. Dots are context only; the time picker handles conflicts. |
| **Today** | `cellDate === today` and no other state takes precedence | Sage ring around cell | Tappable. Selects. |
| **Selected** | iso in `selected` (or === selected, single mode) | Forest fill, white number, optional series-index badge top-right | Single mode: tap replaces. Multi mode: tap toggles off. |

**The rule of mutual exclusion:** past beats everything (you can't book the past). Off-day beats today. Full-day block beats has-bookings (a closed day overrides whatever bookings might have been imported there). Selected always wins visually.

---

## Audience differences

Same component, two different prop sets:

### Client audience (public BookingPage)

```jsx
<MonthCalendar
  selected={dateString}
  onSelect={iso => setDate(iso)}
  availability={therapist.availability}
  service={selectedService}
  blockedDates={blockedSet}
  maxDate={horizonDate}
  minDate={leadTimeDate}
  // allowOverrideOffDay defaults to FALSE
/>
```

Clients can NEVER pick an off-day. The strike-through is informational, the cell is disabled, no override exists. If a client somehow needs an off-day session, they contact the therapist directly.

### Therapist audience (BookingModal, BulkSessionScheduler)

```jsx
<MonthCalendar
  selected={mode === 'multi' ? seriesDates : date}
  onSelect={iso => handleTap(iso)}
  availability={therapist.availability}
  blockedDates={blockedSet}
  partialBlockedDates={partialSet}
  bookingsByDate={bookingsByDateMap}
  mode={seriesMode ? 'multi' : 'single'}
  seriesIndexFor={iso => seriesPositionFor(iso)}
  allowOverrideOffDay={true}
  // no maxDate / minDate by default; therapist can book any future date
/>
```

Therapists CAN override an off-day. The cell is still struck-through (visual cue: "this is not normal"), but tapping shows a confirmation banner before committing. This handles the real cases of holiday sessions, irregular Sundays, and exceptions for established regulars.

---

## Multi-select mode (for series bookings)

When `mode='multi'`:
- `selected` is an array of ISO strings, not a single string
- Tapping an unselected cell adds to the array
- Tapping a selected cell removes from the array
- `seriesIndexFor(iso)` returns the position (1-based) for the badge

Selection ordering is by date, not tap order. The series picker (BookingModal series mode) maintains a rule-driven array; manual taps add/drop from that array.

---

## Navigation

- **Horizontal chevron** at top of calendar (Outlook / Google / airline pattern)
- One month visible at a time
- Left chevron decrements month (wraps year)
- Right chevron increments month (wraps year)
- Optional "Today" button below the grid (default off, opt-in for surfaces where the user might navigate far)

NO vertical-scroll month stack. NO infinite scroll. NO swipe gestures (touch swipe interferes with cell tap on small screens).

---

## Override-off-day pattern (visible toggle)

When `allowOverrideOffDay=true` and the surface is therapist-facing, a toggle pill renders at the top of the calendar:

> **Include my off days**
> Off days are disabled. Flip this on to book one anyway.

States:

- **Toggle OFF (default):** off-day cells render cream-beige + struck-through number + disabled cursor. Taps do nothing. Therapist sees the toggle and the constraint at the same time.
- **Toggle ON:** off-day cells keep the cream-beige fill (subtle "this is outside your normal hours" reminder) but the number reads cleanly without strikethrough, and the cell is tappable like any normal day.

Why a toggle instead of a per-tap confirm:

- Discoverability: for a 70yo solo LMT, the option to override should be VISIBLE before she tries to tap something. A struck-through cell that secretly accepts taps and asks a confirmation is hidden behavior. The toggle declares the affordance upfront.
- Bulk-friendly: in series mode the therapist may pick multiple off-day Sundays. With a per-tap confirm she would tap N times and confirm N times. With the toggle she flips once and proceeds.
- Reversible: she can flip the toggle off mid-flow and the calendar returns to safe defaults without resetting her selection.

The toggle is local to the calendar instance (resets when the modal closes). It is NOT persisted as a therapist preference. Booking on off-days should remain an opt-in per session, not a stance.

---

## Where MonthCalendar is used in the platform

| Surface | File | Mode | Override allowed |
|---------|------|------|------------------|
| Public BookingPage (client date pick) | `src/pages/BookingPage.js` | single | no |
| Bulk session scheduler (therapist schedules N package sessions) | `src/components/BulkSessionScheduler.jsx` | single (per row) | yes |
| Therapist BookingModal (Create / Reschedule / Book a series) | `src/components/BookingModal.js` | single OR multi | yes |
| Future reschedule date picker | (when built) | single | yes |
| Future block-time date picker | (when built) | single | yes |

If a new picker lives elsewhere, add the row above when you ship it.

---

## What is NOT a MonthCalendar surface

These look like calendars but solve different problems:

- **Schedule MonthlyView** (`src/components/ScheduleDashboard.js`): therapist's read-only view of her actual month, not a picker. Has its own visual language because it's the view, not the input.
- **Schedule YearlyPlanner** (`src/components/YearlyPlanner.jsx`): year-overview at a glance for long-range planning.
- **TimelineView** (in ScheduleDashboard): day view with time slots.
- **BulkSessionScheduler's "Show X dates" multi-row layout**, uses MonthCalendar inside each row, but the row layout itself is its own thing.

If a future surface needs a different model (e.g. week view, agenda view), build it separately. Don't bend MonthCalendar to fit.

---

## Changelog

- **May 27 2026**, `MonthCalendar` extracted from BookingPage's inline `Cal` function. Adopted by BulkSessionScheduler.
- **May 29 2026**, `SelectableMonthView` built for BookingModal (mistake; should have used MonthCalendar). Consolidated back to MonthCalendar same day. SelectableMonthView removed.
- **May 29 2026**, This spec doc created. MonthCalendar enhanced with `mode='multi'`, `bookingsByDate`, `partialBlockedDates`, `seriesIndexFor`, `allowOverrideOffDay`. BookingModal refactored to use MonthCalendar with `mode='multi'` for series.
- **May 29 2026 (revision)**, Per-tap "Book anyway?" confirm replaced with a visible "Include my off days" toggle pill at the top of the calendar. Toggle is the discoverable affordance our 70yo persona expects. Also fixed scroll-chaining on BookingModal: added `overscroll-behavior: contain` on the modal scroll layers and body-scroll lock while the modal is mounted, so the Schedule page behind no longer scrolls when the modal hits a boundary.

---

## How to extend MonthCalendar

If you need a new behavior:

1. Read this doc fully
2. Propose it as a new prop with sensible default (existing call sites must keep working without changes)
3. Update this doc in the same commit
4. Update the changelog above

Do not fork.
