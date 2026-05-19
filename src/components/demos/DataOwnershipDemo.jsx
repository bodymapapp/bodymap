// src/components/demos/DataOwnershipDemo.jsx
//
// Animated SVG demo for data ownership / 'Download all my data'.
// Shown on Home (in a ribbon) and Features (card body).
//
// Per HK direction: 'showcase that we let therapists take all their
// data for free vs. others who provide limited information with a
// complex way to download.' Comparison style. 100% factual.
//
// All competitor claims verified against public support docs:
//   - Vagaro: Customer list as Excel/PDF, Calendar as .ics,
//     Appointments Summary as Excel/PDF, per-customer history as
//     download/print. Multiple separate exports from multiple
//     screens. Sources: Vagaro support articles 360006371094,
//     360000242193, 360000550993.
//   - MassageBook: Client list CSV, Reports CSV per report.
//     SOAP notes saved one at a time as PDF via browser print.
//     Same for intake forms. Sources: support articles
//     18572149119757, 18572085380621.
//   - Acuity: Client list CSV, Appointments CSV. No native SOAP
//     feature (scheduling-only platform). Source: support article
//     16676916553485.
//
// Loop story (~6 seconds):
//   Stage 0 (0 to 2s): two side-by-side panels light up, both
//     'idle' state. Title 'How exports work.'
//   Stage 1 (2s to 4s): Other Platforms panel shows multiple
//     separate file icons spawning one at a time (Clients...
//     Appointments... SOAP one PDF at a time...). Slow, scattered.
//   Stage 2 (4s to 6s): MyBodyMap panel shows ONE button tap, a
//     spinner, then a single ZIP file fly-in with all 14 files
//     listed inside. Clean, single motion.
//
// Built with declarative SVG + CSS-keyframe-style transitions.

import React, { useEffect, useState } from "react";

const PALETTE = {
  forest: "#2A5741",
  forestDeep: "#1F4131",
  sage: "#6B9E80",
  sageSoft: "#B7D1AB",
  sageTint: "#F0F6EE",
  cream: "#FAF6EE",
  creamDeep: "#F5EFE0",
  creamEdge: "#EDE6D6",
  white: "#FFFFFF",
  gray700: "#374151",
  gray500: "#6B7280",
  gray400: "#9CA3AF",
  gray300: "#D1D5DB",
  gray100: "#F3F4F6",
  ink: "#1F2937",
  amber: "#D97706",
  amberSoft: "#FEF3C7",
};

const STAGE_DURATION_MS = 2000;

export default function DataOwnershipDemo() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % 3);
    }, STAGE_DURATION_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: "100%",
      maxWidth: 420,
      margin: "0 auto",
      background: PALETTE.cream,
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 4px 16px rgba(31, 65, 49, 0.08)",
      border: `1px solid ${PALETTE.creamEdge}`,
      overflow: "hidden",
    }}>
      <svg viewBox="0 0 400 380" width="100%" height="auto" style={{ display: "block" }} aria-label="Data ownership demo">
        <defs>
          <linearGradient id="do-forest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PALETTE.forest} />
            <stop offset="1" stopColor={PALETTE.forestDeep} />
          </linearGradient>
        </defs>

        {/* Title */}
        <text x="200" y="22" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontSize="18" fontWeight="700" fill={PALETTE.forestDeep}>
          How exports work
        </text>

        {/* ─── LEFT PANEL: Other platforms ─── */}
        <g>
          <rect x="10" y="40" width="185" height="320" rx="14"
            fill={PALETTE.white}
            stroke={PALETTE.creamEdge}
            strokeWidth="1"
          />
          <text x="102" y="60" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="11" fontWeight="700" fill={PALETTE.gray500} letterSpacing="0.06em">
            OTHER PLATFORMS
          </text>
          <text x="102" y="78" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontStyle="italic" fill={PALETTE.gray400}>
            Vagaro · MassageBook · Acuity
          </text>

          {/* Separate file icons appearing one at a time (stage >= 1) */}
          {[
            { label: "Clients.csv", screen: "Reports screen", y: 100 },
            { label: "Appointments.csv", screen: "Different report", y: 152 },
            { label: "SOAP #1.pdf", screen: "Print one at a time", y: 204 },
            { label: "SOAP #2.pdf", screen: "Print one at a time", y: 232 },
            { label: "SOAP #3.pdf", screen: "...continue manually", y: 260 },
          ].map((file, idx) => (
            <g key={idx} style={{
              opacity: stage >= 1 ? 1 : 0,
              transition: `opacity 0.4s ease ${idx * 0.15}s`,
            }}>
              <rect x="22" y={file.y} width="162" height="40" rx="8"
                fill={PALETTE.gray100}
                stroke={PALETTE.gray300}
                strokeWidth="0.5"
              />
              {/* File icon */}
              <rect x="32" y={file.y + 10} width="16" height="20" rx="2"
                fill={PALETTE.white}
                stroke={PALETTE.gray400}
                strokeWidth="0.7"
              />
              <line x1="35" y1={file.y + 16} x2="44" y2={file.y + 16} stroke={PALETTE.gray400} strokeWidth="0.5" />
              <line x1="35" y1={file.y + 19} x2="44" y2={file.y + 19} stroke={PALETTE.gray400} strokeWidth="0.5" />
              <line x1="35" y1={file.y + 22} x2="44" y2={file.y + 22} stroke={PALETTE.gray400} strokeWidth="0.5" />
              <text x="56" y={file.y + 19} fontFamily="-apple-system, sans-serif" fontSize="11" fontWeight="600" fill={PALETTE.ink}>
                {file.label}
              </text>
              <text x="56" y={file.y + 31} fontFamily="-apple-system, sans-serif" fontSize="9" fill={PALETTE.gray500}>
                {file.screen}
              </text>
            </g>
          ))}

          {/* Footer note */}
          <text x="102" y="334" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="10" fill={PALETTE.gray500} style={{
            opacity: stage >= 1 ? 1 : 0,
            transition: "opacity 0.6s ease 0.8s",
          }}>
            Separate exports
          </text>
          <text x="102" y="346" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="10" fill={PALETTE.gray500} style={{
            opacity: stage >= 1 ? 1 : 0,
            transition: "opacity 0.6s ease 0.9s",
          }}>
            from multiple screens
          </text>
        </g>

        {/* ─── RIGHT PANEL: MyBodyMap ─── */}
        <g>
          <rect x="205" y="40" width="185" height="320" rx="14"
            fill={PALETTE.sageTint}
            stroke={PALETTE.sageSoft}
            strokeWidth="1"
          />
          <text x="297" y="60" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="11" fontWeight="700" fill={PALETTE.forestDeep} letterSpacing="0.06em">
            MYBODYMAP
          </text>
          <text x="297" y="78" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontStyle="italic" fill={PALETTE.sage}>
            One tap. Everything.
          </text>

          {/* Single download button + state changes */}
          <g style={{
            opacity: stage === 0 ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}>
            <rect x="225" y="110" width="144" height="36" rx="18" fill="url(#do-forest)" />
            <text x="297" y="133" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="12" fontWeight="700" fill={PALETTE.white}>
              Download my data
            </text>
          </g>

          {/* ZIP arriving (stage >= 2) */}
          <g style={{
            opacity: stage >= 2 ? 1 : 0,
            transform: stage >= 2 ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
            transformOrigin: "center",
          }}>
            <rect x="225" y="100" width="144" height="220" rx="12"
              fill={PALETTE.white}
              stroke={PALETTE.sageSoft}
              strokeWidth="1.5"
            />
            <text x="297" y="120" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="10" fontWeight="700" fill={PALETTE.forestDeep} letterSpacing="0.06em">
              📦 mybodymap-export.zip
            </text>
            {/* Inner file list */}
            {[
              "clients.csv",
              "bookings.csv",
              "sessions.csv",
              "soap_notes.csv",
              "payments.csv",
              "intake_responses.csv",
              "services.csv",
              "memberships.csv",
              "gift_certs.csv",
              "waivers.csv",
              "profile.json",
              "README.txt",
            ].map((name, idx) => (
              <g key={name}>
                <rect x="232" y={130 + idx * 14} width="6" height="6" rx="1" fill={PALETTE.sage} />
                <text x="245" y={136 + idx * 14} fontFamily="-apple-system, sans-serif" fontSize="9" fill={PALETTE.gray700}>
                  {name}
                </text>
              </g>
            ))}
            <text x="297" y="312" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="9" fontStyle="italic" fill={PALETTE.gray500}>
              + 2 more
            </text>
          </g>

          {/* Footer note */}
          <text x="297" y="334" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="10" fontWeight="600" fill={PALETTE.forestDeep} style={{
            opacity: stage >= 2 ? 1 : 0,
            transition: "opacity 0.6s ease 0.6s",
          }}>
            One ZIP, all data
          </text>
          <text x="297" y="346" textAnchor="middle" fontFamily="-apple-system, sans-serif" fontSize="10" fill={PALETTE.forestDeep} style={{
            opacity: stage >= 2 ? 1 : 0,
            transition: "opacity 0.6s ease 0.7s",
          }}>
            Emailed to you
          </text>
        </g>
      </svg>

      {/* Caption */}
      <div style={{
        marginTop: 10,
        textAlign: "center",
        fontFamily: "Georgia, serif",
        fontSize: 12,
        fontStyle: "italic",
        color: PALETTE.gray500,
        minHeight: 36,
        lineHeight: 1.5,
      }}>
        {stage === 0 && "Both let you export. Only one bundles it all."}
        {stage === 1 && "Other platforms: separate exports, multiple screens."}
        {stage === 2 && "MyBodyMap: one tap, one ZIP, emailed to you."}
      </div>
    </div>
  );
}
