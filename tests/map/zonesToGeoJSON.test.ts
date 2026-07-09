import { describe, it, expect } from 'vitest';
import { zonesToGeoJSON } from '../../src/map/zonesToGeoJSON';
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
