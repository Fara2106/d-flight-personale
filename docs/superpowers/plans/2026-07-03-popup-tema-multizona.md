# Popup mappa: tema + multi-zona — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Popup MapLibre leggibile in entrambi i temi e che mostra tutte le zone sovrapposte sotto al punto cliccato.

**Architecture:** Lo stile del popup passa dai token tema già esistenti in `src/index.css` (nessun JS). Il contenuto del popup diventa una funzione pura `buildPopupContent(items)` che costruisce DOM testabile in jsdom; `MapView` la monta con `Popup.setDOMContent` passando tutte le feature del click.

**Tech Stack:** React 18 + TS, MapLibre GL, Tailwind v3 (ma qui CSS vanilla con custom properties), Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-03-popup-tema-multizona.md`

## Global Constraints

- `verbatimModuleSyntax: true` → import di soli tipi con `import type {...}` o `import { type X }`.
- `noUnusedLocals` / `noUnusedParameters` attivi su `src`.
- Dopo ogni task eseguire anche `npx tsc -b` oltre alla suite e riportarne l'esito.
- Testo nel popup sempre via `textContent` / `createTextNode` — mai HTML raw (decisione polish `2b29d82`).
- Copy utente in italiano ("Quota max: …").
- Lavorare su `main` direttamente (cambiamento piccolo post-Fase 1) — commit atomici per task.

---

### Task 1: Stile popup nei token tema

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: token `--surface`, `--text`, `--text-muted`, `--shadow` già definiti in `:root` / `[data-theme='dark']`.
- Produces: classi CSS `.zone-popup`, `.zone-popup-item`, `.zone-popup-dot` usate dal Task 2.

Nessun unit test possibile (solo CSS): verifica = suite invariata + `tsc -b` + E2E visivo finale.

- [x] **Step 1: Aggiungere le regole CSS in coda a `src/index.css`**

```css
/* Popup MapLibre — segue i token tema (default libreria: bianco fisso) */
.maplibregl-popup-content {
  background: var(--surface);
  color: var(--text);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 10px 14px;
  font-family: inherit;
}
.maplibregl-popup-close-button {
  color: var(--text-muted);
  font-size: 16px;
  padding: 2px 6px;
}
.maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip { border-top-color: var(--surface); }
.maplibregl-popup-anchor-top .maplibregl-popup-tip,
.maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
.maplibregl-popup-anchor-top-right .maplibregl-popup-tip { border-bottom-color: var(--surface); }
.maplibregl-popup-anchor-left .maplibregl-popup-tip { border-right-color: var(--surface); }
.maplibregl-popup-anchor-right .maplibregl-popup-tip { border-left-color: var(--surface); }

/* Contenuto popup multi-zona */
.zone-popup { max-height: 224px; overflow-y: auto; min-width: 200px; }
.zone-popup-item { display: flex; gap: 8px; align-items: baseline; padding: 6px 0; }
.zone-popup-item + .zone-popup-item { border-top: 1px solid rgba(138, 147, 160, 0.25); }
.zone-popup-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; align-self: center; }
```

- [x] **Step 2: Verifica**

Run: `npx vitest run && npx tsc -b`
Expected: suite 34/34 PASS, typecheck senza errori.

- [x] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: popup MapLibre stilizzato coi token tema (leggibile in dark)"
```

---

### Task 2: `buildPopupContent` puro + test

**Files:**
- Create: `src/map/popupContent.ts`
- Test: `tests/map/popupContent.test.ts`

**Interfaces:**
- Consumes: `ZONE_COLORS` da `src/map/mapStyle.ts`; classi CSS `.zone-popup`, `.zone-popup-item`, `.zone-popup-dot` (Task 1). Le properties feature arrivano da `zonesToGeoJSON`: `id`, `name`, `restrictionType`, `label`, `upperLimitM`, `verticalRef`, `message`.
- Produces: `buildPopupContent(items: Array<Record<string, unknown>>): HTMLElement` — usata dal Task 3.

- [x] **Step 1: Scrivere i test (falliranno: modulo inesistente)**

`tests/map/popupContent.test.ts`:

```ts
import { it, expect } from 'vitest';
import { buildPopupContent } from '../../src/map/popupContent';

const zone = (over: Record<string, unknown> = {}) => ({
  id: 'z1', name: 'CTR Roma', restrictionType: 'auth_required',
  label: '⚠️ 45 m', upperLimitM: 45, verticalRef: 'AGL', ...over,
});

it('rende nome, etichetta e quota max di una zona', () => {
  const el = buildPopupContent([zone()]);
  expect(el.className).toBe('zone-popup');
  const items = el.querySelectorAll('.zone-popup-item');
  expect(items).toHaveLength(1);
  expect(items[0].textContent).toContain('CTR Roma');
  expect(items[0].textContent).toContain('⚠️ 45 m');
  expect(items[0].textContent).toContain('Quota max: 45 m AGL');
});

it('mostra — quando la quota max è assente', () => {
  const el = buildPopupContent([zone({ upperLimitM: null, verticalRef: null })]);
  expect(el.textContent).toContain('Quota max: —');
});

it('deduplica le zone con lo stesso id', () => {
  const el = buildPopupContent([zone(), zone(), zone({ id: 'z2', name: 'P-Zona' })]);
  expect(el.querySelectorAll('.zone-popup-item')).toHaveLength(2);
});

it('ordina per restrittività: prohibited prima, none in fondo, sconosciute in coda', () => {
  const el = buildPopupContent([
    zone({ id: 'a', name: 'Verde', restrictionType: 'none' }),
    zone({ id: 'b', name: 'Ignota', restrictionType: 'boh' }),
    zone({ id: 'c', name: 'Rossa', restrictionType: 'prohibited' }),
    zone({ id: 'd', name: 'Gialla', restrictionType: 'conditional' }),
  ]);
  const names = [...el.querySelectorAll('.zone-popup-item strong')].map((n) => n.textContent);
  expect(names).toEqual(['Rossa', 'Gialla', 'Verde', 'Ignota']);
});

it('colora il pallino secondo il tipo di restrizione, grigio se sconosciuto', () => {
  const el = buildPopupContent([
    zone({ id: 'a', restrictionType: 'prohibited' }),
    zone({ id: 'b', restrictionType: 'boh' }),
  ]);
  const dots = [...el.querySelectorAll('.zone-popup-dot')] as HTMLElement[];
  expect(dots[0].style.backgroundColor).toBe('rgb(239, 68, 68)'); // #ef4444
  expect(dots[1].style.backgroundColor).toBe('rgb(136, 136, 136)'); // #888888
});
```

- [x] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/map/popupContent.test.ts`
Expected: FAIL — "Cannot find module .../src/map/popupContent" (o simile).

- [x] **Step 3: Implementazione minima**

`src/map/popupContent.ts`:

```ts
import { ZONE_COLORS } from './mapStyle';
import type { RestrictionType } from '../data/ed269.types';

const ORDER: Record<RestrictionType, number> = {
  prohibited: 0, auth_required: 1, conditional: 2, none: 3,
};
const FALLBACK_COLOR = '#888888';

/** Contenuto popup per una o più zone sovrapposte: dedup per id,
 *  ordinate dalla più restrittiva; solo textContent (niente HTML raw). */
export function buildPopupContent(items: Array<Record<string, unknown>>): HTMLElement {
  const seen = new Set<unknown>();
  const zones = items.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  zones.sort((a, b) =>
    (ORDER[a.restrictionType as RestrictionType] ?? 99) -
    (ORDER[b.restrictionType as RestrictionType] ?? 99));

  const root = document.createElement('div');
  root.className = 'zone-popup';
  for (const p of zones) {
    const item = document.createElement('div');
    item.className = 'zone-popup-item';

    const dot = document.createElement('span');
    dot.className = 'zone-popup-dot';
    dot.style.backgroundColor =
      ZONE_COLORS[p.restrictionType as RestrictionType] ?? FALLBACK_COLOR;
    item.appendChild(dot);

    const body = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = typeof p.name === 'string' ? p.name : '';
    body.appendChild(strong);
    body.appendChild(document.createElement('br'));
    body.appendChild(document.createTextNode(
      typeof p.label === 'string' ? p.label : '—'));
    body.appendChild(document.createElement('br'));
    const ref = p.verticalRef ? ` ${p.verticalRef}` : '';
    const ceiling = p.upperLimitM != null ? `${p.upperLimitM} m${ref}` : '—';
    body.appendChild(document.createTextNode(`Quota max: ${ceiling}`));
    item.appendChild(body);

    root.appendChild(item);
  }
  return root;
}
```

- [x] **Step 4: Verificare che passino**

Run: `npx vitest run tests/map/popupContent.test.ts`
Expected: 5 PASS.

- [x] **Step 5: Suite completa + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: 39/39 PASS, typecheck senza errori.

- [x] **Step 6: Commit**

```bash
git add src/map/popupContent.ts tests/map/popupContent.test.ts
git commit -m "feat: buildPopupContent — popup multi-zona puro e testato"
```

---

### Task 3: Wiring in MapView (tutte le feature del click)

**Files:**
- Modify: `src/map/MapView.tsx:57-78` (click handler)

**Interfaces:**
- Consumes: `buildPopupContent(items: Array<Record<string, unknown>>): HTMLElement` (Task 2).
- Produces: nessuna nuova interfaccia; `onZoneClick` invariato (prima feature).

Nota: in MapLibre, per i listener scoped a un layer (`m.on('click', 'zones-fill', …)`) `e.features` contiene **tutte** le feature del layer sotto al punto (ordinate dall'alto); i duplicati da tile-split li gestisce la dedup del Task 2. Niente unit test nuovo: MapLibre non gira in jsdom (precedente Task 14), verifica via suite + tsc + E2E manuale.

- [x] **Step 1: Sostituire il click handler**

In `src/map/MapView.tsx`, sostituire il blocco `m.on('click', 'zones-fill', …)` con:

```ts
    m.on('click', 'zones-fill', (e) => {
      const feats = e.features ?? [];
      if (feats.length === 0) return;
      if (onZoneClick) onZoneClick(feats[0].properties || {});
      new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setDOMContent(buildPopupContent(feats.map((f) => f.properties ?? {})))
        .addTo(m);
    });
```

e aggiungere l'import in testa al file:

```ts
import { buildPopupContent } from './popupContent';
```

- [x] **Step 2: Verifica**

Run: `npx vitest run && npx tsc -b`
Expected: 39/39 PASS, typecheck senza errori (attenzione `noUnusedLocals`: le variabili `p`, `ref`, `ceiling`, `container`, `strong` del vecchio blocco vanno rimosse col blocco stesso).

- [x] **Step 3: Commit**

```bash
git add src/map/MapView.tsx
git commit -m "feat: popup mostra tutte le zone sovrapposte al click"
```

---

## Post-piano
- Aggiornare `MEMORIA.md` (TODO popup → fatto) e `.superpowers/sdd/progress.md` (chiuso il Minor "popup formatting non testato" del Task 10); commit docs.
- Review del diff complessivo (code-review) prima di dichiarare chiuso.
- Resta: verifica manuale E2E con l'utente (temi, multi-zona, ricerca, GPS, persistenza) e deploy GitHub Pages.
