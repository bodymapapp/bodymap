import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const sameDay = (a,b) => a.toDateString()===b.toDateString();
const fmt12 = t => { if(!t) return ''; const [h,m]=t.toString().split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const fmtDay = d => d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
const fmtShort = d => d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const fmtMonth = d => d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
const initials = n => n?.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?';
const COLORS = ['#2A5741','#3B6B8A','#7B5EA7','#C05621','#276749','#2C5282'];
const ac = n => COLORS[(n?.charCodeAt(0)||0)%COLORS.length];
const t2m = t => { if(!t) return 0; const m=t.match(/(\d+):(\d+)\s*(AM|PM)/i); if(!m) return 0; let h=parseInt(m[1]),mn=parseInt(m[2]); if(m[3].toUpperCase()==='PM'&&h!==12)h+=12; if(m[3].toUpperCase()==='AM'&&h===12)h=0; return h*60+mn; };

const STATUS = {
  'intake-done':    {label:'Brief Ready', bg:'#DCFCE7', color:'#16A34A', dot:'#16A34A', icon:'🧭'},
  'pending-intake': {label:'No Intake',   bg:'#FEF3C7', color:'#D97706', dot:'#F59E0B', icon:'📋'},
  'complete':       {label:'Complete',    bg:'#F3F4F6', color:'#6B7280', dot:'#9CA3AF', icon:'✓'},
};

const SAMPLE = [
  {id:'s1',client:'Emma R.',   time:'9:00 AM', duration:60,date:addDays(TODAY,0),status:'intake-done',   sessions:4, preview:true,service:'Swedish Massage',focus:['Neck','Shoulders'],notes:'Prefers quiet session'},
  {id:'s2',client:'Jess M.',   time:'10:30 AM',duration:90,date:addDays(TODAY,0),status:'pending-intake',sessions:1, preview:true,service:'Deep Tissue',    focus:[],              notes:''},
  {id:'s3',client:'Maria L.',  time:'2:00 PM', duration:60,date:addDays(TODAY,0),status:'complete',      sessions:12,preview:true,service:'Hot Stone',      focus:['Lower Back'],  notes:'Monthly regular'},
  {id:'s4',client:'Dana P.',   time:'9:00 AM', duration:90,date:addDays(TODAY,1),status:'pending-intake',sessions:3, preview:true,service:'Swedish Massage',focus:[],              notes:''},
  {id:'s5',client:'Amy W.',    time:'11:00 AM',duration:60,date:addDays(TODAY,1),status:'intake-done',   sessions:5, preview:true,service:'Sports Massage', focus:['Legs','Feet'], notes:'Runner'},
  {id:'s6',client:'Emma R.',   time:'9:00 AM', duration:60,date:addDays(TODAY,3),status:'pending-intake',sessions:5, preview:true,service:'Swedish Massage',focus:[],              notes:''},
  {id:'s7',client:'Jess M.',   time:'3:00 PM', duration:60,date:addDays(TODAY,4),status:'pending-intake',sessions:2, preview:true,service:'Deep Tissue',    focus:[],              notes:''},
];

function DetailPanel({ appt, therapist, onClose }) {
  const st = STATUS[appt.status]||STATUS['pending-intake'];
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const [copied,setCopied] = useState(false);
  const firstName = appt.client?.split(' ')[0];
  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:360,maxWidth:'92vw',background:'#fff',zIndex:301,overflowY:'auto',boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'20px 20px 16px',borderBottom:'1px solid #F3F4F6'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:48,height:48,borderRadius:'50%',background:ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700}}>{initials(appt.client)}</div>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:'#1F2937',fontFamily:'Georgia,serif'}}>{appt.client}</div>
                <div style={{fontSize:12,color:'#6B7280'}}>{appt.sessions} sessions{appt.preview?' · Preview':''}</div>
              </div>
            </div>
            <button onClick={onClose} style={{background:'#F3F4F6',border:'none',borderRadius:'50%',width:32,height:32,cursor:'pointer',fontSize:16,color:'#6B7280'}}>✕</button>
          </div>
          <div style={{background:'#F9FAFB',borderRadius:10,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{appt.time} · {appt.duration} min</div>
              <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>{appt.service||'Session'}</div>
            </div>
            <div style={{background:st.bg,color:st.color,borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700}}>{st.icon} {st.label}</div>
          </div>
        </div>
        <div style={{flex:1,padding:20,display:'flex',flexDirection:'column',gap:14}}>
          {appt.focus?.length>0 && (
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#9CA3AF',marginBottom:8}}>Focus Areas</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {appt.focus.map(f=><span key={f} style={{background:'#DCFCE7',color:'#16A34A',borderRadius:20,padding:'4px 12px',fontSize:12,fontWeight:600}}>{f}</span>)}
              </div>
            </div>
          )}
          {appt.notes && <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#92400E',lineHeight:1.5}}>📝 {appt.notes}</div>}
          {!appt.preview && (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:appt.reminder_sent?'#F0FDF4':'#F9FAFB',borderRadius:10,border:`1px solid ${appt.reminder_sent?'#86EFAC':'#E5E7EB'}`}}>
              <span style={{fontSize:16}}>{appt.reminder_sent?'📧':'⏳'}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:appt.reminder_sent?'#16A34A':'#6B7280'}}>{appt.reminder_sent?'Reminder sent':'Reminder pending'}</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>{appt.reminder_sent?'Client received email 24h before session':'Sends automatically 24h before session'}</div>
              </div>
            </div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {appt.status==='intake-done' && appt.sessionId && (
              <a href={`/brief/pre/${appt.sessionId}`} target="_blank" rel="noreferrer" style={{display:'block',background:'#2A5741',color:'#fff',borderRadius:10,padding:'13px 16px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>🧭 Open Pre-Session Brief</a>
            )}
            {appt.status==='pending-intake' && (
              <a href={`sms:&body=${encodeURIComponent(`Hi ${firstName}! Please fill your intake form: ${intakeUrl}`)}`} style={{display:'block',background:'#2A5741',color:'#fff',borderRadius:10,padding:'13px 16px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>💬 Send Intake via SMS</a>
            )}
            <button onClick={()=>{navigator.clipboard.writeText(intakeUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{background:'transparent',color:'#6B9E80',border:'1.5px solid #6B9E80',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
              {copied?'✓ Copied!':'📋 Copy Intake Link'}
            </button>
          </div>
          {appt.preview && <div style={{background:'#FEF3C7',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#92400E',textAlign:'center'}}>Preview card — real clients appear here after booking.</div>}
        </div>
      </div>
    </>
  );
}

function TimelineView({ therapist, allAppts, dayOffset, setDayOffset }) {
  const [selected,setSelected] = useState(null);
  const now = new Date();
  const nowMin = dayOffset===0 ? now.getHours()*60+now.getMinutes() : -1;
  const viewDate = addDays(TODAY,dayOffset);
  const dayAppts = allAppts.filter(a=>sameDay(a.date,viewDate));
  const sorted = [...dayAppts].sort((a,b)=>t2m(a.time)-t2m(b.time));

  // Dynamic range
  const starts = dayAppts.map(a=>t2m(a.time));
  const ends = dayAppts.map(a=>t2m(a.time)+a.duration);
  const TL_START = starts.length ? Math.max(7*60, Math.min(...starts)-30) : 8*60;
  const TL_END   = ends.length   ? Math.min(21*60, Math.max(...ends)+45)  : 17*60;
  const PX = 0.85;
  const H = (TL_END-TL_START)*PX;
  const GUTTER = 48;

  // Gap detection
  const gaps = [];
  for(let i=0;i<sorted.length-1;i++){
    const aEnd=t2m(sorted[i].time)+sorted[i].duration;
    const bStart=t2m(sorted[i+1].time);
    if(bStart-aEnd>90) gaps.push({start:aEnd,end:bStart,mins:bStart-aEnd});
  }

  const hourNums = [];
  for(let h=Math.floor(TL_START/60);h<=Math.ceil(TL_END/60);h++) hourNums.push(h);

  return (
    <div>
      {/* Legend */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12,padding:'10px 14px',background:'#fff',borderRadius:10,border:'1px solid #F3F4F6',alignItems:'center'}}>
        <span style={{fontSize:11,fontWeight:700,color:'#374151'}}>HOW TO READ:</span>
        {[{color:'#16A34A',bg:'#DCFCE7',label:'Brief ready'},{color:'#D97706',bg:'#FEF3C7',label:'No intake yet'},{color:'#6B7280',bg:'#F3F4F6',label:'Complete'}].map(({color,bg,label})=>(
          <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:12,height:12,borderRadius:3,background:bg,border:`2px solid ${color}`}}/>
            <span style={{fontSize:11,color:'#6B7280'}}>{label}</span>
          </div>
        ))}
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <div style={{width:12,height:12,borderRadius:3,background:'#F8F8F8',border:'1.5px dashed #CBD5E1'}}/>
          <span style={{fontSize:11,color:'#9CA3AF'}}>Preview</span>
        </div>
        <span style={{fontSize:10,color:'#9CA3AF',marginLeft:'auto'}}>Tap block for details</span>
      </div>

      {/* Timeline */}
      <div style={{background:'#fff',borderRadius:16,padding:'16px 14px 20px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        {dayAppts.length===0 ? (
          <div style={{textAlign:'center',padding:'32px 0'}}>
            <div style={{fontSize:32,marginBottom:10}}>🌿</div>
            <div style={{fontSize:15,fontWeight:600,color:'#1F2937',marginBottom:6}}>No sessions {dayOffset===0?'today':'this day'}</div>
            <div style={{fontSize:13,color:'#9CA3AF'}}>Share your booking link to fill your schedule.</div>
          </div>
        ) : (
          <div style={{position:'relative',height:H,marginLeft:GUTTER}}>
            {/* Hour lines */}
            {hourNums.map(h=>{
              const y=(h*60-TL_START)*PX;
              const label=h===12?'12 PM':h<12?`${h} AM`:`${h-12} PM`;
              return (
                <div key={h}>
                  <div style={{position:'absolute',top:y,left:-GUTTER,width:GUTTER-6,textAlign:'right',fontSize:10,fontWeight:600,color:'#9CA3AF',transform:'translateY(-50%)',userSelect:'none'}}>{label}</div>
                  <div style={{position:'absolute',top:y,left:0,right:0,borderTop:'1px solid #F3F4F6'}}/>
                </div>
              );
            })}
            {/* Gap indicators */}
            {gaps.map((g,i)=>{
              const y=(g.start-TL_START)*PX;
              const gh=g.mins*PX;
              const hrs=Math.floor(g.mins/60), mins=g.mins%60;
              const lbl=hrs>0?`${hrs}h${mins>0?` ${mins}m`:''} gap`:`${mins}m gap`;
              return (
                <div key={i} style={{position:'absolute',top:y,left:0,right:0,height:gh,background:'repeating-linear-gradient(45deg,transparent,transparent 5px,#FFFBEB 5px,#FFFBEB 6px)',border:'1px dashed #FCD34D',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',opacity:0.8}}>
                  {gh>18 && <span style={{fontSize:10,fontWeight:700,color:'#D97706',background:'#FFFBEB',padding:'2px 8px',borderRadius:20,border:'1px solid #FCD34D'}}>⚡ {lbl} — book a client here</span>}
                </div>
              );
            })}
            {/* Now line */}
            {nowMin>=TL_START&&nowMin<=TL_END&&(
              <div style={{position:'absolute',top:(nowMin-TL_START)*PX,left:-6,right:0,zIndex:10,pointerEvents:'none',display:'flex',alignItems:'center'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#EF4444',flexShrink:0}}/>
                <div style={{flex:1,height:2,background:'#EF4444',opacity:0.6}}/>
              </div>
            )}
            {/* Appointment blocks */}
            {sorted.map(appt=>{
              const y=(t2m(appt.time)-TL_START)*PX;
              const bh=Math.max(appt.duration*PX,36);
              const st=STATUS[appt.status]||STATUS['pending-intake'];
              const isSel=selected?.id===appt.id;
              const isPast=dayOffset===0&&t2m(appt.time)+appt.duration<nowMin;
              return (
                <div key={appt.id} onClick={()=>setSelected(isSel?null:appt)}
                  style={{position:'absolute',top:y,left:2,right:2,height:bh,
                    background:appt.preview?'#F9FAFB':(appt.status==='intake-done'?'#DCFCE7':appt.status==='complete'?'#F3F4F6':'#FEF3C7'),
                    border:`1.5px ${appt.preview?'dashed':'solid'} ${appt.preview?'#D1D5DB':st.dot}`,
                    borderLeft:`4px solid ${appt.preview?'#CBD5E1':st.dot}`,
                    borderRadius:10,cursor:'pointer',overflow:'hidden',
                    opacity:appt.preview?0.5:isPast?0.6:1,
                    boxShadow:isSel?'0 4px 20px rgba(0,0,0,0.15)':appt.preview?'none':'0 2px 8px rgba(0,0,0,0.07)',
                    transform:isSel?'scale(1.01)':'none',zIndex:isSel?5:1,transition:'all 0.15s'}}>
                  <div style={{padding:'5px 10px',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                      <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:0}}>
                        <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,background:appt.preview?'#D1D5DB':ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>{initials(appt.client)}</div>
                        <span style={{fontSize:12,fontWeight:700,color:appt.preview?'#9CA3AF':'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.client}</span>
                        {appt.preview&&<span style={{fontSize:9,fontWeight:700,color:'#94A3B8',background:'#F1F5F9',borderRadius:4,padding:'1px 5px',flexShrink:0}}>PREVIEW</span>}
                      </div>
                      <div style={{flexShrink:0,textAlign:'right'}}>
                        <div style={{fontSize:11,fontWeight:700,color:appt.preview?'#C4C4C4':'#1F2937'}}>{appt.time}</div>
                        <div style={{fontSize:10,color:'#9CA3AF'}}>{appt.duration}m</div>
                        {!appt.preview&&appt.reminder_sent&&<div style={{fontSize:9,color:'#16A34A',fontWeight:700,marginTop:1}}>📧 Reminded</div>}
                        {!appt.preview&&!appt.reminder_sent&&<div style={{fontSize:9,color:'#9CA3AF',marginTop:1}}>📧 Pending</div>}
                      </div>
                    </div>
                    {bh>52&&<div style={{fontSize:11,color:appt.preview?'#C4C4C4':st.color,marginLeft:30}}>{appt.service}{appt.focus?.length>0?` · ${appt.focus.slice(0,2).join(', ')}`:''}
                    </div>}
                    {bh>72&&(
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{background:appt.preview?'transparent':st.dot+'22',color:appt.preview?'#C4C4C4':st.color,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{st.icon} {st.label}</div>
                        {!appt.preview&&appt.status==='intake-done'&&<div style={{fontSize:10,fontWeight:700,color:'#2A5741',background:'#DCFCE7',borderRadius:20,padding:'2px 8px'}}>Brief ready →</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)}/>}
    </div>
  );
}

function WeeklyView({ therapist, appointments }) {
  const APPTS=appointments||[];
  const [weekOffset,setWeekOffset]=useState(0);
  const [selected,setSelected]=useState(null);
  const getMonday=d=>{const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()+(day===0?-6:1-day));x.setHours(0,0,0,0);return x;};
  const weekStart=addDays(getMonday(TODAY),weekOffset*7);
  const weekDays=[0,1,2,3,4,5,6].map(n=>addDays(weekStart,n));
  const DAY_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const weekAppts=APPTS.filter(a=>a.date>=weekStart&&a.date<addDays(weekStart,7));
  const realWeek=weekAppts.filter(a=>!a.preview);
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={()=>setWeekOffset(w=>w-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← Prev</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{weekOffset===0?'This Week':weekOffset===1?'Next Week':weekOffset===-1?'Last Week':fmtShort(weekStart)}</div>
          <div style={{fontSize:12,color:'#6B7280'}}>{realWeek.length} sessions</div>
        </div>
        <button onClick={()=>setWeekOffset(w=>w+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>Next →</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
        {weekDays.map((d,i)=>{
          const dayAppts=APPTS.filter(a=>sameDay(a.date,d));
          const isToday=sameDay(d,TODAY);
          return (
            <div key={i} style={{minHeight:90}}>
              <div style={{textAlign:'center',padding:'7px 4px',borderRadius:8,marginBottom:5,background:isToday?'#2A5741':'transparent',color:isToday?'#fff':'#6B7280'}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase'}}>{DAY_NAMES[i]}</div>
                <div style={{fontSize:13,fontWeight:600}}>{d.getDate()}</div>
              </div>
              {dayAppts.length===0
                ?<div style={{height:40,border:'1.5px dashed #E5E7EB',borderRadius:8}}/>
                :<div style={{display:'flex',flexDirection:'column',gap:3}}>
                  {dayAppts.map(appt=>{
                    const st=STATUS[appt.status]||STATUS['pending-intake'];
                    return (
                      <div key={appt.id} onClick={()=>setSelected(appt)}
                        style={{background:appt.preview?'#F9FAFB':st.bg,borderLeft:`3px solid ${appt.preview?'#D1D5DB':st.dot}`,borderRadius:6,padding:'5px 7px',cursor:'pointer',opacity:appt.preview?0.5:1}}>
                        <div style={{fontSize:10,fontWeight:700,color:appt.preview?'#9CA3AF':st.color}}>{appt.time}</div>
                        <div style={{fontSize:11,fontWeight:600,color:'#1F2937',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.client.split(' ')[0]}</div>
                      </div>
                    );
                  })}
                </div>
              }
            </div>
          );
        })}
      </div>
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)}/>}
    </div>
  );
}

function MonthlyView({ therapist, appointments }) {
  const APPTS=appointments||[];
  const [monthOffset,setMonthOffset]=useState(0);
  const [selDate,setSelDate]=useState(TODAY);
  const [selected,setSelected]=useState(null);
  const viewMonth=new Date(TODAY.getFullYear(),TODAY.getMonth()+monthOffset,1);
  const daysInMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,0).getDate();
  const firstDay=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),1).getDay();
  const offset=firstDay===0?6:firstDay-1;
  const calDays=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,i)=>new Date(viewMonth.getFullYear(),viewMonth.getMonth(),i+1))];
  const selAppts=APPTS.filter(a=>sameDay(a.date,selDate));
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={()=>setMonthOffset(m=>m-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← Prev</button>
        <div style={{fontSize:16,fontWeight:700,color:'#1F2937'}}>{fmtMonth(viewMonth)}</div>
        <button onClick={()=>setMonthOffset(m=>m+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>Next →</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4}}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:20}}>
        {calDays.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const da=APPTS.filter(a=>sameDay(a.date,d));
          const ra=da.filter(a=>!a.preview);
          const isToday=sameDay(d,TODAY),isSel=sameDay(d,selDate);
          return (
            <div key={i} onClick={()=>setSelDate(d)}
              style={{minHeight:48,padding:5,borderRadius:8,cursor:'pointer',background:isSel?'#2A5741':isToday?'#F0FDF4':'#fff',border:`1.5px solid ${isSel?'#2A5741':isToday?'#86EFAC':'#F3F4F6'}`,transition:'all 0.1s'}}>
              <div style={{fontSize:11,fontWeight:600,color:isSel?'#fff':isToday?'#16A34A':'#6B7280',marginBottom:2}}>{d.getDate()}</div>
              {ra.length>0&&<div style={{fontSize:11,fontWeight:700,color:isSel?'#fff':'#1F2937'}}>{ra.length} appt{ra.length>1?'s':''}</div>}
              <div style={{display:'flex',gap:2,marginTop:2}}>
                {da.filter(a=>!a.preview&&a.status==='intake-done').length>0&&!isSel&&<div style={{width:5,height:5,borderRadius:'50%',background:'#16A34A'}}/>}
                {da.filter(a=>!a.preview&&a.status==='pending-intake').length>0&&!isSel&&<div style={{width:5,height:5,borderRadius:'50%',background:'#F59E0B'}}/>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>
        {fmtShort(selDate)} — {selAppts.filter(a=>!a.preview).length} appointment{selAppts.filter(a=>!a.preview).length!==1?'s':''}
      </div>
      {selAppts.length===0
        ?<div style={{background:'#fff',borderRadius:12,padding:24,textAlign:'center',color:'#9CA3AF',fontSize:14}}>No appointments on this day.</div>
        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {selAppts.filter(a=>!a.preview).map(appt=>(
            <div key={appt.id} onClick={()=>setSelected(appt)}
              style={{background:(STATUS[appt.status]||STATUS['pending-intake']).bg,border:`1.5px solid ${(STATUS[appt.status]||STATUS['pending-intake']).dot}`,borderLeft:`4px solid ${(STATUS[appt.status]||STATUS['pending-intake']).dot}`,borderRadius:12,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{initials(appt.client)}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:'#1F2937'}}>{appt.client}</div>
                <div style={{fontSize:12,color:'#6B7280'}}>{appt.time} · {appt.duration}min · {appt.service||'Session'}</div>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:(STATUS[appt.status]||STATUS['pending-intake']).color}}>{(STATUS[appt.status]||STATUS['pending-intake']).icon} {(STATUS[appt.status]||STATUS['pending-intake']).label}</div>
            </div>
          ))}
        </div>
      }
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)}/>}
    </div>
  );
}

function InsightsView({ appointments }) {
  const APPTS=(appointments||[]).filter(a=>!a.preview);
  if(APPTS.length===0) return (
    <div style={{background:'#fff',borderRadius:14,padding:'40px 24px',textAlign:'center'}}>
      <div style={{fontSize:36,marginBottom:12}}>📊</div>
      <div style={{fontSize:16,fontWeight:600,color:'#1F2937',marginBottom:8}}>Insights will appear here</div>
      <div style={{fontSize:13,color:'#6B7280',lineHeight:1.6}}>Once clients start booking, you'll see your busiest days, top clients, and booking trends.</div>
    </div>
  );
  const DAY_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayCounts=DAY_NAMES.map((name,i)=>{const jsDay=i===6?0:i+1;return{name,count:APPTS.filter(a=>a.date.getDay()===jsDay).length};});
  const maxDay=Math.max(...dayCounts.map(d=>d.count),1);
  const clientCounts={};APPTS.forEach(a=>{clientCounts[a.client]=(clientCounts[a.client]||0)+1;});
  const topClients=Object.entries(clientCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const intakePct=Math.round((APPTS.filter(a=>a.status!=='pending-intake').length/APPTS.length)*100);
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{background:'#fff',borderRadius:12,padding:20,gridColumn:'1/-1'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1F2937',marginBottom:16}}>📊 Busiest Days</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:10,height:90}}>
          {dayCounts.map(({name,count})=>(
            <div key={name} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>{count||''}</div>
              <div style={{width:'100%',background:'#2A5741',borderRadius:'4px 4px 0 0',height:`${Math.max((count/maxDay)*70,count>0?4:2)}px`,opacity:count>0?1:0.1}}/>
              <div style={{fontSize:10,color:'#9CA3AF'}}>{name}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:'#fff',borderRadius:12,padding:20}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1F2937',marginBottom:8}}>✅ Intake Rate</div>
        <div style={{fontSize:36,fontWeight:700,color:'#2A5741',fontFamily:'Georgia,serif'}}>{intakePct}%</div>
        <div style={{marginTop:8,background:'#E5E7EB',borderRadius:99,height:6}}>
          <div style={{width:`${intakePct}%`,background:'#2A5741',borderRadius:99,height:6}}/>
        </div>
      </div>
      <div style={{background:'#fff',borderRadius:12,padding:20}}>
        <div style={{fontSize:13,fontWeight:700,color:'#1F2937',marginBottom:14}}>⭐ Top Clients</div>
        {topClients.map(([name,count])=>(
          <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:ac(name),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{initials(name)}</div>
              <span style={{fontSize:13,fontWeight:600,color:'#1F2937'}}>{name}</span>
            </div>
            <span style={{fontSize:12,color:'#6B7280'}}>{count} sessions</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScheduleDashboard({ therapist }) {
  const [subView,setSubView]=useState('today');
  const [dayOffset,setDayOffset]=useState(0);
  const [realBookings,setRealBookings]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{if(therapist?.id)fetchBookings();},[therapist?.id]);

  async function fetchBookings() {
    setLoading(true);
    try {
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){setLoading(false);return;}
      const past=new Date(TODAY);past.setDate(past.getDate()-30);
      const future=new Date(TODAY);future.setDate(future.getDate()+60);
      const {data:bookings,error}=await supabase.from('bookings').select('*,services(name,duration,price),reminder_sent_at').eq('therapist_id',therapist.id).neq('status','cancelled').gte('booking_date',past.toISOString().split('T')[0]).lte('booking_date',future.toISOString().split('T')[0]).order('booking_date').order('start_time');
      if(error||!bookings?.length){setRealBookings([]);setLoading(false);return;}
      const mapped=bookings.map(b=>{
        const bd=new Date(b.booking_date+'T12:00:00');bd.setHours(0,0,0,0);
        const [h,m]=b.start_time.split(':').map(Number);
        return {id:b.id,client:b.client_name,email:b.client_email,time:fmt12(`${h}:${m}`),duration:b.services?.duration||60,date:bd,status:'pending-intake',sessions:0,service:b.services?.name||'Session',notes:b.notes||'',price:b.services?.price||85,focus:[],preview:false};
      });
      setRealBookings(mapped);
    } catch(err){console.error(err);}
    setLoading(false);
  }

  const showSample=!realBookings||realBookings.length<5;
  const allAppts=[...(realBookings||[]),...(showSample?SAMPLE:[])];
  const TABS=[{id:'today',label:'Today'},{id:'weekly',label:'Weekly'},{id:'monthly',label:'Monthly'},{id:'insights',label:'Insights'}];

  return (
    <div style={{width:'100%'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:'#1F2937',margin:'0 0 2px'}}>Schedule</h2>
          <p style={{fontSize:13,color:'#6B7280',margin:0}}>{fmtDay(TODAY)}</p>
        </div>
        {realBookings?.length>0
          ?<div style={{display:'flex',alignItems:'center',gap:8,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:10,padding:'8px 14px',fontSize:12,color:'#16A34A',fontWeight:600}}>
            ✅ Live bookings active
            <button onClick={fetchBookings} style={{background:'transparent',border:'1px solid #16A34A',borderRadius:6,padding:'2px 8px',fontSize:11,color:'#16A34A',cursor:'pointer',marginLeft:4}}>↻</button>
          </div>
          :<div style={{background:'#FFF7ED',border:'1.5px dashed #F97316',borderRadius:10,padding:'8px 14px',fontSize:12,color:'#9A3412',display:'flex',alignItems:'center',gap:6}}>
            👁️ <span><strong>Preview mode</strong> — share your booking link to get real sessions</span>
          </div>
        }
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
        {[
          {val:allAppts.filter(a=>sameDay(a.date,TODAY)&&!a.preview).length,label:"Today",color:'#2A5741'},
          {val:allAppts.filter(a=>sameDay(a.date,TODAY)&&!a.preview&&a.status==='intake-done').length,label:'Brief ready',color:'#16A34A'},
          {val:allAppts.filter(a=>sameDay(a.date,TODAY)&&!a.preview&&a.status==='pending-intake').length,label:'Need intake',color:'#D97706'},
          {val:allAppts.filter(a=>!a.preview&&a.date>=TODAY&&a.date<=addDays(TODAY,7)).length,label:'This week',color:'#6B9E80'},
        ].map(s=>(
          <div key={s.label} style={{background:'#fff',borderRadius:12,padding:'14px 12px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
            <div style={{fontSize:24,fontWeight:700,color:s.color,fontFamily:'Georgia,serif',lineHeight:1}}>{s.val}</div>
            <div style={{fontSize:11,color:'#9CA3AF',marginTop:3}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Day selector — only for today view */}
      {subView==='today'&&(
        <div style={{display:'flex',gap:6,marginBottom:20,overflowX:'auto',paddingBottom:2}}>
          {[0,1,2,3,4].map(i=>{
            const d=addDays(TODAY,i);
            const count=allAppts.filter(a=>sameDay(a.date,d)&&!a.preview).length;
            const isSel=i===dayOffset;
            return (
              <button key={i} onClick={()=>setDayOffset(i)}
                style={{flexShrink:0,background:isSel?'#2A5741':'#fff',color:isSel?'#fff':'#1F2937',border:`1.5px solid ${isSel?'#2A5741':'#E5E7EB'}`,borderRadius:12,padding:'10px 14px',cursor:'pointer',minWidth:70,textAlign:'center',transition:'all 0.15s'}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',opacity:0.75,marginBottom:2}}>{i===0?'Today':i===1?'Tmrw':d.toLocaleDateString('en-US',{weekday:'short'})}</div>
                <div style={{fontSize:17,fontWeight:700}}>{d.getDate()}</div>
                {count>0&&<div style={{fontSize:10,marginTop:2,opacity:0.7}}>{count} appt{count!==1?'s':''}</div>}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab bar */}
      <div style={{display:'flex',gap:2,background:'#F3F4F6',borderRadius:12,padding:4,marginBottom:20,width:'fit-content'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubView(t.id)}
            style={{background:subView===t.id?'#fff':'transparent',color:subView===t.id?'#1F2937':'#6B7280',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:subView===t.id?'0 1px 4px rgba(0,0,0,0.1)':'none',transition:'all 0.15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading
        ?<div style={{textAlign:'center',padding:'40px',color:'#9CA3AF',fontSize:14}}>Loading schedule...</div>
        :<>
          {subView==='today'   &&<TimelineView therapist={therapist} allAppts={allAppts} dayOffset={dayOffset} setDayOffset={setDayOffset}/>}
          {subView==='weekly'  &&<WeeklyView therapist={therapist} appointments={allAppts}/>}
          {subView==='monthly' &&<MonthlyView therapist={therapist} appointments={allAppts}/>}
          {subView==='insights'&&<InsightsView appointments={allAppts}/>}
        </>
      }
    </div>
  );
}
