# Cash, Venmo, Zelle payment tracking: strategy

**Asked by:** Jiny Green, May 7 2026.
**Status:** Strategy only, nothing built yet. Decisions pending.

## What Jiny actually asked for

> "Are you going to allow other payment types (for tracking) like Cash, or Venmo, etc, and or ways of being able to give certain clients credits they may already have?"

Two distinct asks, both real:

1. **Track payments outside the card processor.** Therapist takes cash, Venmo, Zelle, check. The booking should still show as paid; the books should still balance.
2. **Client credits / store credit.** Therapist owes a client a credit (gift card balance, refund, makeup session). The credit auto-applies at next booking.

These are different features. The first is about recording reality; the second is about applying balance. They share a database concept but ship separately.

## Why this matters

Solo LMTs commonly mix payment methods:
- Regulars on Venmo / Zelle because there are no processor fees on personal transfers
- Walk-ins on card via Stripe or Square at the time of session
- Cash for tips, sometimes for the whole session
- Check from corporate or insurance reimbursement clients

If MyBodyMap can only see Stripe and Square totals, the therapist's "revenue this month" number in our dashboard is wrong. They will lose trust in our reports the first time the number does not match their bank deposit.

Equally important: most spa platforms (including Vagaro, Acuity, Fresha) handle this poorly. They give you a "mark as paid" toggle with no proper category, no audit trail, and no idea where the money actually went. We can do better, and we should highlight that we do.

## The minimum viable feature: "Other payment" recording

Smallest version that makes Jiny's books balance.

**Schema:**
- New `payment_method` enum on the existing `bookings` (or `sessions`) row:
  `stripe` | `square` | `cash` | `venmo` | `zelle` | `check` | `other`
- Default to the processor when a Stripe or Square charge is recorded.
- For other methods, the therapist marks it manually after the session.

**UI:**
- In SessionDetail, an "Payment received" card that defaults to the processor-recorded method when there is one. Therapist taps to change it if they took cash instead.
- For the "other" methods, an optional reference field (Venmo handle, check number) for their own records.

**Dashboard impact:**
- Revenue card breaks down by method:
  > Last 30 days: $4,200
  > Card $3,100 · Cash $480 · Venmo $620
- Stripe Connect still handles all the actual money movement on card payments; the "other" amounts are just record-keeping for the therapist.

**Effort:** ~3 hours. Schema migration, 2 UI fields, dashboard chip. Most of the work is the dashboard slice.

## What we explicitly do not build

**Direct Venmo or Zelle integration.** Neither has a real business API:

- **Venmo:** Paypal Inc. owns Venmo. They offer a Venmo Business API for merchants, but it requires PayPal Business onboarding and the experience inside the consumer Venmo app for these payments is the same as a card charge with PayPal fees. It is not the free P2P Venmo therapists actually use. So integrating "Venmo" the consumer experience is impossible. We track the manual entry.
- **Zelle:** No public API for businesses. Bank-to-bank only. Cannot be integrated.
- **Cash:** Obviously no API.

So the right boundary is: we record what happened, we do not pretend to move the money. Therapists like this — they want their Venmo handle private to them.

## The bigger feature: client credit / store credit

Two ways credit balance shows up:

1. **Refund or makeup balance.** "I refunded Susan's session, she has a $120 credit toward next time."
2. **Gift card balance.** A client received a $200 gift card; redeemed $80 last visit; has $120 left.
3. **Adjustment.** "I undercharged her last visit, let me knock $20 off next time" or "she paid in advance, apply that $50."

All three live in the same data structure: `client_credits` table with amount, type, source (session id or gift card id), and `applied_at` once consumed.

**Auto-apply rule:** When a session is being closed out for billing, if the client has any unapplied credits, the therapist sees an inline pill on the payment screen:
> Susan has $120 in credit. [Apply $120] [Don't apply this time]

**Effort:** ~5 hours. Includes schema, the consume logic, the gift card link, an admin view of outstanding balances per client.

## Suggested phasing

**Phase 1 (3 hours, ship soon):** Other-payment method recording. Solves Jiny's bookkeeping ask. Makes our revenue numbers honest.

**Phase 2 (5 hours, ship later):** Client credit ledger with auto-apply. Higher value but more complex. Should wait until Phase 1 is in production and we know how therapists actually use it.

**Phase 3 (not committed):** Allow split payments at a single session. "$100 on card, $20 cash tip, $30 from credit balance." Real but not common. Defer until a therapist asks for it explicitly.

## How this shows up in marketing

If we build Phase 1, the gift in the marketing copy is:

> "Your books actually balance. Cash, Venmo, Zelle, check, or card; we record every payment method so your monthly revenue matches your bank deposit. Square is the only other platform that handles this honestly."

This pairs with the GAAP-correct gift card accounting note. Both are about books-that-balance, and both are things Jiny brought up because most platforms get them wrong.

## Open questions for HK

1. Phase 1 or wait for both phases at once?
2. Should "Mark as paid" be the therapist's manual action, or auto-default to a method based on the booking origin (e.g., Stripe-recorded booking → default Stripe payment method on close)?
3. Are check / corporate insurance reimbursement frequent enough to surface in the dropdown, or hide behind "Other"?
4. Tips: should those be tracked separately from the session fee (so revenue reports can split sales vs gratuity)?
