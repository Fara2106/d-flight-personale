import { describe, it, expect } from 'vitest';
import { zonesToGeoJSON, zonesToUnionGeoJSON, zonesToUnionGeoJSONAsync } from '../../src/map/zonesToGeoJSON';
import type { Zone } from '../../src/data/ed269.types';

const z: Zone = {
  id: 'a',
  name: 'Vietata',
  restrictionType: 'prohibited',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  lowerLimitM: 0,
  upperLimitM: 0,
  verticalRef: 'AGL',
  message: null,
  reasons: ['AIR_TRAFFIC'],
  authority: null,
  permanent: true,
};

it('produces a FeatureCollection with display properties', () => {
  const fc = zonesToGeoJSON([z]);
  expect(fc.type).toBe('FeatureCollection');
  expect(fc.features[0].properties).toMatchObject({
    id: 'a',
    name: 'Vietata',
    restrictionType: 'prohibited',
    label: '⛔ 0 m',
  });
});

it('espone i reasons ED-269 per le spiegazioni in linguaggio semplice', () => {
  const fc = zonesToGeoJSON([z]);
  expect(fc.features[0].properties?.reasons).toEqual(['AIR_TRAFFIC']);
});

describe('dedup fasce della stessa zona (bug leggibilità mappa, 2026-07-09)', () => {
  const band = (id: string, size: number, over: Partial<Zone> = {}): Zone => ({
    ...z, id,
    geometry: { type: 'Polygon',
      coordinates: [[[0, 0], [size, 0], [size, size], [0, 0]]] },
    ...over,
  });

  it('labelPrimary: una sola etichetta per (nome, quota) — vince la fascia più estesa', () => {
    const fc = zonesToGeoJSON([
      band('outer', 3), band('inner', 1), // stesso nome, stessa label
    ]);
    const byId = Object.fromEntries(fc.features.map((f) => [f.properties?.id, f.properties]));
    expect(byId.outer?.labelPrimary).toBe(true);
    expect(byId.inner?.labelPrimary).toBe(false);
  });

  it('labelPrimary: quote DIVERSE nella stessa zona restano tutte etichettate (conservativo)', () => {
    const fc = zonesToGeoJSON([
      band('outer', 3, { upperLimitM: 120, restrictionType: 'auth_required' }),
      band('inner', 1, { upperLimitM: 45, restrictionType: 'auth_required' }),
    ]);
    for (const f of fc.features) expect(f.properties?.labelPrimary).toBe(true);
  });

  it('labelPrimary: nomi diversi non si dedupano tra loro', () => {
    const fc = zonesToGeoJSON([band('a1', 2), band('b1', 1, { name: 'Altra' })]);
    for (const f of fc.features) expect(f.properties?.labelPrimary).toBe(true);
  });

  it('bandPrimary: bordo pieno solo sulla fascia più estesa del gruppo per nome', () => {
    const fc = zonesToGeoJSON([
      band('outer', 3), band('mid', 2, { upperLimitM: 60 }), band('inner', 1),
    ]);
    const byId = Object.fromEntries(fc.features.map((f) => [f.properties?.id, f.properties]));
    expect(byId.outer?.bandPrimary).toBe(true);
    expect(byId.mid?.bandPrimary).toBe(false);
    expect(byId.inner?.bandPrimary).toBe(false);
  });

  it('bandPrimary: gestisce MultiPolygon sommando le aree', () => {
    const multi: Zone = { ...z, id: 'multi',
      geometry: { type: 'MultiPolygon', coordinates: [
        [[[0, 0], [2, 0], [2, 2], [0, 0]]],
        [[[5, 5], [8, 5], [8, 8], [5, 5]]],
      ] } };
    const fc = zonesToGeoJSON([multi, band('small', 1)]);
    const byId = Object.fromEntries(fc.features.map((f) => [f.properties?.id, f.properties]));
    expect(byId.multi?.bandPrimary).toBe(true);
    expect(byId.small?.bandPrimary).toBe(false);
  });
});

describe('zonesToUnionGeoJSON (fill/bordo fusi per zona: niente gradini di opacità)', () => {
  const rect = (id: string, name: string, x0: number, x1: number,
    over: Partial<Zone> = {}): Zone => ({
    ...z, id, name,
    geometry: { type: 'Polygon',
      coordinates: [[[x0, 0], [x1, 0], [x1, 1], [x0, 1], [x0, 0]]] },
    ...over,
  });

  it('fasce sovrapposte della stessa zona diventano UNA feature che copre tutto', () => {
    const fc = zonesToUnionGeoJSON([rect('a', 'Zona', 0, 2), rect('b', 'Zona', 1, 3)]);
    expect(fc.features).toHaveLength(1);
    const f = fc.features[0];
    expect(f.properties?.name).toBe('Zona');
    // la geometria fusa copre l'estensione di entrambe le fasce
    const xs = (f.geometry as { coordinates: number[][][] }).coordinates.flat(1).map((c) => c[0]);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(3);
  });

  it('nomi diversi restano feature separate', () => {
    const fc = zonesToUnionGeoJSON([rect('a', 'Uno', 0, 2), rect('b', 'Due', 1, 3)]);
    expect(fc.features).toHaveLength(2);
  });

  it('restrictionType della zona fusa = il più restrittivo del gruppo', () => {
    const fc = zonesToUnionGeoJSON([
      rect('a', 'Zona', 0, 2, { restrictionType: 'conditional' }),
      rect('b', 'Zona', 1, 3, { restrictionType: 'prohibited' }),
    ]);
    expect(fc.features[0].properties?.restrictionType).toBe('prohibited');
  });

  it('le feature fuse hanno bandPrimary true (bordo pieno con la paint condivisa)', () => {
    const fc = zonesToUnionGeoJSON([rect('a', 'Zona', 0, 2)]);
    expect(fc.features[0].properties?.bandPrimary).toBe(true);
  });

  it('fascia singola: geometria passata intatta', () => {
    const fc = zonesToUnionGeoJSON([rect('a', 'Zona', 0, 2)]);
    expect(fc.features[0].geometry).toEqual(rect('a', 'Zona', 0, 2).geometry);
  });
});

describe('zonesToUnionGeoJSON: performance sul file reale (dedupe + async)', () => {
  const rect = (id: string, name: string, x0: number, x1: number): Zone => ({
    ...z, id, name,
    geometry: { type: 'Polygon',
      coordinates: [[[x0, 0], [x1, 0], [x1, 1], [x0, 1], [x0, 0]]] },
  });

  it('geometrie IDENTICHE nel gruppo (doppioni D-Flight) non pagano l\'union', () => {
    // 2 fasce con la stessa identica geometria → passthrough, geometria intatta
    const fc = zonesToUnionGeoJSON([rect('a', 'Zona', 0, 2), rect('b', 'Zona', 0, 2)]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual(rect('a', 'Zona', 0, 2).geometry);
  });

  it('zonesToUnionGeoJSONAsync: stesso risultato della versione sync', async () => {
    const zones = [
      rect('a', 'Zona', 0, 2), rect('b', 'Zona', 1, 3), rect('c', 'Altra', 5, 6),
    ];
    const sync = zonesToUnionGeoJSON(zones);
    const async_ = await zonesToUnionGeoJSONAsync(zones);
    expect(async_).toEqual(sync);
  });
});
