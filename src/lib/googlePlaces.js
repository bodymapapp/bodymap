// src/lib/googlePlaces.js
//
// Google Places Autocomplete utility for MyBodyMap.
//
// HK May 19 2026: shipped to replace the 5-field address entry on
// the Locations form (and any other address field going forward)
// with type-ahead suggestions. User types 'Downtown studio' and the
// system suggests '123 Main St, Boulder, CO 80301'. Tap once, every
// component fills.
//
// Why a single lib file:
//   - Google Places JS library is ~150 KB. We do NOT want it
//     loaded on every page. Lazy-load on demand when the address
//     input mounts.
//   - The library uses a singleton pattern: load once per session,
//     subsequent loads are no-op. This file handles that.
//   - Parsing Place results into our 5-field shape (street1, city,
//     state, postal_code, country) is non-trivial. Keep it in one
//     place so the booking page, client intake, and therapist
//     locations all use the same parser.
//
// Graceful degradation: if REACT_APP_GOOGLE_PLACES_KEY is missing
// at runtime, hooks return placesReady=false and consumers fall
// back to manual entry. No broken UX.

import { useEffect, useState } from 'react';

const SCRIPT_ID = 'google-places-autocomplete-script';
const API_KEY = process.env.REACT_APP_GOOGLE_PLACES_KEY || '';

let loadPromise = null;

/**
 * Lazy-load the Google Maps JS library with the Places + Geocoding
 * libraries. Returns a promise that resolves when window.google.maps
 * is available. Resolves immediately if already loaded. Rejects if
 * no API key is configured.
 */
export function loadGooglePlaces() {
  if (!API_KEY) return Promise.reject(new Error('Google Places key not configured'));
  if (window.google && window.google.maps && window.google.maps.places) {
    return Promise.resolve(window.google);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // If a script tag already exists (e.g. injected by another
    // component), reuse it instead of double-loading.
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = (err) => {
      loadPromise = null; // allow retry
      reject(err);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Parse a Google Place result's address_components into our
 * structured shape: { street1, city, state, postal_code, country }.
 * Returns null if the place has no usable address components.
 */
export function parsePlaceAddress(place) {
  if (!place || !place.address_components) return null;

  const parts = {
    street_number: '',
    route: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  };

  for (const c of place.address_components) {
    const types = c.types || [];
    if (types.includes('street_number')) parts.street_number = c.long_name;
    else if (types.includes('route')) parts.route = c.long_name;
    else if (types.includes('locality')) parts.city = c.long_name;
    else if (types.includes('sublocality') && !parts.city) parts.city = c.long_name;
    else if (types.includes('postal_town') && !parts.city) parts.city = c.long_name;
    else if (types.includes('administrative_area_level_1')) parts.state = c.short_name;
    else if (types.includes('postal_code')) parts.postal_code = c.long_name;
    else if (types.includes('country')) parts.country = c.short_name;
  }

  const street1 = [parts.street_number, parts.route].filter(Boolean).join(' ').trim();

  if (!street1 && !parts.city) return null;

  // Pull coordinates from geometry when present (we request the
  // geometry field). Used for mobile travel-area distance checks.
  let lat = null, lng = null;
  try {
    const loc = place.geometry && place.geometry.location;
    if (loc) {
      lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
      lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
    }
  } catch (_e) { /* coords optional */ }

  // For a named place (hotel, office), prepend the name so the therapist
  // sees "Grand Hotel, 123 Main St" rather than just the street.
  const placeName = place.name || '';
  const fa = place.formatted_address || '';
  const formatted = (placeName && fa && !fa.startsWith(placeName)) ? `${placeName}, ${fa}` : (fa || placeName);

  return {
    street1: street1 || placeName || '',
    city: parts.city || '',
    state: parts.state || '',
    postal_code: parts.postal_code || '',
    country: parts.country || 'US',
    formatted: formatted,
    name: placeName,
    lat: (typeof lat === 'number' && !isNaN(lat)) ? lat : null,
    lng: (typeof lng === 'number' && !isNaN(lng)) ? lng : null,
  };
}

/**
 * Hook: returns whether Google Places is ready to use. Triggers the
 * lazy load on mount. Components can check `placesReady` and either
 * render the autocomplete input or fall back to manual fields.
 *
 *   const { placesReady, placesError } = useGooglePlaces();
 */
export function useGooglePlaces() {
  // HK May 31 2026: lazy initializer + defensive try/catch. Previously
  // this was an eager expression that could throw if a polyfill or
  // third-party script left `window.google` in a partially-loaded
  // state. Lazy init runs once per mount and try/catch absorbs any
  // surprise read errors so the parent component never crashes here.
  const [placesReady, setPlacesReady] = useState(() => {
    try {
      return Boolean(
        typeof window !== 'undefined' &&
        window.google &&
        window.google.maps &&
        window.google.maps.places
      );
    } catch (_e) {
      return false;
    }
  });
  const [placesError, setPlacesError] = useState(null);

  useEffect(() => {
    if (placesReady) return;
    if (!API_KEY) {
      setPlacesError('not_configured');
      return;
    }
    let cancelled = false;
    loadGooglePlaces()
      .then(() => { if (!cancelled) setPlacesReady(true); })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[google-places] load failed:', err);
          setPlacesError('load_failed');
        }
      });
    return () => { cancelled = true; };
  }, [placesReady]);

  return { placesReady, placesError };
}

// Great-circle distance in miles between two lat/lng points. Returns null
// if either coordinate is missing. Used for mobile travel-area checks.
export function milesBetween(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((n) => typeof n !== 'number' || isNaN(n))) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8; // earth radius, miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
