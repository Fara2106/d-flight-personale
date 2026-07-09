import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { warmMapCacheOnceControlled } from '../../src/pwa/warmMapCache';

const STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const TILES_JSON = 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json';
const GLYPH = 'https://tiles.basemaps.cartocdn.com/fonts/Montserrat%20Regular/0-255.pbf';
const TILE = 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/5/17/11.mvt?api_key=x';
const APP_ASSET = 'http://localhost/d-flight-personale/assets/index-abc.js';
const PHOTON = 'https://photon.komoot.io/api?q=roma';

type Listener = () => void;
function fakeSw(controller: object | null = null) {
  const listeners: Listener[] = [];
  return {
    controller,
    addEventListener: (type: string, cb: Listener) => {
      if (type === 'controllerchange') listeners.push(cb);
    },
    fire: () => listeners.forEach((cb) => cb()),
    listenerCount: () => listeners.length,
  };
}

describe('warmMapCacheOnceControlled', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('non fa nulla se la pagina è già controllata dal SW', () => {
    const sw = fakeSw({});
    const fetchFn = vi.fn();
    warmMapCacheOnceControlled({ sw, getResourceUrls: () => [STYLE], fetchFn, delayMs: 0 });
    expect(sw.listenerCount()).toBe(0);
    vi.runAllTimers();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('al controllerchange ri-fetcha solo le risorse mappa CARTO, deduplicate', () => {
    const sw = fakeSw(null);
    const fetchFn = vi.fn(() => Promise.resolve());
    warmMapCacheOnceControlled({
      sw,
      getResourceUrls: () => [STYLE, TILES_JSON, GLYPH, TILE, TILE, APP_ASSET, PHOTON],
      fetchFn,
      delayMs: 3000,
    });
    // prima del controllerchange: nessun replay
    vi.advanceTimersByTime(10000);
    expect(fetchFn).not.toHaveBeenCalled();

    sw.fire();
    // il replay attende delayMs (richieste pre-claim ancora in volo)
    vi.advanceTimersByTime(2999);
    expect(fetchFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    const urls = fetchFn.mock.calls.map((c) => c[0]);
    expect(urls).toContain(STYLE);
    expect(urls).toContain(TILES_JSON);
    expect(urls).toContain(GLYPH);
    expect(urls).toContain(TILE);
    expect(urls).toHaveLength(4); // TILE una volta sola; niente asset app né Photon
  });

  it('un fetch che fallisce non propaga errori', async () => {
    const sw = fakeSw(null);
    const fetchFn = vi.fn(() => Promise.reject(new Error('offline')));
    warmMapCacheOnceControlled({ sw, getResourceUrls: () => [STYLE], fetchFn, delayMs: 0 });
    sw.fire();
    vi.runAllTimers();
    await Promise.resolve(); // lascia assestare la rejection gestita
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
