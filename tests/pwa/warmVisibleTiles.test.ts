import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tileUrlsForView, warmVisibleTiles } from '../../src/pwa/warmMapCache';

const T = 'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/{z}/{x}/{y}.mvt';
const SHARDS = ['a', 'b', 'c', 'd'].map(
  (s) => `https://tiles-${s}.basemaps.cartocdn.com/vectortiles/carto.streets/v1/{z}/{x}/{y}.mvt`,
);
// vista Italia d'apertura (zoom 5): copre x 16..17, y 11..12
const ITALY = {
  zoom: 5.3,
  bounds: { west: 6, south: 36, east: 19, north: 47.5 },
};

describe('tileUrlsForView (slippy math per il warm dei tile)', () => {
  it('vista Italia z5: contiene il tile di Roma 5/17/11 e copre 2x2 tile', () => {
    const urls = tileUrlsForView({ templates: [T], ...ITALY });
    expect(urls).toContain(
      'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/5/17/11.mvt',
    );
    expect(urls).toHaveLength(4); // x 16..17 × y 11..12
  });

  it('sceglie lo shard come MapLibre: templates[(x+y) % length]', () => {
    const urls = tileUrlsForView({ templates: SHARDS, ...ITALY });
    // (17+11)%4=0 → shard a; (16+11)%4=3 → shard d
    expect(urls).toContain(
      'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/5/17/11.mvt',
    );
    expect(urls).toContain(
      'https://tiles-d.basemaps.cartocdn.com/vectortiles/carto.streets/v1/5/16/11.mvt',
    );
  });

  it('cappa il numero di tile (maxTiles, default 32)', () => {
    const urls = tileUrlsForView({ templates: [T], zoom: 14, bounds: ITALY.bounds });
    expect(urls.length).toBeLessThanOrEqual(32);
  });

  it('clampa lo zoom tile a [0, 14]', () => {
    const hi = tileUrlsForView({ templates: [T], zoom: 18.7, bounds: ITALY.bounds });
    expect(hi[0]).toContain('/v1/14/');
    const lo = tileUrlsForView({ templates: [T], zoom: -2, bounds: ITALY.bounds });
    expect(lo).toEqual([
      'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/0/0/0.mvt',
    ]);
  });

  it('senza template restituisce []', () => {
    expect(tileUrlsForView({ templates: [], ...ITALY })).toEqual([]);
  });
});

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

describe('warmVisibleTiles (tile della vista dal main thread, prima sessione)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('non fa nulla se la sessione NON è partita senza controller', () => {
    const sw = fakeSw(null);
    const fetchFn = vi.fn();
    warmVisibleTiles(() => ({ templates: [T], ...ITALY }),
      { sw, fetchFn, firstSession: false, delayMs: 0 });
    sw.fire();
    vi.runAllTimers();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('con controller già presente fetcha subito i tile della vista', () => {
    const sw = fakeSw({});
    const fetchFn = vi.fn(() => Promise.resolve());
    warmVisibleTiles(() => ({ templates: [T], ...ITALY }),
      { sw, fetchFn, firstSession: true, delayMs: 0 });
    vi.runAllTimers();
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('senza controller aspetta il controllerchange e legge la vista a quel momento', () => {
    const sw = fakeSw(null);
    const fetchFn = vi.fn(() => Promise.resolve());
    let zoom = 5.3;
    warmVisibleTiles(() => ({ templates: [T], zoom, bounds: ITALY.bounds }),
      { sw, fetchFn, firstSession: true, delayMs: 1000 });
    vi.runAllTimers();
    expect(fetchFn).not.toHaveBeenCalled();
    zoom = -2; // la vista è cambiata prima del claim
    sw.fire();
    vi.advanceTimersByTime(1000);
    expect(fetchFn).toHaveBeenCalledExactlyOnceWith(
      'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/0/0/0.mvt',
    );
  });
});
