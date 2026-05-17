// src/components/booking/ClientPushCTA.jsx
//
// Banner shown on the booking-confirmed screen offering to enable
// session reminders via PWA push notifications. The only entry point
// for client push subscriptions in v1.
//
// HK May 17 2026 ~6:30am: shipping this so the C-Push column in
// the Notification Compliance Dashboard can be tested in the same
// run as the rest of the matrix.
//
// UX flow:
//   1. Booking-confirmed screen renders, banner shows below the
//      intake-form CTA (only if browser supports push)
//   2. Client taps "Enable session reminders"
//   3. Browser prompts for notification permission
//   4. On grant: subscription row inserted into client_push_subscriptions
//   5. Banner morphs to "✓ Reminders on" with an undo link
//
// Identity:
//   We receive therapistId + clientEmail as props. We resolve the
//   client_id by looking up the (therapist_id, email) pair. If
//   multiple client rows exist for the same email under the same
//   therapist (duplicate-row bug), we use the most recent. The
//   matching client row must exist before this banner renders,
//   so we wait for the lookup to complete.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import useClientPushNotifications from '../../hooks/useClientPushNotifications';

const C = {
  forest: '#2A5741',
  forestDeep: '#1F4030',
  sage: '#6B9E80',
  cream: '#FBFAF4',
  border: '#E8E4DC',
  ink: '#1F2937',
  inkSoft: '#6B7280',
  inkFade: '#9CA3AF',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  rose: '#C77B8A',
  roseSoft: '#FDF2F4',
};

export default function ClientPushCTA({ therapistId, clientEmail, therapistFirstName }) {
  const [clientId, setClientId] = useState(null);
  const [resolved, setResolved] = useState(false);

  // Resolve client_id from (therapist_id, email)
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!therapistId || !clientEmail) {
        setResolved(true);
        return;
      }
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('therapist_id', therapistId)
        .ilike('email', clientEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setClientId(data?.id || null);
        setResolved(true);
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [therapistId, clientEmail]);

  const push = useClientPushNotifications({ therapistId, clientId });

  // Don't render at all if browser doesn't support push, or we
  // haven't resolved the client yet, or no client row exists.
  if (!resolved) return null;
  if (!clientId) return null;
  if (!push.supported) return null;

  // Already subscribed: confirmation pill with undo
  if (push.subscribed) {
    return (
      <div style={{
        background: C.greenSoft,
        border: `1.5px solid #86EFAC`,
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: C.green, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>✓</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#14532D', marginBottom: 2 }}>
            Reminders are on
          </div>
          <div style={{ fontSize: 12, color: '#15803D', lineHeight: 1.4 }}>
            You'll get a notification before your session and if anything changes.
          </div>
        </div>
        <button
          type="button"
          onClick={() => push.unsubscribe()}
          disabled={push.loading}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#15803D',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 4,
            flexShrink: 0,
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
          }}>
          Turn off
        </button>
      </div>
    );
  }

  // Permission denied: render nothing rather than show an error
  // (the client made a clear choice; respect it)
  if (push.permission === 'denied') return null;

  // Default state: the subscribe CTA
  const firstName = therapistFirstName || 'your therapist';
  return (
    <div style={{
      background: C.roseSoft,
      border: `1.5px solid #F9C5D1`,
      borderRadius: 14,
      padding: '18px 20px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#fff', border: `1.5px solid #F9C5D1`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>🔔</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.forestDeep, marginBottom: 4 }}>
            Get reminders for your sessions
          </div>
          <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
            Tap below to get a quiet ping on your phone before each session, plus a heads up if {firstName} ever needs to reschedule. You can turn this off anytime.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => push.subscribe()}
        disabled={push.loading}
        style={{
          width: '100%',
          background: push.loading ? C.inkSoft : `linear-gradient(135deg, ${C.forestDeep}, ${C.forest})`,
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '13px 20px',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.01em',
          cursor: push.loading ? 'wait' : 'pointer',
          boxShadow: push.loading ? 'none' : '0 2px 8px rgba(42, 87, 65, 0.2)',
        }}>
        {push.loading ? 'Setting up…' : 'Enable session reminders'}
      </button>
      {push.error && (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          color: '#991B1B',
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: 8,
          padding: '8px 12px',
          fontStyle: 'italic',
          fontFamily: 'Georgia, serif',
        }}>
          Could not turn on reminders: {push.error}
        </div>
      )}
    </div>
  );
}
