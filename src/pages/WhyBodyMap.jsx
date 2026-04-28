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
//   Body-chart annotation only on PAID Premium SOAP plan. No AI features.
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
// 2. AI chat with full client data ("ask anything about Sarah's history")
// 3. Longitudinal pattern intelligence across all sessions, automated
// 4. AI pre-session brief auto-generated 2 min before each session
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
// ───────────────────────────────────────────────────────────────────────
const ONLY_MBM = [
  {
    id: "body-map-intake",
    title: "Visual body map intake, on the client's phone",
    body:
      "Your client taps where it hurts on a body diagram before walking in. You start the session already knowing where to focus.",
    proof:
      "MassageBook's body-chart annotation is locked behind their paid Premium SOAP plan, and it is for therapist notes after the session, not client intake. Vagaro, GlossGenius, Acuity, and ClinicSense use plain text intake forms only.",
    photoId: "2.1",
  },
  {
    id: "ai-chat",
    title: "AI chat with your full client history",
    body:
      'Ask anything. <em>"Which clients haven\'t booked in 60 days?"</em> Answers in seconds, trained only on your practice.',
    proof:
      "Noterro has AI for voice-to-chart documentation. None of the other booking platforms (MassageBook, Vagaro, GlossGenius, Acuity, ClinicSense, Jane, SimplePractice) offer a clinical AI chat over your full client history. SimplePractice charges $35/mo extra for AI notes alone.",
    photoId: "3.3",
  },
  {
    id: "longitudinal",
    title: "Longitudinal pattern intelligence",
    body:
      "Every body area a client has flagged, layered into one visual. Spot the pattern in their right shoulder without scrolling through twelve notes.",
    proof:
      "No competitor offers a longitudinal heatmap view across all sessions. SOAP notes everywhere are stored chronologically and searched one-at-a-time. Pattern recognition across visits is not in their product set as of April 2026.",
    photoId: "3.1",
  },
  {
    id: "pre-session",
    title: "AI pre-session brief, two minutes before they arrive",
    body:
      "Who's coming. Where they've been hurting. What worked last time. The brief a great manager would send, except it never forgets.",
    proof:
      "No mainstream massage platform automatically generates a pre-session AI brief. MassageBook lets you review intake forms before the session, but you have to open them yourself, and they are static text.",
    photoId: "4.2",
  },
  {
    id: "free-tier",
    title: "All of it, free during beta",
    body:
      "Bronze is free. Body map, AI chat, reminders, SOAP notes, billing, intake. Free forever for anyone who joins now.",
    proof:
      "Solo therapists currently pay $20-70/month for partial versions of these tools across MassageBook, Vagaro, GlossGenius, Acuity, ClinicSense, and Noterro. Most charge extra for SOAP, marketing, or text reminders on top of the base plan.",
    photoId: "1.1",
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
    note: "Strong clinical tools but priced for multi-disciplinary clinics, not solo LMTs.",
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
    note: "AI voice-to-chart for SOAP notes. Limited retention/marketing automation.",
  },
  {
    name: "MyBodyMap Bronze",
    price: "Free",
    note: "Everything above plus visual body map, AI chat, longitudinal patterns. Free during beta.",
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
            What solo therapists are paying <em>this month.</em>
          </h2>
          <p className="bm-why-v2-cost__sub">
            Pricing pulled directly from each platform's published pricing as of
            April 2026. Add-on costs are noted where they meaningfully change
            the picture for a solo LMT.
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
          Advice cross-referenced for solo-LMT real-world cost.
        </p>
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
