import WaitlistModal from '../components/WaitlistModal';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const G = {
  deep: '#0D1F17', mid: '#2A5741', soft: '#6B9E80', light: '#9CA3AF',
  mid2: '#4B5563', white: '#FFFFFF', card: '#F9FAF8', border: '#E5E7EB',
  beige: '#F5F0E8', gold: '#C9A84C',
};

// ── Carousel slides ────────────────────────────────────────────────────────
const SLIDES = [
  {
    tag: 'Client Books in 2 Taps',
    headline: 'Your booking page, live in 60 seconds.',
    sub: 'No app download. No account creation. Clients pick a service, choose a time, and confirm. Your schedule fills itself.',
    visual: (
      <div style={{ background:'#fff', borderRadius:20, padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.1)', maxWidth:360 }}>
        <div style={{ fontSize:13, fontWeight:700, color:G.soft, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:16 }}>Online Booking</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {['Swedish Massage · 60 min · $85', 'Deep Tissue · 60 min · $100', 'Hot Stone · 90 min · $130'].map((s,i) => (
            <div key={i} style={{ background:i===0?G.mid:'#F9FAFB', borderRadius:12, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', border:`1.5px solid ${i===0?G.mid:'#E5E7EB'}` }}>
              <span style={{ fontSize:13, fontWeight:600, color:i===0?'#fff':G.deep }}>{s.split('·')[0]}</span>
              <span style={{ fontSize:13, color:i===0?'rgba(255,255,255,0.8)':'#6B7280' }}>{s.split('·').slice(1).join('·')}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:16, background:'#F0FDF4', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#16A34A', fontWeight:600 }}>
          No account needed. Books in 2 taps.
        </div>
      </div>
    ),
  },
  {
    tag: 'Automated Body Map Intake',
    headline: 'Every client mapped before they arrive.',
    sub: 'After booking, clients fill their body map automatically. Focus areas, avoid zones, medical flags, preferences. All waiting for you before the session.',
    visual: (
      <div style={{ background:'#fff', borderRadius:20, padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.1)', maxWidth:360 }}>
        <div style={{ fontSize:13, fontWeight:700, color:G.soft, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Sarah M. - Intake</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
          {[{l:'Upper Back',c:'#DCFCE7',t:'#16A34A'},{l:'L. Shoulder',c:'#DCFCE7',t:'#16A34A'},{l:'Neck - avoid',c:'#FEE2E2',t:'#DC2626'},{l:'Hips',c:'#DCFCE7',t:'#16A34A'}].map(b=>(
            <span key={b.l} style={{ background:b.c, color:b.t, borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:600 }}>{b.l}</span>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[{icon:'🎵',l:'Ambient music'},{icon:'💪',l:'Medium pressure'},{icon:'🌡️',l:'Warm room'}].map(p=>(
            <div key={p.l} style={{ background:'#F9FAFB', borderRadius:8, padding:'8px 12px', fontSize:13, color:G.deep, display:'flex', gap:8 }}>
              <span>{p.icon}</span><span>{p.l}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, background:'#FFFBEB', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#92400E' }}>
          📝 "Stress from work - please go deeper today"
        </div>
      </div>
    ),
  },
  {
    tag: 'AI Pre-Session Brief',
    headline: 'Know your client before you walk in.',
    sub: 'BodyMap reads every past session and generates a 60-second brief. Tension patterns, what worked, what to avoid. Automated before every session.',
    visual: (
      <div style={{ background:'#fff', borderRadius:20, padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.1)', maxWidth:360 }}>
        <div style={{ fontSize:13, fontWeight:700, color:G.soft, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>AI Pre-Session Brief</div>
        <div style={{ background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)', borderRadius:12, padding:'14px 16px', marginBottom:12, fontSize:13, color:G.deep, lineHeight:1.6 }}>
          🧠 Sarah has a chronic left shoulder pattern across 6 of 8 sessions. Upper back tension escalating. She responds well to deep tissue on lats. Avoid neck - flagged medical.
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1, background:'#F9FAFB', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, color:G.mid }}>8</div>
            <div style={{ fontSize:11, color:'#6B7280' }}>Sessions</div>
          </div>
          <div style={{ flex:1, background:'#F9FAFB', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#D97706' }}>6w</div>
            <div style={{ fontSize:11, color:'#6B7280' }}>Since last</div>
          </div>
          <div style={{ flex:1, background:'#FEF3C7', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#D97706' }}>!</div>
            <div style={{ fontSize:11, color:'#D97706' }}>Follow up</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    tag: 'Automated Retention Alerts',
    headline: 'Catch drifting clients before they leave.',
    sub: 'BodyMap monitors every client automatically. When someone goes quiet, you get an alert with a suggested message. One text brings them back.',
    visual: (
      <div style={{ background:'#fff', borderRadius:20, padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.1)', maxWidth:360 }}>
        <div style={{ fontSize:13, fontWeight:700, color:G.soft, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>Retention Alerts</div>
        {[
          { name:'Sarah M.', weeks:6, msg:'Has not booked in 6 weeks - follow up?', color:'#FEF3C7', dot:'#D97706' },
          { name:'Maya R.', weeks:8, msg:'8 weeks since last session - at risk', color:'#FEE2E2', dot:'#DC2626' },
          { name:'Dana P.', weeks:3, msg:'Due for monthly session soon', color:'#DCFCE7', dot:'#16A34A' },
        ].map(a => (
          <div key={a.name} style={{ background:a.color, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:a.dot, flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:G.deep }}>{a.name}</div>
              <div style={{ fontSize:11, color:'#6B7280' }}>{a.msg}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop:4, fontSize:12, color:G.soft, fontWeight:600, textAlign:'center' }}>Automated. Zero effort.</div>
      </div>
    ),
  },
  {
    tag: 'Schedule Intelligence',
    headline: 'See your day at a glance. Fill every gap.',
    sub: 'Visual timeline shows your appointments at their real positions. Gap indicators show what empty slots cost you. Smart booking fills holes automatically.',
    visual: (
      <div style={{ background:'#fff', borderRadius:20, padding:28, boxShadow:'0 8px 40px rgba(0,0,0,0.1)', maxWidth:360 }}>
        <div style={{ fontSize:13, fontWeight:700, color:G.soft, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 }}>Today - Tuesday</div>
        <div style={{ position:'relative', paddingLeft:40 }}>
          {[
            { time:'9 AM', label:'Emma R.', service:'Swedish', color:'#DCFCE7', dot:'#16A34A', h:44 },
            { time:'10 AM', label:'', service:'', color:'repeating-linear-gradient(45deg,transparent,transparent 5px,#FFFBEB 5px,#FFFBEB 6px)', dot:'#F59E0B', h:44, gap:true },
            { time:'11 AM', label:'Jess M.', service:'Deep Tissue', color:'#FEF3C7', dot:'#D97706', h:44 },
            { time:'2 PM', label:'Maria L.', service:'Hot Stone', color:'#F3F4F6', dot:'#6B7280', h:44 },
          ].map((b,i) => (
            <div key={i} style={{ display:'flex', gap:10, marginBottom:4 }}>
              <div style={{ fontSize:10, color:'#9CA3AF', width:32, flexShrink:0, paddingTop:12, textAlign:'right' }}>{b.time}</div>
              <div style={{ flex:1, height:b.h, borderRadius:8, background:b.color, borderLeft:`3px solid ${b.dot}`, padding:b.gap?0:'8px 10px', display:'flex', alignItems:'center' }}>
                {!b.gap && <div><div style={{ fontSize:12, fontWeight:700, color:G.deep }}>{b.label}</div><div style={{ fontSize:10, color:'#6B7280' }}>{b.service}</div></div>}
                {b.gap && <div style={{ width:'100%', textAlign:'center', fontSize:10, fontWeight:700, color:'#D97706' }}>⚡ Gap - book a client here</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

function StoryCard({ initial, color, name, since, headline, body, outcome }) {
  return (
    <div style={{ background:G.white, borderRadius:16, padding:'28px 24px', border:`1px solid ${G.border}`, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700 }}>{initial}</div>
        <div><div style={{ fontWeight:700, color:G.deep, fontSize:14 }}>{name}</div><div style={{ fontSize:12, color:G.light }}>{since}</div></div>
      </div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:16, fontWeight:600, color:G.deep, lineHeight:1.4 }}>{headline}</div>
      <div style={{ fontSize:14, color:G.mid2, lineHeight:1.65 }}>{body}</div>
      <div style={{ fontSize:12, fontWeight:700, color:G.soft, borderTop:`1px solid ${G.border}`, paddingTop:10 }}>{outcome}</div>
    </div>
  );
}

export default function Home() {
  const [slide, setSlide] = useState(0);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s+1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', background:G.white }}>
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ minHeight:'92vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px 60px', background:'linear-gradient(160deg,#eef8f2 0%,#fafaf8 65%)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-80, right:-80, width:500, height:500, borderRadius:'50%', background:'rgba(107,158,128,0.07)', pointerEvents:'none' }}/>
        <div style={{ maxWidth:1100, width:'100%', display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' }} className="bm-home-hero-grid">
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(42,87,65,0.08)', borderRadius:20, padding:'6px 14px', marginBottom:24 }}>
              <span style={{ fontSize:12, fontWeight:700, color:G.mid, textTransform:'uppercase', letterSpacing:'0.08em' }}>Built by therapists, for therapists</span>
            </div>
            <h1 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(36px,5vw,58px)', fontWeight:700, lineHeight:1.1, color:G.deep, margin:'0 0 20px', letterSpacing:'-0.02em' }}>
              Your client's full history,<br/>ready before<br/><em style={{ fontStyle:'italic', color:G.soft }}>every session.</em>
            </h1>
            <p style={{ fontSize:18, color:G.mid2, lineHeight:1.65, margin:'0 0 32px', maxWidth:480 }}>
              The only practice tool built around client retention. Automated booking, intake, reminders, and AI session briefs. Free forever on Bronze.
            </p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
              <Link to="/signup" style={{ background:G.mid, color:'#fff', borderRadius:12, padding:'15px 28px', fontSize:15, fontWeight:700, textDecoration:'none', display:'inline-block' }}>
                Start Free - No Card Needed
              </Link>
              <Link to="/features" style={{ background:'transparent', color:G.mid, border:`2px solid ${G.mid}`, borderRadius:12, padding:'15px 28px', fontSize:15, fontWeight:700, textDecoration:'none', display:'inline-block' }}>
                See How It Works
              </Link>
            </div>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              {['Free forever on Bronze', 'Live in 30 seconds', 'No credit card'].map(t => (
                <span key={t} style={{ fontSize:13, color:G.soft, display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ color:G.soft }}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>
          {/* Client Intelligence Card */}
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', top:-16, right:-8, background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:12, padding:'8px 14px', fontSize:12, fontWeight:700, color:'#92400E', zIndex:2, boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
              ⚠️ Sarah has not booked in 6 weeks - follow up?
            </div>
            <div style={{ background:G.white, borderRadius:20, padding:28, boxShadow:'0 16px 48px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:G.light, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:16 }}>Client Intelligence</div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'#52b788', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700 }}>SM</div>
                <div>
                  <div style={{ fontWeight:700, color:G.deep, fontSize:15 }}>Sarah M.</div>
                  <div style={{ fontSize:12, color:G.light }}>Client since Jan 2024 - 8 sessions - Last seen 6 wks ago</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {[{l:'Upper back - focus',c:'#DCFCE7',t:'#16A34A'},{l:'L. Shoulder - deep work',c:'#DCFCE7',t:'#16A34A'},{l:'Neck - avoid',c:'#FEE2E2',t:'#DC2626'},{l:'Ambient music',c:'#F5F0E8',t:'#92400E'},{l:'Medium pressure',c:'#F5F0E8',t:'#92400E'}].map(b=>(
                  <div key={b.l} style={{ background:b.c, borderRadius:8, padding:'8px 12px', fontSize:13, fontWeight:600, color:b.t }}>{b.l}</div>
                ))}
              </div>
              <div style={{ background:'#F9FAFB', borderRadius:8, padding:'8px 12px', fontSize:12, color:G.mid2, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span>L. shoulder recurring - 6 of 8 sessions</span>
                <span style={{ background:G.mid, color:'#fff', borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700 }}>Pattern</span>
              </div>
              <div style={{ background:'#F9FAFB', borderRadius:8, padding:'8px 12px', fontSize:12, color:G.mid2 }}>
                "Stress from work - go deeper today"
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE PAIN POINTS ─────────────────────────────────────────────── */}
      <section style={{ background:G.deep, padding:'80px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.soft, marginBottom:16 }}>Sound familiar?</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,42px)', fontWeight:700, color:'#fff', margin:'0 auto 48px', maxWidth:640, lineHeight:1.2 }}>
            It is 9am on a Tuesday. You have a gap in your schedule.
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {[
              { icon:'💸', title:'Revenue walking out the door', desc:'One lost monthly client is $600 to $1,200 per year gone. You had no idea they were drifting until they stopped booking.' },
              { icon:'📋', title:'Starting over every session', desc:'New client fills out a paper form. Regular client tells you the same thing again. You are spending 10 minutes remembering what you already know.' },
              { icon:'📱', title:'Chasing bookings manually', desc:'Texting reminders. Following up on no-shows. Calling to confirm. You became a therapist, not a scheduler.' },
            ].map(item => (
              <div key={item.title} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'28px 24px', textAlign:'left' }}>
                <div style={{ fontSize:28, marginBottom:14 }}>{item.icon}</div>
                <div style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:8 }}>{item.title}</div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAROUSEL ──────────────────────────────────────────────────────── */}
      <section style={{ padding:'88px 24px', background:G.white }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.soft, marginBottom:12 }}>How It Works</div>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,40px)', fontWeight:700, color:G.deep, margin:'0 auto', maxWidth:600, lineHeight:1.2 }}>
              Everything automated. Nothing to remember.
            </h2>
          </div>

          {/* Slide tabs */}
          <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginBottom:40 }}>
            {SLIDES.map((s,i) => (
              <button key={i} onClick={() => setSlide(i)}
                style={{ padding:'8px 16px', borderRadius:20, border:`1.5px solid ${i===slide?G.mid:G.border}`, background:i===slide?G.mid:'transparent', color:i===slide?'#fff':G.mid2, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>
                {s.tag}
              </button>
            ))}
          </div>

          {/* Slide content */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center', minHeight:360 }} className="bm-home-feature-grid">
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:G.soft, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>{SLIDES[slide].tag}</div>
              <h3 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(22px,3vw,34px)', fontWeight:700, color:G.deep, margin:'0 0 16px', lineHeight:1.2 }}>{SLIDES[slide].headline}</h3>
              <p style={{ fontSize:16, color:G.mid2, lineHeight:1.7, margin:'0 0 28px' }}>{SLIDES[slide].sub}</p>
              <Link to="/signup" style={{ background:G.mid, color:'#fff', borderRadius:10, padding:'13px 24px', fontSize:14, fontWeight:700, textDecoration:'none', display:'inline-block' }}>
                Start Free Today
              </Link>
            </div>
            <div style={{ display:'flex', justifyContent:'center' }}>
              {SLIDES[slide].visual}
            </div>
          </div>

          {/* Dots */}
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:32 }}>
            {SLIDES.map((_,i) => (
              <button key={i} onClick={() => setSlide(i)}
                style={{ width:i===slide?24:8, height:8, borderRadius:4, background:i===slide?G.mid:G.border, border:'none', cursor:'pointer', transition:'all 0.3s', padding:0 }}/>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY BODYMAP ───────────────────────────────────────────────────── */}
      <section style={{ padding:'88px 24px', background:G.card, textAlign:'center' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.soft, marginBottom:16 }}>Why BodyMap</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(26px,4vw,40px)', fontWeight:700, color:G.deep, margin:'0 auto 16px', maxWidth:640, lineHeight:1.2 }}>
            You vs. the therapist down the street.
          </h2>
          <p style={{ fontSize:17, color:G.mid2, maxWidth:520, margin:'0 auto 48px', lineHeight:1.6 }}>
            Same skills. Same training. The difference is what happens between sessions.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3, maxWidth:820, margin:'0 auto', borderRadius:16, overflow:'hidden' }} className="bm-home-compare-grid">
            <div style={{ background:'#FEF2F2', padding:'20px 24px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#DC2626', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.06em' }}>Without BodyMap</div>
              {[
                'Client drifts away - you find out when they stop booking',
                'New clients repeat intake every visit',
                'You send reminders manually',
                'Schedule has dead gaps costing you $85 each',
                'No idea which clients are at risk',
              ].map(t => (
                <div key={t} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:10 }}>
                  <span style={{ color:'#DC2626', flexShrink:0, marginTop:2 }}>✕</span>
                  <span style={{ fontSize:14, color:'#7F1D1D', lineHeight:1.5 }}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ background:'#F0FDF4', padding:'20px 24px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#16A34A', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.06em' }}>With BodyMap</div>
              {[
                'Automated alert catches drifting clients before they leave',
                'Full history ready before every session, automatically',
                'Reminders send themselves 24h before every session',
                'Smart booking fills gaps and maximizes your day',
                'Retention intelligence monitors every client automatically',
              ].map(t => (
                <div key={t} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:10 }}>
                  <span style={{ color:'#16A34A', flexShrink:0, marginTop:2 }}>✓</span>
                  <span style={{ fontSize:14, color:'#14532D', lineHeight:1.5 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STORY CARDS ───────────────────────────────────────────────────── */}
      <section style={{ background:G.white, padding:'88px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.soft, marginBottom:12 }}>Six Reasons Therapists Never Go Back</div>
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(24px,3.5vw,38px)', fontWeight:700, color:G.deep, margin:0, lineHeight:1.25 }}>Real stories. Real practices.</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:24 }}>
            <StoryCard initial="M" color="#52b788" name="Maya" since="Regular client - 3 years" headline="She was gone 8 weeks. One BodyMap alert brought her back." body="Life got busy - new job, a move. Six weeks went by, then eight. BodyMap flagged her as quiet. Her therapist sent one text: Hey Maya, been thinking about you. Lower back still giving you trouble? She booked the next day." outcome="One text. Client retained." />
            <StoryCard initial="J" color="#2d6a4f" name="James" since="Monthly client - 1 year" headline="Every visit, he repeated himself. Until she just knew." body="He hated deep pressure on his left shoulder. Every session he would wince and say it again. Third visit with BodyMap, his therapist just said I have got you before he even sat down. He told his wife that night. His wife booked the next morning." outcome="Loyalty earned. Referral earned." />
            <StoryCard initial="P" color="#c9a84c" name="Priya" since="New client - found her person" headline="3 therapists in 2 years. BodyMap changed that." body="Good hands, all of them - but every session felt like starting over. With BodyMap, her therapist knew her patterns by session two. By session four, Priya stopped looking. She had found her person." outcome="Client stopped searching." />
          </div>
        </div>
      </section>

      {/* ── FREE FOREVER CTA ──────────────────────────────────────────────── */}
      <section style={{ background:G.deep, padding:'100px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:600, height:600, borderRadius:'50%', background:'rgba(107,158,128,0.07)', pointerEvents:'none' }}/>
        <div style={{ maxWidth:640, margin:'0 auto', position:'relative' }}>
          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:G.soft, marginBottom:20 }}>Get Started</div>
          <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(30px,5vw,52px)', fontWeight:700, color:'#fff', margin:'0 0 20px', lineHeight:1.15 }}>
            Your practice deserves<br/>better tools. Free ones.
          </h2>
          <p style={{ fontSize:17, color:'rgba(255,255,255,0.65)', margin:'0 0 36px', lineHeight:1.7 }}>
            Every tool on this page is free on Bronze. No credit card. No trial. No upgrade required. Start today and your first client can book in the next 5 minutes.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
            <Link to="/signup" style={{ background:'#fff', color:G.deep, borderRadius:12, padding:'16px 32px', fontSize:16, fontWeight:700, textDecoration:'none' }}>
              Start Free - No Card Needed
            </Link>
            <Link to="/pricing" style={{ background:'transparent', color:'rgba(255,255,255,0.8)', border:'1.5px solid rgba(255,255,255,0.3)', borderRadius:12, padding:'16px 28px', fontSize:15, fontWeight:600, textDecoration:'none' }}>
              See Pricing
            </Link>
          </div>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)', margin:0 }}>
            Free forever on Bronze. Upgrade to Silver when your data has something to tell you.
          </p>
        </div>
      </section>

      <Footer />
      {waitlistOpen && <WaitlistModal onClose={() => setWaitlistOpen(false)} />}
    </div>
  );
}
