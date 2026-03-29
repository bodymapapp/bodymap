import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', danger:'#EF4444' };

function formatTime(t) {
  const [h,m] = t.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}
function formatDate(s) {
  return new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
}
function generateSlots(start, end, dur, booked) {
  const slots=[];
  const [sh,sm]=start.split(':').map(Number);
  const [eh,em]=end.split(':').map(Number);
  let cur=sh*60+sm;
  const endMin=eh*60+em;
  while(cur+dur<=endMin){
    const hh=String(Math.floor(cur/60)).padStart(2,'0');
    const mm=String(cur%60).padStart(2,'0');
    const slotEnd=`${String(Math.floor((cur+dur)/60)).padStart(2,'0')}:${String((cur+dur)%60).padStart(2,'0')}`;
    const conflict=booked.some(b=>!(slotEnd<=b.start_time.slice(0,5)||`${hh}:${mm}`>=b.end_time.slice(0,5)));
    if(!conflict) slots.push({start:`${hh}:${mm}`,end:slotEnd,display:formatTime(`${hh}:${mm}`)});
    cur+=30;
  }
  return slots;
}

function Cal({availability,selected,onSelect}) {
  const today=new Date(); today.setHours(0,0,0,0);
  const [yr,setYr]=useState(today.getFullYear());
  const [mo,setMo]=useState(today.getMonth());
  const days=new Date(yr,mo+1,0).getDate();
  const offset=(()=>{const d=new Date(yr,mo,1).getDay();return d===0?6:d-1;})();
  const avDows=availability.map(a=>a.day_of_week);
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const cells=[];
  for(let i=0;i<offset;i++) cells.push(null);
  for(let d=1;d<=days;d++) cells.push(d);
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <button onClick={()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);}} style={{background:'none',border:`1px solid ${C.light}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:16,color:C.dark}}>‹</button>
        <span style={{fontSize:15,fontWeight:600,color:C.dark}}>{MONTHS[mo]} {yr}</span>
        <button onClick={()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);}} style={{background:'none',border:`1px solid ${C.light}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:16,color:C.dark}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:6}}>
        {['M','T','W','T','F','S','S'].map((d,i)=><div key={i} style={{textAlign:'center',fontSize:11,fontWeight:700,color:C.gray,padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const date=new Date(yr,mo,d); date.setHours(0,0,0,0);
          const dateStr=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const disabled=!avDows.includes(date.getDay())||date<today;
          const isSel=selected===dateStr;
          return <button key={i} disabled={disabled} onClick={()=>onSelect(dateStr)}
            style={{padding:'9px 4px',borderRadius:8,border:`1.5px solid ${isSel?C.forest:'transparent'}`,
              background:isSel?C.forest:disabled?'transparent':C.white,
              color:isSel?C.white:disabled?'#D1D5DB':C.dark,
              fontSize:13,fontWeight:isSel?700:400,cursor:disabled?'default':'pointer',opacity:disabled?0.35:1}}>
            {d}
          </button>;
        })}
      </div>
    </div>
  );
}

export default function BookingPage() {
  const {slug}=useParams();
  const [therapist,setTherapist]=useState(null);
  const [services,setServices]=useState([]);
  const [availability,setAvailability]=useState([]);
  const [loading,setLoading]=useState(true);
  const [notFound,setNotFound]=useState(false);
  const [step,setStep]=useState(1);
  const [svc,setSvc]=useState(null);
  const [date,setDate]=useState('');
  const [slots,setSlots]=useState([]);
  const [slot,setSlot]=useState(null);
  const [loadingSlots,setLoadingSlots]=useState(false);
  const [form,setForm]=useState({name:'',email:'',phone:'',notes:''});
  const [errors,setErrors]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [confirmed,setConfirmed]=useState(false);

  useEffect(()=>{load();},[slug]);
  useEffect(()=>{if(date&&svc) loadSlots();},[date,svc]);

  async function load() {
    const {data:t}=await supabase.from('therapists').select('*').eq('custom_url',slug).single();
    if(!t){setNotFound(true);setLoading(false);return;}
    setTherapist(t);
    const [{data:s},{data:a}]=await Promise.all([
      supabase.from('services').select('*').eq('therapist_id',t.id).eq('active',true).order('duration'),
      supabase.from('availability').select('*').eq('therapist_id',t.id).eq('active',true),
    ]);
    setServices(s||[]);
    setAvailability(a||[]);
    setLoading(false);
  }

  async function loadSlots() {
    setLoadingSlots(true); setSlots([]); setSlot(null);
    const dow=new Date(date+'T12:00:00').getDay();
    const av=availability.find(a=>a.day_of_week===dow);
    if(!av){setLoadingSlots(false);return;}
    const {data:existing}=await supabase.from('bookings').select('start_time,end_time').eq('therapist_id',therapist.id).eq('booking_date',date).neq('status','cancelled');
    setSlots(generateSlots(av.start_time.slice(0,5),av.end_time.slice(0,5),svc.duration,existing||[]));
    setLoadingSlots(false);
  }

  async function submit() {
    const errs={};
    if(!form.name.trim()) errs.name='Required';
    if(!form.email.trim()||!/\S+@\S+\.\S+/.test(form.email)) errs.email='Valid email required';
    if(Object.keys(errs).length){setErrors(errs);return;}
    setSubmitting(true);
    await supabase.from('bookings').insert({therapist_id:therapist.id,service_id:svc.id,client_name:form.name.trim(),client_email:form.email.trim().toLowerCase(),client_phone:form.phone,booking_date:date,start_time:slot.start,end_time:slot.end,notes:form.notes,status:'confirmed'});
    setSubmitting(false);
    setConfirmed(true);
  }

  if(loading) return <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:C.gray}}>Loading...</span></div>;
  if(notFound) return <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{textAlign:'center'}}><div style={{fontSize:48,marginBottom:16}}>🌿</div><h2 style={{fontFamily:'Georgia,serif',color:C.dark}}>Page not found</h2></div></div>;

  if(confirmed) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:C.white,borderRadius:20,padding:'40px 32px',maxWidth:420,width:'100%',textAlign:'center',boxShadow:'0 8px 40px rgba(0,0,0,0.1)'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'#DCFCE7',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:32}}>✅</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:C.dark,margin:'0 0 8px'}}>You're booked!</h2>
        <p style={{color:C.gray,fontSize:14,lineHeight:1.7,margin:'0 0 24px'}}>
          {form.name.split(' ')[0]}, your <strong>{svc.name}</strong> with <strong>{therapist.business_name||therapist.full_name}</strong> is confirmed for <strong>{formatDate(date)}</strong> at <strong>{slot.display}</strong>.
        </p>
        <div style={{background:C.beige,borderRadius:12,padding:'14px 18px',textAlign:'left'}}>
          <div style={{fontSize:12,color:C.gray,marginBottom:4}}>Confirmation for</div>
          <div style={{fontSize:14,fontWeight:600,color:C.dark}}>{form.email}</div>
        </div>
      </div>
    </div>
  );

  const pct=step===1?25:step===2?50:step===3?75:100;

  return (
    <div style={{minHeight:'100vh',background:C.beige,fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:C.white,borderBottom:`1px solid ${C.light}`,padding:'16px 24px'}}>
        <div style={{maxWidth:540,margin:'0 auto',display:'flex',alignItems:'center',gap:14}}>
          {therapist.photo_url
            ?<img src={therapist.photo_url} alt="" style={{width:44,height:44,borderRadius:'50%',objectFit:'cover'}}/>
            :<div style={{width:44,height:44,borderRadius:'50%',background:C.forest,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700}}>{(therapist.full_name||'T')[0]}</div>
          }
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.dark}}>{therapist.business_name||therapist.full_name}</div>
            <div style={{fontSize:12,color:C.gray}}>Online booking</div>
          </div>
        </div>
      </div>
      <div style={{height:3,background:C.light}}><div style={{height:3,background:C.forest,width:`${pct}%`,transition:'width 0.4s ease'}}/></div>

      <div style={{maxWidth:540,margin:'0 auto',padding:'28px 16px 80px'}}>

        {step===1 && (
          <div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:C.dark,margin:'0 0 6px'}}>Choose a service</h2>
            <p style={{fontSize:14,color:C.gray,margin:'0 0 20px'}}>What type of session would you like?</p>
            {services.length===0
              ?<div style={{background:C.white,borderRadius:14,padding:32,textAlign:'center',color:C.gray}}>No services available yet.</div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {services.map(s=>(
                  <button key={s.id} onClick={()=>{setSvc(s);setStep(2);}}
                    style={{background:C.white,border:`2px solid ${svc?.id===s.id?C.forest:C.light}`,borderRadius:14,padding:'18px 22px',textAlign:'left',cursor:'pointer',width:'100%',transition:'border-color 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=C.sage}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=svc?.id===s.id?C.forest:C.light}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:16,fontWeight:700,color:C.dark,marginBottom:4}}>{s.name}</div>
                        <span style={{background:'#F0FDF4',color:'#16A34A',borderRadius:20,padding:'3px 10px',fontSize:12,fontWeight:600}}>⏱ {s.duration} min</span>
                        {s.description&&<div style={{fontSize:13,color:C.gray,marginTop:6}}>{s.description}</div>}
                      </div>
                      <div style={{fontSize:22,fontWeight:700,color:C.forest,marginLeft:16}}>${s.price}</div>
                    </div>
                  </button>
                ))}
              </div>
            }
          </div>
        )}

        {step===2 && (
          <div>
            <button onClick={()=>setStep(1)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 14px',display:'flex',alignItems:'center',gap:4}}>← Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:C.dark,margin:'0 0 6px'}}>Pick a date & time</h2>
            <p style={{fontSize:14,color:C.gray,margin:'0 0 20px'}}>{svc.name} · {svc.duration} min · ${svc.price}</p>
            <div style={{background:C.white,borderRadius:14,padding:22,marginBottom:14}}>
              <Cal availability={availability} selected={date} onSelect={setDate}/>
            </div>
            {date&&(
              <div style={{background:C.white,borderRadius:14,padding:22}}>
                <div style={{fontSize:12,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:14}}>{formatDate(date)}</div>
                {loadingSlots?<div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:14}}>Finding available times...</div>
                :slots.length===0?<div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:14}}>No availability. Try another date.</div>
                :<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {slots.map(s=>(
                    <button key={s.start} onClick={()=>setSlot(s)}
                      style={{padding:'12px 8px',borderRadius:10,border:`2px solid ${slot?.start===s.start?C.forest:C.light}`,
                        background:slot?.start===s.start?C.forest:C.white,
                        color:slot?.start===s.start?C.white:C.dark,
                        fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.15s'}}>
                      {s.display}
                    </button>
                  ))}
                </div>}
              </div>
            )}
            {slot&&<button onClick={()=>setStep(3)} style={{width:'100%',background:C.forest,color:C.white,border:'none',borderRadius:14,padding:'15px',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:14}}>Continue →</button>}
          </div>
        )}

        {step===3 && (
          <div>
            <button onClick={()=>setStep(2)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 14px',display:'flex',alignItems:'center',gap:4}}>← Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:C.dark,margin:'0 0 6px'}}>Your details</h2>
            <p style={{fontSize:14,color:C.gray,margin:'0 0 20px'}}>{formatDate(date)} · {slot.display} · {svc.name}</p>
            <div style={{background:C.white,borderRadius:14,padding:22,display:'flex',flexDirection:'column',gap:14}}>
              {[{k:'name',l:'Full Name',p:'Jane Smith',r:true,t:'text'},{k:'email',l:'Email',p:'jane@example.com',r:true,t:'email'},{k:'phone',l:'Phone (optional)',p:'(512) 555-1234',t:'tel'}].map(({k,l,p,r,t})=>(
                <div key={k}>
                  <label style={{fontSize:12,fontWeight:700,color:C.gray,display:'block',marginBottom:6}}>{l}{r&&<span style={{color:C.danger}}> *</span>}</label>
                  <input type={t||'text'} value={form[k]} placeholder={p}
                    onChange={e=>{setForm(f=>({...f,[k]:e.target.value}));setErrors(er=>({...er,[k]:''}));}}
                    style={{width:'100%',padding:'12px 14px',border:`1.5px solid ${errors[k]?C.danger:C.light}`,borderRadius:10,fontSize:14,boxSizing:'border-box',outline:'none'}}/>
                  {errors[k]&&<div style={{fontSize:11,color:C.danger,marginTop:4}}>{errors[k]}</div>}
                </div>
              ))}
              <div>
                <label style={{fontSize:12,fontWeight:700,color:C.gray,display:'block',marginBottom:6}}>Notes for your therapist (optional)</label>
                <textarea value={form.notes} placeholder="Areas to focus on, injuries, preferences..." rows={3}
                  onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  style={{width:'100%',padding:'12px 14px',border:`1.5px solid ${C.light}`,borderRadius:10,fontSize:14,boxSizing:'border-box',resize:'vertical',outline:'none'}}/>
              </div>
            </div>
            <button onClick={()=>setStep(4)} style={{width:'100%',background:C.forest,color:C.white,border:'none',borderRadius:14,padding:'15px',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:14}}>Review Booking →</button>
          </div>
        )}

        {step===4 && (
          <div>
            <button onClick={()=>setStep(3)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 14px',display:'flex',alignItems:'center',gap:4}}>← Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,color:C.dark,margin:'0 0 6px'}}>Confirm booking</h2>
            <p style={{fontSize:14,color:C.gray,margin:'0 0 20px'}}>Everything look right?</p>
            <div style={{background:C.white,borderRadius:14,padding:22,marginBottom:14}}>
              {[['Service',`${svc.name} · ${svc.duration} min`],['Date',formatDate(date)],['Time',slot.display],['With',therapist.business_name||therapist.full_name],['Price',`$${svc.price}`],['Name',form.name],['Email',form.email],...(form.phone?[['Phone',form.phone]]:[]),...(form.notes?[['Notes',form.notes]]:[])].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,padding:'8px 0',borderBottom:`1px solid ${C.light}`}}>
                  <span style={{fontSize:13,color:C.gray,flexShrink:0}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:600,color:C.dark,textAlign:'right'}}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={submit} disabled={submitting}
              style={{width:'100%',background:submitting?C.sage:C.forest,color:C.white,border:'none',borderRadius:14,padding:'16px',fontSize:16,fontWeight:700,cursor:submitting?'wait':'pointer'}}>
              {submitting?'Confirming...':'✓ Confirm Booking'}
            </button>
            <p style={{fontSize:11,color:C.gray,textAlign:'center',marginTop:10}}>No payment collected now. Pay at your session.</p>
          </div>
        )}

      </div>
    </div>
  );
}
