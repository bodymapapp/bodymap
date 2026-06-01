// src/components/ViewErrorBoundary.jsx
//
// HK Jun 1 2026: top-level error boundary for major views (Schedule
// tabs, Clients, Billing, etc.). When one view throws, the rest of
// the app keeps working. Replaces "white screen of death" with a
// friendly message + a hard-reload button.
//
// Lesson from the Jacquie incident: a ReferenceError in TimelineView
// took down the entire Schedule tab on mobile while desktop hid the
// problem behind a Chrome runtime quirk. With this boundary in
// place, the same crash would have shown a contained "Schedule
// hit a snag" card instead of an unrecoverable white screen, and
// the bottom nav would still let the user move to other tabs.
//
// Design principle alignment (#11 May 30 2026):
// "Never show error pages to customers." This component renders a
// friendly contained surface, not a stack trace. Errors are still
// logged to console for HK to retrieve from DevTools.

import React from 'react';

export default class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[View:${this.props.viewName || 'unknown'}] crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.error) {
      const viewLabel = this.props.viewName || 'this view';
      return (
        <div style={{
          minHeight: 280,
          margin: '24px auto',
          maxWidth: 520,
          padding: '28px 24px',
          background: '#FFF9F3',
          border: '1.5px solid #E8E4DC',
          borderRadius: 16,
          color: '#1F2937',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56,
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}>
            🌿
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#1F2937' }}>
            {viewLabel} hit a snag
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55, marginBottom: 20 }}>
            The rest of MyBodyMap is still working. Tap reload to try again. If this keeps happening, reply to your last email from MyBodyMap and we will look into it.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#2A5741',
              color: '#fff',
              border: 'none',
              padding: '12px 28px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              minHeight: 44,
            }}>
            Reload {viewLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
