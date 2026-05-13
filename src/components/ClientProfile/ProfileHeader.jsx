// src/components/ClientProfile/ProfileHeader.jsx
//
// Top section of the redesigned therapist client view. Sticky so the
// therapist always knows who they're looking at as they scroll down.
//
// Layout: [< Back] [Avatar] [Name + subline] [phone] [email] [⋯ menu]
//
// Mobile collapses to two rows: row 1 has back + avatar + name,
// row 2 has the action buttons and subline. Desktop fits it all in
// one row.

import React, { useState } from 'react';
import { C, F, S, initials, avatarColor, formatMonthYear } from './tokens';

export default function ProfileHeader({
  client,
  stats,
  onBack,
  onEdit,
  onArchive,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!client) return null;

  // Subline: a single short status line so the therapist knows the
  // emotional shape of this client at a glance.
  //   "Member since Aug 2024"   — most clients
  //   "Lapsed · last visit 73 days ago"  — overdue
  //   "New · first visit pending"        — never seen
  //   "Today at 2pm"                     — booked for today
  const subline = (() => {
    if (stats?.nextBooking) {
      const dateStr = stats.nextBooking.booking_date;
      const todayStr = new Date().toISOString().slice(0, 10);
      const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const when = dateStr === todayStr ? 'today' : dateStr === tomorrowStr ? 'tomorrow' : new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const time = stats.nextBooking.start_time ? stats.nextBooking.start_time.slice(0, 5) : '';
      return `Booked ${when}${time ? ' at ' + time : ''}`;
    }
    if (stats?.lifetimeSessions === 0) {
      return 'New · no visits yet';
    }
    if (stats?.daysSinceVisit !== null && stats?.daysSinceVisit >= 60) {
      return `Lapsed · last visit ${stats.daysSinceVisit}d ago`;
    }
    if (client.created_at) {
      return `Client since ${formatMonthYear(client.created_at)}`;
    }
    return null;
  })();

  // Status pill color follows the subline mood
  const sublineColor = (() => {
    if (!subline) return C.inkSoft;
    if (subline.startsWith('Booked')) return C.sage;
    if (subline.startsWith('Lapsed')) return C.amber;
    if (subline.startsWith('New')) return C.gold;
    return C.inkSoft;
  })();

  const archived = !!client.do_not_rebook;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: C.paper,
      borderBottom: `1px solid ${C.lineFaint}`,
      padding: '14px 18px',
      marginBottom: S.lg,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto auto 1fr auto',
        gap: S.md,
        alignItems: 'center',
      }}>
        {/* Back button */}
        <button
          onClick={onBack}
          aria-label="Back to clients"
          style={{
            background: C.cream,
            border: `1px solid ${C.lineFaint}`,
            borderRadius: 8,
            padding: '7px 11px',
            fontSize: 12,
            fontWeight: 600,
            color: C.ink,
            cursor: 'pointer',
            fontFamily: F.sans,
            whiteSpace: 'nowrap',
          }}
        >
          ← All
        </button>

        {/* Avatar */}
        <div style={{
          width: 48, height: 48,
          borderRadius: '50%',
          background: archived ? '#9CA3AF' : avatarColor(client.name),
          color: C.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 700,
          fontFamily: F.sans,
          flexShrink: 0,
        }}>
          {initials(client.name)}
        </div>

        {/* Name + subline */}
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            margin: 0,
            fontFamily: F.serif,
            fontSize: 26, fontWeight: 700,
            color: archived ? C.muted : C.forest,
            lineHeight: 1.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            textDecoration: archived ? 'line-through' : 'none',
            textDecorationColor: C.muted,
          }}>
            {client.name || 'Unnamed client'}
          </h1>
          {subline && (
            <div style={{
              marginTop: 3,
              fontSize: 12.5,
              color: sublineColor,
              fontWeight: 600,
              fontFamily: F.sans,
              letterSpacing: '0.01em',
            }}>
              {subline}
            </div>
          )}
        </div>

        {/* Action buttons + menu */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: S.sm,
        }}>
          {client.phone && (
            <a
              href={`tel:${client.phone.replace(/\D/g, '')}`}
              title="Call"
              aria-label={`Call ${client.name}`}
              style={iconBtnStyle}
            >
              📞
            </a>
          )}
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              title="Email"
              aria-label={`Email ${client.name}`}
              style={iconBtnStyle}
            >
              ✉️
            </a>
          )}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              style={{
                ...iconBtnStyle,
                background: menuOpen ? C.cream : C.paper,
              }}
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: C.paper,
                  border: `1px solid ${C.lineFaint}`,
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(28,43,34,0.10)',
                  padding: 6,
                  minWidth: 160,
                  zIndex: 20,
                }}
                onMouseLeave={() => setMenuOpen(false)}
              >
                <MenuItem
                  label="Edit details"
                  onClick={() => { setMenuOpen(false); onEdit?.(); }}
                />
                <MenuItem
                  label={archived ? 'Restore' : 'Archive'}
                  destructive={!archived}
                  onClick={() => { setMenuOpen(false); onArchive?.(); }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  width: 38, height: 38,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: C.paper,
  border: `1px solid ${C.lineFaint}`,
  borderRadius: 9,
  cursor: 'pointer',
  fontSize: 16,
  textDecoration: 'none',
  color: C.ink,
  fontFamily: F.sans,
};

function MenuItem({ label, onClick, destructive = false }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        borderRadius: 6,
        background: hover ? (destructive ? C.redBg : C.cream) : 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: F.sans,
        fontSize: 13,
        fontWeight: 500,
        color: destructive ? C.red : C.ink,
      }}
    >
      {label}
    </button>
  );
}
