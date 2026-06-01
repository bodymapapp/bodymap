# Tonight's Test Script (May 31 2026)

Walks every Square + Stripe + notification path using the 8 bookings I seeded for you.

**Time:** 30 min if everything works, 45-60 min if you find bugs to log.
**Email to watch:** `bodymap01@gmail.com` (both clients use it, so all notifications land in one inbox)

---

## Pre-flight

**Confirm webhook is live** (you set this up earlier tonight). Open Square Dashboard → Webhooks (Production tab) → "MyBodyMap payments" row → should show **Enabled**.

**Both processors must be live:**
- Joy Demo = Square only (Stripe must be disconnected on her)
- TherapistBM1 = Stripe only

If they're not in that state, you'll get strange routing.

---

## Section A — Square (Joy Demo, business "Healing Hands")

Log in as `bodymapdemo@gmail.com` → go to Schedule → look for the bookings dated **June 5-6** with notes starting `[TEST-NIGHT-MAY31] SQ-`.

### A1. Square — Charge new card ($5)
Booking: **June 5, 9:00 AM** (note: `SQ-CHARGE`)

1. Open the booking → tap **Charge**
2. Tap **Enter new card** → Square card form loads
3. Enter card: `4111 1111 1111 1111`, `12/30`, `123`, `12345`
4. Change amount to **$5.00**
5. Tap **Charge $5.00**

**Check:**
- [ ] Modal lands on "Paid" success screen
- [ ] Side panel pill flips to green **PAID**
- [ ] Open `bodymap01@gmail.com` — receipt email arrives, method reads **"Square card"** (not "Other")
- [ ] In Square Production dashboard → Transactions: a $5 payment appears within ~30 sec

❌ If method label reads "Other" → notify-payment-event method-label mapping didn't deploy. Tell me.

### A2. Square — Send pay link
Booking: **June 5, 11:00 AM** (note: `SQ-PAYLINK`)

1. Open booking → **Checkout** → **Send pay link**
2. Pick **Email** delivery → Confirm
3. Open `bodymap01@gmail.com` in same browser → tap **Pay** button in the email
4. Pay with `4111 1111 1111 1111` on Square's hosted page
5. **Tap "Return to merchant"** on the success screen (this tests the redirect-back path)

**Check:**
- [ ] Land on MyBodyMap `/pay-thanks?sp=...` — shows "Payment confirmed"
- [ ] Side panel pill flips to **PAID**
- [ ] Receipt email arrives

### A3. Square — Webhook auto-flip (the v1.1 fix)
Same booking flow as A2, but a different booking.

Use **June 5, 11:00 AM** if you haven't already (or pick any unpaid one). If A2 already paid SQ-PAYLINK, create a new ad-hoc test by sending another pay link to Joy Client through another June 6 booking.

1. Send pay link → open email → tap Pay → pay with test card
2. **CLOSE the Square tab IMMEDIATELY after seeing "Payment complete"** — do NOT tap Return to merchant
3. Wait 30 seconds
4. Refresh Joy Demo's schedule

**Check:**
- [ ] Booking still flipped to **PAID** even though you never returned to /pay-thanks
- [ ] Receipt email arrived
- [ ] In Supabase → Edge Functions → Logs → `square-payment-link-webhook` → there's a log entry from when you closed the tab

❌ If row stayed `pending` → webhook didn't fire OR signature verification failed. Check the function logs for what happened.

### A4. Square — Refund
Booking: **June 6, 9:00 AM** (note: `SQ-REFUND`)

1. First charge $5 via Enter new card (same flow as A1)
2. After the charge succeeds, the paid row shows a **Refund** button — tap it
3. **The modal should say:** "Refund $5 to Joy Client?" with subtext **"Square returns the full amount to the client's card in 5 to 10 business days. This cannot be undone."**
4. Tap **Refund full $5**

**Check:**
- [ ] Side panel pill flips from PAID to **REFUNDED**
- [ ] In `session_payments` table for this booking: `status='refunded'`, `square_payment_id` populated
- [ ] Refund receipt email arrives at `bodymap01@gmail.com`
- [ ] In Square dashboard → the refund line appears against the original $5 payment

❌ If modal says "platform will mark it refunded" with the offline copy → RefundModal didn't get the fix. Hard-reload and try again. If still wrong, tell me.

### A5. Square — Notification on edit (NEW today)
Booking: **June 6, 11:00 AM** (note: `SQ-EDIT`)

1. Open booking → tap the service name (currently "Swedish 60min") → change to **"Sports 60min"**
2. Tap **Save**

**Check:**
- [ ] Receive an email at `bodymap01@gmail.com` with subject **"Your Sports 60min on Saturday, June 6 was updated"**
- [ ] Body says **"The service changed. Same date and time."**
- [ ] As Joy Demo, you also receive a notification "Joy Client's booking was updated"

❌ If no email fires → notify-booking-event booking_updated branch not deployed. Tell me.

---

## Section B — Stripe (TherapistBM1, business "Healing Hands BM1")

Log in as `hk5@email.com` → go to Schedule → look for bookings dated **June 7-8**.

### B1. Stripe — Charge new card with save-card checkbox (NEW today)
Booking: **June 7, 9:00 AM** (note: `ST-CHARGE`)

1. Open booking → **Charge** → **Enter new card**
2. Below the Stripe card field: there's a **new checkbox** "Save this card for BM1 Test Client so you can charge it next time without re-entering" — **default checked**
3. Enter card: `4242 4242 4242 4242`, `12/30`, `123`, `12345`
4. Change amount to **$5.00**
5. Leave checkbox checked → tap **Charge $5.00**

**Check:**
- [ ] Modal shows Paid success
- [ ] Side panel pill → **PAID**
- [ ] Receipt email arrives (method reads "Visa 4242" or similar)
- [ ] In Supabase `clients` table → `stripe_customer_id` and `payment_method_id` are now populated on the BM1 Test Client row (proves save-card worked)

### B2. Stripe — Charge the saved card (sanity follow-up to B1)
Open the same booking (or any unpaid booking) → **Charge** → **Charge saved card** (option should now appear because B1 saved one).

**Check:**
- [ ] Saved card option appears with "Visa 4242"
- [ ] Charge succeeds without re-entering card
- [ ] Receipt email arrives

### B3. Stripe — Send pay link + webhook auto-flip
Booking: **June 7, 11:00 AM** (note: `ST-PAYLINK`)

Same flow as A2 but on Stripe. Send the link, open in incognito, pay, return to /pay-thanks.

**Check:**
- [ ] Same as A2, but the receipt method reads Stripe card brand, not Square

### B4. Stripe — Refund (sanity check the untouched path)
Booking: **June 8, 9:00 AM** (note: `ST-REFUND`)

1. Charge $5 via Enter new card (B1 flow)
2. Tap **Refund** on the paid row
3. Modal says "Refund $5 to BM1 Test Client?" with **"Stripe returns the full amount…"** (now says Stripe, not the generic copy)

**Check:**
- [ ] Refund succeeds
- [ ] Pill flips REFUNDED
- [ ] Refund receipt email arrives

❌ If Stripe refund is broken now after today's Square work → critical regression. Tell me immediately.

### B5. Stripe — Notification on edit
Booking: **June 8, 11:00 AM** (note: `ST-EDIT`)

Same as A5 but on Stripe. Change service from "Swedish" to "Deep Tissue". Save.

**Check:**
- [ ] Both you (therapist) and BM1 Test Client (client) get the booking_updated email

---

## Section C — Side panel UX (sanity)

### C1. Date in side panel header
Open any booking in the slide-over.

**Check:**
- [ ] Above the time line you see **the full date** (e.g. "Friday, June 5")
- [ ] Below the date line: small underlined link **"Open as full page ↗"** (slide mode only)

### C2. Duration edit sticks
Take any unpaid booking → tap on the time → change duration from 60 → 90 → Save → refresh page.

**Check:**
- [ ] After refresh, side panel still shows 90 min (not reverting to 60)

### C3. Open as full page
Tap **"Open as full page ↗"** under the date.

**Check:**
- [ ] Routes to `/dashboard/schedule/booking/<id>`
- [ ] Same booking details render as a full page, not a slide-over
- [ ] Back button returns to schedule

---

## Section D — Email notifications coverage

This summarizes which emails the above tests fire:

| Email type | Fired by | Square | Stripe |
|---|---|---|---|
| Payment receipt (Square) | A1, A2, A3 | ✅ should fire | n/a |
| Payment receipt (Stripe) | B1, B2, B3 | n/a | ✅ should fire |
| Refund receipt | A4, B4 | ✅ Square method label | ✅ Stripe method label |
| Booking updated (NEW) | A5, B5 | ✅ | ✅ |

**Not tested tonight** (need real-time-elapsed scenarios):
- 48h reminder
- Cancellation by client / therapist
- No-show recorded
- Reschedule fee
- Lapse nudge

If you want, I can seed bookings dated tomorrow at specific times so the reminder fires within minutes, but that's a separate ask.

---

## When you're done

Either:
- Reply "**all green**" + anything off (UX issues, copy nits) — I file them for tomorrow
- Reply "**X failed**" → paste me which checklist item + any console error → I fix tonight

Cleanup later: all 8 test bookings have notes starting `[TEST-NIGHT-MAY31]` so they're easy to bulk-delete.

```sql
-- run this in Supabase SQL editor when done to delete the test bookings + client
DELETE FROM bookings WHERE notes LIKE '[TEST-NIGHT-MAY31]%';
DELETE FROM clients WHERE id = '2f52750f-76af-43c3-9b5d-ce95f30ca5d0' AND name = 'BM1 Test Client';
```
