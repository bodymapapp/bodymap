# Client email copy spec (MyBodyMap)

HK May 29 2026. This is the source of truth for client-facing notification email content.
Each touchpoint has a copy goal (the feeling the email should leave the client with) and a
canonical content shape (the structured information the client needs to receive).

Therapist-facing emails are handled separately (notify-booking-event, etc).

The retention rationale for each touchpoint is documented in chat 16 (BodyMap Chat 16,
notification audit). Per-touchpoint retention impact:
- C7 therapist cancel: warm apology recovers ~70% (vs ~60% silent loss)
- C9 polite no-show: polite request rebooks ~51% (vs ~8% silent)
- C11 lapse nudge: targeted nudge recovers ~18% (vs ~3% no nudge)

## Universal shape for every client email

Every client-facing email follows this 6-section frame so the client always knows:
1. **Who** : therapist name and business
2. **What happened or is happening** : event title in plain language
3. **When** : full date/time, including the old time on reschedule/cancel
4. **What service** : the session type (Swedish 60min, etc), not just "session"
5. **What changed** : the delta (cancelled, moved, charged, refunded)
6. **What next** : single clear CTA (book again, view receipt, fill intake, contact therapist)

Tone: warm, professional, never templated-feeling. The client should feel a person wrote this,
not a system. Avoid "Dear Customer" patterns. Use the therapist's first name where natural.

## Per-touchpoint copy goals

### C1. Booking confirmed (first-time client)
- Trigger: new booking, client_count = 1
- Subject: `Your session with {therapist} is confirmed`
- Tone: welcoming, set expectation for the intake
- Body:
  - Quick "looking forward to meeting you" line
  - Session details box: service, when, where (location address if available)
  - "Before we meet" callout: link to fill intake (90 sec, helps them prepare)
  - Cancellation policy summary if therapist has one
  - Sign-off as therapist first name
- CTA: Fill intake

### C2. Booking confirmed (returning client)
- Trigger: new booking, client_count > 1
- Subject: `See you {day} at {time}, {first_name}`
- Tone: familiar, brief
- Body:
  - Acknowledgment: "Looking forward to seeing you again"
  - Session details box
  - "Anything changed since last time?" link (intake update flow)
- CTA: Update intake if anything has changed

### C3. Intake reminder (48h+ before session, intake not filled)
- Trigger: cron, fires 48h before bookings without an intake row
- Subject: `Quick favor before {day}'s session, {first_name}`
- Tone: soft, low-friction
- Body:
  - "Filling your intake takes 90 seconds and helps me prepare the perfect session"
  - Session details box
  - One sentence on what the intake covers (pressure, focus areas, anything off)
- CTA: Fill intake now

### C4. Pre-session reminder (48h before)
- Trigger: cron, fires 48h before session
- Subject: `Your session with {therapist} is on {day}`
- Tone: helpful, no pressure
- Body:
  - "Just a heads-up that your session is coming up"
  - Session details box (full)
  - If intake not filled: gentle line + link
  - Cancellation policy reminder (one line, links to full policy)
- CTA: View / update booking

### C5. Same-day reminder (2h before)
- SMS-first touchpoint, very short
- Body: `Hi {first_name}, see you at {time} for your {service} with {therapist}.`

### C6. Post-session warmth (24h after completed)
- Trigger: cron, 24h after session marked complete
- Subject: `Great session yesterday, {first_name}`
- Tone: warm, restorative, NOT salesy
- Body:
  - "Hope you're feeling great"
  - If therapist left a public message: rendered as a quoted note
  - If SOAP has a summary: short summary section
  - Self-care callout: hydration, rest, gentle stretching
  - Booking link for next session
  - "Your preferences are saved" line so they know returning is easy
- CTA: Book your next session

### C7. Cancellation by therapist
- Trigger: therapist cancels a booking
- Subject: `{therapist} had to cancel {day}'s session`
- Tone: apologetic, personal, NOT corporate
- Body:
  - Open with the apology in the therapist's voice
  - "I had to cancel your {service} that was on {day} at {time}"
  - If reason was provided: render as a quoted block (italic)
  - Reassurance line: "I'd love to find another time that works for you"
  - One-click rebook link
  - Sign-off as therapist first name
- CTA: Find another time
- NO fee row (this is therapist-initiated)

### C8. Client cancellation within policy (free)
- Trigger: client cancels outside fee window
- Subject: `Your cancellation is confirmed`
- Tone: matter-of-fact, no judgment
- Body:
  - "We've cancelled your {service} on {day} at {time}"
  - "No fee charged" line
  - "Whenever you're ready" rebook link
- CTA: Book another time

### C9. Client late-cancel (fee charged)
- Trigger: client cancels inside fee window, fee was charged
- Subject: `Your cancellation and fee receipt`
- Tone: transparent, NOT punishing
- Body:
  - "We've cancelled your {service} on {day} at {time}"
  - Fee summary: $X charged per the cancellation policy (link to policy)
  - The policy text rendered inline (not just a link)
  - "If you have any questions, please reach out to {therapist}"
- CTA: Reply to email or contact therapist

### C10. Reschedule confirmation
- Trigger: booking rescheduled (therapist or client)
- Subject: `Your session has been moved to {new_day} at {new_time}`
- Tone: helpful, calm
- Body:
  - "Your {service} with {therapist} is now on {new_day} at {new_time}"
  - "Previously: {old_day} at {old_time}" (small, secondary line)
  - If reason was provided: quoted block
  - Add-to-calendar link (.ics attachment ideally)
  - "See you then"
- CTA: Add to calendar / view booking

### C11. No-show, no fee
- Trigger: therapist marks no-show, skip fee
- Subject: `We missed you {day}`
- Tone: warm, NOT punishing
- Body:
  - "I had your {service} reserved for {day} at {time} but didn't see you come in"
  - "No fee this time"
  - "If everything is OK, please reach out : I'd love to reschedule"
  - Booking link
- CTA: Pick a new time
- Retention rationale per chat 16: polite no-show notifications rebook 51% vs 8% silent

### C12. No-show, fee charged (card on file)
- Trigger: therapist marks no-show, fee charged via stored card
- Subject: `About your missed session on {day}`
- Tone: professional, transparent
- Body:
  - "Your {service} was scheduled for {day} at {time}. Since you didn't make it, per the cancellation policy a fee of ${X} has been charged to your card on file (ending {last4})"
  - Policy text rendered inline
  - "If this was a misunderstanding, please reach out to {therapist}"
- CTA: Reply / contact therapist

### C12-link. No-show, payment link (no card on file)
- Trigger: therapist marks no-show, no card to charge, payment link generated
- Subject: `About your missed session on {day}`
- Tone: polite payment request, never punishing
- Body:
  - "Your {service} was scheduled for {day} at {time}. The no-show fee per {therapist}'s policy is ${X}."
  - One-click payment link button
  - Policy text rendered inline
  - "Whenever you're ready, you can also rebook"
- CTAs: Pay now / Book another session

### C13. Payment receipt
- Trigger: any successful payment from client
- Subject: `Receipt: ${amount} payment to {therapist}`
- Tone: clean receipt, NOT marketing
- Body:
  - Receipt table: therapist, service (or membership/package name), session date, amount, payment method (last4 if card)
  - If applies to a specific session: link to session details
  - "Questions? Reply to this email"
- CTA: View session / contact therapist

### C14. Lapse nudge (45-day)
- Trigger: regular client (4+ sessions) no booking in their usual interval + 21 days
- Subject: `Saving a spot for you this week, {first_name}`
- Tone: soft, never salesy
- Body:
  - "It's been a few weeks. I kept your usual {weekday-evening} slot open this week in case you want it"
  - One-click rebook
  - Therapist toggle exists per chat 16: practitioners with philosophical objections can disable
- CTA: Take the slot

### C15. Lapse final goodbye (90-day)
- Trigger: 90+ days since last session, no response to C14
- Subject: `Thinking of you, {first_name}`
- Tone: warm, gentle goodbye, NOT guilt-trip
- Body:
  - "If life has taken you in a different direction, no hard feelings"
  - "If you ever want to come back, here's the link"
- CTA: Book if you want (very low-pressure)

### C16. Refund issued
- Trigger: refund processed
- Subject: `Refund issued: ${amount}`
- Tone: clean confirmation
- Body:
  - "We've refunded ${amount} to your card ending {last4}"
  - "Expect to see this on your statement within 5-10 business days"
  - If a reason was recorded: quoted block
  - "Questions? Reply to this email"
- CTA: Contact therapist if questions
