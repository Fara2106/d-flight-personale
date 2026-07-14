// Etichette dei luoghi del basemap (feedback 2026-07-14: "più etichette sui
// luoghi"). Due leve: (1) le zone vanno INSERITE SOTTO i layer symbol del
// basemap, così i nomi restano sopra i veli; (2) le etichette place di
// città/paesi/frazioni vengono anticipate di 1.5 livelli di zoom.
import type { LayerSpecification } from 'maplibre-gl';

/** Primo layer symbol dello stile: è il beforeId per i layer zona.
 *  undefined (stile senza symbol, es. mock E2E) = zone in cima come prima. */
export function firstSymbolLayerId(layers: LayerSpecification[]): string | undefined {
  return layers.find((l) => l.type === 'symbol')?.id;
}

export interface LabelBoost { id: string; minzoom: number }

/** Etichette place da anticipare: solo quelle con minzoom ≥ 6 (città, paesi,
 *  sobborghi, frazioni). Stati/continenti compaiono già prestissimo.
 *  Anticipo di 2 livelli: la sonda sui tile CARTO (2026-07-14) mostra che i
 *  dati ci sono ben prima del minzoom dello stile (paesi a z8, città a z7). */
export function placeLabelBoosts(layers: LayerSpecification[]): LabelBoost[] {
  const out: LabelBoost[] = [];
  for (const l of layers) {
    if (l.type !== 'symbol') continue;
    const sourceLayer = (l as { 'source-layer'?: string })['source-layer'];
    if (sourceLayer !== 'place') continue;
    if (l.minzoom == null || l.minzoom < 6) continue;
    out.push({ id: l.id, minzoom: Math.max(5, l.minzoom - 2) });
  }
  return out;
}
