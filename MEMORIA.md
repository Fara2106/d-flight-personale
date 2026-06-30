# MEMORIA — D-Flight personale

> Diario di progetto, aggiornato di volta in volta.

## Cos'è
Web app (PWA) personale **non ufficiale** per visualizzare le **zone geografiche UAS italiane** (dati ufficiali D-Flight, formato ED-269) con UI moderna, e pianificare voli con verdetto personalizzato. Non sostituisce la verifica ufficiale su D-Flight.

## Decisioni chiave (brainstorming 2026-06-30)
- **Scopo:** mappa zone + pianificazione personalizzata (opzionale).
- **Funzione base:** mappa "nuda e cruda" (zone colorate + quota max in etichetta); pianificazione **on-demand**.
- **Device:** PWA responsive completa (desktop + mobile), offline.
- **Sync:** solo **import manuale** del file ED-269 (no backend, no credenziali). Motivo: il CORS impedisce il download diretto dal browser; auto-login rimandato a eventuale versione nativa.
- **Pianificazione:** verdetto personalizzato per drone (classe C0–C4 / sub-250g) + brevetto, calcolato in locale, **conservativo**.
- **Estetica:** stile "B — Chiaro & essenziale" (mappe iOS); tema Chiaro/Scuro/Sistema; accenti blu.
- **GPS:** posizione sulla mappa (puntino blu); resta sul dispositivo.
- **Stack:** React + TS + Vite, MapLibre (CARTO Positron/Dark Matter, keyless), Tailwind, IndexedDB, Vitest; geocoder Photon.

## Documenti
- Specifica: `docs/superpowers/specs/2026-06-30-dflight-personale-design.md`
- Piano Fase 1: `docs/superpowers/plans/2026-06-30-dflight-personale-fase1-viewer.md`

## Stato
- [x] Brainstorming + specifica — commit `8cc269c`, `c5b709b`
- [x] Piano Fase 1 (14 task, TDD) — commit `6512e5b`
- [ ] **Esecuzione Fase 1** (branch `feat/fase1-viewer`) — IN CORSO
  - [ ] Task 1 — Scaffold (Vite+React+TS+Tailwind+Vitest)
  - [ ] Task 2 — Tema (light/dark/system)
  - [ ] Task 3 — Tipi ED-269 + parser
  - [ ] Task 4 — Normalizzatore zone
  - [ ] Task 5 — Diff zone
  - [ ] Task 6 — Archivio IndexedDB
  - [ ] Task 7 — Import orchestratore + pulsante
  - [ ] Task 8 — Trasformazioni mappa (etichetta quota + GeoJSON)
  - [ ] Task 9 — Stile mappa + MapView base
  - [ ] Task 10 — Render zone + popup
  - [ ] Task 11 — Chrome UI (legenda, banner, disclaimer, empty state)
  - [ ] Task 12 — Ricerca luoghi (Photon)
  - [ ] Task 13 — Posizione GPS
  - [ ] Task 14 — Integrazione App + verifica E2E
- [ ] Fase 2 — profili + motore regole + pianificazione
- [ ] Fase 3 — offline / PWA

## Log
- **2026-06-30** — Brainstorming completato; specifica e piano scritti e committati. Avvio esecuzione subagent-driven della Fase 1 sul branch `feat/fase1-viewer`.
