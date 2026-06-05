// src/components/demos/DateOverrideDemo.jsx
//
// Animated demo for the Find & Book ribbon on the Home page.
// Tells the date-specific-hours story the way a 70-year-old LMT reads it:
//   YOU set custom hours (or a day off) for ONE date,
//   and your booking page shows clients the right times on its own.
//
// Two looping states (~3.2s each):
//   A - Custom hours 10 to 2  -> client page shows only those slots
//   B - Day off               -> client page shows "no openings this day"
//
// HK Jun 4 2026 redo: the first version (a row of tiny "9-5" cells) was
// too abstract. This one shows cause and effect in plain language so the
// persona understands it at a glance. Reduced motion: settle on state A.

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest:      "#2A5741",
  forestDeep:  "#1E3F2E",
  cream:       "#FCF8EE",
  border:      "#E5D5C8",
  line:        "#E5E7EB",
  ink:         "#3D4A42",
  gray:        "#7A8478",
  sageBg:      "#E8F3E1",
  sageStroke:  "#A9C99A",
  sageText:    "#3A5C30",
  amberBg:     "#FEF3C7",
  amberStroke: "#F0DCA6",
  amberText:   "#92400E",
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

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const SLOTS = ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM"];

export default function DateOverrideDemo() {
  const [ref, visible] = useFadeIn();
  const reduced = prefersReducedMotion();
  const [off, setOff] = useState(false); // false = custom hours, true = day off

  useEffect(() => {
    if (!visible || reduced) return;
    const id = setInterval(() => setOff((v) => !v), 3200);
    return () => clearInterval(id);
  }, [visible, reduced]);

  return (
    <div ref={ref} style={{
      background: "#fff", borderRadius: 20, padding: 22,
      boxShadow: "0 12px 48px rgba(140, 74, 63, 0.14)",
      maxWidth: 460, width: "100%", boxSizing: "border-box", margin: "0 auto",
      border: "1.5px solid rgba(252, 232, 224, 0.6)",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>📅 Date-specific hours</div>
      <div style={{ fontSize: 12.5, color: C.gray, marginBottom: 16, lineHeight: 1.5 }}>
        For the weeks that do not look like the others.
      </div>

      {/* YOU SET */}
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", color: C.gray, marginBottom: 7 }}>YOU SET</div>
      <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 16, background: C.cream }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 12, fontFamily: "Georgia, serif" }}>Friday, June 13</div>
        <div style={{ display: "flex", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 11, padding: 3, marginBottom: 14 }}>
          <div style={{ flex: 1, textAlign: "center", padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: off ? "transparent" : C.forest, color: off ? C.gray : "#fff", transition: "all 0.4s" }}>
            Custom hours
          </div>
          <div style={{ flex: 1, textAlign: "center", padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: off ? C.amberText : "transparent", color: off ? "#fff" : C.gray, transition: "all 0.4s" }}>
            Day off
          </div>
        </div>
        {!off ? (
          <div style={{ background: C.sageBg, border: `1px solid ${C.sageStroke}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: C.sageText }}>10:00 AM - 2:00 PM</div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>instead of your usual 9:00 to 5:00</div>
          </div>
        ) : (
          <div style={{ background: C.amberBg, border: `1px solid ${C.amberStroke}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: C.amberText }}>🌿 Day off</div>
            <div style={{ fontSize: 12, color: C.amberText, opacity: 0.85, marginTop: 4 }}>just this date · your weekly hours stay the same</div>
          </div>
        )}
      </div>

      {/* Connector */}
      <div style={{ textAlign: "center", margin: "10px 0 4px" }}>
        <div style={{ fontSize: 18, color: C.sageStroke, lineHeight: 1 }}>↓</div>
        <div style={{ fontSize: 11.5, color: C.gray, fontWeight: 600 }}>your booking page updates on its own</div>
      </div>

      {/* CLIENTS SEE - mini booking page */}
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", color: C.gray, margin: "10px 0 7px" }}>CLIENTS SEE</div>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ background: "#F3F4F6", padding: "7px 12px", display: "flex", alignItems: "center", gap: 7, borderBottom: `1px solid ${C.line}` }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: "#FF5F57" }} />
          <span style={{ width: 7, height: 7, borderRadius: 4, background: "#FEBC2E" }} />
          <span style={{ width: 7, height: 7, borderRadius: 4, background: "#28C840" }} />
          <span style={{ flex: 1, fontSize: 10.5, color: C.gray, marginLeft: 6 }}>mybodymap.app/sarah-mitchell</span>
        </div>
        <div style={{ background: `linear-gradient(135deg, ${C.forest}, ${C.forestDeep})`, padding: "12px 16px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 600 }}>Sarah Mitchell, LMT</div>
          <div style={{ fontSize: 11.5, opacity: 0.85 }}>Fri, Jun 13</div>
        </div>
        <div style={{ padding: 14, background: "#fff", minHeight: 100 }}>
          {!off ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Pick a time</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {SLOTS.map((t) => (
                  <div key={t} style={{ border: `1.5px solid ${C.sageStroke}`, background: C.sageBg, color: C.sageText, borderRadius: 9, padding: "10px 0", textAlign: "center", fontSize: 13, fontWeight: 700 }}>{t}</div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 96, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🌿</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>No openings this day</div>
              <div style={{ fontSize: 11.5, color: C.gray, marginTop: 3 }}>clients are guided to another date</div>
            </div>
          )}
        </div>
      </div>

      {/* Caption */}
      <div style={{ marginTop: 14, padding: "10px 12px", background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.ink, lineHeight: 1.55, textAlign: "center" }}>
        Change one date. Clients only ever see when you are truly open.
      </div>
    </div>
  );
}
