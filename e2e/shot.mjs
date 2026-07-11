// Screenshot dell'area Fiumicino con la fixture densa: per confronti visivi
// di leggibilità (before/after) nei due temi.
// Uso: node e2e/shot.mjs <urlBase> <outPrefix> [zoom]
// Es.:  node e2e/shot.mjs http://localhost:5199/d-flight-personale/ /tmp/before 10.3
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , base, outPrefix = '/tmp/shot', zoomArg] = process.argv;
const zoom = Number(zoomArg ?? 10.3);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 700 }, deviceScaleFactor: 2, // iPhone-ish
});
page.on('pageerror', (e) => console.error('PAGEERROR:', String(e).slice(0, 200)));

// MOCK_CDN=1: ambienti senza accesso a basemaps.cartocdn.com (sandbox CI).
// Style = basemap FINTA ma visibile (mare, strade, nomi città) così il
// giudizio estetico sulle zone ha un contesto realistico; glyphs reali da
// smp-noto-glyphs (npm). Deterministica: stessa inquadratura before/after.
function fakeBasemap(dark) {
  const CX = 12.24, CY = 41.77;
  let seed = 42;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const roads = { type: 'FeatureCollection', features: [] };
  const wiggly = (x0, y0, x1, y1, n = 8) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + (rnd() - 0.5) * 0.01,
        y0 + (y1 - y0) * t + (rnd() - 0.5) * 0.01]);
    }
    return pts;
  };
  const line = (cls, coords) => roads.features.push({
    type: 'Feature', properties: { cls },
    geometry: { type: 'LineString', coordinates: coords } });
  // "autostrade" diagonali + raccordo ad anello
  line('major', wiggly(CX - 0.35, CY - 0.25, CX + 0.4, CY + 0.28, 14));
  line('major', wiggly(CX - 0.30, CY + 0.30, CX + 0.35, CY - 0.22, 14));
  const ring = [];
  for (let i = 0; i <= 32; i++) {
    const a = (2 * Math.PI * i) / 32;
    ring.push([CX + 0.16 + 0.1 * Math.cos(a), CY + 0.05 + 0.08 * Math.sin(a)]);
  }
  line('major', ring);
  // reticolo urbano minore
  for (let i = 0; i < 22; i++) {
    const h = rnd() > 0.5;
    const c0 = CX + (rnd() - 0.5) * 0.7, c1 = CY + (rnd() - 0.5) * 0.55;
    line('minor', h ? wiggly(c0 - 0.12, c1, c0 + 0.12, c1 + (rnd() - 0.5) * 0.04)
      : wiggly(c0, c1 - 0.10, c0 + (rnd() - 0.5) * 0.04, c1 + 0.10));
  }
  const sea = { type: 'Feature', properties: {}, geometry: { type: 'Polygon',
    coordinates: [[[11.7, 41.4], [12.23, 41.55], [12.20, 41.72], [12.12, 41.92],
      [11.98, 42.15], [11.7, 42.15], [11.7, 41.4]]] } };
  const towns = { type: 'FeatureCollection', features: [
    { name: 'Fiumicino', xy: [12.237, 41.766] },
    { name: 'Ostia', xy: [12.29, 41.73] },
    { name: 'Roma', xy: [12.48, 41.89] },
    { name: 'Ladispoli', xy: [12.07, 41.95] },
  ].map((t) => ({ type: 'Feature', properties: { name: t.name },
    geometry: { type: 'Point', coordinates: t.xy } })) };
  return {
    version: 8,
    glyphs: 'https://basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
    sources: {
      sea: { type: 'geojson', data: sea },
      roads: { type: 'geojson', data: roads },
      towns: { type: 'geojson', data: towns },
    },
    layers: [
      { id: 'bg', type: 'background',
        paint: { 'background-color': dark ? '#14181f' : '#f2f0eb' } },
      { id: 'sea', type: 'fill', source: 'sea',
        paint: { 'fill-color': dark ? '#0d2233' : '#cfe2ec' } },
      { id: 'roads-minor', type: 'line', source: 'roads',
        filter: ['==', ['get', 'cls'], 'minor'],
        paint: { 'line-color': dark ? '#2b333d' : '#ffffff', 'line-width': 1.4 } },
      { id: 'roads-major', type: 'line', source: 'roads',
        filter: ['==', ['get', 'cls'], 'major'],
        paint: { 'line-color': dark ? '#3d4855' : '#f7d488', 'line-width': 3 } },
      { id: 'town-names', type: 'symbol', source: 'towns',
        layout: { 'text-field': ['get', 'name'], 'text-size': 13,
          'text-font': ['Noto Sans Regular'] },
        paint: { 'text-color': dark ? '#9aa7b5' : '#6b7280',
          'text-halo-color': dark ? '#14181f' : '#f2f0eb', 'text-halo-width': 1.2 } },
    ],
  };
}

if (process.env.MOCK_CDN === '1') {
  const { readFileSync, existsSync } = await import('node:fs');
  await page.route('https://basemaps.cartocdn.com/**', async (route) => {
    const url = route.request().url();
    const mStyle = url.match(/\/gl\/([a-z-]+)-gl-style\/style\.json/);
    if (mStyle) return route.fulfill({ json: fakeBasemap(mStyle[1].includes('dark')) });
    const mGlyph = url.match(/\/fonts\/[^/]+\/(\d+-\d+)\.pbf/);
    if (mGlyph) {
      const p = join(root, `node_modules/smp-noto-glyphs/fixtures/glyphs/${mGlyph[1]}.pbf`);
      if (existsSync(p)) return route.fulfill({ body: readFileSync(p), contentType: 'application/x-protobuf' });
      return route.fulfill({ status: 204, body: '' });
    }
    return route.abort();
  });
}

async function mapIdle() {
  await page.waitForSelector('[data-map-idle]', { state: 'detached', timeout: 3000 }).catch(() => {});
  await page.waitForSelector('[data-map-idle]', { state: 'attached', timeout: 30000 });
}

await page.goto(base);
await page.getByText(/Importa le zone ufficiali/i).waitFor();
await page.locator('input[type="file"]').first()
  .setInputFiles(join(root, 'e2e/fixture-fiumicino.json'));
await page.getByText(/Dati aggiornati al/i).waitFor({ timeout: 15000 });
await mapIdle();

for (const theme of ['dark', 'light']) {
  // tema via toggle UI (bottoni: sole=chiaro, luna=scuro)
  await page.getByRole('button', { name: theme === 'dark' ? /scuro/i : /chiaro/i }).click()
    .catch(async () => { // fallback: aria-label diverse → prova con l'emoji
      await page.locator(`button:has-text("${theme === 'dark' ? '🌙' : '☀️'}")`).first().click();
    });
  await page.evaluate(([z]) => {
    const m = window.__dflightMap;
    m.jumpTo({ center: [12.24, 41.77], zoom: z });
  }, [zoom]);
  if (process.env.OPEN_LEGEND === '1') {
    const legend = page.locator('summary', { hasText: 'Legenda' });
    if (!(await legend.locator('..').getAttribute('open'))) await legend.click();
  }
  await mapIdle();
  await page.waitForTimeout(1200); // union async + label placement
  await page.screenshot({ path: `${outPrefix}-${theme}.png` });
  console.log(`salvato ${outPrefix}-${theme}.png`);
}
await browser.close();
