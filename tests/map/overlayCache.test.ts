import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { FeatureCollection, Polygon } from 'geojson';
import { zonesKey, loadCachedMosaic, saveCachedMosaic } from '../../src/map/overlayCache';
import type { Zone } from '../../src/data/ed269.types';

declare const IDBFactory: any;

beforeEach(() => { indexedDB = new IDBFactory(); });

const rect = (x0: number, x1: number): Polygon => ({
  type: 'Polygon',
  coordinates: [[[x0, 0], [x1, 0], [x1, 1], [x0, 1], [x0, 0]]],
});
const zone = (id: string): Zone => ({
  id, name: id, restrictionType: 'auth_required',
  lowerLimitM: 0, upperLimitM: 120, verticalRef: 'AGL',
  message: null, reasons: [], authority: null, permanent: true,
  geometry: rect(0, 2),
});
const FC: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: rect(0, 2),
    properties: { restrictionType: 'auth_required', catUnion: true } }],
};

describe('zonesKey: identifica il dataset importato', () => {
  it('stessa lista di zone → stessa chiave, anche in ordine diverso', () => {
    const a = [zone('a'), zone('b'), zone('c')];
    const b = [zone('c'), zone('a'), zone('b')];
    expect(zonesKey(a)).toBe(zonesKey(b));
  });

  it('dataset diversi → chiavi diverse', () => {
    expect(zonesKey([zone('a'), zone('b')])).not.toBe(zonesKey([zone('a'), zone('x')]));
    expect(zonesKey([zone('a')])).not.toBe(zonesKey([zone('a'), zone('b')]));
  });
});

describe('cache del mosaico in IndexedDB', () => {
  it('miss: senza nulla in cache risponde null', async () => {
    expect(await loadCachedMosaic('k1')).toBeNull();
  });

  it('hit: dopo il save restituisce il mosaico salvato', async () => {
    await saveCachedMosaic('k1', FC);
    expect(await loadCachedMosaic('k1')).toEqual(FC);
  });

  it('chiave diversa (nuovo import) → miss: mai servire il mosaico di un altro dataset', async () => {
    await saveCachedMosaic('k1', FC);
    expect(await loadCachedMosaic('k2')).toBeNull();
  });

  it('un nuovo save sostituisce il precedente (un solo dataset alla volta)', async () => {
    await saveCachedMosaic('k1', FC);
    const FC2: FeatureCollection = { type: 'FeatureCollection', features: [] };
    await saveCachedMosaic('k2', FC2);
    expect(await loadCachedMosaic('k2')).toEqual(FC2);
    expect(await loadCachedMosaic('k1')).toBeNull();
  });
});
