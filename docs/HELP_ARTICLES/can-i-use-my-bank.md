---
id: can-i-use-my-bank
title: Can I use my bank to take payments instead of Stripe or Square?
category: Payments
order: 5
keywords: bank, ach, direct deposit, zelle, no fees, payment processor, alternative
---

Short answer: probably not the way you are thinking, but the explanation matters because it saves you confusion.

## How card payments actually work

When a client pays you with a credit or debit card online, the money does not go directly from their bank to your bank. It goes through a payment network (Visa, Mastercard, etc.) that requires a licensed merchant in the middle. Stripe and Square are licensed merchants. Your bank, even though it is a bank, is usually not.

If your bank offers "online payments" as a service, what they are usually doing is reselling Stripe (or another processor) under their own brand. You pay the same fees plus sometimes a small markup the bank keeps. We support Stripe and Square directly which gives you the same thing without the middle layer.

## What about bank-to-bank transfer (ACH)?

ACH (Automated Clearing House) is a real alternative for direct bank-to-bank payments. Lower fees than cards (typically twenty-five cents flat versus 2.9 percent on cards), but slower settlement (one to three business days instead of immediate) and a longer return window (the client can reverse the payment for up to 60 days).

ACH is technically supported by our processors (Stripe has Plaid integration), but we have not turned it on yet because:

1. The 60-day return window creates risk for you. A client could pay, get the session, and reverse the payment two months later.
2. Most clients do not want to type bank routing numbers on their phone for a hundred-dollar massage.
3. The fee savings on a hundred-dollar transaction is about $2.50, which is real but not life-changing.

We may add ACH as an option in the future. If this matters a lot to you, send Joy an email at hello@mybodymap.app and tell us. We track demand.

## What about Zelle, Venmo, Cash App?

These are person-to-person payment apps, not merchant payment systems. They lack the audit trail, refund mechanism, and dispute resolution that merchant processors provide. Some therapists use them informally for tips or product sales. We do not integrate them because they cannot handle cancellation policies, refunds, or disputes the way merchant processors do.

## What about FedNow real-time payments?

FedNow is a new real-time payment system from the Federal Reserve. As of 2026 it is live but not widely available for merchant transactions yet. We are watching it. When it becomes practical for merchant payments (probably 2027), we will add it. It would offer near-zero fees and instant settlement.

## What about Apple Pay and Google Pay?

These ARE supported. They run on top of Stripe and Square; they are not separate processors. When a client uses Apple Pay or Google Pay at booking, the same Visa or Mastercard fees apply, but the client experience is faster and the fraud rate is lower (Apple Pay is essentially never disputed). We are turning these on in 2026 for all therapists.

## The bottom line

Use Stripe or Square. They are the right tool for the job at MyBodyMap's scale. If you specifically need ACH or alternatives later, message us and we will track demand.

## Related articles

- Stripe or Square? Which should I use?
- How do payment processor fees work?
- Why are credit card fees so high?
