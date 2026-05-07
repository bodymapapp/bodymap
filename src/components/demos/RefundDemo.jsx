// src/components/demos/RefundDemo.jsx
//
// Animated demo for ribbon 6.7 "One-tap refunds".
// Shows a purchase row → therapist taps Refund → modal with amount →
// money "flows" back to the client's card → row updates to Refunded.
// Loops.
//
// Goal: convey "you do not log into Stripe or Square. Click the button
// in your dashboard. Done." Demystifies what would otherwise feel like
// a scary financial operation.

import React, { useEffect, useRef, useState } from "react";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F3A2C",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5E0D2",
  green:  "#16A34A",
  greenBg:"#DCFCE7",
  red:    "#DC2626",
  redBg:  "#FEE2E2",
  orange: "#D97706",
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

export default function RefundDemo() {
  const [ref, visible] = useFadeIn();
  // Stages:
  //   0 = active purchase row
  //   1 = refund modal open (button tapped)
  //   2 = processing (money flowing animation)
  //   3 = refunded confirmation
  //   loop
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const run = async () => {
      while (alive) {
        setStage(0);
        await wait(1800, () => alive);
        setStage(1);
        await wait(1100, () => alive);
        setStage(2);
        await wait(1500, () => alive);
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
      className="bm-payment-demo-card"
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
        position: "relative",
        overflow: "hidden",
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
          ↩ One-tap refunds
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
          NO LOGIN TO STRIPE OR SQUARE
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14, lineHeight: 1.5 }}>
        From your dashboard. Money goes back to the client's card automatically.
      </div>

      {/* Mock purchases panel */}
      <div style={{
        background: C.cream,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.4,
          color: C.gray,
          textTransform: "uppercase",
          marginBottom: 10,
        }}>
          Purchases panel
        </div>

        {/* Purchase row */}
        <div style={{
          background: "#fff",
          borderRadius: 10,
          border: `1px solid ${stage >= 3 ? C.border : C.border}`,
          padding: "12px 14px",
          marginBottom: 10,
          opacity: stage >= 3 ? 0.7 : 1,
          transition: "opacity 0.4s",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: stage >= 3 ? C.gray : C.ink,
              textDecoration: stage >= 3 ? "line-through" : "none",
              transition: "all 0.3s",
            }}>
              5-pack · Deep tissue 60min
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: stage >= 3 ? C.gray : C.ink,
              transition: "color 0.3s",
            }}>
              $400.00
            </div>
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            color: C.gray,
          }}>
            <div>
              {stage < 3 ? "Sarah K. · 3 of 5 sessions used" : "Sarah K. · Refunded $400.00"}
            </div>
            {stage === 0 && (
              <button
                disabled
                style={{
                  background: "transparent",
                  border: `1.5px solid ${C.red}`,
                  color: C.red,
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "default",
                  animation: "refundPulse 2.4s ease-in-out infinite",
                }}
              >
                Refund
              </button>
            )}
            {stage >= 3 && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.gray,
                letterSpacing: 0.4,
                background: "#F0EFEC",
                padding: "3px 8px",
                borderRadius: 4,
              }}>
                REFUNDED
              </span>
            )}
          </div>
        </div>

        {/* Money flow animation: appears during stages 2-3, slides
            from the purchase row down toward a card icon. */}
        {(stage === 2 || stage === 3) && (
          <div style={{
            position: "relative",
            height: 50,
            marginBottom: 4,
          }}>
            <div style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: 0,
              bottom: 0,
              width: 2,
              background: `linear-gradient(180deg, transparent, ${C.green}, transparent)`,
              opacity: stage === 2 ? 1 : 0.3,
              transition: "opacity 0.4s",
            }} />
            <div style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: stage === 2 ? "-4px" : "100%",
              transition: "top 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
              background: C.greenBg,
              border: `1.5px solid ${C.green}`,
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              color: C.green,
            }}>
              $
            </div>
          </div>
        )}

        {/* Client card receiving the refund */}
        <div style={{
          background: stage >= 3 ? C.greenBg : "#fff",
          border: `1.5px solid ${stage >= 3 ? C.green : C.border}`,
          borderRadius: 10,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          transition: "all 0.4s",
        }}>
          <CardIcon refunded={stage >= 3} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>
              Sarah K. · Visa ending 4242
            </div>
            <div style={{
              fontSize: 10,
              color: stage >= 3 ? "#14532D" : C.gray,
              fontWeight: stage >= 3 ? 700 : 500,
              transition: "all 0.3s",
            }}>
              {stage >= 3 ? "+$400.00 refunded · 2-3 business days" : "Original payment method"}
            </div>
          </div>
          {stage >= 3 && (
            <div style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: C.green,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              animation: "refundCheck 0.6s ease-out",
            }}>
              ✓
            </div>
          )}
        </div>
      </div>

      {/* Refund confirmation modal — overlays during stage 1 */}
      {stage === 1 && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(31, 58, 44, 0.4)",
          borderRadius: 20,
          animation: "refundFadeIn 0.3s ease-out",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
            maxWidth: 280,
            width: "85%",
            textAlign: "center",
            animation: "refundModalIn 0.3s ease-out",
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.gray,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: 4,
            }}>
              Confirm refund
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: C.forest,
              fontFamily: "Georgia, serif",
              marginBottom: 8,
            }}>
              Refund $400.00?
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 12, lineHeight: 1.5 }}>
              Goes back to Visa ending 4242. Cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled style={{
                flex: 1,
                background: "#fff",
                border: `1.5px solid ${C.border}`,
                color: C.gray,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "default",
              }}>
                Cancel
              </button>
              <button disabled style={{
                flex: 2,
                background: C.red,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "default",
                animation: "refundPulse 1.4s ease-in-out infinite",
              }}>
                Refund $400.00
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes refundPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
          50% { transform: scale(1.04); box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.18); }
        }
        @keyframes refundFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes refundModalIn {
          0% { opacity: 0; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes refundCheck {
          0% { transform: scale(0); }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function CardIcon({ refunded }) {
  return (
    <svg viewBox="0 0 32 22" width="32" height="22" style={{ flexShrink: 0 }}>
      <rect x="0" y="0" width="32" height="22" rx="3" fill={refunded ? C.greenBg : "#F3F4F6"} stroke={refunded ? C.green : C.border} strokeWidth="1.2" />
      <rect x="3" y="5" width="6" height="4" rx="0.5" fill="#C9A84C" />
      <rect x="3" y="14" width="20" height="1.5" fill="#A0A0A0" />
      <text x="3" y="20" fontSize="5" fontWeight="700" fill={refunded ? C.green : "#A0A0A0"}>VISA</text>
    </svg>
  );
}

function wait(ms, alive) {
  return new Promise((resolve) => setTimeout(() => {
    if (alive()) resolve();
    else resolve();
  }, ms));
}
