import { describe, it, expect } from 'vitest';
import { buildFillPaint } from '../../src/map/MapView';

it('maps restriction types to colors via a data-driven expression', () => {
  const paint = buildFillPaint() as any;
  const expr = JSON.stringify(paint['fill-color']);
  expect(expr).toContain('prohibited');
  expect(expr).toContain('#ef4444');
  expect(paint['fill-opacity']).toBeGreaterThan(0);
});
