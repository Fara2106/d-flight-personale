// Cache in IndexedDB dell'overlay per categoria: il calcolo sul file reale
// costa ~15-20s anche nel worker, ma il risultato dipende SOLO dal dataset
// importato → si paga una volta per import, poi la vista d'insieme è
// istantanea a ogni avvio. Si tiene un solo overlay (l'import sostituisce
// il dataset precedente).
import type { Zone } from '../data/ed269.types';
import type { CategoryOverlay } from './fastUnion';
import { db } from '../data/db';

const RECORD_KEY = 'category-mosaic';

/** Impronta del dataset: dipende dagli id delle zone, non dal loro ordine. */
export function zonesKey(zones: Zone[]): string {
  const ids = zones.map((z) => z.id).sort();
  // FNV-1a a 32 bit sugli id ordinati
  let h = 0x811c9dc5;
  for (const id of ids) {
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x1f; h = Math.imul(h, 0x01000193) >>> 0; // separatore tra id
  }
  return `${zones.length}:${h.toString(16)}`;
}

export async function loadCachedOverlay(key: string): Promise<CategoryOverlay | null> {
  try {
    const rec = await (await db()).get('overlays', RECORD_KEY);
    if (!rec || rec.zonesKey !== key) return null;
    const ov = rec.overlay;
    // record di formato vecchio (senza outline) → miss: si ricalcola
    if (!ov || !ov.fill || !ov.outline) return null;
    return ov;
  } catch {
    return null; // cache indisponibile = semplice miss
  }
}

export async function saveCachedOverlay(key: string, overlay: CategoryOverlay): Promise<void> {
  try {
    await (await db()).put('overlays', { zonesKey: key, overlay }, RECORD_KEY);
  } catch {
    // salvataggio fallito (quota, DB chiuso): l'overlay verrà ricalcolato
  }
}
