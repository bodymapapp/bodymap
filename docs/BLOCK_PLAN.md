# BLOCK_PLAN.md

Tasks that are blocked (need external setup, awaiting approval, or
scheduled for a later session), with all the materials ready to
execute when unblocked. Each block has:

- **Why blocked**
- **When to revisit**
- **Materials** (anything pre-drafted so you do not start from zero)

If a block becomes unblocked, move it into an active session and
delete the entry from here after it ships.

---

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

## 3. (placeholder for future blocked items)
