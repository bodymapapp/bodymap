// src/data/comparisonData.js
//
// VERIFIED comparison data — May 2 2026 audit pass.
// Every cell either has a confirmed source or is marked "tbc"
// (awaiting community verification). No more lazy yes/no marks.
//
// Marks:
//   "yes"      — confirmed available on lowest paid tier
//   "yes+"     — confirmed available only on a higher tier
//   "addon"    — confirmed paid add-on or per-use fee
//   "no"       — confirmed not available on the platform
//   "planned"  — on MyBodyMap roadmap; not yet shipped
//   "tbc"      — unverified; awaiting community confirmation
//   "trial"    — only available during free trial (used for "Free tier?")
//
// SOURCES (audit pass May 2 2026):
//   - MassageBook: pro.massagebook.com/pricing + features pages
//   - Vagaro: vagaro.com/pro pages
//   - GlossGenius: glossgenius.com/pricing + customers/massage pages
//   - Acuity: acuityscheduling.com pricing + help.acuityscheduling.com
//   - Mindbody: mindbodyonline.com/business/pricing
//   - Noterro: noterro.com/pricing + noterro.com/help-articles
//   - MyBodyMap: live product

export const PLATFORMS = [
  { id: "bm",  name: "MyBodyMap",   tagline: "Massage therapists, retention-first",  priceFrom: 0,   highlight: true },
  { id: "mb",  name: "MassageBook", tagline: "Massage-specific, broad",            priceFrom: 20 },
  { id: "vg",  name: "Vagaro",      tagline: "Spa & beauty, multi-staff",          priceFrom: 25 },
  { id: "gg",  name: "GlossGenius", tagline: "Beauty-first, design-led",           priceFrom: 24 },
  { id: "ac",  name: "Acuity",      tagline: "Generic scheduling",                 priceFrom: 20 },
  { id: "mi",  name: "Mindbody",    tagline: "Studios & enterprise",               priceFrom: 99 },
  { id: "no",  name: "Noterro",     tagline: "Clinical / SOAP-first",              priceFrom: 30 },
];

// Top-of-page summary: 5 questions therapists ask first.
export const QUICK_ANSWERS = [
  { q: "Free tier?",                                    bm:"yes",  mb:"trial", vg:"trial", gg:"trial", ac:"trial", mi:"no",   no:"trial" },
  { q: "Online booking + reminders?",                   bm:"yes",  mb:"yes",   vg:"yes",   gg:"yes",   ac:"yes",   mi:"yes",  no:"yes" },
  { q: "Take payments (Stripe / Square / cash)?",       bm:"yes",  mb:"yes",   vg:"yes",   gg:"yes",   ac:"yes",   mi:"yes",  no:"yes" },
  { q: "Memberships + packages?",                       bm:"yes",  mb:"yes",   vg:"yes",   gg:"yes",   ac:"yes+",  mi:"yes",  no:"yes" },
  { q: "Mobile app for therapist?",                     bm:"yes",  mb:"yes",   vg:"yes",   gg:"yes",   ac:"yes",   mi:"yes",  no:"yes" },
];

export const CATEGORIES = [
  {
    id: "1.1",
    name: "Find & Book",
    sub: "How clients reach you",
    rows: [
      { f: "Online booking page",                                                            bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
      { f: "Auto reminder emails (24h / 2h)",                                                bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
      { f: "Auto reminder SMS",                                                              bm:"yes",     mb:"yes",  vg:"addon",   gg:"yes",  ac:"yes+", mi:"yes",  no:"yes" },
      { f: "Buffer time between sessions (therapist toggle)",                                bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
      { f: "Set any single day differently (date-specific hours)",                          bm:"yes",     mb:"tbc",  vg:"yes",     gg:"tbc",  ac:"yes",  mi:"yes",  no:"tbc",  note:"MyBodyMap: per-date availability overrides shipped June 2026. Open late one Thursday, closed a Friday, without touching your weekly hours." },
      { f: "Time off / vacation block",                                                      bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
      { f: "Approve / decline bookings (therapist toggle)",                                  bm:"yes",     mb:"tbc",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"tbc",  note:"MyBodyMap: shipped April 30, single-toggle in Settings, default OFF." },
      { f: "Public marketplace for client discovery",                                        bm:"no",      mb:"yes",  vg:"yes",     gg:"no",   ac:"no",   mi:"yes",  no:"no" },
      { f: "Recurring appointments (auto-book series)",                                      bm:"planned", mb:"yes",  vg:"yes",     gg:"tbc",  ac:"yes+", mi:"yes",  no:"yes" },
      { f: "Voice phone-call reminders",                                                     bm:"no",      mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"yes" },
    ],
  },
  {
    id: "2.1",
    name: "Know Your Client",
    sub: "Intake and client records",
    rows: [
      { f: "Visual body map intake (front & back, tap-to-mark)",                             bm:"yes",     mb:"yes",  vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"yes",  note:"MyBodyMap and MassageBook both offer anatomical body image intake. Noterro has body diagrams in SOAP notes." },
      { f: "Editable health & safety fields (allergies, meds, conditions, areas to avoid)",   bm:"yes",     mb:"yes",  vg:"tbc",     gg:"tbc",  ac:"no",   mi:"tbc",  no:"yes",  note:"MyBodyMap: structured health and safety fields on every client, editable in one tap, surfaced before the session. Noterro and MassageBook keep similar clinical fields." },
      { f: "Massage-specific intake template (out of the box)",                              bm:"yes",     mb:"yes",  vg:"addon",   gg:"yes",  ac:"no",   mi:"tbc",  no:"yes",  note:"Acuity has DIY form builder but no massage template. Vagaro forms = $10/mo add-on." },
      { f: "Require intake before booking (therapist toggle)",                               bm:"yes",     mb:"tbc",  vg:"tbc",     gg:"tbc",  ac:"tbc",  mi:"tbc",  no:"tbc",  note:"MyBodyMap: shipped April 30, single-toggle in Settings, default OFF." },
      { f: "Medication / contraindication alerts on schedule",                               bm:"planned", mb:"yes",  vg:"tbc",     gg:"tbc",  ac:"no",   mi:"tbc",  no:"yes",  note:"MassageBook: built-in. Noterro: included in clinical chart." },
      { f: "Document & photo storage on client record (upload or camera)",                    bm:"yes",     mb:"tbc",  vg:"yes",     gg:"tbc",  ac:"no",   mi:"tbc",  no:"yes",  note:"MyBodyMap: Client Documents shipped June 2026. Upload or photograph consent, intake, and other forms with an in-app viewer. Vagaro and Noterro also store photos." },
      { f: "Smart pre-fill on return visits",                                                bm:"yes",     mb:"tbc",  vg:"tbc",     gg:"tbc",  ac:"tbc",  mi:"tbc",  no:"yes",  note:"MyBodyMap recognizes a returning client and pre-fills their details at booking." },
      { f: "Client tags / segments",                                                         bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
      { f: "Import from CSV (Vagaro / MB / Square)",                                         bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
    ],
  },
  {
    id: "3.1",
    name: "Client Intelligence",
    sub: "Pattern detection & smart drafts",
    rows: [
      { f: "Reads your paper intake forms (AI fills the client's fields)",                    bm:"yes",     mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"no",   note:"MyBodyMap exclusive in this set: upload or photograph an existing paper intake and the fields fill themselves. Noterro Scribe dictates new notes but does not read your existing paper forms." },
      { f: "Remembers the whole client (auto-built history across every session)",            bm:"yes",     mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"yes",  no:"yes",  note:"MyBodyMap builds a dated memory of each client and surfaces it in the brief. Noterro and Mindbody keep clinical chart history. The booking-first tools keep only basic notes." },
      { f: "Pattern intelligence (heatmap of recurring complaint areas)",                    bm:"yes",     mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"no",   note:"MyBodyMap exclusive. Last 5 sessions free; full history on Silver." },
      { f: "pre-session brief",                                                           bm:"yes",     mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"no",   note:"MyBodyMap exclusive in this comparison set." },
      { f: "Platform chat over your client list",                                                  bm:"yes",     mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"no",   note:"MyBodyMap exclusive in this comparison set." },
      { f: "Voice-to-text SOAP scribe",                                                      bm:"no",      mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"yes",  note:"Noterro Scribe: dictate notes; AI structures into SOAP fields." },
      { f: "Lapsed-client identification",                                                   bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"tbc",  mi:"yes",  no:"yes" },
      { f: "Daily pulse / digest email to therapist",                                        bm:"yes",     mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"no",   note:"MyBodyMap exclusive: 6pm summary." },
    ],
  },
  {
    id: "4.1",
    name: "Day of Session",
    sub: "Notes and in-room",
    rows: [
      { f: "SOAP notes (structured)",                                                        bm:"yes",     mb:"yes",  vg:"addon",   gg:"yes",  ac:"yes",  mi:"yes",  no:"yes",  note:"GlossGenius added SOAP notes; was previously general client notes only. Vagaro = forms add-on." },
      { f: "Customizable note templates",                                                    bm:"yes",     mb:"yes",  vg:"addon",   gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
      { f: "Predictive charting / smart phrases",                                            bm:"no",      mb:"tbc",  vg:"no",      gg:"no",   ac:"no",   mi:"tbc",  no:"yes",  note:"Noterro standout: smart-tag and snippet system." },
      { f: "Add-ons applied at booking",                                                     bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes+", mi:"yes",  no:"yes" },
    ],
  },
  {
    id: "5.1",
    name: "Relationships",
    sub: "Campaigns & retention",
    rows: [
      { f: "Per-recipient personalized campaign emails",                                     bm:"yes",     mb:"no",   vg:"yes",     gg:"yes",  ac:"no",   mi:"yes",  no:"yes",  note:"MassageBook support confirmed they don't, May 1 2026 (Regina FB thread)." },
      { f: "Per-recipient personalized campaign SMS",                                        bm:"planned", mb:"yes",  vg:"addon",   gg:"yes",  ac:"no",   mi:"yes",  no:"yes",  note:"Vagaro: text marketing $20/mo add-on." },
      { f: "Campaign starter (one-tap drafts)",                                           bm:"yes",     mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"no",   note:"MyBodyMap exclusive: 8 categories." },
      { f: "Drip / welcome sequences",                                                       bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"addon", mi:"yes",  no:"yes" },
      { f: "Lapsed-client outreach",                                                         bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"tbc",  mi:"yes",  no:"yes" },
      { f: "Birthday / anniversary auto-touches",                                            bm:"planned", mb:"yes",  vg:"yes",     gg:"yes",  ac:"tbc",  mi:"yes",  no:"yes" },
      { f: "Send history / audit log",                                                       bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"tbc",  mi:"yes",  no:"yes" },
      { f: "Unsubscribe handling (CAN-SPAM compliant)",                                      bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
    ],
  },
  {
    id: "6.1",
    name: "Money & Protection",
    sub: "Payments, plans, compliance",
    rows: [
      { f: "Stripe billing integration",                                                     bm:"yes",     mb:"yes",  vg:"no",      gg:"no",   ac:"yes",  mi:"no",   no:"addon",note:"GlossGenius and Mindbody use proprietary processors. Vagaro = Vagaro Pay only." },
      { f: "Square integration",                                                             bm:"yes",     mb:"yes",  vg:"no",      gg:"no",   ac:"yes",  mi:"no",   no:"yes+", note:"Noterro = Square via mobile app only." },
      { f: "Cash / external payment recording",                                              bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
      { f: "Deposits / pre-booking authorization",                                           bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes" },
      { f: "Memberships (recurring monthly)",                                                bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes+", mi:"yes",  no:"yes" },
      { f: "Packages (multi-session bundles)",                                               bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes+", mi:"yes",  no:"yes" },
      { f: "Gift cards",                                                                     bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes+", mi:"yes",  no:"yes" },
      { f: "Insurance billing (CMS-1500 / TELUS eClaims)",                                   bm:"no",      mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"yes",  note:"Noterro is the only platform in this set with built-in insurance billing." },
      { f: "Inventory / retail tracking",                                                    bm:"no",      mb:"no",   vg:"yes",     gg:"yes",  ac:"no",   mi:"yes",  no:"no" },
      { f: "Waiver / e-signature",                                                           bm:"planned", mb:"yes",  vg:"addon",   gg:"yes",  ac:"yes+", mi:"yes",  no:"yes",  note:"Vagaro waivers = forms add-on." },
      { f: "HIPAA-compliant tier (BAA available)",                                           bm:"planned", mb:"yes+", vg:"addon",   gg:"yes+", ac:"yes+", mi:"yes",  no:"yes",  note:"GlossGenius offers free HIPAA add-on. Acuity = Premium plan only." },
    ],
  },
  {
    id: "7.1",
    name: "On Your Phone",
    sub: "Mobile experience",
    rows: [
      { f: "Mobile app for therapist",                                                       bm:"yes",     mb:"yes",  vg:"yes",     gg:"yes",  ac:"yes",  mi:"yes",  no:"yes",  note:"MyBodyMap is PWA (install to home screen)." },
      { f: "Mobile app for clients",                                                         bm:"yes",     mb:"yes",  vg:"yes",     gg:"no",   ac:"no",   mi:"yes",  no:"yes" },
      { f: "QR codes for intake / booking",                                                  bm:"yes",     mb:"tbc",  vg:"tbc",     gg:"tbc",  ac:"tbc",  mi:"tbc",  no:"tbc",  note:"MyBodyMap auto-generates 3 QR codes (booking, intake, review)." },
      { f: "Offline mode",                                                                   bm:"no",      mb:"no",   vg:"no",      gg:"no",   ac:"no",   mi:"no",   no:"no" },
    ],
  },
];

export function annualSavings(competitorMonthly, ourMonthly = 0) {
  return Math.max(0, (competitorMonthly - ourMonthly) * 12);
}
