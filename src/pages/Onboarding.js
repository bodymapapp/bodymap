import BMLogo from '../components/BMLogo';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { seedNewTherapistDefaults } from '../lib/seedDefaults';

const C = { sage: '#6B9E80', forest: '#2A5741', gray: '#6B7280', darkGray: '#1F2937', lightGray: '#F9FAFB', red: '#DC2626' };

export default function Onboarding() {
  const { user, setTherapist } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (localStorage.getItem('justPaid') === 'true') {
      localStorage.removeItem('justPaid');
      navigate('/dashboard?upgraded=true');
      return;
    }
    // If the signed-in user already has a therapist row, they shouldn't be on this page.
    // Send them straight to the dashboard. This prevents the "duplicate key" error
    // on re-login for existing accounts (like the demo).
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data: existing } = await supabase
        .from('therapists')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && existing) {
        navigate('/dashboard');
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, user?.id]);
  const [businessName, setBusinessName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Live phone formatter — same as Signup.js. As the user types, this
  // strips non-digits and reformats to (xxx) xxx-xxxx. Critical for
  // iPhone users on type="tel" keyboards because that keypad has a
  // "+ * #" row instead of dashes; without this helper, users end up
  // with phone fields like "945+233+5453" and think the form is broken.
  const formatPhone = (d) => {
    d = d.replace(/\D/g, '').substring(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  };

  const handleBusinessChange = (v) => {
    setBusinessName(v);
    setCustomUrl(v.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30));
  };

  const handleSubmit = async () => {
    if (!businessName.trim()) { setError('Please enter your business name'); return; }
    if (!customUrl || customUrl.length < 3) { setError('Custom URL must be at least 3 characters'); return; }
    // Phone is optional at onboarding (matches Signup behavior). If they
    // typed something but it's incomplete, ask them to fix it or clear it.
    // Otherwise blank is fine — they can add it in Settings later.
    const phoneDigits = (phone || '').replace(/\D/g, '');
    if (phoneDigits.length > 0 && phoneDigits.length < 10) {
      setError('Phone number must be at least 10 digits, or leave it blank.');
      return;
    }
    setLoading(true);
    setError('');
    const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

    // Security guard: rate limits, disposable email block, pattern detection.
    // Fail open, guard errors never block legitimate users.
    let guardFlags = [];
    let guardScore = 0;
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const guardRes = await fetch(`${supabaseUrl}/functions/v1/signup-guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({
          email: user.email,
          full_name: fullName,
          business_name: businessName,
        }),
      });
      const guardData = await guardRes.json();
      if (guardData.outcome === 'blocked') {
        setError(guardData.message || 'We could not process this signup. Please check your details and try again.');
        setLoading(false);
        return;
      }
      guardFlags = guardData.flag_reasons || [];
      guardScore = guardData.risk_score || 0;
    } catch (e) { /* guard unreachable, proceed */ }
    // Use upsert so re-submitting (or a signed-in user who somehow reaches this page)
    // updates their existing row instead of throwing "duplicate key value violates
    // unique constraint therapists_pkey".
    const { data, error: dbError } = await supabase.from('therapists').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      business_name: businessName,
      phone: phone,
      custom_url: customUrl,
      password_hash: 'managed_by_supabase_auth',
      plan: 'silver',
      signup_risk_score: guardScore,
      signup_flag_reasons: guardFlags,
    }, { onConflict: 'id' }).select().single();
    if (dbError) { setError(dbError.message); setLoading(false); return; }
    if (data) {
      // Auto-seed catalog defaults so the dashboard isn't a blank canvas.
      // Backs the "Up and running in 2 minutes" marketing claim. Idempotent
      // (safe even if user re-onboards) and non-blocking.
      seedNewTherapistDefaults(user.id).catch(() => {});
      // Fire welcome email (server-side edge function handles BCC to bodymapdemo@gmail.com).
      // Non-blocking, don't make the dashboard redirect wait.
      try {
        const firstName = fullName?.split(' ')[0] || 'there';
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        fetch(`${supabaseUrl}/functions/v1/send-welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
          body: JSON.stringify({ email: user.email, firstName, customUrl }),
        }).catch(() => {});
      } catch (e) { /* non-blocking */ }
      // Update auth context
      const postRedirect = localStorage.getItem('postSignupRedirect');
      if (postRedirect) {
        window.location.href = '/dashboard?activate=silver';
      } else {
        window.location.href = '/dashboard';
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.lightGray, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '480px', width: '100%', background: 'white', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <BMLogo size={44} variant="dark" showWordmark={true} showTagline={true} />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, margin: '0 0 8px 0' }}>One last step</h1>
          <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>Set up your practice profile</p>
        </div>
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: C.red, fontSize: '14px' }}>{error}</div>}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: C.darkGray, display: 'block', marginBottom: '6px' }}>Business Name</label>
          <input value={businessName} onChange={e => handleBusinessChange(e.target.value)} placeholder="Healing Hands Massage"
            style={{ width: '100%', padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: C.darkGray, display: 'block', marginBottom: '6px' }}>Your Custom URL</label>
          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            <span style={{ padding: '12px', background: '#F9FAFB', color: C.gray, fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0 }}>mybodymap.app/</span>
            <input value={customUrl} onChange={e => setCustomUrl(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30))}
              placeholder="healinghands" style={{ flex: 1, padding: '12px', border: 'none', outline: 'none', fontSize: '14px', minWidth: 0 }} />
          </div>
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: C.darkGray, display: 'block', marginBottom: '6px' }}>Phone Number <span style={{ fontSize: '11px', color: C.gray, fontWeight: 500 }}>(optional)</span></label>
          <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="(512) 555-1234" type="tel"
            style={{ width: '100%', padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
          <p style={{ fontSize: '11px', color: C.sage, margin: '4px 0 0 0' }}>If you share it, we will only use it for account updates. You can always add this later in Settings.</p>
        </div>
        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: '14px', background: C.forest, color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
          {loading ? 'Setting up...' : 'Go to My Dashboard →'}
        </button>
      </div>
    </div>
  );
}
