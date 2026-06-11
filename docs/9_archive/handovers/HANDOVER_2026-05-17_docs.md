# Handover 2026-05-17

Session: ~5am to ~10:30am Central, ~5.5 hours. Topic: Notification Compliance Dashboard build-out, end-to-end channel validation, A2P 10DLC discovery.

## What shipped (chronological)

Commits, in order:
- `55aa430f`: Phase 11.1: Notifications audit + client fan-out + no-show notice (continuation from prior session)
- `908ef479`: Phase 11.2: Notification Compliance Dashboard v1 (matrix view at `/founder/notifications`)
- `0397f368`: Design principle #10: "Industrialize the test, not the tester"
- `8ecdedc5`: BLOCK_PLAN Macros #9 (push as channel) and #10 (auto-fire + bulk-confirm) added
- `beea6d79`: Phase 11.3: Push as 4th therapist channel + auto-fire edge function + bulk-confirm UI
- `4d79a7a1`: Phase 11.4: Client push infrastructure (table, hook, banner, edge function, fan-out)
- `c4479d82`: Phase 11.2.1: Schema fix (notification_log uses sent_at not created_at, plus missing subject + body_snippet columns added)
- `b6a4ca90`: Phase 11.5: Revert C-Push to queued (tabled until client login exists)
- `cb8736a9`: Phase 11.5.1: Short-circuit client push when no subscriptions exist
- `182226be`: Phase 11.6: Sender & destinations card on dashboard

## Where we ended

**Dashboard at `/founder/notifications` is operational.** Matrix shows 28 touchpoints × 7 channels = 196 cells. Auto-fire button synthetically fires every touchpoint. Bulk-confirm pills on column headers let HK confirm channels en masse. Top card shows the full sender/destinations landscape.

**6 of 7 channels proven end-to-end:**
- T-Bell: ✓ fires and arrives on Joy Therapist dashboard bell drawer
- T-Push: ✓ fires and arrives on HK's iPhone PWA (verified via screenshots)
- T-Email: ✓ fires and arrives at bodymapdemo@gmail.com (12 emails per test run)
- T-SMS: engine fires correctly, Twilio claims sent, **carrier-drops** silently (A2P unregistered)
- C-Email: ✓ fires and arrives at bodymap01@gmail.com (13 emails per test run)
- C-SMS: engine fires correctly, Twilio claims sent, **carrier-drops** silently (same A2P issue)
- C-Push: correctly queued by design (no client login = no push receiver)

## The real blockers discovered

**Twilio A2P 10DLC registration stuck "in review" with TCR.** This is the production unblock for all SMS. Without it, every SMS gets silently dropped by carriers despite Twilio reporting success. Logged as BLOCK_PLAN Macro #11. HK to chase tomorrow morning via Twilio Trust Hub.

**No STOP/HELP opt-out language in SMS code.** Grep of `_shared/notifications.ts` shows zero references. Required for A2P campaign approval AND FCC/CTIA compliance regardless. Logged as Macro #12. Real ~1 hour fix.

**Twilio status callbacks not wired.** The notification_log status=sent only reflects Twilio's API acceptance, not actual carrier delivery. This is why the dashboard showed yellow (claimed sent) for SMS even when zero messages arrived. Real ~30-45 min fix. Logged as Macro #13.

**Duplicate Joy Client rows in production DB.** Two clients with same therapist_id + email but different phone numbers. Auto-fire targeted the wrong (newer) row. Added to Ribbon 2 macros. Suggests booking page has a race or lookup bug that creates duplicate client rows instead of updating.

## What HK still needs to do

**Tonight before sleeping:**
1. Run the dedup-investigation SQL (in conversation, last message): shows whether to delete or merge Row B
2. Paste back result so Claude/next session can write the cleanup SQL

**Tomorrow morning:**
1. Twilio Console → Trust Hub → find specific reason A2P Brand registration is stuck. Fix gap, resubmit. Or file support ticket to escalate.
2. Decide priority order between Macros #11 (A2P), #12 (STOP/HELP), #13 (status callbacks), #2 (Body Map hero on Features), #6.5 (Stripe Connect), #5 (Daily Evening Digest)

## Architectural lessons logged

**1. Visibility tools must run against their own data.** Phase 11.2 dashboard surfaced schema gaps in code that had been silently failing since Phase 3: `subject` and `body_snippet` columns the code wrote but didn't exist in the table. The try/catch swallowed every error. Two months of fan-out logs were silently dropping fields.

**2. Validate architectural prerequisites before shipping infrastructure for them.** Phase 11.4 shipped client push without resolving "do clients have anywhere to receive push?" Answer: no, because no client login = no persistent PWA = no subscription receiver. HK caught it. We reverted in Phase 11.5. Dormant infrastructure kept in tree for when client portal ships (BLOCK_PLAN Macro #2).

**3. Status from upstream services is not the same as delivery.** Twilio's `status=sent` means API accepted. Doesn't mean carrier delivered. Doesn't mean phone received. Same is true for Resend (email delivered to mailbox provider != inbox), and arguably for VAPID push (subscribed != notification displayed). The dashboard needs to show delivery state, not service-accept state.

**4. Compliance is real infrastructure work.** A2P 10DLC, STOP/HELP opt-out, terms of service mirrors of consent: these are not "nice to have." They block production. They take real time. They need their own onboarding wizard for each BYO-Twilio therapist.

## Phone landscape (memorize)

| Number | Role | Who controls | Where it lives |
|---|---|---|---|
| `+15136133033` | Twilio sender / platform "From" | Platform (HK/MyBodyMap LLC) | Twilio account, never receives |
| `(513) 909-9004` | Joy Therapist's personal SMS destination | HK | Google Voice on MacBook |
| `+13462426904` | Joy Client's personal SMS destination | HK | Google Fi on iPhone |

Joy Therapist email: `bodymapdemo@gmail.com`
Joy Client email: `bodymap01@gmail.com`

Joy Therapist id: `2a2886c3-00f2-4c6f-aaec-4b8150c61fcf`
Joy Client id (canonical, +346 phone, "Joy I" originally): `ce205279-3800-4335-b1c7-0b5ad1092a14`
Joy Client id (duplicate, +513 phone, "Mybodymap Demo" originally): `e3255b26-4e94-42ab-993f-84eee41ede3f`

## Duplicate client row state (investigated end-of-session)

Both rows are in active use, neither can be naively deleted:

| Row | Phone | Bookings | Sessions | Notif logs |
|---|---|---|---|---|
| A `ce205279...` (May 16) | +13462426904 | 0 | 2 | 0 |
| B `e3255b26...` (May 17) | (513) 909-9004 | 0 | 1 | 129 |

Row B accumulated 129 notification_log rows from tonight's auto-fire runs. Row A has 2 sessions from earlier dev work. The booking page must have created a new row each time a "Joy Client" booking happened with the same email but slightly different metadata.

Cleanup plan for next session (logged as part of Ribbon 2 macro):
1. Fix booking page client-lookup-by-email FIRST (root cause)
2. Migrate Row B's related rows to Row A: update sessions, notification_log, client_push_subscriptions, and any other FK tables to point at A
3. Delete Row B
4. Add unique constraint `(therapist_id, lower(email))` on clients table to prevent recurrence
5. Standardize Row A's phone to +13462426904 for ongoing testing

Estimated ~2 hours total. Not done tonight because surgery on production data after 5.5 hours of work is poor judgment.

## Files touched this session

New:
- `src/lib/notificationSpec.js` (extended from 11.1)
- `src/pages/founder/NotificationCompliance.jsx`
- `src/hooks/useClientPushNotifications.js` (dormant)
- `src/components/booking/ClientPushCTA.jsx` (dormant)
- `supabase/functions/founder-fire-all-notifications/index.ts`
- `supabase/functions/send-push-client/index.ts` (dormant until client login)
- `supabase/migrations/2026-05-17-notification-log-confirmations.sql`
- `supabase/migrations/2026-05-17-client-push-subscriptions.sql`
- `docs/HANDOVER_2026-05-17.md` (this file)

Modified:
- `supabase/functions/_shared/notifications.ts` (push channel, push short-circuit, error logging)
- `src/pages/BookingPage.js` (briefly added ClientPushCTA, then removed)
- `docs/BLOCK_PLAN.md` (Macros #9 split, #10/11/12/13 added)
- `docs/DESIGN_PRINCIPLES.md` (#10 added)

Migrations HK ran in Supabase Dashboard:
- `2026-05-17-client-push-subscriptions.sql` ✓
- `2026-05-17-notification-log-confirmations.sql` (corrected version) ✓
- `notification_prefs` re-seed for all 13 T-event types + push channel ✓

Migrations still pending from prior sessions (per prior handover):
- Phase 8.1 services.visibility column
- Phase 8.4 services.archived_at column  
- Phase 9.1 blocked_days time-range columns

## Tone notes for next session

HK was right multiple times in this session about architectural gaps (client push prerequisite, the dual-purpose-phone confusion, the SMS-vs-Twilio-vs-A2P chain). Listen carefully when HK pushes back on a plan. Cost of an extra question is far less than the cost of shipping the wrong infrastructure.

End-of-session emotional state: HK invested 5.5 hours, ended on a tool that works but a feature blocked on third-party compliance. Real progress but no flashy demo. Closing on a clean state is the right move.

---

# Handover 2026-05-17 (Late Session, ~12pm to ~midnight Central)

Session 2 of the day. Topic: Phase 12 (Checkout slide-over) → Phase 13 (client_id pipeline + payment polish) → Phase 14 (Smart Billing data layer + refund infrastructure). 35 commits. Real therapist Healing Hands BM1 goes live ~4am Central tomorrow morning.

## What shipped (chronological)

**Phase 12 - Checkout on calendar slide-over (Candice request):**
- `e8af4195`: Phase 12: Checkout and Mark as paid on calendar slide-over (HK verified end-to-end with real \$1 charge)
- `bfeddd6c`: Phase 12.1: Redesign slide-over actions for proper visual hierarchy
- `32436c50`: Phase 12.2: Fix CheckoutModal + MarkAsPaidModal mobile layout
- `964c2032`: Phase 12.3: Fix customer_id required + Stripe Link UI + CloseButton consistency
- `47f575ae`: Phase 12.4: Right architecture for Checkout > Enter new card (HK caught shortcut: "no shortcuts")
- `8fa20e29`: Phase 12.5: Find-or-create client row before charging

**Phase 13 - client_id pipeline + payment polish:**
- `479257bc`: 13.1: findOrCreateClient helper
- `135ee964`: 13.2: Wire helper into booking insertion sites
- `b8b1a628`: 13.3: Backfill migration for bookings.client_id
- `5cb85926`: 13.3.1: Repair orphan bookings.client_id refs + add FK constraint
- `a4637af5`: 13.4: Remove resolveClientRow workaround
- `3e595f18`: 13.5: Fix card_last4 not persisting on card save
- `3dc7a6e3`: 13.6: No-show fee paths + column name cleanup (stripe_payment_method_id never existed)
- `d54cdb37`: Fix Share booking link button hidden behind mobile bottom nav
- `31ae2f52`: 13.7: Checkout amount auto-pop, tip chips, link delivery picker
- `c8937079`: 13.8: Five fixes - link error, tip Custom chip, fee override, slide-over redesign
- `ed81099b`: 13.8.1: Modal overlay z-index above MobileBottomNav + beefier Mark paid button
- `f4a08694`: 13.8.2: 100dvh modal sheets for iOS Safari footer rendering
- `a7ddfddf`: 13.8.3: Custom tip chip becomes inline percent input

**Phase 14 - Smart Billing + refund infrastructure:**
- `3251486c`: Phase 14.1 + 14.2: Smart Billing data source rewrite + HeroPayCard (away from Stripe Connect API to local session_payments table)
- `1e70708e`: 14.3: Cancellation fees, refunds, no-shows in Smart Billing
- `bab53c7a`: 14.3a: Stripe refund webhook + one-shot backfill function (HK caught SQL workaround attempt: "I want you to be empathetic but I will let you know when I am done. We can not take shortcuts.")
- `d054507a`: 14.3a fix: Stripe webhooks skip gateway JWT verification (root cause: stripe-refund-webhook not in NO_JWT_FUNCTIONS allowlist in deploy workflow)
- `f074d117`: 14.3a redeploy
- `ee611171`: 14.3b: In-app refund button (RefundModal with Stripe path + offline path)
- `cb29d798`: 14.3c: Offline refund flow for cash/Venmo/Zelle/check
- `c69da3c4`: 14.3d: Refunds list component (later moved inline in 14.3f)
- `dada92c6`: 14.3e: Refund Reconcile founder ops tool (FounderHub section 9)
- `4b9b84fb`: 14.3f: Inline refund breakdown in hero, not buried below calendar
- `92d1ccd5`: 14.3g: Refund dropdown affordance, clearly tappable
- `c078cf65`: 14.3h: Refund button visual weight matches Add another payment
- `98323321`: 14.3i: Confirmed bookings show in Billing as scheduled sessions (root cause: leakageSessions filter only included status='completed', all HK's bookings are 'confirmed')
- `1c795bd6`: 14.3j+k: Schedule paid indicators + Refund as real outlined button
- `1f4f2782`: 14.3l: Bucket payments by booking_date not paid_at (paid 4PM May 18 booking was showing in Today's chip because paid_at=May 17, but session date is May 18)

## Where we ended

**Marathon shipped a complete refund stack:**
- Stripe Dashboard refund → webhook → DB flip → hero updates (verified working with \$1 test refund)
- In-app Refund button on slide-over paid card → modal → API → done
- Offline refund flow (Cash/Venmo/Zelle/check) → modal with custom copy → flip DB only
- Refund Reconcile founder tool → backfill any Stripe refunds the webhook missed
- Refund breakdown dropdown in hero → expanded view with per-payment detail

**Smart Billing data layer rewrite:**
- session_payments is the primary source (not Stripe Connect API)
- 5 buckets: paymentSessions, cancellationSessions, refundSessions, noShowSessions, leakageSessions
- Each booking date+time properly bucketed by session date, not payment date
- Confirmed-but-unpaid bookings now appear as "pending" (future) or "outstanding" (past)

**Schedule grid distinguishes paid bookings:**
- Sage green background, forest left bar, "✓ Paid \$X" pill
- Different from yellow unpaid confirmed bookings

## Critical learnings this session

1. **The duplicate Stripe account trap (re-confirmed).** Google OAuth login creates a different Stripe account from email+password login under the same email. Documented in FOUNDER_RUNBOOK.md Procedure 9.

2. **JWT verification gotcha for Stripe webhooks.** Supabase gateway requires Bearer JWT unless edge function is deployed with `--no-verify-jwt`. The deploy workflow at `.github/workflows/deploy-edge-functions.yml` has a `NO_JWT_FUNCTIONS` allowlist. Stripe webhook functions MUST be in that list. Symptom: webhook returns 401 UNAUTHORIZED_NO_AUTH_HEADER.

3. **Billing data model: session-date-based, not cash-flow-based.** Therapist's mental model is "5 sessions tomorrow, X paid." Bucketing payments by `paid_at` puts advance-paid sessions in the wrong day. Always join to bookings and use `booking_date + start_time` for the session date.

4. **`status='completed'` is rare.** All confirmed bookings have `status='confirmed'`, not 'completed'. Status only flips to 'completed' if the therapist explicitly marks done. Billing logic must accept both, or it will show 0 sessions for therapists who don't religiously mark complete.

5. **HK design feedback rounds matter.** "Refund button" went through 4 visual treatments before landing as outlined chip button matching "Add payment" weight. HK's "10x better" is a real bar, not hyperbole. Make peer actions visually equal.

## CRITICAL OPEN ISSUE FOR TOMORROW MORNING

**HK reported: zero notifications fired during all the bookings, cancellations, refunds tested today.**

No email, no push, no SMS. Real therapist is going live in a few hours. Notification stack regression is the highest-priority morning bug to investigate before therapist starts using the platform.

Possible root causes (not yet diagnosed):
- Did Phase 14.x refactor break the trigger paths that fire notifications?
- Are notification_log rows being written but channel-send is failing silently?
- Did the schema migration for bookings.client_id (Phase 13.3) break a notification join?
- Is the auto-fire flow still wired up correctly?
- A2P 10DLC issue might explain SMS but not push/email

This needs to be diagnosed and fixed at the START of tomorrow's session, before anything else.

## Unverified but staged

- The Tomorrow chip in Billing showing "4 sessions" instead of 5 expected. Logic traces correctly. Most likely PWA cache; HK confirmed "It's good" before sleep. If still wrong in the morning, Safari (non-PWA) is the quickest diagnostic.

## Sleep state

HK invested ~12 hours total today across two sessions. Real therapist Healing Hands BM1 goes live in ~4 hours. The platform's payment + refund stack is in a verified-working state for the live demo. The notification regression is the only known critical issue.

End-of-session HK quote: "I am sleeping."

