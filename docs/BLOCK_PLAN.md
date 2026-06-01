# BLOCK_PLAN.md

Working document for everything queued, blocked, deferred, or in-flight.
Read the **Summary** below to know where things stand in five minutes.
Read the **per-ribbon** sections to see what's coming on your platform.
Drop into **Details** at the bottom only when you need execution-ready
materials for a specific block.

**Most recent activity:** May 25 2026 (evening, Phase 22-25a). PHASE 25a: pending-approval bookings no longer fire misleading "X just booked their first session" emails (skipped when status is pending-approval); therapist CTA from approval emails now goes to /dashboard/schedule (where the Pending Requests panel sits at top) instead of /dashboard/clients (blank for new clients). Settings warning banner added inside Deposit disclosure when both approval and deposit are on, explaining that deposits are not auto-collected after approval and pointing to manual workaround. PHASE 24f: Web Speech API dictation (`MicDictationButton`) wired into all 4 SOAP fields + Private notes + Recap message (6 mic buttons total) for desktop parity with phone keyboard mic. Per-doc print/send shortcuts: 4 pill buttons (📋 Intake / 🌿 Brief / ✍️ Record / 💌 Recap) below journey dots, each opens SessionDetail with the relevant DocumentDrawer pre-opened via `?doc=N` URL param. PHASE 24e: Body Map Patterns heatmap overlay (THE MOAT) now rendering in the slide-over: front + back BodyDiagram silhouettes side by side showing all sessions overlaid, recurring focus zones grow as bigger sage circles, avoid zones in rose. Threshold dropped to 2+ sessions (was 3+). Collapse all / Expand all toggle at top of cockpit. Therapist override CTA "Fill intake on behalf of client" in Brief empty state. PracticeIQ rebrand applied across 54 in-app occurrences + 12 doc occurrences. PHASE 24d: slide-over width responsive (min(560px, max(360px, 40vw))) instead of hard-coded 360px, body scroll lock when slide-over is open, overscroll-behavior:contain to stop scroll chaining, session journey moved into its own CockpitSection with greyed placeholder for pending-intake bookings, recap save flow now two-step confirm + prominent green sent card. PHASE 24c: persistent scroll-past-Cancel bug fixed by moving paddingBottom from outer container to inner content (WebKit bug). Cancel button demoted from tiny ✕ to confident red underlined text link. "📧 Pending" misleading text removed from schedule cards (was the reminder email status, read as session-pending). Cockpit panels ungated from currentSession so pending-intake bookings show panels with empty states. PHASE 24a-b: design tokens (SO), Label component, EmptyStateCard helper, btnPrimary/btnSecondary button reduction. FOUNDER INCOME STATEMENT shipped at /founder section 9 with self-seeding `finance_line_items` table (Vercel/Supabase/Resend/Twilio/Stripe/Anthropic/legal/insurance lines pre-seeded from chats). Resend `error_message` column finally captured on failed sends (had been stuffed into body_snippet with RESEND_ERROR prefix, hiding the 105 "(no error logged)" rows that were all 429 rate-limit-exceeded). Add-ons wired into therapist-initiated BookingModal. BLOCK_PLAN items 25b (auto-charge deposit from card-on-file on approval), 30 (11 missing client notification touchpoints), and 31 (custom email composer preference for mailto: alternative) QUEUED.

---

**Previous activity:** May 25 2026 (morning + midday, Phase 20 + Phase 21 session cockpit). PHASE 21 polish ON TOP of Phase 20: BodyMapPreview rewrite (front + back silhouettes side by side, distribution bars for front_pct and back top/middle/bottom, no more 'show body map' toggle), RecordEditor now has therapist's private notes scratchpad (separate from SOAP fields) + dictation nudge banner + '✨ Use PracticeIQ' button (no AI wording), RecapEditor now fires send-post-session edge function via Resend on Save & send (A1 wire), edit-time button moved INLINE next to time row (F1, label changed to 'Edit time'). PHASE 20: schedule slide-over rebuilt as full session cockpit (data foundation in 20.0, status pills + insight line in 20.1, DocumentJourney inline in 20.2, Brief panel in 20.3, Medical flags in 20.5, Last session in 20.6, Patterns in 20.7, inline SOAP RecordEditor in 20.8, RecapEditor in 20.9). Slide-over header clickable to client profile. Cron rebuild also shipped morning of May 25: all 6 broken crons now auth correctly via hardcoded service_role JWT, 8 client reminders fired this morning at 4am Central. Practice Pulse logic switched from sessions to bookings.

---

## Summary

**Currently active.** What is being worked or is ready to start the moment you OK it.
0. **LEGAL + INSURANCE PROTECTION (Priority 0, week of May 24 2026, ~$2,500 year 1 + $1,500/year ongoing).** Triggered by the May 23-24 Candice incident: if she had not been gracious, she could have filed a claim for lost business or data loss. LLC alone is not enough. Six layers in priority order, do them this week before any new feature work:
    - **0.1 E&O / Tech E&O insurance.** SINGLE HIGHEST-LEVERAGE PURCHASE. Covers data loss, software defects, professional negligence, legal defense costs, settlements up to policy limit ($1-2M typical). Without this, defending a $50K claim could cost $30K-$200K in legal fees alone, even if you win. Quote options: Vouch (most SaaS-friendly), Embroker, Hiscox, Cowbell, Coalition. Online quote in 15-30 min. Budget $800-2,500/year. Deductible ~$1-5K. **Do this within 7 days. Single most important item.**
    - **0.2 LLC compliance review.** Confirm the LLC actually protects you: (a) customer payments flow to LLC bank account, (b) Stripe Connect platform account is in LLC name, (c) all contracts signed as "Hriday, Manager, MyBodyMap LLC" not personal name, (d) no commingling of personal/business funds, (e) Texas franchise tax + annual report current. Veil-piercing is the #1 way LLCs fail to protect owners. 60 min self-audit OR $200-400 with an attorney. Veil-piercing is judged at trial, not at filing, so this matters.
    - **0.3 Terms of Service tightening.** PARTIAL SHIP May 25 2026 (commit `bb2c0494`). Existing Terms.jsx and Privacy.jsx updated additively to add limitation of liability strengthening (lost profits, exemplary/punitive, fees-reflect-risk, fraud carveout), indemnification (one-way, covering professional services claims), AS-IS warranty disclaimer, class action waiver, 30-day notice/cure period, pro-rata refund for annual cancels within 14 days, data controller/processor framing, HIPAA prohibition (no PHI without separate BAA). SMS section 6 (10DLC compliance) intentionally untouched. SOC 2 claim in Privacy softened to accurate "runs on Supabase infrastructure... MyBodyMap itself has not undergone a SOC 2 audit." Wyoming forum and AAA Sheridan County retained per HK decision May 25. **Still pending: TX attorney review ($500-1,000) to validate clauses, especially in light of Wyoming LLC + TX operator structure.** Specific clauses to flag for review: limitation of liability cap formula, arbitration opt-out window, indemnification scope on professional services claims, HIPAA prohibition language, whether forum should switch to Texas.
    - **0.3a. Create legal@mybodymap.app email alias.** QUEUED. Currently using support@mybodymap.app for all legal notices in ToS/Privacy. Set up forwarding to HK's primary inbox before sharing ToS with any enterprise prospects or before TX attorney review. 15 min via DNS provider.
    - **0.3b. Create import@mybodymap.app email alias.** QUEUED. For receiving import-related customer requests (CSV exports, data migration questions). Forwarding to HK's primary inbox. 15 min.
    - **0.3c. Retrieve executed operating agreement from Northwest Registered Agent.** QUEUED. The OA template uploaded May 25 was unsigned (signature line, date, Exhibit 1 capital contribution, bank account resolution, membership certificate all blank). HK believes a signed version exists on Northwest's website. Confirm and download. Without a signed OA, veil-piercing protection is weaker because corporate formalities cannot be demonstrated.
    - **0.3d. File "MyBodyMap" trade name registration with Wyoming Secretary of State.** QUEUED ~$100, ~30 min via Northwest Registered Agent. Legal entity is "BodyMap LLC" but customer-facing product is "MyBodyMap." Trade name filing makes "BodyMap LLC dba MyBodyMap" formally accurate, protects the MyBodyMap brand, and aligns the entity with the domain mybodymap.app.
    - **0.3e. TX foreign LLC qualification (if attorney recommends).** AWAITING TX ATTORNEY ADVICE. Texas BOC Sections 9.001 and 9.251 require foreign LLCs "transacting business" in Texas to register. Activities that count are case-by-case. HK is the Texas-based operator of a Wyoming LLC with no Texas customers. Filing fee is $750 if required. Attorney call should resolve.
    - **0.3f. Decide on HK as named member, manager, or agent of BodyMap LLC.** AWAITING TX ATTORNEY ADVICE. Currently the operating agreement names Daya Gupta as 100% member. HK has no documented authority to sign contracts on behalf of the LLC. Three options: become co-member (cleanest, gives HK legal authority on paper), get written authorization as manager/agent (preserves Daya as sole member, gives HK signing authority), or remain ambiguous (worst, technically every signed contract has shaky authority). Resolve via TX attorney call.
    - **0.4 General Liability insurance.** $400-800/year, often bundled with E&O. Covers physical injury/property damage. Lower priority than E&O but cheap. Required if you ever do in-person events or rent co-working space.
    - **0.5 Public-facing Security & Reliability page.** Add a `/security` or `/reliability` page on mybodymap.app that documents: daily backups (Supabase Pro confirmed), point-in-time recovery available, audit log on all writes (shipped May 24 2026, commit `7ee49a8b`), confirmation gates on destructive ops, soft-delete with 90-day recovery (queued). Acts as evidence of "commercially reasonable" data protection if ever challenged. Self-written, no cost. Acts as a soft moat too (Vagaro, MassageBook, etc. don't show this level of detail).
    - **0.6 Customer-facing language about backups must underpromise.** Audit all marketing/help-center copy that talks about data protection. NEVER say "we never lose data" or "your data is 100% safe." Say "we maintain daily backups for 7 days and can restore your account within 24 hours if needed." Self-audit, no cost. Bonus: when sued, lawyer will say "show me the marketing language" - if it's modest, plaintiff has weaker case for negligence.
    - **Operational hygiene** (covered in safeguards block below): audit log, confirmation gates, archive-before-destroy, soft delete. These are evidence-of-care if anything is ever litigated. Direct lift from the May 23 incident response.
    - **HK is not a lawyer. This is a framework, not legal advice. Book 60 min with a TX small-business attorney this week to walk away with documents drafted specifically for the situation.**
0a. **DATA SAFEGUARDS (Priority 0, ~10 hours total, queued for May 24 morning).** Direct response to the May 23-24 incident where a comprehensive wipe ran against Candice Peek's therapist_id believing it was Jacquie's. 256 clients, 395 bookings, 25 services, plus notification_log/session_payments/activation_events deleted. Recovery took 7 hours and depended on the Supabase Pro daily backup happening to exist. Six layers of structural protection, in priority order:
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
0b. **Real customer issues from May 24 (Terra triage).** Three live reports, all resolved or held for Terra's morning input:
    - **Terra (Under the Trees / Healing Touch / Ponder Place Retreat): "Client record missing on this charge".** RESOLVED May 24 evening. Root cause: 11 bookings with NULL client_id across Terra's accounts, all created via CSV import where the legacy ImportClients.js path (line 1856) silently inserted NULL client_id when the client signature lookup failed. Phase 13.7 backfill had missed these because client records were created AFTER the bookings (Sandy Apr 14 client, others in May; bookings dated May through Sept). Diagnostic match logic: for each broken booking, three independent subqueries scoped to therapist_id (match_by_email, match_by_phone normalized to last-10, match_by_name LOWER). 8 bookings had phone AND name agreeing on the same client_id (Sandy DePaz x3, Amanda Rogers x2, Jackie Rosenberg x2, Brenda Briseno x1). 1 booking had phone-only match (Isenia → "Isenia Sayles", booking only had first name). Preview SQL confirmed all 9 matches were correct same-person links. Applied via 9 surgical UPDATE statements. Verified all 9 now have non-null client_id. HELD for Terra's morning input: Kare (no contact info at all, just first name on the booking, 2026-09-21 Advanced Age) and Maria Cruz (phone 682-438-5449 matched no existing client, 2026-04-29 Advanced Age). Pending HK message to Terra asking whether to create new client records or merge into existing ones under different names.
    - **Terra: 2 clients couldn't fill out intake forms.** RESOLVED. Terra filled out the intake forms herself for both clients (same path as the blind client case). No code action needed.
    - **Terra: blind-client intake.** RESOLVED. HK answered correctly: therapist can go through booking + intake on the client's behalf via existing therapist-initiated booking flow.
    - **Followup queued:** Two-line guard in ImportClients.js around line 1856 to either skip the row or create a stub client when _clientId is undefined (mirrors the safer behavior in the newer runImports.js path which uses `if (!p._clientId) continue;`). Without this, future CSV imports keep producing NULL client_id rows. ~20 min, ships next session. See also Priority 0 item H (NOT NULL constraint on bookings.client_id) which is the structural fix.
    - **Phase 13.9-13.11 SHIPPED May 24 evening (commits c8692328, 28e9eec3, dba1522c).** `findOrCreateClient` rewritten with two-path logic: Path A (email) and Path B (phone fallback when email missing). Phase 13.10 added stub enrichment so a phone-only client created on an earlier booking gets enriched with email rather than duplicated when the same person books again with email. Phase 13.11 added the critical name-match requirement on all phone-based reconciliation so household-shared phones (husband+wife, business partners, family landline) produce separate client records, not one merged one. Documented as FOUNDER_RUNBOOK Procedure 10 with the full reconciliation rule plus a 4-booking worked example covering the husband+wife case. Fixes the bug at the source for all 4 booking-creation paths (BookingModal, BookingPage, runImports, ImportClients).
    - **Cross-therapist NULL client_id scan May 24 evening (read-only).** Found 2 other therapists with NULL client_id bookings outside Terra: Candice Peek (Grounded Grace, 3 bookings May 31 through Jun 11, all future-dated) and Terra's 2 remaining (Kare, Maria Cruz) which were already held pending her input. **Candice held: do not touch her account.** Reasoning: still sensitive after the May 23 incident where Claude wiped her data believing it was Jacquie's. All 3 bookings are future-dated, so she has not hit the "Client record missing on this charge" error yet. When she does, the inline ClientPicker (queued below) will let her self-serve: search her client list, pick the right one, proceed to checkout. No support ping or operator SQL needed from us.
    - **Inline ClientPicker in CheckoutModal QUEUED (~90 min).** When CheckoutModal opens a booking with NULL client_id, render a banner above the method picker: "This booking isn't connected to a client yet. Pick from your list or add a new one." Search field that filters the therapist's clients as they type, plus an inline "+ Add new client" form. On select or create, UPDATE bookings.client_id and proceed to method picker. Fixes the issue self-serve for Candice's 3 holdouts and any future therapist who hits it. Pairs with Phase 13.9-13.11 to close the loop: 13.9-13.11 prevents NEW broken bookings, ClientPicker recovers EXISTING broken ones without a support ping.
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
25. **PreviewModal renders four times in OnboardingChecklist.js.** ~30 min cleanup. Surfaced May 25 2026 while fixing the iOS Close button. `PreviewModal` is rendered at lines 790, 826, 1023, 1454 in `src/components/OnboardingChecklist.js`, all gated on the single `previewOpen` state with `() => setPreviewOpen(false)`. Likely each is inside a different render branch (mobile/desktop/condensed/expanded variants of the checklist). When `previewOpen` is true, all four mount. Visually only one shows due to z-index, but the DOM has four iframes loaded which is a perf hit. Fix: lift the PreviewModal render to the top-level component return (just before the closing fragment/div) so it renders exactly once. Verify all four current call sites still trigger via `setPreviewOpen(true)`.
26. **Membership card visual unification with PackageSection.** SHIPPED May 24 2026 (commit `5679e530`, Phase 2c). Active membership rows now use the same icon-tile + kicker + title + sub-line pattern as active package cards. Forest accent for memberships, gold for packages. Both visually read as siblings. Cancel error handling in PackageSection also moved from window.alert to inline banner during this work. Edit form fields stacked vertically to match the add form fix from Phase 2a.
27. **Cron audit: 6 broken edge function crons.** SHIPPED May 24 2026 evening. Surfaced May 24 morning while debugging Candice's missing renewal rows; verified with `net._http_response` query that EVERY cron was returning 401 silently (pg_cron's "succeeded" status only meant the HTTP request was queued, not that the function ran). Two distinct failure modes confirmed: (a) `UNAUTHORIZED_NO_AUTH_HEADER` from crons with no Authorization header (daily-signups-digest, founder-digest-daily, send-booking-reminders, google-calendar-reverse-sync when service_role_key NULL), (b) `UNAUTHORIZED_INVALID_JWT_FORMAT` from crons with hardcoded anon JWTs predating the Feb 2026 anon key rotation (practice-pulse-daily, send-reminders-daily, send-drip-daily). Fix attempted via `ALTER DATABASE postgres SET app.settings.service_role_key` per the May 14 google-calendar template, but Supabase SQL editor denied permission (`42501: permission denied to set parameter`). Fell back to hardcoded service_role JWT per cron (trade-off: if service_role key ever rotates, update 6 crons instead of one ALTER; service_role keys are long-lived, current one expires 2087 so rotation is rare in practice). All 6 crons rebuilt with identical pattern: net.http_post + hardcoded service_role Bearer header + 30s timeout. Duplicate `send-booking-reminders` cron deleted. `daily-signups-digest` had a critical secondary bug: URL was `/bodymap-ai` instead of `/daily-signups-digest`, so even with auth fixed it would have called the wrong function. Fixed in the same rebuild. Verification: force-fired practice-pulse via net.http_post with the new auth, got `status_code:200` and email landed in bodymapdemo@gmail.com inbox at 3:47 UTC May 25. Tomorrow morning's 9am UTC send-reminders run is the first real production validation. See FOUNDER_RUNBOOK Procedure 11 for the full diagnostic + repair flow.
    - **Practice Pulse logic fix (Phase 11.8) shipped same session (commit 4c170230).** The function was reading from `sessions` table (SOAP notes) to detect "today's activity" but SOAP notes are rare since most therapists never write them. Rewrote the activity gate to use `bookings` table for both today-activity and lapsed/due detection. Same fix replaces the per-client `clients.sessions` subquery with a single batched `bookings.in(client_ids)` query, more efficient. Also added defensive `select('*')` on therapists (was selecting `practice_pulse_email` explicitly which exists today but would silently null the whole query if any future column rename broke it) and a `skipped` array in the response so the founder dashboard can see exactly which therapists got skipped and why (`no_email`, `pulse_disabled`, `unsubscribed`, `nothing_to_report`).
    - **Cross-cron verification via notification_log (May 24 2026 evening).** Queried 7-day audit: 14 notification types firing across email/SMS/push/app_alert. Working cleanly: new_booking (63 sent), booking_confirmation (40 sent + 21 skipped which is unsub/no-email), payment_received (28 email + 15 app_alert + 5 push), drip Day 2/5/10/30 (33 fires), post_session (4 sent), welcome (3 sent), practice_pulse (2 test fires tonight). Broken: new_client_signup SMS (12 failed all), payment_received SMS (13 skipped + 1 failed). Missing entirely from 7-day window: appointment_reminder/reminder_24h (0 fires - send-reminders cron was the most-broken, first real cron-fire tomorrow 4am Central), renewal_due/membership_renewal (0 fires - daily-renewal-creation cron does not exist yet, see new item 27b below). The SMS failures are likely Twilio A2P 10DLC pending (Macro #11) and BYO-Twilio gaps; separate from cron auth and not blocking notifications system as a whole.
27a. **Google Calendar reverse-sync surfaced 2 pre-existing token issues (May 24 2026).** Once cron auth was fixed, google-calendar-reverse-sync started actually calling Google APIs and exposed: (a) Candice Peek's stored OAuth token has only basic login scopes, missing calendar.readonly. Resolution: she disconnects + reconnects Google Calendar from Settings, picking calendar scope at the consent screen. (b) HK's Healing Hands token expired/revoked. Same fix: disconnect + reconnect. These were SILENTLY broken until cron auth was fixed - that dynamic (broken cron hides downstream errors) is the value of fixing crons first.
27b. **Add daily-renewal-creation cron (~15 min, queued).** Function exists at `supabase/functions/daily-renewal-creation/index.ts` but no cron job calls it. Without it, recurring membership subscriptions never get renewal rows generated, so renewals never appear in the therapist's "due to charge" list. Schedule with the same service_role pattern at midnight UTC (5am Central or wherever you want). Use the cron template in FOUNDER_RUNBOOK Procedure 11.
27c. **Diagnose SMS failure root cause (~30 min, queued).** 12 new_client_signup SMS failures + 14 payment_received SMS skipped/failed in the 7-day audit. Likely causes: Twilio A2P 10DLC Brand registration still pending TCR review (blocks all US SMS regardless of cron), platform Twilio number not configured for marketing-grade messages, BYO-Twilio not yet onboarded for any therapist. Confirm via Twilio Trust Hub console + send-sms edge function logs. Pair with Macro #11 (A2P brand chase) and Macro #12 (STOP/HELP wiring).

29. **Site-wide ChevronPill standardization (queued, ~2-3 hours).** The Phase 20 cockpit (Schedule slide-over) uses the Billing DeepDiveCard / ChevronPill collapsible pattern: 36x36 icon tile (cream-deep when closed, sage-tint when open), bold 14px/700 title, 12px gray subtitle, 32x32 circular ChevronPill on right (sage-tint when closed, forest when open, white chevron rotates 180°). HK May 25 2026 directive: standardize this pattern across the entire site, replacing any remaining thin ▾/▸ chevrons + serif labels with the pill design. Known surfaces still using the old chevron/label style (audit on next pass): Settings sections, Dashboard sub-cards, ClientProfile section toggles, Insights drawer, Help articles index. Effort: one helper component (extract CockpitSection into src/components/CollapsibleCard.jsx as a shared primitive), then sweep callers. Single design grammar across the platform makes the 70yo persona's experience consistent everywhere. No new functionality; pure visual unification.

30. **Schedule slide-over: missing client notification touchpoints (~2 hours, queued).** Of 16 spec'd client-facing email touchpoints, only 5 are wired and firing today (booking_confirmation, reminder_24h, post_session via recap, refund_issued, no_show_notice_no_fee). The other 11 are defined in NOTIFICATION_SPEC but have no edge function wiring them. Highest-priority gaps for client experience: therapist_cancelled (when therapist cancels a booking the client expected to attend), client_cancelled_within_policy (confirmation when client cancels their own booking), client_cancelled_late (with cancellation fee context), reschedule_confirmation (when booking date/time changes), no_show_charged + no_show_payment_request (fee scenarios), renewal_due (membership clients), intake_reminder (when intake unfilled 24h before booking), reminder_48h, lapse_nudge + lapse_final_nudge (lapsed client warmth). Each is ~30 min to wire: edge function reads session/booking, builds an HTML email matching the warm post_session template style, sends via Resend, logs to notification_log. Renewal_due additionally needs daily-renewal-creation cron scheduled (item 27b).

28. **Therapist-initiated package charge from client profile.** SHIPPED commit b655c403 May 24 2026. PackageSection's add flow now opens CheckoutModal with `packagePurchase` context. Three of four payment methods identical to session/membership checkout: Mark as paid, Card on file, Enter new card. Send pay link gated for packages, see 28b. CheckoutModal extended with `packagePurchase` prop + `onPackageCreated` callback + `createPackagePurchaseRow` helper. `buildPaymentContext` now returns 3-way XOR (booking_id / member_subscription_id / package_purchase_id). All charge handlers branch on the third context. Header subtitle adapts per context. Enter new card visibility restored for memberships (was hidden by stale `!isSubscription` gate from Phase 19). New migration `session_payments_support_packages.sql` adds the package_purchase_id column + replaces 2-way XOR constraint with 3-way exactly-one rule. HK to apply migration in Supabase SQL editor; SQL is in the commit message.
28b. **Send pay link for package purchases.** ~30-45 min. Currently hidden in MethodPicker when `isPackage=true` because `create-payment-link` edge function only accepts `booking_id` or `member_subscription_id`. To enable: add `package_purchase_id` to the destructure, validate exactly-one-of-three in the mode guard, load package context (plan name, session count, client info from package_purchases row), set Stripe metadata to include `package_purchase_id` so the webhook can resolve the right row. Webhook (`stripe-payment-webhook`) also needs to recognize the package payment intent and update `package_purchases` if needed (probably no-op since the row is already created `active` before the link is sent, similar to subscription pay-link flow). Test end-to-end: therapist taps Send pay link on package checkout, client receives link, pays via Stripe-hosted page, webhook fires, session_payments row flips to `succeeded` and links to package_purchase_id. After this lands, remove the `{!isPackage && ...}` gate in CheckoutModal MethodPicker (around line 1282).

31. **Phase 25b: Auto-charge deposit on approval via card-on-file (HIGHEST PRIORITY, ~1.5-2 hours, queued).** Triggered May 25 2026 by Candice Peek's "how do I require a deposit" support ask. Real production revenue bug discovered: when a therapist has BOTH `require_approval` AND `deposit_enabled` on (Candice's config: deposit_percent=30, Stripe connected), the booking page correctly skips the deposit at request time (no refunds for declined requests), but `booking-approval` edge function then sets status to `confirmed` without ever charging the deposit. Code comment at BookingPage.js:816 acknowledges this gap ("the therapist sends a payment link after approving") but no UI prompts the therapist to do this. Every first-time deposit Candice thought she was collecting was silently never charged. Phase 25a (shipped commit a8e136d2) surfaced the gap via Settings warning banner and fixed the misleading approval emails; Phase 25b is the actual architectural fix. Approach: pre-collect card on file at booking time when both approval + deposit apply, using existing SetupIntent infrastructure (`card_required_first_timers` setting + `create-deposit` edge function with `setup_future_usage='off_session'`). On approval, `booking-approval` edge function detects saved payment method, fires off_session charge via existing infra, sets status to `confirmed` only after charge succeeds, sends client a "Approved + deposit of $X charged" confirmation email. If charge fails (declined card), fall back to status `pending-deposit` and send the client a recovery payment link as last resort. No fragile email-link dependency in happy path, no second client action required after approval. HK's instinct on this was right: "Sending a payment link is very old process as people may not get email or may not see it." Reuses existing infrastructure (card-on-file + create-deposit + Stripe webhook) so this is wiring not building. Pairs with DESIGN_PRINCIPLES rule 21 (approve+deposit interaction must be wired or documented) and rule 23 (pre-collect what you'll need to charge later).

32. **Resend 429 rate limiter fix (HIGH PRIORITY, ~20 min, queued).** Surfaced during the May 25 FounderHub Income Statement build. All 105 prior notification email failures captured in `notification_log` (after Resend `error_message` capture was wired in commit f1e93f19) were 429 `rate_limit_exceeded` errors with the message "You can only make 5 requests per second. Reach out to support to increase rate limit." Resend Pro upgrade does NOT raise the 5 req/sec limit. Two batch senders are hitting this: `release-pending-emails` (the queued-email release worker) and `founder-fire-all-notifications` (the test-fire utility on FounderHub). Fix: add 250ms `sleep` between sends in both functions, or 200ms with a small buffer. Single `await new Promise(r => setTimeout(r, 250))` between each Resend call. After ship, historical 429 errors in notification_log are still there for diagnostic purposes; no backfill needed since the email was the failure, not the log row.

33. **Deposit "first-time clients only" hint in Settings (~15 min UX polish, queued).** Surfaced May 25 2026 when Candice asked about deposits. Second customer in a row (after a prior similar ask noted in memory) to be confused that the deposit didn't fire when they tested with themselves or a returning client. Add a small line under the deposit toggle when it's ON: "✓ Active. Note: deposits apply to first-time clients only. Repeat clients are never charged." Single string edit in DisclosureRow body at `src/pages/Dashboard.js:2050` (deposit settings area). Catches every future therapist who enables the toggle without surfacing the rule.

34. **Custom email composer preference for envelope/mailto buttons (Jacquie ask, ~45 min, queued).** Jacquie Bodkin (jacquiebodkin@icloud.com, business: Back2Life Restorative Massage, second-business email: Back2LifeRestorativemassage@gmail.com) asked May 25 2026 how to change the default email app for the envelope "send to client" button in the slide-over. Current behavior: clicking the envelope opens the OS-level default `mailto:` handler, which on her iPhone is iCloud Mail. She wants to use her Back2Life Gmail instead. Tonight's answer: tell her iPhone Settings → Mail → Default Mail App → Gmail (after installing the Gmail app and signing in to Back2Life). Long-term ship: add a Settings preference "Preferred email composer" with options Default mail app / Gmail web / Outlook web / iCloud web. Swap the envelope `href` from `mailto:` to `https://mail.google.com/mail/?view=cm&to=...&su=...&body=...` (or equivalent Outlook/iCloud URL) when the therapist has set a non-default preference. Pattern: read therapist.preferred_email_composer in DocumentDrawer.jsx around line 307 (handleEmail) and at the per-doc shortcut links in ScheduleDashboard.js. Default behavior unchanged for therapists who haven't set it.

35. **Sandy Bodkin duplicate cleanup for Jacquie (~15 min SQL, queued).** Jacquie Bodkin has two client rows for "Sandy" (likely Sandy Bodkin or similar surname) in her account. Identified during May 24 Terra/Jacquie triage but Jacquie's data was held while Terra's was resolved. Two-step SQL drafted (preview-then-delete pattern). Step 1: `SELECT id, name, email, phone, created_at, (SELECT COUNT(*) FROM bookings WHERE client_id = clients.id) AS booking_count FROM clients WHERE therapist_id = '{jacquie_uuid}' AND name ILIKE '%sandy%' ORDER BY created_at` to identify duplicates. Step 2 (after HK pastes output): UPDATE bookings to consolidate session-linked client_id to the canonical row, then DELETE the duplicate. Pattern matches the previous Sandy duplicate resolution drafted earlier this week (similar pattern across Terra's account).

36. **Monthly calendar date picker, platform-wide standardization (~4-6 hrs, queued).** HK May 27 2026: the bulk session scheduler used a horizontal scrolling date strip, which is a bad experience. The regular booking flow already uses a monthly calendar grid (the old `Cal` function, now extracted to `src/components/MonthCalendar.jsx`). FIRST STEP SHIPPED May 27 2026: extracted `Cal` into the shared `MonthCalendar` component and adopted it in the bulk scheduler (each session row now expands a monthly calendar instead of horizontal chips). REMAINING: audit every remaining date picker on the platform and standardize on `MonthCalendar` so the date selection experience is identical everywhere. Known surfaces to check: BookingModal (therapist create/reschedule, currently has its own date UI), reschedule flow on the Schedule slide-over, any blocked-day / time-off date pickers in Settings, gift certificate scheduling if any, the appointment import date handling. For each: confirm it can pass `availability` + `selected` + `onSelect` and swap in `MonthCalendar`. Where vertical space is tight (e.g. multiple pickers on one page), use the collapsible pill-expands-calendar pattern already built in `BulkSessionScheduler` (compact pill shows the chosen date, tap to expand the month grid). Net effect: one date-picker grammar across the whole platform.

37. **Standardize the client-card session view with the Schedule cockpit slide-over (~3-5 hrs, queued).** HK May 27 2026: clicking a session inside the client card opens `SessionDetail` (a separate full-page layout), while clicking a session on the Schedule page opens the cockpit slide-over (`DetailPanel` in `ScheduleDashboard.js`: collapsible sections, status pills + insight line, inline SOAP `RecordEditor`, `RecapEditor`, body-map Patterns, DocumentJourney). These are two different surfaces with different content and design. HK wants them standardized in BOTH content and design. May 27 2026 INTERIM FIX SHIPPED (commit `5f22fe0a`): fixed the broken/overlapping DocumentJourney header in SessionDetail so the current page is not visibly broken. REMAINING: pick one of two approaches (HK to decide): (a) make the client-card session click open the SAME cockpit slide-over the Schedule page uses, so there is literally one shared component (cleanest long-term, but changes the client-card interaction from a full page to a slide-over, and the cockpit currently reads `currentSession` + booking context from the Schedule data layer, so it needs a clean prop contract to mount from the client card); or (b) keep a full-page session view but rebuild SessionDetail's internals to match the cockpit's sections and design tokens. Approach (a) is preferred for true single-source-of-truth. Risk: the cockpit hosts the inline SOAP save + recap-send flows, so the refactor must not regress those. Extract the cockpit body into a shared `SessionCockpit` component that both the Schedule slide-over and the client-card surface render.



**Recently completed.**
- **Jun 1 2026 (Jacquie incident + crash-prevention trio).** Timeline gap-calc now subtracts blocks so "Open · 2h available" no longer renders over a blocked window (Jacquie's recurring "block keeps disappearing" complaint root-caused: visual bug made her recreate blocks, accumulating duplicates). Monthly view day-list now interleaves partial blocks with appointments. ViewErrorBoundary wraps every Schedule subview so a crash shows a contained card with reload button instead of a white screen. SW v35 replaces silent force-reload with a user-controlled "Refresh" banner. New `/founder/mobile-preview` iframe at 380x720 for iOS Safari sanity checks before push. 62-therapist product_update broadcast bug fixed (validActions allow-list was missing the entry, all 62 sends failed at validation step). Customer-facing email template + voice locked in as Design Principle #32. Design Principles 33, 34, 35 added (iOS Safari date parsing, JSX temporal dead zone, mobile-first verification). Risk register on /founder page expanded with 10 open items.
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
- **Jacquie Bodkin (Jun 1 2026)**: blocks "kept disappearing" on Jun 3 2026 timeline. Root cause: Timeline view rendered "Open · 2h available" overlay on top of her 2-4 PM amber-striped block (gap-calc only considered bookings, not blocks). She thought the block wasn't applied and recreated it twice → 3 duplicate rows of the same 2:45-4 PM "Facial" block. Booking page slot generator correctly excluded blocks, so no client actually booked into her blocked time. **Shipped same day:** Timeline gap-calc subtracts blocks; Monthly view day-list now interleaves blocks with appointments; ViewErrorBoundary wraps every Schedule subview. **Still open:** DB-level UNIQUE constraint on blocked_days (queued, ~10 min); edit-block UX (~1 hr, currently create-only forces delete+recreate workflow). Duplicates retained as evidence per HK explicit instruction, not deleted.
- **Jacquie Bodkin Crosthwait (May 27 2026)**: BookingModal could not scroll to the Confirm button on her iPhone. Modal cut off below "Notes (optional)" and the confirm button sat under the Safari toolbar + iOS home indicator. Used the reschedule path as a workaround. **Shipped same day:** sticky footer + dvh + safe-area-inset fix on BookingModal. **Resolved May 29 2026:** audited the 5 other modals named in Fire #18 and all already use the canonical pattern. See Macro #14 below for the verification record.
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
**Status:** CODE COMPLETE May 18 2026, verified May 29 2026 via audit.
**What shipped:**
  - `clients.sms_opted_out_at` column added
  - `_shared/notifications.ts` SMS path checks the column; skips and logs `status='skipped' error_message='client_opted_out'` when set
  - Every client SMS gets "Reply STOP to opt out." appended unless the body already contains "STOP" in caps
  - `sms-inbound` edge function exists and handles STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT keywords. Stamps `sms_opted_out_at = now()` on the matching client. Responds with empty TwiML so Twilio sends its own auto-confirmation (CTIA-compliant out of the box).
**Outstanding HK-only task:** configure the Twilio messaging service inbound webhook URL in the Twilio dashboard to point at `${SUPABASE_URL}/functions/v1/sms-inbound`. Once A2P approval lands (Macro #11), STOP wiring is verifiable end-to-end.

### Macro #13: Twilio status callbacks for true SMS delivery state
**Status:** CODE COMPLETE May 18 2026, verified May 29 2026 via audit.
**What shipped:**
  - `sendSmsViaTwilio` in `_shared/notifications.ts` sets `StatusCallback` parameter on every outbound SMS pointing at `${SUPABASE_URL}/functions/v1/twilio-status-callback`
  - `twilio-status-callback` edge function exists (188 lines) and receives Twilio's POSTs on every state change. Updates `notification_log.delivery_status` + `delivery_status_updated_at` for the matching `provider_id` (message SID).
**Compliance dashboard render still TBD:** the dashboard reads `status` not `delivery_status`. Small follow-up to switch the cell-color logic to prefer delivery_status when present. ~15 min when SMS is actually flowing post-A2P.

### Macro #14 (Fire #18): Modal scroll-to-confirm audit across 6 files
**Status:** RESOLVED May 29 2026 after audit.
**What happened:** Audit found all 5 actual modals (IntakeEditor.jsx is a page, not a modal, was a false positive in the original list) already use the canonical pattern that BookingModal's May 27 fix introduced. Either prior fixes propagated, or these modals were built later using the right template from the start.
**Canonical pattern verified in all 5:**
- Outer backdrop: `position: fixed, inset: 0, alignItems: flex-start, overflowY: auto, WebkitOverflowScrolling: touch`, with `paddingTop/Bottom: max(16px, env(safe-area-inset-top/bottom, 0px))`
- Inner card: `maxHeight: calc(100dvh - 32px)` (or `- 40px`), `display: flex, flexDirection: column`
- Scroll area within card: `flex: 1, minHeight: 0, overflowY: auto`
- Bottom padding inside card uses `calc(env(safe-area-inset-bottom, 0px) + Npx)` to clear iOS home indicator
**Files audited and confirmed good:**
  - `src/components/Outreach.js` (Campaign starter modal, line 698-722)
  - `src/components/CustomQuickSendModal.jsx` (line 161-178)
  - `src/components/QuickSendModal.jsx` (line 152-174)
  - `src/pages/Demo.jsx` (Waiver modal, line 2836-2862)
  - `src/pages/BookingPage.js` (offerModal, cartModal, cartCheckout, package success - all 4 modals, lines 4376-4757)
**Design Principle 29 (sticky bottom + dvh + safe-area-inset) is now reliably applied across the codebase.** If a new modal regresses, fix using BookingModal.js or any of the above as reference.

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
- **Phase 9.3: Long-press → "block or event" (SHIPPED May 18 2026).** Audit May 29 2026 confirms: TimelineView's pendingBlock confirm sheet renders TWO buttons. Primary "Block this time" calls `onCreateBlock`; secondary "Schedule a client here" calls `onScheduleAtTime` which opens BookingModal pre-filled with the long-pressed date + start time. Both paths working.

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

---

## Security audit (queued, dedicated pass, May 28 2026)

HK sequence after notifications: SECURITY, then customer data backup, then SMS. Security is a multi-part audit and must not be rushed at the tail of a session. Three pillars:

1. RLS live-state. A prior hardening script exists at supabase/migrations/rls_audit.sql with therapist_id = auth.uid() policies for therapists/clients/sessions/bookings/gift_certificates and more (87 policies across all migrations). BUT it is a manual run-in-editor script, not an auto-applied migration, so live-state is unconfirmed, AND newer tables (package_purchases, session_payments, package_redemptions, member_subscriptions, notification_log, in_app_notifications, push_subscriptions, etc.) may have therapist_id but no policy. Diagnostic read query (run in rmnqfrljoknmellbnpiy) to list every public table with rls_enabled + num_policies + has_therapist_id; any row with has_therapist_id=1 AND (rls_enabled=false OR num_policies=0) is an exposure. Claude drafts ALTER TABLE ENABLE RLS + CREATE POLICY for HK to run (write = goes through HK).

2. Money-handling edge functions. charge-cancellation-fee, refund-session-payment, square-charge-card, square-create-deposit, capture-saved-card all accept therapist_id and/or amount_cents from the request body. Audit each: does it verify the caller owns the therapist/booking, and does it trust a body-supplied amount (financial exploit risk) vs recomputing server-side from the booking/policy? Highest-risk items first.

3. Public / --no-verify-jwt edge functions. ~30 functions accept therapist_id from body. Confirm each only acts on rows the caller could already see (e.g. by deriving therapist from a verified Stripe/Square session or a row lookup), never trusting arbitrary body input to act on another therapist's data.

Then: customer data backup mechanism (export/retention for therapists' client data; export-therapist-data edge function already exists, verify it covers all tables + is restorable). Then: SMS production (A2P 10DLC Macro #11, STOP/HELP Macro #12, status callbacks Macro #13, BYO-Twilio onboarding).

---

## send-renewal-due is built against the wrong table + columns (queued, ~1 hr, May 28 2026)

Found during the notification column audit. send-renewal-due (the "membership renews in 7 days" therapist alert, C/renewal_due) queries the `memberships` table (the PLAN template) when it should query `member_subscriptions` (the per-client subscription). Wrong table means wrong/missing columns throughout:
- selects `renewal_at` (memberships has none; member_subscriptions uses `current_period_end`)
- selects `price_cents` (real col is `monthly_price` on member_subscriptions)
- selects `plan_name` (real col is `name` on the joined memberships row via `membership_id`)
- `findMembershipsDueIn7Days` filters `memberships.renewal_at` (does not exist) so returns nothing: function never fires
- dedup query reads notification_log.reference_id + created_at; real cols are `sent_at` and there is no reference_id (verify actual dedup column, likely booking_id is null here so needs a membership/subscription ref column or a different dedup strategy)

FIX (queued, needs care not a rename): rewrite sendForMembership + findMembershipsDueIn7Days to query member_subscriptions (cols: client_id, client_name, client_email, monthly_price, current_period_end, current_period_start, renewal_day_of_month, membership_id, status, started_at, therapist_id), join memberships(name) for the plan name and therapists(...) for the recipient. Recompute the "due in 7 days" window against current_period_end. Fix the dedup to use a real notification_log column (sent_at; and a subscription reference, since reference_id does not exist). Verify against live schema before shipping. This is why renewal-due alerts have never fired.

---

## Notification testing gaps found May 28 2026 (queued)

### intake_filled (T3) likely has no fire site
The notification is declared in NOTIFICATION_SPEC and NotificationPrefsCard but a grep of supabase/functions/ for `eventType: 'intake_filled'` or `notification_type: 'intake_filled'` returned ONLY the founder fire-all helper and the spec/prefs files. The intake submission path (likely an edge function called when a client submits intake via /<custom_url>?booking_id=...) does not appear to fire intake_filled. Action: find the intake submission handler (likely save-intake or similar), add a notifyTherapist call for intake_filled with the appropriate detail box (which sections were completed, red flags, etc.). ~30 min.

### No in-app client-cancel UI for testing C08 / C09
Real client cancellations happen via the public booking link, not the therapist dashboard. There is no way for HK to simulate "the client cancelled this booking" from his Schedule. For test purposes, options: (a) add a `?cancel=<booking_id>` query handler on the booking page that triggers the client-cancel flow when set; (b) add a founder-only "Simulate client cancel" button on test bookings; (c) keep the manual notify-booking-event invocation path that the founder-fire-all-notifications dashboard already uses, and route HK there for these tests. Action: extend the founder-fire helper to support a "fire as if client cancelled this specific booking" variant, or build (b). ~45 min.

### Joy Client has a real Stripe Amex card (pm_1TY9jEQvokGFD9FYMgj4OPPf, last4 2001)
Tests that "Charge fee" or "Charge no-show" on this client risk posting a real Amex charge to that card. For testing fee paths, either use the offline-only branch, use a low-value service like the existing $1 Test Service, or use a separate test client with no card on file. Documented for HK awareness, not a code change.

---

## C08/C09 client-cancel: build in-app client cancel path (May 28 2026)

HK: "we need some way for client to cancel outside the SMS or email on our website." Today the only way a client can cancel a booking is through the SMS reply or an email link (which is what the SMS/email goes to anyway). There's no public booking-site UX where a client can pull up their booking and tap Cancel.

Build a public booking-management page at /book/<slug>/manage?booking=<uuid>&token=<hmac> (or similar) where the client can: see their upcoming booking, hit Cancel (within fee window or outside), hit Reschedule. The token is a short-lived signed hash of booking_id + client_email so anyone with the URL but not the email cannot cancel someone else's. Email/SMS reminders link to this page.

This is the only legitimate way to test C08/C09 end-to-end. ~3 hrs (page + token verification + state transitions).

## Membership / Package notification gap (May 28 2026)

Audit found three real gaps that mean memberships and packages are largely invisible in the notification matrix:

1. confirm-membership-purchase fires NO notification. Membership purchase succeeds, therapist is never alerted. Should fire payment_received (T4) the same way confirm-package-purchase does (already shipped). 15 min add.

2. send-renewal-due is built against the wrong table (queries memberships instead of member_subscriptions) and likely never fires. Documented in earlier BLOCK_PLAN entry. Membership renewals coming up in 7 days do not alert.

3. No dedicated event for "package redeemed" (a session booked against a prepaid package). $0 redemptions intentionally do not fire payment_received (no money moved), but the THERAPIST gets the normal T1 new_booking when a session is scheduled against the package, which is fine. No new event needed; verify the booking confirmation reflects "from package, prepaid" so the therapist sees context.

Net: there is no dedicated membership_purchased or package_purchased event type in the spec; both purchases fold into T4 payment_received. That's a deliberate choice that keeps the matrix clean. The fix is just to actually fire T4 from the membership purchase confirm function too.

---

## Notification testing findings — May 28 2026 (HK live test results)

HK ran Tests 1-13 end to end. Results captured here so tomorrow's session opens with the full picture instead of re-deriving from chat. Tonight we strategize, tomorrow we ship.

### Three systemic issues that cut across many tests

1. NO TRACE IN THE SCHEDULE AFTER AN ACTION. When a session is cancelled, rescheduled, no-showed, or refunded, the Schedule does not visibly mark the session as such. HK sees no badge / strikethrough / status pill / "Refunded $120" line / "Cancelled by you on May 28" annotation. The data is in the DB but the UI never reads it back into the day/week/month timeline. Compounding: a cancelled slot should remain visible as "this is when the cancelled session WAS" while also showing as available for rebooking; today it just disappears. Cancel/no-show/refund all show this pattern.

2. NO SOFT CONFIRMATION AFTER AN ACTION. Toast was added (commit 795f1ca2) but did not consistently appear during HK's tests, or fired only on some paths. HK explicitly: "What is toast? There is no documentation in the Schedule that this happened. It is only in emails. This is systemic." Need: every state-change action in Schedule (cancel, no-show, reschedule, charge, refund, package redeem, mark paid) shows a fade-in/fade-out confirmation toast. Audit every action site, not just cancel/no-show.

3. EMAILS ARE TERSE AND UNDETAILED. Client cancellation email had no detail. Client no-show email had no detail. Payment receipt (therapist + client) had no service description, no session date/time, no who. T03 intake-filled email is fine. The therapist no-show email was DOUBLE-FIRED with contradictory content (one said "no fee" while another said "$1 charged"). Need a copy + content pass across every client-facing email, prioritizing the ones HK tested. Standard: client email always shows when the session was, what service, who it was with, what changed, what next.

### Test-by-test bugs to fix tomorrow (consolidated)

T1+T2 (C16 refund):
- Therapist and client emails NEITHER fired. notification_log will tell us if they fired-and-failed or never fired. Diagnose first.
- Schedule does not show the session as refunded after the action. Need a "Refunded $X on <date>" badge on the booking detail panel and a visual marker on the timeline.

T3-T5 (C07 therapist cancel):
- Therapist email lands correctly with the detail box (Test 4 with reason worked as designed).
- Client email NEVER fired despite my a9052ac7 fix (unsubscribed_at). The fix shipped but client side still dead. Needs notification_log inspection: look for send-therapist-cancelled rows in last hour. If absent, the fan-out from notify-booking-event is not invoking the client function at all.
- After cancel: Schedule should mark the slot as Cancelled but still show the time as available for rebooking. Today the slot disappears entirely.

T6 (C10 reschedule):
- Critical: therapist got a CANCELLATION email, not a reschedule email. This means notify-booking-event is being called with event_type='booking_cancelled' from the reschedule path, OR the reschedule path is firing cancel before firing reschedule. Trace BookingModal reschedule submit to find where event_type is wrong.
- Client email did NOT fire. send-reschedule-confirmation not invoked or failing silently.
- Need to investigate WHY the reschedule path is calling notify-booking-event with the wrong event_type. The bdec4ef4 fix was supposed to be the duplicate-send fix, but a deeper bug is emitting a cancel event from reschedule.

T8 (C11 no-show no fee):
- Therapist email lands. Client email lands but is terse.
- Schedule does not visibly mark the session as no-show.

T9 (C12 no-show charged):
- Therapist DOUBLE-fired:
  (a) "Joy marked no-show" with "Fee: No fee charged" (wrong)
  (b) "Joy marked no-show, $1 charged" (correct)
- Cause hypothesis: notify-booking-event fires the no-show event first with fee_charged=false (before the charge succeeds), then the charge-cancellation-fee function fires its own follow-on, producing two emails with contradictory content. Should be one email, fired after the charge resolves, with the correct fee outcome.
- Client email lands but lacks detail.
- Schedule shows no marker.

T10 (T08 agreement signed):
- "Send practice agreement" is NOT in the session/booking detail panel where HK expects it. It's only reachable from the client profile view. HK's ask: surface it on the booking detail panel above the session journey, alongside Send intake.
- Test could not be performed because the agreement was already signed on the test client. Need a way to re-trigger or a test booking where it isn't.

T11 (T03 intake submitted) - THE GOOD ONE:
- Therapist email fired correctly with the new detail box. The 5774da45 fix works.
- BUT: the session detail panel does not auto-refresh after intake submission. The "No intake" pill stays even though intake is now in the DB. HK: "We must have a refresh mechanism without logging out in the PWA."
- The four-circle journey UI shows step 1 complete, but the separate "No intake" pill (top right under client name) does not. Inconsistent state between two UI components reading the same data.
- Also: "Send intake" link is buried at the bottom of the client documents area. Surface it at the top alongside Send agreement.

T12 (T04 payment received):
- Both emails fire. Both are very terse. No service description, no session date/time, no totals breakdown.

T13 (package redeem) - CRITICAL DATA BUG:
- The UI shows "Session 18 of 6 in 5-Session Bundle" which is nonsense. Likely caused by mis-counting redemptions or by my SQL data writing sessions_purchased=6 / sessions_remaining=5 against an existing template where session_count=6 but real redemptions exist.
- "Manage package" link → lands back on Schedule, doesn't actually let HK assign this session to the package slot.
- CheckoutModal shows "Use existing package, 3 left" (which is correct visibly, but the 18 of 6 elsewhere is wrong).
- Clicking "Use existing package" errors: `session_payments violates check constraint session_payments_charge_context_exactly_one`. The check constraint enforces exactly one of (booking_id, member_subscription_id, package_purchase_id) is set. Likely the redemption code is setting two of them. Read the constraint and the code path that fires on "use existing package" in CheckoutModal to diagnose.

### Strategic priorities for tomorrow (HK to confirm before coding)

Priority 1: Diagnose the silent client-email failures (C16, C7, C10). All three of these client functions were "verified correct against live schema" but real testing shows they don't fire. Read notification_log for tonight's tests, find which functions exited where. Stop trusting "code looks correct" as a proxy for "it works."

Priority 2: Systemic Schedule trace. Design a single status-marker pattern (badge + strikethrough + annotation line) that gets applied wherever the timeline renders a booking, then update Timeline/Weekly/Monthly views consistently. This unblocks HK's confidence-after-action.

Priority 3: Systemic toast confirmation. Audit every state-change action site in Schedule (cancel, no-show, reschedule, refund, charge, mark paid, package redeem, send intake, send agreement) and ensure each calls showToast on success. Currently only cancel/no-show flow through it.

Priority 4: Reschedule emitting cancel event. Trace BookingModal reschedule path. Determine why notify-booking-event is being called with event_type='booking_cancelled' from a reschedule action.

Priority 5: Email content depth. Standard template for client-side emails: who, what service, when, where, what changed, what next. Build a shared helper so every client email pulls the same canonical block. Therapist emails: similar but tighter, with the fee/action outcome prominent.

Priority 6: Package redeem 18-of-6 + check constraint error. Read constraint, trace CheckoutModal "use existing package" payload, fix the duplicate context field.

Priority 7: Surface Send Intake and Send Agreement at the top of the booking detail panel, not buried in documents.

Priority 8: PWA refresh after data change (intake submitted, etc). React state should reflect the new DB row without requiring re-login. Subscribe to the relevant tables via Supabase realtime, or refetch on focus, or both.

DEFERRED until above ships:
- C08/C09 client-cancel public page
- C12-link payment-link variant (HK to supply third email)
- Membership renewal_due rewrite
- Confirm-membership-purchase fire payment_received
- Daily evening digest copy
- Lapse nudges (cron, naturally tested over 45+ days)

---

## Recurring appointments (queued May 29 2026)

HK asked: "what is our way to schedule a client for recurring appointments? They may have a logic (every month on day X) but more than likely no logic, we just know what dates they will come on."

Today: no recurring booking support exists. Each session is booked individually.

Design (per HK conversation May 29 2026):

Primary use case is ad-hoc: massage therapy clients commonly book multiple future sessions in one conversation but with irregular spacing ("every 3 weeks, then 5 weeks, then back to 3"). Strict rule-based recurring is the exception, not the rule. So the design centers on a date-list builder, with a rule-based shortcut for the few cases where it helps.

Build plan (~3 hrs):

1. Schema (10 min):
   - bookings.series_id (uuid, nullable)
   - booking_series table: id, therapist_id, client_id, created_at, rule_text (free-text describing the rule if any: "every 4 weeks for 6 sessions")

2. BookingModal multi-date builder (90 min):
   - After first date+time picked, surface "Add another date" link
   - Each tap appends a row to a date-list state
   - Optional shortcut at top: "Repeat every [N] weeks for [M] occurrences" -> populates date list, individual dates editable/removable
   - All rows share same client + service + duration
   - Single submit: inserts N bookings with shared series_id in one transaction
   - Conflict check across all proposed dates upfront

3. Schedule render (20 min):
   - Small "X of N" pill on booking detail panel and chip on timeline when series_id is set
   - Tooltip lists other sessions in series

4. Cancel + reschedule UX (40 min):
   - When acting on a series booking, prompt: "Just this session" vs "All future in series"
   - Reuses existing cancel/reschedule flows under the hood

5. Test data + verification (30 min)

Acceptance criteria: a therapist can book 4 future sessions for a client in one flow, see them tied together in Schedule, cancel one without affecting the others, or cancel "all future" in one action.

Deferred behind notification testing + package error fix + PWA refresh. Not blocking real-customer use today; competitors all offer this but it's not a differentiator. Position: after notifications verify green, before SMS work.

---

## Therapist-calendar-view date picker (queued May 29 2026, persona-corrected)

HK clarified the recurring UX vision: every place in the app where the therapist picks a date or time should show the therapist's actual calendar (month grid with colors, blocked time, existing bookings, free slots) rather than a stock date picker or a long list of dates. Outlook was a visual reference for the calendar-as-picker pattern, not an integration target.

**Persona constraint (70-year-old solo LMT):** tapping N individual cells across 8 weeks is tedious and error-prone. The PRIMARY interaction for a series is a plain-English rule shortcut at the top, not multi-tap. Multi-tap is the secondary tweak path for the rare ad-hoc case.

Design:

1. **Single-date pick (default):** opens the therapist's month-view calendar. Tap any free cell. Cell turns sage with a check. Done.

2. **Series pick (toggle 'Book a series'):** a rule strip appears above the calendar in plain English with InlineSaveNumberInput controls:

   > Every **2** weeks for **6** sessions starting **Sat May 31**

   Tap the bold numbers/dates to edit (no dropdowns, no advanced panel). Below, the calendar auto-selects the resulting 6 dates in sage with their series index (1, 2, 3, ...). Therapist can:
   - Adjust the rule -> selection updates live
   - Tap a sage date to drop it (manual override on top of the rule)
   - Tap a free date to add one outside the rule (mixed ad-hoc + rule)

3. **Conflict surfacing:** if any rule-generated date hits a blocked day or an existing booking, that cell renders amber-with-warning and the rule strip shows "1 conflict, tap to resolve." Therapist taps the conflict, chooses Skip or Move to next free.

4. **Submit:** creates a booking_series row + N bookings, all sharing series_id with series_index 1..N. Conflict check across all dates upfront so no booking ever lands on top of another.

Reuse: extracted from existing MonthlyView in ScheduleDashboard.js as a `SelectableMonthView` component. Same colors, same blocked-time render, same booking chips, plus `onSelectDate`, `selectedDates[]`, `mode='single'|'multi'`, `seriesPreview` props.

Implementation order:
1. Extract SelectableMonthView (~60 min).
2. Wire into BookingModal as the date step, single mode (~45 min).
3. Series toggle + rule strip + auto-population (~60 min).
4. Conflict resolution UI (~30 min).
5. Submit handler creates booking_series + N bookings (~30 min).
6. Schedule render: small "Session N of M" pill on series-linked bookings (already partly there via package badge code, reuse pattern) (~20 min).
7. Cancel/reschedule: when acting on a series booking, prompt "Just this session" vs "All future in series" (~40 min).

Scope estimate: ~4.5 hours. Pays back across every future date-picker need in the app since SelectableMonthView is now a reusable primitive.

Replaces the prior "Recurring appointments" and "Outlook integration" entries. We are NOT building Outlook calendar sync today, period.
