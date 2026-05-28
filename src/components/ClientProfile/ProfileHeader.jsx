// src/components/ClientProfile/ProfileHeader.jsx
//
// Hero band at the top of the therapist client profile.
// Renders different visual energy based on client state:
//
//   VIP        gold gradient        high lifetime + member/package
//   Regular    sage gradient        active client with package or recent visit
//   Booked     forest gradient      has an upcoming booking
//   Lapsed     amber gradient       no visit 60+ days
//   New        cream gradient       no visits on record yet
//
// Layout: large 88px avatar, 36px name (serif), state pill, contextual
// subline, then a row of icon-buttons for phone/email and a menu.
// Mobile-adapts: avatar stays large, action buttons wrap below.

import React, { useState } from 'react';
import { C, F, S, initials, avatarColor, formatMonthYear } from './tokens';
import { parseDateOnly, todayLocalIso, tomorrowLocalIso } from '../../lib/dateHelpers';

// Inline SVGs for tooling icons. Better contrast and weight control
// than emoji. Each is sized 18px stroke-1.6 to match a calm, premium
// feel.
const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.92.31 1.82.57 2.69a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.39-1.39a2 2 0 0 1 2.11-.45c.87.26 1.77.45 2.69.57A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-10 5L2 7"/>
  </svg>
);
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

// Compute the state band for the hero. Order matters: VIP wins over
// Regular when both fit. The state drives the gradient + pill.
function computeState({ client, stats, profile }) {
  if (!client) return STATES.new;
  const hasMembership = (profile?.memberSubscriptions || []).some(m => m.status === 'active');
  const hasPackage = (profile?.packagePurchases || []).some(p => p.status === 'active');
  const lifetimeSessions = stats?.lifetimeSessions || 0;
  const daysSince = stats?.daysSinceVisit;

  // VIP: a lot of history + currently active balance
  if (lifetimeSessions >= 10 && (hasMembership || hasPackage)) return STATES.vip;

  // Lapsed: long time no visit. Beats other states because the
  // therapist needs to see this before they see "regular."
  if (daysSince !== null && daysSince >= 60) return STATES.lapsed;

  // Booked: has an upcoming appointment
  if (stats?.nextBooking) return STATES.booked;

  // Regular: has visits + active balance
  if (lifetimeSessions >= 3 && (hasMembership || hasPackage)) return STATES.regular;

  // Returning: has visits but no current package/membership
  if (lifetimeSessions >= 3) return STATES.returning;

  // New: never seen, or only 1-2 visits
  return STATES.new;
}

const STATES = {
  vip: {
    key: 'vip',
    bg: 'linear-gradient(135deg, #FAF3DC 0%, #F2E1A8 50%, #E8D085 100%)',
    accent: '#92660E',
    pill: 'VIP',
    pillBg: '#92660E',
    pillFg: '#FAF3DC',
    nameColor: '#3A2A04',
    sublineColor: '#7A5208',
  },
  regular: {
    key: 'regular',
    bg: 'linear-gradient(135deg, #F0F7F2 0%, #DCEAE0 100%)',
    accent: '#4A6B54',
    pill: 'Regular',
    pillBg: '#4A6B54',
    pillFg: '#F0F7F2',
    nameColor: '#1C2B22',
    sublineColor: '#3D4F43',
  },
  booked: {
    key: 'booked',
    bg: 'linear-gradient(135deg, #F0F7F2 0%, #C9DCD0 100%)',
    accent: '#1C2B22',
    pill: 'Booked',
    pillBg: '#1C2B22',
    pillFg: '#F0F7F2',
    nameColor: '#1C2B22',
    sublineColor: '#3D4F43',
  },
  returning: {
    key: 'returning',
    bg: 'linear-gradient(135deg, #F9F5EE 0%, #EFE7D2 100%)',
    accent: '#3D4F43',
    pill: 'Returning',
    pillBg: '#3D4F43',
    pillFg: '#F9F5EE',
    nameColor: '#1C2B22',
    sublineColor: '#3D4F43',
  },
  lapsed: {
    key: 'lapsed',
    bg: 'linear-gradient(135deg, #FEF3C7 0%, #FCE7A8 100%)',
    accent: '#92400E',
    pill: 'Lapsed',
    pillBg: '#92400E',
    pillFg: '#FEF3C7',
    nameColor: '#451A03',
    sublineColor: '#78350F',
  },
  new: {
    key: 'new',
    bg: 'linear-gradient(135deg, #FCE5E0 0%, #F9D2C8 100%)',
    accent: '#9A3B5E',
    pill: 'New',
    pillBg: '#9A3B5E',
    pillFg: '#FCE5E0',
    nameColor: '#3A0A1A',
    sublineColor: '#7C2D4E',
  },
};

export default function ProfileHeader({
  client,
  stats,
  profile,
  onBack,
  onEdit,
  onArchive,
  // HK May 27 2026 Ship 1: hoist the four primary client actions up
  // from SessionList ('Sessions and SOAP notes' panel) into the
  // header so the 70yo persona doesn't have to scroll past 4-5
  // cards to find Edit/Book/Merge. Each prop opens the same modal
  // SessionList already owns (no duplicate UI; ClientProfile/index
  // wires the buttons to the existing trigger state).
  onEditClick,
  onBookClick,
  onMergeClick,
  // HK May 27 2026: Archive is now an inline confirmation row owned
  // by ProfileHeader, not a modal in SessionList. onArchiveConfirm
  // receives the picked reason; onRestoreConfirm un-archives. The
  // parent (ClientProfile/index) does the Supabase write.
  onArchiveConfirm,
  onRestoreConfirm,
  archiveSaving,
}) {
  // HK May 27 2026: inline archive confirmation. No modal, no
  // overlay. Tapping Archive expands a reason picker right below the
  // button row. 70yo persona never loses context. The Unprofessional
  // reason is intentionally included: there is an industry need to
  // flag clients who mistreat solo practitioners. A future feature
  // (not built yet) may cross-reference: if two separate therapists
  // independently flag the same client unprofessional, that client
  // could be blocked from booking through the portal.
  // Hooks must run before any early return (rules-of-hooks).
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pickedReason, setPickedReason] = useState(null);
  const ARCHIVE_REASONS = [
    'Do not rebook',
    'Deceased',
    'Moved away',
    'Requested removal',
    'Unprofessional',
    'Other',
  ];

  if (!client) return null;

  const state = computeState({ client, stats, profile });

  // Subline mirrors the state but adds specific context. The pill
  // tells you WHICH state; the subline tells you the proof.
  const subline = (() => {
    if (state.key === 'booked' && stats?.nextBooking) {
      const dateStr = stats.nextBooking.booking_date;
      const todayStr = todayLocalIso();
      const tomorrowStr = tomorrowLocalIso();
      const when = dateStr === todayStr
        ? 'today'
        : dateStr === tomorrowStr
          ? 'tomorrow'
          : parseDateOnly(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const time = stats.nextBooking.start_time ? stats.nextBooking.start_time.slice(0, 5) : '';
      return `Next visit ${when}${time ? ' at ' + time : ''}`;
    }
    if (state.key === 'lapsed') {
      return `${stats?.daysSinceVisit}d since last visit. Reach out?`;
    }
    if (state.key === 'vip') {
      return `${stats?.lifetimeSessions} lifetime sessions. Active balance on file.`;
    }
    if (state.key === 'regular') {
      return `Active client. Balance on file.`;
    }
    if (state.key === 'returning') {
      return `${stats?.lifetimeSessions} lifetime sessions. No package or membership.`;
    }
    if (state.key === 'new') {
      if (stats?.lifetimeSessions === 0) return 'First visit pending';
      return `${stats?.lifetimeSessions} session${stats?.lifetimeSessions === 1 ? '' : 's'} so far`;
    }
    return client.created_at ? `Client since ${formatMonthYear(client.created_at)}` : null;
  })();

  const archived = !!client.do_not_rebook;

  return (
    <div style={{
      background: archived
        ? `linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)`
        : state.bg,
      borderBottom: `1px solid rgba(28,43,34,0.08)`,
      marginBottom: S.lg,
    }}>
      <div style={{
        padding: '14px 14px 18px',
      }}>
        {/* Top row: back button + state pill + actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <button
            onClick={onBack}
            aria-label="Back to clients"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: `1px solid rgba(28,43,34,0.10)`,
              borderRadius: 999,
              padding: '6px 12px 6px 8px',
              fontSize: 12,
              fontWeight: 600,
              color: state.sublineColor,
              cursor: 'pointer',
              fontFamily: F.sans,
              whiteSpace: 'nowrap',
            }}
          >
            <IconBack />
            All clients
          </button>

          {/* State pill */}
          {!archived && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: state.pillBg,
              color: state.pillFg,
              padding: '5px 11px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: F.sans,
              boxShadow: `0 2px 8px rgba(28,43,34,0.12)`,
            }}>
              {state.pill}
            </span>
          )}
          {archived && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#6B7280',
              color: '#F9FAFB',
              padding: '5px 11px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: F.sans,
            }}>
              Archived
            </span>
          )}

          {/* Action buttons.
              Editing client details lives inline in the Client Info
              section below; the redundant hero Edit button has been
              removed. Archive moves to a quiet link at the bottom of
              the Client Info section so destructive actions sit next
              to editing context, not in the hero. The hero now only
              carries quick-action buttons (call + email) that make
              sense to do without opening the profile body. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {client.phone && (
              <a
                href={`tel:${client.phone.replace(/\D/g, '')}`}
                title="Call"
                aria-label={`Call ${client.name}`}
                style={glassBtnStyle(state)}
              >
                <IconPhone />
              </a>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                title="Email"
                aria-label={`Email ${client.name}`}
                style={glassBtnStyle(state)}
              >
                <IconMail />
              </a>
            )}
          </div>
        </div>

        {/* Main row: avatar + name */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div className="bm-cp-avatar" style={{
            width: 64, height: 64,
            borderRadius: '50%',
            background: archived ? '#9CA3AF' : avatarColor(client.name),
            color: C.paper,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700,
            fontFamily: F.sans,
            flexShrink: 0,
            boxShadow: '0 4px 16px rgba(28,43,34,0.18), 0 0 0 4px rgba(255,255,255,0.6)',
          }}>
            {initials(client.name)}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="bm-cp-name" style={{
              margin: 0,
              fontFamily: F.serif,
              fontSize: 28, fontWeight: 700,
              color: archived ? C.muted : state.nameColor,
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textDecoration: archived ? 'line-through' : 'none',
              textDecorationColor: C.muted,
            }}>
              {client.name || 'Unnamed client'}
            </h1>
            <style>{`
              @media (min-width: 480px) {
                .bm-cp-avatar { width: 72px !important; height: 72px !important; font-size: 24px !important; }
                .bm-cp-name { font-size: 32px !important; }
              }
              @media (min-width: 768px) {
                .bm-cp-avatar { width: 80px !important; height: 80px !important; font-size: 28px !important; }
                .bm-cp-name { font-size: 38px !important; }
              }
            `}</style>
            {subline && (
              <div style={{
                marginTop: 6,
                fontSize: 12.5,
                color: state.sublineColor,
                fontWeight: 600,
                fontFamily: F.sans,
                letterSpacing: '0.005em',
              }}>
                {subline}
              </div>
            )}
          </div>
        </div>

        {/* HK May 27 2026 Ship 1: primary client actions, hoisted up
            from the Sessions and SOAP notes panel. 70yo persona is
            tired of scrolling past 4-5 cards to find these. Order
            matches existing convention from SessionList: Edit / Book /
            Merge / Archive. Book is the primary (forest), the rest
            are quiet outline buttons. Wraps on narrow screens. */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 16,
        }}>
          {onEditClick && (
            <button
              onClick={onEditClick}
              style={{
                background: 'rgba(255,255,255,0.7)',
                color: '#1F4030',
                border: '1.5px solid rgba(28,43,34,0.14)',
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: F.sans,
                whiteSpace: 'nowrap',
              }}>
              Edit details
            </button>
          )}
          {onBookClick && !archived && (
            <button
              onClick={onBookClick}
              style={{
                background: '#1C2B22',
                color: '#FFFFFF',
                border: '1.5px solid #1C2B22',
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: F.sans,
                whiteSpace: 'nowrap',
              }}>
              📅 Book next
            </button>
          )}
          {onMergeClick && (
            <button
              onClick={onMergeClick}
              style={{
                background: 'rgba(255,255,255,0.7)',
                color: '#1F4030',
                border: '1.5px solid rgba(28,43,34,0.14)',
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: F.sans,
                whiteSpace: 'nowrap',
              }}>
              Merge
            </button>
          )}
          {(onArchiveConfirm || onRestoreConfirm) && (
            <button
              onClick={() => {
                if (archived) {
                  onRestoreConfirm?.();
                } else {
                  setArchiveOpen(v => !v);
                  setPickedReason(null);
                }
              }}
              disabled={archiveSaving}
              style={{
                background: archiveOpen ? '#FEF2F2' : 'rgba(255,255,255,0.7)',
                color: archiveOpen ? '#991B1B' : '#6B7280',
                border: `1.5px solid ${archiveOpen ? '#FCA5A5' : 'rgba(28,43,34,0.14)'}`,
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: archiveSaving ? 'wait' : 'pointer',
                fontFamily: F.sans,
                whiteSpace: 'nowrap',
              }}>
              {archived ? (archiveSaving ? 'Restoring...' : 'Restore') : (archiveOpen ? 'Cancel' : 'Archive')}
            </button>
          )}
        </div>

        {/* Inline archive confirmation row. HK May 27 2026: replaces
            the modal. Expands in place below the action buttons.
            No overlay. Reason chips + Confirm. 70yo persona never
            loses their place. */}
        {archiveOpen && !archived && (
          <div style={{
            marginTop: 12,
            padding: '14px 16px',
            background: '#FEF2F2',
            border: '1.5px solid #FCA5A5',
            borderRadius: 14,
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#991B1B',
              marginBottom: 4,
            }}>
              Archive {client.name?.split(' ')[0] || 'this client'}?
            </div>
            <div style={{
              fontSize: 12,
              color: '#7A3A2E',
              lineHeight: 1.5,
              marginBottom: 12,
            }}>
              They will be hidden from your active client list. Pick a reason. You can restore them anytime.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {ARCHIVE_REASONS.map(r => {
                const sel = pickedReason === r;
                return (
                  <button
                    key={r}
                    onClick={() => setPickedReason(r)}
                    style={{
                      background: sel ? '#991B1B' : '#fff',
                      color: sel ? '#fff' : '#7A3A2E',
                      border: `1.5px solid ${sel ? '#991B1B' : '#FCA5A5'}`,
                      borderRadius: 999,
                      padding: '6px 13px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: F.sans,
                    }}>
                    {r}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setArchiveOpen(false); setPickedReason(null); }}
                disabled={archiveSaving}
                style={{
                  flex: 1,
                  background: '#fff',
                  color: '#6B7280',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 10,
                  padding: '11px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: F.sans,
                }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!pickedReason) return;
                  onArchiveConfirm?.(pickedReason);
                  setArchiveOpen(false);
                }}
                disabled={!pickedReason || archiveSaving}
                style={{
                  flex: 2,
                  background: (!pickedReason || archiveSaving) ? '#D1A8A2' : '#991B1B',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '11px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: (!pickedReason || archiveSaving) ? 'not-allowed' : 'pointer',
                  fontFamily: F.sans,
                }}>
                {archiveSaving ? 'Archiving...' : pickedReason ? `Archive (${pickedReason})` : 'Pick a reason first'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function glassBtnStyle(state) {
  return {
    width: 38, height: 38,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    border: `1px solid rgba(28,43,34,0.10)`,
    borderRadius: 10,
    cursor: 'pointer',
    color: state.sublineColor,
    textDecoration: 'none',
    fontFamily: F.sans,
    transition: 'background 0.18s ease',
  };
}

