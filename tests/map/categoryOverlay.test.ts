import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { FeatureCollection, Polygon } from 'geojson';
import { categoryMosaicFor } from '../../src/map/categoryOverlay';
import { zonesKey, saveCachedMosaic, loadCachedMosaic } from '../../src/map/overlayCache';
import type { Zone } from '../../src/data/ed269.types';

declare const IDBFactory: any;

beforeEach(() => { indexedDB = new IDBFactory(); });
afterEach(() => { vi.unstubAllGlobals(); });

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

describe('categoryMosaicFor: cache → worker/inline → save', () => {
  it('cache hit: restituisce il mosaico salvato SENZA ricalcolare', async () => {
    const zones = [zone('a')];
    const cached: FeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: rect(9, 10),
        properties: { restrictionType: 'prohibited', catUnion: true, marker: 'dalla-cache' } }],
    };
    await saveCachedMosaic(zonesKey(zones), cached);
    // se provasse a calcolare col worker, questo stub esploderebbe
    class BombWorker { constructor() { throw new Error('non doveva calcolare'); } }
    vi.stubGlobal('Worker', BombWorker);
    const fc = await categoryMosaicFor(zones);
    expect(fc).toEqual(cached);
  });

  it('cache miss: calcola (inline in jsdom) e salva il risultato in cache', async () => {
    const zones = [zone('a')];
    const fc = await categoryMosaicFor(zones);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.catUnion).toBe(true);
    expect(await loadCachedMosaic(zonesKey(zones))).toEqual(fc);
  });
});
