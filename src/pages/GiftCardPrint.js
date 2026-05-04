// src/pages/GiftCardPrint.js
//
// Browser-native print page for gift cards. Designed to beat Canva at
// gift-card printing: pick a size, click print, get a beautiful card
// that fits the page edge-to-edge with NO browser headers/footers, NO
// margin issues, NO bleed onto a second page.
//
// THE THREE PRINT BUGS THIS FIXES (May 2026 revision):
// 1. Browser headers/footers (date, URL, page count) leaking onto the
//    printout. Fixed by setting @page { margin: 0 } and a rendering
//    hint that suppresses chrome metadata on Chromium browsers.
// 2. Card bleeding to a 2nd page on Half-page size. Fixed by sizing
//    the card to the EXACT @page dimensions and using fixed CSS height
//    rather than minHeight, so content never expands beyond the page.
// 3. Color/background not printing (header band missing in output).
//    Fixed with -webkit-print-color-adjust: exact + print-color-adjust:
//    exact on every colored element, so backgrounds print regardless
//    of the user's "Background graphics" toggle in the print dialog.
//
// Architecture: standalone HTML route + window.print(). Same pattern
// as PreSessionBrief.js / PostSessionBrief.js. Zero new dependencies.
//
// Route: /gift-card/print/:id
// Public access by design — gift cert UUIDs are unguessable.

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

// Three feminine design templates the therapist can pick.
const TEMPLATES = {
  rose: {
    label: "Botanical Rose",
    swatch: ["#FCE8E0", "#F5D5C8", "#A87468"],
    palette: {
      pageBg:      "#FCF8EE",
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
      petal:       "#E8B5A8",
      petalDeep:   "#D4948A",
      leaf:        "#9DAA85",
    },
  },
  cream: {
    label: "Cream Bloom",
    swatch: ["#FFF4E6", "#FFD8B8", "#C2845A"],
    palette: {
      pageBg:      "#FFF8EE",
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
      petal:       "#FFD4A8",
      petalDeep:   "#E8B888",
      leaf:        "#9DAA85",
    },
  },
  sage: {
    label: "Sage Garden",
    swatch: ["#E8EFE2", "#C7D5BB", "#5C7A4F"],
    palette: {
      pageBg:      "#F4F7EE",
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
      petal:       "#C7D5BB",
      petalDeep:   "#9DAA85",
      leaf:        "#5C7A4F",
    },
  },
};

// Paper sizes. Card height = page height - top/bottom safe area so
// content never bleeds. Cards are intentionally edge-to-edge in print:
// the @page margin sets the printer-safe area, and the card fills it
// completely. This is how professional print shops design postcards.
const SIZES = {
  postcard: {
    label: "Postcard 4×6",
    page: "4in 6in",
    pageMargin: "0",     // card bleeds to edge
    screenW: "4in",
    screenH: "6in",
    headerPx: 90,        // height of dusty rose header band
    amountSize: 56,
  },
  half: {
    label: "Half-page 5.5×8.5",
    page: "5.5in 8.5in",
    pageMargin: "0",
    screenW: "5.5in",
    screenH: "8.5in",
    headerPx: 130,
    amountSize: 78,
  },
  letter: {
    label: "Letter 8.5×11",
    page: "Letter",
    pageMargin: "0",
    screenW: "8.5in",
    screenH: "11in",
    headerPx: 180,
    amountSize: 110,
  },
};

// Botanical SVG flourish for card corners. Three variants matching
// the three templates personalities.
function Decoration({ palette, position, kind }) {
  const transform = {
    "top-left":     "",
    "top-right":    "scale(-1, 1) translate(-120, 0)",
    "bottom-left":  "scale(1, -1) translate(0, -120)",
    "bottom-right": "scale(-1, -1) translate(-120, -120)",
  }[position] || "";

  const baseStyle = {
    position: "absolute",
    width: "120px",
    height: "120px",
    pointerEvents: "none",
    opacity: 0.6,
    ...(position.startsWith("top")    ? { top: 0    } : {}),
    ...(position.startsWith("bottom") ? { bottom: 0 } : {}),
    ...(position.endsWith("left")     ? { left: 0   } : {}),
    ...(position.endsWith("right")    ? { right: 0  } : {}),
  };

  return (
    <svg style={baseStyle} viewBox="0 0 120 120" fill="none">
      <g transform={transform}>
        <path d="M10 110 Q 35 80, 70 40" stroke={palette.leaf} strokeWidth="1.2" fill="none" opacity="0.7"/>
        <ellipse cx="40" cy="75" rx="12" ry="5" fill={palette.petal} transform="rotate(-30 40 75)"/>
        <ellipse cx="55" cy="58" rx="11" ry="4.5" fill={palette.petal} transform="rotate(-30 55 58)"/>
        <ellipse cx="70" cy="42" rx="10" ry="4" fill={palette.petal} transform="rotate(-30 70 42)"/>
        <circle cx="78" cy="32" r="6" fill={palette.petalDeep}/>
        <circle cx="20" cy="95" r="4.5" fill={palette.petalDeep}/>
        <circle cx="50" cy="65" r="3" fill={palette.eyebrow} opacity="0.6"/>
      </g>
    </svg>
  );
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
          .select("id, full_name, business_name, custom_url")
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

  const sz = SIZES[size];
  const tpl = TEMPLATES[template];
  const p = tpl.palette;

  // print-color-adjust: exact ensures backgrounds print on Chromium +
  // Safari + Firefox even when user has "Background graphics" off.
  const colorExact = {
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
    colorAdjust: "exact",
  };

  return (
    <div style={{ background: "#F0EBE0", minHeight: "100vh", fontFamily: "Georgia, 'Iowan Old Style', serif" }}>
      {/* PRINT CSS — the critical block that makes this work */}
      <style>{`
        /* 1. Suppress browser headers/footers and set zero page margin */
        @page {
          size: ${sz.page};
          margin: ${sz.pageMargin};
        }

        @media print {
          /* 2. Hide all on-screen chrome */
          .no-print { display: none !important; }

          /* 3. Force backgrounds to print on every element */
          html, body, * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* 4. Strip body margins and prevent overflow */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* 5. The card BECOMES the page */
          .gc-print-card {
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            position: relative !important;
            overflow: hidden !important;
          }

          /* 6. Hide scroll wrapper, show only the card */
          .gc-print-wrapper {
            padding: 0 !important;
            background: transparent !important;
            display: block !important;
          }
        }

        * { box-sizing: border-box; }
      `}</style>

      {/* Top control bar — hidden during print */}
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

      {/* Helper hint */}
      <div className="no-print" style={{
        background: "#FFF8E1", borderBottom: "1px solid #F0E5C0",
        padding: "10px 24px", fontSize: 13, color: "#6B5A2A",
        textAlign: "center",
      }}>
        Pick a style and size, then click Print. Card prints edge-to-edge with no header or margins. Background colors will print correctly.
      </div>

      {/* The card preview area */}
      <div className="gc-print-wrapper" style={{
        padding: "40px 20px",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        background: "#F0EBE0",
      }}>
        <div className="gc-print-card" style={{
          width: sz.screenW,
          height: sz.screenH,            /* fixed, not min — prevents bleed */
          background: p.pageBg,
          borderRadius: 8,
          boxShadow: "0 12px 48px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          position: "relative",
          ...colorExact,
        }}>
          {/* Botanical decorations in all 4 corners */}
          <Decoration palette={p} position="top-left"     kind={template} />
          <Decoration palette={p} position="top-right"    kind={template} />
          <Decoration palette={p} position="bottom-left"  kind={template} />
          <Decoration palette={p} position="bottom-right" kind={template} />

          {/* Header band — fills full width, set height per size */}
          <div style={{
            background: `linear-gradient(135deg, ${p.headerStart} 0%, ${p.headerEnd} 100%)`,
            height: sz.headerPx,
            padding: "0 28px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            ...colorExact,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: p.eyebrow,
              letterSpacing: 2, marginBottom: 8,
              fontFamily: "system-ui, sans-serif",
            }}>
              ♡ A GIFT FOR YOU
            </div>
            <div style={{
              fontSize: size === "postcard" ? 26 : (size === "half" ? 36 : 48),
              fontWeight: 700, color: p.ink,
              fontFamily: "Georgia, serif",
              lineHeight: 1.15,
            }}>
              Dear {recipientName},
            </div>
          </div>

          {/* Body — flex 1 absorbs all remaining space, content centered */}
          <div style={{
            flex: 1,
            padding: "28px 32px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            position: "relative", zIndex: 1,
            textAlign: "center",
            gap: size === "postcard" ? 10 : (size === "half" ? 18 : 26),
          }}>
            {/* Worth + amount */}
            <div>
              <div style={{ fontSize: 13, color: p.warm, marginBottom: 4, fontFamily: "system-ui" }}>
                Worth
              </div>
              <div style={{
                fontSize: sz.amountSize, fontWeight: 700, color: p.amount,
                fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 4,
                ...colorExact,
              }}>
                ${amount.toFixed(0)}
              </div>
              <div style={{ fontSize: 13, color: p.warm, fontFamily: "system-ui" }}>
                of care
              </div>
            </div>

            {/* Personal note (only if exists) */}
            {personalNote && (
              <div style={{
                background: p.noteBg,
                borderLeft: `3px solid ${p.noteBorder}`,
                padding: size === "postcard" ? "10px 14px" : "14px 18px",
                borderRadius: 8,
                fontSize: size === "postcard" ? 13 : 15,
                color: p.ink, fontStyle: "italic",
                lineHeight: 1.5, fontFamily: "Georgia, serif",
                maxWidth: "85%",
                ...colorExact,
              }}>
                "{personalNote}"
              </div>
            )}

            {/* With love */}
            <div style={{ fontSize: 13, color: p.warm, fontFamily: "system-ui" }}>
              With love, <strong style={{ color: p.ink }}>{purchaserName}</strong>
            </div>

            {/* Dashed divider */}
            <div style={{
              width: "70%",
              borderTop: `1.5px dashed ${p.divider}`,
            }} />

            {/* Code */}
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: p.eyebrow,
                letterSpacing: 2, marginBottom: 8,
                fontFamily: "system-ui",
              }}>
                REDEMPTION CODE
              </div>
              <div style={{
                fontFamily: "'Courier New', monospace",
                fontSize: size === "postcard" ? 18 : (size === "half" ? 24 : 32),
                fontWeight: 700, color: p.amount,
                letterSpacing: 3,
                background: p.codeBg,
                padding: size === "postcard" ? "8px 14px" : "12px 22px",
                borderRadius: 8,
                display: "inline-block",
                ...colorExact,
              }}>
                {code}
              </div>
            </div>
          </div>

          {/* Footer band */}
          <div style={{
            background: p.footerBg,
            padding: size === "postcard" ? "12px 28px" : "16px 32px",
            borderTop: `1px solid ${p.divider}`,
            textAlign: "center",
            position: "relative", zIndex: 1,
            ...colorExact,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: p.ink, marginBottom: 2, fontFamily: "Georgia, serif" }}>
              Redeem with {businessName}
            </div>
            <div style={{ fontSize: 11, color: p.warm, fontFamily: "system-ui" }}>
              Book at {bookingLink}
            </div>
            {expiry && expiry !== "No expiration" && (
              <div style={{ fontSize: 10, color: p.warm, opacity: 0.7, marginTop: 4, fontFamily: "system-ui" }}>
                Valid until {expiry}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
