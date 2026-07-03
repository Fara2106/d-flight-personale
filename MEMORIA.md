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
- **Hosting (deciso 2026-07-03):** pubblicare su **GitHub Pages** (gratis) a fine Fase 1, così l'app è usabile anche da Safari/iPhone (PWA installabile da "Aggiungi alla schermata Home").

## Idee future (da ragionare insieme, non in Fase 1-3)
- **Estensione ad altri paesi europei (proposta 2026-07-03, da discutere):** il formato ED-269 è standard UE — ogni paese pubblica le proprie zone UAS sul portale nazionale. Servirebbe: supporto multi-dataset (oggi un import sostituisce il precedente), ricerca luoghi non limitata all'Italia (oggi bbox Italia su Photon), e attenzione alle deroghe nazionali nel motore regole di Fase 2 (tarato su regole italiane).

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
  - [x] **Cleanup Task 1** (commit `32d027d`) — finding minori risolti
  - [x] **Task 2 — Tema** (commits `1f4f53b`+`5ffd2fa`, review **Approved**)
  - [x] **Task 3 — Tipi ED-269 + parser** (commit `97cdd0c`, review **Approved**)
  - [x] **Task 4 — Normalizzatore zone** (commit `a5cdfc0`, review **Approved**)
  - [x] **Task 5 — Diff zone** (commit `0a33f97`, review **Approved**)
  - [x] **Task 6 — Archivio IndexedDB** (commit `5d148df`, review **Approved**)
  - [x] **Task 7 — Import orchestratore + pulsante** (commit `c9c9e4a`, review **Approved**)
  - [x] **Task 8 — Trasformazioni mappa** (commit `c17d387`, review **Approved**; decisione utente: etichetta prohibited = "⛔ 0 m" fisso)
  - [x] **Task 9 — Stile mappa + MapView base** (commit `2415c06`, review **Approved**)
  - [x] **Task 10 — Render zone + popup** (commits `da43796`+`b700fe0`, review **Approved**; popup con soffitto formale AGL/AMSL, fix race zones/load)
  - [x] **Task 11 — Chrome UI** (commit `a42dc9f`, review **Approved**; legenda, banner staleness, disclaimer, empty state; wiring in App al Task 14)
  - [x] **Task 12 — Ricerca luoghi (Photon)** (commits `a4f3f66`+`d3a57e2`, review **Approved** dopo fix: bbox Italia, abort richieste stale)
  - [ ] Task 13 — Posizione GPS   ← **PROSSIMO**
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

**Finding minori del Task 1 — RISOLTI** nel commit di cleanup `32d027d`:
- `index.html`: titolo → `D-Flight personale`; `lang="it"`. ✅
- Rimossi file scaffold inutilizzati (`src/App.css`, `src/assets/*`, `public/icons.svg`). ✅ (`public/favicon.svg` tenuto: referenziato da index.html.)
- `"vitest/globals"` in `tsconfig.app.json`: **non applicato** di proposito — i test non sono in `tsconfig.app` (`include:["src"]`) e Vitest non typecheck-a; lo esporrebbe a `src` senza utilità.

**Gotcha tsconfig (passare a OGNI implementer):** `verbatimModuleSyntax:true` → import di soli tipi con `import type`/`import { type X }` (es. Task 2 `ThemeToggle`: `import { ThemePref }` va corretto in `import { type ThemePref }`); `noUnusedLocals`/`noUnusedParameters` su `src`; i test del task possono passare senza coprire tutti i file `src`, quindi far eseguire anche `npx tsc -b` e riportarne l'esito.

---

## Log
- **2026-06-30** — Brainstorming completato; specifica e piano scritti e committati. Avviata esecuzione subagent-driven Fase 1 su `feat/fase1-viewer`. **Task 1 (Scaffold) completato e approvato** (`041f3df`). Sessione fermata su richiesta per proseguire in una nuova chat usando questa MEMORIA come handoff.
- **2026-06-30 (ripresa)** — Nuova chat: letta MEMORIA + ledger + piano. Pre-flight plan review: nessun conflitto bloccante (solo quirk d'ambiente già previsti). **Cleanup Task 1 committato** (`32d027d`): titolo/lingua it, rimossi file scaffold; typecheck `tsc -b` verde e test verdi. Ripresa esecuzione subagent-driven dal Task 2.
