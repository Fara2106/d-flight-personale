import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  mapStyleUrl, ITALY_CENTER, ITALY_ZOOM,
  ZONE_COLORS, RESTRICTION_ORDER, ZONE_FILL_OPACITY, ZONE_LINE_WIDTH,
} from './mapStyle';
import { zonesToGeoJSON } from './zonesToGeoJSON';
import { buildPopupContent } from './popupContent';
import { circleFeature } from '../verify/verifyLayers';
import type { GeoPosition } from '../location/useGeolocation';
import type { Zone, RestrictionType } from '../data/ed269.types';

const SRC = 'zones';

/** Match data-driven su restrictionType → valore numerico per tipo. */
function matchByType(
  values: Record<RestrictionType, number>, fallback: number,
): maplibregl.ExpressionSpecification {
  return ['match', ['get', 'restrictionType'],
    'prohibited', values.prohibited,
    'auth_required', values.auth_required,
    'conditional', values.conditional,
    'none', values.none,
    fallback];
}

function zoneColorExpr(): maplibregl.ExpressionSpecification {
  return ['match', ['get', 'restrictionType'],
    'prohibited', ZONE_COLORS.prohibited,
    'auth_required', ZONE_COLORS.auth_required,
    'conditional', ZONE_COLORS.conditional,
    'none', ZONE_COLORS.none,
    '#888888'];
}

/** Sort key crescente = disegnata sopra: nelle sovrapposizioni domina il colore
 *  della zona più restrittiva, invece dell'ordine arbitrario del file importato. */
export function severitySortKey(): maplibregl.ExpressionSpecification {
  return matchByType({ prohibited: 3, auth_required: 2, conditional: 1, none: 0 }, 0);
}

export function buildFillPaint(): maplibregl.FillLayerSpecification['paint'] {
  return {
    'fill-color': zoneColorExpr(),
    // opacità per severità: i veli leggeri delle zone innocue non sommano
    // macchie scure sulle pile di zone sovrapposte
    'fill-opacity': matchByType(ZONE_FILL_OPACITY, 0.2),
  };
}

export function buildFillLayout(): maplibregl.FillLayerSpecification['layout'] {
  return { 'fill-sort-key': severitySortKey() };
}

export function buildLinePaint(): maplibregl.LineLayerSpecification['paint'] {
  return {
    'line-color': zoneColorExpr(),
    'line-width': matchByType(ZONE_LINE_WIDTH, 1.2),
    'line-opacity': 0.9,
  };
}

/** Etichette quota: in collisione tra zone impilate vince la più restrittiva. */
export function buildLabelLayout(): maplibregl.SymbolLayerSpecification['layout'] {
  return {
    'text-field': ['get', 'label'], 'text-size': 12,
    'text-font': ['Open Sans Regular', 'Noto Sans Regular'],
    'symbol-sort-key': matchByType(RESTRICTION_ORDER, 99),
  };
}

export function highlightFilter(name: string | null): maplibregl.FilterSpecification {
  return ['==', ['get', 'name'], name ?? '__none__'] as maplibregl.FilterSpecification;
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
  if (map.getSource(SRC)) { (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(data); return; }
  map.addSource(SRC, { type: 'geojson', data });
  map.addLayer({ id: 'zones-fill', type: 'fill', source: SRC,
    layout: buildFillLayout(), paint: buildFillPaint() });
  map.addLayer({ id: 'zones-line', type: 'line', source: SRC,
    layout: { 'line-sort-key': severitySortKey() }, paint: buildLinePaint() });
  // velo + bordo blu sulla zona aperta nell'accordion: emerge dalla pila
  map.addLayer({ id: 'zones-highlight-fill', type: 'fill', source: SRC,
    filter: highlightFilter(highlightId),
    paint: { 'fill-color': '#0a84ff', 'fill-opacity': 0.18 } });
  map.addLayer({ id: 'zones-highlight', type: 'line', source: SRC,
    filter: highlightFilter(highlightId),
    paint: { 'line-color': '#0a84ff', 'line-width': 3 } });
  map.addLayer({ id: 'zones-label', type: 'symbol', source: SRC,
    layout: buildLabelLayout(),
    paint: { 'text-color': '#1c2530', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } });
}

export function MapView(
  { resolvedTheme, zones, onZoneClick, userPosition, flyTo, highlightZoneName, onZoneFocus, verify, onVerifyPick }:
  { resolvedTheme: 'light' | 'dark'; zones: Zone[];
    onZoneClick?: (props: Record<string, unknown>) => void;
    userPosition?: GeoPosition | null;
    flyTo?: { lat: number; lon: number } | null;
    highlightZoneName?: string | null;
    onZoneFocus?: (name: string | null) => void;
    verify?: VerifyState | null;
    onVerifyPick?: (lat: number, lon: number) => void }
) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const zonesRef = useRef<Zone[]>(zones);
  zonesRef.current = zones;
  const highlightRef = useRef<string | null>(highlightZoneName ?? null);
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
    highlightRef.current = highlightZoneName ?? null;
    const m = map.current;
    if (!m) return;
    const f = highlightFilter(highlightZoneName ?? null);
    if (m.getLayer('zones-highlight')) m.setFilter('zones-highlight', f);
    if (m.getLayer('zones-highlight-fill')) m.setFilter('zones-highlight-fill', f);
  }, [highlightZoneName]);

  // vola alla posizione scelta dalla ricerca o dal GPS
  useEffect(() => {
    if (flyTo && map.current) map.current.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 13 });
  }, [flyTo]);

  // marker "puntino blu" della posizione utente (aggiornato in place a ogni fix
  // del tracking; freccia direzione quando l'heading è disponibile)
  const marker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const m = map.current; if (!m) return;
    if (!userPosition) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      const dot = document.createElement('div');
      dot.className = 'user-dot';
      const arrow = document.createElement('div');
      arrow.className = 'user-dot-heading';
      dot.appendChild(arrow);
      marker.current = new maplibregl.Marker({ element: dot })
        .setLngLat([userPosition.lon, userPosition.lat]).addTo(m);
    } else {
      marker.current.setLngLat([userPosition.lon, userPosition.lat]);
    }
    const arrow = marker.current.getElement()
      .querySelector('.user-dot-heading') as HTMLElement | null;
    if (arrow) {
      const h = userPosition.heading;
      arrow.style.display = h != null ? 'block' : 'none';
      if (h != null) arrow.style.transform = `rotate(${h}deg)`;
    }
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
