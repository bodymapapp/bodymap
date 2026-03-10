import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function BodyMapVisual({ size = 180 }) {
  const zones = [
    { id: 'neck',      x: 88,  y: 52,  w: 24, h: 18, status: 'avoid' },
    { id: 'lshoulder', x: 52,  y: 72,  w: 32, h: 20, status: 'focus' },
    { id: 'rshoulder', x: 116, y: 72,  w: 32, h: 20, status: 'focus' },
    { id: 'upperback', x: 72,  y: 90,  w: 56, h: 22, status: 'focus' },
    { id: 'lowerback', x: 72,  y: 114, w: 56, h: 22, status: 'focus' },
    { id: 'lhip',      x: 56,  y: 138, w: 30, h: 18, status: 'note'  },
    { id: 'rhip',      x: 114, y: 138, w: 30, h: 18, status: 'neutral'},
  ];
  const colors = {
    focus:   { fill: 'rgba(82,183,136,0.28)',  stroke: '#52b788', dot: '#52b788' },
    avoid:   { fill: 'rgba(220,80,80,0.18)',   stroke: '#dc5050', dot: '#dc5050' },
    note:    { fill: 'rgba(201,168,76,0.22)',  stroke: '#c9a84c', dot: '#c9a84c' },
    neutral: { fill: 'rgba(200,200,200,0.15)', stroke: '#ccc',    dot: '#aaa'    },
  };
  return (
    <svg viewBox="0 0 200 200" style={{ width: size, height: size, display: 'block' }}>
      <ellipse cx="100" cy="36" rx="18" ry="20" fill="#e8f5ee" stroke="#b2dfc4" strokeWidth="1.5"/>
      <rect x="72" y="55" width="56" height="110" rx="12" fill="#e8f5ee" stroke="#b2dfc4" strokeWidth="1.5"/>
      <rect x="44" y="62" width="26" height="70" rx="10" fill="#e8f5ee" stroke="#b2dfc4" strokeWidth="1.5"/>
      <rect x="130" y="62" width="26" height="70" rx="10" fill="#e8f5ee" stroke="#b2dfc4" strokeWidth="1.5"/>
      <rect x="74"  y="163" width="22" height="28" rx="8" fill="#e8f5ee" stroke="#b2dfc4" strokeWidth="1.5"/>
      <rect x="104" y="163" width="22" height="28" rx="8" fill="#e8f5ee" stroke="#b2dfc4" strokeWidth="1.5"/>
      {zones.map(z => {
        const c = colors[z.status];
        return (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="6" fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>
            <circle cx={z.x + z.w - 5} cy={z.y + 5} r="3.5" fill={c.dot}/>
          </g>
        );
      })}
    </svg>
  );
}

export default function Features() {
  const [activeStep, setActiveStep] = useState(0);
  const G = { deep:'#1a3d2b', mid:'#2d6a4f', soft:'#52b788', pale:'#d8f3dc', white:'#fafaf8', card:'#f5f3ef', border:'#e8e4dd', dark:'#1c1c1c', mid2:'#4a4a4a', light:'#7a7a7a' };
  const btnPrimary = { display:'inline-flex', alignItems:'center', gap:8, background:G.mid, color:'#fff', fontSize:16, fontWeight:700, padding:'16px 32px', borderRadius:12, textDecoration:'none', boxShadow:'0 4px 16px rgba(45,106,79,0.28)', border:'none', cursor:'pointer', fontFamily:'inherit' };
  const btnGhost   = { display:'inline-flex', alignItems:'center', gap:8, background:'transparent', color:G.mid, fontSize:16, fontWeight:600, padding:'15px 28px', borderRadius:12, textDecoration:'none', border:`1.5px solid ${G.soft}`, cursor:'pointer', fontFamily:'inherit' };

  const steps = [
    {
      number: '01', time: '30 seconds, once', timeColor: G.mid,
      title: 'Sign in. Send the intake form.',
      desc: 'Your BodyMap dashboard is live the moment you sign up. Send your first client their intake form in one tap — a link they open on any phone. They handle the rest.',
      detail: 'No app install. No account for your client. Just a link that works.',
      visual: (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e8e4dd', padding:'28px', textAlign:'center' }}>
          <div style={{ fontSize:13, color:G.light, marginBottom:16 }}>Share via text or email</div>
          <div style={{ background:G.pale, borderRadius:10, padding:'14px 18px', fontSize:14, fontWeight:600, color:G.mid, marginBottom:12 }}>
            "Your intake form is ready: mybodymap.app/intake/sarah"
          </div>
          <div style={{ fontSize:12, color:G.light }}>Client taps link, done in 60 seconds — no account needed</div>
        </div>
      ),
    },
    {
      number: '02', time: 'Automatic — no effort needed', timeColor: '#c9a84c',
      title: 'Their map is waiting when you are.',
      desc: 'Once your client fills in their intake, their body map, preferences and health notes appear instantly in your dashboard. Walk in already knowing their pressure preference, focus areas, and what to avoid.',
      detail: 'No manual entry. No re-reading paper forms. It is all there before you say hello.',
      visual: (
        <div style={{ display:'flex', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e8e4dd', padding:'20px', display:'flex', gap:16, alignItems:'center', maxWidth:340 }}>
            <BodyMapVisual size={120} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color:G.light, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>Sarah M.</div>
              {[
                { c:'#1a6640', bg:'rgba(82,183,136,0.1)', b:'rgba(82,183,136,0.3)', t:'Upper back — focus' },
                { c:'#b84040', bg:'rgba(220,80,80,0.07)', b:'rgba(220,80,80,0.2)',  t:'Neck — skip' },
                { c:'#7a5f0a', bg:'rgba(201,168,76,0.1)', b:'rgba(201,168,76,0.25)',t:'Medium pressure' },
              ].map((z,i) => (
                <div key={i} style={{ background:z.bg, border:`1px solid ${z.b}`, color:z.c, borderRadius:7, padding:'4px 9px', fontSize:11, fontWeight:600, marginBottom:5 }}>{z.t}</div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      number: '03', time: 'Builds every session', timeColor: G.soft,
      title: 'BodyMap learns with every session.',
      desc: 'Recurring focus areas, patterns across visits, and preferences accumulate quietly in the background. You never have to ask the same question twice.',
      detail: 'Session 8 with Sarah feels like you have known her for years. Because now you have.',
      visual: (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #e8e4dd', padding:'24px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:G.light, marginBottom:14, textTransform:'uppercase', letterSpacing:'0.08em' }}>Pattern History — Sarah M.</div>
          {[
            { label:'L. shoulder tension', sessions:'6 of 8', pct:75, color:G.mid },
            { label:'Lower back',          sessions:'5 of 8', pct:62, color:G.soft },
            { label:'Stress-related',      sessions:'4 of 8', pct:50, color:'#c9a84c' },
          ].map((p,i) => (
            <div key={i} style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                <span style={{ fontWeight:600, color:G.dark }}>{p.label}</span>
                <span style={{ color:G.light }}>{p.sessions}</span>
              </div>
              <div style={{ background:'#f0f0ee', borderRadius:100, height:6, overflow:'hidden' }}>
                <div style={{ width:`${p.pct}%`, height:'100%', background:p.color, borderRadius:100 }}/>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const features = [
    { icon:'🗺️', title:'Visual Body Map Intake',      desc:'Clients tap directly on a body diagram to mark focus areas, pain points, and zones to avoid. No typing, no ambiguity.' },
    { icon:'📋', title:'Smart Client Profiles',        desc:'Every intake, note, and preference builds a permanent profile. Before any session, everything you need is one tap away.' },
    { icon:'📊', title:'Pattern Detection',            desc:'BodyMap surfaces recurring areas across sessions automatically — so you notice what clients themselves might not.' },
    { icon:'⚠️', title:'Lapsed Client Alerts',         desc:'Get flagged when a regular client goes quiet. Reach out at exactly the right moment, before they drift away for good.' },
    { icon:'📝', title:'Session Notes',                desc:'Log notes per session in seconds. They connect to the client profile and body map, building a complete longitudinal record.' },
    { icon:'💬', title:'Client Preferences Memory',    desc:'Music, lighting, pressure, areas to avoid — stored once, surfaced every time. No repeated questions, ever.' },
    { icon:'📱', title:'Mobile-First Design',          desc:'Works perfectly on your phone between sessions. No desktop required. Designed for how therapists actually work.' },
    { icon:'🔗', title:'Zero-Friction Client Intake',  desc:'Clients get a simple link — no app, no account, no friction. Most complete it in under 60 seconds.' },
    { icon:'🔒', title:'Enterprise-Grade Security',    desc:'All data encrypted at rest and in transit. Built on Supabase infrastructure trusted by thousands of companies.' },
    { icon:'📤', title:'Data Portability',             desc:'Your data is always yours. Export everything in one click — client list, intake history, session notes. No lock-in.' },
    { icon:'🎯', title:'Plan Enforcement Built-In',    desc:'Bronze gives you 5 clients free forever. Silver unlocks unlimited — upgrade only when you need to.' },
    { icon:'🤖', title:'AI Pre-Session Briefs',        desc:'Coming soon — a one-paragraph brief generated before each session based on the full client history.', soon:true },
  ];

  return (
    <div style={{ background:G.white, fontFamily:"'DM Sans','Helvetica Neue',sans-serif", color:G.dark }}>
      <Nav />

      {/* ══ SECTION 1 — HERO ══════════════════════════════════════════ */}
      <section style={{ background:'linear-gradient(160deg,#eef8f2 0%,#fafaf8 70%)', padding:'96px 24px 80px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:400, height:400, background:'radial-gradient(circle,rgba(82,183,136,0.1) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ maxWidth:760, margin:'0 auto', position:'relative', zIndex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:G.mid, background:'rgba(82,183,136,0.12)', border:'1px solid rgba(82,183,136,0.25)', padding:'6px 16px', borderRadius:100, display:'inline-block', marginBottom:28 }}>How BodyMap Works</div>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(32px,5vw,54px)', fontWeight:700, color:G.deep, margin:'0 0 20px', lineHeight:1.15, letterSpacing:'-0.02em' }}>
            You already put so much into every session.<br/>
            <em style={{ fontStyle:'italic', color:G.mid }}>BodyMap makes sure your clients feel all of it.</em>
          </h1>
          <p style={{ fontSize:19, color:G.mid2, lineHeight:1.6, maxWidth:580, margin:'0 auto 40px' }}>
            Your clients tell you once. Your practice remembers forever. Therapist setup: 30 seconds. Client intake: 60 seconds. Everything else: automatic.
          </p>
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={btnPrimary}>Start Free — No Card Needed</Link>
            <Link to="/demo"   style={btnGhost}>Try the Demo</Link>
          </div>
        </div>
      </section>

      {/* ══ SECTION 2 — HOW IT WORKS (3 STEPS) ═══════════════════════ */}
      <section style={{ padding:'88px 24px', background:G.white }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.mid, marginBottom:16 }}>The Setup</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,40px)', fontWeight:700, color:G.deep, margin:'0 auto', maxWidth:560, lineHeight:1.2 }}>Three steps. Then it runs itself.</h2>
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:48, flexWrap:'wrap' }}>
          {steps.map((s,i) => (
            <button key={i} onClick={() => setActiveStep(i)} style={{ background: activeStep===i ? G.deep : G.card, color: activeStep===i ? '#fff' : G.mid2, border: activeStep===i ? `1px solid ${G.deep}` : `1px solid ${G.border}`, borderRadius:100, padding:'10px 24px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' }}>
              <span style={{ opacity:0.6, marginRight:6 }}>{s.number}</span>{s.title.split('.')[0]}
            </button>
          ))}
        </div>
        <div style={{ maxWidth:1000, margin:'0 auto', display:'flex', flexWrap:'wrap', gap:48, alignItems:'center', justifyContent:'center' }}>
          <div style={{ flex:'1 1 380px', maxWidth:480 }}>
            <div style={{ display:'inline-block', fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:steps[activeStep].timeColor, background:'rgba(82,183,136,0.08)', border:`1px solid ${steps[activeStep].timeColor}44`, padding:'4px 12px', borderRadius:100, marginBottom:20 }}>{steps[activeStep].time}</div>
            <h3 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(22px,3vw,32px)', fontWeight:700, color:G.deep, margin:'0 0 16px', lineHeight:1.3 }}>{steps[activeStep].title}</h3>
            <p style={{ fontSize:17, color:G.mid2, lineHeight:1.65, marginBottom:16 }}>{steps[activeStep].desc}</p>
            <p style={{ fontSize:14, color:G.light, lineHeight:1.6, fontStyle:'italic', borderLeft:`3px solid ${G.soft}`, paddingLeft:14 }}>{steps[activeStep].detail}</p>
          </div>
          <div style={{ flex:'1 1 300px', maxWidth:400 }}>{steps[activeStep].visual}</div>
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:40 }}>
          {steps.map((_,i) => (
            <button key={i} onClick={() => setActiveStep(i)} style={{ width: activeStep===i ? 24 : 8, height:8, borderRadius:100, background: activeStep===i ? G.mid : G.border, border:'none', cursor:'pointer', transition:'all 0.3s', padding:0 }}/>
          ))}
        </div>
      </section>

      {/* ══ SECTION 3 — YOUR CLIENTS TELL YOU ONCE ════════════════════ */}
      <section style={{ background:G.deep, padding:'88px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', flexWrap:'wrap', gap:48, alignItems:'center', justifyContent:'center' }}>
          <div style={{ flex:'1 1 400px', maxWidth:520 }}>
            <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:G.soft, marginBottom:20 }}>The Promise</div>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,42px)', fontWeight:700, color:'#fff', margin:'0 0 20px', lineHeight:1.2 }}>
              Your clients tell you once.<br/><em style={{ fontStyle:'italic', color:G.soft }}>Your practice remembers forever.</em>
            </h2>
            <p style={{ fontSize:17, color:'rgba(255,255,255,0.7)', lineHeight:1.65, marginBottom:32 }}>
              No more re-asking about pressure preference. No more scanning paper notes. No more relying on memory across 40 clients. BodyMap holds it all.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {['Ask once. Remembered forever.','Patterns surface automatically — no tagging, no effort.','Walk into every session already knowing your client.'].map((text,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(82,183,136,0.2)', border:'1px solid rgba(82,183,136,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:G.soft, flexShrink:0 }}>✓</div>
                  <span style={{ fontSize:15, color:'rgba(255,255,255,0.85)', fontWeight:500 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex:'1 1 340px', maxWidth:420 }}>
            <div style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:24, padding:'28px' }}>
              <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)', marginBottom:20 }}>WHAT SARAH TOLD YOU — ONCE</div>
              {[
                { label:'Focus areas',   value:'Upper back, L. shoulder',              color:G.soft },
                { label:'Avoid',         value:'Neck — old injury',                    color:'#ef8080' },
                { label:'Pressure',      value:'Medium — never deep',                  color:'rgba(255,255,255,0.7)' },
                { label:'Music',         value:'Ambient, no lyrics',                   color:'rgba(255,255,255,0.7)' },
                { label:'Health note',   value:'High blood pressure, inform before hot stones', color:'#c9a84c' },
                { label:'Pattern noted', value:'L. shoulder — 6 of 8 sessions',        color:G.soft },
              ].map((row,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'10px 0', borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.07)' : 'none', gap:12 }}>
                  <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)', flexShrink:0 }}>{row.label}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:row.color, textAlign:'right' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 4 — EXPERIENCE BOTH SIDES ════════════════════════ */}
      <section style={{ background:G.card, padding:'88px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.mid, marginBottom:16 }}>See It In Action</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,40px)', fontWeight:700, color:G.deep, margin:'0 auto 16px', maxWidth:600, lineHeight:1.2 }}>Experience Both Sides</h2>
          <p style={{ fontSize:18, color:G.mid2, maxWidth:520, margin:'0 auto 48px', lineHeight:1.6 }}>No signup needed. See exactly what your client experiences — and what you see on your end. Most therapists sign up during the demo.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:28, maxWidth:860, margin:'0 auto 48px' }}>
          {[
            { role:'Therapist View', icon:'🧑‍⚕️', color:G.mid, bg:G.pale, points:['Full client profile before every session','Body map with focus and avoid zones','Pattern history across all sessions','Lapsed client alerts — who to follow up with','Session notes that accumulate over time'] },
            { role:'Client View',    icon:'💆',    color:'#7a5f0a', bg:'rgba(201,168,76,0.12)', points:['Simple link — no app, no account needed','Tap body diagram to mark areas','Set pressure, music, lighting preferences','Add health notes and intake history','Done in under 60 seconds'] },
          ].map(side => (
            <div key={side.role} style={{ background:'#fff', borderRadius:20, border:'1px solid #e8e4dd', padding:'32px 28px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                <div style={{ width:48, height:48, borderRadius:12, background:side.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>{side.icon}</div>
                <div style={{ fontFamily:'Georgia,serif', fontSize:20, fontWeight:700, color:G.deep }}>{side.role}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {side.points.map((pt,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background:side.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:side.color, fontWeight:700, flexShrink:0, marginTop:1 }}>✓</div>
                    <span style={{ fontSize:14, color:G.mid2, lineHeight:1.5 }}>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign:'center' }}>
          <Link to="/demo" style={btnPrimary}>Try the Demo — No Signup</Link>
          <p style={{ marginTop:16, fontSize:13, color:G.light }}>No account. No credit card. 60 seconds to see everything.</p>
        </div>
      </section>

      {/* ══ SECTION 5 — FULL FEATURE GRID ════════════════════════════ */}
      <section style={{ padding:'88px 24px', background:G.white }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.mid, marginBottom:16 }}>Everything Included</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,40px)', fontWeight:700, color:G.deep, margin:'0 auto', maxWidth:560, lineHeight:1.2 }}>Built for how massage therapists actually work.</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20, maxWidth:1100, margin:'0 auto' }}>
          {features.map(f => (
            <div key={f.title} style={{ background: f.soon ? G.card : '#fff', border:`1px solid ${G.border}`, borderRadius:16, padding:'24px 22px', position:'relative', opacity: f.soon ? 0.75 : 1 }}>
              {f.soon && <div style={{ position:'absolute', top:16, right:16, background:'#c9a84c', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:100 }}>COMING SOON</div>}
              <div style={{ fontSize:26, marginBottom:12 }}>{f.icon}</div>
              <div style={{ fontWeight:700, fontSize:15, color:G.dark, marginBottom:8 }}>{f.title}</div>
              <div style={{ fontSize:14, color:G.light, lineHeight:1.55 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ SECTION 6 — FINAL CTA ═════════════════════════════════════ */}
      <section style={{ background:G.deep, padding:'96px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', bottom:-80, right:-80, width:360, height:360, background:'radial-gradient(circle,rgba(82,183,136,0.12) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'relative', zIndex:1, maxWidth:680, margin:'0 auto' }}>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(28px,4.5vw,48px)', fontWeight:700, color:'#fff', margin:'0 0 20px', lineHeight:1.2 }}>
            Ready to make every client feel<br/><em style={{ fontStyle:'italic', color:G.soft }}>truly remembered?</em>
          </h2>
          <p style={{ fontSize:18, color:'rgba(255,255,255,0.65)', maxWidth:420, margin:'0 auto 40px', lineHeight:1.6 }}>Start free. Your first 5 clients are always free. No credit card. No time limit.</p>
          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
            <Link to="/signup" style={{ ...btnPrimary, background:'#fff', color:G.deep }}>Start Free — No Card Needed</Link>
            <Link to="/demo"   style={{ ...btnGhost, color:'rgba(255,255,255,0.85)', borderColor:'rgba(255,255,255,0.3)' }}>Try the Demo First</Link>
          </div>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Free forever on Bronze · $24 per month Silver when you are ready</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
