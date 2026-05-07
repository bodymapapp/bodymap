// src/pages/StripeConnect.js
//
// Stripe Connect return page - polished May 7, 2026 per HK direction.
//
// Previous version showed bare 'Stripe Connected!' + auto-redirect.
// New version is the moment of truth for the therapist: they just
// completed a multi-step external flow (identity verification, bank
// linking) and deserve a clear acknowledgement of what just unlocked
// in their MyBodyMap account.
//
// New states:
//   - connecting: brief loading state (unchanged)
//   - success:    rich state listing what just turned on, two paths
//                 forward (back to settings or continue setup checklist)
//   - refresh:    setup incomplete, clearer language about what to do
//   - error:      something went wrong, with actual recovery steps

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
  { icon: '💳', title: 'Online deposits', desc: 'Clients pay a deposit at booking time. You set the amount per service.' },
  { icon: '🔒', title: 'Card on file', desc: 'Save a card at booking. Charged automatically only if your cancellation policy triggers.' },
  { icon: '↩️',  title: 'One-tap refunds', desc: 'Refund any charge from your billing dashboard. No need to log into Stripe.' },
  { icon: '📅', title: 'Memberships and packages', desc: 'Sell recurring monthly memberships and prepaid session packages.' },
  { icon: '🎁', title: 'Gift certificates', desc: 'Sell gift certificates from your booking page.' },
];

export default function StripeConnect() {
  const [status, setStatus] = useState('connecting');
  const { therapist } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const refresh = params.get('refresh');
    const accountId = params.get('account_id');
    const therapistId = params.get('therapist_id');

    if (refresh) { setStatus('refresh'); return; }
    if (success && accountId) {
      confirmConnection(therapistId || therapist?.id);
    } else {
      setStatus('error');
    }
  }, [therapist]);

  const confirmConnection = async (tid) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'confirm_connected', therapist_id: tid }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
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
        {status === 'refresh' && <RefreshState navigate={navigate} />}
        {status === 'error' && <ErrorState navigate={navigate} />}
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
        Connecting Stripe
      </h1>
      <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
        Just a moment. Setting up your payment account.
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
          You are connected
        </h1>
        <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
          Stripe is set up. Here is what just turned on for you.
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
            <div style={{
              fontSize: 18,
              flexShrink: 0,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {feature.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.dark,
                marginBottom: 2,
              }}>
                {feature.title}
              </div>
              <div style={{
                fontSize: 12,
                color: C.gray,
                lineHeight: 1.5,
              }}>
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

function RefreshState({ navigate }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{
          fontSize: 44, marginBottom: 14,
        }}>🔄</div>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 22,
          fontWeight: 700,
          color: C.dark,
          margin: '0 0 8px',
        }}>
          Setup not finished
        </h1>
        <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
          Stripe needs a few more steps. Common reasons: identity verification incomplete, or bank account not linked yet.
        </p>
      </div>

      <div style={{
        background: '#FEF3C7',
        border: '1px solid #FCD34D',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 22,
        fontSize: 13,
        color: '#78350F',
        lineHeight: 1.6,
      }}>
        <strong>What to do next:</strong> Try connecting again. Stripe will pick up where you left off. You should not have to redo anything you already completed.
      </div>

      <button onClick={() => navigate('/dashboard/settings#payments')} style={{
        background: C.forest,
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        padding: '13px 20px',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        width: '100%',
      }}>
        Try connecting again →
      </button>
    </div>
  );
}

function ErrorState({ navigate }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{
          fontSize: 44, marginBottom: 14,
        }}>⚠️</div>
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 22,
          fontWeight: 700,
          color: C.dark,
          margin: '0 0 8px',
        }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
          We could not confirm the Stripe connection. Your account is safe; nothing has been charged.
        </p>
      </div>

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
        <strong>What to try:</strong> Go back to Settings and try Connect Stripe again. If the problem keeps happening, email Joy at hello@mybodymap.app and we will help.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          Email Joy for help
        </a>
      </div>
    </div>
  );
}
