// src/pages/WhyBodyMap.jsx
//
// WhyBodyMap — editorial rebuild matching FeaturesV2 design language.
//
// Core thesis (HK direction):
// Therapists do not want more time back to do more massages. They want PEACE OF MIND.
// They want to charge what they are worth, give to clients, automate without worry.
// So this page reframes everything around what therapists STOP WORRYING ABOUT.
//
// Competitor claims rebuilt from verified research (April 2026):
// - MassageBook ($20/mo basic): has SOAP notes, intake forms, marketing.
//   Body-chart annotation only on PAID Premium SOAP plan. No Platform features.
// - Vagaro ($30/mo + add-ons, real cost ~$50-70): basic plain-text SOAP,
//   custom intake forms, salon-first interface. No body chart. No AI.
// - GlossGenius ($24/mo Standard, $48 Gold): no SOAP notes at all,
//   beauty-first design, intake forms only on Gold tier. No AI clinical chat.
// - Acuity ($20-49/mo): generic scheduling, basic text-form SOAP, custom
//   intake forms, originally built for a massage therapist. No AI. No body chart.
// - ClinicSense ($39-69/mo): SOAP-first, no AI, no body chart documented.
// - Noterro (~$33/mo): AI Scribe (voice-to-chart), but no client-side
//   visual intake, no automated retention.
//
// VERIFIED unique to MyBodyMap (no competitor has all of these):
// 1. Visual body map for CLIENT-SIDE intake (clients tap on a body diagram)
// 2. Platform chat with full client data ("ask anything about Sarah's history")
// 3. Longitudinal pattern intelligence across all sessions, automated
// 4. pre-session brief auto-generated 2 min before each session
// 5. Free tier (Bronze) with ALL of the above included.

import React, { useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { photoForId } from "../data/featuresData";

// ───────────────────────────────────────────────────────────────────────
// PEACE-OF-MIND blocks (replaces "Time back in your hands")
// HK insight: therapists want peace of mind, not more sessions.
// Each card is a question they ASK themselves today, with the platform's answer.
// ───────────────────────────────────────────────────────────────────────
const PEACE_BLOCKS = [
  {
    worry: "Did Sarah confirm tomorrow?",
    answer: "Reminders fired. She replied yes. You see it on your morning brief.",
    photoId: "5.1",
    automated: true,
  },
  {
    worry: "What did we work on last time?",
    answer:
      "Her body map opens with last session's tension areas already mapped. The session before that is one tap away.",
    photoId: "3.2",
    automated: true,
  },
  {
    worry: "Should I raise my rates this year?",
    answer:
      "Revenue intelligence shows your bookings hit 87% capacity for 6 weeks. The number says yes. The question becomes when.",
    photoId: "6.1",
    automated: true,
  },
  {
    worry: "Is anyone drifting away from me?",
    answer:
      "The platform flagged three clients who used to come monthly. You sent the gentle nudge from your phone in 30 seconds.",
    photoId: "5.3",
    automated: true,
  },
];

// ───────────────────────────────────────────────────────────────────────
// What only MyBodyMap does — verified differentiators
// Each one is researched and defensible against MassageBook, Vagaro,
// GlossGenius, Acuity, ClinicSense, Noterro, Jane (April 2026).
// Order is intentional: most differentiating first.
// ───────────────────────────────────────────────────────────────────────
const ONLY_MBM = [
  {
    id: "cycle-scheduling",
    title: "Cycle-aligned scheduling, the first ever",
    body:
      "Tag services to phases of your menstrual cycle. The booking page automatically shows clients only what fits this week. Your body, your business, both honored.",
    proof:
      "No competitor offers cycle-aligned scheduling. Acuity, Vagaro, MassageBook, GlossGenius, Jane App, ClinicSense, Square Appointments: all treat every week the same. We treat them differently because your body does.",
    photoId: "1.2",
  },
  {
    id: "smart-scheduling",
    title: "Smart Scheduling that packs your day",
    body:
      "Tired of three clients booking 9am, 12pm, and 4pm leaving you with two unusable two-hour gaps? Turn on Smart Scheduling and the booking page packs new bookings tight against the ones you already have. Two strictness levels, your call.",
    proof:
      "Acuity, Vagaro, Fresha, MassageBook, GlossGenius, Jane App: all give every client the full slot grid regardless of how it shreds your day. We are the only platform that lets you choose between client flexibility and your own daily rhythm.",
    photoId: "1.9",
  },
  {
    id: "body-map-intake",
    title: "Visual body map intake, on the client's phone",
    body:
      "Your client taps where it hurts on a body diagram before walking in. You start the session already knowing where to focus, and we keep the data to spot patterns over time.",
    proof:
      "MassageBook's body-chart annotation is locked behind their paid Premium SOAP plan, and it is for therapist notes after the session, not client intake. Vagaro, GlossGenius, Acuity, and ClinicSense use plain text intake forms only.",
    photoId: "2.1",
  },
  {
    id: "stripe-square-parity",
    title: "Stripe AND Square, both fully supported",
    body:
      "Connect whichever you already use. Or both. Online deposits, card on file, refunds, memberships, packages, gift cards: everything works equally well on both processors. No lock-in, no markup.",
    proof:
      "Vagaro, GlossGenius, MassageBook, and Acuity all push their own merchant relationship with proprietary fees on top. Square Appointments only works with Square. We are the only platform where you get to keep the processor relationship you already have.",
    photoId: "6.5",
  },
  {
    id: "cancellation-policy",
    title: "Cancellation policy that actually charges",
    body:
      "Set the rules once, like hotels and airlines. Client cancels late or no-shows? The card on file gets charged automatically. You do nothing. The mandate they signed at booking holds up against disputes.",
    proof:
      "Acuity, Square Appointments, and most others let you write a cancellation policy in plain text on your booking page, but they do not actually charge. You have to chase the client manually. We charge automatically with a signed audit trail.",
    photoId: "6.2",
  },
  {
    id: "practice-assistant",
    title: "Practice Assistant with your full client history",
    body:
      "Ask anything in plain English. \"Which clients haven't booked in 60 days?\" \"Draft a re-engagement message to my Tuesday morning regulars.\" Answers in seconds, trained only on your practice, never shared across therapists.",
    proof:
      "Noterro has voice-to-chart documentation. None of the other booking platforms (MassageBook, Vagaro, GlossGenius, Acuity, ClinicSense, Jane, SimplePractice) offer a Platform-style chat over your full client history. SimplePractice charges $35/mo extra for AI notes alone.",
    photoId: "3.3",
  },
  {
    id: "longitudinal",
    title: "Longitudinal pattern intelligence",
    body:
      "Every body area a client has flagged, layered into one visual heatmap over months and years. Spot the pattern in their right shoulder without scrolling through twelve notes. Insights compound the longer you stay.",
    proof:
      "No competitor offers a longitudinal heatmap view across all sessions. SOAP notes everywhere are stored chronologically and searched one-at-a-time. Pattern recognition across visits is not in their product set as of April 2026.",
    photoId: "3.1",
  },
];

// ───────────────────────────────────────────────────────────────────────
// Honest cost comparison — verified pricing as of April 2026
// All prices verified from official pricing pages or 2026 review articles.
// ───────────────────────────────────────────────────────────────────────
const COST_COMPARISON = [
  {
    name: "GlossGenius Gold",
    price: "$48/mo",
    note: "Intake forms only on Gold tier ($48). No SOAP notes. Beauty-first design.",
  },
  {
    name: "MassageBook",
    price: "$20–40/mo",
    note: "Premium SOAP with body annotation costs extra. AMTA discount available.",
  },
  {
    name: "Jane App",
    price: "$54–99/mo",
    note: "Strong clinical tools but priced for multi-disciplinary clinics, not smaller practices.",
  },
  {
    name: "ClinicSense Standard",
    price: "$69/mo",
    note: "SOAP-first. SMS reminders included on Standard.",
  },
  {
    name: "Vagaro + add-ons",
    price: "$30–70/mo",
    note: "$30 base, but forms and marketing add up. Salon-first interface.",
  },
  {
    name: "Acuity Powerhouse",
    price: "$49/mo",
    note: "Text-form SOAP only. No body chart. Originally built for a massage therapist.",
  },
  {
    name: "Noterro",
    price: "$33/mo",
    note: "voice-to-chart for SOAP notes. Limited retention/marketing automation.",
  },
  {
    name: "MyBodyMap Bronze",
    price: "Free",
    note: "Everything above plus visual body map, Platform chat, longitudinal patterns. Free during beta.",
    highlight: true,
  },
];

export default function WhyBodyMap() {
  const [openItem, setOpenItem] = useState(null);

  return (
    <div className="bm-why-v2">
      <Nav />

      {/* Header */}
      <header className="bm-why-v2-head">
        <div className="bm-why-v2-eyebrow">Why MyBodyMap</div>
        <h1 className="bm-why-v2-title">
          Built for the therapist who wants <em>peace of mind,</em> not another
          tool to manage.
        </h1>
        <p className="bm-why-v2-sub">
          You did not become a therapist to run a back office. MyBodyMap is the
          quiet platform that handles everything between sessions, so you can
          focus on what is on the table.
        </p>
      </header>

      {/* Peace of Mind quadrant */}
      <section className="bm-why-v2-peace">
        <div className="bm-why-v2-peace__intro">
          <p className="bm-why-v2-peace__eyebrow">What you stop worrying about</p>
          <h2 className="bm-why-v2-peace__title">
            The mental load that goes <em>quiet.</em>
          </h2>
        </div>
        <div className="bm-why-v2-peace__grid">
          {PEACE_BLOCKS.map((block, i) => (
            <PeaceCard key={i} block={block} />
          ))}
        </div>
      </section>

      {/* What only MyBodyMap does */}
      <section className="bm-why-v2-only">
        <div className="bm-why-v2-only__intro">
          <p className="bm-why-v2-only__eyebrow">What only MyBodyMap does</p>
          <h2 className="bm-why-v2-only__title">
            The five things you cannot get <em>anywhere else.</em>
          </h2>
          <p className="bm-why-v2-only__sub">
            Every claim below is researched against the current public
            documentation of MassageBook, Vagaro, GlossGenius, Acuity, ClinicSense,
            Noterro, and Jane App, as of April 2026.
          </p>
        </div>
        <div className="bm-why-v2-only__list">
          {ONLY_MBM.map((item) => (
            <OnlyItem
              key={item.id}
              item={item}
              isOpen={openItem === item.id}
              onToggle={() =>
                setOpenItem(openItem === item.id ? null : item.id)
              }
            />
          ))}
        </div>
      </section>

      {/* Cost comparison */}
      <section className="bm-why-v2-cost">
        <div className="bm-why-v2-cost__intro">
          <p className="bm-why-v2-cost__eyebrow">The honest cost picture</p>
          <h2 className="bm-why-v2-cost__title">
            What therapists are paying <em>this month.</em>
          </h2>
          <p className="bm-why-v2-cost__sub">
            Pricing pulled directly from each platform's published pricing as of
            April 2026. Add-on costs are noted where they meaningfully change
            the picture for a working practice.
          </p>
        </div>
        <div className="bm-why-v2-cost__list">
          {COST_COMPARISON.map((item, i) => (
            <CostRow key={i} item={item} />
          ))}
        </div>
        <p className="bm-why-v2-cost__footnote">
          Sources: each platform's official pricing page. Independent reviews
          from MBLEx Guide, ROXO Hub, BusyBook, Pabau, GlossyStack, and Software
          Advice cross-referenced for real-world cost.
        </p>
      </section>

      {/* Switcher CTA: empathetic ask after they have seen the cost comparison */}
      <section className="bm-why-v2-switcher">
        <div className="bm-why-v2-switcher__inner">
          <h2 className="bm-why-v2-switcher__title">Already paying for one of these?</h2>
          <p className="bm-why-v2-switcher__body">
            We import directly from MassageBook, Vagaro, GlossGenius, Mindbody, and Square. Your client list moves over instantly. Up and running in 2 minutes. Bronze stays free forever, so you can run both side by side until you're sure.
          </p>
          <Link to="/signup" className="bm-why-v2-switcher__cta">
            Start free, no card →
          </Link>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bm-why-v2-closing">
        <h2>
          Stop juggling. <em>Start practicing.</em>
        </h2>
        <p>
          Free during beta. No card. No trial countdown. The full platform, on
          your phone, in 90 seconds.
        </p>
        <Link to="/signup" className="bm-why-v2-cta">
          Start free →
        </Link>
      </section>

      <Footer />
    </div>
  );
}

function PeaceCard({ block }) {
  return (
    <article className="bm-peace-card">
      <div
        className="bm-peace-card__photo"
        style={{ backgroundImage: `url(${photoForId(block.photoId)})` }}
      >
        {block.automated && (
          <span className="bm-peace-card__badge">
            <SparkleIcon /> automated
          </span>
        )}
        <div className="bm-peace-card__overlay" />
      </div>
      <div className="bm-peace-card__body">
        <p className="bm-peace-card__worry">"{block.worry}"</p>
        <p className="bm-peace-card__answer">{block.answer}</p>
      </div>
    </article>
  );
}

function OnlyItem({ item, isOpen, onToggle }) {
  return (
    <div className={`bm-only-item${isOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="bm-only-item__head"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div
          className="bm-only-item__thumb"
          style={{ backgroundImage: `url(${photoForId(item.photoId)})` }}
          aria-hidden="true"
        />
        <div className="bm-only-item__title-wrap">
          <h3 className="bm-only-item__title">{item.title}</h3>
          <p
            className="bm-only-item__body"
            dangerouslySetInnerHTML={{ __html: item.body }}
          />
        </div>
        <span className="bm-only-item__plus" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen && (
        <div className="bm-only-item__proof">
          <p className="bm-only-item__proof-label">How we verified this</p>
          <p>{item.proof}</p>
        </div>
      )}
    </div>
  );
}

function CostRow({ item }) {
  return (
    <article
      className={`bm-cost-row${item.highlight ? " is-highlight" : ""}`}
    >
      <div className="bm-cost-row__name">{item.name}</div>
      <div className="bm-cost-row__price">{item.price}</div>
      <div className="bm-cost-row__note">{item.note}</div>
    </article>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 0l1.2 4.8L12 6l-4.8 1.2L6 12l-1.2-4.8L0 6l4.8-1.2z" />
    </svg>
  );
}
