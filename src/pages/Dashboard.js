// src/pages/Dashboard.js
// Main therapist dashboard - shows clients and sessions

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import ClientList from '../components/ClientList';

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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('clients');
  const [stats, setStats] = useState({ clients: 0, sessions: 0 });
  const { therapist, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (therapist?.id) {
      loadStats();
    }
  }, [therapist?.id]);

  async function loadStats() {
    try {
      const [clients, sessions] = await Promise.all([
        db.getTherapistClients(therapist.id),
        db.getTherapistSessions(therapist.id)
      ]);
      setStats({
        clients: clients?.length || 0,
        sessions: sessions?.length || 0
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      navigate('/login');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: C.beige,
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: C.white,
        borderBottom: `1px solid ${C.lightGray}`,
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {/* Logo & Business Name - NOW CLICKABLE */}
        <div 
          onClick={() => navigate('/')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '32px' }}>🌿</span>
          <div>
            <h1 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: C.forest,
              margin: 0
            }}>
              BodyMap
            </h1>
            <p style={{ 
              fontSize: '14px', 
              color: C.gray,
              margin: 0
            }}>
              {therapist?.business_name || 'Dashboard'}
            </p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: C.darkGray,
              margin: 0
            }}>
              {therapist?.full_name}
            </p>
            <p style={{ 
              fontSize: '12px', 
              color: C.gray,
              margin: 0
            }}>
              {therapist?.plan === 'free' ? 'Free Plan' : 
               therapist?.plan === 'silver' ? 'Silver Plan' : 'Gold Plan'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: C.white,
              border: `1px solid ${C.lightGray}`,
              color: C.gray,
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = C.lightBeige;
              e.currentTarget.style.borderColor = C.sage;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = C.white;
              e.currentTarget.style.borderColor = C.lightGray;
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '32px 24px'
      }}>
        {/* Tab Navigation */}
        <div style={{ 
          background: C.white,
          borderRadius: '12px',
          padding: '8px',
          marginBottom: '24px',
          display: 'flex',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <button
            onClick={() => setActiveTab('clients')}
            style={{
              flex: 1,
              background: activeTab === 'clients' ? C.sage : 'transparent',
              color: activeTab === 'clients' ? C.white : C.gray,
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📋 Clients
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              flex: 1,
              background: activeTab === 'settings' ? C.sage : 'transparent',
              color: activeTab === 'settings' ? C.white : C.gray,
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Tab Content */}
        <div style={{
          background: C.white,
          borderRadius: '12px',
          padding: '32px',
          minHeight: '400px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {activeTab === 'clients' && (
            <ClientList therapistId={therapist?.id} />
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: C.darkGray,
                marginBottom: '16px'
              }}>
                Account Settings
              </h2>
              <div style={{
                background: C.lightBeige,
                border: `1px solid ${C.lightGray}`,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>
                  <strong>Custom URL:</strong> mybodymap.app/{therapist?.custom_url}
                </p>
              </div>
              <div style={{
                background: C.lightBeige,
                border: `1px solid ${C.lightGray}`,
                borderRadius: '8px',
                padding: '16px'
              }}>
                <p style={{ fontSize: '14px', color: C.gray, margin: 0 }}>
                  <strong>Email:</strong> {therapist?.email}
                </p>
              </div>
              <p style={{ 
                fontSize: '14px', 
                color: C.gray,
                marginTop: '24px'
              }}>
                More settings coming in future updates
              </p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginTop: '24px'
        }}>
          <div style={{
            background: C.white,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>
              Total Clients
            </p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: C.forest, margin: 0 }}>
              {stats.clients}
            </p>
            <p style={{ fontSize: '12px', color: C.gray, marginTop: '4px' }}>
              {stats.clients === 1 ? 'client' : 'clients'}
            </p>
          </div>

          <div style={{
            background: C.white,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>
              Total Sessions
            </p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: C.sage, margin: 0 }}>
              {stats.sessions}
            </p>
            <p style={{ fontSize: '12px', color: C.gray, marginTop: '4px' }}>
              {stats.sessions === 1 ? 'session' : 'sessions'}
            </p>
          </div>

          <div style={{
            background: C.white,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '14px', color: C.gray, margin: '0 0 8px 0' }}>
              Plan
            </p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: C.darkGray, margin: 0 }}>
              {therapist?.plan === 'free' ? 'Free (5 clients max)' : 
               therapist?.plan === 'silver' ? 'Silver ($24/mo)' : 
               'Gold ($49/mo)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
