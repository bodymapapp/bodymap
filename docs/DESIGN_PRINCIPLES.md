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

## How to use this document

- **Before opening a new file or section:** check rule #1.
- **Before writing code that sends a message:** check rules #2, #5.
- **Before estimating:** check rule #3.
- **Before responding to a screenshot:** check rule #4.
- **Before writing a status update:** check rule #6.
- **Before saying "done":** check rule #7.

When breaking a rule is the right move (it sometimes is), document
the exception inline AND add the rule's incident log here. The
rule's value comes from the cost being remembered.
