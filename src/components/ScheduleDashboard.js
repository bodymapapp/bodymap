import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase, db } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import BookingModal from './BookingModal';
import CancellationChargeModal from './CancellationChargeModal';
import SmartBookingRail from './schedule/SmartBookingRail';
import InlineTimeInput from './InlineTimeInput';
import CloseButton from './CloseButton';
import { useToast } from './Toast';
import CheckoutModal from './CheckoutModal';
// MarkAsPaidModal deleted in Phase 19 (May 18 2026). Functionality
// folded into CheckoutModal's offline payment path. See commit history.
import RefundModal from './RefundModal';
import AutoGrowingTextarea from './AutoGrowingTextarea';
import DocumentJourney from './DocumentJourney';
import { ChevronIcon as SharedChevronIcon, RoundIconButton } from './ChevronIcon';
import CalendarGrid, { CalendarHelpButton } from './CalendarGrid';
import DocumentDrawer from './DocumentDrawer';
import DocErrorBoundary from './DocErrorBoundary';
import BodyDiagram from './BodyDiagram';
import { zoneLabel, zonesToBodyDiagram, pressureLabel, goalLabel, preferenceLabel } from '../lib/bodyZones';

// HK May 25 2026: the 4 doc page components are heavy (each pulls in
// body diagram + html2canvas dependencies via DocumentDrawer's
// children). Loading them at module-init time made the Schedule tab
// noticeably slower per HK's report. Lazy import these instead; they
// only load when the therapist actually taps a doc shortcut pill.
const IntakeBrief = React.lazy(() => import('../pages/IntakeBrief'));
const PreSessionBrief = React.lazy(() => import('../pages/PreSessionBrief'));
const PostSessionBrief = React.lazy(() => import('../pages/PostSessionBrief'));
const PostSessionSummary = React.lazy(() => import('../pages/PostSessionSummary'));

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

// HK May 31 2026: compute a booking's real duration from its start_time
// + end_time on the row. Was previously reading services.duration which
// is just the DEFAULT for that service; when a therapist edited a
// booking to a custom duration (60→90), the bookings.end_time was
// correctly updated but services.duration stayed at 60, so the UI
// showed the old number after refresh. Source of truth is the booking
// row, not the service template.
function durationFromBooking(b) {
  if (!b) return 60;
  if (b.start_time && b.end_time) {
    const [sh, sm] = String(b.start_time).slice(0,5).split(':').map(Number);
    const [eh, em] = String(b.end_time).slice(0,5).split(':').map(Number);
    let mins = (eh*60 + em) - (sh*60 + sm);
    if (mins < 0) mins += 24*60; // safety for malformed overnight
    if (mins > 0) return mins;
  }
  return b.services?.duration || 60;
}

const STATUS = {
  // HK May 31 2026: status taxonomy revised.
  //   paid (new):    green, takes precedence over complete/intake-done when
  //                  any session_payment row is succeeded. Money received is
  //                  the strongest positive signal for the therapist.
  //   intake-done:   relabeled "Intake Received", recolored blue. Was green
  //                  but green is now reserved for paid (money in hand).
  //   complete:      recolored slate. Was gray, indistinct from background.
  //                  Means session happened but no payment recorded yet (the
  //                  paid branch wins when payment exists). Slate = neutral
  //                  end state, not green (paid wins), not red (refunded wins).
  'paid':           {label:'Paid',            bg:'#DCFCE7', color:'#15803D', dot:'#16A34A', icon:'✓'},
  'intake-done':    {label:'Intake Received', bg:'#DBEAFE', color:'#1E40AF', dot:'#3B82F6', icon:'📋'},
  'pending-intake': {label:'No Intake',       bg:'#FEF3C7', color:'#D97706', dot:'#F59E0B', icon:'📋'},
  'complete':       {label:'Complete',        bg:'#E2E8F0', color:'#475569', dot:'#64748B', icon:'✓'},
  'external':       {label:'From Google',     bg:'#EFEAFD', color:'#5B4DC8', dot:'#7F77DD', icon:'📅'},
  // HK May 29 2026: trace patterns for actions taken on a booking. Each
  // entry stays at its original time slot in the timeline but visually
  // de-emphasised, so the therapist can see what HAPPENED at 9am even
  // though it is no longer a confirmable session. The annotation line
  // under the time slot (rendered separately) carries the detail like
  // "Cancelled 2:14 PM" or "$1 no-show fee charged".
  'cancelled':      {label:'Cancelled',    bg:'#FEE2E2', color:'#B91C1C', dot:'#DC2626', icon:'✕'},
  'no_show':        {label:'No-show',      bg:'#FEF3C7', color:'#92400E', dot:'#D97706', icon:'⚠'},
  'refunded':       {label:'Refunded',     bg:'#EDE9FE', color:'#6D28D9', dot:'#7C3AED', icon:'↩'},
  'rescheduled':    {label:'Rescheduled',  bg:'#E0F2FE', color:'#0369A1', dot:'#0284C7', icon:'↻'},
};

// HK May 31 2026: legend was hardcoded inline at 3 sites (timeline,
// monthly, weekly views) and drifted from STATUS over time. Extracted
// to one constant so any future taxonomy change is one edit, not three.
// Trace states (cancelled / no-show / rescheduled / refunded) are shown
// only via the annotation line under the time slot, not in the legend.
const LEGEND_ITEMS = [
  {color:'#15803D', bg:'#DCFCE7', label:'Paid'},
  {color:'#1E40AF', bg:'#DBEAFE', label:'Intake received'},
  {color:'#D97706', bg:'#FEF3C7', label:'No intake yet'},
  {color:'#475569', bg:'#E2E8F0', label:'Complete'},
  {color:'#5B4DC8', bg:'#EFEAFD', label:'From Google'},
];

// HK May 31 2026: single legend component used by Timeline, Weekly,
// and Monthly views so they all explain colors the same way. Was
// three different layouts before (Timeline+Weekly had a collapsible
// "Legend" pill; Monthly had an always-on inline "HOW TO READ" strip
// with extras for initials and "tap a day"). HK called out the
// inconsistency. Now the same control on every view: collapsed pill
// labeled "How to read" that expands to show the color swatches.
function LegendPill() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display:'inline-flex',alignItems:'center',gap:5,
          background: open ? '#F0FDF4' : '#fff',
          border: `1px solid ${open ? '#BBF7D0' : '#E5E7EB'}`,
          borderRadius:14, padding:'4px 10px',
          fontSize:11, color: open ? '#16A34A' : '#6B7280',
          fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
        }}
      >
        <span style={{fontSize:10}}>{open ? '▾' : '▸'}</span>
        How to read
      </button>
      {open && (
        <div style={{
          display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',
          padding:'6px 10px',background:'#fff',borderRadius:8,
          border:'1px solid #F3F4F6',flex:1,minWidth:0,
        }}>
          {LEGEND_ITEMS.map(({color, bg, label}) => (
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
  );
}

// HK May 29 2026: build the human-readable annotation line that sits
// under an appt's time on the timeline. Returns a short string like
// "Cancelled May 28, 2:14 PM" or "$1 no-show fee charged" or
// "Refunded $120" or null when no trace applies. Cheap, called per
// render but the input is small.
function traceAnnotation(appt) {
  if (!appt) return null;
  const fmtTime = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (_e) { return ''; }
  };
  if (appt.status === 'cancelled') {
    const fee = appt.cancellationChargeAmount > 0 ? ` · $${(appt.cancellationChargeAmount / 100).toFixed(2)} fee` : '';
    const at  = appt.cancellationChargeFiredAt ? ` · ${fmtTime(appt.cancellationChargeFiredAt)}` : '';
    return `Cancelled${at}${fee}`;
  }
  if (appt.status === 'no_show') {
    const fee = appt.cancellationChargeAmount > 0 ? `$${(appt.cancellationChargeAmount / 100).toFixed(2)} no-show fee charged` : 'No-show, no fee charged';
    return fee;
  }
  if (appt.status === 'refunded') {
    return `Refunded $${(appt.refundedCents / 100).toFixed(2)}`;
  }
  if (appt.status === 'rescheduled' && appt.previousBookingDate) {
    return `Rescheduled from ${appt.previousBookingDate}${appt.previousStartTime ? ' ' + appt.previousStartTime.slice(0,5) : ''}`;
  }
  return null;
}

// HK May 29 2026: shared trace styling for a booking card. Returns
// { opacity, textDecoration } that callers spread on the card and the
// client name. Used by Timeline, Weekly, and Monthly so a cancelled
// booking looks consistently muted across every view.
function traceStyles(appt) {
  const muted = appt && (appt.status === 'cancelled' || appt.status === 'no_show' || appt.status === 'refunded' || appt.status === 'rescheduled');
  return {
    opacity: muted ? 0.55 : 1,
    textDecoration: appt && appt.status === 'cancelled' ? 'line-through' : 'none',
  };
}

// HK May 31 2026: root-cause fix for DetailPanel glitch.
//
// Before: each view (Timeline/Weekly/Monthly) computed
//   freshSelected = allAppts.find(a => a.id === selectedBookingId)
// every render. Because allAppts is rebuilt on every fetchBookings,
// freshSelected got a NEW OBJECT IDENTITY each render even when the
// underlying data was identical. DetailPanel received a new appt prop
// reference, its useEffect([appt]) fired, and the user saw a render
// cascade as a visible glitch.
//
// Now: useStableSelectedAppt returns a reference that ONLY changes
// when the appt data actually changes. A content hash over the fields
// DetailPanel reads gates the reference swap; if the hash is the same,
// the previous reference is returned and DetailPanel does not re-render.
// Cache layer preserves the panel across refetch races (allAppts briefly
// empty mid-update) by returning the last-known-good when the fresh
// lookup fails.
//
// Cost: one short string concat + comparison per render, negligible.
// Benefit: panel renders are now driven by real data change, not
// parent array identity churn.
function hashApptForPanel(a) {
  if (!a) return '';
  // Fields DetailPanel reads. If any changes, panel should see the
  // new appt. If none change, panel keeps its stable reference.
  return [
    a.id, a.status, a.rawStatus,
    a.client, a.email, a.clientId, a.sessionId,
    a.time, a.startTime, a.endTime, a.duration,
    a.date && a.date.getTime ? a.date.getTime() : '',
    a.booking_date,
    a.service, a.service_id, a.service_price_cents, a.price,
    a.location_id, a.locationName,
    (a.addon_ids || []).join(','), a.addon_total_price, a.addon_extra_minutes,
    a.partner_name, a.partner_email, a.is_couples,
    a.deposit_required, a.deposit_paid, a.deposit_amount,
    a.reminder_sent, a.preview, a.notes,
    a.paid, a.paid_cents, a.paidCents, a.refundedCents,
    a.package_purchase_id,
  ].join('|');
}

function useStableSelectedAppt(allAppts, selectedBookingId) {
  const cacheRef = useRef(null);
  const fresh = selectedBookingId
    ? (allAppts || []).find(a => a.id === selectedBookingId) || null
    : null;
  useEffect(() => {
    if (fresh) cacheRef.current = fresh;
    if (!selectedBookingId) cacheRef.current = null;
    // We intentionally do NOT depend on `fresh` object identity here;
    // the hash memo below handles identity gating. This effect just
    // maintains the cross-refetch cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookingId, fresh && fresh.id]);
  const candidate = fresh
    || (cacheRef.current && cacheRef.current.id === selectedBookingId
        ? cacheRef.current
        : null);
  // useMemo with the content hash gives a stable reference: same hash
  // means same object returned, different hash means swap.
  const hash = hashApptForPanel(candidate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => candidate, [hash]);
}


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
  // HK May 30 2026: bumped padding 9px -> 13px (vertical) for proper
  // 44px+ tap target. 9px padding + 13px line-height + 1.5px border
  // x2 yielded ~26px tap target, well below the 44x44 Apple HIG
  // minimum and miserable for our 70yo persona. With 13px vertical
  // padding the actionable area is ~46px tall. Font sizes also
  // nudged up slightly so the label is more readable.
  padding: '13px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  minHeight: 44,
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

// ─── MicDictationButton ─────────────────────────────────────────
// Web Speech API dictation for desktop. On phones the keyboard mic
// already exists, so this is desktop-first. The button sits next to
// a SOAP field label or textarea; tapping it starts speech recognition
// and streams the transcript into the field via `onAppend`.
//
// HK May 25 2026 (Phase 24f): the missing piece for desktop SOAP
// dictation. Replaces the iPhone keyboard-mic for non-mobile users.
// Falls back to invisible if browser doesn't support recognition.
function MicDictationButton({ onAppend, label = 'Dictate' }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = React.useRef(null);

  // Mobile detection. The in-app mic is desktop-only by design (phones
  // have a keyboard mic). iOS Safari technically exposes
  // webkitSpeechRecognition but the continuous-mode API is unreliable:
  // HK reported May 25 2026 that tapping a mic on iPhone hangs the
  // entire slide-over and never records. So we treat any touch device
  // or narrow viewport as mobile and skip the button entirely. The
  // existing hint copy on the SOAP card already tells phone users to
  // tap the keyboard mic, so nothing is lost by hiding the in-app one.
  const isMobile = typeof window !== 'undefined' && (
    window.matchMedia?.('(max-width: 768px)')?.matches ||
    ('ontouchstart' in window && window.matchMedia?.('(pointer: coarse)')?.matches)
  );

  useEffect(() => {
    if (isMobile) { setSupported(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    setSupported(true);
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;  // only commit finalized phrases
    r.lang = 'en-US';
    r.onresult = (event) => {
      let chunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          chunk += event.results[i][0].transcript;
        }
      }
      if (chunk) onAppend(chunk.trim() + ' ');
    };
    r.onerror = (e) => {
      // 'no-speech' is benign; ignore. Others log so we see why.
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[mic] error:', e.error);
      }
      setListening(false);
    };
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    return () => { try { r.stop(); } catch (_) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const r = recognitionRef.current;
    if (!r) return;
    if (listening) {
      try { r.stop(); } catch (_) {}
      setListening(false);
    } else {
      try {
        r.start();
        setListening(true);
      } catch (_) {
        // 'already started' edge: stop then start.
        try { r.stop(); } catch (_) {}
        setTimeout(() => { try { r.start(); setListening(true); } catch (_) {} }, 100);
      }
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Stop dictation' : label}
      style={{
        width: 28, height: 28,
        borderRadius: '50%',
        border: listening ? '2px solid #DC2626' : `1px solid ${SO.border}`,
        background: listening ? '#FEE2E2' : '#fff',
        color: listening ? '#DC2626' : SO.forest,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'inherit',
        flexShrink: 0,
        animation: listening ? 'bm-mic-pulse 1.4s ease-in-out infinite' : 'none',
      }}
      aria-label={listening ? 'Stop dictation' : 'Start dictation'}
    >
      {listening ? '⏺' : '🎙️'}
      <style>{`
        @keyframes bm-mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
        }
      `}</style>
    </button>
  );
}

// Small uppercase eyebrow label used throughout the cockpit. Replaces
// 17+ inline copies of the same style. Pulls from SO design tokens.
function Label({ children, color }) {
  return (
    <div style={{
      fontSize: SO.labelSize,
      fontWeight: SO.labelWeight,
      color: color || SO.inkMute,
      letterSpacing: SO.labelTracking,
      textTransform: 'uppercase',
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

// SVG chevron used in CockpitSection. Stroke-weighted, rotates
// smoothly on open. Replaces the prior ▾ unicode triangle which
// was thin and read as a decorative glyph rather than a control.
// ChevronIcon centralized in src/components/ChevronIcon.jsx as of HK
// May 27 2026 (standardized site-wide chevrons). Local alias kept so
// CockpitSection's existing call site does not have to change.
const ChevronIcon = SharedChevronIcon;

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

function LastSessionContent({ session, allSessions }) {
  let soap = { S: '', O: '', A: '', P: '', noteToClient: '' };
  let isLegacy = false;
  try {
    const p = JSON.parse(session.therapist_notes || '');
    if (p && p.__soap) soap = p;
  } catch (_) { isLegacy = true; }
  const hasSoap = !!(soap.S || soap.O || soap.A || soap.P);
  const focusZones = [...(session.front_focus || []), ...(session.back_focus || [])];

  // Phase 24d (HK May 25 2026): pattern intelligence inline.
  // When a client has 2+ sessions on file we surface a compact
  // pattern summary right inside Last Session so the therapist sees
  // recurring zones and pressure preference without scrolling down
  // to the dedicated Patterns panel. The standalone Patterns panel
  // still exists for 3+ sessions with full breakdown.
  const showPatternHint = (allSessions || []).length >= 2;
  let patternBits = null;
  if (showPatternHint) {
    const zoneCount = {};
    const pressures = [];
    (allSessions || []).forEach(s => {
      (s.front_focus || []).forEach(z => { zoneCount[z] = (zoneCount[z] || 0) + 1; });
      (s.back_focus || []).forEach(z => { zoneCount[z] = (zoneCount[z] || 0) + 1; });
      if (s.pressure) pressures.push(s.pressure);
    });
    const topZones = Object.entries(zoneCount).sort((a, b) => b[1] - a[1]).slice(0, 2);
    const avgPressure = pressures.length ? (pressures.reduce((a, b) => a + b, 0) / pressures.length) : null;
    if (topZones.length || avgPressure) {
      patternBits = (
        <div style={{
          marginTop: 10,
          padding: '10px 12px',
          background: SO.sageBg,
          borderRadius: 8,
          fontSize: 12,
          color: SO.forest,
          lineHeight: 1.55,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            📊 {(allSessions || []).length} sessions on file
          </div>
          {topZones.length > 0 && (
            <div>Recurring: {topZones.map(([z, n]) => `${zoneLabel(z)} (${n}×)`).join(', ')}</div>
          )}
          {avgPressure && (
            <div>Usual pressure: {pressureLabel(Math.round(avgPressure))} ({avgPressure.toFixed(1)}/5)</div>
          )}
        </div>
      );
    }
  }

  return (
    <div>
      {focusZones.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Label>Focused on</Label>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
            {focusZones.map(z => zoneLabel(z)).join(', ')}
          </div>
        </div>
      )}
      {hasSoap && (
        <div style={{ marginBottom: 12 }}>
          <Label>Your notes (Plan)</Label>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
            {soap.P || soap.A || soap.O || soap.S || ''}
          </div>
        </div>
      )}
      {isLegacy && session.therapist_notes && (
        <div style={{ marginBottom: 12 }}>
          <Label>Your notes</Label>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
            {session.therapist_notes}
          </div>
        </div>
      )}
      {patternBits}
    </div>
  );
}

function PatternsContent({ allSessions }) {
  // HK May 25 2026 (Phase 24e): pattern visualization upgraded from
  // text-only to BodyDiagram heatmap overlay (front + back). THIS
  // IS THE MOAT. Every other massage SaaS shows session notes one
  // at a time. We aggregate ALL prior sessions into a single visual
  // showing recurring focus + avoid zones with intensity scaled by
  // frequency. Therapist sees the client's body story at a glance.

  // Compute zone counts split front/back since BodyDiagram needs them
  // separately. Track avoid zones too. Pressure + cadence stay below
  // the visual as supporting text.
  const frontCount = {};
  const backCount = {};
  const avoidFrontCount = {};
  const avoidBackCount = {};
  const pressures = [];
  const dates = [];
  allSessions.forEach(s => {
    (s.front_focus || []).forEach(z => { frontCount[z] = (frontCount[z] || 0) + 1; });
    (s.back_focus  || []).forEach(z => { backCount[z]  = (backCount[z] || 0) + 1; });
    (s.front_avoid || []).forEach(z => { avoidFrontCount[z] = (avoidFrontCount[z] || 0) + 1; });
    (s.back_avoid  || []).forEach(z => { avoidBackCount[z]  = (avoidBackCount[z] || 0) + 1; });
    if (s.pressure) pressures.push(s.pressure);
    if (s.created_at) dates.push(new Date(s.created_at));
  });

  // Build heatmap inputs: { zoneId: { opacity 0-1, count } }.
  // Opacity scales the dot size in BodyDiagram heatmap mode.
  function buildHeatmap(counts) {
    const max = Math.max(1, ...Object.values(counts));
    const out = {};
    Object.entries(counts).forEach(([id, count]) => {
      // Translate session zone ids to body-diagram zone ids.
      const { frontIds, backIds } = zonesToBodyDiagram([id]);
      const opacity = count / max;
      [...frontIds, ...backIds].forEach(diagId => {
        out[diagId] = { opacity, count };
      });
    });
    return out;
  }
  const heatFront = buildHeatmap(frontCount);
  const heatBack  = buildHeatmap(backCount);
  const heatAvoidFront = buildHeatmap(avoidFrontCount);
  const heatAvoidBack  = buildHeatmap(avoidBackCount);

  // Supporting text below the visual
  const allZoneCount = { ...frontCount, ...backCount };
  const topZones = Object.entries(allZoneCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
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

  const hasHeatData = Object.keys(heatFront).length > 0 || Object.keys(heatBack).length > 0;

  return (
    <div>
      {hasHeatData && (
        <div style={{
          background: SO.cream,
          border: `1px solid ${SO.border}`,
          borderRadius: 12,
          padding: '14px 12px 10px',
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: SO.inkSoft,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 10,
            textAlign: 'center',
          }}>
            Body map across {allSessions.length} sessions
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ textAlign: 'center' }}>
              <BodyDiagram
                mode="heatmap"
                heatmapFocus={heatFront}
                heatmapAvoid={heatAvoidFront}
                size="md"
              />
              <div style={{ fontSize: 10, fontWeight: 600, color: SO.inkMute, marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Front</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <BodyDiagram
                mode="heatmap"
                heatmapFocus={heatBack}
                heatmapAvoid={heatAvoidBack}
                size="md"
              />
              <div style={{ fontSize: 10, fontWeight: 600, color: SO.inkMute, marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Back</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: SO.inkMute, marginTop: 8, textAlign: 'center', lineHeight: 1.45 }}>
            Bigger circles = recurring zones. Sage = focus, rose = avoid.
          </div>
        </div>
      )}
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>
        {topZones.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong>Recurring focus:</strong> {topZones.map(([z, n]) => `${zoneLabel(z)} (${n}×)`).join(', ')}
          </div>
        )}
        {avgPressure && (
          <div style={{ marginBottom: 8 }}>
            <strong>Avg pressure preference:</strong> {avgPressure}/5 ({pressureLabel(Math.round(avgPressure))})
          </div>
        )}
        {avgGap && (
          <div style={{ marginBottom: 8 }}>
            <strong>Cadence:</strong> ~{avgGap} days between visits
          </div>
        )}
      </div>
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
  // 'Draft with PracticeIQ' button (no "AI" wording).
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
      setDraftError("PracticeIQ is off. Turn it on in Settings.");
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
        🎙️ On phone, tap the microphone on your keyboard. On desktop, tap the mic next to any field below.
      </div>

      {/* HK May 25 2026 (Phase 22): SOAP fields come FIRST. Private
          notes is a summary the PracticeIQ can draft from
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

      {/* Phase 24f: each field label paired with a MicDictationButton
          on the right. Desktop users now have parity with phone where
          the keyboard mic is built in. Pure UX: transcript appends to
          the field; user can stop, edit, dictate more. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Label>S, Subjective</Label>
        <MicDictationButton onAppend={(t) => setS(prev => (prev ? prev + ' ' : '') + t)} label="Dictate Subjective" />
      </div>
      {/* HK May 31 2026: AutoGrowingTextarea replaces fixed-height
          textarea. Fields start at 2 rows and grow as the therapist
          types up to maxRows=10, then scroll internally. SOAP fields
          can take long entries from older clients without forcing
          the therapist to scroll inside a tiny window. */}
      <AutoGrowingTextarea value={S} onChange={e => setS(e.target.value)} placeholder="What the client reports: pain, history, what they want" style={fieldStyle} minRows={2} maxRows={10} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Label>O, Objective</Label>
        <MicDictationButton onAppend={(t) => setO(prev => (prev ? prev + ' ' : '') + t)} label="Dictate Objective" />
      </div>
      <AutoGrowingTextarea value={O} onChange={e => setO(e.target.value)} placeholder="What you observed: range of motion, tissue, posture" style={fieldStyle} minRows={2} maxRows={10} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Label>A, Assessment</Label>
        <MicDictationButton onAppend={(t) => setA(prev => (prev ? prev + ' ' : '') + t)} label="Dictate Assessment" />
      </div>
      <AutoGrowingTextarea value={A} onChange={e => setA(e.target.value)} placeholder="Your professional read on the situation" style={fieldStyle} minRows={2} maxRows={10} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Label>P, Plan</Label>
        <MicDictationButton onAppend={(t) => setP(prev => (prev ? prev + ' ' : '') + t)} label="Dictate Plan" />
      </div>
      <AutoGrowingTextarea value={P} onChange={e => setP(e.target.value)} placeholder="What you did this session and what comes next" style={fieldStyle} minRows={2} maxRows={10} />

      {/* Therapist's private notes - SUMMARY of the SOAP work above.
          PracticeIQ can draft from the SOAP fields when
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
      {/* HK May 25 2026 (Phase 24d): PracticeIQ naming.
          Renamed from "Draft from SOAP above" since the assistant
          may eventually do more (recap drafts, summaries, follow-up
          suggestions). PracticeIQ rebrand still under review;
          using neutral 'PracticeIQ' label until then. */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>Private notes</Label>
          <MicDictationButton onAppend={(t) => setPrivateNotes(prev => (prev ? prev + ' ' : '') + t)} label="Dictate private notes" />
        </div>
        <div style={{
          fontSize: 12,
          color: SO.inkMute,
          marginBottom: 10,
          lineHeight: 1.5,
        }}>
          A quick summary for yourself. Tap PracticeIQ to draft one from your SOAP notes.
        </div>
        {therapist?.ai_enabled !== false && (
          <button
            type="button"
            onClick={draftSoap}
            disabled={drafting}
            style={{
              background: drafting ? '#E5DDD2' : '#fff',
              border: '1.5px solid #D6E0D4',
              borderRadius: 999,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: SO.forest,
              cursor: drafting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              marginBottom: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {drafting ? 'Drafting…' : '✨ Use PracticeIQ'}
          </button>
        )}
      </div>
      <AutoGrowingTextarea
        value={privateNotes}
        onChange={e => setPrivateNotes(e.target.value)}
        placeholder="Quick note for yourself: what you worked on, what to remember next time. Tap 'Draft from SOAP' to have the PracticeIQ write a summary."
        style={fieldStyle}
        minRows={3}
        maxRows={14}
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
  // E:  Dictation nudge + 'Draft with PracticeIQ' button
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
  // Phase 24d: two-step confirm before sending the recap email.
  const [confirmSend, setConfirmSend] = useState(false);

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
      setDraftError("PracticeIQ is off. Turn it on in Settings.");
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
        🎙️ On phone, tap the keyboard mic. On desktop, tap the mic next to the field.
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 8 }}>
        A warm note your client receives by email after this session. Keep it short, kind, forward-looking.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Message to client
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MicDictationButton onAppend={(t) => setText(prev => (prev ? prev + ' ' : '') + t)} label="Dictate recap" />
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
              {drafting ? 'Drafting...' : '✨ Draft with PracticeIQ'}
            </button>
          )}
        </div>
      </div>

      <AutoGrowingTextarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Thanks for coming in today. I worked on your right shoulder and gave you a doorway stretch to take home..."
        style={{ marginBottom: 10 }}
        minRows={5}
        maxRows={14}
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

      {/* HK May 25 2026 (Phase 24d): two-step send confirm with
          prominent sent state. Previous: one-click Save & send with
          a small "Sent at TIME" hint that was easy to miss. Now:
          first tap → confirm card showing client email + Send/Cancel.
          After send → replaces the whole row with a green Sent card
          showing recipient + time. SMS option queued (blocked by
          A2P approval), text-only for now. */}
      {sentAt ? (
        <div style={{
          background: SO.okBg,
          border: `1.5px solid ${SO.okBorder}`,
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: SO.ok, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>✓</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: SO.ok }}>
              Recap sent
            </div>
            <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
              {sentAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              {session?.client_email ? ` · ${session.client_email}` : ''}
            </div>
          </div>
          {onRebook && (
            <button
              onClick={onRebook}
              style={{
                background: '#fff',
                color: SO.forest,
                border: '1.5px solid #D6E0D4',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              📅 Book next
            </button>
          )}
        </div>
      ) : confirmSend ? (
        <div style={{
          background: '#F9F5EE',
          border: `1.5px solid #E5DDD2`,
          borderRadius: 10,
          padding: '14px 14px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: SO.ink, marginBottom: 6 }}>
            Send recap to client?
          </div>
          <div style={{ fontSize: 12, color: SO.inkMute, marginBottom: 12, lineHeight: 1.5 }}>
            We'll email this recap to <strong>{session?.client_email || 'your client'}</strong>. SMS option coming soon.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setConfirmSend(false); save(); }}
              disabled={saving || sendingEmail}
              style={{
                ...btnPrimary,
                flex: 1,
                opacity: (saving || sendingEmail) ? 0.6 : 1,
                cursor: (saving || sendingEmail) ? 'wait' : 'pointer',
              }}
            >
              {sendingEmail ? 'Sending…' : saving ? 'Saving…' : '💌 Send email'}
            </button>
            <button
              onClick={() => setConfirmSend(false)}
              disabled={saving || sendingEmail}
              style={{ ...btnSecondary, padding: '9px 14px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setConfirmSend(true)}
            disabled={!text.trim()}
            style={{
              ...btnPrimary,
              opacity: !text.trim() ? 0.5 : 1,
              cursor: !text.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            💌 Save & send recap
          </button>
          {onRebook && (
            <button
              onClick={onRebook}
              style={{ ...btnSecondary, padding: '9px 14px' }}
            >
              📅 Book next session
            </button>
          )}
          {savedAt && !sentAt && !sendingEmail && !sendError && (
            <span style={{ fontSize: 12, color: SO.ok, fontWeight: 600 }}>
              ✓ Saved at {savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// HK May 31 2026 (Side panel A): DetailPanel exported so BookingDetailPage
// can render it in mode='page' as a full-page route.
export function DetailPanel({ appt, therapist, onClose, onReschedule, onCancelled, showToast, onRequestCheckout, paymentsRefreshTick = 0, mode = 'slide' }) {
  const notify = showToast || (() => {});
  // Mobile detection for paddingBottom that clears the mobile bottom nav
  // (74px) so the Cancel button doesn't get cut off. HK reported May 25
  // 2026 that the cancel link was sitting behind the bottom nav on
  // iPhone. The slide-over zIndex (301) is below the bottom nav (999) so
  // the nav overlays the last ~74px of slide-over content; we have to
  // pad the inner content to compensate.
  const isMobileW = typeof window !== 'undefined' && window.innerWidth < 768;

  // Inline DocumentDrawer state. HK May 25 2026: tapping a doc shortcut
  // pill (Intake / Brief / Record / Recap) used to navigate to
  // /dashboard/clients/cid/sessions/sid?doc=N which is a separate page,
  // breaking the 70yo persona's mental model. Now the drawer mounts
  // INSIDE the slide-over so the therapist stays on Schedule. zIndex
  // on DocumentDrawer (998-999) is already higher than the slide-over
  // (301) so it overlays correctly without further work.
  const [drawerDoc, setDrawerDoc] = useState(null);
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

  // HK May 25 2026 (Phase 24d): body scroll lock. When the slide-over
  // is open, scrolling on the dimmed backdrop should NOT scroll the
  // schedule grid behind it. Without this, the user moves their
  // cursor onto the side panel but their wheel still scrolls the
  // main page, which feels broken. Combined with overscroll-behavior:
  // contain on the panel itself, scrolls now stay where the cursor is.
  // HK May 25 2026: lock body scroll when the slide-over is open so
  // wheel/touch events on the panel don't cascade to the page behind.
  // HK May 31 2026 round 3: gated to mode==='slide' only. In page mode
  // the panel IS the page — locking body scroll there made the entire
  // /dashboard/schedule/booking/:id route unscrollable, which is what
  // HK hit. Backdrop + overlay logic only applies to the slide-over.
  useEffect(() => {
    if (mode !== 'slide') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [mode]);

  const st = STATUS[displayAppt.status]||STATUS['pending-intake'];
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const [copied,setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // HK May 29 2026: when the booking belongs to a series, the inline-
  // cancel confirm panel offers to also cancel all future in the series.
  const [cancelAllInSeries, setCancelAllInSeries] = useState(false);
  const [editTime, setEditTime] = useState(false);
  const [newStartTime, setNewStartTime] = useState(appt.startTime || '');
  const [newEndTime, setNewEndTime] = useState(appt.endTime || '');
  const [savingTime, setSavingTime] = useState(false);
  // HK May 27 2026: service editing state. Lets therapist change
  // service type, duration, location, addons, and partner info on
  // an existing booking. Locked if a payment has been recorded
  // (Option C: refund-then-rebook for paid bookings).
  const [editService, setEditService] = useState(false);
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [locationCatalog, setLocationCatalog] = useState([]);
  const [addonCatalog, setAddonCatalog] = useState([]);
  const [serviceCatalogLoaded, setServiceCatalogLoaded] = useState(false);
  const [newServiceId, setNewServiceId] = useState(appt.service_id || null);
  const [newDuration, setNewDuration] = useState(appt.duration || 60);
  const [newLocationId, setNewLocationId] = useState(appt.location_id || null);
  const [newAddonIds, setNewAddonIds] = useState(appt.addon_ids || []);
  const [newPartnerName, setNewPartnerName] = useState(appt.partner_name || '');
  const [newPartnerEmail, setNewPartnerEmail] = useState(appt.partner_email || '');
  const [savingService, setSavingService] = useState(false);
  const [serviceEditError, setServiceEditError] = useState(null);
  // Shape: { id, name, sessions_purchased, sessions_remaining,
  //   used_count, this_session_number, expires_at, linked }
  // Or null when no active package matches.
  const [activePackage, setActivePackage] = useState(null);
  // HK May 27 2026: ALL candidate packages for this client. Used by
  // the manage-link panel so therapist can pick a different package
  // (or unlink) when more than one is active. Each entry has the
  // same shape as activePackage above so the UI can render uniformly.
  const [availablePackages, setAvailablePackages] = useState([]);
  // Pending edit to the package linkage. null when no change in
  // flight. When the therapist taps 'Link to package' or 'Unlink',
  // we run the supabase write and refresh.
  const [packageLinkBusy, setPackageLinkBusy] = useState(false);
  // Inline manage-link expander toggle. Hidden by default; shows
  // candidate package radios + Unlink + Save when expanded.
  const [showPackageLinkPanel, setShowPackageLinkPanel] = useState(false);
  // HK May 31 2026: optional session-number override picker. Keyed by
  // package_purchase_id so each row in the picker has its own input.
  // Therapist enters "this is session 3 of 5" before tapping the row.
  // Null/empty = let the system auto-compute by chronological order.
  const [sessionNumberDraft, setSessionNumberDraft] = useState({});
  // HK May 27 2026 Phase Pkg-C: detect the active package this
  // booking is part of. Resolution order:
  //   1. If booking has explicit package_purchase_id, use it.
  //   2. Otherwise, find the most-recent active package_purchase for
  //      this client_email that is applicable to this booking's
  //      service_id (or applies to any service). The booking's
  //      position in the package (1, 2, 3...) is computed from
  //      bookings with the same client_email + therapist that fall
  //      on or after purchased_at, ordered by booking_date.
  // Same email-based linkage logic ClientPackageBalance uses, kept
  // consistent so both surfaces show the same numbers.
  useEffect(() => {
    if (!appt?.id || !therapist?.id || appt.preview) return;
    let alive = true;
    (async () => {
      try {
        const email = (appt.email || '').toLowerCase().trim();
        if (!email && !appt.package_purchase_id) {
          setActivePackage(null);
          setAvailablePackages([]);
          return;
        }

        // Load ALL active packages for this client (not just the
        // single best match). The manage-link panel needs the full
        // list so therapist can pick a different one or see why a
        // particular one was auto-suggested.
        let allPurchases = [];
        if (email) {
          const { data: ps } = await supabase
            .from('package_purchases')
            .select('id, sessions_purchased, sessions_remaining, status, purchased_at, expires_at, client_email, package:packages(id, name, applicable_service_ids)')
            .eq('therapist_id', therapist.id)
            .ilike('client_email', email)
            .in('status', ['active', 'exhausted'])
            .order('purchased_at', { ascending: false });
          allPurchases = ps || [];
        }

        // If the booking has an explicit FK to a package not in the
        // active+exhausted list above (e.g. expired or refunded),
        // fetch it separately so it can still display.
        if (appt.package_purchase_id && !allPurchases.find(p => p.id === appt.package_purchase_id)) {
          const { data: p } = await supabase
            .from('package_purchases')
            .select('id, sessions_purchased, sessions_remaining, status, purchased_at, expires_at, client_email, package:packages(id, name, applicable_service_ids)')
            .eq('id', appt.package_purchase_id)
            .maybeSingle();
          if (p) allPurchases.unshift(p);
        }

        if (!alive) return;

        if (allPurchases.length === 0) {
          setActivePackage(null);
          setAvailablePackages([]);
          return;
        }

        // For each purchase, compute session count + this-session-number
        // by fetching bookings on or after purchase date for this email.
        // One bookings query covers all packages since they share the
        // same client email.
        const earliestPurchase = allPurchases.reduce((min, p) => {
          const d = p.purchased_at ? new Date(p.purchased_at).toISOString().split('T')[0] : '1970-01-01';
          return d < min ? d : min;
        }, '9999-12-31');

        const { data: clientBookings } = await supabase
          .from('bookings')
          .select('id, booking_date, start_time, status, service_id, package_purchase_id')
          .eq('therapist_id', therapist.id)
          .ilike('client_email', email)
          .neq('status', 'cancelled')
          .gte('booking_date', earliestPurchase)
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true });

        // HK May 31 2026: pull session_number_override from redemptions
        // so we can show "Session 3 of 5" when the therapist explicitly
        // entered the number rather than auto-computing chronological
        // order. One query covers all packages.
        const packageIds = allPurchases.map(p => p.id);
        let redemptionsByBooking = {};
        if (packageIds.length > 0 && appt?.id) {
          const { data: reds } = await supabase
            .from('package_redemptions')
            .select('booking_id, package_purchase_id, session_number_override')
            .in('package_purchase_id', packageIds)
            .eq('booking_id', appt.id);
          (reds || []).forEach(r => {
            redemptionsByBooking[r.package_purchase_id] = r.session_number_override;
          });
        }

        if (!alive) return;

        const enriched = allPurchases.map(p => {
          const purchasedDate = p.purchased_at
            ? new Date(p.purchased_at).toISOString().split('T')[0]
            : '1970-01-01';
          const apply = p.package?.applicable_service_ids;
          const serviceCovered = (svcId) => {
            if (!apply || (Array.isArray(apply) && apply.length === 0)) return true;
            if (Array.isArray(apply)) return apply.includes(svcId);
            return false;
          };
          const isInPack = (b) => b.package_purchase_id === p.id;
          const packBookings = (clientBookings || []).filter(isInPack);
          let thisSessionNumber = null;
          let usedCount = 0;
          for (let i = 0; i < packBookings.length; i++) {
            const b = packBookings[i];
            if (b.id === appt.id) thisSessionNumber = i + 1;
            if (b.status === 'completed') usedCount += 1;
          }
          // HK May 31 2026: explicit override takes precedence over
          // chronological auto-computation. Fixes the "Session ? of 5"
          // display where chronology wasn't yielding a number.
          if (redemptionsByBooking[p.id]) {
            thisSessionNumber = redemptionsByBooking[p.id];
          }
          // Is this booking eligible to attach to this package?
          const eligible = appt.package_purchase_id === p.id
            || (appt.booking_date >= purchasedDate && serviceCovered(appt.service_id));

          return {
            id: p.id,
            name: p.package?.name || 'Package',
            sessions_purchased: p.sessions_purchased,
            sessions_remaining: p.sessions_remaining,
            used_count: usedCount,
            this_session_number: thisSessionNumber,
            expires_at: p.expires_at,
            status: p.status,
            purchased_at: p.purchased_at,
            linked: appt.package_purchase_id === p.id,
            eligible,
          };
        });

        setAvailablePackages(enriched);

        // Pick the active one for the badge. Priority:
        //   1. Linked (explicit FK)
        //   2. Most-recent purchase that is eligible
        const linked = enriched.find(p => p.linked);
        const bestSuggestion = enriched.find(p => p.eligible && p.status === 'active');
        setActivePackage(linked || bestSuggestion || null);
      } catch (err) {
        console.warn('[package detect] failed:', err);
        if (alive) {
          setActivePackage(null);
          setAvailablePackages([]);
        }
      }
    })();
    return () => { alive = false; };
  }, [appt?.id, appt?.email, appt?.service_id, appt?.package_purchase_id, appt?.booking_date, therapist?.id, appt?.preview]);
  // Phase 12: Checkout modal. Phase 19 (May 18 2026) folded MarkAsPaid
  // into the same modal so there is now just one charge modal.
  // Phase 1 (HK May 31 2026): checkout state lifted to ScheduleDashboard
  // root via onRequestCheckout. CheckoutModal no longer renders here.
  // Phase 14.3b (HK May 17 2026): in-app refund. refundTarget holds
  // the session_payments row to be refunded; setting it null closes
  // the modal.
  const [refundTarget, setRefundTarget] = useState(null);
  // HK May 29 2026: Send Agreement quick-action state. Holds 'email',
  // 'sms', or false. Channel-explicit so the loading indicator can show
  // which button the therapist tapped, and double-taps on the other
  // channel during a send are blocked.
  const [sendingAgreement, setSendingAgreement] = useState(false);
  const [paymentRows, setPaymentRows] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [clientRow, setClientRow] = useState(null);
  const firstName = appt.client?.split(' ')[0];
  const intakeLink = `${intakeUrl}?name=${encodeURIComponent(appt.client)}&email=${encodeURIComponent(appt.email)}&booking_id=${appt.id}`;

  // HK May 29 2026: sendAgreement helper extracted from the old single
  // button. Accepts a channel ('email' or 'sms') and runs the same row
  // creation + token generation in both paths, then dispatches:
  //   - email: invokes send-agreement-email edge fn AND copies link to
  //     clipboard as a fallback the therapist can paste anywhere.
  //   - sms: opens sms: link in the device handler with the agreement
  //     URL prefilled in the body, no edge fn call needed.
  // Both paths persist the agreement_send_request row so a Sent record
  // shows on the Compliance Dashboard regardless of which channel.
  async function sendAgreement(channel) {
    if (sendingAgreement) return;
    if (!clientRow?.id || !therapist?.id) {
      notify('Open this booking again after the client record loads');
      return;
    }
    setSendingAgreement(channel);
    try {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
      const codeBytes = crypto.getRandomValues(new Uint8Array(7));
      const shortCode = Array.from(codeBytes)
        .map(b => alphabet[b % alphabet.length])
        .join('');
      const { data: req, error: insErr } = await supabase
        .from('agreement_send_requests')
        .insert({
          token,
          short_code: shortCode,
          therapist_id: therapist.id,
          client_id: clientRow.id,
          client_name: clientRow.name || null,
          client_email: clientRow.email || null,
          client_phone: clientRow.phone || null,
        })
        .select('id, short_code, token')
        .single();
      if (insErr) throw insErr;
      const link = `${window.location.origin}/s/${req.short_code || shortCode}`;
      if (channel === 'email') {
        if (clientRow.email) {
          // HK May 31 2026: previously this was fire-and-forget with
          // .catch(()=>{}) which silently hid every failure. Toast
          // showed "sent" whether the email went out or not. The
          // edge function returns ok: true / false in the body, so
          // we await and check.
          try {
            const { data: fnData, error: fnErr } = await supabase.functions.invoke('send-agreement-email', {
              body: {
                short_code: req.short_code || shortCode,
                therapist_id: therapist.id,
                client_email: clientRow.email,
                client_name: clientRow.name || null,
                link,
              },
            });
            if (fnErr || !fnData?.ok) {
              const detail = fnErr?.message || fnData?.error || 'email delivery failed';
              console.error('[sendAgreement email]', detail);
              try { await navigator.clipboard.writeText(link); } catch (_) {}
              notify('Email did not send. Link copied so you can paste it.');
              return;
            }
          } catch (e) {
            console.error('[sendAgreement email] threw:', e);
            try { await navigator.clipboard.writeText(link); } catch (_) {}
            notify('Email did not send. Link copied so you can paste it.');
            return;
          }
        }
        try { await navigator.clipboard.writeText(link); } catch (_e) {}
        notify(`Agreement sent to ${clientRow.email}`);
      } else if (channel === 'sms') {
        // Open the sms: handler with the link prefilled. The therapist
        // taps Send in their default messaging app.
        const phone = clientRow.phone || '';
        const body = encodeURIComponent(`Hi ${(appt.client || clientRow.name || '').split(' ')[0] || 'there'}! Please sign your practice agreement: ${link}`);
        window.location.href = `sms:${phone}&body=${body}`;
      }
    } catch (e) {
      console.error('[sendAgreement]', e);
      notify('Could not send agreement, try again');
    } finally {
      setSendingAgreement(false);
    }
  }

  // HK May 31 2026: short-link intake delivery.
  //
  // Previously the SMS and Email pills put a raw 200+ char URL in the
  // message body (intakeLink with name/email/booking_id stuffed as
  // query params). HK called this 'horrible' and 'unprofessional.'
  //
  // Now we create an intake_send_requests row with a 7-char short_code,
  // and the message body says https://mybodymap.app/i/<code>. When the
  // client opens the short URL, IntakeRedirect.jsx looks up the row
  // and redirects them to the actual intake form with name/email/
  // booking_id prefilled. Mirrors the sendAgreement pattern.
  const [sendingIntake, setSendingIntake] = useState(false);
  async function sendIntake(channel) {
    if (sendingIntake) return;
    if (!clientRow?.id || !therapist?.id) {
      notify('Open this booking again after the client record loads');
      return;
    }
    setSendingIntake(channel);
    try {
      const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
      const codeBytes = crypto.getRandomValues(new Uint8Array(7));
      const shortCode = Array.from(codeBytes)
        .map(b => alphabet[b % alphabet.length])
        .join('');
      const { data: req, error: insErr } = await supabase
        .from('intake_send_requests')
        .insert({
          short_code: shortCode,
          therapist_id: therapist.id,
          therapist_slug: therapist.custom_url,
          client_id: clientRow.id,
          client_name: clientRow.name || null,
          client_email: clientRow.email || null,
          client_phone: clientRow.phone || null,
          booking_id: appt.id,
        })
        .select('short_code')
        .single();
      if (insErr) throw insErr;
      const link = `${window.location.origin}/i/${req.short_code || shortCode}`;
      const firstNameLocal = (appt.client || clientRow.name || '').split(' ')[0] || 'there';
      const messageBody = `Hi ${firstNameLocal}! Please fill your intake form before your session: ${link}`;
      if (channel === 'email') {
        if (clientRow.email) {
          try {
            const { data: fnData, error: fnErr } = await supabase.functions.invoke('send-intake-email', {
              body: {
                short_code: req.short_code || shortCode,
                therapist_id: therapist.id,
                client_email: clientRow.email,
                client_name: appt.client || clientRow.name || null,
                link,
              },
            });
            if (fnErr || !fnData?.ok) {
              const detail = fnErr?.message || fnData?.error || 'email delivery failed';
              console.error('[sendIntake email]', detail);
              try { await navigator.clipboard.writeText(link); } catch (_) {}
              notify('Email did not send. Link copied so you can paste it.');
              return;
            }
          } catch (e) {
            console.error('[sendIntake email] threw:', e);
            try { await navigator.clipboard.writeText(link); } catch (_) {}
            notify('Email did not send. Link copied so you can paste it.');
            return;
          }
        }
        try { await navigator.clipboard.writeText(link); } catch (_e) {}
        notify(`Intake sent to ${clientRow.email}`);
      } else if (channel === 'sms') {
        const phone = clientRow.phone || '';
        const body = encodeURIComponent(messageBody);
        window.location.href = `sms:${phone}&body=${body}`;
      }
    } catch (e) {
      console.error('[sendIntake]', e);
      notify('Could not create intake link, try again');
    } finally {
      setSendingIntake(false);
    }
  }

  // Load existing payments for this booking + the client row (for
  // card-on-file and id passing to the modals).
  // HK May 31 2026: paymentsRefreshTick is bumped by ScheduleDashboard
  // after CheckoutModal reports onPaid, so this effect re-runs and
  // the just-recorded payment appears in the panel immediately.
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
  }, [appt?.id, appt?.clientId, appt?.preview, paymentsRefreshTick]);

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
  //
  // HK May 25 2026: also honors an explicit waiver by the therapist
  // (intake_waived_at). Some clients walk in without filling the form
  // online and the therapist decides to proceed anyway. The waiver
  // sets a timestamp on the booking row so the brief panel + journey
  // dots stop nagging about a missing intake for that session.
  const [intakeWaivedLocal, setIntakeWaivedLocal] = useState(!!appt.intake_waived_at);

  // HK May 25 2026 round 7: SOAP is now always accessible regardless
  // of intake state. The session row is auto-created on DetailPanel
  // mount whenever the booking has no session yet. The previous design
  // gated SOAP behind intake submission OR a waiver checkbox which
  // led to 6 rounds of debugging when the session-creation INSERT
  // failed silently.
  //
  // New model: SOAP has no dependency on intake. Open a booking ->
  // session row exists or gets created -> RecordEditor renders.
  // Side effect to note: bookings the therapist opens flip to
  // 'intake-done' on the schedule on next page load because a session
  // row now exists for them. Mental model: opening the cockpit is
  // engagement, the booking is considered prepped.
  //
  // The booking's intake_waived_at flag is still read for the brief
  // panel + journey dot 1 state, but no longer drives SOAP at all.
  useEffect(() => {
    if (!appt?.id) return;
    if (appt.preview) return;
    let alive = true;
    (async () => {
      // Read the booking's intake_waived_at flag for the brief panel
      // + journey state. Independent of session work below.
      const { data: bk } = await supabase
        .from('bookings')
        .select('intake_waived_at')
        .eq('id', appt.id)
        .maybeSingle();
      if (!alive) return;
      if (bk?.intake_waived_at) setIntakeWaivedLocal(true);

      // Ensure a session row exists for this booking. Skip if the
      // parent already linked one, skip if we already loaded one in
      // this DetailPanel mount.
      if (appt.sessionId) return;
      if (currentSession?.id) return;

      const { data: existing } = await supabase
        .from('sessions')
        .select('*')
        .eq('booking_id', appt.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (existing) {
        setCurrentSession(existing);
        return;
      }

      // HK May 31 2026: STOP auto-creating empty draft sessions on
      // every panel open. Previously this fired a sessions INSERT on
      // every tap, which triggered Supabase realtime, which fired
      // scheduleRefresh, which ran a full fetchBookings (1.2 seconds
      // of blocking refresh). On a phone with 651 bookings and panel
      // sub-components mid-render, this caused cascading refresh
      // storms that looked like crashes.
      //
      // The notes editor (SOAP, brief, recap) already creates the
      // session on first save via db.createSession. There is no
      // functional reason to pre-create an empty row. The panel
      // renders fine against currentSession = null because the
      // intake_done check below treats it as "no intake yet."
      //
      // Net effect: one DB write per actual save instead of one
      // per tap. Realtime traffic drops 10x. No more refresh storm
      // every time the therapist opens a booking.
      return;
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt?.id, appt?.sessionId, appt?.clientId, therapist?.id]);

  const intakeDone = !!(
    (currentSession?.front_focus && currentSession.front_focus.length) ||
    (currentSession?.back_focus && currentSession.back_focus.length) ||
    currentSession?.client_notes ||
    currentSession?.pressure ||
    intakeWaivedLocal
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
    journey: true,
    brief: true,
    medical: medicalFlagsFired.length > 0,
    last_session: false,
    patterns: true, // Phase 24e: open by default - the body map heatmap is the moat
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

  // HK May 31 2026 round 5: SOAP-without-intake regression fix.
  //
  // Earlier today the auto-create-session on panel mount was removed
  // to stop a refresh storm (was firing a sessions INSERT every time
  // the therapist opened a booking, triggering realtime, triggering
  // fetchBookings, blocking the UI). The intent was for the notes
  // editor to create the session on first save. But RecordEditor.save()
  // only UPDATEs an existing session.id; it never creates one. So
  // when there's no intake, currentSession stays null forever and the
  // SOAP card just shows "Loading session..." with no recovery.
  //
  // Fix: create the session row when the Record section is OPENED,
  // not on panel mount. Tracked per-booking-id via a ref so we don't
  // double-fire. Only fires on intentional section toggle, which means
  // it happens once per therapist intent (open SOAP to write notes),
  // not once per panel open. Refresh storm avoided AND SOAP is
  // actually usable without intake.
  const recordSessionEnsuredRef = useRef(new Set());
  useEffect(() => {
    if (!openSections.record) return;
    if (!appt?.id || appt.preview) return;
    if (currentSession?.id) return;
    if (recordSessionEnsuredRef.current.has(appt.id)) return;
    recordSessionEnsuredRef.current.add(appt.id);

    let alive = true;
    (async () => {
      // Double-check no session was created in the meantime (panel
      // opened twice, race between toggleSection and effect).
      const { data: existing } = await supabase
        .from('sessions')
        .select('*')
        .eq('booking_id', appt.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (existing) { setCurrentSession(existing); return; }

      const { data: created, error } = await supabase
        .from('sessions')
        .insert({
          booking_id: appt.id,
          client_id: appt.clientId || null,
          therapist_id: therapist.id,
          completed: false,
        })
        .select('*')
        .single();
      if (!alive) return;
      if (error) {
        console.error('[SOAP open] session create failed', error);
        // Allow retry on next open.
        recordSessionEnsuredRef.current.delete(appt.id);
        return;
      }
      setCurrentSession(created);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSections.record, appt?.id]);

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

  // Phase 1 (HK May 31 2026): open checkout at the root level. We capture
  // a snapshot of the data needed at this exact moment so the modal flow
  // is decoupled from anything that re-renders in this panel afterwards.
  const openCheckout = () => {
    if (typeof onRequestCheckout !== 'function') return;
    onRequestCheckout({
      appt: displayAppt,
      client: clientRow,
      defaultAmountCents,
    });
  };

  async function saveEndTime() {
    setSavingTime(true);
    const updates = {};
    if (newStartTime) updates.start_time = newStartTime;
    if (newEndTime) updates.end_time = newEndTime;
    if (Object.keys(updates).length) {
      // Capture prev values BEFORE the update so we can pass them
      // to the reschedule confirmation email (C10).
      const prevDate = appt.date instanceof Date
        ? appt.date.toISOString().slice(0, 10)
        : (appt.start_date || null);
      const prevTime = appt.start_time_raw || null;
      await supabase.from('bookings').update(updates).eq('id', appt.id);

      // HK May 26 2026: notify-booking-event with event_type='reschedule'
      // fires the C10 reschedule confirmation email to the client.
      // Only fires when start_time actually changed (saveEndTime can
      // also fire from just end_time changes which are not a real
      // reschedule). Non-blocking.
      if (newStartTime && newStartTime !== prevTime) {
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
            body: JSON.stringify({
              booking_id: appt.id,
              event_type: 'reschedule',
              reschedule_prev: { prev_date: prevDate, prev_time: prevTime },
            }),
          }).catch(() => { /* non-blocking */ });
        } catch (_) { /* non-blocking */ }
      }
    }
    setSavingTime(false);
    setEditTime(false);
    if (Object.keys(updates).length) {
      notify('Saved');
    }
    onCancelled?.();
  }

  // HK May 27 2026: lazy-load the service / location / addon catalogs
  // the first time the therapist taps the service edit pencil. Avoids
  // unnecessary fetches on every DetailPanel open (the catalogs are
  // only needed if the therapist actually wants to edit). Same query
  // shape as BookingModal so we get a consistent view of "what is
  // bookable right now."
  async function loadServiceCatalog() {
    if (serviceCatalogLoaded) return;
    try {
      const [{ data: svcs }, { data: locs }, { data: addons }] = await Promise.all([
        supabase.from('services')
          .select('id, name, duration, price, is_couples, location_ids')
          .eq('therapist_id', therapist.id)
          .eq('active', true)
          .is('archived_at', null)
          .order('sort_order', { ascending: true }),
        supabase.from('therapist_locations')
          .select('id, name')
          .eq('therapist_id', therapist.id)
          .eq('active', true)
          .order('sort_order', { ascending: true }),
        supabase.from('service_addons')
          .select('id, name, price, extra_minutes, applicable_service_ids')
          .eq('therapist_id', therapist.id)
          .eq('active', true)
          .order('display_order'),
      ]);
      setServiceCatalog(svcs || []);
      setLocationCatalog(locs || []);
      setAddonCatalog(addons || []);
      setServiceCatalogLoaded(true);
    } catch (err) {
      console.error('loadServiceCatalog error:', err);
      setServiceEditError('Could not load services. Try again.');
    }
  }

  // Toggle the service editor. On open, ensure the catalog is loaded
  // and seed the form fields from the current booking. On close,
  // discard any unsaved edits.
  async function toggleServiceEditor() {
    const opening = !editService;
    if (opening) {
      await loadServiceCatalog();
      setNewServiceId(appt.service_id || null);
      setNewDuration(appt.duration || 60);
      setNewLocationId(appt.location_id || null);
      setNewAddonIds(appt.addon_ids || []);
      setNewPartnerName(appt.partner_name || '');
      setNewPartnerEmail(appt.partner_email || '');
      setServiceEditError(null);
    }
    setEditService(opening);
  }

  // HK May 27 2026: save the edited service / duration / location /
  // addons / partner to the bookings row. Steps:
  //   1. Option C payment guard: if there is paid money on this
  //      booking, BLOCK service+duration changes. Show the refund
  //      banner instead. Addons + location + partner still editable
  //      since those usually do not change the price recorded as paid.
  //   2. Compute new end_time from new duration (start_time stays).
  //   3. Conflict detection: query other bookings on same date that
  //      overlap [start, new_end) excluding self. If any, block save
  //      and show specific conflict.
  //   4. Update bookings row with all changed fields.
  //   5. Write booking_history row with before/after JSONB.
  //   6. Fire notify-booking-event reschedule notice if duration
  //      changed.
  //   7. Refresh parent on success.
  async function saveServiceEdit() {
    setSavingService(true);
    setServiceEditError(null);

    const isPaid = (appt.paid_cents || 0) > 0;
    const serviceChanged = newServiceId !== (appt.service_id || null);
    const durationChanged = newDuration !== (appt.duration || 60);

    // Payment guard (Option C)
    if (isPaid && (serviceChanged || durationChanged)) {
      setServiceEditError(
        `This session has $${((appt.paid_cents || 0) / 100).toFixed(2)} already paid. Refund the payment before changing the service or duration. You can change location, add-ons, or partner info without refunding.`
      );
      setSavingService(false);
      return;
    }

    // Couples partner validation
    const newService = serviceCatalog.find(s => s.id === newServiceId);
    const isCouples = !!(newService?.is_couples);
    if (isCouples && !newPartnerName.trim()) {
      setServiceEditError('Couples service: partner name is required.');
      setSavingService(false);
      return;
    }

    // Compute new end_time from new duration. Booking start_time is
    // canonical; we just shift the end. addon_extra_minutes is folded
    // into the duration the therapist sees (newDuration already
    // reflects what the picker shows), so end_time math is direct.
    const startTimeStr = appt.startTime || (appt.time ? null : null);
    if (!startTimeStr) {
      setServiceEditError('Could not read this booking\'s start time. Refresh and try again.');
      setSavingService(false);
      return;
    }
    const [sh, sm] = startTimeStr.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = startMin + newDuration;
    const newEndH = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
    const newEndM = String(endMin % 60).padStart(2, '0');
    const newEndStr = `${newEndH}:${newEndM}:00`;

    // Conflict detection: query bookings on the same date that
    // overlap the proposed time window. Excludes self and cancelled.
    if (durationChanged) {
      const { data: dayBookings, error: conflictErr } = await supabase
        .from('bookings')
        .select('id, start_time, end_time, client_name')
        .eq('therapist_id', therapist.id)
        .eq('booking_date', appt.booking_date)
        .neq('status', 'cancelled')
        .neq('id', appt.id);
      if (conflictErr) {
        setServiceEditError('Could not check for conflicts. Try again.');
        setSavingService(false);
        return;
      }
      const newStartFull = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`;
      const conflict = (dayBookings || []).find(b => {
        // overlap: not (this.end <= other.start OR this.start >= other.end)
        return !(newEndStr <= b.start_time || newStartFull >= b.end_time);
      });
      if (conflict) {
        const t12 = (timeStr) => {
          const [h, m] = timeStr.split(':').map(Number);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 === 0 ? 12 : h % 12;
          return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
        };
        setServiceEditError(
          `This duration would overlap with ${conflict.client_name || 'another booking'} at ${t12(conflict.start_time.slice(0, 5))}. Pick a shorter duration or reschedule that booking first.`
        );
        setSavingService(false);
        return;
      }
    }

    // Recompute addon totals from selected addon ids
    const selectedAddons = (addonCatalog || []).filter(a => (newAddonIds || []).includes(a.id));
    const addonTotalPrice = selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
    const addonExtraMinutes = selectedAddons.reduce((sum, a) => sum + Number(a.extra_minutes || 0), 0);

    // Capture before snapshot for audit
    const beforeSnapshot = {
      service_id: appt.service_id,
      service_name: appt.service,
      duration: appt.duration,
      location_id: appt.location_id,
      location_name: appt.locationName,
      addon_ids: appt.addon_ids,
      partner_name: appt.partner_name,
      partner_email: appt.partner_email,
      end_time: appt.endTime,
    };
    const afterSnapshot = {
      service_id: newServiceId,
      service_name: newService?.name || null,
      duration: newDuration,
      location_id: newLocationId,
      location_name: (locationCatalog.find(l => l.id === newLocationId) || {}).name || null,
      addon_ids: newAddonIds,
      partner_name: isCouples ? newPartnerName.trim() : null,
      partner_email: isCouples ? newPartnerEmail.trim() : null,
      end_time: `${newEndH}:${newEndM}`,
    };

    // Determine change_type for the audit row
    const changes = [];
    if (serviceChanged) changes.push('service');
    if (durationChanged) changes.push('duration');
    if (newLocationId !== (appt.location_id || null)) changes.push('location');
    if (JSON.stringify(newAddonIds.sort()) !== JSON.stringify((appt.addon_ids || []).slice().sort())) changes.push('addons');
    if (newPartnerName.trim() !== (appt.partner_name || '') || newPartnerEmail.trim() !== (appt.partner_email || '')) changes.push('partner');
    if (changes.length === 0) {
      setServiceEditError('No changes to save.');
      setSavingService(false);
      return;
    }
    const changeType = changes.length === 1 ? changes[0] : 'multiple';

    // Build updates payload
    const updates = {
      service_id: newServiceId,
      location_id: newLocationId,
      addon_ids: newAddonIds,
      addon_total_price: addonTotalPrice,
      addon_extra_minutes: addonExtraMinutes,
      end_time: newEndStr,
      partner_name: isCouples ? newPartnerName.trim() : null,
      partner_email: isCouples ? newPartnerEmail.trim() : null,
    };

    // HK May 27 2026 Phase Pkg-C: if the new service has an active
    // package_purchase that covers it for this client, link the
    // booking to that package explicitly. This makes the linkage
    // durable (not inferred) so future surfaces (Stripe receipts,
    // client portal, audit log) can show "session 3 of pack X" with
    // confidence. If serviceChanged and activePackage already exists
    // and matches the new service, just keep the linkage. If the
    // service changed to one not covered, clear the FK.
    if (serviceChanged) {
      if (activePackage && activePackage.id) {
        // activePackage detection runs on appt.service_id changes
        // (above useEffect). For an edit that switches services, we
        // need to re-check whether the NEW service is in the
        // package's applicable_service_ids. Cheapest: re-query.
        try {
          const { data: pkg } = await supabase
            .from('package_purchases')
            .select('id, package:packages(applicable_service_ids)')
            .eq('id', activePackage.id)
            .maybeSingle();
          const apply = pkg?.package?.applicable_service_ids;
          const covered = !apply
            || (Array.isArray(apply) && apply.length === 0)
            || (Array.isArray(apply) && apply.includes(newServiceId));
          updates.package_purchase_id = covered ? activePackage.id : null;
        } catch (_) {
          // Non-blocking; leave FK as-is on error.
        }
      } else if (appt.package_purchase_id) {
        // Service changed to one not covered by any active package.
        // Clear the existing FK so we don't leave a stale link.
        updates.package_purchase_id = null;
      }
    }

    const { error: updateErr } = await supabase.from('bookings').update(updates).eq('id', appt.id);
    if (updateErr) {
      console.error('saveServiceEdit update error:', updateErr);
      setServiceEditError('Could not save the change. Try again.');
      setSavingService(false);
      return;
    }

    // Audit row. Non-blocking: if this fails the booking is still
    // updated correctly; the missing audit row is a known degradation
    // but not a user-facing failure.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('booking_history').insert({
        booking_id: appt.id,
        therapist_id: therapist.id,
        change_type: changeType,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
        changed_by_user_id: user?.id || null,
      });
    } catch (auditErr) {
      console.warn('booking_history insert failed:', auditErr);
    }

    // HK May 31 2026: notification fan-out for booking edits.
    //   Duration change → reschedule (existing C10 template). The
    //     client's end time shifts, calendar entry changes.
    //   Service / location / partner / addon change → booking_updated.
    //     Same date and time, but other details changed. Both client
    //     and therapist get notified (therapist gets a receipt that
    //     the client was told). Non-blocking on both paths.
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (durationChanged) {
      try {
        fetch(`${supabaseUrl}/functions/v1/notify-booking-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({
            booking_id: appt.id,
            event_type: 'reschedule',
            reschedule_prev: { prev_date: appt.booking_date, prev_time: startTimeStr },
          }),
        }).catch(() => {});
      } catch (_) {}
    } else if (changes.length > 0) {
      // Service / location / partner / addon only. Time didn't shift.
      try {
        fetch(`${supabaseUrl}/functions/v1/notify-booking-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({
            booking_id: appt.id,
            event_type: 'booking_updated',
            changes,
          }),
        }).catch(() => {});
      } catch (_) {}
    }

    setSavingService(false);
    setEditService(false);
    notify('Saved');
    onCancelled?.();
  }

  // HK May 27 2026 Phase Pkg-C manual flow: link this booking to a
  // specific package. Used for past/existing bookings where the
  // automated link did not fire. The therapist picks which package
  // (radio button in the manage-link panel) and confirms.
  // Side effects:
  //   - Sets bookings.package_purchase_id
  //   - Writes a package_redemptions row (audit)
  //   - Decrements package_purchases.sessions_remaining (so the
  //     counter matches reality)
  //   - If a session_payments row already exists for this booking
  //     with amount_cents > 0 and a non-package method, we DO NOT
  //     touch it. The therapist might still want to refund + redeem
  //     separately; that is a separate workflow. We just record the
  //     audit link here.
  async function linkBookingToPackage(packagePurchaseId, sessionNumberOverride = null) {
    if (!packagePurchaseId || !appt?.id) return;
    // HK May 31 2026: defensive reset of busy flag in case a previous
    // attempt left it stuck true (would make the button silently
    // disabled and look like "click does nothing").
    setPackageLinkBusy(true);
    setServiceEditError(null);
    try {
      // HK May 31 2026: if the booking is ALREADY linked to this
      // package, don't re-run the redemption (would over-decrement
      // sessions_remaining and add a duplicate redemption row). Just
      // refresh state so the panel matches reality.
      if (appt.package_purchase_id === packagePurchaseId) {
        setShowPackageLinkPanel(false);
        notify('This booking is already linked to that package');
        // Optimistic local update so panel re-renders even if parent
        // refetch is slow.
        setDisplayAppt(prev => ({ ...prev, package_purchase_id: packagePurchaseId }));
        onCancelled?.();
        return;
      }

      // Re-read the package to get current sessions_remaining
      const { data: pkg, error: pkgErr } = await supabase
        .from('package_purchases')
        .select('id, sessions_remaining, status')
        .eq('id', packagePurchaseId)
        .maybeSingle();
      if (pkgErr) throw new Error(pkgErr.message);
      if (!pkg) throw new Error('Package not found.');

      // Update booking FK
      const { error: bkErr } = await supabase
        .from('bookings')
        .update({ package_purchase_id: packagePurchaseId })
        .eq('id', appt.id);
      if (bkErr) throw new Error(bkErr.message);

      // Audit: redemption row. HK May 31 2026: session_number_override
      // lets the therapist explicitly say "this is session 3 of 5",
      // not chronological order. Useful when linking an older booking
      // that they know fits in the middle of the package.
      await supabase.from('package_redemptions').insert({
        package_purchase_id: packagePurchaseId,
        booking_id: appt.id,
        session_number_override: sessionNumberOverride || null,
        notes: sessionNumberOverride
          ? `Linked as session ${sessionNumberOverride} by therapist on ${new Date().toISOString().split('T')[0]}.`
          : `Linked retroactively by therapist on ${new Date().toISOString().split('T')[0]}.`,
      });

      // Decrement remaining counter (floor at 0)
      const newRemaining = Math.max(0, (pkg.sessions_remaining || 0) - 1);
      const pkgUpdate = { sessions_remaining: newRemaining };
      if (newRemaining === 0 && pkg.status === 'active') pkgUpdate.status = 'exhausted';
      await supabase.from('package_purchases').update(pkgUpdate).eq('id', packagePurchaseId);

      // Audit booking_history (non-blocking)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('booking_history').insert({
          booking_id: appt.id,
          therapist_id: therapist.id,
          change_type: 'package_link',
          before_snapshot: { package_purchase_id: appt.package_purchase_id || null },
          after_snapshot: { package_purchase_id: packagePurchaseId, session_number: sessionNumberOverride },
          changed_by_user_id: user?.id || null,
        });
      } catch (auditErr) {
        console.warn('booking_history insert failed:', auditErr);
      }

      setDisplayAppt(prev => ({ ...prev, package_purchase_id: packagePurchaseId }));
      setShowPackageLinkPanel(false);
      notify('Package linked');
      onCancelled?.();
    } catch (err) {
      console.error('linkBookingToPackage failed:', err);
      // Reuse the serviceEditError surface for now since both errors
      // are in the same DetailPanel region.
      setServiceEditError(err.message || 'Could not link package. Try again.');
    } finally {
      setPackageLinkBusy(false);
    }
  }

  // Unlink this booking from its current package. Restores the
  // sessions_remaining counter and removes the redemption row(s).
  // Used when the therapist realizes the auto-link was wrong, or
  // wants to charge separately instead.
  async function unlinkBookingFromPackage() {
    if (!appt?.package_purchase_id || !appt?.id) return;
    const oldPkgId = appt.package_purchase_id;
    setPackageLinkBusy(true);
    try {
      // Remove the booking FK first
      const { error: bkErr } = await supabase
        .from('bookings')
        .update({ package_purchase_id: null })
        .eq('id', appt.id);
      if (bkErr) throw new Error(bkErr.message);

      // Remove any redemption rows for this booking + package
      await supabase
        .from('package_redemptions')
        .delete()
        .eq('booking_id', appt.id)
        .eq('package_purchase_id', oldPkgId);

      // Restore the package counter (capped at sessions_purchased)
      const { data: pkg } = await supabase
        .from('package_purchases')
        .select('sessions_purchased, sessions_remaining, status')
        .eq('id', oldPkgId)
        .maybeSingle();
      if (pkg) {
        const restored = Math.min(pkg.sessions_purchased || 0, (pkg.sessions_remaining || 0) + 1);
        const pkgUpdate = { sessions_remaining: restored };
        // If the package was 'exhausted' purely because of this
        // session, flip it back to active.
        if (pkg.status === 'exhausted' && restored > 0) pkgUpdate.status = 'active';
        await supabase.from('package_purchases').update(pkgUpdate).eq('id', oldPkgId);
      }

      // Audit booking_history (non-blocking)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('booking_history').insert({
          booking_id: appt.id,
          therapist_id: therapist.id,
          change_type: 'package_unlink',
          before_snapshot: { package_purchase_id: oldPkgId },
          after_snapshot: { package_purchase_id: null },
          changed_by_user_id: user?.id || null,
        });
      } catch (auditErr) {
        console.warn('booking_history insert failed:', auditErr);
      }

      setShowPackageLinkPanel(false);
      notify('Package unlinked');
      onCancelled?.();
    } catch (err) {
      console.error('unlinkBookingFromPackage failed:', err);
      setServiceEditError(err.message || 'Could not unlink package. Try again.');
    } finally {
      setPackageLinkBusy(false);
    }
  }

  async function cancelAppointment() {
    setCancelling(true);

    // HK May 29 2026: build the list of booking ids to cancel. By
    // default it's just this booking. If the booking belongs to a
    // series AND the therapist checked "Also cancel all future in
    // series", expand to every booking in the series with a date
    // >= today (don't retroactively cancel past sessions).
    let idsToCancel = [appt.id];
    if (cancelAllInSeries && appt.seriesId) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data: future } = await supabase
        .from('bookings')
        .select('id')
        .eq('series_id', appt.seriesId)
        .gte('booking_date', todayIso)
        .neq('status', 'cancelled');
      if (future && future.length) idsToCancel = future.map(r => r.id);
    }

    await supabase.from('bookings')
      .update({ status: 'cancelled' })
      .in('id', idsToCancel);

    // Notify per booking. Non-blocking, paced so we don't bury Resend.
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      for (const id of idsToCancel) {
        fetch(`${supabaseUrl}/functions/v1/notify-booking-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({ booking_id: id, event_type: 'booking_cancelled', initiated_by: 'therapist' }),
        }).catch(() => { /* non-blocking */ });
        if (idsToCancel.length > 1) await new Promise(r => setTimeout(r, 220));
      }
    } catch (_notifyErr) { /* non-blocking */ }

    notify(
      idsToCancel.length > 1
        ? `Cancelled ${idsToCancel.length} sessions in series`
        : 'Appointment cancelled'
    );

    setCancelling(false);
    onCancelled?.();
    // HK May 31 2026: don't close the panel after cancel. User stays
    // on the booking and sees the cancelled state in-place. Only X
    // button + backdrop tap close the panel.
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
  // HK May 28 2026: No-show becomes available once the START time has
  // passed, not the end time. A no-show is knowable the moment the
  // client fails to arrive at the start, so gating on end time (the old
  // behaviour) hid the button for the entire session length. We gate
  // no-show on start, while other "past" logic still uses end.
  const apptStartMs = apptDayMs != null ? apptDayMs + t2m(appt.time) * 60 * 1000 : null;
  const startHasPassed = apptStartMs != null && apptStartMs < Date.now();
  const canMarkNoShow = startHasPassed
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
      {/* HK May 30 2026: backdrop no longer closes on tap. Previously
          any tap outside the panel content (including miss-taps on
          small buttons INSIDE the panel area) dismissed it, sending
          the user back to the schedule. With small tap targets in the
          panel, miss-taps were common and dismissal felt random. Now:
          backdrop dims the page (visual hint) but does not consume
          taps. Explicit X button in the panel header is the only
          close affordance, which is what the 70yo persona expects.
          The backdrop still has pointer-events: none so taps drop to
          the schedule below outside the panel (they will hit the
          underlying card and could reselect, but the panel stays
          open because it's a controlled state update).

          HK May 30 2026 update: backdrop click RESTORED with a guard.
          User explicitly said: "I should be still able to click on the
          left 10% screen to go back to schedule page." So the left
          strip must be a close affordance. Buttons are now 44px+ tap
          targets so the original dismissal-on-miss-tap is no longer a
          practical issue. Guard: only close if the tap target is the
          backdrop itself (e.target === e.currentTarget), so nested
          event bubbling from the panel doesn't trigger this. */}
      {/* HK May 31 2026: when mode='page', this DetailPanel is rendered
          as a full-page route (see BookingDetailPage). Skip the backdrop
          and the slide-over chrome so the same internals work in both
          contexts. */}
      {mode === 'slide' && (
        <div
          onPointerUp={onClose}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300,backdropFilter:'blur(2px)',cursor:'pointer'}}
        />
      )}
      {/* HK May 25 2026 (Phase 24c): definitive scroll fix.
          The previous fix put paddingBottom on the OUTER scroll
          container. WebKit has a long-standing bug where padding
          on a scroll container doesn't reserve scrollable space at
          the bottom (content can scroll past the padding). Real
          fix: NO padding on the outer container, paddingBottom on
          the inner content area where last action sits. */}
      {/* HK May 25 2026 (Phase 24d): responsive width.
          Mobile (<=720px): 100vw (full screen, what mobile already did).
          Tablet/desktop: min(560px, 48vw) - meaningful width on
          desktop, no longer the embarrassing 20% strip.
          overscroll-behavior:contain stops scroll chaining so when
          the user hits top/bottom of the panel, the main page doesn't
          scroll behind it. */}
      <div style={mode === 'page' ? {
        // HK May 31 2026 round 2 (Side panel A): page mode now fills the
        // Dashboard's card width fully. The earlier 720 cap left a sea
        // of empty space on desktop and made the page look unfinished.
        // No outer background or border because Dashboard already wraps
        // us in a white card; doubling up looked like a modal-in-modal.
        // overflow:visible lets the page scroll naturally with body
        // scroll, since the DetailPanel internals are tall.
        width: '100%',
        background: 'transparent',
        overflow: 'visible',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      } : {
        position:'fixed',
        top:0, right:0, bottom:0,
        // HK May 30 2026: width keeps the left strip exposed
        // intentionally. HK said: 'I should be still able to click
        // on the left 10% screen to go back to schedule page.' So
        // the slide-over does NOT cover the full mobile viewport;
        // the visible strip on the left is meant to be a close
        // affordance. This means we MUST also restore the backdrop
        // click-to-close so taps in the strip dismiss the panel.
        // See backdrop block above for the matching change.
        width: 'min(560px, max(360px, 40vw))',
        maxWidth:'100vw',
        background:'#fff',
        zIndex:301,
        overflowY:'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',
        paddingTop:'env(safe-area-inset-top, 0px)',
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
          {/* HK May 31 2026 round 6: clean header redesign (Mockup A).
              Replaces the cluttered original where avatar + name + View
              profile + Close fought on one row (forcing name truncation
              like "Joy Tes..."), date + time + edit pencils + Open as
              full page + No Intake pill all stacked below in mismatched
              fonts.

              New hierarchy:
                Row 1: avatar + name + small dismiss X icon (no "Close"
                       text). Full width = no truncation.
                Row 2: subtle "New client · View profile" subline.
                Card:  "Thursday, June 18" is the anchor. Time + service
                       below it, edit pencils tucked inline. Status pill
                       (No Intake / Signed / etc) right-aligned at top
                       of card balancing the date. "Open full page" link
                       at bottom right corner, quiet. */}
          <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:10}}>
            {displayAppt.clientId ? (
              <a
                href={`/dashboard/clients/${displayAppt.clientId}`}
                style={{display:'flex',alignItems:'center',gap:12,flex:1,minWidth:0,textDecoration:'none',color:'inherit'}}
                title="Open client profile"
              >
                <div style={{width:44,height:44,borderRadius:'50%',background:ac(displayAppt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,flexShrink:0}}>{initials(displayAppt.client)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:18,fontWeight:700,color:SO.ink,fontFamily:'Georgia,serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.2}}>
                    {displayAppt.client}
                  </div>
                  {displayAppt.is_couples && displayAppt.partner_name && (
                    <div style={{fontSize:12,color:SO.sage,fontWeight:600,marginTop:2}}>💑 with {displayAppt.partner_name}</div>
                  )}
                  <div style={{fontSize:12,color:SO.inkMute,marginTop:3,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <span>{appt.sessions>0?`${appt.sessions} sessions`:appt.preview?'Preview client':'New client'}</span>
                    <span style={{color:'#D1D5DB'}}>·</span>
                    <span style={{color:SO.forest,fontWeight:600}}>View profile ›</span>
                  </div>
                </div>
              </a>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:12,flex:1,minWidth:0}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:ac(displayAppt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,flexShrink:0}}>{initials(displayAppt.client)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:18,fontWeight:700,color:SO.ink,fontFamily:'Georgia,serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.2}}>{displayAppt.client}</div>
                  {displayAppt.is_couples && displayAppt.partner_name && (
                    <div style={{fontSize:12,color:SO.sage,fontWeight:600,marginTop:2}}>💑 with {displayAppt.partner_name}</div>
                  )}
                  <div style={{fontSize:12,color:SO.inkMute,marginTop:3}}>{appt.sessions>0?`${appt.sessions} sessions`:appt.preview?'Preview client':'New client'}</div>
                </div>
              </div>
            )}
            {mode === 'slide' && (
              <button
                onClick={onClose}
                aria-label="Close"
                title="Close"
                style={{
                  background:'transparent',
                  border:'1px solid #E5E7EB',
                  borderRadius:'50%',
                  width:36,
                  height:36,
                  fontSize:16,
                  color:'#6B7280',
                  cursor:'pointer',
                  fontFamily:'inherit',
                  flexShrink:0,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  lineHeight:1,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Date + time + service card. The visual anchor. Date is the
              biggest type; time and service nest below. Status pill on
              the right top corner. Open-as-full-page link bottom right. */}
          <div style={{background:'#F9FAFB',borderRadius:12,padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:10}}>
              <div style={{flex:1,minWidth:0}}>
                {appt.date && (
                  <div style={{fontSize:14,fontWeight:700,color:SO.ink,letterSpacing:'0.01em',lineHeight:1.3}}>
                    {appt.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                )}
              </div>
              <div style={{flexShrink:0}}>
                <div style={{background:st.bg,color:st.color,borderRadius:20,padding:'5px 11px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>{st.icon} {st.label}</div>
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
              <div style={{fontSize:16,fontWeight:700,color:'#1F2937'}}>{appt.time} · {appt.duration} min</div>
              {!appt.preview && (
                <button onClick={()=>setEditTime(v=>!v)}
                  title={editTime ? 'Cancel time edit' : 'Edit time'}
                  aria-label={editTime ? 'Cancel time edit' : 'Edit time'}
                  style={{
                    background:'transparent',
                    border:'1px solid #D1D5DB',
                    borderRadius:8,
                    padding:'4px 8px',
                    fontSize:12,
                    lineHeight:1,
                    color:'#6B7280',
                    cursor:'pointer',
                    fontFamily:'inherit',
                    flexShrink:0,
                  }}>
                  {editTime ? '✕' : '✏️'}
                </button>
              )}
            </div>

            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <div style={{fontSize:13,color:'#6B7280'}}>{appt.service||'Session'}</div>
              {!appt.preview && (
                <button onClick={toggleServiceEditor}
                  title={editService ? 'Cancel service edit' : 'Edit service, duration, location, add-ons'}
                  aria-label={editService ? 'Cancel service edit' : 'Edit service'}
                  style={{
                    background:'transparent',
                    border:'1px solid #D1D5DB',
                    borderRadius:8,
                    padding:'4px 8px',
                    fontSize:11,
                    lineHeight:1,
                    color:'#6B7280',
                    cursor:'pointer',
                    fontFamily:'inherit',
                    flexShrink:0,
                  }}>
                  {editService ? '✕' : '✏️'}
                </button>
              )}
            </div>

            {mode === 'slide' && !appt.preview && (
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
                <a
                  href={`/dashboard/schedule/booking/${appt.id}`}
                  title="Open this booking as a full page"
                  style={{
                    fontSize:11, fontWeight:600, color:SO.forest,
                    textDecoration:'underline', whiteSpace:'nowrap',
                  }}
                >
                  Open full page ↗
                </a>
              </div>
            )}
          </div>

          {/* HK May 31 2026: trace banner. When a booking has been marked
              no-show / cancelled / refunded / rescheduled, the status pill
              alone (small, in the corner of the header) was easy to miss.
              This banner makes the trace state unmistakable so therapists
              don't wonder "did my no-show actually save?". Strong color,
              clear copy, never hides. Only shows for trace states; normal
              statuses (paid, intake-done, complete, pending-intake) skip it. */}
          {(() => {
            const traceStates = {
              no_show:     { bg:'#FEF3C7', border:'#FCD34D', color:'#92400E', icon:'⚠', label:'Marked as no-show' },
              cancelled:   { bg:'#FEE2E2', border:'#FCA5A5', color:'#B91C1C', icon:'✕', label:'This booking was cancelled' },
              refunded:    { bg:'#EDE9FE', border:'#C4B5FD', color:'#6D28D9', icon:'↩', label:'Payment was refunded' },
              rescheduled: { bg:'#E0F2FE', border:'#7DD3FC', color:'#0369A1', icon:'↻', label:'This booking was rescheduled' },
            };
            const tr = traceStates[displayAppt.status];
            if (!tr) return null;
            return (
              <div style={{
                margin: '10px 0 6px',
                padding: '12px 14px',
                background: tr.bg,
                border: `1.5px solid ${tr.border}`,
                borderRadius: 10,
                color: tr.color,
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>{tr.icon}</span>
                <span>{tr.label}</span>
              </div>
            );
          })()}

          {/* HK May 29 2026: Quick-send actions at the TOP of the booking
              detail panel. One pair of channel-explicit buttons per
              action: 📧 Email and 💬 SMS. Therapist picks per send.
              Buttons hide channels the client lacks (no email = no
              email button, etc).
              - Send Intake: visible if status is 'pending-intake'.
              - Send Agreement: visible if client has not yet signed
                (practice_agreement_signed_at is null on clientRow). */}
          {/* HK May 29 2026 (revised): compact single-row quick actions
              at the top of the booking detail panel. Each action lives
              on one line: icon + label on the left, two small Email/SMS
              pills on the right. Replaces the bulky stacked layout HK
              flagged as 'massive use of space and unprofessional'.
              Also: when agreement is already signed we show a sage
              'Signed (date)' indicator instead of hiding the row, so
              the therapist always sees the state. */}
          {!appt.preview && clientRow && (() => {
            const showIntakeSend = appt.status === 'pending-intake';
            const agreementSigned = !!clientRow.practice_agreement_signed_at;
            // If intake is done AND agreement is signed, nothing actionable
            // here. Skip the whole section.
            if (!showIntakeSend && agreementSigned) return null;

            const clientEmail = appt.email || clientRow?.email || '';
            const clientPhone = appt.client_phone || appt.phone || clientRow?.phone || '';
            const hasEmail = !!clientEmail;
            const hasPhone = !!clientPhone;
            const intakeBody = `Hi ${firstName}! Please fill your intake form before your session: ${intakeLink}`;
            const intakeMailtoSubject = encodeURIComponent('Your intake form');
            const intakeMailtoBody = encodeURIComponent(intakeBody);
            const intakeSmsBody = encodeURIComponent(intakeBody);

            const pill = (label, icon, href, onClick, disabled) => {
              const sharedStyle = {
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', borderRadius: 999,
                background: disabled ? '#F4F4F4' : '#fff',
                border: `1px solid ${disabled ? '#E5E7EB' : '#C8D5BC'}`,
                color: disabled ? '#9CA3AF' : '#2A5741',
                fontSize: 12, fontWeight: 600,
                textDecoration: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              };
              if (href && !disabled) {
                return <a key={label} href={href} style={sharedStyle}><span style={{ fontSize: 11 }}>{icon}</span>{label}</a>;
              }
              return (
                <button key={label} type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={sharedStyle}>
                  <span style={{ fontSize: 11 }}>{icon}</span>{label}
                </button>
              );
            };

            const rowStyle = {
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, padding: '8px 0', flexWrap: 'wrap',
            };
            const labelStyle = {
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 13, fontWeight: 600, color: '#1F4030',
              flexShrink: 0,
            };
            const pillRow = {
              display: 'flex', gap: 6, flexShrink: 0,
            };

            const signedDate = agreementSigned
              ? new Date(clientRow.practice_agreement_signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '';

            return (
              <div style={{
                marginTop: 10,
                padding: '4px 12px',
                background: '#FAFAF7',
                border: '1px solid #EAE5DA',
                borderRadius: 10,
              }}>
                {showIntakeSend && (
                  <div style={{ ...rowStyle, borderBottom: !agreementSigned ? '1px solid #EFEAE0' : 'none' }}>
                    <div style={labelStyle}>
                      <span>📝</span>
                      <span>Send intake</span>
                    </div>
                    {!hasEmail && !hasPhone ? (
                      <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>No contact on file</span>
                    ) : (
                      <div style={pillRow}>
                        {pill('Email', '📧', null, hasEmail ? () => sendIntake('email') : null, !hasEmail || !!sendingIntake)}
                        {pill('SMS', '💬', null, hasPhone ? () => sendIntake('sms') : null, !hasPhone || !!sendingIntake)}
                      </div>
                    )}
                  </div>
                )}
                {agreementSigned ? (
                  <div style={rowStyle}>
                    <div style={labelStyle}>
                      <span>✍️</span>
                      <span>Agreement</span>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: '#2A5741',
                      background: '#EEF3EE', padding: '4px 10px', borderRadius: 999,
                      border: '1px solid #C8D5BC',
                    }}>
                      ✓ Signed {signedDate}
                    </span>
                  </div>
                ) : (
                  <div style={rowStyle}>
                    <div style={labelStyle}>
                      <span>✍️</span>
                      <span>Send agreement</span>
                    </div>
                    {!hasEmail && !hasPhone ? (
                      <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>No contact on file</span>
                    ) : (
                      <div style={pillRow}>
                        {pill(
                          sendingAgreement === 'email' ? 'Sending…' : 'Email',
                          '📧',
                          null,
                          () => sendAgreement('email'),
                          !hasEmail || sendingAgreement === 'email'
                        )}
                        {pill(
                          sendingAgreement === 'sms' ? 'Sending…' : 'SMS',
                          '💬',
                          null,
                          () => sendAgreement('sms'),
                          !hasPhone || sendingAgreement === 'sms'
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* HK May 29 2026: series pill on bookings that belong to a
              recurring set. Sits above the package badge if both apply.
              Shows the position in the series and the rule label when
              available. Helps the therapist know "this is the 3rd of 6
              I set up for Sandra" at a glance. */}
          {!appt.preview && appt.seriesId && appt.seriesIndex && appt.seriesTotal && (
            <div style={{
              marginTop: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#F4F6F2',
              border: '1.5px solid #D6E0D4',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>↻</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1F4030', lineHeight: 1.3 }}>
                    Session {appt.seriesIndex} of {appt.seriesTotal} in a series
                  </div>
                  <div style={{ fontSize: 11, color: '#4B6353', marginTop: 2, lineHeight: 1.4 }}>
                    Cancel offers to cancel all future in the series.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HK May 27 2026 Phase Pkg-C: prominent package badge.
              70yo persona = big text, sage palette, plain English.
              Jacquie's concern: "This was session 3 or 4 in a
              package, not a new $300 package, and the same with
              Sandy's." Solution: surface the package linkage
              loudly on the booking so the therapist can see at a
              glance "this is part of an existing pack, not a new
              charge." */}
          {!appt.preview && activePackage && (
            <div style={{
              marginTop: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: '#EEF3EE',
              border: '1.5px solid #9DBEA1',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1.2 }}>📦</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#1F4030',
                    lineHeight: 1.3,
                    marginBottom: 2,
                  }}>
                    Session {activePackage.this_session_number || '?'} of {activePackage.sessions_purchased} in <span style={{fontStyle:'italic'}}>{activePackage.name}</span>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: '#2A5741',
                    lineHeight: 1.5,
                  }}>
                    {activePackage.sessions_purchased - activePackage.used_count} session{activePackage.sessions_purchased - activePackage.used_count === 1 ? '' : 's'} left in this package. This session draws from that balance, not a new charge.
                    {!activePackage.linked && (
                      <span style={{
                        display: 'block',
                        marginTop: 4,
                        fontSize: 11,
                        color: '#6B7280',
                        fontStyle: 'italic',
                      }}>
                        Suggested match. Tap Manage to confirm or change.
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowPackageLinkPanel(v => !v)}
                    style={{
                      marginTop: 10,
                      background: '#fff',
                      border: '1.5px solid #2A5741',
                      color: '#2A5741',
                      borderRadius: 10,
                      padding: '11px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      minHeight: 44,
                    }}
                  >
                    {showPackageLinkPanel ? 'Hide options' : 'Manage package link'}
                  </button>
                </div>
              </div>

              {/* Manage-link panel. HK May 27 2026 round 5: 'let the
                  therapist decide for existing bookings.' Therapist
                  sees all candidate packages (radio list), can pick
                  one to link, or pick None to unlink. Future bookings
                  are still auto-linked by the service editor; this
                  panel only matters when the auto-link missed or got
                  it wrong. */}
              {showPackageLinkPanel && (
                <div style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px dashed #9DBEA1',
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#1F4030',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                  }}>
                    Which package is this session part of?
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {availablePackages.map(p => {
                      const isCurrent = activePackage?.id === p.id && p.linked;
                      const remaining = p.sessions_purchased - p.used_count;
                      const canPick = !isCurrent && !packageLinkBusy && (p.eligible || p.linked);
                      const sessionNumVal = sessionNumberDraft[p.id] || '';
                      const parsedNum = parseInt(sessionNumVal, 10);
                      const numValid = !sessionNumVal || (parsedNum >= 1 && parsedNum <= p.sessions_purchased);
                      return (
                        <div key={p.id} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          padding: '10px 12px',
                          background: isCurrent ? '#2A5741' : '#fff',
                          border: `1.5px solid ${isCurrent ? '#2A5741' : '#9DBEA1'}`,
                          borderRadius: 10,
                          opacity: (!p.eligible && !p.linked) ? 0.5 : 1,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: 16, lineHeight: 1.2, color: isCurrent ? '#fff' : '#1F4030' }}>
                              {isCurrent ? '✓' : '○'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: isCurrent ? '#fff' : '#1F4030',
                                marginBottom: 2,
                              }}>
                                {p.name}
                              </div>
                              <div style={{
                                fontSize: 11,
                                color: isCurrent ? '#D6E0D4' : '#2A5741',
                                lineHeight: 1.4,
                              }}>
                                {remaining} of {p.sessions_purchased} left
                                {p.status === 'exhausted' ? ' · fully used' : ''}
                                {!p.eligible && !p.linked ? ' · service not covered' : ''}
                                {p.purchased_at ? ` · purchased ${new Date(p.purchased_at).toLocaleDateString()}` : ''}
                              </div>
                            </div>
                          </div>
                          {/* HK May 31 2026: inline session-number override.
                              Shown only for non-current, eligible rows. Empty
                              = let auto-compute by chronological order. */}
                          {canPick && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 26 }}>
                              <span style={{ fontSize: 11, color: '#2A5741', fontWeight: 600 }}>This is session</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={p.sessions_purchased}
                                value={sessionNumVal}
                                onChange={(e) => setSessionNumberDraft(prev => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder="auto"
                                style={{
                                  width: 48,
                                  padding: '4px 6px',
                                  border: `1px solid ${numValid ? '#9DBEA1' : '#DC2626'}`,
                                  borderRadius: 6,
                                  fontSize: 12,
                                  textAlign: 'center',
                                  fontFamily: 'inherit',
                                }}
                              />
                              <span style={{ fontSize: 11, color: '#2A5741' }}>of {p.sessions_purchased}</span>
                              <button
                                type="button"
                                disabled={!canPick || !numValid}
                                onClick={() => linkBookingToPackage(p.id, parsedNum || null)}
                                style={{
                                  marginLeft: 'auto',
                                  background: '#2A5741',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '9px 16px',
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: canPick && numValid ? 'pointer' : 'not-allowed',
                                  opacity: canPick && numValid ? 1 : 0.5,
                                  fontFamily: 'inherit',
                                  minHeight: 36,
                                }}
                              >
                                {packageLinkBusy ? '...' : 'Link'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {activePackage?.linked && (
                      <button
                        type="button"
                        disabled={packageLinkBusy}
                        onClick={unlinkBookingFromPackage}
                        style={{
                          marginTop: 4,
                          padding: '9px 12px',
                          background: '#fff',
                          border: '1.5px solid #B0746B',
                          color: '#7A3A2E',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: packageLinkBusy ? 'wait' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {packageLinkBusy ? 'Working...' : 'Unlink this session from the package'}
                      </button>
                    )}
                  </div>
                  {serviceEditError && (
                    <div style={{
                      marginTop: 10,
                      padding: '8px 10px',
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      color: '#991B1B',
                      borderRadius: 8,
                      fontSize: 11.5,
                    }}>
                      {serviceEditError}
                    </div>
                  )}
                  <div style={{
                    marginTop: 10,
                    fontSize: 10.5,
                    color: '#6B7280',
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                  }}>
                    New bookings link to the right package automatically. Use this when an older session needs to be matched up by hand.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Client has active packages but none auto-match this booking
              (different service, before purchase date, etc). Surface a
              quiet affordance so the therapist can still link by hand
              if they want to. */}
          {!appt.preview && !activePackage && availablePackages.length > 0 && (
            <div style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#FAF7F1',
              border: '1px dashed #C8B89A',
            }}>
              <div style={{
                fontSize: 12,
                color: '#7A6232',
                lineHeight: 1.5,
                marginBottom: 6,
              }}>
                <strong>{displayAppt.client?.split(' ')[0] || 'This client'}</strong> has {availablePackages.length} package{availablePackages.length === 1 ? '' : 's'} on file, but none match this booking automatically.
              </div>
              <button
                onClick={() => setShowPackageLinkPanel(v => !v)}
                style={{
                  background: '#fff',
                  border: '1.5px solid #7A6232',
                  color: '#7A6232',
                  borderRadius: 10,
                  padding: '11px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minHeight: 44,
                }}
              >
                {showPackageLinkPanel ? 'Hide options' : 'Link to a package'}
              </button>
              {showPackageLinkPanel && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {availablePackages.map(p => {
                    const remaining = p.sessions_purchased - p.used_count;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={packageLinkBusy}
                        onClick={() => linkBookingToPackage(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '10px 12px',
                          background: '#fff',
                          border: '1.5px solid #C8B89A',
                          borderRadius: 10,
                          cursor: packageLinkBusy ? 'wait' : 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          width: '100%',
                        }}>
                        <span style={{ fontSize: 16 }}>○</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#7A6232', marginBottom: 2 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#7A6232', lineHeight: 1.4 }}>
                            {remaining} of {p.sessions_purchased} left
                            {p.status === 'exhausted' ? ' · fully used' : ''}
                            {p.purchased_at ? ` · purchased ${new Date(p.purchased_at).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {serviceEditError && (
                    <div style={{
                      marginTop: 4,
                      padding: '8px 10px',
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      color: '#991B1B',
                      borderRadius: 8,
                      fontSize: 11.5,
                    }}>
                      {serviceEditError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


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

          {editService && !appt.preview && (() => {
            const isPaid = (appt.paid_cents || 0) > 0;
            const selectedService = serviceCatalog.find(s => s.id === newServiceId);
            const isCouplesService = !!(selectedService?.is_couples);
            const applicableAddons = (addonCatalog || []).filter(a => {
              const apply = a.applicable_service_ids;
              if (!apply || (Array.isArray(apply) && apply.length === 0)) return true;
              if (Array.isArray(apply)) return apply.includes(newServiceId);
              return true;
            });
            // Duration options: the selected service's default + a few
            // common neighbors (30, 60, 75, 90, 120). Therapist can also
            // pick the original duration on this booking even if it
            // doesn't match the new service's default.
            const baseDurations = [30, 45, 60, 75, 90, 120];
            const durationOptions = Array.from(new Set([
              selectedService?.duration || 60,
              appt.duration || 60,
              ...baseDurations,
            ])).sort((a, b) => a - b);

            return (
              <div style={{background:'#FFF7ED',border:'1.5px solid #FED7AA',borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontSize:12,fontWeight:700,color:'#9A3412',marginBottom:10}}>Edit service</div>

                {isPaid && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 12,
                    marginBottom: 12,
                    lineHeight: 1.5,
                  }}>
                    💚 <strong>${((appt.paid_cents || 0) / 100).toFixed(2)} already paid.</strong> Service and duration cannot be changed on a paid booking. Refund the payment first, then re-edit. Location, add-ons, and partner info can still be changed.
                  </div>
                )}

                {/* Service picker */}
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#6B7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Service</label>
                  <select
                    value={newServiceId || ''}
                    onChange={e => {
                      const val = e.target.value || null;
                      setNewServiceId(val);
                      const svc = serviceCatalog.find(s => s.id === val);
                      if (svc?.duration) setNewDuration(svc.duration);
                    }}
                    disabled={isPaid}
                    style={{
                      width:'100%',
                      padding:'9px 10px',
                      border:'1.5px solid #D1D5DB',
                      borderRadius:8,
                      fontSize:14,
                      outline:'none',
                      boxSizing:'border-box',
                      background: isPaid ? '#F3F4F6' : '#fff',
                      color: isPaid ? '#9CA3AF' : '#1F2937',
                      fontFamily:'inherit',
                    }}>
                    {serviceCatalog.length === 0 && <option>Loading...</option>}
                    {serviceCatalog.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.is_couples ? ' (couples)' : ''} · {s.duration}min · ${Number(s.price).toFixed(0)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration picker */}
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#6B7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Duration</label>
                  <select
                    value={newDuration}
                    onChange={e => setNewDuration(Number(e.target.value))}
                    disabled={isPaid}
                    style={{
                      width:'100%',
                      padding:'9px 10px',
                      border:'1.5px solid #D1D5DB',
                      borderRadius:8,
                      fontSize:14,
                      outline:'none',
                      boxSizing:'border-box',
                      background: isPaid ? '#F3F4F6' : '#fff',
                      color: isPaid ? '#9CA3AF' : '#1F2937',
                      fontFamily:'inherit',
                    }}>
                    {durationOptions.map(d => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>

                {/* Location picker (only if multi-location) */}
                {locationCatalog.length > 1 && (
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:11,fontWeight:700,color:'#6B7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Location</label>
                    <select
                      value={newLocationId || ''}
                      onChange={e => setNewLocationId(e.target.value || null)}
                      style={{
                        width:'100%',
                        padding:'9px 10px',
                        border:'1.5px solid #D1D5DB',
                        borderRadius:8,
                        fontSize:14,
                        outline:'none',
                        boxSizing:'border-box',
                        background:'#fff',
                        color:'#1F2937',
                        fontFamily:'inherit',
                      }}>
                      <option value="">None</option>
                      {locationCatalog.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Addons */}
                {applicableAddons.length > 0 && (
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:11,fontWeight:700,color:'#6B7280',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Add-ons</label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {applicableAddons.map(a => {
                        const isSel = (newAddonIds || []).includes(a.id);
                        return (
                          <button key={a.id} type="button"
                            onClick={() => {
                              setNewAddonIds(prev => isSel
                                ? prev.filter(x => x !== a.id)
                                : [...(prev || []), a.id]
                              );
                            }}
                            style={{
                              background: isSel ? '#9A3412' : '#fff',
                              color: isSel ? '#fff' : '#9A3412',
                              border: `1.5px solid ${isSel ? '#9A3412' : '#FED7AA'}`,
                              borderRadius: 999,
                              padding: '5px 11px',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}>
                            {a.name}{Number(a.price) > 0 ? ` +$${Number(a.price).toFixed(0)}` : ''}{Number(a.extra_minutes) > 0 ? ` +${a.extra_minutes}m` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Partner info if couples */}
                {isCouplesService && (
                  <div style={{marginBottom:12,padding:'10px 12px',background:'#fff',border:'1px dashed #FED7AA',borderRadius:8}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#9A3412',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>💑 Partner details</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8}}>
                      <input
                        type="text"
                        placeholder="Partner name"
                        value={newPartnerName}
                        onChange={e => setNewPartnerName(e.target.value)}
                        style={{width:'100%',padding:'8px 10px',border:'1.5px solid #D1D5DB',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                      />
                      <input
                        type="email"
                        placeholder="Partner email (optional)"
                        value={newPartnerEmail}
                        onChange={e => setNewPartnerEmail(e.target.value)}
                        style={{width:'100%',padding:'8px 10px',border:'1.5px solid #D1D5DB',borderRadius:8,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
                      />
                    </div>
                  </div>
                )}

                {serviceEditError && (
                  <div style={{
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    marginBottom: 12,
                    lineHeight: 1.5,
                  }}>
                    {serviceEditError}
                  </div>
                )}

                <button onClick={saveServiceEdit} disabled={savingService}
                  style={{width:'100%',padding:'10px 0',background:'#9A3412',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:savingService?'wait':'pointer',opacity:savingService?0.6:1,fontFamily:'inherit'}}>
                  {savingService ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            );
          })()}

          {/* Phase 24d: Session journey moved into the cockpit section
              list below, as its own collapsible. HK feedback: should be
              consistent with Today's Brief / Medical Flags / Last
              Session pattern. */}
        </div>
        <div style={{
          padding: 20,
          paddingBottom: isMobileW
            ? 'calc(74px + env(safe-area-inset-bottom, 0px) + 32px)'
            : 'calc(env(safe-area-inset-bottom, 0px) + 60px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
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

          {/* HK May 25 2026 (Phase 24c): cockpit panels are NO LONGER
              gated on currentSession. Previously: when intake wasn't
              filled, the whole cockpit was invisible and the user
              saw a blank slide-over. Now: panels render and handle
              their own empty/locked states. Brief shows the
              EmptyStateCard with intake link. Medical, Last Session,
              Patterns only render if they have data. Record + Recap
              lock until session date passes (or override). */}
          {!appt.preview && (
            <>
              {/* HK May 25 2026 (Phase 24e): Collapse all / Expand all
                  toggle. When all panels are open the slide-over is
                  long; this gives a fast bird's-eye view of headers
                  only, then the therapist taps to drill into any one. */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 2,
              }}>
                <button
                  type="button"
                  onClick={() => {
                    const anyOpen = Object.values(openSections).some(v => v === true);
                    const allKeys = ['journey', 'brief', 'medical', 'last_session', 'patterns', 'record', 'recap', 'payment'];
                    const next = {};
                    for (const k of allKeys) next[k] = !anyOpen;
                    setOpenSections(next);
                  }}
                  style={{
                    background: 'transparent',
                    color: SO.inkMute,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: '4px 8px',
                    borderRadius: 6,
                    letterSpacing: '0.02em',
                  }}
                  title="Collapse or expand all sections"
                >
                  {Object.values(openSections).some(v => v === true) ? '↑ Collapse all' : '↓ Expand all'}
                </button>
              </div>

              {/* ─── Session Journey panel (4-dot timeline) ─── */}
              <CockpitSection
                sectionKey="journey"
                icon="🧭"
                title="Session journey"
                subtitle={
                  currentSession?.completed ? "Session complete"
                    : intakeDone ? (intakeWaivedLocal ? "Intake waived, ready for session" : "Intake filled, ready for session")
                    : "Awaiting client intake"
                }
                isOpen={openSections.journey !== false}
                onToggle={() => toggleSection('journey')}
              >
                {!currentSession && (
                  <div style={{
                    fontSize: 12,
                    color: SO.inkMute,
                    lineHeight: 1.5,
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: SO.cream,
                    border: `1px dashed #D6CDB8`,
                    borderRadius: 8,
                  }}>
                    Journey will activate once your client fills their intake. Prior session history is still available below.
                  </div>
                )}
                <DocumentJourney
                  session={currentSession}
                  intakeWaivedAt={intakeWaivedLocal}
                  aiEnabled={therapist?.ai_enabled !== false}
                  onSelect={(dotNum) => {
                    const sectionKey = dotNum === 1 ? 'brief' : dotNum === 2 ? 'brief' : dotNum === 3 ? 'record' : 'recap';
                    setOpenSections(prev => ({ ...prev, [sectionKey]: true }));
                    setTimeout(() => {
                      const el = document.querySelector(`[data-cockpit-section="${sectionKey}"]`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 80);
                  }}
                  onSoapClick={() => {
                    setOpenSections(prev => ({ ...prev, record: true }));
                    setTimeout(() => {
                      const el = document.querySelector('[data-cockpit-section="record"]');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 80);
                  }}
                />
                {/* HK May 25 2026 (Phase 24f): per-doc print/send
                    shortcuts. Each of the 4 documents has its own
                    direct link to the SessionDetail page with the
                    DocumentDrawer pre-opened for that doc. From the
                    drawer the therapist can email, SMS (doc 4),
                    save PDF, copy image, share image. These are
                    one-tap shortcuts so they don't have to navigate
                    to SessionDetail and click a dot. */}
                {currentSession && displayAppt.clientId && (
                  <div style={{ marginTop: 14 }}>
                    <Label>Print, share, or send</Label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { n: 1, label: '📋 Intake' },
                        { n: 2, label: '🌿 Brief' },
                        { n: 3, label: '✍️ Record' },
                        { n: 4, label: '💌 Recap' },
                      ].map(d => (
                        <button
                          type="button"
                          key={d.n}
                          onClick={() => setDrawerDoc(d.n)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#fff',
                            color: SO.forest,
                            border: '1.5px solid #D6E0D4',
                            borderRadius: 999,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                          title={`Open ${d.label} with print, email, SMS, PDF options`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: SO.inkMute, marginTop: 8, lineHeight: 1.5 }}>
                      Tap any doc to open print, email, SMS, PDF, and image options right here.
                    </div>
                  </div>
                )}
              </CockpitSection>

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
                  <>
                    <EmptyStateCard
                      icon="📋"
                      body="Your client hasn't filled out their intake yet. Send them the link from below, or fill it out yourself at the start of the session."
                    />
                    {/* HK May 25 2026 (Phase 24e): therapist override.
                        When the client is sitting in front of them and
                        hasn't filled out the intake online, the
                        therapist can open the form themselves and fill
                        in zones/pressure/notes on the client's behalf.
                        Opens the existing public intake URL prefilled
                        with the booking's client + email + booking_id,
                        so when saved the brief auto-populates here. */}
                    <a
                      href={intakeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 10,
                        background: SO.forest,
                        color: '#fff',
                        textDecoration: 'none',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                      }}
                    >
                      ✍️ Fill intake on behalf of {appt.client?.split(' ')[0] || 'client'}
                    </a>

                    {/* HK May 25 2026: waiver option. Therapist can
                        decide to proceed without an intake for this
                        session (client walked in, declined to fill,
                        or has been a regular long enough to skip).
                        Persists to bookings.intake_waived_at so the
                        brief + journey dots stop showing 'intake
                        missing' for this booking. Single click, soft
                        confirm via the immediate state change.

                        ALSO creates a placeholder sessions row tied
                        to this booking so SOAP + Recap editors have
                        a row to save against. Without this, the
                        editors mount but their save() functions bail
                        on missing session.id, and HK reported that
                        the post-waiver reveal felt feeble: nothing
                        actually became editable. Creating the
                        session row at waiver-time is what makes the
                        cockpit truly come alive. */}
                    <div style={{ marginTop: 10 }}>
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: SO.inkMute,
                      }}>
                        <input
                          type="checkbox"
                          checked={intakeWaivedLocal}
                          onChange={async () => {
                            // HK May 25 2026 round 8: waiver only flips
                            // the booking's intake_waived_at flag. The
                            // session row is auto-created by the mount
                            // useEffect, so this onChange never touches
                            // the sessions table. One source of truth,
                            // no duplicate row risk.
                            setIntakeWaivedLocal(true);
                            const { error: bkErr } = await supabase
                              .from('bookings')
                              .update({ intake_waived_at: new Date().toISOString() })
                              .eq('id', appt.id);
                            if (bkErr) {
                              setIntakeWaivedLocal(false);
                              console.error('[intake-waive] booking update failed:');
                              console.error('  code:', bkErr.code);
                              console.error('  message:', bkErr.message);
                            } else {
                              notify('Intake skipped for this session');
                            }
                          }}
                          style={{ cursor: 'pointer', accentColor: SO.forest }}
                        />
                        Or skip intake for this session
                      </label>
                    </div>
                  </>
                )}
                {intakeWaivedLocal && !(
                  (currentSession?.front_focus && currentSession.front_focus.length) ||
                  (currentSession?.back_focus && currentSession.back_focus.length) ||
                  currentSession?.client_notes ||
                  currentSession?.pressure
                ) && (
                  <>
                    <style>{`
                      @keyframes bmWaiverReveal {
                        0%   { opacity: 0; transform: translateY(-6px) scale(0.98); }
                        60%  { opacity: 1; transform: translateY(0) scale(1.01); }
                        100% { opacity: 1; transform: translateY(0) scale(1); }
                      }
                      @keyframes bmReadyPulse {
                        0%, 100% { box-shadow: 0 0 0 0 rgba(42,87,65,0.0); }
                        50%      { box-shadow: 0 0 0 6px rgba(42,87,65,0.08); }
                      }
                      .bm-waiver-reveal {
                        animation: bmWaiverReveal 0.45s ease-out, bmReadyPulse 2.2s ease-in-out 0.35s 2;
                      }
                    `}</style>
                    <div className="bm-waiver-reveal" style={{
                      background: 'linear-gradient(135deg, #F0F7F4 0%, #E8F4EC 100%)',
                      border: '1.5px solid #BFD8C9',
                      borderRadius: 12,
                      padding: '14px 16px',
                      marginTop: 6,
                    }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: '#2A5741',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        marginBottom: 6,
                      }}>
                        🌿 Ready for session
                      </div>
                      <div style={{
                        fontSize: 13, color: '#1F2937', lineHeight: 1.55,
                        marginBottom: 10,
                      }}>
                        Intake waived. SOAP fields, private notes, and the client recap below are all editable now.
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setIntakeWaivedLocal(false);
                          await supabase
                            .from('bookings')
                            .update({ intake_waived_at: null })
                            .eq('id', appt.id);
                          notify('Intake required again');
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: SO.inkMute,
                          fontWeight: 600,
                          fontSize: 11,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                          fontFamily: 'inherit',
                        }}
                      >
                        Undo waiver
                      </button>
                    </div>
                  </>
                )}
                {intakeDone && currentSession && (
                  <>
                    {/* Focus zones */}
                    {((currentSession.front_focus || []).length > 0 || (currentSession.back_focus || []).length > 0) && (
                      <div style={{marginBottom:14}}>
                        <Label>Focus areas</Label>
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
                        <Label>Avoid</Label>
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
                        <Label>Pressure</Label>
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
                        <Label>Goal</Label>
                        <div style={{fontSize:13, color:'#374151', flex:1, lineHeight:1.5}}>{goalLabel(currentSession.goal)}</div>
                      </div>
                    )}

                    {/* Preferences (compact line) */}
                    {(currentSession.room_temp || currentSession.music || currentSession.conversation || currentSession.draping) && (
                      <div style={{marginBottom:14}}>
                        <Label>Preferences</Label>
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
                        <Label>Notes from client</Label>
                        <div style={{fontSize:13, color:'#374151', lineHeight:1.6, fontStyle:'italic', background:'#FAFAFA', padding:'10px 12px', borderRadius:8, border:'1px solid #F3F4F6'}}>
                          "{currentSession.client_notes}"
                        </div>
                      </div>
                    )}

                    {/* Body map (collapsible inside the panel) */}
                    <BodyMapPreview session={currentSession} />

                    {/* HK May 25 2026 (round 4): distinction between
                        summary panel and full doc. The cockpit
                        sections are summarized views; the full
                        document opens in the inline drawer. */}
                    <button
                      type="button"
                      onClick={() => setDrawerDoc(2)}
                      style={{
                        marginTop: 14,
                        background: 'transparent',
                        border: '1px dashed #D6E0D4',
                        borderRadius: 10,
                        padding: '9px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: SO.forest,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        width: '100%',
                        textAlign: 'center',
                      }}
                    >
                      View full Pre-Session Brief →
                    </button>
                  </>
                )}
              </CockpitSection>

              {/* ─── Record panel (SOAP entry inline) ─── */}
              {/* HK May 25 2026 round 7: SOAP is always accessible. No
                  intake gate, no future-session gate. The session row
                  is auto-created by the mount useEffect above. Empty
                  state only shows during the brief loading window. */}
              <CockpitSection
                sectionKey="record"
                icon="✍️"
                title="Session record · SOAP"
                subtitle={
                  hasSoapContent
                    ? 'Notes saved · tap to edit'
                    : '🎙️ Capture what happened, dictate or type'
                }
                isOpen={openSections.record}
                onToggle={() => toggleSection('record')}
              >
                {currentSession ? (
                  <>
                    <RecordEditor
                      session={currentSession}
                      parsedSoap={parsedSoap}
                      therapist={therapist}
                      allSessions={allSessions}
                      onSaved={() => refreshCockpit()}
                    />
                    <button
                      type="button"
                      onClick={() => setDrawerDoc(3)}
                      style={{
                        marginTop: 14,
                        background: 'transparent',
                        border: '1px dashed #D6E0D4',
                        borderRadius: 10,
                        padding: '9px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: SO.forest,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        width: '100%',
                        textAlign: 'center',
                      }}
                    >
                      View full Session Record →
                    </button>
                  </>
                ) : (
                  <div style={{
                    padding: '20px 16px',
                    background: '#FAFAF7',
                    border: '1px dashed #D6E0D4',
                    borderRadius: 10,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>
                      No notes yet. Start a session record to begin writing.
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
                      Setting up the record. This usually takes a second.
                    </div>
                  </div>
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
                    <>
                      <RecapEditor
                        session={currentSession}
                        parsedSoap={parsedSoap}
                        therapist={therapist}
                        allSessions={allSessions}
                        onSaved={() => refreshCockpit()}
                        onRebook={() => { onClose(); onReschedule && onReschedule({ ...appt, isRebook: true }); }}
                      />
                      <button
                        type="button"
                        onClick={() => setDrawerDoc(4)}
                        style={{
                          marginTop: 14,
                          background: 'transparent',
                          border: '1px dashed #D6E0D4',
                          borderRadius: 10,
                          padding: '9px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          color: SO.forest,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          width: '100%',
                          textAlign: 'center',
                        }}
                      >
                        View full Client Recap →
                      </button>
                    </>
                  )}
                </CockpitSection>
              )}

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
                  <LastSessionContent session={lastSession} allSessions={allSessions} />
                </CockpitSection>
              )}

              {/* ─── Body Map Patterns panel (2+ sessions) ─── */}
              {/* HK May 25 2026 (Phase 24e): lowered threshold from 3
                  to 2 sessions and renamed to 'Body Map Patterns' so
                  the visual moat surfaces as soon as there's any
                  history to overlay. Open by default for returning
                  clients so the heatmap is immediately visible. */}
              {allSessions.length >= 2 && (
                <CockpitSection
                  sectionKey="patterns"
                  icon="📊"
                  title="Body Map Patterns"
                  subtitle={`${allSessions.length} sessions overlaid`}
                  isOpen={openSections.patterns !== false}
                  onToggle={() => toggleSection('patterns')}
                >
                  <PatternsContent allSessions={allSessions} />
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
            {/* HK May 29 2026: bottom Send Intake + Copy link blocks
                removed. The top quick-actions row already handles
                intake delivery via Email + SMS buttons; the standalone
                Copy link button below was redundant and noise. */}
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
                      <button onClick={openCheckout}
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
                    <button onClick={openCheckout}
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
              <div style={{marginTop:4,paddingTop:14,borderTop:`1px solid ${SO.border}`}}>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => onReschedule(appt)}
                    style={{...btnSecondary, flex:1, display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <span>📅</span> Reschedule
                  </button>
                  {canMarkNoShow && (
                    <button onClick={() => openCancelFlow({ isNoShow: true })}
                      style={{...btnSecondary, flex:1, color:SO.warn, borderColor:SO.warnBorder, display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      <span>🚫</span> No-show
                    </button>
                  )}
                </div>
                {/* HK May 25 2026 (Phase 24c): Cancel demoted to a
                    quiet text link below the action buttons. The
                    previous tiny ✕ Cancel button competed for visual
                    weight with Reschedule and reads as a 'small bad
                    option.' Cancelation is destructive, but it's
                    also infrequent: a confident link with a clear
                    destructive color is the right affordance, not a
                    button that whispers. */}
                <div style={{marginTop:12,textAlign:'center'}}>
                  <button onClick={() => openCancelFlow()}
                    style={{
                      background:'transparent',
                      color:'#B91C1C',
                      border:'none',
                      borderRadius:6,
                      padding:'8px 12px',
                      fontSize:13,
                      fontWeight:600,
                      cursor:'pointer',
                      fontFamily:'inherit',
                      textDecoration:'underline',
                      textUnderlineOffset:'3px',
                      textDecorationColor:'#FCA5A5',
                      textDecorationThickness:'1.5px',
                    }}>
                    Cancel this appointment
                  </button>
                </div>
              </div>
            )}
            {!appt.preview && confirmCancel && (
              <div style={{background:'#FEF2F2',border:'1.5px solid #FECACA',borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#991B1B',marginBottom:10}}>Cancel this appointment?</div>
                <div style={{fontSize:12,color:'#DC2626',marginBottom:14,lineHeight:1.5}}>
                  {appt.client} · {appt.time} on {appt.date?.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                </div>
                {appt.seriesId && appt.seriesTotal > 1 && (
                  <label style={{
                    display:'flex',alignItems:'flex-start',gap:8,
                    background:'#fff',border:'1.5px solid #FECACA',borderRadius:8,
                    padding:'10px 12px',marginBottom:12,cursor:'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={cancelAllInSeries}
                      onChange={e => setCancelAllInSeries(e.target.checked)}
                      style={{marginTop:2,cursor:'pointer'}}
                    />
                    <span style={{fontSize:12,color:'#7F1D1D',lineHeight:1.5}}>
                      Also cancel all future sessions in this series (this is session {appt.seriesIndex} of {appt.seriesTotal}).
                    </span>
                  </label>
                )}
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => { setConfirmCancel(false); setCancelAllInSeries(false); }}
                    style={{flex:1,padding:'9px 0',borderRadius:8,border:'1.5px solid #D1D5DB',background:'#fff',color:'#6B7280',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                    Keep it
                  </button>
                  <button onClick={cancelAppointment} disabled={cancelling}
                    style={{flex:1,padding:'9px 0',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',opacity:cancelling?0.6:1}}>
                    {cancelling ? 'Cancelling…' : (cancelAllInSeries ? 'Cancel series' : 'Yes, cancel')}
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
            notify(chargeContext?.isNoShow ? 'Marked as no-show' : 'Appointment cancelled');
            onCancelled?.();
            // HK May 31 2026: don't close the panel: stay in-place.
          }}
        />
      )}
      {/* Phase 1 (HK May 31 2026): CheckoutModal removed from DetailPanel.
          Now rendered at ScheduleDashboard root via onRequestCheckout.
          The Charge buttons above call openCheckout() which dispatches
          to the parent. CheckoutModal survives any re-render of this
          panel because it lives outside it. */}
      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          therapist={therapist}
          onClose={() => setRefundTarget(null)}
          onRefunded={(amountCents) => {
            // HK May 29 2026: soft-confirm toast + force a parent
            // refresh so the timeline picks up the refunded state and
            // the trace pill appears immediately.
            const amount = typeof amountCents === 'number' ? ` $${(amountCents / 100).toFixed(2)}` : '';
            notify(`Refunded${amount}`);
            refreshPayments();
            // Trigger parent refresh so timeline pill updates
            if (typeof onCancelled === 'function') onCancelled();
          }}
        />
      )}
      {/* HK May 25 2026 Work D: inline DocumentDrawer. Tapping any of
          the 4 doc shortcut pills (Intake / Brief / Record / Recap)
          opens the same DocumentDrawer experience that the
          SessionDetail page uses, but mounted inline within the
          slide-over so the therapist never leaves Schedule. zIndex
          ordering: backdrop 998 + drawer 999 sit above slide-over
          301, so the doc surface overlays cleanly. Doc renders into
          the drawer body so all toolbar actions (Print, Email, SMS,
          Save PDF, Copy/Share image) work without any navigation. */}
      {drawerDoc != null && currentSession?.id && (() => {
        const docMeta = {
          1: { name: "Today's Intake",      url: `/brief/intake/${currentSession.id}`, Component: IntakeBrief },
          2: { name: 'Pre-Session Brief',   url: `/brief/pre/${currentSession.id}`,    Component: PreSessionBrief },
          3: { name: 'Post-Session Record', url: `/brief/post/${currentSession.id}`,   Component: PostSessionBrief },
          4: { name: 'Your Recap',          url: `/recap/${currentSession.id}`,        Component: PostSessionSummary },
        }[drawerDoc];
        if (!docMeta) return null;
        const Comp = docMeta.Component;
        const drawerClient = {
          id: displayAppt.clientId,
          name: displayAppt.client,
          email: displayAppt.client_email || clientRow?.email,
          phone: displayAppt.client_phone || clientRow?.phone,
        };
        return (
          <DocumentDrawer
            open={true}
            onClose={() => setDrawerDoc(null)}
            docNumber={drawerDoc}
            docName={docMeta.name}
            docTotalParts={4}
            fullPageUrl={`${window.location.origin}${docMeta.url}`}
            client={drawerClient}
            therapist={therapist}
          >
            <DocErrorBoundary docName={docMeta.name}>
              <React.Suspense fallback={
                <div style={{
                  padding: '40px 24px',
                  textAlign: 'center',
                  color: '#6B7F72',
                  fontSize: 13,
                }}>
                  Loading document...
                </div>
              }>
                <Comp sessionIdProp={currentSession.id} chrome="drawer" />
              </React.Suspense>
            </DocErrorBoundary>
          </DocumentDrawer>
        );
      })()}
    </>
  );
}

function TimelineView({ therapist, allAppts, dayOffset, setDayOffset, today, onReschedule, onRefresh, blockedDays = [], onCreateBlock, onScheduleAtTime, selectedBookingId = '', setSelectedBookingId, onRequestCheckout, paymentsRefreshTick = 0 }) {
  const { toast: tlToast, showToast: tlShowToast } = useToast();

  // HK May 31 2026: selected booking is DERIVED from selectedBookingId
  // (URL-backed in parent). Single source of truth. The panel only
  // closes when the user explicitly closes it via setSelectedBookingId('').
  //
  // Refresh-race resilience: during a fetchBookings refetch, allAppts
  // is briefly empty before being repopulated. Without the cache,
  // selected = APPTS.find() returns null, panel disappears, then
  // reappears next render. From the user's POV that's a flicker. We
  // cache the last-known-good appt in a ref so the panel keeps
  // rendering against it through the race. Once a fresh version is
  // available (matching id), we swap to it.
  // HK May 31 2026: stable-reference selection via useStableSelectedAppt
  // hook. Was 11 lines of duplicated find + cache + race logic per view
  // (Timeline, Weekly, Monthly), each of which churned the appt prop on
  // every fetchBookings and caused DetailPanel to glitch. The hook
  // returns a reference that only changes when the appt data actually
  // changes, so DetailPanel stays steady through refetches.
  const selected = useStableSelectedAppt(allAppts, selectedBookingId);

  const setSelected = (next) => {
    const value = typeof next === 'function' ? next(null) : next;
    if (setSelectedBookingId) setSelectedBookingId(value ? value.id : '');
  };
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

      {/* HK May 31 2026: legend extracted to LegendPill, used identically
          across Timeline/Weekly/Monthly. See LegendPill definition. */}
      <LegendPill />

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
              // HK May 29 2026: trace styling for cancelled/no-show/refund/reschedule
              const ts = traceStyles(appt);
              const ann = traceAnnotation(appt);
              return (
                <div key={appt.id} data-appt-card="1" onClick={()=>setSelected(appt)}
                  style={{position:'absolute',top:y,left:2,right:2,height:bh,
                    background:appt.preview?'#F9FAFB':st.bg,
                    border:`1.5px ${appt.preview?'dashed':'solid'} ${appt.preview?'#D1D5DB':st.dot}`,
                    borderLeft:`4px solid ${appt.preview?'#CBD5E1':st.dot}`,
                    borderRadius:10,cursor:'pointer',overflow:'hidden',
                    opacity:appt.preview?0.5:isPast?Math.min(0.6, ts.opacity):ts.opacity,
                    boxShadow:isSel?'0 4px 20px rgba(0,0,0,0.15)':appt.preview?'none':'0 2px 8px rgba(0,0,0,0.07)',
                    transform:isSel?'scale(1.01)':'none',zIndex:isSel?5:1,transition:'all 0.15s'}}>
                  <div style={{padding:'5px 10px',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                      <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:0}}>
                        <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,background:appt.preview?'#D1D5DB':ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>{initials(appt.client)}</div>
                        <span style={{fontSize:12,fontWeight:700,color:appt.preview?'#9CA3AF':'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:ts.textDecoration}}>{appt.client}</span>
                        {appt.preview&&<span style={{fontSize:9,fontWeight:700,color:'#94A3B8',background:'#F1F5F9',borderRadius:4,padding:'1px 5px',flexShrink:0}}>PREVIEW</span>}
                      </div>
                      <div style={{flexShrink:0,textAlign:'right'}}>
                        <div style={{fontSize:11,fontWeight:700,color:appt.preview?'#C4C4C4':'#1F2937',textDecoration:ts.textDecoration}}>{appt.time}</div>
                        <div style={{fontSize:10,color:'#9CA3AF'}}>{appt.duration}m</div>
                        {!appt.preview&&appt.reminder_sent&&<div style={{fontSize:9,color:'#16A34A',fontWeight:700,marginTop:1}}>📧 Sent</div>}
                      </div>
                    </div>
                    {bh>52&&<div style={{fontSize:11,color:appt.preview?'#C4C4C4':st.color,marginLeft:30}}>
                      {appt.service}
                      {appt.locationName && <span style={{ color: '#9CA3AF', fontWeight: 500 }}> · 📍 {appt.locationName}</span>}
                    </div>}
                    {/* HK May 29 2026: trace annotation under the card (cancelled/no-show/refund/reschedule). Only renders when applicable. */}
                    {bh>52 && ann && <div style={{fontSize:10,color:st.color,marginLeft:30,fontWeight:600,marginTop:1}}>{ann}</div>}
                    {bh>72&&(
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{background:appt.preview?'transparent':st.dot+'22',color:appt.preview?'#C4C4C4':st.color,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{st.icon} {appt.preview?'Preview':st.label}</div>
                        {!appt.preview&&appt.paid&&appt.status!=='refunded'&&<div style={{fontSize:10,fontWeight:700,color:'#15803D',background:'#DCFCE7',borderRadius:20,padding:'2px 8px',display:'flex',alignItems:'center',gap:3}}>✓ Paid ${(appt.paid_cents/100).toFixed(0)}</div>}
                        {!appt.preview&&!appt.paid&&appt.deposit_required&&!appt.deposit_paid&&<div style={{fontSize:9,fontWeight:700,color:'#D97706',background:'#FEF3C7',borderRadius:20,padding:'2px 8px'}}>💳 Deposit due</div>}
                        {!appt.preview&&appt.status==='intake-done'&&<div style={{fontSize:10,fontWeight:700,color:'#1E40AF',background:'#DBEAFE',borderRadius:20,padding:'2px 8px'}}>Intake received →</div>}
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

      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{onReschedule&&onReschedule(a);}} onCancelled={()=>{if(typeof onRefresh==='function')onRefresh();}} showToast={tlShowToast} onRequestCheckout={onRequestCheckout} paymentsRefreshTick={paymentsRefreshTick}/>}
      {tlToast}
    </div>
  );
}

function WeeklyView({ therapist, appointments, today, onReschedule, onRefresh, blockedDays = [], selectedBookingId = '', setSelectedBookingId, onRequestCheckout, paymentsRefreshTick = 0 }) {
  const { toast: wkToast, showToast: wkShowToast } = useToast();
  const APPTS=appointments||[];
  const weekStartsOn = therapist?.week_starts_on ?? 0;
  const [weekOffset,setWeekOffset]=useState(0);

  // HK May 31 2026: stable-reference selection. See useStableSelectedAppt
  // definition for the rationale and the DetailPanel glitch this prevents.
  const selected = useStableSelectedAppt(APPTS, selectedBookingId);
  const setSelected = (next) => {
    const value = typeof next === 'function' ? next(null) : next;
    if (setSelectedBookingId) setSelectedBookingId(value ? value.id : '');
  };

  const isMobile=window.innerWidth<640;
  // Get start of week respecting weekStartsOn. If Sunday-first, week
  // starts on Sun; if Monday-first, week starts on Mon.
  const getWeekStart=d=>{
    const x=new Date(d);
    const day=x.getDay();
    const diff=(day - weekStartsOn + 7) % 7;
    x.setDate(x.getDate() - diff);
    x.setHours(0,0,0,0);
    return x;
  };
  const weekStart=addDays(getWeekStart(today),weekOffset*7);
  const weekDays=[0,1,2,3,4,5,6].map(n=>addDays(weekStart,n));
  const DAY_NAMES = weekStartsOn === 1
    ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DAY_NAMES_FULL = weekStartsOn === 1
    ? ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
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
      {/* HK May 31 2026: legend extracted to LegendPill, used identically
          across Timeline/Weekly/Monthly. See LegendPill definition. */}
      <LegendPill />
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
                          // HK May 29 2026: cancelled/no-show/refunded/rescheduled
                          // bars stay visible but de-emphasised. Tooltip carries
                          // the trace annotation so hovering tells the story.
                          const traced = appt.status === 'cancelled' || appt.status === 'no_show' || appt.status === 'refunded' || appt.status === 'rescheduled';
                          const ann = traceAnnotation(appt);
                          const tooltip = `${appt.time} · ${appt.client} · ${st.label}${ann ? ' · ' + ann : ''}`;
                          return (
                            <div key={`a${appt.id}`}
                              title={tooltip}
                              style={{
                                position: 'absolute',
                                top: 2, bottom: 2,
                                left: `${pctLeft(sM)}%`,
                                width: `${pctWidth(sM, eM)}%`,
                                background: st.dot || '#6B9E80',
                                borderRadius: 2,
                                opacity: traced ? 0.4 : 0.85,
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
                        // HK May 29 2026: trace styling for cancelled/no-show/refunded/rescheduled
                        const ts = traceStyles(appt);
                        const ann = traceAnnotation(appt);
                        return (
                          <div key={appt.id}
                            onClick={() => !appt.preview && setSelected(appt)}
                            title={ann || ''}
                            style={{
                              position: 'absolute',
                              top, height,
                              left: 3, right: 3,
                              background: appt.preview ? '#F9FAFB' : st.bg,
                              borderLeft: `3px solid ${appt.preview ? '#D1D5DB' : st.dot}`,
                              borderRadius: 5,
                              padding: '4px 6px',
                              cursor: appt.preview ? 'default' : 'pointer',
                              opacity: appt.preview ? 0.5 : ts.opacity,
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
                              textDecoration: ts.textDecoration,
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
                              textDecoration: ts.textDecoration,
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
      {wkToast}
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{onReschedule&&onReschedule(a);}} onCancelled={()=>{if(typeof onRefresh==='function')onRefresh();}} showToast={wkShowToast} onRequestCheckout={onRequestCheckout} paymentsRefreshTick={paymentsRefreshTick}/>}
    </div>
  );
}

function MonthlyView({ therapist, appointments, today, onReschedule, onRefresh, blockedDays = [], selectedBookingId = '', setSelectedBookingId, onRequestCheckout, paymentsRefreshTick = 0 }) {
  const { toast: moToast, showToast: moShowToast } = useToast();
  const APPTS=appointments||[];
  const weekStartsOn = therapist?.week_starts_on ?? 0; // 0 = Sunday, 1 = Monday
  const [monthOffset,setMonthOffset]=useState(0);
  const [selDate,setSelDate]=useState(today);

  // HK May 31 2026: stable-reference selection. See useStableSelectedAppt
  // definition for the rationale and the DetailPanel glitch this prevents.
  const selected = useStableSelectedAppt(APPTS, selectedBookingId);
  const setSelected = (next) => {
    const value = typeof next === 'function' ? next(null) : next;
    if (setSelectedBookingId) setSelectedBookingId(value ? value.id : '');
  };

  const viewMonth=new Date(today.getFullYear(),today.getMonth()+monthOffset,1);
  const daysInMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,0).getDate();
  const firstDay=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),1).getDay();
  // Offset depends on week start: if Sunday-first, blank = firstDay;
  // if Monday-first, blank = (firstDay+6)%7
  const offset = (firstDay - weekStartsOn + 7) % 7;
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
      {/* HK May 31 2026: was always-on with "HOW TO READ" prefix and
          extra swatches that didn't appear on Timeline/Weekly. Replaced
          with LegendPill for parity across views. */}
      <LegendPill />
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

      {/* View-only context note (HK May 27 2026). This monthly grid is
          a read-only view of bookings. Tapping a day filters the list
          below to that day's appointments. To block off time, manage
          recurring rules, or block holidays, use the Manage your
          calendar panel above. */}
      <div style={{
        fontSize: 11.5,
        color: '#6B7280',
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 12,
        lineHeight: 1.5,
        fontStyle: 'italic',
      }}>
        This view shows your bookings. Tap a day to see its appointments below. To block time off or set recurring rules, use Manage your calendar above.
      </div>

      <div className="bm-monthly-grid" style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4}}>
        {(weekStartsOn === 1
          ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
          : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
        ).map(d=><div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div className="bm-monthly-grid" style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:20}}>
        {calDays.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const da=APPTS.filter(a=>sameDay(a.date,d));
          const ra=da.filter(a=>!a.preview);
          const isToday=sameDay(d,today),isSel=sameDay(d,selDate);
          const block = blockedFor(d);
          // HK May 27 2026: selection state visually softened. Tapping
          // a day on this view FILTERS appointments below (the selection
          // is functional, not destructive). The old forest-green fill
          // made it look like the therapist had managed/edited the day,
          // which confused users who expected management to happen in
          // the "Manage your calendar" panel. Now selection shows a sage
          // border + subtle tint instead, preserving the filter
          // behavior without the "I just changed something" visual.
          const cellBg = isSel ? '#EEF3EE'
            : isToday ? '#F0FDF4'
            : block.fullDay ? '#FEF3C7'
            : '#fff';
          const cellBorder = isSel ? '#2A5741'
            : isToday ? '#86EFAC'
            : block.fullDay ? '#FBBF24'
            : block.partial ? '#B5D4BE'
            : '#F3F4F6';
          const cellBorderWidth = isSel ? 2 : 1.5;
          const dateColor = isSel ? '#1F4030'
            : isToday ? '#16A34A'
            : block.fullDay ? '#92400E'
            : '#6B7280';
          return (
            <div key={i} onClick={()=>setSelDate(d)}
              style={{minHeight:48,padding:5,borderRadius:8,cursor:'pointer',background:cellBg,border:`${cellBorderWidth}px solid ${cellBorder}`,transition:'all 0.1s',position:'relative'}}>
              <div style={{fontSize:11,fontWeight:isSel?700:600,color:dateColor,marginBottom:2}}>{d.getDate()}</div>
              {block.fullDay && (
                <div style={{position:'absolute',top:3,right:3,fontSize:9,lineHeight:1}} title="Day blocked off">🌿</div>
              )}
              {ra.length>0&&<div style={{fontSize:11,fontWeight:700,color:'#1F2937'}}>{window.innerWidth<640?`${ra.length}×`:`${ra.length} appt${ra.length>1?'s':''}`}</div>}
              {ra.length===0 && block.fullDay && (
                <div style={{fontSize:10,fontWeight:600,color:'#92400E',marginTop:2}}>Off</div>
              )}
              <div style={{display:'flex',gap:2,marginTop:2}}>
                {da.filter(a=>!a.preview&&a.status==='paid').length>0&&<div style={{width:5,height:5,borderRadius:'50%',background:'#16A34A'}} title="Paid"/>}
                {da.filter(a=>!a.preview&&a.status==='intake-done').length>0&&<div style={{width:5,height:5,borderRadius:'50%',background:'#3B82F6'}} title="Intake received"/>}
                {da.filter(a=>!a.preview&&a.status==='pending-intake').length>0&&<div style={{width:5,height:5,borderRadius:'50%',background:'#F59E0B'}} title="No intake"/>}
                {block.partial && !block.fullDay && <div style={{width:5,height:5,borderRadius:'50%',background:'#6B9E80'}} title="Partial block"/>}
              </div>
            </div>
          );
        })}
      </div>
      {(() => {
        // HK Jun 1 2026 v2 (Jacquie incident, post-crash retry): interleave
        // partial blocks with appointments in the day-list. Re-do uses ONLY
        // the proven module-level t2m for booking times and a small inline
        // 24-hour parser for block times. Avoids new Date(string) parsing
        // entirely since iOS Safari is strict about non-ISO date formats
        // and returning Invalid Date triggered a downstream crash earlier
        // (a.date.getHours() on what was actually a string).
        const dateStrSel = `${selDate.getFullYear()}-${String(selDate.getMonth()+1).padStart(2,'0')}-${String(selDate.getDate()).padStart(2,'0')}`;
        const dayBlocks = (blockedDays || []).filter(b => b.date === dateStrSel && b.start_time && b.end_time);
        const realAppts = selAppts.filter(a => !a.preview);
        const t24 = (s) => {
          if (!s || typeof s !== 'string') return 0;
          const [hStr, mStr] = s.slice(0, 5).split(':');
          const h = parseInt(hStr, 10);
          const m = parseInt(mStr, 10);
          return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
        };
        const items = [
          ...realAppts.map(a => ({ kind: 'appt', sortKey: t2m(a.time), data: a })),
          ...dayBlocks.map(b => ({ kind: 'block', sortKey: t24(b.start_time), data: b })),
        ].sort((x, y) => x.sortKey - y.sortKey);
        return (
          <>
            <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>
              {fmtShort(selDate)}, {realAppts.length} appointment{realAppts.length!==1?'s':''}{dayBlocks.length > 0 ? ` · ${dayBlocks.length} time off` : ''}
            </div>
            {items.length === 0
              ? <div style={{background:'#fff',borderRadius:12,padding:24,textAlign:'center',color:'#9CA3AF',fontSize:14}}>No appointments on this day.</div>
              : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {items.map((item, idx) => {
                    if (item.kind === 'block') {
                      const b = item.data;
                      const startStr = (b.start_time || '00:00').slice(0,5);
                      const endStr   = (b.end_time   || '00:00').slice(0,5);
                      const reasonLabel = b.note || b.reason || 'Time off';
                      return (
                        <div key={`block-${b.id || idx}`}
                          style={{
                            background: 'repeating-linear-gradient(45deg,#FEF3C7,#FEF3C7 6px,#FDE68A 6px,#FDE68A 7px)',
                            border: '1.5px solid #FCD34D',
                            borderLeft: '4px solid #D97706',
                            borderRadius: 12,
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}>
                          <div style={{width:36,height:36,borderRadius:'50%',background:'#FFFBEB',color:'#92400E',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🌿</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:14,fontWeight:700,color:'#92400E'}}>{reasonLabel}</div>
                            <div style={{fontSize:12,color:'#92400E',opacity:0.85,marginTop:2}}>
                              {fmt12(startStr)} - {fmt12(endStr)} · Blocked time off
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const appt = item.data;
                    const ts = traceStyles(appt);
                    const ann = traceAnnotation(appt);
                    const st = STATUS[appt.status]||STATUS['pending-intake'];
                    return (
                      <div key={appt.id} onClick={()=>setSelected(appt)}
                        style={{background:st.bg,border:`1.5px solid ${st.dot}`,borderLeft:`4px solid ${st.dot}`,borderRadius:12,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,opacity:ts.opacity}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{initials(appt.client)}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:14,fontWeight:700,color:'#1F2937',textDecoration:ts.textDecoration}}>{appt.client}</div>
                          <div style={{fontSize:12,color:'#6B7280',textDecoration:ts.textDecoration}}>{appt.time} · {appt.duration}min · {appt.service||'Session'}</div>
                          {ann && <div style={{fontSize:11,fontWeight:600,color:st.color,marginTop:3}}>{ann}</div>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                          <div style={{fontSize:11,fontWeight:700,color:st.color}}>{st.icon} {st.label}</div>
                          {appt.deposit_required&&!appt.deposit_paid&&<div style={{fontSize:10,fontWeight:700,color:'#D97706'}}>💳 Deposit due</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </>
        );
      })()}
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{onReschedule&&onReschedule(a);}} onCancelled={()=>{if(typeof onRefresh==='function')onRefresh();}} showToast={moShowToast} onRequestCheckout={onRequestCheckout} paymentsRefreshTick={paymentsRefreshTick}/>}
      {moToast}
    </div>
  );
}

function YearlyView({ therapist, appointments, today, blockedDays = [] }) {
  const weekStartsOn = therapist?.week_starts_on ?? 0;
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
  const DAY_LETTERS = weekStartsOn === 1
    ? ['M','T','W','T','F','S','S']
    : ['S','M','T','W','T','F','S'];

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
          const offset = (firstDay - weekStartsOn + 7) % 7;
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

// ─── BlockTimeModal (HK May 29 2026) ────────────────────────────────────
// Top-level modal so the therapist can block off personal/admin time
// from the Schedule action row, without having to long-press the
// timeline. Inserts a row into blocked_days. The long-press path still
// works as before; this just gives a discoverable button.
function BlockTimeModal({ therapist, onClose, onSaved }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = React.useState(todayStr);
  const [mode, setMode] = React.useState('full');     // 'full' or 'partial'
  const [startTime, setStartTime] = React.useState('09:00');
  const [endTime, setEndTime] = React.useState('17:00');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState('');

  async function save() {
    setErr('');
    if (!date) { setErr('Pick a date.'); return; }
    if (mode === 'partial') {
      if (!startTime || !endTime) { setErr('Pick a start and end time.'); return; }
      if (endTime <= startTime) { setErr('End time must be after start time.'); return; }
    }
    setSaving(true);
    try {
      const payload = {
        therapist_id: therapist.id,
        date,
        note: note.trim() || null,
      };
      if (mode === 'partial') {
        payload.start_time = `${startTime}:00`;
        payload.end_time = `${endTime}:00`;
      }
      const { error } = await supabase.from('blocked_days').insert(payload);
      if (error) throw error;
      onSaved && onSaved(mode === 'full' ? 'Day blocked' : 'Time blocked');
    } catch (e) {
      setErr(e.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 60, padding: 16,
      }}>
      <div style={{
        background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #ECE7DC' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9A3412', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            ⏸ Block off time
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1F2937', fontFamily: 'Georgia, serif' }}>
            Reserve this slot for yourself
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 1.5 }}>
            Clients won't be able to book during this time on your public booking page.
          </div>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid #E5E7EB', borderRadius: 10,
              padding: '10px 12px', fontSize: 14, color: '#1F2937',
              fontFamily: 'inherit', marginBottom: 14,
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              onClick={() => setMode('full')}
              style={{
                flex: 1,
                background: mode === 'full' ? '#2A5741' : '#fff',
                color: mode === 'full' ? '#fff' : '#374151',
                border: `1.5px solid ${mode === 'full' ? '#2A5741' : '#E5E7EB'}`,
                borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Full day
            </button>
            <button
              onClick={() => setMode('partial')}
              style={{
                flex: 1,
                background: mode === 'partial' ? '#2A5741' : '#fff',
                color: mode === 'partial' ? '#fff' : '#374151',
                border: `1.5px solid ${mode === 'partial' ? '#2A5741' : '#E5E7EB'}`,
                borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Part of day
            </button>
          </div>

          {mode === 'partial' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Start
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    border: '1.5px solid #E5E7EB', borderRadius: 10,
                    padding: '10px 12px', fontSize: 14, color: '#1F2937',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  End
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    border: '1.5px solid #E5E7EB', borderRadius: 10,
                    padding: '10px 12px', fontSize: 14, color: '#1F2937',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Reason (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Doctor, errands, family, lunch..."
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid #E5E7EB', borderRadius: 10,
              padding: '10px 12px', fontSize: 14, color: '#1F2937',
              fontFamily: 'inherit', marginBottom: 14,
            }}
          />

          {err && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#7F1D1D',
              borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12,
            }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1, background: '#F3F4F6', color: '#4B5563', border: 'none',
                padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{
                flex: 1, background: '#2A5741', color: '#fff', border: 'none',
                padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: saving ? 0.7 : 1,
              }}>
              {saving ? 'Saving…' : 'Block this time'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleDashboard({ therapist }) {
  // HK May 27 2026 round 4: refresh AuthContext's therapist after we
  // write week_starts_on (or any other settings field) so the new
  // value flows back through props to every consumer (CalendarGrid,
  // inner components, Weekly/Monthly/Yearly views). Without this, the
  // toggles flipped local state but global therapist stayed stale =
  // calendar kept showing the old week start. Jacquie hit this 3
  // times before we found the actual cause.
  const { refreshTherapist } = useAuth();
  // HK May 29 2026: top-level toast for reschedule + any action that
  // completes outside a per-view DetailPanel. The per-view tlShowToast/
  // wkShowToast/moShowToast handle cancel/no-show; this one handles
  // the BookingModal reschedule flow at the top of the tree.
  const { toast: scheduleToast, showToast: showScheduleToast } = useToast();

  // HK May 31 2026 Option A: date lives IN the URL path
  // (/dashboard/schedule/2026-06-04). This is the durable form: iOS
  // PWA URL-scheme handler returns (sms:, tel:, mailto:) sometimes
  // strip query strings but they preserve the path. The bare
  // /dashboard/schedule still works and means "today."
  //
  // Three sources, in priority order:
  //   1. Path param :scheduleDate from /dashboard/schedule/YYYY-MM-DD
  //   2. ?d= query param (back-compat with previous URL shape)
  //   3. sessionStorage backup (catches edge cases where path AND
  //      query are both lost, e.g. some bfcache evictions)
  //
  // Path is the only thing we WRITE to going forward. The query and
  // sessionStorage are read-only fallbacks on mount; subsequent
  // updates always navigate to the canonical path form.
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams();
  const routeNavigate = useNavigate();
  const routeLocation = useLocation();
  const [today] = useState(getToday);

  const STORAGE_KEY = 'mbm-schedule-state';
  const STORAGE_TTL_MS = 2 * 60 * 60 * 1000;

  // Parse a YYYY-MM-DD string into a dayOffset relative to today.
  // Returns null if the string is invalid.
  const dateStringToOffset = (s) => {
    if (!s) return null;
    const parsed = new Date(s + 'T00:00:00');
    if (isNaN(parsed.getTime())) return null;
    const diffMs = parsed.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const offsetToDateString = (offset) => {
    const d = addDays(today, offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const initialState = (() => {
    const bookingIdFromQuery = searchParams.get('b') || '';
    // 1. Path param wins
    const fromPath = dateStringToOffset(routeParams.scheduleDate);
    const viewParam = searchParams.get('view');
    if (fromPath !== null) {
      return { dayOffset: fromPath, subView: viewParam || 'today', bookingId: bookingIdFromQuery };
    }
    // 2. Legacy ?d= query param
    const fromQuery = dateStringToOffset(searchParams.get('d'));
    if (fromQuery !== null) {
      return { dayOffset: fromQuery, subView: viewParam || 'today', bookingId: bookingIdFromQuery };
    }
    // 3. sessionStorage backup (in-tab)
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        const age = Date.now() - (stored.at || 0);
        if (age < STORAGE_TTL_MS && typeof stored.dayOffset === 'number') {
          return {
            dayOffset: stored.dayOffset,
            subView: stored.subView || 'today',
            bookingId: bookingIdFromQuery || stored.bookingId || '',
          };
        }
      }
    } catch (_) {}
    // 4. localStorage backup (survives tab close + browser restart)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        const age = Date.now() - (stored.at || 0);
        if (age < STORAGE_TTL_MS && typeof stored.dayOffset === 'number') {
          return {
            dayOffset: stored.dayOffset,
            subView: stored.subView || 'today',
            bookingId: bookingIdFromQuery || stored.bookingId || '',
          };
        }
      }
    } catch (_) {}
    return { dayOffset: 0, subView: 'today', bookingId: searchParams.get('b') || '' };
  })();

  const [subView, setSubViewRaw] = useState(initialState.subView);
  const [dayOffset, setDayOffsetRaw] = useState(initialState.dayOffset);

  // HK May 31 2026: top-level selectedBookingId state : single source
  // of truth for "which booking is open in the side panel." The actual
  // panel state in TimelineView/WeeklyView/MonthlyView is now derived
  // from this. URL-backed via ?b= param. Survives every remount.
  // Empty string = no booking selected (panel closed).
  const [selectedBookingId, setSelectedBookingIdRaw] = useState(initialState.bookingId || '');

  // Diagnostic logging (HK May 31 2026): logs every change to
  // selectedBookingId with a stack trace. If the panel closes "on
  // its own," HK can grab the console and we'll see exactly what
  // code path nulled it out.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line no-console
    console.log(`[PANEL] selectedBookingId = ${selectedBookingId || '(empty)'}`);
    if (!selectedBookingId) {
      // eslint-disable-next-line no-console
      console.log('[PANEL] cleared at:', new Error('panel-close-trace').stack);
    }
  }, [selectedBookingId]);

  // Refs mirror current state for use inside stable callbacks. Avoids
  // stale closures that captured an old value at setter-definition
  // time. Critical when setDayOffset is called from a useEffect that
  // depended on appointments : the closure was made when subView was
  // 'today' and dayOffset was 0, even though current state is different.
  const subViewRef = useRef(subView);
  const dayOffsetRef = useRef(dayOffset);
  const selectedBookingIdRef = useRef(selectedBookingId);
  useEffect(() => { subViewRef.current = subView; }, [subView]);
  useEffect(() => { dayOffsetRef.current = dayOffset; }, [dayOffset]);
  useEffect(() => { selectedBookingIdRef.current = selectedBookingId; }, [selectedBookingId]);

  // Single source of truth writer: navigates to the canonical path
  // form and updates sessionStorage. Used by setDayOffset, setSubView,
  // and setSelected so they stay in lockstep.
  //
  // HK May 31 2026: ALWAYS include the date in the path, even for
  // today's date. React Router 6 treats /dashboard/schedule and
  // /dashboard/schedule/:scheduleDate as DIFFERENT route matches,
  // and remounts the component tree when transitioning between them.
  // The remount re-reads URL on initialState and the missing date
  // param defaulted to today, snapping the user out of June and
  // back to May. By always using the date-path form, the matched
  // route is stable - no remount on Today button, no remount on
  // date changes within the same route shape.
  const persistState = (offset, view, bookingId) => {
    const dateStr = offsetToDateString(offset);
    const pathWithDate = `/dashboard/schedule/${dateStr}`;
    const sp = new URLSearchParams();
    if (view !== 'today') sp.set('view', view);
    if (bookingId) sp.set('b', bookingId);
    const search = sp.toString() ? `?${sp.toString()}` : '';
    const target = pathWithDate + search;

    if (routeLocation.pathname + routeLocation.search !== target) {
      routeNavigate(target, { replace: true });
    }
    const blob = JSON.stringify({
      dayOffset: offset, subView: view, bookingId: bookingId || null, at: Date.now(),
    });
    // Triple-redundant persistence:
    //   sessionStorage = survives in-tab navigation, refresh
    //   localStorage  = survives tab close, browser restart, Chrome
    //                   memory-saver tab discard
    // We read from sessionStorage first (more recent for same tab)
    // and fall back to localStorage.
    try { sessionStorage.setItem(STORAGE_KEY, blob); } catch (_) {}
    try { localStorage.setItem(STORAGE_KEY, blob); } catch (_) {}
  };

  const setDayOffset = (next) => {
    setDayOffsetRaw((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      // Use refs to read CURRENT subView and bookingId, not the captured
      // closure values. Prevents the URL from overwriting with stale state.
      persistState(value, subViewRef.current, selectedBookingIdRef.current);
      return value;
    });
  };

  const setSubView = (next) => {
    setSubViewRaw((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persistState(dayOffsetRef.current, value, selectedBookingIdRef.current);
      return value;
    });
  };

  const setSelectedBookingId = (next) => {
    setSelectedBookingIdRaw((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persistState(dayOffsetRef.current, subViewRef.current, value || '');
      return value;
    });
  };

  // On mount: canonicalize URL to /dashboard/schedule/<date>?b=<id>
  // form. Without this, arriving via the bare /dashboard/schedule
  // path stays bare until first action, and React Router treats that
  // bare path as a different route from the date-in-path version,
  // causing a remount when the first action writes the date URL.
  useEffect(() => {
    const fromPath = dateStringToOffset(routeParams.scheduleDate);
    if (fromPath === null) {
      // No date in path. Write the canonical form using either the
      // restored sessionStorage offset or today.
      persistState(initialState.dayOffset, initialState.subView, initialState.bookingId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state back from URL if it changes externally (browser back/
  // forward, deep-link from a notification, etc). Path + ?b= are the
  // authority here. State follows.
  useEffect(() => {
    const fromPath = dateStringToOffset(routeParams.scheduleDate);
    const target = fromPath !== null ? fromPath : 0;
    if (target !== dayOffset) {
      setDayOffsetRaw(target);
      dayOffsetRef.current = target;
    }
    const urlBookingId = searchParams.get('b') || '';
    if (urlBookingId !== selectedBookingId) {
      setSelectedBookingIdRaw(urlBookingId);
      selectedBookingIdRef.current = urlBookingId;
    }
    const blob = JSON.stringify({
      dayOffset: target, subView, bookingId: urlBookingId || null, at: Date.now(),
    });
    try { sessionStorage.setItem(STORAGE_KEY, blob); } catch (_) {}
    try { localStorage.setItem(STORAGE_KEY, blob); } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.scheduleDate, searchParams]);

  const [realBookings,setRealBookings]=useState(null);
  const [pendingApprovalBookings,setPendingApprovalBookings]=useState([]);
  const [actioningId,setActioningId]=useState(null);
  const [declineFor,setDeclineFor]=useState(null); // booking id we're collecting decline reason for
  const [declineReason,setDeclineReason]=useState('');
  const [loading,setLoading]=useState(true);
  const SAMPLE = makeSample(today);
  const [showCreate, setShowCreate] = useState(false);
  // HK May 29 2026: top-level "Block time" modal so the therapist can
  // block off personal/admin time without long-pressing the timeline.
  // Was previously only reachable via long-press, which HK lost.
  const [showBlockTime, setShowBlockTime] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  // Phase 9.3 (HK May 18 2026): long-press → option to schedule a
  // session instead of blocking. State lives here so BookingModal
  // can render at this component level (TimelineView only owns the
  // confirm sheet, not the modal). TimelineView calls our
  // onScheduleAtTime callback to hand control here.
  const [pendingBookingTime, setPendingBookingTime] = useState(null);  // {date, startTime}

  // Phase 1 (HK May 31 2026 9:30am CT): checkout context lifted to
  // ScheduleDashboard root. Previously CheckoutModal was rendered
  // inside DetailPanel, which meant any data refetch that briefly
  // nulled `selected` would unmount DetailPanel and take CheckoutModal
  // with it. Customer-blocking: every time init-card-setup upserted
  // the clients row, it triggered realtime -> scheduleRefresh ->
  // fetchBookings -> DetailPanel re-render -> CheckoutModal lost.
  //
  // Now: CheckoutModal renders at this level. DetailPanel calls
  // onRequestCheckout(payload) to open it. The modal stays alive
  // regardless of what happens in DetailPanel / the views below.
  // checkoutContext = { appt, client, defaultAmountCents } captured
  // at the moment of opening. The modal does NOT react to fetchBookings
  // refreshes (intentionally: stable snapshot through the payment flow).
  // After checkout completes, fetchBookings refreshes the schedule
  // and paymentsRefreshTick is bumped so DetailPanel reloads payments.
  const [checkoutContext, setCheckoutContext] = useState(null);
  const [paymentsRefreshTick, setPaymentsRefreshTick] = useState(0);
  const requestCheckout = (payload) => setCheckoutContext(payload);

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

  // Week start preference (HK May 27 2026, Jacquie's ask).
  // 0 = Sunday default, 1 = Monday. Authoritative copy lives in
  // Settings 2.1.5; Schedule tab has a quick pill toggle for fast
  // access. State follows the same pattern as showPreviewData:
  // initial read from props, instant local update on tap, persist
  // to db non-blocking with revert on failure.
  const [weekStartsOn, setWeekStartsOn] = useState(therapist?.week_starts_on ?? 0);
  useEffect(() => {
    if (therapist?.id && therapist?.week_starts_on !== undefined) {
      setWeekStartsOn(therapist.week_starts_on ?? 0);
    }
  }, [therapist?.id, therapist?.week_starts_on]);

  async function toggleWeekStart() {
    const next = weekStartsOn === 0 ? 1 : 0;
    setWeekStartsOn(next);
    try {
      await supabase.from('therapists').update({ week_starts_on: next }).eq('id', therapist.id);
      // Critical: refresh AuthContext so the new value propagates to
      // every component that reads therapist.week_starts_on from the
      // prop. Without this, CalendarGrid and the inner views see the
      // OLD value and the week start does not visually change.
      try { await refreshTherapist?.(); } catch (_) {}
    } catch (e) {
      setWeekStartsOn(weekStartsOn);
    }
  }

  // Blocked days state
  const [blockedDays, setBlockedDays] = useState([]);
  const [showBlockPanel, setShowBlockPanel] = useState(false);
  const [panelHelpOpen, setPanelHelpOpen] = useState(false);
  // Calendar coaching: show the first-open "What you can do here" intro
  // until the therapist dismisses it. localStorage persists across
  // sessions so the coaching doesn't return after every reload.
  const COACHING_KEY = `mbm_calendar_coaching_seen_${therapist?.id || 'anon'}`;
  const [hasSeenCalendarCoaching, setHasSeenCalendarCoaching] = useState(
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(COACHING_KEY) === '1'
      : false
  );
  const markCalendarCoachingSeen = () => {
    setHasSeenCalendarCoaching(true);
    try { window.localStorage.setItem(COACHING_KEY, '1'); } catch (e) {}
  };
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

  // ─── PWA refresh: realtime + visibility-change (HK May 29 2026) ─────
  // HK explicit ask: 'We must have a refresh mechanism without logging
  // out in the PWA.' Two pieces:
  //
  //   1. Supabase realtime subscription on bookings, sessions,
  //      session_payments, and blocked_days, filtered by therapist_id.
  //      Any DB write triggers a debounced fetchBookings() so the
  //      Schedule re-renders with the new state (status pills,
  //      annotations, Intake-done flips, refunded markers, etc).
  //
  //   2. document.visibilitychange listener: when the PWA comes back
  //      to foreground (iOS users switch apps a lot and the realtime
  //      socket may have dropped while backgrounded), refetch.
  //
  // Both refresh paths share a 400ms debounce so multi-write actions
  // (cancel = bookings UPDATE + session_payments INSERT + notification_log
  // INSERT) don't trigger 3 fetches.
  useEffect(() => {
    if (!therapist?.id) return;

    let refreshTimer = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        fetchBookings();
        loadBlockedDays();
      }, 400);
    };

    // Per-table channels, filtered to this therapist only so we don't
    // pull in noise from other therapists on the same realtime socket.
    const filt = `therapist_id=eq.${therapist.id}`;
    const channels = [
      supabase.channel(`sched-bookings-${therapist.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings',         filter: filt }, scheduleRefresh)
        .subscribe(),
      supabase.channel(`sched-sessions-${therapist.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions',         filter: filt }, scheduleRefresh)
        .subscribe(),
      supabase.channel(`sched-payments-${therapist.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_payments', filter: filt }, scheduleRefresh)
        .subscribe(),
      supabase.channel(`sched-blocks-${therapist.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_days',     filter: filt }, scheduleRefresh)
        .subscribe(),
      supabase.channel(`sched-clients-${therapist.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clients',          filter: filt }, scheduleRefresh)
        .subscribe(),
    ];

    // Foreground-return refresh. iOS PWA + Android both fire this.
    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      channels.forEach(c => { try { supabase.removeChannel(c); } catch (_e) { /* noop */ } });
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [therapist?.id]);

  async function loadBlockedDays() {
    const tStart = performance.now();
    const { data } = await supabase.from('blocked_days').select('*')
      .eq('therapist_id', therapist.id)
      .gte('date', new Date().toISOString().slice(0,10))
      .order('date');
    // eslint-disable-next-line no-console
    console.log(`[SCHED-PERF] loadBlockedDays: ${(performance.now() - tStart).toFixed(0)}ms · rows=${data?.length || 0}`);
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
    // Performance instrumentation (HK May 27 2026). Therapists report
    // Schedule load taking minutes on WiFi. This logs each query's
    // wall time so we can see exactly where the latency lives. Open
    // browser DevTools console after clicking into Schedule to see
    // [SCHED-PERF] logs.
    const perfStart = performance.now();
    const perfLog = (label, startedAt, extra) => {
      const ms = (performance.now() - startedAt).toFixed(0);
      const totalMs = (performance.now() - perfStart).toFixed(0);
      const extraStr = extra ? ` · ${extra}` : '';
      // eslint-disable-next-line no-console
      console.log(`[SCHED-PERF] ${label}: ${ms}ms (total ${totalMs}ms)${extraStr}`);
    };
    try {
      const tAuth = performance.now();
      const { data: { user } } = await supabase.auth.getUser();
      perfLog('auth.getUser', tAuth);
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

      const tBookings = performance.now();
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, services(name, duration, price, is_couples), location:therapist_locations(name), reminder_sent_at, deposit_required, deposit_paid, deposit_amount, partner_name, partner_email')
        .eq('therapist_id', therapist.id)
        // HK May 29 2026: cancelled bookings stay visible in the timeline
        // so the therapist sees what HAPPENED at that time slot. The
        // existing date window (past..future) prevents old cancels from
        // accumulating in the current view. No-show and rescheduled rows
        // are also visible by the same principle.
        .gte('booking_date', toDateStr(past))
        .lte('booking_date', toDateStr(future))
        .order('booking_date')
        .order('start_time')
        .limit(5000);
      perfLog('bookings query', tBookings, `rows=${bookings?.length || 0}`);

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
        duration: durationFromBooking(b),
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
      // HK May 30 2026: ROOT CAUSE FIX for "side panel keeps crashing".
      //
      // Before: .in('booking_id', bookingIds) where bookingIds was the
      // full array of booking UUIDs in the date window (652 for HK's
      // Joy Demo with a year of history). PostgREST/Supabase encodes
      // this as `booking_id=in.(uuid1,uuid2,...)` and the URL exceeds
      // ~30,000 characters, hitting the gateway's URL length limit and
      // returning HTTP 400 Bad Request. The query returns rows=0
      // (because it errored), so the schedule renders with EVERY
      // booking marked as un-paid and without a session. Every realtime
      // event refetches, every refetch 400s, every refetch shrinks
      // the data backing the visible cards. The DetailPanel's `appt`
      // prop ends up pointing at stale or empty data, and the panel
      // "crashes" / disappears.
      //
      // Fix: drop the .in() entirely. We already filter by therapist_id,
      // which means we already only fetch this therapist's sessions and
      // payments. Filtering further to "only sessions whose booking_id
      // is in this list" was an over-narrow filter that wasn't actually
      // saving us anything (the therapist's total session count is
      // bounded by their bookings anyway). URL stays short, query
      // succeeds, the schedule has accurate data, and the panel stays
      // open.
      const bookingIds = bookingsForSchedule.map(b => b.id);
      const tSessions = performance.now();
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, booking_id, client_id')
        .eq('therapist_id', therapist.id);
      perfLog('sessions query', tSessions, `rows=${sessions?.length || 0}, bookings=${bookingIds.length}`);

      // Phase 14.3j (HK May 17 2026 late): also fetch session_payments to
      // know which bookings have been paid. Without this, the timeline
      // can't visually distinguish paid bookings (real money received)
      // from unpaid confirmed bookings. Both rendered identical yellow
      // cards before this fix.
      const tPayments = performance.now();
      const { data: bookingPayments } = await supabase
        .from('session_payments')
        .select('booking_id, status, amount_cents, tip_cents')
        .eq('therapist_id', therapist.id);
      perfLog('session_payments query', tPayments, `rows=${bookingPayments?.length || 0}`);
      const paidMap = {};
      const refundedMap = {};  // HK May 29 2026: track refunds so the timeline can mark the slot
      (bookingPayments || []).forEach(p => {
        if (!p.booking_id) return;
        const cents = (p.amount_cents || 0) + (p.tip_cents || 0);
        if (p.status === 'succeeded') {
          paidMap[p.booking_id] = (paidMap[p.booking_id] || 0) + cents;
        } else if (p.status === 'refunded') {
          refundedMap[p.booking_id] = (refundedMap[p.booking_id] || 0) + cents;
        }
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

        // HK May 29 2026: trace statuses take precedence over the
        // intake/complete remapping so the timeline can mark cancelled,
        // no-show, refunded and rescheduled slots distinctly. A booking
        // with a recorded refund flips to 'refunded' regardless of its
        // raw status (a refunded session was complete before, but the
        // last-applied state is the trace we want to surface).
        let status;
        if (b.status === 'cancelled')              status = 'cancelled';
        else if (b.status === 'no_show')           status = 'no_show';
        else if (b.status === 'rescheduled')       status = 'rescheduled';
        else if ((refundedMap[b.id] || 0) > 0)     status = 'refunded';
        // HK May 31 2026: paid is its own status, takes precedence over
        // complete/intake-done/pending-intake when any succeeded payment
        // exists. Refunded still wins (refund overrides paid trace).
        else if ((paidMap[b.id] || 0) > 0)         status = 'paid';
        else if (b.status === 'completed')         status = 'complete';
        else if (sessionId)                        status = 'intake-done';
        else                                       status = 'pending-intake';

        return {
          id: b.id,
          client: b.client_name,
          email: (b.client_email || '').toLowerCase().trim(),
          time: fmt12(`${h}:${m}`),
          duration: durationFromBooking(b),
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
          // HK May 29 2026: raw start_time exposed in addition to the
          // truncated startTime field. Reschedule path in BookingModal
          // reads existingBooking.start_time to capture previous_start_time
          // on the row. Without this, reschedule emails went out missing
          // the 'rescheduled from <time>' fact (and previous_start_time
          // saved as NULL in the bookings row, breaking the timeline
          // trace and the reschedule audit too).
          start_time: b.start_time || null,
          // HK May 27 2026: expose FK ids so DetailPanel can render
          // the service editor (change service / duration / location
          // / addons / partner on an existing booking). Without these
          // the editor would have to re-fetch each row, which adds
          // latency for no benefit since we already JOIN them.
          service_id: b.service_id || null,
          location_id: b.location_id || null,
          addon_ids: b.addon_ids || [],
          addon_total_price: b.addon_total_price || 0,
          addon_extra_minutes: b.addon_extra_minutes || 0,
          booking_date: b.booking_date,
          // HK May 31 2026: package_purchase_id MUST be on the appt
          // object passed to DetailPanel. Without it, the package
          // detection effect (useEffect at ~line 1665) can never
          // identify the booking as already linked, so the green
          // "Session N of M" badge never appears and the "Link to a
          // package" picker re-shows after every refetch. This was
          // the "infinite loop" symptom HK hit.
          package_purchase_id: b.package_purchase_id || null,
          // Phase 14.3j: paid flag derived from session_payments rows.
          // Used by the timeline card style to color paid bookings.
          paid: (paidMap[b.id] || 0) > 0,
          paid_cents: paidMap[b.id] || 0,
          // Multi-location (HK May 18 2026): location name for the
          // appointment chip. NULL for single-location therapists or
          // pre-migration bookings; the chip render guards on this.
          locationName: b.location?.name || null,
          // HK May 29 2026: trace-state fields for the new status pills
          // and annotation line. The timeline reads these to render
          // "Cancelled 2:14 PM", "$1 no-show fee charged", "$120 refunded",
          // or "Rescheduled from Tue 10am". All are optional and the
          // annotation line is hidden when no trace state applies.
          rawStatus: b.status,
          paidCents: paidMap[b.id] || 0,
          refundedCents: refundedMap[b.id] || 0,
          cancellationChargeAmount: b.cancellation_charge_amount || 0,
          cancellationChargeStatus: b.cancellation_charge_status || null,
          cancellationChargeReason: b.cancellation_charge_reason || null,
          cancellationChargeFiredAt: b.cancellation_charge_fired_at || null,
          previousBookingDate: b.previous_booking_date || null,
          previousStartTime: b.previous_start_time || null,
          // HK May 29 2026: series fields for the "Session N of M" pill
          // on bookings that belong to a recurring set. Total is filled
          // in via a second pass below since we need the count per
          // series_id.
          seriesId: b.series_id || null,
          seriesIndex: b.series_index || null,
        };
      });

      // Build series totals so each booking in a series can show "1 of 4".
      // HK May 29 2026: a single pass over mapped is enough since we
      // already fetched every booking in the window.
      const seriesTotals = new Map();
      for (const a of mapped) {
        if (a.seriesId) seriesTotals.set(a.seriesId, (seriesTotals.get(a.seriesId) || 0) + 1);
      }
      for (const a of mapped) {
        if (a.seriesId) a.seriesTotal = seriesTotals.get(a.seriesId) || null;
      }

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
        const tExt = performance.now();
        const { data: extRows } = await supabase
          .from('external_calendar_events')
          .select('id, summary, start_at, end_at, is_all_day, source')
          .eq('therapist_id', therapist.id)
          .eq('status', 'confirmed')
          .gte('start_at', extFrom.toISOString())
          .lte('end_at', extTo.toISOString())
          .order('start_at');
        perfLog('external_calendar_events query', tExt, `rows=${extRows?.length || 0}`);
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
      perfLog('fetchBookings TOTAL', perfStart, `mapped=${mapped.length}, ext=${extEvents.length}`);
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
      {showBlockTime && (
        <BlockTimeModal
          therapist={therapist}
          onClose={() => setShowBlockTime(false)}
          onSaved={(msg) => {
            showScheduleToast(msg || 'Time blocked');
            fetchBookings();
            setShowBlockTime(false);
          }}
        />
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
        <BookingModal
          therapist={therapist}
          mode="reschedule"
          existingBooking={rescheduleAppt}
          onClose={() => setRescheduleAppt(null)}
          onSuccess={() => {
            // HK May 29 2026: soft-confirm + refresh so the timeline
            // shows the rescheduled trace immediately.
            showScheduleToast('Session rescheduled');
            fetchBookings();
          }}
        />
      )}
      {scheduleToast}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap',marginBottom:10}}>
          <h2 style={{fontFamily:"'Cormorant Garamond', Georgia, serif",fontSize:32,fontWeight:600,color:'#1F4131',margin:0,lineHeight:1,letterSpacing:'-0.02em'}}>Schedule</h2>
          <span style={{fontSize:13,color:'#6B7280',fontWeight:500}}>{fmtDay(today)}</span>
        </div>
      </div>

      {/* Block panel: HK May 27 2026 replaced legacy form with
          CalendarGrid component. Same Time off button toggles it;
          the new grid handles single days, drag-range, recurring
          rules, holidays, growth moments, and recurring-exception
          overrides. Legacy partial-day (time range) blocking still
          flows through blocked_days.start_time/end_time written
          elsewhere; full-day blocking is now via CalendarGrid. */}
      {showBlockPanel && (
        <div style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FBFAF4 100%)',
          border: '1px solid #EAE5DA',
          borderRadius: 16,
          padding: '22px 24px',
          marginBottom: 12,
          boxShadow: '0 1px 3px rgba(31, 41, 55, 0.04)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14, gap: 12,
          }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 17,
              fontWeight: 500,
              color: '#1F4030',
              letterSpacing: '-0.005em',
              flex: 1,
              minWidth: 0,
            }}>
              Manage your calendar and time off
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <CalendarHelpButton
                isOpen={panelHelpOpen}
                onToggle={() => setPanelHelpOpen(v => !v)}
              />
              <RoundIconButton ariaLabel="Close calendar" onClick={() => setShowBlockPanel(false)}>
                ×
              </RoundIconButton>
            </div>
          </div>
          <CalendarGrid
            therapist={therapist}
            embedded
            firstOpen={panelHelpOpen || !hasSeenCalendarCoaching}
            onCoachingSeen={() => { markCalendarCoachingSeen(); setPanelHelpOpen(false); }}
          />
        </div>
      )}

      {/* Prominent "Manage your calendar" card (HK May 27 2026, A plan).
          Replaces the small "Time off" chip that was buried among other
          action chips. Sits in primetime real estate above stats so
          the 70-year-old persona's eye lands on it. Subtitle shows
          current state ("Blocking N days · X recurring rules") so it
          reads as a status card, not just a button. Hidden when the
          calendar panel is open since the open panel IS the surface. */}
      {!showBlockPanel && (
        <button
          type="button"
          onClick={() => setShowBlockPanel(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'linear-gradient(135deg, #EEF3EE 0%, #F5EFE2 100%)',
            border: '1.5px solid #9DBEA1',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 14,
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            transition: 'box-shadow 0.18s ease, transform 0.12s ease',
            boxShadow: '0 1px 3px rgba(31, 65, 49, 0.08)',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 3px 10px rgba(31, 65, 49, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(31, 65, 49, 0.08)';
          }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#2A5741',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            <span style={{ filter: 'brightness(0) invert(1)' }}>📅</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#1F4030',
              marginBottom: 3,
            }}>
              Manage your calendar and time off
            </div>
            <div style={{
              fontSize: 12.5,
              color: '#4B5563',
              lineHeight: 1.4,
            }}>
              {(() => {
                const blockedCount = blockedDays.filter(b => !b.start_time && !b.end_time).length;
                const ruleCount = (window.__recurringRulesCount ?? 0);
                if (blockedCount === 0 && ruleCount === 0) {
                  return 'Block days, set recurring rules, mark holidays. Tap to open.';
                }
                const parts = [];
                if (blockedCount > 0) parts.push(`${blockedCount} day${blockedCount === 1 ? '' : 's'} blocked`);
                if (ruleCount > 0) parts.push(`${ruleCount} recurring rule${ruleCount === 1 ? '' : 's'}`);
                return parts.join(' · ') + '. Tap to open.';
              })()}
            </div>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#fff',
            border: '1.5px solid #9DBEA1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#2A5741',
            flexShrink: 0,
            fontSize: 16, fontWeight: 700,
          }}>›</div>
        </button>
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
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview&&a.status==='paid').length,label:'Paid',color:'#15803D'},
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview&&a.status==='intake-done').length,label:'Intake received',color:'#1E40AF'},
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview&&a.status==='pending-intake').length,label:'Need intake',color:'#D97706'},
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

        <button onClick={() => setShowBlockTime(true)}
          style={{display:'inline-flex',alignItems:'center',gap:6,background:'#fff',color:'#9A3412',border:'1.5px solid #FED7AA',borderRadius:22,padding:'10px 14px',fontSize:13,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',height:40,lineHeight:1,WebkitTapHighlightColor:'transparent'}}>
          <span style={{fontSize:14,lineHeight:1}}>⏸</span>
          <span>Block time</span>
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

        {/* Time off button moved out of the action chip row May 27 2026.
            It now lives as a prominent card directly below the action
            row (see "Manage your calendar" card). The chip-among-chips
            placement was too easy to miss for the 70-year-old persona. */}

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
              {subView==='today'   &&<TimelineView therapist={therapist} allAppts={allAppts} dayOffset={dayOffset} setDayOffset={setDayOffset} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings} blockedDays={blockedDays} onCreateBlock={addBlockedDay} onScheduleAtTime={setPendingBookingTime} selectedBookingId={selectedBookingId} setSelectedBookingId={setSelectedBookingId} onRequestCheckout={requestCheckout} paymentsRefreshTick={paymentsRefreshTick}/>}
              {subView==='weekly'  &&<WeeklyView therapist={therapist} appointments={allAppts} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings} blockedDays={blockedDays} selectedBookingId={selectedBookingId} setSelectedBookingId={setSelectedBookingId} onRequestCheckout={requestCheckout} paymentsRefreshTick={paymentsRefreshTick}/>}
              {subView==='monthly' &&<MonthlyView therapist={therapist} appointments={allAppts} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings} blockedDays={blockedDays} selectedBookingId={selectedBookingId} setSelectedBookingId={setSelectedBookingId} onRequestCheckout={requestCheckout} paymentsRefreshTick={paymentsRefreshTick}/>}
              {subView==='yearly'  &&<YearlyView therapist={therapist} appointments={allAppts} today={today} blockedDays={blockedDays}/>}
              {subView==='insights'&&<InsightsView appointments={allAppts}/>}
            </div>
          </div>
        )
      }

      {/* Phase 1 (HK May 31 2026): CheckoutModal lives at root,
          not inside DetailPanel. Survives any DetailPanel remount.
          Captured a snapshot of {appt, client, defaultAmountCents}
          at the moment "Charge" was tapped. The modal flow continues
          with that snapshot. fetchBookings refreshes after onPaid
          so the schedule + payment pills update. */}
      {checkoutContext && (
        <CheckoutModal
          appt={checkoutContext.appt}
          therapist={therapist}
          client={checkoutContext.client}
          defaultAmountCents={checkoutContext.defaultAmountCents}
          onClose={() => setCheckoutContext(null)}
          onPaid={(paidCents) => {
            const amount = typeof paidCents === 'number' ? ` $${(paidCents / 100).toFixed(2)}` : '';
            showScheduleToast(`Payment recorded${amount}`);
            setPaymentsRefreshTick((n) => n + 1);
            fetchBookings();
          }}
          onClientLinked={(picked) => {
            // Patch the snapshot so the modal header re-renders with
            // the linked client's name while still open.
            setCheckoutContext((prev) => prev ? ({
              ...prev,
              appt: {
                ...prev.appt,
                clientId: picked.id,
                client: picked.name || prev.appt.client,
                email: picked.email || prev.appt.email,
                phone: picked.phone || prev.appt.phone,
              },
            }) : null);
          }}
        />
      )}
    </div>
  );
}
