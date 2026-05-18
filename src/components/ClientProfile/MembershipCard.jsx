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
import CheckoutModal from '../CheckoutModal';

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

// Reused input style for the inline edit form.
const editInputStyle = {
  width: '100%',
  padding: '7px 9px',
  border: `1.5px solid ${C.line}`,
  borderRadius: 8,
  fontSize: 13,
  color: C.ink,
  background: '#fff',
  boxSizing: 'border-box',
};

// 1 -> 'st', 2 -> 'nd', 3 -> 'rd', 4 -> 'th', 11 -> 'th', etc.
function ordinalSuffix(n) {
  const v = Math.abs(parseInt(n, 10) || 0);
  if (v >= 11 && v <= 13) return 'th';
  const last = v % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
}

export default function MembershipCard({ client, therapist }) {
  const [memberships, setMemberships] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  // Phase 19.4 (HK May 18 2026): pending renewals for THIS client.
  // Surfaced as 'Charge renewal' buttons on each active subscription
  // row so the therapist can resolve from here, not just from the
  // billing dashboard's reminders card.
  const [pendingRenewals, setPendingRenewals] = useState([]);
  // Phase 19.5 (HK May 18 2026): all renewals (any status). Used to
  // compute the payment-status pill on each sub row, which tells the
  // therapist at a glance whether this client is paid through, due,
  // or past due. Without this pill the therapist had no visual cue
  // that anything needed action.
  const [allRenewals, setAllRenewals] = useState([]);
  const [renewalToCharge, setRenewalToCharge] = useState(null); // {renewal, subscription}
  // Phase 19.5: ad-hoc charge with no renewal context. Therapist taps
  // 'Charge now' on a sub that has no pending renewal yet (e.g. they
  // want to collect for next month early, or the cron hasn't run).
  const [adhocChargeSub, setAdhocChargeSub] = useState(null);
  // Phase 19.5: inline edit form on a subscription row.
  const [editingSubId, setEditingSubId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    monthly_price: '',
    current_credits: '',
    renewal_day_of_month: '',
    notes: '',
    status: 'active',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  // Phase 19.5 hotfix: inline cancel-confirm (no window.confirm).
  // First tap on 'Cancel membership' arms; second tap (within 4s)
  // executes. Auto-disarms after timeout.
  const [cancelArmedSubId, setCancelArmedSubId] = useState(null);
  useEffect(() => {
    if (!cancelArmedSubId) return;
    const t = setTimeout(() => setCancelArmedSubId(null), 4000);
    return () => clearTimeout(t);
  }, [cancelArmedSubId]);

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
        // Subs select with new Phase 19 columns. If those columns don't
        // exist yet (migration not applied), fall back to the older
        // column set so the panel still renders.
        async function fetchSubs() {
          const full = await supabase
            .from('member_subscriptions')
            .select('id, membership_id, status, monthly_price, monthly_session_credits, current_credits, current_period_end, started_at, canceled_at, client_email, client_name, renewal_day_of_month, notes')
            .eq('therapist_id', therapist.id)
            .eq('client_id', client.id)
            .order('started_at', { ascending: false });
          if (full.error && /renewal_day_of_month|notes/.test(full.error.message || '')) {
            console.warn('[MembershipCard] subs full select failed; retrying without Phase 19 columns:', full.error.message);
            const legacy = await supabase
              .from('member_subscriptions')
              .select('id, membership_id, status, monthly_price, monthly_session_credits, current_credits, current_period_end, started_at, canceled_at, client_email, client_name')
              .eq('therapist_id', therapist.id)
              .eq('client_id', client.id)
              .order('started_at', { ascending: false });
            return legacy;
          }
          return full;
        }

        const [mRes, sRes, rRes] = await Promise.all([
          supabase
            .from('memberships')
            .select('id, name, monthly_price, monthly_session_credits, active')
            .eq('therapist_id', therapist.id)
            .order('name', { ascending: true }),
          fetchSubs(),
          // Phase 19.4: pending renewals for THIS client. Defensive
          // try-catch in case the membership_renewal_v1 migration
          // hasn't been applied; we render empty array gracefully.
          //
          // Phase 19.5: also pull ALL renewals (any status, last 12
          // months) so we can render the payment-status pill on each
          // sub row.
          supabase
            .from('member_subscription_renewals')
            .select('id, member_subscription_id, period_start, period_end, due_on, amount_due_cents, status, resolved_at')
            .eq('therapist_id', therapist.id)
            .eq('client_id', client.id)
            .order('due_on', { ascending: false }),
        ]);
        if (mounted) {
          setMemberships(mRes.data || []);
          if (sRes.error) {
            console.error('[MembershipCard] subs fetch error:', sRes.error);
            setError('Could not load memberships.');
          }
          setSubs(sRes.data || []);
          // rRes may have an error if the table doesn't exist yet
          // pre-migration. Don't crash the rest of the panel.
          const all = rRes.error ? [] : (rRes.data || []);
          setAllRenewals(all);
          setPendingRenewals(all.filter(r => r.status === 'pending'));
        }
      } catch (e) {
        if (mounted) setError('Could not load memberships.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [client.id, therapist.id]);

  // Re-fetch renewals after a charge resolves (called by CheckoutModal's
  // onPaid callback). Quick re-query rather than full reload.
  async function refreshRenewals() {
    try {
      const { data, error: rErr } = await supabase
        .from('member_subscription_renewals')
        .select('id, member_subscription_id, period_start, period_end, due_on, amount_due_cents, status, resolved_at')
        .eq('therapist_id', therapist.id)
        .eq('client_id', client.id)
        .order('due_on', { ascending: false });
      if (!rErr) {
        const all = data || [];
        setAllRenewals(all);
        setPendingRenewals(all.filter(r => r.status === 'pending'));
      }
    } catch (e) { /* non-blocking */ }
  }

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
    // Inline confirm pattern: first tap arms the cancel, second tap
    // within 4 seconds executes. Avoids window.confirm (violates
    // design principles) and the 'are you sure?' modal that breaks
    // flow on mobile.
    try {
      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('member_subscriptions')
        .update({ status: 'canceled', canceled_at: nowIso })
        .eq('id', subId);
      if (updErr) throw updErr;
      setSubs(subs.map(s => s.id === subId ? { ...s, status: 'canceled', canceled_at: nowIso } : s));
      setCancelArmedSubId(null);
    } catch (e) {
      console.error('[MembershipCard] cancel failed:', e);
      setCancelArmedSubId(null);
      setError('Could not cancel membership. Please try again.');
    }
  }

  // Phase 19.5 (HK May 18 2026): inline edit on a sub row.
  function startEdit(sub) {
    setEditingSubId(sub.id);
    setEditDraft({
      monthly_price: String(sub.monthly_price ?? ''),
      current_credits: String(sub.current_credits ?? ''),
      renewal_day_of_month: sub.renewal_day_of_month ? String(sub.renewal_day_of_month) : '',
      notes: sub.notes || '',
      status: sub.status || 'active',
    });
    setEditError(null);
  }
  function cancelEdit() {
    setEditingSubId(null);
    setEditError(null);
  }
  async function saveEdit(subId) {
    setEditSaving(true);
    setEditError(null);
    try {
      const priceNum = Number(editDraft.monthly_price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setEditError('Enter a valid monthly price.');
        setEditSaving(false);
        return;
      }
      const creditsNum = editDraft.current_credits === ''
        ? null
        : Math.max(0, parseInt(editDraft.current_credits, 10) || 0);
      const dayNum = editDraft.renewal_day_of_month === ''
        ? null
        : Math.max(1, Math.min(31, parseInt(editDraft.renewal_day_of_month, 10) || 0));
      const patch = {
        monthly_price: priceNum,
        renewal_day_of_month: dayNum,
        notes: editDraft.notes.trim() || null,
        status: editDraft.status,
      };
      if (creditsNum !== null) patch.current_credits = creditsNum;
      const { error: updErr } = await supabase
        .from('member_subscriptions')
        .update(patch)
        .eq('id', subId);
      if (updErr) throw updErr;
      setSubs(arr => arr.map(s => s.id === subId ? { ...s, ...patch } : s));
      setEditingSubId(null);
    } catch (e) {
      console.error('[MembershipCard] saveEdit failed:', e);
      setEditError('Could not save. ' + (e?.message || 'Please try again.'));
    } finally {
      setEditSaving(false);
    }
  }

  // Phase 19.5 payment-status pill. Returns { label, color, bg, border }
  // describing the visual treatment for the sub row's pill.
  function getPaymentStatus(sub) {
    if (sub.status === 'canceled') {
      return { label: 'Canceled', color: C.gray, bg: '#F3F4F6', border: C.line };
    }
    if (sub.status === 'paused') {
      return { label: 'Paused', color: C.gray, bg: '#F3F4F6', border: C.line };
    }
    // Active sub: look at the most recent renewal across all statuses.
    // allRenewals is sorted by due_on desc; the first matching row
    // for this subscription is the latest.
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const subRenewals = allRenewals.filter(r => r.member_subscription_id === sub.id);
    if (subRenewals.length === 0) {
      return {
        label: 'No renewal scheduled',
        color: C.gray,
        bg: '#FAFAF6',
        border: C.line,
        italic: true,
      };
    }
    // Earliest pending renewal (if any) drives the urgency.
    const pendingSorted = subRenewals
      .filter(r => r.status === 'pending')
      .sort((a, b) => a.due_on.localeCompare(b.due_on));
    if (pendingSorted.length > 0) {
      const p = pendingSorted[0];
      const dueLabel = new Date(p.due_on + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const amount = `$${(p.amount_due_cents / 100).toFixed(2)}`;
      if (p.due_on < todayStr) {
        return {
          label: `${amount} past due since ${dueLabel}`,
          color: '#991B1B',
          bg: '#FEF2F2',
          border: '#FCA5A5',
        };
      }
      if (p.due_on === todayStr) {
        return {
          label: `${amount} due today`,
          color: '#92400E',
          bg: '#FEF3C7',
          border: '#FDE68A',
        };
      }
      return {
        label: `Next charge ${dueLabel}`,
        color: C.gray,
        bg: '#FAFAF6',
        border: C.line,
      };
    }
    // No pending. Look for the latest paid renewal.
    const paidSorted = subRenewals
      .filter(r => r.status === 'paid')
      .sort((a, b) => b.period_end.localeCompare(a.period_end));
    if (paidSorted.length > 0) {
      const latest = paidSorted[0];
      const endLabel = new Date(latest.period_end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        label: `Paid through ${endLabel}`,
        color: C.saved,
        bg: '#F0FDF4',
        border: '#BBF7D0',
      };
    }
    // Only waived/skipped renewals exist.
    return {
      label: 'No active renewal',
      color: C.gray,
      bg: '#FAFAF6',
      border: C.line,
      italic: true,
    };
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
            const paymentStatus = getPaymentStatus(sub);
            const pending = pendingRenewals.find(r => r.member_subscription_id === sub.id);
            const isEditing = editingSubId === sub.id;
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
                  {/* Phase 19.5: payment-status pill replaces the old
                      status-only pill. Tells the therapist at a glance
                      whether this client is paid, due, past due, or has
                      no renewal scheduled. */}
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: paymentStatus.color,
                    background: paymentStatus.bg,
                    border: `1px solid ${paymentStatus.border}`,
                    padding: '3px 9px',
                    borderRadius: 99,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontStyle: paymentStatus.italic ? 'italic' : 'normal',
                  }}>
                    {paymentStatus.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.55 }}>
                  ${Number(sub.monthly_price).toFixed(2)}/mo · {sub.current_credits} credit{sub.current_credits === 1 ? '' : 's'} remaining
                  {sub.renewal_day_of_month && (
                    <> · Bills on the {sub.renewal_day_of_month}{ordinalSuffix(sub.renewal_day_of_month)}</>
                  )}
                </div>
                {sub.notes && !isEditing && (
                  <div style={{ fontSize: 11.5, color: C.gray, fontStyle: 'italic', marginTop: 4, lineHeight: 1.5 }}>
                    {sub.notes}
                  </div>
                )}

                {/* Phase 19.5 inline edit form. Replaces the static
                    row content when editingSubId matches this sub. */}
                {isEditing && (
                  <div style={{
                    marginTop: 10,
                    padding: 10,
                    background: '#FAFAF6',
                    border: `1px dashed ${C.line}`,
                    borderRadius: 10,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>Monthly price ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editDraft.monthly_price}
                          onChange={e => setEditDraft(d => ({ ...d, monthly_price: e.target.value }))}
                          style={editInputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>Credits left now</label>
                        <input
                          type="number"
                          min="0"
                          value={editDraft.current_credits}
                          onChange={e => setEditDraft(d => ({ ...d, current_credits: e.target.value }))}
                          style={editInputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>Renewal day of month (1-31)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editDraft.renewal_day_of_month}
                        onChange={e => setEditDraft(d => ({ ...d, renewal_day_of_month: e.target.value }))}
                        placeholder="e.g. 18"
                        style={editInputStyle}
                      />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>Notes</label>
                      <input
                        type="text"
                        value={editDraft.notes}
                        onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                        placeholder="e.g. Legacy pricing per May 2024"
                        style={editInputStyle}
                      />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: C.gray, display: 'block', marginBottom: 3 }}>Status</label>
                      <select
                        value={editDraft.status}
                        onChange={e => setEditDraft(d => ({ ...d, status: e.target.value }))}
                        style={editInputStyle}
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="canceled">Canceled</option>
                      </select>
                    </div>
                    {editError && (
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
                        {editError}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => saveEdit(sub.id)}
                        disabled={editSaving}
                        style={{
                          background: editSaving ? '#9CA3AF' : C.forest,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '7px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: editSaving ? 'wait' : 'pointer',
                        }}
                      >
                        {editSaving ? 'Saving...' : 'Save changes'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={editSaving}
                        style={{
                          background: 'transparent',
                          color: C.gray,
                          border: `1px solid ${C.line}`,
                          borderRadius: 8,
                          padding: '7px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action row. Phase 19.5 always shows the Charge button
                    on active subs (was conditional on a pending renewal).
                    Edit and Cancel sit beside it. */}
                {isActive && !isEditing && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        if (pending) {
                          setRenewalToCharge({ renewal: pending, subscription: sub });
                        } else {
                          setAdhocChargeSub(sub);
                        }
                      }}
                      style={{
                        background: C.forest,
                        color: '#fff',
                        border: 'none',
                        padding: '7px 13px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {pending
                        ? `Charge $${(pending.amount_due_cents / 100).toFixed(2)} renewal`
                        : `Charge $${Number(sub.monthly_price).toFixed(2)} now`}
                    </button>
                    <button
                      onClick={() => startEdit(sub)}
                      style={{
                        background: 'transparent',
                        color: C.forest,
                        border: `1px solid ${C.line}`,
                        padding: '7px 13px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (cancelArmedSubId === sub.id) {
                          cancelSubscription(sub.id);
                        } else {
                          setCancelArmedSubId(sub.id);
                        }
                      }}
                      style={{
                        background: cancelArmedSubId === sub.id ? '#FEF2F2' : 'transparent',
                        border: cancelArmedSubId === sub.id ? '1px solid #FCA5A5' : 'none',
                        color: C.danger,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: cancelArmedSubId === sub.id ? '4px 10px' : 0,
                        borderRadius: 6,
                      }}
                    >
                      {cancelArmedSubId === sub.id
                        ? 'Tap again to confirm cancel'
                        : 'Cancel membership'}
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

      {/* Renewal charge modal (Phase 19.4). Opens when therapist taps
          the Charge renewal button on an active subscription that has
          a pending renewal row. Reuses the same CheckoutModal that
          handles service and renewal charges everywhere else on the
          platform. */}
      {renewalToCharge && (
        <CheckoutModal
          subscription={renewalToCharge.subscription}
          renewal={renewalToCharge.renewal}
          therapist={therapist}
          client={client}
          defaultAmountCents={renewalToCharge.renewal.amount_due_cents}
          onClose={() => setRenewalToCharge(null)}
          onPaid={() => { refreshRenewals(); }}
        />
      )}

      {/* Phase 19.5 ad-hoc charge: therapist taps Charge $X now on a
          sub that has no pending renewal. Same modal, no renewal id
          to resolve. Payment lands as a session_payments row tied to
          the subscription. */}
      {adhocChargeSub && (
        <CheckoutModal
          subscription={adhocChargeSub}
          therapist={therapist}
          client={client}
          defaultAmountCents={Math.round(Number(adhocChargeSub.monthly_price) * 100)}
          onClose={() => setAdhocChargeSub(null)}
          onPaid={() => { refreshRenewals(); }}
        />
      )}
    </div>
  );
}
