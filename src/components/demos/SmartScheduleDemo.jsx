// src/components/demos/SmartScheduleDemo.jsx
//
// Animated demo for the Find & Book ribbon on the Home page.
// Visualizes Smart Scheduling for the persona: a 70-year-old female
// LMT named Lindsey/Joy.
//
// THE STORY (must read in 5 seconds):
//   When a NEW client tries to book Tuesday afternoon, what slots
//   does the platform show them? The answer depends on the
//   therapist's Smart Scheduling setting:
//
//     OFF:  Every available slot is offered. The new booking can
//           land anywhere, leaving big gaps mid-day.
//
//     SOFT: Every slot is still visible, but the ones adjacent to
//           an existing booking get a sage 'Suggested' badge so
//           the client gravitates there. Flexibility preserved,
//           clean days encouraged.
//
//     HARD: Only adjacent slots are shown. Other times disappear
//           from the picker. Strongest packing. Some clients may
//           need to pick a different day.
//
// Demo: a side panel showing 'Tuesday afternoon' slot options for
// the new client. Two existing bookings already on the day. The
// 3-way toggle (Off/Soft/Hard) updates which slots appear and how
// they're styled, with a clear caption explaining what's
// happening.
//
// Replaces the previous off/on toggle which only showed one mode
// of 'on' (effectively Hard) and didn't explain Soft. May 10 2026
// HK feedback: 'For each of the toggles, what happens? It needs
// to be very clear within five seconds to a 70-year-old.'

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest:     "#2A5741",
  sage:       "#9DAA85",
  cream:      "#FCF8EE",
  border:     "#E5D5C8",
  ink:        "#3D4A42",
  gray:       "#7A8478",
  warm:       "#A87468",
  bookedFill: "#F5E8DD",
  bookedStroke: "#C4B395",
  suggestedBg: "#E8F3E1",
  suggestedStroke: "#A9C99A",
  suggestedText: "#3A5C30",
};

// All available slot times for Tuesday afternoon (1 PM to 5 PM,
// 30-min granularity). Two are already booked.
const ALL_SLOTS = [
  { time: "1:00 PM",  bookedClient: null },
  { time: "1:30 PM",  bookedClient: null },
  { time: "2:00 PM",  bookedClient: "Sarah" }, // existing booking
  { time: "2:30 PM",  bookedClient: null },
  { time: "3:00 PM",  bookedClient: null },
  { time: "3:30 PM",  bookedClient: null },
  { time: "4:00 PM",  bookedClient: "Mike" },  // existing booking
  { time: "4:30 PM",  bookedClient: null },
];

// Returns the list of slots a new client would see, given the mode.
//   off:    all unbooked slots, no styling
//   soft:   all unbooked slots, adjacent ones get 'suggested' flag
//   hard:   only adjacent slots, others removed
//
// "Adjacent" = slot ends exactly when a booking starts, OR slot
// starts exactly when a booking ends (with a 15-min buffer).
function computeOfferedSlots(mode) {
  const open = ALL_SLOTS.filter(s => !s.bookedClient);

  // Adjacency rules: a slot is adjacent if it touches an existing
  // booking edge. Bookings are 60 minutes; adjacent means the slot
  // start time is within 30 min of a booking start or end.
  const adjacentTimes = new Set([
    "1:30 PM", // ends just before Sarah at 2 PM
    "3:00 PM", // starts just after Sarah at 3 PM (1-hour booking ending)
    "3:30 PM", // ends just before Mike at 4 PM
    "5:00 PM"  // starts just after Mike (5 PM is past our window so omit)
  ]);

  if (mode === "off") {
    return open.map(s => ({ ...s, suggested: false, hidden: false }));
  }
  if (mode === "soft") {
    return open.map(s => ({
      ...s,
      suggested: adjacentTimes.has(s.time),
      hidden: false,
    }));
  }
  // hard
  return open.map(s => ({
    ...s,
    suggested: adjacentTimes.has(s.time),
    hidden: !adjacentTimes.has(s.time),
  }));
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

const MODE_DESCRIPTIONS = {
  off: {
    headline: "Off: every slot, every time",
    body: "Clients see all 6 open slots. Maximum flexibility for them. Awkward gaps possible for you.",
    color: C.warm,
    bg: "#FBF4ED",
    border: C.bookedStroke,
  },
  soft: {
    headline: "Soft: gentle nudge",
    body: "All 6 slots stay visible. The 3 next to existing bookings get a sage 'Best fit' badge so clients gravitate there.",
    color: C.suggestedText,
    bg: C.suggestedBg,
    border: C.suggestedStroke,
  },
  hard: {
    headline: "Hard: tight packing only",
    body: "Only the 3 adjacent slots are offered. The scattered times disappear. Your day stays clean.",
    color: C.forest,
    bg: "#E8F3E1",
    border: C.suggestedStroke,
  },
};

export default function SmartScheduleDemo() {
  const [ref, visible] = useFadeIn();
  const [mode, setMode] = useState("off");

  // Auto-advance through the three modes once on first view to
  // demonstrate, then hand control to the user.
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setMode("soft"), 1800);
    const t2 = setTimeout(() => setMode("hard"), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  const offered = computeOfferedSlots(mode);
  const desc = MODE_DESCRIPTIONS[mode];

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
        Tuesday afternoon. Two clients already booked. What does the next new client see?
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

      {/* Slot picker, what the new client sees */}
      <div style={{
        background: "#FAFAF6",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          New client booking · Tuesday
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 6,
        }}>
          {ALL_SLOTS.map((s, i) => {
            const offer = offered.find(o => o.time === s.time);
            const isBooked = !!s.bookedClient;
            const isHidden = mode === "hard" && offer && offer.hidden;
            const isSuggested = offer && offer.suggested && (mode === "soft" || mode === "hard");

            if (isBooked) {
              return (
                <div key={s.time} style={{
                  padding: "10px 12px",
                  background: C.bookedFill,
                  border: `1.5px solid ${C.bookedStroke}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: C.warm,
                  fontFamily: "system-ui",
                  textAlign: "center",
                  fontStyle: "italic",
                  opacity: 0.9,
                }}>
                  <div style={{ fontWeight: 700 }}>{s.time}</div>
                  <div style={{ fontSize: 10, marginTop: 1 }}>booked, {s.bookedClient}</div>
                </div>
              );
            }

            if (isHidden) {
              return (
                <div key={s.time} style={{
                  padding: "10px 12px",
                  background: "transparent",
                  border: `1.5px dashed #DDD4C2`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#C7CACF",
                  fontFamily: "system-ui",
                  textAlign: "center",
                  opacity: 0.6,
                  textDecoration: "line-through",
                  transition: "opacity 0.4s, color 0.4s",
                }}>
                  <div style={{ fontWeight: 600 }}>{s.time}</div>
                  <div style={{ fontSize: 10, marginTop: 1, fontStyle: "italic" }}>hidden</div>
                </div>
              );
            }

            // Available slot. Suggested gets sage tint + Best fit badge.
            return (
              <div key={s.time} style={{
                padding: "10px 12px",
                background: isSuggested ? C.suggestedBg : "#fff",
                border: `1.5px solid ${isSuggested ? C.suggestedStroke : "#E8E4DC"}`,
                borderRadius: 8,
                fontSize: 12,
                color: isSuggested ? C.suggestedText : C.ink,
                fontFamily: "system-ui",
                textAlign: "center",
                position: "relative",
                transition: "all 0.4s",
              }}>
                <div style={{ fontWeight: 700 }}>{s.time}</div>
                {isSuggested && (
                  <div style={{
                    fontSize: 9,
                    marginTop: 2,
                    fontWeight: 700,
                    color: C.forest,
                    letterSpacing: 0.3,
                  }}>
                    ★ BEST FIT
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Caption explaining the current mode */}
      <div style={{
        padding: "10px 12px",
        background: desc.bg,
        border: `1px solid ${desc.border}`,
        borderRadius: 10,
        fontSize: 11,
        color: desc.color,
        lineHeight: 1.55,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 3 }}>{desc.headline}</div>
        <div>{desc.body}</div>
      </div>
    </div>
  );
}
