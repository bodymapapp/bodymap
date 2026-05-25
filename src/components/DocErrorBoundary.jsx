// src/components/DocErrorBoundary.jsx
//
// A scoped React error boundary used by the inline DocumentDrawer in
// the Schedule slide-over. If a doc component (IntakeBrief / Pre /
// Post / Summary) throws while rendering, this catches the error so
// the slide-over does not crash. Logs the error so HK can surface it
// from the console while debugging.
//
// HK May 25 2026 round 3: docs 2/3/4 fail to render in the inline
// drawer for some bookings (typically waiver-created sessions with
// minimal data). Until the doc components are hardened against the
// no-history / empty-intel case, the boundary lets the rest of the
// experience continue.

import React from 'react';

export default class DocErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Log so HK can see the message in DevTools console while
    // testing. Real-time visibility into which doc crashed and why.
    console.error('[DocDrawer] doc component crashed:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '32px 24px',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>🌿</div>
          <div style={{ fontWeight: 700, color: '#1F2937', marginBottom: 6 }}>
            This document could not load.
          </div>
          <div style={{ marginBottom: 12 }}>
            The session does not have enough data yet for this view.
            {this.props.docName ? ` (${this.props.docName})` : ''}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            {this.state.error.message || String(this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
