// Orchestratore della vista d'insieme: prova la cache IndexedDB (mosaico
// già calcolato per questo dataset), altrimenti calcola nel worker e salva.
// È il punto d'ingresso usato da MapView.
import type { FeatureCollection } from 'geojson';
import type { Zone } from '../data/ed269.types';
import { computeCategoryMosaic } from './overlayWorkerClient';
import { zonesKey, loadCachedMosaic, saveCachedMosaic } from './overlayCache';

export async function categoryMosaicFor(zones: Zone[]): Promise<FeatureCollection> {
  const key = zonesKey(zones);
  const cached = await loadCachedMosaic(key);
  if (cached) return cached;
  const fc = await computeCategoryMosaic(zones);
  await saveCachedMosaic(key, fc);
  return fc;
}
