// tests/verify/intersect.test.ts
import { it, expect } from 'vitest';
import { zonesAtPoint } from '../../src/verify/intersect';
import type { Zone } from '../../src/data/ed269.types';

// Quadrato ~222 m di lato: lon/lat ∈ [0, 0.002] (all'equatore 0.001° ≈ 111 m)
function square(id: string, x0 = 0, y0 = 0, s = 0.002): Zone {
  return { id, name: id, restrictionType: 'conditional',
    geometry: { type: 'Polygon', coordinates: [[
      [x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]]] },
    lowerLimitM: 0, upperLimitM: 60, verticalRef: 'AGL',
    message: null, reasons: [], authority: null, permanent: true };
}

it('punto dentro (raggio 0)', () => {
  expect(zonesAtPoint([square('a')], { lat: 0.001, lon: 0.001, radiusM: 0 })).toHaveLength(1);
});

it('punto fuori (raggio 0)', () => {
  expect(zonesAtPoint([square('a')], { lat: 0.01, lon: 0.01, radiusM: 0 })).toHaveLength(0);
});

it('punto sul bordo conta come dentro (conservativo)', () => {
  expect(zonesAtPoint([square('a')], { lat: 0.001, lon: 0, radiusM: 0 })).toHaveLength(1);
});

it('cerchio che interseca senza contenere il centro', () => {
  // centro a lon 0.004 (~222 m dal bordo destro del quadrato)
  const hit = zonesAtPoint([square('a')], { lat: 0.001, lon: 0.004, radiusM: 300 });
  expect(hit).toHaveLength(1);
  const miss = zonesAtPoint([square('a')], { lat: 0.001, lon: 0.004, radiusM: 100 });
  expect(miss).toHaveLength(0);
});

it('multi-zona sovrapposte: le ritorna tutte, in ordine di input', () => {
  const zs = [square('a'), square('b', 0.001, 0.001)];
  const hit = zonesAtPoint(zs, { lat: 0.0015, lon: 0.0015, radiusM: 0 });
  expect(hit.map(z => z.id)).toEqual(['a', 'b']);
});
