import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Nav from '../components/Nav';

const C = {
  forest: '#2A5741', sage: '#6B9E80', beige: '#F5F0E8',
  lightGray: '#F3F4F6', darkGray: '#1A1A2E', gray: '#6B7280',
  red: '#DC2626', green: '#059669'
};

export default function Signup() {
  const paidPlan = new URLSearchParams(window.location.search).get('plan');
  const justPaid = new URLSearchParams(window.location.search).get('paid') === 'true';
  const nextPlan = new URLSearchParams(window.location.search).get('next');

  const [formData, setFormData] = useState({
    email: '', password: '', fullName: '', businessName: '', customUrl: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'businessName') {
      const url = value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '').substring(0, 30);
      setFormData(prev => ({ ...prev, customUrl: url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) { setError('Please enter your full name.'); return; }
    if (!formData.businessName.trim()) { setError('Please enter your business name.'); return; }
    if (!formData.customUrl.trim()) { setError('Please enter a custom URL.'); return; }
    if (!formData.email.trim()) { setError('Please enter your email.'); return; }
    if (formData.password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    const result = await signUp(formData.email, formData.password, {
      fullName: formData.fullName,
      businessName: formData.businessName,
      customUrl: formData.customUrl
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

  const handleGoogle = async () => {
    await signInWithGoogle();
  };

  return (
    <div style={{ minHeight: '100vh', background: C.lightGray, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '32px', textDecoration: 'none' }}>
          <span style={{ fontSize: '36px' }}>🌿</span>
          <span style={{ fontSize: '28px', fontWeight: '700', color: C.forest }}>BodyMap</span>
        </Link>

        {/* Banners */}
        {justPaid && (
          <div style={{ background: '#ECFDF5', border: '1.5px solid #6B9E80', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: '700', color: C.forest, margin: '0 0 4px 0' }}>✅ Payment received!</p>
            <p style={{ fontSize: '14px', color: C.forest, margin: 0 }}>Create your account below to activate your Silver plan.</p>
          </div>
        )}
        {nextPlan === 'silver' && !justPaid && (
          <div style={{ background: '#EEF2FF', border: '1.5px solid #6366F1', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 4px 0' }}>🚀 Almost there!</p>
            <p style={{ fontSize: '14px', color: '#3730a3', margin: 0 }}>Create your free account first — you'll go straight to Silver payment after.</p>
          </div>
        )}

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, margin: '0 0 6px 0', textAlign: 'center' }}>Create Your Account</h1>
          <p style={{ fontSize: '14px', color: C.gray, textAlign: 'center', margin: '0 0 24px 0' }}>Start your 14-day free trial</p>

          {/* Google */}
          <button onClick={handleGoogle} style={{ width: '100%', padding: '13px', background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '15px', fontWeight: '600', color: C.darkGray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 0 1 4.5 7.5V5.43H1.83a8 8 0 0 0 0 7.12l2.67-2.07z"/><path fill="#EA4335" d="M8.98 3.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.43L4.5 7.5a4.77 4.77 0 0 1 4.48-4.32z"/></svg>
            Sign Up with Google — Live in 10 Seconds
          </button>
          <p style={{ fontSize: '12px', color: C.gray, textAlign: 'center', margin: '0 0 20px 0' }}>Fastest way to start. Your intake link is ready instantly.</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
            <span style={{ fontSize: '13px', color: C.gray }}>or create account with email</span>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
          </div>

          {/* Full Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Your Full Name</label>
            <input name="fullName" type="text" placeholder="Jane Smith" value={formData.fullName} onChange={handleChange}
              style={{ width: '100%', padding: '11px 14px', borderRadius: '9px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Business Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Business Name</label>
            <input name="businessName" type="text" placeholder="Healing Hands Massage" value={formData.businessName} onChange={handleChange}
              style={{ width: '100%', padding: '11px 14px', borderRadius: '9px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Custom URL */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Your Intake Link</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E5E7EB', borderRadius: '9px', overflow: 'hidden' }}>
              <span style={{ padding: '11px 10px 11px 14px', background: '#F9FAFB', color: '#6B7280', fontSize: '13px', whiteSpace: 'nowrap', borderRight: '1.5px solid #E5E7EB' }}>mybodymap.app/</span>
              <input name="customUrl" type="text" placeholder="janesmassage" value={formData.customUrl} onChange={handleChange}
                style={{ flex: 1, padding: '11px 14px', border: 'none', fontSize: '14px', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
            </div>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '3px 0 0 2px' }}>Clients tap this link to fill their body map</p>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Email</label>
            <input name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange}
              style={{ width: '100%', padding: '11px 14px', borderRadius: '9px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" value={formData.password} onChange={handleChange}
                style={{ width: '100%', padding: '11px 44px 11px 14px', borderRadius: '9px', border: '1.5px solid #E5E7EB', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '4px' }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', color: C.red, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', padding: '13px', background: loading ? '#9CA3AF' : C.forest, color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '13px', color: C.gray, margin: '16px 0 0 0' }}>
            Already have an account? <Link to="/login" style={{ color: C.forest, fontWeight: '600', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
