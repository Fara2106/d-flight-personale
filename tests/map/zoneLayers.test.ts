import { describe, it, expect } from 'vitest';
import { buildFillPaint, highlightFilter } from '../../src/map/MapView';

it('maps restriction types to colors via a data-driven expression', () => {
  const paint = buildFillPaint() as any;
  const expr = JSON.stringify(paint['fill-color']);
  expect(expr).toContain('prohibited');
  expect(expr).toContain('#ef4444');
  expect(paint['fill-opacity']).toBeGreaterThan(0);
});

it('highlightFilter: id selezionato o sentinella che non matcha nulla', () => {
  expect(highlightFilter('z9')).toEqual(['==', ['get', 'id'], 'z9']);
  expect(highlightFilter(null)).toEqual(['==', ['get', 'id'], '__none__']);
});
