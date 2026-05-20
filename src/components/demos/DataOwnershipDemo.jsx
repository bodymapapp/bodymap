// src/components/demos/DataOwnershipDemo.jsx
//
// HK feedback May 19 2026: 'I still dont like the animation on
// download all my data... it is too small... why cant we have a
// simple table with some animation on what we provide and others
// dont?'
//
// Replaced the side-by-side mini-panels with a real comparison table.
// Rows reveal progressively (one every 400ms) so the eye has time
// to land on each row. After all rows are visible, table stays
// settled. No loop. Calm.
//
// All competitor claims sourced from public support docs (May 2026).
// Sources cited in the parent commit. Per HK design principle #19:
// 100% factual, no hallucination.

import React, { useEffect, useState } from "react";

const PALETTE = {
  forest: "#2A5741",
  forestDeep: "#1F4131",
  sage: "#6B9E80",
  sageSoft: "#B7D1AB",
  sageTint: "#F0F6EE",
  cream: "#FAF6EE",
  creamDeep: "#F5EFE0",
  creamEdge: "#EDE6D6",
  white: "#FFFFFF",
  gray700: "#374151",
  gray500: "#6B7280",
  gray400: "#9CA3AF",
  gray300: "#D1D5DB",
  gray100: "#F3F4F6",
  ink: "#1F2937",
  successFill: "#DCFCE7",
  successBorder: "#86EFAC",
  successText: "#15803D",
  warnFill: "#FEF3C7",
  warnBorder: "#FDE68A",
  warnText: "#92400E",
  failFill: "#FEE2E2",
  failBorder: "#FCA5A5",
  failText: "#991B1B",
};

// Rows are content the export contains, ordered the way a therapist
// would think about her practice: clients first, then sessions, then
// money, then settings. Six rows total. Short enough to scan, long
// enough to make the point.
//
// Cell values use one of three states:
//   yes  -> green check, label
//   partial -> amber dash, label
//   no   -> red x, 'Not available'
//
// All competitor claims verified May 19 2026 from these sources:
// Vagaro support articles 360006371094 (clients), 360000242193
// (calendar), 360000550993 (appointments), Vagaro guide on Exporting
// Customer Notes; MassageBook support articles 18572149119757
// (client list), 18572085380621 (SOAP one PDF at a time); Acuity
// support article 16676916553485 (appointments + clients).

const ROWS = [
  {
    label: "Clients",
    mbm:        { state: "yes", text: "Included" },
    vagaro:     { state: "yes", text: "Separate export" },
    massagebook:{ state: "yes", text: "Separate export" },
    acuity:     { state: "yes", text: "Separate export" },
  },
  {
    label: "Bookings",
    mbm:        { state: "yes", text: "Included" },
    vagaro:     { state: "yes", text: "Separate export" },
    massagebook:{ state: "yes", text: "Separate export" },
    acuity:     { state: "yes", text: "Separate export" },
  },
  {
    label: "SOAP notes",
    mbm:        { state: "yes",     text: "All in one file" },
    vagaro:     { state: "no",      text: "Not exportable" },
    massagebook:{ state: "partial", text: "One PDF at a time" },
    acuity:     { state: "no",      text: "Not in platform" },
  },
  {
    label: "Intake answers",
    mbm:        { state: "yes",     text: "All in one file" },
    vagaro:     { state: "partial", text: "Notes field only" },
    massagebook:{ state: "partial", text: "One PDF at a time" },
    acuity:     { state: "yes",     text: "With appointments" },
  },
  {
    label: "Payment records",
    mbm:        { state: "yes",     text: "Included" },
    vagaro:     { state: "partial", text: "In reports" },
    massagebook:{ state: "partial", text: "In reports" },
    acuity:     { state: "partial", text: "In reports" },
  },
  {
    label: "All in one ZIP",
    mbm:        { state: "yes", text: "Yes, one file" },
    vagaro:     { state: "no",  text: "Separate exports" },
    massagebook:{ state: "no",  text: "Separate exports" },
    acuity:     { state: "no",  text: "Separate exports" },
  },
];

const COLUMNS = ["mbm", "vagaro", "massagebook", "acuity"];
const COLUMN_LABELS = {
  mbm: "MyBodyMap",
  vagaro: "Vagaro",
  massagebook: "MassageBook",
  acuity: "Acuity",
};

// Reveal one row every 400ms after mount
const REVEAL_INTERVAL_MS = 400;

function Cell({ state, text }) {
  const palette = state === "yes"
    ? { bg: PALETTE.successFill, border: PALETTE.successBorder, text: PALETTE.successText, icon: "✓" }
    : state === "partial"
      ? { bg: PALETTE.warnFill, border: PALETTE.warnBorder, text: PALETTE.warnText, icon: "–" }
      : { bg: PALETTE.failFill, border: PALETTE.failBorder, text: PALETTE.failText, icon: "✕" };
  return (
    <div style={{
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: 7,
      padding: "5px 8px",
      fontSize: 11,
      fontWeight: 600,
      color: palette.text,
      textAlign: "center",
      lineHeight: 1.3,
      minHeight: 30,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{palette.icon}</span>
      <span>{text}</span>
    </div>
  );
}

export default function DataOwnershipDemo() {
  const [rowsRevealed, setRowsRevealed] = useState(0);

  useEffect(() => {
    if (rowsRevealed >= ROWS.length) return;
    const t = setTimeout(() => setRowsRevealed((n) => n + 1), REVEAL_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [rowsRevealed]);

  return (
    <div style={{
      width: "100%",
      maxWidth: 600,
      margin: "0 auto",
      background: PALETTE.cream,
      borderRadius: 18,
      padding: 18,
      boxShadow: "0 4px 16px rgba(31, 65, 49, 0.08)",
      border: `1px solid ${PALETTE.creamEdge}`,
    }}>
      {/* Title */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 22,
        fontWeight: 700,
        color: PALETTE.forestDeep,
        textAlign: "center",
        marginBottom: 4,
        lineHeight: 1.2,
      }}>
        Exporting your data: who lets you take what
      </div>
      <div style={{
        fontSize: 11.5,
        color: PALETTE.gray500,
        textAlign: "center",
        marginBottom: 16,
        fontStyle: "italic",
        fontFamily: "Georgia, serif",
      }}>
        Verified from each platform's support pages, May 2026
      </div>

      {/* Header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(90px, 1.2fr) repeat(4, minmax(70px, 1fr))",
        gap: 6,
        marginBottom: 6,
        alignItems: "stretch",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: PALETTE.gray500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "8px 4px",
          alignSelf: "end",
        }}>
          What's in the export
        </div>
        {COLUMNS.map((col) => {
          const isMBM = col === "mbm";
          return (
            <div
              key={col}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: isMBM ? PALETTE.white : PALETTE.gray700,
                background: isMBM ? PALETTE.forest : PALETTE.creamDeep,
                border: isMBM ? "none" : `1px solid ${PALETTE.creamEdge}`,
                borderRadius: 8,
                padding: "8px 6px",
                textAlign: "center",
                letterSpacing: "0.02em",
              }}
            >
              {COLUMN_LABELS[col]}
            </div>
          );
        })}
      </div>

      {/* Data rows */}
      {ROWS.map((row, idx) => {
        const visible = idx < rowsRevealed;
        return (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(90px, 1.2fr) repeat(4, minmax(70px, 1fr))",
              gap: 6,
              marginBottom: 6,
              alignItems: "stretch",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 0.35s ease, transform 0.35s ease",
            }}
          >
            <div style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: PALETTE.ink,
              padding: "8px 4px",
              alignSelf: "center",
            }}>
              {row.label}
            </div>
            {COLUMNS.map((col) => (
              <Cell key={col} state={row[col].state} text={row[col].text} />
            ))}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{
        marginTop: 14,
        padding: "10px 14px",
        background: PALETTE.sageTint,
        border: `1px solid ${PALETTE.sageSoft}`,
        borderRadius: 10,
        fontSize: 12,
        color: PALETTE.forestDeep,
        lineHeight: 1.5,
        textAlign: "center",
        opacity: rowsRevealed >= ROWS.length ? 1 : 0,
        transition: "opacity 0.5s ease 0.2s",
      }}>
        <strong>One tap. One ZIP. Emailed to you.</strong> Free for every therapist.
      </div>
    </div>
  );
}
