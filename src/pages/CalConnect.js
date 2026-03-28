// src/pages/CalConnect.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';

export default function CalConnect() {
  const [status, setStatus] = useState('connecting');
  const { therapist } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) { setStatus('error'); return; }
    if (!code) { setStatus('error'); return; }

    exchangeCode(code);
  }, []);

  const exchangeCode = async (code) => {
    try {
      // Wait for therapist to load if not yet available
      const { data: { user } } = await supabase.auth.getUser();
      const therapistId = therapist?.id || user?.id;
      if (!therapistId) { setStatus('error'); return; }

      const { data, error } = await supabase.functions.invoke('cal-oauth', {
        body: { action: 'exchange_code', code, therapist_id: therapistId },
      });

      if (data?.success) {
        setStatus('success');
        setTimeout(() => navigate('/dashboard/settings'), 2000);
      } else {
        console.error('Cal exchange error:', error, data);
        setStatus('error');
      }
    } catch(e) {
      console.error('Cal connect exception:', e);
      setStatus('error');
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F5F0E8', fontFamily:'system-ui' }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'48px 40px', textAlign:'center', maxWidth:400, boxShadow:'0 8px 40px rgba(0,0,0,0.1)' }}>
        {status === 'connecting' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>🔗</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#1F2937', marginBottom:8, fontFamily:'Georgia, serif' }}>Connecting Cal.com...</div>
            <div style={{ fontSize:14, color:'#6B7280' }}>Exchanging credentials, please wait.</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#2A5741', marginBottom:8, fontFamily:'Georgia, serif' }}>Calendar Connected!</div>
            <div style={{ fontSize:14, color:'#6B7280' }}>Your Cal.com appointments will now appear in your Schedule dashboard. Redirecting...</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#DC2626', marginBottom:8, fontFamily:'Georgia, serif' }}>Connection Failed</div>
            <div style={{ fontSize:14, color:'#6B7280', marginBottom:24 }}>Something went wrong. Please try again.</div>
            <button onClick={() => navigate('/dashboard/settings')} style={{ background:'#2A5741', color:'#fff', border:'none', borderRadius:50, padding:'12px 28px', fontSize:14, fontWeight:600, cursor:'pointer' }}>Back to Settings</button>
          </>
        )}
      </div>
    </div>
  );
}
