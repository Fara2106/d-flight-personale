# Mini-spec — Popup mappa: tema + multi-zona

> Design approvato a voce in chat il 2026-07-03 (feedback E2E utente). Questa è la formalizzazione scritta.

## Problemi (feedback E2E)
1. **Popup illeggibile in tema scuro.** Il popup MapLibre ha sfondo bianco fisso (CSS di libreria) ma il testo eredita `color: var(--text)` dal body → testo chiaro su bianco in dark.
2. **Zone sovrapposte confuse.** Al click su un punto coperto da più zone si vede solo la zona in cima; l'utente non sa che sotto ce ne sono altre (caso frequente: CTR + zone locali).

## Soluzioni approvate
### 1. Stile popup nei token tema
In `src/index.css`, regole per `.maplibregl-popup-content` e `.maplibregl-popup-tip` (tutte le varianti anchor) usando `var(--surface)` / `var(--text)` / `var(--shadow)`, angoli arrotondati, pulsante di chiusura con `var(--text-muted)`.

### 2. Popup multi-zona ("tutte in un popup")
Al click mostrare **tutte** le zone sotto al punto in un unico popup:
- Funzione pura testabile `buildPopupContent(items)` in `src/map/popupContent.ts`:
  - **deduplica** per `id` (le feature GeoJSON possono arrivare duplicate dai tile);
  - **ordina per restrittività**: `prohibited` → `auth_required` → `conditional` → `none` (sconosciute in coda);
  - per ogni zona rende: **pallino colore** (da `ZONE_COLORS`, fallback `#888888`) + **nome** + **etichetta quota** (`label`) + **quota max** con riferimento verticale (`upperLimitM` + `verticalRef`, `—` se null);
  - testo sempre via `textContent` (niente HTML raw — precedente polish `2b29d82`);
  - il contenitore scrolla oltre ~4 zone (CSS `max-height` + `overflow-y: auto`).
- In `MapView`, il click handler usa **tutte** le `e.features` del layer `zones-fill` (non solo la prima) e monta il popup con `buildPopupContent`. `onZoneClick` resta invariato (prima feature).

## Fuori scope
- Nessun cambiamento a dati, import, ricerca, GPS.
- Il finding minore "popup formatting non testato" (Task 10) si chiude con i test di `buildPopupContent`.

## Verifica
- Unit test jsdom su `buildPopupContent` (dedupe, ordinamento, contenuto, colori, classi).
- Suite completa + `npx tsc -b` verdi.
- E2E manuale con l'utente (già in TODO: ricerca, GPS, temi, persistenza) — include popup in dark e su zone sovrapposte.
