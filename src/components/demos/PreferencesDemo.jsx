// src/components/demos/PreferencesDemo.jsx
//
// Animated SVG demo for the Know Your Client ribbon on the Home page.
// Designed to communicate the BREADTH of the intake — not just the
// preferences subset. HK feedback (May 2026): an earlier version showed
// only 5 preference cards and therapists thought that was the complete
// intake. This version uses two layers:
//
//   1. Macro grid on top — 4 category boxes with question counts, so
//      the visual answer to "what is in the intake?" is comprehensive
//      and obvious. Body Map / Preferences / Medical / Waiver.
//
//   2. Scroll panel below — animated form preview that auto-scrolls
//      through the actual question fields under the currently focused
//      category. Conversation level highlighted as the standout (rose
//      border, "THE STANDOUT" pill, "most-asked-for" italic) since HK
//      flagged it as the differentiator.
//
// Faithful to what /demo and the production intake actually capture:
// pressure, goal, table+room temp, music, lighting, conversation,
// draping, oil & fragrance, medical notes, plus body map and waiver.

import React, { useState, useEffect, useRef } from "react";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F2937",
  warm:   "#5C7A4F",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5E7EB",
  rose:   "#A87468",
  blush:  "#FAE9DF",
};

// Four macro categories. Counts reflect real fields the production
// intake captures.
const MACROS = [
  { key: "body",     label: "Body Map",    icon: "🗺️",  count: 36, sub: "front + back zones" },
  { key: "prefs",    label: "Preferences", icon: "🎯",  count: 10, sub: "music, lighting, more" },
  { key: "medical",  label: "Medical",     icon: "🩺",  count: 6,  sub: "allergies, pregnancy" },
  { key: "waiver",   label: "Waiver",      icon: "✍️",  count: 3,  sub: "ESIGN signed" },
];

// Question fields shown in the scroll panel for each macro category.
// Each field has a TYPE (chip/range/text/checkbox) so the demo can
// render a tiny representation. The "Conversation" field is flagged
// as the standout — HK's call.
const FIELDS = {
  body: [
    { type: "header",   label: "Front body, tap to mark zones" },
    { type: "chips",    label: "Pressure",  options: ["Light","Medium","Firm","Deep"], selected: 2 },
    { type: "chips",    label: "Session goal", options: ["Relax","Pain Relief","Athletic","Stress","Rehab"], selected: 1 },
    { type: "header",   label: "Back body, tap to mark zones" },
    { type: "chips",    label: "Areas to focus", options: ["Lower back","Neck","Shoulders","Hips","Calves"], multi: true, picks: [0, 2] },
    { type: "chips",    label: "Areas to avoid", options: ["Knees","Feet","Face"], multi: true, picks: [] },
  ],
  prefs: [
    { type: "chips",    label: "Music",     options: ["Silence","Soft Music","Nature Sounds","Upbeat"], selected: 1 },
    { type: "chips",    label: "Lighting",  options: ["Very Dim","Soft","Normal"], selected: 1 },
    { type: "chips",    label: "Level of Conversation", options: ["Quiet Please","Happy to Chat"], selected: 0, highlight: true },
    { type: "chips",    label: "Table Temperature", options: ["Cool","Neutral","Warm","Hot"], selected: 2 },
    { type: "chips",    label: "Room Temperature",  options: ["Cool","Neutral","Warm"], selected: 1 },
    { type: "chips",    label: "Draping",   options: ["Standard","Extra Coverage"], selected: 0 },
    { type: "chips",    label: "Oil & Fragrance", options: ["No Issues","Fragrance-Free","Has Allergy"], selected: 1 },
  ],
  medical: [
    { type: "checkbox", label: "Currently pregnant?", checked: false },
    { type: "checkbox", label: "Recent surgery (last 6 months)?", checked: false },
    { type: "text",     label: "Medications you are taking", placeholder: "e.g. blood thinners, NSAIDs" },
    { type: "text",     label: "Known allergies",            placeholder: "e.g. lavender, almond oil" },
    { type: "text",     label: "Conditions to know about",   placeholder: "e.g. fibromyalgia, scoliosis" },
    { type: "text",     label: "Emergency contact",          placeholder: "Name + phone" },
  ],
  waiver: [
    { type: "header",   label: "By signing below, you agree:" },
    { type: "checkbox", label: "I have completed intake to the best of my knowledge", checked: true },
    { type: "checkbox", label: "I will inform my therapist of any health changes", checked: true },
    { type: "checkbox", label: "I release the therapist from liability except gross negligence", checked: true },
    { type: "signature", label: "Sarah Mitchell" },
  ],
};

const TABS = ["Body Map", "Preferences", "Medical", "Waiver"];
const MACRO_KEY_BY_TAB = ["body", "prefs", "medical", "waiver"];

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

// Render a single field row — chips, text, checkbox, header, signature.
function FieldRow({ field }) {
  if (field.type === "header") {
    return (
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.gray,
        letterSpacing: 1.2, marginTop: 4, marginBottom: 2,
        textTransform: "uppercase",
      }}>
        {field.label}
      </div>
    );
  }
  const isHighlight = !!field.highlight;
  return (
    <div style={{
      background: "#fff",
      border: isHighlight ? `2px solid ${C.rose}` : `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "9px 12px",
      marginBottom: 8,
      position: "relative",
    }}>
      {isHighlight && (
        <div style={{
          position: "absolute",
          top: -8, right: 10,
          background: C.rose,
          color: "#fff",
          fontSize: 8, fontWeight: 800, letterSpacing: 1.1,
          padding: "2px 7px",
          borderRadius: 99,
        }}>
          THE STANDOUT
        </div>
      )}
      <div style={{
        fontSize: 11,
        fontWeight: isHighlight ? 700 : 600,
        color: isHighlight ? C.rose : C.ink,
        marginBottom: 6,
      }}>
        {field.label}
        {isHighlight && (
          <span style={{ fontSize: 9, color: C.rose, fontStyle: "italic", marginLeft: 6 }}>
            most-asked-for
          </span>
        )}
      </div>

      {field.type === "chips" && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {field.options.map((opt, oi) => {
            const sel = field.multi
              ? (field.picks || []).includes(oi)
              : oi === field.selected;
            return (
              <span key={oi} style={{
                fontSize: 10, fontWeight: sel ? 700 : 500,
                padding: "3px 8px",
                borderRadius: 99,
                background: sel
                  ? (isHighlight ? C.blush : "#F0FDF4")
                  : "#F9FAFB",
                border: `1px solid ${sel
                  ? (isHighlight ? C.rose : C.sage)
                  : C.border}`,
                color: sel
                  ? (isHighlight ? C.rose : "#166534")
                  : C.gray,
              }}>
                {opt}
              </span>
            );
          })}
        </div>
      )}

      {field.type === "text" && (
        <div style={{
          fontSize: 10, color: "#9CA3AF",
          padding: "6px 8px",
          background: "#F9FAFB",
          border: `1px dashed ${C.border}`,
          borderRadius: 6,
          fontStyle: "italic",
        }}>
          {field.placeholder}
        </div>
      )}

      {field.type === "checkbox" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 14, height: 14, borderRadius: 4,
            background: field.checked ? C.forest : "#fff",
            border: `1.5px solid ${field.checked ? C.forest : C.border}`,
            color: "#fff", fontSize: 10, fontWeight: 800,
          }}>
            {field.checked ? "✓" : ""}
          </span>
          <span style={{ fontSize: 10, color: C.gray }}>
            {field.checked ? "Yes" : "Not yet"}
          </span>
        </div>
      )}

      {field.type === "signature" && (
        <div style={{
          fontSize: 16,
          fontFamily: "\'Brush Script MT\', cursive",
          color: C.forest,
          padding: "6px 10px",
          background: "#F0FDF4",
          border: `1px solid ${C.sage}`,
          borderRadius: 6,
          fontStyle: "italic",
        }}>
          {field.label}
        </div>
      )}
    </div>
  );
}

export default function PreferencesDemo() {
  const [ref, visible] = useFadeIn();
  // Cycle through the 4 macro categories every 4.5 seconds. Click a
  // macro to manually scrub.
  const [macroIdx, setMacroIdx] = useState(1); // start on Preferences

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      setMacroIdx((i) => (i + 1) % MACROS.length);
    }, 4500);
    return () => clearInterval(t);
  }, [visible]);

  const activeKey = MACRO_KEY_BY_TAB[macroIdx];
  const fields = FIELDS[activeKey] || [];

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
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, minWidth: 0 }}>📋 Full Client Intake</div>
        <div style={{
          background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)",
          color: "#166534",
          borderRadius: 20, padding: "3px 10px",
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}>
          BEFORE THEY ARRIVE
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
        Body map, preferences, medical, and waiver. All in one form. Captured once, remembered every visit.
      </div>

      {/* MACRO GRID — top layer, the visual index of the entire intake.
          Four boxes: Body Map / Preferences / Medical / Waiver. Each
          shows an icon, label, and live question count, so therapists
          immediately understand the intake covers more than five pref
          chips. Click a macro to scrub to its fields below. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
        marginBottom: 12,
      }}>
        {MACROS.map((m, i) => {
          const active = i === macroIdx;
          return (
            <button key={m.key}
              onClick={() => setMacroIdx(i)}
              style={{
                background: active ? "#fff" : "#F9F7F2",
                border: `2px solid ${active ? C.forest : C.border}`,
                borderRadius: 12,
                padding: "10px 8px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.25s",
                position: "relative",
                boxShadow: active ? "0 4px 14px rgba(42, 87, 65, 0.14)" : "none",
                transform: active ? "translateY(-1px)" : "translateY(0)",
              }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{m.icon}</div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: active ? C.forest : C.ink,
                lineHeight: 1.2,
              }}>{m.label}</div>
              <div style={{
                fontSize: 9, color: C.gray,
                marginTop: 2,
                lineHeight: 1.2,
              }}>{m.count} {m.count === 1 ? "field" : "fields"}</div>
            </button>
          );
        })}
      </div>

      {/* Tabs strip — kept under the macros as a secondary visual cue
          showing which section is currently displayed. Reinforces the
          flow: macros are a quick index, tabs are the active view. */}
      <div style={{
        display: "flex", gap: 4, padding: 4,
        background: "#F9FAFB", borderRadius: 10,
        marginBottom: 10,
      }}>
        {TABS.map((t, i) => (
          <div key={t} style={{
            flex: 1,
            textAlign: "center",
            fontSize: 10,
            fontWeight: i === macroIdx ? 700 : 500,
            color: i === macroIdx ? "#fff" : C.gray,
            background: i === macroIdx ? C.forest : "transparent",
            borderRadius: 7,
            padding: "5px 0",
            transition: "all 0.25s",
          }}>
            {t}
          </div>
        ))}
      </div>

      {/* SCROLL PANEL — the actual form body for the active macro.
          Capped height + overflow auto so visitors see this is a real
          form they would scroll through. The total field count is
          the macro count, so what is shown matches reality. */}
      <div style={{
        background: C.cream,
        borderRadius: 14,
        padding: 12,
        maxHeight: 280,
        overflowY: "auto",
        scrollbarWidth: "thin",
        position: "relative",
      }}>
        {fields.map((f, i) => (
          <FieldRow key={`${activeKey}-${i}`} field={f} />
        ))}
        {/* Soft fade at the bottom hinting "more below if you scroll" */}
        <div style={{
          position: "sticky",
          bottom: -12, left: 0, right: 0,
          height: 24,
          background: `linear-gradient(180deg, transparent, ${C.cream})`,
          marginTop: -24,
          pointerEvents: "none",
        }}/>
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 12,
        background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
        border: "1px solid #86EFAC",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 11,
        color: "#166534",
        lineHeight: 1.5,
      }}>
        <strong>You walk in already knowing.</strong> 55+ fields captured once, pre-filled on every return visit. No clipboards, no awkward questions at the door.
      </div>
    </div>
  );
}
