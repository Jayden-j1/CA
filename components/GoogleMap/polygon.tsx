'use client';

import { forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { GoogleMapsContext, useMapsLibrary } from '@vis.gl/react-google-maps';

// Type for props of Polygon
export interface PolygonProps {
  paths: google.maps.LatLngLiteral[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  fillColor?: string;
  fillOpacity?: number;
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onMouseOver?: (e: google.maps.MapMouseEvent) => void;
  onMouseOut?: (e: google.maps.MapMouseEvent) => void;
}

// ForwardRef allows parent components to get a reference to the underlying google.maps.Polygon object
export const Polygon = forwardRef<google.maps.Polygon, PolygonProps>((props, ref) => {
  const { onClick, onMouseOver, onMouseOut, ...options } = props;

  // Store callbacks to use inside Google Maps event listeners
  const callbacks = useRef({ onClick, onMouseOver, onMouseOut });
  Object.assign(callbacks.current, { onClick, onMouseOver, onMouseOut });

  // Load geometry library if needed
  useMapsLibrary('geometry');

  // Create polygon instance
  const polygon = useRef(new window.google.maps.Polygon()).current;

  // Get map instance from context
  const map = useContext(GoogleMapsContext)?.map;

  // Apply polygon style options
  useMemo(() => {
    polygon.setOptions(options);
  }, [polygon, options]);

  // Add polygon to map when mounted, remove when unmounted
  useEffect(() => {
    if (!map) return;
    polygon.setMap(map);
    return () => polygon.setMap(null);
  }, [map, polygon]);

  // Attach event handlers
  useEffect(() => {
    if (!polygon) return;
    const gm = window.google.maps.event;
    const events: [keyof typeof callbacks.current, keyof typeof callbacks.current][] = [
      ['onClick', 'onClick'],
      ['onMouseOver', 'onMouseOver'],
      ['onMouseOut', 'onMouseOut'],
    ];

    events.forEach(([eventKey, handlerKey]) => {
      gm.addListener(polygon, eventKey.slice(2).toLowerCase(), (e: google.maps.MapMouseEvent) => {
        const cb = callbacks.current[handlerKey];
        if (cb) cb(e);
      });
    });

    return () => gm.clearInstanceListeners(polygon);
  }, [polygon]);

  // Expose polygon to parent via ref
  useImperativeHandle(ref, () => polygon, []);

  return null;
});
