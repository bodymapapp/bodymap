# Gift Cards ,  Phase 2 Build Plan

**Goal:** Wire the visual flow shipped in Phase 1 (`/gift/:customUrl`) to real Stripe Connect payments, DB writes, and 3 emails. Plus add the booking-page entry point and dashboard enhancements.

**Phase 1 shipped:** Commit `110e47db`, May 25 2026. Visual flow only, zero production impact.

---

## HK decisions needed (5 minutes total)

Mark each with HK's call so I can scope precisely tomorrow.

| Decision | Options | HK's call |
|---|---|---|
| 1. Platform fee on gift purchases | 0% (recommended, matches bookings) / 1% / 2% / 3% | __________ |
| 2. Default amount range | $25 min, $1000 max OK? | __________ |
| 3. Expiry policy | Never expires (recommended) / 1 year / 2 years | __________ |
| 4. Booking page entry point | (a) Subtle link "Give the gift of healing →" in nav, (b) Card section above the services, (c) Modal triggered from a header button | __________ |
| 5. Email copy approval | See `docs/emails/gift-cards/*.md`. Approve, edit, or send back for revisions. | __________ |

---

## DB migration (HK runs in Supabase SQL editor, project `rmnqfrljoknmellbnpiy`)

```sql
-- Add columns needed for Stripe + scheduled delivery + audit
ALTER TABLE gift_certificates
  ADD COLUMN IF NOT EXISTS purchaser_email TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee_cents INT DEFAULT 0;

-- Index for the scheduled-delivery cron's WHERE clause
CREATE INDEX IF NOT EXISTS idx_gift_certificates_scheduled
  ON gift_certificates(scheduled_delivery_at)
  WHERE scheduled_delivery_at IS NOT NULL AND email_sent_at IS NULL;
```

That's the only SQL needed. Safe (all additive, all nullable).

---

## Build steps (in order, mine to execute)

### Step A: Edge function `create-gift-payment-intent` (1.5h)

Mirror of the existing `create-deposit` function. Creates a Stripe Connect PaymentIntent with:
- amount in cents
- application_fee_amount (if HK picks a platform fee % above 0)
- transfer_data.destination = therapist's connected account
- metadata: { therapist_id, designKey, themeKey, recipient_name, recipient_email, purchaser_name, purchaser_email, message, delivery, scheduled_delivery_at }

Returns client_secret for the frontend Stripe Elements form.

### Step B: Edge function `gift-purchase-webhook` (1.5h)

New webhook endpoint for Stripe `payment_intent.succeeded` events. On success:
1. Read PaymentIntent metadata
2. Generate unique gift code (collision-retry with the existing UNIQUE constraint)
3. INSERT row into `gift_certificates` with all fields including `stripe_payment_intent_id`
4. If delivery=now or delivery=self, call the existing `send-gift-certificate` (recipient email) immediately
5. Call new email function for purchaser receipt
6. Call new email function for therapist notification (respect `gift_purchased` notification pref)
7. If delivery=scheduled, leave `email_sent_at` null ,  the cron picks it up

### Step C: Two new email functions (2h)

- `send-gift-purchaser-email`: takes `gift_certificate_id`, pulls row + therapist, renders the receipt HTML per `docs/emails/gift-cards/2-purchaser.md`
- `send-gift-therapist-email`: takes `gift_certificate_id`, pulls row + therapist + notification prefs, renders the operational notification HTML per `docs/emails/gift-cards/3-therapist.md`

Both use Resend, both log to `notification_log` for the founder dashboard visibility.

### Step D: Scheduled delivery cron (0.5h)

Hourly Supabase cron job. Query:
```sql
SELECT id FROM gift_certificates
WHERE scheduled_delivery_at <= NOW()
  AND email_sent_at IS NULL
  AND status = 'active';
```
For each: call `send-gift-certificate` (the existing recipient email function). It will set `email_sent_at` to mark as delivered.

### Step E: Frontend Stripe wiring (1.5h)

Replace the `MockCheckout` component in `GiftLandingPage.jsx` with a real Stripe Elements card form:
1. On step transition to 'checkout', call `create-gift-payment-intent` with the form state
2. Mount Stripe Elements with the returned client_secret
3. On `stripe.confirmPayment()` success, transition to the real success screen (which now shows the actual gift code from the webhook-created row)
4. Remove the yellow preview-mode banner

### Step F: Booking page entry (0.5h)

Based on HK's decision (a/b/c above), add the entry point to `BookingPage.js`. Just a CTA that links to `/gift/{therapist.custom_url}`. One small addition, no other modifications.

### Step G: Dashboard activity view (1.5h)

Light enhancement to `GiftCertificates.js`:
- New filter chip "Scheduled" to surface gifts queued for future delivery
- Revenue summary card at the top: total purchased this month, total redeemed, average gift size
- Each row in the list shows a small badge: "Purchased online" or "Manual entry" so the therapist can tell them apart
- "Refund" button on rows that haven't been redeemed yet (calls Stripe refund + sets status='refunded')

### Step H: End-to-end testing (1.5h)

- Real card ($1 test purchase) → confirm Stripe webhook fires → row created → 3 emails arrive
- Scheduled delivery: create a gift with `scheduled_delivery_at = NOW() + 5 minutes`, wait, confirm cron sends
- Redemption: take the code, visit `/book/healinghands?gift={code}`, confirm field prefills + balance applies
- Edge cases: invalid card, network drop mid-checkout, duplicate webhook delivery, expired session

---

## Total Phase 2 estimate

~10 hours of focused work. Probably one full day if uninterrupted.

---

## What stays in Phase 3 (later)

These are nice-to-haves that we're explicitly NOT building tomorrow:

- Custom Mother's Day / Father's Day / Valentine's promotional pages
- SMS to purchaser/therapist (only email in Phase 2)
- Multi-currency support
- Gift card balance lookup public page (where recipient enters code to check balance)
- Recurring gift subscriptions (monthly gift cards)
- Bulk gift card purchases (corporate clients)

If Phase 2 ships and gets traction, Phase 3 can prioritize based on what therapists actually ask for.

---

## File-by-file Phase 2 changes

| File | Change | Risk |
|---|---|---|
| `supabase/migrations/gift_cards_phase2.sql` | NEW (HK runs manually) | Low (additive) |
| `supabase/functions/create-gift-payment-intent/` | NEW directory | Zero |
| `supabase/functions/gift-purchase-webhook/` | NEW directory | Zero |
| `supabase/functions/send-gift-purchaser-email/` | NEW directory | Zero |
| `supabase/functions/send-gift-therapist-email/` | NEW directory | Zero |
| `supabase/functions/_shared/gift-card-html.ts` | NEW (shared card preview HTML for embedding in emails) | Zero |
| `src/pages/GiftLandingPage.jsx` | Replace `MockCheckout` with real Stripe Elements | Touched but isolated |
| `src/pages/BookingPage.js` | Add CTA per HK's decision | Small additive change |
| `src/components/GiftCertificates.js` | Enhanced filters, revenue card, badges, refund button | Touched but additive |
| Cron job | NEW Supabase cron entry | Low |

No existing edge functions get modified. The existing `send-gift-certificate` is called as-is.
