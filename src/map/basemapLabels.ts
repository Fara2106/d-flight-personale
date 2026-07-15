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

export interface PaintTweak { id: string; property: string; value: string }

// Mare/laghi del Dark Matter: grigio #2C353C, quasi indistinguibile dalla
// terra nera → la sagoma dell'Italia si perde (feedback 2026-07-15). In tema
// scuro si passa a un blu notte, come le mappe iOS scure.
const DARK_WATER = '#16324c';
const DARK_WATERWAY = '#2b567e';

/** Ritocchi acqua per il tema scuro: mare blu notte, corsi d'acqua con lui.
 *  Il layer-ombra trasparente resta trasparente. Tema chiaro: mai chiamata. */
export function darkWaterTweaks(layers: LayerSpecification[]): PaintTweak[] {
  const out: PaintTweak[] = [];
  for (const l of layers) {
    const sourceLayer = (l as { 'source-layer'?: string })['source-layer'];
    const paint = (l as { paint?: Record<string, unknown> }).paint ?? {};
    if (l.type === 'fill' && sourceLayer === 'water' && paint['fill-color'] !== 'transparent') {
      out.push({ id: l.id, property: 'fill-color', value: DARK_WATER });
    } else if (l.type === 'line' && sourceLayer === 'waterway') {
      out.push({ id: l.id, property: 'line-color', value: DARK_WATERWAY });
    }
  }
  return out;
}

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
