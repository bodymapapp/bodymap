// src/components/demos/ServiceGroupingDemo.jsx
//
// User-controlled service grouping demo. HK feedback May 19 2026:
// 'have a few more services (around 10), and let the visitor toggle
// if needed to group the services...it is going too fast to
// understand what is going on.'
//
// Rewritten:
//   - 10 services instead of 6
//   - User taps the toggle pill to switch between flat and grouped
//   - No auto-loop. Visitor controls the pace
//   - When toggle flips ON, services slide into groups with a 700ms
//     transition so the motion is visible and slow enough to read
//   - Caption text changes to match the current state
//
// Slower, calmer, more interactive.

import React, { useState } from "react";

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
  gray500: "#6B7280",
  gray400: "#9CA3AF",
  gray300: "#D1D5DB",
  ink: "#1F2937",
};

// Ten services, distributed across the six pre-defined groups so the
// demo shows the auto-classifier doing meaningful work. Names chosen
// so a viewer can see why each one lands where it does.
const SERVICES = [
  { id: "s1",  name: "Swedish Massage",   duration: 60, price: 90,  group: "Relaxation & Spa" },
  { id: "s2",  name: "Deep Tissue",       duration: 60, price: 100, group: "Therapeutic & Recovery" },
  { id: "s3",  name: "Prenatal Massage",  duration: 60, price: 95,  group: "Prenatal & Postnatal" },
  { id: "s4",  name: "Hot Stone",         duration: 90, price: 140, group: "Relaxation & Spa" },
  { id: "s5",  name: "Sports Recovery",   duration: 75, price: 120, group: "Therapeutic & Recovery" },
  { id: "s6",  name: "Couples Massage",   duration: 90, price: 180, group: "Couples" },
  { id: "s7",  name: "Reiki Session",     duration: 60, price: 85,  group: "Energy & Modalities" },
  { id: "s8",  name: "Postnatal Massage", duration: 60, price: 95,  group: "Prenatal & Postnatal" },
  { id: "s9",  name: "Aromatherapy",      duration: 60, price: 95,  group: "Relaxation & Spa" },
  { id: "s10", name: "Hot Stone Add-on",  duration: 15, price: 25,  group: "Add-ons" },
];

// Groups in display order. Auto-classifier seeds this from the
// PREDEFINED list, so we mirror it here.
const GROUPS_IN_USE = [
  "Prenatal & Postnatal",
  "Couples",
  "Therapeutic & Recovery",
  "Relaxation & Spa",
  "Energy & Modalities",
  "Add-ons",
];

// Layout constants
const SVG_WIDTH = 360;
const SVG_HEADER_H = 56;
const TOGGLE_H = 50;
const SERVICE_ROW_H = 44;
const SERVICE_GAP = 6;
const GROUP_HEADER_H = 30;
const GROUP_GAP = 14;

export default function ServiceGroupingDemo() {
  const [grouped, setGrouped] = useState(false);

  // Compute Y positions for each service in the current layout.
  function flatY(idx) {
    return SVG_HEADER_H + TOGGLE_H + 12 + idx * (SERVICE_ROW_H + SERVICE_GAP);
  }

  function groupedY(svc) {
    let cursorY = SVG_HEADER_H + TOGGLE_H + 12;
    for (const groupName of GROUPS_IN_USE) {
      const servicesInGroup = SERVICES.filter((s) => s.group === groupName);
      if (servicesInGroup.length === 0) continue;
      cursorY += GROUP_HEADER_H + 6;
      if (groupName === svc.group) {
        const idxInGroup = servicesInGroup.findIndex((s) => s.id === svc.id);
        return cursorY + idxInGroup * (SERVICE_ROW_H + SERVICE_GAP);
      }
      cursorY += servicesInGroup.length * (SERVICE_ROW_H + SERVICE_GAP) + GROUP_GAP;
    }
    return cursorY;
  }

  function groupHeaderY(groupName) {
    let cursorY = SVG_HEADER_H + TOGGLE_H + 12;
    for (const g of GROUPS_IN_USE) {
      const servicesInGroup = SERVICES.filter((s) => s.group === g);
      if (servicesInGroup.length === 0) continue;
      if (g === groupName) return cursorY;
      cursorY += GROUP_HEADER_H + 6 + servicesInGroup.length * (SERVICE_ROW_H + SERVICE_GAP) + GROUP_GAP;
    }
    return cursorY;
  }

  // Total SVG height needed for grouped layout (taller than flat)
  const groupedTotalH = (() => {
    let h = SVG_HEADER_H + TOGGLE_H + 12;
    for (const g of GROUPS_IN_USE) {
      const servicesInGroup = SERVICES.filter((s) => s.group === g);
      if (servicesInGroup.length === 0) continue;
      h += GROUP_HEADER_H + 6 + servicesInGroup.length * (SERVICE_ROW_H + SERVICE_GAP) + GROUP_GAP;
    }
    return h;
  })();
  const flatTotalH = SVG_HEADER_H + TOGGLE_H + 12 + SERVICES.length * (SERVICE_ROW_H + SERVICE_GAP);
  const svgHeight = Math.max(flatTotalH, groupedTotalH) + 8;

  return (
    <div style={{
      width: "100%",
      maxWidth: 420,
      margin: "0 auto",
      background: PALETTE.cream,
      borderRadius: 18,
      padding: 14,
      boxShadow: "0 4px 16px rgba(31, 65, 49, 0.08)",
      border: `1px solid ${PALETTE.creamEdge}`,
      overflow: "hidden",
    }}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        width="100%"
        height="auto"
        style={{ display: "block" }}
        aria-label="Service grouping demo"
      >
        <defs>
          <linearGradient id="sg-toggle-on" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#16A34A" />
            <stop offset="1" stopColor="#22C55E" />
          </linearGradient>
        </defs>

        {/* Header */}
        <text x="14" y="28" fontFamily="'Cormorant Garamond', Georgia, serif" fontSize="22" fontWeight="700" fill={PALETTE.forestDeep}>
          Services
        </text>
        <text x="14" y="44" fontFamily="-apple-system, sans-serif" fontSize="11" fill={PALETTE.gray500}>
          {SERVICES.length} active
        </text>

        {/* Toggle row: TAP to flip */}
        <g
          onClick={() => setGrouped(!grouped)}
          style={{ cursor: "pointer" }}
        >
          <rect
            x="14"
            y={SVG_HEADER_H + 4}
            width={SVG_WIDTH - 28}
            height={TOGGLE_H - 8}
            rx="10"
            fill={grouped ? PALETTE.sageTint : "#FAFAFA"}
            stroke={grouped ? PALETTE.sageSoft : PALETTE.creamEdge}
            strokeWidth="1"
            style={{ transition: "fill 0.5s ease, stroke 0.5s ease" }}
          />
          <text
            x="24"
            y={SVG_HEADER_H + 22}
            fontFamily="-apple-system, sans-serif"
            fontSize="13"
            fontWeight="700"
            fill={PALETTE.ink}
          >
            Organize into groups
          </text>
          <text
            x="24"
            y={SVG_HEADER_H + 36}
            fontFamily="-apple-system, sans-serif"
            fontSize="10"
            fill={PALETTE.gray500}
          >
            {grouped ? "On. Tap to turn off." : "Off. Tap to turn on."}
          </text>
          {/* Toggle pill */}
          <rect
            x={SVG_WIDTH - 64}
            y={SVG_HEADER_H + 13}
            width="40"
            height="22"
            rx="11"
            fill={grouped ? "url(#sg-toggle-on)" : PALETTE.gray300}
            style={{ transition: "fill 0.5s ease" }}
          />
          <circle
            cx={grouped ? SVG_WIDTH - 35 : SVG_WIDTH - 53}
            cy={SVG_HEADER_H + 24}
            r="8"
            fill={PALETTE.white}
            style={{ transition: "cx 0.7s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </g>

        {/* Group headers */}
        {GROUPS_IN_USE.map((groupName) => {
          const servicesInGroup = SERVICES.filter((s) => s.group === groupName);
          if (servicesInGroup.length === 0) return null;
          const y = groupHeaderY(groupName);
          return (
            <g
              key={groupName}
              style={{
                opacity: grouped ? 1 : 0,
                transition: "opacity 0.5s ease 0.2s",
              }}
            >
              <rect
                x="14"
                y={y}
                width={SVG_WIDTH - 28}
                height={GROUP_HEADER_H}
                rx="8"
                fill={PALETTE.sageTint}
                stroke={PALETTE.sageSoft}
                strokeWidth="1"
              />
              <text
                x="24"
                y={y + 20}
                fontFamily="'Cormorant Garamond', Georgia, serif"
                fontSize="14"
                fontWeight="700"
                fill={PALETTE.forestDeep}
              >
                {groupName}
              </text>
              <text
                x={SVG_WIDTH - 24}
                y={y + 20}
                fontFamily="-apple-system, sans-serif"
                fontSize="10"
                fill={PALETTE.gray500}
                textAnchor="end"
              >
                {servicesInGroup.length} service{servicesInGroup.length === 1 ? "" : "s"}
              </text>
            </g>
          );
        })}

        {/* Service cards */}
        {SERVICES.map((svc, idx) => {
          const targetY = grouped ? groupedY(svc) : flatY(idx);
          return (
            <g
              key={svc.id}
              transform={`translate(0, ${targetY})`}
              style={{
                transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <rect
                x="20"
                y="0"
                width={SVG_WIDTH - 40}
                height={SERVICE_ROW_H}
                rx="9"
                fill={PALETTE.white}
                stroke={PALETTE.creamEdge}
                strokeWidth="1"
              />
              <text
                x="32"
                y="18"
                fontFamily="-apple-system, sans-serif"
                fontSize="13"
                fontWeight="700"
                fill={PALETTE.ink}
              >
                {svc.name}
              </text>
              <text
                x="32"
                y="33"
                fontFamily="-apple-system, sans-serif"
                fontSize="11"
                fill={PALETTE.gray500}
              >
                {svc.duration} min · ${svc.price}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Caption + tap hint */}
      <div style={{
        marginTop: 10,
        textAlign: "center",
        fontFamily: "Georgia, serif",
        fontSize: 13,
        fontStyle: "italic",
        color: PALETTE.gray500,
        minHeight: 36,
        lineHeight: 1.5,
        padding: "0 8px",
      }}>
        {grouped
          ? "Auto-classified into 6 groups. Tap the toggle to switch back."
          : "Flat list of 10 services. Tap the toggle above to organize into groups."}
      </div>
    </div>
  );
}
