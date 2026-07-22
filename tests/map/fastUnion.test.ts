import { describe, it, expect } from 'vitest';
import booleanIntersects from '@turf/boolean-intersects';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { MultiPolygon, Polygon } from 'geojson';
import { snapGeometry, unionAll, categoryMosaic, categoryOutlines, categoryOverlay } from '../../src/map/fastUnion';
import type { Zone } from '../../src/data/ed269.types';

const rectGeom = (x0: number, x1: number, y0 = 0, y1 = 1): Polygon => ({
  type: 'Polygon',
  coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
});

const z: Zone = {
  id: 'z', name: 'Zona', restrictionType: 'auth_required',
  lowerLimitM: 0, upperLimitM: 120, verticalRef: 'AGL',
  message: null, reasons: [], authority: null, permanent: true,
  geometry: rectGeom(0, 1),
};
const zone = (id: string, g: Polygon, type: Zone['restrictionType']): Zone =>
  ({ ...z, id, name: id, restrictionType: type, geometry: g });

describe('snapGeometry: coordinate arrotondate a ~1e-6 (robustezza union)', () => {
  it('arrotonda le coordinate a 6 decimali', () => {
    const g = snapGeometry({ type: 'Polygon', coordinates: [[
      [12.00000012345, 41.99999987654], [12.1000000999, 42.0],
      [12.1, 42.1000004999], [12.00000012345, 41.99999987654],
    ]] });
    expect(g).toEqual({ type: 'Polygon', coordinates: [[
      [12, 42], [12.1, 42], [12.1, 42.1], [12, 42],
    ]] });
  });

  it('richiude l\'anello se lo snap ha fuso il primo/ultimo punto e scarta anelli degeneri', () => {
    // dopo lo snap restano 3 punti distinti → anello degenere → null
    const g = snapGeometry({ type: 'Polygon', coordinates: [[
      [0, 0], [0.0000001, 0.0000001], [1, 0], [0, 0],
    ]] });
    expect(g).toBeNull();
  });

  it('MultiPolygon: tiene solo i poligoni con anelli validi', () => {
    const g = snapGeometry({ type: 'MultiPolygon', coordinates: [
      rectGeom(0, 1).coordinates,
      [[[0, 0], [0.0000001, 0], [0, 0.0000001], [0, 0]]], // degenere
    ] });
    expect(g).toEqual({ type: 'MultiPolygon', coordinates: [rectGeom(0, 1).coordinates] });
  });
});

describe('unionAll: fusione ad albero (sort spaziale + batch)', () => {
  it('rettangoli sovrapposti → una sola feature che copre tutto', () => {
    const { merged, failures } = unionAll([
      rectGeom(0, 2), rectGeom(1, 3), rectGeom(2.5, 4),
    ]);
    expect(failures).toBe(0);
    expect(merged).toHaveLength(1);
    const xs = (merged[0].geometry as Polygon).coordinates.flat(1).map((c) => c[0]);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(4);
  });

  it('molte geometrie (più di un batch foglia) → sempre una sola feature', () => {
    // 100 rettangoli sovrapposti a catena: copre 0..101
    const geoms = Array.from({ length: 100 }, (_, i) => rectGeom(i, i + 2));
    const { merged, failures } = unionAll(geoms);
    expect(failures).toBe(0);
    expect(merged).toHaveLength(1);
    const xs = (merged[0].geometry as Polygon).coordinates.flat(1).map((c) => c[0]);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(101);
  });

  it('geometrie disgiunte → una feature MultiPolygon (copertura intatta)', () => {
    const { merged } = unionAll([rectGeom(0, 1), rectGeom(5, 6)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].geometry.type).toBe('MultiPolygon');
  });
});

describe('categoryMosaic: mosaico piatto per categoria (sincrono, per il worker)', () => {
  it('stessa semantica della cascata: il vietato buca le categorie meno severe', () => {
    const fc = categoryMosaic([
      zone('a', rectGeom(0, 4), 'auth_required'),
      zone('p', rectGeom(1, 2), 'prohibited'),
    ]);
    const auth = fc.features.find((f) => f.properties?.restrictionType === 'auth_required')!;
    const probe = (x0: number, x1: number) => ({
      type: 'Feature' as const, properties: {},
      geometry: rectGeom(x0, x1, 0.4, 0.6),
    });
    expect(booleanIntersects(probe(1.3, 1.7), auth as never)).toBe(false);
    expect(booleanIntersects(probe(0.2, 0.6), auth as never)).toBe(true);
  });

  it('categoria interamente coperta → nessuna feature', () => {
    const fc = categoryMosaic([
      zone('a', rectGeom(1, 2), 'auth_required'),
      zone('p', rectGeom(0, 3), 'prohibited'),
    ]);
    expect(fc.features.map((f) => f.properties?.restrictionType)).toEqual(['prohibited']);
  });

  it('le feature portano catUnion=true (stesse properties della vista d\'insieme)', () => {
    const fc = categoryMosaic([zone('a', rectGeom(0, 1), 'auth_required')]);
    expect(fc.features[0].properties?.catUnion).toBe(true);
  });
});

describe('categoryOutlines: contorni cumulativi per severità (round 9)', () => {
  it('una feature per soglia; niente contorno per "none"', () => {
    const fc = categoryOutlines([
      zone('p', rectGeom(0, 1), 'prohibited'),
      zone('a', rectGeom(0, 3), 'auth_required'),
      zone('n', rectGeom(0, 5), 'none'),
    ]);
    const types = fc.features.map((f) => f.properties?.restrictionType).sort();
    expect(types).toEqual(['auth_required', 'prohibited']);
    expect(fc.features.every((f) => f.properties?.catOutline === true)).toBe(true);
  });

  it('il blob cumulativo di una soglia CONTIENE le categorie più severe', () => {
    // auth cumulativo = union(prohibited ∪ auth): copre il punto interno al prohibited
    const fc = categoryOutlines([
      zone('p', rectGeom(0, 1), 'prohibited'),
      zone('a', rectGeom(2, 3), 'auth_required'), // disgiunto dal prohibited
    ]);
    const auth = fc.features.find((f) => f.properties?.restrictionType === 'auth_required')!;
    const g = auth.geometry as Polygon | MultiPolygon;
    // il contorno auth abbraccia sia il prohibited (x≈0.5) sia l'auth (x≈2.5)
    expect(booleanPointInPolygon([0.5, 0.5], g)).toBe(true);
    expect(booleanPointInPolygon([2.5, 0.5], g)).toBe(true);
  });

  it('categoryOverlay: ritorna sia i veli (fill) sia i contorni (outline)', () => {
    const ov = categoryOverlay([
      zone('p', rectGeom(0, 1), 'prohibited'),
      zone('a', rectGeom(0, 3), 'auth_required'),
    ]);
    expect(ov.fill.features.every((f) => f.properties?.catUnion === true)).toBe(true);
    expect(ov.outline.features.every((f) => f.properties?.catOutline === true)).toBe(true);
  });
});
