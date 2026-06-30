# D-Flight personale — Specifica di design

- **Data:** 2026-06-30
- **Stato:** approvato in brainstorming, pronto per il piano di implementazione
- **Nome di lavoro:** "D-Flight personale" (provvisorio — vedi §16)

---

## 1. Obiettivo e concetto

Una **web app personale** (PWA installabile, funzionante offline) che mostra le **zone geografiche UAS ufficiali italiane** su una mappa moderna e leggibile, e — su richiesta — fornisce un **verdetto personalizzato "posso volare qui?"** basato sui droni e sulle qualifiche dell'utente.

I dati provengono dal **file ufficiale ED-269** che l'utente importa dal proprio account D-Flight. L'app **non è ufficiale** e rimanda sempre a D-Flight / AIP per la validità legale.

**Principio guida della UX:** la funzione base è la **mappa nuda e cruda**. Si apre e si vede subito dove si può volare, senza dover disegnare nulla. La pianificazione (punti/aree + verdetto personalizzato) è un'azione **opzionale e on-demand**, mai un passaggio obbligato.

---

## 2. Decisioni chiave (riepilogo dal brainstorming)

| Tema | Decisione |
|------|-----------|
| Scopo | Mappa zone + pianificazione personalizzata (opzionale) |
| Dispositivo | PWA responsive completa (desktop + mobile), offline |
| Sincronizzazione | **Solo import in un tap** del file ED-269; niente backend, niente credenziali |
| Pianificazione | Verdetto su misura per drone + qualifica dell'utente, calcolato in locale |
| Estetica | Stile "B — Chiaro & essenziale" (mappe iOS), tema Chiaro / Scuro / Sistema, accenti blu |
| Architettura | PWA 100% statica, nessun account, dati locali (IndexedDB) |

> **Perché solo import (no auto-login).** Una PWA nel browser non può scaricare il file da D-Flight cross-origin (lo blocca il **CORS**) nemmeno con credenziali salvate in locale — non è un'API pubblica. Usare credenziali sul dispositivo per l'auto-aggiornamento richiederebbe un **proxy serverless** (reintroduce un server, zona grigia ToS) oppure un **guscio nativo** (Capacitor): rimandato a un'eventuale versione nativa futura. L'import manuale è reso **a zero-attrito** (un tap "Aggiorna" + "condividi all'app" su mobile + promemoria staleness).

---

## 3. Vincoli e note di responsabilità (legale / sicurezza)

- **App non ufficiale.** Disclaimer evidente al primo avvio e accesso permanente alla fonte ufficiale ("verifica su D-Flight / AIP").
- **Dati di sicurezza aerea.** Il verdetto è di supporto, non sostituisce la verifica ufficiale prima del volo.
- **Data del ciclo sempre visibile** (es. "dati aggiornati al 26/06/2026") con banner se più vecchi di ~28 giorni (ciclo AIRAC).
- **Nessuna replica delle funzioni regolamentate** (registrazione operatore/drone, QR, invio richieste di autorizzazione): non esiste API pubblica e non sono replicabili come mirror.

---

## 4. Fonte dati ufficiale (ED-269)

D-Flight pubblica le zone geografiche UAS nel formato standard **EUROCAE ED-269** (JSON/GeoJSON, RFC 7946), riservato agli **operatori registrati** (accreditamento gratuito via email). Aggiornamento sul ciclo ufficiale **~ogni 28 giorni**.

Per ogni zona il file riporta: **volume di spazio aereo** (geometria + limiti di quota), **validità temporale**, **regole applicabili**, **tipo di restrizione** e **contatti dell'autorità** per le autorizzazioni.

**Campi ED-269 rilevanti → mappatura interna** (vedi §7):
- `identifier`, `name`, `country`, `type`
- `restriction` → `PROHIBITED` | `REQ_AUTHORISATION` | `CONDITIONAL` | `NO_RESTRICTION`
- `restrictionConditions`, `reason[]`, `otherReasonInfo`, `message`
- `applicability` (permanente o con `schedule` / `startDateTime` / `endDateTime`)
- `zoneAuthority` (nome, email, telefono, purpose)
- `geometry.horizontalProjection` (cerchio/poligono), `lowerLimit`/`upperLimit`, riferimenti verticali (AGL/AMSL)

> **Questione aperta:** documentare il percorso esatto di download dal portale D-Flight (per l'onboarding) e verificare se le **riserve temporanee ad hoc** (NOTAM dell'ultimo minuto) sono incluse nel file mensile o solo sul portale live. In ogni caso resta il link "verifica ufficiale".

---

## 5. Esperienza utente

### 5.1 Modalità base — mappa "nuda e cruda" (default)
All'apertura: mappa a tutto schermo con le **zone ufficiali colorate** per tipo di restrizione, **ciascuna con la quota massima di volo mostrata in etichetta**:
- 🟢 verde — nessuna restrizione / regole generali · *quota max (es. "120 m")*
- 🟡 giallo — condizionato · *quota max (es. "60 m")*
- 🟠 arancio — richiede autorizzazione · *quota max*
- 🔴 rosso — vietato · *etichetta "⛔ 0 m"*

La **quota massima** proviene dal campo `upperLimit` dell'ED-269 (riferimento AGL/AMSL nel dettaglio) ed è mostrata **direttamente sulla zona**: a colpo d'occhio vedi *colore + altezza massima* senza dover toccare nulla. *(Nota: qui è la quota **della zona**, "nuda e cruda"; il verdetto personalizzato di §9 può abbassarla al limite Open di 120 m AGL.)*

Azioni sempre disponibili, senza disegnare nulla:
- **Tap su una zona** → scheda con nome, tipo restrizione, limiti di quota, validità temporale, condizioni, contatto autorità, link "verifica su D-Flight".
- **Cerca un luogo** (geocoding).
- **La mia posizione (GPS)** — puntino blu con cerchio di precisione e pulsante "centra su di me". Usa il GPS del telefono in campo (preciso) o la posizione approssimata su desktop (Wi-Fi/rete). La posizione **resta sul dispositivo** (nessun invio), richiede il consenso del browser e HTTPS, e funziona **offline** se i tile dell'area sono già in cache. Può fare da punto di partenza per la verifica on-demand.
- **Filtri**: mostra/nascondi categorie di zone, filtro per quota.
- *(Opzionale)* toggle **"colora per il mio drone"**: ricolora le zone in base alla classe del drone attivo. **Off di default.**

### 5.2 Verifica / pianificazione (on-demand)
Pulsante esplicito (es. "Verifica un'area"). L'utente **tocca un punto** o **disegna un'area** (cerchio con raggio o poligono). L'app calcola il **verdetto personalizzato** (§9) nella scheda in basso: esito, **quota massima**, condizioni, e **"perché"** (elenco delle zone intersecate), con link di verifica ufficiale. Le aree si possono **salvare come spot**.

### 5.3 Profili (droni e pilota)
- **I miei droni**: nome, **massa (g)**, **classe C0–C4** / sub-250g / legacy-autocostruito; preset comuni (es. DJI Mini/Air…). Selezione del **drone attivo**.
- **Pilota**: qualifiche possedute (**A1/A3**, **A2**, eventuali STS in futuro), date di validità opzionali, numero operatore opzionale (solo visualizzazione).

### 5.4 Import dati & aggiornamento
- Import del file ED-269 via **file picker / drag-drop / "condividi all'app"** (Web Share Target su mobile).
- Validazione schema → normalizzazione → **diff** rispetto ai dati attuali ("12 zone aggiunte, 3 modificate, 1 rimossa") → salvataggio con data del ciclo.
- All'apertura: se i dati mancano → onboarding; se sono vecchi (> ciclo) → banner "aggiorna".

### 5.5 Tema
Interruttore **Chiaro / Scuro / Sistema**, persistito, che guida sia l'UI sia lo stile della mappa.

---

## 6. Architettura tecnica

### Stack
- **PWA 100% statica**, nessun backend, nessun account.
- **React + TypeScript + Vite**.
- **MapLibre GL JS** per la mappa, con stile vettoriale **chiaro/scuro**. Default: **OpenFreeMap** (tile vettoriali gratuiti, **senza chiave/account** — coerente con l'approccio "nessuna credenziale"); alternativa più rifinita: **MapTiler** (free tier, una chiave pubblica).
- **Geocoder (ricerca luoghi)**: **Photon** (senza chiave); fallback Nominatim rispettandone la policy d'uso.
- **Tailwind CSS** per l'UI pulita iOS-like.
- **Service worker (Workbox)** per offline + installabilità.
- **IndexedDB** (wrapper `idb`/Dexie) per zone, profili e spot.
- Deploy statico (Vercel/Netlify/Pages) o esecuzione locale.

### Moduli (unità isolate e testabili)
1. **`zoneStore` — ingestione & archivio dati**: parse/validazione ED-269, normalizzazione, diff, persistenza IndexedDB, query di intersezione (punto/area → zone).
2. **`MapView` — mappa**: render livelli zone colorati, popup dettaglio, ricerca, GPS, filtri, toggle "colora per il mio drone".
3. **`profiles` — profili**: CRUD droni e pilota, selezione attivi (IndexedDB).
4. **`rulesEngine` — motore di regole**: funzioni pure, input = zone intersecate + drone + qualifica → verdetto conservativo e trasparente (§9).
5. **`planner` — pianificazione**: disegno punto/area, esecuzione verifica, salvataggio spot.
6. **`pwa` — offline/installabilità**, **`theme` — tema**, **`safety` — disclaimer + data ciclo + link ufficiali**.

---

## 7. Modello dati interno

```
Zone {
  id, name, restrictionType: 'prohibited'|'auth_required'|'conditional'|'none',
  geometry: GeoJSON, lowerLimitM, upperLimitM, verticalRef: 'AGL'|'AMSL',
  timeApplicability: { permanent: bool, schedule?, start?, end? },
  conditions?, message?, reasons?: string[],
  authority?: { name, email, phone }, sourceCycle
}
Drone   { id, name, massGrams, cClass: 'C0'|'C1'|'C2'|'C3'|'C4'|'sub250'|'legacy', notes? }
Pilot   { id, name, competencies: ('A1A3'|'A2'|...)[], validUntil?, operatorId? }
Spot    { id, name, geometry, droneId?, pilotId?, lastVerdict?, createdAt }
DatasetMeta { cycleDate, importedAt, zoneCount }
```

---

## 8. Flusso dati

Import JSON → parse/validazione → normalizzazione → diff → **store (IndexedDB)** → **MapView** rende le zone → l'utente cerca/localizza (e *opzionalmente* tocca/disegna) → **planner** interroga `zoneStore` per le intersezioni → **rulesEngine** calcola il verdetto con drone+pilota attivi → scheda con esito + dettaglio per zona + link "verifica ufficiale". **Tutto offline dopo l'import.**

---

## 9. Motore di regole (dettaglio)

**Responsabilità:** combinare le regole **Open category** (UE 2019/947 + Regolamento ENAC UAS-IT) con la restrizione della zona, in modo **conservativo**.

Logica (semplificata):
1. Determina le zone intersecate e la restrizione più severa.
2. **Quota massima** = `min(120 m AGL, upperLimit della zona se inferiore)`.
3. Combina con la classe drone / qualifica:
   - `prohibited` → ⛔ **vietato** (salvo esenzione esplicita).
   - `auth_required` → 🟠 **serve autorizzazione** (mostra autorità/contatto + quota max).
   - `conditional` → 🟡 **consentito con condizioni** (mostra condizioni + quota max).
   - `none` → ✅ **regole Open generali** per quella classe/sottocategoria (distanze da persone, quota).
4. **Fallback conservativo:** se classe drone sconosciuta, qualifica mancante o condizioni non interpretabili → ⚠️ **"verifica ufficialmente"**. Mai un falso "puoi volare".
5. Output **trasparente**: esito + quota + condizioni + elenco zone + riferimenti normativi + link ufficiale.

> Le **tabelle di regole precise** (classe × sottocategoria × tipo zona) sono un deliverable da validare con le fonti normative durante l'implementazione, partendo dai casi più conservativi.

---

## 10. Offline & PWA

- Service worker: cache dell'app-shell + stile mappa; i dati zone sono già in IndexedDB.
- Installabile (icona su home), funziona offline con l'ultimo import.
- **Limite onesto:** i tile della mappa offline sono limitati alle aree già visitate (cache); avviso quando si naviga offline oltre la cache.

---

## 11. Gestione errori

- File errato/vecchio/non-ED-269 → errore chiaro, si mantengono i dati precedenti.
- Primo avvio senza dati → onboarding con istruzioni per scaricare il file.
- GPS/ricerca offline → fallback (pan manuale, ultima posizione nota).
- Dati > ciclo AIRAC → banner "aggiorna".
- Incertezza del motore → verdetto conservativo "verifica".

---

## 12. Estetica (stile B — bloccato)

- "Chiaro & essenziale", stile mappe iOS: tanto spazio, schede arrotondate, ombre morbide.
- Tema **Chiaro / Scuro / Sistema** (interruttore a 3 stati).
- Accenti **blu** (`#007aff` chiaro / `#0a84ff` scuro); esiti **verde / ambra / rosso**.
- Tipografia ampia e leggibile (niente testo spezzato a capo nelle schede).
- Riferimento visivo: mockup salvati in `.superpowers/brainstorm/`.

---

## 13. Test

- **Vitest** per: parser/normalizzatore ED-269, diff, query di intersezione, e soprattutto il **`rulesEngine`** (test tabellari: classi drone × tipi zona × qualifiche, inclusi i fallback conservativi).
- Test dei componenti per i flussi chiave (import, visualizzazione verdetto).
- Piano di test manuale con un file ED-269 reale.

---

## 14. Fuori scope (YAGNI)

Account/cloud sync, notifiche push, invio registrazioni/autorizzazioni a D-Flight, login automatico/scraping, categoria Specific/STS completa (si parte dalla Open).

---

## 15. Rischi & questioni aperte

1. Percorso esatto di download del file ED-269 dal portale (per l'onboarding).
2. Copertura delle **riserve temporanee** nel file mensile (mitigazione: link ufficiale sempre presente).
3. Provider tile mappa → **default OpenFreeMap** (keyless); valutare MapTiler se serve più polish/affidabilità. Resta da definire la strategia di **cache tile offline**.
4. Geocoder → **default Photon** (keyless); fallback Nominatim rispettandone la policy d'uso.
5. Codifica accurata e conservativa delle tabelle normative del `rulesEngine`.
6. Nome/marchio per un'eventuale pubblicazione (§16).

---

## 16. Nome / branding

"D-Flight" è marchio di D-Flight S.p.A. Per **uso personale** va bene il nome di lavoro. Per un'eventuale pubblicazione servirà un nome diverso + dicitura "non ufficiale" (es. *VoloCheck*, *DroneZone IT*). Solo una segnalazione, nessuna azione richiesta ora.
