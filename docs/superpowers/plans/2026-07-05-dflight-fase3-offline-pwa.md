# D-Flight personale — Fase 3: offline / PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Stato: COMPLETO (2026-07-09).** Decisioni A–D della spec sciolte con Lorenzo (vedi spec §4). **Lo spike della decisione B è GIÀ STATO ESEGUITO** durante la scrittura del piano, sul Mac: `vite-plugin-pwa@1.3.0` builda pulito su rolldown-vite 8, precache corretto (8 entry: index.html, favicon, tutti i chunk hashati incluso `maplibre-*`, URL relativi allo scope), `navigateFallback: index.html`, e la shell è stata servita **davvero offline** in un test Playwright (`context.setOffline(true)` → reload → app renderizza). **Esito: si usa il plugin.** Nessuna variante "SW manuale" in questo piano.

**Goal:** App installabile (PWA) e utilizzabile offline in campo: shell precacheata, zone e verdetto già locali, UX offline esplicita, aggiornamenti col consenso dell'utente.

**Architecture:** Nessun modulo di dominio nuovo. Si aggiungono: icone + `public/manifest.webmanifest` + meta iOS in `index.html`; il service worker generato da **vite-plugin-pwa** (`registerType: 'prompt'`, `injectRegister: false` — la registrazione la fa il hook React) con runtime cache SWR per lo *stile* mappa CARTO (MAI i tile — decisione A); un toast di aggiornamento (`UpdateToast`, `virtual:pwa-register/react`); un hook `useOnline` + `OfflineBanner` + ricerca disabilitata offline. Motore regole, store IndexedDB e mappa NON cambiano.

**Tech Stack:** invariato (React 19, TS 6, rolldown-vite 8, Vitest 4, Playwright per E2E) + **una** dipendenza nuova: `vite-plugin-pwa` (devDependency). `sharp` usato una tantum con `npm i --no-save` per generare i png.

## Global Constraints

- Branch di lavoro: `feat/fase3-offline-pwa` (da `main`).
- Come Fase 1/2: `verbatimModuleSyntax: true` → import di soli tipi con `import type`; `noUnusedLocals`/`noUnusedParameters`; a fine task: suite Vitest completa verde (**134 test** alla partenza) + `npx tsc -b` pulito; copy UI in **italiano**; token tema CSS (`var(--surface)`, `var(--text)`, `var(--accent)`, `var(--shadow)`); override CSS di libreria con prefisso `:root`; commit conventional per task.
- **Base path:** l'app è servita da `https://fara2106.github.io/d-flight-personale/` (`base: '/d-flight-personale/'` in `vite.config.ts`). URL nel manifest **relativi** (`.`, `icons/…`); URL in `index.html` root-assoluti (`/icons/…`) — Vite li ribasa in build (il favicon già funziona così). Mai URL hard-coded con `/d-flight-personale/` nel codice sorgente.
- **Niente reload silenziosi:** `registerType: 'prompt'` — il SW nuovo resta `waiting` finché l'utente non tocca "Aggiorna" nel toast.
- **Decisione A (spec §4):** MAI mettere in cache i tile (`tiles.basemaps.cartocdn.com/vector/carto.streets/v1/{z}/{x}/{y}…`). In cache SWR solo style.json, glyphs (`/fonts/`), sprite e `tiles.json` (metadati sorgente, senza i quali MapLibre non inizializza).
- **Nessun push automatico:** merge su `main` e deploy Pages solo dopo verifica di Lorenzo (Task 7).
- Gotcha ambiente iCloud: se Vite dà `ETIMEDOUT` o compaiono file `* 2.*`, vedi MEMORIA §Gotcha 2026-07-03.

---

### Task 1: Icona PWA (design B) — SVG master, PNG generati, nuovo favicon

Il design è quello **approvato da Lorenzo il 2026-07-09** ("B — Zona sulla mappa"): mappa notturna stilizzata, zona rossa ED-269, quadricottero bianco. Il drone e la zona stanno nel cerchio sicuro maskable (r≈205 su 512): il render maskable è identico al normale.

**Files:**
- Create: `public/icons/icon.svg` (master, committato)
- Create: `scripts/make-icons.mjs` (script one-off, committato)
- Create (generati dallo script, committati): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon.png`
- Modify: `public/favicon.svg` (sostituito con il nuovo design — l'attuale è l'art astratta dello scaffold Vite)
- Test: `tests/pwa/icons.test.ts`

**Interfaces:**
- Produces: i 4 png in `public/icons/` con questi nomi esatti (referenziati dal manifest nel Task 2 e da `index.html`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/pwa/icons.test.ts
import { readFileSync } from 'node:fs';

// Dimensioni PNG lette dall'header IHDR (byte 16-24, big-endian):
// nessuna dipendenza, i png committati devono avere le dimensioni dichiarate.
function pngSize(url: URL): { w: number; h: number } {
  const b = readFileSync(url);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const icon = (name: string) => new URL(`../../public/icons/${name}`, import.meta.url);

describe('icone PWA', () => {
  it('icon-192.png è 192×192', () => {
    expect(pngSize(icon('icon-192.png'))).toEqual({ w: 192, h: 192 });
  });
  it('icon-512.png è 512×512', () => {
    expect(pngSize(icon('icon-512.png'))).toEqual({ w: 512, h: 512 });
  });
  it('icon-maskable-512.png è 512×512', () => {
    expect(pngSize(icon('icon-maskable-512.png'))).toEqual({ w: 512, h: 512 });
  });
  it('apple-touch-icon.png è 180×180', () => {
    expect(pngSize(icon('apple-touch-icon.png'))).toEqual({ w: 180, h: 180 });
  });
  it('il master SVG esiste e contiene il drone', () => {
    const svg = readFileSync(icon('icon.svg'), 'utf8');
    expect(svg).toContain('stroke-linecap="round"'); // bracci del drone
    expect(svg).toContain('#ff453a'); // zona rossa
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pwa/icons.test.ts`
Expected: FAIL — `ENOENT … public/icons/icon-192.png`

- [ ] **Step 3: Create il master SVG**

```svg
<!-- public/icons/icon.svg — icona PWA "Zona sulla mappa" (design B, approvato 2026-07-09).
     Full-bleed 512×512; drone e zona dentro il cerchio sicuro maskable (r≈205). -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="notte" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#13283f"/>
      <stop offset="1" stop-color="#0b1828"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#notte)"/>
  <g stroke="#2c4560" stroke-width="10" fill="none" opacity="0.85">
    <path d="M -20 150 L 250 120 L 540 170"/>
    <path d="M -20 360 L 200 400 L 540 340"/>
    <path d="M 150 -20 L 180 250 L 120 540"/>
    <path d="M 400 -20 L 370 300 L 430 540"/>
  </g>
  <circle cx="256" cy="262" r="150" fill="#ff453a" opacity="0.38"/>
  <circle cx="256" cy="262" r="150" fill="none" stroke="#ff6259" stroke-width="12"/>
  <g transform="translate(256 256) scale(0.62)" fill="#ffffff" stroke="#ffffff">
    <line x1="-108" y1="-108" x2="108" y2="108" stroke-width="30" stroke-linecap="round"/>
    <line x1="-108" y1="108" x2="108" y2="-108" stroke-width="30" stroke-linecap="round"/>
    <circle cx="-118" cy="-118" r="52" fill="none" stroke-width="22"/>
    <circle cx="118" cy="-118" r="52" fill="none" stroke-width="22"/>
    <circle cx="-118" cy="118" r="52" fill="none" stroke-width="22"/>
    <circle cx="118" cy="118" r="52" fill="none" stroke-width="22"/>
    <circle cx="0" cy="0" r="62" stroke="none"/>
  </g>
</svg>
```

- [ ] **Step 4: Create lo script di generazione e genera i png**

```js
// scripts/make-icons.mjs — genera i png dell'icona PWA dal master SVG.
// One-off: i png sono committati; rilanciare solo se cambia il design.
// Prerequisito: npm i --no-save sharp
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public/icons/icon.svg');
const out = (name) => join(root, 'public/icons', name);

// density alta: sharp rasterizza l'SVG prima del resize; a 72dpi il 512 sgrana
const svg = () => sharp(src, { density: 300 });

await svg().resize(192, 192).png().toFile(out('icon-192.png'));
await svg().resize(512, 512).png().toFile(out('icon-512.png'));
// il design B è full-bleed con soggetto nel cerchio sicuro: maskable = stesso render
await svg().resize(512, 512).png().toFile(out('icon-maskable-512.png'));
await svg().resize(180, 180).png().toFile(out('apple-touch-icon.png'));
console.log('icone generate in public/icons/');
```

Run:
```bash
npm i --no-save sharp
node scripts/make-icons.mjs
```
Expected: `icone generate in public/icons/` e 4 png nuovi in `public/icons/`.

- [ ] **Step 5: Sostituisci il favicon col nuovo design**

Sovrascrivi `public/favicon.svg` con **lo stesso identico contenuto** di `public/icons/icon.svg` (Step 3). Il browser lo scala da solo; `index.html` già lo referenzia.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/pwa/icons.test.ts`
Expected: PASS (5 test)

- [ ] **Step 7: Suite completa + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: 139/139 verdi (134 + 5), tsc pulito.

- [ ] **Step 8: Verifica visiva rapida**

Apri `public/icons/icon-512.png` (doppio click) e controlla: sfondo blu notte, strade accennate, cerchio rosso, drone bianco nitido. Se sgranato, alza `density` a 512 e rigenera.

- [ ] **Step 9: Commit**

```bash
git add public/icons public/favicon.svg scripts/make-icons.mjs tests/pwa/icons.test.ts
git commit -m "feat: icona PWA 'zona sulla mappa' (design B) — svg master + png generati + nuovo favicon"
```

---

### Task 2: Web App Manifest + meta iOS

**Files:**
- Create: `public/manifest.webmanifest`
- Modify: `index.html`
- Test: `tests/pwa/manifest.test.ts`

**Interfaces:**
- Consumes: i png `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png` del Task 1.
- Produces: `public/manifest.webmanifest` (il plugin del Task 3 NON lo genera: `manifest: false`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/pwa/manifest.test.ts
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('manifest PWA', () => {
  const manifest = () => JSON.parse(read('../../public/manifest.webmanifest'));

  it('ha nome, lingua e display standalone', () => {
    const m = manifest();
    expect(m.name).toBe('D-Flight personale');
    expect(m.short_name).toBe('D-Flight');
    expect(m.lang).toBe('it');
    expect(m.display).toBe('standalone');
  });
  it('start_url e scope sono RELATIVI (base path GitHub Pages)', () => {
    const m = manifest();
    expect(m.start_url).toBe('.');
    expect(m.scope).toBe('.');
  });
  it('dichiara le tre icone, con la maskable marcata purpose', () => {
    const m = manifest();
    const srcs = m.icons.map((i: { src: string }) => i.src);
    expect(srcs).toEqual(['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']);
    expect(m.icons[2].purpose).toBe('maskable');
    for (const i of m.icons) expect(i.src.startsWith('/')).toBe(false); // relativi
  });
});

describe('index.html — collegamenti PWA', () => {
  const html = () => read('../../index.html');

  it('linka manifest e apple-touch-icon', () => {
    expect(html()).toContain('rel="manifest"');
    expect(html()).toContain('href="/manifest.webmanifest"');
    expect(html()).toContain('rel="apple-touch-icon"');
    expect(html()).toContain('href="/icons/apple-touch-icon.png"');
  });
  it('ha theme-color per tema chiaro e scuro (token dell app)', () => {
    expect(html()).toContain('content="#f5f6f8"');
    expect(html()).toContain('content="#0f141b"');
  });
  it('ha i meta apple per lo standalone', () => {
    expect(html()).toContain('apple-mobile-web-app-capable');
    expect(html()).toContain('apple-mobile-web-app-title');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pwa/manifest.test.ts`
Expected: FAIL — `ENOENT … public/manifest.webmanifest`

- [ ] **Step 3: Create il manifest**

```json
{
  "name": "D-Flight personale",
  "short_name": "D-Flight",
  "description": "Zone UAS italiane (ED-269) sulla mappa e verifica di volo personalizzata. App personale non ufficiale: verifica sempre su D-Flight.",
  "lang": "it",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#0b1828",
  "theme_color": "#0b1828",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

(`start_url`/`scope` relativi si risolvono contro l'URL del manifest, che in produzione sta sotto `/d-flight-personale/` — il vincolo base path è rispettato senza hard-coding. `background_color`/`theme_color` = blu notte dell'icona: lo splash iOS/Android è coerente col design B.)

- [ ] **Step 4: Modify index.html**

Sostituisci l'intero `<head>` con:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f6f8" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f141b" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="D-Flight" />
    <title>D-Flight personale</title>
  </head>
```

(Gli `href` root-assoluti vengono ribasati da Vite in build — è lo stesso meccanismo del favicon, già verificato in produzione. I `theme-color` usano i token `--bg` dei due temi da `src/index.css`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/pwa/manifest.test.ts`
Expected: PASS (6 test)

- [ ] **Step 6: Suite completa + typecheck + build**

Run: `npx vitest run && npx tsc -b && npm run build`
Expected: suite verde, tsc pulito, build ok; `dist/manifest.webmanifest` e `dist/icons/*.png` presenti.

- [ ] **Step 7: Commit**

```bash
git add public/manifest.webmanifest index.html tests/pwa/manifest.test.ts
git commit -m "feat: web app manifest + meta iOS — installabile, theme-color per tema, icone design B"
```

---

### Task 3: vite-plugin-pwa — service worker precache + runtime cache stile mappa

**Files:**
- Create: `src/pwa/mapStyleCache.ts`
- Modify: `vite.config.ts`, `package.json` (+`vite-plugin-pwa` in devDependencies via npm)
- Test: `tests/pwa/mapStyleCache.test.ts`

**Interfaces:**
- Produces: `MAP_STYLE_URL_RE: RegExp` esportata da `src/pwa/mapStyleCache.ts` (usata da `vite.config.ts`); in build, `dist/sw.js` + `dist/workbox-*.js` generati (consumati dal Task 4 via `virtual:pwa-register/react`).

**Contesto per l'implementer (esito spike 2026-07-09):** `vite-plugin-pwa@^1.3.0` funziona su rolldown-vite 8 senza workaround. Il precache di default include 8 entry (index.html, favicon, chunk hashati incluso `maplibre-*` da 1.03 MB — sotto il limite workbox di 2 MiB) e `navigateFallback` punta a `index.html` relativo allo scope. Gli URL runtime CARTO reali (verificati con curl sul `style.json` live):
- style: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` (e `dark-matter-gl-style`)
- glyphs: `https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf`
- sprite: `https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/sprite…`
- metadati sorgente: `https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json`
- **tile (MAI in cache):** `https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/{z}/{x}/{y}.mvt…`

⚠️ Glyph/sprite/tile stanno sullo **stesso host** (`tiles.basemaps…`): il routing è per path, non per host. ⚠️ Workbox **serializza** `urlPattern` nel sw.js generato: una funzione perderebbe la closure sugli import → si usa una **RegExp** (serializza senza problemi), definita in un modulo testabile.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pwa/mapStyleCache.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pwa/mapStyleCache.test.ts`
Expected: FAIL — `Cannot find module '../../src/pwa/mapStyleCache'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/pwa/mapStyleCache.ts
/**
 * Asset "stile mappa" CARTO da tenere in runtime cache (stale-while-revalidate):
 * style.json, glyphs (/fonts/), sprite e tiles.json (metadati sorgente — senza
 * di essi MapLibre non inizializza offline). I TILE veri e propri
 * (/vector/carto.streets/v1/{z}/{x}/{y}…) NON matchano: restano network-only
 * per rispettare i TOS del basemap free (decisione A della spec Fase 3).
 * RegExp (non funzione): workbox serializza urlPattern nel sw.js generato e
 * una funzione perderebbe la closure sugli import.
 */
export const MAP_STYLE_URL_RE =
  /^https:\/\/(?:basemaps\.cartocdn\.com\/gl\/[^/]+\/style\.json|tiles\.basemaps\.cartocdn\.com\/(?:fonts\/|gl\/[^/]+\/sprite|vector\/[^/]+\/v1\/tiles\.json))/;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pwa/mapStyleCache.test.ts`
Expected: PASS (9 test)

- [ ] **Step 5: Installa il plugin e aggiorna vite.config.ts**

```bash
npm i -D vite-plugin-pwa
```

`vite.config.ts` completo dopo la modifica:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// estensione .ts esplicita: vite.config è typecheckato sotto tsconfig.node
// (module: nodenext) che la richiede; allowImportingTsExtensions la permette
import { MAP_STYLE_URL_RE } from './src/pwa/mapStyleCache.ts';

export default defineConfig({
  // GitHub Pages serve l'app da https://<user>.github.io/d-flight-personale/
  base: '/d-flight-personale/',
  plugins: [
    react(),
    VitePWA({
      // niente reload a sorpresa: il SW nuovo resta waiting finché l'utente
      // non conferma dal toast (UpdateToast)
      registerType: 'prompt',
      // la registrazione la fa useRegisterSW (virtual:pwa-register/react):
      // nessuno script registerSW.js auto-iniettato
      injectRegister: false,
      // il manifest è un file statico nostro (public/manifest.webmanifest)
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            // stile mappa CARTO (style/glyphs/sprite/tiles.json) — MAI i tile
            urlPattern: MAP_STYLE_URL_RE,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'carto-style-v1', expiration: { maxEntries: 80 } },
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Code-splitting: MapLibre (~80% del bundle) in un chunk separato.
        // L'entry dell'app resta piccola e gli aggiornamenti del nostro codice
        // non invalidano la cache del chunk vendor della mappa.
        advancedChunks: {
          groups: [
            { name: 'maplibre', test: /node_modules[\\/]maplibre-gl[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        localstorage: 'memory',
      },
    },
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 6: Build e verifica del sw.js generato**

Run: `npm run build && node -e "const s=require('fs').readFileSync('dist/sw.js','utf8'); console.log('precache entries:', (s.match(/url:/g)||[]).length); console.log('maplibre nel precache:', s.includes('assets/maplibre-')); console.log('route carto:', s.includes('basemaps.cartocdn.com'))"`
Expected: `precache entries:` ≥ 8 · `maplibre nel precache: true` · `route carto: true`

- [ ] **Step 7: Suite completa + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: tutto verde (il plugin nel config non deve rompere i test jsdom — se Vitest desse errori sul plugin, aggiungere il plugin solo quando `mode !== 'test'`, ma lo spike non lo ha reso necessario).

- [ ] **Step 8: Commit**

```bash
git add src/pwa/mapStyleCache.ts tests/pwa/mapStyleCache.test.ts vite.config.ts package.json package-lock.json
git commit -m "feat: service worker vite-plugin-pwa — precache shell + SWR stile mappa CARTO (mai i tile)"
```

---

### Task 4: Toast di aggiornamento (registrazione SW inclusa)

**Files:**
- Create: `src/pwa/UpdateToast.tsx`, `tests/stubs/pwa-register-react.ts`
- Modify: `src/App.tsx`, `tsconfig.app.json` (types), `vite.config.ts` (alias di test)
- Test: `tests/pwa/UpdateToast.test.tsx`

**Interfaces:**
- Consumes: `virtual:pwa-register/react` (modulo virtuale del plugin, Task 3) — `useRegisterSW(): { needRefresh: [boolean, (v: boolean) => void]; offlineReady: [boolean, (v: boolean) => void]; updateServiceWorker: (reload?: boolean) => Promise<void> }`.
- Produces: componente `UpdateToast` (montato in `App`; registra il SW al mount — è l'UNICO punto di registrazione, coerente con `injectRegister: false`).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/pwa/UpdateToast.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateToast } from '../../src/pwa/UpdateToast';

// vi.mock è hoisted sopra gli import: le variabili esterne usate nella factory
// DEVONO chiamarsi mock* (regola Vitest, altrimenti errore di inizializzazione)
const mockUpdateServiceWorker = vi.fn(async () => {});
let mockNeedRefresh = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

describe('UpdateToast', () => {
  it('non mostra nulla se non c è un aggiornamento', () => {
    mockNeedRefresh = false;
    render(<UpdateToast />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('con aggiornamento pronto mostra il toast e Aggiorna applica', () => {
    mockNeedRefresh = true;
    render(<UpdateToast />);
    expect(screen.getByRole('status')).toHaveTextContent(/nuova versione disponibile/i);
    fireEvent.click(screen.getByRole('button', { name: /aggiorna/i }));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pwa/UpdateToast.test.tsx`
Expected: FAIL — `Cannot find module '../../src/pwa/UpdateToast'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/pwa/UpdateToast.tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Registra il service worker e mostra il toast quando c'è una nuova versione.
 *  L'update parte SOLO al tap su Aggiorna (registerType: 'prompt'). */
export function UpdateToast() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status"
      className="rounded-xl px-4 py-2 text-sm"
      style={{ position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)',
        display: 'flex', gap: 12, alignItems: 'center', zIndex: 40 }}>
      Nuova versione disponibile
      <button onClick={() => { void updateServiceWorker(true); }}
        className="rounded-lg px-3 py-1 text-sm font-semibold text-white"
        style={{ background: 'var(--accent)' }}>
        Aggiorna
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Tipi del modulo virtuale + stub per i test**

`tsconfig.app.json` — riga `types` (unica modifica al file):

```json
    "types": ["vite/client", "vite-plugin-pwa/react"],
```

```ts
// tests/stubs/pwa-register-react.ts
// Stub del modulo virtuale del plugin per l'ambiente Vitest: in jsdom non c'è
// un service worker, e il modulo reale è generato solo in dev/build.
// I test di UpdateToast lo sostituiscono con vi.mock; questo stub serve agli
// ALTRI test (es. App.test) che montano l'albero senza occuparsi della PWA.
import { useState } from 'react';

export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return { needRefresh, offlineReady, updateServiceWorker: async (_reload?: boolean) => {} };
}
```

`vite.config.ts` — aggiungi in testa `import { fileURLToPath } from 'node:url';` e nella sezione `test` l'alias (il resto del file resta come al Task 3). ⚠️ `fileURLToPath`, NON `.pathname`: il percorso del progetto contiene spazi ("Web Apps") che `.pathname` lascerebbe percent-encodati (`%20`) rompendo la risoluzione.

```ts
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        localstorage: 'memory',
      },
    },
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    alias: {
      'virtual:pwa-register/react':
        fileURLToPath(new URL('./tests/stubs/pwa-register-react.ts', import.meta.url)),
    },
  },
```

- [ ] **Step 5: Monta il toast in App**

In `src/App.tsx`: aggiungi l'import e il render.

```tsx
import { UpdateToast } from './pwa/UpdateToast';
```

Dentro il `return`, subito dopo `<MapView … />`:

```tsx
      <UpdateToast />
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/pwa/UpdateToast.test.tsx`
Expected: PASS (2 test)

- [ ] **Step 7: Suite completa + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: tutto verde — in particolare `tests/app/App.test.tsx` deve restare verde con lo stub (alias) al posto del modulo virtuale.

- [ ] **Step 8: Commit**

```bash
git add src/pwa/UpdateToast.tsx tests/pwa/UpdateToast.test.tsx tests/stubs/pwa-register-react.ts src/App.tsx tsconfig.app.json vite.config.ts
git commit -m "feat: toast 'Nuova versione disponibile' — update del SW solo col consenso dell'utente"
```

---

### Task 5: UX offline — useOnline, banner, ricerca disabilitata

**Files:**
- Create: `src/ui/useOnline.ts`, `src/ui/OfflineBanner.tsx`
- Modify: `src/search/SearchBox.tsx`, `src/App.tsx`
- Test: `tests/ui/offline.test.tsx`

**Interfaces:**
- Produces: `useOnline(): boolean` · `OfflineBanner(): JSX` · `SearchBox` accetta la nuova prop opzionale `disabled?: boolean`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ui/offline.test.tsx
import { render, screen, act, renderHook } from '@testing-library/react';
import { useOnline } from '../../src/ui/useOnline';
import { OfflineBanner } from '../../src/ui/OfflineBanner';
import { SearchBox } from '../../src/search/SearchBox';

describe('useOnline', () => {
  it('parte dallo stato di navigator.onLine e segue gli eventi', () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true); // jsdom: onLine = true

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);

    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(true);
  });
});

describe('OfflineBanner', () => {
  it('spiega cosa funziona e cosa no', () => {
    render(<OfflineBanner />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/sei offline/i);
    expect(banner).toHaveTextContent(/zone e verifica funzionano/i);
  });
});

describe('SearchBox offline', () => {
  it('con disabled l input è disabilitato e spiega perché', () => {
    render(<SearchBox onPick={() => {}} disabled />);
    const input = screen.getByPlaceholderText(/cerca un luogo/i);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('title', expect.stringMatching(/offline/i));
  });
  it('senza disabled resta abilitato (default)', () => {
    render(<SearchBox onPick={() => {}} />);
    expect(screen.getByPlaceholderText(/cerca un luogo/i)).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/offline.test.tsx`
Expected: FAIL — `Cannot find module '../../src/ui/useOnline'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/useOnline.ts
import { useEffect, useState } from 'react';

/** true se il browser è online; segue gli eventi window online/offline. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}
```

```tsx
// src/ui/OfflineBanner.tsx
export function OfflineBanner() {
  return (
    <div role="status"
      className="rounded-xl px-3 py-2 text-sm"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
      📡 <b>Sei offline</b> — zone e verifica funzionano; mappa di sfondo e ricerca no
    </div>
  );
}
```

`src/search/SearchBox.tsx` — modifica firma e input (il resto del file non cambia):

```tsx
export function SearchBox({ onPick, disabled = false }:
  { onPick: (r: GeocodeResult) => void; disabled?: boolean }) {
```

```tsx
      <input value={q} onChange={e => run(e.target.value)} placeholder="⌕ Cerca un luogo…"
        disabled={disabled}
        title={disabled ? 'Ricerca non disponibile offline' : undefined}
        className="w-full rounded-full px-4 py-2.5 text-sm outline-none disabled:opacity-50"
        style={{ background:'var(--surface)', color:'var(--text)', boxShadow:'var(--shadow)' }} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/offline.test.tsx`
Expected: PASS (4 test)

- [ ] **Step 5: Integra in App**

In `src/App.tsx`:

```tsx
import { OfflineBanner } from './ui/OfflineBanner';
import { useOnline } from './ui/useOnline';
```

Dentro `App()`, accanto agli altri hook:

```tsx
  const online = useOnline();
```

La SearchBox diventa:

```tsx
        <div style={{ flex:1, maxWidth:480 }}><SearchBox onPick={r => setFlyTo({ lat:r.lat, lon:r.lon })} disabled={!online} /></div>
```

Nello stack in basso a sinistra, sopra `DataStatusBanner`:

```tsx
      <div style={{ position:'absolute', bottom:12, left:12, display:'flex', flexDirection:'column', gap:10 }}>
        {!online && <OfflineBanner />}
        <DataStatusBanner meta={meta} />
        <Legend />
        <Disclaimer />
      </div>
```

- [ ] **Step 6: Suite completa + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: tutto verde.

- [ ] **Step 7: Commit**

```bash
git add src/ui/useOnline.ts src/ui/OfflineBanner.tsx src/search/SearchBox.tsx src/App.tsx tests/ui/offline.test.tsx
git commit -m "feat: UX offline — banner 'Sei offline' e ricerca disabilitata con motivazione"
```

---

### Task 6: E2E offline + aggiornamento (Playwright)

**Files:**
- Create: `e2e/offline.mjs`
- Modify: `src/App.tsx` (attributo `data-build` sul div radice — serve all'E2E per verificare che il reload post-update carichi davvero la build nuova)
- Test: è l'E2E stesso (`node e2e/offline.mjs`)

**Interfaces:**
- Consumes: tutta la UI dei task precedenti (toast, banner offline, SearchBox disabled) + selettori esistenti di `e2e/run.mjs` (empty state, profilo, verifica).

**Note per l'implementer:**
- `vite preview` serve `dist/` da disco a ogni richiesta: si può rifare la build mentre il server gira (serve per lo scenario aggiornamento).
- Una pagina è *controllata* dal SW solo dalla navigazione successiva all'install: dopo la prima visita serve un reload online prima di andare offline (verificato nello spike).
- Offline i tile CARTO falliscono (atteso, decisione A): questo E2E **non** asserisce zero errori console, a differenza di `run.mjs`.
- La build "B" differisce dalla "A" grazie a `VITE_BUILD_ID`, letto in App nel `data-build`: hash del chunk entry diverso → precache diverso → il SW nuovo va in `waiting` → toast.

- [ ] **Step 1: data-build in App**

In `src/App.tsx`, il div radice diventa:

```tsx
    <div style={{ position:'absolute', inset:0 }} data-build={import.meta.env.VITE_BUILD_ID ?? ''}>
```

Run: `npx vitest run && npx tsc -b` — Expected: verdi (l'attributo è inerte; senza la env var vale stringa vuota).

- [ ] **Step 2: Write the E2E script**

```js
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

// 1. build A + preview
build();
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'pipe' });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite preview non parte')), 20000);
  server.stdout.on('data', d => { if (String(d).includes('Local:')) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

try {
  // 2. prima visita online: fixture + drone (IndexedDB persiste tra i reload)
  await page.goto(BASE);
  await page.getByText(/Importa le zone ufficiali/i).waitFor();
  await page.locator('input[type=file]').first()
    .setInputFiles(join(root, 'e2e/fixture-ed269.json'));
  await page.getByText(/Dati aggiornati al/i).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /apri profilo/i }).click();
  await page.getByLabel('Nome').fill('Mini');
  await page.getByLabel('Massa (g)').fill('249');
  await page.getByLabel('Classe').selectOption('sub250');
  await page.getByRole('button', { name: /aggiungi drone/i }).click();
  await page.getByRole('radio', { name: /attiva mini/i }).waitFor();
  await page.getByRole('button', { name: /chiudi profilo/i }).click();
  check('setup online: fixture importata + drone attivo', true);

  // 3. il SW deve controllare la pagina PRIMA di andare offline
  await page.waitForFunction(async () =>
    !!(await navigator.serviceWorker.getRegistration())?.active, { timeout: 15000 });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10000 });
  check('service worker attivo e controllante', true);

  // 4. OFFLINE: shell dal precache, dati da IndexedDB
  await context.setOffline(true);
  await page.reload();
  await page.getByText(/Dati aggiornati al/i).waitFor({ timeout: 10000 });
  check('offline: app shell carica, dataset visibile', true);
  await page.getByText(/sei offline/i).waitFor();
  check('offline: banner "Sei offline"', true);

  // 5. offline: ricerca disabilitata con motivazione
  const search = page.getByPlaceholder(/cerca un luogo/i);
  check('offline: ricerca disabilitata', await search.isDisabled());

  // 6. offline: verifica + verdetto (tutto locale; i tile falliscono, le zone no)
  await page.waitForTimeout(2000);
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
  await browser.close();
  server.kill();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} check verdi`);
process.exit(failed.length ? 1 : 0);
```

- [ ] **Step 3: Run E2E**

Run: `node e2e/offline.mjs`
Expected: `8/8 check verdi`, exit 0. (Se Playwright manca: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright`.)

- [ ] **Step 4: Regressione E2E Fase 1/2**

Run: `node e2e/run.mjs`
Expected: `15/15 check verdi` (il SW non gira in dev: `vite` dev server, nessuna interferenza).

- [ ] **Step 5: Commit**

```bash
git add e2e/offline.mjs src/App.tsx
git commit -m "test: E2E offline/PWA — shell precacheata, verdetto offline, toast aggiornamento col consenso"
```

---

### Task 7: Review finale, MEMORIA, merge e deploy (post-ok Lorenzo)

- [ ] **Step 1: Review finale whole-branch** (modello opus, come Fase 1/2): diff `git diff main..HEAD -- . ':(exclude)package-lock.json'` + vincoli globali. Fix solo Critical/Important.
- [ ] **Step 2: Verifica finale di fase**: `npx vitest run && npx tsc -b && npm run build && node e2e/offline.mjs && node e2e/run.mjs` — tutto verde.
- [ ] **Step 3: MEMORIA** — sezione Stato + Log con esiti, numero test, gotcha scoperti.
- [ ] **Step 4 (con Lorenzo):** verifica visiva locale (`npm run build && npm run preview`, aprire `http://localhost:4173/d-flight-personale/`): installabilità (Chrome: icona installa in barra URL), icona nuova, offline da DevTools→Network→Offline.
- [ ] **Step 5 (post-ok):** merge fast-forward su `main`, push (deploy Pages; se la run fallisce: `gh run rerun <id> --failed`), verifica live https://fara2106.github.io/d-flight-personale/ (HTTP 200, manifest servito, sw.js registrato).
- [ ] **Step 6 (Lorenzo, iPhone):** "Aggiungi alla schermata Home" da Safari → icona design B, apertura standalone, modalità aereo → app funzionante. Annotare l'esito in MEMORIA.

## Rischi residui
- **Vitest × plugin:** il plugin gira anche quando Vitest carica `vite.config.ts`; lo spike non ha mostrato problemi, ma se la suite si rompesse al Task 3 la mitigazione è attivare `VitePWA` solo fuori da test mode (`defineConfig(({ mode }) => …)`).
- **iOS Safari:** il SW vale solo da Safari/standalone e i quirk (statusbar, splash) si vedono solo sul device — il test manuale del Task 7 Step 6 resta indispensabile.
- **Update check su Pages:** il browser rivaluta sw.js a ogni navigazione (HTTP no-cache di GitHub Pages sugli asset non hashati) — il toast può comparire al secondo avvio dopo un deploy, non necessariamente al primo. Comportamento atteso, non bug.
