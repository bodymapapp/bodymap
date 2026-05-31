// src/components/Toast.jsx
//
// HK May 28 2026: small confirmation toast that fades in, holds, and
// fades out. Gives the therapist immediate feedback that an action
// worked (e.g. "Appointment cancelled") so they are never left
// wondering whether it happened. Reusable across actions.
//
// Usage with the hook:
//   const { toast, showToast } = useToast();
//   ...
//   showToast('Appointment cancelled');
//   ...
//   {toast}   // render once near the root of the component
//
// No window.alert, no browser popups. Pure inline, auto-dismiss.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const TONES = {
  success: { bg: '#0F3D2A', border: '#2A5741', icon: '✓' },
  info:    { bg: '#1A2E22', border: '#3D4F43', icon: 'ℹ' },
  warn:    { bg: '#7A4A12', border: '#A8690F', icon: '!' },
  error:   { bg: '#7A1A1A', border: '#B91C1C', icon: '✕' },
};

function ToastView({ message, tone = 'success', onDone, duration = 2600 }) {
  const [visible, setVisible] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // fade in next frame
    const inT = requestAnimationFrame(() => setVisible(true));
    // start fade out before removal
    const outT = setTimeout(() => setVisible(false), duration - 350);
    // remove after fade completes
    const rmT = setTimeout(() => doneRef.current && doneRef.current(), duration);
    return () => { cancelAnimationFrame(inT); clearTimeout(outT); clearTimeout(rmT); };
  }, [duration]);

  const t = TONES[tone] || TONES.success;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{
        // HK May 31 2026: moved from bottom-center to top-center.
        // Top placement is the convention for transient confirmations
        // (Slack, Linear, GitHub, Notion all use top). Bottom-center
        // conflicted with the mobile bottom nav and got missed.
        position: 'fixed',
        left: '50%',
        top: 'calc(env(safe-area-inset-top, 0px) + 18px)',
        transform: `translateX(-50%) translateY(${visible ? '0' : '-10px'})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: '#fff',
        padding: '12px 18px',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'inherit',
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        zIndex: 100000,
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: 15, opacity: 0.9 }}>{t.icon}</span>
      <span>{message}</span>
    </div>,
    document.body
  );
}

export function useToast() {
  const [state, setState] = useState(null); // { id, message, tone }
  const showToast = useCallback((message, tone = 'success') => {
    setState({ id: Date.now() + Math.random(), message, tone });
  }, []);
  const toast = state
    ? <ToastView key={state.id} message={state.message} tone={state.tone} onDone={() => setState(null)} />
    : null;
  return { toast, showToast };
}

export default ToastView;
