// src/components/NotificationsStepper.jsx
//
// HK May 18 2026 v2: 3-card stepper for Home Ribbon 5.
//
// Customer ask Maddy: 'We lost a lot of revenue last month when
// reminders were not going out... MassageBook said clients should
// be responsible for writing the appointment in their own calendars.'
//
// Card 1 of 3: The journey (animated, auto-plays on scroll, ~12s)
//              Empathetic warm draw-in. Shows 6 client lifetime stages
//              with notifications appearing at the right moment.
// Card 2 of 3: What your client gets (compact table, 16 rows)
// Card 3 of 3: What you get (compact table, 14 rows)
//
// Persona accommodations (Maria, 70yo solo LMT):
//   - Manual Previous/Next, no auto-advance between cards
//   - Big tap targets (44px+ buttons)
//   - Fade-only transition (200ms)
//   - 'Card N of 3' indicator always visible
//   - Auto-play on Card 1 once on scroll, replay button after
//
// Data is pulled live from src/lib/notificationSpec.js. No magic strings.

import React, { useEffect, useRef, useState } from 'react';
import { NOTIFICATION_SPEC } from '../lib/notificationSpec';

const CHANNEL_LABELS = {
  app_alert: { label: 'BELL', bg: '#FCF4DD', fg: '#92400E' },
  email:     { label: 'EMAIL', bg: '#E0E7FF', fg: '#3730A3' },
  sms:       { label: 'SMS', bg: '#DCFCE7', fg: '#166534' },
  push:      { label: 'PUSH', bg: '#FAE8EC', fg: '#9F1239' },
};

// Stage map for the animated journey on Card 1. Hand-curated:
// each touchpoint id maps to one of 6 lifetime stages, mirroring
// the spine in /docs/CLIENT_LIFETIME_JOURNEY.html.
const STAGE_MAP = {
  C1: 0, C2: 0, C3: 0, T1: 0, T2: 0, T3: 0, T8: 0,
  C4: 1, C5: 1, T4: 1,
  C6: 2, T6: 2,
  T9: 3,
  C14: 4, T10: 4, T11: 4,
  C15: 5,
  C7: 1, C8: 1, C9: 1, C10: 1, C11: 1, C12: 1, C13: 1, C16: 1,
  T5: 1, T7: 1, T12: 1, T13: 2, T14: 1,
};

const STAGES = [
  { name: 'First contact',       caption: 'She finds you' },
  { name: 'First session',       caption: 'She arrives' },
  { name: 'Becoming a regular',  caption: 'She comes back' },
  { name: 'Lifetime client',     caption: 'She brings friends' },
  { name: 'Lapse signal',        caption: 'Life gets busy' },
  { name: 'Return or goodbye',   caption: 'A graceful close' },
];

// Narrative order for the animation. Walks left-to-right across stages.
const NARRATIVE_ORDER = [
  'C1', 'T2', 'T3', 'C3', 'T8',
  'C4', 'C5', 'T1', 'T4',
  'C6', 'T6',
  'T9',
  'C14', 'T10', 'T11',
  'C15',
];

function ChannelBadge({ ch, dimmed, suffix }) {
  const c = CHANNEL_LABELS[ch];
  if (!c) return null;
  return (
    <span style={{
      display: 'inline-block',
      background: dimmed ? '#F0F0F0' : c.bg,
      color: dimmed ? '#9CA3AF' : c.fg,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      padding: '3px 6px',
      borderRadius: 4,
      marginRight: 3,
      marginBottom: 2,
      verticalAlign: 'middle',
      fontStyle: dimmed ? 'italic' : 'normal',
    }}>
      {c.label}{suffix ? ` ${suffix}` : ''}
    </span>
  );
}

function NotificationRow({ row, index, audienceColor }) {
  const isClient = row.audience === 'client';
  // Show a dimmed 'PUSH soon' badge on client rows to indicate client
  // push will arrive with the client app. Therapist rows have push
  // working today (live on the dashboard PWA).
  const showClientPushTeaser = isClient && !row.channels.includes('push');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto',
        gap: 10,
        padding: '8px 12px',
        background: index % 2 === 0 ? '#FFFFFF' : '#FBFAF4',
        fontSize: 13,
        lineHeight: 1.35,
        color: '#1F2937',
        borderBottom: '1px solid #F0EAD8',
        alignItems: 'center',
      }}
    >
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: audienceColor,
        textAlign: 'center',
      }}>
        {index + 1}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#1F4030', fontSize: 13, marginBottom: 1 }}>
          {row.title}
        </div>
        <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', lineHeight: 1.4 }}>
          {row.when}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {row.channels.map(ch => <ChannelBadge key={ch} ch={ch} />)}
        {showClientPushTeaser && <ChannelBadge ch="push" dimmed suffix="soon" />}
      </div>
    </div>
  );
}

function NotificationTable({ rows, audienceColor }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E0CE',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto',
        gap: 10,
        padding: '8px 12px',
        background: '#F5EFE0',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#4A4035',
        borderBottom: '1px solid #E5E0CE',
      }}>
        <div style={{ textAlign: 'center' }}>#</div>
        <div>When</div>
        <div style={{ textAlign: 'right' }}>Channels</div>
      </div>
      {rows.map((row, i) => (
        <NotificationRow
          key={row.id}
          row={row}
          index={i}
          audienceColor={audienceColor}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Card 1: animated journey
// ────────────────────────────────────────────────────────────────
function JourneyCard({ replayKey }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [visibleStages, setVisibleStages] = useState(0);
  const [activeNotifIndex, setActiveNotifIndex] = useState(-1);
  const [showFinal, setShowFinal] = useState(false);
  const startedRef = useRef(false);

  const narrativeSpecs = NARRATIVE_ORDER
    .map(id => NOTIFICATION_SPEC.find(s => s.id === id))
    .filter(Boolean);

  // Reset and trigger on visibility, or when replayKey changes
  useEffect(() => {
    setPhase('idle');
    setVisibleStages(0);
    setActiveNotifIndex(-1);
    setShowFinal(false);
    startedRef.current = false;

    let timers = [];

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      setPhase('animating');

      STAGES.forEach((_, i) => {
        timers.push(setTimeout(() => setVisibleStages(i + 1), 400 + i * 380));
      });

      const notifStart = 3000;
      const notifSpacing = 550;
      narrativeSpecs.forEach((_, i) => {
        timers.push(setTimeout(() => setActiveNotifIndex(i), notifStart + i * notifSpacing));
      });

      const finalTime = notifStart + narrativeSpecs.length * notifSpacing + 800;
      timers.push(setTimeout(() => {
        setShowFinal(true);
        setPhase('done');
      }, finalTime));
    };

    let io;
    if (replayKey > 0) {
      // Manual replay: start immediately
      setTimeout(start, 100);
    } else if (ref.current) {
      io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            start();
            io && io.disconnect();
          }
        });
      }, { threshold: 0.3 });
      io.observe(ref.current);
    }

    return () => {
      timers.forEach(clearTimeout);
      if (io) io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  function replay() {
    // Bumping a counter prop in parent would be cleaner; this is local
    // because the parent only triggers replay when navigating back to
    // this card. Inline replay just re-runs the effect.
    setPhase('idle');
    setVisibleStages(0);
    setActiveNotifIndex(-1);
    setShowFinal(false);
    startedRef.current = false;
    setTimeout(() => {
      startedRef.current = true;
      setPhase('animating');
      STAGES.forEach((_, i) => {
        setTimeout(() => setVisibleStages(i + 1), 400 + i * 380);
      });
      const notifStart = 3000;
      const notifSpacing = 550;
      narrativeSpecs.forEach((_, i) => {
        setTimeout(() => setActiveNotifIndex(i), notifStart + i * notifSpacing);
      });
      const finalTime = notifStart + narrativeSpecs.length * notifSpacing + 800;
      setTimeout(() => {
        setShowFinal(true);
        setPhase('done');
      }, finalTime);
    }, 100);
  }

  // Compute dot positions: stacked within each stage column
  const notifPositions = narrativeSpecs.map((spec, i) => {
    const stageIdx = STAGE_MAP[spec.id] ?? 1;
    const sameStageBefore = narrativeSpecs
      .slice(0, i)
      .filter(s => (STAGE_MAP[s.id] ?? 1) === stageIdx)
      .length;
    return {
      stageIdx,
      stack: sameStageBefore,
      channels: spec.channels,
      title: spec.title,
    };
  });

  return (
    <div ref={ref}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#6B9E80',
        marginBottom: 8,
      }}>
        A day in the life of your client
      </div>
      <div style={{
        fontFamily: 'Georgia, serif',
        fontSize: 26,
        fontWeight: 600,
        color: '#1F4030',
        marginBottom: 6,
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
      }}>
        From hello to thank you
      </div>
      <div style={{
        fontSize: 14,
        color: '#4A4035',
        marginBottom: 18,
        lineHeight: 1.55,
      }}>
        Watch how every important moment gets a small message. So she always knows what's next. So you never have to remember.
      </div>

      <div style={{
        position: 'relative',
        background: '#FFFFFF',
        border: '1px solid #E5E0CE',
        borderRadius: 10,
        padding: '20px 10px 24px',
        minHeight: 240,
      }}>
        {/* Stage labels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`,
          gap: 4,
          position: 'relative',
        }}>
          {STAGES.map((stage, i) => {
            const isVisible = i < visibleStages;
            return (
              <div
                key={stage.name}
                style={{
                  textAlign: 'center',
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(-6px)',
                  transition: 'opacity 350ms ease, transform 350ms ease',
                }}
              >
                <div style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#1F4030',
                  fontFamily: 'Georgia, serif',
                  lineHeight: 1.25,
                  padding: '0 2px',
                }}>
                  {stage.name}
                </div>
                <div style={{
                  fontSize: 9.5,
                  color: '#6B7280',
                  fontStyle: 'italic',
                  marginTop: 2,
                  lineHeight: 1.3,
                }}>
                  {stage.caption}
                </div>
              </div>
            );
          })}
        </div>

        {/* Horizontal spine */}
        <div style={{
          position: 'relative',
          marginTop: 14,
          marginBottom: 10,
          height: 3,
          background: '#E5E0CE',
          borderRadius: 1.5,
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, #6B9E80 0%, #1F4030 100%)',
            transform: phase === 'idle' ? 'scaleX(0)' : 'scaleX(1)',
            transformOrigin: 'left',
            transition: 'transform 2.8s ease-out',
          }} />
        </div>

        {/* Notification dots */}
        <div style={{
          position: 'relative',
          height: 120,
        }}>
          {notifPositions.map((notif, i) => {
            const isVisible = i <= activeNotifIndex;
            const isActive = i === activeNotifIndex;
            const stageWidth = 100 / STAGES.length;
            const leftPct = (notif.stageIdx + 0.5) * stageWidth;
            const verticalOffset = notif.stack * 18;
            const primaryChannel = notif.channels[0];
            const channelColor = CHANNEL_LABELS[primaryChannel]?.fg || '#6B9E80';
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: verticalOffset,
                  transform: 'translateX(-50%)',
                  opacity: isVisible ? 1 : 0,
                  transition: 'opacity 350ms ease',
                  pointerEvents: 'none',
                  zIndex: isActive ? 2 : 1,
                }}
              >
                <div style={{
                  width: isActive ? 12 : 8,
                  height: isActive ? 12 : 8,
                  borderRadius: '50%',
                  background: channelColor,
                  boxShadow: isActive ? `0 0 0 4px ${channelColor}33` : 'none',
                  transition: 'all 250ms ease',
                  margin: '0 auto',
                }} />
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1F4030',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(31,64,48,0.2)',
                  }}>
                    {notif.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showFinal && (
          <div style={{
            textAlign: 'center',
            marginTop: 8,
            opacity: 1,
            transition: 'opacity 600ms ease',
          }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 17,
              fontWeight: 600,
              color: '#1F4030',
              marginBottom: 4,
            }}>
              30 small moments of care
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
              Every one written by hand. Sent by us. Owned by us.
            </div>
          </div>
        )}
      </div>

      {phase === 'done' && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            type="button"
            onClick={replay}
            style={{
              background: '#FFFFFF',
              color: '#1F4030',
              border: '1.5px solid #1F4030',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ↻ Play again
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main stepper
// ────────────────────────────────────────────────────────────────
export default function NotificationsStepper() {
  const [cardIndex, setCardIndex] = useState(0);
  const [fadeState, setFadeState] = useState('in');
  const [replayKey, setReplayKey] = useState(0);

  const clientRows = NOTIFICATION_SPEC.filter(n => n.audience === 'client');
  const therapistRows = NOTIFICATION_SPEC.filter(n => n.audience === 'therapist');
  const total = NOTIFICATION_SPEC.length;

  const cards = [
    { kind: 'journey' },
    {
      kind: 'table',
      title: 'What your client gets',
      subtitle: `${clientRows.length} notifications that keep her informed, from first booking to a graceful goodbye.`,
      rows: clientRows,
      audienceColor: '#C9A84C',
      footnote: 'Client push notifications launch alongside the client app. Until then, email and SMS carry the load.',
    },
    {
      kind: 'table',
      title: 'What you get',
      subtitle: `${therapistRows.length} notifications that keep you in the loop, including the alerts that fire when something fails to deliver.`,
      rows: therapistRows,
      audienceColor: '#6B9E80',
      footnote: 'Bell and push notifications are live on your dashboard. SMS requires you to connect your Twilio number.',
    },
  ];

  function goTo(newIndex) {
    if (newIndex < 0 || newIndex >= cards.length) return;
    setFadeState('out');
    setTimeout(() => {
      setCardIndex(newIndex);
      setFadeState('in');
      if (cards[newIndex].kind === 'journey') {
        setReplayKey(k => k + 1);
      }
    }, 200);
  }

  const card = cards[cardIndex];

  return (
    <div style={{
      background: 'linear-gradient(180deg, #FBFAF4 0%, #F2EFE4 100%)',
      borderRadius: 18,
      padding: '24px 22px',
      border: '1px solid #EDE6D6',
      maxWidth: 880,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 14,
        marginBottom: 18,
        flexWrap: 'wrap',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 52,
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
            fontSize: 18,
            fontWeight: 600,
            color: '#1F4030',
            marginBottom: 3,
            lineHeight: 1.25,
          }}>
            automated notifications across the client journey
          </div>
          <div style={{
            fontSize: 13,
            color: '#4A4035',
            lineHeight: 1.55,
          }}>
            Built in-house. If a reminder doesn't deliver, you find out. Not your client.
          </div>
        </div>
      </div>

      {/* Card indicator + nav */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#6B7280',
        }}>
          Card {cardIndex + 1} of {cards.length}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => goTo(cardIndex - 1)}
            disabled={cardIndex === 0}
            style={{
              background: cardIndex === 0 ? '#F0EAD8' : '#FFFFFF',
              color: cardIndex === 0 ? '#9CA3AF' : '#1F4030',
              border: cardIndex === 0 ? '1px solid #F0EAD8' : '1.5px solid #1F4030',
              borderRadius: 8,
              padding: '9px 15px',
              fontSize: 13,
              fontWeight: 700,
              cursor: cardIndex === 0 ? 'not-allowed' : 'pointer',
              minHeight: 44,
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
              borderRadius: 8,
              padding: '9px 15px',
              fontSize: 13,
              fontWeight: 700,
              cursor: cardIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
              minHeight: 44,
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
        {card.kind === 'journey' ? (
          <JourneyCard replayKey={replayKey} />
        ) : (
          <>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 20,
              fontWeight: 600,
              color: '#1F4030',
              marginBottom: 4,
              letterSpacing: '-0.005em',
            }}>
              {card.title}
            </div>
            <div style={{
              fontSize: 13,
              color: '#4A4035',
              marginBottom: 12,
              lineHeight: 1.55,
            }}>
              {card.subtitle}
            </div>
            <NotificationTable rows={card.rows} audienceColor={card.audienceColor} />
            {card.footnote && (
              <div style={{
                marginTop: 10,
                fontSize: 12,
                color: '#6B7280',
                fontStyle: 'italic',
                lineHeight: 1.5,
              }}>
                {card.footnote}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dot indicators */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        marginTop: 18,
      }}>
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            style={{
              width: 12,
              height: 12,
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

      {/* Trust line */}
      <div style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid #E5E0CE',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 16,
          fontWeight: 400,
          color: '#1F4030',
          lineHeight: 1.5,
          letterSpacing: '-0.005em',
          maxWidth: 540,
          margin: '0 auto',
        }}>
          If a reminder doesn't go out, that's on us.<br/>
          Not on a third party. Not on your client.
        </div>
      </div>
    </div>
  );
}
