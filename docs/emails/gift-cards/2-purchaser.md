# Email 2: To Purchaser (Receipt + Confirmation)

**Status:** Draft for HK review. NEW email template, will be a new edge function `send-gift-purchaser-email` or extend the existing one with a `recipient_type` param.

## When it sends

On Stripe payment success → immediately, regardless of delivery option chosen. This is the receipt the purchaser needs for their records and emotional reassurance.

## From

`MyBodyMap <gifts@mybodymap.app>`
(Reply-To: therapist's email so they can field any "I want to change something" requests.)

## Subject line

- If delivery=now: `Your gift to {Recipient} is on its way`
- If delivery=scheduled: `Your gift to {Recipient} is scheduled for {date}`
- If delivery=self: `Your gift for {Recipient} is ready to share`

## Body

---

```
[Card preview at top, smaller than recipient version]

Thank you, {purchaser first name}.

Your gift to {recipient name} for ${amount} from
{therapist business name} is confirmed.

[Status block, bordered]
{If delivery=now}
  ✓ Sent now
  {Recipient name} should receive the gift email
  within the next minute at {recipient email}.

{If delivery=scheduled}
  📅 Scheduled for {scheduled date}
  We'll deliver the gift to {recipient name} at
  {recipient email} on {scheduled date}.

{If delivery=self}
  📬 Sent to you
  Forward this email or print the card below to
  share with {recipient name} yourself. They can
  redeem with the code at any time.

[End status block]

Gift code: {code}
(Keep this somewhere safe. If {recipient name}
doesn't see the email, you can share this code
directly.)

[BIG SAGE BUTTON: "Download a printable copy →"]
(links to: /gift-card/{code}/print)

, 

Receipt
─────────────────────────────
Gift amount       $XX.XX
Total charged     $XX.XX
Payment method    Card ending in XXXX
Transaction ID    pi_xxxxxxxxxxxxx
Date              {Month Day, Year}
─────────────────────────────

This receipt may be useful for tax purposes if
the gift was given for business reasons.

Need to make a change? Reply to this email and
{therapist name} will get back to you. The gift
can be reissued, refunded before redemption, or
have the delivery date adjusted.

, 

About {Therapist Business Name}
{therapist's name} ,  {city/region if available}
{therapist's website link}

Powered by MyBodyMap.
mybodymap.app
```

---

## HK to confirm

- [ ] Tone (warm but professional)
- [ ] Receipt format ,  full transaction ID OK to show?
- [ ] "Download a printable copy" button ,  uses existing GiftCardPrint.js
- [ ] Reply-To routes to therapist (not platform)
- [ ] Tax note acceptable
- [ ] "Powered by MyBodyMap" footer OK or removed?

## Build notes

- Reuse the existing `renderCardReact` to embed the card preview as inline HTML
- Stripe payment intent metadata will include: amount, recipient, purchaser, therapist_id, gift_certificate_id (after row creation)
- The printable URL `/gift-card/{code}/print` already exists via GiftCardPrint.js, no new work
