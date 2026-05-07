// src/components/demos/CardOnFileDemo.jsx
//
// Animated demo for ribbon 6.6 "Card on file at booking".
// A simulated booking page card-capture sequence:
//   1. Mandate text + checkbox unchecked
//   2. Checkbox ticks (animated)
//   3. Card form animates in with last-4 digits typing
//   4. Lock icon + 'Card saved' confirmation
//   5. Loop
//
// Goal: convey trust + simplicity. The card sits there protected.
// Charged only if the policy triggers a fee. Same flow for Stripe
// or Square.

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F3A2C",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5E0D2",
  amberBg:"#FEF3C7",
  amberFg:"#78350F",
  amberLine: "#FCD34D",
  green:  "#16A34A",
  greenBg:"#DCFCE7",
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

const FULL_CARD = "•••• •••• •••• 4242";

export default function CardOnFileDemo() {
  const [ref, visible] = useFadeIn();
  // Stages:
  //   0 = mandate visible, checkbox empty
  //   1 = checkbox ticked
  //   2 = card form mounted, typing last 4
  //   3 = card saved, lock + green checkmark
  //   loop after stage 3
  const [stage, setStage] = useState(0);
  const [typedChars, setTypedChars] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let alive = true;

    const run = async () => {
      while (alive) {
        // Reset
        setStage(0);
        setTypedChars(0);
        await wait(900, () => alive);

        // Tick checkbox
        setStage(1);
        await wait(700, () => alive);

        // Mount card form
        setStage(2);
        // Animate typing
        for (let i = 1; i <= FULL_CARD.length; i++) {
          if (!alive) return;
          setTypedChars(i);
          await wait(45, () => alive);
        }
        await wait(500, () => alive);

        // Save card → confirmation
        setStage(3);
        await wait(2000, () => alive);
      }
    };
    run();
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
          💳 Card on file at booking
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
          STRIPE OR SQUARE
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14, lineHeight: 1.5 }}>
        Stored with your processor, never on our servers. Charged only if your policy triggers.
      </div>

      {/* Mock booking page card panel */}
      <div style={{
        background: "#FFFBEB",
        border: `1.5px solid ${C.amberLine}`,
        borderRadius: 12,
        padding: "14px 14px 12px",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.amberFg,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginBottom: 8,
        }}>
          Card on file required
        </div>

        {/* Mandate text */}
        <div style={{
          fontSize: 11,
          color: C.ink,
          lineHeight: 1.5,
          marginBottom: 10,
        }}>
          Save a card to confirm. Only charged if a fee triggers per the policy above.
        </div>

        {/* Checkbox row */}
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: 10,
          opacity: stage >= 0 ? 1 : 0,
          transition: "opacity 0.3s",
        }}>
          <Checkbox checked={stage >= 1} />
          <span style={{ fontSize: 11, color: C.ink, lineHeight: 1.5 }}>
            I agree and authorize this card if a fee triggers.
          </span>
        </div>

        {/* Card input area, fades in at stage 2 */}
        <div style={{
          background: stage >= 3 ? C.greenBg : "#FFFEF7",
          border: `1.5px solid ${stage >= 3 ? C.green : (stage >= 2 ? C.amberLine : C.border)}`,
          borderRadius: 8,
          padding: "10px 12px",
          minHeight: 40,
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: stage >= 2 ? 1 : 0.4,
          transition: "all 0.4s ease",
          transform: stage >= 2 ? "translateY(0)" : "translateY(4px)",
        }}>
          {stage < 3 ? (
            <>
              <CardChipIcon />
              <div style={{
                flex: 1,
                fontFamily: "monospace",
                fontSize: 14,
                color: C.ink,
                letterSpacing: 1,
              }}>
                {FULL_CARD.slice(0, typedChars)}
                {stage === 2 && typedChars < FULL_CARD.length && (
                  <span style={{
                    display: "inline-block",
                    width: 1,
                    height: 14,
                    background: C.ink,
                    marginLeft: 1,
                    verticalAlign: "middle",
                    animation: "blinkCursor 0.8s steps(2) infinite",
                  }} />
                )}
              </div>
              <div style={{ fontSize: 10, color: C.gray }}>EXP · CVC</div>
            </>
          ) : (
            <>
              <SuccessCheck />
              <div style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: "#14532D",
              }}>
                Visa ending in 4242
              </div>
              <LockIcon />
            </>
          )}
        </div>

        {/* CTA button */}
        <button
          disabled
          style={{
            width: "100%",
            background: stage >= 3 ? C.sage : C.forest,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.3,
            cursor: "default",
            transition: "background 0.3s",
          }}
        >
          {stage >= 3 ? "✓ Card saved · Confirm booking" : "Authorize and enter card"}
        </button>

        {/* Trust footnote */}
        <div style={{
          marginTop: 8,
          fontSize: 10,
          color: C.gray,
          textAlign: "center",
        }}>
          🔒 Secured by your therapist's processor. Card not charged now.
        </div>
      </div>

      <style>{`
        @keyframes blinkCursor {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes checkboxTick {
          0% { transform: scale(0.6); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Checkbox({ checked }) {
  return (
    <div style={{
      width: 16,
      height: 16,
      borderRadius: 4,
      border: `1.5px solid ${checked ? C.forest : "#A0A0A0"}`,
      background: checked ? C.forest : "#fff",
      flexShrink: 0,
      marginTop: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.25s ease",
    }}>
      {checked && (
        <svg viewBox="0 0 16 16" width="12" height="12" style={{ animation: "checkboxTick 0.35s ease-out" }}>
          <path d="M3 8.5l3 3 7-7" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function CardChipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="16" style={{ flexShrink: 0 }}>
      <rect x="2" y="4" width="20" height="14" rx="2" fill="#E5E5E5" />
      <rect x="4" y="7" width="6" height="4" rx="0.5" fill="#C9A84C" />
      <rect x="4" y="13" width="14" height="1.5" fill="#A0A0A0" />
    </svg>
  );
}

function SuccessCheck() {
  return (
    <div style={{
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: C.greenBg,
      color: C.green,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontWeight: 800,
      fontSize: 13,
    }}>
      ✓
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" style={{ flexShrink: 0 }}>
      <rect x="3.5" y="7" width="9" height="6" rx="1" fill={C.green} />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={C.green} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function wait(ms, alive) {
  return new Promise((resolve) => setTimeout(() => {
    if (alive()) resolve();
    else resolve();
  }, ms));
}
