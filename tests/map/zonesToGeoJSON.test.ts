import { describe, it, expect } from 'vitest';
import { zonesToGeoJSON } from '../../src/map/zonesToGeoJSON';
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
