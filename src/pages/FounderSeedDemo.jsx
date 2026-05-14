// src/pages/FounderSeedDemo.jsx
//
// Founder-only admin page to seed (or re-seed) the canonical demo
// client. Three ways to provide the data:
//   1. Click "Use built-in Sarah Chen data" (the JS module in /src/data)
//   2. Paste JSON into the textarea
//   3. Upload a .json file
//
// All three flow into the same seed-demo-client edge function which
// uses service_role to bypass RLS. Idempotent: existing sessions for
// the target client are deleted and replaced.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_PAYLOAD, DEMO_CLIENT, DEMO_SESSIONS } from '../data/demoSarahChen';
import { supabase } from '../lib/supabase';

const T = {
  cream: '#F9F5EE',
  creamAlt: '#F3EEE2',
  forest: '#1C2B22',
  sage: '#4A6B54',
  gold: '#C9A84C',
  ink: '#3D4F43',
  inkSoft: '#6B7F72',
  red: '#B91C1C',
  redBg: '#FDF2F2',
  greenBg: '#EEF3EE',
  lineFaint: '#E8E0D0',
  white: '#FFFFFF',
  serif: "'Fraunces', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

export default function FounderSeedDemo() {
  const [pasted, setPasted] = useState('');
  const [status, setStatus] = useState(null);  // { kind: 'ok' | 'err', message, detail }
  const [busy, setBusy] = useState(false);

  async function callSeedFunction(payload) {
    setBusy(true);
    setStatus(null);
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/seed-demo-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.ok) {
        setStatus({
          kind: 'ok',
          message: `Seeded ${result.sessions_inserted} sessions for client ${result.client_id}.`,
          detail: result,
        });
      } else {
        setStatus({ kind: 'err', message: result.error || 'Unknown error', detail: result });
      }
    } catch (err) {
      setStatus({ kind: 'err', message: err.message, detail: err });
    } finally {
      setBusy(false);
    }
  }

  function seedBuiltin() {
    callSeedFunction(DEMO_PAYLOAD);
  }

  function seedFromTextarea() {
    let parsed;
    try {
      parsed = JSON.parse(pasted);
    } catch (err) {
      setStatus({ kind: 'err', message: 'Invalid JSON: ' + err.message });
      return;
    }
    callSeedFunction(parsed);
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        callSeedFunction(parsed);
      } catch (err) {
        setStatus({ kind: 'err', message: 'Could not parse uploaded file: ' + err.message });
      }
    };
    reader.readAsText(file);
  }

  const briefBase = `${window.location.origin}/brief`;
  const recapBase = `${window.location.origin}/recap`;

  return (
    <div style={{ background: T.cream, minHeight: '100vh', color: T.ink, fontFamily: T.sans, padding: 'max(32px, env(safe-area-inset-top, 32px)) 20px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 4 }}>
              Founder Admin
            </div>
            <h1 style={{ fontFamily: T.serif, fontSize: 32, fontWeight: 500, color: T.forest, margin: 0, letterSpacing: '-0.5px' }}>
              Seed demo client
            </h1>
          </div>
          <Link to="/founder" style={{ color: T.forest, fontSize: 13, textDecoration: 'none', border: `1px solid ${T.lineFaint}`, padding: '8px 14px', borderRadius: 8 }}>
            ← Back to Founder Hub
          </Link>
        </div>

        <div style={{
          background: T.creamAlt, borderRadius: 12,
          padding: '14px 18px', marginBottom: 22,
          fontSize: 13, lineHeight: 1.6, color: T.ink,
        }}>
          <strong>What this does.</strong> Wipes and re-seeds the canonical demo client ({DEMO_CLIENT.name}, id {DEMO_CLIENT.id.slice(0, 8)}…) with 5 sessions of rich intake, body map, SOAP, aftercare, and pattern-friendly history. Use the built-in dataset for the standard demo, or upload your own JSON to swap the story without code changes. The target client must already exist in the dashboard.
        </div>

        {/* Built-in seed */}
        <Card>
          <CardLabel>Option 1: Built-in Sarah Chen dataset</CardLabel>
          <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: '0 0 14px' }}>
            5 sessions over 10 weeks. Right shoulder + lower back pattern, headache arc with nightguard resolution, pressure climbing 2 to 4, full SOAP and aftercare on each.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={seedBuiltin} disabled={busy} style={primaryBtn}>
              {busy ? 'Seeding...' : 'Seed Sarah Chen now'}
            </button>
            <span style={{ fontSize: 12, color: T.inkSoft }}>{DEMO_SESSIONS.length} sessions, idempotent</span>
          </div>
        </Card>

        {/* Paste JSON */}
        <Card>
          <CardLabel>Option 2: Paste your own JSON</CardLabel>
          <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: '0 0 10px' }}>
            Same shape as the built-in: <code style={{ background: T.cream, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{'{ client: { id, name, phone, email }, sessions: [...] }'}</code>
          </p>
          <textarea
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            placeholder='{"client": {"id":"...", "name":"..."}, "sessions": [...]}'
            style={{
              width: '100%', minHeight: 140, padding: '10px 12px',
              border: `1px solid ${T.lineFaint}`, borderRadius: 8,
              fontSize: 12, fontFamily: 'Menlo, Monaco, Consolas, monospace',
              background: T.white, boxSizing: 'border-box', lineHeight: 1.5,
            }}
          />
          <div style={{ marginTop: 10 }}>
            <button onClick={seedFromTextarea} disabled={busy || !pasted.trim()} style={primaryBtn}>
              Seed from pasted JSON
            </button>
          </div>
        </Card>

        {/* Upload JSON */}
        <Card>
          <CardLabel>Option 3: Upload a JSON file</CardLabel>
          <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: '0 0 10px' }}>
            Pick a .json file. Same shape as Option 2.
          </p>
          <input type="file" accept=".json,application/json" onChange={handleFile} disabled={busy} />
        </Card>

        {/* Status */}
        {status && (
          <div style={{
            background: status.kind === 'ok' ? T.greenBg : T.redBg,
            border: `1.5px solid ${status.kind === 'ok' ? T.sage : T.red}`,
            borderLeft: `4px solid ${status.kind === 'ok' ? T.sage : T.red}`,
            borderRadius: 12, padding: '14px 18px', marginTop: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: status.kind === 'ok' ? T.sage : T.red, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
              {status.kind === 'ok' ? 'Success' : 'Error'}
            </div>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.5, marginBottom: status.kind === 'ok' ? 12 : 0 }}>
              {status.message}
            </div>
            {status.kind === 'ok' && (
              <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.7, marginTop: 8 }}>
                <strong>Quick links to verify (session 5, most recent):</strong>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <a href={`${briefBase}/intake/${DEMO_SESSIONS[4].id}`} target="_blank" rel="noreferrer" style={demoLink}>→ Intake brief (dot 1)</a>
                  <a href={`${briefBase}/pre/${DEMO_SESSIONS[4].id}`} target="_blank" rel="noreferrer" style={demoLink}>→ Pre-session brief (dot 2)</a>
                  <a href={`${briefBase}/post/${DEMO_SESSIONS[4].id}`} target="_blank" rel="noreferrer" style={demoLink}>→ Post-session therapist record (dot 3a)</a>
                  <a href={`${recapBase}/${DEMO_SESSIONS[4].id}`} target="_blank" rel="noreferrer" style={demoLink}>→ Client recap (dot 3b)</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Download built-in as JSON */}
        <Card style={{ marginTop: 22 }}>
          <CardLabel>Bonus: download the built-in dataset</CardLabel>
          <p style={{ fontSize: 13, color: T.ink, lineHeight: 1.6, margin: '0 0 10px' }}>
            Useful if you want to edit the data in a JSON editor and re-upload.
          </p>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(DEMO_PAYLOAD, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'sarah-chen-demo.json';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            style={ghostBtn}
          >
            Download sarah-chen-demo.json
          </button>
        </Card>
      </div>
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.white, borderRadius: 14, padding: '20px 22px',
      border: `1px solid ${T.lineFaint}`,
      boxShadow: '0 1px 3px rgba(28,43,34,0.04)',
      marginBottom: 14,
      ...style,
    }}>{children}</div>
  );
}

function CardLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10 }}>
      {children}
    </div>
  );
}

const primaryBtn = {
  background: T.forest, color: 'white', border: 'none',
  padding: '10px 18px', borderRadius: 8,
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
  fontFamily: T.sans, letterSpacing: '0.2px',
};

const ghostBtn = {
  background: 'transparent', color: T.forest,
  border: `1px solid ${T.lineFaint}`,
  padding: '8px 16px', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: T.sans,
};

const demoLink = {
  color: T.forest, textDecoration: 'underline', fontSize: 12, fontWeight: 600,
};
