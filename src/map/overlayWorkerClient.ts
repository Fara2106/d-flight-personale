// Calcola il mosaico per categoria in un Web Worker quando possibile
// (il calcolo sul file reale costa ~15-20s: nel main thread congelerebbe
// tutto), con fallback inline per ambienti senza Worker (test jsdom,
// browser antichi) o se il worker va in errore.
import type { FeatureCollection } from 'geojson';
import type { Zone } from '../data/ed269.types';
import { categoryMosaic } from './fastUnion';

async function inline(zones: Zone[]): Promise<FeatureCollection> {
  await new Promise((r) => setTimeout(r, 0)); // lascia respirare la UI
  return categoryMosaic(zones);
}

export function computeCategoryMosaic(zones: Zone[]): Promise<FeatureCollection> {
  if (typeof Worker === 'undefined') return inline(zones);
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./unionWorker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(inline(zones));
      return;
    }
    worker.onmessage = (e: MessageEvent<FeatureCollection>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(inline(zones));
    };
    worker.postMessage(zones);
  });
}
