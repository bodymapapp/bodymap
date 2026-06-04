// src/components/ResultScreen.jsx
//
// HK Jun 3 2026: ONE standardized confirmation/result screen for every
// terminal "last step" of a workflow (booking confirmed, payment charged,
// payment link ready, cancellation fee, refund, purchase, etc.).
//
// This component is PURELY presentational. It holds no business logic: no
// API calls, no database writes, no navigation, no money movement. It only
// renders the standardized design and invokes the primary/secondary button
// handlers passed in via props. Each workflow keeps its own existing logic
// and simply swaps the JSX of its success view for <ResultScreen .../>, so
// migrating a screen cannot change what it does, only how it looks.
//
// Props:
//   variant    'success' | 'celebrate' | 'money' | 'share' | 'refund'
//   amount     optional hero amount string (e.g. "$25.50")
//   amountColor optional override for the amount color
//   headline   required short outcome line (serif)
//   subline    optional one-line context
//   rows       optional [{ label, value }] detail card
//   banner     optional green confirmation string (e.g. "Emailed to ...")
//   linkUrl    optional monospace link box (share variant)
//   primary    { label, onClick }  required main button
//   secondary  optional { label, onClick }
//   onClose    optional X handler (top-right)
//
import React from 'react';

const RS = {
  forest: '#2A5741', forestDeep: '#1F4231',
  ink: '#2B2B2B', inkSoft: '#5A5A5A', inkMute: '#8A8A8A', line: '#ECE9E1',
  cream: '#FAF8F3',
  check: '#2E9E5B', checkBg: '#E7F4EC', checkRing: '#BBE3C9',
  goldBg: '#FBF4DA', goldRing: '#F0DCA6', goldText: '#7A5E12',
  refund: '#6D28D9', refundBg: '#EDE9FE', refundRing: '#DDD0F7',
};

const VARIANTS = {
  success:   { bg: RS.checkBg, ring: RS.checkRing, stroke: RS.check, leaf: false },
  celebrate: { bg: RS.checkBg, ring: RS.checkRing, stroke: RS.check, leaf: true },
  money:     { bg: RS.checkBg, ring: RS.checkRing, stroke: RS.check, leaf: false },
  share:     { bg: RS.goldBg,  ring: RS.goldRing,  stroke: RS.goldText, leaf: false },
  refund:    { bg: RS.refundBg, ring: RS.refundRing, stroke: RS.refund, leaf: false },
  pending:   { bg: '#FFFBEB', ring: '#FDE68A', emoji: '🌿' },
};

const KEYFRAMES = `
@keyframes rsPop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes rsDraw{to{stroke-dashoffset:0}}
@keyframes rsUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes rsFade{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
.rs-medal{animation:rsPop .5s cubic-bezier(.2,.9,.3,1.4) both}
.rs-chk{stroke-dasharray:40;stroke-dashoffset:40;animation:rsDraw .45s ease forwards;animation-delay:.3s}
.rs-leaf{animation:rsFade .5s ease .5s both}
.rs-rise{animation:rsUp .5s ease both}
.rs-d1{animation-delay:.42s}.rs-d2{animation-delay:.52s}.rs-d3{animation-delay:.62s}.rs-d4{animation-delay:.72s}
@media (prefers-reduced-motion: reduce){.rs-medal,.rs-chk,.rs-leaf,.rs-rise{animation:none !important}.rs-chk{stroke-dashoffset:0 !important}.rs-rise,.rs-medal,.rs-leaf{opacity:1 !important;transform:none !important}}
`;

export default function ResultScreen({
  variant = 'success', amount, amountColor, headline, subline,
  rows, banner, linkUrl, primary, secondary, onClose, children, footer,
}) {
  const v = VARIANTS[variant] || VARIANTS.success;
  return (
    <div style={{ position: 'relative', padding: '14px 24px 28px', textAlign: 'center' }}>
      <style>{KEYFRAMES}</style>

      {onClose && (
        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: -2, right: 0, width: 30, height: 30,
          borderRadius: '50%', border: `1px solid ${RS.line}`, background: 'transparent',
          color: RS.inkMute, fontSize: 15, cursor: 'pointer', lineHeight: 1,
        }}>×</button>
      )}

      <div className="rs-medal" style={{
        width: 84, height: 84, borderRadius: '50%', background: v.bg,
        border: `1px solid ${v.ring}`, margin: '8px auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        {v.emoji ? (
          <span style={{ fontSize: 38 }}>{v.emoji}</span>
        ) : (
          <svg viewBox="0 0 52 52" width="46" height="46">
            <path className="rs-chk" d="M14 27 l8 8 l16 -18"
              style={{ stroke: v.stroke, strokeWidth: 5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} />
          </svg>
        )}
        {v.leaf && !v.emoji && <span className="rs-leaf" style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 18 }}>🌿</span>}
      </div>

      {amount && (
        <div className="rs-rise rs-d1" style={{
          fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 600,
          color: amountColor || RS.forestDeep, lineHeight: 1, marginBottom: 6,
        }}>{amount}</div>
      )}

      {headline && (
        <div className="rs-rise rs-d1" style={{
          fontFamily: 'Georgia, serif', fontSize: amount ? 18 : 22, fontWeight: 500,
          color: RS.forestDeep, marginBottom: 6,
        }}>{headline}</div>
      )}

      {subline && (
        <div className="rs-rise rs-d2" style={{
          fontSize: 14, color: RS.inkSoft, lineHeight: 1.5, margin: '0 auto 18px', maxWidth: 300,
        }}>{subline}</div>
      )}

      {linkUrl && (
        <div className="rs-rise rs-d3" style={{
          background: '#F5F3EE', border: `1px solid ${RS.line}`, borderRadius: 10,
          padding: '10px 13px', fontFamily: 'ui-monospace, monospace', fontSize: 11,
          color: RS.inkSoft, wordBreak: 'break-all', textAlign: 'left', margin: '0 0 12px',
        }}>{linkUrl}</div>
      )}

      {banner && (
        <div className="rs-rise rs-d3" style={{
          background: RS.checkBg, border: `1px solid ${RS.checkRing}`, color: '#15803D',
          borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 700, margin: '0 0 16px',
        }}>{banner}</div>
      )}

      {children && (
        <div className="rs-rise rs-d3" style={{ margin: '0 0 14px' }}>{children}</div>
      )}

      {rows && rows.length > 0 && (
        <div className="rs-rise rs-d3" style={{
          background: RS.cream, border: `1px solid ${RS.line}`, borderRadius: 14,
          padding: '4px 16px', margin: '0 0 20px', textAlign: 'left',
        }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0',
              borderTop: i ? `1px solid ${RS.line}` : 'none', fontSize: 13.5,
            }}>
              <span style={{ color: RS.inkMute }}>{r.label}</span>
              <span style={{ color: RS.ink, fontWeight: 600, textAlign: 'right' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {(primary || secondary) && (
        <div className="rs-rise rs-d4" style={{ display: 'flex', gap: 10, flexDirection: secondary ? 'row' : 'column' }}>
          {secondary && (
            <button onClick={secondary.onClick} style={{
              flex: 1, background: 'transparent', color: RS.forest, border: `1.5px solid ${RS.line}`,
              borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>{secondary.label}</button>
          )}
          {primary && (
            <button onClick={primary.onClick} style={{
              flex: 1, background: RS.forest, color: '#fff', border: 'none',
              borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(42,87,65,.22)',
            }}>{primary.label}</button>
          )}
        </div>
      )}

      {footer && (
        <div className="rs-rise rs-d4" style={{ fontSize: 11, color: RS.inkMute, marginTop: 14 }}>{footer}</div>
      )}
    </div>
  );
}
