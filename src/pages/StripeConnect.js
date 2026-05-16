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

  const [statusReason, setStatusReason] = useState(null);
  const [missingRequirements, setMissingRequirements] = useState([]);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const refresh = params.get('refresh');
    const accountId = params.get('account_id');
    const therapistId = params.get('therapist_id');

    if (refresh) {
      // Stripe sends users here via refresh_url when their Account
      // Link session has expired or Stripe wants to interrupt the
      // flow (SMS verification, additional document upload, etc).
      // The correct response per Stripe docs is to immediately
      // generate a fresh Account Link and send them back. NOT to
      // show a UI page. Showing a UI here was the source of the
      // 'it takes me back here every time' loop reported by HK and
      // Candice on May 15 2026.
      autoResume(therapist?.id);
      return;
    }
    if (success && accountId) {
      confirmConnection(therapistId || therapist?.id);
    } else {
      setStatus('error');
    }
  }, [therapist]);

  // Generates a new Account Link for the existing account and
  // redirects in the same tab. Used both for the user-visible
  // 'Resume' button on RefreshState and as the automatic handler
  // when Stripe hits our refresh_url.
  const autoResume = async (tid) => {
    if (!tid) {
      setStatusReason('Could not identify your therapist account.');
      setStatus('error');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'resume_onboarding', therapist_id: tid }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setStatusReason(data.error || 'Could not resume Stripe setup.');
      setStatus('refresh');
    } catch (e) {
      setStatusReason(String(e?.message || e));
      setStatus('refresh');
    }
  };

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
        return;
      }
      // The edge function now returns a precise status code so we
      // can show the right state. 'onboarding_incomplete' is the
      // common one: account exists but Stripe needs more info.
      if (data.status === 'onboarding_incomplete') {
        setStatusReason(data.error || 'Stripe needs more information.');
        setMissingRequirements(data.requirements_currently_due || []);
        setStatus('refresh');
        return;
      }
      setStatusReason(data.error || 'Could not verify Stripe connection.');
      setStatus('error');
    } catch (e) {
      setStatusReason(String(e?.message || e));
      setStatus('error');
    }
  };

  // Generates a fresh Account Link for the EXISTING stripe_account_id
  // and opens Stripe's hosted onboarding so the therapist can
  // finish the missing steps. Does NOT create a new account.
  const resumeOnboarding = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'resume_onboarding', therapist_id: therapist?.id }),
      });
      const data = await res.json();
      if (data.url) {
        // Redirect in the same tab so Stripe's hosted flow can take
        // over fully. New-tab opens have caused therapists to lose
        // the flow when the tab gets closed accidentally.
        window.location.href = data.url;
        return;
      }
      alert('Could not resume Stripe setup. ' + (data.error || 'Please try again.'));
    } catch (e) {
      alert('Could not resume Stripe setup. ' + String(e?.message || e));
    } finally {
      setResuming(false);
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
        {status === 'refresh' && (
          <RefreshState
            navigate={navigate}
            reason={statusReason}
            missingRequirements={missingRequirements}
            onResume={resumeOnboarding}
            resuming={resuming}
          />
        )}
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

function RefreshState({ navigate, reason, missingRequirements = [], onResume, resuming = false }) {
  // Translate Stripe's internal field names into plain English so
  // the therapist understands what they still owe Stripe.
  const friendlyName = (key) => {
    const map = {
      'business_profile.url': 'business website or social link',
      'business_profile.mcc': 'business category code',
      'business_profile.product_description': 'description of what you do',
      'business_profile.support_phone': 'business support phone',
      'business_profile.support_email': 'business support email',
      'business_type': 'business type',
      'company.address.city': 'business city',
      'company.address.line1': 'business street address',
      'company.address.postal_code': 'business zip code',
      'company.address.state': 'business state',
      'company.name': 'legal business name',
      'company.phone': 'business phone number',
      'company.tax_id': 'EIN or tax ID',
      'external_account': 'bank account for payouts',
      'individual.address.city': 'home city',
      'individual.address.line1': 'home street address',
      'individual.address.postal_code': 'home zip code',
      'individual.address.state': 'home state',
      'individual.dob.day': 'date of birth',
      'individual.dob.month': 'date of birth',
      'individual.dob.year': 'date of birth',
      'individual.email': 'personal email',
      'individual.first_name': 'first name',
      'individual.last_name': 'last name',
      'individual.phone': 'personal phone number',
      'individual.ssn_last_4': 'last 4 digits of SSN',
      'individual.id_number': 'full SSN or tax ID',
      'individual.verification.document': 'photo ID upload',
      'individual.verification.additional_document': 'additional ID document',
      'tos_acceptance.date': 'Stripe terms acceptance',
      'tos_acceptance.ip': 'Stripe terms acceptance',
      'representative.first_name': 'representative first name',
      'representative.last_name': 'representative last name',
    };
    return map[key] || key.replace(/\./g, ' ').replace(/_/g, ' ');
  };

  // Dedupe -- date of birth fields and address fields collapse into
  // single bullets so the therapist doesn't see 3 separate 'date of
  // birth' entries.
  const friendlyList = Array.from(new Set(missingRequirements.map(friendlyName)));

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
          A few more steps in Stripe
        </h1>
        <p style={{ fontSize: 14, color: C.gray, margin: 0, lineHeight: 1.6 }}>
          Stripe needs the items below before they can activate your account. Resume below and Stripe will pick up where you left off.
        </p>
      </div>

      {friendlyList.length > 0 && (
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
          <strong style={{ display: 'block', marginBottom: 8 }}>Stripe still needs:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {friendlyList.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {friendlyList.length === 0 && reason && (
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
          {reason}
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
        <strong>Good news:</strong> The work you already finished is saved. Stripe will pick up where you left off; you do not have to start over.
      </div>

      <button
        onClick={onResume}
        disabled={resuming}
        style={{
          background: resuming ? '#9CA3AF' : C.forest,
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '14px 20px',
          fontSize: 14,
          fontWeight: 700,
          cursor: resuming ? 'wait' : 'pointer',
          width: '100%',
          marginBottom: 10,
        }}
      >
        {resuming ? 'Opening Stripe...' : 'Resume Stripe setup →'}
      </button>

      <button
        onClick={() => navigate('/dashboard/settings#payments')}
        style={{
          background: 'transparent',
          color: C.gray,
          border: 'none',
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%',
          textDecoration: 'underline',
        }}
      >
        Cancel and go back to Settings
      </button>
    </div>
  );
}

function ErrorState({ navigate, reason }) {
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
          {reason || 'We could not confirm the Stripe connection. Your account is safe; nothing has been charged.'}
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
        <strong>What to try:</strong> Go back to Settings and try Connect Stripe again. If the problem keeps happening, email us at hello@mybodymap.app and we will help.
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
          Email us for help
        </a>
      </div>
    </div>
  );
}
