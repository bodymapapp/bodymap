// src/pages/Comparison.jsx
//
// Solo-LMT software comparison. Static, beautiful, screenshot-shareable,
// with sticky header + community feedback.
//
// CHANGES IN THIS REVISION:
//   - Restructured matrix as a real <table> with <thead position:sticky>
//     so platform names + prices stay visible while scrolling
//   - "Quick answers" panel above the matrix surfaces the 5 most-asked
//     questions (free? booking? payments? memberships? mobile app?) at
//     a glance, without breaking the 7-category taxonomy
//   - New "PLANNED" mark — gold pill — for features on our roadmap
//     (replaces the messy "yes+ planned" / "✕ planned" hacks)
//   - "Mobile app for therapist" replaces the separate iOS/native rows;
//     PWA counts as yes for MyBodyMap
//   - Floating feedback button + modal: visitors can flag inaccuracies
//     or suggest features. Posts to comparison_feedback Supabase table
//     (RLS: public insert, admin select)
//
// Data lives in src/data/comparisonData.js — edit there to update marks.

import React, { useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { supabase } from "../lib/supabase";
import {
  PLATFORMS,
  CATEGORIES,
  QUICK_ANSWERS,
  annualSavings,
} from "../data/comparisonData";

const C = {
  cream: "#FAF6EE",
  creamSoft: "#FBF8F1",
  beige: "#F5F0E8",
  forest: "#2A5741",
  forestInk: "#1F3A2C",
  forestDeep: "#1A3A28",
  sage: "#7A9C84",
  gold: "#B0902F",
  goldSoft: "#D4B968",
  goldChip: "#FBF4DC",
  ink: "#1F3A2C",
  inkSoft: "#4B5563",
  inkSofter: "#6B7280",
  inkSoftest: "#9CA3AF",
  border: "rgba(31,58,44,0.08)",
  borderStrong: "rgba(31,58,44,0.14)",
  yes: "#2A5741",
  yesBg: "#E8F0EA",
  no: "#C8CDC4",
  addon: "#B0902F",
  addonBg: "#FBF4DC",
  planned: "#7A6325",
  plannedBg: "#F5EBC7",
  tbc: "#9CB0A0",
};

// Renders a mark in either the full matrix or the quick-answers row.
// Setting `compact` shrinks chips for the 5-row summary panel.
function Mark({ value, highlight = false, compact = false }) {
  const dim = compact ? 22 : 24;
  const padX = compact ? 8 : 9;
  const fontSize = compact ? 10 : 10.5;

  if (value === "yes") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dim, height: dim, borderRadius: dim / 2,
        background: highlight ? C.forest : C.yesBg,
        color: highlight ? "#fff" : C.yes,
      }}>
        <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6l2.5 2.5L9.5 3.5"/>
        </svg>
      </span>
    );
  }
  if (value === "yes+") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: dim, borderRadius: dim / 2, padding: `0 ${padX}px`,
        background: C.yesBg, color: C.yes, fontSize, fontWeight: 700, letterSpacing: "0.02em",
      }}>HIGHER TIER</span>
    );
  }
  if (value === "addon") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: dim, borderRadius: dim / 2, padding: `0 ${padX}px`,
        background: C.addonBg, color: C.addon, fontSize, fontWeight: 700, letterSpacing: "0.02em",
      }}>ADD-ON</span>
    );
  }
  if (value === "planned") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: dim, borderRadius: dim / 2, padding: `0 ${padX}px`,
        background: C.plannedBg, color: C.planned, fontSize, fontWeight: 700, letterSpacing: "0.02em",
        border: `1px dashed ${C.gold}`,
      }}>PLANNED</span>
    );
  }
  if (value === "no") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dim, height: dim, color: C.no,
      }}>
        <svg width={compact ? 9 : 11} height={compact ? 9 : 11} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M3 3l6 6M9 3l-6 6"/>
        </svg>
      </span>
    );
  }
  if (value === "tbc") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dim, height: dim, color: C.tbc, fontSize: 13, fontWeight: 600,
      }}>—</span>
    );
  }
  if (value === "trial") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: dim, borderRadius: dim / 2, padding: `0 ${padX}px`,
        background: C.beige, color: C.inkSoft, fontSize, fontWeight: 700, letterSpacing: "0.02em",
      }}>TRIAL</span>
    );
  }
  return null;
}

function PricingCard({ p }) {
  const isUs = p.highlight;
  return (
    <div style={{
      background: isUs ? `linear-gradient(135deg, #fff 0%, ${C.creamSoft} 100%)` : "#fff",
      border: `${isUs ? 2 : 1}px solid ${isUs ? C.forest : C.border}`,
      borderRadius: 18,
      padding: "24px 22px",
      position: "relative",
      boxShadow: isUs ? "0 12px 36px rgba(42,87,65,0.18)" : "0 2px 8px rgba(31,58,44,0.04)",
      transform: isUs ? "translateY(-4px)" : "none",
    }}>
      {isUs && (
        <div style={{
          position: "absolute",
          top: -12,
          left: "50%",
          transform: "translateX(-50%)",
          background: C.forest,
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          padding: "5px 12px",
          borderRadius: 99,
          whiteSpace: "nowrap",
        }}>You're here</div>
      )}
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: C.forestInk, marginBottom: 4, letterSpacing: "-0.005em" }}>{p.name}</div>
      <div style={{ fontSize: 11.5, color: C.inkSofter, marginBottom: 14 }}>{p.tagline}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.inkSofter, fontWeight: 600 }}>from</span>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 700, color: isUs ? C.forest : C.forestInk, fontVariantNumeric: "tabular-nums" }}>${p.priceFrom}</span>
        <span style={{ fontSize: 12, color: C.inkSofter }}>/mo</span>
      </div>
      {p.priceFrom === 0 && (
        <div style={{ display: "inline-block", background: C.yesBg, color: C.forest, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 8, letterSpacing: "0.04em" }}>FREE TIER</div>
      )}
    </div>
  );
}

function SavingsCard({ competitor }) {
  const us = PLATFORMS[0];
  const yearly = annualSavings(competitor.priceFrom, us.priceFrom);
  if (yearly <= 0) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 8px rgba(31,58,44,0.04)" }}>
      <div style={{ fontSize: 11, color: C.inkSofter, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        Switching from {competitor.name}
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: 700, color: C.forest, letterSpacing: "-0.015em", lineHeight: 1.1, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
        ${yearly.toLocaleString()}<span style={{ fontSize: 14, color: C.inkSoft, fontWeight: 600 }}> /year saved</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.inkSofter }}>
        ${competitor.priceFrom}/mo → ${us.priceFrom}/mo
      </div>
    </div>
  );
}

// Feedback modal — submits to comparison_feedback table.
function FeedbackModal({ open, onClose }) {
  const [feedbackType, setFeedbackType] = useState("inaccuracy");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  async function submit() {
    if (!message.trim() || message.trim().length < 5) {
      setError("Please add a few details.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: dbErr } = await supabase
        .from("comparison_feedback")
        .insert({
          feedback_type: feedbackType,
          message: message.trim(),
          email: email.trim() || null,
          name: name.trim() || null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
        });
      if (dbErr) throw dbErr;
      setSubmitted(true);
    } catch (e) {
      console.error("comparison feedback failed:", e);
      setError("Submission failed. Try again or email hello@mybodymap.app.");
    }
    setSubmitting(false);
  }

  function reset() {
    setMessage("");
    setEmail("");
    setName("");
    setFeedbackType("inaccuracy");
    setSubmitted(false);
    setError(null);
    onClose();
  }

  return (
    <div onClick={() => !submitting && reset()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.50)", zIndex: 2000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, padding: 28, maxWidth: 520, width: "100%",
        maxHeight: "90vh", overflow: "auto", boxShadow: "0 16px 60px rgba(0,0,0,0.30)",
      }}>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 38, marginBottom: 14 }}>🌿</div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: C.forestInk, margin: "0 0 10px" }}>
              Thank you for keeping us honest.
            </h3>
            <p style={{ fontSize: 14, color: C.inkSoft, margin: "0 0 22px", lineHeight: 1.6 }}>
              We review every submission. If you left an email, we'll let you know what we change.
            </p>
            <button onClick={reset} style={{
              background: C.forest, color: "#fff", border: "none", borderRadius: 10,
              padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: C.forestInk, margin: "0 0 6px" }}>
                  Help keep this honest
                </h3>
                <p style={{ fontSize: 13.5, color: C.inkSoft, margin: 0, lineHeight: 1.5 }}>
                  Spotted an inaccuracy or want to suggest a feature? Tell us. We review every note.
                </p>
              </div>
              <button onClick={reset} disabled={submitting} style={{
                background: "none", border: "none", fontSize: 24, color: C.inkSofter,
                cursor: submitting ? "not-allowed" : "pointer", padding: 0, lineHeight: 1,
              }}>×</button>
            </div>

            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              What kind of feedback?
            </label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { id: "inaccuracy",        label: "Inaccuracy" },
                { id: "suggest_feature",   label: "Add a feature" },
                { id: "suggest_platform",  label: "Add a platform" },
                { id: "general",           label: "General" },
              ].map((t) => (
                <button key={t.id} type="button" onClick={() => setFeedbackType(t.id)} style={{
                  padding: "6px 12px", borderRadius: 20,
                  border: `1.5px solid ${feedbackType === t.id ? C.forest : C.border}`,
                  background: feedbackType === t.id ? C.forest : "transparent",
                  color: feedbackType === t.id ? "#fff" : C.inkSoft,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{t.label}</button>
              ))}
            </div>

            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              What's wrong or missing?
            </label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
              placeholder={feedbackType === "inaccuracy" ? "e.g. MassageBook actually does support visual body maps as of April 2026 — I just used it." : "Be specific so we can verify and update fast."}
              style={{ width: "100%", padding: "11px 13px", border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontFamily: "system-ui", resize: "vertical", boxSizing: "border-box", outline: "none", marginBottom: 12 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Name (optional)
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "system-ui", boxSizing: "border-box", outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Email (optional)
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="so we can confirm changes"
                  style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "system-ui", boxSizing: "border-box", outline: "none" }} />
              </div>
            </div>

            {error && (
              <div style={{ padding: "10px 12px", background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#991B1B", marginBottom: 12 }}>{error}</div>
            )}

            <button onClick={submit} disabled={submitting || !message.trim()} style={{
              width: "100%", background: submitting ? C.sage : C.forest, color: "#fff",
              border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 700,
              cursor: submitting || !message.trim() ? "not-allowed" : "pointer",
              opacity: submitting || !message.trim() ? 0.7 : 1,
            }}>
              {submitting ? "Sending…" : "Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Comparison() {
  const us = PLATFORMS[0];
  const competitors = PLATFORMS.slice(1);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <Nav />

      {/* Hero */}
      <header style={{ maxWidth: 920, margin: "0 auto", padding: "60px 24px 36px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 14 }}>Side by side</div>
        <h1 style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: "clamp(32px, 5.5vw, 50px)", fontWeight: 700, lineHeight: 1.15, color: C.forestInk, margin: "0 0 18px", letterSpacing: "-0.022em" }}>
          Solo massage software, <em style={{ color: C.gold, fontStyle: "italic" }}>compared honestly.</em>
        </h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: C.inkSoft, maxWidth: 640, margin: "0 auto 8px" }}>
          Seven platforms. The same questions. Different answers. Last verified May 2026.
        </p>
        <p style={{ fontSize: 13, color: C.inkSofter, margin: "10px auto 0", maxWidth: 560, lineHeight: 1.5 }}>
          Some cells are still being verified. Spot something off? <button onClick={() => setFeedbackOpen(true)} style={{ background: "none", border: "none", color: C.forest, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: "inherit" }}>Tell us</button>.
        </p>
      </header>

      {/* Pricing grid */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 44px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, alignItems: "stretch" }}>
          {PLATFORMS.map((p) => <PricingCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Quick answers — top-of-page summary for the questions therapists ask first */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px 36px" }}>
        <div style={{
          background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`,
          padding: "22px 18px 16px", boxShadow: "0 6px 28px rgba(31,58,44,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 6px 12px", borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: C.forestInk, margin: 0, letterSpacing: "-0.005em" }}>
              The five questions therapists ask first
            </h2>
            <span style={{ fontSize: 12, color: C.inkSofter, marginLeft: "auto" }}>Quick scan before the full table</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 680, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "30%" }} />
                {PLATFORMS.map((p) => <col key={p.id} style={{ width: `${70 / PLATFORMS.length}%` }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th></th>
                  {PLATFORMS.map((p) => (
                    <th key={p.id} style={{
                      padding: "8px 4px", textAlign: "center", fontSize: 11, fontWeight: 700,
                      color: p.highlight ? C.forest : C.inkSofter, lineHeight: 1.2,
                    }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {QUICK_ANSWERS.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "10px 6px", fontSize: 13, color: C.ink, borderTop: `1px solid ${C.border}`, fontWeight: 500 }}>{row.q}</td>
                    {PLATFORMS.map((p) => (
                      <td key={p.id} style={{
                        textAlign: "center", padding: "10px 4px",
                        borderTop: `1px solid ${C.border}`,
                        background: p.highlight ? "rgba(232, 240, 234, 0.4)" : "transparent",
                      }}>
                        <Mark value={row[p.id]} highlight={p.highlight} compact />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Annual savings */}
      <section style={{ background: `linear-gradient(180deg, transparent 0%, ${C.beige} 50%, transparent 100%)`, padding: "40px 0" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 8 }}>Annual cost difference</div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 700, color: C.forestInk, margin: "0 0 12px", letterSpacing: "-0.015em", lineHeight: 1.25 }}>
              What you keep when you switch.
            </h2>
            <p style={{ fontSize: 14.5, color: C.inkSoft, maxWidth: 540, margin: "0 auto", lineHeight: 1.6 }}>
              Based on each platform's lowest published tier. Versus MyBodyMap's free Bronze tier.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {competitors.map((c) => <SavingsCard key={c.id} competitor={c} />)}
          </div>
        </div>
      </section>

      {/* Feature matrix — single sticky-header table */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "60px 16px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 32, padding: "0 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 8 }}>The full picture</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 700, color: C.forestInk, margin: "0 0 12px", letterSpacing: "-0.015em", lineHeight: 1.25 }}>
            Feature by feature.
          </h2>
          <p style={{ fontSize: 14.5, color: C.inkSoft, maxWidth: 580, margin: "0 auto", lineHeight: 1.6 }}>
            Sixty-plus capabilities across seven categories. Sticky platform names — they stay visible as you scroll.
          </p>
        </div>

        <div style={{
          background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`,
          padding: "8px", boxShadow: "0 6px 28px rgba(31,58,44,0.06)",
          overflowX: "auto",
        }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "32%" }} />
              {PLATFORMS.map((p) => <col key={p.id} style={{ width: `${68 / PLATFORMS.length}%` }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{
                  position: "sticky", top: 0, zIndex: 5,
                  background: "#fff",
                  padding: "12px 8px",
                  borderBottom: `2px solid ${C.borderStrong}`,
                  textAlign: "left",
                }}>
                  <span style={{ fontSize: 11, color: C.inkSofter, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Feature</span>
                </th>
                {PLATFORMS.map((p) => (
                  <th key={p.id} style={{
                    position: "sticky", top: 0, zIndex: 5,
                    background: p.highlight ? C.yesBg : "#fff",
                    padding: "10px 4px",
                    borderBottom: `2px solid ${p.highlight ? C.forest : C.borderStrong}`,
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}>
                    <div style={{ fontSize: p.highlight ? 12.5 : 12, fontWeight: 700, color: p.highlight ? C.forest : C.forestInk }}>{p.name}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: p.highlight ? C.forest : C.inkSofter, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      ${p.priceFrom}<span style={{ fontSize: 9 }}>/mo</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <React.Fragment key={cat.id}>
                  <tr>
                    <td colSpan={PLATFORMS.length + 1} style={{ padding: "20px 8px 10px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBottom: 8, borderBottom: `1px solid ${C.borderStrong}` }}>
                        <span style={{ fontSize: 11, color: C.gold, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{cat.id}</span>
                        <h3 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: C.forestInk, margin: 0, letterSpacing: "-0.005em" }}>{cat.name}</h3>
                        <span style={{ fontSize: 12, color: C.inkSofter, marginLeft: "auto" }}>{cat.sub}</span>
                      </div>
                    </td>
                  </tr>
                  {cat.rows.map((row, i) => (
                    <tr key={`${cat.id}-${i}`}>
                      <td style={{ padding: "13px 8px", fontSize: 13.5, color: C.ink, borderBottom: `1px solid ${C.border}`, lineHeight: 1.4 }}>
                        {row.f}
                        {row.note && (
                          <span style={{ fontSize: 11, color: C.inkSofter, fontStyle: "italic", display: "block", marginTop: 2, lineHeight: 1.4 }}>{row.note}</span>
                        )}
                      </td>
                      {PLATFORMS.map((p) => (
                        <td key={p.id} style={{
                          textAlign: "center", padding: "13px 4px",
                          borderBottom: `1px solid ${C.border}`,
                          background: p.highlight ? "rgba(232, 240, 234, 0.4)" : "transparent",
                        }}>
                          <Mark value={row[p.id]} highlight={p.highlight} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: "20px 16px 0", fontSize: 12, color: C.inkSoft }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="yes"/> Available</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="planned"/> On our roadmap</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="addon"/> Paid add-on</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="yes+"/> Higher tier only</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="no"/> Not available</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="tbc"/> Awaiting community input</span>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "20px 24px 80px" }}>
        <div style={{ background: `linear-gradient(135deg, ${C.forest} 0%, ${C.forestDeep} 100%)`, color: "#fff", borderRadius: 22, padding: "44px 32px", textAlign: "center", boxShadow: "0 18px 56px rgba(42,87,65,0.30)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#FBF4DC", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 12 }}>30-day free trial · no card required</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 700, margin: "0 0 14px", lineHeight: 1.25 }}>See how MyBodyMap fits your practice.</h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(255,255,255,0.85)", margin: "0 auto 26px", maxWidth: 480 }}>
            Import your client list, send a personalized campaign, and feel the difference inside one afternoon.
          </p>
          <Link to="/signup" style={{ display: "inline-block", background: "#fff", color: C.forest, textDecoration: "none", padding: "14px 32px", borderRadius: 12, fontWeight: 700, fontSize: 15 }}>
            Start free →
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section style={{ maxWidth: 760, margin: "0 auto 40px", padding: "0 24px" }}>
        <p style={{ fontSize: 12, color: C.inkSofter, textAlign: "center", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
          Comparison based on publicly available pricing and feature documentation as of May 2026. Pricing and features change. Verify directly with each provider before signing up. This page is informational only and not legal or financial advice. We are not 100% certain of every cell — that is why we ask the community to help us improve.
        </p>
      </section>

      <Footer />

      {/* Floating feedback button — always visible while scrolling */}
      <button onClick={() => setFeedbackOpen(true)} style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 1000,
        background: C.forest, color: "#fff", border: "none",
        borderRadius: 99, padding: "12px 20px",
        fontSize: 14, fontWeight: 700, cursor: "pointer",
        boxShadow: "0 8px 24px rgba(42,87,65,0.30)",
        display: "inline-flex", alignItems: "center", gap: 7,
      }}>
        <span style={{ fontSize: 14 }}>✎</span>
        Spot an issue?
      </button>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
