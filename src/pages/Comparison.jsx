// src/pages/Comparison.jsx
//
// v6 — per-category card architecture for screenshot-shareability.
//
// PROBLEMS BEING SOLVED:
//   1. The sticky header keeps not working in practice. Every fix
//      addresses one edge case and breaks another. The real solution
//      is to make sticky unnecessary by keeping each section short
//      enough to fit in a viewport with its own visible header.
//   2. HK explicitly asked for screenshot-shareable. A single 60-row
//      table that scrolls 4 screens isn't shareable. Seven small
//      per-category cards each fit in a phone screenshot.
//   3. Padding was bloated. Tightened everywhere.
//
// ARCHITECTURE:
//   Each of the 7 taxonomy categories renders as its own card, with
//   its own platform-name column header sitting right above its rows.
//   No sticky needed. Each card is its own screenshot.
//
// KEPT FROM v5:
//   - Per-row Verify + Wrong? buttons (gamification visible)
//   - Community progress scoreboard at top
//   - Feedback modal
//   - Quick answers panel as separate top card
//   - All comparison data in src/data/comparisonData.js
//
// REMOVED:
//   - Pricing grid section (price now shows in each card's column header)
//   - Annual savings cards section (extra noise; can come back later)
//   - Floating-position sticky-header logic (~50 lines of JS)
//   - "You" rightmost column in matrix (buttons moved into feature cell)

import React, { useEffect, useMemo, useRef, useState } from "react";
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

// Stable anonymous voter id stored in localStorage.
function getOrCreateVoterId() {
  if (typeof window === "undefined") return "ssr";
  try {
    const KEY = "mbm_comparison_voter_id";
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = crypto?.randomUUID?.() || `v${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `v${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
  }
}

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

function VerifyButton({ feature, categoryId, voted, count, onVote }) {
  const [busy, setBusy] = useState(false);
  async function handleClick(e) {
    e.stopPropagation();
    if (voted || busy) return;
    setBusy(true);
    await onVote(feature, categoryId);
    setBusy(false);
  }
  return (
    <button onClick={handleClick} disabled={voted || busy} title={voted ? "Thanks for verifying" : "Mark this row as accurate based on your experience"} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: voted ? C.yesBg : "transparent",
      color: voted ? C.forest : C.inkSofter,
      border: `1px solid ${voted ? C.forest : C.border}`,
      borderRadius: 10, padding: "2px 7px",
      fontSize: 10, fontWeight: 600, cursor: voted ? "default" : "pointer",
      lineHeight: 1, whiteSpace: "nowrap", flexShrink: 0,
      transition: "all 0.15s",
    }}>
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6l2.5 2.5L9.5 3.5"/>
      </svg>
      <span>{voted ? "Verified" : "Verify"}</span>
      {count > 0 && (
        <span style={{ background: voted ? C.forest : C.beige, color: voted ? "#fff" : C.inkSoft, fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 7, fontVariantNumeric: "tabular-nums" }}>{count}</span>
      )}
    </button>
  );
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
              <button onClick={reset} disabled={submitting} style={{ background: "none", border: "none", fontSize: 24, color: C.inkSofter, cursor: submitting ? "not-allowed" : "pointer", padding: 0, lineHeight: 1 }}>×</button>
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
              placeholder={feedbackType === "inaccuracy" ? "e.g. MassageBook actually does support visual body maps as of April 2026 — I just used it." : "Be specific so we can verify and update fast."}
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
function CategoryCard({ cat, voteCounts, myVotes, onVerify, onWrongRow }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      boxShadow: "0 2px 12px rgba(31,58,44,0.05)",
      overflow: "hidden",
      marginBottom: 12,
    }}>
      {/* Card header bar */}
      <div style={{
        display: "flex", alignItems: "baseline", gap: 10,
        padding: "10px 14px",
        background: `linear-gradient(180deg, ${C.creamSoft} 0%, #fff 100%)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 11, color: C.gold, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{cat.id}</span>
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: 15.5, fontWeight: 700, color: C.forestInk, margin: 0, letterSpacing: "-0.005em" }}>{cat.name}</h3>
        <span style={{ fontSize: 11.5, color: C.inkSofter, marginLeft: "auto" }}>{cat.sub}</span>
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
                <span style={{ fontSize: 10, color: C.inkSofter, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Feature</span>
              </th>
              {PLATFORMS.map((p) => (
                <th key={p.id} style={{
                  padding: "6px 4px",
                  borderBottom: `1.5px solid ${p.highlight ? C.forest : C.borderStrong}`,
                  background: p.highlight ? C.yesBg : "transparent",
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
                    padding: "7px 12px",
                    fontSize: 12.5,
                    color: C.ink,
                    borderBottom: isLast ? "none" : `1px solid ${C.border}`,
                    lineHeight: 1.35,
                  }}>
                    <div>{row.f}</div>
                    {row.note && (
                      <span style={{ fontSize: 10.5, color: C.inkSofter, fontStyle: "italic", display: "block", marginTop: 1, lineHeight: 1.3 }}>{row.note}</span>
                    )}
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                      <VerifyButton
                        feature={row.f}
                        categoryId={cat.id}
                        voted={myVotes.has(row.f)}
                        count={voteCounts[row.f] || 0}
                        onVote={onVerify}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); onWrongRow(row.f, cat.id); }}
                        title="Flag this row as inaccurate"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          padding: "2px 7px", borderRadius: 10,
                          background: "transparent", color: C.inkSofter,
                          border: `1px solid ${C.border}`, cursor: "pointer",
                          fontSize: 10, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontSize: 10, lineHeight: 1 }}>⚠</span>
                        <span>Wrong?</span>
                      </button>
                    </div>
                  </td>
                  {PLATFORMS.map((p) => (
                    <td key={p.id} style={{
                      textAlign: "center", padding: "7px 4px",
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
  const [voteCounts, setVoteCounts] = useState({});
  const [myVotes, setMyVotes] = useState(new Set());
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackPrefill, setFeedbackPrefill] = useState({ feature: null, category: null });
  const voterIdRef = useRef(null);

  const totalRows = useMemo(
    () => CATEGORIES.reduce((sum, cat) => sum + cat.rows.length, 0),
    []
  );

  const verifiedRowCount = useMemo(
    () => Object.values(voteCounts).filter((n) => n > 0).length,
    [voteCounts]
  );
  const verifiedPct = totalRows ? Math.round((verifiedRowCount / totalRows) * 100) : 0;

  useEffect(() => {
    voterIdRef.current = getOrCreateVoterId();
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("comparison_row_votes")
          .select("feature_label, voter_id, vote_type")
          .eq("vote_type", "verify");
        if (cancelled || error) return;
        const counts = {};
        const mine = new Set();
        for (const r of data || []) {
          counts[r.feature_label] = (counts[r.feature_label] || 0) + 1;
          if (r.voter_id === voterIdRef.current) mine.add(r.feature_label);
        }
        setVoteCounts(counts);
        setMyVotes(mine);
      } catch (e) {
        console.warn("vote load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleVerify(featureLabel, categoryId) {
    if (myVotes.has(featureLabel)) return;
    setMyVotes((prev) => new Set(prev).add(featureLabel));
    setVoteCounts((prev) => ({ ...prev, [featureLabel]: (prev[featureLabel] || 0) + 1 }));
    try {
      const { error } = await supabase.from("comparison_row_votes").insert({
        feature_label: featureLabel,
        category_id: categoryId,
        voter_id: voterIdRef.current,
        vote_type: "verify",
      });
      if (error && error.code !== "23505") throw error;
    } catch (e) {
      console.warn("verify save failed:", e);
      setMyVotes((prev) => { const s = new Set(prev); s.delete(featureLabel); return s; });
      setVoteCounts((prev) => ({ ...prev, [featureLabel]: Math.max(0, (prev[featureLabel] || 0) - 1) }));
    }
  }

  function openFeedbackForRow(featureLabel, categoryId) {
    setFeedbackPrefill({ feature: featureLabel, category: categoryId });
    setFeedbackOpen(true);
  }

  function closeFeedback() {
    setFeedbackOpen(false);
    setFeedbackPrefill({ feature: null, category: null });
  }

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <Nav />

      {/* Compact hero */}
      <header style={{ maxWidth: 920, margin: "0 auto", padding: "110px 20px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 8 }}>Side by side · community verified</div>
        <h1 style={{
          fontFamily: "Georgia, 'Iowan Old Style', serif",
          fontSize: "clamp(26px, 4.5vw, 38px)",
          fontWeight: 700, lineHeight: 1.18,
          color: C.forestInk,
          margin: "0 0 10px", letterSpacing: "-0.022em",
        }}>
          Solo massage software, <em style={{ color: C.gold, fontStyle: "italic" }}>compared honestly.</em>
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: C.inkSoft, maxWidth: 580, margin: "0 auto 14px" }}>
          Seven platforms. Tap <strong style={{ color: C.forest }}>Verify</strong> on rows you can confirm. Tap <strong style={{ color: C.forest }}>⚠ Wrong?</strong> to suggest a correction. Each card screenshots cleanly.
        </p>
        <a href="/comparison/printable" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: C.forest, color: "#fff", textDecoration: "none",
          padding: "8px 18px", borderRadius: 99,
          fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 12px rgba(42,87,65,0.18)",
        }}>
          <span style={{ fontSize: 14 }}>📄</span> Get the one-page printable
        </a>
      </header>

      {/* Community verification scoreboard — compact */}
      <section style={{ maxWidth: 720, margin: "0 auto 16px", padding: "0 20px" }}>
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 8px rgba(31,58,44,0.04)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: C.inkSofter, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Community verification</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: C.forestInk, fontVariantNumeric: "tabular-nums" }}>{verifiedRowCount}</span>
              <span style={{ fontSize: 12, color: C.inkSofter }}>of {totalRows} rows verified</span>
            </div>
            <div style={{ marginTop: 5, height: 4, background: C.beige, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${verifiedPct}%`, background: `linear-gradient(90deg, ${C.sage} 0%, ${C.forest} 100%)`, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: C.forest, fontVariantNumeric: "tabular-nums" }}>{verifiedPct}%</div>
        </div>
      </section>

      {/* Quick answers — its own card */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px 12px" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(31,58,44,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: `linear-gradient(180deg, ${C.creamSoft} 0%, #fff 100%)`, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 11, color: C.gold, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>0.0</span>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 15.5, fontWeight: 700, color: C.forestInk, margin: 0, letterSpacing: "-0.005em" }}>Five questions therapists ask first</h3>
              <span style={{ fontSize: 11.5, color: C.inkSofter, marginLeft: "auto" }}>Quick scan before the categories</span>
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
          <CategoryCard
            key={cat.id}
            cat={cat}
            voteCounts={voteCounts}
            myVotes={myVotes}
            onVerify={handleVerify}
            onWrongRow={openFeedbackForRow}
          />
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

      {/* CTA — compact */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "8px 20px 36px" }}>
        <div style={{ background: `linear-gradient(135deg, ${C.forest} 0%, ${C.forestDeep} 100%)`, color: "#fff", borderRadius: 16, padding: "26px 22px", textAlign: "center", boxShadow: "0 12px 36px rgba(42,87,65,0.22)" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#FBF4DC", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 8 }}>30-day free trial · no card</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, margin: "0 0 10px", lineHeight: 1.25 }}>See how MyBodyMap fits your practice.</h2>
          <Link to="/signup" style={{ display: "inline-block", background: "#fff", color: C.forest, textDecoration: "none", padding: "11px 26px", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
            Start free →
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section style={{ maxWidth: 720, margin: "0 auto 28px", padding: "0 20px" }}>
        <p style={{ fontSize: 11, color: C.inkSofter, textAlign: "center", lineHeight: 1.55, margin: 0, fontStyle: "italic" }}>
          Comparison based on publicly available pricing and feature documentation as of May 2026. Pricing and features change. Verify directly with each provider before signing up. We are not 100% certain of every cell — that is why we ask the community to help us improve. Tap any row's Verify button to confirm or Wrong? to flag a correction.
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
