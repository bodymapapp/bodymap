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
import { buildSampleProfile } from '../../data/sampleClients';
import ProfileHeader from './ProfileHeader';
import AboutCard from './AboutCard';
import StatusStrip from './StatusStrip';
import ProfileSection from './ProfileSection';
import PatternsCard from './PatternsCard';
import PreferencesCard from './PreferencesCard';
import MedicalCard from './MedicalCard';
import MembershipCard from './MembershipCard';
import AgreementCard from './AgreementCard';
import Timeline from './Timeline';
import SessionList from '../SessionList';

const C = {
  cream: '#FBF8F1',
  muted: '#98A395',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

export default function ClientProfile({ client, therapistId, therapist, onBack, onSelectSession, previewProfile = null }) {
  const [profile, setProfile] = useState(previewProfile);
  const [loading, setLoading] = useState(!previewProfile);

  // Open/closed state for each section. All sections default to open
  // so the page is fully informative on first visit; the therapist
  // can collapse what they don't need.
  const [openSections, setOpenSections] = useState({
    about: false,
    soap: true,
    patterns: true,
    preferences: true,
    medical: true,
    membership: true,
    agreement: true,
    timeline: true,
  });
  const toggle = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  // Triggers from the ProfileHeader hero buttons. The Edit button
  // (hero pencil) flips a pulse flag on the AboutCard so the card
  // scrolls into view and softly highlights, telling the therapist
  // 'edit your client right here, inline'. No modal. Archive still
  // uses the legacy SessionList modal flow (separate UI cleanup).
  const [aboutPulse, setAboutPulse] = useState(0);
  const [archiveTrigger, setArchiveTrigger] = useState(false);

  // When the hero pencil fires (aboutPulse increments), force the
  // Client info section open so the inline editor is reachable
  // without an extra tap on the section chevron.
  useEffect(() => {
    if (aboutPulse > 0) {
      setOpenSections(s => ({ ...s, about: true }));
    }
  }, [aboutPulse]);

  useEffect(() => {
    // If a previewProfile is provided (sample-client demo case), use
    // it directly without hitting Supabase. Real therapist clients go
    // through the normal fetch path.
    if (previewProfile) {
      setProfile(previewProfile);
      setLoading(false);
      return;
    }
    // Sample client routed by URL (clientId starts with 'sample-').
    // The Dashboard set `client` to a sample row carrying __sample:true.
    // Build the profile from the in-memory sample store; do not query
    // Supabase. Renders identically to the real path.
    if (client?.__sample) {
      const sampleProfile = buildSampleProfile(client.id);
      setProfile(sampleProfile);
      setLoading(false);
      return;
    }
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
  }, [client?.id, client?.__sample, therapistId, previewProfile]);

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

  const isSample = !!(profile?.client?.__sample || client?.__sample);

  return (
    <div style={{ background: C.cream }}>
      {isSample && (
        <div style={{
          background: '#FFF7ED',
          borderBottom: '1px dashed #F97316',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: F.sans,
        }}>
          <span style={{
            background: '#F97316',
            color: '#fff',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.12em',
            padding: '3px 7px',
            borderRadius: 4,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}>Sample</span>
          <span style={{ fontSize: 12.5, color: '#9A3412', lineHeight: 1.4 }}>
            A preview. Your real clients will look exactly like this.
          </span>
        </div>
      )}
      <ProfileHeader
        client={profile?.client || client}
        stats={profile?.stats}
        profile={profile}
        onBack={onBack}
        onEdit={() => setAboutPulse(n => n + 1)}
        onArchive={() => setArchiveTrigger(true)}
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

      {/* Status strip stays uncollapsible: balance + next + lifetime +
          agreement are too important to hide behind a click. */}
      {profile && <StatusStrip
        profile={profile}
        onAgreementTap={() => {
          // Force the Agreement section open and scroll to it. If
          // the agreement is unsigned, the user will see the
          // 'Send for signature' button in AgreementCard once it
          // expands. (TODO: deep-link directly into the
          // SendForSignaturePanel with client pre-fill, instead of
          // scrolling to the in-section button. Queued for next pass.)
          setOpenSections(s => ({ ...s, agreement: true }));
          // Defer scroll to next tick so the section has time to
          // render expanded before we measure its position.
          setTimeout(() => {
            const el = document.querySelector('[data-section-id="agreement"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }}
      />}

      {profile && (
        <div style={{ padding: '0 14px 24px' }}>

          {/* Client info: inline tap-to-edit fields wrapped in the
              same collapsible ProfileSection chrome the rest of the
              profile uses. Default closed so the SOAP work surface
              stays primary; tap the section header (or the hero
              pencil button, which triggers a pulse) to expand. */}
          <ProfileSection
            accent="about"
            order={0}
            title="Client info"
            trailingLabel={(profile.client?.email || profile.client?.phone)
              ? 'Name, email, phone, notes'
              : 'Add email or phone'}
            isOpen={openSections.about}
            onToggle={() => toggle('about')}
          >
            <AboutCard
              client={profile.client}
              pulse={aboutPulse}
              onUpdated={(payload) => {
                setProfile(p => p ? ({ ...p, client: { ...p.client, ...payload } }) : p);
              }}
            />
            {/* Quiet Archive affordance: lives at the bottom of the
                Client Info section so destructive actions sit next to
                the editing surface, not in the busy hero. */}
            <div style={{
              marginTop: 8,
              paddingTop: 12,
              borderTop: '1px solid #EEF2F7',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setArchiveTrigger(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent'; }}
              >
                Archive this client
              </button>
            </div>
          </ProfileSection>

          {/* Sessions and SOAP notes: moved to the top per HK request.
              This is the primary work surface for the therapist. */}
          <ProfileSection
            accent="soap"
            order={1}
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
              previewSessions={previewProfile ? profile.sessions : null}
              externalShowArchive={archiveTrigger}
              onExternalArchiveClose={() => setArchiveTrigger(false)}
              onEditClient={() => setAboutPulse(n => n + 1)}
            />
          </ProfileSection>

          <ProfileSection
            accent="patterns"
            order={2}
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
            order={3}
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
            order={4}
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
            accent="membership"
            order={5}
            title="Membership"
            trailingLabel="Active plans on file"
            isOpen={openSections.membership}
            onToggle={() => toggle('membership')}
          >
            <MembershipCard client={client} therapist={therapist} />
          </ProfileSection>

          <ProfileSection
            accent="agreement"
            order={6}
            title="Client agreement"
            dataSectionId="agreement"
            trailingLabel={client?.practice_agreement_signed_at
              ? `Signed ${new Date(client.practice_agreement_signed_at).toLocaleDateString()}`
              : 'No signature on file'}
            isOpen={openSections.agreement}
            onToggle={() => toggle('agreement')}
          >
            <AgreementCard client={client} therapist={therapist} />
          </ProfileSection>

          <ProfileSection
            accent="timeline"
            order={7}
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
