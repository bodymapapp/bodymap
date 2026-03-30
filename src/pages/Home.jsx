import WaitlistModal from '../components/WaitlistModal';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function BodyMapVisual({ size = 160 }) {
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
    note:    { fill: 'rgba(201,168,76,0.2)',   stroke: '#c9a84c', dot: '#c9a84c' },
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

function ClientCard() {
  const [alertPulse, setAlertPulse] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setAlertPulse(p => !p), 2500);
    return () => clearInterval(t);
  }, []);
  const zones = [
    { color: '#1a6640', bg: 'rgba(82,183,136,0.12)', border: 'rgba(82,183,136,0.35)', text: '🟢 Upper back — focus' },
    { color: '#1a6640', bg: 'rgba(82,183,136,0.12)', border: 'rgba(82,183,136,0.35)', text: '🟢 L. Shoulder — deep work' },
    { color: '#b84040', bg: 'rgba(220,80,80,0.07)',  border: 'rgba(220,80,80,0.25)',  text: '🔴 Neck — avoid' },
    { color: '#7a5f0a', bg: 'rgba(201,168,76,0.1)',  border: 'rgba(201,168,76,0.3)',  text: '🎵 Ambient music' },
    { color: '#7a5f0a', bg: 'rgba(201,168,76,0.1)',  border: 'rgba(201,168,76,0.3)',  text: '💆 Medium pressure' },
  ];
  return (
    <div style={{ background:'#fff', borderRadius:24, border:'1px solid #e8e4dd', boxShadow:'0 24px 64px rgba(0,0,0,0.10)', padding:'28px 28px 24px', maxWidth:480, width:'100%', textAlign:'left', position:'relative' }}>
      <div style={{ position:'absolute', top:-16, right:16, background: alertPulse ? '#c9a84c' : '#b8922a', color:'#fff', fontSize:12, fontWeight:700, padding:'6px 14px', borderRadius:100, boxShadow:'0 4px 14px rgba(185,139,30,0.35)', transition:'background 0.8s', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
        <span>⚠️</span> Sarah has not booked in 6 weeks — follow up?
      </div>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#aaa', marginBottom:14 }}>CLIENT INTELLIGENCE</div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
        <div style={{ width:46, height:46, borderRadius:'50%', background:'#d8f3dc', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>💆</div>
        <div>
          <div style={{ fontWeight:700, fontSize:16, color:'#1c1c1c' }}>Sarah M.</div>
          <div style={{ fontSize:13, color:'#999', marginTop:2 }}>Client since Jan 2024 · 8 sessions · Last seen 6 wks ago</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:18, alignItems:'flex-start', marginBottom:16 }}>
        <div style={{ flexShrink:0 }}><BodyMapVisual size={130} /></div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7, paddingTop:4 }}>
          {zones.map((z,i) => (
            <div key={i} style={{ background:z.bg, border:`1px solid ${z.border}`, color:z.color, borderRadius:9, padding:'6px 11px', fontSize:12, fontWeight:600 }}>{z.text}</div>
          ))}
        </div>
      </div>
      {[
        { icon:'📊', text:'L. shoulder recurring — 6 of 8 sessions', badge:'Pattern' },
        { icon:'💬', text:'"Stress from work — go deeper today"', badge:null },
      ].map((p,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:'#f5f3ef', borderRadius:10, padding:'9px 13px', fontSize:12, color:'#4a4a4a', marginBottom: i===0 ? 8 : 0 }}>
          <span>{p.icon}</span>
          <span style={{ flex:1 }}>{p.text}</span>
          {p.badge && <span style={{ background:'#2d6a4f', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100 }}>{p.badge}</span>}
        </div>
      ))}
    </div>
  );
}

function StoryCard({ initial, color, name, since, headline, body, outcome }) {
  return (
    <div style={{ background:'#fff', borderRadius:20, border:'1px solid #e8e4dd', padding:'32px 28px', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <div style={{ width:46, height:46, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, fontWeight:700, color:'#fff', flexShrink:0 }}>{initial}</div>
        <div><div style={{ fontWeight:700, fontSize:15 }}>{name}</div><div style={{ fontSize:12, color:'#999', marginTop:2 }}>{since}</div></div>
      </div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:17, fontWeight:600, color:'#1a3d2b', lineHeight:1.35, marginBottom:12 }}>{headline}</div>
      <div style={{ fontSize:14, color:'#4a4a4a', lineHeight:1.65, flex:1 }}>{body}</div>
      <div style={{ marginTop:20, padding:'10px 14px', background:'#d8f3dc', borderRadius:10, fontSize:13, fontWeight:600, color:'#2d6a4f' }}>{outcome}</div>
    </div>
  );
}

export default function Home() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const G = { deep:'#1a3d2b', mid:'#2d6a4f', soft:'#52b788', pale:'#d8f3dc', white:'#fafaf8', card:'#f5f3ef', border:'#e8e4dd', dark:'#1c1c1c', mid2:'#4a4a4a', light:'#7a7a7a' };
  const btnPrimary = { display:'inline-flex', alignItems:'center', gap:8, background:G.mid, color:'#fff', fontSize:16, fontWeight:700, padding:'16px 32px', borderRadius:12, textDecoration:'none', boxShadow:'0 4px 16px rgba(45,106,79,0.28)', border:'none', cursor:'pointer', fontFamily:'inherit' };
  const btnGhost   = { display:'inline-flex', alignItems:'center', gap:8, background:'transparent', color:G.mid, fontSize:16, fontWeight:600, padding:'15px 28px', borderRadius:12, textDecoration:'none', border:`1.5px solid ${G.soft}`, cursor:'pointer', fontFamily:'inherit' };
  const eyebrow    = { fontSize:13, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:G.mid, background:'rgba(82,183,136,0.12)', border:'1px solid rgba(82,183,136,0.25)', padding:'6px 16px', borderRadius:100, display:'inline-block', marginBottom:28 };
  return (
    <div style={{ background:G.white, fontFamily:"'DM Sans','Helvetica Neue',sans-serif", color:G.dark }}>
      <Nav />
      <section style={{ minHeight:'92vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', background:'linear-gradient(160deg,#eef8f2 0%,#fafaf8 65%)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-80, right:-80, width:500, height:500, background:'radial-gradient(circle,rgba(82,183,136,0.13) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ maxWidth:1100, width:'100%', display:'flex', flexWrap:'wrap', alignItems:'center', gap:48, justifyContent:'center', position:'relative', zIndex:1 }}>
          <div style={{ flex:'1 1 420px', maxWidth:540 }}>
            <div style={eyebrow}>Built for Massage Therapists</div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(36px,5vw,60px)', fontWeight:700, lineHeight:1.13, color:G.deep, margin:'0 0 20px', letterSpacing:'-0.02em' }}>
              Your client's full history,<br/>ready before every session.
            </h1>
            <p style={{ fontSize:'clamp(16px,2vw,20px)', color:G.mid2, lineHeight:1.6, margin:'0 0 36px', maxWidth:480 }}>
              The only tool built around what every other app ignores — knowing your clients so well, they never need to find someone else.
            </p>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:32 }}>
              <Link to="/signup" style={btnPrimary}>Start Free — No Card Needed →</Link>
              <Link to="/demo" style={btnGhost}>See How It Works</Link>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:G.light, flexWrap:'wrap' }}>
              {['Free forever on Bronze','Live in 30 seconds','No credit card'].map((t,i) => (
                <React.Fragment key={t}>
                  {i > 0 && <span style={{ width:4, height:4, borderRadius:'50%', background:'#ccc', display:'inline-block' }}/>}
                  <span>{t}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ flex:'1 1 340px', display:'flex', justifyContent:'center', paddingTop:24 }}>
            <ClientCard />
          </div>
        </div>
      </section>
      <section style={{ background:G.deep, padding:'80px 24px', textAlign:'center' }}>
        <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:G.soft, marginBottom:16 }}>The Problem</div>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(22px,3.5vw,36px)', fontWeight:600, color:'#fff', margin:'0 auto 44px', maxWidth:620, lineHeight:1.35 }}>
          You are losing clients you worked hard to earn.{' '}<em style={{ fontStyle:'italic', color:G.soft }}>Not because of your work — because they feel forgotten.</em>
        </h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:20, maxWidth:900, margin:'0 auto' }}>
          {[
            { icon:'🗂️', title:'Starting over every session',  desc:"Clients repeat their history. You take mental notes you will lose by next week. Nothing accumulates." },
            { icon:'📅', title:'Lapsed clients, zero alerts',   desc:'Your best clients go quiet. Life happens. You had no way to notice — or reach back at the right moment.' },
            { icon:'💸', title:'Revenue walking out the door',  desc:"One lost monthly client equals $600 to $1,200 per year gone. Multiply that and you are running harder just to stay in place." },
          ].map(item => (
            <div key={item.title} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'28px 24px', textAlign:'left' }}>
              <div style={{ fontSize:28, marginBottom:14 }}>{item.icon}</div>
              <div style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:8 }}>{item.title}</div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,0.55)', lineHeight:1.55 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ padding:'88px 24px', background:G.white, textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.mid, marginBottom:16 }}>The Math</div>
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,42px)', fontWeight:700, color:G.deep, margin:'0 auto 16px', maxWidth:600, lineHeight:1.2, textAlign:'center' }}>$9 in January. Still paying off in December.</h2>
        <p style={{ fontSize:18, color:G.mid2, lineHeight:1.6, maxWidth:500, margin:'0 auto 52px', textAlign:'center' }}>One client you almost lost — brought back by a single alert — pays for your entire year.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:24, maxWidth:860, margin:'0 auto 36px', alignItems:'center' }}>
          {[
            { val:'$9',     label:'One month of BodyMap Silver',                  hi:false },
            { val:'$1,200', label:'Revenue from one retained client over a year', hi:true, tag:'One returned client x 12 months' },
            { val:'133x',   label:'Return on that one month, all year long',      hi:false },
          ].map(card => (
            <div key={card.val} style={{ background:card.hi ? G.deep : G.card, border:`1px solid ${card.hi ? G.deep : G.border}`, borderRadius:20, padding:'32px 24px', textAlign:'center', transform:card.hi ? 'scale(1.05)' : 'scale(1)', boxShadow:card.hi ? '0 16px 40px rgba(26,61,43,0.2)' : 'none' }}>
              {card.tag && <div style={{ fontSize:12, fontWeight:700, color:G.soft, marginBottom:8 }}>{card.tag}</div>}
              <div style={{ fontSize:44, fontWeight:800, color:card.hi ? G.soft : G.mid, marginBottom:8 }}>{card.val}</div>
              <div style={{ fontSize:14, color:card.hi ? 'rgba(255,255,255,0.6)' : G.light, lineHeight:1.4 }}>{card.label}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize:14, color:G.light, maxWidth:480, margin:'0 auto', lineHeight:1.6 }}>That is the $9 you spent in January still paying off in December — again in January, again in December.</p>
      </section>
      <section style={{ background:'#f0f9f4', borderTop:'1px solid #c8ecd8', borderBottom:'1px solid #c8ecd8', padding:'64px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.mid, marginBottom:16 }}>See It In Action</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(24px,3.5vw,38px)', fontWeight:700, color:G.deep, margin:'0 0 16px', lineHeight:1.25 }}>Experience Both Sides</h2>
          <p style={{ fontSize:18, color:G.mid2, lineHeight:1.6, marginBottom:36 }}>No signup needed. See why clients love it — and why therapists never go back.</p>
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/demo" style={btnPrimary}>Try the Demo</Link>
            <Link to="/features" style={btnGhost}>See All Features</Link>
          </div>
          <p style={{ marginTop:20, fontSize:13, color:G.light }}>No account. No credit card. 60 seconds.</p>
        </div>
      </section>
      <section style={{ background:G.card, padding:'88px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.mid, marginBottom:16 }}>Real Moments</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,3.5vw,40px)', fontWeight:700, color:G.deep, margin:'0 auto 12px', maxWidth:640, lineHeight:1.25, textAlign:'center' }}>This is what it feels like when your therapist truly knows you.</h2>
          <p style={{ fontSize:18, color:G.light, maxWidth:460, margin:'0 auto', textAlign:'center' }}>What changes when you stop relying on memory.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24, maxWidth:1020, margin:'0 auto' }}>
          <StoryCard initial="M" color="#52b788" name="Maya" since="Regular client · 3 years" headline="She was gone 8 weeks. One BodyMap alert brought her back." body="Life got busy — new job, a move. Six weeks went by, then eight. BodyMap flagged her as quiet. Her therapist sent one text: Hey Maya, been thinking about you. Lower back still giving you trouble? She booked the next day." outcome="One text. Client retained." />
          <StoryCard initial="J" color="#2d6a4f" name="James" since="Monthly client · 1 year" headline="Every visit, he repeated himself. Until she just knew." body="He hated deep pressure on his left shoulder. Every session he would wince and say it again. Third visit with BodyMap, his therapist just said I have got you before he even sat down. He told his wife that night. His wife booked the next morning." outcome="Loyalty earned. Referral earned." />
          <StoryCard initial="P" color="#c9a84c" name="Priya" since="New client · found her person" headline="3 therapists in 2 years. BodyMap changed that." body="Good hands, all of them — but every session felt like starting over. With BodyMap, her therapist knew her patterns by session two. By session four, Priya stopped looking. She had found her person." outcome="Client stopped searching." />
        </div>
      </section>
      <section style={{ background:G.white, padding:'64px 24px', textAlign:'center', borderTop:`1px solid ${G.border}` }}>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.mid, marginBottom:28 }}>Your Clients Data Is Safe With You</div>
        <div style={{ display:'flex', gap:32, justifyContent:'center', flexWrap:'wrap', maxWidth:820, margin:'0 auto' }}>
          {[
            { icon:'🔒', title:'Enterprise-grade encryption', desc:'All data encrypted at rest and in transit. Same infrastructure used by Fortune 500 companies.' },
            { icon:'🏛️', title:'Your data. Not ours.',        desc:"Your clients intake data belongs to you. We never sell it, share it, or use it for advertising." },
            { icon:'📤', title:'Export anytime',              desc:'Your data is always yours to take. Export everything in one click — no holdbacks, no lock-in.' },
          ].map(item => (
            <div key={item.title} style={{ flex:'1 1 220px', maxWidth:260 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>{item.icon}</div>
              <div style={{ fontWeight:700, fontSize:15, color:G.dark, marginBottom:8 }}>{item.title}</div>
              <div style={{ fontSize:14, color:G.light, lineHeight:1.55 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ background:G.deep, padding:'100px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-100, left:-100, width:400, height:400, background:'radial-gradient(circle,rgba(82,183,136,0.15) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(28px,4.5vw,50px)', fontWeight:700, color:'#fff', margin:'0 auto 20px', maxWidth:680, lineHeight:1.2 }}>
            Your clients deserve to feel like{' '}<em style={{ fontStyle:'italic', color:G.soft }}>your only client.</em>
          </h2>
          <p style={{ fontSize:18, color:'rgba(255,255,255,0.65)', maxWidth:420, margin:'0 auto 40px', lineHeight:1.6 }}>Start free. Upgrade when you are ready. Your first 5 clients are always free.</p>
          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
            <Link to="/signup" style={{ ...btnPrimary, background:'#fff', color:G.deep }}>Start Free — No Card Needed</Link>
            <Link to="/demo" style={{ ...btnGhost, color:'rgba(255,255,255,0.85)', borderColor:'rgba(255,255,255,0.3)' }}>See How It Works</Link>
          </div>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Free forever on Bronze · $9 per month when you are ready to grow</p>
        </div>
      </section>
      <Footer />
      {waitlistOpen && <WaitlistModal onClose={() => setWaitlistOpen(false)} />}
    </div>
  );
}
