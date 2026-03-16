import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';
const C = {
  forest: '#2A5741', sage: '#6B9E80', beige: '#F5F0E8',
  gold: '#C9A84C', white: '#FFFFFF', dark: '#1A1A2E',
  gray: '#6B7280', lightGray: '#F3F4F6', border: '#E5E7EB'
};

// ── BODY MAP MOCKUP ──────────────────────────────────────────────────────────
function BodyMapDemo() {
  const [focusAreas, setFocusAreas] = useState(['neck','upper-back']);
  const [avoidAreas, setAvoidAreas] = useState(['knees']);
  const [mode, setMode] = useState('focus');
  const areas = [
    { id:'head', label:'Head', top:'2%', left:'42%', w:16 },
    { id:'neck', label:'Neck', top:'12%', left:'44%', w:12 },
    { id:'l-shoulder', label:'L Shoulder', top:'18%', left:'28%', w:14 },
    { id:'r-shoulder', label:'R Shoulder', top:'18%', left:'58%', w:14 },
    { id:'chest', label:'Chest', top:'26%', left:'40%', w:20 },
    { id:'upper-back', label:'Upper Back', top:'26%', left:'40%', w:20, back:true },
    { id:'lower-back', label:'Lower Back', top:'44%', left:'40%', w:20, back:true },
    { id:'abdomen', label:'Abdomen', top:'40%', left:'40%', w:20 },
    { id:'l-arm', label:'L Arm', top:'36%', left:'22%', w:12 },
    { id:'r-arm', label:'R Arm', top:'36%', left:'66%', w:12 },
    { id:'hips', label:'Hips', top:'54%', left:'38%', w:24 },
    { id:'glutes', label:'Glutes', top:'54%', left:'38%', w:24, back:true },
    { id:'l-thigh', label:'L Thigh', top:'64%', left:'34%', w:14 },
    { id:'r-thigh', label:'R Thigh', top:'64%', left:'52%', w:14 },
    { id:'knees', label:'Knees', top:'76%', left:'36%', w:12 },
    { id:'l-calf', label:'L Calf', top:'84%', left:'34%', w:12 },
    { id:'r-calf', label:'R Calf', top:'84%', left:'54%', w:12 },
  ];
  const [view, setView] = useState('front');
  const visible = areas.filter(a => view === 'back' ? a.back : !a.back);

  const toggle = (id) => {
    if (mode === 'focus') {
      setFocusAreas(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev.filter(x=>x!==id), id]);
      setAvoidAreas(prev => prev.filter(x=>x!==id));
    } else {
      setAvoidAreas(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev.filter(x=>x!==id), id]);
      setFocusAreas(prev => prev.filter(x=>x!==id));
    }
  };

  return (
    <div style={{ background:'#FFFFFF', borderRadius:20, padding:24, boxShadow:'0 8px 40px rgba(0,0,0,0.12)', maxWidth:380, margin:'0 auto' }}>
      <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:12, textAlign:'center' }}>Tap to mark your body map</div>
      <div style={{ display:'flex', gap:8, marginBottom:16, justifyContent:'center' }}>
        {['front','back'].map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{ flex:1, padding:'8px 0', borderRadius:8, border:`1.5px solid ${view===v?C.forest:C.border}`, background:view===v?C.forest:'transparent', color:view===v?'#fff':C.gray, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {v === 'front' ? '👤 Front' : '🔄 Back'}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16, justifyContent:'center' }}>
        <button onClick={()=>setMode('focus')} style={{ flex:1, padding:'8px 0', borderRadius:8, border:`1.5px solid ${mode==='focus'?C.sage:C.border}`, background:mode==='focus'?'#DCFCE7':'transparent', color:mode==='focus'?'#16A34A':C.gray, fontSize:13, fontWeight:600, cursor:'pointer' }}>🎯 Focus</button>
        <button onClick={()=>setMode('avoid')} style={{ flex:1, padding:'8px 0', borderRadius:8, border:`1.5px solid ${mode==='avoid'?'#EF4444':C.border}`, background:mode==='avoid'?'#FEE2E2':'transparent', color:mode==='avoid'?'#DC2626':C.gray, fontSize:13, fontWeight:600, cursor:'pointer' }}>⚠️ Avoid</button>
      </div>
      <div style={{ position:'relative', height:320, background:'#F9FAFB', borderRadius:12, marginBottom:16, overflow:'hidden' }}>
        <svg viewBox="0 0 100 320" style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.15 }}>
          <ellipse cx="50" cy="18" rx="10" ry="12" fill="#6B9E80"/>
          <rect x="40" y="30" width="20" height="8" rx="4" fill="#6B9E80"/>
          <rect x="28" y="38" width="44" height="60" rx="8" fill="#6B9E80"/>
          <rect x="16" y="40" width="12" height="50" rx="6" fill="#6B9E80"/>
          <rect x="72" y="40" width="12" height="50" rx="6" fill="#6B9E80"/>
          <rect x="32" y="98" width="36" height="70" rx="6" fill="#6B9E80"/>
          <rect x="30" y="168" width="16" height="80" rx="8" fill="#6B9E80"/>
          <rect x="54" y="168" width="16" height="80" rx="8" fill="#6B9E80"/>
          <rect x="30" y="248" width="14" height="50" rx="7" fill="#6B9E80"/>
          <rect x="56" y="248" width="14" height="50" rx="7" fill="#6B9E80"/>
        </svg>
        {visible.map(area => {
          const isFocus = focusAreas.includes(area.id);
          const isAvoid = avoidAreas.includes(area.id);
          return (
            <button key={area.id} onClick={()=>toggle(area.id)} style={{
              position:'absolute', top:area.top, left:`calc(${area.left} - ${area.w/2}%)`,
              width:`${area.w}%`, padding:'4px 2px', borderRadius:6,
              background: isFocus?'#DCFCE7':isAvoid?'#FEE2E2':'rgba(255,255,255,0.8)',
              border: `1.5px solid ${isFocus?'#16A34A':isAvoid?'#DC2626':'#E5E7EB'}`,
              fontSize:9, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
              color: isFocus?'#16A34A':isAvoid?'#DC2626':'#6B7280',
              zIndex:10
            }}>
              {area.label}
            </button>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {focusAreas.length > 0 && <div style={{ fontSize:11, color:'#16A34A', fontWeight:600 }}>🎯 Focus: {focusAreas.join(', ')}</div>}
        {avoidAreas.length > 0 && <div style={{ fontSize:11, color:'#DC2626', fontWeight:600 }}>⚠️ Avoid: {avoidAreas.join(', ')}</div>}
      </div>
    </div>
  );
}

// ── SCHEDULE MOCKUP ───────────────────────────────────────────────────────────
function ScheduleDemo() {
  const [selected, setSelected] = useState(null);
  const appts = [
    { time:'9:00 AM', name:'Sarah M.', duration:'60 min', status:'intake-done', focus:'Neck & Shoulders', sessions:7 },
    { time:'10:30 AM', name:'Jennifer K.', duration:'90 min', status:'pending', focus:'No intake yet', sessions:2 },
    { time:'12:00 PM', name:'Maria L.', duration:'60 min', status:'complete', focus:'Lower Back', sessions:14 },
    { time:'2:00 PM', name:'Rachel T.', duration:'60 min', status:'pending', focus:'No intake yet', sessions:1 },
    { time:'3:30 PM', name:'Amy W.', duration:'90 min', status:'intake-done', focus:'Full Back', sessions:5 },
  ];
  const STATUS = {
    'intake-done': { label:'🧭 Intake Done', bg:'#DCFCE7', color:'#16A34A' },
    'pending':     { label:'🔔 Pending',     bg:'#FEF3C7', color:'#D97706' },
    'complete':    { label:'✅ Complete',     bg:'#F3F4F6', color:'#6B7280' },
  };
  return (
    <div style={{ background:'#FFFFFF', borderRadius:20, padding:24, boxShadow:'0 8px 40px rgba(0,0,0,0.12)', maxWidth:480, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:C.dark }}>📅 Today's Schedule</div>
          <div style={{ fontSize:12, color:C.gray }}>Sunday, March 15 · 5 sessions</div>
        </div>
        <div style={{ background:'#DCFCE7', color:'#16A34A', borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:700 }}>2 ready</div>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[{l:'Today',n:5},{l:'Mon',n:2},{l:'Tue',n:3},{l:'Wed',n:1},{l:'Thu',n:4}].map((d,i)=>(
          <button key={i} onClick={()=>{}} style={{ flex:1, background:i===0?C.forest:'#F9FAFB', color:i===0?'#fff':C.gray, border:`1.5px solid ${i===0?C.forest:C.border}`, borderRadius:8, padding:'6px 4px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
            <div>{d.l}</div><div style={{ fontSize:10, opacity:0.7 }}>{d.n}</div>
          </button>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {appts.map((a,i) => {
          const sc = STATUS[a.status];
          const isSel = selected === i;
          return (
            <div key={i}>
              <div onClick={()=>setSelected(isSel?null:i)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'#F9FAFB', border:`1.5px solid ${isSel?C.forest:C.border}`, cursor:'pointer', transition:'all 0.15s', borderLeft:`3px solid ${sc.color}` }}>
                <div style={{ minWidth:60, fontSize:12, fontWeight:700, color:C.dark }}>{a.time}</div>
                <div style={{ width:32, height:32, borderRadius:'50%', background:C.forest, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>
                  {a.name.split(' ').map(w=>w[0]).join('')}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{a.name}</div>
                  <div style={{ fontSize:11, color:C.gray }}>{a.duration} · {a.focus}</div>
                </div>
                <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'3px 8px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>{sc.label}</div>
              </div>
              {isSel && (
                <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:'0 0 10px 10px', padding:'12px 16px', marginTop:-2 }}>
                  <div style={{ fontSize:12, color:'#1F2937', marginBottom:8 }}><strong>{a.sessions} sessions</strong> · Focus: {a.focus}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {a.status === 'pending' && <button style={{ background:C.sage, color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer' }}>💬 Send Intake</button>}
                    {a.status === 'intake-done' && <button style={{ background:C.forest, color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer' }}>📋 View Brief</button>}
                    {a.status === 'complete' && <button style={{ background:C.forest, color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer' }}>📄 Post-Session Brief</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BILLING MOCKUP ────────────────────────────────────────────────────────────
function BillingDemo() {
  const [view, setView] = useState('weekly');
  const weeks = [
    { label:'3w ago', expected:595, actual:510 },
    { label:'2w ago', expected:680, actual:680 },
    { label:'Last wk', expected:765, actual:710 },
    { label:'This wk', expected:850, actual:595 },
  ];
  const maxVal = Math.max(...weeks.map(w=>w.expected));
  const thisMonth = { expected:2890, actual:2495, sessions:32, rate:91 };

  return (
    <div style={{ background:'#FFFFFF', borderRadius:20, padding:24, boxShadow:'0 8px 40px rgba(0,0,0,0.12)', maxWidth:480, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:700, color:C.dark }}>💰 Billing Overview</div>
        <div style={{ display:'flex', gap:4 }}>
          {['weekly','monthly'].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:'5px 12px', borderRadius:6, border:`1.5px solid ${view===v?C.forest:C.border}`, background:view===v?C.forest:'transparent', color:view===v?'#fff':C.gray, fontSize:11, fontWeight:600, cursor:'pointer' }}>{v}</button>
          ))}
        </div>
      </div>

      {view === 'weekly' ? (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:20 }}>
            <div style={{ flex:1, background:'#F0FDF4', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:20, fontWeight:700, color:C.forest, fontFamily:'Georgia, serif' }}>$595</div>
              <div style={{ fontSize:11, color:C.gray }}>Collected this week</div>
            </div>
            <div style={{ flex:1, background:'#FEF3C7', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#D97706', fontFamily:'Georgia, serif' }}>$255</div>
              <div style={{ fontSize:11, color:C.gray }}>Pending payment</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:12, height:120, marginBottom:12 }}>
            {weeks.map((w,i)=>{
              const expH = (w.expected/maxVal)*100;
              const actH = (w.actual/w.expected)*expH;
              const isCurrent = i===3;
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                  <div style={{ fontSize:10, color:isCurrent?C.forest:C.gray, fontWeight:isCurrent?700:400, marginBottom:4 }}>${w.actual}</div>
                  <div style={{ width:'100%', display:'flex', alignItems:'flex-end', justifyContent:'center', gap:2, height:90 }}>
                    <div style={{ width:'80%', background:'#E5E7EB', borderRadius:'3px 3px 0 0', height:`${expH}px`, position:'relative' }}>
                      <div style={{ position:'absolute', bottom:0, width:'100%', background:isCurrent?C.gold:C.forest, borderRadius:'3px 3px 0 0', height:`${actH}px` }}/>
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:isCurrent?C.forest:'#9CA3AF', fontWeight:isCurrent?700:400, marginTop:4 }}>{w.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:12, fontSize:11 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:10, height:10, background:'#E5E7EB', borderRadius:2 }}/><span style={{ color:C.gray }}>Expected</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:10, height:10, background:C.forest, borderRadius:2 }}/><span style={{ color:C.gray }}>Collected</span></div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {[
              { label:'Monthly Expected', value:`$${thisMonth.expected.toLocaleString()}`, color:C.forest },
              { label:'Collected', value:`$${thisMonth.actual.toLocaleString()}`, color:'#16A34A' },
              { label:'Sessions', value:thisMonth.sessions, color:C.sage },
              { label:'Avg/Session', value:`$${thisMonth.rate}`, color:C.gold },
            ].map(s=>(
              <div key={s.label} style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:20, fontWeight:700, color:s.color, fontFamily:'Georgia, serif' }}>{s.value}</div>
                <div style={{ fontSize:11, color:C.gray }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'#F9FAFB', borderRadius:10, padding:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.dark, marginBottom:8 }}>Collection Rate</div>
            <div style={{ background:'#E5E7EB', borderRadius:99, height:8, marginBottom:4 }}>
              <div style={{ width:`${Math.round((thisMonth.actual/thisMonth.expected)*100)}%`, background:C.forest, borderRadius:99, height:8 }}/>
            </div>
            <div style={{ fontSize:11, color:C.gray }}>{Math.round((thisMonth.actual/thisMonth.expected)*100)}% collected</div>
          </div>
        </>
      )}
    </div>
  );
}

// ── AI WIDGET ─────────────────────────────────────────────────────────────────
function AIDemo() {
  const [messages, setMessages] = useState([
    { role:'assistant', content:"Hi! I'm BodyMap AI. Ask me anything about massage therapy, client retention, practice growth, or running your business. 🌿" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const PROMPTS = [
    'How do I retain clients long-term?',
    'What pressure do most clients prefer?',
    'How often should clients book?',
    'Tips for re-engaging lapsed clients?',
  ];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, loading]);

  const send = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput('');
    const updated = [...messages, { role:'user', content:q }];
    setMessages(updated);
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bodymap-ai`, {
        method:'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbnFmcmxqb2tubWVsbGJucGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NTQ0MDAsImV4cCI6MjAyNTQzMDQwMH0.mock' },
        body: JSON.stringify({ messages: updated.map(m=>({role:m.role,content:m.content})), context:'', mode:'public' })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "I'm having trouble connecting. Try again!";
      setMessages(prev => [...prev, { role:'assistant', content:reply }]);
    } catch {
      setMessages(prev => [...prev, { role:'assistant', content:"Connection issue — please try again." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ background:'#FFFFFF', borderRadius:20, boxShadow:'0 8px 40px rgba(0,0,0,0.12)', overflow:'hidden', maxWidth:520, margin:'0 auto' }}>
      <div style={{ background:C.forest, padding:'14px 20px', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🌿</div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>BodyMap AI</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>Practice intelligence assistant</div>
        </div>
        <div style={{ marginLeft:'auto', background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#fff', fontWeight:600 }}>● Live</div>
      </div>
      <div style={{ height:260, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:10 }}>
        {messages.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            {m.role==='assistant' && <div style={{ width:24, height:24, borderRadius:'50%', background:C.forest, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0, marginRight:8, marginTop:2 }}>🌿</div>}
            <div style={{ maxWidth:'80%', background:m.role==='user'?C.forest:'#F9FAFB', color:m.role==='user'?'#fff':'#1F2937', borderRadius:m.role==='user'?'16px 16px 4px 16px':'4px 16px 16px 16px', padding:'10px 14px', fontSize:13, lineHeight:1.5 }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:C.forest, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>🌿</div>
            <div style={{ background:'#F9FAFB', borderRadius:'4px 16px 16px 16px', padding:'10px 14px', display:'flex', gap:4 }}>
              {[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:'50%', background:C.sage, animation:'bounce 1.2s infinite', animationDelay:`${i*0.2}s` }}/>)}
              <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{ padding:'8px 16px', borderTop:`1px solid ${C.border}`, display:'flex', flexWrap:'wrap', gap:6 }}>
        {PROMPTS.map((p,i) => (
          <button key={i} onClick={()=>send(p)} style={{ background:'#F3F4F6', border:'none', borderRadius:20, padding:'5px 12px', fontSize:11, color:C.gray, cursor:'pointer', fontWeight:500 }}>{p}</button>
        ))}
      </div>
      <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, display:'flex', gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask anything about massage therapy..." style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:10, padding:'9px 14px', fontSize:13, outline:'none', fontFamily:'system-ui' }}/>
        <button onClick={()=>send()} disabled={!input.trim()||loading} style={{ background:input.trim()&&!loading?C.forest:'#E5E7EB', color:input.trim()&&!loading?'#fff':'#9CA3AF', border:'none', borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:600, cursor:input.trim()&&!loading?'pointer':'not-allowed' }}>↑</button>
      </div>
    </div>
  );
}

// ── PATTERN MOCKUP ────────────────────────────────────────────────────────────
function PatternDemo() {
  const patterns = [
    { area:'Lower Back', sessions:8, total:10, color:'#2A5741' },
    { area:'Neck', sessions:7, total:10, color:'#2A5741' },
    { area:'Left Shoulder', sessions:6, total:10, color:'#6B9E80' },
    { area:'Upper Back', sessions:5, total:10, color:'#6B9E80' },
    { area:'Hips', sessions:4, total:10, color:'#C9A84C' },
  ];
  const avoids = [
    { area:'Knees', sessions:9, total:10 },
    { area:'Abdomen', sessions:6, total:10 },
  ];
  return (
    <div style={{ background:'#FFFFFF', borderRadius:20, padding:24, boxShadow:'0 8px 40px rgba(0,0,0,0.12)', maxWidth:480, margin:'0 auto' }}>
      <div style={{ fontSize:16, fontWeight:700, color:C.dark, marginBottom:4 }}>📊 Pattern Intelligence — Sarah M.</div>
      <div style={{ fontSize:12, color:C.gray, marginBottom:20 }}>Based on 10 sessions · Last visit 3 days ago</div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#16A34A', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>🎯 Consistent Focus Areas</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {patterns.map(p => (
            <div key={p.area}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.dark }}>{p.area}</span>
                <span style={{ fontSize:12, color:C.gray }}>{p.sessions}/{p.total} sessions</span>
              </div>
              <div style={{ background:'#E5E7EB', borderRadius:99, height:8 }}>
                <div style={{ width:`${(p.sessions/p.total)*100}%`, background:p.color, borderRadius:99, height:8, transition:'width 1s ease' }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#DC2626', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>⚠️ Always Avoid</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {avoids.map(a => (
            <div key={a.area}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.dark }}>{a.area}</span>
                <span style={{ fontSize:12, color:'#DC2626', fontWeight:700 }}>{a.sessions}/{a.total} sessions</span>
              </div>
              <div style={{ background:'#FEE2E2', borderRadius:99, height:8 }}>
                <div style={{ width:`${(a.sessions/a.total)*100}%`, background:'#DC2626', borderRadius:99, height:8 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:'#FEF3C7', borderRadius:10, padding:'10px 14px', marginTop:16, fontSize:12, color:'#92400E' }}>
        💡 <strong>AI Insight:</strong> Sarah has escalated pressure from 3→5 over 10 sessions. Lower back is her primary chronic concern.
      </div>
    </div>
  );
}

// ── SECTION NAV ───────────────────────────────────────────────────────────────
function SectionNav() {
  const [active, setActive] = useState('intake');
  const sections = [
    { id:'intake', label:'Client Intake' },
    { id:'schedule', label:'Schedule' },
    { id:'billing', label:'Billing' },
    { id:'ai', label:'BodyMap AI' },
    { id:'patterns', label:'Pattern Intelligence' },
  ];
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin:'-40% 0px -40% 0px' });
    sections.forEach(s => { const el = document.getElementById(s.id); if(el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  return (
    <div style={{ position:'sticky', top:64, zIndex:90, background:'rgba(255,255,255,0.95)', backdropFilter:'blur(8px)', borderBottom:`1px solid ${C.border}`, padding:'0 24px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', overflowX:'auto', gap:0 }}>
        {sections.map(s => (
          <a key={s.id} href={`#${s.id}`} onClick={()=>setActive(s.id)} style={{ padding:'14px 20px', fontSize:13, fontWeight:600, color:active===s.id?C.forest:C.gray, borderBottom:active===s.id?`2px solid ${C.forest}`:'2px solid transparent', textDecoration:'none', whiteSpace:'nowrap', transition:'all 0.15s' }}>{s.label}</a>
        ))}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function Features() {
  return (
    <div style={{ fontFamily:"'Inter', system-ui, sans-serif", color:C.dark, paddingTop:64 }}>
      <Nav />

      {/* HERO */}
      <section style={{ background:`linear-gradient(135deg, ${C.forest} 0%, #1a3d2a 100%)`, padding:'100px 24px 80px', textAlign:'center' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <div style={{ display:'inline-block', background:'rgba(255,255,255,0.1)', borderRadius:20, padding:'6px 16px', fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.8)', marginBottom:24 }}>
            Everything your practice needs. Nothing it doesn't.
          </div>
          <h1 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(36px,5vw,64px)', fontWeight:700, color:'#FFFFFF', lineHeight:1.2, marginBottom:20 }}>
            The Only Tool That Knows<br/>Your Clients Better Than Memory
          </h1>
          <p style={{ fontSize:18, color:'rgba(255,255,255,0.75)', lineHeight:1.6, marginBottom:40, maxWidth:600, margin:'0 auto 40px' }}>
            Body maps. Pattern intelligence. AI insights. Schedule and billing — all in one place built exclusively for massage therapists.
          </p>
          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={{ background:C.gold, color:'#fff', padding:'16px 36px', borderRadius:50, fontSize:16, fontWeight:700, textDecoration:'none', fontFamily:'Georgia, serif' }}>Start Free — No Card Needed →</Link>
            <Link to="/pricing" style={{ background:'rgba(255,255,255,0.1)', color:'#fff', padding:'16px 36px', borderRadius:50, fontSize:16, fontWeight:600, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.3)' }}>See Pricing</Link>
          </div>
          <div style={{ marginTop:24, fontSize:13, color:'rgba(255,255,255,0.5)' }}>Free forever for up to 5 clients · Silver at $9/mo</div>
        </div>
      </section>

      <SectionNav />

      {/* INTAKE */}
      <section id="intake" style={{ padding:'100px 24px', background:'#FFFFFF' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Client Intake</div>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(28px,3vw,42px)', fontWeight:700, color:C.dark, lineHeight:1.2, marginBottom:20 }}>
              Clients Show You Exactly What They Need. Before They Walk In.
            </h2>
            <p style={{ fontSize:16, color:C.gray, lineHeight:1.7, marginBottom:32 }}>
              No more verbal back-and-forth. No more forgotten preferences. Clients tap a body map on their phone — front and back — marking exactly where to focus and what to avoid. Their preferences, pressure, music, temperature, and medical flags arrive in your dashboard before the session starts.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:32 }}>
              {['No app download. Just a link.','Works on any phone in 30 seconds','Medical flags surface automatically','Preferences carry forward every session'].map(f=>(
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:15, color:C.dark }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'#DCFCE7', color:'#16A34A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>✓</div>
                  {f}
                </div>
              ))}
            </div>
            <Link to="/demo" style={{ display:'inline-block', background:C.forest, color:'#fff', padding:'14px 28px', borderRadius:50, fontSize:15, fontWeight:600, textDecoration:'none' }}>Try Client Intake Now →</Link>
          </div>
          <div>
            <BodyMapDemo />
            <div style={{ textAlign:'center', marginTop:12, fontSize:12, color:C.gray }}>↑ This is live — tap the areas above</div>
          </div>
        </div>
      </section>

      {/* SCHEDULE */}
      <section id="schedule" style={{ padding:'100px 24px', background:C.beige }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
          <div>
            <ScheduleDemo />
            <div style={{ textAlign:'center', marginTop:12, fontSize:12, color:C.gray }}>↑ Click any appointment to expand</div>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Schedule</div>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(28px,3vw,42px)', fontWeight:700, color:C.dark, lineHeight:1.2, marginBottom:20 }}>
              Your Day at a Glance. Every Client's Status. One Screen.
            </h2>
            <p style={{ fontSize:16, color:C.gray, lineHeight:1.7, marginBottom:32 }}>
              See every appointment with real-time intake status. Who's ready. Who needs a reminder. Send intake links directly from the schedule. Open pre-session briefs in one tap. Weekly, monthly, and insight views show your practice trends over time.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:32 }}>
              {['Daily, weekly, and monthly views','One-tap SMS to send intake links','Slide-out client profile with history','Cal.com integration coming soon'].map(f=>(
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:15, color:C.dark }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'#DCFCE7', color:'#16A34A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>✓</div>
                  {f}
                </div>
              ))}
            </div>
            <Link to="/signup" style={{ display:'inline-block', background:C.forest, color:'#fff', padding:'14px 28px', borderRadius:50, fontSize:15, fontWeight:600, textDecoration:'none' }}>Get Started Free →</Link>
          </div>
        </div>
      </section>

      {/* BILLING */}
      <section id="billing" style={{ padding:'100px 24px', background:'#FFFFFF' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Billing</div>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(28px,3vw,42px)', fontWeight:700, color:C.dark, lineHeight:1.2, marginBottom:20 }}>
              Know Exactly What You're Earning. Expected vs. Actual. Always.
            </h2>
            <p style={{ fontSize:16, color:C.gray, lineHeight:1.7, marginBottom:32 }}>
              Track every session's expected and actual revenue. See your collection rate, outstanding payments, and top clients by revenue. Daily, weekly, monthly, and yearly views with business insights that help you grow. Stripe Connect coming soon for direct client payments.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:32 }}>
              {['Expected vs. actual revenue tracking','Outstanding payment alerts','Top clients by revenue','Stripe Connect for direct payments (coming soon)'].map(f=>(
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:15, color:C.dark }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'#DCFCE7', color:'#16A34A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>✓</div>
                  {f}
                </div>
              ))}
            </div>
            <Link to="/signup" style={{ display:'inline-block', background:C.forest, color:'#fff', padding:'14px 28px', borderRadius:50, fontSize:15, fontWeight:600, textDecoration:'none' }}>Start Tracking Revenue →</Link>
          </div>
          <div>
            <BillingDemo />
            <div style={{ textAlign:'center', marginTop:12, fontSize:12, color:C.gray }}>↑ Toggle between weekly and monthly views</div>
          </div>
        </div>
      </section>

      {/* AI */}
      <section id="ai" style={{ padding:'100px 24px', background:`linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)` }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:60 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>BodyMap AI</div>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(28px,3vw,48px)', fontWeight:700, color:C.dark, lineHeight:1.2, marginBottom:20 }}>
              An AI That Knows Your Practice.<br/>Not Just Massage in General.
            </h2>
            <p style={{ fontSize:16, color:C.gray, lineHeight:1.7, maxWidth:600, margin:'0 auto' }}>
              When you're logged in, BodyMap AI has access to your real client data — names, session history, body maps, revenue, patterns. Ask it anything. It answers from your actual practice.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:60, alignItems:'center' }}>
            <div>
              <AIDemo />
              <div style={{ textAlign:'center', marginTop:12, fontSize:12, color:C.gray }}>↑ This is live — ask anything about massage therapy</div>
            </div>
            <div>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {[
                  { q:'Which clients haven\'t booked in 30 days?', a:'Surfaces your lapsed clients instantly with days since last visit' },
                  { q:'Draft an SMS to re-engage Sarah', a:'Writes a personalized message using her name and session history' },
                  { q:'What are my most common focus areas?', a:'Analyzes your full session history and surfaces patterns' },
                  { q:'How is my revenue trending?', a:'Compares this month to last and identifies your top clients' },
                ].map(({q,a})=>(
                  <div key={q} style={{ background:'#FFFFFF', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:4 }}>"{q}"</div>
                    <div style={{ fontSize:13, color:C.gray }}>{a}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:24, background:'#FEF3C7', borderRadius:12, padding:'14px 18px', fontSize:13, color:'#92400E' }}>
                💡 Logged-in therapists get AI powered by their real client data. The demo above uses general massage knowledge only.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PATTERNS */}
      <section id="patterns" style={{ padding:'100px 24px', background:C.beige }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.sage, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Pattern Intelligence</div>
            <h2 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(28px,3vw,42px)', fontWeight:700, color:C.dark, lineHeight:1.2, marginBottom:20 }}>
              Know This Client Better Than They Know Themselves.
            </h2>
            <p style={{ fontSize:16, color:C.gray, lineHeight:1.7, marginBottom:32 }}>
              After a few sessions, BodyMap surfaces what your client always needs — automatically. Lower back 8 of 10 visits. Always avoids knees. Pressure creeping from 3 to 5. These are the patterns memory alone misses. No competitor has this.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:32 }}>
              {['Frequency scores per body area','Consistent avoids surface as alerts','Pressure trend tracking over time','AI-generated insight summary'].map(f=>(
                <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:15, color:C.dark }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'#DCFCE7', color:'#16A34A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>✓</div>
                  {f}
                </div>
              ))}
            </div>
            <div style={{ background:'#1A1A2E', borderRadius:12, padding:'16px 20px', marginBottom:32 }}>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:6 }}>Available on Silver plan</div>
              <div style={{ fontSize:15, color:'#FFFFFF', fontWeight:600 }}>"Pattern intelligence is what makes BodyMap irreplaceable. After 6 sessions with a client, it knows them better than I do."</div>
            </div>
            <Link to="/signup" style={{ display:'inline-block', background:C.forest, color:'#fff', padding:'14px 28px', borderRadius:50, fontSize:15, fontWeight:600, textDecoration:'none' }}>Unlock Pattern Intelligence →</Link>
          </div>
          <div>
            <PatternDemo />
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background:`linear-gradient(135deg, ${C.forest} 0%, #1a3d2a 100%)`, padding:'100px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:700, margin:'0 auto' }}>
          <h2 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(32px,4vw,52px)', fontWeight:700, color:'#FFFFFF', lineHeight:1.2, marginBottom:20 }}>
            Every massage therapist remembers every client, every time.
          </h2>
          <p style={{ fontSize:18, color:'rgba(255,255,255,0.75)', marginBottom:40 }}>
            Free forever for up to 5 clients. Silver at $9/mo — that's 18¢ per session.
          </p>
          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={{ background:C.gold, color:'#fff', padding:'18px 40px', borderRadius:50, fontSize:17, fontWeight:700, textDecoration:'none', fontFamily:'Georgia, serif' }}>Start Free — No Card Needed →</Link>
            <Link to="/pricing" style={{ background:'rgba(255,255,255,0.1)', color:'#fff', padding:'18px 40px', borderRadius:50, fontSize:17, fontWeight:600, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.3)' }}>View Pricing</Link>
          </div>
          <div style={{ marginTop:20, fontSize:13, color:'rgba(255,255,255,0.4)' }}>No credit card · Setup in 30 seconds · Cancel anytime</div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
