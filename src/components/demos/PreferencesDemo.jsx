// src/components/demos/PreferencesDemo.jsx
//
// Animated SVG demo for the Know Your Client ribbon on the Home page.
// Shows the client preferences screen — the page therapists told us they
// loved when we ran the early feedback rounds. The differentiator HK
// wanted highlighted: "level of conversation" preference, which most
// platforms either don't ask about or bury inside a generic notes field.
//
// Five cards rotate visibly: Music, Lighting, CONVERSATION (highlighted),
// Draping, Scent / oils. Plus a tab strip at the top showing intake
// covers Body Map / Preferences / Medical / Waiver — all in one flow.
//
// Design language matches the rest of Home: cream/sage palette, soft
// shadows, gentle motion.

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
  accent: "#D4A578",
};

// Five preference categories with their option chips. Mirrors what the
// client actually sees in /demo and on the production intake.
const CATEGORIES = [
  {
    key: "music",
    label: "Music",
    icon: "🎵",
    options: [
      { v: "silence", emoji: "🔇", label: "Silence" },
      { v: "soft",    emoji: "🎵", label: "Soft Music" },
      { v: "nature",  emoji: "🌿", label: "Nature Sounds" },
      { v: "upbeat",  emoji: "🎶", label: "Upbeat" },
    ],
    selected: 1,
  },
  {
    key: "lighting",
    label: "Lighting",
    icon: "💡",
    options: [
      { v: "dark",   emoji: "🌑", label: "Very Dim" },
      { v: "dim",    emoji: "🌓", label: "Soft" },
      { v: "normal", emoji: "💡", label: "Normal" },
    ],
    selected: 1,
  },
  {
    key: "conversation",
    label: "Level of Conversation",
    icon: "💬",
    highlight: true, // The standout — bordered, eyebrow flag, bigger
    options: [
      { v: "quiet", emoji: "🤫", label: "Quiet Please" },
      { v: "open",  emoji: "💬", label: "Happy to Chat" },
    ],
    selected: 0,
  },
  {
    key: "draping",
    label: "Draping",
    icon: "🛏️",
    options: [
      { v: "standard", emoji: "🛏️", label: "Standard" },
      { v: "extra",    emoji: "🔒", label: "Extra Coverage" },
    ],
    selected: 0,
  },
  {
    key: "oils",
    label: "Oils & Scent",
    icon: "🌿",
    options: [
      { v: "none",    emoji: "✅", label: "No Issues" },
      { v: "noscent", emoji: "🚫", label: "Fragrance-Free" },
      { v: "allergy", emoji: "⚠️", label: "Has Allergy" },
    ],
    selected: 1,
  },
];

const TABS = ["Body Map", "Preferences", "Medical", "Waiver"];

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

export default function PreferencesDemo() {
  const [ref, visible] = useFadeIn();
  // Cycle the focused card so the demo feels alive without being noisy.
  // We pause for longer on the conversation card (the highlighted one).
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      setFocusIdx((i) => (i + 1) % CATEGORIES.length);
    }, 3200);
    return () => clearInterval(t);
  }, [visible]);

  return (
    <div ref={ref} style={{
      background: "#fff",
      borderRadius: 20,
      padding: 22,
      boxShadow: "0 12px 48px rgba(157, 170, 133, 0.16)",
      maxWidth: 460,
      margin: "0 auto",
      border: "1.5px solid rgba(220, 232, 210, 0.7)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>🎯 Client Preferences</div>
        <div style={{
          background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)",
          color: "#166534",
          borderRadius: 20, padding: "3px 10px",
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        }}>
          BEFORE THEY ARRIVE
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
        Captured once on first visit. Remembered every visit after. The little things that make sessions feel made for them.
      </div>

      {/* Tabs strip — shows that preferences sit alongside body map / medical / waiver */}
      <div style={{
        display: "flex", gap: 4, padding: 4,
        background: "#F9FAFB", borderRadius: 12,
        marginBottom: 14,
      }}>
        {TABS.map((t, i) => (
          <div key={t} style={{
            flex: 1,
            textAlign: "center",
            fontSize: 11,
            fontWeight: i === 1 ? 700 : 500,
            color: i === 1 ? "#fff" : C.gray,
            background: i === 1 ? C.forest : "transparent",
            borderRadius: 8,
            padding: "6px 0",
            transition: "all 0.2s",
          }}>
            {t}
          </div>
        ))}
      </div>

      {/* Five preference cards */}
      <div style={{
        background: C.cream,
        borderRadius: 14,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {CATEGORIES.map((cat, idx) => {
          const isFocus = idx === focusIdx;
          const isHighlight = !!cat.highlight;
          return (
            <div key={cat.key} style={{
              background: "#fff",
              border: isHighlight
                ? `2px solid ${C.rose}`
                : `1px solid ${isFocus ? C.sage : C.border}`,
              borderRadius: 12,
              padding: "12px 14px",
              transition: "all 0.4s ease",
              boxShadow: isFocus
                ? "0 4px 14px rgba(157, 170, 133, 0.18)"
                : "none",
              transform: isFocus ? "translateY(-1px)" : "translateY(0)",
              position: "relative",
              opacity: visible ? 1 : 0,
              animation: visible
                ? `prefFadeIn 0.5s ease ${idx * 0.08}s backwards`
                : "none",
            }}>
              {/* "FAVORITE" eyebrow on the highlighted (conversation) card */}
              {isHighlight && (
                <div style={{
                  position: "absolute",
                  top: -9, left: 12,
                  background: C.rose,
                  color: "#fff",
                  fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
                  padding: "2px 8px",
                  borderRadius: 99,
                }}>
                  THE STANDOUT
                </div>
              )}

              {/* Top row: icon + label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{cat.icon}</span>
                <span style={{
                  fontSize: 12,
                  fontWeight: isHighlight ? 700 : 600,
                  color: isHighlight ? C.rose : C.ink,
                }}>
                  {cat.label}
                </span>
                {isHighlight && (
                  <span style={{
                    fontSize: 10,
                    color: C.rose,
                    fontStyle: "italic",
                    marginLeft: "auto",
                  }}>
                    most-asked-for
                  </span>
                )}
              </div>

              {/* Option chips */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {cat.options.map((opt, oIdx) => {
                  const selected = oIdx === cat.selected;
                  return (
                    <div key={opt.v} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "5px 10px",
                      background: selected
                        ? (isHighlight ? "#FAE9DF" : "#F0FDF4")
                        : "#F9FAFB",
                      border: `1.5px solid ${
                        selected
                          ? (isHighlight ? C.rose : C.sage)
                          : C.border
                      }`,
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: selected ? 700 : 500,
                      color: selected
                        ? (isHighlight ? C.rose : "#166534")
                        : C.gray,
                      transition: "all 0.2s",
                    }}>
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
        <strong>You walk in already knowing.</strong> No awkward "do you like to chat?" at the door. Their preferences live on their card, ready when they are.
      </div>

      <style>{`
        @keyframes prefFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
