# MEMORIA — D-Flight personale

> Diario di progetto + **documento di handoff** per continuare in una nuova chat.
> Ultimo aggiornamento: 2026-06-30 (fine sessione di brainstorming + avvio esecuzione).

## Cos'è
Web app (PWA) personale **non ufficiale** per visualizzare le **zone geografiche UAS italiane** (dati ufficiali D-Flight, formato ED-269) con UI moderna, e pianificare voli con verdetto personalizzato. Non sostituisce la verifica ufficiale su D-Flight.

## Decisioni chiave (brainstorming 2026-06-30)
- **Scopo:** mappa zone + pianificazione personalizzata (opzionale).
- **Funzione base:** mappa "nuda e cruda" (zone colorate + quota max in etichetta su ogni zona); pianificazione **on-demand**.
- **Device:** PWA responsive completa (desktop + mobile), offline.
- **Sync:** solo **import manuale** del file ED-269 (no backend, no credenziali). Motivo: il **CORS** impedisce il download diretto dal browser; auto-login con credenziali rimandato a eventuale **versione nativa** (Capacitor).
- **Pianificazione:** verdetto personalizzato per drone (classe C0–C4 / sub-250g) + brevetto (A1/A3, A2), calcolato in locale, **conservativo** (nel dubbio: "verifica ufficialmente").
- **Estetica:** stile "B — Chiaro & essenziale" (mappe iOS); tema **Chiaro/Scuro/Sistema**; accenti blu (`#007aff`/`#0a84ff`); colori zone rosso/arancio/giallo/verde.
- **GPS:** posizione sulla mappa (puntino blu); resta sul dispositivo.
- **Stack:** React + TS + Vite, MapLibre (CARTO Positron/Dark Matter, keyless), Tailwind v3, IndexedDB (`idb`), Vitest; geocoder **Photon**.

## Documenti di riferimento
- **Specifica:** `docs/superpowers/specs/2026-06-30-dflight-personale-design.md`
- **Piano Fase 1 (14 task, TDD):** `docs/superpowers/plans/2026-06-30-dflight-personale-fase1-viewer.md`
- **Ledger SDD (locale, git-ignored):** `.superpowers/sdd/progress.md`

## Stato
- [x] Brainstorming + specifica — commit `8cc269c`, `c5b709b`
- [x] Piano Fase 1 — commit `6512e5b`
- [x] MEMORIA creata — commit `7eb4c49`
- [ ] **Esecuzione Fase 1** (branch `feat/fase1-viewer`) — IN CORSO
  - [x] **Task 1 — Scaffold** (commit `041f3df`, review **Approved**, solo minori)
  - [ ] Task 2 — Tema (light/dark/system)   ← **PROSSIMO**
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
- [ ] Fase 2 — profili + motore regole + pianificazione (piano da scrivere)
- [ ] Fase 3 — offline / PWA (piano da scrivere)

---

## RIPRESA — istruzioni per la nuova chat

**Metodo:** subagent-driven-development (superpowers). Nella nuova chat di' qualcosa come:
> "Continua l'esecuzione del piano `docs/superpowers/plans/2026-06-30-dflight-personale-fase1-viewer.md` col metodo subagent-driven, riprendendo dal **Task 2** (il Task 1 è già completo, vedi `.superpowers/sdd/progress.md`). Branch `feat/fase1-viewer`."

**Stato git:** branch `feat/fase1-viewer`, HEAD `041f3df`. Su `main` ci sono solo i documenti (spec, piano, MEMORIA). L'app vive sul branch.

**Ciclo per ogni task** (Task N):
1. `task-brief` → estrai il brief: `<SK>/scripts/task-brief docs/superpowers/plans/2026-06-30-dflight-personale-fase1-viewer.md N`
2. Registra BASE = HEAD attuale, poi **dispatch implementer** (modello sotto) col brief + file di report.
3. `review-package BASE HEAD` → **escludi `package-lock.json`** dal diff (è enorme): `git diff -U10 BASE..HEAD -- . ':(exclude)package-lock.json'`.
4. **Dispatch task reviewer** (sonnet) con brief + report + diff + vincoli globali.
5. Fix solo Critical/Important; i Minor vanno nel ledger per la review finale.
6. Marca il task completo nel **ledger** e in **MEMORIA**.

`<SK>` = `/Users/lorenzofaraoni/.claude/plugins/cache/claude-plugins-official/superpowers/6.0.3/skills/subagent-driven-development`

**Modello consigliato per task** (turni bassi = meno costo):
- Trascrizione pura (codice completo nel piano) → **haiku**: Task 2,3,4,5,7,8,11,12,13
- Quirk d'ambiente / integrazione → **sonnet**: Task 6 (fake-indexeddb), 9 e 10 (MapLibre), 14 (integrazione)
- Task reviewer → **sonnet** · Review finale whole-branch → **opus**

**Risoluzioni già applicate nel Task 1 (non rifare):**
- Scaffold creato via sottocartella `.vite-tmp` poi spostata (la dir non era vuota).
- **Tailwind pinnato a v3** (il piano usa sintassi v3).
- `vite.config.ts` importa `defineConfig` da **`vitest/config`** (TS6/Vite8 non espone `test` su `vite`).

**Da sistemare (finding minori del Task 1)** — farlo come piccolo commit di cleanup prima del Task 2, oppure all'inizio del prossimo task:
- `index.html`: titolo `vite-tmp` → `D-Flight personale`; `lang="en"` → `lang="it"`.
- Rimuovere file scaffold inutilizzati: `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`.
- (Preventivo) aggiungere `"vitest/globals"` ai `types` in `tsconfig.app.json`.

---

## Log
- **2026-06-30** — Brainstorming completato; specifica e piano scritti e committati. Avviata esecuzione subagent-driven Fase 1 su `feat/fase1-viewer`. **Task 1 (Scaffold) completato e approvato** (`041f3df`). Sessione fermata su richiesta per proseguire in una nuova chat usando questa MEMORIA come handoff.
