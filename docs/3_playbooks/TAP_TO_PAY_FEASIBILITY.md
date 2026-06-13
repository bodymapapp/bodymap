# Tap to Pay feasibility: Square and Stripe

Status: feasibility writeup for Ashley / Puro Glow ask #4 (Jun 13 2026). No code yet. Decision input only.

## Verdict in one line
Square Tap to Pay is feasible now from our current web app with no native app. Stripe Tap to Pay is not, because it requires us to ship our own native iOS/Android app. Build Square first; hold Stripe.

## What Ashley asked for
A "tap to pay" that opens her Square Tap to Pay so payment and her booking update in one place, instead of charging in Square and then updating the platform by hand.

## Why Square works for us
Square has a Point of Sale API with a mobile-web handoff. From the day-of checkout we build a link that opens the therapist's Square Point of Sale app (the app she already uses) prepopulated with the exact amount, a note, our booking reference, and a callback URL pointing back to us. She taps the client's card or phone on her own phone (that is Tap to Pay), Square completes the charge, then switches back to our page via the callback URL carrying a transaction ID. We take that ID, call the Square API to confirm the amount and status, write a session_payments row, and mark the balance paid. One tap, both sides updated. That is exactly her ask.

- Android uses an `intent:` link, iOS uses a `square-commerce-v1://` link. Both are documented.
- Requirements on her side: the Square Point of Sale app installed and logged into the matching location, Tap to Pay enabled.
- Requirements on our side: register our app in Square's Developer Console and set the web callback URL. No native app.

## Why Stripe does not work for us yet
Stripe delivers Tap to Pay only through its Terminal SDK for native iOS, Android, and React Native apps, and it needs an Apple "proximity reader payment acceptance" entitlement attached to the app build. There is no web deep-link into a Stripe app the way Square offers. So Stripe Tap to Pay would force us to build and ship a native app first. Until we have a native wrapper, it is off the table. The merchant can still use Stripe's own Dashboard app to tap-to-pay manually, but that does not tie back to our booking or reconcile on its own, so it does not solve her ask.

## What can break (Square) and how we handle it
- Return handshake. The app switch back to our web page reloads the page, so in-memory state is lost. We pass the booking id as the reference and rebuild state from the callback parameters on return.
- Reconciliation. The handoff returns a transaction id, not full details. We make a follow-up Square API call to confirm amount and status before marking paid. If we cannot confirm, we mark pending and retry, never a false paid.
- iOS vs Android. Different link formats. We build the right one per platform.
- Cancel or failure. Square returns an error code. We show a friendly "not completed" and leave the balance open.
- App missing or logged out. We detect the error and show a one-time "open Square and log in" prompt, never an error page.

## Smallest first version
Square only. One button in the day-of checkout, "Tap to Pay with Square," amount set to the balance we already compute. Callback reconciles and marks paid. No Stripe, no provider toggle yet, because Stripe has no web path to toggle to.

## On the provider toggle you asked for
Worth keeping in the design, but today only Square can be the live option. We would show Square as active and Stripe as "available when we have a native app," or hold the toggle entirely until then. Shipping a toggle with only one working side risks the grayed-out-half-state we avoid, so leaning toward holding it.

## Recommendation
Build the Square handoff as version one. It is feasible now, matches her ask, and needs no native app. Hold Stripe Tap to Pay until we decide to ship a native app. Keep the toggle as a future idea, not in version one.

## Effort (to quote when approved to build)
Square deep link by platform, callback route that rebuilds state, reconcile call, mark-paid through the existing CheckoutModal path, plus Developer Console setup. Estimate provided at build approval.
