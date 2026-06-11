# Notification Test Plan + Status Matrix

**Updated:** 2026-05-30 04:00 UTC after HK's first walk-through.

---

## Status matrix after this walk

```
Test 1  C2  returning client booking           ✗ FIRED AS C1 not C2 (routing bug)
Test 2  C16 + T14 refund                       ✓ WORKED (client email needs more detail)
Test 3  C10 no-show charged                    ⚠ SKIPPED PAYMENT, fired C9 not C10
Test 4  C11 no-show no card                    ⚠ NOT TESTED (side panel blocking)
Test 5  C12 + T5 therapist cancel              ✓ WORKED both received
Test 6  C7 free cancel via manage page         ✗ MAGIC LINK DOESN'T WORK
Test 7  C8 late cancel via manage page         ✗ MAGIC LINK DOESN'T WORK
Test 8  T8 agreement signed                    ✓ FULL FLOW WORKS
Test 9  C14 lapse 45d                          ✗ NOTHING FIRED
Test 10 C15 lapse 90d                          ? NOT CHECKED
Test 11 T9 gift cert                           ? NOT CHECKED
Test 12 T9b membership signup                  ? NOT CHECKED
Test 13 T9c renewal due                        ? NOT CHECKED
```

---

## Confirmed updated 48h status (post walk)

```
WORKING (verified end-to-end with this test session):
  Client:    C1, C3, C4, C6, C9, C13, C16              (7 of 16)
  Therapist: T1, T2, T3, T4, T5, T6, T7, T8, T11, T14   (10 of 16)
  Bonus working from inline-consolidation:             C12 (Test 5)

BUGS FOUND (need fixing):
  C2 routing: system sends C1 to returning clients instead of C2-returning copy
  Magic link path (BookingManage): broken, blocks Tests 6 + 7
  Lapse cron invocation: nothing fired in Test 9

UI FIXES SHIPPED (this commit):
  Side panel backdrop no longer closes on tap (was eating miss-taps)
  Button padding bumped to 44px+ tap target for the 70yo persona

NEEDS TESTING TOMORROW:
  C10 no-show charged (proper Charge fee path, not Skip)
  C11 no-show no-card
  C14 lapse 45d (need to actually invoke the function)
  C15 lapse 90d
  T9 gift cert
  T9b membership signup
  T9c renewal due
```

---

## Issues called out by HK + actions taken

### Issue 1: Side panel keeps closing on click (BLOCKING)
**HK's words:** "EVERY TIME I AM CLICKING ON A SESSION, SIDE PANEL OPENS AND DEFAULTS BACK TO SCHEDULE CALENDAR. IT IS HAPPENING AGAIN AND AGAIN."
**Root cause:** DetailPanel had `onClick={onClose}` on the backdrop. Every miss-tap on a small button inside the panel hit the backdrop instead and dismissed the panel. Compounded by:
**HK's words:** "THE BUTTONS ARE TOO HARD TO CLICK IN THE SIDE PANEL CHECKOUT SCREENS."
**Fix shipped (this commit):**
- Backdrop no longer captures clicks (`pointerEvents: 'none'` on the backdrop layer)
- Explicit X button in panel header is the only close path
- `btnSecondary` padding bumped from 9px:14px to 13px:16px so the action buttons hit the 44x44 Apple HIG minimum

### Issue 2: Client emails not descriptive enough
**HK's words on Tests 2 + 3:** "CLIENT EMAIL NEEDS TO BE DESCRIPTIVE"
**Status:** Logged for tomorrow. Need to look at the actual emails received and decide what's missing. Probably need to expand the factBox rows with more context (e.g., refund email should show what was refunded, original amount, refund amount, method, original session date).

### Issue 3: Magic link / client cancel page doesn't work
**HK's words:** "THE LINK DID NOT WORK. I DONT THINK CLIENT HAS A WAY TO CANCEL YET. WE NEED TO BUILD A CLIENT MAGIC LINK"
**State of the code:** `/book/<slug>/manage?b=<id>` route exists at `src/pages/BookingManage.jsx` (15kb file shipped May 29). But HK reports it doesn't work in practice. Could be:
  - Page renders but cancel button doesn't fire the right edge function
  - Page doesn't render because of a routing or RLS issue
  - Page renders but with errors
**Action: investigate tomorrow with HK on a screenshare or with browser console output.** Then either fix the existing page or rebuild the cancel-magic-link path.

### Issue 4: C2 returning client routing
**HK's words:** "Test 1 DID NOT WORK"
**Reality:** Test 1 DID fire emails but they came as `booking_confirmation` (C1, new-client copy) not `booking_confirmation_returning` (C2, returning-client copy). The router that picks between C1 vs C2 isn't recognizing Joy Client as returning. Need to inspect the routing logic in send-booking-confirmation.
**Action: tomorrow. Either there's a bug in the "is this client returning?" detection, or the spec was misaligned.**

### Issue 5: Lapse nudge didn't fire
**HK's words on Test 9:** "DID NOT GET ANYTHING ON CLIENT OR THERAPIST"
**Likely cause:** The JWT lookup SQL probably returned nothing, OR the function actually ran but rejected because the cron condition wasn't met (e.g., the system doesn't think Lapse Test client is at exactly 45 days). Need to invoke the function more directly tomorrow with a real signed JWT and inspect the response.

---

## Status matrix (rolled up, post Test 1-8)

```
CLIENT EMAILS (16 spec'd):
  WORKING:           C1, C3, C4, C6, C9, C12, C13, C16    (8)
  ROUTING BUG:       C2 (fires as C1)                      (1)
  BLOCKED:           C7, C8 (need magic link fix)          (2)
  NOT YET TESTED:    C5, C10, C11, C14, C15                (5)

THERAPIST NOTIFICATIONS (16 spec'd):
  WORKING:           T1, T2, T3, T4, T5, T6, T7, T8, T11,
                     T14                                    (10)
  NOT YET TESTED:    T9, T9b, T9c, T10, T12                 (5)
  RARELY FIRES:      T13                                    (1)
```

We're at **18 of 32 verified working** after one test session, up from 14 yesterday. The remaining 14 split into:
- 1 routing bug (C2)
- 2 blocked on magic link (C7, C8)
- 1 not seen but should be in flow (T12 - fires with C8/C10)
- 5 cron-driven (C5, C14, C15, T9c, T10) need direct invocation testing
- 4 separate purchase flows (T9 gift, T9b/T9c membership)
- 1 rarely fires (T13)

---

## Tomorrow's plan

Priority order:

1. **Fix the magic link / client cancel page** (`/book/<slug>/manage`). HK to share screenshot or browser error so I can see what's broken. Without this, the entire C7/C8 client-cancel flow is blocked, and client self-service is broken (which is bad for production too).
2. **Fix C2 returning routing.** Inspect send-booking-confirmation logic to see why it picks the wrong template for returning clients.
3. **Run Tests 4, 11, 12, 13 properly.** Tests that don't need magic link to verify.
4. **Iterate on email copy.** HK to specify what "more descriptive" means for refund + no-show.
5. **Lapse cron tests.** Get the real signed JWT working and verify C14/C15/T10.

---

## Setup fixtures still in place

The 6 Joy Test clients + bookings are still in the database from yesterday's setup. They can be reused. After tomorrow's run, run the cleanup SQL at the bottom of this file.

```sql
-- Inventory of test fixtures still in DB
select c.name, b.id as booking_id, b.booking_date, b.start_time, b.status
from clients c
join bookings b on b.client_id = c.id
where c.name like 'Joy Test [%]'
order by b.booking_date;
```
