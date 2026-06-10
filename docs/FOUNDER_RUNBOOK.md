# MyBodyMap Founder Runbook

**Last updated:** Jun 10, 2026
**Owner:** HK (founder + sole operator)
**Purpose:** Operational insurance. If Claude is unavailable tomorrow and HK needs to onboard a human team or vendor to keep MyBodyMap running, this document is the handoff. It contains everything a competent senior engineer + product manager + GTM lead would need to take over with minimal additional context.

This is a LIVING document. Updated at the end of any session that introduces new context, decisions, vendors, or risks. Read this before starting any new work session, especially if it has been more than a week since the last update.

---

## Table of contents

1. [Mission and current state](#1-mission-and-current-state)
2. [What MyBodyMap actually is, in one paragraph](#2-what-mybodymap-actually-is-in-one-paragraph)
3. [Strategic context — why this exists, why now](#3-strategic-context)
4. [Product taxonomy — the seven categories](#4-product-taxonomy)
5. [Design principles — the five rules every decision passes through](#5-design-principles)
6. [Tech stack and architecture](#6-tech-stack-and-architecture)
7. [Credentials, vendors, accounts](#7-credentials-vendors-accounts)
8. [Database schema and data model](#8-database-schema)
9. [Build philosophy and operating rhythm](#9-build-philosophy-and-operating-rhythm)
10. [Marketing and growth strategy](#10-marketing-and-growth-strategy)
11. [Pricing and unit economics](#11-pricing-and-unit-economics)
12. [Competitive landscape and positioning](#12-competitive-landscape)
13. [Open risks and what could break](#13-open-risks)
14. [Decision log — what was decided and why](#14-decision-log)
15. [What to do if X breaks](#15-what-to-do-if-x-breaks)
16. [Onboarding a human team](#16-onboarding-a-human-team)
17. [Process flows](#17-process-flows)

---

## 1. Mission and current state

### Mission
Help solo licensed massage therapists retain and grow their client base by automating the practice-management work they currently do manually or through expensive, clunky competitors (Vagaro, MassageBook, ClinicSense). The northstar: make it impossible for a client not to return.

### Current state (as of Jun 1, 2026)
- **Stage:** Pre-revenue beta with first real customers actively using the platform.
- **Users:** Single-digit founding therapists onboarded for testing. Active real customers and contacts:
  - **Candice Peek (Grounded Grace)**: signed up May 15. Real testimonial customer. Multiple bugs reported and fixed May 19-25. May 23 incident: comprehensive wipe ran against her therapist_id believing it was Jackie's; recovery took 7 hours via Supabase Pro daily backup. May 25 surfaced approve+deposit silent revenue bug (her config triggered the discovery); Phase 25a warning banner shipped, Phase 25b auto-charge fix queued.
  - **Jackie Bodkin (Back2Life Restorative Massage)**: signed up May 20. **Jun 1 2026:** reported blocks "kept disappearing" on Jun 3 timeline. Root-caused to Timeline gap-calc rendering "Open · 2h available" overlay on top of her amber-striped block. Fix shipped same day plus crash-prevention trio (ViewErrorBoundary, SW v35 update-banner, mobile-preview route). Three duplicate Facial blocks retained as evidence per HK instruction.
  - **Terra Irving (Under the Trees / Healing Touch / Ponder Place Retreat)**: May 24 triage resolved 9 of 11 broken bookings (NULL client_id), 2 held for her input (Kare, Maria Cruz). Driver of Phase 13.9-13.11 findOrCreateClient rewrite. Reports continue to be acted on same-day.
- **Business form:** BodyMap LLC (Wyoming, Texas operator HK). May 25: ToS + Privacy hardened additively (commit `bb2c0494`). E&O insurance + TX attorney consult queued as Priority 0.
- **Engineering:** Solo build via Claude. No human engineers retained. The schedule slide-over is now the single primary work surface for the therapist between sessions (24 commits across Phases 20-25a delivered May 24-25). Jun 1: 10 commits, mostly Jacquie-incident response + crash-prevention infrastructure.
- **Funding:** Self-funded by HK from IBM income.

### What's working
- Stripe payment integration end to end (deposits, packages, memberships, card-on-file, refunds)
- Square payment integration achieves parity with Stripe (subject to Square activation by individual therapists)
- Automated client retention: post-session AI brief, lapsed-client outreach, cancellation policy with auto-charge
- Marketing surface: home + features pages with seven-ribbon taxonomy
- **CSV import** (clients + appointments) with Maria-persona safety: pre-flight checks, strict column matching, phone normalization, downloadable skipped/failed rows, **client-side resumable on interrupt via localStorage**, **undo-last-import via batch id within 10 minutes**, **fuzzy service matching with one-tap merge**, multi-file orchestration with preview, address fields, smart currency-content detection. Survived Jackie's catastrophic-mapping case May 21 and now meaningfully prevents the next one.
- **Schedule** loads 365 days back + 365 days forward. Four scope tabs (today, weekly, monthly, yearly) all real and visually consistent. Desktop weekly is Outlook-style time grid. Mobile weekly has horizontal time-strips per day card. **Monthly day-list now interleaves blocks with appointments (Jun 1).** Yearly is a 12-month sage-gradient heatmap. **Every subview wrapped in ViewErrorBoundary so a crash in one shows a contained "View hit a snag" card, not white screen (Jun 1).**
- **PWA update banner (Jun 1)**: SW v35 posts SW_UPDATE_READY; page renders a sage-green "Refresh" banner the user controls instead of force-reloading mid-flow.
- **Mobile preview at /founder/mobile-preview (Jun 1)**: iPhone-class 380x720 iframe for verifying Schedule + Booking-page changes at mobile viewport before push. Catches iOS Safari issues that desktop hides.
- **Schedule growth insights**: 7 care-framed practice observations fire from real data on the "Ways to use this" surface. Deep-link to outreach with named clients pre-selected.
- **Outreach Quick send**: 5 preset templates plus a Custom card for picking any clients and writing anything.
- **Notification system** Phase 15 wired for bookings, payments, refunds (May 18). Awaiting first real customer-driven activity to verify end-to-end.
- **Founder customer broadcast** (Jun 1): /admin BatchSendBar always visible with email-template dropdown + select-all shortcut. SendModal persists drafts to localStorage. Customer broadcast email voice locked in as Design Principle #32.

### What's not working / unproven
- No real revenue yet. Need 100 founding therapists to validate retention metrics before pricing rollout.
- Square activation friction: each therapist must complete identity + bank verification at squareup.com/activate before charges process
- Therapist acquisition channel: currently word-of-mouth only via founder DMs (Katelynn et al.)
- **Twilio A2P 10DLC Brand registration** stuck in review with TCR. Blocks all US SMS until cleared.
- **Two pending migrations to apply** in Supabase SQL Editor before HK's testing covers everything from May 22: `2026-05-21-clients-address-fields.sql` (address columns) and `2026-05-22-import-batch-id.sql` (batch tracking). Until applied, address fields don't save on client profile and undo-last-import fails on insert. Both idempotent (`IF NOT EXISTS`).
- **Side panel intermittent failure (Jun 1)**: DetailPanel scroll, close, edit affordances inconsistent on mobile. Reproduction inconsistent. Queued as Risk Register item #7.
- **Insight iteration after real-data review** pending: HK to view the 7 deep insights firing against the live account, prune any weak ones, tune copy, wire actions on currently-text-only entries (C, E, F, G).

---

## 2. What MyBodyMap actually is, in one paragraph

A SaaS platform for solo licensed massage therapists. Therapist signs up, gets a custom booking page (e.g. mybodymap.app/healinghands), connects Stripe or Square for payments, configures their services and policies, and shares the link with clients. Clients book, pay, fill intake forms, leave session notes, and receive automated retention touchpoints. The therapist runs their practice from a single dashboard that automates everything that does not require professional judgment. Differentiated against competitors by: dual-processor support (Stripe + Square parity, no lock-in), the body-map intelligence layer (longitudinal tension pattern tracking unique to massage therapy), and retention-first design philosophy (every feature is built around getting the client back, not just transacting).

---

## 3. Strategic context

### Why this exists
HK observed that the massage therapy market is dominated by software built either for medical clinics (Jane App, Noterro — too clinical, too expensive) or for spa/salon chains (Vagaro, GlossGenius, MassageBook — too transactional, too feature-bloated). Solo cash-pay therapists, who are the largest segment of the U.S. market by count (roughly 250,000 LMTs), are underserved by both. They want simplicity, low cost, and tools that help them retain their existing client base, not tools that help them market to new clients.

### Why now
Three trends:
1. **Solo wellness practices are growing.** Post-COVID, more therapists left spa/chain employment for solo private practice.
2. **Older platforms are visibly aging.** Vagaro and MassageBook UIs are 2010s-era. Therapists feel it.
3. **AI makes retention automation finally affordable.** Pre-AI, "personalized post-session brief" required either a human VA or expensive enterprise software. Now it's $0.001 per generation via Claude.

### TAM and exit
- **TAM:** ~250,000 U.S. solo LMTs × $19-$49/month = $57-$147M ARR ceiling
- **Realistic ARR target by 2028:** $5-15M (1-3% market share at $19-$49 ARPU)
- **Long-term exit goal:** $100M outcome (acquisition by a wellness platform, vertical SaaS roll-up, or therapist-owned cooperative)

### Geographic and demographic strategy
- Start in Texas (HK is in Sugar Land/Houston; easy local field validation)
- Expand to other Southern + Sun Belt states first (Florida, Arizona, Georgia) where solo LMT density is high
- Ignore Pacific Northwest for now (oversaturated with wellness-tech)
- Persona: 30-65 year old female LMT, 5-20 years in practice, $40k-$100k annual revenue, currently on Vagaro or paper

---

## 4. Product taxonomy

The seven-category taxonomy is the source of truth for everything MyBodyMap ships. It lives in `src/data/featuresData.js` as the `RIBBONS` constant and renders identically on the Home page and Features page. Every feature gets a slot in one of these seven; nothing lives outside them on marketing surfaces.

| ID | Category | Tagline | What lives here |
|----|----------|---------|-----------------|
| 1 | Find & Book | How clients discover and book | Booking page, services, online deposits, embed widget |
| 2 | Know Your Client | Intake, preferences, waivers | Intake forms, client preferences, signed waivers |
| 3 | Client Intelligence | Patterns, history, AI insights | Body map, tension patterns, AI session briefs |
| 4 | Day-of-Session | What happens at the session itself | SOAP notes, session timer, follow-up scheduler |
| 5 | Relationships | Email, reminders, lapsed clients | Automated reminders, lapsed-client outreach, campaigns |
| 6 | Money & Protection | Billing, policies, legal, security | Billing dashboard, cancellation policy, Stripe + Square parity, card-on-file, refunds, ESIGN waivers, HIPAA |
| 7 | On Your Phone | PWA, push, founder comms | Mobile PWA install, push notifications, switch from Vagaro guide |

### Rules for adding to the taxonomy
1. Every feature belongs to exactly one ribbon
2. Subfeatures must be meaty enough to deserve a slot — HK confirms before adding
3. Reordering within a ribbon is allowed (promote/demote)
4. One animated demo per ribbon, optional more for differentiating features
5. No standalone marketing surfaces outside the ribbons
6. The seven categories themselves do not change without HK explicit approval

Full rules: `FEATURES_TAXONOMY.md` in repo root.

---

## 5. Design principles

Every product decision must pass through these five high-level principles. When two conflict, "deeper" usually wins, but call it out explicitly.

**Note:** these five are the foundational philosophy. The operational rules (currently 13, growing as incidents teach us) live in `docs/DESIGN_PRINCIPLES.md` and on the founder page under "Design Principles". Read that doc before changing any UI, adding any auto-create code path, or instructing a human to follow a manual process.

### Deeper, not wider
Solve one therapist's real problem all the way through, not five problems halfway. Card-on-file at booking is "deeper" because it goes from policy in Settings, through booking page mandate, through cancellation modal, through actual charge, through audit trail. We did all five.

### Simpler than competitors are
Vagaro takes 12 steps to set up a calendar. Acuity's pricing is a maze. ClinicSense buries SOAP notes behind a paywall. Our default is fewer steps, fewer toggles, fewer screens. When in doubt, hide the option. When the option must exist, default it sensibly.

### Automated where it should be
Things that only happen because someone remembered to do them are bugs. Reminders, follow-ups, lapsed-client outreach, recurring memberships, cancellation charges all run by themselves on the right trigger. Therapist input only at setup and exception handling.

### Modern, with a way out
Use the current best primitive (Stripe Connect, Square Web Payments SDK, modern React patterns) but never paint into a corner. The PaymentProvider abstraction with versioned strategies is the canonical example: today's V1 strategy can be replaced with V2 without rewriting any edge function.

### Changeable as new tech comes out
What we ship today will be partially obsolete in 18 months. ACH-by-link, FedNow real-time payments, Apple Pay, AI agent payments — these are all coming. Architecture choices that lock us out of adopting them are wrong even when they ship faster today.

---

## 6. Tech stack and architecture

### Frontend
- **Framework:** React (Create React App, not Vite — switch costs not worth the marginal speed)
- **Routing:** react-router-dom v6
- **Styling:** Inline styles + global CSS in `src/index.css`. No CSS-in-JS framework. No Tailwind in the customer-facing UI (Tailwind is used inside Claude artifacts only).
- **State:** React hooks (useState, useEffect, useMemo). No Redux, no Zustand. Keep it simple.
- **Critical convention:** React hooks are imported individually (`import { useState } from "react"`). Never write `React.useState(...)`. Vercel production build fails silently on this; syntax check alone won't catch it.

### Backend
- **Database + Auth:** Supabase (project ref `rmnqfrljoknmellbnpiy`)
- **Edge Functions:** Supabase Edge Functions (Deno runtime). Auto-deploy via GitHub Action on push to `main`.
- **Payment processing:** Stripe (primary) and Square (secondary), abstracted behind `PaymentProvider` interface in `supabase/functions/_shared/payment-provider.ts`
- **Email:** Resend (transactional, broadcasts)
- **SMS:** Twilio (if/when sender ID approved)
- **DNS + email routing:** Cloudflare (zone ID `2f2d81115be22e62a0b7cffb7f56caa1`)
- **AI:** Anthropic Claude API for post-session briefs, lapsed-client outreach, automated drafts

### Hosting and CI/CD
- **Frontend:** Vercel (production deploys via `npx vercel --prod` from CLI, or auto-deploy on `main` push)
- **Edge functions:** Auto-deploy via `.github/workflows/deploy-edge-functions.yml` when `supabase/functions/**` changes on main

### Payment provider architecture (CRITICAL)
The most architecturally important decision in the codebase: every payment-touching edge function uses the abstraction in `_shared/payment-provider.ts`. Provider-specific code lives in `_shared/providers/`:
- `stripe.ts` — StripeProvider, version `stripe-v1-2026-05`
- `square.ts` — facade
- `square/strategy.ts` — SquareStrategy interface
- `square/v1.ts` — SquareV1Strategy, version `square-v1-2026-05`

Capability matrix is the honesty layer: each provider declares what it supports and what it doesn't. UI surfaces these gaps to therapists rather than hiding them.

**Versioned strategies pattern:** SquareV1 today; future SquareV2 swaps in cleanly when Square ships a better recurring billing API. Never paint into a corner.

### Repository
- **GitHub:** github.com/bodymapapp/bodymap (note the recurring `cap.git` typo — always retry to `bodymap.git`)
- **Branch strategy:** main only, no feature branches. Solo dev simplicity.
- **Never use `git add -A` or `git add .`** — always stage explicit file paths. Container resets between Claude sessions and `npm install` modifies node_modules.

### Build commands
```
cd ~/Documents/bodymap
npm run build
git add <explicit paths>
git commit -m "msg"
git push
npx vercel --prod --token=<token> --scope bodymapapps-projects
```

---

## 7. Credentials, vendors, accounts

### Where to find credentials
**Canonical source:** `ENVIRONMENT.md` in the repo root. Always check this BEFORE asking HK for any secret. If it's not in `ENVIRONMENT.md`, it doesn't exist or HK forgot to log it.

### Critical credentials (current as of May 22, 2026)
- **GitHub PAT** (for code pushes): logged in `ENVIRONMENT.md`
- **Vercel token** (for prod deploys, no expiry): logged in `ENVIRONMENT.md`
- **Resend API key**: logged in `ENVIRONMENT.md`
- **Supabase project ref**: `rmnqfrljoknmellbnpiy`. Dashboard at https://supabase.com/dashboard/project/rmnqfrljoknmellbnpiy. Service role key managed in Supabase dashboard, also reflected in edge function env vars.
- **Stripe live keys**: managed in Stripe dashboard. Connect platform account is in HK's email. **Critical:** HK has TWO Stripe accounts under the same email (one from Google OAuth login, one from email+password). Real verified platform with all Connect accounts is the email+password one. See Procedure 9 in Stripe Connect operations section below.
- **Square Production App ID** `sq0idp-3kYk490uQ-cjpb_s1zJmAQ`: set as `SQUARE_APP_ID` env var (NOT `SQUARE_APPLICATION_ID`, naming matters)
- **Twilio platform number**: `+15136133033`. Used for founder-to-therapist outreach only, NOT for therapist-to-client SMS. Architecture is BYO-Twilio: each therapist supplies their own Twilio credentials for their own client SMS, so the platform doesn't absorb per-therapist costs or A2P 10DLC liability. BYO-Twilio onboarding UI is queued (known blocker).
- **Twilio Account SID + Auth Token**: logged in `ENVIRONMENT.md`. A2P 10DLC Brand registration is stuck in TCR review (blocks all outbound US SMS until resolved, including the platform number).
- **Cal.com OAuth**: Client ID stored as Supabase secret `CAL_CLIENT_ID`. Integration approved May 2026. Powers the Schedule tab's external calendar sync.
- **Cloudflare**: zone ID `2f2d81115be22e62a0b7cffb7f56caa1`. Email routing configured to forward `*@mybodymap.app` to `bodymapdemo@gmail.com` and `hello@mybodymap.app` to `bodymap01@gmail.com`.

### Vendor relationships
- **Stripe:** primary payment processor. HK has direct dashboard access. No account manager retained yet.
- **Square:** secondary payment processor. Account is HK's mom's name (HK started with that and decided to continue). Activation pending Friday May 9 with mom's ID + selfie.
- **Twilio:** SMS infrastructure. BYO model: each therapist supplies their own credentials. Platform number `+15136133033` only used for founder outreach. A2P 10DLC Brand registration stuck in TCR review (external blocker).
- **Cal.com:** external calendar sync. OAuth app approved. Powers Schedule tab integration with Google/Apple/Outlook calendars.
- **Supabase:** free tier. Will need to upgrade when production volume justifies it. Project ref `rmnqfrljoknmellbnpiy`.
- **Vercel:** free hobby tier. Pro tier needed if SLA matters.
- **Resend:** free tier (3,000 emails/month). Upgrade when broadcast volume exceeds.
- **Anthropic:** Claude API for AI features. Pay-as-you-go, billed monthly to HK personal credit card.
- **Plaid:** NOT YET INTEGRATED. Decision May 7, 2026 to skip ACH entirely.

### Bank accounts
- BodyMap LLC business checking — HK has direct access
- HK personal — separate, used for IBM W-2 and personal expenses
- All Stripe payouts route to BodyMap LLC checking
- All Square payouts route to BodyMap LLC checking (post-activation)

### Test accounts
- Test therapist: `hk5@email.com`, custom_url `hk5`
- HK's actual founder account: `bodymapdemo@gmail.com`, custom_url `healinghands`
- Stripe Silver monthly link: `https://buy.stripe.com/5kQbJ23kC0eAfVe9vGeQM03`
- Stripe Silver annual link: `https://buy.stripe.com/8x214obR89Pa4cw8rCeQM04`
- Beta coupon `BETAONE`: Silver $19/mo at 100% off for 12 months, 25 max redemptions, expires Jun 1. **Do NOT publish on public website**; therapists message Instagram or Facebook to receive it.

---

## 8. Database schema

Full schema lives in Supabase. Key tables:

- **therapists** — one row per therapist account. Includes Stripe + Square connection state, payment routing config, profile.
- **clients** — one row per client of a therapist. Includes Square customer/card IDs, Stripe customer ID, last4, brand.
- **bookings** — one row per appointment. Includes session pricing, status, intake responses, card-on-file references.
- **memberships** — one row per membership offering a therapist sells.
- **member_subscriptions** — one row per active member subscription. Stripe + Square subscription IDs, processor name.
- **packages** — one row per package offering.
- **package_purchases** — one row per package a client bought.
- **cancellation_charges** — one row per cancellation fee charge attempt. Includes processor, idempotency_key.
- **payment_routing** (jsonb on therapists table) — per-feature processor preference when therapist has both Stripe and Square connected.
- **availability** — recurring weekly hours. One row per `day_of_week` (0-6), optional per-service rows (`service_id` null = master schedule), single block via `start_time`/`end_time` or split shifts via `time_blocks` jsonb. Anon-readable for the booking page.
- **availability_overrides** (added Jun 4 2026) — date-specific hours. One row per therapist per `override_date` (UNIQUE). Wins over the weekly row for that exact date: `is_closed` = a day off (no slots), else `start_time`/`end_time` (or `time_blocks`) replace the day's hours. Can also OPEN a normally-closed weekday. Master-level (applies to every service). Anon-readable for the booking page.
- **founder_test_plan** (added Jun 4 2026) — founder-only QA checklist done-state. `(user_id, item_key)` primary key, `done` boolean. The item list itself lives in code (`TEST_PLAN_ITEMS` in `FounderDashboard.js`); this table only stores what HK has checked off, scoped to his own auth id. No anon access.

### Migration history
Schema changes ship as `.sql` files in `supabase/migrations/`. The GitHub Action `.github/workflows/deploy-migrations.yml` auto-applies every migration on push (idempotent, files use `IF NOT EXISTS`). Claude pushes the file, the workflow applies it. (Earlier blocks, like the May 7 2026 Square parity columns, were hand-run in the SQL editor; that is no longer the path.) Caveat: the migrations workflow currently reports red on every run because a few old files are not idempotent, even though migrations still apply. See Block Plan Op-7 for the fix. Verify any new table actually landed via the Supabase MCP read tools.

### Critical RLS policies
Every table has Row Level Security enabled. Therapist can only access their own rows. Client portal (booking page) uses anon role with carefully-scoped read/write policies. NEVER disable RLS to debug, find the policy that's blocking and fix it.

**Tables the public booking page MUST be able to read (anon role):**
- `therapists` (basic profile fields only)
- `services` (active only)
- `locations` (active only)
- `addons` (active only)
- `memberships` (visibility != 'private', active only)
- `packages` (visibility != 'private', active only)
- `blocked_days` (added May 21, 2026 from Candice incident, see below)
- `availability` and `availability_overrides` (recurring weekly hours + date overrides; both anon-readable so the booking page can compute correct slots)

**Availability resolution logic (Jun 4 2026).** For a given date the booking page resolves the day's hours in this order: (1) a row in `availability_overrides` for that exact date wins. If `is_closed`, no slots. Otherwise its `start_time`/`end_time` (or `time_blocks`) are the hours, even if the weekday is normally closed. (2) Otherwise the recurring `availability` row for that day-of-week (per-service row if the service has its own schedule, else the master row). (3) Otherwise the day is closed. Overrides are master-level: they apply across all services. Therapists set overrides three ways, all writing the same rows: the Schedule view "Hours" bar + day sheet (one date), Settings > Date-specific hours add (one date or several at once), or Settings > Copy a week forward (replicates a week's override rows to the same weekdays in the next N weeks). Deferred: split-shift editing in the override sheet (the table already supports `time_blocks`; only the editor UI is single-block).

**Critical lesson, May 21 2026 (Candice blocked-day incident):** Any table the booking page queries needs an explicit public-read RLS policy. Default `FOR ALL USING (therapist_id = auth.uid())` returns empty silently when called by the anon role (since `auth.uid()` is null), which the JS client treats as "no rows" rather than an error. Symptom: customer reports a feature appearing broken on the booking page even though data is correct in the dashboard. Root cause: missing public-read policy. Fix in commit `613de194`, migration `2026-05-20-blocked-days-public-read.sql`. When adding any new table the booking page reads, add a public-read policy in the same migration.

### Supabase MCP connector access control (set May 28, 2026)

Claude is connected to the live Supabase database (project `rmnqfrljoknmellbnpiy`) via the Supabase MCP connector, so it can read the database directly for diagnostics (schema checks, reading notification_log, confirming data) without HK having to run SQL on his phone.

**Hard rule: Claude reads, HK writes.** Until HK decides otherwise, every change that writes or alters data or schema (INSERT, UPDATE, DELETE, ALTER, migrations) goes through HK: Claude drafts the SQL inline in chat, HK runs it himself in the Supabase SQL editor. Claude never writes.

**This is enforced, not just a promise. Two independent layers:**
- **Layer 1 (active):** In Claude, Customize > Connectors > Supabase > Tool permissions, the **write/delete tool category is set to Blocked**. Claude physically cannot invoke a write tool through the connector. Read-only tools stay allowed. This is the live control as of May 28, 2026 and is sufficient on its own.
- **Layer 2 (optional, not yet set):** A read-only database credential would enforce read-only at the Postgres level itself, so it holds even if a Claude-side setting changed. Postgres is the actual database engine underneath Supabase; a read-only Postgres role is a login granted only SELECT, never INSERT/UPDATE/DELETE/ALTER. Set this up (Supabase MCP `--read-only --project-ref=` flag, or a SELECT-only role) only if maximum assurance is ever wanted. Not required for safety today.

**To verify Layer 1 is still on:** Customize > Connectors > Supabase > Tool permissions; confirm write/delete is Blocked. To grant Claude write access later (e.g. for a trusted migration), HK flips that category to Always allow or Needs approval, then back to Blocked when done.

**Why this is safe:** with write/delete Blocked, no file instruction, prompt, bug, or mistake can write to production through Claude. HK's deliberate, hand-run SQL in the editor (using his own full-access login) remains the only write path.

---

## 9. Build philosophy and operating rhythm

### How HK and Claude work together (current operating mode)
- **HK directs, Claude executes.** HK does not write code. Claude does the work and reports what changed in plain English.
- **HK does not ask permission to ship.** "Build me X" means "build X and push it." No staging environment for marketing changes; everything goes to production.
- **Claude commits each meaningful chunk separately.** Atomic commits with detailed commit messages. Easier to revert if anything breaks.
- **Claude writes thorough commit messages** so the git log itself serves as the running log of what changed and why.

### Rules Claude follows that a human team should adopt
1. Always check `ENVIRONMENT.md` before asking HK for secrets
2. Never use em dashes in user-facing text (HK style preference, applies to UI strings, emails, docs)
3. Always use "MyBodyMap" not "BodyMap" in user-facing text
4. React hooks imported individually, never `React.useState`
5. Never `git add -A` or `git add .`. Always explicit paths.
6. Never take shortcuts or apply weak mechanisms. Always find the root cause. If a workaround is needed temporarily, flag it explicitly and schedule the proper fix.
7. Cream demo frame is a design principle, never tune the frame to fix a single demo's problem
8. Taxonomy is locked at 7 ribbons; new features go inside ribbons, not as standalone marketing surfaces
9. HK confirms before adding any new card to `featuresData.js`
10. Marketing image batch — accumulate placeholders in BLOCK_PLAN #8, never one-at-a-time asks

### When Claude pushes back
Claude is expected to push back on weak reasoning, missing context, or premature optimization. Recent examples:
- HK proposed bolting `<PaymentParityCard />` onto Home; Claude flagged that this violates the seven-ribbon taxonomy. Result: cards moved into ribbon 6.
- HK proposed widening demos by changing frame padding; Claude implemented it then HK pushed back ("cream frame is a design principle"). Result: scoped class-based fix instead, frame untouched.

A human team should preserve this dynamic. Yes-people make worse software.

---

## 10. Marketing and growth strategy

### Voice and persona
All customer-facing copy is signed by **"Joy / MyBodyMap Team"** (never HK). Persona: a warm, plain-spoken 70-year-old female LMT who has been in practice 25 years and now works at MyBodyMap as the friendly face of customer success. She's the founder voice, but she's NOT HK.

Style rules:
- Open with a warm human note
- Numbered sections in prose paragraphs (6-7 features), never bullets
- Add transparency lines and plain-English parentheticals
- Close with time-back framing + emotional list (body, clients, family, yourself)
- Link to the specific page being discussed
- No em dashes anywhere
- Write for a 70-year-old female LMT persona

Full voice guide: `docs/email-voice-guide.md`

### Positioning vs competitors
- **Vagaro:** "What you stop worrying about" — peace of mind, not features
- **MassageBook:** "We don't paywall what should be free" — pricing transparency
- **ClinicSense:** "Built for solo, not for clinics" — fit for purpose
- **Acuity:** "We don't make you a marketer" — anti-funnel

### Channels in use
- **DM outreach:** HK personally messages therapists who follow @mybodymap01 on Instagram or who shout out the platform on Facebook
- **Email broadcasts:** Joy persona, plain text, batched 10-30 therapists at a time via Resend
- **Founding therapist program:** Free Silver tier for life, first 100 therapists, no credit card required

### Channels NOT in use
- Paid ads (Google, Meta, etc.) — premature until 100 founding therapists give us product-market-fit signal
- SEO content marketing — not until we have stable feature surface
- Conference/event presence — too expensive at this stage
- Affiliate / partner program — premature

### Marketing assets
Lifestyle photos in `public/images/`. Naming convention `feature-{ribbon}-{card}.jpg`. Some are placeholders awaiting real images (BLOCK_PLAN #8). When real images are generated, drop into `public/images/` and overwrite placeholders.

---

## 11. Pricing and unit economics

### Tiers
- **Bronze:** Free. Intelligence layer for first 5 sessions per client only.
- **Silver:** $19/mo or $190/yr. Most features.
- **Gold:** $49/mo or $490/yr. Adds advanced AI, priority support, white-label booking page.

### Founding therapist program
First 100 therapists get Silver tier free for life. No credit card required at signup. Beta coupon `BETAONE` provides Silver at 100% off for 12 months (25 max redemptions, expires Jun 1) for therapists messaging on social.

### Unit economics (estimated, not yet validated)
- **CAC:** ~$0 currently (organic + DM outreach)
- **LTV (Silver):** $19 × 24 months expected lifetime = $456
- **Gross margin:** ~85% after Supabase + Vercel + Resend + Anthropic costs
- **Payback period:** 1 month at current CAC
- **Stripe/Square fees:** therapists pay processor fees directly, not us. We don't take a transaction cut.

### When to raise prices
- After 100 founding therapists
- After validated retention (>80% MoM at 6 months)
- After at least one therapist has voluntarily said "I would pay more"

---

## 12. Competitive landscape

### Direct competitors
- **Vagaro:** $25-$100+/mo. Spa-focused. Bloated. 12-step calendar setup. Mobile-first but mobile UX is also bloated.
- **MassageBook:** $20-$60/mo. Massage-specific. Stuck in 2015 design-wise. Card-on-file paywalled.
- **ClinicSense:** $39-$79/mo. Clinical-leaning. SOAP notes paywalled at higher tier.
- **Noterro:** $29-$59/mo. Canadian-owned. Strong on charting, weak on retention/marketing.
- **Jane App:** $74-$109/mo. Premium clinical. Excellent build quality. Too expensive for solo cash-pay LMTs.

### Indirect competitors
- **Acuity / Squarespace Scheduling:** general booking, not massage-specific. $20-$49/mo.
- **GlossGenius:** beauty/salon-focused. Strong product. ~$24-$48/mo.
- **Square Appointments:** free with Square processing. Generic.
- **Paper / Google Calendar / Excel:** still the largest competitor by therapist count.

### Differentiation
1. **Dual-processor parity (Stripe + Square).** No competitor does this. They all force their own merchant relationship.
2. **Body-map intelligence.** Longitudinal tension pattern tracking unique to massage therapy. No competitor has this.
3. **Retention-first design.** Every feature built to get the client back. Competitors build for transaction.
4. **Pricing transparency.** No paywalls on essential features.
5. **Modern UI.** 2025-era design, not 2015. Visible to any therapist who looks.

Full competitive analysis: `research/competitive-analysis-2026-04.md` and `research/noterro-competitive-analysis-2026-04.md`

---

## 13. Open risks and what could break

### Risks that would hurt revenue
- **Square activation friction.** Each therapist must complete identity + bank verification at squareup.com/activate before charges process. ~5-10 min one-time but creates abandonment risk.
- **Customer acquisition is unproven.** DM outreach works for 1-10 therapists. Not validated for 100+.
- **Pricing is a guess.** $19 Silver might be too cheap (insufficient unit economics) or too expensive (slow growth). Need real signal.

### Risks that would hurt the product
- **Single point of failure: HK.** No bus factor protection. If HK is unavailable for >2 weeks, no one updates the product. Mitigation: this runbook + automated edge function deploys + clear documentation.
- **Single AI dependency: Claude.** AI features depend on Anthropic API. If Anthropic changes pricing 10x or shutters API, AI features need a fallback. Mitigation: capability is encapsulated behind one helper function; could swap to OpenAI/Gemini in a day.
- **Stripe or Square account suspension.** If either processor flags MyBodyMap or a therapist's account, charges stop. Mitigation: dual-processor abstraction means therapists with both connected can still operate.

### Risks that would hurt legally
- **Therapist misuse of cancellation policy.** Therapist sets aggressive policy, charges client without consent. Client disputes with Stripe/Square. Chargebacks against therapist (not us, since we are not merchant of record). But reputational risk to MyBodyMap. Mitigation: mandate at booking is explicit, IP-stamped, time-stamped, exact-amount, NACHA-style.
- **HIPAA misclassification.** Most solo cash-pay therapists are not HIPAA-covered entities (HIPAA generally applies only to electronic insurance billing). If a therapist later starts billing insurance, they need a Business Associate Agreement with us. Currently we do not offer one. Mitigation: clarify in Privacy & Security card (6.4); add BAA when first therapist asks.
- **Refund disputes for ACH (if we ever build it).** ACH returns up to 60 days. Not building ACH per May 7 decision.

### What the founder shouldn't worry about (genuine non-risks)
- **PCI compliance:** Stripe and Square handle all card data. We never store PAN.
- **Data breach of card data:** same as above.
- **State sales tax:** SaaS sales tax varies wildly. At pre-revenue stage, not material. Address pre-100-customer mark.

---

## 14. Decision log

Major decisions made and the reasoning behind them. Append to this rather than overwriting.

### Jun 1, 2026 (Jacquie incident + crash-prevention trio)

- **Jacquie Bodkin's "blocks keep disappearing" complaint root-caused to a Timeline visual bug, not a data bug.** Her three duplicate 2:45-4 PM "Facial" block rows came from her recreating the block each time she saw "Open · 2h available" overlaid on the amber-striped block. Timeline `gaps` computation considered bookings only, not partial blocks. The booking-page slot generator DID respect blocks correctly, so no client ever booked into her blocked window. Fix in commit `525eac1f`: gap-calc subtracts blocks, sub-segments under 90 min suppressed. **Duplicates retained as evidence per HK explicit instruction**, not deleted. UNIQUE constraint on blocked_days queued as Risk Register item #6.

- **Monthly view day-list now interleaves partial blocks with appointments (commit `f9998d73`).** Pre-fix: the 8:51 AM Monthly snapshot showed 7 appointments and zero indication that 2-4 PM was blocked. 70-year-old persona could open Monthly, see appointments, and never know a block existed. Now blocks render as amber "🌿 Time off · 2:00 PM - 4:00 PM" cards interleaved with appointments sorted by start time. Header reads "X appointments · Y time off." First-attempt fix at commit `58e2bb60` crashed iOS Safari (rule #33 violation: used `new Date("2000-01-01 1:30 PM")` which iOS rejects). Reverted in two stages, re-shipped with safe regex-based parsing.

- **Three-deep crash-prevention infrastructure shipped (commit `6691d2fb`).**
  1. **ViewErrorBoundary** wraps every Schedule subview (Today, Weekly, Monthly, Yearly, Insights). A crash now shows a contained "View hit a snag" sage-cream card with reload button. Rest of app stays alive. Aligns with rule #11 "Never show error pages to customers."
  2. **SW v35 update-ready banner** replaces v34 silent force-reload. v34 worked but interrupted mid-flow users. v35 posts `SW_UPDATE_READY` and the page renders a sage-green non-blocking "Refresh" pill at the top with Refresh + Later buttons. User controls the reload moment. Still uses skipWaiting + claim so the message reaches every open client.
  3. **`/founder/mobile-preview` iframe** at 380x720 with path presets (Home, Schedule, Clients, Settings, Joy booking page) and live-vs-localhost toggle. Lets HK verify Schedule + Booking-page changes at mobile viewport before push. Codified as rule #35 (iOS Safari is the canary).

- **Founder broadcast email validator bug (commit `47741f37`).** All 62 sends of the May/June re-engagement broadcast failed silently because `product_update` was in the `ActionType` TypeScript union but missing from the `validActions` runtime array. Last successful product_update was Apr 29 2026: that one ran before someone tightened the validator without updating it. One-line fix; permanent mitigation queued as Risk Register item #10 (refactor to `validActions = Object.keys(templates)` so they stay in sync by construction).

- **Customer broadcast email voice locked in as Design Principle #32 (commit `1d065994`).** After 5 turns of HK feedback on a single broadcast draft, captured the canonical shape: open with "We've been listening...shipped within a week. Thank you" + "Platform stays free for you," five numbered action-shaped items with path + taxonomy ID in parens for Settings cards, "While you're there..." cross-promotion, conversational "no more X?" lines, close with "Sign in: mybodymap.app" + "Reply and a real person answers," sign-off `- MyBodyMap` single hyphen, ~150 words, no backend mentions. Anti-patterns from this iteration logged in the principle.

- **NEW Design Principle #33: Never use `new Date(string)` for non-ISO inputs.** iOS Safari rejects non-ISO date strings as Invalid Date; downstream `.getHours()` on what becomes a string crashes the whole tree. Use regex-based parsing for 12-hour times, `.split(":") + parseInt + isFinite` for 24-hour times.

- **NEW Design Principle #34: JSX render blocks have a temporal dead zone for `const`.** Reading a `const` before its declaration in the same function body throws ReferenceError at runtime. Build doesn't catch it (no ESLint `no-use-before-define`). Manual care required.

- **NEW Design Principle #35: iOS Safari is the canary.** Before pushing any change to Schedule, Booking page, or any date/time-parsing surface, view at mobile viewport via `/founder/mobile-preview`. Most therapists and clients use mobile. Most crashes are mobile-only.

- **Risk Register on /founder page now has 10 open items.** Added: 14 .in() unbounded array sites (Medium), notification routing C2/C11 (High), BookingManage broken (High), PWA force-reload edge case (Medium), SendModal image-URL friction (Low), block dedup at DB level (Medium), **side panel intermittent failure on mobile (High, reproduction inconsistent, queued for screen-recording QA pass)**, mobile PWA stale-bundle during deploy windows (High), no ESLint `no-use-before-define` (Medium), edge function validActions/templates dual source of truth (Medium).

### May 25, 2026 (evening, slide-over Phase 22-25a + deposit gap discovery)

- **Slide-over schedule cockpit redesign complete through Phase 24f (24 commits across two sessions, May 24 evening + May 25 marathon).** Phases 20-21 built the data foundation and inline editors (BodyMapPreview rewrite with front+back silhouettes, RecordEditor with SOAP + private notes + draft button, RecapEditor with send wiring); Phases 22-24 added design tokens / Label component / responsive width / scroll-lock / heatmap moat visualization / PracticeIQ rebrand (54 in-app + 12 doc occurrences); Phase 24f wired Web Speech API dictation across all SOAP fields + per-doc print/send shortcuts that route through existing DocumentDrawer.jsx (which already had email/SMS/PDF/copy/share but was hidden behind journey-dot clicks on SessionDetail). Net result: the schedule slide-over is the single primary work surface for a therapist between sessions. The Body Map Patterns panel shows the longitudinal heatmap moat directly in context the moment a returning client's appointment is tapped (sage focus zones grow by frequency, rose avoid zones, threshold dropped from 3+ to 2+ sessions so the moat appears as early as session 2).
- **Discovered May 25 2026: approve+deposit interaction silently drops deposits.** Triggered by Candice Peek's "how do I require a deposit" support ask. Her config: `deposit_enabled=true`, `deposit_percent=30`, Stripe connected, but ALSO `require_approval=on`. Booking page correctly skips deposit at request time (no refunds for declined requests), but `booking-approval` edge function (line 82) sets `newStatus = action === 'approve' ? 'confirmed' : 'cancelled'` with no deposit-collection branch. Comment in code at BookingPage.js:816 acknowledged the gap: "the therapist sends a payment link after approving." No UI prompted this, no automation, no follow-up. Every first-time deposit Candice thought she was collecting was silently never charged. **This is the worst kind of bug: silent, revenue-destroying, undocumented to the customer.** Phase 25a shipped (commit `a8e136d2`) surfaces the gap via Settings warning banner (yellow, only appears when both settings on) and fixes the misleading approval emails. Phase 25b (queued, ~1.5-2h) is the architectural fix: pre-collect card on file at booking time via SetupIntent + auto-charge deposit on approval via existing `create-deposit` infrastructure. **HK's instinct on the right fix was correct:** "Sending a payment link is very old process as people may not get email or may not see it." Pre-capturing the card and auto-charging avoids every fragile delivery hop.
- **Skipped duplicate `new_client_signup` email when status is pending-approval.** HK self-tested the flow with Joy Client Demo 2 and got an email titled "First-time client: Joy Client Demo 2 just booked their first session with you" with CTA "Open Clients" that landed on a blank page. Booking was actually awaiting his approval. Three problems in one notification: misleading copy (booking wasn't actually booked), wrong CTA destination (/dashboard/clients is blank for a brand-new client because no client row exists yet), duplicate of the proper "New booking REQUEST" email the system was already sending from the main flow. Phase 25a fix: gate the `new_client_signup` emit on `!isPendingApproval`, change all approval-related CTAs to `/dashboard/schedule` where the Pending Requests panel sits at the top of the page. Button copy updated to "Review request" (pending) and "View on schedule" (confirmed). Codified as DESIGN_PRINCIPLES rule 22.
- **Desktop SOAP dictation via Web Speech API (Phase 24f).** HK feedback: "For SOAP, dictation is intuitive for phone as the record button is there on the keyboard. For desktop I am not clear myself on how to voice record it." Created new `MicDictationButton` component using `window.SpeechRecognition || window.webkitSpeechRecognition` (continuous mode, English, no interim results to avoid jittery text). Wired six instances: S, O, A, P fields + Private notes in RecordEditor + Message-to-client in RecapEditor. Each independent so therapist can dictate one section, stop, think, continue. Button hides itself silently on Firefox (no SpeechRecognition support). Codified as DESIGN_PRINCIPLES rule 24 ("The mic button is a feature, not a metaphor").
- **Per-doc print/send shortcuts revealed by infrastructure audit.** Investigated HK's ask "Mobile: print buttons for each of 4 docs + SMS option for doc 4". Discovered the entire toolbar (Email link, SMS link for doc 4 with `client.phone` check, Copy image, Share image, Save PDF) already existed in `DocumentDrawer.jsx` (lines 570-605), but was hidden behind a journey-dot click on SessionDetail with no entry point from the slide-over. **Lesson: before designing a new surface, search for whether the capability already lives somewhere else and just isn't discoverable.** Phase 24f fix: added 4 pill buttons (📋 Intake / 🌿 Brief / ✍️ Record / 💌 Recap) inside the Journey panel of the slide-over. Each links to `/dashboard/clients/{cid}/sessions/{sid}?doc=N`. SessionDetail now reads the `?doc=N` URL param on mount and auto-opens DocumentDrawer for that doc. One change to the entry surface, zero changes to the toolbar implementation. Time saved by reusing existing infra: ~3 hours.
- **Slide-over scroll-past-Cancel bug fixed at root.** Persistent bug from Phase 23 through Phase 24c: therapist on iPhone could not reach the bottom of the slide-over (Cancel/Reschedule actions). Initial Phase 23 fix put `paddingBottom: calc(env(safe-area-inset-bottom, 0px) + 60px)` on the outer scroll container. Looked correct in dev but WebKit scrolled past the padding so the last actions remained unreachable in production. Real fix in Phase 24c+24d: moved `paddingBottom` to the INNER content div, added `overscroll-behavior: contain` to stop scroll chaining to the parent page, added body scroll lock (`document.body.style.overflow = 'hidden'` while open). Codified as DESIGN_PRINCIPLES rule 20.
- **Founder Income Statement section shipped.** New section 9 on /founder page surfaces the operating P&L for the LLC: revenue lines (Vercel paid plan revenue, founding therapist trials), cost lines (Vercel hosting, Supabase Pro, Resend, Twilio, Stripe fees, Anthropic API, legal, insurance) self-seeded from prior chat context into a new `finance_line_items` table. Resend `error_message` column finally captured on failed sends (had been stuffed into body_snippet with `RESEND_ERROR` prefix). Surfaced an important discovery: all 105 prior "(no error logged)" rows in notification_log were 429 `rate_limit_exceeded` errors. Resend Pro upgrade does NOT raise the 5 req/sec limit; need to add 250ms throttle to `release-pending-emails` + `founder-fire-all-notifications` batch senders (queued as BLOCK_PLAN item 32).

### May 24, 2026 (evening, broken-bookings + cron rebuild marathon)

- **Phase 13.9-13.11 findOrCreateClient rewrite (commits `c8692328`, `28e9eec3`, `dba1522c`, `4edb1ff1`).** Triggered by Terra Irving's report of "Client record missing on this charge" on 11 bookings across her two business accounts. Root cause: helper returned null whenever email was missing, causing every walk-in or phone-only booking to insert with NULL `client_id`. Fix: two-path lookup. Path A unchanged (email-first). Path B new: when email is missing but phone is present, look up by phone last-10 digits scoped to therapist_id. Phase 13.10 added stub enrichment so a phone-only client created on an earlier booking gets enriched with email rather than duplicated when same person books again with email. Phase 13.11 added the critical name-match requirement on all phone-based reconciliation. **Husband+wife sharing a phone is common; phone-only matching would silently merge two humans into one client record, comingling sessions, payments, intake forms. That data corruption is harder to unwind than the inverse (one human in two records, fixable via consolidation UI).** Trade-off accepted: same person entering name slightly differently across bookings gets two records, therapist merges later.
- **Phase 13.12 inline ClientPicker in CheckoutModal (commits `e5fb1718`, `2da311c0`, `a1876e6c`).** Closes the loop: 13.9-13.11 prevents NEW broken bookings, ClientPicker recovers EXISTING broken ones without a support ping. When CheckoutModal opens an appt with NULL client_id, modal opens in `select_client` step before method picker. Sage banner, searchable list of therapist's clients (filtered by name, email, or normalized phone digits), plus "+ Add new client" inline form that calls findOrCreateClient under the hood. On pick or create: UPDATE bookings.client_id + client_name + client_email + client_phone, fire onClientLinked callback so the slide-over header re-renders immediately. **Resolves the self-serve gap for Candice's 3 future-dated broken bookings (HK directive: do not touch her account, she'll resolve via picker when she opens any of those bookings).**
- **Package add-vs-charge split (commit `8d6d45d3`).** HK from screenshot: "When I add a package, it is asking for a checkout right away. It should first add the package just like we do in memberships." Memberships have Add membership → row created → separate Charge $X now button per cycle. Packages were doing both in one combined "Checkout $X" step which broke the mental model. Three changes: (a) form button renamed to "Add package", creates package_purchases row immediately with status='active', no payment, (b) each active package card gets a conditional "Charge $X" button next to Cancel, only shown when no succeeded session_payment is linked and price_paid > 0, (c) CheckoutModal createPackagePurchaseRow now handles existing-package mode: if `packagePurchase.id` is provided, skip the INSERT, refetch existing row, attach payment to it. Decision principle reinforced: payment flows go through CheckoutModal, never separate inline payment forms.
- **Removed duplicate ClientPackageBalance from Sessions and SOAP notes (commit `7028885a`).** Was rendering inside Sessions section + showing stale "active" data after cancellation because the component loaded once on mount and never refetched. New dedicated Memberships & Packages section (May 24 redesign) handles both display and cancellation correctly. Decision: when redesign supersedes an embedded component, delete the embed in the same change, do not leave the old code as defensive dead code.
- **Yearly view cells now clickable with day-detail modal (commit `01fac9cd`).** HK: "Those cells with shade of green should be clickable. Right now it is useless and no functionality." Heatmap cells with bookings render as `<button>`, opening a centered modal listing every appointment for that day (avatar, name, time, duration, service, status pill). Zero-booking cells stay non-clickable. Modal is intentionally read-only; actions live in Today/Monthly tabs to preserve the Yearly view's at-a-glance focus (Design Principle #18).
- **Schedule empty-state copy fix (commit `638b14bd`).** HK: "We just brought in future appointments." Removed inaccurate "CSV imports bring over past visit history, not future appointments" line from both weekly and monthly empty states. Terra's CSV brought June and September 2026 bookings cleanly. Empty state now just shows next action ("Tap Book Appointment...").
- **Cron audit and rebuild (item 27 in BLOCK_PLAN).** Diagnosed via `net._http_response`: every cron was 401ing silently for weeks. Two failure modes: missing Authorization header (4 crons) + stale Feb-2026-rotated anon JWTs (3 crons). Fix attempted via `ALTER DATABASE postgres SET app.settings.service_role_key` per the May 14 google-calendar template but blocked by Supabase Pro permissions (`42501: permission denied to set parameter`). Fell back to hardcoded service_role JWT per cron. Service_role keys expire 2087, so rotation maintenance is rare. All 6 crons rebuilt + duplicate `send-booking-reminders` deleted + `daily-signups-digest` URL bug fixed (was calling `/bodymap-ai`). Force-fired practice-pulse, got 200, email landed. **First real production validation tomorrow morning 9am UTC when send-reminders cron actually fires.** See Procedure 11 for full diagnostic flow.
- **Practice Pulse logic switched from sessions to bookings (commit `4c170230`).** HK: "We should run the pulse based on the activity that day vs SOAP notes." Function was reading `sessions.created_at` for today's activity, but `sessions` only has rows when therapist writes SOAP notes (rare). Real activity lives in `bookings`. Rewrote activity gate to use bookings.booking_date + status filter for today, same approach for lapsed/due detection (single batched .in() query per therapist instead of per-client subqueries). Also added defensive `select('*')` on therapists and a `skipped` array in response (no_email, pulse_disabled, unsubscribed, nothing_to_report) so founder can audit who got skipped and why.
- **NEW Design Principle #20: Cron-driven functions must surface skip reasons in their response.** Codified after `processed:0` returns gave zero diagnostic value. Every iteration that decides not to send must push a row to a `skipped` array with `{id, name, reason}`. Without this, the only diagnostic path is digging through function logs.
- **NEW Design Principle #21: pg_cron "succeeded" status is not proof a function ran.** Codified after the cron audit revealed every cron was 401ing while pg_cron reported all runs as succeeded. The real truth is in `net._http_response.status_code`. Any cron-monitoring tool must query that table directly, not rely on `cron.job_run_details.status`.
- **NEW Design Principle #22: Fix cron auth FIRST when auditing notifications, downstream errors only become visible after cron auth works.** Codified after fixing google-calendar-reverse-sync auth surfaced 2 pre-existing OAuth token issues (Candice missing calendar scope, HK token expired) that had been silently failing for weeks. Lesson: broken cron auth masks all downstream errors. Always fix auth first, then triage what newly-visible errors emerge.
- **Sleep at 11pm Central with cron rebuild verified end-to-end and Practice Pulse email landed.** Decision: stop on a green commit. Tomorrow's followups in BLOCK_PLAN items 27b (daily-renewal-creation cron), 27c (SMS failure root cause), plus Google Calendar token reconnect flow for affected therapists.

### May 22, 2026 (evening, Schedule + Outreach sweep)
- **Schedule weekly view rebuilt to Outlook-style time grid on desktop (commit `c5cef7cb`).** Previous weekly was a vertical list of day cards with appointment rows. Outlook-style means hour rows on left, day columns across, sessions positioned absolutely by start_time with height = duration, blocked windows as amber hashed bands, today's column tinted sage, "now" line in red. Window expands beyond default 7am-9pm if any booking falls outside. Mobile got a companion horizontal time-strip per day card (commit `b7ce28ff`) so phone users see the day's rhythm without an Outlook-style grid (too dense for 375px). Strip is decorative-not-required: bar taps open the session detail same as a row tap.
- **Schedule Yearly view shipped (commit `9f72cffd`).** Replaces the long-standing "coming soon" placeholder with a real 12-month heatmap. Day cells colored by booking density on a sage gradient. Blocked days tinted amber. Year stats below (busiest stretch, quietest stretch, total). Care-framed copy on the quietest-stretch label ("Good window for rest, learning, or outreach") per the new Design Principle #17. Design choice per the new Design Principle #18: pure at-a-glance, no tap-to-drill, Monthly tab handles details.
- **Schedule growth insights deepened: 7 care-framed observations (commits `c02973af`, `916de164`).** Replaces the prior shallow strategy library ("cluster slots", "offer 90-min sessions") with seven data-grounded insights computed every render: A first-session check-in, B cadence drift, C open time as welcome capacity, D top clients quiet, E day-of-week imbalance, F membership candidates, G cancellation flag. Three of them (A, B, D) deep-link to outreach modal with named clients pre-selected. F and G had data-wiring bugs in the parallel-session deepInsights library (F never filtered out current members, G tried to filter from a query that excluded cancelled); fixed by loading `memberClientIds` + `cancelledLast30Count` in SmartBookingRail and threading them through. Cap lifted from 4 to all firing. Framing throughout follows the new Design Principle #17 (care + growth, no money).
- **NEW Design Principle #17: Care framing over revenue framing for the 70yo persona.** Codified after HK pushed back on initial insight proposals that used "$N at risk" / "conversion lever" language. Therapist-facing UI in proactive contexts (Schedule, Outreach, push notifications) must use care + growth language. Dashboards explicitly opened for money review (Billing, Insights tab) can use revenue language.
- **NEW Design Principle #18: At-a-glance over interaction depth on read-only summary views.** Codified after the Yearly view design decision. Year-overview and mobile-summary surfaces should pack information visually rather than require taps. Tap-to-drill goes on detail views; summary views render everything visible.
- **NEW Design Principle #19: Force-with-lease is only safe when the remote SHA you're overwriting is one you've seen.** Codified after a near-miss during the B resumable-imports push where my force-with-lease overwrote `3fa11eac` (CTIA-compliant SMS commit from a parallel session). Recovered by finding the SHA in local reflog and re-pushing the combined HEAD with explicit SHA syntax. New procedural rule: fetch + compare both directions BEFORE any force push.
- **Outreach Quick Send Custom card shipped (commit `f82c20b6`).** Five preset starter templates already existed (welcome new, miss-you, ready-when-you-are, package balance, special this month). Custom card sits as the FIRST option, opens a CustomClientPicker → QuickSendModal flow. Picker has search by name/email, multi-select via large checkbox tiles, "select all matching" pill when a query is active. 70yo persona safety: large tap targets, plain copy, no power-user shortcuts. Recipients pass through QuickSendModal's existing `recipients` prop. No new backend wiring.
- **Lapsed-clients deep link shipped (commit `68ef35ba`).** Previously, tapping the "Reach out to N lapsed regulars" button on the schedule growth insights navigated to /dashboard/outreach and dumped the therapist on the quick-send picker, losing the 3-client context. Now the navigation carries the specific clients in router state and Outreach opens QuickSendModal directly with them pre-loaded plus a care-framed template ("Thinking of you" subject, soft check-in body). The "industrialize the action, not the actor" lens applied to a small but high-frustration UX moment.
- **Blocked-day visual cues unified across all schedule scopes (commit `dd1fd45f`).** Weekly day-cards on mobile + desktop now have amber borders and "🌿 Time off" badges. Monthly cells get amber tints with corner indicators. Partial blocks render with sage outlines. The cue that was already present on the desktop time grid for full days became a system pattern. Triggered by HK screenshot showing blocked days looking identical to genuinely open days.
- **Settings Square language audit (commit `71304595`).** "Online engine" label on the Stripe + Square connected badges renamed to "Connected" (both processors, for symmetry). Memberships description rewritten to acknowledge Square (was Stripe-only stale copy). `window.confirm('Disconnect Square?')` replaced with inline-confirm pattern per the no-popups design rule. `alert('Error: ' + JSON.stringify(data))` on Square OAuth failure replaced with inline red error card. Multi-file copy sweep: Settings Dashboard, PaymentRouting, ImportClients success card, all aligned on accurate dual-processor framing.
- **Square memberships frontend-backend drift fixed (commit `eed0e907`).** Backend (BILLING_STRATEGY capability matrix, purchase-membership and confirm-membership-purchase edge functions) already supported Square memberships with first-month full + one-tap monthly renewal. But BookingPage.js was hiding/disabling membership purchases for Square-only therapists with a "Stripe required" padlock. Fixed by replacing `hasStripeForMembership` with `hasProcessorForMembership` and sweeping 5 files for stale Stripe-only copy. Lesson logged: when a backend capability ships, sweep frontend gating + copy in the same change.
- **Schedule weekly mobile UX gap closed (commit `b7ce28ff`).** The screenshot HK shared showed every weekday rendered as a flat list with "No sessions / Open day" text. Visually identical for genuinely-empty Wednesday and today's Friday. New horizontal time-strip per day card (when there are bookings or partial blocks) shows the day's rhythm at a glance: mini-bars per session positioned by start_time, amber bands for blocks, vertical red bar for "now". Hidden on fully-empty open days (nothing to show) and fully-blocked days (badge says it).

### May 21, 2026
- **Schedule future window raised from 60 to 365 days.** The 60-day cap (set April 1 in commit f9bf30495 as a safe arbitrary number) hid 80% of Jackie's real bookings. Real therapists book weekly standing clients a year out. Past window stays at 365. Explicit `.limit(2000)` added for query safety.
- **CSV imports now require Maria-friendly safety on every silent auto-create path.** Triggered by Jackie's catastrophic import (1,988 fake records from one mis-mapped column). Three protections now standard on both client and appointment imports: strict whole-word column matching, pre-flight checks for too-many-distinct or names-in-service-column, phone normalization to prevent duplicate clients. Plus a price-entry step before service auto-create runs. Any future silent-auto-create path must adopt these.
- **Buffer minutes and other therapist-facing numeric inputs must use InlineSaveNumberInput, never raw `type="number"`.** The `type="number"` + `step` + `parseInt fallback to default` pattern fights the user's typing on touch devices. Standing rule reaffirmed and applied to the Buffer setting in Dashboard.
- **Mobile-first or it doesn't ship.** Multiple UI commits today rendered fine on desktop but broke at 375px. Jackie sent a screenshot calling the block panel "third world." From now on, imagine the 375px iPhone render before committing any UI change. Added to design principles.
- **Blocked days surface visibly on the Schedule timeline, not silently.** Full-day blocks were filtered out of the timeline render with a comment saying "the whole canvas would be amber" as if that was the problem to avoid. The actual problem: a blocked day looked identical to an empty day. Now full-day blocks render as a canvas-wide amber band with the reason centered.
- **Reason for blocking time uses tappable pills, not a dropdown or open text alone.** Vacation, Personal day, Sick, Conference, Family, Other as default pills. Free-text fallback still available. Per design principle "Drop downs reek of Excel formulas and 1990s websites."
- **Schedule and import flows must show WHICH rows were skipped or failed, not just counts.** Jackie's question "Which ones are skipped and how can we see them?" exposed a real audit gap. Both imports now offer "Download N skipped rows" and "Download N failed rows" CSVs with the original columns plus `bm_reason` + `bm_details` appended.
- **Supabase CLI version pinned in deploy workflow.** `supabase/setup-cli@v1` with `version: latest` was rate-limited by GitHub's release API on shared runners, generating daily "Run failed" emails. Pinned to 2.100.1.
- **Critical RLS gap on blocked_days fixed.** The booking page (anon role) was silently returning empty blocked_days on every query because the RLS policy only allowed `therapist_id = auth.uid()`. Public-read policy now in place. This was the root cause of Candice's "blocked days not respected" reports stretching back to mid-May.
- **Google OAuth forces account picker every sign-in.** Added `queryParams: { prompt: 'select_account' }` to `signInWithOAuth`. Without it, Google silently uses whichever account the browser is already logged into, trapping therapists with multiple Google accounts (or shared devices) into the wrong account. Standard pattern on every modern OAuth-using product.
- **Two-import-tab UI is a Maria-persona failure. Replaced with single unified flow May 21 night (commit `da48468d`).** When a non-technical therapist has a CSV from MassageBook (or anywhere), they don't know whether to upload it as "Client Import" or "Appointment Import." Worse, exports often come as multiple CSVs (one for contacts, one for appointments) and the user has no way to bring them in together. Jackie hit this: appointment import created client stubs with no email/phone because that data was in a separate client-roster CSV she didn't know to upload. New unified flow accepts 1+ CSVs, auto-detects each by header inspection, cross-references across files to merge contact info onto client records. Old tabs hidden behind "Advanced import options" link. Pure import functions extracted to `src/lib/imports/` for reusability. Both runners now do UPSERT-on-name-match (previously only client import did). See design principle #14.
- **HIPAA-aware support is a standing principle.** Never ask a therapist to send their client data over DM, email, or screenshot for debugging. Build the user-side button or self-serve diagnostic instead. See design principle #15.
- **CheckoutModal gate (May 22 2026): gate the methods, not the modal, and treat both processors equally.** Initial fix to the 'stripe_not_connected_for_therapist' red-pill problem (commit `2506b8c2`) gated the entire modal on Stripe connection. HK caught this within minutes: it broke cash, check, Venmo, Zelle, and trade-session recording for therapists who legitimately don't use card payments through MyBodyMap. Proper fix (commit `24b09f5f`): only the three card-based methods (Card on file, Enter new card, Send pay link) are gated. Mark as paid is ALWAYS available, regardless of processor state, and becomes the primary action when no processor is connected. Third iteration (commit `881be991`): inline CTA now shows BOTH Connect Stripe AND Connect Square buttons since Square is a fully-supported peer processor (not a secondary fallback). Fourth iteration (commit `cec8a1f8`): SessionList.js and MembershipsCard.jsx updated for parity. Lesson: when deciding what to disable, enumerate ALL legitimate workflows first, then gate only the ones that genuinely need the missing dependency. And when surfacing a CTA to unlock a feature, enumerate ALL the ways to unlock it, not just the most common one.
- **Resumable imports + undo shipped May 22 2026 (commits `d8474625`, `1ec5e8be`).** Client-side resumable: FNV-1a content hash + 25-row checkpoints in localStorage; if tab closes mid-import, re-dropping the same file resumes from the saved row. Idempotency via existingBookingKeys dedup loaded fresh from DB each run. Undo-last-import: every insert (client, booking, member_subscription) stamps `import_batch_id` UUID. Success screen shows red 'Undo this import' pill for 10 minutes. Two-tap confirm. Deletes scoped to (therapist_id, import_batch_id) for tenant safety. Server-side chunked architecture (item 16) queued for 50K+ row scale; client-side handles current load. **REQUIRED MIGRATION** before D works: `supabase/migrations/2026-05-22-import-batch-id.sql` adds the column to 3 tables. HK must apply via SQL Editor.

- **Import expansion completed May 22 2026 (commits `d3dc2727` through `fb05b20f`).** HK ran the full 9-item A-J sweep over a single working session: first-time welcome card with platform-specific export hints, smart-content currency detection, mode-switch state preservation, phone formatter applied across 4 more display sites (SessionList, ImportClients preview, FounderDashboard with duplicate consolidation, FounderMassSms), client profile AboutCard rendering address fields as a collapsible section with city/state/zip summary, 'See what landed' navigation pills on import success. Defers in BLOCK_PLAN: items B (file-metadata persistence, real fix is chunked imports), D (undo-import via batch_id), F (resumable chunks), I (per-service price prompts on fuzzy merge).

- **Frontend-backend drift on Square memberships (May 22 2026, commit `eed0e907`).** When Square subscription support shipped earlier (matched in BILLING_STRATEGY capability matrix as recurringRenewal=limited and routed correctly in purchase-membership / confirm-membership-purchase edge functions), the BookingPage.js frontend was never updated. Result: Square-only therapists had their memberships rendered disabled with a 'Stripe required' padlock badge on their own booking page, blocking clients from purchasing even though the backend would have routed correctly. Caught by HK during the broader Stripe-or-Square sweep after the CheckoutModal CTA fix. Fixed by: replacing hasStripeForMembership with hasProcessorForMembership (either processor unlocks), updating 4 stale 'Stripe-only' comments + copy strings across BookingPage, ImportClients, runImports, ClientProfile/MembershipCard, and Dashboard. Lesson: when backend ships a new processor capability, sweep the frontend for gating logic and update any 'requires Stripe' messaging in copy / comments / disabled-state badges at the same time. Add a checklist item to BILLING_STRATEGY.md or a future capability-rollout playbook.
- **Import flow expanded May 21 night (commits `de8e937d` through `35b4847b`):** added address/city/state/zip/country columns to clients table + import mapping; smart-content detection now samples column values to handle non-standard headers (Contact1 with emails); preview screen with first-5-row table shows what's about to happen before any DB write; phone formatter library applied to ClientList + import preview (`store canonical, display human` is now Design Principle #16); SOAP-style notes (Subjective/Objective/Assessment/Plan or combined) captured into bookings.notes; ImportedDataFootnote component appears on Billing dashboard when therapist has imported data; Schedule booking query cap raised from 2000 to 5000; beforeunload warning prevents accidental tab close mid-import.
- **Resumable chunked imports are queued (BLOCK_PLAN item #14).** Current import is client-side and one-shot; if tab closes mid-import, partial data lands. Beforeunload warning is the stopgap; chunked server-side processing with import_jobs table is the real fix. Estimated 4 hours.
- **Cannot transfer credit cards on file from competitors.** PCI compliance: Stripe and Square tokens are tied to a single merchant account. Client must re-enter card on first MyBodyMap booking. Will mark imported clients with a flag and send a 'we moved, please re-enter card' message on their first booking attempt. Queued.
- **Cannot transfer photos/uploads automatically.** Competitor CDNs (MassageBook, Vagaro) require login to access photo URLs in their exports. Future flow: therapist drops a zip of photos, we match by filename to client records. Queued.

### May 7, 2026
- **Decided to skip ACH entirely.** Phase 1 (Stripe Payment Element wallet methods) and Phase 3 (FedNow when ready) only. Reasoning: ACH liability is real (60-day return window, dispute exposure), customer benefit is marginal at $100 ticket, build cost is 3-5 days, and skipping it focuses scarce engineering on Phase 1 (which is 1 day, near-zero liability).
- **Founder Hub at `/founder` to be built.** Section by section. Runbook first, UI second.
- **Live documents will be updated at end of each session,** triggered by HK saying so. No automated nightly job for now.

### May 6, 2026
- **Stripe + Square parity shipped.** Both processors fully functional. Per-feature routing setting added.
- **PaymentMethodComparisonMockup at `/mockups/payment-methods` built** (three side-by-side ACH/Zelle/Apple Pay mockups) for therapist conversations.
- **FEATURES_TAXONOMY.md committed.** Six taxonomy rules, five design principles.

### May 5, 2026
- **Decided NOT to publish coupon code BETAONE on public site.** Therapists must DM Instagram/Facebook to receive it. Reasoning: qualifies leads, builds relationship, grows social following, keeps "founder" framing exclusive.

### April 2026
- **Decided IBM Project Luna and MFaaS deal not to be co-bundled.** Separate scopes. (Side context: HK's IBM work, not directly MyBodyMap.)
- **Decided MyBodyMap to use single-tenant per-therapist data isolation** rather than multi-tenant schema. Each therapist's data is RLS-isolated.

### Earlier
- **Decided to NOT build SMS until Twilio sender ID is approved.** Twilio compliance for healthcare-adjacent texts is real. Defer until we have 100 therapists who need it.
- **Decided MyBodyMap competes on retention, not acquisition.** Northstar is making it impossible for a client not to return.
- **Decided HK's exit goal is $100M.** Not lifestyle-business. Not aiming for unicorn.

---

## 14b. Income statement (living cost & revenue ledger)

A founder-only page at `/founder` → "Income Statement" tracks every recurring cost and revenue line. It's the single source of truth for what MyBodyMap actually costs to run and how that compares to what it earns.

**How it stays current.** Claude appends new line items to the `SEED_LINES` array in `src/pages/FounderIncomeStatement.jsx` whenever a chat reveals a new cost (a subscription you added, a vendor you switched, a legal/insurance commitment). The next time you open the page, the new lines are auto-inserted into `finance_line_items` and shown to you with a "Confirm $" placeholder. You inline-edit to confirm, and the entry becomes live.

**What to do when you accrue a new cost not yet on the page.**
1. Mention it in a chat with Claude ("I just signed up for X, $Y/month").
2. Claude appends a new entry to `SEED_LINES`.
3. Open `/founder` → Income Statement. The new line appears with "Confirm $". Click to set the actual amount.

**Status field semantics.**
- `active`: recurring monthly cost that's currently being incurred. Counts toward expenses subtotal.
- `queued`: committed to do but not yet incurred (e.g. Resend Pro upgrade pending, E&O insurance not yet purchased).
- `future`: speculative or future-potential expenses (e.g. TX foreign LLC qualification if attorney recommends).
- `paused`: was active, now paused (e.g. canceled subscription).

Only `active` rows roll up into the "Net monthly" tile. Queued and future are surfaced separately so HK can see what's coming.

**Categories.** Revenue, Infrastructure, Insurance, Legal & Compliance. Adding a new category requires editing `CATEGORY_ORDER` in the component.

**Manual entries.** If you want to add a one-off line that doesn't fit the seed pattern (e.g. a one-time consultant invoice), insert it directly via SQL:
```sql
INSERT INTO finance_line_items (key, category, label, monthly_cost, status, notes)
VALUES ('consultant_july', 'Legal & Compliance', 'Consultant invoice July 2026', 1500, 'paused', 'One-time engagement, July 2026');
```
Mark such rows as `paused` so they don't roll up into the monthly subtotal (since they're not recurring).

**Migration to enable editing.** The page renders in read-only mode until the `finance_line_items` table exists. Run `supabase/migrations/finance_line_items.sql` once in the Supabase SQL editor. After that, all edits persist.



### "Stripe payments stopped working for some therapists"
1. Check Stripe dashboard for any platform-level alerts
2. Check Vercel deploy log for recent edge function changes
3. Check `supabase/functions/_shared/providers/stripe.ts` for any recent diff
4. Verify `STRIPE_SECRET_KEY` env var is current (not `STRIPE_API_KEY` — naming matters)
5. Check therapist's `stripe_account_connected` field in Supabase therapists table
6. If still stuck, paste the error message into a fresh Claude session with full context

### "Square payments stopped working for some therapists"
1. First check: did the therapist complete `squareup.com/activate`? Most "Square broken" issues are activation-related.
2. Check `SQUARE_APP_ID` env var (NOT `SQUARE_APPLICATION_ID`)
3. Check therapist's `square_connected` and `square_access_token` fields
4. Check Square dashboard for the OAuth scope list — must include all 11 scopes (most recently added Apr 18, 2026)
5. Check `supabase/functions/_shared/providers/square/v1.ts` for recent diffs

### "Vercel build is failing"
1. Most common: someone wrote `React.useState(...)` instead of `useState(...)`. Vercel CRA build silently strips this. Search the diff for `React.use` and replace.
2. Second most common: a JSX file imports something that doesn't exist. Check the import paths.
3. Third: Vercel runs CRA with `CI=true` by default which converts warnings into errors. `vercel.json` overrides to `CI=false`. Don't remove that override.

### "Edge function deploy is failing"
1. Check `.github/workflows/deploy-edge-functions.yml` for recent changes
2. Check the GitHub Actions tab at github.com/bodymapapp/bodymap/actions
3. Check the Supabase project ref is `rmnqfrljoknmellbnpiy`
4. Most failure cause: Deno import path that's not allowed. Use only `https://deno.land/...`, `https://esm.sh/...`, or relative paths.

### "A therapist says their custom URL is broken"
1. Check `therapist.custom_url` field in Supabase
2. Check `src/pages/BookingPage.js` for the URL parsing
3. Common cause: therapist changed their custom_url; old bookmarks 404. Tell therapist to update their links.

### "Email broadcasts aren't sending"
1. Check Resend dashboard for the send status
2. Check the `RESEND_API_KEY` env var
3. Check sender domain `mybodymap.app` is verified in Resend
4. Check Cloudflare DNS records for SPF/DKIM/DMARC

### "An AI feature stopped working"
1. Check Anthropic dashboard for API quota
2. Check `ANTHROPIC_API_KEY` env var
3. Check the model name in the edge function — Anthropic deprecates older models; if we're calling a deprecated one, swap to current
4. As of May 2026, current model is Claude Opus 4.7 (`claude-opus-4-7`)

### "A feature looks broken on the booking page but works in the therapist dashboard"
**This is almost always an RLS gap.** The booking page uses the anon Supabase role; the dashboard uses an authenticated role. Tables without an explicit public-read RLS policy return empty silently when queried by anon (because `auth.uid()` is null), which the JS client treats as "no rows" rather than an error.
1. Identify the table the booking page is querying (look in `src/pages/BookingPage.js` for the failing feature's data fetch)
2. Check current RLS policies: `SELECT polname, polcmd, polqual FROM pg_policy WHERE polrelid = '<table_name>'::regclass;`
3. If there's no policy with `polcmd = 'SELECT'` and `polqual = 'true'` (or similar permissive condition), add one
4. Migration template: `CREATE POLICY "<table>_public_read" ON <table> FOR SELECT USING (true);`
5. Apply via Supabase SQL Editor (HK does this manually) or push as a new migration file (auto-deploys via GitHub Actions)
6. Reference incident: Candice's blocked-day bug, May 21 2026, commit `613de194`

### "A therapist did an import and now their account has hundreds of fake records"
1. **Do not panic.** This is recoverable via SQL. Reference incident: Jackie Bodkin, May 21 2026 (1,988 fake records cleaned up successfully).
2. Identify the cutoff timestamp: when was the bad import? Look in `created_at` columns.
3. Run preview queries to count what would be deleted:
   ```sql
   SELECT COUNT(*) FROM clients WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   SELECT COUNT(*) FROM services WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   SELECT COUNT(*) FROM memberships WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   SELECT COUNT(*) FROM member_subscriptions WHERE therapist_id = '<uuid>' AND started_at >= '<cutoff>';
   SELECT COUNT(*) FROM bookings WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   ```
4. Share counts with the therapist for confirmation before deleting.
5. Run cleanup as a single transaction (BEGIN/COMMIT in one click in Supabase SQL Editor, since the editor session is stateless between clicks):
   ```sql
   BEGIN;
   DELETE FROM member_subscriptions WHERE therapist_id = '<uuid>' AND started_at >= '<cutoff>';
   DELETE FROM bookings WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   DELETE FROM sessions WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   DELETE FROM clients WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   DELETE FROM services WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   DELETE FROM memberships WHERE therapist_id = '<uuid>' AND created_at >= '<cutoff>';
   COMMIT;
   ```
6. Verify all counts return to zero. If non-zero, the COMMIT didn't land (session timeout); re-run the whole block.
7. The import flow has pre-flight checks as of May 21 2026, so this shouldn't recur, but the recovery procedure is documented in case it does.

### "Therapist says they can't change a numeric setting on their phone"
**Diagnosis:** the input is probably a raw `<input type="number">` with `step` and `parseInt fallback`. Mobile browsers fight this pattern (step constraints + empty-field revert to default).
1. Find the input in the React code (`grep -rn "type=\"number\"" src/`)
2. Replace with `InlineSaveNumberInput` from `src/components/InlineSaveNumberInput.jsx`
3. Pass `min`, `max`, `suffix` ('min' for minutes, '$' for dollars, etc.)
4. The component handles clamp-on-commit so the user can clear and retype without fighting auto-revert
5. Reference incident: Jackie Bodkin buffer setting, May 21 2026, commit `93eddda6`

### "GitHub Actions sends daily 'Run failed: Deploy Supabase Edge Functions' emails"
**Diagnosis:** `supabase/setup-cli@v1` with `version: latest` is rate-limited by GitHub's release API on shared runners.
1. Open `.github/workflows/deploy-edge-functions.yml`
2. Change `version: latest` to a pinned version (`version: 2.100.1` or whatever is current stable)
3. Push the change
4. The next workflow run should succeed and the daily emails should stop
5. Reference fix: commit `933144f7`, May 21 2026

### "I (HK) need to take a 2-week break"
- **Email to all founding therapists:** "Joy / MyBodyMap Team is on a brief break. We will respond to all inquiries by [date]. The platform itself continues to run normally."
- **Set up an out-of-office on `hello@mybodymap.app`**
- **Pre-build any critical fixes you anticipate** before the break, deploy them
- **Make sure Square activation is complete** (so therapists onboarding don't get blocked)
- **Update the runbook** with anything you learned during the break that's not yet captured here

### "I just force-pushed and lost a commit that was on origin/main"

Symptom: a commit that was on `origin/main` from a parallel session, or from a teammate, is missing after a `git push --force-with-lease`. This is the near-miss from May 22 2026 where `3fa11eac` (CTIA-compliant SMS commit) almost got dropped during a B resumable-imports push.

Recovery in 3 steps:

1. **Find the dropped commit's SHA.** It's still in your local `reflog` for ~30 days. Run:
   ```bash
   git reflog --oneline -30 | head -50
   ```
   Look for the dropped commit by message. Copy its SHA.

2. **Get it back onto your branch.** Cherry-pick:
   ```bash
   git cherry-pick <sha>
   ```
   Or, if the dropped commit is parent of the work you want to keep, reset:
   ```bash
   git reset --hard <sha>
   ```
   Verify locally with `git log --oneline -5` that both your work and the recovered commit are present.

3. **Push explicitly with SHA syntax** (not just `git push`):
   ```bash
   git push origin <local-head-sha>:refs/heads/main --force-with-lease
   ```
   This makes the push intent unambiguous and overrides any stale tracking-branch state.

4. **Verify the recovery:**
   ```bash
   git fetch origin main
   git log origin/main --oneline -5
   ```
   Confirm both commits are now on the remote.

**Prevention going forward** (Design Principle #19):
Before any force push, fetch + compare both directions:
```bash
git fetch origin main
git log origin/main..HEAD  # commits you have that origin doesn't
git log HEAD..origin/main  # commits origin has that you don't
```
If the second list is non-empty, STOP and pull/merge first. Force-pushing with unmerged remote commits silently drops them.

### "I (HK) need to step away permanently or for several months"
This is the worst-case scenario this document is written for. See the next section.

---

## 16. Onboarding a human team

If HK needs to fully offload work, here is how to do it.

### Roles needed (in priority order)
1. **Senior fullstack engineer** (1.0 FTE). React/TypeScript on the frontend, Deno + Supabase Edge Functions on the backend, comfortable with Stripe and Square. ~$140-180k or $80-120/hr contract. Read this runbook + the codebase + FEATURES_TAXONOMY.md to ramp in 1-2 weeks.
2. **Product manager / designer hybrid** (0.5 FTE). Owns the marketing surface, voice, customer success. ~$100-140k or $60-90/hr. Read this runbook + the marketing docs + speaks with HK weekly to absorb the persona.
3. **Customer success / community manager** (0.25 FTE to start, 1.0 if scaling). Responds to therapist DMs and emails. Speaks in Joy persona, never breaks character. ~$50-70k or $30-50/hr.

### Where to hire
- **Engineer:** YC-network, ex-startup engineers on Twitter/X, Anthropic developer Discord. Avoid general job boards (too noisy).
- **PM/designer:** wellness-tech veterans (ex-Mindbody, ex-Vagaro, ex-Calm). They get the demographic.
- **CS:** former massage therapists who are tech-savvy. They are uniquely credible.

### What to hand each role on day one
1. This runbook
2. Read access to the GitHub repo
3. Supabase project read access (full access only after 30 days)
4. Stripe + Square dashboard read access
5. Vercel project read access
6. Resend dashboard read access
7. Email forwarding rule for `*@mybodymap.app` to include them
8. A 90-minute kickoff call with HK walking through the seven-category taxonomy live in the product

### What NOT to give a new hire on day one
1. Production credentials with write access (wait 30 days minimum)
2. Stripe Connect platform access (HK only, indefinitely)
3. Bank account access (HK only, indefinitely)
4. Authority to ship to production without HK review (wait 60 days minimum)
5. Authority to email all founding therapists (wait 90 days minimum, until they have demonstrated voice mastery)

### Decisions a new hire CAN make without HK
- Bug fixes
- Copy edits within the established voice guide
- Design polish within the established design language
- Adding sub-features within an existing ribbon (after taxonomy review)
- Routine deploys

### Decisions a new hire CANNOT make without HK
- Adding a new ribbon to the seven-category taxonomy
- Adding a new payment processor
- Changing pricing
- Sending broadcast emails to all founding therapists
- Making public statements (social media, press, blog)
- Hiring additional team members
- Signing contracts with vendors

### Cultural rules to communicate explicitly
- "Yes-people make worse software." Push back is welcomed, expected, evaluated favorably.
- "Deeper, not wider." Solve one therapist's problem all the way through, not five halfway.
- "The 70-year-old persona is the user." When in doubt about a UI decision, imagine a 70-year-old female LMT using it on her iPhone in her studio between sessions. If she'd be confused, simplify.
- "MyBodyMap is not Joy." Joy is the voice, not the founder. Internally, refer to HK as the founder. Externally, sign emails as Joy.

### What to expect in the first 30 days
- The new hire will want to redesign things. Resist this. The existing design is intentional and tested.
- The new hire will want to add features. Resist this. The taxonomy is locked and FEATURES_TAXONOMY.md exists for a reason.
- The new hire will want to migrate the stack (CRA → Next.js, inline styles → Tailwind, etc.). Resist this. The stack works. Migration is engineering work that doesn't ship customer value.
- Things the new hire SHOULD do in the first 30 days: read this runbook front to back, read FEATURES_TAXONOMY.md, read the BLOCK_PLAN, read the email voice guide, and ship one bug fix to demonstrate they can deploy without breaking anything.

---

## 17. Process flows

Therapist-facing diagrams of how a booking moves through MyBodyMap depending on which combination of settings is active. Read these top-to-bottom. Each one is a self-contained snapshot, safe to screenshot and send to a therapist asking how the platform handles their config.

The three combinations:

| Approve new clients | Require deposit | Diagram |
|---|---|---|
| ON | OFF | Flow A, request and approve |
| OFF | ON | Flow B, book and pay |
| ON | ON | Flow C, request, approve, auto-charge (Phase 25b) |

Beyond the booking-config flows above, this section also documents money and notification flows: Flow D (pay link, send to paid) and the notification events table. Add a new flow here whenever we ship one, so the catalog stays current.

### Flow A. Approval ON, Deposit OFF

The client submits a request without any payment. The therapist reviews and approves or declines. On approve, the booking is confirmed and the client gets a confirmation email with an intake link. No card is captured at any point.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 760" style="max-width:100%;height:auto;background:#F5F0E8;border-radius:14px;font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <marker id="arrowA" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#2A5741"/>
    </marker>
  </defs>
  <text x="300" y="38" text-anchor="middle" font-size="20" font-weight="700" fill="#1F2937" font-family="Georgia,serif">Flow A. Approval on, deposit off</text>
  <text x="300" y="62" text-anchor="middle" font-size="13" fill="#6B7280">Request and approve. No payment at any step.</text>

  <g transform="translate(60,90)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">1</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client picks time and service</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Browses your booking page, picks date and service.</text>
  </g>
  <line x1="300" y1="180" x2="300" y2="210" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowA)"/>

  <g transform="translate(60,220)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">2</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client submits request</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Status: pending approval. No card, no charge.</text>
  </g>
  <line x1="300" y1="310" x2="300" y2="340" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowA)"/>

  <g transform="translate(60,350)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#B87840"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">3</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">You review and approve or decline</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Pending Requests panel at the top of Schedule.</text>
  </g>
  <line x1="300" y1="440" x2="300" y2="470" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowA)"/>

  <g transform="translate(60,480)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">4</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Status flips to confirmed</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Booking is locked in on your calendar.</text>
  </g>
  <line x1="300" y1="570" x2="300" y2="600" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowA)"/>

  <g transform="translate(60,610)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">5</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client gets approval email with intake link</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">They fill the intake before the session.</text>
  </g>

  <text x="300" y="725" text-anchor="middle" font-size="11" fill="#9CA3AF">No money moves at any step in this flow.</text>
</svg>

### Flow B. Approval OFF, Deposit ON

The client books directly. At the deposit step they enter a card and the deposit (a percent you set in Settings) is charged on the spot. The booking is confirmed immediately. Returning clients are not charged a deposit, only first-time clients.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 760" style="max-width:100%;height:auto;background:#F5F0E8;border-radius:14px;font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <marker id="arrowB" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#2A5741"/>
    </marker>
  </defs>
  <text x="300" y="38" text-anchor="middle" font-size="20" font-weight="700" fill="#1F2937" font-family="Georgia,serif">Flow B. Approval off, deposit on</text>
  <text x="300" y="62" text-anchor="middle" font-size="13" fill="#6B7280">Book and pay. Deposit charged at booking time.</text>

  <g transform="translate(60,90)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">1</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client picks time and service</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Browses your booking page, picks date and service.</text>
  </g>
  <line x1="300" y1="180" x2="300" y2="210" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowB)"/>

  <g transform="translate(60,220)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#B87840"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">2</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client enters card and pays deposit</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Stripe charges the percent you set in Settings.</text>
  </g>
  <line x1="300" y1="310" x2="300" y2="340" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowB)"/>

  <g transform="translate(60,350)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">3</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Status flips to confirmed immediately</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Card is saved for future bookings.</text>
  </g>
  <line x1="300" y1="440" x2="300" y2="470" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowB)"/>

  <g transform="translate(60,480)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">4</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client gets receipt and confirmation</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">You get a new-booking notification.</text>
  </g>
  <line x1="300" y1="570" x2="300" y2="600" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowB)"/>

  <g transform="translate(60,610)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">5</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client fills intake before the session</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Intake link is in the confirmation email.</text>
  </g>

  <text x="300" y="725" text-anchor="middle" font-size="11" fill="#9CA3AF">Deposit is only charged to first-time clients. Returning clients are never re-charged.</text>
</svg>

### Flow C. Approval ON, Deposit ON (Phase 25b)

Both settings on. The client saves a card when they submit their request, but the deposit is not charged yet. If you approve, the deposit is charged automatically from the saved card and the booking is confirmed. If you decline, no charge is made.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1080" style="max-width:100%;height:auto;background:#F5F0E8;border-radius:14px;font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <marker id="arrowC" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#2A5741"/>
    </marker>
    <marker id="arrowCred" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF"/>
    </marker>
  </defs>
  <text x="300" y="38" text-anchor="middle" font-size="20" font-weight="700" fill="#1F2937" font-family="Georgia,serif">Flow C. Approval on, deposit on</text>
  <text x="300" y="62" text-anchor="middle" font-size="13" fill="#6B7280">Request, approve, auto-charge. Card pre-saved, deposit on approval.</text>

  <g transform="translate(60,90)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">1</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client picks time and service</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Browses your booking page, picks date and service.</text>
  </g>
  <line x1="300" y1="180" x2="300" y2="210" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowC)"/>

  <g transform="translate(60,220)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#B87840"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">2</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client saves card to submit request</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Card is saved via Stripe. No charge yet.</text>
  </g>
  <line x1="300" y1="310" x2="300" y2="340" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowC)"/>

  <g transform="translate(60,350)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">3</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Status: pending approval</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">You get an email. Request sits at top of Schedule.</text>
  </g>
  <line x1="300" y1="440" x2="300" y2="470" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowC)"/>

  <g transform="translate(60,480)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#FDE68A" stroke-width="2"/>
    <circle cx="32" cy="40" r="18" fill="#B87840"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">4</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">You decide: approve or decline</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">One tap from the Pending Requests panel.</text>
  </g>

  <line x1="180" y1="570" x2="180" y2="610" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowC)"/>
  <line x1="420" y1="570" x2="420" y2="610" stroke="#9CA3AF" stroke-width="2" marker-end="url(#arrowCred)"/>
  <text x="180" y="600" text-anchor="middle" font-size="11" font-weight="700" fill="#2A5741">APPROVE</text>
  <text x="420" y="600" text-anchor="middle" font-size="11" font-weight="700" fill="#6B7280">DECLINE</text>

  <g transform="translate(20,620)">
    <rect width="280" height="80" rx="14" fill="#F0F7F4" stroke="#2A5741" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">5a</text>
    <text x="70" y="34" font-size="14" font-weight="700" fill="#1F2937">Deposit auto-charges</text>
    <text x="70" y="53" font-size="11" fill="#374151">From saved card.</text>
    <text x="70" y="67" font-size="11" fill="#374151">Status: confirmed.</text>
  </g>

  <g transform="translate(300,620)">
    <rect width="280" height="80" rx="14" fill="#F9FAFB" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="4 3"/>
    <circle cx="32" cy="40" r="18" fill="#9CA3AF"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">5b</text>
    <text x="70" y="34" font-size="14" font-weight="700" fill="#1F2937">No charge made</text>
    <text x="70" y="53" font-size="11" fill="#374151">Card not used.</text>
    <text x="70" y="67" font-size="11" fill="#374151">Status: cancelled.</text>
  </g>

  <line x1="160" y1="710" x2="160" y2="745" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowC)"/>
  <line x1="440" y1="710" x2="440" y2="745" stroke="#9CA3AF" stroke-width="2" marker-end="url(#arrowCred)"/>

  <g transform="translate(20,755)">
    <rect width="280" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">6a</text>
    <text x="70" y="34" font-size="14" font-weight="700" fill="#1F2937">Client gets receipt</text>
    <text x="70" y="53" font-size="11" fill="#374151">Approved and deposit charged.</text>
    <text x="70" y="67" font-size="11" fill="#374151">Intake link included.</text>
  </g>

  <g transform="translate(300,755)">
    <rect width="280" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#9CA3AF"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">6b</text>
    <text x="70" y="34" font-size="14" font-weight="700" fill="#1F2937">Client gets polite decline</text>
    <text x="70" y="53" font-size="11" fill="#374151">Your reason included if you wrote one.</text>
    <text x="70" y="67" font-size="11" fill="#374151">No payment was taken.</text>
  </g>

  <g transform="translate(60,870)">
    <rect width="480" height="80" rx="14" fill="#FFFBEB" stroke="#FDE68A" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#B87840"/>
    <text x="32" y="46" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">!</text>
    <text x="70" y="34" font-size="14" font-weight="700" fill="#1F2937">If the auto-charge fails</text>
    <text x="70" y="53" font-size="12" fill="#374151">Status goes to pending-deposit, not confirmed.</text>
    <text x="70" y="68" font-size="12" fill="#374151">Client gets a recovery email. You get an alert email.</text>
  </g>

  <text x="300" y="990" text-anchor="middle" font-size="11" fill="#9CA3AF">Card is captured up front so the deposit can be charged without the client needing to come back.</text>
  <text x="300" y="1010" text-anchor="middle" font-size="11" fill="#9CA3AF">If you decline, the saved card is never charged.</text>
</svg>

### Flow D. Pay link lifecycle (send to paid)

How money moves when the therapist sends a pay link for a session, a package, or a membership. Same path for all three; the only difference is what the link is for. Added Jun 10, 2026 alongside the pay-link send-time notification.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 880" style="max-width:100%;height:auto;background:#F5F0E8;border-radius:14px;font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <marker id="arrowD" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#2A5741"/>
    </marker>
  </defs>
  <text x="300" y="38" text-anchor="middle" font-size="20" font-weight="700" fill="#1F2937" font-family="Georgia,serif">Flow D. Pay link, send to paid</text>
  <text x="300" y="62" text-anchor="middle" font-size="13" fill="#6B7280">Session, package, or membership. Same path for all three.</text>

  <g transform="translate(60,90)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">1</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">You send a pay link</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">A payment row is created. It starts as pending.</text>
  </g>
  <line x1="300" y1="180" x2="300" y2="210" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowD)"/>

  <g transform="translate(60,220)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#E6CDB0" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#B87840"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">2</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">You get a record instantly</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Bell plus email: link sent to client, awaiting payment.</text>
  </g>
  <line x1="300" y1="310" x2="300" y2="340" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowD)"/>

  <g transform="translate(60,350)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">3</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client opens the link and pays</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Card on the Stripe or Square hosted page.</text>
  </g>
  <line x1="300" y1="440" x2="300" y2="470" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowD)"/>

  <g transform="translate(60,480)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#E6CDB0" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#B87840"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">4</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Payment is confirmed to us</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Stripe or Square webhook, or client returns to thank-you page.</text>
  </g>
  <line x1="300" y1="570" x2="300" y2="600" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowD)"/>

  <g transform="translate(60,610)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">5</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">You get a paid notification</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Bell, email, and SMS per settings. Names the package or membership.</text>
  </g>
  <line x1="300" y1="700" x2="300" y2="730" stroke="#2A5741" stroke-width="2" marker-end="url(#arrowD)"/>

  <g transform="translate(60,740)">
    <rect width="480" height="80" rx="14" fill="#fff" stroke="#BFD8C9" stroke-width="1.5"/>
    <circle cx="32" cy="40" r="18" fill="#2A5741"/>
    <text x="32" y="46" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">6</text>
    <text x="70" y="34" font-size="15" font-weight="700" fill="#1F2937">Client gets a receipt by email</text>
    <text x="70" y="55" font-size="13" fill="#6B7280">Itemized payment receipt to their inbox.</text>
  </g>

  <text x="300" y="855" text-anchor="middle" font-size="11" fill="#9CA3AF">Steps 5 and 6 depend on step 4. No webhook and no return to the thank-you page means the payment stays pending.</text>
</svg>

**Known dependency (the thing that bites).** Step 4 is the hinge. Stripe pay links use a hosted confirmation and do not return the payer to our site, so completed Stripe payments reach us only through the Stripe webhook (checkout.session.completed, which for connected accounts requires the platform webhook to listen to Connect events). Square reaches us through its payment.updated webhook or through the client landing back on the thank-you page. If none of those fire, the payment row stays pending forever, the package shows active but unpaid, and steps 5 and 6 never happen. When debugging "no payment notification," check the payment row status first: pending means step 4 never completed, which is a webhook or return-url problem, not a notification problem.

### Notification events: who is told, how, and what is confirmed

**Design principle (added Jun 10, 2026).** Every time we add or change a notification on either the therapist or the client side, update this table in the same change. Track three things separately: the target (which channels it should hit), the build status (planned or shipped), and whether HK has confirmed actually receiving it in a live test. Aspiration and reality are tracked apart on purpose. A shipped notification is not "done" until HK confirms receipt, because shipped-but-silent is the exact failure we keep hitting.

Defaults: in-app bell and email are ON by default; SMS and push are OFF by default and send only when the therapist explicitly turns them on (SMS is gated on A2P 10DLC). Each therapist can override per event in Settings.

| Event | Audience | Target channels | Build status | HK confirmed receiving |
|---|---|---|---|---|
| Pay link sent | Therapist | Bell + Email | Shipped Jun 10 | Not yet, re-test pending |
| Pay link delivery | Client | Email | Shipped; content upgraded to standard template Jun 10 | Yes, Jun 9 (screenshot); new content re-test pending |
| Payment received | Therapist | Bell + Email + SMS\* | Shipped; was silently blocked by a gateway 401, fixed Jun 10 | No on the blocked test; re-test pending after fix |
| Payment received (receipt) | Client | Email + SMS\* | Shipped; same 401 block, fixed Jun 10 | Not yet |
| New booking | Therapist | Bell + Email | Shipped | Yes, Jun 10 (send logged) |
| Booking confirmation | Client | Email | Shipped | Yes, Jun 10 (send logged) |
| Intake filled | Therapist | Bell + Email | Shipped | Yes, Jun 8 (bell seen) |

\* SMS only if the therapist has turned SMS on for that event. Off by default.

Two gotchas worth remembering when verifying receipt:
1. The therapist "payment received" email goes to the therapist account email (the demo is bodymapdemo@gmail.com), not the client inbox (bodymap01@gmail.com) where pay-link delivery and receipts land. Check the right inbox.
2. "Payment received" and the client receipt both ride on notify-payment-event. Until Jun 10 that function was not in the deploy no-JWT allowlist, so the pay-link webhooks called it and got a 401: the payment was marked paid but no one was told. Fixed by adding it to NO_JWT_FUNCTIONS. If payment notifications go quiet again, check that allowlist first.

The "Pay link sent" event (Jun 10) is a therapist record, not a customer message, so the client is never notified at send time; the client hears from us only via the link delivery and, after paying, the receipt.

### When to send each diagram

A therapist asking "what happens when a client books with my current settings?" should receive whichever flow matches their config. Settings page already shows the active combination. If a therapist asks how to change behavior, walk them to the toggles in Booking page settings.

If you (or future Claude) ship a new combination (for example, deposit ON for repeat clients), add a new flow here before merging the code. Therapists asking about the feature should be able to read its flow before they enable it.

---


| Path | What it is |
|------|------------|
| `BLOCK_PLAN.md` | Active fires, deferred work, ideas. Updated end of every session. Renders at `/founder` section 4. |
| `FEATURES_TAXONOMY.md` | Taxonomy rules. Read before any feature add. Renders at `/founder` section 5. |
| `ENVIRONMENT.md` | Canonical secrets list. Read before asking HK for any credential. NOT in /founder (secrets never go in checked-in docs). |
| `docs/FOUNDER_RUNBOOK.md` | This document. Operational insurance. Renders at `/founder` section 11. |
| `docs/DESIGN_PRINCIPLES.md` | Operational rules with incident logs (13 rules as of May 21 2026). Renders at `/founder` section 3.3. |
| `docs/BILLING_STRATEGY.md` | Payment processor strategy + competitive matrix. Renders at `/founder` section 3. |
| `docs/MARKETING_THERAPIST_PLAYBOOK.md` | Seven marketing strategies for therapists. Renders at `/founder` section 1. |
| `docs/MARKETING_MYBODYMAP.md` | How we market ourselves. Renders at `/founder` section 2. |
| `docs/NOTIFICATION_MAP.md` | Single source of truth for every notification we send. Renders at `/founder` section 3.2. |
| `docs/OTHER_NOTES.md` | Catch-all. Renders at `/founder` section 10. |
| `src/data/featuresData.js` | The seven ribbons + cards. The taxonomy in code. |
| `src/pages/Home.jsx` | Marketing home page |
| `src/pages/FeaturesV2.jsx` | Marketing features page |
| `src/pages/Dashboard.js` | Therapist's logged-in dashboard. The biggest single file in the codebase. |
| `src/pages/BookingPage.js` | Client-facing booking flow. |
| `src/components/ScheduleDashboard.js` | Therapist's schedule view. Timeline, weekly, monthly. |
| `src/components/ImportClients.js` | Both client and appointment imports. Maria-persona safety hardened May 21 2026. |
| `src/components/InlineSaveNumberInput.jsx` | Standard numeric input. Use everywhere a therapist edits a number, never raw `type="number"`. |
| `src/pages/FounderHub.jsx` | `/founder` page wiring. Renders all docs above as markdown sections. |
| `supabase/functions/_shared/payment-provider.ts` | The payment abstraction. The most architecturally important file. |
| `supabase/migrations/` | All RLS policies and schema changes. Auto-deploy via GitHub Actions on push. |
| `research/` | Competitive analyses and market research. |

## Appendix B: Glossary of terms HK uses

- **"Founding therapist":** First 100 therapists, on Silver tier free for life, no credit card.
- **"The seven categories" / "the taxonomy":** The seven product ribbons. Source of truth for everything.
- **"Cream frame":** The pale cream-colored container that wraps every demo on the Home page. A design principle, not a tunable parameter.
- **"Money & Protection" / "ribbon 6":** Same thing. The billing + legal + security category.
- **"BodyMap" / "MyBodyMap":** "MyBodyMap" in user-facing text. "BodyMap" only acceptable in legal entity names (BodyMap LLC). Public voice is always "MyBodyMap" or "we" or "the team," never a fictional individual person.
- **"The persona":** A 70-year-old female LMT, 25 years in practice, primary user we design for.
- **"Triple-checked":** HK's standard before any new feature is promoted into marketing materials. Means: tested in dev, tested with at least one founding therapist, observed in production for 7+ days.

---

---

## Stripe Connect operations and recovery (added May 16 2026)

This section is your runbook when Stripe behaves unexpectedly. Read in order; most issues are resolved within the first two procedures.

### Quick diagnostic: where is the truth?

Two sources of truth:

1. **Stripe Dashboard** (`dashboard.stripe.com`) is what Stripe believes. Critical: check the **mode toggle** in top-left. Test mode and live mode show different data, different accounts, different transactions. **A common false-alarm:** "I do not see my transactions" almost always means you are in test mode looking at live transactions, or vice versa.

2. **MyBodyMap database** is what we believe. Check it at /founder Stripe Debug. Shows the therapist's stripe_account_id, connected flag, type, and the live Stripe API verification.

When the two disagree, /founder Stripe Debug has tools to reconcile. Never edit Stripe Dashboard manually except for redirect URIs.

### Procedure 1: A therapist reports payments not working

Symptoms: client at booking sees "payment processor not configured" or similar; deposits do not capture; refund button fails.

Step 1: Confirm therapist row state. Either:
- Open Supabase SQL Editor, run: `SELECT email, stripe_account_id, stripe_account_connected, stripe_account_type, stripe_account_ready_at FROM therapists WHERE email = '<their_email>';`
- Or: open /founder Stripe Debug while temporarily impersonating their therapist row (NOT YET BUILT - see "Impersonation" below)

Step 2: Three possible states:
  (a) `stripe_account_connected = true, stripe_account_id` set: should be working. Real issue is downstream. Check edge function logs in Supabase. Most likely: their Stripe account is now disabled or restricted (Stripe revoked it for compliance). Email them.
  (b) `stripe_account_connected = false, stripe_account_id` set: incomplete onboarding. Send them this message: "Go to Settings, Payments. You will see a 'Stripe setup not finished' panel with a Resume Stripe setup button. Tap it and complete the remaining fields Stripe asks for."
  (c) `stripe_account_id IS NULL`: never connected. Send them this: "Go to Settings, Payments, and tap Connect Stripe."

Step 3: If state (b) and they swear they completed setup, the architectural fix from May 15 2026 means tapping Connect Stripe again will auto-find their account. Have them try.

Step 4: If still stuck, use /founder Stripe Debug. Load list of platform accounts. Find a matching Enabled account by email. Tap Attach. This bypasses everything and stamps their row manually.

### Procedure 2: HK's own Stripe broke after disconnect/reconnect

This happened May 15-16 2026 and is the reason for procedure 1 step 4 existing.

Symptoms: you tapped Disconnect, tried to reconnect, ended up with a new empty Express account while your real verified account sits orphaned.

Recovery (do this in order):
  Step 1: /founder Stripe Debug
  Step 2: Tap Load list under Platform accounts
  Step 3: Find your verified Enabled Daya Gupta account. Should be `acct_1TNMhqBx320pMuYl` from 4/18 or `acct_1TXWhfQvokGFD9FY` from 5/16 (verified after manual attach)
  Step 4: Tap Attach
  Step 5: Reload your dashboard, verify green Connected panel

### Procedure 3: The orphan 30 Express accounts

You will see ~30 Restricted Express accounts in your Stripe Connect dashboard from before the May 15 2026 architectural fix. These are inert. They are not attached to any therapist row, cannot accidentally receive charges, and do not affect functionality.

If you want to clean them up: log into Stripe Connect dashboard, click each Restricted account, tap "Reject" (Stripe will refuse to let you delete the Daya Gupta or Candice ones because they have transactions or are Enabled). Manual, account-by-account. Optional, not urgent.

### Procedure 4: "Manage in Stripe" takes me to sandbox

The Settings page connected panel has a "Manage in Stripe →" link that opens `dashboard.stripe.com`. Stripe always lands you in whichever mode (test or live) you were LAST signed into. If you tested OAuth in test mode at any point, your next visit defaults to test mode.

Fix: in Stripe Dashboard top-left, flip the test/live toggle to live mode. Your real transactions are in live mode. The link does not control this; Stripe's own session does.

### Procedure 5: A therapist did real transactions but does not see them

Same root cause as procedure 4. They are in test mode in Stripe Dashboard.

Walk them through: "Look at the top-left of your Stripe dashboard. There should be a toggle that says 'Test mode'. If the toggle is on (showing yellow or amber), tap it to turn it off. You will then see your real transactions in live mode."

### Procedure 6: Standard OAuth shows wrong / missing accounts

Symptoms: therapist taps Link your Stripe account, lands in Stripe OAuth picker, does not see their expected account.

Three causes:
  (a) Stripe is in test mode. The OAuth picker only shows accounts that match the current mode. Have them flip to live mode in Stripe Dashboard first.
  (b) Their existing Stripe account is an Express account created by another platform (MassageBook, Vagaro, Squarespace, etc). Express accounts are owned by the platform that created them and are not listable in a different platform's Standard OAuth picker. Solution: have them set up a new MyBodyMap-owned Stripe account via the Express fallback button (visible below the Standard button in Settings).
  (c) STRIPE_CLIENT_ID in Supabase is a test Client ID but PAYMENT_MODE is live (or vice versa). Mismatch. Check the env vars match the mode you want.

### Procedure 7: Force-set a therapist as connected (manual override)

When you know a therapist's Stripe is genuinely working but the DB flag is wrong (rare but possible after a Stripe API hiccup):

SQL:
```sql
UPDATE therapists
SET stripe_account_connected = true,
    stripe_account_ready_at = NOW()
WHERE id = '<therapist_uuid>';
```

Or via /founder Stripe Debug: load the diagnostic, if Stripe says all three booleans are TRUE but DB says false, the "Force-set connected" button appears. Tap it.

### Procedure 8: Wipe a stuck connection and start over

When everything is broken and you just want to reset:

/founder Stripe Debug -> "Wipe Stripe Account ID" button. This clears stripe_account_id and stripe_account_connected. The Stripe-side account itself stays on Stripe's books, just disconnected from MyBodyMap.

Then go to Settings, Payments. The fresh two-path UI shows. Connect again from a clean state.

### Procedure 9: Two Stripe accounts with the same email (Google OAuth vs password)

Discovered May 16 2026 morning. Stripe's authentication system treats "Continue with Google using email X" and "email X plus password" as TWO DIFFERENT humans. They never link. You can end up with two parallel Stripe accounts using the same email, where:

- One is the verified production platform (where Connect accounts and real transactions live)
- The other is a test / abandoned identity that came from a Google OAuth signup attempt

Symptoms this is happening:
- Stripe Dashboard shows different data depending on whether you came in via Google OAuth or password
- You 'cannot see your Connect accounts' but they exist
- You 'cannot see your transactions' but real money is flowing
- The Manage in Stripe link from MyBodyMap lands you in sandbox even though customer payments are working
- Standard Connect OAuth picker shows the wrong accounts because Stripe used your current browser session's Stripe identity, which might be the wrong one

To diagnose:
1. Open an incognito window
2. Go to `dashboard.stripe.com/login`
3. Try logging in with email + password (NOT Google)
4. Check Connect, Accounts. Do you see the 31 platform accounts? If YES, this is the real platform.
5. Sign out, try Google OAuth from a fresh incognito window
6. Check Connect, Accounts. If you see NOTHING or just one test account, this is the abandoned identity.

To recover:
- Always use the password-based login going forward for platform operations
- The Google-OAuth identity can be ignored or left to die; it has no production data
- Verify the STRIPE_CLIENT_ID in Supabase is from the PASSWORD-based account, not the Google-OAuth one (they have different Client IDs)
- Bookmark `https://dashboard.stripe.com/connect/accounts/acct_xxx` URLs for direct access to specific connected accounts rather than relying on Stripe Dashboard's session memory

To prevent recurrence:
- Pick ONE auth method for Stripe and never use the other
- Recommended: email plus password with a saved password manager entry, since Google OAuth introduces this duplicate-identity risk

### Procedure 10: Booking shows "Client record missing on this charge"

Discovered May 24 2026 evening. Real customer Terra hit this 11 times across her 3 business accounts. The CheckoutModal renders red error text "Client record missing on this charge" below the payment buttons when `bookings.client_id` is NULL for that row. Therapist cannot proceed with the charge until something links the booking to a client.

Symptoms this is happening:
- Therapist messages support: "I cannot charge for this booking"
- CheckoutModal shows red text under the Record-as-paid button
- Bookings list shows the appointment with a client name displayed (from `bookings.client_name` text column), but the underlying `client_id` foreign key is NULL
- Affected bookings often have empty `client_email` and a phone number in any format

Root cause:
`src/lib/findOrCreateClient.js` only looked up clients by email until Phase 13.9 (May 24 2026). When the caller (BookingModal, BookingPage, runImports, ImportClients) passed a row without email, the helper returned null and the booking was inserted with `client_id: null`. This silently broke checkout for any walk-in client, phone-only client, or imported row where the CSV did not carry email through.

Affected booking creation paths before the fix:
- `src/components/BookingModal.js` line 287 (therapist-created booking from schedule slide-over)
- `src/pages/BookingPage.js` line 1769 (public booking page)
- `src/lib/imports/runImports.js` line 791 (unified CSV import, partially guarded by `if (!p._clientId) continue;` at line 769 which skipped the booking entirely; safer but lossy)
- `src/components/ImportClients.js` line 1856 (legacy CSV import path; `.filter(p => p._clientId)` at line 1847 since May 10 also drops the booking entirely)

Phase 13.9 fix:
`findOrCreateClient` now has two paths. Path A (email-based) is unchanged in its core: look up by email, return matching id, or create new. Path B (new): when email is missing but phone is present, normalize both sides to last-10 digits, scope the lookup to `therapist_id`, return the matching client's id. If no match, create a new clients row with name + phone (no email). Only returns null when both email AND phone are missing (truly anonymous booking, rare). All four booking-creation paths automatically inherit the fix since they all call this helper.

Phase 13.10 fix (same-day refinement, May 24 2026):
Path A now also checks phone before creating a new client. Real scenario it solves: a client books once with name + phone only (Path B creates a stub with `email = NULL`), then books again later with email + phone provided. Without the check, Path A would create a second client row for the same human.

Phase 13.11 fix (same-day, May 24 2026):
Both Path A's stub enrichment and Path B's phone lookup now require **exact name match** in addition to phone match. This is critical for the household-phone case: husband and wife (or business partners sharing a line, or any two people in the same household) get separate client records, not a single merged one. Phone-only matching would silently link two humans into one client record, comingling their session notes, payments, intake forms, and history. That data corruption is much harder to unwind than the inverse problem of having one human in two records (which the therapist can fix with the consolidation UI).

Reconciliation rule, full statement:
- **Email matches existing client.** Return that id. No write.
- **Email is new, phone matches a phone-only stub with the SAME name.** Enrich the stub with the email, return its id.
- **Email is new, phone matches but name differs.** Treat as a different person. Create a new client.
- **Email is new, no phone match.** Create new client with email + name + phone.
- **No email, phone matches existing client with the SAME name.** Return matching id (same person, no email this time).
- **No email, phone matches but name differs.** Create a new client (household sharing a phone).
- **No email, no phone match.** Create new client with name + phone, no email.
- **No email and no phone.** Return null (truly anonymous booking, rare admin case).

Trade-off: if the same person enters their name differently across bookings (typo, short form, full name later), they get two client records. The therapist can merge via the consolidation UI (queued in BLOCK_PLAN). This is preferred to the alternative where two different humans get merged based on shared phone, which corrupts session history and is difficult to unwind cleanly.

Worked example: husband and wife sharing a phone

The household-phone case is the one most likely to trip up phone-based matching. Walk through what the helper does:

```
Booking 1: name="John Smith", phone="555-1234", no email
  Path B: no email match (skipped), phone lookup returns no rows.
  Action: CREATE client A {name:"John Smith", phone:"555-1234", email:NULL}
  Result: bookings.client_id = A

Booking 2: name="Jane Smith", phone="555-1234", no email
  Path B: phone lookup finds A, but A.name="John Smith" != "Jane Smith".
  Action: CREATE client B {name:"Jane Smith", phone:"555-1234", email:NULL}
  Result: bookings.client_id = B

Booking 3: name="John Smith", phone="555-1234", email="john@x.com"
  Path A: email lookup finds no match.
  Path A stub check: A.name="John Smith" matches AND A.phone matches AND A.email IS NULL.
  Action: UPDATE A SET email='john@x.com'. Return A.
  Result: bookings.client_id = A (existing, now enriched)

Booking 4: name="Jane Smith", phone="555-1234", email="jane@x.com"
  Path A: email lookup finds no match (A has john@x.com, B has email=NULL).
  Path A stub check: B.name="Jane Smith" matches AND B.phone matches AND B.email IS NULL.
  Action: UPDATE B SET email='jane@x.com'. Return B.
  Result: bookings.client_id = B (existing, now enriched)
```

Final state: client A (John, full info) and client B (Jane, full info). Each spouse has clean session history under their own record, even though they share a phone and have the same last name.

Same-day refinement: what happens when one spouse is already in the system with both email and phone, and the other spouse books without email? Same phone, different name. Path B phone lookup finds the first spouse but name does not match. Path B creates a new client for the second spouse. No commingling.



To diagnose the bug on a live therapist:

```sql
-- Count broken bookings per therapist
SELECT t.business_name, t.email, COUNT(*) AS broken_bookings
FROM bookings b
JOIN therapists t ON t.id = b.therapist_id
WHERE b.client_id IS NULL
  AND b.status != 'cancelled'
GROUP BY t.business_name, t.email
ORDER BY broken_bookings DESC;
```

To repair existing broken bookings (Terra-style backfill):

```sql
-- For one therapist, list each broken booking with three candidate matches
-- (email, phone last-10, name LOWER) so we can pick the right link.
SELECT b.id AS booking_id, b.client_name, b.client_phone, b.booking_date,
  (SELECT c.id FROM clients c
    WHERE c.therapist_id = b.therapist_id
      AND LOWER(c.email) = LOWER(b.client_email)
      AND b.client_email IS NOT NULL AND b.client_email <> ''
    LIMIT 1) AS match_by_email,
  (SELECT c.id FROM clients c
    WHERE c.therapist_id = b.therapist_id
      AND regexp_replace(COALESCE(c.phone,''), '\D', '', 'g')
        = regexp_replace(COALESCE(b.client_phone,''), '\D', '', 'g')
      AND b.client_phone IS NOT NULL AND b.client_phone <> ''
    LIMIT 1) AS match_by_phone,
  (SELECT c.id FROM clients c
    WHERE c.therapist_id = b.therapist_id
      AND LOWER(c.name) = LOWER(b.client_name)
    LIMIT 1) AS match_by_name
FROM bookings b
WHERE b.therapist_id = 'TARGET_THERAPIST_UUID'
  AND b.client_id IS NULL
  AND b.status != 'cancelled'
ORDER BY b.booking_date DESC;
```

Decision rule: when phone AND name both return the same client_id, link is safe. When only phone matches and name is different, verify with a preview SQL that joins the candidate client back so the operator can confirm "same person, fuller name in client record" (booking might have first name only, client record has both). Only when neither phone nor name matches: hold for therapist input. Never auto-create a client just to link a booking; ask the therapist whether to add the client themself first.

After applying the per-booking UPDATEs, audit_log captures every change for reversal if anything looks wrong.

Structural fix queued (Priority 0 item H in BLOCK_PLAN.md): add `NOT NULL` constraint on `bookings.client_id` once the existing NULL rows are backfilled across all therapists. After that constraint exists, any future code path that tries to insert NULL will fail loudly at the database boundary rather than silently producing a broken row that surfaces weeks later.

### Stripe Dashboard configuration (canonical state)

If you ever need to restore Stripe Dashboard settings to working state:

URL: `https://dashboard.stripe.com/settings/connect`

Required state:
- Mode: live (top-left toggle off)
- OAuth: enabled
- Redirect URIs configured:
  - `https://www.mybodymap.app/dashboard/stripe-connect`
  - `https://www.mybodymap.app/dashboard/stripe-connect-standard`
- Client ID: the live `ca_xxx` shown on this page. Copy it (or click reveal) and store in Supabase as `STRIPE_CLIENT_ID`.

If you also configured test mode:
- Flip Stripe Dashboard to test mode (toggle on)
- Same page, same OAuth + redirects (test versions of the URLs if any)
- Test Client ID also `ca_xxx` but DIFFERENT from live. Store in Supabase as `STRIPE_TEST_CLIENT_ID`.

### Critical Supabase env vars

In Supabase Project Settings -> Edge Function Secrets:

```
STRIPE_SECRET_KEY        sk_live_xxx (live mode)
STRIPE_CLIENT_ID         ca_xxx (live OAuth client ID from Stripe Connect settings)
STRIPE_TEST_SECRET_KEY   sk_test_xxx (only if using test mode for QA)
STRIPE_TEST_CLIENT_ID    ca_xxx (test OAuth client ID; different from live)
PAYMENT_MODE             'live' (default) or 'test'
RESEND_API_KEY           For email sends
SUPABASE_URL             Auto-set
SUPABASE_SERVICE_ROLE_KEY Auto-set
```

All four Stripe env vars should be set even if PAYMENT_MODE=live, so test-mode QA does not require redeployment. Missing test keys when PAYMENT_MODE=test produces immediate errors at first request (intentional, no silent fallback).

### Where Stripe Connect lives in the code

- Edge function: `supabase/functions/stripe-connect/index.ts` (single file, all actions)
- Express callback page: `src/pages/StripeConnect.js`
- Standard callback page: `src/pages/StripeConnectStandard.js`
- Settings UI (two-path Connect): `src/pages/Dashboard.js` inside SettingsPanel, section 4.2 "Payments"
- Debug surface: `src/pages/StripeDebug.jsx` (founder-only, embedded in /founder section 8)
- Schema migrations:
  - `supabase/migrations/stripe_account_ready_at.sql`
  - `supabase/migrations/stripe_account_type.sql`

### When to call in expert help

If after running the above procedures the system is still misbehaving, two escalation paths:

1. Stripe Support: `support.stripe.com`. They can see things we cannot (account-level disablement, payout holds, compliance flags). Mention you are a Connect platform with both Express and Standard.

2. Read the Stripe Connect docs at `stripe.com/docs/connect`. The "Account Links," "OAuth," and "Account types" pages are the relevant ones.

**End of Stripe Connect operations section.**

### Procedure 11: pg_cron job 401s silently against edge functions

Discovered May 24 2026 evening while investigating why Practice Pulse digest emails were not arriving and why Candice had no membership renewal rows. Symptom: cron job shows `status = succeeded` in `cron.job_run_details` but the edge function never ran, no logs, no emails. **pg_cron's "succeeded" only means the HTTP request was queued via pg_net, not that the function actually responded with 2xx.** The truth lives in `net._http_response`.

#### Why this happens

Supabase's edge function gateway requires a Bearer JWT in the Authorization header. pg_cron jobs run inside the database and have no automatic JWT injection. Three known broken patterns:

1. **No Authorization header at all** → `401 UNAUTHORIZED_NO_AUTH_HEADER`. The cron's `headers` jsonb has no Authorization key.
2. **Empty Bearer (from current_setting NULL)** → same 401. Crons that use `'Bearer ' || current_setting('app.settings.service_role_key', true)` will silently send `Bearer ` (just the literal word + space) when the setting is not configured. Per Procedure 11.1 below, `ALTER DATABASE postgres SET app.settings.service_role_key` is denied by Supabase's dashboard SQL editor with `42501: permission denied to set parameter`, so this pattern does not work in Supabase Pro out of the box.
3. **Hardcoded JWT that is now stale** → `401 UNAUTHORIZED_INVALID_JWT_FORMAT`. Anon JWTs rotate periodically (Supabase rotated theirs in Feb 2026); any cron created before the rotation that hardcoded the old anon JWT now fails. Token decode reveals the issue: `iat` predates the rotation date.

#### How to diagnose

```sql
-- Step 1: list every cron currently scheduled, with full command body
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobname;

-- Step 2: see actual HTTP response codes (not just pg_cron's "succeeded")
SELECT
  r.id,
  r.status_code,
  r.created,
  CASE WHEN length(r.content::text) > 200 THEN substring(r.content::text, 1, 200) || '...' ELSE r.content::text END AS response_body
FROM net._http_response r
ORDER BY r.id DESC
LIMIT 30;

-- Step 3: see whether the per-database service_role_key setting is configured
SELECT current_setting('app.settings.service_role_key', true) AS service_key_set;
```

If Step 2 shows 401s across multiple jobs, this procedure applies. If Step 3 returns NULL, the `current_setting`-based pattern will not work.

#### Recommended fix: hardcoded service_role JWT per cron

Service role keys are long-lived (Supabase issues with ~50 year expiry by default). Trade-off: if you ever rotate the service_role key, update each cron individually. Acceptable for the volume (6-10 crons typical).

Get the service_role JWT from `https://supabase.com/dashboard/project/<ref>/settings/api`. Then for each cron, use this template:

```sql
SELECT cron.unschedule('<name>');  -- ignore error if it didn't exist
SELECT cron.schedule(
  '<name>',
  '<schedule>',
  $$
  SELECT net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/<function>',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_JWT>"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);
```

After scheduling all jobs, verify with:

```sql
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Then force-fire one to confirm end-to-end:

```sql
-- Fire and remember the id this returns
SELECT net.http_post(
  url := 'https://<ref>.supabase.co/functions/v1/<function>',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_JWT>"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 30000
) AS request_id;

-- Wait ~5 seconds, then pull the specific response by id
SELECT status_code, content::text FROM net._http_response WHERE id = <returned_id>;
```

Expected: status_code = 200, content includes whatever the function returns (processed, results, etc).

#### Critical secondary bugs to watch for during a cron audit

1. **Wrong URL.** Always verify the URL points to the correct edge function. The original `daily-signups-digest` cron pointed to `/bodymap-ai` instead of `/daily-signups-digest`, so even after auth was fixed, it called the wrong function entirely. Cross-reference each cron's URL against `supabase/functions/` directory.

2. **Duplicate crons.** `send-booking-reminders` and `send-reminders-daily` were both scheduled, both pointing to `/send-reminders`. Delete one. Run `SELECT jobid, jobname FROM cron.job WHERE command LIKE '%<function_name>%';` to find duplicates by target function.

3. **Schedule drift across timezones.** Cron uses UTC. A "9am UTC" send-reminders means 4am Central in winter, 3am Central in summer. Add a comment in the cron command body documenting the intended local time so future you doesn't have to recompute.

#### Cross-verification via notification_log

```sql
-- 7-day fire log grouped by notification_type and channel
SELECT
  notification_type,
  channel,
  status,
  COUNT(*) AS fires,
  MIN(sent_at) AS first_fire,
  MAX(sent_at) AS last_fire
FROM notification_log
WHERE sent_at >= NOW() - INTERVAL '7 days'
GROUP BY notification_type, channel, status
ORDER BY fires DESC;
```

If a cron-driven notification type (`practice_pulse`, `appointment_reminder`, `renewal_due`, `daily_signups`, `founder_digest`) shows 0 fires in 7 days, that cron is the suspect. If it shows fires but with `status = failed`, the cron is reaching the function but the function or downstream provider (Resend, Twilio) is failing.

#### Side benefit: fixing cron auth surfaces hidden downstream errors

Until cron auth is fixed, all per-therapist failures inside the function are invisible because the function never runs. Once auth is fixed, the function runs and returns real results, which exposes things like:
- Expired Google OAuth tokens (HK Healing Hands token expired by May 24).
- Missing OAuth scopes (Candice's Google account had only login scopes, not calendar.readonly).
- Stale Twilio credentials, stale Resend keys, etc.

Plan to triage these downstream errors AFTER fixing cron auth, not before. Fixing auth first is what makes them visible.

### Procedure 11.1: ALTER DATABASE denied by Supabase SQL editor

Trying `ALTER DATABASE postgres SET app.settings.service_role_key = '<key>'` from the dashboard SQL editor returns `42501: permission denied to set parameter`. The Supabase Pro plan's hosted role does not have ALTER DATABASE privileges on the platform-owned database.

Workarounds in order of preference:
1. **Hardcode service_role JWT per cron** (Procedure 11 recommended path). Long-lived JWT keeps maintenance low.
2. **Open a Supabase support ticket** asking for the database-level setting to be configured. Some plans allow this on request.
3. **Move secrets into Supabase Edge Function environment variables** and have the cron call a "router" function that injects auth from env. Adds one HTTP hop and a router function but centralizes the key.

We chose #1 May 24 2026 because it works in 5 minutes with no support involvement and the JWT does not expire until 2087.

### Procedure 11.2: Practice Pulse logic was checking the wrong table

The Practice Pulse digest read `sessions.created_at` to detect "today's activity" but `sessions` rows are only created when a therapist writes SOAP notes (rare). Real activity lives in `bookings`. Same flaw applied to lapsed/due detection: it joined `clients.sessions(id, created_at)` instead of pulling per-client booking history.

Fixed May 24 2026 (commit `4c170230`): activity gate now queries `bookings.booking_date = today` with status filter, and lapsed/due detection uses a single batched `bookings.in(client_ids).neq('status', 'cancelled')` query instead of per-client subqueries.

Applies more broadly: any time you write a query that asks "did this therapist do X today," `bookings` is almost always the right table, not `sessions`. SOAP notes are optional and never the source of truth for activity.

### Procedure 11.3: Surface skip reasons in cron-driven function responses

If a cron-driven function decides not to send to certain therapists, the response should return WHY for each skipped one. Without this, all you see is `processed: 0` and have to read function logs or guess.

Pattern:
```typescript
const skipped: Array<{ id: string, name: string, reason: string }> = [];

for (const therapist of therapists || []) {
  if (!therapist.email) {
    skipped.push({ id: therapist.id, name: therapist.business_name, reason: 'no_email' });
    continue;
  }
  // ... other skip reasons
}

return new Response(JSON.stringify({ processed: results.length, results, skipped }), { ... });
```

The `skipped` array tells you instantly whether the function skipped because of (a) opt-out, (b) configuration, (c) data quality, or (d) genuinely nothing to report.

**End of cron audit procedures.**

### Procedure 12: Therapist reports "deposit isn't working" - diagnose silent revenue loss from approve+deposit interaction

Discovered May 25 2026 from Candice Peek's "how do I require a deposit, I thought I had that set up" support ask. When a therapist has BOTH `require_approval` AND `deposit_enabled` on, the platform silently never collects the deposit. Phase 25a surfaced this via a Settings warning banner; Phase 25b (queued) is the architectural fix. Until 25b ships, this procedure tells you how to confirm + remediate for the affected therapist.

**Step 1: Confirm both settings are on.**

```sql
SELECT email, business_name, deposit_enabled, deposit_percent, require_approval, stripe_account_id IS NOT NULL AS has_stripe
FROM therapists
WHERE email = '{their_email}';
```

If `deposit_enabled = true` AND `require_approval = true` AND `has_stripe = true`, you have the interaction. Otherwise diagnose normally (deposit toggle off, Stripe disconnected, etc).

**Step 2: Find affected bookings.**

```sql
SELECT b.id, b.client_name, b.client_email, b.booking_date, b.start_time, b.status, b.created_at, s.name AS service, s.price
FROM bookings b
LEFT JOIN services s ON s.id = b.service_id
LEFT JOIN session_payments sp ON sp.booking_id = b.id
WHERE b.therapist_id = '{therapist_uuid}'
  AND b.created_at > '{date_they_enabled_both}'
  AND b.status = 'confirmed'
  AND sp.id IS NULL
ORDER BY b.created_at DESC;
```

Any rows returned are bookings the therapist approved where the deposit was silently skipped. Each row is real money the therapist thought they collected.

**Step 3: Decide on remediation per booking.**

For each affected booking:
- If the session has already happened and the client paid in person: no action, mark as expected.
- If the session is upcoming and the client is a known repeat: optional, ask the therapist if they want to charge the deposit now via the slide-over Charge button.
- If the session is upcoming and the client was a first-timer: tell the therapist they can charge the deposit now via the slide-over Charge button (Stripe card-on-file or send pay link), or accept the loss and chalk it up to the bug.

**Step 4: Recommend immediate workaround until Phase 25b ships.**

Two options for the therapist to choose:
- **Option A:** Turn off `Approve new clients` in Settings → How I plug in → Booking page setup. Deposits will now collect at booking time as designed. They lose the approval-before-booking screen.
- **Option B:** Keep both on, accept that they need to manually charge the deposit from the slide-over after approving each request. The Settings warning banner (shipped May 25 commit `a8e136d2`) makes this requirement visible.

**Step 5: Note the customer in the queue for Phase 25b.**

When Phase 25b ships, all therapists with both settings on should be re-emailed to confirm the auto-charge flow is now live and they no longer need to manually charge. Track in BLOCK_PLAN item 31.

**Root cause:** `booking-approval` edge function at `supabase/functions/booking-approval/index.ts:82` sets `newStatus = action === 'approve' ? 'confirmed' : 'cancelled'` with no deposit-collection branch. Comment in `src/pages/BookingPage.js:816` acknowledged the gap ("the therapist sends a payment link after approving") but no UI implemented this. Phase 25b implementation note: pre-collect card on file at booking time via SetupIntent when both approval + deposit apply, store `payment_method_id` on the booking row, branch `booking-approval` to fire off_session charge via existing `create-deposit` infrastructure on approve, set status to `confirmed` only after charge succeeds. See DESIGN_PRINCIPLES rules 21 and 23.

## Edge function JWT verification (added May 17 2026)

Discovered during Phase 14.3 refund webhook implementation. Symptom: external webhook (Stripe, Twilio, etc.) calls your edge function endpoint, gets `401 Unauthorized` with body `{"code":"UNAUTHORIZED_NO_AUTH_HEADER"}`. The function never even runs.

### Why this happens

Supabase puts a gateway in front of every edge function. By default, the gateway requires a Bearer JWT in the Authorization header before forwarding the request to your code. Third-party services (Stripe, Twilio) don't send Bearer JWTs, they sign payloads with their own signing secret. So the gateway rejects them before your signature-verification code runs.

To make a function accept unauthenticated calls (so it can verify its own signature instead), deploy it with `--no-verify-jwt` flag.

### How our deploy workflow handles this

`.github/workflows/deploy-edge-functions.yml` maintains a `NO_JWT_FUNCTIONS` array. Any function name in this array is deployed with `--no-verify-jwt`. Currently includes:
- `stripe-payment-link-webhook` (handles `checkout.session.completed`)
- `stripe-refund-webhook` (handles `charge.refunded`)
- `book-public` (public booking page form submit)
- Other public endpoints as added

If you add a new webhook function and forget to add it to this list, requests will fail with 401 silently until you fix the workflow and redeploy.

### How to verify

After deploy, check the function logs:
```
https://supabase.com/dashboard/project/<ref>/functions/<name>/logs
```

If you see 401s with no function-level entries, it's the gateway rejecting before your code runs. Add the function name to `NO_JWT_FUNCTIONS` in the deploy workflow, push the change, wait for the GitHub Action to redeploy, then retry.

### Force-redeploy when allowlist changes

GitHub Actions only deploys functions whose source files changed. If you ONLY edit the workflow yaml (to add a function to the allowlist), the function's source code didn't change, so the deploy may skip it. To force a redeploy, make a trivial source edit (touch a comment) alongside the workflow change.

**End of edge function JWT section.**

---

## Procedure 12: White screen on mobile after a deploy (added Jun 1 2026)

### Symptom
Desktop works, mobile PWA crashes to white screen. Or: after a successful push, mobile users report broken Schedule / Booking page while HK on Mac sees nothing wrong.

### First-pass triage (60 seconds)
1. **Is it a stale-cache problem?** Have the affected user pull-to-refresh in Safari (not the installed PWA). If that fixes it: SW v35's update banner didn't trigger. Move to step 4.
2. **Is it a real iOS Safari runtime bug?** Open `/founder/mobile-preview`. Load the affected route at 380x720. If it crashes there too, the bug is in current code, not caching.
3. **Verify in DevTools mobile emulation** (iPhone 14 Pro profile) on desktop Safari with Develop > User Agent > Safari iOS. Chrome's iPhone emulation does NOT catch iOS-Safari-specific bugs.

### If the bug is real (not just caching)
- **First check rule #33** in DESIGN_PRINCIPLES.md: any `new Date(someString)` in the code that touched the broken view? iOS Safari rejects non-ISO strings as Invalid Date. Replace with regex parsing or strict ISO format.
- **Then check rule #34**: any `const` referenced before its declaration in the function body? Build won't catch this; runtime throws ReferenceError on first render.
- If neither matches, paste the exact stack trace from the user's DevTools (Safari > Develop > [device] > Console) and grep the bundle for the throwing function name.

### Recovery if mobile is broken in production
- **Revert the offending commit immediately.** Don't try to fix forward under time pressure.
  ```
  cd ~/Documents/bodymap && git revert --no-edit <commit-sha>
  npm run build 2>&1 | grep -iE "compiled|failed" | head -3
  git push
  ```
- If multiple commits are tangled, restore individual files from a known-good commit:
  ```
  git checkout <good-sha> -- src/components/<file>.js
  git add -A && git commit -m "EMERGENCY REVERT: restore <file> to <good-sha>" && git push
  ```
- Vercel deploy takes 90-120 seconds. Tell affected users to pull-to-refresh in Safari (not the PWA).

### Why this happens
iOS Safari is the strictest runtime in our stack. Desktop Chrome runs a more permissive engine that silently coerces bad inputs (Invalid Date, undefined destructured values, NaN sort keys) into something that doesn't crash. iOS Safari throws. The fix is process (rule #35: preview on mobile before push) plus code hygiene (rules #33 and #34).

### Service-worker recovery if SW itself is stuck
If a user is stuck on an old SW that won't pick up the new bundle even after pull-to-refresh:
1. Settings > Safari > Advanced > Website Data
2. Find `mybodymap.app`, swipe left, Delete
3. Open the PWA again. Forces fresh fetch of HTML + JS + SW.

Last resort: delete the PWA from the home screen, reopen Safari, navigate to mybodymap.app, Share > Add to Home Screen.

---

## Procedure 13: Edge function passes type check but fails at runtime validation (added Jun 1 2026)

### Symptom
You add a new template to a Supabase edge function (founder-outreach, notify-payment-event, etc.). The TypeScript type accepts your value (`ActionType` includes it). Builds clean. Deploys green. But every send fails with `action_type must be one of [list that doesn't include your new value]`.

### Root cause
The function has two sources of truth for valid values: the TypeScript type AND a runtime `validActions` array. Adding to one without updating the other creates a silent-failure trap.

### Fix
Find the validator array (grep for `validActions` or similar). Add the missing entry. Push.

### Permanent mitigation (queued)
Refactor to one source of truth:
```ts
const templates = { welcome: {...}, checkin: {...}, product_update: {...} };
const validActions = Object.keys(templates);
```
This way the type, the validator, and the dispatch all agree by construction.

### Incident
Jun 1 2026: founder-outreach broadcast to 62 therapists failed all 62 sends. `product_update` was in the ActionType union but not in the validActions array. Last successful product_update send was Apr 29 2026 (before the validator was tightened).

**End of runbook.**

This document is the operational core of MyBodyMap. Update it at the end of any session that introduces meaningful new context, decisions, vendors, or risks. If you are reading this because HK is unavailable: take a breath, read it slowly, ask questions in writing rather than assuming, and remember that the platform is intentionally simple. Most "broken" reports are actually configuration questions answered in this runbook.
