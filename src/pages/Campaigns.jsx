// src/pages/Campaigns.jsx
//
// Standalone landing page at /campaigns. Linkable asset for outreach
// (FB threads, DMs to leads asking about MassageBook campaign emails).
//
// Page structure, mobile-first:
//   1. Hero: eyebrow, headline, sub, primary CTA
//   2. Video embed slot: Supademo demo or MP4 fallback
//   3. The case: 3 short proof cards
//   4. AI starter explainer: 8 categories
//   5. Token list: visible proof of personalization
//   6. CTA: free Silver year for first 100 founders
//
// Uses standard Nav + Footer for site consistency. Inline styles for
// the page itself so we don't fight cross-file CSS.

import React from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

const C = {
  cream: "#FAF6EE",
  beige: "#F5F0E8",
  forest: "#2A5741",
  forestInk: "#1F3A2C",
  sage: "#7A9C84",
  gold: "#B0902F",
  ink: "#1F3A2C",
  inkSoft: "#4B5563",
  inkSofter: "#6B7280",
  border: "rgba(31,58,44,0.10)",
};

// Update this constant when the Supademo URL is published, or replace
// the embed block below with a CapCut-exported MP4. The component
// renders a placeholder when DEMO_EMBED_URL is empty.
const DEMO_EMBED_URL = "";   // e.g. "https://app.supademo.com/embed/<id>"
const DEMO_MP4_URL = "";     // e.g. "/videos/campaigns-demo.mp4"

const PROOF_CARDS = [
  {
    eyebrow: "Personalization",
    title: "Every recipient sees their own first name",
    body: "MassageBook publicly admits this works in automated emails but not campaign emails. We do both. Your subject line and body can use first name, last name, last visit date, last service, and your booking link. Every recipient gets their own version.",
  },
  {
    eyebrow: "AI starter",
    title: "Eight one-tap drafts in your voice",
    body: "Pick Mother's Day special, vacation closure, new service launch, special offer, holiday hours, weather closure, anniversary, or reactivate-lapsed. Add any specifics you want mentioned. Get a finished draft you can edit and send in 30 seconds.",
  },
  {
    eyebrow: "Smart targeting",
    title: "Send to the right people, not everyone",
    body: "Pick lapsed clients, regulars, never-rebooked, or build a custom filter. Each segment is calculated live from your real session data. Unsubscribed clients are skipped automatically.",
  },
];

const TOKENS = [
  { token: "{first_name}",   means: "the client's first name" },
  { token: "{last_name}",    means: "the client's last name" },
  { token: "{business}",     means: "your business name" },
  { token: "{therapist}",    means: "your first name" },
  { token: "{last_visit}",   means: "their last visit date, like 'Mar 12'" },
  { token: "{last_service}", means: "their last service, like 'Deep Tissue'" },
  { token: "{link}",         means: "your booking link" },
];

const STARTERS = [
  { emoji: "💐", label: "Mother's Day special" },
  { emoji: "🏖️", label: "Vacation closure" },
  { emoji: "✨", label: "New service launch" },
  { emoji: "🎁", label: "Special offer" },
  { emoji: "🗓️", label: "Holiday hours" },
  { emoji: "❄️", label: "Weather closure" },
  { emoji: "🎉", label: "Anniversary" },
  { emoji: "🌿", label: "Reactivate lapsed" },
];

export default function Campaigns() {
  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <Nav />

      {/* Hero */}
      <header style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "60px 24px 40px",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.gold,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          marginBottom: 12,
        }}>Campaign emails</div>
        <h1 style={{
          fontFamily: "Georgia, 'Iowan Old Style', serif",
          fontSize: "clamp(32px, 6vw, 52px)",
          fontWeight: 700,
          lineHeight: 1.15,
          color: C.forestInk,
          margin: "0 0 18px",
          letterSpacing: "-0.02em",
        }}>
          Send a personal note to <em style={{ color: C.gold, fontStyle: "italic" }}>every client at once.</em>
        </h1>
        <p style={{
          fontSize: 17,
          lineHeight: 1.6,
          color: C.inkSoft,
          maxWidth: 640,
          margin: "0 auto 28px",
        }}>
          One message. Each client sees their own name, their last visit, their last service. Pick a segment, draft with AI in your voice, send in under a minute.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/signup" style={{
            background: C.forest,
            color: "#fff",
            textDecoration: "none",
            padding: "14px 28px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 15,
            boxShadow: "0 4px 14px rgba(42,87,65,0.25)",
          }}>
            Start free
          </Link>
          <Link to="/features" style={{
            background: "#fff",
            color: C.forest,
            textDecoration: "none",
            padding: "14px 28px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 15,
            border: `1.5px solid ${C.border}`,
          }}>
            See all features
          </Link>
        </div>
      </header>

      {/* Demo embed slot */}
      <section style={{
        maxWidth: 1040,
        margin: "0 auto 60px",
        padding: "0 24px",
      }}>
        <div style={{
          background: "#fff",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(31,58,44,0.10)",
          border: `1px solid ${C.border}`,
          aspectRatio: "16/10",
          position: "relative",
        }}>
          {DEMO_EMBED_URL ? (
            <iframe
              src={DEMO_EMBED_URL}
              title="Campaign emails demo"
              loading="lazy"
              allow="autoplay; fullscreen"
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : DEMO_MP4_URL ? (
            <video
              src={DEMO_MP4_URL}
              controls
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${C.beige} 0%, ${C.cream} 100%)`,
              color: C.inkSofter,
              gap: 14,
              padding: 24,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 44, opacity: 0.55 }}>🎬</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: C.forestInk }}>
                Demo coming this week
              </div>
              <div style={{ fontSize: 14, maxWidth: 380, lineHeight: 1.6 }}>
                A short walkthrough of the campaign builder, AI starter, and personalized send. Sign up to try it on your own client list.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Three proof cards */}
      <section style={{
        maxWidth: 1040,
        margin: "0 auto",
        padding: "20px 24px 60px",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}>
          {PROOF_CARDS.map((card) => (
            <div key={card.title} style={{
              background: "#fff",
              borderRadius: 16,
              padding: "26px 24px",
              border: `1px solid ${C.border}`,
              boxShadow: "0 2px 8px rgba(31,58,44,0.04)",
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.gold,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: 10,
              }}>{card.eyebrow}</div>
              <h3 style={{
                fontFamily: "Georgia, serif",
                fontSize: 20,
                fontWeight: 700,
                color: C.forestInk,
                margin: "0 0 12px",
                lineHeight: 1.3,
              }}>{card.title}</h3>
              <p style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: C.inkSoft,
                margin: 0,
              }}>{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI starters */}
      <section style={{
        background: "#fff",
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "60px 24px",
      }}>
        <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.gold,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 10,
          }}>One-tap drafts</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(28px, 4vw, 36px)",
            fontWeight: 700,
            color: C.forestInk,
            margin: "0 0 14px",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}>Eight starter prompts. Drafted in your voice.</h2>
          <p style={{
            fontSize: 15,
            color: C.inkSoft,
            maxWidth: 540,
            margin: "0 auto 32px",
            lineHeight: 1.6,
          }}>
            Pick a topic, optionally add a few details (closure dates, discount amount, new service name). Get a complete draft in seconds. Edit before sending.
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            maxWidth: 800,
            margin: "0 auto",
          }}>
            {STARTERS.map((s) => (
              <div key={s.label} style={{
                background: C.cream,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "16px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>{s.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.forestInk, textAlign: "left" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tokens */}
      <section style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "60px 24px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.gold,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 10,
          }}>Personalization tokens</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(28px, 4vw, 36px)",
            fontWeight: 700,
            color: C.forestInk,
            margin: "0 0 14px",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}>Real personalization, not just <em style={{ color: C.gold, fontStyle: "italic" }}>"Hi friend."</em></h2>
          <p style={{
            fontSize: 15,
            color: C.inkSoft,
            margin: "0 auto",
            lineHeight: 1.6,
          }}>
            Tap a token to insert it. Each recipient sees their own values.
          </p>
        </div>
        <div style={{
          background: "#fff",
          borderRadius: 14,
          padding: 6,
          border: `1px solid ${C.border}`,
        }}>
          {TOKENS.map((t, i) => (
            <div key={t.token} style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 18px",
              borderBottom: i < TOKENS.length - 1 ? `1px solid ${C.border}` : "none",
            }}>
              <code style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13,
                color: C.forest,
                background: C.cream,
                padding: "5px 10px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                flexShrink: 0,
                fontWeight: 600,
              }}>{t.token}</code>
              <span style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.5 }}>
                {t.means}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        maxWidth: 760,
        margin: "0 auto 80px",
        padding: "0 24px",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.forest} 0%, #1F3A2C 100%)`,
          color: "#fff",
          borderRadius: 20,
          padding: "44px 32px",
          textAlign: "center",
          boxShadow: "0 16px 50px rgba(42,87,65,0.30)",
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#FBF4DC",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 12,
          }}>Free for the first 100 founders</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(26px, 4vw, 34px)",
            fontWeight: 700,
            margin: "0 0 16px",
            lineHeight: 1.25,
          }}>Try it on your own client list.</h2>
          <p style={{
            fontSize: 15,
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.85)",
            margin: "0 auto 26px",
            maxWidth: 480,
          }}>
            No credit card. Import your client list, send your first campaign in under five minutes. Free forever for the first 100 therapists.
          </p>
          <Link to="/signup" style={{
            display: "inline-block",
            background: "#fff",
            color: C.forest,
            textDecoration: "none",
            padding: "14px 32px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 15,
          }}>
            Start free
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
