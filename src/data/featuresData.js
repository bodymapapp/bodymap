// src/data/featuresData.js
//
// 7 ribbons / 36 features for the FeaturesV2 page (/features-v2).
// Each ribbon has a name, tagline, and an array of feature cards.
// Each card has: id, name, body (paragraph array for modal), meta (small line at bottom of modal).
// Optional: automated (boolean), supademo (future demo iframe URL).
//
// Photo path convention: /images/feature-{id}.jpg with dots replaced by dashes.
// Example: id "1.1" → /images/feature-1-1.jpg
//
// To add a feature: drop it into the right ribbon's cards array. Counts and totals
// update automatically on the page. Photo file must exist at the matching path.

export const RIBBONS = [
  {
    id: "1",
    name: "Find & Book",
    tagline: "How new clients discover you and schedule their first session.",
    cards: [
      {
        id: "1.1",
        name: "Custom booking page",
        body: [
          "Your own bookmarkable page at <em>mybodymap.app/your-name</em>. Share it once and clients book themselves, no app, no account, no friction.",
          "Designed to look like you, not us. Set your colors, photo, services, and welcome note. The page works as your business card, your scheduler, and your first impression all at once.",
        ],
        meta: "Setup: 2 minutes · Free during beta",
      },
      {
        id: "1.2",
        name: "Cycle-aligned scheduling",
        // Image: currently using feature-1-7.jpg as a stand-in placeholder.
        // HK to provide a thematic image (calm, feminine, professional —
        // moon imagery or cyclic motion suggested) when the next batch of
        // 10-20 marketing images is generated. Tracked in BLOCK_PLAN
        // active fire #8.
        image: "/images/feature-1-7.jpg",
        body: [
          "For practitioners who plan their work around their menstrual cycle. Tag each service to the phases you want to offer it in: menstrual, follicular, ovulatory, luteal. The booking page automatically shows clients only the services you have available that week.",
          "Clients never see your cycle info. They just see fewer or different services on certain days, naturally. Your privacy is protected, and you do not have to fight a rigid 7-day calendar that does not match your body.",
        ],
        meta: "Only on MyBodyMap · Customizable phase ranges · Privacy-first",
      },
      {
        id: "1.3",
        name: "Services catalog",
        body: [
          "Every service you offer with the right duration, price, and add-ons. Your 60-min deep tissue. Your 90-min prenatal. Your hot stone upgrade.",
          "Clients pick the right thing. You stop having to clarify what they actually want over email.",
        ],
        meta: "Add unlimited services · Edit anytime",
      },
      {
        id: "1.4",
        name: "Availability & hours",
        body: [
          "Set when you work, when you take a break, when you absolutely will not be disturbed. Recurring weekly schedule plus one-off changes for vacations or sick days.",
          "Booking respects your time automatically. No more 6am text requests.",
        ],
        meta: "Time-zone aware · Buffer time supported",
      },
      {
        id: "1.5",
        name: "Deposits at booking",
        automated: true,
        body: [
          "Optional deposit collected the moment a client books. Eliminates no-shows almost entirely. You decide if it applies to first-timers, last-minute bookings, or all sessions.",
          "Stripe and Square supported. Money lands in your account, minus the standard processor fee. We take nothing on top.",
        ],
        meta: "Powered by Stripe / Square · No platform cut",
      },
      {
        id: "1.6",
        name: "Cal.com sync",
        automated: true,
        body: [
          "Already using Cal.com or Google Calendar to manage your time? MyBodyMap can sync both ways so you never have to maintain two schedules.",
          "Block a time in either tool, it disappears from booking everywhere.",
        ],
        meta: "Two-way sync · Auto-conflict detection",
      },
      {
        id: "1.7",
        name: "Blocked days",
        body: [
          "One tap to mark a day off. Holidays, retreats, sick days, dentist appointments. Booking page automatically shows the next available slot.",
          "No need to manually decline requests or apologize for being human.",
        ],
        meta: "Recurring blocks supported",
      },
      {
        id: "1.8",
        name: "Website embed",
        body: [
          "One line of code drops your full booking flow into your existing website. Squarespace, Wix, WordPress, custom HTML, all supported.",
          "Your site keeps its design, but booking happens through MyBodyMap behind the scenes.",
        ],
        meta: "iframe embed · 1-click copy",
      },
      {
        id: "1.9",
        name: "Smart Scheduling",
        body: [
          "Tired of three clients booking 9am, 12pm, and 4pm leaving you with two unusable two-hour gaps in between? Turn on Smart Scheduling and the booking page packs new appointments tight against the ones you already have.",
          "Two strictness levels. Soft means clients still see every slot but the platform highlights the ones that keep your day clean. Hard means clients only see slots that touch an existing appointment edge. Your day, your call.",
        ],
        meta: "Soft and hard modes · No competitor offers this",
      },
      {
        id: "1.10",
        name: "Custom days per service",
        body: [
          "Hot Stone is heavy. You only do it Tuesdays and Thursdays. Prenatal sessions are precious, you save those for Saturdays. Swedish runs every weekday. Your booking page already knows.",
          "On each service in your settings, tap the day pills to pick which days that service is offered. Clients booking Hot Stone see only Tue and Thu open on the calendar. Other days fade out with a clear note saying when that service is available. No back and forth.",
        ],
        meta: "Per-service day filter · No competitor offers this",
      },
    ],
  },
  {
    id: "2",
    name: "Know Your Client",
    tagline: "Everything between booking and walking in the door.",
    cards: [
      {
        id: "2.1",
        name: "Visual body map intake",
        body: [
          "The thing competitors do not have. Clients tap focus areas, avoid zones, pressure preferences, and medical flags directly on a body diagram, on their phone, before they arrive.",
          "You walk into the session already knowing where to start. They do not have to repeat themselves. The intake takes 60 seconds for them and replaces a clipboard form forever.",
        ],
        meta: "Patent-pending · Voice notes supported",
      },
      {
        id: "2.2",
        name: "Customize your intake",
        // Image: placeholder for now — using feature-1-7.jpg as
        // stand-in. Tracked in BLOCK_PLAN active fire #8 image batch.
        image: "/images/feature-1-7.jpg",
        body: [
          "One page that mirrors the entire client intake. Five sections in the order your client experiences them: body map, preferences, medical conditions, waiver, and any custom questions you add. Tap to rename. Toggle to hide. The body map and waiver always stay because those are the differentiator and the legal protection.",
          "Add your own questions in seven formats: pick-one chips, pick-many chips, checkbox lists, short text, long text, yes/no, or section headers. 12 common medical conditions built in (high blood pressure, blood clots, recent surgery, pregnancy, and more), each individually editable. Plus an optional HIPAA mode that adds stronger consent and a view audit log.",
        ],
        meta: "Seven question types · 12 medical conditions built-in · HIPAA mode optional",
      },
      {
        id: "2.3",
        name: "Session preferences",
        body: [
          "Music, lighting, scent, table warmth, conversation level. Captured once, remembered every visit. The little things that make the session feel like it was made for them.",
          "Pre-fills next time, of course.",
        ],
        meta: "Auto-saved · Editable anytime",
      },
      {
        id: "2.4",
        name: "Signed waiver, bundled in",
        body: [
          "Your liability waiver, your intake form, your medical questionnaire all in one signed flow. Legally binding e-signature with timestamp and IP audit trail.",
          'No more clipboard, no more "did they sign it?" anxiety.',
        ],
        meta: "ESIGN Act compliant · Stored 7 years",
      },
      {
        id: "2.5",
        name: "Smart pre-fill on return",
        automated: true,
        body: [
          "When a returning client books again, the intake auto-loads their last submission. They tap through to confirm or update what changed.",
          "Average return-intake time: 11 seconds.",
        ],
        meta: "Encrypted at rest · Client controls what changes",
      },
      {
        id: "2.6",
        name: "Client notes & medical flags",
        body: [
          'Private notes only you see. "Sensitive lower back, no deep pressure." "Pregnant, second trimester." "Always falls asleep, leave time at the end."',
          "Surfaces automatically in your pre-session brief so you never miss the detail that matters.",
        ],
        meta: "HIPAA-encrypted · Private to you",
      },
      {
        id: "2.7",
        name: "QR codes for everything",
        body: [
          "Print-ready QR codes for your intake form and your booking page, sized to put on your table, your front desk, or your business card. Clients scan with their phone camera, no app needed.",
          "Plus save unlimited custom QR codes for any link you reuse: your website, Instagram, Yelp reviews page, a special promo, a Google form. Save once, reprint forever. Each one is downloadable, printable, and the URL is always one tap to copy.",
        ],
        meta: "High-resolution print · Unlimited saved QR codes · Mobile-friendly",
      },
    ],
  },
  {
    id: "3",
    name: "Client Intelligence",
    tagline: "Pattern recognition across visits. The core moat.",
    cards: [
      {
        id: "3.1",
        name: "Longitudinal heatmaps",
        automated: true,
        body: [
          "See every body area a client has flagged over time, layered into a single visual. Spot the pattern emerging in their right shoulder over the last six months without scrolling through twelve session notes.",
          'The kind of insight that makes a client say <em>"how did you know?"</em>',
        ],
        meta: "Updates automatically · Shareable with client",
      },
      {
        id: "3.2",
        name: "The three-dot document system",
        automated: true,
        body: [
          "Three documents around every session, generated as you work. The Intake captures what your client filled in: body map, eight preferences, conditions, every custom answer. The Pre-Session Brief, ready five minutes before the door opens, synthesizes today's request with what changed since last visit, the plan you wrote down, and the patterns across every prior visit (right shoulder requested 5 of 5 times, pressure climbing 2 to 4 over 10 weeks).",
          "After the session, the system splits into two outputs from one set of notes. You get an archival record with SOAP, aftercare, and pattern updates. Your client gets a warm summary in their language: your note to them in italics, the zones you worked, the aftercare they should follow, and a one-tap rebooking link.",
          "Minimal time from you. Maximum insight per visit. The whole client journey, surfaced.",
        ],
        meta: "Auto-generated · One page each · Print, PDF, or share by link",
      },
      {
        id: "3.3",
        name: "Full session history",
        body: [
          "Every intake, every note, every body map, every recommendation, in chronological order, instantly searchable.",
          'No more "what did we work on last time?" before the client arrives.',
        ],
        meta: "Searchable · Exportable · Yours forever",
      },
      {
        id: "3.4",
        name: "Practice Assistant",
        body: [
          'Ask anything about a client. <em>"What body areas has Sarah been flagging the most this year?"</em> <em>"Which clients have not booked in 60+ days but used to come monthly?"</em>',
          "The platform reads every intake, session note, and booking history. Trained only on your practice. Answers in seconds, in plain English.",
        ],
        meta: "Private to your practice · Never trained on others",
      },
      {
        id: "3.5",
        name: "Pattern detection",
        automated: true,
        body: [
          "The platform watches your data quietly. When a regular skips two sessions, when a client pattern shifts toward a new pain zone, when retention drops in a segment, it tells you.",
          "Like a chief of staff that never sleeps.",
        ],
        meta: "Weekly digest · Configurable thresholds",
      },
      {
        id: "3.6",
        name: "Practice Pulse",
        automated: true,
        body: [
          "Every morning, a quiet email summarizing what is happening across your practice. Sessions today, lapsed clients to reach out to, revenue this week, one or two pattern alerts.",
          "Two-minute read. Designed to make you feel in control before the first client arrives.",
        ],
        meta: "Daily 6am local time · Skip weekends",
      },
    ],
  },
  {
    id: "4",
    name: "Day-of-Session",
    tagline: "What the platform does during the hour you're working.",
    cards: [
      {
        id: "4.1",
        name: "Today's schedule",
        body: [
          "One screen, every appointment, color-coded by service. Tap a slot to see the client, their pre-session brief, last-session notes, and any flags.",
          "The schedule that fits in your apron pocket.",
        ],
        meta: "Live updates · Drag to reschedule",
      },
      {
        id: "4.2",
        name: "Pre-session brief",
        automated: true,
        body: [
          "Two minutes before each session, a card surfaces: who is coming, where they have been hurting, what worked last time, what to ask about, what to avoid.",
          "It is the brief a great manager would send you. Except it is the platform, and it never forgets.",
        ],
        meta: "Auto-generates · 2 min before session",
      },
      {
        id: "4.3",
        name: "Post-session SOAP notes",
        body: [
          "Tap voice-to-text right after the session. Speak your observations. The platform structures them into proper SOAP format and files them under the client.",
          "No more 30 minutes of paperwork at the end of the day.",
        ],
        meta: "Voice or type · Auto-formatted",
      },
      {
        id: "4.4",
        name: "Quick client lookup",
        body: [
          "Walk-in just arrived? Search by first name, last name, phone, or email. Their full record is up in two seconds. Including waiver status and last visit.",
          "Built for the moment, not for the desk.",
        ],
        meta: "Fuzzy search · Recent clients pinned",
      },
      {
        id: "4.5",
        name: "Mobile-first UX",
        body: [
          "Most therapists do everything on their phone between sessions. Every screen designed for thumb-reach, big tap targets, and one-hand use.",
          "Desktop works. Phone works better.",
        ],
        meta: "iOS · Android · PWA installable",
      },
    ],
  },
  {
    id: "5",
    name: "Relationships",
    tagline: "Turn first-timers into regulars. Keep regulars coming back.",
    cards: [
      {
        id: "5.0",
        name: "Personalized campaign emails",
        automated: false,
        link: "/campaigns",
        linkLabel: "See it in action",
        body: [
          "One message, every recipient sees their own first name, last visit, last service. Pick a segment (lapsed, regulars, never-rebooked, custom). Tap an Platform starter (Mother's Day, vacation, new service, special offer, holiday hours, weather closure, anniversary, reactivate-lapsed) and the platform drafts the email in your voice.",
          'MassageBook publicly admits this works in their automated emails but not their campaigns. We do both.',
        ],
        meta: "Email · 8 Platform starters · 7 personalization tokens · Send history",
      },
      {
        id: "5.1",
        name: "Automated reminders",
        automated: true,
        body: [
          "SMS and email reminders sent automatically. 24 hours before, 2 hours before, however you set it. Includes the intake link if they have not filled it.",
          'The "did I confirm with Sarah?" anxiety just disappears.',
        ],
        meta: "SMS · Email · Configurable timing",
      },
      {
        id: "5.2",
        name: "Gift cards",
        automated: true,
        videoUrl: "/videos/gift-cards.mp4",
        body: [
          "Sell beautiful gift cards directly from your booking page. Recipient gets an instant email with a code; redeems at booking; you get paid right away.",
          "Print-ready in any size. Postcard, half-page, wallet, or custom. The therapist picks; the browser handles the dialog. No more wrestling with Canva margins.",
          "Booked the right way for your accountant. Gift card sales are recorded as deferred revenue (a liability), not as income, until the session is actually delivered. This is the GAAP-correct treatment most spa booking tools skip. Square is one of the only platforms in this space that handles it properly; MyBodyMap rides Stripe and Square so your books look right out of the box.",
          "Travels where flowers cannot. The kind of small thing that makes a regular client feel like they have an actual relationship with you.",
        ],
        meta: "Custom amounts · Print or email · GAAP-correct accounting",
      },
      {
        id: "5.3",
        name: "Post-session follow-up",
        automated: true,
        body: [
          "Thank-you message goes out automatically the morning after. Includes a one-tap rebook link, a self-care reminder you can customize, and a quick feedback prompt.",
          "The kind of follow-through that makes clients tell their friends.",
        ],
        meta: "Auto-sent · Customizable copy",
      },
      {
        id: "5.4",
        name: "Lapsed client outreach",
        automated: true,
        body: [
          'When a regular stops booking for 30, 60, 90 days, the platform flags them. You get a weekly reminder list with a one-tap "send the gentle nudge" template.',
          "Most lapsed clients come back if you reach out. Most therapists never do because they forget. We remember for you.",
        ],
        meta: "Weekly digest · One-tap send",
      },
      {
        id: "5.5",
        name: "Loyalty rewards",
        automated: true,
        body: [
          "Built-in punch card. After N sessions, the next one is discounted, free, or upgraded. Your call. Tracked automatically, redeemed at booking.",
          "No paper card to lose, no spreadsheet to maintain.",
        ],
        meta: "Configurable thresholds · Auto-redeem",
      },
      {
        id: "5.6",
        name: "5-dimension feedback",
        automated: true,
        body: [
          "Quick post-session check across pressure, focus area, communication, environment, and overall. Anonymous to you, aggregated over time, surfaces the trend, not the one bad day.",
          "The feedback you actually want to see.",
        ],
        meta: "Aggregate-only view · Never per-session",
      },
    ],
  },
  {
    id: "6",
    name: "Money & Protection",
    tagline: "Get paid. Stay protected. Run a real business.",
    cards: [
      {
        id: "6.1",
        name: "Billing dashboard",
        automated: true,
        body: [
          "Revenue this week, this month, this year. Expected vs collected. Top 10 clients by lifetime spend. The numbers without the spreadsheets.",
          "Built for the therapist who became one because they did not want to look at spreadsheets.",
        ],
        meta: "Real-time · Exportable for taxes",
      },
      {
        id: "6.2",
        name: "Cancellation policy",
        body: [
          "Set what happens when a client cancels, reschedules, or no-shows. Like hotels and airlines do. Plain English rules: <em>more than 24 hours before, no charge. Within 24 hours, 50%. Within 2 hours, 100%. No-show, 100%.</em> Sensible defaults are pre-filled, change any percent in one tap.",
          "Clients see your policy at booking, in plain English, before they confirm. Optionally require new clients (or returning clients) to put a card on file so the policy can charge automatically if it triggers. Your time is as valuable as a hotel room.",
        ],
        meta: "Plain-English rules · Card on file optional · Auto-charge live",
      },
      {
        id: "6.3",
        name: "Legally signed waivers",
        body: [
          "ESIGN Act compliant e-signatures with timestamp, IP, and audit trail. Stored seven years per most state requirements. Exportable as PDF if you ever need it.",
          "The legal protection clipboards never gave you.",
        ],
        meta: "ESIGN compliant · 7-year retention",
      },
      {
        id: "6.4",
        name: "Privacy & security",
        body: [
          "Your client data is HIPAA-encrypted, the same security standards used by MassageBook, Vagaro, and online banking. Each therapist's data is fully isolated. We never sell it, never train the platform on it across practices.",
          "<em>A note on HIPAA the law:</em> it generally applies to therapists who bill insurance electronically. Most solo cash-pay therapists are not legally covered, but we treat your data with that level of care anyway.",
        ],
        meta: "HIPAA encryption · SOC 2 Type II host",
      },
      {
        id: "6.5",
        name: "Stripe + Square, both fully",
        body: [
          "Connect whichever payment processor you already use, or both. Same online features either way: deposits at booking, package and gift certificate purchases, monthly memberships, card-on-file, automatic cancellation charging, and one-tap refunds.",
          "If you connect both, MyBodyMap routes each feature to whichever processor handles it best. You can override per-feature in Settings if you want Stripe for memberships and Square for everything else, or any other combination. We do not lock you in either direction.",
        ],
        meta: "Bring your own payments · Stripe and Square equal · Per-feature routing",
      },
      {
        id: "6.6",
        name: "Card on file at booking",
        body: [
          "When a client books, you can require them to save a card. We store it securely with your processor (never on our servers). The card sits there, untouched, until your cancellation policy says to charge it.",
          "Set per-rule: require for first-timers only, returning clients only, or everyone. The client sees a clear authorization on the booking page and explicitly agrees before saving. Their card is theirs to update at any time.",
        ],
        meta: "Optional per booking · Stripe and Square · Mandate audit trail",
      },
      {
        id: "6.7",
        name: "One-tap refunds",
        automated: true,
        body: [
          "When a client needs their money back, you do not log into Stripe or Square. You open your dashboard, find the purchase, tap Refund, and confirm the amount. The refund hits the client's card automatically and stays visible in your purchases panel marked Refunded for your records.",
          "Works for full or partial amounts. Works for packages and one-time deposits. Memberships use a separate cancel-and-prorate flow.",
        ],
        meta: "Stripe and Square · Audit trail · Partial refunds supported",
      },
    ],
  },
  {
    id: "7",
    name: "On Your Phone",
    tagline: "The platform lives with you, quietly, everywhere.",
    cards: [
      {
        id: "7.1",
        name: "Install to home screen",
        body: [
          "MyBodyMap is a Progressive Web App. One tap to install on iPhone or Android. Behaves like a native app, opens to the dashboard, no app store gatekeepers.",
          "Updates instantly. No version-lag, no review queue.",
        ],
        meta: "iOS Safari · Chrome Android · PWA",
      },
      {
        id: "7.2",
        name: "Push notifications",
        automated: true,
        body: [
          "Optional alerts when a client books, when a session is starting, when a lapsed client responds. You decide which notifications matter and when they go quiet.",
          'Default is "do not disturb during sessions." Of course.',
        ],
        meta: "Per-event toggle · Quiet hours",
      },
      {
        id: "7.3",
        name: "Founding Therapist emails",
        automated: true,
        body: [
          'As a founding therapist you get product updates, behind-the-scenes notes, and direct access to the founder. No marketing fluff, no "growth hacks," no daily tips.',
          "When something ships, you hear about it. When something is broken, we tell you first.",
        ],
        meta: "Direct from the founder · Reply anytime",
      },
      {
        id: "7.4",
        name: "Refer and reward",
        body: [
          "Send another therapist your founder code via Instagram or Facebook DM. They get Silver tier free for life. You get a thank-you, a credit, and the satisfaction of helping a colleague.",
          "Built like a private invitation, not a referral program.",
        ],
        meta: "IG/FB DM only · Limited to 100 founders",
      },
      {
        id: "7.5",
        name: "Switch in minutes",
        body: [
          "Coming from MindBody, Vagaro, Acuity, Square Appointments, or just a Google Sheet? CSV import for client lists, services, and history. Most switches take under 15 minutes.",
          "We do the import for you on request. Reply to any email and we will help.",
        ],
        meta: "CSV import · White-glove option",
      },
    ],
  },
];

// Helper: build photo URL from feature id
export function photoForId(id) {
  return `/images/feature-${id.replace(/\./g, "-")}.jpg`;
}

// Computed totals (used by page header)
export const TOTAL_FEATURES = RIBBONS.reduce((n, r) => n + r.cards.length, 0);
export const TOTAL_CATEGORIES = RIBBONS.length;
