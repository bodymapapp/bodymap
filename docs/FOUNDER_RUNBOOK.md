# MyBodyMap Founder Runbook

**Last updated:** May 21, 2026
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

---

## 1. Mission and current state

### Mission
Help solo licensed massage therapists retain and grow their client base by automating the practice-management work they currently do manually or through expensive, clunky competitors (Vagaro, MassageBook, ClinicSense). The northstar: make it impossible for a client not to return.

### Current state (as of May 22, 2026)
- **Stage:** Pre-revenue beta with first real customers actively using the platform.
- **Users:** Single-digit founding therapists onboarded for testing. Two active real customers:
  - **Candice Peek (Grounded Grace)**: signed up May 15. Real testimonial customer. Multiple bugs reported and fixed May 19-21.
  - **Jackie Bodkin (Back2Life Restorative Massage)**: signed up May 20. By May 21 evening she had 466 clients + 124 confirmed appointments stretching to April 2027. Her single first import surfaced 10+ real bugs and UX gaps; every one became a shipped fix across May 21-22.
- **Business form:** BodyMap LLC (Texas). HK is sole owner.
- **Engineering:** Solo build via Claude. No human engineers retained.
- **Funding:** Self-funded by HK from IBM income.

### What's working
- Stripe payment integration end to end (deposits, packages, memberships, card-on-file, refunds)
- Square payment integration achieves parity with Stripe (subject to Square activation by individual therapists)
- Automated client retention: post-session AI brief, lapsed-client outreach, cancellation policy with auto-charge
- Marketing surface: home + features pages with seven-ribbon taxonomy
- **CSV import** (clients + appointments) with Maria-persona safety: pre-flight checks, strict column matching, phone normalization, downloadable skipped/failed rows, **client-side resumable on interrupt via localStorage**, **undo-last-import via batch id within 10 minutes**, **fuzzy service matching with one-tap merge**, multi-file orchestration with preview, address fields, smart currency-content detection. Survived Jackie's catastrophic-mapping case May 21 and now meaningfully prevents the next one.
- **Schedule** loads 365 days back + 365 days forward. Four scope tabs (today, weekly, monthly, yearly) all real and visually consistent. Desktop weekly is Outlook-style time grid. Mobile weekly has horizontal time-strips per day card. Monthly + Yearly show blocked days visually. Yearly is a 12-month sage-gradient heatmap.
- **Schedule growth insights**: 7 care-framed practice observations fire from real data on the "Ways to use this" surface. Deep-link to outreach with named clients pre-selected.
- **Outreach Quick send**: 5 preset templates plus a Custom card for picking any clients and writing anything.
- **Notification system** Phase 15 wired for bookings, payments, refunds (May 18). Awaiting first real customer-driven activity to verify end-to-end.

### What's not working / unproven
- No real revenue yet. Need 100 founding therapists to validate retention metrics before pricing rollout.
- Square activation friction: each therapist must complete identity + bank verification at squareup.com/activate before charges process
- Therapist acquisition channel: currently word-of-mouth only via founder DMs (Katelynn et al.)
- **Twilio A2P 10DLC Brand registration** stuck in review with TCR. Blocks all US SMS until cleared.
- **Two pending migrations to apply** in Supabase SQL Editor before HK's testing covers everything from May 22: `2026-05-21-clients-address-fields.sql` (address columns) and `2026-05-22-import-batch-id.sql` (batch tracking). Until applied, address fields don't save on client profile and undo-last-import fails on insert. Both idempotent (`IF NOT EXISTS`).
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

### Migration history
All schema changes applied via Supabase SQL editor manually by HK. Most recent block (run May 7, 2026) added Square columns to all payment-related tables for parity. See git log for the SQL blocks.

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

**Critical lesson, May 21 2026 (Candice blocked-day incident):** Any table the booking page queries needs an explicit public-read RLS policy. Default `FOR ALL USING (therapist_id = auth.uid())` returns empty silently when called by the anon role (since `auth.uid()` is null), which the JS client treats as "no rows" rather than an error. Symptom: customer reports a feature appearing broken on the booking page even though data is correct in the dashboard. Root cause: missing public-read policy. Fix in commit `613de194`, migration `2026-05-20-blocked-days-public-read.sql`. When adding any new table the booking page reads, add a public-read policy in the same migration.

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

## 15. What to do if X breaks

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

## Appendix A: File map

The most important files to know:

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

**End of runbook.**

This document is the operational core of MyBodyMap. Update it at the end of any session that introduces meaningful new context, decisions, vendors, or risks. If you are reading this because HK is unavailable: take a breath, read it slowly, ask questions in writing rather than assuming, and remember that the platform is intentionally simple. Most "broken" reports are actually configuration questions answered in this runbook.
