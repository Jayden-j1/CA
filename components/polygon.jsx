// components/Polygon.jsx
'use client';

import { forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { GoogleMapsContext, useMapsLibrary } from '@vis.gl/react-google-maps';

export const Polygon = forwardRef((props, ref) => {
  const { onClick, onMouseOver, onMouseOut, ...options } = props;
  const callbacks = useRef({ onClick, onMouseOver, onMouseOut });
  Object.assign(callbacks.current, { onClick, onMouseOver, onMouseOut });
  
  const geomLib = useMapsLibrary('geometry');
  const polygon = useRef(new window.google.maps.Polygon()).current;
  const map = useContext(GoogleMapsContext)?.map;

  // Apply style options
  useMemo(() => {
    polygon.setOptions(options);
  }, [polygon, options]);

  // Add to map on mount, remove on unmount
  useEffect(() => {
    if (!map) return;
    polygon.setMap(map);
    return () => polygon.setMap(null);
  }, [map, polygon]);

  // Wire up event handlers
  useEffect(() => {
    if (!polygon) return;
    const gm = window.google.maps.event;
    const events = [
      ['click', 'onClick'],
      ['mouseover', 'onMouseOver'],
      ['mouseout', 'onMouseOut']
    ];
    events.forEach(([event, handler]) => {
      gm.addListener(polygon, event, (e) => {
        const cb = callbacks.current[handler];
        if (cb) cb(e);
      });
    });
    return () => gm.clearInstanceListeners(polygon);
  }, [polygon]);

  useImperativeHandle(ref, () => polygon, []);

  return null;
});
