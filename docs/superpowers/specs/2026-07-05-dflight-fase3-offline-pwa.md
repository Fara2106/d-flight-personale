# D-Flight personale — Fase 3: offline / PWA

- **Data:** 2026-07-05 (decisioni sciolte: 2026-07-09)
- **Stato:** **APPROVATA — decisioni A–D sciolte con Lorenzo il 2026-07-09** (vedi §4). Prossimo passo: completare il piano col codice per task.
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

## 4. Decisioni — ✅ SCIOLTE con Lorenzo (2026-07-09)

| # | Tema | Decisione |
|---|------|-----------|
| A | **Cache dei tile CARTO** | **Nessuna cache tile**: offline = zone su sfondo neutro. I TOS del basemap free CARTO scoraggiano il caching massivo; il verdetto non dipende dai tile. La cache limitata resta possibile miglioria futura. |
| B | **vite-plugin-pwa (Workbox) vs SW scritto a mano** | Spike con criterio oggettivo — **ESEGUITO il 2026-07-09 durante la scrittura del piano, esito: PLUGIN.** `vite-plugin-pwa@1.3.0` builda pulito su rolldown-vite 8, precache corretto (8 entry, chunk `maplibre-*` incluso, URL relativi allo scope), `navigateFallback: index.html`, e shell servita **davvero offline** in un test Playwright (`setOffline(true)` → reload → app renderizza). Il piano contiene solo la variante plugin. |
| C | **Bottone "Installa app" custom** (`beforeinstallprompt`, solo Chromium) | **No**: si lascia il prompt nativo del browser; su iOS comunque non esiste. |
| D | **Icona PWA** | **Disegno NUOVO** (scelta di Lorenzo, diversa dalla raccomandazione). **Design approvato il 2026-07-09: proposta "B — Zona sulla mappa"** (mappa notturna stilizzata blu navy, zona circolare rossa ED-269 semitrasparente con bordo, quadricottero bianco geometrico sopra; drone dentro la zona sicura maskable). Dall'SVG master si generano i png 192/512/maskable-512/apple-touch-180, committati in `public/icons/` — niente step di build extra. |

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
