// src/pages/Pricing.jsx
//
// Pricing — editorial rebuild matching the FeaturesV2 design language.
// Cream palette + Fraunces serif + Inter body + warm photo per tier.
// Three tiers (Bronze, Silver, Gold). Silver is the highlight.
// BETAONE coupon NOT shown publicly: therapists DM via IG/FB for a founder code.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { useAuth } from "../contexts/AuthContext";
import { photoForId } from "../data/featuresData";

const STRIPE_SILVER_MONTHLY = "https://buy.stripe.com/5kQbJ23kC0eAfVe9vGeQM03";
const STRIPE_SILVER_ANNUAL  = "https://buy.stripe.com/8x214obR89Pa4cw8rCeQM04";

const IG_URL = "https://www.instagram.com/mybodymap01/";
const FB_URL = "https://www.facebook.com/profile.php?id=61568064032135";

function buildTiers({ isAuthenticated, navigate, billingCycle }) {
  const annualMode = billingCycle === "annual";

  return [
    {
      id: "bronze",
      name: "Bronze",
      photo: photoForId("1.1"),
      tagline: "Everything to run your practice. Free during beta.",
      price: { amount: 0, period: "free" },
      futurePrice: 9,
      cta: isAuthenticated ? "Go to Dashboard" : "Start free. No card.",
      ctaAction: () =>
        isAuthenticated ? navigate("/dashboard") : navigate("/signup"),
      features: [
        "Unlimited clients & bookings",
        "Automated booking page · 24/7 client self-serve",
        "Automated body map intake · sent before every session",
        "Automated email reminders · 24h notice, every client",
        "Automated AI pre-session brief · ready before you walk in",
        "Automated AI post-session brief · drafted for you after",
        "MyBodyMap AI · chat with your client data",
        "Visual body map · front & back, focus zones, medical flags",
        "SOAP notes",
        "Schedule · today, weekly, monthly views",
        "Billing dashboard & Stripe payments",
        "Pattern intelligence · first 5 sessions per client",
        "Retention alerts · first 5 sessions per client",
        "Practice snapshot · first 5 sessions per client",
      ],
      footnote: "Will be $9/mo for new signups when beta ends. You stay free, forever.",
    },
    {
      id: "silver",
      name: "Silver",
      highlight: true,
      photo: photoForId("3.3"),
      badge: "Most popular",
      tagline: "Unlimited history. Full pattern intelligence. The full moat.",
      price: annualMode
        ? { amount: 15, period: "/mo · billed annually" }
        : { amount: 19, period: "/mo" },
      cta: "Choose Silver",
      ctaAction: () => {
        window.location.href = annualMode
          ? STRIPE_SILVER_ANNUAL
          : STRIPE_SILVER_MONTHLY;
      },
      features: [
        "Everything in Bronze, fully automated",
        "Full session history · unlimited",
        "Pattern intelligence · all sessions, compounds over time",
        "Retention alerts · catches drifting clients before they leave",
        "Revenue forecasting · projected income from booking pace",
        "Longitudinal body map overlays · tension diff across sessions",
        "Revenue gap intelligence · what empty slots cost you",
        "Business analytics · busiest days, top services, trends",
        "MyBodyMap AI with full history context",
        "Priority support",
      ],
      founderNote:
        "Limited founder codes available. The first 100 therapists get Silver free for 12 months. Message us on Instagram or Facebook and tell us about your practice.",
    },
    {
      id: "gold",
      name: "Gold",
      comingSoon: true,
      photo: photoForId("6.1"),
      tagline: "Everything in Silver, now for your whole team.",
      price: annualMode
        ? { amount: 39, period: "/mo · billed annually" }
        : { amount: 49, period: "/mo" },
      cta: "Coming soon",
      features: [
        "Everything in Silver, automated",
        "Up to 10 therapist profiles",
        "Team schedule view · all therapists, one screen",
        "Per-therapist analytics & billing",
        "Shared client pool",
        "Commission tracking",
        "Staff access controls",
        "Practice-wide reporting",
      ],
    },
  ];
}

const FAQ = [
  {
    q: "Is Bronze really free?",
    a: "Yes. Every tool on this page is free on Bronze during our beta. No credit card, no trial, no hidden limits. Bronze will eventually be $9/mo for new signups, but anyone who joins during beta stays free, forever, and gets grandfathered benefits when pricing starts.",
  },
  {
    q: "How can you afford to offer this for free?",
    a: "Honestly, because technology has changed. The capabilities that used to cost thousands of dollars a month to build now cost a fraction. We built MyBodyMap lean and pass that to you. We make money when you grow into Silver, and that only happens if Bronze genuinely helps you first.",
  },
  {
    q: "What is the intelligence layer in Silver?",
    a: "Silver analyzes your entire client history (tension patterns, retention risk, revenue trends, schedule gaps) and automatically surfaces insights that help you earn more and keep clients longer. It compounds over time. The longer you use MyBodyMap, the smarter it gets.",
  },
  {
    q: 'What does "first 5 sessions" mean on Bronze?',
    a: "On Bronze, you get a taste of intelligence based on the last 5 sessions per client. On Silver, the intelligence goes back through every session you have ever recorded.",
  },
  {
    q: "How do founder codes work?",
    a: "We are looking for the first 100 therapists who genuinely want to help shape MyBodyMap. Message us on Instagram or Facebook with a few words about your practice. If you are a fit, we send you a code that gives you Silver free for 12 months.",
  },
  {
    q: "When is Gold launching?",
    a: "Gold is in development. Sign up for Bronze or Silver now and you get early access and founding pricing when it launches.",
  },
  {
    q: "Can I switch plans anytime?",
    a: "Yes. If you downgrade from Silver to Bronze, your full history is preserved. You just lose access to intelligence beyond 5 sessions until you re-upgrade.",
  },
];

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [openFaq, setOpenFaq] = useState(null);

  const tiers = buildTiers({ isAuthenticated, navigate, billingCycle });

  return (
    <div className="bm-pricing-v2">
      <Nav />

      <header className="bm-pricing-v2-head">
        <div className="bm-pricing-v2-eyebrow">Pricing</div>
        <h1 className="bm-pricing-v2-title">
          Built for therapists who want their <em>practice on autopilot.</em>
        </h1>
        <p className="bm-pricing-v2-sub">
          Free during beta. Honest pricing forever. No platform cut on your
          earnings, no hidden fees, no surprise upgrades.
        </p>

        <div className="bm-pricing-v2-toggle" role="group" aria-label="Billing cycle">
          <button
            type="button"
            className={`bm-pricing-v2-toggle__btn${billingCycle === "monthly" ? " is-active" : ""}`}
            onClick={() => setBillingCycle("monthly")}
            aria-pressed={billingCycle === "monthly"}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`bm-pricing-v2-toggle__btn${billingCycle === "annual" ? " is-active" : ""}`}
            onClick={() => setBillingCycle("annual")}
            aria-pressed={billingCycle === "annual"}
          >
            Annual <span className="bm-pricing-v2-save">save 20%</span>
          </button>
        </div>
      </header>

      <main className="bm-pricing-v2-tiers">
        {tiers.map((tier) => (
          <PricingTier key={tier.id} tier={tier} />
        ))}
      </main>

      <section className="bm-pricing-v2-trust">
        <div className="bm-pricing-v2-trust__row">
          <TrustItem
            label="No platform cut"
            detail="Stripe fees only. We never touch your earnings."
          />
          <TrustItem
            label="Cancel anytime"
            detail="One tap. No retention call. Your data stays yours."
          />
          <TrustItem
            label="Bank-grade encryption"
            detail="Same security as online banking. Only you see your clients."
          />
          <TrustItem
            label="Built for solo LMTs"
            detail="Not for spas. Not for salons. For one therapist, you."
          />
        </div>
      </section>

      <section className="bm-pricing-v2-faq">
        <h2 className="bm-pricing-v2-faq__title">Common questions</h2>
        <div className="bm-pricing-v2-faq__list">
          {FAQ.map((item, i) => (
            <FaqItem
              key={i}
              q={item.q}
              a={item.a}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </section>

      <section className="bm-pricing-v2-closing">
        <h2>
          Try it. Stay forever, or <em>walk away.</em>
        </h2>
        <p>
          Start with Bronze. Free during beta. Move to Silver only when the
          intelligence layer earns its keep.
        </p>
        <a
          href={isAuthenticated ? "/dashboard" : "/signup"}
          className="bm-pricing-v2-cta"
        >
          Start free →
        </a>
      </section>

      <Footer />
    </div>
  );
}

function PricingTier({ tier }) {
  return (
    <article
      className={`bm-tier${tier.highlight ? " is-highlight" : ""}${tier.comingSoon ? " is-soon" : ""}`}
    >
      <div
        className="bm-tier__photo"
        style={{ backgroundImage: `url(${tier.photo})` }}
      >
        {tier.badge && <span className="bm-tier__badge">{tier.badge}</span>}
        {tier.comingSoon && <span className="bm-tier__soon">Coming soon</span>}
        <div className="bm-tier__overlay" />
        <div className="bm-tier__name">{tier.name}</div>
      </div>

      <div className="bm-tier__body">
        <p className="bm-tier__tagline">{tier.tagline}</p>

        <div className="bm-tier__price-block">
          {tier.price.amount === 0 ? (
            <>
              <span className="bm-tier__price-num">Free</span>
              <span className="bm-tier__price-period">during beta</span>
            </>
          ) : (
            <>
              <span className="bm-tier__price-currency">$</span>
              <span className="bm-tier__price-num">{tier.price.amount}</span>
              <span className="bm-tier__price-period">{tier.price.period}</span>
            </>
          )}
        </div>

        {tier.footnote && (
          <p className="bm-tier__footnote">{tier.footnote}</p>
        )}

        {tier.comingSoon ? (
          <button type="button" className="bm-tier__cta is-disabled" disabled>
            {tier.cta}
          </button>
        ) : (
          <button
            type="button"
            className={`bm-tier__cta${tier.highlight ? " is-highlight" : ""}`}
            onClick={tier.ctaAction}
          >
            {tier.cta}
          </button>
        )}

        {tier.founderNote && (
          <div className="bm-tier__founder">
            <p className="bm-tier__founder-note">{tier.founderNote}</p>
            <div className="bm-tier__founder-links">
              <a href={IG_URL} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
              <span aria-hidden="true">·</span>
              <a href={FB_URL} target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            </div>
          </div>
        )}

        <ul className="bm-tier__features">
          {tier.features.map((feat, i) => (
            <li key={i} className="bm-tier__feature">
              <CheckIcon />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function TrustItem({ label, detail }) {
  return (
    <div className="bm-trust">
      <div className="bm-trust__label">{label}</div>
      <div className="bm-trust__detail">{detail}</div>
    </div>
  );
}

function FaqItem({ q, a, isOpen, onToggle }) {
  return (
    <div className={`bm-faq${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="bm-faq__q"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{q}</span>
        <span className="bm-faq__plus" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen && <div className="bm-faq__a">{a}</div>}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="bm-tier__check"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  );
}
