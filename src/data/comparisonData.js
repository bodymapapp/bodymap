// src/data/comparisonData.js
//
// Source of truth for the /comparison page.
// 7 platforms × 7 categories × ~60 features.
// Updated: 2026-05-02.
//
// Marks:
//   "yes"   — included on the lowest paid tier
//   "yes+"  — available on a higher tier only
//   "addon" — paid add-on or per-use fee
//   "no"    — not available
//   "tbc"   — unverified, awaiting confirmation
//
// Edit in this file (not the page) so the table re-renders cleanly.

export const PLATFORMS = [
  { id: "bm",  name: "MyBodyMap",   tagline: "Solo LMTs",                     priceFrom: 0,   priceMid: 9,   highlight: true },
  { id: "mb",  name: "MassageBook", tagline: "Generic massage / multi-staff", priceFrom: 45,  priceMid: 45 },
  { id: "vg",  name: "Vagaro",      tagline: "Spa & beauty",                  priceFrom: 25,  priceMid: 25 },
  { id: "gg",  name: "GlossGenius", tagline: "Beauty pros",                   priceFrom: 48,  priceMid: 48 },
  { id: "ac",  name: "Acuity",      tagline: "Generic scheduling",            priceFrom: 20,  priceMid: 20 },
  { id: "mi",  name: "Mindbody",    tagline: "Studios & enterprise",          priceFrom: 129, priceMid: 129 },
  { id: "no",  name: "Noterro",     tagline: "Clinical / SOAP-first",         priceFrom: 20,  priceMid: 20 },
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
      { f: "Auto reminder SMS",                          bm:"yes+", mb:"yes", vg:"yes", gg:"yes", ac:"addon", mi:"yes", no:"yes" },
      { f: "Voice phone-call reminders",                 bm:"no", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"yes" },
      { f: "Buffer time between sessions",               bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Time off / vacation block",                  bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Booking approval workflow",                  bm:"yes", mb:"tbc", vg:"yes", gg:"tbc", ac:"tbc", mi:"yes", no:"tbc" },
      { f: "Multi-staff scheduling",                     bm:"no", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Public marketplace for client discovery",    bm:"no", mb:"yes", vg:"yes", gg:"no", ac:"no", mi:"yes", no:"no" },
      { f: "Native iOS app for therapist",               bm:"PWA", mb:"yes", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
      { f: "Native client app",                          bm:"PWA", mb:"yes", vg:"yes", gg:"no", ac:"no", mi:"yes", no:"yes" },
      { f: "Recurring appointments (auto-book series)",  bm:"no", mb:"yes", vg:"yes", gg:"tbc", ac:"yes", mi:"yes", no:"yes" },
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
      { f: "Medical history / pregnancy / meds",         bm:"yes+", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Red-flag surfacing (contraindications)",     bm:"yes+", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"yes" },
      { f: "Photo storage / clinical photos",            bm:"no", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "Smart pre-fill on return visits",            bm:"yes+", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "Client tags / segments",                     bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"yes", mi:"yes", no:"yes" },
      { f: "Custom data fields on client record",        bm:"no", mb:"yes", vg:"yes", gg:"tbc", ac:"yes", mi:"yes", no:"yes" },
      { f: "Import from CSV (Vagaro / MB / Square)",     bm:"yes", mb:"tbc", vg:"yes", gg:"tbc", ac:"yes", mi:"yes", no:"tbc" },
    ],
  },
  {
    id: "3.1",
    name: "Client Intelligence",
    sub: "Pattern detection & AI",
    rows: [
      { f: "Pattern intelligence (heatmap of recurring areas)", bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "AI pre-session brief",                       bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "AI chat over your client list",              bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "Lapsed-client identification",               bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"tbc", mi:"yes", no:"yes" },
      { f: "Daily Pulse digest email",                   bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
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
      { f: "Per-recipient personalized campaign emails", bm:"yes", mb:"no", vg:"no", gg:"yes", ac:"no", mi:"yes", no:"tbc" },
      { f: "Per-recipient personalized campaign SMS",    bm:"yes+", mb:"yes", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
      { f: "AI campaign starter (8 templates)",          bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "Drip / welcome sequences",                   bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"addon", mi:"yes", no:"yes" },
      { f: "Lapsed-client outreach",                     bm:"yes", mb:"yes", vg:"yes", gg:"yes", ac:"tbc", mi:"yes", no:"tbc" },
      { f: "Birthday / anniversary touches",             bm:"no", mb:"yes", vg:"yes", gg:"yes", ac:"tbc", mi:"yes", no:"tbc" },
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
      { f: "Waiver / e-signature",                       bm:"no", mb:"yes", vg:"yes", gg:"yes", ac:"addon", mi:"yes", no:"yes" },
      { f: "Tax / 1099 reports",                         bm:"tbc", mb:"yes", vg:"yes", gg:"yes", ac:"no", mi:"yes", no:"yes" },
      { f: "HIPAA-compliant tier (BAA)",                 bm:"no", mb:"tbc", vg:"addon", gg:"no", ac:"addon", mi:"yes", no:"yes" },
    ],
  },
  {
    id: "7.1",
    name: "On Your Phone",
    sub: "Mobile access",
    rows: [
      { f: "PWA install to home screen",                 bm:"yes", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
      { f: "Push notifications",                         bm:"yes", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "QR codes for intake / booking",              bm:"yes", mb:"tbc", vg:"tbc", gg:"tbc", ac:"tbc", mi:"tbc", no:"tbc" },
      { f: "Offline mode",                               bm:"no", mb:"no", vg:"no", gg:"no", ac:"no", mi:"no", no:"no" },
    ],
  },
];

// Annual savings vs each competitor on the free Bronze tier (best case
// for the visitor).
export function annualSavings(competitorMonthly, ourMonthly = 0) {
  return Math.max(0, (competitorMonthly - ourMonthly) * 12);
}
