import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Polygon } from 'geojson';
import { computeCategoryOverlay } from '../../src/map/overlayWorkerClient';
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

describe('computeCategoryOverlay: worker se disponibile, altrimenti inline', () => {
  it('senza Worker (jsdom): calcola inline e restituisce fill+outline', async () => {
    // in jsdom Worker non esiste: il fallback inline deve funzionare
    const ov = await computeCategoryOverlay([zone('a', 'auth_required')]);
    expect(ov.fill.features).toHaveLength(1);
    expect(ov.fill.features[0].properties?.catUnion).toBe(true);
    expect(ov.outline.features[0].properties?.catOutline).toBe(true);
  });

  it('con Worker: inoltra le zone e restituisce ciò che il worker manda', async () => {
    const FAKE = { fill: { type: 'FeatureCollection', features: [] },
                   outline: { type: 'FeatureCollection', features: [] } };
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
    const ov = await computeCategoryOverlay(zones);
    expect(ov).toEqual(FAKE);
    expect(posted).toEqual([zones]);
  });

  it('worker che va in errore → fallback inline (mai lasciare la mappa senza overlay)', async () => {
    class BrokenWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      postMessage() {
        setTimeout(() => this.onerror?.(new Error('boom')), 0);
      }
      terminate() { /* niente */ }
    }
    vi.stubGlobal('Worker', BrokenWorker);
    const ov = await computeCategoryOverlay([zone('a', 'auth_required')]);
    expect(ov.fill.features).toHaveLength(1);
    expect(ov.fill.features[0].properties?.catUnion).toBe(true);
  });
});
