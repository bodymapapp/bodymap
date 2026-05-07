---
id: cancellation-policy
title: How does the cancellation policy work?
category: Payments
order: 2
keywords: cancellation, no show, late cancel, charge, fee, policy, card on file, mandate
taxonomy: 6.2
---

The cancellation policy charges a fee automatically when a client cancels late or no-shows. Set the rules once. The card on file does the rest.

## How it works in plain English

You set up tiers like this:

- **More than 24 hours notice:** No charge. The client just reschedules.
- **Within 24 hours:** Charge fifty percent of the session price.
- **Within 2 hours or no-show:** Charge one hundred percent.

Whatever a client cancels within, the matching tier fires. The card they saved at booking gets charged automatically. You do nothing.

## Setting up the policy

Settings, then Cancellation Policy.

For each tier, you set:
- Hours before the appointment that this tier applies (24, 12, 4, 2, etc.)
- The amount to charge (a percentage or a flat dollar amount)
- The label clients see at booking

You can add as many tiers as you want. Three is normal. Four or five is fine if your situation is more nuanced.

## What clients see at booking

Before they confirm a booking, clients see your tiers in plain English on the booking page. They tap a checkbox to agree, which records:

- The exact policy text they agreed to
- The timestamp of agreement
- Their IP address
- The amount that may be charged

This is your audit trail if a client ever disputes a charge.

## When the charge fires

The system watches the appointment time. When the client cancels (or fails to show), it checks:

1. Was the cancellation within a tier? If yes, fire the charge.
2. Is there a card on file for this client? If no, mark as "policy applies but no card to charge" and notify you.
3. Charge the card via your payment processor (Stripe or Square).
4. Record the charge in the client's history and your billing dashboard.

## Overriding a charge

If a client has a real reason (medical emergency, family crisis), you can void the cancellation charge in the client's session history. Click the session, then Refund or Void. The fee stays voided and you can add a note explaining.

## Disputes

If a client disputes the charge with their bank, you have the audit trail. Ninety percent of disputes lose if the merchant has a clean signed mandate, which is what we collect. Five percent of disputes still go to the client because of bank policy. You write off those rare cases.

## Should you have a cancellation policy?

The honest answer: yes, but only after a few months on the platform. Run it loose at first. Once you have data on which clients cancel most, calibrate the tiers to match the cost of those cancellations.

Common starting policy: 0 percent more than 24 hours, 50 percent within 24 hours, 100 percent for no-show.

## Related articles

- How does card on file work?
- How do I refund a charge?
- What if a client cancels at the last minute for a real emergency?
