// src/components/ClientProfile/index.jsx
//
// Top-level container for the redesigned therapist client view.
// Replaces SessionList.js as the page shown when therapist taps a
// client card. Sequentially composed of:
//
//   ProfileHeader   — sticky, identity + actions
//   StatusStrip     — balance / next / lifetime / attention tiles
//   PatternsCard    — body-map intelligence (the moat)
//   PreferencesCard — pressure/temp/music defaults
//   MedicalCard     — flags + conditions
//   Timeline        — unified activity feed
//
// This commit ships the skeleton + header only. Section 3+ adds the
// rest. Until those land, the page shows the new header on top and
// the old SessionList content below. That keeps the page usable
// throughout the build while letting HK verify each piece as it
// arrives.

import React, { useEffect, useState } from 'react';
import { db } from '../../lib/supabase';
import ProfileHeader from './ProfileHeader';
import StatusStrip from './StatusStrip';
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

      {/* TODO section 4: PatternsCard + PreferencesCard + MedicalCard */}
      {/* TODO section 5: Timeline */}

      {/* Until the new sections land, keep the old SessionList
          mounted below the new header so the therapist can still
          work normally. SessionList gets the same props it did when
          mounted directly from Dashboard. We wrap it in a div that
          hides SessionList's own header (the old "← Sessions" pill
          + name) since ProfileHeader already provides that. The
          duplicate-header hide is done via CSS in section 6 when
          we wire the full handoff.  */}
      <div style={{ padding: '0 4px' }}>
        <SessionList
          client={profile?.client || client}
          therapistId={therapistId}
          therapist={therapist}
          onBack={onBack}
          onSelectSession={onSelectSession}
        />
      </div>
    </div>
  );
}
