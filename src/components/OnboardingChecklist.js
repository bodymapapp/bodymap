import React, { useState, useEffect } from 'react';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC' };

const STEPS = [
  { id:'service', icon:'🛁', label:'Add your first service',   desc:'Tell clients what you offer and at what price.',         action:'Go to Settings', view:'settings' },
  { id:'hours',   icon:'🕐', label:'Set your working hours',   desc:'Clients can only book during your available times.',     action:'Go to Settings', view:'settings' },
  { id:'stripe',  icon:'💳', label:'Connect Stripe (optional)',desc:'Accept deposits from new clients to protect your time.', action:'Go to Settings', view:'settings' },
  { id:'link',    icon:'🔗', label:'Share your booking link',  desc:'Copy your link and send it to your first client.',       action:'Go to Settings', view:'settings' },
  { id:'intake',  icon:'📋', label:'Send your first intake',   desc:'Book a client and send them the intake form.',           action:'Go to Clients',  view:'clients'  },
];

export default function OnboardingChecklist({ therapist, services, availability, sessions, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);

  const hasService = services?.length > 0;
  const hasHours   = availability?.some(a => a.active);
  const hasStripe  = !!therapist?.stripe_account_connected;
  const hasLink    = hasService && hasHours;
  const hasIntake  = false;

  const checks = { service:hasService, hours:hasHours, stripe:hasStripe, link:hasLink, intake:hasIntake };
  const done  = Object.values(checks).filter(Boolean).length;
  const total = STEPS.length;
  const allDone = done === total;

  // Auto-collapse on mount if everything done
  useEffect(() => {
    const key = `bm_onboarding_collapsed_${therapist?.id}`;
    if (localStorage.getItem(key)) setCollapsed(true);
  }, [therapist?.id]);

  function toggleCollapse() {
    const key = `bm_onboarding_collapsed_${therapist?.id}`;
    const next = !collapsed;
    if (next) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
    setCollapsed(next);
  }

  // Collapsed pill — always visible so therapist can bring it back
  if (collapsed) {
    return (
      <button onClick={toggleCollapse}
        style={{ display:'flex', alignItems:'center', gap:10, background:C.white, border:`1.5px solid ${C.light}`, borderRadius:12, padding:'10px 16px', marginBottom:16, cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', width:'100%', textAlign:'left' }}>
        <div style={{ height:6, flex:1, background:C.light, borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${(done/total)*100}%`, background:`linear-gradient(90deg,${C.sage},${C.forest})`, borderRadius:3 }} />
        </div>
        <span style={{ fontSize:12, fontWeight:700, color:C.forest, whiteSpace:'nowrap' }}>{allDone ? '✅ Setup complete' : `Setup ${done}/${total}`}</span>
        <span style={{ fontSize:12, color:C.gray }}>▼ show</span>
      </button>
    );
  }

  return (
    <div style={{ background:C.white, border:`1.5px solid ${C.light}`, borderRadius:16, padding:24, marginBottom:24, boxShadow:'0 2px 12px rgba(42,87,65,0.08)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>Getting Started</div>
          <h3 style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:C.dark, margin:'0 0 4px' }}>
            {allDone ? '🎉 You\'re all set!' : `${done} of ${total} steps complete`}
          </h3>
          {!allDone && <p style={{ fontSize:13, color:C.gray, margin:0 }}>Complete these steps to start accepting clients.</p>}
        </div>
        <button onClick={toggleCollapse} style={{ background:'transparent', border:'none', color:C.gray, cursor:'pointer', fontSize:13, fontWeight:600, padding:'0 0 0 12px', whiteSpace:'nowrap' }}>
          ▲ hide
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height:6, background:C.light, borderRadius:3, marginBottom:20, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${(done/total)*100}%`, background:`linear-gradient(90deg,${C.sage},${C.forest})`, borderRadius:3, transition:'width 0.4s ease' }} />
      </div>

      {/* Steps */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {STEPS.map(step => {
          const isChecked = checks[step.id];
          return (
            <div key={step.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:12, background:isChecked?'#F0FDF4':C.beige, border:`1px solid ${isChecked?'#86EFAC':C.light}`, transition:'all 0.2s' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:isChecked?C.forest:C.white, border:`2px solid ${isChecked?C.forest:C.light}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:isChecked?14:18, flexShrink:0, transition:'all 0.2s' }}>
                {isChecked ? <span style={{ color:'#fff', fontWeight:700 }}>✓</span> : step.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:isChecked?C.forest:C.dark, textDecoration:isChecked?'line-through':'' }}>{step.label}</div>
                {!isChecked && <div style={{ fontSize:12, color:C.gray, marginTop:2 }}>{step.desc}</div>}
              </div>
              {!isChecked && (
                <button onClick={() => onNavigate(step.view)}
                  style={{ background:C.forest, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                  {step.action} →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
