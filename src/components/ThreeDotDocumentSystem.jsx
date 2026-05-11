// src/components/ThreeDotDocumentSystem.jsx
//
// Marketing section explaining the three-dot document system.
// Dropped into Home, Features, and Why MyBodyMap so the value
// prop is consistent across surfaces.
//
// Three dots = three documents around one session: intake (before),
// pre-session brief (synthesis), post-session (after, splits into
// therapist record + client summary).
//
// Design language matches the rest of MyBodyMap: cream background,
// forest dark, sage and gold accents, Fraunces for the headline,
// Inter for body. Mobile-first.

import React from 'react';
import { Link } from 'react-router-dom';

const T = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  sage: '#4A6B54',
  gold: '#C9A84C',
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
    color: T.gold,
    name: 'Today\'s Intake',
    eyebrow: 'Before the session',
    body: 'What your client filled in today. Page one, body diagram with focus and avoid zones. Page two, every answer they gave. Print it or read it on your phone.',
    bullets: [
      'Front and back body, tap to mark',
      'Pressure, goal, music, lighting, all 8 preferences',
      'Conditions and any flag, surfaced at the top',
    ],
  },
  {
    n: 2,
    color: T.sage,
    name: 'Pre-Session Brief',
    eyebrow: 'Five minutes before',
    body: 'Today\'s request, plus what changed since last visit, plus the plan you wrote down last time, plus patterns across all their visits. The document a doctor would call a chart, except useful.',
    bullets: [
      'What changed since last visit',
      'Your plan from last visit, surfaced',
      'Patterns that change how you treat them',
    ],
  },
  {
    n: 3,
    color: T.forest,
    name: 'Post-Session',
    eyebrow: 'After the session',
    body: 'Splits into two outputs. Your archival record with SOAP on top. Their warm summary with your note and aftercare, sent automatically.',
    bullets: [
      'SOAP notes anchor the record',
      'Aftercare checklist, one tap each',
      'Client summary with rebooking link',
    ],
  },
];

export default function ThreeDotDocumentSystem({ variant = 'full' }) {
  // variant 'full' includes headline + bullets. 'compact' is just the
  // three dots row (used on FeaturesV2 above the ribbons).

  return (
    <section style={{
      background: T.cream,
      padding: variant === 'compact' ? '40px 20px' : '72px 20px',
      fontFamily: T.sans,
      color: T.ink,
    }}>
      <style>{`
        .bm-3dot-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .bm-3dot-connector {
          position: absolute;
          top: 18px;
          left: 16.66%;
          right: 16.66%;
          height: 2px;
          background: linear-gradient(to right, ${T.gold} 0%, ${T.sage} 50%, ${T.forest} 100%);
          opacity: 0.4;
          z-index: 0;
        }
        @media (max-width: 760px) {
          .bm-3dot-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .bm-3dot-connector { display: none; }
        }
      `}</style>

      {variant === 'full' && (
        <div style={{ maxWidth: 760, margin: '0 auto 48px', textAlign: 'center' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: T.gold,
            textTransform: 'uppercase', letterSpacing: '1.4px',
            marginBottom: 14,
          }}>
            The MyBodyMap document system
          </div>
          <h2 style={{
            fontFamily: T.serif, fontSize: 'clamp(28px, 5vw, 44px)',
            fontWeight: 500, color: T.forest, margin: '0 0 14px',
            letterSpacing: '-0.5px', lineHeight: 1.15,
          }}>
            Three documents. <em style={{ color: T.sage, fontStyle: 'italic' }}>One client journey.</em>
          </h2>
          <p style={{
            fontSize: 16, color: T.ink, lineHeight: 1.6,
            margin: '0 auto', maxWidth: 580,
          }}>
            Minimal time from you. Maximum insight per visit. A complete record around every client, generated as they fill in the intake, walk in the door, and leave the room.
          </p>
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto' }}>
        <div className="bm-3dot-connector" />
        <div className="bm-3dot-grid">
          {DOTS.map(dot => (
            <article key={dot.n} style={{
              position: 'relative',
              background: T.white,
              borderRadius: 16,
              padding: '28px 22px 22px',
              border: `1px solid ${T.lineFaint}`,
              boxShadow: '0 2px 8px rgba(28,43,34,0.05)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1,
            }}>
              {/* Numbered dot */}
              <div style={{
                position: 'absolute',
                top: -18,
                left: 24,
                width: 36, height: 36,
                borderRadius: 18,
                background: dot.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16, fontWeight: 800,
                fontFamily: T.serif,
                boxShadow: '0 2px 6px rgba(28,43,34,0.15)',
                border: `3px solid ${T.cream}`,
              }}>
                {dot.n}
              </div>

              <div style={{
                fontSize: 11, fontWeight: 700, color: T.inkSoft,
                textTransform: 'uppercase', letterSpacing: '0.9px',
                marginTop: 14, marginBottom: 6,
              }}>{dot.eyebrow}</div>

              <h3 style={{
                fontFamily: T.serif, fontSize: 22, fontWeight: 500,
                color: T.forest, margin: '0 0 12px',
                letterSpacing: '-0.3px',
              }}>{dot.name}</h3>

              <p style={{
                fontSize: 14, color: T.ink, lineHeight: 1.6,
                margin: '0 0 16px',
              }}>{dot.body}</p>

              {variant === 'full' && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {dot.bullets.map((b, i) => (
                    <li key={i} style={{
                      fontSize: 13, color: T.ink, lineHeight: 1.5,
                      paddingLeft: 18, position: 'relative',
                    }}>
                      <span style={{
                        position: 'absolute', left: 0, top: 7,
                        width: 6, height: 6, borderRadius: 3,
                        background: dot.color,
                      }} />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        {variant === 'full' && (
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <Link to="/signup" style={{
              display: 'inline-block',
              background: T.forest, color: 'white',
              padding: '13px 30px', borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              textDecoration: 'none',
              fontFamily: T.sans,
              letterSpacing: '0.3px',
            }}>Start free →</Link>
            <div style={{
              marginTop: 12, fontSize: 12, color: T.inkSoft,
              fontStyle: 'italic',
            }}>
              Free for the first 100 founding therapists.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
