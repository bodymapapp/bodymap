// src/pages/Comparison.jsx
//
// Public comparison of solo-LMT software (MyBodyMap, MassageBook,
// Vagaro, GlossGenius, Acuity, Mindbody, Noterro). Community-
// maintained source-of-truth lives in a Google Sheet; this page
// embeds it read-only and frames the why.
//
// Page is gated from nav until HK approves the sheet. Direct URL
// /comparison works regardless. To switch the embed live, set the
// SHEET_EMBED_URL constant below to the URL from File → Publish to
// web → Embed in Google Sheets.
//
// Tone: humble, honest, community-first. We lead with what we don't
// have. We invite suggestions. The CTA is "help us keep this honest"
// not "see why we're better."

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

// Set this to the published Google Sheet embed URL once HK creates
// and publishes the sheet via File → Publish to web → Embed.
// Until then, the page renders a placeholder card.
const SHEET_EMBED_URL = "";

// Set this to the public sharing URL (not the embed URL) so the
// "Suggest an edit" CTA can link directly to the live document.
const SHEET_PUBLIC_URL = "";

const HONEST_GAPS = [
  { feature: "Insurance billing (CMS-1500 / TELUS)", hasIt: "Noterro" },
  { feature: "Public marketplace for client discovery", hasIt: "MassageBook, Vagaro, Mindbody" },
  { feature: "Multi-staff / team scheduling", hasIt: "All but solo tools" },
  { feature: "Native iOS / Android apps", hasIt: "Noterro, MassageBook, Vagaro, Mindbody" },
  { feature: "Inventory / retail tracking", hasIt: "Vagaro, Mindbody" },
  { feature: "Voice-to-SOAP transcription", hasIt: "Noterro Scribe" },
  { feature: "Recurring appointments (auto-book series)", hasIt: "Most" },
];

const HONEST_WINS = [
  "Visual body map intake, front and back, tap-to-select zones",
  "Longitudinal pattern intelligence (heatmap of recurring complaint areas)",
  "AI pre-session brief drafted in seconds",
  "AI chat over your entire client list",
  "Daily Practice Pulse digest at 6pm",
  "AI campaign starter, eight one-tap drafts in your voice",
  "Per-recipient personalized campaign emails on a free tier",
];

export default function Comparison() {
  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <Nav />

      {/* Hero */}
      <header style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "60px 24px 32px",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.gold,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          marginBottom: 12,
        }}>An honest comparison</div>
        <h1 style={{
          fontFamily: "Georgia, 'Iowan Old Style', serif",
          fontSize: "clamp(30px, 5.5vw, 46px)",
          fontWeight: 700,
          lineHeight: 1.18,
          color: C.forestInk,
          margin: "0 0 18px",
          letterSpacing: "-0.02em",
        }}>
          Massage software, side by side. <em style={{ color: C.gold, fontStyle: "italic" }}>Maintained by therapists.</em>
        </h1>
        <p style={{
          fontSize: 16,
          lineHeight: 1.65,
          color: C.inkSoft,
          maxWidth: 640,
          margin: "0 auto 22px",
        }}>
          MyBodyMap, MassageBook, Vagaro, GlossGenius, Acuity, Mindbody, and Noterro across seven categories. We don't hide what competitors do better. Anyone can suggest a correction.
        </p>
        <div style={{
          display: "inline-flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          background: "rgba(176,144,47,0.10)",
          border: `1px solid rgba(176,144,47,0.25)`,
          borderRadius: 999,
          padding: "8px 16px",
          fontSize: 12.5,
          color: C.gold,
          fontWeight: 600,
        }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span>Last drafted May 2026 · pending community review</span>
        </div>
      </header>

      {/* Honest framing */}
      <section style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "20px 24px 48px",
      }}>
        <div style={{
          background: "#fff",
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          padding: "32px 28px",
          boxShadow: "0 2px 12px rgba(31,58,44,0.05)",
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.gold,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 10,
          }}>What we don't have</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: 22,
            fontWeight: 700,
            color: C.forestInk,
            margin: "0 0 14px",
            lineHeight: 1.3,
          }}>Seven things competitors do that we don't</h2>
          <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6, margin: "0 0 18px" }}>
            Lead with the truth. If any of these are deal-breakers for your practice, one of these other platforms is a better fit, and that's fine. We're built for solo licensed massage therapists who want a calm, intelligent platform without insurance billing or multi-staff complexity.
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 10,
            marginBottom: 8,
          }}>
            {HONEST_GAPS.map((g) => (
              <div key={g.feature} style={{
                background: C.cream,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.forestInk, marginBottom: 3 }}>{g.feature}</div>
                <div style={{ fontSize: 11.5, color: C.inkSofter }}>Has it: {g.hasIt}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wins */}
      <section style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "0 24px 48px",
      }}>
        <div style={{
          background: `linear-gradient(135deg, #fff 0%, ${C.beige} 100%)`,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          padding: "32px 28px",
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.forest,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 10,
          }}>What only we have</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: 22,
            fontWeight: 700,
            color: C.forestInk,
            margin: "0 0 14px",
            lineHeight: 1.3,
          }}>Seven things only MyBodyMap does</h2>
          <ol style={{
            margin: 0,
            padding: "0 0 0 22px",
            fontSize: 14.5,
            lineHeight: 1.85,
            color: C.ink,
          }}>
            {HONEST_WINS.map((w, i) => (
              <li key={i} style={{ paddingLeft: 4 }}>{w}</li>
            ))}
          </ol>
        </div>
      </section>

      {/* The sheet */}
      <section style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "20px 24px 40px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(24px, 3.5vw, 32px)",
            fontWeight: 700,
            color: C.forestInk,
            margin: "0 0 10px",
            letterSpacing: "-0.01em",
          }}>The full comparison</h2>
          <p style={{ fontSize: 14, color: C.inkSoft, maxWidth: 580, margin: "0 auto", lineHeight: 1.6 }}>
            Sixty rows across seven categories. Click any cell in Google Sheets to see notes and sources. Hit "Suggest edits" if you spot something wrong.
          </p>
        </div>
        <div style={{
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${C.border}`,
          boxShadow: "0 6px 28px rgba(31,58,44,0.08)",
          minHeight: 600,
        }}>
          {SHEET_EMBED_URL ? (
            <iframe
              src={SHEET_EMBED_URL}
              title="Massage software comparison sheet"
              loading="lazy"
              style={{ width: "100%", height: 720, border: "none", display: "block" }}
            />
          ) : (
            <div style={{
              padding: "60px 32px",
              textAlign: "center",
              color: C.inkSofter,
              background: `linear-gradient(135deg, ${C.beige} 0%, ${C.cream} 100%)`,
            }}>
              <div style={{ fontSize: 38, opacity: 0.55, marginBottom: 14 }}>📊</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: C.forestInk, marginBottom: 8 }}>
                Embedded sheet coming soon
              </div>
              <div style={{ fontSize: 14, maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
                We're finalizing the source-of-truth sheet with the founding therapists this week. Check back soon, or reach out if you want early access.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "0 24px 40px",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.forest} 0%, #1F3A2C 100%)`,
          color: "#fff",
          borderRadius: 20,
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 14px 44px rgba(42,87,65,0.28)",
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#FBF4DC",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: 12,
          }}>Help keep this honest</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(22px, 3vw, 28px)",
            fontWeight: 700,
            margin: "0 0 14px",
            lineHeight: 1.3,
          }}>Spotted something wrong? Tell us.</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "rgba(255,255,255,0.85)", margin: "0 auto 22px", maxWidth: 480 }}>
            If you've used any of these tools and a checkmark looks off, suggest a correction in the sheet. We review every suggestion. Founding therapists who contribute get free Silver for life.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {SHEET_PUBLIC_URL ? (
              <a href={SHEET_PUBLIC_URL} target="_blank" rel="noopener noreferrer" style={{
                background: "#fff",
                color: C.forest,
                textDecoration: "none",
                padding: "13px 26px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14.5,
                display: "inline-block",
              }}>
                Suggest an edit →
              </a>
            ) : (
              <span style={{
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                padding: "13px 26px",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 14.5,
                opacity: 0.7,
              }}>
                Suggest edits link coming with sheet launch
              </span>
            )}
            <Link to="/signup" style={{
              background: "transparent",
              color: "#fff",
              textDecoration: "none",
              padding: "13px 26px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14.5,
              border: "1.5px solid rgba(255,255,255,0.4)",
            }}>
              Try MyBodyMap free
            </Link>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "20px 24px 40px",
      }}>
        <details style={{
          background: "#fff",
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "18px 22px",
        }}>
          <summary style={{
            fontSize: 14,
            fontWeight: 700,
            color: C.forestInk,
            cursor: "pointer",
            listStyle: "none",
            outline: "none",
          }}>
            How we score each cell
          </summary>
          <div style={{ marginTop: 14, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 12px" }}>
              Marks reflect what's available on the lowest paid tier of each platform. We use these conventions:
            </p>
            <ul style={{ margin: "0 0 12px", paddingLeft: 22 }}>
              <li><strong style={{ color: C.forestInk }}>✓</strong> &mdash; Included on the lowest paid tier (or free tier where applicable).</li>
              <li><strong style={{ color: C.forestInk }}>✓+</strong> &mdash; Available, but only on a higher tier.</li>
              <li><strong style={{ color: C.forestInk }}>$</strong> &mdash; Available as a paid add-on or per-use fee.</li>
              <li><strong style={{ color: C.forestInk }}>✕</strong> &mdash; Not available.</li>
              <li><strong style={{ color: C.forestInk }}>?</strong> &mdash; Unverified. We're asking the community to confirm.</li>
            </ul>
            <p style={{ margin: "0 0 8px" }}>
              Sources: official pricing pages, public feature documentation, vendor support tickets, and contributions from licensed massage therapists who use these tools daily. Every suggestion gets reviewed before it's published.
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: C.inkSofter, fontStyle: "italic" }}>
              This comparison is not legal or financial advice. Verify every detail with the platform directly before signing up. Pricing and features change.
            </p>
          </div>
        </details>
      </section>

      <Footer />
    </div>
  );
}
