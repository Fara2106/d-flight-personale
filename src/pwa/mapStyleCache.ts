/**
 * Asset "stile mappa" CARTO da tenere in runtime cache (stale-while-revalidate):
 * style.json, glyphs (/fonts/), sprite e tiles.json (metadati sorgente — senza
 * di essi MapLibre non inizializza offline). I TILE veri e propri NON matchano
 * qui: hanno la loro cache limitata separata (MAP_TILE_URL_RE).
 * Host: `tiles.basemaps.cartocdn.com` E gli shard `tiles-{a..d}` con path
 * /vector/ O /vectortiles/ — il 2026-07-09 CARTO ha cambiato il template dei
 * tile in corsa (rollout CDN) e il pattern stretto ha rotto l'offline su
 * iPhone: teniamo entrambe le varianti.
 * RegExp (non funzione): workbox serializza urlPattern nel sw.js generato e
 * una funzione perderebbe la closure sugli import.
 */
export const MAP_STYLE_URL_RE =
  /^https:\/\/(?:basemaps\.cartocdn\.com\/gl\/[^/]+\/style\.json|tiles(?:-[a-z0-9]+)?\.basemaps\.cartocdn\.com\/(?:fonts\/|gl\/[^/]+\/sprite|(?:vector|vectortiles)\/[^/]+\/v1\/tiles\.json))/;

/**
 * Tile vettoriali CARTO (decisione A RIVISTA 2026-07-09, richiesta di Lorenzo
 * al test offline): cache runtime LIMITATA CacheFirst — max 300 tile, TTL 7
 * giorni (config in vite.config.ts) — così offline resta visibile lo sfondo
 * mappa delle aree visitate di recente (l'Italia d'apertura c'è sempre).
 * Il cap tiene la cache piccola (~15 MB) e CacheFirst riduce le richieste al
 * CDN rispetto a nessuna cache. Matcha SOLO i tile {z}/{x}/{y}.mvt — su
 * qualsiasi host `tiles[-shard]` e path /vector/ o /vectortiles/ (template
 * reale del tiles.json CARTO dal 2026-07-09): tiles.json resta in
 * MAP_STYLE_URL_RE (le due regex restano strutturalmente disgiunte: qui
 * servono tre segmenti numerici).
 */
export const MAP_TILE_URL_RE =
  /^https:\/\/tiles(?:-[a-z0-9]+)?\.basemaps\.cartocdn\.com\/(?:vector|vectortiles)\/[^/]+\/v1\/\d+\/\d+\/\d+\.mvt(?:\?|$)/;
