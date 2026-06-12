# DESIGN_PRINCIPLES.md

Rules that exist because we broke them once. Each one has a specific
incident attached so future work understands the cost of breaking it
again. Read this before adding any new section, page, or template
variant.

---

## ADRR: the shape of every reply to HK

Every reply to HK leads with these four, in this order, before any deep detail:

- **Action**, what I (Claude) did.
- **Decision**, what HK needs to decide or do next.
- **Recommendation**, my recommendation, grounded in the "what does world class look like?" principle.
- **Risk**, green, amber, or red, by impact on the customer and therapist value chain.
  - **Green**, internal and reversible, no customer or therapist impact. Act alone.
  - **Amber**, affects their experience indirectly or needs HK judgment. Draft, HK decides.
  - **Red**, directly touches a customer or therapist, their data, their money, or is irreversible. HK only.

Keep the four short. The deep detail goes below the ADRR block, kept for safety and learning, never in front of the action. HK set this on 2026-06-11 after replies buried the action in too much text.

### Minimize HK's manual effort. Deliver work, not homework.

HK's time is for strategic decisions, not typing or busywork. Every deliverable arrives ready to use: copy-paste-ready text, tappable A/B/C choices, finished drafts. Never hand HK a task he has to assemble, retype, paste around, or chase. No "combine these blocks", no "now go send me a screenshot", no "paste this there". If a thing can be done by an agent, the agent does it. If a choice is needed, present it as a tap. Adding homework to a reply is a failure mode. Multi-part prompts and specs are delivered standalone so one copy lands one result. HK set this 2026-06-11 after replies kept adding work back onto him.

### No going away. Finish it, do not hand back half-built work.

When a task is started, complete it and push it before reporting. Do not defer pieces to "next time," and do not end a reply by parking an unfinished feature back on HK to verify, assemble, or come back to. "I will do the rest later" and "take a look and tell me" are the failure modes. Keep going until the thing is done, then report it done. HK set this 2026-06-11 after replies kept stopping early and leaving the remaining work on him.

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

**Incident log.**
- **Jun 10 2026 (silent 401):** the money path fans out through
  `notify-payment-event`, called server-to-server by both pay-link
  webhooks and `verify-payment-link`. That function was not in the
  deploy `NO_JWT_FUNCTIONS` allowlist, so every call hit the gateway
  and got a 401. Payments were marked paid, but T8 (therapist) and the
  client receipt never fired. The webhook returned 200, the row flipped
  to succeeded, and nothing looked wrong until a live test. Rule that
  came out of it: any function called by a webhook or another function
  with the service/anon key must be on the no-JWT allowlist, and a
  notification is not trusted until a live test confirms receipt
  (see principle 36).

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

## 20. Slide-overs and modals scroll end-to-end. paddingBottom on inner content, not the outer scroll container.

**The recurring bug.** A `position: fixed` slide-over with `overflowY: auto` looks correct, but the user can't scroll to the last action. The trap is one of two patterns:
1. A child marked `flex: 1` claims height proportional to content, fighting the parent's overflow boundary.
2. `paddingBottom` is set on the OUTER scroll container, and WebKit lets content scroll past the padding instead of reserving scrollable space.

**The rules.**
- `overflowY: auto` belongs on the OUTER fixed container ONLY.
- Children flow naturally without `flex: 1`.
- `paddingBottom: calc(env(safe-area-inset-bottom, 0px) + 60px)` belongs on the INNER content div, not the outer scroll container.
- `-webkit-overflow-scrolling: touch` for iOS momentum.
- `overscroll-behavior: contain` to stop scroll chaining to the parent page.
- When the slide-over is mounted, lock body scroll: `document.body.style.overflow = 'hidden'` in a useEffect, restore on cleanup.

**Why it matters.** The 70yo therapist scrolls, hits a dead zone before Cancel/Reschedule, and concludes the page is broken. They don't dig: they bounce.

**Incident log:**
- May 25 2026, Phase 23: First attempted fix put paddingBottom on the outer scroll container with the safe-area calc. Looked correct in dev but in production WebKit scrolled past the padding so the last actions remained unreachable. HK escalated twice ("scroll between side panel and main panel gets confused...the cursor on the side panel, sometimes it is scrolling the main panel in the background"). Real fix in Phase 24c+24d: moved paddingBottom to inner content, added `overscroll-behavior: contain`, added body scroll lock. Verified end-to-end.

---

## 21. Approve + Deposit interaction must be wired or documented. Silent revenue loss is the worst failure mode.

**The recurring trap.** When two product settings interact, the dev assumes the user understands the interaction. The user enables both, assumes both work, and silently loses money or trust until they catch on weeks later.

**The rule.** When two settings have a non-obvious interaction, you must do one of three things, never zero:
1. Wire the interaction so it's automatic (e.g. card-on-file at booking + auto-charge on approval).
2. Surface a clear in-product warning in BOTH settings, the moment both are on, naming the manual workaround.
3. Refuse to allow both (rare, but acceptable when the interaction would cause real harm).

**Incident log:**
- May 25 2026: Candice asked "how do I require a deposit, I thought I had that set up." Verified in DB: `deposit_enabled = true`, `deposit_percent = 30`, Stripe connected. Walked through her booking page and discovered she also had `require_approval = on`. The booking flow correctly skips the deposit at request time (so no refunds on declined requests), but the `booking-approval` edge function sets status to `confirmed` without ever charging the deposit. Comment in code: "the therapist sends a payment link after approving." No UI prompts the therapist to do this. Net effect: every first-time deposit Candice thought she was collecting was silently never charged. Discovered after weeks of production use. Phase 25a shipped a warning banner in Settings. Phase 25b (queued) wires card-on-file at booking time + auto-charge on approval as the real fix.

---

## 22. Pending-approval bookings are NOT the same as new bookings. Notification copy and CTAs must reflect the actual state.

**The trap.** A booking exists with status `pending-approval`. The system fires its normal "new client signup" notification with copy like "Sarah just booked their first session with you." The therapist reads this as confirmed and is confused later when they realize they still had to approve it.

**The rule.**
- Every notification template must check status before composing copy.
- `pending-approval` bookings get: "X wants to book" / "Approve or decline" / CTA → `/dashboard/schedule` (where the Pending Requests panel sits at top).
- `confirmed` bookings get: "X just booked" / "View on schedule" / CTA → `/dashboard`.
- Never reuse the `new_client_signup` template for both; skip it entirely for pending-approval since the "new booking REQUEST" email from the main path already covers the therapist.
- CTAs that send the therapist to `/dashboard/clients` (the clients list) for a brand-new client land on an empty page because no client row exists yet. Always link to the action surface, not the data surface.

**Incident log:**
- May 25 2026: HK self-tested with Joy Client Demo 2 on an account with `require_approval` on. Received an email titled "First-time client: Joy Client Demo 2 just booked their first session with you" with a CTA "Open Clients" that landed on a blank page. The booking was actually pending HK's approval. Three problems: misleading copy, wrong CTA destination, duplicate of the proper pending-approval email that already fired. Phase 25a: skipped `new_client_signup` email when status is pending-approval, changed CTAs to `/dashboard/schedule`, button copy to "Review request."

---

## 23. Pre-collect what you'll need to charge later. Email-based payment links are fragile.

**The trap.** A flow requires deferred payment (approval → deposit, no-show fee, cancellation charge). Dev plans: "we'll email a payment link when the time comes." Reality: email goes to spam, the client doesn't see it, the therapist has to chase, the payment never lands.

**The rule.** When you know you'll need to charge a client later, capture the card on file the first time you have them in the booking flow. Use Stripe SetupIntent with `setup_future_usage='off_session'`, store the `payment_method_id` on the booking + client. When charge-time comes, fire off_session charge via existing infra. The only customer-facing artifact at that point is a receipt email, not a payment ask.

**Why it matters.** A "click here to pay" email creates a fragile dependency chain: deliver → open → click → return to platform → enter card → confirm. Each step loses ~10-20% of users. A pre-captured card on file is a single API call with no client action.

**Incident log:**
- May 25 2026: Candice asked about deposits when she had approval also on. HK initially suggested "auto-create Stripe payment link on approve" but reflected "Sending a payment link is very old process as people may not get email or may not see it." Correct instinct. Phase 25b (queued) implements card-on-file at booking time + auto-charge on approval. Card-on-file infrastructure already exists in codebase (`card_required_first_timers` setting + `create-deposit` edge function with `setup_future_usage`); this is wiring not new infrastructure.

---

## 24. The mic button is a feature, not a metaphor. Wire Web Speech API for desktop SOAP.

**The trap.** The original SOAP dictation copy said "Tap the microphone on your keyboard to dictate." That works on iOS (the keyboard has a built-in mic) but on desktop, there's no keyboard mic. Therapists working from a laptop saw the instruction, looked for a mic, and concluded the feature was missing.

**The rule.** When you tell the user to "tap the mic," there must be a mic in the UI. Web Speech API (`window.SpeechRecognition` or `webkitSpeechRecognition`) supports continuous dictation in Chrome, Edge, Safari with stable APIs. Fall back to hiding the button silently on Firefox.

**Incident log:**
- May 25 2026: HK feedback "For SOAP, dictation is intuitive for phone as the record button is there on the keyboard. For desktop I am not clear myself on how to voice record it." Phase 24f shipped a `MicDictationButton` component using Web Speech API. Six mic buttons wired: S, O, A, P fields + Private notes + Recap message. Each button independent so therapist can dictate Subjective, stop, think, dictate Objective. Button hides itself if browser doesn't support recognition.

---

## 25. Collapse and expand controls use the standardized ChevronButton. Never a small inline SVG or unicode character.

**Rule.** Any UI surface that collapses or expands uses the
`ChevronButton` from `src/components/ChevronIcon.jsx`. The button is
a 34x34 round target, forest-filled (`#2A5741`) when open with a
white chevron, sage-cream tinted (`#EEF3EE`) when closed with a
forest chevron, with a smooth 180-degree rotation animation. No
inline SVG glyphs. No unicode characters like `⌄` or `▾`. No tiny
14px chevrons that demand precision.

**Why a circle button and not a small SVG.** Our 70-year-old massage
therapist persona has lower fine-motor precision and reduced contrast
sensitivity. A small inline chevron reads as decoration, not as a
control. The round filled button reads unambiguously as a tap target,
and the open/closed color contrast (forest vs. sage cream) makes
section state readable at a glance without parsing the chevron
rotation. This is accessibility, not aesthetics.

**Incident: May 27 2026, Settings 2.1 chevron.**
DisclosureRow was rendering a unicode `⌄` character as the chevron.
HK pointed to the Session Journey panel's round forest chevron
button as the pattern that already existed elsewhere in the product:
"See the chevron example in the snapshot. Will be easier for our
persona of 70 year old to use those. Standardize them across the
website and add to the design principles." The pattern was already
implemented in `CockpitSection` for the Schedule tab cockpit cards.
It just had not been promoted into a shared component.

**Cost.** Same-day fix: extracted `ChevronIcon` and `ChevronButton`
into `src/components/ChevronIcon.jsx`. Updated `DisclosureRow` to
import it. Refactored `ScheduleDashboard.js` to use the shared
component instead of its local copy. New surfaces must import from
the shared module.

**Test before shipping any collapsible UI.** "Is this using
`ChevronButton`? Did I import it?" If you wrote a `<svg>` or a
`⌄` character anywhere for an expand or collapse control, replace
it with `ChevronButton`.

---

## 26. Close affordances use the standardized CloseButton. Never a bare × glyph.

**Rule.** Any modal, sheet, drawer, or expandable panel that can be
closed uses the `CloseButton` component from
`src/components/CloseButton.jsx`. A labeled pill with adequate tap
target (44px min height), readable text ("Close", "Done", "Cancel"),
neutral styling. No bare `×` glyphs in panel headers, no tiny SVG
crosses, no unicode characters.

**Why a labeled pill, not a bare ×.** Same accessibility reasoning
as ChevronButton (rule #25). The 70-year-old persona does not
reliably read `×` as "close." Some try to type into it. Some see it
as "delete" and worry they're erasing data. The bare × is also
usually the smallest tap target on a screen, which fails for thumbs.
A labeled pill with adequate hit area solves both problems.

**Incident: May 27 2026, calendar panel close affordance.**
The Manage Your Calendar panel header was rendering a bare `×`
glyph. HK: "The top cross on top right is almost invisible. We need
to standardize how to close windows just like we did for expanding
chevrons."

CloseButton already existed (May 16 2026 from a previous similar
incident) but the calendar panel was not using it.

**Cost.** Same-day fix: replaced bare × with `<CloseButton
onClick={...} label="Close calendar" />`. Net gain: instantly
visible, instantly understood. Future panels must use CloseButton
from the start.

**Test before shipping any panel/modal/sheet UI.** "Is this using
`CloseButton`? Did I import it?" If you wrote a bare × or a small
SVG cross anywhere as a close affordance, replace it with
CloseButton.

---

## 27. Circular controls use the standardized RoundIconButton. Close, help, navigation, add, all circular affordances share one shape.

**Rule.** Every circular control across the product uses
`RoundIconButton` from `src/components/ChevronIcon.jsx`. That
includes close (×), help (?), prev/next navigation (‹ ›), inline
add (+), and any other single-glyph button rendered as a circle.

The button is 36×36 by default (smaller variants pass `size`),
sage-cream background with forest content (tone='neutral' default),
generous tap target, consistent visual weight. Sister component to
ChevronButton (rule #25).

**Why one component for all of these.** Before this rule the product
had at least four different circular button styles in flight: the
old gray-bordered close X, the help button with forest border, year
navigator arrows in white circles, plus the chevron buttons. None
matched. The 70-year-old persona reads these as random decorations
rather than as the same kind of control. Standardizing means a
trained eye instantly recognizes "this is a tappable thing of this
shape."

**Incident: May 27 2026, calendar v4 audit.**
HK: "Those little circles look 1990s and we should have something
modern across the website similar to the decision we made on
expanding chevrons."

The yearly planner used 32×32 white circles with 1.5px gray border.
The calendar panel close button was a separate 36×36 white circle
with 1.5px gray border. The help button was forest-bordered. Three
different styles for the same pattern.

**Cost.** Same-day refactor: added `RoundIconButton` to
ChevronIcon.jsx as a sister export. Replaced four ad-hoc circle
patterns: panel close, calendar help, year prev/next in planner,
and the month navigators in CalendarGrid. Every circular control is
now visually consistent.

**Test before shipping any circular button.** "Is this using
`RoundIconButton`? Did I import it?" If you wrote a custom div with
`borderRadius: 50%` anywhere, it should be replaced.

---

## 28. Never use "AI" in customer-facing copy. Use PracticeIQ.

**Rule.** The string "AI" (acronym, not part of another word) does
not appear in any text the user sees: buttons, labels, badges,
toasts, banners, modals, help articles, marketing pages, email
subject lines, error messages, settings labels, anywhere. If a
feature is powered by language models or machine learning, it is
called **PracticeIQ** or described by what it does ("draft note",
"summary", "campaign suggestion") without invoking AI as a label.

Internal: variable names, code comments, edge function identifiers,
type names, and database column names CAN keep `ai` or `aiEnabled`
since they are not user-visible. The rule is about user-facing
strings.

**Why this matters.** Two reasons.

1. **Therapists are skeptical of AI.** Most massage therapists view
   their work as deeply human, relational, and embodied. Branding
   product features as "AI" creates resistance: 'AI is going to
   replace me / get my notes wrong / break my client trust.' Same
   feature branded as "PracticeIQ" lands as 'a smart tool that
   helps with the busywork.'

2. **Clients are wary of AI in healthcare.** Massage clients are
   especially wary of automated systems handling their health
   information. Saying "PracticeIQ summary" reassures; "AI summary"
   alarms.

This is positioning, not deception. We are transparent about
HOW the platform works on the dedicated PracticeIQ help article
("what does PracticeIQ do," "is my data trained," "can I turn it
off"). The brand name just doesn't lead with the technology that
the user is wary of.

**Incident: May 27 2026, calendar growth moment text.**
HK: "Its against our design principle to use 'AI' word in the
website. Just say PracticeIQ suggests this and that to get that
positioned for future. Therapists and clients don't like AI in
general."

Audit found AI references in:
- Calendar growth moment popover
- Help article titles and bodies (5 of them)
- WhyBodyMap competitor copy
- SessionDetail "Draft with AI" buttons (4 places)
- SessionDetail "AI helps you" badge
- Founder AiCostCard labels (5 strings)
- Terms of Service privacy disclosure
- Atlas page label
- Demo page label
- Edge function rate-limit error message

All user-visible strings replaced with PracticeIQ. Code comments
and variable names left intact since they are not visible to users
and renaming them is a bigger refactor.

**Test before shipping any new feature.** Grep for `\bAI\b` in any
JSX content, button label, alert string, toast message, help text,
or email template. If it's there and it's user-visible, replace it.

---

## 29. Modals must reach their confirm button on every device. Sticky footers and dynamic viewport units, never fixed-percentage heights.

**Why:** Jacquie reported May 27 2026 she could not reach the Confirm
Booking button on her iPhone. The modal cut off below "Notes
(optional)" and the confirm button sat under the Safari toolbar +
iOS home indicator. She used the reschedule path as a workaround.
This was a duplicate of the DetailPanel slide-over bug from May 25.
The pattern keeps recurring across files, so it goes here.

**The failure mode:** outer container uses `alignItems: 'center'` +
inner panel uses `maxHeight: '90vh'`. On iOS Safari, when the
dynamic toolbar (URL bar + share button row) shows, the visible
viewport is smaller than 90vh because `vh` units don't account for
the toolbar. The vertically-centered modal pushes its bottom edge
under the toolbar, which overlays the bottom 40-80 pixels. The
confirm button sits exactly there. Untappable.

**The fix is three things together. All three or none:**

1. **Outer container anchors to the top, not center.**
   `alignItems: 'flex-start'` on the outer flex. If the modal is
   short, this looks fine (still appears near the top of the screen).
   If the modal is tall, the top is always accessible and the user
   can scroll the outer container itself to reveal the bottom.

2. **Inner panel sizes against `dvh`, not `vh`.**
   `maxHeight: 'calc(100dvh - 40px)'` (where 40 is the outer
   padding total, 20 top + 20 bottom). The `dvh` unit (dynamic
   viewport height) shrinks when the iOS toolbar appears, so the
   modal sizes correctly to the actually-visible viewport. `vh`
   does not, which is why fixed-percentage heights fail.

3. **Confirm button lives in a sticky footer, not at the bottom
   of the scroll body.** The inner panel becomes a flex column
   with three children: header (sticky-ish, flexShrink 0),
   scrollable body (flex: 1, overflowY: auto, minHeight: 0),
   sticky footer (flexShrink 0). The footer holds the action
   button + any summary/error states. It is ALWAYS visible.

4. **Both edges respect safe area.**
   Outer container: `paddingTop: 'max(20px, env(safe-area-inset-top, 0px))'`
   and the same for `paddingBottom`. Footer:
   `paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)'`.
   This protects against both the iOS notch at the top and the home
   indicator at the bottom.

**The anti-pattern checklist (any of these is a bug):**

- `alignItems: 'center'` + `maxHeight: '90vh'` (or any %vh)
- Confirm button at the bottom of an `overflowY: auto` div with no
  sticky footer
- No `safe-area-inset` anywhere in the modal chain
- A `display: flex` ancestor that doesn't have `minHeight: 0` on
  the scrollable child (this collapses the scroll container)

**Reference implementation:** see `BookingModal.js` after May 27
2026 (commit shipping with this principle). The DetailPanel
slide-over (`ScheduleDashboard.js`) is also correct after May 25
2026. New modals should be copy-pasted from one of these two
templates, not built from scratch.

**Files known to have this anti-pattern as of May 27 2026:**
Outreach.js, CustomQuickSendModal.jsx, QuickSendModal.jsx,
IntakeEditor.jsx, Demo.jsx, BookingPage.js. Each should be fixed
on its own commit so a regression doesn't bury the diff. Queued
in BLOCK_PLAN as fire #18.

---

## 30. After writing to the therapist row, ALWAYS call refreshTherapist. Local state is not enough.

**Why:** Jacquie reported May 27 2026, for the THIRD time, that
flipping the week start to Sunday in Settings does not actually
change her calendar layout. Each prior fix touched display math.
None worked because the underlying state never refreshed. The
calendar kept rendering on stale therapist data.

**The failure pattern:**

```js
// BUG: local state only. Global therapist stays stale.
async function onSavePreference() {
  setMyLocalCopy(newValue);
  await supabase.from('therapists').update({ field: newValue });
}
```

The `therapist` object in `AuthContext` only re-fetches when:
- the user signs in
- the page does a hard reload
- something calls `refreshTherapist()` explicitly

Everything else that consumes `therapist` via props (`ScheduleDashboard`,
`CalendarGrid`, every inner view) sees the OLD value until one of
those three things happens.

**The correct pattern:**

```js
async function onSavePreference() {
  setMyLocalCopy(newValue);
  await supabase.from('therapists').update({ field: newValue });
  try { await refreshTherapist?.(); } catch (_) {}
}
```

`refreshTherapist` is exposed from `AuthContext`:
```js
const { refreshTherapist } = useAuth();
```

The wrapping `try/catch` is non-blocking: the local write already
succeeded, and a refresh failure should not roll that back. We log
and move on.

**Also: useEffect dep arrays.** If a component derives local state
from a therapist field, that field MUST be in the useEffect dep
array that re-syncs local state:

```js
useEffect(() => {
  setMyLocalCopy(therapist?.field ?? defaultValue);
}, [therapist?.field]);   // <-- not omitting this
```

Missing fields from the dep array means even a fresh `therapist`
prop won't push the new value into local state.

**The two failure modes combine to produce the Jacquie bug:**
1. Toggle saves to DB and updates LOCAL state.
2. `refreshTherapist` never called, so global therapist stays stale.
3. Schedule tab gets the stale prop.
4. Inner useEffect dep array also missing the field, so even if the
   prop DID refresh, local Settings state wouldn't.

Both must be fixed together. Both were fixed in the commit shipping
with this principle.

**Audit checklist for any new therapist setting:**
- Does the save handler call `refreshTherapist()` after the write?
- Is the field in the useEffect dep array that re-syncs local state?
- Does the consumer component read directly from `therapist?.field`
  (correct) or have its own state copy that could drift (risky)?

**Incident log.**
- **Jun 10 2026 (Stripe connect shows disconnected after connecting):**
  the Standard OAuth landing page (`StripeConnectStandard.js`) wrote
  `stripe_account_id` to the DB server-side, then dropped the user on
  the Clients page without calling `refreshTherapist()`. The in-context
  therapist stayed stale, so Settings > Payments kept showing
  "disconnected" even though the connection was real. Fix: `await
  refreshTherapist()` on OAuth success, and land the user on
  `/dashboard/settings#payments` so they see the connected state. Same
  root cause as the Jacquie bug, different surface.

---

## 31. Prefer side panels and full pages over modals. Modals are for confirm/cancel only.

**Why:** HK May 27 2026: 'We are really bad at modals. They always
have a scroll problem and are confusing to our 70yo persona. Why
cant we have this as a side panel or something different. It does
not look good and is not world class or modern for 2026.'

Modals stack badly on mobile (modal-in-modal), have a recurring
scroll-to-submit problem (Design Principle 29 is a whole rule just
about that), and force the user to lose their place on the page.
For a 70-year-old solo practitioner on a phone, a modal that traps
focus and might cut off the submit button is the worst pattern.

**The hierarchy, best to worst, for any surface with form fields
or a multi-step flow:**

1. **Inline expansion** (best for short confirmations).
   The action expands a row right where the button is. No overlay,
   no new surface. The user never loses context. Example: the
   Archive confirmation row in ProfileHeader (reason chips +
   Confirm, expands below the action buttons).

2. **Side panel / slide-over** (best for medium forms).
   Slides in from the right on desktop, full bottom-sheet on mobile.
   Has its own sticky header and footer. Example: the DetailPanel
   on the Schedule tab. Edit details and Merge should use this.

3. **Full page with a back button** (best for heavy multi-step
   flows with lots of new content).
   A real route the user navigates to, with a clear back button to
   return. Example: the booking flow itself, package purchase
   checkout. Book next and package/membership purchase should use
   this.

4. **Modal** (LAST resort, ONLY for true confirm/cancel dialogs).
   'Are you sure you want to delete this?' with two buttons and no
   form fields. Nothing that scrolls. Nothing multi-step. If a
   modal has more than two buttons or any text input, it is the
   wrong pattern.

**The test before reaching for a modal:** does this surface have a
form field, a list to scroll, or more than one step? If yes, it is
NOT a modal. Pick inline / side panel / page from the hierarchy
above.

**Existing modals to migrate (as of May 27 2026):**
- Client actions (Edit / Book / Merge) - migrate Edit + Merge to
  side panels, Book to a page route. Archive already migrated to
  inline (this commit).
- Public package / membership purchase - migrate to a page route.
- CheckoutModal (therapist-side payment) - evaluate; it is a
  multi-step payment flow so a side panel or page is the target,
  but it is heavily used and stable, so migrate carefully.

This is a direction, not a same-day rewrite. New surfaces follow
the hierarchy from day one. Existing modals migrate as they get
touched for other reasons, or in dedicated cleanup passes.

---

## 32. Customer broadcast emails follow a fixed shape. Open with thanks and "stays free." Close with sign-in + a real-person reply. Five items, one line each.

HK iterated through the same email three or four times to land on the
voice. Future drafts must start from this template, not from scratch.

### The canonical shape

```
Subject: <five-words-or-fewer, action-oriented>

Hi {name},

We've been listening. A lot of these came straight from therapists
like you, and we shipped them within a week. Thank you.

The platform stays free for you while we keep adding.

1. <Action-shaped one-line heading.>
<Path → Card name (taxonomy ID).> <One sentence on what it does.>

2. <Action-shaped one-line heading.>
<Path → Card name (taxonomy ID).> <One sentence on what it does.>
While you're there, take a peek at <related feature>, <related>,
and <related>.

3. <Action-shaped one-line heading.>
<Path.> <One sentence.> <One short benefit clause.>

4. <Action-shaped one-line heading.>
<Action verb.> <What it does.> <Conversational "no more X" line.>

5. <Action-shaped one-line heading.>
<Path.> <What it surfaces.> <How they use it.>

Sign in: mybodymap.app

Reply and a real person answers.

- MyBodyMap
```

### Why this shape

- **Opening thanks + listening signal.** The 70yo persona is wary of
  software companies. Acknowledging "we listened, we shipped in a week"
  reframes the relationship from vendor-buyer to colleague-colleague.
- **"Stays free for you."** Anchors the cohort that signed up early.
  They worry every email is leading to a price hike. Defuse it on line 2.
- **Numbered list, action-shaped headings.** "Block your year in one go"
  is doable. "Improvements to vacation scheduling" is corporate noise.
- **Path + taxonomy ID in parens.** When the feature lives in a Settings
  card, include the ID like `Plan your year (2.6)` so customer support
  has a shared shorthand if she replies asking where it is. When the
  feature is a Schedule action (not a setting), no ID, just the path.
- **"While you're there" cross-promotion.** When pointing at a Settings
  area with multiple related cards, mention 2 or 3 nearby features by
  name. Maximizes the visit value.
- **Conversational "no more X?" line.** Reuses her own framing back to
  her. "No more 'wait, did I refund?'" lands harder than
  "automatic refund tracking shipped."
- **Single bare URL CTA.** `mybodymap.app`, no `[Watch button]`, no
  query strings, no link decoration. She types or copy-pastes.
- **"Reply and a real person answers."** Reused verbatim across every
  email. It's the most important line for retention; never paraphrase.
- **Sign-off**: `- MyBodyMap` (single hyphen, no em dash, no
  "The MyBodyMap Team"). Compact, brand-consistent.

### Rules

- **One screenful on mobile.** ~150 words. If it doesn't fit, cut.
- **Five items max.** Six items become a feature dump. Pick the five
  that bring clients or save time.
- **Action verbs in headings.** "Block your year," "Two locations,"
  "Recurring weekly clients." Not "Vacation feature," "Locations
  feature," "Recurring bookings."
- **No em dashes anywhere.** Standing rule, applies here too. Use
  commas or rephrase.
- **No "AI," no "PracticeIQ" namedrops** unless the feature literally
  is PracticeIQ. The persona doesn't care about the engine; she cares
  about the outcome.
- **No "Behind the scenes" section** mentioning reliability, speed,
  privacy, or refactors. Therapists do not buy infrastructure; they
  buy outcomes. Anything backend-flavored gets cut.
- **Never reframe the persona's voice as marketing.** "We made setup
  easier" is marketing; "Block your year in one go" is concrete.

### Anti-patterns (rejected during iteration on this very email)

- ❌ "Behind the scenes: reliability for 1,000+ clients" → cut. She
  doesn't think about scale.
- ❌ "Square and Stripe now do the same things" → cut. She doesn't
  know which she uses; both should "just work."
- ❌ "Nothing you have to do" → cut. Patronizing. She wants to know
  what's new, not be told it's automatic.
- ❌ Settings paths without taxonomy IDs → ambiguous. She doesn't
  see IDs in the UI, but support uses them, so include in parens.
- ❌ Long sign-off ("Cheers, / The MyBodyMap Team / [logo]") → cut
  to `- MyBodyMap` per HK style.

### When this rule applies

- **Every product-update broadcast** (E2.10 in `BATCH_EMAIL_OPTIONS`).
- **Monthly digest emails** when we ship them.
- **Cohort announcements** (new feature launches, beta invites, etc.).
- **NOT** transactional emails (booking confirmations, intake reminders,
  receipts) — those are different shape, run by the platform's
  notification system, not by founder outreach.
- **NOT** single-customer support replies — those follow the principle
  in the user-memory note about HK's voice (brief ack, direct action,
  no hedging).

---

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
- **Before building a `position: fixed` slide-over with scrollable content:** check rule #20.
- **Before shipping two settings that interact non-obviously:** check rule #21.
- **Before composing a notification template that fires across multiple booking statuses:** check rule #22.
- **Before planning a flow that emails a payment link later:** check rule #23.
- **Before writing copy that tells the user "tap the mic":** check rule #24.
- **Before drafting any customer broadcast email (product update, monthly digest, cohort announcement):** check rule #32.
- **Before parsing a date or time string with `new Date(string)`:** check rule #33.
- **Before adding a `const` reference inside a JSX render block:** check rule #34.
- **Before shipping any Schedule, Booking page, or modal change:** check rule #35.

When breaking a rule is the right move (it sometimes is), document
the exception inline AND add the rule's incident log here. The
rule's value comes from the cost being remembered.

---

## 33. Never use `new Date(string)` for non-ISO date or time inputs. iOS Safari is strict, desktop hides the failure.

**The trap.** `new Date("2000-01-01 1:30 PM")` returns a valid Date in Chrome and Safari macOS. It returns `Invalid Date` in iOS Safari. The downstream code then calls `.toTimeString().slice(0,5)` and gets `"Inval"`, which gets `.split(":")` into `["Inval"]`, which destructured `[hh, mm]` gives `hh = "Inval"`, `mm = undefined`. Any later code that assumed numeric types crashes.

**The rule.** For 12-hour AM/PM times, use the module-level `t2m` helper (regex-based, returns 0 on bad input). For 24-hour HH:MM times, use `.split(":")` and guard each `parseInt` against `NaN`. For dates, accept only strict ISO-8601 (`YYYY-MM-DDTHH:mm:ss`) into the Date constructor; build any other format manually.

**Incident log.**
- **Jun 1 2026 (Jacquie incident, Monthly view interleave):** new Date("2000-01-01 " + appt.time) returned Invalid Date on iOS Safari only. The downstream fallback expression called `.getHours()` on what was actually a string, crashing the whole Schedule tab. White screen on mobile, fine on desktop. Took two reverts to land. Cost: 90 minutes of HK time, two emergency reverts, customer-facing PWA broken during peak hour.

---

## 34. JSX render blocks have a temporal dead zone for `const`. Declare hoisted variables BEFORE the render expressions that use them, even if both live inside the same function body.

**The trap.** Inside a React function component, `const myBlocksToday = ...` at line 5371 and `const blockRanges = (myBlocksToday || []).map(...)` at line 5276 look fine. The build passes. But `const` is hoisted-but-not-initialized: reading `myBlocksToday` before its declaration throws `ReferenceError: Cannot access 'myBlocksToday' before initialization` at runtime. Nothing in the build pipeline catches this.

**The rule.** When adding logic that reads a derived value, scan upward to confirm the value is already declared at that point. If not, either hoist the declaration or compute the value inline at the use site from primitive props. ESLint's `no-use-before-define` (default off) would have caught this; we're not running it. So manual care is required.

**Incident log.**
- **Jun 1 2026 (Jacquie incident, Timeline gap-calc fix):** added `const blockRanges = (myBlocksToday || []).map(...)` at line 5276 of ScheduleDashboard.js. `myBlocksToday` was declared at line 5371. Build passed. Schedule tab white-screened on every device. First-attempt fix moved blockRanges to compute inline from `blockedDays` + `viewDate` directly, no later-bound reference. Cost: full revert + re-fix.

---

## 35. iOS Safari is the canary. If a change touches Schedule, Booking page, or any time/date-parsing surface, view it at mobile viewport BEFORE pushing.

**The trap.** Desktop Chrome on a 27-inch monitor is the most forgiving runtime in the lineup. iOS Safari is the strictest. Most therapists use mobile. Most clients use mobile. Most crashes that bite us are mobile-only.

**The rule.** Before pushing any change to ScheduleDashboard, BookingPage, or any code that touches date/time strings, open `/founder/mobile-preview` and load the affected route in the 380x720 iframe. If the route can't be tested via iframe (X-Frame-Options), open the route directly in a phone-sized browser window or in DevTools mobile emulation set to iPhone 14 Pro.

This is a process rule, not a code rule. The cost of skipping is a customer-visible white screen on the device 80%+ of users use.

**Incident log.**
- **Jun 1 2026 (Jacquie incident):** pushed gap-calc + interleave changes after passing build + desktop check. Mobile crashed immediately. Three rounds of revert + fix because the bugs were iOS-specific (rules #33 and #34). The /founder/mobile-preview iframe would have caught both before push.

---

## 36. Shipped is not delivered. Track notification aspiration and confirmed receipt separately.

**Rule.** A notification (or any side-effect the user is supposed to
receive) is not "done" when the code ships. It is done when a live
test confirms the user actually received it. The notification catalog
and the runbook matrix both track two things separately: the target
(which channels it should hit, build status) and confirmed receipt
(did HK actually get it, on which date). Never collapse the two. A row
that says "shipped" with an empty confirmation is an open item, not a
closed one.

**Why.** "Shipped but silent" is a recurring failure here. A function
returns 200, a row flips to paid, a deploy goes green, and yet the
human gets nothing. The only thing that catches it is a real test and
an honest record of what arrived. HK Jun 10 2026: "as I confirm that I
got a notification, you should update that in the matrix. Both what we
are aspiring to do or doing, and then an update on whether I confirmed
receiving it or not."

**Where it lives.** `docs/NOTIFICATION_MAP.md` (the catalog, with
Implementation status) and FOUNDER_RUNBOOK section 17 (the matrix with
target / build status / HK confirmed receiving). Update both in the
same change that adds or alters a notification.

**Incident log.**
- **Jun 10 2026:** `payment_received` (T8) and the client receipt were
  marked wired since Phase 3 but had been silently 401-blocked (see
  principle 2). The catalog said "shipped"; reality was zero delivery.
  A single live $1 payment plus the confirmation column exposed it.
  This principle is the generalization: confirmation is a column, not
  an assumption.

**Verification gotchas worth keeping in mind.**
- Therapist emails go to the therapist account email, not the client
  inbox. For the demo: therapist mail is bodymapdemo@gmail.com, client
  mail is bodymap01@gmail.com. Check the right inbox before declaring a
  notification missing.

---

## 37. One way to show each thing. A client, a booking, or a session should look and edit the same everywhere it appears.

**The problem, in plain words.** The same client shows up in at least
three places with different fields and different editing. The profile
"Client info" card has the full set and edits inline. The "Edit client"
slide-over only edits name, email, phone, and notes. The Schedule
"Client details" card shows seven fields read-only and edits none. It is
one clients row underneath, but three hand-built layouts that drift
apart. A therapist can see a birthday in the schedule that they cannot
edit in the edit form. That is confusing and looks unfinished.

**The rule.** Each kind of thing (client, booking, session) gets ONE
shared piece that draws its fields. Every screen that shows that thing
uses that same piece. Add a field once and it shows everywhere. The
form you edit in always matches what you see.

**Before building or changing any screen that shows or edits one of
these, do this first:**
- Grep every other place that renders the same thing.
- Compare the field list and whether each place lets you edit.
- If they do not match, say so in the reply, even if no one asked.

**Do not standardize on your own.** When drift is found, do not quietly
rewrite it. Write down how it will look in each place, what changes, and
what (if anything) is missing, and get HK's approval first. Good design
comes before consistency for its own sake.

---

## 38. Project-instruction changes are returned as complete ready-to-paste text, with placeholders for secrets. Never a list of hand-edits.

**Rule.** When HK needs an agent's project instructions changed, the chief
returns the complete, ready-to-paste replacement text for those
instructions, as one block HK can copy in a single action. Any secret in
that text is shown only as a clearly marked placeholder, for example
`PASTE_YOUR_NEW_TOKEN_HERE`, that HK swaps in himself. The chief never hands
HK a list of in-place edits to perform by hand ("change line 3 to...",
"find the gh line and replace it"). One copy lands one result.

**Secrets never appear in chat, only placeholders.** The chief never prints
a real token, key, or password back into the conversation, even one it was
given or one it can read from the environment or the remote URL. The
replacement text carries a named placeholder; HK fills the real value in
his own paste, where it never crosses the chat transcript.

**Why.** This is the "deliver work, not homework" principle (top of this
file) applied to the one surface that is most error-prone to hand-edit:
the agents' own instructions. A hand-edit list invites a missed line, a
half-applied change, or an agent left in a broken state, which is exactly
how the token rotation left a chief session unable to push. A full
replacement block removes the chance of a partial apply. Echoing a secret
back into chat would leak it into the transcript and history, so the
placeholder is not a convenience, it is the safe default.

**Cost.** Set 2026-06-12 after a token rotation left agent instructions
partly updated and a chief session unable to push, so the gh-to-helper
correction and a design principle did not land until re-applied. The fix
is to always return the whole block, with placeholders, not a diff to apply
by hand.

---

## Risk register (current open items, as of Jun 1 2026)

Items here are known live risks. Each entry: severity, what could go wrong, what's queued to mitigate.

1. **14 .in() sites with unbounded arrays may 400 at scale**: Medium. SQL .in() builds the array into a URL; 650+ IDs hits 30 KB URL and Postgres returns 400 silently. Mitigation: Option B (chunked queries) queued. Affected files: 14 grep hits across src/. Trigger: any therapist with 650+ clients.

2. **Notification routing fires wrong template when outcome flag not read**: High. C2 (no-show with charge) fires as C1 (regular reminder); C11 (paid-deposit no-show) fires as no_show_notice_no_fee instead of payment-request. Fix: gate by `bookings.outcome` + `cancellation_charges.status` in send-notification before template selection.

3. **Client BookingManage page broken**: High. Magic link in client emails points to /booking/manage but the page renders a 404-like empty state. Blocks client self-cancel flow entirely. Fix: build real page or remove links.

4. **PWA force-reload required if SW gets stuck**: Medium. SW v35 ships an update-ready banner instead of auto-reload, but if a user is on SW v33 or earlier and that SW is itself cached badly, they may never receive v35. Recovery requires Settings > Safari > Website Data delete. Documented in FOUNDER_RUNBOOK Procedure 12.

5. **SendModal image insert requires manually-pasted public URLs**: Low. No Supabase Storage upload UI yet; HK must host images elsewhere and paste the URL. Acceptable for current volume.

6. **Block create has no DB-level dedup**: Medium. Two identical block rows can insert without error. UI gap-calc fix (Jun 1) removes the trigger behavior, but defense in depth requires UNIQUE constraint (therapist_id, date, start_time, end_time, note). Queued.

7. **Side panel scroll/close affordances intermittently fail**: High. HK has reported the side panel (DetailPanel) closing unexpectedly, losing scroll position, or not surfacing edit affordances on mobile. Reproduction inconsistent. Suspected cause: `position: fixed` + flexbox children fighting overflow boundary (rule #20), plus possible re-render races. Mitigation queued: full mobile QA pass with screen recording, then targeted fix.

8. **Mobile PWA stale-bundle risk**: High during deploy windows. iOS Safari aggressively caches the installed PWA. Even with SW v35 banner, users who don't tap Refresh stay on the old bundle. After a critical bug fix, they remain exposed. Mitigation: SW skipWaiting + claim minimizes the window, but the user-controlled refresh is by design (rule #35 process compensates).

9. **No ESLint `no-use-before-define`**: Medium. Rule #34's class of bug (temporal dead zone) is not caught at build time. Enabling the rule will surface ~30 false positives that need triage. Queued.

10. **Edge function `validActions` and `templates` are two sources of truth**: Medium. Adding a new template to one without updating the other causes silent send failures (62/62 failed product_update broadcast on Jun 1). Mitigation: refactor `validActions = Object.keys(templates)` so they stay in sync by construction. ~30 min.

