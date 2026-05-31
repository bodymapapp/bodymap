// src/components/GlobalToastHost.jsx
//
// HK May 31 2026: mount once at the App root. Subscribes to the
// global toast bus (src/lib/globalToast.js) and renders any toast
// that any code fires from anywhere.
//
// Renders at most one toast at a time; new toasts replace the
// previous (matches existing useToast hook behavior).
//
// The actual visual is the existing ToastView component from
// src/components/Toast.jsx so the look stays consistent.

import React, { useEffect, useState } from 'react';
import ToastView from './Toast';
import { subscribeToToasts } from '../lib/globalToast';

export default function GlobalToastHost() {
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    return subscribeToToasts((event) => {
      setCurrent(event);
    });
  }, []);

  if (!current) return null;
  return (
    <ToastView
      key={current.id}
      message={current.message}
      tone={current.tone}
      duration={current.duration}
      onDone={() => setCurrent(null)}
    />
  );
}
