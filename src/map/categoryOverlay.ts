// Orchestratore della vista d'insieme: prova la cache IndexedDB (overlay
// già calcolato per questo dataset), altrimenti calcola nel worker e salva.
// È il punto d'ingresso usato da MapView.
import type { Zone } from '../data/ed269.types';
import type { CategoryOverlay } from './fastUnion';
import { computeCategoryOverlay } from './overlayWorkerClient';
import { zonesKey, loadCachedOverlay, saveCachedOverlay } from './overlayCache';

export async function categoryOverlayFor(zones: Zone[]): Promise<CategoryOverlay> {
  const key = zonesKey(zones);
  const cached = await loadCachedOverlay(key);
  if (cached) return cached;
  const ov = await computeCategoryOverlay(zones);
  await saveCachedOverlay(key, ov);
  return ov;
}
