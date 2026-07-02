import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapStyleUrl, ITALY_CENTER, ITALY_ZOOM } from './mapStyle';

export function MapView({ resolvedTheme }: { resolvedTheme: 'light' | 'dark' }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = new maplibregl.Map({
      container: el.current,
      style: mapStyleUrl(resolvedTheme),
      center: ITALY_CENTER, zoom: ITALY_ZOOM,
      attributionControl: { compact: true },
    });
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    return () => { map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cambia stile col tema mantenendo la vista
  useEffect(() => {
    map.current?.setStyle(mapStyleUrl(resolvedTheme));
  }, [resolvedTheme]);

  return <div ref={el} style={{ position: 'absolute', inset: 0 }} />;
}
