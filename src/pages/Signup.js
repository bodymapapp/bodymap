import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const C = {
  forest: '#2A5741', sage: '#6B9E80', beige: '#F5F0E8',
  lightGray: '#F3F4F6', darkGray: '#1A1A2E', gray: '#6B7280',
  red: '#DC2626'
};

export default function Signup() {
  const justPaid = new URLSearchParams(window.location.search).get('paid') === 'true';
  const nextPlan = new URLSearchParams(window.location.search).get('next');

  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '', fullName: '',
    businessName: '', customUrl: '', phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && justPaid) navigate('/dashboard?upgraded=true');
  }, [user, justPaid, navigate]);

  const formatPhone = (d) => {
    d = d.replace(/\D/g, '').substring(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, phone: formatPhone(value) }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'businessName') {
      const url = value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '').substring(0, 30);
      setFormData(prev => ({ ...prev, [name]: value, customUrl: url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) { setError('Please enter your full name.'); return; }
    if (!formData.businessName.trim()) { setError('Please enter your business name.'); return; }
    if (!formData.email.trim()) { setError('Please enter your email.'); return; }
    if (formData.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const result = await signUp(formData.email, formData.password, {
      fullName: formData.fullName,
      businessName: formData.businessName,
      customUrl: formData.customUrl,
      phone: formData.phone
    });

    if (result.success) {
      const postRedirect = localStorage.getItem('postSignupRedirect');
      if (postRedirect) {
        navigate('/dashboard?activate=silver');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.lightGray, display: 'flex', fontFamily: 'system-ui, sans-serif' }}>

      {/* LEFT PANEL — desktop only */}
      <div style={{ display: 'none', flex: '0 0 420px', background: '#2A5741', padding: '48px 40px', flexDirection: 'column', justifyContent: 'center' }} className="signup-left-panel">
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <span style={{ fontSize: '32px' }}>🌿</span>
            <span style={{ fontSize: '24px', fontWeight: '700', color: '#fff' }}>BodyMap</span>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#fff', margin: '0 0 8px 0', lineHeight: 1.2 }}>Know every client.<br/>Every session.</h2>
          <p style={{ fontSize: '15px', color: '#A8C5B5', margin: '0 0 28px 0' }}>Set up in less than 30 seconds. Free forever for up to 5 clients.</p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            {[['⚡', '30 sec', 'to set up'], ['🎁', 'Free', 'forever plan'], ['📱', 'Works', 'on any device']].map(([icon, bold, sub]) => (
              <div key={bold} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{bold}</div>
                <div style={{ fontSize: '11px', color: '#A8C5B5' }}>{sub}</div>
              </div>
            ))}
          </div>

          {[
            '📋 Visual body maps — front & back',
            '🔔 Medical flag alerts',
            '💆 Client pressure & preference profiles',
            '📊 Session history & pattern tracking',
            '📱 QR code intake — works on any phone',
            '📝 Pre-session briefs — know before you touch',
            '💌 Post-session feedback collection',
            '🔗 Your own intake link: mybodymap.app/you',
            '🔒 HIPAA-friendly secure storage',
          ].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px' }}>{f.split(' ')[0]}</span>
              <span style={{ fontSize: '13px', color: '#D4E9DE' }}>{f.split(' ').slice(1).join(' ')}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '20px' }}>
          <p style={{ fontSize: '13px', color: '#A8C5B5', fontStyle: 'italic', margin: '0 0 6px 0' }}>"I used to forget pressure preferences all the time. BodyMap changed everything."</p>
          <p style={{ fontSize: '12px', color: '#6B9E80', margin: 0 }}>— Sarah M., Licensed Massage Therapist</p>
        </div>
      </div>

      {/* Inline style for left panel visibility */}
      <style>{`@media (min-width: 900px) { .signup-left-panel { display: flex !important; } }`}</style>

      {/* RIGHT PANEL — the form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '28px', textDecoration: 'none' }}>
          <span style={{ fontSize: '32px' }}>🌿</span>
          <span style={{ fontSize: '26px', fontWeight: '700', color: C.forest }}>BodyMap</span>
        </Link>

        {/* Banners */}
        {justPaid && (
          <div style={{ background: '#ECFDF5', border: '1.5px solid #6B9E80', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', color: C.forest, margin: '0 0 3px 0' }}>✅ Payment received!</p>
            <p style={{ fontSize: '13px', color: C.forest, margin: 0 }}>Create your account below to activate your Silver plan.</p>
          </div>
        )}
        {nextPlan === 'silver' && !justPaid && (
          <div style={{ background: '#EEF2FF', border: '1.5px solid #6366F1', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 3px 0' }}>🚀 Almost there!</p>
            <p style={{ fontSize: '13px', color: '#3730a3', margin: 0 }}>Create your free account first — you'll go straight to Silver payment after.</p>
          </div>
        )}

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: C.darkGray, margin: '0 0 4px 0', textAlign: 'center' }}>Create Your Account</h1>
          <p style={{ fontSize: '13px', color: C.gray, textAlign: 'center', margin: '0 0 20px 0' }}>Start your 14-day free trial</p>

          {/* Google */}
          <button onClick={signInWithGoogle} style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: C.darkGray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 0 1 4.5 7.5V5.43H1.83a8 8 0 0 0 0 7.12l2.67-2.07z"/><path fill="#EA4335" d="M8.98 3.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.43L4.5 7.5a4.77 4.77 0 0 1 4.48-4.32z"/></svg>
            Sign Up with Google — Live in 10 Seconds
          </button>
          <p style={{ fontSize: '11px', color: C.gray, textAlign: 'center', margin: '0 0 16px 0' }}>Fastest way to start. Your intake link is ready instantly.</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
            <span style={{ fontSize: '12px', color: C.gray }}>or sign up with email</span>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
          </div>

          {/* Full Name */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Your Full Name</label>
            <input name="fullName" type="text" placeholder="Jane Smith" value={formData.fullName} onChange={handleChange}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Business Name */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Business Name</label>
            <input name="businessName" type="text" placeholder="Healing Hands Massage" value={formData.businessName} onChange={handleChange}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Intake Link — styled as auto-generated */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
              Your Intake Link <span style={{ fontSize: '11px', fontWeight: '500', color: C.sage, background: '#F0F9F4', padding: '2px 7px', borderRadius: '20px', marginLeft: '6px' }}>✨ auto-generated</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #D1FAE5', borderRadius: '8px', overflow: 'hidden', background: '#F0F9F4' }}>
              <span style={{ padding: '10px 8px 10px 12px', color: C.sage, fontSize: '13px', whiteSpace: 'nowrap', fontWeight: '500' }}>mybodymap.app/</span>
              <input name="customUrl" type="text" placeholder="janesmassage" value={formData.customUrl} onChange={handleChange}
                style={{ flex: 1, padding: '10px 12px', border: 'none', fontSize: '14px', outline: 'none', fontFamily: 'inherit', background: 'transparent', color: C.forest, minWidth: 0 }} />
            </div>
            <p style={{ fontSize: '11px', color: C.sage, margin: '3px 0 0 2px' }}>Clients tap this to fill their body map before each session</p>
          </div>

          {/* Phone */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Phone Number</label>
            <input name="phone" type="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={handleChange}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Email</label>
            <input name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" value={formData.password} onChange={handleChange}
                style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Confirm Password</label>
            <input name="confirmPassword" type="password" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: formData.confirmPassword && formData.confirmPassword !== formData.password ? '1.5px solid #EF4444' : '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
            {formData.confirmPassword && formData.confirmPassword !== formData.password && (
              <p style={{ fontSize: '11px', color: '#EF4444', margin: '3px 0 0 2px' }}>Passwords don't match</p>
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
            style={{ width: '100%', padding: '12px', background: loading ? '#9CA3AF' : C.forest, color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '13px', color: C.gray, margin: '14px 0 0 0' }}>
            Already have an account? <Link to="/login" style={{ color: C.forest, fontWeight: '600', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
      </div>{/* end right panel */}
    </div>
  );
}
