// src/pages/Comparison.jsx
//
// Solo-LMT software comparison. Static, beautiful, screenshot-shareable.
// Built on the April 2026 layout: pricing grid + annual-savings cards
// + full feature matrix grouped by 7 categories.
//
// Design goals (per HK):
//   - Mobile-first, generous whitespace, calm hierarchy
//   - Each section is its own screenshot-able block (people will share)
//   - On-brand: cream/sage/forest/gold, Georgia serif headings
//   - No emoji clutter, no Google Sheet, no "what we don't have" framing
//
// Data lives in src/data/comparisonData.js — edit there to update the
// table without touching this file.

import React from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { PLATFORMS, CATEGORIES, annualSavings } from "../data/comparisonData";

const C = {
  cream: "#FAF6EE",
  creamSoft: "#FBF8F1",
  beige: "#F5F0E8",
  sand: "#F0EAD9",
  forest: "#2A5741",
  forestInk: "#1F3A2C",
  forestDeep: "#1A3A28",
  sage: "#7A9C84",
  sageMute: "#9CB0A0",
  gold: "#B0902F",
  goldSoft: "#D4B968",
  goldChip: "#FBF4DC",
  ink: "#1F3A2C",
  inkSoft: "#4B5563",
  inkSofter: "#6B7280",
  inkSoftest: "#9CA3AF",
  border: "rgba(31,58,44,0.08)",
  borderStrong: "rgba(31,58,44,0.14)",
  yes: "#2A5741",
  yesBg: "#E8F0EA",
  no: "#C8CDC4",
  addon: "#B0902F",
  addonBg: "#FBF4DC",
  tbc: "#9CB0A0",
};

// Mark renderer — keeps the table dense but readable. Each mark is a
// small chip rather than raw text/svg, so the visual rhythm is steady.
function Mark({ value, highlight = false }) {
  if (value === "yes") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24, borderRadius: 12,
        background: highlight ? C.forest : C.yesBg,
        color: highlight ? "#fff" : C.yes,
      }}>
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6l2.5 2.5L9.5 3.5"/>
        </svg>
      </span>
    );
  }
  if (value === "yes+") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: 24, borderRadius: 12, padding: "0 9px",
        background: C.yesBg, color: C.yes, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em",
      }}>HIGHER TIER</span>
    );
  }
  if (value === "addon") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        height: 24, borderRadius: 12, padding: "0 9px",
        background: C.addonBg, color: C.addon, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em",
      }}>ADD-ON</span>
    );
  }
  if (value === "no") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24, color: C.no,
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M3 3l6 6M9 3l-6 6"/>
        </svg>
      </span>
    );
  }
  if (value === "tbc") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24, color: C.tbc, fontSize: 13, fontWeight: 600,
      }}>—</span>
    );
  }
  // Free-form text marks like "PWA"
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      height: 24, borderRadius: 12, padding: "0 9px",
      background: highlight ? "rgba(255,255,255,0.18)" : "rgba(124,156,132,0.14)",
      color: highlight ? "#fff" : C.forest,
      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em",
    }}>{value}</span>
  );
}

function PricingCard({ p }) {
  const isUs = p.highlight;
  return (
    <div style={{
      background: isUs ? `linear-gradient(135deg, #fff 0%, ${C.creamSoft} 100%)` : "#fff",
      border: `${isUs ? 2 : 1}px solid ${isUs ? C.forest : C.border}`,
      borderRadius: 18,
      padding: "24px 22px",
      position: "relative",
      boxShadow: isUs ? "0 12px 36px rgba(42,87,65,0.18)" : "0 2px 8px rgba(31,58,44,0.04)",
      transform: isUs ? "translateY(-4px)" : "none",
    }}>
      {isUs && (
        <div style={{
          position: "absolute",
          top: -12,
          left: "50%",
          transform: "translateX(-50%)",
          background: C.forest,
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          padding: "5px 12px",
          borderRadius: 99,
          whiteSpace: "nowrap",
        }}>You're here</div>
      )}
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 17,
        fontWeight: 700,
        color: C.forestInk,
        marginBottom: 4,
        letterSpacing: "-0.005em",
      }}>{p.name}</div>
      <div style={{ fontSize: 11.5, color: C.inkSofter, marginBottom: 14 }}>{p.tagline}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: C.inkSofter, fontWeight: 600 }}>from</span>
        <span style={{
          fontFamily: "Georgia, serif",
          fontSize: 28,
          fontWeight: 700,
          color: isUs ? C.forest : C.forestInk,
          fontVariantNumeric: "tabular-nums",
        }}>${p.priceFrom}</span>
        <span style={{ fontSize: 12, color: C.inkSofter }}>/mo</span>
      </div>
      {p.priceFrom === 0 && (
        <div style={{
          display: "inline-block",
          background: C.yesBg,
          color: C.forest,
          fontSize: 10.5,
          fontWeight: 700,
          padding: "3px 9px",
          borderRadius: 8,
          letterSpacing: "0.04em",
        }}>FREE TIER</div>
      )}
    </div>
  );
}

function SavingsCard({ competitor }) {
  const us = PLATFORMS[0]; // MyBodyMap
  const yearly = annualSavings(competitor.priceFrom, us.priceFrom);
  if (yearly <= 0) return null;
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: "20px 22px",
      boxShadow: "0 2px 8px rgba(31,58,44,0.04)",
    }}>
      <div style={{ fontSize: 11, color: C.inkSofter, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        Switching from {competitor.name}
      </div>
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 30,
        fontWeight: 700,
        color: C.forest,
        letterSpacing: "-0.015em",
        lineHeight: 1.1,
        marginBottom: 4,
        fontVariantNumeric: "tabular-nums",
      }}>
        ${yearly.toLocaleString()}<span style={{ fontSize: 14, color: C.inkSoft, fontWeight: 600 }}> /year saved</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.inkSofter }}>
        ${competitor.priceFrom}/mo → ${us.priceFrom}/mo
      </div>
    </div>
  );
}

function CategoryBlock({ cat }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        padding: "0 4px 12px",
        borderBottom: `2px solid ${C.borderStrong}`,
        marginBottom: 0,
      }}>
        <span style={{
          fontSize: 11,
          color: C.gold,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.02em",
        }}>{cat.id}</span>
        <h3 style={{
          fontFamily: "Georgia, serif",
          fontSize: 19,
          fontWeight: 700,
          color: C.forestInk,
          margin: 0,
          letterSpacing: "-0.005em",
        }}>{cat.name}</h3>
        <span style={{ fontSize: 12.5, color: C.inkSofter, marginLeft: "auto" }}>{cat.sub}</span>
      </div>
      <table style={{
        width: "100%",
        borderCollapse: "separate",
        borderSpacing: 0,
        tableLayout: "fixed",
      }}>
        <colgroup>
          <col style={{ width: "32%" }} />
          {PLATFORMS.map((p, i) => (
            <col key={p.id} style={{ width: `${68 / PLATFORMS.length}%` }} />
          ))}
        </colgroup>
        <tbody>
          {cat.rows.map((row, i) => (
            <tr key={i}>
              <td style={{
                padding: "13px 8px 13px 4px",
                fontSize: 13.5,
                color: C.ink,
                borderBottom: i < cat.rows.length - 1 ? `1px solid ${C.border}` : "none",
                lineHeight: 1.4,
              }}>{row.f}</td>
              {PLATFORMS.map((p) => (
                <td key={p.id} style={{
                  textAlign: "center",
                  padding: "13px 4px",
                  borderBottom: i < cat.rows.length - 1 ? `1px solid ${C.border}` : "none",
                  background: p.highlight ? "rgba(232, 240, 234, 0.4)" : "transparent",
                }}>
                  <Mark value={row[p.id]} highlight={p.highlight} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Comparison() {
  const us = PLATFORMS[0];
  const competitors = PLATFORMS.slice(1);

  return (
    <div style={{ background: C.cream, minHeight: "100vh" }}>
      <Nav />

      {/* Hero */}
      <header style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "60px 24px 36px",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.gold,
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          marginBottom: 14,
        }}>Side by side</div>
        <h1 style={{
          fontFamily: "Georgia, 'Iowan Old Style', serif",
          fontSize: "clamp(32px, 5.5vw, 50px)",
          fontWeight: 700,
          lineHeight: 1.15,
          color: C.forestInk,
          margin: "0 0 18px",
          letterSpacing: "-0.022em",
        }}>
          Solo massage software, <em style={{ color: C.gold, fontStyle: "italic" }}>compared honestly.</em>
        </h1>
        <p style={{
          fontSize: 16.5,
          lineHeight: 1.65,
          color: C.inkSoft,
          maxWidth: 640,
          margin: "0 auto 8px",
        }}>
          Seven platforms. The same questions. Different answers. Last verified May 2026.
        </p>
      </header>

      {/* Pricing grid */}
      <section style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "20px 24px 48px",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          alignItems: "stretch",
        }}>
          {PLATFORMS.map((p) => <PricingCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Annual savings */}
      <section style={{
        background: `linear-gradient(180deg, transparent 0%, ${C.beige} 50%, transparent 100%)`,
        padding: "40px 0",
      }}>
        <div style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "0 24px",
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.gold,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              marginBottom: 8,
            }}>Annual cost difference</div>
            <h2 style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(26px, 4vw, 34px)",
              fontWeight: 700,
              color: C.forestInk,
              margin: "0 0 12px",
              letterSpacing: "-0.015em",
              lineHeight: 1.25,
            }}>
              What you keep when you switch.
            </h2>
            <p style={{ fontSize: 14.5, color: C.inkSoft, maxWidth: 540, margin: "0 auto", lineHeight: 1.6 }}>
              Based on each platform's lowest published tier. Versus MyBodyMap's free Bronze tier.
            </p>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}>
            {competitors.map((c) => <SavingsCard key={c.id} competitor={c} />)}
          </div>
        </div>
      </section>

      {/* Feature matrix — all 7 categories */}
      <section style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "60px 16px 40px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 36, padding: "0 16px" }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.gold,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            marginBottom: 8,
          }}>The full picture</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(26px, 4vw, 34px)",
            fontWeight: 700,
            color: C.forestInk,
            margin: "0 0 12px",
            letterSpacing: "-0.015em",
            lineHeight: 1.25,
          }}>
            Feature by feature.
          </h2>
          <p style={{ fontSize: 14.5, color: C.inkSoft, maxWidth: 580, margin: "0 auto", lineHeight: 1.6 }}>
            Sixty-plus capabilities across seven categories. Pricing tiers vary; we show what's available on each platform's lowest paid tier.
          </p>
        </div>

        <div style={{
          background: "#fff",
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          padding: "24px 18px 18px",
          boxShadow: "0 6px 28px rgba(31,58,44,0.06)",
          overflowX: "auto",
        }}>
          <div style={{ minWidth: 760 }}>
            {/* Sticky header with platform names */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `32% repeat(${PLATFORMS.length}, 1fr)`,
              alignItems: "stretch",
              padding: "0 4px",
              marginBottom: 6,
              position: "sticky",
              top: 0,
              background: "#fff",
              zIndex: 5,
              paddingBottom: 12,
              paddingTop: 4,
              borderBottom: `1px solid ${C.borderStrong}`,
            }}>
              <div></div>
              {PLATFORMS.map((p) => (
                <div key={p.id} style={{
                  textAlign: "center",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: p.highlight ? C.forest : C.forestInk,
                  background: p.highlight ? C.yesBg : "transparent",
                  borderRadius: 8,
                  padding: "8px 4px",
                  margin: "0 2px",
                  lineHeight: 1.2,
                }}>
                  <div style={{ fontSize: p.highlight ? 12 : 11.5, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: p.highlight ? C.forest : C.inkSofter, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    ${p.priceFrom}<span style={{ fontSize: 9 }}>/mo</span>
                  </div>
                </div>
              ))}
            </div>

            {CATEGORIES.map((cat) => <CategoryBlock key={cat.id} cat={cat} />)}
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
          padding: "20px 16px 0",
          fontSize: 12,
          color: C.inkSoft,
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="yes"/> Available</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="yes+"/> Higher tier only</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="addon"/> Paid add-on</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="no"/> Not available</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark value="tbc"/> Unverified</span>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "20px 24px 80px",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.forest} 0%, ${C.forestDeep} 100%)`,
          color: "#fff",
          borderRadius: 22,
          padding: "44px 32px",
          textAlign: "center",
          boxShadow: "0 18px 56px rgba(42,87,65,0.30)",
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#FBF4DC",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            marginBottom: 12,
          }}>30-day free trial · no card required</div>
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(26px, 4vw, 34px)",
            fontWeight: 700,
            margin: "0 0 14px",
            lineHeight: 1.25,
          }}>See how MyBodyMap fits your practice.</h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(255,255,255,0.85)", margin: "0 auto 26px", maxWidth: 480 }}>
            Import your client list, send a personalized campaign, and feel the difference inside one afternoon.
          </p>
          <Link to="/signup" style={{
            display: "inline-block",
            background: "#fff",
            color: C.forest,
            textDecoration: "none",
            padding: "14px 32px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 15,
          }}>
            Start free →
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section style={{
        maxWidth: 760,
        margin: "0 auto 40px",
        padding: "0 24px",
      }}>
        <p style={{
          fontSize: 12,
          color: C.inkSofter,
          textAlign: "center",
          lineHeight: 1.6,
          margin: 0,
          fontStyle: "italic",
        }}>
          Comparison based on publicly available pricing and feature documentation as of May 2026. Pricing and features change. Verify directly with each provider before signing up. This page is informational only and not legal or financial advice.
        </p>
      </section>

      <Footer />
    </div>
  );
}
