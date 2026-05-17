// src/pages/Comparison.jsx
//
// v7 — per-category cards, dropped per-row verify/wrong buttons.
//
// PROBLEMS BEING SOLVED:
//   1. Sticky header was never the right solution. Per-category
//      cards each have their own visible platform-name header so
//      no sticky needed at all.
//   2. Per-row Verify and Wrong? buttons added clutter without real
//      value. Therapists weren't going to vote on 50+ rows. The
//      'Help us improve' floating button + feedback modal is the
//      right level of community input.
//   3. Padding was bloated. Tightened everywhere.
//
// ARCHITECTURE:
//   Each of the 7 taxonomy categories renders as its own card, with
//   its own platform-name column header sitting right above its rows.
//   Each card is its own screenshot.
//
// FEATURES:
//   - Pricing strip in each card header (price visible per platform)
//   - Quick-answers card at top with 5 most-asked questions
//   - Floating "Help us improve" button bottom-right -> feedback modal
//   - Feedback modal posts to comparison_feedback Supabase table
//   - Prominent CTA to /comparison/printable for sharing

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { supabase } from "../lib/supabase";
import {
  PLATFORMS,
  CATEGORIES,
  QUICK_ANSWERS,
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

function Mark({ value, highlight = false, compact = false }) {
  const dim = compact ? 20 : 22;
  const fontSize = compact ? 9.5 : 10;
  const padX = compact ? 7 : 8;

  if (value === "yes") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dim, height: dim, borderRadius: dim / 2,
        background: highlight ? C.forest : C.yesBg,
        color: highlight ? "#fff" : C.yes,
      }}>
        <svg width={compact ? 10 : 11} height={compact ? 10 : 11} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
      }}>UPPER</span>
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
      }}>SOON</span>
    );
  }
  if (value === "no") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dim, height: dim, color: C.no,
      }}>
        <svg width={compact ? 9 : 10} height={compact ? 9 : 10} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M3 3l6 6M9 3l-6 6"/>
        </svg>
      </span>
    );
  }
  if (value === "tbc") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dim, height: dim, color: C.tbc, fontSize: 12, fontWeight: 600,
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

function FeedbackModal({ open, onClose, prefillFeature = null, prefillCategory = null }) {
  const [feedbackType, setFeedbackType] = useState("inaccuracy");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && prefillFeature) {
      setFeedbackType("inaccuracy");
      setMessage(`On the row "${prefillFeature}": `);
    }
  }, [open, prefillFeature]);

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
          feature_label: prefillFeature || null,
          category_id: prefillCategory || null,
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
    setMessage(""); setEmail(""); setName("");
    setFeedbackType("inaccuracy"); setSubmitted(false); setError(null);
    onClose();
  }

  return (
    <div onClick={() => !submitting && reset()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.50)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 16px 60px rgba(0,0,0,0.30)" }}>
        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 38, marginBottom: 14 }}>🌿</div>
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: C.forestInk, margin: "0 0 10px" }}>Thank you for keeping us honest.</h3>
            <p style={{ fontSize: 14, color: C.inkSoft, margin: "0 0 22px", lineHeight: 1.6 }}>We review every submission. If you left an email, we'll let you know what we change.</p>
            <button onClick={reset} style={{ background: C.forest, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: C.forestInk, margin: "0 0 6px" }}>Help keep this honest</h3>
                <p style={{ fontSize: 13.5, color: C.inkSoft, margin: 0, lineHeight: 1.5 }}>Spotted an inaccuracy or want to suggest a feature? Tell us. We review every note.</p>
              </div>
              <button onClick={reset} disabled={submitting} aria-label="Start over" style={{ background: "transparent", border: `1px solid ${C.inkSofter}`, fontSize: 12, fontWeight: 700, color: C.inkSoft, cursor: submitting ? "not-allowed" : "pointer", padding: "6px 14px", borderRadius: 999, transition: 'all 0.15s' }} onMouseEnter={(e)=>{ if(!submitting) { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.color=C.forestInk; }}} onMouseLeave={(e)=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=C.inkSoft; }}>Start over</button>
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>What kind of feedback?</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { id: "inaccuracy", label: "Inaccuracy" },
                { id: "suggest_feature", label: "Add a feature" },
                { id: "suggest_platform", label: "Add a platform" },
                { id: "general", label: "General" },
              ].map((t) => (
                <button key={t.id} type="button" onClick={() => setFeedbackType(t.id)} style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${feedbackType === t.id ? C.forest : C.border}`, background: feedbackType === t.id ? C.forest : "transparent", color: feedbackType === t.id ? "#fff" : C.inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t.label}</button>
              ))}
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>What's wrong or missing?</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
              placeholder={feedbackType === "inaccuracy" ? "e.g. MassageBook actually does support visual body maps as of April 2026. I just used it." : "Be specific so we can verify and update fast."}
              style={{ width: "100%", padding: "11px 13px", border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontFamily: "system-ui", resize: "vertical", boxSizing: "border-box", outline: "none", marginBottom: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Name (optional)</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "system-ui", boxSizing: "border-box", outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email (optional)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="so we can confirm changes" style={{ width: "100%", padding: "9px 11px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "system-ui", boxSizing: "border-box", outline: "none" }} />
              </div>
            </div>
            {error && <div style={{ padding: "10px 12px", background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#991B1B", marginBottom: 12 }}>{error}</div>}
            <button onClick={submit} disabled={submitting || !message.trim()} style={{ width: "100%", background: submitting ? C.sage : C.forest, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 700, cursor: submitting || !message.trim() ? "not-allowed" : "pointer", opacity: submitting || !message.trim() ? 0.7 : 1 }}>
              {submitting ? "Sending…" : "Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// CategoryCard — one card per taxonomy category. Self-contained, dense,
// screenshot-shareable. Each card has its own platform-name column
// header at the top, so no sticky positioning is needed.
function CategoryCard({ cat }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      boxShadow: "0 2px 12px rgba(31,58,44,0.05)",
      overflow: "hidden",
      marginBottom: 12,
    }}>
      {/* Card header bar — title only, no subtitle */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 10,
        padding: "10px 14px",
        background: `linear-gradient(180deg, ${C.creamSoft} 0%, #fff 100%)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 11, color: C.gold, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{cat.id}</span>
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: 15.5, fontWeight: 700, color: C.forestInk, margin: 0, letterSpacing: "-0.005em" }}>{cat.name}</h3>
      </div>

      {/* Scroll container with bounded height — what makes <thead position:sticky> fire */}
      <div style={{ overflow: "auto", maxHeight: 520 }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "32%" }} />
            {PLATFORMS.map((p) => <col key={p.id} style={{ width: `${68 / PLATFORMS.length}%` }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff", padding: "8px 12px 6px", borderBottom: `1.5px solid ${C.borderStrong}`, textAlign: "left" }}>
                <span style={{ fontSize: 10, color: C.inkSofter, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Feature</span>
              </th>
              {PLATFORMS.map((p) => (
                <th key={p.id} style={{
                  position: "sticky", top: 0, zIndex: 2,
                  padding: "6px 4px",
                  borderBottom: `1.5px solid ${p.highlight ? C.forest : C.borderStrong}`,
                  background: p.highlight ? C.yesBg : "#fff",
                  textAlign: "center",
                  lineHeight: 1.15,
                }}>
                  <div style={{ fontSize: p.highlight ? 11 : 10.5, fontWeight: 700, color: p.highlight ? C.forest : C.forestInk }}>{p.name}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: p.highlight ? C.forest : C.inkSofter, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
                    ${p.priceFrom}<span style={{ fontSize: 8 }}>/mo</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cat.rows.map((row, i) => {
              const isLast = i === cat.rows.length - 1;
              return (
                <tr key={i}>
                  <td style={{
                    padding: "10px 12px",
                    fontSize: 12.5,
                    color: C.ink,
                    borderBottom: isLast ? "none" : `1px solid ${C.border}`,
                    lineHeight: 1.4,
                  }}>
                    {row.f}
                  </td>
                  {PLATFORMS.map((p) => (
                    <td key={p.id} style={{
                      textAlign: "center", padding: "8px 4px",
                      borderBottom: isLast ? "none" : `1px solid ${C.border}`,
                      background: p.highlight ? "rgba(232, 240, 234, 0.4)" : "transparent",
                    }}>
                      <Mark value={row[p.id]} highlight={p.highlight} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Comparison() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackPrefill, setFeedbackPrefill] = useState({ feature: null, category: null });

  function closeFeedback() {
    setFeedbackOpen(false);
    setFeedbackPrefill({ feature: null, category: null });
  }

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <Nav />

      {/* Compact hero */}
      <header style={{ maxWidth: 920, margin: "0 auto", padding: "110px 20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 8 }}>Side by side</div>
        <h1 style={{
          fontFamily: "Georgia, 'Iowan Old Style', serif",
          fontSize: "clamp(26px, 4.5vw, 38px)",
          fontWeight: 700, lineHeight: 1.18,
          color: C.forestInk,
          margin: "0 0 10px", letterSpacing: "-0.022em",
        }}>
          Massage software, <em style={{ color: C.gold, fontStyle: "italic" }}>compared honestly.</em>
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: C.inkSoft, maxWidth: 580, margin: "0 auto 16px" }}>
          Seven platforms. Verified pricing and features as of May 2026. Each card screenshots cleanly for sharing.
        </p>
        <a href="/comparison/printable" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: C.forest, color: "#fff", textDecoration: "none",
          padding: "9px 20px", borderRadius: 99,
          fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 12px rgba(42,87,65,0.18)",
        }}>
          <span style={{ fontSize: 14 }}>📄</span> Get the one-page printable
        </a>
      </header>

      {/* Quick answers — its own card */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px 12px" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(31,58,44,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: `linear-gradient(180deg, ${C.creamSoft} 0%, #fff 100%)`, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 11, color: C.gold, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>0.0</span>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 15.5, fontWeight: 700, color: C.forestInk, margin: 0, letterSpacing: "-0.005em" }}>Five questions therapists ask first</h3>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 720, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "32%" }} />
                {PLATFORMS.map((p) => <col key={p.id} style={{ width: `${68 / PLATFORMS.length}%` }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ padding: "8px 12px 6px", borderBottom: `1.5px solid ${C.borderStrong}`, textAlign: "left" }}>
                    <span style={{ fontSize: 10, color: C.inkSofter, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Question</span>
                  </th>
                  {PLATFORMS.map((p) => (
                    <th key={p.id} style={{ padding: "6px 4px", borderBottom: `1.5px solid ${p.highlight ? C.forest : C.borderStrong}`, background: p.highlight ? C.yesBg : "transparent", textAlign: "center", lineHeight: 1.15 }}>
                      <div style={{ fontSize: p.highlight ? 11 : 10.5, fontWeight: 700, color: p.highlight ? C.forest : C.forestInk }}>{p.name}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: p.highlight ? C.forest : C.inkSofter, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>${p.priceFrom}<span style={{ fontSize: 8 }}>/mo</span></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {QUICK_ANSWERS.map((row, i) => {
                  const isLast = i === QUICK_ANSWERS.length - 1;
                  return (
                    <tr key={i}>
                      <td style={{ padding: "7px 12px", fontSize: 12.5, color: C.ink, borderBottom: isLast ? "none" : `1px solid ${C.border}`, fontWeight: 500, lineHeight: 1.35 }}>{row.q}</td>
                      {PLATFORMS.map((p) => (
                        <td key={p.id} style={{ textAlign: "center", padding: "7px 4px", borderBottom: isLast ? "none" : `1px solid ${C.border}`, background: p.highlight ? "rgba(232, 240, 234, 0.4)" : "transparent" }}>
                          <Mark value={row[p.id]} highlight={p.highlight} compact />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Per-category cards — each one screenshot-shareable */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px 12px" }}>
        {CATEGORIES.map((cat) => (
          <CategoryCard key={cat.id} cat={cat} />
        ))}
      </section>

      {/* Legend */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "8px 20px 24px" }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", padding: "10px 12px", background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 11.5, color: C.inkSoft }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Mark value="yes" compact/> Available</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Mark value="planned" compact/> On our roadmap</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Mark value="addon" compact/> Paid add-on</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Mark value="yes+" compact/> Higher tier only</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Mark value="no" compact/> Not available</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Mark value="tbc" compact/> Awaiting input</span>
        </div>
      </section>

      {/* CTA — switcher framing now that visitor has compared */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "8px 20px 36px" }}>
        <div style={{ background: `linear-gradient(135deg, ${C.forest} 0%, ${C.forestDeep} 100%)`, color: "#fff", borderRadius: 16, padding: "30px 24px", textAlign: "center", boxShadow: "0 12px 36px rgba(42,87,65,0.22)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#FBF4DC", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 10 }}>Compared. Decided. Ready?</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(22px, 3.5vw, 28px)", fontWeight: 700, margin: "0 0 14px", lineHeight: 1.25 }}>
            Switching takes about as long as making coffee.
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.85)", margin: "0 auto 22px", maxWidth: 480 }}>
            If you're already on one of the six platforms above, bring your client list, your booking link, your standards. Up and running in 2 minutes. 30-day free trial on Silver and Gold. Bronze stays free forever.
          </p>
          <Link to="/signup" style={{ display: "inline-block", background: "#fff", color: C.forest, textDecoration: "none", padding: "12px 28px", borderRadius: 10, fontWeight: 700, fontSize: 14.5 }}>
            Start free →
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section style={{ maxWidth: 720, margin: "0 auto 28px", padding: "0 20px" }}>
        <p style={{ fontSize: 11, color: C.inkSofter, textAlign: "center", lineHeight: 1.55, margin: 0, fontStyle: "italic" }}>
          Comparison based on publicly available pricing and feature documentation as of May 2026. Pricing and features change frequently. Confirm directly with each provider before signing up. Cells marked with a dash are awaiting community confirmation. Spotted something off? Use the "Help us improve" button below to flag it.
        </p>
      </section>

      <Footer />

      {/* Floating feedback button — bigger and more obvious */}
      <button onClick={() => { setFeedbackPrefill({ feature: null, category: null }); setFeedbackOpen(true); }} style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 1000,
        background: C.forest, color: "#fff", border: "none",
        borderRadius: 99, padding: "11px 18px",
        fontSize: 13.5, fontWeight: 700, cursor: "pointer",
        boxShadow: "0 8px 22px rgba(42,87,65,0.30)",
        display: "inline-flex", alignItems: "center", gap: 7,
      }}>
        <span style={{ fontSize: 13 }}>✎</span>
        Help us improve
      </button>

      <FeedbackModal open={feedbackOpen} onClose={closeFeedback} prefillFeature={feedbackPrefill.feature} prefillCategory={feedbackPrefill.category} />
    </div>
  );
}
