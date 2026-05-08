# Payment Flow QA Checklist

**Date created:** May 7, 2026 (night)
**Owner:** HK
**Goal:** Verify every payment flow works correctly across all four processor configurations before declaring Square + Stripe parity battle-tested in production.

## How to use this document

Each section below is a processor configuration. Within each section is a list of flows to verify. Check the box once verified. If a flow fails, add a note about what failed and we will fix before moving on.

You will need:

1. **One test therapist account** for each configuration. Easiest: use the existing `healinghands` account and toggle Stripe / Square on and off via Settings.
2. **A test client identity** with email you can check (gmail, throwaway, etc).
3. **A real card** for live payment testing. Stripe and Square both refund test charges within 5-10 business days, so cost is just temporary.
4. **One iPhone and one laptop** to test across devices and wallet methods.

If a flow works, check the box. If it fails, do not check, paste me the error verbatim, and we fix before proceeding.

---

## Config 1: Square ON, Stripe OFF

This is the configuration HK already verified one flow on tonight (returning-customer card-save worked end-to-end).

### Therapist setup (Settings)

- [ ] Stripe shows "Not connected" with a connect button
- [ ] Square shows "Connected" with the Square account email/business
- [ ] Per-feature payment routing UI is hidden (only Square connected, no choice to make)
- [ ] Cancellation policy can be toggled on
- [ ] Card-on-file required can be toggled on
- [ ] Deposit amount per service can be set

### Booking page (client-facing)

- [ ] Page loads, services visible, slots visible
- [ ] **New client, no deposit, no card-on-file:** book service → email confirmation arrives → booking shows in dashboard as confirmed
- [ ] **New client, deposit required:** book service → Square deposit form loads → enter card → pay → email confirmation → booking shows confirmed with deposit_paid
- [ ] **New client, card-on-file required (no deposit):** book service → Square card-save form loads → enter card → mandate text shows → save → email confirmation → booking shows confirmed with card_on_file_id
- [x] **Returning client, card-save flow:** verified May 7 night ✓
- [ ] **Returning client, deposit:** uses saved card if present, or asks for new card
- [ ] **Returning client recognized:** shows "Welcome back" or similar

### Cancellation flow

- [ ] Therapist cancels session in dashboard with cancellation policy active → Square charges card on file → success email to client + therapist
- [ ] Therapist cancels session WITHOUT cancellation policy active → no charge → just status update
- [ ] Client cancels via cancellation link in confirmation email → respects policy → charges if late, doesn't if early

### Refund flow

- [ ] Therapist refunds a deposit from billing dashboard → Square processes refund → success state shown
- [ ] Refund shows correctly in billing dashboard transaction list

### Offer purchases (packages, gift certificates)

- [ ] Package purchase from booking page → Square Payment Link opens → client pays → returns to booking page → success state → package_purchases row created
- [ ] Gift certificate purchase from booking page → Square Payment Link opens → client pays → returns → certificate code generated and emailed
- [ ] Memberships: should be hidden / show "not available with Square only" because Square subscriptions don't auto-renew without a manual nudge

### Billing dashboard

- [ ] Revenue numbers add up correctly (Square transactions feed in)
- [ ] Stat cards on mobile show 2x2 grid not crushed
- [ ] Day / Week / Month / Year / 30-day views all work

### Edge cases

- [ ] Square redirect return state works (post-purchase URL has `?purchase_complete=1&processor=square`)
- [ ] Page refresh during checkout doesn't double-charge
- [ ] Closing the wallet sheet without paying returns to card form gracefully

---

## Config 2: Stripe ON, Square OFF

The mirror of Config 1. This is the original launch config and most therapists will start here.

### Therapist setup (Settings)

- [ ] Square shows "Not connected" with a connect button
- [ ] Stripe shows "Connected" with the Stripe account email
- [ ] Per-feature payment routing UI is hidden (only Stripe connected)
- [ ] Cancellation policy can be toggled on
- [ ] Card-on-file required can be toggled on
- [ ] Deposit amount per service can be set

### Booking page (client-facing)

- [ ] Page loads, services visible, slots visible
- [ ] **New client, no deposit, no card-on-file:** book service → email confirmation → confirmed
- [ ] **New client, deposit required:** Stripe Payment Element loads → cards tab default
- [ ] **Apple Pay button shows on iPhone with Apple Pay configured** ⭐ NEW today
- [ ] **Google Pay button shows on Chrome Android with Google Pay** ⭐ NEW today
- [ ] **Cash App Pay shows as option** ⭐ NEW today
- [ ] **Link shows for clients with saved cards via any Stripe merchant** ⭐ NEW today
- [ ] **Klarna shows for eligible regions** ⭐ NEW today (redirect flow, ends at `?deposit_return=1&...`)
- [ ] Pay with card → succeeds → confirmation email
- [ ] **New client, card-on-file required:** Stripe SetupIntent → Card Element loads (still legacy on save flow, migration deferred to next session) → mandate → save
- [ ] **Returning client recognized**

### Cancellation flow

- [ ] Therapist cancels with policy active → Stripe charges saved card → success
- [ ] Refund flow works one-tap from billing dashboard

### Offer purchases

- [ ] Package purchase → Stripe Hosted Checkout opens (has wallets natively) → success
- [ ] Membership purchase → Stripe subscription → auto-renews next month
- [ ] Gift certificate → Stripe Hosted Checkout → certificate generated

### Billing dashboard

- [ ] Stripe transactions show correctly
- [ ] Memberships visible with renewal status
- [ ] Stat cards mobile 2x2 grid

### Stripe-specific

- [ ] Stripe Connect return state (`/connect-return`) shows the polished feature list ⭐ NEW today
- [ ] Failed Stripe Connect (refresh state) shows the helpful retry message
- [ ] Redirect-method return (Klarna) lands at `?deposit_return=1&booking_id=X&redirect_status=succeeded` and confirms the booking ⭐ NEW today

---

## Config 3: Both ON

This is the most complex configuration. The therapist sees a per-feature routing UI and chooses which processor handles which feature.

### Therapist setup (Settings)

- [ ] Both Stripe and Square show "Connected"
- [ ] Per-feature payment routing UI appears with rows for: Deposits, Card on file, Memberships, Packages, Gift certificates
- [ ] Each row has a Stripe / Square radio toggle
- [ ] Default routing: Stripe for Memberships (only one that supports auto-renew), client choice for others
- [ ] Saving routing preferences persists across page reloads

### Booking page logic

For each feature, the booking page should call the correct processor based on the routing setting:

- [ ] Deposit routes to whichever was set (Stripe → Stripe deposit form; Square → Square deposit form)
- [ ] Card on file routes correctly
- [ ] Package purchase uses the routed processor
- [ ] Gift certificate uses the routed processor
- [ ] Membership ALWAYS uses Stripe regardless of routing (because Square cannot auto-renew)

### Edge cases (the tricky ones)

- [ ] Switch deposit routing from Stripe to Square mid-day, new bookings use Square going forward, existing bookings keep their original processor
- [ ] Therapist disconnects Stripe while having sessions with Stripe card_on_file_id → those sessions show "card on file from Stripe (no longer connected)" gracefully → cancellation flow falls back gracefully
- [ ] Same: disconnect Square with Square cards on file
- [ ] If Stripe-routed packages exist but therapist switches package routing to Square, old package_purchases still work, new purchases go through Square

### Billing dashboard

- [ ] Mixed Stripe + Square transactions appear in a unified view
- [ ] Stat cards correctly sum across both processors
- [ ] Per-processor breakdown available (drill down into one)

---

## Config 4: Both OFF

The free-tier path. Therapist hasn't connected any payment processor. Critical that the booking page still works for free booking, no card needed.

### Therapist setup (Settings)

- [ ] Both Stripe and Square show "Not connected"
- [ ] Cancellation policy is disabled (no way to charge without a processor)
- [ ] Deposit and card-on-file settings are hidden or grayed out with "Connect a processor first" hint
- [ ] Therapist sees a Bronze-tier-friendly nudge to connect a processor for the full feature set

### Booking page (client-facing)

- [ ] Page loads, services visible, slots visible
- [ ] **New client books:** no payment step, no card form, just confirmation → email arrives → confirmed
- [ ] **No deposit prompt anywhere**
- [ ] **No card-on-file prompt anywhere**
- [ ] **Returning client recognized**, books without payment

### Dashboard

- [ ] Sessions show without payment metadata
- [ ] Billing dashboard either hidden or shows "Connect a processor to see revenue" empty state
- [ ] Memberships, packages, gift certs all hidden (require a processor)

---

## Cross-cutting items (verify in any one config)

- [ ] **Apple Pay button on iPhone Safari** with wallet configured (Stripe Payment Element) ⭐ shipped today
- [ ] **Google Pay button on Chrome Android** with wallet configured (Stripe Payment Element) ⭐ shipped today
- [ ] Email confirmations arrive within 60 seconds (Resend should be fast)
- [ ] Email content has no em dashes (Joy voice check)
- [ ] Mobile booking page is genuinely usable on a 375px iPhone screen
- [ ] Booking page loads in under 3 seconds on cellular
- [ ] Cancellation policy text in mandate is grammatically correct in all states (active vs not active)
- [ ] Browser back button doesn't break in-flight payment
- [ ] Browser refresh during payment doesn't lose state

## Performance smoke tests

- [ ] Open the booking page, run Lighthouse, confirm Performance score > 80 on mobile emulation
- [ ] Time the deposit flow from "tap pay" to "see success", under 5 seconds expected
- [ ] Time the card-save flow same way

---

## Bugs found during testing

Use this section to log anything that fails. Format:

```
## Bug N
- Config: (which of 1/2/3/4)
- Flow: (which checkbox)
- Symptom: (what happened, copy/paste any error verbatim)
- Repro: (steps to make it fail)
```

(empty so far - HK to fill as testing proceeds)

---

## When everything is checked

Once every checkbox above is filled in this file:

1. Pin a 'Payment QA passed May DD, 2026' note to the top of `docs/BILLING_STRATEGY.md`
2. Tell the founding therapists in your beta cohort: "all four payment configurations have been verified end-to-end, you can switch processors without fear"
3. Update the launch readiness state in BLOCK_PLAN
4. Move to the next priority (probably mobile dashboard polish for SessionDetail and Outreach, or Square wallet support)

This file should live in `docs/PAYMENT_QA_CHECKLIST.md` and stay in the repo as a record of what was tested and when. If we ever ship a major payment change, we re-run this same checklist.
