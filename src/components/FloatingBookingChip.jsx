// src/components/FloatingBookingChip.jsx
//
// A small floating chip that gives one-tap access to the therapist's
// public booking page from any dashboard tab.
//
// Why this exists: HK feedback May 25 2026 - 'For booking page
// everywhere, why cant we just have the floating share booking link
// in all tabs vs just the clients tab? For mobile, could be also a
// floating tab on the bottom but small in shape? Something like most
// of the AI softwares have today for ex in Grammarly or Copilot. Also
// in future it could be a small little floating link for PracticeIQ
// within which they can have the booking link on top.'
//
// Pattern reference: Grammarly + Microsoft Copilot floating utility
// chip. Distinct from a primary FAB because the chip is a tool that
// lives alongside content, not the page's main action.
//
// Behavior:
//   - Default position: bottom-right corner, above mobile bottom nav
//   - Sage circle with the MyBodyMap paired-leaf logo (not a generic
//     icon). HK May 25 2026: 'just have mybodymap logo vs some random
//     chain looking thing in it'.
//   - Tap: opens a small popover with two actions
//     1. Open booking page (uses openExternal so iOS PWAs route
//        through Safari rather than hijacking the URL)
//     2. Copy booking link to clipboard
//   - Long-press (450ms): enters drag mode. Chip lifts and brightens.
//     The chip follows the pointer and stays where it's released.
//     ANYWHERE on the screen, not just snapped to corners. HK
//     explicitly asked for free positioning May 25 2026.
//   - Position persists per therapist in localStorage so the next
//     visit remembers the choice. On resize the chip clamps back into
//     the viewport so it never ends up off-screen.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { openExternal } from '../lib/openExternal';
import BMLogo from './BMLogo';

const LONG_PRESS_MS = 450;
const CHIP_SIZE = 48;

// Default position: bottom-right, above mobile bottom nav.
function defaultPos(isMobile) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const mobileBottomNav = 90;
  const desktopBottom = 24;
  const side = 16;
  return {
    x: w - CHIP_SIZE - side,
    y: h - CHIP_SIZE - (isMobile ? mobileBottomNav : desktopBottom),
  };
}

function loadPos(therapistId, isMobile) {
  if (!therapistId) return defaultPos(isMobile);
  try {
    const raw = localStorage.getItem(`bm:chip-pos:${therapistId}`);
    if (!raw) return defaultPos(isMobile);
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      return clampToViewport(parsed.x, parsed.y);
    }
  } catch (_) { /* fall through */ }
  return defaultPos(isMobile);
}

function savePos(therapistId, x, y) {
  if (!therapistId) return;
  try {
    localStorage.setItem(`bm:chip-pos:${therapistId}`, JSON.stringify({ x, y }));
  } catch (_) { /* storage disabled, ignore */ }
}

// Keep the chip inside the visible viewport so it can never end up
// off-screen after a resize or rotation. 4px gutter on each edge.
function clampToViewport(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const minX = 4;
  const minY = 4;
  const maxX = w - CHIP_SIZE - 4;
  const maxY = h - CHIP_SIZE - 4;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

// Popover position relative to the chip. If the chip is in the top
// half of the screen, popover drops down; bottom half, popover rises
// up. Same for left/right so the popover stays on-screen.
function popoverStyle(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const baseGap = CHIP_SIZE + 8;
  const dropDown = y < h / 2;
  const alignRight = x > w / 2;
  return {
    [dropDown ? 'top' : 'bottom']: baseGap,
    [alignRight ? 'right' : 'left']: 0,
  };
}

export default function FloatingBookingChip({ therapist }) {
  const customUrl = therapist?.custom_url;
  const bookingUrl = customUrl ? `${window.location.origin}/book/${customUrl}` : null;

  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });
  const [pos, setPos] = useState(() => loadPos(therapist?.id, isMobile));
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  const longPressTimer = useRef(null);
  const containerRef = useRef(null);
  const dragStartRef = useRef(null);
  const moveRef = useRef(false);

  // Update mobile detection on resize so default position recomputes.
  // Also re-clamp current position so the chip stays in view after
  // rotation or window resize.
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      setPos(p => clampToViewport(p.x, p.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-load position when therapist id changes.
  useEffect(() => {
    setPos(loadPos(therapist?.id, isMobile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist?.id]);

  // Close popover when clicking anywhere outside the chip.
  useEffect(() => {
    if (!open) return;
    const onAway = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onAway);
    document.addEventListener('touchstart', onAway);
    return () => {
      document.removeEventListener('mousedown', onAway);
      document.removeEventListener('touchstart', onAway);
    };
  }, [open]);

  // ── Drag mechanics ────────────────────────────────────────────────
  // Long-press starts drag. While dragging, follow the pointer.
  // Release leaves the chip wherever the user let go (free position).

  const startLongPress = useCallback((clientX, clientY) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    dragStartRef.current = { x: clientX, y: clientY };
    moveRef.current = false;
    longPressTimer.current = setTimeout(() => {
      setDragging(true);
      setPos({ x: clientX - CHIP_SIZE / 2, y: clientY - CHIP_SIZE / 2 });
      try { navigator.vibrate?.(15); } catch (_) {}
    }, LONG_PRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Track pointer while dragging. Mouse + touch unified.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const t = e.touches?.[0] || e;
      setPos(clampToViewport(t.clientX - CHIP_SIZE / 2, t.clientY - CHIP_SIZE / 2));
      moveRef.current = true;
      if (e.touches) e.preventDefault();
    };
    const onUp = () => {
      setDragging(false);
      // Save the final position. Use a small timeout so the latest
      // setPos from the last mousemove has settled into state.
      setTimeout(() => {
        setPos(p => {
          savePos(therapist?.id, p.x, p.y);
          return p;
        });
      }, 0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, therapist?.id]);

  if (!bookingUrl) return null;

  const handleChipClick = (e) => {
    // If we just finished a drag, swallow the click so the popover
    // doesn't open on release.
    if (dragging || moveRef.current) {
      moveRef.current = false;
      return;
    }
    if (dragStartRef.current) {
      const dx = Math.abs((e.clientX || 0) - dragStartRef.current.x);
      const dy = Math.abs((e.clientY || 0) - dragStartRef.current.y);
      if (dx > 4 || dy > 4) {
        dragStartRef.current = null;
        return;
      }
    }
    setOpen(v => !v);
  };

  const handleOpenBooking = () => {
    openExternal(bookingUrl);
    setOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = bookingUrl;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (_) {}
      document.body.removeChild(ta);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 950,
        transition: dragging ? 'none' : 'left 0.18s ease, top 0.18s ease',
      }}
    >
      {open && !dragging && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            ...popoverStyle(pos.x, pos.y),
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E5E0D5',
            boxShadow: '0 8px 28px rgba(28,43,34,0.12), 0 2px 6px rgba(28,43,34,0.06)',
            padding: 8,
            minWidth: 220,
            fontFamily: 'inherit',
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#92660E',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            padding: '6px 10px 4px',
          }}>
            Booking link
          </div>
          <button
            type="button"
            onClick={handleOpenBooking}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              color: '#1F2937',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F6F2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 16, color: '#2A5741' }}>↗</span>
            Open booking page
          </button>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              color: '#1F2937',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F6F2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 16, color: '#2A5741' }}>{copied ? '✓' : '⧉'}</span>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <div style={{
            fontSize: 10, color: '#9CA3AF',
            padding: '6px 12px 4px',
            lineHeight: 1.4,
            borderTop: '1px solid #F3F0E8',
            marginTop: 4,
          }}>
            Hold to drag anywhere.
          </div>
        </div>
      )}

      {/* Chip body. Sage-only gradient (no near-black anchor) so the
          surface reads as a tool, not a hole. Brightens visibly when
          dragging so HK can confirm the long-press registered. */}
      <button
        type="button"
        aria-label="Booking link tools"
        title="Booking link tools (hold to drag)"
        onClick={handleChipClick}
        onMouseDown={(e) => startLongPress(e.clientX, e.clientY)}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={(e) => {
          const t = e.touches[0];
          startLongPress(t.clientX, t.clientY);
        }}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        style={{
          width: CHIP_SIZE, height: CHIP_SIZE,
          borderRadius: '50%',
          background: dragging
            ? 'linear-gradient(135deg, #8BB89A 0%, #6B9E80 100%)'
            : 'linear-gradient(135deg, #6B9E80 0%, #4A7A5C 100%)',
          color: '#fff',
          border: dragging ? '2px solid rgba(255,255,255,0.6)' : '2px solid rgba(255,255,255,0.35)',
          cursor: dragging ? 'grabbing' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: dragging
            ? '0 12px 32px rgba(74,122,92,0.45), 0 0 0 8px rgba(139,184,154,0.22)'
            : '0 4px 14px rgba(74,122,92,0.32), 0 1px 3px rgba(28,43,34,0.10)',
          transition: 'box-shadow 0.18s ease, background 0.18s ease, transform 0.12s ease, border 0.18s ease',
          transform: dragging ? 'scale(1.12)' : 'scale(1)',
          fontFamily: 'inherit',
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
          padding: 0,
        }}
      >
        <BMLogo size={26} variant="white" showWordmark={false} />
      </button>
    </div>
  );
}

