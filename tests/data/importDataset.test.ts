import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { importDataset } from '../../src/data/importDataset';
import { loadZones } from '../../src/data/zoneStore';

const file = (name: string) => JSON.stringify({ features: [{
  identifier: name, name, restriction: 'PROHIBITED',
  geometry: [{ horizontalProjection: { type: 'Polygon',
    coordinates: [[[12.5,41.8],[12.6,41.8],[12.6,41.9],[12.5,41.8]]] },
    upperLimit: 0, uomDimensions: 'M' }] }] });

beforeEach(() => { indexedDB = new IDBFactory(); });

it('first import stores zones and reports all as added', async () => {
  const r = await importDataset(file('Z1'));
  expect(r.meta.zoneCount).toBe(1);
  expect(r.diff.added).toHaveLength(1);
  expect(await loadZones()).toHaveLength(1);
});
it('re-import computes diff against stored zones', async () => {
  await importDataset(file('Z1'));
  const r = await importDataset(file('Z2'));
  expect(r.diff.added.map(z => z.id)).toEqual(['Z2']);
  expect(r.diff.removed.map(z => z.id)).toEqual(['Z1']);
});
