# HANDOVER : May 17 2026 EOD

## What this is
End-of-marathon-session handover. Today: **23 commits**, ~13 hours, mostly modal-money + Smart Billing. Real progress, but ended mid-debug on Phase 14.3b verification with 4 unresolved issues. Tomorrow starts here.

---

## OPEN ISSUES (start here tomorrow)

### 1. Custom chip CSS broken (Phase 13.8.3 follow-up)
**Symptom:** Tapping Custom in CheckoutModal makes the chip green but the `0%` input overlaps with `$0.00` text in the same chip container. iOS spell-check selection circles visible around broken layout.

**Root cause:** In `CheckoutModal.jsx` AmountRow Custom chip, the percent input (width 32px) sits next to a `%` symbol AND the `$X.XX` amount is rendered in the same flex container. They collide.

**Fix needed:** Either (a) hide the $ display when in edit mode (only show $ once user types), or (b) restructure to vertical layout : input on first line, $ amount on second line, both visible. Probably (b) since it matches the visual treatment of the other preset chips.

**Files:** `src/components/CheckoutModal.jsx` lines ~717-787 (Custom chip render)

### 2. Refund webhook didn't catch HK's Stripe Dashboard refund
**Symptom:** HK refunded $1 via Stripe Dashboard AFTER configuring the webhook. Hero didn't update.

**Possible causes (in order of likelihood):**
1. **Webhook URL has wrong Supabase project ref** : HK said "I wonder if I used the supabase project ID correctly"
2. **Wrong scope selected** : HK must have selected "Connected accounts" not "Your account" because therapist refunds happen on connected accounts (Stripe Connect)
3. **`STRIPE_REFUND_WEBHOOK_SECRET` env var name typo or wrong value**
4. **Signature verification failing silently** : function logs would show this

**Debug steps tomorrow:**
- Have HK go to Stripe Dashboard → Developers → Webhooks → click the endpoint → check "Webhook attempts" log
- If no attempts: webhook config wrong (URL/events/scope)
- If attempts with 4xx/5xx: function rejected the call. Check Supabase Function logs for `[stripe-refund-webhook]`
- If attempts with 2xx but no DB change: payment_intent_id mismatch or column name issue

**Fallback:** Run the backfill function manually for HK's existing refunds (Step 4 below).

### 3. No "Refund" button visible to HK
**Symptom:** HK reports no Refund button visible in Billing weekly view (where there's a $1 Card payment) AND no Refund button visible on the slide-over for a Cash-paid booking.

**Two separate issues:**

**(a) Slide-over:** Cash payment correctly hides Refund (my code: `method.startsWith('stripe_')`). But UX is wrong : therapist has no path to mark cash refunded. **Need an "offline refund" flow** that just flips status='refunded' locally without calling Stripe.

**(b) Billing weekly:** A $1 Card payment should show Refund underlined link. Need to confirm with HK:
- Did they scroll past the StatCards to the session list? Possibly just didn't scroll.
- Or: the deploy hadn't propagated when they tested (Vercel + GitHub Actions, both pending at screenshot time)
- Or: my condition is wrong for some other reason : but the code logic looks right

**Files:** 
- For (a): `src/components/ScheduleDashboard.js` ~paid state render
- For (b): `src/components/BillingDashboard.js` SessionRow + the 4 views

### 4. DailyView has no Prev/Next date navigation
**Symptom:** Daily view uses a 5-day chip strip (-2,-1,0,+1,+2) only. Can't navigate further back/forward.

**Fix:** Add Prev/Next buttons matching WeeklyView pattern. WeeklyView/MonthlyView/YearlyView all have them; Daily is the outlier.

**Files:** `src/components/BillingDashboard.js` line ~445 DailyView function, ~447 dayOffset state.

---

## TODO LIST (priority order)

| # | Item | Effort | Notes |
|---|---|---|---|
| 1 | Debug refund webhook reception | 15 min | Stripe Dashboard webhook attempts log + Supabase function logs |
| 2 | Fix Custom chip CSS layout | 15 min | Restructure to vertical: input then $ amount |
| 3 | Add Prev/Next nav to DailyView | 10 min | Match WeeklyView pattern |
| 4 | Run backfill for HK's existing 3 refunds | 5 min | curl command in docs below |
| 5 | Offline refund flow for cash/Venmo/etc | 30 min | New mini-modal: "Mark this as refunded?" → status='refunded' locally |
| 6 | Verify in-app refund button (Step 2 + Step 3) | 10 min | Once deploy propagates, screenshot both |
| 7 | Partial refund support (track refund_amount_cents) | 30 min | Schema column + edge function param + hero display |
| 8 | SMS production blockers (A2P 10DLC, STOP/HELP, status callbacks) | 60-90 min | Macros #11, #12, #13 from compliance dashboard |
| 9 | Phase 14.4 Insights tab data swap | 60 min | Replace fictional CSV with real data |
| 10 | Phase 14.5 per-row inline expand on Smart Billing | 45 min | Click row → expanded details (method detail, tip, dispute status) |

---

## TODAY'S 23 COMMITS

| # | Hash | Phase | Description |
|---|---|---|---|
| 1 | e8af4195 | 13.1 | Helper: ensure_client_for_booking |
| 2 | bfeddd6c | 13.2 | Wire helper to BookingPage flow |
| 3 | 32436c50 | 13.3 | Backfill orphaned bookings + FK constraint |
| 4 | 964c2032 | 13.3 | Remove old client_id workaround |
| 5 | 47f575ae | 13.4 | More client_id cleanups |
| 6 | 8fa20e29 | 13.5 | card_last4 self-heal via get-payment-method edge function |
| 7 | 479257bc | minor | Share booking link button positioning |
| 8 | 135ee964 | 13.6 | No-show fee paths (label + send-link + inline card entry) |
| 9 | b8b1a628 | 13.6 | 4 column-name bug fixes (`stripe_payment_method_id` → `payment_method_id`) |
| 10 | 5cb85926 | 13.6 | Cancellation modal link_sent step |
| 11 | a4637af5 | 13.7 | Checkout amount/tip/delivery picker UX |
| 12 | 3251486c | 14.1+14.2 | Smart Billing data layer rewrite + HeroPayCard |
| 13 | 1e70708e | 14.3 | Cancellation + refund + no-show in hero |
| 14 | 3e595f18 | minor | Stripe link generation columns fix |
| 15 | d54cdb37 | minor | Floating button positioning |
| 16 | 3dc7a6e3 | minor | get-payment-method edge function |
| 17 | 31ae2f52 | 13.7 | Checkout iteration based on HK feedback |
| 18 | c8937079 | 13.8 | Five-fix combo: link error, Custom chip, fee override, slide-over redesign, no-show fee best practice |
| 19 | ed81099b | 13.8.1 | Modal overlay z-index 1000 → 1100 (above MobileBottomNav) |
| 20 | f4a08694 | 13.8.2 | 100dvh for iOS Safari modal viewport |
| 21 | a7ddfddf | 13.8.3 | Custom chip becomes inline percent input on tap |
| 22 | bab53c7a | 14.3a | stripe-refund-webhook + backfill-stripe-refunds edge functions |
| 23 | ee611171 | 14.3b | In-app refund button (Smart Billing + slide-over) + RefundModal + refund-session-payment edge function |

---

## ARCHITECTURE STATE

### What's wired end-to-end and verified working
- Client autocreation on booking with FK constraint
- Checkout modal: card-on-file ($1 charge verified)
- Mark as paid modal (HK confirmed footer works after 13.8.2)
- 100dvh modal viewport fix
- card_last4 self-heal on modal reopen
- No-show fee modal with editable amount + best practice hint
- Cancellation fee inline card entry
- Smart Billing hero data layer (HK sees $3 collected, $1 refunded, 3 no-shows)
- Tip chip with Custom percent inline input

### What's wired but unverified
- stripe-refund-webhook (env var configured, webhook URL configured per HK, but didn't fire on test refund)
- backfill-stripe-refunds (deployed, never invoked)
- refund-session-payment edge function (deployed, HK reports button not visible)
- RefundModal component (deployed, HK reports button not visible)

### Known limitations / shortcuts to fix
- **Partial refunds:** edge function accepts `refund_amount_cents` and passes to Stripe, but local row always flips to status='refunded' (no partial tracking)
- **Cash refunds:** no UI flow, therapist would have to use SQL or wait for offline-refund feature
- **DailyView:** chip strip only, no prev/next
- **Insights tab:** still on fictional CSV data (Phase 14.4 pending)

---

## KEY DESIGN PRINCIPLES (HK's, called out today)

1. "Make it world class"
2. "Don't take actions against our design principles"
3. **"Use the right architecture every time. No shortcuts"** (called out re: SQL workaround for refunds)
4. "Give me exactly what I need to do"
5. "We are going in circles. Solve it now"
6. "A client should be created at that time and then everything connects to that client ID"
7. "Look into our competition, top 5 web and mobile platforms and make it differentiated"
8. **Em dash NEVER. Colons instead.**
9. **Copy at 10th grade reading level**
10. **"Platform" not "tool"**
11. **Retention-first framing**
12. **"Provide an option to the therapist to override"** (best practices + override on fee)
13. **"I want you to be empathetic but I will let you know when I am done. We can not take shortcuts."** (after catching refund webhook gap)
14. **"As a design principle, provide a mapping to the right field which you did. But provide an option to the therapist to override it."**

---

## TEST ACCOUNTS

**Joy Therapist (bodymapdemo):**
- Email: `bodymapdemo@gmail.com`
- ID: `2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`
- Business: Healing Hands
- Twilio: +15136133033 (platform line, doubled as Joy's simulated BYO for testing)
- custom_url: healinghands

**Joy Client (bodymap01) : canonical:**
- Email: `bodymap01@gmail.com`
- ID: `ce205279-3800-4335-b1c7-0b5ad1092a14`
- Stripe customer: `cus_UWoz3g5eIIDER9`
- Payment method: `pm_1TY3hJQvokGFD9FYC2gTM3fJ`

**Joy Client duplicate (queued for cleanup):**
- ID: `e3255b26-4e94-42ab-993f-84eee41ede3f`
- Same email, unreferenced after orphan repair

---

## ENV VARS / SECRETS

Configured today in Supabase Edge Functions:
- `STRIPE_REFUND_WEBHOOK_SECRET` ✓ HK added

Already existed:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (live mode active)
- `STRIPE_WEBHOOK_SECRET` (for stripe-payment-link-webhook)

---

## BACKFILL COMMAND

After webhook is verified working:

```bash
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/backfill-stripe-refunds" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"therapist_id": "2a2886c3-00f2-4c6f-aaec-4b8150c61fcf"}'
```

Returns `{ scanned: N, refunded: M, errors: [] }`.

---

## VERIFICATION CHECKLIST FOR TOMORROW

When picking up:

1. [ ] HK confirms Vercel deploy `ee611171` is live (check bundle hash)
2. [ ] HK refunds a fresh $1 charge via Stripe Dashboard → check if hero updates
3. [ ] If no: check Stripe Dashboard webhook attempts log
4. [ ] If attempts present but failed: check Supabase function logs
5. [ ] Run backfill function for HK's existing refunds
6. [ ] HK confirms Refund button visible in Billing weekly view (after scrolling)
7. [ ] Decide on offline refund flow for cash/Venmo

---

## RELEVANT FILES TOUCHED TODAY

- `src/components/CheckoutModal.jsx` : Custom chip, 100dvh, tip presets, link delivery picker
- `src/components/MarkAsPaidModal.jsx` : 100dvh, beefier confirm button, z-index
- `src/components/CancellationChargeModal.jsx` : editable fee, best practice hint, send link, z-index, mini card entry
- `src/components/ScheduleDashboard.js` : slide-over Checkout/Mark paid redesign, refund button mount, share link positioning
- `src/components/BillingDashboard.js` : Smart Billing complete rewrite (data layer + HeroPayCard + refund integration)
- `src/components/RefundModal.jsx` : NEW
- `supabase/functions/create-payment-link/index.ts` : column name fix
- `supabase/functions/charge-cancellation-fee/index.ts` : column name fix
- `supabase/functions/save-card-on-booking-token/index.ts` : column name fix
- `supabase/functions/create-deposit/index.ts` : column name fix
- `supabase/functions/get-payment-method/index.ts` : NEW (card_last4 self-heal)
- `supabase/functions/create-cancellation-fee-link/index.ts` : NEW
- `supabase/functions/stripe-payment-link-webhook/index.ts` : extended for cancellation_charge_id branch
- `supabase/functions/stripe-refund-webhook/index.ts` : NEW
- `supabase/functions/backfill-stripe-refunds/index.ts` : NEW
- `supabase/functions/refund-session-payment/index.ts` : NEW

---

## HOW TO START TOMORROW

1. Read this doc top to bottom (~5 min)
2. Tell HK: "I've read the handover. We left off mid-debug on the refund webhook not firing for HK's Stripe Dashboard test. Want to start by debugging the webhook (check Stripe attempts log + Supabase function logs) or fix the Custom chip CSS first?"
3. Let HK pick the priority. Don't assume.

End of handover.
