// src/components/SeedDefaults.jsx
//
// Reusable empty-state seeder for the four catalog cards: add-ons,
// packages, memberships, and events. Surfaces 5 suggested defaults
// as a list with a single "Add all 5" button. Tap-to-toggle each
// item if therapist wants to customize before seeding.
//
// Industry pattern: Notion templates, Linear smart defaults, Stripe
// onboarding all surface defaults this way. Empty space is a missed
// teaching moment.
//
// Props:
//   title     — small uppercase header e.g. "Suggested defaults"
//   items     — array of { label, sub } describing each preset
//   onSeed    — async callback receiving the indices the user kept
//               (default: all). Should insert rows into supabase and
//               then refetch the parent list.

import React from "react";

const C = {
  beige: '#F0EAD9',
  beigeSoft: '#FAF7EE',
  forest: '#2A5741',
  forestInk: '#1F3A2C',
  sage: '#6B9E80',
  gold: '#C9A84C',
  lightGray: '#E8E4DC',
  gray: '#6B7280',
  ink: '#374151',
};

export default function SeedDefaults({ title = 'Suggested defaults', items = [], onSeed, ctaLabel = 'Add all 5 (you can edit or delete after)' }) {
  const [keep, setKeep] = React.useState(() => items.map(() => true));
  const [seeding, setSeeding] = React.useState(false);

  React.useEffect(() => {
    setKeep(items.map(() => true));
  }, [items.length]);

  const keptCount = keep.filter(Boolean).length;

  async function handleSeed() {
    if (seeding || keptCount === 0) return;
    setSeeding(true);
    try {
      const indices = keep.map((k, i) => k ? i : -1).filter(i => i >= 0);
      await onSeed(indices);
    } catch (e) {
      console.error('Seed error:', e);
      alert('Could not add defaults. Please try again.');
    } finally {
      setSeeding(false);
    }
  }

  if (!items.length) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FAF7EE 0%, #F0EAD9 100%)',
      border: `1.5px solid rgba(201,168,76,0.25)`,
      borderRadius: 14,
      padding: 18,
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: C.gold,
        marginBottom: 4,
      }}>{title}</div>
      <p style={{ fontSize: 13, color: C.ink, margin: '0 0 14px 0', lineHeight: 1.5 }}>
        We picked 5 to get you started. Tap to skip any. You can edit prices and details after.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {items.map((it, i) => {
          const on = keep[i];
          return (
            <button
              key={i}
              onClick={() => setKeep(arr => arr.map((v, idx) => idx === i ? !v : v))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: on ? '#fff' : '#F3F4F6',
                border: `1.5px solid ${on ? C.sage : '#D1D5DB'}`,
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                opacity: on ? 1 : 0.55,
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                border: `1.5px solid ${on ? C.forest : '#9CA3AF'}`,
                background: on ? C.forest : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {on && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M3 6l2 2 4-4"/></svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.forestInk }}>{it.label}</div>
                {it.sub && <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{it.sub}</div>}
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={handleSeed}
        disabled={seeding || keptCount === 0}
        style={{
          width: '100%',
          background: keptCount === 0 ? '#D1D5DB' : C.forest,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: seeding || keptCount === 0 ? 'not-allowed' : 'pointer',
        }}
      >
        {seeding ? 'Adding…' : (keptCount === 0 ? 'Pick at least one' : (keptCount === items.length ? ctaLabel : `Add ${keptCount} of ${items.length}`))}
      </button>
    </div>
  );
}
