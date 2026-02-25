// src/components/ClientList.js
import React, { useState, useEffect } from 'react';
import { db } from '../lib/supabase';

const C = {
  sage: '#6B9E80', forest: '#2A5741', beige: '#F0EAD9',
  lightBeige: '#F9FAFB', darkGray: '#1F2937', gray: '#6B7280',
  lightGray: '#E5E7EB', white: '#FFFFFF'
};

export default function ClientList({ therapistId, onSelectClient }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => { if (therapistId) loadClients(); }, [therapistId]);

  async function loadClients() {
    try {
      setLoading(true);
      setError(null);
      const data = await db.getTherapistClients(therapistId);
      setClients(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px', color: C.gray }}>
      <div style={{ fontSize: '32px', marginBottom: '16px' }}>🌿</div>
      <p>Loading clients...</p>
    </div>
  );

  if (error) return (
    <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '16px', color: '#991B1B' }}>
      <strong>Error:</strong> {error}
    </div>
  );

  if (clients.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', background: C.lightBeige, borderRadius: '12px', border: `2px dashed ${C.lightGray}` }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
      <h3 style={{ fontSize: '20px', color: C.darkGray, marginBottom: '8px' }}>No Clients Yet</h3>
      <p style={{ fontSize: '16px', color: C.gray }}>Share your custom URL with clients to get started</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: C.darkGray, margin: 0 }}>Your Clients</h2>
          <p style={{ fontSize: '14px', color: C.gray, margin: '4px 0 0 0' }}>{clients.length} {clients.length === 1 ? 'client' : 'clients'} total</p>
        </div>
        <button onClick={loadClients} style={{ background: C.white, border: `1px solid ${C.lightGray}`, color: C.gray, padding: '8px 16px', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.lightGray}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.lightBeige }}>
              {['Name', 'Phone', 'Email', 'Sessions', 'Loyalty Points'].map(h => (
                <th key={h} style={{ padding: '16px', textAlign: h === 'Sessions' || h === 'Loyalty Points' ? 'center' : 'left', fontSize: '12px', fontWeight: '600', color: C.gray, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => (
              <tr
                key={client.id}
                onClick={() => onSelectClient && onSelectClient(client)}
                onMouseEnter={() => setHoveredId(client.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: hoveredId === client.id ? '#F0F9F4' : index % 2 === 0 ? C.white : C.lightBeige,
                  borderTop: `1px solid ${C.lightGray}`,
                  cursor: 'pointer'
                }}
              >
                <td style={{ padding: '16px', fontSize: '15px', fontWeight: '600', color: C.sage }}>
                  {client.name} <span style={{ fontSize: '12px', color: C.gray }}>›</span>
                </td>
                <td style={{ padding: '16px', fontSize: '14px', color: C.gray }}>{client.phone || '—'}</td>
                <td style={{ padding: '16px', fontSize: '14px', color: C.gray }}>{client.email || '—'}</td>
                <td style={{ padding: '16px', fontSize: '16px', fontWeight: '700', color: C.sage, textAlign: 'center' }}>{client.total_sessions || 0}</td>
                <td style={{ padding: '16px', fontSize: '16px', fontWeight: '700', color: C.forest, textAlign: 'center' }}>{client.loyalty_points || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
