// src/components/demos/ThreeDotDocumentDemo.jsx
//
// Animated three-dot document system demo. Three documents around
// every client session, displayed as numbered dots on a horizontal
// timeline. Auto-cycles every 4.5s through the three docs.
//
// Each dot's preview card shows a concrete snippet of that document
// so the viewer understands what they actually get: not just "we
// have a document" but "this is a 5-stat overview, this is a SOAP
// card with aftercare, this is an italic note that goes to the
// client."
//
// Used on Home in ribbon 3 (Client Intelligence) and inside the
// FeaturesV2 modal for feature 3.2.

import React, { useEffect, useRef, useState } from 'react';

const C = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  forestLight: '#2A5741',
  sage: '#4A6B54',
  sageBg: '#EEF3EE',
  gold: '#C9A84C',
  goldBg: '#FAF3DC',
  goldInk: '#92660E',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  red: '#B91C1C',
  redBg: '#FDF2F2',
  redInk: '#7F1D1D',
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

const DOTS = [
  {
    n: 1,
    color: C.gold,
    pillLabel: 'Intake',
    title: "Today's Intake",
    eyebrow: 'Before the session',
    body: 'What your client filled in today. Body map, all 8 preferences, conditions checked, every answer to your custom questions.',
    stat: { value: '8', label: 'preferences captured' },
    preview: 'intake',
  },
  {
    n: 2,
    color: C.sage,
    pillLabel: 'Pre-Session',
    title: 'Pre-Session Brief',
    eyebrow: 'Five minutes before',
    body: "Today's request, what changed since last visit, your plan from last time, patterns across every prior visit.",
    stat: { value: '5/5', label: 'visits show R shoulder' },
    preview: 'pre',
  },
  {
    n: 3,
    color: C.forest,
    pillLabel: 'Post-Session',
    title: 'Post-Session',
    eyebrow: 'After the session',
    body: 'Your archival record with SOAP and aftercare. Their warm summary with your note and a one-tap rebooking link.',
    stat: { value: '2', label: 'outputs from 1 session' },
    preview: 'post',
  },
];

// ─────────── Mini body silhouette ───────────

function MiniBody({ zones = [], heatmap = [], color = C.sage }) {
  return (
    <svg width="58" height="115" viewBox="0 0 170 310">
      <ellipse cx="85" cy="28" rx="20" ry="24" fill={C.creamAlt} stroke="#C8BFB0" strokeWidth="1.5" />
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill={C.creamAlt} stroke="#C8BFB0" strokeWidth="1.5" />
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill={C.creamAlt} stroke="#C8BFB0" strokeWidth="1.5" />
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill={C.creamAlt} stroke="#C8BFB0" strokeWidth="1.5" />
      {/* Plain focus marks */}
      {zones.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="14" fill={color + '38'} stroke={color} strokeWidth="2" />
          <circle cx={cx} cy={cy} r="6" fill={color} />
        </g>
      ))}
      {/* Heatmap zones with numbers inside */}
      {heatmap.map(([cx, cy, n], i) => (
        <g key={'h' + i}>
          <circle cx={cx} cy={cy} r={11 + (n / 5) * 7} fill={color} stroke={C.forest} strokeWidth="1.5" />
          <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="800" fontFamily={C.sans}>{n}</text>
        </g>
      ))}
    </svg>
  );
}

// ─────────── Per-dot previews ───────────

function IntakePreview() {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <MiniBody zones={[[112, 72], [102, 135]]} color={C.gold} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Chip color={C.forest} bg={C.forest + '15'} bold>Pressure 4/5</Chip>
        <Chip color={C.forest} bg={C.creamAlt}>R shoulder · lower back · glutes</Chip>
        <Chip color={C.redInk} bg={C.redBg}>Conditions: 3 flagged</Chip>
        <div style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic', lineHeight: 1.4, marginTop: 3, paddingTop: 6, borderTop: `1px dashed ${C.lineFaint}` }}>
          "Nightguard helping. Want to focus on lower back today."
        </div>
      </div>
    </div>
  );
}

function PrePreview() {
  const points = [2, 3, 3, 4, 4];
  const w = 88, h = 30;
  const min = 1.5, max = 4.5;
  const stepX = w / (points.length - 1);
  const ptsXY = points.map((v, i) => [i * stepX, h - ((v - min) / (max - min)) * (h - 6) - 3]);
  const pathD = ptsXY.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <MiniBody
        color={C.sage}
        heatmap={[[112, 72, 5], [85, 110, 4], [85, 135, 3]]}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{
          background: C.white, borderRadius: 8, padding: '6px 10px',
          border: `1px solid ${C.lineFaint}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Pressure</div>
            <div style={{ fontSize: 11.5, color: C.forest, fontWeight: 700, fontFamily: C.serif, lineHeight: 1 }}>2 → 4</div>
          </div>
          <svg width={w} height={h}>
            <path d={pathD} fill="none" stroke={C.sage} strokeWidth="2" strokeLinecap="round" />
            {ptsXY.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.5" fill={i === ptsXY.length - 1 ? C.sage : C.white} stroke={C.sage} strokeWidth="1.5" />
            ))}
          </svg>
        </div>
        <div style={{ fontSize: 10.5, color: C.ink, lineHeight: 1.4, paddingLeft: 10, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, top: 5, width: 4, height: 4, borderRadius: 2, background: C.gold }} />
          Plan from last: 3-week cadence, lumbar focus
        </div>
        <div style={{ fontSize: 10.5, color: C.ink, lineHeight: 1.4, paddingLeft: 10, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, top: 5, width: 4, height: 4, borderRadius: 2, background: C.sage }} />
          R shoulder requested 5 of 5 visits
        </div>
      </div>
    </div>
  );
}

function PostPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{
        background: C.white, borderRadius: 8, padding: '7px 10px',
        border: `1px solid ${C.lineFaint}`,
        borderLeft: `3px solid ${C.forest}`,
        display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap',
      }}>
        {['S', 'O', 'A'].map((l, i) => (
          <span key={i} style={{
            background: C.cream, color: C.forest, fontWeight: 700,
            fontSize: 11, padding: '2px 8px', borderRadius: 5,
            fontFamily: C.serif,
            border: `1px solid ${C.lineFaint}`,
          }}>{l}</span>
        ))}
        <span style={{
          background: C.sageBg, color: C.sage, fontWeight: 800,
          fontSize: 11, padding: '2px 8px', borderRadius: 5,
          fontFamily: C.serif,
          border: `1.5px solid ${C.sage}`,
        }}>P</span>
        <span style={{ fontSize: 9, color: C.inkSoft, marginLeft: 'auto', fontStyle: 'italic' }}>plan drives next visit</span>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            'Drink plenty of water today',
            'A warm Epsom salt bath',
            'Gentle stretching tonight',
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 13, height: 13, borderRadius: 7, background: C.sageBg, color: C.sage, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
              <span style={{ fontSize: 10.5, color: C.ink, lineHeight: 1.3 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{
        fontSize: 10.5, fontStyle: 'italic', color: C.ink, lineHeight: 1.45,
        background: C.goldBg, borderRadius: 7, padding: '6px 10px',
        borderLeft: `3px solid ${C.gold}`,
        fontFamily: C.serif,
      }}>
        "Sarah, today felt really good. Let's stretch to 3 weeks."
      </div>
    </div>
  );
}

function Chip({ children, color, bg, bold }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color,
      padding: '3px 9px', borderRadius: 12,
      fontSize: 10.5, fontWeight: bold ? 700 : 600,
      lineHeight: 1.2, width: 'fit-content',
    }}>{children}</span>
  );
}

// ────────── Main demo ──────────

export default function ThreeDotDocumentDemo() {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!autoplay) return;
    intervalRef.current = setInterval(() => {
      setActive(a => (a + 1) % DOTS.length);
    }, 4500);
    return () => clearInterval(intervalRef.current);
  }, [autoplay]);

  const dot = DOTS[active];

  function go(i) {
    setActive(i);
    setAutoplay(false);
  }

  return (
    <div style={{
      background: C.cream,
      borderRadius: 16,
      padding: '24px 22px 22px',
      fontFamily: C.sans,
      color: C.ink,
      border: `1px solid ${C.lineFaint}`,
      maxWidth: 540, margin: '0 auto',
    }}>
      {/* Eyebrow + headline */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.gold,
          textTransform: 'uppercase', letterSpacing: '1.6px', marginBottom: 6,
        }}>
          Three documents · One client journey
        </div>
        <h3 style={{
          fontFamily: C.serif, fontSize: 24, fontWeight: 500,
          color: C.forest, margin: 0, letterSpacing: '-0.4px', lineHeight: 1.15,
        }}>
          A complete record around every visit, <em style={{ color: C.sage, fontStyle: 'italic' }}>generated as it happens.</em>
        </h3>
      </div>

      {/* Dot timeline */}
      <div style={{ position: 'relative', padding: '0 18px', marginBottom: 18 }}>
        {/* Connector line */}
        <div style={{
          position: 'absolute', top: 21,
          left: 42, right: 42,
          height: 2,
          background: `linear-gradient(to right, ${C.gold} 0%, ${C.sage} 50%, ${C.forest} 100%)`,
          opacity: 0.5,
          zIndex: 0,
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          {DOTS.map((d, i) => {
            const isActive = i === active;
            return (
              <button
                key={i}
                onClick={() => go(i)}
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 7,
                }}
              >
                <span style={{
                  width: isActive ? 44 : 34, height: isActive ? 44 : 34,
                  borderRadius: '50%',
                  background: d.color,
                  color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isActive ? 18 : 14, fontWeight: 800,
                  fontFamily: C.serif,
                  boxShadow: isActive ? `0 0 0 7px ${d.color}28` : '0 1px 2px rgba(28,43,34,0.15)',
                  transition: 'all 0.35s ease',
                  border: `3px solid ${C.cream}`,
                }}>{d.n}</span>
                <span style={{
                  fontSize: 9.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? C.forest : C.inkSoft,
                  textTransform: 'uppercase', letterSpacing: '0.7px',
                  transition: 'all 0.25s',
                  whiteSpace: 'nowrap',
                }}>{d.pillLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active card */}
      <div
        key={active}
        style={{
          background: C.white,
          borderRadius: 14,
          padding: '16px 18px 16px',
          border: `1px solid ${C.lineFaint}`,
          borderTop: `3px solid ${dot.color}`,
          animation: 'bm3dotFade 0.5s ease',
          minHeight: 230,
        }}>
        <style>{`@keyframes bm3dotFade { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: none; } }`}</style>

        {/* Header row: eyebrow + headline stat */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <span style={{
              fontSize: 10, fontWeight: 700, color: dot.color,
              textTransform: 'uppercase', letterSpacing: '1px',
            }}>{dot.eyebrow}</span>
            <div style={{
              fontFamily: C.serif, fontSize: 18, fontWeight: 500,
              color: C.forest, letterSpacing: '-0.2px', marginTop: 1,
            }}>{dot.title}</div>
          </div>
          {dot.stat && (
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: C.serif, fontSize: 20, fontWeight: 600,
                color: dot.color, lineHeight: 1, letterSpacing: '-0.3px',
              }}>{dot.stat.value}</div>
              <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', marginTop: 2 }}>{dot.stat.label}</div>
            </div>
          )}
        </div>

        <p style={{
          fontSize: 12.5, color: C.ink, lineHeight: 1.55,
          margin: '0 0 12px',
        }}>{dot.body}</p>

        {/* Preview */}
        <div style={{ paddingTop: 12, borderTop: `1px dashed ${C.lineFaint}` }}>
          {dot.preview === 'intake' && <IntakePreview />}
          {dot.preview === 'pre' && <PrePreview />}
          {dot.preview === 'post' && <PostPreview />}
        </div>
      </div>

      {/* Footer hint */}
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: C.inkSoft, letterSpacing: '0.3px' }}>
        {autoplay ? 'Auto-cycling · tap a number to pause' : `Paused · viewing document ${active + 1} of 3`}
      </div>
    </div>
  );
}
