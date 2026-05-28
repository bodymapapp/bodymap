// src/components/SidePanel.jsx
//
// HK May 27 2026: reusable slide-over panel. Design Principle 31:
// modals are out, side panels are in for medium forms (Edit client,
// Merge client, etc).
//
// Matches the DetailPanel pattern on the Schedule tab that HK
// confirmed works well:
//   - dimmed backdrop (tap to close)
//   - panel slides from the right on desktop (fixed, full height)
//   - on mobile (<768px) it becomes a near-full-width sheet
//   - sticky header with title + close button
//   - scrollable body
//   - optional sticky footer for primary actions
//   - body scroll lock so the page behind does not scroll
//   - safe-area-inset top and bottom for iPhone notch + home bar
//
// Usage:
//   <SidePanel open={x} onClose={...} title="Edit client"
//              footer={<button>Save</button>}>
//     ...body...
//   </SidePanel>

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 420,
  closeLabel = 'Close',
}) {
  // Body scroll lock while open. Restores prior overflow on unmount
  // or when the panel closes.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape key closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // HK May 27 2026: render through a portal to document.body. Without
  // this, position:fixed is relative to the nearest ancestor that has
  // a transform/animation/filter (ProfileSection's bm-cp-rise animation
  // creates exactly such a containing block), so the panel got trapped
  // INSIDE the Sessions and SOAP notes section instead of covering the
  // viewport. Portal escapes that. See also CheckoutModal which hit the
  // same issue.
  return createPortal((
    <>
      {/* Dimmed backdrop. Tap to close. */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 4000,
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel. Right-anchored, full height. On mobile it spans
          almost the full width (the max-width caps desktop). */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Panel'}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width,
          maxWidth: '100vw',
          background: '#fff',
          zIndex: 4001,
          boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Sticky header */}
        <div style={{
          flexShrink: 0,
          padding: '20px 22px 14px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
          borderBottom: '1px solid #F0EDE6',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{
              fontFamily: 'Georgia, serif',
              fontSize: 20,
              fontWeight: 700,
              color: '#1A2E22',
              margin: 0,
              lineHeight: 1.2,
            }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{
                fontSize: 12.5,
                color: '#6B7280',
                margin: '4px 0 0',
                lineHeight: 1.5,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid #E5E7EB',
              background: '#F9FAFB',
              color: '#6B7280',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
            }}>
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '18px 22px',
        }}>
          {children}
        </div>

        {/* Optional sticky footer */}
        {footer && (
          <div style={{
            flexShrink: 0,
            padding: '14px 22px',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
            borderTop: '1px solid #F0EDE6',
            background: '#fff',
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  ), document.body);
}
