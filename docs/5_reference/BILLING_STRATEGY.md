# Billing Strategy and Architecture

**Last updated:** May 31, 2026
**Audience:** HK and any future engineer who works on the payment system. Read before touching `_shared/payment-provider.ts` or any payment-touching edge function.
**Status:** **Square Parity v1 shipped May 31, 2026.** Closed gaps where the May 6-7 "parity" declaration was actually half-built. What was real on May 7: provider abstraction, deposit + cart + package flows. What was missing until today: Square refunds (no `square_payment_id` column existed), Square payment links (Stripe-only by hard-code), Square cancellation fee links (Stripe-only), Square booking-approval deposit charge (Stripe-inline), Square method labels in notifications (showed "Other"). All closed in this push. Stripe wallet methods (Apple Pay, Google Pay, Cash App Pay, Link, Amazon Pay, Klarna) enabled at platform level. Phase 3 (FedNow when ready) still future. ACH dropped per HK decision May 7.

---

## What changed May 31, 2026 (Square Parity v1)

### Schema additions (additive, no Stripe changes)
- `session_payments.square_payment_id` (text) — Square Payments API id, required by `/v2/refunds`
- `session_payments.square_order_id` (text) — Square Orders API id, for reconciliation against the Square dashboard
- `package_purchases.square_payment_id`
- `event_registrations.square_payment_id`
- `cancellation_charges.square_order_id` + `square_payment_id`
- Partial index `session_payments_square_payment_id_idx`

### Edge functions
- `refund-session-payment` — Square branch via `provider.refund()` before the Stripe code. Stripe path identical to before. `STRIPE_SECRET_KEY` check moved into Stripe branch so Square-only therapists can refund without Stripe credentials.
- `create-payment-link` — Square branch via `provider.createCheckoutLink`. Therapist on Square gets a Square Checkout URL to send to client. Pending session_payments row tracks `square_order_id`.
- `create-cancellation-fee-link` — same pattern for cancellation fees.
- `booking-approval` — Square branch via `provider.chargeSavedCard` for the approve-and-charge deposit flow. Triggered when `card_on_file_square_customer_id` is set on the booking.
- `notify-payment-event` + `notify-refund-event` — Square method labels (`square_card_on_file`, `square_card_new`, `square_payment_link`) so receipts say "Square card on file" instead of "Other".
- `verify-payment-link` (new) — post-payment redirect handler for Square pay links. Lands on `/pay-thanks?sp=<id>` after client pays on Square's hosted page; calls `provider.verifyCheckout`, flips row to `succeeded`, fires notification.

### Frontend
- `CheckoutModal` persists `square_payment_id` + `square_order_id` on both Square charge paths (chargeNewCardSquare for new-card, chargeCardOnFile for card-on-file).
- `/pay-thanks` page (new) — post-Square-checkout landing.
- `BookingDetailPage` (new, at `/dashboard/schedule/booking/<id>`) — full-page surface for deep booking work. Slide-over remains primary for quick context (Side panel A).

### Known v1 trade-off
Square pay-links use the redirect-back-to-our-domain pattern instead of server-side webhooks. If the client closes Square's hosted tab without returning to `/pay-thanks`, the row stays `pending` until the therapist marks it paid manually. A server-side Square webhook (`square-payment-link-webhook`) is queued for v1.1 to close this gap fully.

---

## Three-sentence summary

The abstraction is the moat. The capability matrix is the honesty layer. The versioning is the way out.

We never touch the money. Stripe and Square are licensed money movers; we are software-as-a-service that orchestrates them through a single PaymentProvider interface. Every feature ships through the abstraction so we can swap, version, and add processors without rewriting edge functions.

---

## Strategic frame

### Why dual-processor matters
No competitor in our space (Vagaro, MassageBook, GlossGenius, ClinicSense, Noterro, Jane App) offers true dual-processor parity. They all force their own merchant relationship: Vagaro Pay, GlossGenius proprietary, Jane Payments. They prefer the lock-in.

MyBodyMap's "use Stripe OR Square OR both" is genuine differentiation. Therapists who already have a processor relationship do not need to migrate. Therapists who want to switch are not locked in.

### Why we never want to be the merchant of record
Becoming a money transmitter requires state-by-state Money Transmitter Licenses (MTLs). Each costs $50k-$500k to obtain. We would need to do this for all 50 states. Cost would exceed our entire engineering budget multiple times over.

By orchestrating Stripe and Square (each of which is licensed in every state), we get the same functionality with zero regulatory exposure. They handle compliance, fraud, KYC, dispute resolution. We handle the user experience and the business logic.

### Why we never want to hold customer funds
Even briefly. The moment we hold customer money for any period, we may be classified as a money transmitter regardless of license status. Stripe and Square route payments directly to therapist bank accounts; we never sit in the middle. This is non-negotiable architecture.

---

## Architecture overview

### Three layers
The payment system has three distinct layers. Each layer has different responsibilities and changes at different rates.

#### Layer 1: PaymentProvider interface
`supabase/functions/_shared/payment-provider.ts`

Defines the contract that every processor must satisfy:
- `createCheckoutSession(input) → checkoutUrl`
- `processRefund(input) → refundResult`
- `chargeCardOnFile(input) → chargeResult`
- `getCapabilities() → CapabilityMatrix`
- `getVersion() → string`

This file changes rarely. When it changes, every processor needs to be updated.

#### Layer 2: Processor implementations
`supabase/functions/_shared/providers/stripe.ts` (StripeProvider)
`supabase/functions/_shared/providers/square.ts` (facade)
`supabase/functions/_shared/providers/square/v1.ts` (SquareV1Strategy)

Each processor implements the interface. Stripe and Square handle the same operations differently under the hood. The interface forces them to expose the same surface.

Versioning pattern: `stripe-v1-2026-05`, `square-v1-2026-05`. When Square ships a better recurring billing API, we add `square-v2-...` without touching v1. Therapists on existing flows are unaffected; new flows use v2.

#### Layer 3: Edge functions
`supabase/functions/create-deposit-checkout/`
`supabase/functions/charge-cancellation-fee/`
`supabase/functions/refund-purchase/`
... and so on.

Each edge function imports from `_shared/payment-provider.ts`, calls the abstraction, never reaches into provider-specific code directly. The function does not know whether Stripe or Square handles the operation; it just asks the PaymentProvider.

### How routing works
A therapist can connect Stripe, Square, or both. When both, the `payment_routing` JSON field on `therapists` table specifies per-feature which processor handles what:

```json
{
  "deposits": "stripe",
  "memberships": "stripe",
  "packages": "square",
  "cancellation_fees": "stripe",
  "refunds": "auto"
}
```

When `auto` (the default), routing follows the original purchase processor. A package bought via Stripe gets refunded via Stripe.

### Capability matrix
Each processor declares what it supports and at what level:

```typescript
type Capability = "full" | "limited" | "unsupported";
type CapabilityMatrix = {
  recurringRenewal: Capability;
  cardOnFile: Capability;
  chargeSavedCard: Capability;
  refunds: Capability;
  partialRefunds: Capability;
  webhooks: Capability;
  // ...
};
```

Stripe declares `recurringRenewal: full`. Square declares `recurringRenewal: limited` (because it requires manual nudge). The UI surfaces this honestly: when a therapist on Square sets up a membership, we tell them up front that monthly renewal will require a tap rather than running silently.

---

## Provider-specific details

### Stripe
- **Account model:** Stripe Connect (Standard accounts). Each therapist has their own Stripe account, connected via OAuth. Funds route directly therapist bank account.
- **Auth:** OAuth 2.0 via standard Stripe Connect flow.
- **Webhooks:** Connected to platform endpoint; events include `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `charge.refunded`.
- **Test mode:** Stripe test keys are configured separately. Test card 4242 4242 4242 4242 for happy path; 4000 0000 0000 0002 for declined card.
- **Pricing:** 2.9% + $0.30 per transaction for standard cards. ACH is 0.8% capped at $5 (we are not enabling ACH).
- **Capability matrix:** mostly `full`. `recurringRenewal: full`, `customerPortal: full`, `webhooks: full`.

### Square
- **Account model:** Square OAuth with 11 scopes (most recently expanded April 18, 2026 to include subscription scopes).
- **Auth:** OAuth 2.0 via Square's Connect API.
- **Webhooks:** Connected to platform endpoint; events include `payment.updated`, `subscription.updated`, `refund.created`.
- **Activation requirement:** Each merchant must complete identity + bank verification at squareup.com/activate before Square will process real charges. ~10 minutes one-time. Most therapists who already use Square in-person have done this; new Square users have not.
- **Test mode:** Square Sandbox is available but HK declined sandbox testing path because of overhead. Production-only testing.
- **Pricing:** 2.6% + $0.10 per transaction for standard cards. Lower than Stripe.
- **Capability matrix:** `recurringRenewal: limited` (manual nudge), `cardOnFile: full`, `webhooks: full`, `chargeSavedCard: full`. Most operations work as well as Stripe; the renewal gap is the main differentiator.

### Why Square requires activation
Square's underlying compliance model is stricter than Stripe Connect Standard. Stripe Connect Standard verifies the therapist via OAuth and lets them transact immediately. Square requires identity + bank verification ON TOP of OAuth. There is no way for us to bypass this; it is a Square-side rule.

We surface this clearly in the Settings → Payments section with a "Things to know about Square" collapsible ribbon.

---

## Capability matrix in detail

| Capability | Stripe | Square | Notes |
|------------|--------|--------|-------|
| Deposits at booking | full | full | Both processors handle one-time payment links |
| Package purchases | full | full | Both handle catalog items |
| Gift certificate purchases | full | full | Both handle |
| First-month membership charge | full | full | Both handle |
| Recurring monthly renewal | **full** | **limited** | Stripe: silent auto-renew. Square: manual nudge per cycle. |
| Customer self-serve subscription portal | full | unsupported | Stripe Customer Portal exists; Square has no equivalent. |
| Card on file capture at booking | full | full | Both via tokenization. Square less browser-friendly (~5% client incompatibility on older Safari). |
| Charge saved card programmatically | full | full | Both via tokenized customer + payment method |
| Auto-charge for cancellation fees | full | full | Both via charge-saved-card flow |
| One-tap refunds | full | full | Both via refund API |
| Partial refunds | full | full | Both supported |
| Webhook reliability | full | full | Both production-grade |
| Apple Pay / Google Pay | shipped May 7 (deposit flow) | not yet | Stripe wallets enabled at platform level, Payment Request Button mounted on booking page deposit. Square wallets deferred to next session (Web Payments SDK applePay/googlePay APIs, separate effort). |
| Browser compatibility for card form | excellent | good | Stripe Elements supports more browsers including older Safari versions. |

The matrix is the honesty layer. We surface gaps to therapists so they make informed choices, rather than discovering limitations after the fact.

---

## Test mode (Stripe test + Square sandbox)

Path A as scoped May 8, 2026 morning. Lets HK and any future engineer walk every payment flow against test/sandbox keys without paying processing fees.

### Architecture

A single environment variable controls which set of keys the application uses:

- `REACT_APP_PAYMENT_MODE` (frontend, set in Vercel env vars)
- `PAYMENT_MODE` (edge functions, set in Supabase secrets)

Values: `live` (default if unset) or `test`.

Two parallel sets of keys:

| Live env var | Test env var | What it is |
|---|---|---|
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | `REACT_APP_STRIPE_TEST_PUBLISHABLE_KEY` | Frontend Stripe.js init |
| `STRIPE_SECRET_KEY` | `STRIPE_TEST_SECRET_KEY` | Edge function Stripe API auth |
| `STRIPE_CLIENT_ID` | `STRIPE_TEST_CLIENT_ID` | Stripe Connect OAuth |
| `SQUARE_APP_ID` | `SQUARE_TEST_APP_ID` | Square OAuth app id |
| `SQUARE_APP_SECRET` | `SQUARE_TEST_APP_SECRET` | Square OAuth secret |
| `SQUARE_ACCESS_TOKEN` | `SQUARE_TEST_ACCESS_TOKEN` | Square direct API auth |
| `SQUARE_DEFAULT_LOCATION_ID` | `SQUARE_TEST_LOCATION_ID` | Square sandbox default location |

### Key resolution (single source of truth)

Two helper modules centralize the key swap. No file outside these helpers reads payment keys directly from env.

- `src/lib/paymentMode.js` (frontend)
- `supabase/functions/_shared/paymentMode.ts` (edge functions)

Each helper exports an `isTestMode()` function and getters like `getStripePublishableKey()`, `getStripeSecret()`, `getSquareAppId()`, `getSquareAccessToken()`. The getters throw if the appropriate key is missing rather than silently falling back, so misconfigurations surface immediately.

### Safety design

1. **Default is always live.** If the env var is missing, the helper returns the live key. A forgotten env var never silently puts production into test mode.
2. **Test keys live in different env vars.** Live code paths never reference `_TEST` env vars and vice versa. There is no way for a single typo to cross-contaminate.
3. **Throws on missing.** If `PAYMENT_MODE=test` but `STRIPE_TEST_SECRET_KEY` is unset, the edge function throws `'PAYMENT_MODE=test but STRIPE_TEST_SECRET_KEY is not set'` rather than silently falling back to live or hitting Stripe with an empty Authorization header.
4. **Visible UI banner.** When test mode is active on the frontend, a yellow `TEST MODE ACTIVE` banner appears at the top of every page. Hard to miss. Therapists never see this on production because production never has the env var set.
5. **Square auto-detects sandbox vs production.** Sandbox app IDs start with `sandbox-`; the API base URL is derived from the app ID prefix. Setting `SQUARE_TEST_APP_ID` (which starts with `sandbox-`) automatically routes API calls to `connect.squareupsandbox.com`.

### Vercel + Supabase scoping

- **Vercel:** test keys are scoped to **Preview environment only**. Production environment has only live keys. This means production deploys can never accidentally pick up test keys regardless of branch.
- **Supabase:** since the project has only one Edge Function environment, the `PAYMENT_MODE` secret is set ONLY when QA testing. After QA, unset it (or set to `live`). Long-term proper answer is a separate Supabase staging project; deferred until traffic warrants the cost.

### When to use test mode

- Walking the QA checklist (`docs/PAYMENT_QA_CHECKLIST.md`)
- Verifying a new payment feature before live ship
- Onboarding a new engineer who needs to see the flows
- Demoing the booking flow to a potential investor or partner without involving real money

### When NOT to use test mode

- Production traffic. Live therapists charging live clients always uses `PAYMENT_MODE=live` (or unset).
- Never set `PAYMENT_MODE=test` on the production Vercel environment.
- After QA, either unset or set back to `live` on Supabase.

---

## Decision log (billing-specific)

### April 2026
- **Built PaymentProvider abstraction with versioned strategies.** Reasoning: payment systems change rapidly (FedNow, Apple Pay, ACH improvements). Architecture must absorb new providers and new versions of existing providers without breaking edge functions.
- **Square OAuth scope expansion** to include subscription, refund, and customer scopes. Allows full feature parity with Stripe.

### Early May 2026
- **Cancellation policy auto-charge shipped (chunk beta).** Both Stripe and Square handle it. Capability matrix marks both `full`.
- **Per-feature payment routing** introduced. Therapists with both processors connected can route memberships to Stripe (auto-renew), card-on-file to Square (lower fees), etc.

### May 7, 2026 (today)
- **Decided to skip ACH entirely.** Phase 1 (Stripe Payment Element wallet methods, ~1 day build) and Phase 3 (FedNow real-time push when merchant webhooks land in 2027) only.
  - **Reasoning:** ACH liability is real (60-day return window, dispute exposure, NSF returns), customer benefit marginal at $100 ticket size, build cost 3-5 days, and skipping focuses scarce engineering on Phase 1 (near-zero liability).
  - **Trade-off:** We will not be the first in our space to offer bank-direct payments. We accept this. Other rails (FedNow) will be better when ready.
- **Drop Zelle/FedNow Phase 2 framing in favor of single Phase 3.** Zelle has a dealbreaker (no merchant attribution webhooks). FedNow Phase 2 will fix this in 2026-2027.
- **Square activation completed (evening).** First production payment received. BodyMap LLC merchant identity verified by Square. Square card flow now confirmed end-to-end on booking page.
- **Stripe wallets shipped Phase 1 (initial version).** Stripe dashboard confirmed Apple Pay, Google Pay, Cash App Pay, Link, Amazon Pay, Klarna, and Pix all enabled at the platform connected-account level.
  - **Initial implementation (shortcut, removed):** Card Element with Payment Request Button bolted on top for wallets. Worked but mounted two separate elements with separate event flows. Violated the No Shortcuts design principle.
  - **Final implementation (replaced shortcut same night):** unified Payment Element. Single mounted element handles cards plus every payment method enabled at platform level (cards, Apple Pay, Google Pay, Cash App Pay, Link, Amazon Pay, Klarna, Pix). When Stripe enables a new method at the platform level, no code change needed here. The element auto-surfaces methods that work for the visitor's device and region.
  - **Edge function update:** `create-deposit` now uses `automatic_payment_methods[enabled]=true` instead of `payment_method_types[]=card`. PaymentIntent automatically accepts any platform-enabled method.
  - **Submission API:** `confirmPayment` (modern unified) instead of `confirmCardPayment` (legacy).
  - **Redirect handling:** `deposit_return=1` query branch in BookingPage handles the round-trip when Klarna or other redirect methods send the visitor back.
- **Square wallets deferred to next session.** Square Web Payments SDK exposes `payments.applePay()` and `payments.googlePay()` separately and requires building a `paymentRequest` object first. Different code path from Stripe. Will be tackled as a focused follow-up rather than rushed alongside the Square activation that just shipped.

---

## Liability and risk analysis

### Risks specific to current architecture (Stripe + Square)

**Therapist misuse of cancellation policy.**
Therapist sets aggressive policy, charges client without sufficient consent. Client disputes with Stripe/Square. Chargebacks against therapist (we are not the merchant of record). Reputational risk to MyBodyMap.

*Mitigation:* The mandate at booking is explicit, IP-stamped, time-stamped, exact-amount, NACHA-style. Default policy templates are conservative. Therapists must actively opt in to aggressive policies.

**Square activation friction.**
Each therapist must complete squareup.com/activate before charges process. Therapists who do not complete this see "card form failed to mount" errors during testing. Causes confusion and can lead to therapists giving up on Square entirely.

*Mitigation:* Settings → Payments shows clear activation status. Onboarding email tells therapists to complete activation before testing. We recommend Stripe-first for therapists without existing Square relationship.

**Webhook missed or delayed.**
Stripe or Square sends a `payment.updated` event; our edge function fails to receive or process it. Therapist sees "pending" forever or wrong status.

*Mitigation:* Idempotency keys on every state-changing operation. Reconciliation job (Q3) cross-checks platform state against processor state. Webhook retries handled by Stripe/Square; if our endpoint is down, they retry up to 3 days.

**Stripe or Square account suspension.**
Therapist's processor account is flagged for fraud or compliance, charges stop. Client books, payment fails, therapist scrambles to resolve.

*Mitigation:* Dual-processor support means therapist with both can fall back. Capability matrix UI shows which processor handles which feature; suspension on one is recoverable.

### Risks if we add ACH (NOT BUILDING; for reference)

These are documented for the runbook in case the decision is revisited.

- **NSF returns.** Customer's bank lacks funds, ACH yanked back 1-5 days after we told therapist they got paid.
- **Customer disputes / unauthorized return.** Up to 60 days after the transaction.
- **Plaid outage.** Single point of failure for ACH initiation.
- **PII storage.** Plaid handles, but Plaid breach exposes our therapists' clients' bank metadata.

### Risks if we add Zelle/FedNow (Phase 3, future)

- **Match-and-attribute.** Without merchant webhooks, we cannot reliably know payment was received. Zelle dealbreaker today.
- **No reversibility.** FedNow transfers are final on send. Customer fraud risk shifts entirely to the customer's bank to handle.
- **Customer fraud via screenshot.** Customer "sends" $100 (screenshot only), demands service, then disputes Zelle as fraud. We cannot tell if real payment occurred.

*Mitigation when we eventually build:* wait for FedNow merchant webhook standard. Until then, do not build.

---

## Foolproofing principles

These are the architectural rules every payment-related decision must pass through. Lock them in before any future processor or rail is added.

### 1. We never touch the money
SaaS orchestration, never custodian. Stripe / Plaid+Stripe ACH / Dwolla acts as the licensed money mover. Non-negotiable.

### 2. Status truthfulness
"Paid" never means "we are confident the money will not bounce." It means "the funds have settled and the holdback period is over." For ACH this is "pending" for 3-5 business days. For cards this is already the pattern.

### 3. Capability matrix is the honesty layer
Declare gaps, never hide them. UI surfaces limitations to therapists so they make informed choices. The matrix file is normative; if a feature deviates from declared capability, the bug is the feature, not the matrix.

### 4. No dispute is silent
When a chargeback or ACH return fires, the therapist gets immediate notification. They can respond inside MyBodyMap (provide evidence; we relay to Stripe/Square) rather than logging into the processor themselves.

### 5. Refund symmetrically supported on every rail
A rail that can charge but cannot refund cleanly is a half-rail. We do not ship those.

### 6. Authorization mandates explicit and auditable
Mandate text shown verbatim, checkbox required, IP hash stored, timestamp stored, exact amount stored. NACHA requires this for ACH; we already do it for card-on-file.

### 7. Sensible defaults beat exhaustive options
Most therapists do not want to choose a processor or a rail. Default to "card via your connected processor" with one tap. Other options behind a "more options" disclosure.

---

## Competitive analysis (payment methods on therapist platforms)

Last verified April 2026. Re-verify before quoting externally.

| Platform | Cards | Apple Pay / Google Pay | ACH | Card on file | Their processor |
|----------|-------|------------------------|-----|--------------|-----------------|
| **Vagaro** | yes | mobile only | no | yes | Vagaro Pay (Stripe rebrand) |
| **MassageBook** | yes | no | no | paywalled at higher tier | Stripe |
| **GlossGenius** | yes | mobile, limited web | no | yes | GlossGenius proprietary |
| **Acuity** | yes | yes (via Stripe Payment Element) | invoices only | yes | Stripe / Square / PayPal (therapist choice) |
| **ClinicSense** | yes | no | no | paywalled | Stripe |
| **Noterro** | yes | no | no | yes (clunky) | Stripe |
| **Jane App** | yes | mobile in-app only | Canadian Interac only | yes | Stripe + Jane Payments |
| **MyBodyMap (today)** | yes | not yet | no | yes | Stripe + Square (parity) |
| **MyBodyMap (Phase 1, this month)** | yes | yes (auto via Payment Element) | no | yes | Stripe + Square |
| **MyBodyMap (Phase 3, 2027)** | yes | yes | no | yes | Stripe + Square + FedNow |

### Key observations
1. **Nobody offers ACH for solo therapists.** Empty space. We considered and declined for liability reasons.
2. **Apple Pay / Google Pay coverage is patchy.** Stripe Payment Element gives Acuity full coverage; others lag. Phase 1 puts us at Acuity's level.
3. **Card-on-file is universal but variably surfaced.** Some platforms paywall it (MassageBook, ClinicSense). Ours is Silver tier ($19/mo) which is the lowest paid tier — close to free for the value provided.
4. **No one ships dual-processor parity.** This is genuine differentiation.

### What modern SaaS leaders do (Stripe Payment Element pattern)

Stripe Payment Element ships a single embeddable component that **dynamically reorders payment methods based on the customer's signals**:
- iOS Safari with Apple Pay configured → Apple Pay shows first
- Desktop with no wallets → card form shows first
- Different locales surface region-specific methods (SEPA in EU, etc.)

Almost every modern SaaS uses this: Notion, Figma, Linear, Vercel, Anthropic itself. The merchant doesn't choose; Stripe chooses per customer.

**This is what Phase 1 unlocks for us.** We enable wallet methods on the existing Stripe Payment Element. Apple Pay and Google Pay automatically surface for the customers whose devices support them. Card form remains for everyone else. The 70-year-old persona never sees more options than she needs. The 30-year-old with Apple Pay gets one-tap checkout. We configure nothing per-customer; Stripe handles the demographic split.

---

## Three-phase roadmap

### Phase 1: Wallet methods via Stripe Payment Element
**Ship date:** This month (May/June 2026)
**Build cost:** ~1 day
**New liability:** None. Wallet methods are still card payments under the hood.

**What changes:**
- Stripe Payment Element ships with `wallets: { applePay: 'auto', googlePay: 'auto' }` enabled
- Apple Pay button appears on iOS Safari devices automatically
- Google Pay button appears on Android / Chrome with G Pay set up
- Stripe Link surfaces if the customer has it configured
- Card form remains the foundation

**What stays the same:**
- Therapist configures nothing new
- Square parity preserved (we will explore Square Web Payments SDK wallet enablement separately)
- Same fees, same processor relationship

### Phase 2: SKIPPED
**Originally planned: ACH via Plaid Link**
**Decision May 7, 2026: skip.** Liability outweighs benefit. Engineering capacity goes to Phase 3 readiness instead.

### Phase 3: Real-time bank push via FedNow
**Ship date:** 2027 (waiting for FedNow merchant webhook rollout)
**Build cost:** 3-5 days when ready
**New liability:** Lower than ACH. FedNow transfers are final on send, no return window. Customer fraud risk shifts to customer's bank.

**What changes:**
- "Other ways to pay (lower fees)" disclosure appears after card form
- Tapping it reveals "Real-time bank payment" option
- Customer confirms in their bank app, money arrives in seconds
- Almost zero fees ($0.05 per transaction)
- Settles immediately, no holdback period

**What stays the same:**
- Default UI for the 70-year-old persona is identical to Phase 1
- Card form still primary
- Therapist still configures nothing new

**Why we wait:**
- FedNow merchant webhook standard is being rolled out by Federal Reserve in 2026-2027
- Without webhooks, we cannot reliably attribute incoming payments
- Building before the standard is mature would create technical debt

---

## Required environment

For the payment system to work, these env vars must be set in Supabase Edge Function secrets:

| Variable | Source | Notes |
|----------|--------|-------|
| `STRIPE_SECRET_KEY` | Stripe dashboard | NOT `STRIPE_API_KEY`; naming matters |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks page | One per webhook endpoint |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect settings | For OAuth flow |
| `SQUARE_APP_ID` | Square Developer Dashboard | NOT `SQUARE_APPLICATION_ID`; naming matters |
| `SQUARE_APP_SECRET` | Square Developer Dashboard | For OAuth |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square Developer Dashboard | One per webhook subscription |
| `SUPABASE_URL` | Supabase project | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project | Auto-set by Supabase |

All env vars are also documented in `ENVIRONMENT.md` at repo root.

---

## What to do if billing breaks

### "Stripe payments stopped working"
1. Check Stripe dashboard for platform-level alerts
2. Check Vercel deploy log for recent edge function changes
3. Check `_shared/providers/stripe.ts` for recent diff
4. Verify `STRIPE_SECRET_KEY` is current
5. Check therapist's `stripe_account_connected` field
6. Check capability matrix: did a feature change capability declaration?

### "Square payments stopped working"
1. **First check: did the therapist complete squareup.com/activate?** Most "Square broken" issues are activation-related.
2. Verify `SQUARE_APP_ID` env var (NOT `SQUARE_APPLICATION_ID`)
3. Check therapist's `square_connected` and `square_access_token` fields
4. Check Square dashboard for OAuth scope list (must include all 11 scopes)
5. Check `_shared/providers/square/v1.ts` for recent diff

### "A specific feature works on Stripe but not Square"
1. Check capability matrix in `square/v1.ts`. Is the feature declared `full`, `limited`, or `unsupported`?
2. If `limited`, the UI should already show a warning to the therapist. Check `Dashboard.js` Settings → Payments section.
3. If the feature is declared `full` but failing, check the strategy implementation.

### "A refund failed"
1. Identify the original processor (look at `processor` field on the purchase record)
2. Refund must go through the same processor as the original charge
3. Check the processor's API for the specific error code
4. Common causes: original charge already refunded (check status), refund amount exceeds original (check math), processor account suspended (check dashboard)

### "Capability matrix declarations are out of sync"
The matrix lives in each strategy file. If reality differs from the declaration, fix the strategy or update the declaration. Do not let them drift; the matrix is the honesty layer for therapists.

---

## Future open questions

These will need to be revisited as the product evolves. Logging here so they are not forgotten.

### Should we build payment reconciliation as a Q3 feature?
Therapists need to know "did I actually get paid for the work I did this month?" Comparison view of Sessions Done vs Should Have Earned vs Actually Received. Surface discrepancies (failed charges, missed deposits, silent membership lapses).

Tracked as BLOCK_PLAN entry #10. Build cost 3-5 days. Trigger to scope properly: Q3 2026 after at least 30 days of production data.

### Should we ever offer insurance billing?
Currently no. We are built for cash-pay. Adding insurance billing would be a major scope change (HIPAA requirements, claims submission, EOB processing, denials management). Not on roadmap.

If a therapist needs insurance billing, Jane App is probably the right answer for them.

### Should we ever offer corporate / wellness program billing?
Some therapists have B2B relationships (chiropractor referrals, corporate wellness contracts). Currently we do not have invoicing for organizational customers; everything assumes individual client.

Could be a future expansion. Not on roadmap.

### Should we eventually offer our own white-label processor?
No. Even at scale. Becoming a money transmitter is a bad business for us. Stripe / Square handle this expertly.

### Should we add support for international processors?
Currently US-only. Stripe supports many countries; Square is more limited. If we expand to Canada, UK, Australia, we would add region-specific processor strategies (e.g. Stripe with regional features, or Square in Canada/UK).

Not on roadmap. Trigger to scope: when first international therapist asks.

---

---

## Stripe Connect architecture (added May 16 2026)

This section documents the Stripe Connect implementation in full so any future engineer (or future Claude) can understand the system without reverse-engineering it. The implementation evolved through several painful debugging sessions; this is the authoritative current state.

### Two account types we support

We offer therapists two ways to connect Stripe:

**1. Standard Connect (primary, recommended for most therapists).**
Therapist links their EXISTING Stripe account via OAuth. They keep ownership, their transaction history, their saved customer cards, their tax forms. We get API permission to charge/refund/payout on their behalf using the Stripe-Account header. This is the path comparable SaaS (MassageBook, Vagaro, Jane App, Calendly) use.

**2. Express Connect (fallback, for therapists with no Stripe account).**
Stripe Connect creates a NEW Express account that lives partly under our platform. Therapist completes Stripe's hosted onboarding (5-10 minutes). The account is owned by our platform; therapist gets a limited Express dashboard view. They can charge and receive payouts but the account is not portable to other platforms.

### When each is used

Settings page Payments section shows BOTH paths visible from the start. No disclosure-hidden choice. Primary purple button is Standard. Below an OR divider is the Express button. The Express explainer line is crucial:

> Pick this if you are new to Stripe, OR if your existing Stripe account was set up by another booking platform and you do not see it in the screen above. Five-minute setup.

The "set up by another booking platform" line addresses the edge case where a therapist has an Express account from MassageBook or similar that will not appear in our Standard OAuth picker (Express accounts are owned by the platform that created them and not listable elsewhere).

### Database schema

```
therapists.stripe_account_id        text        ID of the Stripe account (acct_xxx)
therapists.stripe_account_connected boolean     True when account is fully ready
therapists.stripe_account_ready_at  timestamptz Stamped when all readiness checks pass
therapists.stripe_account_type      text        'express' or 'standard'
```

The downstream code (charge-card, create-deposit, refund flows, all subscription/membership/package logic) is account-type AGNOSTIC. It uses `Stripe-Account: ${stripe_account_id}` header for every Stripe API call. Stripe processes the call identically whether the underlying account is Express or Standard. The type matters only at the connection / management flow level.

### Edge function: supabase/functions/stripe-connect/index.ts

This is the central edge function for Stripe Connect operations. Actions:

- `get_oauth_url`: Express flow. Creates a brand new Express account ONLY if no enabled matching account exists for this therapist's email under our platform. If a match exists, reuses it (returns `reused_existing: true`). New accounts are tagged with the therapist's email so future reconnects can match them.
- `get_standard_oauth_url`: Returns the Stripe OAuth authorize URL for Standard Connect. Requires `STRIPE_CLIENT_ID` to be set to a valid platform OAuth client ID.
- `complete_standard_oauth`: Exchanges OAuth code for the connected account ID. Stamps the therapist row with type='standard' and the account ID. Returns success or 'standard_account_incomplete' status.
- `resume_onboarding`: Generates a fresh Account Link for an existing Express account so the therapist can resume hosted onboarding where they left off. CRITICAL: does not create a new account. Fixes the disconnect-reconnect orphan-account loop.
- `confirm_connected`: Called by Express callback. Verifies charges_enabled / payouts_enabled / details_submitted via Stripe API. Flips connected flag based on actual Stripe state, not a guess from query params.
- `diagnose`: Returns the raw Stripe account state including requirements_currently_due, requirements_past_due, disabled_reason. Used by /founder Stripe Debug page.
- `list_platform_accounts`: Lists every Express account under our Connect platform (cap 100). Used by /founder Stripe Debug.
- `attach_account`: Manually link a specific Stripe account ID to a therapist row, used as escape hatch from /founder Stripe Debug.
- `get_transactions`: Returns real transaction history for a therapist's connected account.

### Critical environment variables

```
STRIPE_SECRET_KEY            Live mode secret key (sk_live_xxx)
STRIPE_TEST_SECRET_KEY       Test mode secret key (sk_test_xxx) - only used if PAYMENT_MODE=test
STRIPE_CLIENT_ID             Live Connect platform OAuth client ID (ca_xxx)
STRIPE_TEST_CLIENT_ID        Test Connect platform OAuth client ID (ca_xxx) - test only
PAYMENT_MODE                 'live' (default) or 'test'
```

The Standard Connect OAuth requires STRIPE_CLIENT_ID to be set to a non-placeholder value. Test mode and live mode have SEPARATE Client IDs registered in Stripe Connect settings. Mixing them produces the symptom 'select an account screen does not show my expected accounts' (you would see only test-mode accounts when live mode was expected, or vice versa).

### Stripe Connect settings requirements

These must be configured in the Stripe Dashboard at `https://dashboard.stripe.com/settings/connect` for everything to work:

1. Enable OAuth (toggle, defaults off for new platforms)
2. Add redirect URIs:
   - `https://www.mybodymap.app/dashboard/stripe-connect` (Express callback)
   - `https://www.mybodymap.app/dashboard/stripe-connect-standard` (Standard OAuth callback)
3. The Client ID shown on that page goes into `STRIPE_CLIENT_ID` env var in Supabase edge function secrets
4. If using both test and live: the test Client ID and live Client ID are different. The Stripe dashboard mode toggle (top-left) switches which one is displayed. Use the live Client ID for `STRIPE_CLIENT_ID` and the test Client ID for `STRIPE_TEST_CLIENT_ID`.

### Test mode vs live mode awareness

Stripe Dashboard has a mode toggle in the top-left. EVERY view, EVERY page, EVERY data set in the Stripe Dashboard is scoped to whichever mode you are currently in. Accounts created in test mode are not visible in live mode and vice versa.

When opening `dashboard.stripe.com`, you land in whichever mode you were last in. If you tested OAuth in test mode and then look for "your accounts" in live mode, you will not see them.

Symptom: 'select an account screen does not show my expected accounts' often means mode mismatch.

Best practice: when grabbing the Client ID for `STRIPE_CLIENT_ID`, FLIP TO LIVE MODE in Stripe Dashboard first. That ensures you copy the live Client ID and not the test one.

### Recovery flows

Two main recovery surfaces, both in /founder Stripe Debug:

**Account stuck in onboarding_incomplete** (Express path that did not finish):
- Tap Resume Onboarding
- Stripe shows the remaining required fields
- Complete them
- Stripe redirects back, connected

**Therapist has multiple Express accounts under our platform** (the "31 orphaned accounts" problem):
- Tap Load list in Platform accounts panel
- Find the row with the verified Enabled status that matches the therapist
- Tap Attach
- Row stamped with that account ID, connected flag flipped if account is ready

**Force-set connected** (when Stripe says ready but DB says false):
- Tap Force-set connected button (only appears in this exact disagreement case)
- Updates the DB to match Stripe reality

### Why we have 31 orphan Express accounts in the Connect dashboard

Earlier versions of the Connect button created a brand new Express account on every tap, with no check for existing accounts. Disconnect/reconnect produced this proliferation. The architectural fix (May 15 2026) added a pre-check that searches existing accounts by email before creating, so the count stops growing. The 30 historical orphans are inert; they cannot accidentally receive a charge because none are attached to a therapist row. Stripe lets you remove them via the Connect dashboard UI if desired (manual, account by account). Not urgent.

### The "Joy persona" lesson

Earlier code shipped user-facing text like "Email Joy at hello@mybodymap.app" across multiple surfaces (HelpWidget, StripeConnect error page, Help.jsx, FounderDashboard templates). This violated the founding principle: the public persona is "MyBodyMap" / "we" / "the team," never a fictional individual. Joy was purged from all user-facing surfaces in commit `57395d3a`. Demo content with fictional therapist names "Joy" and "Lindsey" stays since those are sample therapist personas, not our brand voice.

**End of Stripe Connect architecture section.**

**End of billing strategy doc.**
