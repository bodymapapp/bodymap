import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import BookingModal from './BookingModal';
import CancellationChargeModal from './CancellationChargeModal';
import SmartBookingRail from './schedule/SmartBookingRail';
import InlineTimeInput from './InlineTimeInput';

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
const getToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

const STATUS = {
  'intake-done':    {label:'Brief Ready', bg:'#DCFCE7', color:'#16A34A', dot:'#16A34A', icon:'🧭'},
  'pending-intake': {label:'No Intake',   bg:'#FEF3C7', color:'#D97706', dot:'#F59E0B', icon:'📋'},
  'complete':       {label:'Complete',    bg:'#F3F4F6', color:'#6B7280', dot:'#9CA3AF', icon:'✓'},
  'external':       {label:'From Google', bg:'#EFEAFD', color:'#5B4DC8', dot:'#7F77DD', icon:'📅'},
};

const makeSample = (today) => [
  {id:'s1',client:'Emma R.',   time:'9:00 AM', duration:60,date:addDays(today,0),status:'intake-done',   sessions:4, preview:true,service:'Swedish Massage',focus:[],notes:'Prefers quiet session'},
  {id:'s2',client:'Jess M.',   time:'10:30 AM',duration:90,date:addDays(today,0),status:'pending-intake',sessions:1, preview:true,service:'Deep Tissue',    focus:[],notes:''},
  {id:'s3',client:'Maria L.',  time:'2:00 PM', duration:60,date:addDays(today,0),status:'complete',      sessions:12,preview:true,service:'Hot Stone',      focus:[],notes:'Monthly regular'},
  {id:'s4',client:'Dana P.',   time:'9:00 AM', duration:90,date:addDays(today,1),status:'pending-intake',sessions:3, preview:true,service:'Swedish Massage',focus:[],notes:''},
  {id:'s5',client:'Amy W.',    time:'11:00 AM',duration:60,date:addDays(today,1),status:'intake-done',   sessions:5, preview:true,service:'Sports Massage', focus:[],notes:'Runner'},
  {id:'s6',client:'Emma R.',   time:'9:00 AM', duration:60,date:addDays(today,3),status:'pending-intake',sessions:5, preview:true,service:'Swedish Massage',focus:[],notes:''},
  {id:'s7',client:'Jess M.',   time:'3:00 PM', duration:60,date:addDays(today,4),status:'pending-intake',sessions:2, preview:true,service:'Deep Tissue',    focus:[],notes:''},
];

function DetailPanel({ appt, therapist, onClose, onReschedule, onCancelled }) {
  const st = STATUS[appt.status]||STATUS['pending-intake'];
  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const [copied,setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editTime, setEditTime] = useState(false);
  const [newStartTime, setNewStartTime] = useState(appt.startTime || '');
  const [newEndTime, setNewEndTime] = useState(appt.endTime || '');
  const [savingTime, setSavingTime] = useState(false);
  const firstName = appt.client?.split(' ')[0];
  const intakeLink = `${intakeUrl}?name=${encodeURIComponent(appt.client)}&email=${encodeURIComponent(appt.email)}&booking_id=${appt.id}`;

  async function saveEndTime() {
    setSavingTime(true);
    const updates = {};
    if (newStartTime) updates.start_time = newStartTime;
    if (newEndTime) updates.end_time = newEndTime;
    if (Object.keys(updates).length) {
      await supabase.from('bookings').update(updates).eq('id', appt.id);
    }
    setSavingTime(false);
    setEditTime(false);
    onCancelled?.();
  }

  async function cancelAppointment() {
    setCancelling(true);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', appt.id);

    // Notify the therapist (non-blocking). This is the legacy
    // inline confirm path that only fires when the full booking
    // row could not be loaded for the policy-aware modal.
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      fetch(`${supabaseUrl}/functions/v1/notify-booking-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ booking_id: appt.id, event_type: 'booking_cancelled' }),
      }).catch(() => { /* non-blocking */ });
    } catch (_notifyErr) { /* non-blocking */ }

    setCancelling(false);
    onCancelled?.();
    onClose();
  }

  // Policy-aware cancel: opens the CancellationChargeModal which
  // computes the fee from the therapist's policy + how much time is
  // left before the appointment, and gives the therapist three
  // options: charge fee + cancel, skip fee + cancel, or don't
  // cancel. Loads the booking's full client row + booking row so
  // the modal can inspect card-on-file across both processors.
  //
  // Called with { isNoShow: true } from the Mark No-Show button on
  // past bookings. The modal then computes the fee using the
  // therapist's policy.no_show_percent rather than the time-tier.
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeContext, setChargeContext] = useState(null);

  // A booking counts as past once its scheduled END time has passed.
  // appt.date is set to that day at 00:00 local; appt.time is a 12h
  // string like '9:00 AM'. Add minutes-since-midnight + duration to
  // the day's midnight to get the end-time epoch.
  const apptDayMs = appt?.date instanceof Date ? appt.date.getTime() : null;
  const apptEndMs = apptDayMs != null
    ? apptDayMs + (t2m(appt.time) + (appt.duration || 60)) * 60 * 1000
    : null;
  const isPastBooking = apptEndMs != null && apptEndMs < Date.now();
  // Only offer no-show on past bookings that have not already been
  // cancelled or completed. External Google events never reach here.
  const canMarkNoShow = isPastBooking
    && !appt.preview
    && appt.status !== 'cancelled'
    && appt.status !== 'complete';

  async function openCancelFlow({ isNoShow = false } = {}) {
    // Load full booking + client to know about card-on-file
    const { data: bookingRow } = await supabase
      .from('bookings').select('*').eq('id', appt.id).single();
    if (!bookingRow) {
      // Fallback to legacy inline confirm if we can't load the row
      setConfirmCancel(true);
      return;
    }
    let clientRow = null;
    if (bookingRow.client_id) {
      const { data } = await supabase
        .from('clients').select('*').eq('id', bookingRow.client_id).maybeSingle();
      clientRow = data;
    }
    // Compute session price from the appointment data we have, or
    // fall back to therapist's default service price.
    const sessionPriceCents = Math.round((appt.priceUsd || appt.price || 0) * 100);
    setChargeContext({ booking: bookingRow, client: clientRow, sessionPriceCents, isNoShow });
    setShowChargeModal(true);
  }

  // External Google Calendar events render a much simpler read-only
  // panel. No reschedule, no cancel, no intake link, no client info.
  // The therapist sees the event title (which she put there in
  // Google) and can hit Close. The slot is automatically blocked
  // for clients on the booking page. This branch sits AFTER all
  // hook calls so it doesn't violate rules-of-hooks.
  if (appt?.external) {
    return (
      <>
        <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300,backdropFilter:'blur(2px)'}}/>
        <div style={{position:'fixed',top:0,right:0,bottom:0,width:360,maxWidth:'100vw',background:'#fff',zIndex:301,overflowY:'auto',boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column',padding:'24px',paddingTop:'calc(env(safe-area-inset-top, 0px) + 24px)'}}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:18 }}>
            <div style={{ fontSize:26, marginTop:2 }}>📅</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#7F77DD', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
                From your Google Calendar
              </div>
              <div style={{
                fontSize:19, fontWeight:700, color:'#1F2937',
                fontFamily:'Georgia, serif',
                wordBreak:'break-word', lineHeight:1.3,
              }}>
                {appt.client || 'Calendar event'}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'transparent', border:'none', fontSize:22, cursor:'pointer', color:'#9CA3AF', padding:0, lineHeight:1 }}>×</button>
          </div>
          <div style={{
            background:'#F8F7FB', border:'1px solid #E1DEEF', borderRadius:10,
            padding:'14px 16px', marginBottom:16,
            fontSize:13, color:'#3D4A42', lineHeight:1.6,
          }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#1F2937' }}>
              {appt.isAllDay ? 'All day' : appt.time}{appt.duration && !appt.isAllDay ? ` · ${appt.duration} min` : ''}
            </div>
            <div style={{ fontSize:12, color:'#6B7280', marginTop:6 }}>
              {appt.date}
            </div>
          </div>
          <div style={{
            background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:10,
            padding:'12px 14px', marginBottom:16,
            fontSize:12, color:'#9A3412', lineHeight:1.55,
          }}>
            This time is blocked for clients on your booking page. To move or remove it, edit in Google Calendar. Changes show up here within 15 minutes.
          </div>
          <button onClick={onClose} style={{
            width:'100%', padding:'12px',
            background:'#F3F4F6', border:'none', borderRadius:10,
            fontSize:14, fontWeight:600, color:'#374151', cursor:'pointer',
          }}>
            Close
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300,backdropFilter:'blur(2px)'}}/>
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:360,maxWidth:'100vw',background:'#fff',zIndex:301,overflowY:'auto',boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column',paddingTop:'env(safe-area-inset-top, 0px)'}}>
        <div style={{padding:'14px 16px 14px',borderBottom:'1px solid #F3F4F6'}}>
          {/* Top row: avatar + name + close */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <div style={{width:42,height:42,borderRadius:'50%',background:ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,flexShrink:0}}>{initials(appt.client)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:16,fontWeight:700,color:'#1F2937',fontFamily:'Georgia,serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.client}</div>
              {appt.is_couples && appt.partner_name && (
                <div style={{fontSize:12,color:'#6B9E80',fontWeight:600}}>💑 with {appt.partner_name}</div>
              )}
              <div style={{fontSize:12,color:'#6B7280'}}>{appt.sessions>0?`${appt.sessions} sessions`:appt.preview?'Preview client':'New client'}</div>
            </div>
            <button onClick={onClose} style={{background:'#F3F4F6',border:'none',borderRadius:'50%',width:32,height:32,cursor:'pointer',fontSize:16,color:'#6B7280',flexShrink:0}}>✕</button>
          </div>
          {/* Time + status row */}
          <div style={{background:'#F9FAFB',borderRadius:10,padding:'10px 14px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{appt.time} · {appt.duration} min</div>
                <div style={{fontSize:12,color:'#6B7280',marginTop:2}}>{appt.service||'Session'}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <div style={{background:st.bg,color:st.color,borderRadius:20,padding:'4px 10px',fontSize:11,fontWeight:700}}>{st.icon} {st.label}</div>
                {!appt.preview && (
                  <button onClick={()=>setEditTime(v=>!v)}
                    style={{background:'transparent',border:'1px solid #D1D5DB',borderRadius:8,padding:'4px 8px',fontSize:11,fontWeight:600,color:'#6B7280',cursor:'pointer'}}>
                    {editTime ? 'Cancel' : '✏️ Edit'}
                  </button>
                )}
              </div>
            </div>
          </div>
          {editTime && !appt.preview && (
            <div style={{background:'#F0FDF4',border:'1.5px solid #86EFAC',borderRadius:10,padding:'14px 16px',margin:'0 0 0 0'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#2A5741',marginBottom:10}}>Edit session times</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#6B7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Start time</label>
                  <input type="time" value={newStartTime} onChange={e=>setNewStartTime(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',border:'1.5px solid #D1D5DB',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#6B7280',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>End time</label>
                  <input type="time" value={newEndTime} onChange={e=>setNewEndTime(e.target.value)}
                    style={{width:'100%',padding:'9px 10px',border:'1.5px solid #D1D5DB',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
                </div>
              </div>
              <button onClick={saveEndTime} disabled={savingTime}
                style={{width:'100%',padding:'9px 0',background:'#2A5741',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',opacity:savingTime?0.6:1}}>
                {savingTime ? 'Saving...' : 'Save times'}
              </button>
            </div>
          )}
        </div>
        <div style={{flex:1,padding:20,display:'flex',flexDirection:'column',gap:14}}>
          {!appt.preview && appt.deposit_required && (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:appt.deposit_paid?'#F0FDF4':'#FEF3C7',borderRadius:10,border:`1px solid ${appt.deposit_paid?'#86EFAC':'#FCD34D'}`}}>
              <span style={{fontSize:16}}>{appt.deposit_paid?'💳':'⏳'}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:appt.deposit_paid?'#16A34A':'#D97706'}}>{appt.deposit_paid?'Deposit paid':'Deposit pending'}</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>${((appt.deposit_amount||0)/100).toFixed(0)} deposit · new client</div>
              </div>
            </div>
          )}
          {!appt.preview && (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:appt.reminder_sent?'#F0FDF4':'#F9FAFB',borderRadius:10,border:`1px solid ${appt.reminder_sent?'#86EFAC':'#E5E7EB'}`}}>
              <span style={{fontSize:16}}>{appt.reminder_sent?'📧':'⏳'}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:appt.reminder_sent?'#16A34A':'#6B7280'}}>{appt.reminder_sent?'Reminder sent':'Reminder pending'}</div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>{appt.reminder_sent?'Client received email 24h before session':'Sends automatically 24h before session'}</div>
              </div>
            </div>
          )}
          {appt.notes && <div style={{background:'#FFFBEB',border:'1px solid #FCD34D',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#92400E',lineHeight:1.5}}>📝 {appt.notes}</div>}
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {appt.status==='intake-done' && appt.sessionId && appt.clientId && (
              <a href={`/dashboard/clients/${appt.clientId}/sessions/${appt.sessionId}`}
                style={{display:'block',background:'#2A5741',color:'#fff',borderRadius:10,padding:'13px 16px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
                📋 Open Session Record
              </a>
            )}
            {appt.status==='intake-done' && appt.sessionId && appt.clientId && therapist?.ai_enabled !== false && (
              <a href={`/brief/pre/${appt.sessionId}`} target="_blank" rel="noreferrer"
                style={{display:'block',background:'transparent',color:'#2A5741',border:'1.5px solid #2A5741',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,textDecoration:'none',textAlign:'center'}}>
                🧭 Open Pre-Session Brief
              </a>
            )}
            {appt.status==='pending-intake' && !appt.preview && (
              <a href={`sms:&body=${encodeURIComponent(`Hi ${firstName}! Please fill your intake form before your session: ${intakeLink}`)}`} style={{display:'block',background:'#2A5741',color:'#fff',borderRadius:10,padding:'13px 16px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>💬 Send Intake via SMS</a>
            )}
            <button onClick={()=>{navigator.clipboard.writeText(intakeLink);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{background:'transparent',color:'#6B9E80',border:'1.5px solid #6B9E80',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
              {copied?'✓ Copied!':'📋 Copy Intake Link'}
            </button>
            {appt.is_couples && appt.partner_name && appt.partner_email && !appt.preview && (() => {
              const partnerLink = `${intakeUrl}?name=${encodeURIComponent(appt.partner_name)}&email=${encodeURIComponent(appt.partner_email)}&booking_id=${appt.id}`;
              return (
                <div style={{background:'#F0FDF4',border:'1.5px solid #86EFAC',borderRadius:10,padding:'12px 14px'}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#2A5741',marginBottom:8}}>💑 Partner: {appt.partner_name}</div>
                  <div style={{display:'flex',gap:8}}>
                    <a href={`sms:&body=${encodeURIComponent(`Hi ${appt.partner_name.split(' ')[0]}! Please fill your intake form: ${partnerLink}`)}`}
                      style={{flex:1,display:'block',background:'#2A5741',color:'#fff',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
                      💬 SMS Partner
                    </a>
                    <button onClick={()=>{navigator.clipboard.writeText(partnerLink);}}
                      style={{flex:1,background:'transparent',color:'#2A5741',border:'1.5px solid #2A5741',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                      📋 Copy Partner Link
                    </button>
                  </div>
                </div>
              );
            })()}
            {appt.is_couples && appt.partner_name && appt.partner_email && !appt.preview && (
              <button onClick={()=>{
                const partnerLink=`${window.location.origin}/${therapist?.custom_url}?name=${encodeURIComponent(appt.partner_name)}&email=${encodeURIComponent(appt.partner_email)}&booking_id=${appt.id}`;
                navigator.clipboard.writeText(partnerLink);
                setCopied(true); setTimeout(()=>setCopied(false),2000);
              }} style={{background:'#F0FDF4',color:'#2A5741',border:'1.5px solid #86EFAC',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                💑 Copy {appt.partner_name.split(' ')[0]}'s Intake Link
              </button>
            )}
            {!appt.preview && (
              <button onClick={() => onReschedule(appt)}
                style={{background:'transparent',color:'#7C3AED',border:'1.5px solid #C4B5FD',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                📅 Reschedule
              </button>
            )}
            {canMarkNoShow && !confirmCancel && (
              <button onClick={() => openCancelFlow({ isNoShow: true })}
                style={{background:'transparent',color:'#92400E',border:'1.5px solid #FCD34D',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                🚫 Mark as No-Show
              </button>
            )}
            {!appt.preview && !confirmCancel && (
              <button onClick={() => openCancelFlow()}
                style={{background:'transparent',color:'#DC2626',border:'1.5px solid #FECACA',borderRadius:10,padding:'11px 16px',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                🗑 Cancel Appointment
              </button>
            )}
            {!appt.preview && confirmCancel && (
              <div style={{background:'#FEF2F2',border:'1.5px solid #FECACA',borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#991B1B',marginBottom:10}}>Cancel this appointment?</div>
                <div style={{fontSize:12,color:'#DC2626',marginBottom:14,lineHeight:1.5}}>
                  {appt.client} · {appt.time} on {appt.date?.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => setConfirmCancel(false)}
                    style={{flex:1,padding:'9px 0',borderRadius:8,border:'1.5px solid #D1D5DB',background:'#fff',color:'#6B7280',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                    Keep it
                  </button>
                  <button onClick={cancelAppointment} disabled={cancelling}
                    style={{flex:1,padding:'9px 0',borderRadius:8,border:'none',background:'#DC2626',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',opacity:cancelling?0.6:1}}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {appt.preview && <div style={{background:'#FEF3C7',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#92400E',textAlign:'center'}}>Preview card, real clients appear here after booking.</div>}
        </div>
      </div>

      {showChargeModal && chargeContext && (
        <CancellationChargeModal
          booking={chargeContext.booking}
          client={chargeContext.client}
          therapist={therapist}
          sessionPriceCents={chargeContext.sessionPriceCents}
          isNoShow={!!chargeContext.isNoShow}
          onClose={() => setShowChargeModal(false)}
          onCancelled={() => {
            setShowChargeModal(false);
            onCancelled?.();
            onClose();
          }}
        />
      )}
    </>
  );
}

function TimelineView({ therapist, allAppts, dayOffset, setDayOffset, today, onReschedule, onRefresh, blockedDays = [], onCreateBlock }) {
  const [selected,setSelected] = useState(null);
  const [showLegend,setShowLegend] = useState(false);
  // Phase 9.2 long-press → create block. Tracking the active press and
  // the resulting draft block being confirmed in a sheet.
  const longPressTimerRef = useRef(null);
  const longPressOriginRef = useRef(null);
  const [pendingBlock, setPendingBlock] = useState(null);  // {date, startTime, endTime, note}
  const [blockSheetSaving, setBlockSheetSaving] = useState(false);
  const [blockSheetError, setBlockSheetError] = useState('');
  const scrollRef = useRef(null);
  const isMobile = window.innerWidth < 900;
  const now = new Date();
  const nowMin = dayOffset===0 ? now.getHours()*60+now.getMinutes() : -1;
  const viewDate = addDays(today,dayOffset);
  const dayAppts = allAppts.filter(a=>sameDay(a.date,viewDate));
  const sorted = [...dayAppts].sort((a,b)=>t2m(a.time)-t2m(b.time));

  const starts = dayAppts.map(a=>t2m(a.time));
  const ends = dayAppts.map(a=>t2m(a.time)+a.duration);
  // Full working-day window. Per founder playbook: showing empty
  // time is the point. Compressing the calendar to first/last
  // booking hides the gaps that Fill This Gap is meant to surface.
  // Default 8 AM to 7 PM. Stretches earlier or later only if a
  // booking falls outside that range.
  const DEFAULT_START = 8 * 60;   // 8:00 AM
  const DEFAULT_END   = 19 * 60;  // 7:00 PM
  const TL_START = starts.length ? Math.min(DEFAULT_START, Math.min(...starts) - 30) : DEFAULT_START;
  const TL_END   = ends.length   ? Math.max(DEFAULT_END,   Math.max(...ends) + 45)   : DEFAULT_END;
  const PX = 0.85;
  const H = (TL_END-TL_START)*PX;
  const GUTTER = 48;

  const gaps = [];
  // Pre-day open block (before first booking). Per founder playbook:
  // showing open time is the point of the calendar, since Fill This
  // Gap is the differentiating feature. Don't hide unbooked stretches.
  if (sorted.length > 0) {
    const firstStart = t2m(sorted[0].time);
    if (firstStart - TL_START > 90) {
      gaps.push({ start: TL_START, end: firstStart, mins: firstStart - TL_START });
    }
  }
  for(let i=0;i<sorted.length-1;i++){
    const aEnd=t2m(sorted[i].time)+sorted[i].duration;
    const bStart=t2m(sorted[i+1].time);
    if(bStart-aEnd>90) gaps.push({start:aEnd,end:bStart,mins:bStart-aEnd});
  }
  // Post-day open block (after last booking to end of working day).
  if (sorted.length > 0) {
    const lastEnd = t2m(sorted[sorted.length-1].time) + sorted[sorted.length-1].duration;
    if (TL_END - lastEnd > 90) {
      gaps.push({ start: lastEnd, end: TL_END, mins: TL_END - lastEnd });
    }
  }
  const hourNums = [];
  for(let h=Math.floor(TL_START/60);h<=Math.ceil(TL_END/60);h++) hourNums.push(h);

  const DAY_RANGE = [-7,-6,-5,-4,-3,-2,-1,0,1,2,3];

  useEffect(()=>{
    if(scrollRef.current){
      const todayBtn = scrollRef.current.querySelector('[data-istoday="true"]');
      if(todayBtn) todayBtn.scrollIntoView({behavior:'auto',block:'nearest',inline:'center'});
    }
  },[]);

  const fmtDayLabel = (offset) => {
    const d = addDays(today, offset);
    if (offset === 0) return 'Today';
    if (offset === -1) return 'Yesterday';
    if (offset === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
  };

  // Phase 9.2: long-press to create a block.
  //
  // The TimelineView canvas is a pixel-based positional layout where
  // y-coordinate maps linearly to a minute-of-day via TL_START + (y/PX).
  // To convert a press location into a sensible block: take that
  // minute, snap to the nearest 15-min boundary, default to a 60-min
  // duration, surface a confirm sheet so the therapist can tweak the
  // end time and add a reason before saving.
  //
  // Long-press timing: 500ms. Cancelled on pointermove >10px (so a
  // scroll gesture doesn't accidentally create a block) or on pointerup
  // before the timer fires.

  const viewDateStr = (() => {
    const d = addDays(today, dayOffset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  // Partial blocks for THIS day, drawn onto the canvas as amber
  // stripes so the therapist sees their own blocks in context with
  // bookings. Full-day blocks are not drawn here (the whole canvas
  // would be amber).
  const myBlocksToday = (blockedDays || []).filter(b => {
    if (b.date !== viewDateStr) return false;
    return b.start_time && b.end_time;
  });

  const snapTo15 = (mins) => Math.round(mins / 15) * 15;

  const minutesToTimeStr = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const fmtTime12 = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hh = parseInt(h, 10);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const hr = hh % 12 === 0 ? 12 : hh % 12;
    return `${hr}:${m} ${ampm}`;
  };

  const startLongPress = (e) => {
    // Don't long-press on past days: blocking the past is meaningless.
    if (dayOffset < 0) return;
    // Don't long-press if no onCreateBlock callback wired in. Defensive.
    if (!onCreateBlock) return;
    // Don't trigger if the press landed on an interactive child (a
    // booking card, a refresh button, etc). React's synthetic event
    // bubbles up, so check the original target's element chain.
    const target = e.target;
    if (target.closest('[data-appt-card="1"]')) return;
    if (target.closest('button')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (clientY == null) return;
    const y = clientY - rect.top;
    longPressOriginRef.current = { x: e.clientX, y: clientY };

    longPressTimerRef.current = setTimeout(() => {
      const minsRaw = TL_START + (y / PX);
      // Clamp inside the visible window.
      const minsClamped = Math.max(TL_START, Math.min(TL_END - 60, minsRaw));
      const startMins = snapTo15(minsClamped);
      const endMins = Math.min(startMins + 60, TL_END);
      setBlockSheetError('');
      setPendingBlock({
        date: viewDateStr,
        startTime: minutesToTimeStr(startMins),
        endTime: minutesToTimeStr(endMins),
        note: '',
      });
      longPressTimerRef.current = null;
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  };

  const onPressMove = (e) => {
    // Cancel the pending long-press if the user scrolls/drags.
    if (!longPressOriginRef.current) return;
    const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    if (clientY == null) return;
    if (Math.abs(clientY - longPressOriginRef.current.y) > 10) {
      cancelLongPress();
    }
  };

  const confirmPendingBlock = async () => {
    if (!pendingBlock) return;
    if (!onCreateBlock) {
      setBlockSheetError('Cannot save: handler missing.');
      return;
    }
    setBlockSheetSaving(true);
    setBlockSheetError('');
    const result = await onCreateBlock({
      date: pendingBlock.date,
      startTime: pendingBlock.startTime,
      endTime: pendingBlock.endTime,
      note: pendingBlock.note,
    });
    setBlockSheetSaving(false);
    if (result) {
      setPendingBlock(null);
      // Trigger a fetch so the canvas redraws with the new block.
      if (onRefresh) onRefresh();
    } else {
      setBlockSheetError('Could not save the block. Please check the times and try again.');
    }
  };

  return (
    <div style={{ paddingBottom: window.innerWidth < 768 ? 'calc(74px + env(safe-area-inset-bottom, 0px) + 24px)' : 0 }}>
      {/* Date navigation header with prev/next arrows */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,gap:8}}>
        <button onClick={()=>setDayOffset(d=>d-1)}
          style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 14px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937',flexShrink:0}}>
          ← Prev
        </button>
        <div style={{textAlign:'center',flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{fmtDayLabel(dayOffset)}</div>
          {dayOffset !== 0 && (
            <button onClick={()=>setDayOffset(0)}
              style={{background:'none',border:'none',fontSize:11,color:'#6B9E80',fontWeight:600,cursor:'pointer',padding:'2px 0'}}>
              Back to Today
            </button>
          )}
        </div>
        <button onClick={()=>setDayOffset(d=>d+1)}
          style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 14px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937',flexShrink:0}}>
          Next →
        </button>
      </div>

      {/* Scrollable day picker. HK May 14: the floating corner badge
          looked spammy. Moved the count back inside the card as a
          quiet line under the date, half the size of the date. Reads
          like 'Today 14 / 5 appts' top-to-bottom with strong type
          hierarchy. */}
      <div ref={scrollRef} style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
        {DAY_RANGE.map(i=>{
          const d=addDays(today,i);
          const count=allAppts.filter(a=>sameDay(a.date,d)&&!a.preview).length;
          const isSel=i===dayOffset;
          const isToday=i===0;
          const isPast=i<0;
          return (
            <button key={i} data-istoday={isToday?'true':undefined} onClick={()=>setDayOffset(i)}
              style={{flexShrink:0,background:isSel?'#2A5741':'#fff',color:isSel?'#fff':isPast?'#9CA3AF':'#1F2937',border:`1.5px solid ${isSel?'#2A5741':'#E5E7EB'}`,borderRadius:10,padding:'8px 10px',cursor:'pointer',minWidth:60,textAlign:'center',transition:'all 0.15s',opacity:isPast&&!isSel?0.85:1}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',opacity:0.75,marginBottom:2,letterSpacing:'0.04em'}}>
                {i===0?'Today':i===-1?'Yest':i===1?'Tmrw':d.toLocaleDateString('en-US',{weekday:'short'})}
              </div>
              <div style={{fontSize:15,fontWeight:700,lineHeight:1.1}}>{d.getDate()}</div>
              <div style={{fontSize:10,fontWeight:600,marginTop:3,opacity:count>0?0.7:0.3}}>
                {count > 0 ? `${count} appt${count!==1?'s':''}` : '·'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend, collapsible. HK May 14 2026: the legend was always
          on, ate ~50px every render. Now hidden by default behind a
          'Legend' pill. Calendar gets the space back. */}
      <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>setShowLegend(v=>!v)}
          style={{display:'inline-flex',alignItems:'center',gap:5,background:showLegend?'#F0FDF4':'#fff',border:`1px solid ${showLegend?'#BBF7D0':'#E5E7EB'}`,borderRadius:14,padding:'4px 10px',fontSize:11,color:showLegend?'#16A34A':'#6B7280',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
          <span style={{fontSize:10}}>{showLegend?'▾':'▸'}</span>
          Legend
        </button>
        {showLegend && (
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',padding:'6px 10px',background:'#fff',borderRadius:8,border:'1px solid #F3F4F6',flex:1,minWidth:0}}>
            {[{color:'#16A34A',bg:'#DCFCE7',label:'Brief ready'},{color:'#D97706',bg:'#FEF3C7',label:'No intake yet'},{color:'#6B7280',bg:'#F3F4F6',label:'Complete'},{color:'#7F77DD',bg:'#EFEAFD',label:'From Google'}].map(({color,bg,label})=>(
              <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:10,height:10,borderRadius:3,background:bg,border:`1.5px solid ${color}`}}/>
                <span style={{fontSize:11,color:'#6B7280'}}>{label}</span>
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:10,height:10,borderRadius:3,background:'#F8F8F8',border:'1.5px dashed #CBD5E1'}}/>
              <span style={{fontSize:11,color:'#9CA3AF'}}>Preview</span>
            </div>
          </div>
        )}
      </div>

      <div style={{background:'#FBF8F1',borderRadius:16,padding:'16px 14px 20px',border:'1px solid #EEF2F7'}}>
        <div
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerMove={onPressMove}
          style={{position:'relative',height:H,marginLeft:GUTTER,touchAction:'pan-y',userSelect:'none',WebkitUserSelect:'none'}}
        >
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

          {/* Phase 9.2: render the therapist's own partial-day blocks
              as amber-tinted bands. They sit underneath bookings (which
              shouldn't overlap them anyway, but defensive). */}
          {myBlocksToday.map(b => {
            const [sh, sm] = b.start_time.slice(0,5).split(':').map(Number);
            const [eh, em] = b.end_time.slice(0,5).split(':').map(Number);
            const startMin = sh * 60 + sm;
            const endMin = eh * 60 + em;
            const y = (startMin - TL_START) * PX;
            const bh = (endMin - startMin) * PX;
            return (
              <div
                key={`my-block-${b.id}`}
                data-appt-card="1"
                style={{
                  position: 'absolute',
                  top: y,
                  left: 0,
                  right: 0,
                  height: bh,
                  background: 'repeating-linear-gradient(45deg, rgba(217,119,6,0.08), rgba(217,119,6,0.08) 6px, rgba(217,119,6,0.18) 6px, rgba(217,119,6,0.18) 12px)',
                  border: '1.5px solid rgba(217,119,6,0.45)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 14,
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🌿 Blocked {fmtTime12(b.start_time.slice(0,5))} to {fmtTime12(b.end_time.slice(0,5))}
                  {b.note ? <span style={{ marginLeft: 8, fontStyle: 'italic', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color:'#9A3412' }}>· {b.note}</span> : null}
                </div>
              </div>
            );
          })}

          {/* Hint pill for empty days: stays inside the canvas so the
              long-press surface is preserved. */}
          {dayAppts.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              padding: '20px 28px',
              pointerEvents: 'none',
              maxWidth: 320,
            }}>
              <div style={{fontSize:28,marginBottom:8}}>🌿</div>
              <div style={{fontSize:14,fontWeight:600,color:'#1F2937',marginBottom:4}}>
                No sessions {dayOffset===0?'today':'this day'}
              </div>
              <div style={{fontSize:12,color:'#9CA3AF',lineHeight:1.5}}>
                {dayOffset >= 0
                  ? 'Long-press anywhere on this column to block off time, or share your booking link to fill your schedule.'
                  : 'Past day. No sessions on the books.'}
              </div>
            </div>
          )}

          {gaps.map((g,i)=>{
            const y=(g.start-TL_START)*PX;
            const gh=g.mins*PX;
            const hrs=Math.floor(g.mins/60), mins=g.mins%60;
            // Two visual treatments by length:
            //   <= 90 min: amber stripes + 'book here' urgency (real fillable gap)
            //   > 90 min: soft amber tint + 'Open · Nh available' (general open time)
            // Either way the eye sees the schedule has space.
            const isShortGap = g.mins <= 90;
            const lbl=hrs>0?(mins>0?`${hrs}h ${mins}m`:`${hrs}h`):`${mins}m`;
            return (
                <div key={i} style={{
                  position:'absolute',
                  top:y,
                  left:0,
                  right:0,
                  height:gh,
                  background: isShortGap
                    ? 'repeating-linear-gradient(45deg,transparent,transparent 5px,#FFFBEB 5px,#FFFBEB 6px)'
                    : 'linear-gradient(180deg, rgba(254,243,199,0.35) 0%, rgba(254,243,199,0.18) 100%)',
                  border: isShortGap ? '1px dashed #FCD34D' : '1px dashed rgba(252,211,77,0.45)',
                  borderRadius:8,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  opacity: isShortGap ? 0.9 : 1,
                }}>
                  {gh>18 && (
                    isShortGap ? (
                      <span style={{fontSize:10,fontWeight:700,color:'#D97706',background:'#FFFBEB',padding:'2px 8px',borderRadius:20,border:'1px solid #FCD34D'}}>
                        ⚡ {lbl} open · fill this gap
                      </span>
                    ) : (
                      <span style={{fontSize:11,fontWeight:600,color:'#92400E',letterSpacing:'0.04em'}}>
                        Open · {lbl} available
                      </span>
                    )
                  )}
                </div>
              );
            })}
            {nowMin>=TL_START&&nowMin<=TL_END&&(
              <div style={{position:'absolute',top:(nowMin-TL_START)*PX,left:-6,right:0,zIndex:10,pointerEvents:'none',display:'flex',alignItems:'center'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#EF4444',flexShrink:0}}/>
                <div style={{flex:1,height:2,background:'#EF4444',opacity:0.6}}/>
              </div>
            )}
            {sorted.map(appt=>{
              const y=(t2m(appt.time)-TL_START)*PX;
              const bh=Math.max(appt.duration*PX,36);
              const st=STATUS[appt.status]||STATUS['pending-intake'];
              const isSel=selected?.id===appt.id;
              const isPast=dayOffset===0&&t2m(appt.time)+appt.duration<nowMin;
              return (
                <div key={appt.id} data-appt-card="1" onClick={()=>setSelected(isSel?null:appt)}
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
                        {!appt.preview&&appt.reminder_sent&&<div style={{fontSize:9,color:'#16A34A',fontWeight:700,marginTop:1}}>📧 Sent</div>}
                        {!appt.preview&&!appt.reminder_sent&&<div style={{fontSize:9,color:'#9CA3AF',marginTop:1}}>📧 Pending</div>}
                      </div>
                    </div>
                    {bh>52&&<div style={{fontSize:11,color:appt.preview?'#C4C4C4':st.color,marginLeft:30}}>{appt.service}</div>}
                    {bh>72&&(
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{background:appt.preview?'transparent':st.dot+'22',color:appt.preview?'#C4C4C4':st.color,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{st.icon} {appt.preview?'Preview':st.label}</div>
                        {!appt.preview&&appt.deposit_required&&!appt.deposit_paid&&<div style={{fontSize:9,fontWeight:700,color:'#D97706',background:'#FEF3C7',borderRadius:20,padding:'2px 8px'}}>💳 Deposit due</div>}
                        {!appt.preview&&appt.status==='intake-done'&&<div style={{fontSize:10,fontWeight:700,color:'#2A5741',background:'#DCFCE7',borderRadius:20,padding:'2px 8px'}}>Brief ready →</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      </div>

      {/* Phase 9.2: long-press confirm sheet. Centered modal with the
          proposed time, an editable end time, an optional reason, and
          a Block button. Pre-filled with a 60-min window snapped to
          the nearest 15-min boundary from where the user pressed. */}
      {pendingBlock && (
        <>
          <div
            onClick={()=>!blockSheetSaving && setPendingBlock(null)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:300,backdropFilter:'blur(2px)'}}
          />
          <div style={{
            position:'fixed',
            top:'50%',
            left:'50%',
            transform:'translate(-50%, -50%)',
            background:'#fff',
            borderRadius:14,
            padding:'24px 26px',
            boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
            zIndex:301,
            width:'min(420px, calc(100vw - 32px))',
            maxWidth:420,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
              <div style={{ fontSize:24 }}>🌿</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:18, fontWeight:700, color:'#1F2937', fontFamily:'Georgia,serif' }}>Block this time?</div>
                <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                  {new Date(pendingBlock.date+'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}
                </div>
              </div>
            </div>

            {/* Two editable time fields, side by side. Both use the
                InlineTimeInput component so they accept typed values
                like "10am" or "2:30pm" instead of relying on the
                native browser time dropdown. Placeholders show a
                realistic time example so older users see the expected
                format including AM/PM. */}
            <div style={{ display:'flex', alignItems:'flex-end', gap:12, marginBottom:14, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 130px', minWidth:120 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
                  Start
                </label>
                <InlineTimeInput
                  value={pendingBlock.startTime}
                  onChange={(t) => setPendingBlock(prev => prev ? { ...prev, startTime: t } : prev)}
                  placeholder="10:00 AM"
                  ariaLabel="Start time of blocked window"
                  width="100%"
                  disabled={blockSheetSaving}
                />
              </div>
              <div style={{ paddingBottom: 10, fontFamily:'Georgia,serif', fontStyle:'italic', fontSize:14, color:'#6B7280' }}>to</div>
              <div style={{ flex:'1 1 130px', minWidth:120 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
                  End
                </label>
                <InlineTimeInput
                  value={pendingBlock.endTime}
                  onChange={(t) => setPendingBlock(prev => prev ? { ...prev, endTime: t } : prev)}
                  placeholder="2:00 PM"
                  ariaLabel="End time of blocked window"
                  width="100%"
                  disabled={blockSheetSaving}
                />
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>
                Reason (optional)
              </label>
              <input
                type="text"
                value={pendingBlock.note}
                onChange={e=>setPendingBlock(prev => prev ? { ...prev, note: e.target.value } : prev)}
                placeholder="Lunch, errand, personal time"
                disabled={blockSheetSaving}
                style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E8E4DC', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box', background:'#FBFAF4', fontStyle:'italic', fontFamily:'system-ui, -apple-system, sans-serif' }}
              />
            </div>

            {blockSheetError && (
              <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', color:'#991B1B', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:12 }}>
                {blockSheetError}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={()=>setPendingBlock(null)}
                disabled={blockSheetSaving}
                style={{ flex:1, background:'#F3F4F6', color:'#4B5563', border:'none', padding:'12px', borderRadius:10, fontSize:14, fontWeight:700, cursor:blockSheetSaving?'not-allowed':'pointer' }}
              >Cancel</button>
              <button
                onClick={confirmPendingBlock}
                disabled={blockSheetSaving || pendingBlock.endTime <= pendingBlock.startTime}
                style={{
                  flex:2,
                  background: (blockSheetSaving || pendingBlock.endTime <= pendingBlock.startTime) ? '#D1D5DB' : '#2A5741',
                  color:'#fff', border:'none', padding:'12px', borderRadius:10,
                  fontSize:14, fontWeight:700,
                  cursor:(blockSheetSaving || pendingBlock.endTime <= pendingBlock.startTime) ? 'not-allowed' : 'pointer',
                }}
              >
                {blockSheetSaving ? 'Saving…' : 'Block this time'}
              </button>
            </div>

            <div style={{ fontSize:11, color:'#9CA3AF', textAlign:'center', marginTop:12, fontStyle:'italic', fontFamily:'Georgia,serif', lineHeight:1.5 }}>
              Clients cannot book during this window. You'll still see existing bookings in this range if any overlap.
            </div>
          </div>
        </>
      )}

      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{setSelected(null);onReschedule&&onReschedule(a);}} onCancelled={()=>{setSelected(null);if(typeof onRefresh==='function')onRefresh();}}/>}
    </div>
  );
}

function WeeklyView({ therapist, appointments, today, onReschedule, onRefresh }) {
  const APPTS=appointments||[];
  const [weekOffset,setWeekOffset]=useState(0);
  const [selected,setSelected]=useState(null);
  const [showLegend,setShowLegend]=useState(false);
  const isMobile=window.innerWidth<640;
  const getMonday=d=>{const x=new Date(d);const day=x.getDay();x.setDate(x.getDate()+(day===0?-6:1-day));x.setHours(0,0,0,0);return x;};
  const weekStart=addDays(getMonday(today),weekOffset*7);
  const weekDays=[0,1,2,3,4,5,6].map(n=>addDays(weekStart,n));
  const DAY_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const DAY_NAMES_FULL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const weekAppts=APPTS.filter(a=>a.date>=weekStart&&a.date<addDays(weekStart,7));
  const realWeek=weekAppts.filter(a=>!a.preview);
  return (
    <div>
      {/* Legend, collapsible. Off by default for vertical space. */}
      <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>setShowLegend(v=>!v)}
          style={{display:'inline-flex',alignItems:'center',gap:5,background:showLegend?'#F0FDF4':'#fff',border:`1px solid ${showLegend?'#BBF7D0':'#E5E7EB'}`,borderRadius:14,padding:'4px 10px',fontSize:11,color:showLegend?'#16A34A':'#6B7280',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
          <span style={{fontSize:10}}>{showLegend?'▾':'▸'}</span>
          Legend
        </button>
        {showLegend && (
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',padding:'6px 10px',background:'#fff',borderRadius:8,border:'1px solid #F3F4F6',flex:1,minWidth:0}}>
            {[{color:'#16A34A',bg:'#DCFCE7',label:'Brief ready'},{color:'#D97706',bg:'#FEF3C7',label:'No intake yet'},{color:'#6B7280',bg:'#F3F4F6',label:'Complete'},{color:'#7F77DD',bg:'#EFEAFD',label:'From Google'}].map(({color,bg,label})=>(
              <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:10,height:10,borderRadius:3,background:bg,border:`1.5px solid ${color}`}}/>
                <span style={{fontSize:11,color:'#6B7280'}}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={()=>setWeekOffset(w=>w-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← Prev</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:15,fontWeight:700,color:'#1F2937'}}>{weekOffset===0?'This Week':weekOffset===1?'Next Week':weekOffset===-1?'Last Week':fmtShort(weekStart)}</div>
          <div style={{fontSize:12,color:'#6B7280'}}>
            {realWeek.length} sessions{realWeek.length>0?` · ~$${realWeek.reduce((s,a)=>s+(a.price||85),0)}`:''}
          </div>
        </div>
        <button onClick={()=>setWeekOffset(w=>w+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>Next →</button>
      </div>

      {/* Explanatory banner when the displayed week is empty AND
          is current or future. Past weeks intentionally don't show
          this (imported history may be sparse and that's not
          confusing). HK May 14 2026: 'past weeks are there, but
          there's nothing after today for the coming weeks' from
          Candice. The empty state was correct (CSV imports don't
          carry future bookings) but read as a sync bug. */}
      {realWeek.length === 0 && weekOffset >= 0 && (
        <div style={{
          background:'#FEFCE8',
          border:'1px solid #FDE68A',
          borderRadius:10,
          padding:'12px 14px',
          marginBottom:16,
          display:'flex',
          alignItems:'flex-start',
          gap:10,
        }}>
          <div style={{fontSize:18, lineHeight:1, marginTop:2}}>🌱</div>
          <div style={{flex:1, fontSize:12.5, color:'#78350F', lineHeight:1.55}}>
            <strong style={{color:'#78350F'}}>No bookings yet for {weekOffset===0?'this week':weekOffset===1?'next week':'this week'}.</strong>{' '}
            CSV imports bring over past visit history, not future appointments. To fill your week, tap <strong>Book Appointment</strong> at the top of the page to add bookings manually, or share your booking link so clients can book themselves.
          </div>
        </div>
      )}

      {/* MOBILE: vertical day list, full-width rows, no truncation */}
      {isMobile ? (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {weekDays.map((d,i)=>{
            const dayAppts=APPTS.filter(a=>sameDay(a.date,d));
            const realDayAppts=dayAppts.filter(a=>!a.preview);
            const isToday=sameDay(d,today);
            return (
              <div key={i} style={{background:'#fff',borderRadius:12,overflow:'hidden',border:`1.5px solid ${isToday?'#86EFAC':'#F3F4F6'}`,boxShadow:isToday?'0 1px 3px rgba(22,163,74,0.08)':'none'}}>
                {/* Day header row */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:isToday?'#F0FDF4':'#FAFAF7',borderBottom:dayAppts.length>0?`1px solid ${isToday?'#BBF7D0':'#F3F4F6'}`:'none'}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                    <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:isToday?'#16A34A':'#6B7280'}}>{DAY_NAMES_FULL[i]}</div>
                    <div style={{fontSize:15,fontWeight:700,color:isToday?'#16A34A':'#1F2937'}}>{d.getMonth()+1}/{d.getDate()}</div>
                    {isToday && <div style={{fontSize:10,fontWeight:700,color:'#16A34A',background:'#DCFCE7',borderRadius:20,padding:'2px 8px'}}>Today</div>}
                  </div>
                  <div style={{fontSize:11,color:isToday?'#16A34A':'#9CA3AF',fontWeight:600}}>
                    {realDayAppts.length===0?'No sessions':`${realDayAppts.length} ${realDayAppts.length===1?'session':'sessions'}`}
                  </div>
                </div>
                {/* Appointment rows */}
                {dayAppts.length===0
                  ? <div style={{padding:'14px 16px',fontSize:12,color:'#B4B4B4',fontStyle:'italic',textAlign:'center'}}>Open day</div>
                  : <div style={{display:'flex',flexDirection:'column'}}>
                      {dayAppts.map((appt,idx)=>{
                        const st=STATUS[appt.status]||STATUS['pending-intake'];
                        return (
                          <div key={appt.id} onClick={()=>!appt.preview&&setSelected(appt)}
                            style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',cursor:appt.preview?'default':'pointer',borderTop:idx>0?'1px solid #F3F4F6':'none',opacity:appt.preview?0.5:1,background:appt.preview?'#FAFAFA':'transparent'}}>
                            <div style={{width:36,height:36,borderRadius:'50%',background:appt.preview?'#D1D5DB':ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{initials(appt.client)}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                                <div style={{fontSize:14,fontWeight:700,color:appt.preview?'#9CA3AF':'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.client}</div>
                              </div>
                              <div style={{fontSize:12,color:'#6B7280',display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                                <span style={{fontWeight:600,color:appt.preview?'#9CA3AF':st.color}}>{appt.time}</span>
                                <span>·</span>
                                <span>{appt.service||'Session'}</span>
                              </div>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,flexShrink:0}}>
                              <div style={{fontSize:10,fontWeight:700,color:appt.preview?'#9CA3AF':st.color,background:appt.preview?'#F3F4F6':st.bg,padding:'3px 8px',borderRadius:20,whiteSpace:'nowrap'}}>
                                {st.icon} {appt.preview?'Preview':st.label}
                              </div>
                              {!appt.preview && <div style={{fontSize:16,color:'#D1D5DB',lineHeight:1}}>›</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            );
          })}
        </div>
      ) : (
        /* DESKTOP: 7-col grid */
        <div className="bm-weekly-grid" style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
          {weekDays.map((d,i)=>{
            const dayAppts=APPTS.filter(a=>sameDay(a.date,d));
            const isToday=sameDay(d,today);
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
                          style={{background:appt.preview?'#F9FAFB':st.bg,
                            borderLeft:`3px solid ${appt.preview?'#D1D5DB':st.dot}`,
                            borderRadius:6,padding:'5px 7px',cursor:'pointer',
                            opacity:appt.preview?0.45:1,
                            boxShadow:appt.preview?'none':'0 1px 3px rgba(0,0,0,0.06)',
                            transition:'all 0.15s'}}
                          onMouseEnter={e=>{if(!appt.preview)e.currentTarget.style.transform='translateY(-1px)';}}
                          onMouseLeave={e=>{e.currentTarget.style.transform='none';}}>
                          <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                            <div style={{width:18,height:18,borderRadius:'50%',background:appt.preview?'#D1D5DB':ac(appt.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,flexShrink:0}}>{initials(appt.client)}</div>
                            <div style={{fontSize:10,fontWeight:700,color:appt.preview?'#C4C4C4':st.color}}>{appt.time}</div>
                          </div>
                          <div style={{fontSize:11,fontWeight:700,color:appt.preview?'#C4C4C4':'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.client.split(' ')[0]}</div>
                          <div style={{fontSize:10,color:appt.preview?'#D1D5DB':'#6B7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.service||'Session'}</div>
                          <div style={{fontSize:9,fontWeight:600,color:appt.preview?'#D1D5DB':st.color,marginTop:1}}>{st.icon} {appt.preview?'Preview':st.label}</div>
                        </div>
                      );
                    })}
                  </div>
                }
              </div>
            );
          })}
        </div>
      )}
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{setSelected(null);onReschedule&&onReschedule(a);}} onCancelled={()=>{setSelected(null);if(typeof onRefresh==='function')onRefresh();}}/>}
    </div>
  );
}

function MonthlyView({ therapist, appointments, today, onReschedule, onRefresh }) {
  const APPTS=appointments||[];
  const [monthOffset,setMonthOffset]=useState(0);
  const [selDate,setSelDate]=useState(today);
  const [selected,setSelected]=useState(null);
  const viewMonth=new Date(today.getFullYear(),today.getMonth()+monthOffset,1);
  const daysInMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,0).getDate();
  const firstDay=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),1).getDay();
  const offset=firstDay===0?6:firstDay-1;
  const calDays=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,i)=>new Date(viewMonth.getFullYear(),viewMonth.getMonth(),i+1))];
  const selAppts=APPTS.filter(a=>sameDay(a.date,selDate));
  return (
    <div>
      {/* Legend */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16,padding:'10px 14px',background:'#fff',borderRadius:10,border:'1px solid #F3F4F6',alignItems:'center'}}>
        <span style={{fontSize:11,fontWeight:700,color:'#374151'}}>HOW TO READ:</span>
        {[{color:'#16A34A',bg:'#DCFCE7',label:'Brief ready'},{color:'#D97706',bg:'#FEF3C7',label:'No intake yet'},{color:'#6B7280',bg:'#F3F4F6',label:'Complete'},{color:'#7F77DD',bg:'#EFEAFD',label:'From Google'}].map(({color,bg,label})=>(
          <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:12,height:12,borderRadius:3,background:bg,border:`2px solid ${color}`}}/>
            <span style={{fontSize:11,color:'#6B7280'}}>{label}</span>
          </div>
        ))}
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <div style={{width:18,height:18,borderRadius:'50%',background:'#2A5741',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:'#fff'}}>AB</div>
          <span style={{fontSize:11,color:'#6B7280'}}>Client initials</span>
        </div>
        <span style={{fontSize:11,color:'#9CA3AF',marginLeft:'auto'}}>Tap a day to see appointments</span>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <button onClick={()=>setMonthOffset(m=>m-1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>← Prev</button>
        <div style={{fontSize:16,fontWeight:700,color:'#1F2937'}}>{fmtMonth(viewMonth)}</div>
        <button onClick={()=>setMonthOffset(m=>m+1)} style={{background:'#fff',border:'1.5px solid #E5E7EB',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',color:'#1F2937'}}>Next →</button>
      </div>

      {/* Empty-state banner for current/future months with zero
          real bookings. Same rationale as the weekly banner: CSV
          imports don't bring forward future appointments and the
          empty state was confusing. */}
      {(() => {
        const monthAppts = APPTS.filter(a => {
          const ad = a.date instanceof Date ? a.date : new Date(a.date + 'T12:00:00');
          return ad.getFullYear() === viewMonth.getFullYear() && ad.getMonth() === viewMonth.getMonth() && !a.preview;
        });
        const isCurrentOrFutureMonth = monthOffset >= 0;
        if (monthAppts.length === 0 && isCurrentOrFutureMonth) {
          return (
            <div style={{
              background:'#FEFCE8',
              border:'1px solid #FDE68A',
              borderRadius:10,
              padding:'12px 14px',
              marginBottom:16,
              display:'flex',
              alignItems:'flex-start',
              gap:10,
            }}>
              <div style={{fontSize:18, lineHeight:1, marginTop:2}}>🌱</div>
              <div style={{flex:1, fontSize:12.5, color:'#78350F', lineHeight:1.55}}>
                <strong style={{color:'#78350F'}}>No bookings yet for {fmtMonth(viewMonth)}.</strong>{' '}
                CSV imports bring over past visit history, not future appointments. To fill your month, tap <strong>Book Appointment</strong> at the top to add bookings manually, or share your booking link so clients can book themselves.
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="bm-monthly-grid" style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4}}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><div key={d} style={{textAlign:'center',fontSize:10,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div className="bm-monthly-grid" style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:20}}>
        {calDays.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const da=APPTS.filter(a=>sameDay(a.date,d));
          const ra=da.filter(a=>!a.preview);
          const isToday=sameDay(d,today),isSel=sameDay(d,selDate);
          return (
            <div key={i} onClick={()=>setSelDate(d)}
              style={{minHeight:48,padding:5,borderRadius:8,cursor:'pointer',background:isSel?'#2A5741':isToday?'#F0FDF4':'#fff',border:`1.5px solid ${isSel?'#2A5741':isToday?'#86EFAC':'#F3F4F6'}`,transition:'all 0.1s'}}>
              <div style={{fontSize:11,fontWeight:600,color:isSel?'#fff':isToday?'#16A34A':'#6B7280',marginBottom:2}}>{d.getDate()}</div>
              {ra.length>0&&<div style={{fontSize:11,fontWeight:700,color:isSel?'#fff':'#1F2937'}}>{window.innerWidth<640?`${ra.length}×`:`${ra.length} appt${ra.length>1?'s':''}`}</div>}
              <div style={{display:'flex',gap:2,marginTop:2}}>
                {da.filter(a=>!a.preview&&a.status==='intake-done').length>0&&!isSel&&<div style={{width:5,height:5,borderRadius:'50%',background:'#16A34A'}}/>}
                {da.filter(a=>!a.preview&&a.status==='pending-intake').length>0&&!isSel&&<div style={{width:5,height:5,borderRadius:'50%',background:'#F59E0B'}}/>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>
        {fmtShort(selDate)}, {selAppts.filter(a=>!a.preview).length} appointment{selAppts.filter(a=>!a.preview).length!==1?'s':''}
      </div>
      {selAppts.filter(a=>!a.preview).length===0
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
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                <div style={{fontSize:11,fontWeight:700,color:(STATUS[appt.status]||STATUS['pending-intake']).color}}>{(STATUS[appt.status]||STATUS['pending-intake']).icon} {(STATUS[appt.status]||STATUS['pending-intake']).label}</div>
                {appt.deposit_required&&!appt.deposit_paid&&<div style={{fontSize:10,fontWeight:700,color:'#D97706'}}>💳 Deposit due</div>}
              </div>
            </div>
          ))}
        </div>
      }
      {selected&&<DetailPanel appt={selected} therapist={therapist} onClose={()=>setSelected(null)} onReschedule={a=>{setSelected(null);onReschedule&&onReschedule(a);}} onCancelled={()=>{setSelected(null);if(typeof onRefresh==='function')onRefresh();}}/>}
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

  // ─── COHORT COMPUTATIONS ─────────────────────────────────────
  // Four action cohorts that answer 'what should I do this month?'
  // Per founder playbook: insights live where decisions are made.
  // Each cohort is a card with the 3 most actionable people + 'View
  // all N'. Existing analytics charts move below as secondary context.
  const now = Date.now();
  const DAY_MS = 86400000;

  // Build per-client aggregations from appointments
  const byClient = {};
  APPTS.forEach(a => {
    const key = a.clientId || a.client_id || a.client || 'unknown';
    if (!byClient[key]) {
      byClient[key] = {
        id: key,
        name: a.client || 'Unknown',
        dates: [],
        prices: [],
        statuses: [],
        phone: a.client_phone || a.phone || null,
        clientEmail: a.client_email || null,
      };
    }
    byClient[key].dates.push(a.date);
    if (a.price) byClient[key].prices.push(Number(a.price) || 0);
    byClient[key].statuses.push(a.status);
  });

  const clients = Object.values(byClient).map(c => {
    const sortedDates = [...c.dates].sort((a, b) => a - b);
    const totalVisits = sortedDates.length;
    const lastVisit = sortedDates[sortedDates.length - 1];
    const firstVisit = sortedDates[0];
    const daysLapsed = lastVisit ? Math.round((now - lastVisit.getTime()) / DAY_MS) : 999;
    const lifetimeSpend = c.prices.reduce((s, n) => s + n, 0);

    // No-show rate: count cancellations + no-shows
    const cancelledCount = c.statuses.filter(s =>
      s === 'cancelled' || s === 'no-show' || s === 'canceled'
    ).length;
    const noShowRate = totalVisits > 0 ? cancelledCount / totalVisits : 0;

    // Cadence: avg interval between visits
    let cadence = null;
    if (sortedDates.length >= 3) {
      const intervals = [];
      for (let i = 1; i < sortedDates.length; i++) {
        intervals.push((sortedDates[i].getTime() - sortedDates[i-1].getTime()) / DAY_MS);
      }
      cadence = Math.round(intervals.reduce((s, n) => s + n, 0) / intervals.length);
    }

    // Visits in last 90 days
    const cutoff90 = now - 90 * DAY_MS;
    const recentVisits = sortedDates.filter(d => d.getTime() >= cutoff90).length;

    return {
      ...c,
      totalVisits,
      lastVisit,
      firstVisit,
      daysLapsed,
      lifetimeSpend,
      noShowRate,
      cancelledCount,
      cadence,
      recentVisits,
    };
  });

  // COHORT 1: HIGH VALUE
  // Top clients by lifetime visit count (or spend if available).
  // These are your champions. Action: thank-you or referral ask.
  const highValue = [...clients]
    .filter(c => c.totalVisits >= 5)
    .sort((a, b) => b.totalVisits - a.totalVisits || b.lifetimeSpend - a.lifetimeSpend)
    .slice(0, 10);

  // COHORT 2: LAPSED
  // Regulars whose cadence broke. Action: text now.
  // Per playbook lapsed-regular formula: lifetime_bookings >= 4 AND
  // last_booking 30-60 days ago. Extending to 60+ days for the
  // Insights monthly view (broader than the rail's tighter window).
  const lapsed = [...clients]
    .filter(c => c.totalVisits >= 4 && c.daysLapsed >= 60 && c.daysLapsed <= 365)
    .sort((a, b) => b.daysLapsed - a.daysLapsed)
    .slice(0, 10);

  // COHORT 3: NO-SHOW RISK
  // >= 20% cancel/no-show rate AND >= 5 bookings.
  // Per playbook formula. Action: send confirm reminder before next session.
  const noShowRisk = [...clients]
    .filter(c => c.noShowRate >= 0.20 && c.totalVisits >= 5)
    .sort((a, b) => b.noShowRate - a.noShowRate)
    .slice(0, 10);

  // COHORT 4: MEMBERSHIP CANDIDATES
  // First-3-visits clients who could become regulars. 2-4 visits in
  // last 90 days, total visits <= 5. Action: invite to package or
  // membership.
  const membershipCandidates = [...clients]
    .filter(c => c.recentVisits >= 2 && c.recentVisits <= 4 && c.totalVisits <= 5)
    .sort((a, b) => b.recentVisits - a.recentVisits)
    .slice(0, 10);

  // ─── LEGACY ANALYTICS (secondary section) ────────────────────
  const DAY_NAMES=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayCounts=DAY_NAMES.map((name,i)=>{const jsDay=i===6?0:i+1;return{name,count:APPTS.filter(a=>a.date.getDay()===jsDay).length};});
  const maxDay=Math.max(...dayCounts.map(d=>d.count),1);
  const clientCounts={};APPTS.forEach(a=>{clientCounts[a.client]=(clientCounts[a.client]||0)+1;});
  const topClients=Object.entries(clientCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const total=APPTS.length;
  const intakePct=total>0?Math.round((APPTS.filter(a=>a.status!=='pending-intake').length/total)*100):0;
  const depositPending=APPTS.filter(a=>a.deposit_required&&!a.deposit_paid).length;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      {/* ─── COHORT CARDS ─── */}
      <div style={{fontSize:11,fontWeight:700,color:'#6B7280',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:-6}}>
        Action cohorts · what to do this month
      </div>
      <div className="bm-cohorts-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <CohortCard
          color="forest"
          icon="⭐"
          title="High Value"
          subtitle="Your champions. Thank or ask for a referral."
          clients={highValue}
          total={clients.filter(c => c.totalVisits >= 5).length}
          actionLabel="Thank"
          buildMessage={(c, therapistFirstName) => `Hi ${c.name.split(' ')[0]}, ${therapistFirstName || 'me'} here. I was just looking through my books and realized you've been part of my practice for ${c.totalVisits} sessions. That means a lot. If you ever want to send a friend my way, I have a referral thank-you for you.`}
          metric={(c) => `${c.totalVisits} visits · $${Math.round(c.lifetimeSpend)}`}
        />
        <CohortCard
          color="amber"
          icon="🌿"
          title="Lapsed"
          subtitle="Regulars who drifted. Text now."
          clients={lapsed}
          total={clients.filter(c => c.totalVisits >= 4 && c.daysLapsed >= 60).length}
          actionLabel="Text"
          buildMessage={(c, therapistFirstName) => `Hi ${c.name.split(' ')[0]}, ${therapistFirstName || 'me'} here. It's been about ${Math.round(c.daysLapsed / 7)} weeks since your last visit. Want me to find a time that works for you?`}
          metric={(c) => `${c.daysLapsed}d since last · ${c.totalVisits} lifetime`}
        />
        <CohortCard
          color="danger"
          icon="⚠️"
          title="No-show Risk"
          subtitle="Send a confirm reminder before next session."
          clients={noShowRisk}
          total={clients.filter(c => c.noShowRate >= 0.20 && c.totalVisits >= 5).length}
          actionLabel="Confirm"
          buildMessage={(c, therapistFirstName) => `Hi ${c.name.split(' ')[0]}, just confirming our upcoming session. Reply YES to confirm or let me know if you need to reschedule. Thanks!`}
          metric={(c) => `${Math.round(c.noShowRate * 100)}% no-show · ${c.totalVisits} bookings`}
        />
        <CohortCard
          color="sage"
          icon="🤝"
          title="Membership Candidates"
          subtitle="First few visits. Could become regulars."
          clients={membershipCandidates}
          total={clients.filter(c => c.recentVisits >= 2 && c.recentVisits <= 4 && c.totalVisits <= 5).length}
          actionLabel="Invite"
          buildMessage={(c, therapistFirstName) => `Hi ${c.name.split(' ')[0]}, I've enjoyed our sessions together. If you're thinking about making this a regular routine, I have a package option that saves you money per session. Let me know if you'd like to hear about it.`}
          metric={(c) => `${c.recentVisits} in 90d · ${c.totalVisits} lifetime`}
        />
      </div>

      {/* ─── LEGACY ANALYTICS (secondary) ─── */}
      <div style={{fontSize:11,fontWeight:700,color:'#6B7280',letterSpacing:'0.12em',textTransform:'uppercase',marginTop:8,marginBottom:-6}}>
        Practice analytics
      </div>
      <div className="bm-insights-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div style={{background:'#fff',borderRadius:12,padding:18,gridColumn:'1/-1',border:'1px solid #EEF2F7'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#6B7280',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Busiest Days</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:10,height:80}}>
            {dayCounts.map(({name,count})=>(
              <div key={name} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{fontSize:11,fontWeight:700,color:'#6B7280'}}>{count||''}</div>
                <div style={{width:'100%',background:'#2A5741',borderRadius:'4px 4px 0 0',height:`${Math.max((count/maxDay)*60,count>0?4:2)}px`,opacity:count>0?1:0.1}}/>
                <div style={{fontSize:10,color:'#9CA3AF'}}>{name}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:18,border:'1px solid #EEF2F7'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#6B7280',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Intake Rate</div>
          <div style={{fontSize:32,fontWeight:700,color:'#2A5741',fontFamily:'Georgia,serif'}}>{intakePct}%</div>
          <div style={{marginTop:8,background:'#E5E7EB',borderRadius:99,height:6}}>
            <div style={{width:`${intakePct}%`,background:'#2A5741',borderRadius:99,height:6}}/>
          </div>
        </div>
        <div style={{background:'#fff',borderRadius:12,padding:18,border:'1px solid #EEF2F7'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#6B7280',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>Top Clients</div>
          {topClients.map(([name,count])=>(
            <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:ac(name),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>{initials(name)}</div>
                <span style={{fontSize:13,fontWeight:600,color:'#1F2937'}}>{name}</span>
              </div>
              <span style={{fontSize:12,color:'#6B7280'}}>{count}</span>
            </div>
          ))}
        </div>
        {depositPending>0&&(
          <div style={{background:'#FFFBEB',borderRadius:12,padding:18,border:'1px solid #FCD34D',gridColumn:'1/-1'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#92400E',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Deposits Pending</div>
            <div style={{display:'flex',alignItems:'baseline',gap:10}}>
              <div style={{fontSize:28,fontWeight:700,color:'#D97706',fontFamily:'Georgia,serif'}}>{depositPending}</div>
              <div style={{fontSize:12,color:'#92400E'}}>new client deposits awaiting payment</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================
 * CohortCard
 *
 * Action-oriented insights card. Three most relevant clients with
 * one-tap message action, then 'View all N' to expand. Color-coded
 * by cohort intent (forest=champions, amber=lapsed, danger=risk,
 * sage=opportunity).
 * ============================================================= */

function CohortCard({ color, icon, title, subtitle, clients, total, actionLabel, buildMessage, metric }) {
  const [expanded, setExpanded] = useState(false);

  const COLOR_MAP = {
    forest: { bg:'#F0F7F2', border:'#C8E0CC', accent:'#2A5741', actionBg:'#2A5741' },
    amber:  { bg:'#FEF8EC', border:'#FDE6B5', accent:'#92400E', actionBg:'#D97706' },
    danger: { bg:'#FEF2F2', border:'#FECACA', accent:'#991B1B', actionBg:'#DC2626' },
    sage:   { bg:'#F5F8F3', border:'#D6E4D0', accent:'#3D6B4C', actionBg:'#3D6B4C' },
  };
  const c = COLOR_MAP[color] || COLOR_MAP.forest;

  function sendMessage(client) {
    const msg = buildMessage(client, '');
    if (!client.phone) {
      alert(`No phone on file for ${client.name}. Pre-drafted:\n\n${msg}`);
      return;
    }
    const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    const sep = isApple ? '&' : '?';
    window.location.href = `sms:${client.phone}${sep}body=${encodeURIComponent(msg)}`;
  }

  if (clients.length === 0) {
    return (
      <section style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.accent, fontFamily:'Georgia,serif' }}>
            {title}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
          No one in this cohort yet. Keep going.
        </div>
      </section>
    );
  }

  const visible = expanded ? clients : clients.slice(0, 3);

  return (
    <section style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 14,
      padding: '16px 18px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: c.accent, fontFamily:'Georgia,serif' }}>
            {title}
          </div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: c.accent,
            background: '#fff',
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            padding: '2px 7px',
            marginLeft: 'auto',
          }}>
            {total}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.45 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {visible.map(client => (
          <div key={client.id} style={{
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            gap:10,
            padding:'8px 10px',
            background:'#fff',
            border:`1px solid ${c.border}`,
            borderRadius:10,
            minWidth: 0,
          }}>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{
                fontSize:13,
                fontWeight:700,
                color:'#1F2937',
                fontFamily:'Georgia,serif',
                overflow:'hidden',
                textOverflow:'ellipsis',
                whiteSpace:'nowrap',
              }}>
                {client.name}
              </div>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:1 }}>
                {metric(client)}
              </div>
            </div>
            <button
              onClick={() => sendMessage(client)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                background: c.actionBg,
                color:'#fff',
                border:'none',
                borderRadius:8,
                fontSize:11,
                fontWeight:700,
                cursor:'pointer',
                letterSpacing:'0.02em',
                boxShadow: `0 1px 3px ${c.actionBg}33`,
                transition:'transform 0.12s',
              }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='none'; }}
            >
              {actionLabel}
            </button>
          </div>
        ))}
      </div>

      {clients.length > 3 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background:'transparent',
            border:'none',
            color: c.accent,
            fontSize:12,
            fontWeight:700,
            cursor:'pointer',
            padding:'2px 0',
            textAlign:'left',
          }}
        >
          {expanded ? '↑ Show fewer' : `+ View all ${clients.length} →`}
        </button>
      )}
    </section>
  );
}

export default function ScheduleDashboard({ therapist }) {
  const [subView,setSubView]=useState('today');
  const [dayOffset,setDayOffset]=useState(0);
  const [realBookings,setRealBookings]=useState(null);
  const [pendingApprovalBookings,setPendingApprovalBookings]=useState([]);
  const [actioningId,setActioningId]=useState(null);
  const [declineFor,setDeclineFor]=useState(null); // booking id we're collecting decline reason for
  const [declineReason,setDeclineReason]=useState('');
  const [loading,setLoading]=useState(true);
  const [today] = useState(getToday);
  const SAMPLE = makeSample(today);
  const [showCreate, setShowCreate] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);

  // Blocked days state
  const [blockedDays, setBlockedDays] = useState([]);
  const [showBlockPanel, setShowBlockPanel] = useState(false);
  const [blockDate, setBlockDate] = useState('');
  const [blockNote, setBlockNote] = useState('');
  const [blockStartTime, setBlockStartTime] = useState('');
  const [blockEndTime, setBlockEndTime] = useState('');
  const [blockMode, setBlockMode] = useState('full');  // 'full' or 'partial'
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState('');

  useEffect(()=>{if(therapist?.id){ fetchBookings(); loadBlockedDays(); }},[therapist?.id]);

  async function loadBlockedDays() {
    const { data } = await supabase.from('blocked_days').select('*')
      .eq('therapist_id', therapist.id)
      .gte('date', new Date().toISOString().slice(0,10))
      .order('date');
    setBlockedDays(data || []);
  }

  async function addBlockedDay(args) {
    // Two call shapes supported:
    //   (1) addBlockedDay(): uses the inline-form state at the top
    //                          of Schedule (blockDate, blockMode, etc).
    //   (2) addBlockedDay({date, startTime, endTime, note}): used by
    //                          long-press in TimelineView (Phase 9.2).
    //                          Bypasses the inline form entirely.
    setBlockError('');

    const useArgs = args && typeof args === 'object' && args.date;
    const payload = useArgs
      ? {
          therapist_id: therapist.id,
          date: args.date,
          note: (args.note || '').trim() || null,
        }
      : {
          therapist_id: therapist.id,
          date: blockDate,
          note: blockNote.trim() || null,
        };

    if (useArgs) {
      // Long-press path is always partial. Validate.
      if (!args.startTime || !args.endTime) {
        setBlockError('Please set both a start and end time.');
        return null;
      }
      if (args.endTime <= args.startTime) {
        setBlockError('End time must be after start time.');
        return null;
      }
      payload.start_time = args.startTime;
      payload.end_time = args.endTime;
    } else {
      if (!blockDate) return null;
      if (blockMode === 'partial') {
        if (!blockStartTime || !blockEndTime) {
          setBlockError('Please set both a start and end time.');
          return null;
        }
        if (blockEndTime <= blockStartTime) {
          setBlockError('End time must be after start time.');
          return null;
        }
        payload.start_time = blockStartTime;
        payload.end_time = blockEndTime;
      }
    }

    setBlockSaving(true);
    const { data, error } = await supabase.from('blocked_days')
      .insert(payload)
      .select().single();
    if (error) {
      setBlockError(error.message || 'Could not save the block.');
      setBlockSaving(false);
      return null;
    }
    if (data) setBlockedDays(prev => [...prev, data].sort((a,b)=>{
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return (a.start_time || '').localeCompare(b.start_time || '');
    }));
    if (!useArgs) {
      setBlockDate(''); setBlockNote(''); setBlockStartTime(''); setBlockEndTime('');
      setBlockMode('full');
    }
    setBlockSaving(false);
    return data;
  }

  async function removeBlockedDay(id) {
    await supabase.from('blocked_days').delete().eq('id', id);
    setBlockedDays(prev => prev.filter(d => d.id !== id));
  }

  async function fetchBookings() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const toDateStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const past = new Date(today); past.setDate(today.getDate() - 365);
      const future = new Date(today); future.setDate(today.getDate() + 60);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*, services(name, duration, price, is_couples), reminder_sent_at, deposit_required, deposit_paid, deposit_amount, partner_name, partner_email')
        .eq('therapist_id', therapist.id)
        .neq('status', 'cancelled')
        .gte('booking_date', toDateStr(past))
        .lte('booking_date', toDateStr(future))
        .order('booking_date')
        .order('start_time');

      if (error || !bookings?.length) { setRealBookings([]); setPendingApprovalBookings([]); setLoading(false); return; }

      // Split pending-approval rows out so they live in their own panel.
      // The confirmed schedule should not show requests as if they were
      // already on the books.
      const pendingRows = (bookings || []).filter(b => b.status === 'pending-approval');
      const confirmedRows = (bookings || []).filter(b => b.status !== 'pending-approval');

      setPendingApprovalBookings(pendingRows.map(b => ({
        id: b.id,
        client: b.client_name,
        email: (b.client_email || '').toLowerCase().trim(),
        phone: b.client_phone || '',
        date: b.booking_date,
        time: b.start_time ? fmt12(b.start_time.slice(0,5)) : '',
        startTime: (b.start_time || '').slice(0,5),
        service: b.services?.name || 'Session',
        duration: b.services?.duration || 60,
        price: b.services?.price || 0,
        sms_opted_in: !!b.sms_opted_in,
        created_at: b.created_at,
      })));

      // Continue with confirmedRows for the main schedule mapping below.
      const bookingsForSchedule = confirmedRows;
      if (!bookingsForSchedule.length) { setRealBookings([]); setLoading(false); return; }

      // Single condition: a booking has intake done if and only if a session
      // exists with booking_id = this booking's id. ClientIntake now always
      // resolves booking_id at save time, so this is the only check needed.
      const bookingIds = bookingsForSchedule.map(b => b.id);
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, booking_id, client_id')
        .eq('therapist_id', therapist.id)
        .in('booking_id', bookingIds);

      // booking_id → session_id
      const sessionMap = {};
      (sessions || []).forEach(s => {
        if (s.booking_id) sessionMap[s.booking_id] = { id: s.id, client_id: s.client_id };
      });

      const mapped = bookingsForSchedule.map(b => {
        const bd = new Date(b.booking_date + 'T12:00:00'); bd.setHours(0,0,0,0);
        const [h, m] = (b.start_time || '00:00').slice(0,5).split(':').map(Number);
        const sessionInfo = sessionMap[b.id] || null;
        const sessionId = sessionInfo?.id || null;
        const clientId = sessionInfo?.client_id || null;

        // Single condition for complete: bookings.status === 'completed'
        // That is the only field the UI updates when marking a session done.
        const status = b.status === 'completed' ? 'complete'
                     : sessionId               ? 'intake-done'
                     :                           'pending-intake';

        return {
          id: b.id,
          client: b.client_name,
          email: (b.client_email || '').toLowerCase().trim(),
          time: fmt12(`${h}:${m}`),
          duration: b.services?.duration || 60,
          date: bd,
          status,
          sessionId,
          clientId,
          sessions: 0,
          service: b.services?.name || 'Session',
          notes: b.notes || '',
          price: b.services?.price || 85,
          focus: [],
          preview: false,
          reminder_sent: !!b.reminder_sent_at,
          deposit_required: b.deposit_required || false,
          deposit_paid: b.deposit_paid || false,
          deposit_amount: b.deposit_amount || 0,
          is_couples: b.services?.is_couples || false,
          partner_name: b.partner_name || null,
          partner_email: b.partner_email || null,
          endTime: (b.end_time || '').slice(0,5),
          startTime: (b.start_time || '').slice(0,5),
        };
      });

      // External Google Calendar events (Lindsey #10, May 10 2026).
      // Fetch the therapist's own external_calendar_events and merge
      // them into the same schedule list. Therapist sees the event
      // titles ('dentist', 'lunch') so she knows what is blocking her
      // time. Clients on the booking page never see these titles, only
      // a generic 'unavailable' state via the slot generator.
      //
      // Mapped shape mirrors a real booking but with external=true so
      // the render path can switch to a quieter card style. Avatar,
      // service, status icons all suppressed.
      let extEvents = [];
      try {
        const extFrom = new Date(today); extFrom.setDate(today.getDate() - 90);
        const extTo = new Date(today); extTo.setDate(today.getDate() + 60);
        const { data: extRows } = await supabase
          .from('external_calendar_events')
          .select('id, summary, start_at, end_at, is_all_day, source')
          .eq('therapist_id', therapist.id)
          .eq('status', 'confirmed')
          .gte('start_at', extFrom.toISOString())
          .lte('end_at', extTo.toISOString())
          .order('start_at');
        extEvents = (extRows || []).map(e => {
          const startD = new Date(e.start_at);
          const endD = new Date(e.end_at);
          const dateStr = `${startD.getFullYear()}-${String(startD.getMonth()+1).padStart(2,'0')}-${String(startD.getDate()).padStart(2,'0')}`;
          const startMins = startD.getHours() * 60 + startD.getMinutes();
          const durationMins = Math.round((endD - startD) / 60000);
          const startStr = `${String(startD.getHours()).padStart(2,'0')}:${String(startD.getMinutes()).padStart(2,'0')}`;
          const endStr = `${String(endD.getHours()).padStart(2,'0')}:${String(endD.getMinutes()).padStart(2,'0')}`;
          return {
            id: `ext_${e.id}`,
            external: true,
            externalSource: e.source || 'google',
            client: e.summary || 'Calendar event',
            email: '',
            time: e.is_all_day ? 'All day' : fmt12(startStr),
            duration: durationMins,
            date: dateStr,
            status: 'external',
            sessionId: null,
            clientId: null,
            sessions: 0,
            service: e.summary || 'Calendar event',
            notes: '',
            price: 0,
            focus: [],
            preview: false,
            reminder_sent: false,
            deposit_required: false,
            deposit_paid: false,
            deposit_amount: 0,
            is_couples: false,
            partner_name: null,
            partner_email: null,
            startTime: startStr,
            endTime: endStr,
            startMins,
            isAllDay: !!e.is_all_day,
          };
        });
      } catch (extErr) {
        console.warn('External events fetch failed (non-fatal):', extErr);
      }

      setRealBookings([...mapped, ...extEvents]);
    } catch(err) {
      console.error('fetchBookings error:', err);
      setRealBookings([]);
    }
    setLoading(false);
  }

  async function handleApproval(bookingId, action, reason) {
    setActioningId(bookingId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/booking-approval`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ booking_id: bookingId, action, reason: reason || null }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Could not update the request. Please try again.');
        setActioningId(null);
        return;
      }
      setActioningId(null);
      setDeclineFor(null);
      setDeclineReason('');
      fetchBookings();
    } catch (e) {
      console.error('booking-approval error:', e);
      setActioningId(null);
      alert('Something went wrong. Please try again.');
    }
  }

  // FIX: only show sample when upcoming real bookings < 3 (not total)
  const upcomingReal = (realBookings || []).filter(a => a.date >= today);
  const showSample = !realBookings || upcomingReal.length < 3;
  const allAppts = [...(realBookings||[]), ...(showSample ? SAMPLE : [])];

  const TABS=[{id:'today',label:'Today'},{id:'weekly',label:'Weekly'},{id:'monthly',label:'Monthly'},{id:'insights',label:'Insights'}];

  const isMobileW = window.innerWidth < 768;
  return (
    <div style={{width:'100%', paddingBottom: isMobileW ? 'calc(74px + env(safe-area-inset-bottom, 0px) + 24px)' : 0}}>
      {showCreate && (
        <BookingModal therapist={therapist} mode="create" onClose={() => setShowCreate(false)} onSuccess={fetchBookings} />
      )}
      {rescheduleAppt && (
        <BookingModal therapist={therapist} mode="reschedule" existingBooking={rescheduleAppt} onClose={() => setRescheduleAppt(null)} onSuccess={fetchBookings} />
      )}
      <div style={{marginBottom:14}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap',marginBottom:10}}>
          <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:'#1F2937',margin:0,lineHeight:1.1}}>Schedule</h2>
          <span style={{fontSize:13,color:'#6B7280',fontWeight:500}}>{fmtDay(today)}</span>
        </div>
        {/* Action row, unified pill buttons, consistent heights */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {/* Primary: Book Appointment */}
          <button onClick={() => setShowCreate(true)}
            style={{display:'inline-flex',alignItems:'center',gap:6,background:'linear-gradient(135deg,#2A5741,#3D6B54)',color:'#fff',border:'none',borderRadius:22,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(42,87,65,0.25)',height:40,lineHeight:1,WebkitTapHighlightColor:'transparent'}}>
            <span style={{fontSize:16,lineHeight:1,marginTop:-1}}>+</span>
            <span>Book Appointment</span>
          </button>

          {/* Secondary: status pill (non-interactive visual, tap refreshes) */}
          {realBookings?.length > 0
            ? <button onClick={fetchBookings} title="Refresh bookings"
                style={{display:'inline-flex',alignItems:'center',gap:6,background:'#F0FDF4',border:'1.5px solid #86EFAC',borderRadius:22,padding:'10px 14px',fontSize:12,color:'#16A34A',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',height:40,lineHeight:1,WebkitTapHighlightColor:'transparent'}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#16A34A',boxShadow:'0 0 0 3px rgba(22,163,74,0.2)'}}/>
                <span>Live</span>
                <span style={{fontSize:12,opacity:0.7,marginLeft:2}}>↻</span>
              </button>
            : <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'#FFF7ED',border:'1.5px solid #FED7AA',borderRadius:22,padding:'10px 14px',fontSize:12,color:'#9A3412',fontWeight:700,whiteSpace:'nowrap',height:40,lineHeight:1}}>
                <span>👁️</span> Preview
              </div>
          }

          {/* Secondary: Time off toggle */}
          <button onClick={()=>setShowBlockPanel(v=>!v)}
            style={{display:'inline-flex',alignItems:'center',gap:6,background:showBlockPanel?'#F3F4F6':'#fff',border:'1.5px solid #E5E7EB',borderRadius:22,padding:'10px 14px',fontSize:12,fontWeight:700,color:'#4B5563',cursor:'pointer',whiteSpace:'nowrap',height:40,lineHeight:1,WebkitTapHighlightColor:'transparent'}}>
            <span>🌿</span>
            <span>Time off</span>
            {blockedDays.length > 0 && (
              <span style={{background:'#FEE2E2',color:'#DC2626',borderRadius:20,padding:'2px 7px',fontSize:11,fontWeight:700,lineHeight:1}}>{blockedDays.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Block panel, expands below action row */}
      {showBlockPanel && (
        <div style={{
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FBFAF4 100%)',
          border: '1px solid #EAE5DA',
          borderRadius: 16,
          padding: '22px 24px',
          marginBottom: 12,
          boxShadow: '0 1px 3px rgba(31, 41, 55, 0.04)',
        }}>
          {/* Header row with title + mode pills, all on one line.
              Replaces the awkward "BLOCK" label that read like a form
              field label. Now it's a section heading with the choice
              built into the same line. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 17,
              fontWeight: 400,
              color: '#1F4030',
              letterSpacing: '-0.005em',
            }}>
              Block off time
            </div>
            <div style={{
              display: 'flex',
              gap: 4,
              background: '#F3F4F6',
              borderRadius: 999,
              padding: 3,
            }}>
              <button
                onClick={() => { setBlockMode('full'); setBlockStartTime(''); setBlockEndTime(''); setBlockError(''); }}
                style={{
                  background: blockMode === 'full' ? '#fff' : 'transparent',
                  color: blockMode === 'full' ? '#1F4030' : '#6B7280',
                  border: 'none',
                  borderRadius: 999,
                  padding: '5px 13px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: blockMode === 'full' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}>
                Full day
              </button>
              <button
                onClick={() => { setBlockMode('partial'); setBlockError(''); }}
                style={{
                  background: blockMode === 'partial' ? '#fff' : 'transparent',
                  color: blockMode === 'partial' ? '#1F4030' : '#6B7280',
                  border: 'none',
                  borderRadius: 999,
                  padding: '5px 13px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: blockMode === 'partial' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}>
                Time range
              </button>
            </div>
          </div>

          {/* Inline composition row. Reads as a sentence:
                "from [time] to [time] on [date] · [reason]    [Block]"
              In full-day mode, the times collapse and it becomes:
                "all of [date] · [reason]    [Block]"
              Mobile reflow: each chunk wraps to its own line gracefully
              with consistent vertical rhythm. */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            marginBottom: blockError ? 12 : 6,
          }}>
            {blockMode === 'partial' && (
              <>
                <span style={{
                  fontFamily: 'Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: '#6B7280',
                }}>from</span>
                <InlineTimeInput
                  value={blockStartTime}
                  onChange={(t) => { setBlockStartTime(t); setBlockError(''); }}
                  placeholder="10:00 AM"
                  ariaLabel="Start time of blocked window"
                  width={108}
                />
                <span style={{
                  fontFamily: 'Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: '#6B7280',
                }}>to</span>
                <InlineTimeInput
                  value={blockEndTime}
                  onChange={(t) => { setBlockEndTime(t); setBlockError(''); }}
                  placeholder="2:00 PM"
                  ariaLabel="End time of blocked window"
                  width={108}
                />
              </>
            )}
            {blockMode === 'full' && (
              <span style={{
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                fontSize: 14,
                color: '#6B7280',
              }}>all of</span>
            )}
            <span style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontSize: 14,
              color: '#6B7280',
            }}>on</span>
            <input
              type="date"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              aria-label="Date to block"
              style={{
                padding: '8px 12px',
                border: `1.5px solid ${blockDate ? '#E8E4DC' : '#FCA5A5'}`,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: '#1F4030',
                outline: 'none',
                background: '#FBFAF4',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                minWidth: 150,
              }}
            />
          </div>

          {/* Reason row, full width. Optional. Inline with the rest of
              the composition but on its own line so longer reasons
              don't crowd the time/date controls. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}>
            <span style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontSize: 14,
              color: '#6B7280',
              flexShrink: 0,
            }}>because</span>
            <input
              type="text"
              value={blockNote}
              onChange={(e) => setBlockNote(e.target.value)}
              placeholder={blockMode === 'partial' ? 'lunch, errand, school pickup' : 'vacation, personal day, conference'}
              aria-label="Reason for blocking time (optional)"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1.5px solid #E8E4DC',
                borderRadius: 10,
                fontSize: 14,
                color: '#1F2937',
                outline: 'none',
                background: '#FBFAF4',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontStyle: 'italic',
              }}
              onFocus={(e) => { e.target.style.background = '#fff'; e.target.style.borderColor = '#2A5741'; }}
              onBlur={(e) => { e.target.style.background = '#FBFAF4'; e.target.style.borderColor = '#E8E4DC'; }}
            />
          </div>

          {/* Action row: error banner on the left if any, Block button
              on the right. The button is sized confidently. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: blockError ? 'space-between' : 'flex-end',
            flexWrap: 'wrap',
          }}>
            {blockError && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                flex: 1,
                minWidth: 200,
              }}>
                {blockError}
              </div>
            )}
            <button
              onClick={addBlockedDay}
              disabled={!blockDate || blockSaving}
              style={{
                background: !blockDate ? '#D1D5DB' : 'linear-gradient(135deg, #2A5741, #1F4030)',
                color: '#fff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.01em',
                cursor: blockDate ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                boxShadow: blockDate ? '0 2px 8px rgba(42, 87, 65, 0.22)' : 'none',
                transition: 'transform 0.1s, box-shadow 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseDown={(e) => { if (blockDate) e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {blockSaving ? 'Blocking…' : (blockMode === 'partial' ? 'Block this time' : 'Block this day')}
            </button>
          </div>

          {/* Existing blocks list. Polished entries that read clearly
              and align cleanly. */}
          {blockedDays.length > 0 && (
            <div style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: '1px solid #EAE5DA',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6B7280',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                Currently blocked
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blockedDays.map(d => {
                  const dateLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  const isPartial = d.start_time && d.end_time;
                  const fmtTime = (t) => {
                    if (!t) return '';
                    const [h, m] = t.split(':');
                    const hh = parseInt(h, 10);
                    const ampm = hh >= 12 ? 'PM' : 'AM';
                    const hr = hh % 12 === 0 ? 12 : hh % 12;
                    return `${hr}:${m} ${ampm}`;
                  };
                  const timeText = isPartial
                    ? `${fmtTime(d.start_time)} to ${fmtTime(d.end_time)}`
                    : 'all day';
                  return (
                    <div key={d.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#fff',
                      border: '1px solid #EAE5DA',
                      borderRadius: 10,
                      padding: '10px 14px',
                      gap: 12,
                    }}>
                      <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontFamily: 'Georgia, serif',
                          fontSize: 14,
                          fontWeight: 400,
                          color: '#1F4030',
                          whiteSpace: 'nowrap',
                        }}>
                          {dateLabel}
                        </span>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isPartial ? '#92400E' : '#4B5563',
                          background: isPartial ? '#FEF3C7' : '#F3F4F6',
                          border: `1px solid ${isPartial ? '#FCD34D' : '#D1D5DB'}`,
                          borderRadius: 999,
                          padding: '2px 10px',
                          whiteSpace: 'nowrap',
                        }}>
                          {timeText}
                        </span>
                        {d.note && (
                          <span style={{
                            fontSize: 13,
                            color: '#6B7280',
                            fontStyle: 'italic',
                            fontFamily: 'Georgia, serif',
                          }}>
                            {d.note}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeBlockedDay(d.id)}
                        aria-label={`Remove block for ${dateLabel}`}
                        style={{
                          background: 'transparent',
                          color: '#9CA3AF',
                          border: '1px solid transparent',
                          borderRadius: 8,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#DC2626';
                          e.currentTarget.style.background = '#FEF2F2';
                          e.currentTarget.style.borderColor = '#FCA5A5';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#9CA3AF';
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {blockedDays.length === 0 && (
            <div style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid #EAE5DA',
              fontSize: 13,
              color: '#9CA3AF',
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              textAlign: 'center',
            }}>
              Nothing blocked yet. Clients can book any available slot up to a year out.
            </div>
          )}
        </div>
      )}

      {/* Pending booking requests, only shown when therapist has approval
          required and at least one new-client request is waiting. */}
      {pendingApprovalBookings.length > 0 && (
        <div style={{background:'#FFFBEB',border:'1.5px solid #FDE68A',borderRadius:14,padding:'18px 18px 14px',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <span style={{fontSize:18}}>🌿</span>
            <div style={{fontSize:15,fontWeight:700,color:'#92400E',fontFamily:'Georgia,serif'}}>
              Pending requests <span style={{background:'#FDE68A',color:'#92400E',borderRadius:20,padding:'2px 9px',fontSize:12,marginLeft:4}}>{pendingApprovalBookings.length}</span>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {pendingApprovalBookings.map(req => {
              const reqDate = new Date(req.date + 'T12:00:00');
              const dateLabel = reqDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
              const isDeclining = declineFor === req.id;
              const isActioning = actioningId === req.id;
              return (
                <div key={req.id} style={{background:'#fff',borderRadius:10,padding:'14px 14px 12px',border:'1px solid #FDE68A'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
                    <div style={{width:38,height:38,borderRadius:'50%',background:ac(req.client),color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{initials(req.client)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#1F2937',fontFamily:'Georgia,serif'}}>{req.client}</div>
                      <div style={{fontSize:12,color:'#6B7280',marginTop:1}}>{dateLabel} at {req.time} · {req.service} ({req.duration} min)</div>
                      <div style={{fontSize:11,color:'#9CA3AF',marginTop:1}}>{req.email}{req.phone ? ` · ${req.phone}` : ''}</div>
                    </div>
                  </div>
                  {!isDeclining ? (
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={() => handleApproval(req.id, 'approve')}
                        disabled={isActioning}
                        style={{flex:1,background:isActioning?'#86EFAC':'#16A34A',color:'#fff',border:'none',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700,cursor:isActioning?'wait':'pointer',whiteSpace:'nowrap'}}>
                        {isActioning ? '…' : '✓ Approve'}
                      </button>
                      <button onClick={() => { setDeclineFor(req.id); setDeclineReason(''); }}
                        disabled={isActioning}
                        style={{flex:1,background:'#fff',color:'#DC2626',border:'1.5px solid #FECACA',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700,cursor:isActioning?'not-allowed':'pointer',whiteSpace:'nowrap'}}>
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div>
                      <textarea value={declineReason} onChange={e=>setDeclineReason(e.target.value)}
                        placeholder="Optional message to the client (they will see this in their email)"
                        rows={3}
                        style={{width:'100%',padding:'9px 11px',border:'1.5px solid #E8E4DC',borderRadius:8,fontSize:13,resize:'vertical',fontFamily:'system-ui',outline:'none',boxSizing:'border-box',marginBottom:8}} />
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={() => handleApproval(req.id, 'decline', declineReason.trim() || null)}
                          disabled={isActioning}
                          style={{flex:1,background:isActioning?'#FECACA':'#DC2626',color:'#fff',border:'none',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700,cursor:isActioning?'wait':'pointer'}}>
                          {isActioning ? '…' : 'Send decline'}
                        </button>
                        <button onClick={() => { setDeclineFor(null); setDeclineReason(''); }}
                          disabled={isActioning}
                          style={{background:'#F3F4F6',color:'#6B7280',border:'none',borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:600,cursor:isActioning?'not-allowed':'pointer'}}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats: single dense inline row. HK May 14 2026: the four
          card tiles ate 110px of vertical space above the calendar,
          which is the star feature. Compressed to one line that
          carries the same four numbers with a thin separator. Same
          numbers, ~75px shorter. Wraps on narrow viewports. */}
      <div className="bm-sched-stats" style={{
        display:'flex',
        flexWrap:'wrap',
        gap:0,
        marginBottom:14,
        padding:'10px 14px',
        background:'#fff',
        borderRadius:10,
        border:'1px solid #F3F4F6',
        alignItems:'center',
      }}>
        {[
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview).length,label:'Today',color:'#2A5741'},
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview&&a.status==='intake-done').length,label:'Brief ready',color:'#16A34A'},
          {val:allAppts.filter(a=>sameDay(a.date,today)&&!a.preview&&a.status==='pending-intake').length,label:'Need intake',color:'#D97706'},
          {val:allAppts.filter(a=>!a.preview&&a.date>=today&&a.date<=addDays(today,7)).length,label:'This week',color:'#6B9E80'},
        ].map((s,idx,arr)=>(
          <React.Fragment key={s.label}>
            <div style={{display:'inline-flex',alignItems:'baseline',gap:6,padding:'0 14px',flexShrink:0}}>
              <span style={{fontSize:18,fontWeight:700,fontFamily:'Georgia,serif',color:s.color,lineHeight:1}}>{s.val}</span>
              <span style={{fontSize:11,color:'#9CA3AF',fontWeight:600,letterSpacing:'0.02em'}}>{s.label}</span>
            </div>
            {idx < arr.length - 1 && <div style={{width:1,height:18,background:'#E5E7EB',flexShrink:0}}/>}
          </React.Fragment>
        ))}
      </div>

      {/* Tab bar */}
      <div className="bm-tabbar" style={{display:'flex',gap:2,background:'#F3F4F6',borderRadius:12,padding:4,marginBottom:20,width:'fit-content',maxWidth:'100%',overflowX:'auto',scrollbarWidth:'none',WebkitOverflowScrolling:'touch',flexWrap:'nowrap'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubView(t.id)}
            style={{background:subView===t.id?'#fff':'transparent',color:subView===t.id?'#1F2937':'#6B7280',border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:subView===t.id?'0 1px 4px rgba(0,0,0,0.1)':'none',transition:'all 0.15s',whiteSpace:'nowrap',flexShrink:0}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading
        ?<div style={{textAlign:'center',padding:'40px',color:'#9CA3AF',fontSize:14}}>Loading schedule...</div>
        :(
          /* Persistent 2-col layout. Left rail (intelligence) shows on
             every tab. Right pane swaps Today / Weekly / Monthly /
             Insights. Mobile collapses to single column with rail on
             top.

             Per founder playbook (How we win > intelligence layer):
             insights and intelligence must surface where the decision
             is made, not in an isolated analytics tab. The same Client
             Brief, Body Load, Revenue Pulse, Fill This Gap, and Rebook
             Watch live alongside whichever calendar view the therapist
             is on. */
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobileW ? '1fr' : '260px 1fr',
            gap: isMobileW ? 14 : 16,
            alignItems: 'start',
          }}>
            {/* LEFT RAIL. minWidth:0 wrapper prevents grid-item blow-out
                when the inner carousel has content wider than the column. */}
            <div style={{ minWidth: 0, width: '100%' }}>
              <SmartBookingRail
                isMobile={isMobileW}
                therapist={therapist}
                allAppts={allAppts}
                today={today}
                scope={subView}
              />
            </div>

            {/* RIGHT PANE: tab-selected calendar/insights view. */}
            <div style={{ minWidth: 0 }}>
              {subView==='today'   &&<TimelineView therapist={therapist} allAppts={allAppts} dayOffset={dayOffset} setDayOffset={setDayOffset} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings} blockedDays={blockedDays} onCreateBlock={addBlockedDay}/>}
              {subView==='weekly'  &&<WeeklyView therapist={therapist} appointments={allAppts} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings}/>}
              {subView==='monthly' &&<MonthlyView therapist={therapist} appointments={allAppts} today={today} onReschedule={setRescheduleAppt} onRefresh={fetchBookings}/>}
              {subView==='insights'&&<InsightsView appointments={allAppts}/>}
            </div>
          </div>
        )
      }
    </div>
  );
}
