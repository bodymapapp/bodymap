# Noterro Competitive Analysis (April 2026)

Sourced from: noterro.com, capterra.com, getapp.com, hellonote.com, sprypt.com, mblexguide.com, software advice. The therapist who recommended Noterro highlighted: clinical depth, free client app, voice scribe.

## Quick verdict
Noterro is positioned as **clinical-first** (formerly SOAP Vault), strongest for therapists who care about documentation depth, insurance billing, and HIPAA. Pricing $20-$33/mo solo. 14-day trial then paid. Praised for SOAP notes + responsive support. Criticized for clunky payments, paywalled waitlist, and Square-on-mobile-only integration.

MyBodyMap and Noterro overlap on SOAP notes + scheduling + reminders, but differentiate on opposite ends:
- **Noterro = clinical compliance.** SOAP-first, voice scribe, insurance forms (CMS-1500 US, TELUS Canada), branded client app.
- **MyBodyMap = visual-first + AI co-pilot.** Body map intake, AI pre-session brief, longitudinal pattern intelligence, free Bronze tier.

Both can coexist, but if a clinically-oriented LMT compares them feature-for-feature today, Noterro wins on documentation depth and Noterro Scribe is genuinely impressive.

## Noterro standout features (verified)

### 1. Noterro Scribe (voice-to-SOAP)
**This is their wow feature.** Therapist records audio after the session. Scribe processes it into structured SOAP fields, filtering out small talk. "Capture conversations with clients. Scribe can organize the recording, filter out small talk, and document a preliminary clinical note."
Available: throughout the platform, scribes can be made without disrupting flow. Scribes process quickly.

### 2. Custom-branded client app
Clients install Noterro's client app. They use it to learn about services, check availability, schedule appointments, make payments, review forms and documentation. Therapist can custom-brand it (logo, colors). Real apps in App Store / Play Store, not just a PWA.

### 3. Predictive charting + smart phrases
Reduces repetitive typing. Common SOAP phrases as toggleable shortcuts. "Smart tags and customizable intake forms help practitioners document their sessions quickly."

### 4. Customizable intake forms with smart tags
Intake forms adapt based on service booked. Smart tags pull data into SOAP charting automatically.

### 5. Insurance billing
TELUS eClaims for Canadian users. CMS-1500 forms for US practitioners. Cited as "most comprehensive insurance claim management at an accessible price point."

### 6. Recurring appointments
"Book clients in for multiple visits so scheduling isn't done last minute." Big retention feature.

### 7. Customizable confirmations and reminders
Email, text, AND phone calls. All automated and customizable per service.

### 8. Noterro GO (Plus/Max plans)
Mobile massage practice extension. Streamlined scheduling/documentation/payment for therapists who travel to clients.

### 9. Brand colors for online portal
Therapist can customize the booking page colors to match their brand.

### 10. Form/agreement customization
Custom intake, waiver, and treatment agreement forms.

## Common Noterro complaints

- **Square integration is broken on desktop.** Only works in their mobile app. Hard to integrate Square device on desktop.
- **Insurance billing is confusing for some users**, especially direct billing and tracking payments.
- **Waitlist is paywalled.** Sole practitioners say this should be base-tier.
- **New pricing model is "not sole-practitioner friendly"** per multiple recent reviews.
- **Cluster booking has loopholes.** Clients can book multiple appointments and cancel to game scheduling.
- **No advanced marketing tools** or extensive third-party integrations. Focused on clinical, not growth.

## Pricing structure (April 2026)
- Solo Basic: $20/month (essential scheduling, billing, documentation)
- Plus: $33/month (adds waitlists, client reminders, basic insurance, GO)
- Max: higher tier (full insurance, multi-practitioner)
- Add-on: $12/month for Packages and Memberships (sole-practitioner friendly complaints stem from this)
- 14-day free trial
- ABMP members get a discount

## What MyBodyMap should learn / steal

### Tier A: high-impact, ship within 2-4 weeks

**A1. Voice-to-SOAP scribe (Claude API)**
This is the feature LMTs envy. With Anthropic API already integrated for our pre/post session briefs, adding voice scribe is straightforward:
- Browser-recorded audio (WebRTC) -> upload to Anthropic API
- Prompt: "Generate SOAP note from this massage session recording. Filter out small talk. Use the patient's history: [pulled from clients table + last 3 sessions]. Output strictly in SOAP format with Subjective/Objective/Assessment/Plan keys."
- Pre-fill SOAP fields, therapist edits before saving.
- Offer post-session button: "Record session note (45 sec)" right next to "Pre-session brief"
- Estimate: 6-8 hr build, $0.01-0.05 per scribe with Claude Haiku.

**A2. Smart phrase library in SOAP notes**
Common templates as one-tap chips. Therapist can save custom phrases per body region or condition.
- Pre-seed catalog: "Trigger point released," "Hypertonic in upper traps," "Range of motion improved 15%," etc.
- Therapist creates their own phrases with a + button.
- Estimate: 3 hr build.

**A3. Recurring appointment booking**
Client books "every 2 weeks for 6 sessions" in one flow during initial booking.
- Bookings table already has the schema; needs a recurrence_rule column or a parent_booking_id linkage.
- UI: after picking first slot, "Book this same time every [1/2/4 weeks] for [N] sessions" with auto-conflict-skip on holidays.
- Estimate: 4-5 hr build. Massive retention lever -- the kind of feature that sticks clients to the practice.

### Tier B: medium-impact, ship within 4-8 weeks

**B1. PWA / "Add to Home Screen" with branded icon**
MyBodyMap is web-only. Adding manifest.json + service worker turns the booking page into an installable app on the client's phone with the LMT's logo as the icon. Less effort than building native apps, gets us 80% of Noterro's "branded client app" claim.
- Estimate: 3-4 hr.

**B2. Branded client emails**
Therapist's logo + brand color in confirmation emails, reminders. We send via Resend; the templates are static. Add per-therapist customization.
- Estimate: 3 hr.

**B3. Branded booking page colors**
Therapist picks 1-2 brand colors in Settings; booking page uses them. Good for solo practitioners building personal brand.
- Estimate: 2 hr.

**B4. Customizable intake form fields**
Beyond the body map, let therapist add custom questions (e.g. for prenatal, sports, geriatric massage).
- Estimate: 4-6 hr (form builder is non-trivial).

### Tier C: longer-term

**C1. Insurance billing (CMS-1500)**
Only matters if MyBodyMap targets clinical/medical massage. Most solo cash-based LMTs don't bill insurance. Skip unless we see demand.

**C2. Waitlist with auto-fill**
Client adds themselves to a waitlist for a service. When a slot opens (cancellation), the system auto-texts the next person. Strong retention feature; matches Noterro's paywalled offering. Don't paywall ours.
- Estimate: 5-6 hr.

**C3. Phone call reminders**
Automated phone reminders (text-to-speech via Twilio) for clients who don't read texts. Niche but valued by older clientele. Most LMTs don't need it.

## What MyBodyMap already does that Noterro DOESN'T

These are our existing differentiators -- protect and amplify them:

1. **Visual body map intake.** None of Noterro/Vagaro/MassageBook/Jane have this. Clients tap on body parts that hurt; therapist gets a visual heatmap before the session.
2. **AI pre-session brief.** Synthesizes client history, last 3 sessions, current intake into a 30-second readable summary.
3. **AI chat with full client history.** "What did Sarah say about her neck last visit?" -> instant answer.
4. **Longitudinal pattern intelligence.** "This client's lower back tension peaks every 3 months -- correlates with quarterly work cycles."
5. **Free Bronze tier.** Noterro has a 14-day trial then paid; we keep solo practitioners free for their first 5 sessions/client. Real moat for cash-strapped new LMTs.

## Pricing positioning recommendation

After this research:
- Bronze (free): keep -- it's our acquisition wedge.
- Silver ($19/mo): add Voice Scribe, smart phrases, recurring bookings, branded emails. Positions us as "Noterro Plus features at $19" vs their $33.
- Gold ($49/mo): add advanced AI usage tier, custom intake form builder, white-label colors, waitlist with auto-fill.

## Strategic takeaway

Noterro is going after the **clinical/insurance** segment. Vagaro is going after the **spa/multi-service** segment. MyBodyMap can own the **AI-augmented solo wellness practitioner** segment. The voice scribe + visual body map + AI pattern intelligence combination is a genuinely defensible position no current competitor occupies.

Build voice scribe FIRST. It directly addresses the feature LMTs are explicitly envying right now (per the message HK shared). Recurring bookings and smart phrases are the next two leverage features.
