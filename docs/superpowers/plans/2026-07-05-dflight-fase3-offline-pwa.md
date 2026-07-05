# D-Flight personale — Fase 3: offline / PWA — Implementation Plan (BOZZA)

> **Stato: BOZZA — proposta da revisionare.** Questo piano è stato scritto insieme alla bozza di spec (`docs/superpowers/specs/2026-07-05-dflight-fase3-offline-pwa.md`) **prima** dell'approvazione: i task sono definiti a livello di contratto (file, test, criteri di done) ma **senza il codice completo**, che va aggiunto col processo writing-plans **dopo** che Lorenzo ha sciolto le decisioni aperte A–D della spec (in particolare A: cache tile, e B: plugin vs SW manuale — il Task 2 può cambiare forma).

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o superpowers:executing-plans, task-by-task, come Fase 1/2.

**Goal:** App installabile (PWA) e utilizzabile offline in campo: shell precacheata, zone e verdetto già locali, UX offline esplicita, aggiornamenti col consenso dell'utente.

**Architecture:** Nessun modulo applicativo nuovo lato dominio. Si aggiungono: `public/manifest.webmanifest` + icone, un service worker (`src/sw/` se manuale, o config vite-plugin-pwa), un hook `useOnline` + banner offline in `src/ui/`, e il toast di aggiornamento. Il motore regole, gli store IndexedDB e la mappa NON cambiano.

**Tech Stack:** invariato (React 19, TS 6, rolldown-vite 8, Vitest 4, Playwright per E2E). Eventuale unica dipendenza nuova: `vite-plugin-pwa` (solo se lo spike del Task 2 lo promuove).

## Global Constraints

- Come Fase 1/2: `verbatimModuleSyntax`, `tsc -b` a fine task, suite Vitest sempre verde (117 test al momento della bozza), copy UI in italiano, token tema CSS, override CSS di libreria con prefisso `:root`, commit conventional per task.
- **Base path:** ogni URL del SW/manifest deve rispettare `base: '/d-flight-personale/'` (GitHub Pages). Mai path assoluti su `/`.
- **Niente reload silenziosi:** il SW nuovo non fa `skipWaiting` automatico; attiva solo dopo consenso (toast).
- **Nessun push automatico:** deploy Pages solo dopo verifica di Lorenzo.

## Task (bite-sized, con criteri di done — codice da dettagliare post-approvazione)

### Task 1: Manifest + icone + meta iOS
- **Create:** `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon.png`; **Modify:** `index.html` (link manifest, meta `theme-color` chiaro/scuro, meta apple), script one-off `scripts/make-icons.mjs` (sharp via `npm i --no-save`, png committati).
- **Test:** presenza/coerenza del manifest (nome, start_url relativo, icone esistenti) letto da un test node; `index.html` contiene i link attesi.
- **Done:** Lighthouse "installable" ok in locale (`vite preview`); nessun 404 icone.

### Task 2: Spike — vite-plugin-pwa vs SW manuale (decisione B)
- Provare `vite-plugin-pwa` su rolldown-vite: build + precache manifest generato + `vite preview` servono la shell offline?
- **Criterio oggettivo:** se build pulita e precache corretto (tutti gli asset hashati inclusi, base path rispettato) → plugin; altrimenti SW manuale (Task 3 in variante B).
- **Done:** decisione annotata qui e in MEMORIA con l'evidenza dello spike. Nessun codice residuo se si sceglie il manuale.

### Task 3: Service worker — precache app shell + registrazione
- **Variante plugin:** config `VitePWA({ registerType: 'prompt', … })`, `virtual:pwa-register` per l'hook di update.
- **Variante manuale:** `public/sw.js` (o `src/sw.ts` copiato in build) con: nome cache = hash build (iniettato da mini-script post-build che elenca `dist/assets/*`), install → precache, activate → cleanup cache vecchie, fetch → cache-first per asset precacheati, network-first con fallback shell per le navigazioni.
- **Test:** unit sulla logica pura (classificazione richieste, cleanup); registrazione condizionata a `import.meta.env.PROD`.
- **Done:** `vite build && vite preview` → prima visita online, poi offline: l'app si apre.

### Task 4: Runtime cache stile mappa (style.json, glyphs, sprite CARTO)
- Stale-while-revalidate su `basemaps.cartocdn.com` **solo** per style/glyphs/sprite. Tile: secondo decisione A (bozza: **nessuna cache tile**; offline la mappa mostra sfondo neutro — le zone GeoJSON si vedono comunque).
- **Test:** unit sul router del SW (URL style/glyph/sprite → cache SWR; tile → network-only).
- **Done:** offline dopo prima visita: MapLibre inizializza, zone renderizzate su sfondo neutro senza errori console bloccanti.

### Task 5: UX offline — hook `useOnline`, banner, ricerca disabilitata
- **Create:** `src/ui/useOnline.ts` (navigator.onLine + eventi online/offline), banner "Sei offline — mappa di sfondo e ricerca non disponibili" nello stile `DataStatusBanner`; SearchBox disabilitata offline con title esplicativo.
- **Test:** hook (eventi simulati), render condizionale banner, SearchBox disabled.
- **Done:** suite verde; comportamento verificato in E2E (Task 7).

### Task 6: Toast aggiornamento versione
- Rilevamento SW `waiting` → toast "Nuova versione disponibile — Aggiorna" (tap → `SKIP_WAITING` + reload una sola volta). Copy e stile coerenti col tema.
- **Test:** unit sul flusso (mock registration: waiting → click → postMessage + reload).
- **Done:** aggiornando la build in preview compare il toast e l'update avviene solo su tap.

### Task 7: E2E offline (Playwright)
- Estendere `e2e/run.mjs`: scenario A (online: import fixture, verdetto ok — regressione); scenario B (reload offline via `context.setOffline(true)`: shell carica, zone visibili, popup + verdetto funzionano, banner offline presente, ricerca disabilitata); scenario C (build modificata → toast aggiornamento).
- **Done:** E2E verde headless in locale.

### Task 8: Review finale whole-branch + MEMORIA + (post-ok Lorenzo) merge e deploy
- Review finale (opus) come Fase 1/2, aggiornamento MEMORIA, merge su `main` **solo dopo verifica di Lorenzo**; il push triggera il deploy Pages (gotcha: se la run Pages fallisce, `gh run rerun <id> --failed`). Verifica live + installazione su iPhone.

## Rischi specifici di piano
- rolldown-vite e plugin Workbox: il rischio principale è tutto nel Task 2 (per questo è uno spike separato e primo).
- Playwright + SW: serve `context` non-incognito-partizionato per mantenere il SW tra reload — verificare le API della versione in uso prima di scrivere lo scenario B.
- iOS: il SW vale solo da Safari/standalone; il test manuale finale resta indispensabile.
