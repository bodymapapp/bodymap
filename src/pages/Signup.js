import BMLogo from '../components/BMLogo';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const C = { forest: '#2A5741', sage: '#6B9E80', beige: '#F5F0E8', lightGray: '#F3F4F6', darkGray: '#1A1A2E', gray: '#6B7280', red: '#DC2626' };

// Body Map SVG Mockup
function BodyMapMockup() {
  return (
    <svg viewBox="0 0 320 200" style={{ width: '100%', maxWidth: '300px' }}>
      {/* Labels */}
      <text x="72" y="12" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="system-ui">FRONT</text>
      <text x="232" y="12" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="system-ui">BACK</text>

      {/* FRONT - Head */}
      <ellipse cx="72" cy="30" rx="12" ry="14" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Neck */}
      <rect x="68" y="43" width="8" height="8" rx="2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Torso */}
      <rect x="52" y="50" width="40" height="50" rx="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Left arm */}
      <rect x="34" y="52" width="16" height="42" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Right arm */}
      <rect x="94" y="52" width="16" height="42" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Left leg */}
      <rect x="52" y="100" width="16" height="56" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Right leg */}
      <rect x="76" y="100" width="16" height="56" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>

      {/* BACK - Head */}
      <ellipse cx="232" cy="30" rx="12" ry="14" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Neck */}
      <rect x="228" y="43" width="8" height="8" rx="2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Torso */}
      <rect x="212" y="50" width="40" height="50" rx="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Left arm */}
      <rect x="194" y="52" width="16" height="42" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Right arm */}
      <rect x="254" y="52" width="16" height="42" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Left leg */}
      <rect x="212" y="100" width="16" height="56" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
      {/* Right leg */}
      <rect x="236" y="100" width="16" height="56" rx="7" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>

      {/* FRONT - heat zones */}
      {/* R shoulder - focus (green) */}
      <circle cx="97" cy="58" r="8" fill="rgba(107,207,107,0.7)"/>
      <text x="97" y="61" textAnchor="middle" fill="#fff" fontSize="7" fontFamily="system-ui" fontWeight="bold">F</text>
      {/* L shoulder - avoid (red) */}
      <circle cx="47" cy="58" r="8" fill="rgba(239,68,68,0.8)"/>
      <text x="47" y="61" textAnchor="middle" fill="#fff" fontSize="7" fontFamily="system-ui" fontWeight="bold">!</text>
      {/* Neck - focus */}
      <circle cx="72" cy="47" r="6" fill="rgba(107,207,107,0.6)"/>
      {/* R knee */}
      <circle cx="84" cy="138" r="6" fill="rgba(251,191,36,0.8)"/>

      {/* BACK - heat zones */}
      {/* Upper back - focus */}
      <circle cx="232" cy="62" r="9" fill="rgba(107,207,107,0.7)"/>
      <text x="232" y="65" textAnchor="middle" fill="#fff" fontSize="7" fontFamily="system-ui" fontWeight="bold">F</text>
      {/* Lower back - avoid (most intense) */}
      <circle cx="228" cy="88" r="9" fill="rgba(239,68,68,0.9)"/>
      <text x="228" y="91" textAnchor="middle" fill="#fff" fontSize="7" fontFamily="system-ui" fontWeight="bold">!</text>
      <circle cx="244" cy="88" r="7" fill="rgba(239,68,68,0.7)"/>
      {/* R glute */}
      <circle cx="254" cy="104" r="6" fill="rgba(251,191,36,0.7)"/>
      {/* L hamstring */}
      <circle cx="218" cy="122" r="5" fill="rgba(107,207,107,0.5)"/>

      {/* Legend */}
      <circle cx="60" cy="172" r="5" fill="rgba(107,207,107,0.8)"/>
      <text x="68" y="176" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="system-ui">Focus</text>
      <circle cx="108" cy="172" r="5" fill="rgba(239,68,68,0.8)"/>
      <text x="116" y="176" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="system-ui">Avoid</text>
      <circle cx="160" cy="172" r="5" fill="rgba(251,191,36,0.8)"/>
      <text x="168" y="176" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="system-ui">Caution</text>
    </svg>
  );
}

export default function Signup() {
  const justPaid = new URLSearchParams(window.location.search).get('paid') === 'true';
  if (justPaid) localStorage.setItem('justPaid', 'true');
  const nextPlan = new URLSearchParams(window.location.search).get('next');
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', fullName: '', businessName: '', customUrl: '', phone: '', countryCode: '+1' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Optional fields (business name, intake URL, phone) are collapsed by
  // default to reduce signup friction. Mobile especially benefits - the
  // 7-field form becomes a 4-field form until they explicitly expand.
  const [showOptional, setShowOptional] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 900);
  const { signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => { if (user && justPaid) navigate('/dashboard?upgraded=true'); }, [user, justPaid, navigate]);

  // Capture referral code from URL on mount (e.g. mybodymap.app/signup?ref=jamie-r)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      try { localStorage.setItem('bm_referrer', ref); } catch {}
    }
  }, []);

  // Format just the LOCAL portion of a phone number, never the country
  // code. The country code lives in its own state field (formData.countryCode)
  // and the input only collects the local digits. For +1 we format as
  // (xxx) xxx-xxxx; for everything else we leave the digits spaced
  // simply so we don't mangle international formats we don't know about.
  const formatPhone = (raw, countryCode = '+1') => {
    const d = String(raw || '').replace(/\D/g, '');
    if (countryCode === '+1') {
      const trimmed = d.substring(0, 10);
      if (trimmed.length <= 3) return trimmed;
      if (trimmed.length <= 6) return `(${trimmed.slice(0,3)}) ${trimmed.slice(3)}`;
      return `(${trimmed.slice(0,3)}) ${trimmed.slice(3,6)}-${trimmed.slice(6)}`;
    }
    // International: just collect raw digits with a single space every 3
    return d.substring(0, 15).replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') { setFormData(prev => ({ ...prev, phone: formatPhone(value, prev.countryCode) })); return; }
    if (name === 'countryCode') {
      // Re-format the existing phone in the new country code's style
      setFormData(prev => ({ ...prev, countryCode: value, phone: formatPhone(prev.phone, value) }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'businessName') {
      const url = value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '').substring(0, 30);
      setFormData(prev => ({ ...prev, [name]: value, customUrl: url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) { setError('Please enter your full name.'); return; }
    if (!formData.email.trim()) { setError('Please enter your email.'); return; }
    // Phone is required. We send a 6-digit SMS code right after signup
    // and the new therapist cannot reach the dashboard until they
    // confirm it. Business name and custom URL stay optional.
    const phoneDigits = (formData.phone || '').replace(/\D/g, '');
    if (phoneDigits.length === 0) { setError('Please enter your mobile phone number. We will text you a code to confirm it.'); return; }
    // +1 needs 10 digits (US/Canada). Other countries vary 7-12; 7 is the
    // most permissive floor that still catches obvious typos.
    const minLocalDigits = formData.countryCode === '+1' ? 10 : 7;
    if (phoneDigits.length < minLocalDigits) {
      setError(formData.countryCode === '+1'
        ? 'Phone number must be 10 digits.'
        : 'Phone number is too short, please double-check it.');
      return;
    }
    // Compose the E.164 phone we send to the backend. Edge function also
    // normalizes, but doing it client-side too keeps the therapist row
    // and the Twilio call in sync.
    const e164Phone = `${formData.countryCode}${phoneDigits}`;
    if (formData.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }
    const effectiveBusinessName = formData.businessName.trim() || formData.fullName.trim();
    // Auto-generate custom URL slug if user didn't provide one
    const effectiveCustomUrl = formData.customUrl.trim() ||
      formData.fullName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
    setLoading(true);

    // Security guard: rate limits, disposable email block, suspicious pattern detection.
    // Fail open, if the guard errors, we allow the signup (never block real users over a bug).
    let guardFlags = [];
    let guardScore = 0;
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const guardRes = await fetch(`${supabaseUrl}/functions/v1/signup-guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({
          email: formData.email,
          full_name: formData.fullName,
          business_name: effectiveBusinessName,
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

    const result = await signUp(formData.email, formData.password, { fullName: formData.fullName, businessName: effectiveBusinessName, customUrl: effectiveCustomUrl, phone: e164Phone });
    if (result.success) {
      // Mark signup risk on the therapist row so it surfaces in the daily digest and admin views
      if (guardFlags.length > 0 || guardScore > 0) {
        try {
          const { supabase } = await import('../lib/supabase');
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('therapists').update({
              signup_risk_score: guardScore,
              signup_flag_reasons: guardFlags,
            }).eq('id', user.id);
          }
          // Record referral if present
          try {
            const referrer = localStorage.getItem('bm_referrer');
            if (referrer && user) {
              const { data: refRow } = await supabase
                .from('therapists')
                .select('id')
                .eq('custom_url', referrer)
                .maybeSingle();
              await supabase.from('referrals').insert({
                referrer_custom_url: referrer,
                referrer_therapist_id: refRow?.id || null,
                referee_therapist_id: user.id,
                referee_email: formData.email,
              });
              localStorage.removeItem('bm_referrer');
            }
          } catch (e) { /* non-blocking */ }
        } catch(e) { /* non-blocking */ }
      }
      // Notify admin of new signup
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'MyBodyMap <notifications@mybodymap.app>',
            to: ['bodymap01@gmail.com'],
            subject: `New MyBodyMap Signup: ${formData.businessName || formData.fullName}`,
            html: `<div style="font-family:system-ui;max-width:480px;padding:24px">
              <h2 style="color:#2A5741">New therapist signed up!</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px 0;color:#6B7280;font-size:13px">Name</td><td style="padding:8px 0;font-weight:600">${formData.fullName}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7280;font-size:13px">Business</td><td style="padding:8px 0;font-weight:600">${formData.businessName || 'N/A'}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7280;font-size:13px">Email</td><td style="padding:8px 0;font-weight:600">${formData.email}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7280;font-size:13px">Phone</td><td style="padding:8px 0;font-weight:600">${e164Phone || 'N/A'}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7280;font-size:13px">URL</td><td style="padding:8px 0;font-weight:600">mybodymap.app/book/${formData.customUrl}</td></tr>
                <tr><td style="padding:8px 0;color:#6B7280;font-size:13px">Time</td><td style="padding:8px 0;font-weight:600">${new Date().toLocaleString()}</td></tr>
              </table>
            </div>`,
          }),
        });
      } catch(e) { /* non-blocking */ }

      // Welcome email via edge function (server-side, not blocked by CORS)
      try {
        const firstName = formData.fullName?.split(' ')[0] || 'there';
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        await fetch(`${supabaseUrl}/functions/v1/send-welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
          body: JSON.stringify({ email: formData.email, firstName, customUrl: formData.customUrl }),
        });
      } catch(e) { /* non-blocking */ }
      // Always route new signups through /verify-phone first. The
      // dashboard hard-gates them out anyway (Dashboard.js redirects to
      // /verify-phone when therapist.created_at >= PHONE_GATE_FROM AND
      // phone_verified_at is null), but going there directly skips the
      // intermediate dashboard flash. After successful verification,
      // VerifyPhone routes them to /dashboard (with the same query args
      // it would have received here).
      const postRedirect = localStorage.getItem('postSignupRedirect');
      if (justPaid) {
        try {
          const { supabase } = await import('../lib/supabase');
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('therapists').update({ plan: 'silver' }).eq('id', user.id);
          }
        } catch(e) { console.error('Plan upgrade error:', e); }
        navigate('/verify-phone');
      } else {
        // Stash the intended post-verify destination so VerifyPhone can
        // route the therapist there after they confirm the code.
        if (postRedirect) {
          localStorage.setItem('postVerifyPhoneRedirect', '/dashboard?activate=silver');
        }
        navigate('/verify-phone');
      }
    } else { setError(result.error); }
    setLoading(false);
  };

  const inputStyle = { width: '100%', padding: '9px 4px', border: 'none', borderBottom: '1.5px solid #D1D5DB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: 'transparent', color: C.darkGray };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  const features = [
    { icon: '📤', label: 'Send Intake' },
    { icon: '🗺️', label: 'Body Map' },
    { icon: '📋', label: 'Pre-Session Brief' },
    { icon: '🎯', label: 'Client Preferences' },
    { icon: '⚠️', label: 'Medical Flags' },
    { icon: '🔥', label: 'Pattern Heatmap' },
    { icon: '📝', label: 'Post-Session Brief' },
    { icon: '💬', label: 'Client Feedback' },
    { icon: '🔄', label: 'Repeat Customers' },
  ];

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── LEFT PANEL ── */}
      {isDesktop && (
        <div style={{ width: '420px', flexShrink: 0, background: 'linear-gradient(160deg, #1e3d2d 0%, #2A5741 60%, #1e3d2d 100%)', display: 'flex', flexDirection: 'column', padding: '28px 28px 24px', overflow: 'hidden' }}>

          {/* Logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', textDecoration: 'none' }}>
            <BMLogo size={36} variant="white" showWordmark={true} showTagline={true} />
          </a>

          {/* Headline */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.12)', borderRadius:20, padding:'4px 12px', marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#A8C5B5' }}>🌿 Free on Bronze · No credit card</span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', margin: '0 0 6px 0', lineHeight: 1.2, letterSpacing: '-0.3px' }}>Make it impossible for clients<br/>not to come back.</h2>
            <p style={{ fontSize: '12px', color: '#A8C5B5', margin: 0, lineHeight: 1.5 }}>The only tool built around what every other app ignores, helping every client feel like your #1.</p>
          </div>

          {/* Body Map SVG */}
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 auto', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: '0.08em' }}>Sample Client Intelligence</span>
              <span style={{ fontSize: '10px', color: '#6FCF97', fontWeight: '700' }}>✦ Platform-powered</span>
            </div>
            <BodyMapMockup />
          </div>

          {/* 6 Feature boxes - 2x3 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px', marginBottom: '16px' }}>
            {features.map(({ icon, label }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '16px', marginBottom: '3px' }}>{icon}</div>
                <div style={{ fontSize: '10px', color: '#D4E9DE', fontWeight: '600', lineHeight: 1.2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Therapist quote */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '14px' }}>
            <p style={{ fontSize: '12px', color: '#A8C5B5', fontStyle: 'italic', margin: '0 0 5px 0', lineHeight: 1.5 }}>"I used to ask the same questions every visit. MyBodyMap changed that - I walk in knowing exactly what Sarah needs before I touch her."</p>
            <p style={{ fontSize: '11px', color: '#6B9E80', margin: 0, fontWeight: '600' }}>- Jennifer K., LMT · Houston TX</p>
          </div>
        </div>
      )}

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, background: '#FAFAF8', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: isDesktop ? '32px 48px' : 'max(24px, env(safe-area-inset-top, 24px)) 20px max(24px, env(safe-area-inset-bottom, 24px))', overflowY: 'auto' }}>

        {/* Mobile logo. Smaller size, no tagline on this page
            since the context (signup) already implies who we are. */}
        {!isDesktop && (
          <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', textDecoration: 'none' }}>
            <BMLogo size={28} variant="dark" showWordmark={true} showTagline={false} />
          </Link>
        )}

        {/* Banners. Only shown for paid Silver conversion flows. */}
        {justPaid && (
          <div style={{ background: '#ECFDF5', border: '1.5px solid #6B9E80', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: C.forest, margin: '0 0 2px 0' }}>✅ Payment received!</p>
            <p style={{ fontSize: '12px', color: C.forest, margin: 0 }}>Create your account below to activate Silver.</p>
          </div>
        )}
        {nextPlan === 'silver' && !justPaid && (
          <div style={{ background: '#EEF2FF', border: '1.5px solid #6366F1', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 2px 0' }}>🚀 Almost there!</p>
            <p style={{ fontSize: '12px', color: '#3730a3', margin: 0 }}>Create your free account, you'll go straight to Silver payment after.</p>
          </div>
        )}

        {/* Heading: stripped. No badge pill, no subtitle (moved to footer text under the submit button). */}
        <div style={{ marginBottom: '18px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: C.darkGray, margin: '0', letterSpacing: '-0.5px' }}>Create your account</h1>
        </div>

        {/* Google button */}
        <button onClick={signInWithGoogle} style={{ width: '100%', padding: '13px', background: '#fff', border: '2px solid #E5E7EB', borderRadius: '10px', fontSize: '15px', fontWeight: '700', color: C.darkGray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 0 1 4.5 7.5V5.43H1.83a8 8 0 0 0 0 7.12l2.67-2.07z"/><path fill="#EA4335" d="M8.98 3.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.43L4.5 7.5a4.77 4.77 0 0 1 4.48-4.32z"/></svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
          <span style={{ fontSize: '11px', color: '#9CA3AF', letterSpacing: '0.05em' }}>OR USE EMAIL</span>
          <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
        </div>

        {/* Full Name (full width, required) */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Full Name</label>
          <input name="fullName" type="text" placeholder="Jane Smith" value={formData.fullName} onChange={handleChange} style={inputStyle} />
        </div>

        {/* Email (full width, required) */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Email</label>
          <input name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} style={inputStyle} />
        </div>

        {/* Password + Confirm (side-by-side on desktop, stacks on mobile via flex-wrap) */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Create a password" value={formData.password} onChange={handleChange}
                style={{ ...inputStyle, paddingRight: '36px' }} />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '6px', color: C.gray, lineHeight: 1 }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {formData.password && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[
                  { label: 'At least 8 characters', ok: formData.password.length >= 8 },
                  { label: 'One uppercase letter', ok: /[A-Z]/.test(formData.password) },
                  { label: 'One number', ok: /[0-9]/.test(formData.password) },
                  { label: 'One special character (!@#$...)', ok: /[^A-Za-z0-9]/.test(formData.password) },
                ].map(({ label, ok }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: ok ? '#16A34A' : '#9CA3AF', fontWeight: 700 }}>{ok ? '✓' : '○'}</span>
                    <span style={{ fontSize: 11, color: ok ? '#16A34A' : '#9CA3AF' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <label style={labelStyle}>Confirm Password</label>
            <input name="confirmPassword" type="password" placeholder="Re-enter password" value={formData.confirmPassword} onChange={handleChange}
              style={{ ...inputStyle, borderBottomColor: formData.confirmPassword && formData.confirmPassword !== formData.password ? '#EF4444' : '#D1D5DB' }} />
            {formData.confirmPassword && formData.confirmPassword !== formData.password && (
              <p style={{ fontSize: '10px', color: '#EF4444', margin: '2px 0 0 0' }}>Passwords don't match</p>
            )}
            {formData.confirmPassword && formData.confirmPassword === formData.password && (
              <p style={{ fontSize: '10px', color: '#16A34A', margin: '2px 0 0 0' }}>✓ Passwords match</p>
            )}
          </div>
        </div>

        {/* Phone is required, visible by default. We send a 6-digit
            SMS code right after signup; therapists who do not verify
            cannot reach the dashboard. Moved out of the optional fold
            on 2026-05-12 per HK direction. Country code is a separate
            selector to avoid the bug where typing '+1 555 ...' caused
            the leading '1' to be eaten and shoved into the area code. */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>Mobile Phone</label>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <select
              name="countryCode"
              value={formData.countryCode}
              onChange={handleChange}
              style={{
                ...inputStyle,
                width: 'auto',
                flexShrink: 0,
                padding: '9px 6px',
                cursor: 'pointer',
                fontWeight: 600,
                color: C.darkGray,
              }}>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+61">🇦🇺 +61</option>
              <option value="+64">🇳🇿 +64</option>
              <option value="+353">🇮🇪 +353</option>
              <option value="+33">🇫🇷 +33</option>
              <option value="+49">🇩🇪 +49</option>
              <option value="+34">🇪🇸 +34</option>
              <option value="+39">🇮🇹 +39</option>
              <option value="+91">🇮🇳 +91</option>
              <option value="+52">🇲🇽 +52</option>
            </select>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={formData.countryCode === '+1' ? '(555) 123-4567' : '555 123 4567'}
              value={formData.phone}
              onChange={handleChange}
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              required
            />
          </div>
          <p style={{ fontSize: '11px', color: C.sage, margin: '4px 0 0 0', lineHeight: 1.4 }}>
            We will text you a 6-digit code right after signup. We only use
            this number to verify you and to contact you about your practice.
          </p>
        </div>

        {/* Optional fields - collapsed by default. Keeps signup to 4 visible
            fields (name, email, password, confirm) unless user expands. */}
        <div style={{ marginBottom: '18px' }}>
          <button
            type="button"
            onClick={() => setShowOptional(v => !v)}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              fontSize: '12px', color: C.sage, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit', fontWeight: 600,
            }}>
            <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: showOptional ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
            {showOptional ? 'Hide' : 'Add'} business name and custom URL (optional)
          </button>

          {showOptional && (
            <div style={{ marginTop: 12, paddingLeft: 4, borderLeft: `2px solid ${C.sage}40`, paddingTop: 4 }}>
              <div style={{ marginBottom: '14px', marginLeft: 10 }}>
                <label style={labelStyle}>Business Name</label>
                <input name="businessName" type="text" placeholder="Healing Hands (we will use your name if blank)" value={formData.businessName} onChange={handleChange} style={inputStyle} />
              </div>

              <div style={{ marginBottom: '4px', marginLeft: 10 }}>
                <label style={labelStyle}>Custom Intake URL</label>
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1.5px solid #6B9E80' }}>
                  <span style={{ fontSize: '13px', color: C.sage, fontWeight: '600', whiteSpace: 'nowrap', paddingBottom: '9px' }}>mybodymap.app/</span>
                  <input name="customUrl" type="text" placeholder="janesmassage" value={formData.customUrl} onChange={handleChange}
                    style={{ ...inputStyle, borderBottom: 'none', flex: 1, minWidth: 0 }} />
                </div>
                <p style={{ fontSize: '10px', color: C.sage, margin: '3px 0 0 0' }}>Clients use this link to fill their body map. We auto-generate one if you skip this.</p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', color: C.red, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: '14px', background: loading ? '#9CA3AF' : C.forest, color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '-0.2px' }}>
          {loading ? 'Creating account...' : 'Create Account →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '11px', color: C.gray, margin: '8px 0 0 0' }}>
          Free during beta · No credit card · Up and running in 30 seconds
        </p>

        <p style={{ textAlign: 'center', fontSize: '12px', color: C.gray, margin: '14px 0 0 0' }}>
          Already have an account? <Link to="/login" style={{ color: C.forest, fontWeight: '700', textDecoration: 'none' }}>Sign in</Link>
        </p>

        {/* Founding therapist promo entry. Therapists who received
            the BETAONE code via Instagram or Facebook DM were landing
            here looking for a code field. They needed somewhere to
            actually enter it.
            BETAONE is a Stripe coupon, applied at checkout, not at
            signup. So this link sends them straight to the Silver
            checkout with the promo prefilled. They sign up for free,
            then on the next page Stripe shows the discount applied
            ($0 for the trial period). After payment confirms, the
            justPaid flow in AuthContext upgrades them to Silver. */}
        <p style={{ textAlign: 'center', fontSize: '12px', color: C.gray, margin: '6px 0 0 0' }}>
          Got a founding therapist code? <a
            href={`https://buy.stripe.com/5kQbJ23kC0eAfVe9vGeQM03?prefilled_promo_code=BETAONE`}
            style={{ color: C.forest, fontWeight: '700', textDecoration: 'none' }}
          >Apply it here</a>
        </p>
      </div>
    </div>
  );
}
