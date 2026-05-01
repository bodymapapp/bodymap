import React from 'react';

// Six-box rolling stats strip for the dashboard home view.
// Top row: last 7 days. Bottom row: last 30 days.
// Three metrics per row: new clients, sessions completed, earnings.
//
// Design notes:
// - Industry-standard rolling windows (Stripe, Linear, Apple) so
//   numbers are never demoralizing on partial calendar periods.
// - Boxes are thin (compact) and stack 3-up on every viewport.
// - Beige background for visual grouping with the dashboard surface.
// - Sage forest accent on numbers, warm gray on labels.
//
// Props:
//   rolling: { new7d, new30d, sessions7d, sessions30d, earnings7d, earnings30d }

const C = {
  forest: '#2A5741',
  beige: '#F5F0E8',
  white: '#FFFFFF',
  border: '#E8E4DC',
  darkGray: '#1F2937',
  gray: '#6B7280',
  lightGray: '#9CA3AF',
};

function fmtMoney(n) {
  if (!n || n === 0) return '$0';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function Box({ value, label, isMoney }) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '12px 12px',
      flex: 1,
      minWidth: 0,
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'Georgia, serif',
        fontSize: 22,
        fontWeight: 700,
        color: C.forest,
        lineHeight: 1.1,
        letterSpacing: '-0.01em',
      }}>
        {isMoney ? fmtMoney(value) : (value || 0)}
      </div>
      <div style={{
        fontSize: 10.5,
        color: C.gray,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  );
}

export default function StatsStrip({ rolling }) {
  const r = rolling || {};
  return (
    <div style={{
      background: C.beige,
      borderRadius: 14,
      padding: 12,
      marginBottom: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Last 7 days */}
      <div>
        <div style={{
          fontSize: 10,
          color: C.lightGray,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
          marginBottom: 6,
          paddingLeft: 4,
        }}>Last 7 days</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Box value={r.new7d} label="New clients" />
          <Box value={r.sessions7d} label="Sessions" />
          <Box value={r.earnings7d} label="Earnings" isMoney />
        </div>
      </div>
      {/* Last 30 days */}
      <div>
        <div style={{
          fontSize: 10,
          color: C.lightGray,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
          marginBottom: 6,
          paddingLeft: 4,
        }}>Last 30 days</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Box value={r.new30d} label="New clients" />
          <Box value={r.sessions30d} label="Sessions" />
          <Box value={r.earnings30d} label="Earnings" isMoney />
        </div>
      </div>
    </div>
  );
}
