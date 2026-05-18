// src/components/ClientProfile/MembershipCard.jsx
//
// HK May 14 2026: 'glossgenius did not allow to download memberships,
// she has 10 memberships, build option 2: add membership to client
// card.'
//
// Lets the therapist attach a membership plan to an existing client
// record. Used for:
//   - Migration: importing memberships that didn't come via CSV
//     (GlossGenius blocks the export)
//   - Day-to-day: a client signs up for a membership mid-session;
//     therapist taps Add and the subscription is recorded
//
// Insert path is the same one ImportClients uses (member_subscriptions
// row with stripe_subscription_id NULL for manually added subs).
// Billing is NOT triggered by this panel, only the record is created.
// The therapist is responsible for collecting payment via their normal
// flow when they manually attach a sub here.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const C = {
  forest:    '#2A5741',
  sage:      '#5C7A4F',
  amber:     '#B87840',
  amberPale: '#FAF6EE',
  ink:       '#1F2937',
  gray:      '#6B7280',
  line:      '#E5E7EB',
  paper:     '#FFFFFF',
  saved:     '#16A34A',
  danger:    '#DC2626',
};

export default function MembershipCard({ client, therapist }) {
  const [memberships, setMemberships] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  // New-sub form state
  const [planId, setPlanId] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [statusValue, setStatusValue] = useState('active');
  const [creditsRemaining, setCreditsRemaining] = useState('');
  // Phase 19 (HK May 18 2026): renewal-day + notes + first-paid for
  // the renewal-tracking flow.
  const [renewalDay, setRenewalDay] = useState('');
  const [notes, setNotes] = useState('');
  const [firstMonthAlreadyPaid, setFirstMonthAlreadyPaid] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [mRes, sRes] = await Promise.all([
          supabase
            .from('memberships')
            .select('id, name, monthly_price, monthly_session_credits, active')
            .eq('therapist_id', therapist.id)
            .order('name', { ascending: true }),
          supabase
            .from('member_subscriptions')
            .select('id, membership_id, status, monthly_price, monthly_session_credits, current_credits, current_period_end, started_at, canceled_at')
            .eq('therapist_id', therapist.id)
            .eq('client_id', client.id)
            .order('started_at', { ascending: false }),
        ]);
        if (mounted) {
          setMemberships(mRes.data || []);
          setSubs(sRes.data || []);
        }
      } catch (e) {
        if (mounted) setError('Could not load memberships.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [client.id, therapist.id]);

  async function addSubscription() {
    setError(null);
    if (!planId) {
      setError('Choose a membership plan.');
      return;
    }
    const plan = memberships.find(m => m.id === planId);
    if (!plan) {
      setError('That plan is no longer available. Refresh and try again.');
      return;
    }
    setAdding(true);
    try {
      const nowIso = new Date().toISOString();
      const periodEnd = renewalDate ? new Date(renewalDate).toISOString() : null;
      const credits = creditsRemaining !== ''
        ? Math.max(0, parseInt(creditsRemaining, 10) || 0)
        : plan.monthly_session_credits;
      const renewalDayInt = renewalDay !== ''
        ? Math.max(1, Math.min(31, parseInt(renewalDay, 10) || 0))
        : null;

      const { data, error: insErr } = await supabase
        .from('member_subscriptions')
        .insert({
          therapist_id: therapist.id,
          membership_id: plan.id,
          client_id: client.id,
          client_email: client.email || '',
          client_name: client.name || null,
          // No stripe_subscription_id, this is a manually attached sub.
          // Phase 19: the therapist charges each month via Checkout.
          // The renewal-reminder cron creates upcoming rows; the
          // billing dashboard surfaces them.
          status: statusValue,
          current_period_start: nowIso,
          current_period_end: periodEnd,
          monthly_price: plan.monthly_price,
          monthly_session_credits: plan.monthly_session_credits,
          current_credits: credits,
          started_at: nowIso,
          renewal_day_of_month: renewalDayInt,
          billing_cadence: 'monthly',
          notes: notes.trim() || null,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      if (data) setSubs([data, ...subs]);

      // Phase 19: if the therapist hasn't already collected the first
      // month, create a pending renewal row for THIS period. The
      // billing dashboard reminder surfaces it. If they HAVE collected
      // (Candice's grandfathered members case), skip; they're current.
      if (data && !firstMonthAlreadyPaid && renewalDayInt) {
        const today = new Date();
        const periodStartStr = today.toISOString().slice(0, 10);
        // First period_end: next occurrence of renewalDayInt.
        const nextDay = new Date(today.getFullYear(), today.getMonth(), renewalDayInt);
        if (nextDay <= today) nextDay.setMonth(nextDay.getMonth() + 1);
        const periodEndStr = nextDay.toISOString().slice(0, 10);
        try {
          await supabase.from('member_subscription_renewals').insert({
            member_subscription_id: data.id,
            therapist_id: therapist.id,
            client_id: client.id,
            period_start: periodStartStr,
            period_end: periodEndStr,
            due_on: periodStartStr,
            amount_due_cents: Math.round(Number(plan.monthly_price) * 100),
            status: 'pending',
          });
        } catch (e) {
          // Non-fatal: the sub itself was created, the renewal row
          // can be created later by the cron or manually.
          console.warn('initial renewal row insert failed:', e);
        }
      }

      // Reset form
      setPlanId('');
      setRenewalDate('');
      setStatusValue('active');
      setCreditsRemaining('');
      setRenewalDay('');
      setNotes('');
      setFirstMonthAlreadyPaid(false);
    } catch (e) {
      console.error('[MembershipCard] add failed:', e);
      setError('Could not save. ' + (e?.message || 'Please try again.'));
    } finally {
      setAdding(false);
    }
  }

  async function cancelSubscription(subId) {
    if (!window.confirm('Cancel this membership? The client keeps any remaining credits until the end of the current period, but no more credits will be added.')) return;
    try {
      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('member_subscriptions')
        .update({ status: 'canceled', canceled_at: nowIso })
        .eq('id', subId);
      if (updErr) throw updErr;
      setSubs(subs.map(s => s.id === subId ? { ...s, status: 'canceled', canceled_at: nowIso } : s));
    } catch (e) {
      console.error('[MembershipCard] cancel failed:', e);
      alert('Could not cancel. Please try again.');
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 4px', color: C.gray, fontSize: 13 }}>
        Loading memberships…
      </div>
    );
  }

  const activePlans = memberships.filter(m => m.active !== false);

  return (
    <div style={{ padding: '6px 4px 4px' }}>
      {/* Existing subscriptions */}
      {subs.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          {subs.map(sub => {
            const plan = memberships.find(m => m.id === sub.membership_id);
            const planName = plan?.name || 'Unknown plan';
            const isActive = sub.status === 'active';
            return (
              <div
                key={sub.id}
                style={{
                  background: isActive ? '#FFFFFF' : '#F9FAFB',
                  border: `1.5px solid ${isActive ? C.line : '#E5E7EB'}`,
                  borderLeft: `4px solid ${isActive ? C.forest : C.gray}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: 'Georgia, serif' }}>
                    {planName}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isActive ? C.saved : C.gray,
                    background: isActive ? '#F0FDF4' : '#F3F4F6',
                    border: `1px solid ${isActive ? '#BBF7D0' : C.line}`,
                    padding: '2px 8px',
                    borderRadius: 99,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {sub.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.55 }}>
                  ${Number(sub.monthly_price).toFixed(2)}/mo · {sub.current_credits} credit{sub.current_credits === 1 ? '' : 's'} remaining
                  {sub.current_period_end && (
                    <> · Renews {new Date(sub.current_period_end).toLocaleDateString()}</>
                  )}
                </div>
                {isActive && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => cancelSubscription(sub.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: C.danger,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Cancel membership
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: C.gray, marginBottom: 14, fontStyle: 'italic' }}>
          No membership on file. Add one below if this client is on a recurring plan.
        </div>
      )}

      {/* Add-membership form */}
      {activePlans.length === 0 ? (
        <div style={{
          background: C.amberPale,
          border: `1px solid ${C.line}`,
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 12.5,
          color: C.gray,
          lineHeight: 1.55,
        }}>
          Define a membership plan in <strong>Settings → Memberships</strong> first, then come back here to attach it to this client.
        </div>
      ) : (
        <div style={{
          background: C.amberPale,
          border: `1px solid #E5DCC4`,
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.amber, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Add a membership
          </div>

          <select
            value={planId}
            onChange={e => {
              setPlanId(e.target.value);
              const plan = memberships.find(m => m.id === e.target.value);
              if (plan) setCreditsRemaining(String(plan.monthly_session_credits));
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: `1.5px solid ${C.line}`,
              borderRadius: 8,
              fontSize: 13,
              color: C.ink,
              background: '#fff',
              marginBottom: 8,
              boxSizing: 'border-box',
            }}
          >
            <option value="">Pick a plan</option>
            {activePlans.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} · ${Number(m.monthly_price).toFixed(2)}/mo · {m.monthly_session_credits} credit{m.monthly_session_credits === 1 ? '' : 's'}
              </option>
            ))}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>Next renewal</label>
              <input
                type="date"
                value={renewalDate}
                onChange={e => setRenewalDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 9px',
                  border: `1.5px solid ${C.line}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: C.ink,
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>Credits left now</label>
              <input
                type="number"
                min="0"
                value={creditsRemaining}
                onChange={e => setCreditsRemaining(e.target.value)}
                placeholder="Defaults to plan amount"
                style={{
                  width: '100%',
                  padding: '7px 9px',
                  border: `1.5px solid ${C.line}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: C.ink,
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Phase 19 fields: renewal day + notes + first-paid */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>
              Renewal day of month
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={renewalDay}
              onChange={e => setRenewalDay(e.target.value)}
              placeholder="e.g. 18 = bills on the 18th"
              style={{
                width: '100%',
                padding: '7px 9px',
                border: `1.5px solid ${C.line}`,
                borderRadius: 8,
                fontSize: 13,
                color: C.ink,
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 10.5, color: C.gray, marginTop: 3, lineHeight: 1.4 }}>
              You will get a reminder on this day each month to charge or waive.
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Legacy pricing per May 2024 agreement"
              style={{
                width: '100%',
                padding: '7px 9px',
                border: `1.5px solid ${C.line}`,
                borderRadius: 8,
                fontSize: 13,
                color: C.ink,
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 12, color: C.ink }}>
            <input
              type="checkbox"
              checked={firstMonthAlreadyPaid}
              onChange={e => setFirstMonthAlreadyPaid(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>First month already paid (skip the renewal reminder this period)</span>
          </label>

          {error && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: 8,
              padding: '7px 10px',
              fontSize: 11.5,
              color: '#991B1B',
              marginBottom: 8,
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            onClick={addSubscription}
            disabled={!planId || adding}
            style={{
              width: '100%',
              background: planId && !adding ? C.forest : '#D1D5DB',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 13,
              fontWeight: 700,
              cursor: planId && !adding ? 'pointer' : 'not-allowed',
            }}
          >
            {adding ? 'Saving…' : 'Add membership'}
          </button>

          <div style={{ fontSize: 10.5, color: C.gray, marginTop: 7, lineHeight: 1.5 }}>
            MyBodyMap holds the membership record and reminds you each renewal day. You charge using Checkout (card on file, Venmo, cash, or whatever fits). Stripe Connect billing arrives in a later phase.
          </div>
        </div>
      )}
    </div>
  );
}
