// src/components/schedule/TimeAvailableCard.jsx
//
// Replaces RevenueCard on the Schedule rail per HK May 19 2026:
// 'We don't want them to feel like they're losing out because they're
// not making enough revenue. That could be a stressful widget.
// Provide here is how much time you have available, and based on
// that, top three strategies to utilize that time based on industry
// best practices.'
//
// Time framed as capacity, not loss. Strategies adapt to time-tier:
//   < 5h  open: light week  → outreach + light marketing
//   5-15h open: comfortable → outreach + cluster + premium slot
//   > 15h open: spacious    → outreach + self-care + CEU
//   0h    open: fully booked → waitlist + rate review + recovery
//
// Phase 1 (this commit): card structure + adaptive strategy library
// fed by real bookable-gaps calculation from allAppts. Strategy
// action buttons currently no-op; deep-link wiring follows in Phase 2.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { computeAllInsights } from '../../lib/insights/deepInsights';

const C = {
  forest:     '#1F3A2C',
  forestMid:  '#2A5741',
  forestDeep: '#1F4131',
  sage:       '#5C7A4F',
  sageSoft:   '#B7D1AB',
  sageTint:   '#F0F6EE',
  cream:      '#FBF8F1',
  creamDeep:  '#F5EFE0',
  creamEdge:  '#EDE6D6',
  gold:       '#C9A86A',
  ink:        '#1F2937',
  inkSoft:    '#475569',
  muted:      '#94A3B8',
  gray500:    '#6B7280',
  gray400:    '#9CA3AF',
  line:       '#E2E8F0',
};

const F = {
  sans: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
};

// Strategy library, picked by tier. Each strategy declares whether
// it has a wired action. Wired strategies render with a button.
// Unwired strategies render as text-only content (icon + title + why)
// per the design principle: don't fake actions, don't say 'coming
// soon', let the text stand on its own when no wired destination
// exists yet.
const STRATEGY_LIB = {
  outreach: (count) => ({
    icon: '↻',
    title: `Reach out to ${count} lapsed regular${count === 1 ? '' : 's'}`,
    why: 'Existing clients convert 4x better than new outreach.',
    btn: 'Send check-in messages',
    action: 'outreach',
    wired: true,
  }),
  socialPost: {
    icon: '✍',
    title: 'Share a recent client win',
    why: 'A short post about a session outcome can bring 2 to 3 inquiries.',
    action: 'draftPost',
    wired: false,
  },
  reviewRequest: {
    icon: '⭐',
    title: 'Ask 2 clients for a review',
    why: 'Reviews compound. Most new bookings check reviews first.',
    btn: 'Pick clients to ask',
    action: 'reviewRequest',
    wired: true,
  },
  cluster: {
    icon: '⬢',
    title: 'Cluster isolated slots',
    why: 'Back-to-back sessions reduce setup time and fatigue. Worth proposing to clients on days with two single appointments.',
    action: 'cluster',
    wired: false,
  },
  premiumSlot: {
    icon: '⏱',
    title: 'Offer a 90-min deep tissue session',
    why: 'Longer sessions earn more per hour and serve your most loyal clients better.',
    action: 'premium',
    wired: false,
  },
  selfCare: {
    icon: '🌱',
    title: 'Block real recovery time',
    why: 'Your body is the practice. Recovery time pays back in longevity.',
    btn: 'Block self-care window',
    action: 'blockTime',
    wired: true,
  },
  ceu: {
    icon: '📖',
    title: 'Take a CEU course this week',
    why: 'Most state licenses need continuing education hours. Spacious weeks are when they fit.',
    action: 'ceu',
    wired: false,
  },
  waitlist: {
    icon: '📋',
    title: 'Start a small waitlist',
    why: 'When you are full, capture the clients who still want time with you. A short list to call when a cancellation opens.',
    action: 'waitlist',
    wired: false,
  },
  rateReview: {
    icon: '💵',
    title: 'Consider raising rates',
    why: 'Full schedules at current rates are a signal your work is undervalued.',
    btn: 'Review your rates',
    action: 'rates',
    wired: true,
  },
};

function pickStrategies(hoursOpen, lapsedCount) {
  if (hoursOpen === 0) {
    return [STRATEGY_LIB.waitlist, STRATEGY_LIB.rateReview, STRATEGY_LIB.selfCare];
  }
  if (hoursOpen < 5) {
    const outreachCount = Math.max(2, lapsedCount || 4);
    return [
      STRATEGY_LIB.outreach(outreachCount),
      STRATEGY_LIB.socialPost,
      STRATEGY_LIB.reviewRequest,
    ];
  }
  if (hoursOpen < 15) {
    const outreachCount = Math.max(2, lapsedCount || 3);
    return [
      STRATEGY_LIB.outreach(outreachCount),
      STRATEGY_LIB.cluster,
      STRATEGY_LIB.premiumSlot,
    ];
  }
  // Spacious
  const outreachCount = Math.max(3, lapsedCount || 7);
  return [
    STRATEGY_LIB.outreach(outreachCount),
    STRATEGY_LIB.selfCare,
    STRATEGY_LIB.ceu,
  ];
}

function formatHM(minutes) {
  if (!minutes || minutes <= 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function dayLabel(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tmrw';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatTime(hhmm) {
  // hhmm = total minutes from start of day
  const h = Math.floor(hhmm / 60);
  const m = hhmm % 60;
  const period = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 || 12;
  if (m === 0) return `${hr}${period}`;
  return `${hr}:${m.toString().padStart(2, '0')}${period}`;
}

// Compute bookable windows (>= 60 min) from appts within a date window.
// Returns { windows: [{ date, startMin, durationMin }], totalMinutes }
function computeBookableWindows(allAppts, scope = 'weekly', today = new Date()) {
  if (!allAppts) return { windows: [], totalMinutes: 0 };
  const t0 = new Date(today);
  t0.setHours(0, 0, 0, 0);
  const tEnd = new Date(t0);
  if (scope === 'today') {
    tEnd.setHours(23, 59, 59, 999);
  } else if (scope === 'weekly') {
    tEnd.setDate(tEnd.getDate() + 7);
  } else if (scope === 'monthly') {
    tEnd.setMonth(tEnd.getMonth() + 1);
    tEnd.setDate(0);
    tEnd.setHours(23, 59, 59, 999);
  } else {
    tEnd.setDate(tEnd.getDate() + 7); // fallback
  }
  // Default working window per day: 9am to 7pm = 600 min span
  const dayStartMin = 9 * 60;
  const dayEndMin = 19 * 60;
  const minWindowMin = 60;

  // Group appts by date
  const apptsByDay = {};
  allAppts.forEach(a => {
    if (a.preview || a.external) return;
    if (!a.date) return;
    const d = new Date(a.date);
    if (d < t0 || d > tEnd) return;
    const key = d.toISOString().slice(0, 10);
    if (!apptsByDay[key]) apptsByDay[key] = [];
    // Resolve start minute from a.startTime ("14:30") or a.time ("2:30 PM")
    let startMin = 0;
    if (a.startTime && /^\d{1,2}:\d{2}$/.test(a.startTime)) {
      const [h, m] = a.startTime.split(':').map(Number);
      startMin = h * 60 + m;
    } else if (a.time) {
      const tm = a.time.match(/(\d+):?(\d+)?\s*(am|pm)/i);
      if (tm) {
        let h = parseInt(tm[1], 10);
        const m = parseInt(tm[2] || '0', 10);
        const isPm = /pm/i.test(tm[3]);
        if (isPm && h < 12) h += 12;
        if (!isPm && h === 12) h = 0;
        startMin = h * 60 + m;
      }
    }
    const duration = a.duration || a.durationMin || 60;
    apptsByDay[key].push({ startMin, endMin: startMin + duration });
  });

  // Walk each day in the scope, compute gaps
  const windows = [];
  let totalMin = 0;
  for (let d = new Date(t0); d <= tEnd; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const dayAppts = (apptsByDay[key] || []).sort((a, b) => a.startMin - b.startMin);
    let cursor = dayStartMin;
    dayAppts.forEach(a => {
      if (a.startMin > cursor) {
        const gap = a.startMin - cursor;
        if (gap >= minWindowMin) {
          windows.push({
            date: new Date(d),
            startMin: cursor,
            durationMin: gap,
          });
          totalMin += gap;
        }
      }
      cursor = Math.max(cursor, a.endMin);
    });
    if (dayEndMin > cursor) {
      const gap = dayEndMin - cursor;
      if (gap >= minWindowMin) {
        windows.push({
          date: new Date(d),
          startMin: cursor,
          durationMin: gap,
        });
        totalMin += gap;
      }
    }
  }
  // Sort by size desc so the top windows are most impactful
  windows.sort((a, b) => b.durationMin - a.durationMin);
  return { windows, totalMinutes: totalMin };
}

export default function TimeAvailableCard({ allAppts = [], scope = 'weekly', today, lapsedCount = 0, lapsedClients = [], memberClientIds = [], onParentAction }) {
  const navigate = useNavigate();
  const { windows, totalMinutes } = computeBookableWindows(allAppts, scope, today || new Date());
  const hoursOpen = totalMinutes / 60;
  const scopeLabel = scope === 'today' ? 'today' : scope === 'monthly' ? 'this month' : 'this week';

  // Deep insights (HK May 22 2026 Tier 4): compute care-framed
  // suggestions from the therapist's actual data instead of the
  // shallow generic tips the previous strategy library returned.
  // Falls back to the legacy lapsed-regulars CTA if no deep
  // insights fire (early days for a new therapist with little
  // data).
  const deepInsights = computeAllInsights({
    appointments: allAppts,
    today: today || new Date(),
    openHoursToday: hoursOpen,
    memberClientIds,
  });

  // Show deep insights if any fired. Otherwise show the legacy
  // shallow strategies so the card never renders empty.
  const strategies = deepInsights.length > 0
    ? deepInsights
    : pickStrategies(hoursOpen, lapsedCount);

  const isFullyBooked = totalMinutes === 0;

  // Map each wired strategy.action to a real destination. Unwired
  // strategies render text-only and never call this function (the
  // button is not rendered for them). Per design principle: no
  // alert popups, no 'coming soon' notes, no fake actions.
  function runStrategy(s) {
    // Deep insight actions (HK May 22 2026 Tier 4). Each carries
    // an actionPayload.clients list. We deep-link to outreach with
    // the specific clients pre-selected, same pattern as the
    // existing lapsed-clients deep link (commit 68ef35ba).
    if (s.action === 'first_session_checkin' || s.action === 'cadence_drift' || s.action === 'top_clients_quiet') {
      const clientList = s.actionPayload?.clients || [];
      if (clientList.length > 0) {
        // Map each insight to a tone-appropriate default template
        const templates = {
          first_session_checkin: {
            subject: 'Just checking in',
            body: `Hi {{first_name}},\n\nIt has been a couple of weeks since your first session and I wanted to say hello. No pressure at all, just checking in. If you would like to book again, here is a quick link: {{rebook_link}}\n\nTake care,\n{{therapist_name}}`,
          },
          cadence_drift: {
            subject: 'Thinking of you',
            body: `Hi {{first_name}},\n\nIt has been a little longer than usual since I have seen you. Just wanted to send a warm note. If you would like to find a time, here is the link: {{rebook_link}}\n\nTake care,\n{{therapist_name}}`,
          },
          top_clients_quiet: {
            subject: 'It has been a while',
            body: `Hi {{first_name}},\n\nI have been thinking about you. It has been a while since your last visit and I wanted to make sure everything is well. If you would like to come in, here is a quick link: {{rebook_link}}\n\nWarmly,\n{{therapist_name}}`,
          },
        };
        const tpl = templates[s.action];
        navigate('/dashboard/outreach', {
          state: {
            openLapsedReachout: true,
            lapsedRecipients: clientList.map(c => ({
              id: c.id,
              first_name: (c.name || '').split(' ')[0] || 'there',
              last_name: (c.name || '').split(' ').slice(1).join(' ') || '',
              name: c.name,
              email: c.email,
              phone: c.phone,
            })),
            templateOverride: tpl,
          },
        });
        return;
      }
    }
    switch (s.action) {
      case 'outreach':
        // HK May 22 2026: deep-link to outreach with the SPECIFIC
        // lapsed clients pre-selected. Previously this dumped the
        // therapist on the quick-send picker, losing the 'these 3
        // clients' context. Now Outreach opens the send modal
        // directly with those recipients filled in. If for some
        // reason lapsedClients was not passed (legacy callers), we
        // fall back to the old behavior.
        if (lapsedClients && lapsedClients.length > 0) {
          navigate('/dashboard/outreach', {
            state: {
              openLapsedReachout: true,
              lapsedRecipients: lapsedClients.map(c => ({
                id: c.client_id || c.id,
                first_name: c.first_name || (c.name || '').split(' ')[0] || 'there',
                last_name: c.last_name || (c.name || '').split(' ').slice(1).join(' ') || '',
                name: c.name,
                email: c.email,
                phone: c.phone,
              })).filter(r => r.id),
            },
          });
        } else {
          navigate('/dashboard/outreach');
        }
        return;
      case 'reviewRequest':
        navigate('/dashboard/clients');
        return;
      case 'rates':
        navigate('/dashboard/settings');
        return;
      case 'blockTime':
        if (typeof onParentAction === 'function') {
          onParentAction('open-time-off');
        } else {
          navigate('/dashboard/schedule');
        }
        return;
      default:
        return;
    }
  }

  return (
    <section style={{
      background: isFullyBooked
        ? `linear-gradient(180deg, ${C.cream} 0%, ${C.sageTint} 100%)`
        : C.cream,
      border: `1px solid ${isFullyBooked ? C.sageSoft : C.line}`,
      borderRadius: 12,
      padding: '12px 14px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: isFullyBooked ? C.forestMid : C.muted,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        🌿 Time available
      </div>

      <div style={{
        fontFamily: F.serif,
        fontSize: 26, fontWeight: 700,
        color: C.forestMid, lineHeight: 1,
        letterSpacing: '-0.01em',
        marginBottom: 4,
      }}>
        {isFullyBooked ? 'Fully booked' : formatHM(totalMinutes)}
        {!isFullyBooked && (
          <span style={{ fontSize: 14, color: C.gray500, fontWeight: 500, marginLeft: 4 }}>
            open
          </span>
        )}
      </div>

      <div style={{
        fontSize: 11.5, color: C.gray500,
        fontStyle: 'italic', fontFamily: F.serif,
        marginBottom: 12,
      }}>
        {isFullyBooked
          ? `Beautiful work. No bookable windows ${scopeLabel}.`
          : `${windows.length} bookable window${windows.length === 1 ? '' : 's'} ${scopeLabel}`}
      </div>

      {!isFullyBooked && windows.length > 0 && (
        <ul style={{
          margin: '0 0 14px',
          padding: 0,
          listStyle: 'none',
          fontSize: 11.5,
          color: C.inkSoft,
          lineHeight: 1.6,
        }}>
          {windows.slice(0, 3).map((w, i) => (
            <li key={i} style={{ padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.sage, flexShrink: 0 }} />
              {dayLabel(w.date)} {formatTime(w.startMin)} · {formatHM(w.durationMin)}
            </li>
          ))}
          {windows.length > 3 && (
            <li style={{ padding: '2px 0', color: C.gray400, fontSize: 11, fontStyle: 'italic', marginLeft: 10 }}>
              + {windows.length - 3} more
            </li>
          )}
        </ul>
      )}

      <div style={{
        fontSize: 10, fontWeight: 700,
        color: C.gold,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        ✨ {isFullyBooked ? 'Worth thinking about' : 'Ways to use this'}
      </div>

      {strategies.map((s, i) => (
        <div key={i} style={{
          background: isFullyBooked ? '#FFFFFF' : C.creamDeep,
          border: `1px solid ${isFullyBooked ? C.sageSoft : C.creamEdge}`,
          borderRadius: 9,
          padding: '10px 11px',
          marginBottom: i < strategies.length - 1 ? 7 : 0,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: s.wired ? 7 : 0 }}>
            <div style={{
              fontSize: 14, flexShrink: 0, width: 20,
              textAlign: 'center', color: C.forest,
            }}>{s.icon}</div>
            <div>
              <div style={{
                fontFamily: F.serif,
                fontSize: 13, fontWeight: 700,
                color: C.forestDeep,
                lineHeight: 1.3, marginBottom: 2,
                letterSpacing: '-0.005em',
              }}>{s.title}</div>
              <div style={{
                fontSize: 10.5, color: C.gray500,
                lineHeight: 1.45, fontStyle: 'italic',
                fontFamily: F.serif,
              }}>{s.why}</div>
            </div>
          </div>
          {s.wired && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); runStrategy(s); }}
              style={{
                width: '100%',
                background: '#FFFFFF',
                color: C.forestDeep,
                border: `1px solid ${C.creamEdge}`,
                borderRadius: 7,
                padding: '6px',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: F.sans,
              }}>
              {s.btn}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
