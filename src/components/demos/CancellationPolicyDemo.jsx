// src/components/demos/CancellationPolicyDemo.jsx
//
// Animated demo showing how MyBodyMap's cancellation policy works.
// Three tier rows with colored dots fire as a countdown clock ticks
// down toward an appointment. The active tier highlights at each
// threshold. After the no-show moment, the demo resets and loops.
//
// Why this demo: cancellation policy is the most differentiating
// feature in ribbon 6 (Money & Protection) — competitors (Vagaro,
// MassageBook, ClinicSense) all support cancellation fees in
// principle, but none visualize the rule structure for the client
// the way we do. This demo IS the differentiator: at-a-glance
// colored tiers that any 70-year-old massage therapist understands
// instantly.

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F3A2C",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5D5C8",
  green:  "#16A34A",
  greenBg:"#DCFCE7",
  amber:  "#D97706",
  amberBg:"#FEF3C7",
  red:    "#DC2626",
  redBg:  "#FEE2E2",
};

// Tiers as the therapist would see in Settings. Tier order: largest
// hours_before to smallest. Demo timeline: 4-second loop covers a
// fictional 25-hour window compressed into 4 sec.
const TIERS = [
  { id: "early",  label: "More than 24h ahead", hoursBefore: 24, percent: 0,   tone: "green" },
  { id: "late",   label: "Within 24h",          hoursBefore: 2,  percent: 50,  tone: "amber" },
  { id: "urgent", label: "Within 2h",           hoursBefore: 0,  percent: 100, tone: "red" },
];

const TONE_COLORS = {
  green: { bg: C.greenBg, fg: "#14532D", dot: C.green },
  amber: { bg: C.amberBg, fg: "#78350F", dot: C.amber },
  red:   { bg: C.redBg,   fg: "#991B1B", dot: C.red   },
};

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

export default function CancellationPolicyDemo() {
  const [ref, visible] = useFadeIn();

  // Hours-before-appointment, animated. Starts at 30, ticks down to
  // -1 (past appointment time = no-show), pauses, resets to 30.
  const [hoursBefore, setHoursBefore] = useState(30);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    let h = 30;
    let direction = -1;
    const tick = () => {
      if (!alive) return;
      h += direction;
      if (h < -2) {
        // Past no-show. Pause briefly, then reset.
        setHoursBefore(-2);
        setTimeout(() => { if (alive) { h = 30; setHoursBefore(30); } }, 1400);
        setTimeout(() => { if (alive) tick(); }, 1700);
        return;
      }
      setHoursBefore(h);
      // Variable speed: slow through the interesting moments
      // (around 24h and 2h), faster through the boring stretches.
      const isInteresting = (h <= 27 && h >= 22) || (h <= 4 && h >= -1);
      const ms = isInteresting ? 220 : 90;
      setTimeout(tick, ms);
    };
    tick();
    return () => { alive = false; };
  }, [visible]);

  // Determine active tier from hoursBefore.
  // hoursBefore >= 24 → no-charge zone (no tier active)
  // 2 <= hoursBefore < 24 → tier 1 (within 24h)
  // 0 <= hoursBefore < 2 → tier 2 (within 2h)
  // hoursBefore < 0 → no-show zone
  const isNoShow = hoursBefore < 0;
  let activeTierIdx = -1;
  if (isNoShow) activeTierIdx = 2; // urgent / no-show
  else if (hoursBefore >= 24) activeTierIdx = -1; // no charge yet
  else if (hoursBefore >= 2) activeTierIdx = 1; // within 24h
  else activeTierIdx = 2; // within 2h

  // Format clock display
  function formatClock(h) {
    if (h < 0) return "No-show";
    if (h >= 24) {
      const d = Math.floor(h / 24);
      const remH = h % 24;
      if (d >= 1 && remH > 0) return `${d}d ${remH}h to go`;
      if (d >= 1) return `${d}d to go`;
    }
    if (h < 1) return `${Math.round(h * 60)}m to go`;
    return `${h}h to go`;
  }

  return (
    <div
      ref={ref}
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: 22,
        boxShadow: "0 12px 48px rgba(42, 87, 65, 0.14)",
        maxWidth: 460,
        width: "100%",
        boxSizing: "border-box",
        margin: "0 auto",
        border: "1.5px solid rgba(229, 213, 200, 0.6)",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
        gap: 8,
        flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, minWidth: 0 }}>
          🕐 Cancellation policy
        </div>
        <div style={{
          background: "linear-gradient(135deg, #FCF4E3, #F5E0CC)",
          color: "#A87468",
          borderRadius: 20,
          padding: "3px 10px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          AUTO-CHARGES IF TRIGGERED
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 16, lineHeight: 1.5 }}>
        Like hotels and airlines. Set the rules once. Cards on file charge automatically when policy triggers.
      </div>

      {/* Countdown clock + appointment marker */}
      <div style={{
        background: `linear-gradient(135deg, ${C.cream} 0%, #F5E8DD 100%)`,
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.4,
            color: "#A87468",
            textTransform: "uppercase",
            marginBottom: 2,
          }}>
            Appointment in
          </div>
          <div style={{
            fontFamily: "Georgia, serif",
            fontSize: 22,
            fontWeight: 700,
            color: isNoShow ? C.red : C.forest,
            lineHeight: 1.2,
            transition: "color 0.3s",
          }}>
            {formatClock(hoursBefore)}
          </div>
        </div>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#fff",
          border: `2.5px solid ${isNoShow ? C.red : (activeTierIdx >= 0 ? C.amber : C.green)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "border-color 0.3s",
        }}>
          <ClockHand hoursBefore={hoursBefore} />
        </div>
      </div>

      {/* Three tier rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {TIERS.map((tier, i) => {
          const palette = TONE_COLORS[tier.tone];
          const active = activeTierIdx === i;
          const past = activeTierIdx > i;
          return (
            <div
              key={tier.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: active ? palette.bg : "#fff",
                border: `1.5px solid ${active ? palette.dot : "#EFEAE0"}`,
                opacity: visible ? (past ? 0.55 : 1) : 0,
                transform: visible ? "translateX(0)" : "translateX(-8px)",
                transition: `all 0.4s ease ${0.2 + i * 0.1}s`,
                boxShadow: active ? `0 4px 14px ${palette.dot}30` : "none",
              }}
            >
              <div style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: palette.dot,
                flexShrink: 0,
                animation: active ? "policyPulse 1.4s ease-in-out infinite" : "none",
              }} />
              <span style={{
                flex: 1,
                fontSize: 12,
                fontWeight: 600,
                color: active ? palette.fg : C.ink,
              }}>
                {tier.label}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: active ? palette.fg : C.gray,
              }}>
                {tier.percent === 0 ? "No charge" : `${tier.percent}%`}
              </span>
            </div>
          );
        })}

        {/* No-show row appears at the end */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: isNoShow ? C.redBg : "#fff",
            border: `1.5px solid ${isNoShow ? C.red : "#EFEAE0"}`,
            opacity: visible ? 1 : 0,
            transition: `all 0.4s ease 0.55s`,
            boxShadow: isNoShow ? `0 4px 14px ${C.red}30` : "none",
          }}
        >
          <div style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: C.red,
            flexShrink: 0,
            animation: isNoShow ? "policyPulse 1.4s ease-in-out infinite" : "none",
          }} />
          <span style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: isNoShow ? "#991B1B" : C.ink,
          }}>
            No-show
          </span>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: isNoShow ? "#991B1B" : C.gray,
          }}>
            100%
          </span>
        </div>
      </div>

      {/* Footnote */}
      <div style={{
        marginTop: 12,
        fontSize: 11,
        color: C.gray,
        lineHeight: 1.5,
        textAlign: "center",
        fontStyle: "italic",
      }}>
        Plain English. Clients see the rules at booking. Their card on file charges automatically if a fee triggers.
      </div>

      <style>{`
        @keyframes policyPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 currentColor; }
          50% { transform: scale(1.4); box-shadow: 0 0 0 4px transparent; }
        }
      `}</style>
    </div>
  );
}

// Animated clock hand inside the small clock face. Rotates based on
// hoursBefore so as the countdown ticks, the hand sweeps around.
function ClockHand({ hoursBefore }) {
  // Map hoursBefore to a rotation. At 30h, hand at 12. At 0h, hand
  // has done one full loop. Smooth via CSS transition.
  const angle = ((30 - hoursBefore) / 30) * 360;
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <circle cx="20" cy="20" r="18" fill="none" stroke="#E5D5C8" strokeWidth="1" />
      <line
        x1="20" y1="20"
        x2="20" y2="6"
        stroke="#5C2E27"
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          transformOrigin: "20px 20px",
          transform: `rotate(${angle}deg)`,
          transition: "transform 0.18s linear",
        }}
      />
      <circle cx="20" cy="20" r="2" fill="#5C2E27" />
    </svg>
  );
}
