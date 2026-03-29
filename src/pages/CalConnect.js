// src/pages/CalConnect.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';

export default function CalConnect() {
  const [status, setStatus] = useState('connecting');
  const [errorDetail, setErrorDetail] = useState('');
  const { therapist } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) { setStatus('error'); return; }
    if (!code) { setStatus('error'); return; }

    const state = params.get('state');
    exchangeCode(code, state);
  }, []);

  const exchangeCode = async (code, state) => {
    try {
      // Get therapist_id from state param (passed during OAuth initiation)
      // Fall back to auth session if available
      let therapistId = state ? decodeURIComponent(state) : null;
      if (!therapistId) {
        const { data: { user } } = await supabase.auth.getUser();
        therapistId = user?.id;
      }
      if (!therapistId) { setStatus('error'); setErrorDetail('No therapist ID found'); return; }

      const res = await fetch('https://rmnqfrljoknmellbnpiy.supabase.co/functions/v1/cal-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbnFmcmxqb2tubWVsbGJucGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDg4MDMsImV4cCI6MjA4NzMyNDgwM30.FiZzRBOtjbeGA6cWhj3YhTu87F0dImSsK8joMiWab9E',
        },
        body: JSON.stringify({ action: 'exchange_code', code, therapist_id: therapistId }),
      });
      const data = await res.json();

      if (data?.success) {
        setStatus('success');
        setTimeout(() => navigate('/dashboard/settings'), 2000);
      } else {
        console.error('Cal exchange error:', data);
        setStatus('error');
        setErrorDetail(JSON.stringify(data || 'unknown'));
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
            {errorDetail && <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:16, wordBreak:'break-all', textAlign:'left', background:'#F9FAFB', padding:8, borderRadius:8 }}>{errorDetail}</div>}
            <button onClick={() => navigate('/dashboard/settings')} style={{ background:'#2A5741', color:'#fff', border:'none', borderRadius:50, padding:'12px 28px', fontSize:14, fontWeight:600, cursor:'pointer' }}>Back to Settings</button>
          </>
        )}
      </div>
    </div>
  );
}
