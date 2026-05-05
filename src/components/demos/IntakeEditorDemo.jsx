// src/components/demos/IntakeEditorDemo.jsx
//
// Mini representation of the IntakeEditor (the WYSIWYG editor at
// /dashboard/intake/edit). Lives on the Home Know Your Client ribbon
// as the THIRD demo — first is BodyMapDemo (client view), second is
// PreferencesDemo (client view), third is this (therapist's editor view).
//
// Shows the four sections with one or two example question rows under
// each, with toggle switches and editable-looking labels. Auto-rotates
// a "currently editing" highlight through the rows so visitors see this
// is interactive without needing to click anything.
//
// Design language matches the editor itself: cream background, forest
// green toggles, dashed sage borders for "+ Add" affordances.

import React, { useState, useEffect, useRef } from "react";

const C = {
  forest: "#2A5741",
  sage:   "#5C7A4F",
  ink:    "#1F2937",
  gray:   "#6B7280",
  light:  "#E5E7EB",
  cream:  "#FAF6EE",
  beige:  "#F5EFE0",
  rose:   "#A87468",
  bg:     "#F9FAFB",
};

// One toggle switch — visual only in this demo (not interactive).
function MiniToggle({ on }) {
  return (
    <span style={{
      position: "relative", display: "inline-block",
      width: 28, height: 16, borderRadius: 999,
      background: on ? C.forest : "#D1D5DB",
      flexShrink: 0,
      transition: "background 0.4s",
    }}>
      <span style={{
        position: "absolute",
        top: 2, left: on ? 14 : 2,
        width: 12, height: 12, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.4s",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      }}/>
    </span>
  );
}

// One question row in the demo. Highlights when active is true.
function MiniRow({ label, chips, hidden, active }) {
  return (
    <div style={{
      background: hidden ? "#F9FAFB" : "#fff",
      border: `1.5px solid ${active ? C.forest : C.beige}`,
      borderRadius: 8,
      padding: "7px 9px",
      marginBottom: 5,
      opacity: hidden ? 0.55 : 1,
      transition: "all 0.4s",
      boxShadow: active ? "0 4px 14px rgba(42, 87, 65, 0.18)" : "none",
      transform: active ? "translateY(-1px)" : "translateY(0)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: hidden ? 0 : 5 }}>
        <MiniToggle on={!hidden} />
        <span style={{
          fontSize: 11, fontWeight: 700, color: C.ink,
          textDecoration: hidden ? "line-through" : "none",
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          borderBottom: active ? `1px dashed ${C.gray}` : "1px dashed transparent",
          transition: "border-color 0.4s",
        }}>{label}</span>
      </div>
      {!hidden && chips && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginLeft: 35 }}>
          {chips.map((chip, i) => (
            <span key={i} style={{
              fontSize: 9.5, fontWeight: 500, color: C.ink,
              padding: "2px 7px",
              background: "#F9FAFB",
              border: `1.5px solid ${C.light}`,
              borderRadius: 99,
            }}>
              {chip}
            </span>
          ))}
          <span style={{
            fontSize: 9.5, fontWeight: 600, color: C.sage,
            padding: "2px 7px",
            border: `1.5px dashed ${C.sage}`,
            borderRadius: 99,
            background: "transparent",
          }}>+</span>
        </div>
      )}
    </div>
  );
}

// Section heading inside the demo.
function MiniHeading({ icon, title, count }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      padding: "8px 2px 4px",
      borderBottom: `1px dashed ${C.light}`,
      marginBottom: 5,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: C.forest,
          letterSpacing: 1.3, textTransform: "uppercase",
        }}>{title}</span>
      </div>
      {count !== undefined && (
        <span style={{ fontSize: 8.5, color: C.gray, fontWeight: 600 }}>
          {count}
        </span>
      )}
    </div>
  );
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

// The four rows we cycle the highlight through. Order matches a real
// editor session.
const HIGHLIGHT_STEPS = [0, 1, 2, 3];

export default function IntakeEditorDemo() {
  const [ref, visible] = useFadeIn();
  const [activeStep, setActiveStep] = useState(0);

  // Cycle the focus highlight every 2.6s when in view.
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      setActiveStep((i) => (i + 1) % HIGHLIGHT_STEPS.length);
    }, 2600);
    return () => clearInterval(t);
  }, [visible]);

  return (
    <div ref={ref} style={{
      background: "#fff",
      borderRadius: 20,
      padding: 22,
      boxShadow: "0 12px 48px rgba(157, 170, 133, 0.16)",
      maxWidth: 460, width: "100%", boxSizing: "border-box",
      margin: "0 auto",
      border: "1.5px solid rgba(220, 232, 210, 0.7)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, minWidth: 0 }}>✏️ Customize your intake</div>
        <div style={{
          background: "linear-gradient(135deg, #FAE9DF, #F5D5C8)",
          color: C.rose,
          borderRadius: 20, padding: "3px 10px",
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          flexShrink: 0, whiteSpace: "nowrap",
        }}>
          THERAPIST VIEW
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
        Tap a label to rename. Toggle to hide. Add new questions at the bottom. The whole intake on one page, in your words.
      </div>

      {/* Editor body — the cream wash matches the real /dashboard/intake/edit page */}
      <div style={{
        background: C.bg,
        borderRadius: 12,
        padding: 12,
      }}>
        {/* Section: Body Map */}
        <MiniHeading icon="🗺️" title="Step 1 · Body Map" count="Always on" />
        <div style={{
          background: "#FFF8EE",
          border: `1px solid ${C.beige}`,
          borderRadius: 8,
          padding: "8px 10px",
          marginBottom: 8,
          display: "flex", alignItems: "center", gap: 9,
        }}>
          <svg width="20" height="30" viewBox="0 0 32 48" style={{ flexShrink: 0 }}>
            <circle cx="16" cy="6" r="5" fill="none" stroke={C.sage} strokeWidth="1.8"/>
            <path d="M16 11 L16 28 M10 14 L22 14 M10 14 L8 24 M22 14 L24 24 M16 28 L12 44 M16 28 L20 44" stroke={C.sage} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.ink }}>Front + back body map</span>
        </div>

        {/* Section: Preferences */}
        <MiniHeading icon="🎯" title="Step 2 · Preferences" count="9 of 10 visible" />
        <MiniRow
          label="Pressure preference"
          chips={["Light", "Medium", "Firm"]}
          active={activeStep === 0}
        />
        <MiniRow
          label="Level of conversation"
          chips={["Quiet Please", "Happy to Chat"]}
          active={activeStep === 1}
        />
        <MiniRow
          label="Room temperature"
          chips={null}
          hidden
          active={activeStep === 2}
        />

        {/* Section: Medical */}
        <MiniHeading icon="🩺" title="Step 3 · Medical" count="11 of 12 visible" />
        <div style={{
          background: "#fff",
          border: `1.5px solid ${activeStep === 3 ? C.forest : C.beige}`,
          borderRadius: 8,
          padding: "7px 9px",
          marginBottom: 8,
          transition: "all 0.4s",
          boxShadow: activeStep === 3 ? "0 4px 14px rgba(42, 87, 65, 0.18)" : "none",
          transform: activeStep === 3 ? "translateY(-1px)" : "translateY(0)",
        }}>
          {[
            { label: "High blood pressure", on: true },
            { label: "Blood clots / DVT", on: true },
            { label: "Recent surgery", on: true },
          ].map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 0", fontSize: 10.5, color: C.ink }}>
              <MiniToggle on={c.on} />
              <span>{c.label}</span>
            </div>
          ))}
          <div style={{ fontSize: 9, color: C.gray, marginTop: 3, marginLeft: 35 }}>+9 more</div>
        </div>

        {/* Section: Add */}
        <MiniHeading icon="✨" title="Step 5 · Your own questions" count="None yet" />
        <div style={{
          width: "100%",
          background: "#fff", border: `1.5px dashed ${C.sage}`,
          borderRadius: 8, padding: "8px 12px",
          color: C.sage, fontSize: 11, fontWeight: 700,
          textAlign: "center",
          marginBottom: 4,
        }}>
          + Add a new question
        </div>
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 12,
        background: "linear-gradient(135deg, #FAE9DF 0%, #F5D5C8 100%)",
        border: "1px solid #E8C5B5",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 11,
        color: "#6B2C2C",
        lineHeight: 1.5,
      }}>
        <strong>Every practice is different.</strong> No cooling on your table? Hide the Cool option. Want to ask about hydration? Add your own question. The whole intake bends to fit your space.
      </div>
    </div>
  );
}
