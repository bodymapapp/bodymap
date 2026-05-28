// src/components/PublicCheckout.jsx
//
// HK May 27 2026 Ship 2: unified public-facing checkout shell.
// Used by the public booking page for THREE purchase contexts:
//   1. Service booking (image 3 of HK's screenshots)
//   2. Package purchase (was a tiny "Pay $1" modal)
//   3. Membership purchase (was a separate "Continue to payment" modal)
//
// One shell, one layout, one experience. The only differences are
// which payment modes are offered (deposit doesn't make sense for
// packages or memberships, which are always full pay) and which
// banners show (approval banner only for service bookings).
//
// Heavy lifting (state mutations, edge-function calls, Stripe
// element rendering) stays in the parent. This component renders
// the LAYOUT and emits events. The parent owns the truth.
//
// Built per Design Principle 29 (top-anchored, dvh-safe). When used
// inside a modal wrapper, the modal needs to provide its own
// sticky-footer container; this component flows naturally inside.

import React from 'react';

// Inline color tokens to avoid coupling to BookingPage's C.
// These match the public-facing palette used throughout the site.
const C = {
  forest: '#2A5741',
  forestDeep: '#1F4030',
  sage: '#6B9E80',
  cream: '#FAF6E9',
  paper: '#FFFFFF',
  dark: '#1A2E22',
  gray: '#6B7280',
  ink: '#374151',
  light: '#E8E4DC',
  white: '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────────
// Summary table. The top section of image 3 with the rows of
// Service / Duration / Date / Time / Therapist / Price / Name / Email.
// For packages: Package name / Sessions / Price / Name / Email.
// For memberships: Plan / Sessions per month / Price / Name / Email.
// Caller passes a `rows` array of [label, value] tuples.
// ─────────────────────────────────────────────────────────────────
function SummaryTable({ rows }) {
  return (
    <div style={{ background: C.white, borderRadius: 16, padding: 22, marginBottom: 14 }}>
      {rows.map(([label, value], i) => (
        <div key={label} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          padding: '10px 0',
          borderBottom: i < rows.length - 1 ? `1px solid ${C.light}` : 'none',
        }}>
          <span style={{ fontSize: 13, color: C.gray, flexShrink: 0, minWidth: 70 }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.dark, textAlign: 'right' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Approval banner. Only shown for service bookings when therapist
// has require_approval on and this is a new client.
// ─────────────────────────────────────────────────────────────────
function ApprovalBanner({ therapistFirstName }) {
  return (
    <div style={{
      marginBottom: 14,
      background: '#FFFBEB',
      border: '1.5px solid #FDE68A',
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🌿</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 3 }}>This is a request, not a confirmed booking</div>
        <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>
          {therapistFirstName || 'Your therapist'} reviews each new client. You will get an email when your request is approved or declined. No payment is taken right now.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Deposit banner. Service-booking-only. Tells the new client what
// percentage is due now and what's paid at the session.
// ─────────────────────────────────────────────────────────────────
function DepositBanner({ depositAmount, depositPercent, fullPriceUSD }) {
  const remainder = fullPriceUSD - Math.round(fullPriceUSD * depositPercent / 100);
  return (
    <div style={{
      marginBottom: 14,
      background: '#FEF3C7',
      border: '1.5px solid #FCD34D',
      borderRadius: 12,
      padding: '16px',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>💳</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
          A deposit of ${(depositAmount / 100).toFixed(0)} is required to confirm your spot
        </div>
        <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
          As a new client, {depositPercent}% of the ${fullPriceUSD} session fee is collected now to reserve your appointment. The remaining ${remainder} is paid directly to your therapist at the session.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Payment mode picker. Two radio rows: Pay deposit / Pay in full.
// Tip selector reveals when 'full' is selected (if therapist accepts
// tips). For packages and memberships, this card is hidden entirely
// because there's only one mode.
// ─────────────────────────────────────────────────────────────────
function PaymentModeCard({
  fullPriceUSD,
  depositRequired,
  depositPercent,
  paymentMode,
  onPaymentModeChange,
  acceptTips,
  tipCents,
  onTipChange,
  tipPresets,
  date,
}) {
  const depositAmountUSD = Math.round(fullPriceUSD * (depositPercent || 20) / 100);
  return (
    <div style={{
      marginBottom: 14,
      background: '#FFFFFF',
      border: '1.5px solid #DDD4C2',
      borderRadius: 14,
      padding: '16px',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: C.gray,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 10,
      }}>
        Payment
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: paymentMode === 'full' ? 14 : 0 }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          border: `1.5px solid ${paymentMode === 'deposit' ? C.forest : '#E8E4DC'}`,
          background: paymentMode === 'deposit' ? '#F0FDF4' : '#FAFAF6',
          borderRadius: 10,
          cursor: 'pointer',
        }}>
          <input
            type="radio"
            name="paymentMode"
            value="deposit"
            checked={paymentMode === 'deposit'}
            onChange={() => onPaymentModeChange('deposit')}
            style={{ accentColor: C.forest }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>
              {depositRequired ? `Pay deposit ($${depositAmountUSD})` : 'Pay at session'}
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
              {depositRequired ? `Remainder paid in person on ${date || 'the day'}` : `Pay in full at the session`}
            </div>
          </div>
        </label>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          border: `1.5px solid ${paymentMode === 'full' ? C.forest : '#E8E4DC'}`,
          background: paymentMode === 'full' ? '#F0FDF4' : '#FAFAF6',
          borderRadius: 10,
          cursor: 'pointer',
        }}>
          <input
            type="radio"
            name="paymentMode"
            value="full"
            checked={paymentMode === 'full'}
            onChange={() => onPaymentModeChange('full')}
            style={{ accentColor: C.forest }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>
              Pay in full now (${fullPriceUSD})
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
              Skip the at-session payment. {acceptTips ? 'Add a tip if you like.' : ''}
            </div>
          </div>
        </label>
      </div>

      {paymentMode === 'full' && acceptTips && tipPresets && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, marginBottom: 8 }}>
            Add a tip (optional)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[0, ...tipPresets].map(p => {
              const tipUSD = Math.round(fullPriceUSD * p / 100);
              const isSelected = (p === 0 && tipCents === 0) || (tipCents === tipUSD * 100);
              return (
                <button key={p} type="button"
                  onClick={() => onTipChange(tipUSD * 100)}
                  style={{
                    padding: '8px 14px',
                    border: `1.5px solid ${isSelected ? C.forest : '#E8E4DC'}`,
                    background: isSelected ? '#F0FDF4' : '#FAFAF6',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    color: isSelected ? C.forest : C.gray,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  {p === 0 ? 'No tip' : `${p}% ($${tipUSD})`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Single policy disclosure row. Tap to expand and read.
// ─────────────────────────────────────────────────────────────────
function PolicyRow({ icon, label, body, agreed, onAgreeChange, accent = '#92400E' }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!body) return null;
  return (
    <div style={{
      background: '#FEF3C7',
      border: '1.5px solid #FCD34D',
      borderRadius: 12,
      marginBottom: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '12px 14px',
        cursor: 'pointer',
      }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ fontSize: 13, color: accent, lineHeight: 1.4 }}>
          {expanded ? '▼' : '▶'} <strong>{icon} {label}</strong>{' '}
          <span style={{ fontWeight: 500 }}>Tap to read.</span>
        </div>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 700,
          color: accent,
          cursor: 'pointer',
          flexShrink: 0,
        }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgreeChange(e.target.checked)}
            style={{ accentColor: C.forest, width: 16, height: 16 }}
          />
          Agree
        </label>
      </div>
      {expanded && (
        <div style={{
          padding: '0 14px 14px',
          fontSize: 12.5,
          color: '#78350F',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {body}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Card-on-file capture section. When the therapist's cancellation
// policy requires a card on file or when approval+deposit needs one,
// this section renders the save-card form. The parent owns the
// Stripe Elements / Square card form (passed in as a child).
// ─────────────────────────────────────────────────────────────────
function CardOnFileSection({ children, label = 'CARD ON FILE REQUIRED', helpText }) {
  return (
    <div style={{
      marginBottom: 14,
      background: '#FEF3C7',
      border: '1.5px solid #FCD34D',
      borderRadius: 12,
      padding: '16px',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#92400E',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 8,
      }}>
        💳 {label}
      </div>
      {helpText && (
        <div style={{ fontSize: 12.5, color: '#92400E', lineHeight: 1.5, marginBottom: 12 }}>
          {helpText}
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Submit button. The big green CTA at the bottom.
// ─────────────────────────────────────────────────────────────────
function SubmitButton({ label, onClick, disabled, blockedLabel, blocked, submitting }) {
  const isBlocked = disabled || blocked;
  return (
    <button onClick={onClick} disabled={isBlocked}
      style={{
        width: '100%',
        background: isBlocked ? '#9CA3AF' : C.forest,
        color: C.white,
        border: 'none',
        borderRadius: 14,
        padding: '17px',
        fontSize: 16,
        fontWeight: 700,
        cursor: isBlocked ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        boxShadow: `0 4px 20px rgba(42,87,65,${isBlocked ? 0.05 : 0.3})`,
        opacity: blocked ? 0.85 : 1,
        fontFamily: 'inherit',
      }}>
      {blocked ? blockedLabel : (submitting ? 'Working...' : label)}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main shell. Composes all the sub-sections in the right order.
// Caller provides:
//   summaryRows         - [[label, value], ...]
//   approvalContext     - { firstName } or null
//   depositContext      - { depositAmount, depositPercent, fullPriceUSD } or null
//   paymentModeContext  - { fullPriceUSD, depositRequired, depositPercent,
//                           paymentMode, onPaymentModeChange, acceptTips,
//                           tipCents, onTipChange, tipPresets, date } or null
//                         (omit for packages/memberships, which are always full pay)
//   policies            - [{ id, icon, label, body, agreed, onAgreeChange }]
//   cardOnFileSection   - JSX node to render in card section (or null)
//   submit              - { label, onClick, disabled, blocked, blockedLabel, submitting }
//   footerNote          - string to show under submit
//   onBack              - back button callback or null
//   heading             - string
//   subheading          - string
// ─────────────────────────────────────────────────────────────────
export default function PublicCheckout({
  heading,
  subheading,
  onBack,
  summaryRows,
  approvalContext,
  depositContext,
  paymentModeContext,
  policies,
  cardOnFileSection,
  submit,
  footerNote,
  error,
}) {
  return (
    <div>
      {onBack && (
        <button onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: C.gray,
            fontSize: 13,
            cursor: 'pointer',
            padding: '0 0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'inherit',
          }}>
          ‹ Back
        </button>
      )}

      {heading && (
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700, color: C.dark, margin: '0 0 4px' }}>
          {heading}
        </h2>
      )}
      {subheading && (
        <p style={{ fontSize: 13, color: C.gray, margin: '0 0 20px', lineHeight: 1.5 }}>
          {subheading}
        </p>
      )}

      {summaryRows && summaryRows.length > 0 && <SummaryTable rows={summaryRows} />}

      {approvalContext && <ApprovalBanner therapistFirstName={approvalContext.firstName} />}

      {!approvalContext && depositContext && (
        <DepositBanner
          depositAmount={depositContext.depositAmount}
          depositPercent={depositContext.depositPercent}
          fullPriceUSD={depositContext.fullPriceUSD}
        />
      )}

      {paymentModeContext && <PaymentModeCard {...paymentModeContext} />}

      {policies && policies.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {policies.map(p => (
            <PolicyRow
              key={p.id}
              icon={p.icon}
              label={p.label}
              body={p.body}
              agreed={p.agreed}
              onAgreeChange={p.onAgreeChange}
            />
          ))}
        </div>
      )}

      {cardOnFileSection}

      <SubmitButton {...submit} />

      {footerNote && (
        <p style={{
          fontSize: 11,
          color: C.gray,
          textAlign: 'center',
          marginTop: 10,
          lineHeight: 1.5,
        }}>
          {footerNote}
        </p>
      )}

      {error && (
        <div style={{
          marginTop: 12,
          background: '#FEF2F2',
          border: '1.5px solid #FECACA',
          borderRadius: 10,
          padding: '14px',
          fontSize: 13,
          color: '#991B1B',
          lineHeight: 1.5,
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
