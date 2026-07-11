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
// Style = sfondo tinta unita per tema; glyphs reali da smp-noto-glyphs (npm).
if (process.env.MOCK_CDN === '1') {
  const { readFileSync, existsSync } = await import('node:fs');
  await page.route('https://basemaps.cartocdn.com/**', async (route) => {
    const url = route.request().url();
    const mStyle = url.match(/\/gl\/([a-z-]+)-gl-style\/style\.json/);
    if (mStyle) {
      const dark = mStyle[1].includes('dark');
      return route.fulfill({ json: {
        version: 8,
        glyphs: 'https://basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
        sources: {},
        layers: [{ id: 'bg', type: 'background',
          paint: { 'background-color': dark ? '#11151c' : '#f2f0eb' } }],
      } });
    }
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
