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

      {/* FRONT — Head */}
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

      {/* BACK — Head */}
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

      {/* FRONT — heat zones */}
      {/* R shoulder — focus (green) */}
      <circle cx="97" cy="58" r="8" fill="rgba(107,207,107,0.7)"/>
      <text x="97" y="61" textAnchor="middle" fill="#fff" fontSize="7" fontFamily="system-ui" fontWeight="bold">F</text>
      {/* L shoulder — avoid (red) */}
      <circle cx="47" cy="58" r="8" fill="rgba(239,68,68,0.8)"/>
      <text x="47" y="61" textAnchor="middle" fill="#fff" fontSize="7" fontFamily="system-ui" fontWeight="bold">!</text>
      {/* Neck — focus */}
      <circle cx="72" cy="47" r="6" fill="rgba(107,207,107,0.6)"/>
      {/* R knee */}
      <circle cx="84" cy="138" r="6" fill="rgba(251,191,36,0.8)"/>

      {/* BACK — heat zones */}
      {/* Upper back — focus */}
      <circle cx="232" cy="62" r="9" fill="rgba(107,207,107,0.7)"/>
      <text x="232" y="65" textAnchor="middle" fill="#fff" fontSize="7" fontFamily="system-ui" fontWeight="bold">F</text>
      {/* Lower back — avoid (most intense) */}
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
  const nextPlan = new URLSearchParams(window.location.search).get('next');
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', fullName: '', businessName: '', customUrl: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 900);
  const { signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => { if (user && justPaid) navigate('/dashboard?upgraded=true'); }, [user, justPaid, navigate]);

  const formatPhone = (d) => {
    d = d.replace(/\D/g, '').substring(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') { setFormData(prev => ({ ...prev, phone: formatPhone(value) })); return; }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'businessName') {
      const url = value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '').substring(0, 30);
      setFormData(prev => ({ ...prev, [name]: value, customUrl: url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) { setError('Please enter your full name.'); return; }
    if (!formData.businessName.trim()) { setError('Please enter your business name.'); return; }
    if (!formData.email.trim()) { setError('Please enter your email.'); return; }
    if (formData.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const result = await signUp(formData.email, formData.password, { fullName: formData.fullName, businessName: formData.businessName, customUrl: formData.customUrl, phone: formData.phone });
    if (result.success) {
      const postRedirect = localStorage.getItem('postSignupRedirect');
      navigate(postRedirect ? '/dashboard?activate=silver' : '/dashboard');
    } else { setError(result.error); }
    setLoading(false);
  };

  const inputStyle = { width: '100%', padding: '9px 4px', border: 'none', borderBottom: '1.5px solid #D1D5DB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: 'transparent', color: C.darkGray };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  const features = [
    { icon: '🗺️', label: 'Visual Body Maps' },
    { icon: '🧠', label: 'AI Pattern Intel' },
    { icon: '⚠️', label: 'Medical Flags' },
    { icon: '📋', label: 'Pre-Session Briefs' },
    { icon: '📱', label: 'QR Intake Link' },
    { icon: '💬', label: 'Client Feedback' },
  ];

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── LEFT PANEL ── */}
      {isDesktop && (
        <div style={{ width: '420px', flexShrink: 0, background: 'linear-gradient(160deg, #1e3d2d 0%, #2A5741 60%, #1e3d2d 100%)', display: 'flex', flexDirection: 'column', padding: '28px 28px 24px', overflow: 'hidden' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '24px' }}>🌿</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px' }}>BodyMap</span>
          </div>

          {/* Headline */}
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', margin: '0 0 6px 0', lineHeight: 1.2, letterSpacing: '-0.3px' }}>Walk in knowing.<br/>Every single session.</h2>
            <p style={{ fontSize: '12px', color: '#A8C5B5', margin: 0, lineHeight: 1.5 }}>The only tool that answers what every other app misses: <em style={{ color: '#D4E9DE' }}>"What does this client need today?"</em></p>
          </div>

          {/* Body Map SVG */}
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 auto', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: '0.08em' }}>Sample session data</span>
              <span style={{ fontSize: '10px', color: '#6FCF97', fontWeight: '700' }}>● Live data</span>
            </div>
            <BodyMapMockup />
          </div>

          {/* 6 Feature boxes — 2x3 grid */}
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
            <p style={{ fontSize: '12px', color: '#A8C5B5', fontStyle: 'italic', margin: '0 0 5px 0', lineHeight: 1.5 }}>"I used to ask the same questions every visit. BodyMap changed that — I walk in knowing exactly what Sarah needs before I touch her."</p>
            <p style={{ fontSize: '11px', color: '#6B9E80', margin: 0, fontWeight: '600' }}>— Jennifer K., LMT · Houston TX</p>
          </div>
        </div>
      )}

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, background: '#FAFAF8', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: isDesktop ? '32px 48px' : '24px 20px', overflowY: 'auto' }}>

        {/* Mobile logo */}
        {!isDesktop && (
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '20px', textDecoration: 'none' }}>
            <span style={{ fontSize: '28px' }}>🌿</span>
            <span style={{ fontSize: '22px', fontWeight: '800', color: C.forest }}>BodyMap</span>
          </Link>
        )}

        {/* Banners */}
        {justPaid && (
          <div style={{ background: '#ECFDF5', border: '1.5px solid #6B9E80', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: C.forest, margin: '0 0 2px 0' }}>✅ Payment received!</p>
            <p style={{ fontSize: '12px', color: C.forest, margin: 0 }}>Create your account below to activate Silver.</p>
          </div>
        )}
        {nextPlan === 'silver' && !justPaid && (
          <div style={{ background: '#EEF2FF', border: '1.5px solid #6366F1', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 2px 0' }}>🚀 Almost there!</p>
            <p style={{ fontSize: '12px', color: '#3730a3', margin: 0 }}>Create your free account — you'll go straight to Silver payment after.</p>
          </div>
        )}

        {/* Heading */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: C.darkGray, margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>Create your account</h1>
          <p style={{ fontSize: '13px', color: C.gray, margin: 0 }}>Free forever · No credit card required · Up and running in 30 seconds</p>
        </div>

        {/* Google button */}
        <button onClick={signInWithGoogle} style={{ width: '100%', padding: '13px', background: '#fff', border: '2px solid #E5E7EB', borderRadius: '10px', fontSize: '15px', fontWeight: '700', color: C.darkGray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 0 1 4.5 7.5V5.43H1.83a8 8 0 0 0 0 7.12l2.67-2.07z"/><path fill="#EA4335" d="M8.98 3.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.43L4.5 7.5a4.77 4.77 0 0 1 4.48-4.32z"/></svg>
          Continue with Google
        </button>
        <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'center', margin: '0 0 16px 0' }}>Fastest — your intake link is ready in 10 seconds</p>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
          <span style={{ fontSize: '11px', color: '#9CA3AF', letterSpacing: '0.05em' }}>OR SIGN UP WITH EMAIL</span>
          <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
        </div>

        {/* Row 1: Full Name + Business Name */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Full Name</label>
            <input name="fullName" type="text" placeholder="Jane Smith" value={formData.fullName} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Business Name</label>
            <input name="businessName" type="text" placeholder="Healing Hands" value={formData.businessName} onChange={handleChange} style={inputStyle} />
          </div>
        </div>

        {/* Intake Link */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Your Intake Link <span style={{ fontSize: '10px', color: C.sage, textTransform: 'none', letterSpacing: 0 }}>✨ auto-generated</span></label>
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1.5px solid #6B9E80' }}>
            <span style={{ fontSize: '13px', color: C.sage, fontWeight: '600', whiteSpace: 'nowrap', paddingBottom: '9px' }}>mybodymap.app/</span>
            <input name="customUrl" type="text" placeholder="janesmassage" value={formData.customUrl} onChange={handleChange}
              style={{ ...inputStyle, borderBottom: 'none', flex: 1, minWidth: 0 }} />
          </div>
          <p style={{ fontSize: '10px', color: C.sage, margin: '3px 0 0 0' }}>Clients tap this to fill their body map before each session</p>
        </div>

        {/* Row 2: Phone + Email */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Phone</label>
            <input name="phone" type="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Email</label>
            <input name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} style={inputStyle} />
          </div>
        </div>

        {/* Row 3: Password + Confirm */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={formData.password} onChange={handleChange}
                style={{ ...inputStyle, paddingRight: '28px' }} />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px', color: C.gray }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Confirm Password</label>
            <input name="confirmPassword" type="password" placeholder="Re-enter password" value={formData.confirmPassword} onChange={handleChange}
              style={{ ...inputStyle, borderBottomColor: formData.confirmPassword && formData.confirmPassword !== formData.password ? '#EF4444' : '#D1D5DB' }} />
            {formData.confirmPassword && formData.confirmPassword !== formData.password && (
              <p style={{ fontSize: '10px', color: '#EF4444', margin: '2px 0 0 0' }}>Passwords don't match</p>
            )}
          </div>
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

        <p style={{ textAlign: 'center', fontSize: '12px', color: C.gray, margin: '12px 0 0 0' }}>
          Already have an account? <Link to="/login" style={{ color: C.forest, fontWeight: '700', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
