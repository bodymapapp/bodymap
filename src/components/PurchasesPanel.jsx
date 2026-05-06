// src/components/PurchasesPanel.jsx
//
// Shows the therapist what was purchased through MyBodyMap:
//   - Active package purchases (sessions remaining, who bought, when)
//   - Active member subscriptions (current period, monthly credits)
//
// This closes the loop on the package + membership selling features:
// before this panel, therapists could sell packages and memberships
// but had no visible record of who bought what. They had to guess from
// the Stripe dashboard or trust that emails went out.
//
// Slot: between LapsedClientAlert and BookingLinkNudge in the Clients
// view of the Dashboard. Visible whenever there's at least one
// purchase or subscription. Renders nothing when both lists are empty
// so we don't add empty-state clutter for therapists who haven't sold
// any packages/memberships yet.
//
// Design choices:
//   - Single panel, two sections (Packages, Memberships) inside it.
//     Therapists think of these together as "what people bought".
//   - Compact rows, two-line layout. Date, name, what was bought,
//     status. Status pill on the right.
//   - Tap a row to expand for full detail (price paid, payment ref,
//     notes, etc.)
//   - Sort: most recent first. Active purchases above expired/cancelled.
//   - No edit/delete from this panel. Read-only by design. Therapists
//     who need to refund or cancel use Stripe dashboard for now;
//     refund button comes in a separate ship (Chunk D).

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  forest: '#2A5741',
  sage: '#6B9E80',
  cream: '#FAF5EE',
  beige: '#F5F0E8',
  white: '#FFFFFF',
  text: '#1F3A2C',
  muted: '#6B7280',
  light: '#E8E4DC',
  gold: '#C9A84C',
  amber: '#F59E0B',
  red: '#EF4444',
};

// Format helpers
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

// Status pill colors
const statusStyle = (status) => {
  switch (status) {
    case 'active':
      return { bg: '#DCFCE7', fg: '#166534', border: '#86EFAC', label: 'Active' };
    case 'expired':
      return { bg: '#FEF3C7', fg: '#78350F', border: '#FCD34D', label: 'Expired' };
    case 'completed':
      return { bg: '#E0E7FF', fg: '#3730A3', border: '#A5B4FC', label: 'Completed' };
    case 'cancelled':
    case 'canceled':
      return { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5', label: 'Cancelled' };
    case 'past_due':
      return { bg: '#FEF3C7', fg: '#78350F', border: '#FCD34D', label: 'Past due' };
    default:
      return { bg: '#F3F4F6', fg: '#374151', border: '#D1D5DB', label: status || 'Unknown' };
  }
};

function StatusPill({ status }) {
  const s = statusStyle(status);
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg,
      color: s.fg,
      border: `1px solid ${s.border}`,
      borderRadius: 999,
      padding: '2px 10px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 0.3,
      whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

// Renders one purchase row, expandable for detail. Used for both
// packages (sessions) and memberships (subscriptions).
function PurchaseRow({ row, kind }) {
  const [expanded, setExpanded] = useState(false);

  // Common: who bought, when
  const who = row.client_name || row.client_email || 'Unknown';
  const when = row.created_at ? formatDate(row.created_at) : '';

  // Kind-specific
  let title = '';
  let subtitle = '';
  let detailRows = [];

  if (kind === 'package') {
    title = row.package_name || 'Package';
    subtitle = `${row.sessions_remaining ?? '?'} of ${row.sessions_purchased ?? '?'} sessions left`;
    detailRows = [
      ['Sessions purchased', row.sessions_purchased],
      ['Sessions remaining', row.sessions_remaining],
      ['Price paid', formatPrice(row.price_paid)],
      ['Expires', row.expires_at ? formatDate(row.expires_at) : 'Never'],
      ['Payment id', row.stripe_payment_id || '—'],
    ];
  } else {
    title = row.membership_name || 'Membership';
    subtitle = `${row.current_credits ?? '?'} credits this month · ${formatPrice(row.monthly_price)}/mo`;
    detailRows = [
      ['Current credits', row.current_credits],
      ['Monthly credits', row.monthly_session_credits],
      ['Monthly price', formatPrice(row.monthly_price)],
      ['Period ends', row.current_period_end ? formatDate(row.current_period_end) : '—'],
      ['Subscription id', row.stripe_subscription_id || '—'],
    ];
  }

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: C.white,
        border: `1px solid ${C.light}`,
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            <span style={{ fontWeight: 400, color: C.muted, fontSize: 11 }}>·</span>
            <span style={{ fontWeight: 500, color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who}</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            {subtitle}{when ? ` · bought ${when}` : ''}
          </div>
        </div>
        <StatusPill status={row.status} />
      </div>

      {expanded && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: `1px dashed ${C.light}`,
          display: 'grid', gridTemplateColumns: 'auto 1fr',
          gap: '4px 12px', fontSize: 11,
        }}>
          {detailRows.map(([k, v]) => (
            <React.Fragment key={k}>
              <div style={{ color: C.muted }}>{k}</div>
              <div style={{ color: C.text, wordBreak: 'break-all' }}>{v ?? '—'}</div>
            </React.Fragment>
          ))}
          {row.client_email && (
            <>
              <div style={{ color: C.muted }}>Email</div>
              <div style={{ color: C.text }}>{row.client_email}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PurchasesPanel({ therapistId }) {
  const [packages, setPackages] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!therapistId) return;
    let cancelled = false;

    (async () => {
      // Load both in parallel. Both use therapist_id as the
      // FK; both have a 'status' column with 'active' as
      // the default-good state.
      // Join with packages.name / memberships.name so we can render
      // the title without a second query per row.
      const [pkgRes, subRes] = await Promise.all([
        supabase
          .from('package_purchases')
          .select('*, packages(name)')
          .eq('therapist_id', therapistId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('member_subscriptions')
          .select('*, memberships(name)')
          .eq('therapist_id', therapistId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      // Flatten the joined name onto the row for easier access.
      const flatPkgs = (pkgRes.data || []).map((r) => ({
        ...r, package_name: r.packages?.name || 'Package',
      }));
      const flatSubs = (subRes.data || []).map((r) => ({
        ...r, membership_name: r.memberships?.name || 'Membership',
      }));

      setPackages(flatPkgs);
      setSubscriptions(flatSubs);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [therapistId]);

  // Sort: active first, then anything else, by date desc within each group.
  const sortedPackages = useMemo(() => {
    return [...packages].sort((a, b) => {
      const aActive = a.status === 'active' ? 0 : 1;
      const bActive = b.status === 'active' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [packages]);

  const sortedSubs = useMemo(() => {
    return [...subscriptions].sort((a, b) => {
      const aActive = a.status === 'active' ? 0 : 1;
      const bActive = b.status === 'active' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [subscriptions]);

  // Don't render anything while loading. Also don't render the panel
  // at all if there's nothing in either list. Therapists without sales
  // shouldn't see an empty 'Purchases' section every page load.
  if (loading) return null;
  if (sortedPackages.length === 0 && sortedSubs.length === 0) return null;

  // Stats for the header summary line
  const activePackages = sortedPackages.filter((p) => p.status === 'active').length;
  const activeSubs = sortedSubs.filter((s) => s.status === 'active').length;
  const summaryParts = [];
  if (activePackages > 0) summaryParts.push(`${activePackages} active package${activePackages === 1 ? '' : 's'}`);
  if (activeSubs > 0) summaryParts.push(`${activeSubs} active membership${activeSubs === 1 ? '' : 's'}`);
  const summaryLine = summaryParts.length > 0 ? summaryParts.join(' · ') : 'View past purchases';

  return (
    <div style={{
      background: C.cream,
      border: `1.5px solid ${C.light}`,
      borderRadius: 16,
      padding: 18,
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.sage,
            letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
          }}>
            What clients bought
          </div>
          <div style={{
            fontSize: 17, fontWeight: 700, color: C.forest,
            fontFamily: 'Georgia, serif',
          }}>
            Packages and memberships
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
            {summaryLine}
          </div>
        </div>
      </div>

      {sortedPackages.length > 0 && (
        <div style={{ marginBottom: sortedSubs.length > 0 ? 16 : 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.muted,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
          }}>
            Packages
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedPackages.map((p) => (
              <PurchaseRow key={p.id} row={p} kind="package" />
            ))}
          </div>
        </div>
      )}

      {sortedSubs.length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.muted,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
          }}>
            Memberships
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedSubs.map((s) => (
              <PurchaseRow key={s.id} row={s} kind="membership" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
