import React, { useEffect, useRef } from 'react';
import { useGooglePlaces } from '../lib/googlePlaces';

// Small read-only map that drops a pin on a lat/lng. Used on the booking
// page so a come-to-you client sees where the session will happen instead
// of just reading the address back as text. Privacy note: we plot only the
// client's own location, never the therapist's base, so a circle or the
// therapist address is deliberately not shown here.
export default function LocationMapPreview({ lat, lng, height = 190 }) {
  const { placesReady } = useGooglePlaces();
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const hasCoords = typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);

  useEffect(() => {
    if (!placesReady || !hasCoords || !elRef.current) return;
    const g = window.google;
    if (!g || !g.maps || !g.maps.Map) return;
    try {
      const center = { lat, lng };
      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(elRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        });
      } else {
        mapRef.current.setCenter(center);
      }
      if (markerRef.current) {
        markerRef.current.setPosition(center);
      } else if (g.maps.Marker) {
        markerRef.current = new g.maps.Marker({ position: center, map: mapRef.current });
      }
    } catch (_e) {
      // Map is a nicety; if anything in the Maps SDK surprises us we just
      // skip it rather than break the booking flow.
    }
  }, [placesReady, hasCoords, lat, lng]);

  if (!hasCoords) return null;

  return (
    <div
      ref={elRef}
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 12,
        border: '1px solid #E5E7EB',
        background: '#EEF1ED',
      }}
    />
  );
}
