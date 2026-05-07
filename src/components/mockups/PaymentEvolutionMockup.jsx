// src/components/mockups/PaymentEvolutionMockup.jsx
//
// MOCKUP / DESIGN ARTIFACT — not wired into production booking page.
// Lives at /mockups/payment-evolution so HK can preview how the
// client booking checkout evolves across the three phases of the
// payment-method roadmap WITHOUT rebuilding the UI shell each time.
//
// Phase 1 (this month): Apple Pay / Google Pay surface dynamically
//   based on device. Card form remains the foundation. Therapist
//   configures nothing new.
// Phase 2 (Q3 2026): ACH bank transfer added as a 'more options'
//   disclosure. Surfaces honestly with settlement timing warning.
// Phase 3 (2027 when FedNow has merchant webhooks): Real-time bank
//   push payments added alongside ACH. Both under 'pay from your bank'.
//
// Design principle this proves out: 'sensible defaults beat
// exhaustive options.' The default UI never gets harder for the
// 70-year-old persona. Younger / power users get more options
// surfaced when their device signals support.

import React, { useState } from "react";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F3A2C",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5D5C8",
  green:  "#16A34A",
  greenBg:"#DCFCE7",
  amber:  "#D97706",
  amberBg:"#FEF3C7",
  amberFg:"#78350F",
};

// Three personas to demonstrate the per-customer dynamic surfacing.
// Stripe Payment Element automatically detects which methods to show
// based on device + locale. We simulate that here.
const PERSONAS = [
  {
    id: "older-desktop",
    label: "70-yr-old · Safari · desktop",
    device: "💻",
    methods: { applePay: false, googlePay: false, link: false },
    note: "Phone in another room. Booking on her laptop. Wants the simplest possible checkout.",
  },
  {
    id: "millennial-iphone",
    label: "30-yr-old · iPhone · mobile",
    device: "📱",
    methods: { applePay: true, googlePay: false, link: true },
    note: "Booking from bed. Has Apple Pay set up. Will choose whatever is fastest.",
  },
  {
    id: "android-user",
    label: "40-yr-old · Android · mobile",
    device: "📱",
    methods: { applePay: false, googlePay: true, link: false },
    note: "Booking on lunch break. Has Google Pay configured.",
  },
];

const PHASES = [
  { id: 1, label: "Phase 1", subtitle: "This month", color: C.green },
  { id: 2, label: "Phase 2", subtitle: "Q3 2026", color: C.amber },
  { id: 3, label: "Phase 3", subtitle: "2027 · FedNow ready", color: "#7B1FA2" },
];

export default function PaymentEvolutionMockup() {
  const [phase, setPhase] = useState(1);
  const [persona, setPersona] = useState(PERSONAS[0]);
  const [showMore, setShowMore] = useState(false);

  return (
    <div style={{
      maxWidth: 1200,
      margin: "0 auto",
      padding: "40px 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <Header />

      {/* Phase + persona controls */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        marginBottom: 28,
      }}>
        <ControlCard label="Phase">
          <div style={{ display: "flex", gap: 6 }}>
            {PHASES.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPhase(p.id); setShowMore(false); }}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  background: phase === p.id ? p.color : "#fff",
                  color: phase === p.id ? "#fff" : C.ink,
                  border: `1.5px solid ${phase === p.id ? p.color : C.border}`,
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                <div>{p.label}</div>
                <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.8, marginTop: 2 }}>
                  {p.subtitle}
                </div>
              </button>
            ))}
          </div>
        </ControlCard>

        <ControlCard label="Customer device">
          <div style={{ display: "flex", gap: 6 }}>
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPersona(p); setShowMore(false); }}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  background: persona.id === p.id ? C.forest : "#fff",
                  color: persona.id === p.id ? "#fff" : C.ink,
                  border: `1.5px solid ${persona.id === p.id ? C.forest : C.border}`,
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                  lineHeight: 1.4,
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{p.device}</div>
                <div>{p.label}</div>
              </button>
            ))}
          </div>
        </ControlCard>
      </div>

      {/* Persona context note */}
      <div style={{
        background: C.cream,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        color: C.gray,
        marginBottom: 24,
        fontStyle: "italic",
      }}>
        <strong style={{ color: C.ink, fontStyle: "normal" }}>Scenario:</strong> {persona.note}
      </div>

      {/* The booking page mockup */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 380px)",
        gap: 24,
        alignItems: "start",
      }}>
        <BookingPagePreview
          phase={phase}
          persona={persona}
          showMore={showMore}
          onToggleMore={() => setShowMore((v) => !v)}
        />
        <PhaseDetailPanel phase={phase} persona={persona} />
      </div>

      <BottomLine phase={phase} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.sage,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginBottom: 8,
      }}>
        Internal mockup · payment evolution roadmap
      </div>
      <h2 style={{
        fontFamily: "Georgia, serif",
        fontSize: 30,
        fontWeight: 700,
        color: C.forest,
        margin: 0,
        marginBottom: 10,
      }}>
        Same booking page, three phases
      </h2>
      <p style={{
        fontSize: 14,
        color: C.gray,
        margin: "0 auto",
        maxWidth: 680,
        lineHeight: 1.6,
      }}>
        The UI shell never changes. New payment methods slot in as device signals or our roadmap
        unlock them. The 70-year-old persona never sees more options than she needs. The 30-year-old
        with Apple Pay sees Apple Pay first, automatically.
      </p>
    </div>
  );
}

function ControlCard({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.gray,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// The actual mock booking page (left side of the layout)
// ───────────────────────────────────────────────────────────────────
function BookingPagePreview({ phase, persona, showMore, onToggleMore }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      padding: 24,
      boxShadow: "0 12px 40px rgba(42, 87, 65, 0.10)",
      border: `1px solid ${C.border}`,
    }}>
      {/* Mock booking header */}
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px dashed ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Confirm booking
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: C.ink }}>
            Deep tissue · 60 min
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>
            $120.00
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.gray }}>
          Thursday, May 14 · 2:00 PM · Healing Hands LMT
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 12 }}>
        How would you like to pay?
      </div>

      {/* Wallet methods (Phase 1+) — only when device signals support */}
      {persona.methods.applePay && (
        <WalletButton
          variant="apple"
          label="Pay"
        />
      )}
      {persona.methods.googlePay && (
        <WalletButton
          variant="google"
          label="Pay"
        />
      )}

      {/* Link from Stripe (one-tap saved card) — Phase 1 if customer has it */}
      {persona.methods.link && phase >= 1 && (
        <button disabled style={{
          ...walletButtonStyle,
          background: "#fff",
          color: "#01D86F",
          border: "1.5px solid #01D86F",
        }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>link</span>
          <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 8 }}>
            · Saved Visa ••4242
          </span>
        </button>
      )}

      {/* Divider when wallets present */}
      {(persona.methods.applePay || persona.methods.googlePay || persona.methods.link) && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "16px 0",
          fontSize: 11,
          color: C.gray,
          letterSpacing: 1,
        }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span>OR PAY WITH CARD</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>
      )}

      {/* Card form — always present, the foundation */}
      <CardForm />

      {/* "More ways to pay" disclosure — Phase 2 adds ACH, Phase 3 adds bank push */}
      {phase >= 2 && (
        <>
          <button
            onClick={onToggleMore}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              color: C.forest,
              fontSize: 12,
              fontWeight: 600,
              padding: "12px 0",
              cursor: "pointer",
              textAlign: "center",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {showMore ? "Hide other ways to pay" : "Other ways to pay (lower fees)"}
          </button>

          {showMore && (
            <div style={{
              background: C.cream,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 14,
              marginTop: 4,
            }}>
              {phase >= 2 && (
                <PaymentMethodOption
                  label="Pay from your bank"
                  sublabel="Settles in 1-3 business days · saves $2.50"
                  icon={<BankIcon />}
                  fee="$1.00"
                  feeNote="vs $3.50"
                />
              )}
              {phase >= 3 && (
                <PaymentMethodOption
                  label="Real-time bank payment"
                  sublabel="Instant · sends from your bank app · saves $3.45"
                  icon={<LightningBoltIcon />}
                  fee="$0.05"
                  feeNote="vs $3.50"
                  highlight
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Final confirm CTA */}
      <button disabled style={{
        width: "100%",
        background: C.forest,
        color: "#fff",
        border: "none",
        borderRadius: 10,
        padding: "14px 16px",
        fontSize: 14,
        fontWeight: 700,
        cursor: "default",
        marginTop: 16,
      }}>
        Confirm and pay $120.00
      </button>

      <div style={{
        textAlign: "center",
        fontSize: 10,
        color: C.gray,
        marginTop: 10,
        lineHeight: 1.5,
      }}>
        🔒 Secured by Stripe. Your card details never touch our servers.
      </div>
    </div>
  );
}

const walletButtonStyle = {
  width: "100%",
  border: "none",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 700,
  color: "#fff",
  cursor: "default",
  marginBottom: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#000",
};

function WalletButton({ variant }) {
  if (variant === "apple") {
    return (
      <button disabled style={walletButtonStyle}>
        <svg viewBox="0 0 50 20" width="50" height="20" style={{ marginRight: 4 }}>
          <text x="0" y="15" fontSize="14" fontWeight="700" fill="#fff">
            Pay
          </text>
        </svg>
      </button>
    );
  }
  return (
    <button disabled style={{
      ...walletButtonStyle,
      background: "#fff",
      color: "#202124",
      border: `1.5px solid ${C.border}`,
    }}>
      <span style={{ fontFamily: "Roboto, sans-serif", fontWeight: 700 }}>
        <span style={{ color: "#4285F4" }}>G</span>
        <span style={{ color: "#EA4335" }}> </span>
        <span style={{ color: "#202124" }}>Pay</span>
      </span>
    </button>
  );
}

function CardForm() {
  return (
    <div>
      <div style={{
        background: "#fff",
        border: `1.5px solid ${C.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <CardChipIcon />
        <input
          placeholder="1234 1234 1234 1234"
          disabled
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            color: C.ink,
            fontFamily: "monospace",
            letterSpacing: 1,
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input
          placeholder="MM / YY"
          disabled
          style={{
            border: `1.5px solid ${C.border}`,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            color: C.ink,
            fontFamily: "monospace",
          }}
        />
        <input
          placeholder="CVC"
          disabled
          style={{
            border: `1.5px solid ${C.border}`,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            color: C.ink,
            fontFamily: "monospace",
          }}
        />
      </div>
    </div>
  );
}

function PaymentMethodOption({ label, sublabel, icon, fee, feeNote, highlight }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      background: "#fff",
      border: `1.5px solid ${highlight ? C.green : C.border}`,
      borderRadius: 10,
      marginBottom: 8,
    }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{label}</div>
        <div style={{ fontSize: 10, color: C.gray, lineHeight: 1.4 }}>{sublabel}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? C.green : C.ink }}>{fee}</div>
        <div style={{ fontSize: 9, color: C.gray }}>{feeNote}</div>
      </div>
    </div>
  );
}

function CardChipIcon() {
  return (
    <svg viewBox="0 0 24 16" width="24" height="16" style={{ flexShrink: 0 }}>
      <rect x="0" y="0" width="24" height="16" rx="2" fill="#F3F4F6" stroke={C.border} strokeWidth="1" />
      <rect x="3" y="4" width="5" height="3.5" rx="0.5" fill="#C9A84C" />
      <rect x="3" y="11" width="18" height="1.5" fill="#A0A0A0" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg viewBox="0 0 24 18" width="24" height="18">
      <polygon points="12,2 22,7 2,7" fill={C.forest} />
      <rect x="3" y="8" width="2" height="7" fill={C.forest} />
      <rect x="8" y="8" width="2" height="7" fill={C.forest} />
      <rect x="14" y="8" width="2" height="7" fill={C.forest} />
      <rect x="19" y="8" width="2" height="7" fill={C.forest} />
      <rect x="2" y="15" width="20" height="2" fill={C.forest} />
    </svg>
  );
}

function LightningBoltIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#7B1FA2" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────
// Right side: phase details panel
// ───────────────────────────────────────────────────────────────────
function PhaseDetailPanel({ phase, persona }) {
  const phaseInfo = {
    1: {
      title: "Apple Pay + Google Pay surface dynamically",
      shipDate: "This month · ~1 day build",
      whatChanges: [
        "Stripe Payment Element ships with wallet methods enabled",
        "Apple Pay button appears on iOS Safari devices automatically",
        "Google Pay button appears on Android / Chrome with G Pay set up",
        "Stripe Link surfaces if the customer has it configured",
        "Card form remains the foundation for everyone else",
      ],
      whatDoesNotChange: [
        "Therapist configures nothing new",
        "70-year-old persona never sees what she does not need",
        "Same fees for all card-based methods (2.9% + $0.30)",
        "Same processor relationships (Stripe, optionally Square)",
      ],
      newLiability: "None. Wallet methods are still card payments under the hood. Same dispute rules, same chargeback windows, same compliance posture.",
    },
    2: {
      title: "ACH bank transfer added behind 'more options' disclosure",
      shipDate: "Q3 2026 · 3-5 day build",
      whatChanges: [
        "'Other ways to pay (lower fees)' link appears after card form",
        "Tapping it reveals a 'Pay from your bank' option via Plaid Link",
        "Customer logs into bank, money moves bank-to-bank",
        "Settles in 1-3 business days",
        "Therapist sees pending state until ACH clears",
      ],
      whatDoesNotChange: [
        "Default UI for the 70-year-old persona is identical to Phase 1",
        "Card form still primary",
        "Therapist still configures nothing new",
      ],
      newLiability: "ACH returns up to 60 days. Mitigated by NACHA-compliant authorization mandate, holdback period, status truthfulness ('pending' until settled). Plaid handles bank credentials; we never see them.",
    },
    3: {
      title: "Real-time bank payments (FedNow) added alongside ACH",
      shipDate: "2027 · pending FedNow merchant webhook rollout",
      whatChanges: [
        "Second option in 'more ways to pay': real-time push payment",
        "Customer confirms in their bank app, money arrives in seconds",
        "Almost zero fees ($0.05 per transaction)",
        "Settles immediately, no holdback period",
      ],
      whatDoesNotChange: [
        "Default UI still identical",
        "ACH option remains for customers whose banks do not support FedNow",
      ],
      newLiability: "Lower than ACH actually — FedNow transfers are final on send, no return window. Risk shifts to customer fraud (sending then disputing with bank) but bank is not obligated to help once FedNow is sent.",
    },
  };

  const info = phaseInfo[phase];

  return (
    <div style={{
      background: C.cream,
      borderRadius: 14,
      padding: 22,
      border: `1px solid ${C.border}`,
      position: "sticky",
      top: 20,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.gray,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginBottom: 4,
      }}>
        {info.shipDate}
      </div>
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 16,
        fontWeight: 700,
        color: C.forest,
        marginBottom: 14,
        lineHeight: 1.3,
      }}>
        {info.title}
      </div>

      <Section title="What this customer sees" muted>
        <PersonaSummary persona={persona} phase={phase} />
      </Section>

      <Section title="What changes">
        {info.whatChanges.map((item, i) => (
          <div key={i} style={listItemStyle}>
            <span style={{ color: C.green, fontWeight: 800, marginRight: 6 }}>+</span>
            {item}
          </div>
        ))}
      </Section>

      <Section title="What stays the same">
        {info.whatDoesNotChange.map((item, i) => (
          <div key={i} style={listItemStyle}>
            <span style={{ color: C.gray, fontWeight: 800, marginRight: 6 }}>=</span>
            {item}
          </div>
        ))}
      </Section>

      <Section title="New liability">
        <div style={{ fontSize: 11, color: C.amberFg, lineHeight: 1.55 }}>
          {info.newLiability}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children, muted }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: muted ? C.gray : C.ink,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const listItemStyle = {
  fontSize: 11,
  color: "#1F3A2C",
  lineHeight: 1.55,
  marginBottom: 4,
  display: "flex",
  alignItems: "flex-start",
};

function PersonaSummary({ persona, phase }) {
  const items = [];
  if (persona.methods.applePay) items.push("Apple Pay button at top");
  if (persona.methods.googlePay) items.push("Google Pay button at top");
  if (persona.methods.link) items.push("Stripe Link (saved card)");
  items.push("Card form (always)");
  if (phase >= 2) items.push("'Other ways to pay' disclosure available");

  return (
    <div style={{ fontSize: 11, color: C.ink, lineHeight: 1.5 }}>
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 2 }}>· {it}</div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
function BottomLine({ phase }) {
  const messages = {
    1: "Phase 1 is one day of work. No new liability. The 70-year-old never sees more buttons. Younger users with wallets get one-tap checkout.",
    2: "Phase 2 unlocks real fee savings ($2-3 per session) for customers who opt into ACH. Surface honestly with settlement timing warning. Defer to Q3 once Stripe + Square parity has 30+ days of production data.",
    3: "Phase 3 waits for the rails to mature. FedNow merchant webhook support is rolling out 2026-2027. Real-time settlement, near-zero fees, irreversible — best for high-trust client relationships.",
  };
  return (
    <div style={{
      marginTop: 32,
      background: "#fff",
      border: `1.5px solid ${C.border}`,
      borderRadius: 14,
      padding: "20px 24px",
      fontSize: 13,
      color: C.ink,
      lineHeight: 1.7,
    }}>
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 16,
        fontWeight: 700,
        color: C.forest,
        marginBottom: 6,
      }}>
        Bottom line
      </div>
      {messages[phase]}
    </div>
  );
}
