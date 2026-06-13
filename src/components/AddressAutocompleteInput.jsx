// src/components/AddressAutocompleteInput.jsx
//
// Type-ahead address input backed by Google Places. Use anywhere a
// therapist or client needs to enter a US address.
//
// Per HK direction May 19 2026: replace the 5-field manual entry on
// the Locations form (and any other address field) with a single
// type-ahead input. Therapist types '123 Main' -> suggestions drop
// down -> tap once -> street, city, state, zip fill at the same time.
// Suite stays manual since Places does not reliably return suite #.
//
// Graceful degradation: if Google Places fails to load (no API key,
// network error, etc), this component still renders a working text
// input that just does not autocomplete. The parent form still
// receives address parts via onSelect when the user manually edits.

import React, { useEffect, useRef, useState } from 'react';
import { useGooglePlaces, parsePlaceAddress } from '../lib/googlePlaces';

export default function AddressAutocompleteInput({
  // Current values from the parent form
  street1,
  city,
  state,
  postal_code,
  // Called when user picks a suggestion. Receives parsed parts.
  // { street1, city, state, postal_code, country, formatted }
  onSelect,
  // Called when user types into the input manually (without picking)
  // so the parent can still capture street1 raw text. Defaults to
  // updating street1 via onSelect with just street1 changed.
  onChange,
  disabled,
  placeholder,
  inputStyle,
  labelStyle,
  countries,
  minimal = false,
}) {
  // When the parent does not pass an inputStyle, fall back to a full-width
  // field so the address never renders as a narrow, truncated box.
  if (!inputStyle) {
    inputStyle = { width: '100%', padding: '13px 14px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', outline: 'none', fontFamily: 'system-ui' };
  }
  const { placesReady, placesError } = useGooglePlaces();
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const containerRef = useRef(null);
  const [showManualFallback, setShowManualFallback] = useState(false);

  // Local mirror for the input so the user can see what they typed
  // and edit it independently of the parent's split fields.
  const [displayValue, setDisplayValue] = useState(
    formatDisplayFromParts({ street1, city, state, postal_code })
  );

  // Re-sync the display value when the parent's parts change (e.g.
  // after selection). This is what lets 'Edit location' pre-populate.
  useEffect(() => {
    setDisplayValue(formatDisplayFromParts({ street1, city, state, postal_code }));
  }, [street1, city, state, postal_code]);

  useEffect(() => {
    if (!placesReady || !inputRef.current) return;
    if (autocompleteRef.current) return; // already initialized

    // HK May 31 2026: wrap construction in try/catch so a Google API
    // surprise (deprecated constructor in a future SDK rev, restricted
    // API key returning a malformed object) does not bring down the
    // entire Settings page. On any error we fall through to the
    // manual-entry input below.
    let ac;
    try {
      const google = window.google;
      if (!google || !google.maps || !google.maps.places) return;
      const allowed = countries && countries.length ? countries : ['us', 'ca'];
      ac = new google.maps.places.Autocomplete(inputRef.current, {
        // No type restriction so a client can pick a home address OR a named
        // place like a hotel or office building (HK Jun 13 2026).
        fields: ['address_components', 'formatted_address', 'geometry', 'name'],
        componentRestrictions: { country: allowed },
      });

      ac.addListener('place_changed', () => {
        try {
          const place = ac.getPlace();
          const parsed = parsePlaceAddress(place);
          if (parsed && onSelect) {
            onSelect(parsed);
            setDisplayValue(parsed.formatted || formatDisplayFromParts(parsed));
          }
        } catch (err) {
          console.warn('[AddressAutocompleteInput] place_changed handler error', err);
        }
      });

      autocompleteRef.current = ac;
    } catch (err) {
      console.warn('[AddressAutocompleteInput] Autocomplete init failed', err);
      return;
    }

    // Cleanup: defensively guard the listener clear so a stale or
    // missing google.maps reference at unmount time does not throw.
    return () => {
      try {
        if (autocompleteRef.current && window.google && window.google.maps) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      } catch (_e) { /* swallow */ }
      autocompleteRef.current = null;
    };
  }, [placesReady, onSelect, countries]);

  const handleManualChange = (e) => {
    const v = e.target.value;
    setDisplayValue(v);
    if (onChange) onChange(v);
  };

  // If Places failed to load (no key, network error), surface a
  // small affordance so the user can still enter an address manually
  // by switching to the split-field fallback view.
  if (placesError && !placesReady) {
    if (minimal) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleManualChange}
          onBlur={() => { if (onSelect) onSelect({ street1: displayValue }); }}
          placeholder={placeholder || 'Type the address'}
          disabled={disabled}
          autoComplete="off"
          style={inputStyle}
        />
      );
    }
    return (
      <ManualAddressFallback
        street1={street1}
        city={city}
        state={state}
        postal_code={postal_code}
        onSelect={onSelect}
        disabled={disabled}
        inputStyle={inputStyle}
        labelStyle={labelStyle}
      />
    );
  }

  if (showManualFallback) {
    return (
      <div>
        <ManualAddressFallback
          street1={street1}
          city={city}
          state={state}
          postal_code={postal_code}
          onSelect={onSelect}
          disabled={disabled}
          inputStyle={inputStyle}
          labelStyle={labelStyle}
        />
        <button
          type="button"
          onClick={() => setShowManualFallback(false)}
          disabled={disabled}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6B7280',
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
            marginTop: 6,
            textDecoration: 'underline',
          }}
        >
          Back to address search
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleManualChange}
        placeholder={placeholder || 'Start typing your address...'}
        disabled={disabled}
        autoComplete="off"
        style={inputStyle}
      />
      {!minimal && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
          {placesReady ? 'Suggestions powered by Google' : 'Loading suggestions...'}
        </span>
        <button
          type="button"
          onClick={() => setShowManualFallback(true)}
          disabled={disabled}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6B7280',
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          Enter address manually
        </button>
      </div>
      )}
    </div>
  );
}

// Build a display string from the split parts. Used when the
// component mounts in edit mode with a pre-existing address.
function formatDisplayFromParts({ street1, city, state, postal_code }) {
  const parts = [];
  if (street1) parts.push(street1);
  const cityStateZip = [city, state, postal_code].filter(Boolean).join(', ');
  if (cityStateZip) parts.push(cityStateZip);
  return parts.join(', ');
}

// Fallback view: the original 4 separate fields (street1, city, state,
// postal_code) in case Places is unavailable or the user clicks
// 'Enter address manually'. Updates the parent via onSelect with the
// same parsed shape so the parent code path is identical.
function ManualAddressFallback({ street1, city, state, postal_code, onSelect, disabled, inputStyle, labelStyle }) {
  const update = (field) => (e) => {
    if (!onSelect) return;
    onSelect({
      street1: field === 'street1' ? e.target.value : street1 || '',
      city: field === 'city' ? e.target.value : city || '',
      state: field === 'state' ? e.target.value : state || '',
      postal_code: field === 'postal_code' ? e.target.value : postal_code || '',
      country: 'US',
      formatted: '',
    });
  };
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <input
          type="text"
          value={street1 || ''}
          onChange={update('street1')}
          placeholder="123 Main St"
          disabled={disabled}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
        <input
          type="text"
          value={city || ''}
          onChange={update('city')}
          placeholder="Boulder"
          disabled={disabled}
          style={inputStyle}
        />
        <input
          type="text"
          value={state || ''}
          onChange={update('state')}
          placeholder="CO"
          maxLength={2}
          disabled={disabled}
          style={{ ...inputStyle, textTransform: 'uppercase' }}
        />
        <input
          type="text"
          value={postal_code || ''}
          onChange={update('postal_code')}
          placeholder="80301"
          disabled={disabled}
          style={inputStyle}
        />
      </div>
    </div>
  );
}
