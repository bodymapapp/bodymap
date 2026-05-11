// src/components/demos/ThreeDotDocumentDemo.jsx
//
// Animated demonstration of the three-dot document system. Three
// numbered dots on a horizontal line, each representing one document
// in the client journey. Auto-cycles between them every 4.5 seconds,
// or tap a dot to jump.
//
// The preview card below the timeline morphs to show a stylized
// preview of each document:
//   Dot 1: Today's Intake - mini body diagram + preference chips
//   Dot 2: Pre-Session Brief - stats strip + pressure sparkline
//   Dot 3: Post-Session - SOAP letters + aftercare checks + heart
//
// Self-contained component, used on the Home page in the Client
// Intelligence ribbon (3) and inside the FeaturesV2 modal for 3.2.

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
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

const DOTS = [
  {
    n: 1,
    color: C.gold,
    title: "Today's Intake",
    eyebrow: 'Before the session',
    body: 'What your client filled in today. Page one body diagram with focus and avoid zones. Page two every answer they gave.',
    preview: 'intake',
  },
  {
    n: 2,
    color: C.sage,
    title: 'Pre-Session Brief',
    eyebrow: 'Five minutes before',
    body: "Today's request, plus what changed, plus your plan from last visit, plus patterns across all their visits.",
    preview: 'pre',
  },
  {
    n: 3,
    color: C.forest,
    title: 'Post-Session',
    eyebrow: 'After the session',
    body: 'Splits into two outputs. Your archival record with SOAP on top. Their warm summary with your note and aftercare.',
    preview: 'post',
  },
];

// ────────── Mini previews per dot ──────────

function MiniBody({ focus = [], color = C.sage }) {
  // Tiny body silhouette ~70x130 with focus dots
  return (
    <svg width="60" height="120" viewBox="0 0 170 310">
      <ellipse cx="85" cy="28" rx="20" ry="24" fill={C.creamAlt} stroke="#C8BFB0" strokeWidth="1.5" />
      <path d="M57 64 Q47 70 44 90 L40 155 Q40 162 48 162 L122 162 Q130 162 130 155 L126 90 Q123 70 113 64 Z" fill={C.creamAlt} stroke="#C8BFB0" strokeWidth="1.5" />
      <path d="M60 162 Q56 195 54 232 Q52 260 56 278 Q62 284 70 282 Q76 278 76 260 L78 162 Z" fill={C.creamAlt} stroke="#C8BFB0" strokeWidth="1.5" />
      <path d="M110 162 Q114 195 116 232 Q118 260 114 278 Q108 284 100 282 Q94 278 94 260 L92 162 Z" fill={C.creamAlt} stroke="#C8BFB0" strokeWidth="1.5" />
      {focus.map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="14" fill={color + '40'} stroke={color} strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r="6" fill={color} />
        </g>
      ))}
    </svg>
  );
}

function IntakePreview() {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <MiniBody focus={[[112, 72], [102, 135]]} color={C.gold} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Chip color={C.forest} bg={C.forest + '15'}>Pressure 4/5</Chip>
        <Chip color={C.forest} bg={C.creamAlt}>Goal: therapeutic</Chip>
        <Chip color={C.sage} bg={C.sageBg}>R shoulder · lower back</Chip>
        <div style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic', lineHeight: 1.4, marginTop: 2 }}>
          "Nightguard helping, want lower back today"
        </div>
      </div>
    </div>
  );
}

function PrePreview() {
  // Sparkline pressure 2,3,3,4,4
  const points = [2, 3, 3, 4, 4];
  const w = 110, h = 36;
  const min = 1.5, max = 4.5;
  const stepX = w / (points.length - 1);
  const ptsXY = points.map((v, i) => [i * stepX, h - ((v - min) / (max - min)) * (h - 6) - 3]);
  const pathD = ptsXY.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <Stat label="Visit" value="5" />
        <Stat label="Cadence" value="14d" />
        <Stat label="Status" value="On track" small />
      </div>
      <div style={{
        background: C.white, borderRadius: 10,
        padding: '8px 12px', border: `1px solid ${C.lineFaint}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Pressure 2→4</div>
        <svg width={w} height={h}>
          <path d={pathD} fill="none" stroke={C.sage} strokeWidth="2" strokeLinecap="round" />
          {ptsXY.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill={i === ptsXY.length - 1 ? C.sage : C.white} stroke={C.sage} strokeWidth="1.5" />
          ))}
        </svg>
      </div>
      <div style={{ fontSize: 11, color: C.ink, lineHeight: 1.45, paddingLeft: 10, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: 5, width: 4, height: 4, borderRadius: 2, background: C.gold }} />
        R shoulder requested 5 of 5 visits
      </div>
    </div>
  );
}

function PostPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        background: C.white, borderRadius: 10, padding: '8px 12px',
        border: `1px solid ${C.lineFaint}`,
        borderLeft: `3px solid ${C.forest}`,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        {['S', 'O', 'A', 'P'].map((l, i) => (
          <span key={i} style={{
            background: i === 3 ? C.sageBg : C.cream,
            color: C.forest, fontWeight: 700,
            fontSize: 11, padding: '3px 9px', borderRadius: 6,
            fontFamily: C.serif,
            border: i === 3 ? `1.5px solid ${C.sage}` : `1px solid ${C.lineFaint}`,
          }}>{l}</span>
        ))}
        <span style={{ fontSize: 9.5, color: C.inkSoft, marginLeft: 'auto' }}>+ aftercare</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {['Drink plenty of water today', 'A warm Epsom salt bath', 'Gentle stretching tonight'].map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 14, height: 14, borderRadius: 7, background: C.sageBg, color: C.sage, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
            <span style={{ fontSize: 11, color: C.ink, lineHeight: 1.3 }}>{t}</span>
          </div>
        ))}
      </div>
      <div style={{
        fontSize: 10, fontStyle: 'italic', color: C.ink, lineHeight: 1.4,
        background: C.goldBg, borderRadius: 8, padding: '6px 10px',
        borderLeft: `3px solid ${C.gold}`,
      }}>
        "Sarah, today felt really good..."
      </div>
    </div>
  );
}

function Chip({ children, color, bg }) {
  return (
    <span style={{
      display: 'inline-block', background: bg, color,
      padding: '3px 9px', borderRadius: 12,
      fontSize: 10.5, fontWeight: 600, lineHeight: 1.2,
      width: 'fit-content',
    }}>{children}</span>
  );
}

function Stat({ label, value, small }) {
  return (
    <div style={{
      flex: 1, background: C.white, borderRadius: 8,
      padding: '6px 10px', border: `1px solid ${C.lineFaint}`,
    }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
      <div style={{
        fontSize: small ? 11 : 14, fontWeight: 600, color: C.forest,
        fontFamily: C.serif, lineHeight: 1, marginTop: 2,
      }}>{value}</div>
    </div>
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
      padding: '28px 22px 24px',
      fontFamily: C.sans,
      color: C.ink,
      border: `1px solid ${C.lineFaint}`,
      maxWidth: 520, margin: '0 auto',
    }}>
      {/* Eyebrow */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.gold,
        textTransform: 'uppercase', letterSpacing: '1.4px',
        textAlign: 'center', marginBottom: 6,
      }}>
        Three documents · One client journey
      </div>
      <h3 style={{
        fontFamily: C.serif, fontSize: 22, fontWeight: 500,
        color: C.forest, margin: '0 0 22px',
        textAlign: 'center', letterSpacing: '-0.3px', lineHeight: 1.15,
      }}>
        The three-dot document system
      </h3>

      {/* Dot timeline */}
      <div style={{ position: 'relative', padding: '0 14px', marginBottom: 22 }}>
        {/* Connector line */}
        <div style={{
          position: 'absolute', top: 19,
          left: 32, right: 32,
          height: 2,
          background: `linear-gradient(to right, ${C.gold} 0%, ${C.sage} 50%, ${C.forest} 100%)`,
          opacity: 0.4,
          zIndex: 0,
        }} />
        {/* Dots */}
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
                  gap: 6,
                }}
              >
                <span style={{
                  width: isActive ? 40 : 32, height: isActive ? 40 : 32,
                  borderRadius: '50%',
                  background: d.color,
                  color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isActive ? 17 : 14, fontWeight: 800,
                  fontFamily: C.serif,
                  boxShadow: isActive ? `0 0 0 6px ${d.color}25` : '0 1px 2px rgba(28,43,34,0.15)',
                  transition: 'all 0.35s ease',
                  border: `3px solid ${C.cream}`,
                }}>{d.n}</span>
                <span style={{
                  fontSize: 9.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? C.forest : C.inkSoft,
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                  transition: 'all 0.25s',
                  whiteSpace: 'nowrap',
                }}>{d.title.replace("Today's ", '').replace('Pre-Session ', 'Pre-').replace('Post-', 'Post')}</span>
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
          padding: '18px 18px 16px',
          border: `1px solid ${C.lineFaint}`,
          borderTop: `3px solid ${dot.color}`,
          animation: 'bm3dotFade 0.5s ease',
          minHeight: 224,
        }}>
        <style>{`@keyframes bm3dotFade { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: none; } }`}</style>

        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: dot.color,
            textTransform: 'uppercase', letterSpacing: '1px',
          }}>{dot.eyebrow}</span>
        </div>
        <div style={{
          fontFamily: C.serif, fontSize: 19, fontWeight: 500,
          color: C.forest, margin: '0 0 10px',
          letterSpacing: '-0.2px',
        }}>{dot.title}</div>
        <p style={{
          fontSize: 13, color: C.ink, lineHeight: 1.55,
          margin: '0 0 14px',
        }}>{dot.body}</p>

        {/* Preview */}
        <div style={{ paddingTop: 12, borderTop: `1px dashed ${C.lineFaint}` }}>
          {dot.preview === 'intake' && <IntakePreview />}
          {dot.preview === 'pre' && <PrePreview />}
          {dot.preview === 'post' && <PostPreview />}
        </div>
      </div>

      {/* Footer hint */}
      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 10.5, color: C.inkSoft }}>
        {autoplay ? 'Auto-cycling · tap a dot to pause' : 'Paused · tap any dot'}
      </div>
    </div>
  );
}
