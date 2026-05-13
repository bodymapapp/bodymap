// src/components/ClientProfile/Timeline.jsx
//
// Unified activity feed for the client profile. Merges five event
// sources into a single reverse-chronological list:
//
//   bookings           appointments scheduled / completed / cancelled
//   sessions           SOAP notes written
//   package_purchases  package bought
//   member_subs        membership started or renewed
//   gift_certificates  gift card received
//
// Each event is normalized to { id, type, timestamp, title, detail,
// icon, tone, onClick }. The timeline renders with date dividers
// ("Today", "Yesterday", "This week", "March 2026") so the
// therapist can scan time periods quickly.
//
// Pagination: load all up front (typically <100 events per client),
// show first 25, "Show more" button reveals the rest. Beats infinite
// scroll for this density.

import React, { useState, useMemo } from 'react';
import { C, F, S, formatShortDate, formatCurrency } from './tokens';

const PAGE_SIZE = 25;

export default function Timeline({ profile, onSelectSession }) {
  const [expanded, setExpanded] = useState(false);

  const events = useMemo(() => buildEvents(profile, onSelectSession), [profile, onSelectSession]);
  const visible = expanded ? events : events.slice(0, PAGE_SIZE);
  const hidden = events.length - visible.length;

  if (!events.length) {
    return (
      <Card>
        <SectionHeader icon="📜" label="Timeline" subtitle="Bookings, sessions, packages, and gifts" />
        <EmptyState>Nothing on record yet. Book this client's first session or send them an intake form to get started.</EmptyState>
      </Card>
    );
  }

  // Group by relative time bucket
  const buckets = groupByBucket(visible);

  return (
    <Card>
      <SectionHeader
        icon="📜"
        label="Timeline"
        subtitle={`${events.length} event${events.length === 1 ? '' : 's'} on record`}
      />
      <div style={{ position: 'relative' }}>
        {buckets.map(({ label, items }) => (
          <div key={label} style={{ marginBottom: S.lg }}>
            <BucketLabel>{label}</BucketLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map(ev => <EventRow key={ev.id} ev={ev} />)}
            </div>
          </div>
        ))}
        {hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            style={{
              marginTop: 6,
              background: C.cream,
              border: `1px solid ${C.lineFaint}`,
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              color: C.ink,
              cursor: 'pointer',
              fontFamily: F.sans,
              width: '100%',
            }}
          >
            Show {hidden} more event{hidden === 1 ? '' : 's'}
          </button>
        )}
      </div>
    </Card>
  );
}

function buildEvents(profile, onSelectSession) {
  if (!profile) return [];
  const out = [];

  // Bookings
  for (const b of profile.bookings || []) {
    const dateStr = b.booking_date;
    if (!dateStr) continue;
    const isPast = dateStr < new Date().toISOString().slice(0, 10);
    const isCompleted = b.status === 'completed';
    const isCancelled = b.status === 'cancelled' || b.status === 'no_show';
    out.push({
      id: `booking-${b.id}`,
      type: 'booking',
      // Bookings only have a date, no time precision beyond start_time
      // (which is a string like "10:00:00"). For ordering, combine them.
      timestamp: dateStr + 'T' + (b.start_time || '00:00:00'),
      icon: isCancelled ? '🚫' : isCompleted ? '✅' : isPast ? '📅' : '🗓️',
      tone: isCancelled ? 'rose' : isCompleted ? 'sage' : isPast ? 'inkSoft' : 'gold',
      title: isCancelled
        ? `Cancelled — ${b.service?.name || 'Session'}`
        : isCompleted
          ? `${b.service?.name || 'Session'}`
          : isPast
            ? `${b.service?.name || 'Session'} (past, no SOAP)`
            : `${b.service?.name || 'Session'} (upcoming)`,
      detail: [
        b.start_time ? b.start_time.slice(0, 5) : null,
        b.service?.duration ? `${b.service.duration} min` : null,
        b.service?.price ? formatCurrency(b.service.price) : null,
      ].filter(Boolean).join(' · '),
    });
  }

  // Sessions (SOAP notes). Only surface session events that don't
  // already correspond to a counted booking, to avoid duplicate rows.
  const bookingIds = new Set((profile.bookings || []).map(b => b.id));
  for (const s of profile.sessions || []) {
    if (s.booking_id && bookingIds.has(s.booking_id)) {
      // Already represented by the booking event.
      continue;
    }
    const ts = s.completed_at || s.created_at;
    if (!ts) continue;
    out.push({
      id: `session-${s.id}`,
      type: 'session',
      timestamp: ts,
      icon: s.completed ? '📝' : '🧭',
      tone: s.completed ? 'sage' : 'gold',
      title: s.completed ? 'SOAP note saved' : 'Intake submitted',
      detail: !s.completed ? 'Awaiting SOAP note' : null,
      onClick: onSelectSession ? () => onSelectSession(s) : undefined,
    });
  }

  // Package purchases
  for (const p of profile.packagePurchases || []) {
    out.push({
      id: `pkg-${p.id}`,
      type: 'package',
      timestamp: p.purchased_at,
      icon: '🎟',
      tone: 'gold',
      title: `Bought ${p.package?.name || 'package'}`,
      detail: `${p.sessions_purchased} sessions · ${formatCurrency(p.price_paid)}`,
    });
  }

  // Member subscriptions (started or renewed)
  for (const m of profile.memberSubscriptions || []) {
    out.push({
      id: `sub-${m.id}`,
      type: 'subscription',
      timestamp: m.started_at || m.current_period_start,
      icon: '✨',
      tone: 'green',
      title: `Joined ${m.membership?.name || 'Membership'}`,
      detail: `${m.monthly_session_credits} session${m.monthly_session_credits === 1 ? '' : 's'}/month · ${formatCurrency(m.monthly_price)}/mo`,
    });
  }

  // Gift certificates received
  for (const g of profile.giftCertificates || []) {
    out.push({
      id: `gift-${g.id}`,
      type: 'gift',
      timestamp: g.created_at,
      icon: '🎁',
      tone: 'rose',
      title: `Gift card from ${g.purchaser_name || 'someone'}`,
      detail: `${formatCurrency(g.amount)} · ${g.status === 'redeemed' ? 'Redeemed' : `${formatCurrency(g.remaining)} remaining`}`,
    });
  }

  // Sort reverse chronologically
  out.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  return out;
}

function groupByBucket(events) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const weekAgo = Date.now() - 7 * 86400000;
  const monthAgo = Date.now() - 30 * 86400000;

  const buckets = {
    today: { label: 'Today', items: [] },
    yesterday: { label: 'Yesterday', items: [] },
    thisWeek: { label: 'This week', items: [] },
    thisMonth: { label: 'This month', items: [] },
  };
  const byMonth = new Map();

  for (const ev of events) {
    const ts = ev.timestamp || '';
    const datePart = ts.slice(0, 10);
    const time = new Date(ts).getTime();
    if (datePart === todayStr) buckets.today.items.push(ev);
    else if (datePart === yesterdayStr) buckets.yesterday.items.push(ev);
    else if (time >= weekAgo) buckets.thisWeek.items.push(ev);
    else if (time >= monthAgo) buckets.thisMonth.items.push(ev);
    else {
      const d = new Date(ts);
      const key = isNaN(d) ? 'Earlier' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!byMonth.has(key)) byMonth.set(key, { label: key, items: [] });
      byMonth.get(key).items.push(ev);
    }
  }

  const result = [];
  if (buckets.today.items.length) result.push(buckets.today);
  if (buckets.yesterday.items.length) result.push(buckets.yesterday);
  if (buckets.thisWeek.items.length) result.push(buckets.thisWeek);
  if (buckets.thisMonth.items.length) result.push(buckets.thisMonth);
  for (const m of byMonth.values()) result.push(m);
  return result;
}

function EventRow({ ev }) {
  const [hover, setHover] = useState(false);
  const TONES = {
    sage:    C.sage,
    gold:    C.gold,
    rose:    C.rose,
    green:   C.green,
    inkSoft: C.inkSoft,
    amber:   C.amber,
  };
  const accent = TONES[ev.tone] || C.inkSoft;
  const interactive = !!ev.onClick;

  return (
    <div
      onClick={ev.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: S.md,
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 8,
        cursor: interactive ? 'pointer' : 'default',
        background: hover && interactive ? C.cream : 'transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <div style={{
        width: 28, height: 28,
        borderRadius: '50%',
        background: C.cream,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        flexShrink: 0,
        border: `2px solid ${accent}`,
      }}>
        {ev.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13.5,
          color: C.forest,
          fontFamily: F.sans,
          fontWeight: 600,
          lineHeight: 1.3,
        }}>
          {ev.title}
        </div>
        {ev.detail && (
          <div style={{
            fontSize: 11.5,
            color: C.inkSoft,
            fontFamily: F.sans,
            marginTop: 1,
          }}>
            {ev.detail}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 11,
        color: C.muted,
        fontFamily: F.sans,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {formatShortDate(ev.timestamp)}
      </div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{
      background: C.paper,
      border: `1px solid ${C.lineFaint}`,
      borderRadius: 14,
      padding: S.xl,
      marginBottom: S.lg,
      boxShadow: '0 1px 2px rgba(28,43,34,0.03)',
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, label, subtitle }) {
  return (
    <div style={{ marginBottom: S.lg }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 3,
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h2 style={{
          margin: 0,
          fontFamily: F.serif,
          fontSize: 17, fontWeight: 700,
          color: C.forest,
          lineHeight: 1.2,
        }}>
          {label}
        </h2>
      </div>
      {subtitle && (
        <div style={{
          fontSize: 12,
          color: C.muted,
          fontFamily: F.sans,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function BucketLabel({ children }) {
  return (
    <div style={{
      fontSize: 10.5,
      fontWeight: 700,
      color: C.muted,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      marginBottom: 6,
      paddingLeft: 6,
      fontFamily: F.sans,
    }}>
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{
      fontSize: 13,
      color: C.muted,
      fontFamily: F.sans,
      lineHeight: 1.5,
      padding: '6px 0',
    }}>
      {children}
    </div>
  );
}
