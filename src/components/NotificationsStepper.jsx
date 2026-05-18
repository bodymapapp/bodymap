// src/components/NotificationsStepper.jsx
//
// HK May 18 2026: trust visual for Home page Ribbon 5 (Relationships).
//
// Customer ask Maddy: 'We lost a lot of revenue last month when
// reminders were not going out... MassageBook said the client should
// be responsible for writing their appts in their own calendars.'
//
// This component is the marketing answer. A 2-card stepper a 70-year-old
// can navigate at her own pace:
//   Card 1 of 2: What your client gets (16 client notifications)
//   Card 2 of 2: What you get (14 therapist notifications)
//
// Design choices for the persona:
//   - Manual Previous/Next, no auto-play
//   - Big tap targets (50px+ buttons)
//   - 15pt body, high contrast (no light gray on cream)
//   - Channel badges as words (EMAIL, SMS) not icons
//   - Fade-only transition between cards (300ms)
//   - 'Card 1 of 2' indicator always visible
//
// Data is pulled live from src/lib/notificationSpec.js so the count
// stays in sync with the founder dashboard. No hardcoded list.

import React, { useState } from 'react';
import { NOTIFICATION_SPEC } from '../lib/notificationSpec';

const CHANNEL_LABELS = {
  app_alert: { label: 'BELL', bg: '#FCF4DD', fg: '#92400E' },
  email:     { label: 'EMAIL', bg: '#E0E7FF', fg: '#3730A3' },
  sms:       { label: 'SMS', bg: '#DCFCE7', fg: '#166534' },
  push:      { label: 'PUSH', bg: '#FAE8EC', fg: '#9F1239' },
};

function ChannelBadge({ ch }) {
  const c = CHANNEL_LABELS[ch];
  if (!c) return null;
  return (
    <span style={{
      display: 'inline-block',
      background: c.bg,
      color: c.fg,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      padding: '3px 7px',
      borderRadius: 4,
      marginRight: 4,
      verticalAlign: 'middle',
    }}>
      {c.label}
    </span>
  );
}

function NotificationTable({ rows }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E0CE',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 2.2fr 1fr',
        gap: 12,
        padding: '10px 16px',
        background: '#F5EFE0',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#4A4035',
        borderBottom: '1px solid #E5E0CE',
      }}>
        <div>When</div>
        <div>What we send</div>
        <div>Channels</div>
      </div>
      {/* Body rows */}
      {rows.map((row, i) => (
        <div
          key={row.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 2.2fr 1fr',
            gap: 12,
            padding: '12px 16px',
            background: i % 2 === 0 ? '#FFFFFF' : '#FBFAF4',
            fontSize: 14,
            lineHeight: 1.5,
            color: '#1F2937',
            borderBottom: i === rows.length - 1 ? 'none' : '1px solid #F0EAD8',
          }}
        >
          <div style={{ fontWeight: 600, color: '#1F4030' }}>
            {row.when}
          </div>
          <div>
            {row.title}
          </div>
          <div style={{ alignSelf: 'center' }}>
            {row.channels.map(ch => <ChannelBadge key={ch} ch={ch} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsStepper() {
  const [cardIndex, setCardIndex] = useState(0);
  const [fadeState, setFadeState] = useState('in'); // 'in' or 'out'

  // Partition the spec
  const clientRows = NOTIFICATION_SPEC.filter(n => n.audience === 'client');
  const therapistRows = NOTIFICATION_SPEC.filter(n => n.audience === 'therapist');

  const cards = [
    {
      title: 'What your client gets',
      subtitle: `${clientRows.length} notifications that keep them informed, from the first booking to a graceful goodbye.`,
      rows: clientRows,
    },
    {
      title: 'What you get',
      subtitle: `${therapistRows.length} notifications that keep you in the loop, including the ones that fire when something fails.`,
      rows: therapistRows,
    },
  ];

  const card = cards[cardIndex];
  const total = NOTIFICATION_SPEC.length;

  function goTo(newIndex) {
    if (newIndex < 0 || newIndex >= cards.length) return;
    setFadeState('out');
    setTimeout(() => {
      setCardIndex(newIndex);
      setFadeState('in');
    }, 200);
  }

  return (
    <div style={{
      background: 'linear-gradient(180deg, #FBFAF4 0%, #F2EFE4 100%)',
      borderRadius: 18,
      padding: '32px 28px',
      border: '1px solid #EDE6D6',
      maxWidth: 880,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 64,
          fontWeight: 400,
          lineHeight: 1,
          color: '#1F4030',
          letterSpacing: '-0.02em',
        }}>
          {total}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 20,
            fontWeight: 600,
            color: '#1F4030',
            marginBottom: 4,
            lineHeight: 1.25,
          }}>
            automated notifications across the client journey
          </div>
          <div style={{
            fontSize: 14,
            color: '#4A4035',
            lineHeight: 1.55,
          }}>
            Built in-house, not outsourced to a third party we can blame.
            If a reminder doesn't go out, you find out. Not your client.
          </div>
        </div>
      </div>

      {/* Card indicator + nav */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#6B7280',
        }}>
          Card {cardIndex + 1} of {cards.length}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => goTo(cardIndex - 1)}
            disabled={cardIndex === 0}
            style={{
              background: cardIndex === 0 ? '#F0EAD8' : '#FFFFFF',
              color: cardIndex === 0 ? '#9CA3AF' : '#1F4030',
              border: cardIndex === 0 ? '1px solid #F0EAD8' : '1.5px solid #1F4030',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 700,
              cursor: cardIndex === 0 ? 'not-allowed' : 'pointer',
              minHeight: 48,
              minWidth: 110,
            }}
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => goTo(cardIndex + 1)}
            disabled={cardIndex === cards.length - 1}
            style={{
              background: cardIndex === cards.length - 1 ? '#F0EAD8' : '#1F4030',
              color: cardIndex === cards.length - 1 ? '#9CA3AF' : '#FFFFFF',
              border: cardIndex === cards.length - 1 ? '1px solid #F0EAD8' : '1.5px solid #1F4030',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 700,
              cursor: cardIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
              minHeight: 48,
              minWidth: 110,
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Card content with fade */}
      <div
        style={{
          opacity: fadeState === 'in' ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      >
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 24,
          fontWeight: 600,
          color: '#1F4030',
          marginBottom: 6,
          letterSpacing: '-0.01em',
        }}>
          {card.title}
        </div>
        <div style={{
          fontSize: 14,
          color: '#4A4035',
          marginBottom: 18,
          lineHeight: 1.55,
        }}>
          {card.subtitle}
        </div>

        <NotificationTable rows={card.rows} />
      </div>

      {/* Bottom dot indicators (also tappable) */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 10,
        marginTop: 24,
      }}>
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid #1F4030',
              background: i === cardIndex ? '#1F4030' : 'transparent',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label={`Go to card ${i + 1}`}
          />
        ))}
      </div>

      {/* Trust line below the stepper */}
      <div style={{
        marginTop: 28,
        paddingTop: 22,
        borderTop: '1px solid #E5E0CE',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 18,
          fontWeight: 400,
          color: '#1F4030',
          lineHeight: 1.5,
          letterSpacing: '-0.005em',
          maxWidth: 580,
          margin: '0 auto',
        }}>
          If a reminder doesn't go out, that's on us.<br/>
          Not on a third party. Not on your client.
        </div>
      </div>
    </div>
  );
}
