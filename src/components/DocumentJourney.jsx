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
function JourneyDot({ n, label, status, statusText, onClick, sub, pressed }) {
  const isDone = status === 'done';
  const isCurrent = status === 'current' || status === 'ready';   // 'current' is new, 'ready' kept for back-compat
  const isWaiting = status === 'waiting' || status === 'pending';
  const isLocked = status === 'locked';

  const ringStyle = (() => {
    if (isDone) return { background: C.sage, border: `2px solid ${C.sage}`, boxShadow: `0 2px 6px rgba(74,107,84,0.18), 0 0 0 2px ${C.sageBg}` };
    if (isCurrent) return { background: C.white, border: `2.5px solid ${C.gold}`, boxShadow: `0 0 0 2px ${C.goldBg}, 0 2px 5px rgba(201,168,76,0.16)` };
    if (isLocked) return { background: C.cream, border: `2px solid ${C.lineFaint}`, opacity: 0.7 };
    return { background: C.white, border: `2px dashed ${C.muted}`, opacity: 0.85 };
  })();

  const numColor = isDone ? C.white : isCurrent ? C.forest : C.muted;
  const labelColor = isDone || isCurrent ? C.forest : C.muted;
  const statusColor = isDone ? C.sage : isCurrent ? C.goldDeep : C.muted;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      className={`bm-journey-dot${pressed ? ' bm-dot-pressed' : ''}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: C.white,
        // HK May 25 2026 round 5: same outer container for all 4 dots
        // so they read as the same component in different states. The
        // earlier design swapped the outer border to gold for the
        // current dot, which read as 'bigger' next to the others.
        // Differentiation now lives entirely inside the circle (ring
        // style + corner badge) so the row feels consistent.
        border: `1px solid ${C.lineFaint}`,
        cursor: isLocked ? 'not-allowed' : 'pointer',
        padding: '8px 6px',
        gap: 7,
        position: 'relative', zIndex: 2,
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(28,43,34,0.04)',
      }}
      aria-label={`${label}, ${statusText}, tap to open document`}
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
        {/* Always show the number so the user sees the 1/2/3/4 continuum.
            Lock icon overlays the number when locked (rare). Checkmark
            sits in a corner badge for done states, not replacing the number. */}
        {isLocked ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        ) : (
          n
        )}

        {/* Corner badge: green check for done, gold dot for ready,
            nothing for pending/locked. Sits top-right outside the
            dot circle so the number stays the centerpiece. */}
        {isDone && (
          <span style={{
            position: 'absolute',
            top: -3, right: -3,
            width: 17, height: 17, borderRadius: '50%',
            background: '#16A34A', // bright green so it pops against sage
            border: `2px solid ${C.cream}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
        {isCurrent && !isDone && (
          <span style={{
            position: 'absolute',
            top: -3, right: -3,
            width: 13, height: 13, borderRadius: '50%',
            background: C.gold,
            border: `2px solid ${C.cream}`,
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            animation: 'bmReadyPulse 1.8s ease-in-out infinite',
          }} />
        )}
      </div>
      <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
        <div style={{
          fontFamily: C.serif, fontSize: 12.5, fontWeight: 600,
          color: labelColor, letterSpacing: '-0.1px',
          whiteSpace: 'nowrap',
        }}>{label}</div>
        {sub && (
          <div className="bm-journey-dot-sub" style={{
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
export default function DocumentJourney({ session, aiEnabled = true, onSoapClick = null, onSelect = null }) {
  const [pressedDot, setPressedDot] = React.useState(null);

  // HK May 25 2026 (Phase 24d): when there's no session yet (intake
  // not submitted), render the journey anyway with all dots in
  // 'waiting' state. Previously this returned null which hid the
  // journey entirely for pending-intake bookings - the therapist
  // saw an empty slide-over with no orientation. Now: 4 greyed
  // dots showing 'Intake awaiting client' at position 1, the rest
  // pending. Same visual rhythm regardless of state.
  if (!session) {
    const placeholderStates = [
      { n: 1, label: 'Intake',         status: 'current', statusText: 'Awaiting client' },
      { n: 2, label: 'Pre-Session',    status: 'waiting', statusText: 'Unlocks after intake' },
      { n: 3, label: 'Post-Session',   status: 'waiting', statusText: 'After your session' },
      { n: 4, label: 'Client Recap',   status: 'waiting', statusText: 'After your session' },
    ];
    return (
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 4, paddingTop: 18, paddingBottom: 4, opacity: 0.7,
        }}>
          {placeholderStates.map((s) => (
            <JourneyDot
              key={s.n}
              n={s.n}
              label={s.label}
              status={s.status}
              statusText={s.statusText}
              onClick={() => onSelect && onSelect(s.n)}
            />
          ))}
        </div>
      </div>
    );
  }

  const sessionId = session.id;
  const completed = !!session.completed;

  // Sequential journey state. Each step requires the previous to be done.
  // No more contradictory states (e.g. dot 2 'ready' while 3 and 4 'done').
  //
  // Intake:   session exists with client data (effectively always done if
  //           the session row exists)
  // Pre:      ALWAYS done once intake is filled. The Pre-Session Brief is
  //           a derived reference document the therapist reads, not an
  //           action item they 'complete'. Marking it as always-green
  //           (when intake is done) means the journey's 'current' dot
  //           jumps straight to the actual next action: writing SOAP.
  //           This makes the banner ('write your session notes') and
  //           the timeline agree on what's next.
  // Record:   session.completed AND therapist saved SOAP content
  // Recap:    session.completed AND therapist wrote a message to client
  //
  // 'Current' is the first dot that needs therapist action. Earlier dots
  // are 'done', later dots are 'waiting'.

  const intakeDone = !!(
    (session.front_focus && session.front_focus.length) ||
    (session.back_focus && session.back_focus.length) ||
    session.client_notes ||
    session.pressure
  );

  // Parse SOAP from therapist_notes to know if record/recap have content
  let soap = { S: '', O: '', A: '', P: '', noteToClient: '' };
  try {
    const parsed = JSON.parse(session.therapist_notes || '');
    if (parsed && parsed.__soap) soap = parsed;
  } catch (e) { /* legacy or empty */ }

  const hasSoapContent = !!(soap.S || soap.O || soap.A || soap.P);
  const hasNoteToClient = !!(session.public_notes || soap.noteToClient);

  // preDone is automatic the moment intake is filled. The pre-session
  // brief is generated from intake data, there is nothing for the
  // therapist to 'do' here, only to read.
  const preDone = intakeDone;
  const recordDone = completed && hasSoapContent;
  const recapDone = completed && hasNoteToClient;

  // Determine the single 'current' dot (first incomplete actionable step)
  let currentN = null;
  if (!intakeDone) currentN = 1;
  // Skip dot 2: it is never the actionable 'next' step since it auto-
  // resolves with intake. Jump directly to dot 3 if record is undone.
  else if (!recordDone) currentN = 3;
  else if (!recapDone) currentN = 4;

  const computeStatus = (n, done) => {
    if (done) return 'done';
    if (currentN === n) return 'current';
    return 'waiting';
  };

  const states = [
    {
      n: 1, label: 'Intake',
      status: computeStatus(1, intakeDone),
      statusText: intakeDone ? 'Filled by client' : 'Awaiting client',
      url: `/brief/intake/${sessionId}`,
    },
    {
      n: 2, label: 'Pre-Session',
      status: computeStatus(2, preDone),
      statusText: preDone ? 'Ready to read' : 'Waiting',
      url: `/brief/pre/${sessionId}`,
    },
    {
      n: 3, label: 'Record',
      status: computeStatus(3, recordDone),
      statusText: recordDone ? 'Saved by you' : 'Tap to write',
      url: `/brief/post/${sessionId}`,
    },
    {
      n: 4, label: 'Recap',
      status: computeStatus(4, recapDone),
      statusText: recapDone ? 'Sent to client' : (recordDone ? 'Send to client' : 'Waiting'),
      url: `/recap/${sessionId}`,
    },
  ];

  const handleClick = (state) => {
    // 'waiting' dots are clickable so the therapist can preview, but
    // they don't have the gold pulse calling attention to them.
    if (state.status === 'locked') return;
    // Dot 3 (Record) when not done and parent provided an onSoapClick
    // callback: jump to the inline SOAP editor on the session page
    // instead of opening the document drawer.
    if (state.n === 3 && state.status !== 'done' && onSoapClick) {
      setPressedDot(state.n);
      setTimeout(() => {
        setPressedDot(null);
        onSoapClick();
      }, 220);
      return;
    }
    setPressedDot(state.n);
    setTimeout(() => {
      setPressedDot(null);
      if (onSelect) {
        onSelect(state.n);
      } else {
        window.open(state.url, '_blank');
      }
    }, 220);
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
        // HK May 25 2026: minWidth 320 was clipping doc 4 (Recap) on
        // narrow iPhones, since the cockpit content area can be ~290px
        // on a 360px slide-over after padding. minWidth 0 lets the
        // four-column grid shrink with the parent. The dot sizes are
        // already reduced via the 520px media query.
        flex: 1, minWidth: 0,
      }}>
      <style>{`
        .bm-journey-dot {
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.12s ease;
        }
        .bm-journey-dot > div:first-child {
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease, background 0.18s ease;
        }
        .bm-journey-dot:hover:not(:disabled) > div:first-child {
          transform: translateY(-2px) scale(1.04);
        }
        .bm-journey-dot:active:not(:disabled) > div:first-child {
          transform: translateY(0) scale(0.94);
          transition-duration: 0.08s;
        }
        .bm-journey-dot:focus-visible {
          outline: none;
        }
        .bm-journey-dot:focus-visible > div:first-child {
          box-shadow: 0 0 0 4px rgba(74,107,84,0.25), 0 2px 8px rgba(74,107,84,0.20);
        }
        .bm-journey-dot:focus-visible > div:nth-child(2) > div:first-child {
          color: ${C.forest};
        }
        .bm-journey-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
          gap: 4px;
          align-items: stretch;
          position: relative;
        }
        /* Equalize card heights so single-line statuses (Waiting) don't
           render shorter than two-line ones (Filled by client). Cards
           stretch from align-items: stretch on the row. The inner label
           block flex-grows so a card with shorter sub text fills the
           same space as one with longer sub text. */
        .bm-journey-dot {
          display: flex; flex-direction: column;
          min-width: 0;
        }
        .bm-journey-dot > div:last-child {
          flex: 1;
          display: flex; flex-direction: column; justify-content: flex-start;
        }
        /* Sub text wraps gracefully when card width is narrow */
        .bm-journey-dot-sub {
          white-space: normal;
          word-break: break-word;
        }
        @keyframes bmDotPulse {
          0% { box-shadow: 0 0 0 0 rgba(74,107,84,0.5); }
          70% { box-shadow: 0 0 0 14px rgba(74,107,84,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,107,84,0); }
        }
        @keyframes bmReadyPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.85; }
        }
        .bm-journey-dot.bm-dot-pressed > div:first-child {
          animation: bmDotPulse 0.55s ease-out;
        }
        @media (max-width: 520px) {
          .bm-journey-wrap { padding: 10px 10px 14px !important; }
          .bm-journey-row {
            gap: 2px !important;
            grid-template-columns: 1fr 12px 1fr 12px 1fr 12px 1fr !important;
          }
          .bm-journey-dot > div:first-child { width: 38px !important; height: 38px !important; font-size: 14px !important; }
          .bm-journey-dot { padding: 6px 3px !important; }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.goldDeep,
          textTransform: 'uppercase', letterSpacing: '1.4px',
        }}>
          The journey
        </div>
        <div style={{ fontSize: 10.5, color: C.inkSoft, fontStyle: 'italic' }}>
          {completed ? 'All four documents complete' : 'Tap any step to view'}
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
              pressed={pressedDot === state.n}
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

      {/* Legend: explains the three visual states so the therapist
          can read the journey at a glance without guessing. */}
      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.lineFaint}`,
        display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center',
        fontSize: 10, color: C.inkSoft,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: C.sage, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          Done
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 11, height: 11, borderRadius: '50%',
            background: C.white, border: `2px solid ${C.gold}`,
            boxShadow: `0 0 0 2px ${C.goldBg}`,
          }} />
          Next step
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 11, height: 11, borderRadius: '50%',
            background: C.white, border: `1.5px dashed ${C.muted}`,
          }} />
          Waiting
        </span>
      </div>
    </div>
  );
}
