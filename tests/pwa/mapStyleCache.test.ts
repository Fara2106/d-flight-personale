import { MAP_STYLE_URL_RE } from '../../src/pwa/mapStyleCache';

const inCache = [
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  'https://tiles.basemaps.cartocdn.com/fonts/Montserrat%20Regular/0-255.pbf',
  'https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/sprite.json',
  'https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/sprite@2x.png',
  'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
];
const notInCache = [
  // TILE: mai in cache (decisione A della spec)
  'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/5/16/11.mvt?api_key=x',
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
