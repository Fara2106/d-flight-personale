// tests/verify/verifyLayers.test.ts
import { it, expect } from 'vitest';
import { circleFeature } from '../../src/verify/verifyLayers';

it('raggio 0 → null (verifica puntuale, nessun cerchio da disegnare)', () => {
  expect(circleFeature(42, 12.5, 0)).toBeNull();
});

it('raggio 100 → poligono chiuso centrato sul punto', () => {
  const f = circleFeature(42, 12.5, 100);
  expect(f?.geometry.type).toBe('Polygon');
  const ring = f!.geometry.coordinates[0];
  expect(ring.length).toBeGreaterThan(32);
  const lons = ring.map(c => c[0]);
  expect((Math.min(...lons) + Math.max(...lons)) / 2).toBeCloseTo(12.5, 3);
});
