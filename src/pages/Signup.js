// src/pages/Signup.js
// Therapist registration page

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const C = {
  sage: '#6B9E80',
  forest: '#2A5741',
  lavender: '#B4A7D6',
  gray: '#6B7280',
  darkGray: '#1F2937',
  lightGray: '#F9FAFB',
  red: '#DC2626',
  green: '#059669'
};

export default function Signup() {
  const paidPlan = new URLSearchParams(window.location.search).get('plan');
  const justPaid = new URLSearchParams(window.location.search).get('paid') === 'true';
  const nextPlan = new URLSearchParams(window.location.search).get('next');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    businessName: '',
    customUrl: ''
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();


    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-generate custom URL from business name
    if (name === 'businessName') {
      const url = value.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '')
        .substring(0, 30);
      setFormData(prev => ({ ...prev, customUrl: url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters)'); return;
    }
    if (!formData.businessName.trim() || formData.businessName.trim().length < 2) {
      setError('Please enter your business name (at least 2 characters)'); return;
    }
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address'); return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!formData.customUrl || formData.customUrl.length < 3) {
      setError('Custom URL must be at least 3 characters');
      return;
    }

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

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: C.lightGray,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        {/* Logo */}
        <Link to="/" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          justifyContent: 'center',
          marginBottom: '32px',
          textDecoration: 'none'
        }}>
          <span style={{ fontSize: '40px' }}>🌿</span>
          <span style={{ fontSize: '32px', fontWeight: '700', color: C.forest }}>BodyMap</span>
        </Link>

        {nextPlan === 'silver' && (
          <div style={{ background: '#EEF2FF', border: '1.5px solid #6366F1', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 4px 0' }}>🚀 Almost there!</p>
            <p style={{ fontSize: '14px', color: '#3730a3', margin: 0 }}>Create your free account first — you'll go straight to Silver payment after.</p>
          </div>
        )}
        {justPaid && (
          <div style={{ background: '#ECFDF5', border: '1.5px solid #6B9E80', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#2A5741', margin: '0 0 4px 0' }}>✅ Payment received!</p>
            <p style={{ fontSize: '14px', color: '#2A5741', margin: 0 }}>Create your account below to activate your Silver plan.</p>
          </div>
        )}

        {/* Signup Card */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '40px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: C.darkGray, 
            marginBottom: '8px',
            textAlign: 'center'
          }}>
            Create Your Account
          </h1>
          <p style={{ 
            fontSize: '14px', 
            color: C.gray, 
            marginBottom: '32px',
            textAlign: 'center'
          }}>
            Start your 14-day free trial
          </p>

          <button type="button" onClick={async () => { setLoading(true); await signInWithGoogle(); setLoading(false); }} disabled={loading} style={{ width: '100%', background: 'white', color: '#374151', padding: '14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
            Sign Up with Google — Live in 10 Seconds
          </button>
          <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginBottom: '20px' }}>Fastest way to start. Your intake link is ready instantly.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }}/><span style={{ fontSize: '13px', color: '#9CA3AF' }}>or create account with email</span><div style={{ flex: 1, height: '1px', background: '#E5E7EB' }}/>
          </div>
          {error && (
            <div style={{ 
              background: '#FEF2F2', 
              border: '1px solid #FCA5A5', 
              borderRadius: '8px', 
              padding: '12px',
              marginBottom: '24px',
              color: C.red,
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Full Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Your Full Name</label>
              <input name="fullName" type="text" placeholder="Jane Smith" value={formData.fullName} onChange={handleChange}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '15px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            {/* Business Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Business Name</label>
              <input name="businessName" type="text" placeholder="Healing Hands Massage" value={formData.businessName} onChange={handleChange}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '15px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            {/* Custom URL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Your Intake Link</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
                <span style={{ padding: '12px 10px 12px 14px', background: '#F9FAFB', color: '#6B7280', fontSize: '14px', whiteSpace: 'nowrap', borderRight: '1.5px solid #E5E7EB' }}>mybodymap.app/</span>
                <input name="customUrl" type="text" placeholder="janesmassage" value={formData.customUrl} onChange={handleChange}
                  style={{ flex: 1, padding: '12px 14px', border: 'none', fontSize: '15px', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
              </div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '4px 0 0 2px' }}>Clients tap this link to fill their body map</p>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Email</label>
              <input name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '15px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            {/* Password with show/hide */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" value={formData.password} onChange={handleChange}
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '15px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' }}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>


