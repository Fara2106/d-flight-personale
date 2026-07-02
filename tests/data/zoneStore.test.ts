import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveDataset, loadZones, loadMeta } from '../../src/data/zoneStore';
import type { Zone } from '../../src/data/ed269.types';

declare const IDBFactory: any;

const z: Zone = { id: 'a', name: 'A', restrictionType: 'none',
  geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] },
  lowerLimitM: 0, upperLimitM: 120, verticalRef: 'AGL',
  message: null, reasons: [], authority: null, permanent: true };

beforeEach(async () => {
  indexedDB = new IDBFactory(); // reset DB tra i test
});

it('returns empty/null before any import', async () => {
  expect(await loadZones()).toEqual([]);
  expect(await loadMeta()).toBeNull();
});
it('saves and loads zones and meta', async () => {
  const meta = { cycleDate: '2026-06-26', importedAt: '2026-06-30T10:00:00Z', zoneCount: 1 };
  await saveDataset([z], meta);
  expect(await loadZones()).toHaveLength(1);
  expect((await loadMeta())?.zoneCount).toBe(1);
});
it('replaces the dataset on re-import', async () => {
  await saveDataset([z], { cycleDate: null, importedAt: 'x', zoneCount: 1 });
  await saveDataset([], { cycleDate: null, importedAt: 'y', zoneCount: 0 });
  expect(await loadZones()).toEqual([]);
});
