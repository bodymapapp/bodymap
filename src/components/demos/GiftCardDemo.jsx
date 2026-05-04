// src/components/demos/GiftCardDemo.jsx
//
// Animated SVG demo for the Relationships ribbon on the Home page.
// Shows a beautiful feminine gift card emerging from a printer with
// botanical flourishes and a working size picker (clicking a pill
// rescales the card preview to that aspect ratio).
//
// Design choices in this iteration:
// - CARD is the hero, larger and centered
// - PRINTER is small + tucked at the bottom (supporting cast, not lead)
// - All 3 size pills (Postcard 4x6 / Half-page / Letter) are real
//   buttons that change the card preview size on click
// - Botanical SVG flourishes (rose petals + leaves) anchor corners
// - Soft gradient + drop shadow for the dusty rose feminine feel

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
  petal: "#E8B5A8",
  petalDeep: "#D4948A",
  leaf: "#9DAA85",
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

// Card aspect ratio per size pill — these match what the actual print
// page produces. Clicking a pill rescales the demo card so the user
// sees what size they would print.
// width-to-height ratios:
//   postcard 4x6     => 4/6  = 0.667
//   half     5.5x8.5 => 5.5/8.5 = 0.647
//   letter   8.5x11  => 8.5/11  = 0.773
// Since the differences are subtle on a small svg, we slightly
// exaggerate the difference visually so the picker feels responsive.
const SIZE_PRESETS = {
  postcard: { label: "Postcard 4×6",     w: 130, h: 195 },
  half:     { label: "Half-page",        w: 130, h: 200 },
  letter:   { label: "Letter",           w: 145, h: 187 },
};

function GiftCardDemo() {
  const [ref, visible] = useFadeIn();
  const [size, setSize] = useState("postcard");
  const sz = SIZE_PRESETS[size];

  return (
    <div ref={ref} style={{
      background: "#fff",
      borderRadius: 20,
      padding: 22,
      boxShadow: "0 12px 48px rgba(140, 74, 63, 0.14)",
      maxWidth: 460,
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
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>
        Beautiful gift cards. Print in any size. Email instantly. No Canva.
      </div>

      {/* The animated SVG scene — card is hero, printer is small */}
      <div style={{
        position: "relative",
        height: 320,
        background: `linear-gradient(135deg, ${C.cream} 0%, ${C.rosePaler} 50%, #F5E8DD 100%)`,
        borderRadius: 14,
        overflow: "hidden",
      }}>
        <svg viewBox="0 0 380 320" width="100%" height="100%" style={{ display: "block" }}>
          <defs>
            <linearGradient id="cardHeaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FCE8E0" />
              <stop offset="100%" stopColor="#F5D5C8" />
            </linearGradient>
            <filter id="cardSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" />
              <feOffset dx="0" dy="4" result="offsetblur" />
              <feFlood floodColor="#8C4A3F" floodOpacity="0.22" />
              <feComposite in2="offsetblur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* BOTANICAL FLOURISHES in the scene corners */}
          {/* Top-left: rose petals + leafy stem */}
          <g opacity={visible ? 0.7 : 0} style={{ transition: "opacity 0.8s ease 0.4s" }}>
            <path d="M10 80 Q 30 50, 60 30" stroke={C.leaf} strokeWidth="1.2" fill="none"/>
            <ellipse cx="35" cy="55" rx="12" ry="5" fill={C.petal} transform="rotate(-30 35 55)"/>
            <ellipse cx="55" cy="38" rx="10" ry="4" fill={C.petal} transform="rotate(-30 55 38)"/>
            <ellipse cx="22" cy="72" rx="9" ry="3.5" fill={C.petal} transform="rotate(-30 22 72)"/>
            <circle cx="62" cy="25" r="5" fill={C.petalDeep}/>
            <circle cx="14" cy="86" r="4" fill={C.petalDeep}/>
          </g>
          {/* Top-right: matching flourish, mirrored */}
          <g opacity={visible ? 0.65 : 0} style={{ transition: "opacity 0.8s ease 0.5s" }}>
            <path d="M370 80 Q 350 50, 320 30" stroke={C.leaf} strokeWidth="1.2" fill="none"/>
            <ellipse cx="345" cy="55" rx="12" ry="5" fill={C.petal} transform="rotate(30 345 55)"/>
            <ellipse cx="325" cy="38" rx="10" ry="4" fill={C.petal} transform="rotate(30 325 38)"/>
            <circle cx="318" cy="25" r="5" fill={C.petalDeep}/>
          </g>

          {/* PRINTER — small, tucked at bottom, supporting role */}
          <g transform="translate(260, 270)">
            <rect x="0" y="14" width="100" height="36" rx="5" fill="#3D4A38" />
            <rect x="-3" y="0" width="106" height="18" rx="4" fill="#5C6E54" />
            <rect x="14" y="8" width="72" height="2" rx="1" fill="#1F2A1A" />
            <circle cx="86" cy="32" r="2"
              fill="#9DAA85"
              style={{ animation: visible ? "giftPrintBlink 2s infinite" : "none" }}
            />
            <text x="14" y="42" fontFamily="system-ui, sans-serif" fontSize="6" fontWeight="600" fill="#9DAA85" letterSpacing="1.5">
              MYBODYMAP
            </text>
          </g>

          {/* THE GIFT CARD - HERO, large, centered, animated */}
          <g
            style={{
              transform: visible
                ? `translate(${190 - sz.w/2}px, ${30}px)`
                : `translate(${190 - sz.w/2}px, ${260}px)`,
              opacity: visible ? 1 : 0,
              transition: "transform 1.6s cubic-bezier(0.34, 1.2, 0.5, 1) 0.3s, opacity 0.6s ease 0.3s",
            }}
          >
            <g style={{
              animation: visible ? "giftCardFloat 4s ease-in-out infinite 2s" : "none",
              transformOrigin: `${sz.w/2}px ${sz.h/2}px`,
            }}>
              {/* Card body — sized by chosen format */}
              <rect x="0" y="0" width={sz.w} height={sz.h} rx="8" fill="#FFFFFF" filter="url(#cardSoftShadow)"
                style={{ transition: "width 0.4s ease, height 0.4s ease" }}/>

              {/* Dusty rose header band */}
              <rect x="0" y="0" width={sz.w} height={Math.round(sz.h * 0.22)} rx="8" fill="url(#cardHeaderGrad)"
                style={{ transition: "width 0.4s ease, height 0.4s ease" }}/>
              <rect x="0" y={Math.round(sz.h * 0.18)} width={sz.w} height={Math.round(sz.h * 0.05)} fill="url(#cardHeaderGrad)"
                style={{ transition: "all 0.4s ease" }}/>

              {/* Tiny botanical inside top-right of card */}
              <g transform={`translate(${sz.w - 22}, 4)`} opacity="0.7">
                <ellipse cx="10" cy="12" rx="6" ry="2.5" fill={C.petal} transform="rotate(-30 10 12)"/>
                <circle cx="14" cy="6" r="2.5" fill={C.petalDeep}/>
              </g>

              {/* Eyebrow */}
              <text x={sz.w / 2} y={Math.round(sz.h * 0.09)} textAnchor="middle"
                fontFamily="system-ui, sans-serif" fontSize="6" fontWeight="700"
                fill="#A87468" letterSpacing="1.5">
                ♡ A GIFT FOR YOU
              </text>
              {/* Dear friend, */}
              <text x={sz.w / 2} y={Math.round(sz.h * 0.18)} textAnchor="middle"
                fontFamily="Georgia, serif" fontSize="11" fontWeight="700"
                fontStyle="italic" fill="#5C2E27">
                Dear friend,
              </text>

              {/* Worth */}
              <text x={sz.w / 2} y={Math.round(sz.h * 0.35)} textAnchor="middle"
                fontFamily="system-ui, sans-serif" fontSize="6" fill={C.warm}>
                Worth
              </text>
              {/* Amount */}
              <text x={sz.w / 2} y={Math.round(sz.h * 0.52)} textAnchor="middle"
                fontFamily="Georgia, serif" fontSize="28" fontWeight="700" fill={C.forest}>
                $120
              </text>
              <text x={sz.w / 2} y={Math.round(sz.h * 0.59)} textAnchor="middle"
                fontFamily="system-ui, sans-serif" fontSize="6" fill={C.warm}>
                of care
              </text>

              {/* Dashed divider */}
              <line x1="14" y1={Math.round(sz.h * 0.68)} x2={sz.w - 14} y2={Math.round(sz.h * 0.68)}
                stroke="#E5D5C8" strokeWidth="0.8" strokeDasharray="2.5 2.5" />

              {/* Code label */}
              <text x={sz.w / 2} y={Math.round(sz.h * 0.76)} textAnchor="middle"
                fontFamily="system-ui, sans-serif" fontSize="5" fontWeight="700"
                fill="#A87468" letterSpacing="1.5">
                REDEMPTION CODE
              </text>
              {/* Code value */}
              <rect x={sz.w / 2 - 38} y={Math.round(sz.h * 0.79)} width="76" height="16" rx="4" fill="#F5EFE0"/>
              <text x={sz.w / 2} y={Math.round(sz.h * 0.85) + 5} textAnchor="middle"
                fontFamily="Courier, monospace" fontSize="9" fontWeight="700"
                fill={C.forest} letterSpacing="2">
                JX7K-MN42
              </text>

              {/* Bottom-left tiny botanical inside card */}
              <g transform={`translate(4, ${sz.h - 26})`} opacity="0.65">
                <path d="M2 18 Q 8 12, 16 4" stroke={C.leaf} strokeWidth="0.8" fill="none"/>
                <ellipse cx="9" cy="10" rx="4" ry="1.8" fill={C.petal} transform="rotate(-30 9 10)"/>
              </g>
            </g>
          </g>

          {/* Sparkles around emerging card */}
          {[
            { cx: 60, cy: 180, delay: 1.0 },
            { cx: 320, cy: 175, delay: 1.3 },
            { cx: 90, cy: 110, delay: 1.6 },
            { cx: 295, cy: 115, delay: 1.4 },
            { cx: 70, cy: 60, delay: 1.8 },
          ].map((s, i) => (
            <circle key={i}
              cx={s.cx} cy={s.cy} r="2"
              fill={C.petalDeep}
              style={{
                opacity: visible ? 0.7 : 0,
                transition: `opacity 0.5s ease ${s.delay}s`,
                animation: visible ? `giftSparkle 3s ease-in-out infinite ${s.delay + 0.3}s` : "none",
              }}
            />
          ))}
        </svg>
      </div>

      {/* Three CLICKABLE size pills below scene — picking one rescales card */}
      <div style={{ display: "flex", gap: 6, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {Object.entries(SIZE_PRESETS).map(([key, s], i) => {
          const active = size === key;
          return (
            <button key={key}
              onClick={() => setSize(key)}
              style={{
                background: active ? C.forest : "#F9F7F2",
                color: active ? "#fff" : C.warm,
                border: `1.5px solid ${active ? C.forest : C.border}`,
                borderRadius: 99,
                padding: "6px 14px",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(6px)",
                transition: `opacity 0.5s ease ${1.4 + i * 0.08}s, transform 0.5s ease ${1.4 + i * 0.08}s, background 0.2s, color 0.2s, border 0.2s`,
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

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
