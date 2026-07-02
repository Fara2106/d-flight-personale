import { describe, it, expect } from 'vitest';
import { diffZones } from '../../src/data/diffZones';
import type { Zone } from '../../src/data/ed269.types';

const z = (id: string, upper: number | null): Zone => ({
  id, name: id, restrictionType: 'none',
  geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] },
  lowerLimitM: 0, upperLimitM: upper, verticalRef: 'AGL',
  message: null, reasons: [], authority: null, permanent: true,
});

it('detects added, removed and modified zones', () => {
  const prev = [z('a', 120), z('b', 60)];
  const next = [z('a', 120), z('b', 90), z('c', 30)];
  const d = diffZones(prev, next);
  expect(d.added.map(x => x.id)).toEqual(['c']);
  expect(d.removed.map(x => x.id)).toEqual([]);
  expect(d.modified.map(x => x.id)).toEqual(['b']);
});
it('handles empty previous (first import)', () => {
  const d = diffZones([], [z('a', 120)]);
  expect(d.added).toHaveLength(1);
  expect(d.modified).toHaveLength(0);
});
