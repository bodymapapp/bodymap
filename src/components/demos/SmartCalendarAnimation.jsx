// src/components/demos/SmartCalendarAnimation.jsx
//
// The Ribbon 4 / Features #schedule / WhyBodyMap moat demo.
//
// HK May 16 2026 brief: "show them on the left and then on
// the right show the calendar... this is something people
// look at all the time."
//
// Three pillars, each gets ~5s of stage time in a 15s loop:
//
//   Pillar 1: Fill This Gap (0-5s)
//     LEFT  → Fill-This-Gap card is active. A cancellation toast,
//             then Maria L. surfaces with three reasons, then a
//             pre-drafted message and a Send button pulse.
//     RIGHT → Calendar. Tuesday noon flashes amber, then turns
//             rose-dashed "open," then fills with Maria L.
//
//   Pillar 2: Up-Next Briefing (5-10s)
//     LEFT  → Up-Next card is active. Three "remember-this"
//             bullets about the next client appear, pulled
//             from her last session.
//     RIGHT → Calendar. The 1:30 PM slot pulses, three small
//             paper-note dots appear above it, and a briefing
//             chip slides out beside it.
//
//   Pillar 3: Body Load Awareness (10-15s)
//     LEFT  → Body-Load card is active. Warning copy: three
//             deep tissue in a row, then a recovery suggestion.
//     RIGHT → Calendar. Three appointments get a thicker red
//             left-rail and a small intensity bar fills under
//             them. An amber banner at the bottom flags the load.
//
// Implementation: pure CSS keyframes on one shared 15s loop.
// Each element uses its own keyframe percentage windows to
// enter/exit during its pillar's slot, so no JS timing logic.
//
// prefers-reduced-motion: collapse to the third pillar's
// settled state (it's the most striking image) without any
// animation.

import React from 'react';

const C = {
  forestDeep: '#1F4030',
  forest:     '#2A5741',
  sage:       '#6B9E80',
  sageSoft:   '#A8C8B0',
  sageBg:     '#F0F7F2',
  cream:      '#FBFAF4',
  creamDeep:  '#F2EFE4',
  gold:       '#C9A84C',
  rose:       '#C77B8A',
  roseSoft:   '#FDF2F4',
  amber:      '#D97706',
  amberSoft:  '#FEF3C7',
  amberDeep:  '#92400E',
  red:        '#DC2626',
  redSoft:    '#FEF2F4',
  ink:        '#3F4F45',
  inkSoft:    '#6B7280',
  inkFade:    '#9CA3AF',
};

export default function SmartCalendarAnimation() {
  return (
    <div className="bm-sc-root" style={{
      maxWidth: 720, margin: '0 auto', background: '#fff',
      borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 18px 48px rgba(42, 87, 65, 0.13), 0 2px 8px rgba(42, 87, 65, 0.06)',
      border: '1px solid rgba(74, 107, 84, 0.10)',
    }}>
      <style>{css}</style>

      {/* Header */}
      <div className="bm-sc-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Your Tuesday</span>
        </div>
        <div className="bm-sc-pulse">
          <span className="bm-sc-pulse-dot" />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            live
          </span>
        </div>
      </div>

      <div className="bm-sc-stage">
        {/* LEFT: insight panel that cycles through 3 pillars */}
        <div className="bm-sc-insights">
          <PillarFill />
          <PillarBriefing />
          <PillarBodyLoad />
        </div>

        {/* RIGHT: calendar that responds to whichever pillar is active */}
        <div className="bm-sc-calendar">
          <CalendarBoard />
        </div>
      </div>
    </div>
  );
}

// ─── LEFT-COLUMN PILLAR CARDS ───────────────────────────────────

function PillarFill() {
  return (
    <article className="bm-sc-card bm-sc-card--fill">
      <div className="bm-sc-card-eyebrow" style={{ color: C.amberDeep }}>
        ⚡ Fill this gap
      </div>
      <div className="bm-sc-card-title">
        A slot opens. We name<br/>the one client to text.
      </div>

      <div className="bm-sc-card-body bm-sc-card-body--fill">
        <div className="bm-sc-mini-row">
          <Avatar initials="ML" size={28} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>Maria L.</div>
            <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              14 sessions · regular since '24
            </div>
          </div>
        </div>

        <div className="bm-sc-reasons">
          <ReasonRow index={0} text="Books Tuesdays at noon" />
          <ReasonRow index={1} text="6 weeks since her last visit" />
          <ReasonRow index={2} text="Texted 'thinking of booking' last Friday" />
        </div>

        <div className="bm-sc-draft">
          "Hi Maria, just had a noon spot open up Tuesday if you'd like it. Same focus as last time?"
        </div>

        <button type="button" className="bm-sc-send">
          <span>Send to Maria</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

function PillarBriefing() {
  return (
    <article className="bm-sc-card bm-sc-card--brief">
      <div className="bm-sc-card-eyebrow" style={{ color: '#166534' }}>
        📋 Up-next briefing
      </div>
      <div className="bm-sc-card-title">
        Three things to remember<br/>before Amy walks in.
      </div>

      <div className="bm-sc-card-body bm-sc-card-body--brief">
        <div className="bm-sc-mini-row">
          <Avatar initials="AW" size={28} variant="brief" />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>Amy W. · 1:30 PM</div>
            <div style={{ fontSize: 11, color: C.inkSoft, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              From your last 3 sessions
            </div>
          </div>
        </div>

        <div className="bm-sc-notes">
          <NoteRow index={0} icon="🎯" label="Focus" text="Left QL and right lower trap" />
          <NoteRow index={1} icon="✋" label="Pressure" text="Firm, asked for deeper last time" />
          <NoteRow index={2} icon="💬" label="Wants" text="Loves the warm towel finish" />
        </div>

        <div className="bm-sc-briefing-foot">
          Reads in four seconds. Already on your screen.
        </div>
      </div>
    </article>
  );
}

function PillarBodyLoad() {
  return (
    <article className="bm-sc-card bm-sc-card--load">
      <div className="bm-sc-card-eyebrow" style={{ color: C.forest }}>
        🌿 Body load awareness
      </div>
      <div className="bm-sc-card-title">
        Three deep tissue back to back.<br/>Your wrists are about to know.
      </div>

      <div className="bm-sc-card-body bm-sc-card-body--load">
        <div className="bm-sc-load-warn">
          <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.amberDeep }}>
              Heads up about today
            </div>
            <div style={{ fontSize: 11.5, color: C.amberDeep, marginTop: 2, lineHeight: 1.5 }}>
              Three 90-min deep tissue in a row, no buffer to recover.
            </div>
          </div>
        </div>

        <div className="bm-sc-suggest">
          <SuggestRow index={0} icon="💧" text="Hydrate now, before Jennifer's session" />
          <SuggestRow index={1} icon="🤲" text="Take wrist breaks between Amy and Rachel" />
          <SuggestRow index={2} icon="🛌" text="Skip strength training tonight, sleep early" />
        </div>

        <div className="bm-sc-load-foot">
          Built for the long career, not the long week.
        </div>
      </div>
    </article>
  );
}

// ─── RIGHT-COLUMN CALENDAR ─────────────────────────────────────

function CalendarBoard() {
  const slots = [
    { time: '10:00', client: 'Jennifer K.', focus: 'Lower back', service: 'Deep tissue 90', heavy: true,  key: 's1' },
    { time: '11:30', client: null, focus: '', service: 'buffer', buffer: true, key: 'buf1' },
    { time: '12:00', client: null, focus: '', service: '', open: true, key: 's2' },
    { time: '1:30',  client: 'Amy W.', focus: 'Full body', service: 'Deep tissue 90', heavy: true, focused: true, key: 's3' },
    { time: '3:30',  client: 'Rachel T.', focus: 'Neck + shoulders', service: 'Deep tissue 90', heavy: true, key: 's4' },
  ];

  return (
    <div className="bm-sc-cal-board">
      {/* Cancellation toast - pillar 1 */}
      <div className="bm-sc-cal-toast bm-sc-cal-toast--fill">
        <span style={{ fontSize: 12 }}>🌿</span>
        <span>Cancellation, Sarah moved her noon</span>
      </div>

      {/* Briefing chip - pillar 2 */}
      <div className="bm-sc-cal-toast bm-sc-cal-toast--brief">
        <span style={{ fontSize: 12 }}>📋</span>
        <span>Briefing ready for Amy W.</span>
      </div>

      {/* Body load banner - pillar 3 */}
      <div className="bm-sc-cal-toast bm-sc-cal-toast--load">
        <span style={{ fontSize: 12 }}>⚠️</span>
        <span>Three deep tissue in a row today</span>
      </div>

      <div className="bm-sc-cal-grid">
        {slots.map((s) => (
          <CalendarRow key={s.key} slot={s} />
        ))}
      </div>
    </div>
  );
}

function CalendarRow({ slot }) {
  // Three states for the noon slot: empty (pillar 1 first half),
  // open-rose (pillar 1 mid), filled (pillar 1 end and onward).
  // All other slots: static, but the 1:30 row gets a focus halo
  // during pillar 2, and the three heavy rows get red rails +
  // intensity bars during pillar 3.

  if (slot.buffer) {
    return (
      <div className="bm-sc-cal-row bm-sc-cal-row--buffer">
        <div className="bm-sc-cal-time">{slot.time}</div>
        <div className="bm-sc-cal-buffer">~ buffer ~</div>
      </div>
    );
  }

  if (slot.open) {
    return (
      <div className="bm-sc-cal-row">
        <div className="bm-sc-cal-time">{slot.time}</div>
        <div className="bm-sc-cal-slot-host">
          {/* Empty (before pillar 1 hits) */}
          <div className="bm-sc-cal-empty">
            <div style={{ height: 8, background: 'transparent' }} />
          </div>
          {/* Open + rose dashed during pillar 1 */}
          <div className="bm-sc-cal-open">
            <span style={{ fontSize: 13 }}>🌿</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.rose, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
              Open · 60 min
            </span>
          </div>
          {/* Filled with Maria L. after pillar 1 */}
          <div className="bm-sc-cal-filled">
            <Avatar initials="ML" size={22} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.forest }}>Maria L. · confirmed</div>
            </div>
            <span style={{ fontSize: 13, color: C.sage }}>✓</span>
          </div>
        </div>
      </div>
    );
  }

  const heavyClass = slot.heavy ? ' is-heavy' : '';
  const focusedClass = slot.focused ? ' is-focused' : '';
  return (
    <div className={`bm-sc-cal-row${heavyClass}${focusedClass}`}>
      <div className="bm-sc-cal-time">{slot.time}</div>
      <div className="bm-sc-cal-card">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
            {slot.client}
            {slot.focused && <span className="bm-sc-cal-notes">·  ·  ·</span>}
          </div>
          <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1 }}>
            {slot.service}
          </div>
        </div>
        {slot.heavy && <div className="bm-sc-cal-load-bar" />}
      </div>
    </div>
  );
}

// ─── Shared ─────────────────────────────────────────────────────

function Avatar({ initials, size = 32, variant = 'fill' }) {
  const gradient = variant === 'brief'
    ? `linear-gradient(135deg, #166534 0%, #14532D 100%)`
    : `linear-gradient(135deg, ${C.sage} 0%, ${C.forest} 100%)`;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size / 2,
      background: gradient,
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size <= 24 ? 10 : 11,
      fontWeight: 700,
      flexShrink: 0,
      boxShadow: '0 2px 6px rgba(42, 87, 65, 0.18)',
    }}>
      {initials}
    </div>
  );
}

function ReasonRow({ index, text }) {
  return (
    <div className="bm-sc-reason" style={{ '--bm-sc-r-i': index }}>
      <span style={{ fontSize: 10, color: C.sage, fontWeight: 700, fontFamily: 'Georgia, serif' }}>✓</span>
      <span>{text}</span>
    </div>
  );
}

function NoteRow({ index, icon, label, text }) {
  return (
    <div className="bm-sc-note" style={{ '--bm-sc-n-i': index }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginRight: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
        <span style={{ fontSize: 11.5, color: C.ink }}>{text}</span>
      </div>
    </div>
  );
}

function SuggestRow({ index, icon, text }) {
  return (
    <div className="bm-sc-suggest-row" style={{ '--bm-sc-s-i': index }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 11.5, color: C.ink, lineHeight: 1.45 }}>{text}</span>
    </div>
  );
}

// ─── CSS keyframes ──────────────────────────────────────────────
// One shared 15s loop. Pillar windows:
//   Pillar 1 (Fill):     0% to 33%   (0 to 5s)
//   Pillar 2 (Briefing): 33% to 66%   (5 to 10s)
//   Pillar 3 (Body Load):66% to 100%  (10 to 15s)
//
// Card visibility, calendar toasts, and slot states all key
// off these same windows. Reasons, notes, and suggestions
// stagger within their pillar using a CSS-variable delay
// (--bm-sc-r-i etc.) multiplied by 0.35s.
const css = `
.bm-sc-root { --d: 15s; }

.bm-sc-header {
  background: linear-gradient(135deg, ${C.forestDeep} 0%, ${C.forest} 100%);
  padding: 14px 18px;
  display: flex; align-items: center; justify-content: space-between;
}
.bm-sc-pulse { display: flex; align-items: center; gap: 6px; }
.bm-sc-pulse-dot {
  width: 7px; height: 7px; border-radius: 4px;
  background: ${C.sageSoft};
  box-shadow: 0 0 0 0 ${C.sageSoft};
  animation: bm-sc-pulse 1.6s ease-in-out infinite;
}
@keyframes bm-sc-pulse {
  0%, 100% { box-shadow: 0 0 0 0 ${C.sageSoft}; }
  50% { box-shadow: 0 0 0 6px rgba(168, 200, 176, 0); }
}

/* Two-column stage. Mobile stacks. */
.bm-sc-stage {
  display: grid;
  grid-template-columns: 1fr;
  min-height: 460px;
}
@media (min-width: 720px) {
  .bm-sc-stage {
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
}

.bm-sc-insights {
  position: relative;
  padding: 18px 18px 14px;
  background: ${C.cream};
  min-height: 340px;
  order: 2;
}
.bm-sc-calendar {
  padding: 18px;
  background: #fff;
  order: 1;
  border-bottom: 1px solid ${C.creamDeep};
}
@media (min-width: 720px) {
  .bm-sc-insights { order: 1; min-height: 460px; }
  .bm-sc-calendar { order: 2; border-bottom: none; border-left: 1px solid ${C.creamDeep}; }
}

/* ── Pillar card base. All three stack at the same spot.
   Visibility cycles via the master loop. ──────────────── */
.bm-sc-card {
  position: absolute;
  inset: 18px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  opacity: 0;
  transform: translateY(8px);
  will-change: opacity, transform;
  animation: bm-sc-card-fill var(--d) ease-in-out infinite;
}
.bm-sc-card--brief { animation-name: bm-sc-card-brief; }
.bm-sc-card--load  { animation-name: bm-sc-card-load; }

.bm-sc-card-eyebrow {
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
}
.bm-sc-card-title {
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
  color: ${C.ink};
  letter-spacing: -0.005em;
}
.bm-sc-card-body {
  display: flex; flex-direction: column; gap: 10px;
  flex: 1;
}

.bm-sc-mini-row {
  display: flex; align-items: center; gap: 10px;
}

/* ── Pillar 1 inner: reasons + draft + send ─────────── */
.bm-sc-reasons { display: flex; flex-direction: column; gap: 4px; }
.bm-sc-reason {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: ${C.ink}; line-height: 1.4;
  padding: 3px 0;
  opacity: 0;
  transform: translateX(-6px);
  animation: bm-sc-reason var(--d) ease-out infinite;
  animation-delay: calc(var(--bm-sc-r-i, 0) * 0.35s);
}
.bm-sc-draft {
  background: #fff;
  border: 1px dashed ${C.sageSoft};
  border-radius: 10px;
  padding: 9px 11px;
  font-family: Georgia, serif;
  font-style: italic;
  font-size: 11.5px;
  color: ${C.ink};
  line-height: 1.5;
  opacity: 0;
  animation: bm-sc-draft var(--d) ease-in-out infinite;
}
.bm-sc-send {
  background: ${C.forest};
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 12.5px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: default;
  opacity: 0;
  animation: bm-sc-send var(--d) ease-in-out infinite;
}

/* ── Pillar 2 inner: 3 briefing notes ───────────────── */
.bm-sc-notes {
  display: flex; flex-direction: column; gap: 8px;
}
.bm-sc-note {
  display: flex; align-items: flex-start; gap: 9px;
  background: #fff;
  border: 1px solid #BBF7D0;
  border-radius: 10px;
  padding: 8px 10px;
  opacity: 0;
  transform: translateX(-6px);
  animation: bm-sc-note var(--d) ease-out infinite;
  animation-delay: calc(var(--bm-sc-n-i, 0) * 0.35s);
}
.bm-sc-briefing-foot {
  margin-top: auto;
  font-family: Georgia, serif;
  font-style: italic;
  font-size: 11px;
  color: ${C.inkSoft};
  text-align: center;
  padding-top: 4px;
  opacity: 0;
  animation: bm-sc-brief-foot var(--d) ease-in-out infinite;
}

/* ── Pillar 3 inner: warning + 3 suggestions ────────── */
.bm-sc-load-warn {
  display: flex; align-items: flex-start; gap: 10px;
  background: ${C.amberSoft};
  border: 1px solid ${C.amber};
  border-radius: 10px;
  padding: 10px 12px;
  opacity: 0;
  animation: bm-sc-load-warn var(--d) ease-in-out infinite;
}
.bm-sc-suggest {
  display: flex; flex-direction: column; gap: 6px;
}
.bm-sc-suggest-row {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 4px 0;
  opacity: 0;
  transform: translateX(-6px);
  animation: bm-sc-suggest var(--d) ease-out infinite;
  animation-delay: calc(var(--bm-sc-s-i, 0) * 0.35s);
}
.bm-sc-load-foot {
  margin-top: auto;
  font-family: Georgia, serif;
  font-style: italic;
  font-size: 11px;
  color: ${C.inkSoft};
  text-align: center;
  padding-top: 4px;
  opacity: 0;
  animation: bm-sc-load-foot var(--d) ease-in-out infinite;
}

/* ── Calendar board ─────────────────────────────────── */
.bm-sc-cal-board { position: relative; }
.bm-sc-cal-toast {
  display: flex; align-items: center; gap: 8px;
  border-radius: 10px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 11.5px;
  font-weight: 600;
  opacity: 0;
}
.bm-sc-cal-toast--fill {
  background: ${C.amberSoft};
  border: 1px solid ${C.amber};
  color: ${C.amberDeep};
  animation: bm-sc-toast-fill var(--d) ease-in-out infinite;
}
.bm-sc-cal-toast--brief {
  background: #F0FDF4;
  border: 1px solid #86EFAC;
  color: #166534;
  position: absolute; top: 0; left: 0; right: 0;
  margin-bottom: 0;
  animation: bm-sc-toast-brief var(--d) ease-in-out infinite;
}
.bm-sc-cal-toast--load {
  background: ${C.redSoft};
  border: 1px solid ${C.rose};
  color: ${C.red};
  position: absolute; top: 0; left: 0; right: 0;
  margin-bottom: 0;
  animation: bm-sc-toast-load var(--d) ease-in-out infinite;
}

.bm-sc-cal-grid {
  display: grid;
  grid-template-columns: 50px 1fr;
  gap: 6px 8px;
  margin-top: 12px;
}
.bm-sc-cal-row {
  display: contents;
}
.bm-sc-cal-time {
  font-size: 11px; color: ${C.inkFade};
  font-family: Georgia, serif; font-style: italic;
  text-align: right;
  padding-top: 9px;
}
.bm-sc-cal-card {
  background: #FAFAF7;
  border: 1px solid ${C.creamDeep};
  border-left: 3px solid ${C.sageSoft};
  border-radius: 10px;
  padding: 8px 11px;
  display: flex; align-items: center; gap: 10px;
  position: relative;
  min-height: 36px;
}
.bm-sc-cal-row--buffer .bm-sc-cal-buffer {
  font-size: 10px;
  color: ${C.inkFade};
  font-family: Georgia, serif;
  font-style: italic;
  border-top: 1px dashed ${C.creamDeep};
  border-bottom: 1px dashed ${C.creamDeep};
  padding: 4px 12px;
  text-align: center;
}

/* Heavy session: red-rose accent strengthens during pillar 3 */
.bm-sc-cal-row.is-heavy .bm-sc-cal-card {
  animation: bm-sc-heavy-rail var(--d) ease-in-out infinite;
}
.bm-sc-cal-load-bar {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 3px;
  background: ${C.rose};
  border-radius: 0 0 8px 8px;
  transform: scaleX(0);
  transform-origin: left;
  animation: bm-sc-load-bar var(--d) ease-out infinite;
}

/* Focused row (Amy W. for pillar 2) */
.bm-sc-cal-row.is-focused .bm-sc-cal-card {
  animation: bm-sc-focused var(--d) ease-in-out infinite;
}
.bm-sc-cal-notes {
  display: inline-block;
  color: #16A34A;
  letter-spacing: 2px;
  font-size: 10px;
  opacity: 0;
  animation: bm-sc-notes var(--d) ease-in-out infinite;
}

/* Slot host with three layered states (empty / open / filled) */
.bm-sc-cal-slot-host {
  position: relative;
  min-height: 36px;
}
.bm-sc-cal-empty,
.bm-sc-cal-open,
.bm-sc-cal-filled {
  position: absolute; inset: 0;
  border-radius: 10px;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
}
.bm-sc-cal-open {
  background: ${C.roseSoft};
  border: 1.5px dashed ${C.rose};
  opacity: 0;
  animation: bm-sc-slot-open var(--d) ease-in-out infinite;
}
.bm-sc-cal-filled {
  background: ${C.sageBg};
  border: 1.5px solid ${C.sage};
  border-left: 3px solid ${C.sage};
  opacity: 0;
  animation: bm-sc-slot-filled var(--d) ease-in-out infinite;
}

/* ── Keyframes ─────────────────────────────────────────
   Loop = 15s. Pillar windows on 0/33/66.
   Plus a 2% fade between pillars so transitions feel
   intentional. */

/* LEFT card visibility */
@keyframes bm-sc-card-fill {
  0%, 1%  { opacity: 0; transform: translateY(8px); }
  3%, 30% { opacity: 1; transform: translateY(0); }
  33%     { opacity: 0; transform: translateY(-8px); }
  100%    { opacity: 0; }
}
@keyframes bm-sc-card-brief {
  0%, 33% { opacity: 0; transform: translateY(8px); }
  36%, 63% { opacity: 1; transform: translateY(0); }
  66%     { opacity: 0; transform: translateY(-8px); }
  100%    { opacity: 0; }
}
@keyframes bm-sc-card-load {
  0%, 66% { opacity: 0; transform: translateY(8px); }
  69%, 96% { opacity: 1; transform: translateY(0); }
  100%    { opacity: 0; transform: translateY(-4px); }
}

/* LEFT inner elements per pillar */
@keyframes bm-sc-reason {
  0%, 5%  { opacity: 0; transform: translateX(-6px); }
  10%, 30% { opacity: 1; transform: translateX(0); }
  33%, 100% { opacity: 0; }
}
@keyframes bm-sc-draft {
  0%, 18% { opacity: 0; transform: translateY(4px); }
  22%, 30% { opacity: 1; transform: translateY(0); }
  33%, 100% { opacity: 0; }
}
@keyframes bm-sc-send {
  0%, 23% { opacity: 0; transform: scale(0.96); }
  26%     { opacity: 1; transform: scale(1.05); box-shadow: 0 0 0 5px rgba(42, 87, 65, 0.20); }
  29%, 30% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 transparent; }
  33%, 100% { opacity: 0; }
}
@keyframes bm-sc-note {
  0%, 38% { opacity: 0; transform: translateX(-6px); }
  43%, 63% { opacity: 1; transform: translateX(0); }
  66%, 100% { opacity: 0; }
}
@keyframes bm-sc-brief-foot {
  0%, 55% { opacity: 0; }
  58%, 63% { opacity: 1; }
  66%, 100% { opacity: 0; }
}
@keyframes bm-sc-load-warn {
  0%, 68% { opacity: 0; transform: scale(0.96); }
  72%, 96% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; }
}
@keyframes bm-sc-suggest {
  0%, 72% { opacity: 0; transform: translateX(-6px); }
  78%, 96% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; }
}
@keyframes bm-sc-load-foot {
  0%, 88% { opacity: 0; }
  92%, 96% { opacity: 1; }
  100% { opacity: 0; }
}

/* RIGHT calendar toasts per pillar */
@keyframes bm-sc-toast-fill {
  0%, 1%  { opacity: 0; transform: translateY(-6px); }
  4%, 30% { opacity: 1; transform: translateY(0); }
  33%, 100% { opacity: 0; transform: translateY(-4px); }
}
@keyframes bm-sc-toast-brief {
  0%, 34% { opacity: 0; transform: translateY(-6px); }
  38%, 63% { opacity: 1; transform: translateY(0); }
  66%, 100% { opacity: 0; transform: translateY(-4px); }
}
@keyframes bm-sc-toast-load {
  0%, 67% { opacity: 0; transform: translateY(-6px); }
  71%, 96% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-4px); }
}

/* RIGHT noon slot states */
@keyframes bm-sc-slot-open {
  0%, 4%   { opacity: 0; box-shadow: 0 0 0 0 rgba(199, 123, 138, 0); }
  7%, 22%  { opacity: 1; box-shadow: 0 0 0 0 rgba(199, 123, 138, 0.4); }
  14%      { box-shadow: 0 0 0 6px rgba(199, 123, 138, 0); }
  25%, 100% { opacity: 0; }
}
@keyframes bm-sc-slot-filled {
  0%, 25%  { opacity: 0; transform: scale(0.96); }
  29%      { opacity: 1; transform: scale(1.03); }
  31%, 100% { opacity: 1; transform: scale(1); }
}

/* RIGHT heavy rows: red-rose left rail during pillar 3 */
@keyframes bm-sc-heavy-rail {
  0%, 70% { border-left-color: ${C.sageSoft}; background: #FAFAF7; }
  75%, 96% { border-left-color: ${C.rose}; background: ${C.redSoft}; }
  100% { border-left-color: ${C.sageSoft}; background: #FAFAF7; }
}
@keyframes bm-sc-load-bar {
  0%, 74% { transform: scaleX(0); }
  80%, 96% { transform: scaleX(1); }
  100% { transform: scaleX(0); }
}

/* RIGHT Amy row focus during pillar 2 */
@keyframes bm-sc-focused {
  0%, 37% { box-shadow: 0 0 0 0 rgba(22, 101, 52, 0); border-color: ${C.creamDeep}; }
  42%, 60% { box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.18); border-color: #BBF7D0; }
  65%, 100% { box-shadow: 0 0 0 0 rgba(22, 101, 52, 0); border-color: ${C.creamDeep}; }
}
@keyframes bm-sc-notes {
  0%, 42% { opacity: 0; }
  47%, 60% { opacity: 1; }
  65%, 100% { opacity: 0; }
}

/* ── Reduced motion ─────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .bm-sc-pulse-dot { animation: none; }
  .bm-sc-card,
  .bm-sc-reason, .bm-sc-draft, .bm-sc-send,
  .bm-sc-note, .bm-sc-briefing-foot,
  .bm-sc-load-warn, .bm-sc-suggest-row, .bm-sc-load-foot,
  .bm-sc-cal-toast--fill, .bm-sc-cal-toast--brief, .bm-sc-cal-toast--load,
  .bm-sc-cal-open, .bm-sc-cal-filled,
  .bm-sc-cal-row.is-heavy .bm-sc-cal-card,
  .bm-sc-cal-row.is-focused .bm-sc-cal-card,
  .bm-sc-cal-notes,
  .bm-sc-cal-load-bar
  { animation: none !important; }
  .bm-sc-card { opacity: 0; transform: none; }
  .bm-sc-card--load { opacity: 1; }
  .bm-sc-card--load .bm-sc-load-warn,
  .bm-sc-card--load .bm-sc-suggest-row,
  .bm-sc-card--load .bm-sc-load-foot { opacity: 1; transform: none; }
  .bm-sc-cal-toast--load { opacity: 1; transform: none; }
  .bm-sc-cal-filled { opacity: 1; transform: none; }
  .bm-sc-cal-row.is-heavy .bm-sc-cal-card {
    border-left-color: ${C.rose};
    background: ${C.redSoft};
  }
  .bm-sc-cal-load-bar { transform: scaleX(1); }
}
`;
