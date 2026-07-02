import { describe, it, expect } from 'vitest';
import { mapStyleUrl, ZONE_COLORS } from '../../src/map/mapStyle';

it('returns CARTO positron for light and dark-matter for dark', () => {
  expect(mapStyleUrl('light')).toContain('positron');
  expect(mapStyleUrl('dark')).toContain('dark-matter');
});
it('defines a color per restriction type', () => {
  expect(ZONE_COLORS.prohibited).toBe('#ef4444');
  expect(ZONE_COLORS.none).toBe('#22c55e');
});
