# BLOCK_PLAN.md

Working document for everything queued, blocked, deferred, or in-flight.
Read the **Summary** below to know where things stand in five minutes.
Read the **per-ribbon** sections to see what's coming on your platform.
Drop into **Details** at the bottom only when you need execution-ready
materials for a specific block.

**Most recent session handover:** [`docs/HANDOVER_2026-05-15.md`](./HANDOVER_2026-05-15.md) (Stripe Connect marathon + Phase 1/2.1/2.2 work May 16 2026).

---

## Summary

**Currently active.** What is being worked or is ready to start the moment you OK it.
1. **Notification system, Phase 1: payment received + new client signup.** Backend `notification_log` + `notification_prefs` already wired; missing the actual fire points and an in-app surface. Macro Platform Improvement #1.
2. **Smart Calendar SVG animation (Ribbon 4 demo).** Three-act loop bringing the left-column insights to life. Replaces `ScheduleDemo` in Ribbon 4. Phase 4 of the May 16 session, queued.
3. **Card-on-file detection for returning clients.** Booking page does not detect existing saved card after 5+ bookings; client list lacks the indicator too. Ribbon 1 entry. Real customer-facing bug.
4. **StatusStrip Agreement tile.** 75 min. Replace the conditional pendingIntake chip with a permanent Agreement tile on the client profile. Ribbon 2 entry.

**Externally blocked.** Waiting on something we don't control.
- Google OAuth app verification (waiting on 5+ test therapists + reachable privacy/terms URLs)
- Optional client portal (waiting on 3+ founding-therapist requests; currently 1)
- Twilio onboarding friction (escalation tripwire: 3 handhold requests in one month)

**Recently shipped (May 16 2026 session).**
- Stripe Connect architectural fix + stale-customer recovery in `create-deposit` and `charge-cancellation-fee` (Phases 0 + 1)
- Smart Booking standalone pillars removed from Home + Features; content lives only in Ribbon 4 + the WhyMyBodyMap differentiation list now (Phase 1)
- Ribbon 4 promoted to a featured Smart Calendar variant: sage gradient, "The moat" badge, elevated demo frame, tightened tagline, reordered sub-features (Phase 2.1, commit `866e91b2`)
- Mark No-Show button on past bookings, wired through `CancellationChargeModal` with `isNoShow: true` and a preserved `no_show` booking status distinct from `cancelled` (Phase 2.2, commit `85bab672`)

---

## Open asks

The list of things real people have asked for, by name and date.
Tracked here so we can see when demand crosses a threshold for unblocking.

### From therapists
- **Candice Peek (May 16 2026 evening)**: "Is there a way to block off sections of time in a day without blocking the full day?" → HK committed "we will add that tonight." Shipped: Phase 9.1 (inline partial-day blocks via Time off panel, commit `401e1679`) + Phase 9.2 (long-press anywhere on the Today timeline to drop a 60-min block, commit pending).
- **Ashley Scalzulli (May 12 2026)**: client login portal. → see [Macro #2: Optional client portal](#macro-2-optional-client-portal).
- **HK (May 16 2026 morning)**: "When I got paid, I should have received an email." Plus on-platform + email + SMS for every payment, new client, and booking event. → see [Macro #1: Notification system](#macro-1-notification-system).
- **HK (May 16 2026)**: Cancellation, reschedule, and one more similar workflow ("not sure if those workflows exist"). Audit result: cancel ✓, reschedule ✓, no-show was the missing third, shipped Phase 2.2.
- **Lindsey (May 10 2026)**: editable intake fields from SessionDetail. → mostly shipped; see [Detail §2](#2-lindsey-11--focus-distribution-commit-2-of-2-shipped-may-10-2026) for the deferred follow-ups.

### Found-during-testing (May 17 2026 ~5am)
- **Duplicate client rows for same email.** Bodymap01@gmail.com has two client rows under the same therapist (Joy I, Mybodymap Demo) with different phone numbers and creation dates. **Why this matters:** the Body Map longitudinal pattern intelligence (the moat) requires session history to live on ONE client record per person, not split across duplicates. When a returning client books with the same email, the booking flow must find the existing client by email-match, not create a new row. Queued for investigation.
- **Verify cron schedules for `send-reminders` and `send-post-session`.** The functions are written for cron but the audit couldn't confirm the cron jobs are actually scheduled in Supabase Dashboard. If empty, client SMS reminders never fire automatically. Quick check, queued.


### From clients
- None tracked currently. When a client request lands (via founding therapist relay or a support reply), append here with date.

---

## Macro platform improvements

Platform-level work that doesn't belong to a single ribbon.

### Macro #1: Notification system
**Status:** queued, Phase 3 of the May 16 session, awaiting OK on scope.
**Why now:** HK got a real Stripe payment on May 16 and received zero notification. Foundation is half-built (prefs JSON + log table + helpers) but no fire points for `payment_received` or `new_client_signup`, and no in-app bell/drawer surface. Defaults in `notification_prefs` already cover `new_booking`, `intake_filled`, `gift_purchased`, `daily_pulse` for the therapist; missing types: `payment_received`, `new_client_signup`, `booking_cancelled`, `booking_rescheduled`, `no_show_recorded`, `cancellation_fee_charged`, `refund_issued`.
**Scope estimate:** Minimum viable 3 hrs (in-app table + helper + 2 fire points + bell drawer). Full coverage 6-10 hrs.
**Plan:** new `in_app_notifications` table with `read_at` for unread state, new shared `notifyTherapist({ event, subject, body, payload })` helper that checks prefs, writes the row, sends Resend email, sends Twilio SMS, logs each to `notification_log`. Wire `payment_received` from `capture-saved-card`, `new_client_signup` from `send-welcome`, `booking_cancelled` + `no_show_recorded` from the cancel/no-show flows in `CancellationChargeModal`. Bell icon in therapist top nav with unread count, rose/cream drawer matching Gift Cards aesthetic.

### Macro #2: Optional client portal
**Status:** blocked, waiting on 3+ requests.
**Current count:** 1 (Ashley Scalzulli, May 12 2026). Jiny, Terra, Kathy have not asked.
**Why not yet:** the "no client login" stance is a marketing pillar codified in 3 places. Building this changes the framing. Build only when demand justifies it. See [Detail §6](#6-optional-client-portal-with-login).

### Macro #3: Twilio onboarding friction (recurring)
**Status:** below escalation threshold.
**Tripwire:** 3 onboarding handholds in a single month, then build the in-app wizard immediately. Currently 2 (Candice, May 15). See [Detail §7](#7-twilio-onboarding-friction-recurring).

### Macro #4: Google OAuth app verification
**Status:** blocked, waiting on 5+ test therapists connecting cleanly + live privacy/terms URLs.
**Effort to submit when unblocked:** ~45 min, all materials are pre-drafted. See [Detail §1](#1-google-oauth-app-verification).

### Macro #5: Stripe promo code cleanup
**Status:** queued.
**What:** `BETASILVER` codes with underscores still have issues. New codes without underscores (`BETASILVER3M`, `BETASILVER12M`) need to be created. Old $24 payment links need deactivation. Per memory, not yet completed.
**Scope:** ~30 min in Stripe Dashboard, no code.

### Macro #6: Video pipeline (15 automated videos)
**Status:** queued.
**What:** Playwright + Remotion pipeline. Feature IDs match video IDs (1.1 to 7.4). BM-0.0 intro first (HK checkpoint required). Founder story BM-7.4 posts first on LinkedIn, TikTok, Reddit, HN before product videos.
**Pending:** v3 doc with corrected IDs.

### Macro #7: Body Map hero section on Features page
**Status:** queued, marked "highest priority" in memory.
**What:** front/back visual, focus/avoid, pressure, medical flags, longitudinal intelligence. Bronze=last 5 sessions, Silver=all sessions. This is the core moat and should be a hero section on the Features page.
**Note:** with the Phase 2.1 Ribbon 4 promotion to "The moat" treatment, decide whether Body Map gets a parallel treatment in Ribbon 2 (Know Your Client) so the two moats are visually co-equal.

### Macro #8: Close-button audit and standardization (shipped May 16 2026, Phase 9.6)
**Status:** shipped.
**Done:** all 33 instances of × across 18 files swept and replaced. New `CloseButton.jsx` component standardizes modal/sheet dismissals. List-row deletes got labeled "Delete" / "Remove" / "Dismiss" pills with red hover. The success-banner dismiss × on BookingPage became the explicit word "Dismiss." Build clean. Every replacement hits the 44×44 tap-target minimum where applicable, all use real English words instead of glyphs.
**Files touched (18):** BookingModal, AddClientModal, WaitlistModal, QuickSendModal, ScheduleDashboard (2 modals), PracticeAgreement, SessionList, MembershipsCard, EventsCard, PackagesCard, ClientList (2 nudges), MarketingNudges, Outreach (2 places), QRCodesCard, Comparison, IntakeEditor (5 places), Dashboard (3 places), BookingPage (6 places).
**Pattern documented for future modals:** use `CloseButton` from `src/components/CloseButton.jsx` for any modal/sheet/drawer close affordance. For inline list-row deletes, use a small `Delete` / `Remove` / `Dismiss` pill with red hover state. No bare × glyphs anywhere going forward.

---

## Per-ribbon improvements

Work mapped to the seven-ribbon taxonomy. Anything that lives inside a single
ribbon's product area goes here.

### Ribbon 1: Find & Book
- **Card-on-file detection for returning clients (TOP PRIORITY, ~1.5 hr).** Real customer-facing bug. See [Detail §5](#5-card-on-file-not-detected-for-returning-clients).
- **Buffer time between sessions (ID 1.8, queued).** Therapist sets X minutes post-booking; system excludes window from available slots. Settings toggle, OFF by default. Per memory.

### Ribbon 2: Know Your Client
- **StatusStrip Agreement tile (deferred from May 15-16, ~75 min).** All design decisions confirmed. See [Detail §8](#8-statusstrip-agreement-tile-deferred-from-may-15-16-session).
- **Lindsey #11 deferred follow-ups.** Body SVG C/T badge rendering on SessionDetail; terms of service consent clause. Not blocking core behavior. See [Detail §2](#2-lindsey-11--focus-distribution-commit-2-of-2-shipped-may-10-2026).
- **Slider redesign + intake auto-save (~4-6 hr).** HK rejected the May 10 design. Sliders next to body image with dotted connectors, editable percent numbers, back button on Preferences, localStorage draft auto-save. See [Detail §4](#4-slider-redesign--intake-flow-improvements-hk-may-10-2026-feedback).
- **Medical history intake (ID 2.6, queued).** Pregnancy, medications, surgeries, conditions checklist, allergies, emergency contact, red-flag surfacing, smart pre-fill on returns. ~60s first time, ~30s returns. Separate build from waiver. Per memory.

### Ribbon 3: Client Intelligence
- **Edit button on SessionDetail not visible (diagnostic).** Code shipped May 10 but HK does not see the button. See [Detail §3](#3-edit-button-on-sessiondetail-not-visible-may-10-2026-commit-339cfcac).

### Ribbon 4: Day-of-Session (Smart Calendar)
- **Smart Calendar SVG animation (~3 hr).** Three-act loop: empty Tuesday noon slot, platform surfaces the right lapsed regular, message draft appears, tap, slot fills. Soft sage and cream palette, mobile-safe SVG, no JS animation library. Replaces `ScheduleDemo` in Ribbon 4. Phase 4 of the May 16 session.
- **Phase 9.1: Partial-day blocks (shipped May 16 evening, commit `401e1679`).** Candice asked for the ability to block a portion of a day without blocking the whole day. HK committed "tonight." Migration adds `start_time`/`end_time` columns to `blocked_days` (both NULL = full day, backward compatible). The Time off panel now has Full-day / Time-range mode pills. Booking page and BookingModal treat partial blocks as pseudo-bookings in the slot-generation pipeline so the existing conflict check handles them, no new logic needed. **Migration still needs to run in Supabase** before partial-block submits work in production.
- **Phase 9.2: Long-press timeline canvas to create a block (shipped May 16 evening, commit `ec4e7e3a`).** HK directive: long-press on calendar to create a block. Built on the existing TimelineView pixel canvas — 500ms long-press anywhere on the timeline opens a confirm sheet with the proposed time window (snapped to 15-min, 1-hour default), an editable end time, an optional reason. Confirms via the same `addBlockedDay({date, startTime, endTime, note})` path Phase 9.1 wired. Canvas always renders now (even on empty days) so long-press works everywhere. Partial blocks for the current day render as amber-striped overlays. Past days disabled.
- **Phase 9.3: Long-press → "block or event" (queued).** HK said "create a block or event." Only block is in 9.2. Event would mean a second option in the sheet: instead of blocking, open BookingModal pre-filled with the long-pressed time so the therapist can schedule a client at that slot. ~1 hour. Reasonable next step but not tonight.

### Ribbon 5: Relationships
- **Daily Evening Digest (queued).** One daily email showing who reached out, who is due for outreach, lapsed clients by pattern. Per memory.

### Ribbon 6: Money & Protection
- **Stripe Connect for billing data (ID 6.5, next active priority after Features page).** Wire in real billing data. Stripe Connect Express live mode already active. Per memory.
- **Supabase cron for `daily-signups-digest`.** Scheduled at `0 12 * * *` (7am Central). HK to set up in Supabase Dashboard > Cron Jobs > Edge Function > POST. Per memory.

### Ribbon 7: On Your Phone
- **Instagram @mybodymap.app 7-day warmup (in progress).** Follow/like/save/comment, no posts. Hook formula: "5 [signs/things/mistakes] that [outcome]" with warning framing that outperforms. 7-sec video: Pexels stock + hook text whole time + "read description below" at 3s. Post 2x/day. HK executing.
- **Reddit launch post.** Drafted, not yet published.
- **Facebook restoration.** HK banned from Massage Therapy Business Builders for over-posting; working with admin to restore access.
- **Image backlog (3 placeholders queued).** Specs: 543×464 JPEG, warm cream/sage palette, no text overlay. Gift cards Features hero, campaigns Features hero, cycle-aligned scheduling 1.2 hero. Batch image asks in groups of 10-20, never one at a time.

---

## Details

All execution-ready materials. Each entry below is the original detailed block,
preserved so you can drop in and run when an item becomes active.

## 1. Google OAuth app verification

**Current status (May 10 2026 EOD).** HK started the verification
submission in Google Cloud Console. Form is partially filled but
not submitted. Missing pieces:

- Demo video not yet recorded. Script is below, phone-friendly
  version added. ~2.5-3 minute screen recording, voiceover
  recommended but on-screen captions acceptable.
- Scope justification text not yet pasted. Tightened version for
  the form's compact box is below under 'Materials: Scope
  justification (form version)'.
- 'Additional info' field may or may not appear depending on
  Google's flow. Pre-drafted text below in case it shows up.
- Privacy policy and terms of service URLs not yet verified live
  at https://www.mybodymap.app/privacy and /terms. Google will
  bounce the submission within a day if these aren't reachable.

**Next time on this:** open BLOCK_PLAN.md, scroll to this entry,
copy the three text blocks below into Google's form, record the
video using the phone script, upload to YouTube as Unlisted,
paste the URL, click Submit. ~45 minutes total.

**Why blocked.** Submitting now while still iterating on the
OAuth flow risks needing to resubmit if anything changes. Better
to lock the consent screen branding, prove the flow works
end-to-end with a few real therapists in Testing mode first, then
submit once stable.

**When to revisit.** As soon as one of these is true:

- Five or more therapists have successfully connected Google
  Calendar via the Testing flow (so we know the flow is solid)
- We are close to scaling past 100 test users (Google's Testing
  mode hard cap; production users can not connect until verified)
- A privacy policy and terms of service are live at
  https://www.mybodymap.app/privacy and /terms (Google requires
  reachable URLs as part of the submission)

Whichever comes first. Realistically, 2-4 weeks from May 10 2026.

**Why this matters.** While the app sits in Testing mode, every
therapist who connects sees a yellow "Google hasn't verified this
app" warning mid-flow with an "Advanced" link they have to click,
then a "Go to MyBodyMap (unsafe)" link. A 70-year-old persona
will not click "(unsafe)". Verification removes the warning.

**How long verification takes.** Google reviews 2-6 weeks for
apps using sensitive scopes (calendar.events is sensitive). No
cost. We submit once.

### Materials: Scope justification (form version)

This is the tightened version designed for Google's compact
scope justification box. Use this instead of the long paragraph
above when filling out the actual submission form.

> MyBodyMap is a scheduling and client retention platform for solo
> licensed massage therapists. We request the calendar.events
> scope to provide two-way synchronization between MyBodyMap
> bookings and the therapist's Google Calendar.
>
> Specifically: (1) when a client books a massage on MyBodyMap, we
> write a corresponding event to the therapist's primary Google
> Calendar so the therapist sees all their commitments in one
> calendar. (2) When the therapist adds personal events to their
> Google Calendar (lunch, dentist, family commitments), we read
> those events and block matching time ranges on the therapist's
> public MyBodyMap booking page so clients cannot accidentally
> book over personal commitments.
>
> We read event start time, end time, and summary (title). The
> summary is only displayed to the therapist on their own
> dashboard so they can see what is blocking their time. Clients
> on the public booking page never see event summaries; they see
> those time ranges as unavailable with no detail. We write
> events with the client's first name, service name, and duration.
>
> OAuth tokens are stored encrypted in our Supabase Postgres
> database, gated by row-level security policies scoped to the
> authenticated therapist. Event data and tokens are deleted
> immediately when a therapist disconnects Google Calendar from
> their MyBodyMap settings, or when they close their MyBodyMap
> account. We do not share, sell, or use this data for advertising,
> machine learning, or any third-party service. This scope is the
> minimum necessary to enable two-way calendar synchronization.

### Materials: Additional info field (if it appears)

Google's submission form sometimes shows an 'Additional info'
text box (1000 char limit) after the scope justification step. If
it appears, paste this. If it doesn't appear, skip.

Replace the two `[PASTE...]` placeholders before pasting.

```
MyBodyMap (mybodymap.app) is a production scheduling platform for solo licensed massage therapists.

Test user credentials:
  Email: bodymapdemo@gmail.com
  Password: [PASTE YOUR TEST ACCOUNT PASSWORD]

After login, navigate to Settings to find the Google Calendar sync section under "How I plug in." The Connect button initiates the OAuth flow shown in the demo video.

This is our only OAuth-using project. The application is deployed on Vercel with backend services on Supabase. All Google Calendar API traffic flows through Supabase edge functions; the React frontend never handles tokens directly.

We are currently in Testing mode and have onboarded test therapists on the whitelist. We are submitting for verification to support our broader rollout to founding therapists.

Contact for verification questions: [PASTE YOUR EMAIL HERE]
```

### Materials: Phone-friendly video script

Recommended approach for HK: phone screen recording, landscape
orientation, voiceover spoken into the phone mic. 2.5-3 minute
target. One continuous take preferred over edited cuts.

Tools: iOS Screen Recording (Control Center > Record button),
Android Screen Record, or Loom on mobile. Upload to YouTube as
**Unlisted** (not Public, not Private).

If voiceover is impractical, captions in YouTube Studio after
upload are an acceptable substitute. Google requires either,
not both.

Before recording:
- Enable Do Not Disturb so notifications don't pop up
- Lock orientation to landscape
- Close all other apps in app switcher
- Have a test therapist account ready: bodymapdemo@gmail.com
- Pre-create one or two test events on the test account's Google
  Calendar (e.g. "Dentist" Tuesday 2pm, "Lunch" tomorrow noon)
  so they're visible when the script gets to that beat

**[Start screen recording. Open Safari/Chrome. Go to mybodymap.app.]**

> Hi, this is a demo of MyBodyMap. We're a scheduling platform for solo massage therapists. I'm going to walk through our Google Calendar integration end to end.

**[Tap Log In. Log into bodymapdemo@gmail.com.]**

> I'm logging in as a test therapist.

**[Land on dashboard. Tap into Settings, scroll to How I plug in.]**

> In Settings, under "How I plug in," there's a section called Google Calendar sync.

**[Tap the Google Calendar sync row to expand it. Pause briefly so the screen shows the description.]**

> The therapist sees what the integration does. Bookings made here will appear in their Google Calendar. Personal events from Google Calendar will block client bookings on their public page. The note also explains that Google events show up in MyBodyMap within fifteen minutes.

**[Tap Connect.]**

> When they tap Connect, they're sent to Google's consent screen.

**[Wait on the Google consent screen for 3-4 seconds so the reviewer can see the scope clearly. Don't tap anything yet.]**

> We request the calendar.events scope only. This is the minimum we need to write booking events to the therapist's calendar and to read events the therapist has added so we can block those times for clients.

**[Tap Allow.]**

> The therapist allows access.

**[Google redirects back to MyBodyMap settings. The green Connected banner appears.]**

> Google redirects back, and MyBodyMap confirms the connection. The settings row now shows the connected Google account.

**[Tap Sync Now.]**

> I'm triggering an immediate sync. Normally this happens every fifteen minutes automatically.

**[Switch apps to Google Calendar on phone. Show the existing test events.]**

> Here's the same therapist's Google Calendar. There's a dentist appointment and a lunch event already on the calendar.

**[Switch back to MyBodyMap. Tap into the Schedule view.]**

> Back in MyBodyMap, the schedule shows those same events in lavender, labeled "From Google."

**[Tap on one of the lavender entries to open the read-only detail panel.]**

> Tapping one shows a read-only panel. The therapist sees the event title, "Dentist." There's no reschedule or cancel button here because edits live in Google Calendar. The panel reminds them changes take up to fifteen minutes to sync.

**[Close the panel. Open a fresh incognito tab. Navigate to the public booking page.]**

> Here's the public booking page a client sees. I'll try to pick the Tuesday afternoon that has the dentist appointment.

**[Try to select Tuesday 2 PM. The slot should not be offered.]**

> Two PM is not offered. The client never sees the word "Dentist" or any indication of why the time is unavailable. They just see that slot as unavailable.

**[Pick a different open time. Complete a test booking.]**

> I'm completing a test booking for a different open time.

**[Confirmation appears. Switch to Google Calendar. Wait a few seconds, refresh.]**

> Within a few seconds, the new booking appears in the therapist's Google Calendar. Title is the client's first name and service.

**[Switch back to MyBodyMap settings. Tap Disconnect.]**

> Finally, the disconnect flow. From settings, the therapist taps Disconnect.

**[Confirm the disconnect.]**

> Disconnecting immediately stops sync in both directions. Existing events stay where they are so nothing is lost, but no new events sync either way. We delete OAuth tokens from our database immediately. The therapist can reconnect anytime.

**[Final pause on the disconnected state.]**

> That's the full Google Calendar integration. Thank you.

**[Stop recording. Upload to YouTube as Unlisted. Paste URL into the verification form.]**

### Materials: Justification paragraph (long version, for reference)

Paste this into the "Justification" field on the Google
verification form for the `calendar.events` scope. Edit the
wording lightly if Google asks for anything more specific.

> MyBodyMap is a scheduling and client retention platform built
> for solo licensed massage therapists. Therapists use our
> service to accept new bookings from clients, manage their own
> appointment calendar, and run their solo practice.
>
> We request the `https://www.googleapis.com/auth/calendar.events`
> scope so that bookings created in MyBodyMap automatically
> appear in the therapist's primary Google Calendar, and so that
> personal events the therapist adds to their Google Calendar
> (lunch, dentist, family commitments) automatically block new
> client bookings on the MyBodyMap public booking page. This
> two-way synchronization eliminates the most common scheduling
> failure mode for solo practitioners: a client booking on top
> of a personal commitment that lived only in the therapist's
> personal calendar.
>
> Data handled: MyBodyMap reads event start time, end time, and
> summary (title) for events on the therapist's primary calendar.
> We use the summary only to show the therapist on their own
> dashboard what is blocking their time ("dentist", "lunch").
> Clients on the public booking page never see event summaries;
> they only see slots as available or unavailable. We write
> events to the therapist's primary calendar that mirror
> bookings made in MyBodyMap (client first name, service name,
> location).
>
> Storage: OAuth tokens are stored encrypted in our Supabase
> Postgres database, accessible only via row-level security
> policies that gate every query to the authenticated therapist's
> own row. Event data is stored only for events on the connected
> therapist's calendar, scoped to their record. Tokens and event
> data are deleted immediately when a therapist disconnects
> Google Calendar from their MyBodyMap settings, or when they
> close their MyBodyMap account.
>
> We do not share, sell, or use Google user data for any purpose
> other than the synchronization described above. We do not use
> it for advertising, machine learning training, or any third
> party service. All data is transmitted over HTTPS and at rest
> encryption is provided by Supabase.

### Materials: Demo video script

Total length: aim for 3-4 minutes. Record at 1080p, screen
recording only (no webcam). Use Loom, OBS, QuickTime, or
anything else. Upload to YouTube as **Unlisted** (not Public, not
Private). Give Google the unlisted URL on the verification form.

**Script.** Read or paraphrase as voiceover. Bracketed text is
what to do on screen.

> [Open mybodymap.app in a fresh browser window. Show the home
> page.]
>
> Hi, this is a demo of MyBodyMap, a scheduling platform for
> solo massage therapists. I am going to walk through how a
> therapist connects their Google Calendar to MyBodyMap and what
> happens when they do.
>
> [Click "Log in" in the top nav. Log in as a test therapist
> account, like bodymapdemo@gmail.com. Land on the dashboard.]
>
> This is the therapist's dashboard. They see their bookings,
> their schedule, and their settings here. I am going to go to
> the settings page now.
>
> [Click the gear icon or "Settings" link.]
>
> In settings, under "How I plug in," there is a section called
> Google Calendar sync. Let me open it.
>
> [Scroll to and click on the Google Calendar sync disclosure
> row to expand it.]
>
> The therapist sees a description of what the integration does:
> bookings created here go into their Google Calendar, and
> personal events from Google Calendar block client bookings on
> their public booking page. There is also a clear note that
> events from Google show up in MyBodyMap within 15 minutes
> because we poll the Google Calendar API every 15 minutes
> rather than using real-time webhooks.
>
> Now I will click Connect.
>
> [Click the Connect button.]
>
> The therapist is sent to Google's standard OAuth consent
> screen. They see that MyBodyMap is requesting access to view
> and edit events on their calendar.
>
> [Wait on the consent screen so the reviewer can see what is
> being requested. Read out the scope.]
>
> The scope requested is calendar.events. This is the minimum
> scope we need to create booking events in the therapist's
> calendar and to read events the therapist has added so we can
> block those times on their public booking page.
>
> [Click Allow.]
>
> Google redirects back to MyBodyMap. The settings page now
> shows a green confirmation that Google Calendar is connected,
> and the disclosure row updates to show the connected Google
> email address.
>
> [Show the connected state. Click "Sync now."]
>
> I am going to trigger an immediate sync. The therapist does
> not normally need to do this because we sync automatically,
> but it is here for testing.
>
> [Wait for sync to complete. Switch tabs to show Google
> Calendar for the same account. Show any existing events on
> the calendar.]
>
> Here is the same therapist's Google Calendar with a couple of
> personal events: a dentist appointment Tuesday at 2 PM and a
> lunch event Wednesday at noon.
>
> [Switch back to MyBodyMap. Open the Schedule view.]
>
> Back in MyBodyMap, the schedule now shows the dentist and
> lunch events in lavender, labeled From Google. The therapist
> can see what is blocking their time. Clients on the public
> booking page see those same time ranges as unavailable but do
> not see the event titles.
>
> [Click on one of the From-Google events to show the read-only
> detail panel.]
>
> Tapping a From-Google event opens a read-only panel showing
> just the event title and time. There is no reschedule or
> cancel option because that lives in Google Calendar. The
> panel explains that edits to this event happen in Google
> Calendar and show up here within 15 minutes.
>
> [Close the panel. Open the public booking page in an incognito
> window or a different browser to demonstrate the client view.]
>
> Here is the public booking page that a new client sees. I
> will pick the same Tuesday at 2 PM that has the dentist event.
>
> [Try to pick a Tuesday 2 PM slot. The slot should be greyed
> out or absent because the dentist event is blocking it.]
>
> Tuesday at 2 PM is not offered. The client never sees the
> word "dentist" or any indication of what is blocking the
> time. They just see it as unavailable, exactly as if the
> therapist had not set working hours for that slot.
>
> [Now make a booking on the public page for a different open
> slot. Walk through the booking flow quickly. Confirm the
> booking.]
>
> I am making a test booking now for a different open slot.
>
> [After confirmation, switch tabs to Google Calendar.]
>
> Within a couple of seconds, the booking appears as a new
> event in the therapist's Google Calendar. The event title is
> the client's first name and service. The therapist can see
> their full day in one place.
>
> [Switch back to MyBodyMap settings. Click Disconnect.]
>
> Finally, I want to show the disconnect flow. From the
> Google Calendar sync section in settings, the therapist
> clicks Disconnect.
>
> [Click Disconnect. Show the confirmation.]
>
> Disconnecting immediately stops sync in both directions.
> Existing events stay in Google Calendar so nothing is lost,
> but no new events flow either way. We also delete the
> therapist's OAuth tokens from our database immediately. They
> can reconnect at any time.
>
> That's the full Google Calendar integration. Thank you.

**Production notes.** Record in a quiet room, use the laptop
microphone or a USB mic. Do not edit unless something breaks
mid-recording; reviewers prefer one continuous take. Aim for
under 5 minutes. Mention every scope you are requesting and
demonstrate it being used. Show what data is read, where it is
displayed, and how disconnect works.

### Checklist before submission

- [ ] Privacy policy live at https://www.mybodymap.app/privacy
      with all required disclosures (Google data handling, third
      party services, contact email)
- [ ] Terms of service live at https://www.mybodymap.app/terms
- [ ] OAuth Branding tab in Google Cloud Console fully filled
      (app name MyBodyMap, support email, dev contact, app home
      page, privacy policy link, terms link, logo at 120x120)
- [ ] At least 5 therapists have connected and used the
      integration successfully without escalating to support
- [ ] Demo video recorded and uploaded to YouTube as Unlisted
- [ ] Justification paragraph copied into the verification form
- [ ] Click "Publish App" on the OAuth consent screen to switch
      from Testing to In Production. This auto-triggers the
      submission flow for sensitive scopes.

### After submission

- Google emails the developer contact when the review is
  complete (approved or needs changes)
- If they ask for changes (common on first submission), they will
  list exactly what to fix. Common asks: clearer privacy policy
  wording around data deletion, more specific scope justification,
  re-record video with a particular feature shown
- Once approved, the "Google hasn't verified this app" warning is
  gone for all users (not just Testing mode whitelist)
- Therapists who connected during Testing mode stay connected
  through the transition; no action needed on their end

---

## 2. Lindsey #11 + Focus Distribution (commit 2 of 2 shipped May 10 2026)

**Status.** Core build complete. Therapist can now edit intake
text/preference fields from SessionDetail with full audit trail.
Focus distribution sliders auto-derive on the back-body screen
and persist to the session row.

**What shipped (commit 1 + commit 2)**

- Migration `2026-05-10-editable-intake.sql` applied. Schema has
  the 8 new session columns plus intake_edits audit table.
- FocusDistribution component wired into Demo.jsx back-body
  screen. Auto-derives from focus zone selections. Locks when
  user manually drags any slider. Saves to sessions table via
  intakeData.frontPct/topPct/middlePct/bottomPct.
- SessionDetail has an Edit button on Client Preferences. Click
  to switch all 10 preference fields plus med_note and
  client_notes into editable inputs. Save writes the diff to
  sessions table AND one intake_edits row per changed field.
  Audit trail per the signed waiver.
- Default waiver text now includes a consent line for therapist
  intake corrections.
- Intake review screen shows a small italic note that the
  therapist may update intake for accuracy.

**What is deferred to a future commit**

- **Body SVG C/T badge rendering.** Therapist can edit text
  fields today but cannot edit body zone selections from
  SessionDetail. The columns front_focus_therapist /
  back_focus_therapist / front_avoid_therapist /
  back_avoid_therapist exist in the schema but are not yet
  populated by any UI. Future work: add a body-map edit mode
  to SessionDetail with C/T differentiation.
- **Terms of service consent clause.** There is no /terms page
  in the app today. The waiver carries the consent for now.
  When a real terms page is added, copy the relevant clause
  from the waiver into the terms.

These are good follow-ups but not blocking the core #11
behavior. The audit-log + edit flow for the most-edited fields
(pressure, music, lighting, med_flag, client_notes, etc.) is
fully working.

---

## 3. Edit button on SessionDetail not visible (May 10 2026 commit 339cfcac)

**Status.** Code shipped, but HK does not see the button. URL
verified to be `view="session-detail"` so the SessionDetail
component IS rendering. Edit button code is at
`src/components/SessionDetail.js` line ~432-439, inside the
Client Preferences card, gated on `!editingIntake` which starts
false. No visibility condition should be hiding it.

**Possibilities, ranked.**

1. Vercel build hadn't propagated when HK tested. Hard refresh
   in incognito on the exact URL HK shared should resolve. Try
   first.
2. There is a second SessionDetail-like component elsewhere
   that the route is actually rendering. Search for
   `view="session-detail"` consumers and trace.
3. My str_replace landed in a code branch that's not reached
   (e.g. there's a conditional that switches between two render
   paths and I edited the wrong one). Diff the file at line
   ~430 against what I committed in 339cfcac to confirm.
4. CSS is hiding it (overflow clipping at small viewports).
   Inspect the rendered DOM in browser devtools, search for
   '✏️ Edit' text, see if the element exists but is
   visually-hidden.

**Reproduction URL:**
https://www.mybodymap.app/dashboard/clients/1565eac6-ceff-4e81-a038-82fe5e8299c6/sessions/3b07f57d-7e94-432c-a2b5-779c14faad1b

Open in incognito after Vercel cache clears (about 90s after
the most recent push). Look for "Client Preferences" card on
the left column. Top-right of that card should show the Edit
button.

**Diagnostic if still not visible:**

Open browser devtools console on the URL above, paste:
```
document.body.innerText.includes('✏️ Edit')
```
- Returns true: button exists in DOM, CSS issue.
- Returns false: render bug, my edit did not land. Re-deploy or
  re-apply the edit at SessionDetail.js line 432.

---

## 4. Slider redesign + intake flow improvements (HK May 10 2026 feedback)

**Why blocked.** The FocusDistribution component shipped in
commit 339cfcac works mechanically but HK rejected the design.
Specific feedback:

- Sliders look like one more thing slapped on at the bottom.
  Should be next to the body image on top of the page, not
  below the body card.
- Percentage numbers on the right (the "20%" labels) should be
  EDITABLE. Client should be able to type a value directly on
  top of the number to override the slider position. Currently
  numbers are display-only.
- Wants the sliders visually attached to the body, like
  pointing at it. Suggestion: dotted lines from each band slider
  to the corresponding zone on the body image.
- No back button on the Preferences screen. Client cannot
  return to front-body or back-body screens to fix a tap. They
  have to start over. Bad persona UX (70-year-old will tap
  wrong zone, then quit).
- No auto-save anywhere in the intake flow. If the client
  drops off mid-form, the work is lost. Wants all selections
  persisted continuously so resuming picks up where they left.

**Realistic scope estimate.**

- Slider redesign with editable number inputs and side-by-body
  placement with dotted connector lines: 2-3 hours of focused
  design and HTML/SVG work. Mobile viewport is tight (~380px)
  so the geometry has to be exact.
- Back button on Preferences: 30 min. Add an onBack prop to
  the preferences screen, render the same back button pattern
  used on the body screens, hook to setScreen('back').
- Auto-save: this is bigger than it sounds. Touches every
  state setter in the intake flow. Two approaches:
    (a) debounced save on every state change, writing partial
        sessions row via upsert. Requires schema rework since
        client_id might not exist yet.
    (b) localStorage draft, restored on page load. Simpler,
        avoids partial DB writes. Probably the right answer.
  Estimate: 1-2 hours with approach (b), 4-6 hours with (a).

**Combined session estimate.** 4-6 hours for a focused
redesign session covering all three items.

**When to revisit.** Next focused session, after the Edit
button visibility issue (entry 3 above) is confirmed resolved.

---

## 5. Card-on-file not detected for returning clients

**Why blocked.** HK reports that after booking 5+ times with
the same name, phone, and email, the booking page still
prompts for a card every time. It should detect the existing
saved card on the clients row and skip the prompt, or show
"card already on file" with the last 4 digits.

Also reports the Client Card view in the Clients tab does not
show whether a card is on file for that client. Same root
cause likely.

**Where the bug lives.**

`src/pages/BookingPage.js` line 767 has `isRepeatClient`
detection. Line 778+ has the card-on-file capture flow.
Somewhere between detecting the returning client and rendering
the booking summary, the "skip the card-prompt if
payment_method_id exists" branch is missing or broken.

`src/components/ClientList.js` and the client detail view do
not surface payment_method_id status. Add a green chip or
similar UI that says "Card on file · ending 4242" when set,
nothing when not.

**Realistic scope estimate.**

- BookingPage card-on-file detection + skip-prompt: 1 hour
  including correct handling of expired cards and cards on a
  different processor than the therapist's current one.
- ClientList / client detail card-on-file indicator: 30 min.

**Total ~1.5 hours.** Customer-facing so high priority for
next session.

**When to revisit.** Top priority for next session, before
the slider redesign. This bug affects real customer
experience right now.

---

## 6. Optional client portal with login

**Current status (May 12 2026).** Ashley Scalzulli asked for a
client login portal (see her email of May 12 2026 for context).
Decision: build it eventually, but make it explicitly OPTIONAL and
keep "no login required" as our headline differentiator.

The "no login required" stance is now codified in:

- `src/pages/WhyBodyMap.jsx` ONLY_MBM[0] "Clients never need to log in"
- `src/pages/Home.jsx` Find & Book sub-feature listed first under
  the booking page row
- `src/data/featuresData.js` Find & Book feature 1.1b "No client
  login, ever"

So when we eventually build the portal, the framing is:
"Clients never NEED a login. If you want them to have one, here
is the option." Not "all clients must create accounts."

**Why blocked.**

1. Only one founding therapist has explicitly asked. Jiny, Terra,
   and Kathy have not. Hard to justify 10-15 hours of work for an
   N=1 request.
2. Building it changes the "no login" marketing claim if we are
   not careful. Has to be framed as opt-in feature, not default.
3. Adds password reset and account recovery support burden the
   therapist would have to handle for their clients. Most solo
   LMTs do not want this overhead.

**When to revisit.** Build this when ANY of these is true:

- Three or more founding therapists have asked for it
- A paying clinic (3+ practitioners) requires it for compliance
  or data sharing
- A specific feature (e.g., client-to-client referral tracking,
  package balance viewing on demand by clients) actually requires
  authenticated client identity to work safely

**Scope (when we build).** ~10-15 hours, multi-session:

- Supabase auth flow for clients, separate from therapists table
  (new `client_users` table linking auth.users to clients.id)
- New `/me/...` route group: dashboard, packages, gift cards,
  referrals
- Magic-link email login (no password) to keep friction low
- Therapist setting: `enable_client_portal` boolean per therapist
  row, defaults false. Therapists who never enable it: zero
  change. Therapists who enable: clients get an "Optionally
  create an account" link in confirmation emails.
- Marketing pages updated to add a small footnote on "no login
  required" copy: "If you want, an optional client portal is
  available; most therapists keep it off."

**Materials.**

- Schema: `client_users` table with columns id, auth_user_id,
  client_id, created_at, last_login_at. Foreign key to clients.id.
- Magic-link template: needs a new edge function
  `send-client-magic-link` similar to existing email senders.
- 70-year-old persona pass on UX copy before launch: avoid
  symbols, plain language, "Sign in to see your sessions" not
  "Authenticate to access your account."
- Mention in the next handover doc once we have 2+ more requests
  for this feature, to start tracking demand signal.



## 7. Twilio onboarding friction (recurring)

**Status (May 15 2026).** Candice was the second therapist this month
who needed me to walk her through Twilio signup. The MyBodyMap side
is fine (Settings 4.4 has clear instructions, Save & Connect works),
but Twilio's own onboarding has frictions we can not control from our
side:

1. **Trial mode trap.** New Twilio accounts can only send SMS to
   numbers verified inside Twilio. Therapists do not read this in
   the signup flow, then send a campaign to 80 clients, see 79
   delivery failures.
2. **10-DLC registration (US carrier requirement).** Since 2023
   carriers require A2P (application-to-person) registration for
   any SMS sender. Twilio handles this in a separate flow that
   most therapists do not find. Unregistered messages get filtered.
3. **$15 trial credit ends fast.** A handful of outreach campaigns
   plus reminders burns through in a week. Then sends silently fail.
4. **Three credentials to copy.** Account SID, Auth Token, phone
   number. The Auth Token is hidden behind a "View" click. Easy to
   paste the wrong field or fat-finger the SID.

**Why blocked.** Twilio is good-enough-for-now. The real fix is
either to:

- (a) Switch to a managed SMS layer (Telnyx, Plivo, or Twilio's
  managed A2P flow). Removes per-therapist setup entirely. Bigger
  build, ~12-15 hours, and changes our pricing model since we
  would have to bundle the SMS cost.
- (b) Add an in-app Twilio onboarding wizard that walks the
  therapist through signup with screenshots of each Twilio
  screen, plus a built-in test-send. ~3 hours. Does not solve
  trial-mode or 10-DLC but reduces the support load per therapist.

Neither is urgent at our current scale (<10 therapists using
SMS), but the issue compounds linearly with each new SMS-using
therapist.

**When to revisit.** When ANY of these is true:

- A third therapist in the same month needs Twilio handholding
- A therapist abandons MyBodyMap because SMS setup was too hard
- We add a paid tier that includes SMS as a bundled feature
- The 10-DLC enforcement tightens (carriers start blocking
  unregistered traffic more aggressively, observable by spike in
  failed deliveries from our Twilio relay edge function logs)

**Materials.** Per-therapist Twilio walkthrough script (used for
Candice on May 15 2026, reusable for the next two before we are
forced to build the wizard):

```
1. Sign up at twilio.com. Verify your real phone.
2. Pick SMS / Notify customers / With code.
3. Buy a number, local area code, ~$1.15/mo.
4. Console → Account Info: copy SID, Auth Token, number.
5. MyBodyMap Settings → How I plug in → Custom SMS sender (Twilio)
   → paste all three → Save & Connect.
6. Upgrade Twilio: add credit card, buy $20 in credit. Trial mode
   only sends to verified-in-Twilio numbers; upgraded mode sends
   to anyone.
7. Optional but recommended: register A2P 10-DLC brand and
   campaign in Twilio. Required for US carriers to deliver
   reliably. Twilio has a guided flow under Messaging → Regulatory
   Compliance.
```

**Note on tone of escalation.** If we hit 3 onboarding pings in a
single month, build (b) immediately. The cost of HK handholding
each new therapist through Twilio is higher than building the
wizard once.

---

## 8. StatusStrip Agreement tile (deferred from May 15-16 session)

**Current status (May 16 2026).** The Send-for-Signature flow shipped this session as an inline panel from the PracticeAgreement editor. Therapists can pick a client, edit a custom prepared message, generate a short URL, and have the agreement email auto-fire. Once the client signs, a new AgreementCard surfaces on the client profile (order=6) showing signer name, datetime, and the snapshot of agreed text. All complete.

**Deferred piece.** The client profile StatusStrip (the row of compact attention tiles at the top of every client profile) still uses the old `pendingIntake` logic and does not yet have a permanent Agreement tile. The plan is to replace the conditional Attention chip with a permanent Agreement tile that always shows current agreement state at a glance.

**Why blocked.** Stripe Connect debugging became urgent during the session (HK and Candice both stuck on Stripe issues). All 75 minutes of remaining attention went to Stripe. The StatusStrip work was at a clean stopping point with no half-shipped state.

**When to revisit.** Next focused session. Should take 75 minutes including verification.

**Materials.** All design decisions confirmed by HK during the session before deferral:

1. **Tile content when signed.** Two lines: "Signed [date]" on top, "by [signer name]" underneath. Uses the agreement_send_requests row's `signed_at` and `signer_name`. Forest accent color matching the rest of the agreement surface.

2. **Tile content when unsigned.** "Not on file" on top, "Tap to send" underneath in subtle italic. Amber tone to indicate action needed without alarm.

3. **Tap behavior.** When signed, tap scrolls the profile to the AgreementCard section so the therapist can see the full snapshot. When unsigned, tap opens the SendForSignaturePanel for this specific client (pre-fill the client_id) so they can send the request in one tap.

4. **Remove the pendingIntake conditional logic.** That tile was a temporary hack. Replace entirely with the Agreement tile which is always visible. If we later want an Intake-status tile, build it separately. Do not pile both into one slot.

5. **Position in the strip.** Between the existing "Last seen" tile and any other always-visible tile. Permanent slot. Never hidden.

**Files to touch.**
- `src/components/ClientProfile/StatusStrip.jsx` (remove pendingIntake, add AgreementTile)
- May need to expose `signed_at` / `signer_name` / `signed_text_snapshot` from the client row in `clients` table or via a separate fetch of the most-recent signed `agreement_send_requests` row for this client. Check what AgreementCard already does for this lookup and reuse.

**Verification after build.**
- Three test clients: (a) one with a signed agreement, (b) one with a sent-unsigned agreement, (c) one with no agreement at all.
- For (a), tile shows signer name and date; tap scrolls to AgreementCard.
- For (b) and (c), tile shows "Not on file Tap to send"; tap opens SendForSignaturePanel pre-filled.
- StatusStrip layout does not break on mobile (375px wide).
- No em dashes in any new text.

**Estimate.** 75 minutes including the verification above. HK confirmed during deferral.
