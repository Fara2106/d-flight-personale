/**
 * Asset "stile mappa" CARTO da tenere in runtime cache (stale-while-revalidate):
 * style.json, glyphs (/fonts/), sprite e tiles.json (metadati sorgente — senza
 * di essi MapLibre non inizializza offline). I TILE veri e propri
 * (/vector/carto.streets/v1/{z}/{x}/{y}…) NON matchano: restano network-only
 * per rispettare i TOS del basemap free (decisione A della spec Fase 3).
 * RegExp (non funzione): workbox serializza urlPattern nel sw.js generato e
 * una funzione perderebbe la closure sugli import.
 */
export const MAP_STYLE_URL_RE =
  /^https:\/\/(?:basemaps\.cartocdn\.com\/gl\/[^/]+\/style\.json|tiles\.basemaps\.cartocdn\.com\/(?:fonts\/|gl\/[^/]+\/sprite|vector\/[^/]+\/v1\/tiles\.json))/;
