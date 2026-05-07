---
id: card-on-file
title: How does card on file work?
category: Payments
order: 4
keywords: card on file, save card, payment method, future, automatic, mandate
taxonomy: 6.6
---

Card on file means your clients save a credit card during booking that you can charge later if the cancellation policy fires. The client agrees to this in writing, you have an audit trail, and the charge happens automatically when needed.

## What clients see

When a client books an appointment, the booking page shows them:

1. The session and price
2. The cancellation policy in plain English
3. A field to save a card

They tap a checkbox that says something like: "I authorize MyBodyMap to charge this card according to the cancellation policy above." This is the legal mandate.

If they decline to save a card, you can decide whether to require it (no booking without a card) or allow it (booking proceeds, but no card to charge if they cancel late).

## What you see

In the client's profile, you see:

- Last four digits of the card on file
- Card brand (Visa, Mastercard, etc.)
- Expiration date
- Date the card was added
- The exact policy text they agreed to
- Their IP address and timestamp of agreement

This is everything you need to win a chargeback dispute if it ever comes to that.

## When the card gets charged

Three scenarios:

1. **Cancellation policy triggers.** Late cancel or no-show, the policy charges automatically.
2. **You manually charge.** Click the client's profile, click Charge card, enter amount and reason. Useful for retroactive charges, custom services, or one-off purchases.
3. **Future bookings.** If the client books again later, they can use the saved card without re-entering details.

## Updating an expired card

Cards expire. When a card is within 60 days of expiring, MyBodyMap shows a yellow warning on the client's profile. The client gets a friendly email asking them to update the card on file.

If a card actually expires before being updated, the next charge attempt will fail. You get notified and can either email the client manually or void the cancellation charge.

## Removing a card

A client can remove their card on file at any time by visiting their account page or asking you to remove it. Their existing bookings stay valid. New bookings may require them to save a card again depending on your settings.

## Privacy and security

We never store full card numbers. Stripe and Square handle the card details directly; we only store the last four digits and the processor's token. This means even if our entire database leaked, no card information would be exposed.

## Why some competitors paywall this

MassageBook and a few others put card-on-file behind a higher paid tier. We do not. It is on every plan including Bronze. Card-on-file is the foundation of the cancellation policy and we believe both should be table stakes, not premium.

## Related articles

- How does the cancellation policy work?
- How do I refund a charge?
- What happens if a client's card expires?
