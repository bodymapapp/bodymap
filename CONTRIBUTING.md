# Adding new features to MyBodyMap

**Last updated:** May 7, 2026

This file is the canonical rule set for how features get added to MyBodyMap. Future Claude sessions: read this before building any new user-facing feature. HK reads this when something feels misplaced and wants to push back.

## Design principles

Five principles that drive every feature decision. When two of them conflict, "deeper" usually wins, but call it out and discuss before deciding.

### Deeper, not wider
A feature that solves one therapist's real problem all the way through beats a feature that solves five therapists' problems halfway. Card-on-file at booking is "deeper" because it goes from the policy in Settings, through the booking page mandate, through the cancellation modal, through the actual charge, through the audit trail. We did all five. We do not ship the policy without the charge.

### Simpler than competitors are
Vagaro takes 12 steps to set up a calendar. Acuity's pricing is a maze. ClinicSense buries SOAP notes behind a paywall. Our default is fewer steps, fewer toggles, fewer screens. When in doubt, hide the option. When the option must exist, default it sensibly so most therapists never touch it.

### Automated where it should be
Things that only happen because someone remembered to do them are bugs. Reminders, follow-ups, lapsed-client outreach, recurring memberships, cancellation charges — all should run by themselves on the right trigger. The therapist's input is required only at setup and exception handling.

### Modern, with a way out
Use the current best primitive (Stripe Connect, Square Web Payments SDK, modern React patterns) but never paint into a corner. The PaymentProvider abstraction with versioned strategies is the canonical example: today's V1 strategy can be replaced with V2 when Square ships a better recurring billing API, without rewriting any edge function. Same principle applies to all integrations: build through an abstraction layer that keeps swapping cheap.

### Changeable as new tech comes out
What we ship today is going to be partially obsolete in 18 months. ACH-by-link, FedNow real-time payments, Apple Pay later integrations, AI agent payments — these are all coming. Architecture choices that lock us out of adopting them are wrong even when they ship faster today. When considering a feature, ask: "If [thing that does not exist yet] becomes the standard in two years, how hard is it for us to adopt?" If the answer is "we rewrite half the codebase," reject the architecture and find a better one.

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

## Rules

### Rule 1 — Every feature belongs to exactly one ribbon
A new feature gets a card slot inside one of the seven ribbons, with a taxonomy id like `6.5` or `2.7`. There is no "outside the seven categories" placement on Home, Features, or anywhere else marketing-facing.

**Bad:** Bolt a `<PaymentParityCard />` section onto the bottom of Home.jsx outside any ribbon.
**Good:** Add a card to ribbon 6 (Money & Protection) called "Stripe + Square parity" with id `6.5`.

### Rule 2 — Subfeatures must be meaty enough to deserve a slot
Not every backend change or polish task earns a taxonomy slot. The bar for adding a new card is:
- It is something a therapist would notice or care about
- It is something we would mention if we were selling MyBodyMap to them
- It is not just a bug fix or a refactor
- It can be described in two paragraphs without filler

**Confirm with HK before adding a new card.** Send the proposed `id`, `name`, and a one-line description. Do not ship a new card unilaterally.

### Rule 3 — Reordering within a ribbon is allowed
Subfeature ordering inside a ribbon reflects importance, not chronological order. If a new card 6.5 is more important than the existing 6.2, it can be promoted to 6.2, with 6.2 → 6.3, 6.3 → 6.4, etc. Renumber the rest of the cards in that ribbon to keep ids contiguous.

When this happens:
- Update `src/data/featuresData.js` ids
- Update any code that references the moved id (e.g. `matchesSearch('...', '...', '6.2')` in Dashboard search taxonomy)
- The renumber is a sweep across the codebase, not just the data file

### Rule 4 — One animated demo per ribbon, optional more
Each ribbon currently has one animated demo on the Home tour (BookingDemo, BodyMapDemo, PatternDemo, ScheduleDemo, BillingDemo, AIDemo, plus the new ones we add). Demos visualize a representative feature from that ribbon, not every card.

It is acceptable for individual cards inside a ribbon to also have their own animated demos when the feature is differentiating enough to warrant standalone visualization (e.g. cancellation policy tier rows are unique to MyBodyMap; deposit flow is just standard Stripe checkout and does not need its own demo).

### Rule 5 — No standalone marketing surfaces
Top-of-Home banners, splash screens, side rails, and other "outside the ribbon" surfaces are reserved for time-bound launch announcements (e.g. "JUST SHIPPED: Cycle-aligned scheduling"). Permanent feature content lives in the ribbons.

### Rule 6 — Confirm with HK before adding cards
Repeating Rule 2 because it matters most: do not add a new card to featuresData.js without HK's explicit OK. Send the proposed slot, name, and one-line summary. Wait for confirmation. The taxonomy is small on purpose and bloating it with marginal cards weakens the entire structure.

## Examples

### Example 1: card on file at booking
- Belongs in: ribbon 6 (Money & Protection)
- Proposed slot: 6.5 or 6.6, depending on importance
- One-liner: "Save a card at booking, charged automatically only if cancellation policy triggers a fee. Both Stripe and Square."
- Confirm with HK: yes, this is meaty enough — it is the differentiator for the cancellation policy feature

### Example 2: a backend refactor of the auth flow
- Belongs in: nowhere
- Reason: not a user-facing feature; therapists do not see refactors. Keep in the codebase, log in commit history. Do not add a card.

### Example 3: a new push notification type for "client booked next session"
- Belongs in: ribbon 7 (On Your Phone)
- Proposed slot: 7.2 already exists for "Push notifications" — does not need a new card. The existing card mentions "when a client books" generically. Update the existing card if needed, do not add a new one.

## When in doubt

If you are not sure whether something deserves a new card or where it goes, the answer is: ask HK. The taxonomy is short on purpose. Adding cards bloats it. Renumbering frequently makes it harder to maintain. Asking is cheap.
