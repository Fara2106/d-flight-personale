import { describe, it, expect } from 'vitest';
import {
  zonesToGeoJSON, zonesToUnionGeoJSON, zonesToUnionGeoJSONAsync,
  zonesToCategoryUnionAsync,
} from '../../src/map/zonesToGeoJSON';
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

describe('labelDiffers: etichetta-quota solo dove serve (caso Fiumicino, 2026-07-10)', () => {
  const auth = (id: string, upper: number, over: Partial<Zone> = {}): Zone => ({
    ...z, id, name: `R_${id}`, restrictionType: 'auth_required', upperLimitM: upper,
    ...over,
  });

  it('quota uguale alla moda della categoria → labelDiffers false (va in legenda, non sulla mappa)', () => {
    const fc = zonesToGeoJSON([auth('a', 120), auth('b', 120), auth('c', 120), auth('d', 60)]);
    const byId = Object.fromEntries(fc.features.map((f) => [f.properties?.id, f.properties]));
    expect(byId.a?.labelDiffers).toBe(false);
    expect(byId.d?.labelDiffers).toBe(true); // 60 ≠ moda 120: eccezione, resta etichettata
  });

  it('quote AMSL: sempre etichettate (mai nascondere un riferimento non-suolo)', () => {
    const fc = zonesToGeoJSON([auth('a', 120), auth('b', 120),
      auth('amsl', 120, { verticalRef: 'AMSL' })]);
    const byId = Object.fromEntries(fc.features.map((f) => [f.properties?.id, f.properties]));
    expect(byId.amsl?.labelDiffers).toBe(true);
  });

  it('la moda è per-categoria: 60 m standard dei conditional non etichettato, 60 m tra gli auth sì', () => {
    const fc = zonesToGeoJSON([
      auth('a1', 120), auth('a2', 120), auth('a3', 60),
      auth('c1', 60, { restrictionType: 'conditional' }),
      auth('c2', 60, { restrictionType: 'conditional' }),
    ]);
    const byId = Object.fromEntries(fc.features.map((f) => [f.properties?.id, f.properties]));
    expect(byId.a3?.labelDiffers).toBe(true);
    expect(byId.c1?.labelDiffers).toBe(false);
  });
});

describe('zonesToCategoryUnionAsync: vista d\'insieme per categoria (zoom bassi)', () => {
  const rect = (id: string, name: string, x0: number, x1: number,
    over: Partial<Zone> = {}): Zone => ({
    ...z, id, name,
    geometry: { type: 'Polygon',
      coordinates: [[[x0, 0], [x1, 0], [x1, 1], [x0, 1], [x0, 0]]] },
    ...over,
  });

  it('zone sovrapposte della STESSA categoria → una sola feature per categoria', async () => {
    const fc = await zonesToCategoryUnionAsync([
      rect('a', 'Uno', 0, 2, { restrictionType: 'auth_required' }),
      rect('b', 'Due', 1, 3, { restrictionType: 'auth_required' }),
      rect('c', 'Tre', 2.5, 4, { restrictionType: 'auth_required' }),
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.restrictionType).toBe('auth_required');
    const xs = (fc.features[0].geometry as { coordinates: number[][][] })
      .coordinates.flat(1).map((c) => c[0]);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(4);
  });

  it('categorie diverse restano feature separate (il rosso resta rosso)', async () => {
    const fc = await zonesToCategoryUnionAsync([
      rect('a', 'Uno', 0, 2, { restrictionType: 'auth_required' }),
      rect('p', 'Divieto', 1, 1.5, { restrictionType: 'prohibited' }),
    ]);
    expect(fc.features).toHaveLength(2);
    const types = fc.features.map((f) => f.properties?.restrictionType).sort();
    expect(types).toEqual(['auth_required', 'prohibited']);
  });

  it('geometrie identiche dedupate prima dell\'union (doppioni D-Flight)', async () => {
    const fc = await zonesToCategoryUnionAsync([
      rect('a', 'Uno', 0, 2), rect('b', 'Due', 0, 2),
    ]);
    expect(fc.features).toHaveLength(1);
  });

  it('il rosso resta pulito: l\'area vietata è SOTTRATTA dalle altre categorie', async () => {
    const { default: booleanIntersects } = await import('@turf/boolean-intersects');
    const fc = await zonesToCategoryUnionAsync([
      rect('a', 'Autorizzazione', 0, 4, { restrictionType: 'auth_required' }),
      rect('p', 'Divieto', 1, 2, { restrictionType: 'prohibited' }),
    ]);
    const auth = fc.features.find((f) => f.properties?.restrictionType === 'auth_required')!;
    expect(auth).toBeDefined();
    const probe = (x0: number, x1: number) => ({
      type: 'Feature' as const, properties: {},
      geometry: { type: 'Polygon' as const,
        coordinates: [[[x0, 0.4], [x1, 0.4], [x1, 0.6], [x0, 0.6], [x0, 0.4]]] },
    });
    // dentro il divieto: l'arancio non c'è più; fuori: c'è ancora
    expect(booleanIntersects(probe(1.3, 1.7), auth as never)).toBe(false);
    expect(booleanIntersects(probe(0.2, 0.6), auth as never)).toBe(true);
    expect(booleanIntersects(probe(2.4, 2.8), auth as never)).toBe(true);
  });
});
