import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import { union } from '@turf/union';
import { difference } from '@turf/difference';
import { featureCollection, feature as toFeature } from '@turf/helpers';
import type { Zone, RestrictionType } from '../data/ed269.types';
import { altitudeLabel } from './altitudeLabel';
import { categoryAltitudes } from '../data/categoryAltitudes';
import { RESTRICTION_ORDER } from './mapStyle';

/**
 * Area planare approssimata (shoelace sugli anelli esterni, gradi²): serve
 * SOLO per confrontare le fasce della stessa zona tra loro, non è un'area
 * geografica reale.
 */
function approxArea(g: Geometry): number {
  const ring = (r: Position[]) => {
    let a = 0;
    for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    return Math.abs(a / 2);
  };
  if (g.type === 'Polygon') return ring(g.coordinates[0] ?? []);
  if (g.type === 'MultiPolygon') return g.coordinates.reduce((s, p) => s + ring(p[0] ?? []), 0);
  return 0;
}

/**
 * Il file D-Flight spezza una zona in più record ("fasce" con lo stesso nome,
 * id diversi): disegnarli tutti al completo produce bordi annidati ed
 * etichette duplicate (illeggibile, visto sull'iPhone il 2026-07-09). Qui
 * marchiamo la fascia più estesa di ogni gruppo:
 * - `bandPrimary` (per nome): solo lei ha il bordo pieno, le altre lo hanno
 *   appena accennato;
 * - `labelPrimary` (per nome+etichetta): una sola etichetta per quota — ma
 *   quote DIVERSE della stessa zona restano tutte visibili (mai nascondere
 *   una quota più severa: app conservativa).
 * I riempimenti restano su TUTTE le fasce: la copertura visiva non si riduce.
 */
export function zonesToGeoJSON(zones: Zone[]): FeatureCollection {
  const areas = zones.map((z) => approxArea(z.geometry));
  const labels = zones.map((z) => altitudeLabel(z));
  // etichetta-quota solo dove differisce dalla quota tipica della categoria
  // (la quota standard sta in legenda); AMSL/WGS84 sempre etichettate
  const typical = categoryAltitudes(zones);
  const differs = (z: Zone) =>
    z.verticalRef === 'AMSL' || z.verticalRef === 'WGS84' ||
    z.upperLimitM !== typical[z.restrictionType].modeM;
  const largestBy = (key: (i: number) => string) => {
    const best = new Map<string, number>();
    zones.forEach((_, i) => {
      const k = key(i);
      const j = best.get(k);
      if (j === undefined || areas[i] > areas[j]) best.set(k, i);
    });
    return best;
  };
  const primaryByName = largestBy((i) => zones[i].name);
  const primaryByNameLabel = largestBy((i) => `${zones[i].name} ${labels[i]}`);

  return {
    type: 'FeatureCollection',
    features: zones.map((z, i) => ({
      type: 'Feature',
      geometry: z.geometry,
      properties: {
        id: z.id,
        name: z.name,
        restrictionType: z.restrictionType,
        label: labels[i],
        upperLimitM: z.upperLimitM,
        verticalRef: z.verticalRef,
        message: z.message,
        reasons: z.reasons,
        applicabilityText: z.applicabilityText ?? null,
        bandPrimary: primaryByName.get(z.name) === i,
        labelPrimary: primaryByNameLabel.get(`${z.name} ${labels[i]}`) === i,
        labelDiffers: differs(z),
      },
    })),
  };
}

/**
 * Sorgente di RENDERING per fill e bordo: le fasce della stessa zona (stesso
 * nome) vengono FUSE in un solo poligono. Motivo (iPhone 2026-07-09, seconda
 * segnalazione): anche col dedup di bordi/etichette, i riempimenti delle
 * fasce sovrapposte si sommano (0.24 × n) e disegnano "gradini" annidati che
 * sembrano zone dentro zone. Con l'union: un solo velo, un solo contorno.
 * Le proprietà per popup/highlight/verifica NON stanno qui: restano sulla
 * sorgente per-fascia (zonesToGeoJSON) usata da etichette, highlight e layer
 * di hit. `restrictionType` = il più restrittivo del gruppo (conservativo).
 * Se l'union fallisce su un gruppo (geometrie sporche), quel gruppo torna
 * alle fasce separate: mai ridurre la copertura visiva.
 */
function groupByName(zones: Zone[]): Map<string, Zone[]> {
  const groups = new Map<string, Zone[]>();
  for (const z of zones) {
    const g = groups.get(z.name);
    if (g) g.push(z); else groups.set(z.name, [z]);
  }
  return groups;
}

function unionGroup(name: string, group: Zone[]): Feature[] {
  const worst = group.reduce((a, b) =>
    RESTRICTION_ORDER[b.restrictionType] < RESTRICTION_ORDER[a.restrictionType] ? b : a);
  const props = {
    name,
    restrictionType: worst.restrictionType as RestrictionType,
    bandPrimary: true, // bordo pieno con la stessa paint della sorgente per-fascia
  };
  // le fasce D-Flight arrivano spesso in coppie con geometria IDENTICA:
  // deduplicarle prima dimezza il costo dell'union (−40% sul file reale)
  const seen = new Set<string>();
  const uniq = group.filter((z) => {
    const k = JSON.stringify((z.geometry as Polygon | MultiPolygon).coordinates ?? z.geometry);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  let merged: Geometry | null = uniq.length === 1 ? uniq[0].geometry : null;
  if (!merged) {
    try {
      const polys = uniq
        .map((z) => z.geometry)
        .filter((g): g is Polygon | MultiPolygon =>
          g.type === 'Polygon' || g.type === 'MultiPolygon')
        .map((g) => toFeature(g));
      merged = polys.length > 1
        ? (union(featureCollection(polys))?.geometry ?? null)
        : (polys[0]?.geometry ?? null);
    } catch {
      merged = null;
    }
  }
  if (merged) return [{ type: 'Feature', geometry: merged, properties: props }];
  // fallback: fasce separate (copertura visiva intatta)
  return group.map((z) => ({ type: 'Feature', geometry: z.geometry, properties: props }));
}

export function zonesToUnionGeoJSON(zones: Zone[]): FeatureCollection {
  const features: Feature[] = [];
  for (const [name, group] of groupByName(zones)) features.push(...unionGroup(name, group));
  return { type: 'FeatureCollection', features };
}

/**
 * Come zonesToUnionGeoJSON ma cede il main thread ogni ~25ms: sul file
 * D-Flight reale l'union totale costa ~2s e girava tutta in un colpo solo
 * bloccherebbe l'avvio. MapView dipinge subito le fasce e sostituisce la
 * sorgente quando questo risultato arriva.
 */
export async function zonesToUnionGeoJSONAsync(zones: Zone[]): Promise<FeatureCollection> {
  const features: Feature[] = [];
  let sliceStart = Date.now();
  for (const [name, group] of groupByName(zones)) {
    features.push(...unionGroup(name, group));
    if (Date.now() - sliceStart > 25) {
      await new Promise((r) => setTimeout(r, 0));
      sliceStart = Date.now();
    }
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Vista d'INSIEME per gli zoom bassi (caso Fiumicino, 2026-07-10): tutte le
 * zone di una categoria fuse in un solo poligono → un solo velo di colore e
 * un solo bordo esterno per categoria, invece della ragnatela di decine di
 * zone sovrapposte. Union incrementale a batch con yield del main thread.
 * Fallback conservativo per batch: se un'union fallisce, le geometrie di quel
 * batch restano feature separate (mai ridurre la copertura visiva).
 */
export async function zonesToCategoryUnionAsync(zones: Zone[]): Promise<FeatureCollection> {
  const features: Feature[] = [];
  let prohibitedUnion: Feature<Polygon | MultiPolygon> | null = null;
  const byType = new Map<RestrictionType, Zone[]>();
  for (const z of zones) {
    const g = byType.get(z.restrictionType);
    if (g) g.push(z); else byType.set(z.restrictionType, [z]);
  }
  // prohibited per prima: la sua geometria fusa viene SOTTRATTA dalle altre
  // categorie, così il rosso resta l'unico colore dove c'è divieto
  const ordered = [...byType.entries()].sort(([a], [b]) =>
    RESTRICTION_ORDER[a] - RESTRICTION_ORDER[b]);
  for (const [type, group] of ordered) {
    const props = { restrictionType: type, catUnion: true };
    // dedup geometrie identiche (doppioni D-Flight): meno lavoro per l'union
    const seen = new Set<string>();
    const geoms = group
      .map((z) => z.geometry)
      .filter((g): g is Polygon | MultiPolygon =>
        g.type === 'Polygon' || g.type === 'MultiPolygon')
      .filter((g) => {
        const k = JSON.stringify(g.coordinates);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (geoms.length === 0) continue;
    let acc: Feature<Polygon | MultiPolygon> | null = null;
    const BATCH = 16;
    for (let i = 0; i < geoms.length; i += BATCH) {
      const batch = geoms.slice(i, i + BATCH).map((g) => toFeature(g));
      try {
        const parts: Feature<Polygon | MultiPolygon>[] = acc ? [acc, ...batch] : batch;
        acc = parts.length > 1
          ? (union(featureCollection(parts)) as Feature<Polygon | MultiPolygon> | null)
          : parts[0];
        if (!acc) throw new Error('union nulla');
      } catch {
        // batch indigesto: emetti l'accumulato e le geometrie così come sono
        if (acc) features.push({ type: 'Feature', geometry: acc.geometry, properties: props });
        for (const g of geoms.slice(i, i + BATCH)) {
          features.push({ type: 'Feature', geometry: g, properties: props });
        }
        acc = null;
      }
      await new Promise((r) => setTimeout(r, 0)); // cedi il main thread tra i batch
    }
    if (acc && type === 'prohibited') prohibitedUnion = acc;
    if (acc && type !== 'prohibited' && prohibitedUnion) {
      // il divieto buca le categorie meno severe (fallimenti → geometria intera)
      try {
        const cut = difference(featureCollection([acc, prohibitedUnion]));
        acc = (cut as Feature<Polygon | MultiPolygon> | null) ?? acc;
      } catch { /* conservativo: meglio un velo doppio che un buco */ }
    }
    if (acc) features.push({ type: 'Feature', geometry: acc.geometry, properties: props });
  }
  return { type: 'FeatureCollection', features };
}
