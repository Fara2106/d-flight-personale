import { MAP_STYLE_URL_RE, MAP_TILE_URL_RE } from './mapStyleCache';

/**
 * Al primissimo avvio il SW si installa mentre MapLibre ha già scaricato
 * stile e tile: quelle richieste non passano dal SW e le cache runtime
 * restano vuote → offline niente mappa (bug trovato al test iPhone,
 * 2026-07-09). Con clientsClaim il SW prende il controllo della pagina
 * appena attivo; qui, a quel punto, ri-fetchiamo le risorse CARTO già
 * scaricate (lette dalla Performance timeline): il replay passa dal SW e
 * popola le cache, così l'offline funziona già dopo la prima sessione online.
 */
const REPLAY_DELAY_MS = 3000; // le richieste partite pre-claim finiscono di arrivare

type Deps = {
  sw?: Pick<ServiceWorkerContainer, 'controller' | 'addEventListener'>;
  getResourceUrls?: () => string[];
  fetchFn?: (url: string) => Promise<unknown>;
  delayMs?: number;
};

export type TileViewState = {
  templates: string[]; // template tile con {z}/{x}/{y} (dal tiles.json CARTO)
  zoom: number;
  bounds: { west: number; south: number; east: number; north: number };
};

/**
 * Tile (slippy map) che coprono la vista corrente, con lo STESSO shard che
 * sceglierà MapLibre — `templates[(x+y) % length]`, vedi
 * maplibre-gl/src/tile/tile_id.ts — così l'URL warmato coincide esattamente
 * con quello che i worker chiederanno e la CacheFirst fa hit.
 */
export function tileUrlsForView(
  { templates, zoom, bounds }: TileViewState,
  { minZoom = 0, maxZoom = 14, maxTiles = 32 } = {},
): string[] {
  if (templates.length === 0) return [];
  const z = Math.min(maxZoom, Math.max(minZoom, Math.floor(zoom)));
  const n = 2 ** z;
  const clamp = (v: number) => Math.min(n - 1, Math.max(0, v));
  const lon2x = (lon: number) => clamp(Math.floor(((lon + 180) / 360) * n));
  const lat2y = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return clamp(Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n));
  };
  const [x0, x1] = [lon2x(bounds.west), lon2x(bounds.east)];
  const [y0, y1] = [lat2y(bounds.north), lat2y(bounds.south)]; // y cresce verso sud
  const urls: string[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (urls.length >= maxTiles) return urls;
      const t = templates[(x + y) % templates.length];
      urls.push(t.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
    }
  }
  return urls;
}

/**
 * True se questa pagina è partita SENZA un SW controllante (prima sessione
 * dopo l'install). Solo in quel caso serve warmare i tile dal main thread: i
 * worker MapLibre creati pre-claim bypassano il SW (e le loro fetch non
 * compaiono nella Performance timeline della pagina, quindi il replay di
 * warmMapCacheOnceControlled non può vederle). Dalla seconda sessione i worker
 * nascono controllati e la CacheFirst intercetta da sola — warmare lì
 * raddoppierebbe le richieste di rete.
 */
const STARTED_FIRST_SESSION =
  typeof navigator !== 'undefined' &&
  !!navigator.serviceWorker &&
  !navigator.serviceWorker.controller;

type WarmTilesDeps = {
  sw?: Pick<ServiceWorkerContainer, 'controller' | 'addEventListener'>;
  fetchFn?: (url: string) => Promise<unknown>;
  firstSession?: boolean;
  delayMs?: number;
};

/**
 * Fetcha dal main thread i tile della vista corrente così passano dal SW e
 * finiscono nella cache CacheFirst (sfondo mappa offline). Da chiamare a ogni
 * assestamento della vista (load/idle/moveend): no-op fuori dalla prima
 * sessione. `getView` è letto al momento del fetch (post-claim la vista può
 * essere cambiata).
 */
let waitingForClaim = false;

export function warmVisibleTiles(
  getView: () => TileViewState,
  {
    sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
    fetchFn = (url) => fetch(url),
    firstSession = STARTED_FIRST_SESSION,
    delayMs = REPLAY_DELAY_MS,
  }: WarmTilesDeps = {},
): void {
  if (!sw || !firstSession) return;
  const warm = () => {
    for (const u of tileUrlsForView(getView())) void fetchFn(u).catch(() => {});
  };
  if (sw.controller) warm();
  else if (!waitingForClaim) {
    // una sola attesa del claim anche con più moveend pre-claim: getView legge
    // comunque la vista fresca al momento del fetch
    waitingForClaim = true;
    sw.addEventListener(
      'controllerchange',
      () => setTimeout(() => { waitingForClaim = false; warm(); }, delayMs),
      { once: true },
    );
  }
}

export function warmMapCacheOnceControlled({
  sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
  getResourceUrls = () =>
    performance.getEntriesByType('resource').map((e) => e.name),
  fetchFn = (url) => fetch(url),
  delayMs = REPLAY_DELAY_MS,
}: Deps = {}): void {
  if (!sw || sw.controller) return; // pagina già controllata: fetch già intercettate
  // il buffer di default (250 entry) può scartare i primi tile su pagine ricche
  performance.setResourceTimingBufferSize?.(1000);
  sw.addEventListener(
    'controllerchange',
    () => {
      setTimeout(() => {
        const urls = new Set(
          getResourceUrls().filter(
            (u) => MAP_STYLE_URL_RE.test(u) || MAP_TILE_URL_RE.test(u),
          ),
        );
        for (const u of urls) void fetchFn(u).catch(() => {});
      }, delayMs);
    },
    { once: true },
  );
}
