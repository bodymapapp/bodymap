// src/components/ClientPackageBalance.jsx
//
// Shows the package + membership balance for a client at the top of
// their profile page. Asked for by Ashley Scalzulli, May 8 2026:
//   "On client profiles it should give the option to add a number or
//   tally with how many massages they have left when they buy a package
//   or membership"
//
// Reads from three tables that already exist:
//   package_purchases     (one row per package the client bought)
//   package_redemptions   (one row per session redeemed against a purchase)
//   member_subscriptions  (one row per active membership)
//
// For each active package_purchase, we count its redemptions and show:
//   "Sarah has 3 of 5 sessions remaining in her March 5-pack · expires May 12"
// For each membership, we show plan name + cycle anchor + included sessions.
// If neither exists, the component renders null (no empty section).

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { selectInFn } from '../lib/supabaseBatch';

const C = {
  cream: '#F9F5EE',
  forest: '#1C2B22',
  sage: '#4A6B54',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  goldBg: '#FAF3DC',
  goldBorder: '#E5D085',
  gold: '#92660E',
  white: '#FFFFFF',
  lineFaint: '#E8E0D0',
  green: '#16A34A',
  greenBg: '#F0FDF4',
};

export default function ClientPackageBalance({ clientId, therapistId }) {
  const [packages, setPackages] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId || !therapistId) return;
    let cancelled = false;

    async function load() {
      // 1. Active package purchases for this client.
      //    HK direction May 24 2026: instead of trusting the
      //    sessions_remaining computed counter (which only reflects
      //    completed bookings), we compute three numbers from real
      //    booking history:
      //      - used = bookings with status=completed on/after purchase
      //      - booked = bookings with status=confirmed and date >= today
      //      - available = purchased - used - booked
      //    This matches what therapists actually want to see: "can she
      //    still book?" not just "what's left on paper?"
      const { data: purchases } = await supabase
        .from('package_purchases')
        .select(`
          id, status, purchased_at, expires_at,
          sessions_purchased, sessions_remaining,
          client_email,
          package:packages(id, name, session_count)
        `)
        .eq('client_id', clientId)
        .eq('therapist_id', therapistId)
        .in('status', ['active'])
        .order('purchased_at', { ascending: false });

      // 2. Memberships for this client. monthly_session_credits is the
      //    number of sessions a membership includes per billing cycle.
      const { data: memberRows } = await supabase
        .from('member_subscriptions')
        .select(`
          id, status, current_period_start, current_period_end,
          membership:memberships(id, name, monthly_session_credits, monthly_price)
        `)
        .eq('client_id', clientId)
        .eq('therapist_id', therapistId)
        .eq('status', 'active')
        .order('current_period_end', { ascending: false });

      // 3. Bookings for this client - needed for used/booked counts.
      //    Bookings link by client_email rather than client_id.
      const purchaseEmails = [...new Set(
        (purchases || []).map(p => (p.client_email || '').toLowerCase().trim()).filter(Boolean)
      )];

      let bookings = [];
      if (purchaseEmails.length > 0) {
        const { data: bks } = await selectInFn(
          () => supabase
            .from('bookings')
            .select('client_email, booking_date, status')
            .eq('therapist_id', therapistId),
          'client_email',
          purchaseEmails,
        );
        bookings = bks || [];
      }

      if (cancelled) return;

      const today = new Date().toISOString().split('T')[0];

      // Compose package list with the 4-number breakdown per purchase.
      const pkgList = (purchases || []).map(p => {
        const email = (p.client_email || '').toLowerCase().trim();
        const purchasedAt = p.purchased_at
          ? new Date(p.purchased_at).toISOString().split('T')[0]
          : '1970-01-01';

        let used = 0;
        let booked = 0;
        for (const b of bookings) {
          if ((b.client_email || '').toLowerCase().trim() !== email) continue;
          if (!b.booking_date || b.booking_date < purchasedAt) continue;
          if (b.status === 'completed') used += 1;
          else if (b.status === 'confirmed' && b.booking_date >= today) booked += 1;
        }
        const total = p.sessions_purchased || p.package?.session_count || 0;
        const available = Math.max(0, total - used - booked);

        return {
          id: p.id,
          name: p.package?.name || 'Session pack',
          total,
          used,
          booked,
          available,
          expires_at: p.expires_at,
          purchased_at: p.purchased_at,
        };
      }).filter(p => p.total > 0);

      setPackages(pkgList);
      setMemberships(memberRows || []);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [clientId, therapistId]);

  // Don't render anything while we're checking, or if the client has
  // neither packages nor memberships. Empty space is better than an
  // empty-state placeholder that distracts from the rest of the profile.
  if (loading) return null;
  if (packages.length === 0 && memberships.length === 0) return null;

  return (
    <div style={{
      marginBottom: 20,
      padding: '18px 20px',
      background: '#FFFFFF',
      borderRadius: 14,
      borderLeft: `5px solid ${C.gold}`,
      boxShadow: '0 6px 18px rgba(146, 102, 14, 0.10), 0 0 0 1px rgba(146, 102, 14, 0.12)',
      position: 'relative',
    }}>
      {/* Header: icon block + label + tagline */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
      }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.goldBg} 0%, #F5E9C3 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}>
          🎟
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 800,
            color: C.gold, letterSpacing: '0.18em',
            textTransform: 'uppercase',
            lineHeight: 1.1,
            marginBottom: 2,
          }}>
            Active Balance
          </div>
          <div style={{
            fontSize: 12,
            color: C.inkSoft,
            lineHeight: 1.3,
          }}>
            Prepaid sessions on this client's account
          </div>
        </div>
      </div>

      {/* Packages */}
      {packages.map(p => {
        // HK direction May 24 2026: 4-number breakdown
        // Available is the big number (what therapist can still book/sell).
        // Progress bar reflects (used + booked) / total = "committed" sessions.
        const committed = p.used + p.booked;
        const pct = p.total > 0 ? Math.round((committed / p.total) * 100) : 0;
        const isLow = p.available > 0 && p.available <= 1;
        const isEmpty = p.available === 0;
        return (
          <div key={p.id} style={{
            background: '#FAF7EE',
            border: `1px solid ${C.lineFaint}`,
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 8,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 14,
            alignItems: 'center',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: 15, fontWeight: 700,
                color: C.forest,
                marginBottom: 5,
              }}>
                {p.name}
              </div>
              <div style={{
                height: 8,
                background: '#EFE7D2',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 8,
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: isEmpty ? '#FCA5A5' : isLow ? '#F59E0B' : C.sage,
                  transition: 'width 0.25s ease-out',
                }}/>
              </div>
              {/* 4-number breakdown */}
              <div style={{
                fontSize: 11.5,
                color: C.inkSoft,
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 4,
              }}>
                <span><strong style={{ color: C.forest }}>{p.total}</strong> total</span>
                <span><strong style={{ color: C.forest }}>{p.used}</strong> used</span>
                <span><strong style={{ color: C.forest }}>{p.booked}</strong> booked</span>
              </div>
              {p.expires_at && (
                <div style={{ fontSize: 11, color: C.inkSoft }}>
                  Expires {formatDate(p.expires_at)}
                </div>
              )}
            </div>

            {/* The number you actually want to see: big available count */}
            <div style={{ textAlign: 'right', minWidth: 90, flexShrink: 0 }}>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: 36, fontWeight: 700,
                color: isEmpty ? '#DC2626' : isLow ? '#D97706' : C.sage,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {p.available}
              </div>
              <div style={{
                fontSize: 11,
                color: C.inkSoft,
                marginTop: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}>
                available
              </div>
            </div>
          </div>
        );
      })}

      {/* Memberships */}
      {memberships.map(m => (
        <div key={m.id} style={{
          background: C.greenBg,
          border: `1px solid #86EFAC`,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 8,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 14,
          alignItems: 'center',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: 15, fontWeight: 700,
              color: C.forest,
              marginBottom: 5,
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              {m.membership?.name || 'Membership'}
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: C.green,
                background: '#fff',
                padding: '2px 8px', borderRadius: 999,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>✓ Active</span>
            </div>
            {m.current_period_end && (
              <div style={{ fontSize: 12, color: C.inkSoft }}>
                Cycle renews {formatDate(m.current_period_end)}
              </div>
            )}
          </div>

          {/* Sessions/month, with same visual weight as package remaining */}
          {m.membership?.monthly_session_credits > 0 && (
            <div style={{ textAlign: 'right', minWidth: 90, flexShrink: 0 }}>
              <div style={{
                fontFamily: 'Georgia, serif',
                fontSize: 36, fontWeight: 700,
                color: C.green,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {m.membership.monthly_session_credits}
              </div>
              <div style={{
                fontSize: 11,
                color: C.inkSoft,
                marginTop: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}>
                session{m.membership.monthly_session_credits === 1 ? '' : 's'}/month
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
