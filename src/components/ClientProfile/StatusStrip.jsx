// src/components/ClientProfile/StatusStrip.jsx
//
// The four things a therapist scans first when they open a client.
// Renders as a responsive grid of tiles. Each tile is tappable when
// it has a sensible action (e.g., next booking tile opens the
// booking; attention tile jumps to the relevant section).
//
// Tiles:
//   1. Balance      🎟  package + membership inline
//   2. Next visit   📅  date + service or "None scheduled"
//   3. Lifetime     💚  total sessions + dollars
//   4. Attention    ⚠️   pending intake / unfilled SOAP / lapsed
//                       Renders only if there's something to show.

import React from 'react';
import { C, F, S, formatShortDate, formatCurrency } from './tokens';

export default function StatusStrip({ profile, onNextBooking, onAttention }) {
  if (!profile) return null;
  const { stats, packagePurchases = [], memberSubscriptions = [] } = profile;

  // ─── Balance tile content ───
  const activePackage = packagePurchases.find(p => p.status === 'active');
  const activeMembership = memberSubscriptions.find(m => m.status === 'active');
  const hasBalance = activePackage || activeMembership;

  // ─── Attention tile content (only renders if something) ───
  const attention = (() => {
    if (stats?.pendingIntake) {
      return { icon: '🧭', label: 'Intake filled', detail: 'No SOAP note yet', tone: 'amber' };
    }
    if (stats?.daysSinceVisit !== null && stats?.daysSinceVisit >= 60) {
      return { icon: '🍂', label: 'Lapsed', detail: `${stats.daysSinceVisit}d since last visit`, tone: 'amber' };
    }
    return null;
  })();

  return (
    <div style={{
      padding: '0 14px',
      marginBottom: S.lg,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
      }}>
        {/* Balance */}
        <Tile
          icon="🎟"
          label="Balance"
          tone={hasBalance ? 'gold' : 'neutral'}
          accentBorder={hasBalance}
        >
          {!hasBalance && (
            <Detail>No package or membership</Detail>
          )}
          {activePackage && (
            <BigNumber
              value={activePackage.sessions_remaining}
              suffix={`of ${activePackage.sessions_purchased} left`}
              color={
                activePackage.sessions_remaining === 0 ? C.red
                : activePackage.sessions_remaining <= 1 ? C.amber
                : C.sage
              }
              subtitle={activePackage.package?.name}
            />
          )}
          {!activePackage && activeMembership && (
            <BigNumber
              value={activeMembership.membership?.monthly_session_credits || activeMembership.monthly_session_credits || 1}
              suffix={`session${(activeMembership.membership?.monthly_session_credits || 1) === 1 ? '' : 's'}/mo`}
              color={C.green}
              subtitle={activeMembership.membership?.name || 'Member'}
            />
          )}
        </Tile>

        {/* Next visit */}
        <Tile
          icon="📅"
          label="Next visit"
          tone={stats?.nextBooking ? 'sage' : 'neutral'}
          accentBorder={!!stats?.nextBooking}
          onClick={stats?.nextBooking ? onNextBooking : undefined}
        >
          {stats?.nextBooking ? (
            <>
              <BigText>{nextLabel(stats.nextBooking.booking_date)}</BigText>
              <Detail>
                {stats.nextBooking.start_time ? stats.nextBooking.start_time.slice(0, 5) + ' · ' : ''}
                {stats.nextBooking.service?.name || 'Session'}
              </Detail>
            </>
          ) : (
            <Detail>None scheduled</Detail>
          )}
        </Tile>

        {/* Lifetime */}
        <Tile
          icon="💚"
          label="Lifetime"
          tone="neutral"
        >
          <BigNumber
            value={stats?.lifetimeSessions || 0}
            suffix={`session${stats?.lifetimeSessions === 1 ? '' : 's'}`}
            color={C.forest}
            subtitle={`${formatCurrency(stats?.lifetimeEarnings || 0)} estimated`}
          />
        </Tile>

        {/* Attention (only if needed) */}
        {attention && (
          <Tile
            icon={attention.icon}
            label={attention.label}
            tone={attention.tone}
            accentBorder
            onClick={onAttention}
          >
            <Detail>{attention.detail}</Detail>
          </Tile>
        )}
      </div>
    </div>
  );
}

function nextLabel(dateStr) {
  if (!dateStr) return '';
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  return formatShortDate(dateStr);
}

function Tile({ icon, label, tone = 'neutral', accentBorder = false, onClick, children }) {
  const [hover, setHover] = React.useState(false);
  // Muted palette by default. Borders stay soft cream-gray; the
  // accent comes from the 4px left edge only when accentBorder is
  // true. This keeps the page calm and lets the silhouette + active
  // state pill be the visual punctuation.
  const TONES = {
    neutral: { bg: C.paper, border: C.lineFaint, labelColor: C.inkSoft, edge: 'transparent' },
    gold:    { bg: C.paper, border: C.lineFaint, labelColor: C.gold,    edge: C.goldBright },
    sage:    { bg: C.paper, border: C.lineFaint, labelColor: C.sage,    edge: C.sage },
    amber:   { bg: C.paper, border: C.lineFaint, labelColor: C.amber,   edge: C.amber },
  };
  const t = TONES[tone];
  const interactive = !!onClick;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderLeft: accentBorder ? `4px solid ${t.edge}` : `1px solid ${t.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        cursor: interactive ? 'pointer' : 'default',
        boxShadow: interactive && hover ? '0 4px 12px rgba(28,43,34,0.08)' : '0 1px 2px rgba(28,43,34,0.04)',
        transform: interactive && hover ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease',
        minHeight: 88,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: t.labelColor,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

function BigNumber({ value, suffix, color, subtitle }) {
  // Count-up animation: when value first appears, the number ticks
  // from 0 up to the final value over ~700ms. Adds life to data
  // landing on the page without being gimmicky.
  const [displayValue, setDisplayValue] = React.useState(
    typeof value === 'number' ? 0 : value
  );

  React.useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }
    if (value === 0) {
      setDisplayValue(0);
      return;
    }
    const duration = 700;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic for a smooth deceleration
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: F.serif,
          fontSize: 36, fontWeight: 700,
          color,
          lineHeight: 0.95,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {displayValue}
        </span>
        {suffix && (
          <span style={{
            fontFamily: F.sans,
            fontSize: 10.5,
            color: C.muted,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {suffix}
          </span>
        )}
      </div>
      {subtitle && (
        <div style={{
          marginTop: 3,
          fontSize: 11,
          color: C.muted,
          fontFamily: F.sans,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function BigText({ children }) {
  return (
    <div style={{
      fontFamily: F.serif,
      fontSize: 18, fontWeight: 700,
      color: C.forest,
      lineHeight: 1.1,
    }}>
      {children}
    </div>
  );
}

function Detail({ children }) {
  return (
    <div style={{
      fontSize: 12,
      color: C.inkSoft,
      fontFamily: F.sans,
      marginTop: 2,
    }}>
      {children}
    </div>
  );
}
