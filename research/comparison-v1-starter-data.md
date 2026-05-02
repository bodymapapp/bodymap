# Massage Software Comparison: Starter Data v1

**For:** the community-maintained Google Sheet at `/comparison`.
**Last drafted:** 2026-05-02.
**Sources cited where confident.** Cells marked `?` mean we didn't verify and need community input.

## How marks work

| Mark | Meaning |
|------|---------|
| ✓ | Included on the lowest paid tier (or free tier where applicable) |
| ✓+ | Available, but only on a higher/upper tier |
| $ | Available as a paid add-on or per-use fee |
| ✕ | Not available |
| ? | Unverified; awaiting community confirmation |

## Columns

`Feature | Category | MyBodyMap | MassageBook | Vagaro | GlossGenius | Acuity | Mindbody | Noterro | Notes`

---

## CSV (paste this into Google Sheets, row 1 is the header)

```csv
Feature,Category,MyBodyMap,MassageBook,Vagaro,GlossGenius,Acuity,Mindbody,Noterro,Notes
Online booking page,1.1 Find & Book,✓,✓,✓,✓,✓,✓,✓,Industry standard
Calendar embed for own website,1.1 Find & Book,✓,✓,✓,✓,✓,✓,✓,iframe embed widget
Auto confirmation emails,1.1 Find & Book,✓,✓,✓,✓,✓,✓,✓,Industry standard
Auto reminder emails (24h / 2h),1.1 Find & Book,✓,✓,✓,✓,✓,✓,✓,Industry standard
Auto reminder SMS,1.1 Find & Book,✓+,✓,✓,✓,$,✓,✓,Twilio in MyBodyMap; native in others. Acuity charges per SMS.
Voice / phone-call reminders,1.1 Find & Book,✕,✕,✕,✕,✕,✕,✓,Noterro standout per their docs
Buffer time between sessions,1.1 Find & Book,✓,✓,✓,✓,✓,✓,✓,Industry standard
Time off / vacation block,1.1 Find & Book,✓,✓,✓,✓,✓,✓,✓,Industry standard
Booking approval workflow (manual approve/decline),1.1 Find & Book,✓,?,✓,?,?,✓,?,Asked-for by Leela
Multi-staff scheduling,1.1 Find & Book,✕,✓,✓,✓,✓,✓,✓,Solo focus for MyBodyMap
Public marketplace for client discovery,1.1 Find & Book,✕,✓,✓,✕,✕,✓,✕,MB and Vagaro have search directories
Native iOS / Android app for therapist,1.1 Find & Book,PWA,✓,✓,✓,✕,✓,✓,MyBodyMap is PWA only; install to home screen
Native iOS / Android app for clients,1.1 Find & Book,PWA,✓,✓,✕,✕,✓,✓,Noterro offers branded client app
Recurring appointments (auto-book series),1.1 Find & Book,✕,✓,✓,?,✓,✓,✓,Noterro highlights this
Custom intake form fields,2.1 Know Your Client,✓,✓,✓,✓,✓,✓,✓,Industry standard
Visual body map intake (front & back),2.1 Know Your Client,✓,✕,✕,✕,✕,✕,✕,MyBodyMap differentiator
Pressure preference selection,2.1 Know Your Client,✓,?,?,?,?,?,?,Part of body map intake
Medical history / pregnancy / meds,2.1 Know Your Client,✓ planned,✓,✓,✓,✓,✓,✓,Queued feature 2.6 in MyBodyMap
Red-flag surfacing (allergies / contraindications),2.1 Know Your Client,✓ planned,?,?,?,?,?,✓,Noterro intake-form smart tags
Photo storage / clinical photos,2.1 Know Your Client,✕ deferred,?,?,?,?,?,?,Pending HIPAA infrastructure decision
Smart pre-fill on return visits,2.1 Know Your Client,✓ planned,?,?,?,?,?,?,Queued feature 2.6
Client tags / segments,2.1 Know Your Client,✓,✓,✓,✓,✓,✓,✓,Industry standard
Custom fields,2.1 Know Your Client,✕,✓,✓,?,✓,✓,✓,Therapist-defined data fields on client record
Import from CSV (Vagaro / MB / Square),2.1 Know Your Client,✓,?,✓,?,✓,✓,?,MyBodyMap has dedicated importers
Pattern intelligence (heatmap of recurring areas),3.1 Client Intelligence,✓,✕,✕,✕,✕,✕,✕,MyBodyMap moat. Longitudinal body-map analysis
AI pre-session brief,3.1 Client Intelligence,✓,✕,✕,✕,✕,✕,✕,MyBodyMap exclusive
AI chat / Q&A across client list,3.1 Client Intelligence,✓,✕,✕,✕,✕,✕,✕,MyBodyMap exclusive
Lapsed-client identification,3.1 Client Intelligence,✓,✓,✓,✓,?,✓,✓,Threshold-based across all
Daily Pulse digest email,3.1 Client Intelligence,✓,✕,✕,✕,✕,✕,✕,MyBodyMap exclusive 6pm summary
Voice-to-text SOAP scribe,3.1 Client Intelligence,✕,✕,✕,✕,✕,✕,✓,Noterro Scribe is their wow feature
SOAP notes,4.1 Day-of-Session,✓,✓,$,✕,✕,✓,✓,GlossGenius has notes but not formal SOAP. Vagaro charges add-on.
Customizable note templates,4.1 Day-of-Session,✓,✓,?,✕,✕,✓,✓,Industry depth varies
Predictive charting / smart phrases,4.1 Day-of-Session,✕,?,?,✕,✕,?,✓,Noterro standout
Add-ons applied at booking time,4.1 Day-of-Session,✓,?,✓,✓,✕,✓,✓,Hot stones / aromatherapy etc.
Per-recipient personalized campaign emails,5.1 Relationships,✓,✕,✕,✓,✕,✓,?,MassageBook support confirmed they don't (Regina FB thread May 1 2026). MyBodyMap differentiator vs MB.
Per-recipient personalized campaign SMS,5.1 Relationships,✓ pending Twilio,✓,✓,✓,✕,✓,✓,All but Acuity
AI campaign starter (8 templates),5.1 Relationships,✓,✕,✕,✕,✕,✕,✕,MyBodyMap exclusive
Drip / welcome sequences,5.1 Relationships,✓,✓,✓,✓,$,✓,✓,Industry standard
Lapsed-client outreach campaigns,5.1 Relationships,✓,✓,✓,✓,?,✓,?,Industry standard
Birthday / anniversary auto-touches,5.1 Relationships,✕ planned,✓,✓,✓,?,✓,?,Queued feature
Send history / audit log,5.1 Relationships,✓,✓,✓,✓,?,✓,?,Industry standard
Unsubscribe handling (CAN-SPAM compliant),5.1 Relationships,✓,✓,✓,✓,✓,✓,✓,Industry standard
Stripe billing integration,6.1 Money & Protection,✓,✕,✕,✕,$,✕,$,GlossGenius / MB / Mindbody use proprietary processors
Square integration,6.1 Money & Protection,✓,✕,✕,✕,✓,✕,✓ mobile only,Noterro = Square only on mobile per their docs
Cash / external payment recording,6.1 Money & Protection,✓,✓,✓,✓,✓,✓,✓,Industry standard
Deposits / pre-booking authorization,6.1 Money & Protection,✓,✓,✓,✓,✓,✓,✓,Industry standard
Gift cards,6.1 Money & Protection,✓,✓,✓,✓,$,✓,?,GlossGenius branded gift cards strong
Memberships (recurring monthly),6.1 Money & Protection,✓,✓,✓,✓,✕,✓,✓,Industry standard
Packages (multi-session bundles),6.1 Money & Protection,✓,✓,✓,✓,✕,✓,✓,Industry standard
Insurance billing (CMS-1500 / TELUS),6.1 Money & Protection,✕,✕,✕,✕,✕,✕,✓,Noterro big differentiator. Clinical-first.
Inventory / retail tracking,6.1 Money & Protection,✕,✕,✓,✕,✕,✓,✕,Vagaro and Mindbody have retail
Waiver / e-signature,6.1 Money & Protection,✕ planned,✓,✓,✓,$,✓,✓,Queued in MyBodyMap (feature 2.3 + 6.3)
Tax reports / 1099 reports,6.1 Money & Protection,?,✓,✓,✓,✕,✓,✓,Need verification on MyBodyMap
HIPAA-compliant tier (BAA available),6.1 Money & Protection,✕,✕ small print,$,✕,$,✓,✓,Noterro and Mindbody are clinically positioned
PWA (install to home screen),7.1 On Your Phone,✓,✕,✕,✕,✕,✕,✕,MyBodyMap exclusive among solo-LMT tools
Push notifications (web push),7.1 On Your Phone,✓,?,?,?,?,?,?,Likely available via native apps for others
QR codes for intake / booking,7.1 On Your Phone,✓,?,?,?,?,?,?,MyBodyMap auto-generates
Offline mode,7.1 On Your Phone,✕,✕,✕,✕,✕,✕,✕,No tool we know of
Free tier (forever, real features),Pricing,✓ Bronze,✕,✕,✕,7-day trial,✕,14-day trial,MyBodyMap differentiator
Lowest paid tier price,Pricing,$9 Silver,$45,$25,$48,$20,$129,$20,Per month USD as of May 2026
Per-staff pricing model,Pricing,solo-only,per location,per staff,per staff,per user,per location,per practitioner,Different scaling models
```

---

## Honest gaps (we recommend leading with these in the page intro)

These are features competitors offer that **MyBodyMap does not yet have**. Showing them up front is the credibility move.

1. **Insurance billing (CMS-1500 / TELUS eClaims).** Noterro is far ahead. We don't have this and won't soon. Clinical / medical massage therapists need it.
2. **Public marketplace for client discovery.** MassageBook, Vagaro, Mindbody all have search directories that bring new clients. We rely on therapists' existing client lists + manual marketing.
3. **Multi-staff / employee scheduling.** Vagaro, MassageBook, GlossGenius, Mindbody all support clinics and teams. We're solo-only by design.
4. **Native iOS / Android apps** (for therapist or clients). We're PWA-only. Noterro has branded client apps. Vagaro and Mindbody have full mobile apps.
5. **Inventory / retail product tracking.** Vagaro and Mindbody handle product sales (retail oils, lotions). We don't.
6. **Voice-to-SOAP transcription.** Noterro Scribe is genuinely impressive. We don't have it.
7. **Recurring appointments (auto-book a series).** Most have it. We don't.

## Honest wins (the second framing)

These are the seven features **only MyBodyMap has** in this comparison:

1. Visual body map intake (front + back, tap-to-select zones, pressure)
2. Pattern intelligence (longitudinal heatmap of recurring complaint areas across sessions)
3. AI pre-session brief
4. AI chat over your client list
5. Daily Practice Pulse digest at 6pm
6. AI campaign starter (8 one-tap drafts)
7. Per-recipient personalized campaign emails on a free tier (MassageBook only does this on automated emails, not campaigns — Regina confirmed via support 2026-05-01)

---

## Step-by-step Google Sheet setup

Once HK is ready to publish:

1. Open Google Sheets. Create a new sheet titled "Massage Software Comparison — Community Maintained."
2. Paste the CSV block above starting at A1. Sheets auto-splits commas into columns.
3. Highlight row 1, set bold + freeze (View → Freeze → 1 row).
4. Highlight column "MyBodyMap" (column C). Format → Conditional formatting: light sage green background `#E8F0EA` so our column is visually anchored without screaming.
5. Highlight columns D-I. Set width to ~100px each so checkmarks are tight.
6. Add a "Last verified" column at column K with the current date for each row.
7. Footer disclaimer rows (rows 70+):
   - Row 70: `Last verified: <date>`
   - Row 71: `Maintained by MyBodyMap and the LMT community. Suggest edits via the Suggesting mode in your Google account.`
   - Row 72: `Data based on publicly available pricing and feature pages, support tickets, and community contributions. Verify directly with each provider before making decisions.`
8. File → Share → General access → "Anyone with the link" → Viewer. Add "Allow editors and commenters to share" = OFF.
9. To enable Suggest mode: in the share dialog, change Viewer to "Commenter." This lets anyone leave comments. For inline edit suggestions, the user opens File → "Suggesting" mode in their own copy. Note: Google's true "suggest mode" is editor-level. Practical compromise: Commenter access + a separate Google Form for structured suggestions.
10. File → Publish to web → Embed → choose "Entire Document." Copy the iframe URL.
11. Send the iframe URL to Claude. We'll set the constant in `src/pages/Comparison.jsx` and remove the placeholder.

## Recommended cadence

- Weekly review of suggestions (HK or delegated). Accept / reject. Update "Last verified" column on accepted rows.
- Quarterly major refresh — re-verify pricing, send a "what's changed" email to the founding therapists list, post the changelog publicly.
