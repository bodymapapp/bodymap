// src/components/NotificationsJourney.jsx
//
// HK May 18 2026: trust visual for Features 5.1 (Automated reminders).
// Customer ask Maddy: 'We lost a lot of revenue last month when
// reminders were not going out... massagebook said the client should
// be responsible for writing their appts in their own calendars,
// the reminders are done by a third party and they are not responsible
// for what the third party does.'
//
// This component is the answer to that. It shows:
//   1. 30 automated touchpoints (the count is the proof of investment)
//   2. Mapped across the 6-stage client lifetime journey
//   3. Each touchpoint shows audience (client vs therapist) + channels
//   4. A trust line at the end: 'if a reminder doesn't go out, that's
//      on us. Not on a third party.'
//
// Reuses the 6-stage spine from /docs/CLIENT_LIFETIME_JOURNEY.html and
// the touchpoint spec from src/lib/notificationSpec.js so the count
// and details stay in sync with the dashboard.
//
// One-shot scroll-in animation (no loops, no marketing-theater).

import React, { useEffect, useRef, useState } from 'react';
import { NOTIFICATION_SPEC } from '../lib/notificationSpec';

// Map each touchpoint id to a stage. Hand-curated rather than auto-derived
// because the spec has audience + when but no stage tag. Stages mirror the
// CLIENT_LIFETIME_JOURNEY.html spine.
const STAGE_MAP = {
  // Stage 1 First contact: discover, book, prep
  C1: 1, C2: 1, C3: 1, T1: 1, T2: 1, T3: 1, T8: 1,
  // Stage 2 First session: remind, attend, pay
  C4: 2, C5: 2, T4: 2,
  // Stage 3 Becoming a regular: post-session warmth, returning bookings
  C6: 3, T6: 3,
  // Stage 4 Lifetime client: gifts, occasions
  T9: 4,
  // Stage 5 Lapse signal: digest, going-quiet alerts, gentle nudges
  C14: 5, T10: 5, T11: 5,
  // Stage 6 Return or goodbye: last-touch outreach
  C15: 6,
  // Off-ramps anytime in the journey: cancellations, no-shows, refunds
  C7: 'off', C8: 'off', C9: 'off', C10: 'off', C11: 'off', C12: 'off', C13: 'off', C16: 'off',
  T5: 'off', T7: 'off', T12: 'off', T13: 'off', T14: 'off',
};

const STAGES = [
  { num: 1, name: 'First contact',       blurb: 'Discover, book, prep' },
  { num: 2, name: 'First session',       blurb: 'Remind, attend, pay' },
  { num: 3, name: 'Becoming a regular',  blurb: 'Warmth, rebook' },
  { num: 4, name: 'Lifetime client',     blurb: 'Anniversaries, gifts' },
  { num: 5, name: 'Lapse signal',        blurb: 'Going quiet' },
  { num: 6, name: 'Return or goodbye',   blurb: 'Last touch' },
];

const CHANNEL_ICON = {
  app_alert: { label: 'BELL',  bg: '#FCF4DD', fg: '#92400E' },
  email:     { label: 'EMAIL', bg: '#E0E7FF', fg: '#3730A3' },
  sms:       { label: 'SMS',   bg: '#DCFCE7', fg: '#166534' },
  push:      { label: 'PUSH',  bg: '#FAE8EC', fg: '#9F1239' },
};

function ChannelChip({ ch }) {
  const c = CHANNEL_ICON[ch];
  if (!c) return null;
  return (
    <span style={{
      display: 'inline-block',
      background: c.bg,
      color: c.fg,
      fontSize: 8.5,
      fontWeight: 700,
      letterSpacing: '0.04em',
      padding: '1.5px 5px',
      borderRadius: 3,
      marginRight: 3,
      verticalAlign: 'middle',
    }}>
      {c.label}
    </span>
  );
}

function TouchpointChip({ spec, delay }) {
  const audienceColor = spec.audience === 'client' ? '#C9A84C' : '#6B9E80';
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${audienceColor}`,
        borderLeft: `3px solid ${audienceColor}`,
        borderRadius: 7,
        padding: '7px 9px',
        fontSize: 11,
        lineHeight: 1.35,
        color: '#2A2620',
        opacity: 0,
        transform: 'translateY(6px)',
        animation: `nj-chip-in 0.45s ease-out ${delay}ms forwards`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 10.5, marginBottom: 2, color: '#1F2937' }}>
        {spec.title}
      </div>
      <div style={{ marginTop: 3 }}>
        {spec.channels.map(ch => <ChannelChip key={ch} ch={ch} />)}
      </div>
    </div>
  );
}

function StageColumn({ stage, touchpoints, baseDelay }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#6B9E80',
        marginBottom: 2,
      }}>
        Stage {stage.num}
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 700,
        fontFamily: 'Georgia, serif',
        color: '#1F4030',
        marginBottom: 2,
      }}>
        {stage.name}
      </div>
      <div style={{
        fontSize: 11,
        color: '#6B7280',
        marginBottom: 8,
        fontStyle: 'italic',
      }}>
        {stage.blurb}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {touchpoints.map((tp, i) => (
          <TouchpointChip key={tp.id} spec={tp} delay={baseDelay + i * 80} />
        ))}
      </div>
    </div>
  );
}

export default function NotificationsJourney() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      });
    }, { threshold: 0.15 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  // Group touchpoints by stage
  const byStage = {};
  STAGES.forEach(s => { byStage[s.num] = []; });
  const offRamps = [];
  NOTIFICATION_SPEC.forEach(tp => {
    const stage = STAGE_MAP[tp.id];
    if (stage === 'off') offRamps.push(tp);
    else if (stage) byStage[stage].push(tp);
  });

  const total = NOTIFICATION_SPEC.length;

  return (
    <div ref={ref} style={{
      background: 'linear-gradient(180deg, #FBFAF4 0%, #F2EFE4 100%)',
      borderRadius: 14,
      padding: '28px 22px',
      marginTop: 22,
      border: '1px solid #EDE6D6',
    }}>
      <style>{`
        @keyframes nj-chip-in {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes nj-num-in {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes nj-bar-grow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>

      {/* Big number header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        marginBottom: 6,
        flexWrap: 'wrap',
        opacity: visible ? 1 : 0,
        animation: visible ? 'nj-num-in 0.6s ease-out forwards' : 'none',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 72,
          fontWeight: 400,
          lineHeight: 1,
          color: '#1F4030',
          letterSpacing: '-0.02em',
        }}>
          {total}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1F4030', marginBottom: 2 }}>
            automated touchpoints across the client's journey
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.45 }}>
            From the first booking to the last goodbye. Not one of them outsourced to a third party we can blame.
          </div>
        </div>
      </div>

      {/* Stage spine */}
      <div style={{ position: 'relative', height: 2, background: '#E5E0CE', margin: '24px 0 14px', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #6B9E80 0%, #1F4030 100%)',
          transformOrigin: 'left',
          transform: visible ? 'scaleX(1)' : 'scaleX(0)',
          animation: visible ? 'nj-bar-grow 1.2s ease-out 0.2s both' : 'none',
        }} />
      </div>

      {/* 6 stage columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 14,
        alignItems: 'start',
      }}>
        {STAGES.map((stage, i) => (
          <StageColumn
            key={stage.num}
            stage={stage}
            touchpoints={byStage[stage.num] || []}
            baseDelay={visible ? 400 + i * 120 : 999999}
          />
        ))}
      </div>

      {/* Off-ramps band (renders below the spine, full width) */}
      {offRamps.length > 0 && (
        <div style={{
          marginTop: 22,
          padding: '14px 14px',
          background: 'rgba(199, 123, 138, 0.07)',
          borderLeft: '3px solid #C77B8A',
          borderRadius: 8,
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#C77B8A',
            marginBottom: 4,
          }}>
            Off-ramps (any stage)
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, fontStyle: 'italic' }}>
            Cancellations, no-shows, refunds, reschedules, system failures. The moments most platforms forget.
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 6,
          }}>
            {offRamps.map((tp, i) => (
              <TouchpointChip
                key={tp.id}
                spec={tp}
                delay={visible ? 1200 + i * 50 : 999999}
              />
            ))}
          </div>
        </div>
      )}

      {/* Failure-notification mockup card */}
      <div style={{
        marginTop: 22,
        background: '#fff',
        border: '1.5px solid #F0D89C',
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease 1.4s',
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#FEF3C7',
          color: '#92400E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}>
          ⚠
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', marginBottom: 3 }}>
            Sarah's 24-hour reminder didn't deliver
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, lineHeight: 1.5 }}>
            SMS failed. Email succeeded at 2:32 PM. Want to call her or send a manual text?
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{
              background: '#1F4030',
              color: '#fff',
              border: 'none',
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}>
              Call Sarah
            </button>
            <button style={{
              background: '#fff',
              color: '#1F4030',
              border: '1px solid #E8E4DC',
              padding: '5px 11px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              Send text
            </button>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 14,
        fontSize: 11,
        color: '#6B7280',
        lineHeight: 1.55,
        fontStyle: 'italic',
      }}>
        When something fails to deliver, you find out. Not your client. Not three weeks later when they no-show.
      </div>

      {/* Trust line */}
      <div style={{
        marginTop: 24,
        paddingTop: 18,
        borderTop: '1px solid #EDE6D6',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 17,
          fontWeight: 400,
          color: '#1F4030',
          lineHeight: 1.45,
          letterSpacing: '-0.005em',
        }}>
          If a reminder doesn't go out,<br/>that's on us. Not on a third party. Not on your client.
        </div>
      </div>
    </div>
  );
}
