# MyBodyMap Block Plan
**Living document. Survives compaction. Update freely.**

Last refreshed: 2026-04-29 — after Twilio setup discussion + Noterro research.

## Current state
- 28 therapists signed up. ~5 active. Most never returned after signup.
- Settings v3 Phase 1A + 1B + 1C shipped (hero, leaf, collapsible rows AND collapsible major sections, welcome-at-top, Import Clients as 1st row in How I practice, Account renamed to "My membership").
- Founder dashboard: numbered collapsible tables (Therapists / Activation / Comms Log) + Mass SMS broadcast tool with Account Audit, Test Mode toggle, channel selector (Google Voice / Mac Messages), word counter, multi-select, guided sequence, and Twilio batch send (paste creds → send 100+ in one click).
- Settings full-width parity with Clients/Schedule/Billing tabs.
- Auto-update booking-link slug when business name changes.
- Mass SMS message template is now ≤10 words with "MyBodyMap founder" branding.

## Active fires
1. **Twilio setup in progress** — HK has authorized investing. Step-by-step in the Twilio dashboard tonight. After purchase + creds, he will plug in to MyBodyMap and broadcast to 23 textable users.
2. **A2P 10DLC registration** — required for US production sends. Sole proprietor low-volume path. ~$4 brand fee + $10/mo campaign. 1-3 business days approval.
3. **Mass broadcast pending** — wait until Twilio number provisioned + 10DLC approved before sending to all 23.
4. **Notify Leela** — booking approval and intake-before-booking gates are live. She signed up after the FB thread. Joy DM: "Hey Leela, the approval and intake-first toggles you wanted are live in your Settings under How I practice → Booking flow. Both default OFF so nothing changes unless you turn them on. Holler if anything looks off."

## TIER A — ship in next 2-4 weeks (highest leverage)

### A0. Smart defaults at signup *(was Phase 2)*
**Why:** New therapists arrive at a blank Settings page and bounce. With smart defaults they land 80% configured.
**Build:** Pre-fill on signup:
- Hours: Mon-Fri 9-5
- 3 services pre-toggled with median pricing: Swedish 60min $90, Deep Tissue 60min $100, Hot Stone 90min $135
- 4 add-ons pre-toggled: Hot Stones $15, Aromatherapy $10, Hot Towels $8, Extended +30min $45
- AI features ON
- Practice Pulse ON
- Buffer 15 min between sessions
**Effort:** 2 hr
**Files:** Signup.js handler, supabase migration to insert default rows for new therapist_id
**Status:** Queued

### A1. Voice-to-SOAP scribe via Claude API *(from Noterro analysis)*
**Why:** Noterro's wow feature. Solo LMTs hate typing notes. Already have Claude API integrated for AI briefs. Direct competitive move.
**Build:**
- Browser audio capture via WebRTC (MediaRecorder)
- Upload to Anthropic API with prompt: "Generate SOAP note from this massage session recording. Filter out small talk. Use the patient's history: [pulled from clients table + last 3 sessions]. Output strictly in SOAP format with Subjective/Objective/Assessment/Plan keys."
- Pre-fill SOAP fields, therapist edits before saving
- Add "Record session note (45 sec)" button next to existing "Pre-session brief" button
**Effort:** 6-8 hr. Cost: $0.01-0.05/scribe with Claude Haiku.
**Files:** New `src/components/VoiceScribe.jsx`, edge function `supabase/functions/voice-to-soap`, ScheduleDashboard integration
**Status:** Queued

### A2. Catalog approach with toggle pills *(was Phase 3)*
**Why:** Eliminates ~60 first-time clicks. Therapist arrives at "Services" with 10 common ones already listed; toggles on/off, edits price if wanted.
**Build:**
- 10 services as toggleable rows (Swedish 60/90, Deep Tissue 60/90, Hot Stone 90, Sports 60, Prenatal 60, Trigger Point 60, Couples 90, Chair 30) with researched median prices
- 8 add-ons toggleable (Hot Stones, Aromatherapy, Hot Towels, Extended, CBD Oil, Cupping, Gua Sha, Scalp Massage)
- 3 package templates (3-Pack $270, 5-Pack $425, 10-Pack $800)
- 3 membership tiers (Monthly $79, Plus $129, Premium $189)
- 4 event templates (Stretch & Restore, Self-Massage 101, Couples Massage Class, Breathwork)
- Each toggle on saves immediately; price/duration editable inline
**Effort:** 3-4 hr
**Files:** ServicesAndAvailability, ServiceAddonsCard, PackagesCard, MembershipsCard, EventsCard
**Status:** Queued

### A3. Recurring appointment booking *(from Noterro analysis)*
**Why:** Massive retention lever. "Book this same time every 2 weeks for 6 sessions" sticks clients to the practice.
**Build:**
- bookings table: add `recurrence_rule` (RRULE format) or `parent_booking_id` linkage column
- After picking first slot, prompt: "Book this same time every [1/2/4 weeks] for [N] sessions" with auto-conflict-skip on holidays
- Public booking page UI + dashboard schedule view shows recurring chain
**Effort:** 4-5 hr
**Files:** BookingPage.js, Supabase migration, ScheduleDashboard
**Status:** Queued

### A4. Smart phrase library in SOAP *(from Noterro analysis)*
**Why:** Speeds up the documentation pain point. Companion to voice scribe.
**Build:**
- Pre-seeded catalog: "Trigger point released," "Hypertonic in upper traps," "Range of motion improved 15%," etc.
- Therapist creates custom phrases with a + button (saved per-therapist)
- Tap any phrase to insert into active SOAP field
**Effort:** 3 hr
**Files:** New SmartPhrases component in SOAP editor, Supabase table `smart_phrases`
**Status:** Queued

## TIER B — ship in 4-8 weeks

### B0. Phase 1B.5 — JSX reorder for Settings categories
**Why:** Currently AI Features sits in How I practice (should be How I rest easier). Cal/Payments need a "How I plug in" header. Block Days Off should be in How I practice with services.
**Build:** Move sections to right groups; add 5th "How I plug in" section header.
**Effort:** 1 hr
**Files:** Dashboard.js
**Status:** Queued

### B1. PWA "Add to Home Screen" with branded icon *(from Noterro analysis)*
**Why:** Matches Noterro's "branded client app" claim at 80% effort. No app store submission required.
**Build:** manifest.json + service worker; per-therapist icon (uses photo_url or generated initial); install prompt on booking page
**Effort:** 3-4 hr
**Files:** public/manifest.json, public/service-worker.js, BookingPage.js
**Status:** Queued

### B2. Branded client emails *(from Noterro analysis)*
**Why:** Confirmation emails currently are generic. Per-therapist logo + brand color builds professional perception.
**Build:** Resend templates parameterized per-therapist; add brand_color and logo_url fields to therapists table
**Effort:** 3 hr
**Files:** supabase/functions/send-confirmation, send-reminders
**Status:** Queued

### B3. Branded booking page colors
**Why:** Solo LMTs care about brand. Currently booking page is fixed cream/forest.
**Build:** Therapist picks 1-2 brand colors in Settings; booking page CSS uses CSS variables
**Effort:** 2 hr
**Files:** BookingPage.js, Settings profile section
**Status:** Queued

### B4. Customizable intake form fields *(from Noterro analysis)*
**Why:** Beyond body map, lets therapist add custom questions for prenatal, sports, geriatric massage.
**Build:** Form-builder UI in Settings; intake_form_fields JSONB column on therapists; ClientIntake renders dynamic fields
**Effort:** 4-6 hr
**Files:** New IntakeFormBuilder component, ClientIntake.js
**Status:** Queued

### B5. Local market intelligence inline coaching *(was Phase 4)*
**Why:** "LMTs in 77479 charge $85-$110 for Swedish 60." Knows the LMT's zip + market.
**Build:** Regional pricing dataset (Texas urban/suburban/rural buckets to start). Inline coaching pill shown next to service price field.
**Effort:** 4-6 hr (dataset is the main work)
**Files:** New `pricing_benchmarks` table, ServicesAndAvailability UI
**Status:** Queued

### B6. Search bar across Settings *(was Phase 5)*
**Why:** Once Settings has 25+ rows, search becomes valuable. Not yet critical.
**Build:** Top-of-Settings search input; client-side fuzzy match across row labels and summaries
**Effort:** 1-2 hr
**Files:** SettingsPanel
**Status:** Queued

## TIER C — only if demand surfaces

### C1. Insurance billing (CMS-1500 / TELUS eClaims)
**Why:** Noterro's strength. But only matters if MyBodyMap targets clinical/medical massage. Most solo cash-based LMTs don't bill insurance.
**Effort:** 12-20 hr
**Status:** Skip unless feedback shows demand

### C2. Waitlist with auto-fill
**Why:** Strong retention feature. Match Noterro's offering, don't paywall ours.
**Build:** Client adds self to waitlist for service; on cancellation, system auto-texts next waitlisted person
**Effort:** 5-6 hr
**Status:** Queued

### C3. Phone-call reminders
**Why:** Niche. Older clientele may value it.
**Build:** Twilio voice + text-to-speech for clients flagged "phone reminder preferred"
**Effort:** 4-5 hr
**Status:** Skip unless demand

### C4. Drew Gracen's smart scheduling V2
**Why:** Hot lead waiting. Preference-driven optimization. Needs strategy work first.
**Status:** Paused — needs product strategy session

### C5. HIPAA roadmap decision
**Why:** $1,000/mo Supabase Team + HIPAA add-on for real BAA. Could be Silver/Gold differentiator if invested.
**Status:** Defer until paid users hit ~30+

## INFRASTRUCTURE / OPERATIONAL

### Op-1. Admin RPC pipeline for Claude to run migrations directly
**Status:** ✅ DONE — solved differently and better. GitHub Actions workflow `.github/workflows/deploy-edge-functions.yml` auto-deploys ALL Supabase Edge Functions whenever files in `supabase/functions/**` change on the main branch. Uses `SUPABASE_ACCESS_TOKEN` secret stored in GitHub repo settings (already configured). Claude pushes code → workflow deploys automatically → green checkmark visible at `github.com/bodymapapp/bodymap/actions`. **HK never needs to paste code into Supabase dashboard for Edge Function changes.** SQL migrations still require manual paste in Supabase SQL editor (separate concern, not yet automated).

### Op-2. Stripe Product display name fix
**Issue:** Stripe checkout shows "BodyMap" not "MyBodyMap" (legal entity pulling through).
**Action:** Update product display name in Stripe dashboard. No code.
**Status:** Quick task pending

### Op-3. Cloudflare API token revocation
**Token:** stored in HK's records (starts with `cfut_qX0...`) — never used, low risk
**Status:** Cleanup task

### Op-4. Selling layer for offerings
**Why:** Packages/Memberships/Events Settings cards exist but selling layer (taking money, redemption, attendee registration, Stripe recurring) was deferred.
**Effort:** 3-4 hr
**Status:** Queued — wait for therapist to actually use the Settings cards before building the sell side

### Op-5. WhyBodyMap manifesto sharpening
**Why:** "5 things only we do" needed rewrite. Paused.
**Status:** Defer

### Op-6. Daily Investment Brief automation (HK personal use)
**Why:** Discussed earlier — book editorial pipeline + investment morning brief. High token consumption led to a high-tier plan recommendation.
**Status:** Defer; not on critical path for MyBodyMap product

## RUNNING NOTES / CONSTRAINTS

- React hooks imported individually (no `React.useMemo`)
- Never use em dashes anywhere (code, UI, emails, marketing copy)
- "MyBodyMap" not "BodyMap" in user-facing text (legal entity only is BodyMap LLC)
- Mobile-first: 70% of users mobile, persona is 70-year-old female LMT
- Find root cause, never shortcut. Flag temporary workarounds explicitly.
- Update Features page when shipping any new feature
- Test build locally before claiming done
- Smart defaults > blank starts always
- 28 textable users right now, low risk to break existing booking links if needed

## DEPLOY COMMAND
```
cd ~/Documents/bodymap && npm run build && git add . && git commit -m "msg" && git push && npx vercel --prod --token=$VERCEL_TOKEN --scope bodymapapps-projects
```
(Vercel token in `~/.bodymap-env` or `.env.local`. Vercel auto-deploys via GitHub integration; explicit deploy only when needed.)

## TEST ACCOUNT
- Email: hk5@email.com
- custom_url: hk5

## RECENT SHIPS (newest first)
- Outreach upgraded: AI starter (8 categories), expanded tokens, subject, unsubscribe, history → `9fd7ffa9`
- Migration: outreach_sends history + clients.outreach_unsubscribed → `cc0c77b9`
- Settings: tappable inline edit, smarter search with synonyms, emoji-free polish → `70f07c66`
- Settings visual upgrade: Apple Settings style grouped panels → `69ced7ac`
- Fix: leaked '*/}' comment fragment + helper-script hardening → `3cf1bb67`
- Why-this-matters benefit framing on AI / Practice Pulse / Push (Ship 5) → `fc05975f`
- Defaults seeding for Add-ons / Packages / Memberships / Classes (Ship 4) → `1f963c3e`
- Settings IA refactor: 5 groups, taxonomy, time badges, search bar (Ship 3) → `53eb1beb`
- Time off mobile-first stacked layout fix + Stats strip on dashboard (Ships 1+2) → `de624830`
- Operating rhythm rule 9: never `git add -A`, always explicit paths → `f556b9c9`
- Intake gate yields to approval gate when both are on (one submit, no orphan booking) → `791ace87`
- Intake-before-booking gate: redirect new clients to intake form first → `48397be1`
- Booking approval flow: pending requests panel + approve/decline + Joy emails → `006c7866`
- Migration: booking approval + intake-before-booking gates + auto-run workflow → `9b98d31b`
- Operating rhythm: tappable A/B/C decisions, no implementation detail in plans → `085ae0b9`
- Mass SMS: Google Voice channel + 10-word default + Noterro research → `35b830b4`
- Settings: auto-update booking-link slug when business name changes → `3bab2aaa`
- Mass SMS: prominent test mode toggle → `af1a4c40`
- Mass SMS: account audit panel + raw DB count → `1f8770d1`
- Mass SMS: show ALL accounts including no-phone → `9bb0589f`
- Founder: collapsible numbered tables + demo account filter fix → `19afc9f9`
- Mass SMS v2: admin toggle, multi-select, name personalization, Twilio batch → `8d8a7a12`
- Settings full width + Mass SMS broadcast tool → `48b31308`
- Settings v3 polish: Import as 1st row, Account → "My membership" → `87273c0a`
- Settings v3 Phase 1C: Collapsible major sections + welcome at top → `3467f549`
- Settings v3 Phase 1B: Collapse-on-tap rows → `3c71bc0d`
- Settings v3 Phase 1A: Personal hero, botanical leaf, categorical headers → `cdf3a056`

## OPERATING RHYTHM (HARD RULES)

How HK and Claude work together every session. Survives compaction.

1. **Plans surface tradeoffs, not implementation detail.** No "files touched" lists. No code paths. No migration column names in the plan. HK does not need to know which file is being edited. He needs to know what is being built, what it costs, and what tradeoffs exist.

2. **Decisions are tappable.** Every decision HK makes is presented as A / B / C (or 1 / 2 / 3). HK reviews on iPhone. He should never have to type a sentence to make a choice.

3. **Plans answer four questions only:**
   - What is being built (one or two sentences per feature)
   - What tradeoffs exist (the real choices)
   - How long it takes (honest hours)
   - What order things ship in

4. **Confirm scope before code.** For anything multi-hour, lay out the plan, get HK's tap-decisions, then build. Do not start coding while waiting for decisions.

5. **Report after shipping in 3-5 lines.** What shipped, the commit SHA, what to test, anything that needs HK's manual touch.

6. **Never claim async work.** Claude only runs when HK is in chat. If a task needs 4 hours, say so and iterate commit by commit.

7. **Customer-facing voice is always Joy / MyBodyMap Team.** Never HK or initials. Never em dashes anywhere.

8. **Minimum-click principle. Apply to every flow, every screen, every feature.** Minimum clicks, minimum scrolling, minimum process steps, minimum cognitive load. If a user has to submit twice, scroll past explanation, or wonder "what now," the design has failed. Ask before building any flow: "How many taps from start to done? Can it be fewer?" This applies retroactively to anything we ship. Two-step flows that should be one-step flows are bugs.

9. **Never use `git add -A` or `git add .`. Always stage explicit file paths.** Container starts fresh each session, `npm install` modifies `node_modules`, and a wildcard add will pull thousands of dependency files into the repo. Stage every change by its full path: `git add src/pages/Dashboard.js src/components/StatsStrip.js`. The `.gitignore` already excludes `node_modules/` as a backstop, but the explicit-paths rule is the primary defense.

## REFERENCE FILES IN REPO
- `BLOCK_PLAN.md` — this file. Always update when shipping or adding ideas.
- `docs/email-voice-guide.md` — canonical email broadcast voice guide. Joy persona, structure, hard rules. Reference this BEFORE drafting any broadcast template.
- `research/noterro-competitive-analysis-2026-04.md` — full Noterro deep-dive
