// src/components/demos/SmartCalendarAnimation.jsx
//
// Ribbon 4 demo. Three-act loop that brings the left-column
// Smart Calendar insights to life:
//
//   Act 1 (0-3.5s)  An empty Tuesday noon slot appears,
//                   marked CANCELLATION, drawing the eye.
//   Act 2 (3.5-7s)  The intelligence panel surfaces ONE
//                   lapsed regular (Maria L.) with three
//                   specific reasons why she's the right fit
//                   for that exact slot.
//   Act 3 (7-11s)   A pre-drafted text fades in, the Send
//                   button pulses once, then the gap fills
//                   with Maria's avatar and a green check.
//
//   Act 4 (11-13s)  Brief settle pause, then the loop
//                   restarts from Act 1.
//
// Implementation: pure CSS keyframes on inline SVG primitives.
// No JS animation library, no requestAnimationFrame, no
// timers. The browser handles everything on the GPU.
// Respects prefers-reduced-motion: in that case we show the
// final settled state (Maria in the slot) with no animation.
//
// HK May 16 2026: this is the moat demo. Lives only in
// Ribbon 4 (Day-of-Session) per the 7-ribbon taxonomy.

import React from 'react';

const C = {
  forestDeep: '#1F4030',
  forest:     '#2A5741',
  sage:       '#6B9E80',
  sageSoft:   '#A8C8B0',
  cream:      '#FBFAF4',
  creamDeep:  '#F2EFE4',
  gold:       '#C9A84C',
  rose:       '#C77B8A',
  roseSoft:   '#FDF2F4',
  amber:      '#D97706',
  amberSoft:  '#FEF3C7',
  ink:        '#3F4F45',
  inkSoft:    '#6B7280',
  inkFade:    '#9CA3AF',
};

const LOOP_DURATION = 13; // seconds, the full loop

export default function SmartCalendarAnimation() {
  return (
    <div className="bm-smart-cal" style={{
      maxWidth: 480, margin: '0 auto', background: '#fff',
      borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 18px 48px rgba(42, 87, 65, 0.13), 0 2px 8px rgba(42, 87, 65, 0.06)',
      border: `1px solid rgba(74, 107, 84, 0.10)`,
    }}>
      <style>{css}</style>

      {/* ─── Header bar ──────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.forestDeep} 0%, ${C.forest} 100%)`,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Your Tuesday</span>
        </div>
        <div className="bm-sc-time" style={{
          fontFamily: 'Georgia, serif', fontStyle: 'italic',
          fontSize: 12, color: 'rgba(255,255,255,0.85)',
        }}>
          11:47 AM
        </div>
      </div>

      {/* ─── Stage area ──────────────────────────────────────── */}
      <div style={{ padding: '18px 18px 20px', minHeight: 460, position: 'relative' }}>

        {/* ── Act 1 marker: cancellation toast ─────────────── */}
        <div className="bm-sc-toast" style={{
          background: C.amberSoft,
          border: `1px solid ${C.amber}`,
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div className="bm-sc-toast-dot" style={{
            width: 8, height: 8, borderRadius: 4,
            background: C.amber, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
              Cancellation just landed
            </div>
            <div style={{ fontSize: 11, color: '#B45309', marginTop: 1 }}>
              Sarah M. moved her noon session
            </div>
          </div>
        </div>

        {/* ── Mini-calendar with the open slot ─────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '52px 1fr',
          gap: 8,
          marginBottom: 16,
        }}>
          {[
            { time: '10:00', label: 'Jennifer K.', focus: 'Lower back', booked: true },
            { time: '11:00', label: 'Buffer', focus: '', buffer: true },
            { time: '12:00', label: '', focus: '', open: true, key: 'slot' },
            { time: '1:30',  label: 'Amy W.', focus: 'Full body', booked: true },
            { time: '3:00',  label: 'Rachel T.', focus: 'Neck + shoulders', booked: true },
          ].map((row, i) => (
            <React.Fragment key={i}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: C.inkFade,
                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                paddingTop: 8, textAlign: 'right',
              }}>
                {row.time}
              </div>
              {row.open ? (
                <SlotBox />
              ) : row.buffer ? (
                <div style={{
                  background: 'transparent',
                  borderTop: `1px dashed ${C.creamDeep}`,
                  borderBottom: `1px dashed ${C.creamDeep}`,
                  padding: '4px 12px',
                  fontSize: 10, color: C.inkFade,
                  fontStyle: 'italic', fontFamily: 'Georgia, serif',
                }}>
                  ~ buffer ~
                </div>
              ) : (
                <div style={{
                  background: '#FAFAF7',
                  border: `1px solid ${C.creamDeep}`,
                  borderLeft: `3px solid ${C.sageSoft}`,
                  borderRadius: 10,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{row.label}</div>
                    <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1 }}>{row.focus}</div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Act 2: intelligence card surfaces the right client ── */}
        <div className="bm-sc-intel" style={{
          background: `linear-gradient(180deg, ${C.cream} 0%, #fff 100%)`,
          border: `1.5px solid ${C.sageSoft}`,
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: '0 4px 14px rgba(74, 107, 84, 0.10)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Sage corner accent */}
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 80, height: 80,
            background: `radial-gradient(circle at top right, ${C.sageSoft}33 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.sage, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              ⚡ Fill this gap
            </span>
          </div>

          {/* Client surfaced */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <Avatar initials="ML" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 1 }}>
                Maria L.
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
                14 sessions · regular since '24
              </div>
            </div>
          </div>

          {/* Three reasons, each staggered */}
          <div className="bm-sc-reasons">
            <Reason index={0} text="Books Tuesdays at noon" />
            <Reason index={1} text="6 weeks since her last visit" />
            <Reason index={2} text="Texted you 'thinking of booking' last Friday" />
          </div>

          {/* Act 3: drafted message + send button */}
          <div className="bm-sc-draft" style={{
            marginTop: 14,
            background: '#fff',
            border: `1px dashed ${C.sageSoft}`,
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 11.5,
            color: C.ink,
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}>
            "Hi Maria, just had a noon spot open up Tuesday if you'd like it. Same focus as last time?"
          </div>

          <button className="bm-sc-send" type="button" style={{
            marginTop: 12,
            width: '100%',
            background: C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '11px 14px',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'default',
          }}>
            <span>Send to Maria</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function SlotBox() {
  return (
    <div className="bm-sc-slot" style={{
      borderRadius: 10, padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
      minHeight: 38,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Empty state (acts 1+2) */}
      <div className="bm-sc-slot-empty" style={{
        position: 'absolute', inset: 0,
        borderRadius: 10,
        background: C.roseSoft,
        border: `1.5px dashed ${C.rose}`,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
      }}>
        <span style={{ fontSize: 13 }}>🌿</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.rose, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
          Open · 60 min
        </span>
      </div>
      {/* Filled state (act 3 onward) */}
      <div className="bm-sc-slot-filled" style={{
        position: 'absolute', inset: 0,
        borderRadius: 10,
        background: '#F0F7F2',
        border: `1.5px solid ${C.sage}`,
        borderLeft: `3px solid ${C.sage}`,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
      }}>
        <Avatar initials="ML" size={24} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.forest }}>Maria L. · confirmed</div>
        </div>
        <span style={{ fontSize: 14, color: C.sage }}>✓</span>
      </div>
    </div>
  );
}

function Avatar({ initials, size = 32 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size / 2,
      background: `linear-gradient(135deg, ${C.sage} 0%, ${C.forest} 100%)`,
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size === 32 ? 12 : 10,
      fontWeight: 700,
      flexShrink: 0,
      boxShadow: '0 2px 6px rgba(42, 87, 65, 0.18)',
    }}>
      {initials}
    </div>
  );
}

function Reason({ index, text }) {
  return (
    <div className="bm-sc-reason" style={{
      '--bm-sc-reason-i': index,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0',
      fontSize: 12,
      color: C.ink,
      lineHeight: 1.4,
    }}>
      <span style={{
        fontSize: 10, color: C.sage, flexShrink: 0,
        fontFamily: 'Georgia, serif', fontWeight: 700,
      }}>
        ✓
      </span>
      <span>{text}</span>
    </div>
  );
}

// ─── Keyframes ────────────────────────────────────────────────
// One single 13-second loop driving everything. Each element
// gets the same animation-duration and a different keyframe
// percentage range, so the browser handles all timing.
//
// Loop map:
//   0-8%      Act 1 enter: cancellation toast slides in,
//             slot pulse begins
//   8-27%     Act 1 hold + slot keeps pulsing
//   27-35%    Act 2 enter: intelligence card slides up
//   35-42%    Reasons stagger in
//   42-54%    Act 2 hold
//   54-58%    Draft message appears
//   58-62%    Send button pulse
//   62-67%    Slot transitions empty → filled
//   67-92%    Settled hold (Maria is in the slot)
//   92-100%   Soft fade back to start so loop restart is invisible
const css = `
@keyframes bm-sc-toast {
  0%, 3% { opacity: 0; transform: translateY(-10px); }
  6%, 90% { opacity: 1; transform: translateY(0); }
  95%, 100% { opacity: 0; transform: translateY(-6px); }
}
@keyframes bm-sc-toast-dot {
  0%, 8%, 16%, 24% { opacity: 1; }
  4%, 12%, 20% { opacity: 0.3; }
  25%, 100% { opacity: 1; }
}
@keyframes bm-sc-slot-empty {
  0%, 60% { opacity: 1; }
  65%, 100% { opacity: 0; }
}
@keyframes bm-sc-slot-empty-pulse {
  0%, 60% { box-shadow: 0 0 0 0 rgba(199, 123, 138, 0.45); }
  30% { box-shadow: 0 0 0 8px rgba(199, 123, 138, 0); }
  60%, 100% { box-shadow: 0 0 0 0 rgba(199, 123, 138, 0); }
}
@keyframes bm-sc-slot-filled {
  0%, 60% { opacity: 0; transform: scale(0.96); }
  65% { opacity: 1; transform: scale(1.03); }
  68%, 95% { opacity: 1; transform: scale(1); }
  100% { opacity: 0.6; transform: scale(1); }
}
@keyframes bm-sc-intel {
  0%, 22% { opacity: 0; transform: translateY(16px); }
  30%, 92% { opacity: 1; transform: translateY(0); }
  98%, 100% { opacity: 0; transform: translateY(8px); }
}
@keyframes bm-sc-reason {
  0%, 32% { opacity: 0; transform: translateX(-8px); }
  /* stagger handled per element via --bm-sc-reason-i delay */
  42%, 92% { opacity: 1; transform: translateX(0); }
  98%, 100% { opacity: 0; }
}
@keyframes bm-sc-draft {
  0%, 50% { opacity: 0; transform: translateY(6px); }
  56%, 92% { opacity: 1; transform: translateY(0); }
  98%, 100% { opacity: 0; }
}
@keyframes bm-sc-send {
  0%, 54% { opacity: 0; transform: translateY(6px); }
  58% { opacity: 1; transform: translateY(0) scale(1); }
  61% { transform: translateY(0) scale(1.04); box-shadow: 0 0 0 6px rgba(42, 87, 65, 0.18); }
  65%, 92% { opacity: 1; transform: translateY(0) scale(1); box-shadow: 0 0 0 0 rgba(42, 87, 65, 0); }
  98%, 100% { opacity: 0; }
}
@keyframes bm-sc-time {
  0% { opacity: 1; content: "11:47 AM"; }
  60% { opacity: 1; }
  62% { opacity: 0; }
  64% { opacity: 1; }
  100% { opacity: 1; }
}

.bm-smart-cal {
  --d: ${LOOP_DURATION}s;
}
.bm-sc-toast {
  animation: bm-sc-toast var(--d) ease-in-out infinite;
  will-change: opacity, transform;
}
.bm-sc-toast-dot {
  animation: bm-sc-toast-dot var(--d) ease-in-out infinite;
}
.bm-sc-slot-empty {
  animation:
    bm-sc-slot-empty var(--d) ease-in-out infinite,
    bm-sc-slot-empty-pulse var(--d) ease-in-out infinite;
}
.bm-sc-slot-filled {
  opacity: 0;
  animation: bm-sc-slot-filled var(--d) ease-in-out infinite;
  will-change: opacity, transform;
}
.bm-sc-intel {
  opacity: 0;
  animation: bm-sc-intel var(--d) ease-in-out infinite;
  will-change: opacity, transform;
}
.bm-sc-reason {
  opacity: 0;
  animation: bm-sc-reason var(--d) ease-in-out infinite;
  animation-delay: calc(var(--bm-sc-reason-i, 0) * 0.4s);
  will-change: opacity, transform;
}
.bm-sc-draft {
  opacity: 0;
  animation: bm-sc-draft var(--d) ease-in-out infinite;
}
.bm-sc-send {
  opacity: 0;
  animation: bm-sc-send var(--d) ease-in-out infinite;
}

/* Reduced motion: settled state only, no animation. */
@media (prefers-reduced-motion: reduce) {
  .bm-sc-toast,
  .bm-sc-toast-dot,
  .bm-sc-slot-empty,
  .bm-sc-slot-filled,
  .bm-sc-intel,
  .bm-sc-reason,
  .bm-sc-draft,
  .bm-sc-send {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .bm-sc-slot-empty { display: none !important; }
}
`;
