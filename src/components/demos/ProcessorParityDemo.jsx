// src/components/demos/ProcessorParityDemo.jsx
//
// Animated demo for ribbon 6.5 "Stripe + Square, both fully".
// Two columns side by side, each marked with the processor's
// brand color. Feature checkmarks roll in one at a time, in sync
// across both columns, demonstrating parity. Bottom line shows
// the per-feature routing capability when both are connected.
//
// Design intent: convey "both equal, your choice" without a
// chart or sales table feel. Subtle motion. Both processors get
// equal real estate, equal weight, equal positioning. We do not
// rank one over the other.

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
};

const STRIPE_PURPLE = "#635BFF";
const SQUARE_BLACK = "#1F1F1F";

// Features that work on BOTH processors. Order matters for the
// reveal animation — features stagger in row-by-row, in sync
// across both columns, so visitors see equality at a glance.
const FEATURES = [
  "Online deposits at booking",
  "Package and gift purchases",
  "Card on file for cancellation policy",
  "One-tap refunds from your dashboard",
  "Memberships (Stripe auto-renews · Square monthly nudge)",
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

function ProcessorPanel({ name, brandColor, dotPosition, animated, reveals }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      background: "#fff",
      border: `1.5px solid ${C.border}`,
      borderRadius: 12,
      padding: "14px 14px 12px",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header with brand dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: brandColor,
          animation: animated ? `parityBlink 2.4s ease-in-out infinite ${dotPosition * 1.2}s` : "none",
        }} />
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: C.ink }}>
          {name}
        </div>
      </div>

      {/* Feature rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {FEATURES.map((label, i) => {
          const showThis = reveals > i;
          return (
            <div key={i} style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              opacity: showThis ? 1 : 0,
              transform: showThis ? "translateX(0)" : "translateX(-6px)",
              transition: `all 0.35s ease`,
            }}>
              <span style={{
                flexShrink: 0,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: C.greenBg,
                color: C.green,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                marginTop: 1,
              }}>
                ✓
              </span>
              <span style={{
                fontSize: 11,
                color: C.ink,
                lineHeight: 1.45,
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProcessorParityDemo() {
  const [ref, visible] = useFadeIn();
  const [reveals, setReveals] = useState(0); // how many features revealed

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    let n = 0;
    const tick = () => {
      if (!alive) return;
      if (n < FEATURES.length) {
        n += 1;
        setReveals(n);
        setTimeout(tick, 350);
      } else {
        // Pause on full reveal, then reset and loop
        setTimeout(() => {
          if (!alive) return;
          n = 0;
          setReveals(0);
          setTimeout(tick, 600);
        }, 2400);
      }
    };
    setTimeout(tick, 350);
    return () => { alive = false; };
  }, [visible]);

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
          💳 Stripe + Square
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
          BOTH FULLY
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14, lineHeight: 1.5 }}>
        Use whichever you already use. Or both, with per-feature routing. Same client experience either way.
      </div>

      {/* Two columns of features */}
      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 12,
      }}>
        <ProcessorPanel
          name="Stripe"
          brandColor={STRIPE_PURPLE}
          dotPosition={0}
          animated={visible}
          reveals={reveals}
        />
        <ProcessorPanel
          name="Square"
          brandColor={SQUARE_BLACK}
          dotPosition={0.5}
          animated={visible}
          reveals={reveals}
        />
      </div>

      {/* Routing footer — per-feature choice when both connected */}
      <div style={{
        background: `linear-gradient(135deg, ${C.cream}, #F5E8DD)`,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 11,
        color: C.ink,
        lineHeight: 1.5,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          color: "#A87468",
          textTransform: "uppercase",
          marginBottom: 4,
        }}>
          Have both? You decide who handles what.
        </div>
        <div>
          Memberships through Stripe. Card-on-file through Square. Or any other mix. We route automatically.
        </div>
      </div>

      <style>{`
        @keyframes parityBlink {
          0%, 80%, 100% { opacity: 1; transform: scale(1); }
          40% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
