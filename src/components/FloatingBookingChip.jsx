// src/components/FloatingBookingChip.jsx
//
// A small floating sage chip that gives one-tap access to the
// therapist's public booking page from any dashboard tab.
//
// Why this exists: HK feedback May 25 2026 - 'For booking page
// everywhere, why cant we just have the floating share booking link
// in all tabs vs just the clients tab? For mobile, could be also a
// floating tab on the bottom but small in shape? Something like most
// of the AI softwares have today for ex in Grammarly or Copilot.'
//
// Pattern reference: Grammarly + Microsoft Copilot use a small
// always-available floating utility chip in the corner. Distinct
// from a primary FAB (Floating Action Button) because the chip is
// not the page's main action; it's a tool that lives alongside
// content and never competes with it.
//
// Behavior:
//   - Default position: bottom-right corner, above mobile bottom nav
//   - Tap: opens a small popover above the chip with two actions
//     1. Open booking page (uses openExternal so iOS PWAs route
//        through Safari rather than hijacking the URL)
//     2. Copy booking link to clipboard
//   - Long-press (mouse hold or touch hold >450ms): enters drag mode
//     The chip becomes draggable and on release snaps to the nearest
//     of the 4 viewport corners. Position persists in localStorage
//     per therapist id so the next visit remembers the choice.
//
// Future-friendly: the component renders a generic chip. The icon +
// popover contents are exposed via props so a future iteration can
// host PracticeIQ quick chat, share link to client, or other tool
// shortcuts from the same anchor.
//
// HK May 25 2026 (Work E).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { openExternal } from '../lib/openExternal';

// 4 corners: br = bottom-right (default), bl = bottom-left,
// tr = top-right, tl = top-left.
const CORNERS = ['br', 'bl', 'tr', 'tl'];
const DEFAULT_CORNER = 'br';
const LONG_PRESS_MS = 450;

function loadCorner(therapistId) {
  if (!therapistId) return DEFAULT_CORNER;
  try {
    const v = localStorage.getItem(`bm:chip-corner:${therapistId}`);
    return CORNERS.includes(v) ? v : DEFAULT_CORNER;
  } catch (_) {
    return DEFAULT_CORNER;
  }
}

function saveCorner(therapistId, corner) {
  if (!therapistId) return;
  try {
    localStorage.setItem(`bm:chip-corner:${therapistId}`, corner);
  } catch (_) { /* storage disabled, ignore */ }
}

// Snap any (x, y) point to the nearest viewport corner. Used at the
// end of a drag gesture so the chip always lands cleanly in a corner.
function snapCorner(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const left = x < w / 2;
  const top = y < h / 2;
  if (top && left) return 'tl';
  if (top && !left) return 'tr';
  if (!top && left) return 'bl';
  return 'br';
}

// Style for a given corner, accounting for mobile bottom nav (74px)
// and the iOS safe-area inset. Bottom corners sit above the nav so
// the chip is never overlapped by it.
function cornerStyle(corner, isMobile) {
  const mobileBottom = `calc(90px + env(safe-area-inset-bottom, 0px))`;
  const desktopBottom = 24;
  const topInset = isMobile ? 80 : 80;
  const side = 16;
  switch (corner) {
    case 'tl': return { top: topInset, left: side, right: 'auto', bottom: 'auto' };
    case 'tr': return { top: topInset, right: side, left: 'auto', bottom: 'auto' };
    case 'bl': return { bottom: isMobile ? mobileBottom : desktopBottom, left: side, right: 'auto', top: 'auto' };
    case 'br':
    default:   return { bottom: isMobile ? mobileBottom : desktopBottom, right: side, left: 'auto', top: 'auto' };
  }
}

// Popover anchor direction: corner determines which way the popover
// expands so it never opens off-screen.
function popoverStyle(corner) {
  const baseShift = 56; // chip diameter + small gap
  switch (corner) {
    case 'tl': return { top: baseShift, left: 0 };
    case 'tr': return { top: baseShift, right: 0 };
    case 'bl': return { bottom: baseShift, left: 0 };
    case 'br':
    default:   return { bottom: baseShift, right: 0 };
  }
}

export default function FloatingBookingChip({ therapist }) {
  const customUrl = therapist?.custom_url;
  const bookingUrl = customUrl ? `${window.location.origin}/book/${customUrl}` : null;

  const [corner, setCorner] = useState(() => loadCorner(therapist?.id));
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState(null);  // { x, y } during drag
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });

  const longPressTimer = useRef(null);
  const containerRef = useRef(null);
  const dragStartRef = useRef(null);

  // Update mobile detection on resize so the chip moves when the user
  // rotates an iPad or resizes a desktop window into mobile width.
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-load corner when therapist id changes (rare but happens on
  // dev/demo account switching).
  useEffect(() => {
    setCorner(loadCorner(therapist?.id));
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

  // ── Drag mechanics ───────────────────────────────────────────────
  // Long-press starts drag. While dragging, follow the pointer.
  // Release snaps to the nearest corner.

  const startLongPress = useCallback((clientX, clientY) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    dragStartRef.current = { x: clientX, y: clientY };
    longPressTimer.current = setTimeout(() => {
      setDragging(true);
      setDragPos({ x: clientX, y: clientY });
      // Haptic feedback on supported devices to confirm drag mode.
      try { navigator.vibrate?.(15); } catch (_) {}
    }, LONG_PRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Track pointer while dragging. Mouse and touch unified handlers.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const t = e.touches?.[0] || e;
      setDragPos({ x: t.clientX, y: t.clientY });
      // Prevent page scroll on touch while dragging.
      if (e.touches) e.preventDefault();
    };
    const onUp = (e) => {
      const t = e.changedTouches?.[0] || e;
      const newCorner = snapCorner(t.clientX, t.clientY);
      setCorner(newCorner);
      saveCorner(therapist?.id, newCorner);
      setDragging(false);
      setDragPos(null);
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

  // Don't render if there's no booking link to share.
  if (!bookingUrl) return null;

  const handleChipClick = (e) => {
    // If we were dragging, the up handler already finished. Don't
    // also open the popover on the same gesture.
    if (dragging) return;
    if (dragStartRef.current) {
      const dx = Math.abs((e.clientX || 0) - dragStartRef.current.x);
      const dy = Math.abs((e.clientY || 0) - dragStartRef.current.y);
      if (dx > 4 || dy > 4) {
        // Treat as a small drift; ignore.
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
      // Clipboard API unavailable; fall back to selection trick.
      const ta = document.createElement('textarea');
      ta.value = bookingUrl;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (_) {}
      document.body.removeChild(ta);
    }
  };

  // Compute the chip's position: either snapped corner OR pointer
  // location during drag.
  const positionStyle = dragging && dragPos
    ? { left: dragPos.x - 24, top: dragPos.y - 24, right: 'auto', bottom: 'auto', transition: 'none' }
    : { ...cornerStyle(corner, isMobile), transition: 'top 0.18s ease, left 0.18s ease, right 0.18s ease, bottom 0.18s ease' };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        zIndex: 950,        // Below modals (1000+) and slide-overs but above page content
        ...positionStyle,
      }}
    >
      {/* Popover */}
      {open && !dragging && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            ...popoverStyle(corner),
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E5E0D5',
            boxShadow: '0 8px 28px rgba(28,43,34,0.12), 0 2px 6px rgba(28,43,34,0.06)',
            padding: 8,
            minWidth: 200,
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
            <span style={{ fontSize: 16 }}>↗</span>
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
            <span style={{ fontSize: 16 }}>{copied ? '✓' : '⧉'}</span>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <div style={{
            fontSize: 10, color: '#9CA3AF',
            padding: '6px 12px 4px',
            lineHeight: 1.4,
            borderTop: '1px solid #F3F0E8',
            marginTop: 4,
          }}>
            Hold to drag to another corner.
          </div>
        </div>
      )}

      {/* Chip */}
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
          width: 48, height: 48,
          borderRadius: '50%',
          background: dragging
            ? 'linear-gradient(135deg, #4A6B54 0%, #2A5741 100%)'
            : 'linear-gradient(135deg, #2A5741 0%, #1C2B22 100%)',
          color: '#fff',
          border: 'none',
          cursor: dragging ? 'grabbing' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          boxShadow: dragging
            ? '0 8px 24px rgba(28,43,34,0.35), 0 0 0 6px rgba(74,107,84,0.18)'
            : '0 4px 12px rgba(28,43,34,0.22), 0 1px 3px rgba(28,43,34,0.10)',
          transition: 'box-shadow 0.18s ease, background 0.18s ease, transform 0.12s ease',
          transform: dragging ? 'scale(1.08)' : 'scale(1)',
          fontFamily: 'inherit',
          touchAction: 'none',  // Prevent scroll while interacting with chip
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        🔗
      </button>
    </div>
  );
}
