# Marketing Internal

**Last updated:** May 7, 2026
**Audience:** HK and any team member working on growth. NOT customer-facing.
**Companion doc:** `MARKETING_THERAPISTS.md` is the outward voice. This file is the strategic thinking behind it.

---

## How we think about the market

### The total addressable market
Roughly 250,000 licensed massage therapists in the U.S. (BLS estimate, 2024). The number is growing about 18% over the next decade per BLS projection, faster than overall employment.

Of those 250,000:
- Roughly 60% work for an employer (spa, chiropractic clinic, hotel, gym)
- Roughly 40% are solo or small-practice independents
- Of the solo independents, roughly 70% are cash-pay, 30% mixed cash and insurance

**Our wedge: solo cash-pay independents = ~70,000 LMTs in the U.S.**

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

**Highest expected value: #2 (adjacent modalities).** Lowest engineering cost, leverages existing infrastructure, expands TAM 3-4x without changing the core product.

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
- Conversion rate from "DM sent" to "signed up": ~25% (small sample)
- Conversion rate from "signed up" to "active user": ~60% (small sample)
- Time investment: ~30 minutes per signed-up therapist
- Scaling limit: ~50-100 therapists before HK is the bottleneck

### Channel 2: Word of mouth (current secondary)
- Founding therapists referring peers
- Conversion rate from "referral" to "signed up": ~50%
- Time investment: ~5 minutes per referred therapist
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
- Indirect: founder respect → cite by tech press → drives early-stage credibility

### Channel 5: Paid ads (deferred)
- Not until 100 founding therapists give us product-market-fit signal
- When we do: Meta first (Instagram for therapists), Google second (search intent for "Vagaro alternative")
- Budget plan when ready: $500-$1500/month test, $3000-$5000/month if it works

### Channel 6: SEO (deferred)
- Not until product surface stabilizes (currently still iterating weekly)
- When we do: target "Vagaro alternative for massage therapists," "[competitor] vs MyBodyMap" pages
- Each comparison page worth ~50-200 monthly visits at maturity

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
1. **Aware** — knows MyBodyMap exists (visitor to mybodymap.app, or sees a post)
2. **Interested** — engages (signs up for newsletter, follows social, DMs us)
3. **Trial** — creates an account
4. **Active** — completes onboarding (sets services, prices, connects payments)
5. **Engaged** — has at least one client booking through the platform
6. **Retained** — has at least 5 client bookings, or is on the platform 30+ days
7. **Advocate** — refers another therapist, gives testimonial, posts about us

### Current metrics (rough, May 2026)
- Aware → Interested: ~3-5% (typical for direct response)
- Interested → Trial: ~25% (high because of personal DM channel)
- Trial → Active: ~60% (decent; depends on Square activation friction)
- Active → Engaged: ~70% (need clients, takes 1-2 weeks)
- Engaged → Retained: ~80% (high if Engaged at all)
- Retained → Advocate: ~30% (small sample, hopeful)

### What we need to improve
**Trial → Active is the biggest leak.** Square activation is the main blocker. Most therapists who quit at this stage do so because Square's identity verification feels intimidating. Mitigation: clear messaging that Stripe is also an option, Square activation is a one-time 10-minute thing, and many therapists already did it for in-person Square use.

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
- After validated retention (>80% MoM at 6 months for paying tiers)
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
- Could afford to hire a small team faster
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

## Competitive intelligence we keep updated

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
- `research/competitive-analysis-2026-04.md` — current full deep dive
- `research/noterro-competitive-analysis-2026-04.md` — Noterro specific
- Future competitive deep dives go in `research/` with date suffix

---

## What we will publish externally and what we will keep internal

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

### Q2 2026 (Apr-Jun) — current
- Ship Stripe + Square parity
- 25-50 founding therapists onboarded
- Voice and brand consistency locked
- Founder hub (this) operational

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

**End of marketing internal doc.**
