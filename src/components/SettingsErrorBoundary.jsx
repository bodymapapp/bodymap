// src/components/SettingsErrorBoundary.jsx
//
// HK May 31 2026: scoped error boundary for individual Settings
// sections. If one row (e.g. Locations) crashes, the boundary
// renders a small fallback inside that row and the rest of the
// Settings page stays alive. Console logs the error so we can
// diagnose without losing the page.

import React from 'react';

export default class SettingsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Log so HK can paste the message from DevTools when something
    // crashes. Each section names itself via the `section` prop so
    // we can tell which row threw.
    console.error(`[Settings:${this.props.section || 'unknown'}] crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '16px 18px',
          background: '#FEF3F2',
          border: '1px solid #FECDD3',
          borderRadius: 10,
          color: '#7F1D1D',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            This section could not load right now.
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: '#991B1B', marginBottom: 8 }}>
            The rest of your settings still work. Refresh the page to try again, or contact support if this keeps happening.
          </div>
          <div style={{
            fontSize: 11, color: '#9F1239',
            background: '#fff',
            border: '1px solid #FECDD3',
            borderRadius: 6,
            padding: '6px 8px',
            fontFamily: 'ui-monospace, Menlo, monospace',
            wordBreak: 'break-word',
          }}>
            {this.state.error.message || String(this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
