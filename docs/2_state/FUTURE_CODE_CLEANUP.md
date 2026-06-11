# Future Code Cleanup

Live tracker for deferred refactors and tech debt. These are NOT live bugs. Each item works correctly in production today. They are listed here because the shape of the code makes a future mistake more likely, or makes the code harder to maintain. We fix them on purpose, later, when we are already working in that area, rather than rushing a change that touches working screens for no visible benefit.

Each item is numbered and append-only. When an item is done, it stays here with `Status: DONE` and the commit that closed it, so we keep an honest paper trail.

Status guide:
- **Open** = not started
- **In progress** = being worked
- **DONE** = closed, with commit reference

---

## #1: Three copies of the "is this day blocked" logic

**Status:** Open  
**Logged:** June 3, 2026 (after the Jacquie "Every Sat" booking bug)  
**Related test:** Pending Tests #1 (run it before doing this cleanup)

### What it is
The rule that answers "is this day blocked for this therapist" is written out three separate times, once inside each screen that needs it:
1. The Schedule / availability calendar where blocks are set (`CalendarGrid.jsx`)
2. The public booking page that clients use (`BookingPage.js`)
3. The therapist Book Next Appointment picker (`BookingModal.js`)

There are two kinds of block these copies have to understand: one-off specific dates (the `blocked_days` table) and recurring rules like "Every Saturday" (the `recurring_blocks` table, plus `recurring_block_exceptions`).

### Why it matters
Because the logic is copied rather than shared, adding a new rule type, or adding a new screen, means remembering to update every copy by hand. On June 3, 2026 that is exactly what bit us. When the recurring-block feature first shipped (commit efcb7323), the recurring logic was added to the calendar and the public booking page, but not to the Book Next picker. For weeks that picker offered blocked Saturdays as bookable. Clients were never exposed, because the public booking page was correct, but the therapist's own rebooking screen was wrong. Fixed June 3 in commits d686e6a3 and f694369b.

### The cleanup
Extract one shared helper, for example `isDayBlocked(date, { blockedDays, recurringBlocks, recurringExceptions })`, returning `{ fullDay, partialWindows }`. Point all three screens at it. No behavior change. Delete the three hand-written copies.

### The risk of doing it
This is a refactor that touches all three screens at once, including the two that already work. The copies may carry small differences (for example, how a half-day recurring block is handled). Merging them could flatten a difference we did not notice and change behavior on a screen that is fine today. So it concentrates risk: a mistake in the shared helper now affects all three places instead of one.

### How to do it safely
Run the parity test in Pending Tests #1 first. Capture each screen's blocked-day result on real therapist data, then refactor, then confirm the results are identical before and after. Do it as its own commit so it is easy to verify and easy to roll back.

### Trigger to act
Next time we are already editing booking or availability code, or before we add a third kind of block rule. Not urgent. Nothing is broken today.

---

## #2: Scheduled digests assume all therapists are US Central

**Status:** Open  
**Logged:** June 3, 2026 (when fixing the Practice Pulse send time)

### What it is
The daily Practice Pulse runs from a single pg_cron job at a fixed UTC time, and the practice-pulse function computes "today" and "tomorrow" in `America/Chicago` (Central). That is correct for every therapist on the platform today, because they are all US Central.

### Why it matters
A single cron time cannot be "8pm local" for therapists in different timezones, and computing the digest day in Central means a therapist in another timezone could get a digest for the wrong calendar day near midnight. Harmless now, wrong once we onboard outside Central.

### The cleanup
Add a `timezone` column to `therapists` (default `America/Chicago`), compute each therapist's day in their own timezone inside the function, and decide on send timing: either one cron that emails each therapist only when it is evening in their timezone, or group by timezone.

### Trigger to act
First therapist who is not US Central. Not before.

---
