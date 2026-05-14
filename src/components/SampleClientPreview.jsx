// src/components/SampleClientPreview.jsx
//
// Modal preview shown when a new therapist (no real clients yet)
// taps one of the sample-client cards on the Clients tab. Renders a
// READ-ONLY ClientProfile populated with Sarah Chen's pre-built
// demo data (5 sessions, real SOAP notes, body-map patterns,
// preferences, conditions, the works).
//
// Why this exists:
//   A new therapist signs up and the Clients tab is empty by
//   design. We show sample cards so the page isn't blank, but those
//   cards used to be visual-only with no click affordance. This
//   modal lets the therapist tap any sample card and see what a
//   real, populated client profile will look like once they have
//   clients of their own.
//
// Data: pulls from src/data/demoSarahChen.js (the canonical demo
// dataset already used by /founder/seed-demo). We transform the
// raw DEMO_SESSIONS into the shape that ClientProfile expects
// (matching what db.getClientProfile() would return), then pass
// it in via the new previewProfile prop.
//
// Session click handling: when the therapist taps a session row in
// the timeline or sessions list, we open a NESTED modal showing
// the Four-Document Journey filled in for that session.

import React, { useMemo, useState } from 'react';
import { DEMO_CLIENT, DEMO_SESSIONS } from '../data/demoSarahChen';
import ClientProfile from './ClientProfile';
import DocumentJourney from './DocumentJourney';

const PALETTE = {
  forest: '#1F3A2C',
  paper: '#FFFFFF',
  cream: '#FBF8F1',
  lineFaint: '#E8E0D0',
  muted: '#8A9C90',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

/**
 * Builds the profile object that ClientProfile expects, using a
 * sample-client identity overlay on top of Sarah's session data.
 *
 * The sample cards on ClientList use display names like 'Sarah
 * Mitchell', 'Dana Park', etc. We swap the displayed name + initials
 * but keep all of Sarah's session content as the body so the
 * preview is rich regardless of which card was tapped.
 */
function buildPreviewProfile(sampleClient) {
  // Sort sessions by created_at descending so getClientProfile's
  // assumptions about ordering hold.
  const sessions = [...DEMO_SESSIONS].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Synthesize bookings from sessions (real getClientProfile pulls
  // these as a separate join). Each booking matches a session date
  // and a default service.
  const bookings = sessions.map((s, i) => ({
    id: `preview-bk-${i}`,
    client_id: DEMO_CLIENT.id,
    booking_date: s.created_at.slice(0, 10),
    start_time: '10:00:00',
    end_time: '11:00:00',
    status: 'completed',
    service: { name: 'Therapeutic Massage 60', price: 140, duration: 60 },
  }));

  // Build pattern aggregation across all sessions, same approach as
  // getClientProfile.
  const countZones = (field) => {
    const counts = new Map();
    for (const s of sessions) {
      const arr = Array.isArray(s[field]) ? s[field] : [];
      for (const z of arr) counts.set(z, (counts.get(z) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  };

  const topFrontZones = countZones('front_focus');
  const topBackZones = countZones('back_focus');
  const topAvoidZones = [...countZones('front_avoid'), ...countZones('back_avoid')]
    .sort((a, b) => b.count - a.count).slice(0, 3);

  const latest = sessions.find(s => s.completed) || sessions[0];

  // Medical flags from session medical_conditions arrays
  const medicalFlags = [];
  const seen = new Set();
  for (const s of sessions) {
    const conditions = Array.isArray(s.medical_conditions) ? s.medical_conditions : [];
    for (const c of conditions) {
      if (c && !seen.has(c)) {
        seen.add(c);
        medicalFlags.push({ type: 'condition', text: c });
      }
    }
  }

  const lastVisitDate = bookings[0]?.booking_date || null;
  const daysSinceVisit = lastVisitDate
    ? Math.floor((Date.now() - new Date(lastVisitDate + 'T00:00:00Z').getTime()) / 86400000)
    : null;

  return {
    client: {
      id: 'sample-' + sampleClient.id,
      name: sampleClient.full_name,
      email: 'sample@mybodymap.app',
      phone: null,
      created_at: bookings[bookings.length - 1]?.booking_date || null,
    },
    bookings,
    sessions,
    packagePurchases: [],
    memberSubscriptions: [],
    giftCertificates: [],
    stats: {
      lifetimeSessions: bookings.length,
      lifetimeCompletedSessions: bookings.length,
      lifetimeEarnings: bookings.length * 140,
      lastVisitDate,
      daysSinceVisit,
      nextBooking: null,
      pendingIntake: null,
    },
    patterns: { topFrontZones, topBackZones, topAvoidZones },
    preferences: latest ? {
      pressure: latest.pressure,
      goal: latest.goal,
      table_temp: latest.table_temp,
      room_temp: latest.room_temp,
      music: latest.music,
      lighting: latest.lighting,
      conversation: latest.conversation,
      draping: latest.draping,
      oil_pref: latest.oil_pref,
    } : null,
    medicalFlags,
  };
}

export default function SampleClientPreview({ sampleClient, onClose }) {
  const profile = useMemo(() => buildPreviewProfile(sampleClient), [sampleClient]);
  const [docSession, setDocSession] = useState(null);

  // Lock body scroll while modal is open so background doesn't
  // shift while interacting with the preview.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sample client preview"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 18, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 0',
        overflowY: 'auto',
      }}
    >
      <div style={{
        background: PALETTE.cream,
        borderRadius: 16,
        maxWidth: 760,
        width: 'calc(100% - 24px)',
        boxShadow: '0 24px 80px rgba(15, 23, 18, 0.35)',
        overflow: 'hidden',
        position: 'relative',
        animation: 'bm-modal-rise 0.32s cubic-bezier(0.2, 0.6, 0.2, 1)',
      }}>
        <style>{`
          @keyframes bm-modal-rise {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Preview banner */}
        <div style={{
          background: '#FFF7ED',
          borderBottom: '1px dashed #F97316',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: F.sans,
        }}>
          <span style={{
            background: '#F97316',
            color: '#fff',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.12em',
            padding: '3px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
          }}>Sample</span>
          <span style={{ fontSize: 12.5, color: '#9A3412', flex: 1, lineHeight: 1.4 }}>
            This is a preview using sample data. Your real clients will look like this once they start booking.
          </span>
          <button
            onClick={onClose}
            aria-label="Close preview"
            style={{
              background: 'rgba(15,23,18,0.06)',
              border: 'none',
              borderRadius: 999,
              width: 28, height: 28,
              cursor: 'pointer',
              fontSize: 16,
              color: '#9A3412',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Render the full ClientProfile with preview data.
            onSelectSession routes to a nested document preview instead
            of the real router navigation. */}
        <ClientProfile
          client={profile.client}
          therapistId={'preview'}
          therapist={null}
          onBack={onClose}
          onSelectSession={(session) => setDocSession(session)}
          previewProfile={profile}
        />
      </div>

      {/* Nested modal: four-document journey for the chosen session */}
      {docSession && (
        <DocumentPreview
          session={docSession}
          clientName={sampleClient.full_name}
          onClose={() => setDocSession(null)}
        />
      )}
    </div>
  );
}

/**
 * Nested modal showing the four-document journey + per-document
 * detail preview for a single sample session.
 */
function DocumentPreview({ session, clientName, onClose }) {
  const [activeDoc, setActiveDoc] = useState(null);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Parse SOAP from session.therapist_notes (same parser used by
  // DocumentJourney itself).
  const soap = (() => {
    try {
      const p = JSON.parse(session.therapist_notes || '');
      if (p && p.__soap) return p;
    } catch (e) {}
    return { S: '', O: '', A: '', P: '', noteToClient: '', aftercare: [] };
  })();

  const sessionDate = new Date(session.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 18, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 0',
        overflowY: 'auto',
      }}
    >
      <div style={{
        background: PALETTE.paper,
        borderRadius: 14,
        maxWidth: 700,
        width: 'calc(100% - 24px)',
        boxShadow: '0 24px 80px rgba(15, 23, 18, 0.4)',
        overflow: 'hidden',
        animation: 'bm-modal-rise 0.32s cubic-bezier(0.2, 0.6, 0.2, 1)',
      }}>
        <div style={{
          padding: '16px 18px',
          borderBottom: `1px solid ${PALETTE.lineFaint}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: PALETTE.muted,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 2,
              fontFamily: F.sans,
            }}>
              Session record
            </div>
            <div style={{
              fontFamily: F.serif,
              fontWeight: 700,
              fontSize: 18,
              color: PALETTE.forest,
              lineHeight: 1.2,
            }}>
              {clientName}
              <span style={{
                fontFamily: F.sans, fontStyle: 'italic', fontWeight: 500,
                fontSize: 13, color: PALETTE.muted, marginLeft: 8,
              }}>
                {sessionDate}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(15,23,18,0.06)',
              border: 'none',
              borderRadius: 999,
              width: 32, height: 32,
              cursor: 'pointer',
              fontSize: 16,
              color: PALETTE.muted,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '14px 16px 18px' }}>
          {/* Use the real DocumentJourney UI; pass a navigate handler
              that opens our doc preview pane instead of routing. */}
          <DocumentJourney
            session={session}
            onSelect={(n) => {
              // n is 1..4 mapping to intake/pre/record/recap
              const kinds = { 1: 'intake', 2: 'pre', 3: 'record', 4: 'recap' };
              setActiveDoc(kinds[n] || null);
            }}
          />

          {activeDoc && (
            <DocPanel
              kind={activeDoc}
              session={session}
              soap={soap}
              onClose={() => setActiveDoc(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline panel under the journey that shows the content of one
 * chosen document. Renders a faithful but compact summary of what
 * each document holds, so a new therapist can see the four-document
 * concept come to life.
 */
function DocPanel({ kind, session, soap, onClose }) {
  const titles = {
    intake: 'Intake',
    pre: 'Pre-Session Brief',
    record: 'Session Record',
    recap: 'Client Recap',
  };
  const eyebrows = {
    intake: 'Filled by client',
    pre: 'Auto-generated from intake',
    record: 'Written by you',
    recap: 'Sent to client after',
  };

  return (
    <div style={{
      marginTop: 16,
      padding: 16,
      background: PALETTE.cream,
      border: `1px solid ${PALETTE.lineFaint}`,
      borderRadius: 12,
      animation: 'bm-modal-rise 0.25s cubic-bezier(0.2, 0.6, 0.2, 1)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: PALETTE.muted,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontFamily: F.sans,
          }}>
            {eyebrows[kind]}
          </div>
          <div style={{
            fontFamily: F.serif,
            fontWeight: 700,
            fontSize: 17,
            color: PALETTE.forest,
            marginTop: 2,
          }}>
            {titles[kind]}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: PALETTE.muted,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: F.sans,
            fontWeight: 600,
            textDecoration: 'underline',
          }}
        >
          Close
        </button>
      </div>

      {kind === 'intake' && <IntakeContent session={session} />}
      {kind === 'pre' && <PreContent session={session} soap={soap} />}
      {kind === 'record' && <RecordContent session={session} soap={soap} />}
      {kind === 'recap' && <RecapContent session={session} soap={soap} />}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: PALETTE.muted,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 3,
        fontFamily: F.sans,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13.5,
        color: PALETTE.forest,
        fontFamily: F.sans,
        lineHeight: 1.5,
      }}>
        {children}
      </div>
    </div>
  );
}

function IntakeContent({ session }) {
  const goal = session.goal || '—';
  const pressure = session.pressure || '—';
  const conditions = Array.isArray(session.medical_conditions) ? session.medical_conditions : [];
  const intakeAnswers = session.intake_answers || {};
  const front = (session.front_focus || []).length;
  const back = (session.back_focus || []).length;
  return (
    <div>
      <Field label="Today's goal">{goal}</Field>
      <Field label="Pressure">{pressure}/5</Field>
      <Field label="Body map">
        {front + back} zones marked for focus
      </Field>
      {conditions.length > 0 && (
        <Field label="Conditions">{conditions.join(' · ')}</Field>
      )}
      {Object.entries(intakeAnswers).slice(0, 4).map(([k, v]) => (
        <Field key={k} label={k}>{String(v)}</Field>
      ))}
    </div>
  );
}

function PreContent({ session, soap }) {
  return (
    <div>
      <Field label="Today's request">
        {session.goal || 'Maintenance and recovery'}, pressure {session.pressure || '—'}/5
      </Field>
      <Field label="What's recurring">
        Right shoulder + lower back showed up in the previous 3 visits. Headaches noted in visit 3, now intermittent.
      </Field>
      <Field label="Plan from last visit">
        Deep tissue right side, avoid neck flexion. Recommended evening stretches.
      </Field>
      <Field label="Heads up">
        Pressure preference has climbed from 2/5 to {session.pressure || '4'}/5 over the last 5 visits.
      </Field>
    </div>
  );
}

function RecordContent({ session, soap }) {
  return (
    <div>
      <Field label="Subjective">{soap.S || 'Client reports tension in upper back and shoulders.'}</Field>
      <Field label="Objective">{soap.O || 'Hypertonicity bilateral upper trapezius, restricted ROM cervical.'}</Field>
      <Field label="Assessment">{soap.A || 'Stress-related muscular tension, no contraindications.'}</Field>
      <Field label="Plan">{soap.P || 'Deep tissue focus on upper back. Recommend stretches.'}</Field>
    </div>
  );
}

function RecapContent({ session, soap }) {
  return (
    <div>
      <Field label="Note to client">
        {soap.noteToClient || 'Thank you for trusting me with your care today. I focused on releasing tension in your shoulders and lower back; you mentioned both have been bothering you. Try to hydrate well today and tomorrow.'}
      </Field>
      <Field label="Aftercare">
        Hydrate · Gentle stretching · Warm bath if sore tonight
      </Field>
      <Field label="Rebooking">
        Suggested cadence: 2 weeks. One-tap rebook link sent with the recap.
      </Field>
    </div>
  );
}
