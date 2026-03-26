// src/components/BillingDashboard.js
import React, { useState, useEffect, useMemo } from 'react';

const TODAY = new Date();
TODAY.setHours(0,0,0,0);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtShort = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtMonth = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const currency = (n) => `$${Number(n).toFixed(0)}`;

const DEFAULT_RATE = 85;

const SAMPLE_SESSIONS = [
  { id:1,  client:'Sarah M.',     date:addDays(TODAY,0),   time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:2,  client:'Jennifer K.',  date:addDays(TODAY,0),   time:'10:30 AM', duration:90, rate:110,          actual:null,         status:'pending' },
  { id:3,  client:'Maria L.',     date:addDays(TODAY,0),   time:'12:00 PM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:4,  client:'Rachel T.',    date:addDays(TODAY,0),   time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:null,         status:'pending' },
  { id:5,  client:'Amy W.',       date:addDays(TODAY,0),   time:'3:30 PM',  duration:90, rate:110,          actual:null,         status:'pending' },
  { id:6,  client:'Dana P.',      date:addDays(TODAY,-1),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:7,  client:'Christine B.', date:addDays(TODAY,-1),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:8,  client:'Monica G.',    date:addDays(TODAY,-1),  time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:9,  client:'Tanya R.',     date:addDays(TODAY,-2),  time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:10, client:'Lisa N.',      date:addDays(TODAY,-2),  time:'1:00 PM',  duration:90, rate:110,          actual:100,          status:'paid' },
  { id:11, client:'Sarah M.',     date:addDays(TODAY,-2),  time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:0,            status:'waived' },
  { id:12, client:'Jennifer K.',  date:addDays(TODAY,-3),  time:'9:30 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:13, client:'Maria L.',     date:addDays(TODAY,-3),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:14, client:'Amy W.',       date:addDays(TODAY,-4),  time:'10:00 AM', duration:90, rate:110,          actual:110,          status:'paid' },
  { id:15, client:'Rachel T.',    date:addDays(TODAY,-4),  time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:null,         status:'outstanding' },
  { id:16, client:'Monica G.',    date:addDays(TODAY,-5),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:17, client:'Dana P.',      date:addDays(TODAY,-6),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:18, client:'Christine B.', date:addDays(TODAY,-7),  time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:19, client:'Sarah M.',     date:addDays(TODAY,-8),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:20, client:'Tanya R.',     date:addDays(TODAY,-9),  time:'1:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:21, client:'Lisa N.',      date:addDays(TODAY,-10), time:'3:00 PM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:22, client:'Monica G.',    date:addDays(TODAY,-11), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:23, client:'Maria L.',     date:addDays(TODAY,-12), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:24, client:'Jennifer K.',  date:addDays(TODAY,-13), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:25, client:'Amy W.',       date:addDays(TODAY,-14), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:26, client:'Sarah M.',     date:addDays(TODAY,-16), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:27, client:'Dana P.',      date:addDays(TODAY,-17), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:28, client:'Christine B.', date:addDays(TODAY,-18), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:29, client:'Monica G.',    date:addDays(TODAY,-20), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:30, client:'Tanya R.',     date:addDays(TODAY,-21), time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:31, client:'Sarah M.',     date:addDays(TODAY,-25), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:32, client:'Maria L.',     date:addDays(TODAY,-26), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:33, client:'Jennifer K.',  date:addDays(TODAY,-28), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:34, client:'Amy W.',       date:addDays(TODAY,-30), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:35, client:'Monica G.',    date:addDays(TODAY,-35), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:36, client:'Dana P.',      date:addDays(TODAY,-40), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:37, client:'Christine B.', date:addDays(TODAY,-45), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:38, client:'Tanya R.',     date:addDays(TODAY,-50), time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:39, client:'Sarah M.',     date:addDays(TODAY,-55), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:40, client:'Maria L.',     date:addDays(TODAY,-60), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:41, client:'Monica G.',    date:addDays(TODAY,-65), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:42, client:'Lisa N.',      date:addDays(TODAY,-70), time:'1:00 PM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:43, client:'Jennifer K.',  date:addDays(TODAY,-75), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:44, client:'Amy W.',       date:addDays(TODAY,-80), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:45, client:'Sarah M.',     date:addDays(TODAY,-85), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:46, client:'Dana P.',      date:addDays(TODAY,-90), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:47, client:'Christine B.', date:addDays(TODAY,-95), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:48, client:'Tanya R.',     date:addDays(TODAY,-100),time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:49, client:'Monica G.',    date:addDays(TODAY,-110),time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:50, client:'Sarah M.',     date:addDays(TODAY,-120),time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
];

const STATUS_CFG = {
  paid:        { label:'✅ Paid',        bg:'#DCFCE7', color:'#16A34A' },
  pending:     { label:'⏳ Pending',     bg:'#FEF3C7', color:'#D97706' },
  outstanding: { label:'🔴 Outstanding', bg:'#FEE2E2', color:'#DC2626' },
  waived:      { label:'🎁 Waived',      bg:'#F3F4F6', color:'#6B7280' },
};

function StatCard({ label, value, sub, color, small }) {
  return (
    <div style={{ background:'#FFFFFF', borderRadius:12, padding:'20px 24px', flex:1, minWidth:140, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize:small?22:28, fontWeight:700, color:color||'#2A5741', fontFamily:'Georgia, serif' }}>{value}</div>
      <div style={{ fontSize:13, fontWeight:600, color:'#1F2937', marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function SessionRow({ s }) {
  const sc = STATUS_CFG[s.status];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#FFFFFF', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', flexWrap:'wrap' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', background:'#2A5741', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
        {s.client.split(' ').map(w=>w[0]).join('')}
      </div>
      <div style={{ flex:1, minWidth:100 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937' }}>{s.client}</div>
        <div style={{ fontSize:12, color:'#6B7280' }}>{fmtShort(s.date)} · {s.time} · {s.duration}min</div>
      </div>
      <div style={{ textAlign:'right', minWidth:80 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937' }}>{s.actual !== null ? currency(s.actual) : '—'}</div>
        <div style={{ fontSize:11, color:'#9CA3AF' }}>Expected: {currency(s.rate)}</div>
      </div>
      <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>{sc.label}</div>
    </div>
  );
}

function EmptyBillingState() {
  return (
    <div style={{ background:'#FFFFFF', borderRadius:16, padding:'48px 32px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>💳</div>
      <div style={{ fontSize:18, fontWeight:700, color:'#1F2937', marginBottom:8 }}>No payments recorded yet</div>
      <div style={{ fontSize:14, color:'#6B7280', maxWidth:320, margin:'0 auto 24px' }}>
        Your Stripe account is connected. Payments from your clients will appear here automatically after your first session.
      </div>
      <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'12px 20px', display:'inline-block', fontSize:13, color:'#16A34A', fontWeight:600 }}>
        ✅ Stripe Connected — Ready to receive payments
      </div>
    </div>
  );
}

function SampleDataBanner() {
  return (
    <div style={{ background:'#FFF7ED', border:'1.5px dashed #F97316', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#9A3412', display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:16 }}>👁️</span>
      <div>
        <strong>Sample data — for preview only.</strong> Connect Stripe in Settings to track your real payments here. Your actual revenue will replace this preview automatically.
      </div>
    </div>
  );
}

function DailyView({ sessions }) {
  const [dayOffset, setDayOffset] = useState(0);
  const days = [-2,-1,0,1,2].map(n=>addDays(TODAY,n));
  const selectedDate = addDays(TODAY, dayOffset - 2);
  const daySessions = sessions.filter(s => sameDay(s.date, selectedDate));
  const expected = daySessions.reduce((s,x)=>s+x.rate,0);
  const actual = daySessions.reduce((s,x)=>s+(x.actual||0),0);
  const pending = daySessions.filter(s=>s.status==='pending'||s.status==='outstanding').length;
  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <StatCard label="Expected Revenue" value={currency(expected)} sub={`${daySessions.length} sessions`} color="#2A5741" />
        <StatCard label="Actual Collected" value={currency(actual)} sub="confirmed payments" color="#16A34A" />
        <StatCard label="Pending" value={pending} sub="awaiting payment" color="#D97706" />
        <StatCard label="Collection Rate" value={expected>0?`${Math.round((actual/expected)*100)}%`:'—'} sub="actual vs expected" color="#6B9E80" />
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {days.map((d,i) => {
          const isSel = i === dayOffset;
          const count = sessions.filter(s=>sameDay(s.date,d)).length;
          const label = sameDay(d,TODAY)?'Today':sameDay(d,addDays(TODAY,-1))?'Yesterday':sameDay(d,addDays(TODAY,1))?'Tomorrow':fmtShort(d);
          return (
            <button key={i} onClick={()=>setDayOffset(i)} style={{ background:isSel?'#2A5741':'#FFFFFF', color:isSel?'#FFFFFF':'#1F2937', border:`1.5px solid ${isSel?'#2A5741':'#E5E7EB'}`, borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <div>{label}</div>
              <div style={{ fontSize:11, opacity:0.75, marginTop:2 }}>{count} session{count!==1?'s':''}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
        {fmtShort(selectedDate)} — {daySessions.length} session{daySessions.length!==1?'s':''}
      </div>
      {daySessions.length === 0
        ? <div style={{ background:'#FFFFFF', borderRadius:12, padding:32, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No sessions on this day.</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{daySessions.map(s=><SessionRow key={s.id} s={s} />)}</div>
      }
    </div>
  );
}

function WeeklyView({ sessions }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const getMonday = (d) => { const x=new Date(d); const day=x.getDay(); x.setDate(x.getDate()+(day===0?-6:1-day)); x.setHours(0,0,0,0); return x; };
  const weekStart = addDays(getMonday(TODAY), weekOffset*7);
  const weekDays = [0,1,2,3,4,5,6].map(n=>addDays(weekStart,n));
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const weekSessions = sessions.filter(s=>s.date>=weekStart&&s.date<addDays(weekStart,7));
  const expected = weekSessions.reduce((s,x)=>s+x.rate,0);
  const actual = weekSessions.reduce((s,x)=>s+(x.actual||0),0);
  const maxDay = Math.max(...weekDays.map(d=>sessions.filter(s=>sameDay(s.date,d)).reduce((t,x)=>t+x.rate,0)),1);
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>setWeekOffset(weekOffset-1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>← Prev</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#1F2937' }}>{weekOffset===0?'This Week':weekOffset===-1?'Last Week':weekOffset===1?'Next Week':fmtShort(weekStart)}</div>
          <div style={{ fontSize:12, color:'#6B7280' }}>{weekSessions.length} sessions</div>
        </div>
        <button onClick={()=>setWeekOffset(weekOffset+1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>Next →</button>
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <StatCard label="Expected" value={currency(expected)} sub="this week" color="#2A5741" />
        <StatCard label="Collected" value={currency(actual)} sub="confirmed" color="#16A34A" />
        <StatCard label="Sessions" value={weekSessions.length} sub="total" color="#6B9E80" />
        <StatCard label="Avg/Session" value={weekSessions.length>0?currency(actual/weekSessions.length):'—'} sub="collected" color="#C9A84C" small />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, marginBottom:24 }}>
        {weekDays.map((d,i) => {
          const dayRev = sessions.filter(s=>sameDay(s.date,d)).reduce((t,x)=>t+(x.actual||0),0);
          const dayExp = sessions.filter(s=>sameDay(s.date,d)).reduce((t,x)=>t+x.rate,0);
          const isToday = sameDay(d,TODAY);
          const barH = Math.max((dayExp/maxDay)*100,dayExp>0?6:0);
          const actH = dayExp>0?Math.max((dayRev/dayExp)*barH,0):0;
          return (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ fontSize:11, fontWeight:700, color:isToday?'#2A5741':'#9CA3AF', textTransform:'uppercase', marginBottom:4 }}>{DAY_NAMES[i]}</div>
              <div style={{ fontSize:10, color:isToday?'#2A5741':'#9CA3AF', marginBottom:8 }}>{d.getDate()}</div>
              <div style={{ width:'100%', height:100, display:'flex', alignItems:'flex-end', justifyContent:'center', gap:3 }}>
                <div style={{ width:'42%', background:'#E5E7EB', borderRadius:'3px 3px 0 0', height:`${barH}px`, position:'relative' }}>
                  <div style={{ position:'absolute', bottom:0, width:'100%', background:'#2A5741', borderRadius:'3px 3px 0 0', height:`${actH}px` }} />
                </div>
              </div>
              {dayExp > 0 && <div style={{ fontSize:10, color:'#6B7280', marginTop:4 }}>{currency(dayExp)}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:16, marginBottom:12, fontSize:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#E5E7EB', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Expected</span></div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#2A5741', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Collected</span></div>
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>All Sessions This Week</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{weekSessions.length===0?<div style={{ color:'#9CA3AF', fontSize:14, textAlign:'center', padding:24 }}>No sessions this week.</div>:weekSessions.map(s=><SessionRow key={s.id} s={s} />)}</div>
    </div>
  );
}

function MonthlyView({ sessions }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const viewMonth = new Date(TODAY.getFullYear(), TODAY.getMonth()+monthOffset, 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const startOffset = firstDayOfWeek===0?6:firstDayOfWeek-1;
  const calDays = [];
  for(let i=0;i<startOffset;i++) calDays.push(null);
  for(let i=1;i<=daysInMonth;i++) calDays.push(new Date(viewMonth.getFullYear(),viewMonth.getMonth(),i));
  const monthSessions = sessions.filter(s=>s.date.getMonth()===viewMonth.getMonth()&&s.date.getFullYear()===viewMonth.getFullYear());
  const monthExpected = monthSessions.reduce((t,x)=>t+x.rate,0);
  const monthActual = monthSessions.reduce((t,x)=>t+(x.actual||0),0);
  const selectedDaySessions = sessions.filter(s=>sameDay(s.date,selectedDate));
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>setMonthOffset(monthOffset-1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>← Prev</button>
        <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>{fmtMonth(viewMonth)}</div>
        <button onClick={()=>setMonthOffset(monthOffset+1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>Next →</button>
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="Monthly Expected" value={currency(monthExpected)} sub={`${monthSessions.length} sessions`} color="#2A5741" />
        <StatCard label="Monthly Collected" value={currency(monthActual)} sub="confirmed payments" color="#16A34A" />
        <StatCard label="Collection Rate" value={monthExpected>0?`${Math.round((monthActual/monthExpected)*100)}%`:'—'} sub="actual vs expected" color="#6B9E80" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
          <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', padding:'4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:20 }}>
        {calDays.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const dayRev = sessions.filter(s=>sameDay(s.date,d)).reduce((t,x)=>t+(x.actual||0),0);
          const dayExp = sessions.filter(s=>sameDay(s.date,d)).reduce((t,x)=>t+x.rate,0);
          const isToday = sameDay(d,TODAY);
          const isSel = sameDay(d,selectedDate);
          return (
            <div key={i} onClick={()=>setSelectedDate(d)} style={{ minHeight:60, padding:6, borderRadius:8, cursor:'pointer', background:isSel?'#2A5741':isToday?'#F0FDF4':'#FFFFFF', border:`1.5px solid ${isSel?'#2A5741':isToday?'#16A34A':'#E5E7EB'}` }}>
              <div style={{ fontSize:12, fontWeight:600, color:isSel?'#FFFFFF':isToday?'#16A34A':'#6B7280', marginBottom:2 }}>{d.getDate()}</div>
              {dayExp>0&&<div style={{ fontSize:11, fontWeight:700, color:isSel?'#DCFCE7':'#2A5741' }}>{currency(dayRev)}</div>}
              {dayExp>0&&<div style={{ fontSize:10, color:isSel?'rgba(255,255,255,0.6)':'#9CA3AF' }}>of {currency(dayExp)}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
        {fmtShort(selectedDate)} — {selectedDaySessions.length} session{selectedDaySessions.length!==1?'s':''}
      </div>
      {selectedDaySessions.length===0
        ?<div style={{ background:'#FFFFFF', borderRadius:12, padding:24, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No sessions. Click a day to view.</div>
        :<div style={{ display:'flex', flexDirection:'column', gap:8 }}>{selectedDaySessions.map(s=><SessionRow key={s.id} s={s}/>)}</div>
      }
    </div>
  );
}

function YearlyView({ sessions }) {
  const [year, setYear] = useState(TODAY.getFullYear());
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthData = MONTH_NAMES.map((name,i)=>{
    const ms = sessions.filter(s=>s.date.getFullYear()===year&&s.date.getMonth()===i);
    return { name, expected:ms.reduce((t,x)=>t+x.rate,0), actual:ms.reduce((t,x)=>t+(x.actual||0),0), count:ms.length };
  });
  const maxVal = Math.max(...monthData.map(m=>m.expected),1);
  const yearExpected = monthData.reduce((t,m)=>t+m.expected,0);
  const yearActual = monthData.reduce((t,m)=>t+m.actual,0);
  const yearSessions = monthData.reduce((t,m)=>t+m.count,0);
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>setYear(year-1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>← {year-1}</button>
        <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>{year}</div>
        <button onClick={()=>setYear(year+1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>{year+1} →</button>
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <StatCard label="Annual Expected" value={currency(yearExpected)} sub={`${yearSessions} sessions`} color="#2A5741" />
        <StatCard label="Annual Collected" value={currency(yearActual)} sub="confirmed payments" color="#16A34A" />
        <StatCard label="Avg/Month" value={currency(yearActual/12)} sub="collected" color="#6B9E80" small />
        <StatCard label="Avg/Session" value={yearSessions>0?currency(yearActual/yearSessions):'—'} sub="collected" color="#C9A84C" small />
      </div>
      <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1F2937', marginBottom:20 }}>Revenue by Month</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:140 }}>
          {monthData.map(({name,expected,actual})=>{
            const expH = Math.max((expected/maxVal)*120,expected>0?4:0);
            const actH = expected>0?Math.max((actual/expected)*expH,0):0;
            const isCurrent = name===MONTH_NAMES[TODAY.getMonth()]&&year===TODAY.getFullYear();
            return (
              <div key={name} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                {expected>0&&<div style={{ fontSize:9, color:'#9CA3AF', textAlign:'center' }}>{currency(actual)}</div>}
                <div style={{ width:'100%', display:'flex', alignItems:'flex-end', justifyContent:'center', gap:2, height:120 }}>
                  <div style={{ width:'80%', background:'#E5E7EB', borderRadius:'3px 3px 0 0', height:`${expH}px`, position:'relative' }}>
                    <div style={{ position:'absolute', bottom:0, width:'100%', background:isCurrent?'#C9A84C':'#2A5741', borderRadius:'3px 3px 0 0', height:`${actH}px` }}/>
                  </div>
                </div>
                <div style={{ fontSize:10, fontWeight:600, color:isCurrent?'#2A5741':'#9CA3AF' }}>{name}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex', gap:16, marginTop:12, fontSize:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#E5E7EB', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Expected</span></div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#2A5741', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Collected</span></div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#C9A84C', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Current month</span></div>
        </div>
      </div>
    </div>
  );
}

function InsightsView({ sessions }) {
  const last30 = sessions.filter(s=>s.date>=addDays(TODAY,-30)&&s.date<=TODAY);
  const prev30 = sessions.filter(s=>s.date>=addDays(TODAY,-60)&&s.date<addDays(TODAY,-30));
  const last30Rev = last30.reduce((t,x)=>t+(x.actual||0),0);
  const prev30Rev = prev30.reduce((t,x)=>t+(x.actual||0),0);
  const growth = prev30Rev>0?Math.round(((last30Rev-prev30Rev)/prev30Rev)*100):0;
  const collectionRate = sessions.length > 0 ? Math.round((sessions.filter(s=>s.status==='paid').length/sessions.length)*100) : 0;
  const outstanding = sessions.filter(s=>s.status==='outstanding');
  const outstandingTotal = outstanding.reduce((t,x)=>t+x.rate,0);
  const clientRev = {};
  sessions.forEach(s=>{ clientRev[s.client]=(clientRev[s.client]||0)+(s.actual||0); });
  const topClients = Object.entries(clientRev).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxRev = Math.max(...topClients.map(c=>c[1]),1);
  const paidSessions = sessions.filter(s=>s.actual>0);
  const avgSession = paidSessions.length>0 ? Math.round(paidSessions.reduce((t,x)=>t+(x.actual||0),0)/paidSessions.length) : 0;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <StatCard label="30-Day Revenue" value={currency(last30Rev)} sub={`${growth>=0?'+':''}${growth}% vs prior 30 days`} color="#2A5741" />
        <StatCard label="Collection Rate" value={`${collectionRate}%`} sub="sessions paid" color="#16A34A" />
        <StatCard label="Avg Session Value" value={currency(avgSession)} sub="collected" color="#6B9E80" small />
        <StatCard label="Outstanding" value={currency(outstandingTotal)} sub={`${outstanding.length} session${outstanding.length!==1?'s':''}`} color="#DC2626" small />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:16 }}>⭐ Top Clients by Revenue</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {topClients.map(([name,rev])=>(
              <div key={name}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1F2937' }}>{name}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#2A5741' }}>{currency(rev)}</span>
                </div>
                <div style={{ background:'#E5E7EB', borderRadius:99, height:6 }}>
                  <div style={{ width:`${(rev/maxRev)*100}%`, background:'#2A5741', borderRadius:99, height:6 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:16 }}>📊 Revenue Breakdown</div>
          {[
            { label:'Paid',        value:sessions.filter(s=>s.status==='paid').length,        color:'#16A34A' },
            { label:'Pending',     value:sessions.filter(s=>s.status==='pending').length,     color:'#D97706' },
            { label:'Outstanding', value:sessions.filter(s=>s.status==='outstanding').length, color:'#DC2626' },
            { label:'Waived',      value:sessions.filter(s=>s.status==='waived').length,      color:'#6B7280' },
          ].map(({label,value,color})=>(
            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #F3F4F6' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:color }}/>
                <span style={{ fontSize:13, color:'#1F2937' }}>{label}</span>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color }}>{value} sessions</span>
            </div>
          ))}
        </div>
      </div>
      {outstanding.length > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:20 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#DC2626', marginBottom:12 }}>🔴 Outstanding Payments — {currency(outstandingTotal)}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {outstanding.map(s=><SessionRow key={s.id} s={s}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingDashboard({ therapist }) {
  const [subView, setSubView] = useState('daily');
  const [stripeConnected, setStripeConnected] = useState(null);
  const [sessionRate, setSessionRate] = useState(DEFAULT_RATE);
  const [realTransactions, setRealTransactions] = useState(null); // null = loading, [] = connected but empty, [...] = has data

  useEffect(() => {
    if (!therapist?.id) return;
    import('../lib/supabase').then(({ supabase }) => {
      supabase
        .from('therapists')
        .select('stripe_account_id, stripe_account_connected, session_rate')
        .eq('id', therapist.id)
        .single()
        .then(async ({ data }) => {
          const connected = !!(data?.stripe_account_id);
          setStripeConnected(connected);
          if (data?.session_rate && data.session_rate > 0) setSessionRate(data.session_rate);

          if (connected) {
            // Fetch real transactions from Edge Function
            try {
              const { data: fnData, error } = await supabase.functions.invoke('stripe-connect', {
                body: { action: 'get_transactions', therapist_id: therapist.id }
              });
              if (!error && fnData?.transactions) {
                setRealTransactions(fnData.transactions);
              } else {
                setRealTransactions([]);
              }
            } catch {
              setRealTransactions([]);
            }
          }
        });
    });
  }, [therapist]);

  // Determine which sessions to show
  const isSampleData = !stripeConnected;
  const isLoading = stripeConnected === null;

  const sessions = useMemo(() => {
    if (stripeConnected && realTransactions && realTransactions.length > 0) {
      // Map real Stripe transactions to session format
      return realTransactions.map((t, i) => ({
        id: i + 1,
        client: t.client_name || t.description || 'Client',
        date: new Date(t.created * 1000),
        time: new Date(t.created * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        duration: 60,
        rate: sessionRate,
        actual: t.amount / 100,
        status: t.status === 'succeeded' ? 'paid' : 'pending',
      }));
    }
    // Not connected — show sample data with live session rate applied
    return SAMPLE_SESSIONS.map(s => ({
      ...s,
      rate:   s.rate   === DEFAULT_RATE ? sessionRate : s.rate,
      actual: s.actual === DEFAULT_RATE ? sessionRate : s.actual,
    }));
  }, [stripeConnected, realTransactions, sessionRate]);

  const TABS = [
    { id:'daily',    label:'📋 Daily' },
    { id:'weekly',   label:'📅 Weekly' },
    { id:'monthly',  label:'🗓 Monthly' },
    { id:'yearly',   label:'📆 Yearly' },
    { id:'insights', label:'📊 Insights' },
  ];

  if (isLoading) {
    return (
      <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:64 }}>
        <div style={{ fontSize:14, color:'#9CA3AF' }}>Loading billing data…</div>
      </div>
    );
  }

  // Connected but no transactions yet — show clean empty state
  if (stripeConnected && realTransactions !== null && realTransactions.length === 0) {
    return (
      <div style={{ width:'100%' }}>
        <div style={{ marginBottom:20 }}>
          <h2 style={{ fontFamily:'Georgia, serif', fontSize:26, fontWeight:700, color:'#1F2937', margin:'0 0 4px 0' }}>Billing</h2>
          <p style={{ fontSize:14, color:'#6B7280', margin:0 }}>{fmt(TODAY)}</p>
        </div>
        <EmptyBillingState />
      </div>
    );
  }

  return (
    <div style={{ width:'100%' }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontFamily:'Georgia, serif', fontSize:26, fontWeight:700, color:'#1F2937', margin:'0 0 4px 0' }}>Billing</h2>
        <p style={{ fontSize:14, color:'#6B7280', margin:0 }}>{fmt(TODAY)}</p>
      </div>

      {isSampleData && <SampleDataBanner />}

      {stripeConnected && realTransactions && realTransactions.length > 0 && (
        <div style={{ background:'#DCFCE7', border:'1px solid #86EFAC', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:'#16A34A', display:'flex', alignItems:'center', gap:8 }}>
          ✅ <strong>Stripe Connected.</strong>&nbsp;Showing real payment data.
        </div>
      )}

      {sessionRate !== DEFAULT_RATE && isSampleData && (
        <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'8px 16px', marginBottom:12, fontSize:12, color:'#16A34A', display:'flex', alignItems:'center', gap:8 }}>
          💰 Preview using your rate: <strong>${sessionRate}/session</strong>
        </div>
      )}

      <div style={{ display:'flex', gap:4, background:'#F3F4F6', borderRadius:10, padding:4, marginBottom:24, width:'fit-content', flexWrap:'wrap' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubView(t.id)} style={{ background:subView===t.id?'#FFFFFF':'transparent', color:subView===t.id?'#1F2937':'#6B7280', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:subView===t.id?'0 1px 3px rgba(0,0,0,0.1)':'none', transition:'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {subView==='daily'    && <DailyView    sessions={sessions} />}
      {subView==='weekly'   && <WeeklyView   sessions={sessions} />}
      {subView==='monthly'  && <MonthlyView  sessions={sessions} />}
      {subView==='yearly'   && <YearlyView   sessions={sessions} />}
      {subView==='insights' && <InsightsView sessions={sessions} />}
    </div>
  );
}
