# BLOCK_PLAN.md

Working document for everything queued, blocked, deferred, or in-flight.
Read the **Summary** below to know where things stand in five minutes.
Read the **per-ribbon** sections to see what's coming on your platform.
Drop into **Details** at the bottom only when you need execution-ready
materials for a specific block.

**Most recent activity:** May 21 2026 marathon session. 16 commits covering Candice RLS root cause, Jackie's catastrophic-then-recovered import, mobile-first redesign of block panel, full-day block render, Schedule 365-day window, multi-day blocks, price-entry-during-import, skipped/failed CSV downloads, buffer input fix, GitHub Actions CLI pin. See FOUNDER_RUNBOOK decision log for the full list.

---

## Summary

**Currently active.** What is being worked or is ready to start the moment you OK it.
0. **DATA SAFEGUARDS (Priority 0, ~10 hours total, queued for May 24 morning).** Direct response to the May 23-24 incident where a comprehensive wipe ran against Candice Peek's therapist_id believing it was Jacquie's. 256 clients, 395 bookings, 25 services, plus notification_log/session_payments/activation_events deleted. Recovery took 7 hours and depended on the Supabase Pro daily backup happening to exist. Six layers of structural protection, in priority order:
    - **A. Confirmation gate.** SHIPPED May 24 (commit `7ee49a8b`). `scripts/_confirm_therapist.js` prints full identity card (business name, owner name, email, custom_url, therapist_id, counts) from DB; operator types "go" to proceed, anything else cancels. To be wired into every existing white-glove script tomorrow.
    - **B. Audit log via Postgres triggers.** SHIPPED May 24 (commit `7ee49a8b`), migration `supabase/migrations/2026-05-24-audit-log.sql`. Append-only `audit_log` table + trigger function attached to bookings/clients/services/sessions/session_payments. Every INSERT/UPDATE/DELETE captured with full before/after jsonb state. **Pending: HK to run migration in Supabase SQL Editor.** Verification: should see 15 trigger rows (5 tables × 3 events) via `SELECT FROM information_schema.triggers WHERE trigger_name LIKE 'trg_audit_%'`.
    - **C. Soft-delete migration.** QUEUED. Add `deleted_at timestamptz` to bookings/clients/services/sessions/session_payments. Convert hard DELETEs to UPDATE deleted_at=NOW(). Every read query adds `WHERE deleted_at IS NULL`. Partial unique indexes on therapists.email and therapists.custom_url to handle the reuse case. Weekly purge job hard-deletes anything older than 90 days. Phased: schema first (zero behavior change), read filters next, then convert deletes. ~6-8 hours including click-through testing in 3 accounts (Candice, Joy demo, Healing Hands). This is the single biggest leverage item; would have prevented the May 23 incident entirely.
    - **D. Per-therapist JSON snapshot scheduled edge function.** QUEUED. Every 4-6 hours, for each active therapist, export full state (clients + services + bookings + sessions + settings) as JSON to Supabase Storage at `storage/therapist-snapshots/{therapist_id}/{timestamp}.json`. 30-day retention. Enables 5-minute surgical restore of ONE therapist without affecting others. ~3 hours.
    - **E. pg_dump nightly to private GitHub repo.** QUEUED. GitHub Action runs `pg_dump --format=custom $DATABASE_URL` on schedule, pushes to a private `bodymap-backups` repo. Offsite backup independent of Supabase. Free at current DB size. ~1 hour to set up.
    - **F. DRY_RUN by default on white-glove scripts.** QUEUED. Retrofit all scripts in `scripts/` to default to `DRY_RUN=true`. Operator must explicitly set `DRY_RUN=false` to execute. Output shows the exact rows that would change. ~30 min.
    - **G. Supabase PITR add-on.** OPTIONAL DEFER. $100/mo for 7-day point-in-time recovery. Pro daily backups + audit log + soft-delete cover the recovery patterns at our scale. Reconsider at 50+ paying customers.
    - **H. Make bookings.client_id NOT NULL.** QUEUED. Discovered May 24 night while investigating Terra's "Client record missing on this charge" report. Audit showed 19 bookings total with NULL client_id across 2 therapists (Terra 11, Candice 8). Of Candice's 8, all were created by Claude's white-glove SQL in this session and prior sessions (chat-add batch 9b4f5e2d, screenshots-based inserts) where the INSERT statement omitted client_id even when the matching client existed in the database. Of Terra's 11, the cause is suspected to be the import path leaving client_id NULL when the CSV name doesn't fuzzy-match cleanly. Fix is twofold: (1) backfill the existing 19 NULL rows after both therapists confirm matches, then (2) add NOT NULL constraint so future white-glove SQL and future import bugs can't silently produce broken rows. Without this, the bug recurs. ~2 hours total.
    - **I. White-glove SQL must use db helpers, not raw INSERTs.** STANDING RULE. When writing one-off SQL for a customer (recovery, backfill, manual booking insert), Claude must look up client_id from the clients table first (LEFT JOIN or subquery against bookings.client_name = clients.name), and if no match, create a client stub via INSERT first, then use that id. Raw INSERTs into bookings without client_id is forbidden going forward. The 8 broken Candice bookings are evidence this rule was needed.
    - **J. Never assume timezone of imported data.** STANDING DESIGN PRINCIPLE (added May 24 2026). CSV/import times are wall-clock in the source system's display timezone and have no inherent UTC offset. Every therapist has a location-based timezone (Jacquie in Iberia MO = Central). Import path must (a) confirm therapist's timezone before parsing, OR (b) preserve naive times and always display in therapist's local timezone via the UI. The bookings.start_time TIME column is naive (correct schema), but any display layer or edge function that converts to UTC then back will introduce hour offsets. Audit needed: (1) every place we read bookings.start_time for display, (2) every place we send notification emails/SMS with appointment times, (3) every place we compute "is this in the past" comparisons. Trigger: Jacquie's Jul 22 screenshot showed 12:00 PM appt while CSV + DB show 11:00 AM, possible cause is timezone drift somewhere in the chain (could also be reschedule between exports - to verify with her tomorrow).
    - **Wrap-up.** Document the full incident + the "Restore to new project (BETA)" recovery primitive used May 23 night as a procedure in `FOUNDER_RUNBOOK.md`. Delete the recovery snapshot project `pkjbhoanuultfegfmxtq` after 7 days (cost is $0.50/mo, low risk to keep longer).
0a. **Real customer issues from morning of May 24 (triage before code).** Three live reports from active therapists:
    - **Terra (Ponder Place / Healing Touch):** Checkout modal shows "Client record missing on this charge" red text below the "Record $100.00 as paid" button for Amanda Rogers / Chronic Pain Management. Screenshot received. Needs investigation: is client_id null on the booking row, or is it set but pointing to a deleted/wrong client? May or may not be related to the May 23 incident or the broader Phase 13 client_id pipeline.
    - **Joy (Healing Hands):** Two clients reporting they cannot fill out intake forms. Symptom unspecified (won't load? submit fails? validation error?). Needs to know: which therapist, which clients, what step they're stuck at, what browser/device, what is shown vs expected.
    - **Joy (Healing Hands) blind-client intake.** Joy needs to fill out an intake form on behalf of a blind client. HK already responded: therapist can go through booking + intake on the client's behalf. Confirm this works end-to-end (the existing booking + intake flow handles a therapist-initiated booking with intake without requiring the client to log in).
1. **Billing Dashboard Redesign (Phase A-E, 8.5 hrs across sessions).** Strategy doc shipped May 18 at [`docs/BILLING_DASHBOARD_STRATEGY.md`](./BILLING_DASHBOARD_STRATEGY.md). HK to review and approve before Phase A coding begins. Phase A = Daily page redesign with 6-band layout + receipt-style session cards (~3 hrs). Persona-led design for Maria, the 67-year-old solo LMT. Industry inspiration from Square, Stripe, GlossGenius, Mindbody, Monarch, Apple Wallet. Insights tab as separate beast in Phase D. HK quote: 'These chats on the block plan. So maybe remind me. And maybe four, five hours to do these chats. Full stop.' Reminder set for 4-5 hour estimate per session block.
2. **Verify Phase 15 notification fires end-to-end with the live therapist's first sessions.** Spec, edge functions, and fire points all wired May 18 2026 morning. Healing Hands BM1 should now receive notifications for bookings, payments, refunds. Monitor first real activity to confirm.
3. **Notification system, Phase 1: payment received + new client signup.** Backend `notification_log` + `notification_prefs` already wired; missing the actual fire points and an in-app surface. Macro Platform Improvement #1.
4. **Smart Calendar SVG animation (Ribbon 4 demo).** Three-act loop bringing the left-column insights to life. Replaces `ScheduleDemo` in Ribbon 4. Phase 4 of the May 16 session, queued.
5. **Card-on-file detection for returning clients.** Booking page does not detect existing saved card after 5+ bookings; client list lacks the indicator too. Ribbon 1 entry. Real customer-facing bug.
6. **StatusStrip Agreement tile.** 75 min. Replace the conditional pendingIntake chip with a permanent Agreement tile on the client profile. Ribbon 2 entry.
7. **Engagement state column + filter on /admin Table 1 (~45 min).** HK May 19 2026: the current 'Last used' column on the founder dashboard is misleading. It pulls from max(sessions.created_at, clients.created_at) and ignores logins, page views, settings activity, booking page traffic, outreach activity. So a therapist who logs in every day to check schedule but has no clients looks 'inactive.' Real question HK is trying to answer: of the signed-up therapists, how many are GHOSTS (never logged in), how many are SETTING UP, how many are ACTIVE. Build: pull `auth.users.last_sign_in_at`, derive engagement_state per row (GHOST, COLD, TIRE KICKER, EXPLORING, SETTING UP, DORMANT, ACTIVE), render as a color-coded pill next to the name, add a top-of-table filter to view one cohort at a time. Logic and SQL drafted in chat May 19 2026.
8. **Reschedule + cancellation policy alignment.** Marketing copy on Features 5.2 says the policy applies to cancels, reschedules, and no-shows. Reality: BookingModal reschedule path (line 253) just updates booking_date / start_time / end_time. No policy check. No charge. Needs: when a reschedule moves a booking inside the cancellation window AND the policy is enabled, treat it like a late cancel (offer to charge per the matching tier, with override option for therapist). Estimated 2 hrs. Surfaced May 20 2026 from the audit item 9 symmetric-case review.
9. **Maria-persona setup checklist on dashboard (~45 min).** Surfaced May 21 2026 from Jackie's "where do I find things" pattern. Dashboard banner showing what's set up vs pending: buffer, hours, services with prices, blocks if any, deposit policy, booking page shared. Green checkmarks + amber dashes. One-tap navigation to each unfinished item. Most leverage: every new therapist signup hits the same confusion Jackie did, this prevents it.
10. **Service consolidation UI in Settings → Services (~60 min).** Surfaced May 21 2026 from Jackie's appointment import creating 8 duplicate services. Lets any therapist merge two services without SQL: select source service → select target service → confirm → all bookings move from source to target, source service deleted. Same pattern as our existing dedup flows.
11. **Fuzzy service matching during appointment import (~90 min).** Surfaced May 21 2026 from Jackie incident. When the CSV has "Restorative Relaxation Massage" and the therapist already has "Relaxation Massage", we should propose merging rather than silently auto-creating a duplicate. Levenshtein distance or normalized comparison stripping common variations (Restorative, Deluxe, Signature, Premium prefixes).
12. **DONE May 22 2026 (commit `9f72cffd`): Yearly view in Schedule.** Replaces the "coming soon" placeholder with a 12-month heatmap. Each month is a mini-grid; day cells colored by booking density (sage gradient: empty → light → medium → forest). Full-day blocks tinted amber, partial blocks get a corner dot. Today's cell bordered, current month softly outlined. Year stats below: total sessions, busiest stretch, quietest stretch (care-framed: "Good window for rest, learning, or outreach", not money framing per Design Principle #17). Year nav prev/next. Empty-state copy when no bookings on record. Design choice per Design Principle #18: pure read-only at-a-glance, no tap-to-drill (Monthly tab handles details).
13. **DONE May 21 2026 night (commit `da48468d`): Unified import flow.** New default flow: therapist drops 1+ CSVs (drag-and-drop + file picker side-by-side), auto-detects each by header inspection, runs clients first then appointments with cross-file contact-info merge. Pure import functions extracted to `src/lib/imports/runImports.js` for reusability. Legacy two-tab UI moved behind "Advanced import options" link. Critical Jackie-fix: appointment import now ALSO upserts email/phone onto existing client stubs by name match (previously only client import did this). Standing rule shipped: HIPAA-aware support, never ask therapist for raw client data via DM. Pairs with shipped design principles #14 (One way in) and #15 (HIPAA-aware support).
14. **DONE May 21-22 2026 (commits `de8e937d` through `1ec5e8be`): Import flow expansion (A through J).** Address fields on clients (migration + mapping). Smart-content detection (samples column values incl. currency to handle non-standard headers like Contact1 with emails, Rate with prices). Preview screen with first-5-row table before any DB write. Phone formatter library applied across SessionList, ImportClients preview, FounderDashboard, FounderMassSms (Design Principle 16: store canonical, display human). SOAP-style notes captured into bookings.notes. ImportedDataFootnote on Billing when therapist has imported data. Schedule booking cap raised 2000 to 5000. Beforeunload warning during import. Rotating friendly tips during import. First-time welcome card with platform-specific export hints. Mode switch (unified <-> advanced) preserves dropped files. Client profile AboutCard renders address fields. 'See what landed' navigation pills. **Client-side resumable imports via localStorage checkpoints (B)**: file hash + 25-row checkpoint write + resume banner + per-file resume badge. **Undo-last-import via batch id (D)**: every insert stamps import_batch_id, success screen shows 'Undo this import' pill for 10 minutes, two-tap confirm, deletes in dependency order with row counts.
15. **Fuzzy service matching (full version, no shortcuts).** DONE May 22 commit `f5588712`. When import CSV has service "Restorative Relaxation Massage" and therapist already has "Relaxation Massage", surface 'Did you mean Relaxation Massage?' with one-tap merge.
16. **Server-side chunked imports (resumable architecture).** QUEUED. Client-side resumable (item B above, commit `d8474625`) handles the realistic failure modes at current scale (tab close, navigation, wifi drop, browser crash) via localStorage checkpoints every 25 rows. Server-side architecture with import_jobs table + edge function chunks becomes needed at 50K+ row scale. Estimated 4-5 hours when triggered.
17. **Photo + upload import.** Therapist drops a zip of client photos, we match by filename to client records and store in bodymap-assets bucket. Queued. Estimated 2 hours.
18. **Card-on-file migration flag + email.** Mark imported clients who had cards on file in old system. On their first MyBodyMap booking, surface a 'please re-enter your card to keep things running smoothly' prompt. Cannot transfer the actual card token (PCI). Estimated 30 minutes.
19. **DONE May 22 2026 (commits `68ef35ba`, `dd1fd45f`, `f82c20b6`): Schedule + Outreach Tier 1 sweep.** (a) **Lapsed-clients deep link**: Growth-insights "Reach out to N lapsed regulars" button now navigates to Outreach with those specific clients pre-loaded in QuickSendModal, skipping the quick-send picker. (b) **Blocked-day visual cues**: amber borders + "🌿 Time off" badges on weekly day-cards, amber tints + indicators in monthly cells, "Day off" labels on the desktop time-grid columns. (c) **Custom card on Quick send**: dashed sage card sits as the first option, opens a 2-step CustomClientPicker → QuickSendModal flow with full search/multi-select.
20. **DONE May 22 2026 (commits `c5cef7cb`, `b7ce28ff`): Schedule Tier 3 rebuild.** (a) **Desktop weekly Outlook-style time grid**: hour rows (7am-9pm, auto-expanding), day columns, sessions positioned absolutely by start_time with height = duration, amber hashed bands for partial blocks, "now" line in red, today's column tinted sage, hour gridlines. (b) **Mobile weekly horizontal time-strip**: each day card with bookings shows a 22px strip with mini-bars per session positioned by time, amber bands for partial blocks, "now" indicator, time labels (7a/10a/1p/4p/7p/9p). Strip hidden on fully-empty open days and on fully-blocked days.
21. **DONE May 22 2026 (commits `c02973af`, `916de164`): Schedule Tier 4 deep insights.** Seven care-framed practice insights replace the prior shallow strategy library on the "Ways to use this" surface: (A) first-session check-in 7-21 days post-first-visit, (B) cadence drift at 1.5x typical interval, (C) open time as welcome capacity (no dollar framing), (D) top clients quiet (heaviest 20% with 30+ day gap), (E) day-of-week imbalance (>2.5x ratio), (F) membership candidates (3+ visits in 60 days, NOT current members), (G) cancellation flag (3+ in 30 days). Three insights (A, B, D) deep-link to outreach modal with named clients pre-selected. F correctly filters out current members via member_subscriptions query. G uses a precomputed count because cancelled bookings are excluded from the schedule's allAppts query. Cap lifted from 4 to all firing insights so HK can iterate from the surface. Framing follows Design Principle #17 throughout.
22. **Insight iteration after real-data review.** QUEUED. HK to view the 7 deep insights firing against the live Healing Hands account, prune any that feel weak, tune copy on any that feel off, wire actions on the currently-text-only insights (C, E, F, G). Most likely candidates for copy tuning: D (top clients quiet, naming clients by first name might feel intrusive in some practices) and G (cancellation flag, could come off scoldy depending on context).
23. **Cleanup: orphan `src/components/CustomQuickSendModal.jsx`.** QUEUED. A parallel-session implementation of the Custom send flow with different architecture (separate modal instead of CustomClientPicker → QuickSendModal). Currently unused. Safe to delete in next sweep.
24. **STILL PENDING: migrations to apply in Supabase SQL Editor.** Both idempotent. (a) `2026-05-21-clients-address-fields.sql` adds 6 address columns to clients (line1, line2, city, state, zip, country). (b) `2026-05-22-import-batch-id.sql` adds `import_batch_id UUID` to clients/bookings/member_subscriptions plus partial indexes. Until both applied, address fields don't save on client profile AND undo-last-import fails on every insert (the column doesn't exist).

**Recently completed.**
- **May 21 2026 marathon (16 commits).** Candice 3-bug fix + RLS root cause for blocked_days. Jackie catastrophic-import recovery + Maria-persona import redesign + appointment import hardening + skipped/failed CSV downloads + price-entry-during-import. Schedule 60-to-365 day window. Multi-day blocks + mobile-first redesign + full-day block render. Buffer input swapped to InlineSaveNumberInput. GitHub Actions CLI pin to stop daily failure emails. data_exports + services_groups migrations applied.
- Audit item 8 (server-side guards expansion) shipped May 20 2026. Memberships, packages, locations, add-ons, lead-time min/max all now re-checked at submit. Commits TBD.
- Audit item 9 (symmetric-case review) partially shipped May 20 2026. Buffer + blocked-day backward warning + lead-time bidirectional + lapsed outreach max ceiling all closed. Reschedule + policy alignment carved out as item 8 above.

**Externally blocked.** Waiting on something we don't control.
- Google OAuth app verification (waiting on 5+ test therapists + reachable privacy/terms URLs)
- Optional client portal (waiting on 3+ founding-therapist requests; currently 1)
- Twilio onboarding friction (escalation tripwire: 3 handhold requests in one month)
- Twilio A2P 10DLC Brand registration stuck in review with TCR (blocks all US SMS)

**Action items (HK to do, not blocked by code).**
- **Configure Twilio inbound webhook for STOP keyword handling.** Macro #12 shipped May 18 (commit `efd93cf6`). The `sms-inbound` edge function is live and the migration ran. Last step: in each therapist's Twilio Console (or the platform Twilio number `+15136133033`), go to Messaging → Settings → "A message comes in" → set Webhook URL to `https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/sms-inbound`, method HTTP POST. Without this, STOP texts from clients hit Twilio's network suppression but never update our DB, so our backend keeps trying to send and accumulating failed log rows.

**Recently shipped (May 18 2026 morning, Phase 15 notification gap audit).**
- Phase 15.1: BookingModal fires send-booking-confirmation for therapist-created bookings + reschedules (was completely silent before)
- Phase 15.2: New `notify-payment-event` edge function. Wired into CheckoutModal (card-on-file + new-card paths) and MarkAsPaidModal (all offline methods). Therapist + Client fan-out.
- Phase 15.3: New `notify-refund-event` edge function. Wired into refund-session-payment (offline + Stripe paths) and stripe-refund-webhook (external refunds). One fire per refund regardless of initiator. `refund_issued` added to notificationSpec for matrix coverage.
- Diagnosis: prior 'no notifications fired' issue was a buildout gap, not a regression. Phase 12 introduced CheckoutModal without notification wiring. Phase 14.3 introduced refunds without notification wiring. Public booking page always worked. Therapist-side surfaces never did.

**Recently shipped (May 17 2026 marathon, both sessions).**
- Notification Compliance Dashboard end-to-end (Phases 11.1-11.7)
- Phase 12: Checkout + Mark as paid on calendar slide-over (verified with real \$1 charge)
- Phase 13: client_id pipeline (helper + 2 wires + backfill + orphan repair + FK constraint + cleanup)
- Phase 13.5-13.8: Payment polish (card_last4 persist, no-show fees, slide-over redesign, tip chips, modal layout, iOS Safari 100dvh, Custom tip input)
- Phase 14.1-14.2: Smart Billing data source rewrite + HeroPayCard
- Phase 14.3: Complete refund stack (Stripe webhook with JWT allowlist fix, in-app modal for Stripe + offline paths, Reconcile founder tool, inline breakdown dropdown, schedule paid indicators, real outlined refund button)
- Phase 14.3i: Confirmed bookings appear in Billing as scheduled sessions (root cause: filter required status='completed' only)
- Phase 14.3l: Payment session bucketing by booking_date not paid_at (advance-paid sessions were in wrong day chip)

**Recently shipped (May 16 2026 session).**
- Stripe Connect architectural fix + stale-customer recovery in `create-deposit` and `charge-cancellation-fee` (Phases 0 + 1)
- Smart Booking standalone pillars removed from Home + Features; content lives only in Ribbon 4 + the WhyMyBodyMap differentiation list now (Phase 1)
- Ribbon 4 promoted to a featured Smart Calendar variant: sage gradient, "The moat" badge, elevated demo frame, tightened tagline, reordered sub-features (Phase 2.1, commit `866e91b2`)
- Mark No-Show button on past bookings, wired through `CancellationChargeModal` with `isNoShow: true` and a preserved `no_show` booking status distinct from `cancelled` (Phase 2.2, commit `85bab672`)

---

## Open asks

The list of things real people have asked for, by name and date.
Tracked here so we can see when demand crosses a threshold for unblocking.

### From therapists
- **Jackie Bodkin (May 21 2026)**: marathon session. Six real bugs/UX gaps surfaced in one day, all shipped: buffer input fighting typing, Schedule capped at 60 days, block panel "third world" on mobile, full-day blocks invisible on timeline, $0 prices from appointment import, no way to see what got skipped. **Still open:** service consolidation SQL when she sends mapping (8 auto-created services from import need merging into her 8 manual services with prices). She is the most engaged real customer to date and worth a thank-you gesture once she's truly settled.
- **Candice Peek (May 21 2026)**: three more bugs reported and shipped (buffer two-sided, private services hidden from cached booking page, blocked-day RLS root cause). **Still open:** her second message about "not doing the correct amount of time" was never resolved. Reply needed with the RLS news plus a follow-up question on that second issue.
- **Candice Peek (May 16 2026 evening)**: "Is there a way to block off sections of time in a day without blocking the full day?" → HK committed "we will add that tonight." Shipped: Phase 9.1 (inline partial-day blocks via Time off panel, commit `401e1679`) + Phase 9.2 (long-press anywhere on the Today timeline to drop a 60-min block, commit pending).
- **Ashley Scalzulli (May 12 2026)**: client login portal. → see [Macro #2: Optional client portal](#macro-2-optional-client-portal).
- **HK (May 16 2026 morning)**: "When I got paid, I should have received an email." Plus on-platform + email + SMS for every payment, new client, and booking event. → see [Macro #1: Notification system](#macro-1-notification-system).
- **HK (May 16 2026)**: Cancellation, reschedule, and one more similar workflow ("not sure if those workflows exist"). Audit result: cancel ✓, reschedule ✓, no-show was the missing third, shipped Phase 2.2.
- **Lindsey (May 10 2026)**: editable intake fields from SessionDetail. → mostly shipped; see [Detail §2](#2-lindsey-11--focus-distribution-commit-2-of-2-shipped-may-10-2026) for the deferred follow-ups.

### Found-during-testing (May 17 2026 ~5am)
- **Duplicate client rows for same email.** Bodymap01@gmail.com has two client rows under the same therapist (Joy I, Mybodymap Demo) with different phone numbers and creation dates. **Why this matters:** the Body Map longitudinal pattern intelligence (the moat) requires session history to live on ONE client record per person, not split across duplicates. When a returning client books with the same email, the booking flow must find the existing client by email-match, not create a new row. Queued for investigation.
- **Verify cron schedules for `send-reminders` and `send-post-session`.** The functions are written for cron but the audit couldn't confirm the cron jobs are actually scheduled in Supabase Dashboard. If empty, client SMS reminders never fire automatically. Quick check, queued.


### From clients
- None tracked currently. When a client request lands (via founding therapist relay or a support reply), append here with date.

---

## Macro platform improvements

Platform-level work that doesn't belong to a single ribbon.

### Macro #1: Notification system
**Status:** queued, Phase 3 of the May 16 session, awaiting OK on scope.
**Why now:** HK got a real Stripe payment on May 16 and received zero notification. Foundation is half-built (prefs JSON + log table + helpers) but no fire points for `payment_received` or `new_client_signup`, and no in-app bell/drawer surface. Defaults in `notification_prefs` already cover `new_booking`, `intake_filled`, `gift_purchased`, `daily_pulse` for the therapist; missing types: `payment_received`, `new_client_signup`, `booking_cancelled`, `booking_rescheduled`, `no_show_recorded`, `cancellation_fee_charged`, `refund_issued`.
**Scope estimate:** Minimum viable 3 hrs (in-app table + helper + 2 fire points + bell drawer). Full coverage 6-10 hrs.
**Plan:** new `in_app_notifications` table with `read_at` for unread state, new shared `notifyTherapist({ event, subject, body, payload })` helper that checks prefs, writes the row, sends Resend email, sends Twilio SMS, logs each to `notification_log`. Wire `payment_received` from `capture-saved-card`, `new_client_signup` from `send-welcome`, `booking_cancelled` + `no_show_recorded` from the cancel/no-show flows in `CancellationChargeModal`. Bell icon in therapist top nav with unread count, rose/cream drawer matching Gift Cards aesthetic.

### Macro #2: Optional client portal
**Status:** blocked, waiting on 3+ requests.
**Current count:** 1 (Ashley Scalzulli, May 12 2026). Jiny, Terra, Kathy have not asked.
**Why not yet:** the "no client login" stance is a marketing pillar codified in 3 places. Building this changes the framing. Build only when demand justifies it. See [Detail §6](#6-optional-client-portal-with-login).
**Related dormant infrastructure (May 17 2026):** Phase 11.4 shipped the client push infrastructure (client_push_subscriptions table, useClientPushNotifications hook, ClientPushCTA component, send-push-client edge function, notifyClient push fan-out branch). All reusable when client login exists. The booking-page banner was removed and CLIENT_PUSH_STATUS flipped back to 'queued' after we realized clients have nothing installed to receive push to. When the portal ships: flip status to 'live', re-add 'push' to the relevant C-series channel arrays in notificationSpec.js, re-import ClientPushCTA on BookingPage.js OR move the install prompt into the client portal post-login.

### Macro #3: Twilio onboarding friction (recurring)
**Status:** below escalation threshold.
**Tripwire:** 3 onboarding handholds in a single month, then build the in-app wizard immediately. Currently 2 (Candice, May 15). See [Detail §7](#7-twilio-onboarding-friction-recurring).

### Macro #4: Google OAuth app verification
**Status:** blocked, waiting on 5+ test therapists connecting cleanly + live privacy/terms URLs.
**Effort to submit when unblocked:** ~45 min, all materials are pre-drafted. See [Detail §1](#1-google-oauth-app-verification).

### Macro #5: Stripe promo code cleanup
**Status:** queued.
**What:** `BETASILVER` codes with underscores still have issues. New codes without underscores (`BETASILVER3M`, `BETASILVER12M`) need to be created. Old $24 payment links need deactivation. Per memory, not yet completed.
**Scope:** ~30 min in Stripe Dashboard, no code.

### Macro #6: Video pipeline (15 automated videos)
**Status:** queued.
**What:** Playwright + Remotion pipeline. Feature IDs match video IDs (1.1 to 7.4). BM-0.0 intro first (HK checkpoint required). Founder story BM-7.4 posts first on LinkedIn, TikTok, Reddit, HN before product videos.
**Pending:** v3 doc with corrected IDs.

### Macro #7: Body Map hero section on Features page
**Status:** queued, marked "highest priority" in memory.
**What:** front/back visual, focus/avoid, pressure, medical flags, longitudinal intelligence. Bronze=last 5 sessions, Silver=all sessions. This is the core moat and should be a hero section on the Features page.
**Note:** with the Phase 2.1 Ribbon 4 promotion to "The moat" treatment, decide whether Body Map gets a parallel treatment in Ribbon 2 (Know Your Client) so the two moats are visually co-equal.

### Macro #8: Close-button audit and standardization (shipped May 16 2026, Phase 9.6)
**Status:** shipped.
**Done:** all 33 instances of × across 18 files swept and replaced. New `CloseButton.jsx` component standardizes modal/sheet dismissals. List-row deletes got labeled "Delete" / "Remove" / "Dismiss" pills with red hover. The success-banner dismiss × on BookingPage became the explicit word "Dismiss." Build clean. Every replacement hits the 44×44 tap-target minimum where applicable, all use real English words instead of glyphs.
**Files touched (18):** BookingModal, AddClientModal, WaitlistModal, QuickSendModal, ScheduleDashboard (2 modals), PracticeAgreement, SessionList, MembershipsCard, EventsCard, PackagesCard, ClientList (2 nudges), MarketingNudges, Outreach (2 places), QRCodesCard, Comparison, IntakeEditor (5 places), Dashboard (3 places), BookingPage (6 places).
**Pattern documented for future modals:** use `CloseButton` from `src/components/CloseButton.jsx` for any modal/sheet/drawer close affordance. For inline list-row deletes, use a small `Delete` / `Remove` / `Dismiss` pill with red hover state. No bare × glyphs anywhere going forward.

### Macro #9: Push as a first-class notification channel
**Status:** PARTIAL. Therapist push (T-Push) shipped Phase 11.3. Client push (C-Push) infrastructure shipped Phase 11.4 then tabled in Phase 11.5 pending client login.
**Why this matters:** HK May 17 2026 ~6am, after seeing the Notification Compliance Dashboard: "What about notifications on both therapist and client phones that pop up on the mobile? Shouldn't that be added as another communication mechanism." Correct, it should. The PWA push pipeline existed but was wired as a side path, not a unified channel in the notification spec.
**What shipped (T-Push, Phase 11.3):**
  - `push` channel added to `ALL_CHANNELS_BY_AUDIENCE.therapist` in `src/lib/notificationSpec.js`
  - `notifyTherapist` in `supabase/functions/_shared/notifications.ts` calls `send-push` as channel #4
  - Push attempts logged to `notification_log` with `channel='push'`
  - Dashboard renders T-Push column
**What was shipped then tabled (C-Push, Phase 11.4 → Phase 11.5):**
  - Built: `client_push_subscriptions` table, `useClientPushNotifications` hook, `ClientPushCTA` banner, `send-push-client` edge function, `notifyClient` push fan-out branch
  - Tabled because clients have no login. They book once, then have nothing installed to receive push to. The infrastructure is dormant but reusable when Macro #2 (client portal) ships.
  - To re-enable: flip `CLIENT_PUSH_STATUS` to `'live'` in `src/lib/notificationSpec.js`, re-add `'push'` to C3-C5, C7-C15 channel arrays, re-import `ClientPushCTA` in `src/pages/BookingPage.js` OR move the install prompt into the post-login client portal.
**Lesson learned:** when designing a notification spec, grep for every existing mechanism that sends a message to a human. Don't trust existing docs to be complete, they reflect what was in the engine at the time. AND: validate the architectural prerequisites (does the audience have a place to receive this channel?) before shipping infrastructure for it.

### Macro #10: Notification Compliance auto-fire + bulk-confirm
**Status:** queued, ~3.5 hours.
**Why:** HK May 17 2026 ~6am, principle violation flagged: "I thought I wont have to create an event and book a session. If we upload a CSV file or another way in which the system can do it vs. myself? This was the whole scalability discussion earlier. If I will need to replicate 28 events, we will be here all day."
**What:** the dashboard at `/founder/notifications` shipped in Phase 11.2 makes gaps visible but still requires manual event triggering and per-cell confirmation. Two additions:
  - **"Run full compliance test" button** that synthetically fires every touchpoint in the spec for the test therapist+client pair. Each touchpoint gets a `test_mode` flag passed in so the firing function knows it's a synthetic event (skip Stripe charges, use stub data for missing context like booking_id). Total fire time should be under 90 seconds for all 28 touchpoints.
  - **Bulk-confirm by column.** Instead of 28 individual cell ticks, 7 column headers each get a "Confirm all yellow cells in this column" button. After running the auto-fire, HK confirms by channel: "Got all my T-Bell pings? ✓. Got all my T-Email? ✓." Five clicks (or seven, once Push is a channel), not 28.
**Design principle this honors:** #10 "Industrialize the test, not the tester." Manual click-through doesn't scale to 28 touchpoints, let alone 50 when we add more. Auto-fire + bulk-confirm makes the dashboard true to its principle.
**Companion change:** the dashboard should refresh from log table every few seconds automatically while the auto-fire is running, so HK watches cells light up in real time rather than clicking refresh.

### Macro #11: Twilio A2P 10DLC registration unblock (PRODUCTION CRITICAL)
**Status:** stuck "in review" with TCR, blocking all SMS delivery to US numbers.
**What this is:** The Campaign Registry (TCR) approval that long-code SMS senders must complete since 2023. Without it, every SMS Twilio API "sends" gets silently dropped by carriers. Twilio API returns success (status=sent in notification_log), but no carrier ever delivers the message. Discovered May 17 2026 via the Notification Compliance Dashboard auto-fire: all 19 SMS attempts reported sent, zero arrived.
**Why this matters far beyond MyBodyMap's own number:** every therapist BYO-Twilio onboarding will hit this same wall. A2P approval can take 1-7 business days when smooth, weeks when stuck. We can't ship SMS to real therapists without solving this for them too, not just for the MyBodyMap +15136133033 sender.
**Tasks:**
  1. Tomorrow (HK): Twilio Console → Trust Hub → find specific reason MyBodyMap Brand registration is stalled. Common reasons: business name doesn't match EIN exactly, business website lacks privacy policy / opt-in language, vertical/industry mismatch. Fix the gap, resubmit. If no specific reason visible, file Twilio support ticket to escalate.
  2. Once approved: register a Campaign under the Brand. Use case = Mixed (covers transactional + occasional marketing). Submit sample messages that match the actual spec (booking confirmation, reminder, no-show notice).
  3. Wire the Messaging Service SID into therapists.twilio_messaging_service_sid for any therapist that wants to use platform-approved messaging (vs their own BYO).
  4. Build the BYO-Twilio onboarding wizard (a separate macro, but related): when a therapist connects their own Twilio, the wizard must walk them through their own A2P registration with sample messages, opt-in language, and a "What's TCR?" explainer. Without this, every therapist will get stuck like HK did.
**Compliance gap exposed by this work:** the SMS sender code does NOT currently append STOP/HELP opt-out language to messages. TCR requires this for campaign approval. See Macro #12 below.

### Macro #12: SMS opt-out compliance (STOP/HELP language)
**Status:** queued, ~1 hour. Required for Macro #11 campaign approval and for FCC/CTIA compliance regardless.
**Discovered:** May 17 2026, during A2P registration prep. Grep of `_shared/notifications.ts` for "STOP" returned zero hits.
**What's required:**
  - Every message sent to a client must include "Reply STOP to opt out" at the first touchpoint, and at minimum periodically thereafter
  - STOP keyword must be honored: when a client texts STOP, mark `clients.sms_opted_out_at` and skip them in future SMS sends
  - HELP keyword must return contact info (the therapist's email or a brand support email)
**What:**
  1. Add `sms_opted_out_at timestamptz` column to `clients` table
  2. In `_shared/notifications.ts` SMS code path, check `client.sms_opted_out_at` before sending. If set, log as `status: 'skipped', error_message: 'client_opted_out'` and don't send.
  3. Append `Reply STOP to opt out.` to every C-SMS message body when client.sms_opted_out_at is null AND the message doesn't already contain "STOP" in caps
  4. Build a Twilio webhook receiver edge function `sms-inbound` that handles STOP/HELP keywords. Twilio messaging services already handle STOP/HELP by default, but we need the database side to know about opt-outs so we don't waste API calls trying to send to opted-out users.
**Cost of not doing this:** A2P campaign rejection, FCC fines if reported, real harm to clients who can't opt out of unwanted texts.

### Macro #13: Twilio status callbacks for true SMS delivery state
**Status:** queued, ~30-45 min. Surfaced by Macro #10 (compliance dashboard) revealing the silent-drop problem.
**Discovered:** May 17 2026. The notification_log status=sent only reflects Twilio API acceptance, not carrier delivery. A2P-blocked sends report sent but never arrive. The dashboard's matrix shows yellow cells that are lying.
**What:**
  1. Add `status_callback` URL parameter to every Twilio send in `sendSmsViaTwilio` in `_shared/notifications.ts`. URL: `${SUPABASE_URL}/functions/v1/twilio-status-callback`
  2. Add `delivery_status` and `delivery_status_updated_at` columns to notification_log
  3. New edge function `twilio-status-callback`: Twilio POSTs to this URL when message state changes (queued → sent → delivered, or queued → undelivered → failed). Function looks up the notification_log row by provider_id (Twilio message SID) and updates delivery_status.
  4. Update compliance dashboard to render cells based on delivery_status when available, falling back to status when Twilio hasn't called back yet. Color logic:
     - Green = delivered (real success)
     - Yellow = sent (Twilio accepted, awaiting carrier callback, typically <30 sec)
     - Red = undelivered or failed (carrier dropped, real failure)
**Why this matters:** without this, the matrix shows green when carriers are silently dropping every message. With this, HK sees red the moment a delivery actually fails, with the Twilio error code attached.

---

## Per-ribbon improvements

Work mapped to the seven-ribbon taxonomy. Anything that lives inside a single
ribbon's product area goes here.

### Ribbon 1: Find & Book
- **Card-on-file detection for returning clients (TOP PRIORITY, ~1.5 hr).** Real customer-facing bug. See [Detail §5](#5-card-on-file-not-detected-for-returning-clients).
- **Buffer time between sessions (ID 1.8, queued).** Therapist sets X minutes post-booking; system excludes window from available slots. Settings toggle, OFF by default. Per memory.

### Ribbon 2: Know Your Client
- **StatusStrip Agreement tile (deferred from May 15-16, ~75 min).** All design decisions confirmed. See [Detail §8](#8-statusstrip-agreement-tile-deferred-from-may-15-16-session).
- **Lindsey #11 deferred follow-ups.** Body SVG C/T badge rendering on SessionDetail; terms of service consent clause. Not blocking core behavior. See [Detail §2](#2-lindsey-11--focus-distribution-commit-2-of-2-shipped-may-10-2026).
- **Slider redesign + intake auto-save (~4-6 hr).** HK rejected the May 10 design. Sliders next to body image with dotted connectors, editable percent numbers, back button on Preferences, localStorage draft auto-save. See [Detail §4](#4-slider-redesign--intake-flow-improvements-hk-may-10-2026-feedback).
- **Medical history intake (ID 2.6, queued).** Pregnancy, medications, surgeries, conditions checklist, allergies, emergency contact, red-flag surfacing, smart pre-fill on returns. ~60s first time, ~30s returns. Separate build from waiver. Per memory.
- **Duplicate client row investigation (queued, ~1 hr).** Discovered May 17 2026 during Notification Compliance testing: two `clients` rows existed for the same (therapist_id, email) pair under Joy Therapist's account. One created May 16 with phone +13462426904, one created May 17 with phone (513) 909-9004. The auto-fire targeted the newer row (513) when we expected the older row (346). Booking page logic likely creates a new client row when (email lookup misses) OR (some race condition during checkout). Tasks: (a) reproduce by booking twice with same email through `/book/healinghands`, observe whether second booking creates a new client row or updates the existing, (b) add a unique constraint on `(therapist_id, lower(email))` after deduping production data, (c) write a `merge_duplicate_clients(target_id, source_id)` SQL function that consolidates bookings + sessions + push subs + notification logs onto the target row before deleting source. Until this is fixed, all per-therapist client lookups risk targeting the wrong row.

### Ribbon 3: Client Intelligence
- **Edit button on SessionDetail not visible (diagnostic).** Code shipped May 10 but HK does not see the button. See [Detail §3](#3-edit-button-on-sessiondetail-not-visible-may-10-2026-commit-339cfcac).

### Ribbon 4: Day-of-Session (Smart Calendar)
- **Smart Calendar SVG animation (~3 hr).** Three-act loop: empty Tuesday noon slot, platform surfaces the right lapsed regular, message draft appears, tap, slot fills. Soft sage and cream palette, mobile-safe SVG, no JS animation library. Replaces `ScheduleDemo` in Ribbon 4. Phase 4 of the May 16 session.
- **Phase 9.1: Partial-day blocks (shipped May 16 evening, commit `401e1679`).** Candice asked for the ability to block a portion of a day without blocking the whole day. HK committed "tonight." Migration adds `start_time`/`end_time` columns to `blocked_days` (both NULL = full day, backward compatible). The Time off panel now has Full-day / Time-range mode pills. Booking page and BookingModal treat partial blocks as pseudo-bookings in the slot-generation pipeline so the existing conflict check handles them, no new logic needed. **Migration still needs to run in Supabase** before partial-block submits work in production.
- **Phase 9.2: Long-press timeline canvas to create a block (shipped May 16 evening, commit `ec4e7e3a`).** HK directive: long-press on calendar to create a block. Built on the existing TimelineView pixel canvas — 500ms long-press anywhere on the timeline opens a confirm sheet with the proposed time window (snapped to 15-min, 1-hour default), an editable end time, an optional reason. Confirms via the same `addBlockedDay({date, startTime, endTime, note})` path Phase 9.1 wired. Canvas always renders now (even on empty days) so long-press works everywhere. Partial blocks for the current day render as amber-striped overlays. Past days disabled.
- **Phase 9.3: Long-press → "block or event" (queued).** HK said "create a block or event." Only block is in 9.2. Event would mean a second option in the sheet: instead of blocking, open BookingModal pre-filled with the long-pressed time so the therapist can schedule a client at that slot. ~1 hour. Reasonable next step but not tonight.

### Ribbon 5: Relationships
- **Daily Evening Digest (queued).** One daily email showing who reached out, who is due for outreach, lapsed clients by pattern. Per memory.

### Ribbon 6: Money & Protection
- **Stripe Connect for billing data (ID 6.5, next active priority after Features page).** Wire in real billing data. Stripe Connect Express live mode already active. Per memory.
- **Supabase cron for `daily-signups-digest`.** Scheduled at `0 12 * * *` (7am Central). HK to set up in Supabase Dashboard > Cron Jobs > Edge Function > POST. Per memory.

### Ribbon 7: On Your Phone
- **Instagram @mybodymap.app 7-day warmup (in progress).** Follow/like/save/comment, no posts. Hook formula: "5 [signs/things/mistakes] that [outcome]" with warning framing that outperforms. 7-sec video: Pexels stock + hook text whole time + "read description below" at 3s. Post 2x/day. HK executing.
- **Reddit launch post.** Drafted, not yet published.
- **Facebook restoration.** HK banned from Massage Therapy Business Builders for over-posting; working with admin to restore access.
- **Image backlog (3 placeholders queued).** Specs: 543×464 JPEG, warm cream/sage palette, no text overlay. Gift cards Features hero, campaigns Features hero, cycle-aligned scheduling 1.2 hero. Batch image asks in groups of 10-20, never one at a time.

---

## 2027 plan

**Status: deferred to 2027.** These are real customer asks from solo LMTs who are growing their practices into multi-staff wellness businesses. Each one is a genuinely good idea AND a category expansion away from our current ICP (solo LMT). Capturing them here so the demand signal accumulates without distracting the 2026 roadmap.

**Why these are 2027, not now:**
1. Our 2026 ICP is solo LMT. Multi-room spas, multi-therapist clinics, and group-class businesses are adjacent markets with different scheduling models, payroll needs, and pricing dynamics.
2. The longitudinal body intelligence moat does not apply to salt rooms, cold plunges, or group classes (no body data per session).
3. Distribution PMF is unproven at the solo-LMT segment yet. Widening scope before that wedge lands is premature.
4. Each item below is 4-12 weeks of dedicated build. Stacking them on top of the 2026 plan would push every existing customer ask another quarter.

**Threshold to graduate any item from 2027 to active:** 5+ explicit asks from paying customers AND solo-LMT segment PMF demonstrated (e.g. 50+ active paying therapists, retention > 80% month-3).

### 2027.1 Resource-based scheduling (multi-room spa support)

**The ask, verbatim (Facebook group, spa owner, May 19 2026):**
*"I'm helping open a spa and having troubles finding a booking site that fits our needs. We will have multiple self-service rooms such as a salt room with 7 seats, an infrared sauna, one massage room, mineral soak bath room, 2 cold plunges, an outdoor steam sauna. For beginning, there will be one massage therapist working and 1-2 front desk workers that will get people started in the other self-service rooms and clean them between sessions. My main issue with booking sites I've tried like Vagaro and GlossGenius is if one person is booked for salt room at 9:00am it isn't showing that we have anything else available. The work around these sites have given me is make each room an employee. Well, every employee has to have an assigned email and that's a lot of fake emails to use and seems like a hassle. What are my options?"*

**Reinforced by AJ (real MyBodyMap customer, May 19 2026):**
*"My shop is becoming similar to this. I've done some research and I think the best one I'm planning to switch to is from MassageBook to Jane. You can just assign each service its own room. And then the room is booked, not just the time. I've almost hit 1600 clients and I'm booked out and could use another therapist. The part from transitioning from single owner and employee operation to an actually wellness spa and functioning business is rough."*

**Two real customers have flagged this in the same week.** Pattern is forming.

**The category problem.** Vagaro, GlossGenius, MassageBook, Acuity, Square Appointments all use person-led scheduling: every appointment belongs to an `employee_id`. Their availability query asks "is this employee free at 9am." That model cannot represent "the salt room can hold 7 simultaneous bookings while the massage therapist is also working in the massage room and the front desk is handling 2 self-service rooms in parallel." Jane.app, Mindbody, Booker, and Zenoti use resource-led scheduling and can. The cheaper personal-service platforms tell customers to "make each room an employee" as a workaround, which creates fake employees in reports, payroll, and staff calendars.

**What MyBodyMap would need to build.**
- New `resources` table (id, name, capacity, location_id)
- New `service_resources` map (service_id → required_resource_id, optional_staff_required)
- Rewritten availability query that checks resource seats AND optionally staff availability as separate constraints
- Booking-page UI changes: rooms-as-resources view, capacity indicators per slot, group-class style seat-picking for high-capacity rooms (salt room)
- Settings UI: define rooms, assign services to rooms, set per-resource working hours
- Reports & dashboards: revenue per resource, utilization per resource, staffing-vs-resource gaps

**Estimate: 4-6 weeks of focused build.** Most of the work is the availability query rewrite (touches every scheduling surface) and the booking-page UX (rooms are not visible to clients today).

**Risk:** scope-creeps MyBodyMap into Mindbody/Zenoti territory where their feature set is mature and we have no edge. Spa owners already have decent options. Solo LMTs do not.

**Action between now and 2027:**
- Track ask count per quarter. If 5+ paying customers ask, escalate.
- Reply to Facebook spa owner with Mindbody / Booker / Jane recommendations and reasoning (see canned reply in chat history May 19 2026).
- When AJ pings about expansion, point her to Jane.app honestly, then track whether she switches or asks us to build it.

### 2027.2 Group classes & multi-spot capacity booking

**The ask, from AJ (real MyBodyMap customer):**
*"I'd love to know more about your receptionists. Does your other services offset and pay enough to afford the receptionist? How much do you pay them, how many hours do they work, and what is their role. I definitely need to get a receptionist but how do you justify another 1500 going out without us working that much more to cover it."*

AJ has asked about group classes and packages multiple times in our threads. Her practice is shifting from one-on-one massage to a wellness spa with multiple service categories: massage rooms, recovery rooms, and class-style group offerings.

**The feature:**
- Service marked as "class" with `max_attendees` (e.g. 6, 10, 20)
- Booking page shows class slots with "5 of 10 spots remaining"
- Per-attendee intake, attendance check-in, waitlist when full
- Pricing per attendee (not per booking), discounts for series passes, drop-in vs membership pricing
- Class roster view for the therapist (who is coming, attendance history, contact info)

**Why bundled with 2027.1:** group classes share the resource-led data model. If we build resources, classes are 80% of the way there (a class is "one room with N seats for one time block, hosted by staff").

**Estimate: 2-3 weeks ADDITIONAL to 2027.1.** Doing both together saves time vs separate.

### 2027.3 Multi-staff team support with payroll and commission

**Implied by AJ's situation and the spa owner's setup.** Once you have a receptionist (2 hourly staff at $15-25/hr) plus a contracted second therapist (1099 with revenue share), the platform needs:

- Staff roles beyond "owner therapist" (front desk, contractor therapist, salaried therapist)
- Schedule assignment per staff member (which days they work, which services they perform)
- Commission / revenue-split tracking per booking (e.g. "Sarah gets 60% of her bookings, owner gets 40%")
- Tip routing (whose tip is it?)
- Payroll exports (CSV ready for Gusto / ADP)
- Staff PIN for tablet check-in (front desk uses iPad, doesn't have full owner credentials)

**The ask, verbatim:**
*"It seems I've helped a few convince them to go on their own and in addition to the encouragement in these groups being against employee status, it's been hard to find anyone who doesn't want to be contract work. I'm not about to risk my brand for someone that isn't respectful of my business and what I've built."*

So 1099 contractor model first (single revenue-share rule per contractor), W-2 staff later if at all.

**Estimate: 6-8 weeks.** Touches auth (roles), bookings (assignment), session_payments (commission split), every report, every dashboard.

### 2027.4 Receptionist mode (front desk tablet UX)

Spin-off of 2027.3 but valuable on its own. AJ's "$1500 going out" question is about justifying a receptionist; the platform can make a receptionist 2x more productive than the owner doing it herself.

- Tablet-optimized check-in screen ("who is here, who is on table, who is next")
- One-tap mark-paid for walk-in cash
- Inventory of self-service room availability ("salt room: 4 of 7 seats taken, sauna: free")
- Front-desk-only auth with limited PII access (can see booking, can take payment, cannot edit clinical notes)
- Cleaning checklist between rooms with timestamps

**Estimate: 2-3 weeks AFTER 2027.3 lands.** Reuses the staff role and auth work.

### Tracking demand for 2027 items

| Item | Asks to date | Source |
|---|---|---|
| 2027.1 Resource scheduling | 2 | FB spa owner (May 19), AJ (May 19) |
| 2027.2 Group classes | 2 | AJ (multiple), Jackie (earlier thread) |
| 2027.3 Multi-staff + commission | 1 | AJ (May 19, implied) |
| 2027.4 Receptionist mode | 1 | AJ (May 19, implied) |

Update this table as new asks come in. When any single item crosses 5 paying-customer asks, re-evaluate against the 2027 graduation threshold.

---

## Details

All execution-ready materials. Each entry below is the original detailed block,
preserved so you can drop in and run when an item becomes active.

## 1. Google OAuth app verification

**Current status (May 10 2026 EOD).** HK started the verification
submission in Google Cloud Console. Form is partially filled but
not submitted. Missing pieces:

- Demo video not yet recorded. Script is below, phone-friendly
  version added. ~2.5-3 minute screen recording, voiceover
  recommended but on-screen captions acceptable.
- Scope justification text not yet pasted. Tightened version for
  the form's compact box is below under 'Materials: Scope
  justification (form version)'.
- 'Additional info' field may or may not appear depending on
  Google's flow. Pre-drafted text below in case it shows up.
- Privacy policy and terms of service URLs not yet verified live
  at https://www.mybodymap.app/privacy and /terms. Google will
  bounce the submission within a day if these aren't reachable.

**Next time on this:** open BLOCK_PLAN.md, scroll to this entry,
copy the three text blocks below into Google's form, record the
video using the phone script, upload to YouTube as Unlisted,
paste the URL, click Submit. ~45 minutes total.

**Why blocked.** Submitting now while still iterating on the
OAuth flow risks needing to resubmit if anything changes. Better
to lock the consent screen branding, prove the flow works
end-to-end with a few real therapists in Testing mode first, then
submit once stable.

**When to revisit.** As soon as one of these is true:

- Five or more therapists have successfully connected Google
  Calendar via the Testing flow (so we know the flow is solid)
- We are close to scaling past 100 test users (Google's Testing
  mode hard cap; production users can not connect until verified)
- A privacy policy and terms of service are live at
  https://www.mybodymap.app/privacy and /terms (Google requires
  reachable URLs as part of the submission)

Whichever comes first. Realistically, 2-4 weeks from May 10 2026.

**Why this matters.** While the app sits in Testing mode, every
therapist who connects sees a yellow "Google hasn't verified this
app" warning mid-flow with an "Advanced" link they have to click,
then a "Go to MyBodyMap (unsafe)" link. A 70-year-old persona
will not click "(unsafe)". Verification removes the warning.

**How long verification takes.** Google reviews 2-6 weeks for
apps using sensitive scopes (calendar.events is sensitive). No
cost. We submit once.

### Materials: Scope justification (form version)

This is the tightened version designed for Google's compact
scope justification box. Use this instead of the long paragraph
above when filling out the actual submission form.

> MyBodyMap is a scheduling and client retention platform for solo
> licensed massage therapists. We request the calendar.events
> scope to provide two-way synchronization between MyBodyMap
> bookings and the therapist's Google Calendar.
>
> Specifically: (1) when a client books a massage on MyBodyMap, we
> write a corresponding event to the therapist's primary Google
> Calendar so the therapist sees all their commitments in one
> calendar. (2) When the therapist adds personal events to their
> Google Calendar (lunch, dentist, family commitments), we read
> those events and block matching time ranges on the therapist's
> public MyBodyMap booking page so clients cannot accidentally
> book over personal commitments.
>
> We read event start time, end time, and summary (title). The
> summary is only displayed to the therapist on their own
> dashboard so they can see what is blocking their time. Clients
> on the public booking page never see event summaries; they see
> those time ranges as unavailable with no detail. We write
> events with the client's first name, service name, and duration.
>
> OAuth tokens are stored encrypted in our Supabase Postgres
> database, gated by row-level security policies scoped to the
> authenticated therapist. Event data and tokens are deleted
> immediately when a therapist disconnects Google Calendar from
> their MyBodyMap settings, or when they close their MyBodyMap
> account. We do not share, sell, or use this data for advertising,
> machine learning, or any third-party service. This scope is the
> minimum necessary to enable two-way calendar synchronization.

### Materials: Additional info field (if it appears)

Google's submission form sometimes shows an 'Additional info'
text box (1000 char limit) after the scope justification step. If
it appears, paste this. If it doesn't appear, skip.

Replace the two `[PASTE...]` placeholders before pasting.

```
MyBodyMap (mybodymap.app) is a production scheduling platform for solo licensed massage therapists.

Test user credentials:
  Email: bodymapdemo@gmail.com
  Password: [PASTE YOUR TEST ACCOUNT PASSWORD]

After login, navigate to Settings to find the Google Calendar sync section under "How I plug in." The Connect button initiates the OAuth flow shown in the demo video.

This is our only OAuth-using project. The application is deployed on Vercel with backend services on Supabase. All Google Calendar API traffic flows through Supabase edge functions; the React frontend never handles tokens directly.

We are currently in Testing mode and have onboarded test therapists on the whitelist. We are submitting for verification to support our broader rollout to founding therapists.

Contact for verification questions: [PASTE YOUR EMAIL HERE]
```

### Materials: Phone-friendly video script

Recommended approach for HK: phone screen recording, landscape
orientation, voiceover spoken into the phone mic. 2.5-3 minute
target. One continuous take preferred over edited cuts.

Tools: iOS Screen Recording (Control Center > Record button),
Android Screen Record, or Loom on mobile. Upload to YouTube as
**Unlisted** (not Public, not Private).

If voiceover is impractical, captions in YouTube Studio after
upload are an acceptable substitute. Google requires either,
not both.

Before recording:
- Enable Do Not Disturb so notifications don't pop up
- Lock orientation to landscape
- Close all other apps in app switcher
- Have a test therapist account ready: bodymapdemo@gmail.com
- Pre-create one or two test events on the test account's Google
  Calendar (e.g. "Dentist" Tuesday 2pm, "Lunch" tomorrow noon)
  so they're visible when the script gets to that beat

**[Start screen recording. Open Safari/Chrome. Go to mybodymap.app.]**

> Hi, this is a demo of MyBodyMap. We're a scheduling platform for solo massage therapists. I'm going to walk through our Google Calendar integration end to end.

**[Tap Log In. Log into bodymapdemo@gmail.com.]**

> I'm logging in as a test therapist.

**[Land on dashboard. Tap into Settings, scroll to How I plug in.]**

> In Settings, under "How I plug in," there's a section called Google Calendar sync.

**[Tap the Google Calendar sync row to expand it. Pause briefly so the screen shows the description.]**

> The therapist sees what the integration does. Bookings made here will appear in their Google Calendar. Personal events from Google Calendar will block client bookings on their public page. The note also explains that Google events show up in MyBodyMap within fifteen minutes.

**[Tap Connect.]**

> When they tap Connect, they're sent to Google's consent screen.

**[Wait on the Google consent screen for 3-4 seconds so the reviewer can see the scope clearly. Don't tap anything yet.]**

> We request the calendar.events scope only. This is the minimum we need to write booking events to the therapist's calendar and to read events the therapist has added so we can block those times for clients.

**[Tap Allow.]**

> The therapist allows access.

**[Google redirects back to MyBodyMap settings. The green Connected banner appears.]**

> Google redirects back, and MyBodyMap confirms the connection. The settings row now shows the connected Google account.

**[Tap Sync Now.]**

> I'm triggering an immediate sync. Normally this happens every fifteen minutes automatically.

**[Switch apps to Google Calendar on phone. Show the existing test events.]**

> Here's the same therapist's Google Calendar. There's a dentist appointment and a lunch event already on the calendar.

**[Switch back to MyBodyMap. Tap into the Schedule view.]**

> Back in MyBodyMap, the schedule shows those same events in lavender, labeled "From Google."

**[Tap on one of the lavender entries to open the read-only detail panel.]**

> Tapping one shows a read-only panel. The therapist sees the event title, "Dentist." There's no reschedule or cancel button here because edits live in Google Calendar. The panel reminds them changes take up to fifteen minutes to sync.

**[Close the panel. Open a fresh incognito tab. Navigate to the public booking page.]**

> Here's the public booking page a client sees. I'll try to pick the Tuesday afternoon that has the dentist appointment.

**[Try to select Tuesday 2 PM. The slot should not be offered.]**

> Two PM is not offered. The client never sees the word "Dentist" or any indication of why the time is unavailable. They just see that slot as unavailable.

**[Pick a different open time. Complete a test booking.]**

> I'm completing a test booking for a different open time.

**[Confirmation appears. Switch to Google Calendar. Wait a few seconds, refresh.]**

> Within a few seconds, the new booking appears in the therapist's Google Calendar. Title is the client's first name and service.

**[Switch back to MyBodyMap settings. Tap Disconnect.]**

> Finally, the disconnect flow. From settings, the therapist taps Disconnect.

**[Confirm the disconnect.]**

> Disconnecting immediately stops sync in both directions. Existing events stay where they are so nothing is lost, but no new events sync either way. We delete OAuth tokens from our database immediately. The therapist can reconnect anytime.

**[Final pause on the disconnected state.]**

> That's the full Google Calendar integration. Thank you.

**[Stop recording. Upload to YouTube as Unlisted. Paste URL into the verification form.]**

### Materials: Justification paragraph (long version, for reference)

Paste this into the "Justification" field on the Google
verification form for the `calendar.events` scope. Edit the
wording lightly if Google asks for anything more specific.

> MyBodyMap is a scheduling and client retention platform built
> for solo licensed massage therapists. Therapists use our
> service to accept new bookings from clients, manage their own
> appointment calendar, and run their solo practice.
>
> We request the `https://www.googleapis.com/auth/calendar.events`
> scope so that bookings created in MyBodyMap automatically
> appear in the therapist's primary Google Calendar, and so that
> personal events the therapist adds to their Google Calendar
> (lunch, dentist, family commitments) automatically block new
> client bookings on the MyBodyMap public booking page. This
> two-way synchronization eliminates the most common scheduling
> failure mode for solo practitioners: a client booking on top
> of a personal commitment that lived only in the therapist's
> personal calendar.
>
> Data handled: MyBodyMap reads event start time, end time, and
> summary (title) for events on the therapist's primary calendar.
> We use the summary only to show the therapist on their own
> dashboard what is blocking their time ("dentist", "lunch").
> Clients on the public booking page never see event summaries;
> they only see slots as available or unavailable. We write
> events to the therapist's primary calendar that mirror
> bookings made in MyBodyMap (client first name, service name,
> location).
>
> Storage: OAuth tokens are stored encrypted in our Supabase
> Postgres database, accessible only via row-level security
> policies that gate every query to the authenticated therapist's
> own row. Event data is stored only for events on the connected
> therapist's calendar, scoped to their record. Tokens and event
> data are deleted immediately when a therapist disconnects
> Google Calendar from their MyBodyMap settings, or when they
> close their MyBodyMap account.
>
> We do not share, sell, or use Google user data for any purpose
> other than the synchronization described above. We do not use
> it for advertising, machine learning training, or any third
> party service. All data is transmitted over HTTPS and at rest
> encryption is provided by Supabase.

### Materials: Demo video script

Total length: aim for 3-4 minutes. Record at 1080p, screen
recording only (no webcam). Use Loom, OBS, QuickTime, or
anything else. Upload to YouTube as **Unlisted** (not Public, not
Private). Give Google the unlisted URL on the verification form.

**Script.** Read or paraphrase as voiceover. Bracketed text is
what to do on screen.

> [Open mybodymap.app in a fresh browser window. Show the home
> page.]
>
> Hi, this is a demo of MyBodyMap, a scheduling platform for
> solo massage therapists. I am going to walk through how a
> therapist connects their Google Calendar to MyBodyMap and what
> happens when they do.
>
> [Click "Log in" in the top nav. Log in as a test therapist
> account, like bodymapdemo@gmail.com. Land on the dashboard.]
>
> This is the therapist's dashboard. They see their bookings,
> their schedule, and their settings here. I am going to go to
> the settings page now.
>
> [Click the gear icon or "Settings" link.]
>
> In settings, under "How I plug in," there is a section called
> Google Calendar sync. Let me open it.
>
> [Scroll to and click on the Google Calendar sync disclosure
> row to expand it.]
>
> The therapist sees a description of what the integration does:
> bookings created here go into their Google Calendar, and
> personal events from Google Calendar block client bookings on
> their public booking page. There is also a clear note that
> events from Google show up in MyBodyMap within 15 minutes
> because we poll the Google Calendar API every 15 minutes
> rather than using real-time webhooks.
>
> Now I will click Connect.
>
> [Click the Connect button.]
>
> The therapist is sent to Google's standard OAuth consent
> screen. They see that MyBodyMap is requesting access to view
> and edit events on their calendar.
>
> [Wait on the consent screen so the reviewer can see what is
> being requested. Read out the scope.]
>
> The scope requested is calendar.events. This is the minimum
> scope we need to create booking events in the therapist's
> calendar and to read events the therapist has added so we can
> block those times on their public booking page.
>
> [Click Allow.]
>
> Google redirects back to MyBodyMap. The settings page now
> shows a green confirmation that Google Calendar is connected,
> and the disclosure row updates to show the connected Google
> email address.
>
> [Show the connected state. Click "Sync now."]
>
> I am going to trigger an immediate sync. The therapist does
> not normally need to do this because we sync automatically,
> but it is here for testing.
>
> [Wait for sync to complete. Switch tabs to show Google
> Calendar for the same account. Show any existing events on
> the calendar.]
>
> Here is the same therapist's Google Calendar with a couple of
> personal events: a dentist appointment Tuesday at 2 PM and a
> lunch event Wednesday at noon.
>
> [Switch back to MyBodyMap. Open the Schedule view.]
>
> Back in MyBodyMap, the schedule now shows the dentist and
> lunch events in lavender, labeled From Google. The therapist
> can see what is blocking their time. Clients on the public
> booking page see those same time ranges as unavailable but do
> not see the event titles.
>
> [Click on one of the From-Google events to show the read-only
> detail panel.]
>
> Tapping a From-Google event opens a read-only panel showing
> just the event title and time. There is no reschedule or
> cancel option because that lives in Google Calendar. The
> panel explains that edits to this event happen in Google
> Calendar and show up here within 15 minutes.
>
> [Close the panel. Open the public booking page in an incognito
> window or a different browser to demonstrate the client view.]
>
> Here is the public booking page that a new client sees. I
> will pick the same Tuesday at 2 PM that has the dentist event.
>
> [Try to pick a Tuesday 2 PM slot. The slot should be greyed
> out or absent because the dentist event is blocking it.]
>
> Tuesday at 2 PM is not offered. The client never sees the
> word "dentist" or any indication of what is blocking the
> time. They just see it as unavailable, exactly as if the
> therapist had not set working hours for that slot.
>
> [Now make a booking on the public page for a different open
> slot. Walk through the booking flow quickly. Confirm the
> booking.]
>
> I am making a test booking now for a different open slot.
>
> [After confirmation, switch tabs to Google Calendar.]
>
> Within a couple of seconds, the booking appears as a new
> event in the therapist's Google Calendar. The event title is
> the client's first name and service. The therapist can see
> their full day in one place.
>
> [Switch back to MyBodyMap settings. Click Disconnect.]
>
> Finally, I want to show the disconnect flow. From the
> Google Calendar sync section in settings, the therapist
> clicks Disconnect.
>
> [Click Disconnect. Show the confirmation.]
>
> Disconnecting immediately stops sync in both directions.
> Existing events stay in Google Calendar so nothing is lost,
> but no new events flow either way. We also delete the
> therapist's OAuth tokens from our database immediately. They
> can reconnect at any time.
>
> That's the full Google Calendar integration. Thank you.

**Production notes.** Record in a quiet room, use the laptop
microphone or a USB mic. Do not edit unless something breaks
mid-recording; reviewers prefer one continuous take. Aim for
under 5 minutes. Mention every scope you are requesting and
demonstrate it being used. Show what data is read, where it is
displayed, and how disconnect works.

### Checklist before submission

- [ ] Privacy policy live at https://www.mybodymap.app/privacy
      with all required disclosures (Google data handling, third
      party services, contact email)
- [ ] Terms of service live at https://www.mybodymap.app/terms
- [ ] OAuth Branding tab in Google Cloud Console fully filled
      (app name MyBodyMap, support email, dev contact, app home
      page, privacy policy link, terms link, logo at 120x120)
- [ ] At least 5 therapists have connected and used the
      integration successfully without escalating to support
- [ ] Demo video recorded and uploaded to YouTube as Unlisted
- [ ] Justification paragraph copied into the verification form
- [ ] Click "Publish App" on the OAuth consent screen to switch
      from Testing to In Production. This auto-triggers the
      submission flow for sensitive scopes.

### After submission

- Google emails the developer contact when the review is
  complete (approved or needs changes)
- If they ask for changes (common on first submission), they will
  list exactly what to fix. Common asks: clearer privacy policy
  wording around data deletion, more specific scope justification,
  re-record video with a particular feature shown
- Once approved, the "Google hasn't verified this app" warning is
  gone for all users (not just Testing mode whitelist)
- Therapists who connected during Testing mode stay connected
  through the transition; no action needed on their end

---

## 2. Lindsey #11 + Focus Distribution (commit 2 of 2 shipped May 10 2026)

**Status.** Core build complete. Therapist can now edit intake
text/preference fields from SessionDetail with full audit trail.
Focus distribution sliders auto-derive on the back-body screen
and persist to the session row.

**What shipped (commit 1 + commit 2)**

- Migration `2026-05-10-editable-intake.sql` applied. Schema has
  the 8 new session columns plus intake_edits audit table.
- FocusDistribution component wired into Demo.jsx back-body
  screen. Auto-derives from focus zone selections. Locks when
  user manually drags any slider. Saves to sessions table via
  intakeData.frontPct/topPct/middlePct/bottomPct.
- SessionDetail has an Edit button on Client Preferences. Click
  to switch all 10 preference fields plus med_note and
  client_notes into editable inputs. Save writes the diff to
  sessions table AND one intake_edits row per changed field.
  Audit trail per the signed waiver.
- Default waiver text now includes a consent line for therapist
  intake corrections.
- Intake review screen shows a small italic note that the
  therapist may update intake for accuracy.

**What is deferred to a future commit**

- **Body SVG C/T badge rendering.** Therapist can edit text
  fields today but cannot edit body zone selections from
  SessionDetail. The columns front_focus_therapist /
  back_focus_therapist / front_avoid_therapist /
  back_avoid_therapist exist in the schema but are not yet
  populated by any UI. Future work: add a body-map edit mode
  to SessionDetail with C/T differentiation.
- **Terms of service consent clause.** There is no /terms page
  in the app today. The waiver carries the consent for now.
  When a real terms page is added, copy the relevant clause
  from the waiver into the terms.

These are good follow-ups but not blocking the core #11
behavior. The audit-log + edit flow for the most-edited fields
(pressure, music, lighting, med_flag, client_notes, etc.) is
fully working.

---

## 3. Edit button on SessionDetail not visible (May 10 2026 commit 339cfcac)

**Status.** Code shipped, but HK does not see the button. URL
verified to be `view="session-detail"` so the SessionDetail
component IS rendering. Edit button code is at
`src/components/SessionDetail.js` line ~432-439, inside the
Client Preferences card, gated on `!editingIntake` which starts
false. No visibility condition should be hiding it.

**Possibilities, ranked.**

1. Vercel build hadn't propagated when HK tested. Hard refresh
   in incognito on the exact URL HK shared should resolve. Try
   first.
2. There is a second SessionDetail-like component elsewhere
   that the route is actually rendering. Search for
   `view="session-detail"` consumers and trace.
3. My str_replace landed in a code branch that's not reached
   (e.g. there's a conditional that switches between two render
   paths and I edited the wrong one). Diff the file at line
   ~430 against what I committed in 339cfcac to confirm.
4. CSS is hiding it (overflow clipping at small viewports).
   Inspect the rendered DOM in browser devtools, search for
   '✏️ Edit' text, see if the element exists but is
   visually-hidden.

**Reproduction URL:**
https://www.mybodymap.app/dashboard/clients/1565eac6-ceff-4e81-a038-82fe5e8299c6/sessions/3b07f57d-7e94-432c-a2b5-779c14faad1b

Open in incognito after Vercel cache clears (about 90s after
the most recent push). Look for "Client Preferences" card on
the left column. Top-right of that card should show the Edit
button.

**Diagnostic if still not visible:**

Open browser devtools console on the URL above, paste:
```
document.body.innerText.includes('✏️ Edit')
```
- Returns true: button exists in DOM, CSS issue.
- Returns false: render bug, my edit did not land. Re-deploy or
  re-apply the edit at SessionDetail.js line 432.

---

## 4. Slider redesign + intake flow improvements (HK May 10 2026 feedback)

**Why blocked.** The FocusDistribution component shipped in
commit 339cfcac works mechanically but HK rejected the design.
Specific feedback:

- Sliders look like one more thing slapped on at the bottom.
  Should be next to the body image on top of the page, not
  below the body card.
- Percentage numbers on the right (the "20%" labels) should be
  EDITABLE. Client should be able to type a value directly on
  top of the number to override the slider position. Currently
  numbers are display-only.
- Wants the sliders visually attached to the body, like
  pointing at it. Suggestion: dotted lines from each band slider
  to the corresponding zone on the body image.
- No back button on the Preferences screen. Client cannot
  return to front-body or back-body screens to fix a tap. They
  have to start over. Bad persona UX (70-year-old will tap
  wrong zone, then quit).
- No auto-save anywhere in the intake flow. If the client
  drops off mid-form, the work is lost. Wants all selections
  persisted continuously so resuming picks up where they left.

**Realistic scope estimate.**

- Slider redesign with editable number inputs and side-by-body
  placement with dotted connector lines: 2-3 hours of focused
  design and HTML/SVG work. Mobile viewport is tight (~380px)
  so the geometry has to be exact.
- Back button on Preferences: 30 min. Add an onBack prop to
  the preferences screen, render the same back button pattern
  used on the body screens, hook to setScreen('back').
- Auto-save: this is bigger than it sounds. Touches every
  state setter in the intake flow. Two approaches:
    (a) debounced save on every state change, writing partial
        sessions row via upsert. Requires schema rework since
        client_id might not exist yet.
    (b) localStorage draft, restored on page load. Simpler,
        avoids partial DB writes. Probably the right answer.
  Estimate: 1-2 hours with approach (b), 4-6 hours with (a).

**Combined session estimate.** 4-6 hours for a focused
redesign session covering all three items.

**When to revisit.** Next focused session, after the Edit
button visibility issue (entry 3 above) is confirmed resolved.

---

## 5. Card-on-file not detected for returning clients

**Why blocked.** HK reports that after booking 5+ times with
the same name, phone, and email, the booking page still
prompts for a card every time. It should detect the existing
saved card on the clients row and skip the prompt, or show
"card already on file" with the last 4 digits.

Also reports the Client Card view in the Clients tab does not
show whether a card is on file for that client. Same root
cause likely.

**Where the bug lives.**

`src/pages/BookingPage.js` line 767 has `isRepeatClient`
detection. Line 778+ has the card-on-file capture flow.
Somewhere between detecting the returning client and rendering
the booking summary, the "skip the card-prompt if
payment_method_id exists" branch is missing or broken.

`src/components/ClientList.js` and the client detail view do
not surface payment_method_id status. Add a green chip or
similar UI that says "Card on file · ending 4242" when set,
nothing when not.

**Realistic scope estimate.**

- BookingPage card-on-file detection + skip-prompt: 1 hour
  including correct handling of expired cards and cards on a
  different processor than the therapist's current one.
- ClientList / client detail card-on-file indicator: 30 min.

**Total ~1.5 hours.** Customer-facing so high priority for
next session.

**When to revisit.** Top priority for next session, before
the slider redesign. This bug affects real customer
experience right now.

---

## 6. Optional client portal with login

**Current status (May 12 2026).** Ashley Scalzulli asked for a
client login portal (see her email of May 12 2026 for context).
Decision: build it eventually, but make it explicitly OPTIONAL and
keep "no login required" as our headline differentiator.

The "no login required" stance is now codified in:

- `src/pages/WhyBodyMap.jsx` ONLY_MBM[0] "Clients never need to log in"
- `src/pages/Home.jsx` Find & Book sub-feature listed first under
  the booking page row
- `src/data/featuresData.js` Find & Book feature 1.1b "No client
  login, ever"

So when we eventually build the portal, the framing is:
"Clients never NEED a login. If you want them to have one, here
is the option." Not "all clients must create accounts."

**Why blocked.**

1. Only one founding therapist has explicitly asked. Jiny, Terra,
   and Kathy have not. Hard to justify 10-15 hours of work for an
   N=1 request.
2. Building it changes the "no login" marketing claim if we are
   not careful. Has to be framed as opt-in feature, not default.
3. Adds password reset and account recovery support burden the
   therapist would have to handle for their clients. Most solo
   LMTs do not want this overhead.

**When to revisit.** Build this when ANY of these is true:

- Three or more founding therapists have asked for it
- A paying clinic (3+ practitioners) requires it for compliance
  or data sharing
- A specific feature (e.g., client-to-client referral tracking,
  package balance viewing on demand by clients) actually requires
  authenticated client identity to work safely

**Scope (when we build).** ~10-15 hours, multi-session:

- Supabase auth flow for clients, separate from therapists table
  (new `client_users` table linking auth.users to clients.id)
- New `/me/...` route group: dashboard, packages, gift cards,
  referrals
- Magic-link email login (no password) to keep friction low
- Therapist setting: `enable_client_portal` boolean per therapist
  row, defaults false. Therapists who never enable it: zero
  change. Therapists who enable: clients get an "Optionally
  create an account" link in confirmation emails.
- Marketing pages updated to add a small footnote on "no login
  required" copy: "If you want, an optional client portal is
  available; most therapists keep it off."

**Materials.**

- Schema: `client_users` table with columns id, auth_user_id,
  client_id, created_at, last_login_at. Foreign key to clients.id.
- Magic-link template: needs a new edge function
  `send-client-magic-link` similar to existing email senders.
- 70-year-old persona pass on UX copy before launch: avoid
  symbols, plain language, "Sign in to see your sessions" not
  "Authenticate to access your account."
- Mention in the next handover doc once we have 2+ more requests
  for this feature, to start tracking demand signal.



## 7. Twilio onboarding friction (recurring)

**Status (May 15 2026).** Candice was the second therapist this month
who needed me to walk her through Twilio signup. The MyBodyMap side
is fine (Settings 4.4 has clear instructions, Save & Connect works),
but Twilio's own onboarding has frictions we can not control from our
side:

1. **Trial mode trap.** New Twilio accounts can only send SMS to
   numbers verified inside Twilio. Therapists do not read this in
   the signup flow, then send a campaign to 80 clients, see 79
   delivery failures.
2. **10-DLC registration (US carrier requirement).** Since 2023
   carriers require A2P (application-to-person) registration for
   any SMS sender. Twilio handles this in a separate flow that
   most therapists do not find. Unregistered messages get filtered.
3. **$15 trial credit ends fast.** A handful of outreach campaigns
   plus reminders burns through in a week. Then sends silently fail.
4. **Three credentials to copy.** Account SID, Auth Token, phone
   number. The Auth Token is hidden behind a "View" click. Easy to
   paste the wrong field or fat-finger the SID.

**Why blocked.** Twilio is good-enough-for-now. The real fix is
either to:

- (a) Switch to a managed SMS layer (Telnyx, Plivo, or Twilio's
  managed A2P flow). Removes per-therapist setup entirely. Bigger
  build, ~12-15 hours, and changes our pricing model since we
  would have to bundle the SMS cost.
- (b) Add an in-app Twilio onboarding wizard that walks the
  therapist through signup with screenshots of each Twilio
  screen, plus a built-in test-send. ~3 hours. Does not solve
  trial-mode or 10-DLC but reduces the support load per therapist.

Neither is urgent at our current scale (<10 therapists using
SMS), but the issue compounds linearly with each new SMS-using
therapist.

**When to revisit.** When ANY of these is true:

- A third therapist in the same month needs Twilio handholding
- A therapist abandons MyBodyMap because SMS setup was too hard
- We add a paid tier that includes SMS as a bundled feature
- The 10-DLC enforcement tightens (carriers start blocking
  unregistered traffic more aggressively, observable by spike in
  failed deliveries from our Twilio relay edge function logs)

**Materials.** Per-therapist Twilio walkthrough script (used for
Candice on May 15 2026, reusable for the next two before we are
forced to build the wizard):

```
1. Sign up at twilio.com. Verify your real phone.
2. Pick SMS / Notify customers / With code.
3. Buy a number, local area code, ~$1.15/mo.
4. Console → Account Info: copy SID, Auth Token, number.
5. MyBodyMap Settings → How I plug in → Custom SMS sender (Twilio)
   → paste all three → Save & Connect.
6. Upgrade Twilio: add credit card, buy $20 in credit. Trial mode
   only sends to verified-in-Twilio numbers; upgraded mode sends
   to anyone.
7. Optional but recommended: register A2P 10-DLC brand and
   campaign in Twilio. Required for US carriers to deliver
   reliably. Twilio has a guided flow under Messaging → Regulatory
   Compliance.
```

**Note on tone of escalation.** If we hit 3 onboarding pings in a
single month, build (b) immediately. The cost of HK handholding
each new therapist through Twilio is higher than building the
wizard once.

---

## 8. StatusStrip Agreement tile (deferred from May 15-16 session)

**Current status (May 16 2026).** The Send-for-Signature flow shipped this session as an inline panel from the PracticeAgreement editor. Therapists can pick a client, edit a custom prepared message, generate a short URL, and have the agreement email auto-fire. Once the client signs, a new AgreementCard surfaces on the client profile (order=6) showing signer name, datetime, and the snapshot of agreed text. All complete.

**Deferred piece.** The client profile StatusStrip (the row of compact attention tiles at the top of every client profile) still uses the old `pendingIntake` logic and does not yet have a permanent Agreement tile. The plan is to replace the conditional Attention chip with a permanent Agreement tile that always shows current agreement state at a glance.

**Why blocked.** Stripe Connect debugging became urgent during the session (HK and Candice both stuck on Stripe issues). All 75 minutes of remaining attention went to Stripe. The StatusStrip work was at a clean stopping point with no half-shipped state.

**When to revisit.** Next focused session. Should take 75 minutes including verification.

**Materials.** All design decisions confirmed by HK during the session before deferral:

1. **Tile content when signed.** Two lines: "Signed [date]" on top, "by [signer name]" underneath. Uses the agreement_send_requests row's `signed_at` and `signer_name`. Forest accent color matching the rest of the agreement surface.

2. **Tile content when unsigned.** "Not on file" on top, "Tap to send" underneath in subtle italic. Amber tone to indicate action needed without alarm.

3. **Tap behavior.** When signed, tap scrolls the profile to the AgreementCard section so the therapist can see the full snapshot. When unsigned, tap opens the SendForSignaturePanel for this specific client (pre-fill the client_id) so they can send the request in one tap.

4. **Remove the pendingIntake conditional logic.** That tile was a temporary hack. Replace entirely with the Agreement tile which is always visible. If we later want an Intake-status tile, build it separately. Do not pile both into one slot.

5. **Position in the strip.** Between the existing "Last seen" tile and any other always-visible tile. Permanent slot. Never hidden.

**Files to touch.**
- `src/components/ClientProfile/StatusStrip.jsx` (remove pendingIntake, add AgreementTile)
- May need to expose `signed_at` / `signer_name` / `signed_text_snapshot` from the client row in `clients` table or via a separate fetch of the most-recent signed `agreement_send_requests` row for this client. Check what AgreementCard already does for this lookup and reuse.

**Verification after build.**
- Three test clients: (a) one with a signed agreement, (b) one with a sent-unsigned agreement, (c) one with no agreement at all.
- For (a), tile shows signer name and date; tap scrolls to AgreementCard.
- For (b) and (c), tile shows "Not on file Tap to send"; tap opens SendForSignaturePanel pre-filled.
- StatusStrip layout does not break on mobile (375px wide).
- No em dashes in any new text.

**Estimate.** 75 minutes including the verification above. HK confirmed during deferral.
