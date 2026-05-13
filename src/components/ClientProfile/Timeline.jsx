// src/components/ClientProfile/Timeline.jsx
//
// Activity timeline for the client profile, redesigned.
//
// Design principles:
//   - The DATE is the visual anchor, not the service name. Large
//     month + day on the left, all detail to the right.
//   - Repeated service names are suppressed. If three sessions in a
//     row are 'Sports Massage 60 min', only the first row shows the
//     name; the next ones say 'Same as above' in italic muted.
//   - The most recent event gets a 'LATEST' pill so the eye lands
//     on it first.
//   - Older history collapses into one summary row per month
//     ('4 sessions · Sports Massage 60 min'). Click to expand.
//   - Rows are CLICKABLE when a session exists for them. Click
//     opens the SOAP editor directly.
//
// Replaces the previous design that rendered every event as an
// identical-looking row in narrow time buckets, producing the
// 'unending scroll' HK called out.

import React, { useState, useMemo } from 'react';
import { C, F, S, formatCurrency } from './tokens';

const RECENT_LIMIT = 6;
const OLDER_THRESHOLD_DAYS = 90;

export default function Timeline({ profile, onSelectSession }) {
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  const events = useMemo(() => buildEvents(profile, onSelectSession), [profile, onSelectSession]);

  if (!events.length) {
    return (
      <Card>
        <Header count={0} />
        <EmptyState>
          Nothing on record yet. Book this client's first session or
          send them an intake form to get started.
        </EmptyState>
      </Card>
    );
  }

  const now = Date.now();
  const cutoff = now - OLDER_THRESHOLD_DAYS * 86400000;
  const recent = [];
  const older = [];
  for (const ev of events) {
    const t = new Date(ev.timestamp).getTime();
    if (t >= cutoff && recent.length < RECENT_LIMIT) recent.push(ev);
    else older.push(ev);
  }

  const olderByMonth = new Map();
  for (const ev of older) {
    const d = new Date(ev.timestamp);
    const key = isNaN(d) ? 'Earlier' : `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const label = isNaN(d) ? 'Earlier' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!olderByMonth.has(key)) olderByMonth.set(key, { key, label, items: [] });
    olderByMonth.get(key).items.push(ev);
  }
  const olderGroups = [...olderByMonth.values()];

  return (
    <Card>
      <Header count={events.length} />

      <div style={{ marginTop: 6 }}>
        {recent.map((ev, i) => (
          <Row
            key={ev.id}
            ev={ev}
            prevEv={recent[i - 1]}
            isLatest={i === 0}
          />
        ))}
      </div>

      {olderGroups.length > 0 && (
        <div style={{
          marginTop: 10,
          paddingTop: 14,
          borderTop: `1px solid ${C.lineFaint}`,
        }}>
          <div style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: C.muted,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 8,
            fontFamily: F.sans,
          }}>
            Earlier
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {olderGroups.map(g => (
              <MonthGroup
                key={g.key}
                group={g}
                expanded={expandedMonths.has(g.key)}
                onToggle={() => {
                  setExpandedMonths(s => {
                    const next = new Set(s);
                    if (next.has(g.key)) next.delete(g.key);
                    else next.add(g.key);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function buildEvents(profile, onSelectSession) {
  if (!profile) return [];

  const sessionByBookingId = new Map();
  const standaloneSessions = [];
  for (const s of profile.sessions || []) {
    if (s.booking_id) sessionByBookingId.set(s.booking_id, s);
    else standaloneSessions.push(s);
  }

  const out = [];

  for (const b of profile.bookings || []) {
    const dateStr = b.booking_date;
    if (!dateStr) continue;
    const isPast = dateStr < new Date().toISOString().slice(0, 10);
    const isCompleted = b.status === 'completed';
    const isCancelled = b.status === 'cancelled' || b.status === 'no_show';
    const session = sessionByBookingId.get(b.id);
    const hasSOAP = session && session.completed;
    const hasIntake = session && !session.completed;

    out.push({
      id: `booking-${b.id}`,
      type: 'booking',
      timestamp: dateStr + 'T' + (b.start_time || '00:00:00'),
      service: b.service?.name || 'Session',
      duration: b.service?.duration,
      price: b.service?.price,
      time: b.start_time ? b.start_time.slice(0, 5) : null,
      tone: isCancelled ? 'rose' : hasSOAP ? 'sage' : hasIntake ? 'gold' : isPast ? 'inkSoft' : 'forest',
      statusLabel: isCancelled ? 'Cancelled'
                : hasSOAP ? 'SOAP saved'
                : hasIntake ? 'Intake pending'
                : isPast ? 'No notes'
                : 'Upcoming',
      onClick: session && onSelectSession ? () => onSelectSession(session) : undefined,
    });
  }

  for (const s of standaloneSessions) {
    const ts = s.completed_at || s.created_at;
    if (!ts) continue;
    out.push({
      id: `session-${s.id}`,
      type: 'session',
      timestamp: ts,
      service: 'Session',
      time: null,
      duration: null,
      price: null,
      tone: s.completed ? 'sage' : 'gold',
      statusLabel: s.completed ? 'SOAP saved' : 'Intake submitted',
      onClick: onSelectSession ? () => onSelectSession(s) : undefined,
    });
  }

  for (const p of profile.packagePurchases || []) {
    if (!p.purchased_at) continue;
    out.push({
      id: `pkg-${p.id}`,
      type: 'package',
      timestamp: p.purchased_at,
      service: `Bought ${p.package?.name || 'package'}`,
      duration: null,
      price: p.price_paid,
      time: null,
      tone: 'gold',
      statusLabel: `${p.sessions_purchased} sessions`,
    });
  }

  for (const m of profile.memberSubscriptions || []) {
    const ts = m.started_at || m.current_period_start;
    if (!ts) continue;
    out.push({
      id: `sub-${m.id}`,
      type: 'subscription',
      timestamp: ts,
      service: `Joined ${m.membership?.name || 'Membership'}`,
      duration: null,
      price: m.monthly_price,
      time: null,
      tone: 'green',
      statusLabel: `${m.monthly_session_credits}/mo`,
    });
  }

  for (const g of profile.giftCertificates || []) {
    if (!g.created_at) continue;
    out.push({
      id: `gift-${g.id}`,
      type: 'gift',
      timestamp: g.created_at,
      service: `Gift from ${g.purchaser_name || 'someone'}`,
      duration: null,
      price: g.amount,
      time: null,
      tone: 'rose',
      statusLabel: g.status === 'redeemed' ? 'Redeemed' : 'Available',
    });
  }

  out.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  return out;
}

function Card({ children }) {
  return (
    <div style={{
      background: C.paper,
      border: `1px solid ${C.lineFaint}`,
      borderRadius: 14,
      padding: '18px 18px 14px',
      marginBottom: S.lg,
      boxShadow: '0 1px 2px rgba(28,43,34,0.03)',
    }}>
      {children}
    </div>
  );
}

function Header({ count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
      marginBottom: 2,
    }}>
      <h2 style={{
        margin: 0,
        fontFamily: F.serif,
        fontSize: 18, fontWeight: 700,
        color: C.forest,
        lineHeight: 1.2,
      }}>
        Timeline
      </h2>
      <div style={{
        fontSize: 11,
        color: C.muted,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontFamily: F.sans,
      }}>
        {count} event{count === 1 ? '' : 's'}
      </div>
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
      padding: '14px 0 6px',
    }}>
      {children}
    </div>
  );
}

function Row({ ev, prevEv, isLatest }) {
  const [hover, setHover] = useState(false);
  const interactive = !!ev.onClick;
  const sameServiceAsPrev = prevEv && prevEv.service === ev.service && prevEv.type === ev.type;

  const TONES = {
    sage:    { dot: '#4A6B54', text: '#1C2B22', tag: '#F0F7F2' },
    gold:    { dot: '#92660E', text: '#3A2A04', tag: '#FAF3DC' },
    rose:    { dot: '#9A3B5E', text: '#3A0A1A', tag: '#FCE5E0' },
    green:   { dot: '#16A34A', text: '#14532D', tag: '#F0FDF4' },
    forest:  { dot: '#1C2B22', text: '#1C2B22', tag: '#E8E0D0' },
    inkSoft: { dot: '#6B7F72', text: '#3D4F43', tag: '#F9F5EE' },
  };
  const t = TONES[ev.tone] || TONES.inkSoft;

  const d = new Date(ev.timestamp);
  const month = isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = isNaN(d) ? '' : d.getDate();
  const year = isNaN(d) ? '' : d.getFullYear();
  const currentYear = new Date().getFullYear();
  const showYear = year && year !== currentYear;

  return (
    <div
      onClick={ev.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr auto',
        gap: 14,
        alignItems: 'center',
        padding: '10px 8px 10px 4px',
        borderRadius: 10,
        cursor: interactive ? 'pointer' : 'default',
        background: hover && interactive ? C.cream : 'transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <div style={{
        textAlign: 'center',
        padding: '6px 0',
        background: isLatest ? t.tag : 'transparent',
        borderRadius: 8,
        border: isLatest ? `1px solid ${t.dot}33` : '1px solid transparent',
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: t.dot,
          letterSpacing: '0.12em',
          fontFamily: F.sans,
          lineHeight: 1,
          marginBottom: 2,
        }}>
          {month}
        </div>
        <div style={{
          fontFamily: F.serif,
          fontSize: 22, fontWeight: 700,
          color: t.text,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {day}
        </div>
        {showYear && (
          <div style={{
            fontSize: 9,
            color: C.muted,
            letterSpacing: '0.04em',
            fontFamily: F.sans,
            marginTop: 2,
          }}>
            {year}
          </div>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 2,
        }}>
          {isLatest && (
            <span style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: t.dot,
              background: t.tag,
              padding: '2px 7px',
              borderRadius: 999,
              fontFamily: F.sans,
            }}>
              LATEST
            </span>
          )}
          <span style={{
            fontFamily: F.sans,
            fontSize: 14, fontWeight: 600,
            color: sameServiceAsPrev ? C.muted : C.forest,
            fontStyle: sameServiceAsPrev ? 'italic' : 'normal',
          }}>
            {sameServiceAsPrev ? 'Same as above' : ev.service}
          </span>
        </div>
        {(ev.time || ev.duration || ev.price != null) && (
          <div style={{
            fontSize: 11.5,
            color: C.inkSoft,
            fontFamily: F.sans,
            display: 'flex', gap: 6, alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {ev.time && <span>{ev.time}</span>}
            {ev.time && ev.duration && <Dot />}
            {ev.duration && <span>{ev.duration} min</span>}
            {(ev.time || ev.duration) && ev.price != null && <Dot />}
            {ev.price != null && <span>{formatCurrency(ev.price)}</span>}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: t.dot,
          background: t.tag,
          padding: '4px 9px',
          borderRadius: 999,
          fontFamily: F.sans,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {ev.statusLabel}
        </span>
      </div>
    </div>
  );
}

function Dot() {
  return <span style={{ opacity: 0.4 }}>·</span>;
}

function MonthGroup({ group, expanded, onToggle }) {
  const [hover, setHover] = useState(false);
  const count = group.items.length;
  const services = new Set(group.items.map(e => e.service));
  const summary = services.size === 1 ? [...services][0] : `${services.size} services`;

  return (
    <div>
      <button
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: '56px 1fr auto',
          gap: 14,
          alignItems: 'center',
          padding: '8px 8px 8px 4px',
          borderRadius: 10,
          cursor: 'pointer',
          background: hover ? C.cream : 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          transition: 'background 0.12s ease',
          fontFamily: F.sans,
        }}
      >
        <div style={{
          textAlign: 'center',
          fontSize: 10.5,
          fontWeight: 700,
          color: C.muted,
          letterSpacing: '0.10em',
        }}>
          {group.label.replace(/ \d{4}$/, '').toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.forest,
          }}>
            {count} session{count === 1 ? '' : 's'} <span style={{ color: C.muted, fontWeight: 400 }}>· {summary}</span>
          </div>
        </div>
        <div style={{
          fontSize: 10,
          color: C.muted,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}>
          {expanded ? 'Hide' : 'Show'}
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: 2, marginBottom: 6 }}>
          {group.items.map((ev, i) => (
            <Row
              key={ev.id}
              ev={ev}
              prevEv={group.items[i - 1]}
              isLatest={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
