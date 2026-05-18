# Billing Dashboard Strategy

**Last updated:** May 18, 2026 morning
**Audience:** HK, and any future designer/engineer working on the Billing tab UI/UX.
**Status:** Strategy + design recommendation. Implementation pending HK approval.
**Companion doc:** [`BILLING_STRATEGY.md`](./BILLING_STRATEGY.md) covers payment-processing architecture (Stripe/Square, money transmitter law, refunds). This doc is about the dashboard the therapist looks at.

---

## Why this doc exists

After the Phase 12-14 marathon on May 17, the Billing tab has solid data plumbing (session_payments, cancellation_charges, refunds, leakageSessions, paymentSessions buckets all wired). But HK's verdict on May 18 morning was honest:

> "We don't have the sort of insights that we developed in the schedule tab. It did not, it's extremely poor. We did a lot of things yesterday, which seem like shortcuts. Both in terms of design as well as in terms of the content that we have on the billing tab."

HK is right. The page today is:
1. A hero card showing total collected for the period
2. Four stat cards: Expected, Actual, Pending, Collection Rate
3. A day-chip selector
4. A list of session rows

That is data. It is not understanding.

A 70-year-old solo LMT doesn't open her Billing tab to read a list. She opens it to answer questions. This doc names those questions, designs an answer, and proposes a layout.

---

## The persona, in plain language

**Maria. 67 years old. Solo LMT for 22 years. Boulder, Colorado.**

- Sees 18 to 25 clients per week. Charges $110 for a 60-minute session, $145 for 90-minute. Takes Card, Cash, Venmo, occasionally Check.
- Tips are typical in her practice. She's never tracked them carefully. Probably 12 to 18 percent of clients tip; she has no idea of the average tip amount.
- She got the MyBodyMap PWA installed by her niece. Uses it daily on her iPhone. Doesn't open the web version on a laptop. Has never used a "dashboard" before.
- Her relationship with money is anxious. She is not making her old salaried income. Every dollar matters. She also doesn't track expenses well and uses a paper notebook for cash payments.
- She doesn't read software. She glances. If something doesn't communicate in 3 seconds, she scrolls past it.
- She is suspicious of complicated charts. She trusts a number with a label.
- She is, however, deeply interested in:
  - Did I have a good week?
  - Am I doing better than last month?
  - Did Tracy pay yet?
  - Am I leaving money on the table?
  - How are my tips trending?
- She does NOT care about: capability matrices, GAAP-style P&L, MRR, churn, LTV. Industry benchmarks are interesting, not central.

Every design decision in this doc passes through Maria.

---

## What the Billing tab should answer

Three time horizons of attention. The design has to serve all three.

### 3-second glance (the unlock screen test)
She taps the Billing tab. Before her thumb moves to scroll, she should know:
- **Did I make money today?** (A dollar number, big, calm)
- **Is that good or bad?** (One comparison: vs yesterday, or vs typical day)
- **Anything urgent?** (Outstanding payments, no-shows, refunds that need attention)

If she can't answer those three in 3 seconds, the page failed.

### 30-second scan
She scrolls a bit. Now she should be able to answer:
- **Where did the money come from?** (By method: card / cash / Venmo / Zelle / check)
- **How much was tips?** (Total tips, tip rate, vs typical)
- **Who paid?** (Quick session list, NOT the primary content)
- **What's pending?** (Outstanding rows)
- **Did any session get refunded today?** (Subtle, visible)

### 3-minute deep view
She taps something to expand it. Now she sees:
- **Detail per session:** client, service, method, tip, time
- **Comparison vs industry / typical:** "Your tip rate is 14 percent. Average solo LMT in your region is 11 percent."
- **Trends over the period:** small visualization showing the income shape

---

## Industry / adjacent app inspiration

Rather than recreate the JNAP-style competitor comparison HK has already done, this section identifies what to STEAL from each.

### Square Dashboard
- **What's good:** big number top of screen. Period selector chips. Transaction list one tap away. Comparisons in muted secondary text. Color used only for actionable items (red for refunds, green for tips).
- **What to steal:** the calm header. Period selector layout. Method breakdown chips.
- **What to leave:** Square's reports tab is too dense for Maria. Don't bring deep filters.

### Stripe Dashboard
- **What's good:** the "gross volume" vs "net volume" distinction is honest. Trend sparklines beside numbers. Hover for detail. Fee transparency.
- **What to steal:** sparklines next to numbers (small, decorative, NOT charts). Gross vs net concept ("collected" vs "after refunds").
- **What to leave:** Stripe is built for developers. Too technical, too cold.

### GlossGenius (most direct competitor)
- **What's good:** mobile-first, single-column. Income card at top with comparison. Tips called out as a separate top-level number.
- **What to steal:** tips as a top-level metric. Single-column mobile layout.
- **What to leave:** their commission to platform display (we don't take commission, that's a strategic differentiator).

### Mindbody
- **What's good:** "compared to last week" framing is universal. "Outstanding" bucket is prominent.
- **What to steal:** the comparison phrasing. Outstanding as its own bucket, not buried.
- **What to leave:** the desktop-first reports view. Mindbody is too complicated for Maria.

### Monarch / Mint / YNAB (personal finance)
- **What's good:** monthly bar charts that show the SHAPE of income. Categories with totals. "You spent $X less than last month" framing.
- **What to steal:** shape-of-income visualization (one chart, not many). Comparison framing in plain language.
- **What to leave:** budgeting features. Maria is tracking what happened, not planning.

### Apple Wallet (receipt design)
- **What's good:** every transaction is a card. Method shown clearly. Tip on a separate line. Date and merchant prominent.
- **What to steal:** the receipt card pattern for session rows. Each session row should LOOK like a clean receipt.
- **What to leave:** the wallet metaphor itself. We're not stacking cards.

### Tally / Copilot (newer finance apps for older users)
- **What's good:** typography-led design. Calm color palette. Plain English on every number.
- **What to steal:** the writing voice. "You collected $X" not "Collected: $X". "Tracy paid $90" not "Status: Paid".
- **What to leave:** financial-advisor framing.

**Synthesis:** Maria's Billing tab should feel like a Square Dashboard with the writing voice of Copilot and the visual rhythm of Apple Wallet.

---

## Strategic principles

Five rules every Billing screen must follow.

### 1. One number per band, never a table of numbers
The current page has four stat cards (Expected, Actual, Pending, Collection Rate) all visually equal. That's four competing focal points. Maria's eye doesn't know where to land.

Replace with **one primary number** per visual band, with secondary context.

### 2. Show the shape, not the spreadsheet
Maria doesn't want to count rows. She wants to feel the period. One small visualization (a 7-day bar, or a 30-day line) communicates more than 30 stat cards.

### 3. Plain English captions
"$320 collected" beats "Total revenue: $320." "Tracy still owes $90" beats "Outstanding: 1 session $90." Write captions like a friend describing the day, not a CPA describing a quarter.

### 4. Comparison or the number is meaningless
$320 today means nothing without "vs $280 yesterday" or "average Wednesday for you is $295." Every primary number must show a comparison. The comparison is the actual insight.

### 5. Tips are a top-level metric, not a footnote
Industry data: tips are 10 to 25 percent of LMT income. They're variable, they're rewarding, they're emotionally important to therapists. They deserve their own line, their own trend, their own benchmark.

---

## The information architecture (priority bands)

For Daily / Weekly / Monthly / Yearly, the same architecture. Just different time scale.

```
┌──────────────────────────────────────────┐
│  Band 1: THE NUMBER                       │
│  "$320 collected today"                   │
│  Comparison: "↑ $40 vs yesterday"         │
│  Optional: tiny sparkline trail           │
├──────────────────────────────────────────┤
│  Band 2: THE SHAPE                        │
│  Bar/line chart of period                 │
│  Mon $310, Tue $290, Wed $320, ...        │
│  One visualization, no axes labels        │
├──────────────────────────────────────────┤
│  Band 3: ATTENTION                        │
│  Anything that needs Maria's attention:   │
│    • Outstanding ($90 from Tracy)         │
│    • No-shows today                       │
│    • Refunds issued today                 │
│  Not present if all-clear (most days)     │
├──────────────────────────────────────────┤
│  Band 4: THE BREAKDOWN                    │
│  Two halves side by side on mobile:       │
│    Left: by method                        │
│      Card $180, Cash $80, Venmo $60       │
│    Right: tips                            │
│      Total tips $48 (15% of sessions)     │
├──────────────────────────────────────────┤
│  Band 5: PERIOD SELECTOR                  │
│  5-day chip strip (today centered)        │
├──────────────────────────────────────────┤
│  Band 6: SESSIONS                         │
│  Session list, receipt-style cards        │
│  Tap to expand: full breakdown            │
└──────────────────────────────────────────┘
```

Each band is collapsible/contextual. If a band is empty (e.g., no refunds today), it disappears.

---

## Daily page design recommendation

Concrete layout, written as a description of what Maria would see. Specifies content, hierarchy, and tone. Visual design (colors, typography) follows the existing sage/cream palette already established.

### Top of page: header strip (unchanged)
The existing "Billing" title + date subhead + Stripe-connected indicator stays. No change.

### Band 1: The Number

```
COLLECTED MONDAY
$320

↑ $40 (+14%) vs prior Monday
```

- "$320" is the headline. Serif, large (44px on mobile), forest green.
- Caption "COLLECTED MONDAY" sits above in small caps, gray.
- Comparison line below in 13px gray text, sage arrow for positive.
- **If no payments yet:** show "$0" calmly. Subtext: "5 sessions expected today. No payments collected yet."
- **If today is in the future:** caption changes to "EXPECTED MONDAY" and the number is the sum of expected revenue (not yet collected). Sub: "5 sessions scheduled. $X expected at session prices."

### Band 2: The Shape

A small 7-day bar chart (8px wide bars, sage), today highlighted. No axes. No labels. Just the shape.

Tap to expand → swaps to 30-day line chart inline. Tap to swap back.

### Band 3: Attention

Only shown if something is unusual today. Examples:

```
TRACY HASN'T PAID YET
60-min session at 10:00 AM. $90.
[ Send payment link → ]
```

```
JONES NO-SHOW
60-min session at 2:00 PM. No fee charged.
[ Charge late-cancel fee → ]
```

```
1 REFUND ISSUED
$45 to Sara Patel. Returned to card.
[ View detail ]
```

Tone: short, plain, actionable. One row per item. Maximum 3 rows (if more, "+ 2 more" at the bottom).

If all-clear: this band doesn't render. The most common day has nothing here.

### Band 4: The Breakdown (two columns on mobile, side by side)

**Left column: By Method**

```
BY METHOD

Card        $180  ( 56% )
Cash         $80  ( 25% )
Venmo        $60  ( 19% )
```

Subtle bar visual underlay (1px height, sage tint) showing the percentage as a horizontal fill. No actual chart.

**Right column: Tips**

```
TIPS TODAY

$48
15% of sessions

Your average: 13%
↑ above your average
```

Or, if no tips:

```
TIPS TODAY

$0
0 of 4 sessions tipped

Your average: 13%
```

The tip rate vs Maria's own average is the insight. NOT vs industry (that's Insights tab territory).

### Band 5: Period Selector

The existing 5-day chip strip stays. Each chip shows day label and session count. The count includes pending + outstanding sessions, so even a future day shows "5 sessions" if 5 are booked. This is the fix from Phase 14.3i + 14.3l, already shipped.

### Band 6: Sessions

Session list as receipt-style cards (not the current dense rows).

Each session card:

```
┌────────────────────────────────────────┐
│ Tracy Chen         60-min Swedish      │
│ 10:00 AM           Card on file        │
│                                        │
│ Session  $90.00                        │
│ Tip      $15.00                        │
│ ────────────────                       │
│ Total    $105.00                       │
│                                        │
│ ✓ Paid                                 │
└────────────────────────────────────────┘
```

Outstanding sessions:
```
┌────────────────────────────────────────┐
│ Jordan M.          90-min Deep Tissue  │
│ 2:30 PM            Not yet paid        │
│                                        │
│ Expected $145.00                       │
│                                        │
│ Pending                                │
│                                        │
│ [ Mark as paid ]  [ Send link ]        │
└────────────────────────────────────────┘
```

Refunded:
```
┌────────────────────────────────────────┐
│ Sara P.            60-min Swedish      │
│ 11:00 AM           Card on file        │
│                                        │
│ Session  $90.00                        │
│ Refund   $90.00 (returned to card)     │
│ ────────────────                       │
│ Net      $0.00                         │
│                                        │
│ ↩ Refunded                             │
└────────────────────────────────────────┘
```

Receipt-style means: typewriter-rhythm column alignment, clear total, status badge at the bottom. NOT the current row pattern which crams everything horizontally.

### Removed from the current page

- The 4-card StatRow (Expected / Actual / Pending / Collection Rate). Replaced by Band 1 (the number) + Band 3 (attention) + Band 4 (breakdown). Collection Rate as a label disappears; it's a derived concept that doesn't help Maria.
- The duplicate "Sun, May 17 - 3 sessions" header above the session list. Period selector already communicates this.

---

## Weekly view inheritance

Same architecture. Just different time bucket. Specifically:

- **Band 1:** "$1,840 collected this week" with comparison vs prior week
- **Band 2:** 7-day bar chart (becomes the primary shape for weekly view)
- **Band 3:** attention items for the week (any outstanding sessions, refunds, no-shows)
- **Band 4:** method breakdown for the week + weekly tip rate
- **Band 5:** week selector (4 weeks visible, this week centered)
- **Band 6:** sessions list, grouped by day (collapsible day headers)

Same component, different data input. ~20% additional work over building Daily once.

---

## Monthly view inheritance

Same architecture. Banner change:

- **Band 1:** "$7,820 collected in May" with comparison vs prior month
- **Band 2:** 30-day line chart (smoother than weekly bars)
- **Band 3:** attention items for the month (likely empty most months; if any unresolved outstanding sessions from earlier in the month, they bubble up here)
- **Band 4:** monthly method breakdown + monthly tip insights
- **Band 5:** month selector (3 months: prev, this, projection)
- **Band 6:** sessions list grouped by week within the month, collapsible

Monthly is where "compared to last month" insight matters most. Maria thinks in monthly income cycles.

---

## Yearly view inheritance

Maria's tax planning view. Different rhythm because the periods are months not days.

- **Band 1:** "$92,400 collected this year" comparison vs prior year same-period
- **Band 2:** 12-month bar chart, seasonality visible
- **Band 3:** attention items irrelevant at year scale; instead Band 3 becomes "TAX PREP" with: total income, total tips (likely 1099-K relevant), total refunds (deductible from gross), session count
- **Band 4:** annual method breakdown + annual tip percentage
- **Band 5:** year selector (prev, this)
- **Band 6:** monthly summaries (not session list, too long)

Maria likely opens Yearly once a quarter, more often in Q1 (tax season). Design for that low-frequency, high-stakes use.

---

## Insights tab: a different beast

The Daily/Weekly/Monthly/Yearly views are about REPORTING. Insights is about LEARNING.

Insights answers questions Maria didn't know to ask. Examples:

### Industry comparison cards (one card per insight)

```
┌──────────────────────────────────────────┐
│ TIPS                                      │
│ You make 14% in tips                     │
│ Solo LMTs in Colorado: 11% average       │
│ You're above industry average             │
│ ─────                                     │
│ A 1% increase in tip rate = +$X per year │
└──────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────┐
│ NO-SHOW RATE                              │
│ Your no-show rate is 3%                  │
│ Industry average: 8%                      │
│ You're below industry average             │
│ ─────                                     │
│ Your cancellation policy is working.     │
│ Most therapists with your retention rate │
│ have a similar policy.                   │
└──────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────┐
│ AVG SESSION VALUE                         │
│ Your average session is $112             │
│ Industry: $98                             │
│ You charge above market                   │
│ ─────                                     │
│ Your tip rate suggests clients agree     │
│ with your pricing.                        │
└──────────────────────────────────────────┘
```

### Personal benchmark cards

```
┌──────────────────────────────────────────┐
│ YOUR BEST MONTH                           │
│ March 2026: $8,920                       │
│ You're tracking 12% below that pace      │
│ for May.                                  │
└──────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────┐
│ MOST PROFITABLE DAY                       │
│ Wednesdays: $420 average                  │
│ Sundays: $180 average                     │
│ Consider opening another Wednesday slot.  │
└──────────────────────────────────────────┘
```

### Trend insights

```
┌──────────────────────────────────────────┐
│ CLIENT RETENTION                          │
│ 73% of your clients book again within    │
│ 8 weeks.                                  │
│ Industry: 58%.                            │
│ Your client base is unusually loyal.     │
└──────────────────────────────────────────┘
```

### Design principles for Insights tab

- **Card-per-insight format.** Each card is one self-contained idea Maria can read and forget about. Stack vertically.
- **Plain English headline.** "You make 14% in tips" not "Tip percentage: 14%."
- **Personal data first, industry data second.** Lead with what's true for Maria, then show the benchmark.
- **Actionable closer.** End each card with a sentence that suggests what to do, OR confirms she's doing well.
- **Show 3-5 insights at a time.** Rotate them. Insights tab should reward repeat visits.

### Industry benchmark data sources (need sourcing)

To make Insights real, we need actual industry benchmarks for LMTs:

- AMTA (American Massage Therapy Association) survey data, annual
- IBISWorld industry reports (massage therapy)
- BLS occupation data for massage therapists
- Anonymized aggregate data from MyBodyMap therapists once we have 50+ active

For Phase 1 Insights, we can hard-code 5 to 8 benchmark figures with citations. Future: aggregate from our own data once N is large enough.

---

## Implementation phasing

To avoid the "5 hours of building and HK is unhappy again" outcome, phase the work in shippable bites.

### Phase A: Daily page redesign (~3 hours)
- New BandLayout component (one component, six bands)
- Band 1: number + comparison + sparkline
- Band 2: 7-day bar chart (recharts)
- Band 3: attention items (only renders when non-empty)
- Band 4: method breakdown + tips card
- Band 5: existing chip strip (no change)
- Band 6: receipt-style session cards (replaces SessionRow)

Ship and verify with HK before touching Weekly.

### Phase B: Weekly + Monthly inherit (~1.5 hours)
- Same BandLayout, different period data
- Confirm 7-day chart becomes the weekly hero, 30-day line is monthly hero
- Test side-by-side with Daily

### Phase C: Yearly view rebuild (~1 hour)
- Same BandLayout with the "TAX PREP" band replacing the attention band
- 12-month bar chart
- Monthly summaries replacing session list

### Phase D: Insights tab v1 (~2 hours)
- Card layout
- Hard-coded industry benchmarks for the first 5 to 8 insights
- Personal benchmark cards from existing session_payments data
- Rotation/randomization so the tab feels alive on revisit

### Phase E: Polish (~1 hour)
- Mobile spacing checks
- Empty-state copy
- Loading skeletons
- Animation tuning (subtle, not flashy)

**Total: ~8.5 hours across multiple sessions.** Each phase independently shippable.

---

## Open questions for HK

Before I start Phase A, the following decisions need to be made:

1. **The sparkline:** Band 1 includes an optional small sparkline trail. Worth the visual real estate or distracting? My recommendation: include for Weekly + Monthly views only, not Daily (a single day doesn't have a trail).

2. **Industry benchmarks sourcing:** For the first 5-8 cards in Insights, do you want me to research and propose specific benchmark numbers (with sources), or do you have figures you want to use?

3. **The 30-day chart:** Daily view's Band 2 shows 7 days. Tap to expand to 30 days. Or should it default to a 30-day shape (since that's more useful trendwise)? My recommendation: 7 days default, 30 days on tap. Less initial cognitive load.

4. **Refund display in receipts:** Refunded sessions show net = $0 in the receipt example above. Alternative: show as a separate "Refunds" row OR a strikethrough on the original payment row. My recommendation: separate card, status='Refunded' badge, original payment + refund shown as two lines. Tax clarity.

5. **Tips benchmark for Band 4:** Compare to "your average" or "industry average"? My recommendation: "your average" in the daily/weekly/monthly views (personal context). Industry average lives in Insights tab.

6. **Session card density:** Receipt-style cards are larger than today's rows. On a busy day (10+ sessions), the scroll is longer. Worth it? My recommendation: yes: receipt is calmer to read, and Maria's typical day is 3-5 sessions, not 10.

7. **Yearly view priority:** Build this in Phase C, or defer until tax season Q1 2027 is closer? My recommendation: build it in Phase C, ship without polish, polish in Q4.

8. **Schedule tab as the model:** HK referenced Schedule's insight depth. Specifically what about Schedule should the Billing tab borrow? Examples I see: paid-vs-unpaid visual states, day chip strip with counts, slide-over for detail. Anything else from Schedule you want me to ensure Billing matches?

---

## Anti-goals (what this is NOT)

To prevent scope creep and design drift, the following are explicit non-goals:

- **Not a P&L statement.** No expenses, no profit calculation. That's accounting software territory (QuickBooks, Wave).
- **Not a tax filing tool.** Yearly view supports tax PREP; it doesn't file. Maria still hands her CPA a download.
- **Not a forecasting tool.** No projections beyond the period selector's reach.
- **Not a goal-setting tool.** No "set your monthly target." That's Insights tab territory (and even there, only as benchmark, not goal-tracking).
- **Not a multi-therapist tool.** Solo LMT is the unit. When we expand to clinics in Phase X, the Billing tab becomes per-LMT-within-clinic, but the design carries over.

---

## Reference: the Phase 14.3 data layer (don't break)

The data layer that feeds these views is already shipped and verified. Five session buckets:

- `paymentSessions`: succeeded payments (cash, card, Venmo, etc.)
- `refundSessions`: refunded payments
- `cancellationSessions`: late-cancel fees charged
- `noShowSessions`: no-show fees charged
- `leakageSessions`: confirmed bookings with no payment (pending if future, outstanding if past)

All bucketed by **session date** (booking_date + start_time), not by payment date. This is the correct mental model for Maria and must be preserved through the redesign.

When redesigning, USE these buckets. Don't rebuild the data layer.

---

## Closing note for HK

This is the strategic frame. Specifics like exact pixel values, color shades, animation timings will be worked out during Phase A. But the band structure, the persona-led tone, the priority bands, the receipt pattern: those are the decisions that need your buy-in before I write code.

When you approve this doc (or revise it), I'll start Phase A. Estimated 3 hours, single commit, with HK review before merge.

No shortcuts.
