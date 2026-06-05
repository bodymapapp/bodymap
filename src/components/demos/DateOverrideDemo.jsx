// src/components/demos/DateOverrideDemo.jsx
//
// Animated demo for the Find & Book ribbon on the Home page.
// Visualizes date-specific hours (availability overrides): the
// therapist's usual week, then one date shortened, then one date
// taken off. The point is "hours that change week to week" without
// touching the recurring weekly schedule.
//
// HK Jun 4 2026. Table-stakes feature (Calendly / Square have it),
// so no "only on MyBodyMap" badge. Just a clean, calm illustration.
//
// THE LOOP (cycles every ~2.6s when in view):
//   step 0: usual week. All weekdays 9-5, weekend off.
//   step 1: Friday shortened to 10-2 (sage highlight + "adjusted").
//   step 2: Wednesday taken off (amber highlight).
// Reduced motion: settle on step 1 (the most representative image).

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest:          "#2A5741",
  cream:           "#FCF8EE",
  border:          "#E5D5C8",
  ink:             "#3D4A42",
  gray:            "#7A8478",
  customBg:        "#E8F3E1",
  customStroke:    "#A9C99A",
  customText:      "#3A5C30",
  offBg:           "#FEF3C7",
  offStroke:       "#F0DCA6",
  offText:         "#92400E",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Base week: weekdays open 9 to 5, weekend off. Index 0..6 = Mon..Sun.
const BASE = DAY_LABELS.map((label, i) => ({
  label,
  hours: i <= 4 ? "9-5" : "Off",
  mode: i <= 4 ? "default" : "weekend",
}));

// Per-step overrides applied on top of BASE.
const STEPS = [
  { changes: {}, caption: "Your usual hours, every week." },
  { changes: { 4: { hours: "10-2", mode: "custom" } }, caption: "Shorten a single date without touching the rest." },
  { changes: { 2: { hours: "Off", mode: "off" }, 4: { hours: "10-2", mode: "custom" } }, caption: "Or take one date off. Clients see it instantly." },
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

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function DateOverrideDemo() {
  const [ref, visible] = useFadeIn();
  const reduced = prefersReducedMotion();
  const [step, setStep] = useState(reduced ? 1 : 0);

  useEffect(() => {
    if (!visible || reduced) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, [visible, reduced]);

  const changes = STEPS[step].changes;
  const days = BASE.map((d, i) => (changes[i] ? { ...d, ...changes[i] } : d));

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>📅 Date-specific hours</div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 16, lineHeight: 1.5 }}>
        For schedules that change week to week. Set different hours, or a day off, for any single date.
      </div>

      {/* Week row */}
      <div style={{
        background: "#FAFAF6",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
          {days.map((d, i) => {
            const isCustom = d.mode === "custom";
            const isOff = d.mode === "off";
            const isWeekend = d.mode === "weekend";
            const bg = isCustom ? C.customBg : isOff ? C.offBg : "#fff";
            const stroke = isCustom ? C.customStroke : isOff ? C.offStroke : C.border;
            const txt = isCustom ? C.customText : isOff ? C.offText : isWeekend ? "#C7CACF" : C.ink;
            return (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: C.gray,
                  textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5,
                }}>
                  {d.label}
                </div>
                <div style={{
                  position: "relative",
                  padding: "10px 0",
                  borderRadius: 8,
                  border: `1.5px solid ${stroke}`,
                  background: bg,
                  color: txt,
                  fontSize: 11,
                  fontWeight: (isCustom || isOff) ? 700 : 600,
                  transition: "all 0.45s ease",
                }}>
                  {d.hours}
                  {(isCustom || isOff) && (
                    <span style={{
                      position: "absolute", top: -6, right: -4,
                      width: 8, height: 8, borderRadius: "50%",
                      background: isOff ? C.offText : C.forest,
                      boxShadow: "0 0 0 2px #fff",
                    }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Caption */}
      <div style={{
        padding: "10px 12px",
        background: C.cream,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        fontSize: 11.5,
        color: C.ink,
        lineHeight: 1.55,
        textAlign: "center",
        minHeight: 20,
        transition: "all 0.3s",
      }}>
        {STEPS[step].caption}
      </div>
    </div>
  );
}
