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
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, marginBottom: '16px' }}>Account Settings</h2>
              <div style={{ background: C.lightBeige, border: `1px solid ${C.lightGray}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}><strong>Custom URL:</strong> mybodymap.app/{therapist?.custom_url}</p>
              </div>
              <div style={{ background: C.lightBeige, border: `1px solid ${C.lightGray}`, borderRadius: '8px', padding: '16px' }}>
                <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}><strong>Email:</strong> {therapist?.email}</p>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
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
