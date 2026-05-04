// src/components/demos/GiftCardDemo.jsx
//
// Animated SVG demo for the Relationships ribbon on the Home page.
// Shows a printer emitting a beautiful 4x6 gift card with the dusty
// rose aesthetic. Mirrors the Pattern / Automation / Campaign demo
// style: useFadeIn IntersectionObserver hook, soft staggered
// transitions when the user scrolls the section into view.
//
// The animation is intentional: print is a moment that solves a real
// pain (Canva margins). Showing the printer + paper + card emerging
// communicates the magic in 2 seconds.

import React, { useState, useEffect, useRef } from "react";

const C = {
  forest: "#2A5741",
  rose: "#8C4A3F",
  rosePale: "#FCE8E0",
  rosePaler: "#FAF6EE",
  cream: "#FCF8EE",
  ink: "#5C2E27",
  warm: "#7A5C53",
  border: "#E5D5C8",
  white: "#FFFFFF",
  gray: "#6B7280",
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

function GiftCardDemo() {
  const [ref, visible] = useFadeIn();

  return (
    <div ref={ref} style={{
      background: "#fff",
      borderRadius: 20,
      padding: 24,
      boxShadow: "0 12px 48px rgba(140, 74, 63, 0.14)",
      maxWidth: 440,
      margin: "0 auto",
      border: "1.5px solid rgba(252, 232, 224, 0.6)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>🎁 Gift Cards</div>
        <div style={{
          background: "#FBF4DC", color: "#A87468",
          borderRadius: 20, padding: "3px 10px",
          fontSize: 11, fontWeight: 700,
        }}>
          Print or email
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 18 }}>
        Beautiful gift cards. Print in any size. Email instantly. No Canva.
      </div>

      {/* The animated SVG scene */}
      <div style={{
        position: "relative",
        height: 280,
        background: `linear-gradient(135deg, ${C.cream} 0%, ${C.rosePaler} 100%)`,
        borderRadius: 14,
        overflow: "hidden",
      }}>
        <svg viewBox="0 0 380 280" width="100%" height="100%" style={{ display: "block" }}>
          <defs>
            {/* Card front gradient */}
            <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FCE8E0" />
              <stop offset="100%" stopColor="#F5D5C8" />
            </linearGradient>
            {/* Soft drop shadow for the card */}
            <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
              <feOffset dx="0" dy="3" result="offsetblur" />
              <feFlood floodColor="#8C4A3F" floodOpacity="0.18" />
              <feComposite in2="offsetblur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Subtle leaf pattern for the corner */}
            <symbol id="leafCorner" viewBox="0 0 30 30">
              <path d="M5 25 Q 12 18, 25 5" stroke="#9DAA92" strokeWidth="1" fill="none" opacity="0.6"/>
              <ellipse cx="14" cy="16" rx="4" ry="2" fill="#C99488" opacity="0.55" transform="rotate(-25 14 16)"/>
              <ellipse cx="20" cy="11" rx="4" ry="2" fill="#C99488" opacity="0.55" transform="rotate(-25 20 11)"/>
            </symbol>
          </defs>

          {/* PRINTER body (sits at bottom, stationary) */}
          <g transform="translate(95, 175)">
            {/* Main printer body */}
            <rect x="0" y="20" width="190" height="80" rx="8" fill="#3D4A38" />
            {/* Top tray where paper feeds out */}
            <rect x="-5" y="0" width="200" height="30" rx="6" fill="#5C6E54" />
            {/* Paper-out slot (where card emerges) */}
            <rect x="20" y="14" width="150" height="3" rx="1.5" fill="#1F2A1A" />
            {/* Small status light */}
            <circle cx="170" cy="60" r="3" fill="#9DAA92"
              style={{ animation: visible ? "giftPrintBlink 2s infinite" : "none" }}
            />
            {/* Brand line on printer */}
            <text x="20" y="85" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="600" fill="#9DAA92" letterSpacing="2">
              MYBODYMAP
            </text>
          </g>

          {/* GIFT CARD (animates: emerges from printer, rises, gently floats) */}
          <g
            style={{
              transform: visible ? "translate(115px, 25px)" : "translate(115px, 175px)",
              opacity: visible ? 1 : 0,
              transition: "transform 1.6s cubic-bezier(0.34, 1.2, 0.5, 1) 0.3s, opacity 0.6s ease 0.3s",
            }}
          >
            <g style={{
              animation: visible ? "giftCardFloat 4s ease-in-out infinite 2s" : "none",
              transformOrigin: "center",
            }}>
              {/* Card body (4x6 ratio: 150x100 in SVG units) */}
              <rect x="0" y="0" width="150" height="100" rx="6" fill="#FFFFFF" filter="url(#cardShadow)" />

              {/* Dusty rose header band */}
              <rect x="0" y="0" width="150" height="32" rx="6" fill="url(#cardGradient)" />
              {/* Bottom-flat hack to keep header band square at bottom */}
              <rect x="0" y="20" width="150" height="12" fill="url(#cardGradient)" />

              {/* "A GIFT FOR YOU" eyebrow */}
              <text x="75" y="13" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="5" fontWeight="700" fill="#A87468" letterSpacing="1.5">
                ♡ A GIFT FOR YOU
              </text>
              {/* "Dear friend," */}
              <text x="75" y="26" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="700" fontStyle="italic" fill="#5C2E27">
                Dear friend,
              </text>

              {/* Amount */}
              <text x="75" y="55" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fontWeight="700" fill={C.forest}>
                $120
              </text>
              <text x="75" y="63" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="5" fill={C.warm}>
                of care
              </text>

              {/* Dashed divider */}
              <line x1="20" y1="73" x2="130" y2="73" stroke="#E5D5C8" strokeWidth="0.5" strokeDasharray="2 2" />

              {/* Code */}
              <text x="75" y="83" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="4" fontWeight="700" fill="#A87468" letterSpacing="1">
                REDEMPTION CODE
              </text>
              <text x="75" y="92" textAnchor="middle" fontFamily="Courier, monospace" fontSize="7" fontWeight="700" fill={C.forest} letterSpacing="2">
                JX7K-MN42
              </text>

              {/* Decorative leaves in corners */}
              <use href="#leafCorner" x="125" y="2" width="22" height="22" />
              <use href="#leafCorner" x="3" y="76" width="22" height="22" transform="rotate(180 14 87)" />
            </g>
          </g>

          {/* Tiny floating sparkles when card emerges */}
          {[
            { cx: 60, cy: 150, delay: 1.0 },
            { cx: 320, cy: 145, delay: 1.3 },
            { cx: 80, cy: 90, delay: 1.6 },
            { cx: 300, cy: 95, delay: 1.4 },
            { cx: 50, cy: 60, delay: 1.8 },
          ].map((s, i) => (
            <circle key={i}
              cx={s.cx} cy={s.cy} r="1.8"
              fill="#C99488"
              style={{
                opacity: visible ? 0.7 : 0,
                transition: `opacity 0.5s ease ${s.delay}s`,
                animation: visible ? `giftSparkle 3s ease-in-out infinite ${s.delay + 0.3}s` : "none",
              }}
            />
          ))}
        </svg>
      </div>

      {/* Three pill chips below scene (size options) */}
      <div style={{ display: "flex", gap: 6, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {["Postcard 4×6", "Half-page", "Custom"].map((label, i) => (
          <div key={label} style={{
            background: i === 0 ? C.forest : "#F9F7F2",
            color: i === 0 ? "#fff" : C.warm,
            border: `1.5px solid ${i === 0 ? C.forest : C.border}`,
            borderRadius: 99,
            padding: "5px 12px",
            fontSize: 11, fontWeight: 600,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(6px)",
            transition: `opacity 0.5s ease ${1.4 + i * 0.08}s, transform 0.5s ease ${1.4 + i * 0.08}s`,
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Bottom callout */}
      <div style={{
        marginTop: 14,
        background: "linear-gradient(135deg, #FAF6EE 0%, #F5EFE0 100%)",
        border: "1px solid #E5D5C8",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 11,
        color: C.ink,
        lineHeight: 1.5,
      }}>
        <strong>Print-ready in any size.</strong> Therapist picks. Browser handles the dialog. No more wrestling with margins.
      </div>

      <style>{`
        @keyframes giftCardFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(-1deg); }
        }
        @keyframes giftPrintBlink {
          0%, 60%, 100% { opacity: 1; }
          70%, 90% { opacity: 0.3; }
        }
        @keyframes giftSparkle {
          0%, 100% { opacity: 0; transform: scale(0.6); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default GiftCardDemo;
