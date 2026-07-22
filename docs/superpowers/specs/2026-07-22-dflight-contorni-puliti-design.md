# D-Flight — Contorni puliti (round 9 "le forme fanno pasticcio")

> Spec di design. Data: 2026-07-22.
> Feedback di Lorenzo dopo l'ok su round 8 + restyle UI: **"tutto bello, poco chiaro ancora l'accavallamento delle zone"** → chiarito in brainstorming: *"le forme fanno pasticcio"* (non i veli, non il concetto, non la semantica). Scope allargato da Lorenzo: oltre ai bordi, "calma anche il resto".

## Contesto e diagnosi

La baseline attuale (round 6+7+8, **approvata**) rende i veli come **mosaico piatto mutuamente esclusivo**: `categoryMosaic` (in [fastUnion.ts](../../../src/map/fastUnion.ts)) fonde le zone per categoria e **ritaglia a cascata** (sottrae dalle categorie meno severe quelle più severe con `difference`), così ogni punto ha **un solo colore di velo**. Questo funziona: a Roma la macchia rossa è piatta e pulita.

Il residuo che Lorenzo legge come "pasticcio" **non sono i veli, sono i contorni**:

1. **Contorni che si incrociano ai confini tra categorie.** Oggi `zones-cat-line` disegna il bordo di *ogni* categoria dal mosaico ritagliato (stessa sorgente `SRC_CAT`, colore per `restrictionType`, `line-sort-key` per severità). Dove due categorie confinano (es. `prohibited` rosso e `auth_required` arancione a Roma), i due bordi corrono paralleli e — per le piccole imprecisioni geometriche introdotte dal ritaglio `difference` — **sbucano uno di fianco all'altro e si incrociano**. È la "ragnatela" residua vista in `.tmp-screens/premium/fix-roma-z11.png` (angolo in alto a sinistra).

2. **Tratteggio "richiede autorizzazione" diffuso.** `zones-hatch` (fill-pattern, `fill-opacity: 0.3`, solo `auth_required`, dal dettaglio z11) marca la categoria auth. Ma la CTR di Roma/Fiumicino copre mezzo schermo → il tratteggio **tappezza** quasi tutta la mappa (`.tmp-screens/premium/fix-fiumicino-z13.png`).

3. **Etichette quota ripetute.** Le etichette (`zones-label` / `zones-label-standard`) vengono dalla sorgente per-fascia. Esiste già una dedup `labelPrimary` per `nome+testo` ([zonesToGeoJSON.ts](../../../src/map/zonesToGeoJSON.ts)), ma zone con **nomi diversi e stessa quota** ravvicinate sfuggono → "0 m" / "120 m" ripetuti a pochi millimetri.

**Non un problema (da NON toccare):** i veli mutuamente esclusivi, il popup che elenca tutte le zone al tocco, l'highlight blu della zona aperta, i colori/l'ordine di severità.

## Obiettivo

Un **solo contorno per punto**, colorato secondo la categoria più restrittiva, senza linee che si incrociano; mappa complessivamente più calma (tratteggio meno invadente, etichette non ripetute). Nessuna regressione sulla semantica (verdetto e popup vedono sempre tutto).

## Design

### 1. Contorni cumulativi (via i confini interni) — il cuore

Invece di disegnare il bordo di ogni categoria dal mosaico *ritagliato*, si disegnano contorni sui **blob cumulativi per severità**:

- `outline[prohibited]` = perimetro di `union(prohibited)`
- `outline[auth_required]` = perimetro di `union(prohibited ∪ auth_required)`
- `outline[conditional]` = perimetro di `union(prohibited ∪ auth_required ∪ conditional)`

Ogni confine *interno* tra due categorie diventa interno a un blob cumulativo → **non viene disegnato**. Restano solo i perimetri esterni. Dove i perimetri di blob diversi coincidono (una zona severa che sporge sul bordo del blob meno severo), il `line-sort-key` per severità + lo spessore maggiore del più severo lo fanno **vincere**: un colore per tratto, quello della categoria più severa presente su quel bordo.

**Perché è robusto:** usa solo `union` (già veloce e affidabile via `fastUnion.unionAll`, i blob cumulativi si costruiscono incrementalmente riusando il risultato precedente), **non** `difference` (fragile, causa delle imprecisioni che facevano sbucare i bordi). `none` (verde) non ha contorno, come oggi.

**Dati:** il worker/mosaico produce ora **due** collezioni — i veli ritagliati (invariati, per `zones-cat-fill` e `zones-hatch`) e i contorni cumulativi (nuova collezione, per `zones-cat-line`). Il payload di `computeCategoryMosaic` / la cache IndexedDB (`overlays`) passano da una singola `FeatureCollection` a una struttura con entrambe; la cache va invalidata/versionata (bump del formato con fallback a ricalcolo se manca la parte outline). I contorni conservano le graduazioni con lo zoom già presenti in `buildCatLinePaint` (tenui all'Italia intera, pieni da z9.5).

### 2. Tratteggio più calmo

Ridurre l'invadenza di `zones-hatch` mantenendone il significato (segnale "richiede autorizzazione", che resta ridondato dal velo e dal bordo arancione cumulativo): abbassare `fill-opacity` da `0.3` a **≈0.15** e/o rendere il pattern più rado (passo maggiore in `hatchImage`). Valore di partenza `0.15`; taratura fine da confermare sul rendering reale. Resta solo al dettaglio (`minzoom` invariato).

### 3. Etichette quota de-duplicate

Estendere la dedup delle etichette dalla chiave `nome+testo` a una **dedup per valore+prossimità**: a parità di testo quota, se una primaria è già stata scelta entro una soglia di distanza, le successive non diventano primarie (a prescindere dal nome). Obiettivo: **una sola etichetta per gruppo ravvicinato di stessa quota**. La logica resta in `zonesToGeoJSON.ts` (proprietà `labelPrimary`), senza toccare i layer.

## Componenti toccati

- `src/map/fastUnion.ts` — nuova funzione per i contorni cumulativi (union incrementale per soglia di severità); `categoryMosaic` invariato per i veli.
- `src/map/overlayWorkerClient.ts`, `unionWorker.ts`, `overlayCache.ts`, `categoryOverlay.ts` — payload a due collezioni (veli + contorni) e versione cache.
- `src/map/MapView.tsx` — `zones-cat-line` legge la nuova sorgente contorni; `zones-hatch` opacità ridotta; sorgenti/filtri di visibilità per categoria aggiornati di conseguenza.
- `src/map/zonesToGeoJSON.ts` — dedup etichette per valore+prossimità.
- `src/map/mapStyle.ts` — eventuali costanti (es. opacità hatch) se estratte per leggibilità.

## Testing

- **Unit (TDD):** contorni cumulativi — dato un insieme con prohibited⊂auth, i perimetri non includono il confine interno; il blob cumulativo auth contiene il prohibited; nessuna feature outline per `none`. Dedup etichette — due zone stessa quota ravvicinate → una sola `labelPrimary`; due zone stessa quota lontane → entrambe primarie.
- **Robustezza/perf:** il calcolo dei contorni cumulativi va misurato sul **file ED-269 reale** (target: entro pochi secondi in più del mosaico attuale ~7s, zero fallimenti; se la union totale è indigesta, stessa strategia albero+snap di `unionAll`).
- **E2E (Playwright, headless sul Mac):** suite 15/15 + offline 11/11 verdi; screenshot before/after col file reale a Roma z11 e Fiumicino z12/z13 in `.tmp-screens/` per il confronto visivo (niente incroci di bordi; tratteggio calmo; etichette non ripetute).
- **Collaudo reale:** verifica manuale col file ED-269 reale ai vari zoom prima del push.

## Fuori scope

Qualsiasi modifica ai veli/colori/semantica della baseline approvata; il popup; il motore verdetto; nuove funzioni. Se dal vivo il tratteggio o lo spessore bordo non convincono, restano leve di taratura (`fill-opacity` hatch, `ZONE_LINE_WIDTH`, graduazioni in `buildCatLinePaint`).

## Rollback

Cambio isolato alla resa mappa: se non convince, si torna alla baseline round 8 ripristinando `zones-cat-line` sulla sorgente ritagliata e l'opacità hatch a `0.3`. La baseline round 8 resta il punto di ritorno finché Lorenzo non approva il round 9.
