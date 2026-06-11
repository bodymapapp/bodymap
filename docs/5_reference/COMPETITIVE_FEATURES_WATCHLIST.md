# Competitive Features Watchlist

**Last updated:** May 27, 2026
**Why this exists:** HK May 27 2026 catch: Jacquie asked for a daily hands-on hours cap (MassageBook has it, we did not). We should not be surprised by features therapists already use elsewhere. This doc tracks what every meaningful competitor offers, what we have, what we are missing, and what is intentionally out of scope.

When something new is shipped or discovered, add a row. When something stops being relevant, mark it killed but leave the row for history.

---

## Read this first

**Process for adding a row:**
1. Name the feature in plain language (not jargon)
2. Cite who has it (one or more competitors)
3. Describe what it does in one sentence
4. Estimate ROI for solo massage therapists (Low / Medium / High)
5. Estimate build effort (Hours / Days / Weeks)
6. Mark status: We have it / In flight / Queued / Researching / Intentionally not building / Killed

**When to revisit a Queued row:**
- A founding therapist asks for it explicitly
- Two or more therapists ask within a 30-day window
- A new competitor ships it and it gets press
- The build effort drops because we shipped adjacent infrastructure

---

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | We have it, shipped to production |
| 🔧 | In flight, this week |
| ⏳ | Queued, will build when triggered |
| 🔬 | Researching, decision pending |
| ⛔ | Intentionally not building, with reason |
| 💀 | Killed, do not revisit unless context changes |

---

## Scheduling and availability

| Feature | Who has it | What it does | ROI | Effort | Status |
|---|---|---|---|---|---|
| Working hours per day of week | All | Mon-Fri 9-7, Sat 9-2, etc. | High | Done | ✅ |
| Buffer between sessions | Acuity, Cal.com, Vagaro | Auto-pad N minutes after each booking | Medium | Done | ✅ |
| Visual calendar grid for blocking | Airbnb host, Cal.com, Calendly | Tap days to block, drag for ranges | High | Hours | 🔧 May 27 |
| Recurring blocks (every Saturday) | Vagaro, MassageBook, Acuity | "Block every Sat" rule, override single dates | High | Hours | 🔧 May 27 |
| Daily hands-on hours cap | MassageBook | Limit booked minutes/day, override on therapist side | High | Hours | 🔧 May 27 |
| Holiday quick-pick | Cal.com, Calendly | One-tap "block all US federal holidays" | Medium | Hours | 🔧 May 27 |
| Week starts Sunday/Monday | Google, Outlook, all | Therapist preference for week layout | Low | Hours | 🔧 May 27 |
| Time zone awareness | All | Auto-detect, show times in client's TZ | Medium | Done | ✅ |
| Year heatmap view | Cal.com, GitHub | Yearly view to spot patterns | Low | Days | ⏳ |
| Multi-location availability | Acuity, Vagaro | Different hours per location | Medium | Done | ✅ |
| Padding before first / after last appt | Cal.com | "I will not take a booking before 10am even though hours start 9am" | Low | Hours | ⏳ |
| Min notice for booking | Calendly, Cal.com | Client must book X hours/days in advance | Medium | Done | ✅ |
| Recurring appointments for clients | Vagaro, MassageBook, Mindbody | Client books "every 2 weeks same time" once | High | Days | ⏳ |

## Booking page experience

| Feature | Who has it | What it does | ROI | Effort | Status |
|---|---|---|---|---|---|
| Service-specific intake forms | ClinicSense, Jane App | Different intake per service type | Medium | Days | ⏳ |
| Visual body map intake | Nobody | Front/back diagram with pressure zones | High (our moat) | Done | ✅ |
| Group classes | Mindbody, Vagaro | Multi-client class bookings | Low | Weeks | ⛔ solo-only platform |
| Gift cards | Vagaro, Square | Sell gift certs at booking | Medium | Days | 🔧 Phase 1 done, Phase 2 queued |
| Online payment at booking | All majors | Take card upfront | High | Done | ✅ |
| Booking deposits | GlossGenius, Vagaro | Partial charge to hold slot | High | Done | ✅ |
| Approval workflow before charge | (Distinctive) | Therapist reviews each request first | High | Done | ✅ |
| Booking via SMS | Apptoto | Client texts to book | Low | Weeks | ⛔ unusual for massage |
| Embeddable widget | Calendly, Cal.com | Embed booking on therapist website | Medium | Hours | ⏳ |

## Client management

| Feature | Who has it | What it does | ROI | Effort | Status |
|---|---|---|---|---|---|
| Longitudinal body map history | Nobody | Heat overlay across all sessions | High (our moat) | In flight | 🔧 ongoing |
| Client tags | Acuity, Jane App | Tag clients (VIP, prenatal, athlete) | Medium | Hours | ⏳ |
| Client notes | All | SOAP-style notes per session | High | Done | ✅ |
| Waiver signing | ClinicSense, Jane App | E-sign intake/waiver | High | Done | ✅ |
| Custom intake fields | Jane App, ClinicSense | Therapist defines own questions | Medium | Days | ⏳ |
| Photo attachments to notes | ClinicSense | Document visible conditions | Low | Days | ⛔ liability concerns |
| Client login portal | Mindbody, Vagaro | Client sees their history | Medium | Weeks | ⏳ tied to two-way SMS |

## Notifications

| Feature | Who has it | What it does | ROI | Effort | Status |
|---|---|---|---|---|---|
| Email reminders | All | 48h / 24h / 2h reminders | High | Done | ✅ |
| SMS reminders | All majors | Same but text | High | Done May 27 | 🔧 wiring |
| Two-way SMS | Apptoto, Birdeye | Client texts back, therapist replies in app | Medium | Days | ⏳ requires inbound routing |
| Custom notification timing | Cal.com | Therapist sets own reminder schedule | Low | Done | ✅ |
| Lapse re-engagement | Vagaro, MassageBook | Auto "we miss you" at 60/90 days | High | Done | ✅ |
| Birthday greeting | Vagaro, Square | Auto wish on client's birthday | Low | Hours | ⏳ |
| Post-session warmth email | Distinctive | Warm note + recap | High | Done | ✅ |

## Money

| Feature | Who has it | What it does | ROI | Effort | Status |
|---|---|---|---|---|---|
| Stripe Connect | Square, Calendly, Cal.com | Pass-through payments | High | Done | ✅ |
| Cancellation fees | All majors | Auto-charge on late cancel | High | Done | ✅ |
| No-show fees | All majors | Auto-charge on no-show | High | Done | ✅ |
| Packages / session bundles | Vagaro, Acuity, Mindbody | Sell 10-pack at discount | Medium | Done | ✅ |
| Memberships / subscriptions | Vagaro, Mindbody | Monthly recurring billing | High | Done | ✅ |
| Tip collection | GlossGenius, Square | Tip prompt at checkout | Medium | Days | ⏳ |
| Multiple payment methods | All majors | Card + ACH + Apple Pay | Medium | Done (card+Apple Pay) | ✅ |
| Payout schedule control | Stripe Express | Daily/weekly/manual/instant | n/a | Therapist's call | ⛔ HK explicitly out of scope |
| Income reporting | QuickBooks integration | Auto-sync to QB / Xero | Medium | Days | ⏳ |
| Sales tax handling | Square | Auto-calc by location | Low | Days | ⛔ massage usually exempt |

## Marketing and growth

| Feature | Who has it | What it does | ROI | Effort | Status |
|---|---|---|---|---|---|
| Review collection | Vagaro, Birdeye | Auto-prompt for reviews | High | Days | ⏳ |
| Google reviews integration | Vagaro | Show Google reviews on booking page | Medium | Days | ⏳ |
| Referral codes | Vagaro, Mindbody | Client refers, gets credit | Medium | Days | ⏳ |
| Promo codes / discounts | All majors | One-time and recurring discounts | Medium | Days | ⏳ |
| First-visit specials | Vagaro | "First massage 20 percent off" auto-applied | Medium | Days | ⏳ |
| Email marketing campaigns | Vagaro, Mindbody, Mailchimp | Newsletter to client list | Low | Weeks | ⛔ scope creep, point to Mailchimp |
| Instagram/Facebook auto-post | Vagaro | Cross-post bookings or specials | Low | Weeks | ⏳ |
| Booking link QR code | Distinctive | QR for in-room signage | Medium | Done | ✅ |

## Operations

| Feature | Who has it | What it does | ROI | Effort | Status |
|---|---|---|---|---|---|
| Calendar sync (Google/Outlook/Apple) | All | Two-way sync with personal calendar | High | Done (Google) | 🔧 Outlook/Apple queued |
| Staff scheduling | Mindbody, Vagaro | Multiple staff per business | n/a | Weeks | ⛔ solo-only platform |
| Room/resource booking | Mindbody | Track which room is used | n/a | Weeks | ⛔ solo-only |
| Reports and dashboards | Mindbody, Vagaro | Monthly stats | Medium | Done (basic) | ✅ |
| Mobile app (native) | Vagaro, Mindbody | iOS/Android native apps | Medium | Months | ⛔ PWA covers this |
| PWA support | Distinctive | Install to home screen, push notifications | High | Done | ✅ |
| Data export | All majors | Download all data as CSV | Medium | Done | ✅ |
| Two-factor auth | All majors | 2FA on login | Medium | Days | ⏳ |

---

## Distinctive (only we have it)

Two features form our moat. Track here so we know what to defend.

| Feature | Why it matters | Status |
|---|---|---|
| Visual body map intake | Front/back diagram, tap-to-select zones, pressure, medical flags. No other platform has this. | ✅ Live |
| Longitudinal body intelligence | Heat overlay showing where each client carries patterns across all sessions. Competitors can copy intake; they cannot replicate the longitudinal pattern intelligence without rebuilding everything. | 🔧 In flight |

---

## How we decide what to build next

1. **Triggered features first.** Anything in 🔧 status (a real therapist asked) jumps the queue.
2. **High ROI + Hours of effort second.** Maximum impact for minimum risk.
3. **High ROI + Days of effort third.** Only when no quick wins are queued.
4. **Defensive features fourth.** When a competitor ships something that makes us look behind, we evaluate the actual demand before reacting.
5. **Weeks-of-effort features last.** Only when distribution traction warrants the investment.

This list is meant to be HK's reference when deciding "what's the next thing to build?" It should never be longer than 2 screens. Kill rows that have not moved in 90 days unless the topic is still strategically alive.
