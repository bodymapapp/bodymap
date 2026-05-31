# Risk Register

Live tracker for known risks: things we know are broken or will break at scale, but haven't fixed yet because the cost/benefit isn't there today. Every entry has a trigger (what makes it urgent), an estimated cost to fix, and a status.

Each risk gets a number. Numbers are append-only. Closed risks stay in the register with a `Status: CLOSED` and the commit that fixed them, so we have an honest paper trail.

Priority guide:
- **CRITICAL** = customer-impacting now, fix this week
- **High** = will impact customers soon, fix this month
- **Medium** = will impact customers at scale, fix when scaling
- **Low** = nice to fix, no real impact

---

## #1: `.in()` queries with unbounded ID arrays

**Priority:** Medium  
**Status:** Open. Mitigated for one site (fetchBookings).  
**Discovered:** May 30, 2026: side panel crash for HK's Joy Demo (650 bookings)

### What's broken
Supabase queries that use `.in('column', arrayOfIds)` build the array into the URL as `column=in.(uuid1,uuid2,...)`. The gateway rejects URLs over ~30,000 chars with HTTP 400. The query silently returns rows=0, and our code treats that as "no data exists" rather than "query failed."

At 650 booking IDs, the URL is ~30 KB and 400s reliably. Joy Demo hit this. At target scale (100,000 therapists, 10,000+ sessions each) every successful therapist eventually hits it.

### Where it lives
14 call sites across `src/` use this pattern:
- `outreachQuicksend.js` (6 occurrences with emails, IDs, package IDs)
- `SmartBookingRail.jsx`
- `ScheduleDashboard.js`: additional sites beyond the fixed one
- `PackageSection.jsx`, `ClientPackageBalance.jsx`, `PurchasesPanel.jsx`
- Others

### Fix options
- **Option A (cheap):** Build a `safeIn(query, column, ids)` helper that pages requests larger than 100 IDs. Replace all 15 call sites. ~30 min.
- **Option B (rigorous):** Audit each one. Many can drop the `.in()` filter entirely because RLS already constrains by `therapist_id`. The few that genuinely need it get paged. ~2 hours.

### Decision
Go with Option B when we ramp. Until then, the pattern is on the lookout list during code review.

### Trigger to act
First therapist with >500 of anything (clients, bookings, package purchases). Or a real user reports a feature silently failing.

---

## #2: Notification routing fires wrong template

**Priority:** High (active customer-facing bug)  
**Status:** Open. Two known wrong routes.  
**Discovered:** May 30, 2026: notification compliance testing

### What's broken
The `notify-booking-event` edge function picks the wrong template based on the "outcome" flag in two cases:

**C2: Returning client booking confirmation:**  
Code fires `booking_confirmation` (the new-client copy) instead of `booking_confirmation_returning`. The "is this a returning client?" detection in the routing logic is broken.

**C11: No-show payment request:**  
When therapist taps "Mark no-show" → "Send payment link", the system fires `no_show_notice_no_fee` ("No fee, no fuss. Life happens.") instead of `no_show_payment_request` with the Stripe pay-link. Client receives the warm forgiving copy AND no payment link. They reasonably conclude they owe nothing. Critical because it directly costs the therapist real money.

The therapist email for C11 also doesn't include the amount they're being charged. Same family.

### Fix
Trace the dispatch table in `notify-booking-event/index.ts` and `clientEmailContentFor()`. Audit which fields drive the template selection. Likely a missing read of an `outcome` or `payment_method` flag.

Estimated: 30-60 min for C2, 30-60 min for C11.

### Trigger to act
Already triggered. Customer-facing now. **Fix on next session.**

---

## #3: Client magic link / BookingManage page broken

**Priority:** High (blocks customer self-service)  
**Status:** Open. Symptom reported but not yet reproduced.  
**Discovered:** May 30, 2026: notification compliance testing

### What's broken
The booking-cancellation links (C7 free-cancel, C8 late-cancel) point clients to `/book/<slug>/manage?b=<booking_id>` which loads `BookingManage.jsx`. In practice this page doesn't work: clients can't actually self-cancel their bookings.

### Fix
Need a screenshot from a real client (or HK on a private window) showing what they see. Without reproduction, can't diagnose.

Likely candidates: auth state assumption (page assumes client is logged in but they aren't), broken query reading the `b` param, or RLS blocking the client's view of their own booking.

Estimated: 1-3 hours depending on root cause.

### Trigger to act
Blocks all client-initiated cancellations. Fix next session.

---

## #4: Payment routing config: docs say per-feature, code does Stripe-first

**Priority:** Medium  
**Status:** Open. Doc/code drift.  
**Discovered:** May 30, 2026: Square testing investigation

### What's broken
`docs/BILLING_STRATEGY.md` line 68 describes a `payment_routing` JSON column on `therapists` that lets the platform route per-feature: deposits to Stripe, packages to Square, etc.

`supabase/functions/_shared/payment-provider.ts` line 340 (`getProvider`) ignores that column entirely. The implemented logic is:

```
if (stripe_connected) return StripeProvider;
if (square_connected) return SquareProvider;
throw no_provider_connected;
```

So when a therapist has both connected, Stripe always wins. Square is only used as fallback.

This works for 99% of therapists today (most connect one or the other). It will surprise a therapist who intentionally connects Square as their primary and Stripe as a secondary, or who wants Square for card-on-file (lower fees) and Stripe for memberships (auto-renew).

### Fix
Two ways:
- **Implement per-feature routing.** Read `payment_routing` JSON in `getProvider`, accept a `feature` parameter, route accordingly. ~4 hours plus testing.
- **Or remove the doc claim.** Update BILLING_STRATEGY.md to reflect the actual "Stripe wins" behavior. ~10 min.

Either fix is fine. Implementing the doc is more flexible long-term but not urgent.

### Trigger to act
First therapist who reports "I connected Square but my money went to Stripe."

---

## #5: CheckoutModal doesn't route to Square edge functions

**Priority:** High (silent failure for Square-only therapists)  
**Status:** Open. Architecture work needed.  
**Discovered:** May 30, 2026: Square coverage audit

### What's broken
The CheckoutModal handles saving cards on file and charging saved cards. It ALWAYS calls `save-card` and `charge-card` edge functions (Stripe-only). It does not route to `square-save-card` or `square-charge-card` based on which provider the therapist has.

For Square-only therapists this means:
- Cannot save card on file via dashboard → "No Stripe account connected" error
- Cannot charge saved card via dashboard → same error
- Cancellation fee flow also broken (hardcoded Stripe in `charge-cancellation-fee`)

Membership setup is Stripe-only by design (Square doesn't support recurring well), so that's not a bug: but new memberships also fail for Square-only therapists with a useful "Stripe required" error.

### What works for Square-only today
- Deposits at booking (BookingPage routes correctly)
- Refunds (auto policy routes to original purchase processor)

### Fix
Two architectural options:
- **Add Square branch inside CheckoutModal.** Detect provider on open, route to right edge function, use Square Web Payments SDK for card collection (different lifecycle from Stripe Elements). ~4-6 hours.
- **Make `save-card` and `charge-card` route internally.** They use `getProvider` and delegate. Frontend doesn't need to know. ~3-4 hours but requires Square Web Payments SDK on the frontend anyway since the card tokenization happens client-side.

### Trigger to act
First Square-only therapist tries to save a card and reports the failure.

---

## #6: Auto-session creation on every panel tap

**Priority:** Low  
**Status:** Open. Wasteful but functional.  
**Discovered:** May 30, 2026: side panel investigation

### What's broken
Every time the therapist taps an appointment card to open the side panel, the DetailPanel mount effect inserts a `sessions` row if one doesn't already exist. That triggers Supabase realtime, which triggers `scheduleRefresh`, which triggers another `fetchBookings`. Every tap = one DB write + one realtime event + one refetch.

This works. It's just wasteful. At scale (busy day, many taps) it generates noise in the realtime channel and increases DB writes 10x.

### Fix
Defer session creation to first edit. When the therapist actually starts typing in SOAP fields or selecting body-map zones, THEN create the row. Until then, just read.

Estimated: 1-2 hours.

### Trigger to act
Not urgent. Address during a session-detail refactor or when realtime noise becomes visible.

---

## #7: Silent fallback pattern hides real failures

**Priority:** Medium (pattern, not single fix)  
**Status:** Open. Two known instances fixed today.  
**Discovered:** May 30, 2026: recurring theme across bugs

### What's broken
Multiple places in the codebase use a `|| defaultValue` fallback when an external call could fail. The fallback hides the failure and the code proceeds as if the operation succeeded. Examples found today:

- `square-oauth-callback` originally did `locationId = locData.locations?.[0]?.id || ''` and still wrote `square_connected: true`. Customer thinks they connected but downstream charges fail. Fixed.
- `fetchBookings` `.in()` queries silently returned `rows=0` on 400 errors. UI rendered as if no sessions existed. Fixed.

### Fix
Codebase scan for the anti-pattern: `?.foo || ''` or `?.foo || null` where the right side is downstream-critical data. Replace with explicit error handling that either throws or surfaces a friendly in-app prompt (per the "never show errors to customers" design principle).

Estimated: 2-3 hours to audit, scope of fixes depends on what's found.

### Trigger to act
Address opportunistically when in a relevant file. No urgency unless a specific instance bites a customer.

---

*Last updated: May 31, 2026*  
*Source: maintained by Claude through normal commits. HK reviews + edits inline.*
