// src/components/PaymentParityCard.jsx
//
// Side-by-side processor parity card. Shows what each processor does
// and what is honest to know about gaps. Used in two places:
//   - Home: animated=true, subtle pulse on checkmarks
//   - Features: animated=false, identical layout, no motion
//
// Design intent: honest, factual, not a sales pitch. We explicitly
// do NOT put this on a banner or marketing hero. It exists so that
// when a curious therapist asks "wait, can I use Square?" HK can
// point them here and the question is answered without a back-and-
// forth. Once everything is triple-checked over the next week, the
// content can be promoted into the marketing surface.
//
// Reads at-a-glance:
//   - Both columns equally weighted (Stripe and Square get equal real
//     estate; we are not recommending one over the other)
//   - Greens stand out, ambers are visible but soft, no reds (we do
//     not have a 'broken' state to communicate)
//   - The activation note for Square is present but small, framed as
//     'one thing to know' not 'warning'

import React from 'react';

const FOREST = '#2A5741';
const SAGE = '#6B9E80';
const CREAM = '#FAF5EE';
const TEXT = '#1F3A2C';
const MUTED = '#6B7280';
const BORDER = '#E5E5E5';
const GREEN = '#16A34A';
const AMBER_BG = '#FEF3C7';
const AMBER_FG = '#78350F';
const AMBER_LINE = '#D97706';
const STRIPE_PURPLE = '#635BFF';
const SQUARE_BLACK = '#1F1F1F';

// One row in either column. Status drives icon + tone.
//   'ok'      green check, normal weight
//   'note'    amber dot, slightly smaller text
//   'gap'     amber x, slightly smaller text (still informative, not alarming)
function Item({ status, label, animated }) {
  const isOk = status === 'ok';
  const isNote = status === 'note';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '8px 0',
      fontSize: 14,
      color: isOk ? TEXT : AMBER_FG,
      lineHeight: 1.5,
    }}>
      <span style={{
        flexShrink: 0,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: isOk ? '#DCFCE7' : AMBER_BG,
        color: isOk ? GREEN : AMBER_LINE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 800,
        marginTop: 1,
        animation: animated && isOk ? 'parityPulse 2.4s ease-in-out infinite' : 'none',
      }}>
        {isOk ? '✓' : (isNote ? '!' : '×')}
      </span>
      <span style={{ fontWeight: isOk ? 500 : 600 }}>{label}</span>
    </div>
  );
}

function ProcessorColumn({ name, brandColor, items, footnote, animated }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: brandColor,
        }} />
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: TEXT }}>
          {name}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {items.map((it, i) => (
          <Item key={i} status={it.status} label={it.label} animated={animated} />
        ))}
      </div>
      {footnote && (
        <div style={{
          fontSize: 12,
          color: MUTED,
          marginTop: 14,
          paddingTop: 14,
          borderTop: `1px dashed ${BORDER}`,
          lineHeight: 1.5,
        }}>
          {footnote}
        </div>
      )}
    </div>
  );
}

export default function PaymentParityCard({ animated = false }) {
  return (
    <div style={{
      maxWidth: 1080,
      margin: '0 auto',
      padding: '0 20px',
    }}>
      {animated && (
        <style>{`
          @keyframes parityPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
            50% { transform: scale(1.08); box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.15); }
          }
        `}</style>
      )}

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: SAGE,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          Bring your own payments
        </div>
        <h2 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 28,
          fontWeight: 700,
          color: FOREST,
          margin: 0,
          lineHeight: 1.25,
        }}>
          Stripe or Square. Both, fully.
        </h2>
        <p style={{
          fontSize: 15,
          color: MUTED,
          marginTop: 10,
          lineHeight: 1.6,
          maxWidth: 620,
          margin: '10px auto 0',
        }}>
          Use whichever processor you already use for your practice. Connect both if you want to mix
          and match. Same features, same flow, same client experience either way.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 18,
        alignItems: 'stretch',
      }}>
        <ProcessorColumn
          name="Stripe"
          brandColor={STRIPE_PURPLE}
          animated={animated}
          items={[
            { status: 'ok', label: 'Online deposits at booking' },
            { status: 'ok', label: 'Package and gift certificate purchases' },
            { status: 'ok', label: 'Recurring monthly memberships, auto-renewing' },
            { status: 'ok', label: 'Card on file for cancellation policy' },
            { status: 'ok', label: 'Automatic charge on late cancel or no-show' },
            { status: 'ok', label: 'One-tap refunds from your dashboard' },
            { status: 'ok', label: 'Customer self-serve portal for memberships' },
          ]}
          footnote="Ready immediately when you connect."
        />

        <ProcessorColumn
          name="Square"
          brandColor={SQUARE_BLACK}
          animated={animated}
          items={[
            { status: 'ok', label: 'Online deposits at booking' },
            { status: 'ok', label: 'Package and gift certificate purchases' },
            { status: 'ok', label: 'Membership first month, plus credits' },
            { status: 'ok', label: 'Card on file for cancellation policy' },
            { status: 'ok', label: 'Automatic charge on late cancel or no-show' },
            { status: 'ok', label: 'One-tap refunds from your dashboard' },
            { status: 'note', label: 'Recurring renewals need a manual nudge' },
          ]}
          footnote={
            <span>
              One thing to know. Square asks every merchant to complete{' '}
              <a
                href="https://squareup.com/activate"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: FOREST, fontWeight: 600, textDecoration: 'underline' }}
              >
                squareup.com/activate
              </a>
              {' '}before they will process real card payments. Most therapists already did this when
              they first set up Square. If you have not, it takes about ten minutes.
            </span>
          }
        />
      </div>

      <div style={{
        textAlign: 'center',
        fontSize: 13,
        color: MUTED,
        marginTop: 24,
        fontStyle: 'italic',
      }}>
        Already on something else? We are not adding more processors right now, but the architecture
        is built to add a third whenever it makes sense.
      </div>
    </div>
  );
}
