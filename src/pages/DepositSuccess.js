import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const C = { forest:'#2A5741', sage:'#6B9E80', beige:'#F5F0E8', white:'#FFFFFF', dark:'#1A1A2E', gray:'#6B7280' };

export default function DepositSuccess() {
  const [params] = useSearchParams();
  const bookingId = params.get('booking_id');
  const slug = params.get('slug');
  const name = params.get('name');
  const email = params.get('email');
  const phone = params.get('phone');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Mark deposit as paid on the booking
    if (bookingId) {
      supabase.from('bookings')
        .update({ deposit_paid: true, status: 'confirmed' })
        .eq('id', bookingId)
        .then(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [bookingId]);

  const intakeUrl = slug
    ? `/${slug}?name=${encodeURIComponent(name||'')}&email=${encodeURIComponent(email||'')}&phone=${encodeURIComponent(phone||'')}${bookingId?'&booking_id='+bookingId:''}`
    : '/';

  return (
    <div style={{minHeight:'100vh',background:C.beige,display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:C.white,borderRadius:24,padding:'40px 32px',maxWidth:440,width:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.1)',textAlign:'center'}}>
        <div style={{width:72,height:72,borderRadius:'50%',background:'#DCFCE7',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:36}}>✅</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,color:C.dark,margin:'0 0 8px'}}>Deposit paid!</h2>
        <p style={{color:C.gray,fontSize:14,lineHeight:1.7,margin:'0 0 28px'}}>
          Your spot is confirmed. One last thing — fill your body map so your therapist knows exactly where to focus.
        </p>
        {ready ? (
          <a href={intakeUrl}
            style={{display:'block',background:C.forest,color:'#fff',borderRadius:12,padding:'15px 20px',fontSize:15,fontWeight:700,textDecoration:'none',marginBottom:12}}>
            Fill My Intake Form →
          </a>
        ) : (
          <div style={{color:C.gray,fontSize:13}}>Confirming your booking…</div>
        )}
        <p style={{fontSize:11,color:C.gray,margin:0}}>A receipt was sent to {email||'your email'}.</p>
      </div>
    </div>
  );
}
