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

// Interactive product demos (extracted from legacy Features.jsx)
import BodyMapDemo from "../components/demos/BodyMapDemo";
import PatternDemo from "../components/demos/PatternDemo";
import ScheduleDemo from "../components/demos/ScheduleDemo";
import BillingDemo from "../components/demos/BillingDemo";
import AIDemo from "../components/demos/AIDemo";
import AutomationHub from "../components/demos/AutomationHub";

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
    demos: [
      // No interactive demo built for booking yet. Use a lifestyle moment
      // until we ship a booking-page mockup.
      { kind: "photo", photoId: "1.1", caption: "Your custom booking page" },
    ],
    layout: "demo-right", // demo on right, copy on left, on desktop
    subFeatures: [
      "Custom booking page at mybodymap.app/your-name",
      "Services catalog with durations and add-ons",
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
    demos: [{ kind: "component", component: BodyMapDemo, label: "Try the body map" }],
    layout: "demo-left", // demo on left, copy on right
    subFeatures: [
      "Visual body map intake (front and back)",
      "Focus zones, avoid areas, pressure preferences",
      "Medical flags & allergies",
      "Signed waivers bundled in, ESIGN compliant",
      "Pre-fills automatically on return",
    ],
    cta: "Know Your Client features",
  },
  {
    id: "3",
    name: "Client Intelligence",
    tagline:
      "Pattern recognition across visits and AI chat with your full client history. The core moat.",
    // TWO demos — Pattern + AI — shown as a carousel with prev/next arrows.
    demos: [
      { kind: "component", component: PatternDemo, label: "Pattern detection" },
      { kind: "component", component: AIDemo, label: "MyBodyMap AI chat" },
    ],
    layout: "demo-stacked",
    subFeatures: [
      "Longitudinal heatmaps across all sessions",
      "MyBodyMap AI: chat with your client data",
      "Pattern detection on body areas trending up",
      "Practice Pulse: daily 6am morning brief",
      "Lapsed client alerts before they drift away",
    ],
    cta: "Client Intelligence features",
  },
  {
    id: "4",
    name: "Day-of-Session",
    tagline: "What the platform does during the hour you are working.",
    demos: [{ kind: "component", component: ScheduleDemo, label: "Today's schedule" }],
    layout: "demo-stacked", // schedule is wide+short, looks best full width
    subFeatures: [
      "Today's schedule with color-coded services",
      "AI pre-session brief, 2 min before each session",
      "Voice-to-text SOAP notes",
      "Quick client lookup by name, phone, or email",
      "Mobile-first UX, every screen thumb-reachable",
    ],
    cta: "Day-of-Session features",
  },
  {
    id: "5",
    name: "Relationships",
    tagline: "Turn first-timers into regulars. Keep regulars coming back.",
    demos: [{ kind: "component", component: AutomationHub, label: "Automation flows" }],
    layout: "demo-stacked",
    subFeatures: [
      "Automated SMS + email reminders",
      "Post-session thank-you with rebook link",
      "Lapsed client outreach, weekly digest",
      "Loyalty rewards punch card",
      "5-dimension feedback aggregated over time",
    ],
    cta: "Relationships features",
  },
  {
    id: "6",
    name: "Money & Protection",
    tagline: "Get paid. Stay protected. Run a real business.",
    demos: [{ kind: "component", component: BillingDemo, label: "Billing dashboard" }],
    layout: "demo-stacked",
    subFeatures: [
      "Revenue dashboard, real-time",
      "Top 10 clients by lifetime spend",
      "Gift cards directly from your booking page",
      "ESIGN-compliant signed waivers, 7-year retention",
      "HIPAA-grade encryption, AES-256",
    ],
    cta: "Money & Protection features",
  },
  {
    id: "7",
    name: "On Your Phone",
    tagline: "The platform lives with you, quietly, everywhere.",
    demos: [{ kind: "photo", photoId: "7.1", caption: "Install to home screen" }],
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
    document.title = "MyBodyMap · Practice on autopilot for solo massage therapists";
  }, []);

  return (
    <div className="bm-home-v2">
      <Nav />

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
            intake your clients fill out before they arrive, to the AI that
            chats with your client history, to the schedule and billing on
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
        <p className="bm-home-band__attr">A founding therapist, 7 years in practice</p>
      </section>

      {/* ── CLOSING CTA ──────────────────────────────────────────────── */}
      <section className="bm-home-closing">
        <h2>
          Free during beta. <em>Forever, if you join now.</em>
        </h2>
        <p>
          The first 100 founding therapists keep Bronze free, forever.
          Silver tier free for 12 months with a founder code.
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
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// HomeRibbon — one product-tour row.
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
      className={`bm-home-ribbon bm-home-ribbon--${layoutClass}`}
      id={`home-ribbon-${ribbon.id}`}
    >
      <div className="bm-home-ribbon__inner">
        {/* Copy / sub-feature column */}
        <div className="bm-home-ribbon__copy">
          <div className="bm-home-ribbon__num">{ribbon.id}</div>
          <h3 className="bm-home-ribbon__title">{ribbon.name}</h3>
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
            {activeDemo.kind === "component" ? (
              <activeDemo.component />
            ) : (
              <DemoPhoto photoId={activeDemo.photoId} caption={activeDemo.caption} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Static photo "demo" — used for ribbons without an interactive demo yet.
function DemoPhoto({ photoId, caption }) {
  const slug = `feature-${photoId.replace(/\./g, "-")}`;
  return (
    <div
      className="bm-home-ribbon__photo"
      style={{ backgroundImage: `url(/images/${slug}.jpg)` }}
    >
      {caption && (
        <div className="bm-home-ribbon__photo-caption">{caption}</div>
      )}
    </div>
  );
}
