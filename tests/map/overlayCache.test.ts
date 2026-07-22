import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { FeatureCollection, Polygon } from 'geojson';
import { zonesKey, loadCachedOverlay, saveCachedOverlay } from '../../src/map/overlayCache';
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
const OV = { fill: FC, outline: FC };

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

describe('cache dell\'overlay in IndexedDB', () => {
  it('miss: senza nulla in cache risponde null', async () => {
    expect(await loadCachedOverlay('k1')).toBeNull();
  });

  it('hit: dopo il save restituisce l\'overlay salvato', async () => {
    await saveCachedOverlay('k1', OV);
    expect(await loadCachedOverlay('k1')).toEqual(OV);
  });

  it('chiave diversa (nuovo import) → miss: mai servire l\'overlay di un altro dataset', async () => {
    await saveCachedOverlay('k1', OV);
    expect(await loadCachedOverlay('k2')).toBeNull();
  });

  it('un nuovo save sostituisce il precedente (un solo dataset alla volta)', async () => {
    await saveCachedOverlay('k1', OV);
    const OV2 = { fill: { type: 'FeatureCollection', features: [] } as FeatureCollection,
      outline: { type: 'FeatureCollection', features: [] } as FeatureCollection };
    await saveCachedOverlay('k2', OV2);
    expect(await loadCachedOverlay('k2')).toEqual(OV2);
    expect(await loadCachedOverlay('k1')).toBeNull();
  });

  it('formato vecchio (senza outline) = miss, così si ricalcola', async () => {
    // salva a mano un record vecchio-stile e verifica che load lo ignori
    const { db } = await import('../../src/data/db');
    await (await db()).put('overlays', { zonesKey: 'k', fc: FC } as any, 'category-mosaic');
    expect(await loadCachedOverlay('k')).toBeNull();
  });
});
