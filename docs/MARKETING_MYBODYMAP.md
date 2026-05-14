# MyBodyMap Marketing

**Last updated:** May 7, 2026
**Audience:** HK and any team member working on MyBodyMap's growth, voice, or positioning. NOT customer-facing.
**Companion doc:** `MARKETING_THERAPIST_PLAYBOOK.md` is the document we share WITH therapists about how they can market themselves. This file is about how WE market MyBodyMap.

This document combines the strategic thinking (market sizing, channels, funnel metrics, pricing, positioning) with the voice and execution rules (what we say to therapists, how we say it, what we never do). One document, because the strategy and the voice are inseparable.

---

# PART ONE: STRATEGY

## How we win: commodity surface plus intelligence layer

**The thesis.** Every booking platform has a calendar. Every CRM has a client list. Every spa POS has a payment screen. Those surfaces are commodities. They do not differentiate. Cal.com, Acuity, Mindbody, Jane App, Vagaro, MassageBook all have polished versions of the same surfaces. Trying to beat them at "nicer calendar" is a losing game.

**Where we win.** Layer proprietary intelligence on top of the commodity surface so the same screen answers questions the others cannot answer. The Schedule tab still looks like a calendar. But the next-up card on the left side knows what to remind the therapist about Emma, because we have her last four SOAP notes and her body map history. That card cannot exist on Cal.com because they do not have the data. It can barely exist on Mindbody because they have notes but no pattern engine. On our screen it shows up automatically, no extra clicks, no extra data entry.

**The rule of intelligence.** Three filters every new feature has to pass:

1. **Is the commodity surface (the calendar, the list, the payment screen) calm and familiar?** A therapist with one hour on the platform should know how to read it. Do not reinvent UI patterns that already work.
2. **Is there an intelligence layer sitting on top that uses data competitors do not have?** Body map zones, longitudinal pattern detection, SOAP note history, no-show pattern math, lapsed-regular retargeting. These are ours. Surface them where the decisions get made, not buried in an analytics tab nobody opens.
3. **Does the intelligence require zero extra data entry from the therapist or client?** If we have to ask either party to fill out a new form to make a feature work, the feature is dead on arrival. They are already stretched. Every new input is a tax on adoption.

### The "no data asks" rule

We never ask therapists for more inputs to power intelligence features. Same for clients. Every coefficient, threshold, weight, and parameter is computed from data we already collect, or seeded with a sensible default baked into the playbook. The therapist can override it in Advanced Settings if she is the kind of person who wants to tune. She never has to.

Examples:
- **Body load meter** (Schedule tab). Do not ask therapists to tag services with effort levels. Compute load from service name keywords (deep tissue, sports, prenatal, hot stone, swedish, reflexology) mapped to default load factors in this playbook. Override available in Advanced Settings, never required.
- **Revenue goal** (Schedule tab). Do not ask the therapist to set a weekly goal in onboarding. Compute a default from her trailing 4-week revenue plus 10%. Override available, never required.
- **No-show pattern alerts** (Schedule tab). Do not ask the therapist to flag risky clients. Compute the rate per client from booking history. Show the alert only after 5 or more bookings to avoid false signals.
- **Lapsed-regular detection** (Schedule tab). Do not ask the therapist to define who is lapsed. Use a sliding-window default: clients who booked 4 or more times historically AND have not booked in the trailing 30 days. Override available, never required.
- **Next-up briefing** (Schedule tab). Do not ask therapists to write briefs. Pull three points from the most recent SOAP note, the recurring patterns table, and the medical flags. Templated phrasing, not blurb-style.

### The formula playbook

Defaults live in this section. When we add an intelligence feature, we document its formula here so anyone debugging can see what number came from where.

**Body load factors by service-name keyword:**

| Keyword (case-insensitive substring of service.name) | Load factor |
|---|---|
| deep tissue, sports, trigger point, myofascial, neuromuscular | 1.0 (high) |
| swedish, relaxation, integrative, custom, full body | 0.6 (medium) |
| prenatal, geriatric, lymphatic, reflexology, foot, scalp | 0.4 (low) |
| hot stone, aromatherapy, cupping, gua sha | 0.5 (low-medium) |
| (fallback when no keyword matches) | 0.7 (medium-high, conservative) |

**Body load aggregation:** sum of `(load_factor * duration_minutes / 60)` across confirmed bookings for the day. Thresholds: under 3.0 is light, 3.0 to 5.5 is moderate, 5.5 to 7.5 is high, over 7.5 is injury risk.

**Body load recommendations** at each threshold:
- Light: no callout.
- Moderate: no callout.
- High: "Hydrate at the mid-afternoon gap. Stretch wrists between deep tissue."
- Injury risk: "Three or more deep tissue back-to-back. Skip a strength session tonight. Wrists, forearms, low back at elevated risk."

**Revenue goal default:** trailing 4-week revenue (confirmed bookings, completed sessions, applied payments) times 1.10. Floored at $500 per week if history is sparse.

**No-show rate threshold:** show the alert when `cancellations / total_bookings is greater than or equal to 0.20` and `total_bookings is greater than or equal to 5`. Below 5 bookings show nothing. Sample size too small.

**Lapsed regular definition:** any client with `lifetime_bookings >= 4` AND `last_booking_date < now - 30 days` AND `status != 'archived'`. Sorted by recency of last booking descending.

**Gap-finding for revenue lever cards:** scan the next 7 days for unbooked slots that match `gap_duration >= service_min_duration AND gap_duration <= service_max_duration AND gap_falls_in_availability_window`. Smallest gap that fits a real service wins. Show only if at least 1 lapsed regular exists who could fill it.

When a future feature needs a new formula, the formula lives here, alongside the others. One file, easy to audit, easy to tune.

### Mindset checklist for any new feature

Before shipping any feature, run through these. If any answer is "no," the feature is not done.

- [ ] Is the surface familiar (calendar, list, card, form), or did we invent something the user has to learn?
- [ ] Is there an intelligence layer that uses our proprietary data (body map zones, SOAP history, patterns)?
- [ ] Does the intelligence require zero new inputs from therapists or clients?
- [ ] Are the defaults documented in the formula playbook above?
- [ ] Is there an Advanced Settings override path for therapists who want to tune?
- [ ] Would a competitor with only commodity data (just a calendar, just a payment processor) be unable to build this?

The last question is the test of whether the feature is a moat or a polish. Polish features are fine but they do not differentiate. Moat features do.

### Anti-patterns we avoid

Things that look smart but actually fail the principle:

- **"Let the therapist configure it" features.** Settings menus full of toggles are dead screens. Therapists do not open them. Defaults must work for 95 percent of users out of the box.
- **"AI-generated" features without a deterministic backbone.** The next-up briefing can be templated from three structured fields (medical flag, last focus area, preference). AI can layer prose on top later. Do not ship the AI layer first. Ship the deterministic layer first so the feature is predictable and free.
- **Insights tabs that summarize data nobody reads in the moment.** A "monthly retention rate" chart is useless if it does not tell the therapist what to do today. Surface the action where the decision is made (next-to-the-calendar gap card), not in an analytics tab.
- **Onboarding asks.** Every field added to onboarding loses a percentage of conversions. Do not ask. Compute and let her override.

---

## How we think about the market

### The total addressable market
Roughly 250,000 licensed massage therapists in the U.S. (BLS estimate, 2024). The number is growing about 18% over the next decade per BLS projection, faster than overall employment.

Of those 250,000:
- Roughly 60% work for an employer (spa, chiropractic clinic, hotel, gym)
- Roughly 40% are solo or small-practice independents
- Of the solo independents, roughly 70% are cash-pay, 30% mixed cash and insurance

**Our wedge: solo cash-pay independents = roughly 70,000 LMTs in the U.S.**

This is the segment we are built for and the segment competitors underserve. Vagaro and MassageBook chase the spa/chain market. Jane App chases the clinical market. We are alone in solo cash-pay.

### The serviceable obtainable market
At $19-$49 ARPU and 1-3% market share by 2028:
- Low: 700 therapists × $19 × 12 = $159k ARR
- Mid: 1,400 therapists × $30 × 12 = $504k ARR
- High: 2,100 therapists × $40 × 12 = $1M ARR

**Realistic 2028 ARR target: $500k-$1M.** Worth doing for HK economically. Not a unicorn outcome.

### The path to $5M-$15M ARR
Requires expansion beyond solo cash-pay. Three options:

1. **Move up-market to small group practices** (2-5 therapists). Different software needs (multi-therapist scheduling, payroll, shared client lists). Would require significant additional build. Not aligned with current "deeper not wider" positioning.

2. **Move adjacent to other body-work modalities** (acupuncture, chiropractic, physical therapy, energy work). Same retention problem, similar persona, different terminology. Body-map intelligence translates well.

3. **Move into therapist-to-therapist tools** (continuing education, peer consultations, referral network). Network effects layer on top of the practice management product. High-leverage if we get to scale.

**Highest expected value: option 2 (adjacent modalities).** Lowest engineering cost, leverages existing infrastructure, expands TAM 3-4x without changing the core product.

---

## Persona detail

### The primary persona: "Sarah"
- 47 years old, female
- Massage therapist for 12 years, solo for 8
- Works 25-30 sessions per week, $80-120 per session
- Annual revenue: $80k-$120k
- Currently uses Vagaro ($30-50/mo), or paper plus Square stand-alone, or Acuity plus a separate notes app
- Owns an iPhone, an iPad, a MacBook Air. Comfortable with technology but does not enjoy it.
- Reads Instagram while drinking coffee in the morning. Reads email at lunch. Closes laptop by 8pm.
- Has a partner. May have kids (often grown). Has a small dog.
- Cares about: her clients, her body (career-ending injuries are real), her schedule, her income stability
- Does not care about: features, tech stack, integrations, "growth hacking"
- The phrase that gets her: "less time on the laptop, more time on what matters"

### The secondary persona: "Anna"
- 31 years old, female
- New massage therapist, 2-3 years in practice
- Recently went solo after 3 years at a chain spa
- Works 18-22 sessions per week (still building)
- Annual revenue: $35k-$60k
- Currently uses whatever a friend recommended, often nothing systematic
- Heavy iPhone user, fluent on Instagram, has a TikTok she posts on occasionally
- Cares about: building her client list, looking professional, the price of software
- Does not care about: legacy features, established brand reputation
- The phrase that gets her: "starts free, looks like a real product, helps me grow"

### The avoid persona: "Brittany"
- Anyone who runs a spa or salon with multiple chairs / staff
- Anyone who bills insurance heavily
- Anyone whose primary need is online sales of products / gift cards / classes
- Anyone whose primary motivation for software is "marketing automation"

If "Brittany" finds us, gently redirect. Vagaro or GlossGenius is probably right for her.

---

## Channel strategy

### Channel 1: Direct messages (current primary)
- HK personally DMs therapists who follow @mybodymap01, mention us, or get referred
- Conversion rate from "DM sent" to "signed up": about 25% (small sample)
- Conversion rate from "signed up" to "active user": about 60% (small sample)
- Time investment: about 30 minutes per signed-up therapist
- Scaling limit: 50-100 therapists before HK is the bottleneck

### Channel 2: Word of mouth (current secondary)
- Founding therapists referring peers
- Conversion rate from "referral" to "signed up": about 50%
- Time investment: 5 minutes per referred therapist
- Scaling limit: organic, depends on number and engagement of founding therapists

### Channel 3: Instagram organic (current tertiary)
- @mybodymap01 currently small follower count
- Mix of product moments, voice posts, founder updates
- Conversion rate from "follower" to "signed up": low single digits
- Time investment: 2-3 hours per week
- Scaling limit: depends on whether we figure out the format that works for our demographic

### Channel 4: Founder content (HK on LinkedIn)
- HK has executive presence and a real network from IBM
- HK posting periodically about MyBodyMap on LinkedIn drives founder-led credibility
- Probably right channel for a future "HK lessons learned" content stream, not for direct therapist acquisition
- Indirect: founder respect, cite by tech press, drives early-stage credibility

### Channel 5: Paid ads (deferred)
- Not until 100 founding therapists give us product-market-fit signal
- When we do: Meta first (Instagram for therapists), Google second (search intent for "Vagaro alternative")
- Budget plan when ready: $500-$1500/month test, $3000-$5000/month if it works

### Channel 6: SEO (deferred)
- Not until product surface stabilizes (currently still iterating weekly)
- When we do: target "Vagaro alternative for massage therapists," "[competitor] vs MyBodyMap" pages
- Each comparison page worth 50-200 monthly visits at maturity

### Channel 7: Conferences and trade shows (declined)
- AMTA national convention, ABMP, state-level
- Cost: $5-15k per show including booth, travel, materials
- Conversion: typically 20-50 leads per show, 2-5 sign-ups
- ROI: marginal at this stage. Defer indefinitely.

### Channel 8: Affiliates and partners (declined)
- Premature; would dilute founder framing
- Future possibility: partner with continuing education providers, professional associations (AMTA), product manufacturers (massage tables, oils)

---

## Conversion funnel and metrics

### Funnel stages
1. **Aware** is when she knows MyBodyMap exists (visitor to mybodymap.app, or sees a post)
2. **Interested** is when she engages (signs up for newsletter, follows social, DMs us)
3. **Trial** is when she creates an account
4. **Active** is when she completes onboarding (sets services, prices, connects payments)
5. **Engaged** is when she has at least one client booking through the platform
6. **Retained** is when she has at least 5 client bookings, or is on the platform 30+ days
7. **Advocate** is when she refers another therapist, gives testimonial, posts about us

### Current metrics (rough, May 2026)
- Aware to Interested: 3-5% (typical for direct response)
- Interested to Trial: about 25% (high because of personal DM channel)
- Trial to Active: about 60% (decent; depends on Square activation friction)
- Active to Engaged: about 70% (need clients, takes 1-2 weeks)
- Engaged to Retained: about 80% (high if Engaged at all)
- Retained to Advocate: about 30% (small sample, hopeful)

### What we need to improve
**Trial to Active is the biggest leak.** Square activation is the main blocker. Most therapists who quit at this stage do so because Square's identity verification feels intimidating. Mitigation: clear messaging that Stripe is also an option, Square activation is a one-time 10-minute thing, and many therapists already did it for in-person Square use.

### What we measure weekly
- Total active users
- New trials this week
- New activations this week
- New engaged users this week
- DMs sent and responded to
- Outstanding therapist questions / complaints

### What we do NOT measure (intentionally)
- Vanity metrics: total signups, page views, social impressions
- Hours of work per week (HK is focused on output, not effort)
- Comparison to investor-funded startups (different game, different rules)

---

## Pricing strategy

### Current pricing (May 2026)
- **Bronze:** Free. Intelligence layer for first 5 sessions per client only.
- **Silver:** $19/mo or $190/yr. Most features.
- **Gold:** $49/mo or $490/yr. Adds advanced AI, priority support, white-label booking page.

### Pricing logic
- Anchored against MassageBook ($25 advertised, $70-$100 actual) and Vagaro ($30-$50)
- Silver at $19 deliberately undercuts the cheapest competitor, signaling value
- Gold at $49 sits at the lower end of "premium" tier (Jane App is $74-$109)
- Bronze (free) is a discovery vehicle, not a long-term home for therapists. Paywall hits at session 6 per client.

### When we will raise prices
- After 100 founding therapists are on the platform
- After validated retention (over 80% MoM at 6 months for paying tiers)
- After at least one therapist has voluntarily said "I would pay more"

### How we will raise prices
- Existing customers grandfathered at current rates indefinitely (loyalty matters)
- New signups at higher rates
- Public communication: "We are increasing prices for new customers because [reason]. If you signed up before [date], your current rate is locked in."

### Pricing experiments NOT to run
- Discount codes for general public (cheapens the product)
- Limited time offers (manipulative, not us)
- "Pay what you can" tier (signals we don't know our worth)

---

## Why we are not raising venture capital

### Reasons we have considered raising
- Could afford full-time engineering hire to ship faster
- Could afford paid acquisition experiments
- Could afford to build adjacent verticals (acupuncture, chiropractic) sooner

### Reasons we are not raising
- TAM is realistic at $5-15M ARR; investors want $100M+ paths
- Solo cash-pay massage is unsexy and would not get good investor reception
- HK has IBM income; not under personal financial pressure
- Investor-backed growth pressure tends to ruin product quality
- The product philosophy ("deeper not wider," "simpler than competitors") is anti-VC

### What would change our mind
- A clear path to $50M+ ARR via vertical expansion
- A strategic acquirer interest at the right price
- A founder co-investor who is mission-aligned (operator-investor, not financial-only)

### What we will absolutely not do
- Raise from generalist VCs who pressure us to spam therapists
- Raise from anyone who insists on growth-at-any-cost framing
- Sell to a private equity roll-up that would gut the product

---

# PART TWO: VOICE AND EXECUTION

## Voice rules

Every customer-facing word follows these. No exceptions.

### Sign as Joy, not HK
All emails, social posts, in-app messages, and broadcasts are signed by **"Joy / MyBodyMap Team."** Joy is a warm, plain-spoken 70-year-old female LMT who has been in practice for 25 years and now works at MyBodyMap as the founder-facing voice of customer success.

She is NOT HK. HK never signs anything publicly. The Joy persona is non-negotiable. New team members must master her voice before they get publish access.

### Write for the persona
A 30-65 year old female LMT, 5-20 years in practice, $40k-$100k annual revenue, currently using Vagaro or paper. Tech-comfortable but not tech-enthusiastic. Reads on her iPhone in between sessions. Has a partner, possibly kids, definitely tired.

### Style rules
- No em dashes anywhere
- Numbered sections in prose paragraphs (6-7 features), never bullets in customer-facing copy
- Open with a warm human note
- Add transparency lines and plain-English parentheticals
- Close with time-back framing plus emotional list (body, clients, family, yourself)
- Link to the specific page being discussed
- Use "MyBodyMap" not "BodyMap" in all user-facing text
- No jargon. If a word would confuse a 70-year-old, replace it.
- No urgency manipulation. No "limited time." No "act now." We respect the reader.

### Words to use
- "Calm." "Quiet." "Steady." "Yours." "Already."
- "Plan around your body, not against it."
- "Like hotels and airlines, you set the rules once."
- "We do the work that doesn't require your hands."

### Words to avoid
- "Solution," "platform," "ecosystem," "leverage," "synergy," "stack"
- "Click here" (use the actual destination)
- "Game-changer," "revolutionary," "best-in-class"
- "Disruption" of any kind

---

## Positioning against each competitor

### Vagaro
**Their pitch:** Comprehensive salon and spa software. Calendar, marketing, payments, reports, client app, gift cards, classes, payroll, inventory.

**Our pitch back:** "Vagaro is built for spas with five chairs and ten staff. You are one therapist. Most of what they charge you for, you do not use. Most of what you actually need, they make you click through twelve screens to find. MyBodyMap is built for you, not for the spa down the road."

**Specific claims:**
- Vagaro takes 12 steps to set up a calendar (verified, April 2026)
- Vagaro Pay is Stripe under the hood with a small markup. Same fees, different invoice.
- Vagaro mobile UX is bloated even though they market it as mobile-first

### MassageBook
**Their pitch:** Designed by therapists, for therapists. Established 2013. Has every feature.

**Our pitch back:** "MassageBook was designed for therapists in 2013. It still looks like 2013. The features are real but you have to pay for the ones that matter most. Card-on-file is paywalled. SOAP-style notes are paywalled. We do not paywall what should be free."

**Specific claims:**
- Card-on-file requires their higher tier (verified)
- UI has not been substantively updated in years
- Pricing is opaque; advertised $25 is closer to $70-$100 once you add what you need

### ClinicSense
**Their pitch:** Clinical-grade software for therapists. SOAP notes, charting, insurance billing.

**Our pitch back:** "ClinicSense is built for therapists who bill insurance. If you are cash-pay, you are paying for a feature set you do not need. The clinical lens makes everything heavier. SOAP notes are paywalled at the higher tier. MyBodyMap is built for solo cash-pay, not for clinics."

### Acuity / Squarespace Scheduling
**Their pitch:** Easy online booking, integrates with everything.

**Our pitch back:** "Acuity is general booking. It works for yoga teachers, dog groomers, and tax accountants. It does not understand massage. We do. Body-map intelligence, tension pattern tracking, cycle-aligned scheduling, none of that exists in Acuity because it cannot."

### GlossGenius
**Their pitch:** Beauty and salon platform. Modern UI. Strong product.

**Our pitch back:** "GlossGenius is a strong product for beauty professionals. Most therapists are not beauty professionals. Their proprietary processor locks you in. We do not. Use Stripe or Square, whichever you already use, or both."

### Jane App
**Their pitch:** Premium clinical software for healthcare practitioners.

**Our pitch back:** "Jane is excellent if you are a clinic with multiple practitioners and insurance billing. For solo cash-pay, you are paying $74-$109 a month for a clinic feature set. That is the wrong price for the wrong product."

### Paper / Google Calendar / Excel (the actual largest competitor by user count)
**Their pitch:** Free.

**Our pitch back:** "We get it. Paper is free. So is Google Calendar. But paper does not text your client a reminder, charge for a no-show automatically, or notice when someone has not been in for three months. By the third missed appointment per month, MyBodyMap pays for itself. By the second lapsed client we win back, we are paying you."

---

## Value props in order of importance

### 1. Time back
The single biggest reason to switch. Therapists do an estimated 6-8 hours per week of admin work. MyBodyMap automation reduces that to 1-2 hours. That is 4-6 hours back, every week, for the body, the clients, the family, the self.

Frame: "We do the work that doesn't require your hands."

### 2. Retention
Lapsed clients are pure lost revenue. The average therapist loses 15-20% of regulars per year to "they just stopped coming back" with no specific reason. MyBodyMap automated retention touchpoints (post-session AI brief, follow-up scheduler, lapsed-client outreach) recover most of that loss.

Frame: "Make it impossible for a client not to return."

### 3. Money clarity
Therapists are often unsure whether they got paid for everything they did. Did the deposit clear? Did the membership renew? Did the late cancel fee actually charge? MyBodyMap reconciliation (coming Q3) gives a single view of "sessions done vs money received."

Frame: "Did the work, got the money. Both, in one screen."

### 4. Modern feel
The dashboard looks like a 2025 product, not a 2015 product. This matters more than it sounds. Therapists who feel embarrassed by their software cannot recommend it to peers. Therapists who feel proud of their software become channels.

Frame: "Software that doesn't look like it was built last decade."

### 5. No lock-in
Stripe or Square, your choice. Cal.com calendar sync if you want it. Email through Resend (your domain), SMS through Twilio (your sender). When you eventually outgrow MyBodyMap (or we screw up), your data exports cleanly, your clients stay yours, your relationships are not held hostage.

Frame: "Your business, your relationships. We are renting space, not owning it."

---

## The founding therapist program

### What it is
First 100 therapists get Silver tier free for life. No credit card required at signup. Beta coupon `BETAONE` provides Silver at 100% off for 12 months for therapists who message us on Instagram or Facebook.

### Why it exists
- Validates retention metrics with real practitioners before we set pricing
- Builds a community of evangelists who recommend us to peers
- Creates a moat: therapists who got something valuable for free are loyal

### How we frame it externally
"We are looking for our first 100 founding therapists. You get full Silver tier free for life, in exchange for using the platform, telling us what works and what does not, and recommending us to one or two peers if you find it useful. There is no credit card. There is no fine print. We need you to make this product right, and you get a real product in return."

### What we never do
- Never publish the BETAONE code on the public site. Therapists must DM Instagram or Facebook to get it. This qualifies leads, builds relationship, grows social.
- Never use FOMO language ("only 23 spots left"). The founder framing is enough; manufactured urgency is not us.
- Never charge a credit card "just to verify" or "for after the trial." No card, period.

---

## Common therapist objections and how Joy handles them

### "I am not great with technology."
"You do not have to be. If you can use Instagram, you can use MyBodyMap. The whole point is that the software does the technical parts so you do not have to. We made it for the therapist who has been hand-writing client notes for 15 years and is finally ready to stop."

### "I am too busy to switch right now."
"That is the real reason to switch. The reason you are too busy is that you are doing all the admin yourself. Switch when it is least convenient and you save the most time. We can have you up and running in 30 minutes. Most of that is you setting your services and prices, which you already know."

### "What about my existing client list?"
"It is yours. We can import a CSV you export from Vagaro, MassageBook, anywhere. Your client relationships are your own. We are renting them workspace, not owning them. If you ever leave, you take your data and your client list with you."

### "What if you go out of business?"
"Fair question. We are self-funded, profitable on every paying customer, with no investor pressure to grow at any cost. The most likely failure modes are HK (founder) being unable to continue, in which case there is a documented handoff plan to a human team. Your data is exportable to standard CSV at any time, and we will give you 90 days notice plus a guided export process before any shutdown."

### "I already pay $X for [competitor]. Why switch?"
"You should not switch unless we save you something real. For most therapists that is time, not money. The fee comparison is a wash. The time difference is 4-6 hours per week. Do the math on what your time is worth."

### "Is my client data private?"
"Yes. Encrypted at rest, encrypted in transit, the same security standards as MassageBook and online banking. Your data is isolated from every other therapist's data. We never sell it, never train AI across practices on it. If you ever leave, your data leaves with you."

### "Do you support insurance billing?"
"Not today. We are built for cash-pay solo therapists, which is the largest segment of the U.S. market and the most underserved by existing software. If you bill insurance heavily, Jane App is probably the right tool for you. If you bill mostly cash with occasional insurance, MyBodyMap plus a separate insurance flow may work. We are not the right answer for every therapist, and we say that out loud."

---

## Channels and what we say where

### Instagram (@mybodymap01)
Mix of product moments, quiet voice posts, founder updates from Joy. Three to five posts a week. Carousel posts work better than single images. No reels yet.

Voice is calm, observational, often featuring a single beautiful image with one sentence of caption.

### Facebook page
More therapist-facing community building. Longer captions. Sharing of customer success stories with permission. Currently lower engagement than Instagram for our demographic.

### Email broadcasts
Joy persona, batched 10-30 therapists at a time via Resend. Always plain text, always short. See `docs/email-voice-guide.md` for the canonical structure.

### Direct messages
HK personally messages therapists who follow us, shout us out, or get referred by another therapist. Always responds within 24 hours. Always opens with a warm human note. Never copy-pastes.

### Website (mybodymap.app)
Home page is a quiet product tour through the seven ribbons. Features page is the full reference. Pricing page is honest and unembellished. No popups, no exit intent, no chat widget.

### Word of mouth
The single biggest channel. Every founding therapist is asked, gently, after 30 days of use, whether they would tell one peer about us. Most say yes. Some send referrals.

---

## Things we do not do

- We do not run paid ads (Google, Meta, TikTok, anywhere) until we have product-market-fit signal from 100 founding therapists
- We do not do SEO content marketing yet (premature; surface is still moving)
- We do not attend trade shows (too expensive at this stage)
- We do not have an affiliate or partner program (premature; would dilute founder framing)
- We do not pay influencers or wellness creators
- We do not do "growth hacks." If a tactic feels manipulative, we do not use it.

---

## How to write a new feature announcement

When a new feature ships, the announcement format is:

1. **Subject line.** Plain. No emoji. "Cancellation policy is now live" not "🚀 NEW FEATURE: Cancel like a pro!"

2. **Opening line.** Warm human note. "Good morning. Quick update."

3. **What it does, in one paragraph.** No bullet points. The persona reads in prose.

4. **Why it matters to her.** Specific. "If a client cancels two hours before her appointment, the card on file gets charged automatically. You do not have to do anything."

5. **What stays the same.** Reassurance. "If you do not want to use this, nothing changes. The default is off."

6. **Closing.** Time-back framing plus emotional list. "Less time chasing fees. More time for the body, the clients, the family, yourself."

7. **Link to the page.** Specific URL. Not "click here."

8. **Sign as Joy, MyBodyMap Team.**

---

## How to handle a customer complaint

### Step 1: respond within 4 hours, even if just to acknowledge
"Got your message. Looking into it now. Will reply with a real answer by end of day."

### Step 2: actually fix it
Most complaints are fixable. Some are misunderstandings. A few are legitimate bugs.

### Step 3: write the resolution clearly
What happened, why it happened, what we did about it, what changes for the future.

### Step 4: ask if there is anything else
"Anything else from your week we should know about?"

### Step 5: log it
Every complaint goes in a running internal log so we can see patterns. If the same complaint shows up three times, it is a real problem we need to fix at the product level.

---

## On boundaries

Joy is warm, but she is not a friend. We do not socialize with therapists outside the platform context. We do not give business advice. We do not take on emotional labor that is not our job. Therapists have their own community; we are software that supports them, not a replacement for human connection.

When a therapist starts treating MyBodyMap support as therapy, gently redirect. "I hear you. That sounds like a lot. I am not the right person to talk about that with, but I am here for anything platform-related." Healthy boundaries make a healthy product.

---

# PART THREE: BRAND AND COMPETITIVE INTELLIGENCE

## Brand assets and visual identity

### Logo
- BMLogo component: stylized leaf, "MyBodyMap" wordmark
- Always use "MyBodyMap" in user-facing text. "BodyMap" alone only acceptable in legal entity (BodyMap LLC) or internal admin tools.

### Colors
- **Forest green** (`#2A5741`): primary brand
- **Sage** (`#9DAA85`): secondary accents
- **Cream** (`#FAF6EE` and `#FBFAF6`): backgrounds, surfaces
- **Ink** (`#1F3A2C`): primary text on light backgrounds
- **Gray** (`#6B7280`): muted text
- **Border** (`#E5D5C8`): card borders, dividers

### Typography
- **Georgia, serif** for headings, founder voice quotes, eyebrows
- **System sans-serif** for body text, UI elements

### Photography style
- Lifestyle / editorial, not stock photography
- Hands working, calm scenes, soft natural light, neutral linens, terracotta, plants
- Subjects: 30-65 female, mixed ethnicity, professional but relaxed
- NEVER: stock-photo "smiling woman with stethoscope," generic spa imagery, model shots

### Tone of motion
- Subtle. Animations are 200-400ms, ease-in-out.
- Never bouncy, springy, or attention-grabbing.
- Demos loop quietly in the background of marketing pages.

---

## Competitive intelligence

### Things we monitor monthly
- Vagaro pricing page (have they bundled differently?)
- MassageBook feature list (have they added something we should know about?)
- Jane App's marketing pages (they tend to set the bar for design quality in this space)
- Acuity / Squarespace Scheduling pricing (they will be the closest substitute for some therapists)

### Things we do not monitor
- Funded-but-not-released competitor announcements (rumors are noise)
- Reddit / Facebook complaints about competitors (signal-to-noise too low)
- Major SaaS trends (we are not building general SaaS)

### Sources
- Direct platform visits (sign up for trials when offered)
- Therapist conversations ("what did you switch from")
- Public review sites (Capterra, G2) for sentiment shifts

### Where competitive analysis lives
- `research/competitive-analysis-2026-04.md` is the current full deep dive
- `research/noterro-competitive-analysis-2026-04.md` is Noterro specific
- Future competitive deep dives go in `research/` with date suffix

---

## What we publish externally and what we keep internal

### Publish externally (with care)
- Founding therapist count milestones ("We are at 50 founding therapists. 50 to go.")
- Major feature launches (cancellation policy, payment parity, AI session briefs)
- Customer testimonials (with permission, never without)
- HK personal journey from IBM exec to solo founder (judiciously, on LinkedIn)

### Keep internal
- Pricing strategy details
- Conversion funnel metrics
- Specific churn rates
- Internal cost structure
- Roadmap beyond 90 days (changes too often)
- This document (and the runbook) and the rest of the founder hub

### Gray zone (HK to decide case by case)
- Funding status
- Team size
- Specific technology choices (Supabase, Vercel, Stripe / Square)

---

## Year 1 goals

### Q2 2026 (Apr-Jun) · current
- Ship Stripe + Square parity
- 25-50 founding therapists onboarded
- Voice and brand consistency locked
- Founder hub operational

### Q3 2026 (Jul-Sep)
- 75-100 founding therapists
- Payment reconciliation feature
- Phase 1 wallet methods (Apple Pay / Google Pay) live
- Founder hub chat interface live
- First content marketing piece (HK on LinkedIn)

### Q4 2026 (Oct-Dec)
- 100 founding therapists fully onboarded
- Begin paid pricing rollout to new signups (founders grandfathered)
- First 10 paying customers
- Adjacent vertical scoping (acupuncture, chiropractic)

### Q1 2027 (Jan-Mar)
- 50 paying customers
- Begin paid acquisition experiments
- First conference attendance scoped (AMTA national)

---

## Where this document lives

`docs/MARKETING_MYBODYMAP.md` in the bodymap repo. Updated when strategy, voice, or competitive landscape shifts meaningfully.

This file replaced and merged the earlier `MARKETING_INTERNAL.md` and `MARKETING_THERAPISTS.md`. The therapist-FACING marketing content (how therapists market themselves to their own clients) lives separately at `docs/MARKETING_THERAPIST_PLAYBOOK.md`.
