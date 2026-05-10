// src/components/demos/SmartScheduleDemo.jsx
//
// Smart Scheduling demo for the Find & Book ribbon on the Home page.
// Persona: 70-year-old female LMT named Lindsey/Joy. Must read in
// 5 seconds.
//
// THE STORY
// =========
// Tuesday afternoon. Three clients already booked: Sarah at 1 PM,
// Mike at 3 PM, Janet at 5 PM. Six 30-min positions are open
// somewhere on the timeline. The therapist has 3 modes for what
// the next new client gets to see:
//
//   OFF:  All 6 dots offered. Plain hollow circles. The client
//         can pick any of them, including the lonely 12 PM slot
//         that leaves a 1-hour gap before Sarah.
//
//   SOFT: All 6 dots still visible. The 5 dots that touch a
//         booking edge get a sage 'best fit' ring so the client
//         gravitates to them. The lonely 12 PM stays plain.
//
//   HARD: Only the 5 adjacent dots are offered. The lonely 12 PM
//         is hidden, rendered as crossed-out italic text so the
//         therapist can see it WAS filtered out (rather than
//         disappearing silently).
//
// VISUAL VOCABULARY (Option C, picked May 10 2026)
// ================
//   Bookings:   beige bars labeled with client name + 'booked'
//   Open dots:  white circle with brown stroke, time label below
//   Best fit:   solid sage circle with sage ring, time label below
//   Hidden:     crossed-out italic time text, no dot
//
// REPLACES the previous slot-grid version and the off/on toggle
// before that. Three iterations to get this right per HK feedback:
// May 10 2026 'It is still a little confusing... in the examples
// above if we add one more booked box and then show the difference
// it may be easier to understand.'

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest:           "#2A5741",
  sage:             "#9DAA85",
  cream:            "#FCF8EE",
  border:           "#E5D5C8",
  ink:              "#3D4A42",
  gray:             "#7A8478",
  warm:             "#A87468",
  bookedFill:       "#F5E8DD",
  bookedStroke:     "#C4B395",
  bookedText:       "#5C2E27",
  openStroke:       "#B0A892",
  bestFitFill:      "#2A5741",
  bestFitRing:      "#A9C99A",
  hiddenText:       "#A87468",
  captionGoodBg:    "#E8F3E1",
  captionGoodBorder:"#A9C99A",
  captionGoodText:  "#3A5C30",
  captionWarnBg:    "#FBF4ED",
  captionWarnBorder:"#C4B395",
  captionWarnText:  "#A87468",
};

// Timeline window: 12 PM to 6 PM = 360 min.
const WINDOW_START_HOUR = 12;
const WINDOW_MIN = 360;
const HOUR_MARKS = ["12 PM", "1", "2", "3", "4", "5", "6 PM"];

// Three existing bookings, in minutes from window start (12 PM).
// Each booking is 60 min. Spaced so there are real open windows
// in between with both 'lonely' (12 PM) and 'adjacent' positions.
const BOOKINGS = [
  { name: "Sarah", startMin:  60, duration: 60 }, //  1:00 PM
  { name: "Mike",  startMin: 180, duration: 60 }, //  3:00 PM
  { name: "Janet", startMin: 300, duration: 60 }, //  5:00 PM
];

// Six potential 60-min slots a new client could take. Time labels
// are what we display beneath each dot.
//
// adjacent=true means the slot is touching a booking edge, so it
// gets a Best fit ring in Soft and stays visible in Hard. The 12 PM
// dot is the only "lonely" slot here, it gets hidden in Hard.
const ALL_SLOTS = [
  { startMin:   0, label: "12 PM",  adjacent: false }, // lonely
  { startMin:  30, label: "12:30",  adjacent: true  }, // ends 1:30, touches Sarah
  { startMin: 120, label: "2 PM",   adjacent: true  }, // starts when Sarah ends
  { startMin: 150, label: "2:30",   adjacent: true  }, // ends 3:30, touches Mike
  { startMin: 240, label: "4 PM",   adjacent: true  }, // starts when Mike ends
  { startMin: 270, label: "4:30",   adjacent: true  }, // ends 5:30, touches Janet
];

// Minutes-to-percent for absolute positioning on the timeline.
function pctFor(minutes) {
  return (minutes / WINDOW_MIN) * 100;
}

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

// Mode descriptions for the caption box.
const MODE_INFO = {
  off: {
    headline: "Off: every slot, no nudge",
    body: "Six open slots offered. The 12 PM slot leaves a full hour empty before Sarah. No guidance for the client. Maximum flexibility for them, awkward gaps possible for you.",
    bg: C.captionWarnBg,
    border: C.captionWarnBorder,
    color: C.captionWarnText,
  },
  soft: {
    headline: "Soft: gentle nudge",
    body: "All six slots stay visible. The five sitting next to Sarah, Mike, or Janet get a sage ring so clients gravitate to them. The lonely 12 PM stays plain.",
    bg: C.captionGoodBg,
    border: C.captionGoodBorder,
    color: C.captionGoodText,
  },
  hard: {
    headline: "Hard: only adjacent slots",
    body: "The lonely 12 PM slot is hidden from clients. Five slots stay offered, all hugging an existing booking. Strongest packing for clean days.",
    bg: C.captionGoodBg,
    border: C.captionGoodBorder,
    color: C.captionGoodText,
  },
};

export default function SmartScheduleDemo() {
  const [ref, visible] = useFadeIn();
  const [mode, setMode] = useState("off");

  // Auto-advance Off -> Soft -> Hard once on first view to
  // demonstrate, then hand control to the user. Each step gets
  // about 1.8s so the transitions are absorbable for the persona.
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setMode("soft"), 1800);
    const t2 = setTimeout(() => setMode("hard"), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  const info = MODE_INFO[mode];

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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, minWidth: 0 }}>📐 Smart Scheduling</div>
        <div style={{
          background: "linear-gradient(135deg, #FBF4DC, #F5E0CC)",
          color: C.warm,
          borderRadius: 20, padding: "3px 10px",
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          ONLY ON MYBODYMAP
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14, lineHeight: 1.5 }}>
        Tuesday afternoon. Three clients booked. Which times does the next client see?
      </div>

      {/* 3-way segmented control */}
      <div style={{
        display: "flex", gap: 0,
        background: C.cream,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 3,
        marginBottom: 16,
      }}>
        {[
          { key: "off",  label: "Off"  },
          { key: "soft", label: "Soft" },
          { key: "hard", label: "Hard" },
        ].map(b => {
          const active = mode === b.key;
          return (
            <button
              key={b.key}
              onClick={() => setMode(b.key)}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "none",
                borderRadius: 7,
                background: active ? "#fff" : "transparent",
                color: active ? C.forest : C.gray,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                fontFamily: "system-ui",
                boxShadow: active ? "0 1px 3px rgba(42, 87, 65, 0.15)" : "none",
                transition: "all 0.15s",
              }}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div style={{
        background: "#FAFAF6",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "16px 14px 22px",
        marginBottom: 12,
      }}>
        {/* Hour marks */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          fontWeight: 700,
          color: C.gray,
          marginBottom: 8,
          padding: "0 4px",
          fontFamily: "system-ui",
        }}>
          {HOUR_MARKS.map(h => <span key={h}>{h}</span>)}
        </div>

        {/* Track. Bookings sit on top, dots float in the middle,
            time labels go below each dot. Track height accounts
            for both the dot row and the labels. */}
        <div style={{
          position: "relative",
          height: 60,
          background: "#fff",
          borderRadius: 8,
          border: `1px solid #EFE9DC`,
        }}>
          {/* Bookings */}
          {BOOKINGS.map(b => (
            <div key={b.name} style={{
              position: "absolute",
              top: 6,
              height: 38,
              left: `${pctFor(b.startMin)}%`,
              width: `${pctFor(b.duration)}%`,
              background: C.bookedFill,
              border: `1.5px solid ${C.bookedStroke}`,
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.bookedText }}>{b.name}</div>
              <div style={{ fontSize: 9, color: C.gray, fontStyle: "italic", marginTop: 1 }}>booked</div>
            </div>
          ))}

          {/* Slots. Each ALL_SLOTS entry renders one of three states:
              - hidden in Hard (only when slot is non-adjacent):
                  crossed-out italic time text, no dot
              - best fit (Soft/Hard, adjacent slots):
                  solid sage dot with ring, time label
              - plain offered (Off, or Soft/non-adjacent):
                  hollow dot with brown stroke, time label */}
          {ALL_SLOTS.map(s => {
            const left = pctFor(s.startMin);
            const isHidden = mode === "hard" && !s.adjacent;
            const isBestFit = (mode === "soft" || mode === "hard") && s.adjacent;

            if (isHidden) {
              return (
                <div key={s.label} style={{
                  position: "absolute",
                  top: 22,
                  left: `${left}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: 9,
                  fontWeight: 500,
                  color: C.hiddenText,
                  textDecoration: "line-through",
                  fontStyle: "italic",
                  whiteSpace: "nowrap",
                  fontFamily: "system-ui",
                  transition: "opacity 0.4s",
                }}>
                  {s.label}
                </div>
              );
            }

            return (
              <React.Fragment key={s.label}>
                <div style={{
                  position: "absolute",
                  top: 22,
                  left: `${left}%`,
                  width: isBestFit ? 14 : 12,
                  height: isBestFit ? 14 : 12,
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  background: isBestFit ? C.bestFitFill : "#fff",
                  border: isBestFit ? "2px solid #fff" : `1.5px solid ${C.openStroke}`,
                  boxShadow: isBestFit ? `0 0 0 2px ${C.bestFitRing}` : "none",
                  transition: "all 0.4s",
                }} />
                <div style={{
                  position: "absolute",
                  top: 47,
                  left: `${left}%`,
                  transform: "translateX(-50%)",
                  fontSize: 8,
                  fontWeight: 700,
                  color: isBestFit ? C.forest : C.gray,
                  whiteSpace: "nowrap",
                  fontFamily: "system-ui",
                  transition: "color 0.4s",
                }}>
                  {s.label}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          marginTop: 12,
          display: "flex",
          gap: 14,
          fontSize: 10,
          color: "#5F5E5A",
          flexWrap: "wrap",
          justifyContent: "center",
          fontFamily: "system-ui",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{
              display: "inline-block", width: 12, height: 12,
              borderRadius: 2, background: C.bookedFill, border: `1.5px solid ${C.bookedStroke}`,
            }} />
            Already booked
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{
              display: "inline-block", width: 11, height: 11,
              borderRadius: "50%",
              background: mode === "off" ? "#fff" : C.bestFitFill,
              border: mode === "off" ? `1.5px solid ${C.openStroke}` : "1.5px solid #fff",
              boxShadow: mode === "off" ? "none" : `0 0 0 1.5px ${C.bestFitRing}`,
            }} />
            {mode === "off" ? "Offered slot" : "Best fit"}
          </span>
          {mode === "hard" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{
                fontSize: 9, color: C.hiddenText,
                textDecoration: "line-through", fontStyle: "italic",
              }}>
                time
              </span>
              Not offered
            </span>
          )}
        </div>
      </div>

      {/* Caption */}
      <div style={{
        padding: "10px 12px",
        background: info.bg,
        border: `1px solid ${info.border}`,
        borderRadius: 10,
        fontSize: 11,
        color: info.color,
        lineHeight: 1.55,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 3 }}>{info.headline}</div>
        <div>{info.body}</div>
      </div>
    </div>
  );
}
