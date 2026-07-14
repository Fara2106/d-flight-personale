// Cache in IndexedDB del mosaico per categoria: il calcolo sul file reale
// costa ~15-20s anche nel worker, ma il risultato dipende SOLO dal dataset
// importato → si paga una volta per import, poi la vista d'insieme è
// istantanea a ogni avvio. Si tiene un solo mosaico (l'import sostituisce
// il dataset precedente).
import type { FeatureCollection } from 'geojson';
import type { Zone } from '../data/ed269.types';
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

export async function loadCachedMosaic(key: string): Promise<FeatureCollection | null> {
  try {
    const rec = await (await db()).get('overlays', RECORD_KEY);
    return rec && rec.zonesKey === key ? rec.fc : null;
  } catch {
    return null; // cache indisponibile = semplice miss
  }
}

export async function saveCachedMosaic(key: string, fc: FeatureCollection): Promise<void> {
  try {
    await (await db()).put('overlays', { zonesKey: key, fc }, RECORD_KEY);
  } catch {
    // salvataggio fallito (quota, DB chiuso): il mosaico verrà ricalcolato
  }
}
