// src/pages/GiftCardPrint.js
//
// Browser-native print page for gift cards with THREE feminine design
// templates the therapist can pick from. Mirrors the architecture of
// PreSessionBrief.js / PostSessionBrief.js — standalone HTML route
// with @media print CSS and a window.print() button. No PDF library
// needed; the browser handles size, paper, save-as-PDF, orientation.
//
// Templates: Botanical Rose / Cream Bloom / Sage Garden
// Sizes:     Postcard 4x6 / Half-page 5.5x8.5 / Letter 8.5x11
//
// Both pickers stay visible at the top of the page (in print, all
// chrome is hidden via .no-print). Picking a template re-renders the
// card without losing the chosen size, and vice versa.
//
// Route: /gift-card/print/:id
//
// Public route by design — UUIDs are unguessable; the therapist may
// want to share the print URL with a recipient.

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

function formatExpiry(d) {
  if (!d) return "No expiration";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

// ─────────── Three design templates ───────────
// Each template gets its own palette + botanical SVG decorations.
// Layouts share the same anatomy (header / amount / note / code /
// footer) so changing template doesn't shift content position.

const TEMPLATES = {
  rose: {
    label: "Botanical Rose",
    swatch: ["#FCE8E0", "#F5D5C8", "#A87468"],
    // Soft dusty rose — the original feminine direction.
    palette: {
      bgGradStart: "#FCE8E0",
      bgGradMid:   "#F5D5C8",
      headerStart: "#FCE8E0",
      headerEnd:   "#F5D5C8",
      ink:         "#5C2E27",
      eyebrow:     "#A87468",
      amount:      "#2A5741",
      warm:        "#7A5C53",
      noteBg:      "#FAF6EE",
      noteBorder:  "#C99488",
      codeBg:      "#F5EFE0",
      footerBg:    "#FAF6EE",
      divider:     "#E5D5C8",
    },
    decoration: "rose",
  },
  cream: {
    label: "Cream Bloom",
    swatch: ["#FFF4E6", "#FFD8B8", "#C2845A"],
    // Soft cream + peach — warmer, golden-hour feel.
    palette: {
      bgGradStart: "#FFF4E6",
      bgGradMid:   "#FFE5CC",
      headerStart: "#FFF1DC",
      headerEnd:   "#FFD8B8",
      ink:         "#5C3D24",
      eyebrow:     "#C2845A",
      amount:      "#7A5230",
      warm:        "#8B6644",
      noteBg:      "#FFF8EC",
      noteBorder:  "#D4A578",
      codeBg:      "#F8EBD6",
      footerBg:    "#FFF8EC",
      divider:     "#EAD5B8",
    },
    decoration: "bloom",
  },
  sage: {
    label: "Sage Garden",
    swatch: ["#E8EFE2", "#C7D5BB", "#5C7A4F"],
    // Sage green + gold — calm, grounded, garden-spa feel.
    palette: {
      bgGradStart: "#E8EFE2",
      bgGradMid:   "#D4E0CB",
      headerStart: "#E8EFE2",
      headerEnd:   "#C7D5BB",
      ink:         "#2D3D24",
      eyebrow:     "#5C7A4F",
      amount:      "#3D5530",
      warm:        "#6B8060",
      noteBg:      "#F4F7EE",
      noteBorder:  "#9DAA85",
      codeBg:      "#EDF2E5",
      footerBg:    "#F4F7EE",
      divider:     "#C7D5BB",
    },
    decoration: "sage",
  },
};

// SVG botanical flourish — different for each template's personality.
// Positioned absolute in the corners of the card so it never fights
// with the card content.
function Decoration({ kind, position }) {
  const transform = {
    "top-right": "translate(-100%, 0)",
    "bottom-left": "scale(-1, -1)",
  }[position] || "";
  const baseStyle = {
    position: "absolute",
    width: "120px",
    height: "120px",
    pointerEvents: "none",
    opacity: 0.85,
    ...(position === "top-right"   ? { top: 0,    right: 0 } : {}),
    ...(position === "bottom-left" ? { bottom: 0, left: 0  } : {}),
  };

  if (kind === "rose") {
    return (
      <svg style={baseStyle} viewBox="0 0 120 120" fill="none">
        <g transform={transform}>
          <path d="M30 90 Q 50 60, 80 30" stroke="#9DAA85" strokeWidth="1.2" fill="none" opacity="0.5"/>
          <ellipse cx="60" cy="55" rx="14" ry="6" fill="#E8B5A8" opacity="0.65" transform="rotate(-30 60 55)"/>
          <ellipse cx="75" cy="42" rx="12" ry="5" fill="#E8B5A8" opacity="0.55" transform="rotate(-30 75 42)"/>
          <ellipse cx="48" cy="68" rx="10" ry="4" fill="#E8B5A8" opacity="0.6" transform="rotate(-30 48 68)"/>
          <circle cx="85" cy="28" r="5" fill="#D4948A" opacity="0.7"/>
          <circle cx="40" cy="82" r="4" fill="#D4948A" opacity="0.65"/>
          <circle cx="65" cy="50" r="3" fill="#A87468" opacity="0.5"/>
        </g>
      </svg>
    );
  }
  if (kind === "bloom") {
    return (
      <svg style={baseStyle} viewBox="0 0 120 120" fill="none">
        <g transform={transform}>
          <circle cx="80" cy="35" r="9" fill="#FFD8B8" opacity="0.85"/>
          <circle cx="80" cy="35" r="5" fill="#F0B888" opacity="0.7"/>
          <circle cx="80" cy="35" r="2" fill="#C2845A"/>
          <circle cx="55" cy="55" r="7" fill="#FFE5CC" opacity="0.85"/>
          <circle cx="55" cy="55" r="3" fill="#E8B888" opacity="0.7"/>
          <path d="M30 90 Q 60 70, 95 25" stroke="#D4A578" strokeWidth="1" fill="none" opacity="0.5"/>
          <ellipse cx="40" cy="75" rx="6" ry="3" fill="#9DAA85" opacity="0.6" transform="rotate(-45 40 75)"/>
          <ellipse cx="65" cy="42" rx="5" ry="2.5" fill="#9DAA85" opacity="0.6" transform="rotate(-45 65 42)"/>
        </g>
      </svg>
    );
  }
  if (kind === "sage") {
    return (
      <svg style={baseStyle} viewBox="0 0 120 120" fill="none">
        <g transform={transform}>
          <path d="M30 90 Q 50 65, 70 35" stroke="#5C7A4F" strokeWidth="1.2" fill="none" opacity="0.5"/>
          <ellipse cx="50" cy="65" rx="9" ry="3.5" fill="#9DAA85" opacity="0.7" transform="rotate(-50 50 65)"/>
          <ellipse cx="60" cy="55" rx="9" ry="3.5" fill="#9DAA85" opacity="0.7" transform="rotate(-50 60 55)"/>
          <ellipse cx="70" cy="45" rx="9" ry="3.5" fill="#9DAA85" opacity="0.7" transform="rotate(-50 70 45)"/>
          <circle cx="78" cy="32" r="4" fill="#D4B856" opacity="0.7"/>
          <circle cx="42" cy="78" r="3" fill="#D4B856" opacity="0.65"/>
          <circle cx="85" cy="22" r="2" fill="#5C7A4F" opacity="0.5"/>
        </g>
      </svg>
    );
  }
  return null;
}

export default function GiftCardPrint() {
  const { id } = useParams();
  const [cert, setCert] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState("postcard");
  const [template, setTemplate] = useState("rose");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: c } = await supabase
        .from("gift_certificates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      setCert(c || null);
      if (c?.therapist_id) {
        const { data: t } = await supabase
          .from("therapists")
          .select("id, full_name, business_name, custom_url, profile_photo_url")
          .eq("id", c.therapist_id)
          .maybeSingle();
        if (!cancelled) setTherapist(t || null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "Georgia, serif", color: "#7A5C53" }}>Loading...</div>;
  }
  if (!cert) {
    return <div style={{ padding: 40, fontFamily: "Georgia, serif", color: "#7A5C53" }}>Gift card not found.</div>;
  }

  const businessName = therapist?.business_name || therapist?.full_name || "Your therapist";
  const bookingLink = therapist?.custom_url
    ? `mybodymap.app/book/${therapist.custom_url}`
    : "mybodymap.app";
  const recipientName = cert.recipient_name || "you";
  const purchaserName = cert.purchaser_name || "A friend";
  const amount = Number(cert.amount || 0);
  const code = cert.code || "—";
  const personalNote = (cert.message || "").trim();
  const expiry = formatExpiry(cert.expires_at);

  const SIZES = {
    postcard: { label: "Postcard 4×6", page: "4in 6in", margin: "0.25in", cardWidth: "3.5in", cardHeight: "5.5in" },
    half:     { label: "Half-page 5.5×8.5", page: "5.5in 8.5in", margin: "0.4in", cardWidth: "4.7in", cardHeight: "7.7in" },
    letter:   { label: "Letter 8.5×11", page: "Letter", margin: "0.5in", cardWidth: "5in", cardHeight: "7in" },
  };
  const chosen = SIZES[size];
  const tpl = TEMPLATES[template];
  const p = tpl.palette;

  const pageBg = `linear-gradient(135deg, ${p.bgGradStart} 0%, ${p.bgGradMid} 50%, #FCF8EE 100%)`;

  return (
    <div style={{ background: pageBg, minHeight: "100vh", fontFamily: "Georgia, 'Iowan Old Style', serif", transition: "background 0.4s ease" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: ${chosen.page}; margin: ${chosen.margin}; }
          .gc-card { box-shadow: none !important; page-break-inside: avoid; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar — TWO pickers (template + size) + print button */}
      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#2A5741", color: "white",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          🎁 Gift Card Preview
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {/* Template picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Style:</div>
            {Object.entries(TEMPLATES).map(([key, t]) => {
              const active = template === key;
              return (
                <button key={key}
                  onClick={() => setTemplate(key)}
                  title={t.label}
                  style={{
                    background: active ? "white" : "transparent",
                    border: `1.5px solid ${active ? "white" : "rgba(255,255,255,0.4)"}`,
                    padding: "4px 6px", borderRadius: 999,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                  {/* Three little color dots = swatch */}
                  {t.swatch.map((c, i) => (
                    <span key={i} style={{
                      display: "inline-block",
                      width: 10, height: 10, borderRadius: "50%",
                      background: c,
                      border: i === 0 ? `1px solid rgba(0,0,0,0.08)` : "none",
                    }}/>
                  ))}
                </button>
              );
            })}
          </div>
          {/* Size picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Size:</div>
            {Object.entries(SIZES).map(([key, s]) => {
              const active = size === key;
              return (
                <button key={key}
                  onClick={() => setSize(key)}
                  style={{
                    background: active ? "white" : "transparent",
                    color: active ? "#2A5741" : "white",
                    border: `1.5px solid ${active ? "white" : "rgba(255,255,255,0.4)"}`,
                    padding: "5px 12px", borderRadius: 999,
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                  {s.label}
                </button>
              );
            })}
          </div>
          <button onClick={() => window.print()} style={{
            background: "white", color: "#2A5741",
            border: "none", padding: "8px 22px",
            borderRadius: 8, fontSize: 14, fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>🖨️ Print or Save as PDF</button>
        </div>
      </div>

      <div className="no-print" style={{
        background: "#FFF8E1", borderBottom: "1px solid #F0E5C0",
        padding: "10px 24px", fontSize: 13, color: "#6B5A2A",
        textAlign: "center",
      }}>
        Tip: pick a style above. In the print dialog you can also change paper size, margins, or pick "Save as PDF".
      </div>

      {/* The card itself */}
      <div style={{ padding: "40px 20px", display: "flex", justifyContent: "center" }}>
        <div className="gc-card" style={{
          width: chosen.cardWidth,
          minHeight: chosen.cardHeight,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 12px 48px rgba(0,0,0,0.12)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          position: "relative",
        }}>
          {/* Botanical decorations - positioned in corners */}
          <Decoration kind={tpl.decoration} position="top-right" />
          <Decoration kind={tpl.decoration} position="bottom-left" />

          {/* Header band */}
          <div style={{
            background: `linear-gradient(135deg, ${p.headerStart} 0%, ${p.headerEnd} 100%)`,
            padding: "28px 28px 22px",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: p.eyebrow,
              letterSpacing: 2, marginBottom: 10,
              fontFamily: "system-ui, sans-serif",
            }}>
              ♡ A GIFT FOR YOU
            </div>
            <div style={{
              fontSize: 28, fontWeight: 700, color: p.ink,
              fontFamily: "Georgia, serif",
              lineHeight: 1.2,
            }}>
              Dear {recipientName},
            </div>
          </div>

          {/* Amount block */}
          <div style={{ padding: "26px 28px 14px", textAlign: "center", position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 13, color: p.warm, marginBottom: 4, fontFamily: "system-ui" }}>
              Worth
            </div>
            <div style={{
              fontSize: 56, fontWeight: 700, color: p.amount,
              fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 4,
            }}>
              ${amount.toFixed(0)}
            </div>
            <div style={{ fontSize: 13, color: p.warm, fontFamily: "system-ui" }}>
              of care
            </div>
          </div>

          {personalNote && (
            <div style={{ padding: "0 28px", marginBottom: 18, position: "relative", zIndex: 1 }}>
              <div style={{
                background: p.noteBg, borderLeft: `3px solid ${p.noteBorder}`,
                padding: "14px 18px", borderRadius: 8,
                fontSize: 14, color: p.ink, fontStyle: "italic",
                lineHeight: 1.6, fontFamily: "Georgia, serif",
              }}>
                "{personalNote}"
              </div>
            </div>
          )}

          <div style={{ padding: "0 28px", marginBottom: 14, fontSize: 13, color: p.warm, fontFamily: "system-ui", textAlign: "center", position: "relative", zIndex: 1 }}>
            With love, <strong style={{ color: p.ink }}>{purchaserName}</strong>
          </div>

          <div style={{ borderTop: `1.5px dashed ${p.divider}`, margin: "0 28px", position: "relative", zIndex: 1 }} />

          <div style={{ padding: "20px 28px 12px", textAlign: "center", position: "relative", zIndex: 1 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: p.eyebrow,
              letterSpacing: 2, marginBottom: 8,
              fontFamily: "system-ui",
            }}>
              REDEMPTION CODE
            </div>
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 22, fontWeight: 700, color: p.amount,
              letterSpacing: 3,
              background: p.codeBg,
              padding: "12px 18px",
              borderRadius: 10,
              display: "inline-block",
            }}>
              {code}
            </div>
          </div>

          <div style={{
            marginTop: "auto",
            background: p.footerBg,
            padding: "16px 28px",
            borderTop: `1px solid ${p.divider}`,
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: p.ink, marginBottom: 4, fontFamily: "Georgia, serif" }}>
              Redeem with {businessName}
            </div>
            <div style={{ fontSize: 11, color: p.warm, fontFamily: "system-ui" }}>
              Book at {bookingLink}
            </div>
            {expiry && (
              <div style={{ fontSize: 10, color: p.warm, opacity: 0.7, marginTop: 6, fontFamily: "system-ui" }}>
                Valid until {expiry}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
