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

/**
 * Tile vettoriali CARTO (decisione A RIVISTA 2026-07-09, richiesta di Lorenzo
 * al test offline): cache runtime LIMITATA CacheFirst — max 300 tile, TTL 7
 * giorni (config in vite.config.ts) — così offline resta visibile lo sfondo
 * mappa delle aree visitate di recente (l'Italia d'apertura c'è sempre).
 * Il cap tiene la cache piccola (~15 MB) e CacheFirst riduce le richieste al
 * CDN rispetto a nessuna cache. Matcha SOLO i tile {z}/{x}/{y}.mvt:
 * tiles.json resta in MAP_STYLE_URL_RE.
 */
export const MAP_TILE_URL_RE =
  /^https:\/\/tiles\.basemaps\.cartocdn\.com\/vector\/[^/]+\/v1\/\d+\/\d+\/\d+\.mvt(?:\?|$)/;
