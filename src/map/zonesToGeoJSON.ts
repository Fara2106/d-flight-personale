import type { FeatureCollection, Geometry, Position } from 'geojson';
import type { Zone } from '../data/ed269.types';
import { altitudeLabel } from './altitudeLabel';
import { categoryAltitudes } from '../data/categoryAltitudes';
import { categoryMosaic } from './fastUnion';

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
 * id diversi): disegnarli tutti al completo produce etichette duplicate
 * (illeggibile, visto sull'iPhone il 2026-07-09). Qui marchiamo la fascia più
 * estesa di ogni gruppo con `labelPrimary` (per nome+etichetta): una sola
 * etichetta per quota — ma quote DIVERSE della stessa zona restano tutte
 * visibili (mai nascondere una quota più severa: app conservativa).
 * Questa sorgente serve a etichette, highlight e hit-test del popup; velo e
 * contorno vengono invece dal mosaico per categoria.
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
        labelPrimary: primaryByNameLabel.get(`${z.name} ${labels[i]}`) === i,
        labelDiffers: differs(z),
      },
    })),
  };
}

/* L'union per NOME (zonesToUnionGeoJSON/Async) è stata rimossa il 2026-07-17:
   alimentava il bordo per singola zona, che sulle zone davvero sovrapposte
   disegnava una ragnatela di contorni ("le figure sono un po' accavallate",
   feedback di Lorenzo). Ora velo E contorno vengono entrambi dal mosaico per
   categoria (un colore e un bordo per punto) — v. tests/map/singleOutline. */

/**
 * Vista d'INSIEME per gli zoom bassi (caso Fiumicino, 2026-07-10): mosaico
 * piatto per categoria con ritaglio a cascata — la geometria la fa
 * categoryMosaic (fastUnion). Questo wrapper è il FALLBACK per ambienti senza
 * Web Worker (test jsdom, browser antichi): cede il main thread una volta
 * prima del calcolo, poi calcola in blocco. Nel percorso normale il mosaico
 * arriva dal worker (overlayWorkerClient) o dalla cache IndexedDB.
 */
export async function zonesToCategoryUnionAsync(zones: Zone[]): Promise<FeatureCollection> {
  await new Promise((r) => setTimeout(r, 0));
  return categoryMosaic(zones);
}
