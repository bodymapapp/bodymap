---
id: where-are-my-stripe-transactions
title: I do not see my transactions in Stripe. Where are they?
category: Payments
order: 2
keywords: stripe, transactions, payments, dashboard, missing, sandbox, test mode, live mode
taxonomy: 6.2
---

The transactions are there. You are probably looking in the wrong mode.

## What is happening

Stripe Dashboard has two modes: test mode and live mode. They show completely different data. Real customer payments only show in live mode. Test transactions only show in test mode.

When you log in, Stripe lands you in whichever mode you were last in. If you ever flipped to test mode (for example, while setting something up or following our setup instructions), Stripe remembers and keeps showing you test mode on every visit.

## The fix

1. Open `https://dashboard.stripe.com`
2. Look at the very top of the page, top-left corner
3. You will see a small toggle that says **Test mode** with a switch beside it
4. **Tap it to turn it off.** The page might show a yellow or amber color when in test mode; that color goes away when you switch to live mode.
5. Now navigate to **Payments** in the left sidebar. Your real transactions appear.

## What if I do not see the test mode toggle?

You might be on the Stripe Express dashboard instead of the standard Stripe dashboard. Express dashboards have a simpler interface and might not show the test/live toggle. In that case, the view you are seeing IS your live mode data; there is no test mode to toggle off.

If you do not see any transactions at all in this view, two possibilities:

1. You have not received any payments yet through MyBodyMap. Once a client books and pays a deposit, the transaction will appear.
2. The view is filtered. Look for any filter dropdowns at the top showing things like "Last 30 days" or specific statuses, and clear them.

## Easier way: view inside MyBodyMap

You do not actually need to log into Stripe at all to see your transactions. Inside MyBodyMap, go to **Billing** in your dashboard. We pull your transaction history directly from Stripe and show it in a simpler view, with your client names attached so you know who paid for what.

This is also the place to refund a charge, view payout history, and see your upcoming payouts to your bank.

## A note on test mode

The only reason to use test mode is if you are practicing or experimenting and do not want real money to move. Some therapists like to test the full booking flow once with test mode on, then switch to live mode for real customers. That is fine. Just remember to switch back.

## Related articles

- What Stripe option should I pick when connecting?
- How do payment processor fees work?
- Stripe or Square? Which should I use?
