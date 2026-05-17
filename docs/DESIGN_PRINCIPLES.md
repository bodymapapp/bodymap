# DESIGN_PRINCIPLES.md

Rules that exist because we broke them once. Each one has a specific
incident attached so future work understands the cost of breaking it
again. Read this before adding any new section, page, or template
variant.

---

## 1. The seven ribbons are the taxonomy. Don't invent sections.

**Rule.** Every feature must live inside an existing surface format.

- **Home page:** inside one of the seven ribbons (Find & Book, Know
  Your Client, Client Intelligence, Day-of-Session, Relationships,
  Money & Protection, On Your Phone). Add a sub-feature or replace
  the demo. Never add a standalone section between ribbons.
- **Features page:** inside one of the 17 lettered sections, or
  expand an existing one. Never add a section without updating
  SectionNav.
- **WhyMyBodyMap page:** as an entry in the `ONLY_MBM` array
  (rendered via `OnlyItem`), the `PEACE_BLOCKS` array (rendered via
  `PeaceCard`), or the `COST_COMPARISON` array. Never invent a new
  section template.

**Incident: May 16 2026, Phase 4.1 SmartCalendarAnimation.**
The previous session added a `bm-why-v2-spotlight` section to
WhyMyBodyMap to host the Smart Calendar animation. This invented a
new section template that did not match any existing pattern on the
page. HK caught it: "It should go under 'The things you cannot get
anywhere else' in the format of the rest of the points there. Make
this a design principle so that we don't randomly add stuff."

**Cost.** Reverted the same day. 63 lines of CSS deleted, the
section removed, the import dropped. The Smart Calendar already had
a proper entry in `ONLY_MBM` at position 1 (`smart-booking-
intelligence`) the entire time. The visual is in Home Ribbon 4 and
Features `#schedule` where it belongs.

**Test before shipping any UI on these three pages.** "Am I using
an existing template, or did I invent one?" If you invented one,
stop and find the existing template.

---

## 2. Notifications go through one of two paths. Never invent a third.

**Rule.**
- **Therapist-side:** bell drawer + email + SMS, gated by
  `therapists.notification_prefs`. Therapist toggles per event per
  channel. Helper: `notifyTherapist({...})` in
  `supabase/functions/_shared/notifications.ts`.
- **Client-side:** email + SMS only, no in-app surface (no client
  login). Transactional default ON, marketing/win-back opt-in only.
  Helper: `notifyClient({...})` (to be built in Phase 6).

**Every new fire point gets a row in `docs/NOTIFICATION_MAP.md`
before the code lands.** If a notification is not in
NOTIFICATION_MAP, it does not exist.

---

## 3. Don't reframe an unstated requirement into a safer one.

**Rule.** When HK says "X is needed," do exactly X. Do not silently
narrow the scope to make it easier. State what you understood, what
you'll build, the estimate. Wait for OK on anything over an hour.

**Incident: May 16 2026, Smart Calendar v1.**
HK asked for an animation that showcases all three Smart Calendar
pillars (Fill This Gap, Up-Next Briefing, Body Load Awareness).
V1 only built Fill This Gap and buried the other two in one-line
mentions. HK caught it. V2 had to be rebuilt with all three pillars
cycling.

**Cost.** Phase 4 work redone as Phase 4.1, ~3 hours, same day.

---

## 4. Read uploaded screenshots completely before responding.

**Rule.** HK uploads screenshots when text alone can't explain the
issue. Read the entire image, including buttons, modal copy, side
panels. Acknowledge what's in the screenshot before responding.

**Practical test:** count the visible UI states in the screenshot.
If your response addresses fewer than half of them, look again.

---

## 5. Communication strategy is a first-class deliverable.

**Rule.** Any feature that touches a booking, a payment, or a
client lifecycle moment must have its notifications mapped at
design time, not patched in later. Reschedule, cancellation,
no-show, payment, refund, new client, lapsed regular: each one has
a sender, an audience, channels, copy, and a frequency rule.

**Incident: May 16 2026, no-show no-card flow.**
The May 16 no-show button shipped without client-side
notifications for the no-card case. Booking gets marked no-show,
client receives nothing, therapist has no way to ask for the fee.
HK caught it. The gap was symptomatic of a wider miss: reschedule
and therapist-initiated cancel also had no client communication.

**Fix.** `docs/NOTIFICATION_MAP.md` becomes the source of truth.
Any PR that adds a state change to a booking must update this
file. If it doesn't, the PR is incomplete.

---

## 6. Status changes preserve distinctions, not collapse them.

**Rule.** `cancelled` is not the same as `no_show`. `confirmed` is
not the same as `pending-approval`. When writing a status update,
the new status must accurately describe what happened, not just
"end state of this row."

**Incident: May 16 2026, Phase 2.2 fix.**
Before Phase 2.2, no-show flow wrote `status: 'cancelled'`,
collapsing the distinction. `Timeline.jsx` already recognized
`'no_show'` as separate. Reporting + retention analysis would have
been off forever.

---

## 7. Don't claim verified what you haven't verified.

**Rule.** "Built clean" means `npm run build` passed. It does NOT
mean a human used the live site. Until HK confirms a real
behavior on a real device, the work is "shipped but unverified."
Use exactly that phrase in commit messages and status reports.

---

## 8. For money decisions: the therapist decides, the system notifies.

**Rule.** When money could change hands on a booking, the platform
must NEVER act automatically without a human tap. Instead:

1. Show the therapist the situation: who, what, paid so far, card
   on file, policy, timing. All facts on one screen.
2. Suggest the action that follows from the therapist's own policy.
3. Show 2-3 alternative actions (waive fee, custom amount, etc).
4. Wait for one tap.
5. Once tapped, execute the charge or refund AND fire all the
   notifications AND attach the policy AND log the audit trail.
   All of it automatic from that point.

**The platform doesn't try to be smart about the therapist's
business policy. It gives them the tools to be smart about it
themselves, then handles the transparency for them.**

**Incident: May 16 2026, Phase 7 billing matrix.**
The first attempt at a billing rules doc had 28 automated rules
across 6 scenarios with 7 open questions about edge cases. HK
caught it: "This is the reason competitors don't do it well, or
do it poorly. It opens us up for a lot of questions and back-and-
forth on what is right versus wrong. How can we come up with a
global design principle giving therapist the power to charge. We
focus primarily on notifications so that there is full
transparency."

**Cost.** Phase 7.2 and Phase 7.3 (the matrix iterations) were
~3 hours of work that produced a document HK had to push back on
twice. Phase 8.2 collapsed all of it to one principle. The
correct framing was hiding behind the wrong abstraction the whole
time.

**Test before shipping any money-touching feature.** Does the
therapist see what they need to see and tap once? Or did we try
to decide for them? If it's the second one, redesign.

---

## 9. The seven ribbons are the taxonomy. The user keeps growing the catalog within them.

**Rule.** Every new feature, no matter how small, plugs into one
of the existing seven ribbons (Find & Book, Know Your Client,
Client Intelligence, Day-of-Session, Relationships, Money &
Protection, On Your Phone). Sub-features get numbered (1.8, 2.6,
etc). New ribbons require a unanimous reset of the marketing
copy and SHOULD essentially never happen.

**Incident: May 16 2026, Private Services request from Candice.**
Candice asked for a service-level visibility toggle. The temptation
was to invent a new product area for "service catalog management."
The right answer was: this is sub-feature 1.X under Find & Book.
Add a column, add a toggle, ship. Total: 4 hours including the
backend migration.

**Test before adding a product surface.** Does this fit inside
one of the seven ribbons? If yes, what number? If no, you're
proposing a new ribbon and you need to argue for it explicitly.

---

## 10. Industrialize the test, not the tester.

When validating a system with N permutations, build the matrix
once and let the system color itself based on observable evidence.
Never ask a human to click through N permutations by hand.

The cost of building the matrix is paid once. The cost of clicking
through it manually is paid every release, every notification copy
change, every new touchpoint. The cost compounds.

This applies to:

- **Notification compliance:** dashboard showing every touchpoint x
  every channel, colored by `notification_log` status. Founder
  fires one real event; rows light up across all expected channels;
  red cells are real gaps.
- **Feature parity audits:** matrix of features x plans, colored
  by what the code actually checks vs what marketing claims.
- **Customer support readiness:** matrix of customer issues x
  resolution paths, colored by whether the resolution actually
  exists in product.
- **Email/SMS deliverability:** matrix of message templates x
  recipient types, colored by sender reputation and bounce rate.

**The rule:** if you find yourself instructing a human to follow
a checklist with more than ~5 items, the checklist should be a
dashboard. The dashboard reads the same data the human would
read, so the human stops being the integration test.

**The exception:** brand-new features in their first week of
production sometimes warrant a manual smoke test the first few
times, before there's enough data to populate a dashboard. The
exception applies until the dashboard exists. Then it ends.

**Why this matters:** founders who manually test scale to
exactly one customer. Founders who industrialize testing scale to
the team they'll someday hire.

**Test before adding a test surface.** Will this be done more
than three times? If yes, build the matrix. If no, do it manually
once and move on.

---

## How to use this document

- **Before opening a new file or section:** check rule #1.
- **Before writing code that sends a message:** check rules #2, #5.
- **Before estimating:** check rule #3.
- **Before responding to a screenshot:** check rule #4.
- **Before writing a status update:** check rule #6.
- **Before saying "done":** check rule #7.
- **Before automating a money decision:** check rule #8.
- **Before adding a new product surface:** check rule #9.
- **Before instructing a human to run a checklist:** check rule #10.

When breaking a rule is the right move (it sometimes is), document
the exception inline AND add the rule's incident log here. The
rule's value comes from the cost being remembered.
