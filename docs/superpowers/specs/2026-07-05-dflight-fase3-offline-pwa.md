# D-Flight personale — Fase 3: offline / PWA

- **Data:** 2026-07-05
- **Stato:** **BOZZA — proposta da revisionare con Lorenzo** (nessun brainstorming fatto: le decisioni aperte sono marcate ⚠️ e vanno validate prima di scrivere il codice del piano)
- **Spec madre:** `2026-06-30-dflight-personale-design.md` (§ device/PWA offline)

---

## 1. Obiettivo

Rendere l'app **installabile** (PWA su iPhone/Android/desktop) e **utilizzabile in campo senza rete**: mappa consultabile, zone visibili e verdetto "posso volare qui?" pienamente funzionante offline. È il completamento naturale dell'architettura attuale: zone e profili vivono già in IndexedDB, il motore regole è locale — manca solo l'app shell offline e il packaging PWA.

## 2. Cosa funziona già offline (nessun lavoro)

| Componente | Stato |
|------------|-------|
| Zone ED-269 | già in IndexedDB (`zoneStore`), import manuale |
| Profili drone/pilota | già in IndexedDB (`profileStore`) |
| Motore regole + intersezioni | funzioni pure locali (zero rete) |
| Tema chiaro/scuro | locale |
| Banner staleness dati | già presente (`isStale`) |

## 3. Cosa manca (scope Fase 3)

1. **Web App Manifest** — nome, icone (192/512 png + maskable + apple-touch-icon), `display: standalone`, `start_url`/`scope` coerenti con `base: /d-flight-personale/`, `theme_color` per tema chiaro/scuro.
2. **Service worker: precache dell'app shell** — `index.html` + chunk JS/CSS (incluso il chunk `maplibre` separato in `2e9b172`) + favicon. Versionato per build: una nuova deploy invalida il precache vecchio.
3. **Aggiornamenti espliciti** — al rilevamento di una nuova versione: toast discreto "Nuova versione disponibile — Aggiorna" (niente reload a sorpresa mentre l'utente sta consultando una zona).
4. **Runtime cache leggera per lo stile mappa** — `style.json`, glyphs e sprite CARTO (piccoli e stabili): stale-while-revalidate. Senza di essi MapLibre non parte nemmeno con i tile in cache.
5. **UX offline** — banner discreto "Sei offline" (riuso pattern `DataStatusBanner`); ricerca Photon disabilitata offline con motivazione; il resto dell'app resta pienamente operativo.
6. **Installabilità** — iOS: "Aggiungi alla schermata Home" (+ meta `apple-mobile-web-app-*`); Android/desktop: manifest + SW bastano per il prompt del browser.

## 4. Decisioni aperte — ⚠️ da validare con Lorenzo

| # | Tema | Opzioni | Raccomandazione |
|---|------|---------|-----------------|
| A | **Cache dei tile CARTO** | (1) nessuna cache: offline = zone su sfondo neutro · (2) runtime cache limitata (es. max 300 tile, TTL 7 gg, solo zoom bassi) | **Opzione 1** per partire: i TOS del basemap free CARTO scoraggiano il caching massivo; le zone restano leggibili su sfondo neutro e il verdetto non dipende dai tile. L'opzione 2 si può aggiungere dopo, come miglioria consapevole. |
| B | **vite-plugin-pwa (Workbox) vs SW scritto a mano** | plugin = precache manifest automatico, meno codice · SW manuale = zero dipendenze, pieno controllo, logica testabile con Vitest | **Spike nel Task 1 del piano**: il plugin va verificato contro rolldown-vite (Vite 8); se builda e genera il precache corretto si usa il plugin, altrimenti SW manuale con lista asset generata da un mini-script post-build. |
| C | **Bottone "Installa app" custom** (`beforeinstallprompt`, solo Chromium) | sì / no | **No** per minimalismo: si lascia il prompt nativo del browser; su iOS comunque non esiste. |
| D | **Icona PWA** | generare png 192/512/maskable dal `favicon.svg` esistente vs disegno nuovo | Generazione dal favicon esistente (coerente con l'estetica attuale); i png vengono committati, niente step di build extra. |

## 5. Fuori scope Fase 3

- Download/aggiornamento automatico del dataset ED-269 (resta import manuale — vincolo CORS, vedi spec madre; eventuale versione nativa Capacitor).
- Cache dei risultati Photon (ricerca ha senso solo online).
- Background sync / notifiche push.
- Multi-dataset ED-269 europeo (idea futura già annotata in MEMORIA).

## 6. Esperienza utente (riassunto)

- **Prima visita (online):** nulla cambia; il browser propone l'installazione dove supportato.
- **Installata, offline in campo:** l'app si apre, mappa su sfondo neutro (o tile cacheati, decisione A), zone colorate consultabili con popup, Verifica/Profilo/verdetto funzionanti al 100%; banner "Sei offline"; ricerca disabilitata con tooltip.
- **Nuova versione pubblicata:** al primo avvio online compare il toast "Aggiorna"; tap → reload con la nuova versione.

## 7. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Compat vite-plugin-pwa ↔ rolldown-vite | spike col criterio oggettivo al Task 1; fallback SW manuale già progettato |
| SW che serve una shell stantia dopo il deploy | precache versionato per build + toast di aggiornamento esplicito |
| GitHub Pages e scope del SW sotto sottopercorso `/d-flight-personale/` | `scope`/`start_url` relativi alla base; E2E dedicato con `vite preview --base` |
| iOS Safari: quirk standalone (statusbar, viewport) | meta apple dedicati + verifica manuale su iPhone di Lorenzo a fine fase |

## 8. Test previsti

- **Unit (Vitest):** logica pura del SW se manuale (routing strategie per URL, versioning cache); hook `useOnline` per il banner; manifest linkato in `index.html`.
- **E2E (Playwright):** `context.setOffline(true)` dopo un primo load → reload → app carica, zone visibili, verdetto ok, banner offline presente, ricerca disabilitata; flusso aggiornamento (build A → build B → toast).
- **Manuale con Lorenzo:** installazione reale su iPhone (Aggiungi a Home), test in modalità aereo.
