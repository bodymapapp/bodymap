// src/components/DocumentJourney.jsx
//
// Four-dot number-line timeline showing where we are in the client
// journey for a given session. Replaces the three legacy buttons
// (Intake / Pre-Session / Post-Session) at the top of the session
// detail page with a denser, more informative visual.
//
// The four dots:
//   1. Intake          - what the client filled in (always done if session exists)
//   2. Pre-Session Brief - the therapist's prep read
//   3. Post-Session Record - therapist's SOAP-driven clinical record
//   4. Client Recap     - the warm summary sent to the client (auto when 3 saves)
//
// Each dot has a state:
//   done    - filled solid sage, white checkmark, soft shadow
//   ready   - white with gold ring, the next action (call to attention)
//   pending - cream outline, muted, comes later
//   locked  - same look as pending but lock icon (AI features off)
//
// Each dot is clickable. Clicking opens the relevant document in a
// new tab. Pending/locked dots are still clickable (you may want to
// peek at the empty doc), they just look quiet.
//
// Visual: horizontal number-line, dots connected by lines (solid
// between done dots, dashed where the journey isn't complete yet).
// Labels below each dot show the doc name (Fraunces) and status
// (Inter, italic).

import React from 'react';

const C = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  forestSoft: '#2A5741',
  sage: '#4A6B54',
  sageBg: '#EEF3EE',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  goldDeep: '#92660E',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  lineFaint: '#E8E0D0',
  muted: '#B8B0A0',
  white: '#FFFFFF',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

// ─── Dot component ───
function JourneyDot({ n, label, status, statusText, onClick, sub }) {
  const isDone = status === 'done';
  const isReady = status === 'ready';
  const isPending = status === 'pending';
  const isLocked = status === 'locked';

  const ringStyle = (() => {
    if (isDone) return { background: C.sage, border: `2px solid ${C.sage}`, boxShadow: `0 2px 8px rgba(74,107,84,0.25), 0 0 0 4px ${C.sageBg}` };
    if (isReady) return { background: C.white, border: `2.5px solid ${C.gold}`, boxShadow: `0 0 0 4px ${C.goldBg}, 0 2px 6px rgba(201,168,76,0.20)` };
    if (isLocked) return { background: C.cream, border: `2px solid ${C.lineFaint}`, opacity: 0.55 };
    return { background: C.white, border: `2px dashed ${C.muted}`, opacity: 0.7 };
  })();

  const numColor = isDone ? C.white : isReady ? C.forest : C.muted;
  const labelColor = isDone || isReady ? C.forest : C.muted;
  const statusColor = isDone ? C.sage : isReady ? C.goldDeep : C.muted;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      className="bm-journey-dot"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'transparent', border: 'none',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        padding: 0, gap: 7,
        minWidth: 60,
        position: 'relative', zIndex: 2,
      }}
      aria-label={`${label} - ${statusText}`}
    >
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: C.serif,
        fontSize: 16, fontWeight: 700,
        color: numColor,
        position: 'relative',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        ...ringStyle,
      }}>
        {isLocked ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        ) : isDone ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          n
        )}
      </div>
      <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
        <div style={{
          fontFamily: C.serif, fontSize: 12.5, fontWeight: 600,
          color: labelColor, letterSpacing: '-0.1px',
          whiteSpace: 'nowrap',
        }}>{label}</div>
        {sub && (
          <div style={{
            fontFamily: C.sans, fontSize: 9.5,
            color: statusColor, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.7px',
            marginTop: 1,
          }}>{statusText}</div>
        )}
      </div>
    </button>
  );
}

// ─── Connector line ───
function Connector({ leftDone, rightDone }) {
  // Solid sage if both endpoints are 'done', otherwise faint dashed
  const bothDone = leftDone && rightDone;
  return (
    <div style={{
      flex: 1, height: 2,
      position: 'relative',
      alignSelf: 'flex-start',
      marginTop: 19,            // align center of dot (40/2 - 2/2 = 19)
      zIndex: 1,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: bothDone
          ? `linear-gradient(to right, ${C.sage}, ${C.sage})`
          : `repeating-linear-gradient(to right, ${C.lineFaint} 0 5px, transparent 5px 9px)`,
        borderRadius: 2,
      }} />
    </div>
  );
}

// ─── Main component ───
export default function DocumentJourney({ session, aiEnabled = true }) {
  if (!session) return null;

  const sessionId = session.id;
  const completed = !!session.completed;

  // States for each dot:
  // 1. Intake: always done (session exists because client filled it)
  // 2. Pre-Session: ready (or locked if AI off)
  // 3. Post-Session Record: done if completed, ready if not (or locked if AI off)
  // 4. Client Recap: sent (done) if completed, pending otherwise

  const states = [
    {
      n: 1,
      label: 'Intake',
      status: 'done',
      statusText: 'Filled',
      url: `/brief/intake/${sessionId}`,
    },
    {
      n: 2,
      label: 'Pre-Session',
      status: aiEnabled ? 'ready' : 'locked',
      statusText: aiEnabled ? 'Ready' : 'AI off',
      url: `/brief/pre/${sessionId}`,
    },
    {
      n: 3,
      label: 'Record',
      status: !aiEnabled ? 'locked' : (completed ? 'done' : 'ready'),
      statusText: !aiEnabled ? 'AI off' : (completed ? 'Saved' : 'Next'),
      url: `/brief/post/${sessionId}`,
    },
    {
      n: 4,
      label: 'Recap',
      status: completed ? 'done' : 'pending',
      statusText: completed ? 'Sent' : 'Waiting',
      url: `/recap/${sessionId}`,
    },
  ];

  const handleClick = (state) => {
    if (state.status === 'locked') return;
    window.open(state.url, '_blank');
  };

  return (
    <div
      className="bm-journey-wrap"
      style={{
        background: C.white,
        border: `1px solid ${C.lineFaint}`,
        borderRadius: 14,
        padding: '12px 18px 14px',
        boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
        flex: 1, minWidth: 320,
      }}>
      <style>{`
        .bm-journey-dot:hover:not(:disabled) > div:first-child {
          transform: translateY(-1px);
        }
        .bm-journey-row {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 4px; position: relative;
        }
        @media (max-width: 520px) {
          .bm-journey-wrap { padding: 10px 12px 12px !important; }
          .bm-journey-row { gap: 2px !important; }
          .bm-journey-dot { min-width: 50px !important; }
          .bm-journey-dot > div:first-child { width: 34px !important; height: 34px !important; font-size: 14px !important; }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.goldDeep,
          textTransform: 'uppercase', letterSpacing: '1.4px',
        }}>
          The journey
        </div>
        <div style={{ fontSize: 10.5, color: C.inkSoft, fontStyle: 'italic' }}>
          {completed ? 'All four documents complete' : 'Next steps highlighted'}
        </div>
      </div>
      <div className="bm-journey-row">
        {states.map((state, i) => (
          <React.Fragment key={state.n}>
            <JourneyDot
              n={state.n}
              label={state.label}
              status={state.status}
              statusText={state.statusText}
              onClick={() => handleClick(state)}
              sub
            />
            {i < states.length - 1 && (
              <Connector
                leftDone={state.status === 'done'}
                rightDone={states[i + 1].status === 'done'}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
