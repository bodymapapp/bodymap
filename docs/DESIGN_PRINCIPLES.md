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

## 11. Imagine the 375px iPhone render before committing any UI change.

Multiple commits on May 21 2026 shipped UI that rendered fine on
desktop but broke at 375px iPhone width. Jackie sent a screenshot
of the block-off-time panel calling it "third world": "all of on
[date] to" wrapped across three lines with the "to" orphaned at
the end of row one and the second date dropping to row two.

The pattern that breaks: prose-style sentence composition with
inline inputs (`<span>on</span><input/><span>to</span><input/>`)
inside a flex container. Reads great on a wide screen. Falls
apart at narrow widths because each chunk wraps unpredictably.

**The rule:** before clicking commit on any UI change, ask "what
does this look like at 375px wide?" If you can't picture it
clearly, open dev tools or imagine harder. Don't ship and let
the customer be the QA.

**The pattern that works:** stacked vertical sections with
labeled inputs. Each input gets its own row with a small uppercase
label above it. Use flex containers with `flex: 1 1 140px` so
inputs wrap cleanly to their own row when the screen narrows.

**Incident log:**
- May 21 2026: Block panel redesign, full-day block render, multi-
day block input. All three commits shipped with desktop-only
testing. Jackie caught them. Redesigned to vertical-stacked
labeled inputs same day.

---

## 12. No silent auto-create on user input. Pre-flight or refuse.

May 21 2026, Jackie's first appointment import: one mis-mapped
column (Service dropdown pointed at first_name) caused us to
silently create 397 fake services, 397 fake memberships, and 608
fake subscriptions. All named after her clients. She tapped
Import and the platform happily wrote 1,988 fake rows.

The original code's logic: "if the service name doesn't exist,
create it." Reasonable for a happy path. Catastrophic for a
mis-mapped one. No guardrails between user input and silent
auto-creation of records.

**The rule:** any code path that auto-creates database rows from
user input must pre-flight check before writing. Two questions:
1. Does the volume look suspicious? (30+ new records from one
   import for a solo therapist = mis-mapping signal)
2. Do the values look like the right kind of thing? (Service
   names should contain massage keywords, not just be 1-2-word
   client-name-shaped strings)

If either trips, surface a blocking banner with the actual data
the user is about to create and a one-tap "skip this column"
override. Don't silently proceed and clean up later.

**Apply to:** every auto-create path. Services, memberships,
clients, locations, packages, anything user input drives. Both
import flows have this; future flows must adopt the same pattern
or skip auto-create entirely.

**Incident log:**
- May 21 2026: Jackie incident. 1,988 fake records created from
one mis-mapped CSV column. Recovery via SQL same day. Pre-flight
checks shipped for both client and appointment imports.

---

## 13. Therapist-facing numeric inputs use InlineSaveNumberInput, never raw `type="number"`.

May 21 2026, Jackie reported she couldn't change the buffer
minutes from 15 to 30. The input was `<input type="number"
min="5" max="60" step="5" value={15} onChange={parseInt || 15}>`.
On touch devices this fights the user:

1. `step="5"` constrains keystrokes on some mobile browsers
2. The onChange `parseInt(e.target.value) || 15` reverts to 15
   whenever the field is empty mid-typing
3. Clearing the field to retype = field briefly empty = parseInt
   returns NaN = falls back to 15 = her keystrokes vanish

Her workaround: select-all the existing 15 with triple-tap, then
type 30 over it. She figured this out herself and described it
as "always me every time I get a new app." It wasn't her. The
input was hostile.

**The rule:** any numeric setting a therapist might edit uses
`InlineSaveNumberInput` from `src/components/InlineSaveNumberInput.jsx`.
That component:
- Uses plain `type="text"` with `inputMode="numeric"`
- Sanitizes and clamps on commit (blur or Enter), not on every keystroke
- Flashes a green checkmark on save
- Has visible up/down +/- buttons for touch users
- Handles min/max as soft clamps, not as keystroke filters

**Apply to:** buffer minutes, lead time, max advance days,
cancellation window, deposit amount, pricing, any numeric setting
on Settings or per-record edits. Never use `<input type="number">`
in a flow a therapist will touch.

**Incident log:**
- May 21 2026: Buffer setting on Dashboard. Jackie couldn't change
the value normally. Swapped to InlineSaveNumberInput same day.

---

## 14. One way in, not two. The platform splits implementation paths transparently, never the user.

When a user has data they want to bring into the platform, there
must be ONE button. If implementation splits into multiple paths
(client vs appointment vs services), the platform decides which
path to run based on what the user uploaded, not by asking the
user to choose.

May 21 2026, Jackie ran the appointment import on her appointment-
history CSV. It worked: 124 appointments created, 466 client stubs
auto-created from the appointment rows. But her clients had no
email or phone, because the appointment CSV doesn't include
contact info per row, only client name. The actual contact info
lived in a SEPARATE client-list CSV she didn't know to upload.

The product is currently asking the user "which kind of import is
this?" That question reveals an implementation detail (two code
paths) that the user has no way to answer. Maria-persona therapists
don't know whether a given CSV is "a client list" or "an
appointment list," they just know it's "their data from
MassageBook."

**The rule:** import flows present one button. The platform
detects file types by header inspection and routes accordingly.
Multiple files at once is the norm, not the exception, because
real exports often come as separate CSVs per data type.

**Apply more broadly:** anywhere the product asks the user to
choose between implementation-flavored options (which processor
to use? which import type? which template?), step back. Either
the choice is meaningful to the user (in which case label it in
user-language, not implementation-language), or it's not (in
which case decide for them and remove the choice).

**Incident log:**
- May 21 2026: Jackie email/phone gap. Two-tab Client vs Appointment
import surface trapped a non-technical user. Unified import flow
queued as BLOCK_PLAN item #13.

---

## 15. HIPAA-aware support. Never ask a therapist to send you their client data over a non-clinical channel.

When debugging requires access to a therapist's data, the right
pattern is to build the user-side button or query that lets the
therapist operate on their own data with their consent. Their
data stays in their environment; we operate server-side via
their action.

May 21 2026, HK was about to ask Jackie to send her client-list
CSV over Facebook Messenger so we could merge it into her
account. HK caught it and pushed back: that data is HIPAA-
protected and shouldn't leave her possession via DM. The right
move was to ship a user-side button she taps, instead.

**The rule:** never request raw client data (names, contact
info, session notes, intake responses, body map data) via DM,
email, screenshot, or any non-clinical channel. If we need to
operate on a therapist's data, we build:
- A user-side button that lets them upload or trigger the
  operation
- OR a self-serve SQL preview they can run themselves to see
  what would happen
- OR (last resort) a founder-side admin tool that operates
  server-side with their explicit recorded consent

**Apply broadly:** this applies to debugging too. If we suspect
a bug in someone's data, don't ask them to paste it into chat.
Build a diagnostic that runs in their session, surfaces the
relevant info, and shows them what we need to know.

**Incident log:**
- May 21 2026: Jackie email/phone gap debugging. HK caught the
HIPAA exposure before sending the request. Unified import flow
(BLOCK_PLAN #13) is the user-side button solution.

---

## 16. Stored data and displayed data are separate concerns. Store canonical, display human.

When the system holds data that has both a stable internal form
and a human-readable form, store the stable form and convert at
the display boundary. Never store the display form.

May 21 2026, Jackie's phone numbers landed in Supabase as
`5734801030` (digits-only normalized form, stored that way to
prevent duplicate clients from format mismatches like
`(573) 480-1030` vs `573-480-1030`). But the dashboard rendered
the stored value as `5734801030`, which is unreadable.

The fix is not to store `(573) 480-1030`. That would re-introduce
the duplicate-on-import problem. The fix is to store the
canonical form and apply a formatter at the display layer:
`formatUSPhone('5734801030')` returns `(573) 480-1030`.

**The rule:** for any data type that has a normalized storage
form AND a human-readable display form, use two functions:
- `normalizeX(input)` to convert anything-shaped to canonical
  storage. Called at the boundary (CSV import, user input).
- `formatX(canonical)` to convert canonical to display. Called
  at the boundary (UI render, email composition).

Never store the display form. Never display the canonical form.

**Apply to:**
- Phone numbers: `normalizePhone()` strips to digits;
  `formatUSPhone()` renders as `(573) 480-1030`
- Dates: store as ISO `2026-05-21`; display as `May 21, 2026`
- Currency: store as integer cents; display as `$45.00`
- Email: store lowercased; display as-typed (preserve case if
  the user has a preference) or just lowercased
- Times: store as `HH:MM:00` 24-hour; display as `2:30 PM`

**Boundary discipline:** the formatter lives in
`src/lib/formatters/`. Don't sprinkle inline formatting like
`'$' + (price/100).toFixed(2)` throughout components. Import
the formatter.

**Incident log:**
- May 21 2026: Phone storage in Jackie's account. Created
`formatUSPhone` and `normalizePhone` in `src/lib/formatters/phone.js`.
Applied to ClientList + import preview screen. Other display
sites (ClientProfile, SessionDetail, etc.) to follow as touched.
- May 22 2026: Phone formatter sweep extended to SessionList,
ImportClients preview, FounderDashboard (with consolidation:
removed duplicate local `formatPhoneDisplay` function), and
FounderMassSms. Intentionally NOT applied inside `<code>` tags
on the founder debug surface (NotificationCompliance.jsx) because
that surface shows canonical storage form for engineering debugging.
The rule is about USER-facing display; debug surfaces are not user.

---

## 17. Care framing over revenue framing. The 70yo persona thinks relationally, not transactionally.

Insights, prompts, summaries, and proactive suggestions in the
therapist-facing UI must be framed in care + growth language, NOT
revenue + conversion language. The persona is not running a SaaS
metrics dashboard; they're running a practice they care about.

**Concrete rules:**

- "Linda has been away" beats "$420 of churn risk."
- "Room for 4 clients today" beats "$480 of unrealized revenue."
- "A warm note often lands here" beats "send a re-engagement campaign."
- "Their absence usually means something" beats "lapsed-client recovery opportunity."
- "Good window for rest, learning, or outreach" beats "underutilized capacity."
- "Sessions that did not happen" beats "cancelled revenue."
- "Membership might suit their rhythm" beats "increase MRR / recurring revenue."

**What this rules out:**

- Dollar amounts in proactive insights ("$N at risk", "$N this hour")
- Funnel metaphors ("conversion", "pipeline", "lead", "deal")
- Industrialized language ("retention rate", "churn", "LTV", "ARR")
- Urgency framing as scarcity ("only 3 days left", "act now")
- Achievement-game language ("unlock", "level up", "streak broken")

**What it includes:**

- Naming clients by name when relevant ("Sarah's first session was 14 days ago")
- Soft conditional language ("often", "tends to", "usually", "might")
- Specific time references in human units ("over a month", "two weeks", "her usual rhythm")
- Optional next moves that respect the therapist's judgment ("worth a look", "if it feels right", "when the moment is yours")

Dashboards and ledgers (Billing, Insights tab) can use revenue
language because the therapist explicitly opened a money view.
The Schedule and Outreach surfaces are practice-tending surfaces.

**Incident log:**
- May 22 2026: Tier 4 deep-insights surface (Schedule > Ways to use this).
  HK pushed back on initial framing proposals that emphasized money
  ("$480 of unrealized revenue", "top-client churn risk"). All 7
  insights rewritten in care language before shipping. Codified
  here so future insights, push notifications, and dashboard
  surfaces don't quietly drift back toward transactional framing.

---

## 18. At-a-glance over interaction depth on read-only summary views.

For surfaces where the therapist is scanning rather than acting
(Yearly view, mobile day-strip on Weekly, dashboard summary cards),
prefer dense visual information they can read in one second over
tap-to-drill interactivity. The 70yo persona values seeing the
pattern more than interacting with the data.

**Concrete rules:**

- Yearly view: render 12 mini-month heatmaps in a scrolling grid.
  Do NOT make months tappable to drill into Monthly view; the
  Monthly tab already exists for that. The Yearly view's job is to
  show the year's shape, not be a navigation tree.
- Weekly mobile day-cards: include a horizontal time-strip showing
  sessions as colored mini-bars and blocks as amber bands. Tapping
  a bar opens the session, but the strip is decorative, not
  interactive-required.
- Color and position carry the information, not labels and buttons.

**What this rules out:**

- Drill-into-detail patterns on summary views (extra cognitive load)
- Hover-required interactions (the persona is on mobile, no hover)
- Modal-stacking from a summary tile (each level is a new context)
- Required taps to reveal what could be visible by default

**Incident log:**
- May 22 2026: Yearly view design choice. Initial proposal had
  tappable months drilling into MonthlyView. Rejected in favor of
  pure heatmap-with-stats. Same reasoning applied to mobile weekly:
  added a non-interactive time-strip rather than expanding cards.

---

## 19. Force-with-lease is only safe when the remote SHA you're overwriting is one you've seen.

`git push --force-with-lease` protects against overwriting work that
the remote has and you don't, but only when you've actually fetched
recently and confirmed what's on the remote. After a botched rebase
or a commit landing in a parallel session, `--force-with-lease` can
silently overwrite real work.

**Concrete rules:**

- Before any force push, run `git fetch origin main` and `git log
  origin/main..HEAD` AND `git log HEAD..origin/main` to see exactly
  what differs in both directions.
- If `HEAD..origin/main` is non-empty, you have commits on origin
  that you don't have locally. Force-pushing will drop them. STOP
  and pull/merge first.
- After any force push, immediately `git fetch && git log origin/main`
  and confirm the commit you expected is gone (when intended) AND
  the commits you wanted preserved are still there.
- If you discover you overwrote a commit, recover it from `git reflog`
  (the dropped commit is still in your local history for ~30 days)
  and explicitly push that SHA: `git push origin <sha>:refs/heads/main
  --force-with-lease`.

**Incident log:**
- May 22 2026: Resumable imports commit (B). During a normal rebase
  flow my force-with-lease overwrote `3fa11eac` (CTIA-compliant SMS
  language commit made in a parallel session). Recovered by finding
  the SHA in local reflog, cherry-picking it onto my branch tip,
  and re-pushing the combined HEAD with explicit SHA syntax. Both
  commits ended up on main. The near-miss happened because I assumed
  my local already had everything from origin; I had not fetched
  recently enough to know about the parallel commit. The fix is
  procedural: always fetch + compare BOTH directions before force-
  pushing, not just one direction.

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
- **Before committing any UI change:** check rule #11 (mobile-first).
- **Before adding a code path that auto-creates database rows from user input:** check rule #12.
- **Before adding any therapist-facing numeric input:** check rule #13.
- **Before designing any flow that asks the user to choose between implementation-flavored options:** check rule #14.
- **Before asking a therapist to share their data via DM, email, or screenshot for debugging:** check rule #15.
- **Before storing or displaying data with both canonical and human-readable forms:** check rule #16.
- **Before writing proactive insight/notification copy with dollar amounts or funnel language:** check rule #17.
- **Before adding tap-to-drill interactions to a summary or year-overview surface:** check rule #18.
- **Before any `git push --force-with-lease`:** check rule #19.

When breaking a rule is the right move (it sometimes is), document
the exception inline AND add the rule's incident log here. The
rule's value comes from the cost being remembered.
