// src/components/BillingDashboard.js
import React, { useState, useEffect, useMemo } from 'react';
import RefundModal from './RefundModal';

const TODAY = new Date();
TODAY.setHours(0,0,0,0);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtShort = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtMonth = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const currency = (n) => `$${Number(n).toFixed(0)}`;

// Phase 14.3 (HK May 17 2026): legacy tab visualizations (StatCards,
// bar charts, calendars, session lists) operate on session-revenue
// rows only. Cancel fees, refunds, and no-shows are surfaced on the
// HeroPayCard separately and would double-count if included here.
// Sample data rows have no 'source' tag, so they pass through.
const isRevenueSession = (s) =>
  s.source === 'payment' || s.source === 'booking_no_payment' || s.source === undefined;

const DEFAULT_RATE = 85;

const SAMPLE_SESSIONS = [
  { id:1,  client:'Sarah M.',     date:addDays(TODAY,0),   time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:2,  client:'Jennifer K.',  date:addDays(TODAY,0),   time:'10:30 AM', duration:90, rate:110,          actual:null,         status:'pending' },
  { id:3,  client:'Maria L.',     date:addDays(TODAY,0),   time:'12:00 PM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:4,  client:'Rachel T.',    date:addDays(TODAY,0),   time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:null,         status:'pending' },
  { id:5,  client:'Amy W.',       date:addDays(TODAY,0),   time:'3:30 PM',  duration:90, rate:110,          actual:null,         status:'pending' },
  { id:6,  client:'Dana P.',      date:addDays(TODAY,-1),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:7,  client:'Christine B.', date:addDays(TODAY,-1),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:8,  client:'Monica G.',    date:addDays(TODAY,-1),  time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:9,  client:'Tanya R.',     date:addDays(TODAY,-2),  time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:10, client:'Lisa N.',      date:addDays(TODAY,-2),  time:'1:00 PM',  duration:90, rate:110,          actual:100,          status:'paid' },
  { id:11, client:'Sarah M.',     date:addDays(TODAY,-2),  time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:0,            status:'waived' },
  { id:12, client:'Jennifer K.',  date:addDays(TODAY,-3),  time:'9:30 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:13, client:'Maria L.',     date:addDays(TODAY,-3),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:14, client:'Amy W.',       date:addDays(TODAY,-4),  time:'10:00 AM', duration:90, rate:110,          actual:110,          status:'paid' },
  { id:15, client:'Rachel T.',    date:addDays(TODAY,-4),  time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:null,         status:'outstanding' },
  { id:16, client:'Monica G.',    date:addDays(TODAY,-5),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:17, client:'Dana P.',      date:addDays(TODAY,-6),  time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:18, client:'Christine B.', date:addDays(TODAY,-7),  time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:19, client:'Sarah M.',     date:addDays(TODAY,-8),  time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:20, client:'Tanya R.',     date:addDays(TODAY,-9),  time:'1:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:21, client:'Lisa N.',      date:addDays(TODAY,-10), time:'3:00 PM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:22, client:'Monica G.',    date:addDays(TODAY,-11), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:23, client:'Maria L.',     date:addDays(TODAY,-12), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:24, client:'Jennifer K.',  date:addDays(TODAY,-13), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:25, client:'Amy W.',       date:addDays(TODAY,-14), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:26, client:'Sarah M.',     date:addDays(TODAY,-16), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:27, client:'Dana P.',      date:addDays(TODAY,-17), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:28, client:'Christine B.', date:addDays(TODAY,-18), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:29, client:'Monica G.',    date:addDays(TODAY,-20), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:30, client:'Tanya R.',     date:addDays(TODAY,-21), time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:31, client:'Sarah M.',     date:addDays(TODAY,-25), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:32, client:'Maria L.',     date:addDays(TODAY,-26), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:33, client:'Jennifer K.',  date:addDays(TODAY,-28), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:34, client:'Amy W.',       date:addDays(TODAY,-30), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:35, client:'Monica G.',    date:addDays(TODAY,-35), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:36, client:'Dana P.',      date:addDays(TODAY,-40), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:37, client:'Christine B.', date:addDays(TODAY,-45), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:38, client:'Tanya R.',     date:addDays(TODAY,-50), time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:39, client:'Sarah M.',     date:addDays(TODAY,-55), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:40, client:'Maria L.',     date:addDays(TODAY,-60), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:41, client:'Monica G.',    date:addDays(TODAY,-65), time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:42, client:'Lisa N.',      date:addDays(TODAY,-70), time:'1:00 PM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:43, client:'Jennifer K.',  date:addDays(TODAY,-75), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:44, client:'Amy W.',       date:addDays(TODAY,-80), time:'9:00 AM',  duration:90, rate:110,          actual:110,          status:'paid' },
  { id:45, client:'Sarah M.',     date:addDays(TODAY,-85), time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:46, client:'Dana P.',      date:addDays(TODAY,-90), time:'11:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:47, client:'Christine B.', date:addDays(TODAY,-95), time:'2:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:48, client:'Tanya R.',     date:addDays(TODAY,-100),time:'3:00 PM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:49, client:'Monica G.',    date:addDays(TODAY,-110),time:'10:00 AM', duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
  { id:50, client:'Sarah M.',     date:addDays(TODAY,-120),time:'9:00 AM',  duration:60, rate:DEFAULT_RATE, actual:DEFAULT_RATE, status:'paid' },
];

const STATUS_CFG = {
  paid:        { label:'✅ Paid',        bg:'#DCFCE7', color:'#16A34A' },
  pending:     { label:'⏳ Pending',     bg:'#FEF3C7', color:'#D97706' },
  outstanding: { label:'🔴 Outstanding', bg:'#FEE2E2', color:'#DC2626' },
  waived:      { label:'🎁 Waived',      bg:'#F3F4F6', color:'#6B7280' },
};

function StatCard({ label, value, sub, color, small }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: isMobile ? '14px 14px' : '20px 24px',
      flex: 1,
      minWidth: isMobile ? 0 : 140,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    }}>
      <div style={{
        fontSize: isMobile ? (small ? 18 : 22) : (small ? 22 : 28),
        fontWeight: 700,
        color: color || '#2A5741',
        fontFamily: 'Georgia, serif',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: isMobile ? 11 : 13,
        fontWeight: 600,
        color: '#1F2937',
        marginTop: 4,
        lineHeight: 1.3,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{
          fontSize: isMobile ? 10 : 12,
          color: '#6B7280',
          marginTop: 2,
          lineHeight: 1.3,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StatRow({ children }) {
  // Mobile: 2x2 grid (and stays 2-column for any count, scrolls if needed).
  // Desktop: flex row, wraps if necessary.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  if (isMobile) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 18,
      }}>
        {children}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {children}
    </div>
  );
}

function SessionRow({ s, onRefundClick }) {
  const sc = STATUS_CFG[s.status];
  // Phase 14.3b (HK May 17 2026): show Refund button on any paid
  // session_payments row. Stripe payments call the refund API;
  // cash/Venmo/Zelle/check/other just flip status='refunded' locally.
  // The RefundModal branches based on payment_method.
  const canRefund = s.status === 'paid'
    && s.source === 'payment'
    && s.paymentId
    && onRefundClick;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#FFFFFF', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', flexWrap:'wrap' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', background:'#2A5741', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
        {s.client.split(' ').map(w=>w[0]).join('')}
      </div>
      <div style={{ flex:1, minWidth:100 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937' }}>{s.client}</div>
        <div style={{ fontSize:12, color:'#6B7280' }}>{fmtShort(s.date)} · {s.time} · {s.duration}min</div>
      </div>
      <div style={{ textAlign:'right', minWidth:80 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937' }}>{s.actual !== null ? currency(s.actual) : '-'}</div>
        <div style={{ fontSize:11, color:'#9CA3AF' }}>Expected: {currency(s.rate)}</div>
      </div>
      <div style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>{sc.label}</div>
      {canRefund && (
        <button
          onClick={(e) => { e.stopPropagation(); onRefundClick(s); }}
          style={{
            background: 'transparent', color: '#9CA3AF',
            border: 'none', padding: '4px 8px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', textDecoration: 'underline',
          }}>
          Refund
        </button>
      )}
    </div>
  );
}

function RefundRow({ r }) {
  const methodLabel = (() => {
    const m = r.method;
    if (m === 'stripe_card_on_file' || m === 'stripe_card_new') return r.methodDetail || 'Card';
    if (m === 'stripe_payment_link') return 'Pay link';
    if (m === 'cash') return 'Cash';
    if (m === 'venmo') return 'Venmo';
    if (m === 'zelle') return 'Zelle';
    if (m === 'cashapp') return 'Cash App';
    if (m === 'check') return 'Check';
    return 'Other';
  })();
  const wasOnline = r.method && r.method.startsWith('stripe_');
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#FFFFFF', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', flexWrap:'wrap' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', background:'#FEE2E2', color:'#991B1B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>
        ↺
      </div>
      <div style={{ flex:1, minWidth:100 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#1F2937' }}>{r.client}</div>
        <div style={{ fontSize:12, color:'#6B7280' }}>
          {fmtShort(r.date)} · {methodLabel} · {wasOnline ? 'Returned to card' : 'Marked refunded'}
        </div>
      </div>
      <div style={{ textAlign:'right', minWidth:80 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#DC2626' }}>
          {currency(-(r.actual || 0))}
        </div>
      </div>
    </div>
  );
}

function RefundsList({ refunds }) {
  if (!refunds || refunds.length === 0) return null;
  const total = refunds.reduce((sum, r) => sum + (r.actual || 0), 0);
  return (
    <div style={{ marginTop:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10, padding:'0 4px' }}>
        <div style={{ fontSize:12, color:'#6B7280', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase' }}>
          Refunds · {refunds.length}
        </div>
        <div style={{ fontSize:13, color:'#991B1B', fontWeight:700 }}>
          {currency(-total)}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {refunds.map(r => <RefundRow key={r.id} r={r} />)}
      </div>
    </div>
  );
}

function EmptyBillingState() {
  return (
    <div style={{ background:'#FFFFFF', borderRadius:16, padding:'48px 32px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>💳</div>
      <div style={{ fontSize:18, fontWeight:700, color:'#1F2937', marginBottom:8 }}>No payments recorded yet</div>
      <div style={{ fontSize:14, color:'#6B7280', maxWidth:320, margin:'0 auto 24px' }}>
        Your Stripe account is connected. Payments from your clients will appear here automatically after your first session.
      </div>
      <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'12px 20px', display:'inline-block', fontSize:13, color:'#16A34A', fontWeight:600 }}>
        ✅ Stripe Connected - Ready to receive payments
      </div>
    </div>
  );
}

function SampleDataBanner() {
  return (
    <div style={{ background:'#FFF7ED', border:'1.5px dashed #F97316', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#9A3412', display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:16 }}>👁️</span>
      <div>
        <strong>Sample data - for preview only.</strong> Connect Stripe in Settings to track your real payments here. Your actual revenue will replace this preview automatically.
      </div>
    </div>
  );
}

// Phase 14.2 + 14.3 (HK May 17 2026): the Smart Billing hero card.
// Same component used at the top of Daily, Weekly, Monthly, Yearly.
// Takes a sessions slice (already filtered to a period) plus a prior
// slice for comparison, plus a label. Renders:
//   1. Big "collected" number (session revenue only)
//   2. Comparison vs prior period
//   3. Method breakdown chips (sessions only, not cancel fees)
//   4. Cancellation fee revenue as a separate line
//   5. Refunds as a small subtractive line
//   6. No-shows count line
//   7. Expected vs Actual with leakage callout
//   8. Tappable leakage detail (expands inline)
function HeroPayCard({ sessions, prevSessions, periodLabel }) {
  const [leakageOpen, setLeakageOpen] = useState(false);
  // Phase 14.3f (HK May 17 2026): refund breakdown is tappable. Default
  // closed because most periods will have zero. When open, the aggregate
  // line is followed by an inline list of individual refund rows so the
  // therapist sees who, when, and how it was paid.
  const [refundsOpen, setRefundsOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // Partition by source. Session revenue is the headline number;
  // cancellation fees + refunds + no-shows show separately so they
  // don't conflate the therapist's mental model of "what I earned
  // from doing massages."
  const sessionRevenueRows = sessions.filter(
    s => s.status === 'paid' && s.source !== 'cancellation_fee'
  );
  const cancelFeeRows = sessions.filter(s => s.source === 'cancellation_fee');
  const refundRows = sessions.filter(s => s.source === 'refund');
  const noShowRows = sessions.filter(s => s.source === 'no_show');
  const leakage = sessions.filter(s => s.status === 'outstanding');

  const collected = sessionRevenueRows.reduce((t, s) => t + (s.actual || 0), 0);
  const cancelFeeTotal = cancelFeeRows.reduce((t, s) => t + (s.actual || 0), 0);
  const refundTotal = refundRows.reduce((t, s) => t + (s.actual || 0), 0);
  const leakageAmt = leakage.reduce((t, s) => t + (s.rate || 0), 0);

  // Expected = rate sum across paid sessions (excluding cancel fees) + outstanding.
  // Represents the value of services actually rendered or due. Cancel
  // fees aren't services, so they don't count toward expected revenue.
  const expectedRows = sessions.filter(
    s => (s.status === 'paid' && s.source !== 'cancellation_fee') || s.status === 'outstanding'
  );
  const expected = expectedRows.reduce((t, s) => t + (s.rate || 0), 0);

  // Method chips: sessions revenue only. Cancel fees rolled into their
  // own line so they don't pad the card chip count.
  const methodOrder = ['card', 'cash', 'venmo', 'zelle', 'cashapp', 'check', 'other'];
  const byMethod = {};
  sessionRevenueRows.forEach(s => {
    const key = (s.method || '').startsWith('stripe_') ? 'card' : (s.method || 'other');
    byMethod[key] = (byMethod[key] || 0) + (s.actual || 0);
  });
  const methodChips = methodOrder
    .filter(m => byMethod[m] > 0)
    .map(m => ({ method: m, total: byMethod[m] }));

  // Comparison: session revenue this period vs session revenue prior
  // period. Apples to apples (excludes cancel fees + refunds both sides).
  const prevCollected = (prevSessions || [])
    .filter(s => s.status === 'paid' && s.source !== 'cancellation_fee')
    .reduce((t, s) => t + (s.actual || 0), 0);
  const hasComparison = (prevSessions || []).length > 0 || prevCollected > 0;
  const delta = collected - prevCollected;
  const deltaPct = prevCollected > 0 ? Math.round((delta / prevCollected) * 100) : null;

  const METHOD_LABEL = {
    card: 'Card', cash: 'Cash', venmo: 'Venmo', zelle: 'Zelle',
    cashapp: 'Cash App', check: 'Check', other: 'Other',
  };

  return (
    <div style={{
      background: '#FAF8F3', // warm cream
      borderRadius: 16,
      padding: isMobile ? '20px 18px' : '28px 28px',
      marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      border: '1px solid #EDE6D6',
    }}>
      {/* Label row: period name */}
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        Collected {periodLabel}
      </div>

      {/* Big number */}
      <div style={{
        fontSize: isMobile ? 40 : 48,
        fontWeight: 700,
        color: '#2A5741',
        fontFamily: 'Georgia, serif',
        lineHeight: 1,
        marginBottom: 12,
      }}>
        {currency(collected)}
      </div>

      {/* Comparison vs prior period */}
      {hasComparison && (
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
          {delta >= 0 ? '↑' : '↓'} {currency(Math.abs(delta))}
          {deltaPct !== null && ` (${delta >= 0 ? '+' : ''}${deltaPct}%)`}
          {' '}vs prior {periodLabel}
        </div>
      )}

      {/* Method breakdown chips */}
      {methodChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {methodChips.map(({ method, total }) => (
            <div key={method} style={{
              background: '#FFFFFF',
              border: '1px solid #EDE6D6',
              borderRadius: 999,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#1F2937',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ color: '#6B7280' }}>{METHOD_LABEL[method] || method}</span>
              <span style={{ color: '#2A5741', fontWeight: 700 }}>{currency(total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Phase 14.3: cancel fees / refunds / no-shows lines. Only render
          when non-zero so the card doesn't fill with empty rows. */}
      {(cancelFeeTotal > 0 || refundTotal > 0 || noShowRows.length > 0) && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 16,
          paddingTop: 12,
          borderTop: '1px solid #EDE6D6',
        }}>
          {cancelFeeTotal > 0 && (
            <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#2A5741', fontWeight: 700 }}>+ {currency(cancelFeeTotal)}</span>
              <span>cancellation fees from {cancelFeeRows.length} booking{cancelFeeRows.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {refundTotal > 0 && (
            <>
              <div
                onClick={() => setRefundsOpen(!refundsOpen)}
                style={{
                  fontSize: 13, color: '#6B7280',
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', userSelect: 'none',
                }}>
                <span style={{ color: '#DC2626', fontWeight: 700 }}>- {currency(refundTotal)}</span>
                <span>refunded across {refundRows.length} payment{refundRows.length !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{refundsOpen ? '▾' : '▸'}</span>
              </div>
              {refundsOpen && (
                <div style={{
                  marginTop: 4, marginLeft: 12, paddingLeft: 12,
                  borderLeft: '2px solid #FECACA',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {refundRows
                    .slice()
                    .sort((a, b) => b.date.getTime() - a.date.getTime())
                    .map(r => {
                      const m = r.method;
                      const methodLabel =
                        (m === 'stripe_card_on_file' || m === 'stripe_card_new') ? (r.methodDetail || 'Card')
                        : m === 'stripe_payment_link' ? 'Pay link'
                        : m === 'cash' ? 'Cash'
                        : m === 'venmo' ? 'Venmo'
                        : m === 'zelle' ? 'Zelle'
                        : m === 'cashapp' ? 'Cash App'
                        : m === 'check' ? 'Check'
                        : 'Other';
                      const wasOnline = m && m.startsWith('stripe_');
                      return (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontSize: 12, color: '#4B5563',
                          padding: '6px 0',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#1F2937' }}>{r.client}</div>
                            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                              {fmtShort(r.date)} · {methodLabel} · {wasOnline ? 'Returned to card' : 'Marked refunded'}
                            </div>
                          </div>
                          <div style={{ color: '#DC2626', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            -{currency(r.actual || 0)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
          {noShowRows.length > 0 && (
            <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#D97706', fontWeight: 700 }}>○ {noShowRows.length}</span>
              <span>no-show{noShowRows.length !== 1 ? 's' : ''} this period</span>
            </div>
          )}
        </div>
      )}

      {/* Expected vs Actual + leakage */}
      <div style={{
        paddingTop: 14,
        borderTop: '1px solid #EDE6D6',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 8 : 16,
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          Expected <strong style={{ color: '#1F2937', fontWeight: 700 }}>{currency(expected)}</strong>
          {' '}from {expectedRows.length} session{expectedRows.length !== 1 ? 's' : ''}
        </div>
        {leakage.length > 0 && (
          <button
            onClick={() => setLeakageOpen(!leakageOpen)}
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#DC2626',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {leakage.length} unpaid: {currency(leakageAmt)}
            <span style={{ fontSize: 10, opacity: 0.7 }}>{leakageOpen ? '▾' : '▸'}</span>
          </button>
        )}
      </div>

      {/* Leakage detail expands inline */}
      {leakageOpen && leakage.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {leakage.map(s => (
            <div key={s.id} style={{
              background: '#FFFFFF',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
            }}>
              <div>
                <div style={{ fontWeight: 600, color: '#1F2937' }}>{s.client}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  {fmtShort(s.date)}{s.service ? ` · ${s.service}` : ''}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#DC2626' }}>{currency(s.rate)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DailyView({ sessions, onRefundClick }) {
  const [dayOffset, setDayOffset] = useState(0);
  const days = [-2,-1,0,1,2].map(n=>addDays(TODAY,n));
  const selectedDate = addDays(TODAY, dayOffset - 2);
  // Phase 14.3: hero gets full session set (so it can break out cancel
  // fees, refunds, no-shows). The legacy StatCards + day-chip counts +
  // SessionRow list stay focused on session revenue only via the
  // isRevenueSession filter.
  const daySessions = sessions.filter(s => sameDay(s.date, selectedDate));
  const prevDay = addDays(selectedDate, -1);
  const prevDaySessions = sessions.filter(s => sameDay(s.date, prevDay));
  const daySessionsRevenueOnly = daySessions.filter(isRevenueSession);
  const expected = daySessionsRevenueOnly.reduce((s,x)=>s+x.rate,0);
  const actual = daySessionsRevenueOnly.reduce((s,x)=>s+(x.actual||0),0);
  const pending = daySessionsRevenueOnly.filter(s=>s.status==='pending'||s.status==='outstanding').length;
  // Period label for hero card: "today", "yesterday", or specific date
  const periodLabel = sameDay(selectedDate, TODAY) ? 'today'
    : sameDay(selectedDate, addDays(TODAY,-1)) ? 'yesterday'
    : sameDay(selectedDate, addDays(TODAY,1)) ? 'tomorrow'
    : fmtShort(selectedDate);
  return (
    <div>
      <HeroPayCard sessions={daySessions} prevSessions={prevDaySessions} periodLabel={periodLabel} />
      <StatRow>
        <StatCard label="Expected Revenue" value={currency(expected)} sub={`${daySessions.length} sessions`} color="#2A5741" />
        <StatCard label="Actual Collected" value={currency(actual)} sub="confirmed payments" color="#16A34A" />
        <StatCard label="Pending" value={pending} sub="awaiting payment" color="#D97706" />
        <StatCard label="Collection Rate" value={expected>0?`${Math.round((actual/expected)*100)}%`:'-'} sub="actual vs expected" color="#6B9E80" />
      </StatRow>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {days.map((d,i) => {
          const isSel = i === dayOffset;
          const count = sessions.filter(s=>sameDay(s.date,d) && isRevenueSession(s)).length;
          const label = sameDay(d,TODAY)?'Today':sameDay(d,addDays(TODAY,-1))?'Yesterday':sameDay(d,addDays(TODAY,1))?'Tomorrow':fmtShort(d);
          return (
            <button key={i} onClick={()=>setDayOffset(i)} style={{ background:isSel?'#2A5741':'#FFFFFF', color:isSel?'#FFFFFF':'#1F2937', border:`1.5px solid ${isSel?'#2A5741':'#E5E7EB'}`, borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <div>{label}</div>
              <div style={{ fontSize:11, opacity:0.75, marginTop:2 }}>{count} session{count!==1?'s':''}</div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
        {fmtShort(selectedDate)} - {daySessionsRevenueOnly.length} session{daySessionsRevenueOnly.length!==1?'s':''}
      </div>
      {daySessionsRevenueOnly.length === 0
        ? <div style={{ background:'#FFFFFF', borderRadius:12, padding:32, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No sessions on this day.</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{daySessionsRevenueOnly.map(s=><SessionRow key={s.id} s={s} onRefundClick={onRefundClick}/>)}</div>
      }
    </div>
  );
}

function WeeklyView({ sessions, onRefundClick }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const getMonday = (d) => { const x=new Date(d); const day=x.getDay(); x.setDate(x.getDate()+(day===0?-6:1-day)); x.setHours(0,0,0,0); return x; };
  const weekStart = addDays(getMonday(TODAY), weekOffset*7);
  const weekDays = [0,1,2,3,4,5,6].map(n=>addDays(weekStart,n));
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  // Phase 14.3: hero takes the full set; the rest filters to revenue rows.
  const weekSessions = sessions.filter(s=>s.date>=weekStart&&s.date<addDays(weekStart,7));
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekSessions = sessions.filter(s=>s.date>=prevWeekStart&&s.date<weekStart);
  const weekRevenue = weekSessions.filter(isRevenueSession);
  const expected = weekRevenue.reduce((s,x)=>s+x.rate,0);
  const actual = weekRevenue.reduce((s,x)=>s+(x.actual||0),0);
  const maxDay = Math.max(...weekDays.map(d=>sessions.filter(s=>sameDay(s.date,d)&&isRevenueSession(s)).reduce((t,x)=>t+x.rate,0)),1);
  const periodLabel = weekOffset===0?'this week':weekOffset===-1?'last week':weekOffset===1?'next week':`week of ${fmtShort(weekStart)}`;
  return (
    <div>
      <HeroPayCard sessions={weekSessions} prevSessions={prevWeekSessions} periodLabel={periodLabel} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>setWeekOffset(weekOffset-1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>← Prev</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#1F2937' }}>{weekOffset===0?'This Week':weekOffset===-1?'Last Week':weekOffset===1?'Next Week':fmtShort(weekStart)}</div>
          <div style={{ fontSize:12, color:'#6B7280' }}>{weekRevenue.length} sessions</div>
        </div>
        <button onClick={()=>setWeekOffset(weekOffset+1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>Next →</button>
      </div>
      <StatRow>
        <StatCard label="Expected" value={currency(expected)} sub="this week" color="#2A5741" />
        <StatCard label="Collected" value={currency(actual)} sub="confirmed" color="#16A34A" />
        <StatCard label="Sessions" value={weekRevenue.length} sub="total" color="#6B9E80" />
        <StatCard label="Avg/Session" value={weekRevenue.length>0?currency(actual/weekRevenue.length):'-'} sub="collected" color="#C9A84C" small />
      </StatRow>
      <style>{`
        @media (max-width: 420px) {
          .bm-bill-bar-amount { display: none !important; }
        }
      `}</style>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, marginBottom:24 }}>
        {weekDays.map((d,i) => {
          const dayRev = sessions.filter(s=>sameDay(s.date,d)&&isRevenueSession(s)).reduce((t,x)=>t+(x.actual||0),0);
          const dayExp = sessions.filter(s=>sameDay(s.date,d)&&isRevenueSession(s)).reduce((t,x)=>t+x.rate,0);
          const isToday = sameDay(d,TODAY);
          const barH = Math.max((dayExp/maxDay)*100,dayExp>0?6:0);
          const actH = dayExp>0?Math.max((dayRev/dayExp)*barH,0):0;
          return (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ fontSize:11, fontWeight:700, color:isToday?'#2A5741':'#9CA3AF', textTransform:'uppercase', marginBottom:4 }}>{DAY_NAMES[i]}</div>
              <div style={{ fontSize:10, color:isToday?'#2A5741':'#9CA3AF', marginBottom:8 }}>{d.getDate()}</div>
              <div style={{ width:'100%', height:100, display:'flex', alignItems:'flex-end', justifyContent:'center', gap:3 }}>
                <div style={{ width:'42%', background:'#E5E7EB', borderRadius:'3px 3px 0 0', height:`${barH}px`, position:'relative' }}>
                  <div style={{ position:'absolute', bottom:0, width:'100%', background:'#2A5741', borderRadius:'3px 3px 0 0', height:`${actH}px` }} />
                </div>
              </div>
              {dayExp > 0 && <div className="bm-bill-bar-amount" style={{ fontSize:10, color:'#6B7280', marginTop:4, whiteSpace:'nowrap' }}>{currency(dayExp)}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:16, marginBottom:12, fontSize:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#E5E7EB', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Expected</span></div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#2A5741', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Collected</span></div>
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>All Sessions This Week</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{weekRevenue.length===0?<div style={{ color:'#9CA3AF', fontSize:14, textAlign:'center', padding:24 }}>No sessions this week.</div>:weekRevenue.map(s=><SessionRow key={s.id} s={s} onRefundClick={onRefundClick}/>)}</div>
    </div>
  );
}

function MonthlyView({ sessions, onRefundClick }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const viewMonth = new Date(TODAY.getFullYear(), TODAY.getMonth()+monthOffset, 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()+1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const startOffset = firstDayOfWeek===0?6:firstDayOfWeek-1;
  const calDays = [];
  for(let i=0;i<startOffset;i++) calDays.push(null);
  for(let i=1;i<=daysInMonth;i++) calDays.push(new Date(viewMonth.getFullYear(),viewMonth.getMonth(),i));
  // Phase 14.3: hero gets full set; visualizations filter to revenue rows.
  const monthSessions = sessions.filter(s=>s.date.getMonth()===viewMonth.getMonth()&&s.date.getFullYear()===viewMonth.getFullYear());
  const prevMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth()-1, 1);
  const prevMonthSessions = sessions.filter(s=>s.date.getMonth()===prevMonth.getMonth()&&s.date.getFullYear()===prevMonth.getFullYear());
  const monthRevenue = monthSessions.filter(isRevenueSession);
  const monthExpected = monthRevenue.reduce((t,x)=>t+x.rate,0);
  const monthActual = monthRevenue.reduce((t,x)=>t+(x.actual||0),0);
  const selectedDaySessions = sessions.filter(s=>sameDay(s.date,selectedDate)&&isRevenueSession(s));
  const isCurrentMonth = viewMonth.getMonth()===TODAY.getMonth() && viewMonth.getFullYear()===TODAY.getFullYear();
  const periodLabel = isCurrentMonth ? 'this month' : fmtMonth(viewMonth).toLowerCase();
  return (
    <div>
      <HeroPayCard sessions={monthSessions} prevSessions={prevMonthSessions} periodLabel={periodLabel} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>setMonthOffset(monthOffset-1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>← Prev</button>
        <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>{fmtMonth(viewMonth)}</div>
        <button onClick={()=>setMonthOffset(monthOffset+1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>Next →</button>
      </div>
      <StatRow>
        <StatCard label="Monthly Expected" value={currency(monthExpected)} sub={`${monthRevenue.length} sessions`} color="#2A5741" />
        <StatCard label="Monthly Collected" value={currency(monthActual)} sub="confirmed payments" color="#16A34A" />
        <StatCard label="Collection Rate" value={monthExpected>0?`${Math.round((monthActual/monthExpected)*100)}%`:'-'} sub="actual vs expected" color="#6B9E80" />
      </StatRow>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
          <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', padding:'4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:20 }}>
        {calDays.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const dayRev = sessions.filter(s=>sameDay(s.date,d)&&isRevenueSession(s)).reduce((t,x)=>t+(x.actual||0),0);
          const dayExp = sessions.filter(s=>sameDay(s.date,d)&&isRevenueSession(s)).reduce((t,x)=>t+x.rate,0);
          const isToday = sameDay(d,TODAY);
          const isSel = sameDay(d,selectedDate);
          return (
            <div key={i} onClick={()=>setSelectedDate(d)} style={{ minHeight:60, padding:6, borderRadius:8, cursor:'pointer', background:isSel?'#2A5741':isToday?'#F0FDF4':'#FFFFFF', border:`1.5px solid ${isSel?'#2A5741':isToday?'#16A34A':'#E5E7EB'}` }}>
              <div style={{ fontSize:12, fontWeight:600, color:isSel?'#FFFFFF':isToday?'#16A34A':'#6B7280', marginBottom:2 }}>{d.getDate()}</div>
              {dayExp>0&&<div style={{ fontSize:11, fontWeight:700, color:isSel?'#DCFCE7':'#2A5741' }}>{currency(dayRev)}</div>}
              {dayExp>0&&<div style={{ fontSize:10, color:isSel?'rgba(255,255,255,0.6)':'#9CA3AF' }}>of {currency(dayExp)}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
        {fmtShort(selectedDate)} - {selectedDaySessions.length} session{selectedDaySessions.length!==1?'s':''}
      </div>
      {selectedDaySessions.length===0
        ?<div style={{ background:'#FFFFFF', borderRadius:12, padding:24, textAlign:'center', color:'#9CA3AF', fontSize:14 }}>No sessions. Click a day to view.</div>
        :<div style={{ display:'flex', flexDirection:'column', gap:8 }}>{selectedDaySessions.map(s=><SessionRow key={s.id} s={s} onRefundClick={onRefundClick}/>)}</div>
      }
    </div>
  );
}

function YearlyView({ sessions, onRefundClick }) {
  const [year, setYear] = useState(TODAY.getFullYear());
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Phase 14.3: monthData and StatCards use revenue rows only.
  const monthData = MONTH_NAMES.map((name,i)=>{
    const ms = sessions.filter(s=>s.date.getFullYear()===year&&s.date.getMonth()===i&&isRevenueSession(s));
    return { name, expected:ms.reduce((t,x)=>t+x.rate,0), actual:ms.reduce((t,x)=>t+(x.actual||0),0), count:ms.length };
  });
  const maxVal = Math.max(...monthData.map(m=>m.expected),1);
  const yearExpected = monthData.reduce((t,m)=>t+m.expected,0);
  const yearActual = monthData.reduce((t,m)=>t+m.actual,0);
  const yearSessions = monthData.reduce((t,m)=>t+m.count,0);
  // Hero gets the full set so it can break out cancel fees / refunds / no-shows.
  const yearSessionsSlice = sessions.filter(s=>s.date.getFullYear()===year);
  const prevYearSessions = sessions.filter(s=>s.date.getFullYear()===year-1);
  const isCurrentYear = year===TODAY.getFullYear();
  const periodLabel = isCurrentYear ? 'this year' : `in ${year}`;
  return (
    <div>
      <HeroPayCard sessions={yearSessionsSlice} prevSessions={prevYearSessions} periodLabel={periodLabel} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={()=>setYear(year-1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>← {year-1}</button>
        <div style={{ fontSize:16, fontWeight:700, color:'#1F2937' }}>{year}</div>
        <button onClick={()=>setYear(year+1)} style={{ background:'#FFFFFF', border:'1.5px solid #E5E7EB', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', color:'#1F2937' }}>{year+1} →</button>
      </div>
      <StatRow>
        <StatCard label="Annual Expected" value={currency(yearExpected)} sub={`${yearSessions} sessions`} color="#2A5741" />
        <StatCard label="Annual Collected" value={currency(yearActual)} sub="confirmed payments" color="#16A34A" />
        <StatCard label="Avg/Month" value={currency(yearActual/12)} sub="collected" color="#6B9E80" small />
        <StatCard label="Avg/Session" value={yearSessions>0?currency(yearActual/yearSessions):'-'} sub="collected" color="#C9A84C" small />
      </StatRow>
      <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1F2937', marginBottom:20 }}>Revenue by Month</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:140 }}>
          {monthData.map(({name,expected,actual})=>{
            const expH = Math.max((expected/maxVal)*120,expected>0?4:0);
            const actH = expected>0?Math.max((actual/expected)*expH,0):0;
            const isCurrent = name===MONTH_NAMES[TODAY.getMonth()]&&year===TODAY.getFullYear();
            return (
              <div key={name} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                {expected>0&&<div style={{ fontSize:9, color:'#9CA3AF', textAlign:'center' }}>{currency(actual)}</div>}
                <div style={{ width:'100%', display:'flex', alignItems:'flex-end', justifyContent:'center', gap:2, height:120 }}>
                  <div style={{ width:'80%', background:'#E5E7EB', borderRadius:'3px 3px 0 0', height:`${expH}px`, position:'relative' }}>
                    <div style={{ position:'absolute', bottom:0, width:'100%', background:isCurrent?'#C9A84C':'#2A5741', borderRadius:'3px 3px 0 0', height:`${actH}px` }}/>
                  </div>
                </div>
                <div style={{ fontSize:10, fontWeight:600, color:isCurrent?'#2A5741':'#9CA3AF' }}>{name}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex', gap:16, marginTop:12, fontSize:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#E5E7EB', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Expected</span></div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#2A5741', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Collected</span></div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ width:12, height:12, background:'#C9A84C', borderRadius:2 }}/><span style={{ color:'#6B7280' }}>Current month</span></div>
        </div>
      </div>
    </div>
  );
}

function InsightsView({ sessions, onRefundClick }) {
  const last30 = sessions.filter(s=>s.date>=addDays(TODAY,-30)&&s.date<=TODAY);
  const prev30 = sessions.filter(s=>s.date>=addDays(TODAY,-60)&&s.date<addDays(TODAY,-30));
  const last30Rev = last30.reduce((t,x)=>t+(x.actual||0),0);
  const prev30Rev = prev30.reduce((t,x)=>t+(x.actual||0),0);
  const growth = prev30Rev>0?Math.round(((last30Rev-prev30Rev)/prev30Rev)*100):0;
  const collectionRate = sessions.length > 0 ? Math.round((sessions.filter(s=>s.status==='paid').length/sessions.length)*100) : 0;
  const outstanding = sessions.filter(s=>s.status==='outstanding');
  const outstandingTotal = outstanding.reduce((t,x)=>t+x.rate,0);
  const clientRev = {};
  sessions.forEach(s=>{ clientRev[s.client]=(clientRev[s.client]||0)+(s.actual||0); });
  const topClients = Object.entries(clientRev).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxRev = Math.max(...topClients.map(c=>c[1]),1);
  const paidSessions = sessions.filter(s=>s.actual>0);
  const avgSession = paidSessions.length>0 ? Math.round(paidSessions.reduce((t,x)=>t+(x.actual||0),0)/paidSessions.length) : 0;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <StatRow>
        <StatCard label="30-Day Revenue" value={currency(last30Rev)} sub={`${growth>=0?'+':''}${growth}% vs prior 30 days`} color="#2A5741" />
        <StatCard label="Collection Rate" value={`${collectionRate}%`} sub="sessions paid" color="#16A34A" />
        <StatCard label="Avg Session Value" value={currency(avgSession)} sub="collected" color="#6B9E80" small />
        <StatCard label="Outstanding" value={currency(outstandingTotal)} sub={`${outstanding.length} session${outstanding.length!==1?'s':''}`} color="#DC2626" small />
      </StatRow>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:16 }}>⭐ Top Clients by Revenue</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {topClients.map(([name,rev])=>(
              <div key={name}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1F2937' }}>{name}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#2A5741' }}>{currency(rev)}</span>
                </div>
                <div style={{ background:'#E5E7EB', borderRadius:99, height:6 }}>
                  <div style={{ width:`${(rev/maxRev)*100}%`, background:'#2A5741', borderRadius:99, height:6 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:'#FFFFFF', borderRadius:12, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1F2937', marginBottom:16 }}>📊 Revenue Breakdown</div>
          {[
            { label:'Paid',        value:sessions.filter(s=>s.status==='paid').length,        color:'#16A34A' },
            { label:'Pending',     value:sessions.filter(s=>s.status==='pending').length,     color:'#D97706' },
            { label:'Outstanding', value:sessions.filter(s=>s.status==='outstanding').length, color:'#DC2626' },
            { label:'Waived',      value:sessions.filter(s=>s.status==='waived').length,      color:'#6B7280' },
          ].map(({label,value,color})=>(
            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #F3F4F6' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:color }}/>
                <span style={{ fontSize:13, color:'#1F2937' }}>{label}</span>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color }}>{value} sessions</span>
            </div>
          ))}
        </div>
      </div>
      {outstanding.length > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:20 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#DC2626', marginBottom:12 }}>🔴 Outstanding Payments - {currency(outstandingTotal)}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {outstanding.map(s=><SessionRow key={s.id} s={s} onRefundClick={onRefundClick}/>)}
          </div>
        </div>
      )}
      {(() => {
        const allRefunds = sessions.filter(s => s.source === 'refund').sort((a,b)=>b.date-a.date).slice(0, 20);
        if (allRefunds.length === 0) return null;
        return (
          <div style={{ marginTop:20 }}>
            <RefundsList refunds={allRefunds} />
          </div>
        );
      })()}
    </div>
  );
}

export default function BillingDashboard({ therapist }) {
  const [subView, setSubView] = useState('daily');
  // Per-processor connection flags. Either one being connected counts
  // as "the therapist has a real payment processor and we should
  // pull live data."
  const [stripeConnected, setStripeConnected] = useState(null);
  const [squareConnected, setSquareConnected] = useState(null);
  const [sessionRate, setSessionRate] = useState(DEFAULT_RATE);
  const [realTransactions, setRealTransactions] = useState(null); // null = loading, [] = connected but empty, [...] = has data
  // Phase 14.3b (HK May 17 2026): in-app refund. refundTarget holds the
  // session row to be refunded. reloadTick increments after a refund
  // succeeds to trigger the useEffect to re-pull data.
  const [refundTarget, setRefundTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!therapist?.id) return;
    import('../lib/supabase').then(async ({ supabase }) => {
      // Step 1: therapist config (processor connection flags, session rate)
      const { data } = await supabase
        .from('therapists')
        .select('stripe_account_id, stripe_account_connected, square_access_token, square_connected, session_rate')
        .eq('id', therapist.id)
        .single();
      const stripeOk = !!(data?.stripe_account_id && data?.stripe_account_connected);
      const squareOk = !!(data?.square_access_token && data?.square_connected);
      setStripeConnected(stripeOk);
      setSquareConnected(squareOk);
      if (data?.session_rate && data.session_rate > 0) setSessionRate(data.session_rate);

      if (!stripeOk && !squareOk) {
        // Neither connected. Leave realTransactions null so the
        // sample-data banner shows.
        return;
      }

      // Phase 14.1 (HK May 17 2026): primary data source is session_payments,
      // not Stripe Connect API. session_payments is BodyMap's own table,
      // one row per real payment (Stripe or offline cash/Venmo/Zelle).
      // Includes refunds, tips, payment_method breakdown. Joined with
      // bookings for service name and completed-but-unpaid leakage view.
      //
      // We deliberately exclude bookings with imported=true from the
      // "expected revenue" calc, because CSV imports are historical
      // backfill data, not real money in the pipeline.
      const { data: payments } = await supabase
        .from('session_payments')
        .select('id, booking_id, client_id, amount_cents, tip_cents, payment_method, payment_method_detail, status, paid_at, created_at')
        .eq('therapist_id', therapist.id)
        .order('paid_at', { ascending: false })
        .limit(500);

      // Bookings for the same therapist, recent + upcoming. Joined to
      // services for price + duration. Filtered to exclude imports.
      // We need both completed (to compute expected) and unpaid-but-
      // completed (leakage), so we fetch all confirmed/completed in
      // the recent window.
      const horizonStart = new Date();
      horizonStart.setDate(horizonStart.getDate() - 400);
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, client_id, client_name, client_email, booking_date, start_time, end_time, status, imported, services(name, price, duration)')
        .eq('therapist_id', therapist.id)
        .gte('booking_date', horizonStart.toISOString().slice(0, 10))
        .neq('imported', true)
        .order('booking_date', { ascending: false })
        .limit(500);

      // Phase 14.3 (HK May 17 2026): pull cancellation_charges too.
      // Captures cancel + reschedule + no-show fees. We surface these
      // as a separate revenue stream from session payments because the
      // therapist's mental model is "session revenue + cancellation
      // revenue" not one combined number.
      const { data: cancellationCharges } = await supabase
        .from('cancellation_charges')
        .select('id, booking_id, client_id, amount_cents, trigger_event, status, payment_intent_id, fired_at, succeeded_at, refunded_at, refund_amount_cents')
        .eq('therapist_id', therapist.id)
        .gte('fired_at', horizonStart.toISOString())
        .order('fired_at', { ascending: false })
        .limit(200);

      // Map payments + bookings into the session shape the existing
      // tab views expect. Each session_payments row becomes a session.
      // Bookings with no payment row become 'outstanding' / 'pending'.
      const bookingsById = {};
      (bookings || []).forEach(b => { bookingsById[b.id] = b; });

      const paidBookingIds = new Set();
      // Phase 14.3: session payments split by status. 'succeeded' becomes
      // paid sessions (counted toward collected). 'refunded' becomes a
      // separate row tagged source='refund' so the hero can show a
      // 'refunds: $X' line without including them in the big number.
      const paymentSessions = [];
      const refundSessions = [];
      (payments || []).forEach((p) => {
        const b = bookingsById[p.booking_id];
        const dateObj = p.paid_at ? new Date(p.paid_at) : new Date(p.created_at);
        const expected = b?.services?.price || data?.session_rate || DEFAULT_RATE;
        const actualCents = (p.amount_cents || 0) + (p.tip_cents || 0);
        const base = {
          id: `pay-${p.id}`,
          client: b?.client_name || 'Client',
          date: dateObj,
          time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: b?.services?.duration || 60,
          rate: expected,
          actual: actualCents / 100,
          base: (p.amount_cents || 0) / 100,
          tip: (p.tip_cents || 0) / 100,
          method: p.payment_method,
          methodDetail: p.payment_method_detail,
          service: b?.services?.name || null,
          bookingId: p.booking_id,
          paymentId: p.id,
        };
        if (p.status === 'succeeded') {
          if (p.booking_id) paidBookingIds.add(p.booking_id);
          paymentSessions.push({ ...base, status: 'paid', source: 'payment' });
        } else if (p.status === 'refunded') {
          refundSessions.push({ ...base, status: 'refunded', source: 'refund' });
        }
        // 'pending', 'voided', 'failed' are not counted in either bucket.
      });

      // Cancellation charge sessions. status='succeeded' rows are real
      // money in the therapist's pocket. Tagged source='cancellation_fee'
      // so the hero can show them as a separate number.
      const cancellationSessions = (cancellationCharges || [])
        .filter(c => c.status === 'succeeded')
        .map((c) => {
          const b = bookingsById[c.booking_id];
          const dateObj = c.succeeded_at ? new Date(c.succeeded_at) : new Date(c.fired_at);
          const TRIGGER_LABEL = { cancel: 'Cancellation fee', reschedule: 'Reschedule fee', no_show: 'No-show fee' };
          return {
            id: `cancel-${c.id}`,
            client: b?.client_name || 'Client',
            date: dateObj,
            time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            duration: b?.services?.duration || 60,
            rate: (c.amount_cents || 0) / 100,
            actual: (c.amount_cents || 0) / 100,
            base: (c.amount_cents || 0) / 100,
            tip: 0,
            status: 'paid', // it IS paid, just a different source
            method: 'card', // cancellation charges always go through Stripe
            methodDetail: TRIGGER_LABEL[c.trigger_event] || 'Fee',
            service: TRIGGER_LABEL[c.trigger_event] || 'Fee',
            bookingId: c.booking_id,
            paymentId: null,
            cancellationId: c.id,
            triggerEvent: c.trigger_event,
            source: 'cancellation_fee',
          };
        });

      // Phase 14.3: no-show bookings surfaced as count-only rows. Tagged
      // source='no_show' so the hero can show a 'No-shows: N' line. They
      // don't count toward collected or expected revenue.
      const noShowSessions = (bookings || [])
        .filter(b => b.status === 'no_show')
        .map((b) => {
          const dateObj = new Date((b.booking_date || '') + 'T' + (b.start_time || '12:00:00'));
          const expected = b?.services?.price || data?.session_rate || DEFAULT_RATE;
          return {
            id: `noshow-${b.id}`,
            client: b.client_name || 'Client',
            date: dateObj,
            time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            duration: b?.services?.duration || 60,
            rate: expected,
            actual: 0,
            base: 0,
            tip: 0,
            status: 'no_show',
            method: null,
            methodDetail: null,
            service: b?.services?.name || null,
            bookingId: b.id,
            paymentId: null,
            source: 'no_show',
          };
        });

      // Add 'outstanding' / 'pending' synthetic sessions for completed
      // bookings with no corresponding session_payments row. This is
      // the leakage view: services rendered, money not yet captured.
      const leakageSessions = (bookings || [])
        .filter(b => b.status === 'completed' && !paidBookingIds.has(b.id))
        .map(b => {
          const dateObj = new Date((b.booking_date || '') + 'T' + (b.start_time || '12:00:00'));
          const expected = b?.services?.price || data?.session_rate || DEFAULT_RATE;
          return {
            id: `unpaid-${b.id}`,
            client: b.client_name || 'Client',
            date: dateObj,
            time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            duration: b?.services?.duration || 60,
            rate: expected,
            actual: 0,
            base: 0,
            tip: 0,
            status: 'outstanding',
            method: null,
            methodDetail: null,
            service: b?.services?.name || null,
            bookingId: b.id,
            paymentId: null,
            source: 'booking_no_payment',
          };
        });

      const combined = [
        ...paymentSessions,
        ...cancellationSessions,
        ...refundSessions,
        ...noShowSessions,
        ...leakageSessions,
      ];
      combined.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRealTransactions(combined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist, reloadTick]);

  // "Has live data" if either processor is connected. Drives sample
  // data fallback and banner copy below.
  const anyConnected = !!stripeConnected || !!squareConnected;
  const isSampleData = !anyConnected;
  const isLoading = stripeConnected === null && squareConnected === null;

  const sessions = useMemo(() => {
    if (anyConnected && realTransactions && realTransactions.length > 0) {
      // Phase 14.1: realTransactions is already in session shape, mapped
      // from session_payments + bookings in the effect above. No further
      // transformation needed.
      return realTransactions;
    }
    // Not connected - show sample data with live session rate applied
    return SAMPLE_SESSIONS.map(s => ({
      ...s,
      rate:   s.rate   === DEFAULT_RATE ? sessionRate : s.rate,
      actual: s.actual === DEFAULT_RATE ? sessionRate : s.actual,
    }));
  }, [anyConnected, realTransactions, sessionRate]);

  const TABS = [
    { id:'daily',    label:'Daily' },
    { id:'weekly',   label:'Weekly' },
    { id:'monthly',  label:'Monthly' },
    { id:'yearly',   label:'Yearly' },
    { id:'insights', label:'Insights' },
  ];

  if (isLoading) {
    return (
      <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:64 }}>
        <div style={{ fontSize:14, color:'#9CA3AF' }}>Loading billing data…</div>
      </div>
    );
  }


  return (
    <div style={{ width:'100%', paddingBottom: window.innerWidth < 768 ? 'calc(74px + env(safe-area-inset-bottom, 0px) + 24px)' : 0 }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontFamily:'Georgia, serif', fontSize:26, fontWeight:700, color:'#1F2937', margin:'0 0 4px 0' }}>Billing</h2>
        <p style={{ fontSize:14, color:'#6B7280', margin:0 }}>{fmt(TODAY)}</p>
      </div>

      {/* No processor connected - sample data, prompt to connect */}
      {!anyConnected && <SampleDataBanner />}

      {/* Processor connected, no real data yet - sample data but show connected state */}
      {anyConnected && realTransactions !== null && realTransactions.length === 0 && (
        <div style={{ background:'#EFF6FF', border:'1.5px dashed #93C5FD', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#1D4ED8', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>👁️</span>
          <div><strong>Sample data - preview only.</strong> Your payment processor is connected. Real payments will replace this preview automatically after your first session.</div>
        </div>
      )}

      {/* Processor connected with real transactions */}
      {anyConnected && realTransactions && realTransactions.length > 0 && (
        <div style={{ background:'#DCFCE7', border:'1px solid #86EFAC', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:13, color:'#16A34A', display:'flex', alignItems:'center', gap:8 }}>
          ✅ <strong>Connected.</strong>&nbsp;Showing all payments captured through MyBodyMap.
        </div>
      )}

      {sessionRate !== DEFAULT_RATE && (realTransactions === null || realTransactions.length === 0) && (
        <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:10, padding:'8px 16px', marginBottom:12, fontSize:12, color:'#16A34A', display:'flex', alignItems:'center', gap:8 }}>
          💰 Preview using your rate: <strong>${sessionRate}/session</strong>
        </div>
      )}

      <div className="bm-tabbar" style={{ display:'flex', gap:2, background:'#F3F4F6', borderRadius:12, padding:4, marginBottom:20, width:'fit-content', maxWidth:'100%', overflowX:'auto', scrollbarWidth:'none', WebkitOverflowScrolling:'touch', flexWrap:'nowrap' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubView(t.id)}
            style={{ background:subView===t.id?'#FFFFFF':'transparent', color:subView===t.id?'#1F2937':'#6B7280', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:subView===t.id?'0 1px 3px rgba(0,0,0,0.1)':'none', transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0 }}>
            {t.label}
          </button>
        ))}
      </div>

      {(() => {
        const handleRefundClick = (s) => {
          // Adapt the session-shape object into a session_payments
          // row shape that RefundModal expects.
          setRefundTarget({
            id: s.paymentId,
            amount_cents: Math.round((s.base || s.actual || 0) * 100),
            tip_cents: Math.round((s.tip || 0) * 100),
            payment_method: s.method,
            client_name: s.client,
          });
        };
        const viewProps = { sessions, onRefundClick: handleRefundClick };
        return (
          <>
            {subView==='daily'    && <DailyView    {...viewProps} />}
            {subView==='weekly'   && <WeeklyView   {...viewProps} />}
            {subView==='monthly'  && <MonthlyView  {...viewProps} />}
            {subView==='yearly'   && <YearlyView   {...viewProps} />}
            {subView==='insights' && <InsightsView {...viewProps} />}
          </>
        );
      })()}

      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          therapist={therapist}
          onClose={() => setRefundTarget(null)}
          onRefunded={() => { setReloadTick(t => t + 1); }}
        />
      )}
    </div>
  );
}
