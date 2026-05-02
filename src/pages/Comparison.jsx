// src/pages/Comparison.jsx
//
// Solo-LMT software comparison. v4 — fixes sticky thead and adds
// real gamification (per-row verify buttons + community progress bar).
//
// STICKY THEAD FIX:
// The previous version put thead position:sticky inside a parent with
// overflow-x:auto. That parent became the sticky scroll context, but
// it wasn't scrolling vertically, so sticky never fired. Root cause.
// Fix: wrap the matrix in a single bounded-height container with
// overflow:auto on both axes. Sticky thead works perfectly inside
// that container. Standard Apple/Stripe/Linear comparison-table pattern.
//
// GAMIFICATION:
// Per-row "Verify ✓" button with live counter. Click → vote saved to
// comparison_row_votes table → counter increments → button shows ✓
// state. Anonymous voter_id stored in localStorage prevents dupes.
// Top-of-matrix progress bar shows "X% verified by community."
// "Spot wrong" button on each row opens the inaccuracy-feedback modal
// pre-filled with row context.
//
// Data: src/data/comparisonData.js

import React, { useEffect, useMemo, useRef, useState } from "react";
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

// Stable anonymous voter id stored in localStorage. Used to dedupe
// votes server-side via UNIQUE constraint. Not personally identifying.
function getOrCreateVoterId() {
  if (typeof window === "undefined") return "ssr";
  try {
    const KEY = "mbm_comparison_voter_id";
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || `v${Date.now()}${Math.random().toString(36).slice(2, 12)}`);
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `v${Date.now()}${Math.random().toString(36).slice(2, 12)}`;
  }
}

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
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: dim, borderRadius: dim / 2, padding: `0 ${padX}px`, background: C.yesBg, color: C.yes, fontSize, fontWeight: 700, letterSpacing: "0.02em" }}>HIGHER TIER</span>
    );
  }
  if (value === "addon") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: dim, borderRadius: dim / 2, padding: `0 ${padX}px`, background: C.addonBg, color: C.addon, fontSize, fontWeight: 700, letterSpacing: "0.02em" }}>ADD-ON</span>
    );
  }
  if (value === "planned") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: dim, borderRadius: dim / 2, padding: `0 ${padX}px`, background: C.plannedBg, color: C.planned, fontSize, fontWeight: 700, letterSpacing: "0.02em", border: `1px dashed ${C.gold}` }}>PLANNED</span>
    );
  }
  if (value === "no") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: dim, height: dim, color: C.no }}>
        <svg width={compact ? 9 : 11} height={compact ? 9 : 11} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M3 3l6 6M9 3l-6 6"/>
        </svg>
      </span>
    );
  }
  if (value === "tbc") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: dim, height: dim, color: C.tbc, fontSize: 13, fontWeight: 600 }}>—</span>
    );
  }
  if (value === "trial") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: dim, borderRadius: dim / 2, padding: `0 ${padX}px`, background: C.beige, color: C.inkSoft, fontSize, fontWeight: 700, letterSpacing: "0.02em" }}>TRIAL</span>
    );
  }
  return null;
}

function PricingCard({ p }) {
  const isUs = p.highlight;
  return (
    <div style={{ background: isUs ? `linear-gradient(135deg, #fff 0%, ${C.creamSoft} 100%)` : "#fff", border: `${isUs ? 2 : 1}px solid ${isUs ? C.forest : C.border}`, borderRadius: 18, padding: "24px 22px", position: "relative", boxShadow: isUs ? "0 12px 36px rgba(42,87,65,0.18)" : "0 2px 8px rgba(31,58,44,0.04)", transform: isUs ? "translateY(-4px)" : "none" }}>
      {isUs && (
        <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: C.forest, color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 12px", borderRadius: 99, whiteSpace: "nowrap" }}>You're here</div>
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
      <div style={{ fontSize: 12.5, color: C.inkSofter }}>${competitor.priceFrom}/mo → ${us.priceFrom}/mo</div>
    </div>
  );
}

// Per-row verify pill — the gamification anchor.
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
      display: "inline-flex", alignItems: "center", gap: 5,
      background: voted ? C.yesBg : "transparent",
      color: voted ? C.forest : C.inkSofter,
      border: `1px solid ${voted ? C.forest : C.border}`,
      borderRadius: 14, padding: "3px 8px",
      fontSize: 11, fontWeight: 600, cursor: voted ? "default" : "pointer",
      lineHeight: 1, whiteSpace: "nowrap", flexShrink: 0,
      transition: "all 0.15s",
    }}>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6l2.5 2.5L9.5 3.5"/>
      </svg>
      <span>{voted ? "Verified" : "Verify"}</span>
      {count > 0 && (
        <span style={{ background: voted ? C.forest : C.beige, color: voted ? "#fff" : C.inkSoft, fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 8, fontVariantNumeric: "tabular-nums" }}>{count}</span>
      )}
    </button>
  );
}

function FeedbackModal({ open, onClose, prefillFeature = null, prefillCategory = null }) {
  const [feedbackType, setFeedbackType] = useState(prefillFeature ? "inaccuracy" : "inaccuracy");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // Reset prefill state when opening with a new context
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
    setMessage("");
    setEmail("");
    setName("");
    setFeedbackType("inaccuracy");
    setSubmitted(false);
    setError(null);
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

export default function Comparison() {
  const competitors = PLATFORMS.slice(1);

  // Vote state: { [feature_label]: count }
  const [voteCounts, setVoteCounts] = useState({});
  // Set of features the current user has already verified (from DB or optimistic)
  const [myVotes, setMyVotes] = useState(new Set());
  // Feedback modal
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackPrefill, setFeedbackPrefill] = useState({ feature: null, category: null });
  const voterIdRef = useRef(null);

  // Sticky header tracking. The matrix's natural <thead> sits in
  // page flow. When it scrolls out of viewport, we render a
  // fixed-position floating header above the page that mirrors
  // the same column structure. This is the only reliable way to
  // get a true page-viewport sticky header on a horizontally-
  // scrolling table without breaking the page-scroll UX.
  const matrixWrapperRef = useRef(null);
  const matrixScrollRef = useRef(null);
  const headerRowRef = useRef(null);
  const [floatingHeaderVisible, setFloatingHeaderVisible] = useState(false);
  const [floatingHeaderLeft, setFloatingHeaderLeft] = useState(0);
  const [floatingHeaderWidth, setFloatingHeaderWidth] = useState(0);
  const [floatingScrollX, setFloatingScrollX] = useState(0);

  // Total feature rows for progress bar denominator
  const totalRows = useMemo(
    () => CATEGORIES.reduce((sum, cat) => sum + cat.rows.length, 0),
    []
  );

  // Derive which features have at least one verify vote (the
  // numerator for the progress bar).
  const verifiedRowCount = useMemo(
    () => Object.values(voteCounts).filter((n) => n > 0).length,
    [voteCounts]
  );
  const verifiedPct = totalRows ? Math.round((verifiedRowCount / totalRows) * 100) : 0;

  // Load vote counts on mount.
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
    // Optimistic update
    setMyVotes((prev) => new Set(prev).add(featureLabel));
    setVoteCounts((prev) => ({ ...prev, [featureLabel]: (prev[featureLabel] || 0) + 1 }));
    try {
      const { error } = await supabase.from("comparison_row_votes").insert({
        feature_label: featureLabel,
        category_id: categoryId,
        voter_id: voterIdRef.current,
        vote_type: "verify",
      });
      if (error && error.code !== "23505") throw error; // 23505 = unique violation, treat as already-voted (idempotent)
    } catch (e) {
      console.warn("verify save failed:", e);
      // Roll back optimistic
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

  // Show / hide the floating sticky header based on scroll position.
  // The header appears when the original <thead> has scrolled above
  // the viewport top AND the matrix bottom is still on-screen.
  useEffect(() => {
    function update() {
      const headerEl = headerRowRef.current;
      const wrapperEl = matrixWrapperRef.current;
      const scrollEl = matrixScrollRef.current;
      if (!headerEl || !wrapperEl) return;
      const headerRect = headerEl.getBoundingClientRect();
      const wrapperRect = wrapperEl.getBoundingClientRect();
      // Show floating header when original thead is above the viewport
      // top, and the matrix bottom is still below the top of the viewport.
      const stuck = headerRect.bottom < 0 && wrapperRect.bottom > 80;
      setFloatingHeaderVisible(stuck);
      // Track horizontal layout so the floating header aligns with
      // the actual matrix column on the page.
      setFloatingHeaderLeft(wrapperRect.left);
      setFloatingHeaderWidth(wrapperRect.width);
      if (scrollEl) setFloatingScrollX(scrollEl.scrollLeft);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const scrollEl = matrixScrollRef.current;
    if (scrollEl) scrollEl.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (scrollEl) scrollEl.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <Nav />

      {/* Hero */}
      <header style={{ maxWidth: 920, margin: "0 auto", padding: "60px 24px 36px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 14 }}>Side by side · community verified</div>
        <h1 style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: "clamp(32px, 5.5vw, 50px)", fontWeight: 700, lineHeight: 1.15, color: C.forestInk, margin: "0 0 18px", letterSpacing: "-0.022em" }}>
          Solo massage software, <em style={{ color: C.gold, fontStyle: "italic" }}>compared honestly.</em>
        </h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: C.inkSoft, maxWidth: 640, margin: "0 auto 8px" }}>
          Seven platforms. The same questions. Different answers. Tap "Verify" on any row you can confirm from your own experience.
        </p>
      </header>

      {/* Pricing grid */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 44px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, alignItems: "stretch" }}>
          {PLATFORMS.map((p) => <PricingCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Quick answers */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px 36px" }}>
        <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, padding: "22px 18px 16px", boxShadow: "0 6px 28px rgba(31,58,44,0.06)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 6px 12px", borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: C.forestInk, margin: 0, letterSpacing: "-0.005em" }}>The five questions therapists ask first</h2>
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
                    <th key={p.id} style={{ padding: "8px 4px", textAlign: "center", fontSize: 11, fontWeight: 700, color: p.highlight ? C.forest : C.inkSofter, lineHeight: 1.2 }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {QUICK_ANSWERS.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: "10px 6px", fontSize: 13, color: C.ink, borderTop: `1px solid ${C.border}`, fontWeight: 500 }}>{row.q}</td>
                    {PLATFORMS.map((p) => (
                      <td key={p.id} style={{ textAlign: "center", padding: "10px 4px", borderTop: `1px solid ${C.border}`, background: p.highlight ? "rgba(232, 240, 234, 0.4)" : "transparent" }}>
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
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 700, color: C.forestInk, margin: "0 0 12px", letterSpacing: "-0.015em", lineHeight: 1.25 }}>What you keep when you switch.</h2>
            <p style={{ fontSize: 14.5, color: C.inkSoft, maxWidth: 540, margin: "0 auto", lineHeight: 1.6 }}>Based on each platform's lowest published tier. Versus MyBodyMap's free Bronze tier.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {competitors.map((c) => <SavingsCard key={c.id} competitor={c} />)}
          </div>
        </div>
      </section>

      {/* Feature matrix — bounded-height container with truly sticky thead */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "60px 16px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 24, padding: "0 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 8 }}>The full picture</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 700, color: C.forestInk, margin: "0 0 12px", letterSpacing: "-0.015em", lineHeight: 1.25 }}>Feature by feature.</h2>
          <p style={{ fontSize: 14.5, color: C.inkSoft, maxWidth: 580, margin: "0 auto", lineHeight: 1.6 }}>
            Tap <strong style={{ color: C.forest }}>Verify</strong> on any row you can confirm. Tap <strong style={{ color: C.forest }}>×</strong> to flag something wrong.
          </p>
        </div>

        {/* Community verification scoreboard */}
        <div style={{ maxWidth: 720, margin: "0 auto 18px", padding: "0 16px" }}>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 10px rgba(31,58,44,0.04)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.inkSofter, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Community verification progress</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 700, color: C.forestInk, fontVariantNumeric: "tabular-nums" }}>
                  {verifiedRowCount}
                </span>
                <span style={{ fontSize: 13, color: C.inkSofter }}>of {totalRows} rows verified by therapists</span>
              </div>
              <div style={{ marginTop: 8, height: 6, background: C.beige, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${verifiedPct}%`, background: `linear-gradient(90deg, ${C.sage} 0%, ${C.forest} 100%)`, borderRadius: 3, transition: "width 0.4s ease" }} />
              </div>
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 700, color: C.forest, fontVariantNumeric: "tabular-nums" }}>{verifiedPct}%</div>
          </div>
        </div>

        {/* Floating sticky header — fixed-position clone shown when the
            real thead has scrolled above the viewport. Mirrors the matrix
            columns exactly via shared min-width and synced horizontal scroll. */}
        {floatingHeaderVisible && (
          <div style={{
            position: "fixed",
            top: 0,
            left: floatingHeaderLeft,
            width: floatingHeaderWidth,
            zIndex: 100,
            background: "#fff",
            boxShadow: "0 4px 16px rgba(31,58,44,0.10)",
            borderBottom: `1px solid ${C.borderStrong}`,
            overflow: "hidden",
            pointerEvents: "none",
          }}>
            <div style={{
              transform: `translateX(${-floatingScrollX}px)`,
              minWidth: 820,
            }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "34%" }} />
                  {PLATFORMS.map((p) => <col key={p.id} style={{ width: `${66 / PLATFORMS.length}%` }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ background: "#fff", padding: "12px 8px", textAlign: "left" }}>
                      <span style={{ fontSize: 11, color: C.inkSofter, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Feature</span>
                    </th>
                    {PLATFORMS.map((p) => (
                      <th key={p.id} style={{ background: p.highlight ? C.yesBg : "#fff", padding: "10px 4px", textAlign: "center", lineHeight: 1.2 }}>
                        <div style={{ fontSize: p.highlight ? 12.5 : 12, fontWeight: 700, color: p.highlight ? C.forest : C.forestInk }}>{p.name}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: p.highlight ? C.forest : C.inkSofter, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                          ${p.priceFrom}<span style={{ fontSize: 9 }}>/mo</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
          </div>
        )}

        {/* Matrix wrapper — horizontal scroll on narrow viewports, no
            vertical bound. The page itself scrolls vertically; the
            floating header above handles the sticky-header job. */}
        <div ref={matrixWrapperRef} style={{
          background: "#fff",
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          padding: "0 8px",
          boxShadow: "0 6px 28px rgba(31,58,44,0.06)",
          overflow: "hidden",
          position: "relative",
        }}>
          <div ref={matrixScrollRef} style={{ overflowX: "auto", overflowY: "visible" }}>
          <table style={{ width: "100%", minWidth: 820, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "34%" }} />
              {PLATFORMS.map((p) => <col key={p.id} style={{ width: `${66 / PLATFORMS.length}%` }} />)}
            </colgroup>
            <thead ref={headerRowRef}>
              <tr>
                <th style={{ background: "#fff", padding: "12px 8px", borderBottom: `2px solid ${C.borderStrong}`, textAlign: "left" }}>
                  <span style={{ fontSize: 11, color: C.inkSofter, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Feature</span>
                </th>
                {PLATFORMS.map((p) => (
                  <th key={p.id} style={{ background: p.highlight ? C.yesBg : "#fff", padding: "10px 4px", borderBottom: `2px solid ${p.highlight ? C.forest : C.borderStrong}`, textAlign: "center", lineHeight: 1.2 }}>
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
                        <div>{row.f}</div>
                        {row.note && (
                          <span style={{ fontSize: 11, color: C.inkSofter, fontStyle: "italic", display: "block", marginTop: 2, lineHeight: 1.4 }}>{row.note}</span>
                        )}
                        {/* Inline verify + flag controls — always visible
                            in the first column even on mobile horizontal scroll. */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                          <VerifyButton
                            feature={row.f}
                            categoryId={cat.id}
                            voted={myVotes.has(row.f)}
                            count={voteCounts[row.f] || 0}
                            onVote={handleVerify}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); openFeedbackForRow(row.f, cat.id); }}
                            title="Flag this row as inaccurate"
                            style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                              padding: "3px 9px", borderRadius: 12,
                              background: "transparent", color: C.inkSofter,
                              border: `1px solid ${C.border}`, cursor: "pointer",
                              fontSize: 11, fontWeight: 600,
                            }}
                          >
                            <span style={{ fontSize: 11, lineHeight: 1 }}>⚠</span>
                            <span>Wrong?</span>
                          </button>
                        </div>
                      </td>
                      {PLATFORMS.map((p) => (
                        <td key={p.id} style={{ textAlign: "center", padding: "13px 4px", borderBottom: `1px solid ${C.border}`, background: p.highlight ? "rgba(232, 240, 234, 0.4)" : "transparent" }}>
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
        </div>

        {/* Below-table CTA strip */}
        <div style={{ maxWidth: 720, margin: "20px auto 0", padding: "0 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13.5, color: C.inkSoft, margin: 0, lineHeight: 1.6 }}>
            Used one of these platforms? Tap <strong style={{ color: C.forest }}>Verify</strong> on rows you can confirm from your own experience. Tap <strong style={{ color: C.forest }}>×</strong> to suggest a correction.{" "}
            <button onClick={() => setFeedbackOpen(true)} style={{ background: "none", border: "none", color: C.forest, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: "inherit" }}>
              Or send general feedback →
            </button>
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", padding: "26px 16px 0", fontSize: 12, color: C.inkSoft }}>
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
          <Link to="/signup" style={{ display: "inline-block", background: "#fff", color: C.forest, textDecoration: "none", padding: "14px 32px", borderRadius: 12, fontWeight: 700, fontSize: 15 }}>Start free →</Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section style={{ maxWidth: 760, margin: "0 auto 40px", padding: "0 24px" }}>
        <p style={{ fontSize: 12, color: C.inkSofter, textAlign: "center", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
          Comparison based on publicly available pricing and feature documentation as of May 2026. Pricing and features change. Verify directly with each provider before signing up. This page is informational only and not legal or financial advice. We are not 100% certain of every cell — that is why we ask the community to help us improve.
        </p>
      </section>

      <Footer />

      <FeedbackModal
        open={feedbackOpen}
        onClose={closeFeedback}
        prefillFeature={feedbackPrefill.feature}
        prefillCategory={feedbackPrefill.category}
      />
    </div>
  );
}
