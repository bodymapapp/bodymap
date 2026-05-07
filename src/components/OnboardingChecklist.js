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
  { id:'import',  icon:'📥', label:'Move your clients over',    desc:'Import from Square, MassageBook, Vagaro or any CSV. 2 minutes, no client left behind.', action:'Import Clients', view:'settings#import' },
  { id:'service', icon:'🛁', label:'Add your first service',    desc:'Tell clients what you offer and at what price.',         action:'Review', view:'settings#services' },
  { id:'hours',   icon:'🕐', label:'Set your working hours',    desc:'Clients can only book during your available times.',     action:'Review', view:'settings#services' },
  { id:'stripe',  icon:'💳', label:'Connect Stripe (optional)', desc:'Accept deposits from new clients to protect your time.', action:'Go to Settings', view:'settings#payments' },
  { id:'intake',  icon:'📋', label:'Send your first intake',    desc:'Book a client and send them the intake form. This is the moment it all clicks.', action:'Get my link', view:'settings#intake_qr' },
];

function Confetti({ active }) {
  const colors = ['#2A5741','#6B9E80','#C9A84C','#F5F0E8','#4CAF7D','#FBBF24'];
  if (!active) return null;
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:10 }}>
      {Array.from({length:28}).map((_, i) => (
        <div key={i} style={{
          position:'absolute',
          left:`${(i/28)*100 + (Math.random()-0.5)*10}%`,
          top:'-10px',
          width: 6+Math.random()*6,
          height: 6+Math.random()*6,
          borderRadius: Math.random()>0.5?'50%':2,
          background: colors[i%colors.length],
          animation:`bmConfettiFall ${0.7+Math.random()*0.9}s ease-in ${Math.random()*0.5}s forwards`,
          transform:`rotate(${Math.random()*360}deg)`,
          opacity:0,
        }}/>
      ))}
      <style>{`@keyframes bmConfettiFall{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(220px) rotate(360deg)}}`}</style>
    </div>
  );
}

export default function OnboardingChecklist({ therapist, services, availability, sessions, clients, onNavigate }) {
  // Three modes: 'focused' (default new behavior, one big step),
  // 'expanded' (full list, old behavior), 'collapsed' (thin bar).
  const [mode, setMode] = useState('focused');
  const [celebrate, setCelebrate] = useState(false);
  const prevDone = useRef(null);

  const checks = {
    import:  (clients||0)>0,
    service: services?.length>0,
    hours:   availability?.some(a=>a.active),
    stripe:  !!therapist?.stripe_account_connected,
    intake:  sessions>0,
  };
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
    );
  }

  // COLLAPSED mode: thin progress bar, click to focus
  if (mode === 'collapsed') {
    return (
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
    );
  }

  // FOCUSED mode (default): one big current step + small progress dots
  if (mode === 'focused' && currentStep) {
    return (
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
        <Confetti active={celebrate} />

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

        <button onClick={() => onNavigate(currentStep.view)} style={{
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
    );
  }

  // EXPANDED mode: full list (the original design)
  return (
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
      <Confetti active={celebrate} />

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
          return (
            <div key={step.id} style={{
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
              </div>
              {!isChecked && (
                <button onClick={() => onNavigate(step.view)} style={{
                  background: C.forest, color: '#fff', border: 'none',
                  borderRadius: 8, padding: '6px 12px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {step.action} →
                </button>
              )}
              {isChecked && step.view && (
                <button onClick={() => onNavigate(step.view)} style={{
                  background: 'transparent', color: C.forest,
                  border: `1px solid ${C.forest}`, borderRadius: 8,
                  padding: '5px 11px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  Review
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
