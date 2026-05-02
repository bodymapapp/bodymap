// src/data/comparisonData.js
//
// Source of truth for the /comparison page.
// 7 platforms × 7 categories × ~50 features.
// Updated: 2026-05-02.
//
// Marks:
//   "yes"      — included on the lowest paid tier (or free for MyBodyMap)
//   "yes+"     — available only on a higher tier
//   "addon"    — paid add-on or per-use fee
//   "no"       — not available
//   "planned"  — on our roadmap; not yet shipped (only used for MyBodyMap)
//   "tbc"      — unverified; awaiting community confirmation
//
// Edit in this file (not the page) so the table re-renders cleanly.
//
// IMPORTANT NOTES:
// - MyBodyMap is FREE on Bronze for almost everything. Only pattern
//   intelligence beyond 5 sessions is paid Silver. We mark Bronze
//   features as "yes" without qualification.
// - We do NOT call out "Native iOS" vs "PWA" — the row reads "Mobile
//   app for therapist" and PWA counts as yes, since for solo LMTs
//   the install-to-home-screen flow is functionally an app.
// - Planned features show "PLANNED" pill — clearer than "yes+ planned"
//   hacks, signals roadmap transparency.

export const PLATFORMS = [
  { id: "bm",  name: "MyBodyMap",   tagline: "Solo LMTs",                     priceFrom: 0,   highlight: true },
  { id: "mb",  name: "MassageBook", tagline: "Generic massage",               priceFrom: 45 },
  { id: "vg",  name: "Vagaro",      tagline: "Spa & beauty",                  priceFrom: 25 },
  { id: "gg",  name: "GlossGenius", tagline: "Beauty pros",                   priceFrom: 48 },
  { id: "ac",  name: "Acuity",      tagline: "Generic scheduling",            priceFrom: 20 },
  { id: "mi",  name: "Mindbody",    tagline: "Studios & enterprise",          priceFrom: 129 },
  { id: "no",  name: "Noterro",     tagline: "Clinical / SOAP-first",         priceFrom: 20 },
];

// Top-of-page summary: the 5 questions therapists ask first.
// Surfaces billing/scheduling/payments answers without breaking the
// 7-category taxonomy below.
export const QUICK_ANSWERS = [
  { q: "Free tier?",                  bm:"yes", mb:"no", vg:"no", gg:"no", ac:"trial", mi:"no", no:"trial" },
  { q: "Online booking + reminders?", bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
  { q: "Take payments (Stripe / Square / cash)?", bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
  { q: "Memberships + packages?",     bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
  { q: "Mobile app for therapist?",   bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
];

export const CATEGORIES = [
  {
    id: "1.1",
    name: "Find & Book",
    sub: "How clients reach you",
    rows: [
      { f: "Online booking page",                        bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Calendar embed for own website",             bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Auto confirmation emails",                   bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Auto reminder emails (24h / 2h)",            bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Auto reminder SMS",                          bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"addon", mi:"yes", no:"yes" },
      { f: "Voice phone-call reminders",                 bm:"no", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"yes" },
      { f: "Buffer time between sessions",               bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Time off / vacation block",                  bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Approve / decline bookings (therapist toggle)", bm:"yes", mb:"tbc", vg:"yes", gg:"tbc", ac:"tbc", mi:"yes", no:"tbc" },
      { f: "Multi-staff scheduling",                     bm:"no", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Public marketplace for client discovery",    bm:"no", mb:"yes", vg:"yes", gg:"no", ac:"no", mi:"yes", no:"no" },
      { f: "Mobile app for therapist",                   bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Recurring appointments (auto-book series)",  bm:"planned", mb:"yes", vg:"yes", gg:"tbc", ac:"yes", mi:"yes", no:"yes" },
    ],
  },
  {
    id: "2.1",
    name: "Know Your Client",
    sub: "How you collect and store client info",
    rows: [
      { f: "Custom intake form fields",                  bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Visual body map intake (front & back)",      bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "Pressure preference selection",              bm:"yes", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "Require intake before booking (therapist toggle)", bm:"yes", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "Red-flag surfacing (contraindications)",     bm:"planned", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"yes" },
      { f: "Photo storage / clinical photos",            bm:"planned", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "Smart pre-fill on return visits",            bm:"planned", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "Client tags / segments",                     bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Custom data fields on client record",        bm:"planned", mb:"yes", vg:"yes", gg:"tbc", ac:"yes", mi:"yes", no:"yes" },
      { f: "Import from CSV (Vagaro / MB / Square)",     bm:"yes", mb:"tbc", vg:"yes", gg:"tbc", ac:"yes", mi:"yes", no:"tbc" },
    ],
  },
  {
    id: "3.1",
    name: "Client Intelligence",
    sub: "Pattern detection & AI",
    rows: [
      { f: "Pattern intelligence (heatmap of recurring areas)", bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no", note:"Free for last 5 sessions; full history on Silver." },
      { f: "AI pre-session brief",                       bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "AI chat over your client list",              bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "Lapsed-client identification",               bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"tbc", mi:"yes", no:"yes" },
      { f: "Daily Practice Pulse digest",                bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "Voice-to-text SOAP scribe",                  bm:"no", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"yes" },
    ],
  },
  {
    id: "4.1",
    name: "Day of Session",
    sub: "Notes & in-room",
    rows: [
      { f: "SOAP notes",                                 bm:"yes", mb:"yes", vg:"addon", gg:"no", ac:"no", mi:"yes", no:"yes" },
      { f: "Customizable note templates",                bm:"yes", mb:"yes", vg:"tbc", gg:"no", ac:"no", mi:"yes", no:"yes" },
      { f: "Predictive charting / smart phrases",        bm:"no", mb:"tbc", vg:"tbc", gg:"no", ac:"no", mi:"tbc", no:"yes" },
      { f: "Add-ons applied at booking time",            bm:"yes", mb:"tbc", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
    ],
  },
  {
    id: "5.1",
    name: "Relationships",
    sub: "Campaigns & retention",
    rows: [
      { f: "Per-recipient personalized campaign emails", bm:"yes", mb:"no", vg:"no", gg:"yes", ac:"no", mi:"yes", no:"tbc", note:"MassageBook support confirmed they don't, May 1 2026." },
      { f: "Per-recipient personalized campaign SMS",    bm:"planned", mb:"yes", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
      { f: "AI campaign starter (8 templates)",          bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "Drip / welcome sequences",                   bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"addon", mi:"yes", no:"yes" },
      { f: "Lapsed-client outreach",                     bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"tbc", mi:"yes", no:"tbc" },
      { f: "Birthday / anniversary touches",             bm:"planned", mb:"yes", vg:"yes", gg:"yes", ac:"tbc", mi:"yes", no:"tbc" },
      { f: "Send history / audit log",                   bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"tbc", mi:"yes", no:"tbc" },
      { f: "Unsubscribe handling (CAN-SPAM)",            bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
    ],
  },
  {
    id: "6.1",
    name: "Money & Protection",
    sub: "Payments, plans, compliance",
    rows: [
      { f: "Stripe billing integration",                 bm:"yes", mb:"no", vg:"no", gg:"no", ac:"addon", mi:"no", no:"addon" },
      { f: "Square integration",                         bm:"yes", mb:"no", vg:"no", gg:"no", ac:"yes", mi:"no", no:"yes+" },
      { f: "Cash / external payment recording",          bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Deposits / pre-booking authorization",       bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Gift cards",                                 bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"addon", mi:"yes", no:"tbc" },
      { f: "Memberships (recurring monthly)",            bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
      { f: "Packages (multi-session bundles)",           bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
      { f: "Insurance billing (CMS-1500 / TELUS)",       bm:"no", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"yes" },
      { f: "Inventory / retail tracking",                bm:"no", mb:"no", vg:"yes", gg:"no", ac:"no", mi:"yes", no:"no" },
      { f: "Waiver / e-signature",                       bm:"planned", mb:"yes", vg:"yes", gg:"yes", ac:"addon", mi:"yes", no:"yes" },
      { f: "Tax / 1099 reports",                         bm:"tbc", mb:"yes", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
      { f: "HIPAA-compliant tier (BAA)",                 bm:"planned", mb:"tbc", vg:"addon", gg:"no", ac:"addon", mi:"yes", no:"yes" },
    ],
  },
  {
    id: "7.1",
    name: "On Your Phone",
    sub: "Mobile experience",
    rows: [
      { f: "Install to home screen",                     bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"tbc", mi:"yes", no:"yes" },
      { f: "Push notifications",                         bm:"yes", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "QR codes for intake / booking",              bm:"yes", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "Offline mode",                               bm:"no", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
    ],
  },
];

export function annualSavings(competitorMonthly, ourMonthly = 0) {
  return Math.max(0, (competitorMonthly - ourMonthly) * 12);
}
