// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, supabase } from '../lib/supabase';
import ClientList from '../components/ClientList';
import SessionList from '../components/SessionList';
import SessionDetail from '../components/SessionDetail';
import ScheduleDashboard from '../components/ScheduleDashboard';
import BillingDashboard from '../components/BillingDashboard';

const C = {
  sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
  lightBeige: '#F9FAFB', darkGray: '#1F2937', gray: '#6B7280',
  lightGray: '#E5E7EB', white: '#FFFFFF'
};


function SettingsPanel({ therapist, lapsedDays, setLapsedDays }) {
  const [lapsedSaved, setLapsedSaved] = React.useState(false);
  const [fullName, setFullName] = React.useState(therapist?.full_name || '');
  const [businessName, setBusinessName] = React.useState(therapist?.business_name || '');
  const [phone, setPhone] = React.useState(therapist?.phone || '');
  const [phoneError, setPhoneError] = React.useState('');
  const [nameError, setNameError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [photoUrl, setPhotoUrl] = React.useState(therapist?.photo_url || '');
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const intakeUrl = `${window.location.origin}/${therapist?.custom_url}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(intakeUrl)}`;

  const C2 = {
    sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
    darkGray: '#1A1A2E', gray: '#6B7280', lightGray: '#E8E4DC',
    white: '#FFFFFF', gold: '#C9A84C'
  };

  const copyLink = () => {
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ width: '100%' }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '700', color: C2.darkGray, margin: '0 0 28px 0' }}>
        Account Settings
      </h2>

      {/* Profile Completion Bar */}
      {(() => {
        const fields = [
          { label: 'Full Name', done: !!(therapist?.full_name) },
          { label: 'Business Name', done: !!(therapist?.business_name) },
          { label: 'Intake URL', done: !!(therapist?.custom_url) },
          { label: 'Phone Number', done: !!(therapist?.phone) },
          { label: 'Email', done: !!(therapist?.email) },
          { label: 'Profile Photo', done: !!(therapist?.photo_url) },
        ];
        const done = fields.filter(f => f.done).length;
        const pct = Math.round((done / fields.length) * 100);
        if (pct === 100) return null;
        return (
          <div style={{ background: '#fff', border: '1.5px solid #E8E4DC', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E' }}>Profile Completion</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#2A5741' }}>{pct}%</span>
            </div>
            <div style={{ background: '#E8E4DC', borderRadius: '99px', height: '8px', marginBottom: '14px' }}>
              <div style={{ width: pct + '%', background: 'linear-gradient(90deg, #6B9E80, #2A5741)', borderRadius: '99px', height: '8px', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {fields.map(f => (
                <span key={f.label} style={{ fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '99px', background: f.done ? '#F0FDF4' : '#FEF9F0', color: f.done ? '#2A5741' : '#92400E', border: f.done ? '1px solid #BBF7D0' : '1px solid #FDE68A' }}>
                  {f.done ? '✓' : '+'} {f.label}
                </span>
              ))}
            </div>
            {!therapist?.phone && (
              <p style={{ fontSize: '12px', color: '#6B7280', margin: '10px 0 0 0' }}>
                💡 Add your phone number below — shown on client session briefs
              </p>
            )}
          </div>
        );
      })()}


      {/* Intake Link */}
      <div style={{ background: `linear-gradient(135deg, ${C2.forest}08, ${C2.sage}15)`, border: `1.5px solid ${C2.sage}40`, borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.sage, margin: '0 0 8px 0' }}>
          🔗 Your Client Intake Link
        </p>
        <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 14px 0' }}>
          Share this with clients — they tap it, fill their body map, you get it instantly.
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', fontFamily: 'monospace', color: C2.darkGray, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {intakeUrl}
          </div>
          <button onClick={copyLink} style={{ background: copied ? C2.forest : C2.sage, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s' }}>
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* QR Code */}
      <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '14px', padding: '24px', marginBottom: '20px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <img src={qrUrl} alt="QR Code" style={{ width: 130, height: 130, borderRadius: '8px', border: `1px solid ${C2.lightGray}` }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 6px 0' }}>
            📱 QR Code
          </p>
          <p style={{ fontSize: '14px', fontWeight: '600', color: C2.darkGray, margin: '0 0 8px 0' }}>Print & place at your table</p>
          <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 16px 0', lineHeight: 1.5 }}>
            Clients scan before the session. No link needed. Works on any phone.
          </p>
          <a href={qrUrl} download="bodymap-qr.png" style={{ display: 'inline-block', background: C2.beige, border: `1.5px solid ${C2.lightGray}`, color: C2.darkGray, padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            ⬇️ Download QR Code
          </a>
        </div>
      </div>

      {/* Profile Edit */}
      <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 16px 0' }}>
          ✏️ Profile
        </p>
        {/* Photo Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '20px', borderBottom: `1px solid ${C2.lightGray}` }}>
          <div style={{ position: 'relative' }}>
            {photoUrl || therapist?.photo_url ? (
              <img src={photoUrl || therapist?.photo_url} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C2.sage}` }} />
            ) : (
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: C2.beige, border: `2px dashed ${C2.sage}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🌿</div>
            )}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: C2.darkGray, margin: '0 0 4px 0' }}>Profile Photo / Business Logo</p>
            <p style={{ fontSize: '11px', color: C2.gray, margin: '0 0 10px 0' }}>Used on client briefs. Square image works best.</p>
            <label style={{ display: 'inline-block', background: C2.beige, border: `1.5px solid ${C2.lightGray}`, color: C2.darkGray, padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: photoUploading ? 'not-allowed' : 'pointer' }}>
              {photoUploading ? '⏳ Uploading...' : '📷 Upload Photo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={photoUploading}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
                  setPhotoUploading(true);
                  try {
                    const { supabase } = await import('../lib/supabase');
                    const ext = file.name.split('.').pop();
                    const { data: { user } } = await supabase.auth.getUser();
                    const path = `${user.id}/profile.${ext}`;
                    const { error: upErr } = await supabase.storage.from('bodymap-assets').upload(path, file, { upsert: true });
                    if (upErr) throw upErr;
                    const { data: { publicUrl } } = supabase.storage.from('bodymap-assets').getPublicUrl(path);
                    await supabase.from('therapists').update({ photo_url: publicUrl }).eq('id', therapist.id);
                    setPhotoUrl(publicUrl);
                  } catch(err) { console.error(err); alert('Upload failed. Please try again.'); }
                  finally { setPhotoUploading(false); }
                }} />
            </label>
            {(photoUrl || therapist?.photo_url) && (
              <button onClick={async () => {
                const { supabase } = await import('../lib/supabase');
                await supabase.from('therapists').update({ photo_url: null }).eq('id', therapist.id);
                setPhotoUrl('');
              }} style={{ marginLeft: '8px', background: 'none', border: 'none', fontSize: '11px', color: '#EF4444', cursor: 'pointer', fontWeight: '600' }}>Remove</button>
            )}
          </div>
        </div>

        <div className="bm-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${nameError?'#EF4444':C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          {nameError && <p style={{color:'#EF4444',fontSize:'11px',margin:'4px 0 0'}}>{nameError}</p>}
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Business Name</label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Phone Number (shown on client briefs)</label>
          <input value={phone} onChange={e => { const d=e.target.value.replace(/\D/g,'').slice(0,10); const f=d.length<=3?d:d.length<=6?`(${d.slice(0,3)}) ${d.slice(3)}`:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; setPhone(f); setPhoneError(''); }} placeholder="(512) 555-1234" type="tel"
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${phoneError?'#EF4444':C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          {phoneError && <p style={{color:'#EF4444',fontSize:'11px',margin:'4px 0 0'}}>{phoneError}</p>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={async () => {
              let valid = true;
              if (!fullName.trim() || fullName.trim().length < 2) { setNameError('Name must be at least 2 characters'); valid = false; } else setNameError('');
              if (phone && phone.replace(/\D/g,'').length > 0 && phone.replace(/\D/g,'').length !== 10) { setPhoneError('Enter a valid 10-digit phone number'); valid = false; } else setPhoneError('');
              if (!valid) return;
              setSaving(true);
              try {
                const { supabase } = await import('../lib/supabase');
                await supabase.from('therapists').update({ full_name: fullName, business_name: businessName, phone: phone }).eq('id', therapist.id);
                setSaved(true); setTimeout(() => setSaved(false), 2500);
              } catch(e) { console.error(e); }
              finally { setSaving(false); }
            }}
            style={{ background: C2.sage, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
          <div>
            {nameError && <p style={{color:'#EF4444',fontSize:'11px',margin:'0 0 2px'}}>{nameError}</p>}
            <p style={{ fontSize: '12px', color: C2.gray, margin: 0 }}>Email: {therapist?.email}</p>
          </div>
        </div>
      </div>

      {/* Lapsed Threshold */}
      <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 8px 0' }}>🍂 Lapsed Client Settings</p>
        <p style={{ fontSize: '12px', color: C2.gray, margin: '0 0 16px 0', lineHeight: 1.5 }}>Set how many days before a client is flagged as lapsed. Default is 60 days — adjust to match how often your clients typically book.</p>
        <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 12px 0' }}>Clients who haven't visited in this many days will appear in the re-engagement nudge on your dashboard.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input type="number" min="1" max="365" value={lapsedDays}
            onChange={e => { const v = parseInt(e.target.value); if(!isNaN(v)) setLapsedDays(v); }}
            onBlur={e => { const v = parseInt(e.target.value); const clamped = Math.max(1, Math.min(365, isNaN(v) ? 60 : v)); setLapsedDays(clamped); localStorage.setItem('bm_lapsed_days', clamped); setLapsedSaved(true); setTimeout(() => setLapsedSaved(false), 2000); }}
            placeholder="60"
            style={{ width: '80px', padding: '10px 12px', border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', fontSize: '16px', fontWeight: '700', color: C2.forest, background: C2.beige, textAlign: 'center', fontFamily: 'system-ui' }} />
          <p style={{ fontSize: '14px', color: C2.darkGray, margin: 0 }}>days since last visit</p>
          {lapsedSaved && <p style={{ fontSize: '13px', color: C2.forest, fontWeight: '600', margin: 0 }}>✓ Saved</p>}
        </div>
      </div>

      {/* Plan */}
      <div style={{ background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '14px', padding: '24px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.gray, margin: '0 0 12px 0' }}>
          💳 Plan
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '18px', fontWeight: '700', color: C2.darkGray, margin: '0 0 4px 0' }}>
              {(!therapist?.plan || therapist?.plan === 'free') ? 'Free Plan' : therapist?.plan === 'silver' ? 'Silver — $24/mo' : 'Gold — $49/mo'}
            </p>
            <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 4px 0' }}>
              {therapist?.plan === 'free' ? 'Up to 5 clients. Upgrade to unlock unlimited.' : therapist?.plan === 'silver' ? 'Unlimited clients + full session history.' : 'All features including AI insights.'}
            </p>
            {therapist?.plan !== 'free' && (
              <p style={{ fontSize: '12px', color: C2.gray, margin: 0, opacity: 0.7 }}>Cancel anytime. Access continues until end of billing period.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ view }) {
  const { therapist, signOut } = useAuth();
  const navigate = useNavigate();
  const { clientId, sessionId } = useParams();
  const [stats, setStats] = useState({ clients: 0, sessions: 0 });
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendPhone, setSendPhone] = useState('');
  const [sendCopied, setSendCopied] = useState(false);
  const [showBookmarkNudge, setShowBookmarkNudge] = useState(false);
  const [lapsedDays, setLapsedDays] = React.useState(() => parseInt(localStorage.getItem('bm_lapsed_days') || '60'));

  useEffect(() => {
    if (therapist?.id) loadStats();
    if (localStorage.getItem('showSendOnLoad') === 'true') {
      localStorage.removeItem('showSendOnLoad');
      setTimeout(() => setShowSendModal(true), 800);
    }
    if (localStorage.getItem('showBookmarkNudge') === 'true') {
      localStorage.removeItem('showBookmarkNudge');
      setShowBookmarkNudge(true);
    }
  }, [therapist?.id]);

  useEffect(() => {
    if (clientId) loadClient();
  }, [clientId]);

  useEffect(() => {
    if (sessionId) loadSession();
  }, [sessionId]);

  async function loadStats() {
    try {
      const clients = await db.getTherapistClients(therapist.id);
      const { data: sessions } = await supabase.from('sessions').select('id').eq('therapist_id', therapist.id);
      setStats({ clients: clients?.length || 0, sessions: sessions?.length || 0 });
    } catch (err) { console.error(err); }
  }

  async function loadClient() {
    try {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
      if (!error) setClient(data);
    } catch (err) { console.error(err); }
  }

  async function loadSession() {
    try {
      const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      if (!error) setSession(data);
    } catch (err) { console.error(err); }
  }

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div style={{ minHeight: '100vh', background: C.beige, fontFamily: 'system-ui, sans-serif', overflowX: 'hidden', paddingTop: '0' }}>
      {new URLSearchParams(window.location.search).get('upgraded') === 'true' && (
        <div style={{ background: '#ECFDF5', borderBottom: '2px solid #059669', padding: '16px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '17px', fontWeight: '700', color: '#065F46', margin: '0 0 2px 0' }}>🎉 Congratulations! You're now on Silver.</p>
          <p style={{ fontSize: '13px', color: '#047857', margin: 0 }}>Unlimited clients and sessions are now unlocked. Let's get to work!</p>
        </div>
      )}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.lightGray}`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <span style={{ fontSize: '32px' }}>🌿</span>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: C.forest, margin: 0 }}>BodyMap</h1>
            <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>{therapist?.business_name || 'Dashboard'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: C.darkGray, margin: 0 }}>{therapist?.full_name}</p>
            <p style={{ fontSize: '12px', color: C.gray, margin: 0 }}>
              {(!therapist?.plan || therapist?.plan === 'free') ? 'Free Plan' : therapist?.plan === 'silver' ? 'Silver Plan ✓' : 'Gold Plan ✓'}
            </p>
          </div>
          {(!therapist?.plan || therapist?.plan === 'free') && (
            <a href="https://buy.stripe.com/test_5kQ3cxcoC8p75UR6P7afS01" target="_blank" rel="noopener noreferrer"
              style={{ background: '#C9A84C', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Upgrade to Silver →
            </a>
          )}
          <button onClick={handleLogout} style={{ background: C.white, border: `1px solid ${C.lightGray}`, color: C.gray, padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      {showBookmarkNudge && (
        <div style={{ background: '#2A5741', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📲</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Add BodyMap to your home screen for instant 3-second access — bookmark this page or use Share → Add to Home Screen</p>
          </div>
          <button onClick={() => setShowBookmarkNudge(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Got it ✓</button>
        </div>
      )}
      <div className="bm-dash-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ background: C.white, borderRadius: '12px', padding: '8px', marginBottom: '24px', display: 'flex', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ flex: 1, background: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.sage : 'transparent', color: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            📋 Clients
          </button>
          <button
            onClick={() => navigate('/dashboard/schedule')}
            style={{ flex: 1, background: view === 'schedule' ? C.sage : 'transparent', color: view === 'schedule' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            📅 Schedule
          </button>
          <button
            onClick={() => navigate('/dashboard/billing')}
            style={{ flex: 1, background: view === 'billing' ? C.sage : 'transparent', color: view === 'billing' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            💰 Billing
          </button>
          <button
            onClick={() => navigate('/dashboard/settings')}
            style={{ flex: 1, background: view === 'settings' ? C.sage : 'transparent', color: view === 'settings' ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            ⚙️ Settings
          </button>
        </div>

        <div style={{ background: C.white, borderRadius: '12px', padding: '32px', minHeight: '400px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {view === 'clients' && (
            <ClientList
              therapistId={therapist?.id}
              onSelectClient={(c) => navigate(`/dashboard/clients/${c.id}`)}
              lapsedDays={lapsedDays}
              customUrl={therapist?.custom_url || ''}
            />
          )}
          {view === 'sessions' && client && (
            <SessionList
              client={client}
              therapistId={therapist?.id}
              onBack={() => navigate('/dashboard')}
              onSelectSession={(s) => navigate(`/dashboard/clients/${clientId}/sessions/${s.id}`)}
            />
          )}
          {view === 'sessions' && !client && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.gray }}>Loading client...</div>
          )}
          {view === 'session-detail' && session && client && (
            <SessionDetail
              session={session}
              client={client}
              onBack={() => navigate(`/dashboard/clients/${clientId}`)}
              onUpdate={(updated) => setSession(updated)}
            />
          )}
          {view === 'session-detail' && (!session || !client) && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.gray }}>Loading session...</div>
          )}
          {view === 'schedule' && (
            <ScheduleDashboard therapist={therapist} />
          )}
          {view === 'billing' && (
            <BillingDashboard therapist={therapist} />
          )}
          {view === 'settings' && (
            <SettingsPanel therapist={therapist} lapsedDays={lapsedDays} setLapsedDays={setLapsedDays} />
          )}
        </div>

        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Total Clients</p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: C.forest, margin: 0 }}>{stats.clients}</p>
          </div>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Total Sessions</p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: C.sage, margin: 0 }}>{stats.sessions}</p>
          </div>
          <div style={{ background: C.white, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>Plan</p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, margin: 0 }}>
              {(!therapist?.plan || therapist?.plan === 'free') ? 'Free (5 clients max)' : therapist?.plan === 'silver' ? 'Silver ($24/mo)' : 'Gold ($49/mo)'}
            </p>
          </div>
        </div>
      </div>
      {(view === 'clients' || view === 'sessions' || view === 'session-detail') && (
        <button onClick={() => { setShowSendModal(true); setSendPhone(''); setSendCopied(false); }} style={{ position: 'fixed', bottom: '32px', right: '32px', background: '#2A5741', color: 'white', border: 'none', borderRadius: '50px', padding: '16px 28px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 24px rgba(42,87,65,0.4)', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1000 }}>
          📤 Send Intake
        </button>
      )}
      {showSendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '24px' }} onClick={() => setShowSendModal(false)}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 4px 0' }}>📤 Send Intake Form</h2>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Client fills it on their phone in 60 seconds</p>
              </div>
              <button onClick={() => setShowSendModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}>✕</button>
            </div>
            <div style={{ background: '#F5F0E8', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px 0' }}>Your intake link</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#2A5741', margin: 0, wordBreak: 'break-all' }}>{window.location.origin}/{therapist?.custom_url}</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A2E', display: 'block', marginBottom: '8px' }}>Client phone number (optional)</label>
              <input type="tel" value={sendPhone} onChange={e => { const d=e.target.value.replace(/\D/g,'').slice(0,10); const f=d.length<=3?d:d.length<=6?`(${d.slice(0,3)}) ${d.slice(3)}`:`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`; setSendPhone(f); }} placeholder="(512) 555-1234" autoFocus style={{ width: '100%', padding: '12px 16px', border: '2px solid #E8E4DC', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href={sendPhone.replace(/\D/g,'').length >= 10 ? 'sms:' + sendPhone.replace(/\D/g,'') + '?body=' + encodeURIComponent('Hi! Please fill out my quick intake form before your session: ' + window.location.origin + '/' + (therapist?.custom_url || '')) : undefined} onClick={e => { if(sendPhone.replace(/\D/g,'').length < 10) e.preventDefault(); else setTimeout(() => setShowSendModal(false), 500); }} style={{ display: 'block', textAlign: 'center', background: sendPhone.replace(/\D/g,'').length >= 10 ? '#2A5741' : '#C8BFB0', color: 'white', padding: '14px', borderRadius: '50px', fontWeight: '700', fontSize: '15px', textDecoration: 'none', cursor: sendPhone.replace(/\D/g,'').length >= 10 ? 'pointer' : 'not-allowed' }}>
                💬 Open in Messages →
              </a>
              <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/' + (therapist?.custom_url || '')); setSendCopied(true); setTimeout(() => setSendCopied(false), 2000); }} style={{ background: sendCopied ? '#E8F5EE' : '#F5F0E8', border: '1.5px solid ' + (sendCopied ? '#6B9E80' : '#E8E4DC'), color: sendCopied ? '#2A5741' : '#6B7280', padding: '12px', borderRadius: '50px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                {sendCopied ? '✓ Copied!' : '📋 Copy Link Only'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>🔒 Only shared with you</p>
          </div>
        </div>
      )}
    </div>
  );
}
