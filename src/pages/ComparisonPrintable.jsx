// src/pages/ComparisonPrintable.jsx
//
// Single-page printable / screenshot-shareable comparison artifact.
//
// Why this page exists:
// The /comparison page is informational. People can pass the link, but
// the page itself doesn't travel — you can't paste a long scrolling
// page into a Facebook group or DM. This page is the marketing
// artifact: ONE viewport-tall card that captures the entire pitch.
// Save as PNG via screenshot. Print as PDF. Share anywhere.
//
// Design constraints:
// - Fits in a single screen-height for screenshot capture (no scroll)
// - Clean A4/Letter portrait when printed
// - Survives black-and-white printing (color is supplemental, not load-bearing)
// - URL footer + verified-date stamp for credibility
// - No interactive elements (Verify/Wrong buttons stripped — this is a
//   poster, not the live comparison)
// - Content is curated, not exhaustive — picks the 12-15 highest-leverage
//   rows from the full /comparison page, organized as differentiators

import React from "react";
import { PLATFORMS } from "../data/comparisonData";

const C = {
  cream: "#FAF6EE",
  forest: "#2A5741",
  forestInk: "#1F3A2C",
  forestDeep: "#1A3A28",
  sage: "#7A9C84",
  gold: "#B0902F",
  goldChip: "#FBF4DC",
  ink: "#1F3A2C",
  inkSoft: "#4B5563",
  inkSofter: "#6B7280",
  border: "rgba(31,58,44,0.10)",
  borderStrong: "rgba(31,58,44,0.18)",
  yes: "#2A5741",
  yesBg: "#E8F0EA",
  no: "#C8CDC4",
  addon: "#B0902F",
  addonBg: "#FBF4DC",
  planned: "#7A6325",
  plannedBg: "#F5EBC7",
  tbc: "#9CB0A0",
};

// Curated rows for the printable. Picks differentiators and most-asked
// rows from the full taxonomy. Order matters — top rows are where
// MyBodyMap shines, bottom rows are honest "we don't have this yet".
const PRINTABLE_ROWS = [
  // Where MyBodyMap is unique
  { f: "Visual body map intake (front & back, tap-to-mark)",       bm:"yes",     mb:"yes",  vg:"no",     gg:"no",    ac:"no",    mi:"no",    no:"yes",   star: true },
  { f: "Pattern intelligence (heatmap of recurring areas)",        bm:"yes",     mb:"no",   vg:"no",     gg:"no",    ac:"no",    mi:"no",    no:"no",    star: true },
  { f: "pre-session brief from history",                        bm:"yes",     mb:"no",   vg:"no",     gg:"no",    ac:"no",    mi:"no",    no:"no",    star: true },
  { f: "Reads your paper intake forms (AI fills fields)",          bm:"yes",     mb:"no",   vg:"no",     gg:"no",    ac:"no",    mi:"no",    no:"no",    star: true },
  { f: "Remembers the whole client (history + memory)",            bm:"yes",     mb:"no",   vg:"no",     gg:"no",    ac:"no",    mi:"yes",   no:"yes",   star: true },
  { f: "Personalized campaign emails (per-recipient)",             bm:"yes",     mb:"no",   vg:"yes",    gg:"yes",   ac:"no",    mi:"yes",   no:"yes",   star: true },
  { f: "Campaign starter (one-tap drafts)",                     bm:"yes",     mb:"no",   vg:"no",     gg:"no",    ac:"no",    mi:"no",    no:"no",    star: true },
  { f: "Daily evening pulse digest",                               bm:"yes",     mb:"no",   vg:"no",     gg:"no",    ac:"no",    mi:"no",    no:"no",    star: true },
  { f: "Approve/decline bookings (one-toggle)",                    bm:"yes",     mb:"tbc",  vg:"yes",    gg:"yes",   ac:"yes",   mi:"yes",   no:"tbc" },
  { f: "Require intake before booking (one-toggle)",               bm:"yes",     mb:"tbc",  vg:"tbc",    gg:"tbc",   ac:"tbc",   mi:"tbc",   no:"tbc" },
  // Table-stakes
  { f: "Online booking + auto reminders (email + SMS)",            bm:"yes",     mb:"yes",  vg:"yes",    gg:"yes",   ac:"yes+",  mi:"yes",   no:"yes" },
  { f: "Stripe / Square integration",                              bm:"yes",     mb:"yes",  vg:"no",     gg:"no",    ac:"yes",   mi:"no",    no:"yes" },
  { f: "Memberships + packages",                                   bm:"yes",     mb:"yes",  vg:"yes",    gg:"yes",   ac:"yes+",  mi:"yes",   no:"yes" },
  { f: "SOAP notes",                                               bm:"yes",     mb:"yes",  vg:"addon",  gg:"yes",   ac:"yes",   mi:"yes",   no:"yes" },
  // Where competitors win
  { f: "Voice-to-SOAP scribe",                                     bm:"no",      mb:"no",   vg:"no",     gg:"no",    ac:"no",    mi:"no",    no:"yes" },
  { f: "Insurance billing (CMS-1500)",                             bm:"no",      mb:"no",   vg:"no",     gg:"no",    ac:"no",    mi:"no",    no:"yes" },
  { f: "Public marketplace listing",                               bm:"no",      mb:"yes",  vg:"yes",    gg:"no",    ac:"no",    mi:"yes",   no:"no" },
];

function PrintMark({ value, highlight = false }) {
  if (value === "yes") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: 8,
        background: highlight ? C.forest : C.yesBg,
        color: highlight ? "#fff" : C.yes,
      }}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6l2.5 2.5L9.5 3.5"/>
        </svg>
      </span>
    );
  }
  if (value === "yes+") {
    return <span style={{ fontSize: 7.5, fontWeight: 700, color: C.yes, letterSpacing: "0.04em" }}>UPPER</span>;
  }
  if (value === "addon") {
    return <span style={{ fontSize: 7.5, fontWeight: 700, color: C.addon, letterSpacing: "0.04em" }}>+$</span>;
  }
  if (value === "no") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, color: C.no }}>
        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M3 3l6 6M9 3l-6 6"/>
        </svg>
      </span>
    );
  }
  if (value === "tbc") {
    return <span style={{ fontSize: 12, color: C.tbc }}>—</span>;
  }
  return null;
}

export default function ComparisonPrintable() {
  const verifiedDate = "May 2026";

  return (
    <>
      {/* Print + screenshot styles. Force letter portrait when printed. */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.4in; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border: 1px solid #ccc !important; page-break-inside: avoid; }
        }
        @media screen {
          body { background: ${C.cream}; }
        }
      `}</style>

      {/* Top toolbar — only visible on screen, hidden on print/screenshot */}
      <div className="no-print" style={{
        background: "#fff", borderBottom: `1px solid ${C.border}`, padding: "12px 20px",
        display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 50,
      }}>
        <a href="/comparison" style={{ color: C.forest, textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          ← Back to full comparison
        </a>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: C.inkSofter }}>Tip: Use ⌘+P to save as PDF, or screenshot the card below to share as an image</span>
        <button onClick={() => window.print()} style={{
          background: C.forest, color: "#fff", border: "none", borderRadius: 8,
          padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>Print / Save PDF</button>
      </div>

      {/* The shareable card. This is the artifact. */}
      <div style={{ padding: "24px 20px 60px", maxWidth: 800, margin: "0 auto" }}>
        <div className="print-card" style={{
          background: "#fff",
          borderRadius: 16,
          padding: "28px 32px 24px",
          boxShadow: "0 8px 32px rgba(31,58,44,0.10)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>

          {/* Header: branding + headline + verified stamp */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>
                Massage software
              </div>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 700, color: C.forestInk, margin: "0 0 4px", letterSpacing: "-0.018em", lineHeight: 1.15 }}>
                Compared <em style={{ color: C.gold, fontStyle: "italic" }}>honestly.</em>
              </h1>
              <div style={{ fontSize: 11.5, color: C.inkSofter }}>Seven platforms · 15 most-asked features</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-block", border: `1.5px solid ${C.forest}`, borderRadius: 6, padding: "4px 9px", fontSize: 9.5, fontWeight: 700, color: C.forest, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                Verified {verifiedDate}
              </div>
              <div style={{ fontSize: 10, color: C.inkSofter, fontWeight: 600 }}>mybodymap.app/comparison</div>
            </div>
          </div>

          {/* Pricing strip */}
          <div style={{ marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                {PLATFORMS.map((p) => <col key={p.id} style={{ width: `${100 / PLATFORMS.length}%` }} />)}
              </colgroup>
              <tbody>
                <tr>
                  {PLATFORMS.map((p) => (
                    <td key={p.id} style={{
                      padding: "8px 4px",
                      textAlign: "center",
                      borderRight: `1px solid ${C.border}`,
                      background: p.highlight ? C.yesBg : "transparent",
                      lineHeight: 1.2,
                    }}>
                      <div style={{ fontSize: p.highlight ? 11 : 10.5, fontWeight: 700, color: p.highlight ? C.forest : C.forestInk }}>{p.name}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: p.highlight ? C.forest : C.forestInk, marginTop: 2, fontFamily: "Georgia, serif", fontVariantNumeric: "tabular-nums" }}>
                        ${p.priceFrom}
                        <span style={{ fontSize: 9, fontWeight: 600, color: p.highlight ? C.forest : C.inkSofter }}>/mo</span>
                      </div>
                      {p.priceFrom === 0 && (
                        <div style={{ fontSize: 7.5, fontWeight: 700, color: C.forest, letterSpacing: "0.06em", marginTop: 1 }}>FREE TIER</div>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Feature matrix */}
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginBottom: 16 }}>
            <colgroup>
              <col style={{ width: "44%" }} />
              {PLATFORMS.map((p) => <col key={p.id} style={{ width: `${56 / PLATFORMS.length}%` }} />)}
            </colgroup>
            <tbody>
              {PRINTABLE_ROWS.map((row, i) => (
                <tr key={i} style={{ background: row.star ? "rgba(232, 240, 234, 0.25)" : "transparent" }}>
                  <td style={{
                    padding: "5px 8px 5px 4px",
                    fontSize: 10.5,
                    color: C.ink,
                    borderBottom: `1px solid ${C.border}`,
                    lineHeight: 1.3,
                  }}>
                    {row.star && <span style={{ color: C.gold, fontWeight: 700, marginRight: 4 }}>★</span>}
                    {row.f}
                  </td>
                  {PLATFORMS.map((p) => (
                    <td key={p.id} style={{
                      textAlign: "center",
                      padding: "5px 2px",
                      borderBottom: `1px solid ${C.border}`,
                      borderLeft: `1px solid ${C.border}`,
                      background: p.highlight ? "rgba(232, 240, 234, 0.4)" : "transparent",
                    }}>
                      <PrintMark value={row[p.id]} highlight={p.highlight} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend + tagline */}
          <div style={{ display: "flex", gap: 10, fontSize: 9, color: C.inkSoft, justifyContent: "center", paddingBottom: 10, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><PrintMark value="yes"/> Available</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><PrintMark value="yes+"/> Higher tier</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><PrintMark value="addon"/> Paid add-on</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><PrintMark value="no"/> Not available</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><PrintMark value="tbc"/> Awaiting community input</span>
            <span style={{ marginLeft: 4, color: C.gold, fontWeight: 700 }}>★ Where MyBodyMap is unique</span>
          </div>

          {/* Footer: pitch + URL */}
          <div style={{ paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 13, fontWeight: 700, color: C.forestInk, marginBottom: 2, letterSpacing: "-0.01em" }}>
                The only platform built for retention through pattern intelligence.
              </div>
              <div style={{ fontSize: 10, color: C.inkSoft, lineHeight: 1.4 }}>
                Free Bronze tier with last 5 sessions of pattern data. Silver $9/mo for full history. 30-day trial on Silver and Gold, no card required.
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: C.forest, letterSpacing: "-0.01em" }}>
                mybodymap.app
              </div>
              <div style={{ fontSize: 9.5, color: C.inkSofter, fontStyle: "italic" }}>
                Help keep this honest — see /comparison
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer below the card, screen-only */}
        <p className="no-print" style={{ fontSize: 11, color: C.inkSofter, textAlign: "center", marginTop: 14, lineHeight: 1.5, fontStyle: "italic", maxWidth: 600, margin: "14px auto 0" }}>
          Comparison based on publicly verified pricing and feature documentation as of May 2026. Pricing and features change. Verify directly with each provider before signing up. Cells marked with a dash are awaiting community verification at mybodymap.app/comparison.
        </p>
      </div>
    </>
  );
}
