import { describe, it, expect } from 'vitest';
import {
  zonesToGeoJSON,
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

describe('dedup etichette per valore+prossimità (round 9, "0 m" ripetuti)', () => {
  const near = (id: string, name: string, cx: number): Zone => ({
    ...z, id, name, restrictionType: 'prohibited', upperLimitM: 0, verticalRef: 'AGL',
    geometry: { type: 'Polygon',
      coordinates: [[[cx, 41.9], [cx + 0.004, 41.9], [cx + 0.004, 41.904], [cx, 41.9]]] },
  });

  it('stesso testo, nomi diversi, VICINE → una sola primaria', () => {
    const fc = zonesToGeoJSON([near('a', 'Roma A', 12.50), near('b', 'Roma B', 12.505)]);
    const primaries = fc.features.filter((f) => f.properties?.labelPrimary);
    expect(primaries).toHaveLength(1);
  });

  it('stesso testo ma LONTANE → entrambe primarie', () => {
    const fc = zonesToGeoJSON([near('a', 'Roma A', 12.50), near('b', 'Milano B', 9.19)]);
    const primaries = fc.features.filter((f) => f.properties?.labelPrimary);
    expect(primaries).toHaveLength(2);
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

  it('CASCATA COMPLETA: ogni punto mostra solo la categoria più restrittiva (mosaico disgiunto)', async () => {
    const { default: booleanIntersects } = await import('@turf/boolean-intersects');
    // tre rettangoli annidati per x: conditional 0–6, auth 1–4, prohibited 2–3
    const fc = await zonesToCategoryUnionAsync([
      rect('c', 'Cond', 0, 6, { restrictionType: 'conditional' }),
      rect('a', 'Auth', 1, 4, { restrictionType: 'auth_required' }),
      rect('p', 'Div', 2, 3, { restrictionType: 'prohibited' }),
    ]);
    const by = (t: string) => fc.features.find((f) => f.properties?.restrictionType === t)!;
    const probe = (x0: number, x1: number) => ({
      type: 'Feature' as const, properties: {},
      geometry: { type: 'Polygon' as const,
        coordinates: [[[x0, 0.4], [x1, 0.4], [x1, 0.6], [x0, 0.6], [x0, 0.4]]] },
    });
    // nel cuore vietato (x≈2.5): SOLO prohibited
    expect(booleanIntersects(probe(2.4, 2.6), by('prohibited') as never)).toBe(true);
    expect(booleanIntersects(probe(2.4, 2.6), by('auth_required') as never)).toBe(false);
    expect(booleanIntersects(probe(2.4, 2.6), by('conditional') as never)).toBe(false);
    // nell'anello auth (x≈1.5): SOLO auth
    expect(booleanIntersects(probe(1.4, 1.6), by('auth_required') as never)).toBe(true);
    expect(booleanIntersects(probe(1.4, 1.6), by('conditional') as never)).toBe(false);
    // nell'anello esterno (x≈5): SOLO conditional
    expect(booleanIntersects(probe(4.9, 5.1), by('conditional') as never)).toBe(true);
  });

  it('categoria interamente coperta da una più severa → nessuna feature (niente doppio velo)', async () => {
    const fc = await zonesToCategoryUnionAsync([
      rect('a', 'Auth', 1, 2, { restrictionType: 'auth_required' }),
      rect('p', 'Div', 0, 3, { restrictionType: 'prohibited' }),
    ]);
    expect(fc.features.map((f) => f.properties?.restrictionType)).toEqual(['prohibited']);
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
