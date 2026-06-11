# Billing Dashboard Benchmarks

**Last updated:** May 18, 2026
**Source:** Research conducted for Phase 16 Billing Dashboard rebuild.
**Audience:** Engineers building the Insights tab and deep-dive cards. When a number changes, update both this doc and the code that references it.

---

## Why this doc exists

The Insights tab and deep-dive cards in the Billing dashboard show real industry comparisons (therapist vs peer averages). To stay honest with our therapists, every benchmark number needs a source.

This doc is the single source of truth for benchmark numbers used in the UI. Each entry includes:
- The number we display
- What it means
- Where it came from
- Confidence level (high, medium, low)
- Last verified date

If a number is unsourceable or we're not confident in it, we omit the comparison rather than make one up.

---

## Numbers we use

### Tip percentage (general)

**Display:** "15–20% standard, 18% average for solo independent practice"
**Source:** Multiple converging sources (NerdWallet, AMTA, Thervo, Spa Theory, Massage Magazine, Aspen Falls Wellness).
**Confidence:** High. Every source we found cites the 15–20% range. The 18% average for independent solo practice is from a 2025 Soothe (mobile massage company) operations report, plus a January 2026 article in Good Hands Massage Therapy citing AMTA 2024 workforce data.
**Notes:** Most sources do NOT specify a regional breakdown. We had hoped to find Colorado-specific data; none exists publicly. Code should use the national 18% figure with the caveat that it's a national average for solo independent practice.

### No-show rate (industry baseline)

**Display:** "18% no-show rate without automated reminders"
**Source:** SchedulingKit 50 Massage Therapy Statistics 2026 (https://schedulingkit.com/statistics/massage-therapy-statistics), citing industry research.
**Confidence:** Medium. SchedulingKit cites the number to "industry research" without naming a primary source. Cross-referenced against US Spa & Massage Therapy Statistics 2024 (Session.care), which cites similar single-no-show daily impact figures (12-20% of daily revenue lost per no-show).
**Notes:** Practices with automated reminders see a 53% reduction in no-shows (so roughly 8.5% rate with reminders). Our platform sends automated reminders, so the more appropriate peer baseline for MyBodyMap therapists is closer to 8-10%, not 18%. We should display 8% as the "peer average with reminders" benchmark in Insights.

### No-show recovery rate (% of no-shows who rebook within 30 days)

**Display:** "Industry data on no-show recovery rate is not publicly available"
**Source:** None found in publicly available LMT industry research.
**Confidence:** None.
**Notes:** We HIDE the peer comparison on this deep-dive card. The card shows the therapist's own rate (calculated from session data) without a peer average. When MyBodyMap has 50+ active therapists, we can show our own aggregate as "MyBodyMap therapist average" instead. Until then, no comparison line. The original mockup placeholder of "42% peer average" was made up and should not be shipped.

### Refund rate (industry baseline)

**Display:** "Industry data on refund rates in solo LMT practice is not publicly available"
**Source:** None found in publicly available LMT industry research.
**Confidence:** None.
**Notes:** Same approach as no-show recovery. We show the therapist's own refund rate without a peer comparison. The mockup placeholder of "3.2% peer average" was made up. Hide the comparison line until we have aggregate data.

### First-visit retention rate (% of first-time clients who book a second visit)

**Display:** "55% of first-time massage clients book a second visit"
**Source:** SchedulingKit 2026 Massage Therapy Statistics. Specifically: "45% of first-time massage clients do not return for a second visit." We invert the number for the positive framing.
**Confidence:** Medium. SchedulingKit cites "industry research" without naming the primary source. Strategies.com (salon/spa retention benchmarks) corroborates the rough number: "If First-Time Retention Rate is below 30%: 70% of first-time clients do not return", framing 30%+ as the minimum healthy threshold and 50%+ as good.
**Notes:** This is general spa/wellness data. Solo independent LMT practice may differ. AMTA 2024 data (cited via The Pushy Goat blog, May 2024): "AMTA considers <50% retention rate poor and >70% impressive." We use the SchedulingKit 55% as the median solo-LMT baseline.

### Recurring client retention rate (% who become long-term recurring clients after second appointment)

**Display:** "68% of clients who book a second appointment become long-term recurring clients"
**Source:** SchedulingKit 2026 Massage Therapy Statistics.
**Confidence:** Medium. Same caveat as above.

### Average session price (60-minute, independent practice)

**Display:** "$85 national average, $110-130 typical Denver/Front Range"
**Source:**
- National: SchedulingKit 2026 Massage Therapy Statistics ("Average revenue per massage session in the United States: $85"). Note this includes all settings (chains, spas, independent). Independent-only is higher.
- Denver/Front Range: Dragonfly Aura local blog (January 2026): "a typical 60-min massage around Denver averages around $110–$130 or more before tip." Massage Liability Insurance Group (October 2025): "A therapist in Denver now lists a 60-minute deep tissue massage at $105." Renew Massage Studio Denver (effective Jan 2026): standard rates around $115-125. Symmetry 360 Denver: $129 for 60-min (calculated from 3-pack at $387).
**Confidence:** High for the broad range. Medium for the specific median.
**Notes:** Maria's persona is set in Boulder. Boulder rates trend slightly higher than Denver. For the mockup we use $110 as the Front Range/Denver/Boulder solo independent practitioner baseline. The $85 national average includes franchise chains (Massage Envy, Hand & Stone) which significantly drag the number down. For solo independent, $98-110 is closer to truth.

### Lifetime value multiplier (recurring vs one-time)

**Display:** "Recurring clients have 5.4x the lifetime value of one-time visitors"
**Source:** SchedulingKit 2026 Massage Therapy Statistics.
**Confidence:** Medium.
**Notes:** Useful for client-concentration cards.

### Tip rate per session type (60-min vs 90-min)

**Display:** Hide for now. Show only the therapist's own data on each.
**Source:** None publicly available comparing tip percentage by session length.
**Confidence:** None.
**Notes:** Good Hands Massage Therapy article (Jan 2026) anecdotally suggests longer sessions tip slightly higher because clients perceive more value. Not a benchmark we can publish. We can show the therapist's OWN 60-min vs 90-min tip pattern from their data.

### Processing fees (Stripe card transactions)

**Display:** "2.9% + $0.30 per transaction"
**Source:** Stripe public pricing (https://stripe.com/pricing). Verified May 18, 2026.
**Confidence:** High. This is Stripe's published rate.
**Notes:** Effective rate varies based on transaction size. For a $100 session, the rate is approximately 3.2%. For a $150 session, approximately 3.1%. For deposit-only transactions ($30), the rate is ~3.9% because of the $0.30 fixed component.

### AMTA retention thresholds

**Display:** "<50% retention is below average for the industry; >70% is strong"
**Source:** AMTA 2020 industry guidance, cited via Back in Action Bodyworks (2024) and The Pushy Goat (May 2024).
**Confidence:** Medium-high. AMTA publishes this directly; secondary sources are reporting AMTA's own framework.
**Notes:** Useful framing for the retention card in Insights. We can say "AMTA considers 70%+ retention strong" without implying a competitive ranking, just a normative threshold.

---

## Numbers we will NOT use

### "82nd percentile health score" or any "you beat X% of LMTs" framing

We do not rank therapists against each other competitively. LMTs are a collaborative profession (sharing tips in Facebook groups, referring clients to each other, attending conferences together). Ranking framing alienates the user.

We use peer averages descriptively: "Solo LMTs in your region typically see Y%. You see X%." We do not say "You're in the top Z%."

### Made-up benchmarks from the original mockup

The mockup v3 included these numbers I invented:
- "42% peer average" for no-show recovery rate
- "3.2% peer average" for refund rate
- "11% Colorado tip average"

These will be REMOVED in the build. The comparison lines will not appear until we have a real source.

---

## What to do when we want to add a new benchmark

1. Search for the data in publicly available sources (AMTA, BLS, IBISWorld free abstracts, SchedulingKit, industry trade publications)
2. If found: add an entry to this doc with source URL and confidence level
3. If not found: show only the therapist's own data, no comparison line
4. Never invent a number to make the comparison "complete"

---

## What to do when our own aggregate data becomes statistically useful

Once MyBodyMap has 50+ active therapists, our own data becomes a more relevant peer comparison than national industry averages. The mental model:

- N < 20: don't claim "MyBodyMap therapist average," show only national industry data
- N = 20–49: show industry data, optionally show our own aggregate with a note "based on N MyBodyMap therapists"
- N ≥ 50: prefer our own aggregate as the peer benchmark, since it reflects the kind of practice that uses our platform

This doc should be updated when we cross each threshold.

---

## Source URLs

- AMTA Massage Therapy Industry Fact Sheet: https://www.amtamassage.org/publications/massage-industry-fact-sheet/
- AMTA 2024 Massage Profession Research Report (free to AMTA members): https://www.amtamassage.org/publications/massage-profession-research-report/
- SchedulingKit 50 Massage Therapy Statistics 2026: https://schedulingkit.com/statistics/massage-therapy-statistics
- Session.care US Spa & Massage Therapy Statistics 2024-2025: https://session.care/industry/spa-massage-therapy-statistics
- BLS Occupational Outlook for Massage Therapists: https://www.bls.gov/ooh/healthcare/massage-therapists.htm
- Stripe pricing: https://stripe.com/pricing
- Strategies.com salon/spa retention benchmarks: https://strategies.com/what-client-retention-rates-say-about-your-salon-or-spa
- Back in Action Bodyworks client retention article: https://www.backinactionbodyworks.com/blog/client-retention-trends-in-the-therapeutic-bodywork-industry
- Good Hands Massage Therapy 2026 tipping guide: https://goodhandsmassagetherapy.com/massage-therapist-tipping-guide-2026-professional-etiquette-rates-by-service-type-and-setting/
- NerdWallet massage therapist tipping: https://www.nerdwallet.com/finance/learn/how-much-to-tip-massage-therapist
