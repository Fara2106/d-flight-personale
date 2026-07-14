// e2e/offline.mjs — E2E Fase 3 (PWA/offline/aggiornamento) con Playwright headless.
// Prerequisiti: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright
// Uso: node e2e/offline.mjs   (fa 2 build di produzione + vite preview)
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5301;
const BASE = `http://localhost:${PORT}/d-flight-personale/`;
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
};
function build(env = {}) {
  const r = spawnSync('npm', ['run', 'build'],
    { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error('build fallita');
}

// aspetta che MapLibre abbia finito di caricare e disegnare (data-map-idle,
// vedi src/map/mapIdleFlag.ts) — niente sleep fissi prima dei click a pixel
async function waitMapIdle(page) {
  await page.waitForSelector('[data-map-idle]', { state: 'detached', timeout: 3000 }).catch(() => {});
  await page.waitForSelector('[data-map-idle]', { state: 'attached', timeout: 20000 });
}

// 1. build A + preview — da qui in poi tutto nel try: il finally chiude
// sempre server e browser anche se il launch o l'avvio falliscono
build();
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'pipe' });
let browser;
try {
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('vite preview non parte')), 20000);
    server.stdout.on('data', d => { if (String(d).includes('Local:')) { clearTimeout(t); res(); } });
  });

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 2. prima visita online: fixture + drone (IndexedDB persiste tra i reload)
  await page.goto(BASE);
  await page.getByText(/Importa le zone ufficiali/i).waitFor();
  await page.locator('input[type=file]').first()
    .setInputFiles(join(root, 'e2e/fixture-ed269.json'));
  await page.getByText(/Dati aggiornati al/i).waitFor({ timeout: 10000 });
  // il bottone Profilo non è più nel chrome (af1adbe): si apre dalla CTA
  // "configura un drone" dentro la modalità Verifica, come in run.mjs
  await waitMapIdle(page);
  await page.getByRole('button', { name: /^verifica$/i }).click();
  await page.getByText(/tocca un punto sulla mappa/i).waitFor();
  await page.locator('.maplibregl-canvas').click({ position: { x: 640, y: 400 } });
  await page.getByText(/configura un drone/i).waitFor();
  await page.getByRole('button', { name: /apri profilo/i }).click();
  await page.getByLabel('Nome').fill('Mini');
  await page.getByLabel('Massa (g)').fill('249');
  await page.getByLabel('Classe').selectOption('sub250');
  await page.getByRole('button', { name: /aggiungi drone/i }).click();
  await page.getByRole('radio', { name: /attiva mini/i }).waitFor();
  await page.getByRole('button', { name: /chiudi profilo/i }).click();
  // col profilo chiuso appare il verdetto per il punto toccato: esci dalla verifica
  await page.getByRole('dialog', { name: /verdetto/i }).waitFor();
  await page.getByRole('button', { name: /esci dalla verifica/i }).click();
  check('setup online: fixture importata + drone attivo', true);

  // 3. scenario iPhone (bug 2026-07-09): UNA sola sessione online, NIENTE
  // reload — con clientsClaim il SW prende il controllo della pagina da solo
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 20000 });
  check('primo avvio: SW controlla la pagina senza reload (clientsClaim)', true);

  // 3b. warmup (warmMapCache): stile + tile già scaricati vengono ri-fetchati
  // attraverso il SW → cache runtime piene già alla prima visita
  await page.waitForFunction(async () => {
    if (!(await caches.has('carto-style-v1')) || !(await caches.has('carto-tiles-v1'))) return false;
    const style = await (await caches.open('carto-style-v1')).keys();
    const tiles = await (await caches.open('carto-tiles-v1')).keys();
    return style.some((r) => r.url.includes('style.json')) && tiles.length > 0;
  }, { timeout: 30000 });
  check('warmup prima visita: style.json + tile in cache runtime', true);

  // 4. OFFLINE: shell dal precache, dati da IndexedDB, mappa dalle cache runtime
  const swServed = [];
  page.on('response', (r) => { if (r.fromServiceWorker()) swServed.push(r.url()); });
  await context.setOffline(true);
  await page.reload();
  await page.getByText(/Dati aggiornati al/i).waitFor({ timeout: 10000 });
  check('offline: app shell carica, dataset visibile', true);
  await page.getByText(/sei offline/i).waitFor();
  check('offline: banner "Sei offline"', true);

  // 4b. la mappa offline riceve stile e tile DAL SW (niente rete): è la
  // riproduzione del bug iPhone — prima del fix qui non arrivava nulla
  const until = async (fn, ms = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 200)); }
    return false;
  };
  check('offline: style.json servito dal SW', await until(() => swServed.some((u) => u.includes('style.json'))));
  check('offline: tile basemap serviti dal SW (aree visitate)', await until(() => swServed.some((u) => /\.mvt(\?|$)/.test(u))));

  // 5. offline: ricerca disabilitata con motivazione
  const search = page.getByPlaceholder(/cerca un luogo/i);
  check('offline: ricerca disabilitata', await search.isDisabled());

  // 6. offline: verifica + verdetto (tutto locale; i tile falliscono, le zone no)
  await waitMapIdle(page);
  await page.getByRole('button', { name: /^verifica$/i }).click();
  await page.getByText(/tocca un punto sulla mappa/i).waitFor();
  await page.locator('.maplibregl-canvas').click({ position: { x: 640, y: 400 } });
  await page.getByRole('dialog', { name: /verdetto/i })
    .getByText(/con condizioni/i).waitFor();
  check('offline: verdetto calcolato (🟡 con condizioni)', true);
  await page.getByRole('button', { name: /esci dalla verifica/i }).click();

  // 7. torna online: build B → toast → Aggiorna → reload sulla build nuova
  await context.setOffline(false);
  build({ VITE_BUILD_ID: 'e2e-update' });
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  await page.getByText(/nuova versione disponibile/i).waitFor({ timeout: 20000 });
  check('aggiornamento: toast visibile (niente reload automatico)', true);
  await page.getByRole('button', { name: /^aggiorna$/i }).click();
  await page.waitForFunction(() =>
    document.querySelector('#root > div')?.getAttribute('data-build') === 'e2e-update',
    { timeout: 20000 });
  check('aggiornamento: reload con la build nuova', true);
} finally {
  await browser?.close();
  server.kill();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} check verdi`);
process.exit(failed.length ? 1 : 0);
