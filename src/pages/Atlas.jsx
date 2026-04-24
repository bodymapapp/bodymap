// src/pages/Atlas.jsx
// The Atlas, an editorial overview of every MyBodyMap capability.
// Intentionally feels like a printed field guide, not a software feature page.
// Hidden from top nav; linked from Features, Home, Footer, and shareable.

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

// ── Design tokens ────────────────────────────────────────────────────────
const INK = '#0D1F17';        // deep forest, used for text on cream
const INK_SOFT = '#2A5741';   // forest for headings
const CREAM = '#F7F1E3';      // warm paper
const CREAM_2 = '#EDE4CC';    // paper shadow tone
const GOLD = '#C9A84C';       // accent
const SAGE = '#6B9E80';
const MUTED = '#6B7280';

// ── Taxonomy, source of truth for every MyBodyMap feature ────────────────
// Numbers and IDs visible in the Atlas. Ordered by practice flow.
const CATEGORIES = [
  {
    id: '1',
    name: 'Find & Book',
    tagline: 'How new clients discover you and schedule their first session.',
    tilt: -2.2,
    subs: [
      { id: '1.1', name: 'Custom booking page' },
      { id: '1.2', name: 'Services catalog' },
      { id: '1.3', name: 'Availability & hours' },
      { id: '1.4', name: 'Deposits at booking' },
      { id: '1.5', name: 'Cal.com sync' },
      { id: '1.6', name: 'Blocked days' },
      { id: '1.7', name: 'Website embed' },
    ],
  },
  {
    id: '2',
    name: 'Know Your Client',
    tagline: 'Everything between booking and walking in the door.',
    tilt: 1.6,
    subs: [
      { id: '2.1', name: 'Visual body map intake' },
      { id: '2.2', name: 'Session preferences' },
      { id: '2.3', name: 'Signed waiver, bundled in' },
      { id: '2.4', name: 'Smart pre-fill on return' },
      { id: '2.5', name: 'Client notes & medical flags' },
    ],
  },
  {
    id: '3',
    name: 'Client Intelligence',
    tagline: 'Pattern recognition across visits. The core moat.',
    tilt: -1.4,
    subs: [
      { id: '3.1', name: 'Longitudinal heatmaps' },
      { id: '3.2', name: 'Full session history' },
      { id: '3.3', name: 'MyBodyMap AI chat' },
      { id: '3.4', name: 'Pattern detection' },
      { id: '3.5', name: 'Practice Pulse' },
    ],
  },
  {
    id: '4',
    name: 'Day-of-Session',
    tagline: "What the platform does during the hour you're working.",
    tilt: 2.4,
    subs: [
      { id: '4.1', name: "Today's schedule" },
      { id: '4.2', name: 'Pre-session brief' },
      { id: '4.3', name: 'Post-session SOAP notes' },
      { id: '4.4', name: 'Quick client lookup' },
      { id: '4.5', name: 'Mobile-first UX' },
    ],
  },
  {
    id: '5',
    name: 'Relationships',
    tagline: 'Turn first-timers into regulars. Keep regulars coming back.',
    tilt: -1.9,
    subs: [
      { id: '5.1', name: 'Automated reminders' },
      { id: '5.2', name: 'Post-session follow-up' },
      { id: '5.3', name: 'Lapsed client outreach' },
      { id: '5.4', name: 'Loyalty rewards' },
      { id: '5.5', name: '5-dimension feedback' },
    ],
  },
  {
    id: '6',
    name: 'Money & Protection',
    tagline: 'Get paid. Stay protected. Run a real business.',
    tilt: 1.2,
    subs: [
      { id: '6.1', name: 'Billing dashboard' },
      { id: '6.2', name: 'Gift cards' },
      { id: '6.3', name: 'Legally signed waivers' },
      { id: '6.4', name: 'Privacy & security' },
    ],
  },
  {
    id: '7',
    name: 'On Your Phone',
    tagline: 'The platform lives with you, quietly, everywhere.',
    tilt: -2.0,
    subs: [
      { id: '7.1', name: 'Install to home screen' },
      { id: '7.2', name: 'Push notifications' },
      { id: '7.3', name: 'Founding Therapist emails' },
      { id: '7.4', name: 'Refer and reward' },
      { id: '7.5', name: 'Switch in minutes' },
    ],
  },
];

// Count total capabilities (for the footer animated number)
const TOTAL_COUNT = CATEGORIES.reduce((sum, c) => sum + c.subs.length, 0);

// ── Illustrations, unique hand-drawn-feel SVG vignette per category ─────
function Illustration({ id, size = 56 }) {
  const stroke = INK_SOFT;
  const fill = 'none';
  const sw = 1.4;
  const common = { width: size, height: size, viewBox: '0 0 56 56', fill };
  switch (id) {
    case '1': // Calendar w/ circled date
      return (
        <svg {...common}>
          <rect x="8" y="12" width="40" height="34" rx="3" stroke={stroke} strokeWidth={sw} />
          <line x1="8" y1="22" x2="48" y2="22" stroke={stroke} strokeWidth={sw} />
          <line x1="18" y1="8" x2="18" y2="16" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="38" y1="8" x2="38" y2="16" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="28" cy="34" r="5" stroke={GOLD} strokeWidth="1.8" fill="none" />
        </svg>
      );
    case '2': // Body silhouette with map pin
      return (
        <svg {...common}>
          <circle cx="28" cy="16" r="5" stroke={stroke} strokeWidth={sw} />
          <path d="M20 28 Q28 22 36 28 L36 42 Q28 46 20 42 Z" stroke={stroke} strokeWidth={sw} fill="none" />
          <circle cx="33" cy="34" r="2.5" fill={GOLD} />
        </svg>
      );
    case '3': // Heatmap waves
      return (
        <svg {...common}>
          <path d="M8 20 Q14 14 20 20 T32 20 T44 20 T56 20" stroke={stroke} strokeWidth={sw} fill="none" />
          <path d="M8 30 Q14 24 20 30 T32 30 T44 30" stroke={GOLD} strokeWidth="1.6" fill="none" />
          <path d="M8 40 Q14 34 20 40 T32 40 T44 40 T56 40" stroke={stroke} strokeWidth={sw} fill="none" opacity="0.5" />
          <circle cx="20" cy="30" r="2" fill={GOLD} />
          <circle cx="32" cy="30" r="2" fill={GOLD} />
        </svg>
      );
    case '4': // Clock hands
      return (
        <svg {...common}>
          <circle cx="28" cy="28" r="18" stroke={stroke} strokeWidth={sw} />
          <line x1="28" y1="28" x2="28" y2="16" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <line x1="28" y1="28" x2="36" y2="32" stroke={GOLD} strokeWidth="2" strokeLinecap="round" />
          <circle cx="28" cy="28" r="1.5" fill={stroke} />
        </svg>
      );
    case '5': // Two hearts connected / return arrow
      return (
        <svg {...common}>
          <path d="M14 26 C14 22 18 20 21 22 C23 23 23 26 21 28 L14 34 L7 28 C5 26 5 23 7 22 C10 20 14 22 14 26 Z" transform="translate(10, 4)" stroke={stroke} strokeWidth={sw} fill="none" />
          <path d="M32 38 Q42 34 44 24" stroke={GOLD} strokeWidth="1.6" fill="none" strokeDasharray="2 3" />
          <path d="M42 22 L44 24 L42 28" stroke={GOLD} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case '6': // Shield with check
      return (
        <svg {...common}>
          <path d="M28 8 L42 14 V28 C42 38 36 44 28 48 C20 44 14 38 14 28 V14 Z" stroke={stroke} strokeWidth={sw} fill="none" />
          <path d="M22 28 L26 32 L34 22" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case '7': // Phone
      return (
        <svg {...common}>
          <rect x="18" y="8" width="20" height="40" rx="3" stroke={stroke} strokeWidth={sw} />
          <circle cx="28" cy="43" r="1.5" fill={stroke} />
          <line x1="24" y1="13" x2="32" y2="13" stroke={stroke} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
          <circle cx="33" cy="18" r="3" fill={GOLD} opacity="0.8" />
        </svg>
      );
    default:
      return null;
  }
}

// ── Animated counter ─────────────────────────────────────────────────────
function AnimatedCount({ target }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let started = false;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started) {
        started = true;
        const duration = 1400;
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{n}</span>;
}

// ── Polaroid Card ────────────────────────────────────────────────────────
function PolaroidCard({ cat, index }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setTimeout(() => setVisible(true), index * 80);
        obs.disconnect();
      }
    }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [index]);

  const tiltDeg = hovered ? 0 : cat.tilt;
  const lift = hovered ? -10 : 0;

  return (
    <article
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bm-atlas-card"
      style={{
        position: 'relative',
        background: `linear-gradient(168deg, ${CREAM} 0%, #F2EAD2 100%)`,
        borderRadius: 4,
        padding: '28px 26px 24px',
        minHeight: 320,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: hovered
          ? `0 30px 60px rgba(0,0,0,0.35), 0 12px 20px rgba(0,0,0,0.2)`
          : `0 12px 32px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.18)`,
        transform: `translateY(${visible ? lift : 40}px) rotate(${visible ? tiltDeg : tiltDeg + 6}deg) scale(${visible ? 1 : 0.96})`,
        opacity: visible ? 1 : 0,
        transition: 'transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.55s ease, box-shadow 0.35s ease',
        willChange: 'transform',
        cursor: 'default',
        // warm paper texture via radial gradients
        backgroundImage: `
          radial-gradient(circle at 18% 22%, rgba(255,255,255,0.45) 0%, transparent 40%),
          radial-gradient(circle at 82% 78%, rgba(168,140,78,0.08) 0%, transparent 45%),
          linear-gradient(168deg, ${CREAM} 0%, #F2EAD2 100%)
        `,
        border: `1px solid ${CREAM_2}`,
      }}
    >
      {/* Pushpin */}
      <div aria-hidden style={{
        position: 'absolute',
        top: -8, left: '50%', transform: 'translateX(-50%)',
        width: 14, height: 14, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, #D93B5C 0%, #A8253F 70%, #6E1629 100%)`,
        boxShadow: '0 3px 6px rgba(0,0,0,0.35), inset -1px -1px 2px rgba(0,0,0,0.25)',
        zIndex: 2,
      }} />

      {/* Top row: huge italic number + illustration */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          fontSize: 72,
          fontWeight: 400,
          color: INK_SOFT,
          lineHeight: 0.9,
          letterSpacing: '-0.04em',
          opacity: 0.9,
        }}>{cat.id}</div>
        <div style={{
          width: 60, height: 60,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${CREAM_2}`,
          flexShrink: 0,
        }}>
          <Illustration id={cat.id} size={44} />
        </div>
      </div>

      {/* Category name */}
      <h3 style={{
        fontFamily: 'Georgia, serif',
        fontSize: 22,
        fontWeight: 700,
        color: INK,
        margin: '0 0 6px',
        letterSpacing: '-0.01em',
        lineHeight: 1.15,
      }}>{cat.name}</h3>

      {/* Tagline */}
      <p style={{
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        fontSize: 13,
        color: MUTED,
        margin: '0 0 18px',
        lineHeight: 1.5,
      }}>{cat.tagline}</p>

      {/* Hairline rule */}
      <div style={{
        height: 1,
        background: `linear-gradient(to right, transparent, ${CREAM_2} 15%, ${CREAM_2} 85%, transparent)`,
        marginBottom: 14,
      }} />

      {/* Sub-features as small serial + name rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {cat.subs.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 10,
              color: GOLD,
              fontWeight: 700,
              minWidth: 22,
              letterSpacing: '0.04em',
            }}>{s.id}</span>
            <span style={{
              fontSize: 13,
              color: INK,
              fontWeight: 500,
              lineHeight: 1.4,
            }}>{s.name}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

// ── Main page ────────────────────────────────────────────────────────────
export default function Atlas() {
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
    // Set page title + meta for SEO/social sharing
    const prevTitle = document.title;
    document.title = 'The Atlas, Every MyBodyMap feature in one view';
    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content');
    if (meta) meta.setAttribute('content', `Every MyBodyMap capability, mapped. ${TOTAL_COUNT} features across 7 parts of your massage practice, booking, intake, client intelligence, retention, and more.`);
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc) meta.setAttribute('content', prevDesc);
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://www.mybodymap.app/atlas');
      const btn = document.getElementById('bm-atlas-copy');
      if (btn) {
        const old = btn.textContent;
        btn.textContent = '✓ Link copied';
        setTimeout(() => { btn.textContent = old; }, 1800);
      }
    } catch (e) {}
  };

  return (
    <div style={{ background: '#0B1A13', minHeight: '100vh', paddingTop: 64, position: 'relative', overflow: 'hidden' }}>
      <Nav />

      {/* Ambient gradient orb, drifts slowly behind content */}
      <div aria-hidden style={{
        position: 'absolute',
        top: '12%', left: '-10%',
        width: 520, height: 520,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(107,158,128,0.22) 0%, transparent 65%)`,
        filter: 'blur(40px)',
        animation: 'bmAtlasDrift1 32s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      <div aria-hidden style={{
        position: 'absolute',
        top: '55%', right: '-15%',
        width: 620, height: 620,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(201,168,76,0.14) 0%, transparent 65%)`,
        filter: 'blur(50px)',
        animation: 'bmAtlasDrift2 40s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Paper texture overlay, subtle noise */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 50% 40%, rgba(255,255,255,0.015) 0%, transparent 40%)`,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <style>{`
        @keyframes bmAtlasDrift1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(60px, 40px); }
        }
        @keyframes bmAtlasDrift2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-80px, -50px); }
        }
        @keyframes bmAtlasFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bm-atlas-hero > * { animation: bmAtlasFadeUp 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .bm-atlas-hero > *:nth-child(1) { animation-delay: 0.05s; }
        .bm-atlas-hero > *:nth-child(2) { animation-delay: 0.25s; }
        .bm-atlas-hero > *:nth-child(3) { animation-delay: 0.45s; }
        .bm-atlas-hero > *:nth-child(4) { animation-delay: 0.65s; }

        /* Mobile: less tilt, tighter grid */
        @media (max-width: 768px) {
          .bm-atlas-card {
            min-height: 280px !important;
          }
        }
      `}</style>

      {/* HERO */}
      <section style={{ position: 'relative', zIndex: 1, padding: 'clamp(80px, 14vw, 130px) 24px 60px', textAlign: 'center' }}>
        <div className="bm-atlas-hero" style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            fontFamily: '"Courier New", monospace',
            fontSize: 11,
            color: GOLD,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            padding: '8px 16px',
            border: `1px solid rgba(201,168,76,0.3)`,
            borderRadius: 2,
            marginBottom: 28,
          }}>
            The Atlas · Field Guide
          </div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(42px, 7vw, 86px)',
            fontWeight: 400,
            color: '#F7F1E3',
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            margin: '0 0 22px',
          }}>
            Every capability,<br/>
            <span style={{ fontStyle: 'italic', color: GOLD }}>mapped.</span>
          </h1>
          <p style={{
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontSize: 'clamp(17px, 2.3vw, 22px)',
            color: 'rgba(247,241,227,0.78)',
            lineHeight: 1.55,
            maxWidth: 640,
            margin: '0 auto 38px',
          }}>
            A field guide to MyBodyMap. Seven parts of your practice, from the first time a client taps "book" to the quiet text reminding them it's been a while.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={{
              background: GOLD,
              color: INK,
              padding: '14px 28px',
              borderRadius: 2,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: 'system-ui',
              letterSpacing: '0.02em',
              boxShadow: '0 8px 24px rgba(201,168,76,0.3)',
            }}>
              Start free →
            </Link>
            <button
              id="bm-atlas-copy"
              onClick={copyLink}
              style={{
                background: 'transparent',
                color: 'rgba(247,241,227,0.85)',
                padding: '14px 24px',
                borderRadius: 2,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'system-ui',
                border: '1px solid rgba(247,241,227,0.25)',
                cursor: 'pointer',
              }}
            >
              📎 Share the Atlas
            </button>
          </div>
        </div>
      </section>

      {/* THE CARDS, arranged as pinned Polaroids on a dark wall */}
      <section style={{ position: 'relative', zIndex: 1, padding: '40px 20px 100px' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'clamp(28px, 4vw, 48px)',
          rowGap: 'clamp(48px, 7vw, 80px)',
          padding: '20px 0',
        }}>
          {CATEGORIES.map((cat, i) => (
            <PolaroidCard key={cat.id} cat={cat} index={i} />
          ))}
        </div>
      </section>

      {/* COUNT + CLOSING LINE */}
      <section style={{ position: 'relative', zIndex: 1, padding: '60px 24px 100px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontSize: 'clamp(14px, 2vw, 17px)',
            color: 'rgba(247,241,227,0.55)',
            letterSpacing: '0.04em',
            marginBottom: 14,
          }}>
            And that's , 
          </div>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(64px, 11vw, 140px)',
            fontWeight: 400,
            color: GOLD,
            lineHeight: 0.9,
            letterSpacing: '-0.04em',
            marginBottom: 18,
          }}>
            <AnimatedCount target={TOTAL_COUNT} />
          </div>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(20px, 3vw, 28px)',
            color: '#F7F1E3',
            fontStyle: 'italic',
            marginBottom: 14,
          }}>
            capabilities.
          </div>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(18px, 2.4vw, 24px)',
            color: 'rgba(247,241,227,0.72)',
            marginBottom: 44,
          }}>
            One platform. One price.
          </div>

          {/* Final CTA, quiet, confident */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" style={{
              background: GOLD,
              color: INK,
              padding: '16px 34px',
              borderRadius: 2,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              fontFamily: 'system-ui',
              letterSpacing: '0.02em',
              boxShadow: '0 8px 24px rgba(201,168,76,0.3)',
            }}>
              Start free, 5 minutes →
            </Link>
            <Link to="/features" style={{
              background: 'transparent',
              color: 'rgba(247,241,227,0.85)',
              padding: '16px 28px',
              borderRadius: 2,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'system-ui',
              border: '1px solid rgba(247,241,227,0.25)',
              textDecoration: 'none',
            }}>
              See each feature in detail →
            </Link>
          </div>
          <p style={{
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'rgba(247,241,227,0.4)',
            marginTop: 36,
          }}>
            Free for a limited time for the first 100 therapists. A few seats left.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
