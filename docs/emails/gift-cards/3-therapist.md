# Email 3: To Therapist (Revenue Notification)

**Status:** Draft for HK review. NEW email template. Should respect the existing `gift_purchased` notification preference in `NotificationPrefsCard.jsx` (only send if therapist opted in).

## When it sends

On Stripe payment success → immediately. This is real revenue arriving so the therapist should know in real time.

## From

`MyBodyMap <hello@mybodymap.app>`

## Subject line

`🎁 Gift card purchased: ${amount} from {Purchaser name}`

## Body

Simpler than the other two. This is operational notification, not customer-facing copy.

---

```
[Subtle sage header band, "GIFT CARD PURCHASED" eyebrow]

You've received $XX.XX from a new gift card sale.

[Cards section with key info ,  clean rows, no decoration]

Purchaser
{Purchaser name}
{purchaser email}

Recipient
{Recipient name}
{recipient email}

Gift details
Amount        $XX.XX
Code          XXXX-XXXX-XXXX
Design        {Design label}
Message       "{personal message}"
Delivery      Sent now / Scheduled for {date} / Sent to purchaser

, 

The funds are in your Stripe account. Standard
payout schedule applies. Your platform fee for
this transaction was $X.XX.

[BIG SAGE BUTTON: "View in your dashboard →"]
(links to: /dashboard?tab=gift-certificates)

Stripe transaction:
{pi_xxxxxxxxxxxxxxxxxx}

, 

Why am I getting this?
You enabled notifications for gift card purchases.
Update your preferences anytime in your dashboard
under Settings → Notifications.
```

---

## HK to confirm

- [ ] Tone (operational, brief)
- [ ] Show platform fee inline (if we take one)
- [ ] Include Stripe transaction ID for reconciliation
- [ ] Dashboard link target ,  direct to the Gift Certificates section
- [ ] Footer with notification preference link
- [ ] Subject emoji 🎁 ,  keep or remove?

## Build notes

- Respect `therapist.notification_prefs.gift_purchased` array. Email only sent if includes 'email'.
- Future: SMS notification (already in prefs); not building Phase 2.
- Existing infrastructure: `NotificationPrefsCard` already has the `gift_purchased` key. We just need to use it server-side.
