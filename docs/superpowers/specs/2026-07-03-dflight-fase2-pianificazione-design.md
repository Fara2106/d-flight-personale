# D-Flight personale — Fase 2: profili, motore regole, verifica on-demand

- **Data:** 2026-07-03
- **Stato:** design approvato in brainstorming (sezioni 1-3 validate con l'utente; sezione 4 presentata), in attesa di review finale della spec
- **Spec madre:** `2026-06-30-dflight-personale-design.md` (§5.2, §5.3, §9)

---

## 1. Obiettivo

Aggiungere al viewer di Fase 1 il **verdetto personalizzato "posso volare qui?"**: l'utente definisce i propri droni e qualifiche, tocca un punto sulla mappa (con raggio opzionale) e ottiene un esito conservativo calcolato in locale, con la spiegazione zona per zona.

## 2. Decisioni di scope (brainstorming 2026-07-03)

| Tema | Decisione |
|------|-----------|
| Geometria verifica | **Punto + cerchio con raggio regolabile** (0–500 m, default 100 m). Poligoni rimandati. |
| Spot salvati | **Rimandati** (il modello dati `Spot` resta nella spec madre per il futuro). |
| Profili drone | **Multi-drone senza catalogo preset**: nome, massa (g), classe. Radio "drone attivo". |
| Pilota | **Profilo singolo**: checkbox qualifiche A1/A3 e A2 (scadenza opzionale), numero operatore solo display. |
| Ricolora-mappa per drone | **Rimandato** (stessa logica del motore applicata a tutte le zone: si aggiunge quando il motore è rodato). |
| Filtri zone (§5.1 spec madre) | **Fuori scope Fase 2** (non riguardano il planner). |
| Motore regole | **Approccio A — tabella decisionale esplicita** tipata + funzioni pure; niente DSL, niente verdetto minimale. |
| Zone sovrapposte | **Accordion + evidenziazione, una zona alla volta** (vedi §3.3) — vale sia per il popup mappa sia per la scheda verdetto. |

## 3. Esperienza utente

### 3.1 Modalità verifica
Pulsante **"Verifica"** sulla mappa (stessa famiglia dei controlli GPS/tema/import). Al tap:

1. Overlay con istruzione *"Tocca un punto sulla mappa"* + pulsante **"Usa la mia posizione"** (se GPS disponibile).
2. Tap sulla mappa → punto selezionato con **cerchio regolabile** attorno: slider raggio **0–500 m, default 100 m** (a 0 = verifica puntuale). Il centro si può trascinare per aggiustarlo.
3. Si apre la **scheda verdetto** (bottom sheet su mobile, card su desktop):
   - esito grande e colorato: ✅ consentito · 🟡 con condizioni · 🟠 serve autorizzazione · ⛔ vietato · ⚠️ verifica ufficialmente;
   - **quota massima** consentita;
   - **note operative** per la combinazione drone+qualifica (distanze da persone ecc.);
   - **"perché"**: elenco zone intersecate ordinate per severità (accordion, §3.3);
   - eventuali **warnings** (es. limite AMSL, qualifica scaduta);
   - link **"verifica su D-Flight"**.
4. Nella scheda c'è il **selettore del drone attivo**: cambio drone → ricalcolo immediato del verdetto.
5. **X** esce dalla modalità e ripulisce punto/cerchio.

Stati degradati:
- **Nessun dataset zone** → pulsante Verifica disabilitato con tooltip.
- **Nessun drone o nessuna qualifica** → la scheda mostra ⚠️ con invito a configurare il profilo (tap → apre il pannello profilo). Mai un finto verdetto.

### 3.2 Pannello profilo
Pulsante **"Profilo"** nella barra controlli. Sheet su mobile, card su desktop. Due blocchi:

- **I miei droni** — lista con aggiungi/modifica/elimina. Campi: **nome**, **massa (g)**, **classe** (`C0 · C1 · C2 · C3 · C4 · sub-250g senza classe · legacy ≥250g senza classe`). Radio per il **drone attivo**.
- **Pilota** — checkbox **A1/A3** e **A2**, ciascuna con **data di scadenza opzionale** (se scaduta il motore la tratta come assente, con warning). **Numero operatore** opzionale, solo visualizzazione.

### 3.3 Zone sovrapposte: accordion + evidenziazione (decisione utente 2026-07-03)
Le zone sovrapposte mostrate "in colonna" tutte insieme confondono. Nuovo comportamento, valido **sia per il popup della mappa (rework del comportamento Fase 1) sia per l'elenco "perché" del verdetto**:

- si mostra la **lista compatta dei soli nomi** (ordinati per severità);
- se ne apre **una sola alla volta** (accordion) con i dettagli completi;
- la zona aperta viene **evidenziata sulla mappa** con un bordo acceso, così è inequivocabile a quale area si riferiscono i dettagli;
- chiusura dell'accordion o del popup/scheda → l'evidenziazione sparisce.

Il **verdetto** continua comunque a combinare **tutte** le zone intersecate (la severità non dipende da quale zona stai consultando).

## 4. Architettura

### 4.1 Moduli nuovi

```
src/profiles/   → tipi Drone/Pilot, profileStore.ts, ProfilePanel.tsx, useProfiles.ts
src/rules/      → ruleTable.ts (dati normativi tipati), rulesEngine.ts (funzioni pure)
src/verify/     → intersect.ts (punto/cerchio ↔ zone, Turf), VerifyMode.tsx, VerdictSheet.tsx
```

Confini:
- **`rulesEngine`** non tocca mappa né IndexedDB: `(zone intersecate, drone, pilota) → Verdict`. Testabile al 100% senza browser.
- **`intersect`** è geometria pura, separata dal motore: usa `@turf/circle` + `@turf/boolean-intersects` (pacchetti modulari, tree-shakable).
- **`profileStore`** replica lo stile di `zoneStore` (funzioni async + `idb`).

### 4.2 Persistenza
Stesso DB IndexedDB di Fase 1, **due store nuovi**: `drones` (un record per drone) e `settings` (chiavi `activeDroneId`, `pilot`). Migrazione di versione del DB gestita da `idb` upgrade callback.

### 4.3 Modello dati

```ts
Drone  { id, name, massGrams, cClass: 'C0'|'C1'|'C2'|'C3'|'C4'|'sub250'|'legacy250plus' }
Pilot  { competencies: { a1a3?: { validUntil?: string }, a2?: { validUntil?: string } },
         operatorId?: string }

Verdict {
  outcome: 'ok' | 'conditions' | 'auth_required' | 'forbidden' | 'verify',
  maxAltitudeM: number | null,   // null quando outcome è forbidden/verify
  operationalNotes: string[],    // vincoli Open per la combinazione drone+qualifica
  zones: ZoneRef[],              // ordinate per severità (per l'accordion)
  warnings: string[],            // es. "limite in AMSL", "A2 scaduta"
  references: string[]           // riferimenti normativi citati
}
```

## 5. Motore di regole

### 5.1 Passo 1 — sottocategoria ammessa (`ruleTable.ts`)
Tabella tipata, una riga per combinazione, ciascuna con riferimento normativo e test dedicato:

| Drone | Qualifica minima | Sottocategoria | Note operative principali |
|---|---|---|---|
| sub-250g (o C0) | — (registrazione operatore) | A1 | no sorvolo assembramenti; evitare sorvolo persone non coinvolte |
| C1 | A1/A3 | A1 | no sorvolo persone non coinvolte; se accade, ridurre al minimo |
| C2 | A2 | A2 | 30 m da persone non coinvolte (5 m in modalità low-speed) |
| C2 | solo A1/A3 | A3 | 150 m da aree residenziali/commerciali/industriali/ricreative |
| C3, C4 | A1/A3 | A3 | come sopra; nessuna persona non coinvolta nel raggio |
| legacy ≥250g | A1/A3 | A3 | solo A3 dal 1/1/2024 |

> Un drone legacy **sotto** i 250 g si inserisce come classe "sub-250g senza classe" (prima riga): le regole coincidono, quindi l'enum `cClass` non ha un valore dedicato.
| combinazione assente | — | — | ⚠️ `verify` — mai un falso "ok" |

### 5.2 Passo 2 — combinazione con le zone
Si prende la restrizione **più severa** tra le zone intersecate:
- `prohibited` → ⛔ `forbidden`;
- `auth_required` → 🟠 `auth_required` + contatti autorità;
- `conditional` → 🟡 `conditions` + condizioni testuali della zona;
- `none` / nessuna zona → esito del Passo 1 con le sue note operative.

### 5.3 Passo 3 — quota
`maxAltitudeM = min(120 m AGL, upperLimit di ogni zona intersecata con riferimento AGL)`.
Limiti in **AMSL non vengono convertiti** (servirebbe l'elevazione del terreno): la quota resta il minimo dei limiti AGL noti e la zona finisce in `warnings` ("Zona X: soffitto 500 m AMSL — verifica l'altitudine del luogo"). Conservativo, mai una conversione silenziosa.

### 5.4 Passo 4 — validità temporale
Le zone con `applicability` a schedule/finestra **non vengono filtrate**: contano nel verdetto e la scheda mostra la finestra ("attiva: lun–ven 8–20"). Il filtro "vale adesso?" è un raffinamento futuro; nel dubbio, più severo.

### 5.5 Fonti normative
EU 2019/947 consolidato + Regolamento ENAC UAS-IT. **Deliverable dell'implementazione:** validare ogni riga della tabella con le fonti e citarla in `references`. Regole di prudenza: A2 scaduta = assente (con warning); massa del drone solo display (la classe comanda); qualsiasi lacuna → `verify`.

## 6. Gestione errori e casi limite

- Nessun dataset zone → Verifica disabilitata (tooltip).
- Nessun drone attivo / nessuna qualifica → ⚠️ + CTA al profilo, nessun finto verdetto.
- Qualifica A2 scaduta → trattata come assente + warning.
- Zona con limite AMSL → warning (§5.3).
- Combinazione fuori tabella → `verify`, sempre.
- Il disclaimer di Fase 1 resta; la scheda verdetto ripete il link "verifica su D-Flight".

## 7. Test

- **`rulesEngine` tabellare** (il più critico): suite che itera classi × qualifiche × tipi zona, inclusi tutti i fallback conservativi.
- **`intersect`**: punto dentro/fuori/sul bordo; cerchio che interseca senza contenere il centro; multi-zona sovrapposte; raggio 0.
- **`profileStore`**: CRUD droni, drone attivo, pilota (fake-indexeddb come in Fase 1).
- **Componenti**: VerdictSheet (tutti gli esiti, accordion, warnings), ProfilePanel (validazione campi).
- **E2E finale** con Playwright headless (come Fase 1): profilo → verifica punto+cerchio → verdetto → accordion evidenzia la zona → cambio drone ricalcola.

## 8. Fuori scope Fase 2 (confermati 2026-07-03)

Spot salvati · ricolora-mappa per drone · poligoni · filtri zone · categoria Specific/STS · filtro temporale "attiva adesso" · preset droni.

## 9. Backlog ereditato da Fase 1 (da valutare nel piano)

- Bottone import parzialmente coperto dall'attribution CARTO su 1280×800 (finding E2E).
- Bundle 1.24 MB — code-splitting MapLibre (nota deploy).
- Minor findings del ledger `.superpowers/sdd/progress.md` marcati "backlog Fase 2".
