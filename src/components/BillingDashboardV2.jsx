// src/components/BillingDashboardV2.jsx
//
// Phase 16 Billing Dashboard rebuild (HK May 18 2026).
//
// Replaces the V1 design that HK called "extremely poor" with a
// persona-led design for Maria, the 67-year-old solo LMT.
//
// Strategy doc: docs/BILLING_DASHBOARD_STRATEGY.md
// Benchmarks: docs/BENCHMARKS.md
// Mockup: see commit history for billing_mockup_v3.html
//
// Architecture:
//   6 bands per period view (Daily, Weekly, Monthly, Yearly)
//   1. THE NUMBER (collected + comparison)
//   2. THE SHAPE (small bar chart)
//   3. ATTENTION (only when present)
//   4. THE BREAKDOWN (method card + tip ring card)
//   5. PERIOD SELECTOR
//   6. SESSIONS (receipt-style cards)
//   + Bottom: "More detail" deep-dive cards (7 cards, all collapsed)
//
// Insights tab is a different design: card-per-insight with peer-toned
// language. No bottom cards (Insights is already deep-dive content).
//
// Access control:
//   V2 only renders for therapist.email === 'bodymapdemo@gmail.com'
//   while HK validates the design and content. Once approved, V1
//   gets deleted and V2 becomes the only Billing dashboard.

import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronButton } from './ChevronIcon';
import CheckoutModal from './CheckoutModal';
import ImportedDataFootnote from './ImportedDataFootnote';

// ─── Design tokens ─────────────────────────────────────────────────
// Matches the mockup. Cream backgrounds, forest/sage palette, rose
// accent for refunds. Cormorant Garamond serif for numbers, system
// sans for body (no Google Fonts dependency to avoid runtime fetch).
const T = {
  cream:      '#FAF6EE',
  creamDeep:  '#F5EFE0',
  creamEdge:  '#EDE6D6',
  forest:     '#2A5741',
  forestDeep: '#1F4131',
  sage:       '#6B9E80',
  sageSoft:   '#B7D1AB',
  sageTint:   '#F0F6EE',
  rose:       '#A87468',
  gold:       '#C9A86A',
  ink:        '#1F2937',
  gray700:    '#374151',
  gray500:    '#6B7280',
  gray400:    '#9CA3AF',
  gray300:    '#D1D5DB',
  gray100:    '#F3F4F6',
  redText:    '#B91C1C',
  redBg:      '#FEF2F2',
  redBorder:  '#FCA5A5',
  amber:      '#B45309',
  amberBg:    '#FEF3C7',
  amberBorder:'#FCD34D',
  shadowSoft: '0 1px 3px rgba(31, 41, 31, 0.04), 0 1px 2px rgba(31, 41, 31, 0.06)',
  shadowCard: '0 2px 12px rgba(31, 41, 31, 0.05)',
  serif:      "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
};

const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const fmtShort = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDayOnly = (d) => d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
const currency = (n) => `$${Number(Math.abs(n)).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const currencyDecimal = (n) => `$${Number(n).toFixed(2)}`;

// Method label for cards and receipts.
const methodLabel = (m, detail) => {
  if (m === 'stripe_card_on_file' || m === 'stripe_card_new') return detail || 'Card';
  if (m === 'stripe_payment_link') return 'Card (pay link)';
  if (m === 'cash')    return 'Cash';
  if (m === 'venmo')   return 'Venmo';
  if (m === 'zelle')   return 'Zelle';
  if (m === 'cashapp') return 'Cash App';
  if (m === 'check')   return 'Check';
  return 'Other';
};

// Group method into card vs cash vs digital vs check (for breakdown).
const methodGroup = (m) => {
  if (!m) return 'other';
  if (m.startsWith('stripe_')) return 'card';
  if (m === 'cash')    return 'cash';
  if (m === 'venmo' || m === 'zelle' || m === 'cashapp') return 'digital';
  if (m === 'check')   return 'check';
  return 'other';
};

const groupLabel = {
  card:    'Card',
  cash:    'Cash',
  digital: 'Digital',
  check:   'Check',
  other:   'Other',
};

// ─── Band 1: The Number ────────────────────────────────────────────
//
// The big calm hero. Shows what was collected this period, with a
// comparison vs the same period prior. Yearly variant adds the
// gross/refunds/net/processing breakdown below the big number.
function HeroNumber({ label, amount, prevAmount, breakdown = null }) {
  const delta = (amount || 0) - (prevAmount || 0);
  const hasComparison = prevAmount !== null && prevAmount !== undefined;
  const deltaPct = prevAmount > 0
    ? Math.round((delta / prevAmount) * 100)
    : null;

  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.cream} 0%, #FBF7EC 50%, ${T.creamDeep} 100%)`,
      borderRadius: 22,
      padding: '22px 24px 20px',
      marginBottom: 16,
      position: 'relative',
      border: `1px solid ${T.creamEdge}`,
      overflow: 'hidden',
    }}>
      {/* Decorative radial gradient in top right */}
      <div style={{
        position: 'absolute',
        top: -40, right: -30,
        width: 130, height: 130,
        background: 'radial-gradient(circle, rgba(107, 158, 128, 0.18) 0%, transparent 65%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500, marginBottom: 8,
        position: 'relative',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: T.serif,
        fontSize: 56, fontWeight: 600,
        color: T.forestDeep, lineHeight: 1,
        letterSpacing: '-0.02em', marginBottom: 10,
        display: 'flex', alignItems: 'baseline',
        position: 'relative',
      }}>
        <span style={{ fontSize: 28, fontWeight: 500, color: T.forest, marginRight: 2, alignSelf: 'flex-start', marginTop: 8 }}>$</span>
        <span>{Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
      </div>
      {hasComparison && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.gray700, position: 'relative' }}>
          {delta >= 0 ? (
            <span style={{ color: T.sage, fontWeight: 700 }}>↑ {currency(delta)}</span>
          ) : (
            <span style={{ color: T.rose, fontWeight: 700 }}>↓ {currency(delta)}</span>
          )}
          {deltaPct !== null && (
            <span style={{ color: T.gray500 }}>
              ({delta >= 0 ? '+' : ''}{deltaPct}%) vs prior period
            </span>
          )}
        </div>
      )}
      {breakdown && (
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: `1px dashed ${T.creamEdge}`,
          position: 'relative',
        }}>
          <NetBreakdownRow cells={breakdown} />
        </div>
      )}
    </div>
  );
}

function NetBreakdownRow({ cells }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cells.map(() => '1fr').join(' '), gap: 8 }}>
      {cells.map((cell, i) => {
        if (cell.divider) {
          return (
            <div key={i} style={{
              textAlign: 'center', fontSize: 14, color: T.gray400,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4,
            }}>{cell.divider}</div>
          );
        }
        return (
          <div key={i}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: T.gray400,
            }}>{cell.label}</div>
            <div style={{
              fontFamily: T.serif, fontSize: 16, fontWeight: 600,
              color: cell.minus ? T.rose : T.forestDeep, marginTop: 2,
            }}>{cell.value}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Band 2: The Shape ─────────────────────────────────────────────
//
// Small bar chart. Today/current highlighted in deep forest, prior
// in sage gradient, future in dashed sage pattern. No axes, no labels.
// Followed by a single pace line if applicable.
function ShapeChart({ title, bars, paceLine = null }) {
  const max = Math.max(...bars.map(b => b.value || 0), 1);
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18,
      padding: '20px 22px', marginBottom: 16,
      boxShadow: T.shadowSoft,
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontFamily: T.serif, fontSize: 16, fontWeight: 600,
          color: T.forestDeep,
        }}>{title}</div>
      </div>
      <div style={{
        height: 96, display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between', gap: 6,
        paddingBottom: 4, position: 'relative',
      }}>
        {bars.map((bar, i) => {
          const heightPct = max > 0 ? Math.max(12 / 96 * 100, (bar.value / max) * 100) : 12;
          const isToday = bar.kind === 'today';
          const isFuture = bar.kind === 'future';
          const bg = isToday
            ? `linear-gradient(180deg, ${T.forest} 0%, ${T.forestDeep} 100%)`
            : isFuture
              ? `repeating-linear-gradient(45deg, ${T.sageTint}, ${T.sageTint} 4px, white 4px, white 8px)`
              : `linear-gradient(180deg, ${T.sageSoft} 0%, ${T.sage} 100%)`;
          return (
            <div key={i} style={{
              flex: 1, height: `${heightPct}%`,
              background: bg,
              borderRadius: '5px 5px 0 0',
              minHeight: 12,
              border: isFuture ? `1px dashed ${T.sageSoft}` : 'none',
            }} title={bar.label ? `${bar.label}: ${currency(bar.value)}` : ''} />
          );
        })}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 1, background: T.gray100,
        }} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 6,
        marginTop: 8,
        fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
        color: T.gray400, textTransform: 'uppercase',
      }}>
        {bars.map((bar, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            color: bar.kind === 'today' ? T.forest : T.gray400,
            fontWeight: bar.kind === 'today' ? 700 : 600,
          }}>{bar.label || ''}</div>
        ))}
      </div>
      {paceLine && (
        <div style={{
          marginTop: 12, paddingTop: 10,
          borderTop: `1px solid ${T.creamDeep}`,
          fontSize: 12, color: T.gray700, lineHeight: 1.5,
        }}>
          {paceLine}
        </div>
      )}
    </div>
  );
}

// ─── Band 3: Attention ─────────────────────────────────────────────
//
// Only renders if any items present. Shows outstanding payments,
// refunds issued, recurring client gaps. Each row has icon, title,
// subtitle, optional action link.
function AttentionBand({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18,
      marginBottom: 16, boxShadow: T.shadowSoft, overflow: 'hidden',
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: i < items.length - 1 ? `1px solid ${T.gray100}` : 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, flexShrink: 0,
            background: item.iconBg || T.amberBg,
            color: item.iconColor || T.amber,
          }}>{item.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: T.ink,
              lineHeight: 1.3, marginBottom: 2,
            }}>{item.title}</div>
            <div style={{ fontSize: 12, color: T.gray500, lineHeight: 1.4 }}>{item.sub}</div>
          </div>
          {item.action && (
            <div style={{
              fontSize: 12, fontWeight: 700, color: T.forest, whiteSpace: 'nowrap',
            }}>{item.action} →</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Band 4: The Breakdown ─────────────────────────────────────────
//
// Two-column grid on mobile: method card + tip ring card.
function BreakdownRow({ methods, tips }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12, marginBottom: 16,
    }}>
      <MethodCard methods={methods} />
      <TipRingCard {...tips} />
    </div>
  );
}

function MethodCard({ methods }) {
  const total = methods.reduce((s, m) => s + (m.amount || 0), 0);
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18,
      padding: '18px 16px', boxShadow: T.shadowSoft,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500, marginBottom: 14,
      }}>By method</div>
      {methods.length === 0 ? (
        <div style={{ fontSize: 12, color: T.gray400, fontStyle: 'italic' }}>
          No payments yet
        </div>
      ) : (
        methods.map((m, i) => {
          const pct = total > 0 ? Math.round((m.amount / total) * 100) : 0;
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column',
              marginBottom: i < methods.length - 1 ? 10 : 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{m.label}</span>
                <span style={{
                  fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.forestDeep,
                }}>{currency(m.amount)}</span>
              </div>
              <span style={{ fontSize: 11, color: T.gray400, fontWeight: 500 }}>{pct}%</span>
              <div style={{
                height: 4, background: T.creamDeep,
                borderRadius: 4, overflow: 'hidden', marginTop: 4,
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg, ${T.sage} 0%, ${T.sageSoft} 100%)`,
                  borderRadius: 4,
                }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function TipRingCard({ pct, dollars, tippedCount, totalCount, compareText }) {
  // SVG ring; circumference ~= 2 * PI * 42 = 264. Offset = 264 - (264 * pct / 100).
  const C = 264;
  const offset = C - (C * Math.min(pct || 0, 100) / 100);
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18,
      padding: '18px 16px', boxShadow: T.shadowSoft,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500, marginBottom: 10,
        alignSelf: 'flex-start',
      }}>Tips</div>
      <div style={{ position: 'relative', width: 78, height: 78, margin: '6px 0 10px' }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke={T.creamDeep} strokeWidth="8" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={T.forest} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={offset} />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', fontFamily: T.serif,
        }}>
          <span style={{ fontSize: 22, fontWeight: 600, color: T.forestDeep, lineHeight: 1 }}>
            {pct || 0}%
          </span>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
        {currency(dollars || 0)} in tips
      </div>
      <div style={{ fontSize: 12, color: T.gray500, marginTop: 4 }}>
        {tippedCount} of {totalCount} sessions tipped
      </div>
      {compareText && (
        <div style={{
          fontSize: 12, color: T.sage, fontWeight: 700, marginTop: 6,
        }}>{compareText}</div>
      )}
    </div>
  );
}

// ─── Band 5: Period Selector ───────────────────────────────────────
function PeriodChips({ chips, onPick }) {
  return (
    <div style={{
      display: 'flex', gap: 6, marginBottom: 18,
      overflowX: 'auto', scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
    }}>
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={() => onPick && onPick(c)}
          style={{
            background: c.active ? T.forest : '#FFFFFF',
            color: c.active ? '#FFFFFF' : T.gray500,
            border: c.active ? `1px solid ${T.forest}` : `1px solid ${T.creamEdge}`,
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 11, fontWeight: 600,
            textAlign: 'center', flexShrink: 0, cursor: 'pointer',
            minWidth: 70,
          }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', opacity: 0.8,
          }}>{c.label}</div>
          <div style={{
            fontFamily: T.serif, fontSize: 18, fontWeight: 600,
            marginTop: 1, marginBottom: 1,
          }}>{c.value}</div>
          <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 500 }}>{c.meta}</div>
        </button>
      ))}
    </div>
  );
}

// ─── Band 6: Sessions (Receipt Cards) ─────────────────────────────
function ReceiptCard({ session, onRefundClick }) {
  // session shape from BillingDashboard.js data layer:
  //   { id, client, date, time, duration, rate, actual, base, tip,
  //     status, method, methodDetail, service, source, paymentId, ... }
  const isPaid = session.status === 'paid' && session.source === 'payment';
  const isRefunded = session.source === 'refund' || session.status === 'refunded';
  const isPending = session.status === 'pending' || session.status === 'outstanding';
  const isNoShow = session.status === 'no_show';
  const isCancelFee = session.source === 'cancellation_fee';

  // Status bar at bottom of card.
  let statusBg = T.sageTint;
  let statusBorder = T.sageSoft;
  let statusColor = T.forestDeep;
  let statusLabel = '✓ Paid';
  let statusRight = '';

  if (isRefunded) {
    statusBg = T.redBg; statusBorder = T.redBorder; statusColor = T.redText;
    statusLabel = '↩ Refunded';
    statusRight = session.method && session.method.startsWith('stripe_')
      ? 'Returns in 5-10 days' : 'Marked refunded';
  } else if (isPending && session.status === 'outstanding') {
    statusBg = T.amberBg; statusBorder = T.amberBorder; statusColor = T.amber;
    statusLabel = '⏳ Outstanding';
  } else if (isPending) {
    statusBg = T.amberBg; statusBorder = T.amberBorder; statusColor = T.amber;
    statusLabel = '⏳ Pending';
  } else if (isNoShow) {
    statusBg = T.amberBg; statusBorder = T.amberBorder; statusColor = T.amber;
    statusLabel = '○ No-show';
  } else if (isCancelFee) {
    statusBg = T.creamDeep; statusBorder = T.creamEdge; statusColor = T.gray700;
    statusLabel = '○ Cancel fee';
  }

  const showRefundBtn = isPaid && session.paymentId && onRefundClick;
  const tipPart = (session.tip || 0) > 0;
  const total = (session.base != null ? session.base : (session.actual || 0)) + (session.tip || 0);

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 14,
      marginBottom: 12, boxShadow: T.shadowSoft,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Perforated top edge */}
      <div style={{
        height: 6,
        background: `radial-gradient(circle at 5px 0, transparent 4px, white 4px), radial-gradient(circle at 15px 0, transparent 4px, white 4px), ${T.cream}`,
        backgroundSize: '14px 6px', backgroundRepeat: 'repeat-x',
      }} />
      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={{
            fontFamily: T.serif, fontSize: 18, fontWeight: 600,
            color: T.forestDeep, lineHeight: 1.1,
          }}>{session.client || 'Client'}</div>
          <div style={{
            fontSize: 12, color: T.gray500, fontWeight: 600, textAlign: 'right',
          }}>{session.service || `${session.duration || 60}-min`}</div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 12, color: T.gray500, marginBottom: 12,
        }}>
          <span>{session.time}</span>
          <span>{methodLabel(session.method, session.methodDetail) || (isPending ? 'Not yet paid' : '')}</span>
        </div>
        <div style={{ borderTop: `1px dashed ${T.gray300}`, paddingTop: 10 }}>
          {isPending && !isPaid && !isRefunded && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.gray700, padding: '3px 0' }}>
              <span>Expected</span>
              <span>{currencyDecimal(session.rate || 0)}</span>
            </div>
          )}
          {isRefunded && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.gray700, padding: '3px 0' }}>
                <span>Session</span>
                <span>{currencyDecimal(session.base != null ? session.base : (session.actual || 0))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.redText, padding: '3px 0' }}>
                <span>Refund</span>
                <span>-{currencyDecimal((session.base != null ? session.base : (session.actual || 0)) + (session.tip || 0))}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 14, fontWeight: 700, color: T.forestDeep,
                borderTop: `1px solid ${T.gray300}`, marginTop: 6, paddingTop: 8,
              }}>
                <span>Net</span><span>{currencyDecimal(0)}</span>
              </div>
            </>
          )}
          {!isPending && !isRefunded && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.gray700, padding: '3px 0' }}>
                <span>{isCancelFee ? 'Cancel fee' : isNoShow ? 'No-show fee' : 'Session'}</span>
                <span>{currencyDecimal(session.base != null ? session.base : (session.actual || 0))}</span>
              </div>
              {tipPart && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.gray700, padding: '3px 0' }}>
                  <span>Tip</span>
                  <span>{currencyDecimal(session.tip || 0)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 14, fontWeight: 700, color: T.forestDeep,
                borderTop: `1px solid ${T.gray300}`, marginTop: 6, paddingTop: 8,
              }}>
                <span>Total</span><span>{currencyDecimal(total)}</span>
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: statusBg, borderTop: `1px solid ${statusBorder}`,
        padding: '8px 16px', fontSize: 12, fontWeight: 700, color: statusColor,
      }}>
        <span>{statusLabel}</span>
        {statusRight && <span style={{ fontWeight: 500, opacity: 0.8 }}>{statusRight}</span>}
        {showRefundBtn && !statusRight && (
          <button onClick={(e) => { e.stopPropagation(); onRefundClick(session); }}
            style={{
              background: 'transparent', border: 'none',
              color: statusColor, fontSize: 12, fontWeight: 600,
              textDecoration: 'underline', cursor: 'pointer', padding: 0,
            }}>
            Refund
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Deep-dive cards (bottom of page) ──────────────────────────────
//
// 7 collapsed cards. Tap to open. Each card shows an icon, title,
// subtitle on the closed face. Open reveals detailed content.
// ─── ChevronPill ───────────────────────────────────────────────────
//
// Shared collapsible affordance used by DeepDiveCard, group cards,
// and OtherMoneyCollapsible. A sage-tinted pill containing a chevron
// that rotates 180 degrees when open. Consistent visual signal that
// "this is a thing you can open." Tap target is 32x32.
function ChevronPill({ open }) {
  return <ChevronButton open={open} size={32} ariaLabel={open ? 'Collapse' : 'Expand'} />;
}

function DeepDiveCard({ icon, title, sub, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 16,
      marginBottom: 10,
      boxShadow: open ? '0 4px 16px rgba(31, 41, 31, 0.07)' : T.shadowSoft,
      overflow: 'hidden',
      border: `1px solid ${open ? T.sageSoft : T.creamEdge}`,
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'transparent', border: 'none',
          textAlign: 'left',
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, flexShrink: 0,
          background: open ? T.sageTint : T.creamDeep,
          color: T.forest,
          transition: 'background 0.2s ease',
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.2, marginBottom: 2,
          }}>{title}</div>
          <div style={{ fontSize: 12, color: T.gray500, lineHeight: 1.4 }}>{sub}</div>
        </div>
        <ChevronPill open={open} />
      </button>
      {open && (
        <div style={{
          padding: '14px 16px 16px',
          borderTop: `1px solid ${T.creamDeep}`,
          fontSize: 13, color: T.gray700, lineHeight: 1.6,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function DeepDiveRow({ label, sub, value, valueClass }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '5px 0',
      borderBottom: `1px dotted ${T.creamEdge}`,
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span>{label}</span>
        {sub && <span style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>{sub}</span>}
      </div>
      <span style={{
        fontFamily: T.serif, fontWeight: 600,
        color: valueClass === 'minus' ? T.rose : valueClass === 'muted' ? T.gray400 : T.forestDeep,
        whiteSpace: 'nowrap',
      }}>{value}</span>
    </div>
  );
}

function DeepDiveNote({ children }) {
  return (
    <div style={{
      marginTop: 10,
      fontSize: 12, color: T.gray500, fontStyle: 'italic', lineHeight: 1.5,
    }}>{children}</div>
  );
}

// ─── Data helpers ──────────────────────────────────────────────────
//
// Pure functions that turn the session array (the contract from V1's
// data layer) into the shapes each band needs.

// Returns all sessions for the given date (single day).
function sessionsForDay(sessions, day) {
  return sessions.filter(s => sameDay(s.date, day));
}

// Returns sessions in the inclusive range [start, end].
function sessionsInRange(sessions, start, end) {
  return sessions.filter(s => s.date >= start && s.date <= end);
}

// Sum of revenue (amount actually collected) excluding refunds and cancel fees.
// Maps cleanly to the "collected today" headline number.
function sumCollected(sessions) {
  return sessions
    .filter(s => s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund')
    .reduce((sum, s) => sum + (s.actual || 0), 0);
}

// Sum of refunds for the period.
function sumRefunds(sessions) {
  return sessions
    .filter(s => s.source === 'refund')
    .reduce((sum, s) => sum + (s.actual || 0), 0);
}

// Sum of cancellation fees.
function sumCancelFees(sessions) {
  return sessions
    .filter(s => s.source === 'cancellation_fee')
    .reduce((sum, s) => sum + (s.actual || 0), 0);
}

// Method breakdown for Band 4.
function buildMethodBreakdown(sessions) {
  // Aggregate by method group.
  const groups = {};
  sessions.forEach(s => {
    if (s.status !== 'paid' || s.source === 'refund') return;
    const g = methodGroup(s.method);
    groups[g] = (groups[g] || 0) + (s.actual || 0);
  });
  return ['card', 'cash', 'digital', 'check', 'other']
    .filter(k => (groups[k] || 0) > 0)
    .map(k => ({ key: k, label: groupLabel[k], amount: groups[k] }));
}

// Tip metrics for the period.
function buildTipMetrics(sessions) {
  const paid = sessions.filter(s => s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund');
  const tipped = paid.filter(s => (s.tip || 0) > 0);
  const tipTotal = paid.reduce((sum, s) => sum + (s.tip || 0), 0);
  const baseTotal = paid.reduce((sum, s) => sum + (s.base != null ? s.base : (s.actual || 0)) - (s.tip || 0), 0);
  // Tip rate = tips / base (industry standard, not / gross).
  const pct = baseTotal > 0 ? Math.round((tipTotal / baseTotal) * 100) : 0;
  return {
    pct,
    dollars: tipTotal,
    tippedCount: tipped.length,
    totalCount: paid.length,
  };
}

// 7-day bar chart input for Daily view, centered on `centerDate`.
// Shows the day-of-week each bar represents; today highlighted.
function buildDailyShapeBars(sessions, centerDate) {
  // Show the most recent 7 days ending on centerDate.
  const bars = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = addDays(centerDate, offset);
    const dayCollected = sumCollected(sessionsForDay(sessions, d));
    const isFuture = d > TODAY;
    const isCenter = sameDay(d, centerDate);
    bars.push({
      value: dayCollected,
      label: fmtDayOnly(d),
      kind: isCenter ? 'today' : isFuture ? 'future' : 'past',
    });
  }
  return bars;
}

// Build the Attention items for the Daily view.
function buildDailyAttention(sessions, day, allSessions) {
  const items = [];
  const daySessions = sessionsForDay(sessions, day);

  // Outstanding/pending today
  const outstanding = daySessions.filter(s => s.status === 'outstanding' || s.status === 'pending');
  if (outstanding.length === 1) {
    const s = outstanding[0];
    items.push({
      icon: '⏳', iconBg: T.amberBg, iconColor: T.amber,
      title: `${s.client} hasn't paid yet`,
      sub: `${s.service || `${s.duration || 60}-min`} · ${s.time} · ${currency(s.rate)}`,
      action: 'Send link',
    });
  } else if (outstanding.length > 1) {
    const totalOwed = outstanding.reduce((s, x) => s + (x.rate || 0), 0);
    items.push({
      icon: '⏳', iconBg: T.amberBg, iconColor: T.amber,
      title: `${outstanding.length} unpaid sessions today`,
      sub: `${currency(totalOwed)} expected`,
      action: 'View',
    });
  }

  // Refunds today
  const refundsToday = daySessions.filter(s => s.source === 'refund');
  refundsToday.forEach(r => {
    const onCard = r.method && r.method.startsWith('stripe_');
    items.push({
      icon: '↩', iconBg: T.redBg, iconColor: T.redText,
      title: `${currency(r.actual || 0)} refunded to ${r.client}`,
      sub: onCard ? 'Back on her card in 5-10 days' : 'Marked refunded',
      action: 'View',
    });
  });

  // No-shows today
  const noShowsToday = daySessions.filter(s => s.status === 'no_show');
  if (noShowsToday.length > 0) {
    items.push({
      icon: '○', iconBg: T.amberBg, iconColor: T.amber,
      title: `${noShowsToday.length} no-show${noShowsToday.length > 1 ? 's' : ''} today`,
      sub: noShowsToday.map(n => n.client).join(', '),
      action: 'View',
    });
  }

  return items;
}

// Build period selector chips for Daily view (5 days, today centered).
function buildDailyChips(sessions, selectedDate, onPick) {
  const chips = [];
  for (let offset = -2; offset <= 2; offset++) {
    const d = addDays(selectedDate, offset);
    const dayItems = sessionsForDay(sessions, d).filter(s =>
      s.status !== 'no_show' && s.source !== 'cancellation_fee' && s.source !== 'refund'
    );
    const collected = sumCollected(sessionsForDay(sessions, d));
    let label;
    if (sameDay(d, TODAY)) label = 'Today';
    else if (sameDay(d, addDays(TODAY, -1))) label = 'Yesterday';
    else if (sameDay(d, addDays(TODAY, 1))) label = 'Tomorrow';
    else label = fmtShort(d).split(', ')[0]; // "Mon" from "Mon, May 18"
    chips.push({
      label,
      value: collected > 0 ? currency(collected) : '$0',
      meta: `${dayItems.length} sess`,
      active: sameDay(d, selectedDate),
      date: d,
    });
  }
  return chips;
}

// Pace line for Daily Band 2.
function buildDailyPaceLine(allSessions, selectedDate) {
  // "Week so far: $X. To match last week ($Y), you need $Z over N days."
  // Week starts Monday.
  const getMonday = (d) => {
    const x = new Date(d);
    const day = x.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    x.setDate(x.getDate() + diff);
    x.setHours(0,0,0,0);
    return x;
  };
  if (!sameDay(selectedDate, TODAY)) return null;
  const thisWeekStart = getMonday(TODAY);
  const todayEnd = new Date(TODAY); todayEnd.setHours(23,59,59,999);
  const thisWeekCollected = sumCollected(sessionsInRange(allSessions, thisWeekStart, todayEnd));

  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  lastWeekEnd.setHours(23,59,59,999);
  const lastWeekCollected = sumCollected(sessionsInRange(allSessions, lastWeekStart, lastWeekEnd));

  if (lastWeekCollected === 0) return null;

  const daysRemaining = 7 - ((TODAY.getDay() === 0 ? 7 : TODAY.getDay()));
  if (daysRemaining <= 0) return null;
  const gap = lastWeekCollected - thisWeekCollected;
  if (gap <= 0) {
    return (
      <span>
        Week so far: <strong style={{ color: T.forestDeep }}>{currency(thisWeekCollected)}</strong>.
        {' '}You've already beaten last week ({currency(lastWeekCollected)}).
      </span>
    );
  }
  return (
    <span>
      Week so far: <strong style={{ color: T.forestDeep }}>{currency(thisWeekCollected)}</strong>.
      {' '}To match last week ({currency(lastWeekCollected)}), you need <strong style={{ color: T.forestDeep }}>{currency(gap)} over {daysRemaining} day{daysRemaining > 1 ? 's' : ''}</strong>.
    </span>
  );
}

// Detect recurring client gaps for the attention band.
// A client is "overdue" if they typically book every N days and
// haven't been seen in > 1.5*N days. Lightweight heuristic.
function buildRecurringGaps(allSessions, asOfDate, maxToReturn = 1) {
  // Group by client.
  const byClient = {};
  allSessions
    .filter(s => s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund')
    .forEach(s => {
      const key = s.client || 'Unknown';
      if (!byClient[key]) byClient[key] = [];
      byClient[key].push(s.date);
    });

  const overdue = [];
  Object.keys(byClient).forEach(client => {
    const dates = byClient[client].sort((a, b) => a - b);
    if (dates.length < 3) return; // need history to call cadence
    // Compute median gap between consecutive visits.
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      const ms = dates[i] - dates[i - 1];
      const days = ms / (1000 * 60 * 60 * 24);
      if (days > 0 && days < 90) gaps.push(days);
    }
    if (gaps.length < 2) return;
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    if (median > 35) return; // too sporadic for a "regular" callout
    // Days since last visit.
    const lastVisit = dates[dates.length - 1];
    const daysSince = (asOfDate - lastVisit) / (1000 * 60 * 60 * 24);
    if (daysSince > median * 1.6 && daysSince < median * 4) {
      const weeksSince = Math.round(daysSince / 7);
      const usualWeeks = Math.round(median / 7);
      overdue.push({
        client,
        weeksSince,
        usualWeeks,
        priority: daysSince / median, // higher = more overdue
      });
    }
  });

  overdue.sort((a, b) => b.priority - a.priority);
  return overdue.slice(0, maxToReturn);
}

// ─── DailyView V2 ──────────────────────────────────────────────────
function DailyView({ sessions, therapist, onRefundClick }) {
  const [selectedOffset, setSelectedOffset] = useState(0);
  const selectedDate = addDays(TODAY, selectedOffset);

  // Slice the data for the selected day + comparison day.
  const daySessions = sessionsForDay(sessions, selectedDate);
  const prevDayDate = addDays(selectedDate, -7); // compare to same day-of-week prior week
  const prevDaySessions = sessionsForDay(sessions, prevDayDate);

  const collected = sumCollected(daySessions);
  const prevCollected = sumCollected(prevDaySessions);

  const methods = buildMethodBreakdown(daySessions);
  const tips = buildTipMetrics(daySessions);

  // Attention items.
  let attention = buildDailyAttention(sessions, selectedDate, sessions);
  // Add recurring gap callout (for today only).
  if (sameDay(selectedDate, TODAY)) {
    const gaps = buildRecurringGaps(sessions, TODAY, 1);
    gaps.forEach(g => {
      attention.push({
        icon: '🌿', iconBg: T.sageTint, iconColor: T.forest,
        title: `${g.client} hasn't been in ${g.weeksSince} week${g.weeksSince > 1 ? 's' : ''}`,
        sub: `Usually every ${g.usualWeeks} week${g.usualWeeks > 1 ? 's' : ''}. Worth a check-in?`,
        action: 'Message',
      });
    });
  }

  // Shape bars (7 days ending on selectedDate).
  const shapeBars = buildDailyShapeBars(sessions, selectedDate);
  const paceLine = buildDailyPaceLine(sessions, selectedDate);

  // Period chips.
  const chips = buildDailyChips(sessions, selectedDate);

  // Sessions to show in Band 6. Include refunded + paid + pending + no-shows but
  // sort by time of day.
  const sortedDaySessions = [...daySessions]
    .filter(s => s.source !== 'cancellation_fee') // cancel fees go in deep-dives
    .sort((a, b) => {
      const ta = (a.time || '00:00').replace(/[^0-9:apmAPM]/g, '');
      const tb = (b.time || '00:00').replace(/[^0-9:apmAPM]/g, '');
      return ta.localeCompare(tb);
    });

  // Heading copy.
  let dayLabel = 'today';
  if (sameDay(selectedDate, addDays(TODAY, -1))) dayLabel = 'yesterday';
  else if (sameDay(selectedDate, addDays(TODAY, 1))) dayLabel = 'tomorrow';
  else if (!sameDay(selectedDate, TODAY)) dayLabel = fmtShort(selectedDate);

  return (
    <div>
      {/* Band 1 */}
      <HeroNumber
        label={`Collected ${dayLabel}`}
        amount={collected}
        prevAmount={sameDay(selectedDate, TODAY) ? prevCollected : null}
      />

      {/* Band 2 */}
      <ShapeChart
        title="This week's shape"
        bars={shapeBars}
        paceLine={paceLine}
      />

      {/* Band 3 */}
      {attention.length > 0 && <AttentionBand items={attention} />}

      {/* Band 4 */}
      <BreakdownRow methods={methods} tips={tips} />

      {/* Other money collapsible */}
      <OtherMoneyCollapsible sessions={daySessions} periodLabel={dayLabel} />

      {/* Band 5 */}
      <PeriodChips
        chips={chips}
        onPick={c => {
          const offset = Math.round((c.date - TODAY) / (1000 * 60 * 60 * 24));
          setSelectedOffset(offset);
        }}
      />

      {/* Band 6 */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500,
        marginBottom: 10, paddingLeft: 4,
      }}>{dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}'s sessions</div>
      {sortedDaySessions.length === 0 ? (
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: 32,
          textAlign: 'center', color: T.gray400, fontSize: 14, marginBottom: 16,
          boxShadow: T.shadowSoft,
        }}>No sessions on this day.</div>
      ) : (
        sortedDaySessions.map(s => (
          <ReceiptCard key={s.id} session={s} onRefundClick={onRefundClick} />
        ))
      )}

      {/* Deep-dive cards */}
      <DeepDiveSection sessions={sessions} periodLabel={dayLabel} therapist={therapist} />
    </div>
  );
}

// ─── "Other money in & out" collapsible (mid-page) ────────────────
function OtherMoneyCollapsible({ sessions, periodLabel }) {
  const [open, setOpen] = useState(false);
  const cancelFees = sumCancelFees(sessions);
  const refunds = sumRefunds(sessions);
  const noShowFees = sessions
    .filter(s => s.source === 'no_show' && (s.actual || 0) > 0)
    .reduce((sum, s) => sum + (s.actual || 0), 0);
  // Discounts: not in current data model. Hidden until tracked.
  const collected = sumCollected(sessions);
  const net = collected + cancelFees + noShowFees - refunds;

  // Hide entirely if all zero.
  if (cancelFees === 0 && refunds === 0 && noShowFees === 0) return null;

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18,
      marginBottom: 12, boxShadow: T.shadowSoft, overflow: 'hidden',
      border: `1px solid ${open ? T.sageSoft : 'transparent'}`,
      transition: 'border-color 0.2s ease',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '14px 18px', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'transparent', border: 'none', textAlign: 'left', gap: 12,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: T.gray500,
        }}>Other money in & out {periodLabel}</span>
        <ChevronPill open={open} />
      </button>
      {open && (
        <div style={{
          padding: '14px 18px 16px',
          borderTop: `1px solid ${T.creamDeep}`,
          fontSize: 13, color: T.gray700, lineHeight: 1.6,
        }}>
          {cancelFees > 0 && (
            <DeepDiveRow label="Cancellation fees collected" value={currency(cancelFees)} />
          )}
          {noShowFees > 0 && (
            <DeepDiveRow label="No-show fees collected" value={currency(noShowFees)} />
          )}
          {refunds > 0 && (
            <DeepDiveRow label="Refunds issued" value={`-${currency(refunds)}`} valueClass="minus" />
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            borderTop: `1px solid ${T.gray300}`, marginTop: 8, paddingTop: 8,
            fontWeight: 700,
          }}>
            <span>Net {periodLabel}</span>
            <span style={{ fontFamily: T.serif, fontWeight: 700, color: T.forestDeep }}>
              {currency(net)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deep-dive section (bottom of page) ────────────────────────────
//
// Same 7 cards on every period view. Numbers scaled to the period.
// Per BENCHMARKS.md, peer comparisons are HIDDEN where we don't have
// real industry data. We show therapist's own numbers + a note for
// future MyBodyMap aggregate.
function DeepDiveSection({ sessions, periodLabel, therapist }) {
  return (
    <div style={{
      marginTop: 28, paddingTop: 22,
      borderTop: `1px dashed ${T.creamEdge}`,
    }}>
      <div style={{
        fontFamily: T.serif, fontSize: 18, fontWeight: 600,
        color: T.forestDeep, marginBottom: 4,
      }}>More detail</div>
      <div style={{
        fontSize: 13, color: T.gray500,
        fontStyle: 'italic', marginBottom: 16, lineHeight: 1.5,
      }}>
        Tap any card to open. These views are useful when you want to step back from the day.
      </div>

      <PricingDeepDive therapist={therapist} />
      <DiscountsDeepDive sessions={sessions} periodLabel={periodLabel} />
      <NoShowRecoveryDeepDive sessions={sessions} />
      <TopClientsDeepDive sessions={sessions} />
      <DepositsDeepDive sessions={sessions} />
      <PackagesDeepDive sessions={sessions} />
      <RefundRateDeepDive sessions={sessions} />
    </div>
  );
}

// 1. Pricing snapshot.
function PricingDeepDive({ therapist }) {
  // For Phase A we don't have full services in props, so show the
  // therapist's session_rate (the default rate they configured).
  // Future: pull from services table for full breakdown.
  const rate = therapist?.session_rate || 95;
  return (
    <DeepDiveCard
      icon="💵"
      title="Your pricing"
      sub={`Default rate: ${currency(rate)} per session`}>
      <div style={{
        fontFamily: T.serif, fontSize: 17, fontWeight: 600,
        color: T.forestDeep, lineHeight: 1.3, marginBottom: 10,
      }}>Your current default session rate.</div>
      <DeepDiveRow
        label="Default session rate"
        sub="set in your therapist profile"
        value={currency(rate)} />
      <DeepDiveNote>
        For Front Range Colorado, solo independent practitioners typically charge $110-130 for a 60-minute session. National median across all settings is $85. Source: industry research, January 2026.
      </DeepDiveNote>
    </DeepDiveCard>
  );
}

// 2. Discounts & comps.
function DiscountsDeepDive({ sessions, periodLabel }) {
  // Discounts not tracked in current data model. Show "coming soon"
  // message rather than fake numbers.
  return (
    <DeepDiveCard
      icon="🎁"
      title="Discounts & comps"
      sub="Track money given back to regulars">
      <div style={{
        fontFamily: T.serif, fontSize: 17, fontWeight: 600,
        color: T.forestDeep, lineHeight: 1.3, marginBottom: 10,
      }}>Coming soon.</div>
      <DeepDiveNote>
        We're building a clean way to log regular discounts, senior discounts, comps, and referral credits, separately from session revenue. This card will show them broken out by reason once the feature ships.
      </DeepDiveNote>
    </DeepDiveCard>
  );
}

// 3. No-show recovery.
function NoShowRecoveryDeepDive({ sessions }) {
  // For each no-show, check if the same client booked again within 30 days.
  const noShows = sessions.filter(s => s.status === 'no_show');
  const recoveredClients = new Set();
  noShows.forEach(ns => {
    const followups = sessions.filter(s =>
      s.client === ns.client &&
      s.date > ns.date &&
      (s.date - ns.date) < 30 * 24 * 60 * 60 * 1000 &&
      s.status === 'paid'
    );
    if (followups.length > 0) recoveredClients.add(ns.client);
  });
  const total = noShows.length;
  const recovered = recoveredClients.size;
  const pct = total > 0 ? Math.round((recovered / total) * 100) : 0;

  return (
    <DeepDiveCard
      icon="🔁"
      title="No-show recovery"
      sub={total === 0
        ? 'No no-shows recorded yet'
        : `${recovered} of ${total} no-shows came back within 30 days`}>
      {total === 0 ? (
        <>
          <div style={{
            fontFamily: T.serif, fontSize: 17, fontWeight: 600,
            color: T.forestDeep, marginBottom: 10,
          }}>No no-shows in your data yet.</div>
          <DeepDiveNote>
            Once you have a few no-shows, we can show how many came back to your table within 30 days. The industry rate of return varies widely.
          </DeepDiveNote>
        </>
      ) : (
        <>
          <div style={{
            fontFamily: T.serif, fontSize: 17, fontWeight: 600,
            color: T.forestDeep, marginBottom: 10,
          }}>
            <span style={{ color: T.sage, fontWeight: 700 }}>{pct}%</span> of no-shows rebook within 30 days.
          </div>
          <DeepDiveRow
            label="Your rate"
            sub={`${recovered} of ${total} returned`}
            value={`${pct}%`} />
          <DeepDiveNote>
            Industry data on no-show recovery for solo LMT practice is not publicly available. We'll add peer comparisons once we have aggregate data from enough MyBodyMap therapists.
          </DeepDiveNote>
        </>
      )}
    </DeepDiveCard>
  );
}

// 4. Top clients.
function TopClientsDeepDive({ sessions }) {
  const byClient = {};
  sessions
    .filter(s => s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund')
    .forEach(s => {
      if (!byClient[s.client]) byClient[s.client] = { revenue: 0, count: 0 };
      byClient[s.client].revenue += s.actual || 0;
      byClient[s.client].count += 1;
    });
  const top = Object.entries(byClient)
    .map(([client, data]) => ({ client, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const top5Total = top.reduce((s, x) => s + x.revenue, 0);
  const allTotal = Object.values(byClient).reduce((s, x) => s + x.revenue, 0);
  const pct = allTotal > 0 ? Math.round((top5Total / allTotal) * 100) : 0;

  return (
    <DeepDiveCard
      icon="⭐"
      title="Top clients"
      sub={top.length === 0
        ? 'No paid sessions yet'
        : `Top ${top.length} are ${pct}% of revenue`}>
      {top.length === 0 ? (
        <div style={{
          fontFamily: T.serif, fontSize: 17, fontWeight: 600,
          color: T.forestDeep,
        }}>No paid sessions yet.</div>
      ) : (
        <>
          <div style={{
            fontFamily: T.serif, fontSize: 17, fontWeight: 600,
            color: T.forestDeep, lineHeight: 1.3, marginBottom: 10,
          }}>
            Your top <span style={{ color: T.sage, fontWeight: 700 }}>{top.length}</span> clients are {pct}% of revenue.
          </div>
          {top.map((c, i) => (
            <DeepDiveRow
              key={i}
              label={c.client}
              sub={`${c.count} session${c.count > 1 ? 's' : ''}`}
              value={currency(c.revenue)} />
          ))}
          <DeepDiveNote>
            A few clients carry a meaningful share of your week. Worth knowing if life changes for any of them. Nothing to act on, just useful to see.
          </DeepDiveNote>
        </>
      )}
    </DeepDiveCard>
  );
}

// 5. Deposits & pre-payments.
function DepositsDeepDive({ sessions }) {
  // We don't have a separate deposits view yet in the data layer
  // (deposits roll into session revenue). For now, show pending
  // future sessions as a proxy.
  const futurePending = sessions.filter(s =>
    s.status === 'pending' && s.date >= TODAY
  );
  const totalExpected = futurePending.reduce((sum, s) => sum + (s.rate || 0), 0);

  return (
    <DeepDiveCard
      icon="💳"
      title="Deposits & pre-payments"
      sub={futurePending.length === 0
        ? 'No future bookings pending'
        : `${futurePending.length} future booking${futurePending.length > 1 ? 's' : ''} · ${currency(totalExpected)} expected`}>
      {futurePending.length === 0 ? (
        <div style={{
          fontFamily: T.serif, fontSize: 17, fontWeight: 600,
          color: T.forestDeep,
        }}>No pending future bookings.</div>
      ) : (
        <>
          <div style={{
            fontFamily: T.serif, fontSize: 17, fontWeight: 600,
            color: T.forestDeep, lineHeight: 1.3, marginBottom: 10,
          }}>Future sessions with payment expected.</div>
          {futurePending.slice(0, 8).map(s => (
            <DeepDiveRow
              key={s.id}
              label={s.client}
              sub={`${s.service || `${s.duration || 60}-min`} · ${fmtShort(s.date)}`}
              value={currency(s.rate)} />
          ))}
          <DeepDiveNote>
            Once a deposit feature is built, this card will separate deposits collected at booking from balances due at session.
          </DeepDiveNote>
        </>
      )}
    </DeepDiveCard>
  );
}

// 6. Gift certificates & packages.
function PackagesDeepDive({ sessions }) {
  // Not yet in the data model.
  return (
    <DeepDiveCard
      icon="🎟"
      title="Gift certificates & packages"
      sub="Sold but not yet redeemed">
      <div style={{
        fontFamily: T.serif, fontSize: 17, fontWeight: 600,
        color: T.forestDeep, lineHeight: 1.3, marginBottom: 10,
      }}>Coming soon.</div>
      <DeepDiveNote>
        Gift certificates and session packages are tracked separately because they represent sessions you've been paid for but haven't yet given. This card will show outstanding liability and expirations once the feature ships.
      </DeepDiveNote>
    </DeepDiveCard>
  );
}

// 7. Refund rate.
function RefundRateDeepDive({ sessions }) {
  const paidPaymentSessions = sessions.filter(s =>
    (s.status === 'paid' || s.status === 'refunded') &&
    s.source === 'payment'
  );
  const refunds = paidPaymentSessions.filter(s => s.status === 'refunded' || s.source === 'refund');
  // Also include refund-shape rows
  const refundRows = sessions.filter(s => s.source === 'refund').length;
  const totalSessions = paidPaymentSessions.length + refundRows;
  const refundCount = Math.max(refunds.length, refundRows);
  const pct = totalSessions > 0 ? ((refundCount / totalSessions) * 100).toFixed(1) : '0.0';

  return (
    <DeepDiveCard
      icon="↩"
      title="Refund rate"
      sub={totalSessions === 0
        ? 'No paid sessions yet'
        : `${pct}% of paid sessions refunded`}>
      {totalSessions === 0 ? (
        <div style={{
          fontFamily: T.serif, fontSize: 17, fontWeight: 600,
          color: T.forestDeep,
        }}>No paid sessions yet.</div>
      ) : (
        <>
          <div style={{
            fontFamily: T.serif, fontSize: 17, fontWeight: 600,
            color: T.forestDeep, lineHeight: 1.3, marginBottom: 10,
          }}>
            You refund <span style={{ color: T.sage, fontWeight: 700 }}>{pct}%</span> of paid sessions.
          </div>
          <DeepDiveRow
            label="Your refund count"
            sub={`${refundCount} of ${totalSessions} paid sessions`}
            value={`${pct}%`} />
          <DeepDiveNote>
            Industry data on refund rates for solo LMT practice is not publicly available. We'll add peer comparisons once we have aggregate data from enough MyBodyMap therapists.
          </DeepDiveNote>
        </>
      )}
    </DeepDiveCard>
  );
}

// ─── WeeklyView V2 ─────────────────────────────────────────────────
//
// Same 6 bands as DailyView, scaled to a week. Period boundary is
// Monday->Sunday. Comparison is against the prior week.
function WeeklyView({ sessions, therapist, onRefundClick }) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Monday of the selected week.
  const getMonday = (d) => {
    const x = new Date(d);
    const day = x.getDay();
    x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const weekStart = addDays(getMonday(TODAY), weekOffset * 7);
  const weekEndExcl = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);

  // Slice for this week and previous week.
  const weekSessions = sessions.filter(s => s.date >= weekStart && s.date < weekEndExcl);
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekSessions = sessions.filter(s => s.date >= prevWeekStart && s.date < weekStart);

  const collected = sumCollected(weekSessions);
  const prevCollected = sumCollected(prevWeekSessions);

  const methods = buildMethodBreakdown(weekSessions);
  const tips = buildTipMetrics(weekSessions);

  // Attention items for the week.
  const attention = buildWeeklyAttention(weekSessions);

  // Shape: 7 days Mon-Sun, today highlighted if in this week.
  const shapeBars = buildWeeklyShapeBars(weekSessions, weekStart);
  const paceLine = buildWeeklyPaceLine(weekStart, collected, prevCollected);

  // Period chips: last 4 weeks ending with the selected week.
  const chips = buildWeeklyChips(sessions, weekOffset);

  // Sessions grouped by day for Band 6.
  const sessionsByDay = groupByDay(weekSessions);

  // Period label.
  let periodLabel = 'this week';
  if (weekOffset === -1) periodLabel = 'last week';
  else if (weekOffset === 1) periodLabel = 'next week';
  else if (weekOffset !== 0) periodLabel = `week of ${fmtShort(weekStart)}`;

  const headerSub = `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`;

  return (
    <div>
      <HeroNumber
        label={`Collected ${periodLabel}`}
        amount={collected}
        prevAmount={weekOffset === 0 ? prevCollected : null}
      />
      <ShapeChart
        title={`${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}'s shape`}
        bars={shapeBars}
        paceLine={paceLine}
      />
      {attention.length > 0 && <AttentionBand items={attention} />}
      <BreakdownRow methods={methods} tips={tips} />
      <OtherMoneyCollapsible sessions={weekSessions} periodLabel={periodLabel} />
      <PeriodChips
        chips={chips}
        onPick={c => setWeekOffset(c.weekOffset)}
      />
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500,
        marginBottom: 10, paddingLeft: 4,
      }}>{headerSub}, by day</div>
      {sessionsByDay.length === 0 ? (
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: 32,
          textAlign: 'center', color: T.gray400, fontSize: 14, marginBottom: 16,
          boxShadow: T.shadowSoft,
        }}>No sessions this week.</div>
      ) : (
        sessionsByDay.map(group => (
          <DayGroupCard key={group.date.toISOString()} group={group} onRefundClick={onRefundClick} />
        ))
      )}
      <DeepDiveSection sessions={sessions} periodLabel={periodLabel} therapist={therapist} />
    </div>
  );
}

// Build weekly shape: 7 bars Mon-Sun, value = collected per day.
function buildWeeklyShapeBars(weekSessions, weekStart) {
  const bars = [];
  const dayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const dayCollected = sumCollected(weekSessions.filter(s => sameDay(s.date, d)));
    const isToday = sameDay(d, TODAY);
    const isFuture = d > TODAY;
    bars.push({
      value: dayCollected,
      label: dayLabels[i],
      kind: isToday ? 'today' : isFuture ? 'future' : 'past',
    });
  }
  return bars;
}

// Pace line for weekly: name the best day so far, or week-over-week.
function buildWeeklyPaceLine(weekStart, collected, prevCollected) {
  // If this is the current week, show pace to-match-last-week.
  // If past week, show vs prior week comparison.
  // If future, show nothing.
  const isCurrentWeek = sameDay(getMondayOf(TODAY), weekStart);
  const isFutureWeek = weekStart > TODAY;
  if (isFutureWeek) return null;
  if (isCurrentWeek && prevCollected > 0) {
    const gap = prevCollected - collected;
    if (gap <= 0) {
      return (
        <span>
          You've already beaten last week's <strong style={{ color: T.forestDeep }}>{currency(prevCollected)}</strong>.
        </span>
      );
    }
    return (
      <span>
        Week-to-date: <strong style={{ color: T.forestDeep }}>{currency(collected)}</strong>. Last week finished at {currency(prevCollected)}.
      </span>
    );
  }
  return null;
}

function getMondayOf(d) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
}

// Attention items for weekly: outstanding sessions in the week, refunds,
// no-shows, recurring gaps that show up in this week's data.
function buildWeeklyAttention(weekSessions) {
  const items = [];
  const outstanding = weekSessions.filter(s => s.status === 'outstanding' || s.status === 'pending');
  if (outstanding.length > 0) {
    const totalOwed = outstanding.reduce((s, x) => s + (x.rate || 0), 0);
    const firstFew = outstanding.slice(0, 2).map(s => s.client).join(', ');
    const more = outstanding.length > 2 ? `, +${outstanding.length - 2} more` : '';
    items.push({
      icon: '⏳', iconBg: T.amberBg, iconColor: T.amber,
      title: `${outstanding.length} unpaid session${outstanding.length > 1 ? 's' : ''} this week`,
      sub: `${firstFew}${more} · ${currency(totalOwed)} expected`,
      action: 'View',
    });
  }
  const refunds = weekSessions.filter(s => s.source === 'refund');
  if (refunds.length > 0) {
    const total = refunds.reduce((s, x) => s + (x.actual || 0), 0);
    items.push({
      icon: '↩', iconBg: T.redBg, iconColor: T.redText,
      title: `${currency(total)} refunded this week`,
      sub: `${refunds.length} refund${refunds.length > 1 ? 's' : ''}`,
      action: 'View',
    });
  }
  const noShows = weekSessions.filter(s => s.status === 'no_show');
  if (noShows.length > 0) {
    items.push({
      icon: '○', iconBg: T.amberBg, iconColor: T.amber,
      title: `${noShows.length} no-show${noShows.length > 1 ? 's' : ''} this week`,
      sub: noShows.slice(0, 3).map(n => n.client).join(', '),
      action: 'View',
    });
  }
  return items;
}

// Weekly period chips: 4 weeks ending at selected.
function buildWeeklyChips(allSessions, selectedOffset) {
  const chips = [];
  const getMonday = (d) => {
    const x = new Date(d);
    const day = x.getDay();
    x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
    x.setHours(0, 0, 0, 0);
    return x;
  };
  for (let i = -3; i <= 0; i++) {
    const offset = selectedOffset + i;
    const wkStart = addDays(getMonday(TODAY), offset * 7);
    const wkEndExcl = addDays(wkStart, 7);
    const wkSessions = allSessions.filter(s => s.date >= wkStart && s.date < wkEndExcl);
    const collected = sumCollected(wkSessions);
    const count = wkSessions.filter(s =>
      s.source !== 'cancellation_fee' && s.source !== 'refund' && s.status !== 'no_show'
    ).length;
    let label;
    if (offset === 0) label = 'This wk';
    else if (offset === -1) label = 'Last wk';
    else label = wkStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    chips.push({
      label, value: currency(collected),
      meta: `${count} sess`,
      active: offset === selectedOffset,
      weekOffset: offset,
    });
  }
  return chips;
}

// Group sessions by day, return array sorted descending (most recent first).
function groupByDay(sessions) {
  const map = new Map();
  sessions
    .filter(s => s.source !== 'cancellation_fee')
    .forEach(s => {
      const key = s.date.toDateString();
      if (!map.has(key)) map.set(key, { date: s.date, items: [] });
      map.get(key).items.push(s);
    });
  const groups = Array.from(map.values()).sort((a, b) => b.date - a.date);
  // Sort items within each group by time of day.
  groups.forEach(g => {
    g.items.sort((a, b) => {
      const ta = (a.time || '00:00').replace(/[^0-9:apmAPM\s]/g, '');
      const tb = (b.time || '00:00').replace(/[^0-9:apmAPM\s]/g, '');
      return ta.localeCompare(tb);
    });
  });
  return groups;
}

// Day group card: compact card showing day total + collapsible session list.
function DayGroupCard({ group, onRefundClick }) {
  const [open, setOpen] = useState(false);
  const dayCollected = sumCollected(group.items);
  const dayRefunds = sumRefunds(group.items);
  const dayPending = group.items
    .filter(s => s.status === 'pending' || s.status === 'outstanding')
    .reduce((sum, s) => sum + (s.rate || 0), 0);
  const sessionCount = group.items.filter(s => s.status !== 'no_show').length;
  const dayLabel = sameDay(group.date, TODAY) ? 'Today'
    : sameDay(group.date, addDays(TODAY, -1)) ? 'Yesterday'
    : group.date.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 14,
      marginBottom: 12, boxShadow: T.shadowSoft, overflow: 'hidden',
      border: `1px solid ${open ? T.sageSoft : 'transparent'}`,
      transition: 'border-color 0.2s ease',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '14px 16px', cursor: 'pointer',
        background: 'transparent', border: 'none', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{
              fontFamily: T.serif, fontSize: 18, fontWeight: 600,
              color: T.forestDeep, lineHeight: 1.1,
            }}>{dayLabel}</div>
            <div style={{ fontSize: 12, color: T.gray500, fontWeight: 600 }}>
              {sessionCount} session{sessionCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, color: T.gray700, flexWrap: 'wrap' }}>
            <span><strong style={{ color: T.forestDeep, fontWeight: 700 }}>{currency(dayCollected)}</strong> collected</span>
            {dayRefunds > 0 && (
              <span style={{ color: T.rose }}>−{currency(dayRefunds)} refunded</span>
            )}
            {dayPending > 0 && (
              <span style={{ color: T.amber }}>{currency(dayPending)} pending</span>
            )}
          </div>
        </div>
        <ChevronPill open={open} />
      </button>
      {open && (
        <div style={{
          borderTop: `1px solid ${T.creamDeep}`,
          padding: '8px 12px 12px',
        }}>
          {group.items.map(s => (
            <ReceiptCard key={s.id} session={s} onRefundClick={onRefundClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MonthlyView V2 ────────────────────────────────────────────────
//
// Same 6 bands, scaled to a calendar month. Period boundary is 1st to
// last day of the month. Comparison vs prior month (same period).
function MonthlyView({ sessions, therapist, onRefundClick }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  viewMonth.setHours(0, 0, 0, 0);
  const monthStart = viewMonth;
  const monthEndExcl = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  // Slice for this month.
  const monthSessions = sessions.filter(s => s.date >= monthStart && s.date < monthEndExcl);
  // Comparison: prior month, same N days elapsed (so May-to-date compares to April-1-through-N).
  const prevMonthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  prevMonthStart.setHours(0, 0, 0, 0);
  const isCurrentMonth = monthOffset === 0;
  const dayOfMonth = isCurrentMonth ? TODAY.getDate() : daysInMonth;
  const prevMonthCompareEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), Math.min(dayOfMonth, daysInMonth) + 1);
  const prevMonthSessions = sessions.filter(s => s.date >= prevMonthStart && s.date < prevMonthCompareEnd);

  const collected = sumCollected(monthSessions);
  const prevCollected = sumCollected(prevMonthSessions);

  const methods = buildMethodBreakdown(monthSessions);
  const tips = buildTipMetrics(monthSessions);

  // Attention items.
  const attention = buildMonthlyAttention(monthSessions);

  // Shape: N day bars (one per day of the month).
  const shapeBars = buildMonthlyShapeBars(monthSessions, viewMonth, daysInMonth);
  const paceLine = buildMonthlyPaceLine(monthSessions, viewMonth, daysInMonth, prevCollected, collected);

  // Period chips: 4 months ending at selected.
  const chips = buildMonthlyChips(sessions, monthOffset);

  // Sessions grouped by week within the month.
  const sessionsByWeek = groupByWeek(monthSessions, viewMonth);

  const monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  let periodLabel = monthName.toLowerCase().replace(/\s\d+/, ''); // "may"
  if (isCurrentMonth) periodLabel = `${periodLabel} so far`;

  return (
    <div>
      <HeroNumber
        label={`Collected in ${monthName.split(' ')[0]}`}
        amount={collected}
        prevAmount={prevCollected > 0 ? prevCollected : null}
      />
      <ShapeChart
        title={`${monthName.split(' ')[0]} income pattern`}
        bars={shapeBars}
        paceLine={paceLine}
      />
      {attention.length > 0 && <AttentionBand items={attention} />}
      <BreakdownRow methods={methods} tips={tips} />
      <OtherMoneyCollapsible sessions={monthSessions} periodLabel={`in ${monthName.split(' ')[0]}`} />
      <PeriodChips
        chips={chips}
        onPick={c => setMonthOffset(c.monthOffset)}
      />
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500,
        marginBottom: 10, paddingLeft: 4,
      }}>{monthName}, by week</div>
      {sessionsByWeek.length === 0 ? (
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: 32,
          textAlign: 'center', color: T.gray400, fontSize: 14, marginBottom: 16,
          boxShadow: T.shadowSoft,
        }}>No sessions this month.</div>
      ) : (
        sessionsByWeek.map(group => (
          <WeekGroupCard key={group.weekStart.toISOString()} group={group} onRefundClick={onRefundClick} />
        ))
      )}
      <DeepDiveSection sessions={sessions} periodLabel={periodLabel} therapist={therapist} />
    </div>
  );
}

// Monthly shape bars: one per day of the month.
function buildMonthlyShapeBars(monthSessions, monthStart, daysInMonth) {
  const bars = [];
  const todayDate = sameDay(new Date(monthStart.getFullYear(), monthStart.getMonth(), 1), new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
    ? TODAY.getDate() : -1;
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), i);
    d.setHours(0, 0, 0, 0);
    const collected = sumCollected(monthSessions.filter(s => sameDay(s.date, d)));
    const isToday = i === todayDate;
    const isFuture = d > TODAY;
    bars.push({
      value: collected,
      label: i === 1 || i === daysInMonth || i === todayDate ? String(i) : '',
      kind: isToday ? 'today' : isFuture ? 'future' : 'past',
    });
  }
  return bars;
}

function buildMonthlyPaceLine(monthSessions, monthStart, daysInMonth, prevCollected, collected) {
  const isCurrentMonth = monthStart.getFullYear() === TODAY.getFullYear() && monthStart.getMonth() === TODAY.getMonth();
  if (!isCurrentMonth) return null;
  const dayOfMonth = TODAY.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  if (daysRemaining <= 0) return null;
  const pace = collected / dayOfMonth;
  const projected = Math.round(pace * daysInMonth);
  return (
    <span>
      {daysRemaining} day{daysRemaining > 1 ? 's' : ''} left. Your pace projects to <strong style={{ color: T.forestDeep }}>{currency(projected)}</strong>{prevCollected > 0 ? `, vs ${currency(prevCollected)} for the prior month.` : '.'}
    </span>
  );
}

function buildMonthlyAttention(monthSessions) {
  const items = [];
  const outstanding = monthSessions.filter(s => s.status === 'outstanding');
  if (outstanding.length > 0) {
    const totalOwed = outstanding.reduce((s, x) => s + (x.rate || 0), 0);
    // Oldest age.
    const ages = outstanding.map(s => Math.floor((TODAY - s.date) / (1000 * 60 * 60 * 24)));
    const oldest = Math.max(...ages);
    items.push({
      icon: '⏳', iconBg: T.amberBg, iconColor: T.amber,
      title: `${currency(totalOwed)} outstanding this month`,
      sub: `${outstanding.length} client${outstanding.length > 1 ? 's' : ''} · oldest ${oldest} day${oldest !== 1 ? 's' : ''}`,
      action: 'View',
    });
  }
  const refunds = monthSessions.filter(s => s.source === 'refund');
  if (refunds.length > 0) {
    const total = refunds.reduce((s, x) => s + (x.actual || 0), 0);
    items.push({
      icon: '↩', iconBg: T.redBg, iconColor: T.redText,
      title: `${currency(total)} refunded this month`,
      sub: `${refunds.length} refund${refunds.length > 1 ? 's' : ''}`,
      action: 'View',
    });
  }
  return items;
}

function buildMonthlyChips(allSessions, selectedOffset) {
  const chips = [];
  const now = new Date();
  for (let i = -3; i <= 0; i++) {
    const offset = selectedOffset + i;
    const mStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    mStart.setHours(0, 0, 0, 0);
    const mEndExcl = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
    const mSessions = allSessions.filter(s => s.date >= mStart && s.date < mEndExcl);
    const collected = sumCollected(mSessions);
    const count = mSessions.filter(s =>
      s.source !== 'cancellation_fee' && s.source !== 'refund' && s.status !== 'no_show'
    ).length;
    const label = mStart.toLocaleDateString('en-US', { month: 'short' });
    chips.push({
      label, value: currency(collected),
      meta: `${count} sess`,
      active: offset === selectedOffset,
      monthOffset: offset,
    });
  }
  return chips;
}

// Group sessions by week of the month, return sorted descending.
function groupByWeek(monthSessions, monthStart) {
  const map = new Map();
  monthSessions
    .filter(s => s.source !== 'cancellation_fee')
    .forEach(s => {
      const weekStart = getMondayOf(s.date);
      const key = weekStart.toISOString();
      if (!map.has(key)) map.set(key, { weekStart, items: [] });
      map.get(key).items.push(s);
    });
  return Array.from(map.values()).sort((a, b) => b.weekStart - a.weekStart);
}

// Week group card: shows week summary + tap to expand to receipt cards.
function WeekGroupCard({ group, onRefundClick }) {
  const [open, setOpen] = useState(false);
  const collected = sumCollected(group.items);
  const tips = group.items.reduce((s, x) =>
    s + (x.status === 'paid' && x.source !== 'cancellation_fee' && x.source !== 'refund' ? (x.tip || 0) : 0), 0);
  const refunds = sumRefunds(group.items);
  const outstanding = group.items
    .filter(s => s.status === 'outstanding')
    .reduce((s, x) => s + (x.rate || 0), 0);
  const sessionCount = group.items.filter(s => s.status === 'paid' && s.source === 'payment').length;
  const weekEnd = addDays(group.weekStart, 6);
  const label = `Week of ${group.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const dateRange = `${group.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const netForWeek = collected - refunds;

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 14,
      marginBottom: 12, boxShadow: T.shadowSoft, overflow: 'hidden',
      border: `1px solid ${open ? T.sageSoft : 'transparent'}`,
      transition: 'border-color 0.2s ease',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '14px 16px', cursor: 'pointer',
        background: 'transparent', border: 'none', textAlign: 'left',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{
              fontFamily: T.serif, fontSize: 18, fontWeight: 600,
              color: T.forestDeep, lineHeight: 1.1,
            }}>{label}</div>
            <div style={{ fontSize: 12, color: T.gray500, fontWeight: 600 }}>
              {sessionCount} session{sessionCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ borderTop: `1px dashed ${T.gray300}`, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.gray700, padding: '2px 0' }}>
              <span>Sessions collected</span><span>{currency(collected)}</span>
            </div>
            {tips > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.gray700, padding: '2px 0' }}>
                <span>Tips</span><span>{currency(tips)}</span>
              </div>
            )}
            {refunds > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.redText, padding: '2px 0' }}>
                <span>Refunds</span><span>-{currency(refunds)}</span>
              </div>
            )}
            {outstanding > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.amber, padding: '2px 0' }}>
                <span>Outstanding</span><span>{currency(outstanding)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 14, fontWeight: 700, color: T.forestDeep,
              borderTop: `1px solid ${T.gray300}`, marginTop: 6, paddingTop: 6,
            }}>
              <span>Net for week</span><span>{currency(netForWeek)}</span>
            </div>
          </div>
        </div>
        <ChevronPill open={open} />
      </button>
      {open && (
        <div style={{
          borderTop: `1px solid ${T.creamDeep}`,
          padding: '8px 12px 12px',
        }}>
          {group.items
            .sort((a, b) => a.date - b.date)
            .map(s => <ReceiptCard key={s.id} session={s} onRefundClick={onRefundClick} />)}
        </div>
      )}
    </div>
  );
}

// ─── YearlyView V2 ─────────────────────────────────────────────────
//
// Yearly differs from other periods:
//   Hero has gross/refunds/net/processing breakdown below big number
//   Band 3 becomes "Tax prep" (export, 1099-K, deductibles)
//   Shape is 12 monthly bars + seasonality note
//   Band 6 groups by month
//   Period chips are years
//
// Per BENCHMARKS.md, Stripe processing fees are 2.9% + $0.30 per
// card transaction. We compute the year-end estimate from the
// stripe_card_on_file and stripe_card_new payments.
function YearlyView({ sessions, therapist, onRefundClick }) {
  const [yearOffset, setYearOffset] = useState(0);

  const now = new Date();
  const year = now.getFullYear() + yearOffset;
  const yearStart = new Date(year, 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const yearEndExcl = new Date(year + 1, 0, 1);

  const yearSessions = sessions.filter(s => s.date >= yearStart && s.date < yearEndExcl);

  // Comparison: prior year, same N months elapsed if current year, else full.
  const isCurrentYear = yearOffset === 0;
  const prevYearStart = new Date(year - 1, 0, 1);
  prevYearStart.setHours(0, 0, 0, 0);
  const prevYearEnd = isCurrentYear
    ? new Date(year - 1, now.getMonth(), now.getDate() + 1)
    : new Date(year, 0, 1);
  const prevYearSessions = sessions.filter(s => s.date >= prevYearStart && s.date < prevYearEnd);

  // Gross, refunds, net, processing computation.
  const gross = sumCollected(yearSessions);
  const refunds = sumRefunds(yearSessions);
  const net = gross - refunds;
  const processingFees = estimateProcessingFees(yearSessions);
  const prevGross = sumCollected(prevYearSessions);

  // Hero breakdown: gross / refunds / net / processing in two rows of 3.
  // Built as separate rows below the big number for visual clarity.
  const heroBreakdown = [
    { label: 'Gross', value: currency(gross) },
    { divider: '−' },
    { label: 'Refunds', value: currency(refunds), minus: true },
  ];
  const heroBreakdown2 = [
    { label: 'Net', value: currency(net) },
    { divider: '−' },
    { label: 'Processing', value: currency(processingFees), minus: true },
  ];

  const methods = buildMethodBreakdown(yearSessions);
  const tips = buildTipMetrics(yearSessions);

  // Tax-prep band (replaces Attention).
  const taxPrep = buildTaxPrepBand(yearSessions, tips, refunds);

  // Shape: 12 monthly bars.
  const shapeBars = buildYearlyShapeBars(yearSessions, year);
  const paceLine = buildYearlyPaceLine(year);

  // Year selector chips.
  const chips = buildYearlyChips(sessions, yearOffset, now.getFullYear());

  // Sessions grouped by month.
  const sessionsByMonth = groupByMonth(yearSessions, year);

  const yearLabel = isCurrentYear ? `${year} year to date` : `${year}`;
  const heroLabel = isCurrentYear ? `Gross collected in ${year}` : `Collected in ${year}`;

  return (
    <div>
      {/* Hero with gross/refunds/net/processing breakdown */}
      <YearlyHero
        label={heroLabel}
        amount={gross}
        prevAmount={prevGross > 0 ? prevGross : null}
        breakdown1={heroBreakdown}
        breakdown2={heroBreakdown2}
      />
      <ShapeChart
        title={`${year} seasonality`}
        bars={shapeBars}
        paceLine={paceLine}
      />
      {taxPrep.length > 0 && <AttentionBand items={taxPrep} />}
      <BreakdownRow methods={methods} tips={tips} />
      <OtherMoneyCollapsible sessions={yearSessions} periodLabel={`in ${year}`} />
      <PeriodChips
        chips={chips}
        onPick={c => setYearOffset(c.yearOffset)}
      />
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500,
        marginBottom: 10, paddingLeft: 4,
      }}>{year}, by month</div>
      {sessionsByMonth.length === 0 ? (
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: 32,
          textAlign: 'center', color: T.gray400, fontSize: 14, marginBottom: 16,
          boxShadow: T.shadowSoft,
        }}>No sessions this year.</div>
      ) : (
        sessionsByMonth.map(group => (
          <MonthGroupCard key={group.monthIndex} group={group} onRefundClick={onRefundClick} />
        ))
      )}
      <DeepDiveSection sessions={sessions} periodLabel={yearLabel} therapist={therapist} />
    </div>
  );
}

// YearlyHero is slightly different from HeroNumber: it has two
// breakdown rows (gross/refunds and net/processing).
function YearlyHero({ label, amount, prevAmount, breakdown1, breakdown2 }) {
  const delta = (amount || 0) - (prevAmount || 0);
  const hasComparison = prevAmount !== null && prevAmount !== undefined;
  const deltaPct = prevAmount > 0 ? Math.round((delta / prevAmount) * 100) : null;

  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.cream} 0%, #FBF7EC 50%, ${T.creamDeep} 100%)`,
      borderRadius: 22,
      padding: '22px 24px 20px',
      marginBottom: 16,
      position: 'relative',
      border: `1px solid ${T.creamEdge}`,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: -40, right: -30,
        width: 130, height: 130,
        background: 'radial-gradient(circle, rgba(107, 158, 128, 0.18) 0%, transparent 65%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500, marginBottom: 8,
        position: 'relative',
      }}>{label}</div>
      <div style={{
        fontFamily: T.serif, fontSize: 56, fontWeight: 600,
        color: T.forestDeep, lineHeight: 1, letterSpacing: '-0.02em',
        marginBottom: 10, display: 'flex', alignItems: 'baseline',
        position: 'relative',
      }}>
        <span style={{ fontSize: 28, fontWeight: 500, color: T.forest, marginRight: 2, alignSelf: 'flex-start', marginTop: 8 }}>$</span>
        <span>{Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
      </div>
      {hasComparison && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.gray700, position: 'relative' }}>
          {delta >= 0 ? (
            <span style={{ color: T.sage, fontWeight: 700 }}>↑ {currency(delta)}</span>
          ) : (
            <span style={{ color: T.rose, fontWeight: 700 }}>↓ {currency(delta)}</span>
          )}
          {deltaPct !== null && (
            <span style={{ color: T.gray500 }}>
              ({delta >= 0 ? '+' : ''}{deltaPct}%) vs prior year same period
            </span>
          )}
        </div>
      )}
      {/* Two breakdown rows */}
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: `1px dashed ${T.creamEdge}`,
        position: 'relative',
      }}>
        <NetBreakdownRow cells={breakdown1} />
        <div style={{ marginTop: 8 }}>
          <NetBreakdownRow cells={breakdown2} />
        </div>
      </div>
    </div>
  );
}

// Estimate processing fees based on Stripe's 2.9% + $0.30 per transaction.
// Only applies to stripe_* payment methods. Source: BENCHMARKS.md.
function estimateProcessingFees(sessions) {
  let total = 0;
  sessions.forEach(s => {
    if (s.status === 'paid' && s.method && s.method.startsWith('stripe_')) {
      const amount = (s.base != null ? s.base : (s.actual || 0)) + (s.tip || 0);
      if (amount > 0) {
        total += (amount * 0.029) + 0.30;
      }
    }
  });
  return total;
}

// Tax prep band: export prompt, tips total, refunds deductible.
function buildTaxPrepBand(yearSessions, tipMetrics, refundsTotal) {
  const items = [];
  items.push({
    icon: '📋', iconBg: T.creamDeep, iconColor: T.forest,
    title: 'Year-end summary preview',
    sub: 'Ready for tax filing materials',
    action: 'Open',
  });
  if (tipMetrics.dollars > 0) {
    items.push({
      icon: '📊', iconBg: T.creamDeep, iconColor: T.forest,
      title: `${currency(tipMetrics.dollars)} in tips this year`,
      sub: 'Tracked for 1099-K reporting',
      action: 'Detail',
    });
  }
  if (refundsTotal > 0) {
    items.push({
      icon: '↩', iconBg: T.redBg, iconColor: T.redText,
      title: `${currency(refundsTotal)} refunded this year`,
      sub: 'Deductible from gross revenue',
      action: 'View',
    });
  }
  return items;
}

// 12 monthly bars for shape chart.
function buildYearlyShapeBars(yearSessions, year) {
  const bars = [];
  const monthLabels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEndExcl = new Date(year, m + 1, 1);
    const monthSessions = yearSessions.filter(s => s.date >= monthStart && s.date < monthEndExcl);
    const collected = sumCollected(monthSessions);
    const isCurrent = TODAY.getFullYear() === year && TODAY.getMonth() === m;
    const isFuture = monthStart > TODAY;
    bars.push({
      value: collected,
      label: monthLabels[m],
      kind: isCurrent ? 'today' : isFuture ? 'future' : 'past',
    });
  }
  return bars;
}

function buildYearlyPaceLine(year) {
  // Hard to know seasonality from data with only ~6 months. Show a
  // calm note for the current year, nothing for past years.
  const isCurrentYear = year === TODAY.getFullYear();
  if (!isCurrentYear) return null;
  const month = TODAY.getMonth();
  if (month < 3) {
    return <span>Most solo LMTs see Q1 build slowly. March tends to be a strong month.</span>;
  }
  if (month >= 10) {
    return <span>December typically slows 15-20% below average. Plan accordingly.</span>;
  }
  return null;
}

function buildYearlyChips(allSessions, selectedOffset, currentYear) {
  const chips = [];
  for (let i = -3; i <= 0; i++) {
    const offset = selectedOffset + i;
    const year = currentYear + offset;
    const yStart = new Date(year, 0, 1);
    yStart.setHours(0, 0, 0, 0);
    const yEndExcl = new Date(year + 1, 0, 1);
    const ySessions = allSessions.filter(s => s.date >= yStart && s.date < yEndExcl);
    const collected = sumCollected(ySessions);
    const count = ySessions.filter(s =>
      s.source !== 'cancellation_fee' && s.source !== 'refund' && s.status !== 'no_show'
    ).length;
    const isFutureOrCurrent = year >= currentYear;
    const isCurrent = year === currentYear;
    chips.push({
      label: String(year),
      value: collected >= 1000 ? `$${(collected / 1000).toFixed(0)}k` : currency(collected),
      meta: isCurrent ? 'YTD' : `${count} sess`,
      active: offset === selectedOffset,
      yearOffset: offset,
    });
  }
  return chips;
}

// Group sessions by month within a year, return desc.
function groupByMonth(yearSessions, year) {
  const map = new Map();
  yearSessions
    .filter(s => s.source !== 'cancellation_fee')
    .forEach(s => {
      const monthIndex = s.date.getMonth();
      if (!map.has(monthIndex)) {
        map.set(monthIndex, { monthIndex, year, items: [] });
      }
      map.get(monthIndex).items.push(s);
    });
  return Array.from(map.values()).sort((a, b) => b.monthIndex - a.monthIndex);
}

// Month group card: shows the month summary + tap to expand to sessions.
function MonthGroupCard({ group, onRefundClick }) {
  const [open, setOpen] = useState(false);
  const collected = sumCollected(group.items);
  const tips = group.items.reduce((s, x) =>
    s + (x.status === 'paid' && x.source !== 'cancellation_fee' && x.source !== 'refund' ? (x.tip || 0) : 0), 0);
  const refunds = sumRefunds(group.items);
  const sessionCount = group.items.filter(s => s.status === 'paid' && s.source === 'payment').length;
  const monthName = new Date(group.year, group.monthIndex, 1)
    .toLocaleDateString('en-US', { month: 'long' });
  const isCurrentMonth = TODAY.getFullYear() === group.year && TODAY.getMonth() === group.monthIndex;
  const label = isCurrentMonth ? `${monthName} (so far)` : monthName;
  const net = collected - refunds;

  // Mark "best month" if this is the highest collected.
  // Caller responsibility, but we don't know context. Skip for now.

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 14,
      marginBottom: 12, boxShadow: T.shadowSoft, overflow: 'hidden',
      border: `1px solid ${open ? T.sageSoft : 'transparent'}`,
      transition: 'border-color 0.2s ease',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '14px 16px', cursor: 'pointer',
        background: 'transparent', border: 'none', textAlign: 'left',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{
              fontFamily: T.serif, fontSize: 18, fontWeight: 600,
              color: T.forestDeep, lineHeight: 1.1,
            }}>{label}</div>
            <div style={{ fontSize: 12, color: T.gray500, fontWeight: 600 }}>
              {sessionCount} session{sessionCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ borderTop: `1px dashed ${T.gray300}`, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.gray700, padding: '2px 0' }}>
              <span>Sessions collected</span><span>{currency(collected)}</span>
            </div>
            {tips > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.gray700, padding: '2px 0' }}>
                <span>Tips</span><span>{currency(tips)}</span>
              </div>
            )}
            {refunds > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.redText, padding: '2px 0' }}>
                <span>Refunds</span><span>-{currency(refunds)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 14, fontWeight: 700, color: T.forestDeep,
              borderTop: `1px solid ${T.gray300}`, marginTop: 6, paddingTop: 6,
            }}>
              <span>Net for {monthName}</span><span>{currency(net)}</span>
            </div>
          </div>
        </div>
        <ChevronPill open={open} />
      </button>
      {open && (
        <div style={{
          borderTop: `1px solid ${T.creamDeep}`,
          padding: '8px 12px 12px',
        }}>
          {group.items
            .sort((a, b) => b.date - a.date)
            .map(s => <ReceiptCard key={s.id} session={s} onRefundClick={onRefundClick} />)}
        </div>
      )}
    </div>
  );
}

// ─── InsightsView V2 ───────────────────────────────────────────────
//
// 9 peer-toned cards showing patterns in the therapist's practice.
// Per BENCHMARKS.md: peer comparison line shown only where we have
// real industry data (with citation in the footer). Where we don't,
// show therapist's own data and skip the comparison.
//
// Refresh cadence (UI implication only): "Refreshes every Monday"
// language since the underlying data is updated continuously.
//
// 4 accent colors used: sage (positive patterns), forest (calm
// observations), gold (financial context), rose (notable callouts).
function InsightsView({ sessions, therapist }) {
  // Compute everything once for the year.
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const last90Start = addDays(TODAY, -90);
  const last90Sessions = sessions.filter(s => s.date >= last90Start && s.date <= TODAY);
  const yearSessions = sessions.filter(s => s.date >= yearStart && s.date <= TODAY);

  return (
    <div>
      <InsightsIntro />
      <TipsInsight sessions={last90Sessions} />
      <NoShowRateInsight sessions={last90Sessions} />
      <AvgSessionValueInsight sessions={last90Sessions} therapist={therapist} />
      <SessionLengthMixInsight sessions={last90Sessions} />
      <StrongestMonthInsight sessions={yearSessions} />
      <DayOfWeekInsight sessions={last90Sessions} />
      <EffectiveHourlyInsight sessions={last90Sessions} />
      <SeasonalityInsight sessions={sessions} />
      <ClientRetentionInsight sessions={sessions} />
    </div>
  );
}

function InsightsIntro() {
  const now = new Date();
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return (
    <div style={{
      background: `linear-gradient(140deg, #FBF7EC 0%, ${T.cream} 50%, ${T.creamDeep} 110%)`,
      color: T.forestDeep,
      border: `1px solid ${T.creamEdge}`,
      borderRadius: 22,
      padding: '22px 24px 22px',
      marginBottom: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -40, right: -30,
        width: 130, height: 130,
        background: 'radial-gradient(circle, rgba(107, 158, 128, 0.18) 0%, transparent 65%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500, marginBottom: 10,
        position: 'relative',
      }}>{monthYear}  ·  Updated weekly</div>
      <div style={{
        fontFamily: T.serif, fontSize: 24, fontWeight: 600,
        lineHeight: 1.25, letterSpacing: '-0.01em',
        marginBottom: 10, color: T.forestDeep,
        position: 'relative',
      }}>Here's how your practice is shaped.</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: T.gray700, position: 'relative' }}>
        A look at patterns in your data alongside what's typical for solo LMTs nationally. Nothing to compete with. Just useful to know.
      </div>
    </div>
  );
}

// Shared insight card shell. accent picks the top border stripe color.
function InsightCard({ accent, eyebrow, tag = 'Pattern', children }) {
  const borderColor = {
    sage:   T.sage,
    forest: T.forest,
    gold:   T.gold,
    rose:   T.rose,
  }[accent] || T.sage;
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18,
      padding: '20px 22px', marginBottom: 14,
      boxShadow: T.shadowCard,
      borderTop: `3px solid ${borderColor}`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.gray500, marginBottom: 12,
      }}>
        <span>{eyebrow}</span>
        <span style={{
          background: T.creamDeep, padding: '3px 8px',
          borderRadius: 999, color: T.gray500, fontWeight: 600,
          fontSize: 9, letterSpacing: '0.1em',
        }}>{tag}</span>
      </div>
      {children}
    </div>
  );
}

function InsightHeadline({ children }) {
  return (
    <div style={{
      fontFamily: T.serif, fontSize: 21, fontWeight: 600,
      color: T.forestDeep, lineHeight: 1.25,
      marginBottom: 10, letterSpacing: '-0.005em',
    }}>{children}</div>
  );
}

function InsightCompare({ label = 'What this means', children }) {
  return (
    <div style={{
      fontSize: 13, color: T.gray700,
      lineHeight: 1.55, marginBottom: 14,
      paddingBottom: 14,
      borderBottom: `1px solid ${T.creamDeep}`,
    }}>
      <strong style={{ color: T.forestDeep, fontWeight: 700 }}>{label}: </strong>
      {children}
    </div>
  );
}

function InsightFooter({ children }) {
  return (
    <div style={{
      fontSize: 12, color: T.gray400,
      lineHeight: 1.5, fontStyle: 'italic',
    }}>{children}</div>
  );
}

function BenchmarkBar({ valueLeftPct, peerLeftPct, peerLabel = 'national avg' }) {
  return (
    <div style={{
      height: 6, background: T.creamDeep,
      borderRadius: 999, position: 'relative',
      marginTop: 6, marginBottom: 22,
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${valueLeftPct}%`,
        background: `linear-gradient(90deg, ${T.sage} 0%, ${T.forest} 100%)`,
        borderRadius: 999,
      }} />
      <div style={{
        position: 'absolute', top: -3,
        left: `${peerLeftPct}%`,
        width: 2, height: 12,
        background: T.rose, borderRadius: 1,
      }}>
        <div style={{
          position: 'absolute', top: 14,
          left: '50%', transform: 'translateX(-50%)',
          fontSize: 9, fontWeight: 700, color: T.rose,
          letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>{peerLabel}</div>
      </div>
    </div>
  );
}

function InsightStatRow({ stats }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
      {stats.map((s, i) => (
        <div key={i} style={{ flex: 1 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: T.gray400, marginBottom: 4,
          }}>{s.label}</div>
          <div style={{
            fontFamily: T.serif, fontSize: 22, fontWeight: 600,
            color: s.muted ? T.gray400 : T.forestDeep, lineHeight: 1,
          }}>{s.value}</div>
          {s.meta && (
            <div style={{ fontSize: 12, color: T.gray500, marginTop: 4 }}>{s.meta}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Individual insight cards ──────────────────────────────────────

// 1. Tips
function TipsInsight({ sessions }) {
  const tipMetrics = buildTipMetrics(sessions);
  const peerAvg = 18; // BENCHMARKS.md: solo independent national avg
  if (tipMetrics.totalCount < 3) {
    return (
      <InsightCard accent="sage" eyebrow="Tips" tag="Pattern">
        <InsightHeadline>Your tip rate will appear here once you have a few sessions logged.</InsightHeadline>
        <InsightFooter>National baseline for solo independent practice is around 18%. Source: AMTA / Soothe 2024.</InsightFooter>
      </InsightCard>
    );
  }
  const myPct = tipMetrics.pct;
  const accentColor = myPct >= peerAvg ? T.sage : T.gold;
  return (
    <InsightCard accent="sage" eyebrow="Tips" tag="Pattern">
      <InsightHeadline>
        You earn <span style={{ color: accentColor, fontWeight: 700 }}>{myPct}%</span> in tips. Solo LMTs nationally average <span style={{ color: T.rose }}>{peerAvg}%</span>.
      </InsightHeadline>
      <BenchmarkBar
        valueLeftPct={Math.min((myPct / 30) * 100, 100)}
        peerLeftPct={(peerAvg / 30) * 100}
      />
      <InsightCompare>
        Your tip rate is computed across the last 90 days of paid sessions ({tipMetrics.tippedCount} of {tipMetrics.totalCount} sessions tipped). {myPct >= peerAvg
          ? 'Your tip rate runs above the national baseline, often a sign that clients feel the value of the work.'
          : 'A small change to how you mention tipping at checkout often lifts this by 2-4 points.'}
      </InsightCompare>
      <InsightFooter>National benchmark from AMTA 2024 workforce data and Soothe operations report 2025.</InsightFooter>
    </InsightCard>
  );
}

// 2. No-show rate
function NoShowRateInsight({ sessions }) {
  // Count: no_show sessions / total scheduled (paid + no_show + outstanding)
  const noShows = sessions.filter(s => s.status === 'no_show').length;
  const scheduled = sessions.filter(s =>
    s.status === 'no_show' ||
    (s.source === 'payment' && s.status === 'paid') ||
    s.status === 'outstanding'
  ).length;
  if (scheduled < 5) {
    return (
      <InsightCard accent="forest" eyebrow="No-show rate" tag="Pattern">
        <InsightHeadline>Your no-show rate will appear here once you've had a few weeks of scheduling.</InsightHeadline>
        <InsightFooter>With automated reminders, the typical solo LMT no-show rate is around 8%. Source: SchedulingKit 2026 industry research.</InsightFooter>
      </InsightCard>
    );
  }
  const myPct = scheduled > 0 ? Math.round((noShows / scheduled) * 100) : 0;
  const peerAvg = 8; // with reminders, BENCHMARKS.md
  return (
    <InsightCard accent="forest" eyebrow="No-show rate" tag="Pattern">
      <InsightHeadline>
        Your no-shows happen <span style={{ color: myPct <= peerAvg ? T.sage : T.rose, fontWeight: 700 }}>{myPct}%</span> of the time. With reminders, the typical rate is around <span style={{ color: T.rose }}>{peerAvg}%</span>.
      </InsightHeadline>
      <InsightCompare>
        {myPct <= peerAvg
          ? 'Your cancellation policy has found a rhythm with your clients. Below-average no-show rates protect real revenue.'
          : 'A reminder a day before the appointment tends to move this number down. Most no-shows aren\'t deliberate, just forgetful.'}
      </InsightCompare>
      <InsightFooter>Benchmark from SchedulingKit 2026 industry data. Practices without reminders see ~18% no-show rates; those with reminders see closer to 8%.</InsightFooter>
    </InsightCard>
  );
}

// 3. Avg session value
function AvgSessionValueInsight({ sessions, therapist }) {
  const paid = sessions.filter(s =>
    s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund'
  );
  if (paid.length < 3) {
    return (
      <InsightCard accent="gold" eyebrow="Avg session value" tag="Observation">
        <InsightHeadline>Your average session value will appear here once you have a few paid sessions.</InsightHeadline>
        <InsightFooter>For independent practice in the Denver/Front Range area, typical 60-min sessions run $110-130. Source: local market research, January 2026.</InsightFooter>
      </InsightCard>
    );
  }
  const totalCollected = paid.reduce((sum, s) => sum + (s.actual || 0), 0);
  const avg = Math.round(totalCollected / paid.length);
  const peerAvg = 110; // Denver/Front Range solo independent, BENCHMARKS.md
  return (
    <InsightCard accent="gold" eyebrow="Avg session value" tag="Observation">
      <InsightHeadline>
        Your sessions average <span style={{ color: T.gold, fontWeight: 700 }}>{currency(avg)}</span>. Front Range LMTs in independent practice typically run <span style={{ color: T.rose }}>$110-130</span> for a 60-min.
      </InsightHeadline>
      <BenchmarkBar
        valueLeftPct={Math.min((avg / 200) * 100, 100)}
        peerLeftPct={(peerAvg / 200) * 100}
        peerLabel="Front Range avg"
      />
      <InsightCompare>
        Calculated across {paid.length} paid sessions in the last 90 days. {avg >= peerAvg
          ? 'You sit at or above local market rates, which usually means you have room to hold or modestly raise.'
          : 'Your rates run below the local range for independent practice. A small increase often goes through smoothly with regulars who already trust your work.'}
      </InsightCompare>
      <InsightFooter>Front Range benchmark from local market research (Denver/Boulder LMT pricing surveys), January 2026.</InsightFooter>
    </InsightCard>
  );
}

// 4. Session length mix (own data only, no peer comparison)
function SessionLengthMixInsight({ sessions }) {
  const paid = sessions.filter(s =>
    s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund'
  );
  if (paid.length < 5) {
    return (
      <InsightCard accent="sage" eyebrow="Session length mix" tag="Pattern">
        <InsightHeadline>Your session length patterns will appear here as your data builds up.</InsightHeadline>
      </InsightCard>
    );
  }
  // Bucket by duration: <75 = "60-min", >=75 = "90-min"
  const short = paid.filter(s => (s.duration || 60) < 75);
  const long = paid.filter(s => (s.duration || 60) >= 75);
  const shortAvg = short.length > 0
    ? Math.round(short.reduce((sum, s) => sum + (s.actual || 0), 0) / short.length)
    : 0;
  const longAvg = long.length > 0
    ? Math.round(long.reduce((sum, s) => sum + (s.actual || 0), 0) / long.length)
    : 0;
  const shortTipPct = computeTipPct(short);
  const longTipPct = computeTipPct(long);

  if (short.length === 0 || long.length === 0) {
    // Only one length used; no comparison to draw.
    return (
      <InsightCard accent="sage" eyebrow="Session length mix" tag="Pattern">
        <InsightHeadline>You're booking one session length consistently.</InsightHeadline>
        <InsightCompare>
          {short.length > 0
            ? `Your 60-min sessions average ${currency(shortAvg)} with a ${shortTipPct}% tip rate.`
            : `Your 90-min sessions average ${currency(longAvg)} with a ${longTipPct}% tip rate.`}
        </InsightCompare>
      </InsightCard>
    );
  }

  return (
    <InsightCard accent="sage" eyebrow="Session length mix" tag="Pattern">
      <InsightHeadline>
        Your 90-minute sessions tip <span style={{ color: T.sage, fontWeight: 700 }}>{longTipPct}%</span>. Your 60-minute sessions tip <span style={{ color: T.gold }}>{shortTipPct}%</span>.
      </InsightHeadline>
      <InsightStatRow stats={[
        { label: '60-min', value: currency(shortAvg), meta: `${short.length} session${short.length !== 1 ? 's' : ''}` },
        { label: '90-min', value: currency(longAvg), meta: `${long.length} session${long.length !== 1 ? 's' : ''}` },
      ]} />
      <InsightCompare>
        {longTipPct > shortTipPct
          ? 'Clients who book the longer session tip more, both in dollars and rate. If you\'d like to grow this share, leaning into the 90-min framing when new clients ask helps.'
          : 'Both session lengths tip in a similar range. Mix is mostly driven by client preference.'}
      </InsightCompare>
      <InsightFooter>Computed from your last 90 days of paid sessions.</InsightFooter>
    </InsightCard>
  );
}

function computeTipPct(arr) {
  if (arr.length === 0) return 0;
  const tipTotal = arr.reduce((s, x) => s + (x.tip || 0), 0);
  const baseTotal = arr.reduce((s, x) => s + ((x.base != null ? x.base : (x.actual || 0)) - (x.tip || 0)), 0);
  return baseTotal > 0 ? Math.round((tipTotal / baseTotal) * 100) : 0;
}

// 5. Strongest month (own data only)
function StrongestMonthInsight({ sessions }) {
  // Group by month within the year, find highest collected.
  const byMonth = {};
  sessions
    .filter(s => s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund')
    .forEach(s => {
      const m = s.date.getMonth();
      byMonth[m] = (byMonth[m] || 0) + (s.actual || 0);
    });
  const entries = Object.entries(byMonth).map(([m, v]) => ({ m: parseInt(m, 10), v }));
  if (entries.length < 2) {
    return (
      <InsightCard accent="rose" eyebrow="Your strongest month" tag="Pattern">
        <InsightHeadline>Your strongest month will appear here as your data spans more months.</InsightHeadline>
      </InsightCard>
    );
  }
  entries.sort((a, b) => b.v - a.v);
  const best = entries[0];
  const bestName = new Date(2026, best.m, 1).toLocaleDateString('en-US', { month: 'long' });
  return (
    <InsightCard accent="rose" eyebrow="Your strongest month" tag="Pattern">
      <InsightHeadline>
        Your best month so far has been <span style={{ color: T.sage, fontWeight: 700 }}>{bestName}</span> at <span style={{ color: T.sage, fontWeight: 700 }}>{currency(best.v)}</span>.
      </InsightHeadline>
      <InsightCompare>
        Across the months you've worked, {bestName} delivered the strongest collected total. Worth knowing for next year's planning, especially around marketing and outreach.
      </InsightCompare>
      <InsightFooter>Refreshes as new sessions are recorded.</InsightFooter>
    </InsightCard>
  );
}

// 6. Day of week
function DayOfWeekInsight({ sessions }) {
  const dayCollected = [0,0,0,0,0,0,0];
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  sessions
    .filter(s => s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund')
    .forEach(s => {
      const d = s.date.getDay();
      dayCollected[d] += (s.actual || 0);
    });
  const total = dayCollected.reduce((s, x) => s + x, 0);
  if (total === 0) {
    return (
      <InsightCard accent="sage" eyebrow="Day of week patterns" tag="Observation">
        <InsightHeadline>Day-of-week patterns will appear once you have more sessions logged.</InsightHeadline>
      </InsightCard>
    );
  }
  const bestIdx = dayCollected.indexOf(Math.max(...dayCollected));
  const bestName = dayNames[bestIdx];
  const bestAmt = dayCollected[bestIdx];
  return (
    <InsightCard accent="sage" eyebrow="Day of week patterns" tag="Observation">
      <InsightHeadline>
        <span style={{ color: T.sage, fontWeight: 700 }}>{bestName}s</span> are your highest-earning day of the week.
      </InsightHeadline>
      <InsightCompare>
        Across your last 90 days, {bestName}s have brought in {currency(bestAmt)}. If you have flexibility, adding capacity on this day historically returns the highest yield.
      </InsightCompare>
      <InsightFooter>Pattern based on the last 90 days of paid sessions.</InsightFooter>
    </InsightCard>
  );
}

// 7. Effective hourly rate
function EffectiveHourlyInsight({ sessions }) {
  const paid = sessions.filter(s =>
    s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund'
  );
  if (paid.length < 3) {
    return (
      <InsightCard accent="gold" eyebrow="Effective hourly rate" tag="For context">
        <InsightHeadline>Your effective hourly rate will appear once you have a few paid sessions.</InsightHeadline>
      </InsightCard>
    );
  }
  const totalCollected = paid.reduce((sum, s) => sum + (s.actual || 0), 0);
  const totalMinutes = paid.reduce((sum, s) => sum + (s.duration || 60), 0);
  const totalHours = totalMinutes / 60;
  const effectiveHourly = totalHours > 0 ? Math.round(totalCollected / totalHours) : 0;
  return (
    <InsightCard accent="gold" eyebrow="Effective hourly rate" tag="For context">
      <InsightHeadline>
        Across your session hours, you earn about <span style={{ color: T.gold, fontWeight: 700 }}>{currency(effectiveHourly)}/hr</span>.
      </InsightHeadline>
      <InsightCompare>
        This counts only the hours you spent in session. It's useful for thinking about your time and pricing, not for setting your session price directly.
      </InsightCompare>
      <InsightFooter>Calculated from session minutes recorded in your schedule across the last 90 days.</InsightFooter>
    </InsightCard>
  );
}

// 8. Seasonality
function SeasonalityInsight({ sessions }) {
  // Group by month across all years, find the multi-year average pattern.
  const monthTotals = [0,0,0,0,0,0,0,0,0,0,0,0];
  const monthCounts = [0,0,0,0,0,0,0,0,0,0,0,0];
  const monthYearSet = new Set();
  sessions
    .filter(s => s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund')
    .forEach(s => {
      const m = s.date.getMonth();
      const ym = `${s.date.getFullYear()}-${m}`;
      monthTotals[m] += (s.actual || 0);
      if (!monthYearSet.has(ym)) {
        monthYearSet.add(ym);
        monthCounts[m] += 1;
      }
    });
  const monthAvgs = monthTotals.map((t, i) => monthCounts[i] > 0 ? t / monthCounts[i] : 0);
  const yearAvgMonth = monthAvgs.filter(v => v > 0);
  const yearAvg = yearAvgMonth.length > 0
    ? yearAvgMonth.reduce((s, x) => s + x, 0) / yearAvgMonth.length
    : 0;

  const monthDataPoints = monthAvgs.filter(v => v > 0).length;
  if (monthDataPoints < 4) {
    return (
      <InsightCard accent="forest" eyebrow="Seasonality" tag="Pattern">
        <InsightHeadline>Seasonality will appear once you have at least four months of data.</InsightHeadline>
      </InsightCard>
    );
  }

  // Find the month with the highest average.
  const peakIdx = monthAvgs.indexOf(Math.max(...monthAvgs));
  const peakName = new Date(2026, peakIdx, 1).toLocaleDateString('en-US', { month: 'long' });
  const peakLift = yearAvg > 0
    ? Math.round(((monthAvgs[peakIdx] - yearAvg) / yearAvg) * 100)
    : 0;
  return (
    <InsightCard accent="forest" eyebrow="Seasonality" tag="Pattern">
      <InsightHeadline>
        Your <span style={{ color: T.sage, fontWeight: 700 }}>{peakName}</span> runs <span style={{ color: T.sage, fontWeight: 700 }}>{peakLift}%</span> above your year-round average.
      </InsightHeadline>
      <InsightCompare>
        Across your history, {peakName} has been your strongest month. Worth keeping in mind when planning slower months. December typically slows 15-20% for most solo LMTs.
      </InsightCompare>
      <InsightFooter>Based on your own multi-month data, with seasonal context from industry sources.</InsightFooter>
    </InsightCard>
  );
}

// 9. Client retention
function ClientRetentionInsight({ sessions }) {
  // For each client, when was their first paid visit?
  // Did they come back within 8 weeks?
  const byClient = {};
  sessions
    .filter(s => s.status === 'paid' && s.source !== 'cancellation_fee' && s.source !== 'refund')
    .forEach(s => {
      const key = s.client || 'Unknown';
      if (!byClient[key]) byClient[key] = [];
      byClient[key].push(s.date);
    });
  // Eligible clients: those with first visit > 8 weeks ago.
  const eightWeeksMs = 8 * 7 * 24 * 60 * 60 * 1000;
  let eligible = 0;
  let returned = 0;
  Object.values(byClient).forEach(dates => {
    dates.sort((a, b) => a - b);
    const first = dates[0];
    if (TODAY - first < eightWeeksMs) return;
    eligible += 1;
    const hadReturnWithin8Wk = dates.some(d => d > first && (d - first) <= eightWeeksMs);
    if (hadReturnWithin8Wk) returned += 1;
  });
  if (eligible < 5) {
    return (
      <InsightCard accent="forest" eyebrow="Client retention" tag="Pattern">
        <InsightHeadline>Retention patterns will appear here once a few clients have been with you for 8+ weeks.</InsightHeadline>
        <InsightFooter>National baseline: 55% of first-time massage clients book a second visit. Source: SchedulingKit 2026.</InsightFooter>
      </InsightCard>
    );
  }
  const myPct = Math.round((returned / eligible) * 100);
  const peerAvg = 55; // BENCHMARKS.md
  return (
    <InsightCard accent="forest" eyebrow="Client retention" tag="Pattern">
      <InsightHeadline>
        <span style={{ color: myPct >= peerAvg ? T.sage : T.rose, fontWeight: 700 }}>{myPct}%</span> of your clients book again within 8 weeks. The typical rate is <span style={{ color: T.rose }}>{peerAvg}%</span>.
      </InsightHeadline>
      <InsightCompare>
        {myPct >= 70
          ? 'AMTA considers a 70%+ retention rate strong. Your client work is doing what marketing budgets try to buy.'
          : myPct >= peerAvg
          ? 'Your clients return at a rate above the national baseline. The relationships you\'re building hold.'
          : myPct >= 30
          ? 'Below the typical rate. A short follow-up note 1-2 weeks after a first visit tends to lift this meaningfully.'
          : 'Substantially below the typical rate. Worth looking at first-visit experience and follow-up.'}
      </InsightCompare>
      <InsightFooter>National baseline from SchedulingKit 2026. AMTA considers below 50% retention poor and above 70% strong.</InsightFooter>
    </InsightCard>
  );
}

function PeriodPlaceholder({ period }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18,
      padding: '40px 24px', textAlign: 'center',
      boxShadow: T.shadowSoft,
    }}>
      <div style={{
        fontFamily: T.serif, fontSize: 24, fontWeight: 600,
        color: T.forestDeep, marginBottom: 10,
      }}>{period} view</div>
      <div style={{
        fontSize: 13, color: T.gray500, lineHeight: 1.6,
        maxWidth: 320, margin: '0 auto',
      }}>
        Coming in the next phase. The 6-band design from the Daily tab will scale to this period with the same architecture: hero number, shape chart, attention items, breakdown, period chips, and receipt-style session list.
      </div>
    </div>
  );
}

// ─── Main exported component ───────────────────────────────────────
//
// Takes the same `sessions` array shape as V1, plus `therapist` and
// `onRefundClick` callback. Tab state is local.
export default function BillingDashboardV2({ sessions, therapist, onRefundClick }) {
  const [subView, setSubView] = useState('daily');

  // Phase 19 (HK May 18 2026): pending membership renewals. Therapist
  // resolves each by tapping Charge (opens Checkout in subscription
  // mode) or Waive (one-tap update, status='waived').
  const [renewals, setRenewals] = useState([]);
  const [renewalsLoading, setRenewalsLoading] = useState(true);
  const [renewalToCharge, setRenewalToCharge] = useState(null); // { renewal, subscription, client }

  async function fetchRenewals() {
    if (!therapist?.id) return;
    setRenewalsLoading(true);
    try {
      const { data, error } = await supabase
        .from('member_subscription_renewals')
        .select(`
          id, period_start, period_end, due_on, amount_due_cents, status,
          member_subscription_id,
          subscription:member_subscriptions(
            id, monthly_price, monthly_session_credits, current_credits,
            client_id, client_email, client_name, renewal_day_of_month,
            membership:memberships(name)
          )
        `)
        .eq('therapist_id', therapist.id)
        .eq('status', 'pending')
        .order('due_on', { ascending: true });
      if (error) {
        // Probably 'relation does not exist' pre-migration. Render
        // empty and don't crash the rest of the billing dashboard.
        console.warn('renewals fetch failed (migration may not be applied):', error.message);
        setRenewals([]);
      } else {
        setRenewals(data || []);
      }
    } catch (e) {
      console.warn('renewals fetch threw:', e);
      setRenewals([]);
    } finally {
      setRenewalsLoading(false);
    }
  }

  useEffect(() => { fetchRenewals(); }, [therapist?.id]);

  async function waiveRenewal(renewalId) {
    try {
      await supabase.from('member_subscription_renewals').update({
        status: 'waived',
        resolved_at: new Date().toISOString(),
        resolved_by_therapist_id: therapist.id,
      }).eq('id', renewalId);
      setRenewals(rs => rs.filter(r => r.id !== renewalId));
    } catch (e) {
      console.warn('waive failed:', e);
    }
  }

  async function openChargeForRenewal(renewal) {
    // Need the client row to satisfy CheckoutModal's prop requirements
    // (client.id, client.email).
    const sub = renewal.subscription;
    let client = null;
    if (sub?.client_id) {
      const { data } = await supabase
        .from('clients').select('id, email, phone, name, stripe_customer_id, payment_method_id, card_last4, card_brand')
        .eq('id', sub.client_id).maybeSingle();
      client = data;
    }
    if (!client) {
      client = {
        id: sub?.client_id || null,
        email: sub?.client_email || null,
        name: sub?.client_name || null,
      };
    }
    setRenewalToCharge({ renewal, subscription: sub, client });
  }

  const TABS = [
    { id: 'daily',    label: 'Daily' },
    { id: 'weekly',   label: 'Weekly' },
    { id: 'monthly',  label: 'Monthly' },
    { id: 'yearly',   label: 'Yearly' },
    { id: 'insights', label: 'Insights' },
  ];

  const viewProps = { sessions, therapist, onRefundClick };

  return (
    <div style={{
      width: '100%',
      paddingBottom: typeof window !== 'undefined' && window.innerWidth < 768
        ? 'calc(74px + env(safe-area-inset-bottom, 0px) + 24px)' : 0,
      fontFamily: "'Sentient', Georgia, 'Times New Roman', serif",
    }}>
      {/* Page header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: T.serif, fontSize: 32, fontWeight: 600,
          color: T.forestDeep, margin: 0,
          letterSpacing: '-0.02em', lineHeight: 1,
        }}>Billing</h2>
        <p style={{
          fontSize: 13, color: T.gray500, fontWeight: 500,
          margin: '4px 0 0 0',
        }}>{TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <ImportedDataFootnote therapistId={therapist?.id} metricType="revenue" />
      </div>

      {/* Phase 19: pending membership renewals. Hidden when none.
          Each row has a Charge button (opens Checkout in subscription
          mode) and a smaller Waive option. The card surfaces every
          due/upcoming renewal so the therapist can resolve before
          forgetting. */}
      {!renewalsLoading && renewals.length > 0 && (
        <div style={{
          background: '#FEF7E8',
          border: '1px solid #F0D89C',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>⏰</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#854F0B' }}>
              {renewals.length === 1
                ? '1 membership needs your action'
                : `${renewals.length} memberships need your action`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {renewals.map(r => {
              const subName = r.subscription?.membership?.name || 'Membership';
              const clientName = r.subscription?.client_name || r.subscription?.client_email || 'Client';
              const amount = (r.amount_due_cents / 100).toFixed(2);
              const dueText = new Date(r.due_on + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={r.id} style={{
                  background: '#fff',
                  border: '1px solid #F0E5C4',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{clientName}</div>
                    <div style={{ fontSize: 11.5, color: T.gray500, marginTop: 1 }}>
                      {subName} · ${amount} due {dueText}
                    </div>
                  </div>
                  <button
                    onClick={() => openChargeForRenewal(r)}
                    style={{
                      background: T.forestDeep,
                      color: '#fff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}>
                    Charge
                  </button>
                  <button
                    onClick={() => waiveRenewal(r.id)}
                    title="Waive this renewal (no charge this period)"
                    style={{
                      background: 'transparent',
                      color: T.gray500,
                      border: '1px solid transparent',
                      padding: '7px 10px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}>
                    Waive
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Period tabs */}
      <div style={{
        display: 'flex', gap: 2,
        background: T.creamDeep, borderRadius: 12, padding: 4,
        marginBottom: 20,
        fontSize: 12, fontWeight: 600,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setSubView(t.id)} style={{
            flex: 1, textAlign: 'center',
            padding: '7px 4px', borderRadius: 8,
            color: subView === t.id ? T.forestDeep : T.gray500,
            background: subView === t.id ? 'white' : 'transparent',
            border: 'none', cursor: 'pointer',
            boxShadow: subView === t.id ? T.shadowSoft : 'none',
            fontWeight: 600, fontSize: 12,
            transition: 'all 0.15s ease',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Active view */}
      {subView === 'daily'    && <DailyView {...viewProps} />}
      {subView === 'weekly'   && <WeeklyView {...viewProps} />}
      {subView === 'monthly'  && <MonthlyView {...viewProps} />}
      {subView === 'yearly'   && <YearlyView {...viewProps} />}
      {subView === 'insights' && <InsightsView {...viewProps} />}

      {/* Subscription Checkout (Phase 19). Opens when therapist taps
          Charge on a pending renewal row above. Reuses the same
          CheckoutModal that handles service charges; the modal
          internally branches on subscription vs appt. */}
      {renewalToCharge && (
        <CheckoutModal
          subscription={renewalToCharge.subscription}
          renewal={renewalToCharge.renewal}
          therapist={therapist}
          client={renewalToCharge.client}
          defaultAmountCents={renewalToCharge.renewal.amount_due_cents}
          onClose={() => setRenewalToCharge(null)}
          onPaid={() => { fetchRenewals(); }}
        />
      )}
    </div>
  );
}
