// src/components/ScheduleDashboard.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const sameDay = (a,b) => a.toDateString()===b.toDateString();
const fmt12 = t => { if(!t) return ''; const [h,m]=t.toString().split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const fmtDay = d => d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
const fmtShort = d => d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const fmtMonth = d => d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
const initials = name => name?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?';
const AVATAR_COLORS = ['#2A5741','#3B6B8A','#7B5EA7','#C05621','#276749','#2C5282','#702459'];
const avatarColor = name => AVATAR_COLORS[(name?.charCodeAt(0)||0)%AVATAR_COLORS.length];

// Sample preview data — shown when < 3 real bookings exist
const SAMPLE = [
  {id:'s1',client:'Emma R.',time:'9:00 AM',duration:60,date:addDays(TODAY,0),status:'intake-done',sessions:4,preview:true,service:'Swedish Massage',focus:['Neck','Shoulders'],notes:'Prefers quiet session'},
  {id:'s2',client:'Jess M.',time:'10:30 AM',duration:90,date:addDays(TODAY,0),status:'pending-intake',preview:true,sessions:1,service:'Deep Tissue',focus:[],notes:''},
  {id:'s3',client:'Maria L.',time:'2:00 PM',duration:60,date:addDays(TODAY,0),status:'complete',sessions:12,preview:true,service:'Hot Stone',focus:['Lower Back','Hips'],notes:'Monthly regular'},
  {id:'s4',client:'Dana P.',time:'9:00 AM',duration:90,date:addDays(TODAY,1),status:'pending-intake',sessions:3,preview:true,service:'Swedish Massage',focus:[],notes:''},
  {id:'s5',client:'Amy W.',time:'11:00 AM',duration:60,date:addDays(TODAY,1),status:'intake-done',sessions:5,preview:true,service:'Sports Massage',focus:['Legs','Feet'],notes:'Runner'},
  {id:'s6',client:'Emma R.',time:'9:00 AM',duration:60,date:addDays(TODAY,3),status:'pending-intake',sessions:5,preview:true,service:'Swedish Massage',focus:[],notes:''},
  {id:'s7',client:'Jess M.',time:'3:00 PM',duration:60,date:addDays(TODAY,4),status:'pending-intake',sessions:2,preview:true,service:'Deep Tissue',focus:[],notes:''},
];

const STATUS = {
  'intake-done':    {label:'Brief Ready',   bg:'#DCFCE7',color:'#16A34A',dot:'#16A34A',icon:'🧭'},
  'pending-intake': {label:'No Intake',     bg:'#FEF3C7',color:'#D97706',dot:'#F59E0B',icon:'📋'},
  'complete':       {label:'Complete',      bg:'#F3F4F6',color:'#6B7280',dot:'#9CA3AF',icon:'✓'},
};

// ─── Slide-out detail panel ──────────────────────────────────────────────────
function DetailPanel({ appt, therapist, onClose }) {
  const st = STATUS[appt.status] || STATUS['pending-intake'];
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const [copied, setCopied] = useState(false);
  const firstName = appt.client?.split(' ')[0];

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:360,maxWidth:'92vw',background:'#fff',zIndex:301,
        overflowY:'auto',boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column'}}>
        
        {/* Header */}
        <div style={{padding:'20px 20px 0',borderBottom:'1px solid #F3F4F6',paddingBottom:16}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:avatarColor(appt.client),
                color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:16,fontWeight:700,flexShrink:0}}>
                {initials(appt.client)}
              </div>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:'#1F2937',fontFamily:'Georgia,serif'}}>{appt.client}</div>
                <div style={{fontSize:12,color:'#6B7280'}}>{appt.sessions} sessions{appt.preview?' · Preview':''}</div>
              </div>
            </div>
            <button onClick={onClose} style={{background:'#F3F4F6',border:'none',borderRadius:'50%',
              width:32,height:32,cursor:'pointer',fontSize:16,color:'#6B7280',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
          
          {/* Appointment strip */}
          <div style={{background:'#F9FAFB',borderRadius:10,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{appt.time} · {appt.duration} min</div>
              <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>{appt.service||'Session'} · {fmtShort(appt.date)}</div>
            </div>
            <div style={{background:st.bg,color:st.color,borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700}}>
              {st.icon} {st.label}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,padding:20,display:'flex',flexDirection:'column',gap:16}}>

          {/* Focus areas */}
          {appt.focus?.length > 0 && (
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9CA3AF',marginBottom:8}}>Focus Areas</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {appt.focus.map(f=>(
                  <span key={f} style={{background:'#DCFCE7',color:'#16A34A',borderRadius:20,padding:'4px 12px',fontSize:12,fontWeight:600}}>{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {appt.notes && (
            <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#92400E',lineHeight:1.5}}>
              📝 {appt.notes}
            </div>
          )}

          {/* Actions */}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {appt.status==='intake-done' && appt.sessionId && (
              <a href={`/brief/pre/${appt.sessionId}`} target="_blank" rel="noreferrer"
                style={{display:'block',background:'#2A5741',color:'#fff',borderRadius:10,padding:'13px 16px',
                  fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
                🧭 Open Pre-Session Brief
              </a>
            )}
            {appt.status==='complete' && appt.sessionId && (
              <>
                <a href={`/brief/pre/${appt.sessionId}`} target="_blank" rel="noreferrer"
                  style={{display:'block',background:'#2A5741',color:'#fff',borderRadius:10,padding:'13px 16px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
                  📋 Pre-Session Brief
                </a>
                <a href={`/brief/post/${appt.sessionId}`} target="_blank" rel="noreferrer"
                  style={{display:'block',background:'#6B9E80',color:'#fff',borderRadius:10,padding:'13px 16px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
                  📄 Post-Session Brief
                </a>
              </>
            )}
            {appt.status==='pending-intake' && (
              <a href={`sms:&body=${encodeURIComponent(`Hi ${firstName}! Please fill out your intake form before your session: ${intakeUrl}`)}`}
                style={{display:'block',background:'#2A5741',color:'#fff',borderRadius:10,padding:'13px 16px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
                💬 Send Intake via SMS
              </a>
            )}
            <button onClick={()=>{navigator.clipboard.writeText(intakeUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
              style={{background:'transparent',color:'#6B9E80',border:'1.5px solid #6B9E80',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
              {copied?'✓ Copied!':'📋 Copy Intake Link'}
            </button>
          </div>

          {appt.preview && (
            <div style={{background:'#FEF3C7',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#92400E',textAlign:'center',lineHeight:1.5}}>
              This is a preview card. Real clients will appear here after they book.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Mission Control — Today View ────────────────────────────────────────────
function TodayView({ therapist, allAppts }) {
  const [selected, setSelected] = useState(null);
  const [dayOffset, setDayOffset] = useState(0);
  const viewDate = addDays(TODAY, dayOffset);
  const dayAppts = allAppts.filter(a => sameDay(a.date, viewDate));
  const realAppts = dayAppts.filter(a => !a.preview);
  const previewAppts = dayAppts.filter(a => a.preview);

  const now = new Date();
  const nowMin = dayOffset === 0 ? now.getHours() * 60 + now.getMinutes() : -1;

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = therapist?.full_name?.split(' ')[0] || 'there';

  const todayReal = allAppts.filter(a => sameDay(a.date, TODAY) && !a.preview);
  const weekReal = allAppts.filter(a => !a.preview && a.date >= TODAY && a.date <= addDays(TODAY, 7));

  // Parse time string like "9:00 AM" → minutes from midnight
  function timeToMin(t) {
    if (!t) return 0;
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 0;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
    if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }

  // Timeline config
  const TIMELINE_START = 8 * 60;  // 8 AM
  const TIMELINE_END   = 19 * 60; // 7 PM
  const TOTAL_MINS     = TIMELINE_END - TIMELINE_START;
  const PX_PER_MIN     = 2.2;
  const TIMELINE_H     = TOTAL_MINS * PX_PER_MIN;
  const LEFT_GUTTER    = 52;

  const hourLabels = [];
  for (let h = 8; h <= 19; h++) {
    hourLabels.push(h);
  }

  // Detect gaps > 90 min between appointments
  const sortedAppts = [...dayAppts].sort((a,b) => timeToMin(a.time) - timeToMin(b.time));
  const gaps = [];
  for (let i = 0; i < sortedAppts.length - 1; i++) {
    const aEnd = timeToMin(sortedAppts[i].time) + sortedAppts[i].duration;
    const bStart = timeToMin(sortedAppts[i+1].time);
    if (bStart - aEnd > 90) {
      gaps.push({ start: aEnd, end: bStart, mins: bStart - aEnd });
    }
  }

  return (
    <div>
      {/* Greeting */}
      <div style={{marginBottom:20}}>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:'#1F2937',margin:'0 0 2px'}}>
          {greeting}, {firstName}.
        </h2>
        <p style={{fontSize:13,color:'#6B7280',margin:0}}>{fmtDay(viewDate)}</p>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
        {[
          {val:todayReal.length,    label:"Today",         color:'#2A5741'},
          {val:todayReal.filter(a=>a.status==='intake-done').length, label:'Brief ready', color:'#16A34A'},
          {val:todayReal.filter(a=>a.status==='pending-intake').length, label:'Need intake', color:'#D97706'},
          {val:weekReal.length,     label:'This week',     color:'#6B9E80'},
        ].map(s => (
          <div key={s.label} style={{background:'#fff',borderRadius:12,padding:'14px 12px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
            <div style={{fontSize:26,fontWeight:700,color:s.color,fontFamily:'Georgia,serif',lineHeight:1}}>{s.val}</div>
            <div style={{fontSize:11,color:'#9CA3AF',marginTop:3,lineHeight:1.3}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Day selector */}
      <div style={{display:'flex',gap:6,marginBottom:24,overflowX:'auto',paddingBottom:2}}>
        {[0,1,2,3,4].map(i => {
          const d = addDays(TODAY, i);
          const count = allAppts.filter(a => sameDay(a.date,d) && !a.preview).length;
          const isSel = i === dayOffset;
          return (
            <button key={i} onClick={() => setDayOffset(i)}
              style={{flexShrink:0,background:isSel?'#2A5741':'#fff',
                color:isSel?'#fff':'#1F2937',
                border:`1.5px solid ${isSel?'#2A5741':'#E5E7EB'}`,
                borderRadius:12,padding:'10px 14px',cursor:'pointer',minWidth:72,textAlign:'center',transition:'all 0.15s'}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',opacity:0.75,marginBottom:2}}>
                {i===0?'Today':i===1?'Tmrw':d.toLocaleDateString('en-US',{weekday:'short'})}
              </div>
              <div style={{fontSize:18,fontWeight:700}}>{d.getDate()}</div>
              {count > 0 && <div style={{fontSize:10,marginTop:2,opacity:0.7}}>{count} appt{count!==1?'s':''}</div>}
            </button>
          );
        })}
      </div>

      {/* ── VISUAL TIMELINE ─────────────────────────────────────── */}
      <div style={{background:'#fff',borderRadius:16,padding:'20px 16px 24px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',overflowX:'hidden'}}>

        {dayAppts.length === 0 ? (
          <div style={{textAlign:'center',padding:'40px 0'}}>
            <div style={{fontSize:36,marginBottom:10}}>🌿</div>
            <div style={{fontSize:15,fontWeight:600,color:'#1F2937',marginBottom:6}}>No sessions {dayOffset===0?'today':'this day'}</div>
            <div style={{fontSize:13,color:'#9CA3AF'}}>Share your booking link to fill your calendar.</div>
          </div>
        ) : (
          <div style={{position:'relative',height:TIMELINE_H,marginLeft:LEFT_GUTTER}}>

            {/* Hour grid lines + labels */}
            {hourLabels.map(h => {
              const y = (h * 60 - TIMELINE_START) * PX_PER_MIN;
              const label = h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h-12} PM`;
              return (
                <div key={h}>
                  <div style={{position:'absolute',top:y,left:-LEFT_GUTTER,width:LEFT_GUTTER-8,
                    textAlign:'right',fontSize:10,fontWeight:600,color:'#D1D5DB',lineHeight:'1',
                    transform:'translateY(-50%)',userSelect:'none'}}>
                    {label}
                  </div>
                  <div style={{position:'absolute',top:y,left:0,right:0,
                    borderTop:h===8||h===19?'none':'1px solid #EEEEEE',pointerEvents:'none'}}/>
                </div>
              );
            })}

            {/* Gap indicators */}
            {gaps.map((g,i) => {
              const y = (g.start - TIMELINE_START) * PX_PER_MIN;
              const h = g.mins * PX_PER_MIN;
              const hrs = Math.floor(g.mins/60);
              const mins = g.mins % 60;
              const label = hrs > 0 ? `${hrs}h ${mins>0?mins+'m ':''} gap` : `${mins}m gap`;
              return (
                <div key={i} style={{position:'absolute',top:y,left:0,right:0,height:h,
                  background:'repeating-linear-gradient(45deg,transparent,transparent 6px,#FEF9EE 6px,#FEF9EE 7px)',
                  borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',
                  border:'1px dashed #FCD34D',opacity:0.7}}>
                  <span style={{fontSize:11,fontWeight:700,color:'#D97706',background:'#FFFBEB',
                    padding:'2px 10px',borderRadius:20,border:'1px solid #FCD34D'}}>
                    ⚡ {label} — consider filling this slot
                  </span>
                </div>
              );
            })}

            {/* Current time indicator */}
            {nowMin >= TIMELINE_START && nowMin <= TIMELINE_END && (
              <div style={{position:'absolute',top:(nowMin-TIMELINE_START)*PX_PER_MIN,left:-8,right:0,zIndex:10,pointerEvents:'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:0}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:'#EF4444',flexShrink:0}}/>
                  <div style={{flex:1,height:2,background:'#EF4444',opacity:0.7}}/>
                </div>
              </div>
            )}

            {/* Appointment blocks */}
            {sortedAppts.map((appt, idx) => {
              const startMin = timeToMin(appt.time);
              const y = (startMin - TIMELINE_START) * PX_PER_MIN;
              const h = Math.max(appt.duration * PX_PER_MIN, 44);
              const st = STATUS[appt.status] || STATUS['pending-intake'];
              const isSelected = selected?.id === appt.id;
              const isPast = dayOffset === 0 && startMin + appt.duration < nowMin;

              return (
                <div key={appt.id}
                  onClick={() => setSelected(isSelected ? null : appt)}
                  style={{
                    position:'absolute', top:y, left:4, right:4, height:h,
                    background: appt.preview ? '#F9FAFB' : st.bg,
                    border:`1.5px ${appt.preview?'dashed':'solid'} ${appt.preview?'#E5E7EB':st.dot}`,
                    borderLeft:`4px solid ${appt.preview?'#D1D5DB':st.dot}`,
                    borderRadius:10, cursor:'pointer', overflow:'hidden',
                    opacity: appt.preview ? 0.65 : isPast ? 0.55 : 1,
                    transition:'all 0.15s',
                    boxShadow: isSelected ? '0 4px 20px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
                    transform: isSelected ? 'scale(1.01)' : 'none',
                    zIndex: isSelected ? 5 : 1,
                  }}>
                  <div style={{padding:'8px 10px',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                          <div style={{width:26,height:26,borderRadius:'50%',flexShrink:0,
                            background:appt.preview?'#D1D5DB':avatarColor(appt.client),
                            color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:10,fontWeight:700}}>
                            {initials(appt.client)}
                          </div>
                          <span style={{fontSize:13,fontWeight:700,color:appt.preview?'#9CA3AF':'#1F2937',
                            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {appt.client}
                          </span>
                          {appt.preview && <span style={{fontSize:9,fontWeight:700,color:'#9CA3AF',
                            background:'#F3F4F6',borderRadius:4,padding:'1px 5px',flexShrink:0}}>PREVIEW</span>}
                        </div>
                        {h > 56 && (
                          <div style={{fontSize:11,color:appt.preview?'#C4C4C4':st.color,marginLeft:32}}>
                            {appt.service}
                            {appt.focus?.length > 0 && ` · ${appt.focus.slice(0,2).join(', ')}`}
                          </div>
                        )}
                      </div>
                      <div style={{flexShrink:0,textAlign:'right'}}>
                        <div style={{fontSize:11,fontWeight:700,color:appt.preview?'#C4C4C4':'#1F2937'}}>{appt.time}</div>
                        <div style={{fontSize:10,color:'#9CA3AF'}}>{appt.duration}m</div>
                      </div>
                    </div>
                    {h > 80 && (
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
                        <div style={{background: appt.preview?'transparent':st.dot+'22',color:appt.preview?'#C4C4C4':st.color,
                          borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>
                          {st.icon} {st.label}
                        </div>
                        {!appt.preview && appt.status==='intake-done' && (
                          <div style={{fontSize:10,fontWeight:700,color:'#2A5741',
                            background:'#DCFCE7',borderRadius:20,padding:'2px 8px'}}>
                            Brief ready →
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* Status legend */}
      <div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:14,padding:'10px 14px',background:'#F9FAFB',borderRadius:10}}>
        <span style={{fontSize:11,fontWeight:700,color:'#6B7280',marginRight:4}}>KEY:</span>
        {[
          {color:'#16A34A',label:'Brief ready — intake done, read before session'},
          {color:'#F59E0B',label:'No intake yet — send link'},
          {color:'#9CA3AF',label:'Complete'},
        ].map(({color,label})=>(
          <div key={label} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:10,height:10,borderRadius:2,background:color,flexShrink:0}}/>
            <span style={{fontSize:11,color:'#6B7280'}}>{label}</span>
          </div>
        ))}
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <div style={{width:10,height:10,borderRadius:2,background:'#CBD5E1',border:'1px dashed #94A3B8',flexShrink:0}}/>
          <span style={{fontSize:11,color:'#6B7280'}}>Preview example</span>
        </div>
      </div>

      {/* Preview legend */}
      {previewAppts.length > 0 && (
        <div style={{marginTop:12,padding:'8px 14px',background:'#FFFBEB',borderRadius:10,
          fontSize:12,color:'#92400E',display:'flex',alignItems:'center',gap:6}}>
          <span>👁</span>
          <span>Dashed blocks are preview examples showing what a full day looks like. Real bookings appear solid.</span>
        </div>
      )}

      {selected && <DetailPanel appt={selected} therapist={therapist} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AppointmentCard({ appt, onClick, preview }) {
  const st = STATUS[appt.status] || STATUS['pending-intake'];
  return (
    <div onClick={onClick}
      style={{background:preview?'#FAFAF8':'#fff',
        border:`1.5px ${preview?'dashed':'solid'} ${preview?'#E5E7EB':st.dot+'40'}`,
        borderLeft:`4px solid ${preview?'#D1D5DB':st.dot}`,
        borderRadius:14,padding:'14px 16px',cursor:'pointer',
        display:'flex',alignItems:'center',gap:14,
        opacity:preview?0.75:1,
        transition:'all 0.15s',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}
      onMouseEnter={e=>{if(!preview){e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)';e.currentTarget.style.transform='translateY(-1px)';}}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)';e.currentTarget.style.transform='none';}}>
      
      {/* Time */}
      <div style={{minWidth:64,textAlign:'center',flexShrink:0}}>
        <div style={{fontSize:14,fontWeight:700,color:'#1F2937'}}>{appt.time}</div>
        <div style={{fontSize:11,color:'#9CA3AF'}}>{appt.duration}m</div>
      </div>

      {/* Avatar */}
      <div style={{width:40,height:40,borderRadius:'50%',flexShrink:0,
        background:preview?'#D1D5DB':avatarColor(appt.client),
        color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:13,fontWeight:700}}>
        {initials(appt.client)}
      </div>

      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:700,color:preview?'#9CA3AF':'#1F2937',marginBottom:2}}>
          {appt.client}
          {preview && <span style={{fontSize:10,fontWeight:600,background:'#F3F4F6',color:'#9CA3AF',borderRadius:4,padding:'1px 6px',marginLeft:6}}>PREVIEW</span>}
        </div>
        <div style={{fontSize:12,color:'#6B7280',display:'flex',gap:6,flexWrap:'wrap'}}>
          <span>{appt.service||'Session'}</span>
          {appt.sessions > 0 && <span>· {appt.sessions} sessions</span>}
          {appt.focus?.length > 0 && <span>· {appt.focus.slice(0,2).join(', ')}</span>}
        </div>
      </div>

      {/* Status badge */}
      <div style={{flexShrink:0,display:'flex',alignItems:'center',gap:6}}>
        <div style={{background:st.bg,color:st.color,borderRadius:20,padding:'4px 10px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
          {st.icon} {st.label}
        </div>
        <div style={{color:'#D1D5DB',fontSize:16}}>›</div>
      </div>
    </div>
  );
}

// ─── Weekly View ──────────────────────────────────────────────────────────────
function WeeklyView({ therapist, appointments }) {
  const APPTS = appointments || [];
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  const getMonday = d => { const x=new Date(d); const day=x.getDay(); x.setDate(x.getDate()+(day===0?-6:1-day)); x.setHours(0,0,0,0); return x; };
  const weekStart = addDays(getMonday(TODAY), weekOffset*7);
  const weekDays = [0,1,2,3,4,5,6].map(n=>addDays(weekStart,n));
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const weekAppts = APPTS.filter(a=>a.date>=weekStart&&a.date<addDays(weekStart,7));
  const realWeek = weekAppts.filter(a=>!a.preview);

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={()=>setWeekOffset(w=>w-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← Prev</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{weekOffset===0?'This Week':weekOffset===1?'Next Week':weekOffset===-1?'Last Week':fmtShort(weekStart)}</div>
          <div style={{fontSize:12,color:'#6B7280'}}>{realWeek.length} sessions{realWeek.length>0?` · Est. $${realWeek.reduce((s,a)=>s+(a.price||85),0)}`:''}</div>
        </div>
        <button onClick={()=>setWeekOffset(w=>w+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>Next →</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
        {weekDays.map((d,i)=>{
          const dayAppts=APPTS.filter(a=>sameDay(a.date,d));
          const isToday=sameDay(d,TODAY);
          return (
            <div key={i} style={{minHeight:100}}>
              <div style={{textAlign:'center',padding:'8px 4px',borderRadius:8,marginBottom:6,
                background:isToday?'#2A5741':'transparent',color:isToday?'#fff':'#6B7280'}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase'}}>{DAY_NAMES[i]}</div>
                <div style={{fontSize:14,fontWeight:600}}>{d.getDate()}</div>
              </div>
              {dayAppts.length===0
                ?<div style={{height:50,border:'1.5px dashed #E5E7EB',borderRadius:8}}/>
                :<div style={{display:'flex',flexDirection:'column',gap:3}}>
                  {dayAppts.map(appt=>{
                    const st=STATUS[appt.status]||STATUS['pending-intake'];
                    return (
                      <div key={appt.id} onClick={()=>setSelected(appt)}
                        style={{background:appt.preview?'#F9FAFB':st.bg,
                          borderLeft:`3px solid ${appt.preview?'#D1D5DB':st.dot}`,
                          borderRadius:6,padding:'5px 7px',cursor:'pointer',opacity:appt.preview?0.6:1}}>
                        <div style={{fontSize:10,fontWeight:700,color:appt.preview?'#9CA3AF':st.color}}>{appt.time}</div>
                        <div style={{fontSize:11,fontWeight:600,color:'#1F2937',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.client.split(' ')[0]}</div>
                        <div style={{fontSize:10,color:'#9CA3AF'}}>{appt.duration}m</div>
                      </div>
                    );
                  })}
                </div>
              }
            </div>
          );
        })}
      </div>
      {selected && <DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)}/>}
    </div>
  );
}

// ─── Monthly View ─────────────────────────────────────────────────────────────
function MonthlyView({ therapist, appointments }) {
  const APPTS = appointments || [];
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selected, setSelected] = useState(null);

  const viewMonth = new Date(TODAY.getFullYear(), TODAY.getMonth()+monthOffset, 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const offset = firstDayOfWeek===0?6:firstDayOfWeek-1;
  const calDays = [...Array(offset).fill(null), ...Array.from({length:daysInMonth},(_,i)=>new Date(viewMonth.getFullYear(),viewMonth.getMonth(),i+1))];
  const selectedDayAppts = APPTS.filter(a=>sameDay(a.date,selectedDate));

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={()=>setMonthOffset(m=>m-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← Prev</button>
        <div style={{fontSize:16,fontWeight:700,color:'#1F2937'}}>{fmtMonth(viewMonth)}</div>
        <button onClick={()=>setMonthOffset(m=>m+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>Next →</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4}}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
          <div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',padding:'4px 0'}}>{d}</div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:20}}>
        {calDays.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const dayAppts=APPTS.filter(a=>sameDay(a.date,d));
          const realAppts=dayAppts.filter(a=>!a.preview);
          const isToday=sameDay(d,TODAY); const isSel=sameDay(d,selectedDate);
          return (
            <div key={i} onClick={()=>setSelectedDate(d)}
              style={{minHeight:52,padding:6,borderRadius:8,cursor:'pointer',
                background:isSel?'#2A5741':isToday?'#F0FDF4':'#fff',
                border:`1.5px solid ${isSel?'#2A5741':isToday?'#86EFAC':'#F3F4F6'}`,
                transition:'all 0.1s'}}>
              <div style={{fontSize:12,fontWeight:600,color:isSel?'#fff':isToday?'#16A34A':'#6B7280',marginBottom:2}}>{d.getDate()}</div>
              {realAppts.length>0&&<div style={{fontSize:11,fontWeight:700,color:isSel?'#fff':'#1F2937'}}>{realAppts.length} session{realAppts.length>1?'s':''}</div>}
              <div style={{display:'flex',gap:2,marginTop:2}}>
                {dayAppts.filter(a=>!a.preview&&a.status==='intake-done').length>0&&!isSel&&<div style={{width:5,height:5,borderRadius:'50%',background:'#16A34A'}}/>}
                {dayAppts.filter(a=>!a.preview&&a.status==='pending-intake').length>0&&!isSel&&<div style={{width:5,height:5,borderRadius:'50%',background:'#F59E0B'}}/>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>
        {fmtShort(selectedDate)} — {selectedDayAppts.filter(a=>!a.preview).length} appointment{selectedDayAppts.filter(a=>!a.preview).length!==1?'s':''}
      </div>
      {selectedDayAppts.length===0
        ?<div style={{background:'#fff',borderRadius:12,padding:24,textAlign:'center',color:'#9CA3AF',fontSize:14}}>No appointments. Click a day to view.</div>
        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {selectedDayAppts.filter(a=>!a.preview).map(appt=><AppointmentCard key={appt.id} appt={appt} onClick={()=>setSelected(appt)}/>)}
          {selectedDayAppts.filter(a=>a.preview).length>0&&selectedDayAppts.filter(a=>!a.preview).length>0&&(
            <div style={{textAlign:'center',fontSize:11,color:'#9CA3AF',padding:'4px 0'}}>— preview examples —</div>
          )}
          {selectedDayAppts.filter(a=>a.preview).map(appt=><AppointmentCard key={appt.id} appt={appt} onClick={()=>setSelected(appt)} preview/>)}
        </div>
      }
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)}/>}
    </div>
  );
}

// ─── Insights View ────────────────────────────────────────────────────────────
function InsightsView({ appointments }) {
  const APPTS = (appointments||[]).filter(a=>!a.preview);
  const DAY_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayCounts=DAY_NAMES.map((name,i)=>{const jsDay=i===6?0:i+1;return{name,count:APPTS.filter(a=>a.date.getDay()===jsDay).length};});
  const maxDay=Math.max(...dayCounts.map(d=>d.count),1);
  const clientCounts={};
  APPTS.forEach(a=>{clientCounts[a.client]=(clientCounts[a.client]||0)+1;});
  const topClients=Object.entries(clientCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const intakePct=APPTS.length?Math.round((APPTS.filter(a=>a.status!=='pending-intake').length/APPTS.length)*100):0;
  const weeklyCounts=[3,2,1,0].map(w=>{const start=addDays(TODAY,-7*(w+1));const end=addDays(TODAY,-7*w);return{label:w===0?'This wk':`${w}w ago`,count:APPTS.filter(a=>a.date>=start&&a.date<end).length};});
  const maxWeek=Math.max(...weeklyCounts.map(w=>w.count),1);

  if(APPTS.length===0) return (
    <div style={{background:'#fff',borderRadius:14,padding:'40px 24px',textAlign:'center'}}>
      <div style={{fontSize:36,marginBottom:12}}>📊</div>
      <div style={{fontSize:16,fontWeight:600,color:'#1F2937',marginBottom:8}}>Insights will appear here</div>
      <div style={{fontSize:13,color:'#6B7280',lineHeight:1.6}}>Once clients start booking, you'll see your busiest days, top clients, and booking trends.</div>
    </div>
  );

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',gridColumn:'1/-1'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1F2937',marginBottom:16}}>📊 Busiest Days</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:10,height:100}}>
          {dayCounts.map(({name,count})=>(
            <div key={name} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>{count||''}</div>
              <div style={{width:'100%',background:'#2A5741',borderRadius:'4px 4px 0 0',height:`${Math.max((count/maxDay)*75,count>0?6:2)}px`,opacity:count>0?1:0.12}}/>
              <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF'}}>{name}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1F2937',marginBottom:16}}>📈 Weekly Trend</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:8,height:80}}>
          {weeklyCounts.map(({label,count})=>(
            <div key={label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6B9E80'}}>{count}</div>
              <div style={{width:'100%',background:'#6B9E80',borderRadius:'4px 4px 0 0',height:`${Math.max((count/maxWeek)*60,count>0?6:2)}px`}}/>
              <div style={{fontSize:10,color:'#9CA3AF',textAlign:'center'}}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1F2937',marginBottom:8}}>✅ Intake Rate</div>
        <div style={{fontSize:40,fontWeight:700,color:'#2A5741',fontFamily:'Georgia,serif'}}>{intakePct}%</div>
        <div style={{fontSize:12,color:'#6B7280',marginTop:4}}>sessions with intake</div>
        <div style={{marginTop:10,background:'#E5E7EB',borderRadius:99,height:6}}>
          <div style={{width:`${intakePct}%`,background:'#2A5741',borderRadius:99,height:6,transition:'width 0.6s ease'}}/>
        </div>
      </div>
      <div style={{background:'#fff',borderRadius:12,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1F2937',marginBottom:14}}>⭐ Top Clients</div>
        {topClients.length===0?<div style={{fontSize:13,color:'#9CA3AF'}}>No data yet</div>
        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {topClients.map(([name,count])=>(
            <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:avatarColor(name),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{initials(name)}</div>
                <span style={{fontSize:13,fontWeight:600,color:'#1F2937'}}>{name}</span>
              </div>
              <span style={{fontSize:12,color:'#6B7280'}}>{count} sessions</span>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function ScheduleDashboard({ therapist }) {
  const [subView, setSubView] = useState('today');
  const [realBookings, setRealBookings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if(therapist?.id) fetchBookings(); }, [therapist?.id]);

  async function fetchBookings() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) { setLoading(false); return; }

      const past = new Date(TODAY); past.setDate(past.getDate()-30);
      const future = new Date(TODAY); future.setDate(future.getDate()+60);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, services(name,duration,price)')
        .eq('therapist_id', therapist.id)
        .neq('status','cancelled')
        .gte('booking_date', past.toISOString().split('T')[0])
        .lte('booking_date', future.toISOString().split('T')[0])
        .order('booking_date').order('start_time');

      if(error) { console.error('Bookings error:', error); setLoading(false); return; }

      if(bookings?.length > 0) {
        const mapped = bookings.map(b => {
          const bookingDate = new Date(b.booking_date+'T12:00:00'); bookingDate.setHours(0,0,0,0);
          const [h,m] = b.start_time.split(':').map(Number);
          return {
            id: b.id, client: b.client_name, email: b.client_email,
            time: fmt12(`${h}:${m}`), duration: b.services?.duration||60,
            date: bookingDate, status: 'pending-intake', sessions: 0,
            service: b.services?.name||'Session', notes: b.notes||'',
            price: b.services?.price||85, focus: [], preview: false, source: 'native',
          };
        });
        setRealBookings(mapped);
      } else {
        setRealBookings([]);
      }
    } catch(err) { console.error('Fetch error:', err); }
    setLoading(false);
  }

  // Merge: real bookings + sample preview (show sample when < 3 real bookings)
  const hasReal = realBookings && realBookings.length > 0;
  const showSample = !realBookings || realBookings.length < 3;
  const allAppts = [...(realBookings||[]), ...(showSample ? SAMPLE : [])];

  const TABS = [
    {id:'today',label:'Today'},
    {id:'weekly',label:'Weekly'},
    {id:'monthly',label:'Monthly'},
    {id:'insights',label:'Insights'},
  ];

  return (
    <div style={{width:'100%'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:'#1F2937',margin:'0 0 2px'}}>Schedule</h2>
          <p style={{fontSize:13,color:'#6B7280',margin:0}}>{fmtDay(TODAY)}</p>
        </div>
        {hasReal && (
          <div style={{display:'flex',alignItems:'center',gap:8,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:10,padding:'8px 14px',fontSize:12,color:'#16A34A',fontWeight:600}}>
            ✅ Live bookings active
            <button onClick={fetchBookings} style={{background:'transparent',border:'1px solid #16A34A',borderRadius:6,padding:'2px 8px',fontSize:11,color:'#16A34A',cursor:'pointer',marginLeft:4}}>↻</button>
          </div>
        )}
        {!hasReal && !loading && (
          <div style={{background:'#FFF7ED',border:'1.5px dashed #F97316',borderRadius:10,padding:'8px 14px',fontSize:12,color:'#9A3412',display:'flex',alignItems:'center',gap:6}}>
            👁️ <span><strong>Preview mode</strong> — share your booking link to get real sessions</span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:2,background:'#F3F4F6',borderRadius:12,padding:4,marginBottom:24,width:'fit-content'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubView(t.id)}
            style={{background:subView===t.id?'#fff':'transparent',
              color:subView===t.id?'#1F2937':'#6B7280',
              border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',
              boxShadow:subView===t.id?'0 1px 4px rgba(0,0,0,0.1)':'none',transition:'all 0.15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading
        ?<div style={{textAlign:'center',padding:'40px',color:'#9CA3AF',fontSize:14}}>Loading your schedule...</div>
        :<>
          {subView==='today'    && <TodayView therapist={therapist} allAppts={allAppts}/>}
          {subView==='weekly'   && <WeeklyView therapist={therapist} appointments={allAppts}/>}
          {subView==='monthly'  && <MonthlyView therapist={therapist} appointments={allAppts}/>}
          {subView==='insights' && <InsightsView appointments={allAppts}/>}
        </>
      }
    </div>
  );
}
