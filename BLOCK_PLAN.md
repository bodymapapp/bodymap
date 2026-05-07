# MyBodyMap Block Plan
**Living document. Survives compaction. Update freely.**

Last refreshed: 2026-05-02 — after Tier A0 smart defaults shipped + Comparison v7 + 4 switcher CTAs + AI/Claude→MyBodyMap Platform brand swap + AutomationHub overflow fixes + new CampaignsDemo + Tier S items added from FB Massage Therapists Community thread (May 1-2).

## Current state
- 28 therapists signed up. ~5 active. Most never returned after signup.
- Tier A0 (smart defaults at signup) SHIPPED. New therapists land in dashboard with 3 services, business hours, 5 add-ons, 5 memberships, 5 packages pre-seeded. Booking page accepts real bookings immediately on first dashboard load.
- Comparison page v7 at /comparison: per-card sticky thead, dropped Verify/Wrong gamification, dropped row notes + subtitles, 7 platform cards each screenshot-shareable.
- /comparison/printable one-page artifact: 15-row curated matrix, "Verified May 2026" badge, screenshot or PDF for FB groups + AMTA handouts.
- 4 empathetic switcher CTAs live (Home / WhyBodyMap / Comparison / Pricing). Headline promise: "Up and running in 2 minutes" — now backed by Tier A0.
- "Solo" framing removed from public surfaces (broadens to multi-practice operators like Terra).
- AI / Claude → MyBodyMap Platform brand swap shipped across 22 files.
- New CampaignsDemo wired into Relationships ribbon as carousel partner with AutomationHub.
- AutomationHub overflow + Schedule/Billing top-bar fixes shipped with Pattern-style animations.
- 4 Facebook marketing graphics built (1080x1350) for Bo Ma persona Facebook + Instagram posting.

## Active fires
1. **Twilio setup in progress** — HK has authorized investing. Step-by-step in the Twilio dashboard tonight. After purchase + creds, he will plug in to MyBodyMap and broadcast to 23 textable users.
2. **A2P 10DLC registration** — required for US production sends. Sole proprietor low-volume path. ~$4 brand fee + $10/mo campaign. 1-3 business days approval.
3. **Mass broadcast pending** — wait until Twilio number provisioned + 10DLC approved before sending to all 23.
4. **Notify Leela** — booking approval + intake-before-booking gates AND the new service/add-on description fields she just asked for are live. Joy DM ready when feature ships.
5. **Notify Regina** — campaigns demo page is live at /campaigns. After CapCut video is embedded, share the URL on the FB thread or DM directly.
6. **Campaigns demo video** — HK is making a CapCut version with music (Supademo paywalled audio). When ready, swap `DEMO_EMBED_URL` (iframe) or `DEMO_MP4_URL` ('/videos/campaigns-demo.mp4') in `src/pages/Campaigns.jsx` to flip placeholder → live video.
7. **Ashton's medical massage photo storage** — deferred. HK wants to think through HIPAA implications first. Sketched 3 paths in chat (per-session / per-client timeline / both) plus consent flow + signed-URL storage. Revisit after Twilio.
8. **Desktop 2-column intake layout not visible at user's viewport** — shipped responsive grid (`repeat(auto-fit, minmax(300px, 1fr))`) in commit `ab625fa5`. HK reports desktop still showing 1 column. Might be: (a) viewport is being constrained somewhere we missed, (b) max-width 940 is too narrow combined with min 300 = 940/300 = 3 columns possible but auto-fit collapsing to 1 due to other constraint, (c) HK's monitor was actually below 600px width when tested. Investigate by checking PrefScreen render width with DevTools, possibly tighten min from 300 to 280 to make 2 columns fire earlier. Lower priority since smart defaults + chips render are the bigger UX wins.
8. **Marketing image batch — HK to generate 10-20 in one go.** As we add features, multiple placeholder/duplicate images accumulate. Better to ask HK for a batch all at once than nibble one image at a time. Current list (last updated May 7, 2026):

   **PLACEHOLDERS using duplicated existing images (need real assets):**
   - **Gift cards Features page hero** — uses placeholder div with stylized mock card in dusty rose gradient (`src/pages/Features.jsx`, GIFT CARDS section). Need a product photograph: printed gift card on wood/linen/hand. Replace placeholder div with `<img>`.
   - **Campaigns Features page hero** — uses embedded animated demo. Could use a calmer companion hero photo. Style: practitioner looking at her phone, warm ambient light, not generic stock.
   - **Cycle-aligned scheduling Features hero (1.2)** — currently using `feature-1-7.jpg` as a stand-in (originally meant for "Website embed"). Need its own thematic image: moon/cyclic motion, woman with eyes closed, calm botanical. Feminine + professional.
   - **Customize your intake Features hero (2.2)** — also using `feature-1-7.jpg` placeholder. Need a thematic image: hands editing a form on a tablet, or a paper checklist with custom marks. Practitioner-led, not generic.
   - **Stripe + Square parity (6.5)** — currently `feature-6-5.jpg` is a copy of `feature-6-1.jpg` (billing dashboard). Need its own thematic image: hands at a card reader OR a laptop showing two payment processor logos OR a calm desk scene with a tablet showing a checkout screen. Theme: "options without lock-in." Feminine + professional. Soft sage/forest palette.
   - **Card on file at booking (6.6)** — currently `feature-6-6.jpg` is a copy of `feature-1-5.jpg` (deposits at booking). Need its own thematic image: a phone screen showing a card-save UI in soft hands OR a wallet on a wood surface with a credit card peeking out OR a calm booking moment with a card visible. Theme: "trust + protection, not transaction." Warm and reassuring, not aggressive.
   - **One-tap refunds (6.7)** — currently `feature-6-7.jpg` is a copy of `feature-6-2.jpg` (cancellation policy). Need its own thematic image: a gentle "return" motion (arrow-back gesture) OR hands holding a phone with a refund confirmation OR a soft scene of money returning to a wallet/purse. Theme: "fair, easy, no shame." Warm tone, not aggressive or transactional.

   **WHEN HK READY:** generate the above 7 images, name them `feature-cycle.jpg`, `feature-intake-edit.jpg`, `feature-6-5.jpg`, `feature-6-6.jpg`, `feature-6-7.jpg`, etc., drop into `public/images/`, replace the placeholder references. Image specs: 543×464 JPEG (matches existing assets), warm cream/sage palette, no text overlay, no obvious AI artifacts.

   **PROCESS RULE:** going forward, whenever I duplicate an existing image as a placeholder, log it here so the batch grows in one place. Don't make HK chase image asks one at a time.

9. **Production intake wire-up for custom schemas (Phase 2 of intake editor)** — the IntakeEditor at `/dashboard/intake/edit` ships and saves to `therapists.intake_schema`, but the live client intake (`Demo.jsx` rendered via `ClientIntake.js`) still uses the hardcoded fields. Therapists can save customizations but clients haven't seen them yet.
   - Honest yellow banner inside the editor tells therapists "live in next deploy"
   - Phase 2 work: read `effectiveSchema(therapist)` in Demo.jsx, render dynamic fields based on schema instead of the hardcoded prefs section. Risk: Demo.jsx is 4649 lines, includes BodyMapApp + TherapistView + many sub-components; need careful surgical changes to only the preference rendering loop, not break body map / waiver / submission logic.
   - Estimated time: 3-4 hours of careful work, testing across multiple existing therapists.
   - When done: remove the yellow banner, send "Intake editor is live" email to anyone who used the editor.

10. **Cloudflare email loop on welcome sends — stop BCCing reminders@mybodymap.app** — every time a new signup welcome email fires, HK gets a Cloudflare "missing email" notification because of Gmail's self-to-self deduplication. Root cause: edge functions BCC `bodymapdemo@gmail.com` for monitoring AND something in the chain crosses through `reminders@mybodymap.app` (which forwards to `bodymapdemo@gmail.com`). HK's preferred fix: stop sending to reminders@ entirely. Cleanest implementation: change BCC address in `send-welcome`, `send-drip`, `founder-outreach`, `daily-signups-digest`, `unsubscribe` edge functions from `bodymapdemo@gmail.com` to `bodymapdemo+welcomes@gmail.com` (or `+notifications`). Same Gmail inbox lands the BCCs but Cloudflare and Gmail dedup logic see distinct addresses, loop stops. Alternative: remove the BCC entirely since `notification_log` table already records every send and `/founder/emails` shows them. Estimated time: 30 min including testing one welcome send.

11. **Cancellation policy Phase 2: Stripe SetupIntent + auto-charge enforcement** — Phase 1 ships the policy builder + client-facing display today. Phase 2 plugs in the actual Stripe machinery:
   - **Card capture at booking**: when therapist's policy has `card_required_first_timers` or `card_required_regulars` on, BookingPage calls Stripe SetupIntent to save a payment method against the client's record. UI: Stripe Elements card input embedded in the booking flow, between the policy text and the Confirm button. Save the resulting payment_method_id to `clients.stripe_payment_method_id` (new column).
   - **Auto-charge enforcement**: when a booking is canceled, rescheduled, or no-showed (each has its own trigger):
     - cancel/reschedule: detected when therapist or client edits/cancels in dashboard or booking page. Compute hours_before = appointment_at - now. Look up therapist's policy. Find applicable percent (e.g. cancel_under_2h_percent). If > 0 and card on file, Stripe.PaymentIntent.create() with amount = session_price * percent, customer = client.stripe_customer_id, payment_method = client.stripe_payment_method_id, confirm=true.
     - no-show: detected by a daily cron that checks for confirmed bookings whose appointment_at is in the past + no session_completed flag. Same charge logic.
   - **Notifications**: email client + therapist when a charge fires. Subject: "A {percent}% charge applied per your cancellation policy". Body: explain trigger + amount + receipt link.
   - **Refund flow**: therapist can refund any auto-charge from the Clients tab if she wants to be lenient.
   - **Schema additions**: `clients.stripe_payment_method_id`, `clients.stripe_customer_id`, `bookings.cancellation_charge_amount`, `bookings.cancellation_charge_status`.
   - Estimated time: 6-8 hours for a careful build with testing.
   - Phase 1 yellow banner in Settings/CancellationPolicy reads "Card capture and auto-charging come in the next deploy" — remove banner when Phase 2 ships.

12. **Verify booking confirmation trigger end-to-end** — DB trigger `bookings_fire_confirmation` is installed (May 5, 2026, post-Lindsey-Thomas debugging session). `tgenabled: O`. Function `public.fire_booking_confirmation` has the service role key inline and calls `send-booking-confirmation` via pg_net on every confirmed/pending-approval INSERT. Not yet tested with a fresh booking.
   - Test plan: open bodymapdemo booking page in incognito, make a quick test booking, query `notification_log` within 60 seconds. Should see two new rows (client + therapist) with `status='sent'`. Email should arrive in inbox.
   - If trigger does not fire: check pg_net._http_response for the call ID, check edge function logs.
   - When verified: delete this fire and add one-line note to the deploy/runbook.

13. **Apology email to therapists whose real clients got late confirmation emails today** — May 5 backfill released ~50 retroactive booking confirmation emails. Most are test bookings (Healing Hands, Under the Trees demo, fake @email.com addresses) but some real client emails for Terra Irving, Sarah Feinstein, Lindsey Thomas, and Run Performance Pro went out for bookings that may have been weeks old.
   - Action: identify which therapists had real-client bookings in the backfill batch. Query notification_log WHERE sent_at BETWEEN today's backfill window AND status='sent', join to bookings, exclude obvious test patterns.
   - Send each affected therapist the apology message in Joy voice (drafted in chat May 5):
     > Hi [name], A quick note. Earlier today I was working through a small system issue, and as part of fixing it, I released some booking confirmation emails to your clients that should have gone out at the time of booking but did not. If any of them reach out confused, please let them know it was a system issue on our end. The emails are real (those bookings are correct), they just arrived late. I caught the issue, fixed it, and put a permanent safeguard in place so this cannot happen again. Going forward, the email goes the moment a client books. No browser, no waiting, no chance of missing. With care, Joy.
   - Effort: 30 min (build the affected list + send 5-8 personalized emails).

14. **Resend quota / plan upgrade decision** — May 5 backfill + product update broadcast likely blew through Resend free tier's 100 emails/day cap. Some product update emails may not have left.
   - Action: open Resend → Sending tab → filter to today, count delivered vs rejected/failed. Identify any product update sends that did not deliver and queue them to resend tomorrow (after midnight UTC quota reset) or after a plan upgrade.
   - Decision: stay on free + spread sends across days OR upgrade to Resend Pro ($20/mo, 50,000/mo cap). At current scale upgrade probably not yet needed but worth deciding before next big outreach.
   - Effort: 15 min audit + decision.

15. **Future consideration: replay any product update sends that failed** — depends on outcome of fire #14. If specific dormant signups did not receive the product update due to quota exhaustion, queue a re-send tomorrow with same content. Do NOT re-send to those who did receive (would be a duplicate spammy email).

## TIER S — DISTRIBUTION (do this week, not products)

**Context:** Distribution is the unsolved problem, not product. The May 1-2 FB Massage Therapists Community thread surfaced an active shopping conversation where therapists are LITERALLY asking "MassageBook vs Vagaro vs Noterro" right now. Pricing pain is dominant ("MassageBook just raised prices, very disappointing"). Free Bronze tier is the answer to a question they're asking out loud. These items are about being present in those conversations, not building more product.

### S1. FB-comment template for shopping threads
**Why:** HK is already commenting in software-comparison threads. Standardize the response so each comment takes 60 seconds, lands the same way, and reads as helpful (not promotional).
**Build:** Three-sentence template saved as a snippet:
1. Lead with empathy ("Totally hear the MassageBook pricing frustration. We've been tracking this in the community.")
2. One specific differentiator (free Bronze tier + visual body map intake; never deflate someone else's choice)
3. Soft CTA (link to /comparison or /why-bodymap, not /signup)
Plus a "do not say" list: don't slam other tools, don't repeat the link in multiple comments in same thread, don't reply within seconds (looks like a bot).
**Effort:** 30 min (write template + create swipe file in Notes)
**Status:** Queued

### S2. Daily 15-min FB sweep
**Why:** Anonymous participant's "Vagaro vs MassageBook vs Noterro" thread had 30+ replies. Being one of the first 5 helpful comments is high-leverage real estate. Time-sensitive: most threads die after 24 hr.
**Build:** HK commits to a daily 15-min slot (suggest: morning coffee). Open Massage Therapists and Bodyworkers Community + similar groups. Scan for "what software," "MassageBook problem," "just rented space," "no ad budget." Comment on each within 6 hr of original post using S1 template.
**Effort:** 15 min/day, indefinite
**Tracking:** Note in a journal which threads converted to /comparison or /signup visits (server-side referrer tracking).
**Status:** Operational habit, not a code build. Just a commitment.

### S3. "Just rented a space" landing page
**Why:** Vicky L's original post is the universal LMT story: 20 years experience, just rented, anxious, no ad budget, doesn't know niche. The community reply thread is the freest market research possible — 30+ pieces of advice, with Google Business Page repeated 8+ times. This archetype is HK's exact ICP.
**Build:** New landing page at /just-rented-a-space (or /new-practice). Opens with that emotional hook. Walks through:
- Free Bronze tier (no ad spend needed)
- Google Business Page tactic (community's #1 advice)
- Referral system (community's #2 advice)
- The "5 things free that grow a practice" checklist
- Closes with "Sign up takes 2 minutes" (now truthful post-A0)
This is the page HK links in FB comments to that specific archetype.
**Effort:** 2-3 hr
**Files:** `src/pages/JustRentedSpace.jsx`, route in App.js, link from /comparison + /why-bodymap
**Status:** Queued

### S4. /comparison page surface Vagaro/Mindbody positioning
**Why:** Sasha Gong's reply in the thread was effectively a Vagaro sales pitch ("1.5-2% on overall sale, $10/mo daily deals, great for tax filing"). She's selling Vagaro better than Vagaro does. Don't fight Vagaro on multi-staff salon ops; redirect — Vagaro is great if you run a salon with chairs and product retail. MyBodyMap is for therapists who want intelligence-driven retention. Reframe.
**Build:** Add a "Best fit for" line per platform on /comparison, written as specific use-case statements:
- Vagaro: "Multi-staff salon, retail-heavy, packages-driven"
- Mindbody: "Multi-location studios, classes, enterprise needs"
- MassageBook: "Solo + small clinic, broad massage features"
- Noterro: "Clinical/medical massage, insurance billing"
- MyBodyMap: "Solo + small practice, retention-first, body-map intelligence"
**Effort:** 1 hr
**Files:** src/data/comparisonData.js (add `bestFor` field), src/pages/Comparison.jsx (render in card header)
**Status:** Queued

### S5. The "$0 ad budget playbook" blog post
**Why:** The FB thread is a gold mine of community wisdom. Compress it into a single canonical post, weave MyBodyMap in as the underlying platform without making the post about MyBodyMap. SEO compound interest, organic share-ability, builds Bo Ma authority in the niche.
**Build:** Blog post at `/blog/no-ad-budget-playbook` (or similar). Sections:
1. The reality (no money to advertise, just rented space)
2. Google Business Page setup (community-recommended, MyBodyMap auto-syncs booking link)
3. The referral system (free massage in exchange for 2 referrals — pattern from the thread)
4. Local FB group presence (the community's organic growth playbook)
5. Apartment building flyer drop (Julie Rattelmueller's tactic)
6. Chamber of commerce + local business cards
7. The retention math (one $90 client retained = $1,080/year; one ad spend that converts = $90 once)
Closing soft CTA: free Bronze tier on MyBodyMap.
Paraphrase the thread, never quote (copyright safety). Joy persona voice.
**Effort:** 90 min draft + 30 min HK edit
**Files:** New `src/pages/blog/NoAdBudgetPlaybook.jsx` or a static markdown route
**Status:** Queued

### S6. Two more blog posts from the same thread
**Why:** One thread, three posts. Compound content from the same source.
**Builds:**
- "What 30 therapists told us about Google Business, referrals, and FB groups" (community wisdom roundup)
- "Software shopping for solo LMTs: what therapists actually say" (paraphrased consensus, links to /comparison)
**Effort:** 90 min each
**Status:** Queued behind S5

## TIER A — ship in next 2-4 weeks (highest leverage)

### A0. Smart defaults at signup *(was Phase 2)*
**Why:** New therapists arrived at a blank Settings page and bounced. Now they land 80% configured and the "Up and running in 2 minutes" marketing claim is truthful.
**Status:** ✅ SHIPPED (commit `27326c70`, May 2). Auto-seeds 3 services, Mon-Sat business hours, 5 add-ons, 5 memberships, 5 packages on every new therapist row. Idempotent + non-blocking. Wired into all 3 signup paths (regular email, Google paid, Google free Onboarding). New module: `src/lib/seedDefaults.js`.

### A5. Google Business Page integration *(from FB community thread May 1-2)*
**Why:** Community's #1 advice for "no ad budget" therapists, repeated 8+ times in the thread ("Get on Google. Free. Highest-leverage tactic"). Therapists already know they need it but find the setup intimidating. We can solve that. Also benefits MyBodyMap directly: their MyBodyMap booking link becomes the "Book Now" button on Google.
**Build:**
- Settings card "Connect Google Business" with a guided 4-step checklist (Claim → Verify → Add booking link → Add hours)
- Deep links to Google's setup wizard for each step
- Field for therapist to paste their Google Business Profile URL once claimed
- Auto-include the Google link in booking confirmation emails ("View us on Google" footer)
- Phase 2 (later): auto-pull Google review count + rating into therapist's MyBodyMap profile
**Effort:** 3-4 hr for Phase 1 (the checklist + URL field + email integration)
**Files:** New SettingsCard component, addition to therapist row schema (google_business_url), edge function update for booking confirmation template
**Status:** Queued, HIGH PRIORITY (biggest perceived value-add from the FB thread)

### A6. Referral rewards system *(was queued as feature 7.5; now elevated)*
**Why:** Multiple variants of this in the FB thread: "free massage in exchange for 2 referrals," "10% off referrals," "$5 per referred friend." Therapists are doing this manually with sticky notes. Build it natively. Speaks to the universal "no ad money, need referrals" pain.
**Build:**
- Each client gets a unique referral link from their MyBodyMap account view
- New client signs up via that link → both parties tagged
- Configurable reward (% off / $ off / free service / free add-on) applied to next booking automatically
- Therapist sees referral chain in client view
- Optional: Joy auto-sends thank-you email to the referrer
**Effort:** 4-5 hr
**Files:** new `referrals` table, BookingPage referral source detection, client view referral link UI, Settings reward config
**Status:** Queued, elevated priority

### A7. Welcome flyer auto-generator *(from FB community thread)*
**Why:** Julie Rattelmueller's reply: large apartment buildings give a welcome folder to new tenants with local business flyers. Brilliant zero-cost tactic. We can't automate the flyer drop, but we CAN generate the flyer.
**Build:**
- "Generate marketing flyer" button in Settings
- Auto-generates a printable PDF with: therapist photo + name, 2-line intro, 3 services + prices, booking QR code, address, phone
- Uses the same brand tokens as the rest of the platform (cream + forest, Georgia serif, leaf illustration)
- Therapist downloads, prints at home, drops at apartment buildings + cafes + chiropractor offices
- Effort: 5 min for therapist. Marketing leverage: huge.
**Effort:** 2-3 hr
**Files:** New edge function `generate-flyer-pdf` (or client-side PDF via jsPDF), Settings card UI, downloads to /mnt/user-data/outputs equivalent in browser
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

### B7. "Find your niche" guided wizard *(from FB community thread)*
**Why:** Vicky L's original post: "I can do a lot of modalities so I sort of get lost when I have to think of a target group." Barb Goodwin-Stewart's reply was gold: "Your niche isn't modalities. It's a community of people with similar issues and demographics." We can build that exact insight directly into the product.
**Build:** 5-question wizard inside Settings (or as part of Onboarding):
1. What conditions do you most love treating? (multi-select)
2. What demographics show up most? (women 30-50 / new moms / men's sports / older adults / etc)
3. Where in your community are these people? (yoga studios / chiros / corporate offices / etc)
4. What's a result you've seen 3+ times that surprised you?
5. What would you turn down if you could?
Output: a one-paragraph positioning statement the therapist can paste into:
- Google Business description
- Facebook page bio
- Instagram bio
- Website "About" section
Example output: "I help women in their 40s and 50s navigate perimenopause through targeted myofascial release and Swedish massage. Most of my clients come to me for sleep issues and tension headaches and stay because the work makes a real difference."
**Effort:** 5-6 hr (wizard + output template + Claude API call to generate paragraph)
**Files:** New `src/components/NicheWizard.jsx`, Onboarding step optional, Settings card
**Status:** Queued

### B8. Per-therapist SEO landing pages *(growth loop)*
**Why:** Multiple therapists in the thread asked about SEO. Each MyBodyMap therapist already collects services + location + bio. Auto-generate indexable per-therapist landing pages = free SEO boost for every paying user. Hidden growth loop: more pages indexed → more therapists discoverable on Google → more sign-ups.
**Build:**
- For every therapist with a complete profile, generate `mybodymap.app/[slug]/[service]` pages
- Each page is server-rendered with: therapist bio, location, the specific service, price, booking link, photo
- Robots.txt + sitemap.xml include all such pages
- Schema.org LocalBusiness markup for Google indexing
- Title/meta tags optimized: "Deep Tissue Massage in Houston, TX | Joy Smith - MyBodyMap"
**Effort:** 3-4 hr (sitemap generation + dynamic page route + SEO schema)
**Files:** New dynamic route `/[therapist]/[service]`, sitemap generator edge function, robots.txt update
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

### C6. Client risk flags / safety screening *(from FB thread - LaVonna's safety thread)*
**Why:** LaVonna Gates Mills mentioned she doesn't take male clients without a referral because Google/Yelp brought her "happy ending" inquiries. This is a SAFETY pain we don't currently address. Real for solo female LMTs especially.
**Build:** Therapist-toggleable flags inside booking approval flow:
- "New client with no referral source" → flag for manual approval
- "Booking notes contain suggestive language" → keyword filter (massage industry trained list) flags for approval
- "Phone number in flagged carrier prefix list" → optional, configurable
- All flags surface as "review carefully" badges in pending booking queue, not auto-decline
**Effort:** 4-6 hr
**Risk:** False positives could decline legitimate male clients. Build with restraint and an explicit override.
**Status:** Capture for now. Don't build without significant product strategy first.

### C7. "We don't gatekeep modality" positioning *(from FB thread)*
**Why:** The thread surfaced wide modality fragmentation: tantric massage, RAPID NeuroFascial Reset, hypnotherapy, retreat-style sessions, energy bodywork. Salon-shaped competitors (Vagaro, GlossGenius) struggle here. MyBodyMap can adapt because we use generic services + custom names.
**Build:** Add a single line to /comparison + /why-bodymap: "Whatever you practice, we adapt. Tantric, RAPID, energy work, retreat sessions, hypnotherapy. We don't gatekeep modality."
**Effort:** 30 min copy + placement
**Status:** Queued

### C8. Cash discount toggle on booking page *(from FB thread - payment processing pain)*
**Why:** The Dawn Hyde thread on payment processors had 30+ replies. Multiple therapists offer cash discounts, charge processing fees back, or refuse cards entirely to keep margin. We can let them surface this at booking time.
**Build:**
- Settings toggle "Offer cash discount?" → input cash discount % (default 5%)
- Booking page shows: "Pay $90 cash or $95 card" at checkout
- Booking record stores `payment_intent: cash | card` so therapist knows what to expect at session
- Stripe Connect Express flow only fires for card payments
**Effort:** 2-3 hr
**Files:** Settings card, BookingPage.js checkout step, bookings table column
**Status:** Queued

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
- Comparison page at /comparison (gated from nav until HK approves) + 60-row community sheet starter data → THIS COMMIT
- Campaigns demo video live: 30s walkthrough with music → `e2b01825`
- Service + add-on descriptions: tap-to-edit in Settings, surface on booking page (Leela request) → `65357cfa`
- Campaigns landing page at /campaigns + Features card 5.0 → `23948b35`
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

   **POSITIONING — applies to ALL customer-facing copy. Drift is a recurring failure mode; check every post against this list before sending.**
   - **NEVER intermingle MyBodyMap with HK's real identity.** This is a hard rule, not a preference. HK cannot be associated with MyBodyMap publicly due to employment constraints. All customer-facing surfaces (email signatures, blog bylines, social posts, FB comments, DMs, podcast appearances, conference talks, press, case studies) operate ONLY under **"MyBodyMap"** (the platform/team voice as "we") or "Joy" (in-product email signoff). Never HK's real name, initials, photo, IBM affiliation, MBA credential, UT Austin reference, or any biographical detail that could trace back. Email signoffs: "The MyBodyMap Team" or "Joy". Founder dashboard sends: same. **The "Bo Ma" persona is RETIRED as of May 2026** — HK was banned from Massage Therapy Business Builders FB group for posting too much under that name; admin is being worked, but Bo Ma is no longer used going forward. Consequence: never sign anything as "Bo Ma" or refer to a person at MyBodyMap. Always "we" / "the MyBodyMap team" / "MyBodyMap". HK's personal accounts never touch product work. A single slip here is a real-world risk; treat as P0.
   - **Always "we", never "I".** "I am building" reads as one-person side project; no business owner trusts client data to a single person. We built. We make. We help. Plural voice signals real platform.
   - **Never "small platform" or "small tool" or any size-diminishing adjective.** Kills marketing interest and signals scrappiness. MyBodyMap is a platform, period. Size adjectives are forbidden.
   - **"Tool" is forbidden. "Platform" only.** (Already in copy standards but worth restating because it gets dropped under pressure.)
   - **Never lead with "free" in marketing copy.** "Free to start", "free Bronze tier", "no card needed" all read as desperation when leading. Bronze tier is real, but it's a feature mentioned mid-copy or later, never a hook.
   - **No "we just launched", "we're new", "early days", "scrappy", "indie", "side project", "in stealth", "MVP", "young company".** All diminish. Position as established and intentional.
   - **Retention-first framing** for every benefit statement. Not efficiency. Not productivity. Not time-saving as a primary frame. The frame is: clients keep coming back, sessions feel more present, relationships deepen.
   - **Ask language for support posts: "share with a therapist you know"** — never "follow our page", "support a small business", or "give us a chance". Ask for a referral, not a charity.

   **HK VOICE PATTERNS — for FB comments / DMs / community responses where HK speaks as MyBodyMap:**
   - **Address by name first.** "@Kellie @Jessica" or "Hi Jessica and Kellie" before any content. Peer-to-peer, not broadcast.
   - **Acknowledge the pattern, not just the person.** "Since this keeps coming up in the MT/LMT community" or "this comes up a lot from solo practitioners" signals listening over selling.
   - **Concrete commitment with timeline.** "My team will build this week, ideally in the next 24 hours" beats "we're working on something soon." Confidence + specificity.
   - **Frame as hypothesis, invite correction.** "Here is what I think you are looking for: [list]" then "anything else?" The reader becomes a co-creator, not a target.
   - **Comma-flow lists for concrete features.** "Logo, business name, expiry, code, amount and a personal note" reads natural. Avoid bullet lists in FB comments — too formal.
   - **Open-ended close, repeated softly.** "Anything else let me know...anything else you would like to see?" The repetition lands as warmth, not sales pressure.
   - **Lowercase casual where appropriate.** mybodymap.app, my team, the feature. Not THE FEATURE or YourBrand™.
   - **Ellipses for pacing**, sparingly. Three dots = a pause that invites a reply. Don't overuse.
   - **Use "my team" not "we"** when speaking on behalf of the build org in community comments. Reads as a real human leading a team, not a faceless brand. (In product copy and emails, plural "we" still applies — these are different surfaces.)
   - **Never say "DM me" or "email me at..."** — keeps the conversation public so other therapists with the same pain see the answer.

   **PERSONA — applies to ALL customer-facing copy (FB comments, emails, SMS, in-product, marketing, blog posts):**
   - Audience is a 70-year-old grandma LMT. Tired. Tech-cautious. Skim-reading on phone.
   - **5-10 sentences max** for any FB comment, DM, or email body.
   - **~10 words per sentence** average. Short. Clear. Plain words.
   - **Empathetic first.** Recognize the moment before recommending anything.
   - **Not salesy.** No "game-changer," no "level up," no urgency, no exclamation marks beyond one per message.
   - **One soft CTA, not two.** Pick comparison link OR signup link. Never both.
   - **No jargon.** No "platform-powered," "intelligence layer," "AI-driven." Say what it does in human words.
   - **Don't name competitors unless directly asked.** No comparing, no minimizing, no "X is fine if..." Stay focused on what we offer. The poster doesn't need our take on other tools.
   - Reading-level test: a 70-year-old grandma should understand every sentence on first read. If she'd squint, rewrite.

8. **Minimum-click principle. Apply to every flow, every screen, every feature.** Minimum clicks, minimum scrolling, minimum process steps, minimum cognitive load. If a user has to submit twice, scroll past explanation, or wonder "what now," the design has failed. Ask before building any flow: "How many taps from start to done? Can it be fewer?" This applies retroactively to anything we ship. Two-step flows that should be one-step flows are bugs.

9. **Every new feature lands on Home + Features page within the same ship.** A feature that exists in the dashboard but isn't visible to prospects on the marketing pages is invisible to growth. Hard rule, no exceptions.

   **The flow:**
   1. Build the feature in product
   2. Confirm marketing surface plan with HK before writing copy: which Features category it slots into (taxonomy stays the 7 we have), which ribbon on Home, what visual asset
   3. Add to Features page in the right category, with a similar visual style to the existing rows in that category
   4. Add to Home page as either a new ribbon or as a sub-item under an existing ribbon
   5. SVG with subtle animation on Home (matching the existing PatternDemo / AutomationHub / CampaignsDemo aesthetic). Ask HK to provide a reference picture if there's an existing brand visual that should match
   6. Both pages updated in the same commit as the feature ship, never deferred to a later session

   **Taxonomy is locked.** Seven categories: (1) Find & Book, (2) Know Your Client, (3) Client Intelligence, (4) Day-of-Session, (5) Relationships, (6) Money & Protection, (7) On Your Phone. New features fit into existing categories; do not invent an eighth category without explicit HK approval.

   **Why this rule exists:** Distribution is the unsolved problem, not product. Every feature that doesn't land on the marketing surface is invisible to the people who would pay for it. Shipping the dashboard work without the marketing work is the failure mode that's been recurring; this rule closes it.

9. **Never use `git add -A` or `git add .`. Always stage explicit file paths.** Container starts fresh each session, `npm install` modifies `node_modules`, and a wildcard add will pull thousands of dependency files into the repo. Stage every change by its full path: `git add src/pages/Dashboard.js src/components/StatsStrip.js`. The `.gitignore` already excludes `node_modules/` as a backstop, but the explicit-paths rule is the primary defense.

10. **Payment reconciliation feature (DESIGN, not yet scoped).** Therapists need an honest answer to "did I actually get paid for the work I did this month?" It is a real anxiety from the FB community threads — money disappearing into Stripe/Square dashboards therapists do not check. The platform sits in a unique position: we know every session that happened (from bookings table), every payment that should have happened (from cancellation policy + service prices + memberships + packages), and every payment that did happen (from Stripe and Square verification). Comparison gives the therapist a reconciled view they cannot get from either processor alone.

   **Proposed shape (rough):**
   - New tab in Billing dashboard: "Money this month" with three columns: Sessions Done · Should Have Earned · Actually Received
   - Per-session row showing: client name, date, expected amount, actual received, status (paid / pending / waived / refunded / disputed)
   - Discrepancy alerts when expected ≠ actual: client paid less than session price, deposit not collected, recurring membership payment failed silently, refund exceeded original
   - Monthly summary: total expected, total received, gap, plus drilldown
   - Export to CSV for accountants

   **Belongs in:** ribbon 6 (Money & Protection) as 6.1.x or as a major card. Probably 6.1 itself gets expanded since "Billing dashboard" already lives there but currently only shows what came in, not what should have come in.

   **Build cost:** ~3-5 days. Major piece is the reconciliation logic — joining bookings + memberships + packages + cancellation_charges + payment verification across both processors. Schema additions probably trivial since most data exists.

   **Demand signal:** raised by HK from Katelynn DM thread about bank-direct payments (May 7, 2026). Add to demand log when other therapists ask similar "where did my money go" questions.

   **Trigger to scope properly:** Q3 2026, after at least 30 days of production data on Stripe + Square parity. Need real session volume to make reconciliation meaningful and to find edge cases (partial payments, retroactive refunds, gift cards used as session credit, etc.).

11. **Alternative payment methods mockup at `/mockups/payment-methods`** — internal design artifact. Three side-by-side mockups (ACH via Plaid Link, Zelle/FedNow push, Apple Pay/Google Pay) with stage tabs for walking through each flow. Built so HK can show therapists asking "can I use my bank instead" a real visual instead of just words. Not linked from public nav. Not yet built into product. Deferred to Q3 build alongside payment reconciliation work above.

## REFERENCE FILES IN REPO
- `BLOCK_PLAN.md` — this file. Always update when shipping or adding ideas.
- `docs/email-voice-guide.md` — canonical email broadcast voice guide. Joy persona, structure, hard rules. Reference this BEFORE drafting any broadcast template.
- `research/noterro-competitive-analysis-2026-04.md` — full Noterro deep-dive
