// src/components/ClientProfile/index.jsx
//
// Top-level container for the therapist client view. Composed of:
//
//   ProfileHeader   sticky identity bar (hero band w/ state color)
//   StatusStrip     balance / next / lifetime tiles
//   ProfileSection 'Sessions and SOAP notes'   ← primary work area
//   ProfileSection 'Patterns'                  ← body-map intelligence
//   ProfileSection 'Preferences'
//   ProfileSection 'Medical flags'
//   ProfileSection 'Timeline'
//
// Each ProfileSection is independently collapsible. Defaults to
// open. The card chrome + italic serif title + sage sprig + chevron
// matches the Settings page design language (white card, hairline
// border, cream-soft body when open).

import React, { useEffect, useState } from 'react';
import { db } from '../../lib/supabase';
import ProfileHeader from './ProfileHeader';
import StatusStrip from './StatusStrip';
import ProfileSection from './ProfileSection';
import PatternsCard from './PatternsCard';
import PreferencesCard from './PreferencesCard';
import MedicalCard from './MedicalCard';
import Timeline from './Timeline';
import SessionList from '../SessionList';

const C = {
  cream: '#FBF8F1',
  muted: '#98A395',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

export default function ClientProfile({ client, therapistId, therapist, onBack, onSelectSession }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Open/closed state for each section. All sections default to open
  // so the page is fully informative on first visit; the therapist
  // can collapse what they don't need.
  const [openSections, setOpenSections] = useState({
    soap: true,
    patterns: true,
    preferences: true,
    medical: true,
    timeline: true,
  });
  const toggle = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

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

  // Convenience derived values for section subtitles + counts
  const totalSessions = profile?.stats?.lifetimeSessions || 0;
  const soapCount = (profile?.sessions || []).filter(s => s.completed).length;
  const patternCount = profile?.patterns
    ? (profile.patterns.topFrontZones?.length || 0)
      + (profile.patterns.topBackZones?.length || 0)
      + (profile.patterns.topAvoidZones?.length || 0)
    : 0;
  const medicalCount = profile?.medicalFlags?.length || 0;
  const timelineCount = profile?.bookings?.length || 0;

  return (
    <div style={{ background: C.cream, minHeight: '100vh' }}>
      <ProfileHeader
        client={profile?.client || client}
        stats={profile?.stats}
        profile={profile}
        onBack={onBack}
        onEdit={() => { /* wire-up queued */ }}
        onArchive={() => { /* wire-up queued */ }}
      />

      {loading && (
        <div style={{
          fontFamily: F.sans,
          fontSize: 12,
          color: C.muted,
          textAlign: 'center',
          padding: '4px 0 8px',
          fontStyle: 'italic',
        }}>
          Loading profile…
        </div>
      )}

      {/* Status strip stays uncollapsible: balance + next + lifetime
          are too important to hide behind a click. */}
      {profile && <StatusStrip profile={profile} />}

      {profile && (
        <div style={{ padding: '0 18px 24px' }}>

          {/* Sessions and SOAP notes: moved to the top per HK request.
              This is the primary work surface for the therapist. */}
          <ProfileSection
            accent="soap"
            title="Sessions and SOAP notes"
            trailingLabel={soapCount > 0
              ? `${soapCount} note${soapCount === 1 ? '' : 's'} written`
              : 'No notes yet'}
            count={soapCount > 0 ? soapCount : undefined}
            isOpen={openSections.soap}
            onToggle={() => toggle('soap')}
          >
            <SessionList
              client={profile.client}
              therapist={therapist}
              therapistId={therapistId}
              onBack={onBack}
              onSelectSession={onSelectSession}
              compact={true}
            />
          </ProfileSection>

          <ProfileSection
            accent="patterns"
            title="Patterns"
            trailingLabel={patternCount > 0
              ? 'Recurring body zones'
              : 'Will populate after first sessions'}
            count={patternCount > 0 ? patternCount : undefined}
            isOpen={openSections.patterns}
            onToggle={() => toggle('patterns')}
          >
            <PatternsCard
              patterns={profile.patterns}
              totalSessions={totalSessions}
            />
          </ProfileSection>

          <ProfileSection
            accent="preferences"
            title="Preferences"
            trailingLabel={profile.preferences
              ? 'From last session'
              : 'Not set yet'}
            isOpen={openSections.preferences}
            onToggle={() => toggle('preferences')}
          >
            <PreferencesCard preferences={profile.preferences} />
          </ProfileSection>

          <ProfileSection
            accent="medical"
            title="Medical flags"
            trailingLabel={medicalCount > 0
              ? `${medicalCount} on file`
              : 'None on file'}
            count={medicalCount > 0 ? medicalCount : undefined}
            isOpen={openSections.medical}
            onToggle={() => toggle('medical')}
          >
            <MedicalCard medicalFlags={profile.medicalFlags} />
          </ProfileSection>

          <ProfileSection
            accent="timeline"
            title="Timeline"
            trailingLabel={timelineCount > 0
              ? `${timelineCount} event${timelineCount === 1 ? '' : 's'}`
              : 'No activity yet'}
            count={timelineCount > 0 ? timelineCount : undefined}
            isOpen={openSections.timeline}
            onToggle={() => toggle('timeline')}
          >
            <Timeline
              profile={profile}
              onSelectSession={onSelectSession}
            />
          </ProfileSection>

        </div>
      )}
    </div>
  );
}
