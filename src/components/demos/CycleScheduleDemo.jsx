// src/components/demos/CycleScheduleDemo.jsx
//
// Animated SVG demo for the Find & Book ribbon on the Home page.
// Visualizes cycle-aligned scheduling: a circular phase wheel with the
// four menstrual phases (menstrual, follicular, ovulatory, luteal) shown
// as soft botanical-toned arcs, a "today" indicator that travels around
// the circle, and a stack of service chips that fade in/out based on
// which phase the indicator is currently in.
//
// Design language matches the dusty rose / cream / sage palette used on
// the gift card demo and elsewhere in the marketing surfaces. Feminine
// but professional — no medical iconography, no period imagery, just
// soft cyclic motion + service chips.
//
// One-of-one feature: as of May 2026, no other massage booking platform
// has cycle-aligned scheduling. This demo is the marketing hook.

import React, { useState, useEffect, useRef } from "react";

const C = {
  forest:    "#2A5741",
  sage:      "#9DAA85",
  ink:       "#5C2E27",
  gray:      "#7A5C53",
  cream:     "#FCF8EE",
  border:    "#E5D5C8",
  // Phase palette — soft botanical tones
  menstrual:  "#C99488",
  follicular: "#D4A578",
  ovulatory:  "#9DAA85",
  luteal:     "#A87468",
};

const PHASES = [
  { key: "menstrual",  label: "Menstrual",  color: C.menstrual,  startDay: 1,  endDay: 5  },
  { key: "follicular", label: "Follicular", color: C.follicular, startDay: 6,  endDay: 13 },
  { key: "ovulatory",  label: "Ovulatory",  color: C.ovulatory,  startDay: 14, endDay: 17 },
  { key: "luteal",     label: "Luteal",     color: C.luteal,     startDay: 18, endDay: 28 },
];

// Service catalog the demo shows. Each service has phase tags. The demo
// loops through phases every few seconds so visitors see services
// appearing/disappearing as the cycle moves.
const DEMO_SERVICES = [
  { name: "Gentle relaxation",   duration: 60, phases: ["menstrual", "luteal"] },
  { name: "Deep tissue",         duration: 90, phases: ["follicular", "ovulatory"] },
  { name: "Sports recovery",     duration: 60, phases: ["follicular", "ovulatory"] },
  { name: "Lymphatic drainage",  duration: 60, phases: ["menstrual", "luteal"] },
  { name: "Restorative stretch", duration: 45, phases: ["menstrual", "follicular", "ovulatory", "luteal"] },
];

function useFadeIn(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setVisible(true); }),
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

export default function CycleScheduleDemo() {
  const [ref, visible] = useFadeIn();
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Auto-rotate through phases every 3.5 seconds when in view.
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      setPhaseIndex((p) => (p + 1) % PHASES.length);
    }, 3500);
    return () => clearInterval(t);
  }, [visible]);

  const currentPhase = PHASES[phaseIndex];

  // Compute angular position of the "today" indicator. We map day-of-cycle
  // to angle: day 1 at top (12 o'clock = -90deg), going clockwise.
  // Use the midpoint day of the current phase so the indicator sits in the
  // middle of its arc rather than at the boundary.
  const midDay = (currentPhase.startDay + currentPhase.endDay) / 2;
  const angleDeg = ((midDay - 1) / 28) * 360 - 90; // -90 puts day 1 at top
  const angleRad = (angleDeg * Math.PI) / 180;
  const indicatorR = 86; // radius where the dot sits
  const cx = 130, cy = 130;
  const indicatorX = cx + indicatorR * Math.cos(angleRad);
  const indicatorY = cy + indicatorR * Math.sin(angleRad);

  // Build SVG arc paths for each phase. We need start angle, end angle,
  // arc-radius outer + inner (we draw a band, not a wedge).
  function describeArc(startDay, endDay, rOuter, rInner) {
    const start = ((startDay - 1) / 28) * 360 - 90;
    const end = ((endDay) / 28) * 360 - 90;
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = cx + rOuter * Math.cos(startRad);
    const y1 = cy + rOuter * Math.sin(startRad);
    const x2 = cx + rOuter * Math.cos(endRad);
    const y2 = cy + rOuter * Math.sin(endRad);
    const x3 = cx + rInner * Math.cos(endRad);
    const y3 = cy + rInner * Math.sin(endRad);
    const x4 = cx + rInner * Math.cos(startRad);
    const y4 = cy + rInner * Math.sin(startRad);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  }

  // Visible services for the current phase
  const visibleServices = DEMO_SERVICES.filter(s => s.phases.includes(currentPhase.key));

  return (
    <div ref={ref} style={{
      background: "#fff",
      borderRadius: 20,
      padding: 22,
      boxShadow: "0 12px 48px rgba(140, 74, 63, 0.14)",
      maxWidth: 460, width: "100%", boxSizing: "border-box",
      margin: "0 auto",
      border: "1.5px solid rgba(252, 232, 224, 0.6)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, minWidth: 0 }}>🌙 Cycle-aligned scheduling</div>
        <div style={{
          background: "linear-gradient(135deg, #FBF4DC, #F5E0CC)",
          color: "#A87468",
          borderRadius: 20, padding: "3px 10px",
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          ONLY ON MYBODYMAP
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
        Tag services to phases. Booking page filters automatically. Clients never see your cycle info.
      </div>

      {/* Animated cycle wheel + service list */}
      {/* Wheel + service list. Uses a CSS class with media query so the
          layout reflows cleanly on mobile (stacks vertically below 480px,
          SVG shrinks to fit). Inline styles can't do media queries on
          their own, so we put the responsive grid rules in a <style>
          block keyed by a unique class name. */}
      <div className="bm-cycle-demo-grid" style={{
        position: "relative",
        background: `linear-gradient(135deg, ${C.cream} 0%, #F5E8DD 100%)`,
        borderRadius: 14,
        padding: 16,
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        gap: 14,
        alignItems: "center",
      }}>
        <style>{`
          @media (max-width: 480px) {
            .bm-cycle-demo-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
              padding: 12px !important;
            }
            .bm-cycle-demo-grid > svg {
              width: 100% !important;
              max-width: 240px !important;
              height: auto !important;
              margin: 0 auto !important;
            }
            .bm-cycle-demo-services {
              min-height: auto !important;
            }
          }
        `}</style>
        {/* SVG wheel — width set in pixels for desktop, overridden to 100% on mobile via media query above */}
        <svg viewBox="0 0 260 260" width="260" height="260" style={{ display: "block", maxWidth: "100%" }}>
          <defs>
            <filter id="cycleSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" />
              <feOffset dx="0" dy="1" result="offsetblur" />
              <feFlood floodColor="#8C4A3F" floodOpacity="0.18" />
              <feComposite in2="offsetblur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3" />
            </radialGradient>
          </defs>

          {/* Phase arc bands */}
          {PHASES.map((ph, i) => {
            const isActive = i === phaseIndex;
            return (
              <path
                key={ph.key}
                d={describeArc(ph.startDay, ph.endDay, 110, 70)}
                fill={ph.color}
                opacity={isActive ? (visible ? 0.95 : 0) : (visible ? 0.45 : 0)}
                style={{
                  transition: "opacity 0.6s ease",
                }}
              />
            );
          })}

          {/* Day tick marks every 7 days */}
          {[1, 8, 15, 22].map(day => {
            const a = ((day - 1) / 28) * 360 - 90;
            const aRad = (a * Math.PI) / 180;
            const x1 = cx + 112 * Math.cos(aRad);
            const y1 = cy + 112 * Math.sin(aRad);
            const x2 = cx + 118 * Math.cos(aRad);
            const y2 = cy + 118 * Math.sin(aRad);
            return (
              <line key={day} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={C.ink} strokeWidth="1" strokeOpacity="0.3"
                style={{ opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}/>
            );
          })}

          {/* Center cream disk for label */}
          <circle cx={cx} cy={cy} r="65" fill="url(#centerGlow)" />
          <circle cx={cx} cy={cy} r="65" fill="#FFFFFF" opacity="0.85" />

          {/* Center label — current phase */}
          <text x={cx} y={cy - 10} textAnchor="middle"
            fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="700"
            fill={C.gray} letterSpacing="2"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}>
            CURRENT PHASE
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle"
            fontFamily="Georgia, serif" fontSize="20" fontWeight="700"
            fill={currentPhase.color}
            style={{ transition: "fill 0.6s ease" }}>
            {currentPhase.label}
          </text>
          <text x={cx} y={cy + 30} textAnchor="middle"
            fontFamily="system-ui, sans-serif" fontSize="10"
            fill={C.gray}>
            Days {currentPhase.startDay}–{currentPhase.endDay}
          </text>

          {/* Today indicator dot — travels around the wheel */}
          <circle
            cx={indicatorX} cy={indicatorY} r="8"
            fill="#fff" stroke={currentPhase.color} strokeWidth="3"
            filter="url(#cycleSoftShadow)"
            style={{
              transition: "cx 1.2s cubic-bezier(0.4, 0, 0.2, 1), cy 1.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.6s ease",
            }}
          />
          {/* Tiny pulse around the indicator */}
          <circle
            cx={indicatorX} cy={indicatorY} r="14"
            fill="none" stroke={currentPhase.color} strokeWidth="1"
            opacity="0.4"
            style={{
              transition: "cx 1.2s cubic-bezier(0.4, 0, 0.2, 1), cy 1.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.6s ease",
              animation: visible ? "cyclePulse 2s ease-in-out infinite" : "none",
            }}
          />
        </svg>

        {/* Right column: service list, fades in/out as phase rotates */}
        <div className="bm-cycle-demo-services" style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 200 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.gray,
            letterSpacing: 1.5, marginBottom: 2,
          }}>
            BOOKABLE THIS WEEK
          </div>
          {DEMO_SERVICES.map((svc, i) => {
            const showing = svc.phases.includes(currentPhase.key);
            return (
              <div key={svc.name} style={{
                background: showing ? "#fff" : "transparent",
                border: `1.5px solid ${showing ? currentPhase.color : "transparent"}`,
                borderRadius: 10,
                padding: showing ? "8px 11px" : 0,
                fontSize: 12,
                color: showing ? C.ink : "transparent",
                opacity: showing ? 1 : 0,
                maxHeight: showing ? 60 : 0,
                overflow: "hidden",
                transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: showing ? "0 2px 8px rgba(140, 74, 63, 0.06)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{svc.name}</span>
                  <span style={{ fontSize: 10, color: C.gray, flexShrink: 0 }}>{svc.duration}m</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase pills along the bottom — clickable for manual phase preview */}
      <div style={{ display: "flex", gap: 6, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {PHASES.map((ph, i) => {
          const active = i === phaseIndex;
          return (
            <button key={ph.key}
              onClick={() => setPhaseIndex(i)}
              style={{
                background: active ? ph.color : "#F9F7F2",
                color: active ? "#fff" : C.gray,
                border: `1.5px solid ${active ? ph.color : C.border}`,
                borderRadius: 99,
                padding: "5px 12px",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                opacity: visible ? 1 : 0,
                transition: `opacity 0.4s ease ${0.4 + i * 0.08}s, background 0.2s, color 0.2s, border 0.2s`,
              }}>
              {ph.label}
            </button>
          );
        })}
      </div>

      <div style={{
        marginTop: 14,
        background: "linear-gradient(135deg, #FAF6EE 0%, #F5EFE0 100%)",
        border: "1px solid #E5D5C8",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 11,
        color: C.ink,
        lineHeight: 1.5,
      }}>
        <strong>Plan around your body, not against it.</strong> Tag deep tissue for follicular weeks, gentler work for luteal. Clients see only what you offer that week.
      </div>

      <style>{`
        @keyframes cyclePulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
