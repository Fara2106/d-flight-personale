import type { FeatureCollection, Geometry, Position } from 'geojson';
import type { Zone } from '../data/ed269.types';
import { altitudeLabel } from './altitudeLabel';

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
      },
    })),
  };
}
