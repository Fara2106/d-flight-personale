# D-Flight personale — Restyle UI "premium" (vetro stile iOS)

**Data:** 2026-07-16 · **Stato:** approvata da Lorenzo (brainstorming in chat)
**Scopo:** rendere il guscio dell'app curato e premium. **Solo UI: nessuna modifica funzionale.**

## Vincoli non negoziabili

- **La resa della mappa è la BASELINE APPROVATA (round 6+7)** e non si tocca:
  colori zone, veli, mosaico, bordi, etichette-quota, etichette luoghi, mare blu
  notte in dark. Il restyle riguarda solo il *chrome* (pannelli, bottoni, popup,
  sheet, banner, modali).
- Nessuna modifica a testi utente, `aria-label`, ruoli, struttura DOM
  significativa: suite Vitest ed E2E devono restare verdi senza ritocchi (o al
  massimo ritocchi ad assert puramente stilistici).
- Zero dipendenze nuove: solo CSS (token + classi condivise) e SVG inline.
- Accento blu iOS (`#007aff`/`#0a84ff`) e colori zone invariati.
- Tema Chiaro/Scuro/Sistema: ogni scelta va rifinita in entrambi i temi.

## Approccio scelto (A)

Solo CSS + sistema di token in `index.css`, con classe `.glass` condivisa.
Scartati: B (libreria Motion: dipendenza inutile per micro-transizioni sobrie),
C (shadcn/Radix: sproporzionato, test da rifare).

## 1. Fondamenta

**Token nuovi in `:root` / `[data-theme='dark']`:**

- `--glass-bg`: bianco ~72% alpha (chiaro) / blu-grigio scuro ~68% alpha (scuro).
- `--glass-border`: 1px bianco tenue (più luminoso in chiaro, sottile in scuro).
- Blur: `backdrop-filter: blur(20px) saturate(1.4)` (con prefisso `-webkit-`).
- Fallback: `@supports not (backdrop-filter: blur(1px))` → superficie piena
  attuale (`--surface`).
- **Scala raggi**: pillola (ricerca), 14px (controlli), 18px (card/pannelli),
  22px (sheet/modali).
- **Due ombre**: `--shadow-sm` (controlli piccoli, leggera) e `--shadow-lg`
  (pannelli/sheet, profonda e morbida). Sostituiscono l'unica `--shadow`.
- **Tipografia**: font di sistema invariato; titoli semibold con
  letter-spacing leggermente stretto; secondari in `--text-muted`; dimensioni
  allineate su una scala coerente.
- **Icone**: 5-6 SVG inline monocromatiche stile SF Symbols (lente, sole, luna,
  auto/sistema, freccia posizione, X chiusura, freccia import, chevron).
  Sostituiscono le emoji ⌕ ☀️ 🌙 🖥️. Nessuna libreria icone.

## 2. Componenti (solo pelle)

- **SearchBox**: pillola di vetro, lente SVG interna a sinistra, focus ring blu
  tenue; dropdown risultati = pannello vetro, righe con separatori sottili e
  highlight su hover/focus.
- **ThemeToggle**: segmented control iOS — pillola attiva che scivola tra le
  voci (micro-transizione), icone SVG.
- **LocateButton**: quadratino vetro con freccia SVG; pieno blu quando attivo.
- **Bottoni Verifica / Importa**: blu accento pieni (azioni primarie), raggio
  di scala, ombra colorata tenue, press con compressione (scale 0.97).
- **Legend**: card vetro, chevron che ruota all'apertura, righe più ariose;
  chip colore zone IDENTICI (incluso tratteggio auth). Checkbox coerenti con
  l'accento.
- **Banner** (OfflineBanner, DataStatusBanner, Disclaimer): card vetro compatte
  con puntino/icona colorata a sinistra. L'errore (`err`/`geo.error` in App)
  diventa una card d'errore leggibile nei due temi (non testo rosso nudo).
- **Popup MapLibre**: vetro (contenuto + tip), accordion con più aria,
  "Dettagli tecnici" più discreto. Regole sempre con prefisso `:root`
  (gotcha cascata maplibre-gl.css).
- **VerifyControls + VerdictSheet**: vetro; su mobile lo sheet ha la
  maniglietta grigia in alto (grabber iOS). Logica e testi verdetto invariati.
- **ProfilePanel + EmptyState**: overlay scurito con `backdrop-blur`, card
  vetro centrata.
- **UpdateToast**: stessa famiglia vetro.

## 3. Micro-transizioni (tutto CSS, 150–250ms)

- Comparsa dropdown/popup/banner/toast: fade + slide 8–12px.
- VerdictSheet mobile: sale dal basso; VerifyControls: scende dall'alto.
- Bottoni: press scale 0.97, hover con schiarita.
- Pillola ThemeToggle che scivola.
- `@media (prefers-reduced-motion: reduce)` → transizioni spente.

## Verifica

1. Suite Vitest completa + `tsc -b` + `npm run build` verdi.
2. E2E sul Mac: `node e2e/run.mjs` (15) + `node e2e/offline.mjs` (11).
3. Collaudo visivo reale: screenshot prima/dopo nei due temi, desktop +
   viewport iPhone (390×844), mostrati a Lorenzo per il verdetto estetico.
   Confronto che dimostri la mappa pixel-identica.
4. Push solo dopo l'ok di Lorenzo.

## Fuori scope

- Qualsiasi cambio a rendering mappa, dati, regole, offline/PWA.
- Nuove funzioni, nuovi testi, riorganizzazione del layout (le posizioni dei
  controlli restano quelle attuali).
