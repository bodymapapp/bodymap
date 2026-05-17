// src/pages/Playbooks.jsx
//
// Public-facing index page for the MyBodyMap therapist playbooks.
// Each playbook is a long-form guide synthesized from industry best
// practices, written for practicing solo massage therapists.
//
// HK directive May 16 2026: "When we develop strategies and articles
// like BILLING_RULES + LIFETIME_JOURNEY, should we add a page on our
// website for research or something that is more name relevant for
// therapists? It may drive traffic. It will also help me find this
// research quickly and I think it is beneficial for broader public."
//
// Why "Playbooks" not "Research" or "Articles":
//   - Reads as "things you can do," which is the framing of these
//     docs. Therapists want guidance, not academic theory.
//   - Tells the visitor in one word that they'll get actionable
//     practice patterns, not a literature review.
//   - Distinguishes from ABMP/AMTA whose content libraries are
//     dense and technical; ours are practical.

import React from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

const C = {
  forestDeep: "#1F4030",
  forest: "#2A5741",
  sage: "#6B9E80",
  sageSoft: "#A8C8B0",
  sagePale: "#E8F0E9",
  cream: "#FBFAF4",
  creamDeep: "#F2EFE4",
  gold: "#C9A84C",
  ink: "#1F2937",
  inkSoft: "#6B7280",
  inkFade: "#9CA3AF",
};

// A single playbook entry. Add new entries here as we publish them.
// Each entry maps to an existing HTML doc in /public/docs/.
const PLAYBOOKS = [
  {
    id: "money-decisions",
    title: "Money",
    subtitle: "How money decisions work in a solo practice",
    eyebrow: "Cancellations, no-shows, reschedules, refunds",
    blurb:
      "The situations every therapist runs into and rarely talks about openly. A working framework for cancellation policy, no-show recovery, refund timing, and the choice screens that make every money decision feel fair to both parties.",
    sources:
      "Synthesized from ABMP affiliate templates, ClinicSense's bulletproof policy guide, MassageBook, Noterro, AMTA, Massage Magazine, and forum discussions among practicing solo therapists.",
    href: "/docs/BILLING_RULES.html",
    readTime: "12 minute read",
    badge: "Most popular",
  },
  {
    id: "client-lifetime-journey",
    title: "Journey",
    subtitle: "The client relationship from first contact to lifelong client",
    eyebrow: "Reminders, check-ins, win-backs, the messages that keep clients loyal",
    blurb:
      "Every meaningful moment in a client's relationship with a solo therapist, plotted in time. The check-ins, the reminders, the apologies, the gentle nudges. A working playbook for the messages that turn first-time clients into lifelong regulars.",
    sources:
      "Synthesized from ABMP's '3 Keys to Rebook' framework, ClinicSense retention research, Vagaro's 10 retention strategies, Massage Warehouse's ultimate rebook guide, Massage Magazine, and Noterro's client-relationship guides.",
    href: "/docs/CLIENT_LIFETIME_JOURNEY.html",
    readTime: "15 minute read",
    badge: null,
  },
  {
    id: "notifications-architecture",
    title: "Notifications",
    subtitle: "How to build the notification engine without losing your mind",
    eyebrow: "Engineering playbook · build once, extend forever",
    blurb:
      "A practical architecture for the notification system behind a platform like MyBodyMap. Designed to be built once, deployed quickly, and extended without ceremony. The companion playbook to Money and Journey, for the founder anxious about how many moving parts notifications appear to have.",
    sources:
      "Lessons from notification systems at scale: shop-bought systems (Twilio, Resend, Postmark), event-driven architectures, and the test pyramid as it applies to messaging infrastructure.",
    href: "/docs/NOTIFICATIONS_ARCHITECTURE.html",
    readTime: "10 minute read",
    badge: "Engineering",
  },
];

export default function Playbooks() {
  return (
    <div style={{ background: C.cream, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: C.ink }}>
      <Nav />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 80px" }}>
        {/* Hero */}
        <header style={{ marginBottom: 56 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.sage,
            marginBottom: 14,
          }}>
            ★ Free for any practicing therapist
          </div>
          <h1 style={{
            fontFamily: "Georgia, serif",
            fontWeight: 400,
            fontSize: "clamp(34px, 5vw, 52px)",
            color: C.forestDeep,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            margin: "0 0 18px",
            maxWidth: 800,
          }}>
            Playbooks for solo massage therapists
          </h1>
          <p style={{
            fontSize: 17,
            lineHeight: 1.7,
            color: C.inkSoft,
            maxWidth: 720,
            margin: 0,
          }}>
            Plain-language guides synthesized from what tens of thousands of working therapists have learned about running a sustainable solo practice. The cancellation conversations, the rebook moments, the rate increases, the awkward emails nobody teaches in school.
          </p>
          <p style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: C.inkFade,
            maxWidth: 720,
            margin: "16px 0 0",
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
          }}>
            Written for working therapists. Free to read, free to share, free to use in your own practice.
          </p>
        </header>

        {/* Playbook cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 24,
          marginBottom: 56,
        }}>
          {PLAYBOOKS.map((p) => (
            <PlaybookCard key={p.id} playbook={p} />
          ))}
        </div>

        {/* About the playbooks */}
        <section style={{
          background: "#fff",
          border: `1px solid ${C.creamDeep}`,
          borderRadius: 16,
          padding: "32px 36px",
          marginBottom: 32,
        }}>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontWeight: 400,
            fontSize: 24,
            color: C.forestDeep,
            margin: "0 0 14px",
            letterSpacing: "-0.01em",
          }}>
            What you'll find in these guides
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: C.ink, margin: "0 0 12px" }}>
            Each playbook starts with a clear principle, then walks through the situations that principle covers. Plain English, no platform speak. Where we cite a number ("about 1 in 7 clients miss without a reminder"), the source is named.
          </p>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: C.ink, margin: "0 0 12px" }}>
            These guides exist because solo therapists rarely have the time or framework to study practice management at this depth. ABMP and AMTA publish excellent technical material, but most working therapists need shorter, more practical reading. We try to fill that gap.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: C.inkSoft, margin: 0, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
            Have a topic you want us to cover? Email <a href="mailto:hello@mybodymap.app" style={{ color: C.forest }}>hello@mybodymap.app</a> with the title of the playbook you wish existed.
          </p>
        </section>

        {/* CTA to product */}
        <div style={{
          background: `linear-gradient(135deg, ${C.forestDeep} 0%, ${C.forest} 100%)`,
          borderRadius: 16,
          padding: "36px 40px",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "flex-start",
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.sageSoft,
          }}>
            Want to put these into practice?
          </div>
          <h3 style={{
            fontFamily: "Georgia, serif",
            fontWeight: 400,
            fontSize: 26,
            margin: 0,
            letterSpacing: "-0.012em",
            lineHeight: 1.2,
          }}>
            MyBodyMap is the practice management platform built around these playbooks.
          </h3>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "rgba(255,255,255,0.85)", margin: 0, maxWidth: 700 }}>
            Every situation, every notification, every choice screen in these guides comes pre-wired in the product. You bring the practice; we bring the playbook.
          </p>
          <Link to="/features" style={{
            display: "inline-block",
            background: "#fff",
            color: C.forestDeep,
            fontSize: 14,
            fontWeight: 700,
            padding: "12px 24px",
            borderRadius: 999,
            textDecoration: "none",
            marginTop: 4,
          }}>
            See the features →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function PlaybookCard({ playbook }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <a
      href={playbook.href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        background: "#fff",
        border: `1px solid ${hovered ? C.sageSoft : C.creamDeep}`,
        borderRadius: 16,
        padding: "32px 32px 28px",
        textDecoration: "none",
        color: "inherit",
        boxShadow: hovered ? "0 14px 36px rgba(42, 87, 65, 0.10)" : "0 4px 14px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {playbook.badge && (
        <div style={{
          position: "absolute",
          top: 18,
          right: 18,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: C.gold,
          background: "#FCF4DD",
          border: "1px solid #E8D17D",
          borderRadius: 999,
          padding: "3px 10px",
        }}>
          ★ {playbook.badge}
        </div>
      )}

      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: C.sage,
        marginBottom: 10,
      }}>
        {playbook.eyebrow}
      </div>

      <h3 style={{
        fontFamily: "Georgia, serif",
        fontWeight: 400,
        fontSize: 64,
        color: C.forestDeep,
        margin: "0 0 6px",
        letterSpacing: "-0.03em",
        lineHeight: 1,
      }}>
        {playbook.title}.
      </h3>

      <div style={{
        fontSize: 15,
        fontWeight: 600,
        color: C.forest,
        margin: "0 0 16px",
        fontFamily: "Georgia, serif",
        fontStyle: "italic",
        lineHeight: 1.4,
      }}>
        {playbook.subtitle}
      </div>

      <p style={{ fontSize: 14.5, lineHeight: 1.65, color: C.ink, margin: "0 0 18px" }}>
        {playbook.blurb}
      </p>

      <div style={{
        fontSize: 12,
        lineHeight: 1.55,
        color: C.inkFade,
        fontStyle: "italic",
        fontFamily: "Georgia, serif",
        paddingTop: 16,
        borderTop: `1px dashed ${C.creamDeep}`,
        marginBottom: 16,
      }}>
        {playbook.sources}
      </div>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
          {playbook.readTime}
        </span>
        <span style={{
          fontSize: 13,
          color: hovered ? C.forestDeep : C.forest,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}>
          Read the playbook →
        </span>
      </div>
    </a>
  );
}
