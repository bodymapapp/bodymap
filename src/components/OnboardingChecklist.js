// src/components/OnboardingChecklist.js
//
// Setup Checklist component - REDESIGNED May 23, 2026 per HK direction.
//
// Three view modes: focused (one big current step), collapsed (thin
// bar), expanded (full list). Default is focused. Therapist controls.
//
// Round 1 (May 7 2026): 5 steps in stacked boxes. Worked but ugly.
// Round 2 (May 23 2026 round 1): added sub-items, preview modal, and
//   completion summaries. Better but still stacked-boxes-ugly.
// Round 3 (May 23 2026 round 2 = this version): Rank-1 redesign of
//   expanded mode. Quiet completed rows, prominent active step, real
//   inline policy toggles for Step 5 (no leaving the checklist),
//   single accent color, no yellow banners, single column with
//   timeline-style separators. Reference: Linear / Stripe / Notion.
//
// Per HK design principle May 23 2026: 'Ship Rank-1 design on the
// first try, not the third. Look up the best-in-class reference
// before building. Avoid stacked-boxes-with-buttons defaults.'

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC' };

const STEPS = [
  // view values map to real /dashboard/* routes in App.js. Hashes like
  // 'settings#import' trigger auto-open of that collapsible section in
  // SettingsPanel via location.hash useEffect.
  //
  // Step 1 has a three-path branching UI (CSV upload, start fresh, need
  // help) rendered inline in the focused view, not via this single
  // action button. See focused-mode JSX below for the branching.
  //
  // HK May 23 2026: revised step list based on Maria-persona feedback
  // and Jane App competitive research. Old steps were import/service/
  // hours/stripe/intake. New steps emphasize: bring clients over,
  // confirm services + hours, look at the booking page (educational,
  // not configuration), set the agreement and policies.
  { id:'import',  icon:'📥', label:'Move your clients over',    desc:'Import from Square, MassageBook, Vagaro or any CSV. Or start fresh if you\'re new.', action:'Import Clients', view:'settings#import' },
  { id:'service', icon:'🛁', label:'Set up your services',      desc:'Tell clients what you offer and at what price.',         action:'Review', view:'settings#services' },
  { id:'hours',   icon:'🕐', label:'Set your weekly hours',     desc:'Clients can only book during your available times.',     action:'Review', view:'settings#services' },
  { id:'preview', icon:'👀', label:'Look at your booking page', desc:'See exactly what clients will see when they book.',      action:'Preview booking page', view:'preview-booking' },
  { id:'policies',icon:'📋', label:'Set policies and agreement',desc:'Cancellation, deposit, and the agreement clients sign.', action:'Review', view:'settings#client_agreement' },
];

function QuietGlow({ active }) {
  // HK May 23 2026: replaced previous Confetti component with a much
  // quieter celebration. Per HK direction: 'minor celebration moments
  // not huge or flashy.' A sage glow ring expands around the panel
  // for ~1.2s when a step completes, then settles. Conveys progress
  // without infantilizing the therapist (Maria persona is 67yo).
  if (!active) return null;
  return (
    <>
      <div style={{
        position: 'absolute',
        inset: -2,
        borderRadius: 18,
        boxShadow: '0 0 0 0 rgba(107, 158, 128, 0.6)',
        pointerEvents: 'none',
        animation: 'bmQuietGlow 1.2s ease-out forwards',
        zIndex: 0,
      }} />
      <style>{`@keyframes bmQuietGlow {
        0%   { box-shadow: 0 0 0 0 rgba(107, 158, 128, 0.55); }
        60%  { box-shadow: 0 0 0 12px rgba(107, 158, 128, 0.18); }
        100% { box-shadow: 0 0 0 18px rgba(107, 158, 128, 0); }
      }`}</style>
    </>
  );
}

function ProgressRing({ done, total, size = 56 }) {
  // Circular progress for the header. Single accent color, thin stroke,
  // animated transition. Reference: Linear's project completion rings.
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? done / total : 0;
  const dashOffset = circumference * (1 - pct);
  const ringColor = '#2A5741';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8E4DC"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.4, .0, .2, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        color: ringColor,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {done}/{total}
      </div>
    </div>
  );
}

function PolicyToggle({ label, hint, settingsRef, enabled, onToggle, valueField, busy, extraLink }) {
  // Single policy row inside Step 5. Toggle on the right, optional
  // inline value editor revealed when enabled, reference to the
  // detailed Settings location for everything else.
  // Per HK May 23 2026: 'Option B - toggle + smart inline. Toggle ON
  // expands a tiny inline form. Default values shown but editable.
  // Link to Settings X.Y for the rest.'
  // HK May 23 2026 round 5: extraLink prop adds a context-specific
  // deep link beside the label for toggles that need configuration
  // beyond a single number (e.g. agreement text, cancellation rules).
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 10,
      background: enabled ? '#FAFBF7' : '#FFFFFF',
      border: `1px solid ${enabled ? '#D8DDD0' : '#EFEDE7'}`,
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1A1A2E',
              lineHeight: 1.3,
            }}>
              {label}
            </span>
            {settingsRef && (
              <span style={{
                fontSize: 10,
                color: '#9CA3AF',
                fontWeight: 500,
                background: '#F5F3EE',
                padding: '2px 6px',
                borderRadius: 4,
                letterSpacing: '0.02em',
              }}>
                {settingsRef}
              </span>
            )}
          </div>
          {hint && (
            <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2, lineHeight: 1.4 }}>
              {hint}
            </div>
          )}
          {extraLink && (
            <button
              onClick={(e) => { e.stopPropagation(); extraLink.onClick(); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2A5741',
                padding: '4px 0 0',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                textAlign: 'left',
                display: 'block',
              }}
            >
              {extraLink.label}
            </button>
          )}
        </div>
        <button
          onClick={onToggle}
          disabled={busy}
          aria-pressed={enabled}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            background: enabled ? '#2A5741' : '#D1D5DB',
            border: 'none',
            position: 'relative',
            cursor: busy ? 'wait' : 'pointer',
            transition: 'background 0.2s ease',
            flexShrink: 0,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 2,
            left: enabled ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.18s cubic-bezier(.4,.0,.2,1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          }} />
        </button>
      </div>
      {/* Inline editor slot. Child component renders the value field
          here when enabled. Component decides what to render. */}
      {enabled && valueField && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid #EFEDE7',
        }}>
          {valueField}
        </div>
      )}
    </div>
  );
}

function InlineNumberField({ label, value, suffix, min, max, onCommit, busy }) {
  // Editable numeric field for policy toggle inline editor.
  // Commits on blur or Enter. No dropdowns (HK rule: no dropdowns in
  // therapist-facing UI; use InlineSaveNumberInput pattern).
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  function commit() {
    const n = Math.max(min || 0, Math.min(max || 999, Number(local) || 0));
    setLocal(n);
    if (n !== value) onCommit(n);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <label style={{ color: '#6B7280', fontWeight: 500 }}>{label}</label>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#fff',
        border: '1px solid #D8DDD0',
        borderRadius: 7,
        padding: '4px 8px',
        gap: 4,
      }}>
        <input
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
          disabled={busy}
          min={min}
          max={max}
          style={{
            width: 44,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 600,
            color: '#1A1A2E',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            padding: 0,
          }}
        />
        {suffix && (
          <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}


function PreviewModal({ therapist, onClose }) {
  // HK May 23 2026: replaces new-tab open which felt like a dead-end.
  // Renders the public booking page in an iframe with a clear Close
  // button. Therapist sees what their clients see WITHOUT losing
  // their settings context. Esc key closes.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const customUrl = therapist?.custom_url;
  const bookingUrl = customUrl
    ? `${window.location.origin}/book/${customUrl}?preview=1`
    : null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.55)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      padding: 12,
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #E5E7EB',
          background: '#FAFAF7',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              What your clients see
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginTop: 2 }}>
              Booking page preview
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {bookingUrl && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: '#2A5741',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Open in new tab
              </a>
            )}
            <button onClick={onClose} style={{
              background: '#2A5741',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}>
              Close
            </button>
          </div>
        </div>
        <div style={{ flex: 1, background: '#F5F0E8', overflow: 'hidden', position: 'relative' }}>
          {bookingUrl ? (
            <iframe
              src={bookingUrl}
              title="Booking page preview"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#fff',
              }}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#6B7280',
              fontSize: 14,
              lineHeight: 1.6,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
              <div style={{ fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>
                Pick your booking URL first
              </div>
              <div>
                Set a custom URL in Settings then come back to preview.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingChecklist({ therapist, services: parentServices, availability: parentAvailability, sessions, clients: parentClients, onNavigate }) {
  // Three modes: 'focused' (default new behavior, one big step),
  // 'expanded' (full list, old behavior), 'collapsed' (thin bar).
  const [mode, setMode] = useState('focused');
  const [celebrate, setCelebrate] = useState(false);
  const prevDone = useRef(null);

  // Self-fetch services, availability, clients count. The component
  // used to read these directly from parent props but parent fetches
  // were inconsistent:
  //   - Settings page parent fetched services with id+price, availability with active
  //   - Dashboard home parent fetched services with ONLY id (missing price),
  //     causing the 'service' auto-detection to always return false
  // Plus parent fetches don't refresh when underlying tables change,
  // so adding a service or enabling a day didn't update the checklist
  // until full page reload. HK May 23 2026: 'Even when services and
  // hours are set, it is not showing complete.'
  //
  // Self-fetching with the right columns AND re-fetching on therapist
  // updates fixes both. Parent-passed values seed initial state so
  // the checklist still renders something on first paint before the
  // fetch resolves.
  const [selfServices, setSelfServices] = useState(parentServices || []);
  const [selfAvailability, setSelfAvailability] = useState(parentAvailability || []);
  const [selfClients, setSelfClients] = useState(parentClients || 0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (!therapist?.id) return;
    (async () => {
      try {
        const [svcRes, availRes, clientCountRes] = await Promise.all([
          // Any service row, no filter on archived or active. Step 2
          // is 'did you set up services'; the therapist's later choice
          // to archive or deactivate one doesn't undo that engagement.
          // Earlier filters on .is('archived_at', null) (and parent
          // loadStats's .eq('active', true)) caused false negatives:
          // HK May 23 2026 reported services not auto-completing
          // even with services set up.
          supabase.from('services').select('id').eq('therapist_id', therapist.id),
          supabase.from('availability').select('active').eq('therapist_id', therapist.id),
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('therapist_id', therapist.id),
        ]);
        if (!mounted) return;
        if (svcRes.error) console.error('[OnboardingChecklist] services fetch error:', svcRes.error);
        if (availRes.error) console.error('[OnboardingChecklist] availability fetch error:', availRes.error);
        setSelfServices(svcRes.data || []);
        setSelfAvailability(availRes.data || []);
        setSelfClients(clientCountRes.count || 0);
      } catch (e) {
        console.error('[OnboardingChecklist] self-fetch failed:', e);
      }
    })();
    return () => { mounted = false; };
  }, [therapist?.id, therapist?.skipped_import_at, therapist?.booking_page_previewed_at, therapist?.practice_agreement_enabled, therapist?.deposit_enabled, therapist?.cancellation_policy_enabled, therapist?.buffer_enabled, therapist?.accept_tips, refreshTick]);

  // Used by toggles to nudge a re-fetch after their own writes complete.
  // Most policy writes also trigger __refresh on the parent which
  // refetches therapist, which triggers the useEffect above. But for
  // safety (and so toggling a non-therapist field still refreshes the
  // checklist) we expose an internal bumpRefresh.
  const bumpRefresh = () => setRefreshTick(t => t + 1);

  const services = selfServices;
  const availability = selfAvailability;
  const clients = selfClients;

  // Preview modal state. Replaces the old new-tab open which felt
  // like a dead-end (HK May 23 2026: 'when I click on the review
  // booking page, it does not give me a way back'). Modal keeps
  // therapist's dashboard context intact and has a clear close.
  const [previewOpen, setPreviewOpen] = useState(false);

  // Ribbon (whole checklist) collapsed state. HK May 23 2026: 'The
  // whole thing should be a collapsible under Onboarding ribbon.'
  // Default open for new therapists, persists their choice. Once
  // setup is fully complete, the panel auto-collapses anyway via
  // the allDone special case at the top of render.
  const [ribbonOpen, setRibbonOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(`bm_onboarding_ribbon_${therapist?.id || 'anon'}`);
    return stored === null ? true : stored === 'true';
  });
  function toggleRibbon() {
    const next = !ribbonOpen;
    setRibbonOpen(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`bm_onboarding_ribbon_${therapist?.id || 'anon'}`, String(next));
    }
  }

  // Step 5 policies sub-list expansion. Per HK May 23 2026: 'Item 5
  // should be collapsible so that it does not look so daunting.'
  // Default closed. Therapist taps the row to expand the 5 toggles.
  // Auto-opens if the user clicks the Review pill on the row.
  const [policiesExpanded, setPoliciesExpanded] = useState(false);

  // Wrap parent onNavigate so we can intercept preview-booking and
  // show our own modal instead of letting the parent open a new tab.
  // The parent's stamp-only variant ('preview-booking-stamp') still
  // fires so the DB column gets set and the step auto-completes.
  function handleNavigate(view) {
    if (view === 'preview-booking') {
      setPreviewOpen(true);
      onNavigate('preview-booking-stamp');
      return;
    }
    onNavigate(view);
  }

  // Step 5 inline toggles. Each toggle writes a single boolean (or a
  // boolean + a default numeric value) directly to the therapist row
  // and calls onTherapistUpdated so the checklist auto-redetects.
  // Per HK May 23 2026 Option B: toggle ON applies sensible defaults
  // and reveals a tiny inline editor for the most important value.
  const [busyField, setBusyField] = useState(null);
  async function writeTherapist(patch, fieldKey) {
    if (!therapist?.id) return;
    setBusyField(fieldKey);
    try {
      const { error } = await supabase
        .from('therapists')
        .update(patch)
        .eq('id', therapist.id);
      if (error) {
        console.error('[onboarding toggle] failed:', fieldKey, error);
        return;
      }
      // Parent helper handles refetching the therapist row so the
      // toggle visually reflects the new state. We pass via onNavigate
      // with a sentinel value the parent recognizes as a refresh.
      // Simpler: call the existing helper-exposed refresh, which is
      // wired through buildOnboardingNavigate's onTherapistUpdated.
      onNavigate('__refresh');
    } catch (e) {
      console.error('[onboarding toggle] threw:', fieldKey, e);
    } finally {
      setBusyField(null);
    }
  }

  // Auto-detection. Each step is a boolean derived from real state,
  // so the green check is honest (based on what actually exists in the
  // DB), not on the therapist clicking 'I did it'. Two steps need
  // explicit timestamps because there is no data-shaped signal:
  //   - import: clients > 0 OR skipped_import_at set
  //   - preview: booking_page_previewed_at set
  // Both columns added in supabase/migrations/setup_checklist.sql.
  //
  // Policies step has 3 sub-items (cancellation, deposit, agreement).
  // ALL three must be set to mark step complete. This is stricter than
  // 'any of three' on purpose. HK May 23 2026: a therapist who has set
  // only a deposit has not finished policies. They have started.
  // Policies step has 5 toggles (HK May 23 2026: 'make it 5 toggles
  // but amazing rank 1 design'). Each toggle writes a real boolean
  // column on the therapist row and the corresponding settings panel
  // has the full detail. Order: client agreement first per HK direction,
  // then the four financial / operational policies.
  //
  // All 5 must be enabled for Step 5 to mark complete. This is
  // stricter than 'any of N' on purpose. A therapist who has flipped
  // 2 toggles has not finished setting policies. They have started.
  //
  // settingsRef strings match the feature taxonomy in BLOCK_PLAN.md so
  // a therapist who wants the full detail of any policy can grep their
  // way there from these reference codes.
  const policiesSubItems = [
    {
      id: 'agreement',
      label: 'Client agreement',
      hint: 'What every new client signs before their first session.',
      settingsRef: 'Settings 5.1',
      done: !!therapist?.practice_agreement_enabled,
      view: 'settings#client_agreement',
      patch: { practice_agreement_enabled: true },
      offPatch: { practice_agreement_enabled: false },
      fieldKey: 'practice_agreement_enabled',
      extraLink: {
        label: 'Edit agreement text →',
        target: 'settings#client_agreement',
      },
    },
    {
      id: 'deposit',
      label: 'New client deposit',
      hint: 'Hold the slot. Refundable on the first session.',
      settingsRef: 'Settings 5.2',
      done: !!therapist?.deposit_enabled,
      view: 'settings#deposit',
      patch: { deposit_enabled: true, deposit_percent: therapist?.deposit_percent || 25 },
      offPatch: { deposit_enabled: false },
      fieldKey: 'deposit_enabled',
      numericField: {
        column: 'deposit_percent',
        label: 'Deposit',
        suffix: '%',
        value: therapist?.deposit_percent ?? 25,
        min: 5,
        max: 100,
      },
    },
    {
      id: 'cancellation',
      label: 'Cancellation policy',
      hint: 'Late cancels and no-shows charged a percentage.',
      settingsRef: 'Settings 5.3',
      done: !!therapist?.cancellation_policy_enabled,
      view: 'settings#cancellation',
      patch: { cancellation_policy_enabled: true },
      offPatch: { cancellation_policy_enabled: false },
      fieldKey: 'cancellation_policy_enabled',
      extraLink: {
        label: 'Customize windows and fees →',
        target: 'settings#cancellation',
      },
    },
    {
      id: 'buffer',
      label: 'Buffer between sessions',
      hint: 'Time blocked between bookings to reset.',
      settingsRef: 'Settings 1.4',
      done: !!therapist?.buffer_enabled,
      view: 'settings#buffer',
      patch: { buffer_enabled: true, buffer_minutes: therapist?.buffer_minutes || 15 },
      offPatch: { buffer_enabled: false },
      fieldKey: 'buffer_enabled',
      numericField: {
        column: 'buffer_minutes',
        label: 'Buffer',
        suffix: 'min',
        value: therapist?.buffer_minutes ?? 15,
        min: 0,
        max: 120,
      },
    },
    {
      id: 'tips',
      label: 'Accept tips',
      hint: 'Clients can leave a tip on top of the session.',
      settingsRef: 'Settings 5.5',
      done: !!therapist?.accept_tips,
      view: 'settings#tips',
      patch: { accept_tips: true },
      offPatch: { accept_tips: false },
      fieldKey: 'accept_tips',
    },
  ];
  const policiesDone = policiesSubItems.filter(s => s.done).length;
  const policiesTotal = policiesSubItems.length;

  const checks = {
    import:   (clients||0) > 0 || !!therapist?.skipped_import_at,
    // service: any non-archived service exists. Previously required
    // price > 0, but that broke when the parent's services fetch
    // omitted the price column (home tab) and was overly strict
    // anyway. The Services UI requires entering a price on insert,
    // so service-with-price-0 is unusual; if it ever happens the
    // therapist can adjust before booking.
    service:  (services?.length || 0) > 0,
    hours:    availability?.some(a => a.active),
    preview:  !!therapist?.booking_page_previewed_at,
    policies: policiesDone === policiesTotal,
  };

  // Completion summary text. Shown next to each completed step in
  // expanded mode so the therapist can double-check what they did.
  // Per HK May 23 2026: 'in the review I dont see what is complete
  // once the task is complete just in case I want to double check.'
  function completionSummary(stepId) {
    if (stepId === 'import') {
      if ((clients||0) > 0) return `${clients} client${clients === 1 ? '' : 's'} imported`;
      if (therapist?.skipped_import_at) return 'Starting fresh, no import';
      return '';
    }
    if (stepId === 'service') {
      const priced = (services||[]).filter(s => Number(s.price) > 0);
      if (priced.length === 0) return '';
      const prices = priced.map(s => Number(s.price)).filter(p => p > 0);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const range = min === max ? `$${min}` : `$${min} to $${max}`;
      return `${priced.length} service${priced.length === 1 ? '' : 's'}, ${range}`;
    }
    if (stepId === 'hours') {
      const activeDays = (availability||[]).filter(a => a.active).length;
      if (activeDays === 0) return '';
      return `Available ${activeDays} day${activeDays === 1 ? '' : 's'} a week`;
    }
    if (stepId === 'preview') {
      if (!therapist?.booking_page_previewed_at) return '';
      try {
        const d = new Date(therapist.booking_page_previewed_at);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `Previewed on ${dateStr}`;
      } catch { return 'Previewed'; }
    }
    if (stepId === 'policies') {
      const setItems = policiesSubItems.filter(s => s.done).map(s => s.label);
      if (setItems.length === 0) return '';
      return setItems.join(', ');
    }
    return '';
  }
  const done    = Object.values(checks).filter(Boolean).length;
  const total   = STEPS.length;
  const allDone = done===total;

  // First unchecked step is the current focus
  const currentStep = STEPS.find(s => !checks[s.id]) || null;

  // Restore last mode preference
  useEffect(()=>{
    const key=`bm_onboarding_mode_${therapist?.id}`;
    const saved = localStorage.getItem(key);
    if (saved === 'collapsed' || saved === 'expanded' || saved === 'focused') {
      setMode(saved);
    }
  },[therapist?.id]);

  // Confetti on step completion
  useEffect(()=>{
    if(prevDone.current!==null && done>prevDone.current){
      setCelebrate(true);
      setTimeout(()=>setCelebrate(false),1600);
    }
    prevDone.current=done;
  },[done]);

  function changeMode(next) {
    const key=`bm_onboarding_mode_${therapist?.id}`;
    if (next === 'focused') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, next);
    }
    setMode(next);
  }

  // ALL DONE state, regardless of mode: small celebratory bar
  if (allDone && mode !== 'expanded') {
    return (
      <>
      <div style={{
        background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
        border: '1.5px solid #86EFAC',
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ fontSize: 22 }}>🌱</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>Setup complete</div>
          <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.4 }}>
            Your practice is ready. Time to grow.
          </div>
        </div>
        <button onClick={() => changeMode('expanded')} style={{
          background: 'transparent',
          border: '1px solid #86EFAC',
          color: '#15803D',
          borderRadius: 8,
          padding: '5px 10px',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          Review steps
        </button>
      </div>
      {previewOpen && <PreviewModal therapist={therapist} onClose={() => setPreviewOpen(false)} />}
      </>
    );
  }

  // COLLAPSED mode: thin progress bar, click to focus
  if (mode === 'collapsed') {
    return (
      <>
      <button onClick={() => changeMode('focused')} style={{
        display:'flex',
        alignItems:'center',
        gap:10,
        background:C.white,
        border:`1.5px solid ${C.light}`,
        borderRadius:12,
        padding:'10px 16px',
        marginBottom:16,
        cursor:'pointer',
        boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
        width:'100%',
        textAlign:'left',
      }}>
        <div style={{ height:5, flex:1, background:C.light, borderRadius:3, overflow:'hidden' }}>
          <div style={{
            height:'100%',
            width:`${(done/total)*100}%`,
            background:`linear-gradient(90deg,${C.sage},${C.forest})`,
            borderRadius:3,
          }}/>
        </div>
        <span style={{ fontSize:12, fontWeight:700, color:C.forest, whiteSpace:'nowrap' }}>
          Setup {done}/{total}
        </span>
        <span style={{ fontSize:12, color:C.gray }}>▼ show</span>
      </button>
      {previewOpen && <PreviewModal therapist={therapist} onClose={() => setPreviewOpen(false)} />}
      </>
    );
  }

  // FOCUSED mode (default): one big current step + small progress dots
  if (mode === 'focused' && currentStep) {
    return (
      <>
      <div style={{
        background: C.white,
        border: `1.5px solid ${C.light}`,
        borderRadius: 16,
        padding: 18,
        marginBottom: 20,
        boxShadow: '0 2px 12px rgba(42,87,65,0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <QuietGlow active={celebrate} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Next step · {done + 1} of {total}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => changeMode('expanded')} style={{
              background: 'transparent',
              border: 'none',
              color: C.gray,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}>
              See all steps
            </button>
            <span style={{ color: C.gray, fontSize: 11 }}>·</span>
            <button onClick={() => changeMode('collapsed')} style={{
              background: 'transparent',
              border: 'none',
              color: C.gray,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}>
              Hide
            </button>
          </div>
        </div>

        {/* THE focused step: large icon + label + action */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '6px 0 12px',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: C.beige,
            border: `1.5px solid ${C.light}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            flexShrink: 0,
          }}>
            {currentStep.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 17,
              fontWeight: 700,
              color: C.dark,
              margin: '0 0 4px',
              lineHeight: 1.2,
            }}>
              {currentStep.label}
            </h3>
            <p style={{
              fontSize: 12,
              color: C.gray,
              margin: 0,
              lineHeight: 1.5,
            }}>
              {currentStep.desc}
            </p>
          </div>
        </div>

        {currentStep.id === 'import' ? (
          // Three-path branching for Step 1, as agreed with HK May 23 2026.
          // Primary action is the most common case (migrating therapists
          // upload CSV). Secondary row covers brand-new therapists who
          // have no data, and therapists who feel stuck and want human
          // help. The 'Need help' path opens a prefilled mailto today;
          // a future in-app disclaimer + import@ alias is queued as a
          // BLOCK_PLAN follow-up.
          <>
            <button onClick={() => handleNavigate(currentStep.view)} style={{
              background: C.forest,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '11px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
            }}>
              Upload CSV →
            </button>
            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 10,
              fontSize: 12,
              color: C.gray,
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <span>Don't have data?</span>
              <button onClick={() => handleNavigate('import-skip')} style={{
                background: 'transparent',
                border: `1px solid ${C.sage}`,
                color: C.forest,
                borderRadius: 7,
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                I'm starting fresh
              </button>
              <button onClick={() => handleNavigate('import-help')} style={{
                background: 'transparent',
                border: `1px solid ${C.light}`,
                color: C.dark,
                borderRadius: 7,
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                I need help
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => handleNavigate(currentStep.view)} style={{
            background: C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '11px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
          }}>
            {currentStep.action} →
          </button>
        )}

        {/* Progress dots: filled = done, outlined = not done, ring = current */}
        <div style={{
          display: 'flex',
          gap: 6,
          justifyContent: 'center',
          marginTop: 14,
        }}>
          {STEPS.map(s => {
            const isDone = checks[s.id];
            const isCurrent = s.id === currentStep.id;
            return (
              <div key={s.id} title={s.label} style={{
                width: isCurrent ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: isDone ? C.forest : (isCurrent ? C.sage : C.light),
                transition: 'all 0.3s',
              }}/>
            );
          })}
        </div>
      </div>
      {previewOpen && <PreviewModal therapist={therapist} onClose={() => setPreviewOpen(false)} />}
      </>
    );
  }

  // EXPANDED mode: Rank-1 redesign May 23 2026.
  //
  // Design philosophy (per HK direction May 23 2026):
  //   1. Single column, single accent color (forest green #2A5741)
  //   2. Quiet completed states. No strikethrough. No green-tinted
  //      backgrounds. Completed items are just text + a small filled
  //      circle. Completed-item summary text shown beneath label.
  //   3. Prominent active step. Only one step is the 'current focus'
  //      and it gets a brief description and primary action button.
  //   4. Timeline-style visual: a vertical line on the left connects
  //      all steps so they read as a journey, not a list of toggles.
  //   5. No yellow 'pre-filled' banner. Replaced with one quiet line.
  //   6. Header has a circular progress ring (not a thin bar).
  //   7. Step 5 sub-items are 5 inline toggles with real ON/OFF.
  //      Each toggle reveals an inline numeric editor when relevant.
  //      Settings ref code (e.g. Settings 5.1) shown as a small chip
  //      next to each toggle label for therapists who want the full
  //      detail panel.
  //
  // Refs: Linear's onboarding (one-column, quiet completions, ring),
  // Stripe Connect (vertical timeline), Notion's get-started widget.

  // Active step = first incomplete step. Falls back to last step if
  // all done (covered by the allDone special case above).
  const activeStepId = currentStep ? currentStep.id : null;

  return (
    <>
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #EFEDE7',
      borderRadius: 18,
      padding: '22px 22px 18px',
      marginBottom: 20,
      boxShadow: '0 2px 10px rgba(20, 20, 25, 0.04)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <QuietGlow active={celebrate} />

      {/* Header: title + tiny subhead + circular progress ring on
          the right. Single-row, asymmetric. Reference: Linear.
          HK May 23 2026: 'The whole thing should be a collapsible
          under Onboarding ribbon.' Header is tappable; chevron
          indicates state; body collapses when closed. */}
      <button
        onClick={toggleRibbon}
        aria-expanded={ribbonOpen}
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          width: '100%',
          cursor: 'pointer',
          marginBottom: ribbonOpen ? 18 : 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#6B9E80',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}>
            Setup
          </div>
          <h3 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 19,
            fontWeight: 700,
            color: '#1A1A2E',
            margin: 0,
            lineHeight: 1.2,
          }}>
            {allDone ? "You're ready to accept clients" : `${total - done} step${total - done === 1 ? '' : 's'} left`}
          </h3>
          <p style={{
            fontSize: 12.5,
            color: '#6B7280',
            margin: '4px 0 0',
            lineHeight: 1.45,
          }}>
            {allDone
              ? 'Everything is set up. Share your booking page when ready.'
              : 'Complete these to start accepting clients online.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <ProgressRing done={done} total={total} size={56} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{
            transition: 'transform 0.2s ease',
            transform: ribbonOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {ribbonOpen && (<>
      {/* Steps as a single-column vertical timeline. Each row has:
          [icon dot / checkmark]  [step content]  [secondary action]
          Visual continuity via a thin sage line on the left connecting
          the dots. The active step has a slightly larger dot. */}
      <div style={{ position: 'relative' }}>
        {/* The connecting line. Positioned behind all dots, runs from
            first dot to last dot, fades out at edges. */}
        <div style={{
          position: 'absolute',
          left: 11,
          top: 14,
          bottom: 14,
          width: 1.5,
          background: 'linear-gradient(to bottom, transparent, #D8DDD0 12%, #D8DDD0 88%, transparent)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {STEPS.map((step, idx) => {
            const isChecked = checks[step.id];
            const isActive = step.id === activeStepId;
            const isPoliciesStep = step.id === 'policies';
            const isImportStep = step.id === 'import';
            const summary = isChecked ? completionSummary(step.id) : '';

            return (
              <div key={step.id} style={{
                display: 'flex',
                gap: 14,
                paddingTop: idx === 0 ? 0 : 14,
                paddingBottom: idx === STEPS.length - 1 ? 0 : 14,
                position: 'relative',
              }}>
                {/* Status dot. Filled forest if done. Sage ring if
                    active. Empty gray if pending. */}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isChecked ? '#2A5741' : '#FFFFFF',
                  border: `1.5px solid ${isChecked ? '#2A5741' : (isActive ? '#6B9E80' : '#D8DDD0')}`,
                  boxShadow: isActive && !isChecked ? '0 0 0 3px rgba(107, 158, 128, 0.18)' : 'none',
                  transition: 'all 0.2s ease',
                  marginTop: 2,
                  zIndex: 1,
                }}>
                  {isChecked && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {!isChecked && isActive && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6B9E80' }} />
                  )}
                </div>

                {/* Step content. Label, summary or description, and
                    interactive surface (button or sub-items). */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: isActive ? 700 : 600,
                        color: isChecked ? '#6B7280' : '#1A1A2E',
                        lineHeight: 1.35,
                      }}>
                        {step.label}
                      </div>
                      {isChecked && summary && (
                        <div style={{
                          fontSize: 11.5,
                          color: '#6B7280',
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}>
                          {summary}
                        </div>
                      )}
                      {!isChecked && isActive && step.desc && !isPoliciesStep && (
                        <div style={{
                          fontSize: 12,
                          color: '#6B7280',
                          marginTop: 3,
                          lineHeight: 1.5,
                        }}>
                          {step.desc}
                        </div>
                      )}
                      {/* Policies progress when collapsed. Tells the
                          therapist how many of 5 are on without
                          forcing them to expand. */}
                      {isPoliciesStep && !policiesExpanded && (
                        <div style={{
                          fontSize: 12,
                          color: '#6B7280',
                          marginTop: 3,
                          lineHeight: 1.5,
                        }}>
                          {policiesDone === 0
                            ? 'Cancellation, deposit, agreement and 2 more. Tap Review to set.'
                            : `${policiesDone} of ${policiesTotal} set. Tap Review to adjust.`}
                        </div>
                      )}
                    </div>

                    {/* Unified Review pill. HK May 23 2026:
                        'They should be always able to review whether
                        complete or not. Different size of review
                        button looks weird.' Same look, same size,
                        regardless of step state. The visual emphasis
                        on which step is active comes from the dot
                        ring on the left, not from the button shape. */}
                    {!isPoliciesStep && (
                      <button onClick={() => handleNavigate(step.view)} style={{
                        background: 'transparent',
                        color: '#2A5741',
                        border: '1px solid #D8DDD0',
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        minWidth: 76,
                        textAlign: 'center',
                      }}>
                        Review
                      </button>
                    )}
                    {isPoliciesStep && (
                      <button onClick={() => setPoliciesExpanded(v => !v)} style={{
                        background: 'transparent',
                        color: '#2A5741',
                        border: '1px solid #D8DDD0',
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        minWidth: 76,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        Review
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{
                          transition: 'transform 0.2s ease',
                          transform: policiesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Step 1: import help affordance. Always visible.
                      Quieter when checked. */}
                  {isImportStep && (
                    <div style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      marginTop: 8,
                      flexWrap: 'wrap',
                      fontSize: 11.5,
                      color: '#9CA3AF',
                      opacity: isChecked ? 0.7 : 1,
                    }}>
                      <span>{isChecked ? 'Need to import more or get help?' : "Don't have data?"}</span>
                      {!isChecked && (
                        <button onClick={() => handleNavigate('import-skip')} style={{
                          background: 'transparent',
                          border: '1px solid #D8DDD0',
                          color: '#2A5741',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}>
                          I'm starting fresh
                        </button>
                      )}
                      <button onClick={() => handleNavigate('import-help')} style={{
                        background: 'transparent',
                        border: '1px solid #EFEDE7',
                        color: '#6B7280',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}>
                        Email us
                      </button>
                    </div>
                  )}

                  {/* Step 5: 5 inline policy toggles. Each is a real
                      ON/OFF connected to therapist columns. When ON,
                      reveals inline numeric editor for the key value.
                      All 5 must be ON for the step to mark complete.
                      HK May 23 2026: 'Item 5 should be collapsible
                      so that it does not look so daunting.' Default
                      closed; expands on Review tap. */}
                  {isPoliciesStep && policiesExpanded && (
                    <div style={{
                      marginTop: isActive || !isChecked ? 10 : 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      {!isChecked && isActive && (
                        <div style={{
                          fontSize: 12,
                          color: '#6B7280',
                          lineHeight: 1.5,
                          marginBottom: 2,
                        }}>
                          {step.desc}
                        </div>
                      )}
                      {policiesSubItems.map((sub) => {
                        const numeric = sub.numericField;
                        const busy = busyField === sub.fieldKey || busyField === numeric?.column;
                        let valueField = null;
                        if (sub.done && numeric) {
                          valueField = (
                            <InlineNumberField
                              label={numeric.label}
                              value={numeric.value}
                              suffix={numeric.suffix}
                              min={numeric.min}
                              max={numeric.max}
                              busy={busy}
                              onCommit={(n) => writeTherapist({ [numeric.column]: n }, numeric.column)}
                            />
                          );
                        }
                        return (
                          <PolicyToggle
                            key={sub.id}
                            label={sub.label}
                            hint={sub.hint}
                            settingsRef={sub.settingsRef}
                            enabled={sub.done}
                            busy={busy}
                            onToggle={() => writeTherapist(sub.done ? sub.offPatch : sub.patch, sub.fieldKey)}
                            valueField={valueField}
                            extraLink={sub.extraLink ? {
                              label: sub.extraLink.label,
                              onClick: () => handleNavigate(sub.extraLink.target),
                            } : null}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: quiet pre-filled note. Replaces the old loud yellow
          banner. Single line, low contrast, only shown when any step
          was already auto-detected as done on first render. */}
      {done > 0 && !allDone && (
        <div style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid #EFEDE7',
          fontSize: 11,
          color: '#9CA3AF',
          lineHeight: 1.5,
          textAlign: 'center',
        }}>
          Items already checked were detected from what's set up. Tap Review on any to adjust.
        </div>
      )}

      {/* Mode toggles in footer right, small and quiet */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 14,
        marginTop: done > 0 && !allDone ? 8 : 14,
        paddingTop: done > 0 && !allDone ? 0 : 14,
        borderTop: done > 0 && !allDone ? 'none' : '1px solid #EFEDE7',
      }}>
        <button onClick={() => changeMode('focused')} style={{
          background: 'transparent',
          border: 'none',
          color: '#9CA3AF',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
        }}>
          Focus mode
        </button>
        <button onClick={() => changeMode('collapsed')} style={{
          background: 'transparent',
          border: 'none',
          color: '#9CA3AF',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
        }}>
          Hide
        </button>
      </div>
      </>)}
    </div>
    {previewOpen && <PreviewModal therapist={therapist} onClose={() => setPreviewOpen(false)} />}
    </>
  );
}
