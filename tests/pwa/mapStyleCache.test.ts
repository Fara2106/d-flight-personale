import { MAP_STYLE_URL_RE, MAP_TILE_URL_RE } from '../../src/pwa/mapStyleCache';

const inCache = [
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  'https://tiles.basemaps.cartocdn.com/fonts/Montserrat%20Regular/0-255.pbf',
  'https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/sprite.json',
  'https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/sprite@2x.png',
  'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
  // varianti su host shardati (rollout CDN CARTO osservato il 2026-07-09)
  'https://tiles-a.basemaps.cartocdn.com/fonts/Montserrat%20Regular/0-255.pbf',
  'https://tiles-b.basemaps.cartocdn.com/vectortiles/carto.streets/v1/tiles.json',
];
const notInCache = [
  // TILE: hanno la loro cache separata (MAP_TILE_URL_RE)
  'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/5/16/11.mvt?api_key=x',
  'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/5/17/11.mvt',
  // altri host / stessa origine: non riguardano lo stile mappa
  'https://photon.komoot.io/api?q=roma',
  'https://fara2106.github.io/d-flight-personale/assets/index-abc.js',
];

describe('MAP_STYLE_URL_RE (runtime cache stile CARTO)', () => {
  it.each(inCache)('matcha %s', (url) => {
    expect(MAP_STYLE_URL_RE.test(url)).toBe(true);
  });
  it.each(notInCache)('NON matcha %s', (url) => {
    expect(MAP_STYLE_URL_RE.test(url)).toBe(false);
  });
});

describe('MAP_TILE_URL_RE (cache tile limitata, decisione A rivista)', () => {
  it.each([
    'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/5/16/11.mvt?api_key=x',
    'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/0/0/0.mvt',
    // template REALE dal tiles.json CARTO (host shardati + /vectortiles/,
    // osservato il 2026-07-09 — il vecchio pattern non li matchava: bug iPhone)
    'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/5/17/11.mvt',
    'https://tiles-d.basemaps.cartocdn.com/vectortiles/carto.streets/v1/14/8712/5980.mvt?x=1',
  ])('matcha il tile %s', (url) => {
    expect(MAP_TILE_URL_RE.test(url)).toBe(true);
  });
  it.each([
    'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
    'https://tiles-b.basemaps.cartocdn.com/vectortiles/carto.streets/v1/tiles.json',
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    'https://tiles.basemaps.cartocdn.com/fonts/Montserrat%20Regular/0-255.pbf',
    'https://fara2106.github.io/d-flight-personale/assets/index-abc.js',
  ])('NON matcha %s', (url) => {
    expect(MAP_TILE_URL_RE.test(url)).toBe(false);
  });
});
