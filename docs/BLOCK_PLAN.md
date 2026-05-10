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

### Materials: Justification paragraph

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

## 2. (placeholder for future blocked items)
