import React, { useState, useEffect, useRef } from 'react';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC' };

const STEPS = [
  { id:'import',  icon:'📥', label:'Move your clients over',    desc:'Import from Square, MassageBook, Vagaro or any CSV. 2 minutes, no client left behind.', action:'Import Clients', view:'import'   },
  { id:'service', icon:'🛁', label:'Add your first service',    desc:'Tell clients what you offer and at what price.',         action:'Go to Settings', view:'settings' },
  { id:'hours',   icon:'🕐', label:'Set your working hours',    desc:'Clients can only book during your available times.',     action:'Go to Settings', view:'settings' },
  { id:'stripe',  icon:'💳', label:'Connect Stripe (optional)', desc:'Accept deposits from new clients to protect your time.', action:'Go to Settings', view:'settings' },
  { id:'intake',  icon:'📋', label:'Send your first intake',    desc:'Book a client and send them the intake form. This is the moment it all clicks.', action:'Go to Clients', view:'clients' },
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
  const [collapsed, setCollapsed] = useState(false);
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

  useEffect(()=>{
    const key=`bm_onboarding_collapsed_${therapist?.id}`;
    if(localStorage.getItem(key)) setCollapsed(true);
  },[therapist?.id]);

  useEffect(()=>{
    if(prevDone.current!==null && done>prevDone.current){
      setCelebrate(true);
      setTimeout(()=>setCelebrate(false),1600);
    }
    prevDone.current=done;
  },[done]);

  function toggleCollapse(){
    const key=`bm_onboarding_collapsed_${therapist?.id}`;
    const next=!collapsed;
    if(next) localStorage.setItem(key,'1'); else localStorage.removeItem(key);
    setCollapsed(next);
  }

  if(collapsed) return(
    <button onClick={toggleCollapse} style={{display:'flex',alignItems:'center',gap:10,background:C.white,border:`1.5px solid ${C.light}`,borderRadius:12,padding:'10px 16px',marginBottom:16,cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',width:'100%',textAlign:'left'}}>
      <div style={{height:5,flex:1,background:C.light,borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${(done/total)*100}%`,background:`linear-gradient(90deg,${C.sage},${C.forest})`,borderRadius:3}}/>
      </div>
      <span style={{fontSize:12,fontWeight:700,color:C.forest,whiteSpace:'nowrap'}}>{allDone?'✅ Setup complete':`Setup ${done}/${total}`}</span>
      <span style={{fontSize:12,color:C.gray}}>▼ show</span>
    </button>
  );

  return(
    <div style={{background:C.white,border:`1.5px solid ${C.light}`,borderRadius:16,padding:20,marginBottom:20,boxShadow:'0 2px 12px rgba(42,87,65,0.08)',position:'relative',overflow:'hidden'}}>
      <Confetti active={celebrate}/>

      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:C.sage,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:3}}>Getting Started</div>
          <h3 style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:C.dark,margin:'0 0 2px'}}>
            {allDone?'🎉 You\'re all set!':`${done} of ${total} steps complete`}
          </h3>
          {!allDone&&<p style={{fontSize:12,color:C.gray,margin:0}}>Complete these to start accepting clients.</p>}
          {allDone&&<p style={{fontSize:12,color:C.sage,margin:0,fontWeight:600}}>Your practice is ready. Time to grow. 🌱</p>}
        </div>
        <button onClick={toggleCollapse} style={{background:'transparent',border:'none',color:C.gray,cursor:'pointer',fontSize:12,fontWeight:600,padding:'0 0 0 12px',whiteSpace:'nowrap'}}>▲ hide</button>
      </div>

      <div style={{height:5,background:C.light,borderRadius:3,marginBottom:16,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${(done/total)*100}%`,background:`linear-gradient(90deg,${C.sage},${C.forest})`,borderRadius:3,transition:'width 0.5s ease'}}/>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {STEPS.map(step=>{
          const isChecked=checks[step.id];
          return(
            <div key={step.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,background:isChecked?'#F0FDF4':C.beige,border:`1px solid ${isChecked?'#86EFAC':C.light}`,transition:'all 0.3s'}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:isChecked?C.forest:C.white,border:`2px solid ${isChecked?C.forest:C.light}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isChecked?13:16,flexShrink:0,transition:'all 0.3s'}}>
                {isChecked?<span style={{color:'#fff',fontWeight:700}}>✓</span>:step.icon}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:isChecked?C.forest:C.dark,textDecoration:isChecked?'line-through':'none'}}>{step.label}</div>
                {!isChecked&&<div style={{fontSize:11,color:C.gray,marginTop:1}}>{step.desc}</div>}
              </div>
              {!isChecked&&(
                <button onClick={()=>onNavigate(step.view)} style={{background:C.forest,color:'#fff',border:'none',borderRadius:8,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
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
