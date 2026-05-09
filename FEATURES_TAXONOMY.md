# Features Taxonomy

**Last updated:** May 9, 2026 (renamed from CONTRIBUTING.md)

This file is the canonical rule set for how features get added to MyBodyMap. It defines the seven external-marketing ribbons, the design principles, and the rules for placing new feature cards. Future Claude sessions: read this before building any new user-facing feature. HK reads this when something feels misplaced and wants to push back.

---

## Design principles

Six principles that drive every feature decision. When two of them conflict, "deeper" usually wins, but call it out and discuss before deciding.

### Deeper, not wider
A feature that solves one therapist's real problem all the way through beats a feature that solves five therapists' problems halfway. Card-on-file at booking is "deeper" because it goes from the policy in Settings, through the booking page mandate, through the cancellation modal, through the actual charge, through the audit trail. We did all five. We do not ship the policy without the charge.

### Simpler than competitors are
Vagaro takes 12 steps to set up a calendar. Acuity's pricing is a maze. ClinicSense buries SOAP notes behind a paywall. Our default is fewer steps, fewer toggles, fewer screens. When in doubt, hide the option. When the option must exist, default it sensibly so most therapists never touch it.

### Automated where it should be
Things that only happen because someone remembered to do them are bugs. Reminders, follow-ups, lapsed-client outreach, recurring memberships, cancellation charges all run by themselves on the right trigger. The therapist's input is required only at setup and exception handling.

### Modern, with a way out
Use the current best primitive (Stripe Connect, Square Web Payments SDK, modern React patterns) but never paint into a corner. The PaymentProvider abstraction with versioned strategies is the canonical example: today's V1 strategy can be replaced with V2 when Square ships a better recurring billing API, without rewriting any edge function. Same principle applies to all integrations: build through an abstraction layer that keeps swapping cheap.

### Changeable as new tech comes out
What we ship today is going to be partially obsolete in 18 months. ACH-by-link, FedNow real-time payments, Apple Pay later integrations, AI agent payments are all coming. Architecture choices that lock us out of adopting them are wrong even when they ship faster today. When considering a feature, ask: "If [thing that does not exist yet] becomes the standard in two years, how hard is it for us to adopt?" If the answer is "we rewrite half the codebase," reject the architecture and find a better one.

### No shortcuts
We do the right thing the right way the first time. When two implementation paths exist, the "smaller diff but lower quality" path is almost never correct, no matter how late it is. Shortcuts compound: a Card Element with a Payment Request Button bolted on top costs less today than the unified Payment Element migration, but every future feature touching payment input pays the tax of having two mounted elements with separate event flows. Ship the harder, better version. If the harder version cannot fit in the time available, defer the entire work rather than ship the shortcut.

This principle is the explicit override for the rest. If "deeper, not wider" suggests a small surface and "no shortcuts" suggests a larger but proper implementation, "no shortcuts" wins. Quality compounds; technical debt also compounds, but in the wrong direction.

---

## The seven-category taxonomy is the source of truth

Every user-facing feature lives in exactly one of these seven categories. The categories are defined in `src/data/featuresData.js` as the `RIBBONS` constant. The seven ribbons render identically on the Home page and the Features page.

| ID | Name | What lives here |
|---|---|---|
| 1 | Find & Book | How clients discover and book |
| 2 | Know Your Client | Intake, preferences, waivers |
| 3 | Client Intelligence | Patterns, history, AI insights |
| 4 | Day-of-Session | What happens at the session itself |
| 5 | Relationships | Email, reminders, lapsed clients |
| 6 | Money & Protection | Billing, policies, legal, security |
| 7 | On Your Phone | PWA, push, founder comms, switch tools |

---

## Rules

### Rule 1 · Every feature belongs to exactly one ribbon
A new feature gets a card slot inside one of the seven ribbons, with a taxonomy id like `6.5` or `2.7`. There is no "outside the seven categories" placement on Home, Features, or anywhere else marketing-facing.

**Bad:** Bolt a `<PaymentParityCard />` section onto the bottom of Home.jsx outside any ribbon.
**Good:** Add a card to ribbon 6 (Money & Protection) called "Stripe + Square parity" with id `6.5`.

### Rule 2 · Subfeatures must be meaty enough to deserve a slot
Not every backend change or polish task earns a taxonomy slot. The bar for adding a new card is:
- It is something a therapist would notice or care about
- It is something we would mention if we were selling MyBodyMap to them
- It is not just a bug fix or a refactor
- It can be described in two paragraphs without filler

**Confirm with HK before adding a new card.** Send the proposed `id`, `name`, and a one-line description. Do not ship a new card unilaterally.

### Rule 3 · Reordering within a ribbon is allowed
Subfeature ordering inside a ribbon reflects importance, not chronological order. If a new card 6.5 is more important than the existing 6.2, it can be promoted to 6.2, with 6.2 becoming 6.3, 6.3 becoming 6.4, and so on. Renumber the rest of the cards in that ribbon to keep ids contiguous.

When this happens:
- Update `src/data/featuresData.js` ids
- Update any code that references the moved id (e.g. `matchesSearch('...', '...', '6.2')` in Dashboard search taxonomy)
- The renumber is a sweep across the codebase, not just the data file

### Rule 4 · One animated demo per ribbon, optional more
Each ribbon currently has one animated demo on the Home tour (BookingDemo, BodyMapDemo, PatternDemo, ScheduleDemo, BillingDemo, AIDemo, plus the new ones we add). Demos visualize a representative feature from that ribbon, not every card.

It is acceptable for individual cards inside a ribbon to also have their own animated demos when the feature is differentiating enough to warrant standalone visualization (e.g. cancellation policy tier rows are unique to MyBodyMap; deposit flow is just standard Stripe checkout and does not need its own demo).

### Rule 5 · No standalone marketing surfaces
Top-of-Home banners, splash screens, side rails, and other "outside the ribbon" surfaces are reserved for time-bound launch announcements (e.g. "JUST SHIPPED: Cycle-aligned scheduling"). Permanent feature content lives in the ribbons.

### Rule 6 · Confirm with HK before adding cards
Repeating Rule 2 because it matters most: do not add a new card to featuresData.js without HK's explicit OK. Send the proposed slot, name, and one-line summary. Wait for confirmation. The taxonomy is small on purpose and bloating it with marginal cards weakens the entire structure.

---

## Examples

### Example 1: card on file at booking
- Belongs in: ribbon 6 (Money & Protection)
- Proposed slot: 6.5 or 6.6, depending on importance
- One-liner: "Save a card at booking, charged automatically only if cancellation policy triggers a fee. Both Stripe and Square."
- Confirm with HK: yes, this is meaty enough · it is the differentiator for the cancellation policy feature

### Example 2: a backend refactor of the auth flow
- Belongs in: nowhere
- Reason: not a user-facing feature; therapists do not see refactors. Keep in the codebase, log in commit history. Do not add a card.

### Example 3: a new push notification type for "client booked next session"
- Belongs in: ribbon 7 (On Your Phone)
- Proposed slot: 7.2 already exists for "Push notifications" · does not need a new card. The existing card mentions "when a client books" generically. Update the existing card if needed, do not add a new one.

---

## Detailed feature reference

This section catalogs every card currently in the taxonomy. Each row notes whether the feature is **core differentiation** for MyBodyMap (something competitors do not have or do meaningfully worse) or **table stakes** (something every modern practice management tool offers; we have it because the absence would be disqualifying).

A "core differentiation" mark means this is one of the things a sales conversation should lead with. A "table stakes" mark means we have it but should not lead a sales conversation with it.

### Ribbon 1: Find & Book

| ID | Card | Differentiation | Notes |
|---|---|---|---|
| 1.1 | Custom booking page | Table stakes | Every modern tool offers a personalized booking URL. Ours is at `mybodymap.app/{custom_url}`. |
| 1.2 | Cycle-aligned scheduling | **Core differentiation** | Tag services to menstrual cycle phases. Booking page filters automatically. No competitor offers this. |
| 1.3 | Services catalog | Table stakes | List of services with prices, durations, descriptions. Every tool has this. |
| 1.4 | Availability and hours | Table stakes | Set your working hours, time zones, breaks. Every tool has this. |
| 1.5 | Deposits at booking | Table stakes | Standard Stripe / Square hosted checkout deposit flow. We do it well but it is not unique. |
| 1.6 | Cal.com sync | Table stakes | Two-way sync with Cal.com (and through it, Google Calendar). Modern tools all do this. |
| 1.7 | Blocked days | Table stakes | Mark specific days off, block recurring patterns. Every tool has this. |
| 1.8 | Website embed | Table stakes | iFrame snippet to embed booking on your own site. Every tool has this. |

### Ribbon 2: Know Your Client

| ID | Card | Differentiation | Notes |
|---|---|---|---|
| 2.1 | Visual body map intake | **Core differentiation** | Client taps body parts to indicate pain / focus areas. Stored as structured data. Competitors offer text-only intake. |
| 2.2 | Customize your intake | Table stakes | Add custom questions to intake form. Most modern tools support this. |
| 2.3 | Session preferences | **Core differentiation** | Per-client preferences (pressure, music, room temp, oils) tracked across sessions. Competitors capture these in unstructured notes. |
| 2.4 | Signed waiver, bundled in | Table stakes | ESIGN-compliant e-signature on intake form. Standard offering. |
| 2.5 | Smart pre-fill on return | **Core differentiation** | Returning clients see their last intake pre-filled, edit only what changed. Saves them 5 minutes every visit. Competitors make every intake a fresh form. |
| 2.6 | Client notes and medical flags | Table stakes | Therapist-side notes on each client. Every tool has this. |
| 2.7 | QR codes for everything | Table stakes | QR code generation for booking page, gift cards, etc. Modern table stakes. |

### Ribbon 3: Client Intelligence

| ID | Card | Differentiation | Notes |
|---|---|---|---|
| 3.1 | Longitudinal heatmaps | **Core differentiation** | Visualize how a client's tension patterns evolve over months / years on a body map heatmap. Unique to massage therapy and unique to MyBodyMap. |
| 3.2 | Full session history | Table stakes | List of past sessions per client with notes. Every tool has this. |
| 3.3 | MyBodyMap Platform chat | **Core differentiation** | Therapist can chat with an AI assistant that has full context of their clients, sessions, and patterns. No competitor offers this. |
| 3.4 | Pattern detection | **Core differentiation** | AI surfaces patterns across a client's sessions ("right shoulder consistently tight on Monday mornings"). Unique. |
| 3.5 | Practice Pulse | **Core differentiation** | Therapist-level dashboard showing which body regions appear most across all clients, trending tension types, etc. Aggregate intelligence. Unique. |

### Ribbon 4: Day-of-Session

| ID | Card | Differentiation | Notes |
|---|---|---|---|
| 4.1 | Today's schedule | Table stakes | List of today's appointments with quick actions. Every tool has this. |
| 4.2 | Pre-session brief | **Core differentiation** | AI-generated 2-3 sentence summary of the upcoming client (recent issues, preferences, patterns). Read in 30 seconds before they arrive. Unique. |
| 4.3 | Post-session SOAP notes | Table stakes | Standard SOAP-format note template. ClinicSense paywalls this; we include it. |
| 4.4 | Quick client lookup | Table stakes | Fast search across client list. Every tool has this. |
| 4.5 | Mobile-first UX | Table stakes | Responsive dashboard that works well on iPhone. Modern table stakes. |

### Ribbon 5: Relationships

| ID | Card | Differentiation | Notes |
|---|---|---|---|
| 5.0 | Personalized campaign emails | **Core differentiation** | AI-drafted email campaigns with personalization at the per-client level (using session history, preferences, last visit). Competitors offer mail merge templates. |
| 5.1 | Automated reminders | Table stakes | Pre-session SMS / email reminders. Every tool has this. |
| 5.2 | Gift cards | Table stakes | Sell gift cards from the booking page. Modern tools have this. |
| 5.3 | Post-session follow-up | Table stakes | Automated thank-you / feedback email after the session. Most modern tools have this. |
| 5.4 | Lapsed client outreach | **Core differentiation** | Automatically identifies clients who have not booked in 60+ days and drafts personalized re-engagement messages with AI context. Competitors offer time-based reminders only. |
| 5.5 | Loyalty rewards | Table stakes | Points or session-credit rewards for regular clients. Some competitors have this. |
| 5.6 | 5-dimension feedback | **Core differentiation** | Structured client feedback on pressure, communication, results, environment, value. Aggregates over time per therapist. Unique. |

### Ribbon 6: Money & Protection

| ID | Card | Differentiation | Notes |
|---|---|---|---|
| 6.1 | Billing dashboard | Table stakes | Revenue, expected vs actual, exportable. Every tool has this. |
| 6.2 | Cancellation policy | **Core differentiation** | Tier-based auto-charge (no charge / 50% / 100%) with explicit client mandate at booking. Most competitors have policy in name only; we actually charge. |
| 6.3 | Legally signed waivers | Table stakes | ESIGN-compliant waivers with audit trail. Standard. |
| 6.4 | Privacy and security | Table stakes | HIPAA-grade encryption. Standard for serious tools. |
| 6.5 | Stripe + Square, both fully | **Core differentiation** | Connect either or both processors with per-feature routing. No competitor offers dual-processor parity; they all force their own merchant relationship. |
| 6.6 | Card on file at booking | **Core differentiation** | Save card at booking with explicit mandate, charged only on policy trigger. MassageBook paywalls this; we include it on every plan. |
| 6.7 | One-tap refunds | Table stakes | Refund button in dashboard, no need to log into Stripe / Square. Modern tools mostly have this. |

### Ribbon 7: On Your Phone

| ID | Card | Differentiation | Notes |
|---|---|---|---|
| 7.1 | Install to home screen | Table stakes | PWA install. Modern table stakes. |
| 7.2 | Push notifications | Table stakes | Browser push for new bookings, cancellations. Modern table stakes. |
| 7.3 | Founding Therapist emails | **Core differentiation** | Joy persona, personalized founder communication channel. Competitors at this scale do not have a founder voice. |
| 7.4 | Refer and reward | Table stakes | Referral link generation. Standard. |

---

## Differentiation summary

Of 41 total cards across the seven ribbons:

- **15 cards are core differentiation** (37%)
- **26 cards are table stakes** (63%)

That ratio is healthy. Too few core differentiators (under 25%) means we are a feature-parity tool and clients have no reason to switch. Too many (over 50%) means we are over-claiming and the table-stakes work has been neglected.

The 15 core differentiators cluster heavily in two ribbons:
- **Ribbon 3 (Client Intelligence): 4 of 5 cards differentiated** · this is the strongest moat
- **Ribbon 6 (Money & Protection): 3 of 7 cards differentiated** · payment parity and explicit cancellation enforcement

Ribbons 1 (Find & Book) and 4 (Day-of-Session) are mostly table stakes. That is fine. We do not have to be best-in-class at every category; we have to be best-in-class at the ones that matter most for our wedge.

---

## When in doubt

If you are not sure whether something deserves a new card or where it goes, the answer is: ask HK. The taxonomy is short on purpose. Adding cards bloats it. Renumbering frequently makes it harder to maintain. Asking is cheap.
