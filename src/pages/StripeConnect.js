import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';

export default function StripeConnect() {
  const [status, setStatus] = useState('connecting');
  const { therapist } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const refresh = params.get('refresh');
    const accountId = params.get('account_id');
    const therapistId = params.get('therapist_id');

    if (refresh) { setStatus('refresh'); return; }
    if (success && accountId) {
      confirmConnection(therapistId || therapist?.id);
    } else {
      setStatus('error');
    }
  }, [therapist]);

  const confirmConnection = async (tid) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'confirm_connected', therapist_id: tid }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        setTimeout(() => navigate('/dashboard/billing'), 2500);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const styles = {
    wrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F5F0E8', fontFamily:'system-ui' },
    card: { background:'#fff', borderRadius:20, padding:'48px 40px', textAlign:'center', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,0.1)' },
    icon: { fontSize:52, marginBottom:16 },
    title: { fontSize:22, fontWeight:700, marginBottom:8, fontFamily:'Georgia, serif' },
    desc: { fontSize:14, color:'#6B7280', marginBottom:24, lineHeight:1.6 },
    btn: { background:'#2A5741', color:'#fff', border:'none', borderRadius:50, padding:'12px 28px', fontSize:14, fontWeight:600, cursor:'pointer' },
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {status === 'connecting' && (<><div style={styles.icon}>⏳</div><div style={{...styles.title, color:'#1F2937'}}>Connecting Stripe...</div><div style={styles.desc}>Setting up your payment account.</div></>)}
        {status === 'success' && (<><div style={styles.icon}>✅</div><div style={{...styles.title, color:'#2A5741'}}>Stripe Connected!</div><div style={styles.desc}>Your payments are now tracked in your Billing dashboard. Redirecting...</div></>)}
        {status === 'refresh' && (<><div style={styles.icon}>🔄</div><div style={{...styles.title, color:'#1F2937'}}>Setup Incomplete</div><div style={styles.desc}>Your Stripe setup wasn't completed. Please try connecting again.</div><button style={styles.btn} onClick={() => navigate('/dashboard/settings')}>Back to Settings</button></>)}
        {status === 'error' && (<><div style={styles.icon}>❌</div><div style={{...styles.title, color:'#DC2626'}}>Connection Failed</div><div style={styles.desc}>Something went wrong. Please try again.</div><button style={styles.btn} onClick={() => navigate('/dashboard/settings')}>Back to Settings</button></>)}
      </div>
    </div>
  );
}
