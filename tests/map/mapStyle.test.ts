import { describe, it, expect } from 'vitest';
import { mapStyleUrl, ZONE_COLORS } from '../../src/map/mapStyle';

it('returns CARTO positron for light and dark-matter for dark', () => {
  expect(mapStyleUrl('light')).toContain('positron');
  expect(mapStyleUrl('dark')).toContain('dark-matter');
});
it('defines a color per restriction type (palette desaturata 2026-07-10)', () => {
  expect(ZONE_COLORS.prohibited).toBe('#e5484d');
  expect(ZONE_COLORS.none).toBe('#4fae63');
});
