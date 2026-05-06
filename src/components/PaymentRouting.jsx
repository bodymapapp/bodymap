// src/components/PaymentRouting.jsx
//
// Per-feature payment routing UI. Lets therapists with BOTH Stripe
// and Square connected explicitly choose which processor handles
// each feature. When only one is connected (or neither), the
// component renders an informational summary — there's nothing to
// route.
//
// The data shape stored on therapists.payment_routing:
//   {
//     deposits:     'stripe' | 'square' | 'auto',
//     card_on_file: 'stripe' | 'square' | 'auto',
//     packages:     'stripe' | 'square' | 'auto',
//     memberships:  'stripe' | 'square' | 'auto',
//   }
//
// Missing keys mean 'auto'. Edge functions read routing[feature]
// or fall back to auto-pick (Stripe wins ties).
//
// Capability matrix integration: when a therapist picks a 'limited'
// path (e.g. Square subscriptions), we surface the limitations
// inline so they're informed, not surprised later.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const C = {
  forest: '#2A5741',
  sage: '#6B9E80',
  cream: '#FAF5EE',
  text: '#1F3A2C',
  muted: '#6B7280',
  light: '#E8E4DC',
  amber: '#F59E0B',
  amberDark: '#92400E',
};

// Feature definitions: each has a key (matches payment_routing
// jsonb key), a display name, and a capability hint per processor.
// The capability hint mirrors what the backend's getCapability()
// returns; we keep a frontend copy for instant UI feedback without
// a network round-trip.
const FEATURES = [
  {
    key: 'deposits',
    name: 'Online deposits at booking',
    description: 'Deposit charged when a client books a session, applied to the session total at checkout.',
    capabilities: {
      stripe: { status: 'supported' },
      square: { status: 'supported' },
    },
  },
  {
    key: 'card_on_file',
    name: 'Card on file for cancellation policy',
    description: 'Saved card charged automatically if a client cancels late or no-shows per your policy.',
    capabilities: {
      stripe: { status: 'supported' },
      square: {
        status: 'limited',
        limitations: [
          'Square Web Payments SDK has narrower browser support than Stripe Elements; older Safari and some embedded browsers may not load the card form.',
        ],
      },
    },
  },
  {
    key: 'packages',
    name: 'Package and gift certificate purchases',
    description: 'Multi-session bundles and gift certificates that clients buy upfront from your booking page.',
    capabilities: {
      stripe: { status: 'supported' },
      square: { status: 'supported' },
    },
  },
  {
    key: 'memberships',
    name: 'Recurring monthly memberships',
    description: 'Monthly subscriptions that auto-bill on the same day each month with session credits.',
    capabilities: {
      stripe: { status: 'supported' },
      square: {
        status: 'limited',
        limitations: [
          'Square subscriptions support monthly cadence only (Stripe also supports weekly, quarterly, yearly).',
          'No automatic proration when a member changes plans.',
          'Failed payment retries are simpler than Stripe Smart Retries.',
          'No customer-facing self-service portal — therapist handles cancellations via dashboard.',
        ],
      },
    },
  },
];

function CapabilityBadge({ capability }) {
  if (!capability || capability.status === 'unsupported') return null;
  const isLimited = capability.status === 'limited';
  return (
    <span style={{
      display: 'inline-block',
      background: isLimited ? '#FEF3C7' : '#DCFCE7',
      color: isLimited ? '#92400E' : '#14532D',
      border: `1px solid ${isLimited ? '#FCD34D' : '#86EFAC'}`,
      borderRadius: 999,
      padding: '1px 7px',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: 0.4,
      marginLeft: 6,
    }}>
      {isLimited ? 'LIMITED' : 'OK'}
    </span>
  );
}

function FeatureRow({ feature, current, onChange, hasStripe, hasSquare }) {
  const [expanded, setExpanded] = useState(false);
  const value = current || 'auto';
  const stripeCap = feature.capabilities.stripe;
  const squareCap = feature.capabilities.square;

  // Resolve what 'auto' means for this feature given the connected
  // processors. Stripe wins ties when both are supported.
  const autoResolves = useMemo(() => {
    if (hasStripe && stripeCap.status !== 'unsupported') return 'stripe';
    if (hasSquare && squareCap.status !== 'unsupported') return 'square';
    return null;
  }, [hasStripe, hasSquare, stripeCap, squareCap]);

  // Show limitations when a 'limited' option is currently chosen
  const showLimitations =
    (value === 'stripe' && stripeCap.status === 'limited' && stripeCap.limitations) ||
    (value === 'square' && squareCap.status === 'limited' && squareCap.limitations) ||
    (value === 'auto' && autoResolves === 'square' && squareCap.status === 'limited' && squareCap.limitations);

  const limitationsToShow =
    value === 'stripe' ? stripeCap.limitations
    : value === 'square' ? squareCap.limitations
    : (autoResolves === 'square' ? squareCap.limitations : null);

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.light}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {feature.name}
          </div>
          <button onClick={() => setExpanded(!expanded)}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              fontSize: 11, color: C.muted, cursor: 'pointer',
              textDecoration: 'underline', marginTop: 2,
            }}>
            {expanded ? 'Hide details' : 'What is this?'}
          </button>
          {expanded && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
              {feature.description}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <RoutingChoice
          label="Auto"
          subtitle={autoResolves ? `→ ${autoResolves}` : 'no processor'}
          selected={value === 'auto'}
          onClick={() => onChange('auto')}
        />
        {hasStripe && stripeCap.status !== 'unsupported' && (
          <RoutingChoice
            label="Stripe"
            badge={<CapabilityBadge capability={stripeCap} />}
            selected={value === 'stripe'}
            onClick={() => onChange('stripe')}
          />
        )}
        {hasSquare && squareCap.status !== 'unsupported' && (
          <RoutingChoice
            label="Square"
            badge={<CapabilityBadge capability={squareCap} />}
            selected={value === 'square'}
            onClick={() => onChange('square')}
          />
        )}
      </div>

      {showLimitations && limitationsToShow && (
        <div style={{
          marginTop: 10, padding: '8px 10px',
          background: '#FFFBEB',
          border: `1px solid ${C.amber}`,
          borderRadius: 8,
          fontSize: 11,
          color: C.amberDark,
          lineHeight: 1.5,
        }}>
          <strong style={{ color: '#78350F' }}>Things to know:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {limitationsToShow.map((l, i) => <li key={i} style={{ marginBottom: 2 }}>{l}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function RoutingChoice({ label, subtitle, badge, selected, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: selected ? C.forest : '#fff',
        color: selected ? '#fff' : C.text,
        border: `1.5px solid ${selected ? C.forest : C.light}`,
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
      }}>
      {label}
      {badge && !selected && badge}
      {subtitle && (
        <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 6, opacity: 0.7 }}>
          {subtitle}
        </span>
      )}
    </button>
  );
}

export default function PaymentRouting({ therapist, onSaved }) {
  const [routing, setRouting] = useState(therapist?.payment_routing || {});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const hasStripe = !!therapist?.stripe_account_id;
  const hasSquare = !!therapist?.square_access_token;

  useEffect(() => {
    setRouting(therapist?.payment_routing || {});
  }, [therapist?.payment_routing]);

  // If they only have one processor (or none), there's nothing to
  // route. Show a contextual summary instead.
  if (!hasStripe && !hasSquare) {
    return (
      <div style={{
        background: C.cream, border: `1px solid ${C.light}`,
        borderRadius: 10, padding: '14px 16px', fontSize: 12, color: C.muted,
      }}>
        Connect a payment processor in Settings → Payments before configuring routing.
      </div>
    );
  }
  if (hasStripe && !hasSquare) {
    return (
      <div style={{
        background: C.cream, border: `1px solid ${C.light}`,
        borderRadius: 10, padding: '14px 16px', fontSize: 12, color: C.muted,
        lineHeight: 1.5,
      }}>
        Stripe handles all online payments (deposits, card-on-file, packages, memberships). Connect Square in Settings → Payments to mix processors.
      </div>
    );
  }
  if (!hasStripe && hasSquare) {
    return (
      <div style={{
        background: C.cream, border: `1px solid ${C.light}`,
        borderRadius: 10, padding: '14px 16px', fontSize: 12, color: C.muted,
        lineHeight: 1.5,
      }}>
        Square handles all online payments (deposits, card-on-file, packages). For memberships with the broadest feature set, also connect Stripe in Settings → Payments.
      </div>
    );
  }

  // Both connected — show the routing matrix
  async function updateRouting(featureKey, value) {
    const next = { ...routing, [featureKey]: value };
    setRouting(next);
    setSaving(true);
    const { error } = await supabase
      .from('therapists')
      .update({ payment_routing: next })
      .eq('id', therapist.id);
    setSaving(false);
    if (!error) {
      setSavedAt(Date.now());
      onSaved?.(next);
    }
  }

  return (
    <div>
      <div style={{
        background: C.cream, border: `1px solid ${C.light}`,
        borderRadius: 10, padding: '12px 14px', marginBottom: 14,
        fontSize: 12, color: C.text, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.forest }}>Both processors connected.</strong> For each feature below, pick which processor handles it. <strong>Auto</strong> picks the best one based on capability (Stripe wins ties for online features).
      </div>

      {FEATURES.map((f) => (
        <FeatureRow
          key={f.key}
          feature={f}
          current={routing[f.key]}
          onChange={(v) => updateRouting(f.key, v)}
          hasStripe={hasStripe}
          hasSquare={hasSquare}
        />
      ))}

      {savedAt && (
        <div style={{
          fontSize: 11, color: C.sage, fontWeight: 600,
          marginTop: 8, textAlign: 'right',
        }}>
          ✓ Saved · {new Date(savedAt).toLocaleTimeString()}
        </div>
      )}
      {saving && (
        <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 8 }}>
          Saving…
        </div>
      )}
    </div>
  );
}
