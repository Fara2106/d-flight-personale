import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapStyleUrl, ITALY_CENTER, ITALY_ZOOM, ZONE_COLORS } from './mapStyle';
import { zonesToGeoJSON } from './zonesToGeoJSON';
import { buildPopupContent } from './popupContent';
import { circleFeature } from '../verify/verifyLayers';
import type { Zone } from '../data/ed269.types';

const SRC = 'zones';

export function buildFillPaint(): maplibregl.FillLayerSpecification['paint'] {
  return {
    'fill-color': ['match', ['get', 'restrictionType'],
      'prohibited', ZONE_COLORS.prohibited,
      'auth_required', ZONE_COLORS.auth_required,
      'conditional', ZONE_COLORS.conditional,
      'none', ZONE_COLORS.none,
      '#888888'],
    'fill-opacity': 0.25,
  };
}

export function highlightFilter(id: string | null): maplibregl.FilterSpecification {
  return ['==', ['get', 'id'], id ?? '__none__'] as maplibregl.FilterSpecification;
}

export interface VerifyState { point: { lat: number; lon: number } | null; radiusM: number }

function setVerifyLayers(map: maplibregl.Map, verify: VerifyState | null) {
  const feat = verify?.point
    ? circleFeature(verify.point.lat, verify.point.lon, verify.radiusM) : null;
  const data: any = { type: 'FeatureCollection', features: feat ? [feat] : [] };
  if (map.getSource('verify')) {
    (map.getSource('verify') as maplibregl.GeoJSONSource).setData(data);
  } else if (verify) {
    map.addSource('verify', { type: 'geojson', data });
    map.addLayer({ id: 'verify-fill', type: 'fill', source: 'verify',
      paint: { 'fill-color': '#0a84ff', 'fill-opacity': 0.12 } });
    map.addLayer({ id: 'verify-line', type: 'line', source: 'verify',
      paint: { 'line-color': '#0a84ff', 'line-width': 2, 'line-dasharray': [2, 2] } });
  }
}

function addZoneLayers(map: maplibregl.Map, zones: Zone[], highlightId: string | null) {
  const data = zonesToGeoJSON(zones) as any;
  const fillPaint = buildFillPaint()!;
  if (map.getSource(SRC)) { (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(data); return; }
  map.addSource(SRC, { type: 'geojson', data });
  map.addLayer({ id: 'zones-fill', type: 'fill', source: SRC, paint: fillPaint });
  map.addLayer({ id: 'zones-line', type: 'line', source: SRC,
    paint: { 'line-color': fillPaint['fill-color'] as any, 'line-width': 1.2 } });
  map.addLayer({ id: 'zones-highlight', type: 'line', source: SRC,
    filter: highlightFilter(highlightId),
    paint: { 'line-color': '#0a84ff', 'line-width': 3 } });
  map.addLayer({ id: 'zones-label', type: 'symbol', source: SRC,
    layout: { 'text-field': ['get', 'label'], 'text-size': 12,
      'text-font': ['Open Sans Regular', 'Noto Sans Regular'] },
    paint: { 'text-color': '#1c2530', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } });
}

export function MapView(
  { resolvedTheme, zones, onZoneClick, userPosition, flyTo, highlightZoneId, onZoneFocus, verify, onVerifyPick }:
  { resolvedTheme: 'light' | 'dark'; zones: Zone[];
    onZoneClick?: (props: Record<string, unknown>) => void;
    userPosition?: { lat: number; lon: number; accuracy: number } | null;
    flyTo?: { lat: number; lon: number } | null;
    highlightZoneId?: string | null;
    onZoneFocus?: (id: string | null) => void;
    verify?: VerifyState | null;
    onVerifyPick?: (lat: number, lon: number) => void }
) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const zonesRef = useRef<Zone[]>(zones);
  zonesRef.current = zones;
  const highlightRef = useRef<string | null>(highlightZoneId ?? null);
  const onZoneFocusRef = useRef(onZoneFocus);
  onZoneFocusRef.current = onZoneFocus;
  const verifyRef = useRef<VerifyState | null>(verify ?? null);
  verifyRef.current = verify ?? null;
  const onVerifyPickRef = useRef(onVerifyPick);
  onVerifyPickRef.current = onVerifyPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({
      container: el.current, style: mapStyleUrl(resolvedTheme),
      center: ITALY_CENTER, zoom: ITALY_ZOOM, attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => addZoneLayers(m, zonesRef.current, highlightRef.current));
    m.on('click', (e) => {
      if (verifyRef.current) onVerifyPickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });
    m.on('click', 'zones-fill', (e) => {
      if (verifyRef.current) return;
      const feats = e.features ?? [];
      if (feats.length === 0) return;
      if (onZoneClick) onZoneClick(feats[0].properties || {});
      const popup = new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setDOMContent(buildPopupContent(
          feats.map((f) => f.properties ?? {}),
          (id) => onZoneFocusRef.current?.(id)))
        .addTo(m);
      popup.on('close', () => onZoneFocusRef.current?.(null));
    });
    m.on('mouseenter', 'zones-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'zones-fill', () => { m.getCanvas().style.cursor = ''; });
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    m.setStyle(mapStyleUrl(resolvedTheme));
    m.once('styledata', () => {
      addZoneLayers(m, zonesRef.current, highlightRef.current);
      setVerifyLayers(m, verifyRef.current);
    });
  }, [resolvedTheme]);

  useEffect(() => {
    const m = map.current; if (m && m.isStyleLoaded()) addZoneLayers(m, zones, highlightRef.current);
  }, [zones]);

  useEffect(() => {
    highlightRef.current = highlightZoneId ?? null;
    const m = map.current;
    if (m && m.getLayer('zones-highlight')) {
      m.setFilter('zones-highlight', highlightFilter(highlightZoneId ?? null));
    }
  }, [highlightZoneId]);

  // vola alla posizione scelta dalla ricerca o dal GPS
  useEffect(() => {
    if (flyTo && map.current) map.current.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 13 });
  }, [flyTo]);

  // marker "puntino blu" della posizione utente
  const marker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const m = map.current; if (!m) return;
    if (!userPosition) { marker.current?.remove(); marker.current = null; return; }
    const dot = document.createElement('div');
    dot.style.cssText =
      'width:16px;height:16px;border-radius:50%;background:#0a84ff;border:3px solid #fff;box-shadow:0 0 0 6px rgba(10,132,255,.2)';
    marker.current?.remove();
    marker.current = new maplibregl.Marker({ element: dot })
      .setLngLat([userPosition.lon, userPosition.lat]).addTo(m);
  }, [userPosition]);

  // cerchio di verifica + centro trascinabile
  const centerMarker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const m = map.current; if (!m) return;
    if (m.isStyleLoaded()) setVerifyLayers(m, verify ?? null);
    else m.once('load', () => setVerifyLayers(m, verifyRef.current));

    if (!verify?.point) {
      centerMarker.current?.remove(); centerMarker.current = null; return;
    }
    if (!centerMarker.current) {
      const cel = document.createElement('div');
      cel.style.cssText =
        'width:14px;height:14px;border-radius:50%;background:#fff;border:4px solid #0a84ff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:grab';
      const mk = new maplibregl.Marker({ element: cel, draggable: true })
        .setLngLat([verify.point.lon, verify.point.lat]).addTo(m);
      mk.on('dragend', () => {
        const p = mk.getLngLat();
        onVerifyPickRef.current?.(p.lat, p.lng);
      });
      centerMarker.current = mk;
    } else {
      centerMarker.current.setLngLat([verify.point.lon, verify.point.lat]);
    }
  }, [verify]);

  return <div ref={el} style={{ position: 'absolute', inset: 0 }} />;
}
