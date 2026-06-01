// src/pages/FounderMobilePreview.jsx
//
// HK Jun 1 2026 (Jacquie incident lesson): mobile preview iframe so
// every Schedule / booking-page change can be sanity-checked at iOS
// Safari viewport BEFORE pushing. Catches mobile-only crashes that
// desktop hides (e.g. iOS Safari strict date parsing).
//
// Usage: /founder/mobile-preview. Enter the path you want to test
// (default /). The iframe loads at 380x720 (iPhone-class viewport)
// with the live production URL. Switch between "live" and "preview"
// (Vercel preview deployment) via the URL toggle.

import React, { useState } from 'react';

const PHONE_WIDTH = 380;
const PHONE_HEIGHT = 720;
const PRESETS = [
  { label: 'Home', path: '/' },
  { label: 'Schedule (Today)', path: '/dashboard' },
  { label: 'Clients', path: '/clients' },
  { label: 'Settings', path: '/settings' },
  { label: 'Joy booking page', path: '/healinghands' },
];

export default function FounderMobilePreview() {
  const [base, setBase] = useState('https://mybodymap.app');
  const [path, setPath] = useState('/');
  const [reloadTick, setReloadTick] = useState(0);

  const fullUrl = `${base}${path}?mbmPreview=1&t=${reloadTick}`;

  return (
    <div style={{ padding: 24, background: '#FFF9F3', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#1F2937' }}>
          Mobile preview
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 1.55 }}>
          iPhone-class viewport (380x720). Test new changes here before pushing to production. Catches iOS Safari issues that desktop hides. Some flows need authentication, which the iframe respects via shared cookies.
        </p>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <select
            value={base}
            onChange={(e) => setBase(e.target.value)}
            style={{
              padding: '10px 14px', fontSize: 13, borderRadius: 8,
              border: '1.5px solid #E5E7EB', background: '#fff', fontFamily: 'inherit',
              minHeight: 44,
            }}>
            <option value="https://mybodymap.app">Production (live)</option>
            <option value="http://localhost:3000">Local (localhost:3000)</option>
          </select>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/dashboard"
            style={{
              flex: 1, padding: '10px 14px', fontSize: 13, borderRadius: 8,
              border: '1.5px solid #E5E7EB', fontFamily: 'inherit', minWidth: 200,
              minHeight: 44,
            }}
          />
          <button
            onClick={() => setReloadTick(t => t + 1)}
            style={{
              padding: '10px 18px', background: '#2A5741', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
            }}>
            Reload
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button
              key={p.path}
              onClick={() => { setPath(p.path); setReloadTick(t => t + 1); }}
              style={{
                padding: '8px 14px', background: '#fff', color: '#1F2937',
                border: '1.5px solid #E5E7EB', borderRadius: 20, fontSize: 12,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                minHeight: 36,
              }}>
              {p.label}
            </button>
          ))}
        </div>

        <div style={{
          width: PHONE_WIDTH + 16, height: PHONE_HEIGHT + 16,
          margin: '0 auto', padding: 8,
          background: '#1F2937', borderRadius: 32,
          boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
        }}>
          <iframe
            key={reloadTick}
            src={fullUrl}
            title="Mobile preview"
            style={{
              width: PHONE_WIDTH, height: PHONE_HEIGHT,
              border: 'none', borderRadius: 24, background: '#fff',
              display: 'block',
            }}
          />
        </div>

        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: '#FFFBEB', border: '1.5px solid #FCD34D',
          borderRadius: 10, fontSize: 12, color: '#92400E', lineHeight: 1.55,
        }}>
          <strong>Heads-up:</strong> some pages set <code>X-Frame-Options: SAMEORIGIN</code> and will refuse to render in an iframe from a different origin. If a page shows blank, open it directly in a phone-sized browser window instead.
        </div>
      </div>
    </div>
  );
}
