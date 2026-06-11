# Square End-to-End Test Script (May 31 2026)

**For:** HK, running on Joy Demo therapist (Square-connected, Stripe-disconnected).
**Goal:** verify every Square code path 1-by-1 so you know exactly what works and what does not, before any real Square-only therapist sees this in production.
**Approach:** create future bookings as scenarios, walk each scenario through one Square flow, record pass/fail next to each step.

---

## Setup (5 minutes)

### A1. Confirm Joy Demo therapist is Square-only
1. Open Supabase → table editor → therapists → row for Joy Demo (`2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`).
2. Confirm `square_connected=true`, `square_access_token` is populated, `square_location_id=LS4K86QZB69MJ`.
3. Confirm `stripe_account_connected` is `false` or `stripe_account_id` is null.

> If both are connected, you are not actually testing Square-only mode. Disconnect Stripe in Settings before continuing, or the routing logic prefers Stripe and you will never hit the Square branch.

### A2. Confirm Joy Client exists
1. Find `bodymap01@gmail.com` in clients table for Joy Demo.
2. Note the client_id (should match the canonical Joy Client `e3255b26-4e94-42ab-993f-84eee41ede3f`).

### A3. Cleanup pre-schema-fix charges
Earlier today you marked the pre-schema Square charges as offline-paid (`offline_only`). They will never refund through the Square API because they have no `square_payment_id`. Leave them alone; do not test refunds against them. All test charges below will use newly-created bookings with the schema fix in place.

### A4. Pull a fresh schedule view
1. Refresh `/dashboard/schedule` to clear stale state.
2. Open browser console (F12). Filter for "Square" or "[CheckoutModal]" so you see the chatter as each flow runs.

---

## Scenario 1 — Card on file deposit at booking time

Tests: client booking page → Square save-card → deposit charge → confirmation. This is the path Square-only therapists rely on most.

### Steps
1. **Public booking.** Open `https://mybodymap.app/healinghands` in an incognito window (so you are not logged in as therapist).
2. Pick a service that requires a deposit. If none do, set one in Settings → Services first.
3. Pick a slot 5+ days out (so the cancellation/reschedule windows have room).
4. On checkout, fill client info as Joy Client: `bodymap01@gmail.com`, name `Joy Client`, phone any.
5. Enter test card: `4111 1111 1111 1111`, any future expiry, any CVC, any ZIP.
6. Tap **Pay deposit and book**.

### Check
- **A.** Booking landing page shows success.
- **B.** In Supabase `bookings` table, the new row has `card_on_file_square_customer_id` populated AND `card_on_file_payment_method_id` populated. **If either is null, save-card-at-booking is broken — flag immediately.**
- **C.** In `session_payments`, a row for this booking has `payment_method='square_card_new'`, `status='succeeded'`, `square_payment_id` populated, `square_order_id` populated.
- **D.** In `clients`, Joy Client row has `square_customer_id` populated.
- **E.** Joy Client receives an email "Booked!". Therapist receives the new-booking notification.

### Pass/fail
- B failed → **save-card-at-booking broken** (BookingPage.js line ~1893; check Square branch)
- C failed → schema or persistence regression (CheckoutModal Square branch around line 1175)
- D failed → init-card-setup or save-card Square branch broken
- E failed → notify-booking-event or Resend/Twilio config (unrelated to Square)

---

## Scenario 2 — Therapist charges saved card from schedule

Tests: card on file detection in CheckoutModal → `square-charge-card` with saved card → `session_payments` insert.

### Steps
1. Log in as Joy Demo (`bodymapdemo@gmail.com`).
2. Open the booking you just created in Scenario 1 (slide-over).
3. Tap **Charge**.
4. Confirm the modal shows "Saved card on file" with `Square` brand + last 4 (1111).
5. Tap **Charge saved card**. Use the full amount.

### Check
- **A.** Toast: "Paid".
- **B.** Side panel shows green "PAID" pill.
- **C.** In `session_payments`, second row inserted with `payment_method='square_card_on_file'`, `status='succeeded'`, `square_payment_id` populated.
- **D.** Joy Client gets a payment receipt email. Method label in email reads "Square card on file" (not "Other").
- **E.** In Square dashboard → Transactions, the payment appears within ~30 seconds.

### Pass/fail
- A failed but charge appears in Square dashboard → CheckoutModal Square branch error path (likely the `session_payments` insert error from earlier today; check console for "[CheckoutModal] session_payments INSERT failed")
- D failed → `notify-payment-event` or method-label mapping (added today, double-check `square_card_on_file` branch around line 130 of `notify-payment-event/index.ts`)
- E failed → wrong location_id or stale token

---

## Scenario 3 — Refund a Square card-on-file charge

Tests: `refund-session-payment` Square branch → `square_payment_id` lookup → Square `/v2/refunds` call → row flip to `refunded`.

### Steps
1. From the booking you charged in Scenario 2, tap **Refund** on the paid row.
2. The modal should now say **"Refund $X to Joy Client?"** with subtext **"Square returns the full amount to the client's card in 5 to 10 business days."** NOT "platform will mark it refunded."
3. If you see the old offline-style copy, the RefundModal fix didn't deploy or you're on a stale build — hard-reload.
4. Tap **Refund full $X**.

### Check
- **A.** Toast: refund issued.
- **B.** Side panel pill goes from green PAID to gray REFUNDED.
- **C.** In `session_payments`, the row's `status='refunded'`, `refunded_at` populated, `refund_amount_cents` matches.
- **D.** Joy Client receives a refund receipt email. Method label reads "Square card on file" or similar.
- **E.** In Square dashboard, a refund line item appears against the original payment.

### Pass/fail
- B/C failed with modal saying "no_square_payment_id" → the original charge predates the schema fix (don't test against pre-schema rows)
- E failed → Square API call returned ok but the refund didn't actually land in Square. Check `refund-session-payment` logs in Supabase functions panel.
- D failed → notify-refund-event method label mapping (added today)

---

## Scenario 4 — Send Square pay-link, client returns to /pay-thanks

Tests: `create-payment-link` Square branch → Square Checkout hosted page → `/pay-thanks?sp=...` → `verify-payment-link` → row flip.

### Steps
1. Create a new booking (any future date) for Joy Client through the schedule (therapist-side, not public).
2. On the booking slide-over, tap **Checkout** → **Send pay link**.
3. Pick "Email" delivery. Confirm.
4. Open Joy Client's inbox (`bodymap01@gmail.com`). Find the pay-link email.
5. Tap the **Pay** button. Lands on Square's hosted checkout page.
6. Pay with test card `4111 1111 1111 1111`.
7. **Tap the "Return to merchant" link on Square's success screen.** This is the critical step that exercises the redirect-back path.
8. Land on `/pay-thanks?sp=<id>`.

### Check
- **A.** `/pay-thanks` shows "Payment confirmed" within a few seconds.
- **B.** In `session_payments`, the row's `status='succeeded'`, `square_payment_id` populated.
- **C.** Joy Client receives a payment receipt email.
- **D.** Therapist receives the payment notification.

### Pass/fail
- A stuck on "Verifying..." → `verify-payment-link` not deployed or env vars missing. Check Supabase logs.
- B never flipped to succeeded → verify-payment-link reached Square but Square returned a non-COMPLETED status. Check the function logs.

---

## Scenario 5 — Square pay-link, client CLOSES the Square tab without returning

Tests: the v1 trade-off — does the webhook (just shipped) save us?

### Steps
1. Create a new booking for Joy Client.
2. Send pay-link by email.
3. Open the email and tap **Pay**.
4. Pay with `4111 1111 1111 1111`.
5. On Square's success screen, **CLOSE THE TAB.** Do NOT tap "Return to merchant".
6. Wait 30 seconds.
7. As Joy Demo, refresh the schedule.

### Check
- **A.** With webhook configured (see "Webhook setup" section below): the booking row shows PAID within ~30 seconds of the close. `session_payments.status='succeeded'`, `square_payment_id` populated.
- **B.** WITHOUT webhook configured: the row stays `pending`. This is the known gap. You'd have to mark it paid manually.

### Pass/fail
- A passes → webhook is working as designed. You can ship Square pay-links to real Square-only therapists.
- A fails (row stays pending) → webhook not deployed, or `SQUARE_WEBHOOK_SIGNATURE_KEY` / `SQUARE_WEBHOOK_URL` env vars missing in Supabase, or Square's webhook subscription points elsewhere.

---

## Scenario 6 — Square cancellation fee link

Tests: `create-cancellation-fee-link` Square branch.

### Steps
1. Open a booking and trigger a cancellation that crosses your policy threshold (less than 24hrs before, say).
2. Choose "Send fee link" path.
3. Pick email delivery.
4. Joy Client receives a fee email. Tap to pay on Square's hosted page.

### Check
- **A.** `cancellation_charges` row created with `processor='square'`, `square_order_id` populated, `status='pending'`.
- **B.** After paying + redirect back, row flips to `succeeded` with `square_payment_id` populated.
- **C.** If client closes tab: webhook flips it (same as Scenario 5).

---

## Scenario 7 — Square booking-approval deposit charge

Tests: `booking-approval` Square branch → `provider.chargeSavedCard` → `card_on_file_square_customer_id`.

### Steps
1. Make sure Joy Demo's services have approval-required enabled for at least one service.
2. As Joy Client in incognito, book that service. Save a card during the booking flow (Scenario 1 flow).
3. The booking should land in status `pending-approval`.
4. As Joy Demo, open the pending-approval banner. Tap **Approve and charge deposit**.

### Check
- **A.** Booking flips to `confirmed` and the deposit `session_payments` row is `succeeded` with `payment_method='square_card_on_file'`, `square_payment_id` populated.
- **B.** Joy Client gets a "Booking approved" email.
- **C.** If Square charge fails (e.g. card declined), booking stays in `pending-deposit` (NOT confirmed) and the row is `failed` with a message.

### Pass/fail
- A failed → the Square detection check in booking-approval (`isSquareCardOnFile = !!booking.card_on_file_square_customer_id`) didn't fire. Verify the booking row has that column set from Scenario 1.

---

## Webhook setup (one-time configuration, required before Scenario 5 passes)

1. In Square Developer Dashboard → your app → **Webhooks** → Add subscription.
2. **URL:** `https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-payment-link-webhook`
3. **Event:** `payment.updated`
4. Copy the **Signature key** Square shows.
5. In Supabase → Project Settings → Edge Functions → Secrets, set:
   - `SQUARE_WEBHOOK_SIGNATURE_KEY` = (the key from step 4)
   - `SQUARE_WEBHOOK_URL` = `https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/square-payment-link-webhook` (exact same URL as step 2)
6. Save and wait ~30 seconds for Supabase to roll the secret out.
7. In Square dashboard, tap **Send Test Event** → `payment.updated`. Check Supabase function logs for `[square-payment-link-webhook]`. Should see `signature verification` pass and the event ignored as `no_match` (test events have no order id in our DB).

---

## What to do with this script tonight

Run scenarios 1, 2, 3 first. If those pass, you have confidence in the core charge + refund + card-on-file path. That alone gets you to Square parity for the most-common flows.

Scenarios 4-7 cover the less-common flows. If you don't have time for all of them tonight, gate them behind a "do not send Square pay-links yet" note in your runbook until you've run through them.

Mark each step pass / fail / not-tested. Send me the result and I'll fix anything that fails.

---

## Known limitations (be aware before you start)

- **Pre-schema Square charges from earlier today** (the $1 Amex) cannot refund through MyBodyMap. They have no `square_payment_id`. You already marked them paid manually.
- **Square Web Payments save-card on new-card charge** is not yet wired in CheckoutModal's `chargeNewCardSquare` (the save-card-for-later checkbox shipped today is Stripe-only). Square-only therapists who run new-card charges through CheckoutModal will NOT save the card. The card is saved at initial booking time only (Scenario 1).
- **Square dual-connected with Stripe**: routing prefers Stripe. If you want to actually test Square paths, Joy Demo must be Square-only. Don't reconnect Stripe during testing.
