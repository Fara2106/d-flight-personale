import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Polygon } from 'geojson';
import { computeCategoryMosaic } from '../../src/map/overlayWorkerClient';
import type { Zone } from '../../src/data/ed269.types';

const rect = (x0: number, x1: number): Polygon => ({
  type: 'Polygon',
  coordinates: [[[x0, 0], [x1, 0], [x1, 1], [x0, 1], [x0, 0]]],
});
const zone = (id: string, type: Zone['restrictionType']): Zone => ({
  id, name: id, restrictionType: type,
  lowerLimitM: 0, upperLimitM: 120, verticalRef: 'AGL',
  message: null, reasons: [], authority: null, permanent: true,
  geometry: rect(0, 2),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('computeCategoryMosaic: worker se disponibile, altrimenti inline', () => {
  it('senza Worker (jsdom): calcola inline e restituisce il mosaico', async () => {
    // in jsdom Worker non esiste: il fallback inline deve funzionare
    const fc = await computeCategoryMosaic([zone('a', 'auth_required')]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.catUnion).toBe(true);
  });

  it('con Worker: usa il worker e restituisce il suo risultato', async () => {
    const FAKE = { type: 'FeatureCollection', features: [] };
    const posted: unknown[] = [];
    class FakeWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      terminated = false;
      postMessage(data: unknown) {
        posted.push(data);
        setTimeout(() => this.onmessage?.({ data: FAKE }), 0);
      }
      terminate() { this.terminated = true; }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const zones = [zone('a', 'auth_required')];
    const fc = await computeCategoryMosaic(zones);
    expect(fc).toEqual(FAKE);
    expect(posted).toEqual([zones]);
  });

  it('worker che va in errore → fallback inline (mai lasciare la mappa senza mosaico)', async () => {
    class BrokenWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      postMessage() {
        setTimeout(() => this.onerror?.(new Error('boom')), 0);
      }
      terminate() { /* niente */ }
    }
    vi.stubGlobal('Worker', BrokenWorker);
    const fc = await computeCategoryMosaic([zone('a', 'auth_required')]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.catUnion).toBe(true);
  });
});
