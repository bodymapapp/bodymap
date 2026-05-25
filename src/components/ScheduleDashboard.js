import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import BookingModal from './BookingModal';
import CancellationChargeModal from './CancellationChargeModal';
import SmartBookingRail from './schedule/SmartBookingRail';
import InlineTimeInput from './InlineTimeInput';
import CloseButton from './CloseButton';
import CheckoutModal from './CheckoutModal';
// MarkAsPaidModal deleted in Phase 19 (May 18 2026). Functionality
// folded into CheckoutModal's offline payment path. See commit history.
import RefundModal from './RefundModal';
import BodyDiagram from './BodyDiagram';
import { zoneLabel, zonesToBodyDiagram, pressureLabel, goalLabel, preferenceLabel } from '../lib/bodyZones';

const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const sameDay = (a,b) => a.toDateString()===b.toDateString();
const fmt12 = t => { if(!t) return ''; const [h,m]=t.toString().split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const fmtDay = d => d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
const fmtShort = d => d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const fmtMonth = d => d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
const initials = n => n?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?';
const COLORS = ['#2A5741','#3B6B8A','#7B5EA7','#C05621','#276749','#2C5282'];
const ac = n => COLORS[(n?.charCodeAt(0)||0)%COLORS.length];
const t2m = t => { if(!t) return 0; const m=t.match(/(\d+):(\d+)\s*(AM|PM)/i); if(!m) return 0; let h=parseInt(m[1]),mn=parseInt(m[2]); if(m[3].toUpperCase()==='PM'&&h!==12)h+=12; if(m[3].toUpperCase()==='AM'&&h===12)h=0; return h*60+mn; };
const getToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

const STATUS = {
  'intake-done':    {label:'Brief Ready', bg:'#DCFCE7', color:'#16A34A', dot:'#16A34A', icon:'🧭'},
  'pending-intake': {label:'No Intake',   bg:'#FEF3C7', color:'#D97706', dot:'#F59E0B', icon:'📋'},
  'complete':       {label:'Complete',    bg:'#F3F4F6', color:'#6B7280', dot:'#9CA3AF', icon:'✓'},
  'external':       {label:'From Google', bg:'#EFEAFD', color:'#5B4DC8', dot:'#7F77DD', icon:'📅'},
};

const makeSample = (today) => [
  {id:'s1',client:'Emma R.',   time:'9:00 AM', duration:60,date:addDays(today,0),status:'intake-done',   sessions:4, preview:true,service:'Swedish Massage',focus:[],notes:'Prefers quiet session'},
  {id:'s2',client:'Jess M.',   time:'10:30 AM',duration:90,date:addDays(today,0),status:'pending-intake',sessions:1, preview:true,service:'Deep Tissue',    focus:[],notes:''},
  {id:'s3',client:'Maria L.',  time:'2:00 PM', duration:60,date:addDays(today,0),status:'complete',      sessions:12,preview:true,service:'Hot Stone',      focus:[],notes:'Monthly regular'},
  {id:'s4',client:'Dana P.',   time:'9:00 AM', duration:90,date:addDays(today,1),status:'pending-intake',sessions:3, preview:true,service:'Swedish Massage',focus:[],notes:''},
  {id:'s5',client:'Amy W.',    time:'11:00 AM',duration:60,date:addDays(today,1),status:'intake-done',   sessions:5, preview:true,service:'Sports Massage', focus:[],notes:'Runner'},
  {id:'s6',client:'Emma R.',   time:'9:00 AM', duration:60,date:addDays(today,3),status:'pending-intake',sessions:5, preview:true,service:'Swedish Massage',focus:[],notes:''},
  {id:'s7',client:'Jess M.',   time:'3:00 PM', duration:60,date:addDays(today,4),status:'pending-intake',sessions:2, preview:true,service:'Deep Tissue',    focus:[],notes:''},
];

// ═════════════════════════════════════════════════════════════════
// Cockpit section helpers (HK May 25 2026, Phase 20)
// Shared building blocks for the slide-over redesign: collapsible
// section card, body-map preview, last-session summary, patterns
// readout, and inline SOAP/recap editors.
// ═════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════
// Slide-over design tokens (HK May 25 2026, Phase 24 world-class).
// Reduces 4 competing typographic levels, 3+ spacing values, and 4
// button variants into a single coherent system. Every new cockpit
// element MUST use these tokens. Outside the cockpit, components can
// still use their own scales (this is local to the slide-over).
// ═════════════════════════════════════════════════════════════════
const SO = {
  // Spacing scale (matches Tailwind 1 / 2 / 3 / 4 / 6 multiples for
  // future migration). Use only these values for padding and gap.
  spaceXs: 4,
  spaceSm: 8,
  spaceMd: 12,
  spaceLg: 16,
  spaceXl: 24,

  // Typography (3 levels, no more). 14px baseline.
  titleSize: 15,
  titleWeight: 700,
  labelSize: 11,
  labelWeight: 700,
  labelTracking: '0.06em',
  bodySize: 13,
  bodyWeight: 500,
  bodyLine: 1.55,

  // Color palette. Pulled together from disparate hex values across
  // the cockpit. Anything not in here should not appear in the
  // slide-over.
  ink:     '#1F2937',
  inkMute: '#6B7280',
  inkSoft: '#9CA3AF',
  border:  '#E5DDD2',
  card:    '#fff',
  cream:   '#FCF8EE',
  creamHi: '#F8F2E5',
  forest:  '#2A5741',
  sage:    '#6B9E80',
  sageBg:  '#EEF3EE',
  warn:    '#92400E',
  warnBg:  '#FEF3C7',
  warnBorder: '#FDE68A',
  ok:      '#15803D',
  okBg:    '#DCFCE7',
  okBorder: '#BBF7D0',
};

// Two button variants only. Anywhere else in the slide-over that
// renders a button must use one of these.
const btnPrimary = {
  background: SO.forest,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.005em',
};
const btnSecondary = {
  background: '#fff',
  color: SO.forest,
  border: '1.5px solid #D6E0D4',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

// Unified empty-state / locked-state pattern. Soft cream card with
// dashed border, icon, copy, optional CTA. Used for: pending-intake
// (client hasn't filled intake yet), future-session lock, no-history
// (returning client has no prior sessions visible), and any other
// 'intentionally not here yet' state. Reads as 'this is fine,
// nothing's broken' rather than 'something failed.'
function EmptyStateCard({ icon, title, body, cta, ctaLabel }) {
  return (
    <div style={{
      background: SO.cream,
      border: `1px dashed #D6CDB8`,
      borderRadius: 10,
      padding: '14px 14px',
      textAlign: 'left',
    }}>
      <div style={{
        fontSize: SO.bodySize,
        color: '#5B4F3A',
        lineHeight: SO.bodyLine,
        marginBottom: cta ? 10 : 0,
      }}>
        {icon ? <span style={{ marginRight: 6 }}>{icon}</span> : null}
        {title && <strong style={{ color: SO.ink, fontWeight: 700 }}>{title}{body ? ': ' : ''}</strong>}
        {body}
      </div>
      {cta && (
        <button type="button" onClick={cta} style={{
          background: 'transparent',
          color: '#6B5B3A',
          border: '1px solid #D6CDB8',
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// SVG chevron used in CockpitSection. Stroke-weighted, rotates
// smoothly on open. Replaces the prior ▾ unicode triangle which
// was thin and read as a decorative glyph rather than a control.
function ChevronIcon({ open, color = '#fff' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      aria-hidden="true"
    >
      <polyline points="3 5 7 9 11 5" />
    </svg>
  );
}

function CockpitSection({ sectionKey, icon, title, subtitle, isOpen, onToggle, warn = false, children }) {
  // HK May 25 2026 (Phase 22): visual upgrade for collapsibles.
  // Previously the row looked indistinguishable from a heading.
  // Now: collapsed state gets a soft cream tint that reads as
  // 'tap me'; expanded state goes white. Hover lifts subtly on
  // desktop. SVG chevron replaces unicode triangle. The pill
  // background colors come from the Billing DeepDiveCard pattern.
  const [hover, setHover] = useState(false);
  const cardBg = warn
    ? '#FFFBEB'
    : isOpen
      ? '#fff'
      : (hover ? '#F8F2E5' : '#FCF8EE');
  const borderColor = warn ? '#FDE68A' : isOpen ? '#D6E0D4' : '#E5DDD2';

  return (
    <div
      data-cockpit-section={sectionKey}
      style={{
        background: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        boxShadow: isOpen ? '0 2px 6px rgba(28,43,34,0.04)' : (hover ? '0 1px 3px rgba(28,43,34,0.05)' : 'none'),
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-expanded={isOpen}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: isOpen ? '#EEF3EE' : '#F0E7D4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
          transition: 'background 0.18s ease',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: '#1F2937',
            lineHeight: 1.3,
            letterSpacing: '-0.005em',
          }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 1.4 }}>{subtitle}</div>}
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: isOpen ? '#2A5741' : '#EEF3EE',
          color: isOpen ? '#fff' : '#2A5741',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.22s ease, box-shadow 0.22s ease',
          boxShadow: isOpen ? '0 2px 6px rgba(42,87,65,0.20)' : 'none',
        }}>
          <ChevronIcon open={isOpen} color={isOpen ? '#fff' : '#2A5741'} />
        </div>
      </button>
      {isOpen && (
        <div style={{ padding: '0 16px 16px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// Locked state shown inside Record + Recap panels when the
// appointment is in the future. Reuses the unified EmptyStateCard
// pattern so the visual language is consistent with other 'not yet'
// states across the cockpit.
function LockedFutureSessionPanel({ apptDate, onOverride, kind }) {
  const friendlyDate = apptDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) || 'a future date';
  const copy = kind === 'recap'
    ? `Recap goes out after the session. This session is ${friendlyDate}, so the message field unlocks then.`
    : `Session notes go in after the session. This session is ${friendlyDate}, so the record unlocks then.`;
  return (
    <EmptyStateCard
      icon="🔒"
      body={copy}
      cta={onOverride}
      ctaLabel="I'm starting now, unlock this"
    />
  );
}

function BodyMapPreview({ session }) {
  // HK May 25 2026 (Phase 21 polish): body map is the differentiation.
  // Previously hidden behind a 'show body map' toggle and only rendered
  // one silhouette. Now: BOTH silhouettes (front + back) side by side,
  // visible by default, with distribution bar above when the client
  // filled in their front_pct / top_pct / middle_pct / bottom_pct.
  // No more tiny ▸ chevron; this is hero content for the cockpit.
  if (!session) return null;
  const focusZones = [...(session.front_focus || []), ...(session.back_focus || [])];
  const avoidZones = [...(session.front_avoid || []), ...(session.back_avoid || [])];
  const hasZones = focusZones.length || avoidZones.length;
  if (!hasZones) return null;
  const focusMapped = zonesToBodyDiagram(focusZones);
  const avoidMapped = zonesToBodyDiagram(avoidZones);
  // Distribution percentages from intake (Lindsey #4 follow-up
  // pattern: front_pct + top/middle/bottom on the back). Only
  // render the bar when AT LEAST one is present and meaningful.
  const hasFrontDist = typeof session.front_pct === 'number';
  const hasBackDist = ['top_pct', 'middle_pct', 'bottom_pct'].some(k => typeof session[k] === 'number');
  return (
    <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 14, paddingTop: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#6B7280',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
      }}>
        Body map
      </div>

      {/* Front + Back side by side. Each silhouette gets its own
          column with a 'Front' or 'Back' label above. zonesToBodyDiagram
          gave us frontIds and backIds separately, so we can render
          each silhouette with ONLY the matching zones. */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Front
          </div>
          <BodyDiagram
            focusAreas={focusMapped.frontIds}
            avoidAreas={avoidMapped.frontIds}
            size="md"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Back
          </div>
          <BodyDiagram
            focusAreas={focusMapped.backIds}
            avoidAreas={avoidMapped.backIds}
            size="md"
          />
        </div>
      </div>

      {/* Distribution bars: front percent of total, then back's
          top/middle/bottom split. The client filled these in during
          intake when they cared about exactly where to spend time. */}
      {(hasFrontDist || hasBackDist) && (
        <div style={{ background: '#FAFAF7', borderRadius: 10, padding: '10px 12px', marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Time distribution
          </div>
          {hasFrontDist && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hasBackDist ? 6 : 0 }}>
              <div style={{ fontSize: 12, color: '#374151', minWidth: 64 }}>Front</div>
              <div style={{ flex: 1, height: 8, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${session.front_pct}%`, height: '100%', background: '#2A5741' }} />
              </div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                {session.front_pct}%
              </div>
            </div>
          )}
          {hasBackDist && (
            <>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, marginTop: hasFrontDist ? 6 : 0 }}>
                Back: top / middle / bottom
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 8, borderRadius: 999, overflow: 'hidden', background: '#E5E7EB' }}>
                {typeof session.top_pct === 'number' && session.top_pct > 0 && (
                  <div style={{ flex: session.top_pct, background: '#4B8A6A', height: '100%' }} title={`Top ${session.top_pct}%`} />
                )}
                {typeof session.middle_pct === 'number' && session.middle_pct > 0 && (
                  <div style={{ flex: session.middle_pct, background: '#2A5741', height: '100%' }} title={`Middle ${session.middle_pct}%`} />
                )}
                {typeof session.bottom_pct === 'number' && session.bottom_pct > 0 && (
                  <div style={{ flex: session.bottom_pct, background: '#1F4030', height: '100%' }} title={`Bottom ${session.bottom_pct}%`} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                <span>Top {session.top_pct || 0}%</span>
                <span>Middle {session.middle_pct || 0}%</span>
                <span>Bottom {session.bottom_pct || 0}%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LastSessionContent({ session }) {
  let soap = { S: '', O: '', A: '', P: '', noteToClient: '' };
  let isLegacy = false;
  try {
    const p = JSON.parse(session.therapist_notes || '');
    if (p && p.__soap) soap = p;
  } catch (_) { isLegacy = true; }
  const hasSoap = !!(soap.S || soap.O || soap.A || soap.P);
  const focusZones = [...(session.front_focus || []), ...(session.back_focus || [])];
  return (
    <div>
      {focusZones.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Focused on</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
            {focusZones.map(z => zoneLabel(z)).join(', ')}
          </div>
        </div>
      )}
      {hasSoap && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Your notes (Plan)</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
            {soap.P || soap.A || soap.O || soap.S || ''}
          </div>
        </div>
      )}
      {isLegacy && session.therapist_notes && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Your notes</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
            {session.therapist_notes}
          </div>
        </div>
      )}
    </div>
  );
}

function PatternsContent({ allSessions }) {
  // Compute zone frequency, pressure trend, cadence, conditions
  const zoneCount = {};
  const pressures = [];
  const dates = [];
  allSessions.forEach(s => {
    (s.front_focus || []).forEach(z => { zoneCount[z] = (zoneCount[z] || 0) + 1; });
    (s.back_focus  || []).forEach(z => { zoneCount[z] = (zoneCount[z] || 0) + 1; });
    if (s.pressure) pressures.push(s.pressure);
    if (s.created_at) dates.push(new Date(s.created_at));
  });
  const topZones = Object.entries(zoneCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const avgPressure = pressures.length ? Math.round(pressures.reduce((a, b) => a + b, 0) / pressures.length * 10) / 10 : null;
  let avgGap = null;
  if (dates.length >= 2) {
    const sorted = dates.slice().sort((a, b) => b.getTime() - a.getTime());
    const gaps = [];
    for (let i = 1; i < Math.min(sorted.length, 6); i++) {
      gaps.push((sorted[i - 1].getTime() - sorted[i].getTime()) / 86400000);
    }
    if (gaps.length) avgGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }
  return (
    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>
      {topZones.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <strong>Recurring focus:</strong> {topZones.map(([z, n]) => `${zoneLabel(z)} (${n}×)`).join(', ')}
        </div>
      )}
      {avgPressure && (
        <div style={{ marginBottom: 10 }}>
          <strong>Avg pressure preference:</strong> {avgPressure}/5 ({pressureLabel(Math.round(avgPressure))})
        </div>
      )}
      {avgGap && (
        <div style={{ marginBottom: 10 }}>
          <strong>Cadence:</strong> ~{avgGap} days between visits
        </div>
      )}
    </div>
  );
}

function RecordEditor({ session, parsedSoap, onSaved, therapist, allSessions }) {
  // HK May 25 2026 (Phase 21): restored the prior 'therapist's
  // private notes' field that was distinct from SOAP. Free-form
  // scratchpad that lives ALONGSIDE structured SOAP fields, not
  // instead of them. Therapist who wants a quick note types here;
  // therapist who wants full clinical documentation fills SOAP.
  // Both can be filled. Saves to:
  //   - therapist_notes JSON with __soap=true: { S, O, A, P, private, noteToClient }
  //
  // Also added the dictation nudge from SessionDetail page and a
  // 'Draft with practice assistant' button (no "AI" wording).
  const [privateNotes, setPrivateNotes] = useState(parsedSoap.private || (parsedSoap.isLegacy ? parsedSoap.legacyText : '') || '');
  const [S, setS] = useState(parsedSoap.S || '');
  const [O, setO] = useState(parsedSoap.O || '');
  const [A, setA] = useState(parsedSoap.A || '');
  const [P, setP] = useState(parsedSoap.P || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState(null);

  useEffect(() => {
    setPrivateNotes(parsedSoap.private || (parsedSoap.isLegacy ? parsedSoap.legacyText : '') || '');
    setS(parsedSoap.S || ''); setO(parsedSoap.O || ''); setA(parsedSoap.A || ''); setP(parsedSoap.P || '');
  }, [parsedSoap.private, parsedSoap.S, parsedSoap.O, parsedSoap.A, parsedSoap.P, parsedSoap.isLegacy, parsedSoap.legacyText]);

  async function save() {
    if (!session?.id) return;
    setSaving(true);
    const payload = {
      __soap: true,
      private: privateNotes,
      S, O, A, P,
      noteToClient: parsedSoap.noteToClient || '',
    };
    await supabase
      .from('sessions')
      .update({ therapist_notes: JSON.stringify(payload), completed: true })
      .eq('id', session.id);
    setSaving(false);
    setSavedAt(new Date());
    if (onSaved) onSaved();
  }

  async function draftSoap() {
    if (!session?.id || !therapist?.ai_enabled) {
      setDraftError("Practice assistant is off. Turn it on in Settings.");
      setTimeout(() => setDraftError(null), 4000);
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error("Not signed in");
      const lastCompleted = (allSessions || []).find(h => h.id !== session.id && h.completed);
      const lastVisit = lastCompleted ? {
        daysAgo: Math.round((new Date(session.created_at) - new Date(lastCompleted.created_at)) / (1000 * 60 * 60 * 24)),
        pressure: lastCompleted.pressure,
        focus: [...(lastCompleted.front_focus || []), ...(lastCompleted.back_focus || [])].slice(0, 4).join(", "),
      } : null;
      const sessionData = {
        session: {
          pressure: session.pressure, goal: session.goal,
          front_focus: session.front_focus, back_focus: session.back_focus,
          front_avoid: session.front_avoid, back_avoid: session.back_avoid,
          client_notes: session.client_notes,
        },
        client: { name: 'client' },
        soap: { S, O, A, P },
        lastVisit,
      };
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/bodymap-ai`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ mode: "draft-note", kind: "private", sessionData }),
      });
      const data = await response.json();
      if (!response.ok) {
        setDraftError(data.error || data.message || "Could not draft notes. Try again.");
        setTimeout(() => setDraftError(null), 5500);
        return;
      }
      const text = data.draft || "";
      setPrivateNotes(text);
    } catch (err) {
      setDraftError(err.message || "Could not draft notes. Try again.");
      setTimeout(() => setDraftError(null), 5500);
    } finally {
      setDrafting(false);
    }
  }

  const fieldStyle = {
    width: '100%',
    minHeight: 56,
    padding: '10px 12px',
    border: '1px solid #E5DDD2',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.55,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    background: '#FAFAF7',
    marginBottom: 10,
  };

  return (
    <div>
      {/* Narration nudge - the dictate tip lives at the top so the
          70yo therapist sees it before staring at a blank field. */}
      <div style={{
        fontSize: 12, color: '#2A5741', background: '#F4F6F2',
        border: '1px solid #D6E0D4', borderRadius: 8,
        padding: '8px 12px', marginBottom: 14, lineHeight: 1.5,
      }}>
        🎙️ Tap the microphone on your keyboard to dictate any field below. Speak it, we'll write it.
      </div>

      {/* HK May 25 2026 (Phase 22): SOAP fields come FIRST. Private
          notes is a summary the practice assistant can draft from
          the SOAP content, so the input has to exist before the
          summary. Order: dictation nudge → SOAP → private notes
          (draftable) → save. */}

      {/* SOAP fields - structured clinical documentation. */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#9CA3AF',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ height: 1, background: '#E5DDD2', flex: 1 }} />
        <span>SOAP record</span>
        <span style={{ height: 1, background: '#E5DDD2', flex: 1 }} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>S, Subjective</div>
      <textarea value={S} onChange={e => setS(e.target.value)} placeholder="What the client reports: pain, history, what they want" style={fieldStyle} />
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>O, Objective</div>
      <textarea value={O} onChange={e => setO(e.target.value)} placeholder="What you observed: range of motion, tissue, posture" style={fieldStyle} />
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>A, Assessment</div>
      <textarea value={A} onChange={e => setA(e.target.value)} placeholder="Your professional read on the situation" style={fieldStyle} />
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>P, Plan</div>
      <textarea value={P} onChange={e => setP(e.target.value)} placeholder="What you did this session and what comes next" style={fieldStyle} />

      {/* Therapist's private notes - SUMMARY of the SOAP work above.
          Practice assistant can draft from the SOAP fields when
          requested. Lives BELOW SOAP because the summary depends
          on the source. */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#9CA3AF',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        marginTop: 8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ height: 1, background: '#E5DDD2', flex: 1 }} />
        <span>Your private summary</span>
        <span style={{ height: 1, background: '#E5DDD2', flex: 1 }} />
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#6B7280',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Private notes (a quick summary for yourself)</span>
        {therapist?.ai_enabled !== false && (
          <button
            type="button"
            onClick={draftSoap}
            disabled={drafting}
            style={{
              background: drafting ? '#E5DDD2' : '#fff',
              border: '1px solid #D6E0D4',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#2A5741',
              cursor: drafting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            {drafting ? 'Drafting...' : '✨ Draft from SOAP'}
          </button>
        )}
      </div>
      <textarea
        value={privateNotes}
        onChange={e => setPrivateNotes(e.target.value)}
        placeholder="Quick note for yourself: what you worked on, what to remember next time. Tap 'Draft from SOAP' to have the practice assistant write a summary."
        style={{ ...fieldStyle, minHeight: 72 }}
      />
      {draftError && (
        <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 10, marginTop: -4 }}>
          {draftError}
        </div>
      )}
      {parsedSoap.isLegacy && parsedSoap.legacyText && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#78350F', marginBottom: 10 }}>
          Older free-form notes loaded into the private summary above. Re-save to keep them in the new format.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: saving ? '#9CA3AF' : '#2A5741',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Save session record'}
        </button>
        {savedAt && (
          <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>
            ✓ Saved at {savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}

function RecapEditor({ session, parsedSoap, therapist, allSessions, onSaved, onRebook }) {
  // HK May 25 2026 (Phase 21): three upgrades to the recap.
  // A1: Save Recap actually FIRES the email to the client via the
  //     send-post-session edge function (which reads public_notes
  //     and emails it). Therapist sees "Recap sent" confirmation.
  // E:  Dictation nudge + 'Draft with practice assistant' button
  //     (no AI wording). Reuses the bodymap-ai edge function in
  //     'client' kind so it generates a warm note instead of
  //     clinical SOAP language.
  // G3: 'Book next session' button right inside this panel so the
  //     therapist can close the loop in one screen (also present
  //     in the bottom Actions row per G3).
  const initial = parsedSoap.noteToClient || session?.public_notes || '';
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [sentAt, setSentAt] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState(null);

  useEffect(() => { setText(parsedSoap.noteToClient || session?.public_notes || ''); }, [parsedSoap.noteToClient, session?.public_notes]);

  async function save() {
    if (!session?.id) return;
    setSaving(true);
    setSendError(null);
    let payload;
    try {
      const existing = JSON.parse(session.therapist_notes || '{}');
      if (existing && existing.__soap) {
        payload = { ...existing, noteToClient: text };
      } else {
        payload = { __soap: true, S: '', O: '', A: '', P: '', noteToClient: text };
      }
    } catch (_) {
      payload = { __soap: true, S: '', O: '', A: '', P: '', noteToClient: text };
    }
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ therapist_notes: JSON.stringify(payload), public_notes: text })
      .eq('id', session.id);
    if (updateError) {
      setSaving(false);
      setSendError('Could not save recap: ' + updateError.message);
      return;
    }
    setSavedAt(new Date());

    // A1: fire send-post-session. The edge function reads
    // public_notes from the session row, builds a warm HTML email
    // with the therapist's branding, sends via Resend, and logs
    // to notification_log. If the therapist toggled post_session
    // notifications off, the function returns skipped (still 200).
    setSendingEmail(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error("Not signed in");
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/send-post-session`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ session_id: session.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSendError(data?.error || `Saved, but email failed (HTTP ${response.status}). Try again or it will go in the next batch.`);
      } else if (data?.skipped) {
        // Therapist disabled post-session notifications. Saved is
        // still a success; we just tell them no email went.
        setSentAt(null);
      } else {
        setSentAt(new Date());
      }
    } catch (err) {
      setSendError('Saved, but email could not be sent: ' + (err?.message || 'Try again.'));
    } finally {
      setSendingEmail(false);
      setSaving(false);
      if (onSaved) onSaved();
    }
  }

  async function draftRecap() {
    if (!session?.id || therapist?.ai_enabled === false) {
      setDraftError("Practice assistant is off. Turn it on in Settings.");
      setTimeout(() => setDraftError(null), 4000);
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error("Not signed in");
      const lastCompleted = (allSessions || []).find(h => h.id !== session.id && h.completed);
      const lastVisit = lastCompleted ? {
        daysAgo: Math.round((new Date(session.created_at) - new Date(lastCompleted.created_at)) / (1000 * 60 * 60 * 24)),
        pressure: lastCompleted.pressure,
        focus: [...(lastCompleted.front_focus || []), ...(lastCompleted.back_focus || [])].slice(0, 4).join(", "),
      } : null;
      const sessionData = {
        session: {
          pressure: session.pressure, goal: session.goal,
          front_focus: session.front_focus, back_focus: session.back_focus,
          front_avoid: session.front_avoid, back_avoid: session.back_avoid,
          client_notes: session.client_notes,
        },
        client: { name: 'client' },
        soap: { S: parsedSoap.S, O: parsedSoap.O, A: parsedSoap.A, P: parsedSoap.P },
        lastVisit,
      };
      const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/bodymap-ai`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ mode: "draft-note", kind: "client", sessionData }),
      });
      const data = await response.json();
      if (!response.ok) {
        setDraftError(data?.error || data?.message || "Could not draft. Try again.");
        setTimeout(() => setDraftError(null), 5500);
        return;
      }
      setText(data?.draft || "");
    } catch (err) {
      setDraftError(err.message || "Could not draft. Try again.");
      setTimeout(() => setDraftError(null), 5500);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#2A5741', background: '#F4F6F2', border: '1px solid #D6E0D4', borderRadius: 8, padding: '8px 12px', marginBottom: 12, lineHeight: 1.5 }}>
        🎙️ Tap the microphone on your keyboard to dictate. Speak it, we'll write it.
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 8 }}>
        A warm note your client receives by email after this session. Keep it short, kind, forward-looking.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Message to client
        </div>
        {therapist?.ai_enabled !== false && (
          <button
            type="button"
            onClick={draftRecap}
            disabled={drafting}
            style={{
              background: drafting ? '#E5DDD2' : '#fff',
              border: '1px solid #D6E0D4',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#2A5741',
              cursor: drafting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {drafting ? 'Drafting...' : '✨ Draft with practice assistant'}
          </button>
        )}
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Thanks for coming in today. I worked on your right shoulder and gave you a doorway stretch to take home..."
        style={{
          width: '100%',
          minHeight: 120,
          padding: '10px 12px',
          border: '1px solid #E5DDD2',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily: 'inherit',
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
          background: '#FAFAF7',
          marginBottom: 10,
        }}
      />
      {draftError && (
        <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 10, marginTop: -4 }}>
          {draftError}
        </div>
      )}
      {sendError && (
        <div style={{ fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
          {sendError}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={save}
          disabled={saving || sendingEmail}
          style={{
            background: (saving || sendingEmail) ? '#9CA3AF' : '#2A5741',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: (saving || sendingEmail) ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {sendingEmail ? 'Sending email...' : saving ? 'Saving...' : '💌 Save & send recap'}
        </button>
        {onRebook && (
          <button
            onClick={onRebook}
            style={{
              background: '#fff',
              color: '#2A5741',
              border: '1.5px solid #D6E0D4',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            📅 Book next session
          </button>
        )}
        {sentAt && (
          <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>
            ✓ Sent at {sentAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
        {savedAt && !sentAt && !sendingEmail && !sendError && (
          <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>
            ✓ Saved at {savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ appt, therapist, onClose, onReschedule, onCancelled }) {
  // HK May 24 2026 (Phase 13.12b): the appt prop is owned by the
  // parent timeline. When the user picks a client via the inline
  // ClientPicker inside CheckoutModal, the database row updates but
  // the appt prop does NOT refresh until the timeline refetches.
  // displayAppt is a local mirror of appt that we patch immediately
  // when a client is linked, so the slide-over header re-renders
  // with the picked client's name without waiting for a parent
  // refresh. The parent schedule grid still shows the old name
  // until its own refetch fires, but that surface refreshes
  // naturally on the next interaction.
  const [displayAppt, setDisplayAppt] = useState(appt);
  useEffect(() => { setDisplayAppt(appt); }, [appt]);

  const st = STATUS[displayAppt.status]||STATUS['pending-intake'];
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const [copied,setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editTime, setEditTime] = useState(false);
  const [newStartTime, setNewStartTime] = useState(appt.startTime || '');
  const [newEndTime, setNewEndTime] = useState(appt.endTime || '');
  const [savingTime, setSavingTime] = useState(false);
  // Phase 12: Checkout modal. Phase 19 (May 18 2026) folded MarkAsPaid
  // into the same modal so there is now just one charge modal.
  const [showCheckout, setShowCheckout] = useState(false);
  // Phase 14.3b (HK May 17 2026): in-app refund. refundTarget holds
  // the session_payments row to be refunded; setting it null closes
  // the modal.
  const [refundTarget, setRefundTarget] = useState(null);
  const [paymentRows, setPaymentRows] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [clientRow, setClientRow] = useState(null);
  const firstName = appt.client?.split(' ')[0];
  const intakeLink = `${intakeUrl}?name=${encodeURIComponent(appt.client)}&email=${encodeURIComponent(appt.email)}&booking_id=${appt.id}`;

  // Load existing payments for this booking + the client row (for
  // card-on-file and id passing to the modals).
  useEffect(() => {
    if (!appt?.id || appt?.preview) { setPaymentsLoading(false); return; }
    let alive = true;
    (async () => {
      const { data: payments } = await supabase
        .from('session_payments')
        .select('id, amount_cents, tip_cents, payment_method, payment_method_detail, status, paid_at')
        .eq('booking_id', appt.id)
        .order('created_at', { ascending: true });
      if (!alive) return;
      setPaymentRows(payments || []);
      setPaymentsLoading(false);
      if (appt.clientId) {
        const { data: c } = await supabase.from('clients').select('*').eq('id', appt.clientId).single();
        if (alive) setClientRow(c);
      }
    })();
    return () => { alive = false; };
  }, [appt?.id, appt?.clientId, appt?.preview]);

  // Refresh payments after a successful checkout / mark-as-paid
  async function refreshPayments() {
    const { data } = await supabase
      .from('session_payments')
      .select('id, amount_cents, tip_cents, payment_method, payment_method_detail, status, paid_at')
      .eq('booking_id', appt.id)
      .order('created_at', { ascending: true });
    setPaymentRows(data || []);
  }

  // ─── Cockpit data: intake, last session, patterns, medical flags ───
  // HK May 25 2026 (Phase 20 cockpit redesign): the slide-over is the
  // therapist's workspace before, during, and after a session. We load
  // EVERYTHING this client's session prep needs in one effect so the
  // sections below render without separate fetches each.
  //
  // What we load:
  //   - currentSession: the sessions row for this booking (intake data
  //     the CLIENT submitted: focus zones, pressure, preferences,
  //     conditions, notes). Same row the SOAP fields write to.
  //   - lastSession: the most recent OTHER session for this client
  //     (returning-client context: what did we work on last time).
  //   - allSessions: full history for pattern detection (zone
  //     frequency, pressure trend, cadence).
  const [currentSession, setCurrentSession] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [cockpitLoading, setCockpitLoading] = useState(true);
  const [cockpitRefreshKey, setCockpitRefreshKey] = useState(0);

  useEffect(() => {
    if (!appt?.sessionId && !appt?.clientId) { setCockpitLoading(false); return; }
    let alive = true;
    (async () => {
      setCockpitLoading(true);

      // Current session for this booking (intake-done state). Pull
      // the full row including SOAP fields so the Record panel can
      // edit therapist_notes inline.
      if (appt.sessionId) {
        const { data: cs } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', appt.sessionId)
          .single();
        if (alive) setCurrentSession(cs || null);
      }

      // History for this client across all prior sessions. Used for
      // last-session card AND pattern detection. Limit to 20 most
      // recent; pattern signal stabilizes well before that.
      if (appt.clientId) {
        const { data: history } = await supabase
          .from('sessions')
          .select('id, booking_id, created_at, front_focus, back_focus, front_avoid, back_avoid, pressure, goal, table_temp, room_temp, music, lighting, conversation, draping, med_flag, med_note, client_notes, medical_conditions, therapist_notes, public_notes, completed')
          .eq('therapist_id', therapist.id)
          .eq('client_id', appt.clientId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (!alive) return;
        const allRows = history || [];
        setAllSessions(allRows);
        // Last session = first row that isn't the current session.
        const others = allRows.filter(s => s.id !== appt.sessionId);
        setLastSession(others.length ? others[0] : null);
      }

      if (alive) setCockpitLoading(false);
    })();
    return () => { alive = false; };
  }, [appt?.id, appt?.sessionId, appt?.clientId, therapist?.id, cockpitRefreshKey]);

  const refreshCockpit = () => setCockpitRefreshKey(k => k + 1);

  // HK May 25 2026 (Phase 22): future-session gate for Record + Recap.
  // SOAP notes + warm recap to client only make sense AFTER the
  // appointment has happened. We compare appt.date (set to midnight)
  // against today's midnight. Same-day = unlocked (therapist often
  // fills notes during/right after the session). Strict-future = locked
  // with a clear message and an 'I'm starting now' override.
  const isFutureSession = useMemo(() => {
    if (!appt?.date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const apptDay = new Date(appt.date);
    apptDay.setHours(0, 0, 0, 0);
    return apptDay.getTime() > today.getTime();
  }, [appt?.date]);

  const [recordOverride, setRecordOverride] = useState(false);
  const [recapOverride, setRecapOverride] = useState(false);
  // Whenever the appt changes, reset overrides so a future session
  // does not stay 'unlocked' when the user clicks a different one.
  useEffect(() => { setRecordOverride(false); setRecapOverride(false); }, [appt?.id]);

  // Combined intake completeness: did the client submit a meaningful
  // intake? Used to drive the document journey's intake-done state.
  const intakeDone = !!(
    (currentSession?.front_focus && currentSession.front_focus.length) ||
    (currentSession?.back_focus && currentSession.back_focus.length) ||
    currentSession?.client_notes ||
    currentSession?.pressure
  );

  // Parse SOAP fields from therapist_notes JSON. Same format the
  // SessionDetail page writes. Fall back to plain-string legacy notes.
  const parsedSoap = useMemo(() => {
    if (!currentSession?.therapist_notes) return { S: '', O: '', A: '', P: '', noteToClient: '', isLegacy: false };
    try {
      const p = JSON.parse(currentSession.therapist_notes);
      if (p && p.__soap) return { S: p.S || '', O: p.O || '', A: p.A || '', P: p.P || '', noteToClient: p.noteToClient || '', isLegacy: false };
    } catch (_) { /* not JSON */ }
    return { S: '', O: '', A: '', P: '', noteToClient: '', legacyText: currentSession.therapist_notes, isLegacy: true };
  }, [currentSession?.therapist_notes]);

  const hasSoapContent = !!(parsedSoap.S || parsedSoap.O || parsedSoap.A || parsedSoap.P);
  const hasRecap = !!(currentSession?.public_notes || parsedSoap.noteToClient);

  // Medical flags fired (red): pregnancy, recent surgery, conditions
  // with HBP/diabetes/cancer/recent injury. Used both for the medical
  // panel auto-expand AND for the insight line under status pills.
  const medicalFlagsFired = useMemo(() => {
    const flags = [];
    if (!currentSession) return flags;
    if (currentSession.med_flag && currentSession.med_flag !== 'none') flags.push({ key: currentSession.med_flag, label: 'Medical condition flagged' });
    if (currentSession.med_note) flags.push({ key: 'med_note', label: currentSession.med_note });
    if (Array.isArray(currentSession.medical_conditions) && currentSession.medical_conditions.length) {
      currentSession.medical_conditions.forEach(c => flags.push({ key: c, label: c }));
    }
    return flags;
  }, [currentSession]);

  // ─── Cockpit panel open/close state ───
  // Brief expanded by default for upcoming sessions; Record expanded
  // by default after the session is marked complete. Therapist can
  // override either way.
  const [openSections, setOpenSections] = useState(() => ({
    brief: true,
    medical: medicalFlagsFired.length > 0,
    last_session: false,
    patterns: false,
    record: !!currentSession?.completed,
    recap: !!currentSession?.completed && hasSoapContent,
    payment: false,
  }));

  // Re-bias defaults once cockpit data arrives. We only adjust auto-
  // expansion for sections whose 'natural default' is data-driven
  // (medical when flags fire, record when session is complete).
  useEffect(() => {
    if (cockpitLoading) return;
    setOpenSections(prev => ({
      ...prev,
      medical: prev.medical || medicalFlagsFired.length > 0,
      record: prev.record || !!currentSession?.completed,
    }));
  }, [cockpitLoading, currentSession?.completed, medicalFlagsFired.length]);

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // ─── Pattern signal: the highest-impact insight to surface ───
  // Order of priority: medical flag > cadence drift > zone recurrence
  // > newcomer. We compute the single strongest one and show it
  // under the status pills. If none qualify, the line is hidden.
  const insightLine = useMemo(() => {
    if (cockpitLoading) return null;
    // 1. Active medical flag (most important for safety)
    if (medicalFlagsFired.length > 0) {
      const top = medicalFlagsFired[0];
      return { icon: '⚠️', tone: 'warn', text: `Heads up: ${top.label}` };
    }
    // 2. New client welcome cue
    if (!allSessions.length || allSessions.length === 1) {
      return { icon: '🌱', tone: 'fresh', text: 'New client. Take time to welcome and set expectations.' };
    }
    // 3. Cadence drift (returned after a long gap)
    if (allSessions.length >= 2 && lastSession?.created_at) {
      const daysSinceLast = Math.floor((Date.now() - new Date(lastSession.created_at).getTime()) / 86400000);
      const gaps = [];
      for (let i = 1; i < Math.min(allSessions.length, 5); i++) {
        gaps.push((new Date(allSessions[i - 1].created_at).getTime() - new Date(allSessions[i].created_at).getTime()) / 86400000);
      }
      const avgGap = gaps.reduce((a, b) => a + b, 0) / Math.max(gaps.length, 1);
      if (avgGap > 0 && daysSinceLast > avgGap * 1.5) {
        return { icon: '🕊', tone: 'soft', text: `Welcome back after ${daysSinceLast} days. Normal cadence here is ~${Math.round(avgGap)} days.` };
      }
    }
    // 4. Zone recurrence (focus area mentioned in 3+ of last 4)
    if (allSessions.length >= 3) {
      const recent = allSessions.slice(0, 4);
      const counts = {};
      recent.forEach(s => {
        (s.front_focus || []).forEach(z => { counts[z] = (counts[z] || 0) + 1; });
        (s.back_focus  || []).forEach(z => { counts[z] = (counts[z] || 0) + 1; });
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 3) {
        return { icon: '🔁', tone: 'pattern', text: `${zoneLabel(top[0])} has come up in ${top[1]} of the last ${recent.length} sessions.` };
      }
    }
    // 5. Returning warm: positive signal for returning clients with no flag
    return { icon: '🌿', tone: 'soft', text: `Returning client · ${allSessions.length} session${allSessions.length === 1 ? '' : 's'} on file.` };
  }, [cockpitLoading, allSessions, lastSession, medicalFlagsFired]);

  // Total paid + pending for this booking
  const paidTotalCents = paymentRows
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + (p.amount_cents || 0) + (p.tip_cents || 0), 0);
  const pendingTotalCents = paymentRows
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount_cents || 0) + (p.tip_cents || 0), 0);

  // Default amount for the checkout modal: service price if known, else 0.
  // We pull this from the appt row's service.price field, threaded via the
  // booking page. If unavailable, leave it blank for the therapist to type.
  const defaultAmountCents = appt?.service_price_cents || 0;

  async function saveEndTime() {
    setSavingTime(true);
    const updates = {};
    if (newStartTime) updates.start_time = newStartTime;
    if (newEndTime) updates.end_time = newEndTime;
    if (Object.keys(updates).length) {
      await supabase.from('bookings').update(updates).eq('id', appt.id);
    }
    setSavingTime(false);
    setEditTime(false);
    onCancelled?.();
  }

  async function cancelAppointment() {
    setCancelling(true);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', appt.id);

    // Notify the therapist (non-blocking). This is the legacy
    // inline confirm path that only fires when the full booking
    // row could not be loaded for the policy-aware modal.
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      fetch(`${supabaseUrl}/functions/v1/notify-booking-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ booking_id: appt.id, event_type: 'booking_cancelled' }),
      }).catch(() => { /* non-blocking */ });
    } catch (_notifyErr) { /* non-blocking */ }

    setCancelling(false);
    onCancelled?.();
    onClose();
  }

  // Policy-aware cancel: opens the CancellationChargeModal which
  // computes the fee from the therapist's policy + how much time is
  // left before the appointment, and gives the therapist three
  // options: charge fee + cancel, skip fee + cancel, or don't
  // cancel. Loads the booking's full client row + booking row so
  // the modal can inspect card-on-file across both processors.
  //
  // Called with { isNoShow: true } from the Mark No-Show button on
  // past bookings. The modal then computes the fee using the
  // therapist's policy.no_show_percent rather than the time-tier.
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeContext, setChargeContext] = useState(null);

  // A booking counts as past once its scheduled END time has passed.
  // appt.date is set to that day at 00:00 local; appt.time is a 12h
  // string like '9:00 AM'. Add minutes-since-midnight + duration to
  // the day's midnight to get the end-time epoch.
  const apptDayMs = appt?.date instanceof Date ? appt.date.getTime() : null;
  const apptEndMs = apptDayMs != null
    ? apptDayMs + (t2m(appt.time) + (appt.duration || 60)) * 60 * 1000
    : null;
  const isPastBooking = apptEndMs != null && apptEndMs < Date.now();
  // Only offer no-show on past bookings that have not already been
  // cancelled or completed. External Google events never reach here.
  const canMarkNoShow = isPastBooking
    && !appt.preview
    && appt.status !== 'cancelled'
    && appt.status !== 'complete';

  async function openCancelFlow({ isNoShow = false } = {}) {
    // Load full booking + client to know about card-on-file
    const { data: bookingRow } = await supabase
      .from('bookings').select('*').eq('id', appt.id).single();
    if (!bookingRow) {
      // Fallback to legacy inline confirm if we can't load the row
      setConfirmCancel(true);
      return;
    }
    let clientRow = null;
    if (bookingRow.client_id) {
      const { data } = await supabase
        .from('clients').select('*').eq('id', bookingRow.client_id).maybeSingle();
      clientRow = data;
    }
    // Compute session price from the appointment data we have, or
    // fall back to therapist's default service price.
    const sessionPriceCents = Math.round((appt.priceUsd || appt.price || 0) * 100);
    setChargeContext({ booking: bookingRow, client: clientRow, sessionPriceCents, isNoShow });
    setShowChargeModal(true);
  }

  // External Google Calendar events render a much simpler read-only
  // panel. No reschedule, no cancel, no intake link, no client info.
  // The therapist sees the event title (which she put there in
  // Google) and can hit Close. The slot is automatically blocked
  // for clients on the booking page. This branch sits AFTER all
  // hook calls so it doesn't violate rules-of-hooks.
  if (appt?.external) {
    return (
      <>
        <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300,backdropFilter:'blur(2px)'}}/>
        <div style={{position:'fixed',top:0,right:0,bottom:0,width:360,maxWidth:'100vw',background:'#fff',zIndex:301,overflowY:'auto',boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column',padding:'24px',paddingTop:'calc(env(safe-area-inset-top, 0px) + 24px)'}}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:18 }}>
            <div style={{ fontSize:26, marginTop:2 }}>📅</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#7F77DD', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
                From your Google Calendar
              </div>
              <div style={{
                fontSize:19, fontWeight:700, color:'#1F2937',
                fontFamily:'Georgia, serif',
                wordBreak:'break-word', lineHeight:1.3,
              }}>
                {appt.client || 'Calendar event'}
              </div>
            </div>
            <CloseButton onClick={onClose} label="Close" />
          </div>
          <div style={{
            background:'#F8F7FB', border:'1px solid #E1DEEF', borderRadius:10,
            padding:'14px 16px', marginBottom:16,
            fontSize:13, color:'#3D4A42', lineHeight:1.6,
          }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#1F2937' }}>
              {appt.isAllDay ? 'All day' : appt.time}{appt.duration && !appt.isAllDay ? ` · ${appt.duration} min` : ''}
            </div>
            <div style={{ fontSize:12, color:'#6B7280', marginTop:6 }}>
              {appt.date}
            </div>
          </div>
          <div style={{
            background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:10,
            padding:'12px 14px', marginBottom:16,
            fontSize:12, color:'#9A3412', lineHeight:1.55,
          }}>
            This time is blocked for clients on your booking page. To move or remove it, edit in Google Calendar. Changes show up here within 15 minutes.
          </div>
          <button onClick={onClose} style={{
            width:'100%', padding:'12px',
            background:'#F3F4F6', border:'none', borderRadius:10,
            fontSize:14, fontWeight:600, color:'#374151', cursor:'pointer',
          }}>
            Close
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300,backdropFilter:'blur(2px)'}}/>
      {/* HK May 25 2026 (Phase 23): scroll fix. The outer container
          is position:fixed with explicit top/bottom and overflowY:auto.
          Children flow naturally without flex:1. The previous setup
          gave body 'flex:1' which fought the parent's overflow boundary
          when the cockpit panels grew tall, causing the scroll to die
          past the checkout button. paddingBottom adds breathing room
          below the last action so nothing sits flush against
          home-indicator on iOS. Design principle #23 below. */}
      <div style={{
        position:'fixed',
        top:0, right:0, bottom:0,
        width:360, maxWidth:'100vw',
        background:'#fff',
        zIndex:301,
        overflowY:'auto',
        WebkitOverflowScrolling: 'touch',
        boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',
        paddingTop:'env(safe-area-inset-top, 0px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)',
      }}>
        <div style={{padding:'14px 16px 14px',borderBottom:'1px solid #F3F4F6'}}>
          {/* Top row: avatar + name + close. displayAppt is used so
              if the user links a client via the ClientPicker inside
              CheckoutModal, the name updates immediately without
              waiting for a parent refresh. HK May 25 2026: the name +
              avatar now link to the client profile page. Before this,
              the therapist had to go to Clients and look up the name
              manually after opening a session. Clickable cues: cursor
              pointer + hover underline. Falls back to plain text when
              the booking has no client_id (orphan booking that will
              show the inline ClientPicker on Charge). */}
          {/* HK May 25 2026 (Phase 24): confident header. The 'Tap
              to open profile' hint felt apologetic. Now: a real
              outline button on the right says 'View profile' so the
              affordance is visible and unambiguous. Avatar + name
              are still tappable for fast access. */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            {displayAppt.clientId ? (
              <>
                <a
                  href={`/dashboard/clients/${displayAppt.clientId}`}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:10,
                    flex:1,
                    minWidth:0,
                    textDecoration:'none',
                    color:'inherit',
                    cursor:'pointer',
                  }}
                  title="Open client profile"
                >
                  <div style={{width:42,height:42,borderRadius:'50%',background:ac(displayAppt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,flexShrink:0}}>{initials(displayAppt.client)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:700,color:SO.ink,fontFamily:'Georgia,serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {displayAppt.client}
                    </div>
                    {displayAppt.is_couples && displayAppt.partner_name && (
                      <div style={{fontSize:12,color:SO.sage,fontWeight:600}}>💑 with {displayAppt.partner_name}</div>
                    )}
                    <div style={{fontSize:12,color:SO.inkMute}}>
                      {appt.sessions>0?`${appt.sessions} sessions`:appt.preview?'Preview client':'New client'}
                    </div>
                  </div>
                </a>
                <a
                  href={`/dashboard/clients/${displayAppt.clientId}`}
                  style={{
                    background: '#fff',
                    color: SO.forest,
                    border: '1.5px solid #D6E0D4',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                  title="Open client profile"
                >
                  View profile ›
                </a>
              </>
            ) : (
              <>
                <div style={{width:42,height:42,borderRadius:'50%',background:ac(displayAppt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,flexShrink:0}}>{initials(displayAppt.client)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:16,fontWeight:700,color:SO.ink,fontFamily:'Georgia,serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayAppt.client}</div>
                  {displayAppt.is_couples && displayAppt.partner_name && (
                    <div style={{fontSize:12,color:SO.sage,fontWeight:600}}>💑 with {displayAppt.partner_name}</div>
                  )}
                  <div style={{fontSize:12,color:SO.inkMute}}>{appt.sessions>0?`${appt.sessions} sessions`:appt.preview?'Preview client':'New client'}</div>
                </div>
              </>
            )}
            <CloseButton onClick={onClose} label="Close" />
          </div>
          {/* Time + status row. HK May 25 2026 (Phase 21 F1):
              edit-time button moved INLINE next to the time text so
              it's unambiguous what it edits. The previous top-right
              ✏️ Edit was confusing once the slide-over filled with
              many panels (looked like it might edit the whole record). */}
          <div style={{background:'#F9FAFB',borderRadius:10,padding:'10px 14px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{appt.time} · {appt.duration} min</div>
                  {!appt.preview && (
                    <button onClick={()=>setEditTime(v=>!v)}
                      style={{
                        background:'transparent',
                        border:'1px solid #D1D5DB',
                        borderRadius:8,
                        padding:'3px 8px',
                        fontSize:11,
                        fontWeight:600,
                        color:'#6B7280',
                        cursor:'pointer',
                        fontFamily:'inherit',
                      }}>
                      {editTime ? 'Cancel' : '✏️ Edit time'}
                    </button>
                  )}
                </div>
                <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>{appt.service||'Session'}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <div style={{background:st.bg,color:st.color,borderRadius:20,padding:'4px 10px',fontSize:11,fontWeight:700}}>{st.icon} {st.label}</div>
              </div>
            </div>
          </div>

          {/* HK May 25 2026 (Phase 20.1): single highest-priority
              insight line under the status row. Surfaces medical
              flags, cadence drift, recurring focus zones, or warm
              new-client cues. Computed in insightLine memo above.
              Hidden when cockpit is still loading or there is truly
              nothing to surface (rare). */}
          {!appt.preview && insightLine && (
            <div style={{
              display:'flex',
              alignItems:'flex-start',
              gap:8,
              marginTop:10,
              padding:'10px 12px',
              borderRadius:10,
              background: insightLine.tone === 'warn' ? '#FEF3C7' : insightLine.tone === 'pattern' ? '#FFFBEB' : insightLine.tone === 'fresh' ? '#ECFDF5' : '#F0F7F1',
              border: insightLine.tone === 'warn' ? '1px solid #FDE68A' : '1px solid #DCE7DC',
            }}>
              <span style={{fontSize:14, lineHeight:1.3}}>{insightLine.icon}</span>
              <div style={{
                fontSize:12.5,
                color: insightLine.tone === 'warn' ? '#78350F' : '#374151',
                lineHeight:1.5,
                fontWeight: insightLine.tone === 'warn' ? 700 : 500,
                flex:1,
              }}>
                {insightLine.text}
              </div>
            </div>
          )}

          {editTime && !appt.preview && (
            <div style={{background:'#F0FDF4',border:'1.5px solid #86EFAC',borderRadius:10,padding:'14px 16px',margin:'0 0 0 0'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#2A5741',marginBottom:10}}>Edit session times</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#6B7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Start time</label>
                  <input type="time" value={newStartTime} onChange={e=>setNewStartTime(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',border:'1.5px solid #D1D5DB',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#6B7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>End time</label>
                  <input type="time" value={newEndTime} onChange={e=>setNewEndTime(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',border:'1.5px solid #D1D5DB',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
                </div>
              </div>
              <button onClick={saveEndTime} disabled={savingTime}
                style={{width:'100%',padding:'9px 0',background:'#2A5741',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',opacity:savingTime?0.6:1}}>
                {savingTime ? 'Saving...' : 'Save times'}
              </button>
            </div>
          )}

          {/* HK May 25 2026 (Phase 24): DocumentJourney removed from
              slide-over. Reason: the 4 panels (Brief, Record, Recap,
              and the Medical/Last-Session/Patterns context cards)
              already communicate session progression through their
              open/closed state, subtitles, and content. A separate
              4-dot timeline competed visually rather than helping,
              and the desktop-designed component had to be scaled
              with a CSS transform hack to fit a 360px slide-over.
              SessionDetail page still uses DocumentJourney where it
              belongs (a full-width page context). */}
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
          {/* HK May 25 2026 (Phase 20.1): cleaner status pills. Replaces
              the prior verbose 'Reminder sent / pending' line which
              read as if intake was pending. Now uses paid + reminder
              + deposit as compact pills, only shown when relevant. */}
          {!appt.preview && (
            <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
              {paidTotalCents > 0 && (
                <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',borderRadius:999,background:'#F0FDF4',color:'#15803D',fontSize:11,fontWeight:700,border:'1px solid #BBF7D0'}}>
                  <span>💚</span> Paid ${(paidTotalCents / 100).toFixed(0)}
                </span>
              )}
              {appt.deposit_required && (
                <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',borderRadius:999,background:appt.deposit_paid?'#F0FDF4':'#FEF3C7',color:appt.deposit_paid?'#15803D':'#92400E',fontSize:11,fontWeight:600,border:`1px solid ${appt.deposit_paid?'#BBF7D0':'#FDE68A'}`}}>
                  <span style={{fontSize:11}}>{appt.deposit_paid?'✓':'⏳'}</span>
                  {appt.deposit_paid?`Deposit paid`:`Deposit pending`}
                </span>
              )}
              {/* Reminder pill: show 'Reminded' (green) if sent, hide
                  otherwise. The prior 'Reminder pending' label looked
                  like an intake issue and confused the therapist.
                  When the cron fires the 24h reminder, this flips. */}
              {appt.reminder_sent && (
                <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',borderRadius:999,background:'#F0FDF4',color:'#15803D',fontSize:11,fontWeight:600,border:'1px solid #BBF7D0'}}>
                  <span>🔔</span> Reminded
                </span>
              )}
            </div>
          )}
          {appt.notes && <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#92400E',lineHeight:1.5,fontFamily:'Georgia, serif',fontStyle:'italic'}}>{appt.notes}</div>}

          {/* ══════════════════════════════════════════════════════════
              COCKPIT PANELS (HK May 25 2026 Phase 20.3-20.9)
              The therapist's full session context lives here. Each
              section is a CockpitSection (collapsible card with icon,
              title, count badge, chevron). Default open/close state
              is computed above in openSections useState. Tap any
              header to toggle that section. DocumentJourney dots
              auto-scroll + auto-expand the matching panel.
              ══════════════════════════════════════════════════════════ */}

          {!appt.preview && currentSession && (
            <>
              {/* ─── Brief panel (intake summary) ─── */}
              <CockpitSection
                sectionKey="brief"
                icon="🌿"
                title="Today's Brief"
                subtitle={intakeDone ? "What this client wants today" : "Intake not yet submitted"}
                isOpen={openSections.brief}
                onToggle={() => toggleSection('brief')}
              >
                {!intakeDone && (
                  <EmptyStateCard
                    icon="📋"
                    body="Your client hasn't filled out their intake yet. Send them the link from below, or fill it out with them at the start of the session."
                  />
                )}
                {intakeDone && currentSession && (
                  <>
                    {/* Focus zones */}
                    {((currentSession.front_focus || []).length > 0 || (currentSession.back_focus || []).length > 0) && (
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6}}>Focus areas</div>
                        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                          {(currentSession.front_focus || []).map((z, i) => (
                            <span key={`ff-${i}`} style={{display:'inline-block', padding:'4px 10px', borderRadius:999, background:'#DCFCE7', color:'#15803D', fontSize:12, fontWeight:600, border:'1px solid #BBF7D0'}}>
                              {zoneLabel(z)}
                            </span>
                          ))}
                          {(currentSession.back_focus || []).map((z, i) => (
                            <span key={`bf-${i}`} style={{display:'inline-block', padding:'4px 10px', borderRadius:999, background:'#DCFCE7', color:'#15803D', fontSize:12, fontWeight:600, border:'1px solid #BBF7D0'}}>
                              {zoneLabel(z)} (back)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Avoid zones */}
                    {((currentSession.front_avoid || []).length > 0 || (currentSession.back_avoid || []).length > 0) && (
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6}}>Avoid</div>
                        <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                          {(currentSession.front_avoid || []).map((z, i) => (
                            <span key={`fa-${i}`} style={{display:'inline-block', padding:'4px 10px', borderRadius:999, background:'#FEF2F2', color:'#991B1B', fontSize:12, fontWeight:600, border:'1px solid #FECACA'}}>
                              {zoneLabel(z)}
                            </span>
                          ))}
                          {(currentSession.back_avoid || []).map((z, i) => (
                            <span key={`ba-${i}`} style={{display:'inline-block', padding:'4px 10px', borderRadius:999, background:'#FEF2F2', color:'#991B1B', fontSize:12, fontWeight:600, border:'1px solid #FECACA'}}>
                              {zoneLabel(z)} (back)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pressure */}
                    {currentSession.pressure && (
                      <div style={{marginBottom:14, display:'flex', alignItems:'center', gap:10}}>
                        <div style={{fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', flexShrink:0, minWidth:80}}>Pressure</div>
                        <div style={{display:'flex', alignItems:'center', gap:4}}>
                          {[1,2,3,4,5].map(n => (
                            <span key={n} style={{
                              width:14, height:14, borderRadius:'50%',
                              background: n <= currentSession.pressure ? '#2A5741' : '#E5E7EB',
                              display:'inline-block',
                            }}/>
                          ))}
                          <span style={{marginLeft:8, fontSize:13, color:'#374151', fontWeight:600}}>
                            {pressureLabel(currentSession.pressure)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Goal */}
                    {currentSession.goal && (
                      <div style={{marginBottom:14, display:'flex', alignItems:'flex-start', gap:10}}>
                        <div style={{fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', flexShrink:0, minWidth:80, paddingTop:2}}>Goal</div>
                        <div style={{fontSize:13, color:'#374151', flex:1, lineHeight:1.5}}>{goalLabel(currentSession.goal)}</div>
                      </div>
                    )}

                    {/* Preferences (compact line) */}
                    {(currentSession.room_temp || currentSession.music || currentSession.conversation || currentSession.draping) && (
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6}}>Preferences</div>
                        <div style={{fontSize:13, color:'#374151', lineHeight:1.6}}>
                          {[
                            currentSession.room_temp && preferenceLabel('room_temp', currentSession.room_temp),
                            currentSession.music && preferenceLabel('music', currentSession.music),
                            currentSession.lighting && preferenceLabel('lighting', currentSession.lighting),
                            currentSession.conversation && preferenceLabel('conversation', currentSession.conversation),
                            currentSession.draping && preferenceLabel('draping', currentSession.draping),
                            currentSession.oil_pref && preferenceLabel('oil_pref', currentSession.oil_pref),
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    )}

                    {/* Client notes */}
                    {currentSession.client_notes && (
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6}}>Notes from client</div>
                        <div style={{fontSize:13, color:'#374151', lineHeight:1.6, fontStyle:'italic', background:'#FAFAFA', padding:'10px 12px', borderRadius:8, border:'1px solid #F3F4F6'}}>
                          "{currentSession.client_notes}"
                        </div>
                      </div>
                    )}

                    {/* Body map (collapsible inside the panel) */}
                    <BodyMapPreview session={currentSession} />
                  </>
                )}
              </CockpitSection>

              {/* ─── Medical flags panel ─── */}
              {(medicalFlagsFired.length > 0 || currentSession?.med_flag === 'none') && (
                <CockpitSection
                  sectionKey="medical"
                  icon={medicalFlagsFired.length > 0 ? "⚠️" : "🩺"}
                  title="Medical flags"
                  subtitle={medicalFlagsFired.length > 0 ? `${medicalFlagsFired.length} flagged` : "None flagged"}
                  isOpen={openSections.medical}
                  onToggle={() => toggleSection('medical')}
                  warn={medicalFlagsFired.length > 0}
                >
                  {medicalFlagsFired.length === 0 && (
                    <EmptyStateCard
                      icon="🩺"
                      body="Client reported no medical concerns on intake."
                    />
                  )}
                  {medicalFlagsFired.length > 0 && (
                    <ul style={{margin:0, padding:'0 0 0 18px'}}>
                      {medicalFlagsFired.map((f, i) => (
                        <li key={i} style={{fontSize:13, color:'#78350F', lineHeight:1.65, marginBottom:4}}>
                          {f.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </CockpitSection>
              )}

              {/* ─── Last session panel (returning clients only) ─── */}
              {lastSession && (
                <CockpitSection
                  sectionKey="last_session"
                  icon="📝"
                  title="Last session"
                  subtitle={lastSession.created_at ? `${Math.floor((Date.now() - new Date(lastSession.created_at).getTime()) / 86400000)} days ago` : ''}
                  isOpen={openSections.last_session}
                  onToggle={() => toggleSection('last_session')}
                >
                  <LastSessionContent session={lastSession} />
                </CockpitSection>
              )}

              {/* ─── Patterns panel (3+ sessions) ─── */}
              {allSessions.length >= 3 && (
                <CockpitSection
                  sectionKey="patterns"
                  icon="📊"
                  title="Patterns"
                  subtitle={`${allSessions.length} sessions on file`}
                  isOpen={openSections.patterns}
                  onToggle={() => toggleSection('patterns')}
                >
                  <PatternsContent allSessions={allSessions} />
                </CockpitSection>
              )}

              {/* ─── Record panel (SOAP entry inline) ─── */}
              {/* Phase 22: locked for future sessions unless the
                  therapist hits 'I'm starting now'. Past existing
                  content (hasSoapContent) keeps the editor visible
                  so we never hide saved work. */}
              <CockpitSection
                sectionKey="record"
                icon="✍️"
                title="Session record · SOAP"
                subtitle={
                  isFutureSession && !recordOverride && !hasSoapContent
                    ? `Unlocks on ${appt.date?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                    : hasSoapContent
                      ? 'Notes saved · tap to edit'
                      : '🎙️ Capture what happened, dictate or type'
                }
                isOpen={openSections.record}
                onToggle={() => toggleSection('record')}
              >
                {isFutureSession && !recordOverride && !hasSoapContent ? (
                  <LockedFutureSessionPanel
                    apptDate={appt.date}
                    kind="record"
                    onOverride={() => setRecordOverride(true)}
                  />
                ) : (
                  <RecordEditor
                    session={currentSession}
                    parsedSoap={parsedSoap}
                    therapist={therapist}
                    allSessions={allSessions}
                    onSaved={() => refreshCockpit()}
                  />
                )}
              </CockpitSection>

              {/* ─── Recap panel (warm message to client) ─── */}
              {/* Phase 22: same gate. Recap only appears when the
                  session is marked complete OR there's an existing
                  recap to view (preserve saved content). For future
                  sessions the therapist can still override and write
                  one early, though sending the email is the wrong
                  move pre-session, hence the locked default. */}
              {(currentSession?.completed || hasRecap || (isFutureSession && recapOverride)) && (
                <CockpitSection
                  sectionKey="recap"
                  icon="💌"
                  title="Client recap"
                  subtitle={
                    isFutureSession && !recapOverride && !hasRecap
                      ? `Sends after the session on ${appt.date?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                      : hasRecap
                        ? 'Recap saved · tap to view'
                        : 'Send a warm note to client'
                  }
                  isOpen={openSections.recap}
                  onToggle={() => toggleSection('recap')}
                >
                  {isFutureSession && !recapOverride && !hasRecap ? (
                    <LockedFutureSessionPanel
                      apptDate={appt.date}
                      kind="recap"
                      onOverride={() => setRecapOverride(true)}
                    />
                  ) : (
                    <RecapEditor
                      session={currentSession}
                      parsedSoap={parsedSoap}
                      therapist={therapist}
                      allSessions={allSessions}
                      onSaved={() => refreshCockpit()}
                      onRebook={() => { onClose(); onReschedule && onReschedule({ ...appt, isRebook: true }); }}
                    />
                  )}
                </CockpitSection>
              )}
            </>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {/* HK May 25 2026 (Phase 20.11): the old 'Open Session
                Record' and 'Open Pre-Session Brief' buttons were
                removed here. The Brief panel above shows the intake
                inline; the Record panel above edits SOAP notes inline.
                Therapists no longer need to leave the slide-over to
                view or write a session. Legacy SessionDetail page
                URL still works for deep-linked / printable views. */}
            {/* Pending-intake state: Send Intake (sage tone, NOT solid forest
                so it doesn't compete with Checkout below). Paired with Copy Link
                in a horizontal row for compactness. */}
            {appt.status==='pending-intake' && !appt.preview && (
              <div style={{display:'flex',gap:8}}>
                <a href={`sms:&body=${encodeURIComponent(`Hi ${firstName}! Please fill your intake form before your session: ${intakeLink}`)}`}
                  style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,background:'#F4F6F2',color:'#2A5741',borderRadius:12,padding:'11px 14px',fontSize:13,fontWeight:600,textDecoration:'none',border:'1.5px solid #D6E0D4'}}>
                  <span style={{fontSize:13}}>💬</span> Send intake
                </a>
                <button onClick={()=>{navigator.clipboard.writeText(intakeLink);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                  style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,background:'#fff',color:'#6B9E80',border:'1.5px solid #D6E0D4',borderRadius:12,padding:'11px 14px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  <span style={{fontSize:13}}>🔗</span> {copied?'Copied':'Copy link'}
                </button>
              </div>
            )}
            {/* For intake-done state, Copy Intake Link is much less needed,
                so don't show it. For other states (e.g. no status), still
                show a single Copy Link button. */}
            {appt.status !== 'pending-intake' && appt.status !== 'intake-done' && (
              <button onClick={()=>{navigator.clipboard.writeText(intakeLink);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,background:'#fff',color:'#6B9E80',border:'1.5px solid #D6E0D4',borderRadius:12,padding:'11px 14px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                <span style={{fontSize:13}}>🔗</span> {copied?'Copied':'Copy intake link'}
              </button>
            )}
            {appt.is_couples && appt.partner_name && appt.partner_email && !appt.preview && (() => {
              const partnerLink = `${intakeUrl}?name=${encodeURIComponent(appt.partner_name)}&email=${encodeURIComponent(appt.partner_email)}&booking_id=${appt.id}`;
              return (
                <div style={{background:'#F4F6F2',border:'1.5px solid #D6E0D4',borderRadius:12,padding:'12px 14px'}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#2A5741',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>Partner · {appt.partner_name}</div>
                  <div style={{display:'flex',gap:8}}>
                    <a href={`sms:&body=${encodeURIComponent(`Hi ${appt.partner_name.split(' ')[0]}! Please fill your intake form: ${partnerLink}`)}`}
                      style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:'#2A5741',color:'#fff',borderRadius:8,padding:'8px 10px',fontSize:12,fontWeight:600,textDecoration:'none'}}>
                      <span>💬</span> SMS
                    </a>
                    <button onClick={()=>{navigator.clipboard.writeText(partnerLink);}}
                      style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:'#fff',color:'#2A5741',border:'1.5px solid #D6E0D4',borderRadius:8,padding:'8px 10px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                      <span>🔗</span> Copy
                    </button>
                  </div>
                </div>
              );
            })()}
            {appt.is_couples && appt.partner_name && appt.partner_email && !appt.preview && false && (
              <button onClick={()=>{
                const partnerLink=`${window.location.origin}/${therapist?.custom_url}?name=${encodeURIComponent(appt.partner_name)}&email=${encodeURIComponent(appt.partner_email)}&booking_id=${appt.id}`;
                navigator.clipboard.writeText(partnerLink);
                setCopied(true); setTimeout(()=>setCopied(false),2000);
              }} style={{background:'#F0FDF4',color:'#2A5741',border:'1.5px solid #86EFAC',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                Copy {appt.partner_name.split(' ')[0]}'s Intake Link
              </button>
            )}

            {/* ─────────── PAYMENT BLOCK ─────────── */}
            {/* The hero of the slide-over. Checkout is the moment of joy at
                the end of a session, presented as a single composed card
                with the action sized appropriately. Mark as paid lives
                inside the same card as a paired link, not floating below. */}
            {!appt.preview && appt.status !== 'cancelled' && !paymentsLoading && (
              <>
                {paidTotalCents > 0 ? (
                  /* PAID STATE: warm sage receipt card. Calm, finished, complete. */
                  <div style={{
                    background:'linear-gradient(180deg, #F0F6EE 0%, #E8F1E5 100%)',
                    border:'1.5px solid #B7D1AB',
                    borderRadius:16,
                    padding:'18px 18px 14px',
                    boxShadow:'0 1px 0 rgba(255,255,255,0.6) inset',
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                      <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:999,background:'#2A5741',color:'#fff',fontSize:15,fontWeight:700}}>✓</span>
                      <div style={{fontFamily:'Georgia, serif',fontSize:20,fontWeight:400,color:'#1F4030',letterSpacing:'-0.01em'}}>
                        Paid <span style={{fontWeight:600}}>${(paidTotalCents/100).toFixed(2)}</span>
                      </div>
                    </div>
                    <div style={{fontSize:12,color:'#5B7551',marginLeft:38,fontFamily:'Georgia, serif',fontStyle:'italic',marginBottom:10}}>
                      {paymentRows.filter(p=>p.status==='succeeded').map(p => {
                        const m = p.payment_method;
                        if (m === 'stripe_card_on_file' || m === 'stripe_card_new') return p.payment_method_detail || 'Card';
                        if (m === 'stripe_payment_link') return 'Pay link';
                        if (m === 'cash') return 'Cash';
                        if (m === 'venmo') return 'Venmo';
                        if (m === 'zelle') return 'Zelle';
                        if (m === 'cashapp') return 'Cash App';
                        if (m === 'check') return 'Check';
                        return 'Other';
                      }).join(' · ')}
                    </div>
                    {/* Phase 14.3k (HK May 17 2026 late): both actions are
                        now proper outlined buttons inside the paid card.
                        Therapist asked the Refund button be 10x better.
                        Done: real button shapes with sage-green outline,
                        equal sizing, side by side. Discoverable peers. */}
                    <div style={{display:'flex',gap:8,marginTop:6,marginLeft:38}}>
                      <button onClick={()=>setShowCheckout(true)}
                        style={{
                          flex:1,
                          background:'#fff',
                          color:'#2A5741',
                          border:'1.5px solid #B7D1AB',
                          borderRadius:10,
                          padding:'10px 12px',
                          fontSize:13,
                          fontWeight:600,
                          cursor:'pointer',
                        }}>
                        + Add payment
                      </button>
                      {(() => {
                        const refundable = paymentRows
                          .filter(p => p.status === 'succeeded')
                          .slice(-1)[0];
                        if (!refundable) return null;
                        return (
                          <button onClick={() => setRefundTarget({ ...refundable, client_name: appt.client })}
                            style={{
                              flex:1,
                              background:'#fff',
                              color:'#B91C1C',
                              border:'1.5px solid #FCA5A5',
                              borderRadius:10,
                              padding:'10px 12px',
                              fontSize:13,
                              fontWeight:600,
                              cursor:'pointer',
                            }}>
                            Refund
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                ) : pendingTotalCents > 0 ? (
                  /* PENDING STATE: link sent, waiting */
                  <div style={{
                    background:'linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 100%)',
                    border:'1.5px solid #FCD34D',
                    borderRadius:16,
                    padding:'16px 18px',
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:20}}>📲</span>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:'Georgia, serif',fontSize:16,fontWeight:600,color:'#78350F'}}>Pay link sent · ${(pendingTotalCents/100).toFixed(2)}</div>
                        <div style={{fontSize:12,color:'#92400E',marginTop:2,fontStyle:'italic',fontFamily:'Georgia, serif'}}>Awaiting client payment</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* UNPAID STATE. Phase 13.8 (HK May 17 2026):
                      Checkout (primary, filled) and Mark paid (secondary,
                      outlined) as two stacked peer buttons. Previously
                      Mark paid was hidden as italic text below the
                      Checkout button which read as a decorative label
                      rather than a tappable action. */
                  <div style={{
                    background:'linear-gradient(180deg, #FCFAF5 0%, #F7F3EA 100%)',
                    border:'1.5px solid #E8DFC9',
                    borderRadius:16,
                    padding:'14px 14px',
                    display:'flex',
                    flexDirection:'column',
                    gap:8,
                  }}>
                    <button onClick={()=>setShowCheckout(true)}
                      style={{
                        width:'100%',
                        background:'linear-gradient(135deg, #2A5741 0%, #1F4030 100%)',
                        color:'#fff',
                        border:'none',
                        borderRadius:12,
                        padding:'14px 18px',
                        fontSize:15,
                        fontWeight:700,
                        cursor:'pointer',
                        boxShadow:'0 4px 14px rgba(31,64,48,0.28), 0 1px 0 rgba(255,255,255,0.15) inset',
                        letterSpacing:'0.01em',
                      }}>
                      Checkout
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ─────────── QUIET ACTIONS CLUSTER ───────────
                Reschedule, No-Show, Cancel: small ghost buttons in a row.
                Lower visual weight than Checkout, but still accessible.
                HK May 25 2026 (Phase 21 G3): when the session is
                completed, a 'Book next session' button appears at
                the top of this cluster (sage outline, not ghost) so
                the therapist can close the loop. Also present inside
                the Recap panel for the recap-writing moment. */}
            {!appt.preview && !confirmCancel && currentSession?.completed && (
              <button
                onClick={() => onReschedule({ ...appt, isRebook: true })}
                style={{
                  width: '100%',
                  marginTop: 6,
                  background: '#fff',
                  color: '#2A5741',
                  border: '1.5px solid #D6E0D4',
                  borderRadius: 12,
                  padding: '11px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>📅</span> Book next session with {appt.client?.split(' ')[0] || 'this client'}
              </button>
            )}
            {!appt.preview && !confirmCancel && (
              <div style={{display:'flex',gap:8,marginTop:4,paddingTop:14,borderTop:`1px solid ${SO.border}`}}>
                <button onClick={() => onReschedule(appt)}
                  style={{...btnSecondary, flex:1, padding:'9px 8px', fontSize:12, display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                  <span style={{fontSize:12}}>📅</span> Reschedule
                </button>
                {canMarkNoShow && (
                  <button onClick={() => openCancelFlow({ isNoShow: true })}
                    style={{...btnSecondary, flex:1, padding:'9px 8px', fontSize:12, color:SO.warn, borderColor:SO.warnBorder, display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                    <span style={{fontSize:12}}>🚫</span> No-show
                  </button>
                )}
                <button onClick={() => openCancelFlow()}
                  style={{...btnSecondary, flex:1, padding:'9px 8px', fontSize:12, color:SO.inkMute, borderColor:'#E5E7EB', display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                  <span style={{fontSize:12}}>✕</span> Cancel
                </button>
              </div>
            )}
            {!appt.preview && confirmCancel && (
              <div style={{background:'#FEF2F2',border:'1.5px solid #FECACA',borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#991B1B',marginBottom:10}}>Cancel this appointment?</div>
                <div style={{fontSize:12,color:'#DC2626',marginBottom:14,lineHeight:1.5}}>
                  {appt.client} · {appt.time} on {appt.date?.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => setConfirmCancel(false)}
                    style={{flex:1,padding:'9px 0',borderRadius:8,border:'1.5px solid #D1D5DB',background:'#fff',color:'#6B7280',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                    Keep it
                  </button>
                  <button onClick={cancelAppointment} disabled={cancelling}
                    style={{flex:1,padding:'9px 0',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',opacity:cancelling?0.6:1}}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {appt.preview && <div style={{background:'#FEF3C7',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#92400E',textAlign:'center'}}>Preview card, real clients appear here after booking.</div>}
        </div>
      </div>

      {showChargeModal && chargeContext && (
        <CancellationChargeModal
          booking={chargeContext.booking}
          client={chargeContext.client}
          therapist={therapist}
          sessionPriceCents={chargeContext.sessionPriceCents}
          isNoShow={!!chargeContext.isNoShow}
          onClose={() => setShowChargeModal(false)}
          onCancelled={() => {
            setShowChargeModal(false);
            onCancelled?.();
            onClose();
          }}
        />
      )}
      {showCheckout && (
        <CheckoutModal
          appt={displayAppt}
          therapist={therapist}
          client={clientRow}
          defaultAmountCents={defaultAmountCents}
          onClose={() => setShowCheckout(false)}
          onPaid={() => { refreshPayments(); }}
          onClientLinked={(picked) => {
            // HK May 24 2026 (Phase 13.12b): the inline ClientPicker
            // updated bookings.client_id + client_name + client_email
            // + client_phone in the DB. Patch our local displayAppt
            // so the slide-over header re-renders with the picked
            // client's name immediately. The schedule grid still has
            // the old name cached in its dayAppts state; it refreshes
            // on the next interaction or full reload.
            setDisplayAppt(prev => ({
              ...prev,
              clientId: picked.id,
              client: picked.name || prev.client,
              email: picked.email || prev.email,
              phone: picked.phone || prev.phone,
            }));
          }}
        />
      )}
      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          therapist={therapist}
          onClose={() => setRefundTarget(null)}
          onRefunded={() => { refreshPayments(); }}
        />
      )}
    </>
  );
}

function TimelineView({ therapist, allAppts, dayOffset, setDayOffset, today, onReschedule, onRefresh, blockedDays = [], onCreateBlock, onScheduleAtTime }) {
  const [selected,setSelected] = useState(null);
  const [showLegend,setShowLegend] = useState(false);
  // Phase 9.2 long-press → create block. Tracking the active press and
  // the resulting draft block being confirmed in a sheet.
  const longPressTimerRef = useRef(null);
  const longPressOriginRef = useRef(null);
  const [pendingBlock, setPendingBlock] = useState(null);  // {date, startTime, endTime, note}
  const [blockSheetSaving, setBlockSheetSaving] = useState(false);
  const [blockSheetError, setBlockSheetError] = useState('');
  const scrollRef = useRef(null);
  const isMobile = window.innerWidth < 900;
  const now = new Date();
  const nowMin = dayOffset===0 ? now.getHours()*60+now.getMinutes() : -1;
  const viewDate = addDays(today,dayOffset);
  const dayAppts = allAppts.filter(a=>sameDay(a.date,viewDate));
  const sorted = [...dayAppts].sort((a,b)=>t2m(a.time)-t2m(b.time));

  const starts = dayAppts.map(a=>t2m(a.time));
  const ends = dayAppts.map(a=>t2m(a.time)+a.duration);
  // Full working-day window. Per founder playbook: showing empty
  // time is the point. Compressing the calendar to first/last
  // booking hides the gaps that Fill This Gap is meant to surface.
  // Default 8 AM to 7 PM. Stretches earlier or later only if a
  // booking falls outside that range.
  const DEFAULT_START = 8 * 60;   // 8:00 AM
  const DEFAULT_END   = 19 * 60;  // 7:00 PM
  const TL_START = starts.length ? Math.min(DEFAULT_START, Math.min(...starts) - 30) : DEFAULT_START;
  const TL_END   = ends.length   ? Math.max(DEFAULT_END,   Math.max(...ends) + 45)   : DEFAULT_END;
  const PX = 0.85;
  const H = (TL_END-TL_START)*PX;
  const GUTTER = 48;

  const gaps = [];
  // Pre-day open block (before first booking). Per founder playbook:
  // showing open time is the point of the calendar, since Fill This
  // Gap is the differentiating feature. Don't hide unbooked stretches.
  if (sorted.length > 0) {
    const firstStart = t2m(sorted[0].time);
    if (firstStart - TL_START > 90) {
      gaps.push({ start: TL_START, end: firstStart, mins: firstStart - TL_START });
    }
  }
  for(let i=0;i<sorted.length-1;i++){
    const aEnd=t2m(sorted[i].time)+sorted[i].duration;
    const bStart=t2m(sorted[i+1].time);
    if(bStart-aEnd>90) gaps.push({start:aEnd,end:bStart,mins:bStart-aEnd});
  }
  // Post-day open block (after last booking to end of working day).
  if (sorted.length > 0) {
    const lastEnd = t2m(sorted[sorted.length-1].time) + sorted[sorted.length-1].duration;
    if (TL_END - lastEnd > 90) {
      gaps.push({ start: lastEnd, end: TL_END, mins: TL_END - lastEnd });
    }
  }
  const hourNums = [];
  for(let h=Math.floor(TL_START/60);h<=Math.ceil(TL_END/60);h++) hourNums.push(h);

  const DAY_RANGE = [-7,-6,-5,-4,-3,-2,-1,0,1,2,3];

  useEffect(()=>{
    if(scrollRef.current){
      const todayBtn = scrollRef.current.querySelector('[data-istoday="true"]');
      if(todayBtn) todayBtn.scrollIntoView({behavior:'auto',block:'nearest',inline:'center'});
    }
  },[]);

  const fmtDayLabel = (offset) => {
    const d = addDays(today, offset);
    if (offset === 0) return 'Today';
    if (offset === -1) return 'Yesterday';
    if (offset === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
  };

  // Phase 9.2: long-press to create a block.
  //
  // The TimelineView canvas is a pixel-based positional layout where
  // y-coordinate maps linearly to a minute-of-day via TL_START + (y/PX).
  // To convert a press location into a sensible block: take that
  // minute, snap to the nearest 15-min boundary, default to a 60-min
  // duration, surface a confirm sheet so the therapist can tweak the
  // end time and add a reason before saving.
  //
  // Long-press timing: 500ms. Cancelled on pointermove >10px (so a
  // scroll gesture doesn't accidentally create a block) or on pointerup
  // before the timer fires.

  const viewDateStr = (() => {
    const d = addDays(today, dayOffset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  // Partial blocks for THIS day, drawn onto the canvas as amber
  // stripes so the therapist sees their own blocks in context with
  // bookings. Full-day blocks are not drawn here (the whole canvas
  // would be amber).
  const myBlocksToday = (blockedDays || []).filter(b => {
    if (b.date !== viewDateStr) return false;
    return b.start_time && b.end_time;
  });

  // Full-day blocks (HK May 21 2026, Jackie feedback). Previously the
  // timeline only rendered partial-time blocks; full-day blocks just
  // disappeared from the day view, leaving the therapist with a 'No
  // sessions this day' empty state and no indication anything was
  // blocked. Now we render the whole canvas as an amber band with the
  // reason label centered.
  const myFullDayBlocksToday = (blockedDays || []).filter(b => {
    if (b.date !== viewDateStr) return false;
    return !b.start_time && !b.end_time;
  });

  const snapTo15 = (mins) => Math.round(mins / 15) * 15;

  const minutesToTimeStr = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const fmtTime12 = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hh = parseInt(h, 10);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const hr = hh % 12 === 0 ? 12 : hh % 12;
    return `${hr}:${m} ${ampm}`;
  };

  const startLongPress = (e) => {
    // Don't long-press on past days: blocking the past is meaningless.
    if (dayOffset < 0) return;
    // Don't long-press if no onCreateBlock callback wired in. Defensive.
    if (!onCreateBlock) return;
    // Don't trigger if the press landed on an interactive child (a
    // booking card, a refresh button, etc). React's synthetic event
    // bubbles up, so check the original target's element chain.
    const target = e.target;
    if (target.closest('[data-appt-card="1"]')) return;
    if (target.closest('button')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (clientY == null) return;
    const y = clientY - rect.top;
    longPressOriginRef.current = { x: e.clientX, y: clientY };

    longPressTimerRef.current = setTimeout(() => {
      const minsRaw = TL_START + (y / PX);
      // Clamp inside the visible window.
      const minsClamped = Math.max(TL_START, Math.min(TL_END - 60, minsRaw));
      const startMins = snapTo15(minsClamped);
      const endMins = Math.min(startMins + 60, TL_END);
      setBlockSheetError('');
      setPendingBlock({
        date: viewDateStr,
        startTime: minutesToTimeStr(startMins),
        endTime: minutesToTimeStr(endMins),
        note: '',
      });
      longPressTimerRef.current = null;
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  };

  const onPressMove = (e) => {
    // Cancel the pending long-press if the user scrolls/drags.
    if (!longPressOriginRef.current) return;
    const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (clientY == null) return;
    if (Math.abs(clientY - longPressOriginRef.current.y) > 10) {
      cancelLongPress();
    }
  };

  const confirmPendingBlock = async () => {
    if (!pendingBlock) return;
    if (!onCreateBlock) {
      setBlockSheetError('Cannot save: handler missing.');
      return;
    }
    setBlockSheetSaving(true);
    setBlockSheetError('');
    const result = await onCreateBlock({
      date: pendingBlock.date,
      startTime: pendingBlock.startTime,
      endTime: pendingBlock.endTime,
      note: pendingBlock.note,
    });
    setBlockSheetSaving(false);
    if (result) {
      setPendingBlock(null);
      // Trigger a fetch so the canvas redraws with the new block.
      if (onRefresh) onRefresh();
    } else {
      setBlockSheetError('Could not save the block. Please check the times and try again.');
    }
  };

  return (
    <div style={{ paddingBottom: window.innerWidth < 768 ? 'calc(74px + env(safe-area-inset-bottom, 0px) + 24px)' : 0 }}>
      {/* Date navigation header with prev/next arrows */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,gap:8}}>
        <button onClick={()=>setDayOffset(d=>d-1)}
          style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 14px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937',flexShrink:0}}>
          ← Prev
        </button>
        <div style={{textAlign:'center',flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{fmtDayLabel(dayOffset)}</div>
          {dayOffset !== 0 && (
            <button onClick={()=>setDayOffset(0)}
              style={{background:'none',border:'none',fontSize:11,color:'#6B9E80',fontWeight:600,cursor:'pointer',padding:'2px 0'}}>
              Back to Today
            </button>
          )}
        </div>
        <button onClick={()=>setDayOffset(d=>d+1)}
          style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 14px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937',flexShrink:0}}>
          Next →
        </button>
      </div>

      {/* Scrollable day picker. HK May 14: the floating corner badge
          looked spammy. Moved the count back inside the card as a
          quiet line under the date, half the size of the date. Reads
          like 'Today 14 / 5 appts' top-to-bottom with strong type
          hierarchy. */}
      <div ref={scrollRef} style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
        {DAY_RANGE.map(i=>{
          const d=addDays(today,i);
          const count=allAppts.filter(a=>sameDay(a.date,d)&&!a.preview).length;
          // Full-day block indicator (HK May 21 2026, Jackie feedback).
          // Day strip previously showed only the appointment count; now
          // we surface 'Blocked' under the date when a full-day block
          // exists for that date so blocks are scannable across the
          // strip without tapping each day.
          const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const isBlocked = (blockedDays || []).some(b => b.date === dateStr && !b.start_time && !b.end_time);
          const isSel=i===dayOffset;
          const isToday=i===0;
          const isPast=i<0;
          return (
            <button key={i} data-istoday={isToday?'true':undefined} onClick={()=>setDayOffset(i)}
              style={{flexShrink:0,background:isSel?'#2A5741':isBlocked?'#FEF3C7':'#fff',color:isSel?'#fff':isPast?'#9CA3AF':'#1F2937',border:`1.5px solid ${isSel?'#2A5741':isBlocked?'#FCD34D':'#E5E7EB'}`,borderRadius:10,padding:'8px 10px',cursor:'pointer',minWidth:60,textAlign:'center',transition:'all 0.15s',opacity:isPast&&!isSel?0.85:1}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',opacity:0.75,marginBottom:2,letterSpacing:'0.04em'}}>
                {i===0?'Today':i===-1?'Yest':i===1?'Tmrw':d.toLocaleDateString('en-US',{weekday:'short'})}
              </div>
              <div style={{fontSize:15,fontWeight:700,lineHeight:1.1}}>{d.getDate()}</div>
              <div style={{fontSize:10,fontWeight:600,marginTop:3,opacity: isBlocked ? 1 : (count>0?0.7:0.3), color: isBlocked && !isSel ? '#92400E' : undefined}}>
                {isBlocked ? '🌿 Blocked' : (count > 0 ? `${count} appt${count!==1?'s':''}` : '·')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend, collapsible. HK May 14 2026: the legend was always
          on, ate ~50px every render. Now hidden by default behind a
          'Legend' pill. Calendar gets the space back. */}
      <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>setShowLegend(v=>!v)}
          style={{display:'inline-flex',alignItems:'center',gap:5,background:showLegend?'#F0FDF4':'#fff',border:`1px solid ${showLegend?'#BBF7D0':'#E5E7EB'}`,borderRadius:14,padding:'4px 10px',fontSize:11,color:showLegend?'#16A34A':'#6B7280',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
          <span style={{fontSize:10}}>{showLegend?'▾':'▸'}</span>
          Legend
        </button>
        {showLegend && (
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',padding:'6px 10px',background:'#fff',borderRadius:8,border:'1px solid #F3F4F6',flex:1,minWidth:0}}>
            {[{color:'#16A34A',bg:'#DCFCE7',label:'Brief ready'},{color:'#D97706',bg:'#FEF3C7',label:'No intake yet'},{color:'#6B7280',bg:'#F3F4F6',label:'Complete'},{color:'#7F77DD',bg:'#EFEAFD',label:'From Google'}].map(({color,bg,label})=>(
              <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:10,height:10,borderRadius:3,background:bg,border:`1.5px solid ${color}`}}/>
                <span style={{fontSize:11,color:'#6B7280'}}>{label}</span>
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:10,height:10,borderRadius:3,background:'#F8F8F8',border:'1.5px dashed #CBD5E1'}}/>
              <span style={{fontSize:11,color:'#9CA3AF'}}>Preview</span>
            </div>
          </div>
        )}
      </div>

      <div style={{background:'#FBF8F1',borderRadius:16,padding:'16px 14px 20px',border:'1px solid #EEF2F7'}}>
        <div
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerMove={onPressMove}
          style={{position:'relative',height:H,marginLeft:GUTTER,touchAction:'pan-y',userSelect:'none',WebkitUserSelect:'none'}}
        >
          {hourNums.map(h=>{
            const y=(h*60-TL_START)*PX;
            const label=h===12?'12 PM':h<12?`${h} AM`:`${h-12} PM`;
            return (
              <div key={h}>
                <div style={{position:'absolute',top:y,left:-GUTTER,width:GUTTER-6,textAlign:'right',fontSize:10,fontWeight:600,color:'#9CA3AF',transform:'translateY(-50%)',userSelect:'none'}}>{label}</div>
                <div style={{position:'absolute',top:y,left:0,right:0,borderTop:'1px solid #F3F4F6'}}/>
              </div>
            );
          })}

          {/* Full-day block render (HK May 21 2026, Jackie feedback).
              When a full-day block exists for the viewed date, paint
              the entire timeline canvas amber and label it with the
              reason. Visually distinguishes 'blocked day' from
              'empty day with no work scheduled'. */}
          {myFullDayBlocksToday.length > 0 && (
            <div
              data-appt-card="1"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: H,
                background: 'repeating-linear-gradient(45deg, rgba(217,119,6,0.08), rgba(217,119,6,0.08) 8px, rgba(217,119,6,0.16) 8px, rgba(217,119,6,0.16) 16px)',
                border: '1.5px solid rgba(217,119,6,0.4)',
                borderRadius: 12,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <div style={{
                position: 'absolute',
                top: 18,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: '#92400E',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                🌿 Day blocked off
              </div>
              {myFullDayBlocksToday[0].note && (
                <div style={{
                  position: 'absolute',
                  top: 46,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#9A3412',
                  fontStyle: 'italic',
                }}>
                  {myFullDayBlocksToday[0].note}
                </div>
              )}
            </div>
          )}

          {/* Phase 9.2: render the therapist's own partial-day blocks
              as amber-tinted bands. They sit underneath bookings (which
              shouldn't overlap them anyway, but defensive). */}
          {myBlocksToday.map(b => {
            const [sh, sm] = b.start_time.slice(0,5).split(':').map(Number);
            const [eh, em] = b.end_time.slice(0,5).split(':').map(Number);
            const startMin = sh * 60 + sm;
            const endMin = eh * 60 + em;
            const y = (startMin - TL_START) * PX;
            const bh = (endMin - startMin) * PX;
            return (
              <div
                key={`my-block-${b.id}`}
                data-appt-card="1"
                style={{
                  position: 'absolute',
                  top: y,
                  left: 0,
                  right: 0,
                  height: bh,
                  background: 'repeating-linear-gradient(45deg, rgba(217,119,6,0.08), rgba(217,119,6,0.08) 6px, rgba(217,119,6,0.18) 6px, rgba(217,119,6,0.18) 12px)',
                  border: '1.5px solid rgba(217,119,6,0.45)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 14,
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🌿 Blocked {fmtTime12(b.start_time.slice(0,5))} to {fmtTime12(b.end_time.slice(0,5))}
                  {b.note ? <span style={{ marginLeft: 8, fontStyle: 'italic', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color:'#9A3412' }}>· {b.note}</span> : null}
                </div>
              </div>
            );
          })}

          {/* Hint pill for empty days: stays inside the canvas so the
              long-press surface is preserved. Suppressed when a full-
              day block is present (the amber band already signals the
              state more clearly than the empty-state text). */}
          {dayAppts.length === 0 && myFullDayBlocksToday.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              padding: '20px 28px',
              pointerEvents: 'none',
              maxWidth: 320,
            }}>
              <div style={{fontSize:28,marginBottom:8}}>🌿</div>
              <div style={{fontSize:14,fontWeight:600,color:'#1F2937',marginBottom:4}}>
                No sessions {dayOffset===0?'today':'this day'}
              </div>
              <div style={{fontSize:12,color:'#9CA3AF',lineHeight:1.5}}>
                {dayOffset >= 0
                  ? 'Long-press anywhere on this column to block off time, or share your booking link to fill your schedule.'
                  : 'Past day. No sessions on the books.'}
              </div>
            </div>
          )}

          {gaps.map((g,i)=>{
            const y=(g.start-TL_START)*PX;
            const gh=g.mins*PX;
            const hrs=Math.floor(g.mins/60), mins=g.mins%60;
            // Two visual treatments by length:
            //   <= 90 min: amber stripes + 'book here' urgency (real fillable gap)
            //   > 90 min: soft amber tint + 'Open · Nh available' (general open time)
            // Either way the eye sees the schedule has space.
            const isShortGap = g.mins <= 90;
            const lbl=hrs>0?(mins>0?`${hrs}h ${mins}m`:`${hrs}h`):`${mins}m`;
            return (
                <div key={i} style={{
                  position:'absolute',
                  top:y,
                  left:0,
                  right:0,
                  height:gh,
                  background: isShortGap
                    ? 'repeating-linear-gradient(45deg,transparent,transparent 5px,#FFFBEB 5px,#FFFBEB 6px)'
                    : 'linear-gradient(180deg, rgba(254,243,199,0.35) 0%, rgba(254,243,199,0.18) 100%)',
                  border: isShortGap ? '1px dashed #FCD34D' : '1px dashed rgba(252,211,77,0.45)',
                  borderRadius:8,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  opacity: isShortGap ? 0.9 : 1,
                }}>
                  {gh>18 && (
                    isShortGap ? (
                      <span style={{fontSize:10,fontWeight:700,color:'#D97706',background:'#FFFBEB',padding:'2px 8px',borderRadius:20,border:'1px solid #FCD34D'}}>
                        ⚡ {lbl} open · fill this gap
                      </span>
                    ) : (
                      <span style={{fontSize:11,fontWeight:600,color:'#92400E',letterSpacing:'0.04em'}}>
                        Open · {lbl} available
                      </span>
                    )
                  )}
                </div>
              );
            })}
            {nowMin>=TL_START&&nowMin<=TL_END&&(
              <div style={{position:'absolute',top:(nowMin-TL_START)*PX,left:-6,right:0,zIndex:10,pointerEvents:'none',display:'flex',alignItems:'center'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#EF4444',flexShrink:0}}/>
                <div style={{flex:1,height:2,background:'#EF4444',opacity:0.6}}/>
              </div>
            )}
            {sorted.map(appt=>{
              const y=(t2m(appt.time)-TL_START)*PX;
              const bh=Math.max(appt.duration*PX,36);
              const st=STATUS[appt.status]||STATUS['pending-intake'];
              const isSel=selected?.id===appt.id;
              const isPast=dayOffset===0&&t2m(appt.time)+appt.duration<nowMin;
              return (
                <div key={appt.id} data-appt-card="1" onClick={()=>setSelected(isSel?null:appt)}
                  style={{position:'absolute',top:y,left:2,right:2,height:bh,
                    background:appt.preview?'#F9FAFB':(appt.paid?'#F0F6EE':appt.status==='intake-done'?'#DCFCE7':appt.status==='complete'?'#F3F4F6':'#FEF3C7'),
                    border:`1.5px ${appt.preview?'dashed':'solid'} ${appt.preview?'#D1D5DB':appt.paid?'#B7D1AB':st.dot}`,
                    borderLeft:`4px solid ${appt.preview?'#CBD5E1':appt.paid?'#2A5741':st.dot}`,
                    borderRadius:10,cursor:'pointer',overflow:'hidden',
                    opacity:appt.preview?0.5:isPast?0.6:1,
                    boxShadow:isSel?'0 4px 20px rgba(0,0,0,0.15)':appt.preview?'none':'0 2px 8px rgba(0,0,0,0.07)',
                    transform:isSel?'scale(1.01)':'none',zIndex:isSel?5:1,transition:'all 0.15s'}}>
                  <div style={{padding:'5px 10px',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                      <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:0}}>
                        <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,background:appt.preview?'#D1D5DB':ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>{initials(appt.client)}</div>
                        <span style={{fontSize:12,fontWeight:700,color:appt.preview?'#9CA3AF':'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.client}</span>
                        {appt.preview&&<span style={{fontSize:9,fontWeight:700,color:'#94A3B8',background:'#F1F5F9',borderRadius:4,padding:'1px 5px',flexShrink:0}}>PREVIEW</span>}
                      </div>
                      <div style={{flexShrink:0,textAlign:'right'}}>
                        <div style={{fontSize:11,fontWeight:700,color:appt.preview?'#C4C4C4':'#1F2937'}}>{appt.time}</div>
                        <div style={{fontSize:10,color:'#9CA3AF'}}>{appt.duration}m</div>
                        {!appt.preview&&appt.reminder_sent&&<div style={{fontSize:9,color:'#16A34A',fontWeight:700,marginTop:1}}>📧 Sent</div>}
                        {!appt.preview&&!appt.reminder_sent&&<div style={{fontSize:9,color:'#9CA3AF',marginTop:1}}>📧 Pending</div>}
                      </div>
                    </div>
                    {bh>52&&<div style={{fontSize:11,color:appt.preview?'#C4C4C4':st.color,marginLeft:30}}>
                      {appt.service}
                      {appt.locationName && <span style={{ color: '#9CA3AF', fontWeight: 500 }}> · 📍 {appt.locationName}</span>}
                    </div>}
                    {bh>72&&(
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{background:appt.preview?'transparent':st.dot+'22',color:appt.preview?'#C4C4C4':st.color,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{st.icon} {appt.preview?'Preview':st.label}</div>
                        {!appt.preview&&appt.paid&&<div style={{fontSize:10,fontWeight:700,color:'#15803D',background:'#DCFCE7',borderRadius:20,padding:'2px 8px',display:'flex',alignItems:'center',gap:3}}>✓ Paid ${(appt.paid_cents/100).toFixed(0)}</div>}
                        {!appt.preview&&!appt.paid&&appt.deposit_required&&!appt.deposit_paid&&<div style={{fontSize:9,fontWeight:700,color:'#D97706',background:'#FEF3C7',borderRadius:20,padding:'2px 8px'}}>💳 Deposit due</div>}
                        {!appt.preview&&appt.status==='intake-done'&&<div style={{fontSize:10,fontWeight:700,color:'#2A5741',background:'#DCFCE7',borderRadius:20,padding:'2px 8px'}}>Brief ready →</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      </div>

      {/* Phase 9.2: long-press confirm sheet. Centered modal with the
          proposed time, an editable end time, an optional reason, and
          a Block button. Pre-filled with a 60-min window snapped to
          the nearest 15-min boundary from where the user pressed. */}
      {pendingBlock && (
        <>
          <div
            onClick={()=>!blockSheetSaving && setPendingBlock(null)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:300,backdropFilter:'blur(2px)'}}
          />
          <div style={{
            position:'fixed',
            top:'50%',
            left:'50%',
            transform:'translate(-50%, -50%)',
            background:'#fff',
            borderRadius:14,
            padding:'24px 26px',
            boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
            zIndex:301,
            width:'min(420px, calc(100vw - 32px))',
            maxWidth:420,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
              <div style={{ fontSize:24 }}>🌿</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:18, fontWeight:700, color:'#1F2937', fontFamily:'Georgia,serif' }}>What would you like to do?</div>
                <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                  {new Date(pendingBlock.date+'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })} at {fmtTime12(pendingBlock.startTime)}
                </div>
              </div>
            </div>

            {/* Two editable time fields, side by side. Both use the
                InlineTimeInput component so they accept typed values
                like "10am" or "2:30pm" instead of relying on the
                native browser time dropdown. Placeholders show a
                realistic time example so older users see the expected
                format including AM/PM. */}
            <div style={{ display:'flex', alignItems:'flex-end', gap:12, marginBottom:14, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 130px', minWidth:120 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
                  Start
                </label>
                <InlineTimeInput
                  value={pendingBlock.startTime}
                  onChange={(t) => setPendingBlock(prev => prev ? { ...prev, startTime: t } : prev)}
                  placeholder="10:00 AM"
                  ariaLabel="Start time of blocked window"
                  width="100%"
                  disabled={blockSheetSaving}
                />
              </div>
              <div style={{ paddingBottom: 10, fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:14, color:'#6B7280' }}>to</div>
              <div style={{ flex:'1 1 130px', minWidth:120 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
                  End
                </label>
                <InlineTimeInput
                  value={pendingBlock.endTime}
                  onChange={(t) => setPendingBlock(prev => prev ? { ...prev, endTime: t } : prev)}
                  placeholder="2:00 PM"
                  ariaLabel="End time of blocked window"
                  width="100%"
                  disabled={blockSheetSaving}
                />
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
                Reason (optional)
              </label>
              <input
                type="text"
                value={pendingBlock.note}
                onChange={e=>setPendingBlock(prev => prev ? { ...prev, note: e.target.value } : prev)}
                placeholder="Lunch, errand, personal time"
                disabled={blockSheetSaving}
                style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E8E4DC', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', background:'#FBFAF4', fontStyle:'italic', fontFamily:'system-ui, -apple-system, sans-serif' }}
              />
            </div>

            {blockSheetError && (
              <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#991B1B', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:12 }}>
                {blockSheetError}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={()=>setPendingBlock(null)}
                disabled={blockSheetSaving}
                style={{ flex:1, background:'#F3F4F6', color:'#4B5563', border:'none', padding:'12px', borderRadius:10, fontSize:14, fontWeight:700, cursor:blockSheetSaving?'not-allowed':'pointer' }}
              >Cancel</button>
              <button
                onClick={confirmPendingBlock}
                disabled={blockSheetSaving || pendingBlock.endTime <= pendingBlock.startTime}
                style={{
                  flex:2,
                  background: (blockSheetSaving || pendingBlock.endTime <= pendingBlock.startTime) ? '#D1D5DB' : '#2A5741',
                  color:'#fff', border:'none', padding:'12px', borderRadius:10,
                  fontSize:14, fontWeight:700,
                  cursor:(blockSheetSaving || pendingBlock.endTime <= pendingBlock.startTime) ? 'not-allowed' : 'pointer',
                }}
              >
                {blockSheetSaving ? 'Saving…' : 'Block this time'}
              </button>
            </div>

            {/* Phase 9.3 (HK May 18 2026): alternative path. Instead
                of blocking this time, the therapist may want to
                schedule a client at it. One tap closes this sheet
                and opens BookingModal with date + start time
                pre-filled. */}
            <button
              onClick={() => {
                if (blockSheetSaving) return;
                if (onScheduleAtTime) {
                  onScheduleAtTime({
                    date: pendingBlock.date,
                    startTime: pendingBlock.startTime,
                  });
                }
                setPendingBlock(null);
              }}
              disabled={blockSheetSaving}
              style={{
                width: '100%',
                marginTop: 10,
                background: '#fff',
                color: '#2A5741',
                border: '1.5px solid #2A5741',
                padding: '10px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: blockSheetSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <span>📅</span>
              <span>Schedule a session at this time instead</span>
            </button>

            <div style={{ fontSize:11, color:'#9CA3AF', textAlign:'center', marginTop:12, fontStyle:'italic', fontFamily:'Georgia,serif', lineHeight:1.5 }}>
              Clients cannot book during this window. You'll still see existing bookings in this range if any overlap.
            </div>
          </div>
        </>
      )}

      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{setSelected(null);onReschedule&&onReschedule(a);}} onCancelled={()=>{setSelected(null);if(typeof onRefresh==='function')onRefresh();}}/>}
    </div>
  );
}

function WeeklyView({ therapist, appointments, today, onReschedule, onRefresh, blockedDays = [] }) {
  const APPTS=appointments||[];
  const [weekOffset,setWeekOffset]=useState(0);
  const [selected,setSelected]=useState(null);
  const [showLegend,setShowLegend]=useState(false);
  const isMobile=window.innerWidth<640;
  const getMonday=d=>{const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()+(day===0?-6:1-day));x.setHours(0,0,0,0);return x;};
  const weekStart=addDays(getMonday(today),weekOffset*7);
  const weekDays=[0,1,2,3,4,5,6].map(n=>addDays(weekStart,n));
  const DAY_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DAY_NAMES_FULL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const weekAppts=APPTS.filter(a=>a.date>=weekStart&&a.date<addDays(weekStart,7));
  const realWeek=weekAppts.filter(a=>!a.preview);

  // Blocked-day classification (HK May 22 2026 Tier 1 item 2).
  // Returns { fullDay: bool, partial: bool, reasons: [string] }
  // - fullDay = at least one row covers the whole day (no start/end)
  // - partial = at least one row with a start_time/end_time window
  // Both flags can be true (e.g. all-day off PLUS a separate hour
  // block). Reasons get concatenated for the tooltip / aria label.
  function blockedFor(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const rows = (blockedDays || []).filter(b => b.date === dateStr);
    if (!rows.length) return { fullDay: false, partial: false, reasons: [] };
    const fullDay = rows.some(b => !b.start_time && !b.end_time);
    const partial = rows.some(b => b.start_time || b.end_time);
    const reasons = rows.map(b => b.reason).filter(Boolean);
    return { fullDay, partial, reasons };
  }
  return (
    <div>
      {/* Legend, collapsible. Off by default for vertical space. */}
      <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>setShowLegend(v=>!v)}
          style={{display:'inline-flex',alignItems:'center',gap:5,background:showLegend?'#F0FDF4':'#fff',border:`1px solid ${showLegend?'#BBF7D0':'#E5E7EB'}`,borderRadius:14,padding:'4px 10px',fontSize:11,color:showLegend?'#16A34A':'#6B7280',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
          <span style={{fontSize:10}}>{showLegend?'▾':'▸'}</span>
          Legend
        </button>
        {showLegend && (
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',padding:'6px 10px',background:'#fff',borderRadius:8,border:'1px solid #F3F4F6',flex:1,minWidth:0}}>
            {[{color:'#16A34A',bg:'#DCFCE7',label:'Brief ready'},{color:'#D97706',bg:'#FEF3C7',label:'No intake yet'},{color:'#6B7280',bg:'#F3F4F6',label:'Complete'},{color:'#7F77DD',bg:'#EFEAFD',label:'From Google'}].map(({color,bg,label})=>(
              <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:10,height:10,borderRadius:3,background:bg,border:`1.5px solid ${color}`}}/>
                <span style={{fontSize:11,color:'#6B7280'}}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={()=>setWeekOffset(w=>w-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← Prev</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{weekOffset===0?'This Week':weekOffset===1?'Next Week':weekOffset===-1?'Last Week':fmtShort(weekStart)}</div>
          <div style={{fontSize:12,color:'#6B7280'}}>
            {realWeek.length} sessions{realWeek.length>0?` · ~$${realWeek.reduce((s,a)=>s+(a.price||85),0)}`:''}
          </div>
        </div>
        <button onClick={()=>setWeekOffset(w=>w+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>Next →</button>
      </div>

      {/* Explanatory banner when the displayed week is empty AND
          is current or future. Past weeks intentionally don't show
          this (imported history may be sparse and that's not
          confusing). HK May 14 2026: 'past weeks are there, but
          there's nothing after today for the coming weeks' from
          Candice. The empty state read as a sync bug. HK May 24
          2026: removed the 'CSV imports don't carry future bookings'
          line because imports DO carry future bookings - Terra's
          CSV brought in June and September 2026 appointments. The
          old wording was wrong and misleading. */}
      {realWeek.length === 0 && weekOffset >= 0 && (
        <div style={{
          background:'#FEFCE8',
          border:'1px solid #FDE68A',
          borderRadius:10,
          padding:'12px 14px',
          marginBottom:16,
          display:'flex',
          alignItems:'flex-start',
          gap:10,
        }}>
          <div style={{fontSize:18, lineHeight:1, marginTop:2}}>🌱</div>
          <div style={{flex:1, fontSize:12.5, color:'#78350F', lineHeight:1.55}}>
            <strong style={{color:'#78350F'}}>No bookings yet for {weekOffset===0?'this week':weekOffset===1?'next week':'this week'}.</strong>{' '}
            Tap <strong>Book Appointment</strong> at the top of the page to add a booking, or share your booking link so clients can book themselves.
          </div>
        </div>
      )}

      {/* MOBILE: vertical day list, full-width rows, no truncation */}
      {isMobile ? (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {weekDays.map((d,i)=>{
            const dayAppts=APPTS.filter(a=>sameDay(a.date,d));
            const realDayAppts=dayAppts.filter(a=>!a.preview);
            const isToday=sameDay(d,today);
            const block = blockedFor(d);
            const isFullBlocked = block.fullDay;
            // Border + header tint reflect: today (green) > blocked
            // (amber for full, sage for partial) > default
            const borderColor = isToday ? '#86EFAC'
              : isFullBlocked ? '#FBBF24'
              : block.partial ? '#B5D4BE'
              : '#F3F4F6';
            const headerBg = isToday ? '#F0FDF4'
              : isFullBlocked ? '#FEF3C7'
              : block.partial ? '#F0F9F4'
              : '#FAFAF7';
            const headerBorder = isToday ? '#BBF7D0'
              : isFullBlocked ? '#FDE68A'
              : block.partial ? '#D4E6DA'
              : '#F3F4F6';
            return (
              <div key={i} style={{background:'#fff',borderRadius:12,overflow:'hidden',border:`1.5px solid ${borderColor}`,boxShadow:isToday?'0 1px 3px rgba(22,163,74,0.08)':'none'}}>
                {/* Day header row */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:headerBg,borderBottom:(dayAppts.length>0||isFullBlocked||block.partial)?`1px solid ${headerBorder}`:'none'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                    <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:isToday?'#16A34A':isFullBlocked?'#92400E':'#6B7280'}}>{DAY_NAMES_FULL[i]}</div>
                    <div style={{fontSize:15,fontWeight:700,color:isToday?'#16A34A':isFullBlocked?'#92400E':'#1F2937'}}>{d.getMonth()+1}/{d.getDate()}</div>
                    {isToday && <div style={{fontSize:10,fontWeight:700,color:'#16A34A',background:'#DCFCE7',borderRadius:20,padding:'2px 8px'}}>Today</div>}
                    {!isToday && isFullBlocked && <div style={{fontSize:10,fontWeight:700,color:'#92400E',background:'#FDE68A',borderRadius:20,padding:'2px 8px'}}>🌿 Time off</div>}
                  </div>
                  <div style={{fontSize:11,color:isToday?'#16A34A':isFullBlocked?'#92400E':'#9CA3AF',fontWeight:600}}>
                    {isFullBlocked && realDayAppts.length===0
                      ? 'Day blocked'
                      : realDayAppts.length===0
                        ? (block.partial ? 'Partial block' : 'No sessions')
                        : `${realDayAppts.length} ${realDayAppts.length===1?'session':'sessions'}`}
                  </div>
                </div>

                {/* Horizontal time-strip (HK May 22 2026 Tier 3
                    mobile companion to the desktop Outlook grid).
                    7am-9pm strip with mini-bars for sessions and
                    amber bands for blocks. Visual at-a-glance
                    rhythm of the day without expanding the card. */}
                {(() => {
                  const STRIP_START = 7 * 60;  // 7am
                  const STRIP_END = 21 * 60;   // 9pm
                  const STRIP_RANGE = STRIP_END - STRIP_START;
                  // Skip strip on fully blocked days (the badge says it)
                  if (isFullBlocked && realDayAppts.length === 0) return null;
                  // Skip strip on totally empty open days
                  if (dayAppts.length === 0 && !block.partial) return null;

                  const dateStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  const dayBlockRows = (blockedDays || []).filter(b => b.date === dateStrLocal && b.start_time && b.end_time);

                  function pctLeft(mins) {
                    return Math.max(0, Math.min(100, ((mins - STRIP_START) / STRIP_RANGE) * 100));
                  }
                  function pctWidth(startMins, endMins) {
                    const left = pctLeft(startMins);
                    const right = pctLeft(endMins);
                    return Math.max(1.5, right - left);
                  }

                  return (
                    <div style={{
                      padding: '8px 14px 4px',
                      background: '#FFFFFF',
                      borderBottom: '1px dashed #E5E7EB',
                    }}>
                      {/* Strip bar */}
                      <div style={{
                        position: 'relative',
                        height: 22,
                        background: '#F5F0E8',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}>
                        {/* Hour ticks (every 3 hours: 7, 10, 1pm, 4pm, 7pm) */}
                        {[10, 13, 16, 19].map(h => (
                          <div key={h} style={{
                            position: 'absolute',
                            top: 0, bottom: 0,
                            left: `${pctLeft(h * 60)}%`,
                            width: 1,
                            background: 'rgba(120, 100, 70, 0.12)',
                          }} />
                        ))}

                        {/* Partial blocks (amber bands) */}
                        {dayBlockRows.map((b, bi) => {
                          const sM = parseInt(b.start_time.slice(0,2),10)*60 + parseInt(b.start_time.slice(3,5),10);
                          const eM = parseInt(b.end_time.slice(0,2),10)*60 + parseInt(b.end_time.slice(3,5),10);
                          return (
                            <div key={`b${bi}`}
                              title={b.reason || 'Blocked'}
                              style={{
                                position: 'absolute',
                                top: 2, bottom: 2,
                                left: `${pctLeft(sM)}%`,
                                width: `${pctWidth(sM, eM)}%`,
                                background: 'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 4px, #FDE68A 4px, #FDE68A 8px)',
                                border: '1px solid #FBBF24',
                                borderRadius: 2,
                                opacity: 0.7,
                              }}
                            />
                          );
                        })}

                        {/* Session bars */}
                        {realDayAppts.map(appt => {
                          const sM = (() => {
                            const t = appt.time || '';
                            const m = /(\d+):?(\d*)\s*(am|pm)?/i.exec(t);
                            if (!m) return -1;
                            let h = parseInt(m[1],10);
                            const mins = parseInt(m[2] || '0', 10);
                            const ap = (m[3] || '').toLowerCase();
                            if (ap === 'pm' && h < 12) h += 12;
                            if (ap === 'am' && h === 12) h = 0;
                            return h * 60 + mins;
                          })();
                          if (sM < 0) return null;
                          const dur = appt.duration || 60;
                          const eM = sM + dur;
                          const st = STATUS[appt.status] || STATUS['pending-intake'];
                          return (
                            <div key={`a${appt.id}`}
                              title={`${appt.time} · ${appt.client}`}
                              style={{
                                position: 'absolute',
                                top: 2, bottom: 2,
                                left: `${pctLeft(sM)}%`,
                                width: `${pctWidth(sM, eM)}%`,
                                background: st.dot || '#6B9E80',
                                borderRadius: 2,
                                opacity: 0.85,
                                cursor: 'pointer',
                              }}
                              onClick={(e) => { e.stopPropagation(); setSelected(appt); }}
                            />
                          );
                        })}

                        {/* "Now" line if today */}
                        {isToday && (() => {
                          const nowM = today.getHours() * 60 + today.getMinutes();
                          if (nowM < STRIP_START || nowM > STRIP_END) return null;
                          return (
                            <div style={{
                              position: 'absolute',
                              top: 0, bottom: 0,
                              left: `${pctLeft(nowM)}%`,
                              width: 2,
                              background: '#DC2626',
                              boxShadow: '0 0 4px rgba(220,38,38,0.4)',
                            }} />
                          );
                        })()}
                      </div>

                      {/* Time scale labels */}
                      <div style={{
                        position: 'relative',
                        height: 12,
                        marginTop: 1,
                      }}>
                        {['7a','10a','1p','4p','7p','9p'].map((label, idx) => {
                          const hour = [7,10,13,16,19,21][idx];
                          return (
                            <div key={label} style={{
                              position: 'absolute',
                              left: `${pctLeft(hour * 60)}%`,
                              transform: idx === 0 ? 'translateX(0)' : idx === 5 ? 'translateX(-100%)' : 'translateX(-50%)',
                              fontSize: 8.5,
                              color: '#9CA3AF',
                              fontWeight: 600,
                            }}>
                              {label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Appointment rows (or block message) */}
                {dayAppts.length===0 && isFullBlocked
                  ? <div style={{padding:'14px 16px',fontSize:12,color:'#92400E',fontStyle:'italic',textAlign:'center'}}>
                      {block.reasons.length ? block.reasons[0] : 'You blocked this day off. Booking page will not offer it.'}
                    </div>
                  : dayAppts.length===0 && block.partial
                  ? <div style={{padding:'14px 16px',fontSize:12,color:'#5C7A66',fontStyle:'italic',textAlign:'center'}}>
                      Part of this day is blocked. Booking page only offers the open windows.
                    </div>
                  : dayAppts.length===0
                  ? <div style={{padding:'14px 16px',fontSize:12,color:'#B4B4B4',fontStyle:'italic',textAlign:'center'}}>Open day</div>
                  : <div style={{display:'flex',flexDirection:'column'}}>
                      {dayAppts.map((appt,idx)=>{
                        const st=STATUS[appt.status]||STATUS['pending-intake'];
                        return (
                          <div key={appt.id} onClick={()=>!appt.preview&&setSelected(appt)}
                            style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',cursor:appt.preview?'default':'pointer',borderTop:idx>0?'1px solid #F3F4F6':'none',opacity:appt.preview?0.5:1,background:appt.preview?'#FAFAFA':'transparent'}}>
                            <div style={{width:36,height:36,borderRadius:'50%',background:appt.preview?'#D1D5DB':ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{initials(appt.client)}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                                <div style={{fontSize:14,fontWeight:700,color:appt.preview?'#9CA3AF':'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.client}</div>
                              </div>
                              <div style={{fontSize:12,color:'#6B7280',display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                                <span style={{fontWeight:600,color:appt.preview?'#9CA3AF':st.color}}>{appt.time}</span>
                                <span>·</span>
                                <span>{appt.service||'Session'}</span>
                              </div>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,flexShrink:0}}>
                              <div style={{fontSize:10,fontWeight:700,color:appt.preview?'#9CA3AF':st.color,background:appt.preview?'#F3F4F6':st.bg,padding:'3px 8px',borderRadius:20,whiteSpace:'nowrap'}}>
                                {st.icon} {appt.preview?'Preview':st.label}
                              </div>
                              {!appt.preview && <div style={{fontSize:16,color:'#D1D5DB',lineHeight:1}}>›</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            );
          })}
        </div>
      ) : (
        /* DESKTOP: Outlook-style time grid (HK May 22 2026 Tier 3).
           Time runs vertically on the left; each day is a column;
           sessions are positioned absolutely by their start time
           with height proportional to duration. Blocked windows
           render as amber bands behind sessions. Today's column
           gets a soft sage tint to anchor the eye. */
        (() => {
          // Compute the visible time window. Default 7am to 9pm.
          // Expand to fit any appointment outside that range.
          const allStarts = APPTS.map(a => t2m(a.time)).filter(n => n > 0);
          const allEnds = APPTS.map(a => t2m(a.time) + (a.duration || 60)).filter(n => n > 0);
          const DEFAULT_START = 7 * 60;  // 7am
          const DEFAULT_END   = 21 * 60; // 9pm
          const minStart = allStarts.length ? Math.min(DEFAULT_START, Math.min(...allStarts) - 30) : DEFAULT_START;
          const maxEnd   = allEnds.length ? Math.max(DEFAULT_END, Math.max(...allEnds) + 30) : DEFAULT_END;
          const winStart = Math.max(0, Math.floor(minStart / 60) * 60);     // round to hour
          const winEnd   = Math.min(24*60, Math.ceil(maxEnd / 60) * 60);
          const PX_PER_MIN = 0.85;
          const winHeight = (winEnd - winStart) * PX_PER_MIN;
          const hourLines = [];
          for (let m = winStart; m <= winEnd; m += 60) hourLines.push(m);

          function fmtHour(mins) {
            const h = Math.floor(mins / 60);
            if (h === 0) return '12 AM';
            if (h === 12) return '12 PM';
            return h > 12 ? `${h-12} PM` : `${h} AM`;
          }

          // Compute "now" line if today is in the visible week
          const nowMin = today.getHours() * 60 + today.getMinutes();
          const todayColIdx = weekDays.findIndex(d => sameDay(d, today));

          return (
            <div style={{
              background: '#fff',
              border: '1px solid #F3F4F6',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {/* Day-of-week header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '52px repeat(7, 1fr)',
                borderBottom: '1px solid #E5E7EB',
                background: '#FAFAF7',
              }}>
                <div /> {/* time gutter spacer */}
                {weekDays.map((d, i) => {
                  const dayAppts = APPTS.filter(a => sameDay(a.date, d));
                  const realCount = dayAppts.filter(a => !a.preview).length;
                  const isToday = sameDay(d, today);
                  const block = blockedFor(d);
                  return (
                    <div key={i} style={{
                      padding: '10px 8px',
                      borderLeft: '1px solid #F3F4F6',
                      textAlign: 'center',
                      background: isToday ? '#F0FDF4' : 'transparent',
                    }}>
                      <div style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: isToday ? '#16A34A' : block.fullDay ? '#92400E' : '#6B7280',
                      }}>
                        {DAY_NAMES[i]}
                      </div>
                      <div style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: isToday ? '#16A34A' : block.fullDay ? '#92400E' : '#1F2937',
                        marginTop: 1,
                      }}>
                        {d.getDate()}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: isToday ? '#16A34A' : block.fullDay ? '#92400E' : '#9CA3AF',
                        marginTop: 2,
                        fontWeight: 600,
                      }}>
                        {block.fullDay
                          ? '🌿 Off'
                          : realCount > 0
                            ? `${realCount} ${realCount === 1 ? 'session' : 'sessions'}`
                            : block.partial ? 'Partial block' : '·'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time grid body */}
              <div style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: '52px repeat(7, 1fr)',
                height: winHeight,
                overflow: 'auto',
              }}>
                {/* Time gutter */}
                <div style={{ position: 'relative', borderRight: '1px solid #F3F4F6' }}>
                  {hourLines.map((m, idx) => (
                    <div key={idx} style={{
                      position: 'absolute',
                      top: (m - winStart) * PX_PER_MIN,
                      right: 6,
                      fontSize: 10,
                      color: '#9CA3AF',
                      transform: 'translateY(-50%)',
                      whiteSpace: 'nowrap',
                    }}>
                      {fmtHour(m)}
                    </div>
                  ))}
                </div>

                {/* 7 day columns */}
                {weekDays.map((d, dayIdx) => {
                  const dayAppts = APPTS.filter(a => sameDay(a.date, d));
                  const isToday = sameDay(d, today);
                  const block = blockedFor(d);
                  // Pull blocked windows for this date (partial blocks)
                  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  const dayBlockRows = (blockedDays || []).filter(b => b.date === dateStr);

                  return (
                    <div key={dayIdx} style={{
                      position: 'relative',
                      borderLeft: '1px solid #F3F4F6',
                      background: isToday ? 'rgba(134, 239, 172, 0.06)' : block.fullDay ? 'rgba(254, 243, 199, 0.45)' : 'transparent',
                    }}>
                      {/* Hour gridlines */}
                      {hourLines.map((m, idx) => (
                        <div key={idx} style={{
                          position: 'absolute',
                          top: (m - winStart) * PX_PER_MIN,
                          left: 0, right: 0,
                          borderTop: '1px solid #F3F4F6',
                          pointerEvents: 'none',
                        }} />
                      ))}

                      {/* Blocked windows (partial blocks) */}
                      {dayBlockRows.filter(b => b.start_time && b.end_time).map((b, bIdx) => {
                        const startM = parseInt(b.start_time.slice(0, 2), 10) * 60 + parseInt(b.start_time.slice(3, 5), 10);
                        const endM = parseInt(b.end_time.slice(0, 2), 10) * 60 + parseInt(b.end_time.slice(3, 5), 10);
                        return (
                          <div key={`block-${bIdx}`}
                            title={b.reason || 'Blocked'}
                            style={{
                              position: 'absolute',
                              top: Math.max(0, (startM - winStart) * PX_PER_MIN),
                              left: 2, right: 2,
                              height: Math.max(8, (endM - startM) * PX_PER_MIN),
                              background: 'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 6px, #FDE68A 6px, #FDE68A 12px)',
                              border: '1px solid #FBBF24',
                              borderRadius: 4,
                              opacity: 0.55,
                              pointerEvents: 'none',
                            }}/>
                        );
                      })}

                      {/* Full-day block label */}
                      {block.fullDay && (
                        <div style={{
                          position: 'absolute',
                          top: 12,
                          left: 0, right: 0,
                          textAlign: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#92400E',
                          letterSpacing: '0.04em',
                          pointerEvents: 'none',
                        }}>
                          🌿 Day off
                        </div>
                      )}

                      {/* "Now" line if today */}
                      {isToday && nowMin >= winStart && nowMin <= winEnd && (
                        <div style={{
                          position: 'absolute',
                          top: (nowMin - winStart) * PX_PER_MIN,
                          left: -3, right: 0,
                          height: 2,
                          background: '#DC2626',
                          zIndex: 4,
                          pointerEvents: 'none',
                        }}>
                          <div style={{
                            position: 'absolute',
                            left: -6, top: -4,
                            width: 10, height: 10,
                            borderRadius: '50%',
                            background: '#DC2626',
                          }}/>
                        </div>
                      )}

                      {/* Appointments */}
                      {dayAppts.map(appt => {
                        const startM = t2m(appt.time);
                        const duration = appt.duration || 60;
                        const top = Math.max(0, (startM - winStart) * PX_PER_MIN);
                        const height = Math.max(20, duration * PX_PER_MIN);
                        const st = STATUS[appt.status] || STATUS['pending-intake'];
                        return (
                          <div key={appt.id}
                            onClick={() => !appt.preview && setSelected(appt)}
                            style={{
                              position: 'absolute',
                              top, height,
                              left: 3, right: 3,
                              background: appt.preview ? '#F9FAFB' : st.bg,
                              borderLeft: `3px solid ${appt.preview ? '#D1D5DB' : st.dot}`,
                              borderRadius: 5,
                              padding: '4px 6px',
                              cursor: appt.preview ? 'default' : 'pointer',
                              opacity: appt.preview ? 0.5 : 1,
                              overflow: 'hidden',
                              boxShadow: appt.preview ? 'none' : '0 1px 2px rgba(0,0,0,0.08)',
                              transition: 'transform 0.12s',
                              zIndex: 2,
                            }}
                            onMouseEnter={e => { if (!appt.preview) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                            <div style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: appt.preview ? '#C4C4C4' : st.color,
                              lineHeight: 1.1,
                              marginBottom: 1,
                            }}>
                              {appt.time}
                            </div>
                            <div style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: appt.preview ? '#C4C4C4' : '#111827',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.2,
                            }}>
                              {appt.client.split(' ')[0]}
                            </div>
                            {height > 40 && (
                              <div style={{
                                fontSize: 9.5,
                                color: appt.preview ? '#D1D5DB' : '#6B7280',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: 1,
                              }}>
                                {appt.service || 'Session'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      )}
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{setSelected(null);onReschedule&&onReschedule(a);}} onCancelled={()=>{setSelected(null);if(typeof onRefresh==='function')onRefresh();}}/>}
    </div>
  );
}

function MonthlyView({ therapist, appointments, today, onReschedule, onRefresh, blockedDays = [] }) {
  const APPTS=appointments||[];
  const [monthOffset,setMonthOffset]=useState(0);
  const [selDate,setSelDate]=useState(today);
  const [selected,setSelected]=useState(null);
  const viewMonth=new Date(today.getFullYear(),today.getMonth()+monthOffset,1);
  const daysInMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,0).getDate();
  const firstDay=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),1).getDay();
  const offset=firstDay===0?6:firstDay-1;
  const calDays=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,i)=>new Date(viewMonth.getFullYear(),viewMonth.getMonth(),i+1))];
  const selAppts=APPTS.filter(a=>sameDay(a.date,selDate));

  // Blocked-day classification, same shape as WeeklyView. Reused
  // here so the monthly grid cells get the same visual cues.
  function blockedFor(d) {
    if (!d) return { fullDay: false, partial: false, reasons: [] };
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const rows = (blockedDays || []).filter(b => b.date === dateStr);
    if (!rows.length) return { fullDay: false, partial: false, reasons: [] };
    const fullDay = rows.some(b => !b.start_time && !b.end_time);
    const partial = rows.some(b => b.start_time || b.end_time);
    return { fullDay, partial, reasons: rows.map(b => b.reason).filter(Boolean) };
  }
  return (
    <div>
      {/* Legend */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16,padding:'10px 14px',background:'#fff',borderRadius:10,border:'1px solid #F3F4F6',alignItems:'center'}}>
        <span style={{fontSize:11,fontWeight:700,color:'#374151'}}>HOW TO READ:</span>
        {[{color:'#16A34A',bg:'#DCFCE7',label:'Brief ready'},{color:'#D97706',bg:'#FEF3C7',label:'No intake yet'},{color:'#6B7280',bg:'#F3F4F6',label:'Complete'},{color:'#7F77DD',bg:'#EFEAFD',label:'From Google'}].map(({color,bg,label})=>(
          <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:12,height:12,borderRadius:3,background:bg,border:`2px solid ${color}`}}/>
            <span style={{fontSize:11,color:'#6B7280'}}>{label}</span>
          </div>
        ))}
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <div style={{width:18,height:18,borderRadius:'50%',background:'#2A5741',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#fff'}}>AB</div>
          <span style={{fontSize:11,color:'#6B7280'}}>Client initials</span>
        </div>
        <span style={{fontSize:11,color:'#9CA3AF',marginLeft:'auto'}}>Tap a day to see appointments</span>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={()=>setMonthOffset(m=>m-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← Prev</button>
        <div style={{fontSize:16,fontWeight:700,color:'#1F2937'}}>{fmtMonth(viewMonth)}</div>
        <button onClick={()=>setMonthOffset(m=>m+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>Next →</button>
      </div>

      {/* Empty-state banner for current/future months with zero
          real bookings. Same rationale as the weekly banner: CSV
          imports don't bring forward future appointments and the
          empty state was confusing. */}
      {(() => {
        const monthAppts = APPTS.filter(a => {
          const ad = a.date instanceof Date ? a.date : new Date(a.date + 'T12:00:00');
          return ad.getFullYear() === viewMonth.getFullYear() && ad.getMonth() === viewMonth.getMonth() && !a.preview;
        });
        const isCurrentOrFutureMonth = monthOffset >= 0;
        if (monthAppts.length === 0 && isCurrentOrFutureMonth) {
          return (
            <div style={{
              background:'#FEFCE8',
              border:'1px solid #FDE68A',
              borderRadius:10,
              padding:'12px 14px',
              marginBottom:16,
              display:'flex',
              alignItems:'flex-start',
              gap:10,
            }}>
              <div style={{fontSize:18, lineHeight:1, marginTop:2}}>🌱</div>
              <div style={{flex:1, fontSize:12.5, color:'#78350F', lineHeight:1.55}}>
                <strong style={{color:'#78350F'}}>No bookings yet for {fmtMonth(viewMonth)}.</strong>{' '}
                Tap <strong>Book Appointment</strong> at the top to add a booking, or share your booking link so clients can book themselves.
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="bm-monthly-grid" style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4}}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div className="bm-monthly-grid" style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:20}}>
        {calDays.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const da=APPTS.filter(a=>sameDay(a.date,d));
          const ra=da.filter(a=>!a.preview);
          const isToday=sameDay(d,today),isSel=sameDay(d,selDate);
          const block = blockedFor(d);
          // Background priority: selected > today > full-block > partial-block > default
          // Border priority: selected > today > full-block > partial-block > default
          const cellBg = isSel ? '#2A5741'
            : isToday ? '#F0FDF4'
            : block.fullDay ? '#FEF3C7'
            : '#fff';
          const cellBorder = isSel ? '#2A5741'
            : isToday ? '#86EFAC'
            : block.fullDay ? '#FBBF24'
            : block.partial ? '#B5D4BE'
            : '#F3F4F6';
          const dateColor = isSel ? '#fff'
            : isToday ? '#16A34A'
            : block.fullDay ? '#92400E'
            : '#6B7280';
          return (
            <div key={i} onClick={()=>setSelDate(d)}
              style={{minHeight:48,padding:5,borderRadius:8,cursor:'pointer',background:cellBg,border:`1.5px solid ${cellBorder}`,transition:'all 0.1s',position:'relative'}}>
              <div style={{fontSize:11,fontWeight:600,color:dateColor,marginBottom:2}}>{d.getDate()}</div>
              {block.fullDay && !isSel && (
                <div style={{position:'absolute',top:3,right:3,fontSize:9,lineHeight:1}} title="Day blocked off">🌿</div>
              )}
              {ra.length>0&&<div style={{fontSize:11,fontWeight:700,color:isSel?'#fff':'#1F2937'}}>{window.innerWidth<640?`${ra.length}×`:`${ra.length} appt${ra.length>1?'s':''}`}</div>}
              {ra.length===0 && block.fullDay && !isSel && (
                <div style={{fontSize:10,fontWeight:600,color:'#92400E',marginTop:2}}>Off</div>
              )}
              <div style={{display:'flex',gap:2,marginTop:2}}>
                {da.filter(a=>!a.preview&&a.status==='intake-done').length>0&&!isSel&&<div style={{width:5,height:5,borderRadius:'50%',background:'#16A34A'}}/>}
                {da.filter(a=>!a.preview&&a.status==='pending-intake').length>0&&!isSel&&<div style={{width:5,height:5,borderRadius:'50%',background:'#F59E0B'}}/>}
                {block.partial && !block.fullDay && !isSel && <div style={{width:5,height:5,borderRadius:'50%',background:'#6B9E80'}} title="Partial block"/>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>
        {fmtShort(selDate)}, {selAppts.filter(a=>!a.preview).length} appointment{selAppts.filter(a=>!a.preview).length!==1?'s':''}
      </div>
      {selAppts.filter(a=>!a.preview).length===0
        ?<div style={{background:'#fff',borderRadius:12,padding:24,textAlign:'center',color:'#9CA3AF',fontSize:14}}>No appointments on this day.</div>
        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {selAppts.filter(a=>!a.preview).map(appt=>(
            <div key={appt.id} onClick={()=>setSelected(appt)}
              style={{background:(STATUS[appt.status]||STATUS['pending-intake']).bg,border:`1.5px solid ${(STATUS[appt.status]||STATUS['pending-intake']).dot}`,borderLeft:`4px solid ${(STATUS[appt.status]||STATUS['pending-intake']).dot}`,borderRadius:12,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{initials(appt.client)}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:'#1F2937'}}>{appt.client}</div>
                <div style={{fontSize:12,color:'#6B7280'}}>{appt.time} · {appt.duration}min · {appt.service||'Session'}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                <div style={{fontSize:11,fontWeight:700,color:(STATUS[appt.status]||STATUS['pending-intake']).color}}>{(STATUS[appt.status]||STATUS['pending-intake']).icon} {(STATUS[appt.status]||STATUS['pending-intake']).label}</div>
                {appt.deposit_required&&!appt.deposit_paid&&<div style={{fontSize:10,fontWeight:700,color:'#D97706'}}>💳 Deposit due</div>}
              </div>
            </div>
          ))}
        </div>
      }
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{setSelected(null);onReschedule&&onReschedule(a);}} onCancelled={()=>{setSelected(null);if(typeof onRefresh==='function')onRefresh();}}/>}
    </div>
  );
}

function YearlyView({ therapist, appointments, today, blockedDays = [] }) {
  // 12-month at-a-glance heatmap. Each month is a mini-grid of day
  // cells colored by booking density. Time-off days show an amber
  // dot. Below the grid: 'busiest months' and 'quietest months'
  // ranked, plus the year's total session count.
  //
  // HK May 22 2026 Tier 2: design choice is scrolling year view
  // (no drill-down) over a tap-to-zoom pattern. For the 70yo
  // persona, at-a-glance is more valuable than interaction depth.
  // The Monthly tab handles details.
  //
  // HK May 24 2026 update: cells with bookings are now clickable.
  // Tapping a green cell opens an inline popover showing every
  // appointment for that day (client name, time, service, status).
  // The popover is keyboard-dismissable and tap-outside-to-close.
  // Cells with zero bookings remain decorative (no hover affordance).
  const APPTS = appointments || [];
  const [yearOffset, setYearOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-MM-DD' or null
  const viewYear = today.getFullYear() + yearOffset;
  const monthStart = new Date(viewYear, 0, 1);

  // Pre-compute per-day booking count for the entire year so we
  // can render the 12 mini-months without re-filtering each cell.
  const countsByDate = useMemo(() => {
    const m = {};
    APPTS.forEach(a => {
      if (a.preview || a.external) return;
      const d = a.date;
      if (!d || d.getFullYear() !== viewYear) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      m[key] = (m[key] || 0) + 1;
    });
    return m;
  }, [APPTS, viewYear]);

  const blockedByDate = useMemo(() => {
    const m = {};
    (blockedDays || []).forEach(b => {
      // b.date is a YYYY-MM-DD string
      if (typeof b.date === 'string' && b.date.startsWith(String(viewYear))) {
        const isFullDay = !b.start_time && !b.end_time;
        m[b.date] = isFullDay ? 'full' : 'partial';
      }
    });
    return m;
  }, [blockedDays, viewYear]);

  // Per-month stats for ranking
  const monthStats = useMemo(() => {
    const stats = Array.from({ length: 12 }, () => ({ count: 0, days: 0 }));
    Object.entries(countsByDate).forEach(([dateStr, n]) => {
      const m = parseInt(dateStr.slice(5, 7), 10) - 1;
      stats[m].count += n;
      stats[m].days += 1;
    });
    return stats;
  }, [countsByDate]);

  const yearTotal = monthStats.reduce((s, m) => s + m.count, 0);
  const monthsWithData = monthStats.map((s, i) => ({ ...s, monthIdx: i })).filter(s => s.count > 0);
  const busiest = [...monthsWithData].sort((a, b) => b.count - a.count).slice(0, 2);
  const quietest = [...monthsWithData].sort((a, b) => a.count - b.count).slice(0, 2);

  // Color scale: sage gradient based on booking density
  function densityColor(count, isBlocked) {
    if (isBlocked === 'full') return '#FEF3C7';
    if (count === 0) return '#F5F0E8';
    if (count === 1) return '#D4E6DA';
    if (count === 2) return '#A8CCB5';
    if (count <= 4) return '#6B9E80';
    return '#2A5741';
  }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAY_LETTERS = ['M','T','W','T','F','S','S'];

  return (
    <div>
      {/* Year nav */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
        <button onClick={()=>setYearOffset(y=>y-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← {viewYear-1}</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:"'Cormorant Garamond', Georgia, serif",fontSize:24,fontWeight:600,color:'#1F4131',letterSpacing:'-0.01em'}}>{viewYear}</div>
          <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>
            {yearTotal === 0
              ? 'No sessions yet'
              : `${yearTotal} session${yearTotal===1?'':'s'} across the year`}
          </div>
        </div>
        <button onClick={()=>setYearOffset(y=>y+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>{viewYear+1} →</button>
      </div>

      {/* Legend */}
      <div style={{display:'flex',alignItems:'center',gap:14,padding:'10px 14px',background:'#fff',borderRadius:10,border:'1px solid #F3F4F6',marginBottom:14,flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:700,color:'#374151',letterSpacing:'0.06em'}}>SESSIONS PER DAY</span>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {[
            {bg:'#F5F0E8',label:'0'},
            {bg:'#D4E6DA',label:'1'},
            {bg:'#A8CCB5',label:'2'},
            {bg:'#6B9E80',label:'3-4'},
            {bg:'#2A5741',label:'5+'},
          ].map(({bg,label}) => (
            <div key={label} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <div style={{width:14,height:14,borderRadius:3,background:bg,border:'1px solid #E5E7EB'}}/>
              <span style={{fontSize:9,color:'#9CA3AF'}}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5,marginLeft:6}}>
          <div style={{width:14,height:14,borderRadius:3,background:'#FEF3C7',border:'1px solid #FDE68A'}}/>
          <span style={{fontSize:11,color:'#6B7280'}}>Time off</span>
        </div>
      </div>

      {/* 12-month grid */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))',
        gap:14,
        marginBottom:20,
      }}>
        {MONTH_NAMES.map((monthName, mIdx) => {
          const monthDate = new Date(viewYear, mIdx, 1);
          const daysInMonth = new Date(viewYear, mIdx+1, 0).getDate();
          const firstDay = new Date(viewYear, mIdx, 1).getDay();
          const offset = firstDay === 0 ? 6 : firstDay - 1;
          const cells = [
            ...Array(offset).fill(null),
            ...Array.from({length: daysInMonth}, (_, i) => i+1),
          ];
          const isCurrentMonth = monthDate.getMonth() === today.getMonth() && viewYear === today.getFullYear();
          const stats = monthStats[mIdx];

          return (
            <div key={mIdx} style={{
              background:'#fff',
              border:`1.5px solid ${isCurrentMonth ? '#86EFAC' : '#F3F4F6'}`,
              borderRadius:12,
              padding:'12px 12px 10px',
              boxShadow: isCurrentMonth ? '0 1px 3px rgba(22,163,74,0.08)' : 'none',
            }}>
              {/* Month header */}
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: isCurrentMonth ? '#16A34A' : '#1F4131',
                }}>
                  {monthName}
                </div>
                <div style={{fontSize:10.5,color:'#9CA3AF',fontWeight:600}}>
                  {stats.count === 0 ? '·' : `${stats.count}`}
                </div>
              </div>
              {/* Day letter header */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:3}}>
                {DAY_LETTERS.map((dl,i) => (
                  <div key={i} style={{fontSize:8,color:'#C7CDD6',textAlign:'center',fontWeight:600}}>{dl}</div>
                ))}
              </div>
              {/* Day cells */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const dateStr = `${viewYear}-${String(mIdx+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const count = countsByDate[dateStr] || 0;
                  const blocked = blockedByDate[dateStr];
                  const isToday = today.getFullYear() === viewYear && today.getMonth() === mIdx && today.getDate() === day;
                  const interactable = count > 0;
                  if (interactable) {
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        title={`${monthName} ${day}: ${count} session${count===1?'':'s'}${blocked === 'full' ? ' (blocked)' : blocked === 'partial' ? ' (partial block)' : ''}. Tap to see appointments.`}
                        style={{
                          aspectRatio: '1',
                          background: densityColor(count, blocked),
                          borderRadius: 2,
                          border: isToday ? '1.5px solid #2A5741' : (blocked === 'partial' ? '1px solid #FDE68A' : 'none'),
                          position: 'relative',
                          padding: 0,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        {blocked === 'partial' && (
                          <div style={{
                            position:'absolute',
                            top:1, right:1,
                            width:3, height:3,
                            borderRadius:'50%',
                            background:'#D97706',
                          }}/>
                        )}
                      </button>
                    );
                  }
                  return (
                    <div
                      key={i}
                      title={`${monthName} ${day}: 0 sessions${blocked === 'full' ? ' (blocked)' : blocked === 'partial' ? ' (partial block)' : ''}`}
                      style={{
                        aspectRatio: '1',
                        background: densityColor(count, blocked),
                        borderRadius: 2,
                        border: isToday ? '1.5px solid #2A5741' : (blocked === 'partial' ? '1px solid #FDE68A' : 'none'),
                        position: 'relative',
                      }}
                    >
                      {blocked === 'partial' && (
                        <div style={{
                          position:'absolute',
                          top:1, right:1,
                          width:3, height:3,
                          borderRadius:'50%',
                          background:'#D97706',
                        }}/>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Year stats summary */}
      {yearTotal > 0 && (
        <div style={{
          background:'#fff',
          border:'1px solid #F3F4F6',
          borderRadius:14,
          padding:'14px 16px',
          marginBottom:14,
        }}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',color:'#6B7280',marginBottom:10,textTransform:'uppercase'}}>
            Your year in rhythm
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12}}>
            <div>
              <div style={{fontSize:11,color:'#9CA3AF',marginBottom:2}}>Total sessions</div>
              <div style={{fontFamily:'Georgia, serif',fontSize:20,fontWeight:700,color:'#1F4131'}}>{yearTotal}</div>
            </div>
            {busiest.length > 0 && (
              <div>
                <div style={{fontSize:11,color:'#9CA3AF',marginBottom:2}}>Busiest stretch</div>
                <div style={{fontFamily:'Georgia, serif',fontSize:14,fontWeight:600,color:'#1F4131'}}>
                  {busiest.map(b => MONTH_NAMES[b.monthIdx]).join(', ')}
                </div>
                <div style={{fontSize:10.5,color:'#9CA3AF',marginTop:1}}>
                  {busiest[0].count} session{busiest[0].count===1?'':'s'} in {MONTH_NAMES[busiest[0].monthIdx]}
                </div>
              </div>
            )}
            {quietest.length > 0 && quietest[0].monthIdx !== busiest[0]?.monthIdx && (
              <div>
                <div style={{fontSize:11,color:'#9CA3AF',marginBottom:2}}>Quietest stretch</div>
                <div style={{fontFamily:'Georgia, serif',fontSize:14,fontWeight:600,color:'#1F4131'}}>
                  {quietest.map(q => MONTH_NAMES[q.monthIdx]).join(', ')}
                </div>
                <div style={{fontSize:10.5,color:'#9CA3AF',marginTop:1}}>
                  Good window for rest, learning, or outreach
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {yearTotal === 0 && (
        <div style={{
          background:'#FEFCE8',
          border:'1px solid #FDE68A',
          borderRadius:10,
          padding:'14px 16px',
          fontSize:12.5,
          color:'#78350F',
          lineHeight:1.55,
        }}>
          <strong>No sessions on record for {viewYear} yet.</strong> Once bookings start appearing on your schedule, this view will show your year at a glance: which months you were busiest, where you took time off, and the rhythm of your practice across seasons.
        </div>
      )}

      {/* Day-detail modal: opens when therapist taps a heatmap cell
          with bookings. Lists every appointment for that day in a
          read-only summary. Tap outside or the X to dismiss. Bookings
          are read directly from the APPTS prop (same source the heatmap
          counts use), so no re-fetch needed. HK May 24 2026: yearly
          view was 'useless and no functionality' before this. Cells
          with bookings are now actionable for drill-down. */}
      {selectedDate && (() => {
        const [yy, mm, dd] = selectedDate.split('-').map(Number);
        const dateObj = new Date(yy, mm - 1, dd);
        const dayAppts = APPTS.filter(a => {
          if (!a.date) return false;
          if (a.preview || a.external) return false;
          return a.date.getFullYear() === yy
            && (a.date.getMonth() + 1) === mm
            && a.date.getDate() === dd;
        }).sort((a, b) => {
          const ta = a.startTime || a.time || '';
          const tb = b.startTime || b.time || '';
          return ta.localeCompare(tb);
        });
        return (
          <>
            <div onClick={() => setSelectedDate(null)} style={{
              position:'fixed', inset:0,
              background:'rgba(0,0,0,0.3)',
              zIndex:300,
              backdropFilter:'blur(2px)',
            }}/>
            <div style={{
              position:'fixed',
              top:'50%', left:'50%',
              transform:'translate(-50%, -50%)',
              width:'min(420px, 92vw)',
              maxHeight:'82vh',
              background:'#fff',
              borderRadius:14,
              boxShadow:'0 20px 50px rgba(0,0,0,0.18)',
              zIndex:301,
              overflow:'hidden',
              display:'flex',
              flexDirection:'column',
            }}>
              {/* Header */}
              <div style={{
                padding:'14px 16px',
                borderBottom:'1px solid #F3F4F6',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
                gap:10,
              }}>
                <div>
                  <div style={{fontFamily:'Georgia, serif', fontSize:18, fontWeight:700, color:'#1F4131'}}>
                    {dateObj.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
                  </div>
                  <div style={{fontSize:12, color:'#6B7280', marginTop:2}}>
                    {dayAppts.length} appointment{dayAppts.length === 1 ? '' : 's'}
                  </div>
                </div>
                <CloseButton onClick={() => setSelectedDate(null)} label="Close" />
              </div>
              {/* Body */}
              <div style={{
                flex:1,
                overflowY:'auto',
                padding:'10px 12px 14px',
              }}>
                {dayAppts.length === 0 && (
                  <div style={{fontSize:13, color:'#6B7280', textAlign:'center', padding:'20px 12px'}}>
                    No appointments details available.
                  </div>
                )}
                {dayAppts.map((a, idx) => {
                  const st = STATUS[a.status] || STATUS['pending-intake'];
                  return (
                    <div key={a.id || idx} style={{
                      display:'flex',
                      alignItems:'flex-start',
                      gap:10,
                      padding:'10px 12px',
                      borderBottom: idx === dayAppts.length - 1 ? 'none' : '1px solid #F3F4F6',
                    }}>
                      <div style={{
                        width:36, height:36, borderRadius:'50%',
                        background:ac(a.client),
                        color:'#fff',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        fontSize:12, fontWeight:700,
                        flexShrink:0,
                      }}>
                        {initials(a.client)}
                      </div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:14, fontWeight:700, color:'#1F2937', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {a.client || 'Unnamed'}
                        </div>
                        <div style={{fontSize:12, color:'#6B7280', marginTop:2}}>
                          {a.isAllDay ? 'All day' : (a.time || 'No time set')}
                          {a.duration && !a.isAllDay ? ` · ${a.duration} min` : ''}
                          {a.service ? ` · ${a.service}` : ''}
                        </div>
                        <div style={{
                          display:'inline-block',
                          marginTop:6,
                          fontSize:10.5,
                          fontWeight:700,
                          padding:'2px 8px',
                          borderRadius:99,
                          background:st.bg,
                          color:st.color,
                          letterSpacing:'0.02em',
                        }}>
                          {st.icon} {st.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Footer hint */}
              <div style={{
                padding:'10px 14px',
                borderTop:'1px solid #F3F4F6',
                fontSize:11.5,
                color:'#6B7280',
                lineHeight:1.5,
              }}>
                For full details and actions, switch to the Monthly or Today view and tap any appointment.
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

function InsightsView({ appointments }) {
  const APPTS=(appointments||[]).filter(a=>!a.preview);
  if(APPTS.length===0) return (
    <div style={{background:'#fff',borderRadius:14,padding:'40px 24px',textAlign:'center'}}>
      <div style={{fontSize:36,marginBottom:12}}>📊</div>
      <div style={{fontSize:16,fontWeight:600,color:'#1F2937',marginBottom:8}}>Insights will appear here</div>
      <div style={{fontSize:13,color:'#6B7280',lineHeight:1.6}}>Once clients start booking, you'll see your busiest days, top clients, and booking trends.</div>
    </div>
  );

  // ─── COHORT COMPUTATIONS ─────────────────────────────────────
  // Four action cohorts that answer 'what should I do this month?'
  // Per founder playbook: insights live where decisions are made.
  // Each cohort is a card with the 3 most actionable people + 'View
  // all N'. Existing analytics charts move below as secondary context.
  const now = Date.now();
  const DAY_MS = 86400000;

  // Build per-client aggregations from appointments
  const byClient = {};
  APPTS.forEach(a => {
    const key = a.clientId || a.client_id || a.client || 'unknown';
    if (!byClient[key]) {
      byClient[key] = {
        id: key,
        name: a.client || 'Unknown',
        dates: [],
        prices: [],
        statuses: [],
        phone: a.client_phone || a.phone || null,
        clientEmail: a.client_email || null,
      };
    }
    byClient[key].dates.push(a.date);
    if (a.price) byClient[key].prices.push(Number(a.price) || 0);
    byClient[key].statuses.push(a.status);
  });

  const clients = Object.values(byClient).map(c => {
    const sortedDates = [...c.dates].sort((a, b) => a - b);
    const totalVisits = sortedDates.length;
    const lastVisit = sortedDates[sortedDates.length - 1];
    const firstVisit = sortedDates[0];
    const daysLapsed = lastVisit ? Math.round((now - lastVisit.getTime()) / DAY_MS) : 999;
    const lifetimeSpend = c.prices.reduce((s, n) => s + n, 0);

    // No-show rate: count cancellations + no-shows
    const cancelledCount = c.statuses.filter(s =>
      s === 'cancelled' || s === 'no-show' || s === 'canceled'
    ).length;
    const noShowRate = totalVisits > 0 ? cancelledCount / totalVisits : 0;

    // Cadence: avg interval between visits
    let cadence = null;
    if (sortedDates.length >= 3) {
      const intervals = [];
      for (let i = 1; i < sortedDates.length; i++) {
        intervals.push((sortedDates[i].getTime() - sortedDates[i-1].getTime()) / DAY_MS);
      }
      cadence = Math.round(intervals.reduce((s, n) => s + n, 0) / intervals.length);
    }

    // Visits in last 90 days
    const cutoff90 = now - 90 * DAY_MS;
    const recentVisits = sortedDates.filter(d => d.getTime() >= cutoff90).length;

    return {
      ...c,
      totalVisits,
      lastVisit,
      firstVisit,
      daysLapsed,
      lifetimeSpend,
      noShowRate,
      cancelledCount,
      cadence,
      recentVisits,
    };
  });

  // COHORT 1: HIGH VALUE
  // Top clients by lifetime visit count (or spend if available).
  // These are your champions. Action: thank-you or referral ask.
  const highValue = [...clients]
    .filter(c => c.totalVisits >= 5)
    .sort((a, b) => b.totalVisits - a.totalVisits || b.lifetimeSpend - a.lifetimeSpend)
    .slice(0, 10);

  // COHORT 2: LAPSED
  // Regulars whose cadence broke. Action: text now.
  // Per playbook lapsed-regular formula: lifetime_bookings >= 4 AND
  // last_booking 30-60 days ago. Extending to 60+ days for the
  // Insights monthly view (broader than the rail's tighter window).
  const lapsed = [...clients]
    .filter(c => c.totalVisits >= 4 && c.daysLapsed >= 60 && c.daysLapsed <= 365)
    .sort((a, b) => b.daysLapsed - a.daysLapsed)
    .slice(0, 10);

  // COHORT 3: NO-SHOW RISK
  // >= 20% cancel/no-show rate AND >= 5 bookings.
  // Per playbook formula. Action: send confirm reminder before next session.
  const noShowRisk = [...clients]
    .filter(c => c.noShowRate >= 0.20 && c.totalVisits >= 5)
    .sort((a, b) => b.noShowRate - a.noShowRate)
    .slice(0, 10);

  // COHORT 4: MEMBERSHIP CANDIDATES
  // First-3-visits clients who could become regulars. 2-4 visits in
  // last 90 days, total visits <= 5. Action: invite to package or
  // membership.
  const membershipCandidates = [...clients]
    .filter(c => c.recentVisits >= 2 && c.recentVisits <= 4 && c.totalVisits <= 5)
    .sort((a, b) => b.recentVisits - a.recentVisits)
    .slice(0, 10);

  // ─── LEGACY ANALYTICS (secondary section) ────────────────────
  const DAY_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayCounts=DAY_NAMES.map((name,i)=>{const jsDay=i===6?0:i+1;return{name,count:APPTS.filter(a=>a.date.getDay()===jsDay).length};});
  const maxDay=Math.max(...dayCounts.map(d=>d.count),1);
  const clientCounts={};APPTS.forEach(a=>{clientCounts[a.client]=(clientCounts[a.client]||0)+1;});
  const topClients=Object.entries(clientCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const total=APPTS.length;
  const intakePct=total>0?Math.round((APPTS.filter(a=>a.status!=='pending-intake').length/total)*100):0;
  const depositPending=APPTS.filter(a=>a.deposit_required&&!a.deposit_paid).length;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      {/* ─── COHORT CARDS ─── */}
      <div style={{fontSize:11,fontWeight:700,color:'#6B7280',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:-6}}>
        Action cohorts · what to do this month
      </div>
      <div className="bm-cohorts-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <CohortCard
          color="forest"
          icon="⭐"
          title="High Value"
          subtitle="Your champions. Thank or ask for a referral."
          clients={highValue}
          total={clients.filter(c => c.totalVisits >= 5).length}
          actionLabel="Thank"
          buildMessage={(c, therapistFirstName) => `Hi ${c.name.split(' ')[0]}, ${therapistFirstName || 'me'} here. I was just looking through my books and realized you've been part of my practice for ${c.totalVisits} sessions. That means a lot. If you ever want to send a friend my way, I have a referral thank-you for you.`}
          metric={(c) => `${c.totalVisits} visits · $${Math.round(c.lifetimeSpend)}`}
        />
        <CohortCard
          color="amber"
          icon="🌿"
          title="Lapsed"
          subtitle="Regulars who drifted. Text now."
          clients={lapsed}
          total={clients.filter(c => c.totalVisits >= 4 && c.daysLapsed >= 60).length}
          actionLabel="Text"
          buildMessage={(c, therapistFirstName) => `Hi ${c.name.split(' ')[0]}, ${therapistFirstName || 'me'} here. It's been about ${Math.round(c.daysLapsed / 7)} weeks since your last visit. Want me to find a time that works for you?`}
          metric={(c) => `${c.daysLapsed}d since last · ${c.totalVisits} lifetime`}
        />
        <CohortCard
          color="danger"
          icon="⚠️"
          title="No-show Risk"
          subtitle="Send a confirm reminder before next session."
          clients={noShowRisk}
          total={clients.filter(c => c.noShowRate >= 0.20 && c.totalVisits >= 5).length}
          actionLabel="Confirm"
          buildMessage={(c, therapistFirstName) => `Hi ${c.name.split(' ')[0]}, just confirming our upcoming session. Reply YES to confirm or let me know if you need to reschedule. Thanks!`}
          metric={(c) => `${Math.round(c.noShowRate * 100)}% no-show · ${c.totalVisits} bookings`}
        />
        <CohortCard
          color="sage"
          icon="🤝"
          title="Membership Candidates"
          subtitle="First few visits. Could become regulars."
          clients={membershipCandidates}
          total={clients.filter(c => c.recentVisits >= 2 && c.recentVisits <= 4 && c.totalVisits <= 5).length}
          actionLabel="Invite"
          buildMessage={(c, therapistFirstName) => `Hi ${c.name.split(' ')[0]}, I've enjoyed our sessions together. If you're thinking about making this a regular routine, I have a package option that saves you money per session. Let me know if you'd like to hear about it.`}
          metric={(c) => `${c.recentVisits} in 90d · ${c.totalVisits} lifetime`}
        />
      </div>

      {/* ─── LEGACY ANALYTICS (secondary) ─── */}
      <div style={{fontSize:11,fontWeight:700,color:'#6B7280',letterSpacing:'0.12em',textTransform:'uppercase',marginTop:8,marginBottom:-6}}>
        Practice analytics
      </div>
      <div className="bm-insights-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div style={{background:'#fff',borderRadius:12,padding:18,gridColumn:'1/-1',border:'1px solid #EEF2F7'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#6B7280',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Busiest Days</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:10,height:80}}>
            {dayCounts.map(({name,count})=>(
              <div key={name} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>{count||''}</div>
                <div style={{width:'100%',background:'#2A5741',borderRadius:'4px 4px 0 0',height:`${Math.max((count/maxDay)*60,count>0?4:2)}px`,opacity:count>0?1:0.1}}/>
                <div style={{fontSize:10,color:'#9CA3AF'}}>{name}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:18,border:'1px solid #EEF2F7'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#6B7280',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Intake Rate</div>
          <div style={{fontSize:32,fontWeight:700,color:'#2A5741',fontFamily:'Georgia,serif'}}>{intakePct}%</div>
          <div style={{marginTop:8,background:'#E5E7EB',borderRadius:99,height:6}}>
            <div style={{width:`${intakePct}%`,background:'#2A5741',borderRadius:99,height:6}}/>
          </div>
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:18,border:'1px solid #EEF2F7'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#6B7280',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Top Clients</div>
          {topClients.map(([name,count])=>(
            <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:ac(name),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>{initials(name)}</div>
                <span style={{fontSize:13,fontWeight:600,color:'#1F2937'}}>{name}</span>
              </div>
              <span style={{fontSize:12,color:'#6B7280'}}>{count}</span>
            </div>
          ))}
        </div>
        {depositPending>0&&(
          <div style={{background:'#FFFBEB',borderRadius:12,padding:18,border:'1px solid #FCD34D',gridColumn:'1/-1'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#92400E',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Deposits Pending</div>
            <div style={{display:'flex',alignItems:'baseline',gap:10}}>
              <div style={{fontSize:28,fontWeight:700,color:'#D97706',fontFamily:'Georgia,serif'}}>{depositPending}</div>
              <div style={{fontSize:12,color:'#92400E'}}>new client deposits awaiting payment</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================
 * CohortCard
 *
 * Action-oriented insights card. Three most relevant clients with
 * one-tap message action, then 'View all N' to expand. Color-coded
 * by cohort intent (forest=champions, amber=lapsed, danger=risk,
 * sage=opportunity).
 * ============================================================= */

function CohortCard({ color, icon, title, subtitle, clients, total, actionLabel, buildMessage, metric }) {
  const [expanded, setExpanded] = useState(false);

  const COLOR_MAP = {
    forest: { bg:'#F0F7F2', border:'#C8E0CC', accent:'#2A5741', actionBg:'#2A5741' },
    amber:  { bg:'#FEF8EC', border:'#FDE6B5', accent:'#92400E', actionBg:'#D97706' },
    danger: { bg:'#FEF2F2', border:'#FECACA', accent:'#991B1B', actionBg:'#DC2626' },
    sage:   { bg:'#F5F8F3', border:'#D6E4D0', accent:'#3D6B4C', actionBg:'#3D6B4C' },
  };
  const c = COLOR_MAP[color] || COLOR_MAP.forest;

  function sendMessage(client) {
    const msg = buildMessage(client, '');
    if (!client.phone) {
      alert(`No phone on file for ${client.name}. Pre-drafted:\n\n${msg}`);
      return;
    }
    const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    const sep = isApple ? '&' : '?';
    window.location.href = `sms:${client.phone}${sep}body=${encodeURIComponent(msg)}`;
  }

  if (clients.length === 0) {
    return (
      <section style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.accent, fontFamily:'Georgia,serif' }}>
            {title}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
          No one in this cohort yet. Keep going.
        </div>
      </section>
    );
  }

  const visible = expanded ? clients : clients.slice(0, 3);

  return (
    <section style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 14,
      padding: '16px 18px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.accent, fontFamily:'Georgia,serif' }}>
            {title}
          </div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: c.accent,
            background: '#fff',
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            padding: '2px 7px',
            marginLeft: 'auto',
          }}>
            {total}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.45 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {visible.map(client => (
          <div key={client.id} style={{
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            gap:10,
            padding:'8px 10px',
            background:'#fff',
            border:`1px solid ${c.border}`,
            borderRadius:10,
            minWidth: 0,
          }}>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{
                fontSize:13,
                fontWeight:700,
                color:'#1F2937',
                fontFamily:'Georgia,serif',
                overflow:'hidden',
                textOverflow:'ellipsis',
                whiteSpace:'nowrap',
              }}>
                {client.name}
              </div>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:1 }}>
                {metric(client)}
              </div>
            </div>
            <button
              onClick={() => sendMessage(client)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                background: c.actionBg,
                color:'#fff',
                border:'none',
                borderRadius:8,
                fontSize:11,
                fontWeight:700,
                cursor:'pointer',
                letterSpacing:'0.02em',
                boxShadow: `0 1px 3px ${c.actionBg}33`,
                transition:'transform 0.12s',
              }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='none'; }}
            >
              {actionLabel}
            </button>
          </div>
        ))}
      </div>

      {clients.length > 3 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background:'transparent',
            border:'none',
            color: c.accent,
            fontSize:12,
            fontWeight:700,
            cursor:'pointer',
            padding:'2px 0',
            textAlign:'left',
          }}
        >
          {expanded ? '↑ Show fewer' : `+ View all ${clients.length} →`}
        </button>
      )}
    </section>
  );
}

export default function ScheduleDashboard({ therapist }) {
  const [subView,setSubView]=useState('today');
  const [dayOffset,setDayOffset]=useState(0);
  const [realBookings,setRealBookings]=useState(null);
  const [pendingApprovalBookings,setPendingApprovalBookings]=useState([]);
  const [actioningId,setActioningId]=useState(null);
  const [declineFor,setDeclineFor]=useState(null); // booking id we're collecting decline reason for
  const [declineReason,setDeclineReason]=useState('');
  const [loading,setLoading]=useState(true);
  const [today] = useState(getToday);
  const SAMPLE = makeSample(today);
  const [showCreate, setShowCreate] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  // Phase 9.3 (HK May 18 2026): long-press → option to schedule a
  // session instead of blocking. State lives here so BookingModal
  // can render at this component level (TimelineView only owns the
  // confirm sheet, not the modal). TimelineView calls our
  // onScheduleAtTime callback to hand control here.
  const [pendingBookingTime, setPendingBookingTime] = useState(null);  // {date, startTime}

  // Preview-data toggle (HK May 18 2026, simplified per HK May 18
  // feedback): one boolean. Therapist taps to flip. Persists to
  // therapists.show_preview_data. Does NOT auto-sync from the
  // therapist prop on re-render, because that overwrote the
  // therapist's own choice with stale data from the parent's last
  // fetch. The therapist is the source of truth once they tap.
  //
  // Initial value: read from therapist.show_preview_data if present,
  // otherwise true (ON by default for brand-new accounts so the
  // populated demo still works on day one). The useEffect ONLY fires
  // when therapist.id changes (account switch), not on every render.
  const [showPreviewData, setShowPreviewData] = useState(
    therapist?.show_preview_data !== false
  );
  const lastSyncedTherapistId = useRef(therapist?.id);
  useEffect(() => {
    // Only re-read from props when a different therapist loads
    // (account switch in a multi-account scenario). Within a single
    // therapist's session, the user's tap is authoritative.
    if (therapist?.id && therapist.id !== lastSyncedTherapistId.current) {
      setShowPreviewData(therapist?.show_preview_data !== false);
      lastSyncedTherapistId.current = therapist.id;
    }
  }, [therapist?.id, therapist?.show_preview_data]);

  async function togglePreviewData() {
    const next = !showPreviewData;
    setShowPreviewData(next);
    try {
      await supabase.from('therapists').update({ show_preview_data: next }).eq('id', therapist.id);
    } catch (e) {
      // Revert on failure. Toggle is non-critical; don't block UI.
      setShowPreviewData(!next);
    }
  }

  // Blocked days state
  const [blockedDays, setBlockedDays] = useState([]);
  const [showBlockPanel, setShowBlockPanel] = useState(false);
  const [blockDate, setBlockDate] = useState('');
  // Multi-day block support (HK May 21 2026 from Jackie request).
  // She works 3 weeks on, 10 days off. Single-day blocks were too
  // painful for vacations. When blockEndDate is set and different
  // from blockDate, addBlockedDay() loops the range and creates one
  // blocked_days row per date. When empty, behavior is the same as
  // before (single-day block).
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockNote, setBlockNote] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockMode, setBlockMode] = useState('full');  // 'full' or 'partial'
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState('');
  // Pending-conflicts state (HK May 19 2026 from Candice report).
  // When a therapist tries to block a date that has existing
  // confirmed or pending-approval bookings, we surface the
  // conflicts inline and wait for explicit confirmation. Shape:
  //   null when no conflicts pending
  //   { date, partial, conflicts: [{client_name, start_time, status}] }
  //     when conflicts need user decision
  const [pendingBlockConflicts, setPendingBlockConflicts] = useState(null);

  useEffect(()=>{if(therapist?.id){ fetchBookings(); loadBlockedDays(); }},[therapist?.id]);

  async function loadBlockedDays() {
    const { data } = await supabase.from('blocked_days').select('*')
      .eq('therapist_id', therapist.id)
      .gte('date', new Date().toISOString().slice(0,10))
      .order('date');
    setBlockedDays(data || []);
  }

  async function addBlockedDay(args) {
    // Two call shapes supported:
    //   (1) addBlockedDay(): uses the inline-form state at the top
    //                          of Schedule (blockDate, blockMode, etc).
    //   (2) addBlockedDay({date, startTime, endTime, note}): used by
    //                          long-press in TimelineView (Phase 9.2).
    //                          Bypasses the inline form entirely.
    //   Both paths accept an optional skipConflictCheck flag, used by
    //   the inline 'Block anyway' button after the therapist has
    //   acknowledged the conflict banner.
    setBlockError('');

    const useArgs = args && typeof args === 'object' && args.date;
    const skipConflictCheck = !!(args && args.skipConflictCheck);

    // Multi-day range short-circuit (HK May 21 2026 from Jackie ask
    // 'block off 10 days at a time'). When the inline form has a
    // blockEndDate set that is AFTER blockDate, iterate the range and
    // insert one full-day blocked_days row per date. Conflict check
    // runs per-date so the therapist sees ALL clashes across the
    // range before confirming. Partial-time blocks are not supported
    // for multi-day; the use case is vacations = full days off.
    const hasRange = !useArgs && blockEndDate && blockEndDate > blockDate;
    if (hasRange && blockMode === 'full') {
      return await addBlockedDayRange(skipConflictCheck);
    }
    const payload = useArgs
      ? {
          therapist_id: therapist.id,
          date: args.date,
          note: (args.note || '').trim() || null,
        }
      : {
          therapist_id: therapist.id,
          date: blockDate,
          note: blockNote.trim() || null,
        };

    if (useArgs) {
      // Long-press path is always partial. Validate.
      if (!args.startTime || !args.endTime) {
        setBlockError('Please set both a start and end time.');
        return null;
      }
      if (args.endTime <= args.startTime) {
        setBlockError('End time must be after start time.');
        return null;
      }
      payload.start_time = args.startTime;
      payload.end_time = args.endTime;
    } else {
      if (!blockDate) return null;
      if (blockMode === 'partial') {
        if (!blockStartTime || !blockEndTime) {
          setBlockError('Please set both a start and end time.');
          return null;
        }
        if (blockEndTime <= blockStartTime) {
          setBlockError('End time must be after start time.');
          return null;
        }
        payload.start_time = blockStartTime;
        payload.end_time = blockEndTime;
      }
    }

    // Pre-check for conflicting bookings on this date (HK May 19 2026
    // from Candice report: she blocked Wednesday but Cheryl's pending
    // booking on Wednesday was still active, forcing a manual decline).
    // Only run when the therapist has NOT already acknowledged the
    // conflict. The skip flag flips true after they click 'Block anyway'.
    if (!skipConflictCheck) {
      const { data: clashes, error: clashErr } = await supabase
        .from('bookings')
        .select('id, client_name, start_time, end_time, status')
        .eq('therapist_id', therapist.id)
        .eq('booking_date', payload.date)
        .in('status', ['confirmed', 'pending-approval', 'pending-deposit']);

      if (!clashErr && Array.isArray(clashes) && clashes.length > 0) {
        // For partial blocks, only flag bookings whose times overlap
        // the block window. For full-day blocks, every booking on
        // that date conflicts.
        const partial = !!(payload.start_time && payload.end_time);
        const overlapping = partial
          ? clashes.filter(b => {
              const bs = (b.start_time || '').slice(0,5);
              const be = (b.end_time   || '').slice(0,5);
              return bs < payload.end_time && be > payload.start_time;
            })
          : clashes;
        if (overlapping.length > 0) {
          setPendingBlockConflicts({
            date: payload.date,
            partial,
            blockStart: payload.start_time || null,
            blockEnd: payload.end_time || null,
            note: payload.note || null,
            useArgs,
            conflicts: overlapping
              .slice() // copy before sort
              .sort((a,b) => (a.start_time || '').localeCompare(b.start_time || ''))
              .map(b => ({
                id: b.id,
                client_name: b.client_name,
                start_time: b.start_time,
                status: b.status,
              })),
          });
          return null;
        }
      }
    }

    setBlockSaving(true);
    const { data, error } = await supabase.from('blocked_days')
      .insert(payload)
      .select().single();
    if (error) {
      setBlockError(error.message || 'Could not save the block.');
      setBlockSaving(false);
      return null;
    }
    if (data) setBlockedDays(prev => [...prev, data].sort((a,b)=>{
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return (a.start_time || '').localeCompare(b.start_time || '');
    }));
    if (!useArgs) {
      setBlockDate(''); setBlockNote(''); setBlockStartTime(''); setBlockEndTime('');
      setBlockMode('full');
    }
    // Clear any lingering conflict banner now that the block went through.
    setPendingBlockConflicts(null);
    setBlockSaving(false);
    return data;
  }

  async function removeBlockedDay(id) {
    await supabase.from('blocked_days').delete().eq('id', id);
    setBlockedDays(prev => prev.filter(d => d.id !== id));
  }

  // Multi-day block range insert (HK May 21 2026, supports the 10-day
  // vacation use case Jackie raised). Walks the inclusive range from
  // blockDate to blockEndDate, creating one full-day blocked_days row
  // per date. Conflict check runs across the full range first; if any
  // bookings clash on any date in the range we surface them all in
  // the pending-conflicts banner and require explicit confirmation
  // before proceeding. After confirmation the inserts go one by one
  // (so a mid-range error does not silently leave partial state).
  async function addBlockedDayRange(skipConflictCheck) {
    const toDate = d => new Date(d + 'T12:00:00');
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const start = toDate(blockDate);
    const end = toDate(blockEndDate);
    if (end < start) {
      setBlockError('End date must be on or after start date.');
      return null;
    }
    // Build full list of dates in the range, inclusive both ends
    const dates = [];
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      dates.push(fmt(cur));
    }
    // Safety cap: do not let a typo create thousands of blocks
    if (dates.length > 90) {
      setBlockError(`That range covers ${dates.length} days. The maximum is 90 days at a time. Please split into smaller ranges.`);
      return null;
    }
    const note = blockNote.trim() || null;

    // Pre-check ALL dates in the range for booking conflicts. Same
    // approach as single-day: surface clashes inline, wait for the
    // therapist to confirm before writing anything.
    if (!skipConflictCheck) {
      const { data: clashes } = await supabase
        .from('bookings')
        .select('id, client_name, start_time, end_time, status, booking_date')
        .eq('therapist_id', therapist.id)
        .in('booking_date', dates)
        .in('status', ['confirmed', 'pending-approval', 'pending-deposit']);
      if (Array.isArray(clashes) && clashes.length > 0) {
        setPendingBlockConflicts({
          date: `${blockDate} to ${blockEndDate}`,
          partial: false,
          blockStart: null,
          blockEnd: null,
          note,
          useArgs: false,
          isRange: true,
          rangeStart: blockDate,
          rangeEnd: blockEndDate,
          conflicts: clashes
            .slice()
            .sort((a,b) => {
              const dc = (a.booking_date || '').localeCompare(b.booking_date || '');
              if (dc !== 0) return dc;
              return (a.start_time || '').localeCompare(b.start_time || '');
            })
            .map(b => ({
              id: b.id,
              client_name: b.client_name,
              start_time: b.start_time,
              status: b.status,
              booking_date: b.booking_date,
            })),
        });
        return null;
      }
    }

    setBlockSaving(true);
    const inserted = [];
    let failedCount = 0;
    for (const d of dates) {
      const { data, error } = await supabase.from('blocked_days')
        .insert({ therapist_id: therapist.id, date: d, note })
        .select().single();
      if (error) {
        failedCount++;
        console.error('[addBlockedDayRange] insert failed for', d, error);
      } else if (data) {
        inserted.push(data);
      }
    }
    if (inserted.length === 0) {
      setBlockError('Could not save the block range. Please try again.');
      setBlockSaving(false);
      return null;
    }
    setBlockedDays(prev => [...prev, ...inserted].sort((a,b)=>{
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return (a.start_time || '').localeCompare(b.start_time || '');
    }));
    setBlockDate(''); setBlockEndDate(''); setBlockNote(''); setBlockStartTime(''); setBlockEndTime('');
    setBlockMode('full');
    setPendingBlockConflicts(null);
    setBlockSaving(false);
    if (failedCount > 0) {
      setBlockError(`Blocked ${inserted.length} of ${dates.length} days. ${failedCount} could not be saved (possibly already blocked).`);
    }
    return inserted;
  }

  async function fetchBookings() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const toDateStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const past = new Date(today); past.setDate(today.getDate() - 365);
      // Future window raised from 60 to 365 days (HK May 21 2026 from
      // Jackie incident). 60 was set on April 1 2026 in the schedule
      // repair commit as a safe arbitrary cap; never a deliberate
      // design choice. Real therapists like Jackie book weekly
      // standing clients up to a year out, so 60 days hid roughly 80%
      // of her real schedule. 365 covers a full year forward + 365
      // back of history. Explicit .limit(5000) keeps the query safe
      // for busy therapists with several years of imported history
      // (raised from 2000 May 21 2026 evening per HK).
      const future = new Date(today); future.setDate(today.getDate() + 365);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, services(name, duration, price, is_couples), location:therapist_locations(name), reminder_sent_at, deposit_required, deposit_paid, deposit_amount, partner_name, partner_email')
        .eq('therapist_id', therapist.id)
        .neq('status', 'cancelled')
        .gte('booking_date', toDateStr(past))
        .lte('booking_date', toDateStr(future))
        .order('booking_date')
        .order('start_time')
        .limit(5000);

      if (error || !bookings?.length) { setRealBookings([]); setPendingApprovalBookings([]); setLoading(false); return; }

      // Split pending-approval rows out so they live in their own panel.
      // The confirmed schedule should not show requests as if they were
      // already on the books.
      const pendingRows = (bookings || []).filter(b => b.status === 'pending-approval');
      const confirmedRows = (bookings || []).filter(b => b.status !== 'pending-approval');

      setPendingApprovalBookings(pendingRows.map(b => ({
        id: b.id,
        client: b.client_name,
        email: (b.client_email || '').toLowerCase().trim(),
        phone: b.client_phone || '',
        date: b.booking_date,
        time: b.start_time ? fmt12(b.start_time.slice(0,5)) : '',
        startTime: (b.start_time || '').slice(0,5),
        service: b.services?.name || 'Session',
        duration: b.services?.duration || 60,
        price: b.services?.price || 0,
        sms_opted_in: !!b.sms_opted_in,
        created_at: b.created_at,
      })));

      // Continue with confirmedRows for the main schedule mapping below.
      const bookingsForSchedule = confirmedRows;
      if (!bookingsForSchedule.length) { setRealBookings([]); setLoading(false); return; }

      // Single condition: a booking has intake done if and only if a session
      // exists with booking_id = this booking's id. ClientIntake now always
      // resolves booking_id at save time, so this is the only check needed.
      const bookingIds = bookingsForSchedule.map(b => b.id);
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, booking_id, client_id')
        .eq('therapist_id', therapist.id)
        .in('booking_id', bookingIds);

      // Phase 14.3j (HK May 17 2026 late): also fetch session_payments to
      // know which bookings have been paid. Without this, the timeline
      // can't visually distinguish paid bookings (real money received)
      // from unpaid confirmed bookings. Both rendered identical yellow
      // cards before this fix.
      const { data: bookingPayments } = await supabase
        .from('session_payments')
        .select('booking_id, status, amount_cents, tip_cents')
        .eq('therapist_id', therapist.id)
        .in('booking_id', bookingIds);
      const paidMap = {};
      (bookingPayments || []).forEach(p => {
        if (!p.booking_id) return;
        if (p.status !== 'succeeded') return;
        const cents = (p.amount_cents || 0) + (p.tip_cents || 0);
        paidMap[p.booking_id] = (paidMap[p.booking_id] || 0) + cents;
      });

      // booking_id → session_id
      const sessionMap = {};
      (sessions || []).forEach(s => {
        if (s.booking_id) sessionMap[s.booking_id] = { id: s.id, client_id: s.client_id };
      });

      const mapped = bookingsForSchedule.map(b => {
        const bd = new Date(b.booking_date + 'T12:00:00'); bd.setHours(0,0,0,0);
        const [h, m] = (b.start_time || '00:00').slice(0,5).split(':').map(Number);
        const sessionInfo = sessionMap[b.id] || null;
        const sessionId = sessionInfo?.id || null;
        // Phase 13.4 (HK May 17 2026): prefer bookings.client_id (now
        // always populated post-Phase 13.3 backfill + FK constraint).
        // Fall back to sessionInfo.client_id only for legacy rows that
        // somehow predate the backfill.
        const clientId = b.client_id || sessionInfo?.client_id || null;

        // Single condition for complete: bookings.status === 'completed'
        // That is the only field the UI updates when marking a session done.
        const status = b.status === 'completed' ? 'complete'
                     : sessionId               ? 'intake-done'
                     :                           'pending-intake';

        return {
          id: b.id,
          client: b.client_name,
          email: (b.client_email || '').toLowerCase().trim(),
          time: fmt12(`${h}:${m}`),
          duration: b.services?.duration || 60,
          date: bd,
          status,
          sessionId,
          clientId,
          sessions: 0,
          service: b.services?.name || 'Session',
          notes: b.notes || '',
          price: b.services?.price || 85,
          // Phase 13.7 (HK May 17 2026): expose cents form for the
          // Checkout + MarkAsPaid modals, which read service_price_cents
          // as the defaultAmountCents. Without this, the modals
          // opened at $0.00.
          service_price_cents: Math.round((b.services?.price || 85) * 100),
          focus: [],
          preview: false,
          reminder_sent: !!b.reminder_sent_at,
          deposit_required: b.deposit_required || false,
          deposit_paid: b.deposit_paid || false,
          deposit_amount: b.deposit_amount || 0,
          is_couples: b.services?.is_couples || false,
          partner_name: b.partner_name || null,
          partner_email: b.partner_email || null,
          endTime: (b.end_time || '').slice(0,5),
          startTime: (b.start_time || '').slice(0,5),
          // Phase 14.3j: paid flag derived from session_payments rows.
          // Used by the timeline card style to color paid bookings.
          paid: (paidMap[b.id] || 0) > 0,
          paid_cents: paidMap[b.id] || 0,
          // Multi-location (HK May 18 2026): location name for the
          // appointment chip. NULL for single-location therapists or
          // pre-migration bookings; the chip render guards on this.
          locationName: b.location?.name || null,
        };
      });

      // External Google Calendar events (Lindsey #10, May 10 2026).
      // Fetch the therapist's own external_calendar_events and merge
      // them into the same schedule list. Therapist sees the event
      // titles ('dentist', 'lunch') so she knows what is blocking her
      // time. Clients on the booking page never see these titles, only
      // a generic 'unavailable' state via the slot generator.
      //
      // Mapped shape mirrors a real booking but with external=true so
      // the render path can switch to a quieter card style. Avatar,
      // service, status icons all suppressed.
      let extEvents = [];
      try {
        const extFrom = new Date(today); extFrom.setDate(today.getDate() - 90);
        const extTo = new Date(today); extTo.setDate(today.getDate() + 60);
        const { data: extRows } = await supabase
          .from('external_calendar_events')
          .select('id, summary, start_at, end_at, is_all_day, source')
          .eq('therapist_id', therapist.id)
          .eq('status', 'confirmed')
          .gte('start_at', extFrom.toISOString())
          .lte('end_at', extTo.toISOString())
          .order('start_at');
        extEvents = (extRows || []).map(e => {
          const startD = new Date(e.start_at);
          const endD = new Date(e.end_at);
          const dateStr = `${startD.getFullYear()}-${String(startD.getMonth()+1).padStart(2,'0')}-${String(startD.getDate()).padStart(2,'0')}`;
          const startMins = startD.getHours() * 60 + startD.getMinutes();
          const durationMins = Math.round((endD - startD) / 60000);
          const startStr = `${String(startD.getHours()).padStart(2,'0')}:${String(startD.getMinutes()).padStart(2,'0')}`;
          const endStr = `${String(endD.getHours()).padStart(2,'0')}:${String(endD.getMinutes()).padStart(2,'0')}`;
          return {
            id: `ext_${e.id}`,
            external: true,
            externalSource: e.source || 'google',
            client: e.summary || 'Calendar event',
            email: '',
            time: e.is_all_day ? 'All day' : fmt12(startStr),
            duration: durationMins,
            date: dateStr,
            status: 'external',
            sessionId: null,
            clientId: null,
            sessions: 0,
            service: e.summary || 'Calendar event',
            notes: '',
            price: 0,
            focus: [],
            preview: false,
            reminder_sent: false,
            deposit_required: false,
            deposit_paid: false,
            deposit_amount: 0,
            is_couples: false,
            partner_name: null,
            partner_email: null,
            startTime: startStr,
            endTime: endStr,
            startMins,
            isAllDay: !!e.is_all_day,
          };
        });
      } catch (extErr) {
        console.warn('External events fetch failed (non-fatal):', extErr);
      }

      setRealBookings([...mapped, ...extEvents]);
    } catch(err) {
      console.error('fetchBookings error:', err);
      setRealBookings([]);
    }
    setLoading(false);
  }

  async function handleApproval(bookingId, action, reason) {
    setActioningId(bookingId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/booking-approval`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ booking_id: bookingId, action, reason: reason || null }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Could not update the request. Please try again.');
        setActioningId(null);
        return;
      }
      setActioningId(null);
      setDeclineFor(null);
      setDeclineReason('');
      fetchBookings();
    } catch (e) {
      console.error('booking-approval error:', e);
      setActioningId(null);
      alert('Something went wrong. Please try again.');
    }
  }

  // Show samples only when (a) therapist hasn't opted out via toggle
  // AND (b) upcoming real bookings < 3. The < 3 threshold is the
  // legacy 'populate the empty calendar so it doesn't look broken'
  // behavior; the toggle gives the therapist an escape hatch when
  // their real bookings are landing and they want a clean view.
  const upcomingReal = (realBookings || []).filter(a => a.date >= today);
  const showSample = showPreviewData && (!realBookings || upcomingReal.length < 3);
  const allAppts = [...(realBookings||[]), ...(showSample ? SAMPLE : [])];

  const TABS=[{id:'today',label:'Today'},{id:'weekly',label:'Weekly'},{id:'monthly',label:'Monthly'},{id:'yearly',label:'Yearly'},{id:'insights',label:'Insights'}];

  const isMobileW = window.innerWidth < 768;
  return (
    <div style={{width:'100%', paddingBottom: isMobileW ? 'calc(74px + env(safe-area-inset-bottom, 0px) + 24px)' : 0}}>
      {showCreate && (
        <BookingModal therapist={therapist} mode="create" onClose={() => setShowCreate(false)} onSuccess={fetchBookings} />
      )}
      {pendingBookingTime && (
        <BookingModal
          therapist={therapist}
          mode="create"
          prefillDateTime={pendingBookingTime}
          onClose={() => setPendingBookingTime(null)}
          onSuccess={() => { setPendingBookingTime(null); fetchBookings(); }}
        />
      )}
      {rescheduleAppt && (
        <BookingModal therapist={therapist} mode="reschedule" existingBooking={rescheduleAppt} onClose={() => setRescheduleAppt(null)} onSuccess={fetchBookings} />
      )}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap',marginBottom:10}}>
          <h2 style={{fontFamily:"'Cormorant Garamond', Georgia, serif",fontSize:32,fontWeight:600,color:'#1F4131',margin:0,lineHeight:1,letterSpacing:'-0.02em'}}>Schedule</h2>
          <span style={{fontSize:13,color:'#6B7280',fontWeight:500}}>{fmtDay(today)}</span>
        </div>
      </div>

      {/* Block panel, expands below action row */}
      {showBlockPanel && (
        <div style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FBFAF4 100%)',
          border: '1px solid #EAE5DA',
          borderRadius: 16,
          padding: '22px 24px',
          marginBottom: 12,
          boxShadow: '0 1px 3px rgba(31, 41, 55, 0.04)',
        }}>
          {/* Header row with title + mode pills, all on one line.
              Replaces the awkward "BLOCK" label that read like a form
              field label. Now it's a section heading with the choice
              built into the same line. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 17,
              fontWeight: 400,
              color: '#1F4030',
              letterSpacing: '-0.005em',
            }}>
              Block off time
            </div>
            <div style={{
              display: 'flex',
              gap: 4,
              background: '#F3F4F6',
              borderRadius: 999,
              padding: 3,
            }}>
              <button
                onClick={() => { setBlockMode('full'); setBlockStartTime(''); setBlockEndTime(''); setBlockError(''); }}
                style={{
                  background: blockMode === 'full' ? '#fff' : 'transparent',
                  color: blockMode === 'full' ? '#1F4030' : '#6B7280',
                  border: 'none',
                  borderRadius: 999,
                  padding: '5px 13px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: blockMode === 'full' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}>
                Full day
              </button>
              <button
                onClick={() => { setBlockMode('partial'); setBlockError(''); }}
                style={{
                  background: blockMode === 'partial' ? '#fff' : 'transparent',
                  color: blockMode === 'partial' ? '#1F4030' : '#6B7280',
                  border: 'none',
                  borderRadius: 999,
                  padding: '5px 13px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: blockMode === 'partial' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}>
                Time range
              </button>
            </div>
          </div>

          {/* Stacked input layout (HK May 21 2026 redesign from
              Jackie's screenshot: prior layout collapsed badly on
              mobile, with 'to' orphaned at end of line and the second
              date dropping to its own row). Now: each input is a
              labeled, full-width row. No more prose-style filler
              words. Reason pills replace the open text input as the
              primary path, with a free-text fallback. */}

          {/* Partial-mode time-range row (only when blockMode is
              'partial'). Two stacked time pickers with explicit
              From / To labels. */}
          {blockMode === 'partial' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    From time
                  </div>
                  <InlineTimeInput
                    value={blockStartTime}
                    onChange={(t) => { setBlockStartTime(t); setBlockError(''); }}
                    placeholder="10:00 AM"
                    ariaLabel="Start time of blocked window"
                    width={'100%'}
                  />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    To time
                  </div>
                  <InlineTimeInput
                    value={blockEndTime}
                    onChange={(t) => { setBlockEndTime(t); setBlockError(''); }}
                    placeholder="2:00 PM"
                    ariaLabel="End time of blocked window"
                    width={'100%'}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date row(s). Full-day mode shows From + To (optional).
              Partial mode shows a single date input. */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  {blockMode === 'full' ? 'From date' : 'On date'}
                </div>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  aria-label="Date to block"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    border: `1.5px solid ${blockDate ? '#E8E4DC' : '#FCA5A5'}`,
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1F4030',
                    outline: 'none',
                    background: '#FBFAF4',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                />
              </div>
              {blockMode === 'full' && (
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    To date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#9CA3AF' }}>(optional)</span>
                  </div>
                  <input
                    type="date"
                    value={blockEndDate}
                    onChange={(e) => setBlockEndDate(e.target.value)}
                    min={blockDate || new Date().toISOString().slice(0, 10)}
                    aria-label="End date (optional, for multi-day blocks)"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      border: '1.5px solid #E8E4DC',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1F4030',
                      outline: 'none',
                      background: '#FBFAF4',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Live preview of what will be blocked. Helps the therapist
              confirm 'yes that's what I want' before tapping the
              button. Visible only when at least the From date is set. */}
          {blockDate && (
            <div style={{
              marginBottom: 14,
              padding: '10px 14px',
              background: '#F0F7F2',
              border: '1px solid #C8E0CC',
              borderRadius: 10,
              fontSize: 13,
              color: '#1F4030',
              lineHeight: 1.55,
            }}>
              {(() => {
                // Build a human preview of what's being blocked
                const fmtDate = (s) => {
                  const d = new Date(s + 'T12:00:00');
                  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                };
                const fmtTime = (t) => {
                  if (!t) return '';
                  const [hh, mm] = t.split(':').map(Number);
                  const ampm = hh >= 12 ? 'PM' : 'AM';
                  const h12 = hh % 12 === 0 ? 12 : hh % 12;
                  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
                };
                if (blockMode === 'partial') {
                  if (!blockStartTime || !blockEndTime) {
                    return <span style={{ color: '#92400E' }}>Choose a start and end time to see the preview.</span>;
                  }
                  return <><strong>Will block:</strong> {fmtDate(blockDate)} from {fmtTime(blockStartTime)} to {fmtTime(blockEndTime)}.</>;
                }
                if (blockEndDate && blockEndDate > blockDate) {
                  const start = new Date(blockDate + 'T12:00:00');
                  const end = new Date(blockEndDate + 'T12:00:00');
                  const days = Math.round((end - start) / 86400000) + 1;
                  return <><strong>Will block {days} days:</strong> {fmtDate(blockDate)} through {fmtDate(blockEndDate)}.</>;
                }
                return <><strong>Will block:</strong> all of {fmtDate(blockDate)}.</>;
              })()}
            </div>
          )}

          {/* Reason row. Quick-pick pills above the free-text input.
              Most therapists pick from the common set; power users
              can still type their own. */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Reason <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#9CA3AF' }}>(optional)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(blockMode === 'partial'
                ? ['Lunch', 'Errand', 'Personal', 'Family', 'Other']
                : ['Vacation', 'Personal day', 'Sick', 'Conference', 'Family', 'Other']
              ).map((preset) => {
                const isActive = blockNote === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBlockNote(isActive ? '' : preset)}
                    style={{
                      background: isActive ? '#2A5741' : '#fff',
                      color: isActive ? '#fff' : '#1F4030',
                      border: `1.5px solid ${isActive ? '#2A5741' : '#E8E4DC'}`,
                      borderRadius: 999,
                      padding: '6px 12px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                    }}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={blockNote}
              onChange={(e) => setBlockNote(e.target.value)}
              placeholder={blockMode === 'partial' ? 'or type your own reason' : 'or type your own reason'}
              aria-label="Reason for blocking time (optional)"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 12px',
                border: '1.5px solid #E8E4DC',
                borderRadius: 10,
                fontSize: 13.5,
                color: '#1F2937',
                outline: 'none',
                background: '#FBFAF4',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
              onFocus={(e) => { e.target.style.background = '#fff'; e.target.style.borderColor = '#2A5741'; }}
              onBlur={(e) => { e.target.style.background = '#FBFAF4'; e.target.style.borderColor = '#E8E4DC'; }}
            />
          </div>

          {/* Pending-conflicts banner (HK May 19 2026 from Candice
              report). If the therapist tries to block a date that has
              existing confirmed or pending bookings, surface them here
              with their times and client names. Therapist either
              cancels or confirms 'Block anyway', which proceeds with
              the block and leaves the conflicting bookings for her to
              decline manually with personal notes. No window.confirm
              per design principle: all confirmation lives inline. */}
          {pendingBlockConflicts && (
            <div style={{
              marginBottom: 14,
              background: '#FFF7ED',
              border: '1.5px solid #FED7AA',
              borderRadius: 12,
              padding: 14,
            }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#9A3412',
                marginBottom: 6,
              }}>
                Heads up: {pendingBlockConflicts.conflicts.length} booking{pendingBlockConflicts.conflicts.length === 1 ? '' : 's'} on this day
              </div>
              <div style={{
                fontSize: 12.5,
                color: '#7C2D12',
                lineHeight: 1.5,
                marginBottom: 10,
              }}>
                {pendingBlockConflicts.partial
                  ? 'These bookings overlap the time you are blocking. Blocking will not auto-cancel them. You will need to decline each one from your dashboard.'
                  : 'These bookings sit on the day you are blocking. Blocking will not auto-cancel them. You will need to decline each one from your dashboard.'}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 12,
              }}>
                {pendingBlockConflicts.conflicts.map(c => {
                  const t = (c.start_time || '').slice(0,5);
                  const [h, m] = t.split(':');
                  const hh = parseInt(h || '0', 10);
                  const ampm = hh >= 12 ? 'PM' : 'AM';
                  const hr = hh % 12 === 0 ? 12 : hh % 12;
                  const tlabel = t ? `${hr}:${m} ${ampm}` : '';
                  return (
                    <div key={c.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#FFFDF8',
                      border: '1px solid #FDE68A',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12.5,
                      color: '#1F2937',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700 }}>{c.client_name || 'Unknown client'}</span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                          {tlabel}{c.status === 'pending-approval' ? ' · pending your approval' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    // Re-issue the block insert with skipConflictCheck=true.
                    // Use either the args path or the form path depending on
                    // what triggered the conflict.
                    const c = pendingBlockConflicts;
                    if (c.useArgs) {
                      addBlockedDay({
                        date: c.date,
                        startTime: c.blockStart,
                        endTime: c.blockEnd,
                        note: c.note,
                        skipConflictCheck: true,
                      });
                    } else {
                      addBlockedDay({ skipConflictCheck: true });
                    }
                  }}
                  disabled={blockSaving}
                  style={{
                    background: 'linear-gradient(135deg, #B45309, #92400E)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: blockSaving ? 'wait' : 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {blockSaving ? 'Blocking…' : 'Block anyway'}
                </button>
                <button
                  onClick={() => setPendingBlockConflicts(null)}
                  disabled={blockSaving}
                  style={{
                    background: 'transparent',
                    color: '#7C2D12',
                    border: '1.5px solid #FED7AA',
                    padding: '8px 16px',
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: blockSaving ? 'wait' : 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action row: error banner on the left if any, Block button
              on the right. The button is sized confidently. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: blockError ? 'space-between' : 'flex-end',
            flexWrap: 'wrap',
          }}>
            {blockError && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                flex: 1,
                minWidth: 200,
              }}>
                {blockError}
              </div>
            )}
            <button
              onClick={addBlockedDay}
              disabled={!blockDate || blockSaving}
              style={{
                background: !blockDate ? '#D1D5DB' : 'linear-gradient(135deg, #2A5741, #1F4030)',
                color: '#fff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.01em',
                cursor: blockDate ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                boxShadow: blockDate ? '0 2px 8px rgba(42, 87, 65, 0.22)' : 'none',
                transition: 'transform 0.1s, box-shadow 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseDown={(e) => { if (blockDate) e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {blockSaving ? 'Blocking…' : (() => {
                if (blockMode === 'partial') return 'Block this time';
                if (blockEndDate && blockEndDate > blockDate) {
                  const start = new Date(blockDate + 'T12:00:00');
                  const end = new Date(blockEndDate + 'T12:00:00');
                  const days = Math.round((end - start) / 86400000) + 1;
                  return `Block these ${days} days`;
                }
                return 'Block this day';
              })()}
            </button>
          </div>

          {/* Existing blocks list. Polished entries that read clearly
              and align cleanly. */}
          {blockedDays.length > 0 && (
            <div style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: '1px solid #EAE5DA',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6B7280',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                Currently blocked
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blockedDays.map(d => {
                  const dateLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  const isPartial = d.start_time && d.end_time;
                  const fmtTime = (t) => {
                    if (!t) return '';
                    const [h, m] = t.split(':');
                    const hh = parseInt(h, 10);
                    const ampm = hh >= 12 ? 'PM' : 'AM';
                    const hr = hh % 12 === 0 ? 12 : hh % 12;
                    return `${hr}:${m} ${ampm}`;
                  };
                  const timeText = isPartial
                    ? `${fmtTime(d.start_time)} to ${fmtTime(d.end_time)}`
                    : 'all day';
                  return (
                    <div key={d.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#fff',
                      border: '1px solid #EAE5DA',
                      borderRadius: 10,
                      padding: '10px 14px',
                      gap: 12,
                    }}>
                      <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: 'Georgia, serif',
                          fontSize: 14,
                          fontWeight: 400,
                          color: '#1F4030',
                          whiteSpace: 'nowrap',
                        }}>
                          {dateLabel}
                        </span>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isPartial ? '#92400E' : '#4B5563',
                          background: isPartial ? '#FEF3C7' : '#F3F4F6',
                          border: `1px solid ${isPartial ? '#FCD34D' : '#D1D5DB'}`,
                          borderRadius: 999,
                          padding: '2px 10px',
                          whiteSpace: 'nowrap',
                        }}>
                          {timeText}
                        </span>
                        {d.note && (
                          <span style={{
                            fontSize: 13,
                            color: '#6B7280',
                            fontStyle: 'italic',
                            fontFamily: 'Georgia, serif',
                          }}>
                            {d.note}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeBlockedDay(d.id)}
                        aria-label={`Remove block for ${dateLabel}`}
                        style={{
                          background: 'transparent',
                          color: '#9CA3AF',
                          border: '1px solid transparent',
                          borderRadius: 8,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#DC2626';
                          e.currentTarget.style.background = '#FEF2F2';
                          e.currentTarget.style.borderColor = '#FCA5A5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#9CA3AF';
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {blockedDays.length === 0 && (
            <div style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid #EAE5DA',
              fontSize: 13,
              color: '#9CA3AF',
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              textAlign: 'center',
            }}>
              Nothing blocked yet. Clients can book any available slot up to a year out.
            </div>
          )}
        </div>
      )}

      {/* Pending booking requests, only shown when therapist has approval
          required and at least one new-client request is waiting. */}
      {pendingApprovalBookings.length > 0 && (
        <div style={{background:'#FFFBEB',border:'1.5px solid #FDE68A',borderRadius:14,padding:'18px 18px 14px',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <span style={{fontSize:18}}>🌿</span>
            <div style={{fontSize:15,fontWeight:700,color:'#92400E',fontFamily:'Georgia,serif'}}>
              Pending requests <span style={{background:'#FDE68A',color:'#92400E',borderRadius:20,padding:'2px 9px',fontSize:12,marginLeft:4}}>{pendingApprovalBookings.length}</span>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {pendingApprovalBookings.map(req => {
              const reqDate = new Date(req.date + 'T12:00:00');
              const dateLabel = reqDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
              const isDeclining = declineFor === req.id;
              const isActioning = actioningId === req.id;
              return (
                <div key={req.id} style={{background:'#fff',borderRadius:10,padding:'14px 14px 12px',border:'1px solid #FDE68A'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
                    <div style={{width:38,height:38,borderRadius:'50%',background:ac(req.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{initials(req.client)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#1F2937',fontFamily:'Georgia,serif'}}>{req.client}</div>
                      <div style={{fontSize:12,color:'#6B7280',marginTop:1}}>{dateLabel} at {req.time} · {req.service} ({req.duration} min)</div>
                      <div style={{fontSize:11,color:'#9CA3AF',marginTop:1}}>{req.email}{req.phone ? ` · ${req.phone}` : ''}</div>
                    </div>
                  </div>
                  {!isDeclining ? (
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={() => handleApproval(req.id, 'approve')}
                        disabled={isActioning}
                        style={{flex:1,background:isActioning?'#86EFAC':'#16A34A',color:'#fff',border:'none',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700,cursor:isActioning?'wait':'pointer',whiteSpace:'nowrap'}}>
                        {isActioning ? '…' : '✓ Approve'}
                      </button>
                      <button onClick={() => { setDeclineFor(req.id); setDeclineReason(''); }}
                        disabled={isActioning}
                        style={{flex:1,background:'#fff',color:'#DC2626',border:'1.5px solid #FECACA',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700,cursor:isActioning?'not-allowed':'pointer',whiteSpace:'nowrap'}}>
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div>
                      <textarea value={declineReason} onChange={e=>setDeclineReason(e.target.value)}
                        placeholder="Optional message to the client (they will see this in their email)"
                        rows={3}
                        style={{width:'100%',padding:'9px 11px',border:'1.5px solid #E8E4DC',borderRadius:8,fontSize:13,resize:'vertical',fontFamily:'system-ui',outline:'none',boxSizing:'border-box',marginBottom:8}} />
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={() => handleApproval(req.id, 'decline', declineReason.trim() || null)}
                          disabled={isActioning}
                          style={{flex:1,background:isActioning?'#FECACA':'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700,cursor:isActioning?'wait':'pointer'}}>
                          {isActioning ? '…' : 'Send decline'}
                        </button>
                        <button onClick={() => { setDeclineFor(null); setDeclineReason(''); }}
                          disabled={isActioning}
                          style={{background:'#F3F4F6',color:'#6B7280',border:'none',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:600,cursor:isActioning?'not-allowed':'pointer'}}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats: single dense inline row. HK May 14 2026: the four
          card tiles ate 110px of vertical space above the calendar,
          which is the star feature. Compressed to one line that
          carries the same four numbers with a thin separator. Same
          numbers, ~75px shorter. Wraps on narrow viewports.
          HK May 19 2026 restyle: bigger serif numerals (24px), 14px
          radius, cream-edge border, soft shadow to match Billing. */}
      <div className="bm-sched-stats" style={{
        display:'flex',
        flexWrap:'wrap',
        gap:0,
        marginBottom:14,
        padding:'14px 18px',
        background:'#fff',
        borderRadius:14,
        border:'1px solid #EDE6D6',
        boxShadow:'0 1px 3px rgba(31, 65, 49, 0.06), 0 1px 2px rgba(31, 65, 49, 0.04)',
        alignItems:'center',
      }}>
        {[
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview).length,label:'Today',color:'#1F4131'},
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview&&a.status==='intake-done').length,label:'Brief ready',color:'#16A34A'},
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview&&a.status==='pending-intake').length,label:'Need intake',color:'#854F0B'},
          {val:allAppts.filter(a=>!a.preview&&a.date>=today&&a.date<=addDays(today,7)).length,label:'This week',color:'#6B9E80'},
        ].map((s,idx,arr)=>(
          <React.Fragment key={s.label}>
            <div style={{display:'inline-flex',alignItems:'baseline',gap:8,padding:'0 18px',flexShrink:0}}>
              <span style={{fontSize:24,fontWeight:600,fontFamily:"'Cormorant Garamond', Georgia, serif",color:s.color,lineHeight:1,letterSpacing:'-0.01em'}}>{s.val}</span>
              <span style={{fontSize:11,color:'#6B7280',fontWeight:600,letterSpacing:'0.02em'}}>{s.label}</span>
            </div>
            {idx < arr.length - 1 && <div style={{width:1,height:22,background:'#EDE6D6',flexShrink:0}}/>}
          </React.Fragment>
        ))}
      </div>

      {/* Period tabs. HK May 19 2026 restyle to match Billing's
          pattern: cream-deep background, equal-width pills, forest-deep
          active text. Yearly tab added for parity. */}
      <div className="bm-tabbar" style={{display:'flex',gap:2,background:'#F5EFE0',borderRadius:12,padding:4,marginBottom:14}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubView(t.id)}
            style={{flex:1,textAlign:'center',background:subView===t.id?'#fff':'transparent',color:subView===t.id?'#1F4131':'#6B7280',border:'none',borderRadius:8,padding:'8px 4px',fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:subView===t.id?'0 1px 3px rgba(31, 65, 49, 0.08)':'none',transition:'all 0.15s',whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Action row, moved below the tab bar per HK May 19 2026:
          'Action buttons sit right below the daily / weekly etc as
          these are important.' Same three actions, same styles. */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:18}}>
        <button onClick={() => setShowCreate(true)}
          style={{display:'inline-flex',alignItems:'center',gap:6,background:'linear-gradient(135deg,#2A5741,#3D6B54)',color:'#fff',border:'none',borderRadius:22,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(42,87,65,0.25)',height:40,lineHeight:1,WebkitTapHighlightColor:'transparent'}}>
          <span style={{fontSize:16,lineHeight:1,marginTop:-1}}>+</span>
          <span>Book Appointment</span>
        </button>

        <button
          onClick={togglePreviewData}
          title={showPreviewData ? 'Tap to hide preview clients' : 'Tap to show preview clients'}
          style={{
            display:'inline-flex',alignItems:'center',gap:6,
            background: showPreviewData ? '#FFF7ED' : '#fff',
            border: `1.5px solid ${showPreviewData ? '#FED7AA' : '#E5E7EB'}`,
            borderRadius:22,padding:'10px 14px',fontSize:12,
            color: showPreviewData ? '#9A3412' : '#6B7280',
            fontWeight:700,whiteSpace:'nowrap',height:40,lineHeight:1,
            cursor:'pointer',WebkitTapHighlightColor:'transparent',
          }}>
          <span>👁️</span>
          <span>Previews: {showPreviewData ? 'ON' : 'OFF'}</span>
        </button>

        <button onClick={()=>setShowBlockPanel(v=>!v)}
          style={{display:'inline-flex',alignItems:'center',gap:6,background:showBlockPanel?'#F3F4F6':'#fff',border:'1.5px solid #E5E7EB',borderRadius:22,padding:'10px 14px',fontSize:12,fontWeight:700,color:'#4B5563',cursor:'pointer',whiteSpace:'nowrap',height:40,lineHeight:1,WebkitTapHighlightColor:'transparent'}}>
          <span>🌿</span>
          <span>Time off</span>
          {blockedDays.length > 0 && (
            <span style={{background:'#FEE2E2',color:'#DC2626',borderRadius:20,padding:'2px 7px',fontSize:11,fontWeight:700,lineHeight:1}}>{blockedDays.length}</span>
          )}
        </button>
      </div>

      {loading
        ?<div style={{textAlign:'center',padding:'40px',color:'#9CA3AF',fontSize:14}}>Loading schedule...</div>
        :(
          /* Persistent 2-col layout. Left rail (intelligence) shows on
             every tab. Right pane swaps Today / Weekly / Monthly /
             Insights. Mobile collapses to single column with rail on
             top.

             Per founder playbook (How we win > intelligence layer):
             insights and intelligence must surface where the decision
             is made, not in an isolated analytics tab. The same Client
             Brief, Body Load, Revenue Pulse, Fill This Gap, and Rebook
             Watch live alongside whichever calendar view the therapist
             is on. */
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobileW ? '1fr' : '260px 1fr',
            gap: isMobileW ? 14 : 16,
            alignItems: 'start',
          }}>
            {/* LEFT RAIL. minWidth:0 wrapper prevents grid-item blow-out
                when the inner carousel has content wider than the column. */}
            <div style={{ minWidth: 0, width: '100%' }}>
              <SmartBookingRail
                isMobile={isMobileW}
                therapist={therapist}
                allAppts={allAppts}
                today={today}
                scope={subView}
                onOpenTimeOff={() => setShowBlockPanel(true)}
              />
            </div>

            {/* RIGHT PANE: tab-selected calendar/insights view. */}
            <div style={{ minWidth: 0 }}>
              {subView==='today'   &&<TimelineView therapist={therapist} allAppts={allAppts} dayOffset={dayOffset} setDayOffset={setDayOffset} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings} blockedDays={blockedDays} onCreateBlock={addBlockedDay} onScheduleAtTime={setPendingBookingTime}/>}
              {subView==='weekly'  &&<WeeklyView therapist={therapist} appointments={allAppts} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings} blockedDays={blockedDays}/>}
              {subView==='monthly' &&<MonthlyView therapist={therapist} appointments={allAppts} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings} blockedDays={blockedDays}/>}
              {subView==='yearly'  &&<YearlyView therapist={therapist} appointments={allAppts} today={today} blockedDays={blockedDays}/>}
              {subView==='insights'&&<InsightsView appointments={allAppts}/>}
            </div>
          </div>
        )
      }
    </div>
  );
}
