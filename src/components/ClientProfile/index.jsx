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
import { db, supabase } from '../../lib/supabase';
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
import DocumentsCard from './DocumentsCard';
import Timeline from './Timeline';
import SessionList from '../SessionList';

const C = {
  cream: '#FBF8F1',
  muted: '#98A395',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
};

export default function ClientProfile({ client, therapistId, therapist, onBack, onSelectSession, previewProfile = null, clientView = false }) {
  const [profile, setProfile] = useState(previewProfile);
  const [loading, setLoading] = useState(!previewProfile);

  // Open/closed state for each section. All sections default to open
  // so the page is fully informative on first visit; the therapist
  // can collapse what they don't need.
  const [openSections, setOpenSections] = useState(() => clientView
    ? { about: false, visits: false, soap: false, patterns: true, preferences: false, medical: false, membership: false, agreement: false, documents: false, timeline: false }
    : {
    about: false,
    soap: true,
    patterns: true,
    preferences: true,
    medical: true,
    membership: true,
    agreement: true,
    documents: true,
    timeline: true,
  });
  const toggle = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  // Live summary from the documents card, used to show an at-a-glance
  // "Consent on file" read on the collapsed section header.
  const [docSummary, setDocSummary] = useState({ count: 0, hasConsent: false });

  // Collapse all / expand all. The status strip stays put; this only
  // drives the collapsible sections below it.
  const anySectionOpen = Object.values(openSections).some(Boolean);
  const setAllSections = (open) => setOpenSections(s =>
    Object.keys(s).reduce((acc, k) => { acc[k] = open; return acc; }, {}));

  // Triggers from the ProfileHeader hero buttons. The Edit button
  // (hero pencil) flips a pulse flag on the AboutCard so the card
  // scrolls into view and softly highlights, telling the therapist
  // 'edit your client right here, inline'. No modal. Archive still
  // uses the legacy SessionList modal flow (separate UI cleanup).
  const [aboutPulse, setAboutPulse] = useState(0);
  // HK May 27 2026 Ship 1: triggers for hoisted action buttons in
  // ProfileHeader (Edit, Book, Merge). Each flips a boolean that
  // SessionList watches via its external-show prop pair, so the
  // existing modal code stays the single source of truth.
  // Archive is NO LONGER a SessionList trigger; it is an inline
  // confirmation row owned by ProfileHeader (see archiveClient below).
  const [editTrigger, setEditTrigger] = useState(false);
  const [rebookTrigger, setRebookTrigger] = useState(false);
  const [mergeTrigger, setMergeTrigger] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);

  // HK May 27 2026: archive / restore handlers. ProfileHeader hosts
  // the inline confirmation UI; this does the actual write. Reason
  // is one of the ARCHIVE_REASONS in ProfileHeader (including the
  // new 'Unprofessional' flag).
  const archiveClient = async (reason) => {
    const c = profile?.client || client;
    if (!c?.id || c.__sample) {
      // Sample clients: nothing to persist, just reflect locally.
      setProfile(p => p ? { ...p, client: { ...p.client, do_not_rebook: true, dnr_reason: reason } } : p);
      return;
    }
    setArchiveSaving(true);
    try {
      await supabase.from('clients')
        .update({ do_not_rebook: true, dnr_reason: reason })
        .eq('id', c.id);
      setProfile(p => p ? { ...p, client: { ...p.client, do_not_rebook: true, dnr_reason: reason } } : p);
    } catch (e) {
      console.error('archiveClient failed:', e);
    } finally {
      setArchiveSaving(false);
    }
  };

  const restoreClient = async () => {
    const c = profile?.client || client;
    if (!c?.id || c.__sample) {
      setProfile(p => p ? { ...p, client: { ...p.client, do_not_rebook: false, dnr_reason: null } } : p);
      return;
    }
    setArchiveSaving(true);
    try {
      await supabase.from('clients')
        .update({ do_not_rebook: false, dnr_reason: null })
        .eq('id', c.id);
      setProfile(p => p ? { ...p, client: { ...p.client, do_not_rebook: false, dnr_reason: null } } : p);
    } catch (e) {
      console.error('restoreClient failed:', e);
    } finally {
      setArchiveSaving(false);
    }
  };

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
        onBack={clientView ? undefined : onBack}
        onEdit={() => setAboutPulse(n => n + 1)}
        onEditClick={clientView ? undefined : () => setEditTrigger(true)}
        onBookClick={clientView ? undefined : () => setRebookTrigger(true)}
        onMergeClick={clientView ? undefined : () => setMergeTrigger(true)}
        onArchiveConfirm={clientView ? undefined : archiveClient}
        onRestoreConfirm={clientView ? undefined : restoreClient}
        archiveSaving={archiveSaving}
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
        docSummary={docSummary}
        clientView={clientView}
        onDocumentsTap={() => {
          setOpenSections(s => ({ ...s, documents: true }));
          setTimeout(() => {
            const el = document.querySelector('[data-section-id="documents"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }}
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

          {/* Collapse all / Expand all. Right-aligned, quiet, so a
              therapist can flatten the whole profile to scan headers
              or open it all back up in one tap. Therapist-only. */}
          {!clientView && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setAllSections(!anySectionOpen)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', padding: '4px 2px',
                cursor: 'pointer', fontFamily: F.sans, fontSize: 12.5, fontWeight: 700,
                color: '#6B7F72', letterSpacing: '0.02em',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: anySectionOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>
                <path d="M2 4l4 4 4-4" />
              </svg>
              {anySectionOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          )}

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
              readOnly={clientView}
              onUpdated={(payload) => {
                setProfile(p => p ? ({ ...p, client: { ...p.client, ...payload } }) : p);
              }}
            />
          </ProfileSection>

          {/* Client view only: visit history. The therapist sees visits
              inside the SOAP section (hidden from clients), so the client
              gets a plain dated list of their upcoming and past visits. */}
          {clientView && (() => {
            const today = new Date().toISOString().slice(0, 10);
            const all = (profile.bookings || []).slice().sort((a, b) => (b.booking_date || '').localeCompare(a.booking_date || ''));
            const up = all.filter(b => (b.booking_date || '') >= today).reverse();
            const pastV = all.filter(b => (b.booking_date || '') < today).slice(0, 12);
            const fmtV = (b) => {
              let d = b.booking_date || '';
              try { d = new Date(b.booking_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) {}
              return d;
            };
            const svc = (b) => b.service?.name || b.service_name || 'Session';
            const VRow = ({ b }) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid #EFE7D2' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1C2B22' }}>{fmtV(b)}</span>
                <span style={{ fontSize: 13, color: '#8A9C90' }}>{svc(b)}</span>
              </div>
            );
            return (
              <ProfileSection accent="visits" order={0} title="Your visits"
                trailingLabel={up.length ? `${up.length} upcoming` : 'Past visits'}
                isOpen={!!openSections.visits} onToggle={() => toggle('visits')}>
                {(up.length === 0 && pastV.length === 0)
                  ? <p style={{ fontSize: 14, color: '#6B7F72', margin: '6px 0' }}>No visits yet.</p>
                  : (<>
                      {up.length > 0 && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A9C90', margin: '2px 0 2px' }}>Upcoming</div>}
                      {up.map(b => <VRow key={b.id} b={b} />)}
                      {pastV.length > 0 && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A9C90', margin: '14px 0 2px' }}>Past</div>}
                      {pastV.map(b => <VRow key={b.id} b={b} />)}
                    </>)}
              </ProfileSection>
            );
          })()}

          {/* Sessions and SOAP notes: moved to the top per HK request.
              This is the primary work surface for the therapist.
              Therapist-only: never rendered in the client view. */}
          {!clientView && (
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
              externalShowEdit={editTrigger}
              onExternalEditClose={() => setEditTrigger(false)}
              externalShowRebook={rebookTrigger}
              onExternalRebookClose={() => setRebookTrigger(false)}
              externalShowMerge={mergeTrigger}
              onExternalMergeClose={() => setMergeTrigger(false)}
              onEditClient={() => setAboutPulse(n => n + 1)}
            />
          </ProfileSection>
          )}

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

          {!clientView && (
          <ProfileSection
            accent="membership"
            order={5}
            title="Memberships & Packages"
            dataSectionId="memberships-packages"
            trailingLabel="What this client has bought"
            isOpen={openSections.membership}
            onToggle={() => toggle('membership')}
          >
            <MembershipCard client={client} therapist={therapist} />
          </ProfileSection>
          )}

          <ProfileSection
            accent="agreement"
            order={6}
            title="Client agreement"
            dataSectionId="agreement"
            trailingLabel={(clientView ? profile.client : client)?.practice_agreement_signed_at
              ? `Signed ${new Date((clientView ? profile.client : client).practice_agreement_signed_at).toLocaleDateString()}`
              : 'No signature on file'}
            isOpen={openSections.agreement}
            onToggle={() => toggle('agreement')}
          >
            <AgreementCard client={clientView ? profile.client : client} therapist={therapist} clientView={clientView} />
          </ProfileSection>

          {!clientView && (
          <ProfileSection
            accent="documents"
            order={7}
            title="Forms and documents"
            dataSectionId="documents"
            trailingLabel={docSummary.hasConsent
              ? 'Consent on file'
              : (docSummary.count > 0
                  ? `${docSummary.count} document${docSummary.count === 1 ? '' : 's'}`
                  : 'Consent, intake, paperwork')}
            count={docSummary.count > 0 ? docSummary.count : undefined}
            isOpen={openSections.documents}
            onToggle={() => toggle('documents')}
          >
            <DocumentsCard
              client={client}
              therapist={therapist}
              readOnly={!!previewProfile}
              onSummary={setDocSummary}
              onClientUpdated={(payload) => {
                setProfile(p => p ? ({ ...p, client: { ...p.client, ...payload } }) : p);
              }}
            />
          </ProfileSection>

          )}

          {!clientView && (
          <ProfileSection
            accent="timeline"
            order={8}
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
          )}

        </div>
      )}
    </div>
  );
}
