// src/pages/StripeConnectStandard.js
//
// Callback page for Standard Connect OAuth. Stripe redirects here
// after the therapist authorizes MyBodyMap on their existing
// Stripe account. URL shape: ?code=ac_xxx&state=<therapist_id>
//
// We call the complete_standard_oauth edge function action which
// exchanges the code for the connected account ID, stamps our
// therapist row, and returns success.
//
// Mirrors the StripeConnect.js shape (success / refresh / error
// states) so the UI feels identical to the Express return.
//
// HK May 15-16 2026: Standard Connect alongside Express for solo
// LMTs who already have a Stripe account.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://rmnqfrljoknmellbnpiy.supabase.co';

const C = {
  forest: '#2A5741',
  sage:   '#6B9E80',
  beige:  '#F5F0E8',
  white:  '#FFFFFF',
  dark:   '#1A1A2E',
  gray:   '#6B7280',
  light:  '#E8E4DC',
  green:  '#16A34A',
  greenBg:'#F0FDF4',
};

const FEATURES_UNLOCKED = [
  { icon: '💳', title: 'Online deposits',  desc: 'Clients pay a deposit at booking time. You set the amount per service.' },
  { icon: '🔒', title: 'Card on file',     desc: 'Save a card at booking. Charged only if your cancellation policy triggers.' },
  { icon: '↩️',  title: 'One-tap refunds',  desc: 'Refund any charge from your billing dashboard. No need to log into Stripe.' },
  { icon: '📅', title: 'Memberships and packages', desc: 'Sell recurring monthly memberships and prepaid session packages.' },
  { icon: '🎁', title: 'Gift certificates',desc: 'Sell gift certificates from your booking page.' },
];

export default function StripeConnectStandard() {
  const [status, setStatus] = useState('connecting');
  const [statusReason, setStatusReason] = useState(null);
  const [missingRequirements, setMissingRequirements] = useState([]);
  const { therapist } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');

    // The therapist might have cancelled the OAuth flow on Stripe's
    // side, in which case Stripe returns ?error=access_denied
    if (errorParam) {
      setStatusReason(errorDescription || errorParam);
      setStatus('error');
      return;
    }
    if (code && state) {
      completeOAuth(code, state);
    } else {
      setStatus('error');
      setStatusReason('Missing code or state in the Stripe callback. Try connecting again.');
    }
  }, []);

  const completeOAuth = async (code, state) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: 'complete_standard_oauth',
          code,
          therapist_id: state,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
        return;
      }
      if (data.status === 'standard_account_incomplete') {
        setStatusReason(data.error);
        setMissingRequirements(data.requirements_currently_due || []);
        setStatus('incomplete');
        return;
      }
      setStatusReason(data.error || 'Could not complete the Stripe connection.');
      setStatus('error');
    } catch (e) {
      setStatusReason(String(e?.message || e));
      setStatus('error');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: C.beige,
      fontFamily: 'system-ui, sans-serif',
      padding: '40px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
    }}>
      <div style={{
        background: C.white,
        borderRadius: 20,
        padding: '40px 32px',
        maxWidth: 520,
        width: '100%',
        boxShadow: '0 8px 40px rgba(28, 43, 34, 0.10)',
      }}>
        {status === 'connecting' && <ConnectingState />}
        {status === 'success' && <SuccessState navigate={navigate} />}
        {status === 'incomplete' && <IncompleteState navigate={navigate} reason={statusReason} missing={missingRequirements} />}
        {status === 'error' && <ErrorState navigate={navigate} reason={statusReason} />}
      </div>
    </div>
  );
}

function ConnectingState() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>⏳</div>
      <h1 style={{
        fontFamily: 'Georgia, serif',
        fontSize: 22,
        fontWeight: 700,
        color: C.dark,
        margin: '0 0 8px',
      }}>
        Linking your Stripe account
      </h1>
      <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
        Just a moment.
      </p>
    </div>
  );
}

function SuccessState({ navigate }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: 32,
          background: C.greenBg,
          border: `2px solid ${C.green}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          marginBottom: 14,
        }}>
          ✓
        </div>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 24,
          fontWeight: 700,
          color: C.forest,
          margin: '0 0 8px',
          lineHeight: 1.2,
        }}>
          Your Stripe account is linked
        </h1>
        <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
          We connected your existing Stripe account, no new accounts created. Here is what just turned on.
        </p>
      </div>

      <div style={{
        background: C.greenBg,
        border: `1px solid ${C.green}33`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 22,
      }}>
        {FEATURES_UNLOCKED.map((feature, idx) => (
          <div key={feature.title} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            paddingTop: idx === 0 ? 0 : 12,
            paddingBottom: idx === FEATURES_UNLOCKED.length - 1 ? 0 : 12,
            borderBottom: idx < FEATURES_UNLOCKED.length - 1 ? `1px solid ${C.green}22` : 'none',
          }}>
            <div style={{ fontSize: 18, flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {feature.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 2 }}>
                {feature.title}
              </div>
              <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.5 }}>
                {feature.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => navigate('/dashboard')} style={{
          background: C.forest,
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '13px 20px',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}>
          Continue setup →
        </button>
        <button onClick={() => navigate('/dashboard/billing')} style={{
          background: 'transparent',
          color: C.forest,
          border: `1.5px solid ${C.light}`,
          borderRadius: 12,
          padding: '12px 20px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          Go straight to billing dashboard
        </button>
      </div>
    </div>
  );
}

function IncompleteState({ navigate, reason, missing }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>🔄</div>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 22,
          fontWeight: 700,
          color: C.dark,
          margin: '0 0 8px',
        }}>
          Account linked, finish setup in Stripe
        </h1>
        <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
          {reason}
        </p>
      </div>

      {missing.length > 0 && (
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #FCD34D',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
          fontSize: 13,
          color: '#78350F',
          lineHeight: 1.6,
        }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>Stripe still needs:</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {missing.map((item, i) => <li key={i} style={{ marginBottom: 3 }}>{item}</li>)}
          </ul>
        </div>
      )}

      <div style={{
        background: '#F0FDF4',
        border: '1px solid #BBF7D0',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 22,
        fontSize: 12,
        color: '#065F46',
        lineHeight: 1.55,
      }}>
        <strong>The good news:</strong> Your account is linked. Once you finish these items in your Stripe dashboard, payment processing on MyBodyMap activates automatically.
      </div>

      <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" style={{
        display: 'block',
        background: C.forest,
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        padding: '13px 20px',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'center',
        textDecoration: 'none',
        marginBottom: 10,
      }}>
        Open Stripe Dashboard →
      </a>
      <button onClick={() => navigate('/dashboard/settings#payments')} style={{
        background: 'transparent',
        color: C.gray,
        border: 'none',
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        width: '100%',
        textDecoration: 'underline',
      }}>
        Back to Settings
      </button>
    </div>
  );
}

function ErrorState({ navigate, reason }) {
  // 'access_denied' means the therapist cancelled on Stripe's
  // OAuth screen. Most common cause: they did not see their
  // expected account in the Select account picker. That can
  // happen if their existing Stripe account was created by
  // another platform via Express (Stripe-Connect Express
  // accounts are owned by the platform that created them, not
  // listable in a Standard OAuth picker). The right answer for
  // them is the Express path: have us create a new Stripe
  // account under our platform.
  const isCancelled = (reason || '').toLowerCase().includes('access_denied') ||
                      (reason || '').toLowerCase().includes('cancelled') ||
                      (reason || '').toLowerCase().includes('denied');
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>⚠️</div>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 22,
          fontWeight: 700,
          color: C.dark,
          margin: '0 0 8px',
        }}>
          {isCancelled ? 'No account selected' : 'Could not link Stripe'}
        </h1>
        <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
          {isCancelled
            ? 'You cancelled or did not see your account in the Stripe selection screen. Most common reason: your existing Stripe account was created by another booking platform, in which case it will not appear here.'
            : (reason || 'Something went wrong. Your account is safe, nothing has been charged.')}
        </p>
      </div>

      {isCancelled && (
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #FCD34D',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
          fontSize: 13,
          color: '#78350F',
          lineHeight: 1.6,
        }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>Two ways forward:</strong>
          <div style={{ marginBottom: 8 }}><strong>1.</strong> You expected to see your Stripe account but did not. This usually means it was created by another platform like MassageBook, Vagaro, Squarespace, or similar. Those accounts cannot be re-linked elsewhere by design. Solution: set up a fresh MyBodyMap Stripe account below.</div>
          <div><strong>2.</strong> You changed your mind. Tap Try again to return to the linking screen.</div>
        </div>
      )}

      {!isCancelled && (
        <div style={{
          background: '#FEE2E2',
          border: '1px solid #FECACA',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 22,
          fontSize: 13,
          color: '#7F1D1D',
          lineHeight: 1.6,
        }}>
          <strong>What to try:</strong> Go back to Settings and try the connect flow again. If it keeps failing, email us at hello@mybodymap.app.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isCancelled && (
          <button onClick={() => navigate('/dashboard/settings#payments')} style={{
            background: C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '13px 20px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            Back to Settings to set up a new account
          </button>
        )}
        {!isCancelled && (
          <button onClick={() => navigate('/dashboard/settings#payments')} style={{
            background: C.forest,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '13px 20px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            Try again
          </button>
        )}
        <a href="mailto:hello@mybodymap.app?subject=Stripe%20Connect%20issue" style={{
          background: 'transparent',
          color: C.forest,
          border: `1.5px solid ${C.light}`,
          borderRadius: 12,
          padding: '12px 20px',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          textAlign: 'center',
        }}>
          Email us for help
        </a>
      </div>
    </div>
  );
}
