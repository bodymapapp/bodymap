# Pending Tests

Live tracker for tests we still owe: checks we want to run, or automated tests we want to write, before we fully trust a change. Append-only and numbered. When a test is run or written, it stays here with `Status: DONE`, the date, and the result, so we keep an honest record of what has actually been verified versus what we are still assuming.

Status guide:
- **Pending** = not yet run or written
- **In progress** = being run or written
- **DONE** = run or written, with date and result

---

## #1: Blocked-day parity test (before and after the blocked-day cleanup)

**Status:** Pending  
**Logged:** June 3, 2026  
**Blocks:** Future Code Cleanup #1 (consolidating the three copies of the blocked-day logic)

### Why
Before we merge the three hand-written copies of the "is this day blocked" logic into one shared helper, we need proof that the new shared version behaves identically to each old copy. Otherwise the refactor could silently change behavior on a screen that works today.

### What to test
Use real therapist data. Pick an account that has both a one-off date block and a recurring rule (for example Back2Life, which has the "Every Sat" rule), plus an account that has a partial / half-day block.

1. For each of the next 366 days, capture what each of the three screens currently treats as blocked:
   - the Schedule / availability calendar (`CalendarGrid.jsx`)
   - the public booking page (`BookingPage.js`)
   - the Book Next picker (`BookingModal.js`)
   Record both full-day blocked dates and any partial blocked windows.
2. Do the refactor (point all three screens at the shared helper).
3. Re-capture the same 366-day result from all three screens.
4. The before and after sets must match exactly.

Pay special attention to: recurring start and end dates, recurring exceptions, half-day windows, and time-zone edges (dates are local, not UTC).

### Pass condition
Identical full-day date sets and identical partial windows for all three screens, before versus after. Any difference is a behavior change and must be explained and signed off before shipping.

---
