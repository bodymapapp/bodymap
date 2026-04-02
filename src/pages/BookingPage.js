import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280', light:'#E8E4DC', danger:'#EF4444', amber:'#F59E0B' };

const fmt12 = t => { const [h,m]=t.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const fmtDate = s => new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
const fmtShort = s => new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});

function generateSlots(start, end, dur, booked) {
  const slots=[], [sh,sm]=start.split(':').map(Number), [eh,em]=end.split(':').map(Number);
  let cur=sh*60+sm; const endMin=eh*60+em;
  while(cur+dur<=endMin){
    const hh=String(Math.floor(cur/60)).padStart(2,'0'), mm=String(cur%60).padStart(2,'0');
    const se=`${String(Math.floor((cur+dur)/60)).padStart(2,'0')}:${String((cur+dur)%60).padStart(2,'0')}`;
    const conflict=booked.some(b=>!(se<=b.start_time.slice(0,5)||`${hh}:${mm}`>=b.end_time.slice(0,5)));
    if(!conflict) slots.push({start:`${hh}:${mm}`,end:se,display:fmt12(`${hh}:${mm}`),minutes:cur});
    cur+=30;
  }
  return slots;
}

// Smart slot scoring: prefer slots that create contiguous blocks (anti-gap)
function scoreSlots(slots, existingBooked, dur) {
  return slots.map(slot => {
    let score = 0;
    const slotEnd = slot.minutes + dur;
    // Bonus if adjacent to existing booking (fills gap)
    const adjacentBefore = existingBooked.some(b => {
      const be = b.end_time ? parseInt(b.end_time.split(':')[0])*60+parseInt(b.end_time.split(':')[1]) : 0;
      return Math.abs(be - slot.minutes) <= 30;
    });
    const adjacentAfter = existingBooked.some(b => {
      const bs = b.start_time ? parseInt(b.start_time.split(':')[0])*60+parseInt(b.start_time.split(':')[1]) : 0;
      return Math.abs(bs - slotEnd) <= 30;
    });
    if(adjacentBefore || adjacentAfter) score += 3;
    // Prefer morning (before noon) slightly
    if(slot.minutes < 720) score += 1;
    return {...slot, score, recommended: adjacentBefore || adjacentAfter};
  }).sort((a,b) => b.score - a.score);
}

function Cal({availability, selected, onSelect}) {
  const today=new Date(); today.setHours(0,0,0,0);
  const [yr,setYr]=useState(today.getFullYear());
  const [mo,setMo]=useState(today.getMonth());
  const avDows=availability.map(a=>a.day_of_week);
  const days=new Date(yr,mo+1,0).getDate();
  const offset=(()=>{const d=new Date(yr,mo,1).getDay();return d===0?6:d-1;})();
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const cells=[...Array(offset).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <button onClick={()=>mo===0?[setMo(11),setYr(y=>y-1)]:setMo(m=>m-1)} style={{background:'none',border:`1px solid ${C.light}`,borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:15,color:C.dark}}>‹</button>
        <span style={{fontSize:15,fontWeight:600,color:C.dark}}>{MONTHS[mo]} {yr}</span>
        <button onClick={()=>mo===11?[setMo(0),setYr(y=>y+1)]:setMo(m=>m+1)} style={{background:'none',border:`1px solid ${C.light}`,borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:15,color:C.dark}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:6}}>
        {['M','T','W','T','F','S','S'].map((d,i)=><div key={i} style={{textAlign:'center',fontSize:11,fontWeight:700,color:C.gray,padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const dt=new Date(yr,mo,d); dt.setHours(0,0,0,0);
          const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const nowTime = new Date();
          const isToday2 = dt.toDateString() === today.toDateString();
          const pastLastSlot = isToday2 && nowTime.getHours() >= 17; // past 5pm
          const disabled=!avDows.includes(dt.getDay())||dt<today||pastLastSlot;
          const isSel=selected===ds, isToday=dt.toDateString()===today.toDateString();
          return <button key={i} disabled={disabled} onClick={()=>onSelect(ds)}
            style={{padding:'9px 2px',borderRadius:8,border:`1.5px solid ${isSel?C.forest:isToday?C.sage:'transparent'}`,
              background:isSel?C.forest:'transparent',
              color:isSel?C.white:disabled?'#D1D5DB':isToday?C.forest:C.dark,
              fontSize:13,fontWeight:isSel||isToday?700:400,cursor:disabled?'default':'pointer',
              transition:'all 0.1s'}}>
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
  const [step,setStep]=useState(1); // 1=service, 2=datetime, 3=details, 4=confirm
  const [svc,setSvc]=useState(null);
  const [date,setDate]=useState('');
  const [slots,setSlots]=useState([]);
  const [existingBooked,setExistingBooked]=useState([]);
  const [slot,setSlot]=useState(null);
  const [loadingSlots,setLoadingSlots]=useState(false);
  const [form,setForm]=useState({name:'',email:'',phone:'',notes:''});
  const [errors,setErrors]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [depositRequired,setDepositRequired]=useState(false);
  const [depositAmount,setDepositAmount]=useState(0);
  const [depositClientSecret,setDepositClientSecret]=useState(null);
  const [depositPaid,setDepositPaid]=useState(false);
  const [depositLoading,setDepositLoading]=useState(false);
  const [paymentProcessing,setPaymentProcessing]=useState(false);
  const [paymentError,setPaymentError]=useState(null);
  const [stripeReady,setStripeReady]=useState(false);
  const [isRepeatClient,setIsRepeatClient]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [bookingId,setBookingId]=useState(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);

  // Simple ref for the payment div — ID-based mount is more reliable than callback ref
  const paymentDivId = 'stripe-payment-element';

  useEffect(()=>{load();},[slug]);
  useEffect(()=>{if(date&&svc)loadSlots();},[date,svc]);

  // Mount Stripe Payment Element once we have a client_secret
  useEffect(()=>{
    const secret = depositClientSecret;
    if(!secret || secret==='__failed__') return;
    let pe = null;
    let mounted = true;

    const mount = async () => {
      // Wait for the div to be in the DOM
      let el = null;
      for(let i=0; i<20; i++){
        el = document.getElementById(paymentDivId);
        if(el) break;
        await new Promise(r=>setTimeout(r,100));
      }
      if(!el || !mounted) return;

      if(!window.Stripe){
        await new Promise(resolve=>{
          const s=document.createElement('script');
          s.src='https://js.stripe.com/v3/';
          s.onload=resolve;
          document.head.appendChild(s);
        });
      }
      if(!mounted) return;

      stripeRef.current = window.Stripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY,{
        stripeAccount: therapist.stripe_account_id,
      });
      elementsRef.current = stripeRef.current.elements({
        clientSecret: secret,
        appearance:{ theme:'stripe', variables:{ colorPrimary:'#2A5741', borderRadius:'8px' } }
      });
      pe = elementsRef.current.create('payment');
      // Only enable Pay button after Stripe signals the element is fully rendered
      pe.on('ready', () => { if(mounted) setStripeReady(true); });
      pe.mount(el);
    };

    mount();
    return ()=>{
      mounted=false;
      try{ if(pe) pe.destroy(); } catch(e){}
    };
  },[depositClientSecret]);

  async function handlePayment(){
    if(!stripeRef.current||!elementsRef.current) return;
    setPaymentProcessing(true);
    setPaymentError(null);
    const {error,paymentIntent} = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      redirect: 'if_required',
    });
    if(error){
      setPaymentError(error.message);
      setPaymentProcessing(false);
      return;
    }
    if(paymentIntent?.status==='succeeded'){
      await supabase.from('bookings').update({deposit_paid:true,status:'confirmed'}).eq('id',bookingId);
      setDepositPaid(true);
      setConfirmed(true);
    }
    setPaymentProcessing(false);
  }

  async function load() {
    const {data:t}=await supabase.from('therapists').select('*,deposit_enabled,deposit_percent').eq('custom_url',slug).single();
    if(!t){setNotFound(true);setLoading(false);return;}
    setTherapist(t);
    const [{data:s},{data:a}]=await Promise.all([
      supabase.from('services').select('*').eq('therapist_id',t.id).eq('active',true).order('price'),
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
    const booked=existing||[];
    setExistingBooked(booked);
    let raw=generateSlots(av.start_time.slice(0,5),av.end_time.slice(0,5),svc.duration,booked);
    // Filter out past slots if today
    const isToday=date===new Date().toISOString().split('T')[0];
    if(isToday){
      const nowMin=new Date().getHours()*60+new Date().getMinutes();
      raw=raw.filter(s=>s.minutes>nowMin+30); // need at least 30min notice
    }
    setSlots(scoreSlots(raw,booked,svc.duration));
    setLoadingSlots(false);
  }

  async function submit() {
    setSubmitting(true);
    const status = depositRequired && !depositPaid ? 'pending-deposit' : 'confirmed';
    const {data:newBooking, error}=await supabase.from('bookings').insert({
      therapist_id:therapist.id, service_id:svc.id,
      client_name:form.name.trim(), client_email:form.email.trim().toLowerCase(),
      client_phone:form.phone, booking_date:date,
      start_time:slot.start, end_time:slot.end,
      notes:form.notes, status,
      deposit_required: depositRequired,
      deposit_amount: depositRequired ? depositAmount : 0,
      deposit_paid: depositPaid,
    }).select().single();
    setSubmitting(false);
    if(error){alert('Something went wrong. Please try again.');return;}
    const bid = newBooking?.id||null;
    setBookingId(bid);

    if(depositRequired && !depositPaid) {
      // Therapist must have Stripe connected to collect deposits
      if(!therapist.stripe_account_id) {
        // No Stripe — confirm without deposit and note it
        await supabase.from('bookings').update({status:'confirmed'}).eq('id',bid);
        setConfirmed(true);
        return;
      }
      setDepositLoading(true);
      const res = await supabase.functions.invoke('create-deposit', {
        body: {
          therapist_id: therapist.id,
          booking_id: bid,
          amount_cents: depositAmount,
          client_email: form.email.trim().toLowerCase(),
          client_name: form.name.trim(),
          service_name: svc.name,
        }
      });
      setDepositLoading(false);
      if(res.data?.client_secret) {
        setDepositClientSecret(res.data.client_secret);
        return; // Payment screen renders — do not fall through
      }
      // Edge function returned an error — surface it, do not confirm
      const errMsg = res.data?.error || res.error?.message || 'Payment setup failed. Please try again.';
      setPaymentError(errMsg);
      // Revert booking to confirmed so therapist can still see it
      await supabase.from('bookings').update({status:'confirmed',deposit_required:false}).eq('id',bid);
      setDepositClientSecret('__failed__'); // triggers payment screen with error message
      return;
    }
    setConfirmed(true);
  }

  if(loading) return <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}><div style={{color:C.gray,fontSize:14}}>Loading...</div></div>;
  if(notFound) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:48,marginBottom:16}}>🌿</div><h2 style={{fontFamily:'Georgia,serif',color:C.dark,margin:'0 0 8px'}}>Page not found</h2><p style={{color:C.gray}}>This booking link doesn't exist.</p></div>
    </div>
  );

  // Confirmed screen - immediately shows intake link
  if(confirmed) return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'system-ui'}}>
      <div style={{background:C.white,borderRadius:24,padding:'40px 32px',maxWidth:440,width:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.1)'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'#DCFCE7',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:36}}>✅</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:C.dark,margin:'0 0 8px',textAlign:'center'}}>You're booked!</h2>
        <p style={{color:C.gray,fontSize:14,lineHeight:1.7,textAlign:'center',margin:'0 0 24px'}}>
          <strong>{svc.name}</strong> on <strong>{fmtShort(date)}</strong> at <strong>{slot.display}</strong> with {therapist.business_name||therapist.full_name}.
        </p>
        {/* Immediately prompt intake - same flow, no extra steps */}
        <div style={{background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)',border:'1.5px solid #86EFAC',borderRadius:14,padding:'20px 20px',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#2A5741',marginBottom:6}}>📋 One more thing - takes 60 seconds</div>
          <div style={{fontSize:13,color:'#374151',marginBottom:14,lineHeight:1.5}}>
            Fill your body map so {therapist.full_name?.split(' ')[0]||'your therapist'} knows exactly where to focus before you arrive.
          </div>
          <a href={`/${therapist.custom_url}?name=${encodeURIComponent(form.name)}&email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phone)}${bookingId?'&booking_id='+bookingId:''}`}
            style={{display:'block',background:C.forest,color:'#fff',borderRadius:10,padding:'13px 20px',fontSize:14,fontWeight:700,textDecoration:'none',textAlign:'center'}}>
            Fill My Intake Form →
          </a>
        </div>
        <p style={{fontSize:11,color:C.gray,textAlign:'center',margin:0}}>Confirmation sent to {form.email}</p>
      </div>
    </div>
  );

  const pct=step===1?16:step===2?40:step===3?64:step===4&&depositRequired?80:100;

  // Step labels
  const steps=[{n:1,l:'Service'},{n:2,l:'Date & Time'},{n:3,l:'Your Info'},{n:4,l:'Confirm'}];

  return (
    <div style={{minHeight:'100vh',background:C.beige,fontFamily:'system-ui,sans-serif'}}>
      {/* Header */}
      <div style={{background:C.white,borderBottom:`1px solid ${C.light}`,padding:'14px 20px',position:'sticky',top:0,zIndex:10}}>
        <div style={{maxWidth:560,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {therapist.photo_url
              ?<img src={therapist.photo_url} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              :<div style={{width:40,height:40,borderRadius:'50%',background:C.forest,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,flexShrink:0}}>{(therapist.full_name||'T')[0]}</div>
            }
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.dark,lineHeight:1.2}}>{therapist.business_name||therapist.full_name}</div>
              <div style={{fontSize:11,color:C.gray}}>Online booking · No account needed</div>
            </div>
          </div>
          {/* Step pills */}
          <div style={{display:'flex',gap:4}}>
            {steps.map(s=>(
              <div key={s.n} style={{width:8,height:8,borderRadius:'50%',background:s.n<=step?C.forest:C.light,transition:'background 0.3s'}}/>
            ))}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{maxWidth:560,margin:'10px auto 0',height:2,background:C.light,borderRadius:2}}>
          <div style={{height:2,background:C.forest,width:`${pct}%`,borderRadius:2,transition:'width 0.4s ease'}}/>
        </div>
      </div>

      <div style={{maxWidth:560,margin:'0 auto',padding:'24px 16px 100px'}}>

        {/* STEP 1 - Service selection */}
        {step===1&&(
          <div>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:C.dark,margin:'0 0 4px'}}>Book a session</h2>
            <p style={{fontSize:13,color:C.gray,margin:'0 0 20px'}}>Choose what you'd like - no account needed.</p>
            {services.length===0
              ?<div style={{background:C.white,borderRadius:14,padding:32,textAlign:'center',color:C.gray,fontSize:14}}>No services available yet. Check back soon.</div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {services.map(s=>(
                  <button key={s.id} onClick={()=>{setSvc(s);setStep(2);}}
                    style={{background:C.white,border:`2px solid ${C.light}`,borderRadius:16,padding:'18px 20px',textAlign:'left',cursor:'pointer',width:'100%',transition:'all 0.15s',outline:'none'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.forest;e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(42,87,65,0.12)';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.light;e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:16,fontWeight:700,color:C.dark,marginBottom:6}}>{s.name}</div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          <span style={{background:'#F0FDF4',color:'#16A34A',borderRadius:20,padding:'3px 10px',fontSize:12,fontWeight:600}}>⏱ {s.duration} min</span>
                          {s.description&&<span style={{fontSize:12,color:C.gray,padding:'3px 0'}}>{s.description}</span>}
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:22,fontWeight:700,color:C.forest}}>${s.price}</div>
                        <div style={{fontSize:11,color:C.gray}}>pay at session</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            }
          </div>
        )}

        {/* STEP 2 - Date + smart time slots */}
        {step===2&&(
          <div>
            <button onClick={()=>setStep(1)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:C.dark,margin:'0 0 4px'}}>Pick your time</h2>
            <p style={{fontSize:13,color:C.gray,margin:'0 0 20px'}}>{svc.name} · {svc.duration} min · ${svc.price}</p>

            <div style={{background:C.white,borderRadius:16,padding:20,marginBottom:14}}>
              <Cal availability={availability} selected={date} onSelect={setDate}/>
            </div>

            {date&&(
              <div style={{background:C.white,borderRadius:16,padding:20}}>
                <div style={{fontSize:12,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:16}}>{fmtDate(date)}</div>
                {loadingSlots
                  ?<div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:13}}>Finding best times for you...</div>
                  :slots.length===0
                    ?<div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:13}}>No availability on this day. Try another date.</div>
                    :<div>
                      {/* Show recommended slots first if any */}
                      {slots.some(s=>s.recommended)&&(
                        <div style={{marginBottom:12}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.amber,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8,display:'flex',alignItems:'center',gap:4}}>
                            ⚡ Works best
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                            {slots.filter(s=>s.recommended).slice(0,3).map(s=>(
                              <button key={s.start} onClick={()=>setSlot(s)}
                                style={{padding:'13px 8px',borderRadius:12,border:`2px solid ${slot?.start===s.start?C.forest:C.amber}`,
                                  background:slot?.start===s.start?C.forest:'#FFFBEB',
                                  color:slot?.start===s.start?C.white:'#92400E',
                                  fontSize:13,fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>
                                {s.display}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{fontSize:11,fontWeight:700,color:C.gray,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>All available times</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                        {slots.filter(s=>!s.recommended).map(s=>(
                          <button key={s.start} onClick={()=>setSlot(s)}
                            style={{padding:'12px 8px',borderRadius:10,border:`2px solid ${slot?.start===s.start?C.forest:C.light}`,
                              background:slot?.start===s.start?C.forest:C.white,
                              color:slot?.start===s.start?C.white:C.dark,
                              fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.15s'}}>
                            {s.display}
                          </button>
                        ))}
                      </div>
                    </div>
                }
              </div>
            )}
            {slot&&<button onClick={()=>setStep(3)} style={{width:'100%',background:C.forest,color:C.white,border:'none',borderRadius:14,padding:'15px',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:14,transition:'opacity 0.2s'}}>Continue →</button>}
          </div>
        )}

        {/* STEP 3 - Client details */}
        {step===3&&(
          <div>
            <button onClick={()=>setStep(2)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:C.dark,margin:'0 0 4px'}}>Your details</h2>
            <p style={{fontSize:13,color:C.gray,margin:'0 0 20px'}}>{fmtShort(date)} · {slot.display} · {svc.name}</p>
            <div style={{background:C.white,borderRadius:16,padding:22,display:'flex',flexDirection:'column',gap:14}}>
              {[
                {k:'name',l:'Full name',p:'Jane Smith',r:true,t:'text'},
                {k:'email',l:'Email address',p:'jane@example.com',r:true,t:'email'},
                {k:'phone',l:'Phone number',p:'(512) 555-1234',r:true,t:'tel'},
              ].map(({k,l,p,r,t})=>(
                <div key={k}>
                  <label style={{fontSize:12,fontWeight:700,color:C.gray,display:'block',marginBottom:6}}>
                    {l}{r&&<span style={{color:C.danger}}> *</span>}
                  </label>
                  <input type={t} value={form[k]} placeholder={p} autoComplete={k==='name'?'name':k==='email'?'email':'tel'}
                    onChange={e=>{
                      let val = e.target.value;
                      if(k==='phone'){
                        const d=val.replace(/\D/g,'').slice(0,10);
                        val=d.length<=3?d:d.length<=6?`(${d.slice(0,3)}) ${d.slice(3)}`:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
                      }
                      setForm(f=>({...f,[k]:val}));setErrors(er=>({...er,[k]:''}));
                    }}
                    style={{width:'100%',padding:'13px 14px',border:`1.5px solid ${errors[k]?C.danger:C.light}`,borderRadius:10,fontSize:15,boxSizing:'border-box',outline:'none',fontFamily:'system-ui'}}/>
                  {errors[k]&&<div style={{fontSize:11,color:C.danger,marginTop:4}}>{errors[k]}</div>}
                </div>
              ))}
            </div>
            <button onClick={async ()=>{
              const errs={};
              if(!form.name.trim()) errs.name='Required';
              if(!form.email.trim()||!/\S+@\S+\.\S+/.test(form.email)) errs.email='Valid email required';
              if(!form.phone.trim()) errs.phone='Required';
              if(Object.keys(errs).length){setErrors(errs);return;}
              // Check if repeat client
              const { data: prior } = await supabase.from('bookings')
                .select('id').eq('therapist_id',therapist.id)
                .eq('client_email',form.email.trim().toLowerCase())
                .neq('status','cancelled').limit(1);
              const isRepeat = prior && prior.length > 0;
              setIsRepeatClient(isRepeat);
              // Check if deposit required
              const needsDeposit = therapist.deposit_enabled && !isRepeat;
              setDepositRequired(needsDeposit);
              if(needsDeposit) {
                const depositAmt = Math.round((svc.price * (therapist.deposit_percent||20) / 100) * 100);
                setDepositAmount(depositAmt);
              }
              setStep(4);
            }} style={{width:'100%',background:C.forest,color:C.white,border:'none',borderRadius:14,padding:'15px',fontSize:15,fontWeight:700,cursor:'pointer',marginTop:14}}>
              {depositRequired ? 'Continue to Deposit →' : 'Review Booking →'}
            </button>
          </div>
        )}

        {/* STEP 4 - Confirm */}
        {step===4&&!depositClientSecret&&(
          <div>
            <button onClick={()=>setStep(3)} style={{background:'none',border:'none',color:C.gray,fontSize:13,cursor:'pointer',padding:'0 0 12px',display:'flex',alignItems:'center',gap:4}}>‹ Back</button>
            <h2 style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,color:C.dark,margin:'0 0 4px'}}>Confirm your booking</h2>
            <p style={{fontSize:13,color:C.gray,margin:'0 0 20px'}}>Everything look right? Tap confirm to lock it in.</p>
            <div style={{background:C.white,borderRadius:16,padding:22,marginBottom:14}}>
              {[
                ['Service',svc.name],['Duration',`${svc.duration} min`],['Date',fmtDate(date)],
                ['Time',slot.display],['Therapist',therapist.business_name||therapist.full_name],
                ['Price',`$${svc.price} — pay at session`],['Name',form.name],['Email',form.email],
                ...(form.phone?[['Phone',form.phone]]:[]),
              ].map(([l,v],i,arr)=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,
                  padding:'10px 0',borderBottom:i<arr.length-1?`1px solid ${C.light}`:'none'}}>
                  <span style={{fontSize:13,color:C.gray,flexShrink:0,minWidth:70}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:600,color:C.dark,textAlign:'right'}}>{v}</span>
                </div>
              ))}
            </div>
            {/* DEPOSIT NOTICE — shown BEFORE confirm button so client sees it first */}
            {depositRequired && !depositPaid && (
              <div style={{marginBottom:14,background:'#FEF3C7',border:'1.5px solid #FCD34D',borderRadius:12,padding:'16px',display:'flex',gap:12,alignItems:'flex-start'}}>
                <span style={{fontSize:22,flexShrink:0}}>💳</span>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'#92400E',marginBottom:4}}>
                    Deposit required: ${(depositAmount/100).toFixed(0)}
                  </div>
                  <div style={{fontSize:12,color:'#92400E',lineHeight:1.5}}>
                    {(therapist.deposit_percent||20)}% of ${svc.price} is required to hold your spot as a first-time client. Repeat clients are never charged a deposit.
                  </div>
                </div>
              </div>
            )}
            {isRepeatClient && (
              <div style={{marginBottom:14,background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:12,padding:'12px 16px',display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontSize:16}}>✅</span>
                <span style={{fontSize:13,color:'#16A34A',fontWeight:600}}>Welcome back — no deposit needed for returning clients.</span>
              </div>
            )}
            <button onClick={submit} disabled={submitting}
              style={{width:'100%',background:submitting?C.sage:C.forest,color:C.white,border:'none',borderRadius:14,padding:'17px',fontSize:16,fontWeight:700,cursor:submitting?'wait':'pointer',transition:'background 0.2s',boxShadow:`0 4px 20px rgba(42,87,65,${submitting?0.1:0.3})`}}>
              {submitting?'Confirming…':depositRequired&&!depositPaid?`✓ Confirm & Pay $${(depositAmount/100).toFixed(0)} Deposit`:'✓ Confirm Booking'}
            </button>
            {!depositRequired && !isRepeatClient && (
              <p style={{fontSize:11,color:C.gray,textAlign:'center',marginTop:10,lineHeight:1.5}}>
                No payment now. You'll fill your intake form right after booking.
              </p>
            )}
          </div>
        )}

        {/* DEPOSIT PAYMENT SCREEN — shown after booking confirmed, before intake */}
        {depositClientSecret && !confirmed && (
          <div>
            <div style={{marginBottom:20,background:C.white,borderRadius:16,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:'#FEF3C7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>💳</div>
                <div>
                  <div style={{fontSize:17,fontWeight:700,color:C.dark,fontFamily:'Georgia,serif'}}>Deposit Payment</div>
                  <div style={{fontSize:13,color:C.gray}}>${(depositAmount/100).toFixed(0)} · {svc?.name} with {therapist?.business_name||therapist?.full_name}</div>
                </div>
              </div>
              <div style={{background:'#F9FAFB',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:C.gray,lineHeight:1.5}}>
                This deposit holds your spot. The remaining balance is paid at your session.
              </div>
            </div>

            <div style={{background:C.white,borderRadius:16,padding:20,marginBottom:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
              {depositLoading ? (
                <div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:13}}>Setting up payment…</div>
              ) : depositClientSecret==='__failed__' ? (
                <div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:13}}>Your booking is confirmed. The deposit will be arranged directly with your therapist.</div>
              ) : (
                <>
                  <div id="stripe-payment-element" style={{minHeight:120}}/>
                  {!stripeReady && <div style={{textAlign:'center',padding:'20px 0',color:C.gray,fontSize:13}}>Loading payment form…</div>}
                </>
              )}
            </div>

            {paymentError && (
              <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:'12px 14px',marginBottom:14,fontSize:13,color:'#991B1B'}}>
                ⚠️ {paymentError}
              </div>
            )}

            <button onClick={depositClientSecret==='__failed__'?()=>setConfirmed(true):handlePayment}
              disabled={depositClientSecret!=='__failed__'&&(paymentProcessing||!stripeReady)}
              style={{width:'100%',background:paymentProcessing||(!stripeReady&&depositClientSecret!=='__failed__')?C.sage:C.forest,color:C.white,border:'none',borderRadius:14,padding:'17px',fontSize:16,fontWeight:700,cursor:'pointer',transition:'background 0.2s',boxShadow:`0 4px 20px rgba(42,87,65,0.25)`}}>
              {depositClientSecret==='__failed__'?'Continue to Intake Form →':paymentProcessing?'Processing payment…':`Pay $${(depositAmount/100).toFixed(0)} Deposit`}
            </button>
            <p style={{fontSize:11,color:C.gray,textAlign:'center',marginTop:10,lineHeight:1.5}}>
              🔒 Secured by Stripe. Your card details are never stored by us.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
