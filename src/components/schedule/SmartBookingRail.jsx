// src/components/schedule/SmartBookingRail.jsx
//
// Schedule tab left rail. Houses the four cards that make Smart
// Booking the moat:
//   1. Up-Next Briefing carousel (3-point cards per upcoming client)
//   2. Body Load meter (today's service mix vs. injury risk)
//   3. Revenue card (this week vs. last + goal)
//   4. Fill This Gap card (one matched client per gap, one-tap text)
//
// HK May 14 2026: Phase 1 build. Data is hardcoded placeholder so
// the layout, type rhythm, and motion are real even though wiring
// isn't. Phase 2 wires each data source per the founder playbook
// formulas (MARKETING_MYBODYMAP.md, How we win section).

import React, { useState, useRef, useEffect } from 'react';

const C = {
  forest:    '#1F3A2C',
  forestMid: '#2A5741',
  sage:      '#5C7A4F',
  sageBright:'#86EFAC',
  paper:     '#FFFFFF',
  cream:     '#FBF8F1',
  beige:     '#FAF6EE',
  warm:      '#FEF3C7',
  warmBd:    '#FCD34D',
  ink:       '#1F2937',
  inkSoft:   '#475569',
  muted:     '#94A3B8',
  mutedSoft: '#CBD5E1',
  line:      '#E2E8F0',
  lineSoft:  '#EEF2F7',
  saved:     '#16A34A',
  brief:     '#DCFCE7',
  briefBd:   '#16A34A',
  warn:      '#FEF3C7',
  warnBd:    '#D97706',
  danger:    '#FEE2E2',
  dangerBd:  '#DC2626',
  amber:     '#92400E',
};
const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

// Hardcoded placeholders. Real data wires in Phase 2.
const PLACEHOLDER_UPCOMING = [
  {
    id: 'u1',
    when: '9:00 AM',
    duration: 60,
    countdown: 'in 12 min',
    name: 'Emma Reyes',
    meta: 'Swedish · 4th visit · brief ready',
    points: [
      { label: 'Focus',     text: 'Lower back and shoulders, desk-job pattern' },
      { label: 'Pref',      text: 'Quiet session, no chatting, dim lights' },
      { label: 'Last time', text: 'Loved forearm pressure on glutes' },
    ],
    accent: 'forest',
  },
  {
    id: 'u2',
    when: '10:30 AM',
    duration: 90,
    countdown: '+ 1 hr',
    name: 'Jess Marin',
    meta: 'Deep tissue · 1st visit · needs intake',
    points: [
      { label: 'No intake yet', text: 'Send link before 10am' },
      { label: 'Watch',         text: 'Cancels 30% of bookings, confirm by 9:30' },
      { label: 'Note',          text: 'Referred by Maria L., friends' },
    ],
    accent: 'paper',
  },
  {
    id: 'u3',
    when: '2:00 PM',
    duration: 60,
    countdown: '+ 5 hr',
    name: 'Maria Lopez',
    meta: 'Hot stone · 12th visit · monthly regular',
    points: [
      { label: 'Pattern', text: 'Recurring tightness right trap, jaw' },
      { label: 'Package', text: '3 of 10 sessions left, mention renewal' },
      { label: 'Allergy', text: 'Avoid lavender, use unscented oil' },
    ],
    accent: 'beige',
  },
  {
    id: 'u4',
    when: '3:30 PM',
    duration: 60,
    countdown: '+ 6.5 hr',
    name: 'Dana Patel',
    meta: 'Swedish · 3rd visit · brief ready',
    points: [
      { label: 'Focus',     text: 'Right hip, runner, half marathon training' },
      { label: 'Pref',      text: 'Firm pressure, no oil on face' },
      { label: 'Last time', text: 'Added 15 min for IT band, billed difference' },
    ],
    accent: 'beige',
  },
];

const PLACEHOLDER_LOAD = {
  total: 6.2,        // load factor sum
  threshold: 'high', // light | moderate | high | risk
  callout: 'Hydrate at 11:30. Stretch wrists between deep tissue.',
  segments: [
    { kind: 'deep',  pct: 38, color: '#DC2626' },
    { kind: 'deep',  pct: 12, color: '#DC2626' },
    { kind: 'med',   pct: 20, color: '#F59E0B' },
    { kind: 'easy',  pct: 15, color: '#86EFAC' },
    { kind: 'easy',  pct: 10, color: '#86EFAC' },
    { kind: 'free',  pct:  5, color: '#E5E7EB' },
  ],
  summary: '3 deep · 2 swedish today',
};

const PLACEHOLDER_REVENUE = {
  thisWeek: 1840,
  goal: 2200,
  vsLastWeek: 120,
};

const PLACEHOLDER_GAP = {
  duration: 30,
  when: 'Today 12:30 PM',
  dollarValue: 85,
  bestClient: {
    name: 'Sarah K.',
    reasons: [
      'Monthly visits for 8 months, last 42 days ago',
      'Usually books Thursdays at lunch',
      'Texted you 2 weeks ago asking about availability',
    ],
  },
  otherMatches: 2,
};

export default function SmartBookingRail({ isMobile = false }) {
  return (
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      width: '100%',
      fontFamily: F.sans,
    }}>
      <UpNextCarousel upcoming={PLACEHOLDER_UPCOMING} />
      <BodyLoadCard load={PLACEHOLDER_LOAD} />
      <RevenueCard revenue={PLACEHOLDER_REVENUE} />
      <FillGapCard gap={PLACEHOLDER_GAP} />
    </aside>
  );
}

/* =============================================================
 * Up-Next Carousel
 * ============================================================= */

function UpNextCarousel({ upcoming }) {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);

  function scrollTo(i) {
    if (!trackRef.current) return;
    const clamped = Math.max(0, Math.min(upcoming.length - 1, i));
    setIndex(clamped);
    const cardWidth = trackRef.current.firstChild?.offsetWidth || 280;
    const gap = 12;
    trackRef.current.scrollTo({ left: clamped * (cardWidth + gap), behavior: 'smooth' });
  }

  // Sync index with manual scroll so dots stay accurate
  function onScroll() {
    if (!trackRef.current) return;
    const cardWidth = trackRef.current.firstChild?.offsetWidth || 280;
    const gap = 12;
    const i = Math.round(trackRef.current.scrollLeft / (cardWidth + gap));
    if (i !== index) setIndex(i);
  }

  return (
    <section>
      <SectionHeader
        eyebrow="Up next"
        trailing={upcoming[0]?.countdown}
        action={
          <CarouselArrows
            onPrev={() => scrollTo(index - 1)}
            onNext={() => scrollTo(index + 1)}
            canPrev={index > 0}
            canNext={index < upcoming.length - 1}
          />
        }
      />

      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: 6,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {upcoming.map((c, i) => (
          <BriefCard key={c.id} client={c} active={i === 0} />
        ))}
      </div>

      {/* Dots */}
      <div style={{
        display: 'flex',
        gap: 5,
        justifyContent: 'center',
        marginTop: 8,
      }}>
        {upcoming.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Show client ${i + 1}`}
            style={{
              width: i === index ? 16 : 6,
              height: 6,
              borderRadius: 3,
              border: 'none',
              padding: 0,
              background: i === index ? C.forestMid : C.mutedSoft,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
    </section>
  );
}

function BriefCard({ client, active }) {
  const style = (() => {
    if (client.accent === 'forest') {
      return {
        background: `linear-gradient(180deg, ${C.forest} 0%, ${C.forestMid} 100%)`,
        color: '#fff',
        border: 'none',
      };
    }
    if (client.accent === 'paper') {
      return {
        background: C.paper,
        color: C.ink,
        border: `1px solid ${C.line}`,
      };
    }
    return {
      background: C.beige,
      color: C.inkSoft,
      border: `1px solid ${C.line}`,
    };
  })();

  const isDark = client.accent === 'forest';
  const subtleText = isDark ? 'rgba(255,255,255,0.78)' : C.muted;
  const labelColor = isDark ? C.sageBright : (client.accent === 'paper' ? C.briefBd : C.muted);
  const bulletBg = isDark ? 'rgba(255,255,255,0.12)' : (client.accent === 'paper' ? C.brief : '#F1F5F9');
  const bulletFg = isDark ? C.sageBright : (client.accent === 'paper' ? C.briefBd : C.muted);

  return (
    <article style={{
      ...style,
      flexShrink: 0,
      width: 268,
      scrollSnapAlign: 'start',
      borderRadius: 12,
      padding: '12px 14px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* corner sheen on the active card */}
      {isDark && (
        <div style={{
          position: 'absolute',
          right: -24,
          bottom: -24,
          width: 70,
          height: 70,
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* when row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: subtleText, letterSpacing: '0.03em' }}>
          {client.when} · {client.duration} min
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: subtleText }}>
          {client.countdown}
        </span>
      </div>

      <div style={{
        fontFamily: F.serif,
        fontSize: client.accent === 'beige' ? 17 : 19,
        fontWeight: 700,
        lineHeight: 1.05,
        marginBottom: 1,
      }}>
        {client.name}
      </div>
      <div style={{
        fontSize: 11,
        color: subtleText,
        marginBottom: 10,
        lineHeight: 1.35,
      }}>
        {client.meta}
      </div>

      {/* three points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {client.points.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <span style={{
              flexShrink: 0,
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: bulletBg,
              color: bulletFg,
              fontSize: 9,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}>
              {i + 1}
            </span>
            <div style={{ fontSize: 11.5, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: labelColor,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginRight: 4,
                whiteSpace: 'nowrap',
              }}>
                {p.label}
              </span>
              <span style={{ color: isDark ? 'rgba(255,255,255,0.92)' : C.ink }}>
                {p.text}
              </span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function CarouselArrows({ onPrev, onNext, canPrev, canNext }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <ArrowBtn dir="prev" onClick={onPrev} disabled={!canPrev} />
      <ArrowBtn dir="next" onClick={onNext} disabled={!canNext} />
    </div>
  );
}

function ArrowBtn({ dir, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous client' : 'Next client'}
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        border: `1px solid ${C.line}`,
        background: disabled ? C.lineSoft : '#fff',
        color: disabled ? C.muted : C.ink,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        fontSize: 11,
        transition: 'background 0.1s',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'prev' ? (
          <path d="m15 18-6-6 6-6"/>
        ) : (
          <path d="m9 18 6-6-6-6"/>
        )}
      </svg>
    </button>
  );
}

/* =============================================================
 * Body Load Meter
 * ============================================================= */

function BodyLoadCard({ load }) {
  return (
    <section style={cardStyle()}>
      <SectionHeader eyebrow="Body load today" trailing={load.summary} />
      <div style={{
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        marginBottom: 6,
        background: C.lineSoft,
      }}>
        {load.segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        marginBottom: 6,
      }}>
        <span style={{ color: C.muted }}>Light · Moderate · High · Risk</span>
        <span style={{
          fontWeight: 700,
          color: load.threshold === 'risk' ? C.dangerBd : (load.threshold === 'high' ? C.warnBd : C.saved),
        }}>
          {load.threshold === 'risk' ? 'Injury risk' :
           load.threshold === 'high' ? 'High' :
           load.threshold === 'moderate' ? 'Moderate' : 'Light'}
        </span>
      </div>
      {load.callout && (
        <div style={{
          background: C.warm,
          border: `1px solid ${C.warmBd}`,
          borderRadius: 8,
          padding: '7px 10px',
          fontSize: 11,
          color: C.amber,
          lineHeight: 1.4,
        }}>
          {load.callout}
        </div>
      )}
    </section>
  );
}

/* =============================================================
 * Revenue Card
 * ============================================================= */

function RevenueCard({ revenue }) {
  const pct = Math.min(100, Math.round((revenue.thisWeek / revenue.goal) * 100));
  return (
    <section style={cardStyle()}>
      <SectionHeader eyebrow="Week revenue" />
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{
          fontFamily: F.serif,
          fontSize: 22,
          fontWeight: 700,
          color: C.forestMid,
          lineHeight: 1,
        }}>
          ${revenue.thisWeek.toLocaleString()}
        </span>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
          of ${revenue.goal.toLocaleString()} goal
        </span>
      </div>
      <div style={{
        height: 4,
        background: C.lineSoft,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: C.saved,
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{
        fontSize: 11,
        color: revenue.vsLastWeek >= 0 ? C.saved : C.dangerBd,
        fontWeight: 600,
      }}>
        {revenue.vsLastWeek >= 0 ? '↑' : '↓'} ${Math.abs(revenue.vsLastWeek)} from last week
      </div>
    </section>
  );
}

/* =============================================================
 * Fill This Gap (the moat)
 * ============================================================= */

function FillGapCard({ gap }) {
  return (
    <section style={{
      ...cardStyle(),
      background: C.warm,
      border: `1px solid ${C.warmBd}`,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.amber,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span>⚡</span>
        <span>Fill this gap</span>
      </div>

      <div style={{
        fontSize: 13,
        color: C.amber,
        fontWeight: 600,
        marginBottom: 2,
      }}>
        {gap.duration} min open · {gap.when}
      </div>
      <div style={{ fontSize: 11, color: C.amber, marginBottom: 12, fontWeight: 500 }}>
        Could earn ${gap.dollarValue}
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.muted,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>
          Best match
        </div>
        <div style={{
          fontFamily: F.serif,
          fontSize: 16,
          fontWeight: 700,
          color: C.ink,
          marginBottom: 8,
        }}>
          {gap.bestClient.name}
        </div>
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {gap.bestClient.reasons.map((r, i) => (
            <li key={i} style={{
              fontSize: 11.5,
              color: C.inkSoft,
              lineHeight: 1.4,
              paddingLeft: 12,
              position: 'relative',
            }}>
              <span style={{
                position: 'absolute',
                left: 2,
                top: 7,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: C.warnBd,
              }} />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => { /* wire-up in Phase 2 */ }}
        style={{
          width: '100%',
          background: C.warnBd,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '9px 0',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 6,
        }}
      >
        Text {gap.bestClient.name.split(' ')[0]} this slot
      </button>

      {gap.otherMatches > 0 && (
        <button style={{
          width: '100%',
          background: 'transparent',
          color: C.amber,
          border: 'none',
          fontSize: 11,
          cursor: 'pointer',
          padding: 4,
          fontWeight: 600,
        }}>
          + {gap.otherMatches} other strong matches →
        </button>
      )}
    </section>
  );
}

/* =============================================================
 * Shared
 * ============================================================= */

function cardStyle() {
  return {
    background: C.paper,
    border: `1px solid ${C.line}`,
    borderRadius: 12,
    padding: '12px 14px',
  };
}

function SectionHeader({ eyebrow, trailing, action }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, flex: 1 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.muted,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {eyebrow}
        </span>
        {trailing && (
          <span style={{
            fontSize: 11,
            color: C.muted,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            · {trailing}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
