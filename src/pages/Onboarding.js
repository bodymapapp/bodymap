import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const C = { sage: '#6B9E80', forest: '#2A5741', gray: '#6B7280', darkGray: '#1F2937', lightGray: '#F9FAFB', red: '#DC2626' };

export default function Onboarding() {
  const { user, setTherapist } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBusinessChange = (v) => {
    setBusinessName(v);
    setCustomUrl(v.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30));
  };

  const handleSubmit = async () => {
    if (!businessName.trim()) { setError('Please enter your business name'); return; }
    if (!customUrl || customUrl.length < 3) { setError('Custom URL must be at least 3 characters'); return; }
    setLoading(true);
    setError('');
    const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
    const { data, error: dbError } = await supabase.from('therapists').insert([{
      id: user.id,
      email: user.email,
      full_name: fullName,
      business_name: businessName,
      phone: phone,
      custom_url: customUrl,
      password_hash: 'managed_by_supabase_auth',
      plan: 'free'
    }]).select().single();
    if (dbError) { setError(dbError.message); setLoading(false); return; }
    if (data) {
      // Update auth context
      const postRedirect = localStorage.getItem('postSignupRedirect');
      if (postRedirect) {
        localStorage.removeItem('postSignupRedirect');
        window.open(postRedirect, '_blank');
      }
      window.location.href = '/dashboard';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.lightGray, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '480px', width: '100%', background: 'white', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🌿</div>
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
          <label style={{ fontSize: '13px', fontWeight: '600', color: C.darkGray, display: 'block', marginBottom: '6px' }}>Phone Number (optional)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(512) 555-1234" type="tel"
            style={{ width: '100%', padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
        </div>
        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: '14px', background: C.forest, color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
          {loading ? 'Setting up...' : 'Go to My Dashboard →'}
        </button>
      </div>
    </div>
  );
}
