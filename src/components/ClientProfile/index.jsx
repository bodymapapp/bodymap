// src/components/ClientProfile/index.jsx
//
// Top-level container for the redesigned therapist client view.
// Replaces SessionList.js as the page shown when therapist taps a
// client card. Composed of:
//
//   ProfileHeader   sticky identity bar + action buttons
//   StatusStrip     balance / next / lifetime / attention tiles
//   PatternsCard    body-map intelligence aggregated across sessions
//   PreferencesCard pressure/temp/music defaults from last session
//   MedicalCard     conditions and contraindications
//   Timeline        unified activity feed: bookings, sessions,
//                   packages, memberships, gifts
//
// Edit details + archive flow wire-up coming in section 7 (next
// commit). Until then those menu items in ProfileHeader are no-ops.

import React, { useEffect, useState } from 'react';
import { db } from '../../lib/supabase';
import ProfileHeader from './ProfileHeader';
import StatusStrip from './StatusStrip';
import PatternsCard from './PatternsCard';
import PreferencesCard from './PreferencesCard';
import MedicalCard from './MedicalCard';
import Timeline from './Timeline';
import SessionList from '../SessionList';
import { C, F } from './tokens';

export default function ClientProfile({ client, therapistId, therapist, onBack, onSelectSession }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await db.getClientProfile(
          client.id,
          therapistId,
          client.email,
          client.phone,
        );
        if (!cancelled) setProfile(data);
      } catch (err) {
        console.error('[ClientProfile] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (client?.id && therapistId) load();
    return () => { cancelled = true; };
  }, [client?.id, therapistId]);

  // Soft loading state: render header skeleton + the existing
  // SessionList so the page is never blank.
  return (
    <div style={{ background: C.cream, minHeight: '100vh' }}>
      <ProfileHeader
        client={profile?.client || client}
        stats={profile?.stats}
        profile={profile}
        onBack={onBack}
        onEdit={() => { /* TODO section 7: open edit modal */ }}
        onArchive={() => { /* TODO section 7: archive flow */ }}
      />

      {loading && (
        <div style={{
          fontFamily: F.sans,
          fontSize: 12,
          color: C.muted,
          textAlign: 'center',
          padding: '4px 0 8px',
        }}>
          Loading profile…
        </div>
      )}

      {/* Section 3: Status strip with balance, next visit, lifetime, attention */}
      {profile && <StatusStrip profile={profile} />}

      {/* Section 4: Patterns + Preferences + Medical cards.
          Responsive grid: single column on mobile/tablet, two columns
          on wide screens with Patterns spanning full width since its
          bars need horizontal room to be readable. */}
      {profile && (
        <div style={{ padding: '0 18px' }}>
          <PatternsCard
            patterns={profile.patterns}
            totalSessions={profile.stats?.lifetimeSessions || 0}
          />
          <div className="bm-cp-two-col" style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 0,
          }}>
            <PreferencesCard preferences={profile.preferences} />
            <MedicalCard medicalFlags={profile.medicalFlags} />
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .bm-cp-two-col {
            grid-template-columns: 1fr 1fr !important;
            gap: 16px !important;
          }
        }
      `}</style>

      {/* Section 5: Unified Timeline replaces the old SessionList */}
      {profile && (
        <div style={{ padding: '0 18px' }}>
          <Timeline
            profile={profile}
            onSelectSession={onSelectSession}
          />
        </div>
      )}

      {/* Sessions + SOAP notes section.
          Mounts the existing SessionList below the new design so the
          full SOAP workflow (write, view, edit, delete) stays
          accessible. SessionList renders its own count + stat boxes +
          card-on-file controls, which the new design intentionally
          does not duplicate. Title above the embed clarifies the
          purpose so the section reads like a deliberate part of the
          page, not a duplicate header.

          Wrapped in a div so we can theme this section subtly
          differently than the rest of the new page without modifying
          SessionList directly. */}
      {profile && (
        <div style={{
          padding: '0 18px',
          marginTop: 8,
        }}>
          <div style={{
            background: C.paper,
            border: `1px solid ${C.lineFaint}`,
            borderRadius: 14,
            padding: '18px 18px 8px',
            marginBottom: 16,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12,
            }}>
              <span style={{ fontSize: 16 }}>📝</span>
              <h2 style={{
                margin: 0,
                fontFamily: F.serif,
                fontSize: 17, fontWeight: 700,
                color: C.forest,
                lineHeight: 1.2,
              }}>
                Sessions and SOAP notes
              </h2>
            </div>
            <SessionList
              client={profile.client}
              therapist={therapist}
              therapistId={therapistId}
              onBack={onBack}
              onSelectSession={onSelectSession}
              compact={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
