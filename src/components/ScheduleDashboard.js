// src/components/ScheduleDashboard.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';

const TODAY = new Date();
TODAY.setHours(0,0,0,0);

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtShort = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtMonth = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const CLIENT_PROFILES = {
  'Sarah M.':     { phone: '(512) 555-0101', memberSince: 'Aug 2025', pressure: 4, music: 'Soft jazz',     temp: 'Warm',    focus: ['Neck', 'Left Shoulder', 'Upper Back'], avoid: ['Knees'],    notes: 'Prefers quiet, no conversation during session' },
  'Jennifer K.':  { phone: '(512) 555-0202', memberSince: 'Jan 2026', pressure: 2, music: 'Nature sounds', temp: 'Neutral', focus: ['Lower Back', 'Hips'],               avoid: [],           notes: 'New client, first-time massage' },
  'Maria L.':     { phone: '(512) 555-0303', memberSince: 'Mar 2025', pressure: 5, music: 'None',          temp: 'Cool',    focus: ['Lower Back', 'Glutes', 'Hamstrings'],avoid: ['Abdomen'],  notes: 'Deep tissue preferred, chronic lower back pain' },
  'Rachel T.':    { phone: '(512) 555-0404', memberSince: 'Feb 2026', pressure: 3, music: 'Soft piano',    temp: 'Warm',    focus: ['Shoulders'],                         avoid: [],           notes: '' },
  'Amy W.':       { phone: '(512) 555-0505', memberSince: 'Oct 2025', pressure: 3, music: 'Ambient',       temp: 'Warm',    focus: ['Full Back', 'Neck'],                 avoid: ['Head'],     notes: 'Sensitive to scented oils' },
  'Dana P.':      { phone: '(512) 555-0606', memberSince: 'Dec 2025', pressure: 4, music: 'Classical',     temp: 'Warm',    focus: ['Upper Back', 'Shoulders'],           avoid: [],           notes: '' },
  'Christine B.': { phone: '(512) 555-0707', memberSince: 'Jun 2025', pressure: 3, music: 'R&B',           temp: 'Neutral', focus: ['Legs', 'Feet'],                      avoid: ['Back'],     notes: 'Runner — focuses on legs and feet' },
  'Lisa N.':      { phone: '(512) 555-0808', memberSince: 'Mar 2026', pressure: 2, music: 'Soft jazz',     temp: 'Warm',    focus: ['Neck'],                              avoid: ['Lower Back'],notes: '' },
  'Tanya R.':     { phone: '(512) 555-0909', memberSince: 'Nov 2025', pressure: 4, music: 'None',          temp: 'Cool',    focus: ['Shoulders', 'Arms'],                 avoid: [],           notes: 'Desk worker, tension in shoulders' },
  'Monica G.':    { phone: '(512) 555-1010', memberSince: 'Apr 2025', pressure: 5, music: 'Classical',     temp: 'Warm',    focus: ['Full Body'],                         avoid: ['Knees','Feet'], notes: 'Monthly regular, prefers consistent routine' },
};

const APPOINTMENTS = [
  { id:1,  client:'Sarah M.',     time:'9:00 AM',  duration:60, date:addDays(TODAY,0),   status:'intake-done',    sessions:7,  sessionId:'sess-001' },
  { id:2,  client:'Jennifer K.',  time:'10:30 AM', duration:90, date:addDays(TODAY,0),   status:'pending-intake', sessions:2,  sessionId:'sess-002' },
  { id:3,  client:'Maria L.',     time:'12:00 PM', duration:60, date:addDays(TODAY,0),   status:'complete',       sessions:14, sessionId:'sess-003' },
  { id:4,  client:'Rachel T.',    time:'2:00 PM',  duration:60, date:addDays(TODAY,0),   status:'pending-intake', sessions:1,  sessionId:'sess-004' },
  { id:5,  client:'Amy W.',       time:'3:30 PM',  duration:90, date:addDays(TODAY,0),   status:'intake-done',    sessions:5,  sessionId:'sess-005' },
  { id:6,  client:'Dana P.',      time:'9:00 AM',  duration:90, date:addDays(TODAY,1),   status:'pending-intake', sessions:3 },
  { id:7,  client:'Christine B.', time:'11:00 AM', duration:60, date:addDays(TODAY,1),   status:'pending-intake', sessions:9 },
  { id:8,  client:'Lisa N.',      time:'2:00 PM',  duration:90, date:addDays(TODAY,2),   status:'pending-intake', sessions:1 },
  { id:9,  client:'Tanya R.',     time:'4:00 PM',  duration:60, date:addDays(TODAY,2),   status:'pending-intake', sessions:6 },
  { id:10, client:'Monica G.',    time:'10:00 AM', duration:60, date:addDays(TODAY,4),   status:'pending-intake', sessions:11 },
  { id:11, client:'Sarah M.',     time:'9:00 AM',  duration:60, date:addDays(TODAY,-7),  status:'complete',       sessions:6 },
  { id:12, client:'Maria L.',     time:'11:00 AM', duration:60, date:addDays(TODAY,-7),  status:'complete',       sessions:13 },
  { id:13, client:'Monica G.',    time:'2:00 PM',  duration:60, date:addDays(TODAY,-7),  status:'complete',       sessions:10 },
  { id:14, client:'Christine B.', time:'10:00 AM', duration:60, date:addDays(TODAY,-6),  status:'complete',       sessions:8 },
  { id:15, client:'Amy W.',       time:'3:00 PM',  duration:90, date:addDays(TODAY,-5),  status:'complete',       sessions:4 },
  { id:16, client:'Tanya R.',     time:'9:30 AM',  duration:60, date:addDays(TODAY,-4),  status:'complete',       sessions:5 },
  { id:17, client:'Dana P.',      time:'1:00 PM',  duration:60, date:addDays(TODAY,-3),  status:'complete',       sessions:2 },
  { id:18, client:'Sarah M.',     time:'9:00 AM',  duration:60, date:addDays(TODAY,-14), status:'complete',       sessions:5 },
  { id:19, client:'Monica G.',    time:'11:00 AM', duration:60, date:addDays(TODAY,-14), status:'complete',       sessions:9 },
  { id:20, client:'Maria L.',     time:'2:00 PM',  duration:60, date:addDays(TODAY,-13), status:'complete',       sessions:12 },
  { id:21, client:'Jennifer K.',  time:'10:00 AM', duration:60, date:addDays(TODAY,-10), status:'complete',       sessions:1 },
  { id:22, client:'Christine B.', time:'4:00 PM',  duration:60, date:addDays(TODAY,-11), status:'complete',       sessions:7 },
  { id:23, client:'Sarah M.',     time:'9:00 AM',  duration:60, date:addDays(TODAY,-21), status:'complete',       sessions:4 },
  { id:24, client:'Monica G.',    time:'2:00 PM',  duration:60, date:addDays(TODAY,-21), status:'complete',       sessions:8 },
  { id:25, client:'Tanya R.',     time:'11:00 AM', duration:60, date:addDays(TODAY,-18), status:'complete',       sessions:4 },
];

const STATUS_CFG = {
  'intake-done':    { label:'🧭 Intake Done',    bg:'#DCFCE7', color:'#16A34A' },
  'pending-intake': { label:'🔔 Pending Intake', bg:'#FEF3C7', color:'#D97706' },
  'complete':       { label:'✅ Complete',         bg:'#F3F4F6', color:'#6B7280' },
};

function SlideOutPanel({ appt, intakeUrl, onClose }) {
  const [copied, setCopied] = useState(false);
  const profile = CLIENT_PROFILES[appt.client] || {};
  const sc = STATUS_CFG[appt.status];
  const firstName = appt.client.split(' ')[0];
  const copyLink = () => { navigator.clipboard.writeText(intakeUrl); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const smsLink = `sms:&body=${encodeURIComponent(`Hi ${firstName}! Please fill out your intake form before your session: ${intakeUrl}`)}`;

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex:200 }} />
      <div style={{ position:'fixed', top:0, right:0, bottom:0, width:380, maxWidth:'92vw', background:'#FFFFFF', zIndex:201, overflowY:'auto', boxShadow:'-6px 0 30px rgba(0,0,0,0.12)', padding:'28px 24px' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#6B7280' }}>✕</button>

        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
          <div style={{ width:52, height:52, borderRadius:'50%', background:'#2A5741', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, flexShrink:0 }}>
            {appt.client.split(' ').map(w=>w[0]).join('')}
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'#1F2937', fontFamily:'Georgia, serif' }}>{appt.client}</div>
            <div style={{ fontSize:13, color:'#6B7280' }}>{appt.sessions} sessions · Member since {profile.memberSince || '—'}</div>
          </div>
        </div>

        <div style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6B7280', marginBottom:8 }}>Today's Appointment</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#1F2937' }}>{appt.time} · {appt.duration} min</div>
            <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:600 }}>{sc.label}</div>
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6B7280', marginBottom:10 }}>Body Map Preferences</div>
          {profile.focus && profile.focus.length > 0 ? (
            <>
              <div style={{ marginBottom:8 }}>
                <span style={{ fontSize:12, color:'#6B7280', marginRight:6 }}>Focus:</span>
                {profile.focus.map(f => <span key={f} style={{ display:'inline-block', background:'#DCFCE7', color:'#16A34A', borderRadius:12, padding:'2px 10px', fontSize:12, fontWeight:600, marginRight:4, marginBottom:4 }}>{f}</span>)}
              </div>
              {profile.avoid && profile.avoid.length > 0 && (
                <div>
                  <span style={{ fontSize:12, color:'#6B7280', marginRight:6 }}>Avoid:</span>
                  {profile.avoid.map(a => <span key={a} style={{ display:'inline-block', background:'#FEE2E2', color:'#DC2626', borderRadius:12, padding:'2px 10px', fontSize:12, fontWeight:600, marginRight:4, marginBottom:4 }}>{a}</span>)}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize:13, color:'#9CA3AF' }}>No intake completed yet</div>
          )}
        </div>

        {profile.pressure && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6B7280', marginBottom:10 }}>Session Preferences</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[{label:'Pressure',value:`${profile.pressure}/5`},{label:'Music',value:profile.music||'—'},{label:'Table Temp',value:profile.temp||'—'},{label:'Phone',value:profile.phone||'—'}].map(({label,value})=>(
                <div key={label} style={{ background:'#F9FAFB', borderRadius:8, padding:'8px 12px' }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#9CA3AF', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1F2937' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.notes ? (
          <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:8, padding:'10px 14px', marginBottom:20, fontSize:13, color:'#92400E' }}>
            📝 {profile.notes}
          </div>
        ) : null}

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {appt.status === 'pending-intake' && (
            <a href={smsLink} style={{ display:'block', background:'#6B9E80', color:'#fff', borderRadius:8, padding:'11px 16px', fontSize:14, fontWeight:600, textDecoration:'none', textAlign:'center' }}>💬 Send Intake via SMS</a>
          )}
          {appt.status === 'intake-done' && (
            <a href={`/brief/pre/${appt.sessionId}`} target="_blank" rel="noreferrer" style={{ display:'block', background:'#2A5741', color:'#fff', borderRadius:8, padding:'11px 16px', fontSize:14, fontWeight:600, textDecoration:'none', textAlign:'center' }}>📋 Open Pre-Session Brief</a>
          )}
          {appt.status === 'complete' && (
            <>
              <a href={`/brief/pre/${appt.sessionId}`} target="_blank" rel="noreferrer" style={{ display:'block', background:'#2A5741', color:'#fff', borderRadius:8, padding:'11px 16px', fontSize:14, fontWeight:600, textDecoration:'none', textAlign:'center' }}>📋 Pre-Session Brief</a>
              <a href={`/brief/post/${appt.sessionId}`} target="_blank" rel="noreferrer" style={{ display:'block', background:'#6B9E80', color:'#fff', borderRadius:8, padding:'11px 16px', fontSize:14, fontWeight:600, textDecoration:'none', textAlign:'center' }}>📄 Post-Session Brief</a>
            </>
          )}
          <button onClick={copyLink} style={{ background:'transparent', color:'#6B9E80', border:'1.5px solid #6B9E80', borderRadius:8, padding:'11px 16px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            {copied ? '✓ Link Copied!' : '📋 Copy Intake Link'}
          </button>
          <button style={{ background:'#F3F4F6', color:'#1F2937', border:'none', borderRadius:8, padding:'11px 16px', fontSize:14, fontWeight:600, cursor:'pointer' }}>👤 View Full Profile</button>
        </div>
      </div>
    </>
  );
}

function AppointmentCard({ appt, onClick }) {
  const sc = STATUS_CFG[appt.status];
  const profile = CLIENT_PROFILES[appt.client] || {};
  const focusSummary = profile.focus && profile.focus.length > 0 ? `Focus: ${profile.focus.slice(0,2).join(', ')}` : 'No intake yet';
  return (
    <div onClick={onClick}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.07)'}
      style={{ background:'#FFFFFF', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', borderLeft:`4px solid ${sc.color}`, cursor:'pointer', transition:'box-shadow 0.15s' }}>
      <div style={{ minWidth:70 }}>
        <div style={{ fontSize:15, fontWeight:700, color:'#1F2937' }}>{appt.time}</div>
        <div style={{ fontSize:12, color:'#6B7280' }}>{appt.duration} min</div>
      </div>
      <div style={{ width:40, height:40, borderRadius:'50%', background:'#2A5741', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>
        {appt.client.split(' ').map(w=>w[0]).join('')}
      </div>
      <div style={{ flex:1, minWidth:120 }}>
        <div style={{ fontSize:15, fontWeight:700, color:'#1F2937' }}>{appt.client}</div>
        <div style={{ fontSize:12, color:'#6B7280' }}>{appt.sessions} sessions · {focusSummary}</div>
      </div>
      <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>{sc.label}</div>
      <div style={{ color:'#9CA3AF', fontSize:18 }}>›</div>
    </div>
  );
}

function DailyView({ therapist, appointments: apptOverride }) {
  const APPTS = apptOverride || APPOINTMENTS;
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url || 'demo'}`;
  const days = [0,1,2,3,4].map(n => addDays(TODAY,n));
  const todayAppts = APPTS.filter(a => sameDay(a.date, TODAY));
  const selectedDate = days[selectedDay];
  const filtered = APPTS.filter(a => sameDay(a.date, selectedDate));

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:28, flexWrap:'wrap' }}>
        {[
          { label:"Today's Sessions", value:todayAppts.length, sub:'scheduled', color:'#2A5741' },
          { label:'Intake Done', value:todayAppts.filter(a=>a.status==='intake-done').length, sub:'ready to review', color:'#16A34A' },
          { label:'Pending Intake', value:todayAppts.filter(a=>a.status==='pending-intake').length, sub:'send link now', color:'#D97706' },
          { label:'This Week', value:APPTS.filter(a=>a.date>=TODAY&&a.date<=addDays(TODAY,7)).length, sub:'total sessions', color:'#6B9E80' },
        ].map(s => (
          <div key={s.label} style={{ background:'#FFFFFF', borderRadius:12, padding:'20px 24px', flex:1, minWidth:120, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize:28, fontWeight:700, color:s.color, fontFamily:'Georgia, serif' }}>{s.value}</div>
            <div style={{ fontSize:13, fontWeight:600, color:'#1F2937', marginTop:2 }}>{s.label}</div>
            <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {days.map((d,i) => {
          const count = APPTS.filter(a=>sameDay(a.date,d)).length;
          const isSel = i===selectedDay;
          return (
            <button key={i} onClick={()=>setSelectedDay(i)} style={{ background:isSel?'#2A5741':'#FFFFFF', color:isSel?'#FFFFFF':'#1F2937', border:`1.5px solid ${isSel?'#2A5741':'#E5E7EB'}`, borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <div>{i===0?'Today':i===1?'Tomorrow':d.toLocaleDateString('en-US',{weekday:'short'})}</div>
              <div style={{ fontSize:11, opacity:0.75, marginTop:2 }}>{count} session{count!==1?'s':''}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
        {fmtShort(selectedDate)} — {filtered.length} appointment{filtered.length!==1?'s':''}
      </div>
      {filtered.length === 0
        ? <div style={{ background:'#FFFFFF', borderRadius:12, padding:32, textAlign:'center', color:'#6B7280', fontSize:14 }}>No appointments scheduled.</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{filtered.map(appt=><AppointmentCard key={appt.id} appt={appt} onClick={()=>setSelectedAppt(appt)} />)}</div>
      }
      {selectedAppt && <SlideOutPanel appt={selectedAppt} intakeUrl={intakeUrl} onClose={()=>setSelectedAppt(null)} />}
    </div>
  );
}

function WeeklyView({ therapist }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url || 'demo'}`;

  const getMonday = (d) => {
    const x = new Date(d); const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff); x.setHours(0,0,0,0); return x;
  };

  const weekStart = addDays(getMonday(TODAY), weekOffset * 7);
  const weekDays = [0,1,2,3,4,5,6].map(n => addDays(weekStart,n));
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const weekAppts = APPOINTMENTS.filter(a => a.date >= weekStart && a.date < addDays(weekStart,7));

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>setWeekOffset(weekOffset-1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>← Prev</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>{weekOffset===0?'This Week':weekOffset===1?'Next Week':weekOffset===-1?'Last Week':fmtShort(weekStart)}</div>
          <div style={{ fontSize:12, color:'#6B7280' }}>{weekAppts.length} sessions · Est. ${weekAppts.length * 85}</div>
        </div>
        <button onClick={()=>setWeekOffset(weekOffset+1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>Next →</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
        {weekDays.map((d,i) => {
          const dayAppts = APPOINTMENTS.filter(a=>sameDay(a.date,d));
          const isToday = sameDay(d,TODAY);
          return (
            <div key={i} style={{ minHeight:120 }}>
              <div style={{ textAlign:'center', padding:'8px 4px', borderRadius:8, marginBottom:6, background:isToday?'#2A5741':'transparent', color:isToday?'#FFFFFF':'#6B7280' }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' }}>{DAY_NAMES[i]}</div>
                <div style={{ fontSize:13, fontWeight:600 }}>{d.getDate()}</div>
              </div>
              {dayAppts.length === 0
                ? <div style={{ height:60, border:'1.5px dashed #E5E7EB', borderRadius:8 }} />
                : <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {dayAppts.map(appt => {
                      const sc = STATUS_CFG[appt.status];
                      return (
                        <div key={appt.id} onClick={()=>setSelectedAppt(appt)} style={{ background:sc.bg, borderLeft:`3px solid ${sc.color}`, borderRadius:6, padding:'6px 8px', cursor:'pointer', fontSize:11, fontWeight:600, color:'#1F2937' }}>
                          <div style={{ color:sc.color, fontSize:10 }}>{appt.time}</div>
                          <div>{appt.client.split(' ')[0]}</div>
                          <div style={{ color:'#9CA3AF', fontSize:10 }}>{appt.duration}m</div>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
          );
        })}
      </div>
      {selectedAppt && <SlideOutPanel appt={selectedAppt} intakeUrl={intakeUrl} onClose={()=>setSelectedAppt(null)} />}
    </div>
  );
}

function MonthlyView({ therapist }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url || 'demo'}`;

  const viewMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const calDays = [];
  for (let i=0; i<startOffset; i++) calDays.push(null);
  for (let i=1; i<=daysInMonth; i++) calDays.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i));

  const selectedDayAppts = APPOINTMENTS.filter(a => sameDay(a.date, selectedDate));

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>setMonthOffset(monthOffset-1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>← Prev</button>
        <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>{fmtMonth(viewMonth)}</div>
        <button onClick={()=>setMonthOffset(monthOffset+1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>Next →</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
          <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', padding:'4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:24 }}>
        {calDays.map((d,i) => {
          if (!d) return <div key={i} />;
          const dayAppts = APPOINTMENTS.filter(a=>sameDay(a.date,d));
          const isToday = sameDay(d,TODAY);
          const isSel = sameDay(d,selectedDate);
          const hasPending = dayAppts.some(a=>a.status==='pending-intake');
          const hasIntakeDone = dayAppts.some(a=>a.status==='intake-done');
          return (
            <div key={i} onClick={()=>setSelectedDate(d)} style={{ minHeight:56, padding:6, borderRadius:8, cursor:dayAppts.length>0?'pointer':'default', background:isSel?'#2A5741':isToday?'#F0FDF4':'#FFFFFF', border:`1.5px solid ${isSel?'#2A5741':isToday?'#16A34A':'#E5E7EB'}` }}>
              <div style={{ fontSize:12, fontWeight:600, color:isSel?'#FFFFFF':isToday?'#16A34A':'#6B7280', marginBottom:2 }}>{d.getDate()}</div>
              {dayAppts.length > 0 && <div style={{ fontSize:11, fontWeight:700, color:isSel?'#FFFFFF':'#1F2937' }}>{dayAppts.length} session{dayAppts.length>1?'s':''}</div>}
              {(hasPending||hasIntakeDone) && !isSel && (
                <div style={{ display:'flex', gap:2, marginTop:2 }}>
                  {hasIntakeDone && <div style={{ width:6, height:6, borderRadius:'50%', background:'#16A34A' }} />}
                  {hasPending && <div style={{ width:6, height:6, borderRadius:'50%', background:'#D97706' }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
        {fmtShort(selectedDate)} — {selectedDayAppts.length} appointment{selectedDayAppts.length!==1?'s':''}
      </div>
      {selectedDayAppts.length === 0
        ? <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No appointments. Click a day with sessions to view.</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{selectedDayAppts.map(appt=><AppointmentCard key={appt.id} appt={appt} onClick={()=>setSelectedAppt(appt)} />)}</div>
      }
      {selectedAppt && <SlideOutPanel appt={selectedAppt} intakeUrl={intakeUrl} onClose={()=>setSelectedAppt(null)} />}
    </div>
  );
}

function InsightsView() {
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayCounts = DAY_NAMES.map((name,i) => {
    const jsDay = i===6 ? 0 : i+1;
    return { name, count: APPOINTMENTS.filter(a=>a.date.getDay()===jsDay).length };
  });
  const maxDay = Math.max(...dayCounts.map(d=>d.count),1);

  const completionRate = Math.round((APPOINTMENTS.filter(a=>a.status==='complete'||a.status==='intake-done').length/APPOINTMENTS.length)*100);

  const clientCounts = {};
  APPOINTMENTS.forEach(a=>{ clientCounts[a.client]=(clientCounts[a.client]||0)+1; });
  const topClients = Object.entries(clientCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const lastSession = {};
  APPOINTMENTS.forEach(a=>{ if(!lastSession[a.client]||a.date>lastSession[a.client]) lastSession[a.client]=a.date; });
  const lapsed = Object.entries(lastSession)
    .map(([name,date])=>({ name, daysSince:Math.floor((TODAY-date)/86400000) }))
    .filter(c=>c.daysSince>14&&!APPOINTMENTS.some(a=>a.client===c.name&&a.date>TODAY))
    .sort((a,b)=>b.daysSince-a.daysSince);

  const weeklyCounts = [3,2,1,0].map(w=>{
    const start=addDays(TODAY,-7*(w+1)); const end=addDays(TODAY,-7*w);
    return { label:w===0?'This wk':`${w}w ago`, count:APPOINTMENTS.filter(a=>a.date>=start&&a.date<end).length };
  });
  const maxWeek = Math.max(...weeklyCounts.map(w=>w.count),1);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

      <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', gridColumn:'1/-1' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:16 }}>📊 Busiest Days of the Week</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:12, height:110 }}>
          {dayCounts.map(({name,count})=>(
            <div key={name} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#6B7280' }}>{count}</div>
              <div style={{ width:'100%', background:'#2A5741', borderRadius:'4px 4px 0 0', height:`${Math.max((count/maxDay)*80,count>0?8:2)}px`, opacity:count>0?1:0.15 }} />
              <div style={{ fontSize:11, fontWeight:600, color:'#9CA3AF' }}>{name}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:16 }}>📈 Sessions Per Week</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:90 }}>
          {weeklyCounts.map(({label,count})=>(
            <div key={label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#6B9E80' }}>{count}</div>
              <div style={{ width:'100%', background:'#6B9E80', borderRadius:'4px 4px 0 0', height:`${Math.max((count/maxWeek)*65,count>0?8:2)}px` }} />
              <div style={{ fontSize:10, color:'#9CA3AF', textAlign:'center' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:12 }}>✅ Intake Completion Rate</div>
        <div style={{ fontSize:48, fontWeight:700, color:'#2A5741', fontFamily:'Georgia, serif' }}>{completionRate}%</div>
        <div style={{ fontSize:13, color:'#6B7280', marginTop:4 }}>of sessions have intake completed</div>
        <div style={{ marginTop:12, background:'#E5E7EB', borderRadius:99, height:8 }}>
          <div style={{ width:`${completionRate}%`, background:'#2A5741', borderRadius:99, height:8 }} />
        </div>
      </div>

      <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:16 }}>⭐ Top Clients</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {topClients.map(([name,count])=>(
            <div key={name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'#2A5741', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                  {name.split(' ').map(w=>w[0]).join('')}
                </div>
                <span style={{ fontSize:14, fontWeight:600, color:'#1F2937' }}>{name}</span>
              </div>
              <span style={{ fontSize:13, color:'#6B7280' }}>{count} sessions</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', gridColumn:'1/-1' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:4 }}>🍂 Re-engagement Opportunities</div>
        <div style={{ fontSize:12, color:'#6B7280', marginBottom:16 }}>Clients with no upcoming booking</div>
        {lapsed.length === 0
          ? <div style={{ fontSize:13, color:'#9CA3AF' }}>All clients have upcoming appointments. Great retention!</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {lapsed.map(c=>(
                <div key={c.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'#FEF3C7', borderRadius:8 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1F2937' }}>{c.name}</div>
                  <div style={{ fontSize:12, color:'#D97706', fontWeight:600 }}>Last seen {c.daysSince}d ago</div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

export default function ScheduleDashboard({ therapist }) {
  const [subView, setSubView] = useState('daily');
  const [realBookings, setRealBookings] = useState(null);
  const [loadingCal, setLoadingCal] = useState(false);

  useEffect(() => { if (therapist?.id) fetchCalBookings(); }, [therapist]);

  const fetchCalBookings = async () => {
    setLoadingCal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const { data: td } = await supabase.from('therapists').select('cal_api_key').eq('id', therapist.id).single();
      if (!td?.cal_api_key) { setLoadingCal(false); return; }
      console.log('Fetching Cal.com with key:', td.cal_api_key?.slice(0,20));
      const calRes = await fetch(`${SUPABASE_URL}/functions/v1/cal-bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ apiKey: td.cal_api_key, dateFrom: new Date(Date.now()-7*86400000).toISOString(), dateTo: new Date(Date.now()+14*86400000).toISOString() }),
      });
      const calData = await calRes.json();
      if (!calData.bookings?.length) { setLoadingCal(false); return; }
      const { data: sessions } = await supabase.from('sessions').select('*, clients(name,email)').eq('therapist_id', therapist.id).order('created_at', { ascending: false });
      const { data: clients } = await supabase.from('clients').select('*').eq('therapist_id', therapist.id);
      const merged = calData.bookings.map(booking => {
        const bookingDate = new Date(booking.date); bookingDate.setHours(0,0,0,0);
        const client = clients?.find(c => c.email === booking.email || c.name?.toLowerCase() === booking.client?.toLowerCase());
        const session = sessions?.find(s => { const sd = new Date(s.created_at); sd.setHours(0,0,0,0); return s.client_id === client?.id && sd.toDateString() === bookingDate.toDateString(); });
        const clientSessions = sessions?.filter(s => s.client_id === client?.id && s.completed) || [];
        let status = 'pending-intake';
        if (session?.completed) status = 'complete';
        else if (session) status = 'intake-done';
        const focusAreas = session ? [...(session.front_focus||[]),...(session.back_focus||[])].slice(0,3).join(', ') : '—';
        return { id: booking.calId, client: booking.client, time: booking.time, duration: booking.duration, date: bookingDate, status, focus: focusAreas||'—', sessions: clientSessions.length, sessionId: session?.id };
      });
      setRealBookings(merged);
    } catch(err) { console.error('Cal fetch error:', err); }
    setLoadingCal(false);
  };

  const usingRealData = !!realBookings;

  const TABS = [
    { id:'daily',    label:'📋 Daily' },
    { id:'weekly',   label:'📅 Weekly' },
    { id:'monthly',  label:'🗓 Monthly' },
    { id:'insights', label:'📊 Insights' },
  ];

  return (
    <div style={{ width:'100%' }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontFamily:'Georgia, serif', fontSize:26, fontWeight:700, color:'#1F2937', margin:'0 0 4px 0' }}>Schedule</h2>
        <p style={{ fontSize:14, color:'#6B7280', margin:0 }}>{fmt(TODAY)}</p>
      </div>
      {usingRealData ? (
        <div style={{ background:'#DCFCE7', border:'1px solid #86EFAC', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:'#16A34A', display:'flex', alignItems:'center', gap:8 }}>
          ✅ <strong>Cal.com connected.</strong>&nbsp;Showing your real appointments with BodyMap intake status.
          <button onClick={fetchCalBookings} style={{ marginLeft:'auto', background:'transparent', border:'1px solid #16A34A', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#16A34A', cursor:'pointer' }}>↻ Refresh</button>
        </div>
      ) : loadingCal ? (
        <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:'#16A34A' }}>
          ⏳ Connecting to Cal.com...
        </div>
      ) : (
        <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:'#92400E', display:'flex', alignItems:'center', gap:8 }}>
          🔗 <strong>Cal.com not connected.</strong>&nbsp;Add your API key in Settings to see real appointments.
        </div>
      )}
      <div style={{ display:'flex', gap:4, background:'#F3F4F6', borderRadius:10, padding:4, marginBottom:24, width:'fit-content' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubView(t.id)} style={{ background:subView===t.id?'#FFFFFF':'transparent', color:subView===t.id?'#1F2937':'#6B7280', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:subView===t.id?'0 1px 3px rgba(0,0,0,0.1)':'none', transition:'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>
      {subView==='daily'    && <DailyView therapist={therapist} appointments={realBookings} />}
      {subView==='weekly'   && <WeeklyView therapist={therapist} />}
      {subView==='monthly'  && <MonthlyView therapist={therapist} />}
      {subView==='insights' && <InsightsView />}
    </div>
  );
}
