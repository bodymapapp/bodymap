// src/components/demos/SmartScheduleDemo.jsx
//
// Animated SVG demo for the Find & Book ribbon on the Home page.
// Visualizes Smart Scheduling (Lindsey #7 / Efficient Scheduling
// internally): two side-by-side mini day-views of a therapist's
// calendar.
//
//   LEFT  ('Other tools'):  three booked sessions scattered with
//                            big awkward gaps between them.
//   RIGHT ('MyBodyMap'):    same three sessions, but the available
//                            slots offered to new clients pack
//                            tight against existing bookings, so
//                            the day fills cleanly with no gaps.
//
// Animation: a "new client booking" indicator pulses across both
// columns on a loop. On the LEFT it lands in a random gap (creating
// chaos). On the RIGHT it lands snugly next to an existing
// booking. The contrast tells the story without text.
//
// Design language matches the soft cream / sage / forest palette
// used across other demos. No medical iconography, no calendar app
// chrome — just a clean side-by-side visualization.

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest:    "#2A5741",
  sage:      "#9DAA85",
  cream:     "#FCF8EE",
  border:    "#E5D5C8",
  ink:       "#3D4A42",
  gray:      "#7A8478",
  bookedFill: "#E8DDC9",   // existing bookings: warm beige
  bookedStroke: "#C4B395",
  newFill:   "#9DAA85",    // new booking landing: sage
  gapStroke: "#F0DFD0",
};

// Time labels for the day column. 9 AM to 6 PM, every 30 min visually
// but we snap to slot positions.
const HOURS = [
  "9", "10", "11", "12", "1", "2", "3", "4", "5"
];

// Existing bookings (same on both sides). Time is in minutes from 9 AM.
// 60-min sessions.
const BOOKED = [
  { startMin: 0,    duration: 60, label: "Existing" },   //  9:00-10:00
  { startMin: 180,  duration: 60, label: "Existing" },   // 12:00-1:00
  { startMin: 360,  duration: 60, label: "Existing" },   //  3:00-4:00
];

// Where the "new client booking" lands on each side, as a sequence
// of {startMin, duration} that the animation cycles through.
const LEFT_LANDINGS = [
  { startMin: 75,  duration: 60 }, // 10:15 — leaves 75 min gap
  { startMin: 255, duration: 60 }, //  1:15 — fragmenting again
  { startMin: 435, duration: 60 }, //  4:15 — random
];
const RIGHT_LANDINGS = [
  { startMin: 75,  duration: 60 },  // 10:15 — adjacent to 9-10am booking (with 15 min buffer)
  { startMin: 255, duration: 60 },  //  1:15 — adjacent to 12-1pm booking
  { startMin: 60,  duration: 60 },  // 10:00 — exactly back-to-back, no gap
];

const COL_HEIGHT = 360; // total day-column height in px
const TOTAL_MIN = 540; // 9 AM to 6 PM = 540 min
const PX_PER_MIN = COL_HEIGHT / TOTAL_MIN;

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

function DayColumn({ title, subtitle, landing, accent, gapsLabel }) {
  // Where the existing bookings sit
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 10, textAlign: "center" }}>
        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: 14, fontWeight: 700,
          color: accent === "warn" ? "#A87468" : C.forest,
          marginBottom: 2,
        }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>

      <div style={{
        position: "relative",
        height: COL_HEIGHT,
        background: "#fff",
        border: `1.5px solid ${C.border}`,
        borderRadius: 10,
        overflow: "hidden",
      }}>
        {/* Hour grid lines */}
        {HOURS.map((h, i) => {
          const top = i * 60 * PX_PER_MIN;
          return (
            <div key={i} style={{
              position: "absolute",
              top, left: 0, right: 0,
              height: 1,
              background: i === 0 ? "transparent" : "#F5EFE3",
              fontSize: 9,
              color: C.gray,
              paddingLeft: 5,
              fontFamily: "system-ui",
            }}>
              {i > 0 && <span style={{ position: "relative", top: -5 }}>{h}</span>}
            </div>
          );
        })}

        {/* Existing bookings */}
        {BOOKED.map((b, idx) => {
          const top = b.startMin * PX_PER_MIN;
          const height = b.duration * PX_PER_MIN;
          return (
            <div key={idx} style={{
              position: "absolute",
              top: top + 2, left: 22, right: 8,
              height: height - 4,
              background: C.bookedFill,
              border: `1px solid ${C.bookedStroke}`,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 600,
              color: C.ink,
              fontFamily: "system-ui",
            }}>
              {b.label}
            </div>
          );
        })}

        {/* Gap dotted lines on LEFT side - shows the awkward gaps */}
        {accent === "warn" && (
          <>
            {/* Gap between booked-1 (ends at 60min) and new (starts at 75min) - small, fine */}
            {/* Gap between new (ends at 135min) and booked-2 (starts at 180min) = 45min */}
            <div style={{
              position: "absolute",
              top: 135 * PX_PER_MIN + 2, left: 22, right: 8,
              height: 45 * PX_PER_MIN - 4,
              border: `1.5px dashed ${C.gapStroke}`,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9, color: "#C49679",
              fontStyle: "italic",
              background: "rgba(255, 240, 220, 0.3)",
            }}>
              gap
            </div>
          </>
        )}

        {/* "New client booking" landing - the animated chip */}
        <div style={{
          position: "absolute",
          top: landing.startMin * PX_PER_MIN + 2,
          left: 22, right: 8,
          height: landing.duration * PX_PER_MIN - 4,
          background: C.newFill,
          border: `1.5px solid ${C.forest}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          color: "#fff",
          fontFamily: "system-ui",
          transition: "top 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: `0 4px 12px rgba(42, 87, 65, 0.25)`,
        }}>
          New booking
        </div>
      </div>

      {/* Footer caption */}
      <div style={{
        marginTop: 10, textAlign: "center",
        fontSize: 11, color: accent === "warn" ? "#A87468" : C.forest,
        fontWeight: 600,
        minHeight: 18,
      }}>
        {gapsLabel}
      </div>
    </div>
  );
}

export default function SmartScheduleDemo() {
  const [ref, visible] = useFadeIn();
  const [step, setStep] = useState(0);

  // Cycle through the landing positions
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      setStep((s) => (s + 1) % LEFT_LANDINGS.length);
    }, 3200);
    return () => clearInterval(t);
  }, [visible]);

  return (
    <div ref={ref} style={{
      background: "#fff",
      borderRadius: 20,
      padding: 22,
      boxShadow: "0 12px 48px rgba(140, 74, 63, 0.14)",
      maxWidth: 480, width: "100%", boxSizing: "border-box",
      margin: "0 auto",
      border: "1.5px solid rgba(252, 232, 224, 0.6)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, minWidth: 0 }}>📐 Smart Scheduling</div>
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
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14, lineHeight: 1.5 }}>
        Watch how new bookings land. Other tools scatter them across your day. We pack them tight.
      </div>

      {/* Side-by-side day columns */}
      <div style={{ display: "flex", gap: 12 }}>
        <DayColumn
          title="Other tools"
          subtitle="New booking lands wherever"
          landing={LEFT_LANDINGS[step]}
          accent="warn"
          gapsLabel="Two unusable gaps in your day"
        />
        <DayColumn
          title="MyBodyMap"
          subtitle="New booking packs tight"
          landing={RIGHT_LANDINGS[step]}
          accent="good"
          gapsLabel="Clean blocks, room to breathe"
        />
      </div>

      {/* Bottom note */}
      <div style={{
        marginTop: 16, padding: "10px 12px",
        background: C.cream,
        borderRadius: 10,
        fontSize: 11, color: C.gray, lineHeight: 1.5,
        textAlign: "center",
      }}>
        Two strictness levels. Soft nudges, hard restricts. Your day, your call.
      </div>
    </div>
  );
}
