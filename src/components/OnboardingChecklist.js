// src/components/OnboardingChecklist.js
//
// Onboarding checklist - REDESIGNED May 7, 2026 per HK direction.
//
// The previous version showed all 5 steps stacked tall, which felt
// busy on the new-therapist dashboard where there are also clients,
// sessions, and revenue widgets vying for attention.
//
// New design philosophy: focus on ONE step at a time.
//   - Default state: show the current focused step large and friendly,
//     with a small dot row underneath showing overall progress
//   - Expanded state: show the full list (unchanged from before, still
//     useful when the therapist wants to scan ahead)
//   - Collapsed state: thin progress bar (unchanged from before, useful
//     once mostly done and the therapist wants to dismiss)
//
// Three view modes total: focused (new), expanded (old behavior),
// collapsed (existing). Default is focused. Therapist controls.
//
// Per HK design constraint: 'do not make it look busy. Keep it
// visually quiet, expandable rather than always-expanded, with one
// current focused step shown big and the others tucked away.'

import React, { useState, useEffect, useRef } from 'react';

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

export default function OnboardingChecklist({ therapist, services, availability, sessions, clients, onNavigate }) {
  // Three modes: 'focused' (default new behavior, one big step),
  // 'expanded' (full list, old behavior), 'collapsed' (thin bar).
  const [mode, setMode] = useState('focused');
  const [celebrate, setCelebrate] = useState(false);
  const prevDone = useRef(null);

  // Preview modal state. Replaces the old new-tab open which felt
  // like a dead-end (HK May 23 2026: 'when I click on the review
  // booking page, it does not give me a way back'). Modal keeps
  // therapist's dashboard context intact and has a clear close.
  const [previewOpen, setPreviewOpen] = useState(false);

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
  const policiesSubItems = [
    {
      id: 'cancellation',
      label: 'Cancellation policy',
      done: !!therapist?.cancellation_policy_enabled,
      view: 'settings#cancellation_policy',
    },
    {
      id: 'deposit',
      label: 'New client deposit',
      done: !!therapist?.deposit_enabled,
      view: 'settings#deposit',
    },
    {
      id: 'agreement',
      label: 'Client agreement',
      done: !!therapist?.practice_agreement_text,
      view: 'settings#client_agreement',
    },
  ];
  const policiesDone = policiesSubItems.filter(s => s.done).length;
  const policiesTotal = policiesSubItems.length;

  const checks = {
    import:   (clients||0) > 0 || !!therapist?.skipped_import_at,
    service:  (services?.length || 0) > 0 && services.some(s => Number(s.price) > 0),
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

  // EXPANDED mode: full list (the original design)
  return (
    <>
    <div style={{
      background: C.white,
      border: `1.5px solid ${C.light}`,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      boxShadow: '0 2px 12px rgba(42,87,65,0.08)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <QuietGlow active={celebrate} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Getting Started</div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: C.dark, margin: '0 0 2px' }}>
            {allDone ? '🎉 You\'re all set!' : `${done} of ${total} steps complete`}
          </h3>
          {!allDone && <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>Complete these to start accepting clients.</p>}
          {allDone && <p style={{ fontSize: 12, color: C.sage, margin: 0, fontWeight: 600 }}>Your practice is ready. Time to grow.</p>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => changeMode('focused')} style={{
            background: 'transparent',
            border: 'none',
            color: C.gray,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            Focus mode
          </button>
        </div>
      </div>

      <div style={{ height: 5, background: C.light, borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(done/total)*100}%`,
          background: `linear-gradient(90deg,${C.sage},${C.forest})`,
          borderRadius: 3,
          transition: 'width 0.5s ease',
        }}/>
      </div>

      {done > 0 && !allDone && (
        <div style={{
          fontSize: 12, color: C.gray, lineHeight: 1.5,
          background: '#FFF8E1', border: '1px solid #F0E5C0',
          borderRadius: 8, padding: '10px 12px', marginBottom: 12,
        }}>
          ✨ Items already checked were pre-filled to get you started. Tap <strong>Review</strong> on any to customize for your practice.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STEPS.map(step => {
          const isChecked = checks[step.id];
          const isImportStep = step.id === 'import';
          const isPoliciesStep = step.id === 'policies';
          const summary = isChecked ? completionSummary(step.id) : '';
          return (
            <React.Fragment key={step.id}>
              <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10,
              background: isChecked ? '#F0FDF4' : C.beige,
              border: `1px solid ${isChecked ? '#86EFAC' : C.light}`,
              transition: 'all 0.3s',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: isChecked ? C.forest : C.white,
                border: `2px solid ${isChecked ? C.forest : C.light}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isChecked ? 13 : 16, flexShrink: 0,
                transition: 'all 0.3s',
              }}>
                {isChecked ? <span style={{ color: '#fff', fontWeight: 700 }}>✓</span> : step.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: isChecked ? C.forest : C.dark,
                  textDecoration: isChecked ? 'line-through' : 'none',
                }}>
                  {step.label}
                </div>
                {!isChecked && <div style={{ fontSize: 11, color: C.gray, marginTop: 1 }}>{step.desc}</div>}
                {/* Completion summary: shows the therapist WHAT was
                    completed for this step so they can double-check.
                    HK May 23 2026 ask: 'in the review I dont see
                    what is complete once the task is complete.' */}
                {isChecked && summary && (
                  <div style={{ fontSize: 11, color: '#047857', marginTop: 2, fontWeight: 500 }}>
                    {summary}
                  </div>
                )}
              </div>
              {!isChecked && (
                <button onClick={() => handleNavigate(step.view)} style={{
                  background: C.forest, color: '#fff', border: 'none',
                  borderRadius: 8, padding: '6px 12px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {isImportStep ? 'Upload CSV →' : step.action + ' →'}
                </button>
              )}
              {isChecked && step.view && (
                <button onClick={() => handleNavigate(step.view)} style={{
                  background: 'transparent', color: C.forest,
                  border: `1px solid ${C.forest}`, borderRadius: 8,
                  padding: '5px 11px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  Review
                </button>
              )}
            </div>
            {/* Step 1 import: branching row below. Visible ALWAYS now
                (even when checked) so a therapist who imported but
                has more data, or who wants to ask for help post-hoc,
                still has the link surface. Quietly styled when the
                step is already done. */}
            {isImportStep && (
              <div style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                paddingLeft: 50,
                marginTop: -2,
                marginBottom: 2,
                fontSize: 11,
                color: C.gray,
                flexWrap: 'wrap',
                opacity: isChecked ? 0.65 : 1,
              }}>
                <span>{isChecked ? 'Need to import more or get help?' : "Don't have data?"}</span>
                {!isChecked && (
                  <button onClick={() => handleNavigate('import-skip')} style={{
                    background: 'transparent',
                    border: `1px solid ${C.sage}`,
                    color: C.forest,
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    I'm starting fresh
                  </button>
                )}
                <button onClick={() => handleNavigate('import-help')} style={{
                  background: 'transparent',
                  border: `1px solid ${C.light}`,
                  color: C.dark,
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  {isChecked ? 'Email us for help' : 'I need help'}
                </button>
              </div>
            )}
            {/* Step 5 policies: sub-items rendered inline so the
                therapist sees the 3 things that make policies
                complete, with individual deep-links. Step is checked
                only when all 3 sub-items are checked. */}
            {isPoliciesStep && (
              <div style={{
                paddingLeft: 50,
                marginTop: -2,
                marginBottom: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                {policiesSubItems.map(sub => (
                  <div key={sub.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    color: sub.done ? '#047857' : C.gray,
                  }}>
                    <div style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: sub.done ? C.sage : 'transparent',
                      border: `1.5px solid ${sub.done ? C.sage : C.light}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {sub.done && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontWeight: sub.done ? 600 : 500 }}>{sub.label}</span>
                    {!sub.done && (
                      <button onClick={() => handleNavigate(sub.view)} style={{
                        background: 'transparent',
                        border: 'none',
                        color: C.forest,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}>
                        Set up →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
    {previewOpen && <PreviewModal therapist={therapist} onClose={() => setPreviewOpen(false)} />}
    </>
  );
}
