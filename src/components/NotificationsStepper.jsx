// src/components/NotificationsStepper.jsx
//
// HK May 18 2026 v3: 3-card stepper for Home Ribbon 5.
//
// Customer ask Maddy: 'We lost a lot of revenue last month when
// reminders were not going out... MassageBook said clients should
// be responsible for writing the appointment in their own calendars.'
//
// V3 changes from V2 per HK feedback:
//   - Numbered dots on Card 1, numbers match row #s in Cards 2 + 3
//   - Dot color = audience (gold for client, sage for therapist),
//     not channel. Channel info lives in Cards 2/3.
//   - Footnote on Card 2 (client table) explains why no Bell for
//     clients: by design (no client login, magic links instead).
//   - Full warmth pass: rounder corners, pastel channel pills,
//     serif typography in more places, softer notification-preview
//     tooltips, evocative stage captions, gentler copy throughout.
//
// Card 1 of 3: The journey (animated, ~12s, auto-plays on scroll)
// Card 2 of 3: What your client receives (16 client notifications)
// Card 3 of 3: What you receive (14 therapist notifications)
//
// Data lives in src/lib/notificationSpec.js. No magic strings.

import React, { useEffect, useRef, useState } from 'react';
import { NOTIFICATION_SPEC } from '../lib/notificationSpec';

// Pastel channel palette: softer than v2 but still distinguishable.
const CHANNEL_LABELS = {
  app_alert: { label: 'Bell',  bg: '#FDF4E0', fg: '#7A5A1F', ring: '#E8D4A8' },
  email:     { label: 'Email', bg: '#E8EBFA', fg: '#3F4894', ring: '#C7CFEF' },
  sms:       { label: 'SMS',   bg: '#E6F3E5', fg: '#3F6E3B', ring: '#BFDDBF' },
  push:      { label: 'Push',  bg: '#F6E5EA', fg: '#8B4458', ring: '#E4C2CD' },
};

// Audience colors used for the dot fill on Card 1.
const AUDIENCE_COLORS = {
  client:    { dot: '#C9A84C', soft: '#F3E9C8', label: 'For her' },
  therapist: { dot: '#6B9E80', soft: '#E1ECE2', label: 'For you' },
};

// Hand-curated stage mapping. Each touchpoint id lives in one of 6
// lifetime stages mirroring docs/CLIENT_LIFETIME_JOURNEY.html.
const STAGE_MAP = {
  C1: 0, C2: 0, C3: 0, T1: 0, T2: 0, T3: 0, T8: 0,
  C4: 1, C5: 1, T4: 1,
  C6: 2, T6: 2,
  T9: 3,
  C14: 4, T10: 4, T11: 4,
  C15: 5,
  // Off-ramps fold into the closest stage where they fire
  C7: 1, C8: 1, C9: 1, C10: 1, C11: 1, C12: 1, C13: 1, C16: 1,
  T5: 1, T7: 1, T12: 1, T13: 2, T14: 1,
};

// Warmer stage names. Each pairs a procedural label with an evocative
// caption that frames the same moment in human language.
const STAGES = [
  { name: 'She finds you',       caption: 'First contact' },
  { name: 'She arrives',         caption: 'First session' },
  { name: 'She comes back',      caption: 'Becoming a regular' },
  { name: 'She belongs here',    caption: 'Lifetime client' },
  { name: 'Life gets busy',      caption: 'Lapse signal' },
  { name: 'A graceful close',    caption: 'Return or goodbye' },
];

// Narrative animation walks left-to-right across stages. The order
// here is what the customer watches unfold over ~12 seconds.
const NARRATIVE_ORDER = [
  'C1', 'T2', 'T3', 'C3', 'T8',
  'C4', 'C5', 'T1', 'T4',
  'C6', 'T6',
  'T9',
  'C14', 'T10', 'T11',
  'C15',
];

// Build a stable row-number map: each touchpoint id maps to its
// position (1-based) within its audience's table. The same number
// appears inside the dot on Card 1, and on the corresponding row
// in Card 2 or Card 3.
function buildRowNumbers() {
  const clientRows = NOTIFICATION_SPEC.filter(n => n.audience === 'client');
  const therapistRows = NOTIFICATION_SPEC.filter(n => n.audience === 'therapist');
  const map = {};
  clientRows.forEach((r, i) => { map[r.id] = i + 1; });
  therapistRows.forEach((r, i) => { map[r.id] = i + 1; });
  return map;
}
const ROW_NUMBER = buildRowNumbers();

function ChannelPill({ ch, dimmed, suffix }) {
  const c = CHANNEL_LABELS[ch];
  if (!c) return null;
  return (
    <span style={{
      display: 'inline-block',
      background: dimmed ? '#F4F2EE' : c.bg,
      color: dimmed ? '#A89F92' : c.fg,
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: '0.02em',
      padding: '3.5px 9px',
      borderRadius: 999,
      marginRight: 4,
      marginBottom: 3,
      verticalAlign: 'middle',
      fontStyle: dimmed ? 'italic' : 'normal',
      fontFamily: 'Georgia, serif',
    }}>
      {c.label}{suffix ? ` · ${suffix}` : ''}
    </span>
  );
}

function NotificationRow({ row, rowNumber, audienceColor, audience }) {
  // For client rows we show a dimmed 'Push · soon' pill because
  // client push lands with the future client app. For therapist
  // rows, Push is already live on the dashboard PWA.
  const isClient = audience === 'client';
  const showClientPushTeaser = isClient && !row.channels.includes('push');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr auto',
        gap: 12,
        padding: '11px 14px',
        background: rowNumber % 2 === 1 ? '#FEFCF6' : '#FFFFFF',
        fontSize: 13,
        lineHeight: 1.4,
        color: '#3F4F45',
        borderBottom: '1px solid #F0E9D7',
        alignItems: 'center',
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: audienceColor.soft,
        color: audienceColor.dot,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'Georgia, serif',
      }}>
        {rowNumber}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontWeight: 600,
          color: '#1F4030',
          fontSize: 13.5,
          marginBottom: 2,
          fontFamily: 'Georgia, serif',
        }}>
          {row.title}
        </div>
        <div style={{
          fontSize: 11.5,
          color: '#7A736A',
          fontStyle: 'italic',
          lineHeight: 1.45,
        }}>
          {row.when}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {row.channels.map(ch => <ChannelPill key={ch} ch={ch} />)}
        {showClientPushTeaser && <ChannelPill ch="push" dimmed suffix="soon" />}
      </div>
    </div>
  );
}

function NotificationTable({ rows, audience }) {
  const audienceColor = AUDIENCE_COLORS[audience];
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #EDE2C8',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(31, 64, 48, 0.04)',
    }}>
      {rows.map((row, i) => (
        <NotificationRow
          key={row.id}
          row={row}
          rowNumber={i + 1}
          audienceColor={audienceColor}
          audience={audience}
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
  const replayCountRef = useRef(0);

  const narrativeSpecs = NARRATIVE_ORDER
    .map(id => NOTIFICATION_SPEC.find(s => s.id === id))
    .filter(Boolean);

  function runAnimation() {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase('animating');
    const timers = [];

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

    return () => timers.forEach(clearTimeout);
  }

  // Reset + (re)trigger when replayKey changes
  useEffect(() => {
    setPhase('idle');
    setVisibleStages(0);
    setActiveNotifIndex(-1);
    setShowFinal(false);
    startedRef.current = false;

    let cleanup;
    let io;

    if (replayKey > 0 && replayKey !== replayCountRef.current) {
      replayCountRef.current = replayKey;
      const t = setTimeout(() => { cleanup = runAnimation(); }, 120);
      return () => { clearTimeout(t); cleanup && cleanup(); };
    }

    if (ref.current) {
      io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !startedRef.current) {
            cleanup = runAnimation();
            io.disconnect();
          }
        });
      }, { threshold: 0.3 });
      io.observe(ref.current);
    }

    return () => {
      if (io) io.disconnect();
      if (cleanup) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  function manualReplay() {
    setPhase('idle');
    setVisibleStages(0);
    setActiveNotifIndex(-1);
    setShowFinal(false);
    startedRef.current = false;
    setTimeout(() => runAnimation(), 120);
  }

  // Compute positions: stack within stage, vertically
  const notifPositions = narrativeSpecs.map((spec, i) => {
    const stageIdx = STAGE_MAP[spec.id] ?? 1;
    const stack = narrativeSpecs
      .slice(0, i)
      .filter(s => (STAGE_MAP[s.id] ?? 1) === stageIdx)
      .length;
    return {
      stageIdx,
      stack,
      audience: spec.audience,
      title: spec.title,
      id: spec.id,
      rowNumber: ROW_NUMBER[spec.id],
    };
  });

  return (
    <div ref={ref}>
      {/* Warm eyebrow + serif title */}
      <div style={{
        fontFamily: 'Georgia, serif',
        fontSize: 12,
        fontStyle: 'italic',
        color: '#8B7A4F',
        marginBottom: 10,
        letterSpacing: '0.03em',
      }}>
        A day in the life of your client
      </div>
      <div style={{
        fontFamily: 'Georgia, serif',
        fontSize: 28,
        fontWeight: 500,
        color: '#1F4030',
        marginBottom: 8,
        letterSpacing: '-0.015em',
        lineHeight: 1.15,
      }}>
        From hello to thank you
      </div>
      <div style={{
        fontSize: 14,
        color: '#5A5145',
        marginBottom: 22,
        lineHeight: 1.65,
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        maxWidth: 540,
      }}>
        Watch how every important moment gets a small message. So she always knows what's next. So you never have to remember.
      </div>

      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #FEFCF6 0%, #FAF4E6 100%)',
        border: '1px solid #EDE2C8',
        borderRadius: 18,
        padding: '24px 14px 28px',
        minHeight: 280,
        boxShadow: '0 1px 3px rgba(31, 64, 48, 0.04)',
      }}>
        {/* Stage labels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`,
          gap: 6,
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
                  transform: isVisible ? 'translateY(0)' : 'translateY(-8px)',
                  transition: 'opacity 450ms ease, transform 450ms ease',
                }}
              >
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#1F4030',
                  fontFamily: 'Georgia, serif',
                  lineHeight: 1.3,
                  padding: '0 2px',
                }}>
                  {stage.name}
                </div>
                <div style={{
                  fontSize: 9.5,
                  color: '#8B7A4F',
                  fontStyle: 'italic',
                  marginTop: 3,
                  lineHeight: 1.3,
                  letterSpacing: '0.02em',
                }}>
                  {stage.caption}
                </div>
              </div>
            );
          })}
        </div>

        {/* Soft spine */}
        <div style={{
          position: 'relative',
          marginTop: 18,
          marginBottom: 14,
          height: 2,
          background: '#EDE2C8',
          borderRadius: 1,
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, #C9A84C 0%, #6B9E80 50%, #1F4030 100%)',
            transform: phase === 'idle' ? 'scaleX(0)' : 'scaleX(1)',
            transformOrigin: 'left',
            transition: 'transform 2.8s ease-out',
            opacity: 0.7,
          }} />
        </div>

        {/* Numbered audience dots */}
        <div style={{
          position: 'relative',
          height: 140,
        }}>
          {notifPositions.map((notif, i) => {
            const isVisible = i <= activeNotifIndex;
            const isActive = i === activeNotifIndex;
            const stageWidth = 100 / STAGES.length;
            const leftPct = (notif.stageIdx + 0.5) * stageWidth;
            const verticalOffset = notif.stack * 24;
            const colors = AUDIENCE_COLORS[notif.audience] || AUDIENCE_COLORS.client;
            const dotSize = isActive ? 28 : 22;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: verticalOffset,
                  transform: 'translateX(-50%)',
                  opacity: isVisible ? 1 : 0,
                  transition: 'opacity 500ms ease',
                  pointerEvents: 'none',
                  zIndex: isActive ? 3 : (isVisible ? 2 : 1),
                }}
              >
                <div style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: colors.dot,
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isActive ? 12 : 10.5,
                  fontWeight: 700,
                  fontFamily: 'Georgia, serif',
                  boxShadow: isActive
                    ? `0 0 0 5px ${colors.dot}22, 0 2px 8px ${colors.dot}33`
                    : `0 1px 2px ${colors.dot}33`,
                  transition: 'all 350ms ease',
                  margin: '0 auto',
                  border: '1.5px solid #FFFFFF',
                }}>
                  {notif.rowNumber}
                </div>
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 10px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#FFFFFF',
                    color: '#1F4030',
                    padding: '8px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'Georgia, serif',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    boxShadow: '0 6px 16px rgba(31, 64, 48, 0.12), 0 0 0 1px rgba(31, 64, 48, 0.08)',
                    border: `1px solid ${colors.soft}`,
                  }}>
                    <span style={{
                      fontSize: 9.5,
                      color: colors.dot,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      marginRight: 6,
                      fontStyle: 'italic',
                      fontFamily: 'system-ui, sans-serif',
                    }}>
                      {colors.label}
                    </span>
                    {notif.title}
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid #FFFFFF',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showFinal && (
          <div style={{
            textAlign: 'center',
            marginTop: 10,
            opacity: 1,
            transition: 'opacity 700ms ease',
          }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 19,
              fontWeight: 500,
              color: '#1F4030',
              marginBottom: 6,
              letterSpacing: '-0.01em',
            }}>
              30 small moments of care
            </div>
            <div style={{
              fontSize: 12,
              color: '#8B7A4F',
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
            }}>
              Every one written by hand. Sent by us. Owned by us.
            </div>
          </div>
        )}
      </div>

      {/* Audience legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 22,
        marginTop: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: AUDIENCE_COLORS.client.dot,
            border: '1.5px solid #FFFFFF',
            boxShadow: `0 0 0 1px ${AUDIENCE_COLORS.client.dot}33`,
          }} />
          <span style={{
            fontSize: 12,
            color: '#5A5145',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
          }}>
            For her
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: AUDIENCE_COLORS.therapist.dot,
            border: '1.5px solid #FFFFFF',
            boxShadow: `0 0 0 1px ${AUDIENCE_COLORS.therapist.dot}33`,
          }} />
          <span style={{
            fontSize: 12,
            color: '#5A5145',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
          }}>
            For you
          </span>
        </div>
      </div>

      {phase === 'done' && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={manualReplay}
            style={{
              background: '#FFFFFF',
              color: '#1F4030',
              border: '1.5px solid #1F4030',
              borderRadius: 999,
              padding: '9px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.02em',
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
      title: 'What she receives',
      subtitle: `${clientRows.length} small notes that keep her informed. From the first booking to a graceful goodbye.`,
      rows: clientRows,
      audience: 'client',
      footnote: 'No bell for your client. By design. She books, reads, and signs through one-tap magic links, never a password. The bell stays yours alone. Push notifications for her arrive with the future client app.',
    },
    {
      kind: 'table',
      title: 'What you receive',
      subtitle: `${therapistRows.length} alerts that keep you in the loop, including the ones that fire when something fails to deliver.`,
      rows: therapistRows,
      audience: 'therapist',
      footnote: 'Bell and push are already live on your dashboard. SMS to you needs your Twilio number connected. Email always works.',
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
      background: 'linear-gradient(180deg, #FEFCF6 0%, #F5EFE0 100%)',
      borderRadius: 22,
      padding: '28px 24px',
      border: '1px solid #EDE2C8',
      maxWidth: 880,
      margin: '0 auto',
      boxShadow: '0 2px 12px rgba(31, 64, 48, 0.05)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 16,
        marginBottom: 22,
        flexWrap: 'wrap',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 58,
          fontWeight: 400,
          lineHeight: 1,
          color: '#1F4030',
          letterSpacing: '-0.025em',
        }}>
          {total}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 19,
            fontWeight: 500,
            color: '#1F4030',
            marginBottom: 4,
            lineHeight: 1.3,
            letterSpacing: '-0.005em',
          }}>
            small notes between you and your client
          </div>
          <div style={{
            fontSize: 13,
            color: '#5A5145',
            lineHeight: 1.6,
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
          }}>
            Built in our own kitchen. If a reminder doesn't deliver, you find out. Not your client.
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
        gap: 10,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: '#8B7A4F',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
        }}>
          Card {cardIndex + 1} of {cards.length}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => goTo(cardIndex - 1)}
            disabled={cardIndex === 0}
            style={{
              background: cardIndex === 0 ? '#F4F0E2' : '#FFFFFF',
              color: cardIndex === 0 ? '#A89F92' : '#1F4030',
              border: cardIndex === 0 ? '1px solid #F4F0E2' : '1.5px solid #1F4030',
              borderRadius: 999,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: cardIndex === 0 ? 'not-allowed' : 'pointer',
              minHeight: 44,
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.02em',
            }}
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => goTo(cardIndex + 1)}
            disabled={cardIndex === cards.length - 1}
            style={{
              background: cardIndex === cards.length - 1 ? '#F4F0E2' : '#1F4030',
              color: cardIndex === cards.length - 1 ? '#A89F92' : '#FFFFFF',
              border: cardIndex === cards.length - 1 ? '1px solid #F4F0E2' : '1.5px solid #1F4030',
              borderRadius: 999,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: cardIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
              minHeight: 44,
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.02em',
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
              fontSize: 24,
              fontWeight: 500,
              color: '#1F4030',
              marginBottom: 6,
              letterSpacing: '-0.01em',
            }}>
              {card.title}
            </div>
            <div style={{
              fontSize: 13,
              color: '#5A5145',
              marginBottom: 16,
              lineHeight: 1.65,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              maxWidth: 580,
            }}>
              {card.subtitle}
            </div>
            <NotificationTable rows={card.rows} audience={card.audience} />
            {card.footnote && (
              <div style={{
                marginTop: 14,
                padding: '12px 16px',
                background: '#FAF4E6',
                border: '1px solid #EDE2C8',
                borderRadius: 12,
                fontSize: 12.5,
                color: '#5A5145',
                fontStyle: 'italic',
                lineHeight: 1.6,
                fontFamily: 'Georgia, serif',
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
        gap: 10,
        marginTop: 22,
      }}>
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              border: '1.5px solid #1F4030',
              background: i === cardIndex ? '#1F4030' : 'transparent',
              cursor: 'pointer',
              padding: 0,
              transition: 'background 200ms ease',
            }}
            aria-label={`Go to card ${i + 1}`}
          />
        ))}
      </div>

      {/* Trust line */}
      <div style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: '1px solid #EDE2C8',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 17,
          fontWeight: 500,
          color: '#1F4030',
          lineHeight: 1.55,
          letterSpacing: '-0.005em',
          maxWidth: 540,
          margin: '0 auto',
          fontStyle: 'italic',
        }}>
          If a reminder doesn't go out, that's on us.<br/>
          Not on a third party. Not on your client.
        </div>
      </div>
    </div>
  );
}
