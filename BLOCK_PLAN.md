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

### TOP PRIORITY (Jun 3 2026)

**TODAY: Square works end to end for Jacquie.** She is Square only (no Stripe), keeping deposits ON, turning on the QR for online booking. Verify the Square payment workflows her clients and she will hit first, in priority order, including notifications. Step by step with HK. Plan: (1) connection health so her token is not stale, (2) online booking with a Square deposit via the QR, (3) confirmation plus new booking notifications to both client and therapist, (4) at session remainder charge via Square, (5) cancellation, no show, and refund via Square, (6) card on file if her policy needs it.

**PRIORITY BLOCK 1: Event consent uploads, Phase 1.** Reuse existing schema. An `events` row per chair event (add a nullable `kind`, 'class' or 'field'). Each photographed consent stored as a `waiver_signatures` row with a new nullable `event_id`, `client_id` left null, `pdf_url` set to the image, in a PRIVATE storage bucket (RLS plus signed URLs). Mobile first batch camera upload with compression and retry. No per person mapping in Phase 1 (solves Ashley's literal ask). Lay the Phase 2 and 3 rails now (event_id nullable, dedupe ready, the image is the legal record). Phase 2: vision OCR fills name, email, phone onto the consent row plus a batch review screen. Phase 3: promote to a client on rebook (dedupe by phone or email), surface in Practice Pulse, invite to book. HK thinks Phase 1 may be easy. Build right after today's Square verification.

1. **Twilio setup in progress** — HK has authorized investing. Step-by-step in the Twilio dashboard tonight. After purchase + creds, he will plug in to MyBodyMap and broadcast to 23 textable users.
2. **A2P 10DLC registration** — required for US production sends. Sole proprietor low-volume path. ~$4 brand fee + $10/mo campaign. 1-3 business days approval.
3. **Mass broadcast pending** — wait until Twilio number provisioned + 10DLC approved before sending to all 23.
4. **Notify Leela** — booking approval + intake-before-booking gates AND the new service/add-on description fields she just asked for are live. Joy DM ready when feature ships.
5. **Notify Regina** — campaigns demo page is live at /campaigns. After CapCut video is embedded, share the URL on the FB thread or DM directly.
6. **Campaigns demo video** — HK is making a CapCut version with music (Supademo paywalled audio). When ready, swap `DEMO_EMBED_URL` (iframe) or `DEMO_MP4_URL` ('/videos/campaigns-demo.mp4') in `src/pages/Campaigns.jsx` to flip placeholder → live video.
7. **Ashton's medical massage photo storage** — deferred. HK wants to think through HIPAA implications first. Sketched 3 paths in chat (per-session / per-client timeline / both) plus consent flow + signed-URL storage. Revisit after Twilio.
8. **Desktop 2-column intake layout not visible at user's viewport** — shipped responsive grid (`repeat(auto-fit, minmax(300px, 1fr))`) in commit `ab625fa5`. HK reports desktop still showing 1 column. Might be: (a) viewport is being constrained somewhere we missed, (b) max-width 940 is too narrow combined with min 300 = 940/300 = 3 columns possible but auto-fit collapsing to 1 due to other constraint, (c) HK's monitor was actually below 600px width when tested. Investigate by checking PrefScreen render width with DevTools, possibly tighten min from 300 to 280 to make 2 columns fire earlier. Lower priority since smart defaults + chips render are the bigger UX wins.

9. **Booking-detail two-column rebuild (Jun 2 2026): Steps 1-5 shipped, pending HK verify.** Desktop page rebuilt to the approved mockup. Rollback tag `stable-before-2col` = `ddd4ece4`. Shipped: Step 1 cadence/insight + booking-note to left box (`51bfdeed`); visual cleanup (`077f691a`); Step 2 right-column ACTIONS card with Checkout on top (`1e53a8fd`); Step 3 shared SetupCard for intake + agreement sends (`22cd7e5a`); Setup hard-confirmation redesign with persistent Sent badge + silenced Saved toast (`19b8c9d0`); polish pass: page padding, intake-received stamp on left, Notes restructured, SetupCard always shows both rows (`e886db14`); Step 5 edit pencils on the left via React portal of the existing time/service editors, no edit-logic change (`ec868a7f`). Editors keep the paid-session refund guard + day conflict check. NEXT: HK to verify save on a paid and an unpaid booking. Then a desktop visual-polish pass (Where/Price moved off the left SESSION rows when the date card was hidden; confirm nothing important is lost) and the mobile pass (item 10).

10. **Mobile book-next is wired wrong (pre-existing, fix in the mobile pass).** On the booking-detail page in MOBILE width, the panel's "Book next session" button calls `onReschedule({ ...appt, isRebook: true })`, but the page wires `onReschedule` straight to a `mode="reschedule"` `BookingModal`, which MOVES the existing booking instead of creating a new one (BookingModal keys rebook off `mode === 'rebook'`, not an `isRebook` flag on the booking). Desktop is already fixed (Step 2 ACTIONS card uses a real `mode="rebook"` modal via `rebookAppt` state). Mobile still needs the same fix: give the mobile/panel book-next its own rebook path. Not urgent (desktop is the live focus) but must not be lost.

11. **Client login via magic link (PRIORITY — recurring customer ask, Jun 2 2026).** Multiple therapists (Ashley/Puro Glow, others) keep asking for an OPTIONAL client account so clients do not re-enter their info every booking and can see their own upcoming sessions, package/membership balance left, and visit history. No-login guest booking stays as-is (still a selling point). The mechanism is passwordless: Supabase Auth magic link / email OTP. Client enters email, gets a link, lands on a lightweight client portal that (a) pre-fills the booking form from their saved profile, (b) shows next appointment + package/membership balance + past visits. Previously sketched with HK (magic link) but never acted on. Scope to define: portal routes, what the client can see/edit, how it maps to the existing clients row, and whether to gate any of it. Build after the Square reconnect fix.
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

16. **AI-suggested growth moments based on client demographics (HIGH-VALUE)** HK May 27 2026: "We notice 40% of your clients are women 35-55. Mother's Day is May 10. Want to send them a 20% gift card discount?" This is the canonical example of where calendar moments, client intelligence, and outreach intersect. The seed ships in Commit 2 (May 27 calendar build): the calendar marks ~20 known growth moments per year (Mother's Day, Father's Day, Valentine's, graduation week, back-to-school, marathon weekends in major cities, Black Friday, summer solstice, etc.) with a small star icon and a placeholder popover "Coming soon: AI-suggested campaigns based on your client base."

   **What needs to be built (estimate: 8-12 hours, multiple sub-features):**

   a. **Client profile enrichment.** Extract demographic signals from existing data:
      - Age bracket from intake form (already collected)
      - Gender from intake form (already collected)
      - Children mentioned in intake or SOAP notes (keyword detection)
      - Profession mentioned (parent, teacher, runner, student, etc.)
      - Location (zip code → city → known event proximity like NYC Marathon)
      - Session pattern (frequent regular vs. occasional)

   b. **Growth-moments calendar.** Static array of ~20-30 dates with:
      - Date
      - Audience filter ('mothers', 'fathers', 'parents-with-school-age', 'runners-nearby', 'graduating-students', 'all')
      - Suggested campaign template
      - Suggested timing window (e.g. "send 3 weeks before")

   c. **AI nudge generator.** Background job runs weekly per therapist:
      - For each upcoming growth moment in next 30 days, compute filtered client list
      - If filtered list size > N (configurable threshold, default 5), generate a nudge
      - Surface nudge in Insights panel: "Mother's Day in 3 weeks. 47 women aged 30-55 in your client list. Tap to draft a gift card promo."
      - Pre-fill outreach composer with template + audience

   d. **Outreach composer integration.** When therapist taps "draft this", outreach modal opens with audience filter pre-applied, template loaded, send button ready.

   e. **Tracking.** Did the therapist act? Did the campaign generate bookings? Loop closed → smarter future suggestions.

   **Dependencies before this can ship:**
   - Client tagging system OR keyword detection on SOAP notes (we have session intelligence already, so option 2 is faster)
   - Outreach composer template system (we have outreach already)
   - Insights panel surface (we have Schedule cockpit rail already)

   **Why this is a strategic moat:** competitors send generic broadcast emails. We send precisely-targeted promos based on actual client intelligence the therapist already collected. No other platform combines longitudinal body intelligence + demographic enrichment + holiday calendar in this way. This is the "MyBodyMap thinks for you" promise made concrete.

   **Status May 27 2026:** seed UI shipping in Commit 2 (calendar marks the dates, popover says "coming soon"). Full feature parked here until distribution traction warrants the build.

17. **Schedule load perf (instrumented May 27 2026).** HK reported Schedule taking minutes on multiple connections. Real numbers from one therapist (Joy demo, 595 bookings, 234 sessions, 2 blocked days):

    ```
    auth.getUser: 463ms
    bookings query: 502ms (595 rows)
    sessions query: 1250ms (234 rows, IN with 595 ids) LARGEST
    session_payments query: 312ms (6 rows)
    external_calendar_events query: 129ms (0 rows)
    fetchBookings TOTAL: 2.7s
    loadBlockedDays: 622ms (2 rows) HIGH FOR ROW COUNT
    ```

    Findings:
    - The `.in('booking_id', [...595 ids])` sessions query is the largest bite (1.25s). Switching to a subquery or therapist_id-scoped fetch may be cleaner.
    - loadBlockedDays takes 622ms for 2 rows. Pure network round-trip. RLS may be evaluating policies per-row.
    - Total of 2.7s is real but not "minutes" as initially reported. Possible the user-perceived "minutes" includes JS bundle parse, initial route hydration, or an earlier slow render path no longer present.

    Fixes to evaluate (in order of likely impact):
    a. Replace `sessions.in('booking_id', [ids])` with `sessions.eq('therapist_id', t.id).gte('booking_date', past).lte('booking_date', future)` and join client-side.
    b. Parallelize sessions + session_payments + external_calendar_events instead of awaiting sequentially.
    c. Add composite Postgres index `(therapist_id, booking_date)` on bookings if not already present.
    d. Investigate loadBlockedDays 622ms for 2 rows: index check on `(therapist_id, date)`.
    e. Move all schedule data fetches to a single RPC that returns shaped data so the client makes one round trip instead of 4.

    Out of scope today. HK to confirm whether the perceived "minutes" still happens after deploy or whether 2.7s matches reality.

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

11. **Alternative payment methods mockup at `/mockups/payment-methods`** — internal design artifact. Three side-by-side mockups (ACH via Plaid Link, Zelle/FedNow push, Apple Pay/Google Pay) with stage tabs for walking through each flow. Built so HK can show therapists asking "can I use my bank instead" a real visual instead of just words. Not linked from public nav.

   **DECISION (May 7, 2026):** Drop ACH entirely. Phase 1 (Apple Pay / Google Pay via Stripe Payment Element wallet methods, ~1 day) and Phase 3 (FedNow real-time push when merchant webhooks land in 2027) only. Reasoning: ACH liability is real (60-day return window, dispute exposure, NSF returns), customer benefit marginal at $100 ticket size, and Phase 1 is near-zero-liability work that handles the demographic split (younger users get wallets, older users keep cards) automatically via Stripe's per-customer surfacing logic. Phase 3 has lower liability than ACH because FedNow transfers are final on send.

   Companion mockup at `/mockups/payment-evolution` shows how the same booking page UI evolves across all three phases with three different customer personas (70yo desktop, 30yo iPhone, 40yo Android). Proves the demographic split is handled correctly without making the UI more complex for the 70-year-old persona.

12. **Founder Hub at `/founder`** — internal single pane of glass for HK. Ten sections: marketing for therapists, marketing internal, billing strategy, block plan, taxonomy (summary + detail), client dashboard, email/SMS edits, catch-all docs, founder runbook, future RAG chat. Gated to HK's email only via FounderRoute. **Phase 1 (May 7, 2026):** skeleton + runbook embedded live, GitHub-sourced docs (Block Plan, Taxonomy) link out, marketing/billing docs marked "next session," chat marked "future." **Phase 2 (next session):** wire BLOCK_PLAN + FEATURES_TAXONOMY.md markdown rendering, split marketing into therapist-facing and internal docs, embed email/SMS editor from Dashboard. **Phase 3:** RAG chat interface using all founder docs as corpus.

   Live-document model (per HK direction): documents update at the end of each working session triggered by HK saying so. No nightly automation.

13. **Practice Assistant rate limit (decided May 7, 2026).** The in-dashboard chat (formerly "MyBodyMap Platform," renamed to "Practice Assistant" because the whole site is the platform) is now capped at 10 questions per therapist per month. Implementation: `ai_usage_monthly` table in Supabase, edge function returns 429 when cap reached, client UI shows usage counter and disables input at limit.

   **Why now:** pre-revenue beta. Therapists on free Silver could otherwise drive unbounded API cost. Each question is roughly $0.03 on Haiku 4.5; 10 questions per therapist per month = $0.30 ceiling per therapist regardless of behavior.

   **Trigger to revisit:** when Silver and Gold tiers convert to paid. At that point:
   - Silver paid ($19/mo): bump cap to 20-30 questions/month
   - Gold paid ($49/mo): bump cap to 50-100 questions/month or unlimited
   - Founders grandfathered at whatever cap they have when their tier converts

   **Open questions for future revisit:**
   - Should public-mode chat (marketing demo, not authenticated) be IP-rate-limited to prevent abuse?
   - Should we add per-session rate limits in addition to monthly to prevent burst usage exhausting the cap?
   - Should the cap reset model be calendar-month or rolling 30-day?
   - Once usage data accumulates, recalibrate based on actual usage patterns rather than guesses.

14. **Customer service chat (NEW, scoped May 7, 2026).** Distinct from the Practice Assistant. Lives bottom-right of every public marketing page AND inside the dashboard for support questions. Anyone (signed in or not) can ask questions about MyBodyMap (how do I use cancellation policy, how do I connect Stripe, what does Silver tier include). Answers grounded in the founder corpus. Strategy detailed below in this BLOCK_PLAN entry. Build target: next session.

   **STATUS UPDATE May 7:** Customer service chat shipped as Stage 1 (email-first plus help center, zero cost). Help widget mounted on Home, FeaturesV2, Pricing. Help center at /help with 19 articles indexed via FlexSearch. AI escalation deferred to Stage 2 per CUSTOMER_CHAT_RESEARCH.md trigger conditions (over 30 emails/week, 500+ therapists, founding therapist explicit request, profitable, OR avg response time exceeds 24h).

15. **Anthropic API account verification (HK action item).** HK to log into console.anthropic.com (separate from claude.ai subscription) and confirm:
   - API account exists and is active
   - Payment method on file (credit card)
   - Current month-to-date spend (likely small but worth knowing)
   - The ANTHROPIC_API_KEY currently in Supabase edge function secrets matches an account HK actually owns

   This matters because every Practice Assistant call, every public-mode demo chat, and any future customer-service AI chat hits this account. Without confirmation, we are flying blind on spend.

16. **Founder-chat edge function: decision deferred (May 7, 2026).** There is an orphan supabase/functions/founder-chat/index.ts in repo from an earlier session. Uses Opus instead of Haiku, references stale doc paths (MARKETING_INTERNAL.md and MARKETING_THERAPISTS.md, both deleted in the marketing-merge commit). HK directive May 7: leave it for now, decide later. Two paths when revisited:

   **Path A (delete it):** the email-first plus help-center pattern replaces the use case for HK. Founder Hub already lets HK navigate the docs directly; an LLM chat layer over them is nice-to-have, not essential. Cost to operate would be ~$2-5/mo on Haiku.

   **Path B (fix and ship for HK personal use):** Update the function to use Haiku, fix doc paths to match the new MARKETING_MYBODYMAP.md and MARKETING_THERAPIST_PLAYBOOK.md, gate to FOUNDER_EMAILS allowlist, build a chat UI in Founder Hub Section 10. Cost ~$2-5/mo. Useful for "remind me what we decided about X" queries without scrolling through long docs.

   **Trigger to revisit:** when HK finds himself rereading the same Founder Hub docs more than three times per week, OR when the corpus exceeds 100K tokens and full-context fetch becomes impractical.

17. **Help articles maintenance discipline (NEW, May 7, 2026).** Help center has 19 articles mapped to feature-card taxonomy. When a feature changes, the article(s) tagged with that taxonomy must be reviewed. See docs/HELP_ARTICLES_GUIDE.md for the process.

   **Operational rule:** every commit that meaningfully changes a feature listed in FEATURES_TAXONOMY.md should be paired with (or immediately followed by) a commit updating any help articles tagged with that feature's taxonomy. If the developer is not sure which articles need updating, check the mapping table in HELP_ARTICLES_GUIDE.md.

   **Quality bar to add a new article:** the question genuinely comes up, the existing articles do not answer it, and the answer is not already in the marketing pages. Quality of the corpus matters more than quantity. 19 great articles beat 50 mediocre ones.

18. **"We Moved" email template (NEW, May 7, 2026).** Therapists migrating from Vagaro / MassageBook need to send their existing clients a "we are now using a different system" email. Currently they have to write this from scratch. Build:
   - A template in Settings (where they configure the booking page)
   - Empathetic to both the therapist (this is a vulnerable moment) and the previous platform (no trash-talking competitors)
   - Customizable: the therapist can edit before sending
   - One-tap send to all imported clients (with confirmation step)

   Empathetic framing example: "Hi, [client first name]. Quick note that I have moved my booking and intake to MyBodyMap. Same me, same studio, just a calmer way to book. Your previous bookings and history are with me. Here is the new link: [URL]. If you have any trouble, reply to this email and I will help."

   Also add a 30-second nudge in Settings 1.2 (services area) the first time a therapist completes import-clients flow: "You just imported [N] clients. Tap here to send them a friendly note that you have moved." Optional, dismissable. Builds the migration completion habit.

19. **Onboarding checklist polish (NEW, May 7, 2026).** Trial-to-Active conversion is the biggest funnel leak per MARKETING_MYBODYMAP.md. Square activation is the main blocker. The OnboardingChecklist component exists; needs a polish pass that adds:
   - Clearer, numbered Square activation steps with screenshots if possible
   - A 'Skip Square for now, use Stripe only' pathway so therapists are not blocked by activation friction
   - Better progress indicators (visual, not just checkbox)
   - Plain-English copy on every step (no jargon)
   - A 'I will do this later' state for steps that can wait

   **Design constraint per HK:** do not make it look busy. The checklist already crowds the dashboard for a new therapist. Keep it visually quiet, expandable rather than always-expanded, with one current focused step shown big and the others tucked away.

   **Approach to keep it simple:** show ONE current step at a time, large and friendly. The rest collapse into a small progress bar. Therapist taps the bar to expand the full list when they want to see what is ahead. Default state is focused on the current step.

20. **Booking page polish (NEW, May 7, 2026).** First impression for clients of any therapist. Worth a focused pass:
   - Hero section with clearer therapist branding (photo, business name, specialty)
   - Services display with better hierarchy (most common service prominent)
   - Intake preview so clients know what is coming before they book
   - Cancellation policy displayed cleanly, not buried
   - Mobile-first refinements (most clients book on their phone)

   Therapists share this URL with everyone they meet. Polishing it polishes their professional brand.

21. **Stripe Connect onboarding return state (NEW, May 7, 2026).** When a therapist completes Stripe Connect, they return to MyBodyMap. The current return state is bare. Polish:
   - Clear success state: "You are connected. Here is what is now on."
   - List of features that just unlocked (deposits, card on file, refunds, etc.)
   - One-tap to go to the next checklist step
   - If something is missing (incomplete Stripe profile, pending verification), show that clearly with the specific next action

   Reduces dropout at this step.

22. **Mobile dashboard polish (NEW, May 7, 2026).** Dashboard.js is 2956 lines. Some sections work great on mobile, others (Settings panels, Billing dashboard) are cramped. Targeted pass on the 5-6 most-used mobile flows:
   - Settings panels: stacking, label sizing, tap targets
   - Billing dashboard: revenue chart sizing, transaction list density
   - Client list: search bar always visible, virtual scroll if list is long
   - Session detail: SOAP notes textarea sizing, AI draft button placement
   - Calendar: date picker readability on small screens

   No new features. Just making existing flows feel right on a 375px-wide iPhone for the 70-yo persona.

   **STATUS UPDATE May 7 (commit fc1b2a00):** Billing dashboard mobile polish shipped. StatCard mobile-aware (padding, font sizes, line heights). New StatRow helper produces 2x2 grid on mobile, flex row on desktop, replaces 5 inline stat row containers. Build clean.

   **Remaining for next session:**
   - SessionDetail.js (644 lines, zero mobile awareness): SOAP textarea sizing, AI draft button placement, intake history layout
   - Outreach.js: token row + template selector cramped on mobile
   - Settings: individual sections (custom URL editor, intake editor entry, cycle scheduling toggle) have inline desktop-tuned styles
   - Calendar: date picker readability on small screens
   - Client list: search bar sticky, virtual scroll for long lists

23. **Personalized therapist greeting in dashboard + PWA (NEW, May 8, 2026 from QA).** HK direction: "In the PWA and therapist dashboard, their name should be on top saying 'Hi Sarah' as an example."

   Dashboard top bar currently shows the navigation only. Add a friendly first-name greeting that updates by time of day ("Good morning, Sarah" / "Good afternoon, Sarah" / "Good evening, Sarah"). PWA More tab also gets the same treatment, with full name AND business name visible (HK direction item 4: "it should say therapist name and business name on top of the app when I click on more on the bottom right of app").

   Implementation: pull from therapist.full_name (first name only via split) and therapist.business_name. Time-of-day logic with 5am-12pm = morning, 12pm-5pm = afternoon, 5pm-5am = evening. Same component reused on Dashboard top + PWA More tab.

   Estimated effort: 1-2 hour pass, low risk.

24. **"Save Card" client card flow simplification (NEW, May 8, 2026 from QA).** HK direction: "On Save Card option in clients, it says connect Stripe? Lets keep it simple. Just save the card."

   Current flow: when therapist taps "Save Card" on a client card without Stripe connected, an alert says "Connect Stripe in Settings first." This is correct behavior but UX-hostile. Better: if no Stripe AND no Square, route to Settings#payments with a helpful banner. If Stripe OR Square is connected, just open the save flow without the gate.

   File: src/components/SessionList.js line 34. Replace the alert with a navigate to settings if neither connected, otherwise proceed with the save flow.

   Estimated effort: 30-45 min.

25. **Returning-customer intake recognition for body map (NEW, May 8, 2026 from QA).** HK direction: "Even after saving my card, it is not showing card saved, for body map it is not showing all the sessions that I booked under the name of Body Map with incomplete intake."

   When a client books with the same email/phone/name as previous sessions, the body map (intake history view in dashboard) should show ALL their past sessions and intake submissions, including ones that did not complete the full intake flow. Currently the matching logic is too strict and partial-intake sessions disappear from the timeline.

   This is partly Chunk 2's territory (returning customer recognition) but specific to the body-map intake history view, which is its own component. Investigation needed first to confirm exact symptom; could be a JOIN issue, a status filter, or a client-id-mismatch.

   Estimated effort: 1-2 hour investigation + fix.

26. **Cart persistence across booking flow steps (NEW, May 8, 2026 from QA).** HK direction: "When I added a package to cart and then proceeded to add a service, at confirmation, the cart disappeared."

   The cart state in BookingPage.js is currently component-local. When the user navigates between booking steps (services, slots, services-again, etc), the cart can lose state. Needs persistence either in URL query string (preferred for deep-linkability) or sessionStorage (simpler implementation).

   Investigation: which state variable holds the cart, what step transitions clear it, and is this a hooks dependency bug or an architectural issue.

   Estimated effort: 2-3 hour investigation + fix.

27. **Client card visual indicators (NEW, May 8, 2026 from QA).** HK direction: "In the Clients card, once the deposit is received, the client card does not say anything on Deposit received... There should be a clear indicator on the card. there should be also a clear indicator on the card that their card is on the file. there could be other indicators that they have membership or packages or not on the card itself. and it should be easy to read and tell with both index and text when i hover my mouse over the card."

   Add 4 visual indicators on each client card:
   - 💳 Card on file (green when present)
   - 💰 Deposit paid (per upcoming session, green when paid)
   - 🌿 Active membership (green when active)
   - 📦 Active package (green when sessions remaining)

   Each indicator: small icon + tooltip on hover with detail. Layout: horizontal row beneath client name and tier. Mobile-aware (smaller icons, stacked or wrapping).

   Substantial UX work. Touches the client card component, possibly client list view, definitely needs query expansion to populate the new fields.

   Estimated effort: 4-6 hours focused.

28. **Cancellation/reschedule client-facing flow (NEW, May 8, 2026 from QA).** HK direction: "The workflow for reschedule or cancel is not clear from client side on how they would do it or how that will be done on therapist side. There should be an online mechanism for both client to do it on a link or something. And for therapist to do it if the client calls or texts and cancels or reschedules. there is no cancellation or reschedule link in the email that client receives. This is a big miss on your part."

   Major UX gap. Build:
   1. Cancellation/reschedule link in confirmation email (signed token, 24h expiry)
   2. Public-facing cancel page: shows session details, asks for cancellation reason (optional), confirms policy implications (will I be charged?), processes if appropriate
   3. Public-facing reschedule page: shows session details, picks new slot from same therapist's availability, swaps the booking
   4. Therapist-side cancel/reschedule flow: from session detail in dashboard, tap "Cancel for client" or "Reschedule for client", same modal handles both. Sends client an email confirming what happened.

   This is a real project. Worth a dedicated session, maybe 1.5-2 days. High user-value impact.

   Estimated effort: 1.5-2 days focused.

29. **'Add another' button in packages too small (NEW, May 8, 2026 from QA).** HK direction: "In packages, 'add another' is too small and can get missed."

   Quick fix. The "+ Add to cart" / "✓ In cart (N) · add another" button on package cards in the booking page is small. Bump font size, padding, and possibly use a more visible color when in cart (subtle visual change to suggest "tap me again to add another").

   File: src/pages/BookingPage.js around line 1873. About 10 lines of style changes.

   Estimated effort: 15-20 min.

30. **Demo account needs more clients/appointments (NEW, May 8, 2026 from QA).** HK direction: "In my bodymapdemo login, I need more appointments and clients added as CSV so that I can show proper demos."

   Data-only fix. Generate a realistic dataset for the demo therapist account:
   - 30-40 fake clients with varied first/last names, emails, phones (from a US name generator)
   - Spread of session counts: some 1-time, some 5-10 visits, some 20+ visits with rich pattern data
   - 60-90 days of past bookings with realistic Tuesday/Thursday/Saturday distribution
   - 10-15 future bookings (next 30 days) with mix of confirmed/pending-deposit/pending-approval
   - Some intake forms completed with body-map data (use existing fixture if possible)
   - 2-3 active memberships with renewal dates
   - 4-5 active packages with sessions remaining

   Generate as CSV files, run through the existing import flow, verify the dashboard demo looks rich without obvious patterns of fakeness.

   Estimated effort: 2-3 hours (mostly data generation; import is well-tested).

31. **Memberships/packages section titles in collapsible (NEW, May 8, 2026 from QA).** HK direction: "In the memberships and packages collapsible, we need to have a title for memberships and a title for packages so that our persona does not get confused on what is what. any other ways of adding clarity will be great."

   Add small "PACKAGES" and "MEMBERSHIPS" subheadings in the offers collapsible section on the booking page. Subtle uppercase eyebrow text, sage color, before each group's cards. Helps the older-LMT persona distinguish at a glance.

   File: src/pages/BookingPage.js, the offers expanded view around lines 1830-1920.

   Estimated effort: 30 min.

32. **Memberships should be cart-eligible architecture rework (NEW, May 8, 2026 from QA).** HK direction: "I CONFIRM THAT I AM ABLE TO BUY A MEMBERSHIP PACKAGE USING SQUARE. BUT IT DOES NOT LOOK LIKE AN AMAZON CART EXPERIENCE. IT LOOKS VERY BASIC AND PRIMITIVE IN TERMS OF DESIGN... Why are membership are not cart eligible?"

   Currently memberships bypass the cart and route directly to Stripe Checkout / Square Subscription. This means:
   - Cannot bundle "membership + 2 packages of essential oils + first session deposit" in one transaction
   - First-time experience does not feel like the rest of the cart-based flow
   - Therapist cannot offer membership + add-on bundles

   Architectural decision: make memberships first-class cart items. Implications:
   - PaymentProvider's createCheckoutLink must support mixed cart (one-time charges + a recurring subscription)
   - Stripe supports this via Checkout Session in 'subscription' mode with line_items containing both subscription Price and one-time Prices
   - Square would need a parallel: charge the package one-time + create the subscription separately, both confirmed in same flow. Or defer this and keep memberships Stripe-only inside cart, error out on Square cart with membership.

   This is real architectural work. Plan a dedicated session of 1-2 days. Coordinate with item 32-bonus: cart UI redesign to feel more like a real e-commerce cart (running total, line items with qty steppers, remove-from-cart, view-cart icon in header).

   Estimated effort: 1-2 days focused work.

33. **Square memberships UX - explicit "use Stripe" message (NEW, May 8, 2026 from QA).** Already partially fixed in Chunk 1 (memberships hidden when only Square connected). Better UX would be: instead of just hiding, show a small inline note: "Memberships available with Stripe. Connect Stripe in Settings to enable." This educates the therapist on the limitation without being silent about why memberships are missing.

   File: src/pages/BookingPage.js offers section, when hasStripeForMembership is false but memberships exist.

   Estimated effort: 30 min.

34. **10-second rebooking, the major differentiator (NEW, May 8, 2026 from QA).** HK direction: "Add to the block plan, to provide a check box here and at several other strategic places to provide the client to say would you like to book recurring massages on a weekly, biweekly or monthly basis. And give them a less than 10 second way to book again (assume same settings and intake as past) and just book a recurring time and date. key is less than 10 seconds. both during the beginning of the workflow when they are booking for their first massage as well as end of the workflow. There should be a clear way of them providing feedback to therapist. Any emails they get there should be a link to that 10 second rebooking workflow. Add this to home, features and differentiation on why mybodymap as 10 second rebooking."

   This is THE big project. It is a true product differentiator and deserves its own roadmap track. Components:

   **Component A: Recurring booking checkbox at first booking.**
     "Book this same time every week / every other week / every 4 weeks?" checkbox at the booking confirmation step. Creates N future bookings same therapist, same service, same time, deposit auto-paid from card on file, intake auto-confirmed unless body changes.

   **Component B: One-tap rebook from confirmation email.**
     Every confirmation, reminder, and post-session email contains a "Book again" button with a signed token URL. Lands on a special booking page that shows "Same as last time? Wednesday 2pm, 60-min Deep Tissue with Sarah, $90." One tap = booked. Card on file auto-charged for deposit.

   **Component C: Post-session feedback prompt with rebooking nudge.**
     12-24h after session ends, automated email: "How was your session with Sarah? [👍 / 🤔 / 👎] Want to rebook? [Yes, same time next week] [Yes, in 2 weeks] [Yes, in a month] [Not yet]"

   **Component D: Therapist dashboard view of recurring clients.**
     "Active recurring" tab on Clients page. Shows clients on weekly/biweekly/monthly cadence. Therapist can pause, modify, or stop with one tap.

   **Component E: Marketing positioning.**
     - Add "10-second rebooking" as differentiator on Home page
     - Add to FeaturesV2 page
     - Add to WhyBodyMap page (item 1, lead)
     - Add to MARKETING_MYBODYMAP.md

   **Component F: Settings toggle for therapist.**
     Per-service "Eligible for recurring booking" checkbox so therapist can opt out for services that should not auto-rebook (couples, events, intro sessions).

   Estimated effort: 4-6 days of focused work across all components, possibly split across two sprints. Highest-impact item on the roadmap.

35. **Stripe package "Unknown parameters" bug, verify Chunk 1 fix worked (NEW, May 8, 2026).** Chunk 1 fixed the form() helper in supabase/functions/_shared/providers/stripe.ts. After Vercel + Supabase Edge Functions auto-deploy, HK should retest:
   1. Connect Stripe to test therapist
   2. Add a package to therapist's catalog
   3. As client, navigate to booking page, add package to cart, proceed to checkout
   4. Confirm Stripe Checkout opens cleanly without "Unknown parameters" error
   5. Complete a test purchase

   If still failing, paste the new error message verbatim and we debug from there. The fix has been pushed in commit a401664a; all that remains is real-world verification.

---

## NEW SECTION: Customer feedback intake May 8, 2026

Two founding therapists sent detailed feedback emails May 7-8: **Jiny Green** (warm-personal, ADHD-rant style, deep product instincts, offered to be sounding board, Discord-curious) and **Lindsey** (transactional-warm, Acuity refugee with 10 years of pattern matching on what scheduling software needs to do). HK responded with personalized thank-yous and they liked it. These items are the structured capture of what was raised.

Items 36-50 below are the new intake. Sprint sequencing follows at item 51.

---

36. **Client detail page redesign (NEW, May 8, 2026; supersedes scoped Item 27).** HK direction: "client cards need more richness. May be when we click them, we should see if a card is saved, if deposit has been given that should be called out very clearly, any other best practices on what should be available and saved for each client so that it is useful for both client and therapist."

   Item 27 originally scoped 4 indicators (deposit / card on file / membership / package) on the list-view card. That is still useful but undersized. The real product surface is a redesigned client detail page that pulls together everything therapists need at-a-glance for triage, retention decisions, and day-of-session prep, plus everything clients need when viewing their own profile.

   **Therapist sees on click:**
   - Last visit date + days since
   - Total sessions, lifetime revenue
   - Card on file status (yes/no, last 4 digits, processor)
   - Active deposit (paid for upcoming session, amount, refundable date)
   - Active membership (tier, sessions remaining this month, renewal date)
   - Active package (sessions remaining, expiration)
   - Outstanding balance (cancellation policy charges, no-show fees)
   - Body areas of concern (top 3 from intake/SOAP history)
   - Pregnancy / health flags
   - Sensitivities, contraindications, dislikes
   - Cycle phase (if cycle scheduling enabled)
   - Communication preferences (text vs email, opt-out)
   - Recurring booking pattern if any
   - Booking source (referral, organic, repeat from email)
   - Therapist-only notes ("loves chamomile tea before sessions")
   - Refund/dispute history

   **Client sees on their own profile:**
   - Their session history with self-reported feedback
   - Card on file (with update option)
   - Active membership / package balance
   - Upcoming bookings
   - Past intakes (with edit option per Lindsey #11)
   - Cycle/cadence preferences

   **The visual centerpiece should be the body map history with tension pattern visualization.** This is our actual moat. Other software has client profiles; nobody has the longitudinal body map.

   Implementation: client detail page becomes its own route `/dashboard/clients/:id`, renders rich layout with all of the above. Item 27 (4 list-view indicators) shrinks to a small tease that hints at richness, with the click navigating to detail page.

   Estimated effort: 3-4 days focused work. This is product UX, not a quick fix.

37. **Cancel / reschedule / refund flows (NEW, May 8, 2026; expanded scope of Item 28).**

   Item 28 originally scoped cancel + reschedule. Refunds are the missing third pillar. The full surface:
   - **Cancellation (in policy window):** client cancels with enough notice → no charge, deposit refunded automatically.
   - **Cancellation (out of policy):** client cancels too late → deposit forfeited or partial refund per therapist's policy.
   - **Reschedule (in policy window):** change time, no money movement.
   - **Reschedule (out of policy):** apply policy charge then move appointment.
   - **No-show:** therapist marks no-show → policy charge from card on file. (Closes Lindsey #1.)
   - **Therapist-initiated cancel:** full refund regardless of timing.
   - **Manual refund:** therapist refunds a session that already happened (good will, dispute).

   All flow through Stripe / Square refund APIs and the per-service cancellation policy. Components needed:
   1. Cancellation/reschedule link in confirmation email (signed token, 24h to 7d expiry).
   2. Public-facing cancel page: shows session details, asks for reason (optional), explains policy charge if applicable, processes if appropriate.
   3. Public-facing reschedule page: shows session details, picks new slot from same therapist's availability, swaps booking.
   4. Therapist-side cancel/reschedule from session detail in dashboard. "Cancel for client" or "Reschedule for client" with same modal.
   5. Therapist-side refund flow: any past session, "Issue refund" button, full or partial, reason note.
   6. Cancellation policy enforcement: cron job at policy cutoff time auto-marks deposits non-refundable, surfaces in reporting.

   **Database additions needed:** booking.cancellation_token (UUID), booking.cancellation_reason, booking.refunded_amount_cents, booking.refunded_at, booking.refund_method.

   Estimated effort: 5-7 days dedicated sprint. Highest user-facing gap right now.

38. **Per-service availability windows (NEW, May 8, 2026; from Lindsey #4).** "Different calendar/availability for different services."

   Currently therapist sets one global availability window. Lindsey wants per-service: "60-minute deep tissue available Mon/Wed/Fri only; 90-minute hot stone Tuesday afternoons only."

   Implementation: extend services table with optional availability_overrides JSON column. UI in service editor lets therapist toggle "Custom availability for this service" with day-of-week + time-of-day grid. Booking page slot generation respects per-service overrides when set, falls back to global when not.

   Estimated effort: 1-2 days.

39. **Booking lead-time minimum (NEW, May 8, 2026; from Lindsey #5).** "Limits on booking (how many hours ahead someone can book)."

   Add therapist setting "Minimum booking notice" with options: same day, 4 hours, 8 hours, 24 hours, 48 hours, 1 week. Booking page slot filter excludes any slot too close to now per this rule.

   Estimated effort: 2-3 hours. Quick win.

40. **Service-duration-aware slot offering (NEW, May 8, 2026; from Lindsey #9).** "Booking according to service duration (offering next available time)."

   Investigate whether current slot generation already does this. If a 90-min service is selected, slots should only show start times where 90 contiguous minutes are available (not just any 30-min gap). My understanding is this is partly already implemented; need to verify and close any gaps.

   Estimated effort: 2-4 hour investigation + fix.

41. **Disallow gaps in day (NEW, May 8, 2026; from Lindsey #7).** "Allowing/Disallowing gaps in day."

   Therapist setting: "Pack appointments back-to-back" toggle. When ON, booking page only offers slots immediately after an existing booking or at start of availability window, no isolated mid-day slots. Helps therapists who want full days or empty days, not partial days.

   Estimated effort: 4-6 hours. Logic in slot generator.

42. **Manual available-time slots (NEW, May 8, 2026; from Lindsey #8).** "Manually writing in available times for appts rather than all day listing."

   Today availability is "I'm available 9am-5pm Mon-Fri" and the system generates 30-min slots within. Lindsey wants the OPPOSITE: she manually adds "I have a slot at 10:30am Tuesday and 2pm Wednesday" and only those show. This is the override-driven model many seasoned LMTs use because their day looks irregular.

   Implementation: new availability mode toggle "Window-based (auto-fill slots)" vs "Slot-based (I add specific slots)". UI for slot-based has a calendar grid where therapist taps to add/remove individual time slots.

   Estimated effort: 3-4 days. Affects the calendar fundamentally; needs careful design.

43. **Calendar sync to iCal/Google (NEW, May 8, 2026; from Lindsey #10).** "Calendar sync to iCal/google cal etc."

   Two directions:
   - **Read-only export (one-way):** every therapist gets a `.ics` URL they can subscribe to from Google Calendar / iCal / Outlook. Simple. Bookings appear in personal calendar.
   - **Bidirectional sync:** therapist's personal Google Calendar busy times block MyBodyMap availability. Much harder; requires OAuth, calendar permissions, two-way conflict resolution.

   Recommendation: ship one-way first (1-2 days), defer bidirectional unless Lindsey or others specifically push.

   Estimated effort: 1-2 days for one-way; 1-2 weeks for bidirectional.

44. **Bidirectional intake editing (NEW, May 8, 2026; from Lindsey #11).** "Can both I and the client edit their intake form after filling it out?"

   Currently clients fill once; only therapist can edit after. Lindsey wants client to edit too (chronic conditions update over time, address changes, etc).

   Implementation: client portal at `/portal/:therapist-slug` (signed token from email) where client can view and edit their own intake. Therapist sees a "client edited their intake on [date]" indicator in the dashboard and can review.

   Estimated effort: 2-3 days.

45. **Waitlist (NEW, May 8, 2026; from Lindsey followup).** "A waitlist option!! No, Acuity actually doesn't have."

   When a service is fully booked or no slots match the client's preferred time window, offer them a waitlist signup. If a slot opens (cancellation, reschedule), waitlist clients in order get an automated email: "A slot opened up for your preferred service. Click here to book it. Expires in 4 hours." First click books.

   Real differentiator. Acuity doesn't have this. Most spa software doesn't.

   Implementation: waitlist table (client_id, therapist_id, service_id, preferred_window, created_at, status). Cron checks for newly-open slots that match waiting clients. Sends signed-token email; first click claims the slot.

   Estimated effort: 3-4 days. Genuine product expansion.

46. **Tips on pay-in-full and deposits (NEW, May 8, 2026; from Lindsey #2).** "Tips for pay in full & deposits."

   Currently no way for client to add a tip during the booking flow. Most spas don't pre-tip but some clients want to. Add optional tip line item at the deposit / pay-in-full step. Stripe and Square both support adding to PaymentIntent / Order amount with separate accounting.

   Implementation: tip input at payment step (preset 15/18/20/25/custom). Server side: included in PaymentIntent total but tagged in metadata as tip_cents so reporting separates earnings from tips.

   Estimated effort: 1 day.

47. **Follow-up email for new clients only (NEW, May 8, 2026; from Lindsey #3).** "Follow up email, only for new clients and not returning."

   Currently post-session follow-up email sends to everyone. Lindsey wants the welcome-and-follow-up version only for first-time clients; returning clients get a shorter rebook-focused email or none.

   Implementation: in the post-session email logic, check if client has prior completed sessions. Branch template accordingly. The "first session was great, here's what to expect next time" version vs "ready to schedule again?" version.

   Estimated effort: 4-6 hours.

48. **Manual payment recording (cash, Venmo, Zelle, check) (NEW, May 8, 2026; from Jiny).** "Are you going to allow other payment types (for tracking) like Cash, or Venmo, etc."

   Therapist marks a session as paid outside the platform. No money moves through MyBodyMap; record-keeping only. Important for older LMTs who still take a lot of cash and don't want to lose those sessions in their reporting.

   Implementation: on session detail, "Mark as paid" → modal with method dropdown (Cash, Venmo, Zelle, Check, Other) + amount + optional note. Records in payments table with method='manual' and provider=null. Reporting separates manual vs processed.

   Estimated effort: 1 day.

49. **Manual client credits (NEW, May 8, 2026; from Jiny).** "Ways of being able to give certain clients credits they may already have."

   Therapist gives client a $30 credit (good will, refund-as-credit, gift). Tracks in client record. Auto-applied at next checkout.

   Implementation: client_credits table (client_id, therapist_id, amount_cents, reason, created_at, applied_at). Therapist UI to add credit. Booking checkout shows available credit, applies up to total.

   Estimated effort: 1-2 days.

50. **Gift card GAAP accounting research and decision (NEW, May 8, 2026; from Jiny).** Jiny raised this as a potential differentiator: per GAAP, gift card sales are deferred revenue (a liability) until redeemed, not income up front. Most spa booking platforms count sales as income immediately. Square allegedly handles correctly.

   Honest assessment: Stripe and Square are payment processors, not accounting systems. They report transactions; the merchant's books are the merchant's responsibility. So Jiny's assumption "you're using Stripe so it's handled" is technically incorrect.

   Decision needed:
   - **Option A: Build GAAP-correct deferred revenue tracking** in MyBodyMap reporting. Real differentiator for spa-industry buyers. Probably 1-2 weeks.
   - **Option B: Be honest we don't do this.** Recommend QuickBooks integration. Cheap.
   - **Option C: Defer.** Revisit when more therapists ask.

   No coding until HK decides. Logged for explicit choice.

   Estimated effort: 0 (research/decision item).

51. **Branded gift cards (NEW, May 8, 2026; from Jiny).** "Can we tailor our gift cards with our brand colors eventually? Or upload our own images/etc?"

   Therapist uploads logo + selects accent color → gift card design generates with their branding. Email and PDF versions both branded.

   Implementation: therapist branding settings (already partly exists in Settings). Gift card generator pulls from those settings. Use a library like html-to-image or server-side puppeteer for PDF generation.

   Estimated effort: 2-3 days.

52. **Simple vs Advanced mode toggle (NEW, May 8, 2026; from Jiny). REAL DIFFERENTIATOR. Strategic decision needed.**

   Jiny's instinct: "Have a setting that you can toggle for simple or advanced users. Advanced toggle can hardcore customize everything. Simple can be what you've got going on right now." Pre-filled defaults already exist for older LMTs; this would formalize a "Simple mode" that hides advanced settings entirely.

   This is a real differentiator. Most software is one-size-fits-all overwhelm for the older-LMT persona. A clean Simple/Advanced split would directly address the persona.

   **However: this is an architectural decision.** If yes, every future feature work has to consider "does this go in Simple, Advanced, or both?" It changes how Settings is built going forward.

   Recommend: HK decides yes/no/defer. If yes, design doc first defining what goes in Simple vs Advanced, THEN implement.

   Estimated effort: 1 week if yes (refactoring Settings into mode-aware sections); 0 if no.

53. **Specialty-tailored intake (NEW, May 8, 2026; from Jiny). REAL DIFFERENTIATOR.**

   Jiny's idea: therapist picks their modalities (hot stone, deep tissue, lymphatic, prenatal, etc) at onboarding. Intake form auto-includes contraindications and questions specific to those modalities. Hot stone therapist's intake auto-asks about varicose veins and cardiovascular disease; prenatal's asks about trimester and OB clearance.

   Genuinely novel. No competitor does this.

   Implementation: therapist onboarding adds a "What do you specialize in?" step. Modalities list with checkboxes. Intake template engine adds appropriate questions and contraindications when therapist publishes.

   Need a curated database of modality → contraindication mappings. ABMP's pathology resources are a starting point; would want a real LMT educator's review before shipping.

   Estimated effort: 1-2 weeks (database curation is the long pole).

54. **Three reported bugs from Jiny + Lindsey, May 8, 2026 (URGENT, do this week).**

   - **Lindsey: "Plan says it's Gold for the $49/mo, but I would only need Silver since I'm solo."** Investigate. Likely Stripe webhook misclassified her tier or our display logic is wrong. Check her therapist row, fix display. (Status May 9: SQL query written for HK to run; awaiting result.)
   - **Jiny: "Saw on your first email at the bottom that says 'Silver tier Free for Life' and on the website it was free for a year."** FIXED May 9, 2026. Root cause: Home.jsx CTA was the only place saying "12 months" while everything else (welcome email, help articles, marketing pages, founder runbook) said "free for life". Updated Home.jsx to "free for life" so all surfaces match.
   - **Jiny: "I got all of the clients imported (YAY) and then tried importing my appointments... it said it was successful, but I don't see any of them... but there were like 1600-ish of them."** Investigation in progress May 9. Reproducing with a synthetic 1600-row CSV rather than touching Jiny's real data.
   - **NEW 54d (discovered May 9 while fixing 54b): Stripe coupon BETAONE configured as "100% off for 12 months" but our marketing says "free for life".** At month 13, Stripe will try to charge founding therapists $19/mo unless we extend or replace the coupon. Action: either extend BETAONE to never-expiring 100% off (Stripe supports this via "duration: forever"), or auto-apply a follow-up coupon at month 12, or tag founding therapists in a separate Stripe price_id with $0/mo. Cleanest: Stripe coupon with duration=forever. Need HK to make this change in Stripe Dashboard.

   Estimated effort: 4-6 hours total to investigate and fix all three (now four).

55. **Discord / community / sounding board for power users (NEW, May 8, 2026; from Jiny). DEFERRED.**

   Jiny offered: "Do you have a Discord server or something similar? Some kind of group for those of us who can make suggestions or ideas for your app?"

   Real time commitment. Standing one up and not showing up signals abandonment, which is worse than not having one. HK decision deferred. Suggested response (already sent in email): "Soon, but I want to do it right. For now please keep emailing me directly."

   Revisit in 60-90 days when therapist count justifies dedicated community time.

   Estimated effort: 0 currently. ~1-2 weeks of attention if/when launched.

56. **3D-printed QR/NFC stand for tip jar (NEW, May 8, 2026; from Jiny). FAR FUTURE.**

   Jiny's whimsical idea: branded 3D-printed stand with QR code (linking to tip page) and optional NFC tag (plays a sound when tapped). "Toss a coin to your spa fairy" with the Witcher melody.

   Fun. Not a product priority. Potential side-revenue if therapists want to buy them. File and forget for now.

   Estimated effort: 0 currently. Side project for someone, someday.

---

## SPRINT SEQUENCING (proposed May 8, 2026)

Six sprints over the next 6-8 weeks. Each sprint is a theme, not a fixed feature list, so we can flex what fits within the window.

### Sprint 0 (THIS WEEK, partly already done): Bugs + closure of in-flight QA fixes
- Items 23, 29, 31, 33 (already shipped in Chunk 5)
- Item 35 verification (Stripe package fix retest)
- Item 54 (the three Jiny + Lindsey reported bugs)
- Anything else that surfaces from continued QA

Estimated: 1-2 days remaining.

### Sprint 1 (next week): Cancel / reschedule / refund + no-show charging
- Item 37 (cancel/reschedule/refund full surface)
- Lindsey #1 closes naturally (no-show charge from card on file)
- Lindsey #6 closes naturally (client self-cancel/reschedule with policy)

Estimated: 5-7 days. Closes Lindsey's biggest concern. Also addresses what HK called "the biggest UX gap."

### Sprint 2: Per-service scheduling primitives
- Item 38 (per-service availability)
- Item 39 (booking lead-time)
- Item 40 (service-duration-aware slots, verify + fix)
- Item 47 (follow-up email new clients only)
- Item 41 (disallow gaps in day)

Estimated: 4-5 days. Closes most of Lindsey's Acuity-feature-list.

### Sprint 3: 10-second rebooking (Item 34)
The marquee differentiator. Six components from Item 34 elaboration above (recurring checkbox, one-tap rebook from email, post-session feedback prompt, therapist recurring view, marketing positioning, per-service eligible-for-recurring).

Estimated: 1 week dedicated.

### Sprint 4: Scheduling primitives batch 2
- Item 42 (manual slot windows, the seasoned-LMT model)
- Item 43 (calendar sync, one-way to start)
- Item 44 (bidirectional intake editing)
- Item 45 (waitlist, the real Acuity-killer differentiator)

Estimated: 5-7 days. Sprint 4 completes the Acuity-parity story and adds the waitlist as a competitive moat.

### Sprint 5: Payment tracking + tips
- Item 46 (tips on deposits/pay-in-full)
- Item 48 (manual payment recording: cash/Venmo/check)
- Item 49 (manual client credits)
- Item 36 (client detail page redesign): may slot here or in Sprint 6

Estimated: 4-5 days.

### Sprint 6: Differentiators
- Item 52 (Simple vs Advanced toggle) IF HK approves the strategic direction
- Item 53 (specialty-tailored intake)
- Item 51 (branded gift cards)
- Item 50 (gift card GAAP, IF HK chose option A)
- Item 36 (client detail page) if not done in Sprint 5

Estimated: 1-2 weeks. Differentiator-focused. Saves these for after parity is closed so we are competing on what others do not have.

### Beyond Sprint 6
- Bidirectional calendar sync (deeper version of item 43)
- Discord/community (item 55)
- 3D-printed stands (item 56)
- Anything new that surfaces from continued customer feedback

### Decisions still pending HK input
- **Item 50:** Build GAAP gift card accounting (option A), be honest we do not (option B), or defer (option C)?
- **Item 52:** Simple/Advanced toggle yes / no / defer? Architectural decision; affects every future feature.
- **Item 55:** Discord community now / later / not the right move?
- **Sprint sequencing:** Does putting cancel/reschedule before 10-second rebooking match HK's intuition? Lindsey's churn risk says yes; Jiny's enthusiasm for differentiators might argue the other way.

These are flagged here so a future session does not lose them.

---

## REFERENCE FILES IN REPO
- `BLOCK_PLAN.md` — this file. Always update when shipping or adding ideas.
- `docs/email-voice-guide.md` — canonical email broadcast voice guide. Joy persona, structure, hard rules. Reference this BEFORE drafting any broadcast template.
- `research/noterro-competitive-analysis-2026-04.md` — full Noterro deep-dive
