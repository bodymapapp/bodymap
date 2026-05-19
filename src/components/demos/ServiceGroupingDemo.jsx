// src/components/demos/ServiceGroupingDemo.jsx
//
// Animated SVG demo for the Home page Find & Book ribbon and the
// Features page card 1.x.
//
// Loop story (~6 seconds):
//   Stage 1 (0 to 1.5s): flat list of 6 services. 'Organize into
//     groups' toggle visible at top in OFF position.
//   Stage 2 (1.5s to 3s): toggle slides to ON. Services freeze in
//     place. A small 'auto-classifying...' label fades in.
//   Stage 3 (3s to 5s): services slide into 3 group section
//     headers (Relaxation & Spa, Therapeutic & Recovery, Couples)
//     with their pre-defined group labels. Each service slides up
//     under its destination group header.
//   Stage 4 (5s to 6s): pause. Then loops.
//
// Per HK direction: 'services list flat -> toggle ON -> services
// slide into 6 colored group sections. Loops. Calm.'
//
// Built with framer-motion (already in deps) so animations stay
// smooth on mobile.

import React, { useEffect, useState, useCallback } from "react";

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
  gray300: "#D1D5DB",
  ink: "#1F2937",
};

// Six fixed services and their target groups. Names chosen so the
// pre-defined keyword classifier matches each one cleanly.
const SERVICES = [
  { id: "s1", name: "Swedish Massage", duration: 60, price: 90, group: "Relaxation & Spa" },
  { id: "s2", name: "Deep Tissue", duration: 60, price: 100, group: "Therapeutic & Recovery" },
  { id: "s3", name: "Prenatal Massage", duration: 60, price: 95, group: "Prenatal & Postnatal" },
  { id: "s4", name: "Hot Stone", duration: 90, price: 140, group: "Relaxation & Spa" },
  { id: "s5", name: "Sports Recovery", duration: 75, price: 120, group: "Therapeutic & Recovery" },
  { id: "s6", name: "Couples Massage", duration: 90, price: 180, group: "Couples" },
];

// Three groups in display order. Each gets a slot of services after
// classification.
const GROUPS = [
  { name: "Prenatal & Postnatal", color: PALETTE.sageSoft },
  { name: "Therapeutic & Recovery", color: PALETTE.sageSoft },
  { name: "Relaxation & Spa", color: PALETTE.sageSoft },
  { name: "Couples", color: PALETTE.sageSoft },
];

const STAGE_DURATION_MS = 6000;

export default function ServiceGroupingDemo() {
  // 0 = flat list shown
  // 1 = toggle flipping
  // 2 = services regrouping (animating into groups)
  // 3 = groups settled, paused
  const [stage, setStage] = useState(0);

  // Drive the loop
  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % 4);
    }, STAGE_DURATION_MS / 4);
    return () => clearInterval(interval);
  }, []);

  const toggleOn = stage >= 1;
  const grouped = stage >= 2;

  // Compute Y positions for each service. In flat mode, services
  // stack at 8px spacing starting at y=120. In grouped mode, each
  // service sits under its group header at the right offset.
  const flatY = useCallback((idx) => 130 + idx * 50, []);

  const groupedY = useCallback((svc) => {
    // Find which group this service belongs to in display order, and
    // which position within the group.
    let cursorY = 120;
    for (const g of GROUPS) {
      cursorY += 36; // group header height
      const servicesInGroup = SERVICES.filter((s) => s.group === g.name);
      if (g.name === svc.group) {
        const idxInGroup = servicesInGroup.findIndex((s) => s.id === svc.id);
        return cursorY + 8 + idxInGroup * 44;
      }
      cursorY += 8 + servicesInGroup.length * 44 + 14; // group bottom padding
    }
    return cursorY;
  }, []);

  const groupHeaderY = useCallback((groupIdx) => {
    let cursorY = 120;
    for (let i = 0; i < groupIdx; i++) {
      const g = GROUPS[i];
      const servicesInGroup = SERVICES.filter((s) => s.group === g.name);
      cursorY += 36 + 8 + servicesInGroup.length * 44 + 14;
    }
    return cursorY;
  }, []);

  return (
    <div style={{
      width: "100%",
      maxWidth: 380,
      margin: "0 auto",
      background: PALETTE.cream,
      borderRadius: 18,
      padding: 14,
      boxShadow: "0 4px 16px rgba(31, 65, 49, 0.08)",
      border: `1px solid ${PALETTE.creamEdge}`,
      overflow: "hidden",
    }}>
      <svg viewBox="0 0 360 620" width="100%" height="auto" style={{ display: "block" }} aria-label="Service grouping demo">
        <defs>
          <linearGradient id="sg-toggle-on" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#16A34A" />
            <stop offset="1" stopColor="#22C55E" />
          </linearGradient>
        </defs>

        {/* Header label */}
        <text x="14" y="32" fontFamily="'Cormorant Garamond', Georgia, serif" fontSize="22" fontWeight="700" fill={PALETTE.forestDeep}>
          Services
        </text>
        <text x="14" y="50" fontFamily="-apple-system, sans-serif" fontSize="11" fill={PALETTE.gray500}>
          6 active
        </text>

        {/* Organize toggle row */}
        <g>
          <rect x="14" y="64" width="332" height="42" rx="10"
            fill={toggleOn ? PALETTE.sageTint : "#FAFAFA"}
            stroke={toggleOn ? PALETTE.sageSoft : PALETTE.creamEdge}
            strokeWidth="1"
            style={{ transition: "fill 0.4s ease, stroke 0.4s ease" }}
          />
          <text x="24" y="84" fontFamily="-apple-system, sans-serif" fontSize="12" fontWeight="700" fill={PALETTE.ink}>
            Organize into groups
          </text>
          <text x="24" y="98" fontFamily="-apple-system, sans-serif" fontSize="10" fill={PALETTE.gray500}>
            Auto-sorted by keyword
          </text>
          {/* Toggle pill */}
          <rect x="300" y="76" width="36" height="18" rx="9"
            fill={toggleOn ? "url(#sg-toggle-on)" : PALETTE.gray300}
            style={{ transition: "fill 0.4s ease" }}
          />
          <circle
            cx={toggleOn ? "327" : "309"}
            cy="85"
            r="7"
            fill={PALETTE.white}
            style={{ transition: "cx 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </g>

        {/* GROUP HEADERS, fade in when grouped */}
        {GROUPS.map((g, gIdx) => {
          const y = groupHeaderY(gIdx);
          const servicesInGroup = SERVICES.filter((s) => s.group === g.name);
          return (
            <g key={g.name} style={{ opacity: grouped ? 1 : 0, transition: "opacity 0.6s ease" }}>
              <rect x="14" y={y} width="332" height="28" rx="8"
                fill={PALETTE.sageTint}
                stroke={PALETTE.sageSoft}
                strokeWidth="1"
              />
              <text x="24" y={y + 18} fontFamily="'Cormorant Garamond', Georgia, serif" fontSize="13" fontWeight="700" fill={PALETTE.forestDeep}>
                {g.name}
              </text>
              <text x={346 - 4} y={y + 18} fontFamily="-apple-system, sans-serif" fontSize="10" fill={PALETTE.gray500} textAnchor="end">
                {servicesInGroup.length} service{servicesInGroup.length === 1 ? "" : "s"}
              </text>
            </g>
          );
        })}

        {/* SERVICE CARDS */}
        {SERVICES.map((svc, idx) => {
          const y = grouped ? groupedY(svc) : flatY(idx);
          return (
            <g key={svc.id} style={{ transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)" }}
               transform={`translate(0, ${y - 130 - idx * 50})`}>
              <rect x="20" y={130 + idx * 50} width="320" height="42" rx="9"
                fill={PALETTE.white}
                stroke={PALETTE.creamEdge}
                strokeWidth="1"
              />
              <text x="32" y={147 + idx * 50} fontFamily="-apple-system, sans-serif" fontSize="13" fontWeight="700" fill={PALETTE.ink}>
                {svc.name}
              </text>
              <text x="32" y={162 + idx * 50} fontFamily="-apple-system, sans-serif" fontSize="11" fill={PALETTE.gray500}>
                {svc.duration} min · ${svc.price}
              </text>
              {/* In group pill (only visible when grouped) */}
              <g style={{ opacity: grouped ? 1 : 0, transition: "opacity 0.5s ease 0.3s" }}>
                <rect x="248" y={141 + idx * 50} width="80" height="18" rx="9"
                  fill={PALETTE.sageTint}
                  stroke={PALETTE.sageSoft}
                  strokeWidth="0.5"
                />
                <text x="288" y={154 + idx * 50} fontFamily="-apple-system, sans-serif" fontSize="9" fontWeight="600" fill={PALETTE.forestDeep} textAnchor="middle">
                  in group
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Caption */}
      <div style={{
        marginTop: 10,
        textAlign: "center",
        fontFamily: "Georgia, serif",
        fontSize: 12,
        fontStyle: "italic",
        color: PALETTE.gray500,
        minHeight: 36,
        lineHeight: 1.5,
      }}>
        {stage === 0 && "Flat menu, 6 services."}
        {stage === 1 && "Toggle on. Auto-classifying..."}
        {stage === 2 && "Services slide into pre-defined groups."}
        {stage === 3 && "4 groups, ready for the booking page."}
      </div>
    </div>
  );
}
