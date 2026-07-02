import { describe, it, expect } from 'vitest';
import { altitudeLabel } from '../../src/map/altitudeLabel';
import type { Zone } from '../../src/data/ed269.types';

const base: Zone = {
  id: 'a',
  name: 'a',
  restrictionType: 'none',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  lowerLimitM: 0,
  upperLimitM: 120,
  verticalRef: 'AGL',
  message: null,
  reasons: [],
  authority: null,
  permanent: true,
};

it('shows max altitude in meters', () => {
  expect(altitudeLabel({ ...base, upperLimitM: 120 })).toBe('120 m');
});

it('shows a no-fly label for prohibited zones', () => {
  expect(altitudeLabel({ ...base, restrictionType: 'prohibited', upperLimitM: 0 })).toBe('⛔ 0 m');
});

it('falls back when altitude is unknown', () => {
  expect(altitudeLabel({ ...base, upperLimitM: null })).toBe('—');
});
