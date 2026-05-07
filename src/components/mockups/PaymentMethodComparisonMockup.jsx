// src/components/mockups/PaymentMethodComparisonMockup.jsx
//
// MOCKUP / DESIGN ARTIFACT — not wired into production routing.
// Lives in /mockups so therapists / HK / future Claude sessions can
// see what the three alternative payment-method UI patterns would
// LOOK like without us having committed to building any of them.
//
// Three options shown side by side:
//   1. ACH bank transfer (Plaid Link)
//   2. Real-time payments (Zelle / FedNow / RTP push)
//   3. Apple Pay / Google Pay (still card networks underneath)
//
// Plus the existing card-on-file path for context.
//
// Goal: HK can show this to Katelynn or any therapist asking "can
// I use my bank instead of Stripe/Square?" and have a real visual
// answer instead of just words. Each option has its honest pros
// and cons listed so the choice is informed.

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
  red:    "#DC2626",
};

// ───────────────────────────────────────────────────────────────────
// Option 1: ACH bank transfer via Plaid Link
// ───────────────────────────────────────────────────────────────────
function ACHBankTransferMockup() {
  const [stage, setStage] = useState(0);
  return (
    <MockupShell
      title="Option 1: Bank-to-bank (ACH)"
      subtitle="Lower fees. Settles in 1-3 business days."
      eyebrow="ACH VIA PLAID"
      eyebrowColor="#0EA5E9"
      stages={["Intro", "Plaid Link", "Confirm", "Done"]}
      currentStage={stage}
      onStage={setStage}
    >
      {stage === 0 && (
        <div style={mockBookingPanel}>
          <div style={panelLabel}>How do you want to pay?</div>

          <PaymentMethodOption
            label="Card"
            sublabel="Visa, Mastercard, Amex"
            icon={<CardIcon />}
            fee="$3.20"
            note="Standard"
          />
          <PaymentMethodOption
            label="Pay from your bank"
            sublabel="Lower fees, settles in 1-3 days"
            icon={<BankIcon />}
            fee="$1.00"
            note="SAVE $2.20"
            highlight
          />

          <button style={ctaButton} disabled>
            Continue with bank transfer →
          </button>
        </div>
      )}

      {stage === 1 && (
        <div style={mockBookingPanel}>
          <div style={{
            background: "#fff",
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            padding: 18,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 12 }}>
              Plaid Link
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
            }}>
              {["Chase", "BofA", "Wells", "Citi", "USAA", "Capital One"].map((b) => (
                <button key={b} disabled style={{
                  background: "#fff",
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "10px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.ink,
                  cursor: "default",
                }}>
                  {b}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5 }}>
              Your client picks their bank, signs in to their bank's site (we never see passwords), and authorizes the payment.
            </div>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div style={mockBookingPanel}>
          <div style={{
            background: "#fff",
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
              Confirm payment
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.ink, marginBottom: 4 }}>
              <span>From</span>
              <span style={{ fontWeight: 600 }}>Chase ••3421</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.ink, marginBottom: 4 }}>
              <span>To</span>
              <span style={{ fontWeight: 600 }}>Healing Hands LMT</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.ink, marginBottom: 4 }}>
              <span>Amount</span>
              <span style={{ fontWeight: 700 }}>$100.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.gray, marginBottom: 10 }}>
              <span>Fee</span>
              <span>$1.00</span>
            </div>
            <div style={{
              background: C.amberBg,
              border: `1px solid #FCD34D`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 10,
              color: C.amberFg,
              lineHeight: 1.4,
              marginBottom: 12,
            }}>
              Settles in 1-3 business days. Refunds work but cannot reverse the original transfer; we send a separate ACH back.
            </div>
            <button disabled style={ctaButton}>
              Authorize $100 transfer
            </button>
          </div>
        </div>
      )}

      {stage === 3 && (
        <div style={mockBookingPanel}>
          <SuccessConfirmation
            title="Payment authorized"
            sublabel="Bank transfer · settles by Friday"
            note="You'll see the deposit in your bank account in 1-3 business days. Healing Hands sees a 'paid' status now."
          />
        </div>
      )}
    </MockupShell>
  );
}

// ───────────────────────────────────────────────────────────────────
// Option 2: Real-time push payment (Zelle / FedNow)
// ───────────────────────────────────────────────────────────────────
function RealtimePushMockup() {
  const [stage, setStage] = useState(0);
  return (
    <MockupShell
      title="Option 2: Pay from your bank app"
      subtitle="Real-time. Almost no fees. But customer has to send."
      eyebrow="ZELLE / FEDNOW"
      eyebrowColor="#7B1FA2"
      stages={["Intro", "Pay-link", "Awaiting", "Done"]}
      currentStage={stage}
      onStage={setStage}
    >
      {stage === 0 && (
        <div style={mockBookingPanel}>
          <div style={panelLabel}>How do you want to pay?</div>

          <PaymentMethodOption
            label="Card"
            sublabel="Visa, Mastercard, Amex"
            icon={<CardIcon />}
            fee="$3.20"
            note="Standard"
          />
          <PaymentMethodOption
            label="Send from your bank app"
            sublabel="Zelle or FedNow · arrives instantly"
            icon={<ZelleIcon />}
            fee="$0.05"
            note="LOWEST FEE"
            highlight
          />

          <button style={ctaButton} disabled>
            Continue with bank app →
          </button>
        </div>
      )}

      {stage === 1 && (
        <div style={mockBookingPanel}>
          <div style={{
            background: "#fff",
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            padding: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
              Open your bank app and send
            </div>
            <div style={{
              background: C.cream,
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
              fontFamily: "monospace",
              fontSize: 13,
              color: C.ink,
            }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: C.gray }}>Send to: </span>
                healinghands@example.com
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: C.gray }}>Amount: </span>
                <strong>$100.00</strong>
              </div>
              <div>
                <span style={{ color: C.gray }}>Memo: </span>
                Booking #BMP-1247
              </div>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}>
              <button disabled style={mockSecondaryButton}>📋 Copy email</button>
              <button disabled style={mockSecondaryButton}>📋 Copy amount</button>
            </div>
            <div style={{
              fontSize: 10,
              color: C.gray,
              lineHeight: 1.4,
              fontStyle: "italic",
              textAlign: "center",
            }}>
              Make sure the memo includes the booking number so we can match it.
            </div>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div style={mockBookingPanel}>
          <div style={{
            background: "#fff",
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            padding: 18,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>⏳</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: C.forest, marginBottom: 6 }}>
              Awaiting your payment
            </div>
            <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.5, marginBottom: 12 }}>
              We are watching for the transfer to arrive. Most payments land within a minute.
            </div>
            <div style={{
              background: C.amberBg,
              border: `1px solid #FCD34D`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 10,
              color: C.amberFg,
              lineHeight: 1.4,
            }}>
              If you closed your bank app before sending, tap the back button to see the payment instructions again.
            </div>
          </div>
        </div>
      )}

      {stage === 3 && (
        <div style={mockBookingPanel}>
          <SuccessConfirmation
            title="Payment received"
            sublabel="Arrived via Zelle · instant"
            note="Money is already in Healing Hands' bank account. No fees taken from the platform."
          />
        </div>
      )}
    </MockupShell>
  );
}

// ───────────────────────────────────────────────────────────────────
// Option 3: Apple Pay / Google Pay (cards underneath)
// ───────────────────────────────────────────────────────────────────
function ApplePayGooglePayMockup() {
  const [stage, setStage] = useState(0);
  return (
    <MockupShell
      title="Option 3: Apple Pay / Google Pay"
      subtitle="Faster checkout. Same fees as cards."
      eyebrow="DEVICE WALLETS"
      eyebrowColor={C.ink}
      stages={["Intro", "Tap to pay", "Done"]}
      currentStage={stage}
      onStage={setStage}
    >
      {stage === 0 && (
        <div style={mockBookingPanel}>
          <div style={panelLabel}>How do you want to pay?</div>

          <button disabled style={{
            ...applePayButton,
            background: "#000",
          }}>
            <ApplePayLogo /> &nbsp;Pay
          </button>

          <button disabled style={{
            ...applePayButton,
            background: "#fff",
            color: "#202124",
            border: `1.5px solid ${C.border}`,
          }}>
            <GPayLogo /> &nbsp;Pay
          </button>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "12px 0",
            fontSize: 10,
            color: C.gray,
            letterSpacing: 1,
          }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span>OR</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          <PaymentMethodOption
            label="Card"
            sublabel="Visa, Mastercard, Amex"
            icon={<CardIcon />}
            fee="$3.20"
            note="Same fees as Apple Pay"
          />
        </div>
      )}

      {stage === 1 && (
        <div style={mockBookingPanel}>
          <div style={{
            background: "#fff",
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            padding: 18,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👆</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 14, color: C.ink, marginBottom: 14 }}>
              Confirm with Face ID
            </div>
            <div style={{
              background: C.cream,
              borderRadius: 8,
              padding: 10,
              fontSize: 11,
              color: C.gray,
              lineHeight: 1.5,
            }}>
              Apple Pay sends an encrypted token to Stripe. Stripe charges your card on file. Same Visa/Mastercard fees as if you typed the card number.
            </div>
          </div>
        </div>
      )}

      {stage === 2 && (
        <div style={mockBookingPanel}>
          <SuccessConfirmation
            title="Paid via Apple Pay"
            sublabel="Visa ••4242 · settled instantly"
            note="Faster than typing 16 digits. Same processor (Stripe), same fees, same Healing Hands experience."
          />
        </div>
      )}
    </MockupShell>
  );
}

// ───────────────────────────────────────────────────────────────────
// Shared sub-components
// ───────────────────────────────────────────────────────────────────

const mockBookingPanel = {
  background: C.cream,
  borderRadius: 14,
  padding: 14,
  minHeight: 280,
};

const panelLabel = {
  fontSize: 12,
  fontWeight: 700,
  color: C.gray,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  marginBottom: 10,
};

const ctaButton = {
  width: "100%",
  background: C.forest,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "default",
  marginTop: 8,
};

const mockSecondaryButton = {
  background: "#fff",
  border: `1.5px solid ${C.border}`,
  color: C.ink,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "default",
};

const applePayButton = {
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
};

function PaymentMethodOption({ label, sublabel, icon, fee, note, highlight }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "11px 12px",
      background: "#fff",
      border: `1.5px solid ${highlight ? C.green : C.border}`,
      borderRadius: 10,
      marginBottom: 6,
      boxShadow: highlight ? `0 4px 14px ${C.green}25` : "none",
    }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{label}</div>
        <div style={{ fontSize: 11, color: C.gray }}>{sublabel}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{fee}</div>
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          color: highlight ? C.green : C.gray,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}>{note}</div>
      </div>
    </div>
  );
}

function SuccessConfirmation({ title, sublabel, note }) {
  return (
    <div style={{
      background: "#fff",
      border: `1.5px solid ${C.green}`,
      borderRadius: 12,
      padding: 18,
      textAlign: "center",
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: C.greenBg,
        color: C.green,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 12px",
        fontSize: 24,
        fontWeight: 800,
      }}>
        ✓
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: C.forest, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>
        {sublabel}
      </div>
      <div style={{
        background: C.cream,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 10,
        color: C.gray,
        lineHeight: 1.5,
      }}>
        {note}
      </div>
    </div>
  );
}

function MockupShell({ title, subtitle, eyebrow, eyebrowColor, stages, currentStage, onStage, children }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 18,
      padding: 18,
      boxShadow: "0 8px 32px rgba(42, 87, 65, 0.10)",
      border: `1.5px solid ${C.border}`,
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        display: "inline-block",
        background: `${eyebrowColor}18`,
        color: eyebrowColor,
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 1.4,
        padding: "3px 8px",
        borderRadius: 99,
        marginBottom: 6,
        alignSelf: "flex-start",
      }}>
        {eyebrow}
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: C.forest, marginBottom: 2 }}>
        {title}
      </div>
      <div style={{ fontSize: 11, color: C.gray, marginBottom: 12, lineHeight: 1.5 }}>
        {subtitle}
      </div>

      {/* Stage tabs */}
      <div style={{
        display: "flex",
        gap: 4,
        marginBottom: 10,
        flexWrap: "wrap",
      }}>
        {stages.map((s, i) => (
          <button
            key={i}
            onClick={() => onStage(i)}
            style={{
              background: i === currentStage ? C.forest : "transparent",
              color: i === currentStage ? "#fff" : C.gray,
              border: i === currentStage ? "none" : `1px solid ${C.border}`,
              borderRadius: 99,
              padding: "3px 9px",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

// Tiny inline SVG icons
function CardIcon() {
  return (
    <svg viewBox="0 0 28 20" width="28" height="20">
      <rect x="0" y="0" width="28" height="20" rx="3" fill="#F3F4F6" stroke={C.border} strokeWidth="1" />
      <rect x="3" y="4" width="6" height="4" rx="0.5" fill="#C9A84C" />
      <rect x="3" y="13" width="22" height="2" fill="#A0A0A0" />
    </svg>
  );
}
function BankIcon() {
  return (
    <svg viewBox="0 0 28 20" width="28" height="20">
      <polygon points="14,2 26,8 2,8" fill={C.forest} />
      <rect x="4" y="9" width="2" height="8" fill={C.forest} />
      <rect x="9" y="9" width="2" height="8" fill={C.forest} />
      <rect x="17" y="9" width="2" height="8" fill={C.forest} />
      <rect x="22" y="9" width="2" height="8" fill={C.forest} />
      <rect x="2" y="17" width="24" height="2" fill={C.forest} />
    </svg>
  );
}
function ZelleIcon() {
  return (
    <svg viewBox="0 0 28 20" width="28" height="20">
      <rect x="0" y="0" width="28" height="20" rx="4" fill="#7B1FA2" />
      <text x="14" y="14" fontSize="10" fontWeight="800" fill="#fff" textAnchor="middle">Z</text>
    </svg>
  );
}
function ApplePayLogo() {
  return (
    <svg viewBox="0 0 30 14" width="30" height="14">
      <text x="0" y="11" fontSize="11" fontWeight="700" fill="#fff" fontFamily="-apple-system, sans-serif"></text>
    </svg>
  );
}
function GPayLogo() {
  return (
    <svg viewBox="0 0 30 14" width="30" height="14">
      <text x="0" y="11" fontSize="11" fontWeight="700" fill="#202124">G</text>
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────
// Main mockup component — three options side by side
// ───────────────────────────────────────────────────────────────────
export default function PaymentMethodComparisonMockup() {
  return (
    <div style={{
      maxWidth: 1240,
      margin: "0 auto",
      padding: "40px 20px",
    }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.sage,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginBottom: 8,
        }}>
          Design mockup · not yet built
        </div>
        <h2 style={{
          fontFamily: "Georgia, serif",
          fontSize: 28,
          fontWeight: 700,
          color: C.forest,
          margin: 0,
          marginBottom: 8,
        }}>
          Three alternative payment methods
        </h2>
        <p style={{
          fontSize: 14,
          color: C.gray,
          margin: "0 auto",
          maxWidth: 600,
          lineHeight: 1.6,
        }}>
          Beyond the standard card-on-file path that ships today. Each option below shows what the
          client booking flow could look like if we built it. Tap the stage tabs to walk through.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: 20,
        alignItems: "stretch",
      }}>
        <ACHBankTransferMockup />
        <RealtimePushMockup />
        <ApplePayGooglePayMockup />
      </div>

      <div style={{
        marginTop: 40,
        background: C.cream,
        border: `1px solid ${C.border}`,
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
          marginBottom: 10,
        }}>
          Honest tradeoffs
        </div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><strong>Option 1 (ACH):</strong> ~$2 saved per session in fees. 1-3 day settlement. Cannot auto-charge for no-shows. Plaid Link is widely trusted but adds a third party. Build cost: 3-5 days.</li>
          <li><strong>Option 2 (Zelle/FedNow):</strong> Lowest fees. Real-time. But customer has to actively send from their bank app, which is friction we cannot eliminate. Zelle for business is restricted; FedNow merchant adoption is still early. Build cost: 2-3 days for FedNow, Zelle business is gated.</li>
          <li><strong>Option 3 (Apple Pay / Google Pay):</strong> Faster checkout but identical fees. Stripe handles this almost for free if we enable it on existing Payment Element. Build cost: 1 day.</li>
        </ul>
      </div>
    </div>
  );
}
