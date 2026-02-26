// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, supabase } from '../lib/supabase';
import ClientList from '../components/ClientList';
import SessionList from '../components/SessionList';
import SessionDetail from '../components/SessionDetail';

const C = {
  sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
  lightBeige: '#F9FAFB', darkGray: '#1F2937', gray: '#6B7280',
  lightGray: '#E5E7EB', white: '#FFFFFF'
};


function SettingsPanel({ therapist }) {
  const [fullName, setFullName] = React.useState(therapist?.full_name || '');
  const [businessName, setBusinessName] = React.useState(therapist?.business_name || '');
  const [saving, setSaving] = React.useState(false);
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
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: '700', color: C2.darkGray, margin: '0 0 28px 0' }}>
        Account Settings
      </h2>

      {/* Intake Link */}
      <div style={{ background: `linear-gradient(135deg, ${C2.forest}08, ${C2.sage}15)`, border: `1.5px solid ${C2.sage}40`, borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: C2.sage, margin: '0 0 8px 0' }}>
          🔗 Your Client Intake Link
        </p>
        <p style={{ fontSize: '13px', color: C2.gray, margin: '0 0 14px 0' }}>
          Share this with clients — they tap it, fill their body map, you get it instantly.
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: C2.white, border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', padding: '10px 14px', fontSize: '14px', fontFamily: 'monospace', color: C2.darkGray, minWidth: 200 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: C2.gray, display: 'block', marginBottom: '6px' }}>Business Name</label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C2.lightGray}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'system-ui', background: C2.beige }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                const { supabase } = await import('../lib/supabase');
                await supabase.from('therapists').update({ full_name: fullName, business_name: businessName }).eq('id', therapist.id);
                setSaved(true); setTimeout(() => setSaved(false), 2500);
              } catch(e) { console.error(e); }
              finally { setSaving(false); }
            }}
            style={{ background: C2.sage, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
          <div>
            <p style={{ fontSize: '12px', color: C2.gray, margin: 0 }}>Email: {therapist?.email}</p>
          </div>
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
              {therapist?.plan === 'free' ? 'Free Plan' : therapist?.plan === 'silver' ? 'Silver — $24/mo' : 'Gold — $49/mo'}
            </p>
            <p style={{ fontSize: '13px', color: C2.gray, margin: 0 }}>
              {therapist?.plan === 'free' ? 'Up to 5 clients. Upgrade to unlock unlimited.' : therapist?.plan === 'silver' ? 'Unlimited clients + full session history.' : 'All features including AI insights.'}
            </p>
          </div>
          {therapist?.plan === 'free' && (
            <button style={{ background: C2.gold, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
              Upgrade ↗
            </button>
          )}
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

  useEffect(() => {
    if (therapist?.id) loadStats();
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
    <div style={{ minHeight: '100vh', background: C.beige, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ background: C.white, borderBottom: `1px solid ${C.lightGray}`, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
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
              {therapist?.plan === 'free' ? 'Free Plan' : therapist?.plan === 'silver' ? 'Silver Plan' : 'Gold Plan'}
            </p>
          </div>
          <button onClick={handleLogout} style={{ background: C.white, border: `1px solid ${C.lightGray}`, color: C.gray, padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ background: C.white, borderRadius: '12px', padding: '8px', marginBottom: '24px', display: 'flex', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ flex: 1, background: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.sage : 'transparent', color: (view === 'clients' || view === 'sessions' || view === 'session-detail') ? C.white : C.gray, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            📋 Clients
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
          {view === 'settings' && (
            <SettingsPanel therapist={therapist} />
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
              {therapist?.plan === 'free' ? 'Free (5 clients max)' : therapist?.plan === 'silver' ? 'Silver ($24/mo)' : 'Gold ($49/mo)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
