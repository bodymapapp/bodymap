// src/components/SessionList.js
import React, { useState, useEffect } from 'react';
import { db } from '../lib/supabase';

const C = {
  sage: '#6B9E80',
  forest: '#2A5741',
  beige: '#F0EAD9',
  lightBeige: '#F9FAFB',
  darkGray: '#1F2937',
  gray: '#6B7280',
  lightGray: '#E5E7EB',
  white: '#FFFFFF'
};

export default function SessionList({ client, therapistId, onBack, onSelectSession }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSessions();
  }, [client.id]);

  async function loadSessions() {
    try {
      setLoading(true);
      const data = await db.getClientSessions(client.id);
      setSessions(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{
            background: C.white,
            border: `1px solid ${C.lightGray}`,
            color: C.gray,
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          ← Back
        </button>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, margin: 0 }}>
            {client.name}
          </h2>
          <p style={{ fontSize: '14px', color: C.gray, margin: '4px 0 0 0' }}>
            {client.phone || ''} {client.email ? '· ' + client.email : ''}
          </p>
        </div>
      </div>

      {/* Client Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Sessions', value: client.total_sessions || 0, color: C.sage },
          { label: 'Loyalty Points', value: client.loyalty_points || 0, color: C.forest },
          { label: 'Member Since', value: new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), color: C.darkGray }
        ].map((stat, i) => (
          <div key={i} style={{ background: C.white, borderRadius: '12px', padding: '20px', border: `1px solid ${C.lightGray}` }}>
            <p style={{ fontSize: '13px', color: C.gray, margin: '0 0 8px 0' }}>{stat.label}</p>
            <p style={{ fontSize: '24px', fontWeight: '700', color: stat.color, margin: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Sessions */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.gray }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🌿</div>
          <p>Loading sessions...</p>
        </div>
      ) : error ? (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '16px', color: '#991B1B' }}>
          <strong>Error:</strong> {error}
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: C.lightBeige, borderRadius: '12px', border: `2px dashed ${C.lightGray}` }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ fontSize: '20px', color: C.darkGray, marginBottom: '8px' }}>No Sessions Yet</h3>
          <p style={{ fontSize: '16px', color: C.gray }}>Sessions will appear here after the client completes intake</p>
        </div>
      ) : (
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: C.darkGray, marginBottom: '16px' }}>
            Sessions ({sessions.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession && onSelectSession(session)}
                style={{
                  background: C.white,
                  border: `1px solid ${C.lightGray}`,
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'border-color 0.15s'
                }}
              >
                <div>
                  <p style={{ fontSize: '16px', fontWeight: '600', color: C.darkGray, margin: '0 0 4px 0' }}>
                    Session on {new Date(session.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>
                    {session.pain_areas?.length > 0 ? `${session.pain_areas.length} pain areas marked` : 'No pain areas'} 
                    {session.notes ? ' · Has notes' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    background: session.status === 'completed' ? '#D1FAE5' : '#FEF3C7',
                    color: session.status === 'completed' ? '#065F46' : '#92400E',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {session.status === 'completed' ? '✓ Completed' : '⏳ Pending'}
                  </span>
                  <span style={{ color: C.gray, fontSize: '18px' }}>›</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
