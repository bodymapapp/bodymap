// src/components/ClientProfile/PackageSection.jsx
//
// HK direction May 24 2026: client profile needs a way to add a
// package and see all active packages for the client, alongside the
// existing membership section. Triggered by Candice's Christmas-gift
// scenario where a client's husband paid $600 in full for 12
// sessions, no monthly billing - which is a package, not a
// membership. Candice's only workaround was creating a membership
// plan named "{old} ... pd in full" because the profile had no way
// to add a package.
//
// This component:
//   1. Lists active package_purchases for the client, with the
//      4-number breakdown (total / used / booked / available)
//   2. Lets the therapist add a new package, picking from existing
//      package plans defined for this therapist
//   3. Lets the therapist create a one-off private plan inline
//      (for unique gifts like Michelle's Christmas package that
//      shouldn't show up in the public package list)
//
// Insert path: matches the existing package buying flow used
// elsewhere. Creates a package row in `packages` if one-off, then
// inserts a row in `package_purchases` linking the purchase to the
// client and plan.

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import CheckoutModal from '../CheckoutModal';
import SidePanel from '../SidePanel';
import BulkSessionScheduler from '../BulkSessionScheduler';

const C = {
  forest:    '#2A5741',
  forestDeep:'#1F3F2E',
  sage:      '#5C7A4F',
  sageDeep:  '#4A6840',
  gold:      '#C9A84C',
  goldDeep:  '#92660E',
  goldBg:    '#FDF5DE',
  goldSoft:  '#F5E9C3',
  amber:     '#B87840',
  amberPale: '#FAF6EE',
  ink:       '#1F2937',
  inkSoft:   '#5C6B65',
  gray:      '#6B7280',
  line:      '#E5E7EB',
  lineFaint: '#E6DFC9',
  paper:     '#FFFFFF',
  beige:     '#FAF7EE',
  beigeDeep: '#EFE7D2',
  saved:     '#16A34A',
  danger:    '#DC2626',
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatPrice = (n) => {
  if (n === null || n === undefined) return '';
  const num = Number(n);
  if (isNaN(num)) return '';
  return `$${num.toFixed(2)}`;
};

// Inline input style matching MembershipCard's style.
const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: `1.5px solid ${C.line}`,
  borderRadius: 8,
  fontSize: 13,
  color: C.ink,
  background: '#fff',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle = {
  fontSize: 11,
  color: C.gray,
  display: 'block',
  marginBottom: 4,
  fontWeight: 600,
};

// Section prop allows the caller to render only one of the three
// inner pieces (active cards, add form, history). When omitted,
// renders all three together. This lets MembershipCard interleave
// active package cards alongside active membership cards, and
// package history alongside membership history, while still keeping
// add-package form below add-membership form.
//
// Trade-off: when rendered as 3 separate instances, data is fetched
// 3 times (once per instance). For this scale (a few rows per
// query) the cost is acceptable. Real lift would be moving the
// data hook up into a shared parent.
// Hook: fetches all package data for a client + therapist + bookings
// needed for the 4-number breakdown. Returns the data plus a refetch
// function. MembershipCard calls this once and passes the result into
// each PackageSection instance via the `data` prop, so the three
// instances share state and adding a package in one triggers a
// refresh visible in all three.
export function usePackageData(client, therapist, hasMembership) {
  const [packages, setPackages] = useState([]);
  const [allPlans, setAllPlans] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [paidPackageIds, setPaidPackageIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    if (!client?.id || !therapist?.id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [pkgRes, plansRes, bkRes] = await Promise.all([
        supabase
          .from('package_purchases')
          .select('id, status, purchased_at, expires_at, sessions_purchased, sessions_remaining, price_paid, client_email, package:packages(id, name)')
          .eq('therapist_id', therapist.id)
          .eq('client_id', client.id)
          .order('purchased_at', { ascending: false }),
        supabase
          .from('packages')
          .select('id, name, session_count, price, expires_in_days, visibility, active')
          .eq('therapist_id', therapist.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('client_email, booking_date, status')
          .eq('therapist_id', therapist.id)
          .eq('client_email', client.email || ''),
      ]);
      if (cancelled) return;

      // Determine which active packages already have a succeeded
      // payment recorded against them. Drives the conditional
      // "Charge $X" button on each card (only shown when the package
      // is unpaid). HK May 24 2026: split add vs. charge so the flow
      // matches memberships (which separate add from charge).
      const activePkgIds = (pkgRes.data || [])
        .filter(p => p.status === 'active')
        .map(p => p.id);
      let paidIds = new Set();
      if (activePkgIds.length > 0) {
        const { data: paymentsForPkgs } = await supabase
          .from('session_payments')
          .select('package_purchase_id, status')
          .in('package_purchase_id', activePkgIds)
          .eq('status', 'succeeded');
        paidIds = new Set((paymentsForPkgs || []).map(p => p.package_purchase_id));
      }

      setPackages(pkgRes.data || []);
      setAllPlans(plansRes.data || []);
      setBookings(bkRes.data || []);
      setPaidPackageIds(paidIds);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [client?.id, client?.email, therapist?.id, refetchKey]);

  const refetch = () => setRefetchKey(k => k + 1);

  return { packages, allPlans, bookings, paidPackageIds, loading, refetch };
}

export default function PackageSection({ client, therapist, hasMembership, section, data }) {
  // If `data` prop is passed in (3-instance sharing pattern from
  // MembershipCard), use that. Otherwise this component owns its own
  // data fetching (backward compat for any other consumer).
  const [localPackages, setLocalPackages] = useState([]);
  const [localAllPlans, setLocalAllPlans] = useState([]);
  const [localBookings, setLocalBookings] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);

  const packages = data ? data.packages : localPackages;
  const allPlans = data ? data.allPlans : localAllPlans;
  const bookings = data ? data.bookings : localBookings;
  const paidPackageIds = data ? (data.paidPackageIds || new Set()) : new Set();
  const loading = data ? data.loading : localLoading;
  const refetch = data ? data.refetch : null;

  // Add-package form
  const [mode, setMode] = useState('pick');  // 'pick' or 'create'
  const [planId, setPlanId] = useState('');
  const [sessions, setSessions] = useState('');
  const [price, setPrice] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [notes, setNotes] = useState('');
  const [alreadyPaid, setAlreadyPaid] = useState(true);
  // One-off plan inline create
  const [oneoffName, setOneoffName] = useState('');
  // Cancel armed-tap pattern
  const [cancelArmedId, setCancelArmedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Per-package cancel error (keyed by package id) so we can display
  // an inline banner instead of using window.alert. Design principle:
  // never use browser dialogs.
  const [cancelErrors, setCancelErrors] = useState({});

  // HK May 27 2026 Ship 3: therapist-side 'book against package'.
  // bookPanel holds the package + scheduleAll flag when the therapist
  // taps Book session / Schedule all. The panel renders a
  // BulkSessionScheduler (1 row for single, N rows for all).
  const [bookPanel, setBookPanel] = useState(null); // { pkg, scheduleAll } or null
  const [bookServices, setBookServices] = useState([]);
  const [bookAvailability, setBookAvailability] = useState([]);
  const [bookDone, setBookDone] = useState(null); // { count } or null
  useEffect(() => {
    if (!bookPanel || !therapist?.id) return;
    let alive = true;
    (async () => {
      const [svcRes, availRes] = await Promise.all([
        supabase.from('services').select('*').eq('therapist_id', therapist.id).eq('active', true),
        supabase.from('availability').select('*').eq('therapist_id', therapist.id).eq('active', true),
      ]);
      if (!alive) return;
      setBookServices(svcRes.data || []);
      setBookAvailability(availRes.data || []);
    })();
    return () => { alive = false; };
  }, [bookPanel, therapist?.id]);

  // Whether the add form is expanded. Default expanded when nothing
  // exists yet (no memberships, no packages) so the therapist sees
  // the form immediately. Collapsed otherwise.
  const [addExpanded, setAddExpanded] = useState(false);
  // Track whether we've already set the addExpanded default. Without
  // this the shared-data path would reset on every re-render.
  const addExpandedInitialized = useRef(false);

  // HK May 24 2026: package checkout via CheckoutModal. When the
  // therapist fills the add form and taps Charge $X, we open
  // CheckoutModal with packagePurchase context. The modal handles
  // all 4 payment methods (Mark as paid, Card on file, Enter new
  // card, Send pay link) identically to session and membership
  // checkout. On success, the modal calls onPackageCreated and we
  // refresh the list.
  const [packageCheckoutContext, setPackageCheckoutContext] = useState(null);

  useEffect(() => {
    if (!cancelArmedId) return;
    const t = setTimeout(() => setCancelArmedId(null), 4000);
    return () => clearTimeout(t);
  }, [cancelArmedId]);

  // Defensive: reset submitting on mount in case a prior unmount
  // happened mid-async and left it stuck. HK May 24 2026: '3rd
  // package failed with button disabled' bug. Without this, the
  // Add button could stay disabled forever after a hot reload,
  // route change, or remount-mid-await.
  useEffect(() => {
    setSubmitting(false);
  }, []);

  useEffect(() => {
    // Skip local fetch if parent provided shared data.
    if (data) {
      // Compute defaults based on shared data when first available.
      if (!data.loading) {
        const activePackages = (data.packages || []).filter(p => p.status === 'active');
        const noPackages = activePackages.length === 0;
        // Only set the default once on initial mount (when addExpanded
        // is still at its initial false value). After that, user
        // controls it.
        if (noPackages && !hasMembership && !addExpandedInitialized.current) {
          setAddExpanded(true);
        }
        addExpandedInitialized.current = true;
      }
      return;
    }
    if (!client?.id || !therapist?.id) return;
    let cancelled = false;
    async function load() {
      setLocalLoading(true);
      const [pkgRes, plansRes, bkRes] = await Promise.all([
        supabase
          .from('package_purchases')
          .select('id, status, purchased_at, expires_at, sessions_purchased, sessions_remaining, price_paid, client_email, package:packages(id, name)')
          .eq('therapist_id', therapist.id)
          .eq('client_id', client.id)
          .order('purchased_at', { ascending: false }),
        supabase
          .from('packages')
          .select('id, name, session_count, price, expires_in_days, visibility, active')
          .eq('therapist_id', therapist.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('client_email, booking_date, status')
          .eq('therapist_id', therapist.id)
          .eq('client_email', client.email || ''),
      ]);
      if (cancelled) return;
      setLocalPackages(pkgRes.data || []);
      setLocalAllPlans(plansRes.data || []);
      setLocalBookings(bkRes.data || []);
      const noPackages = (pkgRes.data || []).filter(p => p.status === 'active').length === 0;
      setAddExpanded(noPackages && !hasMembership);
      setLocalLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [client?.id, client?.email, therapist?.id, hasMembership, data]);

  // Compute the 4 numbers per package by joining bookings on email.
  function computeCounts(pkg) {
    const total = pkg.sessions_purchased || 0;
    const email = (pkg.client_email || '').toLowerCase().trim();
    const purchasedAt = pkg.purchased_at
      ? new Date(pkg.purchased_at).toISOString().split('T')[0]
      : '1970-01-01';
    const today = new Date().toISOString().split('T')[0];
    let used = 0;
    let booked = 0;
    for (const b of bookings) {
      if ((b.client_email || '').toLowerCase().trim() !== email) continue;
      if (!b.booking_date || b.booking_date < purchasedAt) continue;
      if (b.status === 'completed') used += 1;
      else if (b.status === 'confirmed' && b.booking_date >= today) booked += 1;
    }
    const available = Math.max(0, total - used - booked);
    return { total, used, booked, available };
  }

  // When a plan is picked, prefill sessions/price/expiry from the plan.
  function onPickPlan(id) {
    setPlanId(id);
    const plan = allPlans.find(p => p.id === id);
    if (plan) {
      setSessions(String(plan.session_count || ''));
      setPrice(String(plan.price || ''));
      if (plan.expires_in_days) {
        const d = new Date();
        d.setDate(d.getDate() + plan.expires_in_days);
        setExpiresOn(d.toISOString().split('T')[0]);
      } else {
        setExpiresOn('');
      }
    }
  }

  function resetForm() {
    setMode('pick');
    setPlanId('');
    setSessions('');
    setPrice('');
    setExpiresOn('');
    setNotes('');
    setAlreadyPaid(true);
    setOneoffName('');
    setError(null);
  }

  // HK May 24 2026: unified package checkout via CheckoutModal.
  // Validation lives in canOpenCheckout (used to enable/disable the
  // button and produce the missing-fields hint). When valid, the
  // therapist taps Charge, which packages the form values into a
  // packagePurchase prop for CheckoutModal. The modal handles all
  // payment methods (offline, card on file, new card, pay link) and
  // creates the package_purchases row on success.
  function canOpenCheckout() {
    const sessionsNum = parseInt(sessions, 10);
    const priceNum = parseFloat(price);
    if (!sessionsNum || sessionsNum < 1) return false;
    if (isNaN(priceNum) || priceNum < 0) return false;
    if (mode === 'pick' && !planId) return false;
    if (mode === 'create' && !oneoffName.trim()) return false;
    return true;
  }

  function missingFieldHint() {
    const missing = [];
    if (mode === 'pick' && !planId) missing.push('package plan');
    if (mode === 'create' && !oneoffName.trim()) missing.push('package name');
    const sessionsNum = parseInt(sessions, 10);
    if (!sessionsNum || sessionsNum < 1) missing.push('sessions');
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) missing.push('price');
    if (missing.length === 0) return 'the required fields';
    if (missing.length === 1) return missing[0];
    return missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
  }

  function openCheckoutForPackage() {
    if (!canOpenCheckout()) return;
    const sessionsNum = parseInt(sessions, 10);
    const priceNum = parseFloat(price);
    const planName = mode === 'pick'
      ? (allPlans.find(p => p.id === planId)?.name || 'Package')
      : oneoffName.trim();
    setPackageCheckoutContext({
      name: planName,
      sessions: sessionsNum,
      price: priceNum,
      expiresAt: expiresOn || null,
      planId: mode === 'pick' ? planId : null,
      oneoffPlanData: mode === 'create' ? {
        name: oneoffName.trim(),
        description: notes.trim() || null,
      } : null,
    });
  }

  async function addPackage() {
    setError(null);
    const sessionsNum = parseInt(sessions, 10);
    const priceNum = parseFloat(price);
    if (!sessionsNum || sessionsNum < 1) {
      setError('Number of sessions is required.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Price paid is required.');
      return;
    }
    if (mode === 'pick' && !planId) {
      setError('Pick a plan or switch to creating a one-off.');
      return;
    }
    if (mode === 'create' && !oneoffName.trim()) {
      setError('Give the one-off package a name.');
      return;
    }

    setSubmitting(true);
    try {
      let resolvedPlanId = planId;
      // If creating a one-off, insert the package plan first as
      // private/inactive so it doesn't show on the public booking
      // page but is still a real plan row.
      if (mode === 'create') {
        const { data: newPlan, error: planErr } = await supabase
          .from('packages')
          .insert({
            therapist_id: therapist.id,
            name: oneoffName.trim(),
            description: notes.trim() || null,
            session_count: sessionsNum,
            price: priceNum,
            active: false,
            visibility: 'private',
            display_order: 0,
          })
          .select('id')
          .single();
        if (planErr) throw new Error(planErr.message);
        resolvedPlanId = newPlan.id;
      }

      // Look up the client's email from the database since the
      // client object passed in via props may not have it. The
      // package_purchases.client_email column is NOT NULL.
      // Fallback: 'no-email@local' placeholder so the insert can
      // succeed for clients who haven't provided an email yet.
      // The booking-counts lookup will still work via client_id.
      const { data: clientRow } = await supabase
        .from('clients')
        .select('email, name')
        .eq('id', client.id)
        .maybeSingle();
      const resolvedEmail = (clientRow?.email || client.email || '').trim() || 'no-email@local';
      const resolvedName = clientRow?.name || client.name || 'Client';

      // Create the purchase row.
      const { error: purErr } = await supabase
        .from('package_purchases')
        .insert({
          therapist_id: therapist.id,
          package_id: resolvedPlanId,
          client_id: client.id,
          client_email: resolvedEmail,
          client_name: resolvedName,
          sessions_purchased: sessionsNum,
          sessions_remaining: sessionsNum,
          price_paid: priceNum,
          status: 'active',
          purchased_at: new Date().toISOString(),
          expires_at: expiresOn ? new Date(expiresOn).toISOString() : null,
        });
      if (purErr) throw new Error(purErr.message);

      // Reload list. If shared data is in use, ask parent to refetch
      // (so all 3 PackageSection instances see the new data). If local
      // state, update directly.
      if (refetch) {
        refetch();
      } else {
        const { data: reloaded } = await supabase
          .from('package_purchases')
          .select('id, status, purchased_at, expires_at, sessions_purchased, sessions_remaining, price_paid, client_email, package:packages(id, name)')
          .eq('therapist_id', therapist.id)
          .eq('client_id', client.id)
          .order('purchased_at', { ascending: false });
        setLocalPackages(reloaded || []);
      }

      resetForm();
      setAddExpanded(false);
    } catch (e) {
      setError(e.message || 'Could not add the package.');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelPackage(purchaseId) {
    // Clear any prior error for this row before attempting.
    setCancelErrors(prev => {
      const next = { ...prev };
      delete next[purchaseId];
      return next;
    });
    const { error: err } = await supabase
      .from('package_purchases')
      .update({ status: 'canceled' })
      .eq('id', purchaseId);
    if (err) {
      // Inline error: lives on the package row itself, no browser dialog.
      setCancelErrors(prev => ({ ...prev, [purchaseId]: err.message }));
      return;
    }
    if (refetch) {
      refetch();
    } else {
      setLocalPackages(prev => prev.map(p => p.id === purchaseId ? { ...p, status: 'canceled' } : p));
    }
    setCancelArmedId(null);
  }

  if (loading) {
    return (
      <div style={{ padding: '12px 4px', color: C.gray, fontSize: 13 }}>
        Loading packages…
      </div>
    );
  }

  const activePackages = packages.filter(p => p.status === 'active');
  const historyPackages = packages.filter(p => p.status !== 'active');

  // section: undefined or 'all' renders all 3 parts. Specific values
  // render only that part. Used by MembershipCard to interleave order.
  const showActive = !section || section === 'all' || section === 'active';
  const showAdd = !section || section === 'all' || section === 'add';
  const showHistory = !section || section === 'all' || section === 'history';

  return (
    <div style={{ marginTop: showActive && (activePackages.length > 0 || hasMembership) ? 14 : 0 }}>
      {/* Active package cards */}
      {showActive && activePackages.length > 0 && activePackages.map(pkg => {
        const counts = computeCounts(pkg);
        const armed = cancelArmedId === pkg.id;
        const pct = counts.total > 0
          ? Math.round(((counts.used + counts.booked) / counts.total) * 100)
          : 0;
        return (
          <div
            key={pkg.id}
            style={{
              background: '#FFFFFF',
              border: `1.5px solid ${C.line}`,
              borderLeft: `4px solid ${C.gold}`,
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 10,
              boxShadow: '0 2px 6px rgba(146, 102, 14, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${C.goldBg} 0%, ${C.goldSoft} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}>
                🎟️
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: C.goldDeep,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  marginBottom: 3,
                  lineHeight: 1,
                }}>
                  Package
                </div>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.ink,
                  lineHeight: 1.25,
                }}>
                  {pkg.package?.name || 'Package'}
                </div>
                <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
                  {formatPrice(pkg.price_paid)} paid · purchased {formatDate(pkg.purchased_at)}
                  {pkg.expires_at && ` · expires ${formatDate(pkg.expires_at)}`}
                </div>
              </div>
              <span style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: '#166534',
                background: '#DCFCE7',
                border: '1px solid #86EFAC',
                padding: '3px 9px',
                borderRadius: 99,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}>
                Active
              </span>
            </div>

            {/* 4-number breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <div>
                <div style={{
                  height: 10,
                  background: C.beigeDeep,
                  border: `1px solid #DCD0AC`,
                  borderRadius: 5,
                  overflow: 'hidden',
                  marginBottom: 7,
                }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: counts.available === 0 ? '#FCA5A5' : counts.available <= 1 ? '#F59E0B' : C.gold,
                    transition: 'width 0.25s ease-out',
                  }} />
                </div>
                <div style={{
                  fontSize: 11,
                  color: C.inkSoft,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                }}>
                  <span><strong style={{ color: C.ink }}>{counts.total}</strong> total</span>
                  <span><strong style={{ color: C.ink }}>{counts.used}</strong> used</span>
                  <span><strong style={{ color: C.ink }}>{counts.booked}</strong> booked</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 70 }}>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 28,
                  fontWeight: 700,
                  color: counts.available === 0 ? '#DC2626' : counts.available <= 1 ? '#D97706' : C.goldDeep,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {counts.available}
                </div>
                <div style={{
                  fontSize: 9,
                  color: C.inkSoft,
                  marginTop: 3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                }}>
                  Available
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {/* HK May 27 2026 Ship 3: therapist books sessions
                  against this package. Only when sessions remain. */}
              {counts.available > 0 && (
                <button
                  type="button"
                  onClick={() => setBookPanel({ pkg, scheduleAll: false })}
                  style={{
                    background: C.forest, color: '#fff', border: `1px solid ${C.forest}`,
                    borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  Book a session
                </button>
              )}
              {counts.available > 1 && (
                <button
                  type="button"
                  onClick={() => setBookPanel({ pkg, scheduleAll: true })}
                  style={{
                    background: '#fff', color: C.forest, border: `1px solid ${C.forest}`,
                    borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  Schedule all {counts.available}
                </button>
              )}
              {/* Charge button: only shown when this package has no
                  succeeded session_payments row yet. HK May 24 2026:
                  splits the add-vs-charge flow to mirror memberships.
                  Tapping opens CheckoutModal in existing-package mode
                  (packagePurchase carries the id, modal skips the
                  insert step and just records the payment against
                  this row). */}
              {!paidPackageIds.has(pkg.id) && pkg.price_paid > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPackageCheckoutContext({
                      id: pkg.id,
                      name: pkg.package?.name || 'Package',
                      sessions: pkg.sessions_purchased,
                      price: parseFloat(pkg.price_paid),
                      expiresAt: pkg.expires_at,
                      planId: pkg.package?.id || null,
                    });
                  }}
                  style={{
                    background: C.forest,
                    color: '#fff',
                    border: `1px solid ${C.forest}`,
                    borderRadius: 8,
                    padding: '7px 13px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Charge ${parseFloat(pkg.price_paid).toFixed(2)}
                </button>
              )}

              {armed ? (
                <button
                  type="button"
                  onClick={() => cancelPackage(pkg.id)}
                  style={{
                    background: C.danger,
                    color: '#fff',
                    border: `1px solid ${C.danger}`,
                    borderRadius: 8,
                    padding: '7px 13px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Tap again to confirm cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCancelArmedId(pkg.id)}
                  style={{
                    background: '#fff',
                    color: C.danger,
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    padding: '7px 13px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel package
                </button>
              )}
            </div>
            {cancelErrors[pkg.id] && (
              <div style={{
                marginTop: 8,
                padding: '7px 10px',
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: 7,
                fontSize: 11.5,
                color: '#991B1B',
                lineHeight: 1.5,
              }}>
                Could not cancel: {cancelErrors[pkg.id]}
              </div>
            )}
          </div>
        );
      })}

      {/* Add a package - collapsible. Tints gold when expanded to
          match the package accent color, mirroring how the membership
          add form tints cream/amber when expanded. */}
      {showAdd && (
      <div
        style={{
          background: addExpanded ? C.goldBg : '#fff',
          border: `1px ${addExpanded ? 'solid' : 'dashed'} ${addExpanded ? C.goldSoft : C.line}`,
          borderRadius: 10,
          marginBottom: 10,
          overflow: 'hidden',
        }}
      >
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => setAddExpanded(v => !v)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            padding: '11px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: addExpanded ? '#fff' : C.goldBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: C.goldDeep,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            🎟️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>
              {activePackages.length > 0 ? 'Add another package' : 'Add a package'}
            </div>
            <div style={{ fontSize: 10.5, color: C.gray, marginTop: 2 }}>
              Prepaid bundle of sessions, one-time payment
            </div>
          </div>
          <span style={{
            color: C.gray,
            fontSize: 14,
            transform: addExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}>›</span>
        </button>

        {addExpanded && (
          <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.lineFaint}` }}>
            {/* Pick existing vs create one-off pill toggle */}
            <div style={{
              display: 'flex',
              background: C.beigeDeep,
              borderRadius: 8,
              padding: 3,
              marginTop: 12,
              marginBottom: 12,
            }}>
              <button
                type="button"
                onClick={() => setMode('pick')}
                style={{
                  flex: 1,
                  padding: '7px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  background: mode === 'pick' ? '#fff' : 'transparent',
                  color: mode === 'pick' ? C.forest : C.inkSoft,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: mode === 'pick' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Pick existing
              </button>
              <button
                type="button"
                onClick={() => setMode('create')}
                style={{
                  flex: 1,
                  padding: '7px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  background: mode === 'create' ? '#fff' : 'transparent',
                  color: mode === 'create' ? C.forest : C.inkSoft,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: mode === 'create' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Create one-off
              </button>
            </div>

            {mode === 'pick' ? (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Package plan</label>
                <select
                  value={planId}
                  onChange={e => onPickPlan(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Pick a plan</option>
                  {allPlans.filter(p => p.active !== false || p.visibility === 'private').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.session_count} sessions · ${Number(p.price).toFixed(0)}
                    </option>
                  ))}
                </select>
                {allPlans.length === 0 && (
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 4, lineHeight: 1.4 }}>
                    No plans yet. Switch to "Create one-off" or define plans in Settings → Packages.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Name this package</label>
                <input
                  type="text"
                  value={oneoffName}
                  onChange={e => setOneoffName(e.target.value)}
                  placeholder="e.g. Wellness Series - 10 sessions"
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: C.gray, marginTop: 4, lineHeight: 1.4 }}>
                  This is a private one-off. Not shown on your public packages list.
                </div>
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Total sessions</label>
              <input
                type="number"
                min="1"
                value={sessions}
                onChange={e => setSessions(e.target.value)}
                placeholder="e.g. 12"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Price paid ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 600"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Expires on (optional)</label>
              <input
                type="date"
                value={expiresOn}
                onChange={e => setExpiresOn(e.target.value)}
                style={inputStyle}
              />
              <div style={{ fontSize: 10.5, color: C.gray, marginTop: 3, lineHeight: 1.4 }}>
                Leave blank for no expiry.
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Paid in cash, custom pricing"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: 8,
                padding: '7px 10px',
                fontSize: 11.5,
                color: '#991B1B',
                marginBottom: 10,
                lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={addPackage}
              disabled={!canOpenCheckout() || submitting}
              style={{
                width: '100%',
                background: (!canOpenCheckout() || submitting) ? '#D1D5DB' : C.forest,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 700,
                cursor: (!canOpenCheckout() || submitting) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? 'Saving…' : 'Add package'}
            </button>

            {!canOpenCheckout() && (
              <div style={{
                fontSize: 11,
                color: C.gray,
                marginTop: 6,
                fontStyle: 'italic',
                textAlign: 'center',
                lineHeight: 1.4,
              }}>
                Fill in {missingFieldHint()} to continue.
              </div>
            )}

            <div style={{ fontSize: 10.5, color: C.gray, marginTop: 8, lineHeight: 1.5 }}>
              Adds the package to this client's balance. After it's added, you can charge for it any time using the Charge button on the package card. HK May 24 2026: matches the membership flow (add first, charge separately).
            </div>
          </div>
        )}
      </div>
      )}

      {/* History */}
      {showHistory && historyPackages.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 10.5,
            color: C.gray,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 6,
            paddingLeft: 4,
          }}>
            Package history
          </div>
          {historyPackages.map(pkg => (
            <div
              key={pkg.id}
              style={{
                background: '#FAFAF6',
                border: `1px solid ${C.line}`,
                borderLeft: `3px solid #D6D2C5`,
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 6,
                opacity: 0.85,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>
                    {pkg.package?.name || 'Package'}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.gray, marginTop: 2 }}>
                    {pkg.sessions_purchased} sessions · {formatPrice(pkg.price_paid)} · purchased {formatDate(pkg.purchased_at)}
                  </div>
                </div>
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: pkg.status === 'canceled' ? '#FEE2E2' : '#FEF3C7',
                  color: pkg.status === 'canceled' ? '#991B1B' : '#78350F',
                  padding: '2px 7px',
                  borderRadius: 99,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  flexShrink: 0,
                }}>
                  {pkg.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* HK May 24 2026: unified checkout for package purchases.
          Opens when therapist taps Charge $X on the add form. The
          modal shows the same 4 payment methods as session and
          membership checkout (Mark as paid, Card on file, Enter new
          card, Send pay link). On success, modal creates the
          package_purchases row + linked session_payments row, calls
          onPackageCreated, and we refresh the list. On close (Done),
          scroll the page back to the Memberships & Packages section
          so therapist sees the new package in context, not the
          (now-collapsed) empty form area below it. */}
      {packageCheckoutContext && (
        <CheckoutModal
          packagePurchase={packageCheckoutContext}
          therapist={therapist}
          client={client}
          defaultAmountCents={Math.round(packageCheckoutContext.price * 100)}
          onClose={() => {
            setPackageCheckoutContext(null);
            // Scroll to top of Memberships & Packages so the therapist
            // lands in the right context after Done, not at the bottom
            // of the (collapsed) add-form area which looks empty.
            setTimeout(() => {
              const el = document.querySelector('[data-section-id="memberships-packages"]');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          }}
          onPackageCreated={() => {
            // New-package mode: created a fresh package_purchases row.
            // Refresh and collapse the add form.
            if (refetch) refetch();
            resetForm();
            setAddExpanded(false);
          }}
          onPaid={() => {
            // Existing-package mode (or any charge completion): refresh
            // so the just-charged package moves out of the unpaid list
            // and the Charge button disappears from its card.
            if (refetch) refetch();
          }}
        />
      )}

      {/* HK May 27 2026 Ship 3: therapist-side book-against-package
          panel. Side panel (Design Principle 31) hosting the bulk
          scheduler. Single 'Book a session' shows 1 row; 'Schedule
          all' shows N rows. */}
      <SidePanel
        open={!!bookPanel}
        onClose={() => { setBookPanel(null); setBookDone(null); }}
        title={bookDone ? 'Sessions booked' : (bookPanel?.scheduleAll ? 'Schedule all sessions' : 'Book a session')}
        subtitle={bookDone ? null : `Draws from ${bookPanel?.pkg?.package?.name || 'this package'}: no charge.`}
        width={460}
      >
        {bookDone ? (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
              {bookDone.count} session{bookDone.count !== 1 ? 's' : ''} booked
            </div>
            <p style={{ fontSize: 13.5, color: C.gray, lineHeight: 1.5, marginBottom: 20 }}>
              They are on your schedule and drawn from the package balance.
            </p>
            <button
              onClick={() => { setBookPanel(null); setBookDone(null); if (refetch) refetch(); }}
              style={{ background: C.forest, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Done
            </button>
          </div>
        ) : bookPanel ? (
          <BulkSessionScheduler
            therapist={therapist}
            services={bookServices}
            availability={bookAvailability}
            redeemContext={{
              purchaseId: bookPanel.pkg.id,
              sessionsRemaining: bookPanel.scheduleAll
                ? computeCounts(bookPanel.pkg).available
                : 1,
              packageName: bookPanel.pkg.package?.name || 'Package',
              clientEmail: client?.email || '',
              clientName: client?.name || '',
              clientId: client?.id || null,
            }}
            applicableServiceIds={null}
            onComplete={(count) => { setBookDone({ count }); }}
            onCancel={() => setBookPanel(null)}
          />
        ) : null}
      </SidePanel>
    </div>
  );
}
