// src/pages/Home.jsx
//
// Home — the product tour.
//
// Hero stays editorial (warm cream + Fraunces serif + lifestyle hero photo).
// Below hero, we unfold seven product ribbons that mirror /features
// structure. Each ribbon shows an actual interactive demo (extracted from
// legacy Features.jsx into src/components/demos/) plus a sub-feature list
// linking to the relevant ribbon on /features. Two lifestyle moments are
// kept for brand continuity: one after hero, one before closing CTA.
//
// Mobile-first layout: demo stacks above sub-feature list.
// Desktop: per-ribbon layout decision (left/right or stacked) based on
// what each demo's natural shape wants.

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import HelpWidget from "../components/HelpWidget";

// Interactive product demos (extracted from legacy Features.jsx)
import BookingDemo from "../components/demos/BookingDemo";
import BodyMapDemo from "../components/demos/BodyMapDemo";
import PatternDemo from "../components/demos/PatternDemo";
import ThreeDotDocumentDemo from "../components/demos/ThreeDotDocumentDemo";
import ScheduleDemo from "../components/demos/ScheduleDemo";
import SmartCalendarAnimation from "../components/demos/SmartCalendarAnimation";
import BillingDemo from "../components/demos/BillingDemo";
import AIDemo from "../components/demos/AIDemo";
import AutomationHub from "../components/demos/AutomationHub";
import CampaignsDemo from "../components/demos/CampaignsDemo";
import GiftCardDemo from "../components/demos/GiftCardDemo";
import NotificationsStepper from "../components/NotificationsStepper";
import CycleScheduleDemo from "../components/demos/CycleScheduleDemo";
import SmartScheduleDemo from "../components/demos/SmartScheduleDemo";
import ServiceDaysDemo from "../components/demos/ServiceDaysDemo";
import DateOverrideDemo from "../components/demos/DateOverrideDemo";
import PreferencesDemo from "../components/demos/PreferencesDemo";
import IntakeEditorDemo from "../components/demos/IntakeEditorDemo";
import PhoneDemo from "../components/demos/PhoneDemo";
import CancellationPolicyDemo from "../components/demos/CancellationPolicyDemo";
import ProcessorParityDemo from "../components/demos/ProcessorParityDemo";
import CardOnFileDemo from "../components/demos/CardOnFileDemo";
import RefundDemo from "../components/demos/RefundDemo";
import ServiceGroupingDemo from "../components/demos/ServiceGroupingDemo";
import DataOwnershipDemo from "../components/demos/DataOwnershipDemo";

// ───────────────────────────────────────────────────────────────────────
// Ribbon configuration. Mirrors the 7 ribbons on /features but adapted
// for Home: each ribbon picks ONE primary demo and lists 3-5 sub-features
// that link into the relevant section of /features via anchor IDs.
// ───────────────────────────────────────────────────────────────────────
const RIBBONS = [
  {
    id: "1",
    name: "Find & Book",
    tagline: "How new clients discover you and schedule the first session.",
    // TWO demos for Find & Book carousel: standard booking flow first
    // (familiar baseline), then cycle-aligned scheduling — our one-of-one
    // differentiator that no other booking platform offers as of May 2026.
    // We list cycle scheduling SECOND in the carousel so the standard
    // booking demo loads first for visitors who don't know what cycle
    // scheduling is, but cycle gets its own pill label so curious users
    // can tap right to it.
    demos: [
      { kind: "component", component: ServiceGroupingDemo, label: "Group your services" },
      { kind: "component", component: BookingDemo, label: "Try the booking page" },
      { kind: "component", component: CycleScheduleDemo, label: "Cycle-aligned scheduling" },
      { kind: "component", component: SmartScheduleDemo, label: "Smart Scheduling" },
      { kind: "component", component: ServiceDaysDemo, label: "Custom days per service" },
      { kind: "component", component: DateOverrideDemo, label: "Date-specific hours" },
    ],
    layout: "demo-right",
    subFeatures: [
      "Custom booking page at mybodymap.app/your-name",
      "Clients book without creating an account, no login required (only on MyBodyMap)",
      "Services catalog with durations and add-ons",
      "Cycle-aligned scheduling (only on MyBodyMap)",
      "Smart Scheduling that packs your day tight (only on MyBodyMap)",
      "Custom days per service, different services on different days (only on MyBodyMap)",
      "Date-specific hours, set different hours or a day off for any date and copy a week forward",
      "Service grouping, auto-classified into Prenatal, Couples, Therapeutic, Relaxation, Energy, Add-ons (only on MyBodyMap)",
      "Cal.com sync, two-way",
      "Deposits at booking via Stripe / Square",
      "Website embed for your existing site",
    ],
    cta: "Find & Book features",
  },
  {
    id: "2",
    name: "Know Your Client",
    tagline:
      "The visual body map that no other massage platform offers, on your client's phone before they walk in.",
    // THREE demos: body map (the patent-pending core moat) + full client
    // intake (client view) + intake editor (therapist view).
    // Body Map is what clients tap first. PreferencesDemo shows the same
    // intake from the client's tap-through experience. IntakeEditorDemo
    // shows what the THERAPIST sees when she customizes the form: same
    // sections, but with toggle switches and editable labels. Three pills,
    // three angles on the same intake feature.
    demos: [
      { kind: "component", component: BodyMapDemo, label: "Body map intake" },
      { kind: "component", component: PreferencesDemo, label: "Full intake form" },
      { kind: "component", component: IntakeEditorDemo, label: "Edit your intake" },
    ],
    layout: "demo-left",
    subFeatures: [
      "Visual body map intake (front and back)",
      "Customize your intake: hide, edit, or add any question",
      "Level of conversation (quiet vs happy to chat)",
      "Music, lighting, draping, oils & scent preferences",
      "Medical conditions checklist + optional HIPAA mode",
      "Pre-fills automatically on return",
      "Print-ready QR codes for intake, booking, and unlimited custom links",
    ],
    cta: "Know Your Client features",
  },
  {
    id: "3",
    name: "Client Intelligence",
    tagline:
      "Pattern recognition across visits and Platform chat with your full client history. The core moat.",
    // Three demos for ribbon 3. Three-dot document system first since
    // it is the new flagship and the visual anchor. Pattern + AI follow.
    demos: [
      { kind: "component", component: ThreeDotDocumentDemo, label: "Three-dot document system" },
      { kind: "component", component: PatternDemo, label: "Pattern detection" },
      { kind: "component", component: AIDemo, label: "PracticeIQ chat" },
    ],
    layout: "demo-right",
    subFeatures: [
      "Three-dot document system: Intake, Pre-Session, Post-Session",
      "Reads your paper forms: photograph an old intake and the fields fill themselves",
      "Remembers the whole client: a dated history that updates itself and surfaces in your brief",
      "Longitudinal heatmaps across all sessions",
      "Full session history, instantly searchable",
      "PracticeIQ: chat with your client data",
      "Pattern detection on body areas trending up",
      "Practice Pulse: daily 6am morning brief",
    ],
    cta: "Client Intelligence features",
  },
  {
    id: "4",
    name: "Day-of-Session",
    headline: "Smart Calendar",
    featured: true,
    tagline: "Your calendar quietly answers the questions you'd ask yourself if you had time.",
    demos: [{ kind: "component", component: SmartCalendarAnimation, label: "Smart Calendar" }],
    layout: "demo-left",
    subFeatures: [
      "Fill This Gap: a slot opens, your platform names the right lapsed client and drafts the text. One tap.",
      "Up-Next Briefing: three things to remember about your next client, pulled from her last session.",
      "Body Load Awareness: three deep tissue back to back, your platform warns you before your wrists pay.",
      "Voice-to-text SOAP notes, ready in 30 seconds",
      "Quick client lookup by name, phone, or email",
    ],
    cta: "Day-of-Session features",
  },
  {
    id: "5",
    name: "Relationships",
    tagline: "Turn first-timers into regulars. Keep regulars coming back.",
    // FOUR demos shown as a carousel. ORDER: Notifications stepper is
    // the hero (May 18 2026 in response to Maddy's MassageBook horror
    // story about silent reminder failures). Then Gift cards, then
    // Campaigns, then Automation.
    demos: [
      { kind: "component", component: NotificationsStepper, label: "30 notifications" },
      { kind: "component", component: GiftCardDemo, label: "Gift cards" },
      { kind: "component", component: CampaignsDemo, label: "Campaign starter" },
      { kind: "component", component: AutomationHub, label: "Automation flows" },
    ],
    layout: "demo-right",
    subFeatures: [
      "30 automated notifications across the client journey",
      "Failure alerts go to YOU, not your client",
      "Post-session thank-you with rebook link",
      "One-tap campaign drafts in 8 categories",
      "Lapsed client outreach, weekly digest",
    ],
    cta: "Relationships features",
  },
  {
    id: "6",
    name: "Money & Protection",
    tagline: "Get paid. Stay protected. Run a real business.",
    // FIVE demos in carousel for ribbon 6 — billing dashboard first
    // (familiar overview), then the four new feature demos that
    // visualize the differentiating money features:
    //   - Cancellation policy with countdown clock + tier rows
    //   - Stripe + Square parity with feature checkmarks
    //   - Card-on-file capture flow
    //   - One-tap refund flow
    // Each gets its own pill so curious visitors can tap directly
    // to the feature that interests them.
    demos: [
      { kind: "component", component: DataOwnershipDemo, label: "Download all your data" },
      { kind: "component", component: BillingDemo, label: "Billing dashboard" },
      { kind: "component", component: CancellationPolicyDemo, label: "Cancellation policy" },
      { kind: "component", component: ProcessorParityDemo, label: "Stripe + Square" },
      { kind: "component", component: CardOnFileDemo, label: "Card on file" },
      { kind: "component", component: RefundDemo, label: "One-tap refunds" },
    ],
    layout: "demo-left",
    subFeatures: [
      "Revenue dashboard, real-time",
      "Cancellation policy: charge for late cancels, reschedules, no-shows",
      "Stripe + Square, both fully · use whichever you already use",
      "Card on file at booking, charged only if policy triggers",
      "One-tap refunds from your dashboard, no Stripe/Square login",
      "ESIGN-compliant signed waivers, 7-year retention",
      "HIPAA-encrypted, same standards as MassageBook and Vagaro",
      "Download all your data anytime as one ZIP, free (only on MyBodyMap)",
    ],
    cta: "Money & Protection features",
  },
  {
    id: "7",
    name: "On Your Phone",
    tagline: "The platform lives with you, quietly, everywhere. Install to home screen, no app store.",
    demos: [{ kind: "component", component: PhoneDemo, label: "On your phone" }],
    layout: "demo-right",
    subFeatures: [
      "Install to home screen (PWA)",
      "Push notifications, configurable per event",
      "Founding therapist emails, direct from the founder",
      "Refer and reward via IG/FB DM",
      "Switch from MindBody, Vagaro, Acuity in 15 minutes",
    ],
    cta: "On Your Phone features",
  },
];

// ───────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────
export default function Home() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Capture referral code from URL if someone arrives via a shared referral
  // link like mybodymap.app/?ref=simonsmassage.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        localStorage.setItem("bm_referrer", ref);
      }
    } catch {}
  }, []);

  // SEO
  useEffect(() => {
    document.title = "MyBodyMap · Practice on autopilot for massage therapists";
  }, []);

  return (
    <div className="bm-home-v2">
      <Nav />

      {/* ── ANNOUNCEMENT BANNER ──────────────────────────────────────────
          Top-of-page strip highlighting our newest one-of-one feature:
          cycle-aligned scheduling. Feminine + professional palette
          (cream/rose gradient, dusty rose ink, sage moon icon). Subtle
          enough to not compete with the hero CTAs but visible enough that
          a returning visitor sees something has changed. Links into the
          dedicated section on /features so curious clicks land somewhere
          real instead of bouncing back to a sales pitch.
          
          Designed to be retired or swapped out as new launches happen. */}
      <Link to="/features#cycle" style={{ textDecoration: "none" }}>
        <div className="bm-launch-banner" style={{
          background: "linear-gradient(90deg, #FCF8EE 0%, #FCE8E0 50%, #FAF6EE 100%)",
          borderBottom: "1px solid #E8C5B5",
          padding: "10px 20px",
          textAlign: "center",
          fontSize: 13,
          color: "#5C2E27",
          cursor: "pointer",
          transition: "filter 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.97)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
        >
          <style>{`
            @media (max-width: 520px) {
              .bm-launch-banner { padding: 8px 12px !important; font-size: 12px !important; }
              .bm-launch-banner .bm-launch-subtitle { display: none !important; }
            }
          `}</style>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              color: "#A87468",
              background: "#fff",
              border: "1px solid #E8C5B5",
              padding: "2px 8px",
              borderRadius: 99,
              flexShrink: 0,
            }}>
              JUST SHIPPED
            </span>
            <span style={{ fontWeight: 600 }}>🌙 Cycle-aligned scheduling</span>
            <span className="bm-launch-subtitle" style={{ color: "#7A5C53" }}>
              · plan your work around your cycle, not against it
            </span>
            <span style={{ color: "#A87468", fontWeight: 700, flexShrink: 0 }}>
              See how →
            </span>
          </span>
        </div>
      </Link>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="bm-home-hero">
        <div className="bm-home-hero__grid">
          <div className="bm-home-hero__copy">
            <div className="bm-home-hero__eyebrow">For massage therapists</div>
            <h1 className="bm-home-hero__title">
              Keep every client <em>coming back.</em>
            </h1>
            <p className="bm-home-hero__sub">
              Booking, intake, reminders, and session notes. All automated.
              You do what you do best: help clients feel better.
            </p>
            <div className="bm-home-hero__ctas">
              <Link to="/signup" className="bm-home-hero__cta-primary">
                Start free →
              </Link>
              <a
                href="/bodymapdemopractice?name=Sarah+Mitchell&email=sarah.demo@bodymap.test"
                className="bm-home-hero__cta-secondary"
              >
                See How It Works
              </a>
            </div>
            <div className="bm-home-hero__trust">
              {["Free during beta", "Live in 30 seconds", "No credit card"].map(
                (t) => (
                  <span key={t}>
                    <span className="bm-home-hero__check">✓</span> {t}
                  </span>
                )
              )}
            </div>
          </div>
          <div className="bm-home-hero__photo">
            <img
              src="/images/hero-home.jpg"
              alt="A calm moment in a massage therapist's practice"
            />
          </div>
        </div>
      </section>

      {/* ── SWITCHER BAND: empathetic CTA for therapists frustrated with current platform ── */}
      <section className="bm-home-switcher">
        <div className="bm-home-switcher__inner">
          <div className="bm-home-switcher__copy">
            <div className="bm-home-switcher__eyebrow">Already paying $20-99 a month somewhere else?</div>
            <h2 className="bm-home-switcher__title">
              Coming from MassageBook, Vagaro, or somewhere else?
            </h2>
            <p className="bm-home-switcher__body">
              Bring your client list, your booking link, your standards. Up and running in 2 minutes. No card to start.
            </p>
          </div>
          <Link to="/signup" className="bm-home-switcher__cta">
            Start your switch →
          </Link>
        </div>
      </section>

      {/* ── LIFESTYLE MOMENT 1: settling-in band between hero and product ── */}
      <section className="bm-home-band">
        <p className="bm-home-band__quote">
          "After 20 years, I finally stopped juggling spreadsheets and paperwork."
        </p>
        <p className="bm-home-band__attr">A massage therapist, 20 years in practice</p>
      </section>

      {/* ── PRODUCT TOUR INTRO ───────────────────────────────────────── */}
      <section className="bm-home-tour-intro">
        <div className="bm-home-tour-intro__inner">
          <div className="bm-home-tour-intro__eyebrow">The product tour</div>
          <h2 className="bm-home-tour-intro__title">
            Seven parts of your practice. <em>One quiet platform.</em>
          </h2>
          <p className="bm-home-tour-intro__sub">
            Tap any demo below to try the actual product. From the body map
            intake your clients fill out before they arrive, to the platform
            that chats with your client history, to the schedule and billing on
            your phone. No screenshots. The real thing.
          </p>
        </div>
      </section>

      {/* ── 7 PRODUCT RIBBONS ────────────────────────────────────────── */}
      <main className="bm-home-ribbons">
        {RIBBONS.map((ribbon) => (
          <HomeRibbon key={ribbon.id} ribbon={ribbon} isMobile={isMobile} />
        ))}
      </main>

      {/* ── LIFESTYLE MOMENT 2: exhale before CTA ─────────────────────── */}
      <section className="bm-home-band bm-home-band--exhale">
        <p className="bm-home-band__quote">
          "I can finally sit at the end of a day and breathe instead of
          opening my laptop."
        </p>
        <p className="bm-home-band__attr">A solo LMT, 7 years in practice</p>
      </section>

      {/* ── CLOSING CTA ──────────────────────────────────────────────── */}
      <section className="bm-home-closing">
        <h2>
          Free during beta. <em>Forever, if you join now.</em>
        </h2>
        <p>
          Early therapists keep Silver tier free for life.
          Message us on Instagram or Facebook to ask about a discount code.
        </p>
        <div className="bm-home-closing__ctas">
          <Link to="/signup" className="bm-home-closing__cta-primary">
            Start free →
          </Link>
          <Link to="/pricing" className="bm-home-closing__cta-secondary">
            See pricing
          </Link>
        </div>
      </section>

      <Footer />
      <HelpWidget />
    </div>
  );
}
// Layouts:
//   "demo-left"   : demo 60% left, copy 40% right (desktop) / stacked (mobile)
//   "demo-right"  : demo 60% right, copy 40% left (desktop) / stacked (mobile)
//   "demo-stacked": demo full-width, copy below (both viewports)
// ───────────────────────────────────────────────────────────────────────
function HomeRibbon({ ribbon, isMobile }) {
  const [activeDemoIdx, setActiveDemoIdx] = useState(0);
  const hasMultipleDemos = ribbon.demos.length > 1;
  const layoutClass = isMobile ? "demo-stacked" : ribbon.layout;
  const activeDemo = ribbon.demos[activeDemoIdx];

  return (
    <section
      className={`bm-home-ribbon bm-home-ribbon--${layoutClass}${
        ribbon.featured ? " bm-home-ribbon--featured" : ""
      }`}
      id={`home-ribbon-${ribbon.id}`}
    >
      {ribbon.featured && (
        <div className="bm-home-ribbon__moat">★ The moat</div>
      )}
      <div className="bm-home-ribbon__inner">
        {/* Copy / sub-feature column */}
        <div className="bm-home-ribbon__copy">
          <div className="bm-home-ribbon__num">{ribbon.id}</div>
          {ribbon.headline ? (
            <>
              <div className="bm-home-ribbon__cat">{ribbon.name}</div>
              <h3 className="bm-home-ribbon__title bm-home-ribbon__title--featured">
                {ribbon.headline}
              </h3>
            </>
          ) : (
            <h3 className="bm-home-ribbon__title">{ribbon.name}</h3>
          )}
          <p className="bm-home-ribbon__tag">{ribbon.tagline}</p>
          <ul className="bm-home-ribbon__list">
            {ribbon.subFeatures.map((feat, i) => (
              <li key={i}>
                <span className="bm-home-ribbon__bullet">·</span>
                {feat}
              </li>
            ))}
          </ul>
          <Link
            to={`/features#ribbon-${ribbon.id}`}
            className="bm-home-ribbon__more"
          >
            See all {ribbon.cta} →
          </Link>
        </div>

        {/* Demo column */}
        <div className="bm-home-ribbon__demo">
          {hasMultipleDemos && (
            <div className="bm-home-ribbon__demo-tabs">
              {ribbon.demos.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  className={`bm-home-ribbon__demo-tab${
                    i === activeDemoIdx ? " is-active" : ""
                  }`}
                  onClick={() => setActiveDemoIdx(i)}
                >
                  {d.label}
                </button>
              ))}
              <span className="bm-home-ribbon__demo-counter">
                {activeDemoIdx + 1} of {ribbon.demos.length}
              </span>
            </div>
          )}
          <div className="bm-home-ribbon__demo-frame">
            <activeDemo.component />
          </div>
        </div>
      </div>
    </section>
  );
}
