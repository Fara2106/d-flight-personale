// e2e/run.mjs — E2E Fase 2 con Playwright headless.
// Prerequisiti: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright
// Uso: node e2e/run.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5199;
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
};
// poll fino a condizione vera (per assert su count, dove i locator strict non bastano)
async function until(fn, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await fn()) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

// 1. dev server
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite non parte')), 30000);
  server.stdout.on('data', d => { if (String(d).includes('Local:')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

try {
  await page.goto(`http://localhost:${PORT}/`);

  // 2. empty state + import fixture
  await page.getByText(/Importa le zone ufficiali/i).waitFor();
  check('empty state visibile', true);
  await page.locator('input[type=file]').first()
    .setInputFiles(join(root, 'e2e/fixture-ed269.json'));
  await page.getByText(/Dati aggiornati al/i).waitFor({ timeout: 10000 });
  check('import fixture (banner dataset visibile)', true);
  await page.waitForTimeout(2500); // rendering mappa

  // 3. verifica senza profilo → CTA
  await page.getByRole('button', { name: /^verifica$/i }).click();
  await page.getByText(/tocca un punto sulla mappa/i).waitFor();
  const canvas = page.locator('.maplibregl-canvas');
  await canvas.click({ position: { x: 640, y: 400 } }); // centro = ITALY_CENTER
  await page.getByText(/configura un drone/i).waitFor();
  check('senza profilo: CTA al profilo, nessun finto verdetto', true);

  // 4. profilo: due droni + attestato A1/A3
  await page.getByRole('button', { name: /apri profilo/i }).click();
  await page.getByLabel('Nome').fill('Mini');
  await page.getByLabel('Massa (g)').fill('249');
  await page.getByLabel('Classe').selectOption('sub250');
  await page.getByRole('button', { name: /aggiungi drone/i }).click();
  // submit() è async (await upsertDrone → setDraft(EMPTY)): aspettare che il drone
  // compaia in lista (e il form si resetti) prima di digitare il successivo, altrimenti
  // il setDraft(EMPTY) pendente svuota il campo Nome e il secondo add viene rifiutato.
  await page.getByRole('radio', { name: /attiva mini/i }).waitFor();
  await page.getByLabel('Nome').fill('Duo');
  await page.getByLabel('Massa (g)').fill('900');
  await page.getByLabel('Classe').selectOption('C2');
  await page.getByRole('button', { name: /aggiungi drone/i }).click();
  await page.getByRole('radio', { name: /attiva duo/i }).waitFor();
  // La checkbox attestato è controllata e riflette lo stato solo dopo il round-trip
  // async su IndexedDB (toggleComp → updatePilot → setPilot): .check() cliccherebbe
  // due volte (ri-toggle a off) prima che lo stato propaghi. Un click singolo + poll.
  const a13 = page.getByRole('checkbox', { name: 'A1/A3' });
  await a13.click();
  const a13checked = await until(() => a13.isChecked());
  await page.getByRole('button', { name: /chiudi profilo/i }).click();
  check('profilo: 2 droni + attestato A1/A3', a13checked);

  // 5. verdetto con Mini (sub250, attivo perché primo): condizioni, quota 45
  const sheet = page.getByRole('dialog', { name: /verdetto/i });
  await sheet.getByText(/con condizioni/i).waitFor();
  await sheet.getByText(/45 m AGL/).waitFor();
  check('verdetto Mini: 🟡 condizioni, quota 45 m (min dei soffitti)', true);

  // 6. cambio drone → ricalcolo (Duo con solo A1/A3 → A3, note 150 m)
  await sheet.getByLabel('Drone').selectOption({ label: 'Duo' });
  await sheet.getByText(/150 m/).waitFor();
  await sheet.getByText(/Sottocategoria A3/).waitFor();
  check('cambio drone ricalcola: Duo → A3 con nota 150 m', true);

  // 7. accordion: una zona alla volta.
  // NB: i message delle zone condizionate compaiono ANCHE nelle note operative
  // («Zona»: message), quindi si lavora a count: 1 = solo nota, 2 = nota + dettaglio aperto.
  const count = (re) => sheet.getByText(re).count();
  check('accordion chiuso: message solo nelle note',
    await until(async () => (await count(/previa valutazione/i)) === 1));
  await sheet.getByRole('button', { name: /area condizionata grande/i }).click();
  check('apertura zona 1: dettaglio visibile',
    await until(async () => (await count(/previa valutazione/i)) === 2));
  await sheet.getByRole('button', { name: /area condizionata piccola/i }).click();
  check('apertura zona 2 chiude la zona 1',
    await until(async () =>
      (await count(/previa valutazione/i)) === 1 &&
      (await count(/gestore locale/i)) === 2));

  // 8. slider 500 m → entra la zona vietata → ⛔
  await page.getByRole('slider').fill('500');
  await sheet.getByText(/vietato/i).waitFor();
  await sheet.getByText(/Quota massima: —/).waitFor();
  check('raggio 500 m: interseca la zona vietata → ⛔, quota —', true);

  // 9. slider 0 → verifica puntuale, torna alle condizioni
  await page.getByRole('slider').fill('0');
  await sheet.getByText(/con condizioni/i).waitFor();
  check('raggio 0: verifica puntuale → 🟡', true);

  // 10. chiusura
  await page.getByRole('button', { name: /esci dalla verifica/i }).click();
  const sheetGone = await page.getByRole('dialog', { name: /verdetto/i }).count() === 0;
  check('X esce dalla modalità verifica', sheetGone);

  // 11. popup accordion Fase 1 (fuori dalla modalità verifica)
  // A ITALY_ZOOM=5 le zone della fixture (~0.008° di lato) sono sub-pixel: il click
  // non colpisce il layer zones-fill (hit-test sui pixel) e non apre il popup. La
  // modalità verifica sopra funziona perché zonesAtPoint è geometrica, non a pixel.
  // Zoomare sull'area con la rotella (niente click spuri, a differenza del doppio-click)
  // prima di cliccare per il popup.
  await page.mouse.move(640, 400);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(150); }
  await page.waitForTimeout(800);
  await canvas.click({ position: { x: 640, y: 400 } });
  await page.locator('.zone-popup').waitFor();
  const heads = page.locator('.zone-popup-head');
  check('popup multi-zona: lista nomi', await heads.count() >= 2);
  await heads.first().click();
  const visibleDetails = await page.locator('.zone-popup-detail:not([hidden])').count();
  check('popup accordion: un dettaglio aperto', visibleDetails === 1);

  // 12. console pulita
  check('zero errori console', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} check verdi`);
process.exit(failed.length ? 1 : 0);
