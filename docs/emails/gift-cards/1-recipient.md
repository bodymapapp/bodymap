# Email 1: To Recipient (The Gift Itself)

**Status:** Draft for HK review. The existing `send-gift-certificate` edge function already builds the HTML for this email using the design + theme system. This document is the COPY for HK to approve.

## When it sends

On Stripe payment success → immediately (if delivery=now) OR on the scheduled date (if delivery=scheduled, handled by cron). NOT sent if delivery=self (only the purchaser gets a copy).

## From

`Gift cards from [Therapist Business Name] <gifts@mybodymap.app>`
(Reply-To: the therapist's email so any recipient reply lands with the therapist, not the platform.)

## Subject lines (rotates by design)

- Just Because: `{Purchaser} sent you a moment of care`
- Birthday: `Happy birthday {Recipient} ,  a gift from {Purchaser}`
- Anniversary: `{Purchaser} sent you something special`
- Thank You: `{Purchaser} wanted to say thanks`
- Sympathy: `{Purchaser} is thinking of you`
- Holiday: `A gift from {Purchaser} this season`

## Body structure

The full themed HTML card (existing `send-gift-certificate` function renders this ,  pulls design + theme from the gift_certificates row + therapist defaults). Below the card image:

---

```
[Themed card image with amount, message, code prominent]

Hi {recipient first name},

{purchaser name} sent you a gift from
{therapist business name}.

[Personal message from purchaser, in serif italic]

When you're ready, book your session:

[BIG SAGE BUTTON: "Book your session →"]
(links to: /book/{therapist customUrl}?gift={code})

Your gift code: {code}
(if the button doesn't work, copy this code at checkout)

This card has $XXX in value.

, 

Some notes:
- Your gift never expires.
- You can book any service the therapist offers.
- If the session costs less than your card, the remainder
  stays on your code for next time.
- Need help? Reply to this email and {therapist name}
  will get back to you.
```

---

## HK to confirm

- [ ] Tone and copy feel right
- [ ] "Your gift never expires" ,  confirm we want no expiry default
- [ ] Reply-To set to therapist's email
- [ ] Subject line variants OK
- [ ] Button text "Book your session" OK (alternative: "Redeem your gift")

## Design notes

- All themed colors come from chosen color theme (Rose, Sage, Forest, Ocean, Lavender, Terracotta)
- All design elements (eyebrow text, greeting line, decorations) come from chosen design (Just Because, Birthday, Anniversary, Thank You, Sympathy, Holiday)
- Mobile-responsive single-column layout
- Inline styles only (email clients strip `<style>` blocks)
- Existing render code path: see `supabase/functions/send-gift-certificate/index.ts` lines 218–390
