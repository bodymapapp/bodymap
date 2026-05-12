// src/lib/giftCardDesigns.js
//
// Six gift card design templates. Each design has a distinct emotional
// purpose: birthday joy, anniversary romance, thank-you warmth,
// sympathy gentleness, just-because generic, holiday festivity.
//
// Designs share the same data slots (amount, recipient, purchaser,
// message, code, image, brand_message, business_name) but differ in:
//   - eyebrow text and emoji
//   - greeting line ("Dear" vs "Happy Birthday" vs "Thank you" etc)
//   - typography emphasis
//   - decorative elements (botanical, confetti, snowflake, etc)
//
// Colors come from the theme palette (giftCardThemes.js). So six
// designs × six themes = 36 visual variations the therapist can choose
// from, plus their own per-card image and message text.
//
// To add a design: add an entry to DESIGNS and a render entry to
// the decoration switch in renderDecorations(). To rename a design,
// only change the label; keep the key the same since gift_certificates
// rows reference it.

import React from 'react';
import { getTheme } from './giftCardThemes';

export const DESIGNS = {
  'just-because': {
    label: 'Just Because',
    description: 'Botanical, signature MyBodyMap',
    eyebrow: '♡ A gift for you',
    greeting: (recipient) => recipient ? `Dear ${recipient},` : 'For someone special,',
    closingLine: null,
    decorationStyle: 'botanical',
    decorationCount: 2,
    headlineStyle: 'italic-serif',
  },
  'birthday': {
    label: 'Birthday',
    description: 'Festive, joyful',
    eyebrow: '🎂 A birthday gift',
    greeting: (recipient) => recipient ? `Happy Birthday, ${recipient}!` : 'Happy Birthday!',
    closingLine: 'A whole hour of care, just for you this year.',
    decorationStyle: 'confetti',
    decorationCount: 14,
    headlineStyle: 'bold-serif',
  },
  'anniversary': {
    label: 'Anniversary',
    description: 'Romantic, celebratory',
    eyebrow: '♥ Celebrating you',
    greeting: (recipient) => recipient ? `For ${recipient},` : 'For your special day,',
    closingLine: 'On this beautiful day, time to be cared for.',
    decorationStyle: 'hearts',
    decorationCount: 5,
    headlineStyle: 'italic-serif',
  },
  'thank-you': {
    label: 'Thank You',
    description: 'Calm gratitude',
    eyebrow: '🙏 Thank you',
    greeting: (recipient) => recipient ? `${recipient},` : 'Thank you,',
    closingLine: 'For everything you do. This is for you.',
    decorationStyle: 'minimal-dots',
    decorationCount: 6,
    headlineStyle: 'script-serif',
  },
  'sympathy': {
    label: 'Sympathy',
    description: 'Restful, gentle',
    eyebrow: '🕊 Thinking of you',
    greeting: (recipient) => recipient ? `${recipient},` : 'Thinking of you,',
    closingLine: 'A moment of peace, for whenever you need it.',
    decorationStyle: 'wave',
    decorationCount: 1,
    headlineStyle: 'gentle-serif',
  },
  'holiday': {
    label: 'Holiday',
    description: 'Seasonal warmth',
    eyebrow: '✨ Season\'s Greetings',
    greeting: (recipient) => recipient ? `Dear ${recipient},` : 'Season\'s Greetings,',
    closingLine: 'The gift of rest, for this season of giving.',
    decorationStyle: 'snowflakes',
    decorationCount: 8,
    headlineStyle: 'bold-serif',
  },
};

export const ORDERED_DESIGN_KEYS = [
  'just-because', 'birthday', 'anniversary', 'thank-you', 'sympathy', 'holiday',
];

export function getDesign(key) {
  return DESIGNS[key] || DESIGNS['just-because'];
}

// Resolve effective theme/image/message for a gift cert row by
// falling back to the therapist's defaults when the per-card column
// is null. Used by every render surface.
export function resolveCardBranding(cert, therapist) {
  return {
    design: getDesign(cert?.design_template || 'just-because'),
    designKey: cert?.design_template || 'just-because',
    theme: getTheme(cert?.theme || therapist?.gift_card_theme),
    themeKey: cert?.theme || therapist?.gift_card_theme || 'rose',
    imageUrl: cert?.card_image_url || therapist?.photo_url || null,
    brandMessage: cert?.card_brand_message || therapist?.gift_card_message || null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Decoration SVGs
// ─────────────────────────────────────────────────────────────────────
// Each style returns an array of SVG elements rendered as positioned
// absolute decorations on the card. They use the theme's accent color
// so they tint with the chosen palette.

export function renderDecorationsReact(designKey, theme, opts = {}) {
  const { compact = false } = opts;
  const design = getDesign(designKey);
  const style = design.decorationStyle;
  const count = design.decorationCount;
  const accent = theme.accent;
  const accentDeep = theme.accentDeep;
  const scale = compact ? 0.7 : 1;

  if (style === 'botanical') {
    return [
      <Botanical key="b1" color={accent} style={{ position: 'absolute', top: -18 * scale, right: -18 * scale, transform: `rotate(25deg) scale(${scale})` }} opacity={0.4} />,
      <Botanical key="b2" color={accent} style={{ position: 'absolute', bottom: -22 * scale, left: -22 * scale, transform: `rotate(-145deg) scale(${scale * 0.7})` }} opacity={0.3} />,
    ];
  }
  if (style === 'confetti') {
    const seeds = confettiSeeds(count);
    return seeds.map((s, i) => (
      <div key={`c${i}`} style={{
        position: 'absolute',
        top: `${s.top}%`,
        left: `${s.left}%`,
        width: s.size * scale,
        height: s.size * scale,
        background: i % 2 === 0 ? accent : accentDeep,
        borderRadius: s.shape === 'circle' ? '50%' : '2px',
        transform: `rotate(${s.rotate}deg)`,
        opacity: 0.7,
        pointerEvents: 'none',
      }} />
    ));
  }
  if (style === 'hearts') {
    const seeds = heartSeeds(count);
    return seeds.map((s, i) => (
      <svg key={`h${i}`} viewBox="0 0 24 24"
        style={{ position: 'absolute', top: `${s.top}%`, left: `${s.left}%`, width: s.size * scale, height: s.size * scale, opacity: 0.35, pointerEvents: 'none' }}>
        <path d="M12 21 C5 16, 2 12, 2 8 C2 5, 4 3, 7 3 C9 3, 11 4, 12 6 C13 4, 15 3, 17 3 C20 3, 22 5, 22 8 C22 12, 19 16, 12 21 Z" fill={i % 2 === 0 ? accent : accentDeep} />
      </svg>
    ));
  }
  if (style === 'minimal-dots') {
    const seeds = dotSeeds(count);
    return seeds.map((s, i) => (
      <div key={`d${i}`} style={{
        position: 'absolute',
        top: `${s.top}%`,
        left: `${s.left}%`,
        width: 4 * scale,
        height: 4 * scale,
        background: accent,
        borderRadius: '50%',
        opacity: 0.5,
        pointerEvents: 'none',
      }} />
    ));
  }
  if (style === 'wave') {
    return [
      <svg key="wave" viewBox="0 0 100 20"
        style={{ position: 'absolute', bottom: 8 * scale, left: '50%', transform: `translateX(-50%) scale(${scale})`, width: '60%', height: 20 * scale, opacity: 0.4, pointerEvents: 'none' }}>
        <path d="M0 10 Q25 0, 50 10 T100 10" fill="none" stroke={accent} strokeWidth="1.5" />
        <path d="M0 14 Q25 4, 50 14 T100 14" fill="none" stroke={accentDeep} strokeWidth="1" opacity="0.5" />
      </svg>,
    ];
  }
  if (style === 'snowflakes') {
    const seeds = snowflakeSeeds(count);
    return seeds.map((s, i) => (
      <svg key={`s${i}`} viewBox="0 0 24 24"
        style={{ position: 'absolute', top: `${s.top}%`, left: `${s.left}%`, width: s.size * scale, height: s.size * scale, opacity: 0.45, pointerEvents: 'none' }}>
        <g stroke={i % 2 === 0 ? accent : accentDeep} strokeWidth="1.4" strokeLinecap="round" fill="none">
          <line x1="12" y1="2" x2="12" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
          <line x1="9" y1="2" x2="12" y2="5" />
          <line x1="15" y1="2" x2="12" y2="5" />
          <line x1="9" y1="22" x2="12" y2="19" />
          <line x1="15" y1="22" x2="12" y2="19" />
        </g>
      </svg>
    ));
  }
  return [];
}

// Decoration HTML strings for use inside email templates (no React).
// Returned as a single HTML string of absolutely-positioned divs/svgs.
// Email clients are picky about SVG, so this is conservative.
export function renderDecorationsEmailHTML(designKey, theme) {
  const design = getDesign(designKey);
  const style = design.decorationStyle;
  const accent = theme.accent;
  const accentDeep = theme.accentDeep;

  if (style === 'confetti') {
    const seeds = confettiSeeds(design.decorationCount);
    return seeds.map((s, i) => {
      const color = i % 2 === 0 ? accent : accentDeep;
      const radius = s.shape === 'circle' ? '50%' : '2px';
      return `<div style="position:absolute;top:${s.top}%;left:${s.left}%;width:${s.size}px;height:${s.size}px;background:${color};border-radius:${radius};opacity:0.7;"></div>`;
    }).join('');
  }
  if (style === 'hearts') {
    const seeds = heartSeeds(design.decorationCount);
    return seeds.map((s, i) => {
      const color = i % 2 === 0 ? accent : accentDeep;
      return `<div style="position:absolute;top:${s.top}%;left:${s.left}%;font-size:${s.size}px;color:${color};opacity:0.35;line-height:1;">♥</div>`;
    }).join('');
  }
  if (style === 'minimal-dots') {
    const seeds = dotSeeds(design.decorationCount);
    return seeds.map((s, i) => (
      `<div style="position:absolute;top:${s.top}%;left:${s.left}%;width:4px;height:4px;background:${accent};border-radius:50%;opacity:0.5;"></div>`
    )).join('');
  }
  if (style === 'snowflakes') {
    const seeds = snowflakeSeeds(design.decorationCount);
    return seeds.map((s, i) => {
      const color = i % 2 === 0 ? accent : accentDeep;
      return `<div style="position:absolute;top:${s.top}%;left:${s.left}%;font-size:${s.size}px;color:${color};opacity:0.55;line-height:1;">✻</div>`;
    }).join('');
  }
  if (style === 'wave') {
    return `<div style="position:absolute;bottom:10px;left:20%;right:20%;height:2px;border-top:1.5px solid ${accent};opacity:0.4;border-radius:50%;"></div>`;
  }
  if (style === 'botanical') {
    // Emoji fallback for email since SVG paths render unreliably
    return `
      <div style="position:absolute;top:6px;right:10px;font-size:24px;opacity:0.35;color:${accent};">❋</div>
      <div style="position:absolute;bottom:6px;left:10px;font-size:20px;opacity:0.3;color:${accent};">❋</div>
    `;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────
// Seeded random-looking positions
// ─────────────────────────────────────────────────────────────────────
// Fixed positions so the design looks intentional, not random per
// render. Deterministic positions per decoration count.

function confettiSeeds(n) {
  const all = [
    { top: 6, left: 8, size: 8, shape: 'square', rotate: 12 },
    { top: 10, left: 78, size: 6, shape: 'circle', rotate: 0 },
    { top: 15, left: 35, size: 5, shape: 'square', rotate: 28 },
    { top: 4, left: 55, size: 7, shape: 'circle', rotate: 0 },
    { top: 22, left: 18, size: 5, shape: 'circle', rotate: 0 },
    { top: 8, left: 90, size: 6, shape: 'square', rotate: 45 },
    { top: 28, left: 6, size: 6, shape: 'circle', rotate: 0 },
    { top: 35, left: 82, size: 5, shape: 'square', rotate: 18 },
    { top: 75, left: 14, size: 6, shape: 'circle', rotate: 0 },
    { top: 80, left: 65, size: 5, shape: 'circle', rotate: 0 },
    { top: 90, left: 8, size: 5, shape: 'square', rotate: 32 },
    { top: 92, left: 88, size: 6, shape: 'circle', rotate: 0 },
    { top: 60, left: 92, size: 5, shape: 'square', rotate: 8 },
    { top: 88, left: 45, size: 7, shape: 'circle', rotate: 0 },
  ];
  return all.slice(0, n);
}

function heartSeeds(n) {
  const all = [
    { top: 4, left: 6, size: 18 },
    { top: 8, left: 86, size: 14 },
    { top: 84, left: 8, size: 16 },
    { top: 78, left: 88, size: 12 },
    { top: 92, left: 48, size: 14 },
  ];
  return all.slice(0, n);
}

function dotSeeds(n) {
  const all = [
    { top: 8, left: 10 },
    { top: 10, left: 88 },
    { top: 88, left: 14 },
    { top: 92, left: 82 },
    { top: 35, left: 95 },
    { top: 65, left: 4 },
  ];
  return all.slice(0, n);
}

function snowflakeSeeds(n) {
  const all = [
    { top: 6, left: 8, size: 18 },
    { top: 12, left: 82, size: 14 },
    { top: 28, left: 24, size: 12 },
    { top: 22, left: 70, size: 16 },
    { top: 78, left: 14, size: 14 },
    { top: 84, left: 60, size: 18 },
    { top: 70, left: 88, size: 12 },
    { top: 92, left: 30, size: 14 },
  ];
  return all.slice(0, n);
}

// Botanical SVG sprig (used in just-because design)
function Botanical({ color = '#F9A8B4', opacity = 0.5, style }) {
  return (
    <svg viewBox="0 0 60 60" width={56} height={56} style={style}>
      <g opacity={opacity}>
        <path d="M30 8 C 30 28, 22 38, 30 52 C 38 38, 30 28, 30 8 Z" fill={color} />
        <path d="M30 20 C 24 22, 20 28, 22 36" fill="none" stroke={color} strokeWidth="1.2" />
        <path d="M30 28 C 36 30, 40 36, 38 44" fill="none" stroke={color} strokeWidth="1.2" />
        <ellipse cx="22" cy="28" rx="3.5" ry="2" fill={color} opacity="0.85" transform="rotate(-30 22 28)" />
        <ellipse cx="38" cy="36" rx="3.5" ry="2" fill={color} opacity="0.85" transform="rotate(30 38 36)" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Unified React card renderer
// ─────────────────────────────────────────────────────────────────────
// One function that knows how to render every design. Varies the
// eyebrow, greeting, decorations, headline emphasis based on the
// design metadata. Used by both the dashboard preview and the
// per-card create form preview.

export function renderCardReact({
  designKey,
  theme,
  imageUrl,
  brandMessage,
  amount,
  recipient,
  purchaser,
  message,
  code,
  businessName,
  compact = false,
}) {
  const design = getDesign(designKey);
  const decorations = renderDecorationsReact(designKey, theme, { compact });

  // Greeting size varies by design. Birthday and Holiday want a more
  // emphatic headline; Sympathy wants softer/smaller. Use a multiplier.
  const headlineSize = design.headlineStyle === 'bold-serif'
    ? (compact ? 22 : 28)
    : design.headlineStyle === 'gentle-serif'
      ? (compact ? 17 : 22)
      : (compact ? 20 : 26);

  const headlineWeight = design.headlineStyle === 'gentle-serif' ? 500 : 700;
  const headlineFontStyle = design.headlineStyle === 'italic-serif' || design.headlineStyle === 'script-serif' ? 'italic' : 'normal';

  return (
    <div style={{
      position: 'relative',
      background: theme.bgGradient,
      borderRadius: 20,
      padding: compact ? '22px 22px 20px' : '30px 26px 26px',
      border: `1.5px solid ${theme.accent}33`,
      overflow: 'hidden',
      boxShadow: `0 4px 20px ${theme.accent}26, 0 1px 3px rgba(0,0,0,0.04)`,
      minHeight: compact ? 0 : 280,
    }}>
      {/* Design-specific decorations layered behind the content */}
      {decorations}

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Top row: eyebrow + therapist image (if any) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: compact ? 6 : 10,
        }}>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: compact ? 10 : 11,
            fontWeight: 600,
            color: theme.accent,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}>
            {design.eyebrow}
          </div>
          {imageUrl && (
            <img src={imageUrl} alt={businessName || ''}
              style={{
                width: compact ? 36 : 46,
                height: compact ? 36 : 46,
                borderRadius: '50%',
                objectFit: 'cover',
                border: `2px solid ${theme.accent}66`,
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              }}
            />
          )}
        </div>

        {/* Greeting line (changes per design) */}
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: headlineSize,
          fontWeight: headlineWeight,
          fontStyle: headlineFontStyle,
          color: theme.ink,
          marginBottom: compact ? 6 : 10,
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
        }}>
          {design.greeting(recipient)}
        </div>

        {/* Amount */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          marginBottom: compact ? 10 : 16,
        }}>
          <span style={{
            fontFamily: 'Georgia, serif',
            fontSize: compact ? 13 : 15,
            color: theme.inkSoft,
            fontStyle: 'italic',
          }}>Worth</span>
          <span style={{
            fontFamily: 'Georgia, serif',
            fontSize: compact ? 32 : 42,
            fontWeight: 700,
            color: theme.accentDeep,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>${typeof amount === 'number' ? amount.toFixed(0) : amount}</span>
          <span style={{
            fontSize: compact ? 11 : 12,
            color: theme.inkSoft,
            fontWeight: 600,
          }}>of care</span>
        </div>

        {/* Per-purchase message (what the GIVER wrote) */}
        {message && (
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: compact ? 13 : 14,
            color: theme.ink,
            fontStyle: 'italic',
            lineHeight: 1.55,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.55)',
            borderLeft: `2.5px solid ${theme.accent}`,
            borderRadius: '4px 12px 12px 4px',
            marginBottom: compact ? 8 : 12,
          }}>
            "{message}"
          </div>
        )}

        {/* Design-specific closing line (only some designs have one) */}
        {design.closingLine && (
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: compact ? 12 : 13,
            color: theme.inkSoft,
            fontStyle: 'italic',
            lineHeight: 1.5,
            marginBottom: compact ? 8 : 12,
          }}>
            {design.closingLine}
          </div>
        )}

        {/* Therapist's brand message (free-form, default or per-card) */}
        {brandMessage && (
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: compact ? 12 : 13,
            color: theme.inkSoft,
            lineHeight: 1.45,
            marginBottom: compact ? 8 : 12,
            paddingLeft: 2,
          }}>
            {brandMessage}
          </div>
        )}

        {/* From */}
        {purchaser && (
          <div style={{
            fontSize: compact ? 12 : 13,
            color: theme.inkSoft,
            marginBottom: compact ? 10 : 14,
          }}>
            With love, <span style={{
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 600,
              color: theme.ink,
            }}>{purchaser}</span>
          </div>
        )}

        {/* Code + business name footer */}
        <div style={{
          marginTop: compact ? 10 : 16,
          paddingTop: compact ? 10 : 14,
          borderTop: `1px dashed ${theme.accent}4D`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{
              fontSize: 9,
              color: theme.inkSoft,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}>Redemption code</div>
            <code style={{
              fontSize: compact ? 13 : 15,
              fontWeight: 700,
              color: theme.accentDeep,
              letterSpacing: '0.08em',
              fontFamily: 'ui-monospace, Menlo, monospace',
            }}>{code}</code>
          </div>
          {businessName && (
            <div style={{
              fontSize: compact ? 11 : 12,
              color: theme.inkSoft,
              fontWeight: 600,
            }}>{businessName}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Compact thumbnail card
// ─────────────────────────────────────────────────────────────────────
// Small card preview for the gallery grid on /dashboard/gifts. Shows
// just enough to identify the gift card (recipient, amount, design icon
// + theme color, status badge). Click expands to the full card in a
// modal. Designed to fit ~200-240px wide cells in a responsive grid.

export function renderCardThumbnailReact({
  designKey,
  theme,
  amount,
  recipient,
  status,
  redeemedAt,
}) {
  const design = getDesign(designKey);
  // Small decoration count so the thumbnail doesn't get visually noisy.
  // Override the design's normal count via a one-off call here.
  const isRedeemed = status === 'redeemed' || !!redeemedAt;
  const isCancelled = status === 'cancelled';

  return (
    <div style={{
      position: 'relative',
      background: theme.bgGradient,
      borderRadius: 14,
      padding: '14px 14px',
      border: `1.5px solid ${theme.accent}33`,
      overflow: 'hidden',
      minHeight: 140,
      boxShadow: `0 1px 3px rgba(28,43,34,0.06), 0 4px 12px ${theme.accent}1A`,
      cursor: 'pointer',
      transition: 'transform 0.15s, box-shadow 0.15s',
      opacity: isCancelled ? 0.55 : 1,
    }}>
      {/* Status badge top-right */}
      {(isRedeemed || isCancelled) && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 9, fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 999,
          background: isCancelled ? '#FEE2E2' : '#D1FAE5',
          color: isCancelled ? '#991B1B' : '#065F46',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          zIndex: 2,
        }}>
          {isCancelled ? 'Cancelled' : 'Redeemed'}
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 9, fontWeight: 700,
          color: theme.accent,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          {design.eyebrow}
        </div>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 16, fontWeight: 700,
          color: theme.ink,
          marginBottom: 8,
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
          fontStyle: design.headlineStyle === 'italic-serif' ? 'italic' : 'normal',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {recipient ? `For ${recipient}` : 'No recipient'}
        </div>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 28, fontWeight: 700,
          color: theme.accentDeep,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          ${typeof amount === 'number' ? amount.toFixed(0) : amount}
        </div>
        <div style={{
          fontSize: 11, color: theme.inkSoft,
          fontWeight: 600,
          marginTop: 2,
        }}>
          of care
        </div>
      </div>
    </div>
  );
}
