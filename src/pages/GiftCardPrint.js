// src/pages/GiftCardPrint.js
//
// Browser-native print page for gift cards. Mirrors the architecture
// of PreSessionBrief.js / PostSessionBrief.js — standalone HTML route
// with @media print CSS and a window.print() button. No PDF library
// needed; the browser's own print dialog handles size, paper, save-
// as-PDF, and orientation.
//
// Why this pattern over jsPDF:
// 1. Therapist picks paper size in the print dialog (A4, Letter,
//    postcard 4x6, half-page 5.5x8.5, custom). Solves the "different
//    therapists want different sizes" requirement without us baking
//    in size choices.
// 2. Browser typography is crisper than jsPDF.
// 3. Zero new dependencies. Same pattern HK already validated for
//    Pre/Post Session Briefs.
// 4. Save-as-PDF is one click in any modern browser.
//
// Route: /gift-card/print/:id
//
// Public access — anyone with the gift cert id can view the print
// page. This is intentional: the therapist may want to email the
// recipient a print link. Gift cert ids are UUIDs, so guessing one
// is computationally infeasible.

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const C = {
  cream: "#FCF8EE",
  rose: "#8C4A3F",
  rosePale: "#FCE8E0",
  forest: "#2A5741",
  ink: "#5C2E27",
  warm: "#7A5C53",
  sage: "#9DAA92",
};

function formatExpiry(d) {
  if (!d) return "No expiration";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

export default function GiftCardPrint() {
  const { id } = useParams();
  const [cert, setCert] = useState(null);
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState("postcard"); // postcard | half | letter

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
    return <div style={{ padding: 40, fontFamily: "Georgia, serif", color: C.warm }}>Loading...</div>;
  }
  if (!cert) {
    return <div style={{ padding: 40, fontFamily: "Georgia, serif", color: C.warm }}>Gift card not found.</div>;
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

  // Three preset size options for the print dialog. The @page CSS
  // updates dynamically based on the chosen size. Therapist can still
  // override in the actual print dialog (most browsers let you pick
  // any paper size from there).
  const SIZES = {
    postcard: { label: "Postcard 4×6", page: "4in 6in", margin: "0.25in", cardWidth: "3.5in", cardHeight: "5.5in" },
    half:     { label: "Half-page 5.5×8.5", page: "5.5in 8.5in", margin: "0.4in", cardWidth: "4.7in", cardHeight: "7.7in" },
    letter:   { label: "Letter 8.5×11", page: "Letter", margin: "0.5in", cardWidth: "5in", cardHeight: "7in" },
  };
  const chosen = SIZES[size];

  return (
    <div style={{ background: C.cream, minHeight: "100vh", fontFamily: "Georgia, 'Iowan Old Style', serif" }}>
      {/* Print-only @page rules. Dynamic based on size selection. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { size: ${chosen.page}; margin: ${chosen.margin}; }
          .gc-card { box-shadow: none !important; page-break-inside: avoid; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar — visible on screen, hidden in print */}
      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: C.forest, color: "white",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          🎁 Gift Card Preview
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, opacity: 0.9 }}>Size:</div>
          {Object.entries(SIZES).map(([key, s]) => (
            <button key={key}
              onClick={() => setSize(key)}
              style={{
                background: size === key ? "white" : "transparent",
                color: size === key ? C.forest : "white",
                border: `1.5px solid ${size === key ? "white" : "rgba(255,255,255,0.4)"}`,
                padding: "6px 14px", borderRadius: 999,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
              }}>
              {s.label}
            </button>
          ))}
          <button onClick={() => window.print()} style={{
            background: "white", color: C.forest,
            border: "none", padding: "8px 22px",
            borderRadius: 8, fontSize: 14, fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>🖨️ Print or Save as PDF</button>
        </div>
      </div>

      {/* Helper hint — visible on screen only */}
      <div className="no-print" style={{
        background: "#FFF8E1", borderBottom: "1px solid #F0E5C0",
        padding: "10px 24px", fontSize: 13, color: "#6B5A2A",
        textAlign: "center",
      }}>
        Tip: in the print dialog you can change paper size, set margins, or pick "Save as PDF" to share digitally.
      </div>

      {/* The card itself — sized to the chosen format */}
      <div style={{ padding: "40px 20px", display: "flex", justifyContent: "center" }}>
        <div className="gc-card" style={{
          width: chosen.cardWidth,
          minHeight: chosen.cardHeight,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 12px 48px rgba(0,0,0,0.12)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {/* Dusty rose header band */}
          <div style={{
            background: `linear-gradient(135deg, ${C.rosePale} 0%, #F5D5C8 100%)`,
            padding: "28px 28px 22px",
            textAlign: "center",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#A87468",
              letterSpacing: 2, marginBottom: 10,
              fontFamily: "system-ui, sans-serif",
            }}>
              ♡ A GIFT FOR YOU
            </div>
            <div style={{
              fontSize: 28, fontWeight: 700, color: C.ink,
              fontFamily: "Georgia, serif",
              lineHeight: 1.2,
            }}>
              Dear {recipientName},
            </div>
          </div>

          {/* Amount block */}
          <div style={{ padding: "26px 28px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: C.warm, marginBottom: 4, fontFamily: "system-ui" }}>
              Worth
            </div>
            <div style={{
              fontSize: 56, fontWeight: 700, color: C.forest,
              fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 4,
            }}>
              ${amount.toFixed(0)}
            </div>
            <div style={{ fontSize: 13, color: C.warm, fontFamily: "system-ui" }}>
              of care
            </div>
          </div>

          {/* Personal note */}
          {personalNote && (
            <div style={{ padding: "0 28px", marginBottom: 18 }}>
              <div style={{
                background: "#FAF6EE", borderLeft: `3px solid #C99488`,
                padding: "14px 18px", borderRadius: 8,
                fontSize: 14, color: "#5C3A33", fontStyle: "italic",
                lineHeight: 1.6, fontFamily: "Georgia, serif",
              }}>
                "{personalNote}"
              </div>
            </div>
          )}

          <div style={{ padding: "0 28px", marginBottom: 14, fontSize: 13, color: C.warm, fontFamily: "system-ui", textAlign: "center" }}>
            With love, <strong style={{ color: C.ink }}>{purchaserName}</strong>
          </div>

          {/* Dashed divider */}
          <div style={{ borderTop: "1.5px dashed #E5D5C8", margin: "0 28px" }} />

          {/* Redemption code */}
          <div style={{ padding: "20px 28px 12px", textAlign: "center" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "#A87468",
              letterSpacing: 2, marginBottom: 8,
              fontFamily: "system-ui",
            }}>
              REDEMPTION CODE
            </div>
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 22, fontWeight: 700, color: C.forest,
              letterSpacing: 3,
              background: "#F5EFE0",
              padding: "12px 18px",
              borderRadius: 10,
              display: "inline-block",
            }}>
              {code}
            </div>
          </div>

          {/* Footer with business + booking link */}
          <div style={{
            marginTop: "auto",
            background: "#FAF6EE",
            padding: "16px 28px",
            borderTop: "1px solid #E5D5C8",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 4, fontFamily: "Georgia, serif" }}>
              Redeem with {businessName}
            </div>
            <div style={{ fontSize: 11, color: C.warm, fontFamily: "system-ui" }}>
              Book at {bookingLink}
            </div>
            {expiry && (
              <div style={{ fontSize: 10, color: "#9C8E70", marginTop: 6, fontFamily: "system-ui" }}>
                Valid until {expiry}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
