# MEMORIA — D-Flight personale

> Diario di progetto + **documento di handoff** per continuare in una nuova chat.
> Ultimo aggiornamento: 2026-07-03 (E2E completata, popup mergiato su main; resta il deploy).

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

## TODO prossima sessione
- **Fase 1 CHIUSA, deploy FATTO (2026-07-03):** app online su **https://fara2106.github.io/d-flight-personale/** (repo pubblico `Fara2106/d-flight-personale`). **Decisione utente (2026-07-03): il repo resta pubblico**, con la consapevolezza che pubblico = trovabile (profilo GitHub, ricerca, indicizzazione), non "solo con il link"; solo il sito Pages è di fatto non elencato. Valutato il passaggio a privato (l'utente ha Pro: il sito continuerebbe a funzionare, comando: `gh repo edit Fara2106/d-flight-personale --visibility private --accept-visibility-change-consequences` — da far eseguire all'utente), scelto di lasciarlo così. Deploy automatico a ogni push su `main` via `.github/workflows/deploy.yml` (typecheck + test + build + Pages). Nota: le deployment Pages su questo repo ogni tanto falliscono con "Deployment failed, try again later" (capitato 2 volte su 4, anche dopo la prima) — **basta rilanciare la run** (`gh run rerun <id> --failed`), al retry passa. I push solo-docs (MEMORIA, docs/) non triggerano il deploy (`paths-ignore`).
- **Prossimo lavoro grosso:** Fase 2 — **brainstorming FATTO, spec scritta e committata** (`docs/superpowers/specs/2026-07-03-dflight-fase2-pianificazione-design.md`, commit `1a0d615`). Decisioni utente: punto+cerchio (0–500 m, default 100), spot rimandati, multi-drone senza preset, ricolora-mappa rimandato, approccio A (tabella decisionale esplicita), **accordion+evidenziazione una-zona-alla-volta anche nel popup Fase 1** (rework richiesto dall'utente: le zone sovrapposte in colonna confondono). NB: sezione 4 (errori+test) presentata ma l'utente era AFK — **spec in attesa della sua review**, poi writing-plans.
- **Fix da E2E (2026-07-03, entrambi mergiati su main):**
  1. ✅ `25421d3` — le regole popup di `index.css` **non si applicavano mai**: `maplibre-gl.css` viene dopo nel grafo dei moduli e a parità di specificità vinceva (popup bianco fisso, illeggibile in dark). Fix: prefisso `:root` su tutte le regole popup. Gotcha da ricordare per ogni override di CSS di libreria.
  2. ✅ `ee34d9c` — ricerca Photon muta: l'API ha **rimosso il supporto `lang=it`** (risponde 400; restano default/de/en/fr). Tolto il parametro `lang`.
- **Verifica E2E — COMPLETATA (2026-07-03, Playwright headless):** empty state, import, zone visibili, popup singola/multi-zona (dedup + ordinamento restrittività ok), popup dark leggibile (surface `#1f2630`, radius 12px), ricerca ("Colosseo, Roma, Lazio" → flyTo), GPS (mock, flyTo + puntino), errore file invalido mostrato e ripulito al re-import, persistenza zone + tema al reload, zero errori console. Script riusabile: era in scratchpad `e2e/run.mjs` (Playwright + file ED-269 sintetico con 2 zone sovrapposte su Roma + 1 separata).
- **Finding minore (backlog):** il bottone "Importa file zone (ED-269)" in basso a destra è parzialmente coperto dall'attribution CARTO su viewport 1280×800.

## Gotcha ambiente (2026-07-03)
- Il progetto vive in `~/Documents` **sincronizzata con iCloud Drive**: iCloud ha creato 17 duplicati di conflitto (`* 2.*`, es. `index 2.html`) che rompevano Vite/Tailwind con `ETIMEDOUT`, più file "dataless" (solo nel cloud). Risolto: duplicati eliminati (erano untracked), `brctl download .`, riavvio dev server. **Può ripresentarsi**: se Vite dà ETIMEDOUT o errori su file `* 2.*`, ripulire con `find . -name "* 2.*" -not -path "./node_modules/*" -delete` e `brctl download .`. Valutare in futuro lo spostamento del progetto fuori da iCloud.

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
- [x] **Esecuzione Fase 1** — COMPLETATA e **mergiata su `main`** (2026-07-03, fast-forward a `1bf2747`; branch `feat/fase1-viewer` eliminato)
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
  - [x] **Task 13 — Posizione GPS** (commit `4e93122`, review **Approved**, zero Critical/Important)
  - [x] **Task 14 — Integrazione App** (commits `eff00e9`+`c22285c`, review **Approved** dopo fix: flyTo stabile via stato esplicito)
  - [x] **Review finale whole-branch (opus)** — verdetto **Ready to merge**, zero Critical/Important; polish batch applicato (`2b29d82`: popup via textContent, clear errore su import ok, geo.error visibile, listener matchMedia tema system). Suite 34/34 + `tsc -b` verdi, verificati dal controller.
- [x] **FASE 1 COMPLETA (2026-07-03)** — restano: **verifica manuale E2E** (Step 5 Task 14) con l'utente, **decisione merge su main**, poi **deploy GitHub Pages**.
- [x] **Migliorie popup (tema + multi-zona)** — implementate, **verificate E2E** (con 2 fix: `25421d3` cascata CSS, `ee34d9c` Photon lang) e **mergiate su `main`** (2026-07-03, fast-forward a `ee34d9c`; branch eliminato). Suite 39/39 + tsc verdi su main.
- [x] **Deploy GitHub Pages** — FATTO (2026-07-03): https://fara2106.github.io/d-flight-personale/ — verificato live (app carica, zero errori console).
- [ ] Fase 2 — profili + motore regole + pianificazione: **spec approvanda** (`2026-07-03-dflight-fase2-pianificazione-design.md`); piano da scrivere dopo la review utente
- [ ] Fase 3 — offline / PWA (piano da scrivere)

---

## RIPRESA — istruzioni per la nuova chat

**Metodo:** subagent-driven-development (superpowers). Nella nuova chat di' qualcosa come:
> "Continua l'esecuzione del piano `docs/superpowers/plans/2026-06-30-dflight-personale-fase1-viewer.md` col metodo subagent-driven, riprendendo dal **Task 2** (il Task 1 è già completo, vedi `.superpowers/sdd/progress.md`). Branch `feat/fase1-viewer`."

**Stato git:** tutto su `main` (Fase 1 mergiata il 2026-07-03, branch eliminato). La sezione "Ciclo per ogni task" qui sotto resta come riferimento di metodo per i piani di Fase 2/3.

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
- **2026-07-03** — Sessione "finisci il lavoro": completati e approvati **Task 11** (`a42dc9f`), **Task 12** (`a4f3f66`+`d3a57e2`, fix bbox Italia + abort stale), **Task 13** (`4e93122`). **Task 14** implementato (`eff00e9`, suite 32/32 verde); review ha trovato 1 Important plan-mandated (fallback `flyTo` instabile in App: re-centering spurio a ogni render + 📍 non ricentra dopo una ricerca) → fix in corso, poi re-review e review finale whole-branch (opus). Decisioni utente di oggi: hosting **GitHub Pages** a fine Fase 1; idea futura multi-paese ED-269 annotata; import resta manuale (ok utente). Dopo la Fase 1 resta la verifica manuale E2E (Step 5 del Task 14) da fare con l'utente.
- **2026-07-03 (migliorie popup)** — Ripulite di nuovo le cartelle duplicate iCloud (`src/* 2`, `tests/* 2`, vuote — il gotcha si è ripresentato). Scritte mini-spec e piano (`docs/superpowers/{specs,plans}/2026-07-03-popup-tema-multizona.md`), eseguito il piano **inline** (3 task piccoli, TDD) su branch `feat/popup-tema-multizona`: CSS popup nei token tema (`9db7dbf`), `buildPopupContent` pura con 5 test (`f59be9d`), wiring MapView con tutte le feature del click (`102f761`). Review medium sul diff del branch: **zero finding**. Suite 39/39 + `tsc -b` verdi. Chiuso il Minor "popup formatting non testato" nel ledger. **Prossimi passi:** E2E utente (popup dark + zone sovrapposte, poi ricerca/GPS/temi/persistenza) → merge su `main` → deploy GitHub Pages.
- **2026-07-03 (deploy)** — Confermato dall'utente il repo pubblico: creato `Fara2106/d-flight-personale`, aggiunti `base: '/d-flight-personale/'` in `vite.config.ts` e workflow Pages (`581cf4c`), push. Prima deployment fallita (race provisioning Pages su repo nuovo), risolta rilanciando la run. **Sito live e verificato con Playwright: https://fara2106.github.io/d-flight-personale/** (200, app carica, empty state ok, zero errori). **FASE 1 COMPLETAMENTE CHIUSA.** Backlog noti: bundle 1.24 MB (code-splitting MapLibre), bottone import coperto dall'attribution CARTO.
- **2026-07-03 (E2E + merge popup)** — Verifica E2E completa con Playwright headless (l'estensione Claude-in-Chrome non era connessa; browser Playwright già in cache). **Trovati e corretti 2 bug reali:** (1) le regole tema del popup non si applicavano mai — `maplibre-gl.css` vince la cascata perché importato dopo `index.css`; fix con prefisso `:root` (`25421d3`); (2) ricerca Photon rotta a monte — `lang=it` non più supportato, API risponde 400; tolto il parametro (`ee34d9c`, TDD). Re-run E2E: tutto verde (popup dark leggibile, multi-zona ordinato, ricerca, GPS, persistenza, errori import, zero errori console). **Merge fast-forward su `main`** (a `ee34d9c`), branch eliminato, suite 39/39 + `tsc -b` verdi su main. `gh` è autenticato (account Fara2106). **Resta solo il deploy GitHub Pages** (attende conferma utente: nome repo, visibilità).
- **2026-07-03 (brainstorming Fase 2)** — Brainstorming Fase 2 completato (sezioni 1-3 approvate dall'utente, sezione 4 presentata con utente AFK). Spec scritta, self-review fatta (fix: riga "legacy <250g" → si usa la classe sub-250, niente enum dedicato), committata (`1a0d615`). Scope: verifica punto+cerchio, profili multi-drone senza preset, pilota singolo A1/A3+A2 con scadenze, motore a tabella esplicita (approccio A, Turf per le intersezioni), AMSL mai convertito (warning), zone a schedule non filtrate. **Novità trasversale:** accordion+evidenziazione una-zona-alla-volta sostituirà anche il popup multi-zona di Fase 1. **Prossimo passo: review utente della spec → writing-plans.**
- **2026-07-03 (chiusura Fase 1)** — Fix flyTo (`c22285c`) approvato in re-review. **Review finale whole-branch (opus): Ready to merge, zero Critical/Important.** Applicato polish batch consigliato (`2b29d82`): popup con `textContent` (niente setHTML raw), `setErr(null)` dopo import riuscito, `geo.error` mostrato all'utente, listener `matchMedia` per il tema Sistema. Suite **34/34** e `tsc -b` verdi (verificati dal controller). Finding Minor residui = backlog Fase 2 nel ledger. **Prossimi passi:** verifica manuale E2E nel browser con l'utente → merge su `main` → deploy GitHub Pages → piano Fase 2.
