import React, { useEffect, useRef } from 'react';
import { useGooglePlaces } from '../lib/googlePlaces';

// Read-only map for the come-to-you booking step. Shows the client's pin and,
// when the therapist has set a travel area, a soft circle for the area they
// service. The view fits whatever is present: a client well outside the area
// makes the map zoom out so the gap is visible, which reinforces the
// out-of-range note. The circle is centered on the base the therapist chose
// in settings, so they control how precise that point is.
export default function LocationMapPreview({ lat, lng, baseLat, baseLng, radiusMiles, height = 200 }) {
  const { placesReady } = useGooglePlaces();
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const hasClient = typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);
  const hasArea = typeof baseLat === 'number' && !isNaN(baseLat) && typeof baseLng === 'number' && !isNaN(baseLng) && typeof radiusMiles === 'number' && radiusMiles > 0;

  useEffect(() => {
    if (!placesReady || !elRef.current) return;
    if (!hasClient && !hasArea) return;
    const g = window.google;
    if (!g || !g.maps || !g.maps.Map) return;
    try {
      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(elRef.current, {
          center: hasClient ? { lat, lng } : { lat: baseLat, lng: baseLng },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        });
      }
      const map = mapRef.current;

      // Client pin
      if (hasClient) {
        if (markerRef.current) markerRef.current.setPosition({ lat, lng });
        else if (g.maps.Marker) markerRef.current = new g.maps.Marker({ position: { lat, lng }, map });
      } else if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }

      // Service-area circle
      if (hasArea && g.maps.Circle) {
        const meters = radiusMiles * 1609.34;
        if (circleRef.current) {
          circleRef.current.setCenter({ lat: baseLat, lng: baseLng });
          circleRef.current.setRadius(meters);
        } else {
          circleRef.current = new g.maps.Circle({
            map,
            center: { lat: baseLat, lng: baseLng },
            radius: meters,
            strokeColor: '#2A5741',
            strokeOpacity: 0.7,
            strokeWeight: 1.5,
            fillColor: '#2A5741',
            fillOpacity: 0.08,
          });
        }
      } else if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }

      // Fit the view to whatever we are showing
      const bounds = new g.maps.LatLngBounds();
      if (hasArea && circleRef.current && circleRef.current.getBounds()) bounds.union(circleRef.current.getBounds());
      if (hasClient) bounds.extend({ lat, lng });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 40);
        // Do not zoom in too far when only a single point is shown.
        if (hasClient && !hasArea) {
          const l = g.maps.event.addListenerOnce(map, 'idle', () => {
            if (map.getZoom() > 15) map.setZoom(15);
          });
          void l;
        }
      }
    } catch (_e) {
      // Map is a nicety; never let a Maps SDK surprise break booking.
    }
  }, [placesReady, hasClient, hasArea, lat, lng, baseLat, baseLng, radiusMiles]);

  if (!hasClient && !hasArea) return null;

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
