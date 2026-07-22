import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  mapStyleUrl, ITALY_CENTER, ITALY_ZOOM,
  ZONE_COLORS, RESTRICTION_ORDER, ZONE_FILL_OPACITY, ZONE_LINE_WIDTH,
  ZONE_DETAIL_MINZOOM, ZONE_LABEL_ALL_MINZOOM, HATCH_FILL_OPACITY,
} from './mapStyle';
import { zonesToGeoJSON } from './zonesToGeoJSON';
import { categoryOverlayFor } from './categoryOverlay';
import { firstSymbolLayerId, placeLabelBoosts, darkWaterTweaks } from './basemapLabels';
import { buildPopupContent } from './popupContent';
import { wireMapIdleFlag } from './mapIdleFlag';
import { circleFeature } from '../verify/verifyLayers';
import { warmVisibleTiles, type TileViewState } from '../pwa/warmMapCache';
import { MAP_TILE_URL_RE } from '../pwa/mapStyleCache';
import type { GeoPosition } from '../location/useGeolocation';
import type { Zone, RestrictionType } from '../data/ed269.types';

const SRC = 'zones';
const SRC_CAT = 'zones-cat';
const SRC_CAT_LINE = 'zones-cat-outline'; // contorni cumulativi (un bordo per punto)

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Tratteggio diagonale stile carta aeronautica per "richiede autorizzazione":
 *  distingue la categoria anche dove i veli si sovrappongono, senza spegnere
 *  la mappa. Rigenerato a ogni cambio stile (le immagini non sopravvivono a
 *  setStyle). */
export function hatchImage(hex: string, size = 22): { width: number; height: number; data: Uint8Array } {
  const [r, g, b] = hexToRgb(hex);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x + y) % size < 2) { // righe diagonali sottili, MOLTO distanziate
        const i = (y * size + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 90;
      }
    }
  }
  return { width: size, height: size, data };
}

function ensureHatchImage(map: maplibregl.Map) {
  if (!map.hasImage('zone-hatch')) {
    map.addImage('zone-hatch', hatchImage(ZONE_COLORS.auth_required), { pixelRatio: 2 });
  }
}

const HATCH_FILTER: maplibregl.FilterSpecification =
  ['==', ['get', 'restrictionType'], 'auth_required'] as maplibregl.FilterSpecification;

/** Vista corrente per il warm dei tile: template CARTO + zoom + bounds. */
function tileViewState(m: maplibregl.Map): TileViewState {
  const templates = Object.keys(m.getStyle()?.sources ?? {}).flatMap((id) => {
    const s = m.getSource(id) as { tiles?: string[] } | undefined;
    // solo i tile CARTO: la sorgente zone è GeoJSON e non ha template
    return (s?.tiles ?? []).filter((t) =>
      MAP_TILE_URL_RE.test(t.replace(/\{[zxy]\}/g, '0')));
  });
  const b = m.getBounds();
  return {
    templates, zoom: m.getZoom(),
    bounds: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
  };
}

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

export function buildFillLayout(): maplibregl.FillLayerSpecification['layout'] {
  return { 'fill-sort-key': severitySortKey() };
}

// Gradazione dei veli d'insieme con lo zoom (feedback 2026-07-14: all'Italia
// intera "con le aree non si capisce una mazza"): alla scala nazionale
// arancio/giallo quasi spariscono — restano basemap e vietato — e riprendono
// corpo avvicinandosi alla scala di dettaglio.
const CAT_FADE_LOW_ZOOM = 6.5, CAT_FADE_HIGH_ZOOM = 9.5;

function zoomFade(
  low: Record<RestrictionType, number>, high: Record<RestrictionType, number>,
): maplibregl.ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'],
    CAT_FADE_LOW_ZOOM, matchByType(low, 0),
    CAT_FADE_HIGH_ZOOM, matchByType(high, 0)];
}

/** Velo della vista d'insieme: graduato con lo zoom (solo il rosso resta
 *  ben visibile all'inquadratura nazionale). */
export function buildCatFillPaint(): maplibregl.FillLayerSpecification['paint'] {
  return {
    'fill-color': zoneColorExpr(),
    'fill-opacity': zoomFade(
      { prohibited: 0.3, auth_required: 0.02, conditional: 0.015, none: 0 },
      ZONE_FILL_OPACITY),
  };
}

/** Bordo della vista d'insieme: un solo contorno per categoria, anch'esso
 *  graduato (niente ragnatela arancione sull'Italia intera). */
export function buildCatLinePaint(): maplibregl.LineLayerSpecification['paint'] {
  return {
    'line-color': zoneColorExpr(),
    'line-width': matchByType(ZONE_LINE_WIDTH, 1.2),
    'line-opacity': zoomFade(
      { prohibited: 0.9, auth_required: 0.1, conditional: 0.1, none: 0 },
      { prohibited: 0.95, auth_required: 0.95, conditional: 0.95, none: 0 }),
  };
}

/**
 * Filtro di visibilità per categoria (checkbox in legenda): esclude i
 * restrictionType nascosti dall'utente, combinandosi in AND con l'eventuale
 * filtro base del layer. null = nessun filtro (tutto visibile).
 */
export function typeVisibilityFilter(
  hidden: RestrictionType[], base?: maplibregl.FilterSpecification,
): maplibregl.FilterSpecification | null {
  if (hidden.length === 0) return base ?? null;
  const vis = ['!', ['in', ['get', 'restrictionType'], ['literal', hidden]]] as
    unknown as maplibregl.FilterSpecification;
  return base ? (['all', base, vis] as unknown as maplibregl.FilterSpecification) : vis;
}

/** Etichette-eccezione: quota diversa dalla tipica di categoria (o non-AGL).
 *  La quota standard sta in legenda, non tappezzata sulla mappa. */
export function labelDiffFilter(): maplibregl.FilterSpecification {
  return ['all',
    ['==', ['get', 'labelPrimary'], true],
    ['==', ['get', 'labelDiffers'], true]] as maplibregl.FilterSpecification;
}

/** Etichette con quota standard: solo alla scala di dettaglio fine. */
export function labelStandardFilter(): maplibregl.FilterSpecification {
  return ['all',
    ['==', ['get', 'labelPrimary'], true],
    ['!=', ['get', 'labelDiffers'], true]] as maplibregl.FilterSpecification;
}

/** Etichette quota: in collisione tra zone impilate vince la più restrittiva. */
export function buildLabelLayout(): maplibregl.SymbolLayerSpecification['layout'] {
  return {
    'text-field': ['get', 'label'], 'text-size': 12,
    'text-font': ['Open Sans Regular', 'Noto Sans Regular'],
    'symbol-sort-key': matchByType(RESTRICTION_ORDER, 99),
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

let unionGeneration = 0;

function addZoneLayers(map: maplibregl.Map, zones: Zone[], highlightId: string | null) {
  const data = zonesToGeoJSON(zones) as any;
  // velo e bordo vengono dal mosaico per CATEGORIA (geometrie fuse e ritagliate:
  // un colore e un contorno per punto). Il mosaico costa sul file reale, quindi
  // si parte con le fasce così come sono e si sostituisce la sorgente quando il
  // risultato arriva
  const gen = ++unionGeneration;
  const swapWhenReady = (sourceId: string, promise: Promise<unknown>) => {
    void promise.then((result) => {
      // scarta il risultato se nel frattempo è arrivato un nuovo import
      if (gen !== unionGeneration) return;
      try {
        const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        src?.setData(result as any);
      } catch {
        // la mappa può essere stata rimossa (unmount) mentre l'union girava
      }
    });
  };
  // mosaico: dalla cache IndexedDB se il dataset è già stato lavorato,
  // altrimenti calcolato nel worker (sul file reale ~15-20s la prima volta;
  // nel frattempo restano le fasce così come sono)
  // un solo calcolo (cache/worker), due sorgenti: veli ritagliati + contorni cumulativi
  const overlay = categoryOverlayFor(zones);
  swapWhenReady(SRC_CAT, overlay.then((o) => o.fill));
  swapWhenReady(SRC_CAT_LINE, overlay.then((o) => o.outline));
  if (map.getSource(SRC)) {
    (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(data);
    (map.getSource(SRC_CAT) as maplibregl.GeoJSONSource).setData(data);
    (map.getSource(SRC_CAT_LINE) as maplibregl.GeoJSONSource).setData(data);
    return;
  }
  ensureHatchImage(map);
  // le zone vanno SOTTO le etichette del basemap: i nomi dei luoghi restano
  // leggibili sopra i veli (feedback 2026-07-14). Le etichette-quota nostre
  // restano invece in cima (priorità nelle collisioni: sono info di sicurezza).
  const beforeId = firstSymbolLayerId(map.getStyle().layers ?? []);
  map.addSource(SRC, { type: 'geojson', data });
  map.addSource(SRC_CAT, { type: 'geojson', data });
  map.addSource(SRC_CAT_LINE, { type: 'geojson', data });

  // — VELO: sempre dal mosaico per categoria, a OGNI zoom — ogni punto un
  //   solo colore (la regola più severa). I veli per-zona si sommavano nelle
  //   sovrapposizioni creando macchie scure indecifrabili (feedback
  //   2026-07-15: "non capisco le aree accavallate che significhi")
  map.addLayer({ id: 'zones-cat-fill', type: 'fill', source: SRC_CAT,
    layout: buildFillLayout(), paint: buildCatFillPaint() }, beforeId);
  // — CONTORNO: come il velo, sempre dal mosaico e a OGNI zoom — un solo
  //   bordo per punto, che separa aree con regole DIVERSE. I bordi per singola
  //   zona (zones-line, union per nome) si intrecciavano dove le zone si
  //   sovrappongono davvero: a Roma/Fiumicino decine di contorni sopra un velo
  //   piatto = ragnatela (feedback 2026-07-17: "le figure sono un po'
  //   accavallate ancora"). Le zone dentro la stessa figura restano
  //   distinguibili col tocco: il popup le elenca e l'highlight blu le isola.
  map.addLayer({ id: 'zones-cat-line', type: 'line', source: SRC_CAT_LINE,
    layout: { 'line-sort-key': severitySortKey() }, paint: buildCatLinePaint() }, beforeId);

  // — tratteggio "richiede autorizzazione": indica la CATEGORIA (sorgente
  //   fusa: mai raddoppiato, niente moiré) ma SOLO alla scala di dettaglio —
  //   a zoom bassi il CTR copre mezzo schermo e il pattern diventa rumore:
  //   lì resta il velo piatto leggerissimo (feedback 2026-07-11)
  map.addLayer({ id: 'zones-hatch', type: 'fill', source: SRC_CAT,
    minzoom: ZONE_DETAIL_MINZOOM, filter: HATCH_FILTER,
    paint: { 'fill-pattern': 'zone-hatch', 'fill-opacity': HATCH_FILL_OPACITY } }, beforeId);

  // layer di hit trasparente sulle FASCE: il popup ha bisogno delle proprietà
  // per-fascia (quote, message, reasons) che le sorgenti fuse non hanno
  map.addLayer({ id: 'zones-hit', type: 'fill', source: SRC,
    paint: { 'fill-color': '#000000', 'fill-opacity': 0 } }, beforeId);
  // velo + bordo blu sulla zona aperta nell'accordion: emerge dalla pila
  map.addLayer({ id: 'zones-highlight-fill', type: 'fill', source: SRC,
    filter: highlightFilter(highlightId),
    paint: { 'fill-color': '#0a84ff', 'fill-opacity': 0.18 } }, beforeId);
  map.addLayer({ id: 'zones-highlight', type: 'line', source: SRC,
    filter: highlightFilter(highlightId),
    paint: { 'line-color': '#0a84ff', 'line-width': 3 } }, beforeId);

  // — etichette-quota: le eccezioni alla scala di dettaglio; quelle standard
  //   solo al dettaglio fine (la quota tipica sta in legenda)
  const labelPaint = {
    'text-color': '#1c2530', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4,
  } as maplibregl.SymbolLayerSpecification['paint'];
  map.addLayer({ id: 'zones-label', type: 'symbol', source: SRC,
    minzoom: ZONE_DETAIL_MINZOOM, filter: labelDiffFilter(),
    layout: buildLabelLayout(), paint: labelPaint });
  map.addLayer({ id: 'zones-label-standard', type: 'symbol', source: SRC,
    minzoom: ZONE_LABEL_ALL_MINZOOM, filter: labelStandardFilter(),
    layout: buildLabelLayout(), paint: labelPaint });
}

/** Anticipa le etichette place del basemap (~2 livelli di zoom): più nomi
 *  di città e paesi a parità di inquadratura. Difensivo: se lo stile non ha
 *  quei layer (mock E2E) non fa nulla. */
function boostPlaceLabels(map: maplibregl.Map) {
  for (const b of placeLabelBoosts(map.getStyle().layers ?? [])) {
    try {
      const maxzoom = map.getLayer(b.id)?.maxzoom ?? 24;
      map.setLayerZoomRange(b.id, b.minzoom, maxzoom);
    } catch { /* layer sparito nel frattempo: pazienza */ }
  }
}

/** In tema scuro il mare del Dark Matter è grigio-terra: la sagoma della
 *  costa si perde. Lo si porta a un blu notte (solo dark; chiaro intatto). */
function tuneDarkWater(map: maplibregl.Map, theme: 'light' | 'dark') {
  if (theme !== 'dark') return;
  for (const t of darkWaterTweaks(map.getStyle().layers ?? [])) {
    try {
      map.setPaintProperty(t.id, t.property as never, t.value);
    } catch { /* layer sparito nel frattempo: pazienza */ }
  }
}

/** Applica le categorie nascoste (checkbox in legenda) a tutti i layer zona.
 *  zones-hit resta SENZA filtro: il popup continua a raccontare tutto quello
 *  che c'è nel punto, anche ciò che è nascosto a schermo (app conservativa). */
function applyTypeVisibility(map: maplibregl.Map, hidden: RestrictionType[]) {
  const set = (id: string, base?: maplibregl.FilterSpecification) => {
    if (map.getLayer(id)) map.setFilter(id, typeVisibilityFilter(hidden, base));
  };
  set('zones-cat-fill'); set('zones-cat-line');
  set('zones-hatch', HATCH_FILTER);
  set('zones-label', labelDiffFilter());
  set('zones-label-standard', labelStandardFilter());
}

export function MapView(
  { resolvedTheme, zones, onZoneClick, userPosition, flyTo, highlightZoneId, onZoneFocus, verify, onVerifyPick, hiddenTypes }:
  { resolvedTheme: 'light' | 'dark'; zones: Zone[];
    onZoneClick?: (props: Record<string, unknown>) => void;
    userPosition?: GeoPosition | null;
    flyTo?: { lat: number; lon: number } | null;
    highlightZoneId?: string | null;
    onZoneFocus?: (id: string | null) => void;
    hiddenTypes?: RestrictionType[];
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
  const hiddenRef = useRef<RestrictionType[]>(hiddenTypes ?? []);
  hiddenRef.current = hiddenTypes ?? [];

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({
      container: el.current, style: mapStyleUrl(resolvedTheme),
      center: ITALY_CENTER, zoom: ITALY_ZOOM, attributionControl: { compact: true },
    });
    map.current = m;
    wireMapIdleFlag(m, el.current);
    // test hook: consente a E2E/screenshot script di pilotare la camera
    (window as unknown as { __dflightMap?: maplibregl.Map }).__dflightMap = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      boostPlaceLabels(m);
      tuneDarkWater(m, resolvedTheme);
      addZoneLayers(m, zonesRef.current, highlightRef.current);
      applyTypeVisibility(m, hiddenRef.current);
    });
    // sfondo mappa offline: in prima sessione i worker MapLibre bypassano il
    // SW → warmiamo i tile della vista dal main thread a ogni assestamento
    // ('idle' garantisce che il tiles.json — e quindi i template — sia caricato)
    m.once('idle', () => warmVisibleTiles(() => tileViewState(m)));
    m.on('moveend', () => warmVisibleTiles(() => tileViewState(m)));
    m.on('click', (e) => {
      if (verifyRef.current) onVerifyPickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });
    m.on('click', 'zones-hit', (e) => {
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
    m.on('mouseenter', 'zones-hit', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'zones-hit', () => { m.getCanvas().style.cursor = ''; });
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const themeMounted = useRef(false);
  useEffect(() => {
    const m = map.current; if (!m) return;
    // al primo mount lo style del costruttore È GIÀ quello del tema corrente:
    // rifare setStyle qui ricaricherebbe inutilmente lo stile (rifetch di
    // style.json) e — soprattutto — crea un SECONDO percorso di init
    // (styledata → addZoneLayers) che va in race con l'handler 'load'
    // ("Source zones already exists", intermittente solo in prod). Si applica
    // setStyle solo ai cambi tema veri.
    if (!themeMounted.current) { themeMounted.current = true; return; }
    m.setStyle(mapStyleUrl(resolvedTheme));
    m.once('styledata', () => {
      boostPlaceLabels(m);
      tuneDarkWater(m, resolvedTheme);
      addZoneLayers(m, zonesRef.current, highlightRef.current);
      applyTypeVisibility(m, hiddenRef.current);
      setVerifyLayers(m, verifyRef.current);
    });
  }, [resolvedTheme]);

  useEffect(() => {
    const m = map.current; if (m && m.isStyleLoaded()) addZoneLayers(m, zones, highlightRef.current);
  }, [zones]);

  // categorie nascoste dalla legenda (i layer potrebbero non esserci ancora:
  // in quel caso ci pensa il callback di load/styledata con hiddenRef)
  useEffect(() => {
    const m = map.current;
    if (m && m.getLayer('zones-cat-fill')) applyTypeVisibility(m, hiddenTypes ?? []);
  }, [hiddenTypes]);

  useEffect(() => {
    highlightRef.current = highlightZoneId ?? null;
    const m = map.current;
    if (!m) return;
    const f = highlightFilter(highlightZoneId ?? null);
    if (m.getLayer('zones-highlight')) m.setFilter('zones-highlight', f);
    if (m.getLayer('zones-highlight-fill')) m.setFilter('zones-highlight-fill', f);
  }, [highlightZoneId]);

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
