// src/components/demos/ServiceDaysDemo.jsx
//
// Animated demo for the Find & Book ribbon on the Home page.
// Visualizes per-service day routing: a therapist offers different
// services on different days. Hot Stone is heavy, she only does it
// Tue and Thu. Prenatal is precious, Saturday only. Swedish runs
// every weekday.
//
// THE STORY:
//   Three service pills. Tap a pill, the calendar updates to show
//   only the days that service is offered. Other days grey out
//   with a strike-through, just like the real booking page does.
//   A small caption reinforces: "Hot Stone is offered on Tuesday
//   and Thursday only."
//
// New for May 10 2026 per HK feedback: this is a separate feature
// from Smart Scheduling and deserves its own demo. The therapist
// picking specific days for specific services is a real moat
// since no competing booking platform offers it.

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest:     "#2A5741",
  sage:       "#9DAA85",
  cream:      "#FCF8EE",
  border:     "#E5D5C8",
  ink:        "#3D4A42",
  gray:       "#7A8478",
  warm:       "#A87468",
  pillFill:   "#FBF1E5",
  pillStroke: "#E8D2BB",
  pillText:   "#5C2E27",
  available:  "#E8F3E1",
  availableStroke: "#A9C99A",
  availableText:   "#3A5C30",
};

// Three services with their day filters. dows are JS Sun=0..Sat=6.
const SERVICES = [
  { id: "swedish",  name: "Swedish",   duration: "60",  dows: [1, 2, 3, 4, 5],     summary: "every weekday" },
  { id: "hotstone", name: "Hot Stone", duration: "90",  dows: [2, 4],              summary: "Tue and Thu only" },
  { id: "prenatal", name: "Prenatal",  duration: "60",  dows: [6],                 summary: "Saturday only" },
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LABELS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function ServiceDaysDemo() {
  const [ref, visible] = useFadeIn();
  const [selectedId, setSelectedId] = useState("swedish");

  // Auto-advance through the three services once when in view to
  // demonstrate, then user controls. Each step is 2 seconds so the
  // shape of the calendar changes are absorbable.
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setSelectedId("hotstone"), 2000);
    const t2 = setTimeout(() => setSelectedId("prenatal"), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  const service = SERVICES.find(s => s.id === selectedId) || SERVICES[0];

  // Build a faux 4-week calendar grid (28 cells) starting Monday for
  // visual intuition. We just show MON-SUN repeated 4 times. Today
  // marker on row 1 day 3.
  const cells = [];
  for (let week = 0; week < 4; week++) {
    for (let dowIdx = 0; dowIdx < 7; dowIdx++) {
      // Map column index 0..6 (Mon..Sun) to JS dow (1..0)
      const jsDow = dowIdx === 6 ? 0 : dowIdx + 1;
      const dayNum = week * 7 + dowIdx + 5; // arbitrary day number
      cells.push({
        dow: jsDow,
        label: dayNum,
        available: service.dows.includes(jsDow),
      });
    }
  }

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
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, minWidth: 0 }}>📅 Service days</div>
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
        Different services on different days. Tap a service. Watch the calendar update.
      </div>

      {/* Service pills (tabs) */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap",
      }}>
        {SERVICES.map(s => {
          const active = selectedId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: `1.5px solid ${active ? C.forest : C.pillStroke}`,
                background: active ? C.forest : "#fff",
                color: active ? "#fff" : C.pillText,
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                cursor: "pointer",
                fontFamily: "system-ui",
                transition: "all 0.2s",
              }}
            >
              {s.name}
              <span style={{
                fontSize: 10, marginLeft: 6,
                opacity: active ? 0.85 : 0.6,
                fontWeight: 500,
              }}>
                {s.duration}min
              </span>
            </button>
          );
        })}
      </div>

      {/* Calendar mini-grid: month header + 7-day labels + 4 weeks */}
      <div style={{
        background: "#FAFAF6",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.gray,
          textTransform: "uppercase", letterSpacing: "0.06em",
          marginBottom: 10, textAlign: "center",
        }}>
          New client view · pick a day
        </div>

        {/* Day-of-week header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          marginBottom: 6,
        }}>
          {["M","T","W","T","F","S","S"].map((d, i) => (
            <div key={i} style={{
              fontSize: 10, fontWeight: 700, color: C.gray,
              textAlign: "center",
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* 4 weeks of cells */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}>
          {cells.map((cell, i) => (
            <div key={i} style={{
              padding: "7px 0",
              textAlign: "center",
              borderRadius: 6,
              border: `1px solid ${cell.available ? C.availableStroke : "transparent"}`,
              background: cell.available ? C.available : "transparent",
              color: cell.available ? C.availableText : "#C7CACF",
              fontSize: 11,
              fontWeight: cell.available ? 700 : 400,
              opacity: cell.available ? 1 : 0.5,
              textDecoration: cell.available ? "none" : "line-through",
              transition: "all 0.4s",
              fontFamily: "system-ui",
            }}>
              {cell.label}
            </div>
          ))}
        </div>
      </div>

      {/* Caption */}
      <div style={{
        padding: "10px 12px",
        background: C.available,
        border: `1px solid ${C.availableStroke}`,
        borderRadius: 10,
        fontSize: 11,
        color: C.availableText,
        lineHeight: 1.55,
        textAlign: "center",
      }}>
        <strong>{service.name}</strong> is offered on{" "}
        {service.dows.length === 1
          ? `${DAY_LABELS_LONG[service.dows[0]]} only`
          : service.dows.length === 2
            ? `${DAY_LABELS_LONG[service.dows[0]]} and ${DAY_LABELS_LONG[service.dows[1]]} only`
            : service.summary}
        .
      </div>
    </div>
  );
}
